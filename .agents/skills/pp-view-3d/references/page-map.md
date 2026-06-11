# 3D View Page Map

Use this before changing 3D View. It records where the page likely lives and what nearby systems can be affected.

## Source Globs

- `client/src/components/views/BoardViewer3DView.tsx`

## Test Globs

- No test globs recorded yet.

## Ownership

- This skill owns page-level 3D View orientation.
- Implementation files remain the source of truth.
- If this map disagrees with the code, update this map after verifying the code.

## Neighbor Systems

- Workspace navigation can affect whether 3D View is reachable.
- UI/UX changes can affect layout, density, scrolling, and accessibility.
- AI/chat actions may need view-aware context for this page.
- Validation, export, inventory, or procurement may depend on this page when the workflow touches hardware readiness.
