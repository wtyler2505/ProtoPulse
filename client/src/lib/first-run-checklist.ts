/**
 * First-Run Checklist — guided onboarding for new users
 *
 * Tracks 6 key milestones: create project, add architecture node,
 * connect edges, add BOM item, run validation, export design.
 * Persists completion state per project to localStorage.
 * Singleton+subscribe pattern for React integration.
 *
 * Usage:
 *   const manager = ChecklistManager.getInstance();
 *   manager.evaluate(projectId, projectState);
 *   manager.getState(projectId); // { items: [...], dismissed: false, completedCount: 3, totalCount: 6 }
 *
 * React hook:
 *   const { items, progress, dismissed, dismiss, reset } = useFirstRunChecklist(projectId, projectState);
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChecklistStepId =
  | 'create_project'
  | 'add_node'
  | 'connect_edges'
  | 'add_bom'
  | 'run_validation'
  | 'export_design';

export interface ChecklistItem {
  id: ChecklistStepId;
  label: string;
  description: string;
  completed: boolean;
}

export interface ChecklistState {
  items: ChecklistItem[];
  dismissed: boolean;
  completedCount: number;
  totalCount: number;
}

/** Snapshot of project state used for auto-detection of step completion. */
export interface ProjectStateSnapshot {
  hasProject: boolean;
  nodeCount: number;
  edgeCount: number;
  bomItemCount: number;
  validationIssueCount: number;
  hasExported: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-first-run-checklist';

const STEP_DEFINITIONS: ReadonlyArray<{
  id: ChecklistStepId;
  label: string;
  description: string;
}> = [
  {
    id: 'create_project',
    label: 'Create a project',
    description: 'Your project is set up and ready to go.',
  },
  {
    id: 'add_node',
    label: 'Add an architecture node',
    description: 'Add a component block to your architecture diagram.',
  },
  {
    id: 'connect_edges',
    label: 'Connect two nodes',
    description: 'Draw a connection between two architecture blocks.',
  },
  {
    id: 'add_bom',
    label: 'Add a BOM item',
    description: 'Add a part to your bill of materials.',
  },
  {
    id: 'run_validation',
    label: 'Run design validation',
    description: 'Check your design for issues and warnings.',
  },
  {
    id: 'export_design',
    label: 'Export your design',
    description: 'Export to KiCad, Eagle, PDF, or another format.',
  },
];

// ---------------------------------------------------------------------------
// Persisted Data Shape
// ---------------------------------------------------------------------------

interface PersistedChecklist {
  /** Step IDs that have been completed. */
  completed: ChecklistStepId[];
  /** Whether the user has dismissed the checklist panel. */
  dismissed: boolean;
}

interface PersistedStore {
  [projectId: string]: PersistedChecklist;
}

// ---------------------------------------------------------------------------
// ChecklistManager
// ---------------------------------------------------------------------------

/**
 * Manages per-project first-run checklist state with localStorage persistence.
 * Singleton per application. Notifies subscribers on state changes.
 */
export class ChecklistManager {
  private static instance: ChecklistManager | null = null;

  private store: Map<number, PersistedChecklist>;
  private subscribers: Set<() => void>;

  constructor() {
    this.store = new Map();
    this.subscribers = new Set();
    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): ChecklistManager {
    if (!ChecklistManager.instance) {
      ChecklistManager.instance = new ChecklistManager();
    }
    return ChecklistManager.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetInstance(): void {
    ChecklistManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /** Get the full checklist state for a project. */
  getState(projectId: number): ChecklistState {
    const data = this.store.get(projectId) ?? { completed: [], dismissed: false };
    const items = STEP_DEFINITIONS.map((step) => ({
      id: step.id,
      label: step.label,
      description: step.description,
      completed: data.completed.includes(step.id),
    }));
    const completedCount = items.filter((i) => i.completed).length;

    return {
      items,
      dismissed: data.dismissed,
      completedCount,
      totalCount: STEP_DEFINITIONS.length,
    };
  }

  /** Check whether the checklist is visible (not dismissed and not all complete). */
  isVisible(projectId: number): boolean {
    const state = this.getState(projectId);
    return !state.dismissed && state.completedCount < state.totalCount;
  }

  // -----------------------------------------------------------------------
  // Commands
  // -----------------------------------------------------------------------

  /** Evaluate project state and auto-mark completed steps. */
  evaluate(projectId: number, snapshot: ProjectStateSnapshot): void {
    const data = this.getOrCreate(projectId);
    const before = data.completed.length;

    if (snapshot.hasProject && !data.completed.includes('create_project')) {
      data.completed.push('create_project');
    }
    if (snapshot.nodeCount >= 1 && !data.completed.includes('add_node')) {
      data.completed.push('add_node');
    }
    if (snapshot.edgeCount >= 1 && !data.completed.includes('connect_edges')) {
      data.completed.push('connect_edges');
    }
    if (snapshot.bomItemCount >= 1 && !data.completed.includes('add_bom')) {
      data.completed.push('add_bom');
    }
    if (snapshot.validationIssueCount >= 0 && snapshot.hasProject && !data.completed.includes('run_validation')) {
      // Validation is considered "run" if there are any issues — meaning the user has actually triggered it.
      // An empty validation list is ambiguous (could be no issues or never run), so we require at least 1.
      if (snapshot.validationIssueCount >= 1) {
        data.completed.push('run_validation');
      }
    }
    if (snapshot.hasExported && !data.completed.includes('export_design')) {
      data.completed.push('export_design');
    }

    if (data.completed.length !== before) {
      this.save();
      this.notify();
    }
  }

  /** Manually mark a step as completed. */
  markCompleted(projectId: number, stepId: ChecklistStepId): void {
    const data = this.getOrCreate(projectId);
    if (!data.completed.includes(stepId)) {
      data.completed.push(stepId);
      this.save();
      this.notify();
    }
  }

  /** Dismiss the checklist panel for a project. */
  dismiss(projectId: number): void {
    const data = this.getOrCreate(projectId);
    if (!data.dismissed) {
      data.dismissed = true;
      this.save();
      this.notify();
    }
  }

  /** Reset checklist state for a project (un-dismiss + clear completions). */
  reset(projectId: number): void {
    this.store.set(projectId, { completed: [], dismissed: false });
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Subscribe
  // -----------------------------------------------------------------------

  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private getOrCreate(projectId: number): PersistedChecklist {
    let data = this.store.get(projectId);
    if (!data) {
      data = { completed: [], dismissed: false };
      this.store.set(projectId, data);
    }
    return data;
  }

  private notify(): void {
    Array.from(this.subscribers).forEach((cb) => {
      cb();
    });
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed: PersistedStore = JSON.parse(raw) as PersistedStore;
      for (const [key, value] of Object.entries(parsed)) {
        const pid = Number(key);
        if (Number.isFinite(pid) && value && Array.isArray(value.completed)) {
          this.store.set(pid, {
            completed: value.completed.filter((id): id is ChecklistStepId =>
              STEP_DEFINITIONS.some((s) => s.id === id),
            ),
            dismissed: Boolean(value.dismissed),
          });
        }
      }
    } catch {
      // Corrupted localStorage — start fresh
    }
  }

  private save(): void {
    try {
      const obj: PersistedStore = {};
      Array.from(this.store.entries()).forEach(([pid, data]) => {
        obj[String(pid)] = data;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch {
      // localStorage full or unavailable — silently ignore
    }
  }
}

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

export function useFirstRunChecklist(projectId: number, snapshot: ProjectStateSnapshot) {
  const manager = ChecklistManager.getInstance();
  const [state, setState] = useState<ChecklistState>(() => manager.getState(projectId));

  useEffect(() => {
    const unsubscribe = manager.subscribe(() => {
      setState(manager.getState(projectId));
    });
    return unsubscribe;
  }, [manager, projectId]);

  // Re-evaluate whenever the snapshot changes
  useEffect(() => {
    manager.evaluate(projectId, snapshot);
  }, [manager, projectId, snapshot]);

  const dismiss = useCallback(() => {
    manager.dismiss(projectId);
  }, [manager, projectId]);

  const reset = useCallback(() => {
    manager.reset(projectId);
  }, [manager, projectId]);

  const markCompleted = useCallback(
    (stepId: ChecklistStepId) => {
      manager.markCompleted(projectId, stepId);
    },
    [manager, projectId],
  );

  const progress = state.totalCount > 0 ? state.completedCount / state.totalCount : 0;

  return {
    items: state.items,
    completedCount: state.completedCount,
    totalCount: state.totalCount,
    progress,
    dismissed: state.dismissed,
    visible: !state.dismissed && state.completedCount < state.totalCount,
    dismiss,
    reset,
    markCompleted,
  };
}
