/**
 * BL-0526: WebSocket session re-validation on reconnect.
 *
 * Validates that a session is still active and the user still has access
 * to the project before allowing a WebSocket reconnection. Called during
 * the WS connection handshake to prevent stale/revoked sessions from
 * rejoining collaboration rooms.
 */

import { validateSession, getUserById } from '../auth';
import { storage } from '../storage';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type WsSessionInvalidReason =
  | 'expired'
  | 'invalid'
  | 'no_access'
  | 'project_deleted';

export interface WsSessionValidResult {
  valid: true;
  userId: number;
  username: string;
  isOwner: boolean;
}

export interface WsSessionInvalidResult {
  valid: false;
  userId: null;
  reason: WsSessionInvalidReason;
}

export type WsSessionValidationResult = WsSessionValidResult | WsSessionInvalidResult;

/* ------------------------------------------------------------------ */
/*  Validator                                                          */
/* ------------------------------------------------------------------ */

/**
 * Validate a WebSocket session for a given project.
 *
 * Checks:
 * 1. Session exists and has not expired (`invalid` / `expired`)
 * 2. Project exists and is not soft-deleted (`project_deleted`)
 * 3. User has access to the project (`no_access`)
 *
 * Note: `validateSession` from auth.ts returns null for both missing
 * and expired sessions (it deletes expired rows), so we map both to
 * `invalid`. We distinguish `expired` only when the session lookup
 * itself succeeds but the expiry is past — which auth.ts handles
 * internally by returning null after cleanup. For the WS layer we
 * treat "session gone" as `expired` when we can detect it, otherwise
 * `invalid`.
 */
export async function validateWsSession(
  sessionId: string,
  projectId: number,
): Promise<WsSessionValidationResult> {
  // 1. Validate session token
  const session = await validateSession(sessionId);
  if (!session) {
    return { valid: false, userId: null, reason: 'expired' };
  }

  const userId = session.userId;

  // 2. Check project exists (getProject filters soft-deleted via isNull(deletedAt))
  const project = await storage.getProject(projectId);
  if (!project) {
    return { valid: false, userId: null, reason: 'project_deleted' };
  }

  // 3. Check user has access to the project
  const isOwner = await storage.isProjectOwner(projectId, userId);
  if (!isOwner) {
    return { valid: false, userId: null, reason: 'no_access' };
  }

  // 4. Look up username for the collaboration user entry
  const dbUser = await getUserById(userId);
  const username = dbUser?.username ?? `User ${String(userId)}`;

  return {
    valid: true,
    userId,
    username,
    isOwner,
  };
}
