# Lifecycle Page Map

Use this before changing Lifecycle. It records where the page likely lives and what nearby systems can be affected.

## Source Globs

- `client/src/components/views/LifecycleDashboard.tsx`

## Test Globs

- `client/src/components/views/__tests__/LifecycleDashboard.test.tsx`

## Ownership

- This skill owns page-level Lifecycle orientation.
- Implementation files remain the source of truth.
- If this map disagrees with the code, update this map after verifying the code.

## Neighbor Systems

- Workspace navigation can affect whether Lifecycle is reachable.
- UI/UX changes can affect layout, density, scrolling, and accessibility.
- AI/chat actions may need view-aware context for this page.
- Validation, export, inventory, or procurement may depend on this page when the workflow touches hardware readiness.
- Export precheck changes can affect Lifecycle release-gate behavior.
