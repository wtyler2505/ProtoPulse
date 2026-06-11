# Procurement Page Map

Use this before changing Procurement. It records where the page likely lives and what nearby systems can be affected.

## Source Globs

- `client/src/components/views/ProcurementView.tsx`
- `client/src/components/views/procurement/**`
- `client/src/lib/supplier-api/**`

## Test Globs

- `client/src/components/views/__tests__/procurement-sub-components.test.tsx`
- `client/src/lib/__tests__/supplier-api.test.ts`

## Ownership

- This skill owns page-level Procurement orientation.
- Implementation files remain the source of truth.
- If this map disagrees with the code, update this map after verifying the code.

## Neighbor Systems

- Workspace navigation can affect whether Procurement is reachable.
- UI/UX changes can affect layout, density, scrolling, and accessibility.
- AI/chat actions may need view-aware context for this page.
- Validation, export, inventory, or procurement may depend on this page when the workflow touches hardware readiness.
