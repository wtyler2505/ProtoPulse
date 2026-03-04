/**
 * Design Gateway — proactive real-time design validation layer.
 *
 * Runs lightweight heuristic rules against the live design state and surfaces
 * warnings *before* a formal DRC pass.  Intended to catch common beginner and
 * intermediate mistakes as the user builds their circuit.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal node representation consumed by the gateway. */
export interface DesignNode {
  id: string;
  label: string;
  type: string;
  properties?: Record<string, string>;
}

/** Minimal edge/connection representation. */
export interface DesignEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  signalType?: string;
  voltage?: string;
}

/** Minimal BOM item representation. */
export interface DesignBomItem {
  id: string;
  partNumber: string;
  description: string;
  quantity: number;
}

/** Snapshot of design state that rules evaluate against. */
export interface DesignState {
  nodes: DesignNode[];
  edges: DesignEdge[];
  bomItems: DesignBomItem[];
}

export interface GatewayViolation {
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  affectedNodes: string[];
  suggestion: string;
}

export type GatewayRuleCategory = 'power' | 'signal' | 'protection' | 'best-practice';

export interface GatewayRule {
  id: string;
  name: string;
  category: GatewayRuleCategory;
  severity: 'error' | 'warning' | 'info';
  enabled: boolean;
  check: (state: DesignState) => GatewayViolation[];
}

// ---------------------------------------------------------------------------
// Helpers — node classification
// ---------------------------------------------------------------------------

const IC_TYPE_PATTERNS = [
  'mcu', 'microcontroller', 'ic', 'chip', 'processor', 'controller',
  'arduino', 'esp32', 'esp8266', 'stm32', 'atmega', 'attiny',
  'op-amp', 'opamp', 'comparator', 'timer', 'shift-register',
  'adc', 'dac', 'fpga', 'cpld',
];

const CAPACITOR_PATTERNS = ['capacitor', 'cap', 'decoupling', 'bypass'];
const RESISTOR_PATTERNS = ['resistor', 'pull-up', 'pull-down', 'pullup', 'pulldown'];
const CRYSTAL_PATTERNS = ['crystal', 'oscillator', 'xtal', 'resonator'];
const POWER_PATTERNS = ['regulator', 'vreg', 'ldo', 'buck', 'boost', 'mosfet', 'transistor', 'power'];
const PROTECTION_PATTERNS = ['diode', 'tvs', 'zener', 'fuse', 'polyfuse', 'protection', 'reverse-polarity'];
const TEST_POINT_PATTERNS = ['test-point', 'testpoint', 'tp', 'test_point'];
const POWER_SOURCE_PATTERNS = ['battery', 'power-supply', 'psu', 'usb', 'voltage-source', 'vin', 'vcc', 'vdd'];
const HEATSINK_PATTERNS = ['heatsink', 'heat-sink', 'thermal'];

function matchesAny(text: string, patterns: string[]): boolean {
  const lower = text.toLowerCase();
  return patterns.some((p) => lower.includes(p));
}

function isIC(node: DesignNode): boolean {
  return matchesAny(node.type, IC_TYPE_PATTERNS) || matchesAny(node.label, IC_TYPE_PATTERNS);
}

function isCapacitor(node: DesignNode): boolean {
  return matchesAny(node.type, CAPACITOR_PATTERNS) || matchesAny(node.label, CAPACITOR_PATTERNS);
}

function isResistor(node: DesignNode): boolean {
  return matchesAny(node.type, RESISTOR_PATTERNS) || matchesAny(node.label, RESISTOR_PATTERNS);
}

function isCrystal(node: DesignNode): boolean {
  return matchesAny(node.type, CRYSTAL_PATTERNS) || matchesAny(node.label, CRYSTAL_PATTERNS);
}

function isPowerComponent(node: DesignNode): boolean {
  return matchesAny(node.type, POWER_PATTERNS) || matchesAny(node.label, POWER_PATTERNS);
}

function isProtection(node: DesignNode): boolean {
  return matchesAny(node.type, PROTECTION_PATTERNS) || matchesAny(node.label, PROTECTION_PATTERNS);
}

function isTestPoint(node: DesignNode): boolean {
  return matchesAny(node.type, TEST_POINT_PATTERNS) || matchesAny(node.label, TEST_POINT_PATTERNS);
}

function isPowerSource(node: DesignNode): boolean {
  return matchesAny(node.type, POWER_SOURCE_PATTERNS) || matchesAny(node.label, POWER_SOURCE_PATTERNS);
}

function isHeatsink(node: DesignNode): boolean {
  return matchesAny(node.type, HEATSINK_PATTERNS) || matchesAny(node.label, HEATSINK_PATTERNS);
}

function isI2COrSPI(node: DesignNode): boolean {
  const text = `${node.type} ${node.label} ${node.properties?.bus ?? ''} ${node.properties?.protocol ?? ''}`.toLowerCase();
  return text.includes('i2c') || text.includes('spi') || text.includes('iic') || text.includes('twi');
}

/** Build an adjacency set: nodeId ➜ set of connected nodeIds. */
function buildAdjacency(edges: DesignEdge[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  edges.forEach((e) => {
    if (!adj.has(e.source)) {
      adj.set(e.source, new Set());
    }
    adj.get(e.source)!.add(e.target);
    if (!adj.has(e.target)) {
      adj.set(e.target, new Set());
    }
    adj.get(e.target)!.add(e.source);
  });
  return adj;
}

/** Get IDs of all nodes connected to the given nodeId. */
function connectedNodeIds(nodeId: string, adj: Map<string, Set<string>>): string[] {
  return Array.from(adj.get(nodeId) ?? []);
}

/** Parse a numeric voltage from a string like "3.3V", "5 V", "12V". */
function parseVoltage(v: string | undefined): number | null {
  if (!v) {
    return null;
  }
  const match = v.match(/([\d.]+)\s*v/i);
  if (match) {
    return parseFloat(match[1]);
  }
  return null;
}

/** Parse a wattage / power dissipation string. */
function parsePower(node: DesignNode): number | null {
  const raw = node.properties?.power ?? node.properties?.dissipation ?? node.properties?.watts;
  if (!raw) {
    return null;
  }
  const match = raw.match(/([\d.]+)\s*w/i);
  if (match) {
    return parseFloat(match[1]);
  }
  const n = parseFloat(raw);
  return Number.isNaN(n) ? null : n;
}

// ---------------------------------------------------------------------------
// Built-in rules
// ---------------------------------------------------------------------------

function makeMissingDecouplingCap(): GatewayRule {
  return {
    id: 'missing-decoupling-cap',
    name: 'Missing decoupling capacitor',
    category: 'power',
    severity: 'warning',
    enabled: true,
    check(state) {
      const adj = buildAdjacency(state.edges);
      const violations: GatewayViolation[] = [];

      state.nodes.filter(isIC).forEach((ic) => {
        const neighbours = connectedNodeIds(ic.id, adj);
        const hasCap = neighbours.some((nid) => {
          const n = state.nodes.find((nd) => nd.id === nid);
          return n ? isCapacitor(n) : false;
        });

        if (!hasCap) {
          violations.push({
            ruleId: 'missing-decoupling-cap',
            severity: 'warning',
            message: `IC "${ic.label}" has no decoupling capacitor connected nearby.`,
            affectedNodes: [ic.id],
            suggestion: 'Add a 100 nF ceramic capacitor between VCC and GND as close to the IC as possible.',
          });
        }
      });

      return violations;
    },
  };
}

function makeFloatingInput(): GatewayRule {
  return {
    id: 'floating-input',
    name: 'Floating input pin',
    category: 'signal',
    severity: 'error',
    enabled: true,
    check(state) {
      const adj = buildAdjacency(state.edges);
      const violations: GatewayViolation[] = [];

      state.nodes.forEach((node) => {
        const pinType = (node.properties?.pinType ?? node.properties?.direction ?? '').toLowerCase();
        if (pinType !== 'input') {
          return;
        }
        const connections = connectedNodeIds(node.id, adj);
        if (connections.length === 0) {
          violations.push({
            ruleId: 'floating-input',
            severity: 'error',
            message: `Input pin "${node.label}" is not connected to anything.`,
            affectedNodes: [node.id],
            suggestion: 'Connect this input pin to a signal source, pull-up, or pull-down resistor to avoid undefined behaviour.',
          });
        }
      });

      return violations;
    },
  };
}

function makeUnconnectedPower(): GatewayRule {
  return {
    id: 'unconnected-power',
    name: 'Unconnected power pin',
    category: 'power',
    severity: 'error',
    enabled: true,
    check(state) {
      const adj = buildAdjacency(state.edges);
      const violations: GatewayViolation[] = [];

      state.nodes.forEach((node) => {
        const pinType = (node.properties?.pinType ?? node.properties?.direction ?? '').toLowerCase();
        if (pinType !== 'power') {
          return;
        }
        const connections = connectedNodeIds(node.id, adj);
        if (connections.length === 0) {
          violations.push({
            ruleId: 'unconnected-power',
            severity: 'error',
            message: `Power pin "${node.label}" is not connected to any source.`,
            affectedNodes: [node.id],
            suggestion: 'Connect this power pin to VCC/VDD, a regulator output, or another appropriate power rail.',
          });
        }
      });

      return violations;
    },
  };
}

function makeMissingPullResistor(): GatewayRule {
  return {
    id: 'missing-pull-resistor',
    name: 'Missing pull-up/pull-down resistor on bus',
    category: 'signal',
    severity: 'warning',
    enabled: true,
    check(state) {
      const adj = buildAdjacency(state.edges);
      const violations: GatewayViolation[] = [];

      state.nodes.filter(isI2COrSPI).forEach((busNode) => {
        const neighbours = connectedNodeIds(busNode.id, adj);
        const hasPull = neighbours.some((nid) => {
          const n = state.nodes.find((nd) => nd.id === nid);
          if (!n) {
            return false;
          }
          const lbl = n.label.toLowerCase();
          return isResistor(n) && (lbl.includes('pull') || lbl.includes('pullup') || lbl.includes('pull-up') || lbl.includes('pulldown') || lbl.includes('pull-down'));
        });

        // Also check if the bus node itself is a pull-resistor or if any neighbour is just a resistor
        // (being lenient — any resistor on a bus line is likely a pull resistor)
        const hasAnyResistor = neighbours.some((nid) => {
          const n = state.nodes.find((nd) => nd.id === nid);
          return n ? isResistor(n) : false;
        });

        if (!hasPull && !hasAnyResistor) {
          violations.push({
            ruleId: 'missing-pull-resistor',
            severity: 'warning',
            message: `I2C/SPI bus component "${busNode.label}" has no pull-up or pull-down resistor.`,
            affectedNodes: [busNode.id],
            suggestion: 'Add 4.7 kΩ pull-up resistors to SDA and SCL lines for I2C, or appropriate pull-ups for SPI chip-select lines.',
          });
        }
      });

      return violations;
    },
  };
}

function makeHighCurrentNoHeatsink(): GatewayRule {
  return {
    id: 'high-current-no-heatsink',
    name: 'High-power component without heatsink',
    category: 'power',
    severity: 'warning',
    enabled: true,
    check(state) {
      const adj = buildAdjacency(state.edges);
      const violations: GatewayViolation[] = [];

      state.nodes.filter(isPowerComponent).forEach((pNode) => {
        const watts = parsePower(pNode);
        if (watts === null || watts <= 1) {
          return;
        }

        const neighbours = connectedNodeIds(pNode.id, adj);
        const hasHeatsink = neighbours.some((nid) => {
          const n = state.nodes.find((nd) => nd.id === nid);
          return n ? isHeatsink(n) : false;
        });

        // Also check if the component itself mentions heatsink
        const selfHasHeatsink = matchesAny(
          `${pNode.label} ${pNode.properties?.heatsink ?? ''} ${pNode.properties?.cooling ?? ''}`,
          HEATSINK_PATTERNS,
        );

        if (!hasHeatsink && !selfHasHeatsink) {
          violations.push({
            ruleId: 'high-current-no-heatsink',
            severity: 'warning',
            message: `Power component "${pNode.label}" dissipates ${watts} W but has no heatsink.`,
            affectedNodes: [pNode.id],
            suggestion: `Add a heatsink rated for at least ${watts} W dissipation, or consider a component with lower power loss.`,
          });
        }
      });

      return violations;
    },
  };
}

function makeCrystalMissingLoadCaps(): GatewayRule {
  return {
    id: 'crystal-missing-load-caps',
    name: 'Crystal/oscillator missing load capacitors',
    category: 'signal',
    severity: 'warning',
    enabled: true,
    check(state) {
      const adj = buildAdjacency(state.edges);
      const violations: GatewayViolation[] = [];

      state.nodes.filter(isCrystal).forEach((xtal) => {
        const neighbours = connectedNodeIds(xtal.id, adj);
        const caps = neighbours.filter((nid) => {
          const n = state.nodes.find((nd) => nd.id === nid);
          return n ? isCapacitor(n) : false;
        });

        // A crystal typically needs 2 load caps
        if (caps.length < 2) {
          violations.push({
            ruleId: 'crystal-missing-load-caps',
            severity: 'warning',
            message: `Crystal "${xtal.label}" has ${caps.length} load capacitor(s) — typically 2 are required.`,
            affectedNodes: [xtal.id],
            suggestion: 'Add two load capacitors (one on each crystal pin to ground). Check the crystal datasheet for recommended load capacitance.',
          });
        }
      });

      return violations;
    },
  };
}

function makeVoltageMismatch(): GatewayRule {
  return {
    id: 'voltage-mismatch',
    name: 'Voltage domain mismatch',
    category: 'power',
    severity: 'error',
    enabled: true,
    check(state) {
      const violations: GatewayViolation[] = [];

      state.edges.forEach((edge) => {
        const srcNode = state.nodes.find((n) => n.id === edge.source);
        const tgtNode = state.nodes.find((n) => n.id === edge.target);
        if (!srcNode || !tgtNode) {
          return;
        }

        const srcV = parseVoltage(srcNode.properties?.voltage ?? edge.voltage);
        const tgtV = parseVoltage(tgtNode.properties?.voltage ?? edge.voltage);

        if (srcV !== null && tgtV !== null && srcV !== tgtV) {
          // Skip if one of them is a level shifter
          const combined = `${srcNode.label} ${srcNode.type} ${tgtNode.label} ${tgtNode.type}`.toLowerCase();
          if (combined.includes('level-shift') || combined.includes('levelshift') || combined.includes('level shifter') || combined.includes('translator')) {
            return;
          }

          violations.push({
            ruleId: 'voltage-mismatch',
            severity: 'error',
            message: `Voltage mismatch: "${srcNode.label}" (${srcV} V) connected directly to "${tgtNode.label}" (${tgtV} V).`,
            affectedNodes: [srcNode.id, tgtNode.id],
            suggestion: 'Add a level shifter or voltage divider between these components to safely translate signal levels.',
          });
        }
      });

      return violations;
    },
  };
}

function makeRedundantComponent(): GatewayRule {
  return {
    id: 'redundant-component',
    name: 'Potentially redundant component',
    category: 'best-practice',
    severity: 'info',
    enabled: true,
    check(state) {
      const violations: GatewayViolation[] = [];

      // Group by type+label (case-insensitive) — exact duplicates only
      const seen = new Map<string, DesignNode[]>();
      state.nodes.forEach((node) => {
        const key = `${node.type.toLowerCase()}::${node.label.toLowerCase()}`;
        const group = seen.get(key);
        if (group) {
          group.push(node);
        } else {
          seen.set(key, [node]);
        }
      });

      Array.from(seen.values()).forEach((group) => {
        if (group.length <= 1) {
          return;
        }
        // Passives (resistors, capacitors) are commonly duplicated — skip
        const first = group[0];
        if (isCapacitor(first) || isResistor(first)) {
          return;
        }
        violations.push({
          ruleId: 'redundant-component',
          severity: 'info',
          message: `${group.length} instances of "${first.label}" (${first.type}) — verify this is intentional.`,
          affectedNodes: group.map((n) => n.id),
          suggestion: 'If these serve the same function, consider removing duplicates. If intentional (e.g. redundancy), this can be ignored.',
        });
      });

      return violations;
    },
  };
}

function makeMissingProtection(): GatewayRule {
  return {
    id: 'missing-protection',
    name: 'No reverse-polarity protection on power input',
    category: 'protection',
    severity: 'warning',
    enabled: true,
    check(state) {
      const violations: GatewayViolation[] = [];
      const adj = buildAdjacency(state.edges);

      const powerSources = state.nodes.filter(isPowerSource);
      if (powerSources.length === 0) {
        return violations;
      }

      const hasProtection = state.nodes.some(isProtection);

      // Also check if any power source is directly connected to a protection device
      const protectionNearPower = powerSources.some((ps) => {
        const neighbours = connectedNodeIds(ps.id, adj);
        return neighbours.some((nid) => {
          const n = state.nodes.find((nd) => nd.id === nid);
          return n ? isProtection(n) : false;
        });
      });

      if (!hasProtection && !protectionNearPower) {
        violations.push({
          ruleId: 'missing-protection',
          severity: 'warning',
          message: 'Design has power input but no reverse-polarity protection component.',
          affectedNodes: powerSources.map((p) => p.id),
          suggestion: 'Add a Schottky diode, P-channel MOSFET, or ideal diode controller on the power input for reverse-polarity protection.',
        });
      }

      return violations;
    },
  };
}

function makeNoTestPoints(): GatewayRule {
  return {
    id: 'no-test-points',
    name: 'No test points in design',
    category: 'best-practice',
    severity: 'info',
    enabled: true,
    check(state) {
      const violations: GatewayViolation[] = [];

      if (state.nodes.length <= 10) {
        return violations;
      }

      const hasTP = state.nodes.some(isTestPoint);
      if (!hasTP) {
        violations.push({
          ruleId: 'no-test-points',
          severity: 'info',
          message: `Design has ${state.nodes.length} nodes but no test points.`,
          affectedNodes: [],
          suggestion: 'Add test points on key signals (power rails, clocks, data buses) to make debugging and verification easier.',
        });
      }

      return violations;
    },
  };
}

function makeMissingGroundConnection(): GatewayRule {
  return {
    id: 'missing-ground-connection',
    name: 'IC without ground connection',
    category: 'power',
    severity: 'error',
    enabled: true,
    check(state) {
      const adj = buildAdjacency(state.edges);
      const violations: GatewayViolation[] = [];

      // Find ground nodes
      const groundNodeIds = new Set(
        state.nodes
          .filter((n) => {
            const text = `${n.label} ${n.type}`.toLowerCase();
            return text.includes('gnd') || text.includes('ground') || text.includes('vss');
          })
          .map((n) => n.id),
      );

      if (groundNodeIds.size === 0) {
        return violations;
      }

      state.nodes.filter(isIC).forEach((ic) => {
        const neighbours = connectedNodeIds(ic.id, adj);
        const hasGround = neighbours.some((nid) => groundNodeIds.has(nid));
        if (!hasGround) {
          violations.push({
            ruleId: 'missing-ground-connection',
            severity: 'error',
            message: `IC "${ic.label}" has no ground (GND) connection.`,
            affectedNodes: [ic.id],
            suggestion: 'Connect the GND pin(s) of this IC to the ground plane/rail.',
          });
        }
      });

      return violations;
    },
  };
}

function makeUnusedBomItem(): GatewayRule {
  return {
    id: 'unused-bom-item',
    name: 'BOM item not placed in design',
    category: 'best-practice',
    severity: 'info',
    enabled: true,
    check(state) {
      const violations: GatewayViolation[] = [];

      if (state.bomItems.length === 0 || state.nodes.length === 0) {
        return violations;
      }

      // Try to match BOM items to placed nodes by part number or description
      state.bomItems.forEach((bom) => {
        const bomText = `${bom.partNumber} ${bom.description}`.toLowerCase();
        const hasMatch = state.nodes.some((node) => {
          const nodeText = `${node.label} ${node.type} ${node.properties?.partNumber ?? ''}`.toLowerCase();
          // Check if any meaningful overlap exists
          return bomText.split(/\s+/).some(
            (word) => word.length > 2 && nodeText.includes(word),
          );
        });

        if (!hasMatch) {
          violations.push({
            ruleId: 'unused-bom-item',
            severity: 'info',
            message: `BOM item "${bom.description}" (${bom.partNumber}) does not appear to be placed in the design.`,
            affectedNodes: [],
            suggestion: 'Place this component in the schematic, or remove it from the BOM if it is no longer needed.',
          });
        }
      });

      return violations;
    },
  };
}

// ---------------------------------------------------------------------------
// DesignGateway singleton
// ---------------------------------------------------------------------------

export class DesignGateway {
  private static instance: DesignGateway | null = null;

  private rules: Map<string, GatewayRule>;
  private subscribers: Set<() => void> = new Set();

  private constructor() {
    this.rules = new Map();
    const builtins: GatewayRule[] = [
      makeMissingDecouplingCap(),
      makeFloatingInput(),
      makeUnconnectedPower(),
      makeMissingPullResistor(),
      makeHighCurrentNoHeatsink(),
      makeCrystalMissingLoadCaps(),
      makeVoltageMismatch(),
      makeRedundantComponent(),
      makeMissingProtection(),
      makeNoTestPoints(),
      makeMissingGroundConnection(),
      makeUnusedBomItem(),
    ];
    builtins.forEach((r) => this.rules.set(r.id, r));
  }

  static getInstance(): DesignGateway {
    if (!DesignGateway.instance) {
      DesignGateway.instance = new DesignGateway();
    }
    return DesignGateway.instance;
  }

  /** Reset singleton — useful for testing. */
  static resetInstance(): void {
    DesignGateway.instance = null;
  }

  validate(state: DesignState): GatewayViolation[] {
    const violations: GatewayViolation[] = [];
    Array.from(this.rules.values())
      .filter((r) => r.enabled)
      .forEach((rule) => {
        violations.push(...rule.check(state));
      });
    return violations;
  }

  enableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = true;
      this.notify();
    }
  }

  disableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = false;
      this.notify();
    }
  }

  getRules(): GatewayRule[] {
    return Array.from(this.rules.values());
  }

  getEnabledRules(): GatewayRule[] {
    return Array.from(this.rules.values()).filter((r) => r.enabled);
  }

  subscribe(cb: () => void): () => void {
    this.subscribers.add(cb);
    return () => {
      this.subscribers.delete(cb);
    };
  }

  private notify(): void {
    this.subscribers.forEach((cb) => cb());
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export interface UseDesignGatewayReturn {
  violations: GatewayViolation[];
  validate: (state: DesignState) => GatewayViolation[];
  enableRule: (ruleId: string) => void;
  disableRule: (ruleId: string) => void;
  rules: GatewayRule[];
}

export function useDesignGateway(): UseDesignGatewayReturn {
  const gatewayRef = useRef(DesignGateway.getInstance());
  const [violations, setViolations] = useState<GatewayViolation[]>([]);
  const [rules, setRules] = useState<GatewayRule[]>(() => gatewayRef.current.getRules());

  useEffect(() => {
    const unsubscribe = gatewayRef.current.subscribe(() => {
      setRules([...gatewayRef.current.getRules()]);
    });
    return unsubscribe;
  }, []);

  const validate = useCallback((state: DesignState) => {
    const result = gatewayRef.current.validate(state);
    setViolations(result);
    return result;
  }, []);

  const enableRule = useCallback((ruleId: string) => {
    gatewayRef.current.enableRule(ruleId);
  }, []);

  const disableRule = useCallback((ruleId: string) => {
    gatewayRef.current.disableRule(ruleId);
  }, []);

  return { violations, validate, enableRule, disableRule, rules };
}
