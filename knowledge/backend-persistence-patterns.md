---
description: "How ProtoPulse persists state — Drizzle schema conventions, node-postgres pool, transaction pattern, jsonb usage, and FK-cascade strategy. Entry point for anyone touching `shared/schema.ts` or `server/storage/`."
type: moc
topics:
  - "[[architecture-decisions]]"
  - "[[implementation-patterns]]"
---

# backend-persistence-patterns

ProtoPulse's persistence layer is Drizzle ORM over PostgreSQL via the `node-postgres` pool. The backend carries 46 tables, 132 `jsonb` columns, and zero uses of Drizzle's `relations()` helper. This MOC indexes the patterns that make that shape work.

## Core pattern

- [[drizzle-orm-was-chosen-for-type-safe-zod-integration]] — the original decision; schema → Zod → TS from one source
- [[drizzle-schema-defines-the-column-the-zod-validator-and-the-typescript-type-from-one-source]] — the mechanical four-line idiom that realizes the decision
- [[drizzle-uses-foreign-keys-with-on-delete-cascade-instead-of-the-relations-helper]] — FK-only convention; joins are explicit

## Infrastructure

- [[protopulse-uses-node-postgres-pool-not-neon-serverless-and-configures-pool-limits-explicitly]] — real TCP pool, not the Neon-serverless assumption most Drizzle docs make
- [[drizzle-transactions-wrap-read-modify-write-sequences-with-tx-scoped-queries]] — the `db.transaction(async (tx) => ...)` pattern in storage layers

## State modeling

- [[jsonb-columns-model-flexible-graph-state-while-typed-columns-handle-queryable-invariants]] — when to reach for `jsonb` vs a typed column
- [[jsonb-columns-lack-gin-indexes-forcing-sequential-scans]] — the cost when `jsonb` fields get queried without GIN support (current debt)

## Known debt adjacent to this area

- [[no-database-migration-skill-despite-drizzle-being-core]] — gap in the skills layer
- [[risk-analysis-tool-references-nonexistent-schema-columns]] — symptom of schema drift in AI-facing tools

## Migration commands

- Development: `npm run db:push` (drizzle-kit push, fast schema sync)
- Production: `npm run db:migrate` (drizzle-kit migrate, applies SQL files from `migrations/`)
- Generation: `npm run db:generate` after schema edits
- Studio: `npm run db:studio`

Baseline 19 tables (2026-02-28). Constraint pass 2026-03-01. +8 tables + column additions 2026-03-08.

## When to extend this MOC

Any new pattern that touches `shared/schema.ts`, `server/db.ts`, or `server/storage/` belongs here. Decisions about Drizzle versions, driver choice (node-postgres vs neon-serverless vs postgres-js), or migration workflow go under Infrastructure. New idioms for encoding data (soft delete, audit trail, JSONB shapes) go under State modeling. Keep individual patterns atomic; this MOC grows by adding wiki-links, not prose.

Topics:
- [[architecture-decisions]]
- [[implementation-patterns]]
