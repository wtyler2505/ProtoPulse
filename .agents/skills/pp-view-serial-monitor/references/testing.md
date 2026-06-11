# Serial Monitor Testing Guide

Use the smallest test set that proves the changed behavior.

## Recorded Test Handles

- `e2e/p1-keyboard-nav.spec.ts`
  - Serial Monitor keyboard scan verifies focusable controls have accessible names.
  - DTR, RTS, auto-scroll, and timestamp switches must keep explicit accessible names.

## Skill Checks

- `node .agents/skills/pp-view-serial-monitor/scripts/inspect-serial-monitor.mjs`
- `npm run page-skills:check`
- `npm run page-skills:audit-packs`

## Browser Checks

For visible UI changes:

1. Open Serial Monitor.
2. Confirm the page loads without a white screen.
3. Confirm main controls are reachable.
4. Confirm menus and panels scroll when content grows.
5. Confirm text does not overlap or overflow.
6. Confirm keyboard/focus behavior when controls changed.

Warnings count as defects.
