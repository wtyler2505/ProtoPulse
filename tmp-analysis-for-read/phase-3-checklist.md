# Phase 3 Checklist -- UX Issues (UI-)

> Priority: P0 (critical) -> P3 (nice-to-have)
> Effort: S (hours) / M (days) / L (weeks) / XL (months)
> Refined: 2026-02-28 (cross-phase integration with Phases 1, 4, 5)

## P0 -- Critical (Users will abandon the tool)

- [ ] UI-01: Add onboarding / welcome flow for first-time users (empty project detection, feature overview, guided first steps). Note: `start_tutorial` AI action exists but is unimplemented (orphaned feature). | Effort: M | Priority: P0
- [ ] UI-02: Add project creation UI and project list/selector (remove hardcoded PROJECT_ID=1) | Effort: L | Priority: P0
- [ ] UI-03: Add collaboration features -- multi-user support, sharing, commenting, role-based access | Effort: XL | Priority: P0
- [ ] UI-04: Add design import from KiCad/EAGLE/Altium (at minimum KiCad netlist import). Note: FZPZ import exists server-side but has no UI affordance (orphaned feature -- add UI for it as part of this work). | Effort: L | Priority: P0
- [ ] UI-05: Add standard component/symbol library (74xx, passives, connectors, common ICs) for schematic capture. **Prerequisite: TD-09** (split ai-tools.ts) -- adding library tools to a 1,677-line file is impractical. | Effort: L | Priority: P0

## P1 -- High (Significant friction, users will work around or complain)

- [ ] UI-06: Create dedicated Export panel/dropdown in header with all available export formats (Gerber, KiCad, SPICE, BOM CSV, Eagle, Fritzing, design report) instead of AI-chat-only. **Prerequisite: TD-10** (complete export decomposition) -- dual export backend (old monolith `export-generators.ts` 1,209 LOC + new `server/export/` modules) must be unified first or the UI will need to wire to two competing systems. | Effort: M | Priority: P1
- [ ] UI-07: Persist AI API key to localStorage or server-side encrypted storage (currently lost on page refresh) | Effort: S | Priority: P1
- [ ] UI-08: Add login/signup UI to surface existing server-side auth (sessions, users table exist but no UI) | Effort: M | Priority: P1
- [ ] UI-09: Show explicit "Local Mode" capability list vs "API Mode" capabilities in chat empty state. **Prerequisite: TD-05** (refactor parseLocalIntent CCN=102) -- the local mode parser is a 208-line decision tree; the behavior itself is too tangled to clearly document without refactoring the logic first. | Effort: S | Priority: P1
- [ ] UI-10: Add coordinate readout / mouse position indicator on all canvas views (Architecture, Schematic, PCB) | Effort: S | Priority: P1
- [ ] UI-11: Add design rule constraint visualization during PCB trace routing (clearance indicators, DRC real-time feedback). **Prerequisite: TD-01** (refactor PCBLayoutView CCN=135) AND **TD-04** (decompose ShapeCanvas CCN=381) -- adding DRC visualization to these files in their current state will compound already-extreme complexity. | Effort: L | Priority: P1
- [ ] UI-12: Add project export/import as file (backup, migration, sharing) | Effort: M | Priority: P1
- [ ] UI-13: Improve error messages with specific guidance: which setting to check, what format is expected, link to docs. **Enabled by: TD-06** (split useActionExecutor 1,299 lines) -- per-domain action handlers would allow consistent, specific error messages per action category instead of generic catch-all messages. | Effort: M | Priority: P1
- [ ] UI-14: Add net class assignment and management UI in Schematic view (power vs signal, custom width/clearance rules) | Effort: L | Priority: P1

## P2 -- Medium (Noticeable UX gap, impacts daily workflow)

- [ ] UI-15: Add `aria-label` to all unlabeled inputs (sidebar search, log filter, settings inputs) | Effort: S | Priority: P2
- [ ] UI-16: Wrap input groups in `<form>` elements with proper `<label>` associations for assistive technology. **Cross-ref:** `@hookform/resolvers` is installed but unused (remove it or use it). Phase 5 IN-12 proposes `cmdk` command palette as keyboard-first alternative that partially bypasses this need for power users. | Effort: M | Priority: P2
- [ ] UI-17: Add focus-visible outlines to all custom interactive elements (toolbar buttons, tree items, canvas tools) | Effort: S | Priority: P2
- [ ] UI-18: Implement progressive disclosure -- hide advanced tabs (PCB, Simulation, Breadboard) until prerequisite content exists | Effort: M | Priority: P2
- [ ] UI-19: Add breadcrumb / workflow progression indicator showing design stage (Architecture -> Schematic -> PCB -> Manufacturing) | Effort: M | Priority: P2
- [ ] UI-20: Rename "Output" tab to "Console" or add separate "Artifacts" tab for exported files and reports | Effort: S | Priority: P2
- [ ] UI-21: Add cost tracking over time in Procurement view (BOM cost history graph across design iterations) | Effort: M | Priority: P2
- [ ] UI-22: Add undo/redo toolbar buttons (not just keyboard shortcuts) for discoverability | Effort: S | Priority: P2
- [ ] UI-23: Add context menu hint / tooltip on first right-click in canvas views | Effort: S | Priority: P2
- [ ] UI-24: Add "Keyboard Shortcuts" link/button in toolbar (currently only accessible via `?` key) | Effort: S | Priority: P2
- [ ] UI-25: Add PDF design report export for sharing with non-technical stakeholders | Effort: M | Priority: P2
- [ ] UI-26: Add project overview / dashboard view showing nodes count, BOM cost, validation status, last modified | Effort: M | Priority: P2
- [ ] UI-27: Expand Project Explorer sidebar tree to include schematics, PCB designs, and component library entries (not just architecture nodes) | Effort: M | Priority: P2
- [ ] UI-28: Activate `cmdk` command palette (already installed, zero usage) with basic actions (navigate views, trigger exports, search components). Provides keyboard-first alternative that bypasses zero-form problem for power users. | Effort: M | Priority: P2
- [ ] UI-29: Add native clipboard support for architecture nodes (Ctrl+C/V) -- currently clipboard operations are AI-mediated only via `copy_architecture_json`/`copy_architecture_summary` tools (orphaned features). | Effort: M | Priority: P2

## P3 -- Nice-to-Have (Polish and delight)

- [ ] UI-30: Add interactive tutorial / guided walkthrough for each view (Architecture, Schematic, Procurement). Wire to or replace the orphaned `start_tutorial` AI action. | Effort: L | Priority: P3
- [ ] UI-31: Add drag-drop visual hint (ghost preview) when dragging components from asset library | Effort: S | Priority: P3
- [ ] UI-32: Add "What's New" or feature changelog accessible from UI | Effort: S | Priority: P3
- [ ] UI-33: Add animation/transition when switching between views (slide or fade) | Effort: S | Priority: P3
- [ ] UI-34: Add offline mode with local state persistence for basic editing without server | Effort: XL | Priority: P3
- [ ] UI-35: Add BOM comparison between design versions | Effort: M | Priority: P3
- [ ] UI-36: Add community component library browser with search and import | Effort: L | Priority: P3
- [ ] UI-37: Add theme customization beyond light/dark (EDA users often prefer specific color schemes for schematics) | Effort: M | Priority: P3
- [ ] UI-38: Add WCAG contrast ratio audit on custom color choices (edge colors, node colors, validation severity colors) | Effort: S | Priority: P3
- [ ] UI-39: Add high-contrast mode for accessibility | Effort: M | Priority: P3
- [ ] UI-40: Remove `@hookform/resolvers` from dependencies (installed but completely unused -- zero `<form>` elements exist in the app) | Effort: S | Priority: P3

## Update 2026-05-17 (rest-express)

- [ ] UI-41: Audit the 10 newly introduced `<form>` elements for proper label associations and submit behaviors to ensure assistive tech compliance. | Effort: S | Priority: P1
- [ ] UI-42: Consolidate the 1562 lines of keyboard shortcut logic into the `cmdk` command palette for discoverability and conflict prevention. | Effort: M | Priority: P2

## Dependency Map (Refactor-Before-Feature)

These tech debt items from Phase 4 are **prerequisites** for specific UX items above:

| UX Item | Blocked By | Why |
|---------|-----------|-----|
| UI-05 (component library) | TD-09 (split ai-tools.ts) | Adding library tools to a 1,677-line file is impractical |
| UI-06 (export panel) | TD-10 (complete export decomposition) | Dual backend export system must be unified first |
| UI-09 (local mode clarity) | TD-05 (refactor parseLocalIntent) | CCN=102 decision tree too tangled to document clearly |
| UI-11 (DRC visualization) | TD-01 (PCBLayoutView refactor) + TD-04 (ShapeCanvas decomp) | CCN=135 and CCN=381 -- adding features compounds extreme complexity |
| UI-13 (better error messages) | TD-06 (split useActionExecutor) | 1,299-line monolith has inconsistent error handling per action type |
| General UI responsiveness | TD-07 (split ProjectProvider) | 40+ values in one context causes re-render storms on any state change |