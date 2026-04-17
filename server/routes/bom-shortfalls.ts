/**
 * BL-0150 — BOM inventory shortfall endpoint.
 *
 * `GET /api/projects/:id/bom/shortfalls`
 *   → `{ data: BomShortfall[], total: number, totalShortfallUnits: number }`
 *
 * Lets the client BOM view + procurement view render per-row "Need N more"
 * badges, and gives export precheck a single source of truth for the
 * fab / pick-and-place warning.
 *
 * Demand (`quantityNeeded`) is written by `ingressPart` whenever a part lands
 * in a BOM (AI `add_bom_item`, manual add, template apply, fzpz import).
 * Supply (`quantityOnHand`) is user-maintained on `part_stock`. We never
 * decrement supply on BOM consumption — see `shared/parts/shortfall.ts` for
 * the rationale.
 */

import type { Express } from 'express';
import { storage } from '../storage';
import { parseIdParam } from './utils';
import { requireProjectOwnership } from './auth-middleware';
import { totalShortfallUnits } from '@shared/parts/shortfall';
import { StorageError } from '../storage/errors';
import { logger } from '../logger';

export function registerBomShortfallRoutes(app: Express): void {
  app.get(
    '/api/projects/:id/bom/shortfalls',
    requireProjectOwnership,
    async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      try {
        const data = await storage.getShortfalls(projectId);
        res.json({
          data,
          total: data.length,
          totalShortfallUnits: totalShortfallUnits(data),
        });
      } catch (err) {
        if (err instanceof StorageError) {
          logger.error('GET /api/projects/:id/bom/shortfalls failed', { message: err.message });
          res.status(500).json({ message: 'Failed to compute BOM shortfalls' });
          return;
        }
        throw err;
      }
    },
  );
}
