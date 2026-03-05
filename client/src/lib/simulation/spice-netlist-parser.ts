/**
 * SPICE Netlist Parser (IN-04)
 *
 * Parses standard SPICE netlists and executes them using ProtoPulse's
 * in-browser simulation engines (MNA solver, DC, AC, Transient).
 *
 * Supports:
 *   - Element lines: R, C, L, V, I, D, Q (BJT), M (MOSFET)
 *   - Analysis directives: .OP, .DC, .AC, .TRAN
 *   - .MODEL definitions (D, NPN, PNP, NMOS, PMOS)
 *   - .SUBCKT definitions (basic — stored but not expanded)
 *   - Comment lines (* or ;)
 *   - Continuation lines (+)
 *   - Case-insensitive parsing
 *   - SPICE value suffixes (k, M, meg, u, n, p, etc.)
 *
 * References:
 *   - Nagel & Pederson, "SPICE (Simulation Program with IC Emphasis)"
 *   - Vladimirescu, "The SPICE Book"
 */

import { solveDCOperatingPoint as solveDCOPBasic } from './circuit-solver';
import type { SolverInput, SolverComponent, DCResult, TransientResult, DCSweepResult } from './circuit-solver';
import { solveTransient, solveDCSweep, buildSolverInput } from './circuit-solver';
import { runACAnalysis } from './ac-analysis';
import type { ACAnalysisResult, ACAnalysisConfig } from './ac-analysis';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A parsed SPICE model definition. */
export interface SpiceModel {
  /** Model name (e.g., "D1N4148"). */
  name: string;
  /** Model type (e.g., "D", "NPN", "PNP", "NMOS", "PMOS"). */
  type: string;
  /** Model parameters as key-value pairs. */
  params: Record<string, number>;
}

/** A parsed SPICE subcircuit definition. */
export interface SpiceSubckt {
  /** Subcircuit name. */
  name: string;
  /** Port node names. */
  ports: string[];
  /** Element lines within the subcircuit. */
  body: string[];
}

/** A parsed SPICE element (component instance). */
export interface SpiceElement {
  /** Element type prefix: R, C, L, V, I, D, Q, M, X. */
  type: string;
  /** Full element name (e.g., "R1", "V_supply"). */
  name: string;
  /** Node connections (2 for passives/sources, 3 for BJTs, 4 for MOSFETs). */
  nodes: string[];
  /** Primary value (resistance, capacitance, voltage, etc.). Can be a number or a string spec like "PULSE(...)". */
  value: number | string;
  /** Model name reference (for D, Q, M elements). */
  model?: string;
  /** Instance parameters (e.g., W=10U L=1U for MOSFETs). */
  params?: Record<string, number>;
}

/** A parsed analysis directive. */
export interface SpiceAnalysis {
  /** Analysis type. */
  type: 'dc' | 'ac' | 'tran' | 'op';
  /** Analysis parameters. */
  params: Record<string, number | string>;
}

/** Parse error with line information. */
export interface ParseError {
  /** 1-based line number in the original text. */
  line: number;
  /** Human-readable error message. */
  message: string;
}

/** Complete result of parsing a SPICE netlist. */
export interface ParsedNetlist {
  /** Title line (first non-blank line of the netlist). */
  title: string;
  /** Parsed element instances. */
  elements: SpiceElement[];
  /** Parsed analysis directives. */
  analyses: SpiceAnalysis[];
  /** Parsed .MODEL definitions keyed by model name. */
  models: Record<string, SpiceModel>;
  /** Parsed .SUBCKT definitions keyed by subcircuit name. */
  subckts: Record<string, SpiceSubckt>;
  /** All raw lines from the input (for display/debug). */
  rawLines: string[];
  /** Parse errors encountered. */
  errors: ParseError[];
}

/** Unified simulation result from running a parsed netlist. */
export interface SimulationResult {
  /** Analysis type that was executed. */
  analysisType: 'op' | 'dc' | 'ac' | 'tran';
  /** DC operating point result (for .OP). */
  dcResult?: DCResult;
  /** DC sweep result (for .DC). */
  dcSweepResult?: DCSweepResult;
  /** AC analysis result (for .AC). */
  acResult?: ACAnalysisResult;
  /** Transient result (for .TRAN). */
  transientResult?: TransientResult;
  /** Node name to node number mapping used in the simulation. */
  nodeMap: Record<string, number>;
  /** Whether the simulation converged. */
  converged: boolean;
  /** Any warnings produced during simulation. */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// SPICE value multiplier suffixes
// ---------------------------------------------------------------------------

/**
 * Parse a SPICE engineering-notation value string into a number.
 *
 * Supports:
 *   - Plain numbers: "100", "3.14", "1e3", "2.2e-6"
 *   - SI multiplier suffixes: T, G, MEG, K, M, U, N, P, F
 *   - Alternative forms: "u" and "\u00B5" (micro sign) both map to 1e-6
 *   - Trailing unit letters are stripped: "10kOhm", "100nF", "4.7uH"
 *
 * SPICE convention: "M" = milli (1e-3), "MEG" = mega (1e6).
 */
export function parseSpiceValue(valueStr: string): number {
  if (!valueStr || valueStr.trim() === '') {
    return NaN;
  }

  const cleaned = valueStr.trim();

  // Try direct numeric parse first
  const direct = Number(cleaned);
  if (!Number.isNaN(direct)) {
    return direct;
  }

  // Match: optional sign, digits (with optional decimal and exponent), then suffix
  const match = /^([+-]?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)\s*([a-zA-Z\u00B5]+)$/.exec(cleaned);
  if (!match) {
    return NaN;
  }

  const num = Number(match[1]);
  if (Number.isNaN(num)) {
    return NaN;
  }

  const suffixRaw = match[2];

  // Try to find the multiplier by checking prefixes of the suffix string.
  // Order matters: check "MEG" before "M".
  const multiplier = resolveMultiplier(suffixRaw);
  if (multiplier === undefined) {
    return NaN;
  }

  return num * multiplier;
}

/** SPICE suffix multiplier table. Checked in order from longest to shortest. */
const SUFFIX_TABLE: Array<{ pattern: string; value: number }> = [
  { pattern: 'MEG', value: 1e6 },
  { pattern: 'MIL', value: 25.4e-6 },
  { pattern: 'T', value: 1e12 },
  { pattern: 'G', value: 1e9 },
  { pattern: 'K', value: 1e3 },
  { pattern: 'M', value: 1e-3 },
  { pattern: 'U', value: 1e-6 },
  { pattern: '\u00B5', value: 1e-6 },
  { pattern: 'N', value: 1e-9 },
  { pattern: 'P', value: 1e-12 },
  { pattern: 'F', value: 1e-15 },
];

function resolveMultiplier(suffix: string): number | undefined {
  const upper = suffix.toUpperCase();
  for (const entry of SUFFIX_TABLE) {
    if (upper.startsWith(entry.pattern.toUpperCase())) {
      return entry.value;
    }
  }
  // If it starts with a known unit letter (V, A, H, F, OHM, etc.) with no multiplier, return 1.
  if (/^[VAHSFW\u03A9]|^OHM/i.test(upper)) {
    return 1;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Source spec parsing (PULSE, SIN, AC, DC)
// ---------------------------------------------------------------------------

/**
 * Parse a SPICE source specification string.
 * Returns either a numeric DC value or the full spec string for complex sources.
 */
function parseSourceSpec(tokens: string[]): number | string {
  if (tokens.length === 0) {
    return 0;
  }

  // Join remaining tokens
  const spec = tokens.join(' ');

  // Pure DC value: just a number
  const numericValue = parseSpiceValue(tokens[0]);
  if (tokens.length === 1 && !Number.isNaN(numericValue)) {
    return numericValue;
  }

  // "DC <value>" form
  if (tokens[0].toUpperCase() === 'DC') {
    if (tokens.length >= 2) {
      const dcVal = parseSpiceValue(tokens[1]);
      if (!Number.isNaN(dcVal)) {
        // Check if there's more after DC value (like "AC 1")
        if (tokens.length > 2) {
          return spec;
        }
        return dcVal;
      }
    }
    return 0;
  }

  // Complex spec (PULSE, SIN, AC, etc.) — return as string
  return spec;
}

// ---------------------------------------------------------------------------
// Model parameter parsing
// ---------------------------------------------------------------------------

/**
 * Parse model parameters from a string like "IS=1e-14 N=1 BF=100".
 * Also handles parenthesized form: "(IS=1e-14 N=1)".
 */
function parseModelParams(paramStr: string): Record<string, number> {
  const params: Record<string, number> = {};

  // Strip parentheses
  const cleaned = paramStr.replace(/[()]/g, ' ').trim();
  if (!cleaned) {
    return params;
  }

  // Split on whitespace and process key=value pairs
  const tokens = cleaned.split(/\s+/);
  for (const token of tokens) {
    const eqIdx = token.indexOf('=');
    if (eqIdx > 0) {
      const key = token.slice(0, eqIdx).toUpperCase();
      const val = parseSpiceValue(token.slice(eqIdx + 1));
      if (!Number.isNaN(val)) {
        params[key] = val;
      }
    }
  }

  return params;
}

// ---------------------------------------------------------------------------
// Line continuation and preprocessing
// ---------------------------------------------------------------------------

/**
 * Preprocess SPICE netlist text:
 *  1. Split into lines
 *  2. Join continuation lines (lines starting with '+')
 *  3. Strip inline comments (after ';')
 *  4. Return processed lines with their original line numbers
 */
function preprocessLines(text: string): Array<{ content: string; lineNumber: number }> {
  const rawLines = text.split(/\r?\n/);
  const result: Array<{ content: string; lineNumber: number }> = [];

  for (let i = 0; i < rawLines.length; i++) {
    let line = rawLines[i];

    // Strip inline comments (;)
    const semiIdx = line.indexOf(';');
    if (semiIdx >= 0) {
      line = line.slice(0, semiIdx);
    }

    // Trim trailing whitespace
    line = line.trimEnd();

    if (line.length === 0) {
      continue;
    }

    // Continuation line: append to previous
    if (line.startsWith('+') && result.length > 0) {
      result[result.length - 1].content += ' ' + line.slice(1).trimStart();
      continue;
    }

    result.push({ content: line, lineNumber: i + 1 });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Element line parsers
// ---------------------------------------------------------------------------

function parsePassiveElement(
  type: string,
  name: string,
  tokens: string[],
  lineNumber: number,
  errors: ParseError[],
): SpiceElement | null {
  // R/C/L: <name> <node+> <node-> <value> [params...]
  if (tokens.length < 3) {
    errors.push({ line: lineNumber, message: `${type} element '${name}' requires at least 2 nodes and a value` });
    return null;
  }

  const nodes = [tokens[0].toLowerCase(), tokens[1].toLowerCase()];
  const value = parseSpiceValue(tokens[2]);

  if (Number.isNaN(value)) {
    errors.push({ line: lineNumber, message: `${type} element '${name}': invalid value '${tokens[2]}'` });
    return null;
  }

  // Parse any additional instance parameters
  const params: Record<string, number> = {};
  for (let i = 3; i < tokens.length; i++) {
    const eqIdx = tokens[i].indexOf('=');
    if (eqIdx > 0) {
      const key = tokens[i].slice(0, eqIdx).toUpperCase();
      const val = parseSpiceValue(tokens[i].slice(eqIdx + 1));
      if (!Number.isNaN(val)) {
        params[key] = val;
      }
    }
  }

  return {
    type,
    name,
    nodes,
    value,
    params: Object.keys(params).length > 0 ? params : undefined,
  };
}

function parseSourceElement(
  type: string,
  name: string,
  tokens: string[],
  lineNumber: number,
  errors: ParseError[],
): SpiceElement | null {
  // V/I: <name> <node+> <node-> [DC <value>] [AC <mag> [<phase>]] [PULSE(...)] [SIN(...)]
  if (tokens.length < 2) {
    errors.push({ line: lineNumber, message: `${type} source '${name}' requires at least 2 nodes` });
    return null;
  }

  const nodes = [tokens[0].toLowerCase(), tokens[1].toLowerCase()];
  const valueSpec = parseSourceSpec(tokens.slice(2));

  return {
    type,
    name,
    nodes,
    value: valueSpec,
  };
}

function parseDiodeElement(
  name: string,
  tokens: string[],
  lineNumber: number,
  errors: ParseError[],
): SpiceElement | null {
  // D: <name> <anode> <cathode> <model> [params...]
  if (tokens.length < 3) {
    errors.push({ line: lineNumber, message: `Diode '${name}' requires 2 nodes and a model name` });
    return null;
  }

  const nodes = [tokens[0].toLowerCase(), tokens[1].toLowerCase()];
  const model = tokens[2];

  const params: Record<string, number> = {};
  for (let i = 3; i < tokens.length; i++) {
    const eqIdx = tokens[i].indexOf('=');
    if (eqIdx > 0) {
      const key = tokens[i].slice(0, eqIdx).toUpperCase();
      const val = parseSpiceValue(tokens[i].slice(eqIdx + 1));
      if (!Number.isNaN(val)) {
        params[key] = val;
      }
    }
  }

  return {
    type: 'D',
    name,
    nodes,
    value: 0,
    model,
    params: Object.keys(params).length > 0 ? params : undefined,
  };
}

function parseBJTElement(
  name: string,
  tokens: string[],
  lineNumber: number,
  errors: ParseError[],
): SpiceElement | null {
  // Q: <name> <collector> <base> <emitter> <model> [params...]
  if (tokens.length < 4) {
    errors.push({ line: lineNumber, message: `BJT '${name}' requires 3 nodes and a model name` });
    return null;
  }

  const nodes = [tokens[0].toLowerCase(), tokens[1].toLowerCase(), tokens[2].toLowerCase()];
  const model = tokens[3];

  const params: Record<string, number> = {};
  for (let i = 4; i < tokens.length; i++) {
    const eqIdx = tokens[i].indexOf('=');
    if (eqIdx > 0) {
      const key = tokens[i].slice(0, eqIdx).toUpperCase();
      const val = parseSpiceValue(tokens[i].slice(eqIdx + 1));
      if (!Number.isNaN(val)) {
        params[key] = val;
      }
    }
  }

  return {
    type: 'Q',
    name,
    nodes,
    value: 0,
    model,
    params: Object.keys(params).length > 0 ? params : undefined,
  };
}

function parseMOSFETElement(
  name: string,
  tokens: string[],
  lineNumber: number,
  errors: ParseError[],
): SpiceElement | null {
  // M: <name> <drain> <gate> <source> <bulk> <model> [W=... L=... ...]
  if (tokens.length < 5) {
    errors.push({ line: lineNumber, message: `MOSFET '${name}' requires 4 nodes and a model name` });
    return null;
  }

  const nodes = [
    tokens[0].toLowerCase(),
    tokens[1].toLowerCase(),
    tokens[2].toLowerCase(),
    tokens[3].toLowerCase(),
  ];
  const model = tokens[4];

  const params: Record<string, number> = {};
  for (let i = 5; i < tokens.length; i++) {
    const eqIdx = tokens[i].indexOf('=');
    if (eqIdx > 0) {
      const key = tokens[i].slice(0, eqIdx).toUpperCase();
      const val = parseSpiceValue(tokens[i].slice(eqIdx + 1));
      if (!Number.isNaN(val)) {
        params[key] = val;
      }
    }
  }

  return {
    type: 'M',
    name,
    nodes,
    value: 0,
    model,
    params: Object.keys(params).length > 0 ? params : undefined,
  };
}

// ---------------------------------------------------------------------------
// Directive parsers
// ---------------------------------------------------------------------------

function parseAnalysisDirective(
  tokens: string[],
  lineNumber: number,
  errors: ParseError[],
): SpiceAnalysis | null {
  if (tokens.length === 0) {
    return null;
  }

  const directive = tokens[0].toUpperCase();

  switch (directive) {
    case '.OP':
      return { type: 'op', params: {} };

    case '.DC': {
      // .DC <srcname> <start> <stop> <step>
      if (tokens.length < 5) {
        errors.push({ line: lineNumber, message: '.DC requires source name, start, stop, and step values' });
        return null;
      }
      const start = parseSpiceValue(tokens[2]);
      const stop = parseSpiceValue(tokens[3]);
      const step = parseSpiceValue(tokens[4]);
      if (Number.isNaN(start) || Number.isNaN(stop) || Number.isNaN(step)) {
        errors.push({ line: lineNumber, message: '.DC: invalid numeric value in sweep parameters' });
        return null;
      }
      return {
        type: 'dc',
        params: {
          source: tokens[1],
          start,
          stop,
          step,
        },
      };
    }

    case '.AC': {
      // .AC <sweep> <numpts> <fstart> <fstop>
      if (tokens.length < 5) {
        errors.push({ line: lineNumber, message: '.AC requires sweep type, numpoints, fstart, and fstop' });
        return null;
      }
      const sweepType = tokens[1].toUpperCase();
      const numPoints = parseInt(tokens[2], 10);
      const fStart = parseSpiceValue(tokens[3]);
      const fStop = parseSpiceValue(tokens[4]);
      if (Number.isNaN(numPoints) || Number.isNaN(fStart) || Number.isNaN(fStop)) {
        errors.push({ line: lineNumber, message: '.AC: invalid numeric value in parameters' });
        return null;
      }
      return {
        type: 'ac',
        params: {
          sweepType,
          numPoints,
          fStart,
          fStop,
        },
      };
    }

    case '.TRAN': {
      // .TRAN <tstep> <tstop> [<tstart> [<tmax>]]
      if (tokens.length < 3) {
        errors.push({ line: lineNumber, message: '.TRAN requires at least tstep and tstop' });
        return null;
      }
      const tStep = parseSpiceValue(tokens[1]);
      const tStop = parseSpiceValue(tokens[2]);
      if (Number.isNaN(tStep) || Number.isNaN(tStop)) {
        errors.push({ line: lineNumber, message: '.TRAN: invalid numeric value in parameters' });
        return null;
      }
      const params: Record<string, number | string> = { tStep, tStop };
      if (tokens.length >= 4) {
        const tStart = parseSpiceValue(tokens[3]);
        if (!Number.isNaN(tStart)) {
          params['tStart'] = tStart;
        }
      }
      if (tokens.length >= 5) {
        const tMax = parseSpiceValue(tokens[4]);
        if (!Number.isNaN(tMax)) {
          params['tMax'] = tMax;
        }
      }
      return { type: 'tran', params };
    }

    default:
      return null;
  }
}

function parseModelDirective(
  tokens: string[],
  lineNumber: number,
  errors: ParseError[],
): SpiceModel | null {
  // .MODEL <name> <type>[(<params>)]
  // The type and opening paren may be joined: "D(IS=1e-14" or separate: "D" "(" "IS=1e-14"
  if (tokens.length < 3) {
    errors.push({ line: lineNumber, message: '.MODEL requires a name and type' });
    return null;
  }

  const name = tokens[1];

  // Rejoin everything after the name to handle TYPE(params) as one string
  const remainder = tokens.slice(2).join(' ');

  // Split type from parameters: TYPE may be immediately followed by '('
  const parenIdx = remainder.indexOf('(');
  let type: string;
  let paramStr: string;

  if (parenIdx === -1) {
    // No parentheses — type is first token, rest are space-separated params
    const parts = remainder.split(/\s+/);
    type = parts[0].toUpperCase();
    paramStr = parts.slice(1).join(' ');
  } else {
    type = remainder.slice(0, parenIdx).trim().toUpperCase();
    paramStr = remainder.slice(parenIdx);
  }

  const params = parseModelParams(paramStr);

  return { name, type, params };
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Parse a SPICE netlist text into a structured representation.
 *
 * The parser is case-insensitive (SPICE convention). Node names are
 * normalized to lowercase. Model names preserve their original case.
 *
 * @param text - Raw SPICE netlist text
 * @returns ParsedNetlist with elements, analyses, models, and any errors
 */
export function parseSpiceNetlist(text: string): ParsedNetlist {
  const rawLines = text.split(/\r?\n/);
  const errors: ParseError[] = [];
  const elements: SpiceElement[] = [];
  const analyses: SpiceAnalysis[] = [];
  const models: Record<string, SpiceModel> = {};
  const subckts: Record<string, SpiceSubckt> = {};

  const processed = preprocessLines(text);
  if (processed.length === 0) {
    return { title: '', elements, analyses, models, subckts, rawLines, errors };
  }

  // First non-comment line is the title
  const title = processed[0].content;

  // Track subcircuit and control block parsing state
  let inSubckt = false;
  let currentSubckt: SpiceSubckt | null = null;
  let inControl = false;

  for (let i = 1; i < processed.length; i++) {
    const { content, lineNumber } = processed[i];

    // Skip comment lines
    if (content.startsWith('*')) {
      continue;
    }

    // Skip .END
    if (content.toUpperCase().trim() === '.END') {
      continue;
    }

    // Track control blocks — skip everything inside .CONTROL / .ENDC
    if (content.toUpperCase().trim() === '.CONTROL') {
      inControl = true;
      continue;
    }
    if (content.toUpperCase().trim() === '.ENDC') {
      inControl = false;
      continue;
    }
    if (inControl) {
      continue;
    }

    // Tokenize
    const tokens = content.split(/\s+/).filter((t) => t.length > 0);
    if (tokens.length === 0) {
      continue;
    }

    const firstToken = tokens[0].toUpperCase();

    // Handle .SUBCKT
    if (firstToken === '.SUBCKT') {
      if (tokens.length < 3) {
        errors.push({ line: lineNumber, message: '.SUBCKT requires a name and at least one port' });
        continue;
      }
      inSubckt = true;
      currentSubckt = {
        name: tokens[1],
        ports: tokens.slice(2).map((t) => t.toLowerCase()),
        body: [],
      };
      continue;
    }

    if (firstToken === '.ENDS') {
      if (currentSubckt) {
        subckts[currentSubckt.name] = currentSubckt;
      }
      inSubckt = false;
      currentSubckt = null;
      continue;
    }

    if (inSubckt && currentSubckt) {
      currentSubckt.body.push(content);
      continue;
    }

    // Directives
    if (firstToken.startsWith('.')) {
      if (firstToken === '.MODEL') {
        const model = parseModelDirective(tokens, lineNumber, errors);
        if (model) {
          models[model.name] = model;
        }
        continue;
      }

      if (firstToken === '.OP' || firstToken === '.DC' || firstToken === '.AC' || firstToken === '.TRAN') {
        const analysis = parseAnalysisDirective(tokens, lineNumber, errors);
        if (analysis) {
          analyses.push(analysis);
        }
        continue;
      }

      // Skip other directives (.TEMP, .OPTIONS, .PRINT, .PLOT, etc.)
      continue;
    }

    // Element lines — dispatch by first character
    const name = tokens[0];
    const prefix = firstToken.charAt(0);
    const rest = tokens.slice(1);

    switch (prefix) {
      case 'R':
      case 'C':
      case 'L': {
        const elem = parsePassiveElement(prefix, name, rest, lineNumber, errors);
        if (elem) {
          elements.push(elem);
        }
        break;
      }

      case 'V':
      case 'I': {
        const elem = parseSourceElement(prefix, name, rest, lineNumber, errors);
        if (elem) {
          elements.push(elem);
        }
        break;
      }

      case 'D': {
        const elem = parseDiodeElement(name, rest, lineNumber, errors);
        if (elem) {
          elements.push(elem);
        }
        break;
      }

      case 'Q': {
        const elem = parseBJTElement(name, rest, lineNumber, errors);
        if (elem) {
          elements.push(elem);
        }
        break;
      }

      case 'M': {
        const elem = parseMOSFETElement(name, rest, lineNumber, errors);
        if (elem) {
          elements.push(elem);
        }
        break;
      }

      case 'X': {
        // Subcircuit instance — basic parsing
        if (rest.length < 2) {
          errors.push({ line: lineNumber, message: `Subcircuit instance '${name}' requires nodes and a subcircuit name` });
        } else {
          const subcktName = rest[rest.length - 1];
          const instanceNodes = rest.slice(0, -1).map((n) => n.toLowerCase());
          elements.push({
            type: 'X',
            name,
            nodes: instanceNodes,
            value: subcktName,
            model: subcktName,
          });
        }
        break;
      }

      default:
        errors.push({ line: lineNumber, message: `Unknown element type '${prefix}' in '${name}'` });
    }
  }

  return { title, elements, analyses, models, subckts, rawLines, errors };
}

// ---------------------------------------------------------------------------
// Netlist to SolverInput conversion
// ---------------------------------------------------------------------------

/**
 * Build a node name → node number mapping from parsed elements.
 * Node "0" and "gnd" are always ground (node 0).
 */
function buildNodeMap(elements: SpiceElement[]): Record<string, number> {
  const nodeMap: Record<string, number> = {};
  const allNodes = new Set<string>();

  for (const elem of elements) {
    for (const node of elem.nodes) {
      allNodes.add(node);
    }
  }

  // Ground nodes
  const groundNames = new Set(['0', 'gnd', 'ground', 'vss', 'agnd', 'dgnd']);
  let nextNode = 1;

  const nodeArray = Array.from(allNodes);

  for (const node of nodeArray) {
    if (groundNames.has(node)) {
      nodeMap[node] = 0;
    }
  }

  for (const node of nodeArray) {
    if (nodeMap[node] === undefined) {
      nodeMap[node] = nextNode++;
    }
  }

  return nodeMap;
}

/**
 * Convert parsed netlist elements to SolverInput for the MNA solver.
 * Only handles R, C, L, V, I (linear elements). Nonlinear devices are skipped
 * with a warning.
 */
function netlistToSolverInput(
  netlist: ParsedNetlist,
  warnings: string[],
): { input: SolverInput; nodeMap: Record<string, number> } {
  const nodeMap = buildNodeMap(netlist.elements);
  let maxNode = 0;
  for (const n of Object.values(nodeMap)) {
    if (n > maxNode) {
      maxNode = n;
    }
  }

  const components: SolverComponent[] = [];

  for (const elem of netlist.elements) {
    const resolveNode = (nodeName: string): number => nodeMap[nodeName] ?? 0;

    switch (elem.type) {
      case 'R':
      case 'C':
      case 'L': {
        const numValue = typeof elem.value === 'number' ? elem.value : parseSpiceValue(String(elem.value));
        if (Number.isNaN(numValue) || numValue === 0) {
          if (elem.type === 'R') {
            warnings.push(`${elem.name}: zero or invalid resistance, skipped`);
            continue;
          }
        }
        components.push({
          id: elem.name,
          type: elem.type as 'R' | 'C' | 'L',
          value: numValue,
          nodes: [resolveNode(elem.nodes[0]), resolveNode(elem.nodes[1])],
        });
        break;
      }

      case 'V':
      case 'I': {
        let dcValue = 0;
        if (typeof elem.value === 'number') {
          dcValue = elem.value;
        } else {
          // Extract DC value from complex spec
          const specUpper = String(elem.value).toUpperCase();
          const dcMatch = /(?:^|\s)DC\s+([^\s]+)/.exec(specUpper);
          if (dcMatch) {
            const parsed = parseSpiceValue(dcMatch[1]);
            if (!Number.isNaN(parsed)) {
              dcValue = parsed;
            }
          } else {
            // Try parsing the first token as a value
            const firstToken = String(elem.value).split(/\s+/)[0];
            const parsed = parseSpiceValue(firstToken);
            if (!Number.isNaN(parsed)) {
              dcValue = parsed;
            }
          }
        }
        components.push({
          id: elem.name,
          type: elem.type as 'V' | 'I',
          value: dcValue,
          nodes: [resolveNode(elem.nodes[0]), resolveNode(elem.nodes[1])],
        });
        break;
      }

      case 'D':
      case 'Q':
      case 'M':
        warnings.push(`${elem.name}: nonlinear device (${elem.type}) — treated as open circuit in linear analysis`);
        break;

      case 'X':
        warnings.push(`${elem.name}: subcircuit instances not expanded in this analysis`);
        break;
    }
  }

  return {
    input: {
      numNodes: maxNode,
      components,
      groundNode: 0,
    },
    nodeMap,
  };
}

// ---------------------------------------------------------------------------
// Simulation runner
// ---------------------------------------------------------------------------

/**
 * Run a parsed SPICE netlist using ProtoPulse's in-browser simulation engines.
 *
 * Selects the appropriate analysis engine based on the first analysis directive
 * found in the netlist. If no directive is specified, defaults to .OP.
 *
 * Currently supports linear circuit elements (R, C, L, V, I). Nonlinear devices
 * (D, Q, M) are noted as warnings.
 *
 * @param netlist - Parsed netlist from parseSpiceNetlist()
 * @returns SimulationResult with the analysis output
 */
export async function runParsedNetlist(netlist: ParsedNetlist): Promise<SimulationResult> {
  const warnings: string[] = [];

  // Check for parse errors
  if (netlist.errors.length > 0) {
    warnings.push(`Netlist has ${netlist.errors.length} parse error(s) — simulation may be incomplete`);
  }

  // Convert to solver input
  const { input, nodeMap } = netlistToSolverInput(netlist, warnings);

  // Determine which analysis to run
  const analysis = netlist.analyses.length > 0 ? netlist.analyses[0] : { type: 'op' as const, params: {} };

  switch (analysis.type) {
    case 'op': {
      const dcResult = solveDCOPBasic(input);
      return {
        analysisType: 'op',
        dcResult,
        nodeMap,
        converged: dcResult.converged,
        warnings,
      };
    }

    case 'dc': {
      const sourceId = String(analysis.params['source'] ?? '');
      const start = Number(analysis.params['start'] ?? 0);
      const stop = Number(analysis.params['stop'] ?? 5);
      const step = Number(analysis.params['step'] ?? 0.1);

      // Find the source in our components
      const sourceExists = input.components.some((c) => c.id.toUpperCase() === sourceId.toUpperCase());
      if (!sourceExists) {
        warnings.push(`.DC: source '${sourceId}' not found in circuit`);
      }

      // Match source ID case-insensitively
      const matchedId = input.components.find((c) => c.id.toUpperCase() === sourceId.toUpperCase())?.id ?? sourceId;

      const dcSweepResult = solveDCSweep(input, matchedId, start, stop, step);
      return {
        analysisType: 'dc',
        dcSweepResult,
        nodeMap,
        converged: true,
        warnings,
      };
    }

    case 'ac': {
      const sweepType = String(analysis.params['sweepType'] ?? 'DEC').toUpperCase();
      const numPoints = Number(analysis.params['numPoints'] ?? 100);
      const fStart = Number(analysis.params['fStart'] ?? 1);
      const fStop = Number(analysis.params['fStop'] ?? 1e6);

      // Find AC source or use first voltage source node as input
      let inputNode = 1;
      let outputNode = input.numNodes;

      // Use the first voltage source's positive node as input
      const firstVSource = input.components.find((c) => c.type === 'V');
      if (firstVSource) {
        inputNode = firstVSource.nodes[0] || 1;
      }

      // Use the highest-numbered non-ground node as output
      if (input.numNodes > 0) {
        outputNode = input.numNodes;
      }

      const acConfig: ACAnalysisConfig = {
        startFreq: fStart,
        stopFreq: fStop,
        sweepType: sweepType === 'LIN' ? 'linear' : 'decade',
        pointsPerDecade: numPoints,
        inputNode,
        outputNode,
        groundNode: 0,
      };

      try {
        const acResult = runACAnalysis(input, acConfig);
        return {
          analysisType: 'ac',
          acResult,
          nodeMap,
          converged: true,
          warnings,
        };
      } catch (err) {
        warnings.push(`AC analysis error: ${err instanceof Error ? err.message : String(err)}`);
        return {
          analysisType: 'ac',
          nodeMap,
          converged: false,
          warnings,
        };
      }
    }

    case 'tran': {
      const tStep = Number(analysis.params['tStep'] ?? 1e-6);
      const tStop = Number(analysis.params['tStop'] ?? 1e-3);
      const tStart = Number(analysis.params['tStart'] ?? 0);

      const transientResult = solveTransient(input, tStart, tStop, tStep);
      return {
        analysisType: 'tran',
        transientResult,
        nodeMap,
        converged: transientResult.converged,
        warnings,
      };
    }

    default: {
      // Fallback to DC operating point
      const dcResult = solveDCOPBasic(input);
      return {
        analysisType: 'op',
        dcResult,
        nodeMap,
        converged: dcResult.converged,
        warnings,
      };
    }
  }
}
