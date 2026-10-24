# Sign-in, sessions, and deep links

Use this guide when the app has accounts, social sign-in, magic links, deep links, push notifications, or account deletion. Start with how a session is created and which identity the backend trusts.

## Session and identity

Find where the backend reads the caller's identity: a verified JWT, a session cookie, or a value supplied by the client. A user ID in the request body, a query parameter, or a custom header is not an identity unless the server compares it with the verified session.

- **Anonymous sign-ins** (Supabase, Firebase) create real sessions. Check that policies and endpoints granted to "authenticated" users do not assume a verified email, a completed profile, or a paid plan.
- **Email confirmation** disabled lets someone sign up as an address they do not own. That matters when access depends on email domain, invitations, or matching an existing account by email.
- **Account linking** that merges accounts by unverified email can hand one user's data to another.
- Session tokens stored in plain preferences or logs belong in [storage.md](storage.md); judge them by the stated threat, not by default.

## OAuth, magic links, and deep links

- Redirect allowlists that accept wildcards or any URL let an attacker receive the code or token. Check the provider and backend settings, not only the client.
- Custom URL schemes (`myapp://auth-callback`) can be registered by another app on Android, and on iOS when universal links are not used. Prefer verified App Links/Universal Links for auth callbacks, and PKCE for OAuth code exchange.
- Deep-link handlers that perform an action (accept an invite, change an email, transfer data) need the same server authorization as the in-app path. Opening a link is not consent.
- Password-reset and magic-link tokens must be single-use, short-lived, and bound to the account.

## Account deletion and push

- Apple requires in-app account deletion for apps with account creation. Check that deletion removes or anonymizes server data, storage files, and third-party records the app promises to delete, and revokes sessions. Local-device deletion is covered in [local-data.md](local-data.md).
- Push notification tokens: check that one user cannot register a token to receive another user's notifications, and that notification payloads do not carry private data to a lock screen unexpectedly.

## Verification

Most of these are source findings. Runtime checks need the provider's test or sandbox configuration and isolated test accounts; never test against real users' accounts or inboxes. Record provider settings you could not see (dashboard-only configuration) as unverified.
