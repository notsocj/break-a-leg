# Reports and troubleshooting

## Evidence and severity answer different questions

| Evidence | What it establishes |
| --- | --- |
| `runtime-reproduced` | The stated behavior occurred in the named environment/harness. Inspect mocks and fixture limits. |
| `source-supported` | Reachable source/configuration supports the issue; execution was not confirmed. |
| `needs-verification` | A material assumption remains unresolved. |

Severity describes impact under the stated preconditions. It does not convert a source finding into a reproduced result. A widget test with a mocked biometric plugin verifies application logic, not OS authentication behavior.

Each finding should identify its affected operation, source locations, preconditions, expected versus observed behavior, remediation, and a concrete retest. A test deliberately asserting a bypass can pass while demonstrating a vulnerability.

## Check status and completeness

| Status | Meaning |
| --- | --- |
| `issue-found` | At least one concrete issue was identified; other planned comparisons may still be incomplete. |
| `no-issue-observed` | No issue was seen within the exact completed check; not a whole-app guarantee. |
| `blocked` | Missing inputs, failed baseline, tool failure, or ambiguity prevents a conclusion. |
| `skipped` | The check was not executed. |
| `not-applicable` | The feature/boundary does not exist or does not apply, with an explicit basis. |

Report schema 2 also records `complete` per check. A private marker exposed to another user plus an ambiguous anonymous response is both a finding and incomplete coverage. Do not discard either fact.

An absent backend in a local-only app can be not applicable. An existing backend whose source/environment is unavailable is blocked. Device verification remains separate from source review and widget tests.

## CLI exit codes

| Code | `run` result |
| --- | --- |
| `0` | Configured checks completed without findings |
| `1` | Findings with complete configured coverage |
| `2` | Error, blocked, or incomplete coverage; takes precedence over findings |

`discover` and `validate` returning 0 only mean those offline commands completed. `rls-audit` and `secrets` exit 1 when they report leads and 0 when they report none; neither result proves the app is safe. The synthetic demo returns 0 when both its intentionally vulnerable and secure fixtures match their expected behavior.

See the [vulnerable example](../examples/demo-reports/vulnerable.md), [secure counterpart](../examples/demo-reports/secure.md), and [source-review example](../examples/source-review.md). These are public synthetic fixtures, not customer assessments. Preserve original helper reports and write the agent's consolidated analysis separately.

## Common problems

| Symptom | What to check / next step |
| --- | --- |
| The agent cannot find the skill | Confirm the complete folder is in the correct skills directory for that agent; check `CODEX_HOME`; start a fresh chat. |
| Installer says the skill exists | Inspect the installed copy. Use `python3 scripts/install.py --update` for an intentional replacement with backup. |
| Node reports an unknown `.ts` extension or unsupported syntax | Run `node --version`; use Node 22.18+ or 24 LTS. Source review can continue without the helper. |
| `discover` reports no stack or truncated results | Select the actual app root and inspect manifests manually. Hidden files, symlinks, and common dependency/build directories are skipped. |
| `rls-audit` reports a lead you consider intended | Leads are not findings. Public data may correctly allow every row. Record the intended access rule in the review and move on. |
| `secrets` reports a key in `.env` | Check whether the file is committed or bundled into the app. A server-only, ignored `.env` is not client exposure; a committed one still needs rotation. |
| A cookie-session API cannot use bearer tokens | Set `accounts.cookieName` in the plan; the runner then sends the session as that cookie. |
| `validate` succeeds but `run` is blocked | Structural validation cannot prove credentials, distinct ordinary roles, fixture ownership, or response semantics. Inspect the report reason. |
| Missing credentials | Supply the exact environment variable names from the plan to the process. `.env` files are not loaded automatically. Never paste token values into an issue. |
| Identity preflight fails | Verify the trusted endpoint and pointer, session validity, and two distinct ordinary users. Do not substitute an admin token. |
| Owner baseline fails | Confirm the synthetic record exists, belongs to the owner, and returns the exact marker at the configured pointer. An inaccessible baseline cannot prove authorization is secure. |
| Result is ambiguous | Inspect the app's response semantics in the isolated harness. A nonmatching marker is insufficient for arbitrary nonempty responses. Keep coverage incomplete. |
| `EEXIST` output error | Use a new output directory. Existing directories are rejected before target requests. Preserve the prior report. |
| `ENOENT` / permission error | Check the plan path and output parent. Ensure the parent exists and is writable. Do not relax target scope to resolve a local filesystem error. |
| Local test server cannot bind a port | The execution environment may prohibit loopback listeners. Request the required host permission or continue source review; do not expose the fixture externally. |
| TLS failure, redirect, 429, 5xx, timeout, or response cap | The runner stops by design. Investigate the isolated target/configuration and record incomplete coverage. It does not retry or disable TLS verification. |
| Firebase SDK / binary download / write test needed | Use the project's isolated emulator or test harness. These are not supported by the JSON-read helper. |
| No report after interruption | Treat the run as incomplete. Inspect existing files before retrying with a new output directory. |

## Retest and share responsibly

Retest the same operation after a focused fix, including a legitimate baseline. Record the new commit, environment, remaining gaps, and any failed cleanup. Never replace a failed check with a generic “secure” verdict.

For a BreakALeg bug, use a minimal synthetic reproduction and the [public issue template](https://github.com/notsocj/break-a-leg/issues/new/choose). For a vulnerability in BreakALeg, use [private reporting](../SECURITY.md). Vulnerabilities found in your app belong in your app's private workflow, not in BreakALeg's public issues.
