---
description: Oracle, eda-domain-reviewer, and code-review-expert are the only three agents configured with project-scoped persistent memory, giving them accumulated context across sessions
type: claim
source: ".claude/agents/ agent definitions"
confidence: proven
topics: ["[[claude-code-skills]]", "[[dev-infrastructure]]"]
related_components: [".claude/agents/oracle.md", ".claude/agents/eda-domain-reviewer.md", ".claude/agents/code-review-expert.md"]
---

# three agents have persistent project memory

Of the 37 agent definitions in `.claude/agents/`, only 3 have `memory: project` in their configuration: oracle, eda-domain-reviewer, and code-review-expert. This means these agents accumulate context across sessions -- they remember past reviews, past debugging sessions, and past domain findings.

The selection is intentional. These are the three agents where accumulated context matters most:

- **Oracle** (memory + effort:high + maxTurns:50): The strongest debugging agent. Memory lets it remember past debugging sessions, so recurring bugs or architectural patterns don't need re-investigation.
- **EDA domain reviewer** (memory + effort:high + maxTurns:30): The only domain-specific agent. Memory lets it build up knowledge about ProtoPulse's specific EDA conventions, pin labeling choices, and format quirks.
- **Code review expert** (memory + maxTurns:25): The quality gate. Memory lets it track recurring code quality patterns, known tech debt, and style evolution over time.

The remaining 34 agents are stateless -- each invocation starts fresh. While the `memory` keyword appears in many agent files (the word "memory" in descriptions about MCP memory tools), only these three have the `memory: project` configuration key that enables persistent recall.

---

Relevant Notes:
- [[oracle-agent-escalation-is-the-strongest-debugging-path]] -- oracle's memory + effort:high combination
- [[thirty-seven-agents-have-no-trigger-patterns]] -- all agents require manual invocation

Topics:
- [[claude-code-skills]]
- [[dev-infrastructure]]
