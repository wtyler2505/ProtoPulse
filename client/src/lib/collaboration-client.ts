/**
 * Client-side real-time collaboration manager (UI-03 + FG-06 + IN-03).
 *
 * Manages WebSocket connection, presence, cursor streaming, entity locking,
 * and state synchronisation with exponential-backoff reconnection.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CollabMessage,
  CollabUser,
  CollabRole,
  CRDTOperation,
  Conflict,
} from '@shared/collaboration';
import {
  CURSOR_THROTTLE_MS,
  isValidCollabMessage,
  lockKey,
} from '@shared/collaboration';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type CollabConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface CollabEventMap {
  'connection-change': CollabConnectionState;
  'users-change': CollabUser[];
  'cursor-move': { userId: number; cursor: { x: number; y: number; view: string } };
  'selection-change': { userId: number; selection: { type: string; ids: string[] } };
  'state-update': CRDTOperation[];
  'lock-granted': { entityKey: string };
  'lock-denied': { entityKey: string; heldBy: number };
  'lock-released': { entityKey: string };
  'role-changed': { userId: number; role: CollabRole };
  'conflicts-change': Conflict[];
  'error': Error;
}

type ListenerFn<K extends keyof CollabEventMap> = (data: CollabEventMap[K]) => void;

/* ------------------------------------------------------------------ */
/*  CollaborationClient                                                */
/* ------------------------------------------------------------------ */

export class CollaborationClient {
  private ws: WebSocket | null = null;
  private readonly projectId: number;
  private readonly sessionId: string;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private connectionState: CollabConnectionState = 'disconnected';
  private users: CollabUser[] = [];
  private myRole: CollabRole = 'viewer';
  private myUserId = 0;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  private listeners = new Map<string, Set<Function>>();

  // Cursor throttle
  private cursorThrottleTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingCursorUpdate: { x: number; y: number; view: string } | null = null;

  // BL-0524: Pending conflicts awaiting user review
  private pendingConflicts: Conflict[] = [];

  // Lock tracking
  private activeLocks = new Map<string, number>(); // entityKey -> userId
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  private pendingLockResolvers = new Map<string, { resolve: Function; reject: Function }>();

  constructor(projectId: number, sessionId: string) {
    this.projectId = projectId;
    this.sessionId = sessionId;
  }

  /* ---------------------------------------------------------------- */
  /*  Connection                                                       */
  /* ---------------------------------------------------------------- */

  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.setConnectionState('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws/collab?projectId=${String(this.projectId)}&sessionId=${encodeURIComponent(this.sessionId)}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.setConnectionState('connected');
    };

    this.ws.onmessage = (event: MessageEvent) => {
      this.handleMessage(String(event.data));
    };

    this.ws.onclose = (event: CloseEvent) => {
      // Auth failure codes — do not reconnect
      if (event.code >= 4001 && event.code <= 4003) {
        this.setConnectionState('error');
        this.emit('error', new Error(event.reason || 'Authentication failed'));
        return;
      }
      this.attemptReconnect();
    };

    this.ws.onerror = () => {
      // onclose will fire after onerror — reconnection handled there
    };
  }

  disconnect(): void {
    this.clearReconnectTimer();
    this.reconnectAttempts = 0;

    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.onopen = null;
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.users = [];
    this.activeLocks.clear();
    this.setConnectionState('disconnected');
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setConnectionState('error');
      this.emit('error', new Error('Max reconnect attempts exceeded'));
      return;
    }

    this.setConnectionState('reconnecting');
    const backoffMs = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30_000);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, backoffMs);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  getConnectionState(): CollabConnectionState {
    return this.connectionState;
  }

  private setConnectionState(state: CollabConnectionState): void {
    if (this.connectionState === state) { return; }
    this.connectionState = state;
    this.emit('connection-change', state);
  }

  /* ---------------------------------------------------------------- */
  /*  Message handling                                                 */
  /* ---------------------------------------------------------------- */

  private handleMessage(raw: string): void {
    let msg: unknown;
    try {
      msg = JSON.parse(raw) as unknown;
    } catch {
      return;
    }

    if (!isValidCollabMessage(msg)) { return; }

    const message = msg;

    switch (message.type) {
      case 'state-sync':
        this.handleStateSync(message.payload);
        break;
      case 'join':
        this.handleUserJoin(message.payload);
        break;
      case 'leave':
        this.handleUserLeave(message.payload);
        break;
      case 'cursor-move':
        this.emit('cursor-move', {
          userId: message.userId,
          cursor: message.payload.cursor as { x: number; y: number; view: string },
        });
        break;
      case 'selection-change':
        this.emit('selection-change', {
          userId: message.userId,
          selection: message.payload.selection as { type: string; ids: string[] },
        });
        break;
      case 'state-update':
        this.emit('state-update', message.payload.operations as CRDTOperation[]);
        break;
      case 'lock-granted':
        this.handleLockGranted(message);
        break;
      case 'lock-denied':
        this.handleLockDenied(message);
        break;
      case 'lock-released':
        this.handleLockReleased(message);
        break;
      case 'role-change':
        this.handleRoleChange(message.payload);
        break;
      case 'conflict-detected':
        this.handleConflicts(message.payload);
        break;
      case 'error':
        this.emit('error', new Error(String(message.payload.error)));
        break;
      default:
        break;
    }
  }

  private handleStateSync(payload: Record<string, unknown>): void {
    this.users = payload.users as CollabUser[];
    this.emit('users-change', this.users);

    // Find our own role from the user list
    const me = this.users.find((u) => u.userId === this.myUserId);
    if (me) {
      this.myRole = me.role;
    }

    // Restore locks
    const locks = payload.locks as Record<string, number> | undefined;
    if (locks) {
      this.activeLocks.clear();
      for (const [key, uid] of Object.entries(locks)) {
        this.activeLocks.set(key, uid);
      }
    }
  }

  private handleUserJoin(payload: Record<string, unknown>): void {
    const user = payload.user as CollabUser;
    const existing = this.users.findIndex((u) => u.userId === user.userId);
    if (existing >= 0) {
      this.users[existing] = user;
    } else {
      this.users = [...this.users, user];
    }
    this.emit('users-change', this.users);
  }

  private handleUserLeave(payload: Record<string, unknown>): void {
    const leftUserId = Number(payload.userId);
    this.users = this.users.filter((u) => u.userId !== leftUserId);
    this.emit('users-change', this.users);
  }

  private handleLockGranted(message: CollabMessage): void {
    const entityKey = String(message.payload.entityKey);
    const lockUserId = message.payload.userId ? Number(message.payload.userId) : message.userId;
    this.activeLocks.set(entityKey, lockUserId);

    // Resolve pending lock promise if it was ours
    const resolver = this.pendingLockResolvers.get(entityKey);
    if (resolver && message.userId === this.myUserId) {
      resolver.resolve(true);
      this.pendingLockResolvers.delete(entityKey);
    }

    this.emit('lock-granted', { entityKey });
  }

  private handleLockDenied(message: CollabMessage): void {
    const entityKey = String(message.payload.entityKey);
    const heldBy = Number(message.payload.heldBy);

    const resolver = this.pendingLockResolvers.get(entityKey);
    if (resolver) {
      resolver.resolve(false);
      this.pendingLockResolvers.delete(entityKey);
    }

    this.emit('lock-denied', { entityKey, heldBy });
  }

  private handleLockReleased(message: CollabMessage): void {
    const entityKey = String(message.payload.entityKey);
    this.activeLocks.delete(entityKey);
    this.emit('lock-released', { entityKey });
  }

  private handleRoleChange(payload: Record<string, unknown>): void {
    const targetUserId = Number(payload.targetUserId);
    const role = String(payload.role) as CollabRole;

    const user = this.users.find((u) => u.userId === targetUserId);
    if (user) {
      user.role = role;
      this.users = [...this.users];
      this.emit('users-change', this.users);
    }

    if (targetUserId === this.myUserId) {
      this.myRole = role;
    }

    this.emit('role-changed', { userId: targetUserId, role });
  }

  /* ---------------------------------------------------------------- */
  /*  BL-0524: Conflict tracking                                        */
  /* ---------------------------------------------------------------- */

  private handleConflicts(payload: Record<string, unknown>): void {
    const raw = payload.conflicts;
    if (!Array.isArray(raw)) { return; }
    const incoming = raw as Conflict[];
    if (incoming.length === 0) { return; }
    this.pendingConflicts = [...this.pendingConflicts, ...incoming];
    this.emit('conflicts-change', this.pendingConflicts);
  }

  /** Returns the current list of unresolved conflicts for this client. */
  getPendingConflicts(): Conflict[] {
    return this.pendingConflicts;
  }

  /**
   * Resolve a conflict with a chosen value. The client re-emits a
   * state-update that will be merged normally on the server, receiving
   * a fresh Lamport timestamp that beats the previously winning op.
   *
   * - `acceptMine`  — re-apply `yourOp` (insert retries; update/delete re-send).
   * - `acceptTheirs` — no-op (authoritative state already matches).
   * - `merge`       — submit `customValue` as an update at the same path/key.
   */
  resolveConflict(
    conflictId: string,
    action: 'mine' | 'theirs' | 'merge',
    customValue?: unknown,
  ): void {
    const idx = this.pendingConflicts.findIndex((c) => c.id === conflictId);
    if (idx < 0) { return; }
    const conflict = this.pendingConflicts[idx];

    if (action === 'mine') {
      // Re-emit the losing op without its server-assigned timestamp so the
      // server re-tags it with a newer Lamport clock.
      const { timestamp: _ts, clientId: _cid, ...op } = conflict.yourOp;
      void _ts; void _cid;
      this.sendStateUpdate([op as CRDTOperation]);
    } else if (action === 'merge') {
      this.sendStateUpdate([{
        op: 'update',
        path: conflict.path,
        key: conflict.key,
        value: customValue,
      }]);
    }
    // `theirs` — no server call; state already matches.

    this.pendingConflicts = this.pendingConflicts.filter((_, i) => i !== idx);
    this.emit('conflicts-change', this.pendingConflicts);
  }

  /** Dismiss a conflict without taking action (treated as accept-theirs). */
  dismissConflict(conflictId: string): void {
    this.resolveConflict(conflictId, 'theirs');
  }

  /* ---------------------------------------------------------------- */
  /*  Presence                                                         */
  /* ---------------------------------------------------------------- */

  sendCursorPosition(x: number, y: number, view: string): void {
    this.pendingCursorUpdate = { x, y, view };

    if (this.cursorThrottleTimer !== null) { return; }

    this.cursorThrottleTimer = setTimeout(() => {
      this.cursorThrottleTimer = null;
      if (this.pendingCursorUpdate) {
        this.send({
          type: 'cursor-move',
          userId: this.myUserId,
          projectId: this.projectId,
          timestamp: Date.now(),
          payload: this.pendingCursorUpdate,
        });
        this.pendingCursorUpdate = null;
      }
    }, CURSOR_THROTTLE_MS);
  }

  sendSelectionChange(type: string, ids: string[]): void {
    this.send({
      type: 'selection-change',
      userId: this.myUserId,
      projectId: this.projectId,
      timestamp: Date.now(),
      payload: { type, ids },
    });
  }

  getActiveUsers(): CollabUser[] {
    return this.users;
  }

  /* ---------------------------------------------------------------- */
  /*  State operations                                                 */
  /* ---------------------------------------------------------------- */

  sendStateUpdate(operations: CRDTOperation[]): void {
    this.send({
      type: 'state-update',
      userId: this.myUserId,
      projectId: this.projectId,
      timestamp: Date.now(),
      payload: { operations },
    });
  }

  /* ---------------------------------------------------------------- */
  /*  Locking                                                          */
  /* ---------------------------------------------------------------- */

  requestLock(entityType: string, entityId: string): Promise<boolean> {
    const key = lockKey(this.projectId, entityType, entityId);

    return new Promise<boolean>((resolve) => {
      // If we already hold the lock, resolve immediately
      const holder = this.activeLocks.get(key);
      if (holder === this.myUserId) {
        resolve(true);
        return;
      }

      this.pendingLockResolvers.set(key, { resolve, reject: resolve });

      this.send({
        type: 'lock-request',
        userId: this.myUserId,
        projectId: this.projectId,
        timestamp: Date.now(),
        payload: { entityType, entityId, userId: this.myUserId, timeout: 30_000 },
      });

      // Timeout after 5s if no response
      setTimeout(() => {
        const pending = this.pendingLockResolvers.get(key);
        if (pending) {
          pending.resolve(false);
          this.pendingLockResolvers.delete(key);
        }
      }, 5_000);
    });
  }

  releaseLock(entityType: string, entityId: string): void {
    const key = lockKey(this.projectId, entityType, entityId);
    this.activeLocks.delete(key);

    this.send({
      type: 'lock-released',
      userId: this.myUserId,
      projectId: this.projectId,
      timestamp: Date.now(),
      payload: { entityKey: key },
    });
  }

  isLocked(entityType: string, entityId: string): { locked: boolean; byUserId?: number } {
    const key = lockKey(this.projectId, entityType, entityId);
    const holder = this.activeLocks.get(key);
    if (holder !== undefined) {
      return { locked: true, byUserId: holder };
    }
    return { locked: false };
  }

  /* ---------------------------------------------------------------- */
  /*  Events                                                           */
  /* ---------------------------------------------------------------- */

  on<K extends keyof CollabEventMap>(event: K, callback: ListenerFn<K>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(callback);
    return () => { set.delete(callback); };
  }

  off<K extends keyof CollabEventMap>(event: K, callback: ListenerFn<K>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback);
    }
  }

  private emit<K extends keyof CollabEventMap>(event: K, data: CollabEventMap[K]): void {
    const set = this.listeners.get(event);
    if (!set) { return; }
    for (const fn of Array.from(set)) {
      try {
        (fn as ListenerFn<K>)(data);
      } catch {
        // Listener errors should not break the event loop
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Transport                                                        */
  /* ---------------------------------------------------------------- */

  private send(message: CollabMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /** Expose userId for tests and hook. */
  setUserId(userId: number): void {
    this.myUserId = userId;
  }

  /** Expose role for hook. */
  getMyRole(): CollabRole {
    return this.myRole;
  }
}

/* ------------------------------------------------------------------ */
/*  React Hook                                                         */
/* ------------------------------------------------------------------ */

export function useCollaboration(projectId: number, sessionId: string): {
  connectionState: CollabConnectionState;
  activeUsers: CollabUser[];
  sendCursor: (x: number, y: number, view: string) => void;
  sendSelection: (type: string, ids: string[]) => void;
  requestLock: (entityType: string, entityId: string) => Promise<boolean>;
  releaseLock: (entityType: string, entityId: string) => void;
  isLocked: (entityType: string, entityId: string) => { locked: boolean; byUserId?: number };
  myRole: CollabRole;
  pendingConflicts: Conflict[];
  resolveConflict: (conflictId: string, action: 'mine' | 'theirs' | 'merge', customValue?: unknown) => void;
} {
  const clientRef = useRef<CollaborationClient | null>(null);
  const [connectionState, setConnectionState] = useState<CollabConnectionState>('disconnected');
  const [activeUsers, setActiveUsers] = useState<CollabUser[]>([]);
  const [myRole, setMyRole] = useState<CollabRole>('viewer');
  const [pendingConflicts, setPendingConflicts] = useState<Conflict[]>([]);

  useEffect(() => {
    if (!projectId || !sessionId) { return; }

    const client = new CollaborationClient(projectId, sessionId);
    clientRef.current = client;

    const unsubConnection = client.on('connection-change', setConnectionState);
    const unsubUsers = client.on('users-change', setActiveUsers);
    const unsubRole = client.on('role-changed', (_data) => {
      setMyRole(client.getMyRole());
    });
    const unsubConflicts = client.on('conflicts-change', setPendingConflicts);

    client.connect();

    return () => {
      unsubConnection();
      unsubUsers();
      unsubRole();
      unsubConflicts();
      client.disconnect();
      clientRef.current = null;
    };
  }, [projectId, sessionId]);

  const sendCursor = useCallback((x: number, y: number, view: string) => {
    clientRef.current?.sendCursorPosition(x, y, view);
  }, []);

  const sendSelection = useCallback((type: string, ids: string[]) => {
    clientRef.current?.sendSelectionChange(type, ids);
  }, []);

  const requestLockFn = useCallback((entityType: string, entityId: string) => {
    return clientRef.current?.requestLock(entityType, entityId) ?? Promise.resolve(false);
  }, []);

  const releaseLockFn = useCallback((entityType: string, entityId: string) => {
    clientRef.current?.releaseLock(entityType, entityId);
  }, []);

  const isLockedFn = useCallback((entityType: string, entityId: string) => {
    return clientRef.current?.isLocked(entityType, entityId) ?? { locked: false };
  }, []);

  const resolveConflictFn = useCallback(
    (conflictId: string, action: 'mine' | 'theirs' | 'merge', customValue?: unknown) => {
      clientRef.current?.resolveConflict(conflictId, action, customValue);
    },
    [],
  );

  return {
    connectionState,
    activeUsers,
    sendCursor,
    sendSelection,
    requestLock: requestLockFn,
    releaseLock: releaseLockFn,
    isLocked: isLockedFn,
    myRole,
    pendingConflicts,
    resolveConflict: resolveConflictFn,
  };
}
