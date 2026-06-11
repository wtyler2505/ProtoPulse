# Breadboard Page Map

Use this map before changing Breadboard behavior. It keeps the page shape visible so the next agent does not have to rediscover it from scratch.

## Main Entry Points

- `client/src/components/circuit-editor/BreadboardView.tsx` is the page orchestrator. It connects toolbar actions, dialogs, bench state, selected parts, board health, coach overlays, and inspection access.
- `client/src/components/circuit-editor/breadboard-canvas/index.tsx` owns the large canvas surface and pointer-heavy canvas behavior.
- `client/src/components/circuit-editor/breadboard-view/BreadboardToolbar.tsx` owns the page toolbar actions.
- `client/src/components/circuit-editor/breadboard-view/BreadboardDialogs.tsx` owns page-level dialogs.
- `client/src/components/circuit-editor/breadboard-view/BreadboardEmptyState.tsx` owns the empty page starting state.
- `client/src/components/circuit-editor/HardwareInspectionPanel.tsx` owns the VLM hardware photo workflow.

## Canvas Support

- `client/src/components/circuit-editor/BreadboardGrid.tsx` renders the breadboard grid.
- `client/src/components/circuit-editor/BreadboardComponentRenderer.tsx` renders placed parts.
- `client/src/components/circuit-editor/BreadboardBenchPartRenderer.tsx` renders bench/stash parts.
- `client/src/components/circuit-editor/BreadboardWireEditor.tsx` owns wire editing.
- `client/src/components/circuit-editor/BreadboardConnectivityOverlay.tsx` shows connectivity.
- `client/src/components/circuit-editor/BreadboardDrcOverlay.tsx` shows breadboard DRC issues.
- `client/src/components/circuit-editor/breadboard-canvas/CanvasToolbar.tsx` owns canvas-level controls.
- `client/src/components/circuit-editor/breadboard-canvas/CanvasEmptyGuidance.tsx` owns in-canvas guidance.
- `client/src/components/circuit-editor/breadboard-canvas/canvas-helpers.ts` contains canvas helper logic.

## Workflow Panels

- `client/src/components/circuit-editor/BreadboardStarterShelf.tsx` handles starter parts.
- `client/src/components/circuit-editor/BreadboardInventoryDialog.tsx` handles inventory selection.
- `client/src/components/circuit-editor/BreadboardExactPartRequestDialog.tsx` handles exact part requests.
- `client/src/components/circuit-editor/BreadboardPartInspector.tsx` handles selected-part details and trust/readiness.
- `client/src/components/circuit-editor/BreadboardBoardAuditPanel.tsx` handles board audit output.
- `client/src/components/circuit-editor/BreadboardReconciliationPanel.tsx` handles schematic/breadboard reconciliation.
- `client/src/components/circuit-editor/BreadboardShoppingList.tsx` handles shopping list output.
- `client/src/components/circuit-editor/BreadboardWorkbenchSidebar.tsx` handles workbench side content.
- `client/src/components/circuit-editor/BreadboardQuickIntake.tsx` handles quick part intake.

## Coach And AI

- `client/src/components/circuit-editor/useBreadboardCoachPlan.ts` builds the coach plan.
- `client/src/components/circuit-editor/BreadboardCoachOverlay.tsx` renders the coach overlay.
- `client/src/components/circuit-editor/CoachLearnMoreCard.tsx` renders coach education details.
- `client/src/lib/breadboard-ai-prompts.ts` stores breadboard-specific AI prompts.
- `client/src/lib/breadboard-board-audit.ts` stores board audit logic.

## Data And Sync

- `client/src/lib/breadboard-bench.ts` models bench/stash data.
- `client/src/lib/breadboard-part-inspector.ts` supports part inspector data.
- `client/src/lib/circuit-editor/breadboard-model.ts` stores breadboard model helpers.
- `client/src/lib/circuit-editor/breadboard-bench-connectors.ts` supports bench connector behavior.
- `client/src/lib/circuit-editor/breadboard-drag-move.ts` supports drag and move behavior.
- `client/src/lib/circuit-editor/useBreadboardCursor.ts` supports cursor state.
- `client/src/lib/circuit-editor/view-sync.ts` keeps schematic and breadboard views in sync.

## Neighbor Systems

- Schematic work can create breadboard sync changes.
- Validation work can change board health and issue surfacing.
- Inventory/procurement work can change stash, exact part, and shopping behavior.
- AI chat work can change coach and hardware inspection prompts.
