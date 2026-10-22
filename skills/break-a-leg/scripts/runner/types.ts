export type Mode = 'local' | 'staging';
export type Status = 'issue-found' | 'no-issue-observed' | 'blocked' | 'skipped' | 'not-applicable';
export type EvidenceStatus = 'runtime-reproduced' | 'source-supported' | 'needs-verification';
export type Plan = {
  version: 1;
  environment: Mode;
  target: string;
  scope: { authorized: true; isolatedTestData: true; readOnlyEndpoints: true };
  limits: { maxRequests: number; timeoutMs: number; delayMs: number; maxResponseBytes: number };
  accounts: { ownerTokenEnv: string; otherTokenEnv: string };
  publicApiKeyEnv?: string;
  identity: { path: string; subjectPointer: string };
  probes: Array<{
    id: string;
    kind: 'authorization-read';
    path: string;
    markerPointer: string;
    markerEnv: string;
    privateFixture: true;
  }>;
};
export type Observation = { actor: 'owner' | 'other' | 'anonymous'; status: number; markerMatched?: boolean };
export type Finding = {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  evidenceStatus: EvidenceStatus;
  impact: string;
  reproduction: string[];
  evidence: string[];
  codeLocations: string[];
  remediation: string;
  retest: string;
};
export type CheckResult = {
  id: string;
  category: string;
  status: Status;
  complete: boolean;
  reason: string;
  observations: Observation[];
  findings: Finding[];
};
export type RunReport = {
  schemaVersion: 2;
  toolVersion: string;
  runId: string;
  startedAt: string;
  finishedAt: string;
  mode: Mode | 'review';
  targetOrigin: string | null;
  commit: string | null;
  planSha256: string | null;
  requestsMade: number;
  checks: CheckResult[];
  limitations: string[];
  cleanup: string;
};
