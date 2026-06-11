# Simulation Page Map

Use this before changing Simulation. It records where the page likely lives and what nearby systems can be affected.

## Source Globs

- `client/src/components/simulation/**`

## Test Globs

- `client/src/components/simulation/__tests__/ProbeManager.radial.test.tsx`

## Ownership

- This skill owns page-level Simulation orientation.
- Implementation files remain the source of truth.
- If this map disagrees with the code, update this map after verifying the code.

## Neighbor Systems

- Workspace navigation can affect whether Simulation is reachable.
- UI/UX changes can affect layout, density, scrolling, and accessibility.
- AI/chat actions may need view-aware context for this page.
- Validation, export, inventory, or procurement may depend on this page when the workflow touches hardware readiness.
