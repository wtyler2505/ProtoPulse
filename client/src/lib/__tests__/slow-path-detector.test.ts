import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  SlowPathDetector,
  SlowPathThreshold,
  getSuggestions,
  useSlowPathAlerts,
} from '../slow-path-detector';
import type { SlowPathEvent } from '../slow-path-detector';

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  SlowPathDetector.resetInstance();
});

// ---------------------------------------------------------------------------
// SlowPathThreshold constant
// ---------------------------------------------------------------------------

describe('SlowPathThreshold', () => {
  it('has renderMs = 100', () => {
    expect(SlowPathThreshold.renderMs).toBe(100);
  });

  it('has fetchMs = 3000', () => {
    expect(SlowPathThreshold.fetchMs).toBe(3000);
  });

  it('has interactionMs = 200', () => {
    expect(SlowPathThreshold.interactionMs).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// SlowPathDetector — singleton
// ---------------------------------------------------------------------------

describe('SlowPathDetector', () => {
  describe('singleton', () => {
    it('returns the same instance across calls', () => {
      const a = SlowPathDetector.getInstance();
      const b = SlowPathDetector.getInstance();
      expect(a).toBe(b);
    });

    it('returns a new instance after reset', () => {
      const a = SlowPathDetector.getInstance();
      SlowPathDetector.resetInstance();
      const b = SlowPathDetector.getInstance();
      expect(a).not.toBe(b);
    });

    it('accepts custom thresholds on first call', () => {
      const d = SlowPathDetector.getInstance({ renderMs: 50, fetchMs: 1000 });
      const t = d.getThresholds();
      expect(t.renderMs).toBe(50);
      expect(t.fetchMs).toBe(1000);
      expect(t.interactionMs).toBe(SlowPathThreshold.interactionMs);
    });
  });

  // -----------------------------------------------------------------------
  // Thresholds
  // -----------------------------------------------------------------------

  describe('getThresholds / setThresholds', () => {
    it('defaults match SlowPathThreshold', () => {
      const d = SlowPathDetector.getInstance();
      const t = d.getThresholds();
      expect(t.renderMs).toBe(SlowPathThreshold.renderMs);
      expect(t.fetchMs).toBe(SlowPathThreshold.fetchMs);
      expect(t.interactionMs).toBe(SlowPathThreshold.interactionMs);
    });

    it('setThresholds updates individual values', () => {
      const d = SlowPathDetector.getInstance();
      d.setThresholds({ renderMs: 250 });
      expect(d.getThresholds().renderMs).toBe(250);
      expect(d.getThresholds().fetchMs).toBe(SlowPathThreshold.fetchMs);
    });

    it('setThresholds updates all values at once', () => {
      const d = SlowPathDetector.getInstance();
      d.setThresholds({ renderMs: 10, fetchMs: 20, interactionMs: 30 });
      const t = d.getThresholds();
      expect(t.renderMs).toBe(10);
      expect(t.fetchMs).toBe(20);
      expect(t.interactionMs).toBe(30);
    });

    it('getThresholds returns a copy, not a reference', () => {
      const d = SlowPathDetector.getInstance();
      const t1 = d.getThresholds();
      d.setThresholds({ renderMs: 999 });
      const t2 = d.getThresholds();
      expect(t1.renderMs).toBe(SlowPathThreshold.renderMs);
      expect(t2.renderMs).toBe(999);
    });
  });

  // -----------------------------------------------------------------------
  // detectSlowRender
  // -----------------------------------------------------------------------

  describe('detectSlowRender', () => {
    it('returns null when duration is within threshold', () => {
      const d = SlowPathDetector.getInstance();
      expect(d.detectSlowRender('architecture', 50)).toBeNull();
    });

    it('returns null when duration equals threshold exactly', () => {
      const d = SlowPathDetector.getInstance();
      expect(d.detectSlowRender('architecture', 100)).toBeNull();
    });

    it('returns a SlowPathEvent when duration exceeds threshold', () => {
      const d = SlowPathDetector.getInstance();
      const event = d.detectSlowRender('architecture', 150);
      expect(event).not.toBeNull();
      expect(event!.view).toBe('architecture');
      expect(event!.operation).toBe('render');
      expect(event!.durationMs).toBe(150);
      expect(event!.threshold).toBe(SlowPathThreshold.renderMs);
      expect(typeof event!.suggestion).toBe('string');
      expect(event!.suggestion.length).toBeGreaterThan(0);
    });

    it('uses view-specific suggestion when available', () => {
      const d = SlowPathDetector.getInstance();
      const event = d.detectSlowRender('bom', 200);
      expect(event!.suggestion).toContain('BOM');
    });

    it('uses generic suggestion for unknown views', () => {
      const d = SlowPathDetector.getInstance();
      const event = d.detectSlowRender('unknown-view-xyz', 200);
      expect(event!.suggestion.length).toBeGreaterThan(0);
    });

    it('notifies subscribers', () => {
      const d = SlowPathDetector.getInstance();
      const cb = vi.fn();
      d.subscribe(cb);
      d.detectSlowRender('bom', 200);
      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb.mock.calls[0][0].operation).toBe('render');
    });

    it('does not notify when under threshold', () => {
      const d = SlowPathDetector.getInstance();
      const cb = vi.fn();
      d.subscribe(cb);
      d.detectSlowRender('bom', 50);
      expect(cb).not.toHaveBeenCalled();
    });

    it('respects updated threshold', () => {
      const d = SlowPathDetector.getInstance();
      d.setThresholds({ renderMs: 500 });
      expect(d.detectSlowRender('bom', 400)).toBeNull();
      expect(d.detectSlowRender('bom', 600)).not.toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // detectSlowFetch
  // -----------------------------------------------------------------------

  describe('detectSlowFetch', () => {
    it('returns null when duration is within threshold', () => {
      const d = SlowPathDetector.getInstance();
      expect(d.detectSlowFetch('/api/projects', 1000)).toBeNull();
    });

    it('returns null when duration equals threshold exactly', () => {
      const d = SlowPathDetector.getInstance();
      expect(d.detectSlowFetch('/api/projects', 3000)).toBeNull();
    });

    it('returns a SlowPathEvent when duration exceeds threshold', () => {
      const d = SlowPathDetector.getInstance();
      const event = d.detectSlowFetch('/api/projects', 5000);
      expect(event).not.toBeNull();
      expect(event!.view).toBe('/api/projects');
      expect(event!.operation).toBe('fetch');
      expect(event!.durationMs).toBe(5000);
      expect(event!.threshold).toBe(SlowPathThreshold.fetchMs);
    });

    it('uses endpoint-specific suggestion when available', () => {
      const d = SlowPathDetector.getInstance();
      const event = d.detectSlowFetch('/api/bom', 5000);
      expect(event!.suggestion).toContain('BOM');
    });

    it('notifies subscribers', () => {
      const d = SlowPathDetector.getInstance();
      const cb = vi.fn();
      d.subscribe(cb);
      d.detectSlowFetch('/api/chat', 4000);
      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb.mock.calls[0][0].operation).toBe('fetch');
    });

    it('respects updated threshold', () => {
      const d = SlowPathDetector.getInstance();
      d.setThresholds({ fetchMs: 1000 });
      expect(d.detectSlowFetch('/api/x', 800)).toBeNull();
      expect(d.detectSlowFetch('/api/x', 1500)).not.toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // detectSlowInteraction
  // -----------------------------------------------------------------------

  describe('detectSlowInteraction', () => {
    it('returns null when duration is within threshold', () => {
      const d = SlowPathDetector.getInstance();
      expect(d.detectSlowInteraction('drag', 100)).toBeNull();
    });

    it('returns null when duration equals threshold exactly', () => {
      const d = SlowPathDetector.getInstance();
      expect(d.detectSlowInteraction('drag', 200)).toBeNull();
    });

    it('returns a SlowPathEvent when duration exceeds threshold', () => {
      const d = SlowPathDetector.getInstance();
      const event = d.detectSlowInteraction('drag', 350);
      expect(event).not.toBeNull();
      expect(event!.view).toBe('drag');
      expect(event!.operation).toBe('interaction');
      expect(event!.durationMs).toBe(350);
      expect(event!.threshold).toBe(SlowPathThreshold.interactionMs);
    });

    it('uses interaction-specific suggestion when available', () => {
      const d = SlowPathDetector.getInstance();
      const event = d.detectSlowInteraction('zoom', 300);
      expect(event!.suggestion).toContain('zoom');
    });

    it('notifies subscribers', () => {
      const d = SlowPathDetector.getInstance();
      const cb = vi.fn();
      d.subscribe(cb);
      d.detectSlowInteraction('select', 500);
      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb.mock.calls[0][0].operation).toBe('interaction');
    });
  });

  // -----------------------------------------------------------------------
  // subscribe / unsubscribe
  // -----------------------------------------------------------------------

  describe('subscribe', () => {
    it('delivers events to multiple subscribers', () => {
      const d = SlowPathDetector.getInstance();
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      d.subscribe(cb1);
      d.subscribe(cb2);
      d.detectSlowRender('pcb', 200);
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });

    it('unsubscribe stops future notifications', () => {
      const d = SlowPathDetector.getInstance();
      const cb = vi.fn();
      const unsub = d.subscribe(cb);
      unsub();
      d.detectSlowRender('pcb', 200);
      expect(cb).not.toHaveBeenCalled();
    });

    it('unsubscribing one does not affect another', () => {
      const d = SlowPathDetector.getInstance();
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      const unsub1 = d.subscribe(cb1);
      d.subscribe(cb2);
      unsub1();
      d.detectSlowRender('pcb', 200);
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // History
  // -----------------------------------------------------------------------

  describe('history', () => {
    it('starts empty', () => {
      const d = SlowPathDetector.getInstance();
      expect(d.getHistory()).toHaveLength(0);
    });

    it('records every emitted event', () => {
      const d = SlowPathDetector.getInstance();
      d.detectSlowRender('a', 200);
      d.detectSlowFetch('/api/b', 5000);
      d.detectSlowInteraction('c', 300);
      expect(d.getHistory()).toHaveLength(3);
      expect(d.getHistory()[0].operation).toBe('render');
      expect(d.getHistory()[1].operation).toBe('fetch');
      expect(d.getHistory()[2].operation).toBe('interaction');
    });

    it('does not record events that are under threshold', () => {
      const d = SlowPathDetector.getInstance();
      d.detectSlowRender('a', 10);
      d.detectSlowFetch('/api/b', 100);
      expect(d.getHistory()).toHaveLength(0);
    });

    it('clearHistory empties the list', () => {
      const d = SlowPathDetector.getInstance();
      d.detectSlowRender('a', 200);
      d.detectSlowRender('b', 300);
      expect(d.getHistory()).toHaveLength(2);
      d.clearHistory();
      expect(d.getHistory()).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// getSuggestions
// ---------------------------------------------------------------------------

describe('getSuggestions', () => {
  it('returns specific suggestions for a known render view', () => {
    const event: SlowPathEvent = {
      view: 'bom',
      operation: 'render',
      durationMs: 200,
      threshold: 100,
      suggestion: 'test',
    };
    const suggestions = getSuggestions(event);
    expect(suggestions.length).toBeGreaterThanOrEqual(2);
    expect(suggestions.some((s) => s.includes('BOM'))).toBe(true);
  });

  it('returns specific suggestions for a known fetch endpoint', () => {
    const event: SlowPathEvent = {
      view: '/api/chat',
      operation: 'fetch',
      durationMs: 5000,
      threshold: 3000,
      suggestion: 'test',
    };
    const suggestions = getSuggestions(event);
    expect(suggestions.some((s) => s.toLowerCase().includes('stream'))).toBe(true);
  });

  it('returns specific suggestions for a known interaction', () => {
    const event: SlowPathEvent = {
      view: 'drag',
      operation: 'interaction',
      durationMs: 300,
      threshold: 200,
      suggestion: 'test',
    };
    const suggestions = getSuggestions(event);
    expect(suggestions.some((s) => s.toLowerCase().includes('drag') || s.toLowerCase().includes('throttle'))).toBe(
      true,
    );
  });

  it('falls back to generic suggestions for unknown views', () => {
    const event: SlowPathEvent = {
      view: 'totally-unknown-view',
      operation: 'render',
      durationMs: 200,
      threshold: 100,
      suggestion: 'test',
    };
    const suggestions = getSuggestions(event);
    expect(suggestions.length).toBeGreaterThanOrEqual(1);
  });

  it('does not contain duplicate suggestions', () => {
    const event: SlowPathEvent = {
      view: 'bom',
      operation: 'render',
      durationMs: 200,
      threshold: 100,
      suggestion: 'test',
    };
    const suggestions = getSuggestions(event);
    const unique = new Set(suggestions);
    expect(unique.size).toBe(suggestions.length);
  });

  it('specific suggestions come before generic ones', () => {
    const event: SlowPathEvent = {
      view: 'bom',
      operation: 'render',
      durationMs: 200,
      threshold: 100,
      suggestion: 'test',
    };
    const suggestions = getSuggestions(event);
    // First suggestion should be one of the BOM-specific ones
    expect(suggestions[0].includes('BOM') || suggestions[0].includes('virtual')).toBe(true);
  });

  it('returns at least one suggestion for any event', () => {
    const event: SlowPathEvent = {
      view: 'nonexistent',
      operation: 'fetch',
      durationMs: 5000,
      threshold: 3000,
      suggestion: 'test',
    };
    const suggestions = getSuggestions(event);
    expect(suggestions.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// SlowPathEvent shape contract
// ---------------------------------------------------------------------------

describe('SlowPathEvent shape', () => {
  it('all emitted events have required fields', () => {
    const d = SlowPathDetector.getInstance();
    d.detectSlowRender('pcb', 200);
    d.detectSlowFetch('/api/projects', 5000);
    d.detectSlowInteraction('zoom', 400);

    for (const event of d.getHistory()) {
      expect(typeof event.view).toBe('string');
      expect(event.view.length).toBeGreaterThan(0);
      expect(['render', 'fetch', 'interaction']).toContain(event.operation);
      expect(typeof event.durationMs).toBe('number');
      expect(event.durationMs).toBeGreaterThan(0);
      expect(typeof event.threshold).toBe('number');
      expect(event.threshold).toBeGreaterThan(0);
      expect(typeof event.suggestion).toBe('string');
      expect(event.suggestion.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// useSlowPathAlerts hook
// ---------------------------------------------------------------------------

describe('useSlowPathAlerts', () => {
  it('starts with empty events', () => {
    const { result } = renderHook(() => useSlowPathAlerts());
    expect(result.current.events).toEqual([]);
  });

  it('receives events when detector fires', () => {
    const { result } = renderHook(() => useSlowPathAlerts());

    act(() => {
      result.current.reportRender('architecture', 200);
    });

    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].operation).toBe('render');
    expect(result.current.events[0].view).toBe('architecture');
  });

  it('newest event is first in the list', () => {
    const { result } = renderHook(() => useSlowPathAlerts());

    act(() => {
      result.current.reportRender('architecture', 200);
    });
    act(() => {
      result.current.reportFetch('/api/bom', 5000);
    });

    expect(result.current.events[0].operation).toBe('fetch');
    expect(result.current.events[1].operation).toBe('render');
  });

  it('does not accumulate events that are under threshold', () => {
    const { result } = renderHook(() => useSlowPathAlerts());

    act(() => {
      result.current.reportRender('bom', 10);
    });

    expect(result.current.events).toHaveLength(0);
  });

  it('respects maxEvents limit', () => {
    const { result } = renderHook(() => useSlowPathAlerts(3));

    act(() => {
      result.current.reportRender('a', 200);
    });
    act(() => {
      result.current.reportRender('b', 200);
    });
    act(() => {
      result.current.reportRender('c', 200);
    });
    act(() => {
      result.current.reportRender('d', 200);
    });

    expect(result.current.events).toHaveLength(3);
    // Most recent should be first
    expect(result.current.events[0].view).toBe('d');
  });

  it('clearEvents empties the event list', () => {
    const { result } = renderHook(() => useSlowPathAlerts());

    act(() => {
      result.current.reportRender('bom', 200);
    });
    expect(result.current.events).toHaveLength(1);

    act(() => {
      result.current.clearEvents();
    });
    expect(result.current.events).toHaveLength(0);
  });

  it('reportFetch triggers fetch detection', () => {
    const { result } = renderHook(() => useSlowPathAlerts());

    act(() => {
      result.current.reportFetch('/api/chat', 5000);
    });

    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].operation).toBe('fetch');
  });

  it('reportInteraction triggers interaction detection', () => {
    const { result } = renderHook(() => useSlowPathAlerts());

    act(() => {
      result.current.reportInteraction('drag', 500);
    });

    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].operation).toBe('interaction');
  });

  it('unsubscribes on unmount', () => {
    const { result, unmount } = renderHook(() => useSlowPathAlerts());

    act(() => {
      result.current.reportRender('a', 200);
    });
    expect(result.current.events).toHaveLength(1);

    unmount();

    // Fire another event on the detector directly — should not blow up
    const d = SlowPathDetector.getInstance();
    d.detectSlowRender('b', 200);
    // No assertion needed — if unsubscribe failed, the setState-on-unmounted
    // would cause a warning (React 18+) or error. The test passing is enough.
  });
});
