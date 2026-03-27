import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LearningPathManager, LEARNING_STEPS } from '../learning-path';

// Mock localStorage
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  LearningPathManager.resetInstance();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (_i: number) => null,
  });
});

describe('LearningPathManager', () => {
  it('starts with 0% progress and beginner skill level', () => {
    const mgr = LearningPathManager.getInstance();
    const progress = mgr.getProgress();
    expect(progress.overallPercent).toBe(0);
    expect(progress.skillLevel).toBe('beginner');
    expect(progress.currentPhase).toBe('welcome');
    expect(progress.completedSteps.size).toBe(0);
  });

  it('returns the first step as the next step initially', () => {
    const mgr = LearningPathManager.getInstance();
    const progress = mgr.getProgress();
    expect(progress.nextStep).not.toBeNull();
    expect(progress.nextStep?.id).toBe('explore-workspace');
  });

  it('completes a step with no prerequisites', () => {
    const mgr = LearningPathManager.getInstance();
    mgr.completeStep('explore-workspace');
    const progress = mgr.getProgress();
    expect(progress.completedSteps.has('explore-workspace')).toBe(true);
    expect(progress.overallPercent).toBeGreaterThan(0);
  });

  it('blocks a step whose prerequisites are not met', () => {
    const mgr = LearningPathManager.getInstance();
    // 'architecture-basics' requires 'explore-workspace'
    mgr.completeStep('architecture-basics');
    const progress = mgr.getProgress();
    expect(progress.completedSteps.has('architecture-basics')).toBe(false);
  });

  it('allows a step after prerequisites are completed', () => {
    const mgr = LearningPathManager.getInstance();
    mgr.completeStep('explore-workspace');
    mgr.completeStep('architecture-basics');
    const progress = mgr.getProgress();
    expect(progress.completedSteps.has('architecture-basics')).toBe(true);
  });

  it('advances the current phase when all steps in a phase complete', () => {
    const mgr = LearningPathManager.getInstance();
    mgr.completeStep('explore-workspace');
    mgr.completeStep('meet-the-ai');
    const progress = mgr.getProgress();
    // Welcome phase is now complete, should advance to architecture
    expect(progress.phaseProgress.welcome.completed).toBe(2);
    expect(progress.phaseProgress.welcome.total).toBe(2);
    expect(progress.currentPhase).toBe('architecture');
  });

  it('correctly computes phase progress', () => {
    const mgr = LearningPathManager.getInstance();
    const progress = mgr.getProgress();
    const welcomeSteps = LEARNING_STEPS.filter(s => s.phase === 'welcome').length;
    expect(progress.phaseProgress.welcome.total).toBe(welcomeSteps);
    expect(progress.phaseProgress.welcome.completed).toBe(0);
  });

  it('upgrades skill level based on completion percentage', () => {
    const mgr = LearningPathManager.getInstance();
    // Complete enough steps to cross 35% threshold
    const totalSteps = LEARNING_STEPS.length;
    const threshold35 = Math.ceil(totalSteps * 0.35);

    // Complete steps in prerequisite order
    const stepsInOrder = getStepsInPrereqOrder();
    for (let i = 0; i < threshold35 && i < stepsInOrder.length; i++) {
      mgr.completeStep(stepsInOrder[i]);
    }

    const progress = mgr.getProgress();
    expect(progress.skillLevel).toBe('intermediate');
  });

  it('persists progress to localStorage', () => {
    const mgr = LearningPathManager.getInstance();
    mgr.completeStep('explore-workspace');

    // Reset singleton and create a new instance — should reload from storage
    LearningPathManager.resetInstance();
    const mgr2 = LearningPathManager.getInstance();
    expect(mgr2.isStepCompleted('explore-workspace')).toBe(true);
  });

  it('resets all progress', () => {
    const mgr = LearningPathManager.getInstance();
    mgr.completeStep('explore-workspace');
    expect(mgr.isStepCompleted('explore-workspace')).toBe(true);

    mgr.resetProgress();
    expect(mgr.isStepCompleted('explore-workspace')).toBe(false);
    expect(mgr.getProgress().overallPercent).toBe(0);
  });

  it('notifies subscribers on step completion', () => {
    const mgr = LearningPathManager.getInstance();
    const listener = vi.fn();
    mgr.subscribe(listener);

    mgr.completeStep('explore-workspace');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes cleanly', () => {
    const mgr = LearningPathManager.getInstance();
    const listener = vi.fn();
    const unsub = mgr.subscribe(listener);

    unsub();
    mgr.completeStep('explore-workspace');
    expect(listener).not.toHaveBeenCalled();
  });

  it('ignores duplicate completions', () => {
    const mgr = LearningPathManager.getInstance();
    const listener = vi.fn();
    mgr.subscribe(listener);

    mgr.completeStep('explore-workspace');
    mgr.completeStep('explore-workspace');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('ignores unknown step IDs', () => {
    const mgr = LearningPathManager.getInstance();
    mgr.completeStep('nonexistent-step');
    expect(mgr.getProgress().completedSteps.size).toBe(0);
  });

  it('isStepAvailable checks prerequisites', () => {
    const mgr = LearningPathManager.getInstance();
    expect(mgr.isStepAvailable('explore-workspace')).toBe(true);
    expect(mgr.isStepAvailable('architecture-basics')).toBe(false);

    mgr.completeStep('explore-workspace');
    expect(mgr.isStepAvailable('architecture-basics')).toBe(true);
  });

  it('getStepsForPhase returns all steps in a phase', () => {
    const mgr = LearningPathManager.getInstance();
    const welcomeSteps = mgr.getStepsForPhase('welcome');
    expect(welcomeSteps.length).toBe(2);
    expect(welcomeSteps.every(s => s.phase === 'welcome')).toBe(true);
  });

  it('reports complete phase when all steps are done', () => {
    const mgr = LearningPathManager.getInstance();
    const stepsInOrder = getStepsInPrereqOrder();
    for (const stepId of stepsInOrder) {
      mgr.completeStep(stepId);
    }

    const progress = mgr.getProgress();
    expect(progress.currentPhase).toBe('complete');
    expect(progress.overallPercent).toBe(100);
    expect(progress.nextStep).toBeNull();
  });
});

// Helper: topological sort of steps by prerequisites
function getStepsInPrereqOrder(): string[] {
  const completed = new Set<string>();
  const result: string[] = [];
  let changed = true;

  while (changed) {
    changed = false;
    for (const step of LEARNING_STEPS) {
      if (completed.has(step.id)) continue;
      if (step.prerequisites.every(p => completed.has(p))) {
        completed.add(step.id);
        result.push(step.id);
        changed = true;
      }
    }
  }

  return result;
}
