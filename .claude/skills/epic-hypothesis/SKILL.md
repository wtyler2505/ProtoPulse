---
name: epic-hypothesis
description: Frame a large initiative as a falsifiable hypothesis before build work. Use when Tyler has a big idea, feature, parser, dashboard, workflow, product bet, research lane, or TAS.SPAM build initiative and wants assumptions, beneficiaries, expected outcomes, experiments, success criteria, and kill/pivot rules made explicit.
---

# Epic Hypothesis

## What This Skill Does

Turn a big initiative into a testable bet. The output should make the belief,
target user/workflow, expected outcome, evidence, test plan, and failure rule
explicit before the work becomes a sprawling build.

Adapted from Dean Peters' Product Manager Skills `epic-hypothesis`.

## When To Use

- A feature sounds exciting but may be too broad.
- A source/parser/workflow could be valuable, but value is unproven.
- Tyler says "build all this" and the risk needs a testable first slice.
- You need a bridge from Opportunity Solution Tree to PRD.
- You need to justify why one epic beats another.

## Hypothesis Fields

```markdown
**If we** [specific action or solution]
**for** [target user/workflow]
**then we will** [observable outcome]
**because** [reason this should work].
```

Add:

- assumptions
- current evidence
- cheapest test
- success criteria
- failure/pivot criteria
- confidence
- blast radius

## Workflow

1. Name the epic in plain words.
2. Define the beneficiary:
   - Tyler
   - future agents
   - project operators
   - readers/users
   - a workflow or source pipeline
3. Separate output from outcome:
   - output: "dashboard exists"
   - outcome: "overload windows are visible sooner"
4. List assumptions that could be wrong.
5. Design 1-3 tiny tests:
   - prototype
   - script spike
   - source-pack pilot
   - manual review
   - comparison against known examples
6. Set a short time window and measurable signal.
7. Decide: build, narrow, research, park, or kill.

## TAS.SPAM Examples

```markdown
If we build a private Takeout feature store for weekly rhythm metadata
for TAS.SPAM source and self-research workflows,
then we will identify overload/context-switch patterns earlier
because repeated timing signals can show cycles without exposing raw content.
```

```markdown
If we add Evidence Court checks to every personal insight
for future Codex/Claude reductions,
then we will reduce sycophantic or overconfident profile claims
because each claim must name evidence, counterevidence, alternatives, and limits.
```

## Quality Checks

- Does "then we will" describe a real outcome?
- Could the hypothesis be proven wrong?
- Is the test cheaper than building the full epic?
- Is there a clear "stop/pivot" condition?
- Are privacy, clinical, or source-boundary risks named?

## Output

Use `templates/epic-hypothesis.md` for full output.

## Source Links

- Dean Peters Product Manager Skills:
  `https://github.com/deanpeters/Product-Manager-Skills/tree/main/skills/epic-hypothesis`
