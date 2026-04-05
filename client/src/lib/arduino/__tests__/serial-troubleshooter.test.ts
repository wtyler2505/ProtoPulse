import { describe, it, expect, beforeEach } from 'vitest';
import {
  createWizardState,
  startWizard,
  advanceStep,
  resetWizard,
  getCurrentStep,
  getStepById,
  buildDiagnosisSummary,
  buildStepOrder,
  getProgress,
  getStepsRemaining,
  DIAGNOSTIC_STEPS,
} from '../serial-troubleshooter';
import type {
  SerialContext,
  WizardState,
  DiagnosticStep,
} from '../serial-troubleshooter';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultContext(overrides?: Partial<SerialContext>): SerialContext {
  return {
    isConnected: true,
    baudRate: 115200,
    baudMismatchDismissed: false,
    bytesReceived: 0,
    hasGarbledData: false,
    selectedBoard: undefined,
    detectedDeviceLabel: undefined,
    arduinoProfileLabel: undefined,
    boardSafetyLabel: undefined,
    boardBlockerReason: null,
    ...overrides,
  };
}

/** Run the wizard to completion with the given results for each step. */
function runToCompletion(
  state: WizardState,
  results: Record<string, 'pass' | 'fail' | 'skip'>,
): WizardState {
  let s = startWizard(state);
  while (s.phase === 'running') {
    const step = getCurrentStep(s);
    if (!step) {
      break;
    }
    const result = results[step.id] ?? 'pass';
    s = advanceStep(s, result);
  }
  return s;
}

// ---------------------------------------------------------------------------
// DIAGNOSTIC_STEPS definitions
// ---------------------------------------------------------------------------

describe('DIAGNOSTIC_STEPS', () => {
  it('has at least 10 diagnostic steps', () => {
    expect(DIAGNOSTIC_STEPS.length).toBeGreaterThanOrEqual(10);
  });

  it('every step has a unique ID', () => {
    const ids = DIAGNOSTIC_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every step has required fields', () => {
    for (const step of DIAGNOSTIC_STEPS) {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
      expect(step.category).toBeTruthy();
      expect(step.severity).toBeTruthy();
      expect(step.fixSuggestion).toBeTruthy();
    }
  });

  it('step categories are valid', () => {
    const validCategories = new Set(['physical', 'software', 'firmware', 'configuration']);
    for (const step of DIAGNOSTIC_STEPS) {
      expect(validCategories.has(step.category)).toBe(true);
    }
  });

  it('step severities are valid', () => {
    const validSeverities = new Set(['critical', 'likely', 'possible']);
    for (const step of DIAGNOSTIC_STEPS) {
      expect(validSeverities.has(step.severity)).toBe(true);
    }
  });

  it('skipWhenPassed references valid step IDs', () => {
    const allIds = new Set(DIAGNOSTIC_STEPS.map((s) => s.id));
    for (const step of DIAGNOSTIC_STEPS) {
      if (step.skipWhenPassed) {
        for (const depId of step.skipWhenPassed) {
          expect(allIds.has(depId)).toBe(true);
        }
      }
    }
  });

  it('requiresBefore references valid step IDs', () => {
    const allIds = new Set(DIAGNOSTIC_STEPS.map((s) => s.id));
    for (const step of DIAGNOSTIC_STEPS) {
      if (step.requiresBefore) {
        for (const depId of step.requiresBefore) {
          expect(allIds.has(depId)).toBe(true);
        }
      }
    }
  });

  it('covers physical, software, firmware, and configuration categories', () => {
    const categories = new Set(DIAGNOSTIC_STEPS.map((s) => s.category));
    expect(categories.has('physical')).toBe(true);
    expect(categories.has('software')).toBe(true);
    expect(categories.has('firmware')).toBe(true);
    expect(categories.has('configuration')).toBe(true);
  });

  it('includes USB cable, baud rate, serial-begin, and arduino-ide-test steps', () => {
    const ids = new Set(DIAGNOSTIC_STEPS.map((s) => s.id));
    expect(ids.has('usb-cable')).toBe(true);
    expect(ids.has('baud-rate')).toBe(true);
    expect(ids.has('serial-begin')).toBe(true);
    expect(ids.has('arduino-ide-test')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getStepById
// ---------------------------------------------------------------------------

describe('getStepById', () => {
  it('returns the step for a valid ID', () => {
    const step = getStepById('usb-cable');
    expect(step).toBeDefined();
    expect(step?.id).toBe('usb-cable');
    expect(step?.title).toBe('USB Cable Check');
  });

  it('returns undefined for an invalid ID', () => {
    expect(getStepById('nonexistent-step')).toBeUndefined();
  });

  it('returns correct step for every defined ID', () => {
    for (const step of DIAGNOSTIC_STEPS) {
      const found = getStepById(step.id);
      expect(found).toBe(step);
    }
  });
});

// ---------------------------------------------------------------------------
// createWizardState
// ---------------------------------------------------------------------------

describe('createWizardState', () => {
  it('creates an idle wizard with step order', () => {
    const state = createWizardState(defaultContext());
    expect(state.phase).toBe('idle');
    expect(state.currentStepIndex).toBe(0);
    expect(state.outcomes).toHaveLength(0);
    expect(state.stepOrder.length).toBeGreaterThan(0);
  });

  it('includes all steps for default context (no data received)', () => {
    const state = createWizardState(defaultContext());
    // Should include physical steps since no bytes received
    expect(state.stepOrder).toContain('usb-cable');
    expect(state.stepOrder).toContain('power-check');
  });

  it('filters physical steps when bytes have been received', () => {
    const state = createWizardState(defaultContext({ bytesReceived: 100 }));
    expect(state.stepOrder).not.toContain('usb-cable');
    expect(state.stepOrder).not.toContain('power-check');
    expect(state.stepOrder).not.toContain('cable-swap');
  });

  it('filters irrelevant steps when garbled data was received', () => {
    const state = createWizardState(defaultContext({ hasGarbledData: true }));
    // Physical/driver checks are irrelevant if data IS coming through (just garbled)
    expect(state.stepOrder).not.toContain('usb-cable');
    expect(state.stepOrder).not.toContain('power-check');
    expect(state.stepOrder).not.toContain('cable-swap');
    expect(state.stepOrder).not.toContain('drivers');
    expect(state.stepOrder).not.toContain('port-selection');
    // But baud rate should still be included (main suspect for garbled data)
    expect(state.stepOrder).toContain('baud-rate');
  });

  it('filters baud-rate step when mismatch was already dismissed', () => {
    const state = createWizardState(defaultContext({ baudMismatchDismissed: true }));
    expect(state.stepOrder).not.toContain('baud-rate');
  });

  it('filters board-selection step when a board is already selected', () => {
    const state = createWizardState(defaultContext({ selectedBoard: 'Arduino Uno' }));
    expect(state.stepOrder).not.toContain('board-selection');
  });

  it('keeps board-selection when the selected board is flagged as mismatched', () => {
    const state = createWizardState(
      defaultContext({
        selectedBoard: 'Arduino Uno',
        boardBlockerReason: 'Selected board does not match the connected device.',
      }),
    );
    expect(state.stepOrder).toContain('board-selection');
  });
});

// ---------------------------------------------------------------------------
// buildStepOrder
// ---------------------------------------------------------------------------

describe('buildStepOrder', () => {
  it('orders critical steps before likely and possible', () => {
    const order = buildStepOrder(defaultContext());
    const steps = order.map((id) => getStepById(id)).filter(Boolean) as DiagnosticStep[];

    let lastSeverityIdx = -1;
    const severityRank: Record<string, number> = { critical: 0, likely: 1, possible: 2 };

    for (const step of steps) {
      const rank = severityRank[step.severity];
      expect(rank).toBeGreaterThanOrEqual(lastSeverityIdx);
      lastSeverityIdx = rank;
    }
  });

  it('returns a non-empty list for default context', () => {
    expect(buildStepOrder(defaultContext()).length).toBeGreaterThan(0);
  });

  it('returns a subset of all steps when context filters apply', () => {
    const full = buildStepOrder(defaultContext());
    const filtered = buildStepOrder(defaultContext({ bytesReceived: 100 }));
    expect(filtered.length).toBeLessThan(full.length);
  });

  it('returns only valid step IDs', () => {
    const order = buildStepOrder(defaultContext());
    for (const id of order) {
      expect(getStepById(id)).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// startWizard
// ---------------------------------------------------------------------------

describe('startWizard', () => {
  it('transitions from idle to running', () => {
    const state = createWizardState(defaultContext());
    const running = startWizard(state);
    expect(running.phase).toBe('running');
  });

  it('is a no-op if already running', () => {
    const state = startWizard(createWizardState(defaultContext()));
    const again = startWizard(state);
    expect(again).toBe(state);
  });

  it('is a no-op if complete', () => {
    let state = createWizardState(defaultContext());
    state = { ...state, phase: 'complete' };
    const result = startWizard(state);
    expect(result).toBe(state);
  });
});

// ---------------------------------------------------------------------------
// advanceStep
// ---------------------------------------------------------------------------

describe('advanceStep', () => {
  let state: WizardState;

  beforeEach(() => {
    state = startWizard(createWizardState(defaultContext()));
  });

  it('records a pass outcome and advances to next step', () => {
    const firstId = state.stepOrder[0];
    const next = advanceStep(state, 'pass');
    expect(next.outcomes).toHaveLength(1);
    expect(next.outcomes[0].stepId).toBe(firstId);
    expect(next.outcomes[0].result).toBe('pass');
    expect(next.currentStepIndex).toBeGreaterThan(state.currentStepIndex);
  });

  it('records a fail outcome and advances', () => {
    const next = advanceStep(state, 'fail');
    expect(next.outcomes[0].result).toBe('fail');
  });

  it('records a skip outcome and advances', () => {
    const next = advanceStep(state, 'skip');
    expect(next.outcomes[0].result).toBe('skip');
  });

  it('transitions to complete after the last step', () => {
    let s = state;
    while (s.phase === 'running') {
      s = advanceStep(s, 'pass');
    }
    expect(s.phase).toBe('complete');
  });

  it('is a no-op when not running', () => {
    const idle = createWizardState(defaultContext());
    const result = advanceStep(idle, 'pass');
    expect(result).toBe(idle);
  });

  it('auto-skips steps whose skipWhenPassed conditions are met', () => {
    // cable-swap has skipWhenPassed: ['usb-cable']
    // After usb-cable passes, cable-swap should be auto-skipped
    const ctx = defaultContext();
    let s = startWizard(createWizardState(ctx));

    // Find and pass the usb-cable step
    while (s.phase === 'running') {
      const step = getCurrentStep(s);
      if (!step) {
        break;
      }
      if (step.id === 'usb-cable') {
        s = advanceStep(s, 'pass');
        break;
      }
      s = advanceStep(s, 'pass');
    }

    // cable-swap should have been auto-skipped
    const cableSwapOutcome = s.outcomes.find((o) => o.stepId === 'cable-swap');
    if (cableSwapOutcome) {
      expect(cableSwapOutcome.result).toBe('skip');
    }
    // The wizard should not be waiting on cable-swap
    const currentStep = getCurrentStep(s);
    if (currentStep) {
      expect(currentStep.id).not.toBe('cable-swap');
    }
  });

  it('records timestamps on outcomes', () => {
    const before = Date.now();
    const next = advanceStep(state, 'pass');
    const after = Date.now();
    expect(next.outcomes[0].timestamp).toBeGreaterThanOrEqual(before);
    expect(next.outcomes[0].timestamp).toBeLessThanOrEqual(after);
  });
});

// ---------------------------------------------------------------------------
// getCurrentStep
// ---------------------------------------------------------------------------

describe('getCurrentStep', () => {
  it('returns the first step for a fresh running wizard', () => {
    const state = startWizard(createWizardState(defaultContext()));
    const step = getCurrentStep(state);
    expect(step).toBeDefined();
    expect(step?.id).toBe(state.stepOrder[0]);
  });

  it('returns undefined when wizard is complete', () => {
    let state = startWizard(createWizardState(defaultContext()));
    while (state.phase === 'running') {
      state = advanceStep(state, 'pass');
    }
    expect(getCurrentStep(state)).toBeUndefined();
  });

  it('advances correctly as steps are completed', () => {
    let state = startWizard(createWizardState(defaultContext()));
    const firstStep = getCurrentStep(state);
    state = advanceStep(state, 'pass');
    const secondStep = getCurrentStep(state);
    expect(secondStep).toBeDefined();
    if (firstStep && secondStep) {
      expect(secondStep.id).not.toBe(firstStep.id);
    }
  });
});

// ---------------------------------------------------------------------------
// resetWizard
// ---------------------------------------------------------------------------

describe('resetWizard', () => {
  it('resets to idle with fresh step order', () => {
    let state = startWizard(createWizardState(defaultContext()));
    state = advanceStep(state, 'fail');
    state = advanceStep(state, 'pass');

    const reset = resetWizard(defaultContext());
    expect(reset.phase).toBe('idle');
    expect(reset.currentStepIndex).toBe(0);
    expect(reset.outcomes).toHaveLength(0);
  });

  it('uses updated context for step filtering', () => {
    const reset = resetWizard(defaultContext({ bytesReceived: 500 }));
    expect(reset.stepOrder).not.toContain('usb-cable');
  });
});

// ---------------------------------------------------------------------------
// buildDiagnosisSummary
// ---------------------------------------------------------------------------

describe('buildDiagnosisSummary', () => {
  it('identifies failed steps', () => {
    const state = runToCompletion(
      createWizardState(defaultContext()),
      { 'usb-cable': 'fail', 'baud-rate': 'fail' },
    );
    const summary = buildDiagnosisSummary(state);
    expect(summary.hasActionableFailure).toBe(true);
    expect(summary.failedSteps.length).toBeGreaterThanOrEqual(2);
    const failedIds = summary.failedSteps.map((s) => s.id);
    expect(failedIds).toContain('usb-cable');
    expect(failedIds).toContain('baud-rate');
  });

  it('identifies passed steps', () => {
    const state = runToCompletion(
      createWizardState(defaultContext()),
      {},  // all default to pass
    );
    const summary = buildDiagnosisSummary(state);
    expect(summary.passedSteps.length).toBeGreaterThan(0);
  });

  it('reports no actionable failure when all steps pass', () => {
    const state = runToCompletion(
      createWizardState(defaultContext()),
      {},
    );
    const summary = buildDiagnosisSummary(state);
    expect(summary.hasActionableFailure).toBe(false);
    expect(summary.conclusion).toContain('passed');
  });

  it('provides a conclusion for a single failure', () => {
    const state = runToCompletion(
      createWizardState(defaultContext()),
      { 'baud-rate': 'fail' },
    );
    const summary = buildDiagnosisSummary(state);
    expect(summary.conclusion).toContain('Baud Rate Match');
  });

  it('provides a conclusion for multiple failures', () => {
    const state = runToCompletion(
      createWizardState(defaultContext()),
      { 'usb-cable': 'fail', 'serial-begin': 'fail', 'baud-rate': 'fail' },
    );
    const summary = buildDiagnosisSummary(state);
    expect(summary.conclusion).toContain('Multiple issues');
  });

  it('tracks skipped steps separately', () => {
    const state = runToCompletion(
      createWizardState(defaultContext()),
      { 'drivers': 'skip', 'arduino-ide-test': 'skip' },
    );
    const summary = buildDiagnosisSummary(state);
    const skippedIds = summary.skippedSteps.map((s) => s.id);
    expect(skippedIds).toContain('drivers');
    expect(skippedIds).toContain('arduino-ide-test');
  });
});

// ---------------------------------------------------------------------------
// getProgress
// ---------------------------------------------------------------------------

describe('getProgress', () => {
  it('returns 0 for a fresh wizard', () => {
    const state = createWizardState(defaultContext());
    expect(getProgress(state)).toBe(0);
  });

  it('returns 1 for a completed wizard', () => {
    const state = runToCompletion(createWizardState(defaultContext()), {});
    expect(getProgress(state)).toBe(1);
  });

  it('returns a fractional value during progress', () => {
    let state = startWizard(createWizardState(defaultContext()));
    state = advanceStep(state, 'pass');
    const progress = getProgress(state);
    expect(progress).toBeGreaterThan(0);
    expect(progress).toBeLessThan(1);
  });

  it('returns 1 when step order is empty', () => {
    const state: WizardState = {
      phase: 'complete',
      currentStepIndex: 0,
      stepOrder: [],
      outcomes: [],
    };
    expect(getProgress(state)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getStepsRemaining
// ---------------------------------------------------------------------------

describe('getStepsRemaining', () => {
  it('returns total step count for a fresh wizard', () => {
    const state = createWizardState(defaultContext());
    expect(getStepsRemaining(state)).toBe(state.stepOrder.length);
  });

  it('returns 0 for a completed wizard', () => {
    const state = runToCompletion(createWizardState(defaultContext()), {});
    expect(getStepsRemaining(state)).toBe(0);
  });

  it('decreases as steps are completed', () => {
    let state = startWizard(createWizardState(defaultContext()));
    const initial = getStepsRemaining(state);
    state = advanceStep(state, 'pass');
    expect(getStepsRemaining(state)).toBeLessThan(initial);
  });
});

// ---------------------------------------------------------------------------
// Context-Aware Filtering (integration)
// ---------------------------------------------------------------------------

describe('context-aware filtering', () => {
  it('garbled data context focuses on baud rate and firmware', () => {
    const state = createWizardState(
      defaultContext({ hasGarbledData: true, bytesReceived: 0 }),
    );
    expect(state.stepOrder).toContain('baud-rate');
    expect(state.stepOrder).toContain('serial-begin');
    // Physical checks should be filtered
    expect(state.stepOrder).not.toContain('usb-cable');
    expect(state.stepOrder).not.toContain('drivers');
  });

  it('bytes received context skips physical checks', () => {
    const state = createWizardState(
      defaultContext({ bytesReceived: 50 }),
    );
    expect(state.stepOrder).not.toContain('usb-cable');
    expect(state.stepOrder).not.toContain('power-check');
    // But firmware / config steps remain
    expect(state.stepOrder).toContain('serial-begin');
  });

  it('board selected context skips board-selection step', () => {
    const withBoard = createWizardState(
      defaultContext({ selectedBoard: 'ESP32' }),
    );
    const withoutBoard = createWizardState(
      defaultContext(),
    );
    expect(withBoard.stepOrder).not.toContain('board-selection');
    expect(withoutBoard.stepOrder).toContain('board-selection');
  });

  it('board mismatch context prioritizes board-selection even when a board is selected', () => {
    const state = createWizardState(
      defaultContext({
        selectedBoard: 'ESP32',
        boardBlockerReason: 'Selected board does not match the connected device.',
      }),
    );

    expect(state.stepOrder[0]).toBe('board-selection');
  });

  it('all filters combined produces minimal step list', () => {
    const state = createWizardState(
      defaultContext({
        bytesReceived: 200,
        hasGarbledData: true,
        baudMismatchDismissed: true,
        selectedBoard: 'Arduino Uno',
      }),
    );
    // Most steps should be filtered
    expect(state.stepOrder.length).toBeLessThan(DIAGNOSTIC_STEPS.length);
    // But some firmware steps should remain
    expect(state.stepOrder).toContain('serial-begin');
  });
});

// ---------------------------------------------------------------------------
// Full Wizard Flow (end-to-end)
// ---------------------------------------------------------------------------

describe('full wizard flow', () => {
  it('completes a full diagnostic run', () => {
    const ctx = defaultContext();
    let state = createWizardState(ctx);
    expect(state.phase).toBe('idle');

    state = startWizard(state);
    expect(state.phase).toBe('running');

    // Answer all steps as pass
    let stepCount = 0;
    while (state.phase === 'running') {
      const step = getCurrentStep(state);
      expect(step).toBeDefined();
      state = advanceStep(state, 'pass');
      stepCount++;
      if (stepCount > 50) {
        throw new Error('Infinite loop detected');
      }
    }

    expect(state.phase).toBe('complete');
    const summary = buildDiagnosisSummary(state);
    expect(summary.hasActionableFailure).toBe(false);
  });

  it('identifies the root cause from a mixed run', () => {
    const ctx = defaultContext();
    let state = startWizard(createWizardState(ctx));

    while (state.phase === 'running') {
      const step = getCurrentStep(state);
      if (!step) {
        break;
      }
      // Fail the serial-begin step, pass everything else
      const result = step.id === 'serial-begin' ? 'fail' as const : 'pass' as const;
      state = advanceStep(state, result);
    }

    const summary = buildDiagnosisSummary(state);
    expect(summary.hasActionableFailure).toBe(true);
    expect(summary.failedSteps).toHaveLength(1);
    expect(summary.failedSteps[0].id).toBe('serial-begin');
    expect(summary.conclusion).toContain('Serial.begin()');
  });

  it('handles rapid reset-and-rerun', () => {
    const ctx = defaultContext();
    let state = startWizard(createWizardState(ctx));
    state = advanceStep(state, 'fail');
    state = advanceStep(state, 'pass');

    // Reset mid-run
    state = resetWizard(ctx);
    expect(state.phase).toBe('idle');
    expect(state.outcomes).toHaveLength(0);

    // Start again
    state = startWizard(state);
    expect(state.phase).toBe('running');
    expect(getCurrentStep(state)).toBeDefined();
  });
});
