---
description: The oracle agent with persistent memory, effort:high, and GPT-5 fallback represents the strongest available debugging escalation beyond structured thinking skills
type: insight
source: ".claude/agents/oracle.md"
confidence: proven
topics: ["[[claude-code-skills]]", "[[dev-infrastructure]]"]
related_components: [".claude/agents/oracle.md"]
---

# oracle agent escalation is the strongest debugging path

The oracle agent is configured with three force multipliers that no other agent has combined: `memory: project` (persistent recall across sessions), `effort: high` (maximum reasoning depth), and `maxTurns: 50` (the highest turn count of any agent). Its description explicitly says "use PROACTIVELY when encountering complex bugs, architectural decisions, or when a thorough review would prevent future issues."

The oracle also has a multi-model fallback chain: it first checks for cursor-agent (GPT-5), then codex, before falling back to its own capabilities. This means invoking the oracle may route to a different AI model entirely, potentially getting fresh reasoning that Claude's own patterns wouldn't produce.

In the debugging escalation hierarchy, the oracle sits at the top: direct debugging -> /debugging-mastery skill -> /when-stuck meta-router -> thinking skills (collision-zone, inversion, scale-game) -> oracle agent. Each level trades speed for depth. The oracle should be the last resort for truly stubborn problems, not the first tool reached for, because its cost (context window, turn count, potential external model call) is the highest.

The persistent memory is what makes repeated oracle invocations compound in value -- the second time you ask about a similar problem, it already has context from the first investigation.

---

Relevant Notes:
- [[three-agents-have-persistent-project-memory]] -- the memory:project configuration
- [[when-stuck-is-a-meta-router-that-dispatches-to-specialized-techniques]] -- the level before oracle

Topics:
- [[claude-code-skills]]
- [[dev-infrastructure]]
