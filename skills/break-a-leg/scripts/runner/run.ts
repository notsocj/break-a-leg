import { createHash, randomUUID } from 'node:crypto';
import { atPointer, parsePlan } from './plan.ts';
import { ScopedTransport } from './transport.ts';
import type { CheckResult, Finding, Plan, RunReport } from './types.ts';
import { VERSION } from './version.ts';

function envValue(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value || value.length > 8192 || /[\r\n\x00]/.test(value)) throw new Error('Required environment reference is missing or invalid');
  return value;
}
function rejectPrivileged(value: string) {
  if (value.startsWith('sb_secret_')) throw new Error('Privileged credentials cannot be used for probes');
  try {
    const payload = JSON.parse(Buffer.from(value.split('.')[1] ?? '', 'base64url').toString('utf8'));
    if (payload.role === 'service_role' || payload.role === 'supabase_admin') throw new Error('privileged');
  } catch (error) {
    if ((error as Error).message === 'privileged') throw new Error('Privileged credentials cannot be used for probes');
  }
}
function credentials(plan: Plan, env: NodeJS.ProcessEnv) {
  const owner = envValue(env, plan.accounts.ownerTokenEnv);
  const other = envValue(env, plan.accounts.otherTokenEnv);
  if (owner === other) throw new Error('Owner and other-user tokens must differ');
  for (const token of [owner, other]) { rejectPrivileged(token); if (/\s/.test(token)) throw new Error('Bearer tokens cannot contain whitespace'); }
  const apiKey = plan.publicApiKeyEnv ? envValue(env, plan.publicApiKeyEnv) : undefined;
  if (apiKey) rejectPrivileged(apiKey);
  const markers = plan.probes.map(p => envValue(env, p.markerEnv));
  if (markers.some(marker => marker.length < 16 || marker === owner || marker === other || marker === apiKey)) throw new Error('Use a synthetic fixture marker of at least 16 characters, separate from credentials');
  return { owner, other, apiKey, markers };
}
function publicPath(path: string) { return path.split('?')[0] + (path.includes('?') ? '?[query omitted]' : ''); }
function finding(id: string, path: string, actor: 'other' | 'anonymous'): Finding {
  return {
    id: `${id}-${actor}`, title: `Private fixture readable by ${actor === 'other' ? 'another user' : 'an anonymous caller'}`,
    severity: 'high', evidenceStatus: 'runtime-reproduced',
    impact: 'A caller outside the declared owner-only access policy retrieved the private synthetic fixture. Assess the sensitivity of equivalent real records before final severity assignment.',
    reproduction: ['Use the original scoped plan and the two distinct test-user sessions.', `Confirm the owner can GET ${publicPath(path)} and the synthetic marker matches.`, `Repeat the request as ${actor}; the same marker is returned.`],
    evidence: ['Owner identity and second-user identity were successfully checked and differ.', 'Owner response contained the configured synthetic marker.', `${actor} response also contained that exact marker; response bodies and credentials were not saved.`],
    codeLocations: [],
    remediation: 'Enforce the intended owner or membership check on the server/database for this operation. Trace the actual policy before selecting a code change.',
    retest: 'Rerun this plan against the same kind of private fixture. The owner must retain access; unauthorized callers must not receive it.'
  };
}
function safeReason(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  const allowed = [
    'Required environment reference is missing or invalid', 'Owner and other-user tokens must differ',
    'Privileged credentials cannot be used for probes', 'Bearer tokens cannot contain whitespace',
    'Use a synthetic fixture marker of at least 16 characters, separate from credentials',
    'Redirects are blocked; review the exact target endpoint', 'Run stopped on rate limiting or a server error',
    'Compressed responses are unsupported', 'Response interrupted', 'Response size limit exceeded',
    'Request deadline exceeded', 'Run stopped after a transport or server failure', 'Request budget exhausted'
  ];
  return allowed.includes(message) ? message : 'Request failed; check connectivity and TLS locally. Raw transport details were omitted.';
}

export async function runPlan(raw: unknown, options: { env?: NodeJS.ProcessEnv; commit?: string | null } = {}): Promise<RunReport> {
  const plan = parsePlan(raw);
  const transport = new ScopedTransport(plan);
  const startedAt = new Date().toISOString();
  const checks: CheckResult[] = plan.probes.map(p => ({ id: p.id, category: p.kind, status: 'skipped', complete: false, reason: 'Not executed', observations: [], findings: [] }));
  let creds: ReturnType<typeof credentials>;
  let preflightFailure: string | undefined;
  try {
    creds = credentials(plan, options.env ?? process.env);
    const owner = await transport.get(plan.identity.path, creds.owner, creds.apiKey);
    const other = await transport.get(plan.identity.path, creds.other, creds.apiKey);
    const a = atPointer(owner.json, plan.identity.subjectPointer);
    const b = atPointer(other.json, plan.identity.subjectPointer);
    if (owner.status !== 200 || other.status !== 200 || typeof a !== 'string' || typeof b !== 'string' || !a || !b || a === b) {
      preflightFailure = 'Identity preflight failed: both sessions must return distinct nonempty subject strings from a trusted identity endpoint';
    }
  } catch (error) { preflightFailure = safeReason(error); }
  if (preflightFailure) for (const check of checks) { check.status = 'blocked'; check.reason = preflightFailure; }
  else for (const [index, probe] of plan.probes.entries()) {
    const check = checks[index];
    try {
      const marker = creds!.markers[index];
      const baseline = await transport.get(probe.path, creds!.owner, creds!.apiKey);
      const matched = baseline.isJson && atPointer(baseline.json, probe.markerPointer) === marker;
      check.observations.push({ actor: 'owner', status: baseline.status, markerMatched: matched });
      if (baseline.status < 200 || baseline.status >= 300 || !matched) {
        check.status = 'blocked'; check.reason = 'Owner baseline failed: the private fixture marker was not readable by its declared owner'; continue;
      }
      let ambiguous = false;
      for (const actor of ['other', 'anonymous'] as const) {
        const response = await transport.get(probe.path, actor === 'other' ? creds!.other : undefined, creds!.apiKey);
        const leaked = response.isJson && atPointer(response.json, probe.markerPointer) === marker;
        check.observations.push({ actor, status: response.status, markerMatched: leaked });
        // A private marker in any response is a leak, even if the HTTP status says denied.
        if (leaked) check.findings.push(finding(probe.id, probe.path, actor));
        else if (![401, 403, 404].includes(response.status) && !(response.status === 200 && response.isJson && Array.isArray(response.json) && response.json.length === 0)) ambiguous = true;
      }
      check.complete = !ambiguous;
      if (check.findings.length) {
        check.status = 'issue-found';
        check.reason = 'A caller outside the declared access policy received the synthetic private marker';
        if (ambiguous) check.reason += '; another actor response was inconclusive, so coverage remains incomplete';
      } else if (ambiguous) {
        check.status = 'blocked';
        check.reason = 'Response was neither a recognized denial nor the expected marker; inspect access semantics before deciding';
      } else {
        check.status = 'no-issue-observed';
        check.reason = 'The owner baseline succeeded and both unauthorized attempts were denied or returned an empty collection; only this fixture and operation were tested';
      }
    } catch (error) {
      check.status = check.findings.length ? 'issue-found' : 'blocked';
      check.reason = `${safeReason(error)}${check.findings.length ? '; a previously reproduced finding is retained' : ''}`;
    }
  }
  const report: RunReport = {
    schemaVersion: 2, toolVersion: VERSION, runId: randomUUID(), startedAt, finishedAt: new Date().toISOString(),
    mode: plan.environment, targetOrigin: plan.target, commit: options.commit ?? null,
    planSha256: createHash('sha256').update(JSON.stringify(plan)).digest('hex'), requestsMade: transport.count, checks,
    limitations: [
      'Only configured owner-only JSON read operations were probed; this is not a complete security assessment.',
      'The operator must verify account roles, fixture ownership, target ownership, and environment isolation. Configuration cannot prove these facts.',
      'HTTP denials and an empty collection are narrow observations, not proof that no other data leaked.',
      'No app binary, device behavior, write authorization, subscriptions, rate-limit strength, or deployed/local parity was automatically tested.',
      'Response bodies are never persisted. Keep the original plan and test fixture available for reproduction.'
    ],
    cleanup: 'The runner created no remote resources. Any separately seeded fixtures must be cleaned up using their recorded IDs.'
  };
  return report;
}
