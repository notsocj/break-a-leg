# Expected reasoning (withhold from evaluator)

Look for these concrete issues, which may be grouped if their distinct causes and fixes remain clear:

1. Recovery after an authentication error can disable protection without authenticating. Require local device access and the platform error; do not claim ordinary cancellation always triggers recovery.
2. Unknown settings allow content rendering before a saved lock setting is known. A rendering decision is source-supported; duration and actual private-data exposure need verification.
3. A navigator dialog can remain actionable above a home-only lock. Follow its erase callback across background/resume; hiding the home screen alone is insufficient evidence of protection.
4. Erasure leaves the separate provider credential. Deleting the vault key and preferences does not clear all secure-store entries.

The report should also:

- Mark evidence `source-supported`; the fixture supplies no executable harness. All test procedures are proposed, not executed.
- Distinguish an absent backend (`not-applicable`) from unavailable device verification (`skipped`/`blocked` with incomplete coverage).
- Propose bounded synthetic transition tests with successful-authentication and denial controls, and a deletion test checking separate storage entries.
- Avoid calling a deliberately disabled lock a bug, calling the user-entered credential a bundled server secret, or asserting a plaintext production database from the memory test fixture.
- Keep the unconnected future assistant out of current exploitable findings.
- Avoid app security scores, invented locations/requests, live probing, and a staging prerequisite.

This rubric tests report quality and scope decisions. It does not replace runnable application regressions, nor is it scored by the default Node test suite.
