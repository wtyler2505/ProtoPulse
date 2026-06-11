# Breadboard Testing Guide

Use the smallest test set that proves the changed behavior. If UI changed, also check the real page in a browser.

## Fast Page Checks

- `npm run test -- client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx`
- `npm run test -- client/src/components/circuit-editor/breadboard-view/__tests__/BreadboardToolbar.test.tsx`
- `npm run test -- client/src/components/circuit-editor/breadboard-view/__tests__/BreadboardDialogs.test.tsx`
- `npm run test -- client/src/components/circuit-editor/breadboard-view/__tests__/BreadboardEmptyState.test.tsx`

## Canvas Checks

- `npm run test -- client/src/components/circuit-editor/__tests__/BreadboardGrid.test.tsx`
- `npm run test -- client/src/components/circuit-editor/__tests__/BreadboardGridDropPreview.test.tsx`
- `npm run test -- client/src/components/circuit-editor/__tests__/BreadboardGridFitZone.test.tsx`
- `npm run test -- client/src/components/circuit-editor/breadboard-canvas/__tests__/canvas-helpers.test.ts`
- `npm run test -- client/src/components/circuit-editor/breadboard-canvas/__tests__/canvas-leaf-components.test.tsx`
- `npm run test -- client/src/components/circuit-editor/breadboard-canvas/__tests__/useCanvasViewport.test.ts`

## Workflow Checks

- `npm run test -- client/src/components/circuit-editor/__tests__/breadboard-lab-contracts.test.ts`
  - Breadboard Lab contract guard for instance provenance, bench-vs-board state, coach trust ordering, and sync-created wire provenance.
- `npm run test -- client/src/components/circuit-editor/__tests__/BreadboardStarterShelf.test.tsx`
- `npm run test -- client/src/components/circuit-editor/__tests__/BreadboardInventoryDialog.test.tsx`
- `npm run test -- client/src/components/circuit-editor/__tests__/BreadboardExactPartRequestDialog.test.tsx`
- `npm run test -- client/src/components/circuit-editor/__tests__/BreadboardQuickIntake.test.tsx`
- `npm run test -- client/src/components/circuit-editor/__tests__/BreadboardPartInspector.trustTier.test.tsx`
- `npm run test -- client/src/components/circuit-editor/__tests__/BreadboardBoardAuditPanel.test.tsx`
- `npm run test -- client/src/components/circuit-editor/__tests__/BreadboardReconciliationPanel.test.tsx`
- `npm run test -- client/src/components/circuit-editor/__tests__/BreadboardShoppingList.test.tsx`

## AI And Inspection Checks

- `npm run test -- client/src/components/circuit-editor/__tests__/BreadboardCoachOverlay.test.tsx`
- `npm run test -- client/src/components/circuit-editor/__tests__/CoachLearnMoreCard.test.tsx`
- `npm run test -- client/src/components/circuit-editor/__tests__/HardwareInspectionPanel.test.tsx`

## Skill Checks

- `node .agents/skills/pp-view-breadboard/scripts/inspect-breadboard-view.mjs`
- `npm run page-skills:check`
- `npm run test -- scripts/__tests__/pp-view-breadboard-inspector.test.ts`

## Browser Checks

For visible UI changes:

1. Start or reuse the app.
2. Open the Breadboard view.
3. Confirm the page loads without a white screen.
4. Confirm the main surface scrolls only where expected.
5. Confirm toolbar actions are reachable.
6. Confirm dialogs do not overflow the viewport.
7. Confirm hardware inspection is findable if that area was touched.

Warnings count as defects. Do not call a run clean if a known warning is still present.

The selected-part inspector container has a focused laptop-height browser proof:

- `PLAYWRIGHT_HTML_OPEN=never npm run test:e2e -- e2e/p1-breadboard-inspector-container.spec.ts --reporter=dot --workers=1`

## 3D Bridge Check

The selected-part inspector's `View in 3D` action is covered in
`BreadboardView.test.tsx` and `e2e/p1-viewer-3d-bridge.spec.ts`. The expected behavior is:

- select a placed breadboard instance
- click `View in 3D`
- dispatch `protopulse:breadboard-view-in-3d` with selected-part trust context
- include board-health score, critical/warning counts, and net count when audit data is available
- switch the workspace to `viewer_3d`
- render the 3D bridge card with `Breadboard selection`, selected refdes, pin-map confidence, health, and ready/review state

## Work-Surface Status Check

The canvas-level board-health/coach dock is covered in `BreadboardView.test.tsx`
and `e2e/p1-breadboard-inspector-container.spec.ts`. The expected behavior is:

- dock is visible inside `breadboard-canvas`
- dock is collapsible and has `data-resizable="true"` plus `data-resize-axis="both"`
- `Audit` runs board health without hunting through the sidebar
- selecting a placed part shows its refdes and coach move count on the work surface
- selecting a placed part shows canvas-level provenance: trust tier, pin-map confidence, verification level/status, and stash readiness
- laptop-height browser proof captures `e2e-results/r25-breadboard-work-surface-status.png`

## Inspector Container Check

The selected-part inspector's laptop-height/container behavior is covered in
`BreadboardPartInspector.trustTier.test.tsx`. The expected behavior is:

- inspector shell has bounded height with internal scrolling
- inspector is resizable and exposes `data-resize-axis="both"`
- collapse button hides the body without losing selected-part context
- `View in 3D` remains reachable while collapsed
