import type { Express } from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { storage } from '../storage';
import { asyncHandler, payloadLimit, parseIdParam, HttpError } from './utils';
import { requireProjectOwnership } from './auth-middleware';

const createCommentSchema = z.object({
  content: z.string().min(1).max(5000),
  targetType: z.enum(['node', 'edge', 'bom_item', 'general', 'spatial']).default('general'),
  targetId: z.string().nullish(),
  spatialX: z.number().nullish(),
  spatialY: z.number().nullish(),
  spatialView: z.enum(['architecture', 'schematic', 'pcb', 'breadboard']).nullish(),
  parentId: z.number().int().positive().nullish(),
  userId: z.number().int().positive().nullish(),
});

const updateCommentSchema = z.object({
  content: z.string().min(1).max(5000),
});

export function registerCommentRoutes(app: Express): void {
  // List comments for a project, with optional filters
  app.get(
    '/api/projects/:id/comments',
    requireProjectOwnership,
    asyncHandler(async (req, res) => {
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
    }),
  );

  // Create a comment
  app.post(
    '/api/projects/:id/comments',
    requireProjectOwnership,
    payloadLimit(16 * 1024),
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const parsed = createCommentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }

      // If parentId is provided, verify it exists and belongs to same project
      if (parsed.data.parentId) {
        const parent = await storage.getComment(parsed.data.parentId);
        if (!parent || parent.projectId !== projectId) {
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
        userId: parsed.data.userId ?? null,
      });
      res.status(201).json(comment);
    }),
  );

  // Update comment content
  app.patch(
    '/api/projects/:id/comments/:commentId',
    requireProjectOwnership,
    payloadLimit(16 * 1024),
    asyncHandler(async (req, res) => {
      parseIdParam(req.params.id);
      const commentId = parseIdParam(req.params.commentId);
      const parsed = updateCommentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }

      const updated = await storage.updateComment(commentId, { content: parsed.data.content });
      if (!updated) {
        return res.status(404).json({ message: 'Comment not found' });
      }
      res.json(updated);
    }),
  );

  // Update comment status
  app.patch(
    '/api/projects/:id/comments/:commentId/status',
    requireProjectOwnership,
    asyncHandler(async (req, res) => {
      parseIdParam(req.params.id);
      const commentId = parseIdParam(req.params.commentId);
      const status = req.body?.status;
      const updatedBy = typeof req.body?.updatedBy === 'number' ? req.body.updatedBy : undefined;

      if (!status || typeof status !== 'string') {
        return res.status(400).json({ message: 'Missing or invalid status' });
      }

      const updated = await storage.updateCommentStatus(commentId, status, updatedBy);
      if (!updated) {
        return res.status(404).json({ message: 'Comment not found' });
      }
      res.json(updated);
    }),
  );

  // Delete a comment (hard delete)
  app.delete(
    '/api/projects/:id/comments/:commentId',
    requireProjectOwnership,
    asyncHandler(async (req, res) => {
      parseIdParam(req.params.id);
      const commentId = parseIdParam(req.params.commentId);
      const deleted = await storage.deleteComment(commentId);
      if (!deleted) {
        return res.status(404).json({ message: 'Comment not found' });
      }
      res.status(204).end();
    }),
  );
}
