# Entitlements and expensive operations

Identify the protected resource and its business rule. A local-only visual feature and a server operation costing money require different controls. Do not label every client-side subscription flag a high-severity vulnerability.

For remote paid operations, trace how the server obtains the caller's entitlement. Check trust in client-supplied `isPremium`, plan names, credits, role fields, prices, or arbitrary user IDs. Review provider callbacks/webhooks for authentic origin, correct user/product association, idempotency, expiry/revocation handling, and environment separation using the installed provider's documentation.

Use the project's subscription/payment sandbox for any runtime verification. Never perform a real purchase, replay a production receipt, or change real entitlements. Source review may establish a missing authorization check; runtime confirmation requires an isolated scenario with a known entitlement state.

For AI or other metered endpoints, inspect authentication, server-side quotas, and resource bounds. A small finite project test may check quota rejection; it cannot measure abuse resistance or infrastructure capacity. Do not run loops until a live service blocks you.

The bundled helper does not automatically test purchases, webhooks, or rate-limit strength. Provide concrete project-specific regression cases and explicitly record whether they ran.
