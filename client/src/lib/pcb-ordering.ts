/**
 * PCB Ordering Workflow Engine
 *
 * Client-side PCB ordering workflow with integrated DFM (Design for Manufacturing)
 * validation for popular PCB fabricators. Supports one-click ordering with pre-checks.
 *
 * Singleton + Subscribe pattern for React integration. Persists to localStorage.
 *
 * Usage:
 *   const engine = PcbOrderingEngine.getInstance();
 *   const dfm = engine.runDfmCheck(boardSpec, 'jlcpcb');
 *   const quote = engine.getQuote(boardSpec, 'jlcpcb', 10);
 *
 * React hook:
 *   const { fabricators, runDfmCheck, getQuote, createOrder, submitOrder } = usePcbOrdering();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FabricatorId = 'jlcpcb' | 'pcbway' | 'oshpark' | 'pcbgogo' | 'seeedstudio';
export type OrderStatus =
  | 'draft'
  | 'dfm-check'
  | 'quoting'
  | 'ready'
  | 'submitted'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'error';
export type BoardFinish = 'HASL' | 'ENIG' | 'OSP' | 'ENEPIG' | 'Immersion_Tin' | 'Immersion_Silver';
export type SolderMaskColor =
  | 'green'
  | 'red'
  | 'blue'
  | 'black'
  | 'white'
  | 'yellow'
  | 'purple'
  | 'matte-black'
  | 'matte-green';
export type SilkscreenColor = 'white' | 'black' | 'yellow' | 'red';
export type CopperWeightOz = 0.5 | 1 | 2 | 3 | 4;

export interface BoardSpecification {
  width: number; // mm
  height: number; // mm
  layers: number;
  thickness: number; // mm
  copperWeight: CopperWeightOz;
  finish: BoardFinish;
  solderMaskColor: SolderMaskColor;
  silkscreenColor: SilkscreenColor;
  minTraceWidth: number; // mm
  minDrillSize: number; // mm
  castellatedHoles: boolean;
  impedanceControl: boolean;
  viaInPad: boolean;
  goldFingers: boolean;
}

export interface FabricatorProfile {
  id: FabricatorId;
  name: string;
  website: string;
  capabilities: {
    maxLayers: number;
    minTrace: number; // mm
    minDrill: number; // mm
    minBoardSize: { width: number; height: number };
    maxBoardSize: { width: number; height: number };
    availableFinishes: BoardFinish[];
    availableColors: SolderMaskColor[];
    availableSilkscreen: SilkscreenColor[];
    availableCopperWeights: CopperWeightOz[];
    turnaroundDays: { economy: number; standard: number; rush: number };
    castellatedHoles: boolean;
    impedanceControl: boolean;
    viaInPad: boolean;
    goldFingers: boolean;
  };
  pricing: {
    basePrice: number;
    perBoardArea: number; // per sq cm
    perExtraLayer: number;
    finishUpcharge: Record<string, number>;
    rushMultiplier: number;
  };
  shippingOptions: Array<{
    method: string;
    estimatedDays: number;
    baseCost: number;
  }>;
}

export interface DfmCheckResult {
  passed: boolean;
  fabricator: FabricatorId;
  issues: Array<{
    severity: 'error' | 'warning' | 'info';
    rule: string;
    message: string;
    actual: number;
    required: number;
    unit: string;
  }>;
  timestamp: number;
}

export interface PriceQuote {
  fabricator: FabricatorId;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  setupFee: number;
  shippingCost: number;
  grandTotal: number;
  turnaround: string;
  turnaroundDays: number;
  currency: string;
  validUntil: number;
  breakdown: Array<{ item: string; cost: number }>;
}

export interface PcbOrder {
  id: string;
  status: OrderStatus;
  fabricator: FabricatorId;
  boardSpec: BoardSpecification;
  quantity: number;
  quote: PriceQuote | null;
  dfmResult: DfmCheckResult | null;
  createdAt: number;
  updatedAt: number;
  submittedAt?: number;
  notes: string;
  gerberFileIds?: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-pcb-orders';

type Listener = () => void;

// ---------------------------------------------------------------------------
// Built-in Fabricator Profiles
// ---------------------------------------------------------------------------

const FABRICATOR_PROFILES: FabricatorProfile[] = [
  {
    id: 'jlcpcb',
    name: 'JLCPCB',
    website: 'https://jlcpcb.com',
    capabilities: {
      maxLayers: 32,
      minTrace: 0.09,
      minDrill: 0.15,
      minBoardSize: { width: 6, height: 6 },
      maxBoardSize: { width: 500, height: 500 },
      availableFinishes: ['HASL', 'ENIG', 'OSP', 'ENEPIG', 'Immersion_Tin', 'Immersion_Silver'],
      availableColors: ['green', 'red', 'blue', 'black', 'white', 'yellow', 'purple', 'matte-black', 'matte-green'],
      availableSilkscreen: ['white', 'black', 'yellow', 'red'],
      availableCopperWeights: [0.5, 1, 2, 3, 4],
      turnaroundDays: { economy: 7, standard: 3, rush: 1 },
      castellatedHoles: true,
      impedanceControl: true,
      viaInPad: true,
      goldFingers: true,
    },
    pricing: {
      basePrice: 2.0,
      perBoardArea: 0.03,
      perExtraLayer: 4.0,
      finishUpcharge: { HASL: 0, ENIG: 8, OSP: 2, ENEPIG: 15, Immersion_Tin: 5, Immersion_Silver: 6 },
      rushMultiplier: 2.5,
    },
    shippingOptions: [
      { method: 'Standard (DHL)', estimatedDays: 7, baseCost: 5.0 },
      { method: 'Express (DHL Express)', estimatedDays: 3, baseCost: 15.0 },
      { method: 'Economy (China Post)', estimatedDays: 20, baseCost: 2.0 },
    ],
  },
  {
    id: 'pcbway',
    name: 'PCBWay',
    website: 'https://pcbway.com',
    capabilities: {
      maxLayers: 14,
      minTrace: 0.1,
      minDrill: 0.2,
      minBoardSize: { width: 5, height: 5 },
      maxBoardSize: { width: 580, height: 500 },
      availableFinishes: ['HASL', 'ENIG', 'OSP', 'Immersion_Tin', 'Immersion_Silver'],
      availableColors: ['green', 'red', 'blue', 'black', 'white', 'yellow', 'purple', 'matte-black'],
      availableSilkscreen: ['white', 'black', 'yellow'],
      availableCopperWeights: [0.5, 1, 2, 3],
      turnaroundDays: { economy: 8, standard: 4, rush: 2 },
      castellatedHoles: true,
      impedanceControl: true,
      viaInPad: true,
      goldFingers: true,
    },
    pricing: {
      basePrice: 5.0,
      perBoardArea: 0.04,
      perExtraLayer: 5.0,
      finishUpcharge: { HASL: 0, ENIG: 10, OSP: 3, Immersion_Tin: 6, Immersion_Silver: 7 },
      rushMultiplier: 2.0,
    },
    shippingOptions: [
      { method: 'Standard (DHL)', estimatedDays: 8, baseCost: 6.0 },
      { method: 'Express (FedEx)', estimatedDays: 4, baseCost: 18.0 },
    ],
  },
  {
    id: 'oshpark',
    name: 'OSH Park',
    website: 'https://oshpark.com',
    capabilities: {
      maxLayers: 6,
      minTrace: 0.127,
      minDrill: 0.254,
      minBoardSize: { width: 5, height: 5 },
      maxBoardSize: { width: 381, height: 356 },
      availableFinishes: ['ENIG'],
      availableColors: ['purple'],
      availableSilkscreen: ['white'],
      availableCopperWeights: [1, 2],
      turnaroundDays: { economy: 17, standard: 12, rush: 5 },
      castellatedHoles: false,
      impedanceControl: false,
      viaInPad: false,
      goldFingers: false,
    },
    pricing: {
      basePrice: 10.0,
      perBoardArea: 0.1,
      perExtraLayer: 8.0,
      finishUpcharge: { ENIG: 0 },
      rushMultiplier: 1.8,
    },
    shippingOptions: [
      { method: 'USPS First Class', estimatedDays: 5, baseCost: 3.0 },
      { method: 'USPS Priority', estimatedDays: 3, baseCost: 8.0 },
    ],
  },
  {
    id: 'pcbgogo',
    name: 'PCBGoGo',
    website: 'https://pcbgogo.com',
    capabilities: {
      maxLayers: 16,
      minTrace: 0.075,
      minDrill: 0.15,
      minBoardSize: { width: 5, height: 5 },
      maxBoardSize: { width: 600, height: 500 },
      availableFinishes: ['HASL', 'ENIG', 'OSP', 'Immersion_Tin'],
      availableColors: ['green', 'red', 'blue', 'black', 'white', 'yellow'],
      availableSilkscreen: ['white', 'black'],
      availableCopperWeights: [0.5, 1, 2, 3],
      turnaroundDays: { economy: 7, standard: 3, rush: 1 },
      castellatedHoles: true,
      impedanceControl: true,
      viaInPad: true,
      goldFingers: true,
    },
    pricing: {
      basePrice: 3.0,
      perBoardArea: 0.035,
      perExtraLayer: 4.5,
      finishUpcharge: { HASL: 0, ENIG: 9, OSP: 2.5, Immersion_Tin: 5.5 },
      rushMultiplier: 2.2,
    },
    shippingOptions: [
      { method: 'Standard (DHL)', estimatedDays: 7, baseCost: 5.5 },
      { method: 'Express (DHL Express)', estimatedDays: 3, baseCost: 16.0 },
    ],
  },
  {
    id: 'seeedstudio',
    name: 'Seeed Studio Fusion',
    website: 'https://www.seeedstudio.com/fusion_pcb.html',
    capabilities: {
      maxLayers: 10,
      minTrace: 0.1,
      minDrill: 0.2,
      minBoardSize: { width: 10, height: 10 },
      maxBoardSize: { width: 400, height: 500 },
      availableFinishes: ['HASL', 'ENIG', 'OSP'],
      availableColors: ['green', 'red', 'blue', 'black', 'white', 'yellow'],
      availableSilkscreen: ['white', 'black'],
      availableCopperWeights: [1, 2],
      turnaroundDays: { economy: 10, standard: 5, rush: 3 },
      castellatedHoles: true,
      impedanceControl: false,
      viaInPad: false,
      goldFingers: true,
    },
    pricing: {
      basePrice: 4.9,
      perBoardArea: 0.05,
      perExtraLayer: 6.0,
      finishUpcharge: { HASL: 0, ENIG: 12, OSP: 3 },
      rushMultiplier: 1.8,
    },
    shippingOptions: [
      { method: 'Standard (China Post)', estimatedDays: 15, baseCost: 3.0 },
      { method: 'Express (DHL)', estimatedDays: 5, baseCost: 12.0 },
    ],
  },
];

// ---------------------------------------------------------------------------
// PcbOrderingEngine
// ---------------------------------------------------------------------------

/**
 * Manages PCB ordering workflow with DFM validation, pricing, and order tracking.
 * Singleton per application. Notifies subscribers on state changes.
 * Persists orders to localStorage.
 */
export class PcbOrderingEngine {
  private static instance: PcbOrderingEngine | null = null;

  private orders: PcbOrder[] = [];
  private listeners = new Set<Listener>();
  private fabricators: Map<FabricatorId, FabricatorProfile>;

  constructor() {
    this.fabricators = new Map<FabricatorId, FabricatorProfile>();
    FABRICATOR_PROFILES.forEach((f) => {
      this.fabricators.set(f.id, f);
    });
    this.orders = [];
    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): PcbOrderingEngine {
    if (!PcbOrderingEngine.instance) {
      PcbOrderingEngine.instance = new PcbOrderingEngine();
    }
    return PcbOrderingEngine.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetForTesting(): void {
    PcbOrderingEngine.instance = null;
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
  // Fabricator Access
  // -----------------------------------------------------------------------

  /** Get a fabricator profile by ID. Returns null if not found. */
  getFabricator(id: FabricatorId): FabricatorProfile | null {
    return this.fabricators.get(id) ?? null;
  }

  /** Get all fabricator profiles. */
  getAllFabricators(): FabricatorProfile[] {
    const result: FabricatorProfile[] = [];
    this.fabricators.forEach((f) => {
      result.push(f);
    });
    return result;
  }

  /** Compare fabricators against a board specification. */
  compareFabricators(
    spec: BoardSpecification,
  ): Array<{ fabricator: FabricatorProfile; compatible: boolean; issues: string[] }> {
    const results: Array<{ fabricator: FabricatorProfile; compatible: boolean; issues: string[] }> = [];

    this.fabricators.forEach((fab) => {
      const issues: string[] = [];

      if (spec.layers > fab.capabilities.maxLayers) {
        issues.push(`Layer count ${spec.layers} exceeds max ${fab.capabilities.maxLayers}`);
      }
      if (spec.minTraceWidth < fab.capabilities.minTrace) {
        issues.push(
          `Trace width ${spec.minTraceWidth}mm below min ${fab.capabilities.minTrace}mm`,
        );
      }
      if (spec.minDrillSize < fab.capabilities.minDrill) {
        issues.push(
          `Drill size ${spec.minDrillSize}mm below min ${fab.capabilities.minDrill}mm`,
        );
      }
      if (spec.width < fab.capabilities.minBoardSize.width || spec.height < fab.capabilities.minBoardSize.height) {
        issues.push(
          `Board ${spec.width}x${spec.height}mm below min ${fab.capabilities.minBoardSize.width}x${fab.capabilities.minBoardSize.height}mm`,
        );
      }
      if (spec.width > fab.capabilities.maxBoardSize.width || spec.height > fab.capabilities.maxBoardSize.height) {
        issues.push(
          `Board ${spec.width}x${spec.height}mm exceeds max ${fab.capabilities.maxBoardSize.width}x${fab.capabilities.maxBoardSize.height}mm`,
        );
      }
      if (!fab.capabilities.availableFinishes.includes(spec.finish)) {
        issues.push(`Finish ${spec.finish} not available`);
      }
      if (!fab.capabilities.availableColors.includes(spec.solderMaskColor)) {
        issues.push(`Solder mask color ${spec.solderMaskColor} not available`);
      }
      if (!fab.capabilities.availableSilkscreen.includes(spec.silkscreenColor)) {
        issues.push(`Silkscreen color ${spec.silkscreenColor} not available`);
      }
      if (!fab.capabilities.availableCopperWeights.includes(spec.copperWeight)) {
        issues.push(`Copper weight ${spec.copperWeight}oz not available`);
      }
      if (spec.castellatedHoles && !fab.capabilities.castellatedHoles) {
        issues.push('Castellated holes not supported');
      }
      if (spec.impedanceControl && !fab.capabilities.impedanceControl) {
        issues.push('Impedance control not supported');
      }
      if (spec.viaInPad && !fab.capabilities.viaInPad) {
        issues.push('Via-in-pad not supported');
      }
      if (spec.goldFingers && !fab.capabilities.goldFingers) {
        issues.push('Gold fingers not supported');
      }

      results.push({
        fabricator: fab,
        compatible: issues.length === 0,
        issues,
      });
    });

    return results;
  }

  // -----------------------------------------------------------------------
  // DFM Check
  // -----------------------------------------------------------------------

  /** Run Design for Manufacturing check against a fabricator's capabilities. */
  runDfmCheck(spec: BoardSpecification, fabricatorId: FabricatorId): DfmCheckResult {
    const fab = this.fabricators.get(fabricatorId);
    if (!fab) {
      return {
        passed: false,
        fabricator: fabricatorId,
        issues: [
          {
            severity: 'error',
            rule: 'fabricator-exists',
            message: `Unknown fabricator: ${fabricatorId}`,
            actual: 0,
            required: 0,
            unit: '',
          },
        ],
        timestamp: Date.now(),
      };
    }

    const issues: DfmCheckResult['issues'] = [];

    // Validate dimensions
    if (spec.width <= 0 || spec.height <= 0) {
      issues.push({
        severity: 'error',
        rule: 'board-dimensions-positive',
        message: 'Board dimensions must be positive',
        actual: Math.min(spec.width, spec.height),
        required: 0.01,
        unit: 'mm',
      });
    }

    // Layer count
    if (spec.layers > fab.capabilities.maxLayers) {
      issues.push({
        severity: 'error',
        rule: 'max-layers',
        message: `Layer count ${spec.layers} exceeds fabricator maximum of ${fab.capabilities.maxLayers}`,
        actual: spec.layers,
        required: fab.capabilities.maxLayers,
        unit: 'layers',
      });
    }

    // Trace width
    if (spec.minTraceWidth < fab.capabilities.minTrace) {
      issues.push({
        severity: 'error',
        rule: 'min-trace-width',
        message: `Trace width ${spec.minTraceWidth}mm is below fabricator minimum of ${fab.capabilities.minTrace}mm`,
        actual: spec.minTraceWidth,
        required: fab.capabilities.minTrace,
        unit: 'mm',
      });
    } else if (spec.minTraceWidth < fab.capabilities.minTrace * 1.2) {
      issues.push({
        severity: 'warning',
        rule: 'trace-width-near-limit',
        message: `Trace width ${spec.minTraceWidth}mm is near fabricator minimum of ${fab.capabilities.minTrace}mm`,
        actual: spec.minTraceWidth,
        required: fab.capabilities.minTrace,
        unit: 'mm',
      });
    }

    // Drill size
    if (spec.minDrillSize < fab.capabilities.minDrill) {
      issues.push({
        severity: 'error',
        rule: 'min-drill-size',
        message: `Drill size ${spec.minDrillSize}mm is below fabricator minimum of ${fab.capabilities.minDrill}mm`,
        actual: spec.minDrillSize,
        required: fab.capabilities.minDrill,
        unit: 'mm',
      });
    } else if (spec.minDrillSize < fab.capabilities.minDrill * 1.2) {
      issues.push({
        severity: 'warning',
        rule: 'drill-size-near-limit',
        message: `Drill size ${spec.minDrillSize}mm is near fabricator minimum of ${fab.capabilities.minDrill}mm`,
        actual: spec.minDrillSize,
        required: fab.capabilities.minDrill,
        unit: 'mm',
      });
    }

    // Board size — minimum
    if (spec.width < fab.capabilities.minBoardSize.width || spec.height < fab.capabilities.minBoardSize.height) {
      issues.push({
        severity: 'error',
        rule: 'min-board-size',
        message: `Board ${spec.width}x${spec.height}mm is below fabricator minimum of ${fab.capabilities.minBoardSize.width}x${fab.capabilities.minBoardSize.height}mm`,
        actual: Math.min(spec.width, spec.height),
        required: Math.min(fab.capabilities.minBoardSize.width, fab.capabilities.minBoardSize.height),
        unit: 'mm',
      });
    }

    // Board size — maximum
    if (spec.width > fab.capabilities.maxBoardSize.width || spec.height > fab.capabilities.maxBoardSize.height) {
      issues.push({
        severity: 'error',
        rule: 'max-board-size',
        message: `Board ${spec.width}x${spec.height}mm exceeds fabricator maximum of ${fab.capabilities.maxBoardSize.width}x${fab.capabilities.maxBoardSize.height}mm`,
        actual: Math.max(spec.width, spec.height),
        required: Math.max(fab.capabilities.maxBoardSize.width, fab.capabilities.maxBoardSize.height),
        unit: 'mm',
      });
    }

    // Finish
    if (!fab.capabilities.availableFinishes.includes(spec.finish)) {
      issues.push({
        severity: 'error',
        rule: 'finish-available',
        message: `Board finish ${spec.finish} is not available from ${fab.name}`,
        actual: 0,
        required: 0,
        unit: '',
      });
    }

    // Solder mask color
    if (!fab.capabilities.availableColors.includes(spec.solderMaskColor)) {
      issues.push({
        severity: 'error',
        rule: 'solder-mask-color',
        message: `Solder mask color ${spec.solderMaskColor} is not available from ${fab.name}`,
        actual: 0,
        required: 0,
        unit: '',
      });
    }

    // Silkscreen color
    if (!fab.capabilities.availableSilkscreen.includes(spec.silkscreenColor)) {
      issues.push({
        severity: 'error',
        rule: 'silkscreen-color',
        message: `Silkscreen color ${spec.silkscreenColor} is not available from ${fab.name}`,
        actual: 0,
        required: 0,
        unit: '',
      });
    }

    // Copper weight
    if (!fab.capabilities.availableCopperWeights.includes(spec.copperWeight)) {
      issues.push({
        severity: 'error',
        rule: 'copper-weight',
        message: `Copper weight ${spec.copperWeight}oz is not available from ${fab.name}`,
        actual: spec.copperWeight,
        required: 0,
        unit: 'oz',
      });
    }

    // Special features
    if (spec.castellatedHoles && !fab.capabilities.castellatedHoles) {
      issues.push({
        severity: 'error',
        rule: 'castellated-holes',
        message: `${fab.name} does not support castellated holes`,
        actual: 1,
        required: 0,
        unit: 'boolean',
      });
    }
    if (spec.impedanceControl && !fab.capabilities.impedanceControl) {
      issues.push({
        severity: 'error',
        rule: 'impedance-control',
        message: `${fab.name} does not support impedance control`,
        actual: 1,
        required: 0,
        unit: 'boolean',
      });
    }
    if (spec.viaInPad && !fab.capabilities.viaInPad) {
      issues.push({
        severity: 'error',
        rule: 'via-in-pad',
        message: `${fab.name} does not support via-in-pad`,
        actual: 1,
        required: 0,
        unit: 'boolean',
      });
    }
    if (spec.goldFingers && !fab.capabilities.goldFingers) {
      issues.push({
        severity: 'error',
        rule: 'gold-fingers',
        message: `${fab.name} does not support gold fingers`,
        actual: 1,
        required: 0,
        unit: 'boolean',
      });
    }

    // Info-level notes
    if (spec.layers > 2) {
      issues.push({
        severity: 'info',
        rule: 'multi-layer-note',
        message: `Multi-layer board (${spec.layers} layers) — verify stackup with ${fab.name}`,
        actual: spec.layers,
        required: 2,
        unit: 'layers',
      });
    }

    const hasErrors = issues.some((i) => i.severity === 'error');

    return {
      passed: !hasErrors,
      fabricator: fabricatorId,
      issues,
      timestamp: Date.now(),
    };
  }

  // -----------------------------------------------------------------------
  // Pricing
  // -----------------------------------------------------------------------

  /** Generate a price quote for a board specification. */
  getQuote(
    spec: BoardSpecification,
    fabricatorId: FabricatorId,
    quantity: number,
    turnaround: 'economy' | 'standard' | 'rush' = 'standard',
  ): PriceQuote {
    const fab = this.fabricators.get(fabricatorId);
    if (!fab) {
      throw new Error(`Unknown fabricator: ${fabricatorId}`);
    }

    if (quantity <= 0) {
      throw new Error('Quantity must be greater than zero');
    }

    const boardAreaSqCm = (spec.width * spec.height) / 100;
    const extraLayers = Math.max(0, spec.layers - 2);
    const finishUpcharge = fab.pricing.finishUpcharge[spec.finish] ?? 0;
    const rushMultiplier = turnaround === 'rush' ? fab.pricing.rushMultiplier : 1;

    const baseCost = fab.pricing.basePrice;
    const areaCost = boardAreaSqCm * fab.pricing.perBoardArea;
    const layerCost = extraLayers * fab.pricing.perExtraLayer;
    const setupFee = 0;
    const shippingCost = fab.shippingOptions[0]?.baseCost ?? 5;

    const unitPrice = (baseCost + areaCost + layerCost + finishUpcharge) * rushMultiplier;
    const totalPrice = unitPrice * quantity;
    const grandTotal = totalPrice + setupFee + shippingCost;

    const turnaroundDays = fab.capabilities.turnaroundDays[turnaround];

    const breakdown: Array<{ item: string; cost: number }> = [
      { item: 'Base price', cost: baseCost * quantity },
      { item: `Board area (${boardAreaSqCm.toFixed(1)} sq cm)`, cost: areaCost * quantity },
    ];

    if (layerCost > 0) {
      breakdown.push({
        item: `Extra layers (${extraLayers})`,
        cost: layerCost * quantity,
      });
    }

    if (finishUpcharge > 0) {
      breakdown.push({
        item: `Finish upgrade (${spec.finish})`,
        cost: finishUpcharge * quantity,
      });
    }

    if (turnaround === 'rush') {
      const rushExtra = totalPrice - (baseCost + areaCost + layerCost + finishUpcharge) * quantity;
      if (rushExtra > 0) {
        breakdown.push({ item: 'Rush surcharge', cost: rushExtra });
      }
    }

    breakdown.push({ item: 'Shipping', cost: shippingCost });

    return {
      fabricator: fabricatorId,
      quantity,
      unitPrice: Math.round(unitPrice * 100) / 100,
      totalPrice: Math.round(totalPrice * 100) / 100,
      setupFee,
      shippingCost,
      grandTotal: Math.round(grandTotal * 100) / 100,
      turnaround,
      turnaroundDays,
      currency: 'USD',
      validUntil: Date.now() + 7 * 24 * 60 * 60 * 1000,
      breakdown,
    };
  }

  /** Get quotes from all compatible fabricators. */
  compareQuotes(
    spec: BoardSpecification,
    quantity: number,
    turnaround: 'economy' | 'standard' | 'rush' = 'standard',
  ): PriceQuote[] {
    const quotes: PriceQuote[] = [];

    this.fabricators.forEach((fab) => {
      const dfm = this.runDfmCheck(spec, fab.id);
      if (dfm.passed) {
        quotes.push(this.getQuote(spec, fab.id, quantity, turnaround));
      }
    });

    quotes.sort((a, b) => a.grandTotal - b.grandTotal);
    return quotes;
  }

  // -----------------------------------------------------------------------
  // Order Management
  // -----------------------------------------------------------------------

  /** Create a new order in draft status. */
  createOrder(fabricatorId: FabricatorId, spec: BoardSpecification, quantity: number): PcbOrder {
    if (!this.fabricators.has(fabricatorId)) {
      throw new Error(`Unknown fabricator: ${fabricatorId}`);
    }

    if (quantity <= 0) {
      throw new Error('Quantity must be greater than zero');
    }

    const now = Date.now();
    const order: PcbOrder = {
      id: crypto.randomUUID(),
      status: 'draft',
      fabricator: fabricatorId,
      boardSpec: { ...spec },
      quantity,
      quote: null,
      dfmResult: null,
      createdAt: now,
      updatedAt: now,
      notes: '',
    };

    this.orders.push(order);
    this.save();
    this.notify();
    return { ...order };
  }

  /** Get an order by ID. Returns null if not found. */
  getOrder(id: string): PcbOrder | null {
    const order = this.orders.find((o) => o.id === id);
    return order ? { ...order } : null;
  }

  /** Get all orders. */
  getAllOrders(): PcbOrder[] {
    return this.orders.map((o) => ({ ...o }));
  }

  /** Update an order's properties. Returns the updated order or null if not found. */
  updateOrder(orderId: string, updates: Partial<Pick<PcbOrder, 'quantity' | 'notes' | 'gerberFileIds'>>): PcbOrder | null {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) {
      return null;
    }

    if (updates.quantity !== undefined) {
      if (updates.quantity <= 0) {
        throw new Error('Quantity must be greater than zero');
      }
      order.quantity = updates.quantity;
    }
    if (updates.notes !== undefined) {
      order.notes = updates.notes;
    }
    if (updates.gerberFileIds !== undefined) {
      order.gerberFileIds = updates.gerberFileIds;
    }

    order.updatedAt = Date.now();
    this.save();
    this.notify();
    return { ...order };
  }

  /** Cancel an order. Returns false if not found or already submitted. */
  cancelOrder(id: string): boolean {
    const order = this.orders.find((o) => o.id === id);
    if (!order) {
      return false;
    }

    if (order.status === 'submitted' || order.status === 'processing' || order.status === 'shipped' || order.status === 'delivered') {
      return false;
    }

    order.status = 'error';
    order.updatedAt = Date.now();
    order.notes = order.notes ? `${order.notes}\nOrder cancelled.` : 'Order cancelled.';
    this.save();
    this.notify();
    return true;
  }

  /** Get orders filtered by status. */
  getOrdersByStatus(status: OrderStatus): PcbOrder[] {
    return this.orders.filter((o) => o.status === status).map((o) => ({ ...o }));
  }

  // -----------------------------------------------------------------------
  // Order Workflow
  // -----------------------------------------------------------------------

  /** Submit an order: runs DFM check, generates quote, and transitions to submitted if DFM passes. */
  submitOrder(orderId: string): PcbOrder {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    // Run DFM check
    order.status = 'dfm-check';
    order.updatedAt = Date.now();
    const dfmResult = this.runDfmCheck(order.boardSpec, order.fabricator);
    order.dfmResult = dfmResult;

    if (!dfmResult.passed) {
      order.status = 'error';
      order.updatedAt = Date.now();
      this.save();
      this.notify();
      return { ...order };
    }

    // Generate quote
    order.status = 'quoting';
    order.updatedAt = Date.now();
    const quote = this.getQuote(order.boardSpec, order.fabricator, order.quantity);
    order.quote = quote;

    // Mark as submitted
    order.status = 'submitted';
    order.submittedAt = Date.now();
    order.updatedAt = Date.now();
    this.save();
    this.notify();
    return { ...order };
  }

  // -----------------------------------------------------------------------
  // History
  // -----------------------------------------------------------------------

  /** Get order history (all orders sorted by creation date, newest first). */
  getOrderHistory(): PcbOrder[] {
    return [...this.orders].sort((a, b) => b.createdAt - a.createdAt).map((o) => ({ ...o }));
  }

  /** Clear all order history. */
  clearHistory(): void {
    this.orders = [];
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Import / Export
  // -----------------------------------------------------------------------

  /** Export all orders as a JSON string. */
  exportOrders(): string {
    return JSON.stringify(this.orders, null, 2);
  }

  /** Import orders from a JSON string. Returns count of imported orders and any errors. */
  importOrders(json: string): { imported: number; errors: string[] } {
    const errors: string[] = [];
    let parsed: unknown;

    try {
      parsed = JSON.parse(json);
    } catch {
      return { imported: 0, errors: ['Invalid JSON format'] };
    }

    if (!Array.isArray(parsed)) {
      return { imported: 0, errors: ['Expected an array of orders'] };
    }

    let imported = 0;

    parsed.forEach((item: unknown, index: number) => {
      if (typeof item !== 'object' || item === null) {
        errors.push(`Order at index ${index}: not an object`);
        return;
      }

      const record = item as Record<string, unknown>;

      if (typeof record.id !== 'string' || typeof record.status !== 'string' || typeof record.fabricator !== 'string') {
        errors.push(`Order at index ${index}: missing required fields (id, status, fabricator)`);
        return;
      }

      // Don't import duplicates
      if (this.orders.some((o) => o.id === record.id)) {
        errors.push(`Order at index ${index}: duplicate id ${record.id}`);
        return;
      }

      this.orders.push(item as PcbOrder);
      imported++;
    });

    if (imported > 0) {
      this.save();
      this.notify();
    }

    return { imported, errors };
  }

  // -----------------------------------------------------------------------
  // Clear
  // -----------------------------------------------------------------------

  /** Clear all state (orders). */
  clear(): void {
    this.orders = [];
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  private save(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.orders));
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
      if (!Array.isArray(parsed)) {
        return;
      }

      this.orders = (parsed as unknown[]).filter(
        (item: unknown): item is PcbOrder =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as PcbOrder).id === 'string' &&
          typeof (item as PcbOrder).status === 'string' &&
          typeof (item as PcbOrder).fabricator === 'string' &&
          typeof (item as PcbOrder).createdAt === 'number',
      );
    } catch {
      // Corrupt data — keep empty
    }
  }
}

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

/**
 * Hook for accessing the PCB ordering engine in React components.
 * Subscribes to the PcbOrderingEngine singleton and triggers re-renders on state changes.
 */
export function usePcbOrdering(): {
  fabricators: FabricatorProfile[];
  runDfmCheck: (spec: BoardSpecification, fabricatorId: FabricatorId) => DfmCheckResult;
  getQuote: (
    spec: BoardSpecification,
    fabricatorId: FabricatorId,
    quantity: number,
    turnaround?: 'economy' | 'standard' | 'rush',
  ) => PriceQuote;
  compareQuotes: (spec: BoardSpecification, quantity: number) => PriceQuote[];
  createOrder: (fabricatorId: FabricatorId, spec: BoardSpecification, quantity: number) => PcbOrder;
  submitOrder: (orderId: string) => PcbOrder;
  orders: PcbOrder[];
  cancelOrder: (id: string) => boolean;
  compareFabricators: (
    spec: BoardSpecification,
  ) => Array<{ fabricator: FabricatorProfile; compatible: boolean; issues: string[] }>;
  orderHistory: PcbOrder[];
  exportOrders: () => string;
  importOrders: (json: string) => { imported: number; errors: string[] };
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const engine = PcbOrderingEngine.getInstance();
    const unsubscribe = engine.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const runDfmCheck = useCallback((spec: BoardSpecification, fabricatorId: FabricatorId) => {
    return PcbOrderingEngine.getInstance().runDfmCheck(spec, fabricatorId);
  }, []);

  const getQuote = useCallback(
    (
      spec: BoardSpecification,
      fabricatorId: FabricatorId,
      quantity: number,
      turnaround?: 'economy' | 'standard' | 'rush',
    ) => {
      return PcbOrderingEngine.getInstance().getQuote(spec, fabricatorId, quantity, turnaround);
    },
    [],
  );

  const compareQuotes = useCallback((spec: BoardSpecification, quantity: number) => {
    return PcbOrderingEngine.getInstance().compareQuotes(spec, quantity);
  }, []);

  const createOrder = useCallback(
    (fabricatorId: FabricatorId, spec: BoardSpecification, quantity: number) => {
      return PcbOrderingEngine.getInstance().createOrder(fabricatorId, spec, quantity);
    },
    [],
  );

  const submitOrder = useCallback((orderId: string) => {
    return PcbOrderingEngine.getInstance().submitOrder(orderId);
  }, []);

  const cancelOrder = useCallback((id: string) => {
    return PcbOrderingEngine.getInstance().cancelOrder(id);
  }, []);

  const compareFabricators = useCallback((spec: BoardSpecification) => {
    return PcbOrderingEngine.getInstance().compareFabricators(spec);
  }, []);

  const exportOrders = useCallback(() => {
    return PcbOrderingEngine.getInstance().exportOrders();
  }, []);

  const importOrders = useCallback((json: string) => {
    return PcbOrderingEngine.getInstance().importOrders(json);
  }, []);

  const engine = typeof window !== 'undefined' ? PcbOrderingEngine.getInstance() : null;

  return {
    fabricators: engine?.getAllFabricators() ?? [],
    runDfmCheck,
    getQuote,
    compareQuotes,
    createOrder,
    submitOrder,
    orders: engine?.getAllOrders() ?? [],
    cancelOrder,
    compareFabricators,
    orderHistory: engine?.getOrderHistory() ?? [],
    exportOrders,
    importOrders,
  };
}
