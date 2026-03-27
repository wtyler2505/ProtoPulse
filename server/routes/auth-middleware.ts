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

  // Prefer the explicit projectId param when both are present.
  // Routes like /api/projects/:projectId/circuits/:id use :id for a circuit id,
  // not the project id.
  const projectIdRaw = req.params.projectId ?? req.params.id;
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

/**
 * Express middleware that enforces circuit design ownership authorization.
 *
 * Extracts the circuit ID from `req.params.circuitId` or `req.params.designId`,
 * resolves the owning project via `storage.getCircuitDesign()`, then validates
 * ownership the same way `requireProjectOwnership` does.
 *
 * **Behavior:**
 * - Returns 401 if no valid session is found.
 * - Returns 404 if the circuit design or its project does not exist (avoids
 *   leaking resource existence).
 * - Passes through if the project has no owner (backward compatibility).
 * - Attaches `res.locals.userId` for downstream handlers.
 */
export function requireCircuitOwnership(req: Request, res: Response, next: NextFunction): void {
  const sessionId = req.headers['x-session-id'] as string | undefined;
  if (!sessionId) {
    next(new HttpError('Authentication required', 401));
    return;
  }

  const circuitIdRaw = req.params.circuitId ?? req.params.designId;
  const circuitId = Number(circuitIdRaw);
  if (!Number.isFinite(circuitId)) {
    next(new HttpError('Invalid circuit id', 400));
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

      const design = await storage.getCircuitDesign(circuitId);
      if (!design) {
        next(new HttpError('Circuit design not found', 404));
        return;
      }

      const project = await storage.getProject(design.projectId);
      if (!project) {
        next(new HttpError('Project not found', 404));
        return;
      }

      // Projects with no owner are accessible to anyone (backward compat)
      if (project.ownerId !== null && project.ownerId !== session.userId) {
        // Return 404 to avoid leaking resource existence to non-owners
        next(new HttpError('Circuit design not found', 404));
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  })();
}
