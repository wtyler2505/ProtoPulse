import type { Express } from 'express';
import { fromZodError } from 'zod-validation-error';
import { storage } from '../storage';
import { insertComponentLifecycleSchema } from '@shared/schema';
import { asyncHandler, parseIdParam } from './utils';
import { requireProjectOwnership } from './auth-middleware';

export function registerComponentLifecycleRoutes(app: Express): void {
  // List all lifecycle entries for a project
  app.get(
    '/api/projects/:id/lifecycle',
    requireProjectOwnership,
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const entries = await storage.getComponentLifecycles(projectId);
      res.json({ data: entries, total: entries.length });
    }),
  );

  // Create / upsert a lifecycle entry
  app.post(
    '/api/projects/:id/lifecycle',
    requireProjectOwnership,
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const parsed = insertComponentLifecycleSchema.safeParse({ ...req.body, projectId });
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }
      const entry = await storage.upsertComponentLifecycle(parsed.data);
      res.status(201).json(entry);
    }),
  );

  // Update a lifecycle entry
  app.patch(
    '/api/projects/:id/lifecycle/:entryId',
    requireProjectOwnership,
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const entryId = parseIdParam(req.params.entryId);
      const existing = await storage.getComponentLifecycle(projectId, entryId);
      if (!existing) {
        return res.status(404).json({ message: 'Lifecycle entry not found' });
      }
      const parsed = insertComponentLifecycleSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }
      const updated = await storage.upsertComponentLifecycle({
        ...existing,
        ...parsed.data,
        projectId: existing.projectId,
        partNumber: parsed.data.partNumber ?? existing.partNumber,
      });
      res.json(updated);
    }),
  );

  // Delete a lifecycle entry
  app.delete(
    '/api/projects/:id/lifecycle/:entryId',
    requireProjectOwnership,
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const entryId = parseIdParam(req.params.entryId);
      const existing = await storage.getComponentLifecycle(projectId, entryId);
      if (!existing) {
        return res.status(404).json({ message: 'Lifecycle entry not found' });
      }
      const deleted = await storage.deleteComponentLifecycle(projectId, entryId);
      if (!deleted) {
        return res.status(404).json({ message: 'Lifecycle entry not found' });
      }
      res.status(204).end();
    }),
  );
}
