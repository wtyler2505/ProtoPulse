import type { Express } from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { storage } from '../storage';
import { asyncHandler, payloadLimit, parseIdParam, HttpError } from './utils';

const createCommentSchema = z.object({
  content: z.string().min(1).max(5000),
  targetType: z.enum(['node', 'edge', 'bom_item', 'general']).default('general'),
  targetId: z.string().nullish(),
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
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);

      const filters: { targetType?: string; targetId?: string; resolved?: boolean } = {};
      if (typeof req.query.targetType === 'string' && req.query.targetType) {
        filters.targetType = req.query.targetType;
      }
      if (typeof req.query.targetId === 'string' && req.query.targetId) {
        filters.targetId = req.query.targetId;
      }
      if (req.query.resolved === 'true') {
        filters.resolved = true;
      } else if (req.query.resolved === 'false') {
        filters.resolved = false;
      }

      const comments = await storage.getComments(projectId, filters);
      res.json({ data: comments, total: comments.length });
    }),
  );

  // Create a comment
  app.post(
    '/api/projects/:id/comments',
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
        parentId: parsed.data.parentId ?? null,
        userId: parsed.data.userId ?? null,
      });
      res.status(201).json(comment);
    }),
  );

  // Update comment content
  app.patch(
    '/api/projects/:id/comments/:commentId',
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

  // Resolve a comment
  app.post(
    '/api/projects/:id/comments/:commentId/resolve',
    asyncHandler(async (req, res) => {
      parseIdParam(req.params.id);
      const commentId = parseIdParam(req.params.commentId);
      const resolvedBy = typeof req.body?.resolvedBy === 'number' ? req.body.resolvedBy : undefined;

      const resolved = await storage.resolveComment(commentId, resolvedBy);
      if (!resolved) {
        return res.status(404).json({ message: 'Comment not found' });
      }
      res.json(resolved);
    }),
  );

  // Unresolve a comment
  app.post(
    '/api/projects/:id/comments/:commentId/unresolve',
    asyncHandler(async (req, res) => {
      parseIdParam(req.params.id);
      const commentId = parseIdParam(req.params.commentId);

      const unresolved = await storage.unresolveComment(commentId);
      if (!unresolved) {
        return res.status(404).json({ message: 'Comment not found' });
      }
      res.json(unresolved);
    }),
  );

  // Delete a comment (hard delete)
  app.delete(
    '/api/projects/:id/comments/:commentId',
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
