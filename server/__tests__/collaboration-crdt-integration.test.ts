/**
 * Integration tests for collaboration CRDT merge, lock enforcement,
 * and RBAC during state updates (BL-0486 + BL-0487 + BL-0488).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import type { CollabMessage, CRDTOperation } from '@shared/collaboration';
import { lockKey } from '@shared/collaboration';

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

describe('Collaboration — BL-0487: Lock enforcement during state updates', () => {
  let server: CollaborationServer;

  beforeEach(() => {
    vi.useFakeTimers();
    mockValidateSession.mockResolvedValue({ userId: 1 });
    mockGetUserById.mockResolvedValue({ username: 'alice' });
    mockIsProjectOwner.mockResolvedValue(true);
    const httpServer = new EventEmitter();
    server = new CollaborationServer(httpServer as unknown as import('http').Server);
  });

  afterEach(() => {
    server.shutdown();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should reject update operation targeting an entity locked by another user', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

    // User 1 acquires lock on node n1
    sendMessage(ws1, makeMsg('lock-request', { entityType: 'node', entityId: 'n1', userId: 1, timeout: 30000 }, 1));

    // User 2 tries to update locked node n1
    const sentBefore2 = ws2.sent.length;
    sendMessage(ws2, makeMsg('state-update', {
      operations: [{ op: 'update', path: ['nodes'], key: 'n1', value: { label: 'hijacked' } }],
    }, 2));

    // Should receive an error about locked entity
    const errors = getMessagesByType(ws2, 'error', sentBefore2);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0].payload.error).toContain('locked');
  });

  it('should allow the lock holder to update the locked entity', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

    // User 1 acquires lock on node n1
    sendMessage(ws1, makeMsg('lock-request', { entityType: 'node', entityId: 'n1', userId: 1, timeout: 30000 }, 1));

    // User 1 updates the locked node — should succeed
    const sentBefore2 = ws2.sent.length;
    sendMessage(ws1, makeMsg('state-update', {
      operations: [{ op: 'update', path: ['nodes'], key: 'n1', value: { label: 'mine' } }],
    }, 1));

    // ws2 should receive the state-update (not an error)
    const updates = getMessagesByType(ws2, 'state-update', sentBefore2);
    expect(updates).toHaveLength(1);
  });

  it('should reject delete operation targeting an entity locked by another user', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

    // User 1 locks edge e1
    sendMessage(ws1, makeMsg('lock-request', { entityType: 'edge', entityId: 'e1', userId: 1, timeout: 30000 }, 1));

    // User 2 tries to delete the locked edge
    const sentBefore2 = ws2.sent.length;
    sendMessage(ws2, makeMsg('state-update', {
      operations: [{ op: 'delete', path: ['edges'], key: 'e1' }],
    }, 2));

    const errors = getMessagesByType(ws2, 'error', sentBefore2);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0].payload.error).toContain('locked');
  });

  it('should allow operations on unlocked entities while other entities are locked', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

    // User 1 locks node n1
    sendMessage(ws1, makeMsg('lock-request', { entityType: 'node', entityId: 'n1', userId: 1, timeout: 30000 }, 1));

    // User 2 updates a different node n2 — should succeed
    const sentBefore1 = ws1.sent.length;
    sendMessage(ws2, makeMsg('state-update', {
      operations: [{ op: 'update', path: ['nodes'], key: 'n2', value: { label: 'fine' } }],
    }, 2));

    const updates = getMessagesByType(ws1, 'state-update', sentBefore1);
    expect(updates).toHaveLength(1);
  });

  it('should allow operations after lock expires', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

    // User 1 acquires short lock (5s)
    sendMessage(ws1, makeMsg('lock-request', { entityType: 'node', entityId: 'n1', userId: 1, timeout: 5000 }, 1));

    // Advance past lock timeout + cleanup interval
    vi.advanceTimersByTime(11000);

    // User 2 can now update node n1
    const sentBefore1 = ws1.sent.length;
    sendMessage(ws2, makeMsg('state-update', {
      operations: [{ op: 'update', path: ['nodes'], key: 'n1', value: { label: 'free' } }],
    }, 2));

    const updates = getMessagesByType(ws1, 'state-update', sentBefore1);
    expect(updates).toHaveLength(1);
  });

  it('should partially accept batch: pass unlocked ops, reject locked ops', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

    // User 1 locks node n1
    sendMessage(ws1, makeMsg('lock-request', { entityType: 'node', entityId: 'n1', userId: 1, timeout: 30000 }, 1));

    // User 2 sends a batch with one locked and one unlocked op
    const sentBefore1 = ws1.sent.length;
    const sentBefore2 = ws2.sent.length;
    sendMessage(ws2, makeMsg('state-update', {
      operations: [
        { op: 'update', path: ['nodes'], key: 'n1', value: { label: 'locked' } },  // rejected
        { op: 'update', path: ['nodes'], key: 'n2', value: { label: 'unlocked' } }, // accepted
      ],
    }, 2));

    // ws2 should get an error about the locked op
    const errors = getMessagesByType(ws2, 'error', sentBefore2);
    expect(errors.length).toBeGreaterThanOrEqual(1);

    // ws1 should receive the surviving op
    const updates = getMessagesByType(ws1, 'state-update', sentBefore1);
    expect(updates).toHaveLength(1);
    const receivedOps = updates[0].payload.operations as Array<Record<string, unknown>>;
    expect(receivedOps).toHaveLength(1);
    expect(receivedOps[0]).toMatchObject({ op: 'update', key: 'n2' });
  });
});

/* ------------------------------------------------------------------ */
/*  BL-0488: RBAC enforcement during state updates                     */
/* ------------------------------------------------------------------ */

describe('Collaboration — BL-0488: Editor RBAC restrictions', () => {
  let server: CollaborationServer;

  beforeEach(() => {
    vi.useFakeTimers();
    mockValidateSession.mockResolvedValue({ userId: 1 });
    mockGetUserById.mockResolvedValue({ username: 'alice' });
    mockIsProjectOwner.mockResolvedValue(true);
    const httpServer = new EventEmitter();
    server = new CollaborationServer(httpServer as unknown as import('http').Server);
  });

  afterEach(() => {
    server.shutdown();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should block editor from deleting root design (path.length === 0)', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

    const sentBefore2 = ws2.sent.length;
    sendMessage(ws2, makeMsg('state-update', {
      operations: [{ op: 'delete', path: [], key: 'design' }],
    }, 2));

    const errors = getMessagesByType(ws2, 'error', sentBefore2);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0].payload.error).toContain('Editors cannot delete');
  });

  it('should allow editor to delete non-root entities', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

    const sentBefore1 = ws1.sent.length;
    sendMessage(ws2, makeMsg('state-update', {
      operations: [{ op: 'delete', path: ['nodes'], key: 'n1' }],
    }, 2));

    const updates = getMessagesByType(ws1, 'state-update', sentBefore1);
    expect(updates).toHaveLength(1);
  });

  it('should allow owner to delete root design', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

    const sentBefore2 = ws2.sent.length;
    sendMessage(ws1, makeMsg('state-update', {
      operations: [{ op: 'delete', path: [], key: 'design' }],
    }, 1));

    // ws2 should receive the update (not an error on ws1)
    const updates = getMessagesByType(ws2, 'state-update', sentBefore2);
    expect(updates).toHaveLength(1);
  });

  it('should block viewer from all state mutations', async () => {
    await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });
    server.setUserRole(1, 2, 'viewer');

    const sentBefore = ws2.sent.length;
    sendMessage(ws2, makeMsg('state-update', {
      operations: [{ op: 'insert', path: ['nodes'], value: { id: 'sneaky' } }],
    }, 2));

    const errors = getMessagesByType(ws2, 'error', sentBefore);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0].payload.error).toContain('Viewer');
  });

  it('should allow editor to insert and update entities', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

    const sentBefore = ws1.sent.length;
    sendMessage(ws2, makeMsg('state-update', {
      operations: [
        { op: 'insert', path: ['nodes'], value: { id: 'new-node' } },
        { op: 'update', path: ['nodes'], key: 'existing', value: { label: 'changed' } },
      ],
    }, 2));

    const updates = getMessagesByType(ws1, 'state-update', sentBefore);
    expect(updates).toHaveLength(1);
    const receivedOps = updates[0].payload.operations as Array<Record<string, unknown>>;
    expect(receivedOps).toHaveLength(2);
  });
});

/* ------------------------------------------------------------------ */
/*  BL-0486: CRDT merge integration                                    */
/* ------------------------------------------------------------------ */

describe('Collaboration — BL-0486: CRDT merge during state updates', () => {
  let server: CollaborationServer;

  beforeEach(() => {
    vi.useFakeTimers();
    mockValidateSession.mockResolvedValue({ userId: 1 });
    mockGetUserById.mockResolvedValue({ username: 'alice' });
    mockIsProjectOwner.mockResolvedValue(true);
    const httpServer = new EventEmitter();
    server = new CollaborationServer(httpServer as unknown as import('http').Server);
  });

  afterEach(() => {
    server.shutdown();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should enrich operations with server timestamp and clientId', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

    const sentBefore = ws1.sent.length;
    sendMessage(ws2, makeMsg('state-update', {
      operations: [{ op: 'insert', path: ['nodes'], value: { id: 'n1' } }],
    }, 2));

    const updates = getMessagesByType(ws1, 'state-update', sentBefore);
    expect(updates).toHaveLength(1);
    const ops = updates[0].payload.operations as Array<Record<string, unknown>>;
    expect(ops[0]).toHaveProperty('timestamp');
    expect(ops[0]).toHaveProperty('clientId', 2);
    expect(typeof ops[0].timestamp).toBe('number');
    expect(ops[0].timestamp).toBeGreaterThan(0);
  });

  it('should assign monotonically increasing timestamps across operations', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

    // Send two batches
    sendMessage(ws2, makeMsg('state-update', {
      operations: [
        { op: 'insert', path: ['nodes'], value: { id: 'n1' } },
        { op: 'insert', path: ['nodes'], value: { id: 'n2' } },
      ],
    }, 2));

    sendMessage(ws2, makeMsg('state-update', {
      operations: [{ op: 'insert', path: ['nodes'], value: { id: 'n3' } }],
    }, 2));

    const updates = getMessagesByType(ws1, 'state-update');
    expect(updates.length).toBeGreaterThanOrEqual(2);

    // Collect all timestamps
    const timestamps: number[] = [];
    for (const u of updates) {
      const ops = u.payload.operations as Array<Record<string, unknown>>;
      for (const op of ops) {
        if (typeof op.timestamp === 'number') {
          timestamps.push(op.timestamp);
        }
      }
    }

    // Should be strictly increasing
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]).toBeGreaterThan(timestamps[i - 1]);
    }
  });

  it('should reject delete when concurrent insert targets the same key', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

    // User 2 inserts node n1 (creates a recent op in the merge window)
    sendMessage(ws2, makeMsg('state-update', {
      operations: [{ op: 'insert', path: ['nodes'], value: { id: 'n1' } }],
    }, 2));

    // User 1 immediately tries to delete n1 — should be rejected by structural merge
    // (insert wins over concurrent delete)
    const sentBefore1 = ws1.sent.length;
    const sentBefore2 = ws2.sent.length;
    sendMessage(ws1, makeMsg('state-update', {
      operations: [{ op: 'delete', path: ['nodes'], key: 'n1' }],
    }, 1));

    // The delete should have been dropped by CRDT merge — ws2 should NOT receive it
    const updatesTo2 = getMessagesByType(ws2, 'state-update', sentBefore2);
    const deleteOps = updatesTo2.flatMap((u) =>
      (u.payload.operations as Array<Record<string, unknown>>).filter((o) => o.op === 'delete'),
    );
    expect(deleteOps).toHaveLength(0);
  });

  it('should accept insert operations normally', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

    const sentBefore = ws1.sent.length;
    sendMessage(ws2, makeMsg('state-update', {
      operations: [
        { op: 'insert', path: ['nodes'], value: { id: 'n1' } },
        { op: 'insert', path: ['edges'], value: { id: 'e1' } },
      ],
    }, 2));

    const updates = getMessagesByType(ws1, 'state-update', sentBefore);
    expect(updates).toHaveLength(1);
    const ops = updates[0].payload.operations as Array<Record<string, unknown>>;
    expect(ops).toHaveLength(2);
  });

  it('should accept update operations normally when no LWW conflict', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

    const sentBefore = ws1.sent.length;
    sendMessage(ws2, makeMsg('state-update', {
      operations: [
        { op: 'update', path: ['nodes'], key: 'n1', value: { label: 'updated' } },
      ],
    }, 2));

    const updates = getMessagesByType(ws1, 'state-update', sentBefore);
    expect(updates).toHaveLength(1);
    const ops = updates[0].payload.operations as Array<Record<string, unknown>>;
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ op: 'update', key: 'n1', value: { label: 'updated' } });
  });

  it('should increment version for each accepted state-update', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

    sendMessage(ws2, makeMsg('state-update', {
      operations: [{ op: 'insert', path: ['nodes'], value: { id: 'n1' } }],
    }, 2));
    sendMessage(ws2, makeMsg('state-update', {
      operations: [{ op: 'insert', path: ['nodes'], value: { id: 'n2' } }],
    }, 2));

    const updates = getMessagesByType(ws1, 'state-update');
    expect(updates.length).toBeGreaterThanOrEqual(2);
    expect(updates[0].payload.version).toBe(1);
    expect(updates[1].payload.version).toBe(2);
  });
});
