---
description: Topic map for ProtoPulse implementation patterns — reusable code recipes (focus management, sparse-grid announcements...
type: moc
topics:
- index
- architecture-decisions
---
# implementation-patterns

Implementation patterns are the codified "how" of ProtoPulse: the code recipes that recur across features, the conventions every new contributor needs to recognize, and the anti-patterns avoided often enough to warrant written capture. They sit between [[architecture-decisions]] (why we chose X) and feature code (this specific implementation).

## Synthesis

Two meta-claims organize every pattern below:

1. **One source of truth per concept.** Drizzle schema defines column, validator, and TS type from one `pgTable` call ([[drizzle-schema-defines-the-column-the-zod-validator-and-the-typescript-type-from-one-source]]); focus management picks either roving-tabindex or `aria-activedescendant`, never both ([[roving-tabindex-is-more-reliable-than-aria-activedescendant-for-grid-focus-management]]). Redundant sources drift; single sources stay honest.
2. **Atomic writes, atomic announcements.** Whether wrapping a read-modify-write sequence in a Drizzle transaction ([[drizzle-transactions-wrap-read-modify-write-sequences-with-tx-scoped-queries]]) or announcing a virtualized grid position without rendering all cells ([[aria-rowindex-and-aria-colindex-let-sparse-grids-announce-position-without-rendering-all-cells]]), the pattern is the same: commit or speak the whole state, never partial.

## Core Ideas

### Backend / persistence

- [[drizzle-schema-defines-the-column-the-zod-validator-and-the-typescript-type-from-one-source]] — the canonical `pgTable` + `createInsertSchema` + `$inferSelect` pattern; deviation creates drift between DB, API validator, and TS types
- [[drizzle-transactions-wrap-read-modify-write-sequences-with-tx-scoped-queries]] — every multi-statement write uses `db.transaction(async (tx) => ...)` with tx-scoped queries for atomic rollback
- [[drizzle-uses-foreign-keys-with-on-delete-cascade-instead-of-the-relations-helper]] — the ProtoPulse convention of explicit `eq(child.parentId, parent.id)` joins instead of the `relations()` helper; cascades live in Postgres, not Drizzle
- [[jsonb-columns-model-flexible-graph-state-while-typed-columns-handle-queryable-invariants]] — the hybrid-column rule: typed columns for anything you filter or index, `jsonb` with `.passthrough()` Zod for graph state
- [[backend-persistence-patterns]] — the consolidated entry point for all storage-layer patterns; start here when editing `shared/schema.ts` or `server/storage/`

### Focus and announcement

- [[roving-tabindex-is-more-reliable-than-aria-activedescendant-for-grid-focus-management]] — pick roving-tabindex for composite widgets unless the active element must stay in a different subtree
- [[aria-rowindex-and-aria-colindex-let-sparse-grids-announce-position-without-rendering-all-cells]] — virtualization-friendly announcement for grids that render only visible cells

## Cross-cutting relationships

- **Testing** — implementation patterns here need the test strategies in [[testing-patterns]]. Transactions need real-Postgres integration tests; focus patterns need Playwright.
- **UX** — focus patterns couple tightly to [[ux-patterns]]; the decision to use roving-tabindex echoes back into component composition choices.
- **Gotchas** — implementation patterns that break under specific circumstances may spawn entries in [[gotchas]] rather than extending the pattern itself.

## Tensions

- **Convention weight vs flexibility.** The Drizzle conventions here (no `relations()`, explicit joins, `$inferSelect` types) make the codebase uniform but may feel verbose to contributors used to ORM-heavy styles. The convention survives because refactors happen in one place.
- **Roving vs activedescendant.** Both are legitimate. The [[roving-tabindex-is-more-reliable-than-aria-activedescendant-for-grid-focus-management]] default privileges reliability, but a composite widget with portal-rendered options (combobox + Radix Popover) may force activedescendant — flag rather than fight.

## Open Questions

- Should server-side validation patterns (Zod error shape, tRPC-ish response envelopes) have their own entry here?
- Is there an emergent pattern around optimistic-update + rollback (TanStack Query) that deserves capture?

## Agent Notes

Before adding a new implementation file, grep this MOC for patterns that already cover the situation — mismatched conventions are the fastest source of review friction.

---

Topics:
- [[index]]
- [[architecture-decisions]]
