/**
 * Job queue API routes.
 *
 * Exposes the in-process async job queue for submitting, monitoring,
 * cancelling, and cleaning up long-running tasks.
 */

import { z } from 'zod';
import { asyncHandler, HttpError } from './utils';
import { jobQueue } from '../job-queue';

import type { Express } from 'express';
import type { JobStatus, JobType } from '../job-queue';

const JOB_TYPES = ['ai_analysis', 'export_generation', 'batch_drc', 'report_generation', 'import_processing'] as const;
const JOB_STATUSES = ['pending', 'running', 'completed', 'failed', 'cancelled'] as const;

const submitSchema = z.object({
  type: z.enum(JOB_TYPES),
  payload: z.unknown().default(null),
  priority: z.number().int().min(1).max(10).optional(),
  maxRetries: z.number().int().min(0).max(10).optional(),
});

const listQuerySchema = z.object({
  status: z.enum(JOB_STATUSES).optional(),
  type: z.enum(JOB_TYPES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export function registerJobRoutes(app: Express): void {
  // ---- POST /api/jobs — Submit a new job ----

  app.post(
    '/api/jobs',
    asyncHandler(async (req, res) => {
      const body = submitSchema.safeParse(req.body);
      if (!body.success) {
        throw new HttpError('Invalid job submission', 400);
      }

      const { type, payload, priority, maxRetries } = body.data;
      const job = jobQueue.submit(type, payload, { priority, maxRetries });

      res.status(202).json(job);
    }),
  );

  // ---- GET /api/jobs — List jobs ----

  app.get(
    '/api/jobs',
    asyncHandler(async (req, res) => {
      const query = listQuerySchema.safeParse(req.query);
      if (!query.success) {
        throw new HttpError('Invalid query parameters', 400);
      }

      const { status, type, limit, offset } = query.data;
      const result = jobQueue.listJobs({
        status: status as JobStatus | undefined,
        type: type as JobType | undefined,
        limit,
        offset,
      });

      res.json({
        jobs: result.jobs,
        total: result.total,
        limit,
        offset,
      });
    }),
  );

  // ---- GET /api/jobs/:id — Get job status ----

  app.get(
    '/api/jobs/:id',
    asyncHandler(async (req, res) => {
      const id = String(req.params.id);
      if (!id) {
        throw new HttpError('Missing job id', 400);
      }

      const job = jobQueue.getJob(id);
      if (!job) {
        throw new HttpError('Job not found', 404);
      }

      res.json(job);
    }),
  );

  // ---- POST /api/jobs/:id/cancel — Cancel a job ----

  app.post(
    '/api/jobs/:id/cancel',
    asyncHandler(async (req, res) => {
      const id = String(req.params.id);
      if (!id) {
        throw new HttpError('Missing job id', 400);
      }

      const job = jobQueue.cancel(id);
      if (!job) {
        throw new HttpError('Job not found', 404);
      }

      res.json(job);
    }),
  );

  // ---- DELETE /api/jobs/:id — Remove a completed/failed/cancelled job ----

  app.delete(
    '/api/jobs/:id',
    asyncHandler(async (req, res) => {
      const id = String(req.params.id);
      if (!id) {
        throw new HttpError('Missing job id', 400);
      }

      const removed = jobQueue.remove(id);
      if (!removed) {
        const job = jobQueue.getJob(id);
        if (!job) {
          throw new HttpError('Job not found', 404);
        }
        throw new HttpError('Cannot remove a pending or running job — cancel it first', 409);
      }

      res.status(204).end();
    }),
  );
}
