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
  | 'altium-pcb';

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
