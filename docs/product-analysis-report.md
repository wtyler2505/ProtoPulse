# ProtoPulse — Full Product Analysis Report (Extended)
**Scope:** Entire codebase (1.42M+ LOC EDA platform: breadboard, schematic, PCB, 3D, simulation, inventory, procurement, AI, desktop)
**Depth:** Extended (5 passes) with 3 refinement rounds + meta-analysis + cross-phase synthesis
**Date:** 2026-05-18
**Primary Lens:** "Find shit that needs to be done" — ruthless focus on defects, debt, UX friction, gaps, and opportunities that are real, measurable, and high-impact.

---

## Executive Summary

ProtoPulse has shipped an impressive amount of functionality across the full electronics prototyping stack. However, the codebase exhibits classic "successful startup / wave-based development" debt at scale:

- Multiple 1.3k–1.7k LOC monolithic view and canvas components with 200–500+ complexity (breadboard-canvas, ArchitectureView, 3D surfaces, simulation viewers, AI orchestration).
- Systemic view-to-view state sync failures (the 3D View only ever receives board dimensions; components/traces/vias never flow).
- Abandoned parallel implementations (the clearest example is the 1,298 LOC WebGL engine for 3D that has **zero** production usage).
- Ubiquitous singleton manager pattern creating hidden coupling.
- Test bloat on happy paths and dead code while the real monsters have low meaningful coverage.
- "Page intelligence" skills (including this pp-view-3d skill) existing precisely because the core surfaces have become too complex for normal maintenance and onboarding.

**The 3D View (BoardViewer3DView + board-viewer-3d + webgl-viewer) is the highest-visibility, best-analyzed case study of these patterns.** Deep scoped analysis (4 phases, 200+ tool calls) produced 24 concrete, line-precise actionable items (12 UI-3D + 12 TD-3D). The top P0s are:

1. No real design data ever reaches the scene (always empty for real projects).
2. CSS 3D as the rendering primitive (unscalable DOM explosion).
3. Dead 1.3k LOC WebGL engine (pure tax).
4. High-CCN hotspots exactly at the data-integration seams.

These are not 3D-specific problems — they are **product-wide** problems that happen to be most visible and best instrumented in the 3D surface.

The good news: the foundations (data models, hooks, test investment in some areas, rich domain knowledge) are strong. The work required is **refactoring + integration + renderer decisions + sync contracts**, not a ground-up rewrite.

---

## Phase 0 — Baseline (Quantitative Foundation)

- ~1.425M LOC, 6,318 files, heavy TypeScript/React.
- Multiple files > 1,400 LOC with 200–500+ complexity (scc + targeted lizard).
- Known CCN hotspots in the exact functions that future data-wiring and renderer work must touch (addComponent CCN 23, useBoardViewer3D hook CCN 20, etc.).
- Heavy auto-commit + "Wave" development history.
- Strong signal of test bloat alongside production bloat.

(See `.agents/analysis/phase-0-metrics.md` and the scc largest-files runs for raw data.)

---

## Phase 1 — Inventory (What Actually Exists)

Major surfaces: Breadboard (canvas + audit + coach), Schematic, PCB Layout, 3D View, Simulation (waveforms, thermal, etc.), Inventory, Procurement, AI Chat / Co-designer, Digital Twin, Arduino/Serial, Exports, etc.

Many features exist at "Partial" or "Functional" maturity because of the sync and data-flow problems between views. The 3D View is the clearest "exists in code, delivers zero value on real projects" example.

---

## Phase 2 — Competitive Gaps

ProtoPulse has broader scope than any single competitor (KiCad + Altium + Fusion + browser convenience). However, on individual surfaces (especially 3D, advanced simulation, mechanical co-design, reliable 2D↔3D sync) it lags the best-in-class tools because of the debt patterns above.

The 3D scoped competitive analysis showed exactly which 5–6 capabilities (free orbit camera, real part models, measurement, 2D↔3D sync, enclosure overlay, photo export) separate "toy" from "tool that professionals will trust."

---

## Phase 3 — UX & Workflow Friction

The 3D scoped UX audit (against the explicit pp-view-3d ux-contract) produced 12 high-quality items. The top ones (data wiring, lying layer toggles, laptop viewport breakage, CSS DOM perf cliff) are symptomatic of larger issues:

- Many interactive canvases assume wide desktop and small data sets.
- State lives in too many places (singletons + local component state + project board + localStorage) with weak or one-way sync.
- Empty / loading / error states are often missing or silent, especially when a view depends on data from another view that hasn't been populated yet.

---

## Phase 4 — Technical Debt & Architecture (The Core Shit)

**Largest / highest-risk files (scc + lizard):**
- breadboard-canvas/index.tsx (1676 LOC, 475 complexity) — the current king.
- ArchitectureView, server/ai.ts (AI orchestration), multiple simulation and serial panels, the 3D surface (before the scoped cleanup), parametric search, assembly cost estimator, copper-pour, etc.

**Systemic smells:**
- High-CCN functions at integration seams.
- Dead code from parallel implementations (WebGL 3D is the clearest, but the pattern exists elsewhere from Wave development).
- Singleton manager explosion.
- One-way or missing data flow between the major editing views.
- Test investment not aligned with complexity (happy-path tests on dead code, light coverage on the 1.6k LOC monsters).

The 3D scoped tech debt audit (69 tool calls) gave us the best current evidence of exactly how these patterns manifest and the concrete cost (unscalable renderer, untestable hotspots, maintenance tax of dead code, sync drift).

---

## Phase 5 — Innovation Opportunities

High-ROI ideas that become feasible only after the P0 debt work:
- Real 2D ↔ 3D + breadboard ↔ schematic live sync with selection and camera focus.
- Measurement, clearance, and enclosure overlay tooling (once a real renderer + real data exists).
- AI-assisted "explain this clearance violation in the 3D view" or "suggest enclosure adjustments".
- Photo-real / presentation exports for founders and reviews.
- Progressive enhancement: Canvas/WebGL fallback + LOD when component counts get large (applies to breadboard canvas and 3D).

---

## Cross-Phase Synthesis + Meta-Analysis (Why This Shit Compounds)

**Impact chain (the one that matters most):**
Monolithic high-CCN files (Phase 4) + partial data sync between views (Phase 1 + 3) + abandoned parallel tech (Phase 4) + testing not aligned with risk (Phase 4) → visible broken experiences in high-profile surfaces like 3D View (Phase 3) → user perception that "the advanced features don't really work" (Phase 2) → churn + slower adoption of the rest of the (actually quite good) platform.

**Risk heatmap:** The big interactive canvases and the AI orchestration layer are high in (size × complexity × user exposure × change frequency). These are the areas where one bad refactor or one missed sync edge case creates the most pain.

**Priority recalibration:** Many "nice" innovation ideas (P3) were correctly deprioritized because they depend on fixing the P0 sync + renderer + modularity debt first. The 3D View analysis made this crystal clear.

---

## Appendix — Best Evidence Sources

- 3D scoped deep dives (4 phases, 200+ tool calls): the highest-quality current artifacts in `.agents/analysis/phase-*-3d.md`.
- scc largest-files runs (breadboard-canvas, ArchitectureView, server/ai.ts, etc.).
- Targeted lizard on the worst files.
- pp-view-3d skill references (ux-contract, gotchas, self-improvement log) — used as the quality bar for one major surface.
- CLAUDE.md rules (hardware verification, ast-grep for code, no shortcuts, etc.) — repeatedly validated during the 3D audits.

---

**Bottom line:** ProtoPulse has real, high-quality engineering in many places, but the debt patterns (monolithic complex surfaces, sync failures, dead code, misaligned testing) are now visible to users in the most ambitious views. The 3D View analysis gave us the clearest current map of exactly what "shit that needs to be done" looks like on the ground.

The recommended first wave is the four P0 items that are both user-visible and architectural (3D data + renderer, breadboard-canvas modularity, cross-view sync contract, singleton audit). Everything else becomes dramatically easier after those.

**Deliverables:** This report + `docs/product-analysis-checklist.md` (the ruthless, prioritized action list with the 3D items folded in as the best-analyzed exemplars).

Re-run after the next major milestone. The data from the 3D deep dives should be preserved and used as the template for how to audit the other big surfaces.