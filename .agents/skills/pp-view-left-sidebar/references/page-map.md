# Left Sidebar Page Map

Use this before changing the sidebar. It shows which file owns which part of the left-side experience.

## Main Entry Points

- `client/src/components/layout/Sidebar.tsx` owns the sidebar shell, sizing, collapse behavior, and panel composition.
- `client/src/components/layout/sidebar/SidebarHeader.tsx` owns the top project/header controls.
- `client/src/components/layout/sidebar/ProjectSettingsPanel.tsx` owns project settings inside the sidebar.
- `client/src/components/layout/sidebar/ProjectExplorer.tsx` owns project file/tree navigation.
- `client/src/components/layout/sidebar/ComponentTree.tsx` owns component hierarchy display.
- `client/src/components/layout/sidebar/HistoryList.tsx` owns design history display.
- `client/src/components/layout/sidebar/CoachPanel.tsx` owns left-side coaching/help content.
- `client/src/components/layout/sidebar/sidebar-constants.ts` owns sidebar navigation constants.

## Related Layout

- `client/src/pages/ProjectWorkspace.tsx` composes workspace side panels.
- `client/src/pages/workspace/MobileNav.tsx` owns mobile navigation.
- `client/src/pages/workspace/WorkspaceHeader.tsx` owns top workspace navigation and actions.
- `client/src/components/layout/WorkflowBreadcrumb.tsx` owns breadcrumb display.

## Common Change Areas

- Project settings sizing and scroll behavior.
- More/menu overflow and small-height behavior.
- Expanded/collapsed sidebar width.
- Navigation labels, icons, active states, and density.
- Panel handoff into workspace views.
