/**
 * WebSocket-based real-time collaboration server (UI-03 + FG-06 + IN-03).
 *
 * Attaches to the existing HTTP server and manages rooms, presence,
 * cursor streaming, entity locking, and state synchronisation.
 *
 * BL-0879 (Option C-plus-ACK): rooms are keyed by per-connection ids
 * (not user ids), update conflicts are detected against a server-owned
 * per-key frontier, and per-connection observed frontiers advance ONLY
 * via explicit client `state-update-ack` messages (used for both normal
 * remote `state-update` broadcasts and conflict `theirOp` ACKs).
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server, IncomingMessage } from 'http';
import type { Socket } from 'net';
import type {
  CollabMessage,
  CollabUser,
  CollabRole,
  CRDTOperation,
  LockRequest,
  MergeVerdict,
  Conflict,
} from '@shared/collaboration';
import {
  CURSOR_COLORS,
  CURSOR_THROTTLE_MS,
  DEFAULT_LOCK_TIMEOUT_MS,
  HEARTBEAT_INTERVAL_MS,
  isValidCollabMessage,
  lockKey,
  operationEntityKey,
  updateConflictKey,
  structuralMerge,
  detectConflict,
} from '@shared/collaboration';
import { randomUUID } from 'crypto';
import { validateSession } from './auth';
import { logger } from './logger';
import { validateWsSession } from './lib/ws-session-validator';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ClientEntry {
  /** Server-generated identity of this WebSocket connection (BL-0879). */
  connectionId: string;
  ws: WebSocket;
  user: CollabUser;
  alive: boolean;
  lastCursorBroadcast: number;
  sessionId: string;
}

interface LockEntry {
  userId: number;
  expiresAt: number;
}

/**
 * BL-0879: latest accepted authoritative UPDATE op for an entity key.
 * `op` is the server-tagged operation (includes timestamp + clientId)
 * so conflict payloads can carry the true winning op even after the
 * `recentOps` window evicts it.
 */
interface FrontierEntry {
  ts: number;
  connectionId: string;
  userId: number;
  op: CRDTOperation;
}

/* ------------------------------------------------------------------ */
/*  CollaborationServer                                                */
/* ------------------------------------------------------------------ */

export class CollaborationServer {
  private readonly server: Server;
  private readonly wss: WebSocketServer;
  private readonly upgradeHandler: (req: IncomingMessage, socket: Socket, head: Buffer) => void;
  /** projectId -> (connectionId -> ClientEntry). BL-0879: keyed by connection, not user. */
  private readonly rooms = new Map<number, Map<string, ClientEntry>>();
  private readonly locks = new Map<string, LockEntry>();
  private readonly stateVersions = new Map<number, number>();
  private readonly heartbeatTimer: ReturnType<typeof setInterval>;
  private readonly lockCleanupTimer: ReturnType<typeof setInterval>;
  private readonly sessionRevalidationTimer: ReturnType<typeof setInterval>;

  /**
   * Per-room Lamport clock — monotonically increasing logical timestamp
   * used for LWW conflict resolution. Each accepted operation bumps the
   * clock; the server timestamp is authoritative.
   */
  private readonly lamportClocks = new Map<number, number>();

  /**
   * Sliding window of recently accepted operations per room, keyed by
   * `projectId`. Used for intent-preserving structural merge of
   * insert/delete operations: when a new batch arrives we check it
   * against the recent window to detect concurrent conflicts. Window is
   * pruned on every state-update to keep only the last MERGE_WINDOW_SIZE
   * entries.
   *
   * BL-0879: UPDATE conflicts no longer use this window — they use
   * `keyFrontiers`. Insert/delete conflict payloads are still
   * window-bound until BL-0882.
   */
  private readonly recentOps = new Map<number, { op: CRDTOperation; serverTs: number; clientId: number }[]>();
  private static readonly MERGE_WINDOW_SIZE = 200;

  /**
   * BL-0879: projectId -> (entityKey -> FrontierEntry). The latest
   * accepted authoritative update for each key, keyed by
   * `updateConflictKey()`.
   */
  private readonly keyFrontiers = new Map<number, Map<string, FrontierEntry>>();

  /**
   * BL-0879: projectId -> (connectionId -> (entityKey -> ts)). The
   * highest server timestamp each connection has acknowledged (via
   * `state-update-ack`) or definitely learned (its own accepted ops).
   * A server SEND — including `conflict-detected` — never advances this.
   */
  private readonly observedFrontiers = new Map<number, Map<string, Map<string, number>>>();

  constructor(server: Server) {
    this.server = server;
    this.wss = new WebSocketServer({ noServer: true });

    this.upgradeHandler = (req, socket, head) => {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      if (url.pathname !== '/ws/collab') {
        return;
      }

      this.wss.handleUpgrade(req, socket, head, (ws) => {
        this.wss.emit('connection', ws, req);
      });
    };

    server.on('upgrade', this.upgradeHandler);

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      void this.onConnection(ws, req).catch((err: unknown) => {
        console.error('[Collaboration] Handshake error:', err);
        ws.close(1011, 'Internal Server Error');
      });
    });

    this.heartbeatTimer = setInterval(() => {
      this.heartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    this.lockCleanupTimer = setInterval(() => {
      this.cleanupExpiredLocks();
    }, 5_000);

    // Revalidate WebSocket sessions every 30 seconds to disconnect revoked users
    this.sessionRevalidationTimer = setInterval(() => {
      void this.revalidateSessions();
    }, 30_000);
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

    // BL-0526: Validate session + project access in one call
    const validation = await validateWsSession(sessionId, projectId);
    if (!validation.valid) {
      const reasonMessages: Record<string, string> = {
        expired: 'Invalid or expired session',
        invalid: 'Invalid session',
        no_access: 'No access to this project',
        project_deleted: 'Project has been deleted',
      };
      const msg = reasonMessages[validation.reason] ?? 'Authentication failed';
      this.sendError(ws, 0, projectId, msg);
      ws.close(4003, validation.reason);
      return;
    }

    const userId = validation.userId;
    const role: CollabRole = validation.role;
    const username = validation.username;

    // BL-0879: server-owned per-connection identity
    const connectionId = randomUUID();

    // Assign color — keep it stable per user where possible
    const room = this.getOrCreateRoom(projectId);
    const existingForUser = Array.from(room.values()).find((e) => e.user.userId === userId);
    const color = existingForUser
      ? existingForUser.user.color
      : CURSOR_COLORS[room.size % CURSOR_COLORS.length];

    const user: CollabUser = {
      userId,
      username,
      role,
      color,
      lastActivity: Date.now(),
    };

    const entry: ClientEntry = { connectionId, ws, user, alive: true, lastCursorBroadcast: 0, sessionId };
    room.set(connectionId, entry);

    // BL-0879: fresh connections start with an EMPTY observed frontier.
    // state-sync carries no document snapshot/replay, so it cannot
    // truthfully initialize observation (cold-start false conflicts are
    // accepted BL-0879 behavior — carved to BL-0883).
    this.getObservedMap(projectId, connectionId);

    // Wire up events — handlers close over the connectionId
    ws.on('pong', () => {
      entry.alive = true;
    });

    ws.on('message', (raw: Buffer | ArrayBuffer | Buffer[]) => {
      const text = Array.isArray(raw)
        ? Buffer.concat(raw).toString('utf8')
        : Buffer.isBuffer(raw)
          ? raw.toString('utf8')
          : Buffer.from(raw).toString('utf8');
      this.handleMessage(projectId, connectionId, text);
    });

    ws.on('close', () => {
      this.handleDisconnect(projectId, connectionId);
    });

    ws.on('error', () => {
      this.handleDisconnect(projectId, connectionId);
    });

    // Send state-sync to the new connection
    this.syncStateToNewConnection(projectId, connectionId);

    // Broadcast join to others (excluding only this socket)
    this.broadcastToRoom(projectId, {
      type: 'join',
      userId,
      projectId,
      timestamp: Date.now(),
      payload: { user },
    }, connectionId);
  }

  private handleDisconnect(projectId: number, connectionId: string): void {
    const room = this.rooms.get(projectId);
    if (!room) { return; }

    const entry = room.get(connectionId);
    if (!entry) { return; }
    const userId = entry.user.userId;

    room.delete(connectionId);

    // BL-0879: remove per-connection observed state
    this.observedFrontiers.get(projectId)?.delete(connectionId);

    const userStillConnected = Array.from(room.values()).some((e) => e.user.userId === userId);

    // Release all locks held by this user (existing product behavior —
    // lock ownership semantics unchanged by BL-0879)
    for (const [key, lock] of Array.from(this.locks)) {
      if (lock.userId === userId && key.startsWith(`${String(projectId)}:`)) {
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

    // Broadcast leave only when no other connection for that user remains
    if (!userStillConnected) {
      this.broadcastToRoom(projectId, {
        type: 'leave',
        userId,
        projectId,
        timestamp: Date.now(),
        payload: { userId },
      });
    }

    // Clean up empty room
    if (room.size === 0) {
      this.rooms.delete(projectId);
      this.stateVersions.delete(projectId);
      // BL-0879: clear conflict-detection state for the empty room
      this.observedFrontiers.delete(projectId);
      this.keyFrontiers.delete(projectId);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Message dispatch                                                 */
  /* ---------------------------------------------------------------- */

  private handleMessage(projectId: number, connectionId: string, raw: string): void {
    let msg: unknown;
    try {
      msg = JSON.parse(raw) as unknown;
    } catch {
      this.sendErrorToConnection(projectId, connectionId, 'Invalid JSON');
      return;
    }

    if (!isValidCollabMessage(msg)) {
      this.sendErrorToConnection(projectId, connectionId, 'Invalid message format');
      return;
    }

    const message = msg;
    const room = this.rooms.get(projectId);
    const entry = room?.get(connectionId);
    if (!entry) { return; }

    const userId = entry.user.userId;
    entry.user.lastActivity = Date.now();

    // Role enforcement: viewers can only send cursor-move, selection-change,
    // awareness — and state-update-ack (BL-0879: viewers observe updates too).
    if (entry.user.role === 'viewer') {
      const viewerAllowed: CollabMessage['type'][] = [
        'cursor-move',
        'selection-change',
        'awareness',
        'state-update-ack',
      ];
      if (!viewerAllowed.includes(message.type)) {
        this.sendErrorToConnection(projectId, connectionId, 'Viewers cannot perform this action');
        return;
      }
    }

    switch (message.type) {
      case 'cursor-move':
        this.handleCursorMove(projectId, connectionId, message.payload);
        break;
      case 'selection-change':
        this.handleSelectionChange(projectId, connectionId, message.payload);
        break;
      case 'state-update':
        this.handleStateUpdate(projectId, connectionId, message.payload.operations as CRDTOperation[]);
        break;
      case 'state-update-ack':
        this.handleStateUpdateAck(projectId, connectionId, message.payload);
        break;
      case 'lock-request':
        this.handleLockRequest(projectId, connectionId, message.payload as unknown as LockRequest);
        break;
      case 'lock-released':
        this.handleLockRelease(projectId, connectionId, message.payload.entityKey as string);
        break;
      case 'role-change':
        this.handleRoleChange(projectId, connectionId, message.payload);
        break;
      case 'awareness':
        this.broadcastToRoom(projectId, { ...message, userId }, connectionId);
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

  private handleCursorMove(projectId: number, connectionId: string, payload: Record<string, unknown>): void {
    const room = this.rooms.get(projectId);
    const entry = room?.get(connectionId);
    if (!entry) { return; }

    const now = Date.now();
    if (now - entry.lastCursorBroadcast < CURSOR_THROTTLE_MS) { return; }
    entry.lastCursorBroadcast = now;

    const cursor = {
      x: Number(payload.x),
      y: Number(payload.y),
      view: typeof payload.view === 'string' ? payload.view : '',
    };
    entry.user.cursor = cursor;

    this.broadcastToRoom(projectId, {
      type: 'cursor-move',
      userId: entry.user.userId,
      projectId,
      timestamp: now,
      payload: { cursor },
    }, connectionId);
  }

  private handleSelectionChange(projectId: number, connectionId: string, payload: Record<string, unknown>): void {
    const room = this.rooms.get(projectId);
    const entry = room?.get(connectionId);
    if (!entry) { return; }

    const selection = {
      type: typeof payload.type === 'string' ? payload.type : '',
      ids: Array.isArray(payload.ids) ? (payload.ids as unknown[]).map(String) : [],
    };
    entry.user.selection = selection;

    this.broadcastToRoom(projectId, {
      type: 'selection-change',
      userId: entry.user.userId,
      projectId,
      timestamp: Date.now(),
      payload: { selection },
    }, connectionId);
  }

  /* ---------------------------------------------------------------- */
  /*  State sync (simplified last-writer-wins)                         */
  /* ---------------------------------------------------------------- */

  private handleStateUpdate(projectId: number, connectionId: string, operations: CRDTOperation[]): void {
    if (!Array.isArray(operations) || operations.length === 0) { return; }

    const room = this.rooms.get(projectId);
    const entry = room?.get(connectionId);
    if (!entry) { return; }

    const userId = entry.user.userId;

    // --- BL-0488: RBAC enforcement for editors ---
    // Editors cannot delete root-level design entities (only owner can)
    if (entry.user.role === 'editor') {
      const blocked = operations.find((op) =>
        op.op === 'delete' && op.path.length === 0,
      );
      if (blocked) {
        this.sendErrorToConnection(projectId, connectionId, 'Editors cannot delete the root design');
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
      this.sendErrorToConnection(
        projectId,
        connectionId,
        `${String(rejectedOps.length)} operation(s) rejected: target entity is locked by another user`,
      );
    }

    if (acceptedOps.length === 0) { return; }

    // --- BL-0486 + BL-0879: CRDT merge ---
    this.mergeAndBroadcastOps(projectId, connectionId, acceptedOps);
  }

  private syncStateToNewConnection(projectId: number, connectionId: string): void {
    const room = this.rooms.get(projectId);
    const entry = room?.get(connectionId);
    if (!entry) { return; }

    const users = this.getRoomUsers(projectId);
    const version = this.stateVersions.get(projectId) ?? 0;

    // Collect current locks relevant to this project
    const activeLocks: Record<string, number> = {};
    for (const [key, lock] of Array.from(this.locks)) {
      if (lock.expiresAt > Date.now() && key.startsWith(`${String(projectId)}:`)) {
        activeLocks[key] = lock.userId;
      }
    }

    // BL-0879: connectionId is exposed for debugging/telemetry only.
    // The client must NOT echo it back — the server reads connection
    // identity from the WebSocket handler closure.
    // No keyFrontier is included: without a document snapshot/replay it
    // would be a causality lie (carved to BL-0883). state-sync never
    // initializes observed frontiers.
    const syncMsg: CollabMessage = {
      type: 'state-sync',
      userId: 0, // system
      projectId,
      timestamp: Date.now(),
      payload: { users, version, locks: activeLocks, connectionId },
    };

    this.sendToClient(entry.ws, syncMsg);
  }

  private applyAndBroadcastOps(
    projectId: number,
    originConnectionId: string,
    originUserId: number,
    ops: CRDTOperation[],
  ): void {
    const version = (this.stateVersions.get(projectId) ?? 0) + 1;
    this.stateVersions.set(projectId, version);

    // BL-0879: a sent WebSocket frame is NOT an applied document update —
    // observed frontiers only advance via explicit client ACKs.
    this.broadcastToRoom(projectId, {
      type: 'state-update',
      userId: originUserId,
      projectId,
      timestamp: Date.now(),
      payload: { operations: ops, version },
    }, originConnectionId);
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
  /*  BL-0879: frontier helpers                                        */
  /* ---------------------------------------------------------------- */

  private getProjectFrontiers(projectId: number): Map<string, FrontierEntry> {
    let frontiers = this.keyFrontiers.get(projectId);
    if (!frontiers) {
      frontiers = new Map();
      this.keyFrontiers.set(projectId, frontiers);
    }
    return frontiers;
  }

  private getObservedMap(projectId: number, connectionId: string): Map<string, number> {
    let perProject = this.observedFrontiers.get(projectId);
    if (!perProject) {
      perProject = new Map();
      this.observedFrontiers.set(projectId, perProject);
    }
    let observed = perProject.get(connectionId);
    if (!observed) {
      observed = new Map();
      perProject.set(connectionId, observed);
    }
    return observed;
  }

  /**
   * Monotonically advance a connection's observed frontier for a key.
   *
   * No-op when the per-connection map is missing (race with disconnect
   * cleanup: a last queued ACK can arrive after cleanup deleted the
   * connection's observed map — creating a phantom entry here would
   * never be cleaned up).
   */
  private markObserved(projectId: number, connectionId: string, entityKey: string, ts: number): void {
    const observed = this.observedFrontiers.get(projectId)?.get(connectionId);
    if (!observed) { return; }
    observed.set(entityKey, Math.max(observed.get(entityKey) ?? 0, ts));
  }

  /**
   * BL-0879: unified `state-update-ack` handler — used for both normal
   * remote `state-update` broadcasts and conflict `theirOp` ACKs. The
   * server does not care which one the ACK originated from.
   */
  private handleStateUpdateAck(projectId: number, connectionId: string, payload: Record<string, unknown>): void {
    const updates = payload.updates;
    if (!Array.isArray(updates)) { return; }

    const frontiers = this.keyFrontiers.get(projectId);

    for (const raw of updates as unknown[]) {
      if (typeof raw !== 'object' || raw === null) { continue; }
      const ackEntry = raw as Record<string, unknown>;
      const entityKey = ackEntry.entityKey;
      const timestamp = ackEntry.timestamp;
      if (typeof entityKey !== 'string' || entityKey.length === 0) { continue; }
      if (typeof timestamp !== 'number' || !Number.isFinite(timestamp) || timestamp <= 0) { continue; }

      // Ignore ACKs with no current frontier
      const frontier = frontiers?.get(entityKey);
      if (!frontier) { continue; }

      // An ACK may not advance past the actual authoritative frontier.
      // It need not equal the frontier ts: an ACK for an older accepted
      // timestamp still advances observation to that older timestamp.
      if (timestamp > frontier.ts) { continue; }

      this.markObserved(projectId, connectionId, entityKey, timestamp);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  BL-0486 + BL-0879: CRDT merge + broadcast                        */
  /* ---------------------------------------------------------------- */

  /**
   * Applies structural merge (insert-wins-over-delete) for insert/delete
   * and frontier-based conflict detection for property updates, then
   * broadcasts the surviving operations with authoritative server
   * timestamps.
   *
   * BL-0879 update rule: an incoming update from connection C for key K
   * conflicts when `frontier.ts > observedFrontier[C][K] &&
   * frontier.connectionId !== C`. A conflict is observation-neutral —
   * the client must ACK `theirOp` via `state-update-ack` before a
   * resend of the same key can be accepted.
   */
  private mergeAndBroadcastOps(projectId: number, connectionId: string, ops: CRDTOperation[]): void {
    const room = this.rooms.get(projectId);
    const entry = room?.get(connectionId);
    if (!entry) { return; }
    const userId = entry.user.userId;

    // Bump Lamport clock
    let clock = this.lamportClocks.get(projectId) ?? 0;

    // Get recent ops for structural merge window (insert/delete only)
    const recent = this.recentOps.get(projectId) ?? [];

    const frontiers = this.getProjectFrontiers(projectId);
    const observed = this.getObservedMap(projectId, connectionId);

    const survivingOps: CRDTOperation[] = [];
    const conflicts: Conflict[] = [];

    for (const op of ops) {
      clock++;

      // Tag the operation with server timestamp and clientId
      const taggedOp: CRDTOperation = { ...op, timestamp: clock, clientId: userId };

      // --- BL-0879: UPDATE path uses the per-key frontier only ---
      if (taggedOp.op === 'update') {
        const entityKey = updateConflictKey(taggedOp);
        const frontier = entityKey ? frontiers.get(entityKey) : undefined;
        const observedTs = entityKey ? (observed.get(entityKey) ?? 0) : 0;

        if (
          entityKey &&
          frontier &&
          frontier.ts > observedTs &&
          frontier.connectionId !== connectionId
        ) {
          // theirOp comes from the frontier, not from recentOps — the
          // conflict payload no longer depends on the 200-op window.
          conflicts.push({
            id: randomUUID(),
            projectId,
            kind: 'lww-update',
            path: taggedOp.path,
            key: taggedOp.key,
            yourOp: taggedOp,
            theirOp: frontier.op,
            detectedAt: clock,
          });
          continue;
        }

        survivingOps.push(taggedOp);
        recent.push({ op: taggedOp, serverTs: clock, clientId: userId });

        if (entityKey) {
          frontiers.set(entityKey, {
            ts: clock,
            connectionId,
            userId,
            op: taggedOp,
          });
          // Sender self-observation: the sender obviously knows the
          // local op it just sent (it receives no echo).
          this.markObserved(projectId, connectionId, entityKey, clock);
        }
        continue;
      }

      // --- Insert/delete: existing recentOps structural merge logic ---
      // Conflict payloads here are still window-bound (MERGE_WINDOW_SIZE)
      // until BL-0882.
      const conflictHit = detectConflict(taggedOp, recent);
      const recentCrdtOps = recent.map((r) => r.op);
      const verdict: MergeVerdict = structuralMerge(taggedOp, recentCrdtOps);
      if (verdict === 'reject' || verdict === 'superseded') {
        if (conflictHit) {
          conflicts.push({
            id: randomUUID(),
            projectId,
            detectedAt: clock,
            ...conflictHit,
          });
        }
        continue; // Drop this operation
      }

      survivingOps.push(taggedOp);
      recent.push({ op: taggedOp, serverTs: clock, clientId: userId });
    }

    // BL-0879: Surface conflicts to the losing CONNECTION only — the
    // room's authoritative state has already converged on `theirOp`.
    // Sending the conflict does NOT advance the observed frontier; the
    // client must ACK `theirOp` via `state-update-ack` before a resend
    // of "mine" can be accepted.
    if (conflicts.length > 0) {
      this.sendToConnection(projectId, connectionId, {
        type: 'conflict-detected',
        userId,
        projectId,
        timestamp: Date.now(),
        payload: { conflicts: conflicts as unknown as Record<string, unknown>[] },
      });
    }

    this.lamportClocks.set(projectId, clock);

    // Prune recent ops window
    if (recent.length > CollaborationServer.MERGE_WINDOW_SIZE) {
      recent.splice(0, recent.length - CollaborationServer.MERGE_WINDOW_SIZE);
    }
    this.recentOps.set(projectId, recent);

    if (survivingOps.length === 0) { return; }

    // Delegate to the existing broadcast
    this.applyAndBroadcastOps(projectId, connectionId, userId, survivingOps);
  }

  /* ---------------------------------------------------------------- */
  /*  Locking                                                          */
  /* ---------------------------------------------------------------- */

  private handleLockRequest(projectId: number, connectionId: string, request: LockRequest): void {
    const room = this.rooms.get(projectId);
    const entry = room?.get(connectionId);
    if (!entry) { return; }
    const userId = entry.user.userId;

    const key = lockKey(projectId, request.entityType, request.entityId);
    const existing = this.locks.get(key);

    if (existing && existing.expiresAt > Date.now() && existing.userId !== userId) {
      // Lock held by someone else
      this.sendToConnection(projectId, connectionId, {
        type: 'lock-denied',
        userId,
        projectId,
        timestamp: Date.now(),
        payload: { entityKey: key, heldBy: existing.userId },
      });
      return;
    }

    const timeout = Math.min(request.timeout || DEFAULT_LOCK_TIMEOUT_MS, DEFAULT_LOCK_TIMEOUT_MS);
    this.locks.set(key, { userId, expiresAt: Date.now() + timeout });

    // Notify requester
    this.sendToConnection(projectId, connectionId, {
      type: 'lock-granted',
      userId,
      projectId,
      timestamp: Date.now(),
      payload: { entityKey: key },
    });

    // Broadcast lock to room
    this.broadcastToRoom(projectId, {
      type: 'lock-granted',
      userId,
      projectId,
      timestamp: Date.now(),
      payload: { entityKey: key, userId },
    }, connectionId);
  }

  private handleLockRelease(projectId: number, connectionId: string, entityKey: string): void {
    const room = this.rooms.get(projectId);
    const entry = room?.get(connectionId);
    if (!entry) { return; }
    const userId = entry.user.userId;

    const existing = this.locks.get(entityKey);
    if (existing?.userId !== userId) { return; }

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
        const [projectIdRaw] = key.split(':', 1);
        const projectId = Number(projectIdRaw);
        if (!Number.isFinite(projectId) || !this.rooms.has(projectId)) {
          continue;
        }
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

  /* ---------------------------------------------------------------- */
  /*  Role management                                                  */
  /* ---------------------------------------------------------------- */

  private handleRoleChange(projectId: number, connectionId: string, payload: Record<string, unknown>): void {
    const room = this.rooms.get(projectId);
    const senderEntry = room?.get(connectionId);
    if (senderEntry?.user.role !== 'owner') {
      this.sendErrorToConnection(projectId, connectionId, 'Only the owner can change roles');
      return;
    }

    const targetUserId = Number(payload.targetUserId);
    const newRole = String(payload.role) as CollabRole;
    if (!['owner', 'editor', 'viewer'].includes(newRole)) {
      this.sendErrorToConnection(projectId, connectionId, 'Invalid role');
      return;
    }

    // Update ALL connections for the target user (multi-tab)
    const targetEntries = room
      ? Array.from(room.values()).filter((e) => e.user.userId === targetUserId)
      : [];
    if (targetEntries.length === 0) {
      this.sendErrorToConnection(projectId, connectionId, 'Target user not in room');
      return;
    }

    for (const target of targetEntries) {
      target.user.role = newRole;
    }

    this.broadcastToRoom(projectId, {
      type: 'role-change',
      userId: senderEntry.user.userId,
      projectId,
      timestamp: Date.now(),
      payload: { targetUserId, role: newRole },
    });
  }

  setUserRole(projectId: number, userId: number, role: CollabRole): void {
    const room = this.rooms.get(projectId);
    if (!room) { return; }

    // Update ALL connections for this user (multi-tab)
    const entries = Array.from(room.values()).filter((e) => e.user.userId === userId);
    if (entries.length === 0) { return; }

    for (const entry of entries) {
      entry.user.role = role;
    }

    this.broadcastToRoom(projectId, {
      type: 'role-change',
      userId: 0,
      projectId,
      timestamp: Date.now(),
      payload: { targetUserId: userId, role },
    });
  }

  /* ---------------------------------------------------------------- */
  /*  Session revalidation                                             */
  /* ---------------------------------------------------------------- */

  /**
   * Periodically revalidate all connected WebSocket sessions.
   * If a session has been revoked or expired, disconnect the client.
   */
  private async revalidateSessions(): Promise<void> {
    for (const [projectId, room] of Array.from(this.rooms)) {
      for (const [connectionId, entry] of Array.from(room)) {
        try {
          const session = await validateSession(entry.sessionId);
          if (!session) {
            logger.info(`[Collaboration] Session revoked for user ${String(entry.user.userId)} in project ${String(projectId)}, disconnecting`);
            this.sendError(entry.ws, entry.user.userId, projectId, 'Session expired or revoked');
            entry.ws.close(4003, 'Session expired');
            this.handleDisconnect(projectId, connectionId);
          }
        } catch {
          // If validation fails due to a transient error, skip this cycle
          // rather than disconnecting the user
        }
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Heartbeat                                                        */
  /* ---------------------------------------------------------------- */

  private heartbeat(): void {
    for (const [projectId, room] of Array.from(this.rooms)) {
      for (const [connectionId, entry] of Array.from(room)) {
        if (!entry.alive) {
          entry.ws.terminate();
          this.handleDisconnect(projectId, connectionId);
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

  private broadcastToRoom(projectId: number, message: CollabMessage, excludeConnectionId?: string): void {
    const room = this.rooms.get(projectId);
    if (!room) { return; }

    // BL-0879: exclusion is by CONNECTION id — same-account second tabs
    // must still receive the update. Broadcasting never advances
    // observed frontiers; only client ACKs do.
    const data = JSON.stringify(message);
    for (const [cid, entry] of Array.from(room)) {
      if (cid === excludeConnectionId) { continue; }
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

  private sendToConnection(projectId: number, connectionId: string, message: CollabMessage): void {
    const entry = this.rooms.get(projectId)?.get(connectionId);
    if (entry) {
      this.sendToClient(entry.ws, message);
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

  private sendErrorToConnection(projectId: number, connectionId: string, errorMessage: string): void {
    const entry = this.rooms.get(projectId)?.get(connectionId);
    if (entry) {
      this.sendError(entry.ws, entry.user.userId, projectId, errorMessage);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Public API                                                       */
  /* ---------------------------------------------------------------- */

  getRoomUsers(projectId: number): CollabUser[] {
    const room = this.rooms.get(projectId);
    if (!room) { return []; }
    // BL-0879: presence is per USER — dedupe duplicate tabs (first entry
    // per user id wins; color is stable per user).
    const byUser = new Map<number, CollabUser>();
    for (const entry of Array.from(room.values())) {
      if (!byUser.has(entry.user.userId)) {
        byUser.set(entry.user.userId, entry.user);
      }
    }
    return Array.from(byUser.values());
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  getRoom(projectId: number): Map<string, ClientEntry> | undefined {
    return this.rooms.get(projectId);
  }

  getLocks(): Map<string, LockEntry> {
    return this.locks;
  }

  /**
   * BL-0879 test hook: counts of conflict-detection state for a project.
   */
  getConflictStateCounts(projectId: number): { keyFrontiers: number; observedConnections: number } {
    return {
      keyFrontiers: this.keyFrontiers.get(projectId)?.size ?? 0,
      observedConnections: this.observedFrontiers.get(projectId)?.size ?? 0,
    };
  }

  private getOrCreateRoom(projectId: number): Map<string, ClientEntry> {
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
    clearInterval(this.sessionRevalidationTimer);

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
    this.keyFrontiers.clear();
    this.observedFrontiers.clear();
    this.server.off('upgrade', this.upgradeHandler);
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
