import { desc, eq } from 'drizzle-orm';
import { db } from '../db';
import {
  v3CompileRuns,
  v3InspectionReports,
  v3SwarmTasks,
  v3VerifiedFacts,
  type InsertV3CompileRun,
  type InsertV3InspectionReport,
  type InsertV3SwarmTask,
  type InsertV3VerifiedFact,
} from '@shared/schema';

export async function createV3VerifiedFact(input: InsertV3VerifiedFact) {
  const [row] = await db.insert(v3VerifiedFacts).values(input).returning();
  return row;
}

export async function listV3VerifiedFacts(projectId: number) {
  return db.select().from(v3VerifiedFacts).where(eq(v3VerifiedFacts.projectId, projectId)).orderBy(desc(v3VerifiedFacts.createdAt));
}

export async function createV3CompileRun(input: InsertV3CompileRun) {
  const [row] = await db.insert(v3CompileRuns).values(input).returning();
  return row;
}

export async function listV3CompileRuns(projectId: number) {
  return db.select().from(v3CompileRuns).where(eq(v3CompileRuns.projectId, projectId)).orderBy(desc(v3CompileRuns.createdAt));
}

export async function createV3SwarmTask(input: InsertV3SwarmTask) {
  const [row] = await db
    .insert(v3SwarmTasks)
    .values(input)
    .onConflictDoUpdate({
      target: [v3SwarmTasks.projectId, v3SwarmTasks.taskId],
      set: {
        status: input.status ?? 'planned',
        agentType: input.agentType,
        claimedFiles: input.claimedFiles,
        forbiddenFiles: input.forbiddenFiles,
        commandTemplate: input.commandTemplate,
        result: input.result ?? {},
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}

export async function listV3SwarmTasks(projectId: number) {
  return db.select().from(v3SwarmTasks).where(eq(v3SwarmTasks.projectId, projectId)).orderBy(desc(v3SwarmTasks.createdAt));
}

export async function createV3InspectionReport(input: InsertV3InspectionReport) {
  const [row] = await db.insert(v3InspectionReports).values(input).returning();
  return row;
}

export async function listV3InspectionReports(projectId: number) {
  return db.select().from(v3InspectionReports).where(eq(v3InspectionReports.projectId, projectId)).orderBy(desc(v3InspectionReports.createdAt));
}
