# UI/UX + DESIGN Page Map

Use this before cross-page UI work.

## Design Sources

- `DESIGN.md` owns the intended color and style direction.
- `client/src/index.css` owns global CSS variables and base styles.
- `client/src/components/ui/` owns reusable UI primitives and custom UI helpers.

## Workspace Sources

- `client/src/pages/ProjectWorkspace.tsx` owns the main app shell.
- `client/src/pages/workspace/WorkspaceHeader.tsx` owns the top workspace header.
- `client/src/pages/workspace/MobileNav.tsx` owns mobile navigation.
- `client/src/pages/workspace/ViewRenderer.tsx` owns view rendering.
- `client/src/pages/workspace/workspace-reducer.ts` owns workspace state transitions.
- `client/src/pages/workspace/useHoverPeekPanel.ts` owns hover-peek behavior.

## High-Impact UI Components

- `client/src/components/ui/button.tsx`
- `client/src/components/ui/dropdown-menu.tsx`
- `client/src/components/ui/scroll-area.tsx`
- `client/src/components/ui/dialog.tsx`
- `client/src/components/ui/tooltip.tsx`
- `client/src/components/ui/tabs.tsx`
- `client/src/components/ui/card.tsx`
- `client/src/components/ui/input.tsx`

## Neighbor Skills

- Use `pp-view-left-sidebar` for left navigation and settings sizing.
- Use `pp-view-right-sidebar` for chat/activity docking.
- Use page-specific skills when the design issue belongs mainly to one page.
