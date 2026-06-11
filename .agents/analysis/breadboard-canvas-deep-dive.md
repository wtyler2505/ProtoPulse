# Breadboard Canvas Deep Dive (The 1,677 LOC Monster)
**Date:** 2026-05-18
**Context:** Scoped `/product-analysis -> /pp-view-breadboard + breadboard-lab` (user chose 1 + 3 + 4)
**File:** `client/src/components/circuit-editor/breadboard-canvas/index.tsx` (1,676 LOC / 475 complexity — current worst file in ProtoPulse)

## Why This File Is The Highest-Risk Surface

- Explicit self-admission in the file header (lines 10-12):
  > "Extracted from BreadboardView.tsx (audit #32, phase 1). Phase 2 (W1.12b) will split this into sub-files."
- That refactoring never happened. The file has grown since.
- It is the single source of truth for the entire interactive breadboard experience: placement, wiring, bench/stash, coach, audit focus, simulation overlay, accessibility, undo, auto-placement, drag semantics, coordinate transforms, provenance-aware rendering.
- 20+ `useState` + heavy `useMemo`/`useEffect`/`useCallback` graph.
- Directly imports and orchestrates ~25+ sibling components and 10+ lib modules.
- Pointer handling, drop logic, wire-in-progress, panning, zooming, context menus, and bench connector targeting all live here.

This is not "a canvas component". It is the breadboard lab runtime.

## Structural Problems (Against breadboard-lab + pp-view-breadboard Contracts)

### 1. God Component + Abandoned Extraction
- The file was already too big when the comment was written.
- Current responsibilities (from imports + state + effects + render):
  - Canvas viewport (useCanvasViewport)
  - Tool state + cursor (useBreadboardCursor)
  - Wire editing state machine (wireInProgress, handleMouse*, handleTiePointClick)
  - Bench vs Breadboard placement duality (benchInstances filter, benchConnectorAnchors, separate BenchPartRenderer)
  - Auto-placement engine (autoPlacementPlans, handleApplyAutoPlacement)
  - Schematic → Breadboard wire sync effect (calls syncSchematicToBreadboard)
  - Coach plan resolution (deep integration with useBreadboardCoachPlan)
  - Selection + inspector model building
  - Audit focus handling
  - Drag/drop from starter shelf, inventory, exact parts, bench
  - Simulation visual state overlay on wires
  - Accessibility announcer
  - Undo/redo stack
  - Context menu + wire color menu
  - Many small anonymous handlers (lizard shows dozens of CCN 1 because complexity is distributed across closures + effects)

### 2. Bench vs Breadboard Coordinate Hell (Direct Gotcha Violation)
From `pp-view-breadboard/references/gotchas.md`:
> "Bench-placed parts can have bench coordinates while breadboard placement is still empty."

The code has explicit filters:
```ts
const benchInstances = useMemo(() => 
  (instances ?? []).filter(i => inst.benchX != null && inst.benchY != null && inst.breadboardX == null), 
  [instances]
);
```

Bench parts are rendered in a completely separate layer (`BreadboardBenchPartRenderer`) outside the grid, with their own anchor targeting for wiring (`handleBenchConnectorClick`).

This duality is fundamental to the "Lab" model (parts can live on the bench before committed to the board), but the logic is entirely inside this one file. Any change to drag semantics, collision, or sync risks breaking the bench model.

### 3. Sync Is Embedded in the Canvas Runtime
```ts
// Wire sync effect (lines ~406-431)
useEffect(() => {
  ...
  const result = syncSchematicToBreadboard(nets, wires, instances, partsMap);
  ...
  for (const wire of result.wiresToCreate) {
    createWireMutation.mutate({ view: 'breadboard', ... });
  }
}, [...]);
```

The canvas owns the timing of when schematic sync is allowed (after auto-placement settles). This couples the view layer to the sync engine (view-sync.ts 766 LOC). Per `breadboard-lab/references/ai-audit-and-sync.md`: "silent success can still feel wrong".

Provenance is passed through (`'synced'`, `'coach'`, `'jumper'`) and used in rendering (lines 1382-1384), but the user-facing distinction (trust, editability, visual weight) is fragile and spread across this file + overlays.

### 4. Coach Plan Is Deeply Entangled
The canvas receives `selectedInstanceModel` and directly consumes:
- `coachPlan`, `resolvedCoachSuggestions`, `preparedCoachHookups`, `preparedCoachBridges`, etc.
- Renders `BreadboardCoachPlanOverlay` and `BreadboardPinAnchorOverlay`
- Handles `handleApplyCoachRemediation`

The coach plan hook (`useBreadboardCoachPlan.ts` 645 LOC in one version) is complex. Wiring it here makes the canvas the "coach execution environment". Per the workflow playbook: "actionability of guidance" must be strengthened. Currently the guidance lives one layer too deep in the most complex file.

### 5. Drop / Placement Logic Is Massive and Duplicated in Spirit
`handleDrop` (starting ~line 1190) has branches for:
- Bench connector drops
- Exact part drops
- Starter shelf / generic drops
- Auto-placement template building

Each path has different refDes generation, collision checks, bench vs breadboard coordinate decisions. This is exactly the "clarify provenance" requirement in the playbook — and the code doing the clarification is 1,677 LOC of mixed concerns.

### 6. Render Complexity (The O(n) + Layering Problem)
The return (starting ~1246) builds an SVG with:
- CanvasToolbar (many controls)
- Grid + ConnectivityExplainer + Keyboard cursor + BendableLegRenderer + ComponentOverlay + BenchPartRenderer + PinAnchorOverlay + CoachPlanOverlay + wires (with simulation animation) + drop preview + more

Bench parts are deliberately rendered **outside** the transformed group in some cases. Multiple overlays read the same selection/coach state. Small state changes (hover, selection, coach visible) can cause wide re-renders.

This is the breadboard equivalent of the 3D CSS DOM explosion problem — just in SVG + React instead of DOM 3D transforms.

## Concrete High-Risk Functions / Areas (for implementation order)

1. **The entire state + effect graph around benchInstances / benchConnectorAnchors** — any change to how stash parts become board parts touches this.
2. **The wireSyncVersion + syncSchematicToBreadboard effect** — the place where "spooky" sync can occur.
3. **handleDrop + buildPlacementForDrop + autoPlacement logic** — provenance origin point.
4. **The big SVG return + all the overlay conditionals** — where performance and visual trust will break first on real boards.
5. **Coach integration points** (selectedInstanceModel + coachPlanVisible) — where guidance actionability lives or dies.

## Comparison to 3D View Canvas Problems

The 3D case had one giant file + dead parallel implementation (WebGL) + data never arriving + CSS explosion.

Breadboard canvas is worse in three ways:
- It is **active** (the real production path, not a side experiment).
- It owns **two coordinate systems** (bench + breadboard) that the entire "Lab" identity depends on.
- It is the execution environment for **coach + audit + sync**, not just rendering.

## Recommended First Cuts (if splitting)

- Extract `BenchSurfaceManager` (benchInstances, bench anchors, bench drop handling, bench coordinate transforms).
- Extract `WireEditingStateMachine` (wireInProgress, handleMouse*, tie-point logic, color menu).
- Extract `CoachIntegrationLayer` (everything under `useBreadboardCoachPlan` consumption + overlays).
- Extract `CanvasViewport + InputRouter` (useCanvasViewport + panning + keyboard cursor + announcer).
- Keep the SVG render as a thin composition layer.

Any split must preserve the single source of truth for "is this part on the bench or on the board?" because that distinction is the core of the breadboard-lab workflow.

## Immediate Evidence for the Master Checklist

This file alone justifies multiple P0 TD-BB and UI-BB items. It violates:
- "BreadboardView.tsx is an orchestrator. Keep new local logic small." (gotchas)
- "Clarify provenance" and "Strengthen readiness" (workflow playbook)
- "Sync work is high risk" (ai-audit-and-sync)
- The explicit "we will split this" comment that has aged for months.

**Conclusion of deep canvas dive:** The 1,677 LOC breadboard-canvas is currently the single most dangerous file in ProtoPulse for the maker/education value proposition. Every other breadboard-lab concern (coach quality, hardware inspection value, board health actionability, schematic sync trust) funnels through or is gated by the stability of this file.

Next: Use this as the foundation for the full scoped report + checklist.