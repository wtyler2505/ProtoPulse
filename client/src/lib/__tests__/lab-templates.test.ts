import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LabTemplateManager } from '../lab-templates';
import type { LabTemplate, LabSession, GradeResult } from '../lab-templates';

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

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

function clearStore(): void {
  for (const k of Object.keys(store)) {
    delete store[k];
  }
}

beforeEach(() => {
  LabTemplateManager.resetForTesting();
  clearStore();
});

// ---------------------------------------------------------------------------
// Built-in labs
// ---------------------------------------------------------------------------

describe('Built-in labs', () => {
  it('ships with 5 built-in lab templates', () => {
    const mgr = LabTemplateManager.getInstance();
    const labs = mgr.listLabs();
    expect(labs).toHaveLength(5);
  });

  it('has correct IDs for all built-in labs', () => {
    const mgr = LabTemplateManager.getInstance();
    const ids = mgr.listLabs().map((l) => l.id);
    expect(ids).toContain('led-circuit-basics');
    expect(ids).toContain('voltage-divider-lab');
    expect(ids).toContain('arduino-sensor-project');
    expect(ids).toContain('pcb-design-intro');
    expect(ids).toContain('power-supply-design');
  });

  it('every lab has at least one objective', () => {
    const mgr = LabTemplateManager.getInstance();
    for (const lab of mgr.listLabs()) {
      expect(lab.objectives.length).toBeGreaterThan(0);
    }
  });

  it('every lab has at least one step', () => {
    const mgr = LabTemplateManager.getInstance();
    for (const lab of mgr.listLabs()) {
      expect(lab.steps.length).toBeGreaterThan(0);
    }
  });

  it('every lab has at least one grading criterion', () => {
    const mgr = LabTemplateManager.getInstance();
    for (const lab of mgr.listLabs()) {
      expect(lab.gradingCriteria.length).toBeGreaterThan(0);
    }
  });

  it('steps are ordered sequentially starting from 0', () => {
    const mgr = LabTemplateManager.getInstance();
    for (const lab of mgr.listLabs()) {
      const orders = lab.steps.map((s) => s.order);
      expect(orders).toEqual(orders.slice().sort((a, b) => a - b));
      expect(orders[0]).toBe(0);
    }
  });

  it('all grading criteria point totals sum to 100 for each lab', () => {
    const mgr = LabTemplateManager.getInstance();
    for (const lab of mgr.listLabs()) {
      const total = lab.gradingCriteria.reduce((sum, gc) => sum + gc.points, 0);
      expect(total).toBe(100);
    }
  });

  it('difficulty is set for every lab', () => {
    const mgr = LabTemplateManager.getInstance();
    for (const lab of mgr.listLabs()) {
      expect(['beginner', 'intermediate', 'advanced']).toContain(lab.difficulty);
    }
  });

  it('estimatedMinutes is a positive number for every lab', () => {
    const mgr = LabTemplateManager.getInstance();
    for (const lab of mgr.listLabs()) {
      expect(lab.estimatedMinutes).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// getLab
// ---------------------------------------------------------------------------

describe('getLab', () => {
  it('returns a lab by id', () => {
    const mgr = LabTemplateManager.getInstance();
    const lab = mgr.getLab('led-circuit-basics');
    expect(lab).toBeDefined();
    expect(lab!.title).toBe('LED Circuit Basics');
  });

  it('returns undefined for unknown id', () => {
    const mgr = LabTemplateManager.getInstance();
    expect(mgr.getLab('nonexistent')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

describe('Filtering', () => {
  it('filters by category', () => {
    const mgr = LabTemplateManager.getInstance();
    const fundamentals = mgr.getLabsByCategory('fundamentals');
    expect(fundamentals.length).toBeGreaterThan(0);
    for (const lab of fundamentals) {
      expect(lab.category).toBe('fundamentals');
    }
  });

  it('filters by difficulty', () => {
    const mgr = LabTemplateManager.getInstance();
    const beginnerLabs = mgr.getLabsByDifficulty('beginner');
    expect(beginnerLabs.length).toBeGreaterThan(0);
    for (const lab of beginnerLabs) {
      expect(lab.difficulty).toBe('beginner');
    }
  });

  it('returns empty array for unused category', () => {
    const mgr = LabTemplateManager.getInstance();
    const digital = mgr.getLabsByCategory('digital');
    expect(digital).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

describe('Search', () => {
  it('searches by title', () => {
    const mgr = LabTemplateManager.getInstance();
    const results = mgr.searchLabs('LED');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('led-circuit-basics');
  });

  it('searches by tag', () => {
    const mgr = LabTemplateManager.getInstance();
    const results = mgr.searchLabs('gerber');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.id === 'pcb-design-intro')).toBe(true);
  });

  it('searches by description', () => {
    const mgr = LabTemplateManager.getInstance();
    const results = mgr.searchLabs('voltage regulator');
    expect(results.length).toBeGreaterThan(0);
  });

  it('search is case-insensitive', () => {
    const mgr = LabTemplateManager.getInstance();
    const upper = mgr.searchLabs('ARDUINO');
    const lower = mgr.searchLabs('arduino');
    expect(upper.length).toBe(lower.length);
  });

  it('returns empty for no matches', () => {
    const mgr = LabTemplateManager.getInstance();
    expect(mgr.searchLabs('quantumfieldtheory')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// registerLab
// ---------------------------------------------------------------------------

describe('registerLab', () => {
  it('adds a custom lab', () => {
    const mgr = LabTemplateManager.getInstance();
    const custom: LabTemplate = {
      id: 'custom-lab',
      title: 'Custom Lab',
      description: 'A custom lab.',
      category: 'digital',
      difficulty: 'beginner',
      estimatedMinutes: 15,
      prerequisites: [],
      objectives: [{ id: 'o1', description: 'Learn something' }],
      steps: [
        { id: 's1', title: 'Step 1', instructions: 'Do this.', expectedOutcome: 'Done.', order: 0 },
      ],
      gradingCriteria: [{ id: 'g1', description: 'Did it', type: 'binary', points: 100 }],
      tags: ['custom'],
      version: 1,
    };
    mgr.registerLab(custom);
    expect(mgr.listLabs()).toHaveLength(6);
    expect(mgr.getLab('custom-lab')).toBeDefined();
  });

  it('throws on duplicate id', () => {
    const mgr = LabTemplateManager.getInstance();
    expect(() =>
      mgr.registerLab({
        id: 'led-circuit-basics',
        title: 'Dup',
        description: '',
        category: 'fundamentals',
        difficulty: 'beginner',
        estimatedMinutes: 5,
        prerequisites: [],
        objectives: [],
        steps: [],
        gradingCriteria: [],
        tags: [],
        version: 1,
      }),
    ).toThrow('already exists');
  });
});

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

describe('Session management', () => {
  it('starts a lab session', () => {
    const mgr = LabTemplateManager.getInstance();
    const session = mgr.startLab('led-circuit-basics');
    expect(session.labId).toBe('led-circuit-basics');
    expect(session.status).toBe('in-progress');
    expect(session.stepProgress.length).toBe(5);
    expect(session.startedAt).toBeGreaterThan(0);
  });

  it('returns existing in-progress session on re-start', () => {
    const mgr = LabTemplateManager.getInstance();
    const s1 = mgr.startLab('led-circuit-basics');
    const s2 = mgr.startLab('led-circuit-basics');
    expect(s1.startedAt).toBe(s2.startedAt);
  });

  it('throws when starting a nonexistent lab', () => {
    const mgr = LabTemplateManager.getInstance();
    expect(() => mgr.startLab('nope')).toThrow('not found');
  });

  it('retrieves a session', () => {
    const mgr = LabTemplateManager.getInstance();
    mgr.startLab('led-circuit-basics');
    const session = mgr.getSession('led-circuit-basics');
    expect(session).toBeDefined();
    expect(session!.status).toBe('in-progress');
  });

  it('returns undefined for no session', () => {
    const mgr = LabTemplateManager.getInstance();
    expect(mgr.getSession('led-circuit-basics')).toBeUndefined();
  });

  it('getAllSessions returns all active sessions', () => {
    const mgr = LabTemplateManager.getInstance();
    mgr.startLab('led-circuit-basics');
    mgr.startLab('voltage-divider-lab');
    const all = mgr.getAllSessions();
    expect(all.size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Step completion
// ---------------------------------------------------------------------------

describe('Step completion', () => {
  it('marks a step as completed', () => {
    const mgr = LabTemplateManager.getInstance();
    mgr.startLab('led-circuit-basics');
    mgr.completeStep('led-circuit-basics', 'led-step-1');
    const session = mgr.getSession('led-circuit-basics')!;
    const step = session.stepProgress.find((sp) => sp.stepId === 'led-step-1');
    expect(step!.completed).toBe(true);
    expect(step!.completedAt).toBeGreaterThan(0);
  });

  it('is idempotent for already-completed steps', () => {
    const mgr = LabTemplateManager.getInstance();
    mgr.startLab('led-circuit-basics');
    mgr.completeStep('led-circuit-basics', 'led-step-1');
    const session1 = mgr.getSession('led-circuit-basics')!;
    const ts1 = session1.stepProgress.find((sp) => sp.stepId === 'led-step-1')!.completedAt;
    mgr.completeStep('led-circuit-basics', 'led-step-1');
    const session2 = mgr.getSession('led-circuit-basics')!;
    const ts2 = session2.stepProgress.find((sp) => sp.stepId === 'led-step-1')!.completedAt;
    expect(ts1).toBe(ts2);
  });

  it('auto-completes lab when all steps are done', () => {
    const mgr = LabTemplateManager.getInstance();
    mgr.startLab('led-circuit-basics');
    const lab = mgr.getLab('led-circuit-basics')!;
    for (const step of lab.steps) {
      mgr.completeStep('led-circuit-basics', step.id);
    }
    const session = mgr.getSession('led-circuit-basics')!;
    expect(session.status).toBe('completed');
    expect(session.completedAt).toBeGreaterThan(0);
  });

  it('throws for no active session', () => {
    const mgr = LabTemplateManager.getInstance();
    expect(() => mgr.completeStep('led-circuit-basics', 'led-step-1')).toThrow('No active session');
  });

  it('throws for unknown step id', () => {
    const mgr = LabTemplateManager.getInstance();
    mgr.startLab('led-circuit-basics');
    expect(() => mgr.completeStep('led-circuit-basics', 'fake-step')).toThrow('not found');
  });
});

// ---------------------------------------------------------------------------
// Progress tracking
// ---------------------------------------------------------------------------

describe('Progress tracking', () => {
  it('returns zero progress for no session', () => {
    const mgr = LabTemplateManager.getInstance();
    const p = mgr.getProgress('led-circuit-basics');
    expect(p).toEqual({ completed: 0, total: 0, percent: 0 });
  });

  it('tracks partial progress', () => {
    const mgr = LabTemplateManager.getInstance();
    mgr.startLab('led-circuit-basics');
    mgr.completeStep('led-circuit-basics', 'led-step-1');
    mgr.completeStep('led-circuit-basics', 'led-step-2');
    const p = mgr.getProgress('led-circuit-basics');
    expect(p.completed).toBe(2);
    expect(p.total).toBe(5);
    expect(p.percent).toBe(40);
  });

  it('shows 100% when all steps done', () => {
    const mgr = LabTemplateManager.getInstance();
    mgr.startLab('led-circuit-basics');
    const lab = mgr.getLab('led-circuit-basics')!;
    for (const step of lab.steps) {
      mgr.completeStep('led-circuit-basics', step.id);
    }
    const p = mgr.getProgress('led-circuit-basics');
    expect(p.percent).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------

describe('Grading', () => {
  function completeLab(mgr: LabTemplateManager, labId: string): void {
    mgr.startLab(labId);
    const lab = mgr.getLab(labId)!;
    for (const step of lab.steps) {
      mgr.completeStep(labId, step.id);
    }
  }

  it('grades a completed lab', () => {
    const mgr = LabTemplateManager.getInstance();
    completeLab(mgr, 'led-circuit-basics');
    const lab = mgr.getLab('led-circuit-basics')!;
    const grades: GradeResult[] = lab.gradingCriteria.map((gc) => ({
      criterionId: gc.id,
      awarded: gc.points,
      maxPoints: gc.points,
    }));
    mgr.gradeLab('led-circuit-basics', grades);
    const session = mgr.getSession('led-circuit-basics')!;
    expect(session.status).toBe('graded');
    expect(session.totalScore).toBe(100);
    expect(session.maxScore).toBe(100);
    expect(session.gradedAt).toBeGreaterThan(0);
  });

  it('allows partial scores', () => {
    const mgr = LabTemplateManager.getInstance();
    completeLab(mgr, 'led-circuit-basics');
    const lab = mgr.getLab('led-circuit-basics')!;
    const grades: GradeResult[] = lab.gradingCriteria.map((gc) => ({
      criterionId: gc.id,
      awarded: Math.floor(gc.points / 2),
      maxPoints: gc.points,
    }));
    mgr.gradeLab('led-circuit-basics', grades);
    const session = mgr.getSession('led-circuit-basics')!;
    expect(session.totalScore).toBeLessThan(100);
    expect(session.status).toBe('graded');
  });

  it('throws for unknown criterion', () => {
    const mgr = LabTemplateManager.getInstance();
    completeLab(mgr, 'led-circuit-basics');
    expect(() =>
      mgr.gradeLab('led-circuit-basics', [{ criterionId: 'fake', awarded: 10, maxPoints: 10 }]),
    ).toThrow('Unknown grading criterion');
  });

  it('throws for out-of-range grade', () => {
    const mgr = LabTemplateManager.getInstance();
    completeLab(mgr, 'led-circuit-basics');
    expect(() =>
      mgr.gradeLab('led-circuit-basics', [{ criterionId: 'gc-1', awarded: 999, maxPoints: 20 }]),
    ).toThrow('must be between');
  });

  it('throws for no session', () => {
    const mgr = LabTemplateManager.getInstance();
    expect(() => mgr.gradeLab('led-circuit-basics', [])).toThrow('No session');
  });
});

// ---------------------------------------------------------------------------
// Prerequisites
// ---------------------------------------------------------------------------

describe('Prerequisites', () => {
  it('returns met=true when no prerequisites', () => {
    const mgr = LabTemplateManager.getInstance();
    const result = mgr.checkPrerequisites('led-circuit-basics');
    expect(result.met).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('returns missing prerequisites when not completed', () => {
    const mgr = LabTemplateManager.getInstance();
    const result = mgr.checkPrerequisites('voltage-divider-lab');
    expect(result.met).toBe(false);
    expect(result.missing).toContain('led-circuit-basics');
  });

  it('returns met=true after prerequisite is completed', () => {
    const mgr = LabTemplateManager.getInstance();
    // Complete the prerequisite
    mgr.startLab('led-circuit-basics');
    const lab = mgr.getLab('led-circuit-basics')!;
    for (const step of lab.steps) {
      mgr.completeStep('led-circuit-basics', step.id);
    }
    const result = mgr.checkPrerequisites('voltage-divider-lab');
    expect(result.met).toBe(true);
  });

  it('returns { met: false, missing: [] } for unknown lab', () => {
    const mgr = LabTemplateManager.getInstance();
    const result = mgr.checkPrerequisites('nonexistent');
    expect(result.met).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

describe('Reset', () => {
  it('resets a single lab session', () => {
    const mgr = LabTemplateManager.getInstance();
    mgr.startLab('led-circuit-basics');
    mgr.resetLab('led-circuit-basics');
    expect(mgr.getSession('led-circuit-basics')).toBeUndefined();
  });

  it('resets all sessions', () => {
    const mgr = LabTemplateManager.getInstance();
    mgr.startLab('led-circuit-basics');
    mgr.startLab('voltage-divider-lab');
    mgr.resetAllSessions();
    expect(mgr.getAllSessions().size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

describe('Persistence', () => {
  it('persists sessions to localStorage', () => {
    const mgr = LabTemplateManager.getInstance();
    mgr.startLab('led-circuit-basics');
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'protopulse-lab-sessions',
      expect.any(String),
    );
  });

  it('restores sessions from localStorage', () => {
    const mgr1 = LabTemplateManager.getInstance();
    mgr1.startLab('led-circuit-basics');
    mgr1.completeStep('led-circuit-basics', 'led-step-1');

    // Create a new instance that reads from localStorage
    LabTemplateManager.resetForTesting();
    const mgr2 = LabTemplateManager.getInstance();
    const session = mgr2.getSession('led-circuit-basics');
    expect(session).toBeDefined();
    expect(session!.status).toBe('in-progress');
    const step = session!.stepProgress.find((sp) => sp.stepId === 'led-step-1');
    expect(step!.completed).toBe(true);
  });

  it('handles corrupted localStorage gracefully', () => {
    store['protopulse-lab-sessions'] = 'not json{{{';
    const mgr = LabTemplateManager.getInstance();
    expect(mgr.getAllSessions().size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Subscribe
// ---------------------------------------------------------------------------

describe('Subscribe', () => {
  it('notifies listeners on state change', () => {
    const mgr = LabTemplateManager.getInstance();
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.startLab('led-circuit-basics');
    expect(listener).toHaveBeenCalled();
  });

  it('unsubscribe stops notifications', () => {
    const mgr = LabTemplateManager.getInstance();
    const listener = vi.fn();
    const unsub = mgr.subscribe(listener);
    unsub();
    mgr.startLab('led-circuit-basics');
    expect(listener).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

describe('Singleton', () => {
  it('returns the same instance', () => {
    const a = LabTemplateManager.getInstance();
    const b = LabTemplateManager.getInstance();
    expect(a).toBe(b);
  });

  it('resetForTesting creates a fresh instance', () => {
    const a = LabTemplateManager.getInstance();
    LabTemplateManager.resetForTesting();
    const b = LabTemplateManager.getInstance();
    expect(a).not.toBe(b);
  });
});
