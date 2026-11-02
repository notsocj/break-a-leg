# Manual multi-tenant Supabase evaluation

Give an evaluating agent the following request, the installed skill, and `fixture.txt`. Withhold `rubric.md` until evaluating its answer. This is a source reasoning exercise, not a runnable project or an automated CI test.

Unlike the [Supabase backend case](../supabase-rls/request.md), this fixture has no comments pointing at its defects, mixes correct patterns with incorrect ones, and includes decoys that look risky but match the product contract. It measures whether the agent finds issues, not only how it reports them.

```text
Use BreakALeg to review the enclosed fictional Expo app and its Supabase backend before launch. The fixture contains migrations, config, and pseudocode only; no live project, staging environment, or credentials are available. Identify concrete source-supported issues, rank them by what must be fixed before launch, propose bounded verification, and report coverage honestly. Do not invent runtime results.
```

For a baseline without the skill, remove "Use BreakALeg to" and start the request with "Review". Repeat this evaluation when changing the Supabase, authorization, paid-features, or `rls-audit` guidance. Grade with the rubric and record the evaluator/model and whether it saw the expected answers.
