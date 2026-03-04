import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { PwaManager, usePwaManager } from '../pwa-manager';
import type {
  ConnectionStatus,
  CacheConfig,
  CachedResource,
  OfflineChange,
  SyncState,
  InstallPromptState,
  OfflineProject,
  StorageEstimate,
} from '../pwa-manager';

// ---------------------------------------------------------------------------
// Globals mock
// ---------------------------------------------------------------------------

vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => `uuid-${Math.random().toString(36).slice(2, 10)}`),
});

const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, val: string) => {
    store[key] = val;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    for (const k of Object.keys(store)) {
      delete store[k];
    }
  }),
});

// Mock navigator.onLine
Object.defineProperty(globalThis, 'navigator', {
  value: { onLine: true, userAgent: 'test' },
  writable: true,
  configurable: true,
});

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let pwa: PwaManager;

beforeEach(() => {
  // Clear localStorage store
  for (const k of Object.keys(store)) {
    delete store[k];
  }
  PwaManager.resetForTesting();
  pwa = PwaManager.getInstance();
});

afterEach(() => {
  PwaManager.resetForTesting();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

describe('PwaManager - Singleton', () => {
  it('returns the same instance on repeated calls', () => {
    const a = PwaManager.getInstance();
    const b = PwaManager.getInstance();
    expect(a).toBe(b);
  });

  it('creates a fresh instance after resetForTesting', () => {
    const first = PwaManager.getInstance();
    PwaManager.resetForTesting();
    const second = PwaManager.getInstance();
    expect(first).not.toBe(second);
  });
});

// ---------------------------------------------------------------------------
// Connection Status
// ---------------------------------------------------------------------------

describe('PwaManager - Connection Status', () => {
  it('defaults to online when navigator.onLine is true', () => {
    expect(pwa.getConnectionStatus()).toBe('online');
  });

  it('returns the set connection status', () => {
    pwa.setConnectionStatus('offline');
    expect(pwa.getConnectionStatus()).toBe('offline');
  });

  it('supports slow connection status', () => {
    pwa.setConnectionStatus('slow');
    expect(pwa.getConnectionStatus()).toBe('slow');
  });

  it('isOnline returns true when online', () => {
    pwa.setConnectionStatus('online');
    expect(pwa.isOnline()).toBe(true);
  });

  it('isOnline returns false when offline', () => {
    pwa.setConnectionStatus('offline');
    expect(pwa.isOnline()).toBe(false);
  });

  it('isOnline returns false when slow', () => {
    pwa.setConnectionStatus('slow');
    expect(pwa.isOnline()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Connection Change Callback
// ---------------------------------------------------------------------------

describe('PwaManager - Connection Change Callback', () => {
  it('fires callback when connection status changes', () => {
    const cb = vi.fn();
    pwa.onConnectionChange(cb);
    pwa.setConnectionStatus('offline');
    expect(cb).toHaveBeenCalledWith('offline');
  });

  it('does not fire callback when status is set to the same value', () => {
    pwa.setConnectionStatus('online');
    const cb = vi.fn();
    pwa.onConnectionChange(cb);
    pwa.setConnectionStatus('online');
    expect(cb).not.toHaveBeenCalled();
  });

  it('returns unsubscribe function that removes the callback', () => {
    const cb = vi.fn();
    const unsub = pwa.onConnectionChange(cb);
    unsub();
    pwa.setConnectionStatus('offline');
    expect(cb).not.toHaveBeenCalled();
  });

  it('supports multiple callbacks', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    pwa.onConnectionChange(cb1);
    pwa.onConnectionChange(cb2);
    pwa.setConnectionStatus('slow');
    expect(cb1).toHaveBeenCalledWith('slow');
    expect(cb2).toHaveBeenCalledWith('slow');
  });
});

// ---------------------------------------------------------------------------
// Service Worker
// ---------------------------------------------------------------------------

describe('PwaManager - Service Worker', () => {
  it('isSwRegistered returns false initially', () => {
    expect(pwa.isSwRegistered()).toBe(false);
  });

  it('getSwRegistration returns null initially', () => {
    expect(pwa.getSwRegistration()).toBeNull();
  });

  it('checkForUpdate returns false when no SW registered', () => {
    expect(pwa.checkForUpdate()).toBe(false);
  });

  it('skipWaiting does not throw', () => {
    expect(() => pwa.skipWaiting()).not.toThrow();
  });

  it('registerServiceWorker returns false when serviceWorker not in navigator', async () => {
    // Our test navigator mock does not have serviceWorker
    const result = await pwa.registerServiceWorker();
    expect(result).toBe(false);
    expect(pwa.isSwRegistered()).toBe(false);
  });

  it('registerServiceWorker succeeds when serviceWorker is available', async () => {
    const mockRegistration = { active: true };
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        onLine: true,
        userAgent: 'test',
        serviceWorker: {
          register: vi.fn().mockResolvedValue(mockRegistration),
        },
      },
      writable: true,
      configurable: true,
    });

    PwaManager.resetForTesting();
    const mgr = PwaManager.getInstance();
    const result = await mgr.registerServiceWorker('/custom-sw.js');
    expect(result).toBe(true);
    expect(mgr.isSwRegistered()).toBe(true);
    expect(mgr.getSwRegistration()).toBe(mockRegistration);

    // Restore navigator
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: true, userAgent: 'test' },
      writable: true,
      configurable: true,
    });
  });
});

// ---------------------------------------------------------------------------
// Cache Configs
// ---------------------------------------------------------------------------

describe('PwaManager - Cache Configs', () => {
  it('has 4 built-in cache configs on creation', () => {
    expect(pwa.getCacheConfigs()).toHaveLength(4);
  });

  it('built-in configs include app-shell, api-data, images, fonts', () => {
    const names = pwa.getCacheConfigs().map((c) => c.name);
    expect(names).toContain('app-shell');
    expect(names).toContain('api-data');
    expect(names).toContain('images');
    expect(names).toContain('fonts');
  });

  it('app-shell config uses cache-first strategy', () => {
    const appShell = pwa.getCacheConfigs().find((c) => c.name === 'app-shell');
    expect(appShell?.strategy).toBe('cache-first');
  });

  it('api-data config uses network-first strategy', () => {
    const apiData = pwa.getCacheConfigs().find((c) => c.name === 'api-data');
    expect(apiData?.strategy).toBe('network-first');
  });

  it('adds a new cache config', () => {
    const config: CacheConfig = {
      name: 'custom',
      strategy: 'stale-while-revalidate',
      maxAge: 5000,
      maxEntries: 10,
      urlPatterns: ['/custom/*'],
    };
    pwa.addCacheConfig(config);
    expect(pwa.getCacheConfigs()).toHaveLength(5);
    const found = pwa.getCacheConfigs().find((c) => c.name === 'custom');
    expect(found?.strategy).toBe('stale-while-revalidate');
  });

  it('replaces existing config with same name', () => {
    const updated: CacheConfig = {
      name: 'app-shell',
      strategy: 'network-only',
      maxAge: 999,
      maxEntries: 5,
      urlPatterns: ['/new-pattern'],
    };
    pwa.addCacheConfig(updated);
    expect(pwa.getCacheConfigs()).toHaveLength(4);
    const found = pwa.getCacheConfigs().find((c) => c.name === 'app-shell');
    expect(found?.strategy).toBe('network-only');
  });

  it('removes a cache config by name', () => {
    expect(pwa.removeCacheConfig('fonts')).toBe(true);
    expect(pwa.getCacheConfigs()).toHaveLength(3);
  });

  it('returns false when removing non-existent config', () => {
    expect(pwa.removeCacheConfig('nonexistent')).toBe(false);
  });

  it('returns copies not references', () => {
    const configs = pwa.getCacheConfigs();
    configs[0].name = 'mutated';
    expect(pwa.getCacheConfigs()[0].name).not.toBe('mutated');
  });
});

// ---------------------------------------------------------------------------
// Cached Resources
// ---------------------------------------------------------------------------

describe('PwaManager - Cached Resources', () => {
  const makeResource = (url: string, cacheName = 'app-shell', size = 1024): CachedResource => ({
    url,
    cacheName,
    cachedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
    size,
    contentType: 'text/html',
  });

  it('starts with no cached resources', () => {
    expect(pwa.getCachedResources()).toHaveLength(0);
  });

  it('adds a cached resource', () => {
    pwa.addCachedResource(makeResource('/index.html'));
    expect(pwa.getCachedResources()).toHaveLength(1);
  });

  it('replaces resource with same URL', () => {
    pwa.addCachedResource(makeResource('/index.html', 'app-shell', 100));
    pwa.addCachedResource(makeResource('/index.html', 'app-shell', 200));
    expect(pwa.getCachedResources()).toHaveLength(1);
    expect(pwa.getCachedResources()[0].size).toBe(200);
  });

  it('filters by cache name', () => {
    pwa.addCachedResource(makeResource('/index.html', 'app-shell'));
    pwa.addCachedResource(makeResource('/api/data', 'api-data'));
    expect(pwa.getCachedResources('app-shell')).toHaveLength(1);
    expect(pwa.getCachedResources('api-data')).toHaveLength(1);
  });

  it('removes a cached resource by URL', () => {
    pwa.addCachedResource(makeResource('/index.html'));
    expect(pwa.removeCachedResource('/index.html')).toBe(true);
    expect(pwa.getCachedResources()).toHaveLength(0);
  });

  it('returns false when removing non-existent resource', () => {
    expect(pwa.removeCachedResource('/nonexistent')).toBe(false);
  });

  it('clears all cached resources', () => {
    pwa.addCachedResource(makeResource('/a.html'));
    pwa.addCachedResource(makeResource('/b.html'));
    pwa.clearCache();
    expect(pwa.getCachedResources()).toHaveLength(0);
  });

  it('clears resources by cache name', () => {
    pwa.addCachedResource(makeResource('/a.html', 'app-shell'));
    pwa.addCachedResource(makeResource('/api/x', 'api-data'));
    pwa.clearCache('app-shell');
    expect(pwa.getCachedResources()).toHaveLength(1);
    expect(pwa.getCachedResources()[0].cacheName).toBe('api-data');
  });

  it('calculates total cache size', () => {
    pwa.addCachedResource(makeResource('/a.html', 'app-shell', 100));
    pwa.addCachedResource(makeResource('/b.html', 'app-shell', 250));
    expect(pwa.getCacheSize()).toBe(350);
  });

  it('getCacheSize returns 0 when no resources', () => {
    expect(pwa.getCacheSize()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Offline Changes
// ---------------------------------------------------------------------------

describe('PwaManager - Offline Changes', () => {
  it('starts with no offline changes', () => {
    expect(pwa.getOfflineChanges()).toHaveLength(0);
  });

  it('saves an offline change', () => {
    const change = pwa.saveOfflineChange({
      type: 'create',
      entity: 'bom-item',
      entityId: '1',
      data: { name: 'Resistor' },
      timestamp: Date.now(),
    });
    expect(change.id).toBeTruthy();
    expect(change.synced).toBe(false);
    expect(change.retryCount).toBe(0);
    expect(pwa.getOfflineChanges()).toHaveLength(1);
  });

  it('getPendingChanges returns only unsynced changes', () => {
    const c1 = pwa.saveOfflineChange({
      type: 'create',
      entity: 'node',
      entityId: '1',
      data: {},
      timestamp: Date.now(),
    });
    pwa.saveOfflineChange({
      type: 'update',
      entity: 'node',
      entityId: '2',
      data: {},
      timestamp: Date.now(),
    });
    pwa.markSynced(c1.id);
    expect(pwa.getPendingChanges()).toHaveLength(1);
    expect(pwa.getOfflineChanges()).toHaveLength(2);
  });

  it('markSynced marks a change as synced', () => {
    const change = pwa.saveOfflineChange({
      type: 'update',
      entity: 'project',
      entityId: '1',
      data: { name: 'Updated' },
      timestamp: Date.now(),
    });
    pwa.markSynced(change.id);
    const synced = pwa.getOfflineChanges().find((c) => c.id === change.id);
    expect(synced?.synced).toBe(true);
  });

  it('markSyncError sets error and increments retryCount', () => {
    const change = pwa.saveOfflineChange({
      type: 'delete',
      entity: 'bom-item',
      entityId: '5',
      data: {},
      timestamp: Date.now(),
    });
    pwa.markSyncError(change.id, 'Network timeout');
    const errored = pwa.getOfflineChanges().find((c) => c.id === change.id);
    expect(errored?.syncError).toBe('Network timeout');
    expect(errored?.retryCount).toBe(1);

    pwa.markSyncError(change.id, 'Still failing');
    const errored2 = pwa.getOfflineChanges().find((c) => c.id === change.id);
    expect(errored2?.retryCount).toBe(2);
  });

  it('clearSyncedChanges removes only synced changes', () => {
    const c1 = pwa.saveOfflineChange({
      type: 'create',
      entity: 'node',
      entityId: '1',
      data: {},
      timestamp: Date.now(),
    });
    pwa.saveOfflineChange({
      type: 'create',
      entity: 'node',
      entityId: '2',
      data: {},
      timestamp: Date.now(),
    });
    pwa.markSynced(c1.id);
    pwa.clearSyncedChanges();
    expect(pwa.getOfflineChanges()).toHaveLength(1);
    expect(pwa.getPendingChanges()).toHaveLength(1);
  });

  it('returns copies not references', () => {
    pwa.saveOfflineChange({
      type: 'create',
      entity: 'test',
      entityId: '1',
      data: {},
      timestamp: Date.now(),
    });
    const changes = pwa.getOfflineChanges();
    changes[0].entity = 'mutated';
    expect(pwa.getOfflineChanges()[0].entity).toBe('test');
  });
});

// ---------------------------------------------------------------------------
// Sync State
// ---------------------------------------------------------------------------

describe('PwaManager - Sync State', () => {
  it('defaults to synced with no pending changes', () => {
    const state = pwa.getSyncState();
    expect(state.status).toBe('synced');
    expect(state.pendingChanges).toBe(0);
    expect(state.lastSyncAt).toBeNull();
    expect(state.lastSyncError).toBeNull();
  });

  it('updates to pending when changes are saved', () => {
    pwa.saveOfflineChange({
      type: 'create',
      entity: 'node',
      entityId: '1',
      data: {},
      timestamp: Date.now(),
    });
    expect(pwa.getSyncState().status).toBe('pending');
    expect(pwa.getSyncState().pendingChanges).toBe(1);
  });

  it('triggerSync syncs all pending changes when online', () => {
    pwa.saveOfflineChange({
      type: 'create',
      entity: 'node',
      entityId: '1',
      data: {},
      timestamp: Date.now(),
    });
    pwa.saveOfflineChange({
      type: 'update',
      entity: 'node',
      entityId: '2',
      data: {},
      timestamp: Date.now(),
    });

    const result = pwa.triggerSync();
    expect(result.status).toBe('synced');
    expect(result.pendingChanges).toBe(0);
    expect(result.lastSyncAt).toBeGreaterThan(0);
    expect(result.lastSyncError).toBeNull();
  });

  it('triggerSync returns synced when no pending changes', () => {
    const result = pwa.triggerSync();
    expect(result.status).toBe('synced');
    expect(result.lastSyncAt).toBeGreaterThan(0);
  });

  it('triggerSync returns error when offline', () => {
    pwa.setConnectionStatus('offline');
    pwa.saveOfflineChange({
      type: 'create',
      entity: 'node',
      entityId: '1',
      data: {},
      timestamp: Date.now(),
    });
    const result = pwa.triggerSync();
    expect(result.status).toBe('error');
    expect(result.lastSyncError).toBe('Cannot sync while offline');
  });

  it('pending count reflects actual unsynced changes', () => {
    pwa.saveOfflineChange({ type: 'create', entity: 'a', entityId: '1', data: {}, timestamp: Date.now() });
    pwa.saveOfflineChange({ type: 'create', entity: 'b', entityId: '2', data: {}, timestamp: Date.now() });
    pwa.saveOfflineChange({ type: 'create', entity: 'c', entityId: '3', data: {}, timestamp: Date.now() });
    expect(pwa.getSyncState().pendingChanges).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Conflict Resolution
// ---------------------------------------------------------------------------

describe('PwaManager - Conflict Resolution', () => {
  it('getConflicts returns changes with sync errors', () => {
    const change = pwa.saveOfflineChange({
      type: 'update',
      entity: 'project',
      entityId: '1',
      data: { name: 'New' },
      timestamp: Date.now(),
    });
    pwa.markSyncError(change.id, 'Version conflict');
    expect(pwa.getConflicts()).toHaveLength(1);
    expect(pwa.getSyncState().status).toBe('conflict');
  });

  it('resolveConflict with remote removes the change', () => {
    const change = pwa.saveOfflineChange({
      type: 'update',
      entity: 'project',
      entityId: '1',
      data: {},
      timestamp: Date.now(),
    });
    pwa.markSyncError(change.id, 'Conflict');
    pwa.resolveConflict(change.id, 'remote');
    expect(pwa.getOfflineChanges()).toHaveLength(0);
    expect(pwa.getConflicts()).toHaveLength(0);
  });

  it('resolveConflict with local clears error and keeps change', () => {
    const change = pwa.saveOfflineChange({
      type: 'update',
      entity: 'project',
      entityId: '1',
      data: {},
      timestamp: Date.now(),
    });
    pwa.markSyncError(change.id, 'Conflict');
    pwa.resolveConflict(change.id, 'local');
    const remaining = pwa.getOfflineChanges();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].synced).toBe(false);
    expect(remaining[0].syncError).toBeUndefined();
  });

  it('resolveConflict with unknown changeId does nothing', () => {
    pwa.saveOfflineChange({
      type: 'create',
      entity: 'node',
      entityId: '1',
      data: {},
      timestamp: Date.now(),
    });
    pwa.resolveConflict('nonexistent', 'remote');
    expect(pwa.getOfflineChanges()).toHaveLength(1);
  });

  it('conflict count reflects errored changes', () => {
    const c1 = pwa.saveOfflineChange({ type: 'update', entity: 'a', entityId: '1', data: {}, timestamp: Date.now() });
    const c2 = pwa.saveOfflineChange({ type: 'update', entity: 'b', entityId: '2', data: {}, timestamp: Date.now() });
    pwa.markSyncError(c1.id, 'err1');
    pwa.markSyncError(c2.id, 'err2');
    expect(pwa.getSyncState().conflictCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Install State
// ---------------------------------------------------------------------------

describe('PwaManager - Install State', () => {
  it('defaults to not installable and not installed', () => {
    const state = pwa.getInstallState();
    expect(state.canInstall).toBe(false);
    expect(state.isInstalled).toBe(false);
  });

  it('setInstallable updates canInstall', () => {
    pwa.setInstallable(true);
    expect(pwa.getInstallState().canInstall).toBe(true);
  });

  it('setInstalled updates isInstalled', () => {
    pwa.setInstalled(true);
    expect(pwa.getInstallState().isInstalled).toBe(true);
  });

  it('detectPlatform returns unknown for generic user agent', () => {
    expect(pwa.detectPlatform()).toBe('unknown');
  });

  it('detectPlatform detects android', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: true, userAgent: 'Mozilla/5.0 (Linux; Android 10)' },
      writable: true,
      configurable: true,
    });
    PwaManager.resetForTesting();
    const mgr = PwaManager.getInstance();
    expect(mgr.detectPlatform()).toBe('android');

    // Restore
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: true, userAgent: 'test' },
      writable: true,
      configurable: true,
    });
  });

  it('detectPlatform detects iOS', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0)' },
      writable: true,
      configurable: true,
    });
    PwaManager.resetForTesting();
    const mgr = PwaManager.getInstance();
    expect(mgr.detectPlatform()).toBe('ios');

    // Restore
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: true, userAgent: 'test' },
      writable: true,
      configurable: true,
    });
  });

  it('detectPlatform detects desktop', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: true, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      writable: true,
      configurable: true,
    });
    PwaManager.resetForTesting();
    const mgr = PwaManager.getInstance();
    expect(mgr.detectPlatform()).toBe('desktop');

    // Restore
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: true, userAgent: 'test' },
      writable: true,
      configurable: true,
    });
  });

  it('returns a copy not a reference', () => {
    const state = pwa.getInstallState();
    state.canInstall = true;
    expect(pwa.getInstallState().canInstall).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Offline Projects
// ---------------------------------------------------------------------------

describe('PwaManager - Offline Projects', () => {
  it('starts with no offline projects', () => {
    expect(pwa.getAllOfflineProjects()).toHaveLength(0);
  });

  it('saves an offline project', () => {
    const project = pwa.saveProjectOffline({
      id: 'p1',
      name: 'Rover Control',
      data: { nodes: [], edges: [] },
      dirty: false,
    });
    expect(project.id).toBe('p1');
    expect(project.name).toBe('Rover Control');
    expect(project.savedAt).toBeGreaterThan(0);
    expect(project.size).toBeGreaterThan(0);
    expect(project.dirty).toBe(false);
  });

  it('getOfflineProject retrieves by ID', () => {
    pwa.saveProjectOffline({ id: 'p1', name: 'Test', data: {}, dirty: false });
    const found = pwa.getOfflineProject('p1');
    expect(found).not.toBeNull();
    expect(found?.name).toBe('Test');
  });

  it('getOfflineProject returns null for unknown ID', () => {
    expect(pwa.getOfflineProject('nonexistent')).toBeNull();
  });

  it('getAllOfflineProjects returns all projects', () => {
    pwa.saveProjectOffline({ id: 'p1', name: 'A', data: {}, dirty: false });
    pwa.saveProjectOffline({ id: 'p2', name: 'B', data: {}, dirty: false });
    expect(pwa.getAllOfflineProjects()).toHaveLength(2);
  });

  it('overwrites existing project with same ID', () => {
    pwa.saveProjectOffline({ id: 'p1', name: 'Original', data: {}, dirty: false });
    pwa.saveProjectOffline({ id: 'p1', name: 'Updated', data: { key: 'val' }, dirty: false });
    expect(pwa.getAllOfflineProjects()).toHaveLength(1);
    expect(pwa.getOfflineProject('p1')?.name).toBe('Updated');
  });

  it('removeOfflineProject removes by ID', () => {
    pwa.saveProjectOffline({ id: 'p1', name: 'Test', data: {}, dirty: false });
    expect(pwa.removeOfflineProject('p1')).toBe(true);
    expect(pwa.getAllOfflineProjects()).toHaveLength(0);
  });

  it('removeOfflineProject returns false for unknown ID', () => {
    expect(pwa.removeOfflineProject('nonexistent')).toBe(false);
  });

  it('markProjectDirty sets dirty flag', () => {
    pwa.saveProjectOffline({ id: 'p1', name: 'Test', data: {}, dirty: false });
    pwa.markProjectDirty('p1');
    expect(pwa.getOfflineProject('p1')?.dirty).toBe(true);
  });

  it('markProjectDirty does nothing for unknown project', () => {
    expect(() => pwa.markProjectDirty('nonexistent')).not.toThrow();
  });

  it('returns copies not references', () => {
    pwa.saveProjectOffline({ id: 'p1', name: 'Test', data: {}, dirty: false });
    const projects = pwa.getAllOfflineProjects();
    projects[0].name = 'mutated';
    expect(pwa.getAllOfflineProjects()[0].name).toBe('Test');
  });
});

// ---------------------------------------------------------------------------
// Storage Estimate
// ---------------------------------------------------------------------------

describe('PwaManager - Storage Estimate', () => {
  it('returns zero usage when no cached resources', () => {
    const estimate = pwa.getStorageEstimate();
    expect(estimate.usage).toBe(0);
    expect(estimate.quota).toBeGreaterThan(0);
    expect(estimate.percentUsed).toBe(0);
    expect(estimate.cacheBreakdown).toHaveLength(0);
  });

  it('calculates usage from cached resources', () => {
    pwa.addCachedResource({
      url: '/a.html',
      cacheName: 'app-shell',
      cachedAt: Date.now(),
      expiresAt: Date.now() + 1000,
      size: 500,
      contentType: 'text/html',
    });
    pwa.addCachedResource({
      url: '/b.js',
      cacheName: 'app-shell',
      cachedAt: Date.now(),
      expiresAt: Date.now() + 1000,
      size: 300,
      contentType: 'application/javascript',
    });
    const estimate = pwa.getStorageEstimate();
    expect(estimate.usage).toBe(800);
    expect(estimate.percentUsed).toBeGreaterThan(0);
  });

  it('provides cache breakdown by name', () => {
    pwa.addCachedResource({
      url: '/a.html',
      cacheName: 'app-shell',
      cachedAt: Date.now(),
      expiresAt: Date.now() + 1000,
      size: 100,
      contentType: 'text/html',
    });
    pwa.addCachedResource({
      url: '/api/data',
      cacheName: 'api-data',
      cachedAt: Date.now(),
      expiresAt: Date.now() + 1000,
      size: 200,
      contentType: 'application/json',
    });
    const estimate = pwa.getStorageEstimate();
    expect(estimate.cacheBreakdown).toHaveLength(2);
    const appShell = estimate.cacheBreakdown.find((b) => b.cacheName === 'app-shell');
    expect(appShell?.size).toBe(100);
    expect(appShell?.entryCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Export / Import State
// ---------------------------------------------------------------------------

describe('PwaManager - Export/Import State', () => {
  it('exports state as JSON string', () => {
    const json = pwa.exportState();
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed.connectionStatus).toBe('online');
    expect(Array.isArray(parsed.cacheConfigs)).toBe(true);
    expect(Array.isArray(parsed.offlineProjects)).toBe(true);
  });

  it('round-trips state through export and import', () => {
    pwa.saveProjectOffline({ id: 'p1', name: 'My Project', data: { x: 1 }, dirty: false });
    pwa.saveOfflineChange({
      type: 'create',
      entity: 'node',
      entityId: '1',
      data: {},
      timestamp: Date.now(),
    });
    pwa.setConnectionStatus('slow');

    const exported = pwa.exportState();

    PwaManager.resetForTesting();
    const newPwa = PwaManager.getInstance();
    const result = newPwa.importState(exported);

    expect(result.imported).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
    expect(newPwa.getConnectionStatus()).toBe('slow');
    expect(newPwa.getAllOfflineProjects()).toHaveLength(1);
    expect(newPwa.getOfflineChanges()).toHaveLength(1);
  });

  it('handles malformed JSON on import', () => {
    const result = pwa.importState('not valid json {{{');
    expect(result.imported).toBe(0);
    expect(result.errors).toContain('Invalid JSON');
  });

  it('handles non-object JSON on import', () => {
    const result = pwa.importState('"just a string"');
    expect(result.imported).toBe(0);
    expect(result.errors).toContain('State must be an object');
  });

  it('handles empty object on import', () => {
    const result = pwa.importState('{}');
    expect(result.imported).toBe(0);
    expect(result.errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Built-in Cache Configs
// ---------------------------------------------------------------------------

describe('PwaManager - Built-in Cache Config Details', () => {
  it('app-shell has maxAge of 7 days', () => {
    const cfg = pwa.getCacheConfigs().find((c) => c.name === 'app-shell');
    expect(cfg?.maxAge).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('api-data has maxAge of 1 hour', () => {
    const cfg = pwa.getCacheConfigs().find((c) => c.name === 'api-data');
    expect(cfg?.maxAge).toBe(60 * 60 * 1000);
  });

  it('images has maxAge of 30 days', () => {
    const cfg = pwa.getCacheConfigs().find((c) => c.name === 'images');
    expect(cfg?.maxAge).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('fonts has maxAge of 365 days', () => {
    const cfg = pwa.getCacheConfigs().find((c) => c.name === 'fonts');
    expect(cfg?.maxAge).toBe(365 * 24 * 60 * 60 * 1000);
  });

  it('app-shell has correct url patterns', () => {
    const cfg = pwa.getCacheConfigs().find((c) => c.name === 'app-shell');
    expect(cfg?.urlPatterns).toEqual(['/*.html', '/*.js', '/*.css']);
  });

  it('api-data has correct url patterns', () => {
    const cfg = pwa.getCacheConfigs().find((c) => c.name === 'api-data');
    expect(cfg?.urlPatterns).toEqual(['/api/*']);
  });
});

// ---------------------------------------------------------------------------
// localStorage Persistence
// ---------------------------------------------------------------------------

describe('PwaManager - localStorage Persistence', () => {
  it('persists state to localStorage on changes', () => {
    pwa.setConnectionStatus('offline');
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'protopulse-pwa-manager',
      expect.any(String),
    );
  });

  it('loads persisted state on new instance', () => {
    pwa.saveProjectOffline({ id: 'p1', name: 'Persisted', data: {}, dirty: false });
    pwa.setConnectionStatus('slow');

    PwaManager.resetForTesting();
    const newPwa = PwaManager.getInstance();
    expect(newPwa.getConnectionStatus()).toBe('slow');
    expect(newPwa.getAllOfflineProjects()).toHaveLength(1);
    expect(newPwa.getAllOfflineProjects()[0].name).toBe('Persisted');
  });

  it('handles corrupt localStorage data gracefully', () => {
    store['protopulse-pwa-manager'] = 'not-valid-json!!!';
    PwaManager.resetForTesting();
    const newPwa = PwaManager.getInstance();
    // Should fall back to defaults
    expect(newPwa.getCacheConfigs()).toHaveLength(4);
  });

  it('handles missing localStorage data', () => {
    PwaManager.resetForTesting();
    const newPwa = PwaManager.getInstance();
    expect(newPwa.getConnectionStatus()).toBe('online');
  });
});

// ---------------------------------------------------------------------------
// Subscribe / Notify
// ---------------------------------------------------------------------------

describe('PwaManager - Subscribe/Notify', () => {
  it('notifies subscribers on state changes', () => {
    const listener = vi.fn();
    pwa.subscribe(listener);
    pwa.setConnectionStatus('offline');
    expect(listener).toHaveBeenCalled();
  });

  it('unsubscribe stops notifications', () => {
    const listener = vi.fn();
    const unsub = pwa.subscribe(listener);
    unsub();
    pwa.setConnectionStatus('offline');
    expect(listener).not.toHaveBeenCalled();
  });

  it('supports multiple subscribers', () => {
    const l1 = vi.fn();
    const l2 = vi.fn();
    pwa.subscribe(l1);
    pwa.subscribe(l2);
    pwa.setConnectionStatus('slow');
    expect(l1).toHaveBeenCalled();
    expect(l2).toHaveBeenCalled();
  });

  it('notifies on cache config changes', () => {
    const listener = vi.fn();
    pwa.subscribe(listener);
    pwa.addCacheConfig({
      name: 'test',
      strategy: 'network-only',
      maxAge: 1000,
      maxEntries: 5,
      urlPatterns: ['/test/*'],
    });
    expect(listener).toHaveBeenCalled();
  });

  it('notifies on offline change save', () => {
    const listener = vi.fn();
    pwa.subscribe(listener);
    pwa.saveOfflineChange({
      type: 'create',
      entity: 'node',
      entityId: '1',
      data: {},
      timestamp: Date.now(),
    });
    expect(listener).toHaveBeenCalled();
  });

  it('notifies on project save', () => {
    const listener = vi.fn();
    pwa.subscribe(listener);
    pwa.saveProjectOffline({ id: 'p1', name: 'Test', data: {}, dirty: false });
    expect(listener).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Clear
// ---------------------------------------------------------------------------

describe('PwaManager - Clear', () => {
  it('resets all state to defaults', () => {
    pwa.setConnectionStatus('slow');
    pwa.saveProjectOffline({ id: 'p1', name: 'Test', data: {}, dirty: false });
    pwa.saveOfflineChange({
      type: 'create',
      entity: 'node',
      entityId: '1',
      data: {},
      timestamp: Date.now(),
    });
    pwa.addCachedResource({
      url: '/test',
      cacheName: 'test',
      cachedAt: Date.now(),
      expiresAt: Date.now() + 1000,
      size: 100,
      contentType: 'text/plain',
    });

    pwa.clear();

    expect(pwa.getConnectionStatus()).toBe('online');
    expect(pwa.getAllOfflineProjects()).toHaveLength(0);
    expect(pwa.getOfflineChanges()).toHaveLength(0);
    expect(pwa.getCachedResources()).toHaveLength(0);
    expect(pwa.getCacheConfigs()).toHaveLength(4); // built-ins restored
    expect(pwa.getSyncState().status).toBe('synced');
    expect(pwa.isSwRegistered()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Edge Cases
// ---------------------------------------------------------------------------

describe('PwaManager - Edge Cases', () => {
  it('sync while offline returns error state', () => {
    pwa.setConnectionStatus('offline');
    pwa.saveOfflineChange({
      type: 'create',
      entity: 'node',
      entityId: '1',
      data: {},
      timestamp: Date.now(),
    });
    const result = pwa.triggerSync();
    expect(result.status).toBe('error');
    expect(result.lastSyncError).toBe('Cannot sync while offline');
  });

  it('empty change queue on sync returns synced', () => {
    const result = pwa.triggerSync();
    expect(result.status).toBe('synced');
  });

  it('markSynced on unknown change does nothing', () => {
    pwa.markSynced('nonexistent');
    expect(pwa.getOfflineChanges()).toHaveLength(0);
  });

  it('markSyncError on unknown change does nothing', () => {
    pwa.markSyncError('nonexistent', 'error');
    expect(pwa.getOfflineChanges()).toHaveLength(0);
  });

  it('clearSyncedChanges with no changes does nothing', () => {
    expect(() => pwa.clearSyncedChanges()).not.toThrow();
    expect(pwa.getOfflineChanges()).toHaveLength(0);
  });

  it('markProjectDirty on nonexistent project does nothing', () => {
    expect(() => pwa.markProjectDirty('nope')).not.toThrow();
  });

  it('removeCacheConfig returns false for built-in after removal', () => {
    pwa.removeCacheConfig('app-shell');
    expect(pwa.removeCacheConfig('app-shell')).toBe(false);
  });

  it('clearCache on empty resources does nothing', () => {
    expect(() => pwa.clearCache()).not.toThrow();
    expect(pwa.getCachedResources()).toHaveLength(0);
  });

  it('clearCache with specific name on empty resources does nothing', () => {
    expect(() => pwa.clearCache('nonexistent')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

describe('usePwaManager - Hook', () => {
  beforeEach(() => {
    PwaManager.resetForTesting();
  });

  it('returns expected shape', () => {
    const { result } = renderHook(() => usePwaManager());
    expect(result.current).toHaveProperty('connectionStatus');
    expect(result.current).toHaveProperty('isOnline');
    expect(result.current).toHaveProperty('syncState');
    expect(result.current).toHaveProperty('pendingChanges');
    expect(result.current).toHaveProperty('cacheConfigs');
    expect(result.current).toHaveProperty('installState');
    expect(result.current).toHaveProperty('offlineProjects');
    expect(result.current).toHaveProperty('saveProjectOffline');
    expect(result.current).toHaveProperty('removeOfflineProject');
    expect(result.current).toHaveProperty('triggerSync');
    expect(result.current).toHaveProperty('resolveConflict');
    expect(result.current).toHaveProperty('getStorageEstimate');
    expect(result.current).toHaveProperty('registerServiceWorker');
    expect(result.current).toHaveProperty('isSwRegistered');
    expect(result.current).toHaveProperty('exportState');
    expect(result.current).toHaveProperty('importState');
  });

  it('connectionStatus defaults to online', () => {
    const { result } = renderHook(() => usePwaManager());
    expect(result.current.connectionStatus).toBe('online');
    expect(result.current.isOnline).toBe(true);
  });

  it('has 4 default cache configs', () => {
    const { result } = renderHook(() => usePwaManager());
    expect(result.current.cacheConfigs).toHaveLength(4);
  });

  it('syncState defaults to synced', () => {
    const { result } = renderHook(() => usePwaManager());
    expect(result.current.syncState.status).toBe('synced');
  });

  it('saveProjectOffline works through hook', () => {
    const { result } = renderHook(() => usePwaManager());
    act(() => {
      result.current.saveProjectOffline({ id: 'p1', name: 'Hook Test', data: {}, dirty: false });
    });
    expect(result.current.offlineProjects).toHaveLength(1);
  });

  it('triggerSync works through hook', () => {
    const { result } = renderHook(() => usePwaManager());
    let syncResult: SyncState | undefined;
    act(() => {
      syncResult = result.current.triggerSync();
    });
    expect(syncResult?.status).toBe('synced');
  });

  it('exportState returns JSON string', () => {
    const { result } = renderHook(() => usePwaManager());
    let json = '';
    act(() => {
      json = result.current.exportState();
    });
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('importState handles malformed JSON', () => {
    const { result } = renderHook(() => usePwaManager());
    let importResult = { imported: 0, errors: [] as string[] };
    act(() => {
      importResult = result.current.importState('bad json');
    });
    expect(importResult.errors).toContain('Invalid JSON');
  });
});
