/**
 * PartsStorage — the canonical parts catalog data access layer.
 *
 * **Phase 1 status: SKELETON ONLY.** All methods throw `StorageError` with a "not-implemented"
 * marker. The real implementation lands in Phase 3 (`feat(parts): phase 3 — canonical read path`).
 *
 * The purpose of this skeleton is twofold:
 *
 * 1. Lock in the method signatures now so `server/routes/parts.ts` (Phase 3), `server/ai-tools/parts.ts`
 *    (Phase 3), and `server/parts-ingress.ts` (Phase 2) can be written against a stable interface.
 * 2. Keep `npm run check` green while the rest of the schema lands. The methods are compile-checked
 *    against the Drizzle `parts` / `partStock` / `partPlacements` tables.
 *
 * **Do NOT add real query logic here yet** — adding behavior before the tests land violates the
 * phase boundary. If a caller needs a method immediately, add it to the interface and make it
 * throw; implement for real in Phase 3.
 */

import type { StorageDeps } from './types';
import type { PaginationOptions } from './interfaces';
import { StorageError } from './errors';
import type {
  Part,
  InsertPart,
  PartStock,
  InsertPartStock,
  PartPlacement,
  InsertPartPlacement,
  PartLifecycle,
  InsertPartLifecycle,
  PartSpiceModel,
  InsertPartSpiceModel,
  PartAlternate,
  InsertPartAlternate,
} from '@shared/schema';
import type { PartFilter, PartPagination } from '@shared/parts/part-filter';

function notImplemented(method: string): never {
  throw new StorageError(method, 'parts', new Error(`PartsStorage.${method} is a Phase 1 skeleton — full implementation lands in Phase 3`));
}

export class PartsStorage {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(private readonly deps: StorageDeps) {}

  // -------------------------------------------------------------------------
  // parts (canonical)
  // -------------------------------------------------------------------------

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async search(_filter: PartFilter, _pagination?: PartPagination): Promise<Part[]> {
    return notImplemented('search');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getById(_id: string): Promise<Part | undefined> {
    return notImplemented('getById');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getBySlug(_slug: string): Promise<Part | undefined> {
    return notImplemented('getBySlug');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getByMpn(_manufacturer: string, _mpn: string): Promise<Part | undefined> {
    return notImplemented('getByMpn');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async createPart(_data: InsertPart): Promise<Part> {
    return notImplemented('createPart');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async updatePart(_id: string, _data: Partial<InsertPart>, _expectedVersion?: number): Promise<Part | undefined> {
    return notImplemented('updatePart');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async softDeletePart(_id: string): Promise<boolean> {
    return notImplemented('softDeletePart');
  }

  // -------------------------------------------------------------------------
  // part_stock (per-project inventory overlay)
  // -------------------------------------------------------------------------

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async listStockForProject(_projectId: number, _opts?: PaginationOptions): Promise<PartStock[]> {
    return notImplemented('listStockForProject');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getStock(_projectId: number, _partId: string): Promise<PartStock | undefined> {
    return notImplemented('getStock');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async upsertStock(_data: InsertPartStock): Promise<PartStock> {
    return notImplemented('upsertStock');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async updateStock(_id: string, _data: Partial<InsertPartStock>, _expectedVersion?: number): Promise<PartStock | undefined> {
    return notImplemented('updateStock');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async deleteStock(_id: string): Promise<boolean> {
    return notImplemented('deleteStock');
  }

  // -------------------------------------------------------------------------
  // part_placements (where-used)
  // -------------------------------------------------------------------------

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getPlacements(_partId: string): Promise<PartPlacement[]> {
    return notImplemented('getPlacements');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async listPlacementsForContainer(_containerType: string, _containerId: number): Promise<PartPlacement[]> {
    return notImplemented('listPlacementsForContainer');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async createPlacement(_data: InsertPartPlacement): Promise<PartPlacement> {
    return notImplemented('createPlacement');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async deletePlacement(_id: string): Promise<boolean> {
    return notImplemented('deletePlacement');
  }

  // -------------------------------------------------------------------------
  // part_lifecycle (obsolescence)
  // -------------------------------------------------------------------------

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getLifecycle(_partId: string): Promise<PartLifecycle | undefined> {
    return notImplemented('getLifecycle');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async upsertLifecycle(_data: InsertPartLifecycle): Promise<PartLifecycle> {
    return notImplemented('upsertLifecycle');
  }

  // -------------------------------------------------------------------------
  // part_spice_models
  // -------------------------------------------------------------------------

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getSpiceModel(_partId: string): Promise<PartSpiceModel | undefined> {
    return notImplemented('getSpiceModel');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async listSpiceModels(_partId: string): Promise<PartSpiceModel[]> {
    return notImplemented('listSpiceModels');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async createSpiceModel(_data: InsertPartSpiceModel): Promise<PartSpiceModel> {
    return notImplemented('createSpiceModel');
  }

  // -------------------------------------------------------------------------
  // part_alternates (equivalence graph)
  // -------------------------------------------------------------------------

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getAlternates(_partId: string): Promise<Part[]> {
    return notImplemented('getAlternates');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async createAlternate(_data: InsertPartAlternate): Promise<PartAlternate> {
    return notImplemented('createAlternate');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async removeAlternate(_partId: string, _altPartId: string): Promise<boolean> {
    return notImplemented('removeAlternate');
  }
}
