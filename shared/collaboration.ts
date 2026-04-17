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
  | 'conflict-detected'
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

/* ------------------------------------------------------------------ */
/*  BL-0524: Conflict detection for UI                                  */
/* ------------------------------------------------------------------ */

/**
 * Kind of conflict raised when CRDT merge drops a losing operation.
 * - `lww-update`       — simultaneous field edit; incoming update lost LWW to recent update
 * - `insert-superseded` — concurrent insert of same id; incoming lost LWW
 * - `delete-rejected`   — concurrent insert targeted the entity the user tried to delete
 */
export type ConflictKind = 'lww-update' | 'insert-superseded' | 'delete-rejected';

/**
 * Conflict record emitted from server to the losing client so the user
 * can review their dropped edit against the winning edit and decide
 * whether to re-apply, accept the remote version, or merge manually.
 *
 * Resolution is performed by sending a fresh `state-update` with the
 * user's chosen value — no dedicated "resolve" route is needed because
 * the authoritative state already converged on `theirOp`.
 */
export interface Conflict {
  id: string;
  projectId: number;
  kind: ConflictKind;
  /** Path of the operation (e.g. `['nodes']`, `['bomItems']`). */
  path: string[];
  /** Entity key (id) for update/delete; empty string for inserts without id. */
  key: string;
  /** The operation the losing client tried to apply (server-tagged). */
  yourOp: CRDTOperation;
  /** The operation currently in the authoritative state. */
  theirOp: CRDTOperation;
  /** Server timestamp of detection (Lamport clock at the drop point). */
  detectedAt: number;
}

/**
 * Determine whether an incoming operation `incoming` (already tagged with
 * its Lamport timestamp + clientId) conflicts with the most recent
 * accepted operation from the sliding window for the same entity.
 *
 * Returns the `Conflict` record (minus id/projectId/detectedAt — caller
 * fills those) when the incoming op would lose, otherwise `null`.
 *
 * Call this *before* `structuralMerge`/LWW drop the op; the return value
 * describes what the user would be told.
 */
export function detectConflict(
  incoming: CRDTOperation,
  recent: ReadonlyArray<{ op: CRDTOperation; serverTs: number; clientId: number }>,
): { kind: ConflictKind; path: string[]; key: string; yourOp: CRDTOperation; theirOp: CRDTOperation } | null {
  const incomingTs = incoming.timestamp ?? 0;
  const incomingClient = incoming.clientId ?? 0;

  if (incoming.op === 'update') {
    const opKey = `${incoming.path.join('.')}:${incoming.key}`;
    // Find the most recent concurrent update on the same key that would beat us.
    for (let i = recent.length - 1; i >= 0; i--) {
      const r = recent[i];
      if (r.op.op !== 'update') { continue; }
      const rKey = `${r.op.path.join('.')}:${r.op.key}`;
      if (rKey !== opKey) { continue; }
      // If incoming cannot win LWW, this is a conflict.
      if (!lwwWins(r.serverTs, r.clientId, incomingTs, incomingClient)) {
        return {
          kind: 'lww-update',
          path: incoming.path,
          key: incoming.key,
          yourOp: incoming,
          theirOp: r.op,
        };
      }
      // Incoming would win — no conflict for this key.
      return null;
    }
    return null;
  }

  if (incoming.op === 'insert') {
    const iv = incoming.value as Record<string, unknown> | null;
    const iid = iv && typeof iv === 'object' ? String(iv.id ?? iv.key ?? '') : '';
    if (!iid) { return null; }
    for (let i = recent.length - 1; i >= 0; i--) {
      const r = recent[i];
      if (r.op.op !== 'insert') { continue; }
      const rv = r.op.value as Record<string, unknown> | null;
      const rid = rv && typeof rv === 'object' ? String(rv.id ?? rv.key ?? '') : '';
      if (rid !== iid) { continue; }
      if (!lwwWins(r.serverTs, r.clientId, incomingTs, incomingClient)) {
        return {
          kind: 'insert-superseded',
          path: incoming.path,
          key: iid,
          yourOp: incoming,
          theirOp: r.op,
        };
      }
      return null;
    }
    return null;
  }

  if (incoming.op === 'delete') {
    // A delete is rejected when a concurrent insert targets the same key.
    for (let i = recent.length - 1; i >= 0; i--) {
      const r = recent[i];
      if (r.op.op !== 'insert') { continue; }
      const rv = r.op.value as Record<string, unknown> | null;
      const rid = rv && typeof rv === 'object' ? String(rv.id ?? rv.key ?? '') : '';
      if (rid === incoming.key) {
        return {
          kind: 'delete-rejected',
          path: incoming.path,
          key: incoming.key,
          yourOp: incoming,
          theirOp: r.op,
        };
      }
    }
    return null;
  }

  return null;
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
