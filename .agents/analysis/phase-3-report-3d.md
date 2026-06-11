# Phase 3: UX & Workflow Evaluation — 3D View (Scoped to BoardViewer3DView)

> **Date:** 2026-05-18
> **Scope:** ONLY BoardViewer3DView.tsx, useBoardViewer3D hook + singleton (board-viewer-3d.ts), immediate useProjectBoard integration, CSS 3D render path, camera/layer/dim controls, export/import. Excludes general app, PCBLayoutView internals, WebGL dead code except noted.
> **Personas:** Hobbyist maker (verifying fit on starter board), Professional EE (clearance checks on dense 6-layer), Hardware startup founder (enclosure review / team share)
> **Contract baseline:** .agents/skills/pp-view-3d/references/ux-contract.md (Must Hold True + Layout Rules)
> **Key discovery from prior phases:** Zero production code path populates the 3D scene with real project PCB components/traces/vias (confirmed via ast-grep across *.ts*).

## Executive Summary

The 3D Board View implements a pure-CSS 3D transform scene (perspective + rotateX/Y on container, translateZ + rotate on absolutely-positioned child divs for every component face, trace segment, via). It offers 7 camera presets, layer checkboxes (non-functional for visuals), local board dimension live-edit (requiring Apply), and JSON scene export/import.

**Single worst UX blocker:** The feature is fundamentally disconnected from real hardware data. For any project loaded via useProjectBoard, the view shows only an empty colored rectangle (0 components badge, no parts, no traces). The singleton starts empty; no addComponent/addTrace calls exist outside tests. All persona workflows for "verifying fit", "checking clearance", "showing the team it fits" are dead on arrival — the view is a non-blank but content-free sandbox.

This single gap makes the entire ~3.2k LOC surface feel like a prototype, not a tool ready for real hardware work. Secondary blockers (non-functional layers, no mouse orbit, perf cliff on dense boards, confusing dim update, inaccessible labels) compound it.

The CSS approach creates hundreds of DOM nodes with inline 3D styles per board; on real 150-part boards this will jank or lock tabs. Layer visibility, measurement, and selection are promised by UI affordances (Ruler icon, Eye icon, data-testid on every element) but not delivered.

## Visual & Layout Audit vs. ux-contract

### Violations of "Must Hold True"
- 3D Board View visible? Yes, always renders a non-blank substrate. But content (real parts) invisible → misleading.
- Camera Controls visible? Yes, row of 7 small buttons + reset above viewport.
- Nonblank Rendering: Yes (always shows board rect + label).
- Performance: Not visible; silent heavy DOM on any populated board.
- Important actions clear labels? Partial: buttons have text, but Apply for dims is buried; Export/Import have icons+text but no tooltip explaining purpose ("for devs/debug?").
- Secondary actions crowd? Right panel (w-52) always present; no collapse. On laptop (<1200px wide) competes directly with scene.
- Long menus/panels scroll? Right ScrollArea yes; camera row wraps.
- Error/empty/loading understandable? No dedicated states. 0-component board looks like "working board" with nothing on it. No "load from PCB layout" call-to-action.
- AI data marked? N/A.

### Layout Rules Violations
- No nested cards (good — right panel Cards are siblings in ScrollArea).
- Text stays in container? RefDes labels (text-[0.5rem] white/70) on small SMDs (0402 etc) clip or unreadable; absolute inside transformed parent.
- Laptop-height viewports: Critical failure. Scene inner div uses fixed calc `min(board.width*2.5, 500)px` independent of container. On 768px laptop or portrait, viewport flex-1 shrinks below scene size → overflow-hidden clips the 3D or forces tiny unusable view. Camera buttons + 208px panel leave <400px for scene on many laptops. No responsive scaling of the 3D model.
- Fixed heights? The scene container has explicit px; outer uses flex-1 + min-h-0 but inner absolute children don't adapt. Perspective div + many absolute children risks z-fighting when many overlapping traces/components at same Z.

**Screenshot-in-words of friction (laptop 1280x800, typical dev laptop):** Header (title + 2 buttons). Camera button row (wraps to 2 lines). Below: ~450px tall 3D area (centered fixed 300x240px board rect with tiny labels) next to 208px tall right panel (3 stacked cards: dims display, 8-layer list, edit form with 3 inputs + Apply). The board rect looks "floating" and small; trying to inspect a component means the fixed-size 3D doesn't fill available space, and rotating via button jumps without mouse feel.

## Persona Workflow Traces & Friction Points

### Persona 1: Hobbyist maker verifying fit on 30-part starter board

**Intended workflow:** Open 3D View for project → see populated board → rotate to check mechanical clearance under board or against enclosure walls → toggle layers to focus on copper → measure critical distances → export clean view for docs.

**Actual steps & breaks:**
1. Navigates to 3D View (via workspace nav, reachable). Sees header "3D Board Viewer" + "0 components" badge (from singleton, never fed project parts).
2. Board rect (default 100x80mm green) centered. No parts, no silkscreen, no traces. Looks like blank PCB ready for assembly, not a designed board.
3. Clicks isometric (default), top, bottom, front etc. View rotates via CSS transition (smooth 0.5s). Can "see under" but nothing there.
4. Tries layer checkboxes (8 layers in right panel). Clicks — state toggles in singleton (visibleLayers updates, re-render), but NO visual change in scene. Traces/Components always drawn. Contract violation: "Important actions have clear labels" but action has zero effect.
5. Wants to measure distance between pads? Ruler icon only in static dims card; no interactive ruler or measure tool in UI or scene (lib has measureDistance but not exposed).
6. Edits dims? Types in NumberInputs — nothing happens live. Must click "Apply" (small button). If mistyped, silent NaN guard. Syncs from other views via useEffect but feels like two UIs.
7. Export? Gets JSON of empty scene. Useless for sharing "my board fits".

**Frictions:** Empty data makes feature pointless for verification. No discoverable way to load real parts. Layer UI lies. No measurement. Tiny labels on hypothetical small parts would be illegible.

### Persona 2: Pro EE clearance check on 150-component 6-layer board

**Intended:** Load complex project → rotate/isometric + bottom view to check tall inductor (TO-220 15mm bodyDepth per PACKAGE_HEIGHTS) vs bottom clearance → toggle internal/copper layers to inspect routing density without soup of overlapping divs → verify via drill sizes visually.

**Actual:**
1. Same 0-component board. Even if data were wired, 150 ComponentBox + avg 4-8 Trace3DElement segments each (hundreds of absolute divs with per-seg inline style + transform: rotate/translateZ) would create heavy DOM. No culling, no contain: paint, style, layout thrash on every camera change or edit.
2. Bottom angle: components on bottom side would have negative Z in model but render code in ComponentBox uses zOffset = side==='top' ? thickness*scale : -depth; sides drawn as rotated divs. CSS 3D stacking context + many siblings → likely z-order errors, faces intersecting incorrectly on dense layout (known CSS 3D gotcha).
3. Layer toggle for 'internal' (placeholder in LAYER_ORDER, no geometry generated for multi-layer copper) does nothing useful.
4. No x-ray/clipping, no section view, no height callouts. Clearance check requires eyeballing transformed divs — imprecise and frustrating vs. real CAD.
5. Performance: 400 traces * 5 segments = 2000 divs. Each render of parent (any setViewAngle, any keystroke in dim fields) causes React to reconcile map creating style objects. Drops to jank even before 5fps. No will-change, no React.memo on parent, no transition.

**Frictions:** Even post-wiring, unusable for pro work. "Soup of overlapping divs" exactly as feared. No tools for the actual verification task.

### Persona 3: Founder in review — "does this fit in the enclosure?"

**Intended:** Quick clean 3D screenshot or exported view with dimensions + key components visible, shareable to mechanical team or investors.

**Actual:**
1. Opens view — empty board again.
2. No "photo mode" (hide UI, high-quality render, orthographic, annotations). Raw CSS scene with debug border/shadow.
3. Export JSON not visual. No built-in screenshot button (though browser print could work, but UI chrome pollutes).
4. Dimension display is static card, not overlaid nicely on export.
5. If populated, tiny refDes labels + arbitrary component colors + no consistent silkscreen would make "professional" export look toy-like.

**Frictions:** No export path for the stated review use-case. Feature doesn't support the "show the team" story.

## Control Surface & Discoverability Audit

### Camera Presets (7 angles + reset)
- Located top of viewport, small h-7 px-2 text-[11px] buttons. Current angle uses variant="default" (filled) vs outline — good visual state.
- Clicking instantly sets state, CSS transition animates the rotate.
- Feedback: yes (active style). But no orientation gizmo/cube (industry standard from KiCad/Fusion), no mouse drag orbit/pan/zoom (only discrete jumps). Reset always to isometric.
- On wrap (small screen) they crowd header area.
- Discoverability: obvious once looking at viewport, but first-time user may miss they control the 3D below.
- Contract: "Camera Controls is visible enough" — borderline, works for basic but not pro expectation.

### Layer Checkboxes (LAYER_ORDER 8 layers)
- In right ScrollArea Card "Layers", Checkbox + color swatch + Label for each.
- Toggles call toggleLayer → BoardViewer3D.setLayerVisible → notify → re-render hook.
- **But the render JSX never consults layerVisibility for hiding:** traces/vias/components always rendered full. Solder mask div, substrate always present. Visibility only affects the `scene` data object passed to panel.
- 'internal' layer is dead placeholder (no code generates internal copper geometry).
- Result: UI promises control, delivers none. Major contract violation.
- For real use: pro EE needs per-layer copper visibility for clearance; here impossible.

### Dimension Live-Edit + Persist
- Three NumberInput (string state editWidth etc) + "Apply" Button in "Edit Board" Card.
- Typing updates local strings only (no live preview on board until Apply).
- Apply: parses, guards >0, calls setBoard (singleton) + updateBoard (server via useProjectBoard).
- Sync useEffects: projectBoard changes (from other views) update the edit fields; 3D board dims update from server on load.
- Feels like "two separate systems" (local singleton for snappy UI vs server). User expects live drag or instant apply on blur/enter.
- No live board resize preview while typing. No undo.
- Evidence: handleUpdateDimensions + two useEffects around lines 426-477 in BoardViewer3DView.tsx.

### Export / Import Scene JSON
- Header buttons (Download/Upload icons + "Export"/"Import" text).
- Export: JSON of current singleton (board + all comps/traces from memory/localStorage).
- Import: file picker → importScene (mutates singleton, notifies).
- **For whom?** Buried in header, no description, no example use ("save a view for later", "share debug scene", "load sample board").
- Since data is empty by default, mostly for internal/debug or future wiring. Not discoverable or useful for founders.
- No validation feedback on import errors beyond silent catch.

## Accessibility & Keyboard Audit

- Scene container (`#board-3d-viewport`): no role, no aria-label, no aria-live for "View changed to isometric" or "Layer top-copper hidden".
- Camera buttons: native <Button> (focusable), good. But no keyboard support inside scene for orbiting or selecting a refDes (no tabindex on ComponentBox, no key handlers).
- Component selection: data-testid present, but no onClick, no focus styles, no announced selection.
- Labels: `text-white/70 text-[0.5rem]` on `component.color` (often #1a1a1a dark or arbitrary). Contrast fails on light components or when viewed at angle (small text over texture). WCAG risk.
- Right panel labels/checkboxes: standard, ok.
- No reduced-motion respect (though transition is 0.5s).
- Overall: A11y grade D for the interactive 3D surface. Relies on mouse + visual-only.

## Performance UX (Silent Killer)

- Every trace: trace.points.slice(0,-1).map → new div per segment with 6+ inline style props (left/top/width/height/transform/background).
- Components: one outer + 3 faces + label div per part.
- Vias: multiple divs.
- Parent re-render (viewAngle change, any edit* setState on keystroke, projectBoard sync) re-creates all these elements.
- Memo on Trace3DElement/ComponentBox/Via helps child, but style object churn + transform recalc in browser still expensive.
- No CSS contain, will-change: transform on animated elements, no virtualization, no LOD.
- For 400 traces realistic board: >2k DOM nodes in 3D subtree. 60fps impossible; likely 5-15fps or tab jank on mid hardware.
- useEffect deps include many, potential extra renders.
- React 19 features (transitions for dim edits) not used.
- Evidence: Trace3DElement lines ~140-170, render maps ~580-610 in BoardViewer3DView.tsx. CCN hotspots in lib confirm.

**Prediction:** On any real dense project the 3D view will feel broken long before data wiring completes.

## States Audit

- Empty board (0 components, default projectId=0 or unloaded): Renders clean green rect + "0 components" badge + dims. Looks functional but conveys no design. No empty-state illustration or "Populate from PCB Layout" primary CTA. Violates "Error, warning, empty... understandable".
- Loading large board data: No isLoading from useProjectBoard consumed; always renders stale/default. Sync effect may flash old→new dims.
- Error fetching footprints or projectBoard: Silently falls to defaults (no error UI in view).
- Non-blank: Always true — never a white nothing. Good on that narrow contract point, but misleading because populated state is also "blank" of meaning.
- No skeleton for the 3D rect while data would load.

## Research Insights (EDA 3D Viewers)

From web research on KiCad 3D, EasyEDA, tscircuit 3d-viewer, CAD UI patterns:
- Industry standard: OrbitControls (mouse drag orbit/pan/zoom) + ViewCube gizmo for presets. Discrete buttons only is 1990s tier.
- Layer panel: Hierarchical, eye icons, opacity sliders, search, X-ray mode, per-copper-layer control. Our flat 8 checkboxes with non-op effect is far behind.
- Labeling: Billboarded always-camera-facing labels or hover tooltips, not fixed tiny text inside 3D. Scale with zoom. Our text-[0.5rem] fixed in 3D space fails readability.
- Data integration: 3D viewers consume the actual board JSON/netlist/STEP models from the 2D editor. Ours has architectural split (singleton vs projectBoard) with zero bridge.
- Performance: WebGL instancing + LOD or Canvas 2D fallback for labels. CSS 3D transform per element does not scale past ~50 objects.
- Export: Screenshot with transparent UI + dimension callouts, GLTF, or animated GIF. Our JSON is dev-only.

These gaps explain why the feature doesn't feel like a "real" EDA tool.

## Contract Mapping Table

| Contract Clause | Violation Evidence | Severity |
|-----------------|--------------------|----------|
| 3D Board View visible enough | Always non-blank but 0 real content for users | High |
| Camera Controls visible | Buttons present but limited (no orbit) | Med |
| Nonblank Rendering | Good technically, misleading semantically | Med |
| Important actions clear labels | Layer toggles, Apply, Export lack effect/explanation | High |
| Secondary not crowd main | Fixed w-52 panel on all viewports | Med |
| Long panels scroll | Good for right side | Low |
| Error/empty states understandable | No empty/meaningful states, silent failures | High |
| No nested cards | Good | OK |
| Laptop viewports checked | Fixed scene px + panel = clipped/tiny on <1100px | Critical |
| Text in container | Tiny refDes fail on small pkgs | Med |

## Recommendations Summary

P0: Wire real PCB data into singleton (or replace singleton with derived state from project layout). Make layer toggles filter rendered elements. Add mouse orbit + scale-to-container. Add measurement tool. Fix perf (or migrate to WebGL path that was built for it).

P1: Live dim updates, ARIA live regions + announced view changes, contrast-safe labels or billboard, empty state with import CTA, tooltips for Export/Import, collapse for side panel.

P2: Section/x-ray, photo export mode, keyboard scene nav, ViewCube.

This 3D surface is not ready for real hardware work until the data gap and render scalability are closed.

---

*Analysis performed with ast-grep code searches, full file reads of BoardViewer3DView.tsx + board-viewer-3d.ts + useProjectBoard, ux-contract/gotchas, persona scenario walking, web research on EDA viewers. No live browser run (dev server not active); static + dynamic code reasoning.*