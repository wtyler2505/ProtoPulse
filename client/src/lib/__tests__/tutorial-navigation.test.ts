import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getTutorialTarget,
  highlightElement,
  TUTORIAL_HIGHLIGHT_CLASS,
  DEFAULT_TUTORIAL_HIGHLIGHT_DURATION,
} from '../tutorial-navigation';
import type { TutorialStep } from '@/lib/tutorials';

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
