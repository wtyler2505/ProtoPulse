---
type: manual
generated_from: "arscontexta-1.0.0"
---

# Meta-Skills

System-level operations for vault health, evolution, and structural analysis.

## Health Diagnostics

### /arscontexta:health
Run condition-based vault health diagnostics across 8 categories:

1. **Schema compliance**: Do all notes have required frontmatter fields? Are enum values valid?
2. **Orphan detection**: Notes with zero incoming links. These are knowledge islands -- either connect them or question whether they belong.
3. **Link health**: Broken wiki links pointing to non-existent notes. Dead connections degrade trust.
4. **Staleness**: Notes not updated since creation that have `confidence: experimental`. Old experiments need resolution.
5. **Topic map coverage**: What percentage of notes appear in at least one topic map? Low coverage means navigation is broken.
6. **Inbox pressure**: How many raw captures are waiting for extraction? High pressure means the pipeline is falling behind.
7. **Connection density**: Average links per note. Below 2.0 suggests notes aren't being connected.
8. **Tension backlog**: Unresolved tensions and observations. These are signals waiting to be acted on.

## Evolution & Architecture

### /arscontexta:architect
Research-backed evolution advice. Analyzes health reports, friction patterns from `ops/observations/`, and the derivation configuration to recommend structural changes. Might suggest:
- Adding a new topic map for a domain that's growing
- Splitting a topic map that's gotten too large
- Adjusting maintenance thresholds based on actual usage patterns
- Introducing new extraction categories

### /arscontexta:reseed
Nuclear option: re-derive the system from first principles. Use when structural drift has accumulated to the point where incremental fixes aren't enough. Walks through the full derivation conversation again, respecting existing content but potentially restructuring the skeleton.

### /arscontexta:upgrade
Apply plugin knowledge base updates. When the Ars Contexta methodology evolves, this skill brings new capabilities into your existing vault without breaking your content.

### /arscontexta:recommend
Get research-backed architecture advice for specific questions. "Should I split my PCB topic map?" or "What's the right confidence threshold for auto-archiving?"

## Graph Analysis

### /graph
Interactive knowledge graph analysis. Natural language queries routed to graph scripts:

- `/graph "what are the most connected notes?"` -- find knowledge hubs
- `/graph "orphans"` -- list unconnected notes
- `/graph "path from pcb-layout to simulation"` -- trace connection paths
- `/graph "clusters"` -- detect natural topic groupings
- `/graph "stale notes older than 30 days"` -- find notes needing revisit

## System Reflection

### /rethink
Challenge system assumptions against accumulated evidence. Reviews:
- Observations in `ops/observations/` for recurring friction patterns
- Tensions in `ops/tensions/` for unresolved structural conflicts
- Session data for usage patterns that contradict the current setup

Outputs proposed methodology changes with evidence and rationale.

### /remember
Capture friction signals for later analysis. Three modes:
- **Explicit**: `/remember "extracting large datasheets overwhelms a single note"` -- log specific friction
- **Contextual**: `/remember` -- reviews recent session for correction patterns
- **Prompted**: Interactive exploration of what felt off

### /refactor
Plan vault restructuring from config changes. Compares `ops/config.yaml` against `ops/derivation.md`, identifies dimension shifts, and generates a migration plan for affected content.

---

Topics:
- [[manual]]
