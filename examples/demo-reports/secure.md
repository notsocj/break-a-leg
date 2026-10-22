# BreakALeg security rehearsal

Run: 32451b35-2907-4da2-be9f-6f3e54a1f71f · Version: 0\.1\.1

Environment: local · Target: http://127\.0\.0\.1:49861

Started: 2026-10-22T18:24:36\.814Z · Commit: not recorded

Requests: 5 · Findings: 0 · Incomplete checks: 0

Evidence: 0 runtime reproduced; 0 source supported; 0 need verification.

This report covers only the listed fixtures and checks. No findings does not establish that the application is secure.

## Check coverage

| Check | Result | Complete | Explanation |
| --- | --- | --- | --- |
| owner-note | no-issue-observed | yes | The owner baseline succeeded and both unauthorized attempts were denied or returned an empty collection; only this fixture and operation were tested |

## Findings

No findings were recorded for these checks. Review blocked checks and limitations.

## Observations

Response bodies, authorization headers, identity values, and fixture markers are intentionally omitted.

- owner-note / owner: HTTP 200; private marker matched: yes.
- owner-note / other: HTTP 403; private marker matched: no.
- owner-note / anonymous: HTTP 401; private marker matched: no.

## Limitations

- Only configured owner-only JSON read operations were probed; this is not a complete security assessment\.
- The operator must verify account roles, fixture ownership, target ownership, and environment isolation\. Configuration cannot prove these facts\.
- HTTP denials and an empty collection are narrow observations, not proof that no other data leaked\.
- No app binary, device behavior, write authorization, subscriptions, rate-limit strength, or deployed/local parity was automatically tested\.
- Response bodies are never persisted\. Keep the original plan and test fixture available for reproduction\.

## Cleanup

The runner created no remote resources\. Any separately seeded fixtures must be cleaned up using their recorded IDs\.
