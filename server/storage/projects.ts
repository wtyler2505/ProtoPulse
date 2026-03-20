import { eq, and, desc, asc, isNull, sql, inArray } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import {
  projects, type Project, type InsertProject,
  projectMembers, type ProjectMember, type InsertProjectMember,
  architectureNodes, architectureEdges, bomItems,
} from '@shared/schema';
import { StorageError, VersionConflictError } from './errors';
import type { StorageDeps } from './types';
import type { PaginationOptions } from './interfaces';

export class ProjectStorage {
  constructor(private deps: StorageDeps) {}

  private get db() { return this.deps.db; }
  private get cache() { return this.deps.cache; }

  async getProjects(opts?: PaginationOptions): Promise<Project[]> {
    try {
      const { limit = 50, offset = 0, sort = 'desc' } = opts || {};
      return await this.db.select().from(projects)
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
      const cached = this.cache.get<Project>(cacheKey);
      if (cached) { return cached; }
      const [project] = await this.db.select().from(projects).where(and(eq(projects.id, id), isNull(projects.deletedAt)));
      if (project) { this.cache.set(cacheKey, project); }
      return project;
    } catch (e) {
      throw new StorageError('getProject', `projects/${id}`, e);
    }
  }

  async getProjectsByOwner(userId: number): Promise<Project[]> {
    try {
      return await this.db.select().from(projects)
        .where(and(eq(projects.ownerId, userId), isNull(projects.deletedAt)))
        .orderBy(desc(projects.id));
    } catch (e) {
      throw new StorageError('getProjectsByOwner', `users/${userId}/projects`, e);
    }
  }

  async isProjectOwner(projectId: number, userId: number): Promise<boolean> {
    try {
      const [project] = await this.db.select({ ownerId: projects.ownerId })
        .from(projects)
        .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)));
      if (!project) { return false; }
      // Projects with no owner are accessible to anyone (backward compat)
      if (project.ownerId === null) { return true; }
      return project.ownerId === userId;
    } catch (e) {
      throw new StorageError('isProjectOwner', `projects/${projectId}`, e);
    }
  }

  async getProjectMembers(projectId: number): Promise<ProjectMember[]> {
    try {
      return await this.db.select().from(projectMembers).where(eq(projectMembers.projectId, projectId));
    } catch (e) {
      throw new StorageError('getProjectMembers', `projects/${projectId}/members`, e);
    }
  }

  async addProjectMember(member: InsertProjectMember): Promise<ProjectMember> {
    try {
      const [created] = await this.db.insert(projectMembers).values(member).returning();
      return created;
    } catch (e) {
      throw new StorageError('addProjectMember', `projects/${member.projectId}/members`, e);
    }
  }

  async updateProjectMember(projectId: number, userId: number, data: Partial<InsertProjectMember>): Promise<ProjectMember | undefined> {
    try {
      const [updated] = await this.db.update(projectMembers)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
        .returning();
      return updated;
    } catch (e) {
      throw new StorageError('updateProjectMember', `projects/${projectId}/members/${userId}`, e);
    }
  }

  async removeProjectMember(projectId: number, userId: number): Promise<boolean> {
    try {
      const [deleted] = await this.db.delete(projectMembers)
        .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
        .returning();
      return !!deleted;
    } catch (e) {
      throw new StorageError('removeProjectMember', `projects/${projectId}/members/${userId}`, e);
    }
  }

  async createProject(project: InsertProject, ownerId?: number): Promise<Project> {
    try {
      const [created] = await this.db.insert(projects).values({ ...project, ownerId: ownerId ?? null }).returning();
      return created;
    } catch (e) {
      throw new StorageError('createProject', 'projects', e);
    }
  }

  async updateProject(id: number, data: Partial<InsertProject>, expectedVersion?: number): Promise<Project | undefined> {
    try {
      const conditions = [eq(projects.id, id), isNull(projects.deletedAt)];
      if (expectedVersion !== undefined) {
        conditions.push(eq(projects.version, expectedVersion));
      }
      const [updated] = await this.db.update(projects)
        .set({ ...data, version: sql`${projects.version} + 1`, updatedAt: new Date() })
        .where(and(...conditions))
        .returning();
      if (expectedVersion !== undefined && !updated) {
        const [existing] = await this.db.select({ id: projects.id, version: projects.version })
          .from(projects).where(and(eq(projects.id, id), isNull(projects.deletedAt)));
        if (existing) {
          throw new VersionConflictError('projects', id, existing.version);
        }
      }
      if (updated) { this.cache.invalidate(`project:${id}`); }
      return updated;
    } catch (e) {
      if (e instanceof StorageError) { throw e; }
      throw new StorageError('updateProject', `projects/${id}`, e);
    }
  }

  async deleteProject(id: number): Promise<boolean> {
    try {
      const now = new Date();
      const result = await this.db.transaction(async (tx) => {
        const [project] = await tx.update(projects).set({ deletedAt: now }).where(and(eq(projects.id, id), isNull(projects.deletedAt))).returning();
        if (!project) { return false; }
        await tx.update(architectureNodes).set({ deletedAt: now }).where(eq(architectureNodes.projectId, id));
        await tx.update(architectureEdges).set({ deletedAt: now }).where(eq(architectureEdges.projectId, id));
        await tx.update(bomItems).set({ deletedAt: now }).where(eq(bomItems.projectId, id));
        return true;
      });
      if (result) {
        this.cache.invalidate(`project:${id}`);
        this.cache.invalidate(`nodes:${id}`);
        this.cache.invalidate(`edges:${id}`);
        this.cache.invalidate(`bom:${id}`);
      }
      return result;
    } catch (e) {
      throw new StorageError('deleteProject', `projects/${id}`, e);
    }
  }
}
