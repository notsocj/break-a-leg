# Local app access and data lifecycle

Use this guide when the app stores sensitive data on-device or promises an app lock, encrypted backup, or complete deletion. Start with the documented threat and reachable production entry points. An intentionally disabled optional lock, a test-only memory store, or a planned feature is not itself a vulnerability.

## App lock is a state machine

Trace launch, preference loading, authentication, backgrounding, and resuming. Identify what stays mounted, visible, and actionable in each state.

- **Unknown settings:** Check pending reads and errors before the first successful settings value. Unknown lock state must not silently become an explicit user choice to disable protection. A test child rendering proves the gate opens; claiming actual financial records appear requires tracing their load timing too.
- **Authentication outcomes:** Separate success, denial/cancellation, unavailable support, and thrown platform errors. Follow recovery actions: disabling protection or exposing data must not become available merely because authentication failed. Device credential fallback can be legitimate when it actually authenticates.
- **Relock:** Keep a sensitive dialog, sheet, nested route, or export flow open while backgrounding and resuming. Hiding the home screen may leave a navigator overlay interactive. Test visibility and action completion, including callbacks that resume after the original widget is disposed.
- **Async completion:** Check whether an old successful authentication or confirmation can authorize an operation after a newer lock transition. Revalidate the session/state at the sensitive operation, rather than relying only on a previous prompt.

Use synthetic content and bounded widget/integration tests when available. Include denial that stays locked and a legitimate authenticated action as controls. Stub only platform dependencies or deliberately delayed/failing storage; exercise the real gate and actual sensitive screen/callback where possible. An artificial widget tree must match the production navigator placement before attributing a route bypass to the app.

Record the local-access preconditions. These are not remote account takeovers or proofs of a broken OS biometric system. Platform snapshots, biometric error triggers, native navigation, and device credential fallback need separate device verification.

## Delete the data the product promises to delete

Inventory app-owned stores independently: database and sidecars, secure-storage keys, preferences, imported files, temporary exports, restore staging files, caches, and queued work. Compare the deletion call chain with that inventory. Deleting a database key does not imply a separately stored provider credential or session was deleted.

Seed a synthetic value through the real save path, perform deletion through the application service, then inspect each relevant store through its ordinary read API. Check immediate post-deletion and restart behavior when the harness permits. A later onboarding flow clearing a credential does not establish that the earlier deletion completed. Keep exported files outside app control separate from files the app promises to remove.

Do not wipe a developer's real app container, Keychain, or shared preferences to prove this. Use temporary storage and platform mocks or a dedicated test instance. Report mocked storage semantics precisely; native storage behavior remains unverified until tested on the platform.

## Backup and encryption claims

Trace key generation/storage, the selected native database library, release configuration, backup payload, authentication failure, replacement/rollback, and temporary-file cleanup. A dependency name or key-setting pragma alone does not establish encryption; conversely, a plain in-memory test database does not establish that the production database is plaintext. Debug assertions are not release enforcement.

Use valid synthetic round trips and incorrect-password/tamper rejection as controls. For restore, check that validation precedes destructive replacement and that rollback preserves a usable database/key pair. Bound malformed inputs; do not allocate huge files or overwrite actual app data. Separate availability/robustness defects from proven confidentiality failures.

## Evidence and coverage

For an app with no implemented backend, server ownership checks can be `not-applicable` with an explicit source basis. Missing sources for a backend that does exist are `blocked`, not `not-applicable`.

Label executed local project tests as `runtime-reproduced` only for the behavior actually exercised, and name the harness, synthetic data, mocks, command, and outcome. Keep device and release-binary coverage separate. Passing a test that asserts a bypass reproduces a defect; it does not mean the control is secure. Proposed fix tests remain unexecuted until run against the fix.
