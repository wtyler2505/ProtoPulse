---
description: The superpowers lifecycle (brainstorm-plan-execute) and the spec workflow (create-validate-decompose-execute) solve the same problem with different tradeoffs but no documented decision criteria
type: insight
source: ".claude/skills/writing-plans/, .claude/commands/spec/"
confidence: proven
topics: ["[[claude-code-skills]]", "[[gaps-and-opportunities]]"]
related_components: [".claude/skills/writing-plans/", ".claude/skills/executing-plans/", ".claude/commands/spec/"]
---

# two parallel implementation paths exist with no routing guidance between them

The superpowers path (brainstorm -> write-plan -> execute-plan -> verify -> ship) and the spec path (spec:create -> spec:validate -> spec:decompose -> spec:execute) both take a feature description and produce implemented code. They differ in two key dimensions:

**Human review**: The superpowers path has explicit human checkpoints -- the plan must be reviewed and approved before execution begins. The spec path emphasizes autonomous validation -- spec:validate determines machine-readability, and spec:execute dispatches agents without a manual review step.

**Plan format**: Superpowers plans follow a rigid template (Goal/Architecture header, Existing Infrastructure table, phased TDD tasks, agent-team prompts). Spec documents are more flexible and focus on WHAT to build rather than HOW to build it.

The correct choice depends on context:
- **Novel features with uncertain architecture**: Superpowers path. The human review catches architectural mistakes before implementation begins.
- **Well-understood features with clear patterns**: Spec path. The autonomous validation is faster and the agent already knows the patterns.
- **Features requiring agent-teams**: Superpowers path. The plan template includes agent-team prompts with file ownership, which spec:decompose does not.

But this routing guidance exists ONLY in this knowledge note and in the spec-workflow note. Neither CLAUDE.md nor any skill trigger description helps the agent choose between the two paths. When a user says "implement this feature," the agent defaults to whichever path it last used or whichever is most prominent in the current context.

---

Relevant Notes:
- [[writing-plans-must-precede-executing-plans-as-contract]] -- the superpowers contract
- [[spec-workflow-provides-structured-autonomous-implementation-path]] -- the spec contract
- [[the-full-quality-pipeline-is-brainstorm-plan-execute-test-review-verify-ship]] -- the full superpowers chain

Topics:
- [[claude-code-skills]]
- [[gaps-and-opportunities]]
