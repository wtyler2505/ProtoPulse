/**
 * SPICE Exporter (Phase 13.2)
 *
 * Server-side SPICE netlist generation from circuit data.
 * Uses the same logic as the client-side spice-generator but operates
 * on database row types directly.
 */

import type { CircuitInstanceRow, CircuitNetRow, ComponentPart } from '@shared/schema';
import type { Connector, PartMeta } from '@shared/component-types';
import {
  type CircuitInstanceData,
  type CircuitNetData,
  type ComponentPartData,
  type ExportResult,
  metaStr,
  sanitizeFilename,
} from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SpiceAnalysis = 'op' | 'tran' | 'ac' | 'dc';

export interface SpiceExportConfig {
  analysis: SpiceAnalysis;
  transient?: { startTime: number; stopTime: number; timeStep: number };
  ac?: { startFreq: number; stopFreq: number; numPoints: number; sweepType: 'dec' | 'lin' | 'oct' };
  dcSweep?: { sourceName: string; startValue: number; stopValue: number; stepValue: number };
  temperature?: number;
}

export interface SpiceExportInput {
  circuitName: string;
  instances: CircuitInstanceRow[];
  nets: CircuitNetRow[];
  parts: ComponentPart[];
  config: SpiceExportConfig;
}

export interface SpiceExportOutput {
  netlist: string;
  filename: string;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Value formatting
// ---------------------------------------------------------------------------

function formatSpiceValue(value: number): string {
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

function parseValueStr(s: string): number {
  if (!s) return 0;
  const cleaned = s.trim().toUpperCase();
  const direct = parseFloat(cleaned);
  if (!isNaN(direct) && /^[\d.eE+-]+$/.test(cleaned)) return direct;

  const match = /^([\d.eE+-]+)\s*([A-Z]+)/.exec(cleaned);
  if (!match) return parseFloat(cleaned) || 0;

  const num = parseFloat(match[1]);
  const suffixes: Record<string, number> = {
    T: 1e12, G: 1e9, MEG: 1e6, K: 1e3, M: 1e-3, U: 1e-6, N: 1e-9, P: 1e-12, F: 1e-15,
  };

  let suffix = match[2];
  if (suffix.length > 3) suffix = suffix.slice(0, 3);
  if (suffix.length > 1 && !suffixes[suffix]) {
    if (suffixes[suffix.slice(0, 1)]) suffix = suffix.slice(0, 1);
  }

  return num * (suffixes[suffix] ?? 1);
}

// ---------------------------------------------------------------------------
// Net → node mapping
// ---------------------------------------------------------------------------

interface NodeMap {
  map: Record<string, number>;
  netIdToName: Record<number, string>;
}

function buildNodeMap(nets: CircuitNetRow[]): NodeMap {
  const map: Record<string, number> = {};
  const netIdToName: Record<number, string> = {};
  let nextNode = 1;

  for (const net of nets) {
    netIdToName[net.id] = net.name;
    const upper = net.name.toUpperCase();
    if (net.netType === 'ground' || upper === 'GND' || upper === '0' ||
        upper === 'AGND' || upper === 'DGND' || upper === 'VSS') {
      map[net.name] = 0;
    }
  }

  for (const net of nets) {
    if (map[net.name] === undefined) {
      map[net.name] = nextNode++;
    }
  }

  return { map, netIdToName };
}

// ---------------------------------------------------------------------------
// Pin-to-net resolution
// ---------------------------------------------------------------------------

function resolvePinNet(
  instance: CircuitInstanceRow,
  pinId: string,
  nets: CircuitNetRow[],
  nodeMap: NodeMap,
): string {
  // Search through net segments to find which net connects to this instance+pin
  for (const net of nets) {
    const segments = (net.segments ?? []) as Array<{
      fromInstanceId: number; fromPin: string;
      toInstanceId: number; toPin: string;
    }>;

    for (const seg of segments) {
      if ((seg.fromInstanceId === instance.id && seg.fromPin === pinId) ||
          (seg.toInstanceId === instance.id && seg.toPin === pinId)) {
        return String(nodeMap.map[net.name] ?? 0);
      }
    }
  }

  return '0'; // Unconnected → ground
}

// ---------------------------------------------------------------------------
// Component SPICE line generators
// ---------------------------------------------------------------------------

function getFamily(part: ComponentPart): string {
  const meta = (part.meta ?? {}) as Partial<PartMeta>;
  return (meta.family || '').toLowerCase().trim();
}

function getConnectors(part: ComponentPart): Connector[] {
  return (part.connectors ?? []) as Connector[];
}

function getProps(instance: CircuitInstanceRow): Record<string, string> {
  return (instance.properties ?? {}) as Record<string, string>;
}

function findConnector(connectors: Connector[], ...names: string[]): Connector | undefined {
  for (const name of names) {
    const lower = name.toLowerCase();
    const found = connectors.find(c =>
      c.name.toLowerCase() === lower || c.id.toLowerCase() === lower,
    );
    if (found) return found;
  }
  return undefined;
}

function generateComponentLine(
  instance: CircuitInstanceRow,
  part: ComponentPart,
  nets: CircuitNetRow[],
  nodeMap: NodeMap,
  warnings: string[],
): { line: string; model?: string } {
  const family = getFamily(part);
  const connectors = getConnectors(part);
  const props = getProps(instance);
  const refDes = instance.referenceDesignator;

  if (connectors.length === 0) {
    warnings.push(`${refDes}: no connectors, skipped`);
    return { line: `* ${refDes} — no connectors, skipped` };
  }

  const node = (pinId: string) => resolvePinNet(instance, pinId, nets, nodeMap);

  switch (family) {
    case 'resistor': {
      const value = props.value || props.resistance || '1k';
      const n1 = node(connectors[0]?.id || 'pin1');
      const n2 = node(connectors[1]?.id || 'pin2');
      return { line: `R${refDes.replace(/^R/i, '')} ${n1} ${n2} ${value}` };
    }

    case 'capacitor': {
      const value = props.value || props.capacitance || '100n';
      const n1 = node(connectors[0]?.id || 'pin1');
      const n2 = node(connectors[1]?.id || 'pin2');
      return { line: `C${refDes.replace(/^C/i, '')} ${n1} ${n2} ${value}` };
    }

    case 'inductor': {
      const value = props.value || props.inductance || '10u';
      const n1 = node(connectors[0]?.id || 'pin1');
      const n2 = node(connectors[1]?.id || 'pin2');
      return { line: `L${refDes.replace(/^L/i, '')} ${n1} ${n2} ${value}` };
    }

    case 'diode':
    case 'led': {
      const modelName = props.model || `D_${refDes}`;
      const anode = findConnector(connectors, 'anode', 'A', 'pin1') || connectors[0];
      const cathode = findConnector(connectors, 'cathode', 'K', 'C', 'pin2') || connectors[1];
      const n1 = node(anode.id);
      const n2 = node(cathode.id);
      return {
        line: `D${refDes.replace(/^D/i, '')} ${n1} ${n2} ${modelName}`,
        model: `.MODEL ${modelName} D(IS=${props.Is || '1e-14'} N=${props.N || '1'})`,
      };
    }

    case 'transistor':
    case 'bjt': {
      const type = (props.type || 'NPN').toUpperCase();
      const modelName = props.model || `Q_${refDes}`;
      const c = findConnector(connectors, 'collector', 'C', 'pin1') || connectors[0];
      const b = findConnector(connectors, 'base', 'B', 'pin2') || connectors[1];
      const e = findConnector(connectors, 'emitter', 'E', 'pin3') || connectors[2];
      return {
        line: `Q${refDes.replace(/^Q/i, '')} ${node(c.id)} ${node(b.id)} ${node(e.id)} ${modelName}`,
        model: `.MODEL ${modelName} ${type}(BF=${props.BF || '100'} IS=${props.Is || '1e-14'})`,
      };
    }

    case 'mosfet': {
      const type = (props.type || 'NMOS').toUpperCase();
      const modelName = props.model || `M_${refDes}`;
      const d = findConnector(connectors, 'drain', 'D', 'pin1') || connectors[0];
      const g = findConnector(connectors, 'gate', 'G', 'pin2') || connectors[1];
      const s = findConnector(connectors, 'source', 'S', 'pin3') || connectors[2];
      const bk = findConnector(connectors, 'bulk', 'B', 'body', 'pin4') || connectors[3];
      const ns = node(s.id);
      const nb = bk ? node(bk.id) : ns;
      return {
        line: `M${refDes.replace(/^[MQ]/i, '')} ${node(d.id)} ${node(g.id)} ${ns} ${nb} ${modelName} W=${props.W || '10U'} L=${props.L || '1U'}`,
        model: `.MODEL ${modelName} ${type}(KP=${props.KP || '2e-5'} VTO=${props.VTO || (type === 'PMOS' ? '-0.7' : '0.7')})`,
      };
    }

    // BL-0121: Mixed-signal XSPICE digital logic
    case 'and':
    case 'or':
    case 'nand':
    case 'nor':
    case 'xor':
    case 'xnor':
    case 'inv':
    case 'buffer':
    case 'dff': {
      const gateType = family === 'inv' ? 'not' : family;
      const modelName = `proto_${gateType}`;
      
      // Separate inputs and outputs based on typical gate connector names
      const inputs = connectors.filter(c => /in|a|b|c|d|clk|data/i.test(c.name));
      const outputs = connectors.filter(c => /out|q|y/i.test(c.name));
      
      const inNodes = inputs.map(c => node(c.id)).join(' ');
      const outNodes = outputs.map(c => node(c.id)).join(' ');
      
      return {
        line: `A${refDes.replace(/^[AU]/i, '')} [${inNodes}] [${outNodes}] ${modelName}`,
        model: `.MODEL ${modelName} d_${gateType}(rise_delay=1n fall_delay=1n input_load=0.5p)`,
      };
    }

    case 'voltage source':
    case 'battery': {
      const value = props.value || props.voltage || '5';
      const pos = findConnector(connectors, 'positive', 'pos', '+', 'V+', 'pin1', 'VCC') || connectors[0];
      const neg = findConnector(connectors, 'negative', 'neg', '-', 'V-', 'pin2', 'GND') || connectors[1];
      let spec = `DC ${value}`;
      if (props.acMagnitude) spec += ` AC ${props.acMagnitude} ${props.acPhase || '0'}`;
      if (props.frequency) spec += ` SIN(${props.offset || '0'} ${props.amplitude || value} ${props.frequency})`;
      return { line: `V${refDes.replace(/^V/i, '') || instance.id} ${node(pos.id)} ${node(neg.id)} ${spec}` };
    }

    case 'current source': {
      const value = props.value || props.current || '1m';
      const pos = findConnector(connectors, 'positive', 'pos', '+', 'pin1') || connectors[0];
      const neg = findConnector(connectors, 'negative', 'neg', '-', 'pin2') || connectors[1];
      return { line: `I${refDes.replace(/^I/i, '') || instance.id} ${node(pos.id)} ${node(neg.id)} DC ${value}` };
    }

    default: {
      // Generic subcircuit
      const nodes = connectors.map(c => node(c.id)).join(' ');
      const subcktName = props.spiceModel || family.replace(/\s+/g, '_').toUpperCase() || 'UNKNOWN';
      warnings.push(`${refDes}: modeled as subcircuit X instance — provide .SUBCKT ${subcktName} definition`);
      return { line: `X${refDes.replace(/^[UXJ]/i, '')} ${nodes} ${subcktName}` };
    }
  }
}

// ---------------------------------------------------------------------------
// Analysis card
// ---------------------------------------------------------------------------

function generateAnalysisCard(config: SpiceExportConfig): string[] {
  const lines: string[] = [];

  switch (config.analysis) {
    case 'op':
      lines.push('.OP');
      break;
    case 'tran': {
      const t = config.transient;
      if (!t) { lines.push('.TRAN 1U 1M'); break; }
      const step = formatSpiceValue(t.timeStep);
      const stop = formatSpiceValue(t.stopTime);
      lines.push(t.startTime > 0
        ? `.TRAN ${step} ${stop} ${formatSpiceValue(t.startTime)}`
        : `.TRAN ${step} ${stop}`);
      break;
    }
    case 'ac': {
      const a = config.ac;
      if (!a) { lines.push('.AC DEC 100 1 1MEG'); break; }
      lines.push(`.AC ${a.sweepType.toUpperCase()} ${a.numPoints} ${formatSpiceValue(a.startFreq)} ${formatSpiceValue(a.stopFreq)}`);
      break;
    }
    case 'dc': {
      const d = config.dcSweep;
      if (!d) { lines.push('.DC V1 0 5 0.1'); break; }
      lines.push(`.DC ${d.sourceName} ${formatSpiceValue(d.startValue)} ${formatSpiceValue(d.stopValue)} ${formatSpiceValue(d.stepValue)}`);
      break;
    }
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Main export function
// ---------------------------------------------------------------------------

/**
 * Generate a SPICE netlist file from circuit database data.
 */
export function exportSpiceNetlist(input: SpiceExportInput): SpiceExportOutput {
  const { circuitName, instances, nets, parts, config } = input;
  const warnings: string[] = [];
  const nodeMap = buildNodeMap(nets);
  const partMap = new Map<number, ComponentPart>();
  for (const p of parts) partMap.set(p.id, p);

  const lines: string[] = [];
  const models: string[] = [];
  const seenModels = new Set<string>();

  // Title
  lines.push(`* ${circuitName || 'ProtoPulse Circuit'}`);
  lines.push(`* Generated by ProtoPulse — ${new Date().toISOString()}`);
  lines.push('');

  // Temperature
  if (config.temperature !== undefined && config.temperature !== 27) {
    lines.push(`.TEMP ${config.temperature}`);
    lines.push('');
  }

  // Node map comment
  lines.push('* Node mapping:');
  const sortedNodes = Object.entries(nodeMap.map).sort(function sortByNodeNumber(a, b) { return a[1] - b[1]; });
  for (const [name, num] of sortedNodes) {
    lines.push(`*   ${num} = ${name}`);
  }
  lines.push('');

  // Components
  lines.push('* Components');
  for (const inst of instances) {
    if (inst.partId == null) {
      warnings.push(`${inst.referenceDesignator}: no part assigned, skipped`);
      lines.push(`* ${inst.referenceDesignator} — no part assigned, skipped`);
      continue;
    }
    const part = partMap.get(inst.partId);
    if (!part) {
      warnings.push(`${inst.referenceDesignator}: part #${inst.partId} not found, skipped`);
      lines.push(`* ${inst.referenceDesignator} — part not found, skipped`);
      continue;
    }

    const result = generateComponentLine(inst, part, nets, nodeMap, warnings);
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
    for (const m of models) lines.push(m);
  }

  // Analysis
  lines.push('');
  lines.push('* Analysis');
  for (const al of generateAnalysisCard(config)) lines.push(al);

  // Control
  lines.push('');
  lines.push('.CONTROL');
  lines.push('run');
  lines.push(config.analysis === 'op' ? 'print all' : 'plot all');
  lines.push('.ENDC');
  lines.push('');
  lines.push('.END');

  // Ground check
  if (!Object.values(nodeMap.map).includes(0) && instances.length > 0) {
    warnings.push('No ground net found — SPICE requires at least one node 0 (ground)');
  }

  const safeName = (circuitName || 'circuit').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();

  return {
    netlist: lines.join('\n'),
    filename: `${safeName}.cir`,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Legacy API — original export-generators.ts signature used by ai-tools.ts
// ---------------------------------------------------------------------------

/**
 * Guess a SPICE primitive prefix from a reference designator or component type.
 * R → resistor, C → capacitor, L → inductor, D → diode, Q → BJT, M → MOSFET,
 * V → voltage source, anything else → X (subcircuit).
 */
function spicePrefix(refDes: string): string {
  const first = refDes.charAt(0).toUpperCase();
  if ('RCLVDQM'.includes(first)) return first;
  return 'X';
}

export function generateSpiceNetlist(
  instances: CircuitInstanceData[],
  nets: CircuitNetData[],
  parts: ComponentPartData[],
  projectName: string,
): ExportResult {
  const partMap = new Map<number, ComponentPartData>();
  for (const part of parts) {
    partMap.set(part.id, part);
  }

  // Build instance → net connections from net segments
  const instanceNets = new Map<number, string[]>();
  for (const net of nets) {
    if (Array.isArray(net.segments)) {
      for (const seg of net.segments) {
        if (seg && typeof seg === 'object') {
          const s = seg as Record<string, unknown>;
          if (typeof s.instanceId === 'number') {
            const existing = instanceNets.get(s.instanceId) ?? [];
            existing.push(net.name);
            instanceNets.set(s.instanceId, existing);
          }
        }
      }
    }
  }

  const spiceLines: string[] = [
    `* SPICE Netlist - ${projectName}`,
    `* Generated by ProtoPulse`,
    `* Date: ${new Date().toISOString()}`,
    '',
  ];

  for (const inst of instances) {
    const part = inst.partId != null ? partMap.get(inst.partId) : undefined;
    const meta = part?.meta ?? {};
    const prefix = spicePrefix(inst.referenceDesignator);
    // BL-0567: Prefer instance properties (schematic component values) over part meta defaults
    const instProps = (inst.properties ?? {}) as Record<string, unknown>;
    const instValue = typeof instProps.value === 'string' ? instProps.value : '';
    const instResistance = typeof instProps.resistance === 'string' ? instProps.resistance : '';
    const instCapacitance = typeof instProps.capacitance === 'string' ? instProps.capacitance : '';
    const instInductance = typeof instProps.inductance === 'string' ? instProps.inductance : '';
    const instVoltage = typeof instProps.voltage === 'string' ? instProps.voltage : '';
    const instCurrent = typeof instProps.current === 'string' ? instProps.current : '';
    const value = instValue || instResistance || instCapacitance || instInductance
      || instVoltage || instCurrent || metaStr(meta, 'value', '1');
    const connectedNets = instanceNets.get(inst.id) ?? [];

    // Pad net list to at least 2 nodes (most components need at least 2 terminals)
    const netNames = connectedNets.length >= 2
      ? connectedNets
      : [...connectedNets, ...Array(2 - connectedNets.length).fill('0') as string[]];

    const netStr = netNames.join(' ');

    if (prefix === 'X') {
      // Subcircuit instance
      const modelName = metaStr(meta, 'title', 'SUBCKT').replace(/\s+/g, '_');
      spiceLines.push(`${inst.referenceDesignator} ${netStr} ${modelName}`);
    } else {
      spiceLines.push(`${inst.referenceDesignator} ${netStr} ${value}`);
    }
  }

  spiceLines.push('', '.end', '');

  return {
    content: spiceLines.join('\n'),
    encoding: 'utf8',
    mimeType: 'text/plain',
    filename: `${sanitizeFilename(projectName)}.cir`,
  };
}
