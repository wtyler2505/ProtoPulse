/**
 * Component Visual Renderers — maps simulation solver results to per-component
 * visual properties used by ComponentVisualOverlay.
 *
 * Extends the existing visual-state.ts system with richer component types:
 * LED, Resistor, Motor, Servo, Relay, Switch, Buzzer, Potentiometer,
 * SevenSegment, and a generic fallback.
 *
 * BL-0619: Component visual state rendering during simulation
 */

import type { CSSProperties } from 'react';

// ---------------------------------------------------------------------------
// Visual property types per component
// ---------------------------------------------------------------------------

export interface LEDVisualProps {
  glowIntensity: number; // 0-1
  color: string; // CSS color
  glowing: boolean;
}

export interface ResistorVisualProps {
  heatLevel: number; // 0 (cold/blue) to 1 (hot/red)
  powerDissipation: number; // Watts
}

export interface MotorVisualProps {
  rotationSpeed: number; // deg/s
  direction: 'cw' | 'ccw' | 'stopped';
}

export interface ServoVisualProps {
  angle: number; // 0-180 degrees
}

export interface RelayVisualProps {
  energized: boolean;
  coilCurrent: number; // Amps
}

export interface SwitchVisualProps {
  closed: boolean;
}

export interface BuzzerVisualProps {
  pulsing: boolean;
  frequency: number; // Hz (for animation speed)
}

export interface PotentiometerVisualProps {
  angle: number; // 0-270 degrees
  position: number; // 0-1 normalized
}

export interface SevenSegmentVisualProps {
  segments: boolean[]; // [a, b, c, d, e, f, g] — standard 7-seg ordering
  decimalPoint: boolean;
}

export interface GenericVisualProps {
  voltageDrop: number;
  current: number;
}

export type ComponentVisualProps =
  | { type: 'led'; props: LEDVisualProps }
  | { type: 'resistor'; props: ResistorVisualProps }
  | { type: 'motor'; props: MotorVisualProps }
  | { type: 'servo'; props: ServoVisualProps }
  | { type: 'relay'; props: RelayVisualProps }
  | { type: 'switch'; props: SwitchVisualProps }
  | { type: 'buzzer'; props: BuzzerVisualProps }
  | { type: 'potentiometer'; props: PotentiometerVisualProps }
  | { type: 'seven_segment'; props: SevenSegmentVisualProps }
  | { type: 'generic'; props: GenericVisualProps };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum LED forward current for visible glow (1mA) */
const LED_MIN_CURRENT = 0.001;
/** Typical max LED forward current (20mA) */
const LED_MAX_CURRENT = 0.020;

/** Max resistor power before fully red (0.5W — typical 1/4W resistor limit) */
const RESISTOR_MAX_POWER = 0.5;

/** Relay coil threshold current (50mA typical small relay) */
const RELAY_COIL_THRESHOLD = 0.05;

/** Motor stall detection — below this voltage, motor is stopped */
const MOTOR_MIN_VOLTAGE = 0.5;
/** Typical motor max RPM voltage (12V nominal) */
const MOTOR_NOMINAL_VOLTAGE = 12;
/** Max rotation display speed in deg/s */
const MOTOR_MAX_DEG_PER_SEC = 720;

/** Buzzer minimum drive voltage */
const BUZZER_MIN_VOLTAGE = 1.5;

/** Default LED colors by common naming patterns */
const LED_COLOR_MAP: Record<string, string> = {
  red: '#ef4444',
  green: '#22c55e',
  blue: '#3b82f6',
  yellow: '#eab308',
  white: '#f5f5f5',
  orange: '#f97316',
  purple: '#a855f7',
  pink: '#ec4899',
  ir: '#7f1d1d',
  uv: '#7c3aed',
};

/** 7-segment digit → segment mapping (a-g) */
const SEVEN_SEG_DIGITS: Record<number, boolean[]> = {
  0: [true, true, true, true, true, true, false],
  1: [false, true, true, false, false, false, false],
  2: [true, true, false, true, true, false, true],
  3: [true, true, true, true, false, false, true],
  4: [false, true, true, false, false, true, true],
  5: [true, false, true, true, false, true, true],
  6: [true, false, true, true, true, true, true],
  7: [true, true, true, false, false, false, false],
  8: [true, true, true, true, true, true, true],
  9: [true, true, true, true, false, true, true],
};

// ---------------------------------------------------------------------------
// Normalizing component type strings
// ---------------------------------------------------------------------------

type RecognizedType =
  | 'led'
  | 'resistor'
  | 'motor'
  | 'servo'
  | 'relay'
  | 'switch'
  | 'buzzer'
  | 'potentiometer'
  | 'seven_segment'
  | 'generic';

const TYPE_ALIASES: Record<string, RecognizedType> = {
  led: 'led',
  diode_led: 'led',
  light_emitting_diode: 'led',

  resistor: 'resistor',
  r: 'resistor',
  res: 'resistor',

  motor: 'motor',
  dc_motor: 'motor',
  dcmotor: 'motor',

  servo: 'servo',
  servo_motor: 'servo',

  relay: 'relay',
  spdt_relay: 'relay',
  dpdt_relay: 'relay',

  switch: 'switch',
  spst: 'switch',
  spdt: 'switch',
  button: 'switch',
  pushbutton: 'switch',
  tactile_switch: 'switch',

  buzzer: 'buzzer',
  piezo: 'buzzer',
  speaker: 'buzzer',

  potentiometer: 'potentiometer',
  pot: 'potentiometer',
  trimpot: 'potentiometer',
  variable_resistor: 'potentiometer',

  seven_segment: 'seven_segment',
  '7seg': 'seven_segment',
  '7segment': 'seven_segment',
  seven_seg: 'seven_segment',
};

export function normalizeComponentType(raw: string): RecognizedType {
  const lower = raw.toLowerCase().replace(/[\s-]+/g, '_');
  return TYPE_ALIASES[lower] ?? 'generic';
}

// ---------------------------------------------------------------------------
// Core mapping function
// ---------------------------------------------------------------------------

export interface SimulationValues {
  nodeVoltages: Record<number, number>;
  branchCurrents: Record<string, number>;
}

export interface ComponentMapping {
  instanceId: string;
  componentType: string;
  componentId: string; // solver component ID for branchCurrents lookup
  nodePositive: number;
  nodeNegative: number;
  properties?: Record<string, unknown>;
}

/**
 * Map simulation DC results to visual properties for a single component.
 */
export function mapSimulationToVisual(
  componentType: string,
  simValues: SimulationValues,
  mapping: ComponentMapping,
): ComponentVisualProps {
  const type = normalizeComponentType(componentType);
  const vPlus = simValues.nodeVoltages[mapping.nodePositive] ?? 0;
  const vMinus = simValues.nodeVoltages[mapping.nodeNegative] ?? 0;
  const voltageDrop = vPlus - vMinus;
  const current = simValues.branchCurrents[mapping.componentId] ?? 0;
  const absCurrent = Math.abs(current);
  const absVoltage = Math.abs(voltageDrop);

  switch (type) {
    case 'led':
      return mapLED(absCurrent, mapping.properties);
    case 'resistor':
      return mapResistor(absVoltage, absCurrent);
    case 'motor':
      return mapMotor(voltageDrop);
    case 'servo':
      return mapServo(mapping.properties);
    case 'relay':
      return mapRelay(absCurrent);
    case 'switch':
      return mapSwitch(absCurrent);
    case 'buzzer':
      return mapBuzzer(absVoltage);
    case 'potentiometer':
      return mapPotentiometer(mapping.properties);
    case 'seven_segment':
      return mapSevenSegment(mapping.properties);
    case 'generic':
      return { type: 'generic', props: { voltageDrop, current } };
  }
}

// ---------------------------------------------------------------------------
// Per-component mapping helpers
// ---------------------------------------------------------------------------

function mapLED(
  forwardCurrent: number,
  properties?: Record<string, unknown>,
): ComponentVisualProps {
  const glowing = forwardCurrent >= LED_MIN_CURRENT;
  let glowIntensity = 0;

  if (glowing) {
    if (forwardCurrent >= LED_MAX_CURRENT) {
      glowIntensity = 1;
    } else {
      // Logarithmic brightness perception
      const logMin = Math.log(LED_MIN_CURRENT);
      const logMax = Math.log(LED_MAX_CURRENT);
      const logI = Math.log(forwardCurrent);
      glowIntensity = Math.max(0, Math.min(1, (logI - logMin) / (logMax - logMin)));
    }
  }

  const colorKey = typeof properties?.color === 'string' ? properties.color.toLowerCase() : 'red';
  const color = LED_COLOR_MAP[colorKey] ?? LED_COLOR_MAP.red;

  return {
    type: 'led',
    props: { glowIntensity, color, glowing },
  };
}

function mapResistor(voltage: number, current: number): ComponentVisualProps {
  const powerDissipation = voltage * current;
  const heatLevel = Math.max(0, Math.min(1, powerDissipation / RESISTOR_MAX_POWER));

  return {
    type: 'resistor',
    props: { heatLevel, powerDissipation },
  };
}

function mapMotor(voltageDrop: number): ComponentVisualProps {
  const absV = Math.abs(voltageDrop);
  if (absV < MOTOR_MIN_VOLTAGE) {
    return {
      type: 'motor',
      props: { rotationSpeed: 0, direction: 'stopped' },
    };
  }

  const normalizedSpeed = Math.min(1, absV / MOTOR_NOMINAL_VOLTAGE);
  const rotationSpeed = normalizedSpeed * MOTOR_MAX_DEG_PER_SEC;
  const direction = voltageDrop >= 0 ? 'cw' as const : 'ccw' as const;

  return {
    type: 'motor',
    props: { rotationSpeed, direction },
  };
}

function mapServo(properties?: Record<string, unknown>): ComponentVisualProps {
  let angle = 90; // Default center position
  const controlSignal = properties?.controlSignal;
  if (typeof controlSignal === 'number') {
    angle = Math.max(0, Math.min(180, controlSignal));
  }

  return {
    type: 'servo',
    props: { angle },
  };
}

function mapRelay(coilCurrent: number): ComponentVisualProps {
  return {
    type: 'relay',
    props: {
      energized: coilCurrent >= RELAY_COIL_THRESHOLD,
      coilCurrent,
    },
  };
}

function mapSwitch(current: number): ComponentVisualProps {
  return {
    type: 'switch',
    props: { closed: Math.abs(current) > 1e-12 },
  };
}

function mapBuzzer(voltage: number): ComponentVisualProps {
  const pulsing = voltage >= BUZZER_MIN_VOLTAGE;
  // Higher voltage = faster perceived buzz (map 1.5V–12V to 1–10Hz animation)
  const frequency = pulsing
    ? Math.min(10, 1 + ((voltage - BUZZER_MIN_VOLTAGE) / 10.5) * 9)
    : 0;

  return {
    type: 'buzzer',
    props: { pulsing, frequency },
  };
}

function mapPotentiometer(properties?: Record<string, unknown>): ComponentVisualProps {
  let position = 0.5; // Default 50%
  const pos = properties?.position;
  if (typeof pos === 'number') {
    position = Math.max(0, Math.min(1, pos));
  }
  const angle = position * 270; // 0-270° rotation range

  return {
    type: 'potentiometer',
    props: { angle, position },
  };
}

function mapSevenSegment(properties?: Record<string, unknown>): ComponentVisualProps {
  const segmentBits = properties?.segmentBits;
  const digitValue = properties?.digit;

  let segments: boolean[];
  let decimalPoint = false;

  if (Array.isArray(segmentBits) && segmentBits.length >= 7) {
    segments = segmentBits.slice(0, 7).map(Boolean);
    decimalPoint = segmentBits.length > 7 ? Boolean(segmentBits[7]) : false;
  } else if (typeof segmentBits === 'number') {
    // Bitmask: bit 0 = a, bit 1 = b, ..., bit 6 = g, bit 7 = dp
    segments = Array.from({ length: 7 }, (_, i) => Boolean(segmentBits & (1 << i)));
    decimalPoint = Boolean(segmentBits & (1 << 7));
  } else if (typeof digitValue === 'number' && digitValue >= 0 && digitValue <= 9) {
    segments = SEVEN_SEG_DIGITS[digitValue] ?? Array(7).fill(false) as boolean[];
    decimalPoint = Boolean(properties?.decimalPoint);
  } else {
    segments = Array(7).fill(false) as boolean[];
  }

  return {
    type: 'seven_segment',
    props: { segments, decimalPoint },
  };
}

// ---------------------------------------------------------------------------
// CSS generation
// ---------------------------------------------------------------------------

/**
 * Heat level to CSS color (blue → orange → red gradient).
 */
function heatLevelToColor(heatLevel: number): string {
  if (heatLevel <= 0) { return 'rgba(59, 130, 246, 0.5)'; } // blue-500/50
  if (heatLevel >= 1) { return 'rgba(239, 68, 68, 0.8)'; } // red-500/80
  // Interpolate blue → orange → red
  if (heatLevel < 0.5) {
    const t = heatLevel * 2;
    const r = Math.round(59 + t * (249 - 59));
    const g = Math.round(130 + t * (115 - 130));
    const b = Math.round(246 + t * (22 - 246));
    return `rgba(${r}, ${g}, ${b}, ${0.5 + t * 0.15})`;
  }
  const t = (heatLevel - 0.5) * 2;
  const r = Math.round(249 + t * (239 - 249));
  const g = Math.round(115 + t * (68 - 115));
  const b = Math.round(22 + t * (68 - 22));
  return `rgba(${r}, ${g}, ${b}, ${0.65 + t * 0.15})`;
}

/**
 * Generate CSS style object for a component's visual overlay.
 */
export function getVisualCSS(
  visualProps: ComponentVisualProps,
): CSSProperties {
  const base: CSSProperties = {
    transition: 'all 0.3s ease',
    pointerEvents: 'none',
  };

  switch (visualProps.type) {
    case 'led': {
      const { glowIntensity, color, glowing } = visualProps.props;
      if (!glowing) { return base; }
      return {
        ...base,
        boxShadow: `0 0 ${8 * glowIntensity}px ${4 * glowIntensity}px ${color}, 0 0 ${16 * glowIntensity}px ${8 * glowIntensity}px ${color}`,
        borderRadius: '50%',
        backgroundColor: color,
        opacity: 0.3 + glowIntensity * 0.5,
      };
    }
    case 'resistor': {
      const { heatLevel } = visualProps.props;
      if (heatLevel <= 0.05) { return base; }
      const heatColor = heatLevelToColor(heatLevel);
      return {
        ...base,
        boxShadow: `0 0 ${4 + heatLevel * 8}px ${heatColor}`,
        borderColor: heatColor,
        borderWidth: '1px',
        borderStyle: 'solid',
        borderRadius: '2px',
      };
    }
    case 'motor': {
      const { rotationSpeed, direction } = visualProps.props;
      if (direction === 'stopped') { return base; }
      const duration = rotationSpeed > 0 ? 360 / rotationSpeed : 0;
      return {
        ...base,
        animation: duration > 0
          ? `sim-motor-spin ${duration}s linear infinite ${direction === 'ccw' ? 'reverse' : 'normal'}`
          : 'none',
      };
    }
    case 'servo': {
      const { angle } = visualProps.props;
      return {
        ...base,
        transform: `rotate(${angle - 90}deg)`,
        transformOrigin: 'center center',
      };
    }
    case 'relay': {
      const { energized } = visualProps.props;
      return {
        ...base,
        borderColor: energized ? '#22c55e' : '#ef4444',
        borderWidth: '2px',
        borderStyle: 'solid',
        borderRadius: '3px',
        backgroundColor: energized ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
      };
    }
    case 'switch': {
      const { closed } = visualProps.props;
      return {
        ...base,
        borderColor: closed ? '#22c55e' : '#ef4444',
        borderWidth: '2px',
        borderStyle: closed ? 'solid' : 'dashed',
        borderRadius: '3px',
      };
    }
    case 'buzzer': {
      const { pulsing, frequency } = visualProps.props;
      if (!pulsing) { return base; }
      const period = frequency > 0 ? 1 / frequency : 1;
      return {
        ...base,
        animation: `sim-buzzer-pulse ${period}s ease-in-out infinite`,
        boxShadow: '0 0 6px rgba(234, 179, 8, 0.5)',
      };
    }
    case 'potentiometer': {
      const { angle } = visualProps.props;
      return {
        ...base,
        transform: `rotate(${angle}deg)`,
        transformOrigin: 'center center',
      };
    }
    case 'seven_segment':
      return base;
    case 'generic':
      return base;
  }
}

/**
 * Get a CSS class string for the component visual state.
 */
export function getComponentVisualClass(visualProps: ComponentVisualProps): string {
  const classes: string[] = ['sim-component-visual'];

  switch (visualProps.type) {
    case 'led':
      classes.push('sim-vis-led');
      if (visualProps.props.glowing) { classes.push('sim-vis-led-active'); }
      break;
    case 'resistor':
      classes.push('sim-vis-resistor');
      if (visualProps.props.heatLevel > 0.5) { classes.push('sim-vis-resistor-hot'); }
      if (visualProps.props.heatLevel > 0.8) { classes.push('sim-vis-resistor-critical'); }
      break;
    case 'motor':
      classes.push('sim-vis-motor');
      if (visualProps.props.direction !== 'stopped') { classes.push('sim-vis-motor-spinning'); }
      break;
    case 'servo':
      classes.push('sim-vis-servo');
      break;
    case 'relay':
      classes.push('sim-vis-relay');
      if (visualProps.props.energized) { classes.push('sim-vis-relay-energized'); }
      break;
    case 'switch':
      classes.push('sim-vis-switch');
      classes.push(visualProps.props.closed ? 'sim-vis-switch-closed' : 'sim-vis-switch-open');
      break;
    case 'buzzer':
      classes.push('sim-vis-buzzer');
      if (visualProps.props.pulsing) { classes.push('sim-vis-buzzer-active'); }
      break;
    case 'potentiometer':
      classes.push('sim-vis-potentiometer');
      break;
    case 'seven_segment':
      classes.push('sim-vis-7seg');
      break;
    case 'generic':
      classes.push('sim-vis-generic');
      break;
  }

  return classes.join(' ');
}

/**
 * Batch-map all components in a circuit to visual properties.
 */
export function mapAllComponentVisuals(
  components: ComponentMapping[],
  simValues: SimulationValues,
): Map<string, ComponentVisualProps> {
  const result = new Map<string, ComponentVisualProps>();
  for (const comp of components) {
    result.set(comp.instanceId, mapSimulationToVisual(comp.componentType, simValues, comp));
  }
  return result;
}
