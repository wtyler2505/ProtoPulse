# ProtoPulse 3D View — Focused Product Analysis Report
**Scope:** BoardViewer3DView feature and supporting libraries only (CSS 3D renderer, data model, orphaned WebGL engine)
**Analysis performed:** 2026-05-18 (Deep mode — inventory, UX, debt, competitive, innovation + cross-phase synthesis)
**Primary finding:** The 3D View is architecturally and functionally incomplete for real hardware work. It was implemented as a viewer shell but never connected to actual design data, uses a non-scalable rendering approach, and carries significant dead code from an abandoned parallel WebGL effort.

---

## Executive Summary

The ProtoPulse 3D View (the "viewer_3d" surface) currently presents a visually attractive but **non-functional** PCB visualization for any real user project:

- **Zero real design data** reaches the scene (components, traces, vias, placements from PCBLayoutView are never loaded).
- **CSS 3D** creates hundreds of transformed DOM elements with no culling — performance collapses on boards larger than a few dozen parts.
- **Only static camera presets** — no free orbit, zoom, or inspection tools that every competing tool (KiCad, Altium, EasyEDA) provides as baseline.
- **~2,200 LOC of high-quality WebGL engine + tests** (webgl-viewer.ts) is completely unused — pure technical debt.
- High cyclomatic complexity (CCN 23 and 20) in the exact functions that would need to change to fix the above.

**Net result:** A hobbyist might enjoy the pretty empty board for 30 seconds. A professional EE or startup founder trying to do clearance checks, DFM review, or client handoff will immediately conclude "this doesn't work" and never return.

The good news: the data model, types, hook contract, test investment, and package database are solid foundations. The work required is **integration + renderer replacement + interaction polish**, not a ground-up rewrite.

**Top 3 recommended actions (P0):**
1. Wire the 3D singleton to live PCB placement / netlist data (unlocks everything else).
2. Kill the dead WebGL code or (preferred) promote it to be the actual renderer.
3. Replace the 7-button preset camera with a proper interactive orbit/zoom/pan control.

All other items (measurement, 2D/3D sync, realistic parts, enclosure overlay) are high-value follow-ons that become feasible only after the P0s.

**Quantitative evidence (from lizard + scc + code search):**
- 3,205 production LOC + 2,826 test LOC dedicated to the surface.
- 3 functions with CCN ≥ 17 (one at 23).
- 0 call sites outside the view itself that populate geometry.
- 1,298 LOC WebGL with 0 production imports.

---

## Phase 1 — Current State Inventory (What Actually Ships)

**Core surface files (only these were analyzed):**
- `BoardViewer3DView.tsx` (718 LOC) — React page with controls + CSS 3D scene
- `board-viewer-3d.ts` (1189 LOC) — Singleton model + `useBoardViewer3D` hook
- `webgl-viewer.ts` (1298 LOC) — Full GPU engine (dead)

**What exists and is wired:**
- Board dimension sync (one-way from `useProjectBoard` for width/height/thickness/cornerRadius)
- 7 static view angles (top, bottom, front, back, left, right, isometric) via CSS rotateX/Y on a perspective container
- 8 layer visibility toggles (top/bottom copper, silk, mask, substrate, internal) — partially effective in CSS render
- Live dimension editing with persist back to project + other views
- Scene export/import as JSON (for the model, not useful to end users)
- ComponentBox, Trace3DElement, Via3DElement, Drill renderers using absolute + preserve-3d divs + real FootprintLibrary bounding boxes + PACKAGE_HEIGHTS
- `components.length` badge, render option checkboxes (existence vs effectiveness unclear)

**What is missing / partial / dead:**
- **No population of components/traces/vias from real design.** The hook exposes `addComponent`, `addTrace`, etc., but **no production code ever calls them** with PCB data. Confirmed by exhaustive grep across non-test files.
- WebGL engine: complete (geometries, layer stack calc, raycasting stubs, materials) but never imported or mounted.
- Free camera / interaction: none.
- Measurement, selection, 2D↔3D sync: declared in hook but not implemented in UI.
- Realistic part models: only simple extruded boxes with height from a 25-entry map.
- Empty / loading / error states for "your board has no placement data yet."
- Persistence of camera/layer choices.

**Developer intent markers:** Comment in BoardViewer3DView: "Plan 02 Phase 4 / E2E-228: drive the 3D singleton from the shared per-project board source of truth." — partial fulfillment (only dimensions).

**User experience summary (what actually happens today):** User navigates to 3D View on a 60-part project → sees a nice empty green board with dimension controls and 7 camera buttons → badge says "0 components" → rotating to "bottom" or toggling layers does very little because there is nothing on the board. They leave and never come back.

---

## Phase 2 — Competitive Gap Analysis

**Competitors examined:** KiCad (current 3D viewer), Altium Designer 3D, EasyEDA web 3D, Fusion 360 Electronics, modern browser tools (Flux, etc.).

**Gap matrix (selected rows):**

| Capability                  | ProtoPulse Status          | Best Competitor     | Gap Impact on Personas                  |
|-----------------------------|----------------------------|---------------------|-----------------------------------------|
| Free orbit / trackball cam + zoom/pan | 7 static presets only     | KiCad / Altium     | P0 for all — "I can't look around my board" |
| Real component 3D models (STEP/ extrude + materials) | Simple colored boxes + height map | KiCad (STEP), Altium | P0/P1 — pro EE can't do mechanical fit |
| Measurement / clearance probe | Declared in model, not in UI | All competitors    | P1 — core "verify before order" workflow |
| 2D layout ↔ 3D cross selection | None                       | Modern tools       | P1 — breaks mental model of "one design" |
| Performance on 200+ part boards | Will melt (DOM 3D)         | GPU viewers        | P0 — unusable for anything real         |
| Layer stack visualization (real 4-6L) | Basic 8 toggles, weak internal | KiCad/Altium       | P2 for signal integrity reviews         |
| Export pretty visuals + BOM labels | Raw JSON only              | All                | P2 for reviews / docs / clients         |
| Enclosure / mechanical co-design | None                       | Altium + MCAD, Fusion | P3 but high differentiation             |

**Key insight:** ProtoPulse's 3D View is roughly at the level of a 2015 hobbyist demo. Production tools moved to GPU + real models + interaction + MCAD integration years ago. The gap is not incremental features — it is "is this a viewer or a picture of a board?"

---

## Phase 3 — UX & Workflow Evaluation (Against pp-view-3d ux-contract)

**Contract violations confirmed:**
- "3D Board View is visible enough..." — technically renders, but with 0 content and static camera it communicates "this is not ready."
- "Important actions have clear labels..." — camera buttons are labeled, but their effect on an empty board is invisible. Layer toggles have no visual feedback on what changed.
- "Long menus and panels can scroll" — control cards exist; on laptop viewports they will fight the 3D scene for space.
- "Error, warning, empty... states understandable" — no empty state guidance ("Place components in PCB Layout first"), no loading indicator for large scenes.
- Performance jank will violate "responsive" implicit contract.

**Persona-specific friction:**
- **Hobbyist:** Fun for 20 seconds on a starter board. Loses interest when they realize they can't see the parts they placed or rotate freely.
- **Professional EE:** Tries a 4-layer board with tall components → sees nothing useful, can't measure clearances, can't verify bottom-side parts without flipping the whole mental model. Abandons.
- **Founder in review:** Wants to show the team "here's how the board will look assembled." Has only static angles and no parts. Looks unprofessional.

**Positive notes:** The visual language (colors, layer order, package labels) is thoughtful. The dimension live-edit + persist is a good pattern. The hook API is clean for future consumers.

---

## Phase 4 — Technical Debt & Architecture (lizard + code evidence)

**Complexity hotspots (lizard):**
- `addComponent` (board-viewer-3d.ts:403-431): CCN **23** — heavy branching on package type, side, footprint lookup, height DB, position math.
- `useBoardViewer3D` (board-viewer-3d.ts:1097-1189): CCN **20**, 57 NLOC — the entire subscription + every wrapper lives here. This is the integration point for real data.
- Handle in BoardViewer3DView (CCN 17) — dimension parsing + dual write (singleton + hook).

**Architecture smells:**
- Singleton + React hook subscription pattern works but makes testing the view + real data loading tricky (already has resetForTesting).
- Two completely separate geometry systems (CSS manual divs vs WebGL create*Geometry) with no shared math or package model.
- Inline style objects + .map() in render = classic React perf footgun, especially with preserve-3d.
- No separation of "scene graph" from "render concerns" — the model is pure, but the view bakes the CSS technique into the component tree.

**Dead code:** webgl-viewer.ts is the textbook example of "we started the real thing, got distracted, shipped the toy, left the real code to rot."

**Test reality:** 2.8k lines of tests exercise the model API thoroughly but cannot catch "does my actual 80-part board look right and run at 30fps in the browser?"

---

## Phase 5 — Feature Innovation (What Should Exist After the P0s)

Once data is flowing and a real renderer exists, the high-ROI additions (in rough order):

1. **2D ↔ 3D live sync** (select, highlight, camera focus on selected part).
2. **Measurement & clearance tools** (already stubbed in the model).
3. **Real part models** (tie to ForgeCAD / downloaded STEP-lite or parametric extrudes with materials).
4. **Photo / presentation export** with dimension overlays and BOM callouts.
5. **Enclosure overlay + simple collision** (the killer app for the "digital twin" vision).
6. **Exploded view, cross-section, layer heatmaps** (from simulation data).
7. **AR quick view** (WebXR on phone for client demos).

These are all blocked or devalued until the renderer + data problems are solved.

---

## Cross-Phase Synthesis & Risk Heatmap

**Impact chain (the one that matters):**
Dead WebGL investment + CSS 3D choice (Phase 4) → no scalable renderer (Phase 4) → cannot show real data without melting (Phase 1 + 3) → zero usage by target personas (Phase 3) → feature has negative ROI and damages perception of the whole ProtoPulse "see it in 3D" promise (Phase 2).

**Risk heatmap (modules that are high in complexity + change frequency + user exposure):**
- The `useBoardViewer3D` hook + `addComponent` (will be touched by every future data integration + renderer swap).
- The render tree in BoardViewer3DView (every perf or camera improvement touches it).

**Priority recalibration from cross-phase view:**
All "nice" innovations (P3) were downgraded because they depend on the P0 data + renderer work. The checklist reflects this.

---

## Appendix: Raw Evidence Pointers

- lizard CCN output (see phase-0-metrics-3d.md)
- Grep proving 0 population call sites
- ux-contract.md in pp-view-3d skill (the bar we measured against)
- webgl-viewer.ts existence + lack of imports
- PACKAGE_HEIGHTS and FootprintLibrary usage in ComponentBox

**Next analysis run:** After the data-wiring milestone (3D-FG-P0-01), re-run with `--iterations 3` focused on the new integration surface and the renderer choice.

---

*Report generated as part of focused `/product-analysis /pp-view-3d` execution. Full working files in `.agents/analysis/`. Checklist in `docs/product-analysis-3d-view-checklist.md`.*
