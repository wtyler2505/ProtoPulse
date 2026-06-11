# Phase 4 Tech Debt Report — ProtoPulse 3D View (Scoped)

**Date**: 2026-05-18  
**Auditor**: TechDebt Auditor (product-analysis + pp-view-3d workflow)  
**Scope (strict)**: ONLY  
- `client/src/components/views/BoardViewer3DView.tsx` (719 LOC, CSS 3D UI)  
- `client/src/lib/board-viewer-3d.ts` (1189 LOC, singleton model + `useBoardViewer3D` hook)  
- `client/src/lib/pcb/webgl-viewer.ts` (1298 LOC, unused WebGL engine)  
- Their tests (~2.8k LOC total)  
- Integration: `useProjectBoard`, `FootprintLibrary`, `PCBLayoutView`, `ViewRenderer`

**Ignored**: All other 1.4M LOC codebase, other 3D experiments, non-3D views.

**Method**: lizard + scc + ast-grep structural + rg literal + file reads + web research (CSS 3D perf 2025/26) + CLAUDE.md hardware verification + pp-view-3d references (page-map, ux-contract, gotchas, testing, self-improvement).

**Prior work note**: Some phase-0/3 3D artifacts existed; this is the dedicated deep TechDebt quantification pass.

---

## Executive Summary (Top Debt)

The 3D visualization layer is built on a **fundamentally wrong primitive** (pure CSS 3D `transform` + hundreds of absolutely-positioned `<div>`s per board) for an EDA tool that must eventually handle real multi-layer PCBs with 100–1000+ components, traces, and vias. The architecture compounds this with a **localStorage-backed singleton** that is only loosely synced to the canonical per-project board store, duplicate geometry/package data, and zero performance guardrails.

**Quantitative highlights** (from lizard/scc):
- 3 files = **2503 code LOC**, **311 complexity points**.
- 2 functions with CCN > 15 (lizard warnings): `addComponent` (CCN 23) and `useBoardViewer3D` hook (CCN 20).
- CSS view: **16 inline `style={{...}}` objects** + 6 `.map()` render paths (one nested for trace segments) → **worst-case DOM nodes for realistic 200-component board: 600–1200+ individually transformed elements**.
- WebGL file: **1000 code LOC of dead geometry code** (createCylinderGeometry 85 NLOC, etc.), **0 imports/usages** anywhere in client/src outside its own test.
- `DEFAULT_LAYER_STACK` (board-viewer-3d.ts:245) has **no `internal` layers** despite type + UI toggle support.
- Tests: 2826 LOC but **no stress/perf/large-board tests** (rg found 0 mentions of 200/500/render counts).

**Risk ratings** (High/Med/Low) attached to every item below with exact `file:line`.

**Research backing** (web_search "CSS 3D transforms performance many elements 2025"):
- CSS 3D promotes each `preserve-3d` element to its own compositor layer. Practical interactive limit ~50–100 elements. 500+ = jank/memory pressure/crashes on mobile. **No production PCB viewer (KiCanvas, tscircuit 3d, etc.) uses DOM CSS 3D for component geometry in 2025/26** — all use WebGL/Three.js/Canvas.
- Recommendation in results: "use WebGL directly or Three.js" for anything beyond "a few dozen" elements.

---

## 1. Lizard Deep Dive — Exact High-CCN Hotspots

**Command**: `lizard <file>` (v1.19.0, default thresholds >15 CCN or >1000 length flagged).

### BoardViewer3DView.tsx (504 NLOC analyzed, 1 warning)
- **handleUpdateDimensions (anonymous @465-477)**: **CCN 17**, 11 NLOC, 13 length.
  - Evidence (read_file 466-478): `parseFloat` x3 + 6 `isNaN`/range checks + conditional `setBoard` + `updateBoard` call with `.catch(() => undefined)`.
  - Why complex: mixed string<->number state (editWidth etc.), two persistence paths, silent failure.
  - Risk: **High**. Dimension edits are user-facing "Apply" path; silent errors hide data loss.

### board-viewer-3d.ts (881 NLOC, 2 warnings)
- **addComponent @403-431**: **CCN 23**, 22 NLOC.
  - Evidence (read 403-431): `pkg = get(...)`, 10+ `??` fallbacks, `crypto.randomUUID()`, `(pins ?? []).map(...)` creating new objects + nested UUIDs, `set` + `save` + `notify`.
  - Complexity sources: data normalization + package fallback + pin deep-copy + side-effects.
  - Risk: **High**. Called for every component placement; any new package or pin data increases branches.
- **useBoardViewer3D @1097-1189**: **CCN 20**, 57 NLOC, 93 length.
  - Evidence (read 1116-1189): `useState(0)`, `useEffect([], ...subscribe)`, **10+ `useCallback` wrappers**, then **every render** does `viewer?.getAllComponents() ?? []` + `buildScene()` + 10+ field returns (no memo on returned arrays/objects).
  - Also contains the long return literal.
  - Risk: **High**. Hook is the only React surface. Re-renders + full array copies on every tick from singleton notify.

Other notables (CCN 13):
- **updateComponent @444-484**: 10+ sequential `if (updates.xxx !== undefined)` blocks. Repetitive, easy to miss a field when adding properties. Risk: Med.

**webgl-viewer.ts**: Max CCN 7 (createCylinderGeometry 85 NLOC). No lizard warnings, but 69 functions / 1000 NLOC of pure dead weight.

**Lizard summary table** (excerpted):

| File                        | NLOC | Fun Cnt | Warnings | Highest CCN (loc)          |
|-----------------------------|------|---------|----------|----------------------------|
| BoardViewer3DView.tsx      | 504  | 21      | 1        | 17 (handleUpdateDimensions) |
| board-viewer-3d.ts         | 881  | 64      | 2        | 23 (addComponent), 20 (hook) |
| webgl-viewer.ts            | 1000 | 69      | 0        | 7 (createCylinder...)      |

---

## 2. scc Surface Stats

**Command**: `scc --by-file <3 files>`

- **Total**: 3 files, 3205 lines, **2503 code**, 334 comments, **311 complexity**.
- Breakdown:
  - webgl-viewer.ts: 1298 lines / 1000 code / 99 complexity
  - board-viewer-3d.ts: 1189 lines / 881 code / **186 complexity** (highest density)
  - BoardViewer3DView.tsx: 718 lines / 622 code / 26 complexity
- Estimated cost (organic COCOMO): $70k+ / 5 months for this surface alone.

This is **non-trivial** for a "view" feature. The model file carries most of the logic debt.

---

## 3. React/TS Smells (ast-grep + rg)

### Inline Styles in Render (performance + bundle)
- **16 occurrences** of `style={` in BoardViewer3DView.tsx (rg count).
- Locations (key ones):
  - Trace3DElement inner map (206-239): **per-segment `<div style={{ left, top, width, height, backgroundColor, transform: `translateZ(...) rotate(...)` }} />`** created on every render for every trace point pair.
  - ComponentBox (128-168), Via3DElement (272-316), substrate faces, etc. — every property recalculated, new object literal each time.
- No `useMemo` on style objects except one tiny `visibleSet`.
- **Smell rating**: High. Causes per-render object churn + style recalc + compositor layer pressure.

### .map() DOM Creation Loops (scalability)
- 6 top-level maps in render (rg -n):
  - 206: `trace.points.slice(0,-1).map(...)` → segment divs
  - 378: LAYER_ORDER.map (UI)
  - 534: VIEW_ANGLES.map (buttons)
  - 599: traces.map → Trace3DElement
  - 611: vias.map
  - 623: components.map → ComponentBox
- Keys present (`key={trace.id}` etc.), subcomponents are `memo()` — partial mitigation.
- But still: **for 200 components + 30 traces × 4 segments + 50 vias = ~1000+ DOM nodes** with `preserve-3d`, `perspective:800px` on ancestor, individual `transform: translateZ/rotate`.
- Per web research: this is exactly the anti-pattern that kills perf.

### useEffect / Hook Issues
- Two effects in View (429-442, 451-455): both depend on projectBoard.*Mm fields + set* (one includes `setBoard`).
- Hook effect (1118-1127): `[]` correct for subscribe, but every render still executes `viewer?.getAll*() ?? []` and `buildScene()` (expensive object graph copy) with zero memoization around the returned value.
- No `eslint-disable` found, but the hook return shape changes identity constantly → downstream re-renders.

### TS Safety
- **Zero** `any`, `as any`, `@ts-ignore` etc. in the three files (rg exhaustive scan caught only legitimate `!` null guards).
- Good. Debt is architectural, not type-unsafe.

### Other
- `document.createElement('a')` + `input.click()` in handlers (484, 492) — classic but works; no cleanup issues visible.
- No `key` missing on the critical maps.
- `unstable callbacks` mitigated by `useCallback` on handlers, but the data arrays from hook are new every time.

---

## 4. Dead Code + Duplication Audit

### WebGL Viewer is Completely Dead
- **ast-grep run --lang ts --pattern 'webgl-viewer' /client/src** → **0 results**.
- rg import search: only the view file and its own test reference the other two 3D modules. webgl-viewer.test.ts exists (960 LOC) but **no consumer** imports the engine.
- The file contains full Three.js-free manual geometry builders (`createBoxGeometry` 37 NLOC, `createCylinderGeometry` 85 NLOC with 103 length, `calculateLayerStack` 75 NLOC, raycast, etc.) + its own singleton.
- **Verdict**: 1000 LOC of high-quality but **unused, untested-in-prod, maintenance burden**. Violates "delete dead code" hygiene. Also creates false sense of "we have a WebGL path" when the active path is CSS.

**TD-3D-01 candidate**: Delete or integrate.

### Geometry / Package Duplication
- `PACKAGE_HEIGHTS` (BoardViewer3DView.tsx:36-46): 26 hardcoded entries (DIP/SOIC/QFP/QFN/SOT/0402...).
- `FootprintLibrary.getFootprint(pkg)` (used in ComponentBox 114-118): returns only `boundingBox` (width/height). **No `bodyDepth`/`height3d`** in the lib (rg on footprint-library.ts showed only 2D pad/silk heights).
- In lib/board-viewer-3d.ts: `BUILTIN_PACKAGES` (265+) defines 15 models with bodyWidth/Height/Depth/color — **separate map** from PACKAGE_HEIGHTS and from FootprintLibrary.
- **No hardware verification** of real part heights vs these maps (violates CLAUDE.md "Hardware & Component Verification Protocol").
- Overlap risk: changing a QFP height in one place leaves the others stale.

### Layer Duplication / Incompleteness
- `LAYER_ORDER` + `LAYER_LABELS` in View (73-93) includes `'internal'`.
- `LayerType3D` union includes it.
- `getLayerColor` handles `'internal'`.
- **But `DEFAULT_LAYER_STACK` (board-viewer-3d.ts:252-259) has exactly 7 entries — no internal copper layers at all.**
- `buildScene` (644) just maps the DEFAULT stack. Internal layers never appear in `scene.layers`.
- In View render, only substrate + top/bottom specific faces are hardcoded divs. No mechanism for 4/6/8 layer stack visualization.
- Risk: **High** for any board with >2 copper layers.

---

## 5. Performance & Scalability Risks (Critical)

**Worst-case DOM nodes (realistic 200-component board)**:
- 200 × ComponentBox (each creates 3 child divs for faces + label) = 800
- Assume 40 traces × avg 5 segments = 200 trace divs
- 80 vias × 3 faces = 240
- Substrate + ~8 layer faces + labels ≈ 20
- **Total ~1,260 individually `transform`ed, `preserve-3d` elements** under one `perspective:800px` ancestor.
- Every angle change or layer toggle re-renders the whole tree (React + browser style recalc + compositor).

**Missing guardrails** (rg confirmed):
- No `React.memo` on the root `BoardViewer3DView` (only on leaf boxes).
- No `useMemo` around `buildScene()`, component list, or expensive calculations in the hook.
- No `requestAnimationFrame`, no `ResizeObserver` debouncing, no culling, no LOD, no virtualization, no Web Worker for scene build.
- CSS 3D known issues explicitly called out in research: z-fighting (multiple faces at same Z), perspective distortion on large boards, transform performance cliff, no fallback.

**No canvas/WebGL path active** despite the dead 1298 LOC file that already has raycast/pick/geometry for exactly this.

**Camera state**: local `useState<ViewAngle>` — lost on navigation away from the route.

**Result**: The feature will appear to "work" on toy boards (the current test data) but will **degrade visibly and hit jank** as soon as users import or draw realistic designs. This is the #1 "shit that needs to be done" surface.

---

## 6. Architecture & Integration Debt

### Singleton + useProjectBoard Sync (the Plan 02 / E2E-228 comment debt)
- Evidence (BoardViewer3DView.tsx:422-442):
  ```ts
  // Plan 02 Phase 4 / E2E-228: drive the 3D singleton from the shared per-project board source of truth...
  const { board: projectBoard, updateBoard } = useProjectBoard(projectId);
  useEffect(() => { setBoard({width: projectBoard.widthMm, ...}); }, [projectBoard.*Mm, setBoard]);
  ```
- Only **dimensions** are synced (one direction on project change).
- Components, traces, vias, renderOptions, layer state live **only** in the `BoardViewer3D` singleton + its localStorage (`STORAGE_KEY`).
- `handleUpdateDimensions` (466) does both `setBoard` (immediate) **and** `updateBoard(...)` (async, fire-and-forget `.catch(() => undefined)`).
- **No reverse sync** for components added in 3D view back into the project board model.
- On load, `load()` in constructor restores full component list from localStorage **after** any projectBoard effect — last-writer wins, silent overwrite possible.
- Error handling on persist: minimal (try/catch in save/load, no user notification, no conflict resolution).
- Camera/viewAngle and layer toggles: **not persisted across route navigation or refresh**.

### Bidirectional / Canonical Source
- The comment admits the tension. The 3D view was retrofitted onto an existing `useProjectBoard` + PCBLayoutView world but kept its own rich mutable model.
- Drift surface: user adds component in 3D → only in localStorage. PCB layout or BOM sees nothing. Or vice-versa for board size.
- Risk: **High** for data integrity, multi-view consistency, and any future "undo across views".

### Other
- No layer stack depth / internal copper modeling (see duplication section).
- Export/Import scene JSON is ad-hoc and bypasses project storage.
- FootprintLibrary used only for 2D bbox in CSS path; WebGL path (dead) had its own package dims.

---

## 7. Test Quality Assessment

- **Volume**: 2826 LOC across 3 test files — appears thorough for unit level.
- **Coverage of high-CCN paths**:
  - board-viewer-3d.test.ts has 32 mentions of addComponent / pins / update — exercises the CCN 23 function with mocks for crypto/localStorage.
  - View test copies PACKAGE_HEIGHTS and renders the component tree.
- **Gaps (critical debt)**:
  - **Zero performance / scalability tests** (rg '200|500|perf|stress|virtual' returned nothing meaningful).
  - No visual regression (no screenshots, no Playwright trace of 3D viewport under rotation).
  - No "load a 150-component board and assert frame time or node count".
  - WebGL tests (960 LOC) test a dead engine that is never exercised by the app.
  - No tests for the exact sync failure modes between singleton load() and useProjectBoard (drift, partial projectBoard, etc.).
  - Browser checks in pp-view-3d/testing.md reference are manual only ("open 3D View, confirm no white screen").

**Verdict**: Tests prevent obvious regressions on happy paths but provide **no signal** on the performance cliff or architecture drift that will bite users on real boards. "Tests passed" does not equal "usable 3D view for EDA".

---

## 8. Other Findings (CLAUDE.md / pp-view-3d Gotchas Alignment)

- **UI Container Rule**: ScrollArea on right panel (647), but the 3D viewport itself is fixed-size based on board dims (`min(...,500)px`) inside `overflow-hidden`. For very large boards the perspective container may clip or require zoom that doesn't exist. Not a full scroll trap but close.
- **Warnings as defects**: No runtime warnings observed in static analysis, but the silent `.catch(() => undefined)` on updateBoard is a defect.
- **Hardware verification**: PACKAGE_HEIGHTS + BUILTIN_PACKAGES + FootprintLibrary 2D data have **never been cross-checked** against real manufacturer drawings for the listed packages. Violates mandatory protocol.
- **Self-improvement log**: Pending items (screenshots, more gotchas) still open — this audit can feed it.

---

## Recommendations Summary (see checklist for actionable TD-3D-*)

1. **Kill or integrate WebGL** (P0) — 1298 LOC dead weight.
2. **Refactor the 3 CCN>12 functions** (addComponent, hook, handleUpdateDimensions) — break the if-cascades and return-value churn.
3. **Replace or virtualize the CSS 3D** — move to @react-three/fiber (already a project dep per memory) or at minimum a Canvas + 2D projection for static boards. CSS 3D cannot scale.
4. **Add performance guardrails** — memoize scene, virtualize component list when >50, measure node count in dev, add RAF for interactions.
5. **Complete layer model + canonical sync** — make internal layers real, decide whether 3D view is read-only mirror or first-class editor, add proper bidirectional + conflict UI.
6. **Hardware data unification** — single source of truth for package 3D dims, verified against datasheets.
7. **Test upgrade** — add load tests, visual regression on viewport, cross-view sync invariants.

All claims above cite specific lizard output, rg line numbers, read_file excerpts, scc numbers, and external research.

---

## Appendix: Exact File:Line References Used

- High CCN: board-viewer-3d.ts:403 (addComponent), :1097 (hook), BoardViewer3DView.tsx:465 (handleUpdate)
- Inline styles: BoardViewer3DView.tsx:206 (trace segments), 128 (ComponentBox), 272 (Via)
- Maps: :599,611,623 (scene), :206 (nested)
- Sync comment: :422
- Layers: board-viewer-3d.ts:252 (DEFAULT_LAYER_STACK — no internal), :35 (type), View:84 (LAYER_ORDER)
- PACKAGE_HEIGHTS: View:36
- WebGL size: scc + lizard
- Dead code: ast-grep + rg import searches (0 results)
- Tests: wc + rg on test files (no perf numbers)
- Research: web_search results on CSS 3D limits + real PCB viewers.

**End of report**. Next step: actionable checklist in `phase-4-checklist-3d.md`.