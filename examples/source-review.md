# BreakALeg security rehearsal

Run: b784c8d8-1bd2-4f73-9c38-3fd284b5d7f9 · Version: 0\.1\.0

Environment: review · Target: no runtime target

Started: 2026-10-22T18:14:32\.991037\+00:00 · Commit: not recorded

Requests: 0 · Findings: 1 · Blocked checks: 1

Evidence: 0 runtime reproduced; 1 source supported; 0 need verification.

This report covers only the listed fixtures and checks. No findings does not establish that the application is secure.

## Check coverage

| Check | Result | Explanation |
| --- | --- | --- |
| private-note-policy | issue-found | The deliberately vulnerable Supabase source fixture grants private-note reads to both ordinary and anonymous callers\. This is source evidence only\. |
| secure-policy-counterpart | no-issue-observed | The secure SQL fixture restricts SELECT to authenticated owners under its stated model\. This is a narrow source review; no deployed state or alternate access paths were verified\. |
| live-backend-runtime | blocked | No actual Supabase or Firebase service is part of this source-only example\. The generic HTTP demo is a separate result\. |
| native-device | skipped | Mobile fixtures are source snippets, not buildable apps or signed binaries\. |

## Findings

### source-private-notes: Unconditional policy permits reads of owner-only notes

Severity: high · Evidence: source-supported

Given the fixture’s declared private-note model, the SELECT grant and unconditional RLS policy would expose those records to anon and authenticated roles if deployed as shown\. No deployment was inspected\.

**Reproduction**

1. Inspect the alternative vulnerable SQL fixture and its SELECT grants\.
2. Compare the public\_read policy with the owner\_read policy in the secure counterpart\.
3. Proposed runtime test, not executed against Supabase: seed a synthetic note, verify its owner can read it, and assert an unrelated user and anonymous caller cannot\.

**Evidence**

- vulnerable\.sql grants SELECT to anon and authenticated and uses a true SELECT predicate\.
- The Flutter and React Native source snippets query the same conceptual notes endpoint; client filters cannot replace the database policy\.

Code locations: tests/fixtures/backends/supabase/vulnerable\.sql:4, tests/fixtures/backends/supabase/vulnerable\.sql:5

Remediation: For the declared owner-only model, restrict SELECT to the owner identity as illustrated by the secure counterpart; review all other applicable policies and grants\.

Retest: Run ordinary-user and anonymous access tests in an isolated Supabase project, including a successful owner baseline\. Not executed in this source review\.

## Observations

Response bodies, authorization headers, identity values, and fixture markers are intentionally omitted.


## Limitations

- Illustrative assessment of deliberately vulnerable and secure source fixtures, not a real customer app\.
- No commit is recorded because this source package has not been initialized as a Git repository\.
- No real database, mobile build, device, or deployed configuration was tested\.

## Cleanup

No target requests or remote data changes were made\.
