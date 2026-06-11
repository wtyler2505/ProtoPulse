# Left Sidebar Testing Guide

Use the closest tests first. Add browser checks for visible sizing or menu changes.

## Unit And Component Checks

- `npm run test -- client/src/components/layout/__tests__/Sidebar.test.tsx`
- `npm run test -- client/src/components/layout/sidebar/__tests__/CoachPanel.test.tsx`
- `npm run test -- client/src/components/layout/sidebar/__tests__/sidebar-constants.test.ts`
- `npm run test -- client/src/pages/workspace/__tests__/WorkspaceHeader.test.tsx`
- `npm run test -- client/src/pages/workspace/__tests__/workspace-reducer.test.ts`

## Skill Checks

- `node .agents/skills/pp-view-left-sidebar/scripts/inspect-left-sidebar.mjs`
- `npm run page-skills:check`

## Browser Checks

For sidebar UI changes:

1. Check expanded sidebar.
2. Check collapsed sidebar.
3. Check a short viewport height.
4. Check project settings open.
5. Check any More/menu flyout.
6. Check mobile navigation if navigation changed.

Warnings count as defects. If a test prints a known warning, fix it or document why it is blocked.
