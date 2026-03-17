/**
 * Smart Reminders — proactive project health reminder system.
 *
 * Evaluates the current state of a ProtoPulse project against a library of
 * built-in rules and surfaces actionable reminders so makers don't forget
 * critical steps in their workflow (DRC, simulation, exports, backups, etc.).
 *
 * Singleton+subscribe pattern — the SmartReminderManager evaluates rules,
 * tracks dismissed reminders, and notifies React via the useSmartReminders hook.
 *
 * Usage:
 *   const mgr = SmartReminderManager.getInstance();
 *   const reminders = mgr.evaluateReminders(progress);
 *   mgr.dismissReminder(reminders[0].id);
 *
 * React hook:
 *   const { reminders, dismissReminder, activeCount } = useSmartReminders(progress);
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReminderPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Reminder {
  id: string;
  title: string;
  description: string;
  priority: ReminderPriority;
  triggerCondition: string;
  dismissed: boolean;
  createdAt: number;
}

export interface ProjectProgress {
  /** Number of architecture nodes placed. */
  nodeCount: number;
  /** Number of BOM items. */
  bomItemCount: number;
  /** How many BOM items are missing part numbers. */
  bomItemsMissingPartNumber: number;
  /** Whether DRC has been run at least once. */
  drcRunAtLeastOnce: boolean;
  /** Number of unresolved DRC violations. */
  unresolvedDrcViolations: number;
  /** Whether at least one simulation has been executed. */
  simulationRunAtLeastOnce: boolean;
  /** Whether any export has been performed. */
  exportPerformedAtLeastOnce: boolean;
  /** Number of unaddressed lifecycle warnings. */
  lifecycleWarningsCount: number;
  /** Number of design snapshots saved. */
  designSnapshotCount: number;
  /** Whether there are unsaved changes. */
  hasUnsavedChanges: boolean;
  /** Whether project documentation/description exists. */
  hasDocumentation: boolean;
  /** Whether a backup has been created at least once. */
  backupCreatedAtLeastOnce: boolean;
  /** Number of circuit designs in the project. */
  circuitDesignCount: number;
  /** Milliseconds since last backup (null if never backed up). */
  msSinceLastBackup: number | null;
  /** Number of nets with no connections. */
  floatingNetCount: number;
}

export interface ReminderRule {
  id: string;
  check: (progress: ProjectProgress) => Reminder | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReminder(
  ruleId: string,
  title: string,
  description: string,
  priority: ReminderPriority,
  triggerCondition: string,
): Reminder {
  return {
    id: ruleId,
    title,
    description,
    priority,
    triggerCondition,
    dismissed: false,
    createdAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Built-in rules (10+)
// ---------------------------------------------------------------------------

function makeDrcNotRunRule(): ReminderRule {
  return {
    id: 'drc-not-run',
    check(progress) {
      if (progress.nodeCount >= 3 && !progress.drcRunAtLeastOnce) {
        return makeReminder(
          'drc-not-run',
          'Run Design Rule Check',
          'Your design has components but DRC has never been run. Run DRC to catch wiring errors, missing connections, and design rule violations early.',
          'high',
          'nodeCount >= 3 && !drcRunAtLeastOnce',
        );
      }
      return null;
    },
  };
}

function makeBomIncompleteRule(): ReminderRule {
  return {
    id: 'bom-incomplete',
    check(progress) {
      if (progress.bomItemCount > 0 && progress.bomItemsMissingPartNumber > 0) {
        return makeReminder(
          'bom-incomplete',
          'Complete BOM Part Numbers',
          `${progress.bomItemsMissingPartNumber} BOM item(s) are missing part numbers. Complete the BOM before ordering or exporting to avoid procurement delays.`,
          'medium',
          'bomItemsMissingPartNumber > 0',
        );
      }
      return null;
    },
  };
}

function makeNoSimulationResultsRule(): ReminderRule {
  return {
    id: 'no-simulation-results',
    check(progress) {
      if (progress.circuitDesignCount > 0 && !progress.simulationRunAtLeastOnce) {
        return makeReminder(
          'no-simulation-results',
          'Run a Simulation',
          'You have circuit designs but no simulation results. Run a DC, AC, or transient simulation to verify circuit behavior before building.',
          'medium',
          'circuitDesignCount > 0 && !simulationRunAtLeastOnce',
        );
      }
      return null;
    },
  };
}

function makeExportNotDoneRule(): ReminderRule {
  return {
    id: 'export-not-done',
    check(progress) {
      if (progress.nodeCount >= 5 && !progress.exportPerformedAtLeastOnce) {
        return makeReminder(
          'export-not-done',
          'Export Your Design',
          'Your design is growing but has never been exported. Consider exporting to KiCad, Eagle, or generating Gerber files as a checkpoint.',
          'low',
          'nodeCount >= 5 && !exportPerformedAtLeastOnce',
        );
      }
      return null;
    },
  };
}

function makeLifecycleWarningsRule(): ReminderRule {
  return {
    id: 'lifecycle-warnings',
    check(progress) {
      if (progress.lifecycleWarningsCount > 0) {
        return makeReminder(
          'lifecycle-warnings',
          'Address Lifecycle Warnings',
          `${progress.lifecycleWarningsCount} component(s) have lifecycle warnings (end-of-life, NRND, or obsolete). Review and find alternate parts to avoid supply chain issues.`,
          'high',
          'lifecycleWarningsCount > 0',
        );
      }
      return null;
    },
  };
}

function makeNoDesignSnapshotsRule(): ReminderRule {
  return {
    id: 'no-design-snapshots',
    check(progress) {
      if (progress.nodeCount >= 5 && progress.designSnapshotCount === 0) {
        return makeReminder(
          'no-design-snapshots',
          'Save a Design Snapshot',
          'Your design has no snapshots. Save a snapshot to create a restore point you can revert to if something goes wrong.',
          'medium',
          'nodeCount >= 5 && designSnapshotCount === 0',
        );
      }
      return null;
    },
  };
}

function makeUnsavedChangesRule(): ReminderRule {
  return {
    id: 'unsaved-changes',
    check(progress) {
      if (progress.hasUnsavedChanges) {
        return makeReminder(
          'unsaved-changes',
          'Save Your Changes',
          'You have unsaved changes that could be lost. Save your project to preserve your work.',
          'critical',
          'hasUnsavedChanges === true',
        );
      }
      return null;
    },
  };
}

function makeMissingDocumentationRule(): ReminderRule {
  return {
    id: 'missing-documentation',
    check(progress) {
      if (progress.nodeCount >= 3 && !progress.hasDocumentation) {
        return makeReminder(
          'missing-documentation',
          'Add Project Documentation',
          'Your project has no description or documentation. Adding a brief description helps you remember the purpose and key decisions when you return later.',
          'low',
          'nodeCount >= 3 && !hasDocumentation',
        );
      }
      return null;
    },
  };
}

function makeNoBackupRule(): ReminderRule {
  return {
    id: 'no-backup',
    check(progress) {
      if (progress.nodeCount >= 3 && !progress.backupCreatedAtLeastOnce) {
        return makeReminder(
          'no-backup',
          'Create a Backup',
          'Your project has never been backed up. Create a backup to protect against data loss.',
          'high',
          'nodeCount >= 3 && !backupCreatedAtLeastOnce',
        );
      }
      return null;
    },
  };
}

function makeUnresolvedDrcViolationsRule(): ReminderRule {
  return {
    id: 'unresolved-drc-violations',
    check(progress) {
      if (progress.drcRunAtLeastOnce && progress.unresolvedDrcViolations > 0) {
        return makeReminder(
          'unresolved-drc-violations',
          'Fix DRC Violations',
          `${progress.unresolvedDrcViolations} DRC violation(s) remain unresolved. Fix these before exporting or fabricating to avoid costly mistakes.`,
          'high',
          'drcRunAtLeastOnce && unresolvedDrcViolations > 0',
        );
      }
      return null;
    },
  };
}

function makeStaleBackupRule(): ReminderRule {
  return {
    id: 'stale-backup',
    check(progress) {
      const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
      if (
        progress.backupCreatedAtLeastOnce &&
        progress.msSinceLastBackup !== null &&
        progress.msSinceLastBackup > ONE_WEEK_MS
      ) {
        const days = Math.floor(progress.msSinceLastBackup / (24 * 60 * 60 * 1000));
        return makeReminder(
          'stale-backup',
          'Backup Is Outdated',
          `Your last backup was ${days} day(s) ago. Create a fresh backup to protect recent changes.`,
          'medium',
          'msSinceLastBackup > 7 days',
        );
      }
      return null;
    },
  };
}

function makeFloatingNetsRule(): ReminderRule {
  return {
    id: 'floating-nets',
    check(progress) {
      if (progress.floatingNetCount > 0) {
        return makeReminder(
          'floating-nets',
          'Resolve Floating Nets',
          `${progress.floatingNetCount} net(s) have no connections. Connect or remove them to keep the design clean.`,
          'medium',
          'floatingNetCount > 0',
        );
      }
      return null;
    },
  };
}

// ---------------------------------------------------------------------------
// All built-in rules
// ---------------------------------------------------------------------------

export const BUILT_IN_RULES: ReminderRule[] = [
  makeDrcNotRunRule(),
  makeBomIncompleteRule(),
  makeNoSimulationResultsRule(),
  makeExportNotDoneRule(),
  makeLifecycleWarningsRule(),
  makeNoDesignSnapshotsRule(),
  makeUnsavedChangesRule(),
  makeMissingDocumentationRule(),
  makeNoBackupRule(),
  makeUnresolvedDrcViolationsRule(),
  makeStaleBackupRule(),
  makeFloatingNetsRule(),
];

// ---------------------------------------------------------------------------
// Standalone evaluator
// ---------------------------------------------------------------------------

/**
 * Evaluate all built-in rules against the given project progress, returning
 * an array of active (non-null) reminders sorted by priority (critical first).
 */
export function evaluateReminders(progress: ProjectProgress): Reminder[] {
  const priorityOrder: Record<ReminderPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  const reminders: Reminder[] = [];
  for (const rule of BUILT_IN_RULES) {
    const reminder = rule.check(progress);
    if (reminder) {
      reminders.push(reminder);
    }
  }

  return reminders.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// SmartReminderManager singleton
// ---------------------------------------------------------------------------

/**
 * Singleton manager that evaluates reminder rules against project progress,
 * tracks dismissed reminders (persisted to localStorage), and notifies
 * subscribers on state changes.
 */
export class SmartReminderManager {
  private static instance: SmartReminderManager | null = null;

  private static readonly STORAGE_KEY = 'protopulse-dismissed-reminders';

  private rules: ReminderRule[];
  private dismissedIds: Set<string>;
  private lastReminders: Reminder[];
  private listeners: Set<Listener>;

  private constructor() {
    this.rules = [...BUILT_IN_RULES];
    this.dismissedIds = new Set();
    this.lastReminders = [];
    this.listeners = new Set();
    this.loadDismissed();
  }

  static getInstance(): SmartReminderManager {
    if (!SmartReminderManager.instance) {
      SmartReminderManager.instance = new SmartReminderManager();
    }
    return SmartReminderManager.instance;
  }

  /** Reset singleton — useful for testing. */
  static resetInstance(): void {
    SmartReminderManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

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
  // Rule management
  // -----------------------------------------------------------------------

  getRules(): ReminderRule[] {
    return [...this.rules];
  }

  addRule(rule: ReminderRule): void {
    if (this.rules.some((r) => r.id === rule.id)) {
      return;
    }
    this.rules.push(rule);
    this.notify();
  }

  removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex((r) => r.id === ruleId);
    if (index === -1) {
      return false;
    }
    this.rules.splice(index, 1);
    this.notify();
    return true;
  }

  // -----------------------------------------------------------------------
  // Evaluation
  // -----------------------------------------------------------------------

  evaluateReminders(progress: ProjectProgress): Reminder[] {
    const priorityOrder: Record<ReminderPriority, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    const reminders: Reminder[] = [];
    for (const rule of this.rules) {
      const reminder = rule.check(progress);
      if (reminder) {
        reminder.dismissed = this.dismissedIds.has(reminder.id);
        reminders.push(reminder);
      }
    }

    this.lastReminders = reminders.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    return [...this.lastReminders];
  }

  getLastReminders(): Reminder[] {
    return [...this.lastReminders];
  }

  getActiveReminders(): Reminder[] {
    return this.lastReminders.filter((r) => !r.dismissed);
  }

  // -----------------------------------------------------------------------
  // Dismiss / restore
  // -----------------------------------------------------------------------

  dismissReminder(id: string): void {
    if (this.dismissedIds.has(id)) {
      return;
    }
    this.dismissedIds.add(id);
    // Update in-memory reminders
    for (const r of this.lastReminders) {
      if (r.id === id) {
        r.dismissed = true;
      }
    }
    this.saveDismissed();
    this.notify();
  }

  restoreReminder(id: string): void {
    if (!this.dismissedIds.has(id)) {
      return;
    }
    this.dismissedIds.delete(id);
    for (const r of this.lastReminders) {
      if (r.id === id) {
        r.dismissed = false;
      }
    }
    this.saveDismissed();
    this.notify();
  }

  isDismissed(id: string): boolean {
    return this.dismissedIds.has(id);
  }

  getDismissedIds(): string[] {
    return Array.from(this.dismissedIds);
  }

  clearAllDismissed(): void {
    this.dismissedIds.clear();
    for (const r of this.lastReminders) {
      r.dismissed = false;
    }
    this.saveDismissed();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  private loadDismissed(): void {
    try {
      const raw = localStorage.getItem(SmartReminderManager.STORAGE_KEY);
      if (raw) {
        const ids = JSON.parse(raw) as string[];
        if (Array.isArray(ids)) {
          ids.forEach((id) => this.dismissedIds.add(id));
        }
      }
    } catch {
      // Silently ignore corrupted storage
    }
  }

  private saveDismissed(): void {
    try {
      localStorage.setItem(SmartReminderManager.STORAGE_KEY, JSON.stringify(Array.from(this.dismissedIds)));
    } catch {
      // Silently ignore quota errors
    }
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export interface UseSmartRemindersReturn {
  /** All reminders (including dismissed). */
  reminders: Reminder[];
  /** Only non-dismissed reminders. */
  activeReminders: Reminder[];
  /** Count of non-dismissed reminders. */
  activeCount: number;
  /** Dismiss a reminder by ID. */
  dismissReminder: (id: string) => void;
  /** Restore a previously dismissed reminder. */
  restoreReminder: (id: string) => void;
  /** Clear all dismissals. */
  clearAllDismissed: () => void;
  /** Whether a given reminder is dismissed. */
  isDismissed: (id: string) => boolean;
}

/**
 * React hook that evaluates smart reminders against the given project progress
 * and re-renders when reminders are dismissed/restored.
 */
export function useSmartReminders(progress: ProjectProgress): UseSmartRemindersReturn {
  const mgrRef = useRef(SmartReminderManager.getInstance());
  const [reminders, setReminders] = useState<Reminder[]>([]);

  // Evaluate whenever progress changes
  useEffect(() => {
    const result = mgrRef.current.evaluateReminders(progress);
    setReminders(result);
  }, [progress]);

  // Subscribe to dismiss/restore changes
  useEffect(() => {
    const unsubscribe = mgrRef.current.subscribe(() => {
      setReminders(mgrRef.current.getLastReminders());
    });
    return unsubscribe;
  }, []);

  const dismiss = useCallback((id: string) => {
    mgrRef.current.dismissReminder(id);
  }, []);

  const restore = useCallback((id: string) => {
    mgrRef.current.restoreReminder(id);
  }, []);

  const clearAll = useCallback(() => {
    mgrRef.current.clearAllDismissed();
  }, []);

  const checkDismissed = useCallback((id: string) => {
    return mgrRef.current.isDismissed(id);
  }, []);

  const activeReminders = reminders.filter((r) => !r.dismissed);

  return {
    reminders,
    activeReminders,
    activeCount: activeReminders.length,
    dismissReminder: dismiss,
    restoreReminder: restore,
    clearAllDismissed: clearAll,
    isDismissed: checkDismissed,
  };
}
