# BOM Templates Page Map

Use this before changing BOM Templates. It records where the page likely lives and what nearby systems can be affected.

## Source Globs

- `client/src/components/views/BomTemplatesPanel.tsx`

## Test Globs

- `client/src/components/views/__tests__/BomTemplatesPanel.test.tsx`

## Ownership

- This skill owns page-level BOM Templates orientation.
- Implementation files remain the source of truth.
- If this map disagrees with the code, update this map after verifying the code.

## Neighbor Systems

- Workspace navigation can affect whether BOM Templates is reachable.
- UI/UX changes can affect layout, density, scrolling, and accessibility.
- AI/chat actions may need view-aware context for this page.
- Validation, export, inventory, or procurement may depend on this page when the workflow touches hardware readiness.
- Template apply preview uses `useBomTemplateDetail` from `client/src/lib/parts/use-bom-templates.ts` and the backend detail endpoint `GET /api/bom-templates/:id`.
