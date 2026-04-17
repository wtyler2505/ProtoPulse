/**
 * Tests for CollaborationClient (client-side WebSocket collaboration).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CollaborationClient } from '../collaboration-client';
import type { CollabConnectionState } from '../collaboration-client';
import type { CollabMessage } from '@shared/collaboration';

/* ------------------------------------------------------------------ */
/*  Mock WebSocket                                                     */
/* ------------------------------------------------------------------ */

type WsListener = (...args: unknown[]) => void;

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  sent: string[] = [];

  onopen: ((ev: unknown) => void) | null = null;
  onclose: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: unknown) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(_code?: number, _reason?: string): void {
    this.readyState = MockWebSocket.CLOSED;
  }

  // Test helpers
  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.({});
  }

  simulateMessage(msg: CollabMessage): void {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }

  simulateClose(code = 1000, reason = ''): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason });
  }

  simulateError(): void {
    this.onerror?.({});
  }
}

let mockWsInstances: MockWebSocket[] = [];

function getLastWs(): MockWebSocket {
  return mockWsInstances[mockWsInstances.length - 1];
}

beforeEach(() => {
  mockWsInstances = [];
  vi.stubGlobal('WebSocket', class extends MockWebSocket {
    constructor(url: string) {
      super(url);
      mockWsInstances.push(this);
    }
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function createClient(projectId = 1, sessionId = 'test-session'): CollaborationClient {
  return new CollaborationClient(projectId, sessionId);
}

function makeMsg(type: CollabMessage['type'], payload: Record<string, unknown> = {}, userId = 0, projectId = 1): CollabMessage {
  return { type, userId, projectId, timestamp: Date.now(), payload };
}

/* ------------------------------------------------------------------ */
/*  Connection lifecycle                                               */
/* ------------------------------------------------------------------ */

describe('CollaborationClient', () => {
  describe('connection lifecycle', () => {
    it('should start disconnected', () => {
      const client = createClient();
      expect(client.getConnectionState()).toBe('disconnected');
    });

    it('should transition to connecting on connect()', () => {
      const client = createClient();
      const states: CollabConnectionState[] = [];
      client.on('connection-change', (s) => states.push(s));

      client.connect();
      expect(client.getConnectionState()).toBe('connecting');
      expect(states).toContain('connecting');
    });

    it('should transition to connected on WebSocket open', () => {
      const client = createClient();
      client.connect();
      getLastWs().simulateOpen();
      expect(client.getConnectionState()).toBe('connected');
    });

    it('should construct the correct WebSocket URL', () => {
      const client = new CollaborationClient(42, 'my-session');
      client.connect();
      expect(getLastWs().url).toContain('projectId=42');
      expect(getLastWs().url).toContain('sessionId=my-session');
    });

    it('should not create a second WebSocket if already connecting', () => {
      const client = createClient();
      client.connect();
      client.connect();
      expect(mockWsInstances).toHaveLength(1);
    });

    it('should not create a second WebSocket if already open', () => {
      const client = createClient();
      client.connect();
      getLastWs().simulateOpen();
      client.connect();
      expect(mockWsInstances).toHaveLength(1);
    });

    it('should transition to disconnected on disconnect()', () => {
      const client = createClient();
      client.connect();
      getLastWs().simulateOpen();
      client.disconnect();
      expect(client.getConnectionState()).toBe('disconnected');
    });

    it('should clear users on disconnect', () => {
      const client = createClient();
      client.connect();
      getLastWs().simulateOpen();
      getLastWs().simulateMessage(makeMsg('state-sync', { users: [{ userId: 1, username: 'a', role: 'owner', color: '#FF6B6B', lastActivity: 1 }], version: 0, locks: {} }));
      expect(client.getActiveUsers()).toHaveLength(1);
      client.disconnect();
      expect(client.getActiveUsers()).toHaveLength(0);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Reconnection                                                     */
  /* ---------------------------------------------------------------- */

  describe('reconnection', () => {
    it('should attempt reconnect on unexpected close', () => {
      const client = createClient();
      client.connect();
      getLastWs().simulateOpen();
      getLastWs().simulateClose(1006, 'abnormal');

      expect(client.getConnectionState()).toBe('reconnecting');
    });

    it('should use exponential backoff', () => {
      const client = createClient();
      client.connect();
      getLastWs().simulateOpen();
      getLastWs().simulateClose(1006);

      // First attempt after 1s
      vi.advanceTimersByTime(999);
      expect(mockWsInstances).toHaveLength(1);
      vi.advanceTimersByTime(1);
      expect(mockWsInstances).toHaveLength(2);

      // Second attempt: simulate another close, then 2s
      getLastWs().simulateClose(1006);
      vi.advanceTimersByTime(1999);
      expect(mockWsInstances).toHaveLength(2);
      vi.advanceTimersByTime(1);
      expect(mockWsInstances).toHaveLength(3);
    });

    it('should cap backoff at 30 seconds', () => {
      const client = createClient();
      client.connect();
      getLastWs().simulateOpen();

      // Simulate many closes to push backoff past 30s cap
      for (let i = 0; i < 8; i++) {
        getLastWs().simulateClose(1006);
        vi.advanceTimersByTime(30_001);
      }

      // Should still attempt at 30s, not longer
      getLastWs().simulateClose(1006);
      vi.advanceTimersByTime(30_001);
      expect(mockWsInstances.length).toBeGreaterThan(8);
    });

    it('should stop reconnecting after max attempts', () => {
      const client = createClient();
      const errors: Error[] = [];
      client.on('error', (e) => errors.push(e));
      client.connect();
      getLastWs().simulateOpen();

      // Each iteration: close triggers reconnect timer, advance fires it (creates new WS in connecting state), then close that one
      for (let i = 0; i < 10; i++) {
        getLastWs().simulateClose(1006);
        vi.advanceTimersByTime(60_000); // fire reconnect timer
      }

      // The 10th close should trigger error (max attempts reached)
      getLastWs().simulateClose(1006);

      expect(client.getConnectionState()).toBe('error');
      expect(errors.some((e) => e.message.includes('Max reconnect'))).toBe(true);
    });

    it('should reset reconnect attempts after successful connection', () => {
      const client = createClient();
      client.connect();
      getLastWs().simulateOpen();
      getLastWs().simulateClose(1006);
      vi.advanceTimersByTime(1000);
      getLastWs().simulateOpen();

      // Close again — should start backoff from 1s again
      getLastWs().simulateClose(1006);
      vi.advanceTimersByTime(1000);
      expect(mockWsInstances.length).toBeGreaterThanOrEqual(3);
    });

    it('should not reconnect on auth failure (4001-4003)', () => {
      const client = createClient();
      client.connect();
      getLastWs().simulateClose(4001, 'Missing parameters');

      expect(client.getConnectionState()).toBe('error');
      vi.advanceTimersByTime(60_000);
      expect(mockWsInstances).toHaveLength(1); // No new WS created
    });

    it('should not reconnect after explicit disconnect', () => {
      const client = createClient();
      client.connect();
      getLastWs().simulateOpen();
      client.disconnect();
      vi.advanceTimersByTime(60_000);
      expect(mockWsInstances).toHaveLength(1);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Presence                                                         */
  /* ---------------------------------------------------------------- */

  describe('presence', () => {
    it('should update users on state-sync', () => {
      const client = createClient();
      const userChanges: unknown[] = [];
      client.on('users-change', (u) => userChanges.push(u));
      client.connect();
      getLastWs().simulateOpen();

      getLastWs().simulateMessage(makeMsg('state-sync', {
        users: [{ userId: 1, username: 'alice', role: 'owner', color: '#FF6B6B', lastActivity: 1 }],
        version: 0,
        locks: {},
      }));

      expect(client.getActiveUsers()).toHaveLength(1);
      expect(client.getActiveUsers()[0].username).toBe('alice');
    });

    it('should add user on join', () => {
      const client = createClient();
      client.connect();
      getLastWs().simulateOpen();

      getLastWs().simulateMessage(makeMsg('state-sync', { users: [], version: 0, locks: {} }));
      getLastWs().simulateMessage(makeMsg('join', {
        user: { userId: 2, username: 'bob', role: 'editor', color: '#4ECDC4', lastActivity: 1 },
      }));

      expect(client.getActiveUsers()).toHaveLength(1);
      expect(client.getActiveUsers()[0].username).toBe('bob');
    });

    it('should remove user on leave', () => {
      const client = createClient();
      client.connect();
      getLastWs().simulateOpen();

      getLastWs().simulateMessage(makeMsg('state-sync', {
        users: [
          { userId: 1, username: 'alice', role: 'owner', color: '#FF6B6B', lastActivity: 1 },
          { userId: 2, username: 'bob', role: 'editor', color: '#4ECDC4', lastActivity: 1 },
        ],
        version: 0, locks: {},
      }));

      getLastWs().simulateMessage(makeMsg('leave', { userId: 2 }));
      expect(client.getActiveUsers()).toHaveLength(1);
      expect(client.getActiveUsers()[0].username).toBe('alice');
    });

    it('should update existing user on duplicate join', () => {
      const client = createClient();
      client.connect();
      getLastWs().simulateOpen();

      getLastWs().simulateMessage(makeMsg('state-sync', {
        users: [{ userId: 1, username: 'alice', role: 'owner', color: '#FF6B6B', lastActivity: 1 }],
        version: 0, locks: {},
      }));
      getLastWs().simulateMessage(makeMsg('join', {
        user: { userId: 1, username: 'alice-updated', role: 'editor', color: '#4ECDC4', lastActivity: 2 },
      }));

      expect(client.getActiveUsers()).toHaveLength(1);
      expect(client.getActiveUsers()[0].username).toBe('alice-updated');
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Cursor throttling                                                */
  /* ---------------------------------------------------------------- */

  describe('cursor throttling', () => {
    it('should throttle cursor updates to 50ms', () => {
      const client = createClient();
      client.connect();
      const ws = getLastWs();
      ws.simulateOpen();

      client.sendCursorPosition(10, 20, 'architecture');
      client.sendCursorPosition(30, 40, 'architecture');
      client.sendCursorPosition(50, 60, 'architecture');

      // Nothing sent yet (throttled)
      expect(ws.sent).toHaveLength(0);

      // After 50ms, the last position should be sent
      vi.advanceTimersByTime(50);
      expect(ws.sent).toHaveLength(1);
      const parsed = JSON.parse(ws.sent[0]) as CollabMessage;
      expect(parsed.type).toBe('cursor-move');
      expect(parsed.payload).toEqual({ x: 50, y: 60, view: 'architecture' });
    });

    it('should send separate updates after throttle interval', () => {
      const client = createClient();
      client.connect();
      const ws = getLastWs();
      ws.simulateOpen();

      client.sendCursorPosition(10, 20, 'schematic');
      vi.advanceTimersByTime(50);
      expect(ws.sent).toHaveLength(1);

      client.sendCursorPosition(100, 200, 'schematic');
      vi.advanceTimersByTime(50);
      expect(ws.sent).toHaveLength(2);
    });

    it('should not send cursor if no pending update after throttle', () => {
      const client = createClient();
      client.connect();
      const ws = getLastWs();
      ws.simulateOpen();

      client.sendCursorPosition(10, 20, 'architecture');
      vi.advanceTimersByTime(50);
      expect(ws.sent).toHaveLength(1);

      // No new cursor, wait another interval
      vi.advanceTimersByTime(50);
      expect(ws.sent).toHaveLength(1);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Selection                                                        */
  /* ---------------------------------------------------------------- */

  describe('selection', () => {
    it('should send selection change immediately', () => {
      const client = createClient();
      client.connect();
      const ws = getLastWs();
      ws.simulateOpen();

      client.sendSelectionChange('node', ['id1', 'id2']);
      expect(ws.sent).toHaveLength(1);
      const parsed = JSON.parse(ws.sent[0]) as CollabMessage;
      expect(parsed.type).toBe('selection-change');
      expect(parsed.payload).toEqual({ type: 'node', ids: ['id1', 'id2'] });
    });

    it('should emit selection-change from server', () => {
      const client = createClient();
      const events: unknown[] = [];
      client.on('selection-change', (d) => events.push(d));
      client.connect();
      getLastWs().simulateOpen();

      getLastWs().simulateMessage(makeMsg('selection-change', { selection: { type: 'wire', ids: ['w1'] } }, 5));
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ userId: 5, selection: { type: 'wire', ids: ['w1'] } });
    });
  });

  /* ---------------------------------------------------------------- */
  /*  State operations                                                 */
  /* ---------------------------------------------------------------- */

  describe('state operations', () => {
    it('should send state-update with operations', () => {
      const client = createClient();
      client.connect();
      const ws = getLastWs();
      ws.simulateOpen();

      const ops = [{ op: 'insert' as const, path: ['nodes'], value: { id: '1' } }];
      client.sendStateUpdate(ops);

      expect(ws.sent).toHaveLength(1);
      const parsed = JSON.parse(ws.sent[0]) as CollabMessage;
      expect(parsed.type).toBe('state-update');
      expect(parsed.payload.operations).toEqual(ops);
    });

    it('should emit state-update from server', () => {
      const client = createClient();
      const updates: unknown[] = [];
      client.on('state-update', (ops) => updates.push(ops));
      client.connect();
      getLastWs().simulateOpen();

      const ops = [{ op: 'delete' as const, path: ['nodes'], key: 'abc' }];
      getLastWs().simulateMessage(makeMsg('state-update', { operations: ops }, 3));
      expect(updates).toHaveLength(1);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Locking                                                          */
  /* ---------------------------------------------------------------- */

  describe('locking', () => {
    it('should send lock-request and resolve on lock-granted', async () => {
      const client = createClient();
      client.setUserId(1);
      client.connect();
      const ws = getLastWs();
      ws.simulateOpen();

      const promise = client.requestLock('node', 'n1');

      expect(ws.sent).toHaveLength(1);
      const parsed = JSON.parse(ws.sent[0]) as CollabMessage;
      expect(parsed.type).toBe('lock-request');

      // Simulate server granting the lock
      ws.simulateMessage(makeMsg('lock-granted', { entityKey: '1:node:n1', userId: 1 }, 1));
      const result = await promise;
      expect(result).toBe(true);
    });

    it('should resolve false on lock-denied', async () => {
      const client = createClient();
      client.setUserId(1);
      client.connect();
      const ws = getLastWs();
      ws.simulateOpen();

      const promise = client.requestLock('node', 'n1');
      ws.simulateMessage(makeMsg('lock-denied', { entityKey: '1:node:n1', heldBy: 2 }, 1));
      const result = await promise;
      expect(result).toBe(false);
    });

    it('should timeout lock request after 5s', async () => {
      const client = createClient();
      client.setUserId(1);
      client.connect();
      getLastWs().simulateOpen();

      const promise = client.requestLock('node', 'n1');
      vi.advanceTimersByTime(5_000);
      const result = await promise;
      expect(result).toBe(false);
    });

    it('should resolve immediately if already holding the lock', async () => {
      const client = createClient();
      client.setUserId(1);
      client.connect();
      const ws = getLastWs();
      ws.simulateOpen();

      // Grant lock first
      const p1 = client.requestLock('node', 'n1');
      ws.simulateMessage(makeMsg('lock-granted', { entityKey: '1:node:n1', userId: 1 }, 1));
      await p1;

      // Request again — should resolve immediately without sending
      const sentBefore = ws.sent.length;
      const result = await client.requestLock('node', 'n1');
      expect(result).toBe(true);
      expect(ws.sent.length).toBe(sentBefore);
    });

    it('should send lock-released', () => {
      const client = createClient();
      client.connect();
      const ws = getLastWs();
      ws.simulateOpen();

      client.releaseLock('node', 'n1');
      expect(ws.sent).toHaveLength(1);
      const parsed = JSON.parse(ws.sent[0]) as CollabMessage;
      expect(parsed.type).toBe('lock-released');
    });

    it('should track locks from server messages', () => {
      const client = createClient();
      client.connect();
      getLastWs().simulateOpen();

      getLastWs().simulateMessage(makeMsg('lock-granted', { entityKey: '1:node:n1', userId: 3 }, 3));
      expect(client.isLocked('node', 'n1')).toEqual({ locked: true, byUserId: 3 });

      getLastWs().simulateMessage(makeMsg('lock-released', { entityKey: '1:node:n1' }, 3));
      expect(client.isLocked('node', 'n1')).toEqual({ locked: false });
    });

    it('should restore locks from state-sync', () => {
      const client = createClient();
      client.connect();
      getLastWs().simulateOpen();

      getLastWs().simulateMessage(makeMsg('state-sync', {
        users: [],
        version: 1,
        locks: { '1:node:n1': 5, '1:edge:e2': 3 },
      }));

      expect(client.isLocked('node', 'n1')).toEqual({ locked: true, byUserId: 5 });
      expect(client.isLocked('edge', 'e2')).toEqual({ locked: true, byUserId: 3 });
      expect(client.isLocked('wire', 'w1')).toEqual({ locked: false });
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Role changes                                                     */
  /* ---------------------------------------------------------------- */

  describe('role changes', () => {
    it('should update user role on role-change message', () => {
      const client = createClient();
      client.connect();
      getLastWs().simulateOpen();

      getLastWs().simulateMessage(makeMsg('state-sync', {
        users: [{ userId: 2, username: 'bob', role: 'editor', color: '#FF6B6B', lastActivity: 1 }],
        version: 0, locks: {},
      }));

      getLastWs().simulateMessage(makeMsg('role-change', { targetUserId: 2, role: 'viewer' }));
      expect(client.getActiveUsers()[0].role).toBe('viewer');
    });

    it('should emit role-changed event', () => {
      const client = createClient();
      const events: unknown[] = [];
      client.on('role-changed', (d) => events.push(d));
      client.connect();
      getLastWs().simulateOpen();

      getLastWs().simulateMessage(makeMsg('state-sync', { users: [], version: 0, locks: {} }));
      getLastWs().simulateMessage(makeMsg('role-change', { targetUserId: 5, role: 'editor' }));

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ userId: 5, role: 'editor' });
    });

    it('should update myRole when own role changes', () => {
      const client = createClient();
      client.setUserId(1);
      client.connect();
      getLastWs().simulateOpen();

      getLastWs().simulateMessage(makeMsg('state-sync', {
        users: [{ userId: 1, username: 'me', role: 'editor', color: '#FF6B6B', lastActivity: 1 }],
        version: 0, locks: {},
      }));

      getLastWs().simulateMessage(makeMsg('role-change', { targetUserId: 1, role: 'viewer' }));
      expect(client.getMyRole()).toBe('viewer');
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Event system                                                     */
  /* ---------------------------------------------------------------- */

  describe('event system', () => {
    it('should support on/off', () => {
      const client = createClient();
      const calls: unknown[] = [];
      const listener = (data: unknown) => calls.push(data);

      client.on('error', listener as (data: Error) => void);
      client.connect();
      getLastWs().simulateOpen();
      getLastWs().simulateMessage(makeMsg('error', { error: 'test' }));
      expect(calls).toHaveLength(1);

      client.off('error', listener as (data: Error) => void);
      getLastWs().simulateMessage(makeMsg('error', { error: 'test2' }));
      expect(calls).toHaveLength(1);
    });

    it('should return unsubscribe function from on()', () => {
      const client = createClient();
      const calls: unknown[] = [];
      const unsub = client.on('error', (e) => calls.push(e));

      client.connect();
      getLastWs().simulateOpen();
      getLastWs().simulateMessage(makeMsg('error', { error: 'a' }));
      expect(calls).toHaveLength(1);

      unsub();
      getLastWs().simulateMessage(makeMsg('error', { error: 'b' }));
      expect(calls).toHaveLength(1);
    });

    it('should handle multiple listeners on same event', () => {
      const client = createClient();
      const a: unknown[] = [];
      const b: unknown[] = [];
      client.on('error', (e) => a.push(e));
      client.on('error', (e) => b.push(e));

      client.connect();
      getLastWs().simulateOpen();
      getLastWs().simulateMessage(makeMsg('error', { error: 'x' }));
      expect(a).toHaveLength(1);
      expect(b).toHaveLength(1);
    });

    it('should not crash if listener throws', () => {
      const client = createClient();
      client.on('error', () => { throw new Error('boom'); });
      client.on('error', () => { /* no-op */ });

      client.connect();
      getLastWs().simulateOpen();
      // Should not throw
      expect(() => {
        getLastWs().simulateMessage(makeMsg('error', { error: 'test' }));
      }).not.toThrow();
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Edge cases                                                       */
  /* ---------------------------------------------------------------- */

  describe('edge cases', () => {
    it('should ignore invalid JSON messages', () => {
      const client = createClient();
      client.connect();
      getLastWs().simulateOpen();

      expect(() => {
        getLastWs().onmessage?.({ data: 'not json at all' });
      }).not.toThrow();
    });

    it('should ignore messages missing required fields', () => {
      const client = createClient();
      client.connect();
      getLastWs().simulateOpen();

      expect(() => {
        getLastWs().onmessage?.({ data: JSON.stringify({ type: 'join' }) });
      }).not.toThrow();
    });

    it('should not send messages when disconnected', () => {
      const client = createClient();
      client.sendCursorPosition(10, 20, 'test');
      vi.advanceTimersByTime(50);
      // No crash
    });

    it('should emit cursor-move from server', () => {
      const client = createClient();
      const events: unknown[] = [];
      client.on('cursor-move', (d) => events.push(d));
      client.connect();
      getLastWs().simulateOpen();

      getLastWs().simulateMessage(makeMsg('cursor-move', { cursor: { x: 100, y: 200, view: 'pcb' } }, 5));
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ userId: 5, cursor: { x: 100, y: 200, view: 'pcb' } });
    });

    it('should handle lock-denied event emission', () => {
      const client = createClient();
      const events: unknown[] = [];
      client.on('lock-denied', (d) => events.push(d));
      client.connect();
      getLastWs().simulateOpen();

      getLastWs().simulateMessage(makeMsg('lock-denied', { entityKey: '1:node:n1', heldBy: 7 }));
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ entityKey: '1:node:n1', heldBy: 7 });
    });

    it('should emit lock-released event', () => {
      const client = createClient();
      const events: unknown[] = [];
      client.on('lock-released', (d) => events.push(d));
      client.connect();
      getLastWs().simulateOpen();

      getLastWs().simulateMessage(makeMsg('lock-released', { entityKey: '1:edge:e1' }));
      expect(events).toHaveLength(1);
    });

    it('should emit lock-granted event', () => {
      const client = createClient();
      const events: unknown[] = [];
      client.on('lock-granted', (d) => events.push(d));
      client.connect();
      getLastWs().simulateOpen();

      getLastWs().simulateMessage(makeMsg('lock-granted', { entityKey: '1:wire:w1', userId: 3 }, 3));
      expect(events).toHaveLength(1);
    });

    it('setUserId should update internal userId', () => {
      const client = createClient();
      client.setUserId(42);
      client.connect();
      const ws = getLastWs();
      ws.simulateOpen();

      client.sendSelectionChange('node', ['a']);
      const parsed = JSON.parse(ws.sent[0]) as CollabMessage;
      expect(parsed.userId).toBe(42);
    });

    it('getMyRole should return current role', () => {
      const client = createClient();
      expect(client.getMyRole()).toBe('viewer'); // default
    });
  });

  /* ---------------------------------------------------------------- */
  /*  BL-0524: Conflict handling                                        */
  /* ---------------------------------------------------------------- */

  describe('conflicts', () => {
    function connected(): { client: CollaborationClient; ws: MockWebSocket } {
      const client = new CollaborationClient(1, 'sess');
      client.setUserId(42);
      client.connect();
      const ws = getLastWs();
      ws.simulateOpen();
      return { client, ws };
    }

    it('stores incoming conflicts and emits conflicts-change', () => {
      const { client, ws } = connected();
      const handler = vi.fn();
      client.on('conflicts-change', handler);

      const conflict = {
        id: 'c1', projectId: 1, kind: 'lww-update', path: ['nodes'], key: 'n1',
        yourOp: { op: 'update', path: ['nodes'], key: 'n1', value: { label: 'mine' }, timestamp: 5, clientId: 42 },
        theirOp: { op: 'update', path: ['nodes'], key: 'n1', value: { label: 'theirs' }, timestamp: 10, clientId: 2 },
        detectedAt: 10,
      };

      ws.simulateMessage({
        type: 'conflict-detected',
        userId: 42,
        projectId: 1,
        timestamp: Date.now(),
        payload: { conflicts: [conflict] },
      });

      expect(client.getPendingConflicts()).toHaveLength(1);
      expect(client.getPendingConflicts()[0].id).toBe('c1');
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('resolveConflict mine resends the losing op without server-assigned timestamps', () => {
      const { client, ws } = connected();
      ws.simulateMessage({
        type: 'conflict-detected',
        userId: 42, projectId: 1, timestamp: Date.now(),
        payload: { conflicts: [{
          id: 'c1', projectId: 1, kind: 'lww-update', path: ['nodes'], key: 'n1',
          yourOp: { op: 'update', path: ['nodes'], key: 'n1', value: { label: 'mine' }, timestamp: 5, clientId: 42 },
          theirOp: { op: 'update', path: ['nodes'], key: 'n1', value: { label: 'theirs' }, timestamp: 10, clientId: 2 },
          detectedAt: 10,
        }] },
      });

      client.resolveConflict('c1', 'mine');

      // Last sent message should be a state-update with the loser's op, no timestamp/clientId
      const sent = ws.sent.map((s) => JSON.parse(s) as CollabMessage);
      const stateUpdate = sent.find((m) => m.type === 'state-update');
      expect(stateUpdate).toBeDefined();
      const ops = (stateUpdate?.payload.operations as unknown[]) ?? [];
      expect(ops).toHaveLength(1);
      expect((ops[0] as Record<string, unknown>).timestamp).toBeUndefined();
      expect((ops[0] as Record<string, unknown>).clientId).toBeUndefined();
      expect(client.getPendingConflicts()).toHaveLength(0);
    });

    it('resolveConflict theirs removes the conflict without sending anything', () => {
      const { client, ws } = connected();
      ws.simulateMessage({
        type: 'conflict-detected',
        userId: 42, projectId: 1, timestamp: Date.now(),
        payload: { conflicts: [{
          id: 'c1', projectId: 1, kind: 'lww-update', path: ['nodes'], key: 'n1',
          yourOp: { op: 'update', path: ['nodes'], key: 'n1', value: { label: 'mine' } },
          theirOp: { op: 'update', path: ['nodes'], key: 'n1', value: { label: 'theirs' } },
          detectedAt: 10,
        }] },
      });
      const sentBefore = ws.sent.length;
      client.resolveConflict('c1', 'theirs');
      expect(ws.sent.length).toBe(sentBefore);
      expect(client.getPendingConflicts()).toHaveLength(0);
    });

    it('resolveConflict merge sends a fresh update with the custom value', () => {
      const { client, ws } = connected();
      ws.simulateMessage({
        type: 'conflict-detected',
        userId: 42, projectId: 1, timestamp: Date.now(),
        payload: { conflicts: [{
          id: 'c1', projectId: 1, kind: 'lww-update', path: ['nodes'], key: 'n1',
          yourOp: { op: 'update', path: ['nodes'], key: 'n1', value: { label: 'mine' } },
          theirOp: { op: 'update', path: ['nodes'], key: 'n1', value: { label: 'theirs' } },
          detectedAt: 10,
        }] },
      });

      client.resolveConflict('c1', 'merge', { label: 'combined' });
      const sent = ws.sent.map((s) => JSON.parse(s) as CollabMessage);
      const update = sent.find((m) => m.type === 'state-update');
      const ops = (update?.payload.operations as unknown[]) ?? [];
      const op0 = ops[0] as Record<string, unknown>;
      expect(op0.op).toBe('update');
      expect(op0.key).toBe('n1');
      expect(op0.value).toEqual({ label: 'combined' });
    });
  });
});
