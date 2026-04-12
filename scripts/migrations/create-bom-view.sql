-- BOM compatibility view — Phase 4 of the unified parts catalog consolidation.
--
-- Maps canonical `parts` + `part_stock` into the legacy `bom_items` response shape.
-- Used during Phase 5 cutover so legacy client code can read from the canonical tables
-- without changing its column expectations.
--
-- Key column mappings:
--   parts.title          → bom_view.description
--   parts.mpn            → bom_view.part_number
--   parts.manufacturer   → bom_view.manufacturer
--   part_stock.*         → bom_view.quantity, unit_price, total_price, etc.
--
-- Apply: psql $DATABASE_URL -f scripts/migrations/create-bom-view.sql

DROP VIEW IF EXISTS bom_view;

CREATE VIEW bom_view AS
SELECT
  ps.id::text                                       AS id,
  ps.project_id                                     AS project_id,
  COALESCE(p.mpn, p.slug)                           AS part_number,
  COALESCE(p.manufacturer, 'Unknown')               AS manufacturer,
  p.title                                           AS description,
  ps.quantity_needed                                 AS quantity,
  COALESCE(ps.unit_price, 0)                        AS unit_price,
  COALESCE(ps.unit_price, 0) * ps.quantity_needed   AS total_price,
  COALESCE(ps.supplier, '')                          AS supplier,
  COALESCE(ps.quantity_on_hand, 0)                  AS stock,
  ps.status                                         AS status,
  ps.lead_time                                      AS lead_time,
  p.datasheet_url                                   AS datasheet_url,
  p.manufacturer_url                                AS manufacturer_url,
  ps.storage_location                               AS storage_location,
  ps.quantity_on_hand                               AS quantity_on_hand,
  ps.minimum_stock                                  AS minimum_stock,
  p.esd_sensitive                                   AS esd_sensitive,
  p.assembly_category                               AS assembly_category,
  p.tolerance                                       AS tolerance,
  ps.version                                        AS version,
  ps.updated_at                                     AS updated_at,
  ps.deleted_at                                     AS deleted_at,
  -- Extra canonical fields (available for new code, ignored by legacy)
  p.id                                              AS canonical_part_id,
  p.slug                                            AS canonical_slug,
  p.canonical_category                              AS canonical_category,
  p.trust_level                                     AS trust_level,
  p.origin                                          AS origin
FROM part_stock ps
INNER JOIN parts p ON p.id = ps.part_id
WHERE p.deleted_at IS NULL
  AND ps.deleted_at IS NULL;
