# BreakALeg

**Give your app a security rehearsal before launch.**

[![Verify BreakALeg](https://github.com/notsocj/break-a-leg/actions/workflows/test.yml/badge.svg)](https://github.com/notsocj/break-a-leg/actions/workflows/test.yml)

BreakALeg is an open-source agent skill for mobile founders. It reviews an app and its backend, investigates security weaknesses, and verifies selected issues against local or staging services when available. Staging is optional: a source review is a useful first run.

Version **0.1.2 — early release**. MIT licensed. No telemetry, hosted account, or separate model API key is required by this package. Your coding agent's own model connection and data handling still apply.

## What you get

- Stack-specific review guides for Flutter, React Native/Expo, Swift/iOS, and Kotlin/Android, plus generic guidance for other mobile stacks.
- Backend guides for Supabase, Firebase, and custom APIs.
- Checks covering ownership/roles, credential exposure, server validation, storage, paid features, and expensive endpoints.
- Local-first checks for app-lock transitions, sensitive dialogs, encrypted backups, and deletion across device stores.
- A zero-dependency TypeScript runner for offline discovery, plan validation, and bounded cross-user/anonymous JSON read probes.
- Markdown and JSON reports distinguishing reproduced issues, source evidence, blocked checks, and untested areas.

**Coverage is explicit.** The skill guides the agent's reasoning; it is not an exhaustive automated scanner. The runtime helper currently verifies only configured owner-only JSON reads with bearer authentication and a trusted identity endpoint. Firebase runtime verification uses the project's own emulator harness; there is no bundled Firebase SDK adapter. Device automation and binary analysis are not included. See the [coverage contract](skills/break-a-leg/references/coverage.md).

## Install in Codex

Copy the **entire** `skills/break-a-leg` folder into your Codex skills directory (`$CODEX_HOME/skills`, or `~/.codex/skills`). If a directory of that name already exists, inspect or back it up before replacing it. The folder is self-contained, including its helper runtime and schemas.

Clone the repository and install. The installer refuses to overwrite an existing installation:

```sh
git clone https://github.com/notsocj/break-a-leg.git
cd break-a-leg
python3 scripts/install.py
```

Start a new Codex chat if the skill is not discovered in the current one. Invoke it with a single request:

```text
Use $break-a-leg to review this app and backend before launch. Start with source analysis. Use an existing local or staging environment only when its target, test accounts, and scope are clear. Report reproduced issues separately from source-supported findings and checks you could not run.
```

To update an installed copy after pulling a newer version, run `python3 scripts/install.py --update`. It stages the replacement before changing the installed skill and preserves the previous copy, including local edits, under `skill-backups/` next to the skills directory. The installer prints the exact backup path. `--skills-dir /path/to/skills` supports a custom installation location.

For another agent supporting the same skill-folder format, copy the folder into that agent's documented skill location. Agent-specific installation/discovery compatibility has not been tested beyond the Codex format; no universal cross-agent installer is claimed.

## Requirements

- Source review: an agent that can inspect your repository. Mobile SDKs and staging are optional.
- Helper runtime: **Node 22.18+**, preferably Node 24 LTS. No `npm install` or compile step is needed. Node runs the supported TypeScript syntax natively; it does not type-check it.
- Active checks: explicitly scoped local/staging target, two ordinary test sessions, a trusted identity endpoint, and an owner-only synthetic fixture. Supply secrets through environment references, not plan files.

## Modes

| Mode | Available work |
| --- | --- |
| Review | Source, configuration, policy, and isolated project tests with synthetic data; no target traffic |
| Local | Bounded checks against an isolated loopback backend/emulator |
| Staging | Bounded checks against an explicitly scoped HTTPS staging origin |

If only production exists, BreakALeg continues in review mode. A staging database is insufficient if auth, storage, payments, email, or functions still point to production. Environment setup is never performed silently.

An app with no backend can still be reviewed and tested through its local application boundaries. Widget tests can reproduce application behavior with mocked platform services; they do not verify native biometrics, Keychain/Keystore, or release-device behavior.

## Try the local demo

From the repository root:

```sh
npm test
npm run test:installer
npm run demo
```

The demo starts two temporary loopback-only synthetic APIs, runs the same private-note check against a vulnerable and a secure implementation, writes reports under `.break-a-leg/demo/`, and closes both servers. It does not connect to a real app or database. It requires permission to bind a local port.

Expected outcome: the vulnerable fixture yields two findings (other-user and anonymous access); the secure fixture yields no issue observed for that one operation. The demo exits 0 when this expected comparison succeeds.

See the [vulnerable demo report](examples/demo-reports/vulnerable.md), [secure counterpart](examples/demo-reports/secure.md), and [source-only review](examples/source-review.md). A check can find a real issue and still have incomplete coverage; reports preserve both facts.

## Use the helper directly

```sh
node skills/break-a-leg/scripts/break-a-leg.mjs discover /path/to/app
node skills/break-a-leg/scripts/break-a-leg.mjs validate examples/local-api.plan.json
```

Validation is offline. The examples intentionally contain environment references rather than tokens. Adapt their origin, endpoint, fixture, and response pointer to your isolated service before using `run`. Full details: [runner guide](skills/break-a-leg/references/runner.md).

The runner records authorization assertions but cannot prove ownership or environment isolation. GET endpoints must be semantically read-only. It blocks redirects, does not retry, limits requests and response sizes, and stops target traffic on transport failure, 429, or 5xx. These bounds apply to its own requests, not arbitrary tools used by an agent. It is not a sandbox.

CLI exit codes: **0** means the configured checks completed without findings; **1** means findings with complete configured coverage; **2** means error or incomplete coverage, even when a finding was confirmed. None of these codes certifies the app as secure.

## Repository structure

```text
skills/break-a-leg/  Installable skill, references, and bundled helper
runner/             Canonical TypeScript runner source
schemas/            Canonical plan/report JSON schemas
scripts/            Bundling and no-overwrite installer
examples/           Plans and generated synthetic example reports
tests/              Behavioral tests and vulnerable/secure fixtures
evals/              Manual skill reasoning cases and separate grading rubrics
```

After editing runner source or schemas, run `npm run bundle`. Generated copies inside the skill are included so skill installation needs no build. `npm run check:bundle` checks for drift. Development-only type checking uses `npm ci --ignore-scripts` followed by `npm run typecheck`; the installed skill needs no packages. Contributor instructions are in [CONTRIBUTING.md](CONTRIBUTING.md).

The [local-first evaluation](evals/local-first/request.md) checks the agent's reasoning on a fictional source fixture. It is a manual evaluation, not an executable scanner test; provide its rubric only after the agent produces an assessment.

## What v0.1 does not promise

No security certification, App Store approval, exhaustive vulnerability detection, automatic remediation, production active testing, password guessing, load testing, or turnkey simulator/binary testing. No runtime finding is claimed when tools, credentials, fixtures, or backend access are missing.

The included tests exercise a synthetic HTTP service and discovery manifests. They do not establish live Firebase/Supabase integration coverage or native app runtime coverage. The framework guides remain useful without those services, and every assessment must disclose its actual evidence.

## License and reporting

[MIT](LICENSE). [Report a vulnerability privately](https://github.com/notsocj/break-a-leg/security/advisories/new), or see [SECURITY.md](SECURITY.md). Use ordinary issues for reproducible bugs and feature requests, without credentials or private assessment data. See [CHANGELOG.md](CHANGELOG.md) for release changes.
