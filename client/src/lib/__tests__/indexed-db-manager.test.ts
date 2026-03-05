/**
 * IndexedDB Manager Tests
 *
 * Uses a manual IDBFactory mock since fake-indexeddb is not installed.
 * Tests CRUD operations, queue management, storage estimation, and error handling.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IndexedDbManager } from '@/lib/indexed-db-manager';

import type { CachedAsset } from '@/lib/indexed-db-manager';

// ---------------------------------------------------------------------------
// Minimal in-memory IndexedDB mock
// ---------------------------------------------------------------------------

interface MockStore {
  keyPath: string | null;
  autoIncrement: boolean;
  data: Map<string | number, unknown>;
  indexes: Map<string, { keyPath: string; unique: boolean }>;
  autoKey: number;
}

function createMockIDB(): {
  factory: IDBFactory;
  stores: Map<string, MockStore>;
} {
  const stores = new Map<string, MockStore>();
  let dbInstance: Partial<IDBDatabase> | null = null;

  function makeRequest<T>(result: T, error: DOMException | null = null): IDBRequest<T> {
    const req = {
      result,
      error,
      readyState: 'done' as IDBRequestReadyState,
      onsuccess: null as ((ev: Event) => void) | null,
      onerror: null as ((ev: Event) => void) | null,
      source: null,
      transaction: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as IDBRequest<T>;

    queueMicrotask(() => {
      const event = { target: req } as unknown as Event;
      if (error && req.onerror) {
        req.onerror(event);
      } else if (req.onsuccess) {
        req.onsuccess(event);
      }
    });

    return req;
  }

  function makeObjectStore(store: MockStore): IDBObjectStore {
    return {
      put(value: unknown): IDBRequest<IDBValidKey> {
        let key: string | number;
        const rec = value as Record<string, unknown>;
        if (store.keyPath && rec[store.keyPath] != null) {
          key = rec[store.keyPath] as string | number;
        } else if (store.autoIncrement) {
          key = ++store.autoKey;
          if (store.keyPath) {
            rec[store.keyPath] = key;
          }
        } else {
          key = 0;
        }
        store.data.set(key, structuredClone(value));
        return makeRequest(key as IDBValidKey);
      },
      add(value: unknown): IDBRequest<IDBValidKey> {
        let key: string | number;
        const rec = value as Record<string, unknown>;
        if (store.keyPath && rec[store.keyPath] != null) {
          key = rec[store.keyPath] as string | number;
        } else if (store.autoIncrement) {
          key = ++store.autoKey;
          if (store.keyPath) {
            rec[store.keyPath] = key;
          }
        } else {
          key = 0;
        }
        store.data.set(key, structuredClone(value));
        return makeRequest(key as IDBValidKey);
      },
      get(key: IDBValidKey): IDBRequest {
        const val = store.data.get(key as string | number);
        return makeRequest(val ? structuredClone(val) : undefined);
      },
      getAll(): IDBRequest {
        const all = Array.from(store.data.values()).map((v) => structuredClone(v));
        return makeRequest(all);
      },
      delete(key: IDBValidKey): IDBRequest<undefined> {
        store.data.delete(key as string | number);
        return makeRequest(undefined);
      },
      createIndex(name: string, keyPath: string, options?: IDBIndexParameters) {
        store.indexes.set(name, { keyPath, unique: options?.unique ?? false });
        return {} as IDBIndex;
      },
      name: '',
      keyPath: store.keyPath,
      indexNames: { length: 0 } as DOMStringList,
      transaction: {} as IDBTransaction,
      autoIncrement: store.autoIncrement,
      count: vi.fn(),
      clear: vi.fn(),
      index: vi.fn(),
      openCursor: vi.fn(),
      openKeyCursor: vi.fn(),
      getAllKeys: vi.fn(),
      getKey: vi.fn(),
      deleteIndex: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as IDBObjectStore;
  }

  function makeDb(): Partial<IDBDatabase> {
    const db: Partial<IDBDatabase> = {
      objectStoreNames: {
        contains: (name: string) => stores.has(name),
        length: 0,
      } as DOMStringList,
      createObjectStore(name: string, options?: IDBObjectStoreParameters): IDBObjectStore {
        const store: MockStore = {
          keyPath: (options?.keyPath as string) ?? null,
          autoIncrement: options?.autoIncrement ?? false,
          data: new Map(),
          indexes: new Map(),
          autoKey: 0,
        };
        stores.set(name, store);
        return makeObjectStore(store);
      },
      transaction(storeNames: string | string[]): IDBTransaction {
        const name = Array.isArray(storeNames) ? storeNames[0] : storeNames;
        return {
          objectStore: (storeName: string) => {
            const store = stores.get(storeName ?? name);
            if (!store) {
              throw new Error(`Store not found: ${storeName}`);
            }
            return makeObjectStore(store);
          },
        } as unknown as IDBTransaction;
      },
      close: vi.fn(),
    };

    dbInstance = db;
    return db;
  }

  const factory = {
    open(_name: string, _version?: number): IDBOpenDBRequest {
      if (dbInstance) {
        // DB already opened — return request that resolves to existing instance
        const req = makeRequest(dbInstance as IDBDatabase) as IDBOpenDBRequest;
        return req;
      }

      // First open — create DB and fire onupgradeneeded then onsuccess
      const db = makeDb();

      // Build the request object with result already set
      const req = {
        result: db as IDBDatabase,
        error: null,
        readyState: 'done' as IDBRequestReadyState,
        onupgradeneeded: null as ((ev: IDBVersionChangeEvent) => void) | null,
        onsuccess: null as ((ev: Event) => void) | null,
        onerror: null as ((ev: Event) => void) | null,
        source: null,
        transaction: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as unknown as IDBOpenDBRequest;

      // Schedule: wait for handlers to be set, then fire upgrade → success
      queueMicrotask(() => {
        const event = { target: req } as unknown as Event;
        if (req.onupgradeneeded) {
          req.onupgradeneeded(event as unknown as IDBVersionChangeEvent);
        }
        queueMicrotask(() => {
          if (req.onsuccess) {
            req.onsuccess(event);
          }
        });
      });

      return req;
    },
    deleteDatabase(_name: string): IDBOpenDBRequest {
      stores.clear();
      dbInstance = null;
      const req = {
        result: undefined as unknown as IDBDatabase,
        error: null,
        readyState: 'done' as IDBRequestReadyState,
        onsuccess: null as ((ev: Event) => void) | null,
        onerror: null as ((ev: Event) => void) | null,
        source: null,
        transaction: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as unknown as IDBOpenDBRequest;

      queueMicrotask(() => {
        if (req.onsuccess) {
          req.onsuccess({ target: req } as unknown as Event);
        }
      });

      return req;
    },
    cmp: vi.fn(),
    databases: vi.fn(),
  } as unknown as IDBFactory;

  return { factory, stores };
}

// ---------------------------------------------------------------------------
// Test Setup
// ---------------------------------------------------------------------------

let mockIDB: ReturnType<typeof createMockIDB>;

beforeEach(() => {
  IndexedDbManager.resetForTesting();
  mockIDB = createMockIDB();
  vi.stubGlobal('indexedDB', mockIDB.factory);
});

afterEach(() => {
  IndexedDbManager.resetForTesting();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IndexedDbManager', () => {
  describe('singleton', () => {
    it('returns the same instance', () => {
      const a = IndexedDbManager.getInstance();
      const b = IndexedDbManager.getInstance();
      expect(a).toBe(b);
    });

    it('resets for testing', () => {
      const a = IndexedDbManager.getInstance();
      IndexedDbManager.resetForTesting();
      const b = IndexedDbManager.getInstance();
      expect(a).not.toBe(b);
    });
  });

  describe('project snapshots', () => {
    it('saves and retrieves a project snapshot', async () => {
      const mgr = IndexedDbManager.getInstance();
      await mgr.saveProjectSnapshot(1, {
        name: 'Test Project',
        data: { nodes: [] },
        version: 1,
      });

      const snapshot = await mgr.getProjectSnapshot(1);
      expect(snapshot).not.toBeNull();
      expect(snapshot!.projectId).toBe(1);
      expect(snapshot!.name).toBe('Test Project');
      expect(snapshot!.data).toEqual({ nodes: [] });
      expect(snapshot!.cachedAt).toBeGreaterThan(0);
    });

    it('returns null for non-existent project', async () => {
      const mgr = IndexedDbManager.getInstance();
      const snapshot = await mgr.getProjectSnapshot(999);
      expect(snapshot).toBeNull();
    });

    it('overwrites existing snapshot', async () => {
      const mgr = IndexedDbManager.getInstance();
      await mgr.saveProjectSnapshot(1, { name: 'V1', data: {}, version: 1 });
      await mgr.saveProjectSnapshot(1, { name: 'V2', data: { updated: true }, version: 2 });

      const snapshot = await mgr.getProjectSnapshot(1);
      expect(snapshot!.name).toBe('V2');
      expect(snapshot!.version).toBe(2);
    });

    it('lists cached projects', async () => {
      const mgr = IndexedDbManager.getInstance();
      await mgr.saveProjectSnapshot(1, { name: 'Project A', data: {}, version: 1 });
      await mgr.saveProjectSnapshot(2, { name: 'Project B', data: {}, version: 1 });

      const list = await mgr.listCachedProjects();
      expect(list).toHaveLength(2);
      expect(list.map((p) => p.name).sort()).toEqual(['Project A', 'Project B']);
    });

    it('deletes a project snapshot', async () => {
      const mgr = IndexedDbManager.getInstance();
      await mgr.saveProjectSnapshot(1, { name: 'To Delete', data: {}, version: 1 });
      await mgr.deleteProjectSnapshot(1);

      const snapshot = await mgr.getProjectSnapshot(1);
      expect(snapshot).toBeNull();
    });

    it('sets cachedAt timestamp', async () => {
      const mgr = IndexedDbManager.getInstance();
      const before = Date.now();
      await mgr.saveProjectSnapshot(1, { name: 'Timed', data: {}, version: 1 });
      const after = Date.now();

      const snapshot = await mgr.getProjectSnapshot(1);
      expect(snapshot!.cachedAt).toBeGreaterThanOrEqual(before);
      expect(snapshot!.cachedAt).toBeLessThanOrEqual(after);
    });
  });

  describe('pending changes', () => {
    it('queues a change and returns an id', async () => {
      const mgr = IndexedDbManager.getInstance();
      const id = await mgr.queueChange({
        type: 'create',
        entity: 'bom-item',
        entityId: '42',
        data: { name: 'Resistor' },
        timestamp: Date.now(),
      });

      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('retrieves pending changes', async () => {
      const mgr = IndexedDbManager.getInstance();
      await mgr.queueChange({
        type: 'update',
        entity: 'node',
        entityId: '1',
        data: { label: 'MCU' },
        timestamp: Date.now(),
      });

      const pending = await mgr.getPendingChanges();
      expect(pending).toHaveLength(1);
      expect(pending[0].entity).toBe('node');
      expect(pending[0].synced).toBe(false);
    });

    it('marks changes as synced', async () => {
      const mgr = IndexedDbManager.getInstance();
      const id1 = await mgr.queueChange({
        type: 'create',
        entity: 'node',
        entityId: '1',
        data: {},
        timestamp: Date.now(),
      });
      const id2 = await mgr.queueChange({
        type: 'create',
        entity: 'node',
        entityId: '2',
        data: {},
        timestamp: Date.now(),
      });

      await mgr.markChangesSynced([id1]);

      const pending = await mgr.getPendingChanges();
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe(id2);
    });

    it('marks a change as failed', async () => {
      const mgr = IndexedDbManager.getInstance();
      const id = await mgr.queueChange({
        type: 'update',
        entity: 'bom-item',
        entityId: '5',
        data: {},
        timestamp: Date.now(),
      });

      await mgr.markChangeFailed(id, 'Network error');

      const all = await mgr.getAllChanges();
      const change = all.find((c) => c.id === id);
      expect(change!.syncError).toBe('Network error');
      expect(change!.retryCount).toBe(1);
    });

    it('increments retryCount on repeated failures', async () => {
      const mgr = IndexedDbManager.getInstance();
      const id = await mgr.queueChange({
        type: 'update',
        entity: 'node',
        entityId: '1',
        data: {},
        timestamp: Date.now(),
      });

      await mgr.markChangeFailed(id, 'err1');
      await mgr.markChangeFailed(id, 'err2');

      const all = await mgr.getAllChanges();
      const change = all.find((c) => c.id === id);
      expect(change!.retryCount).toBe(2);
    });

    it('clears synced changes', async () => {
      const mgr = IndexedDbManager.getInstance();
      const id1 = await mgr.queueChange({
        type: 'create',
        entity: 'node',
        entityId: '1',
        data: {},
        timestamp: Date.now(),
      });
      await mgr.queueChange({
        type: 'create',
        entity: 'node',
        entityId: '2',
        data: {},
        timestamp: Date.now(),
      });

      await mgr.markChangesSynced([id1]);
      await mgr.clearSyncedChanges();

      const all = await mgr.getAllChanges();
      expect(all).toHaveLength(1);
    });

    it('handles marking non-existent change as failed', async () => {
      const mgr = IndexedDbManager.getInstance();
      // Should not throw
      await mgr.markChangeFailed('nonexistent-id', 'error');
    });

    it('queues multiple changes for different entities', async () => {
      const mgr = IndexedDbManager.getInstance();
      await mgr.queueChange({ type: 'create', entity: 'node', entityId: '1', data: {}, timestamp: 1 });
      await mgr.queueChange({ type: 'update', entity: 'bom-item', entityId: '2', data: {}, timestamp: 2 });
      await mgr.queueChange({ type: 'delete', entity: 'edge', entityId: '3', data: {}, timestamp: 3 });

      const pending = await mgr.getPendingChanges();
      expect(pending).toHaveLength(3);
    });
  });

  describe('sync log', () => {
    it('adds and retrieves sync log entries', async () => {
      const mgr = IndexedDbManager.getInstance();
      await mgr.addSyncLog({ timestamp: 1000, action: 'create:node:1', result: 'success' });
      await mgr.addSyncLog({ timestamp: 2000, action: 'update:bom:2', result: 'error', details: 'timeout' });

      const log = await mgr.getSyncLog();
      expect(log).toHaveLength(2);
      // Sorted newest first
      expect(log[0].timestamp).toBe(2000);
      expect(log[1].timestamp).toBe(1000);
    });

    it('limits returned entries', async () => {
      const mgr = IndexedDbManager.getInstance();
      for (let i = 0; i < 10; i++) {
        await mgr.addSyncLog({ timestamp: i, action: `action-${i}`, result: 'success' });
      }

      const log = await mgr.getSyncLog(3);
      expect(log).toHaveLength(3);
    });

    it('stores optional details field', async () => {
      const mgr = IndexedDbManager.getInstance();
      await mgr.addSyncLog({
        timestamp: Date.now(),
        action: 'update:project:1',
        result: 'conflict',
        details: 'ETag mismatch',
      });

      const log = await mgr.getSyncLog();
      expect(log[0].details).toBe('ETag mismatch');
    });
  });

  describe('cached assets', () => {
    it('saves and retrieves a cached asset', async () => {
      const mgr = IndexedDbManager.getInstance();
      const asset: CachedAsset = {
        url: '/images/logo.png',
        data: 'base64data',
        cachedAt: Date.now(),
        size: 1024,
      };

      await mgr.saveCachedAsset(asset);
      const retrieved = await mgr.getCachedAsset('/images/logo.png');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.url).toBe('/images/logo.png');
      expect(retrieved!.size).toBe(1024);
    });

    it('returns null for non-existent asset', async () => {
      const mgr = IndexedDbManager.getInstance();
      const asset = await mgr.getCachedAsset('/missing.png');
      expect(asset).toBeNull();
    });

    it('overwrites existing asset', async () => {
      const mgr = IndexedDbManager.getInstance();
      await mgr.saveCachedAsset({ url: '/a.js', data: 'v1', cachedAt: 1, size: 10 });
      await mgr.saveCachedAsset({ url: '/a.js', data: 'v2', cachedAt: 2, size: 20 });

      const asset = await mgr.getCachedAsset('/a.js');
      expect(asset!.data).toBe('v2');
      expect(asset!.size).toBe(20);
    });

    it('deletes a cached asset', async () => {
      const mgr = IndexedDbManager.getInstance();
      await mgr.saveCachedAsset({ url: '/to-delete.css', data: '', cachedAt: 1, size: 5 });
      await mgr.deleteCachedAsset('/to-delete.css');

      const asset = await mgr.getCachedAsset('/to-delete.css');
      expect(asset).toBeNull();
    });
  });

  describe('storage usage', () => {
    it('returns storage estimate from navigator.storage', async () => {
      vi.stubGlobal('navigator', {
        ...navigator,
        storage: {
          estimate: vi.fn().mockResolvedValue({ usage: 5000, quota: 100000 }),
        },
      });

      const mgr = IndexedDbManager.getInstance();
      const usage = await mgr.getStorageUsage();
      expect(usage.used).toBe(5000);
      expect(usage.quota).toBe(100000);
      expect(usage.percentage).toBe(5);
    });

    it('returns zeros when storage API unavailable', async () => {
      vi.stubGlobal('navigator', {});

      const mgr = IndexedDbManager.getInstance();
      const usage = await mgr.getStorageUsage();
      expect(usage.used).toBe(0);
      expect(usage.quota).toBe(0);
      expect(usage.percentage).toBe(0);
    });
  });

  describe('clearAll', () => {
    it('deletes the entire database', async () => {
      const mgr = IndexedDbManager.getInstance();
      await mgr.saveProjectSnapshot(1, { name: 'Test', data: {}, version: 1 });
      await mgr.clearAll();

      // After clearing, stores should be empty
      // Re-opening will create fresh stores
      const snapshot = await mgr.getProjectSnapshot(1);
      expect(snapshot).toBeNull();
    });
  });

  describe('error handling', () => {
    it('rejects when indexedDB is not available', async () => {
      IndexedDbManager.resetForTesting();
      vi.stubGlobal('indexedDB', undefined);

      const mgr = IndexedDbManager.getInstance();
      await expect(mgr.getProjectSnapshot(1)).rejects.toThrow('IndexedDB is not available');
    });
  });
});
