/**
 * BL-0706 — Proactive Self-Healing Engine (AI-driven)
 *
 * Real-time danger-rule engine that monitors design actions and proposes
 * healing fixes before damage occurs. 14 built-in danger rules covering
 * voltage mismatch, missing resistors, direct motor drive, reverse polarity,
 * missing decoupling, GPIO overcurrent, missing I2C pullups, ADC reference,
 * flyback diode, reset resistor, ESD protection, thin power trace,
 * missing level shifter, and ungrounded shield.
 *
 * Singleton + Subscribe pattern. Configurable interrupt levels and
 * approval gates.
 *
 * Usage:
 *   const engine = ProactiveHealingEngine.getInstance();
 *   engine.checkAction(action, designState);
 *   const proposals = engine.getProposals();
 *
 * React hook:
 *   const { proposals, approve, dismiss, config } = useProactiveHealing();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InterruptLevel = 'block' | 'warn' | 'info' | 'silent';

export type HealingSeverity = 'critical' | 'warning' | 'suggestion';

export type HealingCategory =
  | 'voltage'
  | 'current'
  | 'protection'
  | 'signal_integrity'
  | 'thermal'
  | 'mechanical'
  | 'best_practice';

export interface HealingProposal {
  id: string;
  ruleId: string;
  title: string;
  description: string;
  severity: HealingSeverity;
  category: HealingCategory;
  /** The action that triggered this proposal. */
  triggerAction: DesignAction;
  /** Suggested fix — structured so UI can render or auto-apply. */
  fix: HealingFix;
  /** Whether the user has approved, dismissed, or it's pending. */
  status: 'pending' | 'approved' | 'dismissed' | 'auto_applied';
  /** Timestamp of creation. */
  createdAt: number;
}

export interface HealingFix {
  type: 'add_component' | 'modify_value' | 'add_connection' | 'remove_connection' | 'replace_component';
  description: string;
  payload: Record<string, unknown>;
}

/** A design action that the engine monitors. */
export interface DesignAction {
  type: 'add_node' | 'remove_node' | 'add_edge' | 'remove_edge' | 'modify_node' | 'modify_edge' | 'set_property';
  nodeId?: string;
  edgeId?: string;
  data: Record<string, unknown>;
}

/** Minimal node representation for healing checks. */
export interface HealingNode {
  id: string;
  type: string;
  label: string;
  properties?: Record<string, string | number | boolean>;
}

/** Minimal edge representation for healing checks. */
export interface HealingEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  voltage?: string;
  signalType?: string;
}

/** Snapshot of the design state for analysis. */
export interface DesignState {
  nodes: HealingNode[];
  edges: HealingEdge[];
}

export interface DangerRule {
  id: string;
  name: string;
  severity: HealingSeverity;
  category: HealingCategory;
  interruptLevel: InterruptLevel;
  /** Check function: given action + state, return proposals (empty = no danger). */
  check: (action: DesignAction, state: DesignState) => HealingProposal[];
}

export interface HealingConfig {
  /** Global enable/disable. */
  enabled: boolean;
  /** Minimum interrupt level to show (block > warn > info > silent). */
  minInterruptLevel: InterruptLevel;
  /** Auto-apply fixes at or below this severity. */
  autoApplySeverity: HealingSeverity | null;
  /** Per-rule overrides (ruleId → enabled). */
  ruleOverrides: Record<string, boolean>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY_CONFIG = 'protopulse-healing-config';
const STORAGE_KEY_HISTORY = 'protopulse-healing-history';
const MAX_HISTORY = 200;

const INTERRUPT_LEVEL_ORDER: Record<InterruptLevel, number> = {
  block: 3,
  warn: 2,
  info: 1,
  silent: 0,
};

const SEVERITY_ORDER: Record<HealingSeverity, number> = {
  critical: 2,
  warning: 1,
  suggestion: 0,
};

const DEFAULT_CONFIG: HealingConfig = {
  enabled: true,
  minInterruptLevel: 'info',
  autoApplySeverity: null,
  ruleOverrides: {},
};

// ---------------------------------------------------------------------------
// Node-classification helpers
// ---------------------------------------------------------------------------

const MCU_PATTERNS = [
  'mcu', 'microcontroller', 'arduino', 'esp32', 'esp8266', 'stm32',
  'atmega', 'attiny', 'processor', 'controller', 'pic', 'nrf52',
];
const MOTOR_PATTERNS = ['motor', 'stepper', 'servo', 'actuator', 'dc-motor', 'bldc'];
const CAPACITOR_PATTERNS = ['capacitor', 'cap', 'decoupling', 'bypass', '100nf', '10uf'];
const RESISTOR_PATTERNS = ['resistor', 'pull-up', 'pull-down', 'pullup', 'pulldown', 'current-limit'];
const LED_PATTERNS = ['led', 'light-emitting', 'indicator', 'neopixel', 'ws2812'];
const DIODE_PATTERNS = ['diode', 'flyback', 'schottky', 'zener', 'tvs', 'rectifier'];
const RELAY_PATTERNS = ['relay', 'solenoid', 'contactor'];
const REGULATOR_PATTERNS = ['regulator', 'vreg', 'ldo', 'buck', 'boost', 'switching-regulator'];
const H_BRIDGE_PATTERNS = ['h-bridge', 'hbridge', 'motor-driver', 'l298', 'l293', 'drv8825', 'a4988'];
const SHIELD_PATTERNS = ['shield', 'shielded', 'emi-shield', 'rf-shield'];
const LEVEL_SHIFTER_PATTERNS = ['level-shifter', 'level-converter', 'voltage-translator', 'txb0108', 'txs0108'];
const I2C_PATTERNS = ['i2c', 'iic', 'twi', 'sda', 'scl'];
const ADC_PATTERNS = ['adc', 'analog-to-digital', 'analog_to_digital'];
const GROUND_PATTERNS = ['ground', 'gnd', 'earth'];
const POWER_PATTERNS = ['power', 'vcc', 'vdd', '3.3v', '5v', '12v', '24v', 'vin'];
const TRACE_PATTERNS = ['trace', 'wire', 'track', 'route'];
const RESET_PATTERNS = ['reset', 'rst', 'nrst', 'nreset'];
const ESD_PATTERNS = ['esd', 'tvs', 'suppressor', 'clamp', 'usblc6'];
const USB_PATTERNS = ['usb', 'usb-c', 'usb-a', 'usb-b', 'micro-usb'];

function matchesAny(text: string, patterns: string[]): boolean {
  const lower = text.toLowerCase();
  return patterns.some((p) => lower.includes(p));
}

function nodeMatches(node: HealingNode, patterns: string[]): boolean {
  return matchesAny(node.type, patterns) || matchesAny(node.label, patterns);
}

function isMcu(n: HealingNode): boolean { return nodeMatches(n, MCU_PATTERNS); }
function isMotor(n: HealingNode): boolean { return nodeMatches(n, MOTOR_PATTERNS); }
function isCapacitor(n: HealingNode): boolean { return nodeMatches(n, CAPACITOR_PATTERNS); }
function isResistor(n: HealingNode): boolean { return nodeMatches(n, RESISTOR_PATTERNS); }
function isLed(n: HealingNode): boolean { return nodeMatches(n, LED_PATTERNS); }
function isDiode(n: HealingNode): boolean { return nodeMatches(n, DIODE_PATTERNS); }
function isRelay(n: HealingNode): boolean { return nodeMatches(n, RELAY_PATTERNS); }
function isRegulator(n: HealingNode): boolean { return nodeMatches(n, REGULATOR_PATTERNS); }
function isHBridge(n: HealingNode): boolean { return nodeMatches(n, H_BRIDGE_PATTERNS); }
function isShield(n: HealingNode): boolean { return nodeMatches(n, SHIELD_PATTERNS); }
function isLevelShifter(n: HealingNode): boolean { return nodeMatches(n, LEVEL_SHIFTER_PATTERNS); }
function isI2cDevice(n: HealingNode): boolean { return nodeMatches(n, I2C_PATTERNS); }
function isAdc(n: HealingNode): boolean { return nodeMatches(n, ADC_PATTERNS); }
function isGround(n: HealingNode): boolean { return nodeMatches(n, GROUND_PATTERNS); }
function isEsd(n: HealingNode): boolean { return nodeMatches(n, ESD_PATTERNS); }
function isUsb(n: HealingNode): boolean {
  if (!nodeMatches(n, USB_PATTERNS)) { return false; }
  if (nodeMatches(n, ESD_PATTERNS)) { return false; }
  return true;
}

// ---------------------------------------------------------------------------
// Adjacency helpers
// ---------------------------------------------------------------------------

function buildAdjacency(edges: HealingEdge[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  edges.forEach((e) => {
    if (!adj.has(e.source)) { adj.set(e.source, new Set()); }
    adj.get(e.source)!.add(e.target);
    if (!adj.has(e.target)) { adj.set(e.target, new Set()); }
    adj.get(e.target)!.add(e.source);
  });
  return adj;
}

function getNeighbours(nodeId: string, adj: Map<string, Set<string>>, allNodes: HealingNode[]): HealingNode[] {
  const ids = adj.get(nodeId);
  if (!ids) { return []; }
  return allNodes.filter((n) => ids.has(n.id));
}

function makeProposal(
  ruleId: string,
  title: string,
  description: string,
  severity: HealingSeverity,
  category: HealingCategory,
  action: DesignAction,
  fix: HealingFix,
): HealingProposal {
  return {
    id: `${ruleId}-${crypto.randomUUID()}`,
    ruleId,
    title,
    description,
    severity,
    category,
    triggerAction: action,
    fix,
    status: 'pending',
    createdAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Voltage parsing helpers
// ---------------------------------------------------------------------------

function parseVoltage(text: string | undefined): number | null {
  if (!text) { return null; }
  const match = /(\d+(?:\.\d+)?)\s*[vV]/.exec(text);
  if (match) { return parseFloat(match[1]); }
  return null;
}

function getNodeVoltage(node: HealingNode): number | null {
  const propV = node.properties?.['voltage'];
  if (typeof propV === 'number') { return propV; }
  if (typeof propV === 'string') { return parseVoltage(propV); }
  return parseVoltage(node.label) ?? parseVoltage(node.type);
}

function getEdgeVoltage(edge: HealingEdge): number | null {
  return parseVoltage(edge.voltage) ?? parseVoltage(edge.label);
}

// ---------------------------------------------------------------------------
// Built-in Danger Rules (14 rules)
// ---------------------------------------------------------------------------

function makeVoltageMismatch(): DangerRule {
  return {
    id: 'voltage-mismatch',
    name: 'Voltage mismatch on connection',
    severity: 'critical',
    category: 'voltage',
    interruptLevel: 'block',
    check(action, state) {
      if (action.type !== 'add_edge') { return []; }
      const proposals: HealingProposal[] = [];
      const sourceId = action.data['source'] as string | undefined;
      const targetId = action.data['target'] as string | undefined;
      if (!sourceId || !targetId) { return []; }

      const sourceNode = state.nodes.find((n) => n.id === sourceId);
      const targetNode = state.nodes.find((n) => n.id === targetId);
      if (!sourceNode || !targetNode) { return []; }

      const sv = getNodeVoltage(sourceNode);
      const tv = getNodeVoltage(targetNode);
      if (sv !== null && tv !== null && sv !== tv) {
        proposals.push(makeProposal(
          'voltage-mismatch',
          `Voltage mismatch: ${sv}V → ${tv}V`,
          `Connecting "${sourceNode.label}" (${sv}V) to "${targetNode.label}" (${tv}V) creates a voltage mismatch. This can damage components or cause malfunction.`,
          'critical',
          'voltage',
          action,
          {
            type: 'add_component',
            description: `Add a level shifter or voltage regulator between ${sourceNode.label} and ${targetNode.label}`,
            payload: { component: 'level-shifter', between: [sourceId, targetId], fromV: sv, toV: tv },
          },
        ));
      }
      return proposals;
    },
  };
}

function makeMissingCurrentLimitResistor(): DangerRule {
  return {
    id: 'missing-current-limit-resistor',
    name: 'Missing current-limiting resistor for LED',
    severity: 'critical',
    category: 'current',
    interruptLevel: 'block',
    check(action, state) {
      if (action.type !== 'add_edge') { return []; }
      const proposals: HealingProposal[] = [];
      const sourceId = action.data['source'] as string | undefined;
      const targetId = action.data['target'] as string | undefined;
      if (!sourceId || !targetId) { return []; }

      const adj = buildAdjacency(state.edges);
      const nodes = state.nodes;

      // Check if an LED is being connected to an MCU GPIO without a resistor
      const sourceNode = nodes.find((n) => n.id === sourceId);
      const targetNode = nodes.find((n) => n.id === targetId);
      if (!sourceNode || !targetNode) { return []; }

      const ledNode = isLed(sourceNode) ? sourceNode : isLed(targetNode) ? targetNode : null;
      const mcuNode = isMcu(sourceNode) ? sourceNode : isMcu(targetNode) ? targetNode : null;
      if (!ledNode || !mcuNode) { return []; }

      // Check if any resistor is in the path between MCU and LED
      const ledNeighbours = getNeighbours(ledNode.id, adj, nodes);
      const hasResistor = ledNeighbours.some(isResistor);
      if (!hasResistor) {
        proposals.push(makeProposal(
          'missing-current-limit-resistor',
          `Add current-limiting resistor for ${ledNode.label}`,
          `LED "${ledNode.label}" is connected directly to MCU "${mcuNode.label}" without a current-limiting resistor. This will overdrive the LED and may damage the GPIO pin. Add a 220Ω–1kΩ resistor in series.`,
          'critical',
          'current',
          action,
          {
            type: 'add_component',
            description: 'Add 330Ω series resistor between MCU GPIO and LED',
            payload: { component: 'resistor', value: '330Ω', between: [mcuNode.id, ledNode.id] },
          },
        ));
      }
      return proposals;
    },
  };
}

function makeDirectMotorDrive(): DangerRule {
  return {
    id: 'direct-motor-drive',
    name: 'Direct motor drive from GPIO',
    severity: 'critical',
    category: 'current',
    interruptLevel: 'block',
    check(action, state) {
      if (action.type !== 'add_edge') { return []; }
      const proposals: HealingProposal[] = [];
      const sourceId = action.data['source'] as string | undefined;
      const targetId = action.data['target'] as string | undefined;
      if (!sourceId || !targetId) { return []; }

      const sourceNode = state.nodes.find((n) => n.id === sourceId);
      const targetNode = state.nodes.find((n) => n.id === targetId);
      if (!sourceNode || !targetNode) { return []; }

      const motorNode = isMotor(sourceNode) ? sourceNode : isMotor(targetNode) ? targetNode : null;
      const mcuNode = isMcu(sourceNode) ? sourceNode : isMcu(targetNode) ? targetNode : null;
      if (!motorNode || !mcuNode) { return []; }

      // Check no H-bridge / driver between them
      const adj = buildAdjacency(state.edges);
      const motorNeighbours = getNeighbours(motorNode.id, adj, state.nodes);
      const hasDriver = motorNeighbours.some(isHBridge);
      if (!hasDriver) {
        proposals.push(makeProposal(
          'direct-motor-drive',
          `Motor "${motorNode.label}" driven directly from GPIO`,
          `Motor "${motorNode.label}" is connected directly to MCU "${mcuNode.label}". GPIO pins can only source ~20mA — motors draw much more. This will damage the MCU. Use a motor driver (L298N, DRV8825) or MOSFET.`,
          'critical',
          'current',
          action,
          {
            type: 'add_component',
            description: 'Add motor driver between MCU and motor',
            payload: { component: 'motor-driver', between: [mcuNode.id, motorNode.id] },
          },
        ));
      }
      return proposals;
    },
  };
}

function makeReversePolarity(): DangerRule {
  return {
    id: 'reverse-polarity',
    name: 'Reverse polarity protection missing',
    severity: 'warning',
    category: 'protection',
    interruptLevel: 'warn',
    check(action, state) {
      if (action.type !== 'add_node') { return []; }
      const proposals: HealingProposal[] = [];
      const nodeType = (action.data['type'] as string) ?? '';
      const nodeLabel = (action.data['label'] as string) ?? '';
      const testNode: HealingNode = { id: 'test', type: nodeType, label: nodeLabel };

      if (isRegulator(testNode)) {
        // Check if there's a diode before the regulator for reverse polarity protection
        const adj = buildAdjacency(state.edges);
        const nodeId = action.nodeId ?? '';
        const neighbours = getNeighbours(nodeId, adj, state.nodes);
        const hasDiode = neighbours.some(isDiode);
        if (!hasDiode) {
          proposals.push(makeProposal(
            'reverse-polarity',
            `Add reverse polarity protection for ${nodeLabel || 'regulator'}`,
            'Voltage regulators should have a reverse polarity protection diode (e.g. Schottky diode) on the input to prevent damage from reversed power connections.',
            'warning',
            'protection',
            action,
            {
              type: 'add_component',
              description: 'Add Schottky diode for reverse polarity protection',
              payload: { component: 'schottky-diode', placement: 'input', near: nodeId },
            },
          ));
        }
      }
      return proposals;
    },
  };
}

function makeMissingDecoupling(): DangerRule {
  return {
    id: 'missing-decoupling',
    name: 'Missing decoupling capacitor',
    severity: 'warning',
    category: 'signal_integrity',
    interruptLevel: 'warn',
    check(action, state) {
      if (action.type !== 'add_node') { return []; }
      const proposals: HealingProposal[] = [];
      const nodeType = (action.data['type'] as string) ?? '';
      const nodeLabel = (action.data['label'] as string) ?? '';
      const testNode: HealingNode = { id: 'test', type: nodeType, label: nodeLabel };

      if (isMcu(testNode)) {
        // Check if any caps exist nearby
        const hasCaps = state.nodes.some(isCapacitor);
        if (!hasCaps) {
          proposals.push(makeProposal(
            'missing-decoupling',
            `Add decoupling capacitors for ${nodeLabel || 'MCU'}`,
            'Every MCU needs 100nF ceramic decoupling capacitors on each VCC pin and a 10µF bulk capacitor near the power input. Without them, voltage dips during fast switching cause erratic behavior.',
            'warning',
            'signal_integrity',
            action,
            {
              type: 'add_component',
              description: 'Add 100nF ceramic + 10µF bulk capacitors',
              payload: { component: 'capacitor', values: ['100nF', '10µF'], near: action.nodeId },
            },
          ));
        }
      }
      return proposals;
    },
  };
}

function makeGpioOvercurrent(): DangerRule {
  return {
    id: 'gpio-overcurrent',
    name: 'GPIO overcurrent risk',
    severity: 'critical',
    category: 'current',
    interruptLevel: 'block',
    check(action, state) {
      if (action.type !== 'add_edge') { return []; }
      const proposals: HealingProposal[] = [];
      const sourceId = action.data['source'] as string | undefined;
      const targetId = action.data['target'] as string | undefined;
      if (!sourceId || !targetId) { return []; }

      const sourceNode = state.nodes.find((n) => n.id === sourceId);
      const targetNode = state.nodes.find((n) => n.id === targetId);
      if (!sourceNode || !targetNode) { return []; }

      const relayNode = isRelay(sourceNode) ? sourceNode : isRelay(targetNode) ? targetNode : null;
      const mcuNode = isMcu(sourceNode) ? sourceNode : isMcu(targetNode) ? targetNode : null;
      if (!relayNode || !mcuNode) { return []; }

      // Relay coils draw too much for GPIO — need a transistor driver
      proposals.push(makeProposal(
        'gpio-overcurrent',
        `Relay "${relayNode.label}" draws too much current for GPIO`,
        `Relay coils typically draw 30–80mA, far exceeding the ~20mA GPIO limit. Connect the relay through an NPN transistor or MOSFET with a flyback diode.`,
        'critical',
        'current',
        action,
        {
          type: 'add_component',
          description: 'Add NPN transistor driver + flyback diode for relay',
          payload: { component: 'transistor-driver', between: [mcuNode.id, relayNode.id] },
        },
      ));
      return proposals;
    },
  };
}

function makeMissingI2cPullups(): DangerRule {
  return {
    id: 'missing-i2c-pullups',
    name: 'Missing I2C pull-up resistors',
    severity: 'warning',
    category: 'signal_integrity',
    interruptLevel: 'warn',
    check(action, state) {
      if (action.type !== 'add_edge') { return []; }
      const proposals: HealingProposal[] = [];
      const sourceId = action.data['source'] as string | undefined;
      const targetId = action.data['target'] as string | undefined;
      if (!sourceId || !targetId) { return []; }

      const sourceNode = state.nodes.find((n) => n.id === sourceId);
      const targetNode = state.nodes.find((n) => n.id === targetId);
      if (!sourceNode || !targetNode) { return []; }

      // Check if either side is I2C-related
      const hasI2c = isI2cDevice(sourceNode) || isI2cDevice(targetNode) ||
        matchesAny(action.data['signalType'] as string ?? '', I2C_PATTERNS);
      if (!hasI2c) { return []; }

      // Check if pull-up resistors exist on the bus
      const adj = buildAdjacency(state.edges);
      const i2cNode = isI2cDevice(sourceNode) ? sourceNode : targetNode;
      const neighbours = getNeighbours(i2cNode.id, adj, state.nodes);
      const hasPullups = neighbours.some((n) =>
        isResistor(n) && matchesAny(n.label, ['pull-up', 'pullup', '4.7k', '4k7', '10k']),
      );
      if (!hasPullups) {
        proposals.push(makeProposal(
          'missing-i2c-pullups',
          'Missing I2C pull-up resistors on SDA/SCL',
          'I2C bus lines (SDA, SCL) are open-drain and require pull-up resistors (typically 4.7kΩ) to VCC. Without them, communication will be unreliable or completely fail.',
          'warning',
          'signal_integrity',
          action,
          {
            type: 'add_component',
            description: 'Add 4.7kΩ pull-up resistors on SDA and SCL',
            payload: { component: 'resistor', value: '4.7kΩ', count: 2, placement: 'i2c-pullup' },
          },
        ));
      }
      return proposals;
    },
  };
}

function makeAdcReference(): DangerRule {
  return {
    id: 'adc-reference',
    name: 'ADC missing voltage reference',
    severity: 'suggestion',
    category: 'signal_integrity',
    interruptLevel: 'info',
    check(action, state) {
      if (action.type !== 'add_node') { return []; }
      const proposals: HealingProposal[] = [];
      const nodeType = (action.data['type'] as string) ?? '';
      const nodeLabel = (action.data['label'] as string) ?? '';
      const testNode: HealingNode = { id: 'test', type: nodeType, label: nodeLabel };

      if (isAdc(testNode)) {
        // Check if a voltage reference exists
        const hasRef = state.nodes.some((n) =>
          matchesAny(n.type, ['vref', 'voltage-reference', 'reference']) ||
          matchesAny(n.label, ['vref', 'voltage-reference', 'reference']),
        );
        if (!hasRef) {
          proposals.push(makeProposal(
            'adc-reference',
            `Consider a precision voltage reference for ${nodeLabel || 'ADC'}`,
            'For accurate analog measurements, consider using a precision voltage reference (e.g. REF3030, LM4040) instead of relying on VCC as AREF. VCC can vary with load.',
            'suggestion',
            'signal_integrity',
            action,
            {
              type: 'add_component',
              description: 'Add precision voltage reference for ADC AREF',
              payload: { component: 'voltage-reference', near: action.nodeId },
            },
          ));
        }
      }
      return proposals;
    },
  };
}

function makeFlybackDiode(): DangerRule {
  return {
    id: 'flyback-diode',
    name: 'Missing flyback diode on inductive load',
    severity: 'critical',
    category: 'protection',
    interruptLevel: 'block',
    check(action, state) {
      if (action.type !== 'add_edge') { return []; }
      const proposals: HealingProposal[] = [];
      const sourceId = action.data['source'] as string | undefined;
      const targetId = action.data['target'] as string | undefined;
      if (!sourceId || !targetId) { return []; }

      const sourceNode = state.nodes.find((n) => n.id === sourceId);
      const targetNode = state.nodes.find((n) => n.id === targetId);
      if (!sourceNode || !targetNode) { return []; }

      const inductiveNode = (isMotor(sourceNode) || isRelay(sourceNode))
        ? sourceNode
        : (isMotor(targetNode) || isRelay(targetNode))
          ? targetNode
          : null;
      if (!inductiveNode) { return []; }

      const adj = buildAdjacency(state.edges);
      const neighbours = getNeighbours(inductiveNode.id, adj, state.nodes);
      const hasDiode = neighbours.some(isDiode);
      if (!hasDiode) {
        proposals.push(makeProposal(
          'flyback-diode',
          `Add flyback diode for ${inductiveNode.label}`,
          `Inductive load "${inductiveNode.label}" generates voltage spikes when switched off. A flyback diode (e.g. 1N4007) across the coil clamps these spikes and prevents driver damage.`,
          'critical',
          'protection',
          action,
          {
            type: 'add_component',
            description: 'Add 1N4007 flyback diode across inductive load',
            payload: { component: 'diode', value: '1N4007', across: inductiveNode.id },
          },
        ));
      }
      return proposals;
    },
  };
}

function makeResetResistor(): DangerRule {
  return {
    id: 'reset-resistor',
    name: 'Missing reset pull-up resistor',
    severity: 'suggestion',
    category: 'best_practice',
    interruptLevel: 'info',
    check(action, state) {
      if (action.type !== 'add_node') { return []; }
      const proposals: HealingProposal[] = [];
      const nodeType = (action.data['type'] as string) ?? '';
      const nodeLabel = (action.data['label'] as string) ?? '';
      const testNode: HealingNode = { id: 'test', type: nodeType, label: nodeLabel };

      if (isMcu(testNode)) {
        // Check if a reset pull-up resistor exists
        const hasResetPullup = state.nodes.some((n) =>
          isResistor(n) && matchesAny(n.label, RESET_PATTERNS),
        );
        if (!hasResetPullup) {
          proposals.push(makeProposal(
            'reset-resistor',
            `Add reset pull-up resistor for ${nodeLabel || 'MCU'}`,
            'MCU reset pins are typically active-low and should have a pull-up resistor (10kΩ) to VCC to prevent spurious resets from noise. Optionally add a 100nF cap to GND for debouncing.',
            'suggestion',
            'best_practice',
            action,
            {
              type: 'add_component',
              description: 'Add 10kΩ pull-up resistor on RESET pin',
              payload: { component: 'resistor', value: '10kΩ', placement: 'reset-pullup', near: action.nodeId },
            },
          ));
        }
      }
      return proposals;
    },
  };
}

function makeEsdProtection(): DangerRule {
  return {
    id: 'esd-protection',
    name: 'Missing ESD protection on external interface',
    severity: 'warning',
    category: 'protection',
    interruptLevel: 'warn',
    check(action, state) {
      if (action.type !== 'add_node') { return []; }
      const proposals: HealingProposal[] = [];
      const nodeType = (action.data['type'] as string) ?? '';
      const nodeLabel = (action.data['label'] as string) ?? '';
      const testNode: HealingNode = { id: 'test', type: nodeType, label: nodeLabel };

      if (isUsb(testNode)) {
        // Check if ESD protection exists
        const hasEsd = state.nodes.some(isEsd);
        if (!hasEsd) {
          proposals.push(makeProposal(
            'esd-protection',
            `Add ESD protection for ${nodeLabel || 'USB'}`,
            'External-facing connectors (USB, Ethernet, etc.) should have ESD protection (TVS diodes, e.g. USBLC6-2) to protect internal circuitry from electrostatic discharge.',
            'warning',
            'protection',
            action,
            {
              type: 'add_component',
              description: 'Add TVS diode array (e.g. USBLC6-2) for ESD protection',
              payload: { component: 'tvs-diode', near: action.nodeId },
            },
          ));
        }
      }
      return proposals;
    },
  };
}

function makeThinPowerTrace(): DangerRule {
  return {
    id: 'thin-power-trace',
    name: 'Power trace too thin',
    severity: 'warning',
    category: 'thermal',
    interruptLevel: 'warn',
    check(action, state) {
      if (action.type !== 'add_edge' && action.type !== 'modify_edge') { return []; }
      const proposals: HealingProposal[] = [];

      const signalType = (action.data['signalType'] as string) ?? '';
      const label = (action.data['label'] as string) ?? '';
      const width = action.data['width'] as number | undefined;

      const isPower = matchesAny(signalType, POWER_PATTERNS) || matchesAny(label, POWER_PATTERNS);
      if (!isPower) { return []; }

      // If width is explicitly set and narrow, flag it
      if (width !== undefined && width < 0.5) {
        proposals.push(makeProposal(
          'thin-power-trace',
          'Power trace width is too narrow',
          `Power traces should be at least 0.5mm (20 mil) wide. Narrow traces on power rails cause excessive heating and voltage drop. Use wider traces or copper pours for power distribution.`,
          'warning',
          'thermal',
          action,
          {
            type: 'modify_value',
            description: 'Increase power trace width to at least 0.5mm',
            payload: { property: 'width', minValue: 0.5, edgeId: action.edgeId },
          },
        ));
      }
      return proposals;
    },
  };
}

function makeMissingLevelShifter(): DangerRule {
  return {
    id: 'missing-level-shifter',
    name: 'Missing level shifter between voltage domains',
    severity: 'warning',
    category: 'voltage',
    interruptLevel: 'warn',
    check(action, state) {
      if (action.type !== 'add_edge') { return []; }
      const proposals: HealingProposal[] = [];
      const sourceId = action.data['source'] as string | undefined;
      const targetId = action.data['target'] as string | undefined;
      if (!sourceId || !targetId) { return []; }

      const sourceNode = state.nodes.find((n) => n.id === sourceId);
      const targetNode = state.nodes.find((n) => n.id === targetId);
      if (!sourceNode || !targetNode) { return []; }

      // Both must be MCU/IC type with different voltage levels
      if (!isMcu(sourceNode) && !isMcu(targetNode)) { return []; }

      const sv = getNodeVoltage(sourceNode);
      const tv = getNodeVoltage(targetNode);
      if (sv !== null && tv !== null && sv !== tv) {
        // Check if a level shifter already exists in the design
        const hasShifter = state.nodes.some(isLevelShifter);
        if (!hasShifter) {
          proposals.push(makeProposal(
            'missing-level-shifter',
            `Add level shifter between ${sv}V and ${tv}V domains`,
            `Connecting a ${sv}V device to a ${tv}V device without a level shifter can damage the lower-voltage device. Use a bidirectional level shifter (e.g. TXB0108) or a simple MOSFET-based shifter.`,
            'warning',
            'voltage',
            action,
            {
              type: 'add_component',
              description: `Add bidirectional level shifter (${sv}V ↔ ${tv}V)`,
              payload: { component: 'level-shifter', fromV: sv, toV: tv, between: [sourceId, targetId] },
            },
          ));
        }
      }
      return proposals;
    },
  };
}

function makeUngroundedShield(): DangerRule {
  return {
    id: 'ungrounded-shield',
    name: 'Ungrounded EMI shield',
    severity: 'suggestion',
    category: 'best_practice',
    interruptLevel: 'info',
    check(action, state) {
      if (action.type !== 'add_node') { return []; }
      const proposals: HealingProposal[] = [];
      const nodeType = (action.data['type'] as string) ?? '';
      const nodeLabel = (action.data['label'] as string) ?? '';
      const testNode: HealingNode = { id: 'test', type: nodeType, label: nodeLabel };

      if (isShield(testNode)) {
        // Check if connected to ground
        const hasGroundConnection = state.edges.some((e) => {
          const otherNodeId = e.source === (action.nodeId ?? '') ? e.target : e.target === (action.nodeId ?? '') ? e.source : null;
          if (!otherNodeId) { return false; }
          const otherNode = state.nodes.find((n) => n.id === otherNodeId);
          return otherNode ? isGround(otherNode) : false;
        });
        if (!hasGroundConnection) {
          proposals.push(makeProposal(
            'ungrounded-shield',
            `Ground the EMI shield "${nodeLabel || 'shield'}"`,
            'EMI shields must be connected to ground to be effective. An ungrounded shield can actually act as an antenna and make EMI worse.',
            'suggestion',
            'best_practice',
            action,
            {
              type: 'add_connection',
              description: 'Connect shield to ground plane',
              payload: { from: action.nodeId, to: 'ground' },
            },
          ));
        }
      }
      return proposals;
    },
  };
}

// ---------------------------------------------------------------------------
// Rule registry
// ---------------------------------------------------------------------------

function getAllDangerRules(): DangerRule[] {
  return [
    makeVoltageMismatch(),
    makeMissingCurrentLimitResistor(),
    makeDirectMotorDrive(),
    makeReversePolarity(),
    makeMissingDecoupling(),
    makeGpioOvercurrent(),
    makeMissingI2cPullups(),
    makeAdcReference(),
    makeFlybackDiode(),
    makeResetResistor(),
    makeEsdProtection(),
    makeThinPowerTrace(),
    makeMissingLevelShifter(),
    makeUngroundedShield(),
  ];
}

// ---------------------------------------------------------------------------
// ProactiveHealingEngine (singleton + subscribe)
// ---------------------------------------------------------------------------

export class ProactiveHealingEngine {
  private static instance: ProactiveHealingEngine | null = null;

  private rules: DangerRule[];
  private proposals: HealingProposal[] = [];
  private history: HealingProposal[] = [];
  private subscribers: Set<() => void> = new Set();
  private config: HealingConfig;

  constructor() {
    this.rules = getAllDangerRules();
    this.config = this.loadConfig();
    this.history = this.loadHistory();
  }

  static getInstance(): ProactiveHealingEngine {
    if (!ProactiveHealingEngine.instance) {
      ProactiveHealingEngine.instance = new ProactiveHealingEngine();
    }
    return ProactiveHealingEngine.instance;
  }

  static resetInstance(): void {
    ProactiveHealingEngine.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscribe
  // -----------------------------------------------------------------------

  subscribe(fn: () => void): () => void {
    this.subscribers.add(fn);
    return () => { this.subscribers.delete(fn); };
  }

  private notify(): void {
    this.subscribers.forEach((fn) => fn());
  }

  // -----------------------------------------------------------------------
  // Config
  // -----------------------------------------------------------------------

  getConfig(): HealingConfig {
    return { ...this.config, ruleOverrides: { ...this.config.ruleOverrides } };
  }

  updateConfig(partial: Partial<HealingConfig>): void {
    this.config = { ...this.config, ...partial };
    if (partial.ruleOverrides) {
      this.config.ruleOverrides = { ...this.config.ruleOverrides, ...partial.ruleOverrides };
    }
    this.saveConfig();
    this.notify();
  }

  private loadConfig(): HealingConfig {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<HealingConfig>;
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch {
      // Ignore corrupt data
    }
    return { ...DEFAULT_CONFIG };
  }

  private saveConfig(): void {
    try {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(this.config));
    } catch {
      // Storage full or unavailable
    }
  }

  // -----------------------------------------------------------------------
  // History
  // -----------------------------------------------------------------------

  private loadHistory(): HealingProposal[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (raw) {
        return JSON.parse(raw) as HealingProposal[];
      }
    } catch {
      // Ignore
    }
    return [];
  }

  private saveHistory(): void {
    try {
      const trimmed = this.history.slice(-MAX_HISTORY);
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(trimmed));
    } catch {
      // Storage full
    }
  }

  getHistory(): HealingProposal[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
    this.saveHistory();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Core: Check an action against all rules
  // -----------------------------------------------------------------------

  checkAction(action: DesignAction, state: DesignState): HealingProposal[] {
    if (!this.config.enabled) { return []; }

    const newProposals: HealingProposal[] = [];
    const minLevel = INTERRUPT_LEVEL_ORDER[this.config.minInterruptLevel];

    this.rules.forEach((rule) => {
      // Skip disabled rules
      if (this.config.ruleOverrides[rule.id] === false) { return; }

      // Skip rules below minimum interrupt level
      if (INTERRUPT_LEVEL_ORDER[rule.interruptLevel] < minLevel) { return; }

      const results = rule.check(action, state);
      results.forEach((proposal) => {
        // Auto-apply if configured
        if (this.config.autoApplySeverity !== null &&
          SEVERITY_ORDER[proposal.severity] <= SEVERITY_ORDER[this.config.autoApplySeverity]) {
          proposal.status = 'auto_applied';
        }
        newProposals.push(proposal);
      });
    });

    // Deduplicate by ruleId — keep only the latest per rule
    const existingRuleIds = new Set(this.proposals.map((p) => p.ruleId));
    const filtered = newProposals.filter((p) => !existingRuleIds.has(p.ruleId));

    this.proposals.push(...filtered);
    this.history.push(...filtered);
    this.saveHistory();
    this.notify();

    return filtered;
  }

  // -----------------------------------------------------------------------
  // Bulk analysis — check entire design for all rules
  // -----------------------------------------------------------------------

  analyzeDesign(state: DesignState): HealingProposal[] {
    if (!this.config.enabled) { return []; }

    const allProposals: HealingProposal[] = [];

    // Generate synthetic actions for all nodes and edges
    state.nodes.forEach((node) => {
      const action: DesignAction = {
        type: 'add_node',
        nodeId: node.id,
        data: { type: node.type, label: node.label, ...(node.properties ?? {}) },
      };
      const results = this.checkAction(action, state);
      allProposals.push(...results);
    });

    state.edges.forEach((edge) => {
      const action: DesignAction = {
        type: 'add_edge',
        edgeId: edge.id,
        data: {
          source: edge.source,
          target: edge.target,
          label: edge.label,
          voltage: edge.voltage,
          signalType: edge.signalType,
        },
      };
      const results = this.checkAction(action, state);
      allProposals.push(...results);
    });

    return allProposals;
  }

  // -----------------------------------------------------------------------
  // Proposal management
  // -----------------------------------------------------------------------

  getProposals(): HealingProposal[] {
    return [...this.proposals];
  }

  getPendingProposals(): HealingProposal[] {
    return this.proposals.filter((p) => p.status === 'pending');
  }

  getProposalsByCategory(category: HealingCategory): HealingProposal[] {
    return this.proposals.filter((p) => p.category === category);
  }

  getProposalsBySeverity(severity: HealingSeverity): HealingProposal[] {
    return this.proposals.filter((p) => p.severity === severity);
  }

  approve(proposalId: string): boolean {
    const proposal = this.proposals.find((p) => p.id === proposalId);
    if (!proposal || proposal.status !== 'pending') { return false; }
    proposal.status = 'approved';
    // Also update in history
    const historyEntry = this.history.find((p) => p.id === proposalId);
    if (historyEntry) { historyEntry.status = 'approved'; }
    this.saveHistory();
    this.notify();
    return true;
  }

  dismiss(proposalId: string): boolean {
    const proposal = this.proposals.find((p) => p.id === proposalId);
    if (!proposal || proposal.status !== 'pending') { return false; }
    proposal.status = 'dismissed';
    const historyEntry = this.history.find((p) => p.id === proposalId);
    if (historyEntry) { historyEntry.status = 'dismissed'; }
    this.saveHistory();
    this.notify();
    return true;
  }

  dismissAll(): number {
    let count = 0;
    this.proposals.forEach((p) => {
      if (p.status === 'pending') {
        p.status = 'dismissed';
        count++;
        const historyEntry = this.history.find((h) => h.id === p.id);
        if (historyEntry) { historyEntry.status = 'dismissed'; }
      }
    });
    if (count > 0) {
      this.saveHistory();
      this.notify();
    }
    return count;
  }

  clearProposals(): void {
    this.proposals = [];
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Rule management
  // -----------------------------------------------------------------------

  getRules(): DangerRule[] {
    return [...this.rules];
  }

  getRuleCount(): number {
    return this.rules.length;
  }

  getEnabledRuleCount(): number {
    return this.rules.filter((r) => this.config.ruleOverrides[r.id] !== false).length;
  }

  isRuleEnabled(ruleId: string): boolean {
    return this.config.ruleOverrides[ruleId] !== false;
  }

  enableRule(ruleId: string): void {
    this.config.ruleOverrides[ruleId] = true;
    this.saveConfig();
    this.notify();
  }

  disableRule(ruleId: string): void {
    this.config.ruleOverrides[ruleId] = false;
    this.saveConfig();
    this.notify();
  }

  addRule(rule: DangerRule): void {
    const existing = this.rules.find((r) => r.id === rule.id);
    if (!existing) {
      this.rules.push(rule);
      this.notify();
    }
  }

  removeRule(ruleId: string): boolean {
    const idx = this.rules.findIndex((r) => r.id === ruleId);
    if (idx >= 0) {
      this.rules.splice(idx, 1);
      this.notify();
      return true;
    }
    return false;
  }

  // -----------------------------------------------------------------------
  // Statistics
  // -----------------------------------------------------------------------

  getStats(): {
    totalProposals: number;
    pending: number;
    approved: number;
    dismissed: number;
    autoApplied: number;
    bySeverity: Record<HealingSeverity, number>;
    byCategory: Record<HealingCategory, number>;
  } {
    const stats = {
      totalProposals: this.proposals.length,
      pending: 0,
      approved: 0,
      dismissed: 0,
      autoApplied: 0,
      bySeverity: { critical: 0, warning: 0, suggestion: 0 } as Record<HealingSeverity, number>,
      byCategory: {
        voltage: 0,
        current: 0,
        protection: 0,
        signal_integrity: 0,
        thermal: 0,
        mechanical: 0,
        best_practice: 0,
      } as Record<HealingCategory, number>,
    };
    this.proposals.forEach((p) => {
      if (p.status === 'pending') { stats.pending++; }
      else if (p.status === 'approved') { stats.approved++; }
      else if (p.status === 'dismissed') { stats.dismissed++; }
      else if (p.status === 'auto_applied') { stats.autoApplied++; }
      stats.bySeverity[p.severity]++;
      stats.byCategory[p.category]++;
    });
    return stats;
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useProactiveHealing(): {
  proposals: HealingProposal[];
  pendingProposals: HealingProposal[];
  config: HealingConfig;
  approve: (proposalId: string) => boolean;
  dismiss: (proposalId: string) => boolean;
  dismissAll: () => number;
  checkAction: (action: DesignAction, state: DesignState) => HealingProposal[];
  analyzeDesign: (state: DesignState) => HealingProposal[];
  updateConfig: (partial: Partial<HealingConfig>) => void;
  clearProposals: () => void;
  stats: ReturnType<ProactiveHealingEngine['getStats']>;
} {
  const engine = ProactiveHealingEngine.getInstance();
  const [, setTick] = useState(0);

  useEffect(() => {
    return engine.subscribe(() => setTick((t) => t + 1));
  }, [engine]);

  return {
    proposals: engine.getProposals(),
    pendingProposals: engine.getPendingProposals(),
    config: engine.getConfig(),
    approve: useCallback((id: string) => engine.approve(id), [engine]),
    dismiss: useCallback((id: string) => engine.dismiss(id), [engine]),
    dismissAll: useCallback(() => engine.dismissAll(), [engine]),
    checkAction: useCallback(
      (action: DesignAction, state: DesignState) => engine.checkAction(action, state),
      [engine],
    ),
    analyzeDesign: useCallback(
      (state: DesignState) => engine.analyzeDesign(state),
      [engine],
    ),
    updateConfig: useCallback(
      (partial: Partial<HealingConfig>) => engine.updateConfig(partial),
      [engine],
    ),
    clearProposals: useCallback(() => engine.clearProposals(), [engine]),
    stats: engine.getStats(),
  };
}
