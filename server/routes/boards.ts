/**
 * Board routes — per-project PCB source of truth (Plan 02 Phase 4).
 *
 * GET  /api/projects/:id/board — returns the board row, or a populated default
 *                                object (id=0) if no row exists yet.
 * PUT  /api/projects/:id/board — partial merge update. Each view edits only
 *                                the fields it owns; omitted fields preserved.
 *                                Auto-creates the row on first write.
 */

import type { Express } from 'express';
import { fromZodError } from 'zod-validation-error/v3';
import { storage } from '../storage';
import { updateBoardSchema } from '@shared/schema';
import { parseIdParam } from './utils';
import { requireProjectOwnership } from './auth-middleware';

export function registerBoardRoutes(app: Express): void {
  app.get(
    '/api/projects/:id/board',
    requireProjectOwnership,
    async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const board = await storage.getBoard(projectId);
      res.json(board);
    },
  );

  app.put(
    '/api/projects/:id/board',
    requireProjectOwnership,
    async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const parsed = updateBoardSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }
      const board = await storage.upsertBoard(projectId, parsed.data);
      res.json(board);
    },
  );
}
