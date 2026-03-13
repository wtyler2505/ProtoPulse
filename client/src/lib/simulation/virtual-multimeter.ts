/**
 * VirtualMultimeter — virtual multimeter instrument for circuit simulation
 * measurements (BL-0625).
 *
 * Features:
 *   - 5 measurement modes: DC Voltage, AC Voltage, DC Current, AC Current, Resistance
 *   - Probe connections referencing circuit net/node IDs
 *   - Auto-ranging with SI prefix selection (mV, V, kV, etc.)
 *   - Overload detection (OL display when out of range)
 *   - Singleton+subscribe pattern for state management
 *
 * Integrates with circuit-solver.ts DCResult/TransientResult for readings.
 */

import type { DCResult, TransientResult } from './circuit-solver';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Multimeter measurement mode. */
export type MultimeterMode =
  | 'DC_VOLTAGE'
  | 'AC_VOLTAGE'
  | 'DC_CURRENT'
  | 'AC_CURRENT'
  | 'RESISTANCE';

/** Probe connection — references a circuit net/node by ID. */
export interface ProbeConnection {
  /** Circuit net/node identifier (numeric node ID as string, or net name). */
  nodeId: string;
}

/** Simulation state snapshot that the multimeter reads from. */
export interface MultimeterSimulationState {
  /** DC operating point results (node voltages + branch currents). */
  dc?: DCResult;
  /** Transient analysis results (time-domain waveforms). */
  transient?: TransientResult;
  /** Component ID between the probe points (for current/resistance). */
  branchComponentId?: string;
}

/** Auto-range configuration for a measurement mode. */
export interface RangeConfig {
  /** Maximum measurable value in base units for this range. */
  maxValue: number;
  /** Minimum measurable value (below this, switch down). */
  minValue: number;
  /** Display unit string (e.g. "mV", "V", "kV"). */
  displayUnit: string;
  /** Multiplier to convert base units → display units. */
  displayMultiplier: number;
}

/** Current reading from the multimeter. */
export interface MultimeterReading {
  /** Raw value in base SI units (V, A, or Ohm). */
  rawValue: number;
  /** Display-formatted value (scaled by range). */
  displayValue: number;
  /** Display unit string (e.g. "mV", "V", "kV"). */
  displayUnit: string;
  /** Whether the reading is overloaded (out of range). */
  overloaded: boolean;
  /** Whether the measurement is valid (probes connected, data available). */
  valid: boolean;
}

/** Full multimeter state. */
export interface MultimeterState {
  /** Current measurement mode. */
  mode: MultimeterMode;
  /** Positive probe connection (null if disconnected). */
  positiveProbe: ProbeConnection | null;
  /** Negative probe connection (null if disconnected). */
  negativeProbe: ProbeConnection | null;
  /** Current reading. */
  reading: MultimeterReading;
  /** Whether auto-range is enabled. */
  autoRange: boolean;
  /** Index into the range table for the current mode. */
  rangeIndex: number;
}

// ---------------------------------------------------------------------------
// Range tables
// ---------------------------------------------------------------------------

/** Voltage ranges: 200mV, 2V, 20V, 200V, 1000V. */
const VOLTAGE_RANGES: RangeConfig[] = [
  { maxValue: 0.2, minValue: 0, displayUnit: 'mV', displayMultiplier: 1000 },
  { maxValue: 2, minValue: 0.19, displayUnit: 'V', displayMultiplier: 1 },
  { maxValue: 20, minValue: 1.9, displayUnit: 'V', displayMultiplier: 1 },
  { maxValue: 200, minValue: 19, displayUnit: 'V', displayMultiplier: 1 },
  { maxValue: 1000, minValue: 190, displayUnit: 'kV', displayMultiplier: 0.001 },
];

/** Current ranges: 200uA, 2mA, 20mA, 200mA, 2A, 10A. */
const CURRENT_RANGES: RangeConfig[] = [
  { maxValue: 0.0002, minValue: 0, displayUnit: '\u00B5A', displayMultiplier: 1e6 },
  { maxValue: 0.002, minValue: 0.00019, displayUnit: 'mA', displayMultiplier: 1000 },
  { maxValue: 0.02, minValue: 0.0019, displayUnit: 'mA', displayMultiplier: 1000 },
  { maxValue: 0.2, minValue: 0.019, displayUnit: 'mA', displayMultiplier: 1000 },
  { maxValue: 2, minValue: 0.19, displayUnit: 'A', displayMultiplier: 1 },
  { maxValue: 10, minValue: 1.9, displayUnit: 'A', displayMultiplier: 1 },
];

/** Resistance ranges: 200 Ohm, 2k, 20k, 200k, 2M, 20M. */
const RESISTANCE_RANGES: RangeConfig[] = [
  { maxValue: 200, minValue: 0, displayUnit: '\u03A9', displayMultiplier: 1 },
  { maxValue: 2000, minValue: 190, displayUnit: 'k\u03A9', displayMultiplier: 0.001 },
  { maxValue: 20000, minValue: 1900, displayUnit: 'k\u03A9', displayMultiplier: 0.001 },
  { maxValue: 200000, minValue: 19000, displayUnit: 'k\u03A9', displayMultiplier: 0.001 },
  { maxValue: 2000000, minValue: 190000, displayUnit: 'M\u03A9', displayMultiplier: 1e-6 },
  { maxValue: 20000000, minValue: 1900000, displayUnit: 'M\u03A9', displayMultiplier: 1e-6 },
];

/**
 * Get the range table for a given measurement mode.
 */
export function getRangesForMode(mode: MultimeterMode): RangeConfig[] {
  switch (mode) {
    case 'DC_VOLTAGE':
    case 'AC_VOLTAGE':
      return VOLTAGE_RANGES;
    case 'DC_CURRENT':
    case 'AC_CURRENT':
      return CURRENT_RANGES;
    case 'RESISTANCE':
      return RESISTANCE_RANGES;
  }
}

/**
 * Get the base unit string for a given measurement mode.
 */
export function getBaseUnit(mode: MultimeterMode): string {
  switch (mode) {
    case 'DC_VOLTAGE':
    case 'AC_VOLTAGE':
      return 'V';
    case 'DC_CURRENT':
    case 'AC_CURRENT':
      return 'A';
    case 'RESISTANCE':
      return '\u03A9';
  }
}

// ---------------------------------------------------------------------------
// Auto-range logic
// ---------------------------------------------------------------------------

/**
 * Select the best range index for a given value in a range table.
 * Returns the index of the smallest range that contains the value.
 * If the value exceeds all ranges, returns the last index (overloaded).
 */
export function autoSelectRange(value: number, ranges: RangeConfig[]): number {
  const absValue = Math.abs(value);
  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];
    if (range && absValue <= range.maxValue) {
      return i;
    }
  }
  // Exceeds all ranges — stay at last range (will show OL)
  return ranges.length - 1;
}

// ---------------------------------------------------------------------------
// Measurement functions
// ---------------------------------------------------------------------------

/**
 * Compute RMS of a waveform array.
 */
export function computeRMS(samples: number[]): number {
  if (samples.length === 0) {
    return 0;
  }
  let sumSquares = 0;
  for (const s of samples) {
    sumSquares += s * s;
  }
  return Math.sqrt(sumSquares / samples.length);
}

/**
 * Measure DC voltage between two nodes from DC operating point.
 */
function measureDCVoltage(
  state: MultimeterSimulationState,
  posNodeId: string,
  negNodeId: string,
): number | null {
  if (!state.dc) {
    return null;
  }
  const posNode = Number(posNodeId);
  const negNode = Number(negNodeId);
  const vPos = state.dc.nodeVoltages[posNode];
  const vNeg = state.dc.nodeVoltages[negNode];
  if (vPos === undefined || vNeg === undefined) {
    return null;
  }
  return vPos - vNeg;
}

/**
 * Measure AC (RMS) voltage between two nodes from transient data.
 */
function measureACVoltage(
  state: MultimeterSimulationState,
  posNodeId: string,
  negNodeId: string,
): number | null {
  if (!state.transient) {
    return null;
  }
  const posNode = Number(posNodeId);
  const negNode = Number(negNodeId);
  const posWaveform = state.transient.nodeVoltages[posNode];
  const negWaveform = state.transient.nodeVoltages[negNode];
  if (!posWaveform || !negWaveform) {
    return null;
  }
  if (posWaveform.length !== negWaveform.length || posWaveform.length === 0) {
    return null;
  }
  // Compute difference waveform, then RMS
  const diff = posWaveform.map((v, i) => v - (negWaveform[i] ?? 0));
  return computeRMS(diff);
}

/**
 * Measure DC current through a branch component.
 */
function measureDCCurrent(
  state: MultimeterSimulationState,
): number | null {
  if (!state.dc || !state.branchComponentId) {
    return null;
  }
  const current = state.dc.branchCurrents[state.branchComponentId];
  return current !== undefined ? current : null;
}

/**
 * Measure AC (RMS) current through a branch component from transient data.
 */
function measureACCurrent(
  state: MultimeterSimulationState,
): number | null {
  if (!state.transient || !state.branchComponentId) {
    return null;
  }
  const waveform = state.transient.branchCurrents[state.branchComponentId];
  if (!waveform || waveform.length === 0) {
    return null;
  }
  return computeRMS(waveform);
}

/**
 * Measure resistance using V/I ratio from DC operating point.
 * Uses the voltage across the probed nodes and current through the branch.
 */
function measureResistance(
  state: MultimeterSimulationState,
  posNodeId: string,
  negNodeId: string,
): number | null {
  if (!state.dc) {
    return null;
  }
  const voltage = measureDCVoltage(state, posNodeId, negNodeId);
  if (voltage === null) {
    return null;
  }

  // If we have a branch component, compute V/I
  if (state.branchComponentId) {
    const current = state.dc.branchCurrents[state.branchComponentId];
    if (current !== undefined && Math.abs(current) > 1e-15) {
      return Math.abs(voltage / current);
    }
  }

  // If voltage is 0 and no current info, resistance is indeterminate
  return null;
}

// ---------------------------------------------------------------------------
// Invalid reading constant
// ---------------------------------------------------------------------------

const INVALID_READING: MultimeterReading = {
  rawValue: 0,
  displayValue: 0,
  displayUnit: '',
  overloaded: false,
  valid: false,
};

// ---------------------------------------------------------------------------
// VirtualMultimeter class (singleton+subscribe)
// ---------------------------------------------------------------------------

type Listener = () => void;

export class VirtualMultimeter {
  private state: MultimeterState;
  private listeners = new Set<Listener>();

  constructor() {
    const ranges = getRangesForMode('DC_VOLTAGE');
    const defaultRange = ranges[1]; // 2V range
    this.state = {
      mode: 'DC_VOLTAGE',
      positiveProbe: null,
      negativeProbe: null,
      reading: { ...INVALID_READING },
      autoRange: true,
      rangeIndex: defaultRange ? 1 : 0,
    };
  }

  // -------------------------------------------------------------------------
  // Subscribe
  // -------------------------------------------------------------------------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    Array.from(this.listeners).forEach((fn) => {
      fn();
    });
  }

  // -------------------------------------------------------------------------
  // Getters
  // -------------------------------------------------------------------------

  getState(): Readonly<MultimeterState> {
    return this.state;
  }

  getMode(): MultimeterMode {
    return this.state.mode;
  }

  getReading(): Readonly<MultimeterReading> {
    return this.state.reading;
  }

  isAutoRange(): boolean {
    return this.state.autoRange;
  }

  // -------------------------------------------------------------------------
  // Mode control
  // -------------------------------------------------------------------------

  setMode(mode: MultimeterMode): void {
    if (this.state.mode === mode) {
      return;
    }
    this.state.mode = mode;
    // Reset range to a sensible default for the new mode
    const ranges = getRangesForMode(mode);
    this.state.rangeIndex = Math.min(1, ranges.length - 1);
    // Invalidate reading when mode changes
    this.state.reading = { ...INVALID_READING };
    this.notify();
  }

  // -------------------------------------------------------------------------
  // Probe connections
  // -------------------------------------------------------------------------

  connectPositiveProbe(nodeId: string): void {
    this.state.positiveProbe = { nodeId };
    this.notify();
  }

  connectNegativeProbe(nodeId: string): void {
    this.state.negativeProbe = { nodeId };
    this.notify();
  }

  disconnectPositiveProbe(): void {
    this.state.positiveProbe = null;
    this.state.reading = { ...INVALID_READING };
    this.notify();
  }

  disconnectNegativeProbe(): void {
    this.state.negativeProbe = null;
    this.state.reading = { ...INVALID_READING };
    this.notify();
  }

  disconnectAllProbes(): void {
    this.state.positiveProbe = null;
    this.state.negativeProbe = null;
    this.state.reading = { ...INVALID_READING };
    this.notify();
  }

  // -------------------------------------------------------------------------
  // Range control
  // -------------------------------------------------------------------------

  setAutoRange(enabled: boolean): void {
    this.state.autoRange = enabled;
    this.notify();
  }

  setRangeIndex(index: number): void {
    const ranges = getRangesForMode(this.state.mode);
    if (index >= 0 && index < ranges.length) {
      this.state.rangeIndex = index;
      this.state.autoRange = false;
      this.notify();
    }
  }

  rangeUp(): void {
    const ranges = getRangesForMode(this.state.mode);
    if (this.state.rangeIndex < ranges.length - 1) {
      this.state.rangeIndex++;
      this.state.autoRange = false;
      this.notify();
    }
  }

  rangeDown(): void {
    if (this.state.rangeIndex > 0) {
      this.state.rangeIndex--;
      this.state.autoRange = false;
      this.notify();
    }
  }

  // -------------------------------------------------------------------------
  // Measurement
  // -------------------------------------------------------------------------

  /**
   * Take a measurement from the provided simulation state.
   * Updates the internal reading and notifies subscribers.
   */
  measure(simulationState: MultimeterSimulationState): MultimeterReading {
    const { mode, positiveProbe, negativeProbe } = this.state;

    // Check probe connections
    if (!positiveProbe || !negativeProbe) {
      this.state.reading = { ...INVALID_READING };
      this.notify();
      return this.state.reading;
    }

    const posNodeId = positiveProbe.nodeId;
    const negNodeId = negativeProbe.nodeId;

    // Same node on both probes → 0 reading (for voltage modes)
    if (posNodeId === negNodeId && (mode === 'DC_VOLTAGE' || mode === 'AC_VOLTAGE')) {
      const ranges = getRangesForMode(mode);
      const range = ranges[this.state.rangeIndex];
      const reading: MultimeterReading = {
        rawValue: 0,
        displayValue: 0,
        displayUnit: range?.displayUnit ?? 'V',
        overloaded: false,
        valid: true,
      };
      this.state.reading = reading;
      this.notify();
      return reading;
    }

    // Compute raw measurement value
    let rawValue: number | null = null;

    switch (mode) {
      case 'DC_VOLTAGE':
        rawValue = measureDCVoltage(simulationState, posNodeId, negNodeId);
        break;
      case 'AC_VOLTAGE':
        rawValue = measureACVoltage(simulationState, posNodeId, negNodeId);
        break;
      case 'DC_CURRENT':
        rawValue = measureDCCurrent(simulationState);
        break;
      case 'AC_CURRENT':
        rawValue = measureACCurrent(simulationState);
        break;
      case 'RESISTANCE':
        rawValue = measureResistance(simulationState, posNodeId, negNodeId);
        break;
    }

    if (rawValue === null) {
      this.state.reading = { ...INVALID_READING };
      this.notify();
      return this.state.reading;
    }

    // Auto-range if enabled
    const ranges = getRangesForMode(mode);
    if (this.state.autoRange) {
      this.state.rangeIndex = autoSelectRange(rawValue, ranges);
    }

    const range = ranges[this.state.rangeIndex];
    if (!range) {
      this.state.reading = { ...INVALID_READING };
      this.notify();
      return this.state.reading;
    }

    // Check overload
    const absValue = Math.abs(rawValue);
    const overloaded = absValue > range.maxValue;

    // Scale value for display
    const displayValue = rawValue * range.displayMultiplier;

    const reading: MultimeterReading = {
      rawValue,
      displayValue: overloaded ? 0 : displayValue,
      displayUnit: range.displayUnit,
      overloaded,
      valid: true,
    };

    this.state.reading = reading;
    this.notify();
    return reading;
  }

  // -------------------------------------------------------------------------
  // Reset
  // -------------------------------------------------------------------------

  reset(): void {
    const ranges = getRangesForMode('DC_VOLTAGE');
    this.state = {
      mode: 'DC_VOLTAGE',
      positiveProbe: null,
      negativeProbe: null,
      reading: { ...INVALID_READING },
      autoRange: true,
      rangeIndex: ranges.length > 1 ? 1 : 0,
    };
    this.notify();
  }
}

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------

let _instance: VirtualMultimeter | null = null;

export function getVirtualMultimeter(): VirtualMultimeter {
  if (!_instance) {
    _instance = new VirtualMultimeter();
  }
  return _instance;
}

/** Reset the singleton (primarily for testing). */
export function resetVirtualMultimeter(): void {
  _instance = null;
}
