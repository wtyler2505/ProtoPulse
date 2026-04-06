---
description: CLAUDE.md serves as the agent's dispatch table -- without explicit routing entries, the vast majority of installed skills go unused
type: insight
source: "CLAUDE.md, ~/.claude/CLAUDE.md"
confidence: proven
topics: ["[[claude-code-skills]]", "[[dev-infrastructure]]", "[[methodology]]"]
related_components: ["CLAUDE.md", "~/.claude/CLAUDE.md"]
---

# CLAUDE.md is the routing table that maps situations to skills

CLAUDE.md is not just project documentation -- it is the primary mechanism by which an AI agent discovers and activates capabilities. Every section that says "when Tyler asks X, do Y" or "ALWAYS use Z before implementing" is a routing rule. Without these rules, the agent falls back to its training data and general heuristics, ignoring the 215+ skills, 26 hooks, 37 agents, and 4 MCP servers available to it.

The ProtoPulse CLAUDE.md contains several explicit routing tables:
- **Knowledge-Driven Gap Analysis**: "When Tyler asks 'what's missing'" -> read radar, run queries, web search, cross-reference, present
- **Knowledge Capture**: "After every significant development session" -> write to knowledge/, use template, link topic maps
- **Infrastructure Self-Audit**: "When Tyler asks about hooks, skills, agents" -> run infra-audit.sh, read topic map, check methodology notes
- **Available AI Subagents**: domain -> agent name mapping for delegation
- **Build & Commands**: task -> npm command mapping

The global CLAUDE.md adds more routing: Context7 for library docs, Clear Thought for structured reasoning, Memory MCP for session context, Hugging Face for ML research, Chrome DevTools mandatory protocol, Desktop Commander for sensitive files, and Claude-Codex routing for task delegation.

The problem is coverage. The routing tables cover roughly 40 situations. But the installed skills handle 200+ situations. The delta -- 160 situations with available skills but no routing -- represents capability that exists but is structurally unreachable. This is why notes like [[infrastructure-skills-exist-but-are-not-referenced-in-any-workflow]] keep appearing: the skills are real, but the routing table does not point to them.

---

Relevant Notes:
- [[combined-claude-md-exceeds-800-lines-creating-context-pressure]] -- CLAUDE.md size limits how much routing can fit
- [[the-skill-system-has-no-automatic-routing-the-agent-must-know-which-skill-to-invoke]] -- why routing tables matter
- [[infrastructure-skills-exist-but-are-not-referenced-in-any-workflow]] -- the cost of missing routing entries

Topics:
- [[claude-code-skills]]
- [[dev-infrastructure]]
- [[methodology]]
