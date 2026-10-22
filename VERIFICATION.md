# BreakALeg v0.1.1 verification

Verified on 2026-10-23 using Node 24.18.0 on macOS.

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
| Synthetic demo | Vulnerable fixture: two findings; secure counterpart: no issue observed for the configured read |

The HTTP tests bind only loopback and use synthetic credentials and data. They cover positive/negative baselines, cross-user and anonymous access, identity failures, recognizable privileged credentials, redirects (including cross-origin), rate limiting, server errors, timeouts, slow responses, response caps, compressed/aborted responses, concurrency, budgets, redaction, partial findings, mixed conclusive/inconclusive responses, and output overwrite refusal. Packaging tests also detect version drift and obsolete generated code.

The TypeScript and type declarations are development dependencies only. The installable skill's runtime uses Node built-ins and does not require `npm install`.

## Limits of this verification

- No real Supabase or Firebase deployment/emulator was started; the provider-specific fixtures and guides are not live integration certification.
- No Flutter, Expo/React Native, Swift, or Kotlin app was built or run on a device. Included mobile fixtures are source/discovery examples.
- Staging HTTPS origin validation is tested offline; no external staging target was contacted.
- The skill has not undergone an independent coding-agent behavioral evaluation or pilot with real founders.
- GitHub Actions is configured to run checks on Node 22 and 24; consult the [workflow results](https://github.com/notsocj/break-a-leg/actions/workflows/test.yml) for the exact published commit. Local execution used Node 24.18.0.
- The public repository has private vulnerability reporting enabled. No npm registry package is published; install the self-contained skill directory from the repository.

These limitations are reflected in the coverage guide and must remain visible when describing the release.
