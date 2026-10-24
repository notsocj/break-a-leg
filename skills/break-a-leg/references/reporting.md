# Findings and coverage

Preserve original runner output as `report.json` and `report.md`. Write the agent's consolidated assessment separately, for example `review.md` and `review.json`, under a user-approved output location or the project's ignored `.break-a-leg/` directory. Do not publish or commit sensitive reports automatically.

The shared [report schema](schemas/report.schema.json) version 2 supports review/local/staging modes. In review mode, `targetOrigin` and `planSha256` may be null, `requestsMade` is 0, and observations can be empty. Record the version actually used for the assessment (`--version`), not a later installed version. Record the actual commit or null plus a limitation if it is unavailable or the working tree is dirty. No schema field implies that a check was run. Plans remain version 1; do not relabel old report-schema-1 files as schema 2 without adding and verifying their completeness data.

Each finding needs:

- Stable ID, concrete title, affected feature/operation, severity and justified impact.
- Evidence status: `runtime-reproduced`, `source-supported`, or `needs-verification`. Keep this separate from severity. A source finding can be serious without runtime confirmation.
- Preconditions, ordinary user roles, actual reproduction steps, expected versus observed behavior.
- Redacted evidence, file paths/verified line numbers, and the causal server/policy location when available.
- Focused remediation and a regression/retest procedure. Say “not executed” for proposed tests.

For local unit/widget reproductions, name the command, source snapshot, fixture, mocked dependencies, and exact assertion. `runtime-reproduced` can describe the executed application logic, but does not imply a device or backend was exercised. Keep HTTP `observations` empty for these tests rather than fabricating actors/status codes. A passing reproduction test may assert vulnerable behavior; identify it as such and provide the inverse security expectation for a future fix. Report test-harness failures separately from application findings.

Each check gets exactly one result: `issue-found`, `no-issue-observed`, `blocked`, `skipped`, or `not-applicable`. It also has a separate `complete` boolean for the declared check's scope. A finding does not make an inconclusive actor result complete. Blocked or skipped checks are incomplete; a resolved not-applicable check can be complete. In review mode, a completed source check does not imply runtime coverage. A blocked request cannot become a pass. `no-issue-observed` describes only the tested operation and conditions. Log remaining actor coverage if a run stops after a finding.

In the narrative, include: tested environment and parity limits, source/runtime coverage, missing backend or device access, fixture cleanup and failures, and a prioritized next action. Never invent source locations or attach a score implying complete security.

## Redaction

Do not persist access/refresh tokens, private keys, passwords, cookies, production records, payment data, or private API response bodies. Replace sensitive evidence with field names, booleans, status codes, and synthetic examples. Secret exposure findings record location/type/reachability, not the value. Reports still disclose weaknesses: store locally, exclude from version control, and share only when requested.

## Suggested narrative structure

1. Launch priority in plain language: Fix before launch (critical/high), Fix soon (medium), Good to know (low/informational), and Not checked (blocked or skipped areas). Show each item's evidence status beside it; a source-supported high-severity issue still belongs under Fix before launch.
2. Scope and outcome: number of reproduced/source-supported issues and material limits.
3. Findings in impact order: evidence, cause, remediation, retest. Where it helps, include the exact policy, rule, or handler change as a proposed patch, labeled unapplied.
4. Coverage table: check, environment, status, reason.
5. Cleanup: resource identifiers without credentials, removed/remaining, next action.

The runner's Markdown report already opens with a launch-priority section for its own checks. Static helper output from `rls-audit` and `secrets` contains leads, not findings: report a lead only after tracing it, and keep the helper output out of committed files.

If an ordinary denial body contains data but not the configured marker, the helper cannot prove it harmless. Review observed application semantics separately; retain that narrow-coverage limitation.
