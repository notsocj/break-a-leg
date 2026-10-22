import test from 'node:test';
import assert from 'node:assert/strict';
import { runPlan } from '../runner/run.ts';
import { renderReport } from '../runner/report.ts';
import { parsePlan, atPointer } from '../runner/plan.ts';
import { ScopedTransport } from '../runner/transport.ts';
import { planFor, startFixture, testEnv } from './fixture-server.mjs';

async function fixture(t, behavior) { const f = await startFixture(behavior); t.after(f.close); return f; }

test('reproduces cross-user and anonymous leaks with distinct identity preflight', async t => {
  const f = await fixture(t, 'vulnerable');
  const r = await runPlan(planFor(f.target), { env: testEnv });
  assert.equal(r.checks[0].status, 'issue-found');
  assert.equal(r.checks[0].complete, true);
  assert.equal(r.checks[0].findings.length, 2);
  assert.equal(r.requestsMade, 5);
  assert.deepEqual(f.seen.map(x => x.actor), ['owner', 'other', 'owner', 'other', 'anonymous']);
  assert.ok(f.seen.every(x => x.method === 'GET'));
  for (const value of Object.values(testEnv)) { assert.ok(!JSON.stringify(r).includes(value)); assert.ok(!renderReport(r).includes(value)); }
});
test('secure counterpart denies both unauthorized identities', async t => {
  const f = await fixture(t, 'secure');
  const r = await runPlan(planFor(f.target), { env: testEnv });
  assert.equal(r.checks[0].status, 'no-issue-observed');
  assert.equal(r.checks[0].findings.length, 0);
});
test('local hostname uses loopback without external DNS', async t => {
  const f = await fixture(t, 'secure');
  const r = await runPlan(planFor(f.target.replace('127.0.0.1', 'localhost')), { env: testEnv });
  assert.equal(r.checks[0].status, 'no-issue-observed');
});
test('leaked private marker is a finding even in a denial response', async t => {
  const f = await fixture(t, 'leaky-denial');
  assert.equal((await runPlan(planFor(f.target), { env: testEnv })).checks[0].findings.length, 2);
});
test('empty REST collection is a narrow denial observation after owner success', async t => {
  const f = await fixture(t, 'empty-array');
  assert.equal((await runPlan(planFor(f.target), { env: testEnv })).checks[0].status, 'no-issue-observed');
});
for (const behavior of ['same-identity', 'bad-identity', 'missing-fixture', 'ambiguous', 'redirect', 'rate-limit', 'server-error', 'oversize', 'timeout']) {
  test(`${behavior} blocks coverage instead of passing`, async t => {
    const f = await fixture(t, behavior);
    const p = planFor(f.target); p.limits.timeoutMs = 150;
    const r = await runPlan(p, { env: testEnv });
    assert.equal(r.checks[0].status, 'blocked');
    assert.equal(r.checks[0].complete, false);
    assert.equal(r.checks[0].findings.length, 0);
    if (['same-identity', 'bad-identity'].includes(behavior)) assert.equal(f.seen.length, 2);
    if (['redirect', 'rate-limit', 'server-error', 'oversize', 'timeout'].includes(behavior)) assert.equal(f.seen.length, 3);
  });
}
test('cross-origin redirects cannot receive credentials', async t => {
  const destination = await fixture(t, 'vulnerable');
  const f = await fixture(t, ({ req, res }) => {
    if (req.url !== '/me') { res.writeHead(302, { location: destination.target }); res.end(); return true; }
  });
  const r = await runPlan(planFor(f.target), { env: testEnv });
  assert.equal(r.checks[0].status, 'blocked');
  assert.equal(destination.seen.length, 0);
});
test('early finding survives a subsequent transport failure', async t => {
  const f = await fixture(t, ({ req, actor, send }) => {
    if (req.url === '/me') return false;
    if (actor === 'anonymous') send(429, { error: 'limited' });
    else send(200, { body: testEnv.BAL_FIXTURE_MARKER });
    return true;
  });
  const r = await runPlan(planFor(f.target), { env: testEnv });
  assert.equal(r.checks[0].status, 'issue-found'); assert.equal(r.checks[0].findings.length, 1);
  assert.equal(r.checks[0].observations.length, 2);
  assert.equal(r.checks[0].complete, false);
});
test('transport stop prevents subsequent probes and never retries', async t => {
  const f = await fixture(t, 'rate-limit');
  const p = planFor(f.target); p.probes.push({ ...p.probes[0], id: 'second' }); p.limits.maxRequests = 8;
  const r = await runPlan(p, { env: testEnv });
  assert.equal(r.requestsMade, 3); assert.equal(f.seen.length, 3);
  assert.ok(r.checks.every(c => c.status === 'blocked'));
});
test('missing, identical, and privileged credentials block before any request', async t => {
  const f = await fixture(t, 'secure');
  const serviceToken = `header.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`;
  for (const env of [{}, { ...testEnv, BAL_OTHER_TOKEN: testEnv.BAL_OWNER_TOKEN }, { ...testEnv, BAL_OWNER_TOKEN: 'sb_secret_test-not-a-key' }, { ...testEnv, BAL_OWNER_TOKEN: serviceToken }]) {
    const r = await runPlan(planFor(f.target), { env }); assert.equal(r.requestsMade, 0); assert.equal(r.checks[0].status, 'blocked');
  }
  assert.equal(f.seen.length, 0);
});
test('public key passes through anonymous requests but a secret key is rejected', async t => {
  const f = await fixture(t, 'secure'); const p = planFor(f.target); p.publicApiKeyEnv = 'BAL_PUBLIC_API_KEY';
  assert.equal((await runPlan(p, { env: testEnv })).checks[0].status, 'no-issue-observed');
  assert.ok(f.seen.every(x => x.apikey === testEnv.BAL_PUBLIC_API_KEY));
  const r = await runPlan(p, { env: { ...testEnv, BAL_PUBLIC_API_KEY: 'sb_secret_fake' } }); assert.equal(r.requestsMade, 0);
});
test('transport enforces budget and sequential minimum delay', async t => {
  const f = await fixture(t, 'secure'); const p = parsePlan(planFor(f.target));
  const transport = new ScopedTransport(p);
  for (let i = 0; i < 5; i++) await transport.get('/me', testEnv.BAL_OWNER_TOKEN);
  await assert.rejects(transport.get('/me'), /budget/);
  assert.equal(f.seen.length, 5);
  for (let i = 1; i < f.seen.length; i++) assert.ok(f.seen[i].time - f.seen[i - 1].time >= 40);
});
test('plan rejects unsafe environments, escaping paths, insufficient scope and unsupported options', () => {
  const changes = [
    p => p.environment = 'production', p => p.target = 'http://example.com',
    p => { p.environment = 'staging'; p.target = 'http://staging.example.com'; },
    p => p.target = 'http://user:password@127.0.0.1', p => p.target = 'http://127.0.0.1/base',
    p => p.probes[0].path = '//example.com/', p => p.probes[0].path = '/\\example.com/',
    p => p.probes[0].path = '/notes#fragment', p => p.probes[0].path = '/notes\r\nX-Test: bad',
    p => p.scope.authorized = false, p => p.scope.readOnlyEndpoints = false,
    p => p.probes[0].privateFixture = false, p => p.accounts.ownerTokenEnv = 'BAD-NAME',
    p => p.limits.maxRequests = 4, p => p.limits.delayMs = 0,
    p => p.probes[0].method = 'POST', p => p.identity.subjectPointer = '/bad~2pointer',
    p => { p.probes.push({ ...p.probes[0] }); p.limits.maxRequests = 8; }
  ];
  for (const change of changes) { const p = planFor('http://127.0.0.1:1234'); change(p); assert.throws(() => parsePlan(p)); }
  const staging = planFor('https://staging.example.invalid'); staging.environment = 'staging'; assert.equal(parsePlan(staging).environment, 'staging');
});
test('JSON pointers handle arrays and escaping, without prototype traversal', () => {
  assert.equal(atPointer([{ 'a/b': { '~': 'ok' } }], '/0/a~1b/~0'), 'ok');
  assert.equal(atPointer({}, '/toString'), undefined);
});
test('compressed and aborted responses terminate as blocked checks', async t => {
  for (const behavior of ['compressed', 'aborted']) {
    const f = await fixture(t, ({ req, res }) => {
      if (req.url === '/me') return false;
      if (behavior === 'compressed') { res.writeHead(200, { 'content-encoding': 'gzip' }); res.end('not-supported'); }
      else { res.writeHead(200, { 'content-type': 'application/json', 'content-length': 1000 }); res.write('{'); setImmediate(() => res.destroy()); }
      return true;
    });
    const r = await runPlan(planFor(f.target), { env: testEnv }); assert.equal(r.checks[0].status, 'blocked');
  }
});
test('a slow trickle cannot extend the absolute deadline', async t => {
  const f = await fixture(t, ({ req, res }) => {
    if (req.url === '/me') return false;
    res.writeHead(200); res.write('{');
    const timer = setInterval(() => res.write(' '), 10); res.on('close', () => clearInterval(timer)); return true;
  });
  const p = planFor(f.target); p.limits.timeoutMs = 100;
  const r = await runPlan(p, { env: testEnv });
  assert.equal(r.checks[0].status, 'blocked'); assert.match(r.checks[0].reason, /deadline/);
});
test('concurrent calls are refused without a second request', async t => {
  const f = await fixture(t, 'secure'); const transport = new ScopedTransport(parsePlan(planFor(f.target)));
  const first = transport.get('/me', testEnv.BAL_OWNER_TOKEN);
  await assert.rejects(transport.get('/me', testEnv.BAL_OTHER_TOKEN), /Concurrent/);
  await first; assert.equal(f.seen.length, 1);
});
test('a confirmed leak does not hide another actor\'s inconclusive response', async t => {
  const f = await fixture(t, ({ req, actor, send }) => {
    if (req.url === '/me') return false;
    send(200, actor === 'anonymous' ? { unrecognized: true } : { body: testEnv.BAL_FIXTURE_MARKER });
    return true;
  });
  const r = await runPlan(planFor(f.target), { env: testEnv });
  assert.equal(r.checks[0].status, 'issue-found');
  assert.equal(r.checks[0].findings.length, 1);
  assert.equal(r.checks[0].observations.length, 3);
  assert.equal(r.checks[0].complete, false);
  assert.match(renderReport(r), /Incomplete checks: 1/);
});
