/**
 * Offline Sync Orchestrator
 *
 * Bridges PwaManager + IndexedDB + React Query. Intercepts mutations when offline,
 * queues them to IndexedDB, and syncs when connectivity returns. Handles conflict
 * detection (HTTP 409 / ETag mismatch) and exponential backoff.
 *
 * Usage:
 *   const sync = OfflineSyncManager.getInstance();
 *   await sync.interceptMutation(change);
 *   const { syncStatus, conflicts } = useOfflineSync();
 */

import { useCallback, useEffect, useState } from 'react';

import { IndexedDbManager } from '@/lib/indexed-db-manager';
import { PwaManager } from '@/lib/pwa-manager';

import type { OfflineChange, SyncStatus } from '@/lib/pwa-manager';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncConflict {
  changeId: string;
  entity: string;
  entityId: string;
  localData: Record<string, unknown>;
  remoteData: Record<string, unknown> | null;
  detectedAt: number;
}

export interface SyncResult {
  synced: number;
  failed: number;
  conflicts: number;
}

export type SyncEvent = 'sync-complete' | 'conflict' | 'error';
type SyncEventCallback = (data: unknown) => void;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;
const BACKOFF_MULTIPLIER = 2;
const MAX_RETRY_COUNT = 10;

// ---------------------------------------------------------------------------
// OfflineSyncManager
// ---------------------------------------------------------------------------

export class OfflineSyncManager {
  private static instance: OfflineSyncManager | null = null;

  private conflicts: SyncConflict[] = [];
  private syncing = false;
  private listeners = new Map<SyncEvent, Set<SyncEventCallback>>();
  private connectionUnsub: (() => void) | null = null;

  constructor() {
    this.setupConnectionListener();
  }

  /** Get or create the singleton instance. */
  static getInstance(): OfflineSyncManager {
    if (!OfflineSyncManager.instance) {
      OfflineSyncManager.instance = new OfflineSyncManager();
    }
    return OfflineSyncManager.instance;
  }

  /** Reset the singleton (for testing). */
  static resetForTesting(): void {
    if (OfflineSyncManager.instance?.connectionUnsub) {
      OfflineSyncManager.instance.connectionUnsub();
    }
    OfflineSyncManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Connection Monitoring
  // -----------------------------------------------------------------------

  private setupConnectionListener(): void {
    try {
      const pwa = PwaManager.getInstance();
      this.connectionUnsub = pwa.onConnectionChange((status) => {
        if (status === 'online') {
          void this.syncPendingChanges();
        }
      });
    } catch {
      // PwaManager may not be available in test environments
    }
  }

  // -----------------------------------------------------------------------
  // Event Emitter
  // -----------------------------------------------------------------------

  /** Subscribe to sync events. Returns an unsubscribe function. */
  on(event: SyncEvent, callback: SyncEventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private emit(event: SyncEvent, data: unknown): void {
    this.listeners.get(event)?.forEach((cb) => {
      cb(data);
    });
  }

  // -----------------------------------------------------------------------
  // Mutation Interception
  // -----------------------------------------------------------------------

  /**
   * Intercept a mutation. If offline, queues it to IndexedDB.
   * If online, sends it directly (but still queues on failure).
   */
  async interceptMutation(
    change: Omit<OfflineChange, 'id' | 'synced' | 'retryCount'>,
  ): Promise<void> {
    const pwa = PwaManager.getInstance();
    const db = IndexedDbManager.getInstance();

    if (!pwa.isOnline()) {
      await db.queueChange(change);
      return;
    }

    // Online — try to send directly
    try {
      await this.sendChange({
        ...change,
        id: crypto.randomUUID(),
        synced: false,
        retryCount: 0,
      });
    } catch {
      // Network failed despite being "online" — queue for later
      await db.queueChange(change);
    }
  }

  // -----------------------------------------------------------------------
  // Sync Engine
  // -----------------------------------------------------------------------

  /**
   * Process all pending changes with exponential backoff.
   * Groups changes to the same entity to avoid redundant requests.
   */
  async syncPendingChanges(): Promise<SyncResult> {
    if (this.syncing) {
      return { synced: 0, failed: 0, conflicts: 0 };
    }

    this.syncing = true;
    const db = IndexedDbManager.getInstance();
    const result: SyncResult = { synced: 0, failed: 0, conflicts: 0 };

    try {
      const pending = await db.getPendingChanges();
      if (pending.length === 0) {
        this.syncing = false;
        return result;
      }

      // Batch: group by entity+entityId, keep only latest per group
      const batched = this.batchChanges(pending);

      for (const change of batched) {
        if (change.retryCount >= MAX_RETRY_COUNT) {
          result.failed++;
          continue;
        }

        const backoff = Math.min(
          INITIAL_BACKOFF_MS * Math.pow(BACKOFF_MULTIPLIER, change.retryCount),
          MAX_BACKOFF_MS,
        );

        if (change.retryCount > 0) {
          await this.delay(backoff);
        }

        try {
          await this.sendChange(change);
          await db.markChangesSynced([change.id]);
          await db.addSyncLog({
            timestamp: Date.now(),
            action: `${change.type}:${change.entity}:${change.entityId}`,
            result: 'success',
          });
          result.synced++;
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));

          if (this.isConflict(error)) {
            const conflict: SyncConflict = {
              changeId: change.id,
              entity: change.entity,
              entityId: change.entityId,
              localData: change.data,
              remoteData: null,
              detectedAt: Date.now(),
            };
            this.conflicts.push(conflict);
            await db.markChangeFailed(change.id, 'Conflict: ETag mismatch or 409');
            await db.addSyncLog({
              timestamp: Date.now(),
              action: `${change.type}:${change.entity}:${change.entityId}`,
              result: 'conflict',
              details: error.message,
            });
            this.emit('conflict', conflict);
            result.conflicts++;
          } else {
            await db.markChangeFailed(change.id, error.message);
            await db.addSyncLog({
              timestamp: Date.now(),
              action: `${change.type}:${change.entity}:${change.entityId}`,
              result: 'error',
              details: error.message,
            });
            result.failed++;
          }
        }
      }

      this.emit('sync-complete', result);
    } catch (err) {
      this.emit('error', err);
    } finally {
      this.syncing = false;
    }

    return result;
  }

  // -----------------------------------------------------------------------
  // Conflict Resolution
  // -----------------------------------------------------------------------

  /** Get all current conflicts. */
  getConflicts(): SyncConflict[] {
    return [...this.conflicts];
  }

  /** Resolve a conflict. */
  async resolveConflict(
    changeId: string,
    resolution: 'local' | 'remote' | 'merge',
  ): Promise<void> {
    const db = IndexedDbManager.getInstance();
    const conflictIndex = this.conflicts.findIndex(
      (c) => c.changeId === changeId,
    );
    if (conflictIndex === -1) {
      return;
    }

    const conflict = this.conflicts[conflictIndex];

    if (resolution === 'remote') {
      // Discard local change
      await db.markChangesSynced([changeId]);
    } else if (resolution === 'local') {
      // Retry with local data — reset retry count by re-queueing
      await db.markChangesSynced([changeId]);
      await db.queueChange({
        type: 'update',
        entity: conflict.entity,
        entityId: conflict.entityId,
        data: conflict.localData,
        timestamp: Date.now(),
      });
    } else {
      // Merge — for now, treat as local retry (consumer can merge data before calling)
      await db.markChangesSynced([changeId]);
      await db.queueChange({
        type: 'update',
        entity: conflict.entity,
        entityId: conflict.entityId,
        data: conflict.localData,
        timestamp: Date.now(),
      });
    }

    this.conflicts.splice(conflictIndex, 1);
  }

  // -----------------------------------------------------------------------
  // Sync Status
  // -----------------------------------------------------------------------

  /** Get current sync status. */
  getSyncStatus(): SyncStatus {
    if (this.syncing) {
      return 'syncing';
    }
    if (this.conflicts.length > 0) {
      return 'conflict';
    }
    return 'synced';
  }

  /** Whether a sync is currently in progress. */
  isSyncing(): boolean {
    return this.syncing;
  }

  // -----------------------------------------------------------------------
  // Internals
  // -----------------------------------------------------------------------

  /**
   * Send a single change to the server.
   * Maps entity types to API endpoints.
   */
  private async sendChange(change: OfflineChange): Promise<void> {
    const methodMap: Record<string, string> = {
      create: 'POST',
      update: 'PUT',
      delete: 'DELETE',
    };

    const method = methodMap[change.type] ?? 'PUT';
    const url = `/api/${change.entity}/${change.entityId}`;

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(change.data._etag
          ? { 'If-Match': String(change.data._etag) }
          : {}),
      },
      body: method !== 'DELETE' ? JSON.stringify(change.data) : undefined,
    });

    if (!response.ok) {
      const statusError = new Error(`HTTP ${response.status}`);
      (statusError as Error & { status: number }).status = response.status;
      throw statusError;
    }
  }

  /** Check if an error is a conflict (409 or ETag mismatch). */
  private isConflict(error: Error): boolean {
    const statusError = error as Error & { status?: number };
    if (statusError.status === 409 || statusError.status === 412) {
      return true;
    }
    const msg = error.message.toLowerCase();
    return msg.includes('conflict') || msg.includes('etag') || msg.includes('precondition');
  }

  /**
   * Batch changes: for the same entity+entityId, keep only the latest change.
   * Deletes always win over updates/creates.
   */
  private batchChanges(changes: OfflineChange[]): OfflineChange[] {
    const groups = new Map<string, OfflineChange>();
    for (const change of changes) {
      const key = `${change.entity}:${change.entityId}`;
      const existing = groups.get(key);
      if (!existing) {
        groups.set(key, change);
      } else if (change.type === 'delete') {
        // Delete wins
        groups.set(key, change);
      } else if (change.timestamp > existing.timestamp) {
        groups.set(key, change);
      }
    }
    return Array.from(groups.values());
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

/**
 * Hook for offline sync status and controls.
 */
export function useOfflineSync(): {
  syncStatus: SyncStatus;
  pendingCount: number;
  conflicts: SyncConflict[];
  triggerSync: () => Promise<SyncResult>;
  resolveConflict: (
    changeId: string,
    resolution: 'local' | 'remote' | 'merge',
  ) => Promise<void>;
} {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [pendingCount, setPendingCount] = useState(0);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);

  useEffect(() => {
    const mgr = OfflineSyncManager.getInstance();

    const refresh = () => {
      setSyncStatus(mgr.getSyncStatus());
      setConflicts(mgr.getConflicts());
    };

    const unsubComplete = mgr.on('sync-complete', () => {
      refresh();
      void IndexedDbManager.getInstance()
        .getPendingChanges()
        .then((p) => {
          setPendingCount(p.length);
        })
        .catch(() => {
          // ignore
        });
    });

    const unsubConflict = mgr.on('conflict', () => {
      refresh();
    });

    const unsubError = mgr.on('error', () => {
      refresh();
    });

    // Initial load
    refresh();
    void IndexedDbManager.getInstance()
      .getPendingChanges()
      .then((p) => {
        setPendingCount(p.length);
      })
      .catch(() => {
        // ignore
      });

    return () => {
      unsubComplete();
      unsubConflict();
      unsubError();
    };
  }, []);

  const triggerSync = useCallback(async () => {
    const mgr = OfflineSyncManager.getInstance();
    const result = await mgr.syncPendingChanges();
    return result;
  }, []);

  const resolveConflict = useCallback(
    async (
      changeId: string,
      resolution: 'local' | 'remote' | 'merge',
    ) => {
      const mgr = OfflineSyncManager.getInstance();
      await mgr.resolveConflict(changeId, resolution);
      setSyncStatus(mgr.getSyncStatus());
      setConflicts(mgr.getConflicts());
    },
    [],
  );

  return {
    syncStatus,
    pendingCount,
    conflicts,
    triggerSync,
    resolveConflict,
  };
}
