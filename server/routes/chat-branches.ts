import type { Express } from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { storage } from '../storage';
import { parseIdParam } from './utils';
import { requireProjectOwnership } from './auth-middleware';

const createBranchSchema = z.object({
  parentMessageId: z.number().int().positive(),
});

export function registerChatBranchRoutes(app: Express): void {
  // Create a new conversation branch from a specific message
  app.post(
    '/api/projects/:id/chat/branches',
    requireProjectOwnership,
    async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const parsed = createBranchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }
      const branch = await storage.createChatBranch(projectId, parsed.data.parentMessageId);
      res.status(201).json(branch);
    },
  );

  // List all branches for a project
  app.get(
    '/api/projects/:id/chat/branches',
    requireProjectOwnership,
    async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const branches = await storage.getChatBranches(projectId);
      res.json({ data: branches, total: branches.length });
    },
  );
}
