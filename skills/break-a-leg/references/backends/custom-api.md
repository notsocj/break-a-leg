# Custom APIs

Locate route definitions, middleware, controllers/resolvers, data access, and deployed configuration if available. Map the actual identity/role mechanism. OpenAPI or GraphQL schemas describe shapes, not authorization guarantees.

Trace each selected sensitive operation from identity verification through object ownership/membership to the database/storage query. Distinguish UI checks from server controls. Evaluate tenant IDs, role claims, ownership changes, pagination, exports, and alternate endpoints where reachable.

For bundled probes choose semantically read-only bearer-authenticated JSON GET endpoints plus a trusted identity endpoint. Account for gateway prefixes. Scope exactly one origin per plan; separate services require separate explicit scope. Redirects are not followed, even within that origin.

For cookie sessions, GraphQL POST, RPC, uploads, or writes, use an existing isolated project test harness with bounded operations and documented cleanup. These are not implemented by the generic runner. Check authentication versus query failures rather than counting every error as a successful denial.

Private JSON markers establish a narrow reproduced leak only when the fixture is owner-only and the second account has no legitimate sharing or admin relationship. If those rules are unknown, record a hypothesis and ask for the intended access rule.

## High-yield patterns

- Route handlers or server actions (Next.js, Express, Hono, FastAPI) that load a record by ID without checking it belongs to the caller: `GET /api/notes/:id`, `PATCH /api/users/:id`.
- A user ID, role, or plan read from the request body, query, or a client header instead of the verified session.
- Middleware that protects pages but not the matching API routes, or a matcher that misses some paths.
- Webhook endpoints (Stripe, RevenueCat, Lemon Squeezy, Polar) that update entitlements without verifying the signature against the raw body.
- Endpoints that call an AI or other metered provider with no authentication or per-user limit (see [ai-features.md](../checks/ai-features.md)).
- For cookie-session APIs, the runner accepts `accounts.cookieName` so the same read probe works without bearer tokens.
