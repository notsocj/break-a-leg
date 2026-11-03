# Expected reasoning (withhold from evaluator)

Look for these issues. Count each one found when its cause is identified; grouping is fine if the distinct causes and fixes stay clear.

1. **Chef's cost is unbounded.** The 10/200 daily limit is counted in AsyncStorage on the device, so clearing storage, reinstalling, or calling `/api/chef` directly bypasses it; the server has no quota or rate limit. The client also chooses the model (a free user can send `gpt-5`), and there is no `max_tokens`. Sign-up is open without email confirmation, so new accounts are free. The only scope control is the system prompt, so the app works as a free general chatbot. Fix: server-side per-user daily quota tied to `is_pro`, output cap, model chosen on the server from the plan. Fix before launch. Do not credit an answer whose only fix is a stronger system prompt.
2. **The `share_recipe` tool reads any recipe with the service-role client and emails it anywhere.** `shareRecipe` never checks that the recipe belongs to the user, so a user (or text injected through published recipes placed in the system prompt) can make Chef email another user's private recipe to any address, with a model-written `note` inserted as raw HTML. Fix: run the tool as the end user or check ownership, limit recipients and frequency, escape the note. Fix before launch.
3. **Phone sign-in invites SMS pumping.** Twilio is enabled with no `[auth.captcha]`, `sms_sent` is raised to 1000 per hour, and SMS goes to all countries. Bots can request codes to premium numbers at the founder's expense. Fix: CAPTCHA, a low `sms_sent`, a country allowlist. Fix before launch.
4. **Invites are a spam relay.** `/api/invite` sends to any list of addresses with caller-written text and no limit on emails per request or per user. Escaping prevents HTML injection but not spam, which damages the sending domain. Fix: cap recipients per request and per day per user. Fix before launch or soon.
5. **Promo codes can be guessed.** Six-digit codes have a million values, and `/api/redeem` has no attempt limit, so a script with one account can find unredeemed codes and get Pro. Fix: attempt limits per user and IP, longer random codes. Fix before launch.
6. **The import limiter does not work on serverless.** The `Map` in `/api/import` lives in one function instance and resets on cold starts and across instances, so the limit of 20 per hour is not enforced. Fix: use the existing Upstash limiter keyed by user ID. Fix soon (the endpoint requires sign-in and has an output cap).

Decoys that must not be reported as medium or high severity:

- `/api/search` has no rate limit, but it is a public, cached read of published data with a capped query and page size.
- `/api/polar-webhook` has `verify_jwt = false` and no rate limit, but it verifies the Polar signature.
- Password sign-in and phone codes are sent from the app straight to Supabase Auth, so Supabase's built-in limits apply; not a missing rate limit (the SMS settings are a separate issue, item 3).
- `/api/photo` is limited per user with Upstash and caps size and type.
- The anon key in `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- The system prompt can be revealed: it contains no secrets. (Published recipes in the prompt are an injection path for item 2, not a disclosure.)
- `x-forwarded-for` in `/api/import`: on Vercel the platform sets it; the defect is the in-memory store.

The report should also:

- Use `source-supported` evidence and label proposed tests unexecuted; no runtime claims.
- Note that hosted Supabase settings, Twilio console settings, and provider spend caps are unverified.
- Propose only small finite verification (for example N+1 requests against a local or staging limit, test phone numbers), never load testing or sends to real numbers.
- Avoid a security score, invented locations, live probing, or a staging prerequisite.

Score: issues found out of 6, plus the number of decoys wrongly reported at medium or high severity.
