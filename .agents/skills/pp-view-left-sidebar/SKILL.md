---
name: pp-view-left-sidebar
description: ProtoPulse page intelligence for the left sidebar. Use when working on Sidebar, SidebarHeader, ProjectExplorer, ProjectSettingsPanel, ComponentTree, HistoryList, CoachPanel, left navigation, project settings sizing, or sidebar density.
---

# ProtoPulse Left Sidebar

Use this when work touches the left navigation/sidebar and its panels.

## When To Use

- Sidebar layout, sizing, scrolling, collapse, flyouts, or mobile navigation.
- Project settings, project explorer, component tree, history, or coach panel work.
- Any bug where the sidebar steals too much room or makes the app feel loud.
- Any navigation change that affects page discoverability.

## Fast Workflow

1. Run `node .agents/skills/pp-view-left-sidebar/scripts/inspect-left-sidebar.mjs`.
2. Read `references/page-map.md` for ownership and file paths.
3. Read `references/ux-contract.md` before changing sizing, menus, or layout.
4. Read `references/testing.md` for the closest checks.
5. Record durable lessons in `references/self-improvement-log.md`.

## Useful Checks

- `node .agents/skills/pp-view-left-sidebar/scripts/inspect-left-sidebar.mjs`
- `npm run test -- client/src/components/layout/__tests__/Sidebar.test.tsx`
- `npm run test -- client/src/components/layout/sidebar/__tests__/CoachPanel.test.tsx`
- `npm run test -- client/src/components/layout/sidebar/__tests__/sidebar-constants.test.ts`
- Browser-check expanded, collapsed, flyout, small-height, and mobile states.

## Self-Improvement Rule

If a sidebar bug is found by screenshots or runtime use, capture the lesson in this skill so the next pass starts from evidence.

## Auto-Sync Facts

<!-- PAGE-SKILL:AUTO-SYNC:START -->
Last synced: 2026-05-18T01:46:36.897Z
Commit: 414f0bbc
Manifest status: active
Tier: 1

Source globs:
- client/src/components/layout/Sidebar.tsx
- client/src/components/layout/sidebar/**

Test globs:
- client/src/components/layout/__tests__/Sidebar.test.tsx
- client/src/components/layout/sidebar/**/*.test.tsx
<!-- PAGE-SKILL:AUTO-SYNC:END -->
