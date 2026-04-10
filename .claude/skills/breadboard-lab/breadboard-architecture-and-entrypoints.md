# Breadboard Architecture And Entrypoints

## Main Entrypoint Strategy

Start at `client/src/components/circuit-editor/BreadboardView.tsx`.

That file is the orchestration shell. It decides:

- when the workbench is shown
- how circuits are created and selected
- which dialogs are mounted
- which Breadboard subsystem receives data and callbacks
- how the canvas, inspector, coach, and overlays fit together

If the UX feels missing, confusing, or inconsistent, the root cause is often in this file.

## Subsystem Map

### Workbench shell

- `BreadboardWorkbenchSidebar.tsx`
- `BreadboardStarterShelf.tsx`
- `ComponentPlacer.tsx` in breadboard mode
- `BreadboardInventoryDialog.tsx`
- `BreadboardExactPartRequestDialog.tsx`
- `BreadboardBoardAuditPanel.tsx`

### Canvas editing

- `BreadboardGrid.tsx`
- `BreadboardComponentRenderer.tsx`
- `BendableLegRenderer.tsx`
- `BreadboardWireEditor.tsx`
- `BreadboardDrcOverlay.tsx`
- `BreadboardConnectivityOverlay.tsx`

### Coach / AI / trust

- `useBreadboardCoachPlan.ts`
- `BreadboardCoachOverlay.tsx`
- `breadboard-ai-prompts.ts`
- `breadboard-part-inspector.ts`
- `BreadboardPartInspector.tsx`
- `breadboard-layout-quality.ts`
- `breadboard-bench.ts`

### Board health / readiness

- `breadboard-board-audit.ts`
- `BreadboardBoardAuditPanel.tsx`
- bench summary data from `breadboard-bench.ts`
- selected-part readiness/trust from `breadboard-part-inspector.ts`

### Shared model and sync layer

- `client/src/lib/circuit-editor/breadboard-model.ts`
- `client/src/lib/circuit-editor/view-sync.ts`
- `client/src/lib/circuit-editor/breadboard-wire-editor.ts`
- `client/src/lib/circuit-editor/breadboard-connectivity.ts`
- `client/src/lib/circuit-editor/breadboard-drc.ts`

## Request-To-Entrypoint Routing

| Request type | Start here |
|--------------|------------|
| Breadboard tab structure or missing panel/action | `BreadboardView.tsx` |
| Starter/project/exact-part flow | `BreadboardWorkbenchSidebar.tsx`, dialogs, then `BreadboardView.tsx` |
| Audit score, issues, focus, remediation | `breadboard-board-audit.ts`, `BreadboardBoardAuditPanel.tsx`, then `BreadboardView.tsx` |
| Selected-part trust or readiness | `breadboard-part-inspector.ts`, `BreadboardPartInspector.tsx` |
| Coach plan logic or overlay | `useBreadboardCoachPlan.ts`, `BreadboardCoachOverlay.tsx`, prompts |
| Canvas interaction | `BreadboardView.tsx`, `BreadboardGrid.tsx`, `BreadboardWireEditor.tsx` |
| Placement geometry/collision/occupancy | `breadboard-model.ts` |
| Schematic ↔ breadboard drift or duplication | `view-sync.ts` |
| Visual realism of parts | `breadboard-components/*.tsx`, renderers |

## Architectural Heuristic

When in doubt, fix Breadboard in this order:

1. orchestration and discoverability
2. state truth and provenance
3. actionability of guidance
4. realism and polish

That order keeps the workbench useful for real builds instead of becoming a visually rich but behaviorally confusing editor.

