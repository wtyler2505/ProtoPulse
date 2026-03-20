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
  role: 'owner' | 'editor' | 'viewer';
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
 * 1. Session exists and has not expired (`expired`)
 * 2. Project exists and is not soft-deleted (`project_deleted`)
 * 3. Determines ownership for role assignment
 *
 * Note: `validateSession` from auth.ts returns null for both missing
 * and expired sessions (it deletes expired rows). For the WS layer we
 * report the reason as `expired` since the session is gone.
 *
 * Access model: any authenticated user can join any non-deleted project.
 * `isOwner` is returned for role assignment (owner vs editor) but does
 * NOT gate access. A separate ACL layer can be added in the future.
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

  // 3. Check ownership and membership
  const isOwner = await storage.isProjectOwner(projectId, userId);
  let isMember = false;
  let role: 'owner' | 'editor' | 'viewer' = 'viewer';

  if (isOwner) {
    isMember = true;
    role = 'owner';
  } else {
    const members = await storage.getProjectMembers(projectId);
    const member = members.find(m => m.userId === userId && m.status === 'accepted');
    if (member) {
      isMember = true;
      role = member.role as 'editor' | 'viewer';
    } else {
      // Check if project has no owner (backward compat)
      if (project.ownerId === null) {
        isMember = true;
        role = 'editor';
      }
    }
  }

  if (!isMember) {
    return { valid: false, userId: null, reason: 'no_access' };
  }

  // 4. Look up username for the collaboration user entry
  const dbUser = await getUserById(userId);
  const username = dbUser?.username ?? `User ${String(userId)}`;

  return {
    valid: true,
    userId,
    username,
    isOwner, // keeping for backward compatibility in types
    role,
  };
}
