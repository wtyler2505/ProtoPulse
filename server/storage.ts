import { eq, and } from "drizzle-orm";
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

export interface IStorage {
  getProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, data: Partial<InsertProject>): Promise<Project | undefined>;

  getNodes(projectId: number): Promise<ArchitectureNode[]>;
  createNode(node: InsertArchitectureNode): Promise<ArchitectureNode>;
  deleteNodesByProject(projectId: number): Promise<void>;
  bulkCreateNodes(nodes: InsertArchitectureNode[]): Promise<ArchitectureNode[]>;

  getEdges(projectId: number): Promise<ArchitectureEdge[]>;
  createEdge(edge: InsertArchitectureEdge): Promise<ArchitectureEdge>;
  deleteEdgesByProject(projectId: number): Promise<void>;
  bulkCreateEdges(edges: InsertArchitectureEdge[]): Promise<ArchitectureEdge[]>;

  replaceNodes(projectId: number, nodes: InsertArchitectureNode[]): Promise<ArchitectureNode[]>;
  replaceEdges(projectId: number, edges: InsertArchitectureEdge[]): Promise<ArchitectureEdge[]>;
  replaceValidationIssues(projectId: number, issues: InsertValidationIssue[]): Promise<ValidationIssue[]>;

  getBomItems(projectId: number): Promise<BomItem[]>;
  createBomItem(item: InsertBomItem): Promise<BomItem>;
  updateBomItem(id: number, projectId: number, item: Partial<InsertBomItem>): Promise<BomItem | undefined>;
  deleteBomItem(id: number, projectId: number): Promise<boolean>;

  getValidationIssues(projectId: number): Promise<ValidationIssue[]>;
  createValidationIssue(issue: InsertValidationIssue): Promise<ValidationIssue>;
  deleteValidationIssue(id: number, projectId: number): Promise<boolean>;
  deleteValidationIssuesByProject(projectId: number): Promise<void>;
  bulkCreateValidationIssues(issues: InsertValidationIssue[]): Promise<ValidationIssue[]>;

  getChatMessages(projectId: number): Promise<ChatMessage[]>;
  createChatMessage(msg: InsertChatMessage): Promise<ChatMessage>;

  getHistoryItems(projectId: number): Promise<HistoryItem[]>;
  createHistoryItem(item: InsertHistoryItem): Promise<HistoryItem>;
}

function computeTotalPrice(quantity: number, unitPrice: string | number): string {
  return String((quantity * parseFloat(String(unitPrice))).toFixed(4));
}

export class DatabaseStorage implements IStorage {
  async getProjects(): Promise<Project[]> {
    return db.select().from(projects);
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [created] = await db.insert(projects).values(project).returning();
    return created;
  }

  async updateProject(id: number, data: Partial<InsertProject>): Promise<Project | undefined> {
    const [updated] = await db.update(projects).set({ ...data, updatedAt: new Date() }).where(eq(projects.id, id)).returning();
    return updated;
  }

  async getNodes(projectId: number): Promise<ArchitectureNode[]> {
    return db.select().from(architectureNodes).where(eq(architectureNodes.projectId, projectId));
  }

  async createNode(node: InsertArchitectureNode): Promise<ArchitectureNode> {
    const [created] = await db.insert(architectureNodes).values(node).returning();
    return created;
  }

  async deleteNodesByProject(projectId: number): Promise<void> {
    await db.delete(architectureNodes).where(eq(architectureNodes.projectId, projectId));
  }

  async bulkCreateNodes(nodes: InsertArchitectureNode[]): Promise<ArchitectureNode[]> {
    if (nodes.length === 0) return [];
    return db.insert(architectureNodes).values(nodes).returning();
  }

  async getEdges(projectId: number): Promise<ArchitectureEdge[]> {
    return db.select().from(architectureEdges).where(eq(architectureEdges.projectId, projectId));
  }

  async createEdge(edge: InsertArchitectureEdge): Promise<ArchitectureEdge> {
    const [created] = await db.insert(architectureEdges).values(edge).returning();
    return created;
  }

  async deleteEdgesByProject(projectId: number): Promise<void> {
    await db.delete(architectureEdges).where(eq(architectureEdges.projectId, projectId));
  }

  async bulkCreateEdges(edges: InsertArchitectureEdge[]): Promise<ArchitectureEdge[]> {
    if (edges.length === 0) return [];
    return db.insert(architectureEdges).values(edges).returning();
  }

  async getBomItems(projectId: number): Promise<BomItem[]> {
    return db.select().from(bomItems).where(eq(bomItems.projectId, projectId));
  }

  async createBomItem(item: InsertBomItem): Promise<BomItem> {
    const totalPrice = computeTotalPrice(item.quantity, item.unitPrice);
    const [created] = await db.insert(bomItems).values({ ...item, totalPrice }).returning();
    return created;
  }

  async updateBomItem(id: number, projectId: number, item: Partial<InsertBomItem>): Promise<BomItem | undefined> {
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
  }

  async deleteBomItem(id: number, projectId: number): Promise<boolean> {
    const result = await db.delete(bomItems)
      .where(and(eq(bomItems.id, id), eq(bomItems.projectId, projectId)))
      .returning();
    return result.length > 0;
  }

  async getValidationIssues(projectId: number): Promise<ValidationIssue[]> {
    return db.select().from(validationIssues).where(eq(validationIssues.projectId, projectId));
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
    return db.insert(validationIssues).values(issues).returning();
  }

  async replaceNodes(projectId: number, nodes: InsertArchitectureNode[]): Promise<ArchitectureNode[]> {
    return db.transaction(async (tx) => {
      await tx.delete(architectureNodes).where(eq(architectureNodes.projectId, projectId));
      if (nodes.length === 0) return [];
      return tx.insert(architectureNodes).values(nodes).returning();
    });
  }

  async replaceEdges(projectId: number, edges: InsertArchitectureEdge[]): Promise<ArchitectureEdge[]> {
    return db.transaction(async (tx) => {
      await tx.delete(architectureEdges).where(eq(architectureEdges.projectId, projectId));
      if (edges.length === 0) return [];
      return tx.insert(architectureEdges).values(edges).returning();
    });
  }

  async replaceValidationIssues(projectId: number, issues: InsertValidationIssue[]): Promise<ValidationIssue[]> {
    return db.transaction(async (tx) => {
      await tx.delete(validationIssues).where(eq(validationIssues.projectId, projectId));
      if (issues.length === 0) return [];
      return tx.insert(validationIssues).values(issues).returning();
    });
  }

  async getChatMessages(projectId: number): Promise<ChatMessage[]> {
    return db.select().from(chatMessages).where(eq(chatMessages.projectId, projectId));
  }

  async createChatMessage(msg: InsertChatMessage): Promise<ChatMessage> {
    const [created] = await db.insert(chatMessages).values(msg).returning();
    return created;
  }

  async getHistoryItems(projectId: number): Promise<HistoryItem[]> {
    return db.select().from(historyItems).where(eq(historyItems.projectId, projectId));
  }

  async createHistoryItem(item: InsertHistoryItem): Promise<HistoryItem> {
    const [created] = await db.insert(historyItems).values(item).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
