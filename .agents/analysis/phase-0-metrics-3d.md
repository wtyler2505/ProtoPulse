# Phase 0 — Baseline Metrics (3D View Scoped)

**Date:** 2026-05-18
**Focus:** ProtoPulse 3D View feature (BoardViewer3DView + supporting libs)
**Scope note:** Metrics limited to the ~6k LOC in the 3D visualization surface + tests. Whole-project 1.4M LOC not relevant here.

## Core Files
| File | LOC | Type | Notes |
|------|-----|------|-------|
| BoardViewer3DView.tsx | 718 | UI + CSS 3D rendering + controls | Primary user surface |
| board-viewer-3d.ts | 1189 | Data model + singleton + React hook | CCN hotspots here |
| webgl-viewer.ts | 1298 | Full WebGL engine (GPU, raycast, geometries) | **0 references outside its tests** — dead code |
| BoardViewer3DView.test.tsx | 711 | Component tests | |
| board-viewer-3d.test.ts | 1155 | Model tests | |
| webgl-viewer.test.ts | 960 | Engine tests | High test investment for unused code |

**Total 3D surface:** ~3,205 production LOC + 2,826 test LOC = 6,031 LOC dedicated.

## Complexity Hotspots (lizard CCN >= 10)
- `addComponent` (board-viewer-3d.ts:403-431): **CCN 23**, 29 lines — package type branching, validation, side logic
- `useBoardViewer3D` hook (board-viewer-3d.ts:1097-1189): **CCN 20**, 57 NLOC, 93 lines — massive effectful hook managing singleton + subscriptions
- Anonymous in handleUpdateDimensions (BoardViewer3DView.tsx ~465-477): **CCN 17**
- `updateComponent` (board-viewer-3d.ts): CCN 13
- Several geometry builders in webgl-viewer (createCylinderGeometry CCN 7, etc.) — wasted since unused

## Other Quantitative Signals
- **Inline style objects in render path:** Dozens created on every parent render (traces.map, components.map, layer toggles). Even with child memo, object identity churn hurts.
- **DOM element count:** For a 100x80mm board with 80 components + 200 trace segments + 50 vias = potentially 400+ absolutely positioned 3D-transformed divs. No virtualization or culling.
- **No Three.js / WebGL in active path:** Despite 1.3k LOC + 960 test LOC investment.
- **Recent change velocity:** Several "Auto" commits touching the surface; historical "Wave 36" and "FG-01 Phase 5" commits introduced it. Not actively iterated recently.
- **Footprint/Package coverage:** PACKAGE_HEIGHTS has ~25 entries. FootprintLibrary is shared but verification against real datasheets per CLAUDE.md hardware protocol is unclear.

## Tool Health
- lizard, scc, ast-grep, rg all runnable and produced data.
- No direct gh issues filtered to "3D" in quick scan (would be done in Phase 2/5).

**Key takeaway for all phases:** Significant engineering effort was spent on two parallel 3D implementations (CSS toy + full WebGL). Only the CSS one is wired to the user-facing page. This is the dominant story for debt, UX risk (perf), and innovation (finish the real one or kill the dead).

---

**Raw lizard excerpt (CCN>10 only, relevant files):**
```
      11     17 ... (anonymous)@465-477@.../BoardViewer3DView.tsx
      22     23 ... addComponent@403-431@.../board-viewer-3d.ts
      39     13 ... updateComponent@444-484@.../board-viewer-3d.ts
      57     20 ... useBoardViewer3D@1097-1189@.../board-viewer-3d.ts
```
(Full lizard output available in agent working context.)
