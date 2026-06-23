---
name: opportunity-solution-tree
description: Build an Opportunity Solution Tree from outcome to opportunities, solution options, and tests. Use when Tyler has a broad idea, feature request, parser lane, source strategy, product surface, or "all possible ways" exploration and wants to avoid jumping straight to the first solution.
---

# Opportunity Solution Tree

## What This Skill Does

Map a broad desire into:

```text
desired outcome -> opportunities/problems -> solutions -> tests
```

Use it to make smart divergence happen before committing to a build. Adapted
from Dean Peters' Product Manager Skills `opportunity-solution-tree` and Teresa
Torres' Opportunity Solution Tree pattern.

## When To Use

- The request is broad, exciting, or messy.
- There are many possible builds and no obvious first slice.
- A stakeholder/user asks for a solution but the underlying problem is unclear.
- Tyler asks for "all possible ways" and then needs a sane first build.

## Core Rule

Opportunities are problems, needs, gaps, or risks. They are not feature ideas.

Bad:

```text
Opportunity: Build a timeline dashboard.
```

Good:

```text
Opportunity: Tyler cannot see when project context-switching becomes overload.
```

## Workflow

1. State one desired outcome.
2. Generate 3 opportunities.
3. For each opportunity, generate 3 possible solutions.
4. Attach a cheap test to each solution.
5. Score:
   - Feasibility: 1 hard, 5 easy
   - Impact: 1 small, 5 huge
   - Evidence fit: 1 weak, 5 strong
   - Risk control: 1 risky, 5 contained
6. Pick one best first test.
7. Explain why the obvious other options are not first.

## TAS.SPAM Uses

- choosing the next Takeout parser or private feature-store lane
- deciding which NotebookLM source family to reduce next
- planning Evidence Court tools
- selecting a source-recovery path
- turning the insight atlas into buildable slices

## Output

Use `templates/opportunity-solution-tree.md`.

## Quality Checks

- Exactly one desired outcome.
- At least 3 opportunities before solutions.
- Every chosen solution has a test.
- One first test is recommended.
- "Why not the obvious other thing" is answered.

## Source Links

- Dean Peters Product Manager Skills:
  `https://github.com/deanpeters/Product-Manager-Skills/tree/main/skills/opportunity-solution-tree`
