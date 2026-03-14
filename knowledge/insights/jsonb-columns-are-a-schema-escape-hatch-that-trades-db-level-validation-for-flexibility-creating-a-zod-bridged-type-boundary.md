---
summary: 15+ JSONB columns across the schema store structured data without DB-level constraints, relying on Zod insert schemas as the only type boundary between untyped storage and typed code
type: pattern
---

# JSONB columns are a schema escape hatch that trades DB-level validation for flexibility

`shared/schema.ts` uses `jsonb` columns extensively as a structured escape hatch:

**High-structure JSONB (shapes, connectors):** `componentParts.meta`, `.connectors`, `.buses`, `.views`, `.constraints` — these store the full component type system defined in `component-types.ts` (PartMeta, Connector[], Bus[], PartViews, Constraint[]). The types are rich and deeply nested but the DB sees only `jsonb`.

**Configuration JSONB (settings bags):** `circuitDesigns.settings`, `circuitInstances.properties`, `circuitNets.segments/labels/style`, `simulationResults.config/results`, `aiActions.parameters/result`, `arduinoBuildProfiles.boardOptions/portConfig/libOverrides`, `pcbZones.properties`, `bomSnapshots.snapshotData`.

**Lightly typed JSONB:** `architectureNodes.data` — uses a `nodeDataSchema` with `.passthrough().nullable().optional()` (Zod allows any extra keys), `architectureEdges.style` — similarly `.passthrough()`.

The pattern: Drizzle `jsonb()` columns are typed as `unknown` at the DB layer. The insert schemas use [[the-schema-insert-pattern-uses-omit-plus-extend-to-create-a-strict-write-contract-while-the-select-type-remains-permissive|`.extend()` with Zod schemas]] to add runtime validation on write. But on **read**, the Drizzle `$inferSelect` type infers the column as `unknown`, requiring explicit casts (`as PartMeta`, `as Connector[]`) in storage.ts methods.

This creates an asymmetric type boundary:
- **Writes** are validated by Zod — good
- **Reads** are unvalidated casts — a silent corruption vector if the DB data doesn't match the expected shape (e.g., after a schema evolution where new fields are added)

The `nodeDataSchema.passthrough()` pattern is particularly risky: it explicitly allows any key-value pairs beyond the known schema, meaning the column accumulates arbitrary data from AI tool outputs that never gets cleaned up.

**Mitigation used:** The `standard-library.ts` defines its own parallel type system (`SchematicShape`, `Connector`, `PinDef`) rather than importing from `component-types.ts`, specifically to "avoid coupling to Drizzle insert schema which uses jsonb (unknown)" — see line 16. This is a pragmatic workaround but means the standard library's types can drift from the main type system.

JSONB columns also carry [[the-schema-uses-dual-id-systems-serial-for-db-references-and-text-for-client-generated-uuids-creating-a-two-key-boundary|text-based IDs]] (e.g., `shapeIds` in connectors referencing shapes within [[every-component-must-define-geometry-three-times-because-the-triple-view-architecture-couples-identity-to-representation|triple-view PartViews]]) without DB-level foreign keys — the JSONB boundary means referential integrity is purely application-enforced.

---

Related:
- [[the-schema-insert-pattern-uses-omit-plus-extend-to-create-a-strict-write-contract-while-the-select-type-remains-permissive]] — `.extend()` is the only write-time validation for JSONB columns; `.passthrough()` is the deliberate relaxation point
- [[the-schema-uses-dual-id-systems-serial-for-db-references-and-text-for-client-generated-uuids-creating-a-two-key-boundary]] — JSONB stores text ID references without DB-level referential integrity
- [[every-component-must-define-geometry-three-times-because-the-triple-view-architecture-couples-identity-to-representation]] — the PartViews structure stored in JSONB that defines per-view geometry
- [[drizzle-orm-0-45-is-blocked-by-zod-v4-dependency-so-the-orm-must-be-pinned-until-full-zod-migration]] — Zod v3 pin affects all JSONB validation schemas since they depend on drizzle-zod's `createInsertSchema`
