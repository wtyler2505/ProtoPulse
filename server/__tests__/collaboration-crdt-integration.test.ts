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
  mockGetProject.mockResolvedValueOnce({ id: projectId, ownerId: isOwner ? userId : 999 });
  if (!isOwner) {
    mockGetProjectMembers.mockResolvedValueOnce([{ userId, role: 'editor', status: 'accepted' }]);
  }

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
    mockGetProject.mockResolvedValue({ id: 1, ownerId: 1 });
    mockGetProjectMembers.mockResolvedValue([]);
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
    mockGetProject.mockResolvedValue({ id: 1, ownerId: 1 });
    mockGetProjectMembers.mockResolvedValue([]);
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
    mockGetProject.mockResolvedValue({ id: 1, ownerId: 1 });
    mockGetProjectMembers.mockResolvedValue([]);
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

/* ------------------------------------------------------------------ */
/*  BL-0524: Conflict-detected emission + resolve-mine convergence     */
/* ------------------------------------------------------------------ */

describe('Collaboration — BL-0524: Conflict UI wire (detection + convergence)', () => {
  let server: CollaborationServer;

  beforeEach(() => {
    vi.useFakeTimers();
    mockValidateSession.mockResolvedValue({ userId: 1 });
    mockGetUserById.mockResolvedValue({ username: 'alice' });
    mockIsProjectOwner.mockResolvedValue(true);
    mockGetProject.mockResolvedValue({ id: 1, ownerId: 1 });
    mockGetProjectMembers.mockResolvedValue([]);
    const httpServer = new EventEmitter();
    server = new CollaborationServer(httpServer as unknown as import('http').Server);
  });

  afterEach(() => {
    server.shutdown();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('emits conflict-detected to the LWW-losing client only', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

    // User 2 updates node n1 first — wins the race, lands in recent window
    sendMessage(ws2, makeMsg('state-update', {
      operations: [{ op: 'update', path: ['nodes'], key: 'n1', value: { label: 'theirs' } }],
    }, 2));

    // User 1 sends a conflicting update for the same key — server has a newer
    // Lamport for user 2's op, so user 1 loses LWW and is dropped.
    sendMessage(ws1, makeMsg('state-update', {
      operations: [{ op: 'update', path: ['nodes'], key: 'n1', value: { label: 'mine' } }],
    }, 1));

    // User 1 should receive a conflict-detected message
    const conflicts1 = getMessagesByType(ws1, 'conflict-detected');
    expect(conflicts1).toHaveLength(1);
    const list = conflicts1[0].payload.conflicts as Array<Record<string, unknown>>;
    expect(list).toHaveLength(1);
    expect(list[0].kind).toBe('lww-update');
    expect(list[0].key).toBe('n1');

    // User 2 (winner) must NOT receive a conflict message
    const conflicts2 = getMessagesByType(ws2, 'conflict-detected');
    expect(conflicts2).toHaveLength(0);
  });

  it('converges both clients when the loser re-applies their op ("accept mine") after conflict ACK', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

    // User 2 wins the initial LWW race.
    sendMessage(ws2, makeMsg('state-update', {
      operations: [{ op: 'update', path: ['nodes'], key: 'n1', value: { label: 'theirs' } }],
    }, 2));

    // User 1 loses (unobserved newer frontier) → dropped, receives conflict-detected.
    sendMessage(ws1, makeMsg('state-update', {
      operations: [{ op: 'update', path: ['nodes'], key: 'n1', value: { label: 'mine' } }],
    }, 1));

    // BL-0879: capture the conflict + parse theirOp, then ACK theirOp
    // (the client conflict handler does this automatically in production).
    const conflictsBefore = getMessagesByType(ws1, 'conflict-detected');
    expect(conflictsBefore).toHaveLength(1);
    const theirOp = (conflictsBefore[0].payload.conflicts as Array<Record<string, unknown>>)[0]
      .theirOp as Record<string, unknown>;
    sendMessage(ws1, makeMsg('state-update-ack', {
      updates: [{ entityKey: 'nodes:n1', timestamp: theirOp.timestamp }],
    }, 1));

    // Simulate the client "accept mine" path: re-send the losing op WITHOUT
    // server-assigned timestamp/clientId so the server re-tags with a fresh
    // Lamport clock.
    const sentBefore2 = ws2.sent.length;
    sendMessage(ws1, makeMsg('state-update', {
      operations: [{ op: 'update', path: ['nodes'], key: 'n1', value: { label: 'mine' } }],
    }, 1));

    // No second conflict for ws1 — theirOp was ACKed.
    expect(getMessagesByType(ws1, 'conflict-detected')).toHaveLength(1);

    // User 2 must now see a state-update flipping the value to "mine".
    const updatesTo2 = getMessagesByType(ws2, 'state-update', sentBefore2);
    expect(updatesTo2.length).toBeGreaterThanOrEqual(1);
    const lastOps = updatesTo2[updatesTo2.length - 1].payload.operations as Array<Record<string, unknown>>;
    expect(lastOps).toHaveLength(1);
    expect(lastOps[0]).toMatchObject({
      op: 'update',
      key: 'n1',
      value: { label: 'mine' },
    });
  });
});

/* ------------------------------------------------------------------ */
/*  BL-0879: Option C-plus-ACK frontier-based update conflicts         */
/* ------------------------------------------------------------------ */

describe('Collaboration — BL-0879: per-key frontier + state-update-ack', () => {
  let server: CollaborationServer;

  // Use setImmediate-backed flushMicrotasks so server-side WebSocket
  // message handlers complete between separate-frame sends (real timers
  // in this describe — fake timers would park setImmediate).
  async function flushMicrotasks(): Promise<void> {
    await new Promise<void>((resolve) => { setImmediate(resolve); });
  }

  function updateMsg(ws: MockWebSocket, userId: number, key: string, label: string): void {
    sendMessage(ws, makeMsg('state-update', {
      operations: [{ op: 'update', path: ['nodes'], key, value: { label } }],
    }, userId));
  }

  function ackMsg(ws: MockWebSocket, userId: number, entityKey: string, timestamp: unknown): void {
    sendMessage(ws, makeMsg('state-update-ack', {
      updates: [{ entityKey, timestamp }],
    }, userId));
  }

  /** Extract the server-tagged ops of the last state-update received. */
  function lastUpdateOps(ws: MockWebSocket): Array<Record<string, unknown>> {
    const updates = getMessagesByType(ws, 'state-update');
    expect(updates.length).toBeGreaterThanOrEqual(1);
    return updates[updates.length - 1].payload.operations as Array<Record<string, unknown>>;
  }

  beforeEach(() => {
    mockValidateSession.mockResolvedValue({ userId: 1 });
    mockGetUserById.mockResolvedValue({ username: 'alice' });
    mockIsProjectOwner.mockResolvedValue(true);
    mockGetProject.mockResolvedValue({ id: 1, ownerId: 1 });
    mockGetProjectMembers.mockResolvedValue([]);
    const httpServer = new EventEmitter();
    server = new CollaborationServer(httpServer as unknown as import('http').Server);
  });

  afterEach(() => {
    server.shutdown();
    vi.clearAllMocks();
  });

  // Test 1 — existing failing BL-0879 case passes without ACK
  it('emits conflict-detected to the losing connection only, with theirOp = the server-tagged winning op', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

    updateMsg(ws2, 2, 'n1', 'theirs');

    // ws1 DID receive the broadcast — but does not ACK it.
    const broadcastOps = lastUpdateOps(ws1);
    expect(broadcastOps[0]).toMatchObject({ op: 'update', key: 'n1' });

    updateMsg(ws1, 1, 'n1', 'mine');

    const conflicts1 = getMessagesByType(ws1, 'conflict-detected');
    expect(conflicts1).toHaveLength(1);
    const list = conflicts1[0].payload.conflicts as Array<Record<string, unknown>>;
    expect(list).toHaveLength(1);
    expect(list[0].kind).toBe('lww-update');
    const theirOp = list[0].theirOp as Record<string, unknown>;
    expect(theirOp).toMatchObject({
      op: 'update',
      key: 'n1',
      value: { label: 'theirs' },
      clientId: 2,
      timestamp: broadcastOps[0].timestamp,
    });

    expect(getMessagesByType(ws2, 'conflict-detected')).toHaveLength(0);
  });

  // Test 2 — broadcast sent but not ACKed still conflicts (send ≠ apply)
  it('a delivered but un-ACKed broadcast still produces a conflict on overwrite', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

    updateMsg(ws2, 2, 'n1', 'theirs');

    // Confirm the server actually SENT the broadcast frame to ws1.
    expect(getMessagesByType(ws1, 'state-update')).toHaveLength(1);

    // No ACK. Overwrite must conflict — a sent frame is not observation.
    updateMsg(ws1, 1, 'n1', 'mine');
    expect(getMessagesByType(ws1, 'conflict-detected')).toHaveLength(1);
  });

  // Test 3 — ACKed remote update allows intentional overwrite
  it('an ACKed remote update allows intentional overwrite without conflict', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

    updateMsg(ws2, 2, 'n1', 'theirs');
    const ts = lastUpdateOps(ws1)[0].timestamp;

    ackMsg(ws1, 1, 'nodes:n1', ts);

    const sentBefore2 = ws2.sent.length;
    updateMsg(ws1, 1, 'n1', 'mine');

    expect(getMessagesByType(ws1, 'conflict-detected')).toHaveLength(0);
    const updatesTo2 = getMessagesByType(ws2, 'state-update', sentBefore2);
    expect(updatesTo2).toHaveLength(1);
    expect((updatesTo2[0].payload.operations as Array<Record<string, unknown>>)[0])
      .toMatchObject({ op: 'update', key: 'n1', value: { label: 'mine' } });
  });

  // Test 4 — accept mine succeeds only after conflict ACK
  it('"accept mine" resend conflicts again until the conflict theirOp is ACKed', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

    updateMsg(ws2, 2, 'n1', 'theirs');
    updateMsg(ws1, 1, 'n1', 'mine');

    const conflicts = getMessagesByType(ws1, 'conflict-detected');
    expect(conflicts).toHaveLength(1);
    const theirOp = (conflicts[0].payload.conflicts as Array<Record<string, unknown>>)[0]
      .theirOp as Record<string, unknown>;

    // Resend "mine" WITHOUT ACK → second conflict, not accepted.
    updateMsg(ws1, 1, 'n1', 'mine');
    expect(getMessagesByType(ws1, 'conflict-detected')).toHaveLength(2);

    // ACK theirOp via the unified state-update-ack path.
    ackMsg(ws1, 1, 'nodes:n1', theirOp.timestamp);

    // Resend "mine" → accepted, no third conflict, ws2 receives it.
    const sentBefore2 = ws2.sent.length;
    updateMsg(ws1, 1, 'n1', 'mine');
    expect(getMessagesByType(ws1, 'conflict-detected')).toHaveLength(2);
    const updatesTo2 = getMessagesByType(ws2, 'state-update', sentBefore2);
    expect(updatesTo2).toHaveLength(1);
    expect((updatesTo2[0].payload.operations as Array<Record<string, unknown>>)[0])
      .toMatchObject({ key: 'n1', value: { label: 'mine' } });
  });

  // Test 5 — two stale same-key updates in separate frames before conflict ACK
  it('two stale same-key updates in separate frames before conflict ACK both conflict', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

    updateMsg(ws2, 2, 'n1', 'theirs');
    const sentBefore2 = ws2.sent.length;

    updateMsg(ws1, 1, 'n1', 'stale-A');
    await flushMicrotasks();
    expect(getMessagesByType(ws1, 'conflict-detected')).toHaveLength(1);

    // Separate WebSocket frame, still no conflict ACK.
    updateMsg(ws1, 1, 'n1', 'stale-B');
    await flushMicrotasks();
    expect(getMessagesByType(ws1, 'conflict-detected')).toHaveLength(2);

    // Neither stale update was broadcast to ws2.
    expect(getMessagesByType(ws2, 'state-update', sentBefore2)).toHaveLength(0);
  });

  // Test 5b — two stale same-key updates in a SINGLE batch both conflict
  it('two stale same-key updates in a single batch both conflict (no ACK opportunity between)', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

    updateMsg(ws2, 2, 'n1', 'theirs');
    const winnerTs = lastUpdateOps(ws1)[0].timestamp;
    const sentBefore2 = ws2.sent.length;

    // Rapid local edits batched into one frame.
    sendMessage(ws1, makeMsg('state-update', {
      operations: [
        { op: 'update', path: ['nodes'], key: 'n1', value: { label: 'stale-A' } },
        { op: 'update', path: ['nodes'], key: 'n1', value: { label: 'stale-B' } },
      ],
    }, 1));

    const conflictMsgs = getMessagesByType(ws1, 'conflict-detected');
    const allConflicts = conflictMsgs.flatMap(
      (m) => m.payload.conflicts as Array<Record<string, unknown>>,
    );
    expect(allConflicts).toHaveLength(2);
    // Each conflict's theirOp is the same canonical winner (ws2's op).
    for (const c of allConflicts) {
      expect((c.theirOp as Record<string, unknown>).timestamp).toBe(winnerTs);
      expect((c.theirOp as Record<string, unknown>).clientId).toBe(2);
    }
    expect(getMessagesByType(ws2, 'state-update', sentBefore2)).toHaveLength(0);
  });

  // Test 6 — same user, two connections do not share observed frontier
  it('same-user second tab receives the broadcast and conflicts when un-ACKed', async () => {
    const ws1a = await simulateJoin(1, 'session-a1', { userId: 1, isOwner: true });
    const ws1b = await simulateJoin(1, 'session-a2', { userId: 1, isOwner: true });

    updateMsg(ws1a, 1, 'n1', 'tab-a');

    // Exclusion is by connection id, not user id — second tab gets it.
    expect(getMessagesByType(ws1b, 'state-update')).toHaveLength(1);

    // No ACK from ws1b → conflict even though frontier.userId === incoming userId.
    updateMsg(ws1b, 1, 'n1', 'tab-b');
    expect(getMessagesByType(ws1b, 'conflict-detected')).toHaveLength(1);
  });

  // Test 7 — ACK is per connection, not per user
  it('sender self-observation does not advance a same-user sibling connection', async () => {
    const ws1a = await simulateJoin(1, 'session-a1', { userId: 1, isOwner: true });
    const ws1b = await simulateJoin(1, 'session-a2', { userId: 1, isOwner: true });

    updateMsg(ws1a, 1, 'n1', 'tab-a');
    expect(getMessagesByType(ws1b, 'state-update')).toHaveLength(1);

    // ws1a self-observed its own op; that must not advance ws1b.
    updateMsg(ws1b, 1, 'n1', 'tab-b');
    expect(getMessagesByType(ws1b, 'conflict-detected')).toHaveLength(1);
    // ws1a (the frontier owner) never sees a conflict.
    expect(getMessagesByType(ws1a, 'conflict-detected')).toHaveLength(0);
  });

  // Test 8 — stale update still conflicts after recentOps eviction
  it('stale update still conflicts after the 200-op recentOps window evicts the winner', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

    updateMsg(ws2, 2, 'n1', 'theirs');
    const winnerTs = lastUpdateOps(ws1)[0].timestamp;

    // Evict the winner from recentOps (MERGE_WINDOW_SIZE = 200) with
    // 201 accepted ops on unrelated keys.
    const filler = Array.from({ length: 201 }, (_, i) => ({
      op: 'update' as const, path: ['nodes'], key: `filler-${String(i)}`, value: { label: 'x' },
    }));
    sendMessage(ws2, makeMsg('state-update', { operations: filler }, 2));

    // ws1 still conflicts on n1 — keyFrontiers, not the window, decides;
    // theirOp is the evicted winning op.
    updateMsg(ws1, 1, 'n1', 'mine');
    const conflicts = getMessagesByType(ws1, 'conflict-detected');
    expect(conflicts).toHaveLength(1);
    const list = conflicts[0].payload.conflicts as Array<Record<string, unknown>>;
    expect(list[0].kind).toBe('lww-update');
    expect((list[0].theirOp as Record<string, unknown>).timestamp).toBe(winnerTs);
    expect((list[0].theirOp as Record<string, unknown>).value).toEqual({ label: 'theirs' });
  });

  // Test 9 — batch timestamps use each tagged op
  it('batched ops get distinct increasing timestamps and ACK applies per key', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

    sendMessage(ws2, makeMsg('state-update', {
      operations: [
        { op: 'update', path: ['nodes'], key: 'k1', value: { label: 'a' } },
        { op: 'update', path: ['nodes'], key: 'k2', value: { label: 'b' } },
      ],
    }, 2));

    const ops = lastUpdateOps(ws1);
    expect(ops).toHaveLength(2);
    expect(typeof ops[0].timestamp).toBe('number');
    expect(ops[1].timestamp as number).toBeGreaterThan(ops[0].timestamp as number);

    // ACK only the first key.
    ackMsg(ws1, 1, 'nodes:k1', ops[0].timestamp);

    // Overwrite first key: accepted.
    updateMsg(ws1, 1, 'k1', 'mine');
    expect(getMessagesByType(ws1, 'conflict-detected')).toHaveLength(0);

    // Overwrite second key: conflicts.
    updateMsg(ws1, 1, 'k2', 'mine');
    expect(getMessagesByType(ws1, 'conflict-detected')).toHaveLength(1);
  });

  // Test 10 — viewer can ACK but cannot mutate
  it('viewer can send state-update-ack without error but state-update is still rejected', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

    updateMsg(ws1, 1, 'n1', 'owner');
    const ts = lastUpdateOps(ws2)[0].timestamp;

    server.setUserRole(1, 2, 'viewer');

    const sentBefore2 = ws2.sent.length;
    ackMsg(ws2, 2, 'nodes:n1', ts);
    expect(getMessagesByType(ws2, 'error', sentBefore2)).toHaveLength(0);

    updateMsg(ws2, 2, 'n1', 'sneaky');
    const errors = getMessagesByType(ws2, 'error', sentBefore2);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0].payload.error).toContain('Viewer');
  });

  // Test 11 — room cleanup removes per-connection observed state
  it('disconnects clean per-connection observed state; empty room clears frontiers', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

    updateMsg(ws1, 1, 'n1', 'one');
    expect(server.getConflictStateCounts(1)).toEqual({ keyFrontiers: 1, observedConnections: 2 });

    // Disconnect ws2 — only its observed state goes away.
    ws2.emit('close');
    expect(server.getConflictStateCounts(1)).toEqual({ keyFrontiers: 1, observedConnections: 1 });

    // Remaining client still functions.
    updateMsg(ws1, 1, 'n2', 'two');
    expect(getMessagesByType(ws1, 'conflict-detected')).toHaveLength(0);
    expect(server.getConflictStateCounts(1).keyFrontiers).toBe(2);

    // Last client leaves — all BL-0879 state for the project is cleared.
    ws1.emit('close');
    expect(server.getConflictStateCounts(1)).toEqual({ keyFrontiers: 0, observedConnections: 0 });
  });

  // Test 12 — BL-0883 cold-start carve regression (deliberate pinning)
  it('cold-start connection editing a pre-existing-frontier key receives false-conflict (BL-0883 carve)', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    sendMessage(ws1, makeMsg('state-update', {
      operations: [{ op: 'update', path: ['nodes'], key: 'n1', value: { label: 'one' } }],
    }, 1));

    // Connect ws2 fresh — state-sync has no document snapshot/replay, so
    // its observed frontier starts empty (accepted BL-0879 behavior;
    // BL-0883 will change this test when snapshot/replay + ACK lands).
    const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

    sendMessage(ws2, makeMsg('state-update', {
      operations: [{ op: 'update', path: ['nodes'], key: 'n1', value: { label: 'two' } }],
    }, 2));

    const conflicts = getMessagesByType(ws2, 'conflict-detected');
    expect(conflicts).toHaveLength(1);
    expect((conflicts[0].payload.conflicts as Array<Record<string, unknown>>)[0].kind).toBe('lww-update');
  });

  // Hardening — ACK validation clamps
  it('ignores malformed ACKs and ACKs beyond the authoritative frontier', async () => {
    const ws1 = await simulateJoin(1, 'session-a', { userId: 1, isOwner: true });
    const ws2 = await simulateJoin(1, 'session-b', { userId: 2, isOwner: false });

    updateMsg(ws2, 2, 'n1', 'theirs');
    const ts = lastUpdateOps(ws1)[0].timestamp as number;

    // Future-write spoofing: ackedTs > frontier.ts is ignored.
    ackMsg(ws1, 1, 'nodes:n1', ts + 999);
    // Malformed entries are ignored.
    ackMsg(ws1, 1, '', ts);
    ackMsg(ws1, 1, 'nodes:n1', 'not-a-number');
    // No-frontier key is ignored.
    ackMsg(ws1, 1, 'nodes:never-seen', ts);

    // Still un-observed → overwrite conflicts.
    updateMsg(ws1, 1, 'n1', 'mine');
    expect(getMessagesByType(ws1, 'conflict-detected')).toHaveLength(1);
  });
});
