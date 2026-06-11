# PCB Testing Guide

Use the smallest test set that proves the changed behavior.

## Recorded Test Handles

- `npm run test -- client/src/lib/pcb/__tests__/pcb-surface-status.test.ts`
- `npm run test -- client/src/components/circuit-editor/__tests__/PCBLayoutView.status.test.tsx`
- `npm run test -- client/src/lib/__tests__/tscircuit-*.test.ts`
- `npm run test -- client/src/components/circuit-editor/__tests__/TSCircuit*.test.tsx`

## Skill Checks

- `node .agents/skills/pp-view-pcb/scripts/inspect-pcb.mjs`
- `npm run page-skills:check`
- `npm run page-skills:audit-packs`

## Browser Checks

For visible UI changes:

1. Open PCB.
2. Confirm the page loads without a white screen.
3. Confirm the PCB surface status dock is visible, collapsible, scrollable, and resizable.
4. Confirm the DRC/fabrication gate row is visible in the status dock.
5. Confirm the gate's Run DRC button warns when the gate is blocked or in review, then triggers validation.
6. Confirm the dock does not cover the layer stack, layer legend, minimap, coordinate readout, or main toolbar at desktop, laptop-height, and mobile-ish widths.
7. Confirm main controls are reachable.
8. Confirm menus and panels scroll when content grows.
9. Confirm text does not overlap or overflow.
10. Confirm keyboard/focus behavior when controls changed.

Warnings count as defects.
