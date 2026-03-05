/**
 * Offline Sync Orchestrator Tests
 *
 * Tests mutation interception, sync flow, conflict detection, exponential backoff,
 * batch optimization, and event emission.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IndexedDbManager } from '@/lib/indexed-db-manager';
import { OfflineSyncManager } from '@/lib/offline-sync';
import { PwaManager } from '@/lib/pwa-manager';

import type { SyncResult } from '@/lib/offline-sync';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/pwa-manager', () => {
  let online = true;
  const connectionCallbacks = new Set<(status: string) => void>();

  const instance = {
    isOnline: () => online,
    setOnline: (val: boolean) => { online = val; },
    onConnectionChange: (cb: (status: string) => void) => {
      connectionCallbacks.add(cb);
      return () => { connectionCallbacks.delete(cb); };
    },
    getConnectionStatus: () => online ? 'online' : 'offline',
    triggerConnectionChange: (status: string) => {
      online = status === 'online';
      connectionCallbacks.forEach((cb) => { cb(status); });
    },
  };

  return {
    PwaManager: {
      getInstance: () => instance,
      resetForTesting: () => { online = true; connectionCallbacks.clear(); },
    },
  };
});

vi.mock('@/lib/indexed-db-manager', () => {
  let changes: Array<{
    id: string;
    type: string;
    entity: string;
    entityId: string;
    data: Record<string, unknown>;
    timestamp: number;
    synced: boolean;
    syncError?: string;
    retryCount: number;
  }> = [];
  const syncLog: Array<{ timestamp: number; action: string; result: string; details?: string }> = [];

  const instance = {
    queueChange: vi.fn(async (change: Record<string, unknown>) => {
      const id = `mock-${Math.random().toString(36).slice(2)}`;
      changes.push({
        id,
        type: change.type as string,
        entity: change.entity as string,
        entityId: change.entityId as string,
        data: (change.data as Record<string, unknown>) ?? {},
        timestamp: (change.timestamp as number) ?? Date.now(),
        synced: false,
        retryCount: 0,
      });
      return id;
    }),
    getPendingChanges: vi.fn(async () => changes.filter((c) => !c.synced)),
    getAllChanges: vi.fn(async () => [...changes]),
    markChangesSynced: vi.fn(async (ids: string[]) => {
      const idSet = new Set(ids);
      changes = changes.map((c) =>
        idSet.has(c.id) ? { ...c, synced: true, syncError: undefined } : c,
      );
    }),
    markChangeFailed: vi.fn(async (id: string, error: string) => {
      changes = changes.map((c) =>
        c.id === id ? { ...c, syncError: error, retryCount: c.retryCount + 1 } : c,
      );
    }),
    addSyncLog: vi.fn(async (entry: { timestamp: number; action: string; result: string; details?: string }) => {
      syncLog.push(entry);
    }),
    clearSyncedChanges: vi.fn(async () => {
      changes = changes.filter((c) => !c.synced);
    }),
    _reset: () => {
      changes = [];
      syncLog.length = 0;
      instance.queueChange.mockClear();
      instance.getPendingChanges.mockClear();
      instance.getAllChanges.mockClear();
      instance.markChangesSynced.mockClear();
      instance.markChangeFailed.mockClear();
      instance.addSyncLog.mockClear();
      instance.clearSyncedChanges.mockClear();
    },
    _getChanges: () => changes,
    _getSyncLog: () => syncLog,
  };

  return {
    IndexedDbManager: {
      getInstance: () => instance,
      resetForTesting: vi.fn(),
    },
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPwaInstance(): ReturnType<typeof PwaManager.getInstance> & {
  setOnline: (val: boolean) => void;
  triggerConnectionChange: (status: string) => void;
} {
  return PwaManager.getInstance() as ReturnType<typeof PwaManager.getInstance> & {
    setOnline: (val: boolean) => void;
    triggerConnectionChange: (status: string) => void;
  };
}

function getDbInstance(): ReturnType<typeof IndexedDbManager.getInstance> & {
  _reset: () => void;
  _getChanges: () => Array<Record<string, unknown>>;
  _getSyncLog: () => Array<Record<string, unknown>>;
} {
  return IndexedDbManager.getInstance() as ReturnType<typeof IndexedDbManager.getInstance> & {
    _reset: () => void;
    _getChanges: () => Array<Record<string, unknown>>;
    _getSyncLog: () => Array<Record<string, unknown>>;
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  OfflineSyncManager.resetForTesting();
  (PwaManager as unknown as { resetForTesting: () => void }).resetForTesting();
  getDbInstance()._reset();

  fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  OfflineSyncManager.resetForTesting();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OfflineSyncManager', () => {
  describe('singleton', () => {
    it('returns the same instance', () => {
      const a = OfflineSyncManager.getInstance();
      const b = OfflineSyncManager.getInstance();
      expect(a).toBe(b);
    });

    it('resets for testing', () => {
      const a = OfflineSyncManager.getInstance();
      OfflineSyncManager.resetForTesting();
      const b = OfflineSyncManager.getInstance();
      expect(a).not.toBe(b);
    });
  });

  describe('interceptMutation', () => {
    it('queues change when offline', async () => {
      const pwa = getPwaInstance();
      pwa.setOnline(false);
      const db = getDbInstance();

      const mgr = OfflineSyncManager.getInstance();
      await mgr.interceptMutation({
        type: 'create',
        entity: 'node',
        entityId: '1',
        data: { label: 'MCU' },
        timestamp: Date.now(),
      });

      expect(db.queueChange).toHaveBeenCalledTimes(1);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sends directly when online', async () => {
      const pwa = getPwaInstance();
      pwa.setOnline(true);

      const mgr = OfflineSyncManager.getInstance();
      await mgr.interceptMutation({
        type: 'update',
        entity: 'bom-item',
        entityId: '5',
        data: { name: 'Resistor' },
        timestamp: Date.now(),
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('queues on network failure even when online', async () => {
      const pwa = getPwaInstance();
      pwa.setOnline(true);
      fetchMock.mockRejectedValueOnce(new Error('Network failure'));
      const db = getDbInstance();

      const mgr = OfflineSyncManager.getInstance();
      await mgr.interceptMutation({
        type: 'create',
        entity: 'node',
        entityId: '2',
        data: {},
        timestamp: Date.now(),
      });

      expect(db.queueChange).toHaveBeenCalledTimes(1);
    });

    it('sends correct HTTP method for create', async () => {
      const mgr = OfflineSyncManager.getInstance();
      await mgr.interceptMutation({
        type: 'create',
        entity: 'node',
        entityId: '1',
        data: { label: 'New' },
        timestamp: Date.now(),
      });

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/node/1',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('sends correct HTTP method for update', async () => {
      const mgr = OfflineSyncManager.getInstance();
      await mgr.interceptMutation({
        type: 'update',
        entity: 'bom-item',
        entityId: '3',
        data: { qty: 10 },
        timestamp: Date.now(),
      });

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/bom-item/3',
        expect.objectContaining({ method: 'PUT' }),
      );
    });

    it('sends correct HTTP method for delete', async () => {
      const mgr = OfflineSyncManager.getInstance();
      await mgr.interceptMutation({
        type: 'delete',
        entity: 'edge',
        entityId: '7',
        data: {},
        timestamp: Date.now(),
      });

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/edge/7',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('includes If-Match header when _etag present', async () => {
      const mgr = OfflineSyncManager.getInstance();
      await mgr.interceptMutation({
        type: 'update',
        entity: 'node',
        entityId: '1',
        data: { label: 'Updated', _etag: 'abc123' },
        timestamp: Date.now(),
      });

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/node/1',
        expect.objectContaining({
          headers: expect.objectContaining({ 'If-Match': 'abc123' }),
        }),
      );
    });
  });

  describe('syncPendingChanges', () => {
    it('syncs all pending changes', async () => {
      const db = getDbInstance();
      await db.queueChange({ type: 'create', entity: 'node', entityId: '1', data: {}, timestamp: 1 });
      await db.queueChange({ type: 'update', entity: 'node', entityId: '2', data: {}, timestamp: 2 });

      const mgr = OfflineSyncManager.getInstance();
      const result = await mgr.syncPendingChanges();

      expect(result.synced).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.conflicts).toBe(0);
    });

    it('returns empty result when no pending changes', async () => {
      const mgr = OfflineSyncManager.getInstance();
      const result = await mgr.syncPendingChanges();

      expect(result.synced).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('handles network errors during sync', async () => {
      const db = getDbInstance();
      await db.queueChange({ type: 'create', entity: 'node', entityId: '1', data: {}, timestamp: 1 });

      fetchMock.mockRejectedValueOnce(new Error('Timeout'));

      const mgr = OfflineSyncManager.getInstance();
      const result = await mgr.syncPendingChanges();

      expect(result.failed).toBe(1);
      expect(db.markChangeFailed).toHaveBeenCalled();
    });

    it('detects 409 conflict', async () => {
      const db = getDbInstance();
      await db.queueChange({ type: 'update', entity: 'node', entityId: '1', data: { label: 'Local' }, timestamp: 1 });

      const conflictError = new Error('HTTP 409') as Error & { status: number };
      conflictError.status = 409;
      fetchMock.mockRejectedValueOnce(conflictError);

      const mgr = OfflineSyncManager.getInstance();
      const result = await mgr.syncPendingChanges();

      expect(result.conflicts).toBe(1);
      expect(mgr.getConflicts()).toHaveLength(1);
    });

    it('detects 412 precondition failed as conflict', async () => {
      const db = getDbInstance();
      await db.queueChange({ type: 'update', entity: 'node', entityId: '1', data: {}, timestamp: 1 });

      const error = new Error('HTTP 412') as Error & { status: number };
      error.status = 412;
      fetchMock.mockRejectedValueOnce(error);

      const mgr = OfflineSyncManager.getInstance();
      const result = await mgr.syncPendingChanges();

      expect(result.conflicts).toBe(1);
    });

    it('skips changes that exceeded max retries', async () => {
      const db = getDbInstance();
      await db.queueChange({ type: 'update', entity: 'node', entityId: '1', data: {}, timestamp: 1 });

      // Manually set retryCount to max
      const changes = db._getChanges();
      (changes[0] as { retryCount: number }).retryCount = 10;

      const mgr = OfflineSyncManager.getInstance();
      const result = await mgr.syncPendingChanges();

      expect(result.failed).toBe(1);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('emits sync-complete event', async () => {
      const db = getDbInstance();
      await db.queueChange({ type: 'create', entity: 'node', entityId: '1', data: {}, timestamp: 1 });

      const mgr = OfflineSyncManager.getInstance();
      const completeSpy = vi.fn();
      mgr.on('sync-complete', completeSpy);

      await mgr.syncPendingChanges();

      expect(completeSpy).toHaveBeenCalledWith(
        expect.objectContaining({ synced: 1 }),
      );
    });

    it('emits conflict event on conflict detection', async () => {
      const db = getDbInstance();
      await db.queueChange({ type: 'update', entity: 'node', entityId: '1', data: {}, timestamp: 1 });

      const conflictError = new Error('HTTP 409') as Error & { status: number };
      conflictError.status = 409;
      fetchMock.mockRejectedValueOnce(conflictError);

      const mgr = OfflineSyncManager.getInstance();
      const conflictSpy = vi.fn();
      mgr.on('conflict', conflictSpy);

      await mgr.syncPendingChanges();

      expect(conflictSpy).toHaveBeenCalledTimes(1);
    });

    it('prevents concurrent sync calls', async () => {
      const db = getDbInstance();
      await db.queueChange({ type: 'create', entity: 'node', entityId: '1', data: {}, timestamp: 1 });

      // Make fetch slow
      fetchMock.mockImplementation(() => new Promise((resolve) => {
        setTimeout(() => { resolve({ ok: true, status: 200 }); }, 50);
      }));

      const mgr = OfflineSyncManager.getInstance();
      const [result1, result2] = await Promise.all([
        mgr.syncPendingChanges(),
        mgr.syncPendingChanges(),
      ]);

      // Second call should return empty since first is in progress
      expect(result2.synced).toBe(0);
    });

    it('batches changes to same entity', async () => {
      const db = getDbInstance();
      await db.queueChange({ type: 'update', entity: 'node', entityId: '1', data: { v: 1 }, timestamp: 1 });
      await db.queueChange({ type: 'update', entity: 'node', entityId: '1', data: { v: 2 }, timestamp: 2 });

      const mgr = OfflineSyncManager.getInstance();
      const result = await mgr.syncPendingChanges();

      // Should batch into single request (latest wins)
      expect(result.synced).toBe(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('delete wins over update in batching', async () => {
      const db = getDbInstance();
      await db.queueChange({ type: 'update', entity: 'node', entityId: '1', data: { v: 1 }, timestamp: 1 });
      await db.queueChange({ type: 'delete', entity: 'node', entityId: '1', data: {}, timestamp: 2 });

      const mgr = OfflineSyncManager.getInstance();
      await mgr.syncPendingChanges();

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/node/1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('logs sync operations', async () => {
      const db = getDbInstance();
      await db.queueChange({ type: 'create', entity: 'node', entityId: '1', data: {}, timestamp: 1 });

      const mgr = OfflineSyncManager.getInstance();
      await mgr.syncPendingChanges();

      expect(db.addSyncLog).toHaveBeenCalledWith(
        expect.objectContaining({ result: 'success' }),
      );
    });
  });

  describe('conflict resolution', () => {
    async function createConflict(): Promise<string> {
      const db = getDbInstance();
      await db.queueChange({
        type: 'update',
        entity: 'node',
        entityId: '1',
        data: { label: 'Local' },
        timestamp: 1,
      });

      const conflictError = new Error('HTTP 409') as Error & { status: number };
      conflictError.status = 409;
      fetchMock.mockRejectedValueOnce(conflictError);

      const mgr = OfflineSyncManager.getInstance();
      await mgr.syncPendingChanges();

      const conflicts = mgr.getConflicts();
      return conflicts[0].changeId;
    }

    it('resolves conflict with "remote" by discarding local', async () => {
      const changeId = await createConflict();
      const mgr = OfflineSyncManager.getInstance();
      const db = getDbInstance();

      await mgr.resolveConflict(changeId, 'remote');

      expect(db.markChangesSynced).toHaveBeenCalledWith([changeId]);
      expect(mgr.getConflicts()).toHaveLength(0);
    });

    it('resolves conflict with "local" by re-queueing', async () => {
      const changeId = await createConflict();
      const mgr = OfflineSyncManager.getInstance();
      const db = getDbInstance();

      await mgr.resolveConflict(changeId, 'local');

      expect(db.markChangesSynced).toHaveBeenCalledWith([changeId]);
      expect(db.queueChange).toHaveBeenCalled();
      expect(mgr.getConflicts()).toHaveLength(0);
    });

    it('resolves conflict with "merge" by re-queueing', async () => {
      const changeId = await createConflict();
      const mgr = OfflineSyncManager.getInstance();
      const db = getDbInstance();

      await mgr.resolveConflict(changeId, 'merge');

      expect(db.markChangesSynced).toHaveBeenCalledWith([changeId]);
      expect(db.queueChange).toHaveBeenCalled();
    });

    it('handles resolving non-existent conflict', async () => {
      const mgr = OfflineSyncManager.getInstance();
      // Should not throw
      await mgr.resolveConflict('nonexistent', 'remote');
    });
  });

  describe('sync status', () => {
    it('returns synced when no pending changes', () => {
      const mgr = OfflineSyncManager.getInstance();
      expect(mgr.getSyncStatus()).toBe('synced');
    });

    it('returns conflict when conflicts exist', async () => {
      const db = getDbInstance();
      await db.queueChange({ type: 'update', entity: 'node', entityId: '1', data: {}, timestamp: 1 });

      const conflictError = new Error('HTTP 409') as Error & { status: number };
      conflictError.status = 409;
      fetchMock.mockRejectedValueOnce(conflictError);

      const mgr = OfflineSyncManager.getInstance();
      await mgr.syncPendingChanges();

      expect(mgr.getSyncStatus()).toBe('conflict');
    });

    it('reports isSyncing correctly', async () => {
      const db = getDbInstance();
      await db.queueChange({ type: 'create', entity: 'node', entityId: '1', data: {}, timestamp: 1 });

      let syncingDuringFetch = false;
      fetchMock.mockImplementation(() => {
        const mgr = OfflineSyncManager.getInstance();
        syncingDuringFetch = mgr.isSyncing();
        return Promise.resolve({ ok: true, status: 200 });
      });

      const mgr = OfflineSyncManager.getInstance();
      await mgr.syncPendingChanges();

      expect(syncingDuringFetch).toBe(true);
      expect(mgr.isSyncing()).toBe(false);
    });
  });

  describe('event emitter', () => {
    it('supports multiple listeners', async () => {
      const db = getDbInstance();
      await db.queueChange({ type: 'create', entity: 'node', entityId: '1', data: {}, timestamp: 1 });

      const mgr = OfflineSyncManager.getInstance();
      const spy1 = vi.fn();
      const spy2 = vi.fn();
      mgr.on('sync-complete', spy1);
      mgr.on('sync-complete', spy2);

      await mgr.syncPendingChanges();

      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);
    });

    it('unsubscribes correctly', async () => {
      const db = getDbInstance();
      await db.queueChange({ type: 'create', entity: 'node', entityId: '1', data: {}, timestamp: 1 });

      const mgr = OfflineSyncManager.getInstance();
      const spy = vi.fn();
      const unsub = mgr.on('sync-complete', spy);
      unsub();

      await mgr.syncPendingChanges();

      expect(spy).not.toHaveBeenCalled();
    });

    it('emits error event on unexpected failure', async () => {
      const db = getDbInstance();
      (db.getPendingChanges as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('DB crash'));

      const mgr = OfflineSyncManager.getInstance();
      const errorSpy = vi.fn();
      mgr.on('error', errorSpy);

      await mgr.syncPendingChanges();

      expect(errorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('connection change auto-sync', () => {
    it('triggers sync when going online', async () => {
      const db = getDbInstance();
      const pwa = getPwaInstance();
      pwa.setOnline(false);

      await db.queueChange({ type: 'create', entity: 'node', entityId: '1', data: {}, timestamp: 1 });

      // Create instance (sets up listener)
      const mgr = OfflineSyncManager.getInstance();

      // Simulate going online
      pwa.triggerConnectionChange('online');

      // Give the async sync time to run
      await new Promise((resolve) => { setTimeout(resolve, 100); });

      // Fetch should have been called (sync triggered)
      expect(fetchMock).toHaveBeenCalled();
    });
  });
});
