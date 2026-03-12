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
  | { op: 'insert'; path: string[]; value: unknown; timestamp?: number; clientId?: number }
  | { op: 'delete'; path: string[]; key: string; timestamp?: number; clientId?: number }
  | { op: 'update'; path: string[]; key: string; value: unknown; timestamp?: number; clientId?: number };

/**
 * Resolved operation after CRDT merge — includes the server-assigned
 * Lamport timestamp and the originating clientId so receivers can
 * detect and resolve conflicts deterministically.
 */
export interface ResolvedCRDTOperation {
  op: CRDTOperation;
  serverTimestamp: number;
  clientId: number;
}

/**
 * Extract the entity key that an operation targets.
 * Conventions:
 *   insert  → path represents the collection, value should contain an id
 *   delete  → path + key identifies the entity
 *   update  → path + key identifies the entity
 *
 * Returns `entityType:entityId` or null when the operation targets the
 * root / a collection rather than a specific entity.
 */
export function operationEntityKey(op: CRDTOperation): string | null {
  if (op.op === 'delete' || op.op === 'update') {
    if (op.path.length > 0 && op.key) {
      return `${op.path[op.path.length - 1]}:${op.key}`;
    }
  }
  if (op.op === 'insert') {
    // For inserts the entity doesn't exist yet — no lock to check.
    return null;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  CRDT merge helpers                                                  */
/* ------------------------------------------------------------------ */

/** Per-key last-write-wins register: highest (timestamp, clientId) wins. */
export function lwwWins(
  existingTs: number,
  existingClient: number,
  incomingTs: number,
  incomingClient: number,
): boolean {
  if (incomingTs > existingTs) { return true; }
  if (incomingTs === existingTs) {
    // Deterministic tie-break: higher clientId wins (arbitrary but consistent)
    return incomingClient > existingClient;
  }
  return false;
}

/**
 * Intent-preserving structural merge rules:
 * - Insert always wins over a concurrent delete of the same key
 *   (rationale: creation intent should not be silently discarded).
 * - Delete only succeeds if no concurrent insert exists for the same key.
 * - Two concurrent inserts for the same key: keep the one with higher
 *   (timestamp, clientId).
 */
export type MergeVerdict = 'accept' | 'reject' | 'superseded';

export function structuralMerge(
  incoming: CRDTOperation,
  concurrent: CRDTOperation[],
): MergeVerdict {
  const incomingTs = incoming.timestamp ?? 0;
  const incomingClient = incoming.clientId ?? 0;

  if (incoming.op === 'delete') {
    // Reject delete if a concurrent insert targets the same key
    const incomingKey = incoming.key;
    const hasConflictingInsert = concurrent.some((c) => {
      if (c.op !== 'insert') { return false; }
      const insertValue = c.value as Record<string, unknown> | null;
      const insertId = insertValue && typeof insertValue === 'object'
        ? String(insertValue.id ?? insertValue.key ?? '')
        : '';
      return insertId === incomingKey;
    });
    if (hasConflictingInsert) { return 'reject'; }
    return 'accept';
  }

  if (incoming.op === 'insert') {
    // Check for concurrent inserts with the same id — higher ts wins
    const insertValue = incoming.value as Record<string, unknown> | null;
    const insertId = insertValue && typeof insertValue === 'object'
      ? String(insertValue.id ?? insertValue.key ?? '')
      : '';

    if (!insertId) { return 'accept'; }

    const conflictingInsert = concurrent.find((c) => {
      if (c.op !== 'insert') { return false; }
      const cValue = c.value as Record<string, unknown> | null;
      const cId = cValue && typeof cValue === 'object'
        ? String(cValue.id ?? cValue.key ?? '')
        : '';
      return cId === insertId;
    });

    if (conflictingInsert) {
      const cTs = conflictingInsert.timestamp ?? 0;
      const cClient = conflictingInsert.clientId ?? 0;
      if (!lwwWins(cTs, cClient, incomingTs, incomingClient)) {
        return 'superseded';
      }
    }
    return 'accept';
  }

  // update — LWW per key, checked externally
  return 'accept';
}

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
