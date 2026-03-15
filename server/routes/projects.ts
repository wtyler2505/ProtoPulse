import type { Express } from 'express';
import { fromZodError } from 'zod-validation-error';
import { validateSession } from '../auth';
import { storage, VersionConflictError } from '../storage';
import { insertProjectSchema } from '@shared/schema';
import { asyncHandler, payloadLimit, parseIdParam, paginationSchema } from './utils';
import { requireProjectOwnership } from './auth-middleware';
import { setCacheHeaders } from '../lib/cache-headers';

/** Parse the If-Match header value into a version number, or undefined if absent/invalid. */
function parseIfMatch(header: string | undefined): number | undefined {
  if (!header) { return undefined; }
  const match = /^"?(\d+)"?$/.exec(header.trim());
  return match ? Number(match[1]) : undefined;
}

export function registerProjectRoutes(app: Express): void {
  app.get(
    '/api/projects',
    setCacheHeaders('api_list'),
    asyncHandler(async (req, res) => {
      const opts = paginationSchema.safeParse(req.query);
      const pagination = opts.success ? opts.data : { limit: 50, offset: 0, sort: 'desc' as const };
      const result = await storage.getProjects(pagination);
      res.json({ data: result, total: result.length });
    }),
  );

  app.get(
    '/api/projects/:id',
    setCacheHeaders('project_data'),
    asyncHandler(async (req, res) => {
      const project = await storage.getProject(parseIdParam(req.params.id));
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      res.setHeader('ETag', `"${project.version}"`);
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
      res.setHeader('ETag', `"${project.version}"`);
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
      const expectedVersion = parseIfMatch(req.headers['if-match'] as string | undefined);
      try {
        const updated = await storage.updateProject(id, parsed.data, expectedVersion);
        if (!updated) {
          return res.status(404).json({ message: 'Project not found' });
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
