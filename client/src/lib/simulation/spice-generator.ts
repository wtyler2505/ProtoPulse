/**
 * SPICE Netlist Generator (Phase 13.1)
 *
 * Generates SPICE netlists from ProtoPulse circuit data.
 * Supports basic component models and all four standard analyses:
 *   .OP (DC operating point)
 *   .TRAN (transient)
 *   .AC (frequency domain)
 *   .DC (DC sweep)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AnalysisType = 'op' | 'tran' | 'ac' | 'dc';

export interface TransientConfig {
  startTime: number;   // seconds
  stopTime: number;    // seconds
  timeStep: number;    // seconds
}

export interface ACConfig {
  startFreq: number;   // Hz
  stopFreq: number;    // Hz
  numPoints: number;
  sweepType: 'dec' | 'lin' | 'oct';
}

export interface DCSweepConfig {
  sourceName: string;  // e.g. "V1"
  startValue: number;
  stopValue: number;
  stepValue: number;
}

export interface SimulationConfig {
  analysis: AnalysisType;
  transient?: TransientConfig;
  ac?: ACConfig;
  dcSweep?: DCSweepConfig;
  temperature?: number;  // °C, default 27
}

export interface CircuitComponent {
  instanceId: number;
  referenceDesignator: string;
  family: string;           // Resistor, Capacitor, Inductor, Diode, etc.
  properties: Record<string, string>;
  connectors: Array<{
    id: string;
    name: string;
    netId: number | null;
  }>;
}

export interface CircuitNetInfo {
  id: number;
  name: string;
  netType: string;  // signal, power, ground, bus
}

export interface SpiceGeneratorInput {
  title: string;
  components: CircuitComponent[];
  nets: CircuitNetInfo[];
  config: SimulationConfig;
}

export interface SpiceGeneratorOutput {
  netlist: string;
  nodeMap: Record<string, number>;  // net name → SPICE node number
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Net-to-node number mapping
// ---------------------------------------------------------------------------

/**
 * Assign SPICE node numbers to nets.
 * Ground nets get node 0. All others get sequential integers starting from 1.
 */
function buildNodeMap(nets: CircuitNetInfo[]): Record<string, number> {
  const nodeMap: Record<string, number> = {};
  let nextNode = 1;

  // Ground nets first → node 0
  for (const net of nets) {
    const name = net.name.toUpperCase();
    if (net.netType === 'ground' || name === 'GND' || name === '0' ||
        name === 'AGND' || name === 'DGND' || name === 'VSS') {
      nodeMap[net.name] = 0;
    }
  }

  // Everything else gets sequential node numbers
  for (const net of nets) {
    if (nodeMap[net.name] === undefined) {
      nodeMap[net.name] = nextNode++;
    }
  }

  return nodeMap;
}

/**
 * Resolve the SPICE node number for a connector.
 * Returns '0' for unconnected pins (floating).
 */
function resolveNode(
  connector: { id: string; netId: number | null },
  nets: CircuitNetInfo[],
  nodeMap: Record<string, number>,
): string {
  if (connector.netId == null) return '0';
  const net = nets.find(n => n.id === connector.netId);
  if (!net) return '0';
  return String(nodeMap[net.name] ?? 0);
}

// ---------------------------------------------------------------------------
// Value parser — handles engineering notation (10k, 4.7u, 100n, etc.)
// ---------------------------------------------------------------------------

const SUFFIX_MULTIPLIERS: Record<string, number> = {
  T: 1e12, G: 1e9, MEG: 1e6, K: 1e3,
  M: 1e-3, U: 1e-6, N: 1e-9, P: 1e-12, F: 1e-15,
};

/**
 * Parse a component value string into a number.
 * Supports: "10k", "4.7u", "100nF", "1Meg", "0.01", "47", "2.2uH"
 */
export function parseSpiceValue(valueStr: string): number {
  if (!valueStr) return 0;

  const cleaned = valueStr.trim().toUpperCase();

  // Try direct numeric parse first
  const direct = parseFloat(cleaned);
  if (!isNaN(direct) && /^[\d.eE+-]+$/.test(cleaned)) {
    return direct;
  }

  // Extract numeric part and suffix
  const match = /^([\d.eE+-]+)\s*([A-Z]+)/.exec(cleaned);
  if (!match) return parseFloat(cleaned) || 0;

  const num = parseFloat(match[1]);
  let suffix = match[2];

  // Strip unit letters from suffix (F for Farads, H for Henries, etc.)
  // Only strip if the suffix is longer than a known multiplier
  if (suffix.length > 3) suffix = suffix.slice(0, 3);
  if (suffix.length > 1 && !SUFFIX_MULTIPLIERS[suffix]) {
    // Try shorter suffixes
    if (SUFFIX_MULTIPLIERS[suffix.slice(0, 1)]) {
      suffix = suffix.slice(0, 1);
    }
  }

  const multiplier = SUFFIX_MULTIPLIERS[suffix] ?? 1;
  return num * multiplier;
}

/**
 * Format a number in SPICE-compatible engineering notation.
 */
export function formatSpiceValue(value: number): string {
  if (value === 0) return '0';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 1e12) return `${sign}${(abs / 1e12).toPrecision(4)}T`;
  if (abs >= 1e9)  return `${sign}${(abs / 1e9).toPrecision(4)}G`;
  if (abs >= 1e6)  return `${sign}${(abs / 1e6).toPrecision(4)}MEG`;
  if (abs >= 1e3)  return `${sign}${(abs / 1e3).toPrecision(4)}K`;
  if (abs >= 1)    return `${sign}${abs.toPrecision(4)}`;
  if (abs >= 1e-3) return `${sign}${(abs / 1e-3).toPrecision(4)}M`;
  if (abs >= 1e-6) return `${sign}${(abs / 1e-6).toPrecision(4)}U`;
  if (abs >= 1e-9) return `${sign}${(abs / 1e-9).toPrecision(4)}N`;
  if (abs >= 1e-12) return `${sign}${(abs / 1e-12).toPrecision(4)}P`;
  return `${sign}${abs.toExponential(3)}`;
}

// ---------------------------------------------------------------------------
// Component model generators
// ---------------------------------------------------------------------------

interface SpiceLine {
  line: string;
  model?: string;  // .model card if needed
}

function getConnectorByName(
  connectors: CircuitComponent['connectors'],
  ...names: string[]
): CircuitComponent['connectors'][0] | undefined {
  for (const name of names) {
    const lower = name.toLowerCase();
    const found = connectors.find(c =>
      c.name.toLowerCase() === lower || c.id.toLowerCase() === lower,
    );
    if (found) return found;
  }
  return undefined;
}

/**
 * Normalize a component value string to SPICE-compatible engineering notation.
 * Strips unit suffixes (Ohm, F, H) and ensures consistent formatting.
 * e.g. "10kOhm" → "10.00K", "100nF" → "100.0N", "4.7uH" → "4.700U"
 */
function normalizeSpiceComponentValue(rawValue: string): string {
  const parsed = parseSpiceValue(rawValue);
  if (parsed === 0 && !/^0/.test(rawValue.trim())) {
    // Could not parse — return raw value and let SPICE try
    return rawValue;
  }
  return formatSpiceValue(parsed);
}

function generateResistor(
  comp: CircuitComponent,
  nets: CircuitNetInfo[],
  nodeMap: Record<string, number>,
): SpiceLine {
  const rawValue = comp.properties.value || comp.properties.resistance || '1k';
  const value = normalizeSpiceComponentValue(rawValue);
  const pin1 = comp.connectors[0];
  const pin2 = comp.connectors[1];

  const n1 = pin1 ? resolveNode(pin1, nets, nodeMap) : '0';
  const n2 = pin2 ? resolveNode(pin2, nets, nodeMap) : '0';

  return { line: `R${comp.referenceDesignator.replace(/^R/i, '')} ${n1} ${n2} ${value}` };
}

function generateCapacitor(
  comp: CircuitComponent,
  nets: CircuitNetInfo[],
  nodeMap: Record<string, number>,
): SpiceLine {
  const rawValue = comp.properties.value || comp.properties.capacitance || '100n';
  const value = normalizeSpiceComponentValue(rawValue);
  const pin1 = comp.connectors[0];
  const pin2 = comp.connectors[1];

  const n1 = pin1 ? resolveNode(pin1, nets, nodeMap) : '0';
  const n2 = pin2 ? resolveNode(pin2, nets, nodeMap) : '0';

  return { line: `C${comp.referenceDesignator.replace(/^C/i, '')} ${n1} ${n2} ${value}` };
}

function generateInductor(
  comp: CircuitComponent,
  nets: CircuitNetInfo[],
  nodeMap: Record<string, number>,
): SpiceLine {
  const rawValue = comp.properties.value || comp.properties.inductance || '10u';
  const value = normalizeSpiceComponentValue(rawValue);
  const pin1 = comp.connectors[0];
  const pin2 = comp.connectors[1];

  const n1 = pin1 ? resolveNode(pin1, nets, nodeMap) : '0';
  const n2 = pin2 ? resolveNode(pin2, nets, nodeMap) : '0';

  return { line: `L${comp.referenceDesignator.replace(/^L/i, '')} ${n1} ${n2} ${value}` };
}

function generateDiode(
  comp: CircuitComponent,
  nets: CircuitNetInfo[],
  nodeMap: Record<string, number>,
): SpiceLine {
  const modelName = comp.properties.model || `D_${comp.referenceDesignator}`;
  const anode = getConnectorByName(comp.connectors, 'anode', 'A', 'pin1') || comp.connectors[0];
  const cathode = getConnectorByName(comp.connectors, 'cathode', 'K', 'C', 'pin2') || comp.connectors[1];

  const n1 = anode ? resolveNode(anode, nets, nodeMap) : '0';
  const n2 = cathode ? resolveNode(cathode, nets, nodeMap) : '0';

  const is = comp.properties.Is || '1e-14';
  const n = comp.properties.N || '1';

  return {
    line: `D${comp.referenceDesignator.replace(/^D/i, '')} ${n1} ${n2} ${modelName}`,
    model: `.MODEL ${modelName} D(IS=${is} N=${n})`,
  };
}

function generateBJT(
  comp: CircuitComponent,
  nets: CircuitNetInfo[],
  nodeMap: Record<string, number>,
): SpiceLine {
  const type = (comp.properties.type || 'NPN').toUpperCase();
  const modelName = comp.properties.model || `Q_${comp.referenceDesignator}`;

  const collector = getConnectorByName(comp.connectors, 'collector', 'C', 'pin1') || comp.connectors[0];
  const base = getConnectorByName(comp.connectors, 'base', 'B', 'pin2') || comp.connectors[1];
  const emitter = getConnectorByName(comp.connectors, 'emitter', 'E', 'pin3') || comp.connectors[2];

  const nc = collector ? resolveNode(collector, nets, nodeMap) : '0';
  const nb = base ? resolveNode(base, nets, nodeMap) : '0';
  const ne = emitter ? resolveNode(emitter, nets, nodeMap) : '0';

  const bf = comp.properties.BF || '100';
  const is = comp.properties.Is || '1e-14';

  return {
    line: `Q${comp.referenceDesignator.replace(/^Q/i, '')} ${nc} ${nb} ${ne} ${modelName}`,
    model: `.MODEL ${modelName} ${type}(BF=${bf} IS=${is})`,
  };
}

function generateMOSFET(
  comp: CircuitComponent,
  nets: CircuitNetInfo[],
  nodeMap: Record<string, number>,
): SpiceLine {
  const type = (comp.properties.type || 'NMOS').toUpperCase();
  const modelName = comp.properties.model || `M_${comp.referenceDesignator}`;

  const drain = getConnectorByName(comp.connectors, 'drain', 'D', 'pin1') || comp.connectors[0];
  const gate = getConnectorByName(comp.connectors, 'gate', 'G', 'pin2') || comp.connectors[1];
  const source = getConnectorByName(comp.connectors, 'source', 'S', 'pin3') || comp.connectors[2];
  const bulk = getConnectorByName(comp.connectors, 'bulk', 'B', 'body', 'pin4') || comp.connectors[3];

  const nd = drain ? resolveNode(drain, nets, nodeMap) : '0';
  const ng = gate ? resolveNode(gate, nets, nodeMap) : '0';
  const ns = source ? resolveNode(source, nets, nodeMap) : '0';
  const nb = bulk ? resolveNode(bulk, nets, nodeMap) : ns;

  const kp = comp.properties.KP || '2e-5';
  const vto = comp.properties.VTO || (type === 'PMOS' ? '-0.7' : '0.7');
  const w = comp.properties.W || '10U';
  const l = comp.properties.L || '1U';

  return {
    line: `M${comp.referenceDesignator.replace(/^[MQ]/i, '')} ${nd} ${ng} ${ns} ${nb} ${modelName} W=${w} L=${l}`,
    model: `.MODEL ${modelName} ${type}(KP=${kp} VTO=${vto})`,
  };
}

function generateVoltageSource(
  comp: CircuitComponent,
  nets: CircuitNetInfo[],
  nodeMap: Record<string, number>,
): SpiceLine {
  const value = comp.properties.value || comp.properties.voltage || '5';
  const dcValue = parseSpiceValue(value);

  const pos = getConnectorByName(comp.connectors, 'positive', 'pos', '+', 'V+', 'pin1', 'VCC') || comp.connectors[0];
  const neg = getConnectorByName(comp.connectors, 'negative', 'neg', '-', 'V-', 'pin2', 'GND') || comp.connectors[1];

  const n1 = pos ? resolveNode(pos, nets, nodeMap) : '0';
  const n2 = neg ? resolveNode(neg, nets, nodeMap) : '0';

  // Check for AC signal source
  const acMag = comp.properties.acMagnitude;
  const acPhase = comp.properties.acPhase || '0';
  const freq = comp.properties.frequency;

  let spec = `DC ${formatSpiceValue(dcValue)}`;

  if (acMag) {
    spec += ` AC ${acMag} ${acPhase}`;
  }

  if (freq) {
    const amplitude = comp.properties.amplitude || value;
    const offset = comp.properties.offset || '0';
    spec += ` SIN(${offset} ${amplitude} ${freq})`;
  }

  const idx = comp.referenceDesignator.replace(/^V/i, '');
  return { line: `V${idx || (comp.instanceId)} ${n1} ${n2} ${spec}` };
}

function generateCurrentSource(
  comp: CircuitComponent,
  nets: CircuitNetInfo[],
  nodeMap: Record<string, number>,
): SpiceLine {
  const value = comp.properties.value || comp.properties.current || '1m';

  const pos = getConnectorByName(comp.connectors, 'positive', 'pos', '+', 'pin1') || comp.connectors[0];
  const neg = getConnectorByName(comp.connectors, 'negative', 'neg', '-', 'pin2') || comp.connectors[1];

  const n1 = pos ? resolveNode(pos, nets, nodeMap) : '0';
  const n2 = neg ? resolveNode(neg, nets, nodeMap) : '0';

  const idx = comp.referenceDesignator.replace(/^I/i, '');
  return { line: `I${idx || comp.instanceId} ${n1} ${n2} DC ${value}` };
}

function generateSubcircuit(
  comp: CircuitComponent,
  nets: CircuitNetInfo[],
  nodeMap: Record<string, number>,
  warnings: string[],
): SpiceLine {
  // Generic multi-pin component → X-prefixed subcircuit instance
  const nodes = comp.connectors
    .map(c => resolveNode(c, nets, nodeMap))
    .join(' ');

  const subcktName = comp.properties.spiceModel ||
    comp.family.replace(/\s+/g, '_').toUpperCase() ||
    'UNKNOWN';

  warnings.push(`${comp.referenceDesignator}: modeled as subcircuit X instance — provide .SUBCKT ${subcktName} definition`);

  return { line: `X${comp.referenceDesignator.replace(/^[UXJ]/i, '')} ${nodes} ${subcktName}` };
}

// ---------------------------------------------------------------------------
// Family → generator dispatch
// ---------------------------------------------------------------------------

type GeneratorFn = (
  comp: CircuitComponent,
  nets: CircuitNetInfo[],
  nodeMap: Record<string, number>,
  warnings: string[],
) => SpiceLine;

const FAMILY_GENERATORS: Record<string, GeneratorFn> = {
  resistor: (c, n, m, _w) => generateResistor(c, n, m),
  capacitor: (c, n, m, _w) => generateCapacitor(c, n, m),
  inductor: (c, n, m, _w) => generateInductor(c, n, m),
  diode: (c, n, m, _w) => generateDiode(c, n, m),
  led: (c, n, m, _w) => generateDiode(c, n, m),
  transistor: (c, n, m, _w) => generateBJT(c, n, m),
  bjt: (c, n, m, _w) => generateBJT(c, n, m),
  mosfet: (c, n, m, _w) => generateMOSFET(c, n, m),
  'voltage source': (c, n, m, _w) => generateVoltageSource(c, n, m),
  'current source': (c, n, m, _w) => generateCurrentSource(c, n, m),
  battery: (c, n, m, _w) => generateVoltageSource(c, n, m),
};

function getGenerator(family: string): GeneratorFn {
  const key = family.toLowerCase().trim();
  return FAMILY_GENERATORS[key] || generateSubcircuit;
}

// ---------------------------------------------------------------------------
// Analysis card generation
// ---------------------------------------------------------------------------

function generateAnalysisCard(config: SimulationConfig): string[] {
  const lines: string[] = [];

  switch (config.analysis) {
    case 'op':
      lines.push('.OP');
      break;

    case 'tran': {
      const t = config.transient;
      if (!t) {
        lines.push('.TRAN 1U 1M');
      } else {
        const step = formatSpiceValue(t.timeStep);
        const stop = formatSpiceValue(t.stopTime);
        if (t.startTime > 0) {
          const start = formatSpiceValue(t.startTime);
          lines.push(`.TRAN ${step} ${stop} ${start}`);
        } else {
          lines.push(`.TRAN ${step} ${stop}`);
        }
      }
      break;
    }

    case 'ac': {
      const a = config.ac;
      if (!a) {
        lines.push('.AC DEC 100 1 1MEG');
      } else {
        const sweep = a.sweepType.toUpperCase();
        const start = formatSpiceValue(a.startFreq);
        const stop = formatSpiceValue(a.stopFreq);
        lines.push(`.AC ${sweep} ${a.numPoints} ${start} ${stop}`);
      }
      break;
    }

    case 'dc': {
      const d = config.dcSweep;
      if (!d) {
        lines.push('.DC V1 0 5 0.1');
      } else {
        const start = formatSpiceValue(d.startValue);
        const stop = formatSpiceValue(d.stopValue);
        const step = formatSpiceValue(d.stepValue);
        lines.push(`.DC ${d.sourceName} ${start} ${stop} ${step}`);
      }
      break;
    }
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

/**
 * Generate a SPICE netlist from circuit data.
 */
export function generateSpiceNetlist(input: SpiceGeneratorInput): SpiceGeneratorOutput {
  const warnings: string[] = [];
  const nodeMap = buildNodeMap(input.nets);
  const lines: string[] = [];
  const models: string[] = [];

  // Title
  lines.push(`* ${input.title || 'ProtoPulse Circuit'}`);
  lines.push(`* Generated by ProtoPulse — ${new Date().toISOString()}`);
  lines.push('');

  // Temperature
  if (input.config.temperature !== undefined && input.config.temperature !== 27) {
    lines.push(`.TEMP ${input.config.temperature}`);
    lines.push('');
  }

  // Node map comment
  lines.push('* Node mapping:');
  const sortedNodes = Object.entries(nodeMap)
    .sort((a, b) => a[1] - b[1]);
  for (const [name, num] of sortedNodes) {
    lines.push(`*   ${num} = ${name}`);
  }
  lines.push('');

  // Components
  lines.push('* Components');
  const seenModels = new Set<string>();

  for (const comp of input.components) {
    if (comp.connectors.length === 0) {
      warnings.push(`${comp.referenceDesignator}: no connectors — skipped`);
      continue;
    }

    const generator = getGenerator(comp.family);
    const result = generator(comp, input.nets, nodeMap, warnings);

    lines.push(result.line);

    if (result.model && !seenModels.has(result.model)) {
      seenModels.add(result.model);
      models.push(result.model);
    }
  }

  // Models
  if (models.length > 0) {
    lines.push('');
    lines.push('* Device models');
    for (const model of models) {
      lines.push(model);
    }
  }

  // Analysis
  lines.push('');
  lines.push('* Analysis');
  const analysisLines = generateAnalysisCard(input.config);
  for (const al of analysisLines) {
    lines.push(al);
  }

  // Control cards
  lines.push('');
  lines.push('.CONTROL');
  lines.push('run');
  if (input.config.analysis === 'op') {
    lines.push('print all');
  } else {
    lines.push('set hcopypscolor = 1');
    lines.push('plot all');
  }
  lines.push('.ENDC');

  // End
  lines.push('');
  lines.push('.END');

  // Check for ground node
  const hasGround = Object.values(nodeMap).includes(0);
  if (!hasGround && input.components.length > 0) {
    warnings.push('No ground net found — SPICE requires at least one node 0 (ground)');
  }

  return {
    netlist: lines.join('\n'),
    nodeMap,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Convenience: Quick netlist for DC operating point
// ---------------------------------------------------------------------------

export function generateDCOpNetlist(
  title: string,
  components: CircuitComponent[],
  nets: CircuitNetInfo[],
): SpiceGeneratorOutput {
  return generateSpiceNetlist({
    title,
    components,
    nets,
    config: { analysis: 'op' },
  });
}
