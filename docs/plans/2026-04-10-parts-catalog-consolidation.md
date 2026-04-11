# ProtoPulse Unified Parts Catalog — The Ultraplan

> **Ars Contexta note**: this file supersedes the previous Breadboard verification plan on the same filename. The Breadboard verification work is done; this plan is an entirely new task.

---

## Context — why are we doing this?

Today, ProtoPulse has **8 parts-related tables**, **~25 REST endpoints**, **45+ AI tools**, **25+ list-rendering views**, and at least **12 distinct TypeScript row shapes** for what is conceptually the same thing: *"a physical electronic component that exists, can be bought, can be placed, can be owned, can be tracked, can be simulated, can be exported to a fab."*

A single 10 kΩ resistor can simultaneously exist in the database as:

1. A `componentLibrary` row — reusable template, globally searchable, tagged, public-or-not.
2. A `componentParts` row — project-scoped copy made when the user drags from the library.
3. A `circuitInstances` row (FK partId *nullable* → componentParts) — the physical placement on schematic/breadboard/PCB/bench surface.
4. A `bomItems` row — string-matched by `partNumber`, carries commercial data (price, supplier, MPN, stock, reorder level, ESD flag, storage location).
5. A `bomSnapshots` embedded JSONB copy of #4 — historical record frozen in time.
6. A `spiceModels` row — simulation model text, FK to `componentParts`.
7. A `componentLifecycle` row — obsolescence/replacement tracking, FK to `componentParts`.
8. A JSON entry inside one of: `starter-circuits.ts`, `alternate-parts.ts` (~1,263 LOC), `verified-boards/*.ts` (10 board profiles), `standard-library.ts` (100 components), or `footprint-library.ts`.
9. A client-side cached copy behind each of ~7 distinct React Query keys, each with its own invalidation rules.

**None of these are linked by foreign key.** `bomItems.partNumber` is a free-text string. `circuitInstances.partId` is nullable with `onDelete: 'set null'`. Nothing prevents them from drifting. Updating the datasheet URL in the library doesn't cascade to the project's part, which doesn't cascade to the BOM line, which doesn't cascade to the historical snapshot.

**User-facing consequences** (all confirmed by the parts-survey agents):

- Same 10 kΩ resistor has 4 different row shapes across the sidebar library, `ProcurementView`, `StorageManagerPanel`, and `BreadboardReconciliationPanel`. Searching for "10k" returns different hit sets in each.
- `BreadboardQuickIntake` writes directly to `bomItems` — no link back to the library template, so the inventory entry has no connectors, no pinout, no SPICE model.
- `BreadboardReconciliationPanel` matches needed-vs-have by *string-equals* on `partNumber`. A typo or different manufacturer form ("0.25W" vs "1/4W") breaks the join silently.
- Inventory health in `StorageManagerPanel` runs against `bomItems` only, so parts owned outside any project (bin stock) are invisible unless added to a project BOM first.
- Camera receipt import → new `bomItems` rows. Barcode scan → new `bomItems` rows. CSV import → new `bomItems` rows. None of them de-duplicate across projects because dedup logic lives in each importer, each implemented differently.
- `alternate-parts.ts` knows "10 kΩ 1/4W" has ~15 equivalent MPNs but nothing in the DB can walk that graph at query time — it's a static lookup table.

**The cost of *not* fixing this** is compounding: every new parts-related feature adds a new row type, a new lookup table, a new view, a new AI tool, a new hook, a new cache key, and a new silent drift surface. We are about to build Wave 2 of the Inventory Lab (dead stock detection, low-stock alerts, supplier pricing panel refresh, alternate-parts UI) — every one of those features pays the consolidation tax twice if we don't fix the foundation first.

**The goal of this ultraplan**: Replace the scattered model with a single canonical `parts` catalog, a narrow `part_stock` overlay for per-project inventory, and a single `part_placements` table for where-used. Every existing list view becomes a filtered *lens* over the one canonical source. Every importer writes through the same ingress. Every AI tool reads the same shape.

### User-confirmed execution constraints (locked)

- **Feature freeze on parts/BOM/inventory**: no new parts-domain features start until this consolidation ships. This frees the full 2-3 weeks for clean, focused work and avoids paying the consolidation tax twice on in-flight features.
- **Six trust tiers**: `manufacturer_verified` > `protopulse_gold` > `verified` > `library` > `community` > `user`. Schema + audit system + coach overlay will surface distinct badges per tier.
- **Static lookup tables get deleted after seeding**: `alternate-parts.ts` (~1263 LOC), `starter-circuits.ts` (~1035 LOC), `verified-boards/*`, and `standard-library.ts` are one-shot migrated into the DB (`parts` + `part_alternates`) in Phase 4 and their source files deleted in Phase 6. The DB becomes the sole authority; any future edit is a migration.
- **Legacy routes deleted in Phase 6**: `/api/bom/*` and `/api/components/*` are hard-removed in the same phase as the schema drop. No 301 redirects, no compat shims — you're the only consumer and the test suite covers everything.

**What "done" looks like**:

- One Drizzle table per concept: `parts` (identity + spec), `part_stock` (per-project inventory), `part_placements` (where-used; replaces/augments `circuitInstances` for the parts join).
- Every existing table that holds part data either becomes a view, is reduced to a narrow overlay that only stores its unique columns, or is dropped outright with a migration.
- One `PartRow` TypeScript type used by every server route, every client component, every AI tool, every exporter.
- One `usePartsCatalog(filter)` hook that powers every list view as a filtered lens.
- Zero string-match joins; every FK enforced.
- Zero regressions in existing features (Breadboard Lab, Procurement, Storage, Validation, Exports). Every test still passes.
- Full browser verification via Chrome DevTools MCP proves each lens renders the same canonical rows.

---

## Current state — forensic diagnosis

### The 3 parallel part representations

| Table | Scope | What it stores | Links |
|---|---|---|---|
| `component_library` (`shared/schema.ts:276-300`) | Global reusable templates | title, description, meta (JSONB), connectors, buses, views, constraints, tags, category, isPublic, authorId, forkedFromId, downloadCount | none — free-standing |
| `component_parts` (`shared/schema.ts:253-274`) | Project-scoped editor copy | projectId (FK), nodeId, meta, connectors, buses, views, constraints, version | cascade-delete on project |
| `bom_items` (`shared/schema.ts:114-149`) | Project-scoped commercial data | partNumber (text, not FK!), manufacturer, description, quantity, unitPrice, supplier, stock, status, leadTime, datasheetUrl, manufacturerUrl, storageLocation, quantityOnHand, minimumStock, esdSensitive, assemblyCategory, tolerance | string-match only |

**The drift surface**:

- `componentLibrary.meta` ⋂ `componentParts.meta` ⋂ `bomItems` fields = `title`, `description`, `manufacturer/partNumber`, `datasheet`, `category` — stored in three different column locations with three different validation paths.
- `componentLibrary` has NO partNumber. `componentParts` has NO partNumber. `bomItems` has NO connectors/pinout/footprint.
- When the user drags from the library onto a schematic, `importFromLibrary(libraryId, projectId)` copies the template to `componentParts` — but doesn't set any BOM line. When they later build a BOM, a `bomItems` row is created by string — and now the same part exists as 3 disconnected rows.

### The 8 supporting tables

Beyond the core trio:

- `circuit_instances` (`shared/schema.ts:344-372`) — `partId` FK → `componentParts` but **nullable** with `onDelete: 'set null'`. POST `/api/circuits/:id/instances` allows `partId: null` and derives ref-des from `properties.componentTitle` — two code paths for the same concept.
- `component_lifecycle` (`shared/schema.ts:564-584`) — FK → `componentParts` only; no lifecycle tracking for library templates or BOM-only parts.
- `spice_models` (`shared/schema.ts:529-558`) — FK → `componentParts` only; same gap.
- `bom_snapshots` (`shared/schema.ts:511-523`) — stores `data: z.array(insertBomItemSchema)` as JSONB; no versioning; frozen schema clone becomes brittle when BOM shape evolves.
- `pcb_zones` (`shared/schema.ts:678-704`) — layout regions, not part data, but references `circuit_instances` by id.

### The 12+ client row shapes (duplication)

| Shape | Defined in | Used by |
|---|---|---|
| `BomItem` (client) | `client/src/lib/project-context.tsx:49-66` | Procurement, Storage, Breadboard intake/reconciliation |
| `BomItem` (server, from Drizzle) | `shared/schema.ts:148` | server routes, storage, exporters |
| `ComponentPart` | `shared/schema.ts:274` | component editor, server DRC |
| `ComponentLibraryEntry` | `shared/schema.ts:300` | library browse, AI search |
| `LibraryComponent` (UI wrapper) | Sidebar `ComponentTree` | sidebar navigation |
| `VerifiedBoardPart` | `shared/verified-boards/to-part-state.ts` | breadboard board pack |
| `StarterComponent` | `shared/starter-circuits.ts` (~1035 LOC) | starter panel |
| `SnippetPart` | `client/src/lib/snippet-library.ts` | design reuse blocks |
| `AlternatePart` | `shared/alternate-parts.ts` (~1263 LOC) | alternate-parts lookup |
| `SupplierPart` | `shared/supplier-api.ts` | pricing panel |
| `InventoryItem` | `client/src/lib/inventory-health.ts` | health analyzer (separate from `BomItem`!) |
| `CircuitInstanceRow` | `shared/schema.ts:372` | canvas placement |

**12 distinct shapes, same conceptual thing.**

### The 7+ React Query keys

- `['/api/projects', projectId, 'bom']`
- `['/api/components', projectId]`
- `['/api/component-library']`
- `['/api/spice-models']`
- `['/api/component-lifecycle', projectId, componentId]`
- `['/api/bom-snapshots', projectId]`
- `['/api/circuits', circuitId, 'instances']`

Each has its own invalidation logic. Mutation in one doesn't invalidate the others. Drift is silent.

### The duplicate importers

- `BreadboardQuickIntake` → POST `/api/bom/:projectId`
- Camera receipt import → POST `/api/bom/:projectId/import-receipt`
- Barcode scanner in `StorageManagerPanel` → POST `/api/bom/:projectId`
- CSV BOM import (ProcurementView) → POST `/api/bom/:projectId/import-csv`
- Fritzing `.fzpz` import → POST `/api/components/import` (writes `componentParts`, **not** BOM)
- SVG footprint import → POST `/api/components/import-svg` (writes `componentParts` meta)
- Library browse + drop → POST `/api/component-library/:id/import`
- AI tool `create_component` → server calls storage directly
- AI tool `add_bom_item` → server calls storage directly
- AI tool `bulk_import` → writes `componentParts` only

Every one of these has its own dedup logic (or none). Every one writes a different subset of columns. None of them share an ingress.

### The scattered static lookup tables

- `shared/starter-circuits.ts` (~1035 LOC) — hard-coded parts used in starter circuits
- `shared/alternate-parts.ts` (~1263 LOC) — equivalence database
- `shared/verified-boards/*.ts` (10 board profiles)
- `shared/standard-library.ts` (100 components auto-seeded)
- `shared/footprint-library.ts` (27 IPC-7351 packages)
- `shared/pinouts/*` — 13 built-in pinouts
- `shared/component-types.ts` (494 LOC) — component editor type system

Seven orthogonal lookup tables, each independently maintained, each with its own shape, each rediscovered by AI tools through different paths. Zero chance of internal consistency without a single source of truth.

---

## Target architecture — one catalog to rule them all

### Core tables (new)

```text
parts                         -- canonical identity + spec (single source of truth)
  id                  uuid PK
  slug                text UNIQUE              -- human-readable stable ID, e.g. "res-10k-0402-1pct"
  title               text NOT NULL
  description         text
  manufacturer        text
  mpn                 text                     -- manufacturer part number (canonical)
  canonical_category  text NOT NULL            -- resistor, capacitor, mcu, sensor, connector, etc.
  package_type        text                     -- 0402, TO-220, SOIC-14, etc. (links to footprint_library via key)
  tolerance           text
  esd_sensitive       boolean                  -- matches bomItems current behavior
  assembly_category   text                     -- smt | through_hole | hand_solder | mechanical
  meta                jsonb                    -- free-form EDA metadata (connectors/buses/views/constraints)
  connectors          jsonb                    -- lifted out of meta for GIN index
  datasheet_url       text
  manufacturer_url    text
  origin              text NOT NULL            -- 'library' | 'user' | 'community' | 'verified_board' | 'starter_circuit' | 'scan' | 'ai_generated'
  origin_ref          text                     -- nullable key back to the origin table (e.g. 'verified-boards/esp32-wroom-32')
  forked_from_id      uuid REFERENCES parts(id) ON DELETE SET NULL
  author_user_id      integer REFERENCES users(id) ON DELETE SET NULL
  is_public           boolean NOT NULL DEFAULT false
  trust_level         text NOT NULL DEFAULT 'user'   -- 'manufacturer_verified' | 'protopulse_gold' | 'verified' | 'library' | 'community' | 'user'
  version             integer NOT NULL DEFAULT 1
  created_at          timestamp NOT NULL DEFAULT now()
  updated_at          timestamp NOT NULL DEFAULT now()
  deleted_at          timestamp                -- soft delete

  UNIQUE (manufacturer, mpn) WHERE mpn IS NOT NULL
  INDEX (canonical_category)
  INDEX (slug)
  INDEX (trust_level)
  GIN    (meta jsonb_path_ops)
  GIN    (connectors jsonb_path_ops)

part_stock                    -- per-project inventory overlay (replaces the stock/inventory columns on bomItems)
  id                  uuid PK
  project_id          integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE
  part_id             uuid NOT NULL REFERENCES parts(id) ON DELETE CASCADE
  quantity_needed     integer NOT NULL DEFAULT 0    -- what the BOM demands (was: bomItems.quantity)
  quantity_on_hand    integer                        -- what's in the bin
  minimum_stock       integer                        -- reorder threshold
  storage_location    text                           -- Bin A3
  unit_price          numeric(10,4)                  -- latest known price
  supplier            text
  lead_time           text
  status              text NOT NULL DEFAULT 'In Stock'
  notes               text
  version             integer NOT NULL DEFAULT 1
  updated_at          timestamp NOT NULL DEFAULT now()
  deleted_at          timestamp

  UNIQUE (project_id, part_id)                       -- one stock row per part per project
  INDEX  (project_id)
  INDEX  (project_id, deleted_at)
  INDEX  (part_id)

part_placements               -- where-used table (replaces circuit_instances.partId as the part-join point)
  id                  uuid PK
  part_id             uuid NOT NULL REFERENCES parts(id) ON DELETE RESTRICT  -- no more orphan instances
  surface             text NOT NULL                  -- 'schematic' | 'breadboard' | 'bench' | 'pcb' | 'snippet' | 'starter'
  container_type      text NOT NULL                  -- 'circuit' | 'snippet_library' | 'starter_circuit'
  container_id        integer NOT NULL               -- FK to circuit_designs, snippet_library, or starter_circuit
  reference_designator text NOT NULL
  x                   real
  y                   real
  rotation            real NOT NULL DEFAULT 0
  layer               text                           -- 'front' | 'back' | 'bench'
  properties          jsonb NOT NULL DEFAULT '{}'    -- surface-specific overrides
  created_at          timestamp NOT NULL DEFAULT now()
  deleted_at          timestamp

  INDEX (part_id)
  INDEX (container_type, container_id)
  INDEX (surface)
  GIN   (properties jsonb_path_ops)
```

### Narrow overlays (retained as satellites, all FK to `parts`)

```text
part_lifecycle                -- replaces componentLifecycle
  id            uuid PK
  part_id       uuid NOT NULL REFERENCES parts(id) ON DELETE CASCADE
  obsolete_date timestamp
  replacement_part_id uuid REFERENCES parts(id) ON DELETE SET NULL
  notes         text
  created_at    timestamp

part_spice_models             -- replaces spiceModels
  id            uuid PK
  part_id       uuid NOT NULL REFERENCES parts(id) ON DELETE CASCADE
  filename      text NOT NULL
  model_text    text NOT NULL
  category      text

part_alternates               -- materialises shared/alternate-parts.ts into the DB
  id            uuid PK
  part_id       uuid NOT NULL REFERENCES parts(id) ON DELETE CASCADE
  alt_part_id   uuid NOT NULL REFERENCES parts(id) ON DELETE CASCADE
  match_score   real NOT NULL                        -- 0..1 from parametric matcher
  UNIQUE (part_id, alt_part_id)
```

### Views (reads only — no storage)

`bom_view` — a Postgres view that reconstructs the legacy `bom_items` shape by joining `parts` + `part_stock` + `part_placements`. This lets existing code keep compiling while the refactor is in progress.

```sql
CREATE VIEW bom_view AS
SELECT
  s.id                                      AS id,
  s.project_id,
  p.mpn                                     AS part_number,
  p.manufacturer,
  p.description,
  s.quantity_needed                         AS quantity,
  s.unit_price,
  (s.quantity_needed * s.unit_price)::numeric(10,4) AS total_price,
  s.supplier,
  s.quantity_on_hand,
  s.minimum_stock,
  s.status,
  s.lead_time,
  p.datasheet_url,
  p.manufacturer_url,
  s.storage_location,
  p.esd_sensitive,
  p.assembly_category,
  p.tolerance,
  s.version,
  s.updated_at,
  s.deleted_at
FROM part_stock s
JOIN parts p ON p.id = s.part_id
WHERE s.deleted_at IS NULL;
```

### Deprecations (dropped after migration cutover)

- `component_library` → merged into `parts` (rows with `origin='library'`, `is_public=true`)
- `component_parts` → merged into `parts` (rows with `origin='user'`, forked from library where applicable)
- `bom_items` → decomposed into `parts` + `part_stock` (identity/spec vs per-project overlay)
- `circuit_instances.partId` → replaced by `part_placements.part_id`, now non-nullable
- `component_lifecycle` → `part_lifecycle`
- `spice_models` → `part_spice_models`
- `bom_snapshots` → kept but `data` column now stores JSONB array of `part_stock` rows instead of `bom_items`

### Static lookup tables → seed rows (then the source files are deleted)

Phase 4 migrates all these hard-coded TypeScript data files into the database; Phase 6 **deletes the source files** entirely. The DB becomes the single authority, and future edits are database migrations rather than code commits.

- `shared/standard-library.ts` (100 components) → seeded into `parts` with `origin='library'`, `trust_level='library'` — **file deleted in Phase 6**
- `shared/verified-boards/*.ts` (10 board profiles) → seeded into `parts` with `origin='verified_board'`, `trust_level='verified'`, `origin_ref='verified-boards/<slug>'` — **files deleted in Phase 6**
- `shared/starter-circuits.ts` (~1035 LOC of hard-coded starter parts) → each starter's parts seeded into `parts` with `origin='starter_circuit'`; starter-circuit *recipes* (the wiring layout) move to a new `starter_circuits` table — **file deleted in Phase 6**
- `shared/alternate-parts.ts` (~1263 LOC equivalence database) → populated into `part_alternates` (bidirectional rows) — **file deleted in Phase 6**
- `shared/footprint-library.ts` (27 IPC-7351 packages) → **stays in code** as a value table; footprints are pure immutable spec data (IPC-standardized), not user data. Referenced by `parts.package_type` as a string key.
- `shared/pinouts/*` (13 built-in pinouts) → each pinout gets embedded into the matching seed row's `meta.pinout` JSONB; the `shared/pinouts/` directory is **deleted in Phase 6** once every row has its embedded copy.
- `shared/component-types.ts` (494 LOC) → **stays**; defines the editor type system (shape types, connector types, bus types), not a lookup of parts.

### API surface (new)

```text
GET    /api/parts                 list/search canonical parts with filters
GET    /api/parts/:id             single canonical part
POST   /api/parts                 create (writes via ingress pipeline)
PATCH  /api/parts/:id             update (version-checked with ETag)
DELETE /api/parts/:id             soft-delete

GET    /api/parts/:id/alternates  list equivalent parts
GET    /api/parts/:id/placements  where this part is used
GET    /api/parts/:id/lifecycle   obsolescence record
GET    /api/parts/:id/spice       SPICE model

GET    /api/projects/:pid/stock   per-project stock overlay (replaces /api/bom)
POST   /api/projects/:pid/stock   upsert stock row for part_id
PATCH  /api/projects/:pid/stock/:id  update quantities
DELETE /api/projects/:pid/stock/:id  remove stock row (part unaffected)

POST   /api/parts/ingress         **single importer endpoint** — receives any of:
                                   { source: 'library_copy', library_part_id, project_id }
                                   { source: 'fzpz', blob }
                                   { source: 'csv_bom', csv_text, project_id }
                                   { source: 'camera_scan', image_b64, project_id }
                                   { source: 'barcode', code, project_id }
                                   { source: 'manual', fields }
                                   { source: 'ai', fields }
                                  Returns: { part_id, stock_id?, created, reused }
```

### Client data layer (new)

```text
client/src/lib/parts/
  ├── parts-catalog-context.tsx   -- React provider exposing useCatalog() hooks
  ├── use-parts-catalog.ts        -- useCatalog(filter) — primary hook (lens)
  ├── use-part.ts                 -- usePart(id) — single-part hook
  ├── use-part-stock.ts           -- usePartStock(projectId, partId) — per-project stock
  ├── use-part-alternates.ts      -- equivalence graph reads
  ├── use-part-placements.ts      -- where-used queries
  ├── use-part-ingress.ts         -- unified ingress mutation
  ├── part-row.ts                 -- **the** canonical TypeScript `PartRow` type
  ├── part-filter.ts              -- shared filter/sort/search types
  └── __tests__/
        └── ...                   -- hook unit tests
```

Every existing list view (Procurement, Storage, Breadboard reconciliation, sidebar ComponentTree, community, starter circuits, design patterns, alternates panel, AI review) is refactored to be a **filtered lens** that calls `useCatalog(filter)` and maps over `PartRow[]`.

---

## Phased implementation plan

> This is a **7-phase, ~3-week** effort. Each phase is independently commit-able, independently tested, and leaves the app in a working state. Phases 1–4 are additive (parallel tables); phase 5 is the cutover; phase 6 is cleanup; phase 7 is the UX payoff.

### Phase 0 — Foundation prep (1 day)

**Goal**: Safety nets in place before we touch schema.

**Tasks**:

1. Create a full DB dump of the current state:
   ```bash
   pg_dump $DATABASE_URL > backups/pre-parts-consolidation-$(date +%Y%m%d).sql
   ```
   Commit the backup to a `backups/` path excluded from `.gitignore` only for this ref.
2. Branch: `git checkout -b parts-consolidation`.
3. Add a feature flag `PARTS_CATALOG_V2` in `.env.example` and `server/config.ts`. All new read paths check the flag; legacy paths remain default until phase 5.
4. Create `docs/plans/2026-04-10-parts-catalog-consolidation.md` that mirrors this plan (ADR-linked).
5. Add `docs/adr/0007-unified-parts-catalog.md` with the architectural decision record.
6. Snapshot the existing `/api/bom`, `/api/components`, `/api/component-library` contract tests as golden files in `server/__tests__/contract/` — we'll re-run these after cutover to prove no consumer visible regression.
7. Create a new `knowledge/parts-catalog-consolidation.md` Ars Contexta note linked to `[[dev-infrastructure]]` and `[[gaps-and-opportunities]]`.

**Exit criteria**: branch exists, backups exist, feature flag defaults off, contract tests green.

### Phase 1 — Schema & migrations (2 days)

**Goal**: New tables exist in dev DB alongside the old ones. No data touched yet.

**Critical files**:

- `shared/schema.ts` — append new tables: `parts`, `partStock`, `partPlacements`, `partLifecycle`, `partSpiceModels`, `partAlternates`. Include Zod insert schemas and TypeScript types.
- `shared/parts/` (new directory):
  - `part-row.ts` — canonical `PartRow` type unifying all 12 current shapes
  - `part-filter.ts` — `PartFilter` type with category, trust_level, project_id, text, tags, origin
  - `part-slug.ts` — deterministic slug generator (`"res-10k-0402-1pct"` from fields)
- `shared/__tests__/parts-schema.test.ts` — schema validation tests
- Drizzle migration: run `npm run db:push` to apply the new tables. Confirm indexes on the GIN/BTREE combinations are created.
- `server/storage/parts.ts` (new) — skeleton `PartsStorage` class with stub methods; fully implemented in Phase 3.

**Tests**:

- 50+ unit tests in `shared/__tests__/parts-schema.test.ts` covering Zod round-trips, slug determinism, filter composition.
- `npm run check` must pass.

**Commit**: `feat(parts): phase 1 — canonical parts schema (additive, flag-gated)`.

### Phase 2 — Dual-write ingress (3 days)

**Goal**: Every current importer ALSO writes a `parts` row + `part_stock` row alongside the legacy row, behind the flag. Legacy remains the source of truth; new tables are shadow data.

**Critical files**:

- `server/parts-ingress.ts` (new) — the ingress pipeline:
  ```ts
  ingressPart({ source, projectId, fields }): Promise<PartIngressResult>
  ```
  with branches for each source type. Deduplicates by `(manufacturer, mpn)` first, then by slug, then creates new.
- `server/routes/parts.ts` (new) — POST `/api/parts/ingress` endpoint
- Hook every existing importer to ALSO call `ingressPart()`:
  - `server/routes/bom.ts` POST → also ingress
  - `server/routes/components.ts` POST → also ingress
  - `server/routes/components.ts` import-fzpz → also ingress
  - `server/routes/components.ts` import-svg → also ingress
  - `server/circuit-routes/instances.ts` POST → also ingress (when `partId` not null)
  - `server/ai-tools/bom.ts` `add_bom_item` → also ingress
  - `server/ai-tools/component.ts` `create_component` → also ingress
  - `client/src/components/circuit-editor/BreadboardQuickIntake.tsx` → keeps writing to `bomItems`, but `bomItems` server route now mirrors to `parts`
- Mirror writes are **best effort** — if ingress fails, legacy still succeeds but an audit-log row is written to a new `parts_ingress_failures` table. This lets phase 4 backfill.
- `server/__tests__/parts-ingress.test.ts` — 40+ tests across all 9 importer paths, covering dedup correctness, failure isolation, and mirror consistency.

**Tests**:

- Contract tests from phase 0 still pass (legacy behavior unchanged).
- 40+ new ingress tests.
- Manual smoke: start dev server, hit each importer via API, verify both legacy row AND mirror row exist.

**Commit**: `feat(parts): phase 2 — dual-write ingress shadowing legacy tables`.

### Phase 3 — Server-side read consolidation (3 days)

**Goal**: Every read endpoint can now return canonical `PartRow` shape via the new tables. Legacy endpoints unchanged for compat.

**Critical files**:

- `server/storage/parts.ts` (fully implement):
  - `search(filter: PartFilter, pagination): Promise<PartRow[]>`
  - `getById(id): Promise<PartRow | null>`
  - `getBySlug(slug): Promise<PartRow | null>`
  - `getByMpn(manufacturer, mpn): Promise<PartRow | null>`
  - `listForProject(projectId): Promise<PartRow[]>` — joins parts ⨝ part_stock ⨝ placements
  - `getAlternates(partId): Promise<PartRow[]>`
  - `getPlacements(partId): Promise<PartPlacement[]>`
  - `getLifecycle(partId)`, `getSpiceModel(partId)`
- `server/routes/parts.ts`:
  - `GET /api/parts` — paginated search
  - `GET /api/parts/:id`
  - `GET /api/parts/:id/alternates`
  - `GET /api/parts/:id/placements`
  - `GET /api/parts/:id/lifecycle`
  - `GET /api/parts/:id/spice`
  - `GET /api/projects/:pid/stock`
  - `PATCH /api/projects/:pid/stock/:id`
- `server/ai-tools/parts.ts` (new) — 8 AI tools that read the canonical shape:
  - `search_parts(filter)`, `get_part(id)`, `get_alternates(id)`, `check_stock(project_id, filter)`, `suggest_substitute(part_id)`, `lookup_datasheet_for_part(id)`, `compare_parts([ids])`, `recommend_part_for(context)`
  - These run alongside the existing 45+ AI tools and eventually replace the legacy ones in phase 6.
- `server/export/bom-exporter.ts`, `server/export/pick-place-generator.ts`, `server/export/netlist-generator.ts` — add flag-gated v2 code paths that read from `parts` instead of `componentParts`.
- `shared/bom-diff.ts` — add a v2 diff function that works on `PartStock[]` instead of `BomItem[]`.

**Tests**:

- 60+ new tests in `server/__tests__/parts-routes.test.ts`
- 30+ new tests in `server/__tests__/parts-ai-tools.test.ts`
- 10+ new exporter tests covering flag-gated paths

**Commit**: `feat(parts): phase 3 — canonical read path (parts routes, AI tools, exporters)`.

### Phase 4 — Backfill + reconciliation script (2 days)

**Goal**: Migrate all existing data into the new tables. Verify zero drift.

**Critical files**:

- `scripts/migrations/backfill-parts-catalog.ts` (new) — idempotent one-shot:
  1. For each `componentLibrary` row → create `parts` row with `origin='library'`, `is_public=isPublic`, `trust_level='library'`. Store the old id in `origin_ref` as `library:<id>`.
  2. For each `componentParts` row → create `parts` row with `origin='user'`, `forked_from_id` if the old row traces back to a library entry (via fuzzy match on `title`+`category` for legacy rows that pre-date any forking metadata). Store `origin_ref` as `legacy_component_parts:<id>`.
  3. For each `bomItems` row → upsert `parts` by `(manufacturer, mpn)`. If not found, create new with `origin='user'`, `trust_level='user'`. Then create `part_stock` row for `(project_id, part_id)` with all inventory columns.
  4. For each `circuitInstances.partId`-non-null → create `part_placements` row with `surface='schematic'|'breadboard'|'pcb'` rows, one per non-null position. For null `partId` rows — fuzzy-match by `properties.componentTitle` against `parts.title`; if no match, create a stub `parts` row with `origin='user'` and link the placement.
  5. For each `componentLifecycle` → `part_lifecycle` row.
  6. For each `spiceModels` → `part_spice_models` row.
  7. For each `alternate-parts.ts` equivalence entry → `part_alternates` rows (bidirectional).
  8. Seed `shared/verified-boards/*` into `parts` if not present.
  9. Seed `shared/standard-library.ts` parts if not present.
  10. Seed `shared/starter-circuits.ts` parts if not present.
- `scripts/migrations/reconcile-parts-drift.ts` (new) — diffs legacy vs canonical:
  - For every `bomItems` row, check that a corresponding `parts` + `part_stock` row exists with the same fields. Report mismatches.
  - For every `componentParts` row, check that a `parts` row exists. Report mismatches.
  - For every `circuitInstances`, check that a `part_placements` row exists.
  - Write a report to `reports/parts-drift-$(date).md`.
- `scripts/migrations/create-bom-view.sql` (new) — creates the `bom_view` Postgres view defined above.
- `server/__tests__/parts-backfill.test.ts` — seeds the legacy tables with known fixtures, runs backfill, asserts canonical rows match.

**Tasks**:

1. Run `npm run db:push` against a clean dev DB.
2. Seed with the existing `POST /api/seed` endpoint to populate legacy tables.
3. Run `tsx scripts/migrations/backfill-parts-catalog.ts`.
4. Run `tsx scripts/migrations/reconcile-parts-drift.ts`. Expect: zero drift rows.
5. Apply `scripts/migrations/create-bom-view.sql`.
6. Sanity-check: `SELECT count(*) FROM parts;` > 100 (from standard library seeds alone).

**Commit**: `feat(parts): phase 4 — backfill migration + reconciliation`.

### Phase 5 — Cutover: client lenses + legacy shims (4 days)

**Goal**: Flip the feature flag. Legacy tables become write-only for dual-write consistency; reads come exclusively from canonical `parts`.

**Critical files**:

- `client/src/lib/parts/parts-catalog-context.tsx` (new) — React context with `PartsCatalogProvider` wrapping `TooltipProvider` in `App.tsx`.
- `client/src/lib/parts/use-parts-catalog.ts` (new) — `useCatalog(filter)` hook, single source of truth.
- `client/src/lib/parts/use-part-stock.ts` — per-project stock overlay hook.
- `client/src/lib/parts/use-part-ingress.ts` — unified ingress mutation hook.
- `client/src/lib/project-context.tsx` — the `addBomItem`/`updateBomItem`/`deleteBomItem` methods now delegate to `usePartIngress` + `usePartStock` under the hood. Signature stays the same for backward compat; implementation flips.
- **Lens refactors** (each a separate commit inside the phase):
  - `client/src/components/views/ProcurementView.tsx` and its 15 sub-components in `procurement/*` → use `useCatalog({ project_id, has_stock: true })` and map canonical `PartRow` + `PartStock` into the existing grid. The existing column definitions work because the canonical row has a superset of fields.
  - `client/src/components/views/StorageManagerPanel.tsx` → use `useCatalog({ project_id, has_stock: true })` + `usePartStock`. The inventory health analyzer keeps working because its `InventoryItem` type is a subset of `PartRow`.
  - `client/src/components/circuit-editor/BreadboardWorkbenchSidebar.tsx` + `BreadboardQuickIntake.tsx` → use `usePartIngress` for the quick add; `useCatalog({ project_id })` for the starter shelf.
  - `client/src/components/circuit-editor/BreadboardReconciliationPanel.tsx` → queries by `part_id` FK instead of string-matching `partNumber`.
  - `client/src/components/circuit-editor/BreadboardShoppingList.tsx` → join `part_stock` (quantity_needed vs quantity_on_hand).
  - `client/src/components/layout/Sidebar.tsx` `ComponentTree` → `useCatalog({ trust_level: 'library' })`.
  - `client/src/components/views/CommunityLibraryView.tsx` → `useCatalog({ is_public: true })`.
  - `client/src/components/views/StarterCircuitsPanel.tsx` → `useCatalog({ origin: 'starter_circuit' })`.
  - `client/src/components/views/DesignPatternsView.tsx` → `useCatalog({ origin: 'snippet' })` once design patterns are modeled as parts.
  - `client/src/components/views/ComponentLifecyclePanel.tsx` → `useCatalog` + `usePartLifecycle`.
  - `client/src/components/views/SpiceModelsPanel.tsx` → `useCatalog` + `usePartSpiceModel`.
  - `client/src/components/views/bom-diff/*` → `useBomDiffV2(project_id, snapshot_id)`.
  - `client/src/components/circuit-editor/BreadboardView.tsx` — canvas placement writes to `part_placements` via `circuit_instances` API with required `partId`.
- `client/src/lib/inventory-health.ts` → updated to consume `PartRow` + `PartStock` directly; `InventoryItem` type removed.
- `client/src/lib/project-context.tsx` `BomItem` interface deleted. Every consumer uses `PartRow` + `PartStock`.
- Feature flag flipped to `PARTS_CATALOG_V2=true` by default in `.env.example`.

**Tests**:

- Re-run contract tests from phase 0 — expected to pass unchanged, because the legacy API routes still work via the `bom_view` + shims.
- 80+ new hook tests in `client/src/lib/parts/__tests__/`.
- 40+ new lens-view tests in `client/src/components/views/__tests__/*-v2.test.tsx`.
- Full `npm test` must be green.
- Full `npm run check` must be green.

**Browser verification (MANDATORY per skill contract)**:

1. Start dev server on port 5000.
2. Use Chrome DevTools MCP (`mcp__chrome-devtools__*`) to navigate to every list view with a seeded project.
3. For each view: take snapshot, verify canonical row testids render, count rows, capture screenshot.
4. Specific smoke tests:
   - `/projects/:id/procurement` — table shows rows; filter by category narrows; sort by price works.
   - `/projects/:id/storage` — inventory health card shows; low stock badge appears for rows where `quantity_on_hand < minimum_stock`.
   - `/projects/:id/breadboard` — quick intake submits and shows up in the reconciliation panel.
   - `/projects/:id/community` — public parts render.
   - `/projects/:id/kanban` — tasks linked to parts still link.
   - Procurement row edit (update quantity) → Storage pane reflects the change → Breadboard reconciliation reflects the change. This is the single-write-many-reads proof.
5. Save screenshots to `scribe/parts-catalog/verify-*.png`.
6. Write `scribe/parts-catalog/verification-report.md` with per-lens PASS/FAIL (same format as breadboard verification).
7. Console-error delta compared against phase 0 baseline — expected 0.

**Commit**: `feat(parts): phase 5 — cutover to canonical reads (flag on by default)`.

### Phase 6 — Legacy cleanup (3 days)

**Goal**: Remove the scaffolding. Drop dead tables, dead types, dead routes, dead source files. No 301 redirects, no compat shims — this is a hard cutover.

**Critical files**:

- `shared/schema.ts` — remove `componentLibrary`, `componentParts`, `bomItems`, `componentLifecycle`, `spiceModels`. Keep `circuit_instances` but drop the nullable `partId` column — replace with non-nullable `part_placement_id`.
- **Hard-delete legacy routes**: `/api/bom/*` and `/api/components/*` are removed entirely. All callers migrated during phase 5.
- **Delete static lookup source files**:
  - `shared/standard-library.ts`
  - `shared/verified-boards/*.ts` (directory deleted)
  - `shared/starter-circuits.ts`
  - `shared/alternate-parts.ts`
  - `shared/pinouts/*` (directory deleted)
  - `shared/footprint-library.ts` **stays** (immutable IPC spec data, value table).
  - `shared/component-types.ts` **stays** (editor type system).
- Delete `client/src/lib/project-context.tsx` `BomItem` interface; delete `InventoryItem` from `inventory-health.ts`; delete 10+ other duplicate types.
- **Delete legacy AI tools** that became redundant (no kept-for-one-cycle fallback — ripped out entirely once the new canonical tools are proven in phase 5 verification).
- Update `shared/bom-diff.ts` to only export the v2 diff.
- Delete `scripts/migrations/reconcile-parts-drift.ts` (no longer needed once cutover is validated).
- Update `docs/DEVELOPER.md`, `AGENTS.md`, `.ref/project-dna.md`:
  - Schema count goes from 36 → ~32 tables.
  - Add the new `parts` domain entry point.
  - Remove references to the 7 deleted static lookup files.
- Knowledge vault: extract 3 notes into `knowledge/`:
  - `parts-catalog-consolidation-lessons.md`
  - `drizzle-view-over-table-pattern.md`
  - `ingress-pipeline-pattern.md`

**Drizzle migration**:
- `drop-legacy-bom-items.sql` — runs after verifying `part_stock` has full parity.
- `drop-legacy-component-parts.sql`.
- `drop-legacy-component-library.sql`.
- Requires explicit ops confirmation (user approval) before running in production.

**Tests**:

- Every test that referenced a deleted type must be updated to use `PartRow`.
- Test count should go DOWN by ~200 tests (duplication removed) while coverage on canonical code goes UP.

**Commit**: `refactor(parts): phase 6 — drop legacy tables, routes, and types`.

### Phase 7 — Payoff features (ongoing)

**Goal**: Ship features that the consolidation enabled and that were impractical before.

Each of these is a separate 1-2 day ticket that rides on top of the new catalog:

1. **Global part search** — `Ctrl+K` opens a spotlight that searches `parts` across all trust levels and projects. Replaces the 18+ separate search UIs listed in the survey.
2. **One-click substitute** — anywhere a part is shown, a "find alternate" button queries `part_alternates` and offers replacement with auto-update of every placement.
3. **Supply chain watcher** — background job polls supplier APIs, updates `parts.datasheet_url`/`part_stock.unit_price`, and alerts the user when a part their BOM depends on goes obsolete.
4. **BOM templates** — save a `part_stock` row set as a reusable template for new projects ("my standard resistor kit").
5. **Shared personal inventory** — `part_stock` rows with `project_id = null` represent the user's physical bin (independent of any project). Storage Manager + quick intake now always work even without a project.
6. **Cross-project usage report** — "which projects use this part?" answerable by joining `part_placements` across projects.
7. **AI context enrichment** — the chat system prompt can now embed the full canonical spec for any referenced part, not just the BOM line.

Each of these was logged in `knowledge/gaps-and-opportunities.md` as "blocked by data model drift". The consolidation unblocks them.

---

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Data loss during backfill | low | catastrophic | Full pg_dump in phase 0; idempotent backfill; reconciliation script with zero-drift gate before cutover |
| Silent semantic drift between `bom_items` and `part_stock` | medium | high | `bom_view` keeps legacy shape for compat; reconciliation script runs after every backfill |
| Breaking AI tool behavior (45+ tools) | medium | high | Phase 5 runs v1 and v2 AI tools in parallel; switch router cuts over one tool at a time |
| Performance regression from joins | medium | medium | All join paths have indexes; EXPLAIN ANALYZE before cutover; caching preserved in `PartsStorage` |
| Component editor regressions | high | high | `componentParts.connectors` + `.buses` + `.views` JSONB fields preserved verbatim on `parts.meta`; round-trip test in phase 4 |
| Fritzing import breaks | medium | high | `fzpz` importer still writes to `components` API, but the API now forwards to ingress; golden-file tests cover 10 fzpz fixtures |
| Live collaboration drift (circuit_instances) | low | medium | collaboration CRDT ops already reference instances by integer id; new `part_placements` uses UUIDs but legacy int ids preserved in `part_placements.legacy_instance_id` bridge column during transition |
| User workflow disruption | low | low | Dual-write ensures legacy UIs keep working until phase 5 flag flip; every lens refactor is verified in browser before commit |
| `agent-teams` confusion on shared ownership | medium | medium | Hard file-ownership split: one teammate owns schema, one owns server, one owns client lenses; no overlap |

### Go/no-go checkpoints

- **Phase 2 → 3**: Dual-write is 100% reliable in dev. Ingress failures < 0.1% in fixture data.
- **Phase 3 → 4**: Every new read path returns identical data to the legacy path (byte-for-byte in `JSON.stringify` comparison) for every seeded fixture.
- **Phase 4 → 5**: Reconciliation script reports 0 drift rows on dev AND on a restored prod snapshot.
- **Phase 5 → 6**: Browser verification passes every lens; console-error delta = 0; `npm test` green; `npm run check` exit 0; user manually signs off on the cutover.
- **Phase 6 → 7**: Contract tests from phase 0 still green (proving the 301 redirects work); no user reports of missing data.

---

## Execution strategy

### `/agent-teams` layout (4 teammates, hard file ownership)

| Teammate | Owns | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Phase 6 |
|---|---|---|---|---|---|---|---|
| **schema** | `shared/schema.ts`, `shared/parts/*`, Drizzle migrations | ✅ new tables | — | — | seed tables | — | drop tables |
| **server** | `server/storage/parts.ts`, `server/routes/parts.ts`, `server/parts-ingress.ts`, `server/ai-tools/parts.ts`, all exporters | — | ingress | read routes + AI tools | reconciliation | — | remove legacy |
| **client** | `client/src/lib/parts/*`, all `views/*`, `circuit-editor/*` | — | — | — | — | lens refactor | remove legacy types |
| **verify** | `scripts/migrations/*`, all `__tests__/*`, browser verification, `scribe/parts-catalog/*` | — | ingress tests | AI tool tests | backfill + reconcile scripts | browser verification | contract replay |

**Zero file overlap** between teammates. The contract boundary between schema→server→client is the TypeScript type `PartRow` exported from `shared/parts/part-row.ts` — everyone imports it; nobody else edits it except `schema`.

### Context7 + WebSearch gates (per-phase)

Before each phase starts, the relevant teammate runs:

- `Context7` `resolve-library-id "drizzle-orm"` + `query-docs "drizzle view migrations"` (phase 1, 6)
- `Context7` `resolve-library-id "@tanstack/react-query"` + `query-docs "optimistic updates with shared cache"` (phase 5)
- `Context7` `resolve-library-id "zod"` + `query-docs "discriminated union validation"` (phase 2)
- `WebSearch` `"parts catalog consolidation PostgreSQL idempotent backfill"` (phase 4)
- `WebSearch` `"Drizzle ORM view over table read/write separation"` (phase 1)

This is mandatory per Tyler's plan-template rule. Findings feed into the ADR.

### Commit discipline

- Every phase ends with a single commit that leaves the app fully working.
- No merge; direct commits to the `parts-consolidation` branch.
- After phase 5, the branch merges to `main` via PR with the full test matrix (check + test + contract + browser verify) attached.

---

## Verification plan

### Static verification

1. `npm run check` — 0 errors, 0 warnings. Run at the end of every phase.
2. `npx eslint .` — clean.
3. `npm test` — all green. Test count expected progression: +200 (phase 1-4 additive) → -200 (phase 6 cleanup), net ~0.
4. Coverage: `npm run test:coverage` — parts domain coverage ≥ 85%.
5. Schema diff tool: compare `schema.ts` between phase 0 and phase 6, confirm net deletions > additions.

### Runtime verification (Chrome DevTools MCP)

The mandatory browser-level check per `.claude/skills/breadboard-lab/SKILL.md` principle ("do not call work done until the flow was verified in a real browser"):

**Phase 5 browser smoke test**:

1. `npm run dev` on port 5000.
2. Seed a test project: `POST /api/seed`.
3. Navigate through each lens in order:
   - `/projects/:id/procurement`
   - `/projects/:id/storage`
   - `/projects/:id/breadboard`
   - `/projects/:id/validation`
   - `/projects/:id/community`
   - `/projects/:id/design_patterns`
   - `/projects/:id/starter_circuits`
4. For each lens:
   - `take_snapshot`
   - Verify canonical testids render (e.g. `part-row-<id>`).
   - Count rows against expected from seed fixture.
   - Screenshot → `scribe/parts-catalog/verify-<lens>.png`.
5. **Cross-lens consistency proof**:
   - Edit a part's unit price from Procurement.
   - Immediately navigate to Storage — confirm the price update is visible.
   - Navigate to Breadboard reconciliation — confirm the shopping list total reflects the new price.
   - Navigate to the community view — confirm the public trust level rows are unaffected (read isolation).
6. `list_console_messages` filter `error` — 0 new errors vs baseline.

**Phase 6 browser regression test**:

- Run the exact same test path. Must match phase 5 byte-for-byte.

### Data integrity verification

1. `scripts/migrations/reconcile-parts-drift.ts` — zero drift rows.
2. Query parity script (new): runs the same queries through both legacy and canonical paths, diffs results, fails if any row differs.
3. Post-cutover manual `SELECT` sanity checks:
   ```sql
   SELECT count(*) FROM parts;              -- > 100
   SELECT count(*) FROM part_stock;         -- = old bom_items count
   SELECT count(*) FROM part_placements;    -- = old circuit_instances count
   SELECT count(*) FROM parts WHERE origin = 'library' AND is_public = true;  -- > 0
   SELECT count(*) FROM part_alternates;    -- > 0 (from alternate-parts.ts seed)
   SELECT count(*) FROM parts WHERE mpn IS NULL;  -- small — flag for user review
   ```

### AI tool verification

- Every one of the 45+ existing AI tools must run against the new catalog during phase 3. Test fixture: a seeded project with 20 BOM rows, 10 circuit instances, 5 library imports.
- New AI tools in `server/ai-tools/parts.ts` must each have an end-to-end test that hits the actual LLM (fixture mode) and asserts the tool call round-trip works.

---

## Rollback plan

At every phase, the exact reverse procedure:

- **Phase 1**: `DROP TABLE parts, part_stock, part_placements, part_lifecycle, part_spice_models, part_alternates;` — no existing data touched.
- **Phase 2**: Remove dual-write hooks from importers. Shadow data is orphaned but harmless.
- **Phase 3**: Remove new read endpoints. Legacy endpoints untouched.
- **Phase 4**: Truncate new tables. Rerun phase 4 on a fresh backfill.
- **Phase 5 (cutover)**: Flip feature flag back to `PARTS_CATALOG_V2=false`. All lenses fall back to legacy paths (code still exists in the same commit).
- **Phase 6 (drop tables)**: THIS IS THE POINT OF NO RETURN. Restore from `backups/pre-parts-consolidation-*.sql` + re-run phases 1-5.

Explicit Tyler approval required before phase 6. No exceptions.

---

## Success metrics

After the full plan ships, the following should be observably true:

- **Tables**: 36 → ~32 (net -4 after additions and drops).
- **Row shapes for parts in TypeScript**: 12 → 1 canonical `PartRow`.
- **React Query keys for parts**: 7+ → 3 (`parts`, `part_stock`, `part_placements`).
- **List views for parts**: 25+ → 25+ (unchanged — they're lenses now, not duplicates).
- **Lookup table duplicates**: 7 → 0 (seeded into `parts`).
- **String-match joins**: yes → no (FK enforcement).
- **Orphan circuit instances possible**: yes → no (non-null FK).
- **Dedup logic locations**: 9 → 1 (single ingress).
- **AI tools**: 45+ → ~25 (consolidation; new tools read canonical).
- **Test count**: ~8,800 → ~8,800 (net stable; coverage up).
- **LOC touched**: ~3,000 added + ~2,500 deleted = net +500.
- **Browser regression in any lens**: 0.
- **Console errors after cutover**: 0 above baseline.
- **User reports of missing data**: 0.

---

## Critical files reference

### Files created (new)

- `shared/parts/part-row.ts`
- `shared/parts/part-filter.ts`
- `shared/parts/part-slug.ts`
- `shared/parts/__tests__/*`
- `server/parts-ingress.ts`
- `server/storage/parts.ts`
- `server/routes/parts.ts`
- `server/ai-tools/parts.ts`
- `server/__tests__/parts-*.test.ts`
- `client/src/lib/parts/parts-catalog-context.tsx`
- `client/src/lib/parts/use-parts-catalog.ts`
- `client/src/lib/parts/use-part.ts`
- `client/src/lib/parts/use-part-stock.ts`
- `client/src/lib/parts/use-part-alternates.ts`
- `client/src/lib/parts/use-part-placements.ts`
- `client/src/lib/parts/use-part-ingress.ts`
- `client/src/lib/parts/__tests__/*`
- `scripts/migrations/backfill-parts-catalog.ts`
- `scripts/migrations/reconcile-parts-drift.ts`
- `scripts/migrations/create-bom-view.sql`
- `docs/adr/0007-unified-parts-catalog.md`
- `docs/plans/2026-04-10-parts-catalog-consolidation.md`
- `knowledge/parts-catalog-consolidation.md`
- `scribe/parts-catalog/verification-report.md`

### Files modified (major)

- `shared/schema.ts` — add new tables phase 1, drop legacy tables phase 6
- `shared/bom-diff.ts` — add v2 diff function
- `server/routes.ts` — register new parts router
- `server/ai-tools.ts` — register new parts AI tools
- `server/routes/bom.ts`, `server/routes/components.ts`, `server/circuit-routes/instances.ts` — add dual-write phase 2, remove legacy phase 6
- `server/export/bom-exporter.ts`, `pick-place-generator.ts`, `netlist-generator.ts` — flag-gated v2 paths
- `server/ai-tools/bom.ts`, `component.ts`, `bom-optimization.ts` — hook into ingress + canonical reads
- `client/src/lib/project-context.tsx` — `addBomItem`/`updateBomItem`/`deleteBomItem` delegate to parts hooks; `BomItem` interface removed phase 6
- `client/src/lib/inventory-health.ts` — consume `PartRow` directly
- `client/src/App.tsx` — wrap `PartsCatalogProvider` around `TooltipProvider`
- `client/src/components/views/ProcurementView.tsx` + 15 sub-components — lens refactor
- `client/src/components/views/StorageManagerPanel.tsx` — lens refactor
- `client/src/components/views/CommunityLibraryView.tsx` — lens refactor
- `client/src/components/views/StarterCircuitsPanel.tsx` — lens refactor
- `client/src/components/views/DesignPatternsView.tsx` — lens refactor
- `client/src/components/views/ComponentLifecyclePanel.tsx` — lens refactor
- `client/src/components/views/SpiceModelsPanel.tsx` — lens refactor
- `client/src/components/views/bom-diff/*` — v2 diff
- `client/src/components/circuit-editor/BreadboardView.tsx` — canvas placement writes via `circuit_instances` with required `partId`
- `client/src/components/circuit-editor/BreadboardWorkbenchSidebar.tsx` — use `useCatalog` for shelf
- `client/src/components/circuit-editor/BreadboardQuickIntake.tsx` — use `usePartIngress`
- `client/src/components/circuit-editor/BreadboardReconciliationPanel.tsx` — FK-based join
- `client/src/components/circuit-editor/BreadboardShoppingList.tsx` — join `part_stock`
- `client/src/components/layout/Sidebar.tsx` `ComponentTree` — `useCatalog({ trust_level: 'library' })`
- `vite.config.ts` — no changes
- `docs/MASTER_BACKLOG.md` — update 20+ BL items that referenced the old schema

---

## What this plan deliberately does NOT do

- Does not touch the circuit editor canvas geometry, wire router, DRC engine, or simulation math. Those are orthogonal.
- Does not consolidate architecture nodes, BOM snapshots' unrelated metadata, or chat message sources.
- Does not introduce a GraphQL layer or any new RPC style. It sticks to REST.
- Does not rewrite the AI chat system prompt builder — only extends it to read from the canonical parts table.
- Does not migrate users or sessions or auth — unrelated.
- Does not touch Electron/Tauri packaging — unrelated.
- Does not attempt to unify with external databases (Octopart, Digi-Key). Those stay as read-only supplier pulls that feed the ingress pipeline.

---

## Resolved decisions

All critical questions resolved by user before planning exit:

| Question | Decision |
|---|---|
| Timing | **Pause new parts/BOM features** until consolidation ships. Full 2-3 weeks focused, no parallel feature work. |
| Trust levels | **6 tiers**: `manufacturer_verified`, `protopulse_gold`, `verified`, `library`, `community`, `user`. Schema enum enforced; coach/audit surfaces distinct badges. |
| Static lookups | **Seed into DB + delete source files** in Phase 6. `alternate-parts.ts`, `starter-circuits.ts`, `verified-boards/*`, `standard-library.ts`, `pinouts/*` all moved to DB. `footprint-library.ts` and `component-types.ts` stay (immutable spec data, not user data). |
| Legacy routes | **Hard-delete in Phase 6**. No 301 redirects, no compat shims. One-user project — test suite covers everything. |

### Still-deferred micro-decisions (don't block phase 0-2 work)

- **Slug generation**: deterministic from fields (`res-10k-0402-1pct`) vs UUID-only. Default to deterministic with a numeric suffix on collision; revisit if the collision rate exceeds 1% during backfill.
- **`bom_view` lifetime**: kept during phases 2-5 for legacy read compatibility; **dropped in Phase 6** alongside the table drops. Any consumer that still uses it at that point is a bug.
