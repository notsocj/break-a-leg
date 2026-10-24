# Getting started

BreakALeg helps a coding agent review a mobile app, investigate specific security hypotheses, and produce findings you can reproduce. The agent reads source and chooses relevant tests. The optional command-line helper discovers stacks and runs one narrow class of backend authorization checks.

You can start with a repository alone. Staging, test accounts, a mobile simulator, and a separate model API key are not required for source review.

## 1. Choose your starting point

| What you have | Start here | What you can establish |
| --- | --- | --- |
| Mobile app source only | Review mode | Reachable client behavior; missing backend/device coverage stays explicit |
| A local-first app | Review mode plus isolated project tests | App-lock transitions, local storage, backup and deletion behavior |
| App and backend source | Review both repositories | Trace a mobile action to server/database enforcement |
| An isolated local backend or emulator | Review, then local tests | Reproduce selected behavior with synthetic users and data |
| A known isolated staging system | Review, then scoped staging tests | Verify selected read-access boundaries against that environment |
| Production only | Review mode | Useful source findings; BreakALeg does not actively test production |

Flutter, React Native/Expo, Swift/iOS, and Kotlin/Android have dedicated review guides. Other mobile stacks use generic guidance. Supabase, Firebase, and custom APIs have backend guides. This means guided review support, not automatic end-to-end testing of every stack.

## 2. Install the complete skill

You need an agent that can read your app repository. The provided installer needs Python 3; the helper needs Node 22.18+ (Node 24 LTS recommended). Git is needed for the clone commands. The installed helper has no npm dependencies.

From a terminal, choose a location for the BreakALeg repository:

```sh
git clone https://github.com/notsocj/break-a-leg.git
cd break-a-leg
python3 scripts/install.py
```

This installs the entire `skills/break-a-leg` directory for Codex at `$CODEX_HOME/skills/break-a-leg`, or `~/.codex/skills/break-a-leg` if `CODEX_HOME` is unset. It refuses an existing installation unless you explicitly use `--update`.

For Claude Code, install to your personal skills directory (`~/.claude/skills/break-a-leg`):

```sh
python3 scripts/install.py --agent claude
```

For a custom destination:

```sh
python3 scripts/install.py --skills-dir /path/to/skills
```

If Python is unavailable, copy the entire `skills/break-a-leg` directory to your agent's skill directory. Copying only `SKILL.md` omits the references and helper. Codex and Claude Code are the documented installation targets; other agents' discovery conventions have not been verified.

Open a new Codex or Claude Code session in your app repository if the installed skill is not visible. In Claude Code, invoke it as `/break-a-leg` or ask for a pre-launch security review; in Codex, use `$break-a-leg`. These shell examples use POSIX-style paths; adjust your Python executable and paths for your host. Local validation uses macOS and CI uses Linux.

## 3. Run your first review

In your app's coding-agent chat, use this request:

```text
Use $break-a-leg to review this mobile app and any backend code available in the workspace. Begin with source analysis. Identify the implemented sensitive workflows, prioritize concrete security issues, and use isolated project tests with synthetic data where they can verify a hypothesis. Staging is optional. Before sending target requests, resolve the exact environment and any missing scope or test-account facts. Keep application code unchanged during the review. Save findings privately, distinguish source evidence from executed tests, and list missing device/backend coverage. Include impact, source locations, reproduction steps, remediation, and a proposed retest for each finding.
```

If the backend lives elsewhere, give its repository path in the same request. Useful context includes which data is private/shared, expected user roles, and the workflows you care about. Do not paste passwords, provider keys, session tokens, or production records into the request.

The expected workflow is:

1. Read project instructions and identify app/backend roots.
2. Map sensitive implemented flows and select review/local/staging mode.
3. Check the high-yield places first (database rules, client keys, entitlements, server endpoints, sign-in), then trace concrete hypotheses through their enforcement points.
4. Run bounded synthetic tests where tools and scope permit.
5. Deliver findings, evidence levels, coverage gaps, and cleanup status.

This is not an instruction to run a fixed payload catalog. An app without accounts should not be forced into a two-user backend test. Missing staging should not block source review.

## 4. Keep your assessment private

Store reports outside the app repository, or in its ignored `.break-a-leg/` directory. Add that directory to the app's ignore rules before writing reports there; BreakALeg does not automatically modify your project's configuration.

The helper's outputs are `report.json` and `report.md`. Agent analysis belongs in separate `review.json` / `review.md` files so it does not overwrite raw evidence. Source-only reviews can produce reviewed reports without running the helper.

Reports omit credentials and private response bodies, but still describe weaknesses. Do not upload them to public issues or commit them with application code. Your coding agent's own model connection and data-handling settings still apply.

## 5. Read the result and choose the next step

Start with the finding's impact, preconditions, and evidence level. `runtime-reproduced` in a widget test does not mean a physical device was tested. A completed narrow check does not mean the app is secure.

Use [reports and troubleshooting](reports-and-troubleshooting.md) to interpret statuses and failures. Ask for focused fixes separately, then rerun the failing scenario and its legitimate baseline. The skill does not automatically patch the app, rotate keys, or deploy policies.

## Update, pin, or remove

To follow the latest repository changes, update a clean checkout and explicitly update the installation:

```sh
git pull --ff-only
python3 scripts/install.py --update
```

The previous installation is preserved under `skill-backups/` beside the skills directory, including local modifications. Read the printed backup path. Inspect local changes before pulling; do not discard them just to update.

For a tagged snapshot such as v0.1.2, make a separate checkout:

```sh
git clone --branch v0.1.2 --depth 1 https://github.com/notsocj/break-a-leg.git break-a-leg-v0.1.2
cd break-a-leg-v0.1.2
python3 scripts/install.py
```

Use `--update` instead if replacing an existing installed skill. Tagged code is reproducible; `main` may also contain subsequent documentation and maintainer changes.

To remove the skill, locate the installation's exact `break-a-leg` directory and remove it after preserving any customizations. This does not remove your reports, source checkout, or installation backups. To roll back, preserve the current installation and restore the specific backup directory to the original skill location.
