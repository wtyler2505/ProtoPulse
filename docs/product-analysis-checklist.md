# ProtoPulse — Full Product Analysis Checklist (Actionable Shit That Needs to Be Done)
**Analysis:** Extended (5-pass) with cross-phase synthesis + meta-analysis
**Date:** 2026-05-18
**Focus:** Highest-impact defects, debt, UX friction, gaps, and opportunities that are blocking velocity, causing bugs, or creating churn risk.

**Legend:** ID | Title | Evidence | Effort | Priority | Why this is real shit

---

## P0 — Ship Blockers / High Churn Risk (fix these first)

### Module: 3D View (BoardViewer3DView + libs) — Poster Child for Systemic Patterns
- **TD-3D-01 / UI-3D-01** | No real design data reaches the 3D scene (always empty) | `useProjectBoard` only syncs dimensions (BoardViewer3DView:426). Zero production calls to `addComponent`/`addTrace`/`addVia` from PCB data. Badge always "0 components". 3D scoped TD + UX agents (lizard, ast-grep, code search). | XL | **P0** | The entire 3D View is a non-functional demo for any real project. Highest visibility "we shipped a broken feature" signal.
- **TD-3D-05 / UI-3D-04** | CSS 3D as the rendering engine (DOM explosion) | 600–1200+ nodes for 200-part board via per-trace/per-component div maps + 16+ fresh inline `style={{transform}}` objects (BoardViewer3DView:558-643, Trace3DElement:206). Web research 2025/26 confirms this is unsupported for real PCB viewers. | XL | **P0** | Will jank or lock the browser the first time a user loads a real board. Unscalable by design.
- **TD-3D-01** | Dead 1,298 LOC WebGL engine | `webgl-viewer.ts` (full geometry/raycast) has **0 production imports** (ast-grep + rg across client/src). 960 LOC of tests on dead code. | S (delete) / XL (integrate) | **P0** | Pure maintenance tax + false confidence. The "we have a 3D path" lie.
- **TD-3D-02** | Refactor addComponent (CCN 23) + useBoardViewer3D hook (CCN 20) | `board-viewer-3d.ts:403` and `:1097` (lizard). These are exactly the functions that must change for data wiring. | M | **P1** (P0 after data arrives) | Untestable hotspots at the integration seam.

### Systemic Patterns (appear in multiple large surfaces)
- **TD-01** | Multiple 1.3k–1.7k LOC monolithic view/canvas files with 200–500+ complexity | breadboard-canvas/index.tsx (1676 LOC / 475 complexity), ArchitectureView (1509 LOC), server/ai.ts (1496 LOC / 520), WaveformViewer, SerialMonitorPanel, etc. (scc --by-file). | XL | **P0** | These are the "god components" that are almost impossible to unit test, slow to change, and the source of most cross-view bugs.
- **UI-01 / TD-02** | View-to-view state sync failures (dimensions only, components never) | 3D is the most blatant (only dims flow). Breadboard/PCB/3D/Schematic all have partial or one-way sync via useProjectBoard or singletons. | L | **P0** | Users lose work or see inconsistent state between views. Multi-view contract is broken.
- **TD-03** | Ubiquitous `getInstance()` singleton manager pattern | Dozens of `*Manager.getInstance()` across auth, telemetry, simulation, hardware, AI, etc. (grep for `getInstance`). Creates hidden global state and testing nightmares. | L | **P0** | Architectural smell that makes every integration and test harder. The 3D singleton + hook is a microcosm.
- **TD-04** | Abandoned parallel implementations (WebGL for 3D is the clearest) | Multiple "Wave" and "FG-*" features started with two renderers or two data paths and one left to rot. | M (audit) / L (clean) | **P0** | Dead code + technical confusion. "Why are there two 3D things?" is a recurring onboarding question.

---

## P1 — High Velocity / Correctness Impact

- **TD-05** | Refactor the top 5 largest/complex files (breadboard canvas, ArchitectureView, server/ai.ts, etc.) | Split or extract state machines, render logic, and data loading. | XL | P1
- **UI-05** | Dimension / board param edits are "Apply" only with two sources of truth | 3D + PCBLayoutView both write board size with fire-and-forget and local state. | M | P1
- **TD-06** | Test bloat on happy paths + dead code while monsters have low real coverage | 2.8k LOC 3D tests + many 1k+ LOC test files, but the 1676 LOC breadboard canvas has mostly trivial tests. | L | P1
- **TD-07** | No performance guardrails or node-count warnings in any of the big canvas surfaces | No memo, culling, LOD, or dev-mode logging when DOM/WebGL elements explode. | M | P1

---

## P2 — Polish + Future-Proofing

- **UI-06** | Laptop viewport + responsive layout debt across the big interactive views | Many views assume wide desktop (fixed widths, no collapse, no scaling for 3D/scene canvases).
- **TD-08** | Internal / multi-layer copper and package height unification | 3D claims internal layers and has PACKAGE_HEIGHTS vs FootprintLibrary vs BUILTIN_PACKAGES duplication with zero hardware verification (CLAUDE.md rule).
- **EN-01** | Finish 2D ↔ 3D cross-highlight + selection (and similar live sync for other view pairs)
- **IN-01** | After the P0 renderer + data work, add measurement, enclosure overlay, photo export, and AR quick view for 3D (high differentiation vs KiCad).

---

**Cross-Phase Synthesis Notes (from Extended refinement)**
- The 3D View is not an outlier — it is the clearest visible example of the same patterns that exist in breadboard-canvas, ArchitectureView, simulation surfaces, and AI orchestration: large complex files, partial data sync, abandoned tech, high CCN at the seams, and "it works on small cases" testing.
- Fixing data wiring + renderer choice in 3D will teach the team how to fix the same class of problems in the other big surfaces.
- Meta-analysis: the combination of (a) monolithic high-CCN views + (b) broken inter-view sync + (c) dead code from Wave development = the highest risk area for both user churn and developer velocity.

**Total high-impact items surfaced:** 20+ (P0–P2). The 3D scoped deep dives (4 phases, 200+ tool calls across agents) gave us the best current evidence; the scc largest-files data shows the pattern is worse elsewhere.

**Recommendation:** Start with the four P0 items that are both user-visible and architectural (3D data wiring, 3D renderer decision, breadboard-canvas split, view sync contract). Everything else becomes easier or obvious after those.

Update this checklist after each implementation wave. Re-run full `/product-analysis` after the next major release.