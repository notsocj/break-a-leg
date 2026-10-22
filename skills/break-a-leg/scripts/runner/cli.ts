import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { parsePlan } from './plan.ts';
import { discover } from './discover.ts';
import { runPlan } from './run.ts';
import { renderReport } from './report.ts';

const help = `BreakALeg 0.1.0 — Node 22.18+ (24 LTS recommended)

  node <skill>/scripts/break-a-leg.mjs discover <project-root>
  node <skill>/scripts/break-a-leg.mjs validate <plan.json>
  node <skill>/scripts/break-a-leg.mjs run <plan.json> --out <new-directory> [--repo <project-root>]

discover and validate make no network requests. run performs bounded GET probes
against the explicitly scoped local or staging target. It never follows redirects.
Exit codes: 0 = completed without findings or blocked checks; 1 = findings;
2 = blocked/error (takes precedence over findings). Always inspect the report.
`;

async function readPlan(path: string) {
  if ((await stat(path)).size > 262144) throw new Error('Plan exceeds 256 KiB');
  let json: unknown;
  try { json = JSON.parse(await readFile(path, 'utf8')); }
  catch { throw new Error('Plan is not valid JSON'); }
  return parsePlan(json);
}

export async function main(args: string[]) {
  const [command, input, ...rest] = args;
  if (!command || command === '--help' || command === 'help') { console.log(help); return 0; }
  if (!input || !['discover', 'validate', 'run'].includes(command)) throw new Error('Unknown command or missing input; use --help');
  if (command === 'discover') {
    if (rest.length) throw new Error('discover takes only a project root');
    console.log(JSON.stringify(await discover(input), null, 2)); return 0;
  }
  const plan = await readPlan(input);
  if (command === 'validate') {
    if (rest.length) throw new Error('validate takes only a plan file');
    console.log('Plan is structurally valid. No credentials were read or requests sent. Human scope and fixture ownership still need verification.'); return 0;
  }
  const flags = new Map<string, string>();
  for (let i = 0; i < rest.length; i += 2) {
    if (!['--out', '--repo'].includes(rest[i]) || !rest[i + 1] || flags.has(rest[i])) throw new Error('Invalid or repeated run option');
    flags.set(rest[i], rest[i + 1]);
  }
  if (!flags.has('--out')) throw new Error('run requires --out pointing to a new directory');
  const out = resolve(flags.get('--out')!);
  // An existing output directory is rejected before any network operation.
  // Its parent must exist; this avoids accidentally creating a large directory tree.
  await mkdir(out, { mode: 0o700 });
  let commit: string | null = null;
  if (flags.has('--repo')) {
    try { const value = execFileSync('git', ['-C', resolve(flags.get('--repo')!), 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 }).trim(); if (/^[a-f0-9]{40,64}$/.test(value)) commit = value; } catch { /* Not a Git checkout. */ }
  }
  const report = await runPlan(plan, { commit });
  await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  await writeFile(join(out, 'report.md'), renderReport(report), { mode: 0o600, flag: 'wx' });
  const findings = report.checks.reduce((n, c) => n + c.findings.length, 0);
  const blocked = report.checks.some(c => c.status === 'blocked' || c.reason.includes('Run stopped') || c.observations.length < 3);
  console.log(`BreakALeg completed: ${report.requestsMade} requests; ${findings} findings; ${blocked ? 'incomplete coverage' : 'configured probes completed'}. Reports saved to the requested directory.`);
  return blocked ? 2 : findings ? 1 : 0;
}

export async function entry() {
  try { process.exitCode = await main(process.argv.slice(2)); }
  catch (error) {
    // Do not echo file contents, URLs, tokens, parser excerpts, or raw transport errors.
    const e = error as NodeJS.ErrnoException;
    if (e.code) console.error(`BreakALeg could not complete the command (${e.code}). Check input/output paths and permissions.`);
    else console.error(`BreakALeg: ${e.message}`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await entry();
