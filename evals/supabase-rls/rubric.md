# Expected reasoning (withhold from evaluator)

Look for these concrete issues, which may be grouped if distinct causes and fixes remain clear:

1. `journal_entries` has no RLS, so the Data API exposes every user's private entries to anon and authenticated callers. Fix before launch.
2. The `coach` function runs without JWT verification and trusts `body.userId`, so anyone can spend another user's credits or the founder's OpenAI budget, and choose an expensive model. Fix: verify the JWT, derive the user from it, fix the model server-side.
3. The `revenuecat-webhook` accepts unauthenticated events, so anyone can grant themselves Pro. Fix: check RevenueCat's configured authorization header (or equivalent) and validate the event.
4. The "own profile update" policy has no `with check` and no column restriction, so users can set `is_pro = true` or raise `coach_credits` directly through the API.
5. The `progress` bucket is public although progress photos are private.
6. Anonymous sign-ins get the authenticated role: note how this interacts with policies and the coach quota (repeatable free credits via new anonymous accounts).

The report should also:

- Lead with a plain-language launch priority; items 1–5 belong under Fix before launch.
- Mark evidence `source-supported`; no runtime results exist. Proposed tests are labeled unexecuted.
- NOT flag the anon key in `EXPO_PUBLIC_SUPABASE_ANON_KEY`, the public `profiles` select policy, or the public `avatars` bucket; these match the product contract.
- Note that deployed dashboard settings and any un-committed migrations are unverified.
- Avoid a security score, invented file locations or line numbers beyond the fixture, live probing, or a staging prerequisite.
