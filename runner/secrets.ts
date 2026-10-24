import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { basename, extname, join, relative } from 'node:path';
import { ignoredDirectories } from './discover.ts';
import { VERSION } from './version.ts';

// Offline credential scan that NEVER outputs a matched value. It reports only where a likely
// credential is (file, line, column), what kind it looks like, and a hint about whether that
// file is likely to ship in the app. The agent then judges reachability without the value ever
// entering its context, which a plain `grep` would not guarantee.

export type SecretHit = {
  type: string;
  classification: 'privileged' | 'ambiguous';
  file: string;
  line: number;
  column: number;
  exposureHint: string;
};

// Each rule: a name, a pattern, and whether a match is clearly privileged or needs judgment.
const rules: Array<{ type: string; pattern: RegExp; classification: SecretHit['classification'] }> = [
  { type: 'supabase-secret-key', pattern: /\bsb_secret_[A-Za-z0-9_-]{20,}/g, classification: 'privileged' },
  { type: 'stripe-live-secret-key', pattern: /\b[rs]k_live_[A-Za-z0-9]{16,}/g, classification: 'privileged' },
  { type: 'stripe-test-secret-key', pattern: /\b[rs]k_test_[A-Za-z0-9]{16,}/g, classification: 'ambiguous' },
  { type: 'stripe-webhook-secret', pattern: /\bwhsec_[A-Za-z0-9]{20,}/g, classification: 'privileged' },
  // Anthropic before OpenAI: both start with "sk-".
  { type: 'anthropic-api-key', pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}/g, classification: 'privileged' },
  { type: 'openai-api-key', pattern: /\bsk-(?!ant-)(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{32,}/g, classification: 'privileged' },
  { type: 'aws-access-key-id', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, classification: 'privileged' },
  { type: 'private-key-block', pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g, classification: 'privileged' },
  { type: 'github-token', pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{50,})\b/g, classification: 'privileged' },
  { type: 'slack-token', pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g, classification: 'privileged' },
  { type: 'sendgrid-api-key', pattern: /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/g, classification: 'privileged' },
  { type: 'mapbox-secret-token', pattern: /\bsk\.eyJ[A-Za-z0-9_-]{20,}/g, classification: 'privileged' },
  { type: 'fcm-legacy-server-key', pattern: /\bAAAA[A-Za-z0-9_-]{7}:APA91b[A-Za-z0-9_-]{100,}/g, classification: 'privileged' },
  // RevenueCat secret keys and similar "sk_" keys that are not Stripe live/test keys.
  { type: 'sk-prefixed-secret-key', pattern: /\bsk_(?!live_|test_)[A-Za-z0-9]{28,}\b/g, classification: 'ambiguous' }
];
const jwtPattern = /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;
const googleKeyPattern = /\bAIza[0-9A-Za-z_-]{35}\b/g;
// `NAME_SECRET=value` style assignments in env/config files. Values that look like
// placeholders ("your-key-here", "<...>", "xxx") are skipped.
const namedSecretPattern = /\b([A-Z0-9_]*(?:SERVICE_ROLE|SECRET|PRIVATE_KEY|API_SECRET)[A-Z0-9_]*)\s*[=:]\s*["']?([^\s"'#]{12,})/g;
const placeholder = /your|example|changeme|placeholder|xxx|<|\.\.\.|\$\{|process\.env|env\(/i;
// Variable prefixes that frameworks inline into client bundles at build time.
const publicPrefix = /\b(EXPO_PUBLIC_|NEXT_PUBLIC_|VITE_|REACT_APP_|NUXT_PUBLIC_|GATSBY_|PUBLIC_)[A-Z0-9_]*/;
const skippedFiles = new Set(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'pubspec.lock', 'Podfile.lock', 'Cargo.lock', 'go.sum', 'composer.lock', 'Gemfile.lock', 'bun.lockb']);
const mobileExtensions = new Set(['.dart', '.swift', '.kt', '.kts', '.java', '.m', '.mm', '.plist', '.xml', '.xcconfig', '.gradle']);

// A rough, path-based guess at whether a file ships in the app. The agent must confirm it.
function exposureHint(path: string, lineText: string): string {
  if (publicPrefix.test(lineText)) return 'client-bundled-variable';
  const name = basename(path);
  if (/(^|\/)(test|tests|__tests__|fixtures?|examples?|mocks?|spec)\//i.test(path) || /\.(test|spec)\./.test(name)) return 'test-or-example-path';
  if (name.startsWith('.env')) return 'env-file';
  if (['app.json', 'app.config.js', 'app.config.ts', 'eas.json', 'google-services.json', 'GoogleService-Info.plist', 'Info.plist'].includes(name) || mobileExtensions.has(extname(name)) || /(^|\/)(assets|ios|android|lib)\//.test(path)) return 'mobile-source-or-config';
  if (/(^|\/)(supabase\/functions|functions|server|api|backend)\//.test(path)) return 'server-source';
  return 'other';
}

// Decode a JWT's payload claims (no signature check) to tell public from privileged tokens.
function jwtRole(token: string): string | undefined {
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).role; } catch { return undefined; }
}

export async function scanSecrets(root: string, maxFiles = 20000) {
  const base = await realpath(root);
  if (!(await stat(base)).isDirectory()) throw new Error('Project root must be a directory');
  const hits: SecretHit[] = [];
  let ignoredPublicKeys = 0; // Supabase anon/publishable JWTs and Firebase-style Google keys
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
      // Hidden directories are skipped, but hidden files such as .env are scanned on purpose.
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name) && !entry.name.startsWith('.')) queue.push(absolute);
        continue;
      }
      if (!entry.isFile() || skippedFiles.has(entry.name)) continue;
      if (++filesScanned > maxFiles) { truncated = true; break; }
      const size = (await stat(absolute)).size;
      if (size > 1024 * 1024) { skippedLarge++; continue; }
      const buffer = await readFile(absolute);
      if (buffer.subarray(0, 8192).includes(0)) continue; // binary file
      const path = relative(base, absolute).split('\\').join('/');
      const lines = buffer.toString('utf8').split('\n');
      for (const [index, lineText] of lines.entries()) {
        if (lineText.length > 20000) continue; // minified bundles: too noisy to attribute
        const record = (type: string, classification: SecretHit['classification'], column: number) => {
          if (hits.length < 1000) hits.push({ type, classification, file: path, line: index + 1, column: column + 1, exposureHint: exposureHint(path, lineText) });
        };
        const covered: Array<[number, number]> = []; // spans already reported on this line
        for (const rule of rules) {
          for (const m of lineText.matchAll(rule.pattern)) { record(rule.type, rule.classification, m.index!); covered.push([m.index!, m.index! + m[0].length]); }
        }
        for (const m of lineText.matchAll(jwtPattern)) {
          const role = jwtRole(m[0]);
          if (role === 'service_role' || role === 'supabase_admin') record('supabase-service-role-key', 'privileged', m.index!);
          else if (role === 'anon' || role === 'authenticated') ignoredPublicKeys++; // expected in clients
          covered.push([m.index!, m.index! + m[0].length]);
        }
        for (const m of lineText.matchAll(googleKeyPattern)) {
          // Firebase client config keys are public identifiers; Gemini keys are not.
          if (/gemini|generativelanguage|genai|generative|vertex/i.test(lineText)) record('google-ai-api-key', 'ambiguous', m.index!);
          else ignoredPublicKeys++;
          covered.push([m.index!, m.index! + m[0].length]);
        }
        if (/^\.env|\.(env|toml|ya?ml|json|properties|xcconfig)$/i.test(basename(path)) || basename(path).startsWith('.env')) {
          for (const m of lineText.matchAll(namedSecretPattern)) {
            const valueAt = m.index! + m[0].lastIndexOf(m[2]);
            const already = covered.some(([start, end]) => valueAt >= start && valueAt < end);
            if (!already && !placeholder.test(m[2])) record('named-secret-assignment', 'ambiguous', m.index!);
          }
        }
      }
    }
  }
  return {
    schemaVersion: 1, toolVersion: VERSION, project: basename(base),
    hits, hitCount: hits.length, ignoredPublicKeys, filesScanned: Math.min(filesScanned, maxFiles), skippedLarge, truncated,
    limitations: [
      'Matched values are never printed. Open the reported line only if needed, and do not copy the value into chat or reports.',
      'exposureHint is a path-based guess. Confirm whether the file is committed, bundled into a release build, or server-only before reporting exposure.',
      'Pattern matching misses unrecognized credential formats and can match revoked, test, or fake values. Validity is unknown; never test a suspected key against its provider.',
      'Supabase anon/publishable keys and Firebase client config keys are public by design and only counted, not reported.',
      'Hidden directories, dependency/build folders, lockfiles, binaries, and files over 1 MiB are skipped. Git history is not scanned.'
    ]
  };
}
