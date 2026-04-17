import { eq, and, desc, asc, isNull, isNotNull, sql } from 'drizzle-orm';
import {
  parts, partStock,
  bomSnapshots, type BomSnapshot,
} from '@shared/schema';
import type { BomItem } from '@shared/types/bom-compat';
import { mapPartWithStockToBomItem } from '@shared/types/bom-compat';
import type { BomShortfall } from '@shared/parts/shortfall';
import { computeShortfall } from '@shared/parts/shortfall';
import { StorageError } from './errors';
import type { StorageDeps } from './types';
import type { PaginationOptions } from './interfaces';

export class BomStorage {
  constructor(private deps: StorageDeps) {}

  private get db() { return this.deps.db; }
  private get cache() { return this.deps.cache; }

  async getBomItems(projectId: number, opts?: PaginationOptions): Promise<BomItem[]> {
    try {
      const { limit = 50, offset = 0, sort = 'desc' } = opts || {};
      const cacheKey = `bom:${projectId}:${limit}:${offset}:${sort}`;
      const cached = this.cache.get<BomItem[]>(cacheKey);
      if (cached) { return cached; }

      const joinCondition = and(
        eq(partStock.partId, parts.id),
        eq(partStock.projectId, projectId),
        isNull(partStock.deletedAt),
      );

      const rows = await this.db
        .select({ part: parts, stock: partStock })
        .from(parts)
        .innerJoin(partStock, joinCondition)
        .where(isNull(parts.deletedAt))
        .orderBy(sort === 'desc' ? desc(partStock.id) : asc(partStock.id))
        .limit(limit)
        .offset(offset);

      const result = rows.map((row) =>
        mapPartWithStockToBomItem(row.part, row.stock, projectId),
      );

      this.cache.set(cacheKey, result);
      return result;
    } catch (e) {
      throw new StorageError('getBomItems', `projects/${projectId}/bom`, e);
    }
  }

  async getLowStockItems(projectId: number): Promise<BomItem[]> {
    try {
      const joinCondition = and(
        eq(partStock.partId, parts.id),
        eq(partStock.projectId, projectId),
        isNull(partStock.deletedAt),
      );

      const rows = await this.db
        .select({ part: parts, stock: partStock })
        .from(parts)
        .innerJoin(partStock, joinCondition)
        .where(and(
          isNull(parts.deletedAt),
          isNotNull(partStock.quantityOnHand),
          isNotNull(partStock.minimumStock),
          sql`${partStock.quantityOnHand} <= ${partStock.minimumStock}`,
        ))
        .orderBy(asc(partStock.quantityOnHand));

      return rows.map((row) =>
        mapPartWithStockToBomItem(row.part, row.stock, projectId),
      );
    } catch (e) {
      throw new StorageError('getLowStockItems', `projects/${projectId}/bom/low-stock`, e);
    }
  }

  /**
   * BL-0150 — BOM inventory shortfalls.
   *
   * Returns one row per `(projectId, partId)` where `quantityNeeded` exceeds
   * `quantityOnHand`. The filter is applied in SQL (`needed > coalesce(onHand, 0)`)
   * so we only pull rows that actually need attention. Null on-hand rows are
   * included and treated as 0 on the shelf — see `computeShortfall` for the
   * canonical rule.
   *
   * Unlike `getLowStockItems`, this does NOT require a non-null `minimumStock`:
   * a shortfall is about "the BOM demands more than we own," not about
   * "we've dipped below our reorder threshold." The two answer different
   * questions and are deliberately separate endpoints.
   */
  async getShortfalls(projectId: number): Promise<BomShortfall[]> {
    try {
      const rows = await this.db
        .select({ part: parts, stock: partStock })
        .from(parts)
        .innerJoin(partStock, and(
          eq(partStock.partId, parts.id),
          eq(partStock.projectId, projectId),
          isNull(partStock.deletedAt),
        ))
        .where(and(
          isNull(parts.deletedAt),
          sql`${partStock.quantityNeeded} > COALESCE(${partStock.quantityOnHand}, 0)`,
        ))
        .orderBy(desc(sql`${partStock.quantityNeeded} - COALESCE(${partStock.quantityOnHand}, 0)`));

      return rows.map((row) => {
        const shortfall = computeShortfall({
          quantityNeeded: row.stock.quantityNeeded,
          quantityOnHand: row.stock.quantityOnHand,
        });
        return {
          partId: row.part.id,
          partNumber: row.part.mpn ?? row.part.slug,
          manufacturer: row.part.manufacturer ?? 'Unknown',
          description: row.part.title,
          quantityNeeded: row.stock.quantityNeeded,
          quantityOnHand: row.stock.quantityOnHand ?? 0,
          shortfall,
          storageLocation: row.stock.storageLocation,
        };
      });
    } catch (e) {
      throw new StorageError('getShortfalls', `projects/${projectId}/bom/shortfalls`, e);
    }
  }

  async getStorageLocations(projectId: number): Promise<string[]> {
    try {
      const rows = await this.db.selectDistinct({ storageLocation: partStock.storageLocation })
        .from(partStock)
        .where(and(
          eq(partStock.projectId, projectId),
          isNull(partStock.deletedAt),
          isNotNull(partStock.storageLocation),
        ))
        .orderBy(asc(partStock.storageLocation));
      return rows
        .map((r) => r.storageLocation)
        .filter((loc): loc is string => loc !== null);
    } catch (e) {
      throw new StorageError('getStorageLocations', `projects/${projectId}/bom/storage-locations`, e);
    }
  }

  // --- BOM Snapshots (EN-21) ---

  async createBomSnapshot(projectId: number, label: string): Promise<BomSnapshot> {
    try {
      const items = await this.getBomItems(projectId, { limit: 10000, offset: 0, sort: 'asc' });

      const [snapshot] = await this.db.insert(bomSnapshots)
        .values({ projectId, label, snapshotData: items })
        .returning();
      return snapshot;
    } catch (e) {
      throw new StorageError('createBomSnapshot', `projects/${projectId}/bom-snapshots`, e);
    }
  }

  async getBomSnapshots(projectId: number): Promise<BomSnapshot[]> {
    try {
      return await this.db.select().from(bomSnapshots)
        .where(eq(bomSnapshots.projectId, projectId))
        .orderBy(desc(bomSnapshots.createdAt));
    } catch (e) {
      throw new StorageError('getBomSnapshots', `projects/${projectId}/bom-snapshots`, e);
    }
  }

  async getBomSnapshot(projectId: number, id: number): Promise<BomSnapshot | undefined> {
    try {
      const [snapshot] = await this.db.select().from(bomSnapshots)
        .where(and(eq(bomSnapshots.projectId, projectId), eq(bomSnapshots.id, id)));
      return snapshot;
    } catch (e) {
      throw new StorageError('getBomSnapshot', `projects/${projectId}/bom-snapshots/${id}`, e);
    }
  }

  async deleteBomSnapshot(projectId: number, id: number): Promise<boolean> {
    try {
      const [deleted] = await this.db.delete(bomSnapshots)
        .where(and(eq(bomSnapshots.projectId, projectId), eq(bomSnapshots.id, id)))
        .returning();
      return !!deleted;
    } catch (e) {
      throw new StorageError('deleteBomSnapshot', `projects/${projectId}/bom-snapshots/${id}`, e);
    }
  }
}
