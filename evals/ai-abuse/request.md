# Manual AI abuse and rate-limit evaluation

Give an evaluating agent the following request, the installed skill, and `fixture.txt`. Withhold `rubric.md` until evaluating its answer. This is a source reasoning exercise, not a runnable project or an automated CI test.

The fixture is a fictional Expo recipe app with a Next.js API and Supabase. Its defects are about abuse, not data access: endpoints that cost money or affect other people each time they run, and an AI assistant whose only scope control is its prompt. It has no comments pointing at the defects and includes decoys that look unprotected but are fine.

```text
Use BreakALeg to review the enclosed fictional Expo app, its Next.js API, and its Supabase config before launch. The fixture contains config and pseudocode only; no live project, staging environment, or credentials are available. Identify concrete source-supported issues, rank them by what must be fixed before launch, propose bounded verification, and report coverage honestly. Do not invent runtime results.
```

For a baseline without the skill, remove "Use BreakALeg to" and start the request with "Review". Repeat this evaluation when changing the abuse, AI-features, paid-features, or `limits` guidance. Grade with the rubric and record the evaluator/model and whether it saw the expected answers.
