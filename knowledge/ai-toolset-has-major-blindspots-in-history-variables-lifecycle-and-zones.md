---
description: "AI has 125 tools but is completely blind to version control, design variables, component lifecycle, copper pour zones, BOM snapshots, and collaboration"
type: debt-note
source: "conductor/comprehensive-audit.md §29, §31, §33"
confidence: proven
topics: ["[[architecture-decisions]]"]
related_components: ["server/ai-tools/index.ts", "server/ai.ts"]
---

# AI toolset has major functional blindspots across six entire API domains

The AI agent has 125 tools but is completely blind to these backend capabilities:

1. **Version control/rollback** — cannot list history, revert snapshots, or undo its own destructive mistakes
2. **Design variables** — cannot query, evaluate, or define parametric variables. Sees `R_LED_Limit` as a string instead of resolving to its value, breaking risk analysis
3. **Component lifecycle** — cannot deprecate parts, mark EOL, or suggest migration paths
4. **Copper pour/zones** — can draw traces but cannot create GND planes (fundamental PCB requirement)
5. **BOM snapshots/ECO** — cannot snapshot before bulk changes or diff against previous states
6. **Collaboration** — cannot invite users, manage roles, or interact with design comments
7. **Settings/preferences** — blind to grid snapping, routing preferences, UI themes

Each of these has working backend endpoints that the AI simply doesn't know about.

---

Relevant Notes:
- [[ai-is-the-moat-lean-into-it]] -- blindspots directly undermine the moat strategy
- [[all-procurement-data-is-ai-fabricated]] -- AI confidence without capability = hallucination
- [[genkit-125-flat-tools-is-an-outdated-anti-pattern-needs-multi-agent]] -- multi-agent routing would naturally expose these domains to specialized agents
- [[cross-tool-coherence-is-harder-than-building-features]] -- six blind domains are six incoherent views the AI cannot bridge
- [[voice-ai-is-disconnected-from-llm-using-hardcoded-command-matching]] -- voice is another disconnect between capability and AI awareness

Topics:
- [[architecture-decisions]]
