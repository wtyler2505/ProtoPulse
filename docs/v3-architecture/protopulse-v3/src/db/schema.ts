import { z } from 'zod';
import { integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { VerificationStatusSchema } from '../contracts/status';

export const VerifiedFactSchema = z.object({
  key: z.string(),
  value: z.unknown(),
  source: z.string(),
  status: VerificationStatusSchema,
  provenanceId: z.number().optional(),
});

export type VerifiedFact = z.infer<typeof VerifiedFactSchema>;

export const v3ProvenanceEvents = pgTable('v3_provenance_events', {
  id: serial('id').primaryKey(),
  subjectType: text('subject_type').notNull(),
  subjectKey: text('subject_key').notNull(),
  sourcePath: text('source_path').notNull(),
  sourceKind: text('source_kind').notNull(),
  status: text('status').notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const v3VerifiedFacts = pgTable('v3_verified_facts', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull(),
  factKey: text('fact_key').notNull(),
  partNumber: text('part_number').notNull(),
  sourcePath: text('source_path').notNull(),
  status: text('status').notNull(),
  value: jsonb('value').$type<unknown>().notNull(),
  provenanceEventId: integer('provenance_event_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const v3CompileRuns = pgTable('v3_compile_runs', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull(),
  status: text('status').notNull(),
  sourceShapeCount: integer('source_shape_count').notNull(),
  emittedElementCount: integer('emitted_element_count').notNull(),
  blockedReasons: jsonb('blocked_reasons').$type<string[]>().notNull().default([]),
  emittedTsx: text('emitted_tsx'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const v3SwarmTasks = pgTable('v3_swarm_tasks', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull(),
  taskId: text('task_id').notNull(),
  agentRole: text('agent_role').notNull(),
  status: text('status').notNull(),
  claimedFiles: jsonb('claimed_files').$type<string[]>().notNull().default([]),
  prompt: text('prompt').notNull(),
  result: jsonb('result').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const v3InspectionReports = pgTable('v3_inspection_reports', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull(),
  reportType: text('report_type').notNull(),
  query: text('query').notNull(),
  imageUrl: text('image_url'),
  chassisDescription: text('chassis_description'),
  markdown: text('markdown').notNull(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type V3ProvenanceEvent = typeof v3ProvenanceEvents.$inferSelect;
export type InsertV3ProvenanceEvent = typeof v3ProvenanceEvents.$inferInsert;
export type V3VerifiedFact = typeof v3VerifiedFacts.$inferSelect;
export type InsertV3VerifiedFact = typeof v3VerifiedFacts.$inferInsert;
export type V3CompileRun = typeof v3CompileRuns.$inferSelect;
export type InsertV3CompileRun = typeof v3CompileRuns.$inferInsert;
export type V3SwarmTask = typeof v3SwarmTasks.$inferSelect;
export type InsertV3SwarmTask = typeof v3SwarmTasks.$inferInsert;
export type V3InspectionReport = typeof v3InspectionReports.$inferSelect;
export type InsertV3InspectionReport = typeof v3InspectionReports.$inferInsert;
