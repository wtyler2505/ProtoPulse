import { eq, and, desc, asc, ilike, sql, count, or } from 'drizzle-orm';
import {
  historyItems, type HistoryItem, type InsertHistoryItem,
  aiActions, type AiActionRow, type InsertAiAction,
  spiceModels, type SpiceModelRow, type InsertSpiceModel,
  designPreferences, type DesignPreference, type InsertDesignPreference,
  componentLifecycle, type ComponentLifecycle, type InsertComponentLifecycle,
  designSnapshots, type DesignSnapshot, type InsertDesignSnapshot,
  designComments, type DesignComment, type InsertDesignComment,
} from '@shared/schema';
import { StorageError } from './errors';
import type { StorageDeps } from './types';
import type { PaginationOptions } from './interfaces';

export class MiscStorage {
  constructor(private deps: StorageDeps) {}

  private get db() { return this.deps.db; }

  // --- History Items ---

  async getHistoryItems(projectId: number, opts?: PaginationOptions): Promise<HistoryItem[]> {
    const { limit = 50, offset = 0, sort = 'desc' } = opts || {};
    return this.db.select().from(historyItems)
      .where(eq(historyItems.projectId, projectId))
      .orderBy(sort === 'desc' ? desc(historyItems.timestamp) : asc(historyItems.timestamp))
      .limit(limit)
      .offset(offset);
  }

  async createHistoryItem(item: InsertHistoryItem): Promise<HistoryItem> {
    const [created] = await this.db.insert(historyItems).values(item).returning();
    return created;
  }

  async deleteHistoryItems(projectId: number): Promise<void> {
    await this.db.delete(historyItems).where(eq(historyItems.projectId, projectId));
  }

  async deleteHistoryItem(id: number, projectId: number): Promise<boolean> {
    const result = await this.db.delete(historyItems)
      .where(and(eq(historyItems.id, id), eq(historyItems.projectId, projectId)))
      .returning();
    return result.length > 0;
  }

  // --- AI Action Log ---

  async getAiActions(projectId: number): Promise<AiActionRow[]> {
    try {
      return await this.db.select()
        .from(aiActions)
        .where(eq(aiActions.projectId, projectId))
        .orderBy(desc(aiActions.createdAt));
    } catch (e) {
      throw new StorageError('getAiActions', `projects/${projectId}/actions`, e);
    }
  }

  async getAiActionsByMessage(chatMessageId: string): Promise<AiActionRow[]> {
    try {
      return await this.db.select()
        .from(aiActions)
        .where(eq(aiActions.chatMessageId, chatMessageId))
        .orderBy(asc(aiActions.createdAt));
    } catch (e) {
      throw new StorageError('getAiActionsByMessage', `messages/${chatMessageId}/actions`, e);
    }
  }

  async createAiAction(data: InsertAiAction): Promise<AiActionRow> {
    try {
      const [action] = await this.db.insert(aiActions)
        .values(data)
        .returning();
      return action;
    } catch (e) {
      throw new StorageError('createAiAction', `projects/${data.projectId}/actions`, e);
    }
  }

  // --- Design Preferences (FG-24) ---

  async getDesignPreferences(projectId: number): Promise<DesignPreference[]> {
    try {
      return await this.db.select()
        .from(designPreferences)
        .where(eq(designPreferences.projectId, projectId))
        .orderBy(asc(designPreferences.category), asc(designPreferences.key));
    } catch (e) {
      throw new StorageError('getDesignPreferences', `projects/${projectId}/preferences`, e);
    }
  }

  async upsertDesignPreference(data: InsertDesignPreference): Promise<DesignPreference> {
    try {
      const [result] = await this.db.insert(designPreferences)
        .values(data)
        .onConflictDoUpdate({
          target: [designPreferences.projectId, designPreferences.category, designPreferences.key],
          set: {
            value: data.value,
            source: data.source,
            confidence: data.confidence,
            updatedAt: new Date(),
          },
        })
        .returning();
      return result;
    } catch (e) {
      throw new StorageError('upsertDesignPreference', `projects/${data.projectId}/preferences`, e);
    }
  }

  async deleteDesignPreference(id: number): Promise<boolean> {
    try {
      const result = await this.db.delete(designPreferences)
        .where(eq(designPreferences.id, id))
        .returning();
      return result.length > 0;
    } catch (e) {
      throw new StorageError('deleteDesignPreference', `design-preferences/${id}`, e);
    }
  }

  // --- SPICE Model Library (EN-24) ---

  async getSpiceModels(opts?: { category?: string; search?: string; limit?: number; offset?: number }): Promise<{ models: SpiceModelRow[]; total: number }> {
    try {
      const conditions = [];

      if (opts?.category) {
        conditions.push(eq(spiceModels.category, opts.category));
      }

      if (opts?.search) {
        conditions.push(
          or(
            ilike(spiceModels.name, `%${opts.search}%`),
            ilike(spiceModels.description, `%${opts.search}%`),
          )!,
        );
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [totalResult] = await this.db.select({ value: count() })
        .from(spiceModels)
        .where(where);
      const total = totalResult?.value ?? 0;

      const limit = opts?.limit ?? 50;
      const offset = opts?.offset ?? 0;

      const models = await this.db.select()
        .from(spiceModels)
        .where(where)
        .orderBy(asc(spiceModels.category), asc(spiceModels.name))
        .limit(limit)
        .offset(offset);

      return { models, total };
    } catch (e) {
      throw new StorageError('getSpiceModels', 'spice-models', e);
    }
  }

  async getSpiceModel(id: number): Promise<SpiceModelRow | undefined> {
    try {
      const [model] = await this.db.select()
        .from(spiceModels)
        .where(eq(spiceModels.id, id));
      return model;
    } catch (e) {
      throw new StorageError('getSpiceModel', `spice-models/${id}`, e);
    }
  }

  async createSpiceModel(model: InsertSpiceModel): Promise<SpiceModelRow> {
    try {
      const [created] = await this.db.insert(spiceModels)
        .values(model)
        .returning();
      return created;
    } catch (e) {
      throw new StorageError('createSpiceModel', 'spice-models', e);
    }
  }

  // --- Component Lifecycle (FG-32) ---

  async getComponentLifecycles(projectId: number): Promise<ComponentLifecycle[]> {
    try {
      return await this.db.select()
        .from(componentLifecycle)
        .where(eq(componentLifecycle.projectId, projectId))
        .orderBy(asc(componentLifecycle.partNumber));
    } catch (e) {
      throw new StorageError('getComponentLifecycles', `projects/${projectId}/lifecycle`, e);
    }
  }

  async getComponentLifecycle(id: number): Promise<ComponentLifecycle | undefined> {
    try {
      const [entry] = await this.db.select()
        .from(componentLifecycle)
        .where(eq(componentLifecycle.id, id));
      return entry;
    } catch (e) {
      throw new StorageError('getComponentLifecycle', `component-lifecycle/${id}`, e);
    }
  }

  async upsertComponentLifecycle(data: InsertComponentLifecycle): Promise<ComponentLifecycle> {
    try {
      const [result] = await this.db.insert(componentLifecycle)
        .values(data)
        .onConflictDoNothing()
        .returning();
      if (result) {
        return result;
      }
      const [updated] = await this.db.update(componentLifecycle)
        .set({ ...data, updatedAt: new Date() })
        .where(
          and(
            eq(componentLifecycle.projectId, data.projectId),
            eq(componentLifecycle.partNumber, data.partNumber),
          ),
        )
        .returning();
      return updated;
    } catch (e) {
      throw new StorageError('upsertComponentLifecycle', `projects/${data.projectId}/lifecycle`, e);
    }
  }

  async deleteComponentLifecycle(id: number): Promise<boolean> {
    try {
      const result = await this.db.delete(componentLifecycle)
        .where(eq(componentLifecycle.id, id))
        .returning();
      return result.length > 0;
    } catch (e) {
      throw new StorageError('deleteComponentLifecycle', `component-lifecycle/${id}`, e);
    }
  }

  // --- Design Snapshots (IN-07) ---

  async getDesignSnapshots(projectId: number): Promise<DesignSnapshot[]> {
    try {
      return await this.db.select().from(designSnapshots)
        .where(eq(designSnapshots.projectId, projectId))
        .orderBy(desc(designSnapshots.createdAt));
    } catch (e) {
      throw new StorageError('getDesignSnapshots', `projects/${projectId}/snapshots`, e);
    }
  }

  async getDesignSnapshot(id: number): Promise<DesignSnapshot | undefined> {
    try {
      const [snapshot] = await this.db.select().from(designSnapshots)
        .where(eq(designSnapshots.id, id));
      return snapshot;
    } catch (e) {
      throw new StorageError('getDesignSnapshot', `design-snapshots/${id}`, e);
    }
  }

  async createDesignSnapshot(data: InsertDesignSnapshot): Promise<DesignSnapshot> {
    try {
      const [snapshot] = await this.db.insert(designSnapshots)
        .values(data)
        .returning();
      return snapshot;
    } catch (e) {
      throw new StorageError('createDesignSnapshot', `projects/${data.projectId}/snapshots`, e);
    }
  }

  async deleteDesignSnapshot(id: number): Promise<boolean> {
    try {
      const [deleted] = await this.db.delete(designSnapshots)
        .where(eq(designSnapshots.id, id))
        .returning();
      return !!deleted;
    } catch (e) {
      throw new StorageError('deleteDesignSnapshot', `design-snapshots/${id}`, e);
    }
  }

  // --- Design Comments (FG-12) ---

  async getComments(projectId: number, filters?: { targetType?: string; targetId?: string; resolved?: boolean }): Promise<DesignComment[]> {
    try {
      const conditions = [eq(designComments.projectId, projectId)];

      if (filters?.targetType) {
        conditions.push(eq(designComments.targetType, filters.targetType));
      }
      if (filters?.targetId) {
        conditions.push(eq(designComments.targetId, filters.targetId));
      }
      if (filters?.resolved !== undefined) {
        conditions.push(eq(designComments.resolved, filters.resolved));
      }

      return await this.db.select()
        .from(designComments)
        .where(and(...conditions))
        .orderBy(asc(designComments.createdAt));
    } catch (e) {
      throw new StorageError('getComments', `projects/${projectId}/comments`, e);
    }
  }

  async getComment(id: number): Promise<DesignComment | undefined> {
    try {
      const [comment] = await this.db.select()
        .from(designComments)
        .where(eq(designComments.id, id));
      return comment;
    } catch (e) {
      throw new StorageError('getComment', `comments/${id}`, e);
    }
  }

  async createComment(data: InsertDesignComment): Promise<DesignComment> {
    try {
      const [created] = await this.db.insert(designComments)
        .values(data)
        .returning();
      return created;
    } catch (e) {
      throw new StorageError('createComment', `projects/${data.projectId}/comments`, e);
    }
  }

  async updateComment(id: number, data: { content?: string }): Promise<DesignComment | undefined> {
    try {
      const [updated] = await this.db.update(designComments)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(designComments.id, id))
        .returning();
      return updated;
    } catch (e) {
      throw new StorageError('updateComment', `comments/${id}`, e);
    }
  }

  async resolveComment(id: number, resolvedBy?: number): Promise<DesignComment | undefined> {
    try {
      const [resolved] = await this.db.update(designComments)
        .set({
          resolved: true,
          resolvedBy: resolvedBy ?? null,
          resolvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(designComments.id, id))
        .returning();
      return resolved;
    } catch (e) {
      throw new StorageError('resolveComment', `comments/${id}`, e);
    }
  }

  async unresolveComment(id: number): Promise<DesignComment | undefined> {
    try {
      const [unresolved] = await this.db.update(designComments)
        .set({
          resolved: false,
          resolvedBy: null,
          resolvedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(designComments.id, id))
        .returning();
      return unresolved;
    } catch (e) {
      throw new StorageError('unresolveComment', `comments/${id}`, e);
    }
  }

  async deleteComment(id: number): Promise<boolean> {
    try {
      const [deleted] = await this.db.delete(designComments)
        .where(eq(designComments.id, id))
        .returning();
      return !!deleted;
    } catch (e) {
      throw new StorageError('deleteComment', `comments/${id}`, e);
    }
  }
}
