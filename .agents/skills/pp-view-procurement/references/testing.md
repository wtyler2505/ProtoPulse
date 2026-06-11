# Procurement Testing Guide

Use the smallest test set that proves the changed behavior.

## Recorded Test Handles

- `npm run test -- client/src/components/views/__tests__/procurement-sub-components.test.tsx`
- `npm run test -- client/src/lib/__tests__/supplier-api.test.ts`

## Skill Checks

- `node .agents/skills/pp-view-procurement/scripts/inspect-procurement.mjs`
- `npm run page-skills:check`
- `npm run page-skills:audit-packs`

## Browser Checks

For visible UI changes:

1. Open Procurement.
2. Confirm the page loads without a white screen.
3. Confirm main controls are reachable.
4. Confirm menus and panels scroll when content grows.
5. Confirm text does not overlap or overflow.
6. Confirm keyboard/focus behavior when controls changed.

Warnings count as defects.
