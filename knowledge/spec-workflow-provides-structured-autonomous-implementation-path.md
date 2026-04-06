---
description: The spec:create/validate/decompose/execute command chain provides a structured path from feature description to autonomous multi-agent implementation
type: concept
source: ".claude/commands/spec/"
confidence: proven
topics: ["[[claude-code-skills]]", "[[dev-infrastructure]]"]
related_components: [".claude/commands/spec/create.md", ".claude/commands/spec/validate.md", ".claude/commands/spec/decompose.md", ".claude/commands/spec/execute.md"]
---

# spec workflow provides structured autonomous implementation path

The four-command spec workflow encodes a complete autonomous implementation pipeline:

1. **spec:create**: Generate a spec file for a new feature or bugfix. Produces a structured document describing what to build.
2. **spec:validate**: Analyze the spec to determine if it has enough detail for autonomous implementation. Quality gate.
3. **spec:decompose**: Break the validated spec into actionable implementation tasks. Produces a task list.
4. **spec:execute**: Implement the validated spec by orchestrating concurrent agents.

This parallels but differs from the superpowers write-plan -> execute-plan chain. The superpowers path emphasizes human review between planning and execution. The spec path emphasizes autonomous validation -- spec:validate determines machine-readability, and spec:execute dispatches agents without a manual review checkpoint.

The spec workflow is most valuable for well-understood feature types where the specification can be thorough enough for autonomous execution. For novel or risky features, the superpowers write-plan path with its human review checkpoint is safer. No routing guidance exists to help choose between the two paths.

---

Relevant Notes:
- [[writing-plans-must-precede-executing-plans-as-contract]] -- the alternative planning path
- [[agent-teams-skill-is-the-mandated-parallel-execution-mechanism]] -- what spec:execute dispatches

Topics:
- [[claude-code-skills]]
- [[dev-infrastructure]]
