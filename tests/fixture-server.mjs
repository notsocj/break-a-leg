import http from 'node:http';

export const testEnv = {
  BAL_OWNER_TOKEN: 'fixture-only-owner-session',
  BAL_OTHER_TOKEN: 'fixture-only-other-session',
  BAL_FIXTURE_MARKER: 'fixture-private-marker-7e317d19',
  BAL_PUBLIC_API_KEY: 'fixture-publishable-key'
};
export function planFor(target, path = '/notes/owner-note') {
  return {
    version: 1, environment: 'local', target,
    scope: { authorized: true, isolatedTestData: true, readOnlyEndpoints: true },
    limits: { maxRequests: 5, timeoutMs: 1500, delayMs: 50, maxResponseBytes: 4096 },
    accounts: { ownerTokenEnv: 'BAL_OWNER_TOKEN', otherTokenEnv: 'BAL_OTHER_TOKEN' },
    identity: { path: '/me', subjectPointer: '/id' },
    probes: [{ id: 'owner-note', kind: 'authorization-read', path, markerPointer: '/body', markerEnv: 'BAL_FIXTURE_MARKER', privateFixture: true }]
  };
}
export async function startFixture(behavior = 'secure') {
  const seen = [];
  const server = http.createServer((req, res) => {
    const token = req.headers.authorization;
    const actor = token === `Bearer ${testEnv.BAL_OWNER_TOKEN}` ? 'owner' : token === `Bearer ${testEnv.BAL_OTHER_TOKEN}` ? 'other' : 'anonymous';
    seen.push({ path: req.url, actor, method: req.method, time: Date.now(), apikey: req.headers.apikey });
    const send = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (typeof behavior === 'function' && behavior({ req, res, actor, send, seen }) === true) return;
    if (req.url === '/me') {
      if (behavior === 'same-identity') return send(200, { id: 'same-user' });
      if (behavior === 'bad-identity') return send(401, { error: 'expired' });
      return send(actor === 'anonymous' ? 401 : 200, { id: actor === 'owner' ? 'user-a' : 'user-b' });
    }
    if (behavior === 'missing-fixture') return send(404, { error: 'missing' });
    if (behavior === 'redirect') { res.writeHead(302, { location: '/outside-scope' }); res.end(); return; }
    if (behavior === 'rate-limit') return send(429, { error: 'limited' });
    if (behavior === 'server-error') return send(503, { error: 'down' });
    if (behavior === 'oversize') return send(200, { padding: 'x'.repeat(9000) });
    if (behavior === 'timeout') return;
    const note = { id: 'owner-note', body: testEnv.BAL_FIXTURE_MARKER };
    if (actor === 'owner') return send(200, note);
    if (behavior === 'vulnerable') return send(200, note);
    if (behavior === 'leaky-denial') return send(403, note);
    if (behavior === 'ambiguous') return send(200, { different: true });
    if (behavior === 'empty-array') return send(200, []);
    return send(actor === 'anonymous' ? 401 : 403, { error: 'denied' });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return {
    target: `http://127.0.0.1:${server.address().port}`, seen,
    close: async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  };
}
