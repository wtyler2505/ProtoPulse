/**
 * Legacy BomItem compatibility type — decoupled from the `bomItems` Drizzle table.
 *
 * This manual interface mirrors the shape that the `bomItems` table produced via
 * Drizzle `$inferSelect`. Server code that still operates on the BomItem shape
 * (AI tools, exporters, snapshots) imports from here instead of `@shared/schema`.
 *
 * The underlying data now comes from the canonical `parts` + `part_stock` tables;
 * the mapping is done in `BomStorage.getBomItems()` and `mapPartWithStockToBomItem()`.
 *
 * Phase 7 will migrate consumers to use `PartRow` / `PartWithStock` directly,
 * at which point this file can be deleted.
 */

import type { PartRow, PartStockRow } from '../parts/part-row';

export interface BomItem {
  id: number;
  projectId: number;
  partNumber: string;
  manufacturer: string;
  description: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  supplier: string;
  stock: number;
  status: string;
  leadTime: string | null;
  datasheetUrl: string | null;
  manufacturerUrl: string | null;
  storageLocation: string | null;
  quantityOnHand: number | null;
  minimumStock: number | null;
  esdSensitive: boolean | null;
  assemblyCategory: string | null;
  tolerance: string | null;
  version: number;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface InsertBomItem {
  projectId: number;
  partNumber: string;
  manufacturer: string;
  description: string;
  quantity?: number;
  unitPrice: string;
  supplier: string;
  stock?: number;
  status?: string;
  leadTime?: string | null;
  datasheetUrl?: string | null;
  manufacturerUrl?: string | null;
  storageLocation?: string | null;
  quantityOnHand?: number | null;
  minimumStock?: number | null;
  esdSensitive?: boolean | null;
  assemblyCategory?: string | null;
  tolerance?: string | null;
}

let syntheticIdCounter = 0;

interface PartLike {
  slug: string;
  title: string;
  manufacturer: string | null;
  mpn: string | null;
  datasheetUrl: string | null;
  manufacturerUrl: string | null;
  esdSensitive: boolean | null;
  assemblyCategory: string | null;
  tolerance: string | null;
  version: number;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface StockLike {
  projectId: number;
  quantityNeeded: number;
  quantityOnHand: number | null;
  minimumStock: number | null;
  storageLocation: string | null;
  unitPrice: number | string | null;
  supplier: string | null;
  leadTime: string | null;
  status: string;
  version: number;
  updatedAt: Date;
  deletedAt: Date | null;
}

export function mapPartWithStockToBomItem(
  part: PartLike,
  stock: StockLike | null,
  projectId: number,
): BomItem {
  const unitPrice = stock?.unitPrice != null ? String(stock.unitPrice) : '0';
  const quantity = stock?.quantityNeeded ?? 0;
  const totalPrice = String((quantity * parseFloat(unitPrice)).toFixed(4));

  syntheticIdCounter += 1;

  return {
    id: syntheticIdCounter,
    projectId,
    partNumber: part.mpn ?? part.slug,
    manufacturer: part.manufacturer ?? 'Unknown',
    description: part.title,
    quantity,
    unitPrice,
    totalPrice,
    supplier: stock?.supplier ?? '',
    stock: stock?.quantityOnHand ?? 0,
    status: stock?.status ?? 'In Stock',
    leadTime: stock?.leadTime ?? null,
    datasheetUrl: part.datasheetUrl ?? null,
    manufacturerUrl: part.manufacturerUrl ?? null,
    storageLocation: stock?.storageLocation ?? null,
    quantityOnHand: stock?.quantityOnHand ?? null,
    minimumStock: stock?.minimumStock ?? null,
    esdSensitive: part.esdSensitive ?? null,
    assemblyCategory: part.assemblyCategory ?? null,
    tolerance: part.tolerance ?? null,
    version: stock?.version ?? part.version,
    updatedAt: stock?.updatedAt ?? part.updatedAt,
    deletedAt: stock?.deletedAt ?? part.deletedAt,
  };
}
