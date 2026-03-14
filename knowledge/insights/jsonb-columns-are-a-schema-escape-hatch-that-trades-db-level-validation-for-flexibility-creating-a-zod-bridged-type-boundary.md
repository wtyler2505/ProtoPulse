---
summary: 15+ JSONB columns across the schema store structured data without DB-level constraints, relying on Zod insert schemas as the only type boundary between untyped storage and typed code
type: pattern
---

# JSONB columns are a schema escape hatch that trades DB-level validation for flexibility

`shared/schema.ts` uses `jsonb` columns extensively as a structured escape hatch:

**High-structure JSONB (shapes, connectors):** `componentParts.meta`, `.connectors`, `.buses`, `.views`, `.constraints` — these store the full component type system defined in `component-types.ts` (PartMeta, Connector[], Bus[], PartViews, Constraint[]). The types are rich and deeply nested but the DB sees only `jsonb`.

**Configuration JSONB (settings bags):** `circuitDesigns.settings`, `circuitInstances.properties`, `circuitNets.segments/labels/style`, `simulationResults.config/results`, `aiActions.parameters/result`, `arduinoBuildProfiles.boardOptions/portConfig/libOverrides`, `pcbZones.properties`, `bomSnapshots.snapshotData`.

**Lightly typed JSONB:** `architectureNodes.data` — uses a `nodeDataSchema` with `.passthrough().nullable().optional()` (Zod allows any extra keys), `architectureEdges.style` — similarly `.passthrough()`.

The pattern: Drizzle `jsonb()` columns are typed as `unknown` at the DB layer. The insert schemas use `.extend()` with Zod schemas to add runtime validation on write. But on **read**, the Drizzle `$inferSelect` type infers the column as `unknown`, requiring explicit casts (`as PartMeta`, `as Connector[]`) in storage.ts methods.

This creates an asymmetric type boundary:
- **Writes** are validated by Zod — good
- **Reads** are unvalidated casts — a silent corruption vector if the DB data doesn't match the expected shape (e.g., after a schema evolution where new fields are added)

The `nodeDataSchema.passthrough()` pattern is particularly risky: it explicitly allows any key-value pairs beyond the known schema, meaning the column accumulates arbitrary data from AI tool outputs that never gets cleaned up.

**Mitigation used:** The `standard-library.ts` defines its own parallel type system (`SchematicShape`, `Connector`, `PinDef`) rather than importing from `component-types.ts`, specifically to "avoid coupling to Drizzle insert schema which uses jsonb (unknown)" — see line 16. This is a pragmatic workaround but means the standard library's types can drift from the main type system.
