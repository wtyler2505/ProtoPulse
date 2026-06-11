# PCB Page Map

Use this before changing PCB. It records where the page likely lives and what nearby systems can be affected.

## Source Globs

- `client/src/components/circuit-editor/PCBLayoutView.tsx`
- `client/src/components/views/pcb-layout/**`
- `client/src/lib/tscircuit-*.ts`

## Test Globs

- `client/src/lib/__tests__/tscircuit-*.test.ts`
- `client/src/components/circuit-editor/__tests__/TSCircuit*.test.tsx`

## Ownership

- This skill owns page-level PCB orientation.
- Implementation files remain the source of truth.
- If this map disagrees with the code, update this map after verifying the code.

## Neighbor Systems

- Workspace navigation can affect whether PCB is reachable.
- UI/UX changes can affect layout, density, scrolling, and accessibility.
- AI/chat actions may need view-aware context for this page.
- Validation, export, inventory, or procurement may depend on this page when the workflow touches hardware readiness.
