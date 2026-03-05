import { eq, and, desc, asc, isNull, isNotNull, count, sql } from 'drizzle-orm';
import {
  chatMessages, type ChatMessage, type InsertChatMessage,
} from '@shared/schema';
import { StorageError } from './errors';
import type { StorageDeps } from './types';
import type { PaginationOptions } from './interfaces';

export class ChatStorage {
  constructor(private deps: StorageDeps) {}

  private get db() { return this.deps.db; }

  async getChatMessages(projectId: number, opts?: PaginationOptions & { branchId?: string | null }): Promise<ChatMessage[]> {
    const { limit = 50, offset = 0, sort = 'desc', branchId } = opts || {};
    const conditions = [eq(chatMessages.projectId, projectId)];
    if (branchId !== undefined) {
      if (branchId === null) {
        conditions.push(isNull(chatMessages.branchId));
      } else {
        conditions.push(eq(chatMessages.branchId, branchId));
      }
    }
    return this.db.select().from(chatMessages)
      .where(and(...conditions))
      .orderBy(sort === 'desc' ? desc(chatMessages.timestamp) : asc(chatMessages.timestamp))
      .limit(limit)
      .offset(offset);
  }

  async createChatMessage(msg: InsertChatMessage): Promise<ChatMessage> {
    const [created] = await this.db.insert(chatMessages).values(msg).returning();
    return created;
  }

  async deleteChatMessages(projectId: number): Promise<void> {
    await this.db.delete(chatMessages).where(eq(chatMessages.projectId, projectId));
  }

  async deleteChatMessage(id: number, projectId: number): Promise<boolean> {
    const result = await this.db.delete(chatMessages)
      .where(and(eq(chatMessages.id, id), eq(chatMessages.projectId, projectId)))
      .returning();
    return result.length > 0;
  }

  async createChatBranch(projectId: number, parentMessageId: number): Promise<{ branchId: string; parentMessageId: number }> {
    const [parent] = await this.db.select().from(chatMessages)
      .where(and(eq(chatMessages.id, parentMessageId), eq(chatMessages.projectId, projectId)));
    if (!parent) {
      throw new StorageError('createChatBranch', `projects/${projectId}/chat/${parentMessageId}`,
        new Error('Parent message not found'));
    }
    const branchId = crypto.randomUUID();
    return { branchId, parentMessageId };
  }

  async getChatBranches(projectId: number): Promise<Array<{ branchId: string; parentMessageId: number | null; messageCount: number; createdAt: Date | null }>> {
    const rows = await this.db.select({
      branchId: chatMessages.branchId,
      parentMessageId: chatMessages.parentMessageId,
      messageCount: count(chatMessages.id),
      createdAt: sql<Date | null>`min(${chatMessages.timestamp})`,
    }).from(chatMessages)
      .where(and(eq(chatMessages.projectId, projectId), isNotNull(chatMessages.branchId)))
      .groupBy(chatMessages.branchId, chatMessages.parentMessageId);

    return rows.filter((r): r is typeof r & { branchId: string } => r.branchId !== null)
      .map((r) => ({
        branchId: r.branchId,
        parentMessageId: r.parentMessageId,
        messageCount: Number(r.messageCount),
        createdAt: r.createdAt,
      }));
  }
}
