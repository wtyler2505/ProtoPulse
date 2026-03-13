/**
 * Simulation Visual State — maps circuit solver results to visual properties
 * for component rendering (LED glow, resistor labels, switch states) and
 * wire animation (current flow speed/direction, voltage labels).
 *
 * BL-0619: Component visual state rendering during simulation
 * BL-0128: Live current/voltage animation overlay on wires
 */

import type { DCResult } from './circuit-solver';

// ---------------------------------------------------------------------------
// Component visual states
// ---------------------------------------------------------------------------

export type LEDColor = 'red' | 'green' | 'blue' | 'yellow' | 'white';

export interface LEDVisualState {
  type: 'led';
  forwardCurrent: number; // Amps
  glowing: boolean;
  brightness: number; // 0-1 clamped
  color: LEDColor;
}

export interface ResistorVisualState {
  type: 'resistor';
  voltageDrop: number; // Volts
  current: number; // Amps
}

export interface SwitchVisualState {
  type: 'switch';
  closed: boolean;
}

export interface GenericVisualState {
  type: 'generic';
  voltageDrop: number;
  current: number;
}

export type ComponentVisualState =
  | LEDVisualState
  | ResistorVisualState
  | SwitchVisualState
  | GenericVisualState;

// ---------------------------------------------------------------------------
// Wire visual states
// ---------------------------------------------------------------------------

export interface WireVisualState {
  /** Current magnitude in Amps — drives animation speed */
  currentMagnitude: number;
  /** Current direction: 1 = source→target, -1 = target→source, 0 = none */
  currentDirection: 1 | -1 | 0;
  /** Animation speed in px/s — maps from current (0 = stopped, higher = faster) */
  animationSpeed: number;
  /** Voltage at the source end */
  sourceVoltage: number;
  /** Voltage at the target end */
  targetVoltage: number;
}

// ---------------------------------------------------------------------------
// LED current → brightness mapping
// ---------------------------------------------------------------------------

/** Minimum forward current for visible LED glow (1mA) */
const LED_MIN_CURRENT = 0.001;
/** Typical maximum forward current (20mA) */
const LED_MAX_CURRENT = 0.020;

/**
 * Map LED forward current to brightness 0-1.
 * Uses a logarithmic curve to approximate how perceived brightness scales.
 */
export function ledCurrentToBrightness(current: number): number {
  if (current < LED_MIN_CURRENT) { return 0; }
  if (current >= LED_MAX_CURRENT) { return 1; }
  // Log scale: perceived brightness ~ log(I)
  const logMin = Math.log(LED_MIN_CURRENT);
  const logMax = Math.log(LED_MAX_CURRENT);
  const logI = Math.log(current);
  return Math.max(0, Math.min(1, (logI - logMin) / (logMax - logMin)));
}

/**
 * Infer LED color from component properties or reference designator.
 */
export function inferLEDColor(
  refDes: string,
  properties?: Record<string, unknown>,
): LEDColor {
  const color = properties?.color;
  if (typeof color === 'string' && color) {
    const lower = color.toLowerCase();
    if (lower === 'red' || lower === 'green' || lower === 'blue' || lower === 'yellow' || lower === 'white') {
      return lower;
    }
  }
  // Fallback: try to infer from refdes suffix (e.g., "LED_R1" for red)
  const upper = refDes.toUpperCase();
  if (upper.includes('_R') || upper.includes('RED')) { return 'red'; }
  if (upper.includes('_G') || upper.includes('GRN') || upper.includes('GREEN')) { return 'green'; }
  if (upper.includes('_B') || upper.includes('BLU') || upper.includes('BLUE')) { return 'blue'; }
  if (upper.includes('_Y') || upper.includes('YEL') || upper.includes('YELLOW')) { return 'yellow'; }
  if (upper.includes('_W') || upper.includes('WHT') || upper.includes('WHITE')) { return 'white'; }
  return 'red'; // Default LED color
}

/**
 * CSS color for LED glow effect.
 */
export function ledColorToCSS(color: LEDColor): string {
  switch (color) {
    case 'red': return '#ef4444';
    case 'green': return '#22c55e';
    case 'blue': return '#3b82f6';
    case 'yellow': return '#eab308';
    case 'white': return '#f5f5f5';
  }
}

// ---------------------------------------------------------------------------
// Current → animation speed mapping
// ---------------------------------------------------------------------------

/** Minimum current to show wire animation (100uA) */
const WIRE_ANIM_MIN_CURRENT = 0.0001;
/** Current at which animation reaches max speed (1A) */
const WIRE_ANIM_MAX_CURRENT = 1.0;
/** Minimum animation speed in px/s */
const WIRE_ANIM_MIN_SPEED = 10;
/** Maximum animation speed in px/s */
const WIRE_ANIM_MAX_SPEED = 200;

/**
 * Map current magnitude to animation speed.
 * Uses log scale for perceptual mapping.
 */
export function currentToAnimationSpeed(currentMagnitude: number): number {
  if (currentMagnitude < WIRE_ANIM_MIN_CURRENT) { return 0; }
  if (currentMagnitude >= WIRE_ANIM_MAX_CURRENT) { return WIRE_ANIM_MAX_SPEED; }
  const logMin = Math.log(WIRE_ANIM_MIN_CURRENT);
  const logMax = Math.log(WIRE_ANIM_MAX_CURRENT);
  const logI = Math.log(currentMagnitude);
  const t = (logI - logMin) / (logMax - logMin);
  return WIRE_ANIM_MIN_SPEED + t * (WIRE_ANIM_MAX_SPEED - WIRE_ANIM_MIN_SPEED);
}

// ---------------------------------------------------------------------------
// Main computation: DCResult → visual states
// ---------------------------------------------------------------------------

export interface ComponentInfo {
  id: string; // solver component ID
  referenceDesignator: string;
  componentType: string; // 'resistor' | 'led' | 'switch' | 'capacitor' | etc.
  nodePositive: number;
  nodeNegative: number;
  properties?: Record<string, unknown>;
}

export interface WireInfo {
  /** Net/wire ID */
  id: string;
  /** Source node number in the solver */
  sourceNode: number;
  /** Target node number in the solver */
  targetNode: number;
  /** Associated component ID for branch current lookup */
  componentId?: string;
}

/**
 * Compute visual states for all components from DC operating point results.
 */
export function computeComponentVisualStates(
  components: ComponentInfo[],
  dcResult: DCResult,
): Map<string, ComponentVisualState> {
  const states = new Map<string, ComponentVisualState>();

  for (const comp of components) {
    const vPlus = dcResult.nodeVoltages[comp.nodePositive] ?? 0;
    const vMinus = dcResult.nodeVoltages[comp.nodeNegative] ?? 0;
    const voltageDrop = vPlus - vMinus;
    const current = dcResult.branchCurrents[comp.id] ?? 0;
    const type = comp.componentType.toLowerCase();

    if (type === 'led' || type === 'diode_led') {
      const absCurrent = Math.abs(current);
      const color = inferLEDColor(comp.referenceDesignator, comp.properties);
      states.set(comp.referenceDesignator, {
        type: 'led',
        forwardCurrent: absCurrent,
        glowing: absCurrent >= LED_MIN_CURRENT,
        brightness: ledCurrentToBrightness(absCurrent),
        color,
      });
    } else if (type === 'resistor' || type === 'r') {
      states.set(comp.referenceDesignator, {
        type: 'resistor',
        voltageDrop,
        current,
      });
    } else if (type === 'switch' || type === 'spst' || type === 'spdt') {
      states.set(comp.referenceDesignator, {
        type: 'switch',
        closed: Math.abs(current) > 1e-12,
      });
    } else {
      states.set(comp.referenceDesignator, {
        type: 'generic',
        voltageDrop,
        current,
      });
    }
  }

  return states;
}

/**
 * Compute visual states for wires/nets from DC operating point results.
 */
export function computeWireVisualStates(
  wires: WireInfo[],
  dcResult: DCResult,
): Map<string, WireVisualState> {
  const states = new Map<string, WireVisualState>();

  for (const wire of wires) {
    const sourceVoltage = dcResult.nodeVoltages[wire.sourceNode] ?? 0;
    const targetVoltage = dcResult.nodeVoltages[wire.targetNode] ?? 0;

    let currentMag = 0;
    let currentDir: 1 | -1 | 0 = 0;

    if (wire.componentId) {
      const branchCurrent = dcResult.branchCurrents[wire.componentId] ?? 0;
      currentMag = Math.abs(branchCurrent);
      currentDir = branchCurrent > 1e-12 ? 1 : branchCurrent < -1e-12 ? -1 : 0;
    }

    states.set(wire.id, {
      currentMagnitude: currentMag,
      currentDirection: currentDir,
      animationSpeed: currentToAnimationSpeed(currentMag),
      sourceVoltage,
      targetVoltage,
    });
  }

  return states;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/**
 * Format a voltage/current value with SI prefix for display.
 */
export function formatSIValue(value: number, unit: string): string {
  const abs = Math.abs(value);
  if (abs === 0) { return `0 ${unit}`; }
  if (abs >= 1e6) { return `${(value / 1e6).toFixed(1)} M${unit}`; }
  if (abs >= 1e3) { return `${(value / 1e3).toFixed(1)} k${unit}`; }
  if (abs >= 1) { return `${value.toFixed(2)} ${unit}`; }
  if (abs >= 1e-3) { return `${(value * 1e3).toFixed(1)} m${unit}`; }
  if (abs >= 1e-6) { return `${(value * 1e6).toFixed(1)} u${unit}`; }
  if (abs >= 1e-9) { return `${(value * 1e9).toFixed(1)} n${unit}`; }
  return `${(value * 1e12).toFixed(1)} p${unit}`;
}
