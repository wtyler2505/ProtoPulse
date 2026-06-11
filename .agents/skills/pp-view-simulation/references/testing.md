# Simulation Testing Guide

Use the smallest test set that proves the changed behavior.

## Recorded Test Handles

- `client/src/components/simulation/__tests__/ProbeManager.radial.test.tsx`
  - Probe metadata for radial target detection.
  - Simulation probe AI explanation command dispatch through the shared radial AI chat path.

## Skill Checks

- `node .agents/skills/pp-view-simulation/scripts/inspect-simulation.mjs`
- `npm run page-skills:check`
- `npm run page-skills:audit-packs`

## Browser Checks

For visible UI changes:

1. Open Simulation.
2. Confirm the page loads without a white screen.
3. Confirm main controls are reachable.
4. Confirm menus and panels scroll when content grows.
5. Confirm text does not overlap or overflow.
6. Confirm keyboard/focus behavior when controls changed.

Warnings count as defects.
