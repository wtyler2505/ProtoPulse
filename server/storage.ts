import { eq, and, desc, asc, isNull, ilike, sql, count, or } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db } from "./db";
import { cache } from "./cache";
import {
  projects, type Project, type InsertProject,
  architectureNodes, type ArchitectureNode, type InsertArchitectureNode,
  architectureEdges, type ArchitectureEdge, type InsertArchitectureEdge,
  bomItems, type BomItem, type InsertBomItem,
  validationIssues, type ValidationIssue, type InsertValidationIssue,
  chatMessages, type ChatMessage, type InsertChatMessage,
  historyItems, type HistoryItem, type InsertHistoryItem,
  componentParts, type ComponentPart, type InsertComponentPart,
  componentLibrary, type ComponentLibraryEntry, type InsertComponentLibrary,
  userChatSettings, type UserChatSettings, type InsertUserChatSettings,
  circuitDesigns, type CircuitDesignRow, type InsertCircuitDesign,
  circuitInstances, type CircuitInstanceRow, type InsertCircuitInstance,
  circuitNets, type CircuitNetRow, type InsertCircuitNet,
  circuitWires, type CircuitWireRow, type InsertCircuitWire,
  simulationResults, type SimulationResultRow, type InsertSimulationResult,
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

  getComponentParts(projectId: number): Promise<ComponentPart[]>;
  getComponentPart(id: number, projectId: number): Promise<ComponentPart | undefined>;
  getComponentPartByNodeId(projectId: number, nodeId: string): Promise<ComponentPart | undefined>;
  createComponentPart(part: InsertComponentPart): Promise<ComponentPart>;
  updateComponentPart(id: number, projectId: number, data: Partial<InsertComponentPart>): Promise<ComponentPart | undefined>;
  deleteComponentPart(id: number, projectId: number): Promise<boolean>;

  getLibraryEntries(opts?: { search?: string; category?: string; page?: number; limit?: number }): Promise<{ entries: ComponentLibraryEntry[]; total: number }>;
  getLibraryEntry(id: number): Promise<ComponentLibraryEntry | undefined>;
  createLibraryEntry(entry: InsertComponentLibrary): Promise<ComponentLibraryEntry>;
  updateLibraryEntry(id: number, data: Partial<InsertComponentLibrary>): Promise<ComponentLibraryEntry | undefined>;
  deleteLibraryEntry(id: number): Promise<boolean>;
  incrementLibraryDownloads(id: number): Promise<void>;

  getChatSettings(userId: number): Promise<UserChatSettings | undefined>;
  upsertChatSettings(userId: number, settings: Partial<InsertUserChatSettings>): Promise<UserChatSettings>;

  // Circuit designs
  getCircuitDesigns(projectId: number): Promise<CircuitDesignRow[]>;
  getCircuitDesign(id: number): Promise<CircuitDesignRow | undefined>;
  createCircuitDesign(data: InsertCircuitDesign): Promise<CircuitDesignRow>;
  updateCircuitDesign(id: number, data: Partial<InsertCircuitDesign>): Promise<CircuitDesignRow | undefined>;
  deleteCircuitDesign(id: number): Promise<CircuitDesignRow | undefined>;

  // Circuit instances
  getCircuitInstances(circuitId: number): Promise<CircuitInstanceRow[]>;
  getCircuitInstance(id: number): Promise<CircuitInstanceRow | undefined>;
  createCircuitInstance(data: InsertCircuitInstance): Promise<CircuitInstanceRow>;
  updateCircuitInstance(id: number, data: Partial<InsertCircuitInstance>): Promise<CircuitInstanceRow | undefined>;
  deleteCircuitInstance(id: number): Promise<CircuitInstanceRow | undefined>;

  // Circuit nets
  getCircuitNets(circuitId: number): Promise<CircuitNetRow[]>;
  getCircuitNet(id: number): Promise<CircuitNetRow | undefined>;
  createCircuitNet(data: InsertCircuitNet): Promise<CircuitNetRow>;
  updateCircuitNet(id: number, data: Partial<InsertCircuitNet>): Promise<CircuitNetRow | undefined>;
  deleteCircuitNet(id: number): Promise<CircuitNetRow | undefined>;

  // Circuit wires
  getCircuitWires(circuitId: number): Promise<CircuitWireRow[]>;
  getCircuitWire(id: number): Promise<CircuitWireRow | undefined>;
  createCircuitWire(data: InsertCircuitWire): Promise<CircuitWireRow>;
  updateCircuitWire(id: number, data: Partial<InsertCircuitWire>): Promise<CircuitWireRow | undefined>;
  deleteCircuitWire(id: number): Promise<CircuitWireRow | undefined>;

  // Simulation results (Phase 13.13)
  getSimulationResults(circuitId: number): Promise<SimulationResultRow[]>;
  getSimulationResult(id: number): Promise<SimulationResultRow | undefined>;
  createSimulationResult(data: InsertSimulationResult): Promise<SimulationResultRow>;
  deleteSimulationResult(id: number): Promise<SimulationResultRow | undefined>;
  cleanupSimulationResults(circuitId: number, maxResults: number): Promise<number>;
}

function computeTotalPrice(quantity: number, unitPrice: string | number): string {
  return String((quantity * parseFloat(String(unitPrice))).toFixed(4));
}

export class DatabaseStorage implements IStorage {
  private async chunkedInsert<T extends Record<string, unknown>, R>(
    table: PgTable,
    items: T[],
    chunkSize = 100
  ): Promise<R[]> {
    if (items.length <= chunkSize) {
      return db.insert(table).values(items).returning() as unknown as Promise<R[]>;
    }
    const results: R[] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const inserted = await db.insert(table).values(chunk).returning();
      results.push(...(inserted as unknown as R[]));
    }
    return results;
  }

  async getProjects(opts?: PaginationOptions): Promise<Project[]> {
    try {
      const { limit = 50, offset = 0, sort = 'desc' } = opts || {};
      return await db.select().from(projects)
        .where(isNull(projects.deletedAt))
        .orderBy(sort === 'desc' ? desc(projects.id) : asc(projects.id))
        .limit(limit)
        .offset(offset);
    } catch (e) {
      throw new StorageError('getProjects', 'projects', e);
    }
  }

  async getProject(id: number): Promise<Project | undefined> {
    try {
      const cacheKey = `project:${id}`;
      const cached = cache.get<Project>(cacheKey);
      if (cached) return cached;
      const [project] = await db.select().from(projects).where(and(eq(projects.id, id), isNull(projects.deletedAt)));
      if (project) cache.set(cacheKey, project);
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
      const [updated] = await db.update(projects).set({ ...data, updatedAt: new Date() }).where(and(eq(projects.id, id), isNull(projects.deletedAt))).returning();
      if (updated) cache.invalidate(`project:${id}`);
      return updated;
    } catch (e) {
      throw new StorageError('updateProject', `projects/${id}`, e);
    }
  }

  async deleteProject(id: number): Promise<boolean> {
    try {
      const now = new Date();
      const [project] = await db.update(projects).set({ deletedAt: now }).where(and(eq(projects.id, id), isNull(projects.deletedAt))).returning();
      if (!project) return false;
      await db.update(architectureNodes).set({ deletedAt: now }).where(eq(architectureNodes.projectId, id));
      await db.update(architectureEdges).set({ deletedAt: now }).where(eq(architectureEdges.projectId, id));
      await db.update(bomItems).set({ deletedAt: now }).where(eq(bomItems.projectId, id));
      cache.invalidate(`project:${id}`);
      cache.invalidate(`nodes:${id}`);
      cache.invalidate(`edges:${id}`);
      cache.invalidate(`bom:${id}`);
      return true;
    } catch (e) {
      throw new StorageError('deleteProject', `projects/${id}`, e);
    }
  }

  async getNodes(projectId: number, opts?: PaginationOptions): Promise<ArchitectureNode[]> {
    try {
      const { limit = 50, offset = 0, sort = 'desc' } = opts || {};
      const cacheKey = `nodes:${projectId}:${limit}:${offset}:${sort}`;
      const cached = cache.get<ArchitectureNode[]>(cacheKey);
      if (cached) return cached;
      const result = await db.select().from(architectureNodes)
        .where(and(eq(architectureNodes.projectId, projectId), isNull(architectureNodes.deletedAt)))
        .orderBy(sort === 'desc' ? desc(architectureNodes.id) : asc(architectureNodes.id))
        .limit(limit)
        .offset(offset);
      cache.set(cacheKey, result);
      return result;
    } catch (e) {
      throw new StorageError('getNodes', `projects/${projectId}/nodes`, e);
    }
  }

  async createNode(node: InsertArchitectureNode): Promise<ArchitectureNode> {
    try {
      const [created] = await db.insert(architectureNodes).values(node).returning();
      cache.invalidate(`nodes:${node.projectId}`);
      return created;
    } catch (e) {
      throw new StorageError('createNode', 'nodes', e);
    }
  }

  async updateNode(id: number, projectId: number, data: Partial<InsertArchitectureNode>): Promise<ArchitectureNode | undefined> {
    try {
      const safeData = { ...data };
      delete safeData.projectId;
      const [updated] = await db.update(architectureNodes)
        .set({ ...safeData, updatedAt: new Date() })
        .where(and(eq(architectureNodes.id, id), eq(architectureNodes.projectId, projectId), isNull(architectureNodes.deletedAt)))
        .returning();
      if (updated) cache.invalidate(`nodes:${projectId}`);
      return updated;
    } catch (e) {
      throw new StorageError('updateNode', `nodes/${id}`, e);
    }
  }

  async deleteNodesByProject(projectId: number): Promise<void> {
    await db.update(architectureNodes).set({ deletedAt: new Date() }).where(and(eq(architectureNodes.projectId, projectId), isNull(architectureNodes.deletedAt)));
    cache.invalidate(`nodes:${projectId}`);
  }

  async bulkCreateNodes(nodes: InsertArchitectureNode[]): Promise<ArchitectureNode[]> {
    if (nodes.length === 0) return [];
    try {
      const result = await this.chunkedInsert<any, ArchitectureNode>(architectureNodes, nodes);
      if (nodes.length > 0) cache.invalidate(`nodes:${nodes[0].projectId}`);
      return result;
    } catch (e) {
      throw new StorageError('bulkCreateNodes', 'nodes', e);
    }
  }

  async getEdges(projectId: number, opts?: PaginationOptions): Promise<ArchitectureEdge[]> {
    try {
      const { limit = 50, offset = 0, sort = 'desc' } = opts || {};
      const cacheKey = `edges:${projectId}:${limit}:${offset}:${sort}`;
      const cached = cache.get<ArchitectureEdge[]>(cacheKey);
      if (cached) return cached;
      const result = await db.select().from(architectureEdges)
        .where(and(eq(architectureEdges.projectId, projectId), isNull(architectureEdges.deletedAt)))
        .orderBy(sort === 'desc' ? desc(architectureEdges.id) : asc(architectureEdges.id))
        .limit(limit)
        .offset(offset);
      cache.set(cacheKey, result);
      return result;
    } catch (e) {
      throw new StorageError('getEdges', `projects/${projectId}/edges`, e);
    }
  }

  async createEdge(edge: InsertArchitectureEdge): Promise<ArchitectureEdge> {
    try {
      const [created] = await db.insert(architectureEdges).values(edge).returning();
      cache.invalidate(`edges:${edge.projectId}`);
      return created;
    } catch (e) {
      throw new StorageError('createEdge', 'edges', e);
    }
  }

  async updateEdge(id: number, projectId: number, data: Partial<InsertArchitectureEdge>): Promise<ArchitectureEdge | undefined> {
    try {
      const safeData = { ...data };
      delete safeData.projectId;
      const [updated] = await db.update(architectureEdges)
        .set(safeData)
        .where(and(eq(architectureEdges.id, id), eq(architectureEdges.projectId, projectId), isNull(architectureEdges.deletedAt)))
        .returning();
      if (updated) cache.invalidate(`edges:${projectId}`);
      return updated;
    } catch (e) {
      throw new StorageError('updateEdge', `edges/${id}`, e);
    }
  }

  async deleteEdgesByProject(projectId: number): Promise<void> {
    await db.update(architectureEdges).set({ deletedAt: new Date() }).where(and(eq(architectureEdges.projectId, projectId), isNull(architectureEdges.deletedAt)));
    cache.invalidate(`edges:${projectId}`);
  }

  async bulkCreateEdges(edges: InsertArchitectureEdge[]): Promise<ArchitectureEdge[]> {
    if (edges.length === 0) return [];
    try {
      const result = await this.chunkedInsert<any, ArchitectureEdge>(architectureEdges, edges);
      if (edges.length > 0) cache.invalidate(`edges:${edges[0].projectId}`);
      return result;
    } catch (e) {
      throw new StorageError('bulkCreateEdges', 'edges', e);
    }
  }

  async getBomItems(projectId: number, opts?: PaginationOptions): Promise<BomItem[]> {
    try {
      const { limit = 50, offset = 0, sort = 'desc' } = opts || {};
      const cacheKey = `bom:${projectId}:${limit}:${offset}:${sort}`;
      const cached = cache.get<BomItem[]>(cacheKey);
      if (cached) return cached;
      const result = await db.select().from(bomItems)
        .where(and(eq(bomItems.projectId, projectId), isNull(bomItems.deletedAt)))
        .orderBy(sort === 'desc' ? desc(bomItems.id) : asc(bomItems.id))
        .limit(limit)
        .offset(offset);
      cache.set(cacheKey, result);
      return result;
    } catch (e) {
      throw new StorageError('getBomItems', `projects/${projectId}/bom`, e);
    }
  }

  async getBomItem(id: number, projectId: number): Promise<BomItem | undefined> {
    try {
      const [item] = await db.select().from(bomItems).where(and(eq(bomItems.id, id), eq(bomItems.projectId, projectId), isNull(bomItems.deletedAt)));
      return item;
    } catch (e) {
      throw new StorageError('getBomItem', `bom/${id}`, e);
    }
  }

  async createBomItem(item: InsertBomItem): Promise<BomItem> {
    try {
      const totalPrice = computeTotalPrice(item.quantity ?? 1, item.unitPrice ?? '0');
      const [created] = await db.insert(bomItems).values({ ...item, totalPrice }).returning();
      cache.invalidate(`bom:${item.projectId}`);
      return created;
    } catch (e) {
      throw new StorageError('createBomItem', 'bom', e);
    }
  }

  async updateBomItem(id: number, projectId: number, item: Partial<InsertBomItem>): Promise<BomItem | undefined> {
    try {
      const safeData = { ...item };
      delete safeData.projectId;

      if (safeData.quantity !== undefined || safeData.unitPrice !== undefined) {
        const [existing] = await db.select().from(bomItems).where(and(eq(bomItems.id, id), eq(bomItems.projectId, projectId), isNull(bomItems.deletedAt)));
        if (!existing) return undefined;
        const quantity = safeData.quantity ?? existing.quantity;
        const unitPrice = safeData.unitPrice ?? existing.unitPrice;
        const totalPrice = computeTotalPrice(quantity, unitPrice);
        const [updated] = await db.update(bomItems)
          .set({ ...safeData, totalPrice, updatedAt: new Date() })
          .where(and(eq(bomItems.id, id), eq(bomItems.projectId, projectId), isNull(bomItems.deletedAt)))
          .returning();
        if (updated) cache.invalidate(`bom:${projectId}`);
        return updated;
      }

      const [updated] = await db.update(bomItems)
        .set({ ...safeData, updatedAt: new Date() })
        .where(and(eq(bomItems.id, id), eq(bomItems.projectId, projectId), isNull(bomItems.deletedAt)))
        .returning();
      if (updated) cache.invalidate(`bom:${projectId}`);
      return updated;
    } catch (e) {
      throw new StorageError('updateBomItem', `bom/${id}`, e);
    }
  }

  async deleteBomItem(id: number, projectId: number): Promise<boolean> {
    const [result] = await db.update(bomItems)
      .set({ deletedAt: new Date() })
      .where(and(eq(bomItems.id, id), eq(bomItems.projectId, projectId), isNull(bomItems.deletedAt)))
      .returning();
    if (result) cache.invalidate(`bom:${projectId}`);
    return !!result;
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
      const result = await db.transaction(async (tx) => {
        await tx.delete(architectureNodes).where(eq(architectureNodes.projectId, projectId));
        if (nodes.length === 0) return [];
        return tx.insert(architectureNodes).values(nodes).returning();
      });
      cache.invalidate(`nodes:${projectId}`);
      return result;
    } catch (e) {
      throw new StorageError('replaceNodes', `projects/${projectId}/nodes`, e);
    }
  }

  async replaceEdges(projectId: number, edges: InsertArchitectureEdge[]): Promise<ArchitectureEdge[]> {
    try {
      const result = await db.transaction(async (tx) => {
        await tx.delete(architectureEdges).where(eq(architectureEdges.projectId, projectId));
        if (edges.length === 0) return [];
        return tx.insert(architectureEdges).values(edges).returning();
      });
      cache.invalidate(`edges:${projectId}`);
      return result;
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

  async getComponentParts(projectId: number): Promise<ComponentPart[]> {
    try {
      const cacheKey = `parts:${projectId}`;
      const cached = cache.get<ComponentPart[]>(cacheKey);
      if (cached) return cached;
      const result = await db.select().from(componentParts)
        .where(eq(componentParts.projectId, projectId))
        .orderBy(asc(componentParts.id));
      cache.set(cacheKey, result);
      return result;
    } catch (e) {
      throw new StorageError('getComponentParts', `projects/${projectId}/component-parts`, e);
    }
  }

  async getComponentPart(id: number, projectId: number): Promise<ComponentPart | undefined> {
    try {
      const [part] = await db.select().from(componentParts)
        .where(and(eq(componentParts.id, id), eq(componentParts.projectId, projectId)));
      return part;
    } catch (e) {
      throw new StorageError('getComponentPart', `component-parts/${id}`, e);
    }
  }

  async getComponentPartByNodeId(projectId: number, nodeId: string): Promise<ComponentPart | undefined> {
    try {
      const [part] = await db.select().from(componentParts)
        .where(and(eq(componentParts.projectId, projectId), eq(componentParts.nodeId, nodeId)));
      return part;
    } catch (e) {
      throw new StorageError('getComponentPartByNodeId', `component-parts/node/${nodeId}`, e);
    }
  }

  async createComponentPart(part: InsertComponentPart): Promise<ComponentPart> {
    try {
      const [created] = await db.insert(componentParts).values(part).returning();
      cache.invalidate(`parts:${part.projectId}`);
      return created;
    } catch (e) {
      throw new StorageError('createComponentPart', 'component-parts', e);
    }
  }

  async updateComponentPart(id: number, projectId: number, data: Partial<InsertComponentPart>): Promise<ComponentPart | undefined> {
    try {
      const safeData = { ...data };
      delete safeData.projectId;
      const [existing] = await db.select().from(componentParts)
        .where(and(eq(componentParts.id, id), eq(componentParts.projectId, projectId)));
      if (!existing) return undefined;
      const [updated] = await db.update(componentParts)
        .set({ ...safeData, version: existing.version + 1, updatedAt: new Date() })
        .where(and(eq(componentParts.id, id), eq(componentParts.projectId, projectId)))
        .returning();
      if (updated) cache.invalidate(`parts:${projectId}`);
      return updated;
    } catch (e) {
      throw new StorageError('updateComponentPart', `component-parts/${id}`, e);
    }
  }

  async deleteComponentPart(id: number, projectId: number): Promise<boolean> {
    try {
      const result = await db.delete(componentParts)
        .where(and(eq(componentParts.id, id), eq(componentParts.projectId, projectId)))
        .returning();
      if (result.length > 0) cache.invalidate(`parts:${projectId}`);
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
        conditions.push(
          or(
            ilike(componentLibrary.title, `%${search}%`),
            sql`EXISTS (SELECT 1 FROM unnest(${componentLibrary.tags}) AS t WHERE t ILIKE ${'%' + search + '%'})`
          )!
        );
      }

      const whereClause = and(...conditions);

      const [entries, [{ total }]] = await Promise.all([
        db.select().from(componentLibrary)
          .where(whereClause)
          .orderBy(desc(componentLibrary.downloadCount), desc(componentLibrary.createdAt))
          .limit(limit)
          .offset(offset),
        db.select({ total: count() }).from(componentLibrary)
          .where(whereClause),
      ]);

      return { entries, total };
    } catch (e) {
      throw new StorageError('getLibraryEntries', 'componentLibrary', e);
    }
  }

  async getLibraryEntry(id: number): Promise<ComponentLibraryEntry | undefined> {
    try {
      const [entry] = await db.select().from(componentLibrary).where(eq(componentLibrary.id, id));
      return entry;
    } catch (e) {
      throw new StorageError('getLibraryEntry', `componentLibrary/${id}`, e);
    }
  }

  async createLibraryEntry(entry: InsertComponentLibrary): Promise<ComponentLibraryEntry> {
    try {
      const [created] = await db.insert(componentLibrary).values(entry).returning();
      return created;
    } catch (e) {
      throw new StorageError('createLibraryEntry', 'componentLibrary', e);
    }
  }

  async updateLibraryEntry(id: number, data: Partial<InsertComponentLibrary>): Promise<ComponentLibraryEntry | undefined> {
    try {
      const [updated] = await db.update(componentLibrary)
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
      const result = await db.delete(componentLibrary)
        .where(eq(componentLibrary.id, id))
        .returning();
      return result.length > 0;
    } catch (e) {
      throw new StorageError('deleteLibraryEntry', `componentLibrary/${id}`, e);
    }
  }

  async incrementLibraryDownloads(id: number): Promise<void> {
    try {
      await db.update(componentLibrary)
        .set({ downloadCount: sql`${componentLibrary.downloadCount} + 1` })
        .where(eq(componentLibrary.id, id));
    } catch (e) {
      throw new StorageError('incrementLibraryDownloads', `componentLibrary/${id}`, e);
    }
  }

  async getChatSettings(userId: number): Promise<UserChatSettings | undefined> {
    try {
      const [settings] = await db.select().from(userChatSettings)
        .where(eq(userChatSettings.userId, userId));
      return settings;
    } catch (e) {
      throw new StorageError('getChatSettings', `user/${userId}/chat-settings`, e);
    }
  }

  async upsertChatSettings(userId: number, settings: Partial<InsertUserChatSettings>): Promise<UserChatSettings> {
    try {
      const [existing] = await db.select().from(userChatSettings)
        .where(eq(userChatSettings.userId, userId));

      if (existing) {
        const [updated] = await db.update(userChatSettings)
          .set({ ...settings, updatedAt: new Date() })
          .where(eq(userChatSettings.userId, userId))
          .returning();
        return updated;
      }

      const [created] = await db.insert(userChatSettings)
        .values({ userId, ...settings })
        .returning();
      return created;
    } catch (e) {
      throw new StorageError('upsertChatSettings', `user/${userId}/chat-settings`, e);
    }
  }

  // --- Circuit Designs ---

  async getCircuitDesigns(projectId: number): Promise<CircuitDesignRow[]> {
    try {
      return await db.select().from(circuitDesigns)
        .where(eq(circuitDesigns.projectId, projectId))
        .orderBy(asc(circuitDesigns.id));
    } catch (e) {
      throw new StorageError('getCircuitDesigns', `projects/${projectId}/circuit-designs`, e);
    }
  }

  async getCircuitDesign(id: number): Promise<CircuitDesignRow | undefined> {
    try {
      const [design] = await db.select().from(circuitDesigns)
        .where(eq(circuitDesigns.id, id));
      return design;
    } catch (e) {
      throw new StorageError('getCircuitDesign', `circuit-designs/${id}`, e);
    }
  }

  async createCircuitDesign(data: InsertCircuitDesign): Promise<CircuitDesignRow> {
    try {
      const [created] = await db.insert(circuitDesigns).values(data).returning();
      return created;
    } catch (e) {
      throw new StorageError('createCircuitDesign', 'circuit-designs', e);
    }
  }

  async updateCircuitDesign(id: number, data: Partial<InsertCircuitDesign>): Promise<CircuitDesignRow | undefined> {
    try {
      const [updated] = await db.update(circuitDesigns)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(circuitDesigns.id, id))
        .returning();
      return updated;
    } catch (e) {
      throw new StorageError('updateCircuitDesign', `circuit-designs/${id}`, e);
    }
  }

  async deleteCircuitDesign(id: number): Promise<CircuitDesignRow | undefined> {
    try {
      const [deleted] = await db.delete(circuitDesigns)
        .where(eq(circuitDesigns.id, id))
        .returning();
      return deleted;
    } catch (e) {
      throw new StorageError('deleteCircuitDesign', `circuit-designs/${id}`, e);
    }
  }

  // --- Circuit Instances ---

  async getCircuitInstances(circuitId: number): Promise<CircuitInstanceRow[]> {
    try {
      return await db.select().from(circuitInstances)
        .where(eq(circuitInstances.circuitId, circuitId))
        .orderBy(asc(circuitInstances.id));
    } catch (e) {
      throw new StorageError('getCircuitInstances', `circuits/${circuitId}/instances`, e);
    }
  }

  async getCircuitInstance(id: number): Promise<CircuitInstanceRow | undefined> {
    try {
      const [instance] = await db.select().from(circuitInstances)
        .where(eq(circuitInstances.id, id));
      return instance;
    } catch (e) {
      throw new StorageError('getCircuitInstance', `circuit-instances/${id}`, e);
    }
  }

  async createCircuitInstance(data: InsertCircuitInstance): Promise<CircuitInstanceRow> {
    try {
      const [created] = await db.insert(circuitInstances).values(data).returning();
      return created;
    } catch (e) {
      throw new StorageError('createCircuitInstance', 'circuit-instances', e);
    }
  }

  async updateCircuitInstance(id: number, data: Partial<InsertCircuitInstance>): Promise<CircuitInstanceRow | undefined> {
    try {
      const [updated] = await db.update(circuitInstances)
        .set(data)
        .where(eq(circuitInstances.id, id))
        .returning();
      return updated;
    } catch (e) {
      throw new StorageError('updateCircuitInstance', `circuit-instances/${id}`, e);
    }
  }

  async deleteCircuitInstance(id: number): Promise<CircuitInstanceRow | undefined> {
    try {
      const [deleted] = await db.delete(circuitInstances)
        .where(eq(circuitInstances.id, id))
        .returning();
      return deleted;
    } catch (e) {
      throw new StorageError('deleteCircuitInstance', `circuit-instances/${id}`, e);
    }
  }

  // --- Circuit Nets ---

  async getCircuitNets(circuitId: number): Promise<CircuitNetRow[]> {
    try {
      return await db.select().from(circuitNets)
        .where(eq(circuitNets.circuitId, circuitId))
        .orderBy(asc(circuitNets.id));
    } catch (e) {
      throw new StorageError('getCircuitNets', `circuits/${circuitId}/nets`, e);
    }
  }

  async getCircuitNet(id: number): Promise<CircuitNetRow | undefined> {
    try {
      const [net] = await db.select().from(circuitNets)
        .where(eq(circuitNets.id, id));
      return net;
    } catch (e) {
      throw new StorageError('getCircuitNet', `circuit-nets/${id}`, e);
    }
  }

  async createCircuitNet(data: InsertCircuitNet): Promise<CircuitNetRow> {
    try {
      const [created] = await db.insert(circuitNets).values(data).returning();
      return created;
    } catch (e) {
      throw new StorageError('createCircuitNet', 'circuit-nets', e);
    }
  }

  async updateCircuitNet(id: number, data: Partial<InsertCircuitNet>): Promise<CircuitNetRow | undefined> {
    try {
      const [updated] = await db.update(circuitNets)
        .set(data)
        .where(eq(circuitNets.id, id))
        .returning();
      return updated;
    } catch (e) {
      throw new StorageError('updateCircuitNet', `circuit-nets/${id}`, e);
    }
  }

  async deleteCircuitNet(id: number): Promise<CircuitNetRow | undefined> {
    try {
      const [deleted] = await db.delete(circuitNets)
        .where(eq(circuitNets.id, id))
        .returning();
      return deleted;
    } catch (e) {
      throw new StorageError('deleteCircuitNet', `circuit-nets/${id}`, e);
    }
  }

  // --- Circuit Wires ---

  async getCircuitWires(circuitId: number): Promise<CircuitWireRow[]> {
    try {
      return await db.select().from(circuitWires)
        .where(eq(circuitWires.circuitId, circuitId))
        .orderBy(asc(circuitWires.id));
    } catch (e) {
      throw new StorageError('getCircuitWires', `circuits/${circuitId}/wires`, e);
    }
  }

  async getCircuitWire(id: number): Promise<CircuitWireRow | undefined> {
    try {
      const [wire] = await db.select().from(circuitWires)
        .where(eq(circuitWires.id, id));
      return wire;
    } catch (e) {
      throw new StorageError('getCircuitWire', `circuit-wires/${id}`, e);
    }
  }

  async createCircuitWire(data: InsertCircuitWire): Promise<CircuitWireRow> {
    try {
      const [created] = await db.insert(circuitWires).values(data).returning();
      return created;
    } catch (e) {
      throw new StorageError('createCircuitWire', 'circuit-wires', e);
    }
  }

  async updateCircuitWire(id: number, data: Partial<InsertCircuitWire>): Promise<CircuitWireRow | undefined> {
    try {
      const [updated] = await db.update(circuitWires)
        .set(data)
        .where(eq(circuitWires.id, id))
        .returning();
      return updated;
    } catch (e) {
      throw new StorageError('updateCircuitWire', `circuit-wires/${id}`, e);
    }
  }

  async deleteCircuitWire(id: number): Promise<CircuitWireRow | undefined> {
    try {
      const [deleted] = await db.delete(circuitWires)
        .where(eq(circuitWires.id, id))
        .returning();
      return deleted;
    } catch (e) {
      throw new StorageError('deleteCircuitWire', `circuit-wires/${id}`, e);
    }
  }

  // =========================================================================
  // Simulation Results (Phase 13.13)
  // =========================================================================

  async getSimulationResults(circuitId: number): Promise<SimulationResultRow[]> {
    try {
      return await db.select()
        .from(simulationResults)
        .where(eq(simulationResults.circuitId, circuitId))
        .orderBy(desc(simulationResults.createdAt));
    } catch (e) {
      throw new StorageError('getSimulationResults', `circuits/${circuitId}/simulations`, e);
    }
  }

  async getSimulationResult(id: number): Promise<SimulationResultRow | undefined> {
    try {
      const [result] = await db.select()
        .from(simulationResults)
        .where(eq(simulationResults.id, id));
      return result;
    } catch (e) {
      throw new StorageError('getSimulationResult', `simulations/${id}`, e);
    }
  }

  async createSimulationResult(data: InsertSimulationResult): Promise<SimulationResultRow> {
    try {
      const [result] = await db.insert(simulationResults)
        .values(data)
        .returning();
      return result;
    } catch (e) {
      throw new StorageError('createSimulationResult', `circuits/${data.circuitId}/simulations`, e);
    }
  }

  async deleteSimulationResult(id: number): Promise<SimulationResultRow | undefined> {
    try {
      const [deleted] = await db.delete(simulationResults)
        .where(eq(simulationResults.id, id))
        .returning();
      return deleted;
    } catch (e) {
      throw new StorageError('deleteSimulationResult', `simulations/${id}`, e);
    }
  }

  async cleanupSimulationResults(circuitId: number, maxResults: number): Promise<number> {
    try {
      const results = await db.select({ id: simulationResults.id })
        .from(simulationResults)
        .where(eq(simulationResults.circuitId, circuitId))
        .orderBy(desc(simulationResults.createdAt));

      if (results.length <= maxResults) return 0;

      const idsToDelete = results.slice(maxResults).map(r => r.id);
      let deleted = 0;
      for (const id of idsToDelete) {
        await db.delete(simulationResults)
          .where(eq(simulationResults.id, id));
        deleted++;
      }
      return deleted;
    } catch (e) {
      throw new StorageError('cleanupSimulationResults', `circuits/${circuitId}/simulations`, e);
    }
  }
}

export const storage = new DatabaseStorage();
