# Phase 4 Tech Debt Checklist — 3D View (Actionable Only)

**Format**: `TD-3D-NN | [Short Title] | Description with file:line evidence | Effort: S/M/L/XL | Priority: P0-P3 | Why it blocks users or velocity`

**Total items**: 12 (includes all mandated: WebGL kill/integrate, 3 high-CCN refactors, CSS replace/optimize, perf guardrails, layer+package completeness).

Generated from lizard/scc/ast-grep/rg reads + research. All items are **scoped only to the 3 files + tests + integration points**.

---

TD-3D-01 | Delete or integrate the dead WebGL engine | 1298 LOC file `client/src/lib/pcb/webgl-viewer.ts` (1000 code LOC per scc, full geometry/raycast/singleton) has **0 structural imports** anywhere in client/src (ast-grep + rg confirmed; only self-test references it). Contains createCylinderGeometry (85 NLOC), calculateLayerStack (75 NLOC) etc. that duplicate intent of CSS path. | Effort: S (delete) or XL (integrate as real renderer) | Priority: **P0** | Blocks velocity: 1000 LOC of high-quality but unexercised code is pure maintenance tax and gives false confidence that "we have a WebGL path". Deleting removes debt; integrating fixes the scaling problem.

TD-3D-02 | Refactor addComponent (CCN 23 hotspot) | `client/src/lib/board-viewer-3d.ts:403-431`: 10+ `??` fallbacks, crypto UUIDs in map for pins, pkg lookup, set+save+notify. Called on every placement. | Effort: M | Priority: **P1** | High branch complexity + side effects in one function = hard to test/extend when new package fields or validation arrive. Also feeds the "components only live in 3D singleton" drift.

TD-3D-03 | Refactor useBoardViewer3D hook (CCN 20) | `client/src/lib/board-viewer-3d.ts:1097-1189` (57 NLOC): 10 useCallbacks + unconditional `viewer?.getAllComponents() ?? []` + `buildScene()` on every render with no memo around the returned object graph. Subscribers only get tick. | Effort: M | Priority: **P1** | Every component re-render or layer toggle causes full array copies and scene rebuild. Root cause of "feels slow even on small boards" and constant identity changes downstream.

TD-3D-04 | Refactor handleUpdateDimensions + dimension sync | `BoardViewer3DView.tsx:465-478` (CCN 17) + 429-442 + 451-455: string state + 6 isNaN checks + dual-path persist (singleton + fire-and-forget updateBoard.catch(() => undefined)). Only dimensions are synced; components are not. | Effort: M | Priority: **P1** | Silent failures + two sources of truth = data loss or drift when user edits board size from 3D view while PCBLayoutView is also open. Violates the E2E-228 intent in the comment at :422.

TD-3D-05 | Replace CSS 3D scene with real 3D library (or aggressive virtualization) | `BoardViewer3DView.tsx:558-643` (the viewport + substrate + 3 maps at 599/611/623) + inner Trace map at 206. 16+ `style={{ transform: translateZ/rotate }}` objects per render. Creates 600–1200+ DOM nodes for 200-component board. Web research confirms this is unsupported for interactive PCB viewers in 2025/26 (all real ones use WebGL/Three.js). | Effort: XL | Priority: **P0** | This is the #1 blocker for real usage. Will produce jank, high memory, and "3D view is unusable for anything beyond demos" once users load actual designs. CSS 3D has no future in this feature.

TD-3D-06 | Add performance guardrails + observability | No React.memo on root view, no useMemo on buildScene/returned arrays (hook + view), no RAF, no node-count caps, no culling, no dev-mode warnings when >100 elements. Trace segment divs created in .map without any batching. | Effort: L | Priority: **P1** | Without hard limits or measurement, regressions will only be discovered by users on real hardware. Must at minimum log/warn in dev when DOM node count under the 3D scene exceeds threshold, and skip rendering or virtualize beyond N components.

TD-3D-07 | Complete internal / multi-layer copper support | `board-viewer-3d.ts:252-259` DEFAULT_LAYER_STACK has only 7 entries (no 'internal'). `LayerType3D` and `LAYER_ORDER` (View:84) + toggle UI + getLayerColor claim to support it, but buildScene and the CSS render divs never produce or draw internal layers. | Effort: L | Priority: **P2** | Any 4+ layer board will show incorrect or missing copper in 3D. Users doing real hardware will hit this immediately and lose trust.

TD-3D-08 | Unify package 3D geometry data + hardware verification | `BoardViewer3DView.tsx:36-46` (PACKAGE_HEIGHTS, 26 entries) vs `board-viewer-3d.ts:265+` (BUILTIN_PACKAGES with body*Depth) vs `FootprintLibrary` (only 2D boundingBox, no 3D height). ComponentBox:114 does `getFootprint` + separate PACKAGE_HEIGHTS lookup. No cross-check against real datasheets (CLAUDE.md mandatory protocol). | Effort: M (unify) + L (verify) | Priority: **P2** | Inconsistent heights for the same package depending on code path. Violates hardware verification rule; wrong 3D visuals = wrong mechanical understanding for users.

TD-3D-09 | Make layer / camera / full scene state persist and survive navigation | View local `useState<ViewAngle>` (444) + singleton layerVisibility + renderOptions only in localStorage. No round-trip through useProjectBoard or project metadata. Refresh or tab switch loses angle + custom layer visibility. | Effort: M | Priority: **P2** | Poor UX: "I set up the view exactly how I wanted and it is gone." Also makes E2E testing and sharing harder.

TD-3D-10 | Add proper error handling + conflict UI on bidirectional updates | `handleUpdateDimensions:475` uses `.catch(() => undefined)`. load() in singleton (board-viewer-3d.ts:999) silently overwrites from localStorage after projectBoard effect. No last-modified, no conflict banner, no "reload from project" button. | Effort: M | Priority: **P1** | Users will lose work or see inconsistent boards between 3D view and PCB layout without any indication why. Breaks multi-view contract.

TD-3D-11 | Upgrade 3D tests from happy-path to load + visual + sync invariants | 2826 LOC tests exist but rg found 0 mentions of large board sizes, frame timing, node counts, or cross-view sync assertions. WebGL tests exercise dead code. No Playwright visual regression on the viewport under rotation/layer toggle. | Effort: L | Priority: **P2** | "All tests green" gives false confidence. The performance and drift bugs will only surface in production or manual browser checks. Per pp-view-3d/gotchas: "Passing tests do not prove the layout is good."

TD-3D-12 | Add virtualization / LOD / Canvas fallback for the component + trace layer | When component count > 50 (or configurable), the current map-to-DOM strategy must switch to a single Canvas (or Three instanced meshes) for the dense geometry while keeping labels interactive. Current code has zero path for this. | Effort: XL | Priority: **P0** | Directly mitigates the CSS 3D scaling cliff (TD-3D-05) and buys time if full Three.js migration is deferred. Without it the feature is capped at toy boards forever.

---

**Prioritization notes** (P0 = ship blocker for real EDA use, P1 = velocity + correctness, P2 = polish + future-proof).

**Owner handoff**: Update `.agents/skills/pp-view-3d/references/self-improvement-log.md` with the key lesson: "CSS 3D was chosen for quick visual fidelity on small boards but created an unscalable surface that now requires a renderer migration."

All items are **directly actionable** with file:line evidence from this audit. No hand-wavy items.

**End of checklist**.