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
test('a private marker relocated within an unauthorized response is still a finding', async t => {
  // The other user's list contains their own row first and the owner's private row second,
  // so the marker is at /1/body rather than the configured pointer.
  const f = await fixture(t, ({ req, actor, send }) => {
    if (req.url === '/me') return false;
    if (actor === 'owner') send(200, { body: testEnv.BAL_FIXTURE_MARKER });
    else if (actor === 'other') send(200, [{ body: 'their own note' }, { body: testEnv.BAL_FIXTURE_MARKER }]);
    else send(401, { error: 'denied' });
    return true;
  });
  const r = await runPlan(planFor(f.target), { env: testEnv });
  assert.equal(r.checks[0].status, 'issue-found');
  assert.equal(r.checks[0].complete, true);
  assert.deepEqual(r.checks[0].findings.map(x => x.id), ['owner-note-other']);
});
test('deep marker search requires exact equality, not a substring', async t => {
  const f = await fixture(t, ({ req, actor, send }) => {
    if (req.url === '/me') return false;
    if (actor === 'owner') send(200, { body: testEnv.BAL_FIXTURE_MARKER });
    else send(200, { echo: `prefix-${testEnv.BAL_FIXTURE_MARKER}` });
    return true;
  });
  const r = await runPlan(planFor(f.target), { env: testEnv });
  assert.equal(r.checks[0].findings.length, 0);
  assert.equal(r.checks[0].status, 'blocked');
});
test('admin custom claims are rejected as privileged before any request', async t => {
  const f = await fixture(t, 'secure');
  for (const claims of [{ admin: true }, { role: 'admin' }, { is_admin: true }]) {
    const token = `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;
    const r = await runPlan(planFor(f.target), { env: { ...testEnv, BAL_OTHER_TOKEN: token } });
    assert.equal(r.requestsMade, 0);
    assert.match(r.checks[0].reason, /Privileged/);
  }
  assert.equal(f.seen.length, 0);
});
test('cookie sessions are sent as the named cookie and never as a bearer header', async t => {
  const cookieActor = req => {
    const cookie = req.headers.cookie ?? '';
    if (cookie === `session=${testEnv.BAL_OWNER_TOKEN}`) return 'owner';
    if (cookie === `session=${testEnv.BAL_OTHER_TOKEN}`) return 'other';
    return 'anonymous';
  };
  const headers = [];
  const f = await fixture(t, ({ req, send }) => {
    headers.push({ authorization: req.headers.authorization, cookie: req.headers.cookie });
    const actor = cookieActor(req);
    if (req.url === '/me') send(actor === 'anonymous' ? 401 : 200, { id: actor });
    else send(200, { body: testEnv.BAL_FIXTURE_MARKER }); // vulnerable: everyone reads the note
    return true;
  });
  const p = planFor(f.target); p.accounts.cookieName = 'session';
  const r = await runPlan(p, { env: testEnv });
  assert.equal(r.checks[0].status, 'issue-found');
  assert.equal(r.checks[0].findings.length, 2);
  assert.ok(headers.every(h => h.authorization === undefined));
  assert.equal(headers.filter(h => h.cookie).length, 4); // two identity checks, owner, other
});
test('cookie plans reject unsafe cookie names and separator characters in values', async t => {
  for (const name of ['bad name', 'a;b', 'x=y', '']) {
    const p = planFor('http://127.0.0.1:1234'); p.accounts.cookieName = name; assert.throws(() => parsePlan(p));
  }
  const f = await fixture(t, 'secure');
  const p = planFor(f.target); p.accounts.cookieName = 'session';
  const r = await runPlan(p, { env: { ...testEnv, BAL_OWNER_TOKEN: 'abc;injected=1' } });
  assert.equal(r.requestsMade, 0); assert.equal(f.seen.length, 0);
});
test('localhost reaches a server bound only to IPv6 loopback', async t => {
  const http = await import('node:http');
  const server = http.createServer((req, res) => {
    const auth = req.headers.authorization;
    const actor = auth === `Bearer ${testEnv.BAL_OWNER_TOKEN}` ? 'owner' : auth === `Bearer ${testEnv.BAL_OTHER_TOKEN}` ? 'other' : 'anonymous';
    res.writeHead(req.url === '/me' ? (actor === 'anonymous' ? 401 : 200) : actor === 'owner' ? 200 : 403, { 'content-type': 'application/json' });
    res.end(JSON.stringify(req.url === '/me' ? { id: actor } : actor === 'owner' ? { body: testEnv.BAL_FIXTURE_MARKER } : { error: 'denied' }));
  });
  try { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '::1', resolve); }); }
  catch { t.skip('IPv6 loopback is unavailable on this host'); return; }
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const r = await runPlan(planFor(`http://localhost:${server.address().port}`), { env: testEnv });
  assert.equal(r.checks[0].status, 'no-issue-observed');
});
test('report opens with a founder-facing launch priority that never hides incomplete checks', async t => {
  const leaky = await fixture(t, 'vulnerable');
  const md = renderReport(await runPlan(planFor(leaky.target), { env: testEnv }));
  assert.match(md, /## Launch priority\n\n\*\*Fix before launch\*\*\n\n- Private fixture readable by another user \(high, runtime-reproduced\)/);
  assert.ok(md.indexOf('## Launch priority') < md.indexOf('## Check coverage'));
  const blocked = await fixture(t, 'missing-fixture');
  const blockedMd = renderReport(await runPlan(planFor(blocked.target), { env: testEnv }));
  assert.match(blockedMd, /Nothing to fix from the checks that ran\.\n\n\*\*Not fully checked:\*\* owner-note\./);
});
