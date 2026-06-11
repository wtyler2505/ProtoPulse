# Phase 1 Checklist -- Enhancements (EN-)

> Priority: P0 (critical) -> P3 (nice-to-have)
> Effort: S (hours) / M (days) / L (weeks) / XL (months)
> Items marked with [RECALIBRATED] were adjusted based on cross-phase analysis.

## Architecture & Core

- [ ] EN-01: Remove PROJECT_ID = 1 hardcoding; enable multi-project routing and context | Effort: L | Priority: P0
  - Cross-ref: TD-02, FG-02, UI-02 — all 5 phases independently flag this as critical
- [ ] EN-02: Implement real-time collaboration via WebSocket/CRDT for multi-user editing | Effort: XL | Priority: P2
  - Blocked by: TD-02, TD-03, TD-07 (three XL prerequisites)
- [ ] EN-03: Build unified undo/redo stack across all views (currently fragmented per-view) | Effort: L | Priority: P1
- [ ] EN-04: Make PCB board dimensions configurable (TODO in circuit-routes.ts — currently hardcoded 50x50) | Effort: S | Priority: P1
- [ ] EN-05: Remove deprecated endpoints `/api/bom/:id` and `/api/validation/:id` and update all callers | Effort: S | Priority: P2
- [ ] EN-06: Complete export-generators.ts monolith decomposition into server/export/ modules | Effort: M | Priority: P2
  - Cross-ref: TD-10. Current state: monolith (1,209 LOC) is imported by ai-tools.ts for all 78 AI tools. Modular system (11 files, ~3,200 LOC) is imported by circuit-routes.ts. 7 generators overlap between both systems with different signatures. Must update ai-tools.ts imports to point to modular system, then delete monolith.

## Circuit Design / Schematic

- [ ] EN-07: Implement actual PCB auto-router (currently stub AI tool with no routing engine) | Effort: XL | Priority: P1
  - Blocked by: TD-01 (PCBLayoutView CCN=135 must be refactored first)
- [ ] EN-08: Add net-aware PCB-level DRC (clearance, trace width, via rules — currently only component-level DRC) | Effort: L | Priority: P1
- [ ] EN-09: Add interactive manual PCB trace routing (currently AI-only via `draw_pcb_trace`) | Effort: L | Priority: P1
  - Blocked by: TD-01 (PCBLayoutView CCN=135)
- [ ] EN-10: Import KiCad/Eagle/Altium project files (currently export-only for KiCad/Eagle) | Effort: L | Priority: P1
  - [RECALIBRATED] from Phase 2 FG-22 promotion. Phase 3 "Critical dead-end" for professional engineers. Architecturally clean — not blocked by debt.
- [ ] EN-11: Import IBIS/SPICE model files for simulation (currently generates SPICE but cannot import models) | Effort: M | Priority: P2
- [ ] EN-12: Add hierarchical schematic sheet navigation with port connections (currently basic panel) | Effort: M | Priority: P2

## BOM / Procurement

- [ ] EN-13: Integrate real supplier APIs (Octopart/Nexar, Mouser, Digi-Key) for live pricing, stock, lead times | Effort: L | Priority: **P0** [RECALIBRATED]
  - **Promoted from P1 to P0.** Cross-phase evidence: Phase 1 found ALL three procurement tools (`pricing_lookup`, `suggest_alternatives`, `check_lead_times`) return AI-fabricated data. Phase 2 FG-23 confirms. The entire procurement tab — BOM cost optimization, in-stock filtering, preferred supplier ranking, lead time display — operates on simulated data with zero real-world value. Users making purchasing decisions based on this data would get wrong prices, wrong stock levels, and wrong lead times. This is not "Partial" — it is actively misleading.
- [ ] EN-14: Add parametric component search via real component database (currently AI-simulated) | Effort: L | Priority: P1
- [ ] EN-15: BOM diff/comparison between project versions | Effort: M | Priority: P2
- [ ] EN-16: Automated alternate part cross-referencing with real equivalence databases | Effort: L | Priority: P2

## AI System

- [ ] EN-17: Optimize AI system prompt size — currently rebuilds full project state on every request (scales poorly) | Effort: M | Priority: P1
  - Cross-ref: TD-11. Prompt scales O(n) — ~50KB context for 100-node project. Blocks efficient multi-model routing (IN-07).
- [ ] EN-18: Add AI conversation branching/forking (explore multiple design paths) | Effort: M | Priority: P2
- [ ] EN-19: Add AI context window management — truncate old messages or summarize to stay within token limits | Effort: M | Priority: P1
- [ ] EN-20: Split ai-tools.ts (1,677 LOC — second-largest file) into domain-specific tool modules | Effort: M | Priority: P1
  - Cross-ref: TD-09. Current file hosts ALL 78 tool definitions + Zod schemas + execution logic + all imports from export-generators.ts monolith. Adding more tools is impractical at this size. Proposed split: architecture-tools, circuit-tools, component-tools, bom-tools, validation-tools, export-tools, project-tools, navigation-tools.
- [ ] EN-21: Refactor parseLocalIntent.ts (294 LOC, CCN=102) — the local AI mode intent parser | Effort: M | Priority: P1
  - Phase 4 finding. 102 cyclomatic complexity in 294 lines means nearly every line is a branch. Local AI mode is a key feature (allows AI without API calls) trapped in an unmaintainable decision tree. Must refactor to pattern-based or registry-based approach before expanding local mode capabilities.

## Testing & Quality

- [ ] EN-22: Add integration tests for storage layer (currently only unit tests for exporters/engines) | Effort: M | Priority: P1
- [ ] EN-23: Add E2E tests for critical user flows (create project, add components, run AI chat, export) | Effort: L | Priority: P1
- [ ] EN-24: Add test coverage for all 78 AI tools (currently tested: exporters only, not tool execution) | Effort: L | Priority: P1

## UX / Frontend

- [ ] EN-25: Add PWA support with service worker for offline access to project data | Effort: M | Priority: P3
- [ ] EN-26: Add i18n/localization framework | Effort: L | Priority: P3
- [ ] EN-27: Improve responsive layout for tablet-sized screens (currently desktop-optimized) | Effort: M | Priority: P2
- [ ] EN-28: Add native clipboard support (Ctrl+C/V) for architecture nodes (currently AI-mediated only) | Effort: S | Priority: P2
- [ ] EN-29: Add dark/light theme persistence and system preference detection (partially implemented via next-themes) | Effort: S | Priority: P3
- [ ] EN-30: Refactor ShapeCanvas.tsx (1,275 LOC, aggregate CCN=381, 6 functions >CCN 20) | Effort: L | Priority: P0
  - Cross-ref: TD-04. Highest complexity component in the entire codebase. Adding DRC visualization (UI-11) or any new features here without refactoring first will create catastrophic complexity. Hosts: SVG shape rendering, snap guides, DRC overlays, ruler overlay, shape editing — all in one file.

## Simulation

- [ ] EN-31: Add frequency-domain analysis visualization (Bode plots) to waveform viewer | Effort: M | Priority: P2
- [ ] EN-32: Support component model libraries (standard resistor/capacitor/transistor SPICE models) | Effort: M | Priority: P1
- [ ] EN-33: Add Monte Carlo simulation for tolerance analysis | Effort: L | Priority: P2

## Security & Operations

- [ ] EN-34: Add session refresh/rotation mechanism (currently 7-day fixed expiry, no refresh) | Effort: S | Priority: P2
- [ ] EN-35: Add request logging/audit trail beyond basic metrics (currently minimal `recordRequest`) | Effort: M | Priority: P2
- [ ] EN-36: Add database migration strategy (currently using `db:push` which is destructive) | Effort: M | Priority: P1
  - Cross-ref: TD-03. Blocks version history (IN-06) and safe production deployment with real user data.

---

## Summary by Priority

| Priority | Count | Items |
|----------|-------|-------|
| **P0** | 3 | EN-01 (multi-project), EN-13 (supplier APIs), EN-30 (ShapeCanvas refactor) |
| **P1** | 16 | EN-03, EN-04, EN-07, EN-08, EN-09, EN-10, EN-14, EN-17, EN-19, EN-20, EN-21, EN-22, EN-23, EN-24, EN-32, EN-36 |
| **P2** | 13 | EN-02, EN-05, EN-06, EN-11, EN-12, EN-15, EN-16, EN-18, EN-27, EN-28, EN-31, EN-34, EN-35 |
| **P3** | 4 | EN-25, EN-26, EN-29, EN-33 |

### Cross-Phase Priority Recalibrations Applied

| Item | Original Priority | New Priority | Justification |
|------|-------------------|-------------|---------------|
| EN-13 (supplier APIs) | P1 | **P0** | ALL procurement data is AI-fabricated. The procurement tab actively misleads users with fake prices, stock levels, and lead times. Zero real-world value. |
| EN-30 (ShapeCanvas) | *new item* | **P0** | Phase 4 CCN=381 finding. Highest complexity in codebase. Must refactor before any feature additions. |
| EN-20 (split ai-tools) | *new item* | **P1** | Phase 4 found 1,677 LOC — second-largest file. Scaling the AI tool count is blocked. |
| EN-21 (parseLocalIntent) | *new item* | **P1** | Phase 4 CCN=102. Key feature (local AI mode) locked behind unmaintainable parser. |
