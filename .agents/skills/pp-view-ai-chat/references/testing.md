# AI Chat Testing Guide

Use the smallest test set that proves the changed behavior.

## Recorded Test Handles

- `npm run test -- client/src/components/panels/chat/**/*.test.tsx`
- `npm run test -- client/src/components/panels/chat/**/*.test.ts`

## Skill Checks

- `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs`
- `npm run page-skills:check`
- `npm run page-skills:audit-packs`

## Browser Checks

For visible UI changes:

1. Open AI Chat.
2. Confirm the page loads without a white screen.
3. Confirm main controls are reachable.
4. Confirm menus and panels scroll when content grows.
5. Confirm text does not overlap or overflow.
6. Confirm keyboard/focus behavior when controls changed.

Warnings count as defects.
