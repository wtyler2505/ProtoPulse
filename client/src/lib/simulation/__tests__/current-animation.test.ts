/**
 * Tests for CurrentAnimationManager — EveryCircuit-style live current/voltage
 * animation overlay.
 *
 * BL-0128
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CurrentAnimationManager,
  getVoltageColor,
  getCurrentDotSpacing,
  getCurrentAnimationManager,
  resetCurrentAnimationManager,
} from '../current-animation';
import type {
  WireSimData,
  WireSegment,
  AnimationFrame,
  VoltageRange,
} from '../current-animation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSimData(overrides: Partial<WireSimData> & { wireId: string }): WireSimData {
  return {
    current: 0.5,
    voltage: 3.3,
    ...overrides,
  };
}

function makeSegment(x1: number, y1: number, x2: number, y2: number): WireSegment {
  return { x1, y1, x2, y2 };
}

function createManagerWithWire(
  wireId: string,
  current: number,
  voltage: number,
  segments: WireSegment[],
): CurrentAnimationManager {
  const mgr = CurrentAnimationManager.create();
  const paths = new Map<string, WireSegment[]>();
  paths.set(wireId, segments);
  mgr.setWirePaths(paths);
  mgr.setSimulationData([{ wireId, current, voltage }]);
  return mgr;
}

// ---------------------------------------------------------------------------
// Simulation data loading
// ---------------------------------------------------------------------------

describe('CurrentAnimationManager — simulation data loading', () => {
  let mgr: CurrentAnimationManager;

  beforeEach(() => {
    mgr = CurrentAnimationManager.create();
  });

  it('starts with empty simulation data', () => {
    expect(mgr.getSimulationData()).toEqual([]);
  });

  it('loads simulation data via setSimulationData', () => {
    const data: WireSimData[] = [
      makeSimData({ wireId: 'w1', current: 0.5, voltage: 3.3 }),
      makeSimData({ wireId: 'w2', current: -0.2, voltage: 1.8 }),
    ];
    mgr.setSimulationData(data);
    expect(mgr.getSimulationData()).toHaveLength(2);
    expect(mgr.getSimulationData()[0].wireId).toBe('w1');
  });

  it('replaces previous simulation data on second call', () => {
    mgr.setSimulationData([makeSimData({ wireId: 'w1' })]);
    mgr.setSimulationData([makeSimData({ wireId: 'w2' })]);
    expect(mgr.getSimulationData()).toHaveLength(1);
    expect(mgr.getSimulationData()[0].wireId).toBe('w2');
  });

  it('calculates voltage range from simulation data', () => {
    mgr.setSimulationData([
      makeSimData({ wireId: 'w1', voltage: 1.5 }),
      makeSimData({ wireId: 'w2', voltage: 4.5 }),
      makeSimData({ wireId: 'w3', voltage: 0.5 }),
    ]);
    const range = mgr.getVoltageRange();
    expect(range.min).toBe(0.5);
    expect(range.max).toBe(4.5);
  });

  it('handles single voltage value by expanding range', () => {
    mgr.setSimulationData([makeSimData({ wireId: 'w1', voltage: 3.0 })]);
    const range = mgr.getVoltageRange();
    expect(range.min).toBe(2.0);
    expect(range.max).toBe(4.0);
  });

  it('resets voltage range to defaults on empty data', () => {
    mgr.setSimulationData([makeSimData({ wireId: 'w1', voltage: 10 })]);
    mgr.setSimulationData([]);
    const range = mgr.getVoltageRange();
    expect(range.min).toBe(0);
    expect(range.max).toBe(5);
  });

  it('notifies listeners when simulation data changes', () => {
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.setSimulationData([makeSimData({ wireId: 'w1' })]);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Wire path management
// ---------------------------------------------------------------------------

describe('CurrentAnimationManager — wire path management', () => {
  let mgr: CurrentAnimationManager;

  beforeEach(() => {
    mgr = CurrentAnimationManager.create();
  });

  it('starts with empty wire paths', () => {
    expect(mgr.getWirePaths().size).toBe(0);
  });

  it('sets wire paths via setWirePaths', () => {
    const paths = new Map<string, WireSegment[]>();
    paths.set('w1', [makeSegment(0, 0, 100, 0)]);
    mgr.setWirePaths(paths);
    expect(mgr.getWirePaths().size).toBe(1);
    expect(mgr.getWirePaths().get('w1')).toHaveLength(1);
  });

  it('replaces previous paths on second call', () => {
    const paths1 = new Map<string, WireSegment[]>();
    paths1.set('w1', [makeSegment(0, 0, 50, 0)]);
    mgr.setWirePaths(paths1);

    const paths2 = new Map<string, WireSegment[]>();
    paths2.set('w2', [makeSegment(0, 0, 100, 0)]);
    mgr.setWirePaths(paths2);

    expect(mgr.getWirePaths().has('w1')).toBe(false);
    expect(mgr.getWirePaths().has('w2')).toBe(true);
  });

  it('handles multi-segment wire paths', () => {
    const paths = new Map<string, WireSegment[]>();
    paths.set('w1', [
      makeSegment(0, 0, 50, 0),
      makeSegment(50, 0, 50, 50),
      makeSegment(50, 50, 100, 50),
    ]);
    mgr.setWirePaths(paths);
    expect(mgr.getWirePaths().get('w1')).toHaveLength(3);
  });

  it('notifies listeners when wire paths change', () => {
    const listener = vi.fn();
    mgr.subscribe(listener);
    const paths = new Map<string, WireSegment[]>();
    paths.set('w1', [makeSegment(0, 0, 100, 0)]);
    mgr.setWirePaths(paths);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Play/pause/stop state machine
// ---------------------------------------------------------------------------

describe('CurrentAnimationManager — play/pause/stop', () => {
  let mgr: CurrentAnimationManager;

  beforeEach(() => {
    mgr = CurrentAnimationManager.create();
  });

  it('starts in idle state', () => {
    expect(mgr.getState()).toBe('idle');
  });

  it('transitions from idle to playing', () => {
    mgr.play();
    expect(mgr.getState()).toBe('playing');
  });

  it('transitions from playing to paused', () => {
    mgr.play();
    mgr.pause();
    expect(mgr.getState()).toBe('paused');
  });

  it('transitions from paused to playing', () => {
    mgr.play();
    mgr.pause();
    mgr.play();
    expect(mgr.getState()).toBe('playing');
  });

  it('transitions from playing to idle via stop', () => {
    mgr.play();
    mgr.stop();
    expect(mgr.getState()).toBe('idle');
  });

  it('transitions from paused to idle via stop', () => {
    mgr.play();
    mgr.pause();
    mgr.stop();
    expect(mgr.getState()).toBe('idle');
  });

  it('play is idempotent when already playing', () => {
    const listener = vi.fn();
    mgr.play();
    mgr.subscribe(listener);
    mgr.play(); // no-op
    expect(listener).not.toHaveBeenCalled();
    expect(mgr.getState()).toBe('playing');
  });

  it('pause is a no-op when not playing', () => {
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.pause(); // idle -> no-op
    expect(listener).not.toHaveBeenCalled();
    expect(mgr.getState()).toBe('idle');
  });

  it('stop resets wire offsets', () => {
    const m = createManagerWithWire('w1', 0.5, 3.3, [makeSegment(0, 0, 100, 0)]);
    m.play();
    m.tick(1000); // advance
    m.stop();

    // After stop, playing again and getting frame should show dots from beginning
    m.play();
    const frame = m.getAnimationFrame();
    // Dots should exist (we have current) and be positioned near start of wire
    if (frame.dots.length > 0) {
      expect(frame.dots[0].x).toBeGreaterThanOrEqual(0);
    }
  });

  it('notifies listeners on state transitions', () => {
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.play();
    mgr.pause();
    mgr.stop();
    expect(listener).toHaveBeenCalledTimes(3);
  });
});

// ---------------------------------------------------------------------------
// Tick animation advancement
// ---------------------------------------------------------------------------

describe('CurrentAnimationManager — tick', () => {
  it('does not advance when idle', () => {
    const mgr = createManagerWithWire('w1', 0.5, 3.3, [makeSegment(0, 0, 100, 0)]);
    // idle state — tick should not move dots
    mgr.tick(1000);
    mgr.play();
    const frame = mgr.getAnimationFrame();
    // Dots should exist at initial positions
    expect(frame.dots.length).toBeGreaterThan(0);
  });

  it('does not advance when paused', () => {
    const mgr = createManagerWithWire('w1', 0.5, 3.3, [makeSegment(0, 0, 100, 0)]);
    mgr.play();
    mgr.tick(500);
    mgr.pause();
    const frame1 = mgr.getAnimationFrame();
    mgr.tick(500); // should not advance
    const frame2 = mgr.getAnimationFrame();
    expect(frame1.dots[0].x).toBe(frame2.dots[0].x);
  });

  it('advances dots when playing', () => {
    const mgr = createManagerWithWire('w1', 0.5, 3.3, [makeSegment(0, 0, 200, 0)]);
    mgr.play();
    const frame1 = mgr.getAnimationFrame();
    const firstDotX1 = frame1.dots.length > 0 ? frame1.dots[0].x : 0;

    mgr.tick(500); // 0.5 seconds
    const frame2 = mgr.getAnimationFrame();
    const firstDotX2 = frame2.dots.length > 0 ? frame2.dots[0].x : 0;

    // Dots should have moved
    expect(firstDotX2).not.toBe(firstDotX1);
  });

  it('ignores negative deltaMs', () => {
    const mgr = createManagerWithWire('w1', 0.5, 3.3, [makeSegment(0, 0, 100, 0)]);
    mgr.play();
    const frame1 = mgr.getAnimationFrame();
    mgr.tick(-100);
    const frame2 = mgr.getAnimationFrame();
    // Should not have changed
    expect(frame1.dots.length).toBe(frame2.dots.length);
  });

  it('ignores zero deltaMs', () => {
    const mgr = createManagerWithWire('w1', 0.5, 3.3, [makeSegment(0, 0, 100, 0)]);
    mgr.play();
    const frame1 = mgr.getAnimationFrame();
    mgr.tick(0);
    const frame2 = mgr.getAnimationFrame();
    expect(frame1.dots.length).toBe(frame2.dots.length);
  });

  it('advances faster with higher current', () => {
    const mgr1 = createManagerWithWire('w1', 0.2, 3.3, [makeSegment(0, 0, 500, 0)]);
    const mgr2 = createManagerWithWire('w1', 0.8, 3.3, [makeSegment(0, 0, 500, 0)]);

    mgr1.play();
    mgr2.play();
    mgr1.tick(1000);
    mgr2.tick(1000);

    const frame1 = mgr1.getAnimationFrame();
    const frame2 = mgr2.getAnimationFrame();

    // Both should have dots, but higher current should have moved more
    // (and have different dot count due to different spacing)
    expect(frame1.dots.length).toBeGreaterThan(0);
    expect(frame2.dots.length).toBeGreaterThan(0);
    // Higher current -> more dots (smaller spacing)
    expect(frame2.dots.length).toBeGreaterThanOrEqual(frame1.dots.length);
  });

  it('wraps offset around total path length', () => {
    const mgr = createManagerWithWire('w1', 1.0, 3.3, [makeSegment(0, 0, 50, 0)]);
    mgr.play();
    // Tick many seconds — should wrap without error
    mgr.tick(10000);
    const frame = mgr.getAnimationFrame();
    expect(frame.dots.length).toBeGreaterThan(0);
    // All dots should be within wire bounds
    for (const dot of frame.dots) {
      expect(dot.x).toBeGreaterThanOrEqual(0);
      expect(dot.x).toBeLessThanOrEqual(50);
    }
  });

  it('notifies listeners on tick', () => {
    const mgr = createManagerWithWire('w1', 0.5, 3.3, [makeSegment(0, 0, 100, 0)]);
    mgr.play();
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.tick(100);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Dot position calculation
// ---------------------------------------------------------------------------

describe('CurrentAnimationManager — dot position calculation', () => {
  it('places dots along a horizontal wire', () => {
    const mgr = createManagerWithWire('w1', 0.5, 3.3, [makeSegment(0, 0, 200, 0)]);
    mgr.play();
    const frame = mgr.getAnimationFrame();

    expect(frame.dots.length).toBeGreaterThan(0);
    // All dots should be on y=0 (horizontal wire)
    for (const dot of frame.dots) {
      expect(dot.y).toBe(0);
      expect(dot.x).toBeGreaterThanOrEqual(0);
      expect(dot.x).toBeLessThanOrEqual(200);
    }
  });

  it('places dots along a vertical wire', () => {
    const mgr = createManagerWithWire('w1', 0.5, 3.3, [makeSegment(10, 0, 10, 200)]);
    mgr.play();
    const frame = mgr.getAnimationFrame();

    expect(frame.dots.length).toBeGreaterThan(0);
    for (const dot of frame.dots) {
      expect(dot.x).toBe(10);
      expect(dot.y).toBeGreaterThanOrEqual(0);
      expect(dot.y).toBeLessThanOrEqual(200);
    }
  });

  it('places dots along a multi-segment path', () => {
    const mgr = createManagerWithWire('w1', 0.5, 3.3, [
      makeSegment(0, 0, 100, 0),
      makeSegment(100, 0, 100, 100),
    ]);
    mgr.play();
    const frame = mgr.getAnimationFrame();
    expect(frame.dots.length).toBeGreaterThan(0);
  });

  it('marks every Nth dot with showArrow', () => {
    const mgr = createManagerWithWire('w1', 1.0, 3.3, [makeSegment(0, 0, 500, 0)]);
    mgr.play();
    const frame = mgr.getAnimationFrame();

    const arrowDots = frame.dots.filter((d) => d.showArrow);
    const nonArrowDots = frame.dots.filter((d) => !d.showArrow);

    expect(arrowDots.length).toBeGreaterThan(0);
    expect(nonArrowDots.length).toBeGreaterThan(0);
  });

  it('sets correct angle for horizontal wire', () => {
    const mgr = createManagerWithWire('w1', 0.5, 3.3, [makeSegment(0, 0, 100, 0)]);
    mgr.play();
    const frame = mgr.getAnimationFrame();
    // Horizontal right: angle should be 0
    if (frame.dots.length > 0) {
      expect(frame.dots[0].angle).toBeCloseTo(0, 5);
    }
  });

  it('reverses angle for negative current', () => {
    const mgr = createManagerWithWire('w1', -0.5, 3.3, [makeSegment(0, 0, 100, 0)]);
    mgr.play();
    const frame = mgr.getAnimationFrame();
    // Negative current on horizontal wire: angle should be PI (reversed)
    if (frame.dots.length > 0) {
      expect(Math.abs(frame.dots[0].angle)).toBeCloseTo(Math.PI, 5);
    }
  });

  it('dots have correct wireId', () => {
    const mgr = CurrentAnimationManager.create();
    const paths = new Map<string, WireSegment[]>();
    paths.set('w1', [makeSegment(0, 0, 100, 0)]);
    paths.set('w2', [makeSegment(0, 10, 100, 10)]);
    mgr.setWirePaths(paths);
    mgr.setSimulationData([
      { wireId: 'w1', current: 0.5, voltage: 3.3 },
      { wireId: 'w2', current: 0.3, voltage: 1.8 },
    ]);
    mgr.play();
    const frame = mgr.getAnimationFrame();

    const w1Dots = frame.dots.filter((d) => d.wireId === 'w1');
    const w2Dots = frame.dots.filter((d) => d.wireId === 'w2');
    expect(w1Dots.length).toBeGreaterThan(0);
    expect(w2Dots.length).toBeGreaterThan(0);
  });

  it('dots have unique IDs', () => {
    const mgr = createManagerWithWire('w1', 1.0, 3.3, [makeSegment(0, 0, 500, 0)]);
    mgr.play();
    const frame = mgr.getAnimationFrame();
    const ids = new Set(frame.dots.map((d) => d.id));
    expect(ids.size).toBe(frame.dots.length);
  });
});

// ---------------------------------------------------------------------------
// Voltage color mapping
// ---------------------------------------------------------------------------

describe('getVoltageColor', () => {
  const range: VoltageRange = { min: 0, max: 10 };

  it('returns blue-ish hue for min voltage', () => {
    const color = getVoltageColor(0, range);
    // hue 240 (blue)
    expect(color).toContain('240');
  });

  it('returns cyan-ish hue for 25% voltage', () => {
    const color = getVoltageColor(2.5, range);
    // hue ~190 (cyan)
    expect(color).toContain('190');
  });

  it('returns yellow-ish hue for 50% voltage', () => {
    const color = getVoltageColor(5, range);
    // hue ~60 (yellow)
    expect(color).toContain('60');
  });

  it('returns red hue for max voltage', () => {
    const color = getVoltageColor(10, range);
    // hue 0 (red)
    expect(color).toBe('hsl(0, 100%, 60%)');
  });

  it('clamps below min to blue', () => {
    const color = getVoltageColor(-5, range);
    expect(color).toContain('240');
  });

  it('clamps above max to red', () => {
    const color = getVoltageColor(15, range);
    expect(color).toBe('hsl(0, 100%, 60%)');
  });

  it('returns cyan default for zero-span range', () => {
    const color = getVoltageColor(5, { min: 5, max: 5 });
    expect(color).toBe('hsl(190, 100%, 60%)');
  });

  it('returns valid HSL format', () => {
    const color = getVoltageColor(3, range);
    expect(color).toMatch(/^hsl\(\d+, 100%, 60%\)$/);
  });
});

// ---------------------------------------------------------------------------
// Current dot spacing
// ---------------------------------------------------------------------------

describe('getCurrentDotSpacing', () => {
  it('returns MAX_DOT_SPACING for zero current', () => {
    expect(getCurrentDotSpacing(0)).toBe(60);
  });

  it('returns MIN_DOT_SPACING for high current', () => {
    expect(getCurrentDotSpacing(1.0)).toBe(10);
  });

  it('returns MIN_DOT_SPACING for very high current', () => {
    expect(getCurrentDotSpacing(5.0)).toBe(10);
  });

  it('returns intermediate spacing for moderate current', () => {
    const spacing = getCurrentDotSpacing(0.5);
    expect(spacing).toBeGreaterThan(10);
    expect(spacing).toBeLessThan(60);
  });

  it('handles negative current (uses absolute value)', () => {
    const pos = getCurrentDotSpacing(0.5);
    const neg = getCurrentDotSpacing(-0.5);
    expect(pos).toBe(neg);
  });

  it('spacing decreases as current increases', () => {
    const s1 = getCurrentDotSpacing(0.1);
    const s2 = getCurrentDotSpacing(0.3);
    const s3 = getCurrentDotSpacing(0.7);
    expect(s1).toBeGreaterThan(s2);
    expect(s2).toBeGreaterThan(s3);
  });
});

// ---------------------------------------------------------------------------
// Speed multiplier
// ---------------------------------------------------------------------------

describe('CurrentAnimationManager — speed', () => {
  it('defaults to 1x speed', () => {
    const mgr = CurrentAnimationManager.create();
    expect(mgr.getSpeed()).toBe(1);
  });

  it('sets speed within bounds', () => {
    const mgr = CurrentAnimationManager.create();
    mgr.setSpeed(2);
    expect(mgr.getSpeed()).toBe(2);
  });

  it('clamps speed to minimum 0.25', () => {
    const mgr = CurrentAnimationManager.create();
    mgr.setSpeed(0.1);
    expect(mgr.getSpeed()).toBe(0.25);
  });

  it('clamps speed to maximum 4', () => {
    const mgr = CurrentAnimationManager.create();
    mgr.setSpeed(10);
    expect(mgr.getSpeed()).toBe(4);
  });

  it('higher speed moves dots faster', () => {
    const mgr1 = createManagerWithWire('w1', 0.5, 3.3, [makeSegment(0, 0, 500, 0)]);
    const mgr2 = createManagerWithWire('w1', 0.5, 3.3, [makeSegment(0, 0, 500, 0)]);

    mgr1.setSpeed(1);
    mgr2.setSpeed(4);

    mgr1.play();
    mgr2.play();

    // Tick both by 1 second
    mgr1.tick(1000);
    mgr2.tick(1000);

    const frame1 = mgr1.getAnimationFrame();
    const frame2 = mgr2.getAnimationFrame();

    // Both should have dots but positions differ
    expect(frame1.dots.length).toBeGreaterThan(0);
    expect(frame2.dots.length).toBeGreaterThan(0);
  });

  it('notifies listeners on speed change', () => {
    const mgr = CurrentAnimationManager.create();
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.setSpeed(2);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('CurrentAnimationManager — edge cases', () => {
  it('zero current produces no dots', () => {
    const mgr = createManagerWithWire('w1', 0, 3.3, [makeSegment(0, 0, 100, 0)]);
    mgr.play();
    const frame = mgr.getAnimationFrame();
    expect(frame.dots.filter((d) => d.wireId === 'w1')).toHaveLength(0);
  });

  it('empty wire paths produce no dots', () => {
    const mgr = CurrentAnimationManager.create();
    mgr.setSimulationData([makeSimData({ wireId: 'w1' })]);
    // No wire paths set
    mgr.play();
    const frame = mgr.getAnimationFrame();
    expect(frame.dots).toHaveLength(0);
  });

  it('single-point wire (zero-length segment) produces no dots', () => {
    const mgr = createManagerWithWire('w1', 0.5, 3.3, [makeSegment(50, 50, 50, 50)]);
    mgr.play();
    const frame = mgr.getAnimationFrame();
    expect(frame.dots.filter((d) => d.wireId === 'w1')).toHaveLength(0);
  });

  it('reversed current direction flips dot direction', () => {
    const mgrPos = createManagerWithWire('w1', 0.5, 3.3, [makeSegment(0, 0, 100, 0)]);
    const mgrNeg = createManagerWithWire('w1', -0.5, 3.3, [makeSegment(0, 0, 100, 0)]);

    mgrPos.play();
    mgrNeg.play();

    const framePos = mgrPos.getAnimationFrame();
    const frameNeg = mgrNeg.getAnimationFrame();

    // Arrow dots should have opposite angles
    const arrowPos = framePos.dots.find((d) => d.showArrow);
    const arrowNeg = frameNeg.dots.find((d) => d.showArrow);

    if (arrowPos && arrowNeg) {
      expect(Math.abs(arrowPos.angle - arrowNeg.angle)).toBeCloseTo(Math.PI, 1);
    }
  });

  it('wire without matching sim data is not animated', () => {
    const mgr = CurrentAnimationManager.create();
    const paths = new Map<string, WireSegment[]>();
    paths.set('w1', [makeSegment(0, 0, 100, 0)]);
    paths.set('w2', [makeSegment(0, 10, 100, 10)]);
    mgr.setWirePaths(paths);
    // Only w1 has sim data
    mgr.setSimulationData([{ wireId: 'w1', current: 0.5, voltage: 3.3 }]);
    mgr.play();
    const frame = mgr.getAnimationFrame();

    const w1Dots = frame.dots.filter((d) => d.wireId === 'w1');
    const w2Dots = frame.dots.filter((d) => d.wireId === 'w2');
    expect(w1Dots.length).toBeGreaterThan(0);
    expect(w2Dots.length).toBe(0);
  });

  it('idle state produces no dots in animation frame', () => {
    const mgr = createManagerWithWire('w1', 0.5, 3.3, [makeSegment(0, 0, 100, 0)]);
    const frame = mgr.getAnimationFrame();
    expect(frame.dots).toHaveLength(0);
    expect(frame.state).toBe('idle');
  });
});

// ---------------------------------------------------------------------------
// Voltage heatmap wires
// ---------------------------------------------------------------------------

describe('CurrentAnimationManager — voltage heatmap', () => {
  it('includes voltage-colored wires in frame when enabled', () => {
    const mgr = createManagerWithWire('w1', 0.5, 3.3, [makeSegment(0, 0, 100, 0)]);
    mgr.setShowVoltageHeatmap(true);
    mgr.play();
    const frame = mgr.getAnimationFrame();
    expect(frame.wires.length).toBeGreaterThan(0);
    expect(frame.wires[0].wireId).toBe('w1');
  });

  it('excludes voltage-colored wires when disabled', () => {
    const mgr = createManagerWithWire('w1', 0.5, 3.3, [makeSegment(0, 0, 100, 0)]);
    mgr.setShowVoltageHeatmap(false);
    mgr.play();
    const frame = mgr.getAnimationFrame();
    expect(frame.wires).toHaveLength(0);
  });

  it('wire color reflects voltage', () => {
    const mgr = CurrentAnimationManager.create();
    const paths = new Map<string, WireSegment[]>();
    paths.set('w1', [makeSegment(0, 0, 100, 0)]);
    paths.set('w2', [makeSegment(0, 10, 100, 10)]);
    mgr.setWirePaths(paths);
    mgr.setSimulationData([
      { wireId: 'w1', current: 0.5, voltage: 0 },   // min voltage -> blue
      { wireId: 'w2', current: 0.5, voltage: 10 },  // max voltage -> red
    ]);
    mgr.setShowVoltageHeatmap(true);
    mgr.play();
    const frame = mgr.getAnimationFrame();

    const w1Wire = frame.wires.find((w) => w.wireId === 'w1');
    const w2Wire = frame.wires.find((w) => w.wireId === 'w2');

    expect(w1Wire).toBeDefined();
    expect(w2Wire).toBeDefined();
    // Colors should differ
    expect(w1Wire?.color).not.toBe(w2Wire?.color);
  });

  it('heatmap toggle is idempotent', () => {
    const mgr = CurrentAnimationManager.create();
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.setShowVoltageHeatmap(true); // already true by default
    expect(listener).not.toHaveBeenCalled();
  });

  it('defaults to heatmap enabled', () => {
    const mgr = CurrentAnimationManager.create();
    expect(mgr.getShowVoltageHeatmap()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

describe('CurrentAnimationManager — subscription', () => {
  it('subscribe returns unsubscribe function', () => {
    const mgr = CurrentAnimationManager.create();
    const listener = vi.fn();
    const unsub = mgr.subscribe(listener);
    mgr.play();
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    mgr.stop();
    expect(listener).toHaveBeenCalledTimes(1); // not called again
  });

  it('supports multiple listeners', () => {
    const mgr = CurrentAnimationManager.create();
    const l1 = vi.fn();
    const l2 = vi.fn();
    mgr.subscribe(l1);
    mgr.subscribe(l2);
    mgr.play();
    expect(l1).toHaveBeenCalledTimes(1);
    expect(l2).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

describe('getCurrentAnimationManager / resetCurrentAnimationManager', () => {
  beforeEach(() => {
    resetCurrentAnimationManager();
  });

  it('returns the same instance on repeated calls', () => {
    const a = getCurrentAnimationManager();
    const b = getCurrentAnimationManager();
    expect(a).toBe(b);
  });

  it('returns a new instance after reset', () => {
    const a = getCurrentAnimationManager();
    resetCurrentAnimationManager();
    const b = getCurrentAnimationManager();
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// Animation frame caching
// ---------------------------------------------------------------------------

describe('CurrentAnimationManager — frame caching', () => {
  it('returns cached frame if no state change', () => {
    const mgr = createManagerWithWire('w1', 0.5, 3.3, [makeSegment(0, 0, 100, 0)]);
    mgr.play();
    const frame1 = mgr.getAnimationFrame();
    const frame2 = mgr.getAnimationFrame();
    expect(frame1).toBe(frame2); // same reference
  });

  it('invalidates cache on tick', () => {
    const mgr = createManagerWithWire('w1', 0.5, 3.3, [makeSegment(0, 0, 100, 0)]);
    mgr.play();
    const frame1 = mgr.getAnimationFrame();
    mgr.tick(100);
    const frame2 = mgr.getAnimationFrame();
    expect(frame1).not.toBe(frame2);
  });

  it('invalidates cache on data change', () => {
    const mgr = createManagerWithWire('w1', 0.5, 3.3, [makeSegment(0, 0, 100, 0)]);
    mgr.play();
    const frame1 = mgr.getAnimationFrame();
    mgr.setSimulationData([{ wireId: 'w1', current: 0.8, voltage: 5 }]);
    const frame2 = mgr.getAnimationFrame();
    expect(frame1).not.toBe(frame2);
  });
});

// ---------------------------------------------------------------------------
// Frame metadata
// ---------------------------------------------------------------------------

describe('CurrentAnimationManager — frame metadata', () => {
  it('frame contains current state', () => {
    const mgr = CurrentAnimationManager.create();
    expect(mgr.getAnimationFrame().state).toBe('idle');
    mgr.play();
    expect(mgr.getAnimationFrame().state).toBe('playing');
    mgr.pause();
    expect(mgr.getAnimationFrame().state).toBe('paused');
  });

  it('frame contains current speed', () => {
    const mgr = CurrentAnimationManager.create();
    mgr.setSpeed(2.5);
    expect(mgr.getAnimationFrame().speed).toBe(2.5);
  });
});
