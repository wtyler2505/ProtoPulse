# Inventory Page Map

Use this before changing Inventory. It records where the page likely lives and what nearby systems can be affected.

## Source Globs

- `client/src/components/views/StorageManagerPanel.tsx`

## Test Globs

- `client/src/components/views/__tests__/storage-manager.test.tsx`

## Ownership

- This skill owns page-level Inventory orientation.
- Implementation files remain the source of truth.
- If this map disagrees with the code, update this map after verifying the code.

## Neighbor Systems

- Workspace navigation can affect whether Inventory is reachable.
- UI/UX changes can affect layout, density, scrolling, and accessibility.
- AI/chat actions may need view-aware context for this page.
- Validation, export, inventory, or procurement may depend on this page when the workflow touches hardware readiness.
- Inventory review now consumes the shared `runExportPrecheck('inventory-review', ...)` gate from `client/src/lib/export-precheck.ts`.
