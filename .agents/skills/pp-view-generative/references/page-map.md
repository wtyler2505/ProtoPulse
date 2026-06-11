# Generative Page Map

Use this before changing Generative. It records where the page likely lives and what nearby systems can be affected.

## Source Globs

- `client/src/components/views/GenerativeDesignView.tsx`
- `client/src/lib/generative-design/**`

## Test Globs

- `client/src/components/views/__tests__/GenerativeDesignView.test.tsx`
- `client/src/lib/generative-design/__tests__/generative-adopt.test.ts`
- `client/src/lib/generative-design/__tests__/*.test.ts`

## Ownership

- This skill owns page-level Generative orientation.
- Implementation files remain the source of truth.
- If this map disagrees with the code, update this map after verifying the code.

## Neighbor Systems

- Workspace navigation can affect whether Generative is reachable.
- UI/UX changes can affect layout, density, scrolling, and accessibility.
- AI/chat actions may need view-aware context for this page.
- Validation, export, inventory, or procurement may depend on this page when the workflow touches hardware readiness.
