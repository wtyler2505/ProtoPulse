# Component Editor Page Map

Use this before changing Component Editor. It records where the page likely lives and what nearby systems can be affected.

## Source Globs

- `client/src/components/views/ComponentEditorView.tsx`
- `client/src/components/views/component-editor/**`

## Test Globs

- `client/src/components/views/__tests__/ComponentEditorAutoSave.test.tsx`
- `client/src/components/views/component-editor/__tests__/*.test.tsx`
- `client/src/components/views/component-editor/__tests__/*.test.ts`
- `client/src/lib/component-editor/__tests__/*.test.ts`

## Ownership

- This skill owns page-level Component Editor orientation.
- Implementation files remain the source of truth.
- If this map disagrees with the code, update this map after verifying the code.

## Neighbor Systems

- Workspace navigation can affect whether Component Editor is reachable.
- UI/UX changes can affect layout, density, scrolling, and accessibility.
- AI/chat actions may need view-aware context for this page.
- Validation, export, inventory, or procurement may depend on this page when the workflow touches hardware readiness.
