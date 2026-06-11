# Architecture Skill Self-Improvement Log

## Accepted Learnings

- This skill was built from the page-skill manifest so Architecture work has a discoverable home.
- Keep page maps current when source files move.
- Keep tests and browser checks tied to real Architecture behavior.
- For v3 gate work, expose backend/compiler/swarm blockers in the visible panel and test the user-facing blocker text.
- Verified-source enrichment must reject generic labels like "MCU" so the v3 compiler does not silently trust the wrong board.
- When v3 work moves out of docs, show the adoption state in the live Architecture panel: live app active, xyflow coexists, docs/v3 reference.
- For v3 storage work, keep Drizzle SQL migrations and `migrations/meta` in sync; `npm run db:migrate` will not reliably prove new tables if the journal or snapshot is missing.
- For tldraw migration work, do not stop at shape counts; extract typed boundary objects from shape metadata and show that extraction in the live v3 gate.
- For v3 migration planning, expose a real step list in app state and UI; do not leave the xyflow-to-tldraw path as prose only.
- The Architecture view (1500+ LOC) implements a complete custom diagram canvas using absolute-positioned DOM nodes, SVG straight-line edges, window-level pointer drag handlers, and a hand-rolled `reactFlowInstance` shim (fitView via scrollTo, screenToFlow via getBoundingClientRect + scroll). It does not mount <ReactFlow> despite the compat layer and an unused CustomNode import (removed in 2026-05 audit). This custom approach coexists with the v3 tldraw readiness path; the live v3 gate extracts boundary objects to preview the future compiler target.
- The reactFlowInstance useMemo([localNodes]) creates methods that close over a snapshot of localNodes; fitView / coordinate transforms can therefore see stale node data if an older instance reference is invoked after further mutations. Callers that list it in useCallback deps mostly stay fresh, but the pattern is fragile.
- All floating panels (V3ArchitectureReadinessPanel, analysis slide-over, NodeInspectorPanel) correctly use flex + overflow-y-auto + close buttons and respect the UI Container Rule (scrollable, non-trapping). V3 gate additionally supports native CSS resize.
- 24 tests (14 view + 10 context) + page-skill checks all green; no runtime console warnings or TODOs found in the module during audit. Deep canvas interactions remain E2E/manual territory.
- Phase 0 foundation inventory (2026-05-18 agent pass): Performed deep read of all scoped primitives. High-value reusable pieces identified with signatures: from component-editor/ — buildDragOrigins(shapes, selectedIds, shapeId, shiftKey): Map<id, {x,y}>, computeDragMove(dragOrigins, dragStart, currentPos, shapes): {moves, guides: SnapTarget[]}, shapesInMarquee(shapes, start, current): string[], screenToPartSpace, computeWheelZoom, computeZoomToFit (in CanvasTransforms.ts); from lib/component-editor/snap-engine.ts — computeSnap(movingBounds, otherShapes, excludeIds, threshold?): SnapResult, getShapeBounds(shape): {left,right,top,bottom,centerX,centerY}, SnapTarget type; SnapGuideEngine reexports + snapToGrid; from pcb-layout/ — screenToBoardCoords, snapToGrid/snapValue, clampZoom, computeWheelZoom (PCBCoordinateSystem.ts); full handleCanvasClick/handleMouse*/handleKeyDown/handleWheel factories + PanState/Selection* types (PCBInteractionManager.ts, 340 LOC pure); resolvePinPosition (internal in ComponentPlacer.ts) + FootprintLibrary with 20+ package pads + rotation transform for absolute anchors. Duplication: 2x screenTo* + snapToGrid + zoom math (grids differ: 10 vs 12.7); component-editor has shape snap+drag+hit+multi-origin, PCB has tool-dispatch+marquee+pin resolution+rotation, Architecture has zero reuse + hardcoded +75x/+35y edge attaches (from 150x70 assumed box) + custom scroll shim for "reactFlow". Gaps: no unified node-with-size/ports model, no rotation in Arch nodes, visual guides are SVG-specific. Proposed lib/diagram/ layout (pure TS, no React): types.ts (DiagramNode, GraphNode compat, SnapTarget, etc.), coordinate.ts (unified transforms+fit+grid with opts), snap.ts (computeSnap + bounds), drag.ts (origins+move), hit.ts (marquee+future point tests), anchors.ts (getNodeAnchor), index.ts. First-cut getNodeAnchor design: takes GraphNode (or minimal {position, data?}), optional measuredSize?:{width:number;height:number} (from DOM getBounding or ResizeObserver post-layout), returns {x:number, y:number} world anchor (defaults to center of 150x70 or provided; extensible to explicit ports in data or future first-class without mutating persisted GraphNode shape). Enables killing all magic offsets in Architecture edge SVG and focus/center calcs. This is the highest-leverage move before any P1 shim or v3 work. Inspector run post-log update remains clean.
- Phase 0 scaffold (Agent B): Created `client/src/lib/diagram/{types,coordinate,index}.ts` + colocated `coordinate.test.ts`. Unified coordinate layer merges pointer-preserving wheel zoom + generic zoom-to-fit (Bounds + fallback 150x70 for GraphNode compat) from CanvasTransforms with snapValue/clamp/ configurable grid from PCBCoordinateSystem. Chose `screenToWorld` + `Point` + `ZoomResult{pan:Point}` naming for consistency; `computeZoomToFitNodes` accepts position+optional size so Architecture can use without immediate data change. All 14 tests green (roundtrips, snap custom grids 10/12.7/20, zoom fit on empty/single/multi sets, clamp). Inspector + page-skills:check remain "ok". Zero edits to ArchitectureView or any view/pcb/component-editor sources. Prepares exact surface for Agent C (snap/drag/hit/anchors + getNodeAnchor per ratified design).
- Phase 0 extraction complete (Agent C snap+drag+hit+anchors): Delivered `client/src/lib/diagram/{snap,drag,hit,anchors}.ts` + colocated snap.test.ts (15 tests) + anchors.test.ts (11 tests) + index barrel update. Generalized computeSnap/getBounds (rect + GraphNode/DiagramNode with 150x70 default + variable measuredSize), buildDragOrigins/computeDragMove, shapesInMarquee + pointInRect helpers, and the exact ratified `getNodeAnchor(node, measuredSize?, kind?)` supporting all 9 AnchorKinds, no-mutation guarantee on persisted GraphNodes, and Architecture 20px grid friendly numbers. 40 diagram tests + original 24 Architecture tests all green with zero warnings; inspector "ok" + page-skills:check clean after every file + defect fix (zero-size || fallback bug caught in TDD). Key durable lessons: (1) size math must use isFinite() not || because 0 is valid degenerate width; (2) neutral types + getBounds normalizer lets one lib serve Shape legacy + Arch nodes without cross imports; (3) exhaustive kind + measured + mutation tests are mandatory before any +75/+35 removal in phase0-05; (4) always run inspector + full arch suite on every source addition per skill contract. Phase 0 core extraction now ready for integration step (replacing magic offsets in ArchitectureView canvas). All todos phase0-04/05 unblocked.
- Phase 0-05 first integration win: Added `import { getNodeAnchor } from '@/lib/diagram'` to ArchitectureView.tsx and replaced all three primary hardcoded anchor sites (main edge rendering lines ~991-994, draft edge ~1018-1019, and focus centering ~351) with calls to `getNodeAnchor(node)`. This is the first direct kill of the #1 P0 fragility ("Hardcoded node center offsets everywhere (+75, +35...)"). Used the default 150×70 fallback for zero-risk first cut (no measuredSize wiring yet). All changes passed: inspector remained "ok", 24/24 tests green, no TypeScript issues in the build path. Durable lesson: The new neutral `getNodeAnchor` + `DiagramNode` shape is already a drop-in replacement for the old ad-hoc math with zero data model change — this is the correct extraction-first path. Next improvement (still Phase 0/1) will add ephemeral measured size via ResizeObserver + Map<id, Size> for truly variable-height nodes.

## Pending Proposals

- Add screenshots for the main Architecture states.
- Add more specific gotchas after the next real Architecture implementation pass.

## Rejected Or Deferred

- Do not leave this as a thin `SKILL.md` only.

---

## 2026-05 Deep Analysis Pass (user directive: "/pp-view-architecture" as part of systematic full-app views backlog campaign)

**Workflow executed exactly per skill contract:**
1. Inspector run → ok (ArchitectureView 1509 LOC / 302 complexity, V3 panel high density, context 337 LOC).
2. page-map.md read.
3. ux-contract.md read.
4. testing.md read (24 tests exist, good coverage for a custom canvas).
5. gotchas.md read.
6. This entry written.

**Deep Findings from Tool-Driven Exploration (scc, rg, ast-grep patterns, file reads, cross-refs to previous Phase 0 work):**

**Core Nature of the View:**
- 1510 LOC custom diagram canvas (absolute positioned DOM nodes + SVG edges + native scroll + hand-rolled `reactFlowInstance` shim for fitView/screenToFlowPosition).
- Does **not** use <ReactFlow> / xyflow in the live path (compat shim only).
- Dual purpose: live editable architecture diagram **and** v3 readiness / compiler preview gate (heavy integration with evaluateLiveV3Readiness, buildV3ExecutionReadiness, verified source enrichment, swarm tasks, compile reports).
- Recent major work (Phase 0): extraction of reusable `lib/diagram/{coordinate,snap,drag,hit,anchors}.ts` and first integration of `getNodeAnchor` to kill hardcoded +75/+35 offsets.

**Strengths (from log + current state):**
- Excellent test coverage for a custom canvas (24 tests green).
- Clean recent extraction of diagram primitives (no warnings, TDD discipline followed, inspector clean after every step).
- All floating panels respect UI Container Rule (scroll + resize).
- Strong v3 gate visibility in the live view (this is a major differentiator).

**Identified Issues / Backlog Items (categorized for master report):**

**P1 — Fragility & Maintenance (Custom Canvas vs Library)**
- The reactFlowInstance shim (useMemo closing over localNodes) has known stale closure risks (documented in previous audit). Callers depend on it heavily for drag, paste, focus, wheel zoom, etc.
- Coexistence of live custom canvas + v3 tldraw path creates ongoing dual-maintenance surface. The "readiness" UI is excellent, but the migration path still requires keeping the old canvas working.
- Hardcoded anchor math is being replaced (good), but full measuredSize via ResizeObserver + variable node heights is still pending (current integration uses 150x70 fallback).

**P2 — Complexity Concentration**
- V3ArchitectureReadinessPanel has extremely high complexity density (134 CCN in 417 LOC).
- The main ArchitectureView (302 CCN) mixes live editing, undo stack, v3 compilation pipeline, verified facts, and the custom canvas event handlers in one file.
- Many absolute positioned UI elements + SVG layer + scroll sync = potential for layout thrashing or z-index wars.

**P2 — UX / Discoverability**
- The v3 readiness gate is powerful, but the transition from "current custom canvas" to "future tldraw + compiler" may not be obvious to new users.
- With the new diagram lib, there is opportunity to make node ports/anchors more visible and interactive.

**Cross-Cutting Opportunities (ties to other work in this campaign):**
- The new `lib/diagram` primitives (especially anchors + snap) are gold for consistency across Architecture, Component Editor, PCB, and future 3D views.
- Strong candidate for deeper AI/Chat integration (the v3 compile report + swarm tasks are perfect for Eve to comment on or improve).
- The "View in 3D" bridge from Breadboard could eventually highlight architecture nodes that have physical placements.

**Durable Lesson:**
A live custom canvas + a parallel v3 readiness gate in the *same* view is a high-leverage but high-risk pattern. The Phase 0 extraction of neutral diagram primitives is the correct long-term bet — it lets the team keep the live experience working while the compiler target (tldraw + typed boundaries) matures. Future agents must continue the measuredSize + full anchor replacement work before touching the old +75/+35 numbers.

**Recommended for Codex on this view:**
- Continue Phase 0/1: wire real measured node sizes (ResizeObserver) into getNodeAnchor calls.
- Consider extracting more of the v3 pipeline UI/logic if it grows.
- Add E2E tests for the critical canvas interactions (now that the shim is better understood).
- Use the diagram lib to drive consistency in other editors.

This analysis is contributed to the master backlog report. The Architecture view is in a much healthier state than many other complex views thanks to the recent disciplined extraction work.
