import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { startFixture, planFor, testEnv } from './fixture-server.mjs';
import { renderReport } from '../runner/report.ts';
import { VERSION } from '../runner/version.ts';

function node(args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', c => stdout += c); child.stderr.on('data', c => stderr += c);
    child.once('error', reject); child.once('close', code => resolvePromise({ code, stdout, stderr }));
  });
}

test('bundled runner and schemas match canonical source', async () => {
  const r = await node(['scripts/bundle.mjs', '--check']); assert.equal(r.code, 0, r.stderr);
});
test('copied skill runs independently of repository and writes sanitized reports', async t => {
  const root = await mkdtemp(join(tmpdir(), 'bal-package-')); t.after(() => rm(root, { recursive: true, force: true }));
  const skill = join(root, 'installed-skill'); await cp('skills/break-a-leg', skill, { recursive: true });
  const cli = join(skill, 'scripts', 'break-a-leg.mjs');
  const fixture = await startFixture('vulnerable'); t.after(fixture.close);
  const plan = join(root, 'plan.json'); await writeFile(plan, JSON.stringify(planFor(fixture.target)));
  const env = { ...process.env, ...testEnv };
  const discovery = await node([cli, 'discover', resolve('tests/fixtures/mobile/flutter')], { cwd: root });
  assert.equal(discovery.code, 0, discovery.stderr); assert.ok(JSON.parse(discovery.stdout).stacks.includes('flutter'));
  const validation = await node([cli, 'validate', plan], { cwd: root, env });
  assert.equal(validation.code, 0, validation.stderr); assert.equal(fixture.seen.length, 0);
  const out = join(root, 'run');
  const result = await node([cli, 'run', plan, '--out', out], { cwd: root, env });
  assert.equal(result.code, 1, result.stderr);
  const report = JSON.parse(await readFile(join(out, 'report.json'), 'utf8'));
  assert.equal(report.checks[0].findings.length, 2);
  const contents = JSON.stringify(report) + await readFile(join(out, 'report.md'), 'utf8') + result.stdout + result.stderr;
  for (const secret of Object.values(testEnv)) assert.ok(!contents.includes(secret));
  const before = fixture.seen.length;
  const overwrite = await node([cli, 'run', plan, '--out', out], { cwd: root, env });
  assert.equal(overwrite.code, 2); assert.equal(fixture.seen.length, before);
});
test('CLI blocked preflight writes a report and exits 2 without sending credentials', async t => {
  const root = await mkdtemp(join(tmpdir(), 'bal-cli-')); t.after(() => rm(root, { recursive: true, force: true }));
  const f = await startFixture('secure'); t.after(f.close);
  const plan = join(root, 'plan.json'); await writeFile(plan, JSON.stringify(planFor(f.target)));
  const r = await node(['runner/cli.ts', 'run', plan, '--out', join(root, 'run')], { env: {} });
  assert.equal(r.code, 2, r.stderr); assert.equal(f.seen.length, 0);
  const report = JSON.parse(await readFile(join(root, 'run/report.json'), 'utf8'));
  assert.equal(report.checks[0].status, 'blocked');
});
test('source-only report works with no staging target and preserves its evidence level', async () => {
  const report = JSON.parse(await readFile('examples/source-review.json', 'utf8'));
  const markdown = renderReport(report);
  assert.ok(markdown.includes('no runtime target'));
  assert.ok(markdown.includes('0 runtime reproduced; 1 source supported'));
  assert.ok(markdown.includes('source-supported'));
});
test('CLI returns exit 2 while retaining findings for a mixed-conclusion check', async t => {
  const root = await mkdtemp(join(tmpdir(), 'bal-incomplete-')); t.after(() => rm(root, { recursive: true, force: true }));
  const f = await startFixture(({ req, actor, send }) => {
    if (req.url === '/me') return false;
    send(200, actor === 'anonymous' ? { unknown: true } : { body: testEnv.BAL_FIXTURE_MARKER });
    return true;
  }); t.after(f.close);
  const plan = join(root, 'plan.json'); await writeFile(plan, JSON.stringify(planFor(f.target)));
  const r = await node(['runner/cli.ts', 'run', plan, '--out', join(root, 'run')], { env: { ...process.env, ...testEnv } });
  assert.equal(r.code, 2, r.stderr);
  const report = JSON.parse(await readFile(join(root, 'run/report.json'), 'utf8'));
  assert.equal(report.schemaVersion, 2);
  assert.equal(report.checks[0].complete, false);
  assert.equal(report.checks[0].findings.length, 1);
});
test('runtime, package, lockfile and installed CLI expose the same version', async () => {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
  assert.equal(VERSION, pkg.version); assert.equal(VERSION, lock.version);
  assert.equal(VERSION, lock.packages[''].version);
  const r = await node(['skills/break-a-leg/scripts/break-a-leg.mjs', '--version']);
  assert.equal(r.code, 0, r.stderr); assert.equal(r.stdout.trim(), VERSION);
});
test('bundler rejects stale generated files and removes them when rebuilding', async t => {
  const root = await mkdtemp(join(tmpdir(), 'bal-bundle-')); t.after(() => rm(root, { recursive: true, force: true }));
  for (const path of ['runner', 'schemas', 'skills', 'scripts', 'LICENSE']) await cp(path, join(root, path), { recursive: true });
  const obsolete = join(root, 'skills/break-a-leg/scripts/runner/obsolete.ts');
  await writeFile(obsolete, 'export const stale = true;');
  const check = await node(['scripts/bundle.mjs', '--check'], { cwd: root });
  assert.notEqual(check.code, 0); assert.match(check.stderr, /Obsolete generated file/);
  const rebuild = await node(['scripts/bundle.mjs'], { cwd: root }); assert.equal(rebuild.code, 0, rebuild.stderr);
  await assert.rejects(readFile(obsolete), { code: 'ENOENT' });
  assert.equal((await node(['scripts/bundle.mjs', '--check'], { cwd: root })).code, 0);
});
test('copied skill runs static helpers offline with lead-based exit codes', async t => {
  const root = await mkdtemp(join(tmpdir(), 'bal-static-cli-')); t.after(() => rm(root, { recursive: true, force: true }));
  const skill = join(root, 'skill'); await cp('skills/break-a-leg', skill, { recursive: true });
  const cli = join(skill, 'scripts', 'break-a-leg.mjs');
  const vulnerable = await node([cli, 'rls-audit', resolve('tests/fixtures/rls/vulnerable')], { cwd: root });
  assert.equal(vulnerable.code, 1, vulnerable.stderr); assert.ok(JSON.parse(vulnerable.stdout).leadCount > 0);
  const secure = await node([cli, 'rls-audit', resolve('tests/fixtures/rls/secure')], { cwd: root });
  assert.equal(secure.code, 0, secure.stderr);
  const secrets = await node([cli, 'secrets', resolve('tests/fixtures/rls/secure')], { cwd: root });
  assert.equal(secrets.code, 0, secrets.stderr); assert.equal(JSON.parse(secrets.stdout).hitCount, 0);
  const extra = await node([cli, 'secrets', root, 'extra'], { cwd: root });
  assert.equal(extra.code, 2);
});
