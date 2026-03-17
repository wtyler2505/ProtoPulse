import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SmartReminderManager,
  evaluateReminders,
  BUILT_IN_RULES,
  useSmartReminders,
} from '../smart-reminders';
import type {
  ProjectProgress,
  Reminder,
  ReminderRule,
} from '../smart-reminders';
import { renderHook, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseProgress(overrides?: Partial<ProjectProgress>): ProjectProgress {
  return {
    nodeCount: 0,
    bomItemCount: 0,
    bomItemsMissingPartNumber: 0,
    drcRunAtLeastOnce: false,
    unresolvedDrcViolations: 0,
    simulationRunAtLeastOnce: false,
    exportPerformedAtLeastOnce: false,
    lifecycleWarningsCount: 0,
    designSnapshotCount: 0,
    hasUnsavedChanges: false,
    hasDocumentation: false,
    backupCreatedAtLeastOnce: false,
    circuitDesignCount: 0,
    msSinceLastBackup: null,
    floatingNetCount: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Singleton lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  SmartReminderManager.resetInstance();
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// BUILT_IN_RULES
// ---------------------------------------------------------------------------

describe('BUILT_IN_RULES', () => {
  it('contains at least 10 rules', () => {
    expect(BUILT_IN_RULES.length).toBeGreaterThanOrEqual(10);
  });

  it('every rule has a unique id', () => {
    const ids = BUILT_IN_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every rule has a check function', () => {
    for (const rule of BUILT_IN_RULES) {
      expect(typeof rule.check).toBe('function');
    }
  });
});

// ---------------------------------------------------------------------------
// Individual rule checks
// ---------------------------------------------------------------------------

describe('rule: drc-not-run', () => {
  const rule = BUILT_IN_RULES.find((r) => r.id === 'drc-not-run')!;

  it('triggers when nodeCount >= 3 and DRC never run', () => {
    const reminder = rule.check(baseProgress({ nodeCount: 3 }));
    expect(reminder).not.toBeNull();
    expect(reminder!.id).toBe('drc-not-run');
    expect(reminder!.priority).toBe('high');
  });

  it('does not trigger when DRC has been run', () => {
    const reminder = rule.check(baseProgress({ nodeCount: 5, drcRunAtLeastOnce: true }));
    expect(reminder).toBeNull();
  });

  it('does not trigger when nodeCount < 3', () => {
    const reminder = rule.check(baseProgress({ nodeCount: 2 }));
    expect(reminder).toBeNull();
  });
});

describe('rule: bom-incomplete', () => {
  const rule = BUILT_IN_RULES.find((r) => r.id === 'bom-incomplete')!;

  it('triggers when BOM items are missing part numbers', () => {
    const reminder = rule.check(baseProgress({ bomItemCount: 5, bomItemsMissingPartNumber: 2 }));
    expect(reminder).not.toBeNull();
    expect(reminder!.priority).toBe('medium');
    expect(reminder!.description).toContain('2');
  });

  it('does not trigger when all BOM items have part numbers', () => {
    const reminder = rule.check(baseProgress({ bomItemCount: 5, bomItemsMissingPartNumber: 0 }));
    expect(reminder).toBeNull();
  });

  it('does not trigger when there are no BOM items', () => {
    const reminder = rule.check(baseProgress({ bomItemCount: 0, bomItemsMissingPartNumber: 0 }));
    expect(reminder).toBeNull();
  });
});

describe('rule: no-simulation-results', () => {
  const rule = BUILT_IN_RULES.find((r) => r.id === 'no-simulation-results')!;

  it('triggers when circuit designs exist but no simulation run', () => {
    const reminder = rule.check(baseProgress({ circuitDesignCount: 1 }));
    expect(reminder).not.toBeNull();
    expect(reminder!.priority).toBe('medium');
  });

  it('does not trigger when simulation has been run', () => {
    const reminder = rule.check(baseProgress({ circuitDesignCount: 2, simulationRunAtLeastOnce: true }));
    expect(reminder).toBeNull();
  });

  it('does not trigger when there are no circuit designs', () => {
    const reminder = rule.check(baseProgress({ circuitDesignCount: 0 }));
    expect(reminder).toBeNull();
  });
});

describe('rule: export-not-done', () => {
  const rule = BUILT_IN_RULES.find((r) => r.id === 'export-not-done')!;

  it('triggers when nodeCount >= 5 and no export', () => {
    const reminder = rule.check(baseProgress({ nodeCount: 5 }));
    expect(reminder).not.toBeNull();
    expect(reminder!.priority).toBe('low');
  });

  it('does not trigger after export', () => {
    const reminder = rule.check(baseProgress({ nodeCount: 10, exportPerformedAtLeastOnce: true }));
    expect(reminder).toBeNull();
  });
});

describe('rule: lifecycle-warnings', () => {
  const rule = BUILT_IN_RULES.find((r) => r.id === 'lifecycle-warnings')!;

  it('triggers when lifecycle warnings exist', () => {
    const reminder = rule.check(baseProgress({ lifecycleWarningsCount: 3 }));
    expect(reminder).not.toBeNull();
    expect(reminder!.priority).toBe('high');
    expect(reminder!.description).toContain('3');
  });

  it('does not trigger when no lifecycle warnings', () => {
    const reminder = rule.check(baseProgress({ lifecycleWarningsCount: 0 }));
    expect(reminder).toBeNull();
  });
});

describe('rule: no-design-snapshots', () => {
  const rule = BUILT_IN_RULES.find((r) => r.id === 'no-design-snapshots')!;

  it('triggers when nodeCount >= 5 and no snapshots', () => {
    const reminder = rule.check(baseProgress({ nodeCount: 5, designSnapshotCount: 0 }));
    expect(reminder).not.toBeNull();
    expect(reminder!.priority).toBe('medium');
  });

  it('does not trigger when snapshots exist', () => {
    const reminder = rule.check(baseProgress({ nodeCount: 10, designSnapshotCount: 2 }));
    expect(reminder).toBeNull();
  });
});

describe('rule: unsaved-changes', () => {
  const rule = BUILT_IN_RULES.find((r) => r.id === 'unsaved-changes')!;

  it('triggers when there are unsaved changes', () => {
    const reminder = rule.check(baseProgress({ hasUnsavedChanges: true }));
    expect(reminder).not.toBeNull();
    expect(reminder!.priority).toBe('critical');
  });

  it('does not trigger when everything is saved', () => {
    const reminder = rule.check(baseProgress({ hasUnsavedChanges: false }));
    expect(reminder).toBeNull();
  });
});

describe('rule: missing-documentation', () => {
  const rule = BUILT_IN_RULES.find((r) => r.id === 'missing-documentation')!;

  it('triggers when nodeCount >= 3 and no documentation', () => {
    const reminder = rule.check(baseProgress({ nodeCount: 4, hasDocumentation: false }));
    expect(reminder).not.toBeNull();
    expect(reminder!.priority).toBe('low');
  });

  it('does not trigger when documentation exists', () => {
    const reminder = rule.check(baseProgress({ nodeCount: 10, hasDocumentation: true }));
    expect(reminder).toBeNull();
  });
});

describe('rule: no-backup', () => {
  const rule = BUILT_IN_RULES.find((r) => r.id === 'no-backup')!;

  it('triggers when nodeCount >= 3 and no backup', () => {
    const reminder = rule.check(baseProgress({ nodeCount: 3, backupCreatedAtLeastOnce: false }));
    expect(reminder).not.toBeNull();
    expect(reminder!.priority).toBe('high');
  });

  it('does not trigger when backup exists', () => {
    const reminder = rule.check(baseProgress({ nodeCount: 10, backupCreatedAtLeastOnce: true }));
    expect(reminder).toBeNull();
  });
});

describe('rule: unresolved-drc-violations', () => {
  const rule = BUILT_IN_RULES.find((r) => r.id === 'unresolved-drc-violations')!;

  it('triggers when DRC was run and violations remain', () => {
    const reminder = rule.check(baseProgress({ drcRunAtLeastOnce: true, unresolvedDrcViolations: 5 }));
    expect(reminder).not.toBeNull();
    expect(reminder!.priority).toBe('high');
    expect(reminder!.description).toContain('5');
  });

  it('does not trigger when DRC was not run', () => {
    const reminder = rule.check(baseProgress({ drcRunAtLeastOnce: false, unresolvedDrcViolations: 5 }));
    expect(reminder).toBeNull();
  });

  it('does not trigger when no violations remain', () => {
    const reminder = rule.check(baseProgress({ drcRunAtLeastOnce: true, unresolvedDrcViolations: 0 }));
    expect(reminder).toBeNull();
  });
});

describe('rule: stale-backup', () => {
  const rule = BUILT_IN_RULES.find((r) => r.id === 'stale-backup')!;

  it('triggers when backup is older than 7 days', () => {
    const tenDaysMs = 10 * 24 * 60 * 60 * 1000;
    const reminder = rule.check(baseProgress({ backupCreatedAtLeastOnce: true, msSinceLastBackup: tenDaysMs }));
    expect(reminder).not.toBeNull();
    expect(reminder!.priority).toBe('medium');
    expect(reminder!.description).toContain('10');
  });

  it('does not trigger when backup is recent', () => {
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
    const reminder = rule.check(baseProgress({ backupCreatedAtLeastOnce: true, msSinceLastBackup: twoDaysMs }));
    expect(reminder).toBeNull();
  });

  it('does not trigger when no backup exists', () => {
    const reminder = rule.check(baseProgress({ backupCreatedAtLeastOnce: false, msSinceLastBackup: null }));
    expect(reminder).toBeNull();
  });
});

describe('rule: floating-nets', () => {
  const rule = BUILT_IN_RULES.find((r) => r.id === 'floating-nets')!;

  it('triggers when floating nets exist', () => {
    const reminder = rule.check(baseProgress({ floatingNetCount: 2 }));
    expect(reminder).not.toBeNull();
    expect(reminder!.priority).toBe('medium');
    expect(reminder!.description).toContain('2');
  });

  it('does not trigger when no floating nets', () => {
    const reminder = rule.check(baseProgress({ floatingNetCount: 0 }));
    expect(reminder).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// evaluateReminders (standalone function)
// ---------------------------------------------------------------------------

describe('evaluateReminders', () => {
  it('returns an empty array for a fresh empty project', () => {
    const result = evaluateReminders(baseProgress());
    expect(result).toEqual([]);
  });

  it('returns multiple reminders for a project with issues', () => {
    const progress = baseProgress({
      nodeCount: 10,
      bomItemCount: 5,
      bomItemsMissingPartNumber: 2,
      hasUnsavedChanges: true,
      lifecycleWarningsCount: 1,
    });
    const result = evaluateReminders(progress);
    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  it('sorts reminders by priority (critical first)', () => {
    const progress = baseProgress({
      nodeCount: 10,
      hasUnsavedChanges: true,
      hasDocumentation: false,
      backupCreatedAtLeastOnce: false,
    });
    const result = evaluateReminders(progress);
    expect(result.length).toBeGreaterThanOrEqual(2);
    // Critical should come before low
    const criticalIndex = result.findIndex((r) => r.priority === 'critical');
    const lowIndex = result.findIndex((r) => r.priority === 'low');
    if (criticalIndex !== -1 && lowIndex !== -1) {
      expect(criticalIndex).toBeLessThan(lowIndex);
    }
  });

  it('all returned reminders have the required shape', () => {
    const progress = baseProgress({
      nodeCount: 10,
      hasUnsavedChanges: true,
      bomItemCount: 3,
      bomItemsMissingPartNumber: 1,
    });
    const result = evaluateReminders(progress);
    for (const r of result) {
      expect(r).toHaveProperty('id');
      expect(r).toHaveProperty('title');
      expect(r).toHaveProperty('description');
      expect(r).toHaveProperty('priority');
      expect(r).toHaveProperty('triggerCondition');
      expect(r).toHaveProperty('dismissed');
      expect(r).toHaveProperty('createdAt');
      expect(['low', 'medium', 'high', 'critical']).toContain(r.priority);
      expect(typeof r.dismissed).toBe('boolean');
    }
  });
});

// ---------------------------------------------------------------------------
// SmartReminderManager singleton
// ---------------------------------------------------------------------------

describe('SmartReminderManager', () => {
  describe('singleton', () => {
    it('returns the same instance across calls', () => {
      const a = SmartReminderManager.getInstance();
      const b = SmartReminderManager.getInstance();
      expect(a).toBe(b);
    });

    it('returns a new instance after reset', () => {
      const a = SmartReminderManager.getInstance();
      SmartReminderManager.resetInstance();
      const b = SmartReminderManager.getInstance();
      expect(a).not.toBe(b);
    });
  });

  describe('getRules', () => {
    it('starts with all built-in rules', () => {
      const mgr = SmartReminderManager.getInstance();
      expect(mgr.getRules().length).toBe(BUILT_IN_RULES.length);
    });

    it('returns a copy — mutations do not affect internal state', () => {
      const mgr = SmartReminderManager.getInstance();
      const rules = mgr.getRules();
      rules.length = 0;
      expect(mgr.getRules().length).toBe(BUILT_IN_RULES.length);
    });
  });

  describe('addRule / removeRule', () => {
    it('adds a custom rule', () => {
      const mgr = SmartReminderManager.getInstance();
      const before = mgr.getRules().length;
      const customRule: ReminderRule = {
        id: 'custom-test',
        check: () => null,
      };
      mgr.addRule(customRule);
      expect(mgr.getRules().length).toBe(before + 1);
    });

    it('does not add a duplicate rule', () => {
      const mgr = SmartReminderManager.getInstance();
      const customRule: ReminderRule = {
        id: 'custom-test',
        check: () => null,
      };
      mgr.addRule(customRule);
      const after = mgr.getRules().length;
      mgr.addRule(customRule);
      expect(mgr.getRules().length).toBe(after);
    });

    it('removes a rule by id', () => {
      const mgr = SmartReminderManager.getInstance();
      const before = mgr.getRules().length;
      expect(mgr.removeRule('drc-not-run')).toBe(true);
      expect(mgr.getRules().length).toBe(before - 1);
    });

    it('returns false when removing non-existent rule', () => {
      const mgr = SmartReminderManager.getInstance();
      expect(mgr.removeRule('non-existent-xyz')).toBe(false);
    });
  });

  describe('evaluateReminders', () => {
    it('returns reminders for an active project', () => {
      const mgr = SmartReminderManager.getInstance();
      const progress = baseProgress({ nodeCount: 10, hasUnsavedChanges: true });
      const result = mgr.evaluateReminders(progress);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('marks dismissed reminders correctly', () => {
      const mgr = SmartReminderManager.getInstance();
      mgr.dismissReminder('unsaved-changes');
      const progress = baseProgress({ nodeCount: 10, hasUnsavedChanges: true });
      const result = mgr.evaluateReminders(progress);
      const unsaved = result.find((r) => r.id === 'unsaved-changes');
      expect(unsaved?.dismissed).toBe(true);
    });

    it('getLastReminders returns same result as last evaluation', () => {
      const mgr = SmartReminderManager.getInstance();
      const progress = baseProgress({ nodeCount: 10, hasUnsavedChanges: true });
      const evaluated = mgr.evaluateReminders(progress);
      const last = mgr.getLastReminders();
      expect(last).toEqual(evaluated);
    });

    it('getActiveReminders excludes dismissed', () => {
      const mgr = SmartReminderManager.getInstance();
      const progress = baseProgress({ nodeCount: 10, hasUnsavedChanges: true, backupCreatedAtLeastOnce: false });
      mgr.evaluateReminders(progress);
      const allCount = mgr.getLastReminders().length;
      mgr.dismissReminder('unsaved-changes');
      // Re-evaluate to update dismissed flags
      mgr.evaluateReminders(progress);
      expect(mgr.getActiveReminders().length).toBe(allCount - 1);
    });
  });

  describe('dismissReminder / restoreReminder', () => {
    it('dismisses a reminder', () => {
      const mgr = SmartReminderManager.getInstance();
      mgr.dismissReminder('drc-not-run');
      expect(mgr.isDismissed('drc-not-run')).toBe(true);
    });

    it('is idempotent — dismissing twice does not error', () => {
      const mgr = SmartReminderManager.getInstance();
      mgr.dismissReminder('drc-not-run');
      mgr.dismissReminder('drc-not-run');
      expect(mgr.getDismissedIds()).toEqual(['drc-not-run']);
    });

    it('restores a dismissed reminder', () => {
      const mgr = SmartReminderManager.getInstance();
      mgr.dismissReminder('drc-not-run');
      mgr.restoreReminder('drc-not-run');
      expect(mgr.isDismissed('drc-not-run')).toBe(false);
    });

    it('restoring a non-dismissed reminder is a no-op', () => {
      const mgr = SmartReminderManager.getInstance();
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.restoreReminder('drc-not-run');
      expect(listener).not.toHaveBeenCalled();
    });

    it('clearAllDismissed removes all dismissals', () => {
      const mgr = SmartReminderManager.getInstance();
      mgr.dismissReminder('drc-not-run');
      mgr.dismissReminder('no-backup');
      expect(mgr.getDismissedIds().length).toBe(2);
      mgr.clearAllDismissed();
      expect(mgr.getDismissedIds().length).toBe(0);
    });
  });

  describe('subscribe', () => {
    it('notifies subscribers on dismiss', () => {
      const mgr = SmartReminderManager.getInstance();
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.dismissReminder('drc-not-run');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies subscribers on restore', () => {
      const mgr = SmartReminderManager.getInstance();
      mgr.dismissReminder('drc-not-run');
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.restoreReminder('drc-not-run');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies subscribers on clearAllDismissed', () => {
      const mgr = SmartReminderManager.getInstance();
      mgr.dismissReminder('drc-not-run');
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.clearAllDismissed();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies subscribers on addRule', () => {
      const mgr = SmartReminderManager.getInstance();
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.addRule({ id: 'custom-notify-test', check: () => null });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies subscribers on removeRule', () => {
      const mgr = SmartReminderManager.getInstance();
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.removeRule('drc-not-run');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('unsubscribe stops notifications', () => {
      const mgr = SmartReminderManager.getInstance();
      const listener = vi.fn();
      const unsub = mgr.subscribe(listener);
      unsub();
      mgr.dismissReminder('drc-not-run');
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('localStorage persistence', () => {
    it('persists dismissed reminders to localStorage', () => {
      const mgr = SmartReminderManager.getInstance();
      mgr.dismissReminder('drc-not-run');
      mgr.dismissReminder('no-backup');
      const raw = localStorage.getItem('protopulse-dismissed-reminders');
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!) as string[];
      expect(parsed).toContain('drc-not-run');
      expect(parsed).toContain('no-backup');
    });

    it('loads dismissed reminders from localStorage on construction', () => {
      localStorage.setItem('protopulse-dismissed-reminders', JSON.stringify(['no-backup', 'unsaved-changes']));
      SmartReminderManager.resetInstance();
      const mgr = SmartReminderManager.getInstance();
      expect(mgr.isDismissed('no-backup')).toBe(true);
      expect(mgr.isDismissed('unsaved-changes')).toBe(true);
    });

    it('handles corrupted localStorage gracefully', () => {
      localStorage.setItem('protopulse-dismissed-reminders', '{broken json');
      SmartReminderManager.resetInstance();
      const mgr = SmartReminderManager.getInstance();
      expect(mgr.getDismissedIds().length).toBe(0);
    });

    it('clearAllDismissed updates localStorage', () => {
      const mgr = SmartReminderManager.getInstance();
      mgr.dismissReminder('drc-not-run');
      mgr.clearAllDismissed();
      const raw = localStorage.getItem('protopulse-dismissed-reminders');
      expect(JSON.parse(raw!)).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// useSmartReminders hook
// ---------------------------------------------------------------------------

describe('useSmartReminders', () => {
  it('returns reminders for the given progress', () => {
    const progress = baseProgress({ nodeCount: 10, hasUnsavedChanges: true });
    const { result } = renderHook(() => useSmartReminders(progress));
    expect(result.current.reminders.length).toBeGreaterThanOrEqual(1);
    expect(result.current.activeCount).toBeGreaterThanOrEqual(1);
  });

  it('dismissReminder removes from active list', () => {
    const progress = baseProgress({ nodeCount: 10, hasUnsavedChanges: true });
    const { result } = renderHook(() => useSmartReminders(progress));
    const initialActive = result.current.activeCount;
    act(() => {
      result.current.dismissReminder('unsaved-changes');
    });
    expect(result.current.activeCount).toBe(initialActive - 1);
  });

  it('restoreReminder adds back to active list', () => {
    const progress = baseProgress({ nodeCount: 10, hasUnsavedChanges: true });
    const { result } = renderHook(() => useSmartReminders(progress));
    act(() => {
      result.current.dismissReminder('unsaved-changes');
    });
    const afterDismiss = result.current.activeCount;
    act(() => {
      result.current.restoreReminder('unsaved-changes');
    });
    expect(result.current.activeCount).toBe(afterDismiss + 1);
  });

  it('clearAllDismissed restores everything', () => {
    const progress = baseProgress({ nodeCount: 10, hasUnsavedChanges: true, backupCreatedAtLeastOnce: false });
    const { result } = renderHook(() => useSmartReminders(progress));
    const total = result.current.reminders.length;
    act(() => {
      result.current.dismissReminder('unsaved-changes');
      result.current.dismissReminder('no-backup');
    });
    expect(result.current.activeCount).toBeLessThan(total);
    act(() => {
      result.current.clearAllDismissed();
    });
    expect(result.current.activeCount).toBe(total);
  });

  it('isDismissed returns correct state', () => {
    const progress = baseProgress({ nodeCount: 10, hasUnsavedChanges: true });
    const { result } = renderHook(() => useSmartReminders(progress));
    expect(result.current.isDismissed('unsaved-changes')).toBe(false);
    act(() => {
      result.current.dismissReminder('unsaved-changes');
    });
    expect(result.current.isDismissed('unsaved-changes')).toBe(true);
  });

  it('re-evaluates when progress changes', () => {
    const progress1 = baseProgress();
    const { result, rerender } = renderHook(
      (props: { progress: ProjectProgress }) => useSmartReminders(props.progress),
      { initialProps: { progress: progress1 } },
    );
    expect(result.current.activeCount).toBe(0);

    const progress2 = baseProgress({ nodeCount: 10, hasUnsavedChanges: true });
    rerender({ progress: progress2 });
    expect(result.current.activeCount).toBeGreaterThanOrEqual(1);
  });

  it('activeReminders does not include dismissed ones', () => {
    const progress = baseProgress({ nodeCount: 10, hasUnsavedChanges: true, lifecycleWarningsCount: 3 });
    const { result } = renderHook(() => useSmartReminders(progress));
    act(() => {
      result.current.dismissReminder('unsaved-changes');
    });
    const ids = result.current.activeReminders.map((r) => r.id);
    expect(ids).not.toContain('unsaved-changes');
  });
});
