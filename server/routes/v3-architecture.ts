import type { Express } from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error/v3';
import {
  insertV3CompileRunSchema,
  insertV3InspectionReportSchema,
  insertV3SwarmTaskSchema,
  insertV3VerifiedFactSchema,
} from '@shared/schema';
import { asyncHandler, parseIdParam, payloadLimit } from './utils';
import { requireProjectOwnership } from './auth-middleware';
import {
  createV3CompileRun,
  createV3InspectionReport,
  createV3SwarmTask,
  createV3VerifiedFact,
  listV3CompileRuns,
  listV3InspectionReports,
  listV3SwarmTasks,
  listV3VerifiedFacts,
} from '../lib/v3-architecture-storage';

const projectScopedCompileRunSchema = insertV3CompileRunSchema.omit({ projectId: true });
const projectScopedInspectionReportSchema = insertV3InspectionReportSchema.omit({ projectId: true });
const projectScopedSwarmTaskSchema = insertV3SwarmTaskSchema.omit({ projectId: true });
const projectScopedVerifiedFactSchema = insertV3VerifiedFactSchema.omit({ projectId: true });
const jsonListSchema = z.array(z.unknown()).default([]);

export function registerV3ArchitectureRoutes(app: Express): void {
  const prefix = '/api/projects/:id/v3-architecture';

  app.get(`${prefix}/verified-facts`, requireProjectOwnership, asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const rows = await listV3VerifiedFacts(projectId);
    res.json({ data: rows, total: rows.length });
  }));

  app.post(
    `${prefix}/verified-facts`,
    requireProjectOwnership,
    payloadLimit(128 * 1024),
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const parsed = projectScopedVerifiedFactSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }
      const row = await createV3VerifiedFact({ ...parsed.data, projectId });
      res.status(201).json(row);
    }),
  );

  app.get(`${prefix}/compile-runs`, requireProjectOwnership, asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const rows = await listV3CompileRuns(projectId);
    res.json({ data: rows, total: rows.length });
  }));

  app.post(
    `${prefix}/compile-runs`,
    requireProjectOwnership,
    payloadLimit(1024 * 1024),
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const parsed = projectScopedCompileRunSchema.extend({
        acceptedFacts: jsonListSchema,
        missingFacts: jsonListSchema,
        blockedTasks: jsonListSchema,
      }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }
      const row = await createV3CompileRun({ ...parsed.data, projectId });
      res.status(201).json(row);
    }),
  );

  app.get(`${prefix}/inspection-reports`, requireProjectOwnership, asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const rows = await listV3InspectionReports(projectId);
    res.json({ data: rows, total: rows.length });
  }));

  app.post(
    `${prefix}/inspection-reports`,
    requireProjectOwnership,
    payloadLimit(512 * 1024),
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const parsed = projectScopedInspectionReportSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }
      const row = await createV3InspectionReport({ ...parsed.data, projectId });
      res.status(201).json(row);
    }),
  );

  app.get(`${prefix}/swarm-tasks`, requireProjectOwnership, asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const rows = await listV3SwarmTasks(projectId);
    res.json({ data: rows, total: rows.length });
  }));

  app.post(
    `${prefix}/swarm-tasks`,
    requireProjectOwnership,
    payloadLimit(256 * 1024),
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const parsed = projectScopedSwarmTaskSchema.extend({
        claimedFiles: z.array(z.string()).default([]),
        forbiddenFiles: z.array(z.string()).default([]),
        result: z.record(z.string(), z.unknown()).default({}),
      }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }
      const row = await createV3SwarmTask({ ...parsed.data, projectId });
      res.status(201).json(row);
    }),
  );
}
