import type { Express } from 'express';
import { isNotNull, lte, and, count } from 'drizzle-orm';
import { db } from '../db';
import { architectureNodes, architectureEdges, bomItems, projects } from '@shared/schema';
import { asyncHandler } from './utils';
import { logger } from '../logger';
import { getMetrics } from '../metrics';

function maskKey(key: string): string {
  if (key.length <= 8) {
    return '***';
  }
  return key.slice(0, 8) + '...';
}

export function registerAdminRoutes(app: Express): void {
  // --- Admin: Metrics ---

  app.get(
    '/api/admin/metrics',
    asyncHandler(async (req, res) => {
      const adminKey = req.headers['x-admin-key'];
      const expectedKey = process.env.ADMIN_API_KEY;

      if (!expectedKey || adminKey !== expectedKey) {
        return res.status(403).json({ error: 'Forbidden: valid admin key required' });
      }

      res.json(getMetrics());
    }),
  );

  // --- Admin: Purge soft-deleted records ---

  app.delete(
    '/api/admin/purge',
    asyncHandler(async (req, res) => {
      // --- Admin authorization ---
      const adminKey = req.headers['x-admin-key'];
      const expectedKey = process.env.ADMIN_API_KEY;

      if (!expectedKey || adminKey !== expectedKey) {
        return res.status(403).json({ error: 'Forbidden: valid admin key required' });
      }

      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const isDryRun = req.query.dryRun === 'true';

      // --- Count affected entities ---
      const [nodesCount] = await db
        .select({ total: count() })
        .from(architectureNodes)
        .where(and(isNotNull(architectureNodes.deletedAt), lte(architectureNodes.deletedAt, cutoff)));
      const [edgesCount] = await db
        .select({ total: count() })
        .from(architectureEdges)
        .where(and(isNotNull(architectureEdges.deletedAt), lte(architectureEdges.deletedAt, cutoff)));
      const [bomCount] = await db
        .select({ total: count() })
        .from(bomItems)
        .where(and(isNotNull(bomItems.deletedAt), lte(bomItems.deletedAt, cutoff)));
      const [projectsCount] = await db
        .select({ total: count() })
        .from(projects)
        .where(and(isNotNull(projects.deletedAt), lte(projects.deletedAt, cutoff)));

      const counts = {
        architectureNodes: nodesCount.total,
        architectureEdges: edgesCount.total,
        bomItems: bomCount.total,
        projects: projectsCount.total,
      };

      // --- Audit trail ---
      logger.info('admin:purge', {
        actor: maskKey(String(adminKey)),
        ip: req.ip,
        cutoff: cutoff.toISOString(),
        counts,
        dryRun: isDryRun,
        timestamp: new Date().toISOString(),
      });

      // --- Dry-run mode ---
      if (isDryRun) {
        return res.json({ dryRun: true, counts });
      }

      // --- Execute purge ---
      await db
        .delete(architectureNodes)
        .where(and(isNotNull(architectureNodes.deletedAt), lte(architectureNodes.deletedAt, cutoff)));
      await db
        .delete(architectureEdges)
        .where(and(isNotNull(architectureEdges.deletedAt), lte(architectureEdges.deletedAt, cutoff)));
      await db.delete(bomItems).where(and(isNotNull(bomItems.deletedAt), lte(bomItems.deletedAt, cutoff)));
      await db.delete(projects).where(and(isNotNull(projects.deletedAt), lte(projects.deletedAt, cutoff)));

      res.json({ message: 'Purge complete', counts });
    }),
  );
}
