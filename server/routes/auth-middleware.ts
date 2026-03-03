import type { Request, Response, NextFunction } from 'express';
import { validateSession } from '../auth';
import { storage } from '../storage';
import { HttpError } from './utils';

/**
 * Express middleware that enforces project ownership authorization.
 *
 * Extracts the project ID from `req.params.id` or `req.params.projectId`,
 * validates the session from the `X-Session-Id` header, and checks whether
 * the authenticated user owns the project.
 *
 * **Behavior:**
 * - Returns 401 if no valid session is found.
 * - Returns 404 if the project does not exist (avoids information leakage
 *   about whether a project ID is valid — choosing 404 over 403 per OWASP
 *   guidance to prevent enumeration attacks).
 * - Passes through if the project has no owner (backward compatibility with
 *   projects created before the ownership model was introduced).
 * - Attaches `res.locals.userId` for downstream handlers.
 */
export function requireProjectOwnership(req: Request, res: Response, next: NextFunction): void {
  const sessionId = req.headers['x-session-id'] as string | undefined;
  if (!sessionId) {
    next(new HttpError('Authentication required', 401));
    return;
  }

  const projectIdRaw = req.params.id ?? req.params.projectId;
  const projectId = Number(projectIdRaw);
  if (!Number.isFinite(projectId)) {
    next(new HttpError('Invalid project id', 400));
    return;
  }

  void (async () => {
    try {
      const session = await validateSession(sessionId);
      if (!session) {
        next(new HttpError('Invalid or expired session', 401));
        return;
      }

      res.locals.userId = session.userId;

      const project = await storage.getProject(projectId);
      if (!project) {
        next(new HttpError('Project not found', 404));
        return;
      }

      // Projects with no owner are accessible to anyone (backward compat)
      if (project.ownerId !== null && project.ownerId !== session.userId) {
        // Return 404 to avoid leaking project existence to non-owners
        next(new HttpError('Project not found', 404));
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  })();
}
