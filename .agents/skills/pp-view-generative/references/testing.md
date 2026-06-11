# Generative Testing Guide

Use the smallest test set that proves the changed behavior.

## Recorded Test Handles

- `npm run test -- client/src/components/views/__tests__/GenerativeDesignView.test.tsx`
  - Candidate card rendering, compare/adopt/export, and candidate -> 3D bridge with structured fitness provenance.
- `env -u NO_COLOR -u FORCE_COLOR PLAYWRIGHT_HTML_OPEN=never npm run test:e2e -- e2e/p1-viewer-3d-bridge.spec.ts --reporter=dot --workers=1`
  - Runs a small real generation, clicks a candidate `View 3D` action, and verifies the 3D bridge card carries AI provenance, generated state, source engine, structured fitness, component count, and needs-review state.
- `npm run test -- client/src/lib/generative-design/__tests__/generative-adopt.test.ts`
- `npm run test -- client/src/lib/generative-design/__tests__/*.test.ts`

## Skill Checks

- `node .agents/skills/pp-view-generative/scripts/inspect-generative.mjs`
- `npm run page-skills:check`
- `npm run page-skills:audit-packs`

## Browser Checks

For visible UI changes:

1. Open Generative.
2. Confirm the page loads without a white screen.
3. Confirm main controls are reachable.
4. Confirm menus and panels scroll when content grows.
5. Confirm text does not overlap or overflow.
6. Confirm keyboard/focus behavior when controls changed.

Warnings count as defects.

## R23 Keyboard Gate Evidence

- `npm run test -- client/src/components/views/__tests__/GenerativeDesignView.test.tsx` passed after adding stable names/test ids to spec controls.
- `npm run test:keyboard-nav -- --reporter=dot --workers=1 --grep "calculators|audit_trail|generative_design|settings page"` passed with Generative Design at 19/20 reachable stops.
- Full `npm run test:keyboard-nav -- --reporter=dot --workers=1` passed later in R23 with Generative Design at 19/20 reachable stops and 29 distinct targets.
