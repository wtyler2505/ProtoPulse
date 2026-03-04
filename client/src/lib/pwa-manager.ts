/**
 * PWA Manager — Progressive Web App Support
 *
 * Handles service worker registration, offline caching, local-first data sync,
 * and app installation. Provides connection monitoring, offline change queuing,
 * sync conflict resolution, and offline project storage.
 *
 * Usage:
 *   const pwa = PwaManager.getInstance();
 *   pwa.registerServiceWorker();
 *   pwa.saveOfflineChange({ type: 'update', entity: 'bom-item', entityId: '1', data: {...}, timestamp: Date.now() });
 *
 * React hook:
 *   const { connectionStatus, syncState, triggerSync } = usePwaManager();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConnectionStatus = 'online' | 'offline' | 'slow';
export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'conflict' | 'error';
export type CacheStrategy = 'cache-first' | 'network-first' | 'stale-while-revalidate' | 'network-only' | 'cache-only';

export interface CacheConfig {
  name: string;
  strategy: CacheStrategy;
  maxAge: number; // ms
  maxEntries: number;
  urlPatterns: string[]; // glob patterns
}

export interface CachedResource {
  url: string;
  cacheName: string;
  cachedAt: number;
  expiresAt: number;
  size: number;
  contentType: string;
}

export interface OfflineChange {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: string; // e.g., 'project', 'bom-item', 'node'
  entityId: string;
  data: Record<string, unknown>;
  timestamp: number;
  synced: boolean;
  syncError?: string;
  retryCount: number;
}

export interface SyncState {
  status: SyncStatus;
  pendingChanges: number;
  lastSyncAt: number | null;
  lastSyncError: string | null;
  conflictCount: number;
}

export interface InstallPromptState {
  canInstall: boolean;
  isInstalled: boolean;
  platform: 'android' | 'ios' | 'desktop' | 'unknown';
}

export interface StorageEstimate {
  usage: number; // bytes
  quota: number; // bytes
  percentUsed: number;
  cacheBreakdown: Array<{ cacheName: string; size: number; entryCount: number }>;
}

export interface OfflineProject {
  id: string;
  name: string;
  data: Record<string, unknown>;
  savedAt: number;
  size: number;
  dirty: boolean;
}

/** Input type for saving an offline project — `savedAt` and `size` are computed, `dirty` defaults to false. */
export type SaveOfflineProjectInput = Omit<OfflineProject, 'savedAt' | 'size' | 'dirty'> & { dirty?: boolean };

// ---------------------------------------------------------------------------
// Internal state shape for persistence
// ---------------------------------------------------------------------------

interface PwaManagerState {
  connectionStatus: ConnectionStatus;
  cacheConfigs: CacheConfig[];
  cachedResources: CachedResource[];
  offlineChanges: OfflineChange[];
  syncState: SyncState;
  installState: InstallPromptState;
  offlineProjects: OfflineProject[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-pwa-manager';

const DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_CACHE_CONFIGS: CacheConfig[] = [
  {
    name: 'app-shell',
    strategy: 'cache-first',
    maxAge: 7 * DAY_MS,
    maxEntries: 50,
    urlPatterns: ['/*.html', '/*.js', '/*.css'],
  },
  {
    name: 'api-data',
    strategy: 'network-first',
    maxAge: 60 * 60 * 1000,
    maxEntries: 200,
    urlPatterns: ['/api/*'],
  },
  {
    name: 'images',
    strategy: 'cache-first',
    maxAge: 30 * DAY_MS,
    maxEntries: 100,
    urlPatterns: ['/*.png', '/*.svg', '/*.ico'],
  },
  {
    name: 'fonts',
    strategy: 'cache-first',
    maxAge: 365 * DAY_MS,
    maxEntries: 20,
    urlPatterns: ['/*.woff2', '/*.woff'],
  },
];

const DEFAULT_SYNC_STATE: SyncState = {
  status: 'synced',
  pendingChanges: 0,
  lastSyncAt: null,
  lastSyncError: null,
  conflictCount: 0,
};

const DEFAULT_INSTALL_STATE: InstallPromptState = {
  canInstall: false,
  isInstalled: false,
  platform: 'unknown',
};

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;
type ConnectionChangeCallback = (status: ConnectionStatus) => void;

// ---------------------------------------------------------------------------
// PwaManager
// ---------------------------------------------------------------------------

/**
 * Manages Progressive Web App features: service worker, caching, offline data,
 * sync, and installation. Singleton per application. Notifies subscribers on
 * state changes. Persists to localStorage.
 */
export class PwaManager {
  private static instance: PwaManager | null = null;

  private connectionStatus: ConnectionStatus;
  private cacheConfigs: CacheConfig[];
  private cachedResources: CachedResource[];
  private offlineChanges: OfflineChange[];
  private syncState: SyncState;
  private installState: InstallPromptState;
  private offlineProjects: OfflineProject[];

  private swRegistration: unknown | null = null;
  private listeners = new Set<Listener>();
  private connectionChangeCallbacks = new Set<ConnectionChangeCallback>();

  constructor() {
    this.connectionStatus = typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline';
    this.cacheConfigs = DEFAULT_CACHE_CONFIGS.map((c) => ({ ...c, urlPatterns: [...c.urlPatterns] }));
    this.cachedResources = [];
    this.offlineChanges = [];
    this.syncState = { ...DEFAULT_SYNC_STATE };
    this.installState = { ...DEFAULT_INSTALL_STATE, platform: this.detectPlatform() };
    this.offlineProjects = [];
    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): PwaManager {
    if (!PwaManager.instance) {
      PwaManager.instance = new PwaManager();
    }
    return PwaManager.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetForTesting(): void {
    PwaManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => {
      l();
    });
  }

  // -----------------------------------------------------------------------
  // Connection Status
  // -----------------------------------------------------------------------

  /** Get the current connection status. */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /** Set the connection status (e.g., from network events). */
  setConnectionStatus(status: ConnectionStatus): void {
    const previous = this.connectionStatus;
    this.connectionStatus = status;
    this.save();
    this.notify();
    if (previous !== status) {
      this.connectionChangeCallbacks.forEach((cb) => {
        cb(status);
      });
    }
  }

  /** Convenience check for online status. */
  isOnline(): boolean {
    return this.connectionStatus === 'online';
  }

  /** Register a callback for connection status changes. Returns an unsubscribe function. */
  onConnectionChange(callback: ConnectionChangeCallback): () => void {
    this.connectionChangeCallbacks.add(callback);
    return () => {
      this.connectionChangeCallbacks.delete(callback);
    };
  }

  // -----------------------------------------------------------------------
  // Service Worker
  // -----------------------------------------------------------------------

  /** Register a service worker. Returns true if registration succeeds. */
  async registerServiceWorker(swUrl = '/sw.js'): Promise<boolean> {
    try {
      if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
        return false;
      }
      const registration = await (navigator as Navigator & { serviceWorker: { register: (url: string) => Promise<unknown> } }).serviceWorker.register(swUrl);
      this.swRegistration = registration;
      this.notify();
      return true;
    } catch {
      return false;
    }
  }

  /** Get the current service worker registration. */
  getSwRegistration(): unknown | null {
    return this.swRegistration;
  }

  /** Whether a service worker is currently registered. */
  isSwRegistered(): boolean {
    return this.swRegistration !== null;
  }

  /** Check for service worker updates. Returns true if an update is available. */
  checkForUpdate(): boolean {
    if (!this.swRegistration) {
      return false;
    }
    // In a real implementation, this would call registration.update()
    // For now, return false as no update mechanism is wired
    return false;
  }

  /** Tell the waiting service worker to activate immediately. */
  skipWaiting(): void {
    // In a real implementation, this would send a 'SKIP_WAITING' message
    // to the waiting service worker via postMessage
  }

  // -----------------------------------------------------------------------
  // Cache Configuration
  // -----------------------------------------------------------------------

  /** Add a cache configuration. Replaces if same name exists. */
  addCacheConfig(config: CacheConfig): void {
    const index = this.cacheConfigs.findIndex((c) => c.name === config.name);
    if (index >= 0) {
      this.cacheConfigs[index] = { ...config, urlPatterns: [...config.urlPatterns] };
    } else {
      this.cacheConfigs.push({ ...config, urlPatterns: [...config.urlPatterns] });
    }
    this.save();
    this.notify();
  }

  /** Remove a cache configuration by name. Returns true if removed. */
  removeCacheConfig(name: string): boolean {
    const index = this.cacheConfigs.findIndex((c) => c.name === name);
    if (index === -1) {
      return false;
    }
    this.cacheConfigs.splice(index, 1);
    this.save();
    this.notify();
    return true;
  }

  /** Get all cache configurations. */
  getCacheConfigs(): CacheConfig[] {
    return this.cacheConfigs.map((c) => ({ ...c, urlPatterns: [...c.urlPatterns] }));
  }

  // -----------------------------------------------------------------------
  // Cached Resources
  // -----------------------------------------------------------------------

  /** Get cached resources, optionally filtered by cache name. */
  getCachedResources(cacheName?: string): CachedResource[] {
    if (cacheName) {
      return this.cachedResources.filter((r) => r.cacheName === cacheName).map((r) => ({ ...r }));
    }
    return this.cachedResources.map((r) => ({ ...r }));
  }

  /** Add a cached resource entry. Replaces if same URL exists. */
  addCachedResource(resource: CachedResource): void {
    const index = this.cachedResources.findIndex((r) => r.url === resource.url);
    if (index >= 0) {
      this.cachedResources[index] = { ...resource };
    } else {
      this.cachedResources.push({ ...resource });
    }
    this.save();
    this.notify();
  }

  /** Remove a cached resource by URL. Returns true if removed. */
  removeCachedResource(url: string): boolean {
    const index = this.cachedResources.findIndex((r) => r.url === url);
    if (index === -1) {
      return false;
    }
    this.cachedResources.splice(index, 1);
    this.save();
    this.notify();
    return true;
  }

  /** Clear cached resources. If cacheName provided, only clears that cache. */
  clearCache(cacheName?: string): void {
    if (cacheName) {
      this.cachedResources = this.cachedResources.filter((r) => r.cacheName !== cacheName);
    } else {
      this.cachedResources = [];
    }
    this.save();
    this.notify();
  }

  /** Get total size of all cached resources in bytes. */
  getCacheSize(): number {
    let total = 0;
    this.cachedResources.forEach((r) => {
      total += r.size;
    });
    return total;
  }

  // -----------------------------------------------------------------------
  // Offline Changes
  // -----------------------------------------------------------------------

  /** Save a change made while offline (or to queue for sync). */
  saveOfflineChange(change: Omit<OfflineChange, 'id' | 'synced' | 'retryCount'>): OfflineChange {
    const fullChange: OfflineChange = {
      ...change,
      id: crypto.randomUUID(),
      synced: false,
      retryCount: 0,
    };
    this.offlineChanges.push(fullChange);
    this.updateSyncStateFromChanges();
    this.save();
    this.notify();
    return fullChange;
  }

  /** Get all offline changes. */
  getOfflineChanges(): OfflineChange[] {
    return this.offlineChanges.map((c) => ({ ...c }));
  }

  /** Get only pending (unsynced) changes. */
  getPendingChanges(): OfflineChange[] {
    return this.offlineChanges.filter((c) => !c.synced).map((c) => ({ ...c }));
  }

  /** Mark a change as successfully synced. */
  markSynced(changeId: string): void {
    const change = this.offlineChanges.find((c) => c.id === changeId);
    if (change) {
      change.synced = true;
      change.syncError = undefined;
      this.updateSyncStateFromChanges();
      this.save();
      this.notify();
    }
  }

  /** Mark a change as having a sync error. */
  markSyncError(changeId: string, error: string): void {
    const change = this.offlineChanges.find((c) => c.id === changeId);
    if (change) {
      change.syncError = error;
      change.retryCount += 1;
      this.updateSyncStateFromChanges();
      this.save();
      this.notify();
    }
  }

  /** Remove all synced changes from the queue. */
  clearSyncedChanges(): void {
    this.offlineChanges = this.offlineChanges.filter((c) => !c.synced);
    this.updateSyncStateFromChanges();
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Sync
  // -----------------------------------------------------------------------

  /** Get the current sync state. */
  getSyncState(): SyncState {
    return { ...this.syncState };
  }

  /**
   * Trigger a sync attempt. If offline, sets error state.
   * In a real implementation, this would POST pending changes to the server.
   * Returns the updated sync state.
   */
  triggerSync(): SyncState {
    if (!this.isOnline()) {
      this.syncState = {
        ...this.syncState,
        status: 'error',
        lastSyncError: 'Cannot sync while offline',
      };
      this.save();
      this.notify();
      return { ...this.syncState };
    }

    const pending = this.offlineChanges.filter((c) => !c.synced);
    if (pending.length === 0) {
      this.syncState = {
        ...this.syncState,
        status: 'synced',
        pendingChanges: 0,
        lastSyncAt: Date.now(),
        lastSyncError: null,
      };
      this.save();
      this.notify();
      return { ...this.syncState };
    }

    // Mark all pending as synced (simulated sync)
    pending.forEach((c) => {
      c.synced = true;
      c.syncError = undefined;
    });

    this.syncState = {
      status: 'synced',
      pendingChanges: 0,
      lastSyncAt: Date.now(),
      lastSyncError: null,
      conflictCount: 0,
    };
    this.save();
    this.notify();
    return { ...this.syncState };
  }

  /**
   * Resolve a sync conflict for a specific change.
   * 'local' keeps the offline change, 'remote' discards it.
   */
  resolveConflict(changeId: string, resolution: 'local' | 'remote'): void {
    const change = this.offlineChanges.find((c) => c.id === changeId);
    if (!change) {
      return;
    }

    if (resolution === 'remote') {
      // Discard the local change
      const index = this.offlineChanges.indexOf(change);
      if (index >= 0) {
        this.offlineChanges.splice(index, 1);
      }
    } else {
      // Keep local — mark as pending again for retry
      change.synced = false;
      change.syncError = undefined;
    }

    this.updateSyncStateFromChanges();
    this.save();
    this.notify();
  }

  /** Get changes that are in conflict state (have sync errors). */
  getConflicts(): OfflineChange[] {
    return this.offlineChanges.filter((c) => c.syncError !== undefined && !c.synced).map((c) => ({ ...c }));
  }

  private updateSyncStateFromChanges(): void {
    const pending = this.offlineChanges.filter((c) => !c.synced);
    const conflicts = this.offlineChanges.filter((c) => c.syncError !== undefined && !c.synced);
    const hasErrors = this.offlineChanges.some((c) => c.syncError !== undefined && !c.synced);

    let status: SyncStatus;
    if (conflicts.length > 0) {
      status = 'conflict';
    } else if (hasErrors) {
      status = 'error';
    } else if (pending.length > 0) {
      status = 'pending';
    } else {
      status = 'synced';
    }

    this.syncState = {
      ...this.syncState,
      status,
      pendingChanges: pending.length,
      conflictCount: conflicts.length,
    };
  }

  // -----------------------------------------------------------------------
  // Install
  // -----------------------------------------------------------------------

  /** Get the current install prompt state. */
  getInstallState(): InstallPromptState {
    return { ...this.installState };
  }

  /** Set whether the app can be installed. */
  setInstallable(canInstall: boolean): void {
    this.installState = { ...this.installState, canInstall };
    this.save();
    this.notify();
  }

  /** Set whether the app is already installed. */
  setInstalled(isInstalled: boolean): void {
    this.installState = { ...this.installState, isInstalled };
    this.save();
    this.notify();
  }

  /** Detect the platform from the user agent. */
  detectPlatform(): InstallPromptState['platform'] {
    if (typeof navigator === 'undefined') {
      return 'unknown';
    }
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('android')) {
      return 'android';
    }
    if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) {
      return 'ios';
    }
    if (ua.includes('windows') || ua.includes('macintosh') || ua.includes('linux')) {
      return 'desktop';
    }
    return 'unknown';
  }

  // -----------------------------------------------------------------------
  // Offline Projects
  // -----------------------------------------------------------------------

  /** Save a project for offline access. Returns the saved project. */
  saveProjectOffline(project: SaveOfflineProjectInput): OfflineProject {
    const serialized = JSON.stringify(project.data);
    const fullProject: OfflineProject = {
      ...project,
      dirty: project.dirty ?? false,
      savedAt: Date.now(),
      size: new Blob([serialized]).size,
    };

    const index = this.offlineProjects.findIndex((p) => p.id === project.id);
    if (index >= 0) {
      this.offlineProjects[index] = fullProject;
    } else {
      this.offlineProjects.push(fullProject);
    }

    this.save();
    this.notify();
    return { ...fullProject };
  }

  /** Get an offline project by ID. Returns null if not found. */
  getOfflineProject(id: string): OfflineProject | null {
    const project = this.offlineProjects.find((p) => p.id === id);
    return project ? { ...project } : null;
  }

  /** Get all offline projects. */
  getAllOfflineProjects(): OfflineProject[] {
    return this.offlineProjects.map((p) => ({ ...p }));
  }

  /** Remove an offline project. Returns true if removed. */
  removeOfflineProject(id: string): boolean {
    const index = this.offlineProjects.findIndex((p) => p.id === id);
    if (index === -1) {
      return false;
    }
    this.offlineProjects.splice(index, 1);
    this.save();
    this.notify();
    return true;
  }

  /** Mark an offline project as dirty (has unsaved changes). */
  markProjectDirty(id: string): void {
    const project = this.offlineProjects.find((p) => p.id === id);
    if (project) {
      project.dirty = true;
      this.save();
      this.notify();
    }
  }

  // -----------------------------------------------------------------------
  // Storage Estimate
  // -----------------------------------------------------------------------

  /** Get an estimate of storage usage with cache breakdown. */
  getStorageEstimate(): StorageEstimate {
    const cacheBreakdownMap = new Map<string, { size: number; entryCount: number }>();

    this.cachedResources.forEach((r) => {
      const existing = cacheBreakdownMap.get(r.cacheName);
      if (existing) {
        existing.size += r.size;
        existing.entryCount += 1;
      } else {
        cacheBreakdownMap.set(r.cacheName, { size: r.size, entryCount: 1 });
      }
    });

    const cacheBreakdown: StorageEstimate['cacheBreakdown'] = [];
    cacheBreakdownMap.forEach((value, key) => {
      cacheBreakdown.push({ cacheName: key, ...value });
    });

    const usage = this.getCacheSize();
    const quota = 50 * 1024 * 1024; // 50 MB default quota estimate
    const percentUsed = quota > 0 ? (usage / quota) * 100 : 0;

    return { usage, quota, percentUsed, cacheBreakdown };
  }

  // -----------------------------------------------------------------------
  // Import / Export
  // -----------------------------------------------------------------------

  /** Export the full PWA manager state as a JSON string. */
  exportState(): string {
    const state: PwaManagerState = {
      connectionStatus: this.connectionStatus,
      cacheConfigs: this.cacheConfigs,
      cachedResources: this.cachedResources,
      offlineChanges: this.offlineChanges,
      syncState: this.syncState,
      installState: this.installState,
      offlineProjects: this.offlineProjects,
    };
    return JSON.stringify(state);
  }

  /** Import state from a JSON string. Returns counts and errors. */
  importState(json: string): { imported: number; errors: string[] } {
    const errors: string[] = [];
    let imported = 0;

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return { imported: 0, errors: ['Invalid JSON'] };
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return { imported: 0, errors: ['State must be an object'] };
    }

    const data = parsed as Record<string, unknown>;

    if (typeof data.connectionStatus === 'string' &&
        (data.connectionStatus === 'online' || data.connectionStatus === 'offline' || data.connectionStatus === 'slow')) {
      this.connectionStatus = data.connectionStatus;
      imported++;
    }

    if (Array.isArray(data.cacheConfigs)) {
      this.cacheConfigs = data.cacheConfigs as CacheConfig[];
      imported++;
    }

    if (Array.isArray(data.cachedResources)) {
      this.cachedResources = data.cachedResources as CachedResource[];
      imported++;
    }

    if (Array.isArray(data.offlineChanges)) {
      this.offlineChanges = data.offlineChanges as OfflineChange[];
      imported++;
    }

    if (typeof data.syncState === 'object' && data.syncState !== null) {
      this.syncState = data.syncState as SyncState;
      imported++;
    }

    if (typeof data.installState === 'object' && data.installState !== null) {
      this.installState = data.installState as InstallPromptState;
      imported++;
    }

    if (Array.isArray(data.offlineProjects)) {
      this.offlineProjects = data.offlineProjects as OfflineProject[];
      imported++;
    }

    this.save();
    this.notify();
    return { imported, errors };
  }

  // -----------------------------------------------------------------------
  // Clear
  // -----------------------------------------------------------------------

  /** Reset all state to defaults. */
  clear(): void {
    this.connectionStatus = typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline';
    this.cacheConfigs = DEFAULT_CACHE_CONFIGS.map((c) => ({ ...c, urlPatterns: [...c.urlPatterns] }));
    this.cachedResources = [];
    this.offlineChanges = [];
    this.syncState = { ...DEFAULT_SYNC_STATE };
    this.installState = { ...DEFAULT_INSTALL_STATE, platform: this.detectPlatform() };
    this.offlineProjects = [];
    this.swRegistration = null;
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  private save(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const state: PwaManagerState = {
        connectionStatus: this.connectionStatus,
        cacheConfigs: this.cacheConfigs,
        cachedResources: this.cachedResources,
        offlineChanges: this.offlineChanges,
        syncState: this.syncState,
        installState: this.installState,
        offlineProjects: this.offlineProjects,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }

  private load(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) {
        return;
      }

      const data = parsed as Record<string, unknown>;

      if (typeof data.connectionStatus === 'string' &&
          (data.connectionStatus === 'online' || data.connectionStatus === 'offline' || data.connectionStatus === 'slow')) {
        this.connectionStatus = data.connectionStatus;
      }

      if (Array.isArray(data.cacheConfigs) && data.cacheConfigs.length > 0) {
        this.cacheConfigs = data.cacheConfigs as CacheConfig[];
      }

      if (Array.isArray(data.cachedResources)) {
        this.cachedResources = data.cachedResources as CachedResource[];
      }

      if (Array.isArray(data.offlineChanges)) {
        this.offlineChanges = data.offlineChanges as OfflineChange[];
      }

      if (typeof data.syncState === 'object' && data.syncState !== null) {
        this.syncState = data.syncState as SyncState;
      }

      if (typeof data.installState === 'object' && data.installState !== null) {
        this.installState = data.installState as InstallPromptState;
      }

      if (Array.isArray(data.offlineProjects)) {
        this.offlineProjects = data.offlineProjects as OfflineProject[];
      }
    } catch {
      // Corrupt data — keep defaults
    }
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook for accessing the PWA manager in React components.
 * Subscribes to the PwaManager singleton and triggers re-renders on state changes.
 */
export function usePwaManager(): {
  connectionStatus: ConnectionStatus;
  isOnline: boolean;
  syncState: SyncState;
  pendingChanges: OfflineChange[];
  cacheConfigs: CacheConfig[];
  installState: InstallPromptState;
  offlineProjects: OfflineProject[];
  saveProjectOffline: (project: SaveOfflineProjectInput) => OfflineProject;
  removeOfflineProject: (id: string) => boolean;
  triggerSync: () => SyncState;
  resolveConflict: (changeId: string, resolution: 'local' | 'remote') => void;
  getStorageEstimate: () => StorageEstimate;
  registerServiceWorker: (swUrl?: string) => Promise<boolean>;
  isSwRegistered: boolean;
  exportState: () => string;
  importState: (json: string) => { imported: number; errors: string[] };
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const mgr = PwaManager.getInstance();
    const unsubscribe = mgr.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const saveProjectOffline = useCallback(
    (project: SaveOfflineProjectInput) => {
      return PwaManager.getInstance().saveProjectOffline(project);
    },
    [],
  );

  const removeOfflineProject = useCallback((id: string) => {
    return PwaManager.getInstance().removeOfflineProject(id);
  }, []);

  const triggerSync = useCallback(() => {
    return PwaManager.getInstance().triggerSync();
  }, []);

  const resolveConflict = useCallback((changeId: string, resolution: 'local' | 'remote') => {
    PwaManager.getInstance().resolveConflict(changeId, resolution);
  }, []);

  const getStorageEstimate = useCallback(() => {
    return PwaManager.getInstance().getStorageEstimate();
  }, []);

  const registerServiceWorker = useCallback((swUrl?: string) => {
    return PwaManager.getInstance().registerServiceWorker(swUrl);
  }, []);

  const exportState = useCallback(() => {
    return PwaManager.getInstance().exportState();
  }, []);

  const importState = useCallback((json: string) => {
    return PwaManager.getInstance().importState(json);
  }, []);

  const mgr = typeof window !== 'undefined' ? PwaManager.getInstance() : null;

  return {
    connectionStatus: mgr?.getConnectionStatus() ?? 'offline',
    isOnline: mgr?.isOnline() ?? false,
    syncState: mgr?.getSyncState() ?? { ...DEFAULT_SYNC_STATE },
    pendingChanges: mgr?.getPendingChanges() ?? [],
    cacheConfigs: mgr?.getCacheConfigs() ?? [],
    installState: mgr?.getInstallState() ?? { ...DEFAULT_INSTALL_STATE },
    offlineProjects: mgr?.getAllOfflineProjects() ?? [],
    saveProjectOffline,
    removeOfflineProject,
    triggerSync,
    resolveConflict,
    getStorageEstimate,
    registerServiceWorker,
    isSwRegistered: mgr?.isSwRegistered() ?? false,
    exportState,
    importState,
  };
}
