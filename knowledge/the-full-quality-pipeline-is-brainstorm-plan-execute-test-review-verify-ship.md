---
description: Seven ordered skills form the complete feature delivery pipeline from creative divergence through production deployment
type: pattern
source: ".claude/skills/brainstorming/, .claude/skills/writing-plans/, .claude/skills/executing-plans/, superpowers plugin"
confidence: proven
topics: ["[[claude-code-skills]]", "[[methodology]]"]
related_components: [".claude/skills/brainstorming/", ".claude/skills/writing-plans/", ".claude/skills/executing-plans/"]
---

# the full quality pipeline is brainstorm plan execute test review verify ship

The superpowers plugin encodes a seven-phase feature delivery pipeline where each phase has a dedicated skill and each transition has an implicit contract:

1. **Brainstorm** (/brainstorming): Socratic divergent exploration. Produces raw ideas, evaluates feasibility, narrows to a design. Contract out: a specific, evaluated approach worth planning.
2. **Plan** (/writing-plans): Structured decomposition into phased tasks with file ownership, TDD steps, and agent-team prompts. Contract out: a plan document that is the binding spec.
3. **Execute** (/executing-plans): Disciplined batch implementation following the plan. Review checkpoints between batches. Contract out: working code matching the plan.
4. **Test** (/tdd-mastery or /testing-mastery): Red-green-refactor cycle. Tests written before or alongside implementation. Contract out: passing test suite proving correctness.
5. **Review** (/requesting-code-review + /receiving-code-review): Dispatch a review agent, then process feedback with technical rigor. Contract out: reviewed, improved code.
6. **Verify** (/verification-mastery): Prove work complete with empirical evidence. Run checks, tests, browser verification. Contract out: evidence of completion.
7. **Ship** (/finishing-a-development-branch): Merge, PR, or cleanup. Contract out: code integrated into main.

The pipeline's strength is that each phase has STOPPING CRITERIA defined by its skill -- brainstorming stops when an idea is specific enough to plan, planning stops when the document follows the template, execution stops when the plan's tasks are done. Without these stopping criteria, phases bleed into each other and quality degrades.

The parallel path (spec:create -> spec:validate -> spec:decompose -> spec:execute) offers a faster route for well-understood features but skips the human review checkpoint between phases 2 and 3.

---

Relevant Notes:
- [[superpowers-plugin-provides-the-core-development-lifecycle]] -- the plugin that provides these skills
- [[writing-plans-must-precede-executing-plans-as-contract]] -- the plan-execute contract
- [[spec-workflow-provides-structured-autonomous-implementation-path]] -- the parallel autonomous path

Topics:
- [[claude-code-skills]]
- [[methodology]]
