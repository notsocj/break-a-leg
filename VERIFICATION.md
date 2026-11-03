# Verification

## v0.2.0 checks

Verified locally on 2026-10-25 using Node 22.23.4 and Python 3 on Linux. Consult the [workflow results](https://github.com/notsocj/break-a-leg/actions/workflows/test.yml) for Node 22 and 24 on the pushed commit.

| Check | Result |
| --- | --- |
| Runner, discovery, static helper, and standalone CLI tests | 52 passed, 1 skipped (the IPv6-only localhost test; the verification host had no IPv6 loopback) |
| Python installer and archive packaging tests | 14 passed |
| Strict TypeScript and bundled-source parity | Passed |
| Local Markdown file destinations | Passed |
| Documented synthetic demo | Expected vulnerable and secure outcomes; loopback only |
| `rls-audit` fixtures | Vulnerable fixture produced every expected lead; secure counterpart produced none |
| `secrets` redaction | Tests assert no matched value appears in output; fixture keys are assembled at test time, not committed |
| Claude Code installation | `install.py --agent claude` installed the complete skill into a temporary home's `.claude/skills` |

`rls-audit` was tested on synthetic migrations, not on a live Supabase project or real-world migration histories.

## Skill evaluations

Run on 2026-11-03 against commit `f2be7c7` (v0.2.0 plus the backend-guide update). Each case ran in a fresh Claude Opus 5.5 subagent restricted to an isolated folder holding the request and `fixture.txt`, plus a copy of the skill for the "with skill" runs. Baseline runs got the same request without the words "Use BreakALeg" and no skill. Evaluators did not see the rubrics; the grader did. One run per cell, so treat differences as indicative.

| Case | Rubric item | With skill | Baseline |
| --- | --- | --- | --- |
| Supabase | Issues 1–6 (journal RLS, coach function, webhook, self-service Pro/credits, public progress bucket, anonymous sign-ins) | 6/6 | 6/6 |
| Supabase | Items 1–5 under a plain-language "Fix before launch" | Pass | Partial: all five ranked P0, no plain-language priority |
| Supabase | `source-supported` labels; proposed tests marked unexecuted | Pass | Partial: tests marked not run; no evidence labels |
| Supabase | No alarm on the anon key or `avatars` bucket | Pass | Pass |
| Supabase | No finding on the public `profiles` select policy | Flagged as Low (exposes `is_pro`, `coach_credits`) | Flagged as P1 (same reason) |
| Supabase | Deployed/dashboard state noted as unverified; no score, invented locations, or live probing | Pass | Pass |
| False positives | No inflated finding for any of the six safe items; empty "Fix before launch" | Pass | Pass |
| Local-first | Issues 1–4 (recovery disables lock, unknown settings fail open, dialog above lock, leftover provider credential) | 4/4 | 4/4 |
| Local-first | Avoids the four listed false alarms; keeps the TODO assistant out | Pass | Pass |
| Local-first | `source-supported` labels; backend `not-applicable` vs device `skipped`/`blocked` | Pass | Fail: no evidence labels or status split |

Findings:

- On these fixtures the model finds every expected issue without the skill. The skill's measurable effect is report discipline: evidence labels, launch priority, coverage tables, not-applicable versus blocked, and grant-default caveats. The fixtures mark their bugs with comments such as `-- RLS to be added later` and `// no Authorization header check`, so they do not separate finding ability.
- Both Supabase runs flagged the public `profiles` select policy because the table also holds `is_pro` and `coach_credits`, which the contract does not make public. That reasoning is sound; the rubric should accept it as a low-severity item.
- The skill run ran `rls-audit` on a reconstruction of the fixture. It missed the self-service `is_pro`/`coach_credits` update, the body-supplied `userId` in the coach function, and the credit race; the agent found them by reading.
- Both Supabase runs also found real issues the rubric does not list: a non-atomic credit decrement, a caller-chosen model, and a webhook that never revokes Pro.

### Harder evaluations

Run on 2026-11-03 with the same method, against the working tree after commit `f8d93d2` (which added the new `rls-audit` leads). These fixtures have six unlabelled defects each, no comments pointing at them, and contract-matching decoys.

| Case | Defects found (skill / baseline) | Decoys wrongly rated medium or high (skill / baseline) | Report discipline (skill / baseline) |
| --- | --- | --- | --- |
| Multi-tenant Supabase | 6/6 / 6/6 | 0 / 0 | Pass / Partial: no evidence labels |
| Firebase marketplace | 6/6 / 6/6 | 0 / 0 | Pass / Partial: no evidence labels or not-applicable/skipped split |

Findings:

- Removing hint comments and adding decoys did not separate the two: Claude Opus 5.5 found every defect and rejected every decoy without the skill. On fixtures of about 110–140 lines this model's finding ability is not the bottleneck. To measure the skill's effect on finding, run these cases with a smaller model, or build larger fixtures where attention limits matter.
- The skill again changed the report: launch priority, `source-supported` labels, coverage tables with not-applicable versus blocked, and helper-lead triage. In the multi-tenant case the skill run triaged all nine `rls-audit` leads (four real, five intended); the audit did not cover the member invoice edit or the missing share-link expiry check.
- Both Firebase runs found further real issues in the payment flow (webhook state and amount checks, payout idempotency) and tutor self-rating. The rubric now lists them as valid extras.

### Smaller model (Claude Haiku 5.5)

Run on 2026-11-03 against commit `de067c4` with the same isolation and grading. The original Supabase case was skipped because the multi-tenant case covers the same ground.

| Case | Defects found (skill / baseline) | Decoys wrongly rated medium or high (skill / baseline) | Report discipline (skill / baseline) |
| --- | --- | --- | --- |
| Multi-tenant Supabase | 6/6 / 6/6 | 0 / 1 (`audit_log` as a missing audit trail) | Pass / Partial: no evidence labels |
| Firebase marketplace | 6/6 / 6/6 | 1 (open chat creation) / 3 (open chat creation, SVG avatars, App Check coverage) | Pass / Fail: no evidence labels or coverage split |
| Local-first | 4/4 / 4/4 | 0 / 0 | Pass / Partial: no not-applicable/skipped split |
| False positives | No findings above low / No findings above low | 0 / 0 | Pass / Pass |

Findings:

- Haiku also found every defect without the skill, so these fixtures do not separate finding ability even on the smaller model.
- The skill's effect on Haiku was precision and reporting: fewer decoys raised to medium or high (1 versus 4 across the two harder cases), plus the evidence labels, launch priority, and coverage tables seen with Opus.
- Both local-first runs made the same reasoning slip: they treated the leftover provider credential as latent because the assistant service is unused, although the credential is user-entered and stored regardless.
- Helper noise seen in the multi-tenant skill run: `rls-audit` raised `user-writable-privileged-columns` on `invitations`, whose only write policy is admin-gated through `is_org_admin`, and `storage-policy-without-identity` on a storage policy that checks membership through `is_org_member()` instead of calling `auth.*` directly. The agent dismissed both after tracing.

### AI abuse and rate limits

Run on 2026-11-03 against commit `9defd83` (the commit that added `limits` and `abuse.md`), with the same isolation and grading, on Claude Opus and Claude Haiku through Claude Code's model aliases. One run per cell.

| Model | Defects found (skill / baseline) | Decoys wrongly rated medium or high (skill / baseline) | Report discipline (skill / baseline) |
| --- | --- | --- | --- |
| Opus | 6/6 / 6/6 | 0 / 2 (public search, photo upload volume) | Pass / Partial: P0–P2 ranks, no evidence labels |
| Haiku | 6/6 / 6/6 | 1 (photo upload) / 2 (public search, photo upload) | Pass, with one ranking slip / Partial: no evidence labels |

Findings:

- All four runs found every defect, including the share tool's missing ownership check, client-only Chef quota, SMS pumping setup, invite spam, guessable promo codes, and the in-memory import limiter. As with the earlier cases, the fixture does not separate finding ability.
- The skill's effect was again precision and reporting: fewer decoys raised (0 versus 2 on Opus, 1 versus 2 on Haiku), a plain-language launch priority, evidence labels, and coverage tables that separate blocked from skipped. Both baselines still proposed mocked, bounded verification without real sends.
- The baseline decoy ratings were partly justified by the fixture: it did not name the host (so `x-forwarded-for` trust was unclear), relied on `revalidate` for search caching, which a request-reading route handler does not honor, and set no total storage quota on photos. The fixture and rubric are now tightened; those runs are scored as above.
- Both skill runs ran `limits` on a rebuilt copy of the fixture. The pseudocode has no import lines, so the helper found only the SMS lead. `limits` now also recognizes provider call shapes (`.chat.completions.create(`, `.emails.send(`, `generateText(`), treats promo-code and redeem routes as guessable checks, and catches a model destructured from the request body. On the same rebuilt copy it now reports seven leads covering Chef, import, invites, redemption, and SMS.
- The Haiku skill run listed the unseen RLS policies as its top "Fix before launch" item, labelled `needs-verification`. The reporting guide now says an area that could not be inspected goes under Not checked, marked "check first", rather than ranking as a finding.
- Valid extra findings appeared across runs (email confirmation off, client-supplied system messages, the redemption race, promo Pro revoked by subscription events); the rubric now credits them.

## Earlier repository maintenance checks

Verified locally on 2026-10-24 using Node 24.18.0 on macOS for the maintenance changes after the v0.1.2 tag.

| Check | Result |
| --- | --- |
| Runner, discovery, and standalone CLI tests | 36 passed |
| Python installer and archive packaging tests | 13 passed (6 installer, 7 packaging) |
| Strict TypeScript and bundled-source parity | Passed |
| Local Markdown file destinations | Passed; remote URLs and fragment anchors are not checked |
| Documented synthetic demo | Expected vulnerable and secure outcomes; loopback only |
| Archive and installation smoke test | Source guide files included; extracted source installs; standalone skill runs; all three plan examples validate offline |

Packaging tests cover exclusion of untracked reports and known local/credential artifacts, standalone-skill contents, existing output preservation, symlink rejection, repository/output boundaries, safe version filenames, and failed-write cleanup. The packager is not a general secret scanner; review tracked content before publication.

## Published v0.1.2 checks

The v0.1.2 sources were verified on 2026-10-24. Both its branch and tag workflows passed on Node 22 and 24; see the [tag workflow](https://github.com/notsocj/break-a-leg/actions/runs/40074389910).

| Check | Result |
| --- | --- |
| Behavioral runner, discovery, and packaged CLI tests | 36 passed; 0 failed; 0 skipped |
| Installer tests | 6 passed, including backup preservation and rollback |
| Strict TypeScript checking | Passed (`tsc --noEmit`) |
| Official skill-creator validator | Passed |
| Plan/report JSON schemas | Valid Draft 2020-12 schemas; three plan and three report examples validated |
| Skill metadata and local Markdown references | Valid |
| Bundled runtime/schema parity with canonical source | Passed |
| Standalone copied-skill execution | Passed outside the source repository |
| Installer | Refuses implicit overwrite; explicit updates preserve the old skill and restore it if replacement fails |
| Synthetic vulnerable/secure fixtures | Existing runner tests reproduced unauthorized reads and verified the secure counterpart's denials |
| Local-first reasoning case | Fictional input and withheld rubric added; not independently evaluated |

The HTTP tests bind only loopback and use synthetic credentials and data. They cover positive/negative baselines, cross-user and anonymous access, identity failures, recognizable privileged credentials, redirects (including cross-origin), rate limiting, server errors, timeouts, slow responses, response caps, compressed/aborted responses, concurrency, budgets, redaction, partial findings, mixed conclusive/inconclusive responses, and output overwrite refusal. Packaging tests also detect version drift and obsolete generated code.

The TypeScript and type declarations are development dependencies only. The installable skill's runtime uses Node built-ins and does not require `npm install`.

## Limits of this verification

- No real Supabase or Firebase deployment/emulator was started; the provider-specific fixtures and guides are not live integration certification.
- A private Flutter source review used isolated widget/unit tests with synthetic data and platform mocks. This informed the local-data guide; private app source and findings are excluded from this repository. No app was run on a device, and no native biometric/secure-storage integration was certified. Included public mobile fixtures remain source/discovery examples.
- Staging HTTPS origin validation is tested offline; no external staging target was contacted.
- The skill has not undergone an independent coding-agent behavioral evaluation or a broader founder pilot. The local-first evaluation rubric is not automatically scored by the test suite.
- GitHub Actions is configured to run checks on Node 22 and 24; consult the [workflow results](https://github.com/notsocj/break-a-leg/actions/workflows/test.yml) for the exact published commit. Local execution used Node 24.18.0.
- The public repository has private vulnerability reporting enabled. No npm registry package is published; install the self-contained skill directory from the repository.

These limitations are reflected in the coverage guide and must remain visible when describing the release.
