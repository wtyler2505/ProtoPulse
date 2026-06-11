# Alternates Testing Guide

Use the smallest test set that proves the changed behavior.

## Recorded Test Handles

- No dedicated test glob is recorded yet. Add or locate the nearest test before risky changes.

## Skill Checks

- `node .agents/skills/pp-view-alternates/scripts/inspect-alternates.mjs`
- `npm run page-skills:check`
- `npm run page-skills:audit-packs`

## Browser Checks

For visible UI changes:

1. Open Alternates.
2. Confirm the page loads without a white screen.
3. Confirm main controls are reachable.
4. Confirm menus and panels scroll when content grows.
5. Confirm text does not overlap or overflow.
6. Confirm keyboard/focus behavior when controls changed.

Warnings count as defects.
