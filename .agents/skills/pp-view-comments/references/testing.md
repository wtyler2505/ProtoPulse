# Comments Testing Guide

Use the smallest test set that proves the changed behavior.

## Recorded Test Handles

- `client/src/components/panels/__tests__/CommentsPanel.test.tsx` covers the compose area's accessible submit action, shortcut hint readability, and spatial anchor rendering/filter visibility.

## Skill Checks

- `node .agents/skills/pp-view-comments/scripts/inspect-comments.mjs`
- `npm run page-skills:check`
- `npm run page-skills:audit-packs`

## Browser Checks

For visible UI changes:

1. Open Comments.
2. Confirm the page loads without a white screen.
3. Confirm main controls are reachable.
4. Confirm menus and panels scroll when content grows.
5. Confirm text does not overlap or overflow.
6. Confirm keyboard/focus behavior when controls changed.

Warnings count as defects.

## Focused E2E

- `env -u NO_COLOR -u FORCE_COLOR PLAYWRIGHT_HTML_OPEN=never npm_config_update_notifier=false npm run test:e2e -- e2e/p1-comments-spatial-anchor.spec.ts --reporter=dot --workers=1` proves seeded PCB spatial comments render with anchor context and exposes the Anchors filter on a laptop-height viewport.
