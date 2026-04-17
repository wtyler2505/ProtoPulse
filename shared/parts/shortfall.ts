/**
 * Inventory shortfall computation — BL-0150.
 *
 * Closes the loop between BOM consumption (demand) and inventory (supply) so
 * placing parts in a design flags shortfalls before export. Supports the
 * Inventory ↔ ProtoPulse shared-source plan (Epic C).
 *
 * Canonical reading (documented in part-row.ts):
 *   - `quantityOnHand` = physical supply (untouched by BOM writes).
 *   - `quantityNeeded` = per-project demand (written by `ingressPart` on
 *     every BOM add / template apply / fzpz import).
 *   - Shortfall  = max(0, quantityNeeded - (quantityOnHand ?? 0)).
 *
 * We deliberately do NOT decrement `quantityOnHand` when a part is added to a
 * BOM — the two columns are separate so (a) a BOM edit can never corrupt the
 * physical stock reading, (b) partial-decrement races are structurally
 * impossible on crash, and (c) reservations across multiple projects compose
 * by summing `quantityNeeded` rather than by serialising decrements.
 *
 * See ADR-0010 (unified parts catalog) and docs/plans/2026-04-10-parts-catalog-consolidation.md.
 */

import type { PartStockRow } from './part-row';

/**
 * Subset of `PartStockRow` required to compute a shortfall. Using a structural
 * type means this function is safe to call on server-side Drizzle rows and
 * client-side DTOs without coupling.
 */
export interface ShortfallInput {
  quantityNeeded: number;
  quantityOnHand: number | null;
}

/**
 * Shape returned by `GET /api/projects/:id/bom/shortfalls`.
 *
 * One row per `(projectId, partId)` that has `quantityNeeded > quantityOnHand`.
 * Rows with no `quantityOnHand` entry are treated as 0 on-hand (fully short).
 */
export interface BomShortfall {
  partId: string;
  partNumber: string;
  manufacturer: string;
  description: string;
  quantityNeeded: number;
  quantityOnHand: number;
  shortfall: number;
  storageLocation: string | null;
}

/**
 * Pure shortfall calculation. Null on-hand is treated as 0 (nothing on the
 * shelf yet). Negative or non-finite inputs clamp to 0 so downstream UI
 * badges never show nonsense values.
 */
export function computeShortfall(stock: ShortfallInput): number {
  const needed = Number.isFinite(stock.quantityNeeded) ? Math.max(0, stock.quantityNeeded) : 0;
  const onHand = stock.quantityOnHand == null || !Number.isFinite(stock.quantityOnHand)
    ? 0
    : Math.max(0, stock.quantityOnHand);
  return Math.max(0, needed - onHand);
}

/** True when a stock row has any shortfall. */
export function hasShortfall(stock: ShortfallInput): boolean {
  return computeShortfall(stock) > 0;
}

/**
 * Aggregate total BOM shortfall units across a project — used by the export
 * precheck to decide whether to show a warning on fab / pick-and-place export.
 */
export function totalShortfallUnits(shortfalls: ReadonlyArray<Pick<BomShortfall, 'shortfall'>>): number {
  let total = 0;
  for (const row of shortfalls) { total += row.shortfall; }
  return total;
}

/** Expanding a `PartStockRow` to ShortfallInput — narrow helper for tests. */
export function shortfallOf(stock: Pick<PartStockRow, 'quantityNeeded' | 'quantityOnHand'>): number {
  return computeShortfall(stock);
}
