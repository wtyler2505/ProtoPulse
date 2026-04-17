# Migration Drift Remediation — BE-08 P0

**Date:** 2026-04-17
**Audit reference:** `docs/audits_and_evaluations_by_codex/22_BE-08_database_shared_schema_contracts_audit.md`
**Status:** Migration 0003_catch_up_schema committed. Parity regression test in place.

## Problem

Codex audit BE-08 flagged the migration chain as materially out of sync with the runtime Drizzle schema. A fresh `drizzle-kit migrate` on a clean database produced a schema that could not satisfy runtime queries because:

- `shared/schema.ts` declared **46** `pgTable` entries.
- Pre-0003 migrations (0000–0002) created only **27** tables and omitted columns added after 0002 was generated.
- Runtime code relied on tables/columns never materialised by the migration chain (e.g. `parts`, `part_stock`, `arduino_*`, `projects.approved_at`, `design_comments.status`).

The canonical workflow documented in `drizzle.config.ts` is:

- Development — `drizzle-kit push`
- Production / staging — `drizzle-kit migrate`

Because developers use `push`, local DBs were always correct and the drift was invisible day-to-day. It would have broken any clean prod/stage deploy.

## Resolution Summary

### 1. `migrations/0003_catch_up_schema.sql`

Generated via `drizzle-kit generate --name=catch_up_schema` driven through tmux (the CLI prompts interactively for rename-vs-create disambiguation on every new field; "create column" is the correct default in every case because `shared/schema.ts` only adds — it never renames). Zero `RENAME COLUMN` / `RENAME TABLE` appear in the output, which the parity test now asserts.

The raw Drizzle output was post-processed for idempotency so that existing dev databases kept in sync via `db:push` do not re-fail on migration replay:

- `CREATE TABLE` → `CREATE TABLE IF NOT EXISTS`
- `CREATE INDEX` / `CREATE UNIQUE INDEX` → `... IF NOT EXISTS`
- `ADD COLUMN` → `ADD COLUMN IF NOT EXISTS`
- `DROP COLUMN` → `DROP COLUMN IF EXISTS`
- `DROP CONSTRAINT` → `DROP CONSTRAINT IF EXISTS`
- `ADD CONSTRAINT ... FOREIGN KEY` wrapped in `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` (Postgres has no `ADD CONSTRAINT IF NOT EXISTS`)

The snapshot (`migrations/meta/0003_snapshot.json`) was **not** modified after generation. Drizzle's internal diff logic uses the snapshot as authoritative state; hand-editing it would emit noisy re-ALTERs on the next `drizzle-kit generate`.

### 2. Drift Content

**19 new tables added by 0003:**

arduino_build_profiles, arduino_jobs, arduino_serial_sessions, arduino_sketch_files, arduino_workspaces, bom_template_items, bom_templates, circuit_vias, part_alternates, part_lifecycle, part_placements, part_spice_models, part_stock, parts, parts_ingress_failures, pcb_zones, project_members, simulation_scenarios, supply_chain_alerts.

**Column additions on existing tables:**

| Table | Columns added |
|---|---|
| `bom_items` | `tolerance` |
| `circuit_instances` | `sub_design_id`, `bench_x`, `bench_y` |
| `circuit_wires` | `endpoint_meta`, `provenance` |
| `design_comments` | `spatial_x`, `spatial_y`, `spatial_view`, `status`, `status_updated_by`, `status_updated_at` |
| `projects` | `approved_at`, `approved_by` |
| `user_chat_settings` | `preview_ai_changes` |

**Column removals (structural replacement on `design_comments`):**

`resolved`, `resolved_by`, `resolved_at` were replaced by the `status` enum + `status_updated_by` / `status_updated_at` pair. The matching FK (`design_comments_resolved_by_users_id_fk`) is dropped before the columns.

**Indexes & FKs:** all indexes and foreign keys declared in `shared/schema.ts` for the new tables plus backfill indexes for gaps on existing tables (`arch_nodes_data_gin_idx`, `circuit_instances_properties_gin_idx`, `component_parts_meta_gin_idx`, `component_parts_connectors_gin_idx`, `idx_projects_owner_deleted`).

### 3. Regression Gate — `server/__tests__/migration-drift.test.ts`

Four **static** assertions run unconditionally (no DB required):

1. Every `pgTable` in `shared/schema.ts` has a matching `CREATE TABLE` somewhere in the migration chain.
2. The latest migration contains zero `RENAME COLUMN` / `RENAME TABLE` (guard against silent rename-as-create corruption in future generations).
3. `meta/_journal.json` entries are consistent with the on-disk migration files.
4. Table count snapshot — fails when `shared/schema.ts` gains or drops a table without a matching migration update.

Two **DB-backed** assertions run when `MIGRATION_DRIFT_DB_URL` is set:

1. Apply 0000 → 0003 against a scratch Postgres DB, then confirm every schema.ts table exists in `information_schema.tables`.
2. Confirm every schema.ts column exists in `information_schema.columns` and nullability matches.

To run locally:

```bash
sudo -u postgres bash -c \
  "createuser -s $USER 2>/dev/null; createdb drizzle_migration_test -O $USER"
MIGRATION_DRIFT_DB_URL=postgresql://$USER@localhost:5432/drizzle_migration_test \
  npx vitest run server/__tests__/migration-drift.test.ts
```

### 4. Items not covered here (left for follow-up)

- **BE-08 P1 finding #2** (conflicting `db:push` vs `db:migrate` doc guidance) — documentation cleanup, out of scope for the P0 fix.
- **BE-08 P1 finding #3** (stale `shared/api-types.generated.ts`) — separate task; the generator needs to iterate `shared/schema.ts` exports rather than a hand-maintained list.
- **BE-08 P1 finding #4** (missing FKs on `circuit_designs.parent_design_id`, `chat_messages.parent_message_id`, `design_comments.parent_id`, `component_lifecycle.bom_item_id`) — a schema change, not a migration catch-up. Must be added to `shared/schema.ts` first, then regenerated.
- **BE-08 P1 finding #5** (cross-entity composite integrity) — architecture change, separate plan.
- **BE-08 P2 finding #6** (remaining enum-like fields lacking DB CHECK constraints) — incremental work, not release-blocking.

## Verification

- `grep -c RENAME migrations/0003_catch_up_schema.sql` → 0
- `grep -c "CREATE TABLE IF NOT EXISTS" migrations/0003_catch_up_schema.sql` → 19
- Static parity tests → pass (4/4)
- DB-backed parity tests → see test log when `MIGRATION_DRIFT_DB_URL` is set
- `npm run check` → see run log
