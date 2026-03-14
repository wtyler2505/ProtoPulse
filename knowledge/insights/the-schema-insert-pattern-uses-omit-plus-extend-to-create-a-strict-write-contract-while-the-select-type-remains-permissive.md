---
summary: Every table's insert schema uses createInsertSchema().omit({server-managed-fields}).extend({stricter-validations}) to enforce a write contract that is stricter than the raw table definition, while $inferSelect remains unvalidated
type: pattern
---

# The schema insert pattern uses omit+extend to create a strict write contract while the select type remains permissive

Every table in `shared/schema.ts` (which uses [[the-schema-uses-dual-id-systems-serial-for-db-references-and-text-for-client-generated-uuids-creating-a-two-key-boundary|dual ID systems]] for canvas entities) follows the same three-line pattern:

```typescript
export const insertFooSchema = createInsertSchema(foos)
  .omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true })  // server-managed
  .extend({ status: z.enum([...]), severity: z.enum([...]) });             // stricter than DB
export type InsertFoo = z.infer<typeof insertFooSchema>;
export type Foo = typeof foos.$inferSelect;
```

**What `.omit()` excludes (server-managed fields):**
- `id` (auto-increment serial) — always
- `createdAt`, `updatedAt` — timestamp fields managed by DB defaults or server logic
- `deletedAt` — soft delete, never set on insert
- `version` — optimistic concurrency counter, starts at 1
- `totalPrice` — computed server-side from `quantity * unitPrice` (bomItems)
- `downloadCount` — managed by increment logic (componentLibrary)

**What `.extend()` tightens:**
- `bomItems.status`: DB column is `text`, but insert schema restricts to `z.enum(["In Stock", "Low Stock", "Out of Stock", "On Order"])`
- `validationIssues.severity`: DB is `text`, insert schema is `z.enum(["error", "warning", "info"])`
- `chatMessages.role`: DB is `text`, insert schema is `z.enum(["user", "assistant", "system"])`
- `hierarchicalPorts.direction`: DB is `text`, insert schema is `z.enum(["input", "output", "bidirectional"])`
- `spiceModels.modelType`: DB is `text`, insert schema is `z.enum([18 model types])`
- `designComments.content`: DB is `text`, insert schema adds `z.string().min(1).max(5000)`
- `architectureNodes.nodeType`: DB is `text`, insert schema adds `.min(1).max(100)`

The asymmetry: **InsertFoo** is strictly validated via Zod runtime checks. **Foo** (the select type) is whatever Drizzle infers from the column definition — typically `string | null` for text columns with no enum constraint. This means code reading from the DB gets looser types than code writing to it. A `status` column reads as `string | null` but must be written as one of four specific values.

**The `nodeDataSchema.passthrough()` exception:** `architectureNodes.data` uses a Zod schema with `.passthrough()`, deliberately allowing unknown keys. This is the only insert schema that permits arbitrary data — all others are strict. This connects to the broader [[jsonb-columns-are-a-schema-escape-hatch-that-trades-db-level-validation-for-flexibility-creating-a-zod-bridged-type-boundary|JSONB escape hatch pattern]] where the DB provides no validation and Zod is the only type boundary.

**Implication:** If a new status value or enum variant is needed, it must be added to the `.extend()` Zod schema (not just the DB column), or API writes will be rejected with a Zod validation error. The [[drizzle-orm-0-45-is-blocked-by-zod-v4-dependency-so-the-orm-must-be-pinned-until-full-zod-migration|Drizzle ORM pin at 0.39.3]] is a direct consequence — the entire omit+extend pattern depends on `createInsertSchema` from drizzle-zod, which is locked to Zod v3.

---

Related:
- [[the-schema-uses-dual-id-systems-serial-for-db-references-and-text-for-client-generated-uuids-creating-a-two-key-boundary]] — the dual-ID tables these insert schemas govern
- [[jsonb-columns-are-a-schema-escape-hatch-that-trades-db-level-validation-for-flexibility-creating-a-zod-bridged-type-boundary]] — JSONB columns where `.extend()` is the only validation boundary; `.passthrough()` is the deliberate relaxation
- [[drizzle-orm-0-45-is-blocked-by-zod-v4-dependency-so-the-orm-must-be-pinned-until-full-zod-migration]] — the Zod v3 pin that constrains this pattern's toolchain
- [[storage-error-maps-postgresql-error-codes-to-http-status-giving-routes-structured-error-semantics-without-db-coupling]] — when Zod validation passes but DB constraints reject, StorageError translates the failure
