# Dashboard Page Map

Use this before changing Dashboard. It records where the page likely lives and what nearby systems can be affected.

## Source Globs

- `client/src/components/views/DashboardView.tsx`

## Test Globs

- `client/src/components/views/__tests__/DashboardView.validation.test.tsx`

## Ownership

- This skill owns page-level Dashboard orientation.
- Implementation files remain the source of truth.
- If this map disagrees with the code, update this map after verifying the code.

## Neighbor Systems

- Workspace navigation can affect whether Dashboard is reachable.
- UI/UX changes can affect layout, density, scrolling, and accessibility.
- AI/chat actions may need view-aware context for this page.
- Validation, export, inventory, or procurement may depend on this page when the workflow touches hardware readiness.
