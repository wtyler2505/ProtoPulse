---
description: When context compaction triggers in long sessions, CLAUDE.md routing guidance survives but recently-learned skill associations are lost, degrading the agent's effective capability set
type: insight
source: "Session continuation behavior, MEMORY.md"
confidence: likely
topics: ["[[claude-code-skills]]", "[[gaps-and-opportunities]]", "[[dev-infrastructure]]"]
related_components: ["CLAUDE.md", "MEMORY.md"]
---

# context compaction erases skill routing knowledge causing capability amnesia

During long Claude Code sessions, context compaction removes older conversation turns to free up token budget. CLAUDE.md and MEMORY.md survive compaction (they are re-injected at the start of each continuation). But skill routing knowledge learned DURING the session -- which skills were invoked, which worked well, which the user corrected -- is lost.

This creates a degradation pattern: early in a session, the agent has both CLAUDE.md routing AND accumulated session context about which skills to use. After compaction, only CLAUDE.md routing remains. If a skill was invoked because the user explicitly requested it (not because CLAUDE.md routed to it), the post-compaction agent will not invoke it again unless the user re-requests it.

The practical consequence is that agents in long sessions gradually lose access to their full skill repertoire. A session that started with /brainstorming, /writing-plans, and /agent-teams may, after compaction, default to direct implementation because the conversation history showing the plan and the team structure was compacted away.

MEMORY.md partially compensates by persisting key decisions across sessions. But MEMORY.md is already 39KB and over its size limit, meaning new session-specific skill routing cannot be stored there without evicting existing content. The /resume skill (which rebuilds context after continuation) reads recent files and git state but does not reconstruct skill invocation history.

---

Relevant Notes:
- [[combined-claude-md-exceeds-800-lines-creating-context-pressure]] -- CLAUDE.md survives but is already large
- [[the-skill-system-has-no-automatic-routing-the-agent-must-know-which-skill-to-invoke]] -- why lost routing is costly
- [[claude-md-is-the-routing-table-that-maps-situations-to-skills]] -- the surviving routing layer

Topics:
- [[claude-code-skills]]
- [[gaps-and-opportunities]]
- [[dev-infrastructure]]
