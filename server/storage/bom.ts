import { eq, and, desc, asc, isNull, isNotNull, sql } from 'drizzle-orm';
import {
  bomItems, type BomItem, type InsertBomItem,
  bomSnapshots, type BomSnapshot,
} from '@shared/schema';
import { StorageError, VersionConflictError } from './errors';
import type { StorageDeps } from './types';
import type { PaginationOptions } from './interfaces';

function computeTotalPrice(quantity: number, unitPrice: string | number): string {
  return String((quantity * parseFloat(String(unitPrice))).toFixed(4));
}

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
      const result = await this.db.select().from(bomItems)
        .where(and(eq(bomItems.projectId, projectId), isNull(bomItems.deletedAt)))
        .orderBy(sort === 'desc' ? desc(bomItems.id) : asc(bomItems.id))
        .limit(limit)
        .offset(offset);
      this.cache.set(cacheKey, result);
      return result;
    } catch (e) {
      throw new StorageError('getBomItems', `projects/${projectId}/bom`, e);
    }
  }

  async getBomItem(id: number, projectId: number): Promise<BomItem | undefined> {
    try {
      const [item] = await this.db.select().from(bomItems).where(and(eq(bomItems.id, id), eq(bomItems.projectId, projectId), isNull(bomItems.deletedAt)));
      return item;
    } catch (e) {
      throw new StorageError('getBomItem', `bom/${id}`, e);
    }
  }

  async createBomItem(item: InsertBomItem): Promise<BomItem> {
    try {
      const totalPrice = computeTotalPrice(item.quantity ?? 1, item.unitPrice ?? '0');
      const [created] = await this.db.insert(bomItems).values({ ...item, totalPrice }).returning();
      this.cache.invalidate(`bom:${item.projectId}`);
      return created;
    } catch (e) {
      throw new StorageError('createBomItem', 'bom', e);
    }
  }

  async updateBomItem(id: number, projectId: number, item: Partial<InsertBomItem>, expectedVersion?: number): Promise<BomItem | undefined> {
    try {
      const safeData = { ...item };
      delete safeData.projectId;

      const baseConditions = [eq(bomItems.id, id), eq(bomItems.projectId, projectId), isNull(bomItems.deletedAt)];
      const versionConditions = expectedVersion !== undefined
        ? [...baseConditions, eq(bomItems.version, expectedVersion)]
        : baseConditions;

      const versionBump = { version: sql`${bomItems.version} + 1` };

      if (safeData.quantity !== undefined || safeData.unitPrice !== undefined) {
        const updated = await this.db.transaction(async (tx) => {
          const [existing] = await tx.select().from(bomItems).where(and(...baseConditions));
          if (!existing) { return undefined; }
          if (expectedVersion !== undefined && existing.version !== expectedVersion) {
            throw new VersionConflictError('bom', id, existing.version);
          }
          const quantity = safeData.quantity ?? existing.quantity;
          const unitPrice = safeData.unitPrice ?? existing.unitPrice;
          const totalPrice = computeTotalPrice(quantity, unitPrice);
          const [result] = await tx.update(bomItems)
            .set({ ...safeData, totalPrice, ...versionBump, updatedAt: new Date() })
            .where(and(...baseConditions))
            .returning();
          return result;
        });
        if (updated) { this.cache.invalidate(`bom:${projectId}`); }
        return updated;
      }

      const [updated] = await this.db.update(bomItems)
        .set({ ...safeData, ...versionBump, updatedAt: new Date() })
        .where(and(...versionConditions))
        .returning();
      if (expectedVersion !== undefined && !updated) {
        const [existing] = await this.db.select({ id: bomItems.id, version: bomItems.version })
          .from(bomItems).where(and(...baseConditions));
        if (existing) {
          throw new VersionConflictError('bom', id, existing.version);
        }
      }
      if (updated) { this.cache.invalidate(`bom:${projectId}`); }
      return updated;
    } catch (e) {
      if (e instanceof StorageError) { throw e; }
      throw new StorageError('updateBomItem', `bom/${id}`, e);
    }
  }

  async deleteBomItem(id: number, projectId: number): Promise<boolean> {
    const [result] = await this.db.update(bomItems)
      .set({ deletedAt: new Date() })
      .where(and(eq(bomItems.id, id), eq(bomItems.projectId, projectId), isNull(bomItems.deletedAt)))
      .returning();
    if (result) { this.cache.invalidate(`bom:${projectId}`); }
    return !!result;
  }

  async getLowStockItems(projectId: number): Promise<BomItem[]> {
    try {
      return await this.db.select().from(bomItems)
        .where(and(
          eq(bomItems.projectId, projectId),
          isNull(bomItems.deletedAt),
          isNotNull(bomItems.quantityOnHand),
          isNotNull(bomItems.minimumStock),
          sql`${bomItems.quantityOnHand} <= ${bomItems.minimumStock}`,
        ))
        .orderBy(asc(bomItems.quantityOnHand));
    } catch (e) {
      throw new StorageError('getLowStockItems', `projects/${projectId}/bom/low-stock`, e);
    }
  }

  async getStorageLocations(projectId: number): Promise<string[]> {
    try {
      const rows = await this.db.selectDistinct({ storageLocation: bomItems.storageLocation })
        .from(bomItems)
        .where(and(
          eq(bomItems.projectId, projectId),
          isNull(bomItems.deletedAt),
          isNotNull(bomItems.storageLocation),
        ))
        .orderBy(asc(bomItems.storageLocation));
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
      const items = await this.db.select().from(bomItems)
        .where(and(eq(bomItems.projectId, projectId), isNull(bomItems.deletedAt)))
        .orderBy(asc(bomItems.id));

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
