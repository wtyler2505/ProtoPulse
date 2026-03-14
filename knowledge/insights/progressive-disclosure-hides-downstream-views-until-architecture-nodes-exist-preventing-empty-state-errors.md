---
summary: Views like Schematic, PCB, Procurement, and Validation are hidden from the tab bar until at least one architecture node exists, preventing both UX confusion and runtime errors in views that assume data
category: implementation-detail
areas: ["[[architecture]]", "[[conventions]]"]
wave: "extraction"
---

# Progressive disclosure hides downstream views until architecture nodes exist, preventing empty-state errors

ProjectWorkspace implements progressive disclosure via `alwaysVisibleIds` (in `sidebar-constants.ts`) and a `hasDesignContent` check (line 481 of ProjectWorkspace.tsx). Views are split into two tiers:

**Always visible** (17 views): Dashboard, Architecture, Component Editor, Arduino, Circuit Code, Calculators, Patterns, Kanban, Knowledge, Community, Ordering, Simulation, Serial Monitor, Generative Design, Digital Twin, History, Lifecycle, Comments, Output. These are entry points or standalone tools that don't require prior design work.

**Require architecture content** (8 views): Schematic, Breadboard, PCB, Procurement, Validation, Storage. These only appear in the tab bar once `nodes.length > 0`.

This isn't just a UX nicety — it's a guard against runtime errors:
- Schematic/Breadboard/PCB views render circuit instances derived from architecture nodes. With zero nodes, the rendering logic has no data to work with and would show either a confusing blank canvas or throw null reference errors.
- Procurement (BOM) and Validation views are meaningless without components to bill or validate.
- Line 494-499: If the active view becomes hidden (e.g., user deletes all nodes while on Schematic), the workspace auto-redirects to Architecture view.

The `alwaysVisibleIds` set is maintained in `sidebar-constants.ts` as a single source of truth, shared between the sidebar and the workspace header tab bar.

---

Related:
- [[the-maker-to-professional-spectrum-is-the-fundamental-ux-tension]] — progressive disclosure addresses the onboarding side of this tension
- [[the-gap-between-feature-exists-and-feature-is-wired-is-the-dominant-source-of-broken-workflows]] — views without prerequisite data are a form of unwired feature
- [[tiered-idle-time-prefetch-prevents-first-click-navigation-jank-across-27-lazy-loaded-views]] — prefetch tiers align with disclosure tiers: always-visible views are Tier 1 prefetch, require-content views are Tier 2; the two systems reinforce each other
- [[drc-explanations-embed-pedagogical-content-directly-in-the-engine-making-the-validation-system-a-teaching-tool-not-just-a-checker]] — progressive disclosure and pedagogical DRC share the same design principle: show complexity only when the user is ready for it
- [[every-component-must-define-geometry-three-times-because-the-triple-view-architecture-couples-identity-to-representation]] — components with empty breadboard/PCB view data are an invisible form of non-disclosure: the view is unlocked but the content is blank
- [[errorboundary-suppresses-resizeobserver-loop-errors-because-they-are-benign-browser-noise-that-would-crash-every-canvas-view]] — ErrorBoundary is the fallback when progressive disclosure fails and a canvas view renders without expected data

Areas:
- [[architecture]]
- [[conventions]]
