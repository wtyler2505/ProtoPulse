import type { Express } from 'express';
import { fromZodError } from 'zod-validation-error';
import { storage, VersionConflictError } from '../storage';
import { insertBomItemSchema } from '@shared/schema';
import { asyncHandler, payloadLimit, parseIdParam, paginationSchema } from './utils';

/** Parse the If-Match header value into a version number, or undefined if absent/invalid. */
function parseIfMatch(header: string | undefined): number | undefined {
  if (!header) { return undefined; }
  const match = /^"?(\d+)"?$/.exec(header.trim());
  return match ? Number(match[1]) : undefined;
}

export function registerBomRoutes(app: Express): void {
  app.get(
    '/api/projects/:id/bom',
    asyncHandler(async (req, res) => {
      const opts = paginationSchema.safeParse(req.query);
      const pagination = opts.success ? opts.data : { limit: 50, offset: 0, sort: 'desc' as const };
      const items = await storage.getBomItems(parseIdParam(req.params.id), pagination);
      res.json({ data: items, total: items.length });
    }),
  );

  app.get(
    '/api/projects/:id/bom/low-stock',
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const items = await storage.getLowStockItems(projectId);
      res.json(items);
    }),
  );

  app.get(
    '/api/projects/:id/bom/storage-locations',
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const locations = await storage.getStorageLocations(projectId);
      res.json(locations);
    }),
  );

  app.get(
    '/api/projects/:id/bom/:bomId',
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const bomId = parseIdParam(req.params.bomId);
      const item = await storage.getBomItem(bomId, projectId);
      if (!item) {
        return res.status(404).json({ message: 'BOM item not found' });
      }
      res.setHeader('ETag', `"${item.version}"`);
      res.json(item);
    }),
  );

  app.post(
    '/api/projects/:id/bom',
    payloadLimit(32 * 1024),
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const parsed = insertBomItemSchema.omit({ projectId: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }
      const item = await storage.createBomItem({ ...parsed.data, projectId });
      res.setHeader('ETag', `"${item.version}"`);
      res.status(201).json(item);
    }),
  );

  app.patch(
    '/api/projects/:id/bom/:bomId',
    payloadLimit(32 * 1024),
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const bomId = parseIdParam(req.params.bomId);
      const parsed = insertBomItemSchema.partial().omit({ projectId: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }
      const expectedVersion = parseIfMatch(req.headers['if-match'] as string | undefined);
      try {
        const updated = await storage.updateBomItem(bomId, projectId, parsed.data, expectedVersion);
        if (!updated) {
          return res.status(404).json({ message: 'BOM item not found' });
        }
        res.setHeader('ETag', `"${updated.version}"`);
        res.json(updated);
      } catch (e) {
        if (e instanceof VersionConflictError) {
          return res.status(409).json({
            error: 'Conflict',
            message: 'Resource was modified by another request. Re-fetch and retry.',
            currentVersion: e.currentVersion,
          });
        }
        throw e;
      }
    }),
  );

  app.delete(
    '/api/projects/:id/bom/:bomId',
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const bomId = parseIdParam(req.params.bomId);
      const deleted = await storage.deleteBomItem(bomId, projectId);
      if (!deleted) {
        return res.status(404).json({ message: 'BOM item not found' });
      }
      res.status(204).end();
    }),
  );
}
