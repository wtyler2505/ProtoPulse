/**
 * Tests for SimResultsOverlayManager — static DC operating point result
 * overlay on the schematic canvas.
 *
 * BL-0560
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SimResultsOverlayManager,
  getSimResultsOverlayManager,
  resetSimResultsOverlayManager,
  formatValue,
} from '../sim-results-overlay';
import type {
  ProbeType,
  ProbePoint,
  SimOverlayData,
  ColorMode,
} from '../sim-results-overlay';

// ---------------------------------------------------------------------------
// Result loading and clearing
// ---------------------------------------------------------------------------

describe('SimResultsOverlayManager — result loading', () => {
  let mgr: SimResultsOverlayManager;

  beforeEach(() => {
    mgr = SimResultsOverlayManager.create();
  });

  it('starts with empty overlay data', () => {
    const data = mgr.getOverlayData();
    expect(data.nodeVoltages.size).toBe(0);
    expect(data.branchCurrents.size).toBe(0);
    expect(data.probes).toEqual([]);
    expect(data.visible).toBe(false);
    expect(data.colorMode).toBe('magnitude');
  });

  it('loads voltages and currents via setResults', () => {
    mgr.setResults(
      { n1: 5, n2: 3.3, n0: 0 },
      { R1: 0.01, V1: -0.01 },
    );
    const data = mgr.getOverlayData();
    expect(data.nodeVoltages.get('n1')).toBe(5);
    expect(data.nodeVoltages.get('n2')).toBe(3.3);
    expect(data.nodeVoltages.get('n0')).toBe(0);
    expect(data.branchCurrents.get('R1')).toBe(0.01);
    expect(data.branchCurrents.get('V1')).toBe(-0.01);
  });

  it('replaces previous results on second setResults call', () => {
    mgr.setResults({ n1: 5 }, { R1: 0.01 });
    mgr.setResults({ n2: 3.3 }, { R2: 0.02 });
    const data = mgr.getOverlayData();
    expect(data.nodeVoltages.has('n1')).toBe(false);
    expect(data.nodeVoltages.get('n2')).toBe(3.3);
    expect(data.branchCurrents.has('R1')).toBe(false);
    expect(data.branchCurrents.get('R2')).toBe(0.02);
  });

  it('clearResults empties all data and probes', () => {
    mgr.setResults({ n1: 5 }, { R1: 0.01 });
    mgr.addProbe('n1', 'voltage', { x: 10, y: 20 });
    mgr.clearResults();
    const data = mgr.getOverlayData();
    expect(data.nodeVoltages.size).toBe(0);
    expect(data.branchCurrents.size).toBe(0);
    expect(data.probes).toHaveLength(0);
  });

  it('returns a copy of data — mutations do not affect manager', () => {
    mgr.setResults({ n1: 5 }, {});
    const data = mgr.getOverlayData();
    data.nodeVoltages.set('n99', 99);
    expect(mgr.getOverlayData().nodeVoltages.has('n99')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Probe management
// ---------------------------------------------------------------------------

describe('SimResultsOverlayManager — probes', () => {
  let mgr: SimResultsOverlayManager;

  beforeEach(() => {
    mgr = SimResultsOverlayManager.create();
    mgr.setResults({ n1: 5, n2: 3.3 }, { R1: 0.01 });
  });

  it('addProbe returns a unique probe ID', () => {
    const id1 = mgr.addProbe('n1', 'voltage', { x: 10, y: 20 });
    const id2 = mgr.addProbe('n2', 'voltage', { x: 30, y: 40 });
    expect(id1).not.toBe(id2);
    expect(typeof id1).toBe('string');
    expect(typeof id2).toBe('string');
  });

  it('addProbe creates a probe with correct properties', () => {
    mgr.addProbe('n1', 'voltage', { x: 10, y: 20 });
    const probes = mgr.getOverlayData().probes;
    expect(probes).toHaveLength(1);
    expect(probes[0].nodeId).toBe('n1');
    expect(probes[0].type).toBe('voltage');
    expect(probes[0].position).toEqual({ x: 10, y: 20 });
    expect(probes[0].label).toContain('V');
  });

  it('addProbe for current type creates current probe', () => {
    mgr.addProbe('R1', 'current', { x: 50, y: 60 });
    const probes = mgr.getOverlayData().probes;
    expect(probes).toHaveLength(1);
    expect(probes[0].type).toBe('current');
    expect(probes[0].label).toContain('A');
  });

  it('addProbe with unknown nodeId includes "(no data)" in label', () => {
    mgr.addProbe('unknown_node', 'voltage', { x: 0, y: 0 });
    const probes = mgr.getOverlayData().probes;
    expect(probes[0].label).toContain('no data');
  });

  it('removeProbe removes the specified probe', () => {
    const id1 = mgr.addProbe('n1', 'voltage', { x: 10, y: 20 });
    mgr.addProbe('n2', 'voltage', { x: 30, y: 40 });
    mgr.removeProbe(id1);
    const probes = mgr.getOverlayData().probes;
    expect(probes).toHaveLength(1);
    expect(probes[0].nodeId).toBe('n2');
  });

  it('removeProbe with nonexistent ID does nothing', () => {
    mgr.addProbe('n1', 'voltage', { x: 10, y: 20 });
    mgr.removeProbe('nonexistent');
    expect(mgr.getOverlayData().probes).toHaveLength(1);
  });

  it('removeProbe with nonexistent ID does not notify', () => {
    const listener = vi.fn();
    mgr.subscribe(listener);
    listener.mockClear();
    mgr.removeProbe('nonexistent');
    expect(listener).not.toHaveBeenCalled();
  });

  it('toggleProbe adds probe if none exists for nodeId+type', () => {
    mgr.toggleProbe('n1', 'voltage', { x: 10, y: 20 });
    expect(mgr.getOverlayData().probes).toHaveLength(1);
  });

  it('toggleProbe removes probe if one already exists for nodeId+type', () => {
    mgr.toggleProbe('n1', 'voltage', { x: 10, y: 20 });
    mgr.toggleProbe('n1', 'voltage', { x: 10, y: 20 });
    expect(mgr.getOverlayData().probes).toHaveLength(0);
  });

  it('toggleProbe does not remove a different type on the same node', () => {
    mgr.toggleProbe('n1', 'voltage', { x: 10, y: 20 });
    mgr.toggleProbe('n1', 'current', { x: 10, y: 20 });
    expect(mgr.getOverlayData().probes).toHaveLength(2);
  });

  it('getProbesForNode returns only probes for the given nodeId', () => {
    mgr.addProbe('n1', 'voltage', { x: 10, y: 20 });
    mgr.addProbe('n1', 'current', { x: 10, y: 20 });
    mgr.addProbe('n2', 'voltage', { x: 30, y: 40 });
    const n1Probes = mgr.getProbesForNode('n1');
    expect(n1Probes).toHaveLength(2);
    expect(n1Probes.every((p) => p.nodeId === 'n1')).toBe(true);
  });

  it('getProbesForNode returns empty array for unknown nodeId', () => {
    expect(mgr.getProbesForNode('unknown')).toEqual([]);
  });

  it('multiple probes on different nodes are independent', () => {
    mgr.addProbe('n1', 'voltage', { x: 10, y: 20 });
    mgr.addProbe('n2', 'voltage', { x: 30, y: 40 });
    const id3 = mgr.addProbe('n1', 'current', { x: 15, y: 25 });
    mgr.removeProbe(id3);
    expect(mgr.getProbesForNode('n1')).toHaveLength(1);
    expect(mgr.getProbesForNode('n2')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Visibility
// ---------------------------------------------------------------------------

describe('SimResultsOverlayManager — visibility', () => {
  let mgr: SimResultsOverlayManager;

  beforeEach(() => {
    mgr = SimResultsOverlayManager.create();
  });

  it('starts not visible', () => {
    expect(mgr.getOverlayData().visible).toBe(false);
  });

  it('setVisible(true) makes overlay visible', () => {
    mgr.setVisible(true);
    expect(mgr.getOverlayData().visible).toBe(true);
  });

  it('setVisible(false) hides overlay', () => {
    mgr.setVisible(true);
    mgr.setVisible(false);
    expect(mgr.getOverlayData().visible).toBe(false);
  });

  it('setVisible with same value does not notify', () => {
    const listener = vi.fn();
    mgr.subscribe(listener);
    listener.mockClear();
    mgr.setVisible(false); // already false
    expect(listener).not.toHaveBeenCalled();
  });

  it('toggleVisible flips from false to true', () => {
    mgr.toggleVisible();
    expect(mgr.getOverlayData().visible).toBe(true);
  });

  it('toggleVisible flips from true to false', () => {
    mgr.setVisible(true);
    mgr.toggleVisible();
    expect(mgr.getOverlayData().visible).toBe(false);
  });

  it('double toggleVisible returns to original', () => {
    mgr.toggleVisible();
    mgr.toggleVisible();
    expect(mgr.getOverlayData().visible).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Color mode
// ---------------------------------------------------------------------------

describe('SimResultsOverlayManager — color mode', () => {
  let mgr: SimResultsOverlayManager;

  beforeEach(() => {
    mgr = SimResultsOverlayManager.create();
  });

  it('starts in magnitude mode', () => {
    expect(mgr.getOverlayData().colorMode).toBe('magnitude');
  });

  it('setColorMode changes mode', () => {
    mgr.setColorMode('polarity');
    expect(mgr.getOverlayData().colorMode).toBe('polarity');
  });

  it('setColorMode with same value does not notify', () => {
    const listener = vi.fn();
    mgr.subscribe(listener);
    listener.mockClear();
    mgr.setColorMode('magnitude'); // already magnitude
    expect(listener).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Voltage color gradients
// ---------------------------------------------------------------------------

describe('SimResultsOverlayManager — getVoltageColor', () => {
  it('returns gray for 0V', () => {
    const mgr = SimResultsOverlayManager.create();
    const color = mgr.getVoltageColor(0);
    expect(color).toContain('hsl');
    expect(color).toContain('0%'); // 0% saturation → gray
  });

  it('returns cyan-ish for low positive voltage in magnitude mode', () => {
    const mgr = SimResultsOverlayManager.create();
    mgr.setColorMode('magnitude');
    const color = mgr.getVoltageColor(0.001);
    expect(color).toMatch(/^hsl\(\d+/);
    // Should be in the cyan range (120-180)
    const hue = parseInt(color.match(/hsl\((\d+)/)?.[1] ?? '0', 10);
    expect(hue).toBeGreaterThanOrEqual(60);
    expect(hue).toBeLessThanOrEqual(180);
  });

  it('returns red-ish for high positive voltage in magnitude mode', () => {
    const mgr = SimResultsOverlayManager.create();
    mgr.setColorMode('magnitude');
    const color = mgr.getVoltageColor(100);
    const hue = parseInt(color.match(/hsl\((\d+)/)?.[1] ?? '999', 10);
    expect(hue).toBeLessThanOrEqual(60);
  });

  it('magnitude mode treats negative voltage same as positive', () => {
    const mgr = SimResultsOverlayManager.create();
    mgr.setColorMode('magnitude');
    const colorPos = mgr.getVoltageColor(5);
    const colorNeg = mgr.getVoltageColor(-5);
    expect(colorPos).toBe(colorNeg);
  });

  it('polarity mode returns blue for negative voltage', () => {
    const mgr = SimResultsOverlayManager.create();
    mgr.setColorMode('polarity');
    const color = mgr.getVoltageColor(-5);
    const hue = parseInt(color.match(/hsl\((\d+)/)?.[1] ?? '0', 10);
    expect(hue).toBeGreaterThanOrEqual(200);
    expect(hue).toBeLessThanOrEqual(250);
  });

  it('polarity mode returns warm colors for positive voltage', () => {
    const mgr = SimResultsOverlayManager.create();
    mgr.setColorMode('polarity');
    const color = mgr.getVoltageColor(5);
    const hue = parseInt(color.match(/hsl\((\d+)/)?.[1] ?? '999', 10);
    expect(hue).toBeLessThanOrEqual(180);
  });

  it('polarity mode returns gray for 0V', () => {
    const mgr = SimResultsOverlayManager.create();
    mgr.setColorMode('polarity');
    expect(mgr.getVoltageColor(0)).toContain('0%');
  });

  it('higher voltage produces lower hue (warmer color)', () => {
    const mgr = SimResultsOverlayManager.create();
    mgr.setColorMode('magnitude');
    const colorLow = mgr.getVoltageColor(0.1);
    const colorHigh = mgr.getVoltageColor(10);
    const hueLow = parseInt(colorLow.match(/hsl\((\d+)/)?.[1] ?? '0', 10);
    const hueHigh = parseInt(colorHigh.match(/hsl\((\d+)/)?.[1] ?? '0', 10);
    expect(hueLow).toBeGreaterThan(hueHigh);
  });
});

// ---------------------------------------------------------------------------
// Current color gradients
// ---------------------------------------------------------------------------

describe('SimResultsOverlayManager — getCurrentColor', () => {
  let mgr: SimResultsOverlayManager;

  beforeEach(() => {
    mgr = SimResultsOverlayManager.create();
  });

  it('returns gray for 0A', () => {
    const color = mgr.getCurrentColor(0);
    expect(color).toContain('0%'); // gray
  });

  it('returns green-ish for very small current', () => {
    const color = mgr.getCurrentColor(0.000001); // 1µA
    const hue = parseInt(color.match(/hsl\((\d+)/)?.[1] ?? '0', 10);
    expect(hue).toBeGreaterThanOrEqual(60);
    expect(hue).toBeLessThanOrEqual(120);
  });

  it('returns orange-ish for high current', () => {
    const color = mgr.getCurrentColor(2);
    const hue = parseInt(color.match(/hsl\((\d+)/)?.[1] ?? '999', 10);
    expect(hue).toBeLessThanOrEqual(60);
  });

  it('uses absolute value — sign does not affect color', () => {
    const colorPos = mgr.getCurrentColor(0.5);
    const colorNeg = mgr.getCurrentColor(-0.5);
    expect(colorPos).toBe(colorNeg);
  });

  it('higher current produces lower hue (warmer color)', () => {
    const colorLow = mgr.getCurrentColor(0.001);
    const colorHigh = mgr.getCurrentColor(1);
    const hueLow = parseInt(colorLow.match(/hsl\((\d+)/)?.[1] ?? '0', 10);
    const hueHigh = parseInt(colorHigh.match(/hsl\((\d+)/)?.[1] ?? '0', 10);
    expect(hueLow).toBeGreaterThan(hueHigh);
  });
});

// ---------------------------------------------------------------------------
// Current arrow direction
// ---------------------------------------------------------------------------

describe('SimResultsOverlayManager — getCurrentArrowDirection', () => {
  let mgr: SimResultsOverlayManager;

  beforeEach(() => {
    mgr = SimResultsOverlayManager.create();
  });

  it('positive current → forward', () => {
    expect(mgr.getCurrentArrowDirection(0.5)).toBe('forward');
  });

  it('negative current → reverse', () => {
    expect(mgr.getCurrentArrowDirection(-0.5)).toBe('reverse');
  });

  it('zero current → forward (convention)', () => {
    expect(mgr.getCurrentArrowDirection(0)).toBe('forward');
  });

  it('very small positive current → forward', () => {
    expect(mgr.getCurrentArrowDirection(1e-12)).toBe('forward');
  });

  it('very small negative current → reverse', () => {
    expect(mgr.getCurrentArrowDirection(-1e-12)).toBe('reverse');
  });
});

// ---------------------------------------------------------------------------
// SI prefix formatting
// ---------------------------------------------------------------------------

describe('formatValue', () => {
  it('formats 0 V', () => {
    expect(formatValue(0, 'V')).toBe('0 V');
  });

  it('formats 0 A', () => {
    expect(formatValue(0, 'A')).toBe('0 A');
  });

  it('formats 3.3 V', () => {
    expect(formatValue(3.3, 'V')).toBe('3.300 V');
  });

  it('formats 5 V', () => {
    expect(formatValue(5, 'V')).toBe('5.000 V');
  });

  it('formats millivolts', () => {
    expect(formatValue(0.5, 'V')).toBe('500.0 mV');
  });

  it('formats microamps', () => {
    expect(formatValue(0.000015, 'A')).toBe('15.00 \u00B5A');
  });

  it('formats milliamps', () => {
    expect(formatValue(0.0047, 'A')).toBe('4.700 mA');
  });

  it('formats kilovolts', () => {
    expect(formatValue(1500, 'V')).toBe('1.500 kV');
  });

  it('formats nanoamps', () => {
    expect(formatValue(0.0000000025, 'A')).toBe('2.500 nA');
  });

  it('formats picoamps', () => {
    expect(formatValue(0.000000000003, 'A')).toBe('3.000 pA');
  });

  it('formats negative voltage', () => {
    const result = formatValue(-3.3, 'V');
    expect(result).toBe('-3.300 V');
  });

  it('formats negative milliamps', () => {
    const result = formatValue(-0.015, 'A');
    expect(result).toBe('-15.00 mA');
  });

  it('formats very large voltage in megavolts', () => {
    expect(formatValue(2500000, 'V')).toBe('2.500 MV');
  });

  it('formats very small value with exponential notation', () => {
    const result = formatValue(1e-16, 'A');
    expect(result).toContain('e');
    expect(result).toContain('A');
  });

  it('formats exactly 1V', () => {
    expect(formatValue(1, 'V')).toBe('1.000 V');
  });

  it('formats exactly 1A', () => {
    expect(formatValue(1, 'A')).toBe('1.000 A');
  });

  it('formats 12V (common supply)', () => {
    expect(formatValue(12, 'V')).toBe('12.00 V');
  });

  it('formats 100mA', () => {
    expect(formatValue(0.1, 'A')).toBe('100.0 mA');
  });
});

// ---------------------------------------------------------------------------
// Subscription and snapshot
// ---------------------------------------------------------------------------

describe('SimResultsOverlayManager — subscribe/getSnapshot', () => {
  let mgr: SimResultsOverlayManager;

  beforeEach(() => {
    mgr = SimResultsOverlayManager.create();
  });

  it('subscribe returns an unsubscribe function', () => {
    const unsub = mgr.subscribe(vi.fn());
    expect(typeof unsub).toBe('function');
  });

  it('listener is called on setResults', () => {
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.setResults({ n1: 5 }, {});
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('listener is called on clearResults', () => {
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.clearResults();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('listener is called on addProbe', () => {
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.addProbe('n1', 'voltage', { x: 0, y: 0 });
    expect(listener).toHaveBeenCalled();
  });

  it('listener is called on removeProbe', () => {
    const id = mgr.addProbe('n1', 'voltage', { x: 0, y: 0 });
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.removeProbe(id);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('listener is called on toggleVisible', () => {
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.toggleVisible();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('listener is called on setColorMode change', () => {
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.setColorMode('polarity');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe prevents further notifications', () => {
    const listener = vi.fn();
    const unsub = mgr.subscribe(listener);
    unsub();
    mgr.setResults({ n1: 5 }, {});
    expect(listener).not.toHaveBeenCalled();
  });

  it('getSnapshot version increments on each mutation', () => {
    const v0 = mgr.getSnapshot();
    mgr.setResults({ n1: 5 }, {});
    const v1 = mgr.getSnapshot();
    mgr.toggleVisible();
    const v2 = mgr.getSnapshot();
    expect(v1).toBeGreaterThan(v0);
    expect(v2).toBeGreaterThan(v1);
  });

  it('getSnapshot does not change without mutations', () => {
    const v0 = mgr.getSnapshot();
    const v1 = mgr.getSnapshot();
    expect(v0).toBe(v1);
  });

  it('multiple listeners are all notified', () => {
    const l1 = vi.fn();
    const l2 = vi.fn();
    mgr.subscribe(l1);
    mgr.subscribe(l2);
    mgr.setResults({}, {});
    expect(l1).toHaveBeenCalledTimes(1);
    expect(l2).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

describe('SimResultsOverlayManager — singleton', () => {
  beforeEach(() => {
    resetSimResultsOverlayManager();
  });

  it('getSimResultsOverlayManager returns the same instance', () => {
    const a = getSimResultsOverlayManager();
    const b = getSimResultsOverlayManager();
    expect(a).toBe(b);
  });

  it('resetSimResultsOverlayManager creates a new instance', () => {
    const a = getSimResultsOverlayManager();
    resetSimResultsOverlayManager();
    const b = getSimResultsOverlayManager();
    expect(a).not.toBe(b);
  });

  it('singleton state is independent after reset', () => {
    const a = getSimResultsOverlayManager();
    a.setResults({ n1: 5 }, {});
    a.setVisible(true);
    resetSimResultsOverlayManager();
    const b = getSimResultsOverlayManager();
    expect(b.getOverlayData().visible).toBe(false);
    expect(b.getOverlayData().nodeVoltages.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('SimResultsOverlayManager — edge cases', () => {
  let mgr: SimResultsOverlayManager;

  beforeEach(() => {
    mgr = SimResultsOverlayManager.create();
  });

  it('setResults with empty objects is valid', () => {
    mgr.setResults({}, {});
    const data = mgr.getOverlayData();
    expect(data.nodeVoltages.size).toBe(0);
    expect(data.branchCurrents.size).toBe(0);
  });

  it('addProbe with no simulation data uses fallback label', () => {
    mgr.addProbe('n1', 'voltage', { x: 0, y: 0 });
    expect(mgr.getOverlayData().probes[0].label).toContain('no data');
  });

  it('getVoltageColor handles very large voltage', () => {
    const color = mgr.getVoltageColor(1000000);
    expect(color).toMatch(/^hsl\(/);
  });

  it('getVoltageColor handles very small positive voltage', () => {
    const color = mgr.getVoltageColor(1e-15);
    expect(color).toMatch(/^hsl\(/);
  });

  it('getCurrentColor handles very large current', () => {
    const color = mgr.getCurrentColor(1000);
    expect(color).toMatch(/^hsl\(/);
  });

  it('getCurrentColor handles very small current', () => {
    const color = mgr.getCurrentColor(1e-15);
    expect(color).toMatch(/^hsl\(/);
  });

  it('probes array is a copy — external push does not affect manager', () => {
    mgr.addProbe('n1', 'voltage', { x: 0, y: 0 });
    const probes = mgr.getOverlayData().probes;
    probes.push({ id: 'fake', type: 'voltage', nodeId: 'fake', label: 'fake', position: { x: 0, y: 0 } });
    expect(mgr.getOverlayData().probes).toHaveLength(1);
  });

  it('clearResults then addProbe works correctly', () => {
    mgr.setResults({ n1: 5 }, {});
    mgr.clearResults();
    mgr.addProbe('n1', 'voltage', { x: 0, y: 0 });
    expect(mgr.getOverlayData().probes).toHaveLength(1);
    expect(mgr.getOverlayData().probes[0].label).toContain('no data');
  });
});
