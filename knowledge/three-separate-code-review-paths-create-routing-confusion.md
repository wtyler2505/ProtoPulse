---
description: Three overlapping code review mechanisms exist with unclear routing -- superpowers requesting/receiving, plugin code-review, and agent code-review-expert
type: insight
source: ".claude/skills/, .claude/commands/, .claude/agents/"
confidence: proven
topics: ["[[claude-code-skills]]", "[[dev-infrastructure]]", "[[gaps-and-opportunities]]"]
related_components: [".claude/skills/requesting-code-review/", ".claude/skills/receiving-code-review/", ".claude/commands/code-review.md", ".claude/agents/code-review-expert.md"]
---

# three separate code review paths create routing confusion

Code review has three independent entry points, each with different scope and mechanism:

1. **Superpowers skills**: `/requesting-code-review` dispatches a code-reviewer subagent, `/receiving-code-review` processes feedback with technical rigor. These are skill-based workflows.
2. **Plugin code-review**: The `code-review:code-review` plugin skill provides its own review methodology. This is a plugin-injected workflow.
3. **Slash command + agent**: `/code-review` (the project command in `.claude/commands/code-review.md`) dispatches multi-aspect review using parallel `code-review-expert` agents across 6 dimensions (architecture, quality, security, performance, testing, docs).

No routing guidance tells users which to invoke for a given situation. The superpowers path is designed for pre-merge validation (requesting before pushing, receiving after feedback). The command path is designed for comprehensive multi-aspect analysis. The plugin path is a third option with its own methodology. A developer finishing a feature might reasonably reach for any of the three, and each would produce different coverage.

---

Relevant Notes:
- [[superpowers-plugin-provides-the-core-development-lifecycle]] -- the superpowers review workflow
- [[four-overlapping-task-management-systems-fragment-attention]] -- same fragmentation pattern in task management

Topics:
- [[claude-code-skills]]
- [[gaps-and-opportunities]]
