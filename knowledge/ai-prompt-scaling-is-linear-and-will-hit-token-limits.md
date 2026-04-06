---
description: "Full project state is rebuilt on every AI request, causing O(N) token cost that degrades silently"
type: debt-note
source: "docs/product-analysis-report.md"
confidence: proven
topics: ["[[architecture-decisions]]"]
related_components: ["server/ai.ts"]
---

# The AI system prompt rebuilds full project state on every request creating linear token cost scaling

Every AI chat request triggers buildAppStateFromProject() which queries nodes, edges, BOM, validation, chat history, and circuit data sequentially — O(N) database round trips — then serializes the entire result into the system prompt. A 100-node project sends approximately 50KB of context per request. This creates two compounding problems: linear token cost scaling (every message costs proportionally more as the project grows) and silent quality degradation when large projects hit token limits and the context is truncated without warning.

The cross-phase analysis identified this as Impact Chain 5: prompt scaling prevents cost-effective multi-model routing because every model receives the full context, even for simple tasks that only need a fraction. The fix path involves selective context injection (only send what is relevant to the user's question) and materialized project state snapshots, but these require understanding which parts of the project each of the 125 tools actually needs.

---

Relevant Notes:
- [[ai-is-the-moat-lean-into-it]] -- the AI strategy depends on sustainable costs
- [[god-files-create-feature-paralysis-through-complexity]] -- the query function is itself a complexity hotspot
- [[monolithic-context-causes-quadratic-render-complexity]] -- client-side equivalent: one monolith causes cascading cost on every state change
- [[cocomo-estimates-protopulse-at-1-9m-and-17-months]] -- 57K LOC generates the project state that hits token limits

Topics:
- [[architecture-decisions]]
