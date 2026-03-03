import type { Express } from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { storage } from '../storage';
import { insertValidationIssueSchema } from '@shared/schema';
import { asyncHandler, payloadLimit, parseIdParam, paginationSchema } from './utils';

export function registerValidationRoutes(app: Express): void {
  app.get(
    '/api/projects/:id/validation',
    asyncHandler(async (req, res) => {
      const opts = paginationSchema.safeParse(req.query);
      const pagination = opts.success ? opts.data : { limit: 50, offset: 0, sort: 'desc' as const };
      const issues = await storage.getValidationIssues(parseIdParam(req.params.id), pagination);
      res.json({ data: issues, total: issues.length });
    }),
  );

  app.post(
    '/api/projects/:id/validation',
    payloadLimit(32 * 1024),
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const parsed = insertValidationIssueSchema.omit({ projectId: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }
      const issue = await storage.createValidationIssue({ ...parsed.data, projectId });
      res.status(201).json(issue);
    }),
  );

  app.delete(
    '/api/projects/:id/validation/:issueId',
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const issueId = parseIdParam(req.params.issueId);
      const deleted = await storage.deleteValidationIssue(issueId, projectId);
      if (!deleted) {
        return res.status(404).json({ message: 'Validation issue not found' });
      }
      res.status(204).end();
    }),
  );

  app.put(
    '/api/projects/:id/validation',
    payloadLimit(512 * 1024),
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const issuesArray = z
        .array(insertValidationIssueSchema.omit({ projectId: true }))
        .safeParse(req.body);
      if (!issuesArray.success) {
        return res.status(400).json({ message: fromZodError(issuesArray.error).toString() });
      }
      const issues = await storage.replaceValidationIssues(
        projectId,
        issuesArray.data.map((i) => ({ ...i, projectId })),
      );
      res.json(issues);
    }),
  );
}
