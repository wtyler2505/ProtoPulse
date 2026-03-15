/**
 * WebSocket-based real-time collaboration server (UI-03 + FG-06 + IN-03).
 *
 * Attaches to the existing HTTP server and manages rooms, presence,
 * cursor streaming, entity locking, and state synchronisation.
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';
import type {
  CollabMessage,
  CollabUser,
  CollabRole,
  CRDTOperation,
  LockRequest,
  MergeVerdict,
} from '@shared/collaboration';
import {
  CURSOR_COLORS,
  CURSOR_THROTTLE_MS,
  DEFAULT_LOCK_TIMEOUT_MS,
  HEARTBEAT_INTERVAL_MS,
  MAX_MISSED_PONGS,
  isValidCollabMessage,
  lockKey,
  operationEntityKey,
  lwwWins,
  structuralMerge,
} from '@shared/collaboration';
import { validateSession, getUserById } from './auth';
import { storage } from './storage';
import { logger } from './logger';
import { validateWsSession } from './lib/ws-session-validator';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ClientEntry {
  ws: WebSocket;
  user: CollabUser;
  alive: boolean;
  lastCursorBroadcast: number;
}

interface LockEntry {
  userId: number;
  expiresAt: number;
}

/* ------------------------------------------------------------------ */
/*  CollaborationServer                                                */
/* ------------------------------------------------------------------ */

export class CollaborationServer {
  private readonly wss: WebSocketServer;
  private readonly rooms = new Map<number, Map<number, ClientEntry>>();
  private readonly locks = new Map<string, LockEntry>();
  private readonly stateVersions = new Map<number, number>();
  private readonly heartbeatTimer: ReturnType<typeof setInterval>;
  private readonly lockCleanupTimer: ReturnType<typeof setInterval>;

  /**
   * Per-room Lamport clock — monotonically increasing logical timestamp
   * used for LWW conflict resolution. Each accepted operation bumps the
   * clock; the server timestamp is authoritative.
   */
  private readonly lamportClocks = new Map<number, number>();

  /**
   * Sliding window of recently accepted operations per room, keyed by
   * `projectId`. Used for intent-preserving structural merge: when a
   * new batch arrives we check it against the recent window to detect
   * concurrent conflicts.  Window is pruned on every state-update to
   * keep only the last MERGE_WINDOW_SIZE entries.
   */
  private readonly recentOps = new Map<number, Array<{ op: CRDTOperation; serverTs: number; clientId: number }>>();
  private static readonly MERGE_WINDOW_SIZE = 200;

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws/collab' });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      void this.onConnection(ws, req);
    });

    this.heartbeatTimer = setInterval(() => {
      this.heartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    this.lockCleanupTimer = setInterval(() => {
      this.cleanupExpiredLocks();
    }, 5_000);
  }

  /* ---------------------------------------------------------------- */
  /*  Connection lifecycle                                             */
  /* ---------------------------------------------------------------- */

  private async onConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const projectIdRaw = url.searchParams.get('projectId');
    const sessionId = url.searchParams.get('sessionId');

    if (!projectIdRaw || !sessionId) {
      this.sendError(ws, 0, 0, 'Missing projectId or sessionId');
      ws.close(4001, 'Missing parameters');
      return;
    }

    const projectId = Number(projectIdRaw);
    if (!Number.isFinite(projectId) || projectId <= 0) {
      this.sendError(ws, 0, 0, 'Invalid projectId');
      ws.close(4002, 'Invalid projectId');
      return;
    }

    const session = await validateSession(sessionId);
    if (!session) {
      this.sendError(ws, 0, projectId, 'Invalid or expired session');
      ws.close(4003, 'Authentication failed');
      return;
    }

    const userId = session.userId;

    // Determine role
    const isOwner = await storage.isProjectOwner(projectId, userId);
    const role: CollabRole = isOwner ? 'owner' : 'editor';

    // Look up username
    const dbUser = await getUserById(userId);
    const username = dbUser?.username ?? `User ${String(userId)}`;

    // Assign color
    const room = this.getOrCreateRoom(projectId);
    const colorIndex = room.size % CURSOR_COLORS.length;
    const color = CURSOR_COLORS[colorIndex];

    const user: CollabUser = {
      userId,
      username,
      role,
      color,
      lastActivity: Date.now(),
    };

    const entry: ClientEntry = { ws, user, alive: true, lastCursorBroadcast: 0 };
    room.set(userId, entry);

    // Wire up events
    ws.on('pong', () => {
      entry.alive = true;
    });

    ws.on('message', (raw: Buffer | ArrayBuffer | Buffer[]) => {
      this.handleMessage(projectId, userId, String(raw));
    });

    ws.on('close', () => {
      this.handleDisconnect(projectId, userId);
    });

    ws.on('error', () => {
      this.handleDisconnect(projectId, userId);
    });

    // Send state-sync to the new user
    this.syncStateToNewUser(projectId, userId);

    // Broadcast join to others
    this.broadcastToRoom(projectId, {
      type: 'join',
      userId,
      projectId,
      timestamp: Date.now(),
      payload: { user },
    }, userId);
  }

  private handleDisconnect(projectId: number, userId: number): void {
    const room = this.rooms.get(projectId);
    if (!room) { return; }

    room.delete(userId);

    // Release all locks held by this user
    for (const [key, lock] of Array.from(this.locks)) {
      if (lock.userId === userId) {
        this.locks.delete(key);
        this.broadcastToRoom(projectId, {
          type: 'lock-released',
          userId,
          projectId,
          timestamp: Date.now(),
          payload: { entityKey: key },
        });
      }
    }

    // Broadcast leave
    this.broadcastToRoom(projectId, {
      type: 'leave',
      userId,
      projectId,
      timestamp: Date.now(),
      payload: { userId },
    });

    // Clean up empty room
    if (room.size === 0) {
      this.rooms.delete(projectId);
      this.stateVersions.delete(projectId);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Message dispatch                                                 */
  /* ---------------------------------------------------------------- */

  private handleMessage(projectId: number, userId: number, raw: string): void {
    let msg: unknown;
    try {
      msg = JSON.parse(raw) as unknown;
    } catch {
      this.sendErrorToUser(projectId, userId, 'Invalid JSON');
      return;
    }

    if (!isValidCollabMessage(msg)) {
      this.sendErrorToUser(projectId, userId, 'Invalid message format');
      return;
    }

    const message = msg;
    const room = this.rooms.get(projectId);
    const entry = room?.get(userId);
    if (!entry) { return; }

    entry.user.lastActivity = Date.now();

    // Role enforcement: viewers can only send cursor-move, selection-change, awareness
    if (entry.user.role === 'viewer') {
      const viewerAllowed: CollabMessage['type'][] = ['cursor-move', 'selection-change', 'awareness'];
      if (!viewerAllowed.includes(message.type)) {
        this.sendErrorToUser(projectId, userId, 'Viewers cannot perform this action');
        return;
      }
    }

    switch (message.type) {
      case 'cursor-move':
        this.handleCursorMove(projectId, userId, message.payload);
        break;
      case 'selection-change':
        this.handleSelectionChange(projectId, userId, message.payload);
        break;
      case 'state-update':
        this.handleStateUpdate(projectId, userId, message.payload.operations as CRDTOperation[]);
        break;
      case 'lock-request':
        this.handleLockRequest(projectId, userId, message.payload as unknown as LockRequest);
        break;
      case 'lock-released':
        this.handleLockRelease(projectId, userId, message.payload.entityKey as string);
        break;
      case 'role-change':
        this.handleRoleChange(projectId, userId, message.payload);
        break;
      case 'awareness':
        this.broadcastToRoom(projectId, { ...message, userId }, userId);
        break;
      case 'chat':
        this.broadcastToRoom(projectId, { ...message, userId });
        break;
      default:
        break;
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Cursor & selection                                               */
  /* ---------------------------------------------------------------- */

  private handleCursorMove(projectId: number, userId: number, payload: Record<string, unknown>): void {
    const room = this.rooms.get(projectId);
    const entry = room?.get(userId);
    if (!entry) { return; }

    const now = Date.now();
    if (now - entry.lastCursorBroadcast < CURSOR_THROTTLE_MS) { return; }
    entry.lastCursorBroadcast = now;

    const cursor = {
      x: Number(payload.x),
      y: Number(payload.y),
      view: String(payload.view ?? ''),
    };
    entry.user.cursor = cursor;

    this.broadcastToRoom(projectId, {
      type: 'cursor-move',
      userId,
      projectId,
      timestamp: now,
      payload: { cursor },
    }, userId);
  }

  private handleSelectionChange(projectId: number, userId: number, payload: Record<string, unknown>): void {
    const room = this.rooms.get(projectId);
    const entry = room?.get(userId);
    if (!entry) { return; }

    const selection = {
      type: String(payload.type ?? ''),
      ids: Array.isArray(payload.ids) ? (payload.ids as unknown[]).map(String) : [],
    };
    entry.user.selection = selection;

    this.broadcastToRoom(projectId, {
      type: 'selection-change',
      userId,
      projectId,
      timestamp: Date.now(),
      payload: { selection },
    }, userId);
  }

  /* ---------------------------------------------------------------- */
  /*  State sync (simplified last-writer-wins)                         */
  /* ---------------------------------------------------------------- */

  private handleStateUpdate(projectId: number, userId: number, operations: CRDTOperation[]): void {
    if (!Array.isArray(operations) || operations.length === 0) { return; }

    const room = this.rooms.get(projectId);
    const entry = room?.get(userId);
    if (!entry) { return; }

    // --- BL-0488: RBAC enforcement for editors ---
    // Editors cannot delete root-level design entities (only owner can)
    if (entry.user.role === 'editor') {
      const blocked = operations.find((op) =>
        op.op === 'delete' && op.path.length === 0,
      );
      if (blocked) {
        this.sendErrorToUser(projectId, userId, 'Editors cannot delete the root design');
        return;
      }
    }

    // --- BL-0487: Lock enforcement ---
    // Reject operations that target a locked entity held by someone else
    const now = Date.now();
    const rejectedOps: CRDTOperation[] = [];
    const acceptedOps: CRDTOperation[] = [];

    for (const op of operations) {
      const entityRef = operationEntityKey(op);
      if (entityRef) {
        // Check all locks — the entity key in locks is `projectId:entityType:entityId`
        // operationEntityKey returns `collectionName:entityId` — we need to check
        // against all locks that end with the entity id for this project
        const lockedByOther = this.isLockedByOther(projectId, entityRef, userId, now);
        if (lockedByOther) {
          rejectedOps.push(op);
          continue;
        }
      }
      acceptedOps.push(op);
    }

    // Notify the user about rejected operations
    if (rejectedOps.length > 0) {
      this.sendErrorToUser(
        projectId,
        userId,
        `${String(rejectedOps.length)} operation(s) rejected: target entity is locked by another user`,
      );
    }

    if (acceptedOps.length === 0) { return; }

    // --- BL-0486: CRDT merge ---
    this.mergeAndBroadcastOps(projectId, userId, acceptedOps);
  }

  private syncStateToNewUser(projectId: number, userId: number): void {
    const room = this.rooms.get(projectId);
    const entry = room?.get(userId);
    if (!entry) { return; }

    const users = this.getRoomUsers(projectId);
    const version = this.stateVersions.get(projectId) ?? 0;

    // Collect current locks relevant to this project
    const activeLocks: Record<string, number> = {};
    for (const [key, lock] of Array.from(this.locks)) {
      if (lock.expiresAt > Date.now()) {
        activeLocks[key] = lock.userId;
      }
    }

    const syncMsg: CollabMessage = {
      type: 'state-sync',
      userId: 0, // system
      projectId,
      timestamp: Date.now(),
      payload: { users, version, locks: activeLocks },
    };

    this.sendToClient(entry.ws, syncMsg);
  }

  private applyAndBroadcastOps(projectId: number, userId: number, ops: CRDTOperation[]): void {
    const version = (this.stateVersions.get(projectId) ?? 0) + 1;
    this.stateVersions.set(projectId, version);

    this.broadcastToRoom(projectId, {
      type: 'state-update',
      userId,
      projectId,
      timestamp: Date.now(),
      payload: { operations: ops, version },
    }, userId);
  }

  /* ---------------------------------------------------------------- */
  /*  BL-0487: Lock enforcement helper                                 */
  /* ---------------------------------------------------------------- */

  /**
   * Returns true if the entity described by `entityRef` (format:
   * `collectionName:entityId`) is currently locked by a user other
   * than `userId`.
   */
  private isLockedByOther(projectId: number, entityRef: string, userId: number, now: number): boolean {
    const entityId = entityRef.split(':').pop() ?? '';
    if (!entityId) { return false; }

    for (const [key, lock] of Array.from(this.locks)) {
      if (lock.expiresAt <= now) { continue; }
      if (lock.userId === userId) { continue; }
      // Lock keys are `projectId:entityType:entityId`
      if (key.startsWith(`${String(projectId)}:`) && key.endsWith(`:${entityId}`)) {
        return true;
      }
    }
    return false;
  }

  /* ---------------------------------------------------------------- */
  /*  BL-0486: CRDT merge + broadcast                                  */
  /* ---------------------------------------------------------------- */

  /**
   * Applies structural merge (insert-wins-over-delete) and LWW for
   * property updates, then broadcasts the surviving operations with
   * authoritative server timestamps.
   */
  private mergeAndBroadcastOps(projectId: number, userId: number, ops: CRDTOperation[]): void {
    // Bump Lamport clock
    let clock = this.lamportClocks.get(projectId) ?? 0;

    // Get recent ops for structural merge window
    const recent = this.recentOps.get(projectId) ?? [];

    const survivingOps: CRDTOperation[] = [];

    for (const op of ops) {
      clock++;

      // Tag the operation with server timestamp and clientId
      const taggedOp: CRDTOperation = { ...op, timestamp: clock, clientId: userId };

      // Structural merge for insert/delete
      if (op.op === 'insert' || op.op === 'delete') {
        const recentCrdtOps = recent.map((r) => r.op);
        const verdict: MergeVerdict = structuralMerge(taggedOp, recentCrdtOps);
        if (verdict === 'reject' || verdict === 'superseded') {
          continue; // Drop this operation
        }
      }

      // LWW for updates: check if a more recent update for the same key exists
      if (op.op === 'update') {
        const opKey = `${op.path.join('.')}:${op.key}`;
        const newerExists = recent.some((r) => {
          if (r.op.op !== 'update') { return false; }
          const rKey = `${r.op.path.join('.')}:${r.op.key}`;
          return rKey === opKey && !lwwWins(r.serverTs, r.clientId, clock, userId);
        });
        if (newerExists) { continue; }
      }

      survivingOps.push(taggedOp);
      recent.push({ op: taggedOp, serverTs: clock, clientId: userId });
    }

    this.lamportClocks.set(projectId, clock);

    // Prune recent ops window
    if (recent.length > CollaborationServer.MERGE_WINDOW_SIZE) {
      recent.splice(0, recent.length - CollaborationServer.MERGE_WINDOW_SIZE);
    }
    this.recentOps.set(projectId, recent);

    if (survivingOps.length === 0) { return; }

    // Delegate to the existing broadcast
    this.applyAndBroadcastOps(projectId, userId, survivingOps);
  }

  /* ---------------------------------------------------------------- */
  /*  Locking                                                          */
  /* ---------------------------------------------------------------- */

  private handleLockRequest(projectId: number, userId: number, request: LockRequest): void {
    const key = lockKey(projectId, request.entityType, request.entityId);
    const existing = this.locks.get(key);

    if (existing && existing.expiresAt > Date.now() && existing.userId !== userId) {
      // Lock held by someone else
      const room = this.rooms.get(projectId);
      const entry = room?.get(userId);
      if (entry) {
        this.sendToClient(entry.ws, {
          type: 'lock-denied',
          userId,
          projectId,
          timestamp: Date.now(),
          payload: { entityKey: key, heldBy: existing.userId },
        });
      }
      return;
    }

    const timeout = Math.min(request.timeout || DEFAULT_LOCK_TIMEOUT_MS, DEFAULT_LOCK_TIMEOUT_MS);
    this.locks.set(key, { userId, expiresAt: Date.now() + timeout });

    // Notify requester
    const room = this.rooms.get(projectId);
    const entry = room?.get(userId);
    if (entry) {
      this.sendToClient(entry.ws, {
        type: 'lock-granted',
        userId,
        projectId,
        timestamp: Date.now(),
        payload: { entityKey: key },
      });
    }

    // Broadcast lock to room
    this.broadcastToRoom(projectId, {
      type: 'lock-granted',
      userId,
      projectId,
      timestamp: Date.now(),
      payload: { entityKey: key, userId },
    }, userId);
  }

  private handleLockRelease(projectId: number, userId: number, entityKey: string): void {
    const existing = this.locks.get(entityKey);
    if (!existing || existing.userId !== userId) { return; }

    this.locks.delete(entityKey);
    this.broadcastToRoom(projectId, {
      type: 'lock-released',
      userId,
      projectId,
      timestamp: Date.now(),
      payload: { entityKey },
    });
  }

  private cleanupExpiredLocks(): void {
    const now = Date.now();
    for (const [key, lock] of Array.from(this.locks)) {
      if (lock.expiresAt <= now) {
        this.locks.delete(key);
        // Broadcast release to all rooms (we don't track which room a lock belongs to)
        for (const [projectId] of Array.from(this.rooms)) {
          this.broadcastToRoom(projectId, {
            type: 'lock-released',
            userId: lock.userId,
            projectId,
            timestamp: now,
            payload: { entityKey: key },
          });
        }
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Role management                                                  */
  /* ---------------------------------------------------------------- */

  private handleRoleChange(projectId: number, userId: number, payload: Record<string, unknown>): void {
    const room = this.rooms.get(projectId);
    const senderEntry = room?.get(userId);
    if (!senderEntry || senderEntry.user.role !== 'owner') {
      this.sendErrorToUser(projectId, userId, 'Only the owner can change roles');
      return;
    }

    const targetUserId = Number(payload.targetUserId);
    const newRole = String(payload.role) as CollabRole;
    if (!['owner', 'editor', 'viewer'].includes(newRole)) {
      this.sendErrorToUser(projectId, userId, 'Invalid role');
      return;
    }

    const targetEntry = room?.get(targetUserId);
    if (!targetEntry) {
      this.sendErrorToUser(projectId, userId, 'Target user not in room');
      return;
    }

    targetEntry.user.role = newRole;

    this.broadcastToRoom(projectId, {
      type: 'role-change',
      userId,
      projectId,
      timestamp: Date.now(),
      payload: { targetUserId, role: newRole },
    });
  }

  setUserRole(projectId: number, userId: number, role: CollabRole): void {
    const room = this.rooms.get(projectId);
    const entry = room?.get(userId);
    if (!entry) { return; }

    entry.user.role = role;
    this.broadcastToRoom(projectId, {
      type: 'role-change',
      userId: 0,
      projectId,
      timestamp: Date.now(),
      payload: { targetUserId: userId, role },
    });
  }

  /* ---------------------------------------------------------------- */
  /*  Heartbeat                                                        */
  /* ---------------------------------------------------------------- */

  private heartbeat(): void {
    for (const [projectId, room] of Array.from(this.rooms)) {
      for (const [userId, entry] of Array.from(room)) {
        if (!entry.alive) {
          entry.ws.terminate();
          this.handleDisconnect(projectId, userId);
          continue;
        }
        entry.alive = false;
        entry.ws.ping();
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Transport helpers                                                */
  /* ---------------------------------------------------------------- */

  private broadcastToRoom(projectId: number, message: CollabMessage, excludeUserId?: number): void {
    const room = this.rooms.get(projectId);
    if (!room) { return; }

    const data = JSON.stringify(message);
    for (const [uid, entry] of Array.from(room)) {
      if (uid === excludeUserId) { continue; }
      if (entry.ws.readyState === WebSocket.OPEN) {
        entry.ws.send(data);
      }
    }
  }

  private sendToClient(ws: WebSocket, message: CollabMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocket, userId: number, projectId: number, errorMessage: string): void {
    this.sendToClient(ws, {
      type: 'error',
      userId,
      projectId,
      timestamp: Date.now(),
      payload: { error: errorMessage },
    });
  }

  private sendErrorToUser(projectId: number, userId: number, errorMessage: string): void {
    const room = this.rooms.get(projectId);
    const entry = room?.get(userId);
    if (entry) {
      this.sendError(entry.ws, userId, projectId, errorMessage);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Public API                                                       */
  /* ---------------------------------------------------------------- */

  getRoomUsers(projectId: number): CollabUser[] {
    const room = this.rooms.get(projectId);
    if (!room) { return []; }
    return Array.from(room.values()).map((e) => e.user);
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  getRoom(projectId: number): Map<number, ClientEntry> | undefined {
    return this.rooms.get(projectId);
  }

  getLocks(): Map<string, LockEntry> {
    return this.locks;
  }

  private getOrCreateRoom(projectId: number): Map<number, ClientEntry> {
    let room = this.rooms.get(projectId);
    if (!room) {
      room = new Map();
      this.rooms.set(projectId, room);
    }
    return room;
  }

  shutdown(): void {
    clearInterval(this.heartbeatTimer);
    clearInterval(this.lockCleanupTimer);

    for (const [, room] of Array.from(this.rooms)) {
      for (const [, entry] of Array.from(room)) {
        entry.ws.close(1001, 'Server shutting down');
      }
    }

    this.rooms.clear();
    this.locks.clear();
    this.stateVersions.clear();
    this.lamportClocks.clear();
    this.recentOps.clear();
    this.wss.close();
  }
}

/* ------------------------------------------------------------------ */
/*  Factory                                                            */
/* ------------------------------------------------------------------ */

export function attachCollaborationServer(server: Server): CollaborationServer {
  logger.info('Collaboration WebSocket server attached on /ws/collab');
  return new CollaborationServer(server);
}
