# Manual Supabase backend evaluation

Give an evaluating agent the following request, the installed skill, and `fixture.txt`. Withhold `rubric.md` until evaluating its answer. This is a source reasoning exercise, not a runnable project or an automated CI test.

```text
Use BreakALeg to review the enclosed fictional Expo app and its Supabase backend before App Store submission. The fixture contains migrations, config, and pseudocode only; no live project, staging environment, or credentials are available. Identify concrete source-supported issues, rank them by what must be fixed before launch, propose bounded verification, and report coverage honestly. Do not invent runtime results.
```

Repeat this evaluation when changing the Supabase, paid-features, AI-features, or high-yield guidance. Grade with the rubric and record the evaluator/model and whether it saw the expected answers.
