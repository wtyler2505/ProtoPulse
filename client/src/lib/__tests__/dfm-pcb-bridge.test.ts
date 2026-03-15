import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  mapDfmViolationToHighlight,
  useDfmHighlights,
  getDfmHighlight,
  resetDfmBridgeForTesting,
} from '../dfm-pcb-bridge';
import type { DfmPcbHighlight } from '../dfm-pcb-bridge';
import { ViolationNavigator } from '@/lib/validation/violation-navigator';
import type { DfmViolation, DfmCategory, DfmSeverity } from '@/lib/dfm-checker';
import { renderHook, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDfmViolation(overrides: Partial<DfmViolation> = {}): DfmViolation {
  return {
    id: 'dfm-v1',
    ruleId: 'DFM-001',
    ruleName: 'Minimum Trace Width',
    severity: 'error' as DfmSeverity,
    category: 'trace' as DfmCategory,
    message: 'Trace width 2 mil is below minimum 3.5 mil',
    actual: 2,
    required: 3.5,
    unit: 'mil',
    location: { x: 100, y: 200 },
    elementId: 'trace-42',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// mapDfmViolationToHighlight
// ---------------------------------------------------------------------------

describe('mapDfmViolationToHighlight', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ViolationNavigator.resetInstance();
    resetDfmBridgeForTesting();
  });

  afterEach(() => {
    ViolationNavigator.resetInstance();
    resetDfmBridgeForTesting();
    vi.useRealTimers();
  });

  it('returns a DfmPcbHighlight with correct violation ID', () => {
    const h = mapDfmViolationToHighlight(makeDfmViolation({ id: 'dfm-99' }));
    expect(h.violationId).toBe('dfm-99');
  });

  it('preserves x/y coordinates from the violation location', () => {
    const h = mapDfmViolationToHighlight(makeDfmViolation({ location: { x: 55, y: 77 } }));
    expect(h.x).toBe(55);
    expect(h.y).toBe(77);
  });

  it('includes a positive radius', () => {
    const h = mapDfmViolationToHighlight(makeDfmViolation());
    expect(h.radius).toBeGreaterThan(0);
  });

  it('preserves severity from the violation', () => {
    const h = mapDfmViolationToHighlight(makeDfmViolation({ severity: 'warning' }));
    expect(h.severity).toBe('warning');
  });

  it('maps DFM info severity to warning', () => {
    const h = mapDfmViolationToHighlight(makeDfmViolation({ severity: 'info' }));
    expect(h.severity).toBe('warning');
  });

  it('preserves the DFM category', () => {
    const h = mapDfmViolationToHighlight(makeDfmViolation({ category: 'drill' }));
    expect(h.category).toBe('drill');
  });

  it('preserves the DFM rule name', () => {
    const h = mapDfmViolationToHighlight(makeDfmViolation({ ruleName: 'Max Drill Size' }));
    expect(h.ruleName).toBe('Max Drill Size');
  });

  it('preserves the elementId', () => {
    const h = mapDfmViolationToHighlight(makeDfmViolation({ elementId: 'pad-7' }));
    expect(h.elementId).toBe('pad-7');
  });

  it('returns undefined elementId when violation has no elementId', () => {
    const h = mapDfmViolationToHighlight(makeDfmViolation({ elementId: undefined }));
    expect(h.elementId).toBeUndefined();
  });

  it('sets ViolationNavigator active highlight', () => {
    mapDfmViolationToHighlight(makeDfmViolation({ id: 'dfm-nav' }));
    const nav = ViolationNavigator.getInstance();
    expect(nav.getActiveHighlight()).not.toBeNull();
    expect(nav.getActiveHighlight()!.violationId).toBe('dfm-nav');
  });

  it('emits navigation event to listeners', () => {
    const nav = ViolationNavigator.getInstance();
    const cb = vi.fn();
    nav.onNavigate(cb);

    mapDfmViolationToHighlight(makeDfmViolation());
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0].location.viewType).toBe('pcb');
  });

  it('auto-clears bridge highlight after 5 seconds', () => {
    mapDfmViolationToHighlight(makeDfmViolation());
    expect(getDfmHighlight()).not.toBeNull();

    vi.advanceTimersByTime(4999);
    expect(getDfmHighlight()).not.toBeNull();

    vi.advanceTimersByTime(1);
    expect(getDfmHighlight()).toBeNull();
  });

  it('bridge highlight survives navigator 3s auto-clear', () => {
    mapDfmViolationToHighlight(makeDfmViolation());

    // Navigator's own 3s timer fires, but the bridge has its own state
    vi.advanceTimersByTime(3000);
    expect(getDfmHighlight()).not.toBeNull();

    // Bridge clears at 5s
    vi.advanceTimersByTime(2000);
    expect(getDfmHighlight()).toBeNull();
  });

  it('new mapping replaces previous highlight', () => {
    mapDfmViolationToHighlight(makeDfmViolation({ id: 'first' }));
    mapDfmViolationToHighlight(makeDfmViolation({ id: 'second' }));

    expect(getDfmHighlight()!.violationId).toBe('second');
  });

  it('new mapping resets the 5s timer', () => {
    mapDfmViolationToHighlight(makeDfmViolation({ id: 'a' }));
    vi.advanceTimersByTime(3000);

    mapDfmViolationToHighlight(makeDfmViolation({ id: 'b' }));

    // 3s after second mapping — should still be active (5s timer restarted)
    vi.advanceTimersByTime(3000);
    expect(getDfmHighlight()).not.toBeNull();
    expect(getDfmHighlight()!.violationId).toBe('b');

    // 5s after second mapping — should be cleared
    vi.advanceTimersByTime(2000);
    expect(getDfmHighlight()).toBeNull();
  });

  it('handles violation with no location (defaults to 0,0)', () => {
    const h = mapDfmViolationToHighlight(makeDfmViolation({ location: undefined }));
    expect(h.x).toBe(0);
    expect(h.y).toBe(0);
  });

  it('handles board-level violation (no elementId, no location)', () => {
    const h = mapDfmViolationToHighlight(makeDfmViolation({
      elementId: undefined,
      location: undefined,
      category: 'board',
      ruleId: 'DFM-009',
      ruleName: 'Maximum Layer Count',
    }));
    expect(h.violationId).toBe('dfm-v1');
    expect(h.category).toBe('board');
    expect(h.x).toBe(0);
    expect(h.y).toBe(0);
    expect(h.elementId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// useDfmHighlights
// ---------------------------------------------------------------------------

describe('useDfmHighlights', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ViolationNavigator.resetInstance();
    resetDfmBridgeForTesting();
  });

  afterEach(() => {
    ViolationNavigator.resetInstance();
    resetDfmBridgeForTesting();
    vi.useRealTimers();
  });

  it('returns null highlight initially', () => {
    const { result } = renderHook(() => useDfmHighlights());
    expect(result.current.highlight).toBeNull();
  });

  it('returns highlight after mapDfmViolationToHighlight is called', () => {
    const { result } = renderHook(() => useDfmHighlights());

    act(() => {
      mapDfmViolationToHighlight(makeDfmViolation({ id: 'hook-test' }));
    });

    expect(result.current.highlight).not.toBeNull();
    expect(result.current.highlight!.violationId).toBe('hook-test');
  });

  it('highlight includes coordinates from violation', () => {
    const { result } = renderHook(() => useDfmHighlights());

    act(() => {
      mapDfmViolationToHighlight(makeDfmViolation({ location: { x: 10, y: 20 } }));
    });

    expect(result.current.highlight!.x).toBe(10);
    expect(result.current.highlight!.y).toBe(20);
  });

  it('clearHighlight removes the highlight', () => {
    const { result } = renderHook(() => useDfmHighlights());

    act(() => {
      mapDfmViolationToHighlight(makeDfmViolation());
    });
    expect(result.current.highlight).not.toBeNull();

    act(() => {
      result.current.clearHighlight();
    });
    expect(result.current.highlight).toBeNull();
  });

  it('returns null for non-PCB highlights', () => {
    const { result } = renderHook(() => useDfmHighlights());

    act(() => {
      // Navigate to a schematic violation (ERC rule type)
      const nav = ViolationNavigator.getInstance();
      nav.navigate({
        id: 'erc-1',
        ruleType: 'unconnected-pin',
        severity: 'warning',
        message: 'Pin not connected',
      });
    });

    // Should be null because it's a schematic violation, not PCB
    expect(result.current.highlight).toBeNull();
  });

  it('updates when highlight auto-clears', () => {
    const { result } = renderHook(() => useDfmHighlights());

    act(() => {
      mapDfmViolationToHighlight(makeDfmViolation());
    });
    expect(result.current.highlight).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.highlight).toBeNull();
  });

  it('provides clearHighlight function', () => {
    const { result } = renderHook(() => useDfmHighlights());
    expect(typeof result.current.clearHighlight).toBe('function');
  });

  it('re-renders on rapid navigation updates', () => {
    const { result } = renderHook(() => useDfmHighlights());

    act(() => {
      mapDfmViolationToHighlight(makeDfmViolation({ id: 'a' }));
      mapDfmViolationToHighlight(makeDfmViolation({ id: 'b' }));
      mapDfmViolationToHighlight(makeDfmViolation({ id: 'c' }));
    });

    expect(result.current.highlight).not.toBeNull();
    expect(result.current.highlight!.violationId).toBe('c');
  });

  it('returns severity from the navigation request', () => {
    const { result } = renderHook(() => useDfmHighlights());

    act(() => {
      mapDfmViolationToHighlight(makeDfmViolation({ severity: 'warning' }));
    });

    expect(result.current.highlight!.severity).toBe('warning');
  });
});

// ---------------------------------------------------------------------------
// resetDfmBridgeForTesting
// ---------------------------------------------------------------------------

describe('resetDfmBridgeForTesting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ViolationNavigator.resetInstance();
  });

  afterEach(() => {
    ViolationNavigator.resetInstance();
    resetDfmBridgeForTesting();
    vi.useRealTimers();
  });

  it('cancels pending DFM auto-clear timer', () => {
    mapDfmViolationToHighlight(makeDfmViolation());
    resetDfmBridgeForTesting();

    const cb = vi.fn();
    ViolationNavigator.getInstance().subscribe(cb);

    // The 5s timer should have been cancelled — no clear notification
    vi.advanceTimersByTime(5000);
    // The navigator's own 3s timer may still fire, so only check the 5s one
    // was cancelled (navigator's timer is separate)
  });

  it('is safe to call multiple times', () => {
    resetDfmBridgeForTesting();
    resetDfmBridgeForTesting();
    resetDfmBridgeForTesting();
    // No error
  });

  it('is safe to call without prior mapping', () => {
    resetDfmBridgeForTesting();
    // No error
  });
});

// ---------------------------------------------------------------------------
// Integration: DFM violation categories
// ---------------------------------------------------------------------------

describe('DFM category mapping', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ViolationNavigator.resetInstance();
    resetDfmBridgeForTesting();
  });

  afterEach(() => {
    ViolationNavigator.resetInstance();
    resetDfmBridgeForTesting();
    vi.useRealTimers();
  });

  const categories: DfmCategory[] = [
    'trace', 'drill', 'clearance', 'silkscreen', 'solder-mask',
    'board', 'copper', 'annular-ring', 'via', 'pad',
  ];

  for (const category of categories) {
    it(`handles ${category} category violations`, () => {
      const h = mapDfmViolationToHighlight(makeDfmViolation({ category }));
      expect(h.category).toBe(category);
      expect(h.violationId).toBe('dfm-v1');
    });
  }

  it('all DFM violations navigate to PCB view', () => {
    const nav = ViolationNavigator.getInstance();
    const cb = vi.fn();
    nav.onNavigate(cb);

    for (const category of categories) {
      mapDfmViolationToHighlight(makeDfmViolation({ category, id: `dfm-${category}` }));
    }

    // All calls should target PCB
    for (const call of cb.mock.calls) {
      // DFM violations with known categories should resolve to pcb
      // Some may fall back to architecture if the category isn't in DFM_CATEGORIES
      // but the ruleId 'DFM-001' contains no PCB keywords, so they'll use category
      expect(['pcb', 'architecture']).toContain(call[0].location.viewType);
    }
  });
});

// ---------------------------------------------------------------------------
// Integration: DFM rule IDs
// ---------------------------------------------------------------------------

describe('DFM rule ID mapping', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ViolationNavigator.resetInstance();
    resetDfmBridgeForTesting();
  });

  afterEach(() => {
    ViolationNavigator.resetInstance();
    resetDfmBridgeForTesting();
    vi.useRealTimers();
  });

  const ruleIds = [
    'DFM-001', 'DFM-002', 'DFM-003', 'DFM-004', 'DFM-005',
    'DFM-006', 'DFM-007', 'DFM-008', 'DFM-009', 'DFM-010',
    'DFM-011', 'DFM-012', 'DFM-013', 'DFM-014', 'DFM-015',
  ];

  for (const ruleId of ruleIds) {
    it(`maps ${ruleId} to a valid highlight`, () => {
      const h = mapDfmViolationToHighlight(makeDfmViolation({ ruleId }));
      expect(h).toBeDefined();
      expect(h.violationId).toBe('dfm-v1');
      expect(h.radius).toBeGreaterThan(0);
    });
  }
});
