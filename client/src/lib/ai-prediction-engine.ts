/**
 * AI Prediction Engine — proactively suggests what the user needs next based
 * on the current design state (architecture nodes, edges, BOM items).
 *
 * Singleton + Subscribe pattern.  localStorage persistence for dismiss
 * cooldowns and per-rule feedback tracking.
 *
 * Domain knowledge for rules shared with the Proactive Healing Engine
 * (decoupling, flyback, …) lives in `shared/electronics-knowledge.ts`.  Do
 * not duplicate explanations or default component values here — update the
 * shared file instead so both engines see the change.
 */

import { getElectronicsKnowledge } from '@shared/electronics-knowledge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PredictionCategory =
  | 'missing_component'
  | 'best_practice'
  | 'safety'
  | 'optimization'
  | 'learning_tip';

export interface PredictionAction {
  type: 'add_component' | 'add_connection' | 'modify_value' | 'open_view' | 'show_info';
  payload: Record<string, unknown>;
}

export interface Prediction {
  id: string;
  ruleId: string;
  title: string;
  description: string;
  confidence: number;
  category: PredictionCategory;
  action?: PredictionAction;
  dismissed: boolean;
}

/** Minimal node representation consumed by the engine. */
export interface PredictionNode {
  id: string;
  type: string;
  label: string;
  data?: {
    partNumber?: string;
    description?: string;
    manufacturer?: string;
    specs?: Record<string, string>;
  };
}

/** Minimal edge representation consumed by the engine. */
export interface PredictionEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  signalType?: string;
  voltage?: string;
}

/** Minimal BOM item representation consumed by the engine. */
export interface PredictionBomItem {
  id: string;
  partNumber: string;
  description: string;
  manufacturer?: string;
  quantity: number;
}

export interface PredictionRule {
  id: string;
  name: string;
  category: PredictionCategory;
  baseConfidence: number;
  check: (nodes: PredictionNode[], edges: PredictionEdge[], bom: PredictionBomItem[]) => Prediction[];
}

interface DismissRecord {
  ruleId: string;
  dismissedAt: number;
}

interface FeedbackRecord {
  ruleId: string;
  accepts: number;
  dismisses: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY_DISMISSALS = 'protopulse-prediction-dismissals';
const STORAGE_KEY_FEEDBACK = 'protopulse-prediction-feedback';
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_SUGGESTIONS = 5;
const DEBOUNCE_MS = 2000;

// ---------------------------------------------------------------------------
// Node-classification helpers
// ---------------------------------------------------------------------------

const MCU_PATTERNS = [
  'mcu', 'microcontroller', 'arduino', 'esp32', 'esp8266', 'stm32',
  'atmega', 'attiny', 'processor', 'controller', 'pic', 'nrf52',
];
const SENSOR_PATTERNS = ['sensor', 'thermistor', 'photodiode', 'accelerometer', 'gyroscope', 'humidity', 'pressure', 'temperature'];
const MOTOR_PATTERNS = ['motor', 'stepper', 'servo', 'actuator', 'dc-motor', 'bldc'];
const RELAY_PATTERNS = ['relay', 'solenoid', 'contactor'];
const REGULATOR_PATTERNS = ['regulator', 'vreg', 'ldo', 'buck', 'boost', 'switching-regulator'];
const CAPACITOR_PATTERNS = ['capacitor', 'cap', 'decoupling', 'bypass', '100nf', '10uf'];
const CRYSTAL_PATTERNS = ['crystal', 'oscillator', 'xtal', 'resonator', 'clock'];
const DIODE_PATTERNS = ['diode', 'flyback', 'schottky', 'zener', 'tvs', 'rectifier'];
const RESISTOR_PATTERNS = ['resistor', 'pull-up', 'pull-down', 'pullup', 'pulldown', 'current-limit'];
const LED_PATTERNS = ['led', 'light-emitting', 'indicator', 'neopixel', 'ws2812'];
const H_BRIDGE_PATTERNS = ['h-bridge', 'hbridge', 'motor-driver', 'l298', 'l293', 'drv8825', 'a4988'];
const USB_PATTERNS = ['usb', 'usb-c', 'usb-a', 'usb-b', 'micro-usb'];
const FUSE_PATTERNS = ['fuse', 'polyfuse', 'ptc', 'circuit-breaker'];
const VARISTOR_PATTERNS = ['varistor', 'mov', 'surge'];
const BATTERY_PATTERNS = ['battery', 'lipo', 'li-ion', 'cell', 'coin-cell'];
const OPTOCOUPLER_PATTERNS = ['optocoupler', 'opto-isolator', 'isolation', 'isolator'];
const INDUCTOR_PATTERNS = ['inductor', 'choke', 'ferrite', 'coil'];
const CONNECTOR_PATTERNS = ['connector', 'header', 'terminal', 'jack', 'plug', 'socket'];
const ADC_PATTERNS = ['adc', 'analog-to-digital', 'analog_to_digital'];
const FILTER_PATTERNS = ['filter', 'rc-filter', 'lc-filter', 'lowpass', 'highpass', 'bandpass'];
const TRANSISTOR_PATTERNS = ['transistor', 'mosfet', 'bjt', 'fet', 'igbt'];
const TEST_POINT_PATTERNS = ['test-point', 'testpoint', 'tp', 'test_point'];
const MOUNTING_PATTERNS = ['mounting', 'mount-hole', 'standoff', 'mounting-hole'];
const POWER_INDICATOR_PATTERNS = ['power-led', 'power-indicator', 'pwr-led'];
const HEATSINK_PATTERNS = ['heatsink', 'heat-sink', 'thermal-pad', 'thermal'];
const MAINS_PATTERNS = ['mains', 'ac-input', '120v', '240v', '230v', 'line-voltage'];
const HIGH_VOLTAGE_PATTERNS = ['high-voltage', 'hv', '48v', '60v', '100v'];
const GROUND_PATTERNS = ['ground', 'gnd', 'earth'];

function matchesAny(text: string, patterns: string[]): boolean {
  const lower = text.toLowerCase();
  return patterns.some((p) => lower.includes(p));
}

function nodeMatches(node: PredictionNode, patterns: string[]): boolean {
  return matchesAny(node.type, patterns) || matchesAny(node.label, patterns) ||
    (node.data?.description ? matchesAny(node.data.description, patterns) : false);
}

function isMcu(n: PredictionNode): boolean { return nodeMatches(n, MCU_PATTERNS); }
function isSensor(n: PredictionNode): boolean { return nodeMatches(n, SENSOR_PATTERNS); }
function isMotor(n: PredictionNode): boolean { return nodeMatches(n, MOTOR_PATTERNS); }
function isRelay(n: PredictionNode): boolean { return nodeMatches(n, RELAY_PATTERNS); }
function isRegulator(n: PredictionNode): boolean { return nodeMatches(n, REGULATOR_PATTERNS); }
function isCapacitor(n: PredictionNode): boolean { return nodeMatches(n, CAPACITOR_PATTERNS); }
function isCrystal(n: PredictionNode): boolean { return nodeMatches(n, CRYSTAL_PATTERNS); }
function isDiode(n: PredictionNode): boolean { return nodeMatches(n, DIODE_PATTERNS); }
function isResistor(n: PredictionNode): boolean { return nodeMatches(n, RESISTOR_PATTERNS); }
function isLed(n: PredictionNode): boolean { return nodeMatches(n, LED_PATTERNS); }
function isHBridge(n: PredictionNode): boolean { return nodeMatches(n, H_BRIDGE_PATTERNS); }
function isUsb(n: PredictionNode): boolean {
  if (!nodeMatches(n, USB_PATTERNS)) { return false; }
  // Exclude nodes that are ESD/TVS protection ICs (e.g. "USBLC6 ESD Protection")
  if (nodeMatches(n, ['tvs', 'esd', 'protection', 'clamp', 'suppressor'])) { return false; }
  return true;
}
function isFuse(n: PredictionNode): boolean { return nodeMatches(n, FUSE_PATTERNS); }
function isBattery(n: PredictionNode): boolean { return nodeMatches(n, BATTERY_PATTERNS); }
function isOptocoupler(n: PredictionNode): boolean { return nodeMatches(n, OPTOCOUPLER_PATTERNS); }
function isInductor(n: PredictionNode): boolean { return nodeMatches(n, INDUCTOR_PATTERNS); }
function isConnector(n: PredictionNode): boolean { return nodeMatches(n, CONNECTOR_PATTERNS); }
function hasAdc(n: PredictionNode): boolean { return nodeMatches(n, ADC_PATTERNS) || isMcu(n); }
function isFilter(n: PredictionNode): boolean { return nodeMatches(n, FILTER_PATTERNS); }
function isTransistor(n: PredictionNode): boolean { return nodeMatches(n, TRANSISTOR_PATTERNS); }
function isTestPoint(n: PredictionNode): boolean { return nodeMatches(n, TEST_POINT_PATTERNS); }
function isMounting(n: PredictionNode): boolean { return nodeMatches(n, MOUNTING_PATTERNS); }
function isPowerIndicator(n: PredictionNode): boolean { return nodeMatches(n, POWER_INDICATOR_PATTERNS); }
function isHeatsink(n: PredictionNode): boolean { return nodeMatches(n, HEATSINK_PATTERNS); }
function isMainsVoltage(n: PredictionNode): boolean { return nodeMatches(n, MAINS_PATTERNS); }
function isHighVoltage(n: PredictionNode): boolean { return nodeMatches(n, HIGH_VOLTAGE_PATTERNS); }
function isGround(n: PredictionNode): boolean { return nodeMatches(n, GROUND_PATTERNS); }

// ---------------------------------------------------------------------------
// Adjacency helpers
// ---------------------------------------------------------------------------

function buildAdjacency(edges: PredictionEdge[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  edges.forEach((e) => {
    if (!adj.has(e.source)) { adj.set(e.source, new Set()); }
    adj.get(e.source)!.add(e.target);
    if (!adj.has(e.target)) { adj.set(e.target, new Set()); }
    adj.get(e.target)!.add(e.source);
  });
  return adj;
}

function connectedNodes(nodeId: string, adj: Map<string, Set<string>>, allNodes: PredictionNode[]): PredictionNode[] {
  const ids = adj.get(nodeId);
  if (!ids) { return []; }
  return allNodes.filter((n) => ids.has(n.id));
}

function makePrediction(
  ruleId: string,
  title: string,
  description: string,
  confidence: number,
  category: PredictionCategory,
  action?: PredictionAction,
): Prediction {
  return {
    id: `${ruleId}-${crypto.randomUUID()}`,
    ruleId,
    title,
    description,
    confidence,
    category,
    action,
    dismissed: false,
  };
}

// ---------------------------------------------------------------------------
// Built-in Prediction Rules (32 rules)
// ---------------------------------------------------------------------------

function makeMcuDecouplingCaps(): PredictionRule {
  const k = getElectronicsKnowledge('decoupling');
  return {
    id: 'mcu-decoupling-caps',
    name: 'MCU decoupling capacitors',
    category: 'missing_component',
    baseConfidence: 0.95,
    check(nodes, edges) {
      const adj = buildAdjacency(edges);
      const preds: Prediction[] = [];
      nodes.filter(isMcu).forEach((mcu) => {
        const neighbours = connectedNodes(mcu.id, adj, nodes);
        const hasCap = neighbours.some(isCapacitor);
        if (!hasCap) {
          preds.push(makePrediction(
            'mcu-decoupling-caps',
            `Add decoupling capacitors for ${mcu.label}`,
            `MCU "${mcu.label}" — ${k.explanation}`,
            0.95,
            'missing_component',
            { type: 'add_component', payload: { component: 'capacitor', value: '100nF', near: mcu.id } },
          ));
        }
      });
      return preds;
    },
  };
}

function makeMcuCrystal(): PredictionRule {
  return {
    id: 'mcu-crystal',
    name: 'MCU clock source',
    category: 'missing_component',
    baseConfidence: 0.80,
    check(nodes, edges) {
      const adj = buildAdjacency(edges);
      const preds: Prediction[] = [];
      nodes.filter(isMcu).forEach((mcu) => {
        const neighbours = connectedNodes(mcu.id, adj, nodes);
        const hasClock = neighbours.some(isCrystal);
        const allCrystals = nodes.some(isCrystal);
        if (!hasClock && !allCrystals) {
          preds.push(makePrediction(
            'mcu-crystal',
            `Add crystal/oscillator for ${mcu.label}`,
            'Most MCUs need an external crystal or oscillator for accurate timing. Internal RC oscillators are less precise and may not support USB or UART at higher baud rates.',
            0.80,
            'missing_component',
            { type: 'add_component', payload: { component: 'crystal', near: mcu.id } },
          ));
        }
      });
      return preds;
    },
  };
}

function makeMotorFlybackDiode(): PredictionRule {
  const k = getElectronicsKnowledge('flyback-diode');
  return {
    id: 'motor-flyback-diode',
    name: 'Motor flyback diode',
    category: 'missing_component',
    baseConfidence: 0.93,
    check(nodes, edges) {
      const adj = buildAdjacency(edges);
      const preds: Prediction[] = [];
      const inductiveLoads = nodes.filter((n) => isMotor(n) || isRelay(n));
      inductiveLoads.forEach((load) => {
        const neighbours = connectedNodes(load.id, adj, nodes);
        const hasDiode = neighbours.some(isDiode);
        if (!hasDiode) {
          preds.push(makePrediction(
            'motor-flyback-diode',
            `Add flyback diode for ${load.label}`,
            `Inductive load "${load.label}" — ${k.explanation}`,
            0.93,
            'missing_component',
            { type: 'add_component', payload: { component: 'diode', type: 'flyback', near: load.id } },
          ));
        }
      });
      return preds;
    },
  };
}

function makeRegulatorCaps(): PredictionRule {
  return {
    id: 'regulator-caps',
    name: 'Voltage regulator capacitors',
    category: 'missing_component',
    baseConfidence: 0.92,
    check(nodes, edges) {
      const adj = buildAdjacency(edges);
      const preds: Prediction[] = [];
      nodes.filter(isRegulator).forEach((reg) => {
        const neighbours = connectedNodes(reg.id, adj, nodes);
        const capCount = neighbours.filter(isCapacitor).length;
        if (capCount < 2) {
          preds.push(makePrediction(
            'regulator-caps',
            `Add input/output capacitors for ${reg.label}`,
            `Voltage regulator "${reg.label}" needs an input capacitor (10 \u00B5F) and output capacitor (10 \u00B5F + 100 nF) for stability. Without them, the regulator may oscillate or produce noisy output.`,
            0.92,
            'missing_component',
            { type: 'add_component', payload: { component: 'capacitor', value: '10uF+100nF', near: reg.id } },
          ));
        }
      });
      return preds;
    },
  };
}

function makeIcBypassCap(): PredictionRule {
  return {
    id: 'ic-bypass-cap',
    name: 'IC bypass capacitor',
    category: 'missing_component',
    baseConfidence: 0.88,
    check(nodes, edges) {
      const adj = buildAdjacency(edges);
      const preds: Prediction[] = [];
      const ics = nodes.filter((n) =>
        n.type === 'generic' && n.data?.description &&
        /\b(ic|chip|driver|amplifier|op-amp|comparator|timer|shift.register)\b/i.test(n.data.description) &&
        !isMcu(n) && !isRegulator(n),
      );
      ics.forEach((ic) => {
        const neighbours = connectedNodes(ic.id, adj, nodes);
        if (!neighbours.some(isCapacitor)) {
          preds.push(makePrediction(
            'ic-bypass-cap',
            `Add bypass capacitor for ${ic.label}`,
            `IC "${ic.label}" should have a 100 nF ceramic bypass capacitor between VCC and GND, placed as close to the chip as possible.`,
            0.88,
            'missing_component',
            { type: 'add_component', payload: { component: 'capacitor', value: '100nF', near: ic.id } },
          ));
        }
      });
      return preds;
    },
  };
}

function makeReversePolarity(): PredictionRule {
  return {
    id: 'reverse-polarity-protection',
    name: 'Reverse polarity protection',
    category: 'missing_component',
    baseConfidence: 0.85,
    check(nodes) {
      const preds: Prediction[] = [];
      const hasPowerSource = nodes.some((n) => nodeMatches(n, ['battery', 'power-supply', 'barrel-jack', 'vin']));
      const hasProtection = nodes.some((n) => nodeMatches(n, ['reverse-polarity', 'p-mosfet', 'schottky']));
      if (hasPowerSource && !hasProtection) {
        preds.push(makePrediction(
          'reverse-polarity-protection',
          'Add reverse polarity protection',
          'Your design has an external power input but no reverse polarity protection. A series Schottky diode or P-channel MOSFET prevents damage if the power connector is wired backwards.',
          0.85,
          'missing_component',
          { type: 'add_component', payload: { component: 'diode', type: 'schottky' } },
        ));
      }
      return preds;
    },
  };
}

function makeAdcReferenceVoltage(): PredictionRule {
  return {
    id: 'adc-reference-voltage',
    name: 'ADC reference voltage',
    category: 'missing_component',
    baseConfidence: 0.72,
    check(nodes) {
      const preds: Prediction[] = [];
      const hasADC = nodes.some((n) => nodeMatches(n, ADC_PATTERNS) && !isMcu(n));
      const hasSensor = nodes.some(isSensor);
      const hasVref = nodes.some((n) => nodeMatches(n, ['reference', 'vref', 'voltage-reference']));
      if (hasADC && hasSensor && !hasVref) {
        preds.push(makePrediction(
          'adc-reference-voltage',
          'Add voltage reference for ADC',
          'Your design has an ADC reading sensor values. A precision voltage reference improves measurement accuracy compared to using the supply rail as reference.',
          0.72,
          'missing_component',
          { type: 'add_component', payload: { component: 'voltage-reference' } },
        ));
      }
      return preds;
    },
  };
}

function makeLedResistor(): PredictionRule {
  return {
    id: 'led-current-resistor',
    name: 'LED current limiting resistor',
    category: 'missing_component',
    baseConfidence: 0.94,
    check(nodes, edges) {
      const adj = buildAdjacency(edges);
      const preds: Prediction[] = [];
      nodes.filter(isLed).forEach((led) => {
        const neighbours = connectedNodes(led.id, adj, nodes);
        const hasResistor = neighbours.some(isResistor);
        if (!hasResistor) {
          preds.push(makePrediction(
            'led-current-resistor',
            `Add current limiting resistor for ${led.label}`,
            `LED "${led.label}" needs a series resistor to limit current. Without it, the LED will draw too much current and burn out quickly. Typical values: 220\u03A9-1k\u03A9 for 3.3V/5V supplies.`,
            0.94,
            'missing_component',
            { type: 'add_component', payload: { component: 'resistor', value: '330R', near: led.id } },
          ));
        }
      });
      return preds;
    },
  };
}

function makeHBridgeBootstrapCaps(): PredictionRule {
  return {
    id: 'hbridge-bootstrap-caps',
    name: 'H-bridge bootstrap capacitors',
    category: 'missing_component',
    baseConfidence: 0.82,
    check(nodes, edges) {
      const adj = buildAdjacency(edges);
      const preds: Prediction[] = [];
      nodes.filter(isHBridge).forEach((hb) => {
        const neighbours = connectedNodes(hb.id, adj, nodes);
        const capCount = neighbours.filter(isCapacitor).length;
        if (capCount < 1) {
          preds.push(makePrediction(
            'hbridge-bootstrap-caps',
            `Add bootstrap capacitors for ${hb.label}`,
            `H-bridge/motor driver "${hb.label}" typically requires bootstrap capacitors for the high-side drivers. Check the datasheet for recommended values (usually 100 nF-1 \u00B5F).`,
            0.82,
            'missing_component',
            { type: 'add_component', payload: { component: 'capacitor', value: '100nF', near: hb.id } },
          ));
        }
      });
      return preds;
    },
  };
}

function makeUsbEsdProtection(): PredictionRule {
  return {
    id: 'usb-esd-protection',
    name: 'USB ESD protection',
    category: 'missing_component',
    baseConfidence: 0.86,
    check(nodes, edges) {
      const adj = buildAdjacency(edges);
      const preds: Prediction[] = [];
      nodes.filter(isUsb).forEach((usb) => {
        const neighbours = connectedNodes(usb.id, adj, nodes);
        const hasTvs = neighbours.some((n) => nodeMatches(n, ['tvs', 'esd', 'protection']));
        if (!hasTvs) {
          preds.push(makePrediction(
            'usb-esd-protection',
            `Add ESD protection for ${usb.label}`,
            `USB connector "${usb.label}" is exposed to external connections and needs TVS diodes on the data lines. Components like USBLC6-2 or TPD2E001 protect against ESD damage.`,
            0.86,
            'missing_component',
            { type: 'add_component', payload: { component: 'tvs-diode', near: usb.id } },
          ));
        }
      });
      return preds;
    },
  };
}

// -- Best Practice Rules --

function makePowerIndicator(): PredictionRule {
  return {
    id: 'power-indicator',
    name: 'Power indicator LED',
    category: 'best_practice',
    baseConfidence: 0.70,
    check(nodes) {
      const preds: Prediction[] = [];
      const hasPower = nodes.some((n) => isRegulator(n) || isBattery(n) || nodeMatches(n, ['power-supply', 'vin']));
      const hasIndicator = nodes.some(isPowerIndicator) || nodes.some((n) => isLed(n) && nodeMatches(n, ['power', 'pwr', 'status']));
      if (hasPower && !hasIndicator && nodes.length > 2) {
        preds.push(makePrediction(
          'power-indicator',
          'Add a power indicator LED',
          'A simple LED with a series resistor on the power rail gives you instant visual feedback that the board is powered. This is one of the easiest debugging aids you can add.',
          0.70,
          'best_practice',
          { type: 'add_component', payload: { component: 'led', label: 'Power LED' } },
        ));
      }
      return preds;
    },
  };
}

function makeFerriteBeadSharedPower(): PredictionRule {
  return {
    id: 'ferrite-bead-shared-power',
    name: 'Ferrite bead for shared power rail',
    category: 'best_practice',
    baseConfidence: 0.65,
    check(nodes, edges) {
      const adj = buildAdjacency(edges);
      const preds: Prediction[] = [];
      const ics = nodes.filter((n) => isMcu(n) || nodeMatches(n, ['ic', 'chip', 'driver']));
      if (ics.length >= 3) {
        const hasFerrite = nodes.some(isInductor) || nodes.some((n) => nodeMatches(n, ['ferrite']));
        if (!hasFerrite) {
          const shared = ics.some((ic) => {
            const neighbours = connectedNodes(ic.id, adj, nodes);
            return neighbours.some((nb) => ics.includes(nb));
          });
          if (shared || ics.length >= 3) {
            preds.push(makePrediction(
              'ferrite-bead-shared-power',
              'Add ferrite bead between digital/analog power',
              'With multiple ICs sharing a power rail, a ferrite bead between digital and analog sections reduces high-frequency noise coupling. Place it on the VCC trace feeding sensitive analog components.',
              0.65,
              'best_practice',
              { type: 'add_component', payload: { component: 'ferrite-bead' } },
            ));
          }
        }
      }
      return preds;
    },
  };
}

function makeHighCurrentTraces(): PredictionRule {
  return {
    id: 'high-current-traces',
    name: 'High-current trace width',
    category: 'best_practice',
    baseConfidence: 0.75,
    check(nodes) {
      const preds: Prediction[] = [];
      const hasMotor = nodes.some(isMotor);
      const hasHighPower = nodes.some((n) => nodeMatches(n, ['high-current', 'power-stage', 'h-bridge']));
      if (hasMotor || hasHighPower) {
        preds.push(makePrediction(
          'high-current-traces',
          'Use wider traces for high-current paths',
          'Motors and power stages draw significant current. Standard 6-mil traces can only handle ~0.5A. Use 20-50 mil traces or copper pours for power paths to prevent overheating.',
          0.75,
          'best_practice',
          { type: 'show_info', payload: { topic: 'trace-width-calculator' } },
        ));
      }
      return preds;
    },
  };
}

function makeSwitchingRegulatorInductor(): PredictionRule {
  return {
    id: 'switching-regulator-inductor',
    name: 'Switching regulator inductor',
    category: 'best_practice',
    baseConfidence: 0.78,
    check(nodes, edges) {
      const adj = buildAdjacency(edges);
      const preds: Prediction[] = [];
      const switchingRegs = nodes.filter((n) => nodeMatches(n, ['buck', 'boost', 'switching']));
      switchingRegs.forEach((reg) => {
        const neighbours = connectedNodes(reg.id, adj, nodes);
        if (!neighbours.some(isInductor)) {
          preds.push(makePrediction(
            'switching-regulator-inductor',
            `Verify inductor selection for ${reg.label}`,
            `Switching regulator "${reg.label}" requires a properly rated inductor. Select based on the datasheet-recommended inductance, saturation current (\u22651.3\u00D7 max load), and DC resistance.`,
            0.78,
            'best_practice',
            { type: 'show_info', payload: { topic: 'inductor-selection', near: reg.id } },
          ));
        }
      });
      return preds;
    },
  };
}

function makeSensorFiltering(): PredictionRule {
  return {
    id: 'sensor-filtering',
    name: 'Sensor signal filtering',
    category: 'best_practice',
    baseConfidence: 0.68,
    check(nodes, edges) {
      const adj = buildAdjacency(edges);
      const preds: Prediction[] = [];
      nodes.filter(isSensor).forEach((sensor) => {
        const neighbours = connectedNodes(sensor.id, adj, nodes);
        const hasFilter = neighbours.some(isFilter) || neighbours.some((n) => isCapacitor(n) && isResistor(n));
        if (!hasFilter) {
          preds.push(makePrediction(
            'sensor-filtering',
            `Add filtering for ${sensor.label}`,
            `Sensor "${sensor.label}" output may contain noise. An RC low-pass filter (resistor + capacitor) on the signal line cleans up the reading before it reaches the ADC.`,
            0.68,
            'best_practice',
            { type: 'add_component', payload: { component: 'rc-filter', near: sensor.id } },
          ));
        }
      });
      return preds;
    },
  };
}

function makeStarGrounding(): PredictionRule {
  return {
    id: 'star-grounding',
    name: 'Star grounding topology',
    category: 'best_practice',
    baseConfidence: 0.60,
    check(nodes) {
      const preds: Prediction[] = [];
      const grounds = nodes.filter(isGround);
      if (grounds.length > 2) {
        preds.push(makePrediction(
          'star-grounding',
          'Consider star grounding topology',
          'Multiple ground connections can create ground loops. Route all ground returns to a single star point to minimize noise from current flowing through shared ground paths.',
          0.60,
          'best_practice',
          { type: 'show_info', payload: { topic: 'star-grounding' } },
        ));
      }
      return preds;
    },
  };
}

function makeTestPoints(): PredictionRule {
  return {
    id: 'no-test-points',
    name: 'Add test points',
    category: 'best_practice',
    baseConfidence: 0.65,
    check(nodes) {
      const preds: Prediction[] = [];
      if (nodes.length >= 5 && !nodes.some(isTestPoint)) {
        preds.push(makePrediction(
          'no-test-points',
          'Add test points for debugging',
          'Your design has no test points. Adding test pads on key signals (power rails, data buses, clock) makes debugging with a multimeter or oscilloscope much easier.',
          0.65,
          'best_practice',
          { type: 'add_component', payload: { component: 'test-point' } },
        ));
      }
      return preds;
    },
  };
}

function makeMountingHoles(): PredictionRule {
  return {
    id: 'no-mounting-holes',
    name: 'Add mounting holes',
    category: 'best_practice',
    baseConfidence: 0.62,
    check(nodes) {
      const preds: Prediction[] = [];
      if (nodes.length >= 5 && !nodes.some(isMounting)) {
        preds.push(makePrediction(
          'no-mounting-holes',
          'Add mounting holes to your board',
          'Your design has no mounting holes. Adding 4 M3 mounting holes at the corners allows you to securely fasten the PCB in an enclosure or onto standoffs.',
          0.62,
          'best_practice',
          { type: 'add_component', payload: { component: 'mounting-hole', count: 4 } },
        ));
      }
      return preds;
    },
  };
}

// -- Safety Rules --

function makeMainsFuse(): PredictionRule {
  return {
    id: 'mains-fuse',
    name: 'Mains fuse and varistor',
    category: 'safety',
    baseConfidence: 0.97,
    check(nodes) {
      const preds: Prediction[] = [];
      if (nodes.some(isMainsVoltage)) {
        if (!nodes.some(isFuse)) {
          preds.push(makePrediction(
            'mains-fuse',
            'Add fuse and varistor for mains input',
            'Your design connects to mains voltage. A fuse is MANDATORY for safety, and a varistor (MOV) protects against voltage surges. This is a safety requirement, not optional.',
            0.97,
            'safety',
            { type: 'add_component', payload: { component: 'fuse', type: 'mains' } },
          ));
        }
      }
      return preds;
    },
  };
}

function makeBatteryProtection(): PredictionRule {
  return {
    id: 'battery-protection',
    name: 'Battery protection circuit',
    category: 'safety',
    baseConfidence: 0.91,
    check(nodes) {
      const preds: Prediction[] = [];
      if (nodes.some(isBattery)) {
        const hasProtection = nodes.some((n) => nodeMatches(n, ['bms', 'battery-protection', 'undervoltage', 'overcurrent', 'charge-controller']));
        if (!hasProtection) {
          preds.push(makePrediction(
            'battery-protection',
            'Add battery protection circuit',
            'Battery-powered designs need protection against overcurrent, undervoltage, and overcharge. A BMS (Battery Management System) or protection IC prevents battery damage and fire risk.',
            0.91,
            'safety',
            { type: 'add_component', payload: { component: 'battery-protection' } },
          ));
        }
      }
      return preds;
    },
  };
}

function makeMotorCurrentSensing(): PredictionRule {
  return {
    id: 'motor-current-sensing',
    name: 'Motor current sensing',
    category: 'safety',
    baseConfidence: 0.76,
    check(nodes) {
      const preds: Prediction[] = [];
      const motors = nodes.filter(isMotor);
      if (motors.length > 0) {
        const hasSensing = nodes.some((n) => nodeMatches(n, ['current-sense', 'shunt', 'ina219', 'acs712']));
        if (!hasSensing) {
          preds.push(makePrediction(
            'motor-current-sensing',
            'Add current sensing for motors',
            'Motors can stall and draw excessive current, damaging drivers and wiring. A current sense resistor or IC (like INA219) lets your MCU detect overcurrent and shut down safely.',
            0.76,
            'safety',
            { type: 'add_component', payload: { component: 'current-sense' } },
          ));
        }
      }
      return preds;
    },
  };
}

function makeHighVoltageIsolation(): PredictionRule {
  return {
    id: 'high-voltage-isolation',
    name: 'High voltage isolation',
    category: 'safety',
    baseConfidence: 0.90,
    check(nodes) {
      const preds: Prediction[] = [];
      const hasHV = nodes.some(isHighVoltage) || nodes.some(isMainsVoltage);
      const hasLowVoltage = nodes.some(isMcu) || nodes.some(isSensor);
      if (hasHV && hasLowVoltage) {
        const hasIsolation = nodes.some(isOptocoupler) || nodes.some((n) => nodeMatches(n, ['isolation', 'isolated', 'galvanic']));
        if (!hasIsolation) {
          preds.push(makePrediction(
            'high-voltage-isolation',
            'Add galvanic isolation',
            'Your design mixes high and low voltage sections. An optocoupler or digital isolator between them protects the low-voltage side (and you!) from dangerous voltages.',
            0.90,
            'safety',
            { type: 'add_component', payload: { component: 'optocoupler' } },
          ));
        }
      }
      return preds;
    },
  };
}

function makeConnectorEsdProtection(): PredictionRule {
  return {
    id: 'connector-esd-protection',
    name: 'Connector ESD protection',
    category: 'safety',
    baseConfidence: 0.78,
    check(nodes, edges) {
      const adj = buildAdjacency(edges);
      const preds: Prediction[] = [];
      const exposedConnectors = nodes.filter(isConnector);
      if (exposedConnectors.length > 0) {
        const anyProtected = exposedConnectors.some((conn) => {
          const neighbours = connectedNodes(conn.id, adj, nodes);
          return neighbours.some((n) => nodeMatches(n, ['tvs', 'esd', 'protection']));
        });
        if (!anyProtected) {
          preds.push(makePrediction(
            'connector-esd-protection',
            'Add ESD protection on external connectors',
            'Exposed connectors are entry points for ESD damage. TVS diode arrays on signal lines protect sensitive ICs from electrostatic discharge during handling and use.',
            0.78,
            'safety',
            { type: 'add_component', payload: { component: 'tvs-diode-array' } },
          ));
        }
      }
      return preds;
    },
  };
}

function makeThermalManagement(): PredictionRule {
  return {
    id: 'thermal-management',
    name: 'Thermal management',
    category: 'safety',
    baseConfidence: 0.73,
    check(nodes) {
      const preds: Prediction[] = [];
      const powerComponents = nodes.filter((n) => isRegulator(n) || isHBridge(n) || isTransistor(n));
      if (powerComponents.length > 0) {
        const hasHeatsink = nodes.some(isHeatsink);
        if (!hasHeatsink) {
          preds.push(makePrediction(
            'thermal-management',
            'Add thermal management for power components',
            'Power regulators, motor drivers, and transistors generate heat. Without adequate thermal management (heatsinks, thermal vias, copper pours), they may overheat and shut down or fail.',
            0.73,
            'safety',
            { type: 'show_info', payload: { topic: 'thermal-design' } },
          ));
        }
      }
      return preds;
    },
  };
}

// -- Optimization Rules --

function makeDuplicateResistorValues(): PredictionRule {
  return {
    id: 'duplicate-resistor-values',
    name: 'Consolidate resistor values',
    category: 'optimization',
    baseConfidence: 0.60,
    check(_nodes, _edges, bom) {
      const preds: Prediction[] = [];
      const resistors = bom.filter((b) => /resistor|res|ohm|\u03A9/i.test(b.description));
      if (resistors.length >= 4) {
        const uniqueValues = new Set(resistors.map((r) => r.description.toLowerCase().trim()));
        if (uniqueValues.size >= 4) {
          preds.push(makePrediction(
            'duplicate-resistor-values',
            'Consolidate resistor values',
            `Your BOM has ${uniqueValues.size} different resistor values. Consider standardizing on fewer values (e.g., E12 series) to reduce unique part count and simplify procurement.`,
            0.60,
            'optimization',
            { type: 'open_view', payload: { view: 'bom' } },
          ));
        }
      }
      return preds;
    },
  };
}

function makeSingleSourceRisk(): PredictionRule {
  return {
    id: 'single-source-risk',
    name: 'Single-source component risk',
    category: 'optimization',
    baseConfidence: 0.67,
    check(_nodes, _edges, bom) {
      const preds: Prediction[] = [];
      const byManufacturer = new Map<string, number>();
      bom.forEach((item) => {
        if (item.manufacturer) {
          byManufacturer.set(item.manufacturer, (byManufacturer.get(item.manufacturer) ?? 0) + 1);
        }
      });
      const totalItems = bom.length;
      if (totalItems >= 5) {
        for (const [mfr, count] of Array.from(byManufacturer.entries())) {
          if (count >= Math.ceil(totalItems * 0.6)) {
            preds.push(makePrediction(
              'single-source-risk',
              'Diversify component manufacturers',
              `${Math.round((count / totalItems) * 100)}% of your BOM is from ${mfr}. Consider alternate manufacturers for critical components to reduce supply chain risk.`,
              0.67,
              'optimization',
              { type: 'open_view', payload: { view: 'procurement' } },
            ));
            break;
          }
        }
      }
      return preds;
    },
  };
}

function makeIntegratedSolution(): PredictionRule {
  return {
    id: 'integrated-solution',
    name: 'Consider integrated solution',
    category: 'optimization',
    baseConfidence: 0.55,
    check(nodes) {
      const preds: Prediction[] = [];
      const discreteCount = nodes.filter((n) => isResistor(n) || isCapacitor(n) || isDiode(n) || isTransistor(n)).length;
      if (discreteCount >= 10) {
        preds.push(makePrediction(
          'integrated-solution',
          'Consider integrated IC alternatives',
          `Your design has ${discreteCount} discrete components. Some functions may be available as integrated ICs that reduce board space, assembly cost, and component count.`,
          0.55,
          'optimization',
          { type: 'show_info', payload: { topic: 'integration-opportunities' } },
        ));
      }
      return preds;
    },
  };
}

function makeUnusedMcuPins(): PredictionRule {
  return {
    id: 'unused-mcu-pins',
    name: 'Expose unused MCU pins',
    category: 'optimization',
    baseConfidence: 0.58,
    check(nodes, edges) {
      const adj = buildAdjacency(edges);
      const preds: Prediction[] = [];
      const mcus = nodes.filter(isMcu);
      mcus.forEach((mcu) => {
        const connectionCount = (adj.get(mcu.id)?.size ?? 0);
        if (connectionCount < 5 && nodes.length >= 3) {
          preds.push(makePrediction(
            'unused-mcu-pins',
            `Add test headers for unused ${mcu.label} pins`,
            `MCU "${mcu.label}" appears to have spare I/O pins. Breaking them out to a header gives you expansion options for future features without a board respin.`,
            0.58,
            'optimization',
            { type: 'add_component', payload: { component: 'pin-header', near: mcu.id } },
          ));
        }
      });
      return preds;
    },
  };
}

// -- Learning Tips --

function makeTipDatasheets(): PredictionRule {
  return {
    id: 'tip-datasheets',
    name: 'Learn to read datasheets',
    category: 'learning_tip',
    baseConfidence: 0.50,
    check(nodes) {
      const preds: Prediction[] = [];
      if (nodes.length >= 1 && nodes.length <= 3) {
        preds.push(makePrediction(
          'tip-datasheets',
          'Tip: How to read component datasheets',
          'Every component has a datasheet with electrical specs, pin diagrams, and application circuits. Start with the "Absolute Maximum Ratings" and "Typical Application" sections \u2014 they tell you the limits and a proven reference design.',
          0.50,
          'learning_tip',
          { type: 'show_info', payload: { topic: 'reading-datasheets' } },
        ));
      }
      return preds;
    },
  };
}

function makeTipDropoutVoltage(): PredictionRule {
  return {
    id: 'tip-dropout-voltage',
    name: 'Learn about dropout voltage',
    category: 'learning_tip',
    baseConfidence: 0.55,
    check(nodes) {
      const preds: Prediction[] = [];
      if (nodes.some(isRegulator)) {
        preds.push(makePrediction(
          'tip-dropout-voltage',
          'Tip: Understand dropout voltage',
          'A voltage regulator needs the input voltage to be higher than the output by at least the "dropout voltage." An LDO dropping 5V to 3.3V with 0.3V dropout needs at least 3.6V input. If the margin is too small, the output will sag.',
          0.55,
          'learning_tip',
          { type: 'show_info', payload: { topic: 'dropout-voltage' } },
        ));
      }
      return preds;
    },
  };
}

function makeTipDecouplingWhy(): PredictionRule {
  return {
    id: 'tip-decoupling-why',
    name: 'Why decoupling capacitors matter',
    category: 'learning_tip',
    baseConfidence: 0.52,
    check(nodes) {
      const preds: Prediction[] = [];
      if (nodes.some(isCapacitor)) {
        preds.push(makePrediction(
          'tip-decoupling-why',
          'Tip: Why decoupling capacitors matter',
          'ICs switch millions of times per second, causing tiny current spikes on the power rail. A 100 nF ceramic cap acts as a local energy reserve, supplying current instantly and keeping the voltage stable. Place them as close to the IC as physically possible.',
          0.52,
          'learning_tip',
          { type: 'show_info', payload: { topic: 'decoupling-capacitors' } },
        ));
      }
      return preds;
    },
  };
}

function makeTipBaseResistor(): PredictionRule {
  return {
    id: 'tip-base-resistor',
    name: 'Transistor base resistor calculation',
    category: 'learning_tip',
    baseConfidence: 0.53,
    check(nodes) {
      const preds: Prediction[] = [];
      if (nodes.some(isTransistor)) {
        preds.push(makePrediction(
          'tip-base-resistor',
          'Tip: Calculating base/gate resistors',
          'For a BJT transistor, the base resistor limits current into the base. Formula: R = (V_drive - 0.7V) / I_base. For switching, aim for I_base = I_collector / 10 (forced saturation). For MOSFETs, a gate resistor (10-100\u03A9) limits ringing.',
          0.53,
          'learning_tip',
          { type: 'show_info', payload: { topic: 'transistor-biasing' } },
        ));
      }
      return preds;
    },
  };
}

// ---------------------------------------------------------------------------
// All rules
// ---------------------------------------------------------------------------

function getAllRules(): PredictionRule[] {
  return [
    // Missing component (10)
    makeMcuDecouplingCaps(),
    makeMcuCrystal(),
    makeMotorFlybackDiode(),
    makeRegulatorCaps(),
    makeIcBypassCap(),
    makeReversePolarity(),
    makeAdcReferenceVoltage(),
    makeLedResistor(),
    makeHBridgeBootstrapCaps(),
    makeUsbEsdProtection(),
    // Best practice (8)
    makePowerIndicator(),
    makeFerriteBeadSharedPower(),
    makeHighCurrentTraces(),
    makeSwitchingRegulatorInductor(),
    makeSensorFiltering(),
    makeStarGrounding(),
    makeTestPoints(),
    makeMountingHoles(),
    // Safety (6)
    makeMainsFuse(),
    makeBatteryProtection(),
    makeMotorCurrentSensing(),
    makeHighVoltageIsolation(),
    makeConnectorEsdProtection(),
    makeThermalManagement(),
    // Optimization (4)
    makeDuplicateResistorValues(),
    makeSingleSourceRisk(),
    makeIntegratedSolution(),
    makeUnusedMcuPins(),
    // Learning tips (4)
    makeTipDatasheets(),
    makeTipDropoutVoltage(),
    makeTipDecouplingWhy(),
    makeTipBaseResistor(),
  ];
}

// ---------------------------------------------------------------------------
// PredictionEngine (singleton + subscribe)
// ---------------------------------------------------------------------------

export class PredictionEngine {
  private static instance: PredictionEngine | null = null;

  private rules: PredictionRule[];
  private predictions: Prediction[] = [];
  private subscribers: Set<() => void> = new Set();
  private dismissals: DismissRecord[] = [];
  private feedback: FeedbackRecord[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isAnalyzing = false;

  constructor() {
    this.rules = getAllRules();
    this.loadDismissals();
    this.loadFeedback();
  }

  static getInstance(): PredictionEngine {
    if (!PredictionEngine.instance) {
      PredictionEngine.instance = new PredictionEngine();
    }
    return PredictionEngine.instance;
  }

  static resetInstance(): void {
    if (PredictionEngine.instance?.debounceTimer) {
      clearTimeout(PredictionEngine.instance.debounceTimer);
    }
    PredictionEngine.instance = null;
  }

  // -----------------------------------------------------------------------
  // Analysis
  // -----------------------------------------------------------------------

  analyze(nodes: PredictionNode[], edges: PredictionEdge[], bom: PredictionBomItem[]): Prediction[] {
    this.isAnalyzing = true;
    this.notify();

    const allPredictions: Prediction[] = [];
    this.rules.forEach((rule) => {
      const results = rule.check(nodes, edges, bom);
      results.forEach((p) => {
        p.confidence = this.adjustConfidence(p.ruleId, p.confidence);
      });
      allPredictions.push(...results);
    });

    // Filter out recently dismissed and apply cooldown
    const now = Date.now();
    const activeDismissals = this.dismissals.filter((d) => now - d.dismissedAt < COOLDOWN_MS);
    this.dismissals = activeDismissals;
    this.saveDismissals();

    const dismissedRuleIds = new Set(activeDismissals.map((d) => d.ruleId));

    const filtered = allPredictions
      .filter((p) => !dismissedRuleIds.has(p.ruleId))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, MAX_SUGGESTIONS);

    this.predictions = filtered;
    this.isAnalyzing = false;
    this.notify();

    return filtered;
  }

  analyzeDebounced(nodes: PredictionNode[], edges: PredictionEdge[], bom: PredictionBomItem[]): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.analyze(nodes, edges, bom);
      this.debounceTimer = null;
    }, DEBOUNCE_MS);
  }

  // -----------------------------------------------------------------------
  // Getters
  // -----------------------------------------------------------------------

  getPredictions(): Prediction[] {
    return [...this.predictions];
  }

  getIsAnalyzing(): boolean {
    return this.isAnalyzing;
  }

  getRules(): PredictionRule[] {
    return [...this.rules];
  }

  getRuleCount(): number {
    return this.rules.length;
  }

  // -----------------------------------------------------------------------
  // User actions
  // -----------------------------------------------------------------------

  dismiss(predictionId: string): void {
    const pred = this.predictions.find((p) => p.id === predictionId);
    if (!pred) { return; }

    pred.dismissed = true;
    this.predictions = this.predictions.filter((p) => p.id !== predictionId);

    this.dismissals.push({ ruleId: pred.ruleId, dismissedAt: Date.now() });
    this.saveDismissals();

    this.trackFeedback(pred.ruleId, 'dismiss');
    this.notify();
  }

  accept(predictionId: string): void {
    const pred = this.predictions.find((p) => p.id === predictionId);
    if (!pred) { return; }

    this.predictions = this.predictions.filter((p) => p.id !== predictionId);
    this.trackFeedback(pred.ruleId, 'accept');
    this.notify();
  }

  clearAll(): void {
    const ruleIds = this.predictions.map((p) => p.ruleId);
    ruleIds.forEach((ruleId) => {
      this.dismissals.push({ ruleId, dismissedAt: Date.now() });
      this.trackFeedback(ruleId, 'dismiss');
    });
    this.predictions = [];
    this.saveDismissals();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  // -----------------------------------------------------------------------
  // Confidence adjustment from user feedback
  // -----------------------------------------------------------------------

  private adjustConfidence(ruleId: string, base: number): number {
    const record = this.feedback.find((f) => f.ruleId === ruleId);
    if (!record) { return base; }

    const total = record.accepts + record.dismisses;
    if (total === 0) { return base; }

    const acceptRate = record.accepts / total;
    // Shift confidence toward user preference: if they always dismiss, lower it
    const adjustment = (acceptRate - 0.5) * 0.2; // max +/-0.1 shift
    return Math.max(0.1, Math.min(1.0, base + adjustment));
  }

  private trackFeedback(ruleId: string, action: 'accept' | 'dismiss'): void {
    let record = this.feedback.find((f) => f.ruleId === ruleId);
    if (!record) {
      record = { ruleId, accepts: 0, dismisses: 0 };
      this.feedback.push(record);
    }
    if (action === 'accept') {
      record.accepts++;
    } else {
      record.dismisses++;
    }
    this.saveFeedback();
  }

  getFeedback(): FeedbackRecord[] {
    return [...this.feedback];
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  private saveDismissals(): void {
    try {
      if (typeof window === 'undefined') { return; }
      localStorage.setItem(STORAGE_KEY_DISMISSALS, JSON.stringify(this.dismissals));
    } catch {
      // localStorage may be unavailable
    }
  }

  private loadDismissals(): void {
    try {
      if (typeof window === 'undefined') { return; }
      const raw = localStorage.getItem(STORAGE_KEY_DISMISSALS);
      if (!raw) { return; }
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) { return; }
      this.dismissals = parsed.filter(
        (item: unknown): item is DismissRecord =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as DismissRecord).ruleId === 'string' &&
          typeof (item as DismissRecord).dismissedAt === 'number',
      );
    } catch {
      this.dismissals = [];
    }
  }

  private saveFeedback(): void {
    try {
      if (typeof window === 'undefined') { return; }
      localStorage.setItem(STORAGE_KEY_FEEDBACK, JSON.stringify(this.feedback));
    } catch {
      // localStorage may be unavailable
    }
  }

  private loadFeedback(): void {
    try {
      if (typeof window === 'undefined') { return; }
      const raw = localStorage.getItem(STORAGE_KEY_FEEDBACK);
      if (!raw) { return; }
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) { return; }
      this.feedback = parsed.filter(
        (item: unknown): item is FeedbackRecord =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as FeedbackRecord).ruleId === 'string' &&
          typeof (item as FeedbackRecord).accepts === 'number' &&
          typeof (item as FeedbackRecord).dismisses === 'number',
      );
    } catch {
      this.feedback = [];
    }
  }

  private notify(): void {
    this.subscribers.forEach((cb) => { cb(); });
  }

  // -----------------------------------------------------------------------
  // AI-Enhanced Analysis (hybrid: heuristics + Gemini)
  // -----------------------------------------------------------------------

  /**
   * Run AI-enhanced prediction analysis. First runs local heuristic rules
   * (instant, free), then calls Gemini for deeper analysis that heuristics
   * can't catch (novel circuits, cross-domain issues, optimization opportunities).
   *
   * @param nodes Current architecture nodes
   * @param edges Current architecture edges
   * @param bom Current BOM items
   * @param options.apiKey Gemini API key (required for AI enhancement)
   * @param options.projectId Project ID for server context
   * @param options.sessionId Session ID for auth
   * @returns Combined predictions from heuristics + AI
   */
  async analyzeWithAI(
    nodes: PredictionNode[],
    edges: PredictionEdge[],
    bom: PredictionBomItem[],
    options: { apiKey: string; projectId: number; sessionId: string },
  ): Promise<Prediction[]> {
    // Step 1: Run heuristic rules immediately (free, instant)
    const heuristicResults = this.analyze(nodes, edges, bom);

    // Step 2: Skip AI if no API key or empty design
    if (!options.apiKey || nodes.length === 0) {
      return heuristicResults;
    }

    this.isAnalyzing = true;
    this.notify();

    try {
      const aiPredictions = await this.fetchAIPredictions(nodes, edges, bom, options);

      // Step 3: Merge, deduplicate by title similarity, cap at MAX_SUGGESTIONS
      const heuristicTitles = new Set(heuristicResults.map((p) => p.title.toLowerCase()));
      const uniqueAI = aiPredictions.filter(
        (p) => !heuristicTitles.has(p.title.toLowerCase()),
      );

      const merged = [...heuristicResults, ...uniqueAI]
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, MAX_SUGGESTIONS + 3); // Allow a few extra for AI insights

      this.predictions = merged;
      return merged;
    } catch (err: unknown) {
      // AI failure is non-fatal — heuristic results still stand
      console.warn('[PredictionEngine] AI enhancement failed, using heuristic results only:', err instanceof Error ? err.message : String(err));
      return heuristicResults;
    } finally {
      this.isAnalyzing = false;
      this.notify();
    }
  }

  private async fetchAIPredictions(
    nodes: PredictionNode[],
    edges: PredictionEdge[],
    bom: PredictionBomItem[],
    options: { apiKey: string; projectId: number; sessionId: string },
  ): Promise<Prediction[]> {
    const nodesSummary = nodes.map((n) => `${n.label} (${n.type})`).join(', ');
    const edgesSummary = edges.map((e) => {
      const src = nodes.find((n) => n.id === e.source)?.label ?? e.source;
      const tgt = nodes.find((n) => n.id === e.target)?.label ?? e.target;
      return `${src} → ${tgt}${e.label ? ` [${e.label}]` : ''}`;
    }).join(', ');
    const bomSummary = bom.map((b) => `${b.partNumber} (${b.description}, qty ${String(b.quantity)})`).join(', ');

    const prompt = `You are an expert electronics design reviewer. Analyze this circuit design and suggest improvements the user might not have considered.

COMPONENTS: ${nodesSummary || '(none)'}
CONNECTIONS: ${edgesSummary || '(none)'}
BOM: ${bomSummary || '(none)'}

Return a JSON array of suggestions. Each suggestion must have:
- "title": short title (under 60 chars)
- "description": detailed explanation
- "category": one of "missing_component", "best_practice", "safety", "optimization", "learning_tip"
- "confidence": number 0.0-1.0
- "action_type": one of "add_component", "show_info", "open_view" (or null)
- "action_payload": object with relevant params (or null)

Focus on things a hobbyist might miss: thermal management, ESD protection, signal integrity, power sequencing, component derating. Only suggest things NOT already present in the design. Respond ONLY with valid JSON array.`;

    const response = await fetch('/api/chat/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': options.sessionId,
      },
      body: JSON.stringify({
        message: prompt,
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        apiKey: options.apiKey,
        projectId: options.projectId,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI prediction request failed: ${String(response.status)}`);
    }

    const data = await response.json() as { message?: string; actions?: unknown[] };
    const text = data.message ?? '';

    // Parse JSON from the response text
    let suggestions: Array<{
      title: string;
      description: string;
      category: string;
      confidence: number;
      action_type?: string | null;
      action_payload?: Record<string, unknown> | null;
    }>;

    try {
      // Try direct parse first
      suggestions = JSON.parse(text);
    } catch {
      // Try extracting from markdown fences
      const match = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
      if (match?.[1]) {
        suggestions = JSON.parse(match[1]);
      } else {
        return [];
      }
    }

    if (!Array.isArray(suggestions)) {
      return [];
    }

    const validCategories = new Set<string>(['missing_component', 'best_practice', 'safety', 'optimization', 'learning_tip']);

    return suggestions
      .filter((s) => typeof s.title === 'string' && typeof s.description === 'string')
      .map((s, i) => {
        const category = validCategories.has(s.category) ? s.category as PredictionCategory : 'best_practice' as PredictionCategory;
        const prediction: Prediction = {
          id: `ai-${String(Date.now())}-${String(i)}`,
          ruleId: `ai-generated-${String(i)}`,
          title: s.title.slice(0, 80),
          description: s.description,
          confidence: typeof s.confidence === 'number' ? Math.max(0, Math.min(1, s.confidence)) : 0.7,
          category,
          dismissed: false,
        };

        if (s.action_type && s.action_payload) {
          const actionType = s.action_type as PredictionAction['type'];
          if (['add_component', 'add_connection', 'modify_value', 'open_view', 'show_info'].includes(actionType)) {
            prediction.action = {
              type: actionType,
              payload: s.action_payload,
            };
          }
        }

        return prediction;
      });
  }
}
