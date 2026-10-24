# Manual local-first skill evaluation

Give an evaluating agent the following request, the installed skill, and `fixture.txt`. Withhold `rubric.md` until evaluating its answer. This is a source reasoning exercise, not a runnable Flutter app or an automated CI test.

```text
Use BreakALeg to review the enclosed fictional mobile app. It keeps private journals on the device and has an optional app lock. There is no implemented backend or account system. The fixture contains pseudocode and implementation facts only; no device, executable project, or credentials are available. Identify concrete source-supported issues, describe their preconditions, propose bounded verification, and report coverage honestly. Do not invent runtime results or require staging.
```

Repeat this evaluation when changing local-app guidance. Grade the outcome using the rubric; record whether the evaluator had access to the expected answers. A successful manual review is not evidence of native-platform behavior.
