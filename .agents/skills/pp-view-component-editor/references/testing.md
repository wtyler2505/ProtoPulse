# Component Editor Testing Guide

Use the smallest test set that proves the changed behavior.

## Recorded Test Handles

- `npm run test -- client/src/components/views/__tests__/ComponentEditorAutoSave.test.tsx`
- `npm run check` catches the current Component Editor -> 3D bridge wiring until a fuller ComponentEditorView harness exists.
- `npm run test -- client/src/lib/__tests__/viewer-3d-bridge.test.ts`
  - Locks the Component Editor exact-part bridge payload shape in the shared 3D bridge library.
- `env -u NO_COLOR -u FORCE_COLOR PLAYWRIGHT_HTML_OPEN=never npm run test:e2e -- e2e/p1-viewer-3d-bridge.spec.ts --reporter=dot --workers=1`
  - Seeds a real exact-part row, opens Component Editor, clicks `button-view-3d`, and verifies the 3D bridge card carries verification, pin-map, package, and ready-state context.
- `npm run test -- client/src/components/views/component-editor/__tests__/*.test.tsx`
- `npm run test -- client/src/components/views/component-editor/__tests__/*.test.ts`
- `npm run test -- client/src/lib/component-editor/__tests__/*.test.ts`

## Skill Checks

- `node .agents/skills/pp-view-component-editor/scripts/inspect-component-editor.mjs`
- `npm run page-skills:check`
- `npm run page-skills:audit-packs`

## Browser Checks

For visible UI changes:

1. Open Component Editor.
2. Confirm the page loads without a white screen.
3. Confirm main controls are reachable.
4. Confirm menus and panels scroll when content grows.
5. Confirm text does not overlap or overflow.
6. Confirm keyboard/focus behavior when controls changed.

Warnings count as defects.
