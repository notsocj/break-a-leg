# BreakALeg

**Give your app a security rehearsal before launch.**

[![Verify BreakALeg](https://github.com/notsocj/break-a-leg/actions/workflows/test.yml/badge.svg)](https://github.com/notsocj/break-a-leg/actions/workflows/test.yml)

BreakALeg is an open-source agent skill for mobile founders. It reviews an app and its backend, investigates security weaknesses, and verifies selected issues against local or staging services when available. Staging is optional: a source review is a useful first run.

Version **0.2.0 — early release**. MIT licensed. No telemetry, hosted account, or separate model API key is required by this package. Your coding agent's own model connection and data handling still apply.

## Start here

| Goal | Guide |
| --- | --- |
| Install and run a first review, with or without staging | [Getting started](docs/getting-started.md) |
| Try the demo or configure a bounded API check | [Runner walkthrough](docs/runner-walkthrough.md) |
| Understand findings, incomplete coverage, or an error | [Reports and troubleshooting](docs/reports-and-troubleshooting.md) |
| Understand supported checks and their limits | [Coverage contract](skills/break-a-leg/references/coverage.md) |
| Understand the implementation or add a capability | [Architecture](docs/architecture.md) · [Contributing](CONTRIBUTING.md) |
| Validate, package, and publish a version | [Maintainer guide](docs/maintaining.md) |
| Inspect validation and version history | [Verification](VERIFICATION.md) · [Changelog](CHANGELOG.md) |

An agent performs the review; `discover` only identifies candidate stacks. The helper does not independently audit your app. Start with the first guide if you are new to agent skills.

## What you get

- Stack-specific review guides for Flutter, React Native/Expo, Swift/iOS, and Kotlin/Android, plus generic guidance for other mobile stacks.
- Backend guides for Supabase, Firebase, and custom APIs.
- Checks covering ownership/roles, credential exposure, server validation, storage, paid features, and expensive endpoints.
- Local-first checks for app-lock transitions, sensitive dialogs, encrypted backups, and deletion across device stores.
- A "high-yield first pass" that sends the agent to where founder apps usually break: database rules, client keys, entitlements, unauthenticated server functions, and sign-in edges.
- Guides for sign-in/OAuth/deep links/account deletion and for AI features (provider keys, cost limits, prompt injection into tools).
- A zero-dependency TypeScript helper with offline stack discovery, a Supabase `rls-audit`, a `secrets` scan that never prints values, plan validation, and bounded cross-user/anonymous JSON read probes (bearer or cookie sessions).
- Reports that open with a plain-language launch priority: fix before launch, fix soon, good to know, not checked.
- Markdown and JSON reports distinguishing reproduced issues, source evidence, blocked checks, and untested areas.

**Coverage is explicit.** The skill guides the agent's reasoning; it is not an exhaustive automated scanner. The runtime helper currently verifies only configured owner-only JSON reads with bearer or cookie sessions and a trusted identity endpoint. `rls-audit` and `secrets` are static lead finders, not proof of exposure. Firebase runtime verification uses the project's own emulator harness; there is no bundled Firebase SDK adapter. Device automation and binary analysis are not included. See the [coverage contract](skills/break-a-leg/references/coverage.md).

## Install

Clone the repository and install for your agent. The installer copies the **entire** self-contained `skills/break-a-leg` folder, including its helper runtime and schemas, and refuses to overwrite an existing installation:

```sh
git clone https://github.com/notsocj/break-a-leg.git
cd break-a-leg
python3 scripts/install.py                 # Codex: $CODEX_HOME/skills or ~/.codex/skills
python3 scripts/install.py --agent claude  # Claude Code: ~/.claude/skills
```

Start a new chat or session if the skill is not discovered in the current one. In Claude Code, run `/break-a-leg` or just ask for a pre-launch security review. In Codex, invoke it with a single request:

```text
Use $break-a-leg to review this app and backend before launch. Start with source analysis. Use an existing local or staging environment only when its target, test accounts, and scope are clear. Report reproduced issues separately from source-supported findings and checks you could not run.
```

To update an installed copy after pulling a newer version, run `python3 scripts/install.py --update`. It stages the replacement before changing the installed skill and preserves the previous copy, including local edits, under `skill-backups/` next to the skills directory. The installer prints the exact backup path. `--skills-dir /path/to/skills` supports a custom installation location.

For another agent supporting the same skill-folder format, copy the folder into that agent's documented skill location, or pass `--skills-dir`. Installation is documented for Codex and Claude Code; no universal cross-agent installer is claimed.

## Requirements

- Source review: an agent that can inspect your repository. Mobile SDKs and staging are optional.
- Installer: Python 3.8+; manual copying is also supported. The clone workflow needs Git. Repository maintenance uses Python for docs, packaging, and tests.
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
npm run test:python
npm run demo
```

The demo starts two temporary loopback-only synthetic APIs, runs the same private-note check against a vulnerable and a secure implementation, writes reports under `.break-a-leg/demo/`, and closes both servers. It does not connect to a real app or database. It requires permission to bind a local port.

Expected outcome: the vulnerable fixture yields two findings (other-user and anonymous access); the secure fixture yields no issue observed for that one operation. The demo exits 0 when this expected comparison succeeds.

See the [vulnerable demo report](examples/demo-reports/vulnerable.md), [secure counterpart](examples/demo-reports/secure.md), and [source-only review](examples/source-review.md). A check can find a real issue and still have incomplete coverage; reports preserve both facts.

## Use the helper directly

```sh
node skills/break-a-leg/scripts/break-a-leg.mjs discover /path/to/app
node skills/break-a-leg/scripts/break-a-leg.mjs secrets /path/to/app
node skills/break-a-leg/scripts/break-a-leg.mjs rls-audit /path/to/app
node skills/break-a-leg/scripts/break-a-leg.mjs validate examples/local-api.plan.json
```

`discover`, `secrets`, `rls-audit`, and `validate` are offline. `secrets` reports credential type and location only, never the value; `rls-audit` replays Supabase migrations and `config.toml` and lists access-control leads. Both exit 1 when they have something to review. The examples intentionally contain environment references rather than tokens. Adapt their origin, endpoint, fixture, and response pointer to your isolated service before using `run`. Full details: [runner guide](skills/break-a-leg/references/runner.md).

The runner records authorization assertions but cannot prove ownership or environment isolation. GET endpoints must be semantically read-only. It blocks redirects, does not retry, limits requests and response sizes, and stops target traffic on transport failure, 429, or 5xx. These bounds apply to its own requests, not arbitrary tools used by an agent. It is not a sandbox.

`run` exit codes: **0** means the configured checks completed without findings; **1** means findings with complete configured coverage; **2** means error or incomplete coverage, even when a finding was confirmed. None of these codes certifies the app as secure.

## Repository structure

```text
skills/break-a-leg/  Installable skill, references, and bundled helper
runner/             Canonical TypeScript runner source
schemas/            Canonical plan/report JSON schemas
scripts/            Bundling and no-overwrite installer
examples/           Plans and generated synthetic example reports
docs/               User walkthroughs, troubleshooting, and maintainer guides
tests/              Behavioral tests and vulnerable/secure fixtures
evals/              Manual skill reasoning cases and separate grading rubrics
```

After editing runner source or schemas, run `npm run bundle`. Generated copies inside the skill are included so skill installation needs no build. `npm run check:bundle` checks for drift. Development-only type checking uses `npm ci --ignore-scripts` followed by `npm run typecheck`; the installed skill needs no packages. Contributor instructions are in [CONTRIBUTING.md](CONTRIBUTING.md).

`npm run check:docs` verifies local Markdown file links. `npm run test:python` covers installation and archive packaging; `npm run test:installer` runs only the installer cases. The maintainer packager selects Git-tracked files rather than arbitrary local files.

Three manual evaluations check the agent's reasoning on fictional fixtures: [local-first](evals/local-first/request.md), [Supabase backend](evals/supabase-rls/request.md), and [false positives](evals/false-positives/request.md). They are not executable scanner tests; provide each rubric only after the agent produces an assessment.

## What BreakALeg does not promise

No security certification, App Store approval, exhaustive vulnerability detection, automatic remediation, production active testing, password guessing, load testing, or turnkey simulator/binary testing. No runtime finding is claimed when tools, credentials, fixtures, or backend access are missing.

The included tests exercise a synthetic HTTP service and discovery manifests. They do not establish live Firebase/Supabase integration coverage or native app runtime coverage. The framework guides remain useful without those services, and every assessment must disclose its actual evidence.

## License and reporting

[MIT](LICENSE). [Report a vulnerability privately](https://github.com/notsocj/break-a-leg/security/advisories/new), or see [SECURITY.md](SECURITY.md). Use ordinary issues for reproducible bugs and feature requests, without credentials or private assessment data. See [CHANGELOG.md](CHANGELOG.md) for release changes.
