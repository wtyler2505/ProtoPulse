import { eq, desc } from 'drizzle-orm';
import {
  pcbOrders,
} from '@shared/schema';
import type { PcbOrder, InsertPcbOrder } from '@shared/schema';
import { StorageError } from './errors';
import type { StorageDeps } from './types';

export class OrderingStorage {
  constructor(private deps: StorageDeps) {}

  private get db() { return this.deps.db; }
  private get cache() { return this.deps.cache; }

  async getOrders(projectId: number): Promise<PcbOrder[]> {
    try {
      const cacheKey = `orders:${projectId}`;
      const cached = this.cache.get<PcbOrder[]>(cacheKey);
      if (cached) { return cached; }
      const result = await this.db.select().from(pcbOrders)
        .where(eq(pcbOrders.projectId, projectId))
        .orderBy(desc(pcbOrders.createdAt));
      this.cache.set(cacheKey, result);
      return result;
    } catch (e) {
      throw new StorageError('getOrders', `projects/${projectId}/orders`, e);
    }
  }

  async getOrder(id: number): Promise<PcbOrder | undefined> {
    try {
      const [order] = await this.db.select().from(pcbOrders)
        .where(eq(pcbOrders.id, id));
      return order;
    } catch (e) {
      throw new StorageError('getOrder', `orders/${id}`, e);
    }
  }

  async createOrder(data: InsertPcbOrder): Promise<PcbOrder> {
    try {
      const [created] = await this.db.insert(pcbOrders).values(data).returning();
      this.cache.invalidate(`orders:${data.projectId}`);
      return created;
    } catch (e) {
      throw new StorageError('createOrder', 'orders', e);
    }
  }

  async updateOrder(id: number, data: Partial<InsertPcbOrder> & { submittedAt?: Date }): Promise<PcbOrder | undefined> {
    try {
      const safeData = { ...data };
      delete safeData.projectId;

      const [updated] = await this.db.update(pcbOrders)
        .set({ ...safeData, updatedAt: new Date() })
        .where(eq(pcbOrders.id, id))
        .returning();

      if (updated) {
        this.cache.invalidate(`orders:${updated.projectId}`);
      }
      return updated;
    } catch (e) {
      throw new StorageError('updateOrder', `orders/${id}`, e);
    }
  }

  async deleteOrder(id: number): Promise<boolean> {
    try {
      const [deleted] = await this.db.delete(pcbOrders)
        .where(eq(pcbOrders.id, id))
        .returning();
      if (deleted) {
        this.cache.invalidate(`orders:${deleted.projectId}`);
      }
      return !!deleted;
    } catch (e) {
      throw new StorageError('deleteOrder', `orders/${id}`, e);
    }
  }
}
