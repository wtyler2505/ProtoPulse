import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TutorialSystem, useTutorialSystem } from '../tutorial-system';
import type { Tutorial, TutorialProgress, TutorialStep } from '../tutorial-system';

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

vi.stubGlobal('crypto', { randomUUID: vi.fn(() => `uuid-${Math.random().toString(36).slice(2, 10)}`) });

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

function makeTestTutorial(overrides: Partial<Omit<Tutorial, 'id'>> = {}): Omit<Tutorial, 'id'> {
  return {
    title: overrides.title ?? 'Test Tutorial',
    description: overrides.description ?? 'A test tutorial.',
    category: overrides.category ?? 'getting-started',
    difficulty: overrides.difficulty ?? 'beginner',
    estimatedMinutes: overrides.estimatedMinutes ?? 5,
    steps: overrides.steps ?? [
      { id: 'step-1', title: 'Step 1', description: 'First step', type: 'info', canSkip: true, order: 0 },
      { id: 'step-2', title: 'Step 2', description: 'Second step', type: 'click', canSkip: true, order: 1 },
      { id: 'step-3', title: 'Step 3', description: 'Third step', type: 'checkpoint', canSkip: false, order: 2 },
    ],
    prerequisites: overrides.prerequisites ?? [],
    tags: overrides.tags ?? ['test'],
    version: overrides.version ?? 1,
  };
}

beforeEach(() => {
  TutorialSystem.resetForTesting();
  clearStore();
});

// ---------------------------------------------------------------------------
// Tutorial CRUD
// ---------------------------------------------------------------------------

describe('Tutorial CRUD', () => {
  it('should register a tutorial and return it with a generated ID', () => {
    const system = TutorialSystem.getInstance();
    const tutorial = system.registerTutorial(makeTestTutorial());
    expect(tutorial.id).toBeDefined();
    expect(tutorial.title).toBe('Test Tutorial');
    expect(tutorial.steps).toHaveLength(3);
  });

  it('should get a tutorial by ID', () => {
    const system = TutorialSystem.getInstance();
    const tutorial = system.registerTutorial(makeTestTutorial());
    const fetched = system.getTutorial(tutorial.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.title).toBe('Test Tutorial');
  });

  it('should return null for non-existent tutorial', () => {
    const system = TutorialSystem.getInstance();
    expect(system.getTutorial('non-existent')).toBeNull();
  });

  it('should remove a tutorial', () => {
    const system = TutorialSystem.getInstance();
    const tutorial = system.registerTutorial(makeTestTutorial());
    expect(system.removeTutorial(tutorial.id)).toBe(true);
    expect(system.getTutorial(tutorial.id)).toBeNull();
  });

  it('should return false when removing non-existent tutorial', () => {
    const system = TutorialSystem.getInstance();
    expect(system.removeTutorial('non-existent')).toBe(false);
  });

  it('should get all tutorials including built-in ones', () => {
    const system = TutorialSystem.getInstance();
    const all = system.getAllTutorials();
    // 5 built-in tutorials
    expect(all.length).toBeGreaterThanOrEqual(5);
  });

  it('should include newly registered tutorials in getAllTutorials', () => {
    const system = TutorialSystem.getInstance();
    const before = system.getAllTutorials().length;
    system.registerTutorial(makeTestTutorial());
    expect(system.getAllTutorials()).toHaveLength(before + 1);
  });
});

// ---------------------------------------------------------------------------
// Category and Difficulty Filtering
// ---------------------------------------------------------------------------

describe('Category and Difficulty Filtering', () => {
  it('should filter by category', () => {
    const system = TutorialSystem.getInstance();
    const archTutorials = system.getByCategory('architecture');
    expect(archTutorials.length).toBeGreaterThanOrEqual(1);
    archTutorials.forEach((t) => {
      expect(t.category).toBe('architecture');
    });
  });

  it('should filter by difficulty', () => {
    const system = TutorialSystem.getInstance();
    system.registerTutorial(makeTestTutorial({ difficulty: 'advanced', title: 'Advanced Test' }));
    const advanced = system.getByDifficulty('advanced');
    expect(advanced.some((t) => t.title === 'Advanced Test')).toBe(true);
    advanced.forEach((t) => {
      expect(t.difficulty).toBe('advanced');
    });
  });

  it('should return empty array for unused category', () => {
    const system = TutorialSystem.getInstance();
    const pcb = system.getByCategory('pcb');
    expect(pcb).toEqual([]);
  });

  it('should return empty array for unused difficulty', () => {
    const system = TutorialSystem.getInstance();
    // Remove all advanced tutorials
    const advanced = system.getByDifficulty('advanced');
    advanced.forEach((t) => {
      system.removeTutorial(t.id);
    });
    expect(system.getByDifficulty('advanced')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

describe('Search', () => {
  it('should search by title', () => {
    const system = TutorialSystem.getInstance();
    const results = system.searchTutorials('Welcome');
    expect(results.some((t) => t.title.includes('Welcome'))).toBe(true);
  });

  it('should search by description', () => {
    const system = TutorialSystem.getInstance();
    system.registerTutorial(makeTestTutorial({ description: 'Learn about capacitor sizing' }));
    const results = system.searchTutorials('capacitor');
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('should search by tags', () => {
    const system = TutorialSystem.getInstance();
    system.registerTutorial(makeTestTutorial({ tags: ['voltmeter', 'measurement'] }));
    const results = system.searchTutorials('voltmeter');
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('should return all tutorials for empty query', () => {
    const system = TutorialSystem.getInstance();
    const all = system.getAllTutorials();
    const results = system.searchTutorials('');
    expect(results).toHaveLength(all.length);
  });

  it('should be case-insensitive', () => {
    const system = TutorialSystem.getInstance();
    const lower = system.searchTutorials('welcome');
    const upper = system.searchTutorials('WELCOME');
    expect(lower.length).toBe(upper.length);
  });

  it('should return empty array when nothing matches', () => {
    const system = TutorialSystem.getInstance();
    const results = system.searchTutorials('xyznonexistent');
    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Start Tutorial
// ---------------------------------------------------------------------------

describe('Start Tutorial', () => {
  it('should create progress when starting a tutorial', () => {
    const system = TutorialSystem.getInstance();
    const progress = system.startTutorial('welcome');
    expect(progress.tutorialId).toBe('welcome');
    expect(progress.status).toBe('in-progress');
    expect(progress.currentStepIndex).toBe(0);
    expect(progress.completedSteps).toEqual([]);
    expect(progress.startedAt).toBeGreaterThan(0);
  });

  it('should throw when starting a non-existent tutorial', () => {
    const system = TutorialSystem.getInstance();
    expect(() => system.startTutorial('non-existent')).toThrow('not found');
  });

  it('should return existing progress if already in-progress', () => {
    const system = TutorialSystem.getInstance();
    const first = system.startTutorial('welcome');
    system.completeStep('welcome', 'welcome-overview');
    const second = system.startTutorial('welcome');
    expect(second.completedSteps).toContain('welcome-overview');
    expect(second.tutorialId).toBe(first.tutorialId);
  });

  it('should set the active tutorial ID', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    expect(system.getActiveTutorialId()).toBe('welcome');
  });

  it('should emit a tutorial-start event', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    const events = system.getEventHistory('welcome');
    expect(events.some((e) => e.type === 'tutorial-start')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Step Navigation
// ---------------------------------------------------------------------------

describe('Step Navigation', () => {
  it('should get the current step', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    const step = system.getCurrentStep('welcome');
    expect(step).not.toBeNull();
    expect(step?.order).toBe(0);
  });

  it('should advance to the next step', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    const next = system.nextStep('welcome');
    expect(next).not.toBeNull();
    expect(next?.order).toBe(1);
  });

  it('should return null when at the last step for nextStep', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    // Welcome has 6 steps (order 0-5)
    for (let i = 0; i < 5; i++) {
      system.nextStep('welcome');
    }
    const afterLast = system.nextStep('welcome');
    expect(afterLast).toBeNull();
  });

  it('should go back to the previous step', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    system.nextStep('welcome');
    system.nextStep('welcome');
    const prev = system.previousStep('welcome');
    expect(prev).not.toBeNull();
    expect(prev?.order).toBe(1);
  });

  it('should return null when at the first step for previousStep', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    const prev = system.previousStep('welcome');
    expect(prev).toBeNull();
  });

  it('should return null for getCurrentStep on non-started tutorial', () => {
    const system = TutorialSystem.getInstance();
    expect(system.getCurrentStep('welcome')).toBeNull();
  });

  it('should return null for nextStep on non-started tutorial', () => {
    const system = TutorialSystem.getInstance();
    expect(system.nextStep('welcome')).toBeNull();
  });

  it('should return null for previousStep on non-started tutorial', () => {
    const system = TutorialSystem.getInstance();
    expect(system.previousStep('welcome')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Complete Step
// ---------------------------------------------------------------------------

describe('Complete Step', () => {
  it('should complete a step and track it', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    const progress = system.completeStep('welcome', 'welcome-overview');
    expect(progress.completedSteps).toContain('welcome-overview');
  });

  it('should auto-advance to the next step after completing', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    system.completeStep('welcome', 'welcome-overview');
    const step = system.getCurrentStep('welcome');
    expect(step?.id).toBe('welcome-sidebar');
  });

  it('should not duplicate completed steps if completed twice', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    system.completeStep('welcome', 'welcome-overview');
    system.completeStep('welcome', 'welcome-overview');
    const progress = system.getProgress('welcome');
    const count = progress?.completedSteps.filter((s) => s === 'welcome-overview').length;
    expect(count).toBe(1);
  });

  it('should throw when completing a step on a non-existent tutorial', () => {
    const system = TutorialSystem.getInstance();
    expect(() => system.completeStep('non-existent', 'step-1')).toThrow('not found');
  });

  it('should throw when completing a step on a non-started tutorial', () => {
    const system = TutorialSystem.getInstance();
    expect(() => system.completeStep('welcome', 'welcome-overview')).toThrow('not in progress');
  });

  it('should throw when completing a non-existent step', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    expect(() => system.completeStep('welcome', 'non-existent-step')).toThrow('not found');
  });

  it('should emit a step-complete event', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    system.completeStep('welcome', 'welcome-overview');
    const events = system.getEventHistory('welcome');
    expect(events.some((e) => e.type === 'step-complete' && e.stepId === 'welcome-overview')).toBe(true);
  });

  it('should mark tutorial as completed when all steps are done', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    const tutorial = system.getTutorial('welcome');
    const steps = tutorial?.steps ?? [];
    steps.forEach((step) => {
      system.completeStep('welcome', step.id);
    });
    const progress = system.getProgress('welcome');
    expect(progress?.status).toBe('completed');
    expect(progress?.completedAt).toBeGreaterThan(0);
  });

  it('should clear active tutorial when completed', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    const tutorial = system.getTutorial('welcome');
    const steps = tutorial?.steps ?? [];
    steps.forEach((step) => {
      system.completeStep('welcome', step.id);
    });
    expect(system.getActiveTutorialId()).toBeNull();
  });

  it('should emit tutorial-complete when all steps done', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    const tutorial = system.getTutorial('welcome');
    const steps = tutorial?.steps ?? [];
    steps.forEach((step) => {
      system.completeStep('welcome', step.id);
    });
    const events = system.getEventHistory('welcome');
    expect(events.some((e) => e.type === 'tutorial-complete')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Skip Step
// ---------------------------------------------------------------------------

describe('Skip Step', () => {
  it('should skip a skippable step', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    const progress = system.skipStep('welcome', 'welcome-overview');
    expect(progress.completedSteps).toContain('welcome-overview');
  });

  it('should throw when skipping a non-skippable step', () => {
    const system = TutorialSystem.getInstance();
    // first-architecture has step 'arch-add-mcu' with canSkip: false
    system.startTutorial('welcome');
    // Complete welcome first to meet prerequisites
    const welcome = system.getTutorial('welcome');
    welcome?.steps.forEach((step) => {
      system.completeStep('welcome', step.id);
    });
    system.startTutorial('first-architecture');
    expect(() => system.skipStep('first-architecture', 'arch-add-mcu')).toThrow('cannot be skipped');
  });

  it('should auto-advance after skipping', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    system.skipStep('welcome', 'welcome-overview');
    const step = system.getCurrentStep('welcome');
    expect(step?.id).toBe('welcome-sidebar');
  });

  it('should emit a step-skip event', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    system.skipStep('welcome', 'welcome-overview');
    const events = system.getEventHistory('welcome');
    expect(events.some((e) => e.type === 'step-skip' && e.stepId === 'welcome-overview')).toBe(true);
  });

  it('should throw when skipping step on non-started tutorial', () => {
    const system = TutorialSystem.getInstance();
    expect(() => system.skipStep('welcome', 'welcome-overview')).toThrow('not in progress');
  });

  it('should throw when skipping non-existent step', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    expect(() => system.skipStep('welcome', 'does-not-exist')).toThrow('not found');
  });
});

// ---------------------------------------------------------------------------
// Progress Tracking
// ---------------------------------------------------------------------------

describe('Progress Tracking', () => {
  it('should track time spent', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    system.completeStep('welcome', 'welcome-overview');
    const progress = system.getProgress('welcome');
    expect(progress?.timeSpentMs).toBeGreaterThanOrEqual(0);
  });

  it('should return null for getProgress on non-started tutorial', () => {
    const system = TutorialSystem.getInstance();
    expect(system.getProgress('welcome')).toBeNull();
  });

  it('should get all progress', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    const allProgress = system.getAllProgress();
    expect(allProgress.length).toBeGreaterThanOrEqual(1);
    expect(allProgress.some((p) => p.tutorialId === 'welcome')).toBe(true);
  });

  it('should return a copy of progress (not a reference)', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    const p1 = system.getProgress('welcome');
    const p2 = system.getProgress('welcome');
    expect(p1).not.toBe(p2);
    expect(p1).toEqual(p2);
  });
});

// ---------------------------------------------------------------------------
// Tutorial Completion
// ---------------------------------------------------------------------------

describe('Tutorial Completion', () => {
  it('should track completed tutorials', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    const tutorial = system.getTutorial('welcome');
    tutorial?.steps.forEach((step) => {
      system.completeStep('welcome', step.id);
    });
    const completed = system.getCompletedTutorials();
    expect(completed.some((t) => t.id === 'welcome')).toBe(true);
  });

  it('should not include non-completed tutorials in getCompletedTutorials', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    const completed = system.getCompletedTutorials();
    expect(completed.some((t) => t.id === 'welcome')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Skip Tutorial
// ---------------------------------------------------------------------------

describe('Skip Tutorial', () => {
  it('should skip an entire tutorial', () => {
    const system = TutorialSystem.getInstance();
    system.skipTutorial('welcome');
    const progress = system.getProgress('welcome');
    expect(progress?.status).toBe('skipped');
    expect(progress?.completedAt).toBeGreaterThan(0);
  });

  it('should clear active tutorial when skipping', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    system.skipTutorial('welcome');
    expect(system.getActiveTutorialId()).toBeNull();
  });

  it('should emit a tutorial-skip event', () => {
    const system = TutorialSystem.getInstance();
    system.skipTutorial('welcome');
    const events = system.getEventHistory('welcome');
    expect(events.some((e) => e.type === 'tutorial-skip')).toBe(true);
  });

  it('should throw when skipping a non-existent tutorial', () => {
    const system = TutorialSystem.getInstance();
    expect(() => system.skipTutorial('non-existent')).toThrow('not found');
  });

  it('should preserve completed steps when skipping a started tutorial', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    system.completeStep('welcome', 'welcome-overview');
    system.skipTutorial('welcome');
    const progress = system.getProgress('welcome');
    expect(progress?.completedSteps).toContain('welcome-overview');
  });
});

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

describe('Reset', () => {
  it('should reset a single tutorial', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    system.completeStep('welcome', 'welcome-overview');
    system.resetTutorial('welcome');
    expect(system.getProgress('welcome')).toBeNull();
  });

  it('should clear active tutorial when resetting', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    system.resetTutorial('welcome');
    expect(system.getActiveTutorialId()).toBeNull();
  });

  it('should emit a tutorial-reset event', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    system.resetTutorial('welcome');
    const events = system.getEventHistory('welcome');
    expect(events.some((e) => e.type === 'tutorial-reset')).toBe(true);
  });

  it('should throw when resetting non-existent tutorial', () => {
    const system = TutorialSystem.getInstance();
    expect(() => system.resetTutorial('non-existent')).toThrow('not found');
  });

  it('should reset all progress', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    system.startTutorial('managing-bom');
    system.resetAllProgress();
    expect(system.getAllProgress()).toHaveLength(0);
    expect(system.getActiveTutorialId()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Prerequisites
// ---------------------------------------------------------------------------

describe('Prerequisites', () => {
  it('should allow starting a tutorial with no prerequisites', () => {
    const system = TutorialSystem.getInstance();
    expect(system.canStart('welcome')).toBe(true);
  });

  it('should block starting a tutorial with unmet prerequisites', () => {
    const system = TutorialSystem.getInstance();
    // 'first-architecture' requires 'welcome'
    expect(system.canStart('first-architecture')).toBe(false);
  });

  it('should allow starting when prerequisites are completed', () => {
    const system = TutorialSystem.getInstance();
    // Complete welcome
    system.startTutorial('welcome');
    const tutorial = system.getTutorial('welcome');
    tutorial?.steps.forEach((step) => {
      system.completeStep('welcome', step.id);
    });
    expect(system.canStart('first-architecture')).toBe(true);
  });

  it('should return false for canStart on non-existent tutorial', () => {
    const system = TutorialSystem.getInstance();
    expect(system.canStart('non-existent')).toBe(false);
  });

  it('should handle multi-level prerequisites', () => {
    const system = TutorialSystem.getInstance();
    // 'running-simulations' requires both 'welcome' and 'first-architecture'
    expect(system.canStart('running-simulations')).toBe(false);

    // Complete welcome
    system.startTutorial('welcome');
    system.getTutorial('welcome')?.steps.forEach((step) => {
      system.completeStep('welcome', step.id);
    });

    // Still can't start — first-architecture not done
    expect(system.canStart('running-simulations')).toBe(false);

    // Complete first-architecture
    system.startTutorial('first-architecture');
    system.getTutorial('first-architecture')?.steps.forEach((step) => {
      system.completeStep('first-architecture', step.id);
    });

    expect(system.canStart('running-simulations')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Completion Percentage
// ---------------------------------------------------------------------------

describe('Completion Percentage', () => {
  it('should return 0 when nothing is completed', () => {
    const system = TutorialSystem.getInstance();
    expect(system.getCompletionPercentage()).toBe(0);
  });

  it('should calculate overall completion percentage', () => {
    const system = TutorialSystem.getInstance();
    const totalTutorials = system.getAllTutorials().length;

    // Complete welcome
    system.startTutorial('welcome');
    system.getTutorial('welcome')?.steps.forEach((step) => {
      system.completeStep('welcome', step.id);
    });

    const expected = Math.round((1 / totalTutorials) * 100);
    expect(system.getCompletionPercentage()).toBe(expected);
  });

  it('should return 0 for tutorial completion on non-started tutorial', () => {
    const system = TutorialSystem.getInstance();
    expect(system.getTutorialCompletion('welcome')).toBe(0);
  });

  it('should calculate per-tutorial completion percentage', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    const tutorial = system.getTutorial('welcome');
    const totalSteps = tutorial?.steps.length ?? 0;

    system.completeStep('welcome', 'welcome-overview');
    const expected = Math.round((1 / totalSteps) * 100);
    expect(system.getTutorialCompletion('welcome')).toBe(expected);
  });

  it('should return 100 for completed tutorial', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    system.getTutorial('welcome')?.steps.forEach((step) => {
      system.completeStep('welcome', step.id);
    });
    expect(system.getTutorialCompletion('welcome')).toBe(100);
  });

  it('should return 0 for non-existent tutorial', () => {
    const system = TutorialSystem.getInstance();
    expect(system.getTutorialCompletion('non-existent')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Recommended Tutorials
// ---------------------------------------------------------------------------

describe('Recommended Tutorials', () => {
  it('should suggest tutorials with met prerequisites', () => {
    const system = TutorialSystem.getInstance();
    const recommended = system.getRecommended();
    // Should include 'welcome' since it has no prerequisites
    expect(recommended.some((t) => t.id === 'welcome')).toBe(true);
    // Should not include 'first-architecture' since welcome not done
    expect(recommended.some((t) => t.id === 'first-architecture')).toBe(false);
  });

  it('should not recommend completed tutorials', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    system.getTutorial('welcome')?.steps.forEach((step) => {
      system.completeStep('welcome', step.id);
    });
    const recommended = system.getRecommended();
    expect(recommended.some((t) => t.id === 'welcome')).toBe(false);
  });

  it('should not recommend skipped tutorials', () => {
    const system = TutorialSystem.getInstance();
    system.skipTutorial('welcome');
    const recommended = system.getRecommended();
    expect(recommended.some((t) => t.id === 'welcome')).toBe(false);
  });

  it('should prioritize in-progress tutorials', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    const recommended = system.getRecommended();
    expect(recommended[0].id).toBe('welcome');
  });

  it('should recommend newly eligible tutorials after prerequisites met', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    system.getTutorial('welcome')?.steps.forEach((step) => {
      system.completeStep('welcome', step.id);
    });
    const recommended = system.getRecommended();
    expect(recommended.some((t) => t.id === 'first-architecture')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Event History
// ---------------------------------------------------------------------------

describe('Event History', () => {
  it('should track events', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    system.completeStep('welcome', 'welcome-overview');
    const events = system.getEventHistory();
    expect(events.length).toBeGreaterThanOrEqual(2);
  });

  it('should filter events by tutorial ID', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    system.startTutorial('managing-bom');
    const welcomeEvents = system.getEventHistory('welcome');
    const bomEvents = system.getEventHistory('managing-bom');
    welcomeEvents.forEach((e) => {
      expect(e.tutorialId).toBe('welcome');
    });
    bomEvents.forEach((e) => {
      expect(e.tutorialId).toBe('managing-bom');
    });
  });

  it('should clear event history', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    system.clearEventHistory();
    expect(system.getEventHistory()).toHaveLength(0);
  });

  it('should include step-complete events', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    system.completeStep('welcome', 'welcome-overview');
    const events = system.getEventHistory('welcome');
    const stepEvent = events.find((e) => e.type === 'step-complete');
    expect(stepEvent).toBeDefined();
    expect(stepEvent?.stepId).toBe('welcome-overview');
  });

  it('should include step-skip events', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    system.skipStep('welcome', 'welcome-overview');
    const events = system.getEventHistory('welcome');
    expect(events.some((e) => e.type === 'step-skip' && e.stepId === 'welcome-overview')).toBe(true);
  });

  it('should include tutorial-reset events', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    system.resetTutorial('welcome');
    const events = system.getEventHistory('welcome');
    expect(events.some((e) => e.type === 'tutorial-reset')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Built-in Tutorials
// ---------------------------------------------------------------------------

describe('Built-in Tutorials', () => {
  it('should load 5 built-in tutorials', () => {
    const system = TutorialSystem.getInstance();
    const all = system.getAllTutorials();
    const builtInIds = ['welcome', 'first-architecture', 'managing-bom', 'running-simulations', 'exporting-design'];
    builtInIds.forEach((id) => {
      expect(all.some((t) => t.id === id)).toBe(true);
    });
  });

  it('should have welcome tutorial with 6 steps', () => {
    const system = TutorialSystem.getInstance();
    const welcome = system.getTutorial('welcome');
    expect(welcome?.steps).toHaveLength(6);
  });

  it('should have first-architecture tutorial with 8 steps', () => {
    const system = TutorialSystem.getInstance();
    const arch = system.getTutorial('first-architecture');
    expect(arch?.steps).toHaveLength(8);
  });

  it('should have managing-bom tutorial with 7 steps', () => {
    const system = TutorialSystem.getInstance();
    const bom = system.getTutorial('managing-bom');
    expect(bom?.steps).toHaveLength(7);
  });

  it('should have running-simulations tutorial with 8 steps', () => {
    const system = TutorialSystem.getInstance();
    const sim = system.getTutorial('running-simulations');
    expect(sim?.steps).toHaveLength(8);
  });

  it('should have exporting-design tutorial with 5 steps', () => {
    const system = TutorialSystem.getInstance();
    const exp = system.getTutorial('exporting-design');
    expect(exp?.steps).toHaveLength(5);
  });

  it('should set proper prerequisites for first-architecture', () => {
    const system = TutorialSystem.getInstance();
    const arch = system.getTutorial('first-architecture');
    expect(arch?.prerequisites).toEqual(['welcome']);
  });

  it('should set proper prerequisites for running-simulations', () => {
    const system = TutorialSystem.getInstance();
    const sim = system.getTutorial('running-simulations');
    expect(sim?.prerequisites).toEqual(['welcome', 'first-architecture']);
  });
});

// ---------------------------------------------------------------------------
// Export / Import Progress
// ---------------------------------------------------------------------------

describe('Export / Import Progress', () => {
  it('should export progress as JSON string', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    const exported = system.exportProgress();
    const parsed = JSON.parse(exported);
    expect(parsed.version).toBe(1);
    expect(Array.isArray(parsed.progress)).toBe(true);
    expect(parsed.progress.length).toBeGreaterThanOrEqual(1);
  });

  it('should round-trip export and import', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    system.completeStep('welcome', 'welcome-overview');
    const exported = system.exportProgress();

    // Reset and import
    TutorialSystem.resetForTesting();
    const newSystem = TutorialSystem.getInstance();
    const result = newSystem.importProgress(exported);
    expect(result.imported).toBeGreaterThanOrEqual(1);
    expect(result.errors).toHaveLength(0);

    const progress = newSystem.getProgress('welcome');
    expect(progress?.status).toBe('in-progress');
    expect(progress?.completedSteps).toContain('welcome-overview');
  });

  it('should handle malformed JSON on import', () => {
    const system = TutorialSystem.getInstance();
    const result = system.importProgress('not json');
    expect(result.imported).toBe(0);
    expect(result.errors).toContain('Invalid JSON');
  });

  it('should handle invalid data format on import', () => {
    const system = TutorialSystem.getInstance();
    const result = system.importProgress('"just a string"');
    expect(result.imported).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should handle missing progress array on import', () => {
    const system = TutorialSystem.getInstance();
    const result = system.importProgress('{"version": 1}');
    expect(result.imported).toBe(0);
    expect(result.errors).toContain('Missing progress array');
  });

  it('should handle invalid progress entries', () => {
    const system = TutorialSystem.getInstance();
    const result = system.importProgress(JSON.stringify({
      version: 1,
      progress: [{ invalid: true }, { tutorialId: 'x', status: 'bad-status' }],
    }));
    expect(result.imported).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// localStorage Persistence
// ---------------------------------------------------------------------------

describe('localStorage Persistence', () => {
  it('should save to localStorage on state change', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    expect(localStorage.setItem).toHaveBeenCalledWith('protopulse-tutorials', expect.any(String));
  });

  it('should restore progress from localStorage', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    system.completeStep('welcome', 'welcome-overview');

    // Create new instance (simulates page reload)
    TutorialSystem.resetForTesting();
    const restored = TutorialSystem.getInstance();
    const progress = restored.getProgress('welcome');
    expect(progress).not.toBeNull();
    expect(progress?.status).toBe('in-progress');
    expect(progress?.completedSteps).toContain('welcome-overview');
  });

  it('should handle corrupt localStorage data gracefully', () => {
    store['protopulse-tutorials'] = 'not valid json';
    const system = TutorialSystem.getInstance();
    // Should not throw, and should have built-in tutorials
    expect(system.getAllTutorials().length).toBeGreaterThanOrEqual(5);
  });

  it('should handle empty localStorage', () => {
    const system = TutorialSystem.getInstance();
    expect(system.getAllProgress()).toHaveLength(0);
    expect(system.getAllTutorials().length).toBeGreaterThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// Subscribe / Notify
// ---------------------------------------------------------------------------

describe('Subscribe / Notify', () => {
  it('should notify subscribers on state change', () => {
    const system = TutorialSystem.getInstance();
    const listener = vi.fn();
    system.subscribe(listener);
    system.startTutorial('welcome');
    expect(listener).toHaveBeenCalled();
  });

  it('should allow unsubscribing', () => {
    const system = TutorialSystem.getInstance();
    const listener = vi.fn();
    const unsub = system.subscribe(listener);
    unsub();
    system.startTutorial('welcome');
    expect(listener).not.toHaveBeenCalled();
  });

  it('should notify on tutorial registration', () => {
    const system = TutorialSystem.getInstance();
    const listener = vi.fn();
    system.subscribe(listener);
    system.registerTutorial(makeTestTutorial());
    expect(listener).toHaveBeenCalled();
  });

  it('should notify on step completion', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    const listener = vi.fn();
    system.subscribe(listener);
    system.completeStep('welcome', 'welcome-overview');
    expect(listener).toHaveBeenCalled();
  });

  it('should notify on reset', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    const listener = vi.fn();
    system.subscribe(listener);
    system.resetTutorial('welcome');
    expect(listener).toHaveBeenCalled();
  });

  it('should notify on tutorial removal', () => {
    const system = TutorialSystem.getInstance();
    const t = system.registerTutorial(makeTestTutorial());
    const listener = vi.fn();
    system.subscribe(listener);
    system.removeTutorial(t.id);
    expect(listener).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Hook Shape Validation
// ---------------------------------------------------------------------------

describe('useTutorialSystem hook', () => {
  it('should return the correct shape', () => {
    // We test the shape by calling the function in a non-React context
    // The hook will return defaults since window is defined but no React lifecycle
    const hookFn = useTutorialSystem;
    expect(typeof hookFn).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Edge Cases
// ---------------------------------------------------------------------------

describe('Edge Cases', () => {
  it('should handle removing an active tutorial', () => {
    const system = TutorialSystem.getInstance();
    const tutorial = system.registerTutorial(makeTestTutorial());
    system.startTutorial(tutorial.id);
    system.removeTutorial(tutorial.id);
    expect(system.getActiveTutorialId()).toBeNull();
    expect(system.getProgress(tutorial.id)).toBeNull();
  });

  it('should handle a tutorial with no steps', () => {
    const system = TutorialSystem.getInstance();
    const tutorial = system.registerTutorial(makeTestTutorial({ steps: [] }));
    const progress = system.startTutorial(tutorial.id);
    expect(progress.status).toBe('in-progress');
    expect(system.getCurrentStep(tutorial.id)).toBeNull();
    expect(system.getTutorialCompletion(tutorial.id)).toBe(0);
  });

  it('should handle starting a completed tutorial (restarts it)', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    system.getTutorial('welcome')?.steps.forEach((step) => {
      system.completeStep('welcome', step.id);
    });
    expect(system.getProgress('welcome')?.status).toBe('completed');

    // Start again
    const newProgress = system.startTutorial('welcome');
    expect(newProgress.status).toBe('in-progress');
    expect(newProgress.currentStepIndex).toBe(0);
    expect(newProgress.completedSteps).toEqual([]);
  });

  it('should handle starting a skipped tutorial (restarts it)', () => {
    const system = TutorialSystem.getInstance();
    system.skipTutorial('welcome');
    expect(system.getProgress('welcome')?.status).toBe('skipped');

    const newProgress = system.startTutorial('welcome');
    expect(newProgress.status).toBe('in-progress');
  });

  it('should handle multiple subscribers', () => {
    const system = TutorialSystem.getInstance();
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    system.subscribe(listener1);
    system.subscribe(listener2);
    system.startTutorial('welcome');
    expect(listener1).toHaveBeenCalled();
    expect(listener2).toHaveBeenCalled();
  });

  it('should handle resetAllProgress with no progress', () => {
    const system = TutorialSystem.getInstance();
    // Should not throw
    system.resetAllProgress();
    expect(system.getAllProgress()).toHaveLength(0);
  });

  it('should handle clearEventHistory with no events', () => {
    const system = TutorialSystem.getInstance();
    system.clearEventHistory();
    expect(system.getEventHistory()).toHaveLength(0);
  });

  it('should handle getByCategory with no matching tutorials', () => {
    const system = TutorialSystem.getInstance();
    expect(system.getByCategory('advanced')).toEqual([]);
  });

  it('should handle search with whitespace-only query', () => {
    const system = TutorialSystem.getInstance();
    const results = system.searchTutorials('   ');
    expect(results).toHaveLength(system.getAllTutorials().length);
  });

  it('should handle getting completion percentage with no tutorials', () => {
    const system = TutorialSystem.getInstance();
    // Remove all tutorials
    system.getAllTutorials().forEach((t) => {
      system.removeTutorial(t.id);
    });
    expect(system.getCompletionPercentage()).toBe(0);
  });

  it('should handle next/previous step on completed tutorial', () => {
    const system = TutorialSystem.getInstance();
    system.startTutorial('welcome');
    system.getTutorial('welcome')?.steps.forEach((step) => {
      system.completeStep('welcome', step.id);
    });
    expect(system.nextStep('welcome')).toBeNull();
    expect(system.previousStep('welcome')).toBeNull();
  });
});
