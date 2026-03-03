import type { Express } from 'express';
import { fromZodError } from 'zod-validation-error';
import { validateSession } from '../auth';
import { storage } from '../storage';
import { insertProjectSchema } from '@shared/schema';
import { asyncHandler, payloadLimit, parseIdParam, paginationSchema } from './utils';
import { requireProjectOwnership } from './auth-middleware';

export function registerProjectRoutes(app: Express): void {
  app.get(
    '/api/projects',
    asyncHandler(async (req, res) => {
      const opts = paginationSchema.safeParse(req.query);
      const pagination = opts.success ? opts.data : { limit: 50, offset: 0, sort: 'desc' as const };
      const result = await storage.getProjects(pagination);
      res.json({ data: result, total: result.length });
    }),
  );

  app.get(
    '/api/projects/:id',
    asyncHandler(async (req, res) => {
      const project = await storage.getProject(parseIdParam(req.params.id));
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      res.json(project);
    }),
  );

  app.post(
    '/api/projects',
    payloadLimit(32 * 1024),
    asyncHandler(async (req, res) => {
      const parsed = insertProjectSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }

      // Assign ownership from session if authenticated
      let ownerId: number | undefined;
      const sessionId = req.headers['x-session-id'] as string | undefined;
      if (sessionId) {
        const session = await validateSession(sessionId);
        if (session) {
          ownerId = session.userId;
        }
      }

      const project = await storage.createProject(parsed.data, ownerId);
      res.status(201).json(project);
    }),
  );

  app.patch(
    '/api/projects/:id',
    requireProjectOwnership,
    payloadLimit(32 * 1024),
    asyncHandler(async (req, res) => {
      const id = parseIdParam(req.params.id);
      const parsed = insertProjectSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }
      if (parsed.data.name !== undefined && parsed.data.name.trim().length === 0) {
        return res.status(400).json({ message: 'Project name cannot be empty' });
      }
      const updated = await storage.updateProject(id, parsed.data);
      if (!updated) {
        return res.status(404).json({ message: 'Project not found' });
      }
      res.json(updated);
    }),
  );

  app.delete(
    '/api/projects/:id',
    requireProjectOwnership,
    asyncHandler(async (req, res) => {
      const id = parseIdParam(req.params.id);
      const deleted = await storage.deleteProject(id);
      if (!deleted) {
        return res.status(404).json({ message: 'Project not found' });
      }
      res.status(204).end();
    }),
  );
}
