# Inventory Testing Guide

Use the smallest test set that proves the changed behavior.

## Recorded Test Handles

- `npm run test -- client/src/components/views/__tests__/storage-manager.test.tsx`
- `npm run test -- client/src/components/views/__tests__/storage-manager.test.tsx client/src/lib/__tests__/export-precheck.test.ts`

## Skill Checks

- `node .agents/skills/pp-view-inventory/scripts/inspect-inventory.mjs`
- `npm run page-skills:check`
- `npm run page-skills:audit-packs`

## Browser Checks

For visible UI changes:

1. Open Inventory.
2. Confirm the page loads without a white screen.
3. Confirm main controls are reachable.
4. Confirm menus and panels scroll when content grows.
5. Confirm text does not overlap or overflow.
6. Confirm keyboard/focus behavior when controls changed.

Warnings count as defects.

## Gate Coverage

- Storage Manager tests should cover Ready, Review, and Blocked states for `inventory-confidence-gate`.
- Shared precheck tests should cover `inventory-review` before changing gate labels or hard/soft outcomes.
