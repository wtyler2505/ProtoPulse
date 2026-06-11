# Digital Twin Testing Guide

Use the smallest test set that proves the changed behavior.

## Recorded Test Handles

- `client/src/components/views/__tests__/DigitalTwinView.test.tsx`
  - Connection, empty-state, live channel toggle, firmware dialog, and out-of-bounds validation regression coverage.
  - 3D behavior preview renders live channel/pin state.
  - 3D behavior preview exposes resizable/collapsible container affordances.
  - 3D behavior preview exposes next actions for unconfigured and stale telemetry states.
  - Digital Twin publishes live-state context into the 3D bridge.
  - Fix links navigate to Breadboard and Component Editor.
- `client/src/components/views/__tests__/BoardViewer3DView.test.tsx`
  - 3D View renders the Digital Twin bridge payload as a viewport live-state overlay.
  - 3D View exposes return/fix controls for Digital Twin, Breadboard, and Component Editor.
- `e2e/p1-viewer-3d-bridge.spec.ts`
  - Browser proof that the Digital Twin handoff lands in 3D with the overlay and fix controls visible.

## Skill Checks

- `node .agents/skills/pp-view-digital-twin/scripts/inspect-digital-twin.mjs`
- `npm run test -- client/src/components/views/__tests__/DigitalTwinView.test.tsx`
- `npm run page-skills:check`
- `npm run page-skills:audit-packs`

## Browser Checks

For visible UI changes:

1. Open Digital Twin.
2. Confirm the page loads without a white screen.
3. Confirm main controls are reachable.
4. Confirm menus and panels scroll when content grows.
5. Confirm text does not overlap or overflow.
6. Confirm keyboard/focus behavior when controls changed.

Warnings count as defects.
