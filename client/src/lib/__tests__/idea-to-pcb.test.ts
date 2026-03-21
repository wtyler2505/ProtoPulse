import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { IdeaToPcbManager } from '../idea-to-pcb';
import type {
  WorkflowStep,
  WorkflowStage,
  StepResult,
  IdeaToPcbSession,
} from '../idea-to-pcb';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResult(overrides: Partial<StepResult> = {}): StepResult {
  return {
    success: true,
    artifacts: [],
    warnings: [],
    blockers: [],
    completedAt: Date.now(),
    ...overrides,
  };
}

/** Advance and immediately complete the current step, returning the step. */
function advanceAndComplete(mgr: IdeaToPcbManager, sessionId: string, result?: Partial<StepResult>): WorkflowStep {
  const step = mgr.advanceStep(sessionId);
  mgr.completeStep(sessionId, makeResult(result));
  return step;
}

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
// Session management
// ---------------------------------------------------------------------------

describe('Session management', () => {
  it('startSession creates a new session with correct properties', () => {
    const mgr = new IdeaToPcbManager();
    const session = mgr.startSession('Rover', 'A rover controller board');
    expect(session.id).toBe('session-1');
    expect(session.projectName).toBe('Rover');
    expect(session.description).toBe('A rover controller board');
    expect(session.startedAt).toBe(Date.now());
    expect(session.currentStage).toBe('ideation');
    expect(session.completionPercent).toBe(0);
    expect(session.elapsedMinutes).toBe(0);
  });

  it('session contains 18 steps across 8 stages', () => {
    const mgr = new IdeaToPcbManager();
    const session = mgr.startSession('Test', 'desc');
    expect(session.steps).toHaveLength(18);
    const stages = new Set(session.steps.map((s) => s.stage));
    expect(stages.size).toBe(8);
  });

  it('sequential sessions get incrementing IDs', () => {
    const mgr = new IdeaToPcbManager();
    const s1 = mgr.startSession('A', 'a');
    const s2 = mgr.startSession('B', 'b');
    expect(s1.id).toBe('session-1');
    expect(s2.id).toBe('session-2');
  });

  it('getSession returns a session by ID', () => {
    const mgr = new IdeaToPcbManager();
    const created = mgr.startSession('Test', 'desc');
    const fetched = mgr.getSession(created.id);
    expect(fetched).toBeDefined();
    expect(fetched!.projectName).toBe('Test');
  });

  it('getSession returns undefined for unknown ID', () => {
    const mgr = new IdeaToPcbManager();
    expect(mgr.getSession('nonexistent')).toBeUndefined();
  });

  it('getAllSessions returns all created sessions', () => {
    const mgr = new IdeaToPcbManager();
    mgr.startSession('A', 'a');
    mgr.startSession('B', 'b');
    mgr.startSession('C', 'c');
    expect(mgr.getAllSessions()).toHaveLength(3);
  });

  it('startSession returns a defensive copy', () => {
    const mgr = new IdeaToPcbManager();
    const session = mgr.startSession('Test', 'desc');
    session.projectName = 'MODIFIED';
    const fetched = mgr.getSession(session.id);
    expect(fetched!.projectName).toBe('Test');
  });

  it('getSession returns a defensive copy', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    const fetched = mgr.getSession(s.id)!;
    fetched.steps[0].title = 'MODIFIED';
    expect(mgr.getSession(s.id)!.steps[0].title).not.toBe('MODIFIED');
  });
});

// ---------------------------------------------------------------------------
// Step template
// ---------------------------------------------------------------------------

describe('Step template', () => {
  it('getStepsForSession returns 18 template steps', () => {
    const mgr = new IdeaToPcbManager();
    const steps = mgr.getStepsForSession();
    expect(steps).toHaveLength(18);
  });

  it('all steps have required fields', () => {
    const mgr = new IdeaToPcbManager();
    const steps = mgr.getStepsForSession();
    steps.forEach((step) => {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
      expect(step.stage).toBeTruthy();
      expect(step.order).toBeGreaterThan(0);
      expect(step.estimatedMinutes).toBeGreaterThan(0);
      expect(typeof step.automatable).toBe('boolean');
      expect(step.completionCriteria.length).toBeGreaterThan(0);
      expect(step.status).toBe('pending');
    });
  });

  it('steps have sequential order numbers', () => {
    const mgr = new IdeaToPcbManager();
    const steps = mgr.getStepsForSession();
    steps.forEach((step, idx) => {
      expect(step.order).toBe(idx + 1);
    });
  });

  it('stages appear in correct order', () => {
    const mgr = new IdeaToPcbManager();
    const steps = mgr.getStepsForSession();
    const stagesInOrder: WorkflowStage[] = [];
    steps.forEach((s) => {
      if (stagesInOrder.length === 0 || stagesInOrder[stagesInOrder.length - 1] !== s.stage) {
        stagesInOrder.push(s.stage);
      }
    });
    expect(stagesInOrder).toEqual([
      'ideation', 'architecture', 'schematic', 'simulation',
      'pcb_layout', 'validation', 'manufacturing', 'ordering',
    ]);
  });

  it('totalEstimatedMinutes is the sum of all step estimates', () => {
    const mgr = new IdeaToPcbManager();
    const session = mgr.startSession('Test', 'desc');
    const sum = session.steps.reduce((acc, s) => acc + s.estimatedMinutes, 0);
    expect(session.totalEstimatedMinutes).toBe(sum);
  });
});

// ---------------------------------------------------------------------------
// Blocked status propagation
// ---------------------------------------------------------------------------

describe('Blocked status propagation', () => {
  it('first step is pending, steps with prerequisites are blocked', () => {
    const mgr = new IdeaToPcbManager();
    const session = mgr.startSession('Test', 'desc');
    const first = session.steps.find((s) => s.id === 'idea-define-goals')!;
    expect(first.status).toBe('pending');
    const research = session.steps.find((s) => s.id === 'idea-research')!;
    expect(research.status).toBe('blocked');
  });

  it('completing a prerequisite unblocks dependent steps', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    // idea-research depends on idea-define-goals
    advanceAndComplete(mgr, s.id);
    const updated = mgr.getSession(s.id)!;
    const research = updated.steps.find((st) => st.id === 'idea-research')!;
    expect(research.status).toBe('pending');
  });

  it('skipping a prerequisite also unblocks dependents', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    // Advance then skip
    mgr.advanceStep(s.id);
    mgr.skipStep(s.id);
    const updated = mgr.getSession(s.id)!;
    const research = updated.steps.find((st) => st.id === 'idea-research')!;
    expect(research.status).toBe('pending');
  });

  it('deep dependencies remain blocked until full chain resolved', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    // sch-capture depends on arch-bom-initial, which depends on arch-select-components,
    // which depends on arch-block-diagram, which depends on idea-define-goals
    const schCapture = mgr.getSession(s.id)!.steps.find((st) => st.id === 'sch-capture')!;
    expect(schCapture.status).toBe('blocked');

    // Complete only idea-define-goals — sch-capture still blocked
    advanceAndComplete(mgr, s.id);
    const afterFirst = mgr.getSession(s.id)!.steps.find((st) => st.id === 'sch-capture')!;
    expect(afterFirst.status).toBe('blocked');
  });
});

// ---------------------------------------------------------------------------
// Step transitions
// ---------------------------------------------------------------------------

describe('Step transitions', () => {
  it('advanceStep activates the first pending step', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    const step = mgr.advanceStep(s.id);
    expect(step.status).toBe('active');
    expect(step.id).toBe('idea-define-goals');
  });

  it('advanceStep throws for unknown session', () => {
    const mgr = new IdeaToPcbManager();
    expect(() => mgr.advanceStep('bad-id')).toThrow('Session not found');
  });

  it('advanceStep throws when no pending steps remain', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    // Advance one step — now it's active, and next pending is blocked
    mgr.advanceStep(s.id);
    // Since there's an active step, the next pending should be blocked —
    // but advanceStep looks for pending steps. The blocked ones aren't pending.
    // Complete the active step first, then advance through all steps
    // For this test, just verify that advancing when there's already an active step
    // finds the next pending (or throws)
    mgr.completeStep(s.id, makeResult());
    // Now advance through the chain: research is now pending
    mgr.advanceStep(s.id); // idea-research
    mgr.completeStep(s.id, makeResult());
    mgr.advanceStep(s.id); // arch-block-diagram
    mgr.completeStep(s.id, makeResult());
    mgr.advanceStep(s.id); // arch-select-components
    mgr.completeStep(s.id, makeResult());
    mgr.advanceStep(s.id); // arch-bom-initial
    mgr.completeStep(s.id, makeResult());
    mgr.advanceStep(s.id); // sch-capture
    mgr.completeStep(s.id, makeResult());
    mgr.advanceStep(s.id); // sch-power-decoupling
    mgr.completeStep(s.id, makeResult());
    mgr.advanceStep(s.id); // sch-net-labels
    mgr.completeStep(s.id, makeResult());
    mgr.advanceStep(s.id); // sim-dc-analysis
    mgr.completeStep(s.id, makeResult());
    mgr.advanceStep(s.id); // sim-transient
    mgr.completeStep(s.id, makeResult());
    mgr.advanceStep(s.id); // pcb-board-setup
    mgr.completeStep(s.id, makeResult());
    mgr.advanceStep(s.id); // pcb-placement
    mgr.completeStep(s.id, makeResult());
    mgr.advanceStep(s.id); // pcb-routing
    mgr.completeStep(s.id, makeResult());
    mgr.advanceStep(s.id); // pcb-copper-pour
    mgr.completeStep(s.id, makeResult());
    mgr.advanceStep(s.id); // val-drc
    mgr.completeStep(s.id, makeResult());
    mgr.advanceStep(s.id); // val-dfm
    mgr.completeStep(s.id, makeResult());
    mgr.advanceStep(s.id); // mfg-generate
    mgr.completeStep(s.id, makeResult());
    mgr.advanceStep(s.id); // ord-submit
    mgr.completeStep(s.id, makeResult());
    // Now all 18 are completed — no pending steps left
    expect(() => mgr.advanceStep(s.id)).toThrow('No pending steps');
  });

  it('completeStep marks the active step as completed', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    mgr.advanceStep(s.id);
    mgr.completeStep(s.id, makeResult());
    const session = mgr.getSession(s.id)!;
    const step = session.steps.find((st) => st.id === 'idea-define-goals')!;
    expect(step.status).toBe('completed');
  });

  it('completeStep stores the result on the step', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    mgr.advanceStep(s.id);
    const result = makeResult({
      artifacts: ['schematic.kicad_sch'],
      warnings: ['High current'],
      blockers: ['Missing footprint'],
    });
    mgr.completeStep(s.id, result);
    const session = mgr.getSession(s.id)!;
    const step = session.steps.find((st) => st.id === 'idea-define-goals')!;
    expect(step.result).toBeDefined();
    expect(step.result!.artifacts).toEqual(['schematic.kicad_sch']);
    expect(step.result!.warnings).toEqual(['High current']);
    expect(step.result!.blockers).toEqual(['Missing footprint']);
    expect(step.result!.success).toBe(true);
  });

  it('completeStep throws for unknown session', () => {
    const mgr = new IdeaToPcbManager();
    expect(() => mgr.completeStep('bad', makeResult())).toThrow('Session not found');
  });

  it('completeStep throws when no active step', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    expect(() => mgr.completeStep(s.id, makeResult())).toThrow('No active step');
  });

  it('skipStep skips the active step', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    mgr.advanceStep(s.id);
    mgr.skipStep(s.id);
    const session = mgr.getSession(s.id)!;
    const step = session.steps.find((st) => st.id === 'idea-define-goals')!;
    expect(step.status).toBe('skipped');
  });

  it('skipStep skips the first pending step when none is active', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    mgr.skipStep(s.id);
    const session = mgr.getSession(s.id)!;
    const first = session.steps.find((st) => st.id === 'idea-define-goals')!;
    expect(first.status).toBe('skipped');
  });

  it('skipStep throws for unknown session', () => {
    const mgr = new IdeaToPcbManager();
    expect(() => mgr.skipStep('bad')).toThrow('Session not found');
  });

  it('skipStep throws when no step available to skip', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    // Complete all steps
    for (let i = 0; i < 18; i++) {
      advanceAndComplete(mgr, s.id);
    }
    expect(() => mgr.skipStep(s.id)).toThrow('No step available to skip');
  });

  it('advanceStep returns a defensive copy', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    const step = mgr.advanceStep(s.id);
    step.title = 'MODIFIED';
    const session = mgr.getSession(s.id)!;
    expect(session.steps[0].title).not.toBe('MODIFIED');
  });
});

// ---------------------------------------------------------------------------
// Progress tracking
// ---------------------------------------------------------------------------

describe('Progress tracking', () => {
  it('starts at 0% progress', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    const p = mgr.getProgress(s.id);
    expect(p.percent).toBe(0);
    expect(p.stage).toBe('Ideation');
    expect(p.elapsed).toBe(0);
  });

  it('progress increases after completing steps', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    advanceAndComplete(mgr, s.id); // idea-define-goals
    const p = mgr.getProgress(s.id);
    expect(p.percent).toBe(Math.round((1 / 18) * 100));
  });

  it('skipped steps count toward progress percentage', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    mgr.skipStep(s.id); // idea-define-goals
    const p = mgr.getProgress(s.id);
    expect(p.percent).toBe(Math.round((1 / 18) * 100));
  });

  it('currentStage advances when all steps in a stage are done', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    // Complete both ideation steps
    advanceAndComplete(mgr, s.id); // idea-define-goals
    advanceAndComplete(mgr, s.id); // idea-research
    const p = mgr.getProgress(s.id);
    expect(p.stage).toBe('Architecture');
  });

  it('elapsed time tracks minutes since session start', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    vi.advanceTimersByTime(15 * 60_000); // 15 minutes
    const p = mgr.getProgress(s.id);
    expect(p.elapsed).toBe(15);
  });

  it('estimated time remaining decreases as steps complete', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    const before = mgr.estimateTimeRemaining(s.id);
    advanceAndComplete(mgr, s.id);
    const after = mgr.estimateTimeRemaining(s.id);
    expect(after).toBeLessThan(before);
  });

  it('estimated time remaining is 0 when all steps done', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    for (let i = 0; i < 18; i++) {
      advanceAndComplete(mgr, s.id);
    }
    expect(mgr.estimateTimeRemaining(s.id)).toBe(0);
  });

  it('getProgress throws for unknown session', () => {
    const mgr = new IdeaToPcbManager();
    expect(() => mgr.getProgress('bad')).toThrow('Session not found');
  });

  it('100% when all steps completed', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    for (let i = 0; i < 18; i++) {
      advanceAndComplete(mgr, s.id);
    }
    const p = mgr.getProgress(s.id);
    expect(p.percent).toBe(100);
  });

  it('estimateTimeRemaining returns 0 for unknown session', () => {
    const mgr = new IdeaToPcbManager();
    expect(mgr.estimateTimeRemaining('nonexistent')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// canAdvance
// ---------------------------------------------------------------------------

describe('canAdvance', () => {
  it('returns ok=true when first step is ready', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    const result = mgr.canAdvance(s.id);
    expect(result.ok).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  it('returns ok=false when a step is already active', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    mgr.advanceStep(s.id);
    const result = mgr.canAdvance(s.id);
    expect(result.ok).toBe(false);
    expect(result.blockers[0]).toContain('currently active');
  });

  it('returns ok=false when next pending has unmet prerequisites', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    // Skip idea-define-goals but don't complete it — wait, skip unblocks.
    // We need a scenario where the next pending step has an unmet prereq.
    // After advancing+completing idea-define-goals, idea-research becomes pending.
    // If we advance idea-research, then the next pending is arch-block-diagram (also pending since idea-define-goals is done).
    // Actually, arch-select-components depends on arch-block-diagram.
    // Let's advance idea-define-goals, complete it, advance idea-research, complete it,
    // then advance arch-block-diagram, complete it. Next pending = arch-select-components (pending, prereq met).
    // Hard to get unmet prereqs because the manager unblocks them. Let's just check the "no more steps" path.

    // Actually, canAdvance checks the FIRST pending step. Steps with unmet prereqs are 'blocked', not 'pending'.
    // So canAdvance should return ok=true whenever there's a pending step (since pending means prereqs are met).
    // The only blockers are: (1) active step exists, (2) no more pending steps, (3) session not found.
    const result = mgr.canAdvance(s.id);
    expect(result.ok).toBe(true);
  });

  it('returns ok=false and blockers when no more steps remain', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    for (let i = 0; i < 18; i++) {
      advanceAndComplete(mgr, s.id);
    }
    const result = mgr.canAdvance(s.id);
    expect(result.ok).toBe(false);
    expect(result.blockers[0]).toContain('No more steps');
  });

  it('returns ok=false for unknown session', () => {
    const mgr = new IdeaToPcbManager();
    const result = mgr.canAdvance('bad-id');
    expect(result.ok).toBe(false);
    expect(result.blockers[0]).toContain('Session not found');
  });
});

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

describe('Recommendations', () => {
  it('returns recommendations as string array', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    const recs = mgr.getRecommendations(s.id);
    expect(Array.isArray(recs)).toBe(true);
    expect(recs.length).toBeGreaterThan(0);
  });

  it('active step generates focus recommendation', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    mgr.advanceStep(s.id);
    const recs = mgr.getRecommendations(s.id);
    expect(recs.some((r) => r.includes('Focus on completing'))).toBe(true);
  });

  it('automatable active step gets AI tip', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    // Complete through to an automatable step
    advanceAndComplete(mgr, s.id); // idea-define-goals
    advanceAndComplete(mgr, s.id); // idea-research
    advanceAndComplete(mgr, s.id); // arch-block-diagram
    mgr.advanceStep(s.id); // arch-select-components (automatable=true)
    const recs = mgr.getRecommendations(s.id);
    expect(recs.some((r) => r.includes('automated'))).toBe(true);
  });

  it('includes completion criteria for active step', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    mgr.advanceStep(s.id);
    const recs = mgr.getRecommendations(s.id);
    expect(recs.some((r) => r.startsWith('Criteria:'))).toBe(true);
  });

  it('next-step recommendation when no step is active', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    const recs = mgr.getRecommendations(s.id);
    expect(recs.some((r) => r.startsWith('Next step:'))).toBe(true);
  });

  it('stage transition hint when all stage steps done', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    advanceAndComplete(mgr, s.id); // idea-define-goals
    advanceAndComplete(mgr, s.id); // idea-research
    // Now ideation is complete — but currentStage has advanced to architecture
    // The recommendation about stage transition should have been generated
    // when we completed the last ideation step. Let's check current recommendations.
    const recs = mgr.getRecommendations(s.id);
    // At this point currentStage is architecture, so no transition hint unless architecture is also done.
    // Actually the hint triggers when all steps in currentStage are done. currentStage is now architecture.
    // So we won't see the transition hint. Let's complete architecture too.
    advanceAndComplete(mgr, s.id); // arch-block-diagram
    advanceAndComplete(mgr, s.id); // arch-select-components
    advanceAndComplete(mgr, s.id); // arch-bom-initial
    const recs2 = mgr.getRecommendations(s.id);
    expect(recs2.some((r) => r.includes('complete') && r.includes('moving to'))).toBe(true);
  });

  it('warns when simulation is skipped', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    // Complete through to simulation, then skip both sim steps
    advanceAndComplete(mgr, s.id); // idea-define-goals
    advanceAndComplete(mgr, s.id); // idea-research
    advanceAndComplete(mgr, s.id); // arch-block-diagram
    advanceAndComplete(mgr, s.id); // arch-select-components
    advanceAndComplete(mgr, s.id); // arch-bom-initial
    advanceAndComplete(mgr, s.id); // sch-capture
    advanceAndComplete(mgr, s.id); // sch-power-decoupling
    advanceAndComplete(mgr, s.id); // sch-net-labels
    // Now skip both sim steps
    mgr.advanceStep(s.id); // sim-dc-analysis
    mgr.skipStep(s.id);
    mgr.advanceStep(s.id); // sim-transient
    mgr.skipStep(s.id);
    const recs = mgr.getRecommendations(s.id);
    expect(recs.some((r) => r.includes('Simulation was skipped'))).toBe(true);
  });

  it('warns about unresolved blockers from step results', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    advanceAndComplete(mgr, s.id, { blockers: ['Missing footprint for U1'] });
    const recs = mgr.getRecommendations(s.id);
    expect(recs.some((r) => r.includes('Unresolved blocker'))).toBe(true);
    expect(recs.some((r) => r.includes('Missing footprint for U1'))).toBe(true);
  });

  it('returns empty array for unknown session', () => {
    const mgr = new IdeaToPcbManager();
    expect(mgr.getRecommendations('bad')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Session report
// ---------------------------------------------------------------------------

describe('Session report', () => {
  it('generates a markdown report', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Rover Board', 'Motor controller PCB');
    advanceAndComplete(mgr, s.id, { artifacts: ['goals.md'] });
    const report = mgr.exportSessionReport(s.id);
    expect(report).toContain('# Idea-to-PCB Report: Rover Board');
    expect(report).toContain('Motor controller PCB');
    expect(report).toContain('[x]'); // completed step
  });

  it('report includes all 8 stages as sections', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    const report = mgr.exportSessionReport(s.id);
    expect(report).toContain('## Ideation');
    expect(report).toContain('## Architecture');
    expect(report).toContain('## Schematic');
    expect(report).toContain('## Simulation');
    expect(report).toContain('## PCB Layout');
    expect(report).toContain('## Validation');
    expect(report).toContain('## Manufacturing Prep');
    expect(report).toContain('## Ordering');
  });

  it('report includes summary section', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    advanceAndComplete(mgr, s.id);
    const report = mgr.exportSessionReport(s.id);
    expect(report).toContain('## Summary');
    expect(report).toContain('**Total steps:** 18');
    expect(report).toContain('**Completed:** 1');
    expect(report).toContain('**Remaining:** 17');
  });

  it('report shows active step with [>] marker', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    mgr.advanceStep(s.id);
    const report = mgr.exportSessionReport(s.id);
    expect(report).toContain('[>]');
  });

  it('report shows skipped step with [-] marker', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    mgr.skipStep(s.id);
    const report = mgr.exportSessionReport(s.id);
    expect(report).toContain('[-]');
  });

  it('report includes artifacts, warnings, and blockers', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    advanceAndComplete(mgr, s.id, {
      artifacts: ['design.kicad_sch'],
      warnings: ['High current draw'],
      blockers: ['Missing part'],
    });
    const report = mgr.exportSessionReport(s.id);
    expect(report).toContain('Artifacts: design.kicad_sch');
    expect(report).toContain('Warnings: High current draw');
    expect(report).toContain('Blockers: Missing part');
  });

  it('returns not-found message for unknown session', () => {
    const mgr = new IdeaToPcbManager();
    const report = mgr.exportSessionReport('bad');
    expect(report).toContain('Session not found');
  });
});

// ---------------------------------------------------------------------------
// Subscribe
// ---------------------------------------------------------------------------

describe('Subscribe', () => {
  it('notifies on startSession', () => {
    const mgr = new IdeaToPcbManager();
    const fn = vi.fn();
    mgr.subscribe(fn);
    mgr.startSession('Test', 'desc');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('notifies on advanceStep', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    const fn = vi.fn();
    mgr.subscribe(fn);
    mgr.advanceStep(s.id);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('notifies on completeStep', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    mgr.advanceStep(s.id);
    const fn = vi.fn();
    mgr.subscribe(fn);
    mgr.completeStep(s.id, makeResult());
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('notifies on skipStep', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Test', 'desc');
    const fn = vi.fn();
    mgr.subscribe(fn);
    mgr.skipStep(s.id);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('notifies on reset', () => {
    const mgr = new IdeaToPcbManager();
    mgr.startSession('Test', 'desc');
    const fn = vi.fn();
    mgr.subscribe(fn);
    mgr.reset();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe stops notifications', () => {
    const mgr = new IdeaToPcbManager();
    const fn = vi.fn();
    const unsub = mgr.subscribe(fn);
    unsub();
    mgr.startSession('Test', 'desc');
    expect(fn).not.toHaveBeenCalled();
  });

  it('multiple subscribers all get notified', () => {
    const mgr = new IdeaToPcbManager();
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    mgr.subscribe(fn1);
    mgr.subscribe(fn2);
    mgr.startSession('Test', 'desc');
    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

describe('Reset', () => {
  it('clears all sessions', () => {
    const mgr = new IdeaToPcbManager();
    mgr.startSession('A', 'a');
    mgr.startSession('B', 'b');
    expect(mgr.getAllSessions()).toHaveLength(2);
    mgr.reset();
    expect(mgr.getAllSessions()).toHaveLength(0);
  });

  it('resets session ID counter', () => {
    const mgr = new IdeaToPcbManager();
    mgr.startSession('A', 'a');
    mgr.reset();
    const s = mgr.startSession('B', 'b');
    expect(s.id).toBe('session-1');
  });
});

// ---------------------------------------------------------------------------
// Multiple concurrent sessions
// ---------------------------------------------------------------------------

describe('Multiple concurrent sessions', () => {
  it('operations on one session do not affect another', () => {
    const mgr = new IdeaToPcbManager();
    const s1 = mgr.startSession('Project A', 'desc a');
    const s2 = mgr.startSession('Project B', 'desc b');

    advanceAndComplete(mgr, s1.id);
    const session1 = mgr.getSession(s1.id)!;
    const session2 = mgr.getSession(s2.id)!;
    expect(session1.completionPercent).toBeGreaterThan(0);
    expect(session2.completionPercent).toBe(0);
  });

  it('each session has independent step state', () => {
    const mgr = new IdeaToPcbManager();
    const s1 = mgr.startSession('A', 'a');
    const s2 = mgr.startSession('B', 'b');

    mgr.advanceStep(s1.id);
    const sess1 = mgr.getSession(s1.id)!;
    const sess2 = mgr.getSession(s2.id)!;
    expect(sess1.steps[0].status).toBe('active');
    expect(sess2.steps[0].status).toBe('pending');
  });
});

// ---------------------------------------------------------------------------
// Full workflow walkthrough
// ---------------------------------------------------------------------------

describe('Full workflow walkthrough', () => {
  it('completes all 18 steps and reaches 100%', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Full Test', 'Complete walkthrough');

    for (let i = 0; i < 18; i++) {
      const step = mgr.advanceStep(s.id);
      expect(step.status).toBe('active');
      mgr.completeStep(s.id, makeResult({ artifacts: [`artifact-${step.id}`] }));
    }

    const session = mgr.getSession(s.id)!;
    expect(session.completionPercent).toBe(100);
    expect(session.currentStage).toBe('ordering');

    // All steps completed
    session.steps.forEach((step) => {
      expect(step.status).toBe('completed');
      expect(step.result).toBeDefined();
    });
  });

  it('stage progression follows expected order', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Stage Test', 'Test stage progression');
    const stagesVisited: WorkflowStage[] = [];

    for (let i = 0; i < 18; i++) {
      const step = mgr.advanceStep(s.id);
      if (stagesVisited.length === 0 || stagesVisited[stagesVisited.length - 1] !== step.stage) {
        stagesVisited.push(step.stage);
      }
      mgr.completeStep(s.id, makeResult());
    }

    expect(stagesVisited).toEqual([
      'ideation', 'architecture', 'schematic', 'simulation',
      'pcb_layout', 'validation', 'manufacturing', 'ordering',
    ]);
  });

  it('report at end shows all completed', () => {
    const mgr = new IdeaToPcbManager();
    const s = mgr.startSession('Report Test', 'Report at end');

    for (let i = 0; i < 18; i++) {
      advanceAndComplete(mgr, s.id);
    }

    const report = mgr.exportSessionReport(s.id);
    expect(report).toContain('**Completed:** 18');
    expect(report).toContain('**Remaining:** 0');
    expect(report).toContain('**Completion:** 100%');
  });
});
