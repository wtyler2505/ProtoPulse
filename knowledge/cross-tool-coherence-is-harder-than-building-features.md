---
description: "Epic C reveals that making schematic, PCB, BOM, and validation share truth is the hardest remaining work"
type: insight
source: "docs/MASTER_BACKLOG.md (Epic C)"
confidence: likely
topics: ["[[architecture-decisions]]", "[[maker-ux]]"]
related_components: ["shared/schema.ts", "server/storage.ts"]
---

# Cross-tool coherence is harder than building features because data ownership between views is ambiguous

Epic C in the backlog ("One Tool, Zero Context Switching") identifies the deepest architectural challenge: ProtoPulse has 26 ViewModes that each show overlapping data (a resistor exists in the schematic, the BOM, the PCB, and the breadboard) but there is no single explicit source of truth for which view owns which properties. The open question is literally stated: "Which domain owns value/MPN truth after initial placement: schematic, BOM, or both?"

This matters because ProtoPulse's core promise -- "never leave the tool" -- breaks whenever the user has to manually re-enter data between views. BL-0498 (schematic -> BOM auto-populate) and BL-0558 (schematic -> PCB forward annotation) were both P1 because their absence forced manual data reconciliation. The fix wasn't a single feature; it required defining which system is authoritative.

The cross-cutting work section lists five integration tracks that each touch 4-6 existing surfaces. Each track needs shared identifiers between domains, navigation primitives for cross-view linking, and clear rules about what happens when two views disagree. This is the kind of work that is invisible to users when done right and infuriating when done wrong.

---

Relevant Notes:
- [[dual-export-system-is-a-maintenance-trap]] -- dual exports are a symptom of the data-ownership ambiguity between AI and REST surfaces
- [[no-other-eda-tool-starts-from-architecture-diagrams]] -- the unique starting point creates unique coherence challenges across all 26 views
- [[exports-are-only-accessible-via-ai-chat]] -- exports-only-via-chat is a symptom of cross-tool incoherence
- [[six-epics-organize-the-remaining-strategic-work]] -- Epic C is entirely about solving this coherence problem
- [[hardcoded-project-id-blocked-multi-project-until-wave-39]] -- the hardcoded ID was an early example of implicit coupling that broke coherence across views
- [[drizzle-orm-was-chosen-for-type-safe-zod-integration]] -- Drizzle's schema-as-source-of-truth is the backend answer to the cross-view coherence problem
- [[c5-items-are-programs-not-features]] -- cross-tool integration is itself a C5 program that changes downstream assumptions for every view

Topics:
- [[architecture-decisions]]
- [[maker-ux]]
