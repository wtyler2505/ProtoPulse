/**
 * PartsStorage — the canonical parts catalog data access layer (Phase 3 full implementation).
 *
 * Replaces the Phase 1 skeleton. Every method now backs real Drizzle queries against the
 * `parts`, `part_stock`, `part_placements`, `part_lifecycle`, `part_spice_models`, and
 * `part_alternates` tables. All methods are soft-delete aware.
 *
 * Called by:
 *   - server/routes/parts.ts  — HTTP read/write endpoints (Phase 3)
 *   - server/ai-tools/parts.ts — 8 AI tools that read canonical parts (Phase 3)
 *   - server/parts-ingress.ts  — dual-write mirror pipeline (Phase 2) — uses db directly
 *
 * Caching: LRU cache keyed by `parts:*`, `parts_stock:*`, `parts_placements:*`. Invalidated
 * by prefix on any write.
 */

import { and, eq, isNull, isNotNull, desc, asc, ilike, or, inArray, sql } from 'drizzle-orm';
import {
  parts,
  partStock,
  partPlacements,
  partLifecycle,
  partSpiceModels,
  partAlternates,
  type Part,
  type InsertPart,
  type PartStock,
  type InsertPartStock,
  type PartPlacement,
  type InsertPartPlacement,
  type PartLifecycle,
  type InsertPartLifecycle,
  type PartSpiceModel,
  type InsertPartSpiceModel,
  type PartAlternate,
  type InsertPartAlternate,
} from '@shared/schema';
import { TRUST_LEVELS, trustRank, type TrustLevel } from '@shared/parts/part-row';
import type { PartFilter, PartPagination, PartSortField } from '@shared/parts/part-filter';
import { DEFAULT_PART_PAGINATION } from '@shared/parts/part-filter';
import type { StorageDeps } from './types';
import type { PaginationOptions } from './interfaces';
import { StorageError, VersionConflictError } from './errors';

/** Escape Postgres LIKE wildcards so user-supplied text doesn't explode. */
function escapeLikeWildcards(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/** Given a minimum trust level, return the set of levels at-or-above that rank. */
function trustLevelsAtOrAbove(minLevel: TrustLevel): TrustLevel[] {
  const minRank = trustRank(minLevel);
  return TRUST_LEVELS.filter((level) => trustRank(level) <= minRank);
}

export class PartsStorage {
  constructor(private readonly deps: StorageDeps) {}

  private get db() { return this.deps.db; }
  private get cache() { return this.deps.cache; }

  // -------------------------------------------------------------------------
  // parts (canonical)
  // -------------------------------------------------------------------------

  private buildSearchConditions(filter: PartFilter): unknown[] {
    const conditions: unknown[] = [];
    if (!filter.includeDeleted) {
      conditions.push(isNull(parts.deletedAt));
    }
    if (filter.category) {
      conditions.push(eq(parts.canonicalCategory, filter.category));
    }
    if (filter.origin) {
      conditions.push(eq(parts.origin, filter.origin));
    }
    if (filter.isPublic !== undefined) {
      conditions.push(eq(parts.isPublic, filter.isPublic));
    }
    if (filter.hasMpn === true) {
      conditions.push(isNotNull(parts.mpn));
    } else if (filter.hasMpn === false) {
      conditions.push(isNull(parts.mpn));
    }
    if (filter.minTrustLevel) {
      conditions.push(inArray(parts.trustLevel, trustLevelsAtOrAbove(filter.minTrustLevel)));
    }
    if (filter.text) {
      const pattern = `%${escapeLikeWildcards(filter.text)}%`;
      const textCondition = or(
        ilike(parts.title, pattern),
        ilike(parts.description, pattern),
        ilike(parts.mpn, pattern),
        ilike(parts.manufacturer, pattern),
        ilike(parts.slug, pattern),
      );
      if (textCondition) { conditions.push(textCondition); }
    }
    if (filter.tags && filter.tags.length > 0) {
      conditions.push(sql`${parts.meta} -> 'tags' @> ${JSON.stringify(filter.tags)}::jsonb`);
    }
    return conditions;
  }

  private resolveSortColumn(sortBy: PartSortField | undefined) {
    switch (sortBy) {
      case 'title': return parts.title;
      case 'createdAt': return parts.createdAt;
      case 'canonicalCategory': return parts.canonicalCategory;
      case 'trustLevel': return parts.trustLevel;
      case 'updatedAt':
      default: return parts.updatedAt;
    }
  }

  async search(filter: PartFilter, pagination?: PartPagination): Promise<Part[]> {
    try {
      const pg = { ...DEFAULT_PART_PAGINATION, ...pagination };
      const cacheKey = `parts:search:${JSON.stringify(filter)}:${pg.limit}:${pg.offset}:${pg.sortBy}:${pg.sortDir}`;
      const cached = this.cache.get<Part[]>(cacheKey);
      if (cached) { return cached; }

      const conditions = this.buildSearchConditions(filter);
      const sortCol = this.resolveSortColumn(pg.sortBy);
      const whereClause = conditions.length > 0 ? and(...(conditions as Parameters<typeof and>)) : undefined;
      const query = whereClause
        ? this.db.select().from(parts).where(whereClause)
        : this.db.select().from(parts);

      const result = await query
        .orderBy(pg.sortDir === 'asc' ? asc(sortCol) : desc(sortCol))
        .limit(pg.limit)
        .offset(pg.offset);

      this.cache.set(cacheKey, result);
      return result;
    } catch (e) {
      if (e instanceof StorageError) { throw e; }
      throw new StorageError('search', 'parts', e);
    }
  }

  async searchWithStock(
    filter: PartFilter & { projectId: number },
    pagination?: PartPagination,
  ): Promise<Array<Part & { stock: PartStock | null }>> {
    try {
      const pg = { ...DEFAULT_PART_PAGINATION, ...pagination };
      const cacheKey = `parts:searchWithStock:${JSON.stringify(filter)}:${pg.limit}:${pg.offset}:${pg.sortBy}:${pg.sortDir}`;
      const cached = this.cache.get<Array<Part & { stock: PartStock | null }>>(cacheKey);
      if (cached) { return cached; }

      const conditions = this.buildSearchConditions(filter);

      if (filter.hasStock) {
        conditions.push(isNotNull(partStock.id));
      }

      const sortCol = this.resolveSortColumn(pg.sortBy);
      const whereClause = conditions.length > 0 ? and(...(conditions as Parameters<typeof and>)) : undefined;

      const joinCondition = and(
        eq(partStock.partId, parts.id),
        eq(partStock.projectId, filter.projectId),
        isNull(partStock.deletedAt),
      );

      const baseQuery = this.db
        .select({ part: parts, stock: partStock })
        .from(parts)
        .leftJoin(partStock, joinCondition);

      const queryWithWhere = whereClause ? baseQuery.where(whereClause) : baseQuery;

      const rows = await queryWithWhere
        .orderBy(pg.sortDir === 'asc' ? asc(sortCol) : desc(sortCol))
        .limit(pg.limit)
        .offset(pg.offset);

      const result = rows.map((row) => {
        const stockRow = row.stock?.id != null ? (row.stock as PartStock) : null;
        return { ...row.part, stock: stockRow };
      });

      this.cache.set(cacheKey, result);
      return result;
    } catch (e) {
      if (e instanceof StorageError) { throw e; }
      throw new StorageError('searchWithStock', 'parts', e);
    }
  }

  async getById(id: string): Promise<Part | undefined> {
    try {
      const cacheKey = `parts:id:${id}`;
      const cached = this.cache.get<Part>(cacheKey);
      if (cached) { return cached; }
      const [row] = await this.db
        .select()
        .from(parts)
        .where(and(eq(parts.id, id), isNull(parts.deletedAt)))
        .limit(1);
      if (row) { this.cache.set(cacheKey, row); }
      return row;
    } catch (e) {
      throw new StorageError('getById', `parts/${id}`, e);
    }
  }

  async getBySlug(slug: string): Promise<Part | undefined> {
    try {
      const cacheKey = `parts:slug:${slug}`;
      const cached = this.cache.get<Part>(cacheKey);
      if (cached) { return cached; }
      const [row] = await this.db
        .select()
        .from(parts)
        .where(and(eq(parts.slug, slug), isNull(parts.deletedAt)))
        .limit(1);
      if (row) { this.cache.set(cacheKey, row); }
      return row;
    } catch (e) {
      throw new StorageError('getBySlug', `parts/slug/${slug}`, e);
    }
  }

  async getByMpn(manufacturer: string, mpn: string): Promise<Part | undefined> {
    try {
      const [row] = await this.db
        .select()
        .from(parts)
        .where(
          and(
            eq(parts.manufacturer, manufacturer),
            eq(parts.mpn, mpn),
            isNull(parts.deletedAt),
          ),
        )
        .limit(1);
      return row;
    } catch (e) {
      throw new StorageError('getByMpn', `parts/mpn/${manufacturer}/${mpn}`, e);
    }
  }

  async createPart(data: InsertPart): Promise<Part> {
    try {
      const [created] = await this.db.insert(parts).values(data).returning();
      this.cache.invalidate('parts:');
      return created;
    } catch (e) {
      throw new StorageError('createPart', 'parts', e);
    }
  }

  async updatePart(id: string, data: Partial<InsertPart>, expectedVersion?: number): Promise<Part | undefined> {
    try {
      // Optimistic concurrency: when expectedVersion is set, verify current version matches.
      if (expectedVersion !== undefined) {
        const [current] = await this.db
          .select({ version: parts.version })
          .from(parts)
          .where(and(eq(parts.id, id), isNull(parts.deletedAt)))
          .limit(1);
        if (!current) { return undefined; }
        if (current.version !== expectedVersion) {
          throw new VersionConflictError('parts', 0, current.version);
        }
      }
      const [updated] = await this.db
        .update(parts)
        .set({
          ...data,
          version: sql`${parts.version} + 1`,
          updatedAt: new Date(),
        })
        .where(and(eq(parts.id, id), isNull(parts.deletedAt)))
        .returning();
      this.cache.invalidate('parts:');
      return updated;
    } catch (e) {
      if (e instanceof VersionConflictError) { throw e; }
      throw new StorageError('updatePart', `parts/${id}`, e);
    }
  }

  async softDeletePart(id: string): Promise<boolean> {
    try {
      const [deleted] = await this.db
        .update(parts)
        .set({ deletedAt: new Date() })
        .where(and(eq(parts.id, id), isNull(parts.deletedAt)))
        .returning({ id: parts.id });
      this.cache.invalidate('parts:');
      return !!deleted;
    } catch (e) {
      throw new StorageError('softDeletePart', `parts/${id}`, e);
    }
  }

  // -------------------------------------------------------------------------
  // part_stock (per-project inventory overlay)
  // -------------------------------------------------------------------------

  async listStockForProject(projectId: number, opts?: PaginationOptions): Promise<PartStock[]> {
    try {
      const { limit = 50, offset = 0, sort = 'desc' } = opts || {};
      const cacheKey = `parts_stock:project:${projectId}:${limit}:${offset}:${sort}`;
      const cached = this.cache.get<PartStock[]>(cacheKey);
      if (cached) { return cached; }
      const result = await this.db
        .select()
        .from(partStock)
        .where(and(eq(partStock.projectId, projectId), isNull(partStock.deletedAt)))
        .orderBy(sort === 'asc' ? asc(partStock.updatedAt) : desc(partStock.updatedAt))
        .limit(limit)
        .offset(offset);
      this.cache.set(cacheKey, result);
      return result;
    } catch (e) {
      throw new StorageError('listStockForProject', `parts_stock/project/${projectId}`, e);
    }
  }

  async getStock(projectId: number, partId: string): Promise<PartStock | undefined> {
    try {
      const [row] = await this.db
        .select()
        .from(partStock)
        .where(
          and(
            eq(partStock.projectId, projectId),
            eq(partStock.partId, partId),
            isNull(partStock.deletedAt),
          ),
        )
        .limit(1);
      return row;
    } catch (e) {
      throw new StorageError('getStock', `parts_stock/${projectId}/${partId}`, e);
    }
  }

  async upsertStock(data: InsertPartStock): Promise<PartStock> {
    try {
      const existing = await this.getStock(data.projectId, data.partId);
      if (existing) {
        const [updated] = await this.db
          .update(partStock)
          .set({
            ...data,
            version: sql`${partStock.version} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(partStock.id, existing.id))
          .returning();
        this.cache.invalidate(`parts_stock:project:${data.projectId}`);
        return updated;
      }
      const [created] = await this.db.insert(partStock).values(data).returning();
      this.cache.invalidate(`parts_stock:project:${data.projectId}`);
      return created;
    } catch (e) {
      throw new StorageError('upsertStock', 'parts_stock', e);
    }
  }

  async updateStock(id: string, data: Partial<InsertPartStock>, expectedVersion?: number): Promise<PartStock | undefined> {
    try {
      if (expectedVersion !== undefined) {
        const [current] = await this.db
          .select({ version: partStock.version, projectId: partStock.projectId })
          .from(partStock)
          .where(and(eq(partStock.id, id), isNull(partStock.deletedAt)))
          .limit(1);
        if (!current) { return undefined; }
        if (current.version !== expectedVersion) {
          throw new VersionConflictError('part_stock', 0, current.version);
        }
      }
      const [updated] = await this.db
        .update(partStock)
        .set({
          ...data,
          version: sql`${partStock.version} + 1`,
          updatedAt: new Date(),
        })
        .where(and(eq(partStock.id, id), isNull(partStock.deletedAt)))
        .returning();
      if (updated) {
        this.cache.invalidate(`parts_stock:project:${updated.projectId}`);
      }
      return updated;
    } catch (e) {
      if (e instanceof VersionConflictError) { throw e; }
      throw new StorageError('updateStock', `parts_stock/${id}`, e);
    }
  }

  async deleteStock(id: string): Promise<boolean> {
    try {
      const [deleted] = await this.db
        .update(partStock)
        .set({ deletedAt: new Date() })
        .where(and(eq(partStock.id, id), isNull(partStock.deletedAt)))
        .returning({ id: partStock.id, projectId: partStock.projectId });
      if (deleted) {
        this.cache.invalidate(`parts_stock:project:${deleted.projectId}`);
      }
      return !!deleted;
    } catch (e) {
      throw new StorageError('deleteStock', `parts_stock/${id}`, e);
    }
  }

  // -------------------------------------------------------------------------
  // part_placements (where-used)
  // -------------------------------------------------------------------------

  async getPlacements(partId: string): Promise<PartPlacement[]> {
    try {
      const cacheKey = `parts_placements:part:${partId}`;
      const cached = this.cache.get<PartPlacement[]>(cacheKey);
      if (cached) { return cached; }
      const result = await this.db
        .select()
        .from(partPlacements)
        .where(and(eq(partPlacements.partId, partId), isNull(partPlacements.deletedAt)))
        .orderBy(desc(partPlacements.createdAt));
      this.cache.set(cacheKey, result);
      return result;
    } catch (e) {
      throw new StorageError('getPlacements', `parts_placements/part/${partId}`, e);
    }
  }

  async listPlacementsForContainer(containerType: string, containerId: number): Promise<PartPlacement[]> {
    try {
      const result = await this.db
        .select()
        .from(partPlacements)
        .where(
          and(
            eq(partPlacements.containerType, containerType as PartPlacement['containerType']),
            eq(partPlacements.containerId, containerId),
            isNull(partPlacements.deletedAt),
          ),
        )
        .orderBy(asc(partPlacements.referenceDesignator));
      return result;
    } catch (e) {
      throw new StorageError('listPlacementsForContainer', `parts_placements/${containerType}/${containerId}`, e);
    }
  }

  async createPlacement(data: InsertPartPlacement): Promise<PartPlacement> {
    try {
      const [created] = await this.db.insert(partPlacements).values(data).returning();
      this.cache.invalidate(`parts_placements:part:${data.partId}`);
      this.cache.invalidate(`parts_usage:${data.partId}`);
      return created;
    } catch (e) {
      throw new StorageError('createPlacement', 'parts_placements', e);
    }
  }

  async deletePlacement(id: string): Promise<boolean> {
    try {
      const [deleted] = await this.db
        .update(partPlacements)
        .set({ deletedAt: new Date() })
        .where(and(eq(partPlacements.id, id), isNull(partPlacements.deletedAt)))
        .returning({ id: partPlacements.id, partId: partPlacements.partId });
      if (deleted) {
        this.cache.invalidate(`parts_placements:part:${deleted.partId}`);
        this.cache.invalidate(`parts_usage:${deleted.partId}`);
      }
      return !!deleted;
    } catch (e) {
      throw new StorageError('deletePlacement', `parts_placements/${id}`, e);
    }
  }

  // -------------------------------------------------------------------------
  // part_lifecycle (obsolescence)
  // -------------------------------------------------------------------------

  async getLifecycle(partId: string): Promise<PartLifecycle | undefined> {
    try {
      const [row] = await this.db
        .select()
        .from(partLifecycle)
        .where(eq(partLifecycle.partId, partId))
        .limit(1);
      return row;
    } catch (e) {
      throw new StorageError('getLifecycle', `parts_lifecycle/${partId}`, e);
    }
  }

  async upsertLifecycle(data: InsertPartLifecycle): Promise<PartLifecycle> {
    try {
      const existing = await this.getLifecycle(data.partId);
      if (existing) {
        const [updated] = await this.db
          .update(partLifecycle)
          .set(data)
          .where(eq(partLifecycle.id, existing.id))
          .returning();
        return updated;
      }
      const [created] = await this.db.insert(partLifecycle).values(data).returning();
      return created;
    } catch (e) {
      throw new StorageError('upsertLifecycle', `parts_lifecycle/${data.partId}`, e);
    }
  }

  // -------------------------------------------------------------------------
  // part_spice_models
  // -------------------------------------------------------------------------

  async getSpiceModel(partId: string): Promise<PartSpiceModel | undefined> {
    try {
      const [row] = await this.db
        .select()
        .from(partSpiceModels)
        .where(eq(partSpiceModels.partId, partId))
        .limit(1);
      return row;
    } catch (e) {
      throw new StorageError('getSpiceModel', `parts_spice/${partId}`, e);
    }
  }

  async listSpiceModels(partId: string): Promise<PartSpiceModel[]> {
    try {
      const result = await this.db
        .select()
        .from(partSpiceModels)
        .where(eq(partSpiceModels.partId, partId))
        .orderBy(desc(partSpiceModels.createdAt));
      return result;
    } catch (e) {
      throw new StorageError('listSpiceModels', `parts_spice/${partId}`, e);
    }
  }

  async createSpiceModel(data: InsertPartSpiceModel): Promise<PartSpiceModel> {
    try {
      const [created] = await this.db.insert(partSpiceModels).values(data).returning();
      return created;
    } catch (e) {
      throw new StorageError('createSpiceModel', 'parts_spice', e);
    }
  }

  // -------------------------------------------------------------------------
  // part_alternates (equivalence graph)
  // -------------------------------------------------------------------------

  async getAlternates(partId: string): Promise<Part[]> {
    try {
      // Walk the alternates table and join with parts to return the alt rows directly.
      const result = await this.db
        .select({ alt: parts })
        .from(partAlternates)
        .innerJoin(parts, eq(parts.id, partAlternates.altPartId))
        .where(and(eq(partAlternates.partId, partId), isNull(parts.deletedAt)))
        .orderBy(desc(partAlternates.matchScore));
      return result.map((row) => row.alt);
    } catch (e) {
      throw new StorageError('getAlternates', `parts_alternates/${partId}`, e);
    }
  }

  async createAlternate(data: InsertPartAlternate): Promise<PartAlternate> {
    try {
      const [created] = await this.db.insert(partAlternates).values(data).returning();
      return created;
    } catch (e) {
      throw new StorageError('createAlternate', 'parts_alternates', e);
    }
  }

  async removeAlternate(partId: string, altPartId: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(partAlternates)
        .where(and(eq(partAlternates.partId, partId), eq(partAlternates.altPartId, altPartId)))
        .returning({ id: partAlternates.id });
      return result.length > 0;
    } catch (e) {
      throw new StorageError('removeAlternate', `parts_alternates/${partId}/${altPartId}`, e);
    }
  }
}
