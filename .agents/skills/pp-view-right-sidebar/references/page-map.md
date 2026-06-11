# Right Sidebar Page Map

Use this before changing Right Sidebar. It records where the page likely lives and what nearby systems can be affected.

## Source Globs

- `client/src/components/panels/ChatPanel.tsx`
- `client/src/components/panels/ActivityFeedPanel.tsx`
- `client/src/pages/ProjectWorkspace.tsx`

## Test Globs

- `client/src/components/panels/**/*.test.tsx`
- `client/src/pages/workspace/__tests__/WorkspaceHeader.test.tsx`

## Ownership

- This skill owns page-level Right Sidebar orientation.
- Implementation files remain the source of truth.
- If this map disagrees with the code, update this map after verifying the code.

## Neighbor Systems

- Workspace navigation can affect whether Right Sidebar is reachable.
- UI/UX changes can affect layout, density, scrolling, and accessibility.
- AI/chat actions may need view-aware context for this page.
- Validation, export, inventory, or procurement may depend on this page when the workflow touches hardware readiness.
