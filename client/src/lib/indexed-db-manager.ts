/**
 * IndexedDB Manager — Offline Data Persistence Layer
 *
 * Wraps IndexedDB for storing project snapshots, pending offline changes,
 * sync logs, and cached assets. Singleton pattern matching PwaManager.
 *
 * Usage:
 *   const db = IndexedDbManager.getInstance();
 *   await db.saveProjectSnapshot(1, snapshot);
 *   const hook = useIndexedDb();
 */

import { useCallback, useEffect, useState } from 'react';

import type { OfflineChange } from '@/lib/pwa-manager';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProjectSnapshot {
  projectId: number;
  name: string;
  data: Record<string, unknown>;
  cachedAt: number;
  version: number;
}

export interface SyncLogEntry {
  id?: number;
  timestamp: number;
  action: string;
  result: 'success' | 'error' | 'conflict';
  details?: string;
}

export interface CachedAsset {
  url: string;
  data: string | ArrayBuffer;
  cachedAt: number;
  size: number;
}

export interface StorageUsage {
  used: number;
  quota: number;
  percentage: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DB_NAME = 'protopulse-offline';
const DB_VERSION = 1;

const STORES = {
  projects: 'projects',
  pendingChanges: 'pending-changes',
  syncLog: 'sync-log',
  cachedAssets: 'cached-assets',
} as const;

// ---------------------------------------------------------------------------
// IndexedDbManager
// ---------------------------------------------------------------------------

export class IndexedDbManager {
  private static instance: IndexedDbManager | null = null;
  private db: IDBDatabase | null = null;
  private openPromise: Promise<IDBDatabase> | null = null;

  /** Get or create the singleton instance. */
  static getInstance(): IndexedDbManager {
    if (!IndexedDbManager.instance) {
      IndexedDbManager.instance = new IndexedDbManager();
    }
    return IndexedDbManager.instance;
  }

  /** Reset the singleton (for testing). */
  static resetForTesting(): void {
    if (IndexedDbManager.instance?.db) {
      IndexedDbManager.instance.db.close();
    }
    IndexedDbManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Database Open
  // -----------------------------------------------------------------------

  private open(): Promise<IDBDatabase> {
    if (this.db) {
      return Promise.resolve(this.db);
    }
    if (this.openPromise) {
      return this.openPromise;
    }

    this.openPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not available'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORES.projects)) {
          db.createObjectStore(STORES.projects, { keyPath: 'projectId' });
        }

        if (!db.objectStoreNames.contains(STORES.pendingChanges)) {
          const store = db.createObjectStore(STORES.pendingChanges, {
            keyPath: 'id',
          });
          store.createIndex('by-synced', 'synced', { unique: false });
          store.createIndex('by-entity', 'entity', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.syncLog)) {
          db.createObjectStore(STORES.syncLog, {
            keyPath: 'id',
            autoIncrement: true,
          });
        }

        if (!db.objectStoreNames.contains(STORES.cachedAssets)) {
          db.createObjectStore(STORES.cachedAssets, { keyPath: 'url' });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        this.openPromise = null;
        resolve(this.db);
      };

      request.onerror = () => {
        this.openPromise = null;
        reject(new Error('Failed to open IndexedDB'));
      };
    });

    return this.openPromise;
  }

  // -----------------------------------------------------------------------
  // Transaction Helpers
  // -----------------------------------------------------------------------

  private async tx(
    storeName: string,
    mode: IDBTransactionMode,
  ): Promise<IDBObjectStore> {
    const db = await this.open();
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  private requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // -----------------------------------------------------------------------
  // Projects
  // -----------------------------------------------------------------------

  /** Save a full project snapshot for offline access. */
  async saveProjectSnapshot(
    projectId: number,
    snapshot: Omit<ProjectSnapshot, 'projectId' | 'cachedAt'>,
  ): Promise<void> {
    const store = await this.tx(STORES.projects, 'readwrite');
    const record: ProjectSnapshot = {
      ...snapshot,
      projectId,
      cachedAt: Date.now(),
    };
    await this.requestToPromise(store.put(record));
  }

  /** Get a project snapshot by ID. Returns null if not found. */
  async getProjectSnapshot(
    projectId: number,
  ): Promise<ProjectSnapshot | null> {
    const store = await this.tx(STORES.projects, 'readonly');
    const result = await this.requestToPromise(store.get(projectId));
    return (result as ProjectSnapshot | undefined) ?? null;
  }

  /** List all cached projects with summary info. */
  async listCachedProjects(): Promise<
    Array<{ id: number; name: string; cachedAt: number }>
  > {
    const store = await this.tx(STORES.projects, 'readonly');
    const all = await this.requestToPromise(store.getAll());
    return (all as ProjectSnapshot[]).map((p) => ({
      id: p.projectId,
      name: p.name,
      cachedAt: p.cachedAt,
    }));
  }

  /** Delete a project snapshot. */
  async deleteProjectSnapshot(projectId: number): Promise<void> {
    const store = await this.tx(STORES.projects, 'readwrite');
    await this.requestToPromise(store.delete(projectId));
  }

  // -----------------------------------------------------------------------
  // Pending Changes
  // -----------------------------------------------------------------------

  /** Queue an offline change. Returns the change ID. */
  async queueChange(
    change: Omit<OfflineChange, 'id' | 'synced' | 'retryCount'>,
  ): Promise<string> {
    const store = await this.tx(STORES.pendingChanges, 'readwrite');
    const fullChange: OfflineChange = {
      ...change,
      id: crypto.randomUUID(),
      synced: false,
      retryCount: 0,
    };
    await this.requestToPromise(store.put(fullChange));
    return fullChange.id;
  }

  /** Get all pending (unsynced) changes. */
  async getPendingChanges(): Promise<OfflineChange[]> {
    const store = await this.tx(STORES.pendingChanges, 'readonly');
    const all = await this.requestToPromise(store.getAll());
    return (all as OfflineChange[]).filter((c) => !c.synced);
  }

  /** Get all changes (including synced). */
  async getAllChanges(): Promise<OfflineChange[]> {
    const store = await this.tx(STORES.pendingChanges, 'readonly');
    const all = await this.requestToPromise(store.getAll());
    return all as OfflineChange[];
  }

  /** Mark specific changes as synced. */
  async markChangesSynced(ids: string[]): Promise<void> {
    const store = await this.tx(STORES.pendingChanges, 'readwrite');
    const idSet = new Set(ids);
    const all = await this.requestToPromise(store.getAll());
    const updates: Promise<IDBValidKey>[] = [];
    for (const change of all as OfflineChange[]) {
      if (idSet.has(change.id)) {
        change.synced = true;
        change.syncError = undefined;
        updates.push(this.requestToPromise(store.put(change)));
      }
    }
    await Promise.all(updates);
  }

  /** Mark a change as failed with an error message. */
  async markChangeFailed(id: string, error: string): Promise<void> {
    const store = await this.tx(STORES.pendingChanges, 'readwrite');
    const change = (await this.requestToPromise(store.get(id))) as
      | OfflineChange
      | undefined;
    if (change) {
      change.syncError = error;
      change.retryCount += 1;
      await this.requestToPromise(store.put(change));
    }
  }

  /** Remove all synced changes from the store. */
  async clearSyncedChanges(): Promise<void> {
    const store = await this.tx(STORES.pendingChanges, 'readwrite');
    const all = await this.requestToPromise(store.getAll());
    const deletes: Promise<undefined>[] = [];
    for (const change of all as OfflineChange[]) {
      if (change.synced) {
        deletes.push(this.requestToPromise(store.delete(change.id)));
      }
    }
    await Promise.all(deletes);
  }

  // -----------------------------------------------------------------------
  // Sync Log
  // -----------------------------------------------------------------------

  /** Add a sync log entry. */
  async addSyncLog(entry: Omit<SyncLogEntry, 'id'>): Promise<void> {
    const store = await this.tx(STORES.syncLog, 'readwrite');
    await this.requestToPromise(store.add(entry));
  }

  /** Get recent sync log entries (newest first, limited). */
  async getSyncLog(limit = 50): Promise<SyncLogEntry[]> {
    const store = await this.tx(STORES.syncLog, 'readonly');
    const all = await this.requestToPromise(store.getAll());
    const entries = all as SyncLogEntry[];
    entries.sort((a, b) => b.timestamp - a.timestamp);
    return entries.slice(0, limit);
  }

  // -----------------------------------------------------------------------
  // Cached Assets
  // -----------------------------------------------------------------------

  /** Save a cached asset. */
  async saveCachedAsset(asset: CachedAsset): Promise<void> {
    const store = await this.tx(STORES.cachedAssets, 'readwrite');
    await this.requestToPromise(store.put(asset));
  }

  /** Get a cached asset by URL. */
  async getCachedAsset(url: string): Promise<CachedAsset | null> {
    const store = await this.tx(STORES.cachedAssets, 'readonly');
    const result = await this.requestToPromise(store.get(url));
    return (result as CachedAsset | undefined) ?? null;
  }

  /** Remove a cached asset by URL. */
  async deleteCachedAsset(url: string): Promise<void> {
    const store = await this.tx(STORES.cachedAssets, 'readwrite');
    await this.requestToPromise(store.delete(url));
  }

  // -----------------------------------------------------------------------
  // Storage Usage
  // -----------------------------------------------------------------------

  /** Get estimated storage usage via navigator.storage API. */
  async getStorageUsage(): Promise<StorageUsage> {
    if (
      typeof navigator !== 'undefined' &&
      navigator.storage &&
      typeof navigator.storage.estimate === 'function'
    ) {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage ?? 0;
      const quota = estimate.quota ?? 0;
      const percentage = quota > 0 ? (used / quota) * 100 : 0;
      return { used, quota, percentage };
    }
    return { used: 0, quota: 0, percentage: 0 };
  }

  // -----------------------------------------------------------------------
  // Clear All
  // -----------------------------------------------------------------------

  /** Delete the entire IndexedDB database. */
  async clearAll(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.openPromise = null;

    return new Promise<void>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        resolve();
        return;
      }
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => {
        reject(new Error('Failed to delete database'));
      };
    });
  }
}

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

/**
 * Hook for accessing IndexedDB manager in React components.
 */
export function useIndexedDb(): {
  saveSnapshot: (
    projectId: number,
    snapshot: Omit<ProjectSnapshot, 'projectId' | 'cachedAt'>,
  ) => Promise<void>;
  getSnapshot: (projectId: number) => Promise<ProjectSnapshot | null>;
  pendingCount: number;
  storageUsage: StorageUsage | null;
  refreshPendingCount: () => Promise<void>;
  refreshStorageUsage: () => Promise<void>;
} {
  const [pendingCount, setPendingCount] = useState(0);
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null);

  const refreshPendingCount = useCallback(async () => {
    try {
      const mgr = IndexedDbManager.getInstance();
      const pending = await mgr.getPendingChanges();
      setPendingCount(pending.length);
    } catch {
      // IndexedDB may not be available
    }
  }, []);

  const refreshStorageUsage = useCallback(async () => {
    try {
      const mgr = IndexedDbManager.getInstance();
      const usage = await mgr.getStorageUsage();
      setStorageUsage(usage);
    } catch {
      // Storage API may not be available
    }
  }, []);

  useEffect(() => {
    void refreshPendingCount();
    void refreshStorageUsage();
  }, [refreshPendingCount, refreshStorageUsage]);

  const saveSnapshot = useCallback(
    async (
      projectId: number,
      snapshot: Omit<ProjectSnapshot, 'projectId' | 'cachedAt'>,
    ) => {
      const mgr = IndexedDbManager.getInstance();
      await mgr.saveProjectSnapshot(projectId, snapshot);
      void refreshPendingCount();
    },
    [refreshPendingCount],
  );

  const getSnapshot = useCallback(
    async (projectId: number) => {
      const mgr = IndexedDbManager.getInstance();
      return mgr.getProjectSnapshot(projectId);
    },
    [],
  );

  return {
    saveSnapshot,
    getSnapshot,
    pendingCount,
    storageUsage,
    refreshPendingCount,
    refreshStorageUsage,
  };
}
