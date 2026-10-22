import type { Plan } from './types.ts';

function fail(message: string): never { throw new Error(message); }
function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: string[], label: string) {
  if (Object.keys(value).some(k => !allowed.includes(k))) fail(`${label} contains an unsupported field`);
}
function integer(value: unknown, min: number, max: number, label: string) {
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) fail(`${label} is outside its allowed range`);
}
function envName(value: unknown) {
  if (typeof value !== 'string' || !/^[A-Z][A-Z0-9_]{0,99}$/.test(value)) fail('Invalid environment variable reference');
}
function pointer(value: unknown) {
  if (typeof value !== 'string' || value.length > 256 || !value.startsWith('/') || /~(?![01])/.test(value)) fail('Invalid JSON pointer');
}
export function resolvePath(target: string, path: unknown): URL {
  if (typeof path !== 'string' || path.length > 2048 || !path.startsWith('/') || path.startsWith('//') || /[\\\s#\x00-\x1f\x7f]/.test(path)) fail('Request path must be a relative absolute-path without fragments or whitespace');
  const result = new URL(path, target);
  if (result.origin !== new URL(target).origin || result.username || result.password) fail('Request path leaves the scoped origin');
  return result;
}
export function parsePlan(value: unknown): Plan {
  const p = object(value, 'Plan');
  keys(p, ['version', 'environment', 'target', 'scope', 'limits', 'accounts', 'publicApiKeyEnv', 'identity', 'probes'], 'Plan');
  if (p.version !== 1) fail('Only plan version 1 is supported');
  if (p.environment !== 'local' && p.environment !== 'staging') fail('Active runs require local or staging mode; production is unsupported');
  if (typeof p.target !== 'string') fail('target must be an origin');
  let url: URL;
  try { url = new URL(p.target); } catch { fail('target must be a valid origin'); }
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || !['http:', 'https:'].includes(url.protocol)) fail('target must contain only an HTTP(S) origin');
  const loopback = ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname);
  if (p.environment === 'local' && !loopback) fail('Local mode requires 127.0.0.1, ::1, or localhost');
  if (p.environment === 'staging' && (loopback || url.protocol !== 'https:')) fail('Staging mode requires an HTTPS origin outside loopback');
  const scope = object(p.scope, 'scope');
  keys(scope, ['authorized', 'isolatedTestData', 'readOnlyEndpoints'], 'scope');
  if (scope.authorized !== true || scope.isolatedTestData !== true || scope.readOnlyEndpoints !== true) fail('Active scope must explicitly confirm authorization, isolated test data, and read-only endpoint semantics');
  const limits = object(p.limits, 'limits');
  keys(limits, ['maxRequests', 'timeoutMs', 'delayMs', 'maxResponseBytes'], 'limits');
  integer(limits.maxRequests, 2, 100, 'maxRequests');
  integer(limits.timeoutMs, 100, 15000, 'timeoutMs');
  integer(limits.delayMs, 50, 5000, 'delayMs');
  integer(limits.maxResponseBytes, 1024, 1048576, 'maxResponseBytes');
  const accounts = object(p.accounts, 'accounts');
  keys(accounts, ['ownerTokenEnv', 'otherTokenEnv'], 'accounts');
  envName(accounts.ownerTokenEnv); envName(accounts.otherTokenEnv);
  if (accounts.ownerTokenEnv === accounts.otherTokenEnv) fail('Two distinct test-account token references are required');
  if (p.publicApiKeyEnv !== undefined) envName(p.publicApiKeyEnv);
  const identity = object(p.identity, 'identity');
  keys(identity, ['path', 'subjectPointer'], 'identity');
  resolvePath(url.origin, identity.path); pointer(identity.subjectPointer);
  if (!Array.isArray(p.probes) || p.probes.length < 1 || p.probes.length > 25) fail('Specify 1–25 probes');
  const ids = new Set();
  for (const raw of p.probes) {
    const probe = object(raw, 'probe');
    keys(probe, ['id', 'kind', 'path', 'markerPointer', 'markerEnv', 'privateFixture'], 'probe');
    if (typeof probe.id !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(probe.id) || ids.has(probe.id)) fail('Probe IDs must be unique lowercase identifiers');
    ids.add(probe.id);
    if (probe.kind !== 'authorization-read' || probe.privateFixture !== true) fail('V1 supports authorization-read probes of private synthetic fixtures');
    resolvePath(url.origin, probe.path); pointer(probe.markerPointer); envName(probe.markerEnv);
  }
  // Reject an undersized budget before sending anything, rather than silently skipping probes.
  if (Number(limits.maxRequests) < 2 + p.probes.length * 3) fail('Request budget must cover two identity checks plus three requests per probe');
  return { ...p, target: url.origin } as Plan;
}

export function atPointer(value: unknown, path: string): unknown {
  let current = value;
  for (const encoded of path.slice(1).split('/')) {
    const part = encoded.replace(/~1/g, '/').replace(/~0/g, '~');
    if (current === null || typeof current !== 'object' || !Object.hasOwn(current, part)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
