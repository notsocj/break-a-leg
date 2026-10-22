# Custom APIs

Locate route definitions, middleware, controllers/resolvers, data access, and deployed configuration if available. Map the actual identity/role mechanism. OpenAPI or GraphQL schemas describe shapes, not authorization guarantees.

Trace each selected sensitive operation from identity verification through object ownership/membership to the database/storage query. Distinguish UI checks from server controls. Evaluate tenant IDs, role claims, ownership changes, pagination, exports, and alternate endpoints where reachable.

For bundled probes choose semantically read-only bearer-authenticated JSON GET endpoints plus a trusted identity endpoint. Account for gateway prefixes. Scope exactly one origin per plan; separate services require separate explicit scope. Redirects are not followed, even within that origin.

For cookie sessions, GraphQL POST, RPC, uploads, or writes, use an existing isolated project test harness with bounded operations and documented cleanup. These are not implemented by the generic runner. Check authentication versus query failures rather than counting every error as a successful denial.

Private JSON markers establish a narrow reproduced leak only when the fixture is owner-only and the second account has no legitimate sharing or admin relationship. If those rules are unknown, record a hypothesis and ask for the intended access rule.
