import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PCB_TUTORIAL_STEPS,
  PCB_TUTORIAL_ID,
  PCB_TUTORIAL_TITLE,
  PCB_TUTORIAL_DESCRIPTION,
  PCB_TUTORIAL_ESTIMATED_MINUTES,
  createInitialState,
  pcbTutorialReducer,
  getCurrentStep,
  getCompletedCount,
  getProgressCount,
  getProgressPercent,
  isTutorialComplete,
  getStepStatus,
  buildValidationContext,
  loadPcbTutorialState,
  savePcbTutorialState,
  clearPcbTutorialState,
} from '../pcb-tutorial';
import type { PcbTutorialState, PcbValidationContext } from '../pcb-tutorial';

// ---------------------------------------------------------------------------
// Mock localStorage
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
  clearStore();
});

// ---------------------------------------------------------------------------
// Helper to build a PcbValidationContext with defaults
// ---------------------------------------------------------------------------

function ctx(overrides: Partial<PcbValidationContext> = {}): PcbValidationContext {
  return buildValidationContext(overrides);
}

// ---------------------------------------------------------------------------
// Constants & Step Definitions
// ---------------------------------------------------------------------------

describe('PCB Tutorial constants', () => {
  it('has the expected tutorial ID', () => {
    expect(PCB_TUTORIAL_ID).toBe('first-pcb');
  });

  it('has a non-empty title and description', () => {
    expect(PCB_TUTORIAL_TITLE).toBeTruthy();
    expect(PCB_TUTORIAL_DESCRIPTION).toBeTruthy();
    expect(PCB_TUTORIAL_DESCRIPTION.length).toBeGreaterThan(20);
  });

  it('has a reasonable estimated time', () => {
    expect(PCB_TUTORIAL_ESTIMATED_MINUTES).toBeGreaterThanOrEqual(5);
    expect(PCB_TUTORIAL_ESTIMATED_MINUTES).toBeLessThanOrEqual(60);
  });
});

describe('PCB Tutorial steps', () => {
  it('has exactly 10 steps', () => {
    expect(PCB_TUTORIAL_STEPS).toHaveLength(10);
  });

  it('steps are numbered 1 through 10', () => {
    const numbers = PCB_TUTORIAL_STEPS.map((s) => s.stepNumber);
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('all steps have unique IDs', () => {
    const ids = PCB_TUTORIAL_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all step IDs start with "pcb-"', () => {
    for (const step of PCB_TUTORIAL_STEPS) {
      expect(step.id).toMatch(/^pcb-/);
    }
  });

  it('all steps have non-empty instruction and summary', () => {
    for (const step of PCB_TUTORIAL_STEPS) {
      expect(step.instruction.length).toBeGreaterThan(10);
      expect(step.summary.length).toBeGreaterThan(0);
      expect(step.title.length).toBeGreaterThan(0);
    }
  });

  it('all steps have a validationFn that is a function', () => {
    for (const step of PCB_TUTORIAL_STEPS) {
      expect(typeof step.validationFn).toBe('function');
    }
  });

  it('all steps have at least one tip', () => {
    for (const step of PCB_TUTORIAL_STEPS) {
      expect(step.tips.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('all steps have a valid targetView', () => {
    const validViews = ['schematic', 'pcb', 'validation', 'output'];
    for (const step of PCB_TUTORIAL_STEPS) {
      expect(validViews).toContain(step.targetView);
    }
  });

  it('step 6 (switch to PCB) always passes validation', () => {
    const step6 = PCB_TUTORIAL_STEPS[5];
    expect(step6.id).toBe('pcb-switch-to-layout');
    expect(step6.validationFn(ctx())).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Validation Functions
// ---------------------------------------------------------------------------

describe('Step validation functions', () => {
  it('step 1: requires circuitDesignCount > 0', () => {
    const step = PCB_TUTORIAL_STEPS[0];
    expect(step.validationFn(ctx())).toBe(false);
    expect(step.validationFn(ctx({ circuitDesignCount: 1 }))).toBe(true);
  });

  it('step 2: requires schematicInstanceCount >= 2', () => {
    const step = PCB_TUTORIAL_STEPS[1];
    expect(step.validationFn(ctx({ schematicInstanceCount: 1 }))).toBe(false);
    expect(step.validationFn(ctx({ schematicInstanceCount: 2 }))).toBe(true);
    expect(step.validationFn(ctx({ schematicInstanceCount: 5 }))).toBe(true);
  });

  it('step 3: requires wireCount >= 1', () => {
    const step = PCB_TUTORIAL_STEPS[2];
    expect(step.validationFn(ctx())).toBe(false);
    expect(step.validationFn(ctx({ wireCount: 1 }))).toBe(true);
  });

  it('step 4: requires netCount >= 1', () => {
    const step = PCB_TUTORIAL_STEPS[3];
    expect(step.validationFn(ctx())).toBe(false);
    expect(step.validationFn(ctx({ netCount: 2 }))).toBe(true);
  });

  it('step 5: requires footprintAssignedCount >= 1', () => {
    const step = PCB_TUTORIAL_STEPS[4];
    expect(step.validationFn(ctx())).toBe(false);
    expect(step.validationFn(ctx({ footprintAssignedCount: 1 }))).toBe(true);
  });

  it('step 7: requires pcbPlacedCount >= 1', () => {
    const step = PCB_TUTORIAL_STEPS[6];
    expect(step.validationFn(ctx())).toBe(false);
    expect(step.validationFn(ctx({ pcbPlacedCount: 1 }))).toBe(true);
  });

  it('step 8: requires routedTraceCount >= 1', () => {
    const step = PCB_TUTORIAL_STEPS[7];
    expect(step.validationFn(ctx())).toBe(false);
    expect(step.validationFn(ctx({ routedTraceCount: 3 }))).toBe(true);
  });

  it('step 9: requires drcHasRun and drcViolationCount === 0', () => {
    const step = PCB_TUTORIAL_STEPS[8];
    expect(step.validationFn(ctx())).toBe(false);
    expect(step.validationFn(ctx({ drcHasRun: true, drcViolationCount: 3 }))).toBe(false);
    expect(step.validationFn(ctx({ drcHasRun: true, drcViolationCount: 0 }))).toBe(true);
  });

  it('step 10: requires gerberExported', () => {
    const step = PCB_TUTORIAL_STEPS[9];
    expect(step.validationFn(ctx())).toBe(false);
    expect(step.validationFn(ctx({ gerberExported: true }))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Initial State
// ---------------------------------------------------------------------------

describe('createInitialState', () => {
  it('creates state with step 1 active and rest locked', () => {
    const state = createInitialState();
    expect(state.currentStepIndex).toBe(0);
    expect(state.isActive).toBe(false);
    expect(state.startedAt).toBeNull();
    expect(state.completedAt).toBeNull();
    expect(state.stepStatuses[PCB_TUTORIAL_STEPS[0].id]).toBe('active');
    for (let i = 1; i < PCB_TUTORIAL_STEPS.length; i++) {
      expect(state.stepStatuses[PCB_TUTORIAL_STEPS[i].id]).toBe('locked');
    }
  });
});

// ---------------------------------------------------------------------------
// Reducer — START
// ---------------------------------------------------------------------------

describe('pcbTutorialReducer — START', () => {
  it('activates the tutorial and sets startedAt', () => {
    const state = createInitialState();
    const next = pcbTutorialReducer(state, { type: 'START' });
    expect(next.isActive).toBe(true);
    expect(next.startedAt).toBeGreaterThan(0);
    expect(next.currentStepIndex).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Reducer — COMPLETE_STEP
// ---------------------------------------------------------------------------

describe('pcbTutorialReducer — COMPLETE_STEP', () => {
  it('marks step as completed and unlocks next', () => {
    let state = pcbTutorialReducer(createInitialState(), { type: 'START' });
    state = pcbTutorialReducer(state, { type: 'COMPLETE_STEP', stepId: 'pcb-create-circuit' });

    expect(state.stepStatuses['pcb-create-circuit']).toBe('completed');
    expect(state.stepStatuses['pcb-add-components']).toBe('active');
    expect(state.currentStepIndex).toBe(1);
  });

  it('does nothing for unknown step ID', () => {
    const state = pcbTutorialReducer(createInitialState(), { type: 'START' });
    const next = pcbTutorialReducer(state, { type: 'COMPLETE_STEP', stepId: 'nonexistent' });
    expect(next).toBe(state);
  });

  it('completes tutorial when last step is completed', () => {
    let state = pcbTutorialReducer(createInitialState(), { type: 'START' });
    // Complete all steps
    for (const step of PCB_TUTORIAL_STEPS) {
      state = pcbTutorialReducer(state, { type: 'COMPLETE_STEP', stepId: step.id });
    }
    expect(state.isActive).toBe(false);
    expect(state.completedAt).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Reducer — SKIP_STEP
// ---------------------------------------------------------------------------

describe('pcbTutorialReducer — SKIP_STEP', () => {
  it('skips a skippable step and unlocks next', () => {
    let state = pcbTutorialReducer(createInitialState(), { type: 'START' });
    // Complete steps 1-3 to get to step 4 (which canSkip)
    state = pcbTutorialReducer(state, { type: 'COMPLETE_STEP', stepId: 'pcb-create-circuit' });
    state = pcbTutorialReducer(state, { type: 'COMPLETE_STEP', stepId: 'pcb-add-components' });
    state = pcbTutorialReducer(state, { type: 'COMPLETE_STEP', stepId: 'pcb-wire-schematic' });

    // Step 4 (pcb-assign-nets) is skippable
    state = pcbTutorialReducer(state, { type: 'SKIP_STEP', stepId: 'pcb-assign-nets' });
    expect(state.stepStatuses['pcb-assign-nets']).toBe('skipped');
    expect(state.stepStatuses['pcb-assign-footprints']).toBe('active');
  });

  it('refuses to skip a non-skippable step', () => {
    let state = pcbTutorialReducer(createInitialState(), { type: 'START' });
    // Step 1 (pcb-create-circuit) is NOT skippable
    const next = pcbTutorialReducer(state, { type: 'SKIP_STEP', stepId: 'pcb-create-circuit' });
    expect(next).toBe(state);
  });
});

// ---------------------------------------------------------------------------
// Reducer — GO_TO_STEP
// ---------------------------------------------------------------------------

describe('pcbTutorialReducer — GO_TO_STEP', () => {
  it('navigates to a completed step', () => {
    let state = pcbTutorialReducer(createInitialState(), { type: 'START' });
    state = pcbTutorialReducer(state, { type: 'COMPLETE_STEP', stepId: 'pcb-create-circuit' });
    state = pcbTutorialReducer(state, { type: 'COMPLETE_STEP', stepId: 'pcb-add-components' });

    // Go back to step 0
    state = pcbTutorialReducer(state, { type: 'GO_TO_STEP', stepIndex: 0 });
    expect(state.currentStepIndex).toBe(0);
  });

  it('refuses to navigate to a locked step', () => {
    const state = pcbTutorialReducer(createInitialState(), { type: 'START' });
    const next = pcbTutorialReducer(state, { type: 'GO_TO_STEP', stepIndex: 5 });
    expect(next.currentStepIndex).toBe(0); // Unchanged
  });

  it('refuses to navigate to out-of-range index', () => {
    const state = pcbTutorialReducer(createInitialState(), { type: 'START' });
    expect(pcbTutorialReducer(state, { type: 'GO_TO_STEP', stepIndex: -1 })).toBe(state);
    expect(pcbTutorialReducer(state, { type: 'GO_TO_STEP', stepIndex: 99 })).toBe(state);
  });
});

// ---------------------------------------------------------------------------
// Reducer — VALIDATE_STEP
// ---------------------------------------------------------------------------

describe('pcbTutorialReducer — VALIDATE_STEP', () => {
  it('completes a step when validation passes', () => {
    let state = pcbTutorialReducer(createInitialState(), { type: 'START' });
    state = pcbTutorialReducer(state, {
      type: 'VALIDATE_STEP',
      stepId: 'pcb-create-circuit',
      ctx: ctx({ circuitDesignCount: 1 }),
    });
    expect(state.stepStatuses['pcb-create-circuit']).toBe('completed');
  });

  it('does nothing when validation fails', () => {
    let state = pcbTutorialReducer(createInitialState(), { type: 'START' });
    state = pcbTutorialReducer(state, {
      type: 'VALIDATE_STEP',
      stepId: 'pcb-create-circuit',
      ctx: ctx({ circuitDesignCount: 0 }),
    });
    expect(state.stepStatuses['pcb-create-circuit']).toBe('active');
  });
});

// ---------------------------------------------------------------------------
// Reducer — QUIT / RESET
// ---------------------------------------------------------------------------

describe('pcbTutorialReducer — QUIT and RESET', () => {
  it('QUIT deactivates the tutorial but preserves progress', () => {
    let state = pcbTutorialReducer(createInitialState(), { type: 'START' });
    state = pcbTutorialReducer(state, { type: 'COMPLETE_STEP', stepId: 'pcb-create-circuit' });
    state = pcbTutorialReducer(state, { type: 'QUIT' });

    expect(state.isActive).toBe(false);
    expect(state.stepStatuses['pcb-create-circuit']).toBe('completed');
    expect(state.currentStepIndex).toBe(1);
  });

  it('RESET clears all progress', () => {
    let state = pcbTutorialReducer(createInitialState(), { type: 'START' });
    state = pcbTutorialReducer(state, { type: 'COMPLETE_STEP', stepId: 'pcb-create-circuit' });
    state = pcbTutorialReducer(state, { type: 'RESET' });

    expect(state.isActive).toBe(false);
    expect(state.currentStepIndex).toBe(0);
    expect(state.stepStatuses['pcb-create-circuit']).toBe('active');
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

describe('getCurrentStep', () => {
  it('returns the first step for initial state', () => {
    const state = createInitialState();
    const step = getCurrentStep(state);
    expect(step).not.toBeNull();
    expect(step?.id).toBe('pcb-create-circuit');
  });

  it('returns null for out-of-range index', () => {
    const state: PcbTutorialState = { ...createInitialState(), currentStepIndex: 999 };
    expect(getCurrentStep(state)).toBeNull();
  });
});

describe('getCompletedCount', () => {
  it('returns 0 for fresh state', () => {
    expect(getCompletedCount(createInitialState())).toBe(0);
  });

  it('counts completed steps', () => {
    let state = pcbTutorialReducer(createInitialState(), { type: 'START' });
    state = pcbTutorialReducer(state, { type: 'COMPLETE_STEP', stepId: 'pcb-create-circuit' });
    state = pcbTutorialReducer(state, { type: 'COMPLETE_STEP', stepId: 'pcb-add-components' });
    expect(getCompletedCount(state)).toBe(2);
  });

  it('does not count skipped steps', () => {
    let state = pcbTutorialReducer(createInitialState(), { type: 'START' });
    state = pcbTutorialReducer(state, { type: 'COMPLETE_STEP', stepId: 'pcb-create-circuit' });
    state = pcbTutorialReducer(state, { type: 'COMPLETE_STEP', stepId: 'pcb-add-components' });
    state = pcbTutorialReducer(state, { type: 'COMPLETE_STEP', stepId: 'pcb-wire-schematic' });
    state = pcbTutorialReducer(state, { type: 'SKIP_STEP', stepId: 'pcb-assign-nets' });
    expect(getCompletedCount(state)).toBe(3);
  });
});

describe('getProgressCount', () => {
  it('counts both completed and skipped', () => {
    let state = pcbTutorialReducer(createInitialState(), { type: 'START' });
    state = pcbTutorialReducer(state, { type: 'COMPLETE_STEP', stepId: 'pcb-create-circuit' });
    state = pcbTutorialReducer(state, { type: 'COMPLETE_STEP', stepId: 'pcb-add-components' });
    state = pcbTutorialReducer(state, { type: 'COMPLETE_STEP', stepId: 'pcb-wire-schematic' });
    state = pcbTutorialReducer(state, { type: 'SKIP_STEP', stepId: 'pcb-assign-nets' });
    expect(getProgressCount(state)).toBe(4);
  });
});

describe('getProgressPercent', () => {
  it('returns 0 for initial state', () => {
    expect(getProgressPercent(createInitialState())).toBe(0);
  });

  it('returns 100 when all steps are done', () => {
    let state = pcbTutorialReducer(createInitialState(), { type: 'START' });
    for (const step of PCB_TUTORIAL_STEPS) {
      state = pcbTutorialReducer(state, { type: 'COMPLETE_STEP', stepId: step.id });
    }
    expect(getProgressPercent(state)).toBe(100);
  });

  it('returns correct intermediate percent', () => {
    let state = pcbTutorialReducer(createInitialState(), { type: 'START' });
    state = pcbTutorialReducer(state, { type: 'COMPLETE_STEP', stepId: 'pcb-create-circuit' });
    // 1/10 = 10%
    expect(getProgressPercent(state)).toBe(10);
  });
});

describe('isTutorialComplete', () => {
  it('returns false for fresh state', () => {
    expect(isTutorialComplete(createInitialState())).toBe(false);
  });

  it('returns true when all completed', () => {
    let state = pcbTutorialReducer(createInitialState(), { type: 'START' });
    for (const step of PCB_TUTORIAL_STEPS) {
      state = pcbTutorialReducer(state, { type: 'COMPLETE_STEP', stepId: step.id });
    }
    expect(isTutorialComplete(state)).toBe(true);
  });
});

describe('getStepStatus', () => {
  it('returns locked for unknown step', () => {
    expect(getStepStatus(createInitialState(), 'nonexistent')).toBe('locked');
  });

  it('returns active for first step in initial state', () => {
    expect(getStepStatus(createInitialState(), 'pcb-create-circuit')).toBe('active');
  });
});

// ---------------------------------------------------------------------------
// buildValidationContext
// ---------------------------------------------------------------------------

describe('buildValidationContext', () => {
  it('fills in defaults for missing fields', () => {
    const result = buildValidationContext({});
    expect(result.circuitDesignCount).toBe(0);
    expect(result.gerberExported).toBe(false);
    expect(result.drcHasRun).toBe(false);
  });

  it('uses provided values', () => {
    const result = buildValidationContext({ circuitDesignCount: 3, gerberExported: true });
    expect(result.circuitDesignCount).toBe(3);
    expect(result.gerberExported).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

describe('Persistence', () => {
  it('loadPcbTutorialState returns initial state when nothing stored', () => {
    const state = loadPcbTutorialState();
    expect(state.currentStepIndex).toBe(0);
    expect(state.isActive).toBe(false);
  });

  it('savePcbTutorialState + loadPcbTutorialState roundtrips', () => {
    let state = pcbTutorialReducer(createInitialState(), { type: 'START' });
    state = pcbTutorialReducer(state, { type: 'COMPLETE_STEP', stepId: 'pcb-create-circuit' });
    savePcbTutorialState(state);

    const loaded = loadPcbTutorialState();
    expect(loaded.currentStepIndex).toBe(1);
    expect(loaded.stepStatuses['pcb-create-circuit']).toBe('completed');
    expect(loaded.isActive).toBe(true);
  });

  it('clearPcbTutorialState removes stored state', () => {
    savePcbTutorialState(pcbTutorialReducer(createInitialState(), { type: 'START' }));
    clearPcbTutorialState();
    const loaded = loadPcbTutorialState();
    expect(loaded.isActive).toBe(false);
    expect(loaded.currentStepIndex).toBe(0);
  });

  it('loadPcbTutorialState handles corrupted data gracefully', () => {
    store['protopulse-pcb-tutorial-state'] = '{bad json';
    const loaded = loadPcbTutorialState();
    expect(loaded.currentStepIndex).toBe(0);
  });
});
