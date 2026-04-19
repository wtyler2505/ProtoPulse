---
description: Multi-statement writes in ProtoPulse (replaceNodes, replaceEdges, seed, project-io) live inside `db.transaction(async (tx) => ...)`...
type: pattern
source: server/storage/architecture.ts, server/storage/projects.ts, server/storage/parts.ts, server/routes/seed.ts
confidence: supported
topics:
- backend-persistence-patterns
- implementation-patterns
related_components:
- server/storage/architecture.ts
- server/storage/projects.ts
- server/storage/parts.ts
- server/storage/validation.ts
- server/routes/components.ts
- server/routes/seed.ts
- server/routes/project-io.ts
---
# Drizzle transactions wrap read-modify-write sequences with tx-scoped queries

The pattern recurs in at least eight storage and route files. `await this.db.transaction(async (tx) => { ... })` opens a transaction; every `tx.select()`, `tx.update()`, `tx.insert().values().returning()` inside the closure reuses the same connection; throwing rolls everything back. Using the module-level `db` inside the closure would execute against a different connection, breaking isolation — that's the footgun `tx` exists to prevent.

`replaceNodes` in `server/storage/architecture.ts` is the clearest example: it selects the existing non-deleted rows, builds maps of existing vs incoming by `nodeId`, computes three sets (removed, to-insert, to-update, unchanged), soft-deletes the removed ones with `tx.update().set({ deletedAt: new Date() })`, inserts the new ones with `tx.insert().values().returning()`, updates the changed ones one-by-one with `returning()`, and returns the merged result. If any step throws — a FK violation on insert, a unique-index collision on update — the soft-delete and all earlier writes roll back together. The caller sees either the complete new state or the untouched old state, never a half-applied diff.

Three things make the pattern robust. First, `returning()` on inserts/updates means the transaction produces the post-write rows without a second round-trip — critical when the caller needs the generated `id` or the updated `updatedAt`. Second, all queries use `tx`, not `db` — grepping for `db\.` inside a transaction closure is a meaningful lint check. Third, errors thrown inside the closure propagate out of `db.transaction`, so `try/catch` at the transaction boundary (as `StorageError` wrappers do) captures both transport-level errors and constraint violations uniformly.

The pattern depends on a real pooled connection — see [[protopulse-uses-node-postgres-pool-not-neon-serverless-and-configures-pool-limits-explicitly]]. It would not compose the same way on a serverless driver where each HTTP call is independent; that's why the infrastructure choice and the transaction idiom reinforce each other.

---

Source: [[2026-04-19-drizzle-orm-schema-patterns-for-protopulse]]

Relevant Notes:
- [[protopulse-uses-node-postgres-pool-not-neon-serverless-and-configures-pool-limits-explicitly]] — enables real transactions over pooled TCP
- [[drizzle-schema-defines-the-column-the-zod-validator-and-the-typescript-type-from-one-source]] — the insert shape that `tx.insert().values()` accepts is the Zod-validated `InsertX` type
- [[setinterval-never-cleared-creates-memory-ratchet-in-server-routes]] — resource-leak family; transactions are the correct answer to "two writes must succeed together"

Topics:
- [[backend-persistence-patterns]]
- [[implementation-patterns]]
