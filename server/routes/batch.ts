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
import {
  submitBatchAnalysis,
  getBatchStatus,
  getBatchResults,
  cancelBatch,
  listProjectBatches,
  ANALYSIS_CATALOG,
} from '../batch-analysis';
import type { AnalysisKind } from '../batch-analysis';
import { logger } from '../logger';

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

  app.get('/api/batch/:batchId/status', asyncHandler(async (req, res) => {
    const apiKey = extractApiKey(req.headers['x-anthropic-key']);
    if (!apiKey) {
      throw new HttpError('Missing X-Anthropic-Key header', 401);
    }

    const batchId = req.params.batchId as string;
    if (!batchId) {
      throw new HttpError('Missing batchId parameter', 400);
    }

    const status = await getBatchStatus(batchId, apiKey);
    res.json(status);
  }));

  // ---- Retrieve batch results ----

  app.get('/api/batch/:batchId/results', asyncHandler(async (req, res) => {
    const apiKey = extractApiKey(req.headers['x-anthropic-key']);
    if (!apiKey) {
      throw new HttpError('Missing X-Anthropic-Key header', 401);
    }

    const batchId = req.params.batchId as string;
    if (!batchId) {
      throw new HttpError('Missing batchId parameter', 400);
    }

    // First check if the batch has ended
    const status = await getBatchStatus(batchId, apiKey);
    if (status.status !== 'ended') {
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

  app.post('/api/batch/:batchId/cancel', asyncHandler(async (req, res) => {
    const apiKey = extractApiKey(req.headers['x-anthropic-key']);
    if (!apiKey) {
      throw new HttpError('Missing X-Anthropic-Key header', 401);
    }

    const batchId = req.params.batchId as string;
    if (!batchId) {
      throw new HttpError('Missing batchId parameter', 400);
    }

    const status = await cancelBatch(batchId, apiKey);
    logger.info('batch:route:cancel', { batchId });
    res.json(status);
  }));

  // ---- List batches for a project ----

  app.get('/api/projects/:projectId/batches', asyncHandler(async (req, res) => {
    const projectId = Number(req.params.projectId);
    if (!Number.isFinite(projectId) || projectId <= 0) {
      throw new HttpError('Invalid projectId', 400);
    }

    const batches = listProjectBatches(projectId);
    res.json({ batches });
  }));
}
