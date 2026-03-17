/**
 * Panel Load Manager — orchestrates lazy panel loading with priority ordering
 * and dependency resolution.
 *
 * Each panel in the workspace can register itself with a priority and optional
 * dependencies.  `loadPanelsInPriority()` loads them sequentially from highest
 * to lowest priority, respecting dependency chains.  The companion
 * `usePanelLoad` hook wires a React component into the manager's state.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Lifecycle states a panel transitions through. */
export type PanelLoadState = 'idle' | 'loading' | 'loaded' | 'error';

/** Configuration supplied when a panel registers with the manager. */
export interface PanelLoadConfig {
  /** Higher numbers load first. */
  priority: number;
  /** If `true` the panel should be loaded lazily (only on demand). */
  lazy: boolean;
  /** IDs of panels that must reach `'loaded'` before this panel can load. */
  dependencies?: string[];
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface PanelEntry {
  config: PanelLoadConfig;
  state: PanelLoadState;
  error?: string;
}

// ---------------------------------------------------------------------------
// PanelLoadManager (singleton + subscribe)
// ---------------------------------------------------------------------------

export class PanelLoadManager {
  private static instance: PanelLoadManager | null = null;

  private panels: Map<string, PanelEntry> = new Map();
  private subscribers: Set<() => void> = new Set();

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  static getInstance(): PanelLoadManager {
    if (!PanelLoadManager.instance) {
      PanelLoadManager.instance = new PanelLoadManager();
    }
    return PanelLoadManager.instance;
  }

  /** Reset singleton — useful for testing. */
  static resetInstance(): void {
    PanelLoadManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Registration
  // -----------------------------------------------------------------------

  /** Register a panel with the given config.  Starts in `'idle'` state. */
  registerPanel(id: string, config: PanelLoadConfig): void {
    this.panels.set(id, { config, state: 'idle' });
    this.notify();
  }

  /** Remove a panel registration entirely. */
  unregisterPanel(id: string): void {
    this.panels.delete(id);
    this.notify();
  }

  // -----------------------------------------------------------------------
  // State queries
  // -----------------------------------------------------------------------

  /** Return the current load state for a panel, or `'idle'` if unregistered. */
  getPanelState(id: string): PanelLoadState {
    return this.panels.get(id)?.state ?? 'idle';
  }

  /** Return the error message for a panel (if any). */
  getPanelError(id: string): string | undefined {
    return this.panels.get(id)?.error;
  }

  /** Return the config for a registered panel, or `undefined`. */
  getPanelConfig(id: string): PanelLoadConfig | undefined {
    return this.panels.get(id)?.config;
  }

  /** Return all registered panel IDs. */
  getRegisteredPanelIds(): string[] {
    return Array.from(this.panels.keys());
  }

  // -----------------------------------------------------------------------
  // Loading
  // -----------------------------------------------------------------------

  /**
   * Load a single panel by ID.
   *
   * Transitions: idle → loading → loaded  (or → error on failure).
   * If the panel has unmet dependencies (not yet `'loaded'`) the call rejects.
   * Loading an already-loaded panel is a no-op.
   */
  async loadPanel(id: string): Promise<void> {
    const entry = this.panels.get(id);
    if (!entry) {
      throw new Error(`Panel "${id}" is not registered.`);
    }

    // Already loaded or currently loading — no-op.
    if (entry.state === 'loaded' || entry.state === 'loading') {
      return;
    }

    // Dependency check.
    const deps = entry.config.dependencies ?? [];
    const unmet = deps.filter((dep) => this.getPanelState(dep) !== 'loaded');
    if (unmet.length > 0) {
      const msg = `Panel "${id}" has unmet dependencies: ${unmet.join(', ')}`;
      entry.state = 'error';
      entry.error = msg;
      this.notify();
      throw new Error(msg);
    }

    // Transition to loading.
    entry.state = 'loading';
    entry.error = undefined;
    this.notify();

    // Simulate async work (in a real app this would be a dynamic import).
    try {
      await Promise.resolve();
      entry.state = 'loaded';
      entry.error = undefined;
    } catch (err) {
      entry.state = 'error';
      entry.error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      this.notify();
    }
  }

  /**
   * Load multiple panels sequentially, ordered by priority (highest first).
   *
   * Panels whose dependencies are not in the provided list *and* are not
   * already `'loaded'` will be skipped (transition to error).
   */
  async loadPanelsInPriority(panelIds: string[]): Promise<void> {
    // Sort by priority descending (highest first).
    const sorted = [...panelIds].sort((a, b) => {
      const pa = this.panels.get(a)?.config.priority ?? 0;
      const pb = this.panels.get(b)?.config.priority ?? 0;
      return pb - pa;
    });

    for (const id of sorted) {
      try {
        await this.loadPanel(id);
      } catch {
        // Individual failures are recorded on the panel entry; continue with
        // the remaining panels so that independent ones still load.
      }
    }
  }

  /**
   * Force a panel back to `'idle'` so it can be retried.
   * Only meaningful when the panel is in `'error'` state.
   */
  resetPanel(id: string): void {
    const entry = this.panels.get(id);
    if (entry) {
      entry.state = 'idle';
      entry.error = undefined;
      this.notify();
    }
  }

  // -----------------------------------------------------------------------
  // Subscribe / notify
  // -----------------------------------------------------------------------

  subscribe(cb: () => void): () => void {
    this.subscribers.add(cb);
    return () => {
      this.subscribers.delete(cb);
    };
  }

  private notify(): void {
    this.subscribers.forEach((cb) => cb());
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export interface UsePanelLoadReturn {
  state: PanelLoadState;
  retry: () => void;
}

/**
 * React hook that binds to a specific panel's load state and provides a
 * `retry` callback that resets the panel to `'idle'` and attempts to load it
 * again.
 */
export function usePanelLoad(panelId: string): UsePanelLoadReturn {
  const managerRef = useRef(PanelLoadManager.getInstance());
  const [state, setState] = useState<PanelLoadState>(() => managerRef.current.getPanelState(panelId));

  useEffect(() => {
    // Sync immediately in case panelId changed since initial render.
    setState(managerRef.current.getPanelState(panelId));

    const unsubscribe = managerRef.current.subscribe(() => {
      setState(managerRef.current.getPanelState(panelId));
    });
    return unsubscribe;
  }, [panelId]);

  const retry = useCallback(() => {
    managerRef.current.resetPanel(panelId);
    void managerRef.current.loadPanel(panelId);
  }, [panelId]);

  return { state, retry };
}
