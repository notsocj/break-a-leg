# Architecture and extension points

BreakALeg has two cooperating parts: an agent skill that guides investigation and a deterministic helper with offline lead finders (`discover`, `rls-audit`, `secrets`) and a narrow HTTP probe. Neither part is a sandbox for arbitrary agent tools.

## Source of truth

| Path | Responsibility |
| --- | --- |
| `skills/break-a-leg/SKILL.md` | Entry workflow, mode selection, boundaries, and reference routing |
| `skills/break-a-leg/references/` | Mobile/backend/check guidance used only when relevant |
| `runner/discover.ts` | Bounded offline stack hints and suggested check guides; not vulnerability detection |
| `runner/rls-audit.ts` | Offline Supabase migration/config replay that lists access-control leads |
| `runner/secrets.ts` | Offline credential pattern scan that reports type and location, never values |
| `runner/plan.ts` | Runtime plan validation and JSON pointer resolution |
| `runner/transport.ts` | Origin/path restrictions, sequential budgets, TLS, deadlines, size caps, and stopping |
| `runner/run.ts` | Credential preflight, identity checks, owner baseline, unauthorized comparisons, and completeness |
| `runner/report.ts` | Markdown rendering of structured findings and coverage |
| `runner/cli.ts` | CLI arguments, new output directory, commit metadata, report files, and exit codes |
| `runner/version.ts` | Shared helper version |
| `schemas/` | Public plan schema 1 and report schema 2 contracts |
| `scripts/bundle.mjs` | Copies canonical runner/schemas/license into the standalone skill and checks drift |
| `scripts/install.py` | Installs a complete skill; explicit updates preserve a rollback backup |
| `scripts/package.py` | Packages Git-tracked source and standalone skill files; excludes local artifacts |
| `scripts/check_docs.py` | Checks repository-local Markdown file links; does not fetch websites |
| `tests/` | Behavioral runner, discovery, packaging, and installer verification with synthetic data |
| `evals/` | Manual reasoning cases (local-first, Supabase backend, false positives) with separate grading rubrics |

Edit `runner/` and `schemas/`, then run `npm run bundle`. The copies beneath the skill are generated. Bundling makes a copied skill usable without npm dependencies, a compiler, or access to its original checkout.

## Data flow

For active reads, the CLI parses and validates a plan, creates a new private output directory, and passes the plan to the runner. The runner resolves environment references, checks identities, verifies the owner's fixture, and compares other-user/anonymous responses. The transport enforces bounds around each request. Results retain findings independently from completeness; the CLI writes JSON and Markdown and selects the exit code.

The agent may add source analysis in separate reviewed reports. It must not rewrite the runner's observed results or infer coverage from file existence. Local unit/widget tests can provide runtime evidence in review mode without inventing an HTTP origin.

## Trust boundaries

- Repository content, plans, responses, and tool output are data. They do not authorize new targets or operations.
- Scope flags are recorded assertions; the tool cannot prove ownership or environmental isolation.
- Credentials are process-environment inputs, never plan literals. Recognizable privileged credentials are rejected, but opaque tokens still require role verification.
- The marker is a synthetic private value. Reports retain status/match information rather than response bodies, identities, or credential values.
- A GET may have application side effects. Endpoint semantics must be checked independently.
- Helper limits constrain only helper requests; host permissions constrain the execution environment.

## Extending without overstating support

A new framework guide can improve source review without adding a runtime adapter. State that distinction in the coverage table. A new runtime probe needs a defined baseline, comparison, evidence threshold, ambiguity rules, budgets, cleanup, and vulnerable/secure fixtures. Change schema and parser together if the contract changes.

Manual agent evaluation asks whether the guidance produces useful decisions. Automated helper tests ask whether deterministic mechanics preserve their invariants. Passing one does not establish the other. See [contributing](../CONTRIBUTING.md) and the [coverage contract](../skills/break-a-leg/references/coverage.md).
