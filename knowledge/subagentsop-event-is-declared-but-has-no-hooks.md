---
description: The SubagentStop event is declared in settings.json with an empty array, meaning subagent termination triggers nothing
type: claim
source: ".claude/settings.json"
confidence: proven
topics: ["[[dev-infrastructure]]"]
related_components: [".claude/settings.json"]
---

# SubagentStop event is declared but has no hooks

In `.claude/settings.json`, the `SubagentStop` event is declared with an empty array: `"SubagentStop": []`. This means when any subagent finishes execution, no hooks fire. The declaration exists as a placeholder but serves no function.

This could be intentional -- subagent stop is less critical than the main agent's Stop event, which runs typecheck, lint, test, self-review, and checkpoint. But subagents can make code changes too (especially in agent-teams workflows), and those changes bypass all the Stop event quality gates.

If agent-teams teammates make edits that fail typecheck, the error is only caught when the main agent stops or when the PostToolUse hooks fire on the teammate's writes. A SubagentStop hook running at least a typecheck would close this gap.

---

Relevant Notes:
- [[twenty-six-hooks-create-a-dense-quality-pipeline]] -- the main Stop event has 7 hooks
- [[two-hook-groups-have-no-explicit-matcher]] -- other settings.json oddities

Topics:
- [[dev-infrastructure]]
