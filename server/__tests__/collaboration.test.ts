/**
 * Tests for CollaborationServer (WebSocket real-time collaboration).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import type { CollabMessage, CollabRole } from '@shared/collaboration';
import {
  CURSOR_THROTTLE_MS,
  DEFAULT_LOCK_TIMEOUT_MS,
  lockKey,
  isValidCollabMessage,
  CURSOR_COLORS,
} from '@shared/collaboration';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

// Mock auth + storage before importing CollaborationServer
const mockValidateSession = vi.fn<(sessionId: string) => Promise<{ userId: number } | null>>();
const mockGetUserById = vi.fn<(id: number) => Promise<{ username: string } | null>>();
const mockIsProjectOwner = vi.fn<(projectId: number, userId: number) => Promise<boolean>>();

vi.mock('../auth', () => ({
  validateSession: (...args: unknown[]) => mockValidateSession(args[0] as string),
  getUserById: (...args: unknown[]) => mockGetUserById(args[0] as number),
}));

const mockGetProject = vi.fn<(id: number) => Promise<{ id: number; ownerId: number | null } | undefined>>();
const mockGetProjectMembers = vi.fn<(projectId: number) => Promise<{ userId: number; role: string; status: string }[]>>();

vi.mock('../storage', () => ({
  storage: {
    isProjectOwner: (...args: unknown[]) => mockIsProjectOwner(args[0] as number, args[1] as number),
    getProject: (...args: unknown[]) => mockGetProject(args[0] as number),
    getProjectMembers: (...args: unknown[]) => mockGetProjectMembers(args[0] as number),
  },
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

/* ------------------------------------------------------------------ */
/*  Mock WebSocket + Server                                            */
/* ------------------------------------------------------------------ */

class MockWebSocket extends EventEmitter {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;

  readyState = MockWebSocket.OPEN;
  sent: string[] = [];
  pinged = false;
  terminated = false;

  send(data: string): void {
    this.sent.push(data);
  }

  ping(): void {
    this.pinged = true;
  }

  close(_code?: number, _reason?: string): void {
    this.readyState = MockWebSocket.CLOSED;
  }

  terminate(): void {
    this.terminated = true;
    this.readyState = MockWebSocket.CLOSED;
  }
}

// Track WSS creation
let wssConnectionHandler: ((ws: MockWebSocket, req: { url: string; headers: Record<string, string> }) => void) | null = null;

vi.mock('ws', async () => {
  const { EventEmitter: EE } = await import('events');
  class InternalMockWebSocket extends EE {
    static readonly OPEN = 1;
    static readonly CLOSED = 3;
    readyState = 1;
    sent: string[] = [];
    pinged = false;
    terminated = false;
    send(data: string): void { this.sent.push(data); }
    ping(): void { this.pinged = true; }
    close(): void { this.readyState = 3; }
    terminate(): void { this.terminated = true; this.readyState = 3; }
  }
  return {
    WebSocketServer: class MockWSS {
      constructor(_opts: unknown) { /* noop */ }
      on(event: string, handler: (...args: unknown[]) => void): void {
        if (event === 'connection') {
          wssConnectionHandler = handler as typeof wssConnectionHandler;
        }
      }
      close(): void { /* noop */ }
    },
    WebSocket: InternalMockWebSocket,
  };
});

/* ------------------------------------------------------------------ */
/*  Import after mocks                                                 */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line import-x/first
import { CollaborationServer } from '../collaboration';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function createMockHttpServer(): EventEmitter {
  return new EventEmitter();
}

function setupDefaults(): void {
  mockValidateSession.mockResolvedValue({ userId: 1 });
  mockGetUserById.mockResolvedValue({ username: 'alice' });
  mockIsProjectOwner.mockResolvedValue(true);
  mockGetProject.mockResolvedValue({ id: 1, ownerId: 1 });
  mockGetProjectMembers.mockResolvedValue([]);
}

async function simulateJoin(
  projectId: number,
  sessionId: string,
  opts?: { userId?: number; username?: string; isOwner?: boolean },
): Promise<MockWebSocket> {
  const userId = opts?.userId ?? 1;
  const username = opts?.username ?? `user${String(userId)}`;
  const isOwner = opts?.isOwner ?? (userId === 1);

  mockValidateSession.mockResolvedValueOnce({ userId });
  mockGetUserById.mockResolvedValueOnce({ username });
  mockIsProjectOwner.mockResolvedValueOnce(isOwner);
  mockGetProject.mockResolvedValueOnce({ id: projectId, ownerId: isOwner ? userId : 999 });
  if (!isOwner) {
    mockGetProjectMembers.mockResolvedValueOnce([{ userId, role: 'editor', status: 'accepted' }]);
  }

  const ws = new MockWebSocket();
  const url = `/ws/collab?projectId=${String(projectId)}&sessionId=${sessionId}`;

  wssConnectionHandler?.(ws, { url, headers: { host: 'localhost:5000' } });

  // Wait for async auth to complete
  await vi.waitFor(() => {
    expect(ws.sent.length).toBeGreaterThanOrEqual(1);
  });

  return ws;
}

function parseSent(ws: MockWebSocket, index = -1): CollabMessage {
  const idx = index >= 0 ? index : ws.sent.length + index;
  return JSON.parse(ws.sent[idx]) as CollabMessage;
}

function sendMessage(ws: MockWebSocket, msg: CollabMessage): void {
  ws.emit('message', Buffer.from(JSON.stringify(msg)));
}

function makeMsg(type: CollabMessage['type'], payload: Record<string, unknown> = {}, userId = 1, projectId = 1): CollabMessage {
  return { type, userId, projectId, timestamp: Date.now(), payload };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('CollaborationServer', () => {
  let server: CollaborationServer;

  beforeEach(() => {
    vi.useFakeTimers();
    setupDefaults();
    const httpServer = createMockHttpServer();
    server = new CollaborationServer(httpServer as unknown as import('http').Server);
  });

  afterEach(() => {
    server.shutdown();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  /* ---------------------------------------------------------------- */
  /*  Room management                                                  */
  /* ---------------------------------------------------------------- */

  describe('room management', () => {
    it('should create a room on first join', async () => {
      await simulateJoin(1, 'session-a');
      expect(server.getRoomCount()).toBe(1);
      expect(server.getRoomUsers(1)).toHaveLength(1);
    });

    it('should allow multiple users in the same room', async () => {
      await simulateJoin(1, 'session-a', { userId: 1 });
      await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });
      expect(server.getRoomUsers(1)).toHaveLength(2);
    });

    it('should support multiple rooms', async () => {
      await simulateJoin(1, 'session-a', { userId: 1 });
      await simulateJoin(2, 'session-b', { userId: 2 });
      expect(server.getRoomCount()).toBe(2);
    });

    it('should remove user on disconnect and clean empty room', async () => {
      const ws = await simulateJoin(1, 'session-a');
      expect(server.getRoomUsers(1)).toHaveLength(1);

      ws.emit('close');
      expect(server.getRoomUsers(1)).toHaveLength(0);
      expect(server.getRoomCount()).toBe(0);
    });

    it('should broadcast leave on disconnect', async () => {
      const ws1 = await simulateJoin(1, 'session-a', { userId: 1 });
      const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

      const sentBefore = ws1.sent.length;
      ws2.emit('close');

      const leaveMsg = parseSent(ws1);
      expect(leaveMsg.type).toBe('leave');
      expect(leaveMsg.payload.userId).toBe(2);
    });

    it('should assign cursor colors round-robin', async () => {
      const ws1 = await simulateJoin(1, 'session-a', { userId: 1 });
      const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

      const users = server.getRoomUsers(1);
      expect(users[0].color).toBe(CURSOR_COLORS[0]);
      expect(users[1].color).toBe(CURSOR_COLORS[1]);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Authentication                                                   */
  /* ---------------------------------------------------------------- */

  describe('authentication', () => {
    it('should reject missing projectId', async () => {
      const ws = new MockWebSocket();
      wssConnectionHandler?.(ws, { url: '/ws/collab?sessionId=abc', headers: { host: 'localhost' } });
      await vi.advanceTimersByTimeAsync(10);
      expect(ws.readyState).toBe(MockWebSocket.CLOSED);
    });

    it('should reject missing sessionId', async () => {
      const ws = new MockWebSocket();
      wssConnectionHandler?.(ws, { url: '/ws/collab?projectId=1', headers: { host: 'localhost' } });
      await vi.advanceTimersByTimeAsync(10);
      expect(ws.readyState).toBe(MockWebSocket.CLOSED);
    });

    it('should reject invalid session', async () => {
      mockValidateSession.mockResolvedValueOnce(null);
      const ws = new MockWebSocket();
      wssConnectionHandler?.(ws, { url: '/ws/collab?projectId=1&sessionId=bad', headers: { host: 'localhost' } });
      await vi.advanceTimersByTimeAsync(10);
      expect(ws.readyState).toBe(MockWebSocket.CLOSED);
    });

    it('should assign owner role to project owner', async () => {
      await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
      expect(server.getRoomUsers(1)[0].role).toBe('owner');
    });

    it('should assign editor role to non-owner', async () => {
      await simulateJoin(1, 'session-a', { userId: 2, isOwner: false });
      expect(server.getRoomUsers(1)[0].role).toBe('editor');
    });
  });

  /* ---------------------------------------------------------------- */
  /*  State sync                                                       */
  /* ---------------------------------------------------------------- */

  describe('state sync', () => {
    it('should send state-sync to new user', async () => {
      const ws = await simulateJoin(1, 'session-a');
      const sync = parseSent(ws, 0);
      expect(sync.type).toBe('state-sync');
      expect(sync.payload).toHaveProperty('users');
      expect(sync.payload).toHaveProperty('version');
      expect(sync.payload).toHaveProperty('locks');
    });

    it('should broadcast join to existing users', async () => {
      const ws1 = await simulateJoin(1, 'session-a', { userId: 1 });
      const sentBefore = ws1.sent.length;

      await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

      // ws1 should have received a join message
      const joinMsg = parseSent(ws1);
      expect(joinMsg.type).toBe('join');
      expect((joinMsg.payload.user as { userId: number }).userId).toBe(2);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Cursor throttling                                                */
  /* ---------------------------------------------------------------- */

  describe('cursor throttling', () => {
    it('should forward cursor-move to other users', async () => {
      const ws1 = await simulateJoin(1, 'session-a', { userId: 1 });
      const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

      const sentBefore = ws1.sent.length;
      sendMessage(ws2, makeMsg('cursor-move', { x: 100, y: 200, view: 'pcb' }, 2));

      const cursorMsg = parseSent(ws1);
      expect(cursorMsg.type).toBe('cursor-move');
      expect(cursorMsg.payload.cursor).toEqual({ x: 100, y: 200, view: 'pcb' });
    });

    it('should throttle rapid cursor moves from same user', async () => {
      const ws1 = await simulateJoin(1, 'session-a', { userId: 1 });
      const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

      const sentBefore = ws1.sent.length;

      // Send two cursor moves within CURSOR_THROTTLE_MS
      sendMessage(ws2, makeMsg('cursor-move', { x: 10, y: 10, view: 'a' }, 2));
      sendMessage(ws2, makeMsg('cursor-move', { x: 20, y: 20, view: 'a' }, 2));

      // Only first should be forwarded (second within throttle window)
      const cursorMsgs = ws1.sent.slice(sentBefore).map((s) => JSON.parse(s) as CollabMessage).filter((m) => m.type === 'cursor-move');
      expect(cursorMsgs).toHaveLength(1);
    });

    it('should allow cursor move after throttle interval', async () => {
      const ws1 = await simulateJoin(1, 'session-a', { userId: 1 });
      const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

      const sentBefore = ws1.sent.length;
      sendMessage(ws2, makeMsg('cursor-move', { x: 10, y: 10, view: 'a' }, 2));
      vi.advanceTimersByTime(CURSOR_THROTTLE_MS + 1);
      sendMessage(ws2, makeMsg('cursor-move', { x: 20, y: 20, view: 'a' }, 2));

      const cursorMsgs = ws1.sent.slice(sentBefore).map((s) => JSON.parse(s) as CollabMessage).filter((m) => m.type === 'cursor-move');
      expect(cursorMsgs).toHaveLength(2);
    });

    it('should not echo cursor back to sender', async () => {
      const ws1 = await simulateJoin(1, 'session-a', { userId: 1 });
      await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

      const sentBefore = ws1.sent.length;
      sendMessage(ws1, makeMsg('cursor-move', { x: 10, y: 10, view: 'a' }, 1));

      const newMsgs = ws1.sent.slice(sentBefore);
      expect(newMsgs).toHaveLength(0);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Selection                                                        */
  /* ---------------------------------------------------------------- */

  describe('selection', () => {
    it('should broadcast selection change', async () => {
      const ws1 = await simulateJoin(1, 'session-a', { userId: 1 });
      const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

      const sentBefore = ws1.sent.length;
      sendMessage(ws2, makeMsg('selection-change', { type: 'node', ids: ['n1', 'n2'] }, 2));

      const selMsg = parseSent(ws1);
      expect(selMsg.type).toBe('selection-change');
      expect(selMsg.payload.selection).toEqual({ type: 'node', ids: ['n1', 'n2'] });
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Locking                                                          */
  /* ---------------------------------------------------------------- */

  describe('locking', () => {
    it('should grant lock to first requester', async () => {
      const ws = await simulateJoin(1, 'session-a', { userId: 1 });

      sendMessage(ws, makeMsg('lock-request', { entityType: 'node', entityId: 'n1', userId: 1, timeout: 30000 }, 1));
      const granted = parseSent(ws);
      expect(granted.type).toBe('lock-granted');
      expect(granted.payload.entityKey).toBe('1:node:n1');
    });

    it('should deny lock if held by another user', async () => {
      const ws1 = await simulateJoin(1, 'session-a', { userId: 1 });
      const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

      sendMessage(ws1, makeMsg('lock-request', { entityType: 'node', entityId: 'n1', userId: 1, timeout: 30000 }, 1));
      sendMessage(ws2, makeMsg('lock-request', { entityType: 'node', entityId: 'n1', userId: 2, timeout: 30000 }, 2));

      const denied = parseSent(ws2);
      expect(denied.type).toBe('lock-denied');
      expect(denied.payload.heldBy).toBe(1);
    });

    it('should allow same user to re-acquire own lock', async () => {
      const ws = await simulateJoin(1, 'session-a', { userId: 1 });

      sendMessage(ws, makeMsg('lock-request', { entityType: 'node', entityId: 'n1', userId: 1, timeout: 30000 }, 1));
      sendMessage(ws, makeMsg('lock-request', { entityType: 'node', entityId: 'n1', userId: 1, timeout: 30000 }, 1));

      // Both should be granted
      const msgs = ws.sent.map((s) => JSON.parse(s) as CollabMessage).filter((m) => m.type === 'lock-granted');
      expect(msgs.length).toBeGreaterThanOrEqual(2);
    });

    it('should release lock on user request', async () => {
      const ws1 = await simulateJoin(1, 'session-a', { userId: 1 });
      const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

      sendMessage(ws1, makeMsg('lock-request', { entityType: 'node', entityId: 'n1', userId: 1, timeout: 30000 }, 1));
      sendMessage(ws1, makeMsg('lock-released', { entityKey: '1:node:n1' }, 1));

      const released = ws2.sent.map((s) => JSON.parse(s) as CollabMessage).filter((m) => m.type === 'lock-released');
      expect(released.length).toBeGreaterThanOrEqual(1);
    });

    it('should not release lock held by another user', async () => {
      const ws1 = await simulateJoin(1, 'session-a', { userId: 1 });
      const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

      sendMessage(ws1, makeMsg('lock-request', { entityType: 'node', entityId: 'n1', userId: 1, timeout: 30000 }, 1));

      // User 2 tries to release user 1's lock
      sendMessage(ws2, makeMsg('lock-released', { entityKey: '1:node:n1' }, 2));

      // Lock should still exist
      const locks = server.getLocks();
      expect(locks.has('1:node:n1')).toBe(true);
    });

    it('should release locks on user disconnect', async () => {
      const ws1 = await simulateJoin(1, 'session-a', { userId: 1 });
      const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

      sendMessage(ws1, makeMsg('lock-request', { entityType: 'node', entityId: 'n1', userId: 1, timeout: 30000 }, 1));
      ws1.emit('close');

      const locks = server.getLocks();
      expect(locks.has('1:node:n1')).toBe(false);
    });

    it('should auto-expire locks after timeout', async () => {
      const ws = await simulateJoin(1, 'session-a', { userId: 1 });

      sendMessage(ws, makeMsg('lock-request', { entityType: 'node', entityId: 'n1', userId: 1, timeout: 5000 }, 1));
      expect(server.getLocks().has('1:node:n1')).toBe(true);

      vi.advanceTimersByTime(11_000); // Past lock timeout (5s) + cleanup interval (5s) + buffer
      expect(server.getLocks().has('1:node:n1')).toBe(false);
    });

    it('should cap lock timeout at DEFAULT_LOCK_TIMEOUT_MS', async () => {
      const ws = await simulateJoin(1, 'session-a', { userId: 1 });

      sendMessage(ws, makeMsg('lock-request', { entityType: 'node', entityId: 'n1', userId: 1, timeout: 999999 }, 1));

      const lock = server.getLocks().get('1:node:n1');
      expect(lock).toBeDefined();
      // Timeout should be capped
      const maxExpiry = Date.now() + DEFAULT_LOCK_TIMEOUT_MS + 1000; // small buffer
      expect(lock!.expiresAt).toBeLessThanOrEqual(maxExpiry);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Role enforcement                                                 */
  /* ---------------------------------------------------------------- */

  describe('role enforcement', () => {
    it('should allow viewer to send cursor-move', async () => {
      const ws1 = await simulateJoin(1, 'session-a', { userId: 1 });

      // Join as viewer via setUserRole
      const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });
      server.setUserRole(1, 2, 'viewer');

      const sentBefore = ws1.sent.length;
      sendMessage(ws2, makeMsg('cursor-move', { x: 10, y: 10, view: 'a' }, 2));

      const newMsgs = ws1.sent.slice(sentBefore).map((s) => JSON.parse(s) as CollabMessage).filter((m) => m.type === 'cursor-move');
      expect(newMsgs.length).toBeGreaterThanOrEqual(1);
    });

    it('should block viewer from sending state-update', async () => {
      await simulateJoin(1, 'session-a', { userId: 1 });
      const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });
      server.setUserRole(1, 2, 'viewer');

      sendMessage(ws2, makeMsg('state-update', { operations: [{ op: 'insert', path: [], value: {} }] }, 2));

      const errorMsgs = ws2.sent.map((s) => JSON.parse(s) as CollabMessage).filter((m) => m.type === 'error');
      expect(errorMsgs.length).toBeGreaterThanOrEqual(1);
    });

    it('should block viewer from sending lock-request', async () => {
      await simulateJoin(1, 'session-a', { userId: 1 });
      const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });
      server.setUserRole(1, 2, 'viewer');

      sendMessage(ws2, makeMsg('lock-request', { entityType: 'node', entityId: 'n1', userId: 2, timeout: 30000 }, 2));

      const errorMsgs = ws2.sent.map((s) => JSON.parse(s) as CollabMessage).filter((m) => m.type === 'error');
      expect(errorMsgs.length).toBeGreaterThanOrEqual(1);
    });

    it('should only allow owner to change roles', async () => {
      const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
      const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

      // Non-owner tries to change role
      sendMessage(ws2, makeMsg('role-change', { targetUserId: 1, role: 'viewer' }, 2));
      const errors = ws2.sent.map((s) => JSON.parse(s) as CollabMessage).filter((m) => m.type === 'error');
      expect(errors.length).toBeGreaterThanOrEqual(1);
    });

    it('should allow owner to change another user role', async () => {
      const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
      const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

      sendMessage(ws1, makeMsg('role-change', { targetUserId: 2, role: 'viewer' }, 1));

      const users = server.getRoomUsers(1);
      const user2 = users.find((u) => u.userId === 2);
      expect(user2?.role).toBe('viewer');
    });
  });

  /* ---------------------------------------------------------------- */
  /*  State updates                                                    */
  /* ---------------------------------------------------------------- */

  describe('state updates', () => {
    it('should broadcast state-update to other users', async () => {
      const ws1 = await simulateJoin(1, 'session-a', { userId: 1 });
      const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

      const sentBefore = ws1.sent.length;
      const ops = [{ op: 'insert' as const, path: ['nodes'], value: { id: 'x' } }];
      sendMessage(ws2, makeMsg('state-update', { operations: ops }, 2));

      const updateMsg = parseSent(ws1);
      expect(updateMsg.type).toBe('state-update');
      // CRDT merge enriches ops with timestamp + clientId metadata
      const receivedOps = updateMsg.payload.operations as Array<Record<string, unknown>>;
      expect(receivedOps).toHaveLength(1);
      expect(receivedOps[0]).toMatchObject({ op: 'insert', path: ['nodes'], value: { id: 'x' } });
      expect(receivedOps[0]).toHaveProperty('timestamp');
      expect(receivedOps[0]).toHaveProperty('clientId', 2);
      expect(updateMsg.payload.version).toBe(1);
    });

    it('should increment version on each state update', async () => {
      const ws1 = await simulateJoin(1, 'session-a', { userId: 1 });
      const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

      sendMessage(ws2, makeMsg('state-update', { operations: [{ op: 'insert', path: [], value: 1 }] }, 2));
      sendMessage(ws2, makeMsg('state-update', { operations: [{ op: 'insert', path: [], value: 2 }] }, 2));

      const updates = ws1.sent.map((s) => JSON.parse(s) as CollabMessage).filter((m) => m.type === 'state-update');
      expect(updates[0].payload.version).toBe(1);
      expect(updates[1].payload.version).toBe(2);
    });

    it('should not echo state-update back to sender', async () => {
      const ws1 = await simulateJoin(1, 'session-a', { userId: 1 });
      await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

      const sentBefore = ws1.sent.length;
      sendMessage(ws1, makeMsg('state-update', { operations: [{ op: 'insert', path: [], value: 1 }] }, 1));

      const newMsgs = ws1.sent.slice(sentBefore).filter((s) => (JSON.parse(s) as CollabMessage).type === 'state-update');
      expect(newMsgs).toHaveLength(0);
    });

    it('should reject empty operations array', async () => {
      const ws1 = await simulateJoin(1, 'session-a', { userId: 1 });
      const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

      const sentBefore = ws1.sent.length;
      sendMessage(ws2, makeMsg('state-update', { operations: [] }, 2));

      const newMsgs = ws1.sent.slice(sentBefore).filter((s) => (JSON.parse(s) as CollabMessage).type === 'state-update');
      expect(newMsgs).toHaveLength(0);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Heartbeat                                                        */
  /* ---------------------------------------------------------------- */

  describe('heartbeat', () => {
    it('should ping connected clients', async () => {
      const ws = await simulateJoin(1, 'session-a');
      ws.pinged = false;

      vi.advanceTimersByTime(30_001);
      expect(ws.pinged).toBe(true);
    });

    it('should terminate client that does not respond to ping', async () => {
      const ws = await simulateJoin(1, 'session-a');

      // First heartbeat — marks alive=false, sends ping
      vi.advanceTimersByTime(30_001);
      // Don't emit pong — client is unresponsive

      // Second heartbeat — alive is still false, should terminate
      vi.advanceTimersByTime(30_000);
      expect(ws.terminated).toBe(true);
    });

    it('should keep alive client that responds to pong', async () => {
      const ws = await simulateJoin(1, 'session-a');

      vi.advanceTimersByTime(30_001);
      ws.emit('pong');

      vi.advanceTimersByTime(30_000);
      expect(ws.terminated).toBe(false);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Message validation                                               */
  /* ---------------------------------------------------------------- */

  describe('message validation', () => {
    it('should ignore invalid JSON', async () => {
      const ws = await simulateJoin(1, 'session-a');
      const sentBefore = ws.sent.length;

      ws.emit('message', Buffer.from('not json'));
      const errors = ws.sent.slice(sentBefore).filter((s) => (JSON.parse(s) as CollabMessage).type === 'error');
      expect(errors).toHaveLength(1);
    });

    it('should ignore messages with missing fields', async () => {
      const ws = await simulateJoin(1, 'session-a');
      const sentBefore = ws.sent.length;

      ws.emit('message', Buffer.from(JSON.stringify({ type: 'cursor-move' })));
      const errors = ws.sent.slice(sentBefore).filter((s) => (JSON.parse(s) as CollabMessage).type === 'error');
      expect(errors).toHaveLength(1);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Chat broadcast                                                   */
  /* ---------------------------------------------------------------- */

  describe('chat', () => {
    it('should broadcast chat messages to entire room', async () => {
      const ws1 = await simulateJoin(1, 'session-a', { userId: 1 });
      const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

      sendMessage(ws1, makeMsg('chat', { text: 'hello' }, 1));

      // Chat should be sent to ws2 (and ws1 too, since chat broadcasts to all)
      const chatMsgs = ws2.sent.map((s) => JSON.parse(s) as CollabMessage).filter((m) => m.type === 'chat');
      expect(chatMsgs).toHaveLength(1);
      expect(chatMsgs[0].payload.text).toBe('hello');
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Awareness                                                        */
  /* ---------------------------------------------------------------- */

  describe('awareness', () => {
    it('should broadcast awareness to others (not sender)', async () => {
      const ws1 = await simulateJoin(1, 'session-a', { userId: 1 });
      const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

      const sentBefore1 = ws1.sent.length;
      const sentBefore2 = ws2.sent.length;
      sendMessage(ws2, makeMsg('awareness', { typing: true }, 2));

      const awareness1 = ws1.sent.slice(sentBefore1).map((s) => JSON.parse(s) as CollabMessage).filter((m) => m.type === 'awareness');
      const awareness2 = ws2.sent.slice(sentBefore2).map((s) => JSON.parse(s) as CollabMessage).filter((m) => m.type === 'awareness');

      expect(awareness1).toHaveLength(1);
      expect(awareness2).toHaveLength(0); // not echoed
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Shutdown                                                         */
  /* ---------------------------------------------------------------- */

  describe('shutdown', () => {
    it('should close all connections and clear state', async () => {
      const ws1 = await simulateJoin(1, 'session-a', { userId: 1 });
      const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

      server.shutdown();
      expect(ws1.readyState).toBe(MockWebSocket.CLOSED);
      expect(ws2.readyState).toBe(MockWebSocket.CLOSED);
      expect(server.getRoomCount()).toBe(0);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Shared utilities                                                 */
  /* ---------------------------------------------------------------- */

  describe('shared utilities', () => {
    it('lockKey should join entity type and id', () => {
      expect(lockKey(1, 'node', 'abc')).toBe('1:node:abc');
    });

    it('isValidCollabMessage should validate required fields', () => {
      expect(isValidCollabMessage({ type: 'join', userId: 1, projectId: 1, timestamp: 1, payload: {} })).toBe(true);
      expect(isValidCollabMessage(null)).toBe(false);
      expect(isValidCollabMessage({ type: 'join' })).toBe(false);
      expect(isValidCollabMessage('string')).toBe(false);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  setUserRole public API                                           */
  /* ---------------------------------------------------------------- */

  describe('setUserRole', () => {
    it('should change role and broadcast', async () => {
      const ws1 = await simulateJoin(1, 'session-a', { userId: 1 });
      const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

      server.setUserRole(1, 2, 'viewer');

      const users = server.getRoomUsers(1);
      const u2 = users.find((u) => u.userId === 2);
      expect(u2?.role).toBe('viewer');

      // Both should receive role-change broadcast
      const roleChanges1 = ws1.sent.map((s) => JSON.parse(s) as CollabMessage).filter((m) => m.type === 'role-change');
      const roleChanges2 = ws2.sent.map((s) => JSON.parse(s) as CollabMessage).filter((m) => m.type === 'role-change');
      expect(roleChanges1.length + roleChanges2.length).toBeGreaterThanOrEqual(1);
    });

    it('should do nothing for non-existent user', () => {
      expect(() => { server.setUserRole(1, 999, 'editor'); }).not.toThrow();
    });
  });
});
