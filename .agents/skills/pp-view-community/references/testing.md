# Community Testing Guide

Use the smallest test set that proves the changed behavior.

## Recorded Test Handles

- `client/src/components/views/__tests__/CommunityView.test.tsx`
  - Community 3D model -> 3D viewer bridge with source name and reputation.
- `e2e/p1-viewer-3d-bridge.spec.ts`
  - Real Community card click -> 3D View handoff with source author, reputation, verification, and model format visible.

## Skill Checks

- `node .agents/skills/pp-view-community/scripts/inspect-community.mjs`
- `npm run test -- client/src/components/views/__tests__/CommunityView.test.tsx`
- `env -u NO_COLOR -u FORCE_COLOR PLAYWRIGHT_HTML_OPEN=never npm run test:e2e -- e2e/p1-viewer-3d-bridge.spec.ts --reporter=dot`
- `npm run page-skills:check`
- `npm run page-skills:audit-packs`

## Browser Checks

For visible UI changes:

1. Open Community.
2. Confirm the page loads without a white screen.
3. Confirm main controls are reachable.
4. Confirm menus and panels scroll when content grows.
5. Confirm text does not overlap or overflow.
6. Confirm keyboard/focus behavior when controls changed.

Warnings count as defects.
