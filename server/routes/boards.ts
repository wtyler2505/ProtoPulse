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
import { parseIdParam, asyncHandler } from './utils';
import { requireProjectOwnership } from './auth-middleware';
import { DEFAULT_BOARD_VALUES } from '../storage/boards';

export function registerBoardRoutes(app: Express): void {
  // GET is intentionally ultra-robust: the contract is "always return a usable Board shape".
  // Even on DB hiccups or missing migrations we synthesize the default so that
  // BoardViewer3DView, PCBLayoutView, and other consumers never hard-crash with 500.
  app.get(
    '/api/projects/:id/board',
    requireProjectOwnership,
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      let board;
      try {
        board = await storage.getBoard(projectId);
      } catch {
        // Fallback to the documented default so the 3D view and PCB editor keep working.
        const now = new Date();
        board = {
          id: 0,
          projectId,
          ...DEFAULT_BOARD_VALUES,
          createdAt: now,
          updatedAt: now,
        } as any;
      }
      res.json(board);
    }),
  );

  app.put(
    '/api/projects/:id/board',
    requireProjectOwnership,
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const parsed = updateBoardSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }
      const board = await storage.upsertBoard(projectId, parsed.data);
      res.json(board);
    }),
  );
}
