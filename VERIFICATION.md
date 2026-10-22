# BreakALeg v0.1.0 verification

Verified on 2026-10-23 using Node 24.18.0 on macOS.

| Check | Result |
| --- | --- |
| Behavioral runner, discovery, and packaged CLI tests | 32 passed; 0 failed; 0 skipped |
| Strict TypeScript checking | Passed (`tsc --noEmit`) |
| Official skill-creator validator | Passed |
| Plan/report JSON schemas | Valid Draft 2020-12 schemas; three plan and three report examples validated |
| Skill metadata and local Markdown references | Valid |
| Bundled runtime/schema parity with canonical source | Passed |
| Standalone copied-skill execution | Passed outside the source repository |
| Installer | Copies required resources and refuses an existing destination |
| Synthetic demo | Vulnerable fixture: two findings; secure counterpart: no issue observed for the configured read |

The HTTP tests bind only loopback and use synthetic credentials and data. They cover positive/negative baselines, cross-user and anonymous access, identity failures, recognizable privileged credentials, redirects (including cross-origin), rate limiting, server errors, timeouts, slow responses, response caps, compressed/aborted responses, concurrency, budgets, redaction, partial findings, and output overwrite refusal.

The TypeScript and type declarations are development dependencies only. The installable skill's runtime uses Node built-ins and does not require `npm install`.

## Limits of this verification

- No real Supabase or Firebase deployment/emulator was started; the provider-specific fixtures and guides are not live integration certification.
- No Flutter, Expo/React Native, Swift, or Kotlin app was built or run on a device. Included mobile fixtures are source/discovery examples.
- Staging HTTPS origin validation is tested offline; no external staging target was contacted.
- The skill has not undergone an independent coding-agent behavioral evaluation or pilot with real founders.
- The included GitHub Actions workflow and Node 22 matrix have not run on GitHub. Local execution used Node 24.18.0.
- No public repository, registry package, or private vulnerability reporting channel has been created by this task. Configure the reporting channel before public release.

These limitations are reflected in the coverage guide and must remain visible when describing the release.
