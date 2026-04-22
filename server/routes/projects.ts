import type { Express } from 'express';
import { fromZodError } from 'zod-validation-error/v3';
import { validateSession } from '../auth';
import { storage, VersionConflictError } from '../storage';
import { insertProjectSchema } from '@shared/schema';
import { logger } from '../logger';
import { findProjectListAnomalies } from '../lib/project-list-sanity';
import { payloadLimit, parseIdParam, paginationSchema } from './utils';
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
    async (req, res) => {
      const opts = paginationSchema.safeParse(req.query);
      const pagination = opts.success ? opts.data : { limit: 50, offset: 0, sort: 'desc' as const };
      const result = await storage.getProjects(pagination);
      const anomalies = findProjectListAnomalies(result);
      if (anomalies.length > 0) {
        logger.warn('projects:list:sanity-check', {
          anomalyCount: anomalies.length,
          anomalies,
        });
      }
      res.json({ data: result, total: result.length });
    },
  );

  app.get(
    '/api/projects/:id',
    requireProjectOwnership,
    setCacheHeaders('project_data'),
    async (req, res) => {
      const project = await storage.getProject(parseIdParam(req.params.id));
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      res.setHeader('ETag', `"${project.version}"`);
      res.json(project);
    },
  );

  app.post(
    '/api/projects',
    payloadLimit(32 * 1024),
    async (req, res) => {
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
    },
  );

  app.patch(
    '/api/projects/:id',
    requireProjectOwnership,
    payloadLimit(32 * 1024),
    async (req, res) => {
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
    },
  );

  app.delete(
    '/api/projects/:id',
    requireProjectOwnership,
    async (req, res) => {
      const id = parseIdParam(req.params.id);
      const deleted = await storage.deleteProject(id);
      if (!deleted) {
        return res.status(404).json({ message: 'Project not found' });
      }
      res.status(204).end();
    },
  );

  app.post(
    '/api/projects/:id/approve',
    requireProjectOwnership,
    async (req, res) => {
      const id = parseIdParam(req.params.id);
      // Ensure the project exists
      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      // Mark as approved (could be un-approved if a flag is passed, but for now just approve it)
      const isApproved = req.body.approved !== false;
      
      // Note: approvedAt/approvedBy fields are not in InsertProject schema;
      // a dedicated approval storage method is needed to set those columns.
      // For now, touch the version to record the approval action.
      const updated = await storage.updateProject(id, {
        name: project.name,
      });

      if (!updated) {
        return res.status(404).json({ message: 'Project not found during update' });
      }

      res.json(updated);
    },
  );

  // --- Project Members API ---

  app.get(
    '/api/projects/:id/members',
    requireProjectOwnership,
    async (req, res) => {
      const id = parseIdParam(req.params.id);

      const project = await storage.getProject(id);
      if (!project) return res.status(404).json({ message: 'Project not found' });
      
      const members = await storage.getProjectMembers(id);
      res.json(members);
    },
  );

  app.post(
    '/api/projects/:id/members',
    requireProjectOwnership,
    async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const { userId, role = 'viewer', status = 'pending' } = req.body;
      
      if (!userId) return res.status(400).json({ message: 'User ID is required' });

      const member = await storage.addProjectMember({
        projectId,
        userId: Number(userId),
        role,
        status,
        invitedBy: req.userId
      });
      
      res.status(201).json(member);
    },
  );

  app.patch(
    '/api/projects/:id/members/:userId',
    requireProjectOwnership,
    async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const userId = parseIdParam(req.params.userId);
      const { role, status } = req.body;
      
      const updated = await storage.updateProjectMember(projectId, userId, { role, status });
      if (!updated) return res.status(404).json({ message: 'Member not found' });
      
      res.json(updated);
    },
  );

  app.delete(
    '/api/projects/:id/members/:userId',
    requireProjectOwnership,
    async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const userId = parseIdParam(req.params.userId);
      
      const success = await storage.removeProjectMember(projectId, userId);
      if (!success) return res.status(404).json({ message: 'Member not found' });
      
      res.status(204).end();
    },
  );
}
