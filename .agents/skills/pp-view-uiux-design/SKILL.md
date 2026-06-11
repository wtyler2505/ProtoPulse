---
name: pp-view-uiux-design
description: ProtoPulse page intelligence for UI/UX, DESIGN.md, theme, layout, spacing, density, typography, accessibility, animation, workspace header, navigation, and design-system behavior.
---

# ProtoPulse UI/UX + DESIGN

Use this for cross-page design, theme, layout, density, accessibility, and interaction work.

## When To Use

- Theme tokens, `DESIGN.md`, spacing, density, typography, or color work.
- Workspace header, mobile nav, buttons, menus, cards, panels, scrollbars, or system components.
- UI that feels too loud, too icon-heavy, too cramped, or too unclear.
- Accessibility, keyboard, focus, readable text, and responsive layout work.

## Fast Workflow

1. Run `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`.
2. Read `references/page-map.md` for design-system entrypoints.
3. Read `references/ux-contract.md` before changing visual style.
4. Read `references/testing.md` for checks and screenshot expectations.
5. Record durable design lessons in `references/self-improvement-log.md`.

## Useful Checks

- `npm run design:check`
- `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs`
- `npm run test -- client/src/__tests__/a11y.test.tsx`
- `npm run test -- client/src/pages/workspace/__tests__/WorkspaceHeader.test.tsx`
- `npm run test -- client/src/components/ui/__tests__/button.test.tsx client/src/components/ui/__tests__/button.a11y.test.tsx`
- Use browser screenshots for layout, sizing, theme, and responsive work.

## Self-Improvement Rule

When a UI lesson repeats, add it here or to a reference file. Do not let the same sizing, spacing, or menu bug get rediscovered every session.

## Auto-Sync Facts

<!-- PAGE-SKILL:AUTO-SYNC:START -->
Last synced: 2026-05-18T01:46:36.897Z
Commit: 414f0bbc
Manifest status: active
Tier: 1

Source globs:
- DESIGN.md
- client/src/index.css
- client/src/components/ui/**
- client/src/pages/workspace/**

Test globs:
- client/src/__tests__/a11y.test.tsx
- client/src/components/ui/**/*.test.tsx
- client/src/pages/workspace/**/*.test.tsx
<!-- PAGE-SKILL:AUTO-SYNC:END -->
