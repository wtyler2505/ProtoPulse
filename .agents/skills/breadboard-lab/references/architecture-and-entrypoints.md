# Breadboard Architecture And Entrypoints

## Main Entrypoint Strategy

Start at `client/src/components/circuit-editor/BreadboardView.tsx`.

That file is the orchestration shell (~700 lines post-extraction). The toolbar, dialogs, and empty state were extracted to `breadboard-view/`; the canvas to `breadboard-canvas/`; per-part SVG renderers to `breadboard-components/`. The shell decides:

- when the workbench is shown
- how circuits are created and selected
- which dialogs are mounted
- which Breadboard subsystem receives data and callbacks
- how the canvas, inspector, coach, and overlays fit together

If the UX feels missing, confusing, or inconsistent, the root cause is often in this file.

## Subsystem Map

Component paths are relative to `client/src/components/circuit-editor/`.

### Extracted view shell (`breadboard-view/`)

- `BreadboardToolbar.tsx` — mode toggles, zoom, grid controls
- `BreadboardDialogs.tsx` — dialog mounting extracted from the shell
- `BreadboardEmptyState.tsx` — no-circuit empty state
- `useBreadboardDialogState.ts` — dialog open/close state hook

### Canvas subsystem (`breadboard-canvas/`)

- `index.tsx` — the `BreadboardCanvas` component (largest single breadboard file)
- `canvas-helpers.ts` — pure placement/drop helpers (`getDropTypeFromPart`, `buildPlacementForDrop`, `WIRE_COLORS`)
- `useCanvasViewport.ts` + `CanvasToolbar.tsx` — zoom/pan state and canvas-local toolbar
- `WireColorMenu.tsx`, `CanvasCoordinateReadout.tsx`, `CanvasEmptyGuidance.tsx`

### Per-part SVG renderers (`breadboard-components/`)

- ~20 part-family SVGs (`ResistorSvg`, `LedSvg`, `IcSvg`, `ConnectorSvg`, …) exported via `index.ts`; consumed by `BreadboardComponentRenderer.tsx`

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
- selected-part readiness and trust from `breadboard-part-inspector.ts`

### Shared model and sync layer

- `client/src/lib/circuit-editor/breadboard-model.ts`
- `client/src/lib/circuit-editor/view-sync.ts`
- `client/src/lib/circuit-editor/breadboard-wire-editor.ts`
- `client/src/lib/circuit-editor/breadboard-connectivity.ts`
- `client/src/lib/circuit-editor/breadboard-drc.ts`

## Working Order

When in doubt, improve Breadboard in this order:

1. orchestration and discoverability
2. state truth and provenance
3. actionability of guidance
4. realism and polish
