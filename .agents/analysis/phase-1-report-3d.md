# Phase 1 — Current State Inventory (3D View Scoped)

**Date:** 2026-05-18  
**Agent:** Current State Inventory (3D View only)  
**Scope:** ProtoPulse BoardViewer3DView + board-viewer-3d.ts (the active CSS 3D implementation). Excludes breadboard-3d.ts (separate breadboard view), webgl-viewer.ts (dead code, 0 prod refs), and all other views.  
**Sources (read + searched):**  
- `client/src/components/views/BoardViewer3DView.tsx` (full 719 LOC)  
- `client/src/lib/board-viewer-3d.ts` (full 1190 LOC)  
- `.agents/analysis/phase-0-metrics-3d.md`  
- `.agents/skills/pp-view-3d/references/page-map.md` + SKILL.md + ux-contract.md + gotchas.md + testing.md  
- ViewRenderer, lazy-imports, view-prefetch, project-context, ProjectWorkspace, sidebar-constants, PCBLayoutView (View3DButton), useProjectBoard, footprint-library.ts, and exhaustive rg/ast-grep/fd for call sites.  
- Explicit runs: `rg "BoardViewer3D|addComponent|useBoardViewer3D" client/src --glob "!*.test.*"`, fd for 3D files, multiple ast-grep structural searches.

**Purpose:** Exhaustive factual inventory of shipped behavior. "Exists and works", "exists but partial", "wired but dead", "missing". All claims cite exact functions, lines, or files. No speculation.

---

## 1. Entry Points & Navigation

**Primary route:** `activeView === 'viewer_3d'` in `ViewRenderer.tsx:195-201`:
```tsx
{activeView === 'viewer_3d' && (
  <ErrorBoundary>
    <Suspense fallback={<ViewLoadingFallback />}>
      <BoardViewer3DView />
    </Suspense>
  </ErrorBoundary>
)}
```
- `ViewLoadingFallback` = `PanelSkeleton` (rows=5).
- Lazy import: `lazy-imports.ts:71`: `export const BoardViewer3DView = lazy(() => import('@/components/views/BoardViewer3DView'));` (plain lazy, **not** the `lazyWithRetry` wrapper used by some other views).
- Prefetch: Tier 3 in static queue (`lazy-imports.ts:129`); context-aware via `view-prefetch.ts:157` (loader registered), priority 7 from `pcb` (`view-prefetch.ts:65`), and self-prefetches `pcb`+`ordering` (`view-prefetch.ts:104-106`).

**Navigation surfaces that reach it (all call `setActiveView('viewer_3d')` via `useProjectMeta`/`project-context`):**
- Sidebar: `components/layout/sidebar/sidebar-constants.ts:63`: `{ icon: Box, view: 'viewer_3d', label: '3D View' }` (in main nav list, after Knowledge). Description: `tabDescriptions.viewer_3d = '3D PCB board visualization and mechanical fit check'` (line 107).
- PCB Layout toolbar: `PCBLayoutView.tsx:134-154` (`View3DButton` component) + usage at `1034`: small `<button data-testid="pcb-view-3d">` with Box icon + "3D" label. Placed in top toolbar next to routing status/zoom.
- Command palette: `command-palette.tsx:111`: `{ id: 'nav-viewer-3d', label: '3D View', icon: Box, ... onNavigate('viewer_3d') }`.
- Quick jump, role-presets (`role-presets.ts:91,133`), mobile-bottom-nav (`mobile-bottom-nav.ts:131`), panel-explainer (`panel-explainer.ts:320-321` has dedicated section), tutorial-navigation, view-onboarding, sidebar-groups.
- URL deep-link support via `ProjectWorkspace.tsx` normalizeRequestedView + history (standard for all ViewMode).

**ViewMode type:** `project-context.tsx:141` includes `'viewer_3d'` (one of ~35 modes).

**No other entry points.** Not reachable from component editor, schematic, etc. except via global nav or the one PCB button.

---

## 2. Rendering Surface

**Technique:** Pure CSS 3D transforms (no Three.js, no WebGL, no @react-three/* in active path). Confirmed by imports + JSX in `BoardViewer3DView.tsx` + phase-0 metrics.

- Container (`data-testid="board-3d-viewport"`, lines 559-563): `perspective: '800px'`, bg from `renderOptions.backgroundColor`.
- Scene (`data-testid="board-3d-scene"`, 564-573): `transformStyle: 'preserve-3d'`, sized to `min(board.w*2.5,500) x min(h*2.5,400)`, `transform: rotateX/Y` from `VIEW_ROTATIONS[viewAngle]`, 0.5s transition.
- All faces/elements: `absolute`, `transformStyle: 'preserve-3d'`, `translateZ(...)` + `rotateZ`/`rotateX` for 3D stacking. No pointer events on most (traces etc.).

**Supported elements (what actually renders in JSX 575-641):**
- **Board substrate** (`data-testid="board-substrate"`): solid div with `boardColor`, border-radius from `cornerRadius`, box-shadow. Always present.
  - Child "solder mask top" overlay: `solderMaskColor`, 0.6 opacity, `translateZ(thickness*scale)`.
  - Child edge label: dimensions text at z = thickness*scale + 2.
- **Traces** (`traces.map`): `Trace3DElement` (176-242). Per-trace: invisible parent + one absolutely positioned rotated div **per segment** (points.slice(0,-1)). Color from `TRACE_LAYER_COLORS` (top-copper #cc5533, bottom #3366bb). `zOffset` based on layer. Width from trace.width. No actual copper layer "div" — traces float above substrate.
- **Vias** (`vias.map`): `Via3DElement` (248-316). Outer copper ring (top face at thickness*scale, #b87333), inner drill hole (darker, +0.1px z), bottom face ring (no z, always bottom). Uses outer/inner diameter % of board. `data-testid` hooks on parts.
- **Components** (`components.map`): `ComponentBox` (107-169, memoized). Uses `FootprintLibrary.getFootprint(pkg)` for boundingBox (width/height) or falls back to `component.body*`. Depth = `PACKAGE_HEIGHTS[pkg] ?? bodyDepth`. Position % of board, `translateZ(zOffset)` (top: +thickness*scale, bottom: -depth), `rotateZ(rotation)`. Three faces: top (full color 0.9), side (rotatedX 90deg, 0.7), label refDes (z+1, white/70 mono 0.5rem). `data-testid="component-3d-${id}"`.
- **No rendering of:**
  - `drillHoles` (model + API fully support `addDrillHole`/`getAllDrillHoles`/`buildScene`, but **zero** `<DrillHole...>` or map in JSX).
  - Silkscreen, solder mask (beyond the one mask overlay div), internal copper, or any per-layer geometry divs. `LAYER_ORDER` / scene.layers exist only for the side panel.
  - No actual 8-layer stack visual divs — substrate + mask overlay + floating traces/vias/components only.

**Camera:** Exactly 7 presets (`VIEW_ANGLES:75`, `VIEW_ROTATIONS:61-69`):
- top (0,0), bottom(180,0), front(90,0), back(-90,0), left(90,-90), right(90,90), isometric(45,45).
- `getCameraForView` (lib:715-751) returns full `CameraState` (position/target/up/fov/zoom) but **never used** in the view (only the CSS rotate values drive the UI; `cameraForView` exposed in hook but unused in `BoardViewer3DView`).
- **No mouse, no zoom, no pan, no orbit, no raycast.** Pure button-driven CSS rotate + transition. Reset button forces 'isometric'.

**Scale:** Hardcoded `scale=2` (px per mm for depth) in view:458.

**Data-testid coverage:** Excellent on viewport, scene, substrate, components, traces/segments, vias (outer/hole), dimensions, layers, edit fields, buttons, angles. Used in `BoardViewer3DView.test.tsx`.

---

## 3. Controls & State

**All controls live in `BoardViewer3DView.tsx:508-717` (right sidebar is `ScrollArea w-52`).**

**Layer visibility toggles:**
- `LayerVisibilityPanel` (360-400): 8 checkboxes in `LAYER_ORDER` order (top-silk → bottom-silk), using `scene.layers` for color swatches + `LAYER_LABELS`.
- `toggleLayer` (460-464): `BoardViewer3D.getInstance().setLayerVisible(layer, !isVisible)`.
- State: `layerVisibility` from hook (array of visible LayerType3D).
- **Wired but dead for visuals:** `setLayerVisible` + notify + `buildScene` sets `.visible` on layers. Panel reflects it. **But viewport JSX (599-632) renders traces/vias/components unconditionally.** No `visible` checks, no conditional classes, no opacity=0 on hidden layers. Only metadata. (Traces/vias not even mapped to layers in rendering.)

**View angle buttons (532-556):**
- 7 `<Button data-testid={`view-angle-${angle}`}>` + reset (RotateCcw) that sets local `viewAngle` state (isometric default). Drives the CSS transform. Fully functional.

**Dimension live edit (658-712):**
- 3 `NumberInput` (width/height 1-500 step 0.1, thickness 0.4-3.2 step 0.1) bound to local `edit*` state.
- Sync effect (451-455): keeps edit fields in sync with `projectBoard` (so edits elsewhere update the inputs).
- "Apply" button: `handleUpdateDimensions` (466-478):
  - Parses + validates >0.
  - Calls `setBoard(...)` (local singleton for snappy UI).
  - If projectId>0: `updateBoard({widthMm, heightMm, thicknessMm})` (server + React Query cache, so PCBLayout/PcbOrdering see it).
  - Note: cornerRadius not editable here (read-only in display, synced from server).
- `BoardDimensionsDisplay` (323-354): read-only 4 values (w/h/thick/radius) with testids.

**Render options:**
- `renderOptions` fully in model/hook (`DEFAULT_RENDER_OPTIONS:227`, `setRenderOptions`, `getRenderOptions`).
- **Used in JSX:** only `backgroundColor`, `boardColor`, `solderMaskColor`.
- **Wired but dead:** `showComponents`, `showTraces`, `showVias`, `showDrills`, `showSilkscreen`, `showSolderMask`, `showBoardEdge`, `transparentBoard`, `componentOpacity`, copper/silkscreen colors (beyond the 3), etc. No checkboxes, no calls to `setRenderOptions` anywhere in `BoardViewer3DView`. (Exposed via hook for external use; none exists.)

**Export / Import scene JSON (517-526, 480-506):**
- Export: `handleExport` → `exportScene()` (lib:843-853: JSON of board + all comps/vias/traces/drills + renderOptions; **no layerVisibility**), blob download `board-3d-scene.json`.
- Import: `handleImport` → file picker → `importScene(text)` (lib:856-949: parses, validates board/comps/vias/traces/drills, applies (clears + sets maps), merges renderOptions, **does not touch layerVisibility**, save+notify).
- Both fully functional on the singleton. Buttons always visible in header.

**Component count badge:** Header `components.length` (from hook).

**No other controls:** No "add component", no component list/inspector, no trace/via editor, no clear button, no reset-to-project button, no real-time sync toggle.

---

## 4. Data & Sync

**Core pattern:** `BoardViewer3D` singleton (class:304-1087) + `useBoardViewer3D` hook (1097-1189).
- Singleton: private Maps for components/vias/traces/drillHoles + packageModels + layerVisibility + renderOptions. `subscribe`/`notify` for React. `load()`/`save()` on every mutation (localStorage `STORAGE_KEY = 'protopulse-board-viewer-3d'` at 218).
- Hook: subscribes once, forces tick re-render, returns stable callbacks + live snapshots from `getInstance()`. Returns `scene: buildScene()` on every access.
- Public API surface (types + methods): full `Add*Input`, `UpdateComponentInput`, `get*`/`add*`/`remove*`/`update*` for all 4 entity types, `buildScene`, layer vis, render opts, measure, package models, export/import, clear, setBoard etc. (documented in header 1-19).

**Sync from useProjectBoard (`BoardViewer3DView:425-442`):**
- `useEffect` on `[projectBoard.widthMm, ... , setBoard]`: calls `setBoard({width, height, thickness, cornerRadius})`.
- One-way: server/project → 3D singleton (on mount + any external change).
- Edit path (handleUpdateDimensions): 3D setBoard + (if project) `updateBoard` patch (server merges; comment at 422-424 cites "Plan 02 Phase 4 / E2E-228").
- **Bidirectional only for board dimensions.** No other fields.

**Component / trace / via / drill population:**
- `rg` + ast-grep + manual search: **zero production calls** to `addComponent` / `addVia` / `addTrace` / `addDrillHole` (or equivalents) on `BoardViewer3D` or via the hook outside the lib itself and tests.
  - Only internal: lib examples/docs + `BoardViewer3DView` (no calls) + other unrelated `addComponent` (circuit-dsl, thermal, community-library).
- `components` array in hook always comes from singleton (initially empty or localStorage).
- On real project load (even 60-part board from PCBLayout): 3D shows 0 components. Badge says "0 components". Board shape from project, nothing else.
- `FootprintLibrary` (used only for box sizing in `ComponentBox:114`) + `PACKAGE_HEIGHTS` (36-46, 25 entries) provide visual defaults when manually added.

**Persistence & import as population path:**
- localStorage always loads on singleton ctor (331).
- Export/Import is the **only user-facing way** to populate a non-empty scene.
- Global (not per-project) → data from one board leaks to another until overwritten by dim sync or import.

**Scene builder (`buildScene:644-689`):** Computes layer stack from `DEFAULT_LAYER_STACK` (244-259, 2-layer only, with zOffsets/thicknesses), positions components (top z=thickness, bottom z=-depth), returns all entities + visible flags. Used by panel + hook return + tests.

**No live reflection of actual PCB data:** PCBLayout uses `Circuit*Row` + its own placer/renderer (pcb-layout/*). Separate models. Comments in useProjectBoard and PCBLayout acknowledge the intent for sharing board dims only.

---

## 5. Dependencies & Contracts

**Types exported (lib:27-157):** `LayerType3D` (8 values incl. 'internal'), `ComponentSide`, `ViewAngle` (7), `Point3D`, `BoardDimensions`, `Component3D` (full with pins[]), `Via3D`, `Trace3D`, `DrillHole3D`, `BoardScene`, `CameraState`, `RenderOptions` (13 fields, many unused in UI), `MeasurementResult`, `PackageModel`, plus all Add/Update inputs.

**FootprintLibrary** (`lib/pcb/footprint-library.ts`): ~20 packages (DIP-*, SOIC-*, SOT-23/223, QFP-*, TO-220/252, 0402-2512, QFN-32, SOP-8, diodes). Provides `boundingBox`, `pads[]`, courtyard, silkscreen (unused in 3D render), mountingType. `getFootprint` + `getAllPackageTypes`. Used **only** by 3D `ComponentBox` for sizing (not for pin viz).

**PACKAGE_HEIGHTS** (BoardViewer3DView:36-46): 25 entries (DIP all 5mm, SOIC 1.75, SOT 1.1, QFP 1.6, QFN 0.85, TO 4.5/2.5, passives 0.5-0.8, SOD*). Overlaps but not identical to lib's bodyDepths or BUILTIN_PACKAGES (lib:265-287, 15 models, different depths).

**BUILTIN_PACKAGES** (lib only, for addComponent fallback): 15 entries, used to seed `packageModels` map.

**Persistence contract:** localStorage key `'protopulse-board-viewer-3d'`. Full roundtrip for board/comps/vias/traces/drills/renderOptions + layer vis map. load() is forgiving (skips bad entries). No projectId scoping.

**Other contracts:**
- `useProjectBoard` provides the board row (shared with PCBLayoutView + PcbOrderingView per its JSDoc).
- No dependency on actual netlist, footprints from placed components in PCB, or routing data.
- `BoardViewer3D.resetForTesting()` + subscribe for tests.

---

## 6. Developer Markers & Incomplete Sections

**Explicit:**
- `BoardViewer3DView.tsx:422`: `// Plan 02 Phase 4 / E2E-228: drive the 3D singleton from the shared per-project board source of truth...`
- Lib header (8-9): "This is the data model and rendering logic — not the actual Three.js rendering (which would be a React component). Think of it as the scene graph builder." (historical note; reality is CSS, WebGL sibling is dead).
- "internal" layer: present in `LayerType3D`, `LAYER_ORDER:89`, `DEFAULT_LAYER_STACK` (no entry for it — only 7 layers defined), `getLayerColor` fallback to copper. No data population or rendering path. Stub for 4+ layer boards.
- Drill holes: full model/API/persist/import/export/buildScene, zero rendering or UI.
- Many `RenderOptions` fields + `setRenderOptions` fully implemented + persisted + hooked, zero UI surface or usage in rendering path (beyond 3 colors).
- Layer visibility: full toggle API + panel + scene.visible, zero effect on rendered elements.
- No silkscreen geometry, no per-layer copper pours, no actual via plating visuals beyond the simple rings+hole, no component pins rendered in 3D (only body box + label), no measurement UI (API exists), no camera state application.

**From phase-0:** CCN hotspots in `addComponent:403-431` (23), hook itself (20), `handleUpdateDimensions` anon, `updateComponent`. Inline style churn, potential 400+ DOM nodes, no virtualization.

**WebGL sibling:** 1298 LOC + 960 tests, 0 references outside its tests (`rg` confirmed). Comment claims it is "the rendering engine layer beneath" but never wired.

**Other 3D:** `breadboard-3d.ts` (separate singleton for BreadboardView 830-point model + wires + A* routing). Not connected to viewer_3d.

**No feature flags.** All "dead" code is simply unconsumed (no if/ternary guarding).

---

## 7. Call Site Audit (from rg + ast-grep)

- `BoardViewer3D` / `useBoardViewer3D` / `addComponent` (3D-specific): **Only inside `BoardViewer3DView.tsx` (import + destructuring + one `getInstance()` for toggle) and the lib itself.** Zero external production callers for scene population or control.
- Lazy + prefetch + ViewRenderer: the documented paths.
- `PCBLayoutView` only mentions in comments + the nav button.
- `useProjectBoard` JSDoc only (no 3D component data).

---

## Summary Tables

**Controls Status:**

| Control | Exists | Functional (visuals) | Notes / Citations |
|---------|--------|----------------------|-------------------|
| 7 view angle buttons + reset | Yes | Yes (CSS) | 533-555; VIEW_ROTATIONS:61 |
| Layer checkboxes (8) | Yes | No (panel only) | LayerVisibilityPanel:378, toggleLayer:460, setLayerVisible:774; no use in 599-632 render |
| Dim NumberInputs + Apply | Yes | Yes (dims + server) | 665-710, handleUpdateDimensions:466 (setBoard + updateBoard) |
| Export JSON button | Yes | Yes | 518, handleExport:480, exportScene:843 |
| Import JSON button | Yes | Yes (partial: no layers) | 522, handleImport:491, importScene:856 |
| Render option toggles | Partial (model) | No | Many fields in RenderOptions:121, never set in view |
| Add/populate components UI | No | N/A | No buttons, lists, or calls |
| Drill / trace / via editors | No | N/A | Model only |
| Mouse camera | No | N/A | Explicitly absent |

**Data Sync Status:**

| Direction | Board Dims | Components/Traces/Vias/Drills | Citation |
|-----------|------------|-------------------------------|----------|
| Project → 3D | Yes (effect on load/change) | No | 429-442 |
| 3D → Project | Yes (on Apply) | No | 474-475 |
| 3D localStorage | Yes (all) | Yes (all) | 978-996, ctor:331 |
| Export/Import | Yes | Yes (import skips layer vis) | 842-949 |
| From real PCB netlist/placement | No | No | useProjectBoard only dims; PCBLayout separate models |

**Rendered vs Modeled Elements:**

- Modeled + rendered: Board substrate + mask overlay, traces (segment divs), vias (rings+hole), component boxes (3 faces + label).
- Modeled only: drillHoles (full CRUD), internal layer, full RenderOptions, layer vis flags (for scene but ignored), silkscreen data in footprints, CameraState (computed but unused), measurements.

---

**End of inventory.** All claims directly traceable to the cited files/lines from the reads and searches performed 2026-05-18. This is the source of truth for subsequent analysis phases.
