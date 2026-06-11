# Circuit Code Testing Guide

Use the smallest test set that proves the changed behavior.

## Recorded Test Handles

- `npm run test -- client/src/components/views/__tests__/CircuitCodeView.test.tsx`
- `e2e/p1-keyboard-nav.spec.ts`
  - Circuit Code keyboard scan verifies the split-pane resize separator has an accessible name.

## Skill Checks

- `node .agents/skills/pp-view-circuit-code/scripts/inspect-circuit-code.mjs`
- `npm run page-skills:check`
- `npm run page-skills:audit-packs`

## Browser Checks

For visible UI changes:

1. Open Circuit Code.
2. Confirm the page loads without a white screen.
3. Confirm main controls are reachable.
4. Confirm menus and panels scroll when content grows.
5. Confirm text does not overlap or overflow.
6. Confirm keyboard/focus behavior when controls changed.

Warnings count as defects.

## Apply Preview Coverage

- Tests should prove `Review apply` opens a consequence preview before mutation.
- Confirming the preview is the only path that posts to `/api/projects/:projectId/circuits/apply-code`.
- The preview should summarize the created circuit design, component count, net count, and wire segment count.
