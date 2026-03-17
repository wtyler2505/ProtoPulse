/**
 * Incident Bundle Manager
 *
 * Captures and persists diagnostic snapshots for debugging hardware/firmware
 * incidents. Each bundle includes serial logs, compile errors, resource usage,
 * and an arbitrary config snapshot — everything a user (or AI assistant) needs
 * to triage an issue without asking "can you send me your logs?"
 *
 * Persists to localStorage per-project. Evicts the oldest bundle once the
 * cap of 20 bundles per project is reached.
 *
 * Usage:
 *   const mgr = IncidentBundleManager.getInstance();
 *   const bundle = generateBundle({ timestamp: Date.now(), serialLog: [...], ... }, 'proj-1');
 *   mgr.addBundle('proj-1', bundle);
 *
 * React hook:
 *   const { bundles, addBundle, removeBundle, clearAll } = useIncidentBundles('proj-1');
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IncidentData {
  /** Epoch ms when the incident was captured. */
  timestamp: number;
  /** Target board identifier (e.g. "Arduino Mega 2560"). */
  board?: string;
  /** Lines captured from the serial monitor. */
  serialLog: string[];
  /** Compiler error / warning lines. */
  compileErrors: string[];
  /** Firmware version string (e.g. "1.2.3-rc1"). */
  firmwareVersion?: string;
  /** RAM usage in bytes. */
  ramUsage?: number;
  /** Flash usage in bytes. */
  flashUsage?: number;
  /** Freeform snapshot of tool / project settings at the time of the incident. */
  configSnapshot: Record<string, unknown>;
}

export interface IncidentBundle {
  /** Unique bundle ID (UUID v4). */
  id: string;
  /** Project this bundle belongs to. */
  projectId: string;
  /** ISO-8601 string when the bundle was created. */
  createdAt: string;
  /** Diagnostic payload. */
  data: IncidentData;
  /** Optional human-authored notes. */
  notes?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY_PREFIX = 'protopulse-incident-bundles';
const MAX_BUNDLES_PER_PROJECT = 20;

// ---------------------------------------------------------------------------
// Pure helper functions
// ---------------------------------------------------------------------------

/**
 * Build a storage key scoped to a project.
 */
function storageKey(projectId: string): string {
  return `${STORAGE_KEY_PREFIX}:${projectId}`;
}

/**
 * Create an IncidentBundle from raw diagnostic data.
 */
export function generateBundle(
  data: IncidentData,
  projectId: string,
  notes?: string,
): IncidentBundle {
  return {
    id: crypto.randomUUID(),
    projectId,
    createdAt: new Date().toISOString(),
    data,
    notes,
  };
}

/**
 * Format a bundle into a human-readable plain-text report.
 */
export function formatBundleAsText(bundle: IncidentBundle): string {
  const lines: string[] = [];

  lines.push('=== Incident Report ===');
  lines.push(`ID:        ${bundle.id}`);
  lines.push(`Project:   ${bundle.projectId}`);
  lines.push(`Created:   ${bundle.createdAt}`);

  if (bundle.notes) {
    lines.push(`Notes:     ${bundle.notes}`);
  }

  lines.push('');
  lines.push(`Timestamp: ${new Date(bundle.data.timestamp).toISOString()}`);

  if (bundle.data.board) {
    lines.push(`Board:     ${bundle.data.board}`);
  }

  if (bundle.data.firmwareVersion) {
    lines.push(`Firmware:  ${bundle.data.firmwareVersion}`);
  }

  if (bundle.data.ramUsage !== undefined) {
    lines.push(`RAM:       ${bundle.data.ramUsage} bytes`);
  }

  if (bundle.data.flashUsage !== undefined) {
    lines.push(`Flash:     ${bundle.data.flashUsage} bytes`);
  }

  if (bundle.data.serialLog.length > 0) {
    lines.push('');
    lines.push('--- Serial Log ---');
    for (const line of bundle.data.serialLog) {
      lines.push(line);
    }
  }

  if (bundle.data.compileErrors.length > 0) {
    lines.push('');
    lines.push('--- Compile Errors ---');
    for (const line of bundle.data.compileErrors) {
      lines.push(line);
    }
  }

  if (Object.keys(bundle.data.configSnapshot).length > 0) {
    lines.push('');
    lines.push('--- Config Snapshot ---');
    lines.push(JSON.stringify(bundle.data.configSnapshot, null, 2));
  }

  return lines.join('\n');
}

/**
 * Serialize a bundle to a formatted JSON string (suitable for export / clipboard).
 */
export function formatBundleAsJson(bundle: IncidentBundle): string {
  return JSON.stringify(bundle, null, 2);
}

/**
 * Produce a single-line summary of a bundle for list views.
 */
export function getBundleSummary(bundle: IncidentBundle): string {
  const parts: string[] = [];

  parts.push(`[${bundle.id.slice(0, 8)}]`);
  parts.push(new Date(bundle.data.timestamp).toLocaleString());

  if (bundle.data.board) {
    parts.push(bundle.data.board);
  }

  const errorCount = bundle.data.compileErrors.length;
  if (errorCount > 0) {
    parts.push(`${errorCount} error${errorCount === 1 ? '' : 's'}`);
  }

  const logCount = bundle.data.serialLog.length;
  if (logCount > 0) {
    parts.push(`${logCount} log line${logCount === 1 ? '' : 's'}`);
  }

  if (bundle.notes) {
    parts.push(`"${bundle.notes}"`);
  }

  return parts.join(' | ');
}

// ---------------------------------------------------------------------------
// IncidentBundleManager
// ---------------------------------------------------------------------------

type Listener = () => void;

/**
 * Singleton manager for incident bundles. Stores per-project bundles in
 * localStorage and notifies subscribers on mutation.
 */
export class IncidentBundleManager {
  private static instance: IncidentBundleManager | null = null;

  /** In-memory cache keyed by projectId. */
  private cache: Map<string, IncidentBundle[]>;
  private subscribers: Set<Listener>;

  constructor() {
    this.cache = new Map();
    this.subscribers = new Set();
  }

  /** Get or create the singleton instance. */
  static getInstance(): IncidentBundleManager {
    if (!IncidentBundleManager.instance) {
      IncidentBundleManager.instance = new IncidentBundleManager();
    }
    return IncidentBundleManager.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetInstance(): void {
    IncidentBundleManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /**
   * Get all bundles for a project, newest first.
   * Returns a defensive copy.
   */
  getBundles(projectId: string): IncidentBundle[] {
    this.ensureLoaded(projectId);
    const bundles = this.cache.get(projectId) ?? [];
    return [...bundles].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  /** Get a single bundle by ID within a project. */
  getBundle(projectId: string, bundleId: string): IncidentBundle | undefined {
    this.ensureLoaded(projectId);
    const bundles = this.cache.get(projectId) ?? [];
    return bundles.find((b) => b.id === bundleId);
  }

  /** Get the number of bundles stored for a project. */
  getCount(projectId: string): number {
    this.ensureLoaded(projectId);
    return (this.cache.get(projectId) ?? []).length;
  }

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------

  /**
   * Store a bundle. If the per-project cap (20) is reached, the oldest
   * bundle is evicted before the new one is inserted.
   */
  addBundle(projectId: string, bundle: IncidentBundle): void {
    this.ensureLoaded(projectId);
    const bundles = this.cache.get(projectId) ?? [];

    // Deduplicate by ID
    if (bundles.some((b) => b.id === bundle.id)) {
      return;
    }

    bundles.push(bundle);

    // Enforce max — evict oldest
    if (bundles.length > MAX_BUNDLES_PER_PROJECT) {
      bundles.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      bundles.shift(); // remove oldest
    }

    this.cache.set(projectId, bundles);
    this.save(projectId);
    this.notify();
  }

  /** Remove a bundle by ID. No-op if the bundle doesn't exist. */
  removeBundle(projectId: string, bundleId: string): void {
    this.ensureLoaded(projectId);
    const bundles = this.cache.get(projectId) ?? [];
    const idx = bundles.findIndex((b) => b.id === bundleId);
    if (idx === -1) {
      return;
    }
    bundles.splice(idx, 1);
    this.cache.set(projectId, bundles);
    this.save(projectId);
    this.notify();
  }

  /** Remove all bundles for a project. */
  clearAll(projectId: string): void {
    this.ensureLoaded(projectId);
    const bundles = this.cache.get(projectId) ?? [];
    if (bundles.length === 0) {
      return;
    }
    this.cache.set(projectId, []);
    this.save(projectId);
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   * Callback fires on any add/remove/clear mutation across all projects.
   */
  subscribe(callback: Listener): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  // -----------------------------------------------------------------------
  // Persistence (private)
  // -----------------------------------------------------------------------

  private save(projectId: string): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const bundles = this.cache.get(projectId) ?? [];
      localStorage.setItem(storageKey(projectId), JSON.stringify(bundles));
    } catch {
      // localStorage unavailable or quota exceeded — silent
    }
  }

  private ensureLoaded(projectId: string): void {
    if (this.cache.has(projectId)) {
      return;
    }
    this.cache.set(projectId, this.loadFromStorage(projectId));
  }

  private loadFromStorage(projectId: string): IncidentBundle[] {
    try {
      if (typeof window === 'undefined') {
        return [];
      }
      const raw = localStorage.getItem(storageKey(projectId));
      if (!raw) {
        return [];
      }
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter(
        (item: unknown): item is IncidentBundle =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as IncidentBundle).id === 'string' &&
          typeof (item as IncidentBundle).projectId === 'string' &&
          typeof (item as IncidentBundle).createdAt === 'string' &&
          typeof (item as IncidentBundle).data === 'object' &&
          (item as IncidentBundle).data !== null &&
          Array.isArray((item as IncidentBundle).data.serialLog) &&
          Array.isArray((item as IncidentBundle).data.compileErrors),
      );
    } catch {
      return [];
    }
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private notify(): void {
    this.subscribers.forEach((cb) => {
      cb();
    });
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook for accessing incident bundles for a specific project.
 * Subscribes to the IncidentBundleManager and re-renders on mutations.
 */
export function useIncidentBundles(projectId: string): {
  bundles: IncidentBundle[];
  addBundle: (bundle: IncidentBundle) => void;
  removeBundle: (bundleId: string) => void;
  clearAll: () => void;
  count: number;
  getBundle: (bundleId: string) => IncidentBundle | undefined;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const manager = IncidentBundleManager.getInstance();
    const unsubscribe = manager.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const addBundle = useCallback(
    (bundle: IncidentBundle) => {
      IncidentBundleManager.getInstance().addBundle(projectId, bundle);
    },
    [projectId],
  );

  const removeBundle = useCallback(
    (bundleId: string) => {
      IncidentBundleManager.getInstance().removeBundle(projectId, bundleId);
    },
    [projectId],
  );

  const clearAll = useCallback(() => {
    IncidentBundleManager.getInstance().clearAll(projectId);
  }, [projectId]);

  const getBundle = useCallback(
    (bundleId: string) => {
      return IncidentBundleManager.getInstance().getBundle(projectId, bundleId);
    },
    [projectId],
  );

  const manager = IncidentBundleManager.getInstance();

  return {
    bundles: typeof window !== 'undefined' ? manager.getBundles(projectId) : [],
    addBundle,
    removeBundle,
    clearAll,
    count: typeof window !== 'undefined' ? manager.getCount(projectId) : 0,
    getBundle,
  };
}
