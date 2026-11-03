import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { ignoredDirectories } from './discover.ts';
import { readToml } from './rls-audit.ts';
import { VERSION } from './version.ts';

// Offline abuse-protection audit. It finds server entry points (API routes, server actions,
// Edge/Cloud Functions, Express-style handlers, Python views) that do something an attacker can
// repeat to cost the founder money or harm users (call an AI model, send SMS or email, check a
// password), and reports the ones with no recognizable rate limit or per-user quota.
// It also reads supabase/config.toml for phone sign-in without CAPTCHA, and AI calls for
// missing output caps or a model chosen by the request. Every result is a lead to trace.

export type Operation = 'ai' | 'sms' | 'email' | 'auth';
export type LimitLead = {
  kind: string;
  object: string;
  file: string;
  line: number;
  operations: Operation[];
  detail: string;
};
export type Guarded = { object: string; file: string; operations: Operation[]; signal: string };

const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts', '.py']);
const testPath = /(^|\/)(test|tests|__tests__|__mocks__|fixtures?|examples?|mocks?|spec|e2e)\/|\.(test|spec)\.[a-z]+$/i;

// --- What counts as an abusable operation -------------------------------------------------
// Matched by imported package (JS/TS or Python) or by a provider URL or well-known call.
// One table per operation keeps the detector easy to extend: add a package or a pattern.
const operationPackages: Record<Operation, string[]> = {
  ai: ['openai', '@anthropic-ai/sdk', '@google/genai', '@google/generative-ai', 'ai', '@ai-sdk/[\\w-]+', 'groq-sdk', '@mistralai/mistralai', 'cohere-ai', 'replicate', '@fal-ai/[\\w-]+', 'langchain', '@langchain/[\\w-]+', 'together-ai', 'ollama'],
  sms: ['twilio', '@vonage/server-sdk', 'plivo', 'messagebird', 'telnyx', '@sinch/sdk-core'],
  email: ['resend', '@sendgrid/mail', 'nodemailer', 'postmark', 'mailgun\\.js', '@aws-sdk/client-sesv?2?', 'loops', '@mailchimp/mailchimp_transactional'],
  auth: ['bcrypt', 'bcryptjs', 'argon2', '@node-rs/argon2', '@node-rs/bcrypt']
};
const operationPatterns: Record<Operation, RegExp[]> = {
  ai: [
    /api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|api\.groq\.com|openrouter\.ai\/api|api\.mistral\.ai|api\.replicate\.com|api\.together\.xyz|api\.deepseek\.com|api\.x\.ai|api\.perplexity\.ai/,
    /^\s*(?:from|import)\s+(?:openai|anthropic|google\.generativeai|google\.genai|litellm|langchain\w*|groq|mistralai|replicate|cohere)\b/m
  ],
  sms: [
    /api\.twilio\.com|verify\.v2\.services|signInWithOtp\(\s*\{\s*phone\b/,
    /^\s*(?:from|import)\s+(?:twilio|vonage|plivo|messagebird|telnyx)\b/m
  ],
  email: [
    /api\.resend\.com|api\.sendgrid\.com|api\.postmarkapp\.com|api\.mailgun\.net|resetPasswordForEmail\(|signInWithOtp\(\s*\{\s*email\b|inviteUserByEmail\(/,
    /^\s*(?:from|import)\s+(?:smtplib|sendgrid|resend|postmarker|mailgun)\b|send_mail\(/m
  ],
  auth: [
    /\bsignInWithPassword\(|\.signUp\(|\bverifyOtp\(|\bverifyPassword\(|\bcomparePassword\(|\bcheck_password\(|\bverify_password\(|\bcheckpw\(/
  ]
};
// Route paths named like sign-in flows are auth endpoints even when the check is in a helper.
const authRouteName = /(^|\/|\()(login|log-in|signin|sign-in|signup|sign-up|register|forgot[-_]?password|reset[-_]?password|otp|verify[-_]?(otp|code|phone|email))(\)|\/|\.|$)/i;

// --- What counts as protection ----------------------------------------------------------------
// Rate limiters (libraries or a custom helper named like one). Provider error handling such as
// OpenAI's RateLimitError or "rate_limit_exceeded" is removed first: catching a provider's 429
// is not a limit on your own callers.
const providerRateErrors = /\b(?:\w+\.)?RateLimitError\b|rate_limit_(?:exceeded|error)|RateLimitExceeded(?:Error)?\b/g;
const limiterSignal = /rate[-_]?limit|ratelimit|@upstash\/ratelimit|rate-limiter-flexible|@arcjet\/|@nestjs\/throttler|ThrottlerGuard|@Throttle\(|throttle_classes|slowapi|flask_limiter|fastapi_limiter|@unkey\/ratelimit|checkRateLimit/i;
// A per-user quota or credit balance is a valid cost control for AI calls (not for SMS, email,
// or password checks, which are abused by unauthenticated or many accounts).
const quotaSignal = /\b(quota\w*|credits?|creditBalance|usage_?count|usageCount|daily_?limit|dailyLimit|messages_?left|messagesLeft|remaining_?\w*|freeMessages|free_messages|tokens_?used|tokensUsed)\b/i;
const outputCap = /max_tokens|maxTokens|max_output_tokens|maxOutputTokens|max_completion_tokens|maxCompletionTokens|max_new_tokens|num_predict/;
const modelFromRequest = /\bmodel\s*[:=]\s*(?:await\s+)?(?:req|request|body|input|params|payload|data|args|json|ctx\.req|event\.body|c\.req)(?:\??\.\w+|\[['"]\w+['"]\])*?(?:\??\.model\b|\[['"]model['"]\])|\bmodel\s*=\s*(?:request|body|payload|data|req)(?:\.\w+)*\.get\(\s*['"]model['"]/;

// Remove comments while keeping line numbers, so "TODO: add rate limit" is not a limiter.
// `//` counts only after whitespace or at line start, so URLs such as https://api.openai.com survive.
function stripComments(text: string, python: boolean): string {
  if (python) return text.replace(/(^|\s)#.*$/gm, '$1');
  return text.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/(^|\s)\/\/.*$/gm, '$1');
}

const lineOf = (text: string, index: number) => text.slice(0, index).split('\n').length;

function importedPackages(text: string): Array<{ name: string; index: number }> {
  const found = [];
  // ES import/export-from, dynamic import(), require(); Deno npm:/esm.sh specifiers included.
  const pattern = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)['"](?:npm:|jsr:|https?:\/\/esm\.sh\/)?([^'"]+)['"]/gm;
  for (const m of text.matchAll(pattern)) found.push({ name: m[1], index: m.index! });
  return found;
}

// Find which operations a file performs and the first line of each.
function operationsIn(text: string): Map<Operation, number> {
  const found = new Map<Operation, number>();
  const note = (op: Operation, index: number) => { const line = lineOf(text, index); if (!found.has(op) || found.get(op)! > line) found.set(op, line); };
  const imports = importedPackages(text);
  for (const op of Object.keys(operationPackages) as Operation[]) {
    const names = new RegExp(`^(?:${operationPackages[op].join('|')})(?:@[^/]*)?(?:/.*)?$`);
    for (const imp of imports) {
      // The Vercel AI SDK package is just "ai"; only count it when a generate/stream call is used.
      if (imp.name.replace(/@[^/]*$/, '') === 'ai' && op === 'ai' && !/\b(generate|stream)(Text|Object)\(/.test(text)) continue;
      if (names.test(imp.name)) note(op, imp.index);
    }
    for (const pattern of operationPatterns[op]) { const m = pattern.exec(text); if (m) note(op, m.index); }
  }
  return found;
}

// Is this file a server entry point that outside callers can reach?
function entryKind(path: string, text: string): string | undefined {
  if (/(^|\/)supabase\/functions\/(?!_)[^/]+\/index\.(ts|js|mts|mjs)$/.test(path)) return 'supabase-edge-function';
  if (/(^|\/)app\/(.*\/)?route\.(ts|js|mjs|tsx|jsx)$/.test(path)) return 'next-route-handler';
  if (/(^|\/)pages\/api\/.+\.(ts|js|mjs|tsx|jsx)$/.test(path)) return 'next-api-route';
  if (/\+api\.(ts|js|tsx|jsx)$/.test(path)) return 'expo-api-route';
  if (/^api\/.+\.(ts|js|mjs)$/.test(path) || /(^|\/)netlify\/functions\/.+\.(ts|js|mjs)$/.test(path)) return 'serverless-function';
  if (path.endsWith('.py')) {
    if (/^\s*@(?:\w+\.)?(?:app|router|bp|blueprint|api)\.(?:get|post|put|patch|delete|route|api_route)\(/m.test(text)) return 'python-route';
    if (/@https_fn\.on_(call|request)/.test(text)) return 'firebase-function';
    if (/(^|\/)views\.py$/.test(path) && /\bdef \w+\(\s*request\b/.test(text)) return 'django-view';
  }
  if (/^\s*['"]use server['"]/m.test(text.slice(0, 2000))) return 'server-action';
  if (/firebase-functions/.test(text) && /\b(onCall|onRequest)\s*\(|https\.(onCall|onRequest)\s*\(/.test(text)) return 'firebase-function';
  if (/\b(?:app|router|server|api|route|routes|fastify|r)\.(get|post|put|patch|delete|all)\(\s*['"`]\//.test(text)) return 'http-route';
  if (/\bDeno\.serve\(/.test(text)) return 'deno-handler';
  return undefined;
}

// A readable name for the endpoint: /api/chat, functions/chat, or the file path.
function endpointName(path: string, kind: string): string {
  let m;
  if (kind === 'supabase-edge-function' && (m = /supabase\/functions\/([^/]+)\//.exec(path))) return `functions/${m[1]}`;
  if (kind === 'next-route-handler' && (m = /(?:^|\/)app(\/.*)?\/route\.\w+$/.exec(path))) return (m[1] ?? '').replace(/\/\([^)]+\)/g, '') || '/';
  if (kind === 'next-api-route' && (m = /pages(\/api\/.+)\.\w+$/.exec(path))) return m[1].replace(/\/index$/, '');
  if (kind === 'expo-api-route' && (m = /(?:^|\/)app(\/.*)\+api\.\w+$/.exec(path))) return m[1].replace(/\/\([^)]+\)/g, '').replace(/\/index$/, '') || '/';
  return path;
}

type SourceFile = { path: string; absolute: string; text: string; python: boolean };

export async function limitsAudit(root: string, maxFiles = 20000) {
  const base = await realpath(root);
  if (!(await stat(base)).isDirectory()) throw new Error('Project root must be a directory');
  const files = new Map<string, SourceFile>(); // absolute path → stripped source
  const supabaseConfigs: string[] = [];
  const packageDirs = new Set<string>([base]);
  let filesScanned = 0;
  let skippedLarge = 0;
  let truncated = false;
  const queue = [base];
  while (queue.length && !truncated) {
    const directory = queue.shift()!;
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isSymbolicLink()) continue;
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) { if (!ignoredDirectories.has(entry.name) && !entry.name.startsWith('.')) queue.push(absolute); continue; }
      if (!entry.isFile()) continue;
      const path = relative(base, absolute).split(sep).join('/');
      if (entry.name === 'package.json') packageDirs.add(directory);
      if (entry.name === 'config.toml' && basename(directory) === 'supabase' && !testPath.test(path)) supabaseConfigs.push(absolute);
      if (!sourceExtensions.has(extname(entry.name)) || entry.name.endsWith('.d.ts') || testPath.test(path)) continue;
      if (++filesScanned > maxFiles) { truncated = true; break; }
      if ((await stat(absolute)).size > 1024 * 1024) { skippedLarge++; continue; }
      const python = entry.name.endsWith('.py');
      files.set(absolute, { path, absolute, python, text: stripComments(await readFile(absolute, 'utf8'), python) });
    }
  }

  // Resolve a local import one level deep: relative paths, plus the common @/ and ~/ aliases.
  const resolveLocal = (from: SourceFile, specifier: string): SourceFile | undefined => {
    const roots: string[] = [];
    if (specifier.startsWith('.')) roots.push(resolve(dirname(from.absolute), specifier));
    else if (/^[@~]\//.test(specifier)) {
      for (const dir of packageDirs) if (from.absolute.startsWith(dir + sep)) roots.push(join(dir, specifier.slice(2)), join(dir, 'src', specifier.slice(2)));
    } else return undefined;
    for (const candidate of roots) {
      const stem = candidate.replace(/\.(js|mjs|cjs|jsx)$/, '');
      for (const option of [candidate, ...['.ts', '.tsx', '.js', '.mjs', '.mts', '.jsx'].map(e => stem + e), ...['ts', 'tsx', 'js'].map(e => join(candidate, `index.${e}`))]) {
        const file = files.get(option);
        if (file) return file;
      }
    }
    return undefined;
  };

  // Global limiters: Next.js middleware, or app.use(...) with a limiter, in the same package.
  const globalLimiters: SourceFile[] = [...files.values()].filter(f =>
    (/(^|\/)(src\/)?middleware\.(ts|js)$/.test(f.path) && limiterSignal.test(f.text.replace(providerRateErrors, ''))) ||
    /\b(?:app|server|router)\.(?:use|register)\([^)]*(?:rate|limiter|throttl)/i.test(f.text));
  const packageOf = (file: SourceFile) => [...packageDirs].filter(d => file.absolute.startsWith(d + sep)).sort((a, b) => b.length - a.length)[0];

  const leads: LimitLead[] = [];
  const guarded: Guarded[] = [];
  let entryPoints = 0;
  for (const file of files.values()) {
    const kind = entryKind(file.path, file.text);
    if (!kind) continue;
    entryPoints++;
    const object = endpointName(file.path, kind);
    // Operations and protection in the entry file plus the local modules it imports directly.
    const importLine = new Map<string, number>(); // helper path → line of its import in the entry
    const helpers: SourceFile[] = [];
    for (const imp of file.python ? [] : importedPackages(file.text)) {
      const helper = resolveLocal(file, imp.name);
      if (helper && helper !== file && !importLine.has(helper.path)) { helpers.push(helper); importLine.set(helper.path, lineOf(file.text, imp.index)); }
    }
    const scope = [file, ...helpers];
    const ops = new Map<Operation, { file: string; line: number }>();
    for (const source of scope) {
      for (const [op, line] of operationsIn(source.text)) if (!ops.has(op)) ops.set(op, { file: source.path, line });
    }
    if (!ops.has('auth') && authRouteName.test(object) && !/sign-?out|logout/i.test(object)) ops.set('auth', { file: file.path, line: 1 });
    if (!ops.size) continue;
    const operations = [...ops.keys()].sort() as Operation[];
    const text = scope.map(s => s.text).join('\n');
    const limiterFile = scope.find(s => limiterSignal.test(s.text.replace(providerRateErrors, '')));
    const importLimiter = importedPackages(file.text).find(i => /rate[-_]?limit|ratelimit|throttl/i.test(i.name));
    const global = globalLimiters.find(g => packageOf(g) === packageOf(file) && g !== file);
    const where = (op: Operation) => ops.get(op)!;
    const entryLine = (op: Operation) => where(op).file === file.path ? where(op).line : importLine.get(where(op).file) ?? 1;
    const lineInEntry = entryLine(operations[0]);
    const via = (op: Operation) => where(op).file === file.path ? '' : ` (in ${where(op).file})`;

    let signal: string | undefined;
    if (limiterFile) signal = `rate limiter referenced in ${limiterFile.path}`;
    else if (importLimiter) signal = `imports ${importLimiter.name}`;
    else if (global) signal = `global limiter in ${global.path}; confirm it covers this route and keys by user or IP`;
    const quota = !signal && ops.has('ai') && quotaSignal.test(text);
    // Without a limiter, a quota covers AI cost only; SMS, email, and password checks stay open.
    const open = signal ? [] : operations.filter(op => !(op === 'ai' && quota));
    if (open.length) {
      // Built per operation, only for the operations this endpoint actually performs.
      const reason = (op: Operation) => ({
        ai: `calls an AI model${via(op)}; one account or script can spend your provider budget`,
        sms: `sends SMS${via(op)}; bots can trigger paid texts to premium numbers (SMS pumping)`,
        email: `sends email${via(op)}; it can be used to spam addresses and hurt your sending domain`,
        auth: `checks passwords or codes${via(op)}; unlimited attempts allow guessing and mass sign-ups`
      })[op];
      leads.push({ kind: 'endpoint-without-rate-limit', object, file: file.path, line: lineInEntry, operations: open, detail: `No rate limiter or per-user quota found in this ${kind} or the local modules it imports. It ${open.map(reason).join('; ')}. Confirm whether a gateway, platform rule, or provider setting limits it before reporting.` });
    }
    if (signal || quota) guarded.push({ object, file: file.path, operations: open.length ? operations.filter(op => !open.includes(op)) : operations, signal: signal ?? 'per-user quota or credit identifier found; confirm it is checked on the server before the AI call' });

    if (ops.has('ai')) {
      if (!outputCap.test(text)) leads.push({ kind: 'ai-output-not-capped', object, file: file.path, line: entryLine('ai'), operations: ['ai'], detail: `No max_tokens (or equivalent) found for the AI call${via('ai')}. A long or looping request can cost far more than a normal reply. Set an output cap on the server.` });
      const m = modelFromRequest.exec(text);
      if (m) {
        const owner = scope.find(s => modelFromRequest.test(s.text))!;
        leads.push({ kind: 'ai-model-from-request', object, file: owner.path, line: lineOf(owner.text, modelFromRequest.exec(owner.text)!.index), operations: ['ai'], detail: 'The model name appears to come from the request. A caller can pick the most expensive model. Choose the model on the server, or check it against an allowlist.' });
      }
    }
  }

  // Supabase phone sign-in sends paid SMS straight from Supabase Auth, without any app endpoint.
  for (const configPath of supabaseConfigs) {
    let config;
    try { config = readToml(await readFile(configPath, 'utf8')); } catch { continue; }
    const rel = relative(base, configPath).split(sep).join('/');
    const smsProviders = [...config].filter(([key, value]) => /^auth\.sms\.[^.]+\.enabled$/.test(key) && value === 'true').map(([key]) => key.split('.')[2]);
    const captcha = config.get('auth.captcha.enabled') === 'true';
    if (smsProviders.length && !captcha) {
      const limit = config.get('auth.rate_limit.sms_sent');
      leads.push({ kind: 'sms-sign-in-without-captcha', object: 'auth.sms', file: rel, line: 0, operations: ['sms'], detail: `Phone sign-in is enabled (${smsProviders.join(', ')}) without [auth.captcha]. Bots can request OTP texts to costly numbers.${limit ? ` Local sms_sent limit: ${limit} per hour.` : ''} Enable CAPTCHA, keep the hosted sms_sent limit low, and restrict SMS countries in the provider console.` });
    }
  }

  return {
    schemaVersion: 1, toolVersion: VERSION, project: basename(base),
    leads, leadCount: leads.length, guarded, entryPointsFound: entryPoints,
    filesScanned: Math.min(filesScanned, maxFiles), skippedLarge, truncated,
    limitations: [
      'A lead is a place to look. Limits set outside the code (API gateway, Vercel/Cloudflare firewall rules, Supabase Auth settings in the dashboard, provider spend caps) are invisible here.',
      '"guarded" means a limiter or quota name appears, not that it works. Check what it keys on (user ID or IP), its numbers, and that it runs before the costly call.',
      'Only JavaScript/TypeScript and Python server files are read. Local imports are followed one level, through relative paths and the @/ and ~/ aliases only.',
      'Entry points are recognized by common file layouts and route patterns. Unusual frameworks or routers may be missed; check by hand when entryPointsFound looks low.',
      'Whether an AI feature stays on topic cannot be checked statically. Use the abuse guide to review scope, quotas, and tool access.'
    ]
  };
}
