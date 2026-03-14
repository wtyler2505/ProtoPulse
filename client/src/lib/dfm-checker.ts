/**
 * DFM (Design for Manufacturability) Checker
 *
 * Client-side engine that validates PCB designs against fab house capabilities.
 * Supports built-in fab presets (JLCPCB, PCBWay, OSHPark, Generic) and custom fabs.
 * Checks 15 DFM rules covering traces, drills, vias, board dimensions, silkscreen,
 * solder mask, copper weight, surface finish, and spacing.
 *
 * Usage:
 *   const checker = DfmChecker.getInstance();
 *   const result = checker.runCheckAgainstFab(designData, 'JLCPCB');
 *
 * React hook:
 *   const { runCheck, availableFabs, history } = useDfmChecker();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DfmSeverity = 'error' | 'warning' | 'info';
export type DfmCategory =
  | 'trace'
  | 'drill'
  | 'clearance'
  | 'silkscreen'
  | 'solder-mask'
  | 'board'
  | 'copper'
  | 'annular-ring'
  | 'via'
  | 'pad';

export interface FabCapabilities {
  name: string;
  minTraceWidth: number;
  minTraceSpacing: number;
  minDrillSize: number;
  maxDrillSize: number;
  minAnnularRing: number;
  minViaDrill: number;
  minViaOuterDiameter: number;
  maxLayerCount: number;
  minBoardThickness: number;
  maxBoardThickness: number;
  minBoardWidth: number;
  maxBoardWidth: number;
  minBoardHeight: number;
  maxBoardHeight: number;
  minSilkscreenWidth: number;
  minSolderMaskBridge: number;
  surfaceFinishes: string[];
  minHoleToHoleSpacing: number;
  minHoleToBoardEdge: number;
  copperWeights: string[];
}

export interface DfmViolation {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: DfmSeverity;
  category: DfmCategory;
  message: string;
  actual: number;
  required: number;
  unit: string;
  location?: { x: number; y: number };
  elementId?: string;
}

export interface DfmCheckResult {
  fabName: string;
  timestamp: number;
  violations: DfmViolation[];
  passed: boolean;
  summary: {
    errors: number;
    warnings: number;
    infos: number;
    totalChecks: number;
    passRate: number;
  };
}

export interface DesignData {
  traces: Array<{ id: string; width: number; spacing: number; layer: string; x?: number; y?: number }>;
  drills: Array<{ id: string; diameter: number; x: number; y: number; type: 'through' | 'blind' | 'buried' }>;
  vias: Array<{ id: string; drillDiameter: number; outerDiameter: number; x: number; y: number }>;
  pads: Array<{ id: string; width: number; height: number; x: number; y: number }>;
  board: { width: number; height: number; thickness: number; layerCount: number };
  silkscreen: Array<{ id: string; lineWidth: number; x: number; y: number }>;
  solderMask: Array<{ id: string; bridgeWidth: number; x: number; y: number }>;
  copperWeight: string;
  surfaceFinish: string;
}

// ---------------------------------------------------------------------------
// BOM → DFM Input Types & Conversion
// ---------------------------------------------------------------------------

/**
 * Minimal shape required to convert a BOM item into DFM design data.
 * Both the schema BomItem and the client-side BomItem satisfy this interface.
 */
export interface BomItemLike {
  partNumber: string;
  description: string;
  manufacturer?: string;
  quantity: number;
  properties?: Record<string, unknown> | null;
}

/**
 * Infer a package type string from a BOM item's description and part number.
 * Checks common package names (SOT-23, QFP-48, DIP-8, 0603, SOIC-8, etc.)
 * Returns 'unknown' if no package pattern is recognized.
 */
export function inferPackageType(description: string, partNumber?: string): string {
  const combined = (description + ' ' + (partNumber ?? '')).toLowerCase();

  // Ordered from most-specific to least-specific.
  // Multi-letter prefixed packages (TSSOP, TQFP, LQFP, SOIC) must come before
  // shorter suffixed matches (SOP, QFP, SO) to avoid partial matching.
  const patterns: Array<{ regex: RegExp; label: string }> = [
    { regex: /bga[- ]?(\d+)/, label: 'BGA' },
    { regex: /tqfp[- ]?(\d+)/, label: 'TQFP' },
    { regex: /lqfp[- ]?(\d+)/, label: 'LQFP' },
    { regex: /qfp[- ]?(\d+)/, label: 'QFP' },
    { regex: /qfn[- ]?(\d+)/, label: 'QFN' },
    { regex: /soic[- ]?(\d+)/, label: 'SOIC' },
    { regex: /tssop[- ]?(\d+)/, label: 'TSSOP' },
    { regex: /msop[- ]?(\d+)/, label: 'MSOP' },
    { regex: /sop[- ]?(\d+)/, label: 'SOP' },
    { regex: /so[- ]?(\d+)/, label: 'SO' },
    { regex: /dfn[- ]?(\d+)/, label: 'DFN' },
    { regex: /lga[- ]?(\d+)/, label: 'LGA' },
    { regex: /sot[- ]?223/, label: 'SOT-223' },
    { regex: /sot[- ]?89/, label: 'SOT-89' },
    { regex: /sot[- ]?23/, label: 'SOT-23' },
    { regex: /to[- ]?220/, label: 'TO-220' },
    { regex: /to[- ]?92/, label: 'TO-92' },
    { regex: /to[- ]?252/, label: 'TO-252' },
    { regex: /dip[- ]?(\d+)/, label: 'DIP' },
    { regex: /sip[- ]?(\d+)/, label: 'SIP' },
    // Chip packages: use (?<!\d) lookbehind so part numbers like "RC0805JR" still match.
    { regex: /(?<!\d)2512(?!\d)/, label: '2512' },
    { regex: /(?<!\d)1210(?!\d)/, label: '1210' },
    { regex: /(?<!\d)1206(?!\d)/, label: '1206' },
    { regex: /(?<!\d)0805(?!\d)/, label: '0805' },
    { regex: /(?<!\d)0603(?!\d)/, label: '0603' },
    { regex: /(?<!\d)0402(?!\d)/, label: '0402' },
    { regex: /(?<!\d)0201(?!\d)/, label: '0201' },
  ];

  for (const { regex, label } of patterns) {
    const match = combined.match(regex);
    if (match) {
      if (match[1]) {
        return `${label}-${match[1]}`;
      }
      return label;
    }
  }

  return 'unknown';
}

/** Estimate pin count from a package type string. */
function estimatePinCountFromPackage(packageType: string): number {
  // Fixed pin counts for known packages (check before generic regex)
  const fixedPins: Record<string, number> = {
    'SOT-23': 3,
    'SOT-89': 3,
    'SOT-223': 4,
    'TO-220': 3,
    'TO-92': 3,
    'TO-252': 3,
  };
  if (fixedPins[packageType] !== undefined) {
    return fixedPins[packageType];
  }

  // Chip passives (0201, 0402, etc.) have 2 pads
  if (/^\d{4}$/.test(packageType)) {
    return 2;
  }

  // Extract trailing number from package like "SOIC-8", "QFP-48", "DIP-16"
  const match = packageType.match(/-(\d+)$/);
  if (match) {
    return parseInt(match[1], 10);
  }

  return 2; // Default: 2-pin component
}

/** Default pad dimensions in mils for common package types. */
function getDefaultPadSize(packageType: string): { width: number; height: number } {
  const lower = packageType.toLowerCase();
  if (lower.startsWith('bga')) {
    return { width: 12, height: 12 };
  }
  if (lower.startsWith('qfn') || lower.startsWith('dfn') || lower.startsWith('lga')) {
    return { width: 14, height: 24 };
  }
  if (
    lower.startsWith('soic') ||
    lower.startsWith('sop') ||
    lower.startsWith('tssop') ||
    lower.startsWith('msop') ||
    lower.startsWith('so')
  ) {
    return { width: 20, height: 50 };
  }
  if (lower.startsWith('qfp') || lower.startsWith('tqfp') || lower.startsWith('lqfp')) {
    return { width: 16, height: 60 };
  }
  if (lower.startsWith('sot')) {
    return { width: 30, height: 40 };
  }
  if (lower.startsWith('to-')) {
    return { width: 60, height: 60 };
  }
  if (lower.startsWith('dip') || lower.startsWith('sip')) {
    return { width: 60, height: 60 };
  }
  // Chip passives
  if (/^\d{4}$/.test(packageType)) {
    return { width: 24, height: 30 };
  }
  return { width: 30, height: 40 };
}

/** Default through-hole drill diameter in mils for THT packages. */
function getDrillDiameter(packageType: string): number | null {
  const lower = packageType.toLowerCase();
  if (lower.startsWith('dip') || lower.startsWith('sip')) {
    return 35; // ~0.9mm standard
  }
  if (lower.startsWith('to-220') || lower.startsWith('to-252')) {
    return 43; // ~1.1mm
  }
  if (lower.startsWith('to-92')) {
    return 30; // ~0.76mm
  }
  return null; // SMD — no drill
}

/**
 * Convert BOM items to DesignData suitable for DFM checking.
 * Places components on a grid layout and generates pads/drills based on package type.
 * Produces a representative design that lets the DFM checker validate pad sizes,
 * drill dimensions, and spacing against fab capabilities.
 */
export function bomToDfmInput(items: BomItemLike[]): DesignData {
  const pads: DesignData['pads'] = [];
  const drills: DesignData['drills'] = [];
  let padIndex = 0;

  // Grid layout: place components in rows
  const GRID_SPACING = 400; // mils between component centers
  const COLS = 10;

  for (const item of items) {
    const packageType = inferPackageType(item.description, item.partNumber);
    const pinCount = estimatePinCountFromPackage(packageType);
    const padSize = getDefaultPadSize(packageType);
    const drillDia = getDrillDiameter(packageType);

    // Place each unit of the component
    for (let q = 0; q < item.quantity; q++) {
      const col = padIndex % COLS;
      const row = Math.floor(padIndex / COLS);
      const baseX = 100 + col * GRID_SPACING;
      const baseY = 100 + row * GRID_SPACING;

      // Generate pads for this component instance
      for (let pin = 0; pin < pinCount; pin++) {
        const pinX = baseX + (pin % 2) * padSize.width * 2;
        const pinY = baseY + Math.floor(pin / 2) * padSize.height;
        const padId = `pad-${padIndex}-${pin}`;
        pads.push({ id: padId, width: padSize.width, height: padSize.height, x: pinX, y: pinY });

        // THT components also get drills
        if (drillDia !== null) {
          drills.push({ id: `drill-${padIndex}-${pin}`, diameter: drillDia, x: pinX, y: pinY, type: 'through' });
        }
      }

      padIndex++;
    }
  }

  // Compute board size to fit all components with margin
  const maxRow = Math.floor(Math.max(0, padIndex - 1) / COLS);
  const maxCol = Math.min(padIndex - 1, COLS - 1);
  const boardWidth = Math.max(1000, (maxCol + 1) * GRID_SPACING + 200);
  const boardHeight = Math.max(1000, (maxRow + 1) * GRID_SPACING + 200);

  return {
    traces: [],
    drills,
    vias: [],
    pads,
    board: { width: boardWidth, height: boardHeight, thickness: 63, layerCount: 2 },
    silkscreen: [],
    solderMask: [],
    copperWeight: '1oz',
    surfaceFinish: 'HASL',
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-dfm-checker';
const MAX_HISTORY = 20;

// ---------------------------------------------------------------------------
// Built-in Fab Presets
// ---------------------------------------------------------------------------

const JLCPCB: FabCapabilities = {
  name: 'JLCPCB',
  minTraceWidth: 3.5,
  minTraceSpacing: 3.5,
  minDrillSize: 8,
  maxDrillSize: 254,
  minAnnularRing: 5,
  minViaDrill: 8,
  minViaOuterDiameter: 18,
  maxLayerCount: 32,
  minBoardThickness: 16,
  maxBoardThickness: 126,
  minBoardWidth: 200,
  maxBoardWidth: 20000,
  minBoardHeight: 200,
  maxBoardHeight: 20000,
  minSilkscreenWidth: 6,
  minSolderMaskBridge: 3,
  surfaceFinishes: ['HASL', 'Lead-Free HASL', 'ENIG', 'OSP', 'Immersion Tin', 'Immersion Silver'],
  minHoleToHoleSpacing: 8,
  minHoleToBoardEdge: 10,
  copperWeights: ['0.5oz', '1oz', '2oz'],
};

const PCBWAY: FabCapabilities = {
  name: 'PCBWay',
  minTraceWidth: 3.5,
  minTraceSpacing: 3.5,
  minDrillSize: 8,
  maxDrillSize: 254,
  minAnnularRing: 5,
  minViaDrill: 8,
  minViaOuterDiameter: 18,
  maxLayerCount: 14,
  minBoardThickness: 16,
  maxBoardThickness: 126,
  minBoardWidth: 200,
  maxBoardWidth: 20000,
  minBoardHeight: 200,
  maxBoardHeight: 20000,
  minSilkscreenWidth: 6,
  minSolderMaskBridge: 3,
  surfaceFinishes: ['HASL', 'Lead-Free HASL', 'ENIG', 'OSP', 'Immersion Tin'],
  minHoleToHoleSpacing: 8,
  minHoleToBoardEdge: 10,
  copperWeights: ['0.5oz', '1oz', '2oz'],
};

const OSHPARK: FabCapabilities = {
  name: 'OSHPark',
  minTraceWidth: 5,
  minTraceSpacing: 5,
  minDrillSize: 10,
  maxDrillSize: 254,
  minAnnularRing: 7,
  minViaDrill: 10,
  minViaOuterDiameter: 24,
  maxLayerCount: 4,
  minBoardThickness: 31,
  maxBoardThickness: 63,
  minBoardWidth: 200,
  maxBoardWidth: 16000,
  minBoardHeight: 200,
  maxBoardHeight: 16000,
  minSilkscreenWidth: 7,
  minSolderMaskBridge: 4,
  surfaceFinishes: ['ENIG'],
  minHoleToHoleSpacing: 10,
  minHoleToBoardEdge: 15,
  copperWeights: ['1oz', '2oz'],
};

const GENERIC_BUDGET: FabCapabilities = {
  name: 'Generic_Budget',
  minTraceWidth: 6,
  minTraceSpacing: 6,
  minDrillSize: 12,
  maxDrillSize: 250,
  minAnnularRing: 8,
  minViaDrill: 12,
  minViaOuterDiameter: 28,
  maxLayerCount: 2,
  minBoardThickness: 31,
  maxBoardThickness: 63,
  minBoardWidth: 300,
  maxBoardWidth: 15000,
  minBoardHeight: 300,
  maxBoardHeight: 15000,
  minSilkscreenWidth: 8,
  minSolderMaskBridge: 5,
  surfaceFinishes: ['HASL'],
  minHoleToHoleSpacing: 12,
  minHoleToBoardEdge: 20,
  copperWeights: ['1oz'],
};

const BUILTIN_FABS = new Map<string, FabCapabilities>([
  ['JLCPCB', JLCPCB],
  ['PCBWay', PCBWAY],
  ['OSHPark', OSHPARK],
  ['Generic_Budget', GENERIC_BUDGET],
]);

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// Persisted data shape
// ---------------------------------------------------------------------------

interface PersistedData {
  customFabs: Array<{ name: string; capabilities: FabCapabilities }>;
  history: DfmCheckResult[];
}

// ---------------------------------------------------------------------------
// DfmChecker
// ---------------------------------------------------------------------------

/**
 * Validates PCB designs against fab house capabilities.
 * Singleton per application. Notifies subscribers on state changes.
 * Persists custom fabs and check history to localStorage.
 */
export class DfmChecker {
  private static instance: DfmChecker | null = null;

  private customFabs = new Map<string, FabCapabilities>();
  private history: DfmCheckResult[] = [];
  private listeners = new Set<Listener>();

  constructor() {
    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): DfmChecker {
    if (!DfmChecker.instance) {
      DfmChecker.instance = new DfmChecker();
    }
    return DfmChecker.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetForTesting(): void {
    DfmChecker.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /** Subscribe to state changes. Returns an unsubscribe function. */
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
  // Fab Management
  // -----------------------------------------------------------------------

  /** Get names of all available fabs (built-in + custom). */
  getAvailableFabs(): string[] {
    const names: string[] = [];
    BUILTIN_FABS.forEach((_v, k) => {
      names.push(k);
    });
    this.customFabs.forEach((_v, k) => {
      names.push(k);
    });
    return names;
  }

  /** Get capabilities for a fab by name. Returns undefined if not found. */
  getFabCapabilities(name: string): FabCapabilities | undefined {
    return BUILTIN_FABS.get(name) ?? this.customFabs.get(name);
  }

  /** Add a custom fab preset. */
  addCustomFab(name: string, capabilities: FabCapabilities): void {
    this.customFabs.set(name, { ...capabilities, name });
    this.save();
    this.notify();
  }

  /** Remove a custom fab preset. Returns false if not found or if it's a built-in. */
  removeCustomFab(name: string): boolean {
    if (!this.customFabs.has(name)) {
      return false;
    }
    this.customFabs.delete(name);
    this.save();
    this.notify();
    return true;
  }

  // -----------------------------------------------------------------------
  // DFM Checking
  // -----------------------------------------------------------------------

  /** Run all DFM checks against the given design and capabilities. */
  runCheck(design: DesignData, capabilities: FabCapabilities): DfmCheckResult {
    const violations: DfmViolation[] = [];
    let totalChecks = 0;

    // Rule 1: Trace width vs minTraceWidth
    design.traces.forEach((trace) => {
      totalChecks++;
      if (trace.width < capabilities.minTraceWidth) {
        violations.push({
          id: crypto.randomUUID(),
          ruleId: 'DFM-001',
          ruleName: 'Minimum Trace Width',
          severity: 'error',
          category: 'trace',
          message: `Trace width ${trace.width} mil is below minimum ${capabilities.minTraceWidth} mil`,
          actual: trace.width,
          required: capabilities.minTraceWidth,
          unit: 'mil',
          location: trace.x !== undefined && trace.y !== undefined ? { x: trace.x, y: trace.y } : undefined,
          elementId: trace.id,
        });
      }
    });

    // Rule 2: Trace spacing vs minTraceSpacing
    design.traces.forEach((trace) => {
      totalChecks++;
      if (trace.spacing < capabilities.minTraceSpacing) {
        violations.push({
          id: crypto.randomUUID(),
          ruleId: 'DFM-002',
          ruleName: 'Minimum Trace Spacing',
          severity: 'error',
          category: 'trace',
          message: `Trace spacing ${trace.spacing} mil is below minimum ${capabilities.minTraceSpacing} mil`,
          actual: trace.spacing,
          required: capabilities.minTraceSpacing,
          unit: 'mil',
          location: trace.x !== undefined && trace.y !== undefined ? { x: trace.x, y: trace.y } : undefined,
          elementId: trace.id,
        });
      }
    });

    // Rule 3: Drill size vs min/maxDrillSize
    design.drills.forEach((drill) => {
      totalChecks++;
      if (drill.diameter < capabilities.minDrillSize) {
        violations.push({
          id: crypto.randomUUID(),
          ruleId: 'DFM-003',
          ruleName: 'Minimum Drill Size',
          severity: 'error',
          category: 'drill',
          message: `Drill diameter ${drill.diameter} mil is below minimum ${capabilities.minDrillSize} mil`,
          actual: drill.diameter,
          required: capabilities.minDrillSize,
          unit: 'mil',
          location: { x: drill.x, y: drill.y },
          elementId: drill.id,
        });
      }
      totalChecks++;
      if (drill.diameter > capabilities.maxDrillSize) {
        violations.push({
          id: crypto.randomUUID(),
          ruleId: 'DFM-003',
          ruleName: 'Maximum Drill Size',
          severity: 'error',
          category: 'drill',
          message: `Drill diameter ${drill.diameter} mil exceeds maximum ${capabilities.maxDrillSize} mil`,
          actual: drill.diameter,
          required: capabilities.maxDrillSize,
          unit: 'mil',
          location: { x: drill.x, y: drill.y },
          elementId: drill.id,
        });
      }
    });

    // Rule 4: Via drill vs minViaDrill
    design.vias.forEach((via) => {
      totalChecks++;
      if (via.drillDiameter < capabilities.minViaDrill) {
        violations.push({
          id: crypto.randomUUID(),
          ruleId: 'DFM-004',
          ruleName: 'Minimum Via Drill',
          severity: 'error',
          category: 'via',
          message: `Via drill ${via.drillDiameter} mil is below minimum ${capabilities.minViaDrill} mil`,
          actual: via.drillDiameter,
          required: capabilities.minViaDrill,
          unit: 'mil',
          location: { x: via.x, y: via.y },
          elementId: via.id,
        });
      }
    });

    // Rule 5: Via outer diameter vs minViaOuterDiameter
    design.vias.forEach((via) => {
      totalChecks++;
      if (via.outerDiameter < capabilities.minViaOuterDiameter) {
        violations.push({
          id: crypto.randomUUID(),
          ruleId: 'DFM-005',
          ruleName: 'Minimum Via Outer Diameter',
          severity: 'error',
          category: 'via',
          message: `Via outer diameter ${via.outerDiameter} mil is below minimum ${capabilities.minViaOuterDiameter} mil`,
          actual: via.outerDiameter,
          required: capabilities.minViaOuterDiameter,
          unit: 'mil',
          location: { x: via.x, y: via.y },
          elementId: via.id,
        });
      }
    });

    // Rule 6: Annular ring = (outerDiameter - drillDiameter) / 2 vs minAnnularRing
    design.vias.forEach((via) => {
      totalChecks++;
      const annularRing = (via.outerDiameter - via.drillDiameter) / 2;
      if (annularRing < capabilities.minAnnularRing) {
        violations.push({
          id: crypto.randomUUID(),
          ruleId: 'DFM-006',
          ruleName: 'Minimum Annular Ring',
          severity: 'error',
          category: 'annular-ring',
          message: `Annular ring ${annularRing.toFixed(1)} mil is below minimum ${capabilities.minAnnularRing} mil`,
          actual: annularRing,
          required: capabilities.minAnnularRing,
          unit: 'mil',
          location: { x: via.x, y: via.y },
          elementId: via.id,
        });
      }
    });

    // Rule 7: Board dimensions vs min/max board size
    totalChecks++;
    if (design.board.width < capabilities.minBoardWidth) {
      violations.push({
        id: crypto.randomUUID(),
        ruleId: 'DFM-007',
        ruleName: 'Minimum Board Width',
        severity: 'error',
        category: 'board',
        message: `Board width ${design.board.width} mil is below minimum ${capabilities.minBoardWidth} mil`,
        actual: design.board.width,
        required: capabilities.minBoardWidth,
        unit: 'mil',
      });
    }
    totalChecks++;
    if (design.board.width > capabilities.maxBoardWidth) {
      violations.push({
        id: crypto.randomUUID(),
        ruleId: 'DFM-007',
        ruleName: 'Maximum Board Width',
        severity: 'error',
        category: 'board',
        message: `Board width ${design.board.width} mil exceeds maximum ${capabilities.maxBoardWidth} mil`,
        actual: design.board.width,
        required: capabilities.maxBoardWidth,
        unit: 'mil',
      });
    }
    totalChecks++;
    if (design.board.height < capabilities.minBoardHeight) {
      violations.push({
        id: crypto.randomUUID(),
        ruleId: 'DFM-007',
        ruleName: 'Minimum Board Height',
        severity: 'error',
        category: 'board',
        message: `Board height ${design.board.height} mil is below minimum ${capabilities.minBoardHeight} mil`,
        actual: design.board.height,
        required: capabilities.minBoardHeight,
        unit: 'mil',
      });
    }
    totalChecks++;
    if (design.board.height > capabilities.maxBoardHeight) {
      violations.push({
        id: crypto.randomUUID(),
        ruleId: 'DFM-007',
        ruleName: 'Maximum Board Height',
        severity: 'error',
        category: 'board',
        message: `Board height ${design.board.height} mil exceeds maximum ${capabilities.maxBoardHeight} mil`,
        actual: design.board.height,
        required: capabilities.maxBoardHeight,
        unit: 'mil',
      });
    }

    // Rule 8: Board thickness vs min/max
    totalChecks++;
    if (design.board.thickness < capabilities.minBoardThickness) {
      violations.push({
        id: crypto.randomUUID(),
        ruleId: 'DFM-008',
        ruleName: 'Minimum Board Thickness',
        severity: 'error',
        category: 'board',
        message: `Board thickness ${design.board.thickness} mil is below minimum ${capabilities.minBoardThickness} mil`,
        actual: design.board.thickness,
        required: capabilities.minBoardThickness,
        unit: 'mil',
      });
    }
    totalChecks++;
    if (design.board.thickness > capabilities.maxBoardThickness) {
      violations.push({
        id: crypto.randomUUID(),
        ruleId: 'DFM-008',
        ruleName: 'Maximum Board Thickness',
        severity: 'error',
        category: 'board',
        message: `Board thickness ${design.board.thickness} mil exceeds maximum ${capabilities.maxBoardThickness} mil`,
        actual: design.board.thickness,
        required: capabilities.maxBoardThickness,
        unit: 'mil',
      });
    }

    // Rule 9: Layer count vs maxLayerCount
    totalChecks++;
    if (design.board.layerCount > capabilities.maxLayerCount) {
      violations.push({
        id: crypto.randomUUID(),
        ruleId: 'DFM-009',
        ruleName: 'Maximum Layer Count',
        severity: 'error',
        category: 'board',
        message: `Layer count ${design.board.layerCount} exceeds maximum ${capabilities.maxLayerCount}`,
        actual: design.board.layerCount,
        required: capabilities.maxLayerCount,
        unit: 'layers',
      });
    }

    // Rule 10: Silkscreen width vs minSilkscreenWidth
    design.silkscreen.forEach((silk) => {
      totalChecks++;
      if (silk.lineWidth < capabilities.minSilkscreenWidth) {
        violations.push({
          id: crypto.randomUUID(),
          ruleId: 'DFM-010',
          ruleName: 'Minimum Silkscreen Width',
          severity: 'warning',
          category: 'silkscreen',
          message: `Silkscreen line width ${silk.lineWidth} mil is below minimum ${capabilities.minSilkscreenWidth} mil`,
          actual: silk.lineWidth,
          required: capabilities.minSilkscreenWidth,
          unit: 'mil',
          location: { x: silk.x, y: silk.y },
          elementId: silk.id,
        });
      }
    });

    // Rule 11: Solder mask bridge vs minSolderMaskBridge
    design.solderMask.forEach((mask) => {
      totalChecks++;
      if (mask.bridgeWidth < capabilities.minSolderMaskBridge) {
        violations.push({
          id: crypto.randomUUID(),
          ruleId: 'DFM-011',
          ruleName: 'Minimum Solder Mask Bridge',
          severity: 'warning',
          category: 'solder-mask',
          message: `Solder mask bridge ${mask.bridgeWidth} mil is below minimum ${capabilities.minSolderMaskBridge} mil`,
          actual: mask.bridgeWidth,
          required: capabilities.minSolderMaskBridge,
          unit: 'mil',
          location: { x: mask.x, y: mask.y },
          elementId: mask.id,
        });
      }
    });

    // Rule 12: Surface finish supported
    totalChecks++;
    if (!capabilities.surfaceFinishes.includes(design.surfaceFinish)) {
      violations.push({
        id: crypto.randomUUID(),
        ruleId: 'DFM-012',
        ruleName: 'Surface Finish Supported',
        severity: 'error',
        category: 'board',
        message: `Surface finish "${design.surfaceFinish}" is not supported. Available: ${capabilities.surfaceFinishes.join(', ')}`,
        actual: 0,
        required: 0,
        unit: 'N/A',
      });
    }

    // Rule 13: Copper weight supported
    totalChecks++;
    if (!capabilities.copperWeights.includes(design.copperWeight)) {
      violations.push({
        id: crypto.randomUUID(),
        ruleId: 'DFM-013',
        ruleName: 'Copper Weight Supported',
        severity: 'error',
        category: 'copper',
        message: `Copper weight "${design.copperWeight}" is not supported. Available: ${capabilities.copperWeights.join(', ')}`,
        actual: 0,
        required: 0,
        unit: 'N/A',
      });
    }

    // Rule 14: Hole-to-hole spacing
    for (let i = 0; i < design.drills.length; i++) {
      for (let j = i + 1; j < design.drills.length; j++) {
        totalChecks++;
        const dx = design.drills[i].x - design.drills[j].x;
        const dy = design.drills[i].y - design.drills[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < capabilities.minHoleToHoleSpacing) {
          violations.push({
            id: crypto.randomUUID(),
            ruleId: 'DFM-014',
            ruleName: 'Minimum Hole-to-Hole Spacing',
            severity: 'error',
            category: 'clearance',
            message: `Hole-to-hole spacing ${distance.toFixed(1)} mil is below minimum ${capabilities.minHoleToHoleSpacing} mil`,
            actual: distance,
            required: capabilities.minHoleToHoleSpacing,
            unit: 'mil',
            location: { x: design.drills[i].x, y: design.drills[i].y },
            elementId: design.drills[i].id,
          });
        }
      }
    }

    // Rule 15: Hole-to-board-edge clearance
    design.drills.forEach((drill) => {
      totalChecks++;
      const minEdgeDist = Math.min(drill.x, drill.y, design.board.width - drill.x, design.board.height - drill.y);
      if (minEdgeDist < capabilities.minHoleToBoardEdge) {
        violations.push({
          id: crypto.randomUUID(),
          ruleId: 'DFM-015',
          ruleName: 'Minimum Hole-to-Board-Edge Clearance',
          severity: 'error',
          category: 'clearance',
          message: `Hole-to-board-edge clearance ${minEdgeDist.toFixed(1)} mil is below minimum ${capabilities.minHoleToBoardEdge} mil`,
          actual: minEdgeDist,
          required: capabilities.minHoleToBoardEdge,
          unit: 'mil',
          location: { x: drill.x, y: drill.y },
          elementId: drill.id,
        });
      }
    });

    // Add at least the base checks even for empty designs
    if (totalChecks === 0) {
      // Board dimension/thickness/layers checks always run (7 base checks above)
      // but traces/drills/vias/silkscreen/solderMask may be empty — still count surface+copper
      totalChecks = 2;
    }

    const errors = violations.filter((v) => v.severity === 'error').length;
    const warnings = violations.filter((v) => v.severity === 'warning').length;
    const infos = violations.filter((v) => v.severity === 'info').length;
    const passedChecks = totalChecks - violations.length;

    const result: DfmCheckResult = {
      fabName: capabilities.name,
      timestamp: Date.now(),
      violations,
      passed: errors === 0,
      summary: {
        errors,
        warnings,
        infos,
        totalChecks,
        passRate: totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 100,
      },
    };

    this.history.push(result);
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(-MAX_HISTORY);
    }
    this.save();
    this.notify();

    return result;
  }

  /** Run DFM check using a built-in or custom fab preset by name. */
  runCheckAgainstFab(design: DesignData, fabName: string): DfmCheckResult {
    const capabilities = this.getFabCapabilities(fabName);
    if (!capabilities) {
      throw new Error(`Fab "${fabName}" not found. Available: ${this.getAvailableFabs().join(', ')}`);
    }
    return this.runCheck(design, capabilities);
  }

  // -----------------------------------------------------------------------
  // History
  // -----------------------------------------------------------------------

  /** Get all check results in history. */
  getCheckHistory(): DfmCheckResult[] {
    return [...this.history];
  }

  /** Clear check history. */
  clearHistory(): void {
    this.history = [];
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Comparison
  // -----------------------------------------------------------------------

  /** Compare two check results. Returns added/removed violations and unchanged count. */
  compareResults(
    a: DfmCheckResult,
    b: DfmCheckResult,
  ): { added: DfmViolation[]; removed: DfmViolation[]; unchanged: number } {
    const aKeys = new Set(a.violations.map((v) => `${v.ruleId}:${v.elementId ?? ''}:${v.category}`));
    const bKeys = new Set(b.violations.map((v) => `${v.ruleId}:${v.elementId ?? ''}:${v.category}`));

    const added: DfmViolation[] = [];
    const removed: DfmViolation[] = [];
    let unchanged = 0;

    b.violations.forEach((v) => {
      const key = `${v.ruleId}:${v.elementId ?? ''}:${v.category}`;
      if (!aKeys.has(key)) {
        added.push(v);
      }
    });

    a.violations.forEach((v) => {
      const key = `${v.ruleId}:${v.elementId ?? ''}:${v.category}`;
      if (!bKeys.has(key)) {
        removed.push(v);
      } else {
        unchanged++;
      }
    });

    return { added, removed, unchanged };
  }

  // -----------------------------------------------------------------------
  // Report Export
  // -----------------------------------------------------------------------

  /** Export a check result as a formatted markdown report. */
  exportReport(result: DfmCheckResult): string {
    const lines: string[] = [];
    lines.push(`# DFM Check Report — ${result.fabName}`);
    lines.push('');
    lines.push(`**Date:** ${new Date(result.timestamp).toISOString()}`);
    lines.push(`**Status:** ${result.passed ? 'PASSED' : 'FAILED'}`);
    lines.push('');
    lines.push('## Summary');
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Total Checks | ${result.summary.totalChecks} |`);
    lines.push(`| Errors | ${result.summary.errors} |`);
    lines.push(`| Warnings | ${result.summary.warnings} |`);
    lines.push(`| Infos | ${result.summary.infos} |`);
    lines.push(`| Pass Rate | ${result.summary.passRate.toFixed(1)}% |`);
    lines.push('');

    if (result.violations.length > 0) {
      lines.push('## Violations');
      lines.push('');
      lines.push(`| Severity | Rule | Category | Message | Actual | Required | Unit |`);
      lines.push(`|----------|------|----------|---------|--------|----------|------|`);
      result.violations.forEach((v) => {
        lines.push(
          `| ${v.severity.toUpperCase()} | ${v.ruleId} | ${v.category} | ${v.message} | ${v.actual} | ${v.required} | ${v.unit} |`,
        );
      });
      lines.push('');
    } else {
      lines.push('No violations found. Design meets all manufacturing constraints.');
      lines.push('');
    }

    return lines.join('\n');
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  private save(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const data: PersistedData = {
        customFabs: [] as Array<{ name: string; capabilities: FabCapabilities }>,
        history: this.history,
      };
      this.customFabs.forEach((capabilities, name) => {
        data.customFabs.push({ name, capabilities });
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }

  private load(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) {
        return;
      }

      const data = parsed as PersistedData;

      if (Array.isArray(data.customFabs)) {
        data.customFabs.forEach((entry) => {
          if (
            typeof entry === 'object' &&
            entry !== null &&
            typeof entry.name === 'string' &&
            typeof entry.capabilities === 'object' &&
            entry.capabilities !== null
          ) {
            this.customFabs.set(entry.name, entry.capabilities);
          }
        });
      }

      if (Array.isArray(data.history)) {
        this.history = data.history.filter(
          (r: unknown): r is DfmCheckResult =>
            typeof r === 'object' &&
            r !== null &&
            typeof (r as DfmCheckResult).fabName === 'string' &&
            typeof (r as DfmCheckResult).timestamp === 'number' &&
            Array.isArray((r as DfmCheckResult).violations),
        );
      }
    } catch {
      // Corrupt data — keep defaults
    }
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook for accessing the DFM checker in React components.
 * Subscribes to the DfmChecker singleton and triggers re-renders on state changes.
 */
export function useDfmChecker(): {
  runCheck: (design: DesignData, capabilities: FabCapabilities) => DfmCheckResult;
  runCheckAgainstFab: (design: DesignData, fabName: string) => DfmCheckResult;
  availableFabs: string[];
  getCapabilities: (name: string) => FabCapabilities | undefined;
  addCustomFab: (name: string, capabilities: FabCapabilities) => void;
  removeCustomFab: (name: string) => boolean;
  history: DfmCheckResult[];
  clearHistory: () => void;
  compareResults: (
    a: DfmCheckResult,
    b: DfmCheckResult,
  ) => { added: DfmViolation[]; removed: DfmViolation[]; unchanged: number };
  exportReport: (result: DfmCheckResult) => string;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const checker = DfmChecker.getInstance();
    const unsubscribe = checker.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const runCheck = useCallback((design: DesignData, capabilities: FabCapabilities) => {
    return DfmChecker.getInstance().runCheck(design, capabilities);
  }, []);

  const runCheckAgainstFab = useCallback((design: DesignData, fabName: string) => {
    return DfmChecker.getInstance().runCheckAgainstFab(design, fabName);
  }, []);

  const getCapabilities = useCallback((name: string) => {
    return DfmChecker.getInstance().getFabCapabilities(name);
  }, []);

  const addCustomFab = useCallback((name: string, capabilities: FabCapabilities) => {
    DfmChecker.getInstance().addCustomFab(name, capabilities);
  }, []);

  const removeCustomFab = useCallback((name: string) => {
    return DfmChecker.getInstance().removeCustomFab(name);
  }, []);

  const clearHistory = useCallback(() => {
    DfmChecker.getInstance().clearHistory();
  }, []);

  const compareResults = useCallback(
    (a: DfmCheckResult, b: DfmCheckResult) => {
      return DfmChecker.getInstance().compareResults(a, b);
    },
    [],
  );

  const exportReport = useCallback((result: DfmCheckResult) => {
    return DfmChecker.getInstance().exportReport(result);
  }, []);

  const checker = typeof window !== 'undefined' ? DfmChecker.getInstance() : null;

  return {
    runCheck,
    runCheckAgainstFab,
    availableFabs: checker?.getAvailableFabs() ?? [],
    getCapabilities,
    addCustomFab,
    removeCustomFab,
    history: checker?.getCheckHistory() ?? [],
    clearHistory,
    compareResults,
    exportReport,
  };
}
