---
description: "Epics A-F structure the backlog into simulation, Arduino, cross-tool, collaboration, manufacturing, and learning"
type: insight
source: "docs/MASTER_BACKLOG.md (Complex Work / Epics)"
confidence: likely
topics: ["[[goals]]", "[[architecture-decisions]]"]
related_components: []
---

# Six epics organize the remaining strategic work into programs that each depend on different architectural foundations

The backlog defines six epics that reveal the project's strategic layers:

Epic A (Simulation UX & Firmware-Aware Prototyping) is about matching TinkerCAD's "instant gratification" while preserving ProtoPulse's deeper analysis engines. Epic B (Arduino Workbench / IDE Parity) is about keeping makers from leaving for Arduino IDE or PlatformIO when they hit compile friction. Epic C (Cross-Tool Integration) is about making 26 ViewModes behave like one coherent system. Epic D (Collaboration, Review, Branching) is about evolving from shared cursors to real team workflows. Epic E (Manufacturing & BOM Intelligence) is where "cool demo" becomes "real tool I trust before spending money." Epic F (Learning & Guided Success) is about serving users who are still learning electronics.

The ordering is not arbitrary. Epics A and B are user-retention features (keep makers from leaving). Epic C is structural integrity (fulfill the core promise). Epics D and E are trust-building (enable team use and real manufacturing). Epic F is growth (expand the addressable audience).

Each epic's complexity rating (all C4 or C5) reflects that these are not feature lists but architectural programs. Epic C explicitly states: "shared source-of-truth rules across the product are architecture-defining." Epic D requires "firm session revalidation, auditability, role enforcement, and an opinionated branching/review model." These are the kind of work where implementation plans matter more than velocity.

---

Relevant Notes:
- [[cross-tool-coherence-is-harder-than-building-features]] -- Epic C in detail
- [[backlog-completion-at-501-items-reveals-systematic-execution]] -- how epics feed waves

Topics:
- [[goals]]
- [[architecture-decisions]]
