/**
 * Collaboration Auth Tests (Wave F — Task F2)
 *
 * Tests WebSocket collaboration system's authentication and authorization:
 * - Auth handshake: no/invalid/valid session scenarios
 * - Role assignment and enforcement (owner/editor/viewer)
 * - Lock contention and timeout behavior
 * - Room isolation between projects
 * - Reconnection role persistence
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import type { CollabMessage, CollabRole } from '@shared/collaboration';
import {
  DEFAULT_LOCK_TIMEOUT_MS,
  lockKey,
} from '@shared/collaboration';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockValidateSession = vi.fn<(sessionId: string) => Promise<{ userId: number } | null>>();
const mockGetUserById = vi.fn<(id: number) => Promise<{ username: string } | null>>();
const mockIsProjectOwner = vi.fn<(projectId: number, userId: number) => Promise<boolean>>();

vi.mock('../auth', () => ({
  validateSession: (...args: unknown[]) => mockValidateSession(args[0] as string),
  getUserById: (...args: unknown[]) => mockGetUserById(args[0] as number),
}));

vi.mock('../storage', () => ({
  storage: {
    isProjectOwner: (...args: unknown[]) => mockIsProjectOwner(args[0] as number, args[1] as number),
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

  const ws = new MockWebSocket();
  const url = `/ws/collab?projectId=${String(projectId)}&sessionId=${sessionId}`;

  wssConnectionHandler?.(ws, { url, headers: { host: 'localhost:5000' } });

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

function getMessagesByType(ws: MockWebSocket, type: CollabMessage['type'], afterIndex = 0): CollabMessage[] {
  return ws.sent.slice(afterIndex).map((s) => JSON.parse(s) as CollabMessage).filter((m) => m.type === type);
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('Collaboration Auth — Handshake', () => {
  let server: CollaborationServer;

  beforeEach(() => {
    vi.useFakeTimers();
    mockValidateSession.mockResolvedValue({ userId: 1 });
    mockGetUserById.mockResolvedValue({ username: 'alice' });
    mockIsProjectOwner.mockResolvedValue(true);
    const httpServer = createMockHttpServer();
    server = new CollaborationServer(httpServer as unknown as import('http').Server);
  });

  afterEach(() => {
    server.shutdown();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  /* ---------------------------------------------------------------- */
  /*  No session → connection rejected                                 */
  /* ---------------------------------------------------------------- */

  describe('no session', () => {
    it('should reject connection with no sessionId and send error message', async () => {
      const ws = new MockWebSocket();
      wssConnectionHandler?.(ws, { url: '/ws/collab?projectId=1', headers: { host: 'localhost' } });
      await vi.advanceTimersByTimeAsync(10);

      expect(ws.readyState).toBe(MockWebSocket.CLOSED);
      // Should have sent an error message before closing
      const errorMsgs = ws.sent.map((s) => JSON.parse(s) as CollabMessage).filter((m) => m.type === 'error');
      expect(errorMsgs.length).toBeGreaterThanOrEqual(1);
      expect(errorMsgs[0].payload.error).toContain('Missing');
    });

    it('should reject connection with no projectId and send error message', async () => {
      const ws = new MockWebSocket();
      wssConnectionHandler?.(ws, { url: '/ws/collab?sessionId=abc', headers: { host: 'localhost' } });
      await vi.advanceTimersByTimeAsync(10);

      expect(ws.readyState).toBe(MockWebSocket.CLOSED);
      const errorMsgs = ws.sent.map((s) => JSON.parse(s) as CollabMessage).filter((m) => m.type === 'error');
      expect(errorMsgs.length).toBeGreaterThanOrEqual(1);
    });

    it('should reject connection with no query params at all', async () => {
      const ws = new MockWebSocket();
      wssConnectionHandler?.(ws, { url: '/ws/collab', headers: { host: 'localhost' } });
      await vi.advanceTimersByTimeAsync(10);

      expect(ws.readyState).toBe(MockWebSocket.CLOSED);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Invalid session → connection rejected                            */
  /* ---------------------------------------------------------------- */

  describe('invalid session', () => {
    it('should reject when validateSession returns null', async () => {
      mockValidateSession.mockResolvedValueOnce(null);
      const ws = new MockWebSocket();
      wssConnectionHandler?.(ws, {
        url: '/ws/collab?projectId=1&sessionId=invalid-session',
        headers: { host: 'localhost' },
      });
      await vi.advanceTimersByTimeAsync(10);

      expect(ws.readyState).toBe(MockWebSocket.CLOSED);
      const errorMsgs = ws.sent.map((s) => JSON.parse(s) as CollabMessage).filter((m) => m.type === 'error');
      expect(errorMsgs.length).toBeGreaterThanOrEqual(1);
      expect(errorMsgs[0].payload.error).toContain('session');
    });

    it('should not create a room for invalid session', async () => {
      mockValidateSession.mockResolvedValueOnce(null);
      const ws = new MockWebSocket();
      wssConnectionHandler?.(ws, {
        url: '/ws/collab?projectId=42&sessionId=bad',
        headers: { host: 'localhost' },
      });
      await vi.advanceTimersByTimeAsync(10);

      expect(server.getRoomCount()).toBe(0);
      expect(server.getRoomUsers(42)).toHaveLength(0);
    });

    it('should reject connection with invalid projectId (non-numeric)', async () => {
      const ws = new MockWebSocket();
      wssConnectionHandler?.(ws, {
        url: '/ws/collab?projectId=abc&sessionId=valid',
        headers: { host: 'localhost' },
      });
      await vi.advanceTimersByTimeAsync(10);

      expect(ws.readyState).toBe(MockWebSocket.CLOSED);
    });

    it('should reject connection with projectId <= 0', async () => {
      const ws = new MockWebSocket();
      wssConnectionHandler?.(ws, {
        url: '/ws/collab?projectId=0&sessionId=valid',
        headers: { host: 'localhost' },
      });
      await vi.advanceTimersByTimeAsync(10);

      expect(ws.readyState).toBe(MockWebSocket.CLOSED);
    });

    it('should reject connection with negative projectId', async () => {
      const ws = new MockWebSocket();
      wssConnectionHandler?.(ws, {
        url: '/ws/collab?projectId=-1&sessionId=valid',
        headers: { host: 'localhost' },
      });
      await vi.advanceTimersByTimeAsync(10);

      expect(ws.readyState).toBe(MockWebSocket.CLOSED);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Valid session → correct role assignment                          */
  /* ---------------------------------------------------------------- */

  describe('valid session', () => {
    it('should accept connection and send state-sync as first message', async () => {
      const ws = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
      const firstMsg = parseSent(ws, 0);
      expect(firstMsg.type).toBe('state-sync');
      expect(firstMsg.payload).toHaveProperty('users');
      expect(firstMsg.payload).toHaveProperty('version');
      expect(firstMsg.payload).toHaveProperty('locks');
    });

    it('should assign owner role to project owner', async () => {
      await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
      const users = server.getRoomUsers(1);
      expect(users).toHaveLength(1);
      expect(users[0].role).toBe('owner');
      expect(users[0].userId).toBe(1);
    });

    it('should assign editor role to non-owner', async () => {
      await simulateJoin(1, 'session-a', { userId: 2, isOwner: false });
      const users = server.getRoomUsers(1);
      expect(users).toHaveLength(1);
      expect(users[0].role).toBe('editor');
    });

    it('should include username from getUserById', async () => {
      await simulateJoin(1, 'session-a', { userId: 3, username: 'bob', isOwner: false });
      const users = server.getRoomUsers(1);
      expect(users[0].username).toBe('bob');
    });

    it('should create a room for the project', async () => {
      await simulateJoin(5, 'session-a', { userId: 1, isOwner: true });
      expect(server.getRoomCount()).toBe(1);
      expect(server.getRoomUsers(5)).toHaveLength(1);
    });
  });
});

/* ------------------------------------------------------------------ */
/*  Role Enforcement                                                   */
/* ------------------------------------------------------------------ */

describe('Collaboration Auth — Role Enforcement', () => {
  let server: CollaborationServer;

  beforeEach(() => {
    vi.useFakeTimers();
    mockValidateSession.mockResolvedValue({ userId: 1 });
    mockGetUserById.mockResolvedValue({ username: 'alice' });
    mockIsProjectOwner.mockResolvedValue(true);
    const httpServer = createMockHttpServer();
    server = new CollaborationServer(httpServer as unknown as import('http').Server);
  });

  afterEach(() => {
    server.shutdown();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('viewer restrictions', () => {
    it('should allow viewer to send cursor-move', async () => {
      const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
      const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });
      server.setUserRole(1, 2, 'viewer');

      const sentBefore = ws1.sent.length;
      sendMessage(ws2, makeMsg('cursor-move', { x: 50, y: 60, view: 'schematic' }, 2));

      const cursors = getMessagesByType(ws1, 'cursor-move', sentBefore);
      expect(cursors).toHaveLength(1);
    });

    it('should allow viewer to send selection-change', async () => {
      const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
      const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });
      server.setUserRole(1, 2, 'viewer');

      const sentBefore = ws1.sent.length;
      sendMessage(ws2, makeMsg('selection-change', { type: 'node', ids: ['n1'] }, 2));

      const selections = getMessagesByType(ws1, 'selection-change', sentBefore);
      expect(selections).toHaveLength(1);
    });

    it('should allow viewer to send awareness', async () => {
      const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
      const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });
      server.setUserRole(1, 2, 'viewer');

      const sentBefore = ws1.sent.length;
      sendMessage(ws2, makeMsg('awareness', { typing: true }, 2));

      const awarenessMsgs = getMessagesByType(ws1, 'awareness', sentBefore);
      expect(awarenessMsgs).toHaveLength(1);
    });

    it('should block viewer from sending state-update', async () => {
      await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
      const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });
      server.setUserRole(1, 2, 'viewer');

      const sentBefore = ws2.sent.length;
      sendMessage(ws2, makeMsg('state-update', { operations: [{ op: 'insert', path: [], value: {} }] }, 2));

      const errors = getMessagesByType(ws2, 'error', sentBefore);
      expect(errors).toHaveLength(1);
      expect(errors[0].payload.error).toContain('Viewer');
    });

    it('should block viewer from sending lock-request', async () => {
      await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
      const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });
      server.setUserRole(1, 2, 'viewer');

      const sentBefore = ws2.sent.length;
      sendMessage(ws2, makeMsg('lock-request', { entityType: 'node', entityId: 'n1', userId: 2, timeout: 5000 }, 2));

      const errors = getMessagesByType(ws2, 'error', sentBefore);
      expect(errors).toHaveLength(1);
    });

    it('should block viewer from sending chat messages', async () => {
      await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
      const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });
      server.setUserRole(1, 2, 'viewer');

      const sentBefore = ws2.sent.length;
      sendMessage(ws2, makeMsg('chat', { text: 'hello' }, 2));

      const errors = getMessagesByType(ws2, 'error', sentBefore);
      expect(errors).toHaveLength(1);
    });

    it('should block viewer from sending role-change', async () => {
      await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
      const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });
      server.setUserRole(1, 2, 'viewer');

      const sentBefore = ws2.sent.length;
      sendMessage(ws2, makeMsg('role-change', { targetUserId: 1, role: 'editor' }, 2));

      const errors = getMessagesByType(ws2, 'error', sentBefore);
      expect(errors).toHaveLength(1);
    });
  });

  describe('editor restrictions', () => {
    it('should allow editor to send state-update', async () => {
      const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
      const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });
      // editors are the default for non-owners — no setUserRole needed

      const sentBefore = ws1.sent.length;
      sendMessage(ws2, makeMsg('state-update', { operations: [{ op: 'insert', path: ['nodes'], value: { id: 'x' } }] }, 2));

      const updates = getMessagesByType(ws1, 'state-update', sentBefore);
      expect(updates).toHaveLength(1);
    });

    it('should allow editor to request locks', async () => {
      await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
      const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

      sendMessage(ws2, makeMsg('lock-request', { entityType: 'node', entityId: 'n1', userId: 2, timeout: 5000 }, 2));

      const granted = getMessagesByType(ws2, 'lock-granted');
      expect(granted.length).toBeGreaterThanOrEqual(1);
    });

    it('should block editor from changing roles', async () => {
      await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
      const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });
      await simulateJoin(1, 'session-c', { userId: 3, isOwner: false });

      const sentBefore = ws2.sent.length;
      sendMessage(ws2, makeMsg('role-change', { targetUserId: 3, role: 'viewer' }, 2));

      const errors = getMessagesByType(ws2, 'error', sentBefore);
      expect(errors).toHaveLength(1);
      expect(errors[0].payload.error).toContain('owner');
    });
  });

  describe('owner permissions', () => {
    it('should allow owner to change another user role to viewer', async () => {
      const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
      await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

      sendMessage(ws1, makeMsg('role-change', { targetUserId: 2, role: 'viewer' }, 1));

      const users = server.getRoomUsers(1);
      const user2 = users.find((u) => u.userId === 2);
      expect(user2?.role).toBe('viewer');
    });

    it('should allow owner to change another user role to editor', async () => {
      const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
      await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

      // First set to viewer
      server.setUserRole(1, 2, 'viewer');
      expect(server.getRoomUsers(1).find((u) => u.userId === 2)?.role).toBe('viewer');

      // Then owner changes back to editor
      sendMessage(ws1, makeMsg('role-change', { targetUserId: 2, role: 'editor' }, 1));

      const users = server.getRoomUsers(1);
      const user2 = users.find((u) => u.userId === 2);
      expect(user2?.role).toBe('editor');
    });

    it('should broadcast role-change to all room members', async () => {
      const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
      const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

      const sentBefore1 = ws1.sent.length;
      const sentBefore2 = ws2.sent.length;
      sendMessage(ws1, makeMsg('role-change', { targetUserId: 2, role: 'viewer' }, 1));

      const roleChanges1 = getMessagesByType(ws1, 'role-change', sentBefore1);
      const roleChanges2 = getMessagesByType(ws2, 'role-change', sentBefore2);
      expect(roleChanges1.length + roleChanges2.length).toBeGreaterThanOrEqual(1);
    });

    it('should reject invalid role value', async () => {
      const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
      await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

      const sentBefore = ws1.sent.length;
      sendMessage(ws1, makeMsg('role-change', { targetUserId: 2, role: 'superadmin' }, 1));

      const errors = getMessagesByType(ws1, 'error', sentBefore);
      expect(errors).toHaveLength(1);
      expect(errors[0].payload.error).toContain('Invalid role');
    });

    it('should reject role change for user not in room', async () => {
      const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });

      const sentBefore = ws1.sent.length;
      sendMessage(ws1, makeMsg('role-change', { targetUserId: 999, role: 'viewer' }, 1));

      const errors = getMessagesByType(ws1, 'error', sentBefore);
      expect(errors).toHaveLength(1);
      expect(errors[0].payload.error).toContain('not in room');
    });
  });
});

/* ------------------------------------------------------------------ */
/*  Lock Enforcement                                                   */
/* ------------------------------------------------------------------ */

describe('Collaboration Auth — Lock Enforcement', () => {
  let server: CollaborationServer;

  beforeEach(() => {
    vi.useFakeTimers();
    mockValidateSession.mockResolvedValue({ userId: 1 });
    mockGetUserById.mockResolvedValue({ username: 'alice' });
    mockIsProjectOwner.mockResolvedValue(true);
    const httpServer = createMockHttpServer();
    server = new CollaborationServer(httpServer as unknown as import('http').Server);
  });

  afterEach(() => {
    server.shutdown();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should grant lock to user A', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });

    sendMessage(ws1, makeMsg('lock-request', { entityType: 'node', entityId: 'n1', userId: 1, timeout: 10000 }, 1));

    const granted = getMessagesByType(ws1, 'lock-granted');
    expect(granted.length).toBeGreaterThanOrEqual(1);
    expect(granted[0].payload.entityKey).toBe(lockKey(1, 'node', 'n1'));
  });

  it('should reject user B lock when user A holds the lock', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

    // User 1 acquires lock
    sendMessage(ws1, makeMsg('lock-request', { entityType: 'node', entityId: 'n1', userId: 1, timeout: 30000 }, 1));

    // User 2 tries to acquire same lock
    sendMessage(ws2, makeMsg('lock-request', { entityType: 'node', entityId: 'n1', userId: 2, timeout: 30000 }, 2));

    const denied = getMessagesByType(ws2, 'lock-denied');
    expect(denied).toHaveLength(1);
    expect(denied[0].payload.heldBy).toBe(1);
    expect(denied[0].payload.entityKey).toBe(lockKey(1, 'node', 'n1'));
  });

  it('should allow user B to lock a different entity than user A', async () => {
    await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

    // User 1 locks node n1
    const ws1 = server.getRoom(1)!;
    const entry1 = ws1.get(1)!;
    sendMessage(entry1.ws as unknown as MockWebSocket, makeMsg('lock-request', { entityType: 'node', entityId: 'n1', userId: 1, timeout: 30000 }, 1));

    // User 2 locks a different node
    sendMessage(ws2, makeMsg('lock-request', { entityType: 'node', entityId: 'n2', userId: 2, timeout: 30000 }, 2));

    const granted = getMessagesByType(ws2, 'lock-granted');
    expect(granted.length).toBeGreaterThanOrEqual(1);
  });

  it('should expire locks after DEFAULT_LOCK_TIMEOUT_MS', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });

    // Request lock with default timeout
    sendMessage(ws1, makeMsg('lock-request', { entityType: 'edge', entityId: 'e1', userId: 1, timeout: DEFAULT_LOCK_TIMEOUT_MS }, 1));

    const key = lockKey(1, 'edge', 'e1');
    expect(server.getLocks().has(key)).toBe(true);

    // Advance past lock timeout + cleanup interval (5s)
    vi.advanceTimersByTime(DEFAULT_LOCK_TIMEOUT_MS + 6000);

    expect(server.getLocks().has(key)).toBe(false);
  });

  it('should allow user B to acquire lock after user A lock expires', async () => {
    await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

    // User 1 gets a short lock
    const ws1Mock = server.getRoom(1)!.get(1)!.ws;
    sendMessage(ws1Mock as unknown as MockWebSocket, makeMsg('lock-request', { entityType: 'node', entityId: 'n1', userId: 1, timeout: 5000 }, 1));

    // Advance past lock timeout + cleanup
    vi.advanceTimersByTime(11000);

    // User 2 should now be able to acquire
    sendMessage(ws2, makeMsg('lock-request', { entityType: 'node', entityId: 'n1', userId: 2, timeout: 5000 }, 2));

    const granted = getMessagesByType(ws2, 'lock-granted');
    const grantedForN1 = granted.filter((m) => m.payload.entityKey === lockKey(1, 'node', 'n1'));
    expect(grantedForN1.length).toBeGreaterThanOrEqual(1);
  });

  it('should release all locks when user disconnects', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

    // User 1 acquires two locks
    sendMessage(ws1, makeMsg('lock-request', { entityType: 'node', entityId: 'n1', userId: 1, timeout: 30000 }, 1));
    sendMessage(ws1, makeMsg('lock-request', { entityType: 'edge', entityId: 'e1', userId: 1, timeout: 30000 }, 1));

    expect(server.getLocks().size).toBe(2);

    // User 1 disconnects
    ws1.emit('close');

    expect(server.getLocks().size).toBe(0);
  });

  it('should not allow a user to release another user lock', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

    // User 1 acquires lock
    sendMessage(ws1, makeMsg('lock-request', { entityType: 'node', entityId: 'n1', userId: 1, timeout: 30000 }, 1));
    const key = lockKey(1, 'node', 'n1');
    expect(server.getLocks().has(key)).toBe(true);

    // User 2 tries to release
    sendMessage(ws2, makeMsg('lock-released', { entityKey: key }, 2));

    // Lock should still be held by user 1
    expect(server.getLocks().has(key)).toBe(true);
    expect(server.getLocks().get(key)!.userId).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/*  Room Isolation                                                     */
/* ------------------------------------------------------------------ */

describe('Collaboration Auth — Room Isolation', () => {
  let server: CollaborationServer;

  beforeEach(() => {
    vi.useFakeTimers();
    mockValidateSession.mockResolvedValue({ userId: 1 });
    mockGetUserById.mockResolvedValue({ username: 'alice' });
    mockIsProjectOwner.mockResolvedValue(true);
    const httpServer = createMockHttpServer();
    server = new CollaborationServer(httpServer as unknown as import('http').Server);
  });

  afterEach(() => {
    server.shutdown();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should not leak messages from project 1 to project 2', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(2, 'session-b', { userId: 2, isOwner: true });

    const sentBefore2 = ws2.sent.length;

    // User 1 sends a state-update in project 1
    sendMessage(ws1, makeMsg('state-update', { operations: [{ op: 'insert', path: ['nodes'], value: { id: 'secret' } }] }, 1, 1));

    // User 2 in project 2 should not receive it
    const newMsgs = ws2.sent.slice(sentBefore2).map((s) => JSON.parse(s) as CollabMessage);
    const stateUpdates = newMsgs.filter((m) => m.type === 'state-update');
    expect(stateUpdates).toHaveLength(0);
  });

  it('should not leak cursor-move from project 1 to project 2', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(2, 'session-b', { userId: 2, isOwner: true });

    const sentBefore2 = ws2.sent.length;
    sendMessage(ws1, makeMsg('cursor-move', { x: 100, y: 200, view: 'pcb' }, 1, 1));

    const cursorMsgs = ws2.sent.slice(sentBefore2).map((s) => JSON.parse(s) as CollabMessage).filter((m) => m.type === 'cursor-move');
    expect(cursorMsgs).toHaveLength(0);
  });

  it('should not leak chat from project 1 to project 2', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(2, 'session-b', { userId: 2, isOwner: true });

    const sentBefore2 = ws2.sent.length;
    sendMessage(ws1, makeMsg('chat', { text: 'secret message' }, 1, 1));

    const chatMsgs = ws2.sent.slice(sentBefore2).map((s) => JSON.parse(s) as CollabMessage).filter((m) => m.type === 'chat');
    expect(chatMsgs).toHaveLength(0);
  });

  it('should maintain separate rooms for different projects', async () => {
    await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    await simulateJoin(2, 'session-b', { userId: 2, isOwner: true });
    await simulateJoin(1, 'session-c', { userId: 3, isOwner: false });

    expect(server.getRoomCount()).toBe(2);
    expect(server.getRoomUsers(1)).toHaveLength(2);
    expect(server.getRoomUsers(2)).toHaveLength(1);
  });

  it('should have independent lock state per project', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(2, 'session-b', { userId: 2, isOwner: true });

    // Lock same entity name in different projects
    sendMessage(ws1, makeMsg('lock-request', { entityType: 'node', entityId: 'n1', userId: 1, timeout: 30000 }, 1, 1));
    sendMessage(ws2, makeMsg('lock-request', { entityType: 'node', entityId: 'n1', userId: 2, timeout: 30000 }, 2, 2));

    // Both should succeed because lock keys include projectId
    const key1 = lockKey(1, 'node', 'n1');
    const key2 = lockKey(2, 'node', 'n1');

    expect(server.getLocks().has(key1)).toBe(true);
    expect(server.getLocks().has(key2)).toBe(true);
    expect(server.getLocks().get(key1)!.userId).toBe(1);
    expect(server.getLocks().get(key2)!.userId).toBe(2);
  });
});

/* ------------------------------------------------------------------ */
/*  Reconnection                                                       */
/* ------------------------------------------------------------------ */

describe('Collaboration Auth — Reconnection', () => {
  let server: CollaborationServer;

  beforeEach(() => {
    vi.useFakeTimers();
    mockValidateSession.mockResolvedValue({ userId: 1 });
    mockGetUserById.mockResolvedValue({ username: 'alice' });
    mockIsProjectOwner.mockResolvedValue(true);
    const httpServer = createMockHttpServer();
    server = new CollaborationServer(httpServer as unknown as import('http').Server);
  });

  afterEach(() => {
    server.shutdown();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should assign same role on reconnection (owner reconnects as owner)', async () => {
    // First connection as owner
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    expect(server.getRoomUsers(1)[0].role).toBe('owner');

    // Disconnect
    ws1.emit('close');
    expect(server.getRoomUsers(1)).toHaveLength(0);

    // Reconnect with same ownership
    await simulateJoin(1, 'session-a-new', { userId: 1, isOwner: true });
    const users = server.getRoomUsers(1);
    expect(users).toHaveLength(1);
    expect(users[0].role).toBe('owner');
    expect(users[0].userId).toBe(1);
  });

  it('should assign same role on reconnection (editor reconnects as editor)', async () => {
    // First connection as editor
    const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });
    expect(server.getRoomUsers(1)[0].role).toBe('editor');

    // Disconnect
    ws2.emit('close');

    // Reconnect
    await simulateJoin(1, 'session-b-new', { userId: 2, isOwner: false });
    const users = server.getRoomUsers(1);
    expect(users).toHaveLength(1);
    expect(users[0].role).toBe('editor');
  });

  it('should receive fresh state-sync on reconnection', async () => {
    // Connect, send some state
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

    // Create state (advance version)
    sendMessage(ws2, makeMsg('state-update', { operations: [{ op: 'insert', path: [], value: 1 }] }, 2));

    // Disconnect user 2
    ws2.emit('close');

    // Reconnect user 2
    const ws2New = await simulateJoin(1, 'session-b-new', { userId: 2, isOwner: false });

    // First message should be state-sync with updated version
    const syncMsg = parseSent(ws2New, 0);
    expect(syncMsg.type).toBe('state-sync');
    expect(syncMsg.payload.version).toBe(1); // version was incremented by the state-update
  });

  it('should not carry stale locks from previous connection', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });

    // Acquire lock
    sendMessage(ws1, makeMsg('lock-request', { entityType: 'node', entityId: 'n1', userId: 1, timeout: 30000 }, 1));
    expect(server.getLocks().has(lockKey(1, 'node', 'n1'))).toBe(true);

    // Disconnect (locks should be cleaned)
    ws1.emit('close');
    expect(server.getLocks().has(lockKey(1, 'node', 'n1'))).toBe(false);

    // Reconnect — lock should not be present
    await simulateJoin(1, 'session-a-new', { userId: 1, isOwner: true });
    expect(server.getLocks().has(lockKey(1, 'node', 'n1'))).toBe(false);
  });
});
