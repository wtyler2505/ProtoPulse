import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getTutorialTarget,
  getSystemStepTarget,
  highlightElement,
  scrollToElement,
  highlightAndScroll,
  TUTORIAL_HIGHLIGHT_CLASS,
  DEFAULT_TUTORIAL_HIGHLIGHT_DURATION,
} from '../tutorial-navigation';
import type { TutorialStep } from '@/lib/tutorials';
import type { TutorialStep as SystemTutorialStep } from '@/lib/tutorial-system';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStep(overrides: Partial<TutorialStep> = {}): TutorialStep {
  return {
    id: overrides.id ?? 'test-step',
    title: overrides.title ?? 'Test Step',
    content: overrides.content ?? 'Test content',
    targetSelector: overrides.targetSelector,
    position: overrides.position,
    action: overrides.action,
    viewRequired: overrides.viewRequired,
  };
}

// ---------------------------------------------------------------------------
// getTutorialTarget
// ---------------------------------------------------------------------------

describe('getTutorialTarget', () => {
  it('returns null for a step with no viewRequired and no tab selector', () => {
    const step = makeStep({ id: 'gs-welcome' });
    expect(getTutorialTarget(step)).toBeNull();
  });

  it('maps viewRequired "architecture" to architecture ViewMode', () => {
    const step = makeStep({ viewRequired: 'architecture', targetSelector: '[data-testid="tab-architecture"]' });
    const target = getTutorialTarget(step);
    expect(target).not.toBeNull();
    expect(target!.view).toBe('architecture');
    expect(target!.elementSelector).toBe('[data-testid="tab-architecture"]');
  });

  it('maps viewRequired "schematic" to schematic ViewMode', () => {
    const step = makeStep({ viewRequired: 'schematic', targetSelector: '[data-testid="tab-schematic"]' });
    const target = getTutorialTarget(step);
    expect(target).not.toBeNull();
    expect(target!.view).toBe('schematic');
  });

  it('maps viewRequired "validation" to validation ViewMode', () => {
    const step = makeStep({ viewRequired: 'validation' });
    const target = getTutorialTarget(step);
    expect(target).not.toBeNull();
    expect(target!.view).toBe('validation');
  });

  it('maps viewRequired "output" to output ViewMode', () => {
    const step = makeStep({ viewRequired: 'output' });
    const target = getTutorialTarget(step);
    expect(target).not.toBeNull();
    expect(target!.view).toBe('output');
  });

  it('maps viewRequired "simulation" to simulation ViewMode', () => {
    const step = makeStep({ viewRequired: 'simulation' });
    const target = getTutorialTarget(step);
    expect(target).not.toBeNull();
    expect(target!.view).toBe('simulation');
  });

  it('maps viewRequired "pcb" to pcb ViewMode', () => {
    const step = makeStep({ viewRequired: 'pcb' });
    const target = getTutorialTarget(step);
    expect(target).not.toBeNull();
    expect(target!.view).toBe('pcb');
  });

  it('maps viewRequired "breadboard" to breadboard ViewMode', () => {
    const step = makeStep({ viewRequired: 'breadboard' });
    const target = getTutorialTarget(step);
    expect(target).not.toBeNull();
    expect(target!.view).toBe('breadboard');
  });

  it('infers view from tab selector when viewRequired is absent', () => {
    const step = makeStep({ targetSelector: '[data-testid="tab-validation"]' });
    const target = getTutorialTarget(step);
    expect(target).not.toBeNull();
    expect(target!.view).toBe('validation');
  });

  it('infers view from tab-output selector', () => {
    const step = makeStep({ targetSelector: '[data-testid="tab-output"]' });
    const target = getTutorialTarget(step);
    expect(target).not.toBeNull();
    expect(target!.view).toBe('output');
  });

  it('prefers viewRequired over tab selector inference', () => {
    const step = makeStep({
      viewRequired: 'schematic',
      targetSelector: '[data-testid="tab-architecture"]',
    });
    const target = getTutorialTarget(step);
    expect(target).not.toBeNull();
    expect(target!.view).toBe('schematic');
  });

  it('returns null for an unknown viewRequired with no tab selector', () => {
    const step = makeStep({ viewRequired: 'unknown-view-xyz' });
    expect(getTutorialTarget(step)).toBeNull();
  });

  it('returns null for a non-tab targetSelector with no viewRequired', () => {
    const step = makeStep({ targetSelector: '[data-testid="chat-panel"]' });
    expect(getTutorialTarget(step)).toBeNull();
  });

  it('includes the targetSelector in the result as elementSelector', () => {
    const step = makeStep({
      viewRequired: 'architecture',
      targetSelector: '[data-testid="architecture-canvas"]',
    });
    const target = getTutorialTarget(step);
    expect(target!.elementSelector).toBe('[data-testid="architecture-canvas"]');
  });

  it('sets default highlight duration', () => {
    const step = makeStep({ viewRequired: 'architecture' });
    const target = getTutorialTarget(step);
    expect(target!.highlightDuration).toBe(DEFAULT_TUTORIAL_HIGHLIGHT_DURATION);
  });

  it('handles all existing getting-started tutorial steps', () => {
    // gs-architecture has viewRequired: 'architecture'
    const archStep = makeStep({ viewRequired: 'architecture', targetSelector: '[data-testid="tab-architecture"]' });
    expect(getTutorialTarget(archStep)!.view).toBe('architecture');

    // gs-validation has targetSelector tab-validation (no viewRequired in actual data)
    const valStep = makeStep({ targetSelector: '[data-testid="tab-validation"]' });
    expect(getTutorialTarget(valStep)!.view).toBe('validation');

    // gs-export has targetSelector tab-output
    const outStep = makeStep({ targetSelector: '[data-testid="tab-output"]' });
    expect(getTutorialTarget(outStep)!.view).toBe('output');
  });

  it('handles circuit-design tutorial cd-schematic step', () => {
    const step = makeStep({ viewRequired: 'schematic', targetSelector: '[data-testid="tab-schematic"]' });
    const target = getTutorialTarget(step);
    expect(target!.view).toBe('schematic');
    expect(target!.elementSelector).toBe('[data-testid="tab-schematic"]');
  });
});

// ---------------------------------------------------------------------------
// highlightElement
// ---------------------------------------------------------------------------

describe('highlightElement', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.setAttribute('data-testid', 'highlight-target');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  it('adds the highlight class to a matching element', () => {
    highlightElement('[data-testid="highlight-target"]');
    expect(container.classList.contains(TUTORIAL_HIGHLIGHT_CLASS)).toBe(true);
  });

  it('returns a cleanup function that removes the highlight class', () => {
    const cleanup = highlightElement('[data-testid="highlight-target"]');
    expect(container.classList.contains(TUTORIAL_HIGHLIGHT_CLASS)).toBe(true);

    cleanup();
    expect(container.classList.contains(TUTORIAL_HIGHLIGHT_CLASS)).toBe(false);
  });

  it('returns a no-op cleanup when no element matches', () => {
    const cleanup = highlightElement('[data-testid="nonexistent"]');
    // Should not throw
    expect(() => cleanup()).not.toThrow();
  });

  it('auto-removes highlight after the specified duration', () => {
    vi.useFakeTimers();

    highlightElement('[data-testid="highlight-target"]', 1000);
    expect(container.classList.contains(TUTORIAL_HIGHLIGHT_CLASS)).toBe(true);

    vi.advanceTimersByTime(999);
    expect(container.classList.contains(TUTORIAL_HIGHLIGHT_CLASS)).toBe(true);

    vi.advanceTimersByTime(1);
    expect(container.classList.contains(TUTORIAL_HIGHLIGHT_CLASS)).toBe(false);

    vi.useRealTimers();
  });

  it('cleanup before duration clears the timer', () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');

    const cleanup = highlightElement('[data-testid="highlight-target"]', 5000);
    cleanup();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(container.classList.contains(TUTORIAL_HIGHLIGHT_CLASS)).toBe(false);

    // Advancing time should not cause issues
    vi.advanceTimersByTime(5000);
    expect(container.classList.contains(TUTORIAL_HIGHLIGHT_CLASS)).toBe(false);

    vi.useRealTimers();
  });

  it('double cleanup is safe', () => {
    const cleanup = highlightElement('[data-testid="highlight-target"]');
    cleanup();
    // Second call should not throw
    expect(() => cleanup()).not.toThrow();
    expect(container.classList.contains(TUTORIAL_HIGHLIGHT_CLASS)).toBe(false);
  });

  it('uses default duration when none specified', () => {
    vi.useFakeTimers();

    highlightElement('[data-testid="highlight-target"]');
    expect(container.classList.contains(TUTORIAL_HIGHLIGHT_CLASS)).toBe(true);

    vi.advanceTimersByTime(DEFAULT_TUTORIAL_HIGHLIGHT_DURATION);
    expect(container.classList.contains(TUTORIAL_HIGHLIGHT_CLASS)).toBe(false);

    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('constants', () => {
  it('TUTORIAL_HIGHLIGHT_CLASS is a non-empty string', () => {
    expect(typeof TUTORIAL_HIGHLIGHT_CLASS).toBe('string');
    expect(TUTORIAL_HIGHLIGHT_CLASS.length).toBeGreaterThan(0);
  });

  it('DEFAULT_TUTORIAL_HIGHLIGHT_DURATION is a positive number', () => {
    expect(typeof DEFAULT_TUTORIAL_HIGHLIGHT_DURATION).toBe('number');
    expect(DEFAULT_TUTORIAL_HIGHLIGHT_DURATION).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Helpers for SystemTutorialStep
// ---------------------------------------------------------------------------

function makeSystemStep(overrides: Partial<SystemTutorialStep> = {}): SystemTutorialStep {
  return {
    id: overrides.id ?? 'sys-step',
    title: overrides.title ?? 'System Step',
    description: overrides.description ?? 'A system tutorial step.',
    type: overrides.type ?? 'info',
    canSkip: overrides.canSkip ?? true,
    order: overrides.order ?? 0,
    targetSelector: overrides.targetSelector,
    targetTestId: overrides.targetTestId,
    targetView: overrides.targetView,
    targetElement: overrides.targetElement,
    position: overrides.position,
    requiredAction: overrides.requiredAction,
    validationFn: overrides.validationFn,
    tips: overrides.tips,
  };
}

// ---------------------------------------------------------------------------
// getSystemStepTarget
// ---------------------------------------------------------------------------

describe('getSystemStepTarget', () => {
  it('returns null for step without targetView', () => {
    const step = makeSystemStep();
    expect(getSystemStepTarget(step)).toBeNull();
  });

  it('returns architecture view for targetView "architecture"', () => {
    const step = makeSystemStep({ targetView: 'architecture' });
    const target = getSystemStepTarget(step);
    expect(target).not.toBeNull();
    expect(target!.view).toBe('architecture');
  });

  it('returns schematic view for targetView "schematic"', () => {
    const step = makeSystemStep({ targetView: 'schematic' });
    expect(getSystemStepTarget(step)!.view).toBe('schematic');
  });

  it('returns validation view for targetView "validation"', () => {
    const step = makeSystemStep({ targetView: 'validation' });
    expect(getSystemStepTarget(step)!.view).toBe('validation');
  });

  it('returns output view for targetView "output"', () => {
    const step = makeSystemStep({ targetView: 'output' });
    expect(getSystemStepTarget(step)!.view).toBe('output');
  });

  it('returns procurement view for targetView "procurement"', () => {
    const step = makeSystemStep({ targetView: 'procurement' });
    expect(getSystemStepTarget(step)!.view).toBe('procurement');
  });

  it('returns pcb view for targetView "pcb"', () => {
    const step = makeSystemStep({ targetView: 'pcb' });
    expect(getSystemStepTarget(step)!.view).toBe('pcb');
  });

  it('returns breadboard view for targetView "breadboard"', () => {
    const step = makeSystemStep({ targetView: 'breadboard' });
    expect(getSystemStepTarget(step)!.view).toBe('breadboard');
  });

  it('returns null for unknown targetView', () => {
    const step = makeSystemStep({ targetView: 'unknown-xyz' });
    expect(getSystemStepTarget(step)).toBeNull();
  });

  it('uses targetElement as elementSelector when present', () => {
    const step = makeSystemStep({
      targetView: 'architecture',
      targetElement: '[data-testid="add-node"]',
    });
    const target = getSystemStepTarget(step);
    expect(target!.elementSelector).toBe('[data-testid="add-node"]');
  });

  it('derives elementSelector from targetTestId when targetElement absent', () => {
    const step = makeSystemStep({
      targetView: 'architecture',
      targetTestId: 'button-add-node',
    });
    const target = getSystemStepTarget(step);
    expect(target!.elementSelector).toBe('[data-testid="button-add-node"]');
  });

  it('prefers targetElement over targetTestId', () => {
    const step = makeSystemStep({
      targetView: 'schematic',
      targetElement: '.custom-el',
      targetTestId: 'fallback-id',
    });
    const target = getSystemStepTarget(step);
    expect(target!.elementSelector).toBe('.custom-el');
  });

  it('falls back to targetSelector when no targetElement or targetTestId', () => {
    const step = makeSystemStep({
      targetView: 'pcb',
      targetSelector: '#legacy-selector',
    });
    const target = getSystemStepTarget(step);
    expect(target!.elementSelector).toBe('#legacy-selector');
  });

  it('returns undefined elementSelector when no selector fields present', () => {
    const step = makeSystemStep({ targetView: 'architecture' });
    const target = getSystemStepTarget(step);
    expect(target!.elementSelector).toBeUndefined();
  });

  it('sets default highlight duration', () => {
    const step = makeSystemStep({ targetView: 'output' });
    const target = getSystemStepTarget(step);
    expect(target!.highlightDuration).toBe(DEFAULT_TUTORIAL_HIGHLIGHT_DURATION);
  });

  // Built-in tutorial step mapping tests
  it('welcome-create-node step maps to architecture view', () => {
    const step = makeSystemStep({
      id: 'welcome-create-node',
      targetView: 'architecture',
      targetElement: '[data-testid="button-add-node"]',
    });
    const target = getSystemStepTarget(step);
    expect(target!.view).toBe('architecture');
    expect(target!.elementSelector).toBe('[data-testid="button-add-node"]');
  });

  it('bom-add-component step maps to procurement view', () => {
    const step = makeSystemStep({
      id: 'bom-add-component',
      targetView: 'procurement',
      targetElement: '[data-testid="button-add-bom-item"]',
    });
    const target = getSystemStepTarget(step);
    expect(target!.view).toBe('procurement');
  });

  it('sim-create-circuit step maps to schematic view', () => {
    const step = makeSystemStep({
      id: 'sim-create-circuit',
      targetView: 'schematic',
      targetElement: '[data-testid="schematic-view"]',
    });
    const target = getSystemStepTarget(step);
    expect(target!.view).toBe('schematic');
  });

  it('export-choose-format step maps to output view', () => {
    const step = makeSystemStep({
      id: 'export-choose-format',
      targetView: 'output',
      targetElement: '[data-testid="export-panel"]',
    });
    const target = getSystemStepTarget(step);
    expect(target!.view).toBe('output');
  });

  it('arch-run-validation step maps to validation view', () => {
    const step = makeSystemStep({
      id: 'arch-run-validation',
      targetView: 'validation',
      targetElement: '[data-testid="validation-view"]',
    });
    const target = getSystemStepTarget(step);
    expect(target!.view).toBe('validation');
  });
});

// ---------------------------------------------------------------------------
// scrollToElement
// ---------------------------------------------------------------------------

describe('scrollToElement', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.setAttribute('data-testid', 'scroll-target');
    container.scrollIntoView = vi.fn();
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  it('calls scrollIntoView with smooth behavior and center block', () => {
    scrollToElement('[data-testid="scroll-target"]');
    expect(container.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
    });
  });

  it('does not throw for nonexistent selector', () => {
    expect(() => scrollToElement('[data-testid="no-such-element"]')).not.toThrow();
  });

  it('does not throw for invalid CSS selector', () => {
    expect(() => scrollToElement('[[[invalid')).not.toThrow();
  });

  it('is a no-op when element does not exist', () => {
    // Just ensure no error; container.scrollIntoView should not be called
    scrollToElement('[data-testid="ghost"]');
    expect(container.scrollIntoView).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// highlightAndScroll
// ---------------------------------------------------------------------------

describe('highlightAndScroll', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.setAttribute('data-testid', 'hs-target');
    container.scrollIntoView = vi.fn();
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  it('adds highlight class and scrolls element into view', () => {
    highlightAndScroll('[data-testid="hs-target"]');
    expect(container.classList.contains(TUTORIAL_HIGHLIGHT_CLASS)).toBe(true);
    expect(container.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
    });
  });

  it('returns a cleanup function that removes the highlight', () => {
    const cleanup = highlightAndScroll('[data-testid="hs-target"]');
    expect(container.classList.contains(TUTORIAL_HIGHLIGHT_CLASS)).toBe(true);
    cleanup();
    expect(container.classList.contains(TUTORIAL_HIGHLIGHT_CLASS)).toBe(false);
  });

  it('returns a no-op cleanup when element not found', () => {
    const cleanup = highlightAndScroll('[data-testid="nonexistent"]');
    expect(() => cleanup()).not.toThrow();
  });

  it('auto-removes highlight after specified duration', () => {
    vi.useFakeTimers();
    highlightAndScroll('[data-testid="hs-target"]', 1500);
    expect(container.classList.contains(TUTORIAL_HIGHLIGHT_CLASS)).toBe(true);

    vi.advanceTimersByTime(1500);
    expect(container.classList.contains(TUTORIAL_HIGHLIGHT_CLASS)).toBe(false);
    vi.useRealTimers();
  });
});
