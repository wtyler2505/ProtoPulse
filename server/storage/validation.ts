import { eq, and, desc, asc } from 'drizzle-orm';
import {
  validationIssues, type ValidationIssue, type InsertValidationIssue,
} from '@shared/schema';
import { StorageError } from './errors';
import type { StorageDeps } from './types';
import type { PaginationOptions } from './interfaces';
import { chunkedInsert } from './utils';

export class ValidationStorage {
  constructor(private deps: StorageDeps) {}

  private get db() { return this.deps.db; }

  async getValidationIssues(projectId: number, opts?: PaginationOptions): Promise<ValidationIssue[]> {
    const { limit = 50, offset = 0, sort = 'desc' } = opts || {};
    return this.db.select().from(validationIssues)
      .where(eq(validationIssues.projectId, projectId))
      .orderBy(sort === 'desc' ? desc(validationIssues.id) : asc(validationIssues.id))
      .limit(limit)
      .offset(offset);
  }

  async createValidationIssue(issue: InsertValidationIssue): Promise<ValidationIssue> {
    const [created] = await this.db.insert(validationIssues).values(issue).returning();
    return created;
  }

  async deleteValidationIssue(id: number, projectId: number): Promise<boolean> {
    const result = await this.db.delete(validationIssues)
      .where(and(eq(validationIssues.id, id), eq(validationIssues.projectId, projectId)))
      .returning();
    return result.length > 0;
  }

  async deleteValidationIssuesByProject(projectId: number): Promise<void> {
    await this.db.delete(validationIssues).where(eq(validationIssues.projectId, projectId));
  }

  async bulkCreateValidationIssues(issues: InsertValidationIssue[]): Promise<ValidationIssue[]> {
    if (issues.length === 0) { return []; }
    try {
      return await chunkedInsert<ValidationIssue>(this.db, validationIssues, issues);
    } catch (e) {
      throw new StorageError('bulkCreateValidationIssues', 'validationIssues', e);
    }
  }

  async replaceValidationIssues(projectId: number, issues: InsertValidationIssue[]): Promise<ValidationIssue[]> {
    try {
      return await this.db.transaction(async (tx) => {
        await tx.delete(validationIssues).where(eq(validationIssues.projectId, projectId));
        if (issues.length === 0) { return []; }
        return tx.insert(validationIssues).values(issues).returning();
      });
    } catch (e) {
      throw new StorageError('replaceValidationIssues', `projects/${projectId}/validation`, e);
    }
  }
}
