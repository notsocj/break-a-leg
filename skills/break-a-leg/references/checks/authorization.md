# Ownership, membership, and privileges

Write the intended access rule first: actor, action, object, and allowed relationship. Public, shared, family, organization, and admin features may have different rules. A guessed owner-only rule creates false positives.

Trace caller-controlled record/tenant/owner IDs and role fields to server enforcement. Authentication is insufficient when the resource belongs to another user. A filtered mobile query does not enforce backend ownership. Conversely, missing application checks are not a finding if database rules reliably enforce the same boundary.

Runtime read test: use the private synthetic owner fixture, confirm the owner baseline, then request it using an unrelated ordinary session and anonymously. Require recognizable private data, not just HTTP 200, to confirm exposure. The bundled runner automates this narrow test.

For mutation tests, use disposable data and the project's test harness. Check cross-user update/delete, owner reassignment, and protected role fields. Verify post-request state because an error alone does not prove no mutation occurred. These tests are not executed by the bundled helper.

Report the missing control, affected operation, and practical impact. Tie remediation to the actual server handler, policy, or rules file. Retest both the unauthorized action and legitimate user workflow.
