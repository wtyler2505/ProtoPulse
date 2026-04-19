---
description: 'ProtoPulse''s canonical Drizzle pattern: one pgTable() call produces the migration, the Zod validator (via createInsertSchema)...'
type: pattern
source: shared/schema.ts, server/db.ts
confidence: supported
topics:
- backend-persistence-patterns
- architecture-decisions
related_components:
- shared/schema.ts
- server/storage/
---
# Drizzle schema defines the column, the Zod validator, and the TypeScript type from one source

Every table in `shared/schema.ts` follows the same four-line contract: declare the `pgTable`, derive the insert validator with `createInsertSchema(table).omit({...}).extend({...})`, export `type InsertX = z.infer<typeof insertXSchema>`, and export `type X = typeof table.$inferSelect`. The column list is the only place where shape lives — migrations, validation, and compile-time types are all projections of that single declaration.

The `.omit()` call does real work. Server-managed fields — `id`, `createdAt`, `updatedAt`, `deletedAt`, `version`, `ownerId`, `approvedAt`, `approvedBy` — are removed from the insert schema because clients must never supply them. This is policy expressed in the type system: a handler that accepts `InsertProject` literally cannot forward a client-supplied `createdAt` because the type has no such field.

The `.extend()` call is where Drizzle's loose column types get sharpened. `text("severity")` becomes `z.enum(["error", "warning", "info"])`. `text("role")` becomes `z.enum(["user", "assistant", "system"])`. `jsonb("data")` becomes a structured object schema with `.passthrough().nullable().optional()` — so new fields are accepted forward-compatibly but known fields are validated. The database stores whatever text, but the API refuses anything outside the enumerated set before it ever reaches the write.

Because `InsertX` and `X` are both derived, a schema change cannot drift from its validator or its type. Remove a column and every call site fails to compile. Tighten an enum in `.extend()` and every existing insert that violates the tighter constraint is caught at the boundary. This is the mechanism behind [[drizzle-orm-was-chosen-for-type-safe-zod-integration]] in practice — not the claim that types are generated, but the specific four-line pattern that makes generation the default and bypass the exception.

---

Source: [[2026-04-19-drizzle-orm-schema-patterns-for-protopulse]]

Relevant Notes:
- [[drizzle-orm-was-chosen-for-type-safe-zod-integration]] — this is the mechanical expression of that decision
- [[jsonb-columns-model-flexible-graph-state-while-typed-columns-handle-queryable-invariants]] — explains why `.extend()` layers Zod over `jsonb`
- [[drizzle-uses-foreign-keys-with-on-delete-cascade-instead-of-the-relations-helper]] — companion pattern that keeps the single-source property whole
- [[comprehensive-audit-reveals-zero-validation-at-any-layer]] — the counterpattern; this note is the prescription

Topics:
- [[backend-persistence-patterns]]
- [[architecture-decisions]]
