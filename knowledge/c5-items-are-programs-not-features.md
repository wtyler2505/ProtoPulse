---
description: "24 backlog items rated C5 are architecture-defining programs requiring ADRs, not implementable as single waves"
type: insight
source: "docs/MASTER_BACKLOG.md (Complexity Radar)"
confidence: proven
topics: ["[[architecture-decisions]]", "[[goals]]"]
related_components: []
---

# C5 items are programs not features and each one changes downstream assumptions for multiple backlog items

The Complexity Radar section lists 24 C5 items -- the highest complexity tier, defined as "new subsystem, runtime, tenancy model, execution environment, or a decision that many downstream items depend on." These include firmware simulation (BL-0635), RBAC/tenancy (BL-0381), shared schematic-breadboard netlist (BL-0571), public API + webhooks (BL-0370), plugin SDK (BL-0371), and design branching (BL-0184).

What distinguishes C5 from C4 is dependency fan-out. BL-0631 (simulator-based firmware execution) is listed as "a prerequisite decision for several downstream simulation features." BL-0381 (RBAC + org/team tenancy) is "system-wide infrastructure touching auth, ownership, collaboration, auditability, and future team-facing features." A wrong decision at C5 creates rework across C3 and C4 items that assumed a different foundation.

The backlog responds to this by requiring C5 preplanning artifacts. Two are explicitly created: a firmware runtime program plan and a collaboration foundation program plan. The pattern is: C5 items get ADRs and multi-phase plans before any implementation starts. C1-C3 items get implemented directly in waves. C4 items are the gray zone where judgment is required. This tiered approach prevents both over-planning (for simple work) and under-planning (for architectural work).

---

Relevant Notes:
- [[six-epics-organize-the-remaining-strategic-work]] -- epics wrap C5 programs into strategic groupings
- [[native-desktop-pivot-unblocked-three-c5-programs]] -- the pivot was itself a C5 decision that cleared three other C5 blockers
- [[backlog-completion-at-501-items-reveals-systematic-execution]] -- wave-based execution required different treatment for C5 vs C1-C3 items
- [[cocomo-estimates-protopulse-at-1-9m-and-17-months]] -- C5 items drive the complexity that makes the codebase equivalent to $1.9M of effort
- [[cross-tool-coherence-is-harder-than-building-features]] -- Epic C's cross-tool integration is itself a C5 program that changes downstream assumptions for every view
- [[god-files-create-feature-paralysis-through-complexity]] -- god files were C4/C5 debt that blocked C5 programs from being implemented cleanly

Topics:
- [[architecture-decisions]]
- [[goals]]
