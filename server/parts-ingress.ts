/**
 * Parts ingress pipeline — Phase 2 of the unified parts catalog consolidation.
 *
 * Every parts-related importer (BOM create, component create, FZPZ import, CSV BOM import,
 * camera scan, barcode scan, library drop, AI tool create) calls `ingressPart()` to mirror
 * the legacy write into the canonical `parts` + `part_stock` + `part_placements` tables.
 *
 * Dedup order (deterministic):
 *   1. `(manufacturer, mpn)` exact match — the strongest identity signal
 *   2. `slug` exact match — deterministic from category/value/package/tolerance
 *   3. Neither → create a new `parts` row with collision-suffixed slug
 *
 * All mirror writes are **best effort**. The legacy write must have already succeeded by the
 * time `ingressPart()` is called. If the mirror fails, the caller logs a row to
 * `parts_ingress_failures` (via `logIngressFailure()` below) and the legacy operation still
 * returns success to the HTTP client. Phase 4's backfill reconciles any failures.
 *
 * See docs/plans/2026-04-10-parts-catalog-consolidation.md Phase 2 for the full spec.
 */

import { and, eq, ilike, isNull, sql } from 'drizzle-orm';
import { logger } from './logger';
import {
  parts,
  partStock,
  partPlacements,
  partsIngressFailures,
  type Part,
  type PartStock,
  type PartPlacement,
  type InsertPartsIngressFailure,
} from '@shared/schema';
import { generateSlug, appendCollisionSuffix, type SlugInput } from '@shared/parts/part-slug';
import type { PartOrigin, TrustLevel, PlacementSurface, PlacementContainerType, AssemblyCategory } from '@shared/parts/part-row';
import { normalizeMpn, normalizeManufacturer, mpnComparisonKey } from '@shared/parts/mpn';

/**
 * The database client type. Imported type-only to avoid the eager `import './db'`
 * side effect (db.ts throws at load time when DATABASE_URL is unset, which breaks
 * unit tests that don't mock it). Callers must pass an explicit db client — there is
 * intentionally no default.
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import type { db as DbInstance } from './db';
type DbClient = typeof DbInstance;

// ---------------------------------------------------------------------------
// Public source-type discriminated union
// ---------------------------------------------------------------------------

/** Shape the ingress pipeline accepts for any incoming part, normalized from legacy data. */
export interface CommonPartFields {
  title: string;
  description?: string | null;
  manufacturer?: string | null;
  mpn?: string | null;
  canonicalCategory: string;
  packageType?: string | null;
  tolerance?: string | null;
  esdSensitive?: boolean | null;
  assemblyCategory?: AssemblyCategory | null;
  datasheetUrl?: string | null;
  manufacturerUrl?: string | null;
  meta?: Record<string, unknown>;
  connectors?: unknown[];
  trustLevel?: TrustLevel;
  originRef?: string | null;
  authorUserId?: number | null;
  isPublic?: boolean;
}

/** Optional per-project stock fields that, when present, materialize a `part_stock` row. */
export interface StockFields {
  quantityNeeded?: number;
  quantityOnHand?: number | null;
  minimumStock?: number | null;
  storageLocation?: string | null;
  unitPrice?: number | string | null;
  supplier?: string | null;
  leadTime?: string | null;
  status?: string;
  notes?: string | null;
}

/** Optional placement fields that, when present, materialize a `part_placements` row. */
export interface PlacementFields {
  surface: PlacementSurface;
  containerType: PlacementContainerType;
  containerId: number;
  referenceDesignator: string;
  x?: number | null;
  y?: number | null;
  rotation?: number;
  layer?: string | null;
  properties?: Record<string, unknown>;
}

export type IngressSource =
  | 'library_copy'
  | 'fzpz'
  | 'svg'
  | 'csv_bom'
  | 'camera_scan'
  | 'barcode'
  | 'manual'
  | 'bom_create'
  | 'component_create'
  | 'circuit_instance'
  | 'ai';

export interface IngressRequest {
  source: IngressSource;
  origin: PartOrigin;
  projectId?: number;
  fields: CommonPartFields;
  stock?: StockFields;
  placement?: PlacementFields;
}

export interface IngressResult {
  partId: string;
  part: Part;
  stockId: string | null;
  stock: PartStock | null;
  placementId: string | null;
  placement: PartPlacement | null;
  created: boolean;
  reused: boolean;
  slug: string;
}

// ---------------------------------------------------------------------------
// Dedup helpers
// ---------------------------------------------------------------------------

function buildSlugInput(fields: CommonPartFields): SlugInput {
  // Heuristic: pick the most-specific "value" field from meta if available. Falls through
  // to manufacturer/mpn fallback inside generateSlug() when nothing else is available.
  const meta = fields.meta ?? {};
  const value =
    (typeof meta['value'] === 'string' && meta['value']) ||
    (typeof meta['resistance'] === 'string' && meta['resistance']) ||
    (typeof meta['capacitance'] === 'string' && meta['capacitance']) ||
    (typeof meta['inductance'] === 'string' && meta['inductance']) ||
    null;
  return {
    canonicalCategory: fields.canonicalCategory,
    value,
    packageType: fields.packageType ?? null,
    tolerance: fields.tolerance ?? null,
    manufacturer: fields.manufacturer ?? null,
    mpn: fields.mpn ?? null,
  };
}

/**
 * Try to find an existing part via `(manufacturer, mpn)` match.
 *
 * Normalizes both inputs through {@link normalizeMpn} / {@link normalizeManufacturer}
 * and compares case-insensitively using `ilike`. This means BOM ingestion paths
 * that receive `'stm32f103c8t6'`, `' STM32F103C8T6 '`, or `'STM32F103C8T6'` all
 * collapse to the same existing row instead of creating duplicates.
 *
 * The stored MPN/manufacturer is preserved in its original casing so the
 * display remains faithful to whatever the first writer supplied.
 *
 * Fallback: if `ilike` returns no exact casefold match but the normalized
 * form matched a row whose stored MPN has a packaging suffix (e.g., `/NOPB`),
 * the comparison-key loop picks it up in-memory. This handles the
 * `LM317T/NOPB` ≡ `LM317T` equivalence that `ilike` alone cannot express.
 */
async function findByMpn(db: DbClient, manufacturer: string, mpn: string): Promise<Part | null> {
  const normalizedManufacturer = normalizeManufacturer(manufacturer);
  const normalizedMpn = normalizeMpn(mpn);
  if (normalizedManufacturer === '' || normalizedMpn === '') {
    return null;
  }

  // First pass: case-insensitive exact match on the normalized forms.
  // Uses `ilike` without wildcards so Postgres uses the existing index prefix.
  const exactRows = await db
    .select()
    .from(parts)
    .where(
      and(
        ilike(parts.manufacturer, normalizedManufacturer),
        ilike(parts.mpn, normalizedMpn),
        isNull(parts.deletedAt),
      ),
    )
    .limit(1);
  if (exactRows[0]) { return exactRows[0]; }

  // Second pass: manufacturer-scoped scan + in-memory comparison-key match.
  // This catches packaging-suffix equivalences (`LM317T/NOPB` ≡ `LM317T`) and
  // internal-whitespace variants that `ilike` does not normalize.
  const candidateRows = await db
    .select()
    .from(parts)
    .where(
      and(
        ilike(parts.manufacturer, normalizedManufacturer),
        isNull(parts.deletedAt),
      ),
    )
    .limit(50);
  const incomingKey = mpnComparisonKey(mpn);
  for (const row of candidateRows) {
    if (mpnComparisonKey(row.mpn) === incomingKey) {
      return row;
    }
  }
  return null;
}

/** Try to find an existing part via slug exact match. */
async function findBySlug(db: DbClient, slug: string): Promise<Part | null> {
  const rows = await db
    .select()
    .from(parts)
    .where(and(eq(parts.slug, slug), isNull(parts.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Resolve a unique slug given a base that is already known to be taken. Iterates `-2`, `-3`, …
 * until finding an unused suffix. Caller MUST verify the base slug is taken before calling —
 * this function does not re-check the base.
 */
async function resolveUniqueSlug(db: DbClient, baseSlug: string): Promise<string> {
  // Cap at 100 collisions — beyond that, something is pathological and we want to surface it.
  for (let n = 2; n < 100; n += 1) {
    const candidate = appendCollisionSuffix(baseSlug, n);
    const existing = await findBySlug(db, candidate);
    if (!existing) {
      return candidate;
    }
  }
  throw new Error(`parts-ingress: slug collision cap exceeded for base slug "${baseSlug}"`);
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

/**
 * Ingress a part into the canonical catalog. Deduplicates, creates or reuses the `parts` row,
 * and optionally creates `part_stock` and `part_placements` rows. Returns a structured result.
 *
 * **Contract:** this function throws on any DB error. Callers that want dual-write best-effort
 * behavior should wrap the call in try/catch and call `logIngressFailure()` on error.
 */
export async function ingressPart(req: IngressRequest, db: DbClient): Promise<IngressResult> {
  const { source, origin, projectId, fields, stock, placement } = req;

  // Step 1: find-or-create the canonical `parts` row.
  // Skip the MPN lookup if either side is empty after normalization — saves
  // two wasted selects and matches the documented dedup-priority order.
  let existing: Part | null = null;
  if (
    normalizeManufacturer(fields.manufacturer ?? null) !== '' &&
    normalizeMpn(fields.mpn ?? null) !== ''
  ) {
    existing = await findByMpn(db, fields.manufacturer as string, fields.mpn as string);
  }

  let part: Part;
  let created: boolean;
  let slug: string;

  if (existing) {
    part = existing;
    created = false;
    slug = existing.slug;
  } else {
    // No mpn match — try slug.
    const baseSlug = generateSlug(buildSlugInput(fields));
    const slugMatch = await findBySlug(db, baseSlug);

    if (slugMatch) {
      // Slug already exists but this is a different physical part (no mpn match).
      // Create a fresh row with a collision-suffixed slug so both coexist.
      slug = await resolveUniqueSlug(db, baseSlug);
      const inserted = await db
        .insert(parts)
        .values({
          slug,
          title: fields.title,
          description: fields.description ?? null,
          manufacturer: fields.manufacturer ?? null,
          mpn: fields.mpn ?? null,
          canonicalCategory: fields.canonicalCategory,
          packageType: fields.packageType ?? null,
          tolerance: fields.tolerance ?? null,
          esdSensitive: fields.esdSensitive ?? null,
          assemblyCategory: fields.assemblyCategory ?? null,
          meta: (fields.meta ?? {}) as Record<string, unknown>,
          connectors: (fields.connectors ?? []) as unknown[],
          datasheetUrl: fields.datasheetUrl ?? null,
          manufacturerUrl: fields.manufacturerUrl ?? null,
          origin,
          originRef: fields.originRef ?? null,
          authorUserId: fields.authorUserId ?? null,
          isPublic: fields.isPublic ?? false,
          trustLevel: fields.trustLevel ?? 'user',
        })
        .returning();
      part = inserted[0];
      created = true;
    } else {
      // Fresh creation with the base slug.
      slug = baseSlug;
      const inserted = await db
        .insert(parts)
        .values({
          slug,
          title: fields.title,
          description: fields.description ?? null,
          manufacturer: fields.manufacturer ?? null,
          mpn: fields.mpn ?? null,
          canonicalCategory: fields.canonicalCategory,
          packageType: fields.packageType ?? null,
          tolerance: fields.tolerance ?? null,
          esdSensitive: fields.esdSensitive ?? null,
          assemblyCategory: fields.assemblyCategory ?? null,
          meta: (fields.meta ?? {}) as Record<string, unknown>,
          connectors: (fields.connectors ?? []) as unknown[],
          datasheetUrl: fields.datasheetUrl ?? null,
          manufacturerUrl: fields.manufacturerUrl ?? null,
          origin,
          originRef: fields.originRef ?? null,
          authorUserId: fields.authorUserId ?? null,
          isPublic: fields.isPublic ?? false,
          trustLevel: fields.trustLevel ?? 'user',
        })
        .returning();
      part = inserted[0];
      created = true;
    }
  }

  // Step 2: optional `part_stock` upsert (only when projectId + stock fields present).
  let stockRow: PartStock | null = null;
  if (projectId !== undefined && stock) {
    const unitPriceValue =
      stock.unitPrice === undefined || stock.unitPrice === null
        ? null
        : typeof stock.unitPrice === 'number'
          ? stock.unitPrice.toFixed(4)
          : String(stock.unitPrice);

    const existingStock = await db
      .select()
      .from(partStock)
      .where(
        and(
          eq(partStock.projectId, projectId),
          eq(partStock.partId, part.id),
          isNull(partStock.deletedAt),
        ),
      )
      .limit(1);

    if (existingStock[0]) {
      // Upsert: update quantities and pricing, keep existing metadata if new fields are undefined.
      const existingRow = existingStock[0];
      const updated = await db
        .update(partStock)
        .set({
          quantityNeeded: stock.quantityNeeded ?? existingRow.quantityNeeded,
          quantityOnHand: stock.quantityOnHand ?? existingRow.quantityOnHand,
          minimumStock: stock.minimumStock ?? existingRow.minimumStock,
          storageLocation: stock.storageLocation ?? existingRow.storageLocation,
          unitPrice: unitPriceValue ?? existingRow.unitPrice,
          supplier: stock.supplier ?? existingRow.supplier,
          leadTime: stock.leadTime ?? existingRow.leadTime,
          status: stock.status ?? existingRow.status,
          notes: stock.notes ?? existingRow.notes,
          updatedAt: new Date(),
        })
        .where(eq(partStock.id, existingRow.id))
        .returning();
      stockRow = updated[0];
    } else {
      const inserted = await db
        .insert(partStock)
        .values({
          projectId,
          partId: part.id,
          quantityNeeded: stock.quantityNeeded ?? 0,
          quantityOnHand: stock.quantityOnHand ?? null,
          minimumStock: stock.minimumStock ?? null,
          storageLocation: stock.storageLocation ?? null,
          unitPrice: unitPriceValue,
          supplier: stock.supplier ?? null,
          leadTime: stock.leadTime ?? null,
          status: stock.status ?? 'In Stock',
          notes: stock.notes ?? null,
        })
        .returning();
      stockRow = inserted[0];
    }
  }

  // Step 3: optional placement creation (only when placement fields present).
  let placementRow: PartPlacement | null = null;
  if (placement) {
    const inserted = await db
      .insert(partPlacements)
      .values({
        partId: part.id,
        surface: placement.surface,
        containerType: placement.containerType,
        containerId: placement.containerId,
        referenceDesignator: placement.referenceDesignator,
        x: placement.x ?? null,
        y: placement.y ?? null,
        rotation: placement.rotation ?? 0,
        layer: placement.layer ?? null,
        properties: (placement.properties ?? {}) as Record<string, unknown>,
      })
      .returning();
    placementRow = inserted[0];
  }

  logger.debug('parts-ingress: ingressed part', {
    source,
    partId: part.id,
    slug,
    created,
    projectId,
    hasStock: stockRow !== null,
    hasPlacement: placementRow !== null,
  });

  return {
    partId: part.id,
    part,
    stockId: stockRow?.id ?? null,
    stock: stockRow,
    placementId: placementRow?.id ?? null,
    placement: placementRow,
    created,
    reused: !created,
    slug,
  };
}

// ---------------------------------------------------------------------------
// Best-effort wrapper + failure logging
// ---------------------------------------------------------------------------

export interface MirrorContext {
  source: IngressSource;
  projectId?: number;
  legacyTable: string;
  legacyId: number;
}

/**
 * Wraps `ingressPart()` in a try/catch that logs failures to the audit table instead of
 * propagating errors. Use this from any HTTP route/AI tool where the legacy write has
 * already succeeded — never let a mirror failure surface to the user.
 */
export async function mirrorIngressBestEffort(
  req: IngressRequest,
  ctx: MirrorContext,
  db: DbClient,
): Promise<IngressResult | null> {
  try {
    return await ingressPart(req, db);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack ?? null : null;
    try {
      await logIngressFailure(
        {
          source: ctx.source,
          projectId: ctx.projectId ?? null,
          legacyTable: ctx.legacyTable,
          legacyId: ctx.legacyId,
          payload: req as unknown as Record<string, unknown>,
          errorMessage,
          errorStack,
        },
        db,
      );
    } catch (logErr) {
      // If even the audit log write fails, we log to winston and move on. The legacy row is
      // still authoritative; worst case we reconcile by scanning legacy rows in Phase 4.
      logger.error('parts-ingress: audit log write failed', {
        originalError: errorMessage,
        logError: logErr instanceof Error ? logErr.message : String(logErr),
      });
    }
    logger.warn('parts-ingress: mirror write failed — legacy row is still authoritative', {
      source: ctx.source,
      legacyTable: ctx.legacyTable,
      legacyId: ctx.legacyId,
      errorMessage,
    });
    return null;
  }
}

export interface IngressFailureInput {
  source: string;
  projectId: number | null;
  legacyTable: string;
  legacyId: number;
  payload: Record<string, unknown>;
  errorMessage: string;
  errorStack?: string | null;
}

export async function logIngressFailure(
  input: IngressFailureInput,
  db: DbClient,
): Promise<void> {
  const row: InsertPartsIngressFailure = {
    source: input.source,
    projectId: input.projectId,
    legacyTable: input.legacyTable,
    legacyId: input.legacyId,
    payload: input.payload,
    errorMessage: input.errorMessage,
    errorStack: input.errorStack ?? null,
  };
  await db.insert(partsIngressFailures).values(row);
}

