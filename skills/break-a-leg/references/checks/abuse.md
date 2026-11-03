# Abuse protection and AI guardrails

Use this guide when the app has endpoints that cost money or affect other people every time they run: AI calls, SMS or OTP codes, emails, password or code checks, and sign-ups. The question here is not "who can see this data" (see [authorization.md](authorization.md)) but **"what happens if someone calls this 10,000 times?"**

Founders usually discover these gaps as a surprise bill: an AI key drained overnight, thousands of SMS to premium numbers, or a sending domain flagged as spam.

## Start with the helper

`node <skill-dir>/scripts/break-a-leg.mjs limits <project-root>` finds server entry points (Next.js and Expo API routes, server actions, Supabase Edge Functions, Firebase Functions, Express/Hono/Fastify routes, FastAPI/Flask/Django views) that call an AI model, send SMS or email, or check passwords, and lists the ones with no recognizable rate limiter or per-user quota. It also flags AI calls without an output cap, a model name taken from the request, and Supabase phone sign-in without CAPTCHA.

Treat every lead as a place to look. Limits can live outside the code (API gateway, Vercel or Cloudflare firewall rules, Supabase dashboard settings). Entries under `guarded` only mean a limiter or quota name appears; confirm it actually runs before the costly call.

## What to check, by operation

| Operation | How it gets abused | What protects it |
| --- | --- | --- |
| SMS / phone OTP | Bots request codes to premium-rate numbers and the founder pays per text ("SMS pumping") | Per-phone and per-IP limits, CAPTCHA before sending, an allowlist of countries in the SMS provider, a low Supabase `sms_sent` limit |
| Email (invites, magic links, password reset, contact forms) | Spamming any address through your domain, which hurts deliverability for real users | Per-sender and per-recipient limits; the caller must not control the message body or links |
| Password and OTP checks | Guessing passwords; a 6-digit code has only a million values | Per-account and per-IP attempt limits, lockout or delay after failures, codes that expire |
| Sign-ups and anonymous sessions | Mass accounts to farm free credits or trials | CAPTCHA, email confirmation before credits, limits on anonymous sign-ins |
| AI calls | Running up the provider bill; using the app as a free general chatbot | Login, server-side per-user quota, output cap, fixed model, input length cap |
| Other expensive work (exports, image processing, PDF generation) | Exhausting compute or storage | Per-user limits and size caps |

Supabase Auth has built-in limits when the **app** calls it directly. A server route that calls `signInWithPassword` or `signInWithOtp` for the app changes that: every request now comes from the server's IP, so Supabase's per-IP limit either blocks all real users at once or is bypassed. Such routes need their own limit keyed by IP and email or phone.

## What good protection looks like

- **Runs on the server, before the costly call.** A disabled button or a countdown in the app is not a limit.
- **Keyed by user ID for signed-in users**, and by IP plus the target (email, phone) for anonymous ones. IP alone is weak: mobile carriers share IPs and attackers rotate them.
- **Stored somewhere shared**, such as Redis/Upstash, the database, or a platform limiter. A `new Map()` or LRU cache in a serverless or Edge function resets per instance and limits almost nothing.
- **Backed by provider caps**: an OpenAI/Anthropic project budget, Twilio geo permissions. These stop disaster but are not a per-user limit.

## AI guardrails: keeping the assistant on its job

An AI feature that answers anything turns the app into a free general chatbot paid for by the founder. Off-topic answers are mostly a **cost and brand** problem; they become a security problem when the model can call tools or see other users' data (see [ai-features.md](ai-features.md)).

A system prompt that says "only answer cooking questions" helps, but users can talk their way around it. Check for these layers, strongest first:

1. **Sign-in required**, or a very tight limit for anonymous use.
2. **Per-user quota enforced on the server** (messages or tokens per day), stored where the user cannot edit it.
3. **Output cap** (`max_tokens`) and a limit on input length and conversation history.
4. **Model fixed on the server**, never taken from the request.
5. **A narrow system prompt** that states the app's job and tells the model to decline everything else.
6. **Optional topic check** for apps where off-topic use is expensive: a cheap classifier or moderation call before the main model.
7. **Tools limited to the user's own data**, authorized as the end user.

## How serious is it?

- **Fix before launch**: AI, SMS, or email endpoints anyone can call without signing in and with no limit; public phone sign-in without CAPTCHA or limits; a custom password or OTP check with unlimited attempts; AI tools that can act on other users' data.
- **Fix soon**: signed-in AI endpoints without a per-user quota or output cap; a model chosen by the request; email sending limited only globally; a server route proxying Supabase sign-in without its own limit.
- **Good to know**: the assistant answers off-topic questions while quota and output caps already bound the cost; the system prompt can be revealed (unless it contains secrets, then it is a secrets finding).

Do not report "no rate limit" on endpoints that do nothing costly or harmful when repeated, such as signed webhooks, health checks, or cached public reads.

## Verifying

Source review settles most of these. For runtime evidence, use a local or staging environment with a test account and keep it small and finite:

- **Limits**: read the configured limit N from the code, send N+1 requests, and expect the last one to be blocked (often HTTP 429). Stop at the first block. This is a check that a limit exists, not a load test.
- **SMS and email**: use provider test credentials, sandbox modes, or test phone numbers. Never send to real numbers or addresses.
- **AI scope**: send at most five fixed off-topic prompts through the app's own endpoint and record whether it declined. Note that this spends tokens. Label the result `runtime-reproduced` only for the prompts actually sent.

Never run these against production, never loop until something breaks, and never use a real person's phone number or email. The bundled runner does not test rate limits; record these checks as project-specific tests.

## High-yield patterns

- An AI route checks the session but has no quota, so one account can spend the whole budget.
- The free-message counter lives on the device or in a database column the user can update.
- A limiter uses an in-memory store inside serverless or Edge functions.
- The limiter trusts a raw `x-forwarded-for` header outside a platform that sets it (Vercel and Cloudflare do; a bare Node server does not).
- Next.js middleware holds the limiter, but its `matcher` excludes `/api`.
- An OTP verify endpoint has no attempt limit, or codes never expire.
- Rate limiting is applied after the AI or SMS call, or only counts successful requests.
