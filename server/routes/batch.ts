/**
 * Batch analysis API routes.
 *
 * Exposes Anthropic's Message Batches API for running background analysis
 * tasks (architecture review, DRC deep-dive, BOM optimization, etc.)
 * at 50% cost via asynchronous batch processing.
 */

import type { Express } from 'express';
import { z } from 'zod';
import { asyncHandler, HttpError } from './utils';
import { requireProjectOwnership } from './auth-middleware';
import { validateSession } from '../auth';
import { storage } from '../storage';
import {
  submitBatchAnalysis,
  getBatchStatus,
  getBatchResults,
  cancelBatch,
  listProjectBatches,
  getBatchProjectId,
  ANALYSIS_CATALOG,
} from '../batch-analysis';
import type { AnalysisKind } from '../batch-analysis';
import { logger } from '../logger';

/**
 * BL-0642: Verify the caller's session owns the project associated with a batch.
 * Returns the projectId on success, throws HttpError on failure.
 */
async function verifyBatchOwnership(batchId: string, sessionHeader: string | string[] | undefined): Promise<number> {
  const projectId = getBatchProjectId(batchId);
  if (projectId === null) {
    throw new HttpError('Batch not found', 404);
  }

  const sessionId = Array.isArray(sessionHeader) ? sessionHeader[0] : sessionHeader;
  if (!sessionId) {
    throw new HttpError('Authentication required', 401);
  }

  const session = await validateSession(sessionId);
  if (!session) {
    throw new HttpError('Invalid or expired session', 401);
  }

  const project = await storage.getProject(projectId);
  if (!project) {
    throw new HttpError('Batch not found', 404);
  }

  if (project.ownerId !== null && project.ownerId !== session.userId) {
    throw new HttpError('Batch not found', 404);
  }

  return projectId;
}

const VALID_KINDS = new Set(ANALYSIS_CATALOG.map(a => a.kind));

const submitSchema = z.object({
  projectId: z.number().int().positive(),
  analyses: z.array(z.string()).min(1).max(6),
  model: z.string().optional(),
});

function extractApiKey(header: string | string[] | undefined): string {
  if (Array.isArray(header)) { return header[0]; }
  return header ?? '';
}

export function registerBatchRoutes(app: Express): void {

  // ---- List available analysis types ----

  app.get('/api/batch/catalog', asyncHandler(async (_req, res) => {
    res.json({ analyses: ANALYSIS_CATALOG });
  }));

  // ---- Submit a batch analysis ----

  app.post('/api/batch/submit', asyncHandler(async (req, res) => {
    const apiKey = extractApiKey(req.headers['x-anthropic-key']);
    if (!apiKey) {
      throw new HttpError('Missing X-Anthropic-Key header', 401);
    }

    const body = submitSchema.parse(req.body);

    // Verify project ownership
    const sessionId = req.headers['x-session-id'] as string | undefined;
    if (!sessionId) {
      throw new HttpError('Authentication required', 401);
    }
    const session = await validateSession(sessionId);
    if (!session) {
      throw new HttpError('Invalid or expired session', 401);
    }
    const project = await storage.getProject(body.projectId);
    if (!project) {
      throw new HttpError('Project not found', 404);
    }
    if (project.ownerId !== null && project.ownerId !== session.userId) {
      throw new HttpError('Project not found', 404);
    }

    // Validate all analysis kinds
    const invalidKinds = body.analyses.filter(k => !VALID_KINDS.has(k as AnalysisKind));
    if (invalidKinds.length > 0) {
      throw new HttpError(`Invalid analysis kinds: ${invalidKinds.join(', ')}. Valid: ${Array.from(VALID_KINDS).join(', ')}`, 400);
    }

    const result = await submitBatchAnalysis({
      projectId: body.projectId,
      analyses: body.analyses as AnalysisKind[],
      apiKey,
      model: body.model,
    });

    res.status(202).json(result);
  }));

  // ---- Check batch status ----
  // BL-0642: Verify caller owns the project this batch belongs to

  app.get('/api/batch/:batchId/status', asyncHandler(async (req, res) => {
    const apiKey = extractApiKey(req.headers['x-anthropic-key']);
    if (!apiKey) {
      throw new HttpError('Missing X-Anthropic-Key header', 401);
    }

    const batchId = req.params.batchId as string;
    if (!batchId) {
      throw new HttpError('Missing batchId parameter', 400);
    }

    await verifyBatchOwnership(batchId, req.headers['x-session-id']);
    const status = await getBatchStatus(batchId, apiKey);
    res.json(status);
  }));

  // ---- Retrieve batch results ----
  // BL-0642: Verify caller owns the project this batch belongs to

  app.get('/api/batch/:batchId/results', asyncHandler(async (req, res) => {
    const apiKey = extractApiKey(req.headers['x-anthropic-key']);
    if (!apiKey) {
      throw new HttpError('Missing X-Anthropic-Key header', 401);
    }

    const batchId = req.params.batchId as string;
    if (!batchId) {
      throw new HttpError('Missing batchId parameter', 400);
    }

    await verifyBatchOwnership(batchId, req.headers['x-session-id']);

    // First check if the batch has ended
    const status = await getBatchStatus(batchId, apiKey);
    if (status.status !== 'completed') {
      res.json({
        batchId,
        status: status.status,
        message: `Batch is still ${status.status}. Results not yet available.`,
        requestCounts: status.requestCounts,
      });
      return;
    }

    const results = await getBatchResults(batchId, apiKey);
    res.json({
      batchId,
      status: 'ended',
      results,
      requestCounts: status.requestCounts,
    });
  }));

  // ---- Cancel a batch ----
  // BL-0642: Verify caller owns the project this batch belongs to

  app.post('/api/batch/:batchId/cancel', asyncHandler(async (req, res) => {
    const apiKey = extractApiKey(req.headers['x-anthropic-key']);
    if (!apiKey) {
      throw new HttpError('Missing X-Anthropic-Key header', 401);
    }

    const batchId = req.params.batchId as string;
    if (!batchId) {
      throw new HttpError('Missing batchId parameter', 400);
    }

    await verifyBatchOwnership(batchId, req.headers['x-session-id']);
    const status = await cancelBatch(batchId, apiKey);
    logger.info('batch:route:cancel', { batchId });
    res.json(status);
  }));

  // ---- List batches for a project ----

  app.get('/api/projects/:projectId/batches', requireProjectOwnership, asyncHandler(async (req, res) => {
    const projectId = Number(req.params.projectId);
    if (!Number.isFinite(projectId) || projectId <= 0) {
      throw new HttpError('Invalid projectId', 400);
    }

    const batches = listProjectBatches(projectId);
    res.json({ batches });
  }));
}
