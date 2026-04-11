# ADR-0010: Unified Parts Catalog (`parts` + `part_stock` + `part_placements`)

**Status:** Accepted
**Date:** 2026-04-11
**Deciders:** Tyler
**Related plan:** [`docs/plans/2026-04-10-parts-catalog-consolidation.md`](../plans/2026-04-10-parts-catalog-consolidation.md)

> Note: ADR 0007 was already claimed by `firmware-runtime-architecture.md`. This ADR takes the next available slot (0010) rather than collide with the earlier number.

## Context

ProtoPulse currently stores what is conceptually *one physical component* across **8 parts-related tables**, **~25 REST endpoints**, **45+ AI tools**, **25+ list-rendering views**, and **at least 12 distinct TypeScript row shapes**.

A single 10 kΩ resistor can simultaneously exist as:

1. A `componentLibrary` row (reusable template)
2. A `componentParts` row (project-scoped editor copy)
3. A `circuitInstances` row with `partId` nullable (physical placement)
4. A `bomItems` row string-matched by `partNumber` (commercial data)
5. A `bomSnapshots` embedded JSONB copy (frozen history)
6. A `spiceModels` row (simulation)
7. A `componentLifecycle` row (obsolescence)
8. A JSON entry in one of ~7 static lookup tables (`starter-circuits.ts`, `alternate-parts.ts` ~1263 LOC, `verified-boards/*.ts`, `standard-library.ts`, `footprint-library.ts`, `pinouts/*`)

**None of these are linked by foreign key.** `bomItems.partNumber` is a free-text string. `circuitInstances.partId` is nullable with `onDelete: 'set null'`. Nothing prevents drift. Updating the datasheet URL in the library doesn't cascade to the project's part, which doesn't cascade to the BOM line, which doesn't cascade to the historical snapshot.

User-facing consequences confirmed by agent survey:

- Same 10 kΩ resistor has **4 different row shapes** across sidebar library, `ProcurementView`, `StorageManagerPanel`, and `BreadboardReconciliationPanel`. Searching for "10k" returns different hits in each.
- `BreadboardQuickIntake` writes directly to `bomItems` with no link back to the library template, so the inventory entry has no connectors, no pinout, no SPICE model.
- `BreadboardReconciliationPanel` matches needed-vs-have by *string-equals* on `partNumber`. Typos silently break the join.
- Inventory health in `StorageManagerPanel` runs against `bomItems` only, so parts owned outside any project are invisible.
- Every importer (camera receipt, barcode, CSV, FZPZ, library drop) has its own dedup logic or none.
- `alternate-parts.ts` knows ~15 equivalent MPNs for "10 kΩ 1/4W" but nothing in the DB can walk that graph at query time.

**The cost of not fixing this compounds**: every new parts-related feature adds a new row type, a new lookup table, a new view, a new AI tool, a new cache key, a new silent drift surface.

## Decision

Replace the scattered model with a single canonical `parts` catalog, a narrow `part_stock` overlay for per-project inventory, and a single `part_placements` table for where-used. Every existing list view becomes a filtered *lens* over the one canonical source. Every importer writes through the same ingress pipeline. Every AI tool reads the same shape.

### Core schema

- **`parts`** — canonical identity + spec (single source of truth). Columns: `id uuid PK, slug, title, description, manufacturer, mpn, canonical_category, package_type, tolerance, esd_sensitive, assembly_category, meta jsonb, connectors jsonb, datasheet_url, manufacturer_url, origin, origin_ref, forked_from_id, author_user_id, is_public, trust_level, version, timestamps, soft-delete`. `UNIQUE(manufacturer, mpn) WHERE mpn IS NOT NULL`. GIN index on `meta` and `connectors`.
- **`part_stock`** — per-project inventory overlay. `(project_id, part_id)` UNIQUE. Replaces the stock/inventory columns on `bomItems` (`quantity_on_hand`, `minimum_stock`, `storage_location`, `unit_price`, `supplier`, `lead_time`, `status`, `notes`).
- **`part_placements`** — where-used table. Replaces `circuit_instances.partId` as the part-join point. `part_id` non-nullable with `ON DELETE RESTRICT` — no orphan placements ever.

### Narrow overlays

- **`part_lifecycle`** — replaces `componentLifecycle`; FK to `parts`.
- **`part_spice_models`** — replaces `spiceModels`; FK to `parts`.
- **`part_alternates`** — materializes `shared/alternate-parts.ts` into the DB as an equivalence graph with `match_score` from the parametric matcher.

### Trust tiers (6, locked)

`manufacturer_verified` > `protopulse_gold` > `verified` > `library` > `community` > `user`. Enum enforced in schema. Coach/audit UI surfaces distinct badges per tier.

### Views

- **`bom_view`** — Postgres view reconstructing the legacy `bom_items` shape from `parts` ⨝ `part_stock`. Kept during phases 2–5 for legacy read compatibility, dropped in Phase 6.

### API surface (new)

```text
GET/POST/PATCH/DELETE /api/parts[/:id]
GET /api/parts/:id/{alternates|placements|lifecycle|spice}
GET/POST/PATCH/DELETE /api/projects/:pid/stock[/:id]
POST /api/parts/ingress                (unified importer for library_copy|fzpz|csv_bom|camera_scan|barcode|manual|ai)
```

### Client data layer

`client/src/lib/parts/` — single `useCatalog(filter)` hook powers every list view as a lens. `PartRow` is THE canonical TypeScript type; all 12 existing shapes collapse to it.

### What stays

- **`shared/footprint-library.ts`** — immutable IPC-7351 spec data. Referenced from `parts.package_type` as a string key.
- **`shared/component-types.ts`** — editor type system (shape/connector/bus types), not a parts lookup.

### What gets deleted in Phase 6

- Legacy tables: `componentLibrary`, `componentParts`, `bomItems`, `componentLifecycle`, `spiceModels` (dropped after parity verified).
- Legacy routes: `/api/bom/*` and `/api/components/*` — hard-removed, no 301 shims, no compat layer.
- Static lookup source files: `standard-library.ts`, `verified-boards/*.ts`, `starter-circuits.ts` (~1035 LOC), `alternate-parts.ts` (~1263 LOC), `pinouts/*`. The DB becomes the sole authority; future edits are migrations.

## Alternatives Considered

1. **Status quo with tighter discipline** — rejected. Every new parts feature already pays the consolidation tax. Tyler explicitly rejected deferring — "we never do shit the fast way unless it's the best way."
2. **Keep separate tables but add FKs** — rejected. Doesn't eliminate the 12 TypeScript shapes, doesn't unify importers, doesn't unblock the payoff features (global search, one-click substitute, cross-project usage report). Adds migration pain without solving the root problem.
3. **NoSQL document store for parts** — rejected. We already run PostgreSQL + Drizzle across 36 tables; introducing a second datastore for one domain is scope creep and adds a new consistency boundary. JSONB on `parts.meta` gives us document-store flexibility within the relational model.
4. **Partial consolidation (only merge `componentLibrary` + `componentParts`)** — rejected. Leaves `bomItems` drift, string-match joins, and duplicate importers untouched. All of the user-visible pain comes from BOM disconnection.

## Consequences

### Positive

- **One canonical shape** — `PartRow` everywhere. 12 row shapes collapse to 1.
- **FK enforcement** — zero string-match joins. Zero orphan circuit instances possible.
- **Single ingress pipeline** — 9 importer code paths collapse to 1. Dedup logic lives in one place.
- **Unblocks 7+ payoff features** that were previously blocked by data model drift: global part search (`Ctrl+K`), one-click substitute, supply chain watcher, BOM templates, shared personal inventory (project-null stock rows), cross-project usage report, AI context enrichment.
- **Net table count drops**: 36 → ~32 tables. Net LOC: ~+500 (+3000 added, -2500 deleted).
- **AI tools consolidate**: 45+ → ~25 (the new canonical tools replace the legacy ones entirely in Phase 6).

### Negative

- **2-3 weeks of focused work** with a feature freeze on parts/BOM/inventory.
- **Destructive Phase 6** — legacy tables and route prefixes are hard-removed. Explicit user approval required before running the drop migrations. `backups/pre-parts-consolidation-*.sql` is the rollback.
- **Lens refactors touch 25+ views** — every list-rendering component in the parts domain changes. Browser verification via Chrome DevTools MCP is mandatory before cutover.
- **Temporary dual-write overhead** in Phases 2–5. Every importer writes to BOTH the legacy table AND the new canonical tables during the transition.

### Mitigated

- **Data loss risk**: Full `pg_dump` in Phase 0; idempotent backfill; reconciliation script with zero-drift gate before cutover.
- **Semantic drift between `bom_items` and `part_stock`**: `bom_view` keeps the legacy read shape working via a Postgres view; the reconciliation script runs after every backfill and fails the phase gate on any mismatch.
- **Performance regression from joins**: every join path has an index; `EXPLAIN ANALYZE` before cutover; caching preserved in `PartsStorage`.
- **Component editor regressions**: `componentParts.connectors` + `.buses` + `.views` JSONB fields preserved verbatim on `parts.meta` + `parts.connectors`; round-trip test covers every field.
- **Collaboration CRDT drift**: `part_placements` uses UUIDs but legacy integer ids preserved as a bridge column during the transition.

## Go/no-go checkpoints

- **Phase 2 → 3**: Dual-write is 100% reliable in dev. Ingress failures < 0.1% in fixture data.
- **Phase 3 → 4**: Every new read path returns identical data to the legacy path (byte-for-byte `JSON.stringify` comparison) for every seeded fixture.
- **Phase 4 → 5**: Reconciliation script reports 0 drift rows on dev AND on a restored prod snapshot.
- **Phase 5 → 6**: Browser verification passes every lens; console-error delta = 0; `npm test` green; `npm run check` exit 0; user manually signs off on the cutover.
- **Phase 6 → 7**: Contract tests from Phase 0 still green (proving the lens/view shims work); no user reports of missing data.

## Rollback

- **Phases 1–4**: Drop new tables; remove new code paths. Legacy untouched.
- **Phase 5**: Flip `PARTS_CATALOG_V2=false`. All lenses fall back to legacy paths; code coexists in the same commit.
- **Phase 6**: **Point of no return.** Restore from `backups/pre-parts-consolidation-*.sql` and re-run Phases 1–5. Explicit Tyler approval required before Phase 6 runs.
