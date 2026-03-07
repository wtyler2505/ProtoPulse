/**
 * Code Generator — converts CircuitIR back to valid DSL code.
 *
 * Enables visual editor → code view regeneration.
 */

import type { CircuitIR, IRComponent, IRNet } from './circuit-ir';

// ---------------------------------------------------------------------------
// Known DSL component types → factory method names
// ---------------------------------------------------------------------------

const PASSIVE_TYPES = new Set(['resistor', 'capacitor', 'inductor']);
const ACTIVE_TYPES = new Set(['diode', 'led', 'transistor', 'ic']);
const CONNECTOR_TYPES = new Set(['connector']);

// Net type sort order: power first, ground second, signal last
const NET_TYPE_ORDER: Record<string, number> = { power: 0, ground: 1, signal: 2 };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Escape double quotes inside a string for embedding in JS source. */
function escapeStr(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Sanitize a name into a valid JS identifier.
 * - Net names become lowercase: "VCC" → "vcc", "GND" → "gnd"
 * - Non-alphanumeric chars are replaced with underscores
 * - Leading digits get a `_` prefix
 */
function netVarName(name: string): string {
  let v = name.toLowerCase().replace(/[^a-z0-9_$]/g, '_');
  if (/^[0-9]/.test(v)) {
    v = `_${v}`;
  }
  return v;
}

/** Extract component type and value/part from a partId like "resistor:10k". */
function parsePartId(partId: string): { type: string; value: string } {
  const colonIdx = partId.indexOf(':');
  if (colonIdx === -1) {
    return { type: partId, value: '' };
  }
  return { type: partId.slice(0, colonIdx), value: partId.slice(colonIdx + 1) };
}

/** Check if a pin name is purely numeric (e.g., "1", "2"). */
function isNumericPin(name: string): boolean {
  return /^\d+$/.test(name);
}

/** Format a pin access expression. Numeric pins use .pin(N), named pins use .pin("name"). */
function pinExpr(compVar: string, pinName: string): string {
  if (isNumericPin(pinName)) {
    return `${compVar}.pin(${pinName})`;
  }
  return `${compVar}.pin("${escapeStr(pinName)}")`;
}

/**
 * Build the options object string for a component factory call.
 *
 * Passive types (resistor, capacitor, inductor) use `{ value: "..." }`.
 * Active types (diode, led, transistor, ic) use `{ part: "..." }`.
 * Connector types use `{ part: "...", pins: [...] }`.
 * Unknown (generic) types use `{ part: "...", refdesPrefix: "...", pins: [...] }`.
 */
function componentOpts(
  comp: IRComponent,
  compType: string,
  compValue: string,
): string {
  const opts: string[] = [];

  if (PASSIVE_TYPES.has(compType)) {
    opts.push(`value: "${escapeStr(comp.value ?? compValue)}"`);
  } else if (ACTIVE_TYPES.has(compType) || CONNECTOR_TYPES.has(compType)) {
    opts.push(`part: "${escapeStr(compValue)}"`);
  } else {
    // generic
    opts.push(`part: "${escapeStr(compValue)}"`);
    // Extract refdes prefix (letters before digits)
    const prefixMatch = comp.refdes.match(/^([A-Za-z]+)/);
    const prefix = prefixMatch ? prefixMatch[1] : 'X';
    opts.push(`refdesPrefix: "${prefix}"`);
    opts.push(`pins: [${Object.keys(comp.pins).map((p) => `"${escapeStr(p)}"`).join(', ')}]`);
  }

  if (CONNECTOR_TYPES.has(compType)) {
    opts.push(`pins: [${Object.keys(comp.pins).map((p) => `"${escapeStr(p)}"`).join(', ')}]`);
  }

  if (comp.footprint) {
    opts.push(`footprint: "${escapeStr(comp.footprint)}"`);
  }

  return `{ ${opts.join(', ')} }`;
}

/** Get the DSL factory method name for a component type. */
function factoryMethod(compType: string): string {
  if (PASSIVE_TYPES.has(compType) || ACTIVE_TYPES.has(compType) || CONNECTOR_TYPES.has(compType)) {
    return compType;
  }
  return 'generic';
}

/** Extract the type prefix from a refdes for grouping (e.g., "R" from "R1", "LED" from "LED1"). */
function refdesPrefix(refdes: string): string {
  const match = refdes.match(/^([A-Za-z]+)/);
  return match ? match[1] : refdes;
}

// ---------------------------------------------------------------------------
// Main code generator
// ---------------------------------------------------------------------------

/**
 * Convert a CircuitIR to executable DSL source code.
 *
 * The generated code uses the circuit-api fluent builder:
 *   circuit() → net() → component factories → connect() → export()
 */
export function irToCode(ir: CircuitIR): string {
  const lines: string[] = [];

  // Header
  lines.push('// Auto-generated from visual editor');
  lines.push(`const c = circuit("${escapeStr(ir.meta.name)}");`);

  // --- Nets ---
  // Sort: power first, then ground, then signal
  const sortedNets = [...ir.nets].sort(
    (a, b) => (NET_TYPE_ORDER[a.type] ?? 2) - (NET_TYPE_ORDER[b.type] ?? 2),
  );

  // Build net name → variable name map
  const netVarMap = new Map<string, string>();
  const usedVars = new Set<string>();

  for (const net of sortedNets) {
    let varName = netVarName(net.name);
    // Deduplicate variable names
    if (usedVars.has(varName)) {
      let suffix = 2;
      while (usedVars.has(`${varName}${suffix}`)) {
        suffix++;
      }
      varName = `${varName}${suffix}`;
    }
    usedVars.add(varName);
    netVarMap.set(net.name, varName);
  }

  if (sortedNets.length > 0) {
    lines.push('');
    lines.push('// Nets');
    for (const net of sortedNets) {
      const varName = netVarMap.get(net.name)!;
      lines.push(formatNetDecl(varName, net));
    }
  }

  // --- Components ---
  // Group by type prefix, stable order within groups
  const grouped = groupComponentsByPrefix(ir.components);

  if (ir.components.length > 0) {
    lines.push('');
    lines.push('// Components');
    for (const group of grouped) {
      for (const comp of group) {
        const { type: compType, value: compValue } = parsePartId(comp.partId);
        const method = factoryMethod(compType);
        const opts = componentOpts(comp, compType, compValue);
        lines.push(`const ${comp.refdes} = c.${method}(${opts});`);
      }
    }
  }

  // --- Connections ---
  const connections = buildConnections(ir.components, netVarMap);
  if (connections.length > 0) {
    lines.push('');
    lines.push('// Connections');
    for (const conn of connections) {
      lines.push(conn);
    }
  }

  // Export
  lines.push('');
  lines.push('c.export();');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Internal formatting helpers
// ---------------------------------------------------------------------------

function formatNetDecl(varName: string, net: IRNet): string {
  if (net.type === 'ground') {
    return `const ${varName} = c.net("${escapeStr(net.name)}", { ground: true });`;
  }
  if (net.type === 'power') {
    return `const ${varName} = c.net("${escapeStr(net.name)}", { voltage: 0 });`;
  }
  // signal — no options
  return `const ${varName} = c.net("${escapeStr(net.name)}");`;
}

function groupComponentsByPrefix(components: readonly IRComponent[]): IRComponent[][] {
  const groups = new Map<string, IRComponent[]>();
  const order: string[] = [];

  for (const comp of components) {
    const prefix = refdesPrefix(comp.refdes);
    if (!groups.has(prefix)) {
      groups.set(prefix, []);
      order.push(prefix);
    }
    groups.get(prefix)!.push(comp);
  }

  return order.map((prefix) => groups.get(prefix)!);
}

function buildConnections(
  components: readonly IRComponent[],
  netVarMap: Map<string, string>,
): string[] {
  const lines: string[] = [];

  for (const comp of components) {
    for (const [pinName, netName] of Object.entries(comp.pins)) {
      if (!netName) {
        continue;
      }
      const netVar = netVarMap.get(netName);
      if (!netVar) {
        continue;
      }
      lines.push(`c.connect(${pinExpr(comp.refdes, pinName)}, ${netVar});`);
    }
  }

  return lines;
}
