# Validation Testing Guide

Use the smallest test set that proves the changed behavior.

## Recorded Test Handles

- `npm run test -- client/src/components/views/__tests__/ValidationView.test.tsx`
  - Safety-gate summary and virtualized safety-gate rows for provenance blockers.
- `npm run test -- client/src/lib/__tests__/export-validation.test.ts`
  - Export validation trust/provenance blockers for AI-generated, exact-part, 3D mechanical, breadboard health, lifecycle, and inventory confidence.

## Skill Checks

- `node .agents/skills/pp-view-validation/scripts/inspect-validation.mjs`
- `npm run page-skills:check`
- `npm run page-skills:audit-packs`

## Browser Checks

For visible UI changes:

1. Open Validation.
2. Confirm the page loads without a white screen.
3. Confirm main controls are reachable.
4. Confirm menus and panels scroll when content grows.
5. Confirm text does not overlap or overflow.
6. Confirm keyboard/focus behavior when controls changed.

Warnings count as defects.
