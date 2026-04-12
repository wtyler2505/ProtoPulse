/**
 * Assembly Cost Estimator
 *
 * Calculates total manufacturing cost (board fabrication + components + assembly labor)
 * at various production quantities. Supports multiple assembly service profiles, NRE
 * tracking, cost optimization suggestions, margin calculator, and currency conversion.
 *
 * Singleton + Subscribe pattern for React integration. Persists to localStorage.
 *
 * Usage:
 *   const estimator = AssemblyCostEstimator.getInstance();
 *   const estimate = estimator.createEstimate(bomItems, boardParams);
 *   const breakdown = estimator.calculateCost(estimate.id, 100, 'jlcpcb_assembly');
 *
 * React hook:
 *   const { estimates, createEstimate, calculateCost, compareCosts, ... } = useAssemblyCost();
 */

import { useCallback, useEffect, useState } from 'react';

import type { BomItem } from '@shared/types/bom-compat';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AssemblyProfileId = 'jlcpcb_assembly' | 'pcbway_assembly' | 'manual_diy';
export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'CNY' | 'JPY';
export type MountType = 'smt' | 'through_hole' | 'mixed' | 'unknown';
export type CostCategory =
  | 'pcb_fabrication'
  | 'component_procurement'
  | 'smt_assembly'
  | 'through_hole_assembly'
  | 'hand_soldering'
  | 'testing_qc'
  | 'tooling';

export const QUANTITY_TIERS = [1, 5, 10, 25, 50, 100, 250, 500, 1000] as const;
export type QuantityTier = (typeof QUANTITY_TIERS)[number];

export interface BoardParameters {
  widthMm: number;
  heightMm: number;
  layers: number;
  finish: string;
  impedanceControl: boolean;
  viaInPad: boolean;
  goldFingers: boolean;
}

export interface NreCosts {
  stencil: number;
  programming: number;
  testFixture: number;
  customTooling: number;
}

export interface CostLineItem {
  category: CostCategory;
  label: string;
  unitCost: number;
  totalCost: number;
  notes?: string;
}

export interface CostBreakdown {
  profileId: AssemblyProfileId;
  profileName: string;
  quantity: number;
  lineItems: CostLineItem[];
  nre: NreCosts;
  nreTotal: number;
  subtotalPerUnit: number;
  subtotalTotal: number;
  grandTotal: number;
  grandTotalPerUnit: number;
  currency: CurrencyCode;
}

export interface CostComparison {
  quantity: number;
  profiles: CostBreakdown[];
}

export interface QuantityCurve {
  profileId: AssemblyProfileId;
  points: Array<{ quantity: QuantityTier; unitCost: number; totalCost: number }>;
}

export interface CostOptimizationSuggestion {
  type: 'consolidate_values' | 'switch_to_smt' | 'reduce_unique_parts' | 'increase_quantity' | 'change_profile';
  title: string;
  description: string;
  estimatedSavings: number;
  currency: CurrencyCode;
}

export interface MarginResult {
  costPerUnit: number;
  marginPercent: number;
  markupPerUnit: number;
  sellingPricePerUnit: number;
  totalRevenue: number;
  totalProfit: number;
  quantity: number;
  currency: CurrencyCode;
}

export interface AssemblyProfile {
  id: AssemblyProfileId;
  name: string;
  description: string;
  smtCostPerPin: number;
  smtMinCharge: number;
  throughHoleCostPerPin: number;
  throughHoleMinCharge: number;
  handSolderCostPerJoint: number;
  setupFee: number;
  testingPerBoard: number;
  stencilCost: number;
  programmingCost: number;
  testFixtureCost: number;
  uniquePartPenaltyThreshold: number;
  uniquePartPenaltyPerPart: number;
  boardAreaCostPerSqCm: number;
  layerMultiplier: number;
  finishUpcharges: Record<string, number>;
  specialProcessUpcharges: {
    impedanceControl: number;
    viaInPad: number;
    goldFingers: number;
  };
  quantityDiscounts: Array<{ minQty: number; discount: number }>;
  currency: CurrencyCode;
}

export interface CostEstimate {
  id: string;
  name: string;
  bomItems: BomItemInput[];
  boardParams: BoardParameters;
  nreOverrides: Partial<NreCosts>;
  createdAt: number;
  updatedAt: number;
}

export interface BomItemInput {
  partNumber: string;
  manufacturer: string;
  description: string;
  quantity: number;
  unitPrice: number;
  mountType: MountType;
  pinCount: number;
  assemblyCategory?: string | null;
}

export interface EstimateExport {
  version: 1;
  exportedAt: number;
  estimates: CostEstimate[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-assembly-cost-estimates';

const CURRENCY_RATES: Record<CurrencyCode, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  CNY: 7.24,
  JPY: 149.5,
};

type Listener = () => void;

// ---------------------------------------------------------------------------
// Built-in Assembly Profiles
// ---------------------------------------------------------------------------

const ASSEMBLY_PROFILES: AssemblyProfile[] = [
  {
    id: 'jlcpcb_assembly',
    name: 'JLCPCB Assembly',
    description: 'JLCPCB SMT assembly service. Competitive pricing for small to medium batches. Limited through-hole support.',
    smtCostPerPin: 0.0017,
    smtMinCharge: 8.0,
    throughHoleCostPerPin: 0.02,
    throughHoleMinCharge: 15.0,
    handSolderCostPerJoint: 0.05,
    setupFee: 8.0,
    testingPerBoard: 0.5,
    stencilCost: 1.5,
    programmingCost: 3.0,
    testFixtureCost: 20.0,
    uniquePartPenaltyThreshold: 5,
    uniquePartPenaltyPerPart: 3.0,
    boardAreaCostPerSqCm: 0.03,
    layerMultiplier: 0.35,
    finishUpcharges: {
      HASL: 0,
      ENIG: 8,
      OSP: 2,
      ENEPIG: 15,
      Immersion_Tin: 5,
      Immersion_Silver: 6,
    },
    specialProcessUpcharges: {
      impedanceControl: 12.0,
      viaInPad: 8.0,
      goldFingers: 15.0,
    },
    quantityDiscounts: [
      { minQty: 10, discount: 0.05 },
      { minQty: 50, discount: 0.10 },
      { minQty: 100, discount: 0.15 },
      { minQty: 250, discount: 0.20 },
      { minQty: 500, discount: 0.25 },
      { minQty: 1000, discount: 0.30 },
    ],
    currency: 'USD',
  },
  {
    id: 'pcbway_assembly',
    name: 'PCBWay Assembly',
    description: 'PCBWay turnkey assembly service. Good through-hole support. Higher base pricing, broader capabilities.',
    smtCostPerPin: 0.002,
    smtMinCharge: 10.0,
    throughHoleCostPerPin: 0.025,
    throughHoleMinCharge: 20.0,
    handSolderCostPerJoint: 0.06,
    setupFee: 10.0,
    testingPerBoard: 0.75,
    stencilCost: 2.0,
    programmingCost: 5.0,
    testFixtureCost: 30.0,
    uniquePartPenaltyThreshold: 8,
    uniquePartPenaltyPerPart: 2.5,
    boardAreaCostPerSqCm: 0.04,
    layerMultiplier: 0.40,
    finishUpcharges: {
      HASL: 0,
      ENIG: 10,
      OSP: 3,
      Immersion_Tin: 6,
      Immersion_Silver: 7,
    },
    specialProcessUpcharges: {
      impedanceControl: 15.0,
      viaInPad: 10.0,
      goldFingers: 18.0,
    },
    quantityDiscounts: [
      { minQty: 10, discount: 0.03 },
      { minQty: 50, discount: 0.08 },
      { minQty: 100, discount: 0.12 },
      { minQty: 250, discount: 0.18 },
      { minQty: 500, discount: 0.22 },
      { minQty: 1000, discount: 0.28 },
    ],
    currency: 'USD',
  },
  {
    id: 'manual_diy',
    name: 'Manual / DIY Assembly',
    description: 'Hand assembly by the maker. No per-pin fees — costs are based on time estimate and consumables. Great for prototypes and learning.',
    smtCostPerPin: 0.0,
    smtMinCharge: 0.0,
    throughHoleCostPerPin: 0.0,
    throughHoleMinCharge: 0.0,
    handSolderCostPerJoint: 0.01,
    setupFee: 0.0,
    testingPerBoard: 0.25,
    stencilCost: 15.0,
    programmingCost: 0.0,
    testFixtureCost: 0.0,
    uniquePartPenaltyThreshold: 999,
    uniquePartPenaltyPerPart: 0.0,
    boardAreaCostPerSqCm: 0.03,
    layerMultiplier: 0.35,
    finishUpcharges: {
      HASL: 0,
      ENIG: 8,
      OSP: 2,
    },
    specialProcessUpcharges: {
      impedanceControl: 12.0,
      viaInPad: 8.0,
      goldFingers: 15.0,
    },
    quantityDiscounts: [],
    currency: 'USD',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Classify mount type from a BOM item's description and assemblyCategory. */
export function classifyMountType(description: string, assemblyCategory?: string | null): MountType {
  const desc = (description + ' ' + (assemblyCategory ?? '')).toLowerCase();
  const smtPatterns = ['smd', 'smt', '0402', '0603', '0805', '1206', '1210', '2512', 'qfp', 'qfn', 'bga', 'soic', 'sop', 'tssop', 'msop', 'dfn', 'lga'];
  const thPatterns = ['through-hole', 'through hole', 'dip', 'sip', 'to-220', 'to-92', 'axial', 'radial', 'pth'];

  const isSmt = smtPatterns.some((p) => desc.includes(p));
  const isTh = thPatterns.some((p) => desc.includes(p));

  if (isSmt && isTh) {
    return 'mixed';
  }
  if (isSmt) {
    return 'smt';
  }
  if (isTh) {
    return 'through_hole';
  }
  return 'unknown';
}

/** Estimate pin count from description heuristics. */
export function estimatePinCount(description: string): number {
  const desc = description.toLowerCase();

  // Explicit pin count patterns
  const pinMatch = desc.match(/(\d+)\s*-?\s*pin/);
  if (pinMatch) {
    return parseInt(pinMatch[1], 10);
  }

  // Package-based estimates
  if (desc.includes('0402') || desc.includes('0603') || desc.includes('0805') || desc.includes('1206')) {
    return 2;
  }
  if (desc.includes('sot-23')) {
    return 3;
  }
  if (desc.includes('sot-223') || desc.includes('sot-89')) {
    return 4;
  }
  if (desc.includes('soic-8') || desc.includes('dip-8') || desc.includes('so-8')) {
    return 8;
  }
  if (desc.includes('soic-14') || desc.includes('dip-14')) {
    return 14;
  }
  if (desc.includes('soic-16') || desc.includes('dip-16')) {
    return 16;
  }
  if (desc.includes('tqfp-32') || desc.includes('qfp-32')) {
    return 32;
  }
  if (desc.includes('tqfp-44') || desc.includes('qfp-44')) {
    return 44;
  }
  if (desc.includes('tqfp-64') || desc.includes('qfp-64')) {
    return 64;
  }
  if (desc.includes('tqfp-100') || desc.includes('qfp-100')) {
    return 100;
  }
  if (desc.includes('bga')) {
    const bgaMatch = desc.match(/bga[- ]?(\d+)/);
    return bgaMatch ? parseInt(bgaMatch[1], 10) : 64;
  }

  // Default for passives/generic
  return 2;
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
    // Chip packages: use (?<!\d) lookbehind instead of \b so that
    // part numbers like "RC0805JR" still match (letter before digits).
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
      // For numbered packages, include the pin/size number
      if (match[1]) {
        return `${label}-${match[1]}`;
      }
      return label;
    }
  }

  return 'unknown';
}

/**
 * Minimal shape required to convert a BOM item into an assembly cost input.
 * Both the schema BomItem and the client-side BomItem satisfy this interface.
 */
export interface BomItemLike {
  partNumber: string;
  manufacturer: string;
  description: string;
  quantity: number;
  unitPrice: string | number;
  assemblyCategory?: string | null;
}

/** Convert a BomItem (schema or client-side) to our internal input format. */
export function bomItemToInput(item: BomItemLike): BomItemInput {
  // Try description first; fall back to partNumber for additional hints only
  // when the description alone is insufficient.
  let mountType = classifyMountType(item.description, item.assemblyCategory);
  if (mountType === 'unknown') {
    mountType = classifyMountType(item.partNumber, item.assemblyCategory);
  }

  let pinCount = estimatePinCount(item.description);
  if (pinCount === 2) {
    // 2 is the default — see if partNumber has a better answer
    const fromPn = estimatePinCount(item.partNumber);
    if (fromPn !== 2) {
      pinCount = fromPn;
    }
  }

  return {
    partNumber: item.partNumber,
    manufacturer: item.manufacturer,
    description: item.description,
    quantity: item.quantity,
    unitPrice: typeof item.unitPrice === 'string' ? parseFloat(item.unitPrice) : Number(item.unitPrice),
    mountType,
    pinCount,
    assemblyCategory: item.assemblyCategory,
  };
}

/**
 * Convert an array of BomItems from the project BOM to BomItemInput[] suitable
 * for the assembly cost estimator.
 *
 * This is the primary bridge between the project's BOM data and the cost
 * calculator. It uses description + partNumber for package, mount type, and
 * pin count inference.
 *
 * Items with quantity <= 0 are skipped. Missing or blank descriptions default
 * gracefully (SMD, 2-pin, package 'unknown').
 */
export function bomToAssemblyParts(bomItems: BomItemLike[]): BomItemInput[] {
  return bomItems
    .filter((item) => item.quantity > 0)
    .map((item) => bomItemToInput(item));
}

/** Convert an amount from one currency to another. */
export function convertCurrency(amount: number, from: CurrencyCode, to: CurrencyCode): number {
  if (from === to) {
    return amount;
  }
  const usdAmount = amount / CURRENCY_RATES[from];
  return usdAmount * CURRENCY_RATES[to];
}

/** Round to 2 decimal places. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// AssemblyCostEstimator
// ---------------------------------------------------------------------------

export class AssemblyCostEstimator {
  private static instance: AssemblyCostEstimator | null = null;

  private estimates: CostEstimate[] = [];
  private listeners = new Set<Listener>();
  private profiles: Map<AssemblyProfileId, AssemblyProfile>;

  constructor() {
    this.profiles = new Map<AssemblyProfileId, AssemblyProfile>();
    ASSEMBLY_PROFILES.forEach((p) => {
      this.profiles.set(p.id, p);
    });
    this.estimates = [];
    this.load();
  }

  static getInstance(): AssemblyCostEstimator {
    if (!AssemblyCostEstimator.instance) {
      AssemblyCostEstimator.instance = new AssemblyCostEstimator();
    }
    return AssemblyCostEstimator.instance;
  }

  static resetForTesting(): void {
    AssemblyCostEstimator.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

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
  // Profile Access
  // -----------------------------------------------------------------------

  getProfile(id: AssemblyProfileId): AssemblyProfile | null {
    return this.profiles.get(id) ?? null;
  }

  getAllProfiles(): AssemblyProfile[] {
    const result: AssemblyProfile[] = [];
    this.profiles.forEach((p) => {
      result.push(p);
    });
    return result;
  }

  // -----------------------------------------------------------------------
  // Estimate CRUD
  // -----------------------------------------------------------------------

  createEstimate(
    bomItems: BomItemInput[],
    boardParams: BoardParameters,
    name?: string,
  ): CostEstimate {
    const now = Date.now();
    const estimate: CostEstimate = {
      id: crypto.randomUUID(),
      name: name ?? `Estimate ${new Date(now).toLocaleDateString()}`,
      bomItems: [...bomItems],
      boardParams: { ...boardParams },
      nreOverrides: {},
      createdAt: now,
      updatedAt: now,
    };
    this.estimates.push(estimate);
    this.save();
    this.notify();
    return { ...estimate };
  }

  getEstimate(id: string): CostEstimate | null {
    const est = this.estimates.find((e) => e.id === id);
    return est ? { ...est } : null;
  }

  getAllEstimates(): CostEstimate[] {
    return this.estimates.map((e) => ({ ...e }));
  }

  updateEstimate(
    id: string,
    updates: Partial<Pick<CostEstimate, 'name' | 'bomItems' | 'boardParams' | 'nreOverrides'>>,
  ): CostEstimate | null {
    const est = this.estimates.find((e) => e.id === id);
    if (!est) {
      return null;
    }
    if (updates.name !== undefined) {
      est.name = updates.name;
    }
    if (updates.bomItems !== undefined) {
      est.bomItems = [...updates.bomItems];
    }
    if (updates.boardParams !== undefined) {
      est.boardParams = { ...updates.boardParams };
    }
    if (updates.nreOverrides !== undefined) {
      est.nreOverrides = { ...updates.nreOverrides };
    }
    est.updatedAt = Date.now();
    this.save();
    this.notify();
    return { ...est };
  }

  deleteEstimate(id: string): boolean {
    const index = this.estimates.findIndex((e) => e.id === id);
    if (index === -1) {
      return false;
    }
    this.estimates.splice(index, 1);
    this.save();
    this.notify();
    return true;
  }

  // -----------------------------------------------------------------------
  // Cost Calculation
  // -----------------------------------------------------------------------

  calculateCost(
    estimateId: string,
    quantity: number,
    profileId: AssemblyProfileId,
    currency: CurrencyCode = 'USD',
  ): CostBreakdown | null {
    const est = this.estimates.find((e) => e.id === estimateId);
    if (!est) {
      return null;
    }
    return this.calculateCostFromData(est.bomItems, est.boardParams, est.nreOverrides, quantity, profileId, currency);
  }

  calculateCostFromData(
    bomItems: BomItemInput[],
    boardParams: BoardParameters,
    nreOverrides: Partial<NreCosts>,
    quantity: number,
    profileId: AssemblyProfileId,
    currency: CurrencyCode = 'USD',
  ): CostBreakdown | null {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      return null;
    }
    if (quantity <= 0) {
      return null;
    }

    const lineItems: CostLineItem[] = [];

    // --- PCB Fabrication ---
    const boardAreaSqCm = (boardParams.widthMm * boardParams.heightMm) / 100;
    const extraLayers = Math.max(0, boardParams.layers - 2);
    const layerUpcharge = extraLayers * profile.layerMultiplier * boardAreaSqCm;
    const finishUpcharge = profile.finishUpcharges[boardParams.finish] ?? 0;
    let specialUpcharge = 0;
    if (boardParams.impedanceControl) {
      specialUpcharge += profile.specialProcessUpcharges.impedanceControl;
    }
    if (boardParams.viaInPad) {
      specialUpcharge += profile.specialProcessUpcharges.viaInPad;
    }
    if (boardParams.goldFingers) {
      specialUpcharge += profile.specialProcessUpcharges.goldFingers;
    }

    const pcbUnitCost = boardAreaSqCm * profile.boardAreaCostPerSqCm + layerUpcharge + finishUpcharge + specialUpcharge;
    lineItems.push({
      category: 'pcb_fabrication',
      label: 'PCB fabrication',
      unitCost: round2(pcbUnitCost),
      totalCost: round2(pcbUnitCost * quantity),
      notes: `${boardAreaSqCm.toFixed(1)} sq cm, ${boardParams.layers} layers, ${boardParams.finish}`,
    });

    // --- Component Procurement ---
    let componentCostPerBoard = 0;
    bomItems.forEach((item) => {
      componentCostPerBoard += item.unitPrice * item.quantity;
    });
    lineItems.push({
      category: 'component_procurement',
      label: 'Component procurement',
      unitCost: round2(componentCostPerBoard),
      totalCost: round2(componentCostPerBoard * quantity),
      notes: `${bomItems.length} line items`,
    });

    // --- SMT Assembly ---
    const smtItems = bomItems.filter((i) => i.mountType === 'smt' || i.mountType === 'mixed');
    let smtPins = 0;
    smtItems.forEach((item) => {
      smtPins += item.pinCount * item.quantity;
    });
    const smtRawCost = smtPins * profile.smtCostPerPin;
    const smtCostPerBoard = smtItems.length > 0 ? Math.max(smtRawCost, profile.smtMinCharge) : 0;
    if (smtCostPerBoard > 0) {
      lineItems.push({
        category: 'smt_assembly',
        label: 'SMT assembly',
        unitCost: round2(smtCostPerBoard),
        totalCost: round2(smtCostPerBoard * quantity),
        notes: `${smtPins} pins across ${smtItems.length} line items`,
      });
    }

    // --- Through-Hole Assembly ---
    const thItems = bomItems.filter((i) => i.mountType === 'through_hole' || i.mountType === 'mixed');
    let thPins = 0;
    thItems.forEach((item) => {
      thPins += item.pinCount * item.quantity;
    });
    const thRawCost = thPins * profile.throughHoleCostPerPin;
    const thCostPerBoard = thItems.length > 0 ? Math.max(thRawCost, profile.throughHoleMinCharge) : 0;
    if (thCostPerBoard > 0) {
      lineItems.push({
        category: 'through_hole_assembly',
        label: 'Through-hole assembly',
        unitCost: round2(thCostPerBoard),
        totalCost: round2(thCostPerBoard * quantity),
        notes: `${thPins} pins across ${thItems.length} line items`,
      });
    }

    // --- Hand Soldering (for unknown/misc) ---
    const handItems = bomItems.filter((i) => i.mountType === 'unknown');
    let handJoints = 0;
    handItems.forEach((item) => {
      handJoints += item.pinCount * item.quantity;
    });
    const handSolderCost = handJoints * profile.handSolderCostPerJoint;
    if (handSolderCost > 0) {
      lineItems.push({
        category: 'hand_soldering',
        label: 'Hand soldering (unclassified parts)',
        unitCost: round2(handSolderCost),
        totalCost: round2(handSolderCost * quantity),
        notes: `${handJoints} joints across ${handItems.length} line items`,
      });
    }

    // --- Testing / QC ---
    const testingCost = profile.testingPerBoard;
    if (testingCost > 0) {
      lineItems.push({
        category: 'testing_qc',
        label: 'Testing & QC',
        unitCost: round2(testingCost),
        totalCost: round2(testingCost * quantity),
      });
    }

    // --- Tooling: Setup fee ---
    if (profile.setupFee > 0) {
      lineItems.push({
        category: 'tooling',
        label: 'Setup fee',
        unitCost: round2(profile.setupFee / quantity),
        totalCost: round2(profile.setupFee),
        notes: 'Amortized across quantity',
      });
    }

    // --- Unique Part Penalty ---
    const uniqueParts = new Set(bomItems.map((i) => i.partNumber)).size;
    const excessParts = Math.max(0, uniqueParts - profile.uniquePartPenaltyThreshold);
    const uniquePartPenalty = excessParts * profile.uniquePartPenaltyPerPart;
    if (uniquePartPenalty > 0) {
      lineItems.push({
        category: 'tooling',
        label: 'Unique part count surcharge',
        unitCost: round2(uniquePartPenalty / quantity),
        totalCost: round2(uniquePartPenalty),
        notes: `${uniqueParts} unique parts (threshold: ${profile.uniquePartPenaltyThreshold})`,
      });
    }

    // --- NRE ---
    const nre: NreCosts = {
      stencil: nreOverrides.stencil ?? profile.stencilCost,
      programming: nreOverrides.programming ?? profile.programmingCost,
      testFixture: nreOverrides.testFixture ?? profile.testFixtureCost,
      customTooling: nreOverrides.customTooling ?? 0,
    };
    const nreTotal = nre.stencil + nre.programming + nre.testFixture + nre.customTooling;

    // --- Quantity Discount ---
    let discount = 0;
    for (const tier of profile.quantityDiscounts) {
      if (quantity >= tier.minQty) {
        discount = tier.discount;
      }
    }

    // --- Sum up ---
    let subtotalPerUnit = 0;
    lineItems.forEach((li) => {
      subtotalPerUnit += li.unitCost;
    });
    let subtotalTotal = 0;
    lineItems.forEach((li) => {
      subtotalTotal += li.totalCost;
    });

    // Apply discount to assembly costs only (not PCB fab or components)
    if (discount > 0) {
      const assemblyCosts = lineItems
        .filter((li) => li.category === 'smt_assembly' || li.category === 'through_hole_assembly' || li.category === 'hand_soldering')
        .reduce((sum, li) => sum + li.totalCost, 0);
      const discountAmount = assemblyCosts * discount;
      subtotalTotal -= discountAmount;
      subtotalPerUnit = subtotalTotal / quantity;
    }

    subtotalPerUnit = round2(subtotalPerUnit);
    subtotalTotal = round2(subtotalTotal);
    const grandTotal = round2(subtotalTotal + nreTotal);
    const grandTotalPerUnit = round2(grandTotal / quantity);

    // Currency conversion
    const toCurrency = (amount: number): number =>
      round2(convertCurrency(amount, profile.currency, currency));

    const convertedLineItems = lineItems.map((li) => ({
      ...li,
      unitCost: toCurrency(li.unitCost),
      totalCost: toCurrency(li.totalCost),
    }));

    const convertedNre: NreCosts = {
      stencil: toCurrency(nre.stencil),
      programming: toCurrency(nre.programming),
      testFixture: toCurrency(nre.testFixture),
      customTooling: toCurrency(nre.customTooling),
    };

    return {
      profileId,
      profileName: profile.name,
      quantity,
      lineItems: convertedLineItems,
      nre: convertedNre,
      nreTotal: toCurrency(nreTotal),
      subtotalPerUnit: toCurrency(subtotalPerUnit),
      subtotalTotal: toCurrency(subtotalTotal),
      grandTotal: toCurrency(grandTotal),
      grandTotalPerUnit: toCurrency(grandTotalPerUnit),
      currency,
    };
  }

  // -----------------------------------------------------------------------
  // Comparison
  // -----------------------------------------------------------------------

  compareCosts(
    estimateId: string,
    quantity: number,
    profileIds?: AssemblyProfileId[],
    currency: CurrencyCode = 'USD',
  ): CostComparison | null {
    const est = this.estimates.find((e) => e.id === estimateId);
    if (!est) {
      return null;
    }
    const ids = profileIds ?? (Array.from(this.profiles.keys()) as AssemblyProfileId[]);
    const profiles: CostBreakdown[] = [];
    ids.forEach((pid) => {
      const breakdown = this.calculateCost(est.id, quantity, pid, currency);
      if (breakdown) {
        profiles.push(breakdown);
      }
    });
    profiles.sort((a, b) => a.grandTotal - b.grandTotal);
    return { quantity, profiles };
  }

  getQuantityCurve(
    estimateId: string,
    profileId: AssemblyProfileId,
    currency: CurrencyCode = 'USD',
  ): QuantityCurve | null {
    const est = this.estimates.find((e) => e.id === estimateId);
    if (!est) {
      return null;
    }
    const points: QuantityCurve['points'] = [];
    QUANTITY_TIERS.forEach((qty) => {
      const breakdown = this.calculateCost(est.id, qty, profileId, currency);
      if (breakdown) {
        points.push({
          quantity: qty,
          unitCost: breakdown.grandTotalPerUnit,
          totalCost: breakdown.grandTotal,
        });
      }
    });
    return { profileId, points };
  }

  // -----------------------------------------------------------------------
  // Cost Optimization Suggestions
  // -----------------------------------------------------------------------

  getOptimizationSuggestions(
    estimateId: string,
    profileId: AssemblyProfileId,
    quantity: number,
    currency: CurrencyCode = 'USD',
  ): CostOptimizationSuggestion[] {
    const est = this.estimates.find((e) => e.id === estimateId);
    if (!est) {
      return [];
    }
    const profile = this.profiles.get(profileId);
    if (!profile) {
      return [];
    }

    const suggestions: CostOptimizationSuggestion[] = [];

    // --- Suggestion: Consolidate resistor/capacitor values ---
    const resistors = est.bomItems.filter((i) => i.description.toLowerCase().includes('resistor') || i.description.toLowerCase().includes('res'));
    if (resistors.length >= 3) {
      const possibleSavings = (resistors.length - 1) * profile.uniquePartPenaltyPerPart;
      if (possibleSavings > 0) {
        suggestions.push({
          type: 'consolidate_values',
          title: 'Consolidate resistor values',
          description: `You have ${resistors.length} different resistor values. Consolidating where possible reduces unique part count and may save on feeder setup fees.`,
          estimatedSavings: round2(convertCurrency(possibleSavings, profile.currency, currency)),
          currency,
        });
      }
    }

    const capacitors = est.bomItems.filter((i) => i.description.toLowerCase().includes('capacitor') || i.description.toLowerCase().includes('cap'));
    if (capacitors.length >= 3) {
      const possibleSavings = (capacitors.length - 1) * profile.uniquePartPenaltyPerPart;
      if (possibleSavings > 0) {
        suggestions.push({
          type: 'consolidate_values',
          title: 'Consolidate capacitor values',
          description: `You have ${capacitors.length} different capacitor values. Consolidating where possible reduces unique part count.`,
          estimatedSavings: round2(convertCurrency(possibleSavings, profile.currency, currency)),
          currency,
        });
      }
    }

    // --- Suggestion: Switch through-hole to SMT ---
    const thItems = est.bomItems.filter((i) => i.mountType === 'through_hole');
    if (thItems.length > 0) {
      let thPins = 0;
      thItems.forEach((i) => {
        thPins += i.pinCount * i.quantity;
      });
      const thCost = Math.max(thPins * profile.throughHoleCostPerPin, profile.throughHoleMinCharge);
      const smtCost = Math.max(thPins * profile.smtCostPerPin, profile.smtMinCharge);
      const savings = (thCost - smtCost) * quantity;
      if (savings > 1) {
        suggestions.push({
          type: 'switch_to_smt',
          title: 'Switch through-hole parts to SMT equivalents',
          description: `${thItems.length} through-hole parts could potentially use SMT equivalents, saving on assembly cost per board.`,
          estimatedSavings: round2(convertCurrency(savings, profile.currency, currency)),
          currency,
        });
      }
    }

    // --- Suggestion: Reduce unique parts ---
    const uniqueParts = new Set(est.bomItems.map((i) => i.partNumber)).size;
    if (uniqueParts > profile.uniquePartPenaltyThreshold) {
      const excess = uniqueParts - profile.uniquePartPenaltyThreshold;
      const savings = excess * profile.uniquePartPenaltyPerPart;
      suggestions.push({
        type: 'reduce_unique_parts',
        title: 'Reduce unique part count',
        description: `BOM has ${uniqueParts} unique parts (threshold: ${profile.uniquePartPenaltyThreshold}). Each part above threshold adds $${profile.uniquePartPenaltyPerPart} surcharge.`,
        estimatedSavings: round2(convertCurrency(savings, profile.currency, currency)),
        currency,
      });
    }

    // --- Suggestion: Increase quantity ---
    if (quantity < 100) {
      const currentBreakdown = this.calculateCostFromData(est.bomItems, est.boardParams, est.nreOverrides, quantity, profileId, currency);
      const largerBreakdown = this.calculateCostFromData(est.bomItems, est.boardParams, est.nreOverrides, quantity * 2, profileId, currency);
      if (currentBreakdown && largerBreakdown) {
        const savingsPerUnit = currentBreakdown.grandTotalPerUnit - largerBreakdown.grandTotalPerUnit;
        if (savingsPerUnit > 0.5) {
          suggestions.push({
            type: 'increase_quantity',
            title: `Order ${quantity * 2} instead of ${quantity}`,
            description: `Doubling quantity from ${quantity} to ${quantity * 2} saves $${round2(savingsPerUnit)} per unit due to NRE amortization and volume discounts.`,
            estimatedSavings: round2(savingsPerUnit * quantity),
            currency,
          });
        }
      }
    }

    // --- Suggestion: Change profile ---
    const allProfileIds = Array.from(this.profiles.keys()) as AssemblyProfileId[];
    const currentBreakdown = this.calculateCostFromData(est.bomItems, est.boardParams, est.nreOverrides, quantity, profileId, currency);
    if (currentBreakdown) {
      for (const altId of allProfileIds) {
        if (altId === profileId) {
          continue;
        }
        const altBreakdown = this.calculateCostFromData(est.bomItems, est.boardParams, est.nreOverrides, quantity, altId, currency);
        if (altBreakdown && altBreakdown.grandTotal < currentBreakdown.grandTotal) {
          const savings = currentBreakdown.grandTotal - altBreakdown.grandTotal;
          if (savings > 1) {
            const altProfile = this.profiles.get(altId);
            suggestions.push({
              type: 'change_profile',
              title: `Switch to ${altProfile?.name ?? altId}`,
              description: `${altProfile?.name ?? altId} would be $${round2(savings)} cheaper for ${quantity} boards.`,
              estimatedSavings: round2(savings),
              currency,
            });
          }
        }
      }
    }

    return suggestions;
  }

  // -----------------------------------------------------------------------
  // Margin Calculator
  // -----------------------------------------------------------------------

  calculateMargin(
    estimateId: string,
    quantity: number,
    profileId: AssemblyProfileId,
    marginPercent: number,
    currency: CurrencyCode = 'USD',
  ): MarginResult | null {
    const breakdown = this.calculateCost(estimateId, quantity, profileId, currency);
    if (!breakdown) {
      return null;
    }
    const costPerUnit = breakdown.grandTotalPerUnit;
    const markupPerUnit = round2(costPerUnit * (marginPercent / 100));
    const sellingPricePerUnit = round2(costPerUnit + markupPerUnit);
    const totalRevenue = round2(sellingPricePerUnit * quantity);
    const totalProfit = round2(markupPerUnit * quantity);

    return {
      costPerUnit,
      marginPercent,
      markupPerUnit,
      sellingPricePerUnit,
      totalRevenue,
      totalProfit,
      quantity,
      currency,
    };
  }

  // -----------------------------------------------------------------------
  // Currency
  // -----------------------------------------------------------------------

  getSupportedCurrencies(): CurrencyCode[] {
    return ['USD', 'EUR', 'GBP', 'CNY', 'JPY'];
  }

  getExchangeRate(from: CurrencyCode, to: CurrencyCode): number {
    return round2(convertCurrency(1, from, to) * 100) / 100;
  }

  // -----------------------------------------------------------------------
  // Import / Export
  // -----------------------------------------------------------------------

  exportEstimates(): string {
    const data: EstimateExport = {
      version: 1,
      exportedAt: Date.now(),
      estimates: this.estimates,
    };
    return JSON.stringify(data, null, 2);
  }

  importEstimates(json: string): { imported: number; errors: string[] } {
    const errors: string[] = [];
    let parsed: unknown;

    try {
      parsed = JSON.parse(json);
    } catch {
      return { imported: 0, errors: ['Invalid JSON format'] };
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return { imported: 0, errors: ['Expected an object with version and estimates'] };
    }

    const record = parsed as Record<string, unknown>;

    // Support both wrapped format and raw array
    let items: unknown[];
    if (Array.isArray(record.estimates)) {
      items = record.estimates;
    } else if (Array.isArray(parsed)) {
      items = parsed as unknown[];
    } else {
      return { imported: 0, errors: ['Expected estimates array'] };
    }

    let imported = 0;

    items.forEach((item: unknown, index: number) => {
      if (typeof item !== 'object' || item === null) {
        errors.push(`Estimate at index ${index}: not an object`);
        return;
      }

      const est = item as Record<string, unknown>;
      if (typeof est.id !== 'string' || typeof est.name !== 'string' || !Array.isArray(est.bomItems)) {
        errors.push(`Estimate at index ${index}: missing required fields (id, name, bomItems)`);
        return;
      }

      if (this.estimates.some((e) => e.id === est.id)) {
        errors.push(`Estimate at index ${index}: duplicate id ${est.id}`);
        return;
      }

      this.estimates.push(item as CostEstimate);
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

  clear(): void {
    this.estimates = [];
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.estimates));
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
      this.estimates = (parsed as unknown[]).filter(
        (item: unknown): item is CostEstimate =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as CostEstimate).id === 'string' &&
          typeof (item as CostEstimate).name === 'string' &&
          Array.isArray((item as CostEstimate).bomItems) &&
          typeof (item as CostEstimate).createdAt === 'number',
      );
    } catch {
      // Corrupt data — keep empty
    }
  }
}

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

export function useAssemblyCost(): {
  profiles: AssemblyProfile[];
  estimates: CostEstimate[];
  createEstimate: (bomItems: BomItemInput[], boardParams: BoardParameters, name?: string) => CostEstimate;
  getEstimate: (id: string) => CostEstimate | null;
  updateEstimate: (id: string, updates: Partial<Pick<CostEstimate, 'name' | 'bomItems' | 'boardParams' | 'nreOverrides'>>) => CostEstimate | null;
  deleteEstimate: (id: string) => boolean;
  calculateCost: (estimateId: string, quantity: number, profileId: AssemblyProfileId, currency?: CurrencyCode) => CostBreakdown | null;
  calculateCostFromData: (bomItems: BomItemInput[], boardParams: BoardParameters, nreOverrides: Partial<NreCosts>, quantity: number, profileId: AssemblyProfileId, currency?: CurrencyCode) => CostBreakdown | null;
  compareCosts: (estimateId: string, quantity: number, profileIds?: AssemblyProfileId[], currency?: CurrencyCode) => CostComparison | null;
  getQuantityCurve: (estimateId: string, profileId: AssemblyProfileId, currency?: CurrencyCode) => QuantityCurve | null;
  getOptimizationSuggestions: (estimateId: string, profileId: AssemblyProfileId, quantity: number, currency?: CurrencyCode) => CostOptimizationSuggestion[];
  calculateMargin: (estimateId: string, quantity: number, profileId: AssemblyProfileId, marginPercent: number, currency?: CurrencyCode) => MarginResult | null;
  exportEstimates: () => string;
  importEstimates: (json: string) => { imported: number; errors: string[] };
  convertCurrency: (amount: number, from: CurrencyCode, to: CurrencyCode) => number;
  getSupportedCurrencies: () => CurrencyCode[];
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const estimator = AssemblyCostEstimator.getInstance();
    const unsubscribe = estimator.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const createEstimateCb = useCallback(
    (bomItems: BomItemInput[], boardParams: BoardParameters, name?: string) => {
      return AssemblyCostEstimator.getInstance().createEstimate(bomItems, boardParams, name);
    },
    [],
  );

  const getEstimateCb = useCallback((id: string) => {
    return AssemblyCostEstimator.getInstance().getEstimate(id);
  }, []);

  const updateEstimateCb = useCallback(
    (id: string, updates: Partial<Pick<CostEstimate, 'name' | 'bomItems' | 'boardParams' | 'nreOverrides'>>) => {
      return AssemblyCostEstimator.getInstance().updateEstimate(id, updates);
    },
    [],
  );

  const deleteEstimateCb = useCallback((id: string) => {
    return AssemblyCostEstimator.getInstance().deleteEstimate(id);
  }, []);

  const calculateCostCb = useCallback(
    (estimateId: string, quantity: number, profileId: AssemblyProfileId, currency?: CurrencyCode) => {
      return AssemblyCostEstimator.getInstance().calculateCost(estimateId, quantity, profileId, currency);
    },
    [],
  );

  const calculateCostFromDataCb = useCallback(
    (bomItems: BomItemInput[], boardParams: BoardParameters, nreOverrides: Partial<NreCosts>, quantity: number, profileId: AssemblyProfileId, currency?: CurrencyCode) => {
      return AssemblyCostEstimator.getInstance().calculateCostFromData(bomItems, boardParams, nreOverrides, quantity, profileId, currency);
    },
    [],
  );

  const compareCostsCb = useCallback(
    (estimateId: string, quantity: number, profileIds?: AssemblyProfileId[], currency?: CurrencyCode) => {
      return AssemblyCostEstimator.getInstance().compareCosts(estimateId, quantity, profileIds, currency);
    },
    [],
  );

  const getQuantityCurveCb = useCallback(
    (estimateId: string, profileId: AssemblyProfileId, currency?: CurrencyCode) => {
      return AssemblyCostEstimator.getInstance().getQuantityCurve(estimateId, profileId, currency);
    },
    [],
  );

  const getOptimizationSuggestionsCb = useCallback(
    (estimateId: string, profileId: AssemblyProfileId, quantity: number, currency?: CurrencyCode) => {
      return AssemblyCostEstimator.getInstance().getOptimizationSuggestions(estimateId, profileId, quantity, currency);
    },
    [],
  );

  const calculateMarginCb = useCallback(
    (estimateId: string, quantity: number, profileId: AssemblyProfileId, marginPercent: number, currency?: CurrencyCode) => {
      return AssemblyCostEstimator.getInstance().calculateMargin(estimateId, quantity, profileId, marginPercent, currency);
    },
    [],
  );

  const exportEstimatesCb = useCallback(() => {
    return AssemblyCostEstimator.getInstance().exportEstimates();
  }, []);

  const importEstimatesCb = useCallback((json: string) => {
    return AssemblyCostEstimator.getInstance().importEstimates(json);
  }, []);

  const convertCurrencyCb = useCallback(
    (amount: number, from: CurrencyCode, to: CurrencyCode) => {
      return convertCurrency(amount, from, to);
    },
    [],
  );

  const getSupportedCurrenciesCb = useCallback(() => {
    return AssemblyCostEstimator.getInstance().getSupportedCurrencies();
  }, []);

  const estimator = typeof window !== 'undefined' ? AssemblyCostEstimator.getInstance() : null;

  return {
    profiles: estimator?.getAllProfiles() ?? [],
    estimates: estimator?.getAllEstimates() ?? [],
    createEstimate: createEstimateCb,
    getEstimate: getEstimateCb,
    updateEstimate: updateEstimateCb,
    deleteEstimate: deleteEstimateCb,
    calculateCost: calculateCostCb,
    calculateCostFromData: calculateCostFromDataCb,
    compareCosts: compareCostsCb,
    getQuantityCurve: getQuantityCurveCb,
    getOptimizationSuggestions: getOptimizationSuggestionsCb,
    calculateMargin: calculateMarginCb,
    exportEstimates: exportEstimatesCb,
    importEstimates: importEstimatesCb,
    convertCurrency: convertCurrencyCb,
    getSupportedCurrencies: getSupportedCurrenciesCb,
  };
}
