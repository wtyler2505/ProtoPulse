# BE-08 Audit: Database + Shared Schema Contracts

Date: 2026-03-06  
Auditor: Codex  
Section: BE-08 (from master map)  
Method: Code + test-surface inspection only (no runtime test suite execution).

## Scope Reviewed
- DB connection and lifecycle:
  - `server/db.ts`
  - `server/index.ts`
  - `drizzle.config.ts`
- Schema and contract definitions:
  - `shared/schema.ts`
  - `shared/api-types.generated.ts`
  - `script/generate-api-types.ts`
- Migration and snapshot surface:
  - `migrations/0000_green_prodigy.sql`
  - `migrations/0001_add_enum_constraints.sql`
  - `migrations/meta/0000_snapshot.json`
  - `migrations/meta/0001_snapshot.json`
  - `migrations/meta/_journal.json`
- Contract call sites (for integrity assumptions):
  - `server/storage/projects.ts`
  - `server/storage/bom.ts`
  - `server/storage/chat.ts`
  - `server/storage/circuit.ts`
  - `server/storage/misc.ts`
  - `server/storage/ordering.ts`
  - `server/routes/projects.ts`
  - `server/routes/comments.ts`
  - `server/routes/component-lifecycle.ts`
  - `server/routes/ordering.ts`
  - `server/circuit-routes/designs.ts`
  - `server/circuit-routes/instances.ts`
  - `server/circuit-routes/wires.ts`
  - `server/circuit-routes/hierarchy.ts`
- Test surface reviewed:
  - `shared/__tests__/schema.test.ts`
  - `server/__tests__/db-constraints.test.ts`

## Schema Contract Snapshot (Current)
- Tables defined in `shared/schema.ts`: `27`
- Insert Zod schemas defined in `shared/schema.ts`: `25`
- `z.enum(...)` calls in schema layer: `7`
- Tables present in baseline migration (`0000`): `19`
- Tables missing from baseline migration vs schema: `8`
  - `hierarchical_ports`
  - `design_preferences`
  - `bom_snapshots`
  - `spice_models`
  - `component_lifecycle`
  - `design_snapshots`
  - `design_comments`
  - `pcb_orders`
- Baseline migration (`0000`) also misses schema columns on existing tables:
  - `projects`: `owner_id`, `version`
  - `architecture_nodes`: `version`
  - `architecture_edges`: `version`
  - `bom_items`: `datasheet_url`, `manufacturer_url`, `storage_location`, `quantity_on_hand`, `minimum_stock`, `esd_sensitive`, `assembly_category`, `version`
  - `chat_messages`: `branch_id`, `parent_message_id`
  - `circuit_designs`: `parent_design_id`, `version`
- Generator/entity coverage:
  - `script/generate-api-types.ts` entity catalog: `19`
  - `shared/api-types.generated.ts` patch types: `17`

## Severity Key
- `P0`: immediate deployment/data integrity break risk
- `P1`: high-impact contract/integrity risk
- `P2`: medium-risk drift/debt with failure potential
- `P3`: low-risk cleanup/consistency improvements

## Findings

### 1) `P0` Migration chain is materially out of sync with runtime schema contract
Evidence:
- Schema declares `27` tables in `shared/schema.ts`.
- `migrations/0000_green_prodigy.sql` creates only `19` tables.
- `migrations/0001_add_enum_constraints.sql` only adds 3 checks and does not close table/column gaps.
- Runtime code actively uses columns absent from `0000`:
  - `projects.ownerId` and `projects.version` (`server/storage/projects.ts:45-47`, `server/storage/projects.ts:80-90`, `server/routes/projects.ts:34`, `server/routes/projects.ts:59`)
  - `chat_messages.branch_id` and `parent_message_id` (`server/storage/chat.ts:17-22`, `server/storage/chat.ts:60-66`)
  - `bom_items.quantity_on_hand` / `minimum_stock` / `storage_location` (`server/storage/bom.ts:124-143`)
  - `circuit_designs.parent_design_id` and `version` (`server/storage/circuit.ts:53`, `server/storage/circuit.ts:319`, `server/storage/circuit.ts:329`)
- App boot verifies connectivity only; it does not auto-run migrations (`server/index.ts:280-284`).

What is happening:
- `db:migrate` on a clean database can produce a schema that does not satisfy current runtime query/update expectations.

Why this matters:
- New environments can fail at runtime with missing table/column errors even when startup connectivity passes.

Fix recommendation:
- Generate and commit a catch-up migration set that fully matches `shared/schema.ts`.
- Add a schema parity CI check (latest migration snapshot vs current schema tables/columns).
- Treat migration parity as release-blocking.

---

### 2) `P1` Conflicting DB setup guidance creates non-deterministic environments
Evidence:
- Project guidance still prioritizes `db:push`:
  - `AGENTS.md:37`
  - `README.md:175-177`, `README.md:211`
- Other docs state migration-era assumptions are complete:
  - `docs/product-analysis-checklist.md:126`
- Some docs still claim no versioned migrations:
  - `replit.md:123`

What is happening:
- Multiple “source-of-truth” workflows coexist (`db:push` vs `db:migrate`), with contradictory docs.

Why this matters:
- Team members can provision different schemas from the same commit.

Fix recommendation:
- Pick one canonical path per environment (dev/stage/prod), document it once, and remove contradictory instructions.
- If `db:push` remains for local dev, add a hard warning that prod/stage must use migrations only.

---

### 3) `P1` Generated API contract file is stale and misses newer schema entities
Evidence:
- `script/generate-api-types.ts` uses a manual entity catalog capped at 19 entries (`script/generate-api-types.ts:31-51`).
- `shared/api-types.generated.ts` only re-exports those legacy entities (`shared/api-types.generated.ts:4-48`, `shared/api-types.generated.ts:143`).
- Missing from generated API types despite being in schema:
  - `HierarchicalPortRow` / `InsertHierarchicalPort`
  - `DesignPreference` / `InsertDesignPreference`
  - `BomSnapshot` / `InsertBomSnapshot`
  - `SpiceModelRow` / `InsertSpiceModel`
  - `ComponentLifecycle` / `InsertComponentLifecycle`
  - `DesignSnapshot` / `InsertDesignSnapshot`
  - `DesignComment` / `InsertDesignComment`
  - `PcbOrder` / `InsertPcbOrder`

What is happening:
- The “generated contract” is not tied to actual schema exports; it drifts as features are added.

Why this matters:
- If adopted for typed clients/shared contracts, it will provide incomplete or wrong typings.

Fix recommendation:
- Derive generator entities automatically from schema exports (or retire this artifact if unused).
- Add CI check: regeneration must produce zero diff.

---

### 4) `P1` Important parent/relationship fields are not enforced by foreign keys
Evidence:
- Fields with relational semantics but no FK constraint in schema:
  - `circuit_designs.parent_design_id` (`shared/schema.ts:270`)
  - `chat_messages.parent_message_id` (`shared/schema.ts:143`)
  - `design_comments.parent_id` (`shared/schema.ts:549`)
  - `component_lifecycle.bom_item_id` (`shared/schema.ts:502`)
- Routes/storage rely on app logic for parent existence/scope checks:
  - comments parent check only on create path (`server/routes/comments.ts:55-60`)
  - no DB-level guarantees for lifecycle `bomItemId` integrity (`server/routes/component-lifecycle.ts:23-27`)

What is happening:
- Referential integrity for key parent/child links is application-enforced, not database-enforced.

Why this matters:
- Out-of-band writes, bugs, or partial restores can create orphaned or invalid graph links.

Fix recommendation:
- Add explicit foreign keys where possible.
- For polymorphic fields, introduce guard constraints/triggers and integrity repair tooling.

---

### 5) `P1` Cross-circuit and cross-project integrity invariants are not enforceable at DB level
Evidence:
- `circuit_wires` has independent FKs to `circuit_designs.id` and `circuit_nets.id` (`shared/schema.ts:355-356`) but no composite guard that wire net belongs to same circuit.
- Create wire route accepts `netId` and `circuitId` without net/circuit consistency check (`server/circuit-routes/wires.ts:30-37`).
- `circuit_instances.part_id` references `component_parts.id` (`shared/schema.ts:310`) with no project/circuit ownership coupling.
- Create instance route validates `partId` shape only (`server/circuit-routes/instances.ts:7-9`, `server/circuit-routes/instances.ts:59-67`).

What is happening:
- Valid FK references can still represent invalid domain state.

Why this matters:
- Data can be internally inconsistent while still passing FK checks.

Fix recommendation:
- Add composite/project-scoped integrity controls:
  - either schema changes (projectId on dependent tables + composite FKs),
  - or DB triggers validating cross-entity scope at write time.

---

### 6) `P2` Enum-like domain constraints are mostly app-only, not DB-level
Evidence:
- Schema-level `z.enum` usage appears in 7 places:
  - `shared/schema.ts:113`, `130`, `151`, `302`, `481`, `488`, `565`
- DB check constraints migration covers only 3:
  - `migrations/0001_add_enum_constraints.sql:6-18`
- Additional route-level enums exist without DB checks:
  - PCB order statuses/fabricators (`server/routes/ordering.ts:7-15`, `23-31`)
  - wire type in patch schema (`server/circuit-routes/wires.ts:13`)

What is happening:
- Domain validity depends on writing through specific app endpoints.

Why this matters:
- Imports/restores/manual SQL can inject invalid enum values undetected.

Fix recommendation:
- Add DB-level checks for high-value finite domains (or move to native PostgreSQL enums where appropriate).
- Centralize enum sources so schema/routes/migrations share one definition path.

---

### 7) `P2` Contract shape in `api-types.generated.ts` does not reflect real route response patterns
Evidence:
- Generated wrappers assume `ApiResponse<T> = { data: T }` (`shared/api-types.generated.ts:76-82`) and entity-specific aliases use that pattern (`shared/api-types.generated.ts:100-137`).
- Real routes return mixed shapes:
  - raw entity (`server/routes/projects.ts:35`, `server/routes/projects.ts:60`)
  - `{ data, total }` list envelope (`server/routes/projects.ts:23`, `server/routes/bom.ts:21`)
  - raw arrays/objects in some endpoints (`server/routes/bom.ts:30`, `server/routes/bom.ts:39`, `server/routes/spice-models.ts:27`)

What is happening:
- The generated contract file models a response format that is not consistently used by the API.

Why this matters:
- Consumers relying on this file will have incorrect typing assumptions.

Fix recommendation:
- Either align route responses to a consistent envelope standard, or generate route-level contracts from actual handlers/OpenAPI.

---

### 8) `P2` Schema validation test surface lags behind schema growth
Evidence:
- `shared/schema.ts` defines 25 insert schemas.
- `shared/__tests__/schema.test.ts` covers 17 insert schemas (missing 8):
  - `insertHierarchicalPortSchema`
  - `insertDesignPreferenceSchema`
  - `insertBomSnapshotSchema`
  - `insertSpiceModelSchema`
  - `insertComponentLifecycleSchema`
  - `insertDesignSnapshotSchema`
  - `insertDesignCommentSchema`
  - `insertPcbOrderSchema`
- `server/__tests__/db-constraints.test.ts` validates only migration `0001` checks; no comprehensive schema-vs-migration parity test.

What is happening:
- Newer schema contracts have weak regression protection.

Why this matters:
- Contract drift can ship unnoticed until runtime.

Fix recommendation:
- Expand schema tests to all insert schemas.
- Add a dedicated migration drift test that compares current schema table/column set with latest snapshot.

## What Is Already Good
- Most project-owned tables consistently reference `projects.id` with `onDelete: cascade` in schema.
- Core performance indexes exist on high-traffic columns (`project_id`, timestamps, and key lookup fields).
- Insert schemas are broadly present and used at API boundaries.
- Migration framework is in place (`db:generate`, `db:migrate`, `db:studio` scripts + Drizzle config).
- Database connection handling includes retry/backoff and pool-level error logging.

## Test Coverage Assessment (BE-08)
- Good:
  - Schema insert validation is well-covered for legacy/core entities.
  - Enum-constraint migration has direct test assertions (`server/__tests__/db-constraints.test.ts`).
- Gaps:
  - No full schema-vs-migration parity test.
  - No automated guard for `api-types.generated.ts` drift.
  - No schema contract tests for 8 newer insert schemas.

## Improvements and Enhancements (Open-Minded)
1. Add `schema-parity` CI job:
   - Compare `shared/schema.ts` table/column inventory against latest migration snapshot.
2. Make generated API contracts self-maintaining:
   - Derive entities from schema export AST or Drizzle metadata, not manual arrays.
3. Strengthen relational integrity:
   - Add missing parent FKs and scoped/composite constraints for circuit cross-links.
4. Normalize domain enums:
   - Promote high-value enum-like fields to DB-level checks (or native enums).
5. Add migration governance docs:
   - One canonical path for local setup and one for deploy/production.
6. Add data hygiene migrations:
   - Detect/repair orphaned references before enabling stricter FKs.

## Decision Questions Before BE-09
1. Is `db:migrate` now mandatory for all non-local environments, with `db:push` limited to personal/dev sandboxes?
2. Should we treat migration/schema parity failures as release blockers?
3. Do we keep `shared/api-types.generated.ts` and invest in auto-generation, or remove it to avoid false confidence?
4. For circuit integrity, do we prefer composite keys/FKs or trigger-based validation?
5. Which enum-like fields must be DB-enforced in the next hardening wave?

## Suggested Fix Order
1. Close `P0` first: deliver catch-up migrations so clean DB provisioning matches current schema.
2. Add schema/migration parity checks in CI.
3. Add high-impact integrity constraints (parent FKs, circuit cross-link consistency, lifecycle uniqueness follow-up).
4. Fix API contract generator drift or deprecate generated contract file.
5. Expand schema tests to cover all insert schemas and migration parity.

## Bottom Line
BE-08 shows a solid schema foundation, but contract governance is currently split: runtime schema and migration lineage have diverged, and generated API contract artifacts lag behind real data models. Tightening migration parity, relational constraints, and automated drift checks will make this backend far more predictable and safer to scale.
