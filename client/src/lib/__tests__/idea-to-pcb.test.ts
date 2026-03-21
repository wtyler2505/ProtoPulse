import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { IdeaToPcbManager } from '../idea-to-pcb';
import type {
  WorkflowStep,
  WorkflowStage,
  WorkflowConfig,
  WorkflowProgress,
  WorkflowRecommendation,
} from '../idea-to-pcb';

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  IdeaToPcbManager.resetInstance();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-21T00:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

describe('IdeaToPcbManager — singleton', () => {
  it('returns the same instance', () => {
    const a = IdeaToPcbManager.getInstance();
    const b = IdeaToPcbManager.getInstance();
    expect(a).toBe(b);
  });

  it('resetInstance clears the singleton', () => {
    const a = IdeaToPcbManager.getInstance();
    IdeaToPcbManager.resetInstance();
    const b = IdeaToPcbManager.getInstance();
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

describe('Initialization', () => {
  it('creates 18 default steps', () => {
    const mgr = new IdeaToPcbManager();
    expect(mgr.getAllSteps()).toHaveLength(18);
  });

  it('initializes 8 stages', () => {
    const mgr = new IdeaToPcbManager();
    expect(mgr.getStages()).toHaveLength(8);
  });

  it('sets default config values', () => {
    const mgr = new IdeaToPcbManager();
    const cfg = mgr.getConfig();
    expect(cfg.projectName).toBe('Untitled Project');
    expect(cfg.complexity).toBe('moderate');
    expect(cfg.skipSimulation).toBe(false);
    expect(cfg.skipOrdering).toBe(false);
  });

  it('accepts custom config', () => {
    const mgr = new IdeaToPcbManager({
      projectName: 'Rover',
      complexity: 'complex',
      skipSimulation: true,
    });
    const cfg = mgr.getConfig();
    expect(cfg.projectName).toBe('Rover');
    expect(cfg.complexity).toBe('complex');
    expect(cfg.skipSimulation).toBe(true);
  });

  it('marks simulation steps as skipped when skipSimulation is true', () => {
    const mgr = new IdeaToPcbManager({ skipSimulation: true });
    const simSteps = mgr.getStepsForStage('simulation');
    simSteps.forEach((s) => expect(s.status).toBe('skipped'));
  });

  it('marks ordering steps as skipped when skipOrdering is true', () => {
    const mgr = new IdeaToPcbManager({ skipOrdering: true });
    const ordSteps = mgr.getStepsForStage('ordering');
    ordSteps.forEach((s) => expect(s.status).toBe('skipped'));
  });

  it('applies complexity multiplier to time estimates', () => {
    const simple = new IdeaToPcbManager({ complexity: 'simple' });
    const complex = new IdeaToPcbManager({ complexity: 'complex' });
    const sGoals = simple.getStep('idea-define-goals')!;
    const cGoals = complex.getStep('idea-define-goals')!;
    expect(cGoals.estimatedMinutes).toBeGreaterThan(sGoals.estimatedMinutes);
  });

  it('first step is pending, later steps are blocked', () => {
    const mgr = new IdeaToPcbManager();
    const first = mgr.getStep('idea-define-goals')!;
    expect(first.status).toBe('pending');
    // sch-capture depends on arch-bom-initial which depends on...
    const schCapture = mgr.getStep('sch-capture')!;
    expect(schCapture.status).toBe('blocked');
  });
});

// ---------------------------------------------------------------------------
// Step transitions
// ---------------------------------------------------------------------------

describe('Step transitions', () => {
  it('completes a step', () => {
    const mgr = new IdeaToPcbManager();
    const ok = mgr.completeStep('idea-define-goals');
    expect(ok).toBe(true);
    expect(mgr.getStep('idea-define-goals')!.status).toBe('completed');
    expect(mgr.getStep('idea-define-goals')!.completedAt).toBe(Date.now());
  });

  it('rejects completing a non-existent step', () => {
    const mgr = new IdeaToPcbManager();
    expect(mgr.completeStep('no-such-step')).toBe(false);
  });

  it('rejects completing a blocked step', () => {
    const mgr = new IdeaToPcbManager();
    expect(mgr.completeStep('sch-capture')).toBe(false);
  });

  it('rejects completing an already completed step', () => {
    const mgr = new IdeaToPcbManager();
    mgr.completeStep('idea-define-goals');
    expect(mgr.completeStep('idea-define-goals')).toBe(false);
  });

  it('rejects completing a skipped step', () => {
    const mgr = new IdeaToPcbManager({ skipSimulation: true });
    expect(mgr.completeStep('sim-dc-analysis')).toBe(false);
  });

  it('unblocks dependents when prerequisite is completed', () => {
    const mgr = new IdeaToPcbManager();
    // idea-research depends on idea-define-goals
    expect(mgr.getStep('idea-research')!.status).toBe('blocked');
    mgr.completeStep('idea-define-goals');
    expect(mgr.getStep('idea-research')!.status).toBe('pending');
  });

  it('skips a step', () => {
    const mgr = new IdeaToPcbManager();
    expect(mgr.skipStep('idea-define-goals')).toBe(true);
    expect(mgr.getStep('idea-define-goals')!.status).toBe('skipped');
  });

  it('rejects skipping a completed step', () => {
    const mgr = new IdeaToPcbManager();
    mgr.completeStep('idea-define-goals');
    expect(mgr.skipStep('idea-define-goals')).toBe(false);
  });

  it('rejects skipping a blocked step', () => {
    const mgr = new IdeaToPcbManager();
    expect(mgr.skipStep('sch-capture')).toBe(false);
  });

  it('activates a pending step', () => {
    const mgr = new IdeaToPcbManager();
    expect(mgr.activateStep('idea-define-goals')).toBe(true);
    expect(mgr.getStep('idea-define-goals')!.status).toBe('active');
  });

  it('rejects activating a non-pending step', () => {
    const mgr = new IdeaToPcbManager();
    mgr.completeStep('idea-define-goals');
    expect(mgr.activateStep('idea-define-goals')).toBe(false);
  });

  it('rejects activating a non-existent step', () => {
    const mgr = new IdeaToPcbManager();
    expect(mgr.activateStep('nope')).toBe(false);
  });

  it('resets a step back to pending', () => {
    const mgr = new IdeaToPcbManager();
    mgr.completeStep('idea-define-goals');
    expect(mgr.resetStep('idea-define-goals')).toBe(true);
    expect(mgr.getStep('idea-define-goals')!.status).toBe('pending');
    expect(mgr.getStep('idea-define-goals')!.completedAt).toBeNull();
  });

  it('rejects resetting an already pending step', () => {
    const mgr = new IdeaToPcbManager();
    expect(mgr.resetStep('idea-define-goals')).toBe(false);
  });

  it('resets a completed step and re-blocks dependents', () => {
    const mgr = new IdeaToPcbManager();
    mgr.completeStep('idea-define-goals');
    expect(mgr.getStep('idea-research')!.status).toBe('pending');
    mgr.resetStep('idea-define-goals');
    expect(mgr.getStep('idea-research')!.status).toBe('blocked');
  });

  it('completing an active step works', () => {
    const mgr = new IdeaToPcbManager();
    mgr.activateStep('idea-define-goals');
    expect(mgr.completeStep('idea-define-goals')).toBe(true);
    expect(mgr.getStep('idea-define-goals')!.status).toBe('completed');
  });
});

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

describe('Progress', () => {
  it('starts at 0% progress', () => {
    const mgr = new IdeaToPcbManager();
    const p = mgr.getProgress();
    expect(p.completedSteps).toBe(0);
    expect(p.totalSteps).toBe(18);
    expect(p.percentage).toBe(0);
    expect(p.currentStage).toBe('ideation');
  });

  it('updates progress after completing steps', () => {
    const mgr = new IdeaToPcbManager();
    mgr.completeStep('idea-define-goals');
    mgr.completeStep('idea-research');
    const p = mgr.getProgress();
    expect(p.completedSteps).toBe(2);
    expect(p.percentage).toBe(Math.round((2 / 18) * 100));
  });

  it('skipped steps do not count toward total', () => {
    const mgr = new IdeaToPcbManager({ skipSimulation: true });
    const p = mgr.getProgress();
    expect(p.totalSteps).toBe(16); // 18 - 2 sim steps
  });

  it('advances currentStage when all steps in a stage are done', () => {
    const mgr = new IdeaToPcbManager();
    mgr.completeStep('idea-define-goals');
    mgr.completeStep('idea-research');
    const p = mgr.getProgress();
    expect(p.currentStage).toBe('architecture');
  });

  it('100% when all steps are completed or skipped', () => {
    const mgr = new IdeaToPcbManager();
    const allSteps = mgr.getAllSteps();
    // Complete all in order — need to handle prerequisites
    allSteps.forEach((s) => {
      if (s.status === 'blocked') {
        // Skip blocked steps — they'll unblock as we go
      }
    });
    // Just skip every step for simplicity
    allSteps.forEach((s) => {
      if (s.status !== 'completed' && s.status !== 'skipped') {
        mgr.skipStep(s.id);
      }
    });
    // Some may still be blocked, skip those too after unblocking
    mgr.getAllSteps().forEach((s) => {
      if (s.status !== 'completed' && s.status !== 'skipped') {
        mgr.skipStep(s.id);
      }
    });
    expect(mgr.isComplete()).toBe(true);
    expect(mgr.getProgress().percentage).toBe(100);
  });

  it('estimatedMinutesRemaining decreases as steps complete', () => {
    const mgr = new IdeaToPcbManager();
    const before = mgr.getProgress().estimatedMinutesRemaining;
    mgr.completeStep('idea-define-goals');
    const after = mgr.getProgress().estimatedMinutesRemaining;
    expect(after).toBeLessThan(before);
  });
});

// ---------------------------------------------------------------------------
// Time estimation
// ---------------------------------------------------------------------------

describe('Time estimation', () => {
  it('returns total estimated minutes', () => {
    const mgr = new IdeaToPcbManager();
    expect(mgr.getEstimatedTotalMinutes()).toBeGreaterThan(0);
  });

  it('simple complexity has lower total than complex', () => {
    const simple = new IdeaToPcbManager({ complexity: 'simple' });
    const complex = new IdeaToPcbManager({ complexity: 'complex' });
    expect(simple.getEstimatedTotalMinutes()).toBeLessThan(complex.getEstimatedTotalMinutes());
  });

  it('elapsed minutes tracks time since creation', () => {
    const mgr = new IdeaToPcbManager();
    expect(mgr.getElapsedMinutes()).toBe(0);
    vi.advanceTimersByTime(10 * 60_000);
    expect(mgr.getElapsedMinutes()).toBe(10);
  });

  it('skipped steps excluded from total time', () => {
    const withSim = new IdeaToPcbManager();
    const withoutSim = new IdeaToPcbManager({ skipSimulation: true });
    expect(withoutSim.getEstimatedTotalMinutes()).toBeLessThan(withSim.getEstimatedTotalMinutes());
  });
});

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

describe('Recommendations', () => {
  it('returns recommendations', () => {
    const mgr = new IdeaToPcbManager();
    const recs = mgr.getRecommendations();
    expect(recs.length).toBeGreaterThan(0);
  });

  it('active steps get high priority', () => {
    const mgr = new IdeaToPcbManager();
    mgr.activateStep('idea-define-goals');
    const recs = mgr.getRecommendations();
    const active = recs.find((r) => r.stepId === 'idea-define-goals');
    expect(active).toBeDefined();
    expect(active!.priority).toBe('high');
  });

  it('next pending step gets medium priority', () => {
    const mgr = new IdeaToPcbManager();
    const recs = mgr.getRecommendations();
    const medium = recs.find((r) => r.priority === 'medium');
    expect(medium).toBeDefined();
  });

  it('steps have per-step recommendations', () => {
    const mgr = new IdeaToPcbManager();
    const first = mgr.getStep('idea-define-goals')!;
    expect(first.recommendations.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Bulk operations
// ---------------------------------------------------------------------------

describe('Bulk operations', () => {
  it('completes an entire stage', () => {
    const mgr = new IdeaToPcbManager();
    const count = mgr.completeStage('ideation');
    expect(count).toBe(2);
    mgr.getStepsForStage('ideation').forEach((s) => {
      expect(s.status).toBe('completed');
    });
  });

  it('skips an entire stage', () => {
    const mgr = new IdeaToPcbManager();
    const count = mgr.skipStage('simulation');
    expect(count).toBe(2);
    mgr.getStepsForStage('simulation').forEach((s) => {
      expect(s.status).toBe('skipped');
    });
  });

  it('completeStage does not complete blocked steps', () => {
    const mgr = new IdeaToPcbManager();
    // schematic steps are blocked
    const count = mgr.completeStage('schematic');
    expect(count).toBe(0);
  });

  it('resetAll resets everything', () => {
    const mgr = new IdeaToPcbManager();
    mgr.completeStep('idea-define-goals');
    mgr.resetAll();
    expect(mgr.getStep('idea-define-goals')!.status).toBe('pending');
    expect(mgr.getProgress().completedSteps).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Config updates
// ---------------------------------------------------------------------------

describe('Config updates', () => {
  it('updates project name', () => {
    const mgr = new IdeaToPcbManager();
    mgr.updateConfig({ projectName: 'New Name' });
    expect(mgr.getConfig().projectName).toBe('New Name');
  });

  it('toggling skipSimulation changes step statuses', () => {
    const mgr = new IdeaToPcbManager();
    mgr.updateConfig({ skipSimulation: true });
    mgr.getStepsForStage('simulation').forEach((s) => {
      expect(s.status).toBe('skipped');
    });
    mgr.updateConfig({ skipSimulation: false });
    mgr.getStepsForStage('simulation').forEach((s) => {
      expect(s.status).not.toBe('skipped');
    });
  });

  it('toggling skipOrdering changes step statuses', () => {
    const mgr = new IdeaToPcbManager();
    mgr.updateConfig({ skipOrdering: true });
    mgr.getStepsForStage('ordering').forEach((s) => {
      expect(s.status).toBe('skipped');
    });
  });

  it('changing complexity recalculates time estimates', () => {
    const mgr = new IdeaToPcbManager({ complexity: 'simple' });
    const before = mgr.getEstimatedTotalMinutes();
    mgr.updateConfig({ complexity: 'complex' });
    const after = mgr.getEstimatedTotalMinutes();
    expect(after).toBeGreaterThan(before);
  });
});

// ---------------------------------------------------------------------------
// Dependency graph
// ---------------------------------------------------------------------------

describe('Dependency graph', () => {
  it('returns dependency edges', () => {
    const mgr = new IdeaToPcbManager();
    const edges = mgr.getDependencyGraph();
    expect(edges.length).toBeGreaterThan(0);
  });

  it('getBlockersFor returns unmet prerequisites', () => {
    const mgr = new IdeaToPcbManager();
    const blockers = mgr.getBlockersFor('idea-research');
    expect(blockers).toContain('idea-define-goals');
  });

  it('getBlockersFor returns empty after prerequisite is completed', () => {
    const mgr = new IdeaToPcbManager();
    mgr.completeStep('idea-define-goals');
    expect(mgr.getBlockersFor('idea-research')).toHaveLength(0);
  });

  it('getDependentsOf returns steps that depend on a given step', () => {
    const mgr = new IdeaToPcbManager();
    const deps = mgr.getDependentsOf('idea-define-goals');
    expect(deps).toContain('idea-research');
    expect(deps).toContain('arch-block-diagram');
  });

  it('getBlockersFor returns empty for non-existent step', () => {
    const mgr = new IdeaToPcbManager();
    expect(mgr.getBlockersFor('nonexistent')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Critical path
// ---------------------------------------------------------------------------

describe('Critical path', () => {
  it('returns a non-empty critical path', () => {
    const mgr = new IdeaToPcbManager();
    const path = mgr.getCriticalPath();
    expect(path.length).toBeGreaterThan(0);
  });

  it('critical path contains only pending/active steps', () => {
    const mgr = new IdeaToPcbManager();
    mgr.completeStep('idea-define-goals');
    const path = mgr.getCriticalPath();
    expect(path).not.toContain('idea-define-goals');
  });

  it('critical path shortens as steps are completed', () => {
    const mgr = new IdeaToPcbManager();
    const before = mgr.getCriticalPath().length;
    mgr.completeStep('idea-define-goals');
    const after = mgr.getCriticalPath().length;
    expect(after).toBeLessThan(before);
  });

  it('critical path is empty when all steps are done/skipped', () => {
    const mgr = new IdeaToPcbManager({ skipSimulation: true, skipOrdering: true });
    // Complete all stages in order — each stage unblocks the next
    const stages: WorkflowStage[] = [
      'ideation', 'architecture', 'schematic', 'pcb', 'validation', 'manufacturing',
    ];
    stages.forEach((stage) => mgr.completeStage(stage));
    expect(mgr.isComplete()).toBe(true);
    expect(mgr.getCriticalPath()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

describe('Serialization', () => {
  it('round-trips through serialize/deserialize', () => {
    const mgr = new IdeaToPcbManager({ projectName: 'Test', complexity: 'complex' });
    mgr.completeStep('idea-define-goals');

    const json = mgr.serialize();
    const restored = IdeaToPcbManager.deserialize(json);

    expect(restored.getConfig().projectName).toBe('Test');
    expect(restored.getConfig().complexity).toBe('complex');
    expect(restored.getStep('idea-define-goals')!.status).toBe('completed');
    expect(restored.getStep('idea-research')!.status).toBe('pending');
  });

  it('preserves createdAt through serialization', () => {
    const mgr = new IdeaToPcbManager();
    const original = mgr.getCreatedAt();
    const json = mgr.serialize();
    const restored = IdeaToPcbManager.deserialize(json);
    expect(restored.getCreatedAt()).toBe(original);
  });
});

// ---------------------------------------------------------------------------
// Subscribe
// ---------------------------------------------------------------------------

describe('Subscribe', () => {
  it('notifies subscribers on step completion', () => {
    const mgr = new IdeaToPcbManager();
    const fn = vi.fn();
    mgr.subscribe(fn);
    mgr.completeStep('idea-define-goals');
    expect(fn).toHaveBeenCalled();
  });

  it('unsubscribe stops notifications', () => {
    const mgr = new IdeaToPcbManager();
    const fn = vi.fn();
    const unsub = mgr.subscribe(fn);
    unsub();
    mgr.completeStep('idea-define-goals');
    expect(fn).not.toHaveBeenCalled();
  });

  it('notifies on config update', () => {
    const mgr = new IdeaToPcbManager();
    const fn = vi.fn();
    mgr.subscribe(fn);
    mgr.updateConfig({ projectName: 'Changed' });
    expect(fn).toHaveBeenCalled();
  });

  it('notifies on resetAll', () => {
    const mgr = new IdeaToPcbManager();
    const fn = vi.fn();
    mgr.subscribe(fn);
    mgr.resetAll();
    expect(fn).toHaveBeenCalled();
  });

  it('notifies on skip', () => {
    const mgr = new IdeaToPcbManager();
    const fn = vi.fn();
    mgr.subscribe(fn);
    mgr.skipStep('idea-define-goals');
    expect(fn).toHaveBeenCalled();
  });

  it('notifies on activate', () => {
    const mgr = new IdeaToPcbManager();
    const fn = vi.fn();
    mgr.subscribe(fn);
    mgr.activateStep('idea-define-goals');
    expect(fn).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

describe('Queries', () => {
  it('getStep returns undefined for non-existent step', () => {
    const mgr = new IdeaToPcbManager();
    expect(mgr.getStep('nope')).toBeUndefined();
  });

  it('getStep returns a copy (not reference)', () => {
    const mgr = new IdeaToPcbManager();
    const step = mgr.getStep('idea-define-goals')!;
    step.name = 'MODIFIED';
    expect(mgr.getStep('idea-define-goals')!.name).not.toBe('MODIFIED');
  });

  it('getStepsForStage returns only steps for that stage', () => {
    const mgr = new IdeaToPcbManager();
    const ideation = mgr.getStepsForStage('ideation');
    ideation.forEach((s) => expect(s.stage).toBe('ideation'));
    expect(ideation.length).toBeGreaterThan(0);
  });

  it('getStages returns correct stage count', () => {
    const mgr = new IdeaToPcbManager();
    expect(mgr.getStages()).toHaveLength(8);
  });

  it('each stage references valid step IDs', () => {
    const mgr = new IdeaToPcbManager();
    mgr.getStages().forEach((stageInfo) => {
      stageInfo.steps.forEach((stepId) => {
        expect(mgr.getStep(stepId)).toBeDefined();
      });
    });
  });

  it('isComplete returns false initially', () => {
    const mgr = new IdeaToPcbManager();
    expect(mgr.isComplete()).toBe(false);
  });

  it('getAllSteps returns copies', () => {
    const mgr = new IdeaToPcbManager();
    const steps = mgr.getAllSteps();
    steps[0].name = 'MODIFIED';
    expect(mgr.getAllSteps()[0].name).not.toBe('MODIFIED');
  });
});

// ---------------------------------------------------------------------------
// Stage info
// ---------------------------------------------------------------------------

describe('Stage info', () => {
  it('each stage has a label and description', () => {
    const mgr = new IdeaToPcbManager();
    mgr.getStages().forEach((stage) => {
      expect(stage.label.length).toBeGreaterThan(0);
      expect(stage.description.length).toBeGreaterThan(0);
    });
  });

  it('stages are in correct order', () => {
    const mgr = new IdeaToPcbManager();
    const stages = mgr.getStages();
    const stageNames = stages.map((s) => s.stage);
    expect(stageNames).toEqual([
      'ideation', 'architecture', 'schematic', 'simulation',
      'pcb', 'validation', 'manufacturing', 'ordering',
    ]);
  });
});
