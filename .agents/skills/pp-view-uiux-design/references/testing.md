# UI/UX + DESIGN Testing Guide

Use tests for behavior and browser screenshots for visual truth.

## Fast Checks

- `npm run design:check`
- `npm run test -- scripts/__tests__/design-token-drift.test.ts`
- `npm run test -- client/src/__tests__/a11y.test.tsx`
- `npm run test -- client/src/pages/workspace/__tests__/WorkspaceHeader.test.tsx`
- `npm run test -- client/src/pages/workspace/__tests__/workspace-reducer.test.ts`
- `npm run test -- client/src/pages/workspace/__tests__/useHoverPeekPanel.test.ts`
- `npm run test -- client/src/components/ui/__tests__/button.test.tsx client/src/components/ui/__tests__/button.a11y.test.tsx`

## Component Checks

- `npm run test -- client/src/components/ui/__tests__/RadialMenu.test.tsx`
- `npm run test -- client/src/components/ui/__tests__/TrustBadge.test.tsx`
- `npm run test -- client/src/components/ui/__tests__/UnifiedComponentSearch.test.tsx`
- `npm run test -- client/src/components/ui/__tests__/interactive-card.test.tsx`

## Browser Checks

For visible UI changes:

1. Capture desktop and mobile.
2. Check text fit.
3. Check scroll areas.
4. Check focus ring visibility.
5. Check menus that can grow.
6. Check no controls overlap.
7. Check dark theme contrast.

Warnings count as defects.

## Token Drift Gate

`DESIGN.md` is the source of truth for the default dark theme color tokens.
`npm run design:check` compares those frontmatter values against the base
`@theme` variables in `client/src/index.css`. Runtime theme overrides such as
`.light` can differ by design.

## R23 Keyboard Gate Evidence

- `npm run check` passed, including token drift and TypeScript.
- `npm run test:a11y -- --reporter=dot --workers=1` passed across 33 routes with no critical/serious axe findings.
- `npm run test:e2e -- e2e/tab-route-matrix.spec.ts --reporter=dot --workers=1` passed across 32 routes.
- `npm run test:keyboard-nav -- --reporter=dot --workers=1` passed across 31 routes with 1 intentional 3D canvas skip.
