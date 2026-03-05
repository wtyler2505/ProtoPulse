import { eq, and, desc, asc, isNull, sql, inArray } from 'drizzle-orm';
import {
  architectureNodes, type ArchitectureNode, type InsertArchitectureNode,
  architectureEdges, type ArchitectureEdge, type InsertArchitectureEdge,
} from '@shared/schema';
import { StorageError, VersionConflictError } from './errors';
import type { StorageDeps } from './types';
import type { PaginationOptions } from './interfaces';
import { chunkedInsert } from './utils';

export class ArchitectureStorage {
  constructor(private deps: StorageDeps) {}

  private get db() { return this.deps.db; }
  private get cache() { return this.deps.cache; }

  async getNodes(projectId: number, opts?: PaginationOptions): Promise<ArchitectureNode[]> {
    try {
      const { limit = 50, offset = 0, sort = 'desc' } = opts || {};
      const cacheKey = `nodes:${projectId}:${limit}:${offset}:${sort}`;
      const cached = this.cache.get<ArchitectureNode[]>(cacheKey);
      if (cached) { return cached; }
      const result = await this.db.select().from(architectureNodes)
        .where(and(eq(architectureNodes.projectId, projectId), isNull(architectureNodes.deletedAt)))
        .orderBy(sort === 'desc' ? desc(architectureNodes.id) : asc(architectureNodes.id))
        .limit(limit)
        .offset(offset);
      this.cache.set(cacheKey, result);
      return result;
    } catch (e) {
      throw new StorageError('getNodes', `projects/${projectId}/nodes`, e);
    }
  }

  async createNode(node: InsertArchitectureNode): Promise<ArchitectureNode> {
    try {
      const [created] = await this.db.insert(architectureNodes).values(node).returning();
      this.cache.invalidate(`nodes:${node.projectId}`);
      return created;
    } catch (e) {
      throw new StorageError('createNode', 'nodes', e);
    }
  }

  async updateNode(id: number, projectId: number, data: Partial<InsertArchitectureNode>, expectedVersion?: number): Promise<ArchitectureNode | undefined> {
    try {
      const safeData = { ...data };
      delete safeData.projectId;
      const conditions = [eq(architectureNodes.id, id), eq(architectureNodes.projectId, projectId), isNull(architectureNodes.deletedAt)];
      if (expectedVersion !== undefined) {
        conditions.push(eq(architectureNodes.version, expectedVersion));
      }
      const [updated] = await this.db.update(architectureNodes)
        .set({ ...safeData, version: sql`${architectureNodes.version} + 1`, updatedAt: new Date() })
        .where(and(...conditions))
        .returning();
      if (expectedVersion !== undefined && !updated) {
        const [existing] = await this.db.select({ id: architectureNodes.id, version: architectureNodes.version })
          .from(architectureNodes).where(and(eq(architectureNodes.id, id), eq(architectureNodes.projectId, projectId), isNull(architectureNodes.deletedAt)));
        if (existing) {
          throw new VersionConflictError('nodes', id, existing.version);
        }
      }
      if (updated) { this.cache.invalidate(`nodes:${projectId}`); }
      return updated;
    } catch (e) {
      if (e instanceof StorageError) { throw e; }
      throw new StorageError('updateNode', `nodes/${id}`, e);
    }
  }

  async deleteNodesByProject(projectId: number): Promise<void> {
    await this.db.update(architectureNodes).set({ deletedAt: new Date() }).where(and(eq(architectureNodes.projectId, projectId), isNull(architectureNodes.deletedAt)));
    this.cache.invalidate(`nodes:${projectId}`);
  }

  async bulkCreateNodes(nodes: InsertArchitectureNode[]): Promise<ArchitectureNode[]> {
    if (nodes.length === 0) { return []; }
    try {
      const result = await chunkedInsert<ArchitectureNode>(this.db, architectureNodes, nodes);
      if (nodes.length > 0) { this.cache.invalidate(`nodes:${nodes[0].projectId}`); }
      return result;
    } catch (e) {
      throw new StorageError('bulkCreateNodes', 'nodes', e);
    }
  }

  async getEdges(projectId: number, opts?: PaginationOptions): Promise<ArchitectureEdge[]> {
    try {
      const { limit = 50, offset = 0, sort = 'desc' } = opts || {};
      const cacheKey = `edges:${projectId}:${limit}:${offset}:${sort}`;
      const cached = this.cache.get<ArchitectureEdge[]>(cacheKey);
      if (cached) { return cached; }
      const result = await this.db.select().from(architectureEdges)
        .where(and(eq(architectureEdges.projectId, projectId), isNull(architectureEdges.deletedAt)))
        .orderBy(sort === 'desc' ? desc(architectureEdges.id) : asc(architectureEdges.id))
        .limit(limit)
        .offset(offset);
      this.cache.set(cacheKey, result);
      return result;
    } catch (e) {
      throw new StorageError('getEdges', `projects/${projectId}/edges`, e);
    }
  }

  async createEdge(edge: InsertArchitectureEdge): Promise<ArchitectureEdge> {
    try {
      const [created] = await this.db.insert(architectureEdges).values(edge).returning();
      this.cache.invalidate(`edges:${edge.projectId}`);
      return created;
    } catch (e) {
      throw new StorageError('createEdge', 'edges', e);
    }
  }

  async updateEdge(id: number, projectId: number, data: Partial<InsertArchitectureEdge>, expectedVersion?: number): Promise<ArchitectureEdge | undefined> {
    try {
      const safeData = { ...data };
      delete safeData.projectId;
      const conditions = [eq(architectureEdges.id, id), eq(architectureEdges.projectId, projectId), isNull(architectureEdges.deletedAt)];
      if (expectedVersion !== undefined) {
        conditions.push(eq(architectureEdges.version, expectedVersion));
      }
      const [updated] = await this.db.update(architectureEdges)
        .set({ ...safeData, version: sql`${architectureEdges.version} + 1` })
        .where(and(...conditions))
        .returning();
      if (expectedVersion !== undefined && !updated) {
        const [existing] = await this.db.select({ id: architectureEdges.id, version: architectureEdges.version })
          .from(architectureEdges).where(and(eq(architectureEdges.id, id), eq(architectureEdges.projectId, projectId), isNull(architectureEdges.deletedAt)));
        if (existing) {
          throw new VersionConflictError('edges', id, existing.version);
        }
      }
      if (updated) { this.cache.invalidate(`edges:${projectId}`); }
      return updated;
    } catch (e) {
      if (e instanceof StorageError) { throw e; }
      throw new StorageError('updateEdge', `edges/${id}`, e);
    }
  }

  async deleteEdgesByProject(projectId: number): Promise<void> {
    await this.db.update(architectureEdges).set({ deletedAt: new Date() }).where(and(eq(architectureEdges.projectId, projectId), isNull(architectureEdges.deletedAt)));
    this.cache.invalidate(`edges:${projectId}`);
  }

  async bulkCreateEdges(edges: InsertArchitectureEdge[]): Promise<ArchitectureEdge[]> {
    if (edges.length === 0) { return []; }
    try {
      const result = await chunkedInsert<ArchitectureEdge>(this.db, architectureEdges, edges);
      if (edges.length > 0) { this.cache.invalidate(`edges:${edges[0].projectId}`); }
      return result;
    } catch (e) {
      throw new StorageError('bulkCreateEdges', 'edges', e);
    }
  }

  async replaceNodes(projectId: number, nodes: InsertArchitectureNode[]): Promise<ArchitectureNode[]> {
    try {
      const result = await this.db.transaction(async (tx) => {
        const existing = await tx.select().from(architectureNodes)
          .where(and(eq(architectureNodes.projectId, projectId), isNull(architectureNodes.deletedAt)));

        const existingByNodeId = new Map(existing.map((n) => [n.nodeId, n]));
        const incomingByNodeId = new Map(nodes.map((n) => [n.nodeId, n]));

        const removedIds = existing
          .filter((n) => !incomingByNodeId.has(n.nodeId))
          .map((n) => n.id);
        if (removedIds.length > 0) {
          await tx.update(architectureNodes)
            .set({ deletedAt: new Date() })
            .where(inArray(architectureNodes.id, removedIds));
        }

        const toInsert: InsertArchitectureNode[] = [];
        const toUpdate: Array<{ id: number; data: Partial<InsertArchitectureNode> }> = [];
        const unchanged: ArchitectureNode[] = [];

        for (const incoming of nodes) {
          const ex = existingByNodeId.get(incoming.nodeId);
          if (!ex) {
            toInsert.push(incoming);
          } else {
            const changed =
              ex.label !== incoming.label ||
              ex.nodeType !== incoming.nodeType ||
              ex.positionX !== incoming.positionX ||
              ex.positionY !== incoming.positionY ||
              JSON.stringify(ex.data ?? null) !== JSON.stringify(incoming.data ?? null);
            if (changed) {
              toUpdate.push({
                id: ex.id,
                data: {
                  label: incoming.label,
                  nodeType: incoming.nodeType,
                  positionX: incoming.positionX,
                  positionY: incoming.positionY,
                  data: incoming.data,
                },
              });
            } else {
              unchanged.push(ex);
            }
          }
        }

        let inserted: ArchitectureNode[] = [];
        if (toInsert.length > 0) {
          inserted = await tx.insert(architectureNodes).values(toInsert).returning();
        }

        const updated: ArchitectureNode[] = [];
        for (const { id, data } of toUpdate) {
          const [row] = await tx.update(architectureNodes)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(architectureNodes.id, id))
            .returning();
          updated.push(row);
        }

        return [...unchanged, ...updated, ...inserted];
      });
      this.cache.invalidate(`nodes:${projectId}`);
      return result;
    } catch (e) {
      throw new StorageError('replaceNodes', `projects/${projectId}/nodes`, e);
    }
  }

  async replaceEdges(projectId: number, edges: InsertArchitectureEdge[]): Promise<ArchitectureEdge[]> {
    try {
      const result = await this.db.transaction(async (tx) => {
        const existing = await tx.select().from(architectureEdges)
          .where(and(eq(architectureEdges.projectId, projectId), isNull(architectureEdges.deletedAt)));

        const existingByEdgeId = new Map(existing.map((e) => [e.edgeId, e]));
        const incomingByEdgeId = new Map(edges.map((e) => [e.edgeId, e]));

        const removedIds = existing
          .filter((e) => !incomingByEdgeId.has(e.edgeId))
          .map((e) => e.id);
        if (removedIds.length > 0) {
          await tx.update(architectureEdges)
            .set({ deletedAt: new Date() })
            .where(inArray(architectureEdges.id, removedIds));
        }

        const toInsert: InsertArchitectureEdge[] = [];
        const toUpdate: Array<{ id: number; data: Partial<InsertArchitectureEdge> }> = [];
        const unchanged: ArchitectureEdge[] = [];

        for (const incoming of edges) {
          const ex = existingByEdgeId.get(incoming.edgeId);
          if (!ex) {
            toInsert.push(incoming);
          } else {
            const changed =
              ex.source !== incoming.source ||
              ex.target !== incoming.target ||
              ex.label !== (incoming.label ?? null) ||
              ex.animated !== (incoming.animated ?? false) ||
              JSON.stringify(ex.style) !== JSON.stringify(incoming.style ?? null) ||
              ex.signalType !== (incoming.signalType ?? null) ||
              ex.voltage !== (incoming.voltage ?? null) ||
              ex.busWidth !== (incoming.busWidth ?? null) ||
              ex.netName !== (incoming.netName ?? null);
            if (changed) {
              toUpdate.push({
                id: ex.id,
                data: {
                  source: incoming.source,
                  target: incoming.target,
                  label: incoming.label,
                  animated: incoming.animated,
                  style: incoming.style,
                  signalType: incoming.signalType,
                  voltage: incoming.voltage,
                  busWidth: incoming.busWidth,
                  netName: incoming.netName,
                },
              });
            } else {
              unchanged.push(ex);
            }
          }
        }

        let inserted: ArchitectureEdge[] = [];
        if (toInsert.length > 0) {
          inserted = await tx.insert(architectureEdges).values(toInsert).returning();
        }

        const updated: ArchitectureEdge[] = [];
        for (const { id, data } of toUpdate) {
          const [row] = await tx.update(architectureEdges)
            .set(data)
            .where(eq(architectureEdges.id, id))
            .returning();
          updated.push(row);
        }

        return [...unchanged, ...updated, ...inserted];
      });
      this.cache.invalidate(`edges:${projectId}`);
      return result;
    } catch (e) {
      throw new StorageError('replaceEdges', `projects/${projectId}/edges`, e);
    }
  }
}
