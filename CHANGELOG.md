# Changelog

## 0.2.0 — 2026-10-25

### Finds more real issues

- The read probe now also searches the whole unauthorized JSON response for the exact synthetic marker. A private row returned at another position (for example the second item of another user's list) is reported as a finding instead of an inconclusive block. The owner baseline still requires the configured pointer.
- New offline `rls-audit` command: replays Supabase migrations and `config.toml` and lists leads for tables without RLS, `using (true)` / `with check (true)` policies, views without `security_invoker` and materialized views, exposed `security definer` functions, public storage buckets, identity-free storage policies, Edge Functions with `verify_jwt = false`, anonymous sign-ins, and disabled email confirmation. Custom exposed schemas and nested `supabase/` folders are supported.
- New offline `secrets` command: reports likely credentials (Supabase service-role/secret keys, Stripe, OpenAI, Anthropic, AWS, private keys, GitHub, Slack, SendGrid, Mapbox, FCM, named secret assignments) by type, file, line, and exposure hint, without ever printing values. Public Supabase anon/publishable keys and Firebase client keys are counted, not reported.
- Discovery detects Next.js, Express, Fastify, Hono, NestJS, tRPC, Convex, FastAPI/Django/Flask, Go, and Vapor backends; `@supabase/ssr`, Supabase migrations/functions without `config.toml`; `google-services.json` and `GoogleService-Info.plist`; Xcode workspaces, Podfiles, and Swift packages; and Capacitor. It adds `suggestedChecks` from payment, AI, local-storage, and sign-in dependencies.

### Skill guidance

- SKILL.md gains a "check the high-yield places first" pass and a broader trigger description covering how founders phrase the request.
- New check guides for sign-in/OAuth/deep links/account deletion (`auth-flows.md`) and AI features (`ai-features.md`).
- High-yield pattern sections for Supabase, Firebase, custom APIs, secrets, and paid features.
- Reports and reviews open with a plain-language launch priority: fix before launch, fix soon, good to know, not checked.

### Runner and installation

- Optional `accounts.cookieName` sends sessions as a named cookie for cookie-session APIs. Plan schema remains version 1; the field is optional.
- JWTs with an `admin` role or `admin`/`is_admin`/`isAdmin` claims are rejected as privileged.
- `localhost` in local mode resolves to both 127.0.0.1 and ::1 without DNS, so IPv6-only dev servers are reachable.
- `scripts/install.py --agent claude` installs into Claude Code's personal skills directory.
- Two new manual evaluations: a Supabase backend case and a false-positive restraint case.

## Repository maintenance after 0.1.2

- Add first-review, runner, report/troubleshooting, architecture, and maintainer guides with a README navigation index.
- Check repository-local Markdown file links in CI and add contributor issue/PR templates.
- Package only Git-tracked files, reject symlink paths and unsafe destinations, and clean up partial archives on failure. Add behavioral packaging tests; private untracked review files are excluded even outside the usual report directory.
- These repository maintenance changes follow v0.1.2; the published tag and helper capabilities are unchanged.

## 0.1.2 — 2026-10-24

- Add a local-data guide for app-lock loading/error states, authentication recovery, navigator overlays across relock, backup validation, and deletion across separate stores.
- Clarify that review mode can include isolated unit/widget tests without a backend or staging environment.
- Require local reproductions to disclose platform mocks, distinguish reproduction assertions from secure expectations, and preserve device verification gaps.
- Distinguish absent backend features and planned integrations from unavailable enforcement code.
- Add a fictional local-first evaluation case and withheld grading rubric; no private application code or findings are included.
- Runtime probe capabilities and report/plan schema versions are unchanged.

## 0.1.1 — 2026-10-23

- Preserve incomplete coverage when one actor reveals a private fixture but another actor's result is inconclusive. CLI exit status and Markdown now use explicit completeness instead of observation-count/text heuristics.
- Introduce report schema 2 with per-check `complete`; plan schema remains version 1.
- Add an explicit installer update command that stages the replacement, preserves the old skill outside the discovery directory, and restores it if the swap fails.
- Detect and remove obsolete generated runner/schema files during bundling.
- Add an offline `--version` command and a shared runtime version constant.
- Improve quickstart, examples, private vulnerability reporting, and release documentation.

## 0.1.0 — 2026-10-23

- Initial installable skill with Flutter, React Native/Expo, Swift/iOS, Kotlin/Android, and generic mobile guidance.
- Source-only, local, and staging workflows; staging is optional.
- Supabase, Firebase, and custom API review guides.
- Bounded runtime authorization-read probes, synthetic demo, schemas, and reports.
