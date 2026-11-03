# Changelog

## 0.3.0 — 2026-11-03

### New: abuse protection and AI guardrails

- New offline `limits` command. It lists server entry points (Next.js and Expo API routes, server actions, Supabase Edge Functions, Firebase Functions, Express/Hono/Fastify routes, FastAPI/Flask/Django views) that call an AI model, send SMS or email, or check passwords or promo codes without a recognizable rate limiter or per-user quota. It also flags AI calls without an output cap or with a model taken from the request, and Supabase phone sign-in without CAPTCHA. Providers are recognized by import or call shape; local imports are followed one level. Endpoints where a limiter or quota name appears are listed as `guarded` for the agent to confirm. Exits 1 when it reports leads.
- New check guide `abuse.md`: rate limits for AI, SMS/OTP, email, password checks, and sign-ups; what working protection looks like (server-side, keyed by user, shared store); AI guardrails that keep an assistant on its job; severity guidance; and small finite verification instead of load testing.
- `ai-features.md` gains a "Staying on topic" section. SKILL.md adds "endpoints anyone can repeat" to the high-yield first pass, and `discover` suggests the abuse guide for AI, SMS, and email dependencies.

### Finds more real issues in Supabase and Firebase

- `rls-audit`: new leads for signed-in-only policies (`auth.uid() is not null`, `auth.role() = 'authenticated'`), policies reading `user_metadata`, and insert/update policies on tables with entitlement columns (`is_pro`, credits, role, plan) that no column grant restricts. `DROP POLICY` and `ALTER POLICY` are now replayed, so removed or tightened policies are no longer reported. Lead text no longer assumes Supabase's old default table grants.
- `rls-audit`: skip the writable-entitlement-columns lead when the write policy is admin-gated (for example `is_org_admin(...)`), and accept membership helpers such as `is_org_member(...)` as an identity check in storage policies. A storage policy whose only identity check is `auth.role() = 'authenticated'` is now reported.
- Supabase guide: flag `user_metadata` in policies, and describe Supabase's 2026 Data API grant change instead of the old default-grant statement.
- Firebase guide: flag test-mode expiry rules, Realtime Database cascading grants, and roles read from user-writable documents.

### Reports

- An area that could not be inspected is listed under Not checked ("check first"), never ranked as a finding.

### Evaluations

- Three new manual evaluations: multi-tenant Supabase, Firebase marketplace, and AI abuse, each with six unlabelled defects and contract-matching decoys.
- Recorded agent runs with and without the skill in VERIFICATION.md: Opus on all six cases, Haiku on five. Every run found every defect; the skill's measured effect is fewer false alarms and clearer reports.

### Documentation

- README rewritten around the problem it solves, with a quick start, an example report, and light/dark infographics. `check_docs.py` also verifies HTML image paths.

### Compatibility

- Plan schema 1 and report schema 2 are unchanged. Existing plans and reports remain valid. No new runtime dependencies; Node 22.18+ is still required for the helper.

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
