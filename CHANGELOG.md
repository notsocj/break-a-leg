# Changelog

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
