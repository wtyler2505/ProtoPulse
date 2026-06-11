# Audit Trail Testing Guide

Use the smallest test set that proves the changed behavior.

## Recorded Test Handles

- No dedicated test glob is recorded yet. Add or locate the nearest test before risky changes.

## Skill Checks

- `node .agents/skills/pp-view-audit-trail/scripts/inspect-audit-trail.mjs`
- `npm run page-skills:check`
- `npm run page-skills:audit-packs`

## Browser Checks

For visible UI changes:

1. Open Audit Trail.
2. Confirm the page loads without a white screen.
3. Confirm main controls are reachable.
4. Confirm menus and panels scroll when content grows.
5. Confirm text does not overlap or overflow.
6. Confirm keyboard/focus behavior when controls changed.

Warnings count as defects.

## R23 Keyboard Gate Evidence

- `npm run test:keyboard-nav -- --reporter=dot --workers=1 --grep "calculators|audit_trail|generative_design|settings page"` passed after replacing native date inputs with labeled text date fields.
- Full `npm run test:keyboard-nav -- --reporter=dot --workers=1` passed later in R23 with Audit Trail at 19/20 reachable stops and 30 distinct targets.
