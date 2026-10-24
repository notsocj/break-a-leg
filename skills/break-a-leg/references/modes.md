# Environment selection

| Mode | Minimum inputs | Permitted work | Important limitation |
| --- | --- | --- | --- |
| Review | App sources, and backend/policies if available | Source analysis and isolated project tests with synthetic data; no target traffic | Mocked platform tests do not verify device behavior; missing backend code prevents server conclusions |
| Local | Explicit loopback origin and isolated backend/emulators, ordinary test accounts, synthetic fixture | Bounded requests, plus separately authorized local fixture setup | Local configuration may differ from deployed configuration |
| Staging | Explicit HTTPS origin, known project/environment, isolated accounts/data and external integrations | Bounded checks against the agreed endpoints | The name “staging” does not establish isolation |

If the only known backend is production, continue source review. Do not automatically contact it, even to “check” access. Resolving a URL from an app config is discovery, not permission to test it.

Review mode can include local unit/widget tests without inventing an HTTP target or provisioning staging. Keep `targetOrigin` null and `requestsMade` zero; describe the test harness separately. Classify nonexistent backend features as not applicable after tracing implementation; do not classify an existing but inaccessible backend that way.

Before an active run, record:

- Exact origin and selected paths. Only user-owned/authorized targets are in scope.
- Environment identity: project IDs, configuration selection/build flavor, and how local or staging isolation was established. Do not put secrets in this record.
- Test users' distinct identities and ordinary roles. A distinct ID does not prove a non-admin role.
- A synthetic private fixture belonging solely to the owner; no sharing relationship with the second user. Use a unique random marker unrelated to credentials.
- Whether APIs, auth, storage, functions, queues, analytics, email, payments, and AI services still point to production. Exclude any dependent endpoint whose effects are uncertain.
- The finite request budget, allowed endpoint semantics, and cleanup owner for separately created resources.

Ask about unresolved target or identity facts once, then continue within that scope. Do not ask a founder to create staging before offering a source review. Local setup is an option, not an automatic migration: require reproducible schema/rules and seed synthetic data instead of cloning production records.

The runner accepts local literal loopback or localhost (resolved to 127.0.0.1 or ::1 without DNS), and HTTPS staging origins. It does not follow redirects, trust environment HTTP proxy settings, or disable TLS verification. It uses one request at a time. Transport failure, deadline, response-size overflow, redirect, 429, or 5xx stops further target requests. An invalid baseline blocks that probe without converting it into a pass.

The runner enforces its own operations only. It cannot sandbox the agent, prove ownership, detect every privileged opaque token, or prevent a server-side GET from triggering a side effect. Strong containment requires the execution host's network/process controls.
