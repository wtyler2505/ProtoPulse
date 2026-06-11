# Part Usage Page Map

Use this before changing Part Usage. It records where the page likely lives and what nearby systems can be affected.

## Source Globs

- `client/src/components/views/PartUsageBrowserView.tsx`

## Test Globs

- No test globs recorded yet.

## Ownership

- This skill owns page-level Part Usage orientation.
- Implementation files remain the source of truth.
- If this map disagrees with the code, update this map after verifying the code.

## Neighbor Systems

- Workspace navigation can affect whether Part Usage is reachable.
- UI/UX changes can affect layout, density, scrolling, and accessibility.
- AI/chat actions may need view-aware context for this page.
- Validation, export, inventory, or procurement may depend on this page when the workflow touches hardware readiness.
