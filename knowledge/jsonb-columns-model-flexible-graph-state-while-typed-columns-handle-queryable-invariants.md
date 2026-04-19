---
description: ProtoPulse stores open-ended graph state (node `data`, edge `style`, design snapshots, SPICE parameters...
type: pattern
source: shared/schema.ts, server/storage/
confidence: supported
topics:
- backend-persistence-patterns
- implementation-patterns
related_components:
- shared/schema.ts
---
# jsonb columns model flexible graph state while typed columns handle queryable invariants

`shared/schema.ts` contains 132 `jsonb()` column references across 46 tables, and they all obey the same rule: if the backend or the DB ever has to filter, join, or index on a field, that field is typed; if the field is payload that the frontend owns end-to-end, it goes into a `jsonb` column. `architectureNodes` is the canonical example — `projectId`, `nodeId`, `nodeType`, `label`, `positionX`, `positionY`, `version`, `deletedAt` are typed scalars with indexes, while `data` is a `jsonb` grab bag with `.passthrough().nullable().optional()` on the Zod side. Queries like "all nodes for this project" stay cheap; node-type-specific content evolves without schema churn.

The pattern scales to the heavy state. `designSnapshots` stores `nodesJson` and `edgesJson` as separate `jsonb` columns because the SVG diff machinery needs the whole graph atomically but never filters inside it. `spiceModels.parameters` defaults to `{}` and holds model-specific knobs. `circuitDesigns`, `circuitInstances`, and `pcbZones` all follow the same split. Trying to normalize these into relational tables would produce dozens of single-purpose tables that the application always reads together anyway — `jsonb` collapses the unnecessary joins without losing durability.

The Zod layer is what keeps `jsonb` from being a type black hole. `.extend({ data: nodeDataSchema })` attaches a structured schema to the column so `InsertArchitectureNode['data']` is not `unknown` — it's an object with known optional fields. `.passthrough()` on that schema accepts additional properties without rejecting the insert, which means the server can hold new frontend fields through a release cycle without a migration. `.nullable().optional()` distinguishes "no data yet" from "empty object." The composition — loose at the database layer, structured at the Zod layer, forgiving at the edges — is what makes jsonb safe here.

The known cost is query-inside-the-blob: filtering `WHERE data->>'componentPartId' = '5'` is a sequential scan unless you add a GIN index. ProtoPulse has exactly one — `arch_nodes_data_gin_idx using gin(data jsonb_path_ops)` — and [[jsonb-columns-lack-gin-indexes-forcing-sequential-scans]] tracks the rest as debt. The pattern doesn't forbid querying inside jsonb; it just requires you to be deliberate about which blobs you query and to add the GIN index when you do.

---

Source: [[2026-04-19-drizzle-orm-schema-patterns-for-protopulse]]

Relevant Notes:
- [[jsonb-columns-lack-gin-indexes-forcing-sequential-scans]] — the cost side; this note is the prescription, that one is the current debt
- [[drizzle-schema-defines-the-column-the-zod-validator-and-the-typescript-type-from-one-source]] — `.passthrough()` is the Zod mechanism that makes `jsonb` forward-compatible
- [[reactflow-json-stringify-sync-is-on-per-render-and-breaks-at-10k-nodes]] — the upstream shape that `jsonb` persists; both halves must stay aligned

Topics:
- [[backend-persistence-patterns]]
- [[implementation-patterns]]
