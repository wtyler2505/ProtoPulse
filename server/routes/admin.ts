import crypto from 'crypto';

import { isNotNull, lte, and, count } from 'drizzle-orm';
import rateLimit from 'express-rate-limit';

import { architectureNodes, architectureEdges, bomItems, projects } from '@shared/schema';

import { db } from '../db';
import { getPolicies, runRetention, runSinglePolicy } from '../lib/data-retention';
import { logger } from '../logger';
import { getMetrics } from '../metrics';
import { asyncHandler } from './utils';

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Express } from 'express';

function maskKey(key: string): string {
  if (key.length <= 8) {
    return '***';
  }
  return key.slice(0, 8) + '...';
}

/** Timing-safe comparison of admin API keys using SHA-256 digests. */
export function safeCompareAdminKey(provided: string, expected: string): boolean {
  if (!provided || !expected) {
    return false;
  }
  const providedHash = crypto.createHash('sha256').update(provided).digest();
  const expectedHash = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(providedHash, expectedHash);
}

const adminRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many admin requests. Try again later.' },
});

export function registerAdminRoutes(app: Express): void {
  // --- Admin: Metrics ---

  app.get(
    '/api/admin/metrics',
    adminRateLimiter,
    asyncHandler(async (req, res) => {
      const adminKey = req.headers['x-admin-key'];
      const expectedKey = process.env.ADMIN_API_KEY;

      if (!safeCompareAdminKey(String(adminKey), expectedKey ?? '')) {
        return res.status(403).json({ error: 'Forbidden: valid admin key required' });
      }

      res.json(getMetrics());
    }),
  );

  // --- Admin: Purge soft-deleted records ---

  app.delete(
    '/api/admin/purge',
    adminRateLimiter,
    asyncHandler(async (req, res) => {
      // --- Admin authorization ---
      const adminKey = req.headers['x-admin-key'];
      const expectedKey = process.env.ADMIN_API_KEY;

      if (!safeCompareAdminKey(String(adminKey), expectedKey ?? '')) {
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

  // --- Admin: Data retention policies (list) ---

  app.get(
    '/api/admin/retention/policies',
    adminRateLimiter,
    asyncHandler(async (req, res) => {
      const adminKey = req.headers['x-admin-key'];
      const expectedKey = process.env.ADMIN_API_KEY;

      if (!safeCompareAdminKey(String(adminKey), expectedKey ?? '')) {
        return res.status(403).json({ error: 'Forbidden: valid admin key required' });
      }

      res.json({ policies: getPolicies() });
    }),
  );

  // --- Admin: Data retention preview (dry-run) ---

  app.get(
    '/api/admin/retention/preview',
    adminRateLimiter,
    asyncHandler(async (req, res) => {
      const adminKey = req.headers['x-admin-key'];
      const expectedKey = process.env.ADMIN_API_KEY;

      if (!safeCompareAdminKey(String(adminKey), expectedKey ?? '')) {
        return res.status(403).json({ error: 'Forbidden: valid admin key required' });
      }

      const category = typeof req.query.category === 'string' ? req.query.category : undefined;

      logger.info('admin:retention:preview', {
        actor: maskKey(String(adminKey)),
        ip: req.ip,
        category: category ?? 'all',
        timestamp: new Date().toISOString(),
      });

      if (category) {
        const result = await runSinglePolicy(
          db as unknown as NodePgDatabase<Record<string, unknown>>,
          category,
          true,
        );
        if (!result) {
          return res.status(400).json({ error: `Unknown retention category: ${category}` });
        }
        return res.json({ dryRun: true, results: [result], totalAffected: result.affectedCount });
      }

      const result = await runRetention(
        db as unknown as NodePgDatabase<Record<string, unknown>>,
        true,
      );
      res.json(result);
    }),
  );

  // --- Admin: Data retention execute ---

  app.post(
    '/api/admin/retention/execute',
    adminRateLimiter,
    asyncHandler(async (req, res) => {
      const adminKey = req.headers['x-admin-key'];
      const expectedKey = process.env.ADMIN_API_KEY;

      if (!safeCompareAdminKey(String(adminKey), expectedKey ?? '')) {
        return res.status(403).json({ error: 'Forbidden: valid admin key required' });
      }

      const category = typeof req.query.category === 'string' ? req.query.category : undefined;

      logger.info('admin:retention:execute', {
        actor: maskKey(String(adminKey)),
        ip: req.ip,
        category: category ?? 'all',
        timestamp: new Date().toISOString(),
      });

      if (category) {
        const result = await runSinglePolicy(
          db as unknown as NodePgDatabase<Record<string, unknown>>,
          category,
          false,
        );
        if (!result) {
          return res.status(400).json({ error: `Unknown retention category: ${category}` });
        }
        return res.json({ dryRun: false, results: [result], totalAffected: result.affectedCount });
      }

      const result = await runRetention(
        db as unknown as NodePgDatabase<Record<string, unknown>>,
        false,
      );
      res.json(result);
    }),
  );
}
