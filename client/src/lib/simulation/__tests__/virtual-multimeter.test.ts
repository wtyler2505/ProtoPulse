import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  VirtualMultimeter,
  getVirtualMultimeter,
  resetVirtualMultimeter,
  autoSelectRange,
  computeRMS,
  getRangesForMode,
  getBaseUnit,
} from '../virtual-multimeter';
import type {
  MultimeterMode,
  MultimeterSimulationState,
} from '../virtual-multimeter';
import type { DCResult, TransientResult } from '../circuit-solver';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a simple DC result with node voltages and branch currents. */
function makeDCResult(
  nodeVoltages: Record<number, number>,
  branchCurrents: Record<string, number> = {},
): DCResult {
  return {
    nodeVoltages,
    branchCurrents,
    converged: true,
    iterations: 1,
  };
}

/** Create a transient result with waveforms. */
function makeTransientResult(
  timePoints: number[],
  nodeVoltages: Record<number, number[]>,
  branchCurrents: Record<string, number[]> = {},
): TransientResult {
  return {
    timePoints,
    nodeVoltages,
    branchCurrents,
    converged: true,
  };
}

describe('VirtualMultimeter', () => {
  let meter: VirtualMultimeter;

  beforeEach(() => {
    resetVirtualMultimeter();
    meter = new VirtualMultimeter();
  });

  // -------------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------------

  describe('initialization', () => {
    it('starts in DC_VOLTAGE mode', () => {
      expect(meter.getMode()).toBe('DC_VOLTAGE');
    });

    it('starts with no probes connected', () => {
      const state = meter.getState();
      expect(state.positiveProbe).toBeNull();
      expect(state.negativeProbe).toBeNull();
    });

    it('starts with auto-range enabled', () => {
      expect(meter.isAutoRange()).toBe(true);
    });

    it('starts with an invalid reading', () => {
      const reading = meter.getReading();
      expect(reading.valid).toBe(false);
      expect(reading.rawValue).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Mode switching
  // -------------------------------------------------------------------------

  describe('mode switching', () => {
    it('switches to AC_VOLTAGE mode', () => {
      meter.setMode('AC_VOLTAGE');
      expect(meter.getMode()).toBe('AC_VOLTAGE');
    });

    it('switches to DC_CURRENT mode', () => {
      meter.setMode('DC_CURRENT');
      expect(meter.getMode()).toBe('DC_CURRENT');
    });

    it('switches to AC_CURRENT mode', () => {
      meter.setMode('AC_CURRENT');
      expect(meter.getMode()).toBe('AC_CURRENT');
    });

    it('switches to RESISTANCE mode', () => {
      meter.setMode('RESISTANCE');
      expect(meter.getMode()).toBe('RESISTANCE');
    });

    it('invalidates reading when mode changes', () => {
      meter.connectPositiveProbe('1');
      meter.connectNegativeProbe('0');
      const dc = makeDCResult({ 0: 0, 1: 5 });
      meter.measure({ dc });
      expect(meter.getReading().valid).toBe(true);

      meter.setMode('AC_VOLTAGE');
      expect(meter.getReading().valid).toBe(false);
    });

    it('does not notify if mode is unchanged', () => {
      const listener = vi.fn();
      meter.subscribe(listener);
      listener.mockClear();

      meter.setMode('DC_VOLTAGE'); // already DC_VOLTAGE
      expect(listener).not.toHaveBeenCalled();
    });

    it('resets range index when switching modes', () => {
      meter.setRangeIndex(4);
      expect(meter.getState().rangeIndex).toBe(4);

      meter.setMode('RESISTANCE');
      // Should be clamped to a sensible default (1 or 0)
      expect(meter.getState().rangeIndex).toBeLessThanOrEqual(1);
    });
  });

  // -------------------------------------------------------------------------
  // Probe connections
  // -------------------------------------------------------------------------

  describe('probe connections', () => {
    it('connects positive probe', () => {
      meter.connectPositiveProbe('1');
      expect(meter.getState().positiveProbe?.nodeId).toBe('1');
    });

    it('connects negative probe', () => {
      meter.connectNegativeProbe('0');
      expect(meter.getState().negativeProbe?.nodeId).toBe('0');
    });

    it('disconnects positive probe and invalidates reading', () => {
      meter.connectPositiveProbe('1');
      meter.connectNegativeProbe('0');
      meter.measure({ dc: makeDCResult({ 0: 0, 1: 5 }) });
      expect(meter.getReading().valid).toBe(true);

      meter.disconnectPositiveProbe();
      expect(meter.getState().positiveProbe).toBeNull();
      expect(meter.getReading().valid).toBe(false);
    });

    it('disconnects negative probe and invalidates reading', () => {
      meter.connectPositiveProbe('1');
      meter.connectNegativeProbe('0');
      meter.measure({ dc: makeDCResult({ 0: 0, 1: 5 }) });

      meter.disconnectNegativeProbe();
      expect(meter.getState().negativeProbe).toBeNull();
      expect(meter.getReading().valid).toBe(false);
    });

    it('disconnects all probes', () => {
      meter.connectPositiveProbe('1');
      meter.connectNegativeProbe('0');
      meter.disconnectAllProbes();
      expect(meter.getState().positiveProbe).toBeNull();
      expect(meter.getState().negativeProbe).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // DC Voltage measurement
  // -------------------------------------------------------------------------

  describe('DC voltage measurement', () => {
    it('measures voltage across two nodes', () => {
      meter.connectPositiveProbe('2');
      meter.connectNegativeProbe('0');
      const dc = makeDCResult({ 0: 0, 1: 12, 2: 5 });
      const reading = meter.measure({ dc });

      expect(reading.valid).toBe(true);
      expect(reading.rawValue).toBe(5);
      expect(reading.overloaded).toBe(false);
    });

    it('measures negative voltage (polarity)', () => {
      meter.connectPositiveProbe('0');
      meter.connectNegativeProbe('1');
      const dc = makeDCResult({ 0: 0, 1: 3.3 });
      const reading = meter.measure({ dc });

      expect(reading.valid).toBe(true);
      expect(reading.rawValue).toBeCloseTo(-3.3);
    });

    it('measures resistor divider correctly', () => {
      // 12V source, two equal resistors → mid-point at 6V
      meter.connectPositiveProbe('2');
      meter.connectNegativeProbe('0');
      const dc = makeDCResult({ 0: 0, 1: 12, 2: 6 });
      const reading = meter.measure({ dc });

      expect(reading.valid).toBe(true);
      expect(reading.rawValue).toBeCloseTo(6);
    });

    it('returns 0V when both probes on same node', () => {
      meter.connectPositiveProbe('1');
      meter.connectNegativeProbe('1');
      const dc = makeDCResult({ 0: 0, 1: 5 });
      const reading = meter.measure({ dc });

      expect(reading.valid).toBe(true);
      expect(reading.rawValue).toBe(0);
    });

    it('returns invalid when no DC data available', () => {
      meter.connectPositiveProbe('1');
      meter.connectNegativeProbe('0');
      const reading = meter.measure({});

      expect(reading.valid).toBe(false);
    });

    it('returns invalid when node not in results', () => {
      meter.connectPositiveProbe('99');
      meter.connectNegativeProbe('0');
      const dc = makeDCResult({ 0: 0, 1: 5 });
      const reading = meter.measure({ dc });

      expect(reading.valid).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // AC Voltage measurement
  // -------------------------------------------------------------------------

  describe('AC voltage measurement', () => {
    it('measures RMS of a sinusoidal waveform', () => {
      meter.setMode('AC_VOLTAGE');
      meter.connectPositiveProbe('1');
      meter.connectNegativeProbe('0');

      // Generate a sine wave: Vpeak = 1V → Vrms = 1/√2 ≈ 0.7071
      const numPoints = 1000;
      const timePoints: number[] = [];
      const node1Voltages: number[] = [];
      const node0Voltages: number[] = [];

      for (let i = 0; i < numPoints; i++) {
        const t = (i / numPoints) * 0.001; // 1ms, one full cycle at 1kHz
        timePoints.push(t);
        node1Voltages.push(Math.sin(2 * Math.PI * 1000 * t));
        node0Voltages.push(0);
      }

      const transient = makeTransientResult(
        timePoints,
        { 0: node0Voltages, 1: node1Voltages },
      );

      const reading = meter.measure({ transient });
      expect(reading.valid).toBe(true);
      expect(reading.rawValue).toBeCloseTo(1 / Math.sqrt(2), 2);
    });

    it('returns invalid when no transient data available', () => {
      meter.setMode('AC_VOLTAGE');
      meter.connectPositiveProbe('1');
      meter.connectNegativeProbe('0');
      const reading = meter.measure({});

      expect(reading.valid).toBe(false);
    });

    it('handles DC offset in AC measurement (RMS includes DC)', () => {
      meter.setMode('AC_VOLTAGE');
      meter.connectPositiveProbe('1');
      meter.connectNegativeProbe('0');

      // DC offset of 5V
      const timePoints = [0, 0.001, 0.002];
      const transient = makeTransientResult(
        timePoints,
        { 0: [0, 0, 0], 1: [5, 5, 5] },
      );

      const reading = meter.measure({ transient });
      expect(reading.valid).toBe(true);
      expect(reading.rawValue).toBeCloseTo(5, 1);
    });
  });

  // -------------------------------------------------------------------------
  // DC Current measurement
  // -------------------------------------------------------------------------

  describe('DC current measurement', () => {
    it('measures current through a branch component', () => {
      meter.setMode('DC_CURRENT');
      meter.connectPositiveProbe('1');
      meter.connectNegativeProbe('0');

      const dc = makeDCResult(
        { 0: 0, 1: 5 },
        { R1: 0.025 }, // 25mA
      );

      const reading = meter.measure({ dc, branchComponentId: 'R1' });
      expect(reading.valid).toBe(true);
      expect(reading.rawValue).toBeCloseTo(0.025);
    });

    it('returns invalid without branchComponentId', () => {
      meter.setMode('DC_CURRENT');
      meter.connectPositiveProbe('1');
      meter.connectNegativeProbe('0');

      const dc = makeDCResult({ 0: 0, 1: 5 }, { R1: 0.025 });
      const reading = meter.measure({ dc });
      expect(reading.valid).toBe(false);
    });

    it('returns invalid when branch component not in results', () => {
      meter.setMode('DC_CURRENT');
      meter.connectPositiveProbe('1');
      meter.connectNegativeProbe('0');

      const dc = makeDCResult({ 0: 0, 1: 5 }, {});
      const reading = meter.measure({ dc, branchComponentId: 'R_missing' });
      expect(reading.valid).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // AC Current measurement
  // -------------------------------------------------------------------------

  describe('AC current measurement', () => {
    it('measures RMS current from transient data', () => {
      meter.setMode('AC_CURRENT');
      meter.connectPositiveProbe('1');
      meter.connectNegativeProbe('0');

      // Sinusoidal current: Ipeak = 0.1A → Irms = 0.1/√2
      const numPoints = 1000;
      const timePoints: number[] = [];
      const currentWaveform: number[] = [];

      for (let i = 0; i < numPoints; i++) {
        const t = (i / numPoints) * 0.001;
        timePoints.push(t);
        currentWaveform.push(0.1 * Math.sin(2 * Math.PI * 1000 * t));
      }

      const transient = makeTransientResult(
        timePoints,
        { 0: new Array(numPoints).fill(0) as number[], 1: new Array(numPoints).fill(0) as number[] },
        { R1: currentWaveform },
      );

      const reading = meter.measure({ transient, branchComponentId: 'R1' });
      expect(reading.valid).toBe(true);
      expect(reading.rawValue).toBeCloseTo(0.1 / Math.sqrt(2), 2);
    });

    it('returns invalid without branchComponentId', () => {
      meter.setMode('AC_CURRENT');
      meter.connectPositiveProbe('1');
      meter.connectNegativeProbe('0');

      const transient = makeTransientResult(
        [0, 0.001],
        { 0: [0, 0], 1: [0, 0] },
        { R1: [0.01, 0.01] },
      );

      const reading = meter.measure({ transient });
      expect(reading.valid).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Resistance measurement
  // -------------------------------------------------------------------------

  describe('resistance measurement', () => {
    it('measures resistance as V/I ratio', () => {
      meter.setMode('RESISTANCE');
      meter.connectPositiveProbe('1');
      meter.connectNegativeProbe('0');

      // 5V across, 0.005A through → 1000 Ohm
      const dc = makeDCResult(
        { 0: 0, 1: 5 },
        { R1: 0.005 },
      );

      const reading = meter.measure({ dc, branchComponentId: 'R1' });
      expect(reading.valid).toBe(true);
      expect(reading.rawValue).toBeCloseTo(1000);
    });

    it('measures small resistance', () => {
      meter.setMode('RESISTANCE');
      meter.connectPositiveProbe('1');
      meter.connectNegativeProbe('0');

      // 0.1V across, 1A through → 0.1 Ohm
      const dc = makeDCResult(
        { 0: 0, 1: 0.1 },
        { R1: 1 },
      );

      const reading = meter.measure({ dc, branchComponentId: 'R1' });
      expect(reading.valid).toBe(true);
      expect(reading.rawValue).toBeCloseTo(0.1);
    });

    it('returns invalid when current is essentially zero', () => {
      meter.setMode('RESISTANCE');
      meter.connectPositiveProbe('1');
      meter.connectNegativeProbe('0');

      const dc = makeDCResult(
        { 0: 0, 1: 5 },
        { R1: 0 }, // zero current → open circuit
      );

      const reading = meter.measure({ dc, branchComponentId: 'R1' });
      expect(reading.valid).toBe(false);
    });

    it('returns invalid without branch component', () => {
      meter.setMode('RESISTANCE');
      meter.connectPositiveProbe('1');
      meter.connectNegativeProbe('0');

      const dc = makeDCResult({ 0: 0, 1: 5 });
      const reading = meter.measure({ dc });
      expect(reading.valid).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Auto-ranging
  // -------------------------------------------------------------------------

  describe('auto-ranging', () => {
    it('selects mV range for small voltages', () => {
      meter.connectPositiveProbe('1');
      meter.connectNegativeProbe('0');

      const dc = makeDCResult({ 0: 0, 1: 0.05 }); // 50mV
      meter.measure({ dc });

      const reading = meter.getReading();
      expect(reading.valid).toBe(true);
      expect(reading.displayUnit).toBe('mV');
      expect(reading.displayValue).toBeCloseTo(50);
    });

    it('selects V range for medium voltages', () => {
      meter.connectPositiveProbe('1');
      meter.connectNegativeProbe('0');

      const dc = makeDCResult({ 0: 0, 1: 3.3 });
      meter.measure({ dc });

      const reading = meter.getReading();
      expect(reading.valid).toBe(true);
      expect(reading.displayUnit).toBe('V');
      expect(reading.displayValue).toBeCloseTo(3.3);
    });

    it('selects kV range for large voltages', () => {
      meter.connectPositiveProbe('1');
      meter.connectNegativeProbe('0');

      const dc = makeDCResult({ 0: 0, 1: 500 });
      meter.measure({ dc });

      const reading = meter.getReading();
      expect(reading.valid).toBe(true);
      expect(reading.displayUnit).toBe('kV');
      expect(reading.displayValue).toBeCloseTo(0.5);
    });

    it('selects uA range for tiny currents', () => {
      meter.setMode('DC_CURRENT');
      meter.connectPositiveProbe('1');
      meter.connectNegativeProbe('0');

      const dc = makeDCResult({ 0: 0, 1: 5 }, { R1: 0.00005 }); // 50uA
      meter.measure({ dc, branchComponentId: 'R1' });

      const reading = meter.getReading();
      expect(reading.valid).toBe(true);
      expect(reading.displayUnit).toBe('\u00B5A');
      expect(reading.displayValue).toBeCloseTo(50);
    });

    it('selects mA range for milliamp currents', () => {
      meter.setMode('DC_CURRENT');
      meter.connectPositiveProbe('1');
      meter.connectNegativeProbe('0');

      const dc = makeDCResult({ 0: 0, 1: 5 }, { R1: 0.015 }); // 15mA
      meter.measure({ dc, branchComponentId: 'R1' });

      const reading = meter.getReading();
      expect(reading.valid).toBe(true);
      expect(reading.displayUnit).toBe('mA');
      expect(reading.displayValue).toBeCloseTo(15);
    });

    it('selects kOhm range for kilohm resistance', () => {
      meter.setMode('RESISTANCE');
      meter.connectPositiveProbe('1');
      meter.connectNegativeProbe('0');

      // 10V / 0.001A = 10kOhm
      const dc = makeDCResult({ 0: 0, 1: 10 }, { R1: 0.001 });
      meter.measure({ dc, branchComponentId: 'R1' });

      const reading = meter.getReading();
      expect(reading.valid).toBe(true);
      expect(reading.displayUnit).toBe('k\u03A9');
      expect(reading.displayValue).toBeCloseTo(10);
    });

    it('selects MOhm range for megohm resistance', () => {
      meter.setMode('RESISTANCE');
      meter.connectPositiveProbe('1');
      meter.connectNegativeProbe('0');

      // 5V / 0.000001A = 5MOhm
      const dc = makeDCResult({ 0: 0, 1: 5 }, { R1: 0.000001 });
      meter.measure({ dc, branchComponentId: 'R1' });

      const reading = meter.getReading();
      expect(reading.valid).toBe(true);
      expect(reading.displayUnit).toBe('M\u03A9');
      expect(reading.displayValue).toBeCloseTo(5);
    });
  });

  // -------------------------------------------------------------------------
  // Overload detection
  // -------------------------------------------------------------------------

  describe('overload detection', () => {
    it('detects voltage overload beyond 1000V', () => {
      meter.connectPositiveProbe('1');
      meter.connectNegativeProbe('0');

      const dc = makeDCResult({ 0: 0, 1: 1500 });
      const reading = meter.measure({ dc });

      expect(reading.valid).toBe(true);
      expect(reading.overloaded).toBe(true);
    });

    it('does not overload at maximum range', () => {
      meter.connectPositiveProbe('1');
      meter.connectNegativeProbe('0');

      const dc = makeDCResult({ 0: 0, 1: 999 });
      const reading = meter.measure({ dc });

      expect(reading.valid).toBe(true);
      expect(reading.overloaded).toBe(false);
    });

    it('detects overload in manual range mode', () => {
      meter.setAutoRange(false);
      meter.setRangeIndex(0); // 200mV range
      meter.connectPositiveProbe('1');
      meter.connectNegativeProbe('0');

      const dc = makeDCResult({ 0: 0, 1: 5 }); // 5V on 200mV range
      const reading = meter.measure({ dc });

      expect(reading.valid).toBe(true);
      expect(reading.overloaded).toBe(true);
    });

    it('shows displayValue as 0 when overloaded', () => {
      meter.connectPositiveProbe('1');
      meter.connectNegativeProbe('0');

      const dc = makeDCResult({ 0: 0, 1: 1500 });
      const reading = meter.measure({ dc });

      expect(reading.overloaded).toBe(true);
      expect(reading.displayValue).toBe(0);
    });

    it('detects current overload beyond 10A', () => {
      meter.setMode('DC_CURRENT');
      meter.connectPositiveProbe('1');
      meter.connectNegativeProbe('0');

      const dc = makeDCResult({ 0: 0, 1: 5 }, { R1: 15 }); // 15A
      const reading = meter.measure({ dc, branchComponentId: 'R1' });

      expect(reading.valid).toBe(true);
      expect(reading.overloaded).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Manual range control
  // -------------------------------------------------------------------------

  describe('manual range control', () => {
    it('disables auto-range when setting range manually', () => {
      expect(meter.isAutoRange()).toBe(true);
      meter.setRangeIndex(2);
      expect(meter.isAutoRange()).toBe(false);
    });

    it('steps range up', () => {
      meter.setRangeIndex(1);
      const initialIndex = meter.getState().rangeIndex;
      meter.rangeUp();
      expect(meter.getState().rangeIndex).toBe(initialIndex + 1);
    });

    it('steps range down', () => {
      meter.setRangeIndex(2);
      meter.rangeDown();
      expect(meter.getState().rangeIndex).toBe(1);
    });

    it('does not go below range 0', () => {
      meter.setRangeIndex(0);
      meter.rangeDown();
      expect(meter.getState().rangeIndex).toBe(0);
    });

    it('does not go above max range', () => {
      const ranges = getRangesForMode('DC_VOLTAGE');
      meter.setRangeIndex(ranges.length - 1);
      meter.rangeUp();
      expect(meter.getState().rangeIndex).toBe(ranges.length - 1);
    });

    it('ignores invalid range index', () => {
      meter.setRangeIndex(100);
      // Should not have changed to 100
      expect(meter.getState().rangeIndex).toBeLessThan(100);
    });

    it('re-enables auto-range', () => {
      meter.setRangeIndex(2);
      expect(meter.isAutoRange()).toBe(false);
      meter.setAutoRange(true);
      expect(meter.isAutoRange()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Subscribe / notify
  // -------------------------------------------------------------------------

  describe('subscribe and notify', () => {
    it('notifies on mode change', () => {
      const listener = vi.fn();
      meter.subscribe(listener);
      meter.setMode('AC_VOLTAGE');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies on probe connect', () => {
      const listener = vi.fn();
      meter.subscribe(listener);
      meter.connectPositiveProbe('1');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies on measurement', () => {
      const listener = vi.fn();
      meter.connectPositiveProbe('1');
      meter.connectNegativeProbe('0');
      meter.subscribe(listener);

      meter.measure({ dc: makeDCResult({ 0: 0, 1: 5 }) });
      expect(listener).toHaveBeenCalled();
    });

    it('unsubscribes correctly', () => {
      const listener = vi.fn();
      const unsub = meter.subscribe(listener);
      meter.setMode('AC_VOLTAGE');
      expect(listener).toHaveBeenCalledTimes(1);

      unsub();
      meter.setMode('DC_CURRENT');
      expect(listener).toHaveBeenCalledTimes(1); // no additional calls
    });
  });

  // -------------------------------------------------------------------------
  // Singleton
  // -------------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance', () => {
      const a = getVirtualMultimeter();
      const b = getVirtualMultimeter();
      expect(a).toBe(b);
    });

    it('returns a new instance after reset', () => {
      const a = getVirtualMultimeter();
      resetVirtualMultimeter();
      const b = getVirtualMultimeter();
      expect(a).not.toBe(b);
    });
  });

  // -------------------------------------------------------------------------
  // Reset
  // -------------------------------------------------------------------------

  describe('reset', () => {
    it('resets to default state', () => {
      meter.setMode('AC_CURRENT');
      meter.connectPositiveProbe('1');
      meter.connectNegativeProbe('0');
      meter.setAutoRange(false);

      meter.reset();

      const state = meter.getState();
      expect(state.mode).toBe('DC_VOLTAGE');
      expect(state.positiveProbe).toBeNull();
      expect(state.negativeProbe).toBeNull();
      expect(state.autoRange).toBe(true);
      expect(state.reading.valid).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles measurement with no probes connected', () => {
      const reading = meter.measure({ dc: makeDCResult({ 0: 0, 1: 5 }) });
      expect(reading.valid).toBe(false);
    });

    it('handles measurement with only positive probe', () => {
      meter.connectPositiveProbe('1');
      const reading = meter.measure({ dc: makeDCResult({ 0: 0, 1: 5 }) });
      expect(reading.valid).toBe(false);
    });

    it('handles measurement with only negative probe', () => {
      meter.connectNegativeProbe('0');
      const reading = meter.measure({ dc: makeDCResult({ 0: 0, 1: 5 }) });
      expect(reading.valid).toBe(false);
    });

    it('handles zero voltage correctly', () => {
      meter.connectPositiveProbe('1');
      meter.connectNegativeProbe('0');
      const dc = makeDCResult({ 0: 0, 1: 0 });
      const reading = meter.measure({ dc });
      expect(reading.valid).toBe(true);
      expect(reading.rawValue).toBe(0);
    });

    it('handles negative node voltages', () => {
      meter.connectPositiveProbe('1');
      meter.connectNegativeProbe('0');
      const dc = makeDCResult({ 0: 0, 1: -3.3 });
      const reading = meter.measure({ dc });
      expect(reading.valid).toBe(true);
      expect(reading.rawValue).toBeCloseTo(-3.3);
    });

    it('handles open circuit (AC voltage with empty waveforms)', () => {
      meter.setMode('AC_VOLTAGE');
      meter.connectPositiveProbe('1');
      meter.connectNegativeProbe('0');

      const transient = makeTransientResult([], { 0: [], 1: [] });
      const reading = meter.measure({ transient });
      expect(reading.valid).toBe(false);
    });

    it('handles AC current with empty waveform', () => {
      meter.setMode('AC_CURRENT');
      meter.connectPositiveProbe('1');
      meter.connectNegativeProbe('0');

      const transient = makeTransientResult([], { 0: [], 1: [] }, { R1: [] });
      const reading = meter.measure({ transient, branchComponentId: 'R1' });
      expect(reading.valid).toBe(false);
    });

    it('handles AC voltage with mismatched waveform lengths', () => {
      meter.setMode('AC_VOLTAGE');
      meter.connectPositiveProbe('1');
      meter.connectNegativeProbe('0');

      const transient = makeTransientResult(
        [0, 0.001],
        { 0: [0], 1: [1, 2] }, // different lengths
      );
      const reading = meter.measure({ transient });
      expect(reading.valid).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Standalone utility tests
// ---------------------------------------------------------------------------

describe('autoSelectRange', () => {
  it('selects first range for small values', () => {
    const ranges = getRangesForMode('DC_VOLTAGE');
    expect(autoSelectRange(0.05, ranges)).toBe(0);
  });

  it('selects middle range for mid values', () => {
    const ranges = getRangesForMode('DC_VOLTAGE');
    expect(autoSelectRange(5, ranges)).toBe(2); // 20V range
  });

  it('selects last range for values at upper limit', () => {
    const ranges = getRangesForMode('DC_VOLTAGE');
    expect(autoSelectRange(999, ranges)).toBe(4); // 1000V range
  });

  it('returns last index for values exceeding all ranges', () => {
    const ranges = getRangesForMode('DC_VOLTAGE');
    expect(autoSelectRange(2000, ranges)).toBe(ranges.length - 1);
  });

  it('handles zero', () => {
    const ranges = getRangesForMode('DC_VOLTAGE');
    expect(autoSelectRange(0, ranges)).toBe(0);
  });

  it('handles negative values by using absolute value', () => {
    const ranges = getRangesForMode('DC_VOLTAGE');
    const negResult = autoSelectRange(-5, ranges);
    const posResult = autoSelectRange(5, ranges);
    expect(negResult).toBe(posResult);
  });
});

describe('computeRMS', () => {
  it('returns 0 for empty array', () => {
    expect(computeRMS([])).toBe(0);
  });

  it('returns absolute value for single sample', () => {
    expect(computeRMS([3])).toBeCloseTo(3);
    expect(computeRMS([-3])).toBeCloseTo(3);
  });

  it('computes RMS of constant DC signal', () => {
    expect(computeRMS([5, 5, 5, 5])).toBeCloseTo(5);
  });

  it('computes RMS of sine wave', () => {
    const n = 10000;
    const samples = Array.from({ length: n }, (_, i) =>
      Math.sin(2 * Math.PI * i / n),
    );
    expect(computeRMS(samples)).toBeCloseTo(1 / Math.sqrt(2), 2);
  });

  it('computes RMS of square wave', () => {
    // ±1 square wave → RMS = 1
    const samples = Array.from({ length: 1000 }, (_, i) =>
      i < 500 ? 1 : -1,
    );
    expect(computeRMS(samples)).toBeCloseTo(1);
  });
});

describe('getRangesForMode', () => {
  it('returns voltage ranges for DC_VOLTAGE', () => {
    const ranges = getRangesForMode('DC_VOLTAGE');
    expect(ranges.length).toBeGreaterThan(0);
    expect(ranges[0]?.displayUnit).toBe('mV');
  });

  it('returns voltage ranges for AC_VOLTAGE', () => {
    const ranges = getRangesForMode('AC_VOLTAGE');
    expect(ranges[0]?.displayUnit).toBe('mV');
  });

  it('returns current ranges for DC_CURRENT', () => {
    const ranges = getRangesForMode('DC_CURRENT');
    expect(ranges[0]?.displayUnit).toBe('\u00B5A');
  });

  it('returns current ranges for AC_CURRENT', () => {
    const ranges = getRangesForMode('AC_CURRENT');
    expect(ranges[0]?.displayUnit).toBe('\u00B5A');
  });

  it('returns resistance ranges for RESISTANCE', () => {
    const ranges = getRangesForMode('RESISTANCE');
    expect(ranges[0]?.displayUnit).toBe('\u03A9');
  });
});

describe('getBaseUnit', () => {
  it('returns V for voltage modes', () => {
    expect(getBaseUnit('DC_VOLTAGE')).toBe('V');
    expect(getBaseUnit('AC_VOLTAGE')).toBe('V');
  });

  it('returns A for current modes', () => {
    expect(getBaseUnit('DC_CURRENT')).toBe('A');
    expect(getBaseUnit('AC_CURRENT')).toBe('A');
  });

  it('returns Ohm for resistance mode', () => {
    expect(getBaseUnit('RESISTANCE')).toBe('\u03A9');
  });
});
