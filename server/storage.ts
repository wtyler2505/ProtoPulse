import { eq, and, desc, asc } from "drizzle-orm";
import { db } from "./db";
import {
  projects, type Project, type InsertProject,
  architectureNodes, type ArchitectureNode, type InsertArchitectureNode,
  architectureEdges, type ArchitectureEdge, type InsertArchitectureEdge,
  bomItems, type BomItem, type InsertBomItem,
  validationIssues, type ValidationIssue, type InsertValidationIssue,
  chatMessages, type ChatMessage, type InsertChatMessage,
  historyItems, type HistoryItem, type InsertHistoryItem,
} from "@shared/schema";

export interface PaginationOptions {
  limit: number;
  offset: number;
  sort: 'asc' | 'desc';
}

export class StorageError extends Error {
  constructor(operation: string, entity: string, cause?: unknown) {
    const causeMsg = cause instanceof Error ? cause.message : String(cause);
    super(`Storage.${operation}(${entity}) failed: ${causeMsg}`);
    this.name = 'StorageError';
    if (cause instanceof Error) this.stack = cause.stack;
  }
}

export interface IStorage {
  getProjects(opts?: PaginationOptions): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, data: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<boolean>;

  getNodes(projectId: number, opts?: PaginationOptions): Promise<ArchitectureNode[]>;
  createNode(node: InsertArchitectureNode): Promise<ArchitectureNode>;
  updateNode(id: number, projectId: number, data: Partial<InsertArchitectureNode>): Promise<ArchitectureNode | undefined>;
  deleteNodesByProject(projectId: number): Promise<void>;
  bulkCreateNodes(nodes: InsertArchitectureNode[]): Promise<ArchitectureNode[]>;

  getEdges(projectId: number, opts?: PaginationOptions): Promise<ArchitectureEdge[]>;
  createEdge(edge: InsertArchitectureEdge): Promise<ArchitectureEdge>;
  updateEdge(id: number, projectId: number, data: Partial<InsertArchitectureEdge>): Promise<ArchitectureEdge | undefined>;
  deleteEdgesByProject(projectId: number): Promise<void>;
  bulkCreateEdges(edges: InsertArchitectureEdge[]): Promise<ArchitectureEdge[]>;

  replaceNodes(projectId: number, nodes: InsertArchitectureNode[]): Promise<ArchitectureNode[]>;
  replaceEdges(projectId: number, edges: InsertArchitectureEdge[]): Promise<ArchitectureEdge[]>;
  replaceValidationIssues(projectId: number, issues: InsertValidationIssue[]): Promise<ValidationIssue[]>;

  getBomItems(projectId: number, opts?: PaginationOptions): Promise<BomItem[]>;
  getBomItem(id: number, projectId: number): Promise<BomItem | undefined>;
  createBomItem(item: InsertBomItem): Promise<BomItem>;
  updateBomItem(id: number, projectId: number, item: Partial<InsertBomItem>): Promise<BomItem | undefined>;
  deleteBomItem(id: number, projectId: number): Promise<boolean>;

  getValidationIssues(projectId: number, opts?: PaginationOptions): Promise<ValidationIssue[]>;
  createValidationIssue(issue: InsertValidationIssue): Promise<ValidationIssue>;
  deleteValidationIssue(id: number, projectId: number): Promise<boolean>;
  deleteValidationIssuesByProject(projectId: number): Promise<void>;
  bulkCreateValidationIssues(issues: InsertValidationIssue[]): Promise<ValidationIssue[]>;

  getChatMessages(projectId: number, opts?: PaginationOptions): Promise<ChatMessage[]>;
  createChatMessage(msg: InsertChatMessage): Promise<ChatMessage>;
  deleteChatMessages(projectId: number): Promise<void>;
  deleteChatMessage(id: number, projectId: number): Promise<boolean>;

  getHistoryItems(projectId: number, opts?: PaginationOptions): Promise<HistoryItem[]>;
  createHistoryItem(item: InsertHistoryItem): Promise<HistoryItem>;
  deleteHistoryItems(projectId: number): Promise<void>;
  deleteHistoryItem(id: number, projectId: number): Promise<boolean>;
}

function computeTotalPrice(quantity: number, unitPrice: string | number): string {
  return String((quantity * parseFloat(String(unitPrice))).toFixed(4));
}

export class DatabaseStorage implements IStorage {
  private async chunkedInsert<T extends Record<string, unknown>, R>(
    table: any,
    items: T[],
    chunkSize = 100
  ): Promise<R[]> {
    if (items.length <= chunkSize) {
      return db.insert(table).values(items).returning() as Promise<R[]>;
    }
    const results: R[] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const inserted = await db.insert(table).values(chunk).returning();
      results.push(...(inserted as R[]));
    }
    return results;
  }

  async getProjects(opts?: PaginationOptions): Promise<Project[]> {
    try {
      const { limit = 50, offset = 0, sort = 'desc' } = opts || {};
      return await db.select().from(projects)
        .orderBy(sort === 'desc' ? desc(projects.id) : asc(projects.id))
        .limit(limit)
        .offset(offset);
    } catch (e) {
      throw new StorageError('getProjects', 'projects', e);
    }
  }

  async getProject(id: number): Promise<Project | undefined> {
    try {
      const [project] = await db.select().from(projects).where(eq(projects.id, id));
      return project;
    } catch (e) {
      throw new StorageError('getProject', `projects/${id}`, e);
    }
  }

  async createProject(project: InsertProject): Promise<Project> {
    try {
      const [created] = await db.insert(projects).values(project).returning();
      return created;
    } catch (e) {
      throw new StorageError('createProject', 'projects', e);
    }
  }

  async updateProject(id: number, data: Partial<InsertProject>): Promise<Project | undefined> {
    try {
      const [updated] = await db.update(projects).set({ ...data, updatedAt: new Date() }).where(eq(projects.id, id)).returning();
      return updated;
    } catch (e) {
      throw new StorageError('updateProject', `projects/${id}`, e);
    }
  }

  async deleteProject(id: number): Promise<boolean> {
    try {
      const result = await db.delete(projects).where(eq(projects.id, id)).returning();
      return result.length > 0;
    } catch (e) {
      throw new StorageError('deleteProject', `projects/${id}`, e);
    }
  }

  async getNodes(projectId: number, opts?: PaginationOptions): Promise<ArchitectureNode[]> {
    try {
      const { limit = 50, offset = 0, sort = 'desc' } = opts || {};
      return await db.select().from(architectureNodes)
        .where(eq(architectureNodes.projectId, projectId))
        .orderBy(sort === 'desc' ? desc(architectureNodes.id) : asc(architectureNodes.id))
        .limit(limit)
        .offset(offset);
    } catch (e) {
      throw new StorageError('getNodes', `projects/${projectId}/nodes`, e);
    }
  }

  async createNode(node: InsertArchitectureNode): Promise<ArchitectureNode> {
    try {
      const [created] = await db.insert(architectureNodes).values(node).returning();
      return created;
    } catch (e) {
      throw new StorageError('createNode', 'nodes', e);
    }
  }

  async updateNode(id: number, projectId: number, data: Partial<InsertArchitectureNode>): Promise<ArchitectureNode | undefined> {
    try {
      const { projectId: _ignoreProjectId, ...safeData } = data as any;
      const [updated] = await db.update(architectureNodes)
        .set({ ...safeData, updatedAt: new Date() })
        .where(and(eq(architectureNodes.id, id), eq(architectureNodes.projectId, projectId)))
        .returning();
      return updated;
    } catch (e) {
      throw new StorageError('updateNode', `nodes/${id}`, e);
    }
  }

  async deleteNodesByProject(projectId: number): Promise<void> {
    await db.delete(architectureNodes).where(eq(architectureNodes.projectId, projectId));
  }

  async bulkCreateNodes(nodes: InsertArchitectureNode[]): Promise<ArchitectureNode[]> {
    if (nodes.length === 0) return [];
    try {
      return await this.chunkedInsert<any, ArchitectureNode>(architectureNodes, nodes);
    } catch (e) {
      throw new StorageError('bulkCreateNodes', 'nodes', e);
    }
  }

  async getEdges(projectId: number, opts?: PaginationOptions): Promise<ArchitectureEdge[]> {
    try {
      const { limit = 50, offset = 0, sort = 'desc' } = opts || {};
      return await db.select().from(architectureEdges)
        .where(eq(architectureEdges.projectId, projectId))
        .orderBy(sort === 'desc' ? desc(architectureEdges.id) : asc(architectureEdges.id))
        .limit(limit)
        .offset(offset);
    } catch (e) {
      throw new StorageError('getEdges', `projects/${projectId}/edges`, e);
    }
  }

  async createEdge(edge: InsertArchitectureEdge): Promise<ArchitectureEdge> {
    try {
      const [created] = await db.insert(architectureEdges).values(edge).returning();
      return created;
    } catch (e) {
      throw new StorageError('createEdge', 'edges', e);
    }
  }

  async updateEdge(id: number, projectId: number, data: Partial<InsertArchitectureEdge>): Promise<ArchitectureEdge | undefined> {
    try {
      const { projectId: _ignoreProjectId, ...safeData } = data as any;
      const [updated] = await db.update(architectureEdges)
        .set(safeData)
        .where(and(eq(architectureEdges.id, id), eq(architectureEdges.projectId, projectId)))
        .returning();
      return updated;
    } catch (e) {
      throw new StorageError('updateEdge', `edges/${id}`, e);
    }
  }

  async deleteEdgesByProject(projectId: number): Promise<void> {
    await db.delete(architectureEdges).where(eq(architectureEdges.projectId, projectId));
  }

  async bulkCreateEdges(edges: InsertArchitectureEdge[]): Promise<ArchitectureEdge[]> {
    if (edges.length === 0) return [];
    try {
      return await this.chunkedInsert<any, ArchitectureEdge>(architectureEdges, edges);
    } catch (e) {
      throw new StorageError('bulkCreateEdges', 'edges', e);
    }
  }

  async getBomItems(projectId: number, opts?: PaginationOptions): Promise<BomItem[]> {
    try {
      const { limit = 50, offset = 0, sort = 'desc' } = opts || {};
      return await db.select().from(bomItems)
        .where(eq(bomItems.projectId, projectId))
        .orderBy(sort === 'desc' ? desc(bomItems.id) : asc(bomItems.id))
        .limit(limit)
        .offset(offset);
    } catch (e) {
      throw new StorageError('getBomItems', `projects/${projectId}/bom`, e);
    }
  }

  async getBomItem(id: number, projectId: number): Promise<BomItem | undefined> {
    try {
      const [item] = await db.select().from(bomItems).where(and(eq(bomItems.id, id), eq(bomItems.projectId, projectId)));
      return item;
    } catch (e) {
      throw new StorageError('getBomItem', `bom/${id}`, e);
    }
  }

  async createBomItem(item: InsertBomItem): Promise<BomItem> {
    try {
      const totalPrice = computeTotalPrice(item.quantity, item.unitPrice);
      const [created] = await db.insert(bomItems).values({ ...item, totalPrice }).returning();
      return created;
    } catch (e) {
      throw new StorageError('createBomItem', 'bom', e);
    }
  }

  async updateBomItem(id: number, projectId: number, item: Partial<InsertBomItem>): Promise<BomItem | undefined> {
    try {
      const { projectId: _ignoreProjectId, ...safeData } = item as any;

      if (safeData.quantity !== undefined || safeData.unitPrice !== undefined) {
        const [existing] = await db.select().from(bomItems).where(and(eq(bomItems.id, id), eq(bomItems.projectId, projectId)));
        if (!existing) return undefined;
        const quantity = safeData.quantity ?? existing.quantity;
        const unitPrice = safeData.unitPrice ?? existing.unitPrice;
        const totalPrice = computeTotalPrice(quantity, unitPrice);
        const [updated] = await db.update(bomItems)
          .set({ ...safeData, totalPrice, updatedAt: new Date() })
          .where(and(eq(bomItems.id, id), eq(bomItems.projectId, projectId)))
          .returning();
        return updated;
      }

      const [updated] = await db.update(bomItems)
        .set({ ...safeData, updatedAt: new Date() })
        .where(and(eq(bomItems.id, id), eq(bomItems.projectId, projectId)))
        .returning();
      return updated;
    } catch (e) {
      throw new StorageError('updateBomItem', `bom/${id}`, e);
    }
  }

  async deleteBomItem(id: number, projectId: number): Promise<boolean> {
    const result = await db.delete(bomItems)
      .where(and(eq(bomItems.id, id), eq(bomItems.projectId, projectId)))
      .returning();
    return result.length > 0;
  }

  async getValidationIssues(projectId: number, opts?: PaginationOptions): Promise<ValidationIssue[]> {
    const { limit = 50, offset = 0, sort = 'desc' } = opts || {};
    return db.select().from(validationIssues)
      .where(eq(validationIssues.projectId, projectId))
      .orderBy(sort === 'desc' ? desc(validationIssues.id) : asc(validationIssues.id))
      .limit(limit)
      .offset(offset);
  }

  async createValidationIssue(issue: InsertValidationIssue): Promise<ValidationIssue> {
    const [created] = await db.insert(validationIssues).values(issue).returning();
    return created;
  }

  async deleteValidationIssue(id: number, projectId: number): Promise<boolean> {
    const result = await db.delete(validationIssues)
      .where(and(eq(validationIssues.id, id), eq(validationIssues.projectId, projectId)))
      .returning();
    return result.length > 0;
  }

  async deleteValidationIssuesByProject(projectId: number): Promise<void> {
    await db.delete(validationIssues).where(eq(validationIssues.projectId, projectId));
  }

  async bulkCreateValidationIssues(issues: InsertValidationIssue[]): Promise<ValidationIssue[]> {
    if (issues.length === 0) return [];
    try {
      return await this.chunkedInsert<any, ValidationIssue>(validationIssues, issues);
    } catch (e) {
      throw new StorageError('bulkCreateValidationIssues', 'validationIssues', e);
    }
  }

  async replaceNodes(projectId: number, nodes: InsertArchitectureNode[]): Promise<ArchitectureNode[]> {
    try {
      return await db.transaction(async (tx) => {
        await tx.delete(architectureNodes).where(eq(architectureNodes.projectId, projectId));
        if (nodes.length === 0) return [];
        return tx.insert(architectureNodes).values(nodes).returning();
      });
    } catch (e) {
      throw new StorageError('replaceNodes', `projects/${projectId}/nodes`, e);
    }
  }

  async replaceEdges(projectId: number, edges: InsertArchitectureEdge[]): Promise<ArchitectureEdge[]> {
    try {
      return await db.transaction(async (tx) => {
        await tx.delete(architectureEdges).where(eq(architectureEdges.projectId, projectId));
        if (edges.length === 0) return [];
        return tx.insert(architectureEdges).values(edges).returning();
      });
    } catch (e) {
      throw new StorageError('replaceEdges', `projects/${projectId}/edges`, e);
    }
  }

  async replaceValidationIssues(projectId: number, issues: InsertValidationIssue[]): Promise<ValidationIssue[]> {
    try {
      return await db.transaction(async (tx) => {
        await tx.delete(validationIssues).where(eq(validationIssues.projectId, projectId));
        if (issues.length === 0) return [];
        return tx.insert(validationIssues).values(issues).returning();
      });
    } catch (e) {
      throw new StorageError('replaceValidationIssues', `projects/${projectId}/validation`, e);
    }
  }

  async getChatMessages(projectId: number, opts?: PaginationOptions): Promise<ChatMessage[]> {
    const { limit = 50, offset = 0, sort = 'desc' } = opts || {};
    return db.select().from(chatMessages)
      .where(eq(chatMessages.projectId, projectId))
      .orderBy(sort === 'desc' ? desc(chatMessages.timestamp) : asc(chatMessages.timestamp))
      .limit(limit)
      .offset(offset);
  }

  async createChatMessage(msg: InsertChatMessage): Promise<ChatMessage> {
    const [created] = await db.insert(chatMessages).values(msg).returning();
    return created;
  }

  async deleteChatMessages(projectId: number): Promise<void> {
    await db.delete(chatMessages).where(eq(chatMessages.projectId, projectId));
  }

  async deleteChatMessage(id: number, projectId: number): Promise<boolean> {
    const result = await db.delete(chatMessages)
      .where(and(eq(chatMessages.id, id), eq(chatMessages.projectId, projectId)))
      .returning();
    return result.length > 0;
  }

  async getHistoryItems(projectId: number, opts?: PaginationOptions): Promise<HistoryItem[]> {
    const { limit = 50, offset = 0, sort = 'desc' } = opts || {};
    return db.select().from(historyItems)
      .where(eq(historyItems.projectId, projectId))
      .orderBy(sort === 'desc' ? desc(historyItems.timestamp) : asc(historyItems.timestamp))
      .limit(limit)
      .offset(offset);
  }

  async createHistoryItem(item: InsertHistoryItem): Promise<HistoryItem> {
    const [created] = await db.insert(historyItems).values(item).returning();
    return created;
  }

  async deleteHistoryItems(projectId: number): Promise<void> {
    await db.delete(historyItems).where(eq(historyItems.projectId, projectId));
  }

  async deleteHistoryItem(id: number, projectId: number): Promise<boolean> {
    const result = await db.delete(historyItems)
      .where(and(eq(historyItems.id, id), eq(historyItems.projectId, projectId)))
      .returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
