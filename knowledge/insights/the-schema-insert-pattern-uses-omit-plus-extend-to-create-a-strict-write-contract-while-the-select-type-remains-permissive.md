---
summary: Every table's insert schema uses createInsertSchema().omit({server-managed-fields}).extend({stricter-validations}) to enforce a write contract that is stricter than the raw table definition, while $inferSelect remains unvalidated
type: pattern
---

# The schema insert pattern uses omit+extend to create a strict write contract while the select type remains permissive

Every table in `shared/schema.ts` follows the same three-line pattern:

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

**The `nodeDataSchema.passthrough()` exception:** `architectureNodes.data` uses a Zod schema with `.passthrough()`, deliberately allowing unknown keys. This is the only insert schema that permits arbitrary data — all others are strict.

**Implication:** If a new status value or enum variant is needed, it must be added to the `.extend()` Zod schema (not just the DB column), or API writes will be rejected with a Zod validation error.
