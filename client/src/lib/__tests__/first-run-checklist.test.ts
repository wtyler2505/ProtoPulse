import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ChecklistManager,
  type ProjectStateSnapshot,
  type ChecklistStepId,
} from '../first-run-checklist';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptySnapshot(overrides: Partial<ProjectStateSnapshot> = {}): ProjectStateSnapshot {
  return {
    hasProject: false,
    nodeCount: 0,
    edgeCount: 0,
    bomItemCount: 0,
    validationIssueCount: 0,
    hasExported: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  ChecklistManager.resetInstance();
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// ChecklistManager — core behavior
// ---------------------------------------------------------------------------

describe('ChecklistManager', () => {
  it('returns 6 uncompleted items for a fresh project', () => {
    const mgr = ChecklistManager.getInstance();
    const state = mgr.getState(1);
    expect(state.totalCount).toBe(6);
    expect(state.completedCount).toBe(0);
    expect(state.items.every((i) => !i.completed)).toBe(true);
    expect(state.dismissed).toBe(false);
  });

  it('returns the same singleton instance', () => {
    const a = ChecklistManager.getInstance();
    const b = ChecklistManager.getInstance();
    expect(a).toBe(b);
  });

  it('resetInstance creates a new instance', () => {
    const a = ChecklistManager.getInstance();
    ChecklistManager.resetInstance();
    const b = ChecklistManager.getInstance();
    expect(a).not.toBe(b);
  });

  it('step IDs are in the expected order', () => {
    const mgr = ChecklistManager.getInstance();
    const ids = mgr.getState(1).items.map((i) => i.id);
    expect(ids).toEqual([
      'create_project',
      'add_node',
      'connect_edges',
      'add_bom',
      'run_validation',
      'export_design',
    ]);
  });
});

// ---------------------------------------------------------------------------
// evaluate — auto-detection
// ---------------------------------------------------------------------------

describe('evaluate', () => {
  it('marks create_project when hasProject is true', () => {
    const mgr = ChecklistManager.getInstance();
    mgr.evaluate(1, emptySnapshot({ hasProject: true }));
    const state = mgr.getState(1);
    expect(state.items.find((i) => i.id === 'create_project')?.completed).toBe(true);
    expect(state.completedCount).toBe(1);
  });

  it('marks add_node when nodeCount >= 1', () => {
    const mgr = ChecklistManager.getInstance();
    mgr.evaluate(1, emptySnapshot({ nodeCount: 1 }));
    expect(mgr.getState(1).items.find((i) => i.id === 'add_node')?.completed).toBe(true);
  });

  it('marks connect_edges when edgeCount >= 1', () => {
    const mgr = ChecklistManager.getInstance();
    mgr.evaluate(1, emptySnapshot({ edgeCount: 2 }));
    expect(mgr.getState(1).items.find((i) => i.id === 'connect_edges')?.completed).toBe(true);
  });

  it('marks add_bom when bomItemCount >= 1', () => {
    const mgr = ChecklistManager.getInstance();
    mgr.evaluate(1, emptySnapshot({ bomItemCount: 3 }));
    expect(mgr.getState(1).items.find((i) => i.id === 'add_bom')?.completed).toBe(true);
  });

  it('marks run_validation when validationIssueCount >= 1', () => {
    const mgr = ChecklistManager.getInstance();
    mgr.evaluate(1, emptySnapshot({ hasProject: true, validationIssueCount: 1 }));
    expect(mgr.getState(1).items.find((i) => i.id === 'run_validation')?.completed).toBe(true);
  });

  it('does NOT mark run_validation when validationIssueCount is 0', () => {
    const mgr = ChecklistManager.getInstance();
    mgr.evaluate(1, emptySnapshot({ hasProject: true, validationIssueCount: 0 }));
    expect(mgr.getState(1).items.find((i) => i.id === 'run_validation')?.completed).toBe(false);
  });

  it('marks export_design when hasExported is true', () => {
    const mgr = ChecklistManager.getInstance();
    mgr.evaluate(1, emptySnapshot({ hasExported: true }));
    expect(mgr.getState(1).items.find((i) => i.id === 'export_design')?.completed).toBe(true);
  });

  it('marks all steps at once from a fully-populated snapshot', () => {
    const mgr = ChecklistManager.getInstance();
    mgr.evaluate(1, {
      hasProject: true,
      nodeCount: 5,
      edgeCount: 3,
      bomItemCount: 2,
      validationIssueCount: 1,
      hasExported: true,
    });
    const state = mgr.getState(1);
    expect(state.completedCount).toBe(6);
    expect(state.items.every((i) => i.completed)).toBe(true);
  });

  it('does not un-complete steps on a subsequent empty snapshot', () => {
    const mgr = ChecklistManager.getInstance();
    mgr.evaluate(1, emptySnapshot({ nodeCount: 1 }));
    expect(mgr.getState(1).items.find((i) => i.id === 'add_node')?.completed).toBe(true);

    // Evaluate again with 0 nodes — should remain completed
    mgr.evaluate(1, emptySnapshot({ nodeCount: 0 }));
    expect(mgr.getState(1).items.find((i) => i.id === 'add_node')?.completed).toBe(true);
  });

  it('notifies subscribers when state changes', () => {
    const mgr = ChecklistManager.getInstance();
    const callback = vi.fn();
    mgr.subscribe(callback);

    mgr.evaluate(1, emptySnapshot({ hasProject: true }));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not notify when no new steps are completed', () => {
    const mgr = ChecklistManager.getInstance();
    mgr.evaluate(1, emptySnapshot({ hasProject: true }));

    const callback = vi.fn();
    mgr.subscribe(callback);

    // Same snapshot again — nothing new
    mgr.evaluate(1, emptySnapshot({ hasProject: true }));
    expect(callback).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// markCompleted — manual completion
// ---------------------------------------------------------------------------

describe('markCompleted', () => {
  it('manually marks a step as completed', () => {
    const mgr = ChecklistManager.getInstance();
    mgr.markCompleted(1, 'export_design');
    expect(mgr.getState(1).items.find((i) => i.id === 'export_design')?.completed).toBe(true);
    expect(mgr.getState(1).completedCount).toBe(1);
  });

  it('is idempotent — marking twice does not duplicate', () => {
    const mgr = ChecklistManager.getInstance();
    mgr.markCompleted(1, 'add_bom');
    mgr.markCompleted(1, 'add_bom');
    const state = mgr.getState(1);
    expect(state.completedCount).toBe(1);
    // Check no duplicates in underlying storage
    expect(state.items.filter((i) => i.id === 'add_bom')).toHaveLength(1);
  });

  it('notifies on first mark, not on duplicate', () => {
    const mgr = ChecklistManager.getInstance();
    const callback = vi.fn();
    mgr.subscribe(callback);

    mgr.markCompleted(1, 'add_node');
    expect(callback).toHaveBeenCalledTimes(1);

    mgr.markCompleted(1, 'add_node');
    expect(callback).toHaveBeenCalledTimes(1); // No additional notification
  });
});

// ---------------------------------------------------------------------------
// dismiss / reset
// ---------------------------------------------------------------------------

describe('dismiss', () => {
  it('sets dismissed to true', () => {
    const mgr = ChecklistManager.getInstance();
    mgr.dismiss(1);
    expect(mgr.getState(1).dismissed).toBe(true);
  });

  it('isVisible returns false after dismiss', () => {
    const mgr = ChecklistManager.getInstance();
    expect(mgr.isVisible(1)).toBe(true); // Initially visible (0 of 6 done)
    mgr.dismiss(1);
    expect(mgr.isVisible(1)).toBe(false);
  });

  it('notifies on dismiss', () => {
    const mgr = ChecklistManager.getInstance();
    const cb = vi.fn();
    mgr.subscribe(cb);
    mgr.dismiss(1);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('dismiss is idempotent', () => {
    const mgr = ChecklistManager.getInstance();
    const cb = vi.fn();
    mgr.subscribe(cb);
    mgr.dismiss(1);
    mgr.dismiss(1);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe('reset', () => {
  it('clears all completions and un-dismisses', () => {
    const mgr = ChecklistManager.getInstance();
    mgr.evaluate(1, emptySnapshot({ hasProject: true, nodeCount: 3, edgeCount: 1 }));
    mgr.dismiss(1);

    expect(mgr.getState(1).completedCount).toBe(3);
    expect(mgr.getState(1).dismissed).toBe(true);

    mgr.reset(1);
    expect(mgr.getState(1).completedCount).toBe(0);
    expect(mgr.getState(1).dismissed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isVisible
// ---------------------------------------------------------------------------

describe('isVisible', () => {
  it('returns true when not dismissed and not all complete', () => {
    const mgr = ChecklistManager.getInstance();
    expect(mgr.isVisible(1)).toBe(true);
  });

  it('returns false when all steps are complete', () => {
    const mgr = ChecklistManager.getInstance();
    const allSteps: ChecklistStepId[] = [
      'create_project', 'add_node', 'connect_edges', 'add_bom', 'run_validation', 'export_design',
    ];
    allSteps.forEach((id) => mgr.markCompleted(1, id));
    expect(mgr.isVisible(1)).toBe(false);
  });

  it('returns false when dismissed even with steps remaining', () => {
    const mgr = ChecklistManager.getInstance();
    mgr.markCompleted(1, 'create_project');
    mgr.dismiss(1);
    expect(mgr.isVisible(1)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// subscribe / unsubscribe
// ---------------------------------------------------------------------------

describe('subscribe', () => {
  it('returns an unsubscribe function', () => {
    const mgr = ChecklistManager.getInstance();
    const cb = vi.fn();
    const unsub = mgr.subscribe(cb);

    mgr.markCompleted(1, 'add_node');
    expect(cb).toHaveBeenCalledTimes(1);

    unsub();
    mgr.markCompleted(1, 'add_bom');
    expect(cb).toHaveBeenCalledTimes(1); // Not called again
  });

  it('supports multiple subscribers', () => {
    const mgr = ChecklistManager.getInstance();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    mgr.subscribe(cb1);
    mgr.subscribe(cb2);

    mgr.markCompleted(1, 'create_project');
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

describe('localStorage persistence', () => {
  it('persists completed steps across instances', () => {
    const mgr1 = ChecklistManager.getInstance();
    mgr1.markCompleted(1, 'create_project');
    mgr1.markCompleted(1, 'add_node');

    // Simulate new page load
    ChecklistManager.resetInstance();
    const mgr2 = ChecklistManager.getInstance();
    const state = mgr2.getState(1);
    expect(state.completedCount).toBe(2);
    expect(state.items.find((i) => i.id === 'create_project')?.completed).toBe(true);
    expect(state.items.find((i) => i.id === 'add_node')?.completed).toBe(true);
  });

  it('persists dismissed state', () => {
    const mgr1 = ChecklistManager.getInstance();
    mgr1.dismiss(1);

    ChecklistManager.resetInstance();
    const mgr2 = ChecklistManager.getInstance();
    expect(mgr2.getState(1).dismissed).toBe(true);
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('protopulse-first-run-checklist', '{invalid json!!!');
    ChecklistManager.resetInstance();
    const mgr = ChecklistManager.getInstance();
    // Should not throw, should start fresh
    expect(mgr.getState(1).completedCount).toBe(0);
  });

  it('handles missing localStorage gracefully', () => {
    // No localStorage set
    const mgr = ChecklistManager.getInstance();
    expect(mgr.getState(1).totalCount).toBe(6);
  });

  it('ignores invalid step IDs from storage', () => {
    localStorage.setItem('protopulse-first-run-checklist', JSON.stringify({
      '1': { completed: ['create_project', 'fake_step_id', 'add_node'], dismissed: false },
    }));
    ChecklistManager.resetInstance();
    const mgr = ChecklistManager.getInstance();
    const state = mgr.getState(1);
    expect(state.completedCount).toBe(2); // Only valid IDs
  });
});

// ---------------------------------------------------------------------------
// Multi-project isolation
// ---------------------------------------------------------------------------

describe('multi-project isolation', () => {
  it('tracks state independently per project', () => {
    const mgr = ChecklistManager.getInstance();
    mgr.markCompleted(1, 'create_project');
    mgr.markCompleted(2, 'add_bom');
    mgr.dismiss(2);

    expect(mgr.getState(1).completedCount).toBe(1);
    expect(mgr.getState(1).items.find((i) => i.id === 'create_project')?.completed).toBe(true);
    expect(mgr.getState(1).dismissed).toBe(false);

    expect(mgr.getState(2).completedCount).toBe(1);
    expect(mgr.getState(2).items.find((i) => i.id === 'add_bom')?.completed).toBe(true);
    expect(mgr.getState(2).dismissed).toBe(true);
  });

  it('resetting one project does not affect another', () => {
    const mgr = ChecklistManager.getInstance();
    mgr.markCompleted(1, 'create_project');
    mgr.markCompleted(2, 'add_node');

    mgr.reset(1);
    expect(mgr.getState(1).completedCount).toBe(0);
    expect(mgr.getState(2).completedCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Item metadata
// ---------------------------------------------------------------------------

describe('item metadata', () => {
  it('each item has a non-empty label and description', () => {
    const mgr = ChecklistManager.getInstance();
    const items = mgr.getState(1).items;
    items.forEach((item) => {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.description.length).toBeGreaterThan(0);
    });
  });
});
