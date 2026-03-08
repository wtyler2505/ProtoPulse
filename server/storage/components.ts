import { eq, and, desc, asc, ilike, sql, count, or } from 'drizzle-orm';
import {
  componentParts, type ComponentPart, type InsertComponentPart,
  componentLibrary, type ComponentLibraryEntry, type InsertComponentLibrary,
  userChatSettings, type UserChatSettings, type InsertUserChatSettings,
} from '@shared/schema';
import { StorageError } from './errors';
import { escapeLikeWildcards } from './utils';

import type { StorageDeps } from './types';

export class ComponentStorage {
  constructor(private deps: StorageDeps) {}

  private get db() { return this.deps.db; }
  private get cache() { return this.deps.cache; }

  async getComponentParts(projectId: number): Promise<ComponentPart[]> {
    try {
      const cacheKey = `parts:${projectId}`;
      const cached = this.cache.get<ComponentPart[]>(cacheKey);
      if (cached) { return cached; }
      const result = await this.db.select().from(componentParts)
        .where(eq(componentParts.projectId, projectId))
        .orderBy(asc(componentParts.id));
      this.cache.set(cacheKey, result);
      return result;
    } catch (e) {
      throw new StorageError('getComponentParts', `projects/${projectId}/component-parts`, e);
    }
  }

  async getComponentPart(id: number, projectId: number): Promise<ComponentPart | undefined> {
    try {
      const [part] = await this.db.select().from(componentParts)
        .where(and(eq(componentParts.id, id), eq(componentParts.projectId, projectId)));
      return part;
    } catch (e) {
      throw new StorageError('getComponentPart', `component-parts/${id}`, e);
    }
  }

  async getComponentPartByNodeId(projectId: number, nodeId: string): Promise<ComponentPart | undefined> {
    try {
      const [part] = await this.db.select().from(componentParts)
        .where(and(eq(componentParts.projectId, projectId), eq(componentParts.nodeId, nodeId)));
      return part;
    } catch (e) {
      throw new StorageError('getComponentPartByNodeId', `component-parts/node/${nodeId}`, e);
    }
  }

  async createComponentPart(part: InsertComponentPart): Promise<ComponentPart> {
    try {
      const [created] = await this.db.insert(componentParts).values(part).returning();
      this.cache.invalidate(`parts:${part.projectId}`);
      return created;
    } catch (e) {
      throw new StorageError('createComponentPart', 'component-parts', e);
    }
  }

  async updateComponentPart(id: number, projectId: number, data: Partial<InsertComponentPart>): Promise<ComponentPart | undefined> {
    try {
      const safeData = { ...data };
      delete safeData.projectId;
      const updated = await this.db.transaction(async (tx) => {
        const [existing] = await tx.select().from(componentParts)
          .where(and(eq(componentParts.id, id), eq(componentParts.projectId, projectId)));
        if (!existing) { return undefined; }
        const [result] = await tx.update(componentParts)
          .set({ ...safeData, version: existing.version + 1, updatedAt: new Date() })
          .where(and(eq(componentParts.id, id), eq(componentParts.projectId, projectId)))
          .returning();
        return result;
      });
      if (updated) { this.cache.invalidate(`parts:${projectId}`); }
      return updated;
    } catch (e) {
      throw new StorageError('updateComponentPart', `component-parts/${id}`, e);
    }
  }

  async deleteComponentPart(id: number, projectId: number): Promise<boolean> {
    try {
      const result = await this.db.delete(componentParts)
        .where(and(eq(componentParts.id, id), eq(componentParts.projectId, projectId)))
        .returning();
      if (result.length > 0) { this.cache.invalidate(`parts:${projectId}`); }
      return result.length > 0;
    } catch (e) {
      throw new StorageError('deleteComponentPart', `component-parts/${id}`, e);
    }
  }

  async getLibraryEntries(opts?: { search?: string; category?: string; page?: number; limit?: number }): Promise<{ entries: ComponentLibraryEntry[]; total: number }> {
    try {
      const { search, category, page = 1, limit = 20 } = opts || {};
      const offset = (page - 1) * limit;

      const conditions = [eq(componentLibrary.isPublic, true)];
      if (category) {
        conditions.push(eq(componentLibrary.category, category));
      }
      if (search) {
        const escaped = escapeLikeWildcards(search);
        conditions.push(
          or(
            ilike(componentLibrary.title, `%${escaped}%`),
            sql`EXISTS (SELECT 1 FROM unnest(${componentLibrary.tags}) AS t WHERE t ILIKE ${'%' + escaped + '%'})`,
          )!,
        );
      }

      const whereClause = and(...conditions);

      const [entries, [{ total }]] = await Promise.all([
        this.db.select().from(componentLibrary)
          .where(whereClause)
          .orderBy(desc(componentLibrary.downloadCount), desc(componentLibrary.createdAt))
          .limit(limit)
          .offset(offset),
        this.db.select({ total: count() }).from(componentLibrary)
          .where(whereClause),
      ]);

      return { entries, total };
    } catch (e) {
      throw new StorageError('getLibraryEntries', 'componentLibrary', e);
    }
  }

  async getLibraryEntry(id: number): Promise<ComponentLibraryEntry | undefined> {
    try {
      const [entry] = await this.db.select().from(componentLibrary).where(eq(componentLibrary.id, id));
      return entry;
    } catch (e) {
      throw new StorageError('getLibraryEntry', `componentLibrary/${id}`, e);
    }
  }

  async createLibraryEntry(entry: InsertComponentLibrary): Promise<ComponentLibraryEntry> {
    try {
      const [created] = await this.db.insert(componentLibrary).values(entry).returning();
      return created;
    } catch (e) {
      throw new StorageError('createLibraryEntry', 'componentLibrary', e);
    }
  }

  async updateLibraryEntry(id: number, data: Partial<InsertComponentLibrary>): Promise<ComponentLibraryEntry | undefined> {
    try {
      const [updated] = await this.db.update(componentLibrary)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(componentLibrary.id, id))
        .returning();
      return updated;
    } catch (e) {
      throw new StorageError('updateLibraryEntry', `componentLibrary/${id}`, e);
    }
  }

  async deleteLibraryEntry(id: number): Promise<boolean> {
    try {
      const result = await this.db.delete(componentLibrary)
        .where(eq(componentLibrary.id, id))
        .returning();
      return result.length > 0;
    } catch (e) {
      throw new StorageError('deleteLibraryEntry', `componentLibrary/${id}`, e);
    }
  }

  async incrementLibraryDownloads(id: number): Promise<void> {
    try {
      await this.db.update(componentLibrary)
        .set({ downloadCount: sql`${componentLibrary.downloadCount} + 1` })
        .where(eq(componentLibrary.id, id));
    } catch (e) {
      throw new StorageError('incrementLibraryDownloads', `componentLibrary/${id}`, e);
    }
  }

  async getChatSettings(userId: number): Promise<UserChatSettings | undefined> {
    try {
      const [settings] = await this.db.select().from(userChatSettings)
        .where(eq(userChatSettings.userId, userId));
      return settings;
    } catch (e) {
      throw new StorageError('getChatSettings', `user/${userId}/chat-settings`, e);
    }
  }

  async upsertChatSettings(userId: number, settings: Partial<InsertUserChatSettings>): Promise<UserChatSettings> {
    try {
      const [result] = await this.db.insert(userChatSettings)
        .values({ userId, ...settings })
        .onConflictDoUpdate({
          target: userChatSettings.userId,
          set: { ...settings, updatedAt: new Date() },
        })
        .returning();
      return result;
    } catch (e) {
      throw new StorageError('upsertChatSettings', `user/${userId}/chat-settings`, e);
    }
  }
}
