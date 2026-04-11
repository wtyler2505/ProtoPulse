---
description: "Eight parts-related tables and twelve TypeScript row shapes collapse into one canonical parts table with per-project stock and where-used overlays"
type: decision
source: "docs/plans/2026-04-10-parts-catalog-consolidation.md, docs/adr/0010-unified-parts-catalog.md"
confidence: proven
topics: ["[[architecture-decisions]]", "[[dev-infrastructure]]", "[[gaps-and-opportunities]]"]
related_components: ["shared/schema.ts", "server/parts-ingress.ts", "server/storage/parts.ts", "server/routes/parts.ts", "server/ai-tools/parts.ts", "client/src/lib/parts/", "shared/alternate-parts.ts", "shared/starter-circuits.ts", "shared/standard-library.ts", "shared/verified-boards/"]
---

# ProtoPulse parts data lived in eight disconnected tables until a single canonical catalog replaced the drift surface

A single 10 kΩ resistor could simultaneously exist in the database as nine different things: a `componentLibrary` template, a `componentParts` project copy, a nullable `circuitInstances.partId`, a `bomItems` row string-matched by `partNumber`, a frozen `bomSnapshots` JSONB embedded clone, a `spiceModels` row, a `componentLifecycle` row, and a hard-coded JSON entry in any of seven static lookup files (`alternate-parts.ts` at ~1263 LOC, `starter-circuits.ts` at ~1035 LOC, `verified-boards/*`, `standard-library.ts`, `footprint-library.ts`, `pinouts/*`). None of these were linked by foreign key — `bomItems.partNumber` was free text, `circuitInstances.partId` was nullable with `ON DELETE SET NULL`. Nothing prevented drift; updating a datasheet URL in the library cascaded nowhere. The user-visible consequences were: four different row shapes across `ProcurementView`, `StorageManagerPanel`, sidebar library, and `BreadboardReconciliationPanel`; silent failure of reconciliation when manufacturer strings differed by a typo ("1/4W" vs "0.25W"); inventory health that ignored bin stock not yet added to a project BOM; and dedup logic independently reimplemented in nine separate importer paths.

The consolidation replaces this with three core tables: `parts` (canonical identity + spec, single source of truth, `UNIQUE(manufacturer, mpn)`, GIN-indexed `meta` and `connectors` JSONB, six trust tiers from `manufacturer_verified` down to `user`), `part_stock` (per-project inventory overlay with `UNIQUE(project_id, part_id)`, replaces the stock columns on `bomItems`), and `part_placements` (where-used, non-nullable `part_id` with `ON DELETE RESTRICT` — no orphan placements possible). Narrow overlays keep their unique data: `part_lifecycle`, `part_spice_models`, `part_alternates`. A single `POST /api/parts/ingress` endpoint absorbs all nine importer code paths. A single `PartRow` TypeScript type collapses all twelve row shapes. A single `useCatalog(filter)` React hook powers every list view as a filtered lens. The static lookup files are seeded into the DB during Phase 4 and **deleted** in Phase 6 — the database becomes the sole authority and future edits are migrations, not code commits. `shared/footprint-library.ts` and `shared/component-types.ts` stay because they are immutable IPC spec data and the editor type system, not user data.

The payoff is seven features that were previously blocked by data model drift: global part search (`Ctrl+K` across all trust levels and projects), one-click substitute (walk `part_alternates` at query time), supply chain watcher (background poll with obsolescence alerts), BOM templates (reusable `part_stock` row sets), shared personal inventory (`project_id = null` stock rows for bin tracking independent of any project), cross-project usage report, and AI context enrichment (chat system prompt embeds full canonical spec, not just the BOM line). The initiative is a 7-phase ~3-week effort with a feature freeze on parts/BOM/inventory during execution, a full `pg_dump` rollback, and a mandatory Chrome DevTools MCP browser verification before the Phase 6 hard-delete of legacy tables. Phase 6 is the point of no return; explicit Tyler approval is required before the drop migrations run.

---

Relevant Notes:
- [[god-files-create-feature-paralysis-through-complexity]] -- same structural pattern: complexity blocks features until decomposed
- [[dual-export-system-is-a-maintenance-trap]] -- another case where two parallel systems for one concept compounded maintenance cost
- [[hardcoded-project-id-blocked-multi-project-until-wave-39]] -- similar data-model drift pattern that blocked a domain until consolidation
- [[monolithic-context-causes-quadratic-render-complexity]] -- analog at the state layer: monolithic shape blocks features
- [[drizzle-orm-was-chosen-for-type-safe-zod-integration]] -- the FK + Zod discipline that makes this consolidation safe

Topics:
- [[architecture-decisions]]
- [[dev-infrastructure]]
- [[gaps-and-opportunities]]
