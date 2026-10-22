# BreakALeg security rehearsal

Run: 4ae6a6d2-25aa-4a0e-92a3-2680cf869bba · Version: 0\.1\.1

Environment: local · Target: http://127\.0\.0\.1:49849

Started: 2026-10-22T18:24:36\.604Z · Commit: not recorded

Requests: 5 · Findings: 2 · Incomplete checks: 0

Evidence: 2 runtime reproduced; 0 source supported; 0 need verification.

This report covers only the listed fixtures and checks. No findings does not establish that the application is secure.

## Check coverage

| Check | Result | Complete | Explanation |
| --- | --- | --- | --- |
| owner-note | issue-found | yes | A caller outside the declared access policy received the synthetic private marker |

## Findings

### owner-note-other: Private fixture readable by another user

Severity: high · Evidence: runtime-reproduced

A caller outside the declared owner-only access policy retrieved the private synthetic fixture\. Assess the sensitivity of equivalent real records before final severity assignment\.

**Reproduction**

1. Use the original scoped plan and the two distinct test-user sessions\.
2. Confirm the owner can GET /notes/owner-note and the synthetic marker matches\.
3. Repeat the request as other; the same marker is returned\.

**Evidence**

- Owner identity and second-user identity were successfully checked and differ\.
- Owner response contained the configured synthetic marker\.
- other response also contained that exact marker; response bodies and credentials were not saved\.

Code locations: Not traced by the runner; the reviewing agent should locate the policy or handler.

Remediation: Enforce the intended owner or membership check on the server/database for this operation\. Trace the actual policy before selecting a code change\.

Retest: Rerun this plan against the same kind of private fixture\. The owner must retain access; unauthorized callers must not receive it\.

### owner-note-anonymous: Private fixture readable by an anonymous caller

Severity: high · Evidence: runtime-reproduced

A caller outside the declared owner-only access policy retrieved the private synthetic fixture\. Assess the sensitivity of equivalent real records before final severity assignment\.

**Reproduction**

1. Use the original scoped plan and the two distinct test-user sessions\.
2. Confirm the owner can GET /notes/owner-note and the synthetic marker matches\.
3. Repeat the request as anonymous; the same marker is returned\.

**Evidence**

- Owner identity and second-user identity were successfully checked and differ\.
- Owner response contained the configured synthetic marker\.
- anonymous response also contained that exact marker; response bodies and credentials were not saved\.

Code locations: Not traced by the runner; the reviewing agent should locate the policy or handler.

Remediation: Enforce the intended owner or membership check on the server/database for this operation\. Trace the actual policy before selecting a code change\.

Retest: Rerun this plan against the same kind of private fixture\. The owner must retain access; unauthorized callers must not receive it\.

## Observations

Response bodies, authorization headers, identity values, and fixture markers are intentionally omitted.

- owner-note / owner: HTTP 200; private marker matched: yes.
- owner-note / other: HTTP 200; private marker matched: yes.
- owner-note / anonymous: HTTP 200; private marker matched: yes.

## Limitations

- Only configured owner-only JSON read operations were probed; this is not a complete security assessment\.
- The operator must verify account roles, fixture ownership, target ownership, and environment isolation\. Configuration cannot prove these facts\.
- HTTP denials and an empty collection are narrow observations, not proof that no other data leaked\.
- No app binary, device behavior, write authorization, subscriptions, rate-limit strength, or deployed/local parity was automatically tested\.
- Response bodies are never persisted\. Keep the original plan and test fixture available for reproduction\.

## Cleanup

The runner created no remote resources\. Any separately seeded fixtures must be cleaned up using their recorded IDs\.
