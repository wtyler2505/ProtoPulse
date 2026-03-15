/**
 * SPICE Subcircuit Attachment Module
 *
 * Provides parsing, validation, port-mapping, and template generation for
 * .SUBCKT blocks that can be attached to custom component definitions in the
 * Component Editor. This enables users to associate SPICE simulation models
 * with their component parts so that downstream simulation tools (the SPICE
 * netlist generator, transient analysis, etc.) can instantiate the component
 * as a proper subcircuit rather than a black-box placeholder.
 */

import type { Connector } from '@shared/component-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single parsed port from a .SUBCKT header line. */
export interface SubcircuitPort {
  /** The port name as it appears in the .SUBCKT header (case-preserved). */
  name: string;
  /** Zero-based index in the port list. */
  index: number;
}

/** Result of parsing a .SUBCKT text block. */
export interface ParsedSubcircuit {
  /** Subcircuit name from the .SUBCKT header. */
  name: string;
  /** Ordered list of external ports. */
  ports: SubcircuitPort[];
  /** Internal element lines (everything between .SUBCKT and .ENDS). */
  bodyLines: string[];
  /** Optional parameter declarations from the header (PARAMS: key=val). */
  params: Record<string, string>;
}

/** A mapping between a component connector (pin) and a subcircuit port. */
export interface PortMapping {
  /** The connector ID from the component part. */
  connectorId: string;
  /** The connector name (for display). */
  connectorName: string;
  /** The subcircuit port name this connector maps to. */
  portName: string;
  /** The port index in the subcircuit. */
  portIndex: number;
}

/** Validation diagnostic for a subcircuit definition. */
export interface SubcircuitDiagnostic {
  /** Severity of the diagnostic. */
  severity: 'error' | 'warning' | 'info';
  /** Human-readable message. */
  message: string;
  /** 1-based line number in the source text where the issue was found (0 = general). */
  line: number;
}

/** Complete validation result. */
export interface SubcircuitValidationResult {
  /** Whether the subcircuit text is valid (no errors). */
  valid: boolean;
  /** Parsed subcircuit (null if parsing failed). */
  parsed: ParsedSubcircuit | null;
  /** All diagnostics produced during validation. */
  diagnostics: SubcircuitDiagnostic[];
}

/** Result of auto-mapping ports to connectors. */
export interface AutoMapResult {
  /** Successfully mapped pairs. */
  mappings: PortMapping[];
  /** Port names that could not be matched to any connector. */
  unmappedPorts: string[];
  /** Connector names that could not be matched to any port. */
  unmappedConnectors: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum allowed length for a subcircuit text block (bytes). */
export const MAX_SUBCIRCUIT_LENGTH = 64_000;

/** Maximum allowed number of ports on a subcircuit. */
export const MAX_PORTS = 256;

/** Maximum allowed body lines in a subcircuit. */
export const MAX_BODY_LINES = 2000;

/** Common SPICE element prefixes and their human-readable names. */
const ELEMENT_PREFIXES: Record<string, string> = {
  R: 'Resistor',
  C: 'Capacitor',
  L: 'Inductor',
  D: 'Diode',
  Q: 'BJT',
  M: 'MOSFET',
  J: 'JFET',
  V: 'Voltage source',
  I: 'Current source',
  E: 'VCVS',
  F: 'CCCS',
  G: 'VCCS',
  H: 'CCVS',
  X: 'Subcircuit instance',
  K: 'Mutual inductance',
  T: 'Transmission line',
  S: 'Voltage switch',
  W: 'Current switch',
};

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Normalize raw SPICE text:
 * - Strip carriage returns
 * - Join continuation lines (lines starting with '+')
 * - Remove empty and comment-only lines (preserving structure)
 */
function preprocessLines(text: string): { content: string; originalLine: number }[] {
  const rawLines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const result: { content: string; originalLine: number }[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // Continuation line — append to previous
    if (trimmed.startsWith('+') && result.length > 0) {
      result[result.length - 1].content += ' ' + trimmed.slice(1).trim();
      continue;
    }

    // Skip blank lines and comments
    if (trimmed === '' || trimmed.startsWith('*') || trimmed.startsWith(';')) {
      continue;
    }

    result.push({ content: trimmed, originalLine: i + 1 }); // 1-based
  }

  return result;
}

/**
 * Parse a SPICE text block and extract the first .SUBCKT definition.
 *
 * Returns `null` if no valid .SUBCKT / .ENDS pair is found.
 * Does NOT validate internal element correctness — use `validateSubcircuit`
 * for full diagnostics.
 */
export function parseSubcircuit(text: string): ParsedSubcircuit | null {
  if (!text || text.trim().length === 0) {
    return null;
  }

  const lines = preprocessLines(text);
  let subcktLine: { content: string; originalLine: number } | null = null;
  let endsFound = false;
  const bodyLines: string[] = [];
  let inSubckt = false;

  for (const line of lines) {
    const upper = line.content.toUpperCase();

    if (!inSubckt) {
      if (upper.startsWith('.SUBCKT')) {
        subcktLine = line;
        inSubckt = true;
      }
      continue;
    }

    // Inside subcircuit
    if (upper.startsWith('.ENDS')) {
      endsFound = true;
      break;
    }

    bodyLines.push(line.content);
  }

  if (!subcktLine || !endsFound) {
    return null;
  }

  // Parse the .SUBCKT header: .SUBCKT name port1 port2 ... [PARAMS: k=v ...]
  const tokens = subcktLine.content.split(/\s+/);
  // tokens[0] is '.SUBCKT' (case variations)
  if (tokens.length < 2) {
    return null;
  }

  const name = tokens[1];
  const params: Record<string, string> = {};
  const portNames: string[] = [];

  let parsingParams = false;
  for (let i = 2; i < tokens.length; i++) {
    const token = tokens[i];
    const tokenUpper = token.toUpperCase();

    if (tokenUpper === 'PARAMS:' || tokenUpper === 'PARAMS') {
      parsingParams = true;
      continue;
    }

    if (parsingParams) {
      // key=value
      const eqIndex = token.indexOf('=');
      if (eqIndex > 0) {
        params[token.substring(0, eqIndex)] = token.substring(eqIndex + 1);
      }
    } else {
      portNames.push(token);
    }
  }

  const ports: SubcircuitPort[] = portNames.map((pName, idx) => ({
    name: pName,
    index: idx,
  }));

  return { name, ports, bodyLines, params };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate a SPICE subcircuit text block.
 *
 * Checks:
 * - Length / size limits
 * - Presence of .SUBCKT / .ENDS pair
 * - At least one port declared
 * - Body lines start with valid SPICE element prefixes or directives
 * - No nested .SUBCKT definitions (not supported in this context)
 * - Warns on empty body
 */
export function validateSubcircuit(text: string): SubcircuitValidationResult {
  const diagnostics: SubcircuitDiagnostic[] = [];

  // --- Size checks ---
  if (!text || text.trim().length === 0) {
    diagnostics.push({ severity: 'error', message: 'Subcircuit text is empty', line: 0 });
    return { valid: false, parsed: null, diagnostics };
  }

  if (text.length > MAX_SUBCIRCUIT_LENGTH) {
    diagnostics.push({
      severity: 'error',
      message: `Subcircuit text exceeds maximum length (${text.length} > ${MAX_SUBCIRCUIT_LENGTH} bytes)`,
      line: 0,
    });
    return { valid: false, parsed: null, diagnostics };
  }

  // --- Structural parse ---
  const lines = preprocessLines(text);

  // Find .SUBCKT
  let subcktLineIdx = -1;
  let endsLineIdx = -1;
  let nestedCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const upper = lines[i].content.toUpperCase();
    if (upper.startsWith('.SUBCKT')) {
      if (subcktLineIdx === -1) {
        subcktLineIdx = i;
      } else {
        nestedCount++;
      }
    }
    if (upper.startsWith('.ENDS')) {
      if (endsLineIdx === -1) {
        endsLineIdx = i;
      }
    }
  }

  if (subcktLineIdx === -1) {
    diagnostics.push({ severity: 'error', message: 'No .SUBCKT directive found', line: 0 });
    return { valid: false, parsed: null, diagnostics };
  }

  if (endsLineIdx === -1) {
    diagnostics.push({
      severity: 'error',
      message: 'Missing .ENDS directive — subcircuit is not terminated',
      line: lines[subcktLineIdx].originalLine,
    });
    return { valid: false, parsed: null, diagnostics };
  }

  if (endsLineIdx <= subcktLineIdx) {
    diagnostics.push({
      severity: 'error',
      message: '.ENDS appears before .SUBCKT',
      line: lines[endsLineIdx].originalLine,
    });
    return { valid: false, parsed: null, diagnostics };
  }

  if (nestedCount > 0) {
    diagnostics.push({
      severity: 'warning',
      message: `${nestedCount} nested .SUBCKT definition(s) detected — only the outermost is used`,
      line: 0,
    });
  }

  // --- Parse the subcircuit ---
  const parsed = parseSubcircuit(text);
  if (!parsed) {
    diagnostics.push({ severity: 'error', message: 'Failed to parse .SUBCKT header', line: lines[subcktLineIdx].originalLine });
    return { valid: false, parsed: null, diagnostics };
  }

  // --- Port checks ---
  if (parsed.ports.length === 0) {
    diagnostics.push({
      severity: 'error',
      message: '.SUBCKT must declare at least one port',
      line: lines[subcktLineIdx].originalLine,
    });
  }

  if (parsed.ports.length > MAX_PORTS) {
    diagnostics.push({
      severity: 'error',
      message: `Too many ports (${parsed.ports.length} > ${MAX_PORTS})`,
      line: lines[subcktLineIdx].originalLine,
    });
  }

  // Check for duplicate port names
  const portNameSet = new Set<string>();
  for (const port of parsed.ports) {
    const lower = port.name.toLowerCase();
    if (portNameSet.has(lower)) {
      diagnostics.push({
        severity: 'error',
        message: `Duplicate port name: "${port.name}"`,
        line: lines[subcktLineIdx].originalLine,
      });
    }
    portNameSet.add(lower);
  }

  // --- Body checks ---
  if (parsed.bodyLines.length === 0) {
    diagnostics.push({
      severity: 'warning',
      message: 'Subcircuit body is empty — no internal elements defined',
      line: lines[subcktLineIdx].originalLine,
    });
  }

  if (parsed.bodyLines.length > MAX_BODY_LINES) {
    diagnostics.push({
      severity: 'error',
      message: `Too many body lines (${parsed.bodyLines.length} > ${MAX_BODY_LINES})`,
      line: 0,
    });
  }

  // Validate each body line starts with a known element prefix or directive
  const validDirectives = new Set(['.MODEL', '.PARAM', '.FUNC', '.GLOBAL', '.TEMP', '.IC', '.NODESET', '.OPTIONS', '.LIB', '.INCLUDE', '.SUBCKT', '.ENDS']);

  for (let i = 0; i < parsed.bodyLines.length; i++) {
    const bodyLine = parsed.bodyLines[i].trim();
    if (bodyLine === '') {
      continue;
    }

    const firstChar = bodyLine[0].toUpperCase();
    if (bodyLine.startsWith('.')) {
      const directive = bodyLine.split(/\s+/)[0].toUpperCase();
      if (!validDirectives.has(directive)) {
        diagnostics.push({
          severity: 'warning',
          message: `Unknown directive "${directive}" on body line ${i + 1}`,
          line: 0,
        });
      }
    } else if (!ELEMENT_PREFIXES[firstChar]) {
      diagnostics.push({
        severity: 'warning',
        message: `Unrecognized element prefix "${firstChar}" on body line ${i + 1}: "${bodyLine.substring(0, 40)}"`,
        line: 0,
      });
    }
  }

  const hasErrors = diagnostics.some((d) => d.severity === 'error');
  return { valid: !hasErrors, parsed: hasErrors ? null : parsed, diagnostics };
}

// ---------------------------------------------------------------------------
// Port Mapping
// ---------------------------------------------------------------------------

/**
 * Normalize a name for fuzzy matching: lowercase, strip non-alphanumeric.
 */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Common SPICE port aliases — maps normalized forms to each other.
 */
const PORT_ALIASES: Record<string, string[]> = {
  vcc: ['vdd', 'vplus', 'vp', 'v+', 'positive', 'pos', 'pwr'],
  vdd: ['vcc', 'vplus', 'vp', 'v+', 'positive', 'pos', 'pwr'],
  gnd: ['vss', 'vee', 'vminus', 'vm', 'v-', 'ground', 'neg', 'negative', '0'],
  vss: ['gnd', 'vee', 'vminus', 'vm', 'v-', 'ground', 'neg', 'negative', '0'],
  vee: ['gnd', 'vss', 'vminus', 'vm', 'v-', 'ground', 'neg', 'negative', '0'],
  inp: ['in+', 'inplus', 'input+', 'inputp', 'noninverting', 'plus', 'inp'],
  inn: ['in-', 'inminus', 'input-', 'inputn', 'inverting', 'minus', 'inm'],
  out: ['output', 'vout', 'outp'],
  in: ['input', 'vin', 'inp'],
};

/**
 * Auto-map subcircuit ports to component connectors using name matching.
 *
 * Matching strategy (in priority order):
 * 1. Exact match (case-insensitive)
 * 2. Numeric pin-number match (port "1" → connector named "1")
 * 3. Alias match (e.g., "VCC" ↔ "VDD")
 * 4. Substring match (port "IN" matches connector "IN+" or "INPUT")
 */
export function autoMapPorts(
  ports: SubcircuitPort[],
  connectors: Connector[],
): AutoMapResult {
  const mappings: PortMapping[] = [];
  const usedConnectorIds = new Set<string>();
  const usedPortIndices = new Set<number>();

  // Build connector lookup
  const connectorsByNorm = new Map<string, Connector>();
  for (const conn of connectors) {
    connectorsByNorm.set(normalizeName(conn.name), conn);
  }

  // Pass 1: Exact match
  for (const port of ports) {
    if (usedPortIndices.has(port.index)) {
      continue;
    }
    const normPort = normalizeName(port.name);
    const match = connectorsByNorm.get(normPort);
    if (match && !usedConnectorIds.has(match.id)) {
      mappings.push({
        connectorId: match.id,
        connectorName: match.name,
        portName: port.name,
        portIndex: port.index,
      });
      usedConnectorIds.add(match.id);
      usedPortIndices.add(port.index);
    }
  }

  // Pass 2: Numeric match (port "1" → connector "1" or "P1" or "PIN1")
  for (const port of ports) {
    if (usedPortIndices.has(port.index)) {
      continue;
    }
    const numMatch = /^\d+$/.exec(port.name);
    if (numMatch) {
      for (const conn of connectors) {
        if (usedConnectorIds.has(conn.id)) {
          continue;
        }
        const connNorm = normalizeName(conn.name);
        if (connNorm === port.name || connNorm === `p${port.name}` || connNorm === `pin${port.name}`) {
          mappings.push({
            connectorId: conn.id,
            connectorName: conn.name,
            portName: port.name,
            portIndex: port.index,
          });
          usedConnectorIds.add(conn.id);
          usedPortIndices.add(port.index);
          break;
        }
      }
    }
  }

  // Pass 3: Alias match
  for (const port of ports) {
    if (usedPortIndices.has(port.index)) {
      continue;
    }
    const normPort = normalizeName(port.name);
    const aliases = PORT_ALIASES[normPort];
    if (aliases) {
      for (const alias of aliases) {
        const normAlias = normalizeName(alias);
        const match = connectorsByNorm.get(normAlias);
        if (match && !usedConnectorIds.has(match.id)) {
          mappings.push({
            connectorId: match.id,
            connectorName: match.name,
            portName: port.name,
            portIndex: port.index,
          });
          usedConnectorIds.add(match.id);
          usedPortIndices.add(port.index);
          break;
        }
      }
    }
  }

  // Pass 4: Substring match (port name is substring of connector name, or vice versa)
  for (const port of ports) {
    if (usedPortIndices.has(port.index)) {
      continue;
    }
    const normPort = normalizeName(port.name);
    if (normPort.length < 2) {
      continue; // Skip very short names to avoid false matches
    }
    for (const conn of connectors) {
      if (usedConnectorIds.has(conn.id)) {
        continue;
      }
      const normConn = normalizeName(conn.name);
      if (normConn.includes(normPort) || normPort.includes(normConn)) {
        mappings.push({
          connectorId: conn.id,
          connectorName: conn.name,
          portName: port.name,
          portIndex: port.index,
        });
        usedConnectorIds.add(conn.id);
        usedPortIndices.add(port.index);
        break;
      }
    }
  }

  // Compute unmapped
  const unmappedPorts = ports
    .filter((p) => !usedPortIndices.has(p.index))
    .map((p) => p.name);

  const unmappedConnectors = connectors
    .filter((c) => !usedConnectorIds.has(c.id))
    .map((c) => c.name);

  return { mappings, unmappedPorts, unmappedConnectors };
}

// ---------------------------------------------------------------------------
// Template Generation
// ---------------------------------------------------------------------------

/**
 * Generate a SPICE subcircuit template from component connectors.
 *
 * Creates a skeleton .SUBCKT block with ports derived from the component's
 * pin names, ready for the user to fill in internal netlist elements.
 */
export function generateSubcircuitTemplate(
  componentName: string,
  connectors: Connector[],
): string {
  const safeName = (componentName || 'UNNAMED')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .toUpperCase();

  if (connectors.length === 0) {
    return `* SPICE Subcircuit Template for ${safeName}\n* Add pins to the component first, then regenerate this template.\n`;
  }

  const portNames = connectors.map((c) => c.name.replace(/\s+/g, '_'));
  const lines: string[] = [];

  lines.push(`* SPICE Subcircuit for ${safeName}`);
  lines.push(`* Generated by ProtoPulse Component Editor`);
  lines.push(`* Ports: ${portNames.join(', ')}`);
  lines.push('*');
  lines.push(`.SUBCKT ${safeName} ${portNames.join(' ')}`);
  lines.push('*');
  lines.push('* --- Internal netlist elements go here ---');
  lines.push('* Example:');
  lines.push(`* R1 ${portNames[0] || 'A'} ${portNames.length > 1 ? portNames[1] : 'B'} 1k`);
  lines.push('*');
  lines.push(`.ENDS ${safeName}`);

  return lines.join('\n');
}

/**
 * Generate a SPICE instance line (X-element) for using this subcircuit.
 *
 * @param instanceName - Instance designator (e.g. "X1")
 * @param subcircuitName - Name from the .SUBCKT header
 * @param portMappings - Ordered port mappings (must cover all ports)
 * @param netNames - Map from connector ID to net name in the parent circuit
 */
export function generateInstanceLine(
  instanceName: string,
  subcircuitName: string,
  portMappings: PortMapping[],
  netNames: Record<string, string>,
): string {
  // Sort mappings by port index to ensure correct port order
  const sorted = [...portMappings].sort((a, b) => a.portIndex - b.portIndex);
  const nodes = sorted.map((m) => netNames[m.connectorId] || `N_${m.connectorName}`);

  return `${instanceName} ${nodes.join(' ')} ${subcircuitName}`;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Extract a summary of the elements used inside a subcircuit body.
 *
 * Returns a map from element type (human-readable) to count.
 */
export function summarizeBody(parsed: ParsedSubcircuit): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const line of parsed.bodyLines) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('*') || trimmed.startsWith(';') || trimmed.startsWith('.')) {
      continue;
    }
    const prefix = trimmed[0].toUpperCase();
    const label = ELEMENT_PREFIXES[prefix] || `Unknown (${prefix})`;
    counts[label] = (counts[label] || 0) + 1;
  }

  return counts;
}

/**
 * Count the number of internal nodes in a subcircuit (nodes that are not ports).
 */
export function countInternalNodes(parsed: ParsedSubcircuit): number {
  const portSet = new Set(parsed.ports.map((p) => p.name.toLowerCase()));
  const allNodes = new Set<string>();

  for (const line of parsed.bodyLines) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('*') || trimmed.startsWith(';') || trimmed.startsWith('.')) {
      continue;
    }
    const tokens = trimmed.split(/\s+/);
    // Element nodes are tokens after the element name, before value/model
    // For simple elements: name node1 node2 value
    // For transistors: name node1 node2 node3 [node4] model
    const prefix = tokens[0][0].toUpperCase();
    let nodeCount: number;
    switch (prefix) {
      case 'R':
      case 'C':
      case 'L':
      case 'V':
      case 'I':
      case 'D':
      case 'S':
      case 'W':
        nodeCount = 2;
        break;
      case 'Q':
      case 'J':
        nodeCount = 3;
        break;
      case 'M':
      case 'E':
      case 'F':
      case 'G':
      case 'H':
      case 'T':
        nodeCount = 4;
        break;
      case 'X':
        // Subcircuit instance: all tokens except first and last are nodes
        for (let j = 1; j < tokens.length - 1; j++) {
          allNodes.add(tokens[j].toLowerCase());
        }
        continue;
      default:
        continue;
    }

    for (let j = 1; j <= Math.min(nodeCount, tokens.length - 2); j++) {
      allNodes.add(tokens[j].toLowerCase());
    }
  }

  // Internal nodes are those not in the port list
  let internalCount = 0;
  for (const node of allNodes) {
    if (!portSet.has(node)) {
      internalCount++;
    }
  }

  return internalCount;
}
