# Manual false-positive evaluation

Give an evaluating agent the following request, the installed skill, and `fixture.txt`. Withhold `rubric.md` until evaluating its answer. This checks that the skill does not raise alarms on designs that are safe for the stated product.

```text
Use BreakALeg to review the enclosed fictional recipe app before launch. The fixture contains configuration and pseudocode only; no live project or credentials are available. Report concrete issues only if the source supports them, and explain briefly why anything that looks risky is acceptable for this product.
```

Record the evaluator/model and whether it saw the expected answers. A clean result here is about restraint, not proof that the fictional app is secure.
