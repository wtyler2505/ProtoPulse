/**
 * Job queue API routes.
 *
 * Exposes the in-process async job queue for submitting, monitoring,
 * cancelling, and cleaning up long-running tasks.
 *
 * All listing/status/cancel operations are scoped to the authenticated user's
 * jobs — users can only see and manage jobs they submitted.
 */

import { z } from 'zod';
import { HttpError } from './utils';
import { jobQueue } from '../job-queue';
import { validateSession } from '../auth';

import type { Express } from 'express';
import type { JobStatus, JobType } from '../job-queue';

const JOB_TYPES = ['ai_analysis', 'export_generation', 'batch_drc', 'report_generation', 'import_processing'] as const;
const JOB_STATUSES = ['pending', 'running', 'completed', 'failed', 'cancelled'] as const;

const submitSchema = z.object({
  type: z.enum(JOB_TYPES),
  payload: z.unknown().default(null),
  priority: z.number().int().min(1).max(10).optional(),
  maxRetries: z.number().int().min(0).max(10).optional(),
  projectId: z.number().int().optional(),
  maxRunTimeMs: z.number().int().min(1000).max(3_600_000).optional(),
});

const listQuerySchema = z.object({
  status: z.enum(JOB_STATUSES).optional(),
  type: z.enum(JOB_TYPES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Extract and validate the authenticated user from the request.
 * Returns userId or throws 401.
 */
async function requireAuth(req: { headers: Record<string, string | string[] | undefined> }): Promise<number> {
  const sessionId = req.headers['x-session-id'] as string | undefined;
  if (!sessionId) {
    throw new HttpError('Authentication required', 401);
  }
  const session = await validateSession(sessionId);
  if (!session) {
    throw new HttpError('Invalid or expired session', 401);
  }
  return session.userId;
}

export function registerJobRoutes(app: Express): void {
  // ---- POST /api/jobs — Submit a new job ----

  app.post(
    '/api/jobs',
    async (req, res) => {
      const userId = await requireAuth(req);

      const body = submitSchema.safeParse(req.body);
      if (!body.success) {
        throw new HttpError('Invalid job submission', 400);
      }

      const { type, payload, priority, maxRetries, projectId, maxRunTimeMs } = body.data;
      const job = jobQueue.submit(type, payload, {
        priority,
        maxRetries,
        projectId,
        userId,
        maxRunTimeMs,
      });

      res.status(202).json(job);
    },
  );

  // ---- GET /api/jobs — List jobs (scoped to authenticated user) ----

  app.get(
    '/api/jobs',
    async (req, res) => {
      const userId = await requireAuth(req);

      const query = listQuerySchema.safeParse(req.query);
      if (!query.success) {
        throw new HttpError('Invalid query parameters', 400);
      }

      const { status, type, limit, offset } = query.data;

      // Get all jobs for this user, then apply additional filters
      let userJobs = jobQueue.listByUser(userId);

      if (status) {
        userJobs = userJobs.filter((j) => j.status === status);
      }
      if (type) {
        userJobs = userJobs.filter((j) => j.type === type);
      }

      const total = userJobs.length;
      const paged = userJobs.slice(offset, offset + limit);

      res.json({
        jobs: paged,
        total,
        limit,
        offset,
      });
    },
  );

  // ---- GET /api/jobs/:id — Get job status (ownership enforced) ----

  app.get(
    '/api/jobs/:id',
    async (req, res) => {
      const userId = await requireAuth(req);

      const id = String(req.params.id);
      if (!id) {
        throw new HttpError('Missing job id', 400);
      }

      const job = jobQueue.getJob(id);
      if (!job || job.userId !== userId) {
        throw new HttpError('Job not found', 404);
      }

      res.json(job);
    },
  );

  // ---- POST /api/jobs/:id/cancel — Cancel a job (ownership enforced) ----

  app.post(
    '/api/jobs/:id/cancel',
    async (req, res) => {
      const userId = await requireAuth(req);

      const id = String(req.params.id);
      if (!id) {
        throw new HttpError('Missing job id', 400);
      }

      // Check ownership before cancelling
      const existing = jobQueue.getJob(id);
      if (!existing || existing.userId !== userId) {
        throw new HttpError('Job not found', 404);
      }

      const job = jobQueue.cancel(id);
      if (!job) {
        throw new HttpError('Job not found', 404);
      }

      res.json(job);
    },
  );

  // ---- DELETE /api/jobs/:id — Remove a completed/failed/cancelled job (ownership enforced) ----

  app.delete(
    '/api/jobs/:id',
    async (req, res) => {
      const userId = await requireAuth(req);

      const id = String(req.params.id);
      if (!id) {
        throw new HttpError('Missing job id', 400);
      }

      // Check ownership before removing
      const existing = jobQueue.getJob(id);
      if (!existing || existing.userId !== userId) {
        throw new HttpError('Job not found', 404);
      }

      const removed = jobQueue.remove(id);
      if (!removed) {
        throw new HttpError('Cannot remove a pending or running job — cancel it first', 409);
      }

      res.status(204).end();
    },
  );
}
