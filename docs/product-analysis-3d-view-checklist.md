# ProtoPulse 3D View — Product Analysis Checklist (Actionable Items)
**Focus:** BoardViewer3DView + board-viewer-3d + webgl-viewer (scoped)
**Analysis depth:** Deep (2 refinement rounds simulated via cross-phase synthesis)
**Date:** 2026-05-18
**Status:** High-priority defects and gaps identified. Many are P0 because the feature is currently non-functional for real hardware work.

**Legend:** ID | Title | One-line description + evidence | Effort | Priority | Rationale (why this is "shit that needs doing")

## P0 — Blockers (feature is broken or unusable for target personas on real boards)
- **3D-TD-P0-01** | Delete or integrate the orphaned WebGL engine | webgl-viewer.ts (1298 LOC) + 960 LOC tests have **zero** imports/usage outside their own tests. Confirmed by full grep. Massive sunk cost + future maintenance trap. | L | P0 | Dead code this large violates every engineering hygiene rule; either finish the real 3D renderer or remove the lie.
- **3D-FG-P0-01** | Wire 3D scene to actual design data (components, traces, vias, placements) | BoardViewer3DView only syncs `projectBoard` dimensions via useProjectBoard. No code anywhere calls `addComponent`/`addTrace` etc. with real PCBLayoutView data. `components.length` will always be 0 on a real project. See hook (lib/board-viewer-3d.ts:1129) and View (no population useEffect). | XL | P0 | Without this, the entire 3D View is a demo toy. Professional and founder personas get zero value. This is the #1 reason the feature "doesn't work."
- **3D-UI-P0-02** | Replace CSS 3D with real renderer (WebGL/Three.js) or add aggressive virtualization/LOD | Trace segments and component faces are created via `.map()` into absolutely-positioned 3D divs (hundreds on a normal board). No culling, no pagination, pure DOM 3D. Will drop to unusable FPS. lizard + render analysis confirm. | XL | P0 | Current approach is architecturally incapable of real boards. Perf is the silent killer that will cause churn the first time a user tries a 100-part design.
- **3D-UI-P0-03** | Implement free-orbit camera + mouse/touch controls + zoom/pan | Only 7 static VIEW_ANGLES presets (no drag, no wheel zoom, no trackball). KiCad/Altium users expect continuous inspection. Code: VIEW_ROTATIONS + camera buttons only (BoardViewer3DView.tsx:534+). | M | P0 | Basic discoverability and "I can look at my board" expectation is violated. Makes the view feel broken even before data issue.

## P1 — High (severe UX or velocity damage, or high risk of future incidents)
- **3D-TD-02** | Refactor high-CCN functions (addComponent CCN 23, useBoardViewer3D hook CCN 20) | lizard output: addComponent@403 (29 lines, package/side/height branching), the 57-NLOC hook with 20 branches. These are the exact functions that will need extension for real data loading. | L | P1 | CCN > 15 = untestable = incident source. Refactor before loading real netlist data.
- **3D-TD-03** | Add performance guardrails + React render optimizations in the scene | Dozens of new inline style objects per render in traces.map / components.map. Even memoized children suffer identity churn. No useMemo on scene build, no will-change/contain. | M | P1 | Direct cause of the perf cliff in P0-02.
- **3D-UI-04** | Fix dimension edit flow + make bidirectional sync obvious | Three NumberInputs + "Update Board" that writes to singleton + async updateBoard. One-way from projectBoard for display. Users in PCBLayoutView won't see 3D changes live and vice versa (comment references E2E-228 but incomplete). | M | P1 | Confusing "two sources of truth" feel; violates cross-view contract.
- **3D-EN-05** | Surface real component count + selection sync from PCB data | Badge shows count but always 0. No hover/click in 3D to highlight in 2D layout or vice versa. | L | P1 | Basic "this is my board" mental model is missing.

## P2 — Medium (important polish, competitive parity, or tech debt that slows future work)
- **3D-FG-06** | Expand PACKAGE_HEIGHTS + FootprintLibrary coverage with source verification | Only ~25 packages. Per CLAUDE.md hardware protocol, every new part must have real mm dimensions from datasheet. No evidence of systematic verification. | M | P2 | Limits usefulness for real parts; will cause "my component is floating/wrong height" bugs.
- **3D-UI-07** | Improve layer visibility + internal layer support | LAYER_ORDER includes 'internal' but rendering is mostly 2-sided copper/silk/mask. Real 4-6 layer boards need better stack visualization. | M | P2 | Pro EE persona needs this for signal integrity / assembly review.
- **3D-TD-08** | Add error boundaries, loading states, and empty-state guidance inside the 3D canvas | When no components (current reality) or large data load, user sees... what? No Suspense inside the scene, no "import your placement first" call to action. | S | P2 | Violates ux-contract "error, warning, empty... states are understandable".
- **3D-EN-09** | Persist camera angle, layer visibility, and render options per-project | State lives only in the singleton + React local state. Navigation away loses user choices. | S | P2 | Basic expectation in a tool with many views.

## P3 — Nice-to-have / Innovation Seeds (do after P0/P1, or as stretch)
- **3D-IN-10** | Measurement tool (distance, clearance, height probe) | Hook already declares `measureDistance`. Never wired to UI. Competitors have this as table stakes. | M | P3 | High user value once data is connected.
- **3D-IN-11** | 2D ↔ 3D selection & cross-highlight (click part in 3D → select in PCBLayoutView) | Foundational for "this is one design, not two tools". | L | P3 | Makes the viewer part of the workflow instead of a silo.
- **3D-IN-12** | Enclosure / mechanical STEP overlay + collision visualization | Ties into 3D part creation and digital twin goals. Huge for "does it fit in the case?" founder reviews. | XL | P3 | Differentiator vs KiCad (which needs external MCAD).
- **3D-IN-13** | Photo-real export / shareable PNG with dimension callouts + BOM labels | Current export is raw JSON scene. Users need pretty pictures for docs, reviews, client handoff. | M | P3 | Low effort, high polish/marketing value.
- **3D-TD-14** | Decide WebGL vs Three.js React Fiber vs keep+optimize CSS and document the decision | Two renderers were started; one abandoned. Make an explicit ADR + remove the loser. | S | P3 | Prevents future "why are there two 3D things?" confusion.

**Total actionable items: 14**

**Recommended first sprint (P0s + top P1s):** 3D-TD-P0-01 (kill/integrate WebGL), 3D-FG-P0-01 (data wiring — the unlocker), 3D-UI-P0-02/03 (renderer + camera), 3D-TD-02 (refactor the hotspots that will be touched by data wiring).

**Cross-phase notes (synthesized):**
- Inventory confirmed the data disconnect + singleton-only usage.
- Tech debt quantified the CCN and dead code.
- UX mapped the "0 components" + static camera to persona failure.
- Competitive showed exactly which 4-5 features (free cam, real parts, measurement, 2D sync) separate "toy" from "tool".
- Innovation proposals are all blocked until the P0 data + renderer work is done.

Update this checklist after each implementation wave. Re-run `/product-analysis /pp-view-3d --iterations 3` after the data-wiring milestone.
