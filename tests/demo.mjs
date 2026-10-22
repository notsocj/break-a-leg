import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { runPlan } from '../runner/run.ts';
import { renderReport } from '../runner/report.ts';
import { startFixture, planFor, testEnv } from './fixture-server.mjs';

const out = resolve(process.argv[2] ?? join('.break-a-leg', 'demo', randomUUID()));
await mkdir(out, { recursive: true, mode: 0o700 });
for (const behavior of ['vulnerable', 'secure']) {
  const fixture = await startFixture(behavior);
  try {
    const report = await runPlan(planFor(fixture.target), { env: testEnv });
    const expected = behavior === 'vulnerable' ? 'issue-found' : 'no-issue-observed';
    if (report.checks[0].status !== expected) throw new Error(`Demo outcome differs from the expected ${behavior} fixture`);
    await writeFile(join(out, `${behavior}.json`), JSON.stringify(report, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    await writeFile(join(out, `${behavior}.md`), renderReport(report), { mode: 0o600, flag: 'wx' });
    console.log(`${behavior}: ${report.checks[0].status}; ${report.requestsMade} requests; ${report.checks[0].findings.length} findings`);
  } finally { await fixture.close(); }
}
console.log('Synthetic demo reports written. No external targets were contacted.');
