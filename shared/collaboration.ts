/**
 * Shared types for real-time collaboration (UI-03 + FG-06 + IN-03).
 */

export type CollabRole = 'owner' | 'editor' | 'viewer';

export interface CollabUser {
  userId: number;
  username: string;
  role: CollabRole;
  color: string;
  cursor?: { x: number; y: number; view: string };
  selection?: { type: string; ids: string[] };
  lastActivity: number;
}

export interface CollabRoom {
  projectId: number;
  users: CollabUser[];
  createdAt: number;
}

export type CollabMessageType =
  | 'join'
  | 'leave'
  | 'cursor-move'
  | 'selection-change'
  | 'state-update'
  | 'state-sync'
  | 'awareness'
  | 'lock-request'
  | 'lock-granted'
  | 'lock-released'
  | 'lock-denied'
  | 'role-change'
  | 'chat'
  | 'error';

export interface CollabMessage {
  type: CollabMessageType;
  userId: number;
  projectId: number;
  timestamp: number;
  payload: Record<string, unknown>;
}

export type CRDTOperation =
  | { op: 'insert'; path: string[]; value: unknown }
  | { op: 'delete'; path: string[]; key: string }
  | { op: 'update'; path: string[]; key: string; value: unknown };

export interface LockRequest {
  entityType: 'node' | 'edge' | 'bom-item' | 'wire' | 'instance';
  entityId: string;
  userId: number;
  timeout: number;
}

export interface CollabInvite {
  projectId: number;
  email: string;
  role: CollabRole;
  invitedBy: number;
  token: string;
  expiresAt: number;
}

/** Color palette for user cursors (max 12 distinct colors). */
export const CURSOR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
  '#98D8C8', '#F7DC6F', '#BB8FCE', '#82E0AA',
  '#F1948A', '#85C1E9', '#F0B27A', '#AED6F1',
] as const;

/** Build a deterministic lock key from project, entity type + id. */
export function lockKey(projectId: number | string, entityType: string, entityId: string): string {
  return `${projectId}:${entityType}:${entityId}`;
}

/** Validate a CollabMessage has required fields. */
export function isValidCollabMessage(msg: unknown): msg is CollabMessage {
  if (typeof msg !== 'object' || msg === null) { return false; }
  const m = msg as Record<string, unknown>;
  return (
    typeof m.type === 'string' &&
    typeof m.userId === 'number' &&
    typeof m.projectId === 'number' &&
    typeof m.timestamp === 'number' &&
    typeof m.payload === 'object' &&
    m.payload !== null
  );
}

/** Default lock timeout in ms (30 seconds). */
export const DEFAULT_LOCK_TIMEOUT_MS = 30_000;

/** Heartbeat interval in ms. */
export const HEARTBEAT_INTERVAL_MS = 30_000;

/** Max missed pongs before disconnect. */
export const MAX_MISSED_PONGS = 3;

/** Cursor throttle interval in ms. */
export const CURSOR_THROTTLE_MS = 50;
