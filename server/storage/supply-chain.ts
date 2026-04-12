/**
 * SupplyChainStorage — alerts and monitoring for supply chain changes.
 *
 * Manages CRUD for supply_chain_alerts table. Called by:
 *   - server/routes/supply-chain.ts — HTTP endpoints
 *   - server/lib/job-executors.ts — supply_chain_check job executor
 */

import { and, eq, isNull, desc, sql } from 'drizzle-orm';
import {
  supplyChainAlerts,
  type InsertSupplyChainAlert,
  type SupplyChainAlert,
} from '@shared/schema';
import type { StorageDeps } from './types';
import { StorageError } from './errors';

export class SupplyChainStorage {
  private db: StorageDeps['db'];
  private cache: StorageDeps['cache'];

  constructor(deps: StorageDeps) {
    this.db = deps.db;
    this.cache = deps.cache;
  }

  async createAlert(data: InsertSupplyChainAlert): Promise<SupplyChainAlert> {
    try {
      const [created] = await this.db.insert(supplyChainAlerts).values(data).returning();
      this.cache.invalidate('supply_chain_alerts:');
      return created;
    } catch (e) {
      throw new StorageError('createAlert', 'supply_chain_alerts', e);
    }
  }

  async createAlertsBatch(alerts: InsertSupplyChainAlert[]): Promise<number> {
    if (alerts.length === 0) { return 0; }
    try {
      const created = await this.db.insert(supplyChainAlerts).values(alerts).returning({ id: supplyChainAlerts.id });
      this.cache.invalidate('supply_chain_alerts:');
      return created.length;
    } catch (e) {
      throw new StorageError('createAlertsBatch', 'supply_chain_alerts', e);
    }
  }

  async getAlerts(opts: {
    projectId?: number;
    partId?: string;
    unacknowledgedOnly?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ data: SupplyChainAlert[]; total: number }> {
    try {
      const conditions = [];
      if (opts.projectId !== undefined) {
        conditions.push(eq(supplyChainAlerts.projectId, opts.projectId));
      }
      if (opts.partId) {
        conditions.push(eq(supplyChainAlerts.partId, opts.partId));
      }
      if (opts.unacknowledgedOnly) {
        conditions.push(eq(supplyChainAlerts.acknowledged, false));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [countResult] = await this.db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(supplyChainAlerts)
        .where(where);

      const data = await this.db
        .select()
        .from(supplyChainAlerts)
        .where(where)
        .orderBy(desc(supplyChainAlerts.createdAt))
        .limit(opts.limit ?? 50)
        .offset(opts.offset ?? 0);

      return { data, total: countResult.count };
    } catch (e) {
      throw new StorageError('getAlerts', 'supply_chain_alerts', e);
    }
  }

  async getUnacknowledgedCount(projectId?: number): Promise<number> {
    try {
      const cacheKey = `supply_chain_alerts:unack:${projectId ?? 'all'}`;
      const cached = this.cache.get<number>(cacheKey);
      if (cached !== undefined) { return cached; }

      const conditions = [eq(supplyChainAlerts.acknowledged, false)];
      if (projectId !== undefined) {
        conditions.push(eq(supplyChainAlerts.projectId, projectId));
      }

      const [result] = await this.db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(supplyChainAlerts)
        .where(and(...conditions));

      this.cache.set(cacheKey, result.count);
      return result.count;
    } catch (e) {
      throw new StorageError('getUnacknowledgedCount', 'supply_chain_alerts', e);
    }
  }

  async acknowledgeAlert(alertId: string): Promise<boolean> {
    try {
      const [updated] = await this.db
        .update(supplyChainAlerts)
        .set({ acknowledged: true, acknowledgedAt: new Date() })
        .where(and(eq(supplyChainAlerts.id, alertId), eq(supplyChainAlerts.acknowledged, false)))
        .returning({ id: supplyChainAlerts.id });
      this.cache.invalidate('supply_chain_alerts:');
      return !!updated;
    } catch (e) {
      throw new StorageError('acknowledgeAlert', `supply_chain_alerts/${alertId}`, e);
    }
  }

  async acknowledgeAll(projectId?: number): Promise<number> {
    try {
      const conditions = [eq(supplyChainAlerts.acknowledged, false)];
      if (projectId !== undefined) {
        conditions.push(eq(supplyChainAlerts.projectId, projectId));
      }

      const updated = await this.db
        .update(supplyChainAlerts)
        .set({ acknowledged: true, acknowledgedAt: new Date() })
        .where(and(...conditions))
        .returning({ id: supplyChainAlerts.id });

      this.cache.invalidate('supply_chain_alerts:');
      return updated.length;
    } catch (e) {
      throw new StorageError('acknowledgeAll', 'supply_chain_alerts', e);
    }
  }
}
