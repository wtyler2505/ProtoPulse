import { describe, it, expect, vi } from 'vitest';
import {
  CurrentDensityOverlayManager,
  DEFAULT_DENSITY_LIMITS,
  DEFAULT_COPPER_THICKNESS_MM,
  getCurrentDensityOverlayManager,
  resetCurrentDensityOverlayManager,
} from '../current-density-overlay';
import type {
  TraceCurrentData,
  DensityLimits,
  DensitySegment,
} from '../current-density-overlay';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeTrace(overrides: Partial<TraceCurrentData> & { traceId: string }): TraceCurrentData {
  return {
    netName: 'VCC',
    current: 1.0,
    segments: [{ start: { x: 0, y: 0 }, end: { x: 10, y: 0 } }],
    width: 0.25,
    copperThickness: DEFAULT_COPPER_THICKNESS_MM,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Enable / Disable
// ---------------------------------------------------------------------------

describe('CurrentDensityOverlayManager — enable/disable', () => {
  it('starts disabled', () => {
    const mgr = CurrentDensityOverlayManager.create();
    expect(mgr.isEnabled()).toBe(false);
  });

  it('can be enabled', () => {
    const mgr = CurrentDensityOverlayManager.create();
    mgr.setEnabled(true);
    expect(mgr.isEnabled()).toBe(true);
  });

  it('can be disabled after enabling', () => {
    const mgr = CurrentDensityOverlayManager.create();
    mgr.setEnabled(true);
    mgr.setEnabled(false);
    expect(mgr.isEnabled()).toBe(false);
  });

  it('does not notify when setting same value', () => {
    const mgr = CurrentDensityOverlayManager.create();
    let count = 0;
    mgr.subscribe(() => { count++; });
    mgr.setEnabled(false); // already false
    expect(count).toBe(0);
  });

  it('notifies on enable change', () => {
    const mgr = CurrentDensityOverlayManager.create();
    let count = 0;
    mgr.subscribe(() => { count++; });
    mgr.setEnabled(true);
    expect(count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

describe('CurrentDensityOverlayManager — subscription', () => {
  it('subscribe returns an unsubscribe function', () => {
    const mgr = CurrentDensityOverlayManager.create();
    let count = 0;
    const unsub = mgr.subscribe(() => { count++; });
    mgr.setEnabled(true);
    expect(count).toBe(1);
    unsub();
    mgr.setEnabled(false);
    expect(count).toBe(1); // no further notifications
  });

  it('supports multiple listeners', () => {
    const mgr = CurrentDensityOverlayManager.create();
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    mgr.subscribe(fn1);
    mgr.subscribe(fn2);
    mgr.setEnabled(true);
    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).toHaveBeenCalledTimes(1);
  });

  it('notifies on data update', () => {
    const mgr = CurrentDensityOverlayManager.create();
    let count = 0;
    mgr.subscribe(() => { count++; });
    mgr.updateCurrentData([makeTrace({ traceId: 't1' })]);
    expect(count).toBe(1);
  });

  it('notifies on clearCurrentData', () => {
    const mgr = CurrentDensityOverlayManager.create();
    mgr.updateCurrentData([makeTrace({ traceId: 't1' })]);
    let count = 0;
    mgr.subscribe(() => { count++; });
    mgr.clearCurrentData();
    expect(count).toBe(1);
  });

  it('notifies on setLimits', () => {
    const mgr = CurrentDensityOverlayManager.create();
    let count = 0;
    mgr.subscribe(() => { count++; });
    mgr.setLimits({ safe: 10, caution: 20, danger: 40 });
    expect(count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Density calculation
// ---------------------------------------------------------------------------

describe('CurrentDensityOverlayManager — calculateDensity', () => {
  const mgr = CurrentDensityOverlayManager.create();

  it('calculates density for 1A through 0.25mm trace at 35μm copper', () => {
    // Cross section = 0.25 * 0.035 = 0.00875 mm²
    // Density = 1 / 0.00875 ≈ 114.29 A/mm²
    const density = mgr.calculateDensity(1.0, 0.25, 0.035);
    expect(density).toBeCloseTo(114.29, 1);
  });

  it('calculates density for 0.5A through 1mm trace at 70μm copper', () => {
    // Cross section = 1.0 * 0.070 = 0.070 mm²
    // Density = 0.5 / 0.070 ≈ 7.14 A/mm²
    const density = mgr.calculateDensity(0.5, 1.0, 0.070);
    expect(density).toBeCloseTo(7.14, 1);
  });

  it('calculates density for 3A through 2mm trace at 35μm copper', () => {
    // Cross section = 2.0 * 0.035 = 0.070 mm²
    // Density = 3 / 0.070 ≈ 42.86 A/mm²
    const density = mgr.calculateDensity(3.0, 2.0, 0.035);
    expect(density).toBeCloseTo(42.86, 1);
  });

  it('uses absolute value of current (handles negative)', () => {
    const pos = mgr.calculateDensity(2.0, 0.5, 0.035);
    const neg = mgr.calculateDensity(-2.0, 0.5, 0.035);
    expect(neg).toBe(pos);
  });

  it('returns Infinity for zero trace width', () => {
    const density = mgr.calculateDensity(1.0, 0, 0.035);
    expect(density).toBe(Infinity);
  });

  it('returns Infinity for zero copper thickness', () => {
    const density = mgr.calculateDensity(1.0, 0.25, 0);
    expect(density).toBe(Infinity);
  });

  it('returns Infinity for negative trace width', () => {
    const density = mgr.calculateDensity(1.0, -0.5, 0.035);
    expect(density).toBe(Infinity);
  });

  it('returns 0 for zero current', () => {
    const density = mgr.calculateDensity(0, 0.25, 0.035);
    expect(density).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Color mapping
// ---------------------------------------------------------------------------

describe('CurrentDensityOverlayManager — densityToColor', () => {
  const mgr = CurrentDensityOverlayManager.create();
  const limits: DensityLimits = DEFAULT_DENSITY_LIMITS;

  it('returns green-ish color for 0 A/mm² (safe)', () => {
    const color = mgr.densityToColor(0, limits);
    // Should start at the green gradient stop
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    // Green channel should dominate
    const g = parseInt(color.slice(3, 5), 16);
    expect(g).toBeGreaterThan(150);
  });

  it('returns yellow-ish for caution range (~20 A/mm²)', () => {
    const color = mgr.densityToColor(20, limits);
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    // At ~20/50 = 0.4, should be in the yellow zone
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    expect(r).toBeGreaterThan(150);
    expect(g).toBeGreaterThan(100);
  });

  it('returns orange-ish for danger range (~40 A/mm²)', () => {
    const color = mgr.densityToColor(40, limits);
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    // At 40/50 = 0.8, should be in orange/red range
    const r = parseInt(color.slice(1, 3), 16);
    expect(r).toBeGreaterThan(200);
  });

  it('returns red for critical (>= danger limit)', () => {
    const color = mgr.densityToColor(50, limits);
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    // At 50/50 = 1.0, should be fully red
    const r = parseInt(color.slice(1, 3), 16);
    expect(r).toBeGreaterThan(200);
    const g = parseInt(color.slice(3, 5), 16);
    expect(g).toBeLessThan(100);
  });

  it('clamps to red for values far above danger', () => {
    const colorAt50 = mgr.densityToColor(50, limits);
    const colorAt200 = mgr.densityToColor(200, limits);
    // Both should be the same since we clamp at danger
    expect(colorAt50).toBe(colorAt200);
  });

  it('uses custom limits', () => {
    const customLimits: DensityLimits = { safe: 5, caution: 10, danger: 20 };
    // At 20 A/mm², should be at the max (red)
    const color = mgr.densityToColor(20, customLimits);
    const r = parseInt(color.slice(1, 3), 16);
    expect(r).toBeGreaterThan(200);
  });
});

// ---------------------------------------------------------------------------
// Segment generation
// ---------------------------------------------------------------------------

describe('CurrentDensityOverlayManager — getDensitySegments', () => {
  it('returns empty array when no data', () => {
    const mgr = CurrentDensityOverlayManager.create();
    expect(mgr.getDensitySegments()).toEqual([]);
  });

  it('generates segments for a single trace with one segment', () => {
    const mgr = CurrentDensityOverlayManager.create();
    mgr.updateCurrentData([
      makeTrace({ traceId: 't1', current: 0.1, width: 1.0, copperThickness: 0.035 }),
    ]);
    const segments = mgr.getDensitySegments();
    expect(segments).toHaveLength(1);
    expect(segments[0].id).toBe('t1-seg-0');
    expect(segments[0].width).toBe(1.0);
    expect(segments[0].density).toBeCloseTo(0.1 / (1.0 * 0.035), 1);
  });

  it('generates segments for a trace with multiple segments', () => {
    const mgr = CurrentDensityOverlayManager.create();
    mgr.updateCurrentData([
      makeTrace({
        traceId: 't1',
        segments: [
          { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
          { start: { x: 10, y: 0 }, end: { x: 10, y: 10 } },
          { start: { x: 10, y: 10 }, end: { x: 20, y: 10 } },
        ],
      }),
    ]);
    const segments = mgr.getDensitySegments();
    expect(segments).toHaveLength(3);
    expect(segments[0].id).toBe('t1-seg-0');
    expect(segments[1].id).toBe('t1-seg-1');
    expect(segments[2].id).toBe('t1-seg-2');
  });

  it('generates segments for multiple traces', () => {
    const mgr = CurrentDensityOverlayManager.create();
    mgr.updateCurrentData([
      makeTrace({ traceId: 't1' }),
      makeTrace({ traceId: 't2', netName: 'GND', current: 2.0 }),
    ]);
    const segments = mgr.getDensitySegments();
    expect(segments).toHaveLength(2);
    expect(segments[0].id).toBe('t1-seg-0');
    expect(segments[1].id).toBe('t2-seg-0');
    // t2 has higher current, so higher density
    expect(segments[1].density).toBeGreaterThan(segments[0].density);
  });

  it('assigns correct severity to segments', () => {
    const mgr = CurrentDensityOverlayManager.create();
    // With 0.25mm width and 0.035mm copper:
    // cross section = 0.00875 mm²
    // safe < 15: current < 0.131A
    // caution 15-30: current 0.131-0.2625A
    // danger 30-50: current 0.2625-0.4375A
    // critical > 50: current > 0.4375A
    mgr.updateCurrentData([
      makeTrace({ traceId: 'safe', current: 0.05 }),     // ~5.71 A/mm²
      makeTrace({ traceId: 'caution', current: 0.2 }),   // ~22.86 A/mm²
      makeTrace({ traceId: 'danger', current: 0.35 }),   // ~40 A/mm²
      makeTrace({ traceId: 'critical', current: 1.0 }),  // ~114 A/mm²
    ]);
    const segments = mgr.getDensitySegments();
    expect(segments[0].severity).toBe('safe');
    expect(segments[1].severity).toBe('caution');
    expect(segments[2].severity).toBe('danger');
    expect(segments[3].severity).toBe('critical');
  });

  it('caches segments until data changes', () => {
    const mgr = CurrentDensityOverlayManager.create();
    mgr.updateCurrentData([makeTrace({ traceId: 't1' })]);
    const first = mgr.getDensitySegments();
    const second = mgr.getDensitySegments();
    expect(first).toBe(second); // same reference
  });

  it('invalidates cache on updateCurrentData', () => {
    const mgr = CurrentDensityOverlayManager.create();
    mgr.updateCurrentData([makeTrace({ traceId: 't1' })]);
    const first = mgr.getDensitySegments();
    mgr.updateCurrentData([makeTrace({ traceId: 't2' })]);
    const second = mgr.getDensitySegments();
    expect(first).not.toBe(second);
    expect(second[0].id).toBe('t2-seg-0');
  });

  it('invalidates cache on clearCurrentData', () => {
    const mgr = CurrentDensityOverlayManager.create();
    mgr.updateCurrentData([makeTrace({ traceId: 't1' })]);
    mgr.getDensitySegments();
    mgr.clearCurrentData();
    expect(mgr.getDensitySegments()).toEqual([]);
  });

  it('invalidates cache on setLimits', () => {
    const mgr = CurrentDensityOverlayManager.create();
    mgr.updateCurrentData([makeTrace({ traceId: 't1', current: 0.2 })]);
    const first = mgr.getDensitySegments();
    mgr.setLimits({ safe: 5, caution: 10, danger: 20 });
    const second = mgr.getDensitySegments();
    expect(first).not.toBe(second);
    // With lower limits, same density → different severity
    expect(second[0].severity).not.toBe(first[0].severity);
  });

  it('uses DEFAULT_COPPER_THICKNESS_MM when trace copperThickness is 0', () => {
    const mgr = CurrentDensityOverlayManager.create();
    mgr.updateCurrentData([
      makeTrace({ traceId: 't1', copperThickness: 0 }),
    ]);
    const segments = mgr.getDensitySegments();
    // Should use default 0.035mm, not produce Infinity
    expect(segments[0].density).toBeLessThan(Infinity);
    expect(segments[0].density).toBeCloseTo(1.0 / (0.25 * DEFAULT_COPPER_THICKNESS_MM), 1);
  });

  it('preserves segment start/end coordinates', () => {
    const mgr = CurrentDensityOverlayManager.create();
    const start = { x: 5, y: 10 };
    const end = { x: 15, y: 20 };
    mgr.updateCurrentData([
      makeTrace({
        traceId: 't1',
        segments: [{ start, end }],
      }),
    ]);
    const segments = mgr.getDensitySegments();
    expect(segments[0].start).toEqual(start);
    expect(segments[0].end).toEqual(end);
  });
});

// ---------------------------------------------------------------------------
// Hot trace detection
// ---------------------------------------------------------------------------

describe('CurrentDensityOverlayManager — getHotTraces', () => {
  it('returns empty array when no data', () => {
    const mgr = CurrentDensityOverlayManager.create();
    expect(mgr.getHotTraces()).toEqual([]);
  });

  it('excludes safe traces', () => {
    const mgr = CurrentDensityOverlayManager.create();
    // 0.05A through 0.25mm at 0.035mm = ~5.7 A/mm² (safe)
    mgr.updateCurrentData([makeTrace({ traceId: 't1', current: 0.05 })]);
    expect(mgr.getHotTraces()).toEqual([]);
  });

  it('includes caution traces', () => {
    const mgr = CurrentDensityOverlayManager.create();
    // 0.2A through 0.25mm at 0.035mm = ~22.9 A/mm² (caution)
    mgr.updateCurrentData([makeTrace({ traceId: 't1', current: 0.2 })]);
    const hot = mgr.getHotTraces();
    expect(hot).toHaveLength(1);
    expect(hot[0].traceId).toBe('t1');
    expect(hot[0].severity).toBe('caution');
  });

  it('includes danger traces', () => {
    const mgr = CurrentDensityOverlayManager.create();
    mgr.updateCurrentData([makeTrace({ traceId: 't1', current: 0.35 })]);
    const hot = mgr.getHotTraces();
    expect(hot).toHaveLength(1);
    expect(hot[0].severity).toBe('danger');
  });

  it('includes critical traces', () => {
    const mgr = CurrentDensityOverlayManager.create();
    mgr.updateCurrentData([makeTrace({ traceId: 't1', current: 1.0 })]);
    const hot = mgr.getHotTraces();
    expect(hot).toHaveLength(1);
    expect(hot[0].severity).toBe('critical');
    expect(hot[0].recommendation).toContain('fuse');
  });

  it('returns multiple hot traces', () => {
    const mgr = CurrentDensityOverlayManager.create();
    mgr.updateCurrentData([
      makeTrace({ traceId: 'safe', current: 0.05 }),
      makeTrace({ traceId: 'hot1', current: 0.2 }),
      makeTrace({ traceId: 'hot2', current: 1.0 }),
    ]);
    const hot = mgr.getHotTraces();
    expect(hot).toHaveLength(2);
    expect(hot.map((h) => h.traceId)).toEqual(['hot1', 'hot2']);
  });

  it('includes netName in hot traces', () => {
    const mgr = CurrentDensityOverlayManager.create();
    mgr.updateCurrentData([makeTrace({ traceId: 't1', netName: 'MOTOR_PWR', current: 1.0 })]);
    const hot = mgr.getHotTraces();
    expect(hot[0].netName).toBe('MOTOR_PWR');
  });

  it('includes recommendation with trace width', () => {
    const mgr = CurrentDensityOverlayManager.create();
    mgr.updateCurrentData([makeTrace({ traceId: 't1', current: 0.2, width: 0.3 })]);
    const hot = mgr.getHotTraces();
    expect(hot[0].recommendation).toContain('0.30');
  });

  it('caches hot traces until data changes', () => {
    const mgr = CurrentDensityOverlayManager.create();
    mgr.updateCurrentData([makeTrace({ traceId: 't1', current: 1.0 })]);
    const first = mgr.getHotTraces();
    const second = mgr.getHotTraces();
    expect(first).toBe(second); // same reference
  });
});

// ---------------------------------------------------------------------------
// Data management
// ---------------------------------------------------------------------------

describe('CurrentDensityOverlayManager — data management', () => {
  it('getCurrentData returns empty array initially', () => {
    const mgr = CurrentDensityOverlayManager.create();
    expect(mgr.getCurrentData()).toEqual([]);
  });

  it('getCurrentData returns the data after update', () => {
    const mgr = CurrentDensityOverlayManager.create();
    const data = [makeTrace({ traceId: 't1' })];
    mgr.updateCurrentData(data);
    expect(mgr.getCurrentData()).toHaveLength(1);
  });

  it('updateCurrentData copies the array (no mutation)', () => {
    const mgr = CurrentDensityOverlayManager.create();
    const data = [makeTrace({ traceId: 't1' })];
    mgr.updateCurrentData(data);
    data.push(makeTrace({ traceId: 't2' }));
    expect(mgr.getCurrentData()).toHaveLength(1); // original not affected
  });

  it('clearCurrentData empties data', () => {
    const mgr = CurrentDensityOverlayManager.create();
    mgr.updateCurrentData([makeTrace({ traceId: 't1' })]);
    mgr.clearCurrentData();
    expect(mgr.getCurrentData()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

describe('CurrentDensityOverlayManager — limits', () => {
  it('starts with default IPC-2152 limits', () => {
    const mgr = CurrentDensityOverlayManager.create();
    const limits = mgr.getLimits();
    expect(limits).toEqual(DEFAULT_DENSITY_LIMITS);
  });

  it('can set custom limits', () => {
    const mgr = CurrentDensityOverlayManager.create();
    const custom = { safe: 10, caution: 25, danger: 40 };
    mgr.setLimits(custom);
    expect(mgr.getLimits()).toEqual(custom);
  });

  it('getLimits returns a copy (no mutation)', () => {
    const mgr = CurrentDensityOverlayManager.create();
    const limits = mgr.getLimits();
    limits.safe = 999;
    expect(mgr.getLimits().safe).toBe(DEFAULT_DENSITY_LIMITS.safe);
  });
});

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

describe('CurrentDensityOverlayManager — getLegendStops', () => {
  it('returns 5 legend stops', () => {
    const mgr = CurrentDensityOverlayManager.create();
    const stops = mgr.getLegendStops();
    expect(stops).toHaveLength(5);
  });

  it('first stop is at position 0 with density 0', () => {
    const mgr = CurrentDensityOverlayManager.create();
    const stops = mgr.getLegendStops();
    expect(stops[0].position).toBe(0);
    expect(stops[0].density).toBe(0);
  });

  it('last stop is at position 1', () => {
    const mgr = CurrentDensityOverlayManager.create();
    const stops = mgr.getLegendStops();
    expect(stops[stops.length - 1].position).toBe(1);
  });

  it('stops have valid hex colors', () => {
    const mgr = CurrentDensityOverlayManager.create();
    const stops = mgr.getLegendStops();
    for (const stop of stops) {
      expect(stop.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('stops have labels', () => {
    const mgr = CurrentDensityOverlayManager.create();
    const stops = mgr.getLegendStops();
    for (const stop of stops) {
      expect(stop.label.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

describe('CurrentDensityOverlayManager — singleton', () => {
  it('getCurrentDensityOverlayManager returns the same instance', () => {
    resetCurrentDensityOverlayManager();
    const a = getCurrentDensityOverlayManager();
    const b = getCurrentDensityOverlayManager();
    expect(a).toBe(b);
  });

  it('resetCurrentDensityOverlayManager creates a new instance', () => {
    resetCurrentDensityOverlayManager();
    const a = getCurrentDensityOverlayManager();
    resetCurrentDensityOverlayManager();
    const b = getCurrentDensityOverlayManager();
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('CurrentDensityOverlayManager — edge cases', () => {
  it('handles very narrow trace (0.01mm)', () => {
    const mgr = CurrentDensityOverlayManager.create();
    // 1A / (0.01 * 0.035) = 2857 A/mm²
    const density = mgr.calculateDensity(1.0, 0.01, 0.035);
    expect(density).toBeCloseTo(2857.14, 0);
  });

  it('handles very wide trace (50mm)', () => {
    const mgr = CurrentDensityOverlayManager.create();
    // 1A / (50 * 0.035) = 0.571 A/mm²
    const density = mgr.calculateDensity(1.0, 50, 0.035);
    expect(density).toBeCloseTo(0.571, 2);
  });

  it('handles heavy copper (2oz = 0.070mm)', () => {
    const mgr = CurrentDensityOverlayManager.create();
    const density = mgr.calculateDensity(1.0, 0.25, 0.070);
    // 1 / (0.25 * 0.070) = 57.14 A/mm²
    expect(density).toBeCloseTo(57.14, 1);
  });

  it('handles trace with empty segments array', () => {
    const mgr = CurrentDensityOverlayManager.create();
    mgr.updateCurrentData([makeTrace({ traceId: 't1', segments: [] })]);
    const segments = mgr.getDensitySegments();
    expect(segments).toEqual([]);
    // But hot traces still based on current/width
    mgr.updateCurrentData([makeTrace({ traceId: 't1', segments: [], current: 1.0 })]);
    const hot = mgr.getHotTraces();
    expect(hot).toHaveLength(1); // still detected as hot
  });

  it('handles very small current (microamps)', () => {
    const mgr = CurrentDensityOverlayManager.create();
    const density = mgr.calculateDensity(0.000001, 0.25, 0.035);
    expect(density).toBeCloseTo(0.000114, 4);
  });
});
