# Schematic Page Map

Use this before changing Schematic. It records where the page likely lives and what nearby systems can be affected.

## Source Globs

- `client/src/components/views/SchematicView.tsx`
- `client/src/components/circuit-editor/Schematic*.tsx`
- `client/src/components/circuit-editor/schematic/**`

## Test Globs

- `client/src/components/views/__tests__/SchematicView.test.tsx`
- `client/src/components/circuit-editor/__tests__/Schematic*.test.tsx`

## Ownership

- This skill owns page-level Schematic orientation.
- Implementation files remain the source of truth.
- If this map disagrees with the code, update this map after verifying the code.

## Neighbor Systems

- Workspace navigation can affect whether Schematic is reachable.
- UI/UX changes can affect layout, density, scrolling, and accessibility.
- AI/chat actions may need view-aware context for this page.
- Validation, export, inventory, or procurement may depend on this page when the workflow touches hardware readiness.
