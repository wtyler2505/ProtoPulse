# Validation Page Map

Use this before changing Validation. It records where the page likely lives and what nearby systems can be affected.

## Source Globs

- `client/src/components/views/ValidationView.tsx`
- `client/src/components/views/validation/**`
- `client/src/lib/export-validation.ts`

## Test Globs

- `client/src/components/views/__tests__/ValidationView.test.tsx`
- `client/src/lib/__tests__/export-validation.test.ts`

## Ownership

- This skill owns page-level Validation orientation.
- Implementation files remain the source of truth.
- If this map disagrees with the code, update this map after verifying the code.

## Neighbor Systems

- Workspace navigation can affect whether Validation is reachable.
- UI/UX changes can affect layout, density, scrolling, and accessibility.
- AI/chat actions may need view-aware context for this page.
- Validation, export, inventory, or procurement may depend on this page when the workflow touches hardware readiness.
