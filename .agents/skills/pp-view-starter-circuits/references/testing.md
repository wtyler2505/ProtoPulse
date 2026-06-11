# Starter Circuits Testing Guide

Use the smallest test set that proves the changed behavior.

## Recorded Test Handles

- `client/src/components/views/__tests__/StarterCircuitsPanel.test.tsx`
  - Starter circuit library data integrity.
  - Starter gallery filters, expand/collapse, code copy, and Arduino launch.
  - Starter card radial metadata plus AI Learn, Open, and Copy Code radial command handling.

## Skill Checks

- `node .agents/skills/pp-view-starter-circuits/scripts/inspect-starter-circuits.mjs`
- `npm run page-skills:check`
- `npm run page-skills:audit-packs`

## Browser Checks

For visible UI changes:

1. Open Starter Circuits.
2. Confirm the page loads without a white screen.
3. Confirm main controls are reachable.
4. Confirm menus and panels scroll when content grows.
5. Confirm text does not overlap or overflow.
6. Confirm keyboard/focus behavior when controls changed.

Warnings count as defects.
