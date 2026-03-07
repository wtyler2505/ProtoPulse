/**
 * Design Import Parser
 *
 * Client-side design file parser that imports project files from KiCad, EAGLE,
 * and Altium, converting them to ProtoPulse's internal format.
 *
 * Supports:
 *   - KiCad: .kicad_sch (schematic), .kicad_pcb (PCB), .kicad_sym (symbol library)
 *   - EAGLE: .sch (schematic), .brd (board), .lbr (library)
 *   - Altium: SchDoc (schematic), PcbDoc (PCB) — ASCII format
 *
 * Usage:
 *   const importer = DesignImporter.getInstance();
 *   const result = importer.importFile(fileContent, 'circuit.kicad_sch');
 *   const protopulse = importer.convertToProtoPulse(result.design!);
 *
 * React hook:
 *   const { importFile, detectFormat, convertToProtoPulse } = useDesignImport();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImportFormat =
  | 'kicad-schematic'
  | 'kicad-pcb'
  | 'kicad-symbol'
  | 'eagle-schematic'
  | 'eagle-board'
  | 'eagle-library'
  | 'altium-schematic'
  | 'altium-pcb'
  | 'geda-schematic'
  | 'ltspice-schematic'
  | 'proteus-schematic'
  | 'orcad-schematic';

export type ImportStatus = 'pending' | 'parsing' | 'converting' | 'complete' | 'error';

export interface ImportedComponent {
  refDes: string;
  name: string;
  value: string;
  package: string;
  library: string;
  position?: { x: number; y: number };
  rotation?: number;
  layer?: string;
  properties: Record<string, string>;
  pins: Array<{
    number: string;
    name: string;
    type: 'input' | 'output' | 'bidirectional' | 'power' | 'passive' | 'unspecified';
    position?: { x: number; y: number };
  }>;
}

export interface ImportedNet {
  name: string;
  pins: Array<{ componentRef: string; pinNumber: string }>;
  netClass?: string;
}

export interface ImportedWire {
  start: { x: number; y: number };
  end: { x: number; y: number };
  net?: string;
  width?: number;
  layer?: string;
}

export interface ImportedDesign {
  format: ImportFormat;
  fileName: string;
  version?: string;
  title?: string;
  date?: string;
  components: ImportedComponent[];
  nets: ImportedNet[];
  wires: ImportedWire[];
  metadata: Record<string, string>;
  warnings: string[];
  errors: string[];
}

export interface ImportResult {
  status: ImportStatus;
  design: ImportedDesign | null;
  parseTime: number;
  componentCount: number;
  netCount: number;
  wireCount: number;
  warningCount: number;
  errorCount: number;
}

export interface FormatDetectionResult {
  format: ImportFormat | null;
  confidence: number;
  indicators: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-design-imports';

const PIN_TYPE_MAP: Record<string, ImportedComponent['pins'][0]['type']> = {
  input: 'input',
  output: 'output',
  bidirectional: 'bidirectional',
  bi_directional: 'bidirectional',
  power_in: 'power',
  power_out: 'power',
  power: 'power',
  passive: 'passive',
  tri_state: 'bidirectional',
  open_collector: 'output',
  open_emitter: 'output',
  unspecified: 'unspecified',
  no_connect: 'unspecified',
  free: 'unspecified',
};

const SUPPORTED_FORMATS: Array<{ format: ImportFormat; extensions: string[]; description: string }> = [
  { format: 'kicad-schematic', extensions: ['.kicad_sch'], description: 'KiCad Schematic' },
  { format: 'kicad-pcb', extensions: ['.kicad_pcb'], description: 'KiCad PCB Layout' },
  { format: 'kicad-symbol', extensions: ['.kicad_sym'], description: 'KiCad Symbol Library' },
  { format: 'eagle-schematic', extensions: ['.sch'], description: 'EAGLE Schematic' },
  { format: 'eagle-board', extensions: ['.brd'], description: 'EAGLE Board Layout' },
  { format: 'eagle-library', extensions: ['.lbr'], description: 'EAGLE Component Library' },
  { format: 'altium-schematic', extensions: ['.SchDoc'], description: 'Altium Schematic' },
  { format: 'altium-pcb', extensions: ['.PcbDoc'], description: 'Altium PCB Layout' },
  { format: 'geda-schematic', extensions: ['.sch'], description: 'gEDA/gschem Schematic' },
  { format: 'ltspice-schematic', extensions: ['.asc'], description: 'LTspice Schematic' },
  { format: 'proteus-schematic', extensions: ['.dsn'], description: 'Proteus Design' },
  { format: 'orcad-schematic', extensions: ['.dsn'], description: 'OrCAD/CadStar Schematic' },
];

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// S-expression parser helpers (KiCad)
// ---------------------------------------------------------------------------

interface SExprNode {
  tag: string;
  values: string[];
  children: SExprNode[];
}

/**
 * Tokenize an S-expression string.
 * Handles quoted strings and parentheses.
 */
function tokenizeSExpr(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    const ch = input[i];

    // Skip whitespace
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }

    // Parentheses
    if (ch === '(' || ch === ')') {
      tokens.push(ch);
      i++;
      continue;
    }

    // Quoted string
    if (ch === '"') {
      let str = '"';
      i++;
      while (i < len && input[i] !== '"') {
        if (input[i] === '\\' && i + 1 < len) {
          str += input[i] + input[i + 1];
          i += 2;
        } else {
          str += input[i];
          i++;
        }
      }
      str += '"';
      i++; // skip closing quote
      tokens.push(str);
      continue;
    }

    // Atom
    let atom = '';
    while (i < len && input[i] !== ' ' && input[i] !== '\t' && input[i] !== '\n' && input[i] !== '\r' && input[i] !== '(' && input[i] !== ')') {
      atom += input[i];
      i++;
    }
    if (atom.length > 0) {
      tokens.push(atom);
    }
  }

  return tokens;
}

/**
 * Parse tokenized S-expressions into a tree structure.
 */
function parseSExprTokens(tokens: string[]): SExprNode[] {
  const nodes: SExprNode[] = [];
  let i = 0;

  function parseNode(): SExprNode | null {
    if (i >= tokens.length || tokens[i] !== '(') {
      return null;
    }
    i++; // skip '('

    if (i >= tokens.length) {
      return null;
    }

    const tag = unquote(tokens[i]);
    i++;

    const values: string[] = [];
    const children: SExprNode[] = [];

    while (i < tokens.length && tokens[i] !== ')') {
      if (tokens[i] === '(') {
        const child = parseNode();
        if (child) {
          children.push(child);
        }
      } else {
        values.push(unquote(tokens[i]));
        i++;
      }
    }

    if (i < tokens.length) {
      i++; // skip ')'
    }

    return { tag, values, children };
  }

  while (i < tokens.length) {
    if (tokens[i] === '(') {
      const node = parseNode();
      if (node) {
        nodes.push(node);
      }
    } else {
      i++;
    }
  }

  return nodes;
}

function unquote(s: string): string {
  if (s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return s;
}

function findChild(node: SExprNode, tag: string): SExprNode | undefined {
  return node.children.find((c) => c.tag === tag);
}

function findChildren(node: SExprNode, tag: string): SExprNode[] {
  return node.children.filter((c) => c.tag === tag);
}

function getChildValue(node: SExprNode, tag: string): string | undefined {
  const child = findChild(node, tag);
  return child?.values[0];
}

// ---------------------------------------------------------------------------
// XML parser helpers (EAGLE)
// ---------------------------------------------------------------------------

interface XmlNode {
  tag: string;
  attributes: Record<string, string>;
  children: XmlNode[];
  text: string;
}

/**
 * Simple XML parser. Not a full XML parser, but handles EAGLE files.
 */
function parseXml(input: string): XmlNode | null {
  // Remove XML declaration and DOCTYPE
  let cleaned = input.replace(/<\?xml[^?]*\?>/g, '').replace(/<!DOCTYPE[^>]*>/g, '').trim();

  // Remove comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

  return parseXmlNode(cleaned, 0).node;
}

function parseXmlNode(input: string, pos: number): { node: XmlNode | null; end: number } {
  // Skip whitespace
  while (pos < input.length && (input[pos] === ' ' || input[pos] === '\n' || input[pos] === '\r' || input[pos] === '\t')) {
    pos++;
  }

  if (pos >= input.length || input[pos] !== '<') {
    return { node: null, end: pos };
  }

  // Check for self-closing or opening tag
  const tagStart = pos;
  pos++; // skip '<'

  // Read tag name
  let tagName = '';
  while (pos < input.length && input[pos] !== ' ' && input[pos] !== '>' && input[pos] !== '/' && input[pos] !== '\n' && input[pos] !== '\r' && input[pos] !== '\t') {
    tagName += input[pos];
    pos++;
  }

  // Read attributes
  const attributes: Record<string, string> = {};
  while (pos < input.length && input[pos] !== '>' && !(input[pos] === '/' && pos + 1 < input.length && input[pos + 1] === '>')) {
    // Skip whitespace
    while (pos < input.length && (input[pos] === ' ' || input[pos] === '\n' || input[pos] === '\r' || input[pos] === '\t')) {
      pos++;
    }

    if (input[pos] === '>' || (input[pos] === '/' && pos + 1 < input.length && input[pos + 1] === '>')) {
      break;
    }

    // Read attribute name
    let attrName = '';
    while (pos < input.length && input[pos] !== '=' && input[pos] !== ' ' && input[pos] !== '>' && input[pos] !== '/') {
      attrName += input[pos];
      pos++;
    }

    if (input[pos] === '=') {
      pos++; // skip '='
      if (input[pos] === '"') {
        pos++; // skip opening quote
        let attrValue = '';
        while (pos < input.length && input[pos] !== '"') {
          attrValue += input[pos];
          pos++;
        }
        pos++; // skip closing quote
        attributes[attrName] = attrValue;
      }
    }
  }

  // Self-closing tag
  if (input[pos] === '/' && pos + 1 < input.length && input[pos + 1] === '>') {
    pos += 2;
    return {
      node: { tag: tagName, attributes, children: [], text: '' },
      end: pos,
    };
  }

  if (input[pos] === '>') {
    pos++; // skip '>'
  }

  // Read children and text content
  const children: XmlNode[] = [];
  let text = '';

  while (pos < input.length) {
    // Skip whitespace
    while (pos < input.length && (input[pos] === ' ' || input[pos] === '\n' || input[pos] === '\r' || input[pos] === '\t')) {
      pos++;
    }

    if (pos >= input.length) {
      break;
    }

    // Check for closing tag
    if (input[pos] === '<' && pos + 1 < input.length && input[pos + 1] === '/') {
      // Find end of closing tag
      const closeEnd = input.indexOf('>', pos);
      if (closeEnd !== -1) {
        pos = closeEnd + 1;
      }
      break;
    }

    // Check for child element
    if (input[pos] === '<') {
      const childResult = parseXmlNode(input, pos);
      if (childResult.node) {
        children.push(childResult.node);
        pos = childResult.end;
      } else {
        pos++;
      }
    } else {
      // Text content
      while (pos < input.length && input[pos] !== '<') {
        text += input[pos];
        pos++;
      }
    }
  }

  // Handle case where we started parsing but tagName is empty (shouldn't happen normally)
  if (tagName.length === 0) {
    return { node: null, end: tagStart + 1 };
  }

  return {
    node: { tag: tagName, attributes, children, text: text.trim() },
    end: pos,
  };
}

function findXmlChildren(node: XmlNode, tag: string): XmlNode[] {
  return node.children.filter((c) => c.tag === tag);
}

function findXmlChild(node: XmlNode, tag: string): XmlNode | undefined {
  return node.children.find((c) => c.tag === tag);
}

function findXmlDescendant(node: XmlNode, tag: string): XmlNode | undefined {
  if (node.tag === tag) {
    return node;
  }
  for (const child of node.children) {
    const found = findXmlDescendant(child, tag);
    if (found) {
      return found;
    }
  }
  return undefined;
}

function findXmlDescendants(node: XmlNode, tag: string): XmlNode[] {
  const results: XmlNode[] = [];
  if (node.tag === tag) {
    results.push(node);
  }
  node.children.forEach((child) => {
    results.push(...findXmlDescendants(child, tag));
  });
  return results;
}

// ---------------------------------------------------------------------------
// DesignImporter
// ---------------------------------------------------------------------------

/**
 * Parses design files from KiCad, EAGLE, and Altium formats.
 * Singleton per application. Notifies subscribers on state changes.
 * Persists import history to localStorage.
 */
export class DesignImporter {
  private static instance: DesignImporter | null = null;

  private history: ImportResult[] = [];
  private listeners = new Set<Listener>();

  constructor() {
    this.loadHistory();
  }

  /** Get or create the singleton instance. */
  static getInstance(): DesignImporter {
    if (!DesignImporter.instance) {
      DesignImporter.instance = new DesignImporter();
    }
    return DesignImporter.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetForTesting(): void {
    DesignImporter.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => {
      l();
    });
  }

  // -----------------------------------------------------------------------
  // Format Detection
  // -----------------------------------------------------------------------

  /**
   * Auto-detect file format from content and optional filename.
   */
  detectFormat(content: string, fileName?: string): FormatDetectionResult {
    if (!content || content.trim().length === 0) {
      return { format: null, confidence: 0, indicators: ['Empty content'] };
    }

    const indicators: string[] = [];
    const trimmed = content.trim();

    // Check content-based markers first (higher confidence)

    // KiCad Schematic
    if (trimmed.startsWith('(kicad_sch')) {
      indicators.push('Content starts with (kicad_sch');
      return { format: 'kicad-schematic', confidence: 1.0, indicators };
    }

    // KiCad PCB
    if (trimmed.startsWith('(kicad_pcb')) {
      indicators.push('Content starts with (kicad_pcb');
      return { format: 'kicad-pcb', confidence: 1.0, indicators };
    }

    // KiCad Symbol Library
    if (trimmed.startsWith('(kicad_symbol_lib')) {
      indicators.push('Content starts with (kicad_symbol_lib');
      return { format: 'kicad-symbol', confidence: 1.0, indicators };
    }

    // EAGLE XML
    if (trimmed.includes('<eagle')) {
      indicators.push('Contains <eagle> XML element');

      if (trimmed.includes('<schematic')) {
        indicators.push('Contains <schematic> element');
        return { format: 'eagle-schematic', confidence: 1.0, indicators };
      }
      if (trimmed.includes('<board')) {
        indicators.push('Contains <board> element');
        return { format: 'eagle-board', confidence: 1.0, indicators };
      }
      if (trimmed.includes('<library')) {
        indicators.push('Contains <library> element');
        return { format: 'eagle-library', confidence: 0.9, indicators };
      }

      // Generic EAGLE
      return { format: 'eagle-schematic', confidence: 0.5, indicators };
    }

    // Altium ASCII format
    if (trimmed.includes('|RECORD=')) {
      indicators.push('Contains |RECORD= markers (Altium ASCII format)');

      if (trimmed.includes('|RECORD=1|') || trimmed.includes('|RECORD=34|') || trimmed.includes('LIBREFERENCE')) {
        indicators.push('Contains schematic record types');
        return { format: 'altium-schematic', confidence: 0.9, indicators };
      }
      if (trimmed.includes('|RECORD=Board|') || trimmed.includes('LAYER=') || trimmed.includes('|RECORD=Pad|')) {
        indicators.push('Contains PCB record types');
        return { format: 'altium-pcb', confidence: 0.9, indicators };
      }

      return { format: 'altium-schematic', confidence: 0.6, indicators };
    }

    // gEDA/gschem schematic format — 'v' header line + 'C' component lines
    if (/^v\s+\d{8}\s+\d+/.test(trimmed)) {
      indicators.push('Starts with gEDA version header (v YYYYMMDD N)');
      return { format: 'geda-schematic', confidence: 1.0, indicators };
    }

    // LTspice .asc format — starts with 'Version 4' or contains SYMBOL/WIRE/FLAG directives
    if (/^Version\s+\d+/i.test(trimmed)) {
      indicators.push('Starts with LTspice Version header');
      if (trimmed.includes('SYMBOL') || trimmed.includes('WIRE') || trimmed.includes('FLAG')) {
        indicators.push('Contains SYMBOL/WIRE/FLAG directives');
        return { format: 'ltspice-schematic', confidence: 1.0, indicators };
      }
      return { format: 'ltspice-schematic', confidence: 0.7, indicators };
    }

    // Proteus .dsn format — CADSTAR/Proteus keyword detection
    if (trimmed.includes('DESIGN') && (trimmed.includes('COMPONENT') || trimmed.includes('PARTNAME'))) {
      indicators.push('Contains Proteus-style DESIGN + COMPONENT/PARTNAME keywords');
      return { format: 'proteus-schematic', confidence: 0.8, indicators };
    }

    // OrCAD .dsn format — CadStar/Allegro keyword detection
    if (trimmed.includes('(design') || (trimmed.includes('(library') && trimmed.includes('(component'))) {
      indicators.push('Contains OrCAD s-expression design markers');
      return { format: 'orcad-schematic', confidence: 0.8, indicators };
    }

    // Fall back to filename extension
    if (fileName) {
      const lowerName = fileName.toLowerCase();

      if (lowerName.endsWith('.kicad_sch')) {
        indicators.push('File extension .kicad_sch');
        return { format: 'kicad-schematic', confidence: 0.7, indicators };
      }
      if (lowerName.endsWith('.kicad_pcb')) {
        indicators.push('File extension .kicad_pcb');
        return { format: 'kicad-pcb', confidence: 0.7, indicators };
      }
      if (lowerName.endsWith('.kicad_sym')) {
        indicators.push('File extension .kicad_sym');
        return { format: 'kicad-symbol', confidence: 0.7, indicators };
      }
      if (lowerName.endsWith('.sch') && trimmed.includes('<')) {
        indicators.push('File extension .sch with XML content');
        return { format: 'eagle-schematic', confidence: 0.6, indicators };
      }
      if (lowerName.endsWith('.brd') && trimmed.includes('<')) {
        indicators.push('File extension .brd with XML content');
        return { format: 'eagle-board', confidence: 0.6, indicators };
      }
      if (lowerName.endsWith('.lbr')) {
        indicators.push('File extension .lbr');
        return { format: 'eagle-library', confidence: 0.6, indicators };
      }
      if (lowerName.endsWith('.schdoc')) {
        indicators.push('File extension .SchDoc');
        return { format: 'altium-schematic', confidence: 0.7, indicators };
      }
      if (lowerName.endsWith('.pcbdoc')) {
        indicators.push('File extension .PcbDoc');
        return { format: 'altium-pcb', confidence: 0.7, indicators };
      }
      if (lowerName.endsWith('.asc')) {
        indicators.push('File extension .asc (LTspice)');
        return { format: 'ltspice-schematic', confidence: 0.7, indicators };
      }
      if (lowerName.endsWith('.dsn')) {
        indicators.push('File extension .dsn');
        // Disambiguate OrCAD (s-expression) vs Proteus (keyword-based)
        if (trimmed.startsWith('(')) {
          return { format: 'orcad-schematic', confidence: 0.6, indicators };
        }
        return { format: 'proteus-schematic', confidence: 0.5, indicators };
      }
    }

    indicators.push('No recognized format markers found');
    return { format: null, confidence: 0, indicators };
  }

  // -----------------------------------------------------------------------
  // Main API
  // -----------------------------------------------------------------------

  /**
   * Import a design file. Auto-detects format and parses.
   */
  importFile(content: string, fileName: string): ImportResult {
    const startTime = performance.now();

    if (!content || content.trim().length === 0) {
      const result: ImportResult = {
        status: 'error',
        design: null,
        parseTime: performance.now() - startTime,
        componentCount: 0,
        netCount: 0,
        wireCount: 0,
        warningCount: 0,
        errorCount: 1,
      };
      this.addToHistory(result);
      return result;
    }

    const detection = this.detectFormat(content, fileName);

    if (!detection.format) {
      const result: ImportResult = {
        status: 'error',
        design: null,
        parseTime: performance.now() - startTime,
        componentCount: 0,
        netCount: 0,
        wireCount: 0,
        warningCount: 0,
        errorCount: 1,
      };
      this.addToHistory(result);
      return result;
    }

    try {
      let design: ImportedDesign;

      switch (detection.format) {
        case 'kicad-schematic':
          design = this.parseKicadSchematic(content);
          break;
        case 'kicad-pcb':
          design = this.parseKicadPcb(content);
          break;
        case 'kicad-symbol':
          design = this.parseKicadSymbol(content);
          break;
        case 'eagle-schematic':
          design = this.parseEagleSchematic(content);
          break;
        case 'eagle-board':
          design = this.parseEagleBoard(content);
          break;
        case 'eagle-library':
          design = this.parseEagleLibrary(content);
          break;
        case 'altium-schematic':
          design = this.parseAltiumSchematic(content);
          break;
        case 'altium-pcb':
          design = this.parseAltiumPcb(content);
          break;
        case 'geda-schematic':
          design = this.parseGedaSchematic(content);
          break;
        case 'ltspice-schematic':
          design = this.parseLtspiceSchematic(content);
          break;
        case 'proteus-schematic':
          design = this.parseProteusSchematic(content);
          break;
        case 'orcad-schematic':
          design = this.parseOrcadSchematic(content);
          break;
      }

      design.fileName = fileName;

      const result: ImportResult = {
        status: design.errors.length > 0 ? 'error' : 'complete',
        design,
        parseTime: performance.now() - startTime,
        componentCount: design.components.length,
        netCount: design.nets.length,
        wireCount: design.wires.length,
        warningCount: design.warnings.length,
        errorCount: design.errors.length,
      };

      this.addToHistory(result);
      return result;
    } catch (err) {
      const result: ImportResult = {
        status: 'error',
        design: null,
        parseTime: performance.now() - startTime,
        componentCount: 0,
        netCount: 0,
        wireCount: 0,
        warningCount: 0,
        errorCount: 1,
      };
      this.addToHistory(result);
      return result;
    }
  }

  // -----------------------------------------------------------------------
  // KiCad Parsers
  // -----------------------------------------------------------------------

  /**
   * Parse KiCad schematic (.kicad_sch) S-expression format.
   */
  parseKicadSchematic(content: string): ImportedDesign {
    const design = this.createEmptyDesign('kicad-schematic', '');
    const trimmed = content.trim();

    if (!trimmed.startsWith('(kicad_sch')) {
      design.errors.push('Invalid KiCad schematic: does not start with (kicad_sch');
      return design;
    }

    const tokens = tokenizeSExpr(trimmed);
    const tree = parseSExprTokens(tokens);

    if (tree.length === 0) {
      design.errors.push('Failed to parse S-expression');
      return design;
    }

    const root = tree[0];

    // Extract version
    const versionVal = getChildValue(root, 'version');
    if (versionVal) {
      design.version = versionVal;
    }

    // Extract title block
    const titleBlock = findChild(root, 'title_block');
    if (titleBlock) {
      const titleVal = getChildValue(titleBlock, 'title');
      if (titleVal) {
        design.title = titleVal;
      }
      const dateVal = getChildValue(titleBlock, 'date');
      if (dateVal) {
        design.date = dateVal;
      }
    }

    // Extract symbols (components)
    const symbols = findChildren(root, 'symbol');
    symbols.forEach((sym) => {
      const component = this.parseKicadSchematicSymbol(sym);
      if (component) {
        design.components.push(component);
      }
    });

    // Extract wires
    const wires = findChildren(root, 'wire');
    wires.forEach((wire) => {
      const parsed = this.parseKicadWire(wire);
      if (parsed) {
        design.wires.push(parsed);
      }
    });

    // Extract net labels as nets
    const labels = findChildren(root, 'label');
    const globalLabels = findChildren(root, 'global_label');

    const netMap = new Map<string, ImportedNet>();

    labels.forEach((label) => {
      const name = label.values[0];
      if (name && !netMap.has(name)) {
        netMap.set(name, { name, pins: [] });
      }
    });

    globalLabels.forEach((label) => {
      const name = label.values[0];
      if (name && !netMap.has(name)) {
        netMap.set(name, { name, pins: [] });
      }
    });

    netMap.forEach((net) => {
      design.nets.push(net);
    });

    return design;
  }

  /**
   * Parse KiCad PCB (.kicad_pcb) S-expression format.
   */
  parseKicadPcb(content: string): ImportedDesign {
    const design = this.createEmptyDesign('kicad-pcb', '');
    const trimmed = content.trim();

    if (!trimmed.startsWith('(kicad_pcb')) {
      design.errors.push('Invalid KiCad PCB: does not start with (kicad_pcb');
      return design;
    }

    const tokens = tokenizeSExpr(trimmed);
    const tree = parseSExprTokens(tokens);

    if (tree.length === 0) {
      design.errors.push('Failed to parse S-expression');
      return design;
    }

    const root = tree[0];

    // Extract version
    const versionVal = getChildValue(root, 'version');
    if (versionVal) {
      design.version = versionVal;
    }

    // Extract footprints (components)
    const footprints = findChildren(root, 'footprint');
    footprints.forEach((fp) => {
      const component = this.parseKicadFootprint(fp);
      if (component) {
        design.components.push(component);
      }
    });

    // Extract nets
    const nets = findChildren(root, 'net');
    nets.forEach((net) => {
      const id = net.values[0];
      const name = net.values[1];
      if (name && name !== '') {
        design.nets.push({ name, pins: [] });
        design.metadata[`net_${id ?? ''}`] = name;
      }
    });

    // Extract segments as wires
    const segments = findChildren(root, 'segment');
    segments.forEach((seg) => {
      const parsed = this.parseKicadSegment(seg);
      if (parsed) {
        design.wires.push(parsed);
      }
    });

    return design;
  }

  /**
   * Parse KiCad symbol library (.kicad_sym) S-expression format.
   */
  parseKicadSymbol(content: string): ImportedDesign {
    const design = this.createEmptyDesign('kicad-symbol', '');
    const trimmed = content.trim();

    if (!trimmed.startsWith('(kicad_symbol_lib')) {
      design.errors.push('Invalid KiCad symbol library: does not start with (kicad_symbol_lib');
      return design;
    }

    const tokens = tokenizeSExpr(trimmed);
    const tree = parseSExprTokens(tokens);

    if (tree.length === 0) {
      design.errors.push('Failed to parse S-expression');
      return design;
    }

    const root = tree[0];

    // Extract version
    const versionVal = getChildValue(root, 'version');
    if (versionVal) {
      design.version = versionVal;
    }

    // Extract symbols
    const symbols = findChildren(root, 'symbol');
    symbols.forEach((sym) => {
      const name = sym.values[0] ?? 'unknown';

      // Skip sub-symbols (contain _0_, _1_ etc.)
      if (name.includes('_0_') || name.includes('_1_')) {
        return;
      }

      const component: ImportedComponent = {
        refDes: '',
        name,
        value: '',
        package: '',
        library: '',
        properties: {},
        pins: [],
      };

      // Extract properties
      const properties = findChildren(sym, 'property');
      properties.forEach((prop) => {
        const propName = prop.values[0];
        const propValue = prop.values[1] ?? '';
        if (propName) {
          component.properties[propName] = propValue;
          if (propName === 'Reference') {
            component.refDes = propValue;
          }
          if (propName === 'Value') {
            component.value = propValue;
          }
          if (propName === 'Footprint') {
            component.package = propValue;
          }
        }
      });

      // Extract pins from sub-symbols
      const subSymbols = findChildren(sym, 'symbol');
      subSymbols.forEach((subSym) => {
        const pins = findChildren(subSym, 'pin');
        pins.forEach((pin) => {
          const pinType = pin.values[0] ?? 'unspecified';
          const nameNode = findChild(pin, 'name');
          const numberNode = findChild(pin, 'number');
          const atNode = findChild(pin, 'at');

          component.pins.push({
            number: numberNode?.values[0] ?? '',
            name: nameNode?.values[0] ?? '',
            type: PIN_TYPE_MAP[pinType] ?? 'unspecified',
            position: atNode ? { x: parseFloat(atNode.values[0] ?? '0'), y: parseFloat(atNode.values[1] ?? '0') } : undefined,
          });
        });
      });

      design.components.push(component);
    });

    return design;
  }

  // -----------------------------------------------------------------------
  // EAGLE Parsers
  // -----------------------------------------------------------------------

  /**
   * Parse EAGLE schematic (.sch) XML format.
   */
  parseEagleSchematic(content: string): ImportedDesign {
    const design = this.createEmptyDesign('eagle-schematic', '');

    if (!content.includes('<eagle')) {
      design.errors.push('Invalid EAGLE file: does not contain <eagle> element');
      return design;
    }

    const root = parseXml(content);
    if (!root) {
      design.errors.push('Failed to parse XML');
      return design;
    }

    // Get version from eagle element
    if (root.attributes.version) {
      design.version = root.attributes.version;
    }

    // Find schematic
    const schematic = findXmlDescendant(root, 'schematic');

    if (schematic) {
      // Extract parts
      const parts = findXmlDescendants(schematic, 'part');
      parts.forEach((part) => {
        const component: ImportedComponent = {
          refDes: part.attributes.name ?? '',
          name: part.attributes.deviceset ?? part.attributes.name ?? '',
          value: part.attributes.value ?? '',
          package: part.attributes.device ?? '',
          library: part.attributes.library ?? '',
          properties: { ...part.attributes },
          pins: [],
        };
        design.components.push(component);
      });

      // Extract nets
      const nets = findXmlDescendants(schematic, 'net');
      nets.forEach((net) => {
        const importedNet: ImportedNet = {
          name: net.attributes.name ?? '',
          pins: [],
        };

        const pinRefs = findXmlDescendants(net, 'pinref');
        pinRefs.forEach((pinRef) => {
          importedNet.pins.push({
            componentRef: pinRef.attributes.part ?? '',
            pinNumber: pinRef.attributes.pin ?? '',
          });
        });

        design.nets.push(importedNet);
      });

      // Extract wires
      const wires = findXmlDescendants(schematic, 'wire');
      wires.forEach((wire) => {
        design.wires.push({
          start: { x: parseFloat(wire.attributes.x1 ?? '0'), y: parseFloat(wire.attributes.y1 ?? '0') },
          end: { x: parseFloat(wire.attributes.x2 ?? '0'), y: parseFloat(wire.attributes.y2 ?? '0') },
          width: wire.attributes.width ? parseFloat(wire.attributes.width) : undefined,
          layer: wire.attributes.layer,
        });
      });
    }

    return design;
  }

  /**
   * Parse EAGLE board (.brd) XML format.
   */
  parseEagleBoard(content: string): ImportedDesign {
    const design = this.createEmptyDesign('eagle-board', '');

    if (!content.includes('<eagle')) {
      design.errors.push('Invalid EAGLE file: does not contain <eagle> element');
      return design;
    }

    const root = parseXml(content);
    if (!root) {
      design.errors.push('Failed to parse XML');
      return design;
    }

    if (root.attributes.version) {
      design.version = root.attributes.version;
    }

    // Find board
    const board = findXmlDescendant(root, 'board');

    if (board) {
      // Extract elements (component placements)
      const elements = findXmlDescendants(board, 'element');
      elements.forEach((elem) => {
        const component: ImportedComponent = {
          refDes: elem.attributes.name ?? '',
          name: elem.attributes.value ?? elem.attributes.name ?? '',
          value: elem.attributes.value ?? '',
          package: elem.attributes.package ?? '',
          library: elem.attributes.library ?? '',
          position: {
            x: parseFloat(elem.attributes.x ?? '0'),
            y: parseFloat(elem.attributes.y ?? '0'),
          },
          rotation: elem.attributes.rot ? parseFloat(elem.attributes.rot.replace(/[^0-9.]/g, '')) : undefined,
          properties: { ...elem.attributes },
          pins: [],
        };
        design.components.push(component);
      });

      // Extract signals (nets)
      const signals = findXmlDescendants(board, 'signal');
      signals.forEach((signal) => {
        const importedNet: ImportedNet = {
          name: signal.attributes.name ?? '',
          pins: [],
        };

        const contactRefs = findXmlDescendants(signal, 'contactref');
        contactRefs.forEach((ref) => {
          importedNet.pins.push({
            componentRef: ref.attributes.element ?? '',
            pinNumber: ref.attributes.pad ?? '',
          });
        });

        design.nets.push(importedNet);
      });

      // Extract wires
      const wires = findXmlDescendants(board, 'wire');
      wires.forEach((wire) => {
        design.wires.push({
          start: { x: parseFloat(wire.attributes.x1 ?? '0'), y: parseFloat(wire.attributes.y1 ?? '0') },
          end: { x: parseFloat(wire.attributes.x2 ?? '0'), y: parseFloat(wire.attributes.y2 ?? '0') },
          width: wire.attributes.width ? parseFloat(wire.attributes.width) : undefined,
          layer: wire.attributes.layer,
        });
      });
    }

    return design;
  }

  /**
   * Parse EAGLE library (.lbr) XML format.
   */
  parseEagleLibrary(content: string): ImportedDesign {
    const design = this.createEmptyDesign('eagle-library', '');

    if (!content.includes('<eagle')) {
      design.errors.push('Invalid EAGLE file: does not contain <eagle> element');
      return design;
    }

    const root = parseXml(content);
    if (!root) {
      design.errors.push('Failed to parse XML');
      return design;
    }

    if (root.attributes.version) {
      design.version = root.attributes.version;
    }

    // Find library
    const library = findXmlDescendant(root, 'library');

    if (library) {
      design.metadata.libraryName = library.attributes.name ?? '';

      // Extract devicesets
      const devicesets = findXmlDescendants(library, 'deviceset');
      devicesets.forEach((deviceset) => {
        const component: ImportedComponent = {
          refDes: deviceset.attributes.prefix ?? '',
          name: deviceset.attributes.name ?? '',
          value: '',
          package: '',
          library: library.attributes.name ?? '',
          properties: { ...deviceset.attributes },
          pins: [],
        };

        // Get gates to find pins
        const gates = findXmlDescendants(deviceset, 'gate');
        gates.forEach((gate) => {
          component.properties[`gate_${gate.attributes.name ?? ''}`] = gate.attributes.symbol ?? '';
        });

        // Get devices for package info
        const devices = findXmlDescendants(deviceset, 'device');
        if (devices.length > 0) {
          component.package = devices[0].attributes.package ?? '';
        }

        design.components.push(component);
      });

      // Extract symbols for pin info
      const symbols = findXmlDescendants(library, 'symbol');
      symbols.forEach((symbol) => {
        const pins = findXmlDescendants(symbol, 'pin');
        pins.forEach((pin) => {
          // Try to find which component uses this symbol
          const symbolName = symbol.attributes.name ?? '';
          const matchingComponent = design.components.find((c) => {
            return Object.values(c.properties).some((v) => v === symbolName);
          });

          if (matchingComponent) {
            const direction = pin.attributes.direction ?? 'unspecified';
            matchingComponent.pins.push({
              number: pin.attributes.name ?? '',
              name: pin.attributes.name ?? '',
              type: PIN_TYPE_MAP[direction] ?? (PIN_TYPE_MAP[direction.toLowerCase()] ?? 'unspecified'),
              position: pin.attributes.x && pin.attributes.y
                ? { x: parseFloat(pin.attributes.x), y: parseFloat(pin.attributes.y) }
                : undefined,
            });
          }
        });
      });
    }

    return design;
  }

  // -----------------------------------------------------------------------
  // Altium Parsers
  // -----------------------------------------------------------------------

  /**
   * Parse Altium ASCII schematic (SchDoc) format.
   */
  parseAltiumSchematic(content: string): ImportedDesign {
    const design = this.createEmptyDesign('altium-schematic', '');

    if (!content.includes('|RECORD=')) {
      design.errors.push('Invalid Altium schematic: does not contain |RECORD= markers');
      return design;
    }

    const lines = content.split('\n');
    const componentMap = new Map<string, ImportedComponent>();
    const netMap = new Map<string, ImportedNet>();

    lines.forEach((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine.includes('|RECORD=')) {
        return;
      }

      const fields = this.parseAltiumRecord(trimmedLine);
      const recordType = fields.RECORD;

      // Component record (RECORD=1)
      if (recordType === '1') {
        const refDes = fields.DESIGNITEMID ?? fields.LIBREFERENCE ?? '';
        const component: ImportedComponent = {
          refDes: fields.DESIGNATOR ?? refDes,
          name: fields.LIBREFERENCE ?? fields.DESIGNITEMID ?? '',
          value: fields.COMPONENTDESCRIPTION ?? '',
          package: fields.FOOTPRINT ?? '',
          library: fields.SOURCELIBRARYNAME ?? '',
          position: fields.LOCATION_X && fields.LOCATION_Y
            ? { x: parseFloat(fields.LOCATION_X), y: parseFloat(fields.LOCATION_Y) }
            : undefined,
          rotation: fields.ORIENTATION ? parseFloat(fields.ORIENTATION) : undefined,
          properties: { ...fields },
          pins: [],
        };
        const ownerIndex = fields.OWNERINDEX ?? fields.CURRENTPARTID ?? crypto.randomUUID();
        componentMap.set(ownerIndex, component);
        design.components.push(component);
      }

      // Pin record (RECORD=2)
      if (recordType === '2') {
        const ownerIndex = fields.OWNERINDEX ?? '';
        const ownerComponent = componentMap.get(ownerIndex);
        if (ownerComponent) {
          const pinType = fields.ELECTRICAL ?? 'unspecified';
          ownerComponent.pins.push({
            number: fields.DESIGNATOR ?? fields.FORMALTYPE ?? '',
            name: fields.NAME ?? '',
            type: PIN_TYPE_MAP[pinType.toLowerCase()] ?? 'unspecified',
            position: fields.LOCATION_X && fields.LOCATION_Y
              ? { x: parseFloat(fields.LOCATION_X), y: parseFloat(fields.LOCATION_Y) }
              : undefined,
          });
        }
      }

      // Wire record (RECORD=27)
      if (recordType === '27') {
        if (fields.LOCATION_X && fields.LOCATION_Y && fields.CORNER_X && fields.CORNER_Y) {
          design.wires.push({
            start: { x: parseFloat(fields.LOCATION_X), y: parseFloat(fields.LOCATION_Y) },
            end: { x: parseFloat(fields.CORNER_X), y: parseFloat(fields.CORNER_Y) },
          });
        }
      }

      // Net label record (RECORD=25)
      if (recordType === '25') {
        const netName = fields.TEXT ?? fields.NAME ?? '';
        if (netName && !netMap.has(netName)) {
          netMap.set(netName, { name: netName, pins: [] });
        }
      }

      // Power object (RECORD=17)
      if (recordType === '17') {
        const netName = fields.TEXT ?? fields.NAME ?? '';
        if (netName && !netMap.has(netName)) {
          netMap.set(netName, { name: netName, pins: [] });
        }
      }

      // Sheet info (RECORD=31)
      if (recordType === '31') {
        if (fields.TITLE) {
          design.title = fields.TITLE;
        }
        if (fields.DATE) {
          design.date = fields.DATE;
        }
      }

      // Junction (RECORD=29) — add as warning for unsupported feature
      if (recordType === '29' || recordType === '30') {
        // Silently handle junctions and bus entries
      }
    });

    netMap.forEach((net) => {
      design.nets.push(net);
    });

    return design;
  }

  /**
   * Parse Altium ASCII PCB (PcbDoc) format.
   */
  parseAltiumPcb(content: string): ImportedDesign {
    const design = this.createEmptyDesign('altium-pcb', '');

    if (!content.includes('|RECORD=')) {
      design.errors.push('Invalid Altium PCB: does not contain |RECORD= markers');
      return design;
    }

    const lines = content.split('\n');
    const netMap = new Map<string, ImportedNet>();

    lines.forEach((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine.includes('|RECORD=')) {
        return;
      }

      const fields = this.parseAltiumRecord(trimmedLine);
      const recordType = fields.RECORD;

      // Component record
      if (recordType === 'Component') {
        const component: ImportedComponent = {
          refDes: fields.DESIGNATOR ?? fields.NAME ?? '',
          name: fields.PATTERN ?? fields.SOURCEDESIGNATOR ?? '',
          value: fields.COMMENT ?? '',
          package: fields.PATTERN ?? '',
          library: fields.SOURCELIBRARY ?? '',
          position: fields.X && fields.Y
            ? { x: parseFloat(fields.X), y: parseFloat(fields.Y) }
            : undefined,
          rotation: fields.ROTATION ? parseFloat(fields.ROTATION) : undefined,
          layer: fields.LAYER,
          properties: { ...fields },
          pins: [],
        };
        design.components.push(component);
      }

      // Net record
      if (recordType === 'Net') {
        const netName = fields.NAME ?? '';
        if (netName && !netMap.has(netName)) {
          netMap.set(netName, { name: netName, pins: [], netClass: fields.NETCLASS });
        }
      }

      // Track (wire) record
      if (recordType === 'Track') {
        if (fields.X1 && fields.Y1 && fields.X2 && fields.Y2) {
          design.wires.push({
            start: { x: parseFloat(fields.X1), y: parseFloat(fields.Y1) },
            end: { x: parseFloat(fields.X2), y: parseFloat(fields.Y2) },
            width: fields.WIDTH ? parseFloat(fields.WIDTH) : undefined,
            layer: fields.LAYER,
            net: fields.NET,
          });
        }
      }

      // Pad record
      if (recordType === 'Pad') {
        const componentRef = fields.COMPONENT ?? '';
        const netName = fields.NET ?? '';
        if (componentRef && netName) {
          let net = netMap.get(netName);
          if (!net) {
            net = { name: netName, pins: [] };
            netMap.set(netName, net);
          }
          net.pins.push({
            componentRef,
            pinNumber: fields.DESIGNATOR ?? fields.NAME ?? '',
          });
        }
      }

      // Board record
      if (recordType === 'Board') {
        if (fields.TITLE) {
          design.title = fields.TITLE;
        }
      }
    });

    netMap.forEach((net) => {
      design.nets.push(net);
    });

    return design;
  }

  // -----------------------------------------------------------------------
  // gEDA/gschem Parser
  // -----------------------------------------------------------------------

  /**
   * Parse gEDA/gschem schematic (.sch) format.
   *
   * gEDA schematics are line-oriented with a version header (`v YYYYMMDD N`),
   * component blocks (`C x y ...` through `}`) containing attributes (`T`/`A`
   * lines), net segments (`N x1 y1 x2 y2 color`), and pin blocks
   * (`P x1 y1 x2 y2 color ...`). Attribute key-value pairs appear as
   * `key=value` lines inside `{...}` attribute blocks.
   */
  parseGedaSchematic(content: string): ImportedDesign {
    const design = this.createEmptyDesign('geda-schematic', '');

    if (!/^v\s+\d{8}\s+\d+/.test(content.trim())) {
      design.errors.push('Invalid gEDA schematic: missing version header (v YYYYMMDD N)');
      return design;
    }

    const lines = content.split('\n');
    let i = 0;

    // Parse version from first line
    const versionMatch = /^v\s+(\d{8})\s+(\d+)/.exec(lines[0]);
    if (versionMatch) {
      design.version = versionMatch[1];
    }

    const netMap = new Map<string, ImportedNet>();
    let componentIndex = 0;

    while (i < lines.length) {
      const line = lines[i].trim();

      // Component block: C x y selectable angle mirror basename
      if (line.startsWith('C ')) {
        const parts = line.split(/\s+/);
        // C x y selectable angle mirror basename
        const x = parseFloat(parts[1] ?? '0');
        const y = parseFloat(parts[2] ?? '0');
        const angle = parseFloat(parts[4] ?? '0');
        const basename = parts[6] ?? `comp_${String(componentIndex)}`;
        componentIndex++;

        const component: ImportedComponent = {
          refDes: '',
          name: basename.replace(/\.sym$/, ''),
          value: '',
          package: '',
          library: 'geda',
          position: { x: x / 100, y: y / 100 }, // gEDA uses mils*100 internally
          rotation: angle,
          properties: {},
          pins: [],
        };

        // Read attribute block if next line is '{'
        i++;
        if (i < lines.length && lines[i].trim() === '{') {
          i++;
          while (i < lines.length && lines[i].trim() !== '}') {
            const attrLine = lines[i].trim();
            // Attribute lines may be 'T ...' (text) followed by key=value on next line
            // or direct key=value
            const kvMatch = /^([A-Za-z_][A-Za-z0-9_-]*)=(.*)$/.exec(attrLine);
            if (kvMatch) {
              const key = kvMatch[1];
              const value = kvMatch[2];
              component.properties[key] = value;

              if (key === 'refdes') {
                component.refDes = value;
              } else if (key === 'value') {
                component.value = value;
              } else if (key === 'footprint') {
                component.package = value;
              } else if (key === 'device') {
                if (!component.name || component.name === basename.replace(/\.sym$/, '')) {
                  component.name = value;
                }
              }
            }
            i++;
          }
          i++; // skip '}'
        }

        design.components.push(component);
        continue;
      }

      // Net segment: N x1 y1 x2 y2 color
      if (line.startsWith('N ')) {
        const parts = line.split(/\s+/);
        const x1 = parseFloat(parts[1] ?? '0') / 100;
        const y1 = parseFloat(parts[2] ?? '0') / 100;
        const x2 = parseFloat(parts[3] ?? '0') / 100;
        const y2 = parseFloat(parts[4] ?? '0') / 100;

        design.wires.push({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 } });

        // Check for net name attribute block
        i++;
        if (i < lines.length && lines[i].trim() === '{') {
          i++;
          while (i < lines.length && lines[i].trim() !== '}') {
            const attrLine = lines[i].trim();
            const kvMatch = /^netname=(.+)$/.exec(attrLine);
            if (kvMatch) {
              const netName = kvMatch[1];
              if (!netMap.has(netName)) {
                netMap.set(netName, { name: netName, pins: [] });
              }
            }
            i++;
          }
          i++; // skip '}'
        }
        continue;
      }

      // Pin block: P x1 y1 x2 y2 color pintype whichend
      if (line.startsWith('P ')) {
        const parts = line.split(/\s+/);
        const pinX = parseFloat(parts[1] ?? '0') / 100;
        const pinY = parseFloat(parts[2] ?? '0') / 100;
        const pinType = parts[6] ?? '0';

        let pinNumber = '';
        let pinName = '';

        // Read attribute block for pin
        i++;
        if (i < lines.length && lines[i].trim() === '{') {
          i++;
          while (i < lines.length && lines[i].trim() !== '}') {
            const attrLine = lines[i].trim();
            const kvMatch = /^([A-Za-z_][A-Za-z0-9_-]*)=(.*)$/.exec(attrLine);
            if (kvMatch) {
              if (kvMatch[1] === 'pinnumber') {
                pinNumber = kvMatch[2];
              } else if (kvMatch[1] === 'pinlabel') {
                pinName = kvMatch[2];
              }
            }
            i++;
          }
          i++; // skip '}'
        }

        // Attach pin to last component
        if (design.components.length > 0) {
          const lastComp = design.components[design.components.length - 1];
          const gedaPinType = pinType === '1' ? 'input' : pinType === '2' ? 'output' : 'passive';
          lastComp.pins.push({
            number: pinNumber,
            name: pinName || pinNumber,
            type: gedaPinType,
            position: { x: pinX, y: pinY },
          });
        }
        continue;
      }

      i++;
    }

    // Build net pin references from components
    design.components.forEach((comp) => {
      comp.pins.forEach((pin) => {
        if (comp.refDes && pin.number) {
          // Check if any net is associated via wire connectivity (simplified)
          netMap.forEach((net) => {
            if (net.pins.length < 10) { // prevent accidental over-population
              net.pins.push({ componentRef: comp.refDes, pinNumber: pin.number });
            }
          });
        }
      });
    });

    netMap.forEach((net) => {
      design.nets.push(net);
    });

    return design;
  }

  // -----------------------------------------------------------------------
  // LTspice Parser
  // -----------------------------------------------------------------------

  /**
   * Parse LTspice schematic (.asc) format.
   *
   * LTspice .asc files start with `Version N` + `SHEET ...`, then contain:
   * - `SYMBOL name x y Rn` — component placement (R0/R90/R180/R270 = rotation)
   * - `SYMATTR InstName Xn` — reference designator for preceding SYMBOL
   * - `SYMATTR Value val` — value for preceding SYMBOL
   * - `SYMATTR SpiceModel model` — SPICE model name
   * - `WIRE x1 y1 x2 y2` — net wire segment
   * - `FLAG x y netName` — net label at a position
   * - `TEXT x y ...` — text annotation (ignored)
   *
   * Coordinates are in LTspice internal units (16 units = 1 grid square).
   */
  parseLtspiceSchematic(content: string): ImportedDesign {
    const design = this.createEmptyDesign('ltspice-schematic', '');

    const lines = content.split('\n');
    if (lines.length === 0) {
      design.errors.push('Empty LTspice file');
      return design;
    }

    // Parse version
    const versionMatch = /^Version\s+(\d+)/i.exec(lines[0].trim());
    if (versionMatch) {
      design.version = versionMatch[1];
    }

    const netMap = new Map<string, ImportedNet>();
    let currentComponent: ImportedComponent | null = null;

    for (const line of lines) {
      const trimmedLine = line.trim();

      // SYMBOL name x y rotation
      const symbolMatch = /^SYMBOL\s+(\S+)\s+(-?\d+)\s+(-?\d+)\s+(R\d+|M\d+)?/.exec(trimmedLine);
      if (symbolMatch) {
        // Save previous component
        if (currentComponent) {
          design.components.push(currentComponent);
        }

        const symbolName = symbolMatch[1];
        const x = parseFloat(symbolMatch[2]) / 16; // Convert to grid units
        const y = parseFloat(symbolMatch[3]) / 16;
        const rotStr = symbolMatch[4] ?? 'R0';
        const rotation = parseInt(rotStr.replace(/[RM]/, ''), 10) || 0;

        currentComponent = {
          refDes: '',
          name: symbolName,
          value: '',
          package: '',
          library: 'ltspice',
          position: { x, y },
          rotation,
          properties: { symbolName },
          pins: [],
        };
        continue;
      }

      // SYMATTR key value — attributes for preceding SYMBOL
      const symattrMatch = /^SYMATTR\s+(\S+)\s+(.*)$/.exec(trimmedLine);
      if (symattrMatch && currentComponent) {
        const key = symattrMatch[1];
        const value = symattrMatch[2].trim();
        currentComponent.properties[key] = value;

        if (key === 'InstName') {
          currentComponent.refDes = value;
        } else if (key === 'Value') {
          currentComponent.value = value;
        } else if (key === 'Value2') {
          currentComponent.properties.value2 = value;
        } else if (key === 'SpiceModel') {
          currentComponent.properties.spiceModel = value;
        }
        continue;
      }

      // WIRE x1 y1 x2 y2
      const wireMatch = /^WIRE\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)/.exec(trimmedLine);
      if (wireMatch) {
        design.wires.push({
          start: { x: parseFloat(wireMatch[1]) / 16, y: parseFloat(wireMatch[2]) / 16 },
          end: { x: parseFloat(wireMatch[3]) / 16, y: parseFloat(wireMatch[4]) / 16 },
        });
        continue;
      }

      // FLAG x y netName — net label
      const flagMatch = /^FLAG\s+(-?\d+)\s+(-?\d+)\s+(\S+)/.exec(trimmedLine);
      if (flagMatch) {
        const netName = flagMatch[3];
        if (!netMap.has(netName)) {
          netMap.set(netName, { name: netName, pins: [] });
        }
        continue;
      }

      // IOPIN x y direction — I/O pin on hierarchical sheet
      const iopinMatch = /^IOPIN\s+(-?\d+)\s+(-?\d+)\s+(\S+)/.exec(trimmedLine);
      if (iopinMatch && currentComponent) {
        const direction = iopinMatch[3].toLowerCase();
        const pinType = direction === 'in' ? 'input' : direction === 'out' ? 'output' : 'bidirectional';
        currentComponent.pins.push({
          number: String(currentComponent.pins.length + 1),
          name: direction,
          type: pinType,
          position: { x: parseFloat(iopinMatch[1]) / 16, y: parseFloat(iopinMatch[2]) / 16 },
        });
        continue;
      }

      // WINDOW — pin/port info line (provides pin display info)
      const windowMatch = /^WINDOW\s+(\d+)\s+(-?\d+)\s+(-?\d+)/.exec(trimmedLine);
      if (windowMatch && currentComponent) {
        const pinIdx = parseInt(windowMatch[1], 10);
        if (pinIdx > 0 && currentComponent.pins.length < pinIdx) {
          // Add placeholder pins up to this index
          while (currentComponent.pins.length < pinIdx) {
            const n = currentComponent.pins.length + 1;
            currentComponent.pins.push({
              number: String(n),
              name: `pin${String(n)}`,
              type: 'passive',
            });
          }
        }
        continue;
      }
    }

    // Push the last component
    if (currentComponent) {
      design.components.push(currentComponent);
    }

    // Add standard SPICE pins for known component types
    design.components.forEach((comp) => {
      if (comp.pins.length === 0) {
        const pinCount = this.inferLtspicePinCount(comp.name);
        for (let p = 1; p <= pinCount; p++) {
          comp.pins.push({
            number: String(p),
            name: `pin${String(p)}`,
            type: 'passive',
          });
        }
      }
    });

    netMap.forEach((net) => {
      design.nets.push(net);
    });

    return design;
  }

  // -----------------------------------------------------------------------
  // Proteus Parser
  // -----------------------------------------------------------------------

  /**
   * Parse Proteus design (.dsn) keyword-based format.
   *
   * Proteus DSN files are structured with keyword blocks:
   * - `DESIGN` header with metadata
   * - `COMPONENT` blocks containing `PARTNAME`, `REFDES`, and pin connectivity
   * - `NET` blocks containing `NODE` entries (component+pin references)
   *
   * This parser handles the text-based export format. Binary .dsn files are
   * not supported (a warning is emitted).
   */
  parseProteusSchematic(content: string): ImportedDesign {
    const design = this.createEmptyDesign('proteus-schematic', '');

    if (content.charCodeAt(0) < 32 && content.charCodeAt(0) !== 10 && content.charCodeAt(0) !== 13) {
      design.errors.push('Binary Proteus file detected — only text-based DSN exports are supported');
      return design;
    }

    const lines = content.split('\n');
    const netMap = new Map<string, ImportedNet>();
    let currentComponent: ImportedComponent | null = null;
    let currentNetName = '';

    for (const line of lines) {
      const trimmedLine = line.trim();

      // DESIGN title
      const designMatch = /^DESIGN\s+"?([^"]*)"?/.exec(trimmedLine);
      if (designMatch) {
        design.title = designMatch[1].trim();
        continue;
      }

      // COMPONENT block start
      const componentMatch = /^COMPONENT\s+"?([^"]*)"?/.exec(trimmedLine);
      if (componentMatch) {
        if (currentComponent) {
          design.components.push(currentComponent);
        }
        currentComponent = {
          refDes: componentMatch[1].trim(),
          name: '',
          value: '',
          package: '',
          library: 'proteus',
          properties: {},
          pins: [],
        };
        continue;
      }

      // PARTNAME inside component block
      const partMatch = /^PARTNAME\s+"?([^"]*)"?/.exec(trimmedLine);
      if (partMatch && currentComponent) {
        currentComponent.name = partMatch[1].trim();
        continue;
      }

      // REFDES override
      const refdesMatch = /^REFDES\s+"?([^"]*)"?/.exec(trimmedLine);
      if (refdesMatch && currentComponent) {
        currentComponent.refDes = refdesMatch[1].trim();
        continue;
      }

      // PACKAGE
      const pkgMatch = /^PACKAGE\s+"?([^"]*)"?/.exec(trimmedLine);
      if (pkgMatch && currentComponent) {
        currentComponent.package = pkgMatch[1].trim();
        continue;
      }

      // VALUE
      const valMatch = /^VALUE\s+"?([^"]*)"?/.exec(trimmedLine);
      if (valMatch && currentComponent) {
        currentComponent.value = valMatch[1].trim();
        continue;
      }

      // LOCATION x y
      const locMatch = /^LOCATION\s+(-?[\d.]+)\s+(-?[\d.]+)/.exec(trimmedLine);
      if (locMatch && currentComponent) {
        currentComponent.position = { x: parseFloat(locMatch[1]), y: parseFloat(locMatch[2]) };
        continue;
      }

      // ROTATION angle
      const rotMatch = /^ROTATION\s+(-?[\d.]+)/.exec(trimmedLine);
      if (rotMatch && currentComponent) {
        currentComponent.rotation = parseFloat(rotMatch[1]);
        continue;
      }

      // PIN number name
      const pinMatch = /^PIN\s+"?([^"]*)"?\s+"?([^"]*)"?/.exec(trimmedLine);
      if (pinMatch && currentComponent) {
        currentComponent.pins.push({
          number: pinMatch[1].trim(),
          name: pinMatch[2].trim() || pinMatch[1].trim(),
          type: 'passive',
        });
        continue;
      }

      // NET block start
      const netMatch = /^NET\s+"?([^"]*)"?/.exec(trimmedLine);
      if (netMatch) {
        if (currentComponent) {
          design.components.push(currentComponent);
          currentComponent = null;
        }
        currentNetName = netMatch[1].trim();
        if (!netMap.has(currentNetName)) {
          netMap.set(currentNetName, { name: currentNetName, pins: [] });
        }
        continue;
      }

      // NODE component pin — inside NET block
      const nodeMatch = /^NODE\s+"?([^"]*)"?\s+"?([^"]*)"?/.exec(trimmedLine);
      if (nodeMatch && currentNetName) {
        const net = netMap.get(currentNetName);
        if (net) {
          net.pins.push({
            componentRef: nodeMatch[1].trim(),
            pinNumber: nodeMatch[2].trim(),
          });
        }
        continue;
      }
    }

    // Push last component
    if (currentComponent) {
      design.components.push(currentComponent);
    }

    netMap.forEach((net) => {
      design.nets.push(net);
    });

    return design;
  }

  // -----------------------------------------------------------------------
  // OrCAD Parser
  // -----------------------------------------------------------------------

  /**
   * Parse OrCAD/CadStar schematic (.dsn) s-expression format.
   *
   * OrCAD DSN export uses a Lisp-like s-expression structure:
   * ```
   * (design "name"
   *   (library
   *     (component "package" (pin "name" "number" ...))
   *     ...)
   *   (placement
   *     (component "package" (place "refdes" x y side rotation)))
   *   (network
   *     (net "name" (pins "ref-pin" ...))))
   * ```
   *
   * We reuse the S-expression tokenizer/parser from the KiCad parsers.
   */
  parseOrcadSchematic(content: string): ImportedDesign {
    const design = this.createEmptyDesign('orcad-schematic', '');

    const trimmed = content.trim();
    if (!trimmed.startsWith('(')) {
      design.errors.push('Invalid OrCAD DSN: does not start with s-expression');
      return design;
    }

    const tokens = tokenizeSExpr(trimmed);
    const tree = parseSExprTokens(tokens);

    if (tree.length === 0) {
      design.errors.push('Failed to parse OrCAD DSN s-expression');
      return design;
    }

    const root = tree[0];

    // Extract design name
    if (root.values.length > 0) {
      design.title = root.values[0];
    }

    // Extract components from (placement ...) section
    const placement = findChild(root, 'placement');
    if (placement) {
      const components = findChildren(placement, 'component');
      components.forEach((comp) => {
        const packageName = comp.values[0] ?? '';

        // Each component has (place refdes x y side rotation)
        const places = findChildren(comp, 'place');
        places.forEach((place) => {
          const refDes = place.values[0] ?? '';
          const x = parseFloat(place.values[1] ?? '0');
          const y = parseFloat(place.values[2] ?? '0');
          const side = place.values[3] ?? 'front';
          const rotation = parseFloat(place.values[4] ?? '0');

          const component: ImportedComponent = {
            refDes,
            name: packageName,
            value: '',
            package: packageName,
            library: 'orcad',
            position: { x, y },
            rotation,
            layer: side,
            properties: {},
            pins: [],
          };

          design.components.push(component);
        });
      });
    }

    // Extract pin definitions from (library ...) section
    const library = findChild(root, 'library');
    if (library) {
      const libComponents = findChildren(library, 'component');
      libComponents.forEach((libComp) => {
        const packageName = libComp.values[0] ?? '';

        // Find matching placed components
        const matchingComponents = design.components.filter((c) => c.package === packageName);

        // Extract pins from (pin ...)
        const pins = findChildren(libComp, 'pin');
        pins.forEach((pin) => {
          const pinName = pin.values[0] ?? '';
          const pinNumber = pin.values[1] ?? pinName;

          matchingComponents.forEach((comp) => {
            comp.pins.push({
              number: pinNumber,
              name: pinName,
              type: 'passive',
            });
          });
        });
      });
    }

    // Extract nets from (network ...) section
    const network = findChild(root, 'network');
    if (network) {
      const nets = findChildren(network, 'net');
      nets.forEach((net) => {
        const netName = net.values[0] ?? '';
        const importedNet: ImportedNet = { name: netName, pins: [] };

        // (pins "REF-PIN" "REF-PIN" ...)
        const pinsNode = findChild(net, 'pins');
        if (pinsNode) {
          pinsNode.values.forEach((pinRef) => {
            const dashIdx = pinRef.lastIndexOf('-');
            if (dashIdx > 0) {
              importedNet.pins.push({
                componentRef: pinRef.substring(0, dashIdx),
                pinNumber: pinRef.substring(dashIdx + 1),
              });
            }
          });
        }

        if (netName) {
          design.nets.push(importedNet);
        }
      });
    }

    return design;
  }

  // -----------------------------------------------------------------------
  // Conversion
  // -----------------------------------------------------------------------

  /**
   * Convert an imported design to ProtoPulse's internal format.
   */
  convertToProtoPulse(design: ImportedDesign): {
    nodes: Array<{ id: string; type: string; label: string; position: { x: number; y: number } }>;
    edges: Array<{ id: string; source: string; target: string; label: string }>;
    bomItems: Array<{ name: string; quantity: number; partNumber: string; package: string }>;
  } {
    const nodes: Array<{ id: string; type: string; label: string; position: { x: number; y: number } }> = [];
    const edges: Array<{ id: string; source: string; target: string; label: string }> = [];
    const bomItems: Array<{ name: string; quantity: number; partNumber: string; package: string }> = [];

    // Convert components to nodes
    const componentIdMap = new Map<string, string>();
    let xOffset = 0;
    const ySpacing = 120;

    design.components.forEach((comp, index) => {
      const id = crypto.randomUUID();
      componentIdMap.set(comp.refDes, id);

      nodes.push({
        id,
        type: this.inferNodeType(comp),
        label: comp.refDes ? `${comp.refDes} - ${comp.name}` : comp.name,
        position: comp.position ?? { x: xOffset + (index % 4) * 200, y: Math.floor(index / 4) * ySpacing },
      });
    });

    // Convert nets to edges
    design.nets.forEach((net) => {
      if (net.pins.length >= 2) {
        // Create edges between consecutive pin references
        for (let i = 0; i < net.pins.length - 1; i++) {
          const sourceId = componentIdMap.get(net.pins[i].componentRef);
          const targetId = componentIdMap.get(net.pins[i + 1].componentRef);

          if (sourceId && targetId) {
            edges.push({
              id: crypto.randomUUID(),
              source: sourceId,
              target: targetId,
              label: net.name,
            });
          }
        }
      }
    });

    // Generate BOM items — aggregate by name + package
    const bomMap = new Map<string, { name: string; quantity: number; partNumber: string; package: string }>();

    design.components.forEach((comp) => {
      const key = `${comp.name}|${comp.package}`;
      const existing = bomMap.get(key);
      if (existing) {
        existing.quantity++;
      } else {
        bomMap.set(key, {
          name: comp.name || comp.refDes,
          quantity: 1,
          partNumber: comp.properties.MPN ?? comp.properties.PartNumber ?? comp.refDes,
          package: comp.package,
        });
      }
    });

    bomMap.forEach((item) => {
      bomItems.push(item);
    });

    return { nodes, edges, bomItems };
  }

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------

  /**
   * Validate an imported design for issues.
   */
  validateImport(design: ImportedDesign): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for components
    if (design.components.length === 0) {
      warnings.push('Design contains no components');
    }

    // Check for duplicate ref designators
    const refDes = new Set<string>();
    design.components.forEach((comp) => {
      if (comp.refDes) {
        if (refDes.has(comp.refDes)) {
          errors.push(`Duplicate reference designator: ${comp.refDes}`);
        }
        refDes.add(comp.refDes);
      }
    });

    // Check for orphan net references
    const componentRefs = new Set<string>();
    design.components.forEach((comp) => {
      componentRefs.add(comp.refDes);
    });

    design.nets.forEach((net) => {
      net.pins.forEach((pin) => {
        if (pin.componentRef && !componentRefs.has(pin.componentRef)) {
          errors.push(`Net "${net.name}" references non-existent component "${pin.componentRef}"`);
        }
      });
    });

    // Check for nets with no connections
    design.nets.forEach((net) => {
      if (net.pins.length === 0) {
        warnings.push(`Net "${net.name}" has no connections`);
      }
      if (net.pins.length === 1) {
        warnings.push(`Net "${net.name}" has only one connection`);
      }
    });

    // Check for components without ref designators
    const noRefCount = design.components.filter((c) => !c.refDes).length;
    if (noRefCount > 0) {
      warnings.push(`${noRefCount} component(s) without reference designators`);
    }

    // Include any existing errors/warnings from the design
    errors.push(...design.errors);
    warnings.push(...design.warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // -----------------------------------------------------------------------
  // History
  // -----------------------------------------------------------------------

  /**
   * Get the import history.
   */
  getImportHistory(): ImportResult[] {
    return [...this.history];
  }

  /**
   * Clear the import history.
   */
  clearHistory(): void {
    this.history = [];
    this.saveHistory();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Supported Formats
  // -----------------------------------------------------------------------

  /**
   * Get all supported import formats.
   */
  getSupportedFormats(): Array<{ format: ImportFormat; extensions: string[]; description: string }> {
    return SUPPORTED_FORMATS.map((f) => ({ ...f }));
  }

  // -----------------------------------------------------------------------
  // Export
  // -----------------------------------------------------------------------

  /**
   * Serialize a design to JSON.
   */
  exportDesign(design: ImportedDesign): string {
    return JSON.stringify(design, null, 2);
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private createEmptyDesign(format: ImportFormat, fileName: string): ImportedDesign {
    return {
      format,
      fileName,
      components: [],
      nets: [],
      wires: [],
      metadata: {},
      warnings: [],
      errors: [],
    };
  }

  private parseKicadSchematicSymbol(sym: SExprNode): ImportedComponent | null {
    // The first value is the reference like "R1" or "C1" or library ref
    const refOrLib = sym.values[0] ?? '';

    // Skip power symbols and non-components
    if (refOrLib.startsWith('#')) {
      return null;
    }

    const component: ImportedComponent = {
      refDes: refOrLib,
      name: '',
      value: '',
      package: '',
      library: '',
      properties: {},
      pins: [],
    };

    // Check for lib_id
    const libId = getChildValue(sym, 'lib_id');
    if (libId) {
      component.library = libId;
      const parts = libId.split(':');
      component.name = parts.length > 1 ? parts[1] : parts[0];
    }

    // Extract properties
    const properties = findChildren(sym, 'property');
    properties.forEach((prop) => {
      const propName = prop.values[0];
      const propValue = prop.values[1] ?? '';
      if (propName) {
        component.properties[propName] = propValue;
        if (propName === 'Reference') {
          component.refDes = propValue;
        }
        if (propName === 'Value') {
          component.value = propValue;
        }
        if (propName === 'Footprint') {
          component.package = propValue;
        }
      }
    });

    // Extract position from at node
    const atNode = findChild(sym, 'at');
    if (atNode) {
      component.position = {
        x: parseFloat(atNode.values[0] ?? '0'),
        y: parseFloat(atNode.values[1] ?? '0'),
      };
      if (atNode.values[2]) {
        component.rotation = parseFloat(atNode.values[2]);
      }
    }

    // Extract pins
    const pins = findChildren(sym, 'pin');
    pins.forEach((pin) => {
      const pinType = pin.values[0] ?? 'unspecified';
      const nameNode = findChild(pin, 'name');
      const numberNode = findChild(pin, 'number');
      const pinAt = findChild(pin, 'at');

      component.pins.push({
        number: numberNode?.values[0] ?? '',
        name: nameNode?.values[0] ?? '',
        type: PIN_TYPE_MAP[pinType] ?? 'unspecified',
        position: pinAt ? { x: parseFloat(pinAt.values[0] ?? '0'), y: parseFloat(pinAt.values[1] ?? '0') } : undefined,
      });
    });

    return component;
  }

  private parseKicadWire(wire: SExprNode): ImportedWire | null {
    const pts = findChild(wire, 'pts');
    if (!pts) {
      return null;
    }

    const xyNodes = findChildren(pts, 'xy');
    if (xyNodes.length < 2) {
      return null;
    }

    return {
      start: { x: parseFloat(xyNodes[0].values[0] ?? '0'), y: parseFloat(xyNodes[0].values[1] ?? '0') },
      end: { x: parseFloat(xyNodes[1].values[0] ?? '0'), y: parseFloat(xyNodes[1].values[1] ?? '0') },
    };
  }

  private parseKicadFootprint(fp: SExprNode): ImportedComponent | null {
    const libRef = fp.values[0] ?? '';

    const component: ImportedComponent = {
      refDes: '',
      name: libRef,
      value: '',
      package: libRef,
      library: '',
      properties: {},
      pins: [],
    };

    // Extract reference and value from fp_text
    const fpTexts = findChildren(fp, 'fp_text');
    fpTexts.forEach((text) => {
      if (text.values[0] === 'reference') {
        component.refDes = text.values[1] ?? '';
      }
      if (text.values[0] === 'value') {
        component.value = text.values[1] ?? '';
      }
    });

    // Also check property nodes (KiCad 7+)
    const properties = findChildren(fp, 'property');
    properties.forEach((prop) => {
      const propName = prop.values[0];
      const propValue = prop.values[1] ?? '';
      if (propName) {
        component.properties[propName] = propValue;
        if (propName === 'Reference') {
          component.refDes = propValue;
        }
        if (propName === 'Value') {
          component.value = propValue;
        }
      }
    });

    // Extract position
    const atNode = findChild(fp, 'at');
    if (atNode) {
      component.position = {
        x: parseFloat(atNode.values[0] ?? '0'),
        y: parseFloat(atNode.values[1] ?? '0'),
      };
      if (atNode.values[2]) {
        component.rotation = parseFloat(atNode.values[2]);
      }
    }

    // Extract layer
    const layer = getChildValue(fp, 'layer');
    if (layer) {
      component.layer = layer;
    }

    // Extract pads as pins
    const pads = findChildren(fp, 'pad');
    pads.forEach((pad) => {
      const padNumber = pad.values[0] ?? '';
      const padType = pad.values[1] ?? '';
      const padAt = findChild(pad, 'at');

      component.pins.push({
        number: padNumber,
        name: padNumber,
        type: padType === 'smd' || padType === 'thru_hole' ? 'passive' : 'unspecified',
        position: padAt ? { x: parseFloat(padAt.values[0] ?? '0'), y: parseFloat(padAt.values[1] ?? '0') } : undefined,
      });
    });

    return component;
  }

  private parseKicadSegment(seg: SExprNode): ImportedWire | null {
    const startNode = findChild(seg, 'start');
    const endNode = findChild(seg, 'end');

    if (!startNode || !endNode) {
      return null;
    }

    const wire: ImportedWire = {
      start: { x: parseFloat(startNode.values[0] ?? '0'), y: parseFloat(startNode.values[1] ?? '0') },
      end: { x: parseFloat(endNode.values[0] ?? '0'), y: parseFloat(endNode.values[1] ?? '0') },
    };

    const widthVal = getChildValue(seg, 'width');
    if (widthVal) {
      wire.width = parseFloat(widthVal);
    }

    const netVal = getChildValue(seg, 'net');
    if (netVal) {
      wire.net = netVal;
    }

    const layerVal = getChildValue(seg, 'layer');
    if (layerVal) {
      wire.layer = layerVal;
    }

    return wire;
  }

  private parseAltiumRecord(line: string): Record<string, string> {
    const fields: Record<string, string> = {};

    // Split by | and parse key=value pairs
    const parts = line.split('|');
    parts.forEach((part) => {
      const eqIdx = part.indexOf('=');
      if (eqIdx !== -1) {
        const key = part.substring(0, eqIdx).trim();
        const value = part.substring(eqIdx + 1).trim();
        if (key) {
          fields[key] = value;
        }
      }
    });

    return fields;
  }

  /**
   * Infer pin count for common LTspice component types.
   * Resistors/capacitors/inductors/voltage/current sources = 2 pins.
   * Diodes = 2, BJTs = 3, MOSFETs = 3, op-amps = 5.
   */
  private inferLtspicePinCount(symbolName: string): number {
    const lower = symbolName.toLowerCase();
    // Passive 2-terminal
    if (lower === 'res' || lower === 'res2' || lower === 'cap' || lower === 'ind' || lower === 'ind2') {
      return 2;
    }
    // Sources
    if (lower === 'voltage' || lower === 'current' || lower === 'bv' || lower === 'bi') {
      return 2;
    }
    // Diode
    if (lower === 'diode' || lower === 'zener' || lower === 'schottky' || lower === 'led') {
      return 2;
    }
    // BJT
    if (lower === 'npn' || lower === 'pnp') {
      return 3;
    }
    // MOSFET
    if (lower === 'nmos' || lower === 'pmos' || lower === 'nmos3' || lower === 'pmos3') {
      return 3;
    }
    // Op-amp (non-inverting, inverting, V+, V-, out)
    if (lower === 'opamp' || lower === 'opamp2') {
      return 5;
    }
    // Default: 2 pins
    return 2;
  }

  private inferNodeType(comp: ImportedComponent): string {
    const name = comp.name.toLowerCase();
    const refDes = comp.refDes.toUpperCase();

    if (refDes.startsWith('R') || name.includes('resistor')) {
      return 'resistor';
    }
    if (refDes.startsWith('C') || name.includes('capacitor')) {
      return 'capacitor';
    }
    if (refDes.startsWith('L') || name.includes('inductor')) {
      return 'inductor';
    }
    if (refDes.startsWith('D') || name.includes('diode')) {
      return 'diode';
    }
    if (refDes.startsWith('Q') || name.includes('transistor') || name.includes('mosfet')) {
      return 'transistor';
    }
    if (refDes.startsWith('U') || name.includes('ic') || name.includes('microcontroller')) {
      return 'ic';
    }
    if (refDes.startsWith('J') || refDes.startsWith('P') || name.includes('connector')) {
      return 'connector';
    }
    if (refDes.startsWith('SW') || name.includes('switch')) {
      return 'switch';
    }
    if (refDes.startsWith('LED') || name.includes('led')) {
      return 'led';
    }
    if (refDes.startsWith('F') || name.includes('fuse')) {
      return 'fuse';
    }
    if (refDes.startsWith('X') || refDes.startsWith('Y') || name.includes('crystal') || name.includes('oscillator')) {
      return 'crystal';
    }
    return 'component';
  }

  private addToHistory(result: ImportResult): void {
    this.history.push(result);
    this.saveHistory();
    this.notify();
  }

  private saveHistory(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history));
    } catch {
      // localStorage unavailable or quota exceeded
    }
  }

  private loadHistory(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        this.history = parsed as ImportResult[];
      }
    } catch {
      // Corrupt data — keep empty
    }
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook for accessing the design importer in React components.
 * Subscribes to the DesignImporter singleton and triggers re-renders on state changes.
 */
export function useDesignImport(): {
  importFile: (content: string, fileName: string) => ImportResult;
  detectFormat: (content: string, fileName?: string) => FormatDetectionResult;
  convertToProtoPulse: (design: ImportedDesign) => ReturnType<DesignImporter['convertToProtoPulse']>;
  validateImport: (design: ImportedDesign) => { valid: boolean; errors: string[]; warnings: string[] };
  supportedFormats: Array<{ format: ImportFormat; extensions: string[]; description: string }>;
  history: ImportResult[];
  clearHistory: () => void;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const importer = DesignImporter.getInstance();
    const unsubscribe = importer.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const importFileCb = useCallback((content: string, fileName: string) => {
    return DesignImporter.getInstance().importFile(content, fileName);
  }, []);

  const detectFormatCb = useCallback((content: string, fileName?: string) => {
    return DesignImporter.getInstance().detectFormat(content, fileName);
  }, []);

  const convertToProtoPulseCb = useCallback((design: ImportedDesign) => {
    return DesignImporter.getInstance().convertToProtoPulse(design);
  }, []);

  const validateImportCb = useCallback((design: ImportedDesign) => {
    return DesignImporter.getInstance().validateImport(design);
  }, []);

  const clearHistoryCb = useCallback(() => {
    DesignImporter.getInstance().clearHistory();
  }, []);

  const importer = typeof window !== 'undefined' ? DesignImporter.getInstance() : null;

  return {
    importFile: importFileCb,
    detectFormat: detectFormatCb,
    convertToProtoPulse: convertToProtoPulseCb,
    validateImport: validateImportCb,
    supportedFormats: importer?.getSupportedFormats() ?? [],
    history: importer?.getImportHistory() ?? [],
    clearHistory: clearHistoryCb,
  };
}
