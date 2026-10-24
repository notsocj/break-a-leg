import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rlsAudit, splitSql, qualify } from '../runner/rls-audit.ts';
import { scanSecrets } from '../runner/secrets.ts';

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
    'public-storage-bucket:storage.buckets/documents',
    'security-definer-function:public.add_credits',
    'storage-policy-without-identity:storage.objects',
    'table-without-rls:public.drafts',
    'table-without-rls:public.notes',
    'view-bypasses-rls:public.note_titles'
  ]);
  const notes = r.projects[0].leads.find(l => l.object === 'public.notes');
  assert.equal(notes.line, 7);
  assert.match(notes.file, /20260101000000_init\.sql$/);
});
test('rls-audit secure counterpart has no leads (renames, drops, invoker views, revoked definers)', async () => {
  const r = await rlsAudit('tests/fixtures/rls/secure');
  assert.deepEqual(r.projects[0].leads, []);
  assert.equal(r.projects[0].tablesTracked, 2);
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
