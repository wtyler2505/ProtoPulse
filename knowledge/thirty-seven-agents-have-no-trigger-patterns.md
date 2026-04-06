---
description: All 37 agent definitions lack explicit trigger patterns in their headers, requiring manual invocation or CLAUDE.md lookup
type: claim
source: ".claude/agents/"
confidence: proven
topics: ["[[dev-infrastructure]]"]
related_components: [".claude/agents/"]
---

# thirty-seven agents have no trigger patterns

None of the 37 agent definitions in `.claude/agents/` include a trigger pattern (e.g., "Use when...", "Trigger on...", "Activate when...") in their first 10 lines. The agent files contain domain expertise and instructions but no metadata about when to invoke them.

This means Claude cannot self-select agents based on task context. The CLAUDE.md file includes a table mapping domains to agent names (React, TypeScript, Node, EDA, testing, security), but this is a static reference that must be manually consulted. If a user asks about PostgreSQL optimization, Claude has no automatic mechanism to load the database-postgres-expert agent.

The agents are also large -- 20,525 lines total, with the biggest (nodejs-expert) at 1059 lines. Loading all agents would consume significant context. A trigger-based system would allow selective loading based on the task at hand, similar to how skills have description-based triggers.

---

Relevant Notes:
- [[six-agents-cover-technologies-not-in-protopulse-stack]] -- some agents are never relevant
- [[agent-definitions-total-twenty-thousand-lines]] -- the context cost

Topics:
- [[dev-infrastructure]]
