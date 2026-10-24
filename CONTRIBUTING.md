# Contributing to BreakALeg

Keep this useful for founders with ordinary coding-agent setups. New checks should improve a concrete security decision, not add an exhaustive payload catalog or generic advice the agent already knows.

## Development

Use Node 22.18+ (24 LTS recommended). Runtime helpers use native type stripping and built-in libraries. Development adds pinned TypeScript and Node type declarations for static checking.

```sh
npm ci --ignore-scripts
npm run typecheck
npm run bundle
npm run check:docs
npm test
npm run test:python
npm run check:bundle
npm run demo
```

The source of truth is `runner/` and `schemas/`. Do not edit their bundled copies under `skills/break-a-leg/`. `scripts/bundle.mjs` updates the installable skill and removes obsolete generated files; `--check` detects drift and unexpected entries. Test behavior, not wording. `npm run typecheck` performs strict static checking separately from Node's runtime stripping. The installed skill needs none of these development packages. Python 3.8+ is used for installation, packaging, documentation checks, and Python tests. See [architecture](docs/architecture.md) for module responsibilities.

## Add a mobile or backend guide

Add a focused reference, link it from SKILL.md, and update the coverage table. Specify discovery signals, trust boundaries, actual supported tools, and how to report missing runtime access. Avoid assuming every dependency or debug configuration ships in a release.

## Add a runtime probe

Define preconditions, finite target scope, positive baseline, unauthorized comparison, evidence needed for confirmation, ambiguous outcomes, stop conditions, cleanup (if applicable), and credential redaction. Update the plan/result schema and runner together. Keep production active testing outside the current release's scope.

Include a vulnerable fixture and a secure counterpart. Test missing/expired credentials, inaccessible baselines, network errors, unexpected content, redirects, partial completion, and secret-free reporting. Never rely on a live third-party target in default tests.

## Behavioral evaluation of the skill

Use an isolated test workspace. Give a coding agent SKILL.md and raw fixtures without revealing expected findings. Include a source-only Flutter project, a second mobile stack sharing the backend, a private-data access bug, a correctly secured counterpart, and ambiguous/missing backend configuration. Assess whether it:

- Starts useful analysis without requiring staging.
- Does not treat public client keys or local-only UI flags as confirmed vulnerabilities.
- Requests only unresolved material scope information before target traffic.
- Distinguishes static evidence, runtime evidence, blocked tests, and skipped device checks.
- Traces findings, redacts credentials, and does not silently modify the app or deploy fixes.

Agent evaluations are separate from the runner's unit/integration tests. Record the agent/model, input fixtures, observed behavior, and limitations; do not claim evaluation that has not been performed.

## Before public release

Keep the private reporting channel in SECURITY.md current. Check branding/package availability before creating a registry package. Document new external dependencies and their licenses. Do not upload private assessment outputs. Update package metadata and `runner/version.ts` together; the tests detect version drift. The [maintainer guide](docs/maintaining.md) covers validation, Git-tracked archive packaging, immutable tags, and publication. Keep archive output outside the repository and inspect tracked files before distributing them.
