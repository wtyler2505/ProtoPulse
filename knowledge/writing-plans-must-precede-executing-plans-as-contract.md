---
description: The write-plan -> execute-plan sequence is a mandatory ordering constraint where the plan document serves as the contract between planning and implementation phases
type: pattern
source: ".claude/skills/writing-plans/, .claude/skills/executing-plans/"
confidence: proven
topics: ["[[claude-code-skills]]", "[[methodology]]"]
related_components: [".claude/skills/writing-plans/", ".claude/skills/executing-plans/"]
---

# writing plans must precede executing plans as contract

The superpowers skill pair writing-plans and executing-plans enforces a strict ordering: you cannot execute without a written plan, and the plan document is the contract that the executor follows. This is not advisory -- the executing-plans skill expects a plan artifact to exist and uses it as its input.

The plan template (mandated in MEMORY.md) requires: Goal/Architecture/Tech Stack header, Existing Infrastructure table, phased tasks with Files/Context/Steps in TDD format (failing test -> run -> implement -> run -> commit), agent-teams prompts per phase with file ownership and dependency ordering, and a Team Execution Checklist.

This pattern prevents a common failure mode: starting implementation before understanding the full scope, then discovering halfway through that the approach doesn't work. By front-loading architectural decisions into the plan phase, the execution phase can focus on disciplined implementation. The plan also serves as documentation -- it records WHY decisions were made, not just WHAT was built.

The pattern is reinforced by MEMORY.md's explicit rule: "ALL implementation plans MUST follow the template."

---

Relevant Notes:
- [[superpowers-plugin-provides-the-core-development-lifecycle]] -- the lifecycle context
- [[agent-teams-skill-is-the-mandated-parallel-execution-mechanism]] -- plans define agent team structure

Topics:
- [[claude-code-skills]]
- [[methodology]]
