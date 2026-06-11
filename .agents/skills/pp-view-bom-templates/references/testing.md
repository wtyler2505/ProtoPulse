# BOM Templates Testing Guide

Use the smallest test set that proves the changed behavior.

## Recorded Test Handles

- `npm run test -- client/src/components/views/__tests__/BomTemplatesPanel.test.tsx`

## Skill Checks

- `node .agents/skills/pp-view-bom-templates/scripts/inspect-bom-templates.mjs`
- `npm run page-skills:check`
- `npm run page-skills:audit-packs`

## Browser Checks

For visible UI changes:

1. Open BOM Templates.
2. Confirm the page loads without a white screen.
3. Confirm main controls are reachable.
4. Confirm menus and panels scroll when content grows.
5. Confirm text does not overlap or overflow.
6. Confirm keyboard/focus behavior when controls changed.

Warnings count as defects.

## Apply Preview Coverage

- Tests should cover hard blocker behavior, warning-only review behavior, and the item-level created/skipped diff before mutation.
- Confirm apply should stay unavailable while template detail data is missing, loading, or errored.
