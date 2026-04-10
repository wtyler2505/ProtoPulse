import type { Express } from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { storage } from '../storage';
import { payloadLimit, parseIdParam, HttpError } from './utils';
import { requireProjectOwnership } from './auth-middleware';

const createCommentSchema = z.object({
  content: z.string().min(1).max(5000),
  targetType: z.enum(['node', 'edge', 'bom_item', 'general', 'spatial']).default('general'),
  targetId: z.string().nullish(),
  spatialX: z.number().nullish(),
  spatialY: z.number().nullish(),
  spatialView: z.enum(['architecture', 'schematic', 'pcb', 'breadboard']).nullish(),
  parentId: z.number().int().positive().nullish(),
});

const updateCommentSchema = z.object({
  content: z.string().min(1).max(5000),
});

export function registerCommentRoutes(app: Express): void {
  // List comments for a project, with optional filters
  app.get(
    '/api/projects/:id/comments',
    requireProjectOwnership,
    async (req, res) => {
      const projectId = parseIdParam(req.params.id);

      const filters: { targetType?: string; targetId?: string; status?: string } = {};
      if (typeof req.query.targetType === 'string' && req.query.targetType) {
        filters.targetType = req.query.targetType;
      }
      if (typeof req.query.targetId === 'string' && req.query.targetId) {
        filters.targetId = req.query.targetId;
      }
      if (typeof req.query.status === 'string' && req.query.status) {
        filters.status = req.query.status;
      }

      const comments = await storage.getComments(projectId, filters);
      res.json({ data: comments, total: comments.length });
    },
  );

  // Create a comment
  app.post(
    '/api/projects/:id/comments',
    requireProjectOwnership,
    payloadLimit(16 * 1024),
    async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const parsed = createCommentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }

      const userId = res.locals.userId as number | undefined;
      if (!Number.isFinite(userId)) {
        throw new HttpError('Authentication required', 401);
      }

      // If parentId is provided, verify it exists and belongs to same project
      if (parsed.data.parentId) {
        const parent = await storage.getComment(projectId, parsed.data.parentId);
        if (!parent) {
          throw new HttpError('Parent comment not found in this project', 404);
        }
      }

      const comment = await storage.createComment({
        projectId,
        content: parsed.data.content,
        targetType: parsed.data.targetType,
        targetId: parsed.data.targetId ?? null,
        spatialX: parsed.data.spatialX,
        spatialY: parsed.data.spatialY,
        spatialView: parsed.data.spatialView ?? undefined,
        parentId: parsed.data.parentId ?? null,
        userId,
      });
      res.status(201).json(comment);
    },
  );

  // Update comment content
  app.patch(
    '/api/projects/:id/comments/:commentId',
    requireProjectOwnership,
    payloadLimit(16 * 1024),
    async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const commentId = parseIdParam(req.params.commentId);
      const existing = await storage.getComment(projectId, commentId);
      if (!existing) {
        return res.status(404).json({ message: 'Comment not found' });
      }
      const parsed = updateCommentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }

      const updated = await storage.updateComment(projectId, commentId, { content: parsed.data.content });
      res.json(updated);
    },
  );

  // Update comment status
  app.patch(
    '/api/projects/:id/comments/:commentId/status',
    requireProjectOwnership,
    async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const commentId = parseIdParam(req.params.commentId);
      const existing = await storage.getComment(projectId, commentId);
      if (!existing) {
        return res.status(404).json({ message: 'Comment not found' });
      }
      const status = req.body?.status;
      const updatedBy = res.locals.userId; // Enforce logged-in user

      if (!status || typeof status !== 'string') {
        return res.status(400).json({ message: 'Missing or invalid status' });
      }

      const updated = await storage.updateCommentStatus(projectId, commentId, status, updatedBy);
      res.json(updated);
    },
  );

  // Delete a comment (hard delete)
  app.delete(
    '/api/projects/:id/comments/:commentId',
    requireProjectOwnership,
    async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const commentId = parseIdParam(req.params.commentId);
      const existing = await storage.getComment(projectId, commentId);
      if (!existing) {
        return res.status(404).json({ message: 'Comment not found' });
      }
      await storage.deleteComment(projectId, commentId);
      res.status(204).end();
    },
  );
}
