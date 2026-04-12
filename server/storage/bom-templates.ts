/**
 * BomTemplateStorage — save and load reusable BOM part sets.
 *
 * Templates store a set of part references with default quantities and pricing.
 * Users can "save as template" from any project's BOM, and "load template" to
 * populate a new project's part_stock rows.
 */

import { and, eq, isNull, desc, sql } from 'drizzle-orm';
import {
  bomTemplates,
  bomTemplateItems,
  parts,
  type InsertBomTemplate,
  type BomTemplate,
  type InsertBomTemplateItem,
  type BomTemplateItem,
} from '@shared/schema';
import type { StorageDeps } from './types';
import { StorageError } from './errors';

export interface TemplateWithItems extends BomTemplate {
  items: Array<BomTemplateItem & { partTitle: string; partMpn: string | null }>;
}

export class BomTemplateStorage {
  private db: StorageDeps['db'];
  private cache: StorageDeps['cache'];

  constructor(deps: StorageDeps) {
    this.db = deps.db;
    this.cache = deps.cache;
  }

  async createTemplate(data: InsertBomTemplate): Promise<BomTemplate> {
    try {
      const [created] = await this.db.insert(bomTemplates).values(data).returning();
      this.cache.invalidate(`bom_templates:user:${data.userId}`);
      return created;
    } catch (e) {
      throw new StorageError('createTemplate', 'bom_templates', e);
    }
  }

  async addItems(templateId: string, items: Omit<InsertBomTemplateItem, 'templateId'>[]): Promise<number> {
    if (items.length === 0) { return 0; }
    try {
      const rows = items.map((item) => ({ ...item, templateId }));
      const created = await this.db.insert(bomTemplateItems).values(rows).returning({ id: bomTemplateItems.id });
      this.cache.invalidate(`bom_templates:detail:${templateId}`);
      return created.length;
    } catch (e) {
      throw new StorageError('addItems', `bom_template_items/${templateId}`, e);
    }
  }

  async getTemplates(userId: number): Promise<BomTemplate[]> {
    try {
      const cacheKey = `bom_templates:user:${userId}`;
      const cached = this.cache.get<BomTemplate[]>(cacheKey);
      if (cached) { return cached; }

      const result = await this.db
        .select()
        .from(bomTemplates)
        .where(and(eq(bomTemplates.userId, userId), isNull(bomTemplates.deletedAt)))
        .orderBy(desc(bomTemplates.updatedAt));

      this.cache.set(cacheKey, result);
      return result;
    } catch (e) {
      throw new StorageError('getTemplates', 'bom_templates', e);
    }
  }

  async getTemplateWithItems(templateId: string): Promise<TemplateWithItems | null> {
    try {
      const cacheKey = `bom_templates:detail:${templateId}`;
      const cached = this.cache.get<TemplateWithItems>(cacheKey);
      if (cached) { return cached; }

      const [template] = await this.db
        .select()
        .from(bomTemplates)
        .where(and(eq(bomTemplates.id, templateId), isNull(bomTemplates.deletedAt)));

      if (!template) { return null; }

      const items = await this.db
        .select({
          item: bomTemplateItems,
          partTitle: parts.title,
          partMpn: parts.mpn,
        })
        .from(bomTemplateItems)
        .innerJoin(parts, eq(parts.id, bomTemplateItems.partId))
        .where(eq(bomTemplateItems.templateId, templateId));

      const result: TemplateWithItems = {
        ...template,
        items: items.map((row) => ({
          ...row.item,
          partTitle: row.partTitle,
          partMpn: row.partMpn,
        })),
      };

      this.cache.set(cacheKey, result);
      return result;
    } catch (e) {
      throw new StorageError('getTemplateWithItems', `bom_templates/${templateId}`, e);
    }
  }

  async deleteTemplate(templateId: string, userId: number): Promise<boolean> {
    try {
      const [deleted] = await this.db
        .update(bomTemplates)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(bomTemplates.id, templateId),
            eq(bomTemplates.userId, userId),
            isNull(bomTemplates.deletedAt),
          ),
        )
        .returning({ id: bomTemplates.id });

      if (deleted) {
        this.cache.invalidate(`bom_templates:user:${userId}`);
        this.cache.invalidate(`bom_templates:detail:${templateId}`);
      }
      return !!deleted;
    } catch (e) {
      throw new StorageError('deleteTemplate', `bom_templates/${templateId}`, e);
    }
  }

  async updateTemplate(
    templateId: string,
    userId: number,
    updates: { name?: string; description?: string; tags?: string[] },
  ): Promise<BomTemplate | null> {
    try {
      const [updated] = await this.db
        .update(bomTemplates)
        .set({ ...updates, updatedAt: new Date() })
        .where(
          and(
            eq(bomTemplates.id, templateId),
            eq(bomTemplates.userId, userId),
            isNull(bomTemplates.deletedAt),
          ),
        )
        .returning();

      if (updated) {
        this.cache.invalidate(`bom_templates:user:${userId}`);
        this.cache.invalidate(`bom_templates:detail:${templateId}`);
      }
      return updated ?? null;
    } catch (e) {
      throw new StorageError('updateTemplate', `bom_templates/${templateId}`, e);
    }
  }
}
