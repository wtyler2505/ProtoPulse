/**
 * Design Variable Persistence Layer
 *
 * Provides project-scoped persistence for design variables with
 * snapshot history, localStorage bridging, and migration from the
 * legacy un-scoped storage format.
 *
 * Follows the singleton+subscribe pattern used throughout ProtoPulse
 * (see FavoritesManager, CrossProbeManager, etc.).
 */

import { useCallback, useEffect, useState } from 'react';
import type { DesignVariable } from '@shared/design-variables';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A snapshot of all design variables at a point in time. */
export interface DesignVarSnapshot {
  /** Project this snapshot belongs to. */
  projectId: string;
  /** The variables captured in this snapshot. */
  variables: DesignVariable[];
  /** ISO-8601 timestamp when this snapshot was saved. */
  savedAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Prefix for project-scoped keys in localStorage. */
const PROJECT_KEY_PREFIX = 'protopulse:design-variables:project:';

/** Key for legacy (un-scoped) design variables. */
const LEGACY_STORAGE_KEY = 'protopulse:design-variables';

/** Key tracking which projects have been migrated. */
const MIGRATION_KEY = 'protopulse:design-variables:migrated';

/** Maximum number of history snapshots kept per project. */
const MAX_HISTORY = 10;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function projectKey(projectId: string): string {
  return `${PROJECT_KEY_PREFIX}${projectId}`;
}

function historyKey(projectId: string): string {
  return `${PROJECT_KEY_PREFIX}${projectId}:history`;
}

function isValidDesignVariable(item: unknown): item is DesignVariable {
  if (typeof item !== 'object' || item === null) {
    return false;
  }
  const obj = item as Record<string, unknown>;
  return typeof obj.name === 'string' && typeof obj.value === 'string';
}

function isValidSnapshot(item: unknown): item is DesignVarSnapshot {
  if (typeof item !== 'object' || item === null) {
    return false;
  }
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.projectId === 'string' &&
    typeof obj.savedAt === 'string' &&
    Array.isArray(obj.variables) &&
    (obj.variables as unknown[]).every(isValidDesignVariable)
  );
}

// ---------------------------------------------------------------------------
// DesignVarPersistence
// ---------------------------------------------------------------------------

/**
 * Singleton manager for project-scoped design variable persistence.
 *
 * Stores the current variable set per project and maintains a rolling
 * history of snapshots (last 10). Provides migration from the legacy
 * un-scoped localStorage format used by DesignVariablesPanel.
 */
export class DesignVarPersistence {
  private static instance: DesignVarPersistence | null = null;
  private subscribers: Set<() => void>;

  constructor() {
    this.subscribers = new Set();
  }

  /** Get or create the singleton instance. */
  static getInstance(): DesignVarPersistence {
    if (!DesignVarPersistence.instance) {
      DesignVarPersistence.instance = new DesignVarPersistence();
    }
    return DesignVarPersistence.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetInstance(): void {
    DesignVarPersistence.instance = null;
  }

  // -----------------------------------------------------------------------
  // Core operations
  // -----------------------------------------------------------------------

  /**
   * Export the current design variables for a project as a snapshot.
   * If no variables are stored for the project, returns a snapshot
   * with an empty variables array.
   */
  exportVariables(projectId: string): DesignVarSnapshot {
    const variables = this.loadFromProject(projectId) ?? [];
    return {
      projectId,
      variables,
      savedAt: new Date().toISOString(),
    };
  }

  /**
   * Import a snapshot, saving its variables to the target project.
   * Also appends the snapshot to the project's history.
   */
  importVariables(snapshot: DesignVarSnapshot): void {
    if (!isValidSnapshot(snapshot)) {
      return;
    }
    this.saveVariables(snapshot.projectId, snapshot.variables);
    this.appendHistory(snapshot.projectId, snapshot);
    this.notify();
  }

  /**
   * Sync a set of variables to a project, creating a timestamped snapshot
   * in history and persisting the current state.
   */
  syncToProject(projectId: string, variables: DesignVariable[]): void {
    this.saveVariables(projectId, variables);
    const snapshot: DesignVarSnapshot = {
      projectId,
      variables: [...variables],
      savedAt: new Date().toISOString(),
    };
    this.appendHistory(projectId, snapshot);
    this.notify();
  }

  /**
   * Load the most recently saved variables for a project.
   * Returns null if no variables are stored.
   */
  loadFromProject(projectId: string): DesignVariable[] | null {
    try {
      if (typeof window === 'undefined') {
        return null;
      }
      const raw = localStorage.getItem(projectKey(projectId));
      if (!raw) {
        return null;
      }
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return null;
      }
      const validated = (parsed as unknown[]).filter(isValidDesignVariable);
      return validated.length > 0 ? validated : null;
    } catch {
      return null;
    }
  }

  /**
   * Get the snapshot history for a project (last 10, newest first).
   */
  getHistory(projectId: string): DesignVarSnapshot[] {
    try {
      if (typeof window === 'undefined') {
        return [];
      }
      const raw = localStorage.getItem(historyKey(projectId));
      if (!raw) {
        return [];
      }
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      const validated = (parsed as unknown[]).filter(isValidSnapshot) as DesignVarSnapshot[];
      // Return newest first
      return validated.sort(
        (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
      );
    } catch {
      return [];
    }
  }

  // -----------------------------------------------------------------------
  // Migration
  // -----------------------------------------------------------------------

  /**
   * Migrate variables from the legacy un-scoped localStorage key
   * (`protopulse:design-variables`) to a project-scoped key.
   *
   * This is idempotent — once migrated for a given projectId, subsequent
   * calls are no-ops. The legacy key is NOT deleted (other code may still
   * read it until fully migrated).
   *
   * @returns true if migration occurred, false if already migrated or no data.
   */
  migrateFromLocalStorage(projectId: string): boolean {
    try {
      if (typeof window === 'undefined') {
        return false;
      }

      // Check if already migrated
      const migratedRaw = localStorage.getItem(MIGRATION_KEY);
      const migrated: string[] = migratedRaw ? (JSON.parse(migratedRaw) as string[]) : [];
      if (migrated.includes(projectId)) {
        return false;
      }

      // Read legacy data
      const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!legacyRaw) {
        // Mark as migrated even with no data so we don't keep checking
        migrated.push(projectId);
        localStorage.setItem(MIGRATION_KEY, JSON.stringify(migrated));
        return false;
      }

      const parsed: unknown = JSON.parse(legacyRaw);
      if (!Array.isArray(parsed)) {
        migrated.push(projectId);
        localStorage.setItem(MIGRATION_KEY, JSON.stringify(migrated));
        return false;
      }

      const variables = (parsed as unknown[]).filter(isValidDesignVariable);
      if (variables.length === 0) {
        migrated.push(projectId);
        localStorage.setItem(MIGRATION_KEY, JSON.stringify(migrated));
        return false;
      }

      // Only migrate if no project-scoped data exists yet
      const existing = localStorage.getItem(projectKey(projectId));
      if (existing) {
        migrated.push(projectId);
        localStorage.setItem(MIGRATION_KEY, JSON.stringify(migrated));
        return false;
      }

      // Save to project-scoped key
      this.saveVariables(projectId, variables);

      // Create initial history entry
      const snapshot: DesignVarSnapshot = {
        projectId,
        variables: [...variables],
        savedAt: new Date().toISOString(),
      };
      this.appendHistory(projectId, snapshot);

      // Mark as migrated
      migrated.push(projectId);
      localStorage.setItem(MIGRATION_KEY, JSON.stringify(migrated));

      this.notify();
      return true;
    } catch {
      return false;
    }
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /**
   * Subscribe to persistence state changes. Returns an unsubscribe function.
   */
  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private saveVariables(projectId: string, variables: DesignVariable[]): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      localStorage.setItem(projectKey(projectId), JSON.stringify(variables));
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }

  private appendHistory(projectId: string, snapshot: DesignVarSnapshot): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const key = historyKey(projectId);
      const raw = localStorage.getItem(key);
      let history: DesignVarSnapshot[] = [];
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          history = (parsed as unknown[]).filter(isValidSnapshot) as DesignVarSnapshot[];
        }
      }

      history.push(snapshot);

      // Trim to MAX_HISTORY, keeping most recent
      if (history.length > MAX_HISTORY) {
        history.sort(
          (a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime(),
        );
        history = history.slice(history.length - MAX_HISTORY);
      }

      localStorage.setItem(key, JSON.stringify(history));
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }

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
 * Hook for accessing design variable persistence in React components.
 *
 * Automatically attempts migration from the legacy un-scoped format on
 * first mount. Subscribes to the singleton and triggers re-renders on
 * state changes.
 */
export function useDesignVarPersistence(projectId: string): {
  /** Current variables for the project (null if none stored). */
  variables: DesignVariable[] | null;
  /** Full snapshot history for the project (newest first, max 10). */
  history: DesignVarSnapshot[];
  /** Export current variables as a snapshot. */
  exportVariables: () => DesignVarSnapshot;
  /** Import a snapshot into the project. */
  importVariables: (snapshot: DesignVarSnapshot) => void;
  /** Sync a set of variables to the project (saves + creates history entry). */
  syncToProject: (variables: DesignVariable[]) => void;
  /** Load saved variables for the project. */
  loadFromProject: () => DesignVariable[] | null;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const manager = DesignVarPersistence.getInstance();

    // Attempt migration from legacy format
    manager.migrateFromLocalStorage(projectId);

    const unsubscribe = manager.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, [projectId]);

  const exportVariables = useCallback(() => {
    return DesignVarPersistence.getInstance().exportVariables(projectId);
  }, [projectId]);

  const importVariables = useCallback((snapshot: DesignVarSnapshot) => {
    DesignVarPersistence.getInstance().importVariables(snapshot);
  }, []);

  const syncToProject = useCallback((variables: DesignVariable[]) => {
    DesignVarPersistence.getInstance().syncToProject(projectId, variables);
  }, [projectId]);

  const loadFromProject = useCallback(() => {
    return DesignVarPersistence.getInstance().loadFromProject(projectId);
  }, [projectId]);

  const manager = DesignVarPersistence.getInstance();

  return {
    variables: typeof window !== 'undefined' ? manager.loadFromProject(projectId) : null,
    history: typeof window !== 'undefined' ? manager.getHistory(projectId) : [],
    exportVariables,
    importVariables,
    syncToProject,
    loadFromProject,
  };
}
