-- Phase 6 migration: Drop the legacy bom_items table.
--
-- Prerequisites:
--   1. Phase 5 cutover complete — all reads come from canonical parts + part_stock.
--   2. BomStorage.getBomItems() redirected to canonical (Phase 6.1).
--   3. server/routes/bom.ts deleted (Phase 6.3).
--   4. All server consumers verified to work with canonical data.
--
-- This migration is DESTRUCTIVE and NON-REVERSIBLE.
-- Back up the database before running: pg_dump $DATABASE_URL > pre-phase6-backup.sql
--
-- Do NOT run automatically. Requires explicit Tyler approval.
-- Apply: psql $DATABASE_URL -f scripts/migrations/drop-legacy-bom-items.sql

BEGIN;

-- Safety check: verify canonical part_stock has data before dropping
DO $$
DECLARE
  stock_count INTEGER;
  bom_count INTEGER;
BEGIN
  SELECT count(*) INTO stock_count FROM part_stock WHERE deleted_at IS NULL;
  SELECT count(*) INTO bom_count FROM bom_items WHERE deleted_at IS NULL;

  IF stock_count = 0 AND bom_count > 0 THEN
    RAISE EXCEPTION 'ABORT: part_stock has 0 rows but bom_items has %. Backfill may not have run.', bom_count;
  END IF;

  RAISE NOTICE 'Safety check passed: part_stock=%, bom_items=%', stock_count, bom_count;
END $$;

-- Drop indexes first
DROP INDEX IF EXISTS idx_bom_items_project;
DROP INDEX IF EXISTS idx_bom_items_project_deleted;

-- Drop the table
DROP TABLE IF EXISTS bom_items CASCADE;

-- Drop the compatibility view (no longer needed)
DROP VIEW IF EXISTS bom_view;

COMMIT;
