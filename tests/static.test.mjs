import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rlsAudit, splitSql, qualify } from '../runner/rls-audit.ts';
import { scanSecrets } from '../runner/secrets.ts';
import { limitsAudit } from '../runner/limits.ts';
import { spawnSync } from 'node:child_process';

// ---------- rls-audit ----------

test('SQL splitter ignores semicolons in comments, strings, and dollar-quoted bodies', () => {
  const statements = splitSql("-- a; b\ncreate table t (x text default 'a;b');\n/* c; */ create function f() returns void as $$ begin; end; $$;\nselect 1");
  assert.equal(statements.length, 3);
  assert.equal(statements[0].line, 2);
  assert.equal(statements[1].line, 3);
  assert.match(statements[1].text, /begin; end;/);
});
test('identifiers default to the public schema and drop quotes', () => {
  assert.equal(qualify('"Public"."Notes"'), 'public.notes');
  assert.equal(qualify('notes'), 'public.notes');
});
test('rls-audit replays migrations and reports each vulnerable pattern', async () => {
  const r = await rlsAudit('tests/fixtures/rls/vulnerable');
  assert.equal(r.projects.length, 1);
  const kinds = r.projects[0].leads.map(l => `${l.kind}:${l.object}`).sort();
  assert.deepEqual(kinds, [
    'anonymous-sign-ins-enabled:auth',
    'email-confirmation-disabled:auth.email',
    'function-jwt-verification-disabled:functions.ai-chat',
    'policy-allows-all-rows:public.profiles',
    'policy-allows-any-signed-in-user:public.teams',
    'policy-uses-user-metadata:public.teams',
    'public-storage-bucket:storage.buckets/documents',
    'security-definer-function:public.add_credits',
    'storage-policy-without-identity:storage.objects',
    'storage-policy-without-identity:storage.objects',
    'table-without-rls:public.drafts',
    'table-without-rls:public.notes',
    'user-writable-privileged-columns:public.profiles',
    'view-bypasses-rls:public.note_titles'
  ]);
  const notes = r.projects[0].leads.find(l => l.object === 'public.notes');
  assert.equal(notes.line, 7);
  assert.match(notes.file, /20260101000000_init\.sql$/);
  const columns = r.projects[0].leads.find(l => l.kind === 'user-writable-privileged-columns');
  assert.match(columns.detail, /is_pro/);
  assert.doesNotMatch(columns.detail, /display_name/);
});
test('rls-audit secure counterpart has no leads (renames, drops, invoker views, revoked definers, column grants, admin gates, membership helpers)', async () => {
  const r = await rlsAudit('tests/fixtures/rls/secure');
  assert.deepEqual(r.projects[0].leads, []);
  assert.equal(r.projects[0].tablesTracked, 4);
});
test('rls-audit flags the eval fixture\'s self-service credits without a column restriction', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'bal-rls-')); t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'supabase', 'migrations'), { recursive: true });
  await writeFile(join(dir, 'supabase', 'migrations', '1.sql'), [
    'create table public.profiles (id uuid primary key references auth.users, display_name text, "isPro" boolean, coach_credits int default 3, check (coach_credits >= 0));',
    'alter table public.profiles enable row level security;',
    'create policy "own profile update" on public.profiles for update using (auth.uid() = id);',
    'create policy "staff only" on public.profiles for update to service_role using (true);'
  ].join('\n'));
  const lead = (await rlsAudit(dir)).projects[0].leads.find(l => l.kind === 'user-writable-privileged-columns');
  assert.equal(lead.line, 3);
  assert.match(lead.detail, /to public .*isPro, coach_credits/);
});
test('rls-audit honors custom exposed schemas and finds nested supabase folders', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'bal-rls-')); t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'apps', 'api', 'supabase', 'migrations'), { recursive: true });
  await writeFile(join(dir, 'apps', 'api', 'supabase', 'config.toml'), '[api]\nschemas = ["public", "api"]\n');
  await writeFile(join(dir, 'apps', 'api', 'supabase', 'migrations', '1.sql'), 'create table api.orders (id int);\ncreate table private.audit (id int);\n');
  const r = await rlsAudit(dir);
  assert.equal(r.projects[0].path, 'apps/api/supabase');
  assert.deepEqual(r.projects[0].leads.map(l => l.object), ['api.orders']);
});

// ---------- secrets ----------
// Credential-shaped strings are assembled at runtime so this repository never contains
// anything that looks like a real key (and push protection is never triggered).

const fake = {
  stripe: ['sk', 'live', 'A1b2C3d4E5f6G7h8I9j0K1l2'].join('_'),
  openai: ['sk', 'proj', 'Z'.repeat(40)].join('-'),
  service: ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url'), 'c2lnbmF0dXJlc2lnbmF0dXJl'].join('.'),
  anon: ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url'), 'c2lnbmF0dXJlc2lnbmF0dXJl'].join('.'),
  firebase: 'AIza' + 'S'.repeat(35),
  named: 'q8F2kLm9Xz3Rt7Vw1Yp6'
};

test('secrets reports type and location without ever printing values', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'bal-secrets-')); t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'app')); await mkdir(join(dir, 'server'));
  await writeFile(join(dir, '.env'), `EXPO_PUBLIC_OPENAI_KEY=${fake.openai}\nSUPABASE_SERVICE_ROLE_KEY=${fake.service}\nWEBHOOK_SECRET=${fake.named}\nAPI_SECRET=your-secret-here\n`);
  await writeFile(join(dir, 'app', 'supabase.ts'), `export const anonKey = '${fake.anon}';\nconst firebaseConfig = { apiKey: '${fake.firebase}' };\n`);
  await writeFile(join(dir, 'server', 'billing.ts'), `// stripe\nconst stripe = new Stripe('${fake.stripe}');\n`);
  const r = await scanSecrets(dir);
  const summary = r.hits.map(h => `${h.type}@${h.file}:${h.line}:${h.exposureHint}`).sort();
  assert.deepEqual(summary, [
    'named-secret-assignment@.env:3:env-file',
    'openai-api-key@.env:1:client-bundled-variable',
    'stripe-live-secret-key@server/billing.ts:2:server-source',
    'supabase-service-role-key@.env:2:env-file'
  ]);
  assert.equal(r.ignoredPublicKeys, 2); // anon JWT and Firebase client key
  const output = JSON.stringify(r);
  for (const value of Object.values(fake)) assert.ok(!output.includes(value), 'secret value leaked into output');
});
test('secrets skips dependency folders, lockfiles, and binaries', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'bal-secrets-skip-')); t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'node_modules', 'pkg'), { recursive: true });
  await writeFile(join(dir, 'node_modules', 'pkg', 'index.js'), fake.stripe);
  await writeFile(join(dir, 'package-lock.json'), fake.stripe);
  await writeFile(join(dir, 'image.bin'), Buffer.concat([Buffer.from([0, 1, 2]), Buffer.from(fake.stripe)]));
  const r = await scanSecrets(dir);
  assert.equal(r.hitCount, 0);
});

// ---------- limits ----------

test('limits reports abusable endpoints without a rate limit, plus AI cap/model and SMS CAPTCHA leads', async () => {
  const r = await limitsAudit('tests/fixtures/limits/vulnerable');
  const summary = r.leads.map(l => `${l.kind}:${l.object}:${l.operations.join('+')}`).sort();
  assert.deepEqual(summary, [
    'ai-model-from-request:/api/chat:ai',
    'ai-model-from-request:backend/main.py:ai',
    'ai-output-not-capped:/api/chat:ai',
    'ai-output-not-capped:backend/main.py:ai',
    'endpoint-without-rate-limit:/api/chat:ai',
    'endpoint-without-rate-limit:/api/invite:email',
    'endpoint-without-rate-limit:/api/summarize:ai',
    'endpoint-without-rate-limit:/login:auth',
    'endpoint-without-rate-limit:backend/main.py:ai',
    'endpoint-without-rate-limit:functions/coach:ai',
    'endpoint-without-rate-limit:server/index.js:sms',
    'sms-sign-in-without-captcha:auth.sms:sms'
  ]);
  // The AI call lives in a helper: the lead points at the helper's import line and names the helper.
  const chat = r.leads.find(l => l.kind === 'endpoint-without-rate-limit' && l.object === '/api/chat');
  assert.equal(chat.line, 2);
  assert.match(chat.detail, /web\/lib\/ai\.ts/);
  assert.match(r.leads.find(l => l.kind === 'sms-sign-in-without-captcha').detail, /500 per hour/);
  // Test files and mobile client code are not entry points.
  assert.ok(!r.leads.some(l => /route\.test|mobile\//.test(l.file)));
});
test('limits secure counterpart: limiters, quotas, CAPTCHA, and signed webhooks produce no leads', async () => {
  const r = await limitsAudit('tests/fixtures/limits/secure');
  assert.deepEqual(r.leads, []);
  assert.deepEqual(r.guarded.map(g => g.object).sort(), ['/api/chat', '/api/coach', '/api/invite', '/login', 'backend/main.py', 'server/index.js']);
  assert.match(r.guarded.find(g => g.object === '/api/coach').signal, /quota/);
});
test('limits ignores limiter words in comments and a quota does not cover SMS, but a global middleware limiter does', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'bal-limits-')); t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'a', 'app', 'api', 'otp'), { recursive: true });
  await writeFile(join(dir, 'a', 'package.json'), '{}');
  await writeFile(join(dir, 'a', 'app', 'api', 'otp', 'route.ts'), "import twilio from 'twilio';\n// rateLimit is handled later\nconst credits = 3;\nexport async function POST() { await twilio().messages.create({}); }\n");
  await mkdir(join(dir, 'b', 'app', 'api', 'otp'), { recursive: true });
  await writeFile(join(dir, 'b', 'package.json'), '{}');
  await writeFile(join(dir, 'b', 'app', 'api', 'otp', 'route.ts'), "import twilio from 'twilio';\nexport async function POST() { await twilio().messages.create({}); }\n");
  await writeFile(join(dir, 'b', 'middleware.ts'), "import { Ratelimit } from '@upstash/ratelimit';\nexport async function middleware() {}\n");
  const r = await limitsAudit(dir);
  assert.deepEqual(r.leads.map(l => l.file), ['a/app/api/otp/route.ts']);
  assert.match(r.guarded[0].signal, /global limiter in b\/middleware\.ts/);
});
test('limits CLI exits 1 with leads and 0 without', () => {
  const run = path => spawnSync(process.execPath, ['skills/break-a-leg/scripts/break-a-leg.mjs', 'limits', path], { encoding: 'utf8' });
  assert.equal(run('tests/fixtures/limits/vulnerable').status, 1);
  assert.equal(run('tests/fixtures/limits/secure').status, 0);
});
test('limits recognizes AI and email calls by call shape when the client comes from an unfollowed module', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'bal-limits-shape-')); t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'app', 'api', 'chef'), { recursive: true });
  await writeFile(join(dir, 'app', 'api', 'chef', 'route.ts'), "import { clients } from 'internal-sdk';\nexport async function POST(req: Request) {\n  const r = await clients.openai.chat.completions.create({ model: 'x', messages: [] });\n  await clients.resend.emails.send({ to: 'a@example.com' });\n  return Response.json(r);\n}\n");
  const r = await limitsAudit(dir);
  const lead = r.leads.find(l => l.kind === 'endpoint-without-rate-limit');
  assert.deepEqual(lead.operations, ['ai', 'email']);
  assert.equal(lead.line, 3);
  assert.ok(r.leads.some(l => l.kind === 'ai-output-not-capped'));
});
test('limits treats promo-code routes as guessable checks and catches a destructured request model', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'bal-limits-redeem-')); t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'app', 'api', 'redeem'), { recursive: true });
  await mkdir(join(dir, 'app', 'api', 'chat'), { recursive: true });
  await writeFile(join(dir, 'app', 'api', 'redeem', 'route.ts'), "export async function POST(req: Request) {\n  const { code } = await req.json();\n  return Response.json({ ok: code === '123456' });\n}\n");
  await writeFile(join(dir, 'app', 'api', 'chat', 'route.ts'), "import OpenAI from 'openai';\nconst openai = new OpenAI();\nexport async function POST(req: Request) {\n  const { messages, model } = await req.json();\n  return Response.json(await openai.chat.completions.create({ model: model ?? 'small', max_tokens: 200, messages }));\n}\n");
  const r = await limitsAudit(dir);
  assert.ok(r.leads.some(l => l.kind === 'endpoint-without-rate-limit' && l.object === '/api/redeem' && l.operations.includes('auth')));
  const model = r.leads.find(l => l.kind === 'ai-model-from-request');
  assert.equal(model.object, '/api/chat');
  assert.equal(model.line, 4);
});
