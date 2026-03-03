// =============================================================================
// Netlist Generator — Phase 12.2: FZPZ Integration
// Pure function library. No Express routes.
// =============================================================================

import {
  type CircuitInstanceData,
  type CircuitNetData,
  type ComponentPartData,
  type ExportResult,
  csvRow as sharedCsvRow,
} from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NetlistInput {
  circuit: { id: number; name: string };
  instances: Array<{
    id: number;
    partId: number | null;
    referenceDesignator: string;
  }>;
  nets: Array<{
    id: number;
    name: string;
    netType: string;
    voltage: string | null;
    busWidth: number | null;
    segments: Array<{
      fromInstanceId: number;
      fromPin: string;
      toInstanceId: number;
      toPin: string;
    }>;
  }>;
  parts: Map<number, {
    id: number;
    meta: Record<string, unknown>;
    connectors: Array<{ id: string; name: string }>;
  }>;
}

export type NetlistFormat = 'spice' | 'kicad' | 'csv';

// ---------------------------------------------------------------------------
// Internal: Pin-to-Net Mapping
// ---------------------------------------------------------------------------

/**
 * Composite key for a specific pin on a specific instance.
 * Format: `{instanceId}:{pinIdentifier}`
 */
type PinKey = string;

function makePinKey(instanceId: number, pin: string): PinKey {
  return `${instanceId}:${pin}`;
}

interface PinNetEntry {
  instanceId: number;
  pin: string;
  netName: string;
  netType: string;
}

/**
 * Builds a lookup from (instanceId, pin) -> net name.
 *
 * Pins can be referenced by connector `id` or connector `name`. This function
 * normalises both so that lookups work regardless of which identifier the net
 * segments use.
 */
function buildPinNetMap(input: NetlistInput): Map<PinKey, PinNetEntry> {
  const map = new Map<PinKey, PinNetEntry>();

  // Pre-build per-instance connector alias maps:
  // connectorName -> connectorId, connectorId -> connectorName
  // This lets us resolve a pin reference regardless of whether the segment
  // used the connector's id or its human-readable name.
  const instanceAliases = new Map<number, Map<string, string>>();

  input.instances.forEach(function buildInstanceAliases(inst) {
    const part = inst.partId != null ? input.parts.get(inst.partId) : undefined;
    if (!part) return;
    const aliases = new Map<string, string>();
    part.connectors.forEach(function mapConnectorAlias(conn) {
      // Map name -> id and id -> name (bidirectional)
      aliases.set(conn.name, conn.id);
      aliases.set(conn.id, conn.name);
    });
    instanceAliases.set(inst.id, aliases);
  });

  input.nets.forEach(function registerNetPins(net) {
    net.segments.forEach(function registerSegmentPins(seg) {
      registerPin(map, instanceAliases, seg.fromInstanceId, seg.fromPin, net.name, net.netType);
      registerPin(map, instanceAliases, seg.toInstanceId, seg.toPin, net.name, net.netType);
    });
  });

  return map;
}

function registerPin(
  map: Map<PinKey, PinNetEntry>,
  instanceAliases: Map<number, Map<string, string>>,
  instanceId: number,
  pin: string,
  netName: string,
  netType: string,
): void {
  const entry: PinNetEntry = { instanceId, pin, netName, netType };

  // Register under the given pin identifier
  const primaryKey = makePinKey(instanceId, pin);
  if (!map.has(primaryKey)) {
    map.set(primaryKey, entry);
  }

  // Also register under the alias (id ↔ name) so downstream lookups work
  // regardless of which identifier is used.
  const aliases = instanceAliases.get(instanceId);
  if (aliases) {
    const alias = aliases.get(pin);
    if (alias) {
      const aliasKey = makePinKey(instanceId, alias);
      if (!map.has(aliasKey)) {
        map.set(aliasKey, entry);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the SPICE node name for a given (instance, pin) pair.
 * Returns "0" for unconnected pins (SPICE ground convention).
 */
function resolveSpiceNode(
  pinNetMap: Map<PinKey, PinNetEntry>,
  instanceId: number,
  pin: string,
): string {
  const entry = pinNetMap.get(makePinKey(instanceId, pin));
  if (!entry) return '0';

  // Ground nets map to SPICE node "0"
  if (entry.netType === 'ground') return '0';

  return sanitiseSpiceNodeName(entry.netName);
}

/**
 * SPICE node names must be alphanumeric (plus underscores). Replace
 * problematic characters.
 */
function sanitiseSpiceNodeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

/**
 * Extract a "value" string from the part's meta.
 * Tries common field names used in EDA components.
 */
function extractPartValue(meta: Record<string, unknown>): string {
  // Direct value field
  if (typeof meta['value'] === 'string' && meta['value']) return meta['value'];

  // Properties array (PartMeta.properties)
  const props = meta['properties'];
  if (Array.isArray(props)) {
    for (let i = 0; i < props.length; i++) {
      const p = props[i];
      if (p && typeof p === 'object' && 'key' in p && 'value' in p) {
        const k = String((p as { key: string }).key).toLowerCase();
        if (k === 'value' || k === 'resistance' || k === 'capacitance' || k === 'inductance') {
          const v = String((p as { value: string }).value);
          if (v) return v;
        }
      }
    }
  }

  return '';
}

/**
 * Extract a footprint string from the part's meta (for KiCad export).
 */
function extractFootprint(meta: Record<string, unknown>): string {
  if (typeof meta['packageType'] === 'string' && meta['packageType']) return meta['packageType'];
  if (typeof meta['package'] === 'string' && meta['package']) return meta['package'];
  if (typeof meta['footprint'] === 'string' && meta['footprint']) return meta['footprint'];
  return '';
}

/**
 * Extract a part title / model name from meta.
 */
function extractTitle(meta: Record<string, unknown>): string {
  if (typeof meta['title'] === 'string' && meta['title']) return meta['title'];
  if (typeof meta['family'] === 'string' && meta['family']) return meta['family'];
  return 'Unknown';
}

/**
 * Determine the SPICE prefix letter from the reference designator.
 *
 * SPICE conventions:
 *   R = Resistor, C = Capacitor, L = Inductor, D = Diode,
 *   Q = Transistor/MOSFET, V = Voltage source, I = Current source,
 *   X = Subcircuit (IC, module, etc.)
 *
 * For components whose refdes doesn't map to a known passive type,
 * we use "X" (subcircuit) as the catch-all.
 */
function spicePrefixFromRefDes(refDes: string): string {
  const prefix = refDes.replace(/[0-9]+$/, '').toUpperCase();
  const knownPrefixes = ['R', 'C', 'L', 'D', 'Q', 'V', 'I', 'M', 'J', 'K', 'T', 'E', 'F', 'G', 'H'];
  if (knownPrefixes.includes(prefix)) {
    return prefix;
  }
  return 'X';
}

/**
 * True for component types where SPICE format is: RefDes node1 node2 value
 * (two-terminal passives).
 */
function isTwoTerminalPassive(spicePrefix: string): boolean {
  return spicePrefix === 'R' || spicePrefix === 'C' || spicePrefix === 'L';
}

/**
 * Escape a string for use inside S-expression quoted values.
 */
function escapeSexpr(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Escape a value for CSV output. Wraps in quotes if the value contains
 * commas, quotes, or newlines.
 */
function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ---------------------------------------------------------------------------
// SPICE Netlist Generator
// ---------------------------------------------------------------------------

export function generateSpiceNetlist(input: NetlistInput): string {
  const pinNetMap = buildPinNetMap(input);
  const lines: string[] = [];

  lines.push(`* SPICE Netlist — ${input.circuit.name}`);
  lines.push('* Generated by ProtoPulse');
  lines.push('');

  input.instances.forEach(function emitSpiceComponent(inst) {
    const part = inst.partId != null ? input.parts.get(inst.partId) : undefined;
    if (!part) {
      lines.push(`* WARNING: ${inst.referenceDesignator} — part ID ${inst.partId} not found`);
      return;
    }

    const spicePrefix = spicePrefixFromRefDes(inst.referenceDesignator);
    const value = extractPartValue(part.meta);
    const title = extractTitle(part.meta);

    // Collect the SPICE nodes for every connector in pin order
    const nodes: string[] = [];
    part.connectors.forEach(function resolveConnectorNode(conn) {
      nodes.push(resolveSpiceNode(pinNetMap, inst.id, conn.id));
    });

    if (isTwoTerminalPassive(spicePrefix)) {
      // Two-terminal passive: RefDes node1 node2 value
      const node1 = nodes.length > 0 ? nodes[0] : '0';
      const node2 = nodes.length > 1 ? nodes[1] : '0';
      const displayValue = value || '0';
      lines.push(`${inst.referenceDesignator} ${node1} ${node2} ${displayValue}`);
    } else {
      // Generic subcircuit / IC: X{RefDes} node1 node2 ... model
      const nodesStr = nodes.length > 0 ? nodes.join(' ') : '0';
      // Prefix with X if the refdes doesn't already start with X
      const refDes = spicePrefix === 'X' && !inst.referenceDesignator.toUpperCase().startsWith('X')
        ? `X${inst.referenceDesignator}`
        : inst.referenceDesignator;
      const model = sanitiseSpiceNodeName(value || title);
      lines.push(`${refDes} ${nodesStr} ${model}`);
    }
  });

  lines.push('');
  lines.push('.end');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// KiCad Netlist Generator (KiCad 7+ S-expression format)
// ---------------------------------------------------------------------------

export function generateKicadNetlist(input: NetlistInput): string {
  const pinNetMap = buildPinNetMap(input);
  const lines: string[] = [];
  const indent = function indentLevel(level: number) { return '  '.repeat(level); };

  lines.push('(export (version "E")');

  // -- design section --
  lines.push(`${indent(1)}(design`);
  lines.push(`${indent(2)}(source "${escapeSexpr(input.circuit.name)}")`);
  lines.push(`${indent(2)}(tool "ProtoPulse EDA")`);
  lines.push(`${indent(1)})`);

  // -- components section --
  lines.push(`${indent(1)}(components`);
  input.instances.forEach(function emitKicadComponent(inst) {
    const part = inst.partId != null ? input.parts.get(inst.partId) : undefined;
    const value = part ? extractPartValue(part.meta) : '';
    const footprint = part ? extractFootprint(part.meta) : '';
    const title = part ? extractTitle(part.meta) : 'Unknown';

    lines.push(`${indent(2)}(comp (ref "${escapeSexpr(inst.referenceDesignator)}")`);
    lines.push(`${indent(3)}(value "${escapeSexpr(value || title)}")`);
    if (footprint) {
      lines.push(`${indent(3)}(footprint "${escapeSexpr(footprint)}")`);
    }
    lines.push(`${indent(2)})`);
  });
  lines.push(`${indent(1)})`);

  // -- nets section --
  // Build a deduplicated list of nets and their connected pins.
  // Net code 0 is reserved for "unconnected" per KiCad convention.

  // Collect unique net names preserving order of first appearance
  const netNameOrder: string[] = [];
  const netNameSet = new Set<string>();
  input.nets.forEach(function collectUniqueNetNames(net) {
    if (!netNameSet.has(net.name)) {
      netNameSet.add(net.name);
      netNameOrder.push(net.name);
    }
  });

  // Build per-net list of (refdes, pin, pinfunction)
  interface KicadNetNode {
    ref: string;
    pinId: string;
    pinFunction: string;
  }
  const netNodes = new Map<string, KicadNetNode[]>();
  netNameOrder.forEach(function initNetNodeList(name) { netNodes.set(name, []); });

  input.instances.forEach(function collectPinNetNodes(inst) {
    const part = inst.partId != null ? input.parts.get(inst.partId) : undefined;
    if (!part) return;
    part.connectors.forEach(function mapConnectorToNet(conn) {
      const entry = pinNetMap.get(makePinKey(inst.id, conn.id));
      if (entry) {
        const list = netNodes.get(entry.netName);
        if (list) {
          list.push({
            ref: inst.referenceDesignator,
            pinId: conn.id,
            pinFunction: conn.name,
          });
        }
      }
    });
  });

  lines.push(`${indent(1)}(nets`);

  // Net code 0 — unconnected (KiCad standard)
  lines.push(`${indent(2)}(net (code "0") (name ""))`);

  // Numbered nets starting at 1
  netNameOrder.forEach(function emitKicadNet(netName, idx) {
    const code = idx + 1;
    const nodes = netNodes.get(netName) || [];
    if (nodes.length === 0) {
      lines.push(`${indent(2)}(net (code "${code}") (name "${escapeSexpr(netName)}"))`);
    } else {
      lines.push(`${indent(2)}(net (code "${code}") (name "${escapeSexpr(netName)}")`);
      nodes.forEach(function emitKicadNetNode(node) {
        lines.push(
          `${indent(3)}(node (ref "${escapeSexpr(node.ref)}") (pin "${escapeSexpr(node.pinId)}") (pinfunction "${escapeSexpr(node.pinFunction)}"))`,
        );
      });
      lines.push(`${indent(2)})`);
    }
  });

  lines.push(`${indent(1)})`);

  lines.push(')');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// CSV Netlist Generator
// ---------------------------------------------------------------------------

export function generateCsvNetlist(input: NetlistInput): string {
  const lines: string[] = [];

  // Header row
  lines.push('Net Name,Net Type,From RefDes,From Pin,To RefDes,To Pin');

  // Build instance ID -> refdes lookup
  const instanceRefDes = new Map<number, string>();
  input.instances.forEach(function indexInstanceRefDes(inst) {
    instanceRefDes.set(inst.id, inst.referenceDesignator);
  });

  // Build instance+pin -> resolved pin name (use connector name if available)
  const resolvePinDisplay = function resolvePinDisplay(instanceId: number, pinRef: string): string {
    const inst = input.instances.find(function matchInstanceById(i) { return i.id === instanceId; });
    if (!inst) return pinRef;
    const part = inst.partId != null ? input.parts.get(inst.partId) : undefined;
    if (!part) return pinRef;

    // Try to find connector by id first, then by name
    const byId = part.connectors.find(function matchConnectorById(c) { return c.id === pinRef; });
    if (byId) return byId.name;
    const byName = part.connectors.find(function matchConnectorByName(c) { return c.name === pinRef; });
    if (byName) return byName.name;
    return pinRef;
  };

  input.nets.forEach(function emitCsvNet(net) {
    net.segments.forEach(function emitCsvSegment(seg) {
      const fromRef = instanceRefDes.get(seg.fromInstanceId) || `?${seg.fromInstanceId}`;
      const toRef = instanceRefDes.get(seg.toInstanceId) || `?${seg.toInstanceId}`;
      const fromPin = resolvePinDisplay(seg.fromInstanceId, seg.fromPin);
      const toPin = resolvePinDisplay(seg.toInstanceId, seg.toPin);

      lines.push([
        escapeCsv(net.name),
        escapeCsv(net.netType),
        escapeCsv(fromRef),
        escapeCsv(fromPin),
        escapeCsv(toRef),
        escapeCsv(toPin),
      ].join(','));
    });
  });

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Unified Entry Point
// ---------------------------------------------------------------------------

export function generateNetlist(input: NetlistInput, format: NetlistFormat): string {
  switch (format) {
    case 'spice':
      return generateSpiceNetlist(input);
    case 'kicad':
      return generateKicadNetlist(input);
    case 'csv':
      return generateCsvNetlist(input);
    default: {
      // Exhaustive check — if a new format is added, TypeScript will flag this
      const _exhaustive: never = format;
      throw new Error(`Unsupported netlist format: ${_exhaustive}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Legacy API — original export-generators.ts signature used by ai-tools.ts
// ---------------------------------------------------------------------------

export function generateLegacyCsvNetlist(
  instances: CircuitInstanceData[],
  nets: CircuitNetData[],
  _parts: ComponentPartData[],
): ExportResult {
  const header = sharedCsvRow(['Net Name', 'Component', 'Pin', 'Net Type', 'Voltage']);

  const instMap = new Map<number, CircuitInstanceData>();
  for (const inst of instances) {
    instMap.set(inst.id, inst);
  }

  const rows: string[] = [];

  for (const net of nets) {
    if (Array.isArray(net.segments)) {
      for (const seg of net.segments) {
        if (seg && typeof seg === 'object') {
          const s = seg as Record<string, unknown>;
          const instId = typeof s.instanceId === 'number' ? s.instanceId : null;
          const pinId = typeof s.pinId === 'string' ? s.pinId : '';
          const inst = instId !== null ? instMap.get(instId) : undefined;
          const component = inst?.referenceDesignator ?? '';

          rows.push(
            sharedCsvRow([net.name, component, pinId, net.netType, net.voltage]),
          );
        }
      }
    }

    // If net has no segments, still output a row with the net info
    if (!Array.isArray(net.segments) || net.segments.length === 0) {
      rows.push(sharedCsvRow([net.name, '', '', net.netType, net.voltage]));
    }
  }

  return {
    content: [header, ...rows].join('\n'),
    encoding: 'utf8',
    mimeType: 'text/csv',
    filename: 'netlist.csv',
  };
}
