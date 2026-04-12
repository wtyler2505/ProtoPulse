/**
 * Supply chain monitoring routes — Phase 7.5.
 *
 * GET  /api/supply-chain/alerts          — list alerts (filterable)
 * GET  /api/supply-chain/alerts/count    — unacknowledged count (for badge)
 * POST /api/supply-chain/alerts/:id/ack  — acknowledge single alert
 * POST /api/supply-chain/alerts/ack-all  — acknowledge all
 * POST /api/supply-chain/check           — trigger a supply chain check job
 */

import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import { validateSession } from '../auth';
import { supplyChainStorage, StorageError } from '../storage';
import { jobQueue } from '../job-queue';
import { logger } from '../logger';

export function registerSupplyChainRoutes(app: Express): void {
  // GET /api/supply-chain/alerts
  app.get('/api/supply-chain/alerts', validateSession, async (req: Request, res: Response) => {
    try {
      const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
      const partId = req.query.partId ? String(req.query.partId) : undefined;
      const unacknowledgedOnly = req.query.unacknowledgedOnly === 'true';
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const offset = req.query.offset ? Number(req.query.offset) : 0;

      const result = await supplyChainStorage.getAlerts({
        projectId,
        partId,
        unacknowledgedOnly,
        limit,
        offset,
      });
      res.json(result);
    } catch (err) {
      if (err instanceof StorageError) {
        logger.error('GET /api/supply-chain/alerts failed', { message: err.message });
        res.status(500).json({ message: 'Failed to get alerts' });
        return;
      }
      throw err;
    }
  });

  // GET /api/supply-chain/alerts/count
  app.get('/api/supply-chain/alerts/count', validateSession, async (req: Request, res: Response) => {
    try {
      const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
      const count = await supplyChainStorage.getUnacknowledgedCount(projectId);
      res.json({ count });
    } catch (err) {
      if (err instanceof StorageError) {
        logger.error('GET /api/supply-chain/alerts/count failed', { message: err.message });
        res.status(500).json({ message: 'Failed to get alert count' });
        return;
      }
      throw err;
    }
  });

  // POST /api/supply-chain/alerts/:id/ack
  app.post('/api/supply-chain/alerts/:id/ack', validateSession, async (req: Request, res: Response) => {
    const alertId = String(req.params.id);
    try {
      const acknowledged = await supplyChainStorage.acknowledgeAlert(alertId);
      if (!acknowledged) {
        res.status(404).json({ message: 'Alert not found or already acknowledged' });
        return;
      }
      res.json({ success: true });
    } catch (err) {
      if (err instanceof StorageError) {
        logger.error('POST /api/supply-chain/alerts/:id/ack failed', { message: err.message });
        res.status(500).json({ message: 'Failed to acknowledge alert' });
        return;
      }
      throw err;
    }
  });

  // POST /api/supply-chain/alerts/ack-all
  app.post('/api/supply-chain/alerts/ack-all', validateSession, async (req: Request, res: Response) => {
    try {
      const projectId = req.body?.projectId ? Number(req.body.projectId) : undefined;
      const count = await supplyChainStorage.acknowledgeAll(projectId);
      res.json({ acknowledged: count });
    } catch (err) {
      if (err instanceof StorageError) {
        logger.error('POST /api/supply-chain/alerts/ack-all failed', { message: err.message });
        res.status(500).json({ message: 'Failed to acknowledge alerts' });
        return;
      }
      throw err;
    }
  });

  // POST /api/supply-chain/check — trigger a supply chain check
  app.post('/api/supply-chain/check', validateSession, async (req: Request, res: Response) => {
    const parsed = z.object({
      projectId: z.number().int().positive(),
    }).safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ message: 'projectId is required' });
      return;
    }

    try {
      const session = (req as unknown as Record<string, unknown>).session as { userId: number };
      const jobId = await jobQueue.submit('supply_chain_check', {
        projectId: parsed.data.projectId,
        userId: session.userId,
      }, {
        projectId: parsed.data.projectId,
        userId: session.userId,
        maxRetries: 1,
        maxRunTimeMs: 120_000,
      });
      res.json({ jobId, message: 'Supply chain check started' });
    } catch (err) {
      logger.error('POST /api/supply-chain/check failed', { message: (err as Error).message });
      res.status(500).json({ message: 'Failed to start supply chain check' });
    }
  });
}
