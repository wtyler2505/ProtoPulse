/**
 * Design Import Parser
 *
 * Client-side design file parser that imports project files from KiCad, EAGLE,
 * Altium, gEDA, LTspice, Proteus, and OrCAD, converting them to ProtoPulse's
 * internal format.
 *
 * This module is the public API — individual format parsers live in `./import/`.
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

// Re-export all public types from import-types
export type {
  FormatDetectionResult,
  ImportedComponent,
  ImportedDesign,
  ImportedNet,
  ImportedWire,
  ImportFormat,
  ImportResult,
  ImportStatus,
} from './import/import-types';
export { SUPPORTED_FORMATS } from './import/import-types';

import type {
  FormatDetectionResult,
  ImportedComponent,
  ImportedDesign,
  ImportFormat,
  ImportResult,
  Listener,
} from './import/import-types';
import { STORAGE_KEY, SUPPORTED_FORMATS, createEmptyDesign } from './import/import-types';

// Format parsers
import { parseAltiumPcb, parseAltiumSchematic } from './import/altium-parser';
import { parseEagleBoard, parseEagleLibrary, parseEagleSchematic } from './import/eagle-parser';
import { parseGedaSchematic } from './import/geda-parser';
import { parseKicadPcb, parseKicadSchematic, parseKicadSymbol } from './import/kicad-parser';
import { parseLtspiceSchematic } from './import/ltspice-parser';
import { parseOrcadSchematic } from './import/orcad-parser';
import { parseProteusSchematic } from './import/proteus-parser';

// Suppress unused import warnings — these are used internally
void createEmptyDesign;

// ---------------------------------------------------------------------------
// DesignImporter
// ---------------------------------------------------------------------------

/**
 * Parses design files from KiCad, EAGLE, Altium, gEDA, LTspice, Proteus,
 * and OrCAD formats.
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
          design = parseKicadSchematic(content);
          break;
        case 'kicad-pcb':
          design = parseKicadPcb(content);
          break;
        case 'kicad-symbol':
          design = parseKicadSymbol(content);
          break;
        case 'eagle-schematic':
          design = parseEagleSchematic(content);
          break;
        case 'eagle-board':
          design = parseEagleBoard(content);
          break;
        case 'eagle-library':
          design = parseEagleLibrary(content);
          break;
        case 'altium-schematic':
          design = parseAltiumSchematic(content);
          break;
        case 'altium-pcb':
          design = parseAltiumPcb(content);
          break;
        case 'geda-schematic':
          design = parseGedaSchematic(content);
          break;
        case 'ltspice-schematic':
          design = parseLtspiceSchematic(content);
          break;
        case 'proteus-schematic':
          design = parseProteusSchematic(content);
          break;
        case 'orcad-schematic':
          design = parseOrcadSchematic(content);
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
    } catch (_err) {
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
    const xOffset = 0;
    const ySpacing = 120;

    design.components.forEach((comp, index) => {
      const id = crypto.randomUUID();
      componentIdMap.set(comp.refDes, id);

      nodes.push({
        id,
        type: inferNodeType(comp),
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
  // Parsers (delegated — exposed for backward compatibility with tests)
  // -----------------------------------------------------------------------

  parseKicadSchematic(content: string): ImportedDesign {
    return parseKicadSchematic(content);
  }

  parseKicadPcb(content: string): ImportedDesign {
    return parseKicadPcb(content);
  }

  parseKicadSymbol(content: string): ImportedDesign {
    return parseKicadSymbol(content);
  }

  parseEagleSchematic(content: string): ImportedDesign {
    return parseEagleSchematic(content);
  }

  parseEagleBoard(content: string): ImportedDesign {
    return parseEagleBoard(content);
  }

  parseEagleLibrary(content: string): ImportedDesign {
    return parseEagleLibrary(content);
  }

  parseAltiumSchematic(content: string): ImportedDesign {
    return parseAltiumSchematic(content);
  }

  parseAltiumPcb(content: string): ImportedDesign {
    return parseAltiumPcb(content);
  }

  parseGedaSchematic(content: string): ImportedDesign {
    return parseGedaSchematic(content);
  }

  parseLtspiceSchematic(content: string): ImportedDesign {
    return parseLtspiceSchematic(content);
  }

  parseProteusSchematic(content: string): ImportedDesign {
    return parseProteusSchematic(content);
  }

  parseOrcadSchematic(content: string): ImportedDesign {
    return parseOrcadSchematic(content);
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

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
// Private helpers
// ---------------------------------------------------------------------------

function inferNodeType(comp: ImportedComponent): string {
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
