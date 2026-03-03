import type { Express } from 'express';
import { fromZodError } from 'zod-validation-error';
import { storage } from '../storage';
import { insertHistoryItemSchema } from '@shared/schema';
import { asyncHandler, payloadLimit, parseIdParam, paginationSchema } from './utils';

export function registerHistoryRoutes(app: Express): void {
  app.get(
    '/api/projects/:id/history',
    asyncHandler(async (req, res) => {
      const opts = paginationSchema.safeParse(req.query);
      const pagination = opts.success ? opts.data : { limit: 50, offset: 0, sort: 'desc' as const };
      const items = await storage.getHistoryItems(parseIdParam(req.params.id), pagination);
      res.json({ data: items, total: items.length });
    }),
  );

  app.post(
    '/api/projects/:id/history',
    payloadLimit(32 * 1024),
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const parsed = insertHistoryItemSchema.omit({ projectId: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }
      const item = await storage.createHistoryItem({ ...parsed.data, projectId });
      res.status(201).json(item);
    }),
  );

  app.delete(
    '/api/projects/:id/history',
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      await storage.deleteHistoryItems(projectId);
      res.status(204).end();
    }),
  );

  app.delete(
    '/api/projects/:id/history/:itemId',
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const itemId = parseIdParam(req.params.itemId);
      const deleted = await storage.deleteHistoryItem(itemId, projectId);
      if (!deleted) {
        return res.status(404).json({ message: 'History item not found' });
      }
      res.status(204).end();
    }),
  );
}
