# Schematic Testing Guide

Use the smallest test set that proves the changed behavior.

## Recorded Test Handles

- `npm run test -- client/src/components/views/__tests__/SchematicView.test.tsx`
- `npm run test -- client/src/components/circuit-editor/__tests__/Schematic*.test.tsx`

## Skill Checks

- `node .agents/skills/pp-view-schematic/scripts/inspect-schematic.mjs`
- `npm run page-skills:check`
- `npm run page-skills:audit-packs`

## Browser Checks

For visible UI changes:

1. Open Schematic.
2. Confirm the page loads without a white screen.
3. Confirm the canvas status/provenance dock is visible, collapsible, and does not hide the main canvas.
4. Confirm main controls are reachable.
5. Confirm menus and panels scroll when content grows.
6. Confirm text does not overlap or overflow.
7. Confirm keyboard/focus behavior when controls changed.

Warnings count as defects.
