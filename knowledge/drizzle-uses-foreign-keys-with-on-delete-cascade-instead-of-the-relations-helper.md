---
description: 'ProtoPulse''s schema declares relationships only via `.references(() => parent.id, { onDelete: ''cascade'' })`...'
type: pattern
source: shared/schema.ts, server/storage/
confidence: supported
topics:
- backend-persistence-patterns
- implementation-patterns
related_components:
- shared/schema.ts
- server/storage/
---
# Drizzle uses foreign keys with on-delete-cascade instead of the relations helper

Drizzle ships two relationship mechanisms: the column-level `.references()` call that emits a real SQL foreign key, and the separate `relations()` helper that builds an in-TS graph enabling `db.query.projects.findMany({ with: { members: true } })` eager loading. ProtoPulse uses the first exclusively. `.references(() => projects.id, { onDelete: "cascade" })` appears on nearly every child-table foreign key in `shared/schema.ts`. The `relations()` import from `drizzle-orm` does not appear in any server or shared file — only in one client file (`client/src/lib/ai-root-cause.ts`) where it refers to a different concept.

The consequence is that every join is written out. Pulling a project with its members means `tx.select().from(projects).leftJoin(projectMembers, eq(projectMembers.projectId, projects.id))` — the relationship lives in the query, not in a schema-level declaration. This is more verbose than `findMany({ with: { members: true } })` but it makes the query shape explicit at the call site, which matters when storage layers compose queries across caches, transactions, and soft-delete filters.

Deletion cascades through Postgres, not through TypeScript. When a project row is hard-deleted, `ON DELETE CASCADE` on `projectMembers.projectId`, `architectureNodes.projectId`, `bomItems.projectId`, and every other child FK propagates the delete at the database layer. The application code does not walk the tree. This is why the schema rarely needs `deletedAt` on child tables whose parent soft-deletes — the cascade only fires on real deletes, and soft-deletes are filtered with `isNull(deletedAt)` predicates on the child's own `deletedAt` column.

The tradeoff is explicit: no `db.query` eager-loading sugar, so the repository layer carries the join logic; in return, Drizzle's type inference works directly off `$inferSelect` without a second graph to keep in sync, and cascading behavior is documented in the DDL where DBAs and `pg_dump` can read it. If ProtoPulse ever adopts `relations()`, the migration is additive — the FKs stay, and the relations block just wraps the existing references with named edges.

---

Source: [[2026-04-19-drizzle-orm-schema-patterns-for-protopulse]]

Relevant Notes:
- [[drizzle-schema-defines-the-column-the-zod-validator-and-the-typescript-type-from-one-source]] — the single-source property this convention keeps intact
- [[drizzle-transactions-wrap-read-modify-write-sequences-with-tx-scoped-queries]] — hand-written joins inside transactions is the direct consequence
- [[god-files-create-feature-paralysis-through-complexity]] — adjacent risk; without `relations()`, storage files must carry the join logic themselves

Topics:
- [[backend-persistence-patterns]]
- [[implementation-patterns]]
