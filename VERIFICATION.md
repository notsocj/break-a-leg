# Verification

## Current repository maintenance checks

Verified locally on 2026-10-24 using Node 24.18.0 on macOS. Changes after the v0.1.2 tag are listed under Unreleased in the changelog.

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
