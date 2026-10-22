import type { RunReport } from './types.ts';

function plain(value: string): string { return value.replace(/[\\`*_{}\[\]()#+.!|<>]/g, '\\$&').replace(/[\r\n]/g, ' '); }
export function renderReport(report: RunReport): string {
  const findings = report.checks.flatMap(c => c.findings);
  const lines = [
    '# BreakALeg security rehearsal', '',
    `Run: ${plain(report.runId)} · Version: ${plain(report.toolVersion)}`, '',
    `Environment: ${plain(report.mode)} · Target: ${plain(report.targetOrigin ?? 'no runtime target')}`, '',
    `Started: ${plain(report.startedAt)} · Commit: ${plain(report.commit ?? 'not recorded')}`, '',
    `Requests: ${report.requestsMade} · Findings: ${findings.length} · Blocked checks: ${report.checks.filter(c => c.status === 'blocked').length}`, '',
    `Evidence: ${findings.filter(f => f.evidenceStatus === 'runtime-reproduced').length} runtime reproduced; ${findings.filter(f => f.evidenceStatus === 'source-supported').length} source supported; ${findings.filter(f => f.evidenceStatus === 'needs-verification').length} need verification.`, '',
    'This report covers only the listed fixtures and checks. No findings does not establish that the application is secure.', '',
    '## Check coverage', '', '| Check | Result | Explanation |', '| --- | --- | --- |',
    ...report.checks.map(c => `| ${plain(c.id)} | ${plain(c.status)} | ${plain(c.reason)} |`), '',
    '## Findings', ''
  ];
  if (!findings.length) lines.push('No findings were recorded for these checks. Review blocked checks and limitations.', '');
  for (const f of findings) {
    lines.push(`### ${plain(f.id)}: ${plain(f.title)}`, '', `Severity: ${f.severity} · Evidence: ${f.evidenceStatus}`, '', plain(f.impact), '', '**Reproduction**', '', ...f.reproduction.map((r, i) => `${i + 1}. ${plain(r)}`), '', '**Evidence**', '', ...f.evidence.map(r => `- ${plain(r)}`), '', `Code locations: ${f.codeLocations.length ? f.codeLocations.map(plain).join(', ') : 'Not traced by the runner; the reviewing agent should locate the policy or handler.'}`, '', `Remediation: ${plain(f.remediation)}`, '', `Retest: ${plain(f.retest)}`, '');
  }
  lines.push('## Observations', '', 'Response bodies, authorization headers, identity values, and fixture markers are intentionally omitted.', '');
  for (const c of report.checks) for (const o of c.observations) lines.push(`- ${plain(c.id)} / ${o.actor}: HTTP ${o.status}; private marker matched: ${o.markerMatched === true ? 'yes' : 'no'}.`);
  lines.push('', '## Limitations', '', ...report.limitations.map(l => `- ${plain(l)}`), '', '## Cleanup', '', plain(report.cleanup), '');
  return lines.join('\n');
}
