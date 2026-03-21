/**
 * BL-0710 — Direct API Fab Pipeline
 *
 * End-to-end PCB fabrication pipeline manager with order lifecycle
 * (draft → quoting → submitted → manufacturing → shipped), fab house
 * profiles, component availability checking, substitute part
 * suggestions, pricing breakdowns, shipping options, lead time
 * estimation, and order summary markdown generation.
 *
 * Singleton + Subscribe pattern. Persists orders to localStorage.
 *
 * Usage:
 *   const pipeline = FabPipelineManager.getInstance();
 *   const order = pipeline.createOrder('my-board', 'jlcpcb');
 *   pipeline.addBoardSpec(order.id, boardSpec);
 *   const quote = pipeline.requestQuote(order.id);
 *   pipeline.submitOrder(order.id);
 *
 * React hook:
 *   const { orders, createOrder, requestQuote, submitOrder, ... } = useFabPipeline();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FabHouseId = 'jlcpcb' | 'pcbway' | 'oshpark' | 'elecrow' | 'allpcb';

export type OrderStage = 'draft' | 'quoting' | 'submitted' | 'manufacturing' | 'shipped';

export const ORDER_STAGE_PIPELINE: OrderStage[] = ['draft', 'quoting', 'submitted', 'manufacturing', 'shipped'];

export const ORDER_STAGE_LABELS: Record<OrderStage, string> = {
  draft: 'Draft',
  quoting: 'Quoting',
  submitted: 'Submitted',
  manufacturing: 'Manufacturing',
  shipped: 'Shipped',
};

export type BoardFinish = 'HASL' | 'ENIG' | 'OSP' | 'ENEPIG' | 'Immersion_Tin';
export type SolderMask = 'green' | 'red' | 'blue' | 'black' | 'white' | 'yellow' | 'purple';

export interface BoardSpec {
  width: number; // mm
  height: number; // mm
  layers: number;
  thickness: number; // mm
  copperWeight: number; // oz
  finish: BoardFinish;
  solderMask: SolderMask;
  minTraceWidth: number; // mm
  minDrillSize: number; // mm
  castellatedHoles: boolean;
  impedanceControl: boolean;
  panelized: boolean;
  panelCountX: number;
  panelCountY: number;
}

export interface ShippingOption {
  method: string;
  estimatedDays: number;
  cost: number;
  carrier: string;
}

export interface FabHouseProfile {
  id: FabHouseId;
  name: string;
  website: string;
  currency: string;
  capabilities: {
    maxLayers: number;
    minTrace: number; // mm
    minDrill: number; // mm
    minBoardWidth: number; // mm
    minBoardHeight: number; // mm
    maxBoardWidth: number; // mm
    maxBoardHeight: number; // mm
    finishes: BoardFinish[];
    solderMasks: SolderMask[];
    castellatedHoles: boolean;
    impedanceControl: boolean;
    hdiBuildUp: boolean;
  };
  pricing: {
    baseCost: number; // per order
    perBoardCm2: number; // per square cm board area
    perExtraLayer: number; // per layer beyond 2
    finishUpcharge: Record<string, number>;
    castellatedUpcharge: number;
    impedanceUpcharge: number;
    panelizationFee: number;
    rushMultiplier: number;
  };
  shipping: ShippingOption[];
  leadTimes: {
    economy: number; // business days
    standard: number;
    rush: number;
  };
}

export interface BomLineItem {
  partNumber: string;
  description: string;
  quantity: number;
  unitCost: number;
  available: boolean;
  leadTimeDays: number;
}

export interface SubstitutePart {
  original: string;
  substitute: string;
  reason: string;
  priceDelta: number;
  compatible: boolean;
}

export interface PricingBreakdown {
  pcbFabrication: number;
  layerUpcharge: number;
  finishUpcharge: number;
  specialFeatures: number;
  panelization: number;
  componentCost: number;
  shipping: number;
  subtotal: number;
  tax: number;
  total: number;
  perBoard: number;
  currency: string;
}

export interface StageHistoryEntry {
  stage: OrderStage;
  timestamp: number;
  note?: string;
}

export interface FabOrder {
  id: string;
  name: string;
  fabHouseId: FabHouseId;
  stage: OrderStage;
  stageHistory: StageHistoryEntry[];
  boardSpec: BoardSpec | null;
  quantity: number;
  bomItems: BomLineItem[];
  substitutes: SubstitutePart[];
  pricing: PricingBreakdown | null;
  selectedShipping: string | null;
  trackingNumber: string | null;
  estimatedDelivery: number | null; // epoch ms
  notes: string;
  createdAt: number;
  updatedAt: number;
}

type Listener = () => void;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse:fab-pipeline-orders';

// ---------------------------------------------------------------------------
// Fab house profiles
// ---------------------------------------------------------------------------

export const FAB_HOUSE_PROFILES: Record<FabHouseId, FabHouseProfile> = {
  jlcpcb: {
    id: 'jlcpcb',
    name: 'JLCPCB',
    website: 'https://jlcpcb.com',
    currency: 'USD',
    capabilities: {
      maxLayers: 32,
      minTrace: 0.09,
      minDrill: 0.15,
      minBoardWidth: 6,
      minBoardHeight: 6,
      maxBoardWidth: 500,
      maxBoardHeight: 500,
      finishes: ['HASL', 'ENIG', 'OSP', 'ENEPIG', 'Immersion_Tin'],
      solderMasks: ['green', 'red', 'blue', 'black', 'white', 'yellow', 'purple'],
      castellatedHoles: true,
      impedanceControl: true,
      hdiBuildUp: true,
    },
    pricing: {
      baseCost: 2.0,
      perBoardCm2: 0.04,
      perExtraLayer: 4.5,
      finishUpcharge: { ENIG: 8.0, ENEPIG: 15.0, Immersion_Tin: 3.0, OSP: 0, HASL: 0 },
      castellatedUpcharge: 10.0,
      impedanceUpcharge: 20.0,
      panelizationFee: 8.0,
      rushMultiplier: 1.8,
    },
    shipping: [
      { method: 'DHL Express', estimatedDays: 5, cost: 18.0, carrier: 'DHL' },
      { method: 'FedEx Economy', estimatedDays: 8, cost: 12.0, carrier: 'FedEx' },
      { method: 'Standard Post', estimatedDays: 18, cost: 3.0, carrier: 'China Post' },
    ],
    leadTimes: { economy: 7, standard: 3, rush: 1 },
  },
  pcbway: {
    id: 'pcbway',
    name: 'PCBWay',
    website: 'https://pcbway.com',
    currency: 'USD',
    capabilities: {
      maxLayers: 32,
      minTrace: 0.075,
      minDrill: 0.15,
      minBoardWidth: 5,
      minBoardHeight: 5,
      maxBoardWidth: 580,
      maxBoardHeight: 580,
      finishes: ['HASL', 'ENIG', 'OSP', 'Immersion_Tin'],
      solderMasks: ['green', 'red', 'blue', 'black', 'white', 'yellow'],
      castellatedHoles: true,
      impedanceControl: true,
      hdiBuildUp: true,
    },
    pricing: {
      baseCost: 5.0,
      perBoardCm2: 0.05,
      perExtraLayer: 5.0,
      finishUpcharge: { ENIG: 10.0, Immersion_Tin: 4.0, OSP: 0, HASL: 0 },
      castellatedUpcharge: 12.0,
      impedanceUpcharge: 25.0,
      panelizationFee: 10.0,
      rushMultiplier: 2.0,
    },
    shipping: [
      { method: 'DHL Express', estimatedDays: 4, cost: 20.0, carrier: 'DHL' },
      { method: 'EMS', estimatedDays: 10, cost: 8.0, carrier: 'EMS' },
      { method: 'Registered Air Mail', estimatedDays: 20, cost: 5.0, carrier: 'China Post' },
    ],
    leadTimes: { economy: 8, standard: 4, rush: 2 },
  },
  oshpark: {
    id: 'oshpark',
    name: 'OSH Park',
    website: 'https://oshpark.com',
    currency: 'USD',
    capabilities: {
      maxLayers: 8,
      minTrace: 0.127,
      minDrill: 0.254,
      minBoardWidth: 5,
      minBoardHeight: 5,
      maxBoardWidth: 400,
      maxBoardHeight: 450,
      finishes: ['ENIG'],
      solderMasks: ['purple'],
      castellatedHoles: false,
      impedanceControl: false,
      hdiBuildUp: false,
    },
    pricing: {
      baseCost: 0,
      perBoardCm2: 0.18,
      perExtraLayer: 6.0,
      finishUpcharge: { ENIG: 0 },
      castellatedUpcharge: 0,
      impedanceUpcharge: 0,
      panelizationFee: 0,
      rushMultiplier: 2.5,
    },
    shipping: [
      { method: 'USPS Priority', estimatedDays: 5, cost: 0, carrier: 'USPS' },
      { method: 'FedEx 2-Day', estimatedDays: 2, cost: 15.0, carrier: 'FedEx' },
    ],
    leadTimes: { economy: 14, standard: 10, rush: 5 },
  },
  elecrow: {
    id: 'elecrow',
    name: 'Elecrow',
    website: 'https://elecrow.com',
    currency: 'USD',
    capabilities: {
      maxLayers: 16,
      minTrace: 0.1,
      minDrill: 0.2,
      minBoardWidth: 10,
      minBoardHeight: 10,
      maxBoardWidth: 500,
      maxBoardHeight: 500,
      finishes: ['HASL', 'ENIG', 'OSP'],
      solderMasks: ['green', 'red', 'blue', 'black', 'white', 'yellow'],
      castellatedHoles: true,
      impedanceControl: true,
      hdiBuildUp: false,
    },
    pricing: {
      baseCost: 4.9,
      perBoardCm2: 0.045,
      perExtraLayer: 4.0,
      finishUpcharge: { ENIG: 9.0, OSP: 0, HASL: 0 },
      castellatedUpcharge: 8.0,
      impedanceUpcharge: 18.0,
      panelizationFee: 6.0,
      rushMultiplier: 1.5,
    },
    shipping: [
      { method: 'DHL Express', estimatedDays: 5, cost: 15.0, carrier: 'DHL' },
      { method: 'ePacket', estimatedDays: 12, cost: 5.0, carrier: 'China Post' },
      { method: 'Standard Post', estimatedDays: 22, cost: 2.0, carrier: 'China Post' },
    ],
    leadTimes: { economy: 9, standard: 5, rush: 2 },
  },
  allpcb: {
    id: 'allpcb',
    name: 'ALLPCB',
    website: 'https://allpcb.com',
    currency: 'USD',
    capabilities: {
      maxLayers: 24,
      minTrace: 0.076,
      minDrill: 0.15,
      minBoardWidth: 5,
      minBoardHeight: 5,
      maxBoardWidth: 600,
      maxBoardHeight: 1100,
      finishes: ['HASL', 'ENIG', 'OSP', 'Immersion_Tin'],
      solderMasks: ['green', 'red', 'blue', 'black', 'white'],
      castellatedHoles: true,
      impedanceControl: true,
      hdiBuildUp: true,
    },
    pricing: {
      baseCost: 0,
      perBoardCm2: 0.035,
      perExtraLayer: 3.5,
      finishUpcharge: { ENIG: 7.0, Immersion_Tin: 2.5, OSP: 0, HASL: 0 },
      castellatedUpcharge: 9.0,
      impedanceUpcharge: 15.0,
      panelizationFee: 5.0,
      rushMultiplier: 1.6,
    },
    shipping: [
      { method: 'DHL Express', estimatedDays: 4, cost: 22.0, carrier: 'DHL' },
      { method: 'FedEx Economy', estimatedDays: 7, cost: 14.0, carrier: 'FedEx' },
      { method: 'Air Mail', estimatedDays: 15, cost: 4.0, carrier: 'China Post' },
    ],
    leadTimes: { economy: 6, standard: 3, rush: 1 },
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Calculate board area in cm².
 */
export function boardAreaCm2(spec: BoardSpec): number {
  const w = spec.width / 10;
  const h = spec.height / 10;
  const panelCount = spec.panelized ? spec.panelCountX * spec.panelCountY : 1;
  return w * h * panelCount;
}

/**
 * Validate a board spec against a fab house's capabilities.
 * Returns an array of error strings (empty = valid).
 */
export function validateBoardSpec(spec: BoardSpec, fabHouseId: FabHouseId): string[] {
  const profile = FAB_HOUSE_PROFILES[fabHouseId];
  if (!profile) {
    return [`Unknown fab house: ${fabHouseId}`];
  }

  const errors: string[] = [];
  const caps = profile.capabilities;

  if (spec.layers > caps.maxLayers) {
    errors.push(`Layer count ${String(spec.layers)} exceeds max ${String(caps.maxLayers)}`);
  }
  if (spec.minTraceWidth < caps.minTrace) {
    errors.push(`Min trace width ${String(spec.minTraceWidth)}mm below capability ${String(caps.minTrace)}mm`);
  }
  if (spec.minDrillSize < caps.minDrill) {
    errors.push(`Min drill size ${String(spec.minDrillSize)}mm below capability ${String(caps.minDrill)}mm`);
  }
  if (spec.width < caps.minBoardWidth || spec.height < caps.minBoardHeight) {
    errors.push(`Board too small: min ${String(caps.minBoardWidth)}x${String(caps.minBoardHeight)}mm`);
  }
  if (spec.width > caps.maxBoardWidth || spec.height > caps.maxBoardHeight) {
    errors.push(`Board too large: max ${String(caps.maxBoardWidth)}x${String(caps.maxBoardHeight)}mm`);
  }
  if (!caps.finishes.includes(spec.finish)) {
    errors.push(`Finish "${spec.finish}" not available`);
  }
  if (!caps.solderMasks.includes(spec.solderMask)) {
    errors.push(`Solder mask color "${spec.solderMask}" not available`);
  }
  if (spec.castellatedHoles && !caps.castellatedHoles) {
    errors.push('Castellated holes not supported');
  }
  if (spec.impedanceControl && !caps.impedanceControl) {
    errors.push('Impedance control not supported');
  }

  return errors;
}

/**
 * Calculate pricing breakdown for a given order configuration.
 */
export function calculatePricing(
  spec: BoardSpec,
  fabHouseId: FabHouseId,
  quantity: number,
  bomItems: BomLineItem[],
  shippingMethod?: string,
): PricingBreakdown {
  const profile = FAB_HOUSE_PROFILES[fabHouseId];
  if (!profile) {
    return {
      pcbFabrication: 0,
      layerUpcharge: 0,
      finishUpcharge: 0,
      specialFeatures: 0,
      panelization: 0,
      componentCost: 0,
      shipping: 0,
      subtotal: 0,
      tax: 0,
      total: 0,
      perBoard: 0,
      currency: 'USD',
    };
  }

  const area = boardAreaCm2(spec);
  const pcbFab = (profile.pricing.baseCost + area * profile.pricing.perBoardCm2) * quantity;
  const extraLayers = Math.max(0, spec.layers - 2);
  const layerUpcharge = extraLayers * profile.pricing.perExtraLayer * quantity;
  const finishUp = (profile.pricing.finishUpcharge[spec.finish] ?? 0) * quantity;

  let specialFeatures = 0;
  if (spec.castellatedHoles) {
    specialFeatures += profile.pricing.castellatedUpcharge;
  }
  if (spec.impedanceControl) {
    specialFeatures += profile.pricing.impedanceUpcharge;
  }

  const panelization = spec.panelized ? profile.pricing.panelizationFee : 0;

  let componentCost = 0;
  for (const item of bomItems) {
    componentCost += item.unitCost * item.quantity * quantity;
  }

  let shippingCost = 0;
  if (shippingMethod) {
    const option = profile.shipping.find((s) => s.method === shippingMethod);
    if (option) {
      shippingCost = option.cost;
    }
  }

  const subtotal = pcbFab + layerUpcharge + finishUp + specialFeatures + panelization + componentCost;
  const total = subtotal + shippingCost;

  return {
    pcbFabrication: round2(pcbFab),
    layerUpcharge: round2(layerUpcharge),
    finishUpcharge: round2(finishUp),
    specialFeatures: round2(specialFeatures),
    panelization: round2(panelization),
    componentCost: round2(componentCost),
    shipping: round2(shippingCost),
    subtotal: round2(subtotal),
    tax: 0,
    total: round2(total),
    perBoard: round2(quantity > 0 ? total / quantity : 0),
    currency: profile.currency,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Estimate lead time in business days (fab + shipping).
 */
export function estimateLeadTime(
  fabHouseId: FabHouseId,
  speed: 'economy' | 'standard' | 'rush' = 'standard',
  shippingMethod?: string,
): number {
  const profile = FAB_HOUSE_PROFILES[fabHouseId];
  if (!profile) {
    return 0;
  }

  const fabDays = profile.leadTimes[speed];
  let shippingDays = 0;
  if (shippingMethod) {
    const option = profile.shipping.find((s) => s.method === shippingMethod);
    if (option) {
      shippingDays = option.estimatedDays;
    }
  }

  return fabDays + shippingDays;
}

/**
 * Check component availability from a BOM. Returns items with availability flags.
 */
export function checkComponentAvailability(bomItems: BomLineItem[]): {
  available: BomLineItem[];
  unavailable: BomLineItem[];
  totalAvailable: number;
  totalItems: number;
} {
  const available = bomItems.filter((item) => item.available);
  const unavailable = bomItems.filter((item) => !item.available);
  return {
    available,
    unavailable,
    totalAvailable: available.length,
    totalItems: bomItems.length,
  };
}

/**
 * Suggest substitute parts for unavailable components.
 */
export function suggestSubstitutes(unavailableItems: BomLineItem[]): SubstitutePart[] {
  // Common substitution patterns for passive components
  const PASSIVE_SUBS: Record<string, { substitute: string; reason: string; priceDelta: number }> = {
    '0402': { substitute: '0603', reason: 'Larger package, better availability', priceDelta: 0.001 },
    '0603': { substitute: '0805', reason: 'Larger package, easier hand-soldering', priceDelta: 0.002 },
    '0805': { substitute: '1206', reason: 'Larger package, better thermal handling', priceDelta: 0.003 },
  };

  const MCU_SUBS: Record<string, { substitute: string; reason: string; priceDelta: number }> = {
    ATmega328P: { substitute: 'ATmega328PB', reason: 'Pin-compatible successor', priceDelta: 0.5 },
    ATmega2560: { substitute: 'ATmega2561', reason: 'Similar pinout, more availability', priceDelta: 0.3 },
    STM32F103C8: { substitute: 'STM32F103CB', reason: 'Same family, larger flash', priceDelta: 0.8 },
  };

  const results: SubstitutePart[] = [];

  for (const item of unavailableItems) {
    const pn = item.partNumber;
    const desc = item.description.toLowerCase();

    // Check passive substitutions by package
    let matched = false;
    for (const [pkg, sub] of Object.entries(PASSIVE_SUBS)) {
      if (pn.includes(pkg) || desc.includes(pkg.toLowerCase())) {
        results.push({
          original: pn,
          substitute: pn.replace(pkg, sub.substitute),
          reason: sub.reason,
          priceDelta: sub.priceDelta,
          compatible: true,
        });
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Check MCU substitutions
      for (const [mcu, sub] of Object.entries(MCU_SUBS)) {
        if (pn.includes(mcu)) {
          results.push({
            original: pn,
            substitute: sub.substitute,
            reason: sub.reason,
            priceDelta: sub.priceDelta,
            compatible: true,
          });
          matched = true;
          break;
        }
      }
    }

    if (!matched) {
      results.push({
        original: pn,
        substitute: '',
        reason: 'No known substitute found — manual review needed',
        priceDelta: 0,
        compatible: false,
      });
    }
  }

  return results;
}

/**
 * Generate a markdown summary for an order.
 */
export function generateOrderSummary(order: FabOrder): string {
  const profile = FAB_HOUSE_PROFILES[order.fabHouseId];
  const lines: string[] = [
    `# Order Summary: ${order.name}`,
    '',
    `**Fab House:** ${profile?.name ?? order.fabHouseId}`,
    `**Status:** ${ORDER_STAGE_LABELS[order.stage]}`,
    `**Quantity:** ${String(order.quantity)}`,
    `**Created:** ${new Date(order.createdAt).toISOString().split('T')[0]}`,
    '',
  ];

  if (order.boardSpec) {
    const spec = order.boardSpec;
    lines.push(
      '## Board Specification',
      '',
      `| Parameter | Value |`,
      `|-----------|-------|`,
      `| Dimensions | ${String(spec.width)} x ${String(spec.height)} mm |`,
      `| Layers | ${String(spec.layers)} |`,
      `| Thickness | ${String(spec.thickness)} mm |`,
      `| Copper Weight | ${String(spec.copperWeight)} oz |`,
      `| Finish | ${spec.finish} |`,
      `| Solder Mask | ${spec.solderMask} |`,
      `| Min Trace | ${String(spec.minTraceWidth)} mm |`,
      `| Min Drill | ${String(spec.minDrillSize)} mm |`,
      `| Area | ${String(round2(boardAreaCm2(spec)))} cm² |`,
    );
    if (spec.castellatedHoles) {
      lines.push(`| Castellated Holes | Yes |`);
    }
    if (spec.impedanceControl) {
      lines.push(`| Impedance Control | Yes |`);
    }
    if (spec.panelized) {
      lines.push(`| Panelization | ${String(spec.panelCountX)} x ${String(spec.panelCountY)} |`);
    }
    lines.push('');
  }

  if (order.bomItems.length > 0) {
    lines.push(
      '## Bill of Materials',
      '',
      `| Part | Description | Qty | Unit Cost | Available |`,
      `|------|-------------|-----|-----------|-----------|`,
    );
    for (const item of order.bomItems) {
      lines.push(
        `| ${item.partNumber} | ${item.description} | ${String(item.quantity)} | $${item.unitCost.toFixed(2)} | ${item.available ? 'Yes' : 'No'} |`,
      );
    }
    lines.push('');
  }

  if (order.substitutes.length > 0) {
    lines.push(
      '## Substitute Parts',
      '',
      `| Original | Substitute | Reason | Compatible |`,
      `|----------|-----------|--------|------------|`,
    );
    for (const sub of order.substitutes) {
      lines.push(
        `| ${sub.original} | ${sub.substitute || 'N/A'} | ${sub.reason} | ${sub.compatible ? 'Yes' : 'No'} |`,
      );
    }
    lines.push('');
  }

  if (order.pricing) {
    const p = order.pricing;
    lines.push(
      '## Pricing Breakdown',
      '',
      `| Item | Amount |`,
      `|------|--------|`,
      `| PCB Fabrication | $${p.pcbFabrication.toFixed(2)} |`,
    );
    if (p.layerUpcharge > 0) {
      lines.push(`| Layer Upcharge | $${p.layerUpcharge.toFixed(2)} |`);
    }
    if (p.finishUpcharge > 0) {
      lines.push(`| Finish Upcharge | $${p.finishUpcharge.toFixed(2)} |`);
    }
    if (p.specialFeatures > 0) {
      lines.push(`| Special Features | $${p.specialFeatures.toFixed(2)} |`);
    }
    if (p.panelization > 0) {
      lines.push(`| Panelization | $${p.panelization.toFixed(2)} |`);
    }
    if (p.componentCost > 0) {
      lines.push(`| Components | $${p.componentCost.toFixed(2)} |`);
    }
    if (p.shipping > 0) {
      lines.push(`| Shipping | $${p.shipping.toFixed(2)} |`);
    }
    lines.push(
      `| **Total** | **$${p.total.toFixed(2)}** |`,
      `| Per Board | $${p.perBoard.toFixed(2)} |`,
      '',
    );
  }

  if (order.trackingNumber) {
    lines.push(`**Tracking:** ${order.trackingNumber}`);
  }
  if (order.estimatedDelivery) {
    lines.push(`**Estimated Delivery:** ${new Date(order.estimatedDelivery).toISOString().split('T')[0]}`);
  }
  if (order.notes) {
    lines.push('', '## Notes', '', order.notes);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// FabPipelineManager
// ---------------------------------------------------------------------------

export class FabPipelineManager {
  private static instance: FabPipelineManager | null = null;
  private orders: Map<string, FabOrder> = new Map();
  private listeners: Set<Listener> = new Set();

  private constructor() {
    this.loadOrders();
  }

  static getInstance(): FabPipelineManager {
    if (!FabPipelineManager.instance) {
      FabPipelineManager.instance = new FabPipelineManager();
    }
    return FabPipelineManager.instance;
  }

  static resetForTesting(): void {
    FabPipelineManager.instance = null;
  }

  // ── Subscribe ──

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((fn) => {
      fn();
    });
  }

  // ── Persistence ──

  private loadOrders(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as FabOrder[];
        this.orders = new Map(parsed.map((o) => [o.id, o]));
      }
    } catch {
      this.orders = new Map();
    }
  }

  private saveOrders(): void {
    try {
      const arr = Array.from(this.orders.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch {
      // quota exceeded — silently ignore
    }
  }

  // ── CRUD ──

  createOrder(name: string, fabHouseId: FabHouseId, quantity = 5): FabOrder {
    const now = Date.now();
    const order: FabOrder = {
      id: generateId(),
      name,
      fabHouseId,
      stage: 'draft',
      stageHistory: [{ stage: 'draft', timestamp: now }],
      boardSpec: null,
      quantity,
      bomItems: [],
      substitutes: [],
      pricing: null,
      selectedShipping: null,
      trackingNumber: null,
      estimatedDelivery: null,
      notes: '',
      createdAt: now,
      updatedAt: now,
    };
    this.orders.set(order.id, order);
    this.saveOrders();
    this.notify();
    return order;
  }

  getOrder(id: string): FabOrder | undefined {
    return this.orders.get(id);
  }

  getAllOrders(): FabOrder[] {
    return Array.from(this.orders.values());
  }

  getOrdersByStage(stage: OrderStage): FabOrder[] {
    return Array.from(this.orders.values()).filter((o) => o.stage === stage);
  }

  deleteOrder(id: string): boolean {
    const existed = this.orders.delete(id);
    if (existed) {
      this.saveOrders();
      this.notify();
    }
    return existed;
  }

  // ── Board spec ──

  addBoardSpec(orderId: string, spec: BoardSpec): string[] {
    const order = this.orders.get(orderId);
    if (!order) {
      return ['Order not found'];
    }

    const errors = validateBoardSpec(spec, order.fabHouseId);
    order.boardSpec = spec;
    order.updatedAt = Date.now();
    this.saveOrders();
    this.notify();
    return errors;
  }

  // ── BOM ──

  setBomItems(orderId: string, items: BomLineItem[]): void {
    const order = this.orders.get(orderId);
    if (!order) {
      return;
    }
    order.bomItems = items;
    order.updatedAt = Date.now();

    // Auto-suggest substitutes for unavailable items
    const { unavailable } = checkComponentAvailability(items);
    order.substitutes = suggestSubstitutes(unavailable);

    this.saveOrders();
    this.notify();
  }

  // ── Quoting ──

  requestQuote(orderId: string): PricingBreakdown | null {
    const order = this.orders.get(orderId);
    if (!order || !order.boardSpec) {
      return null;
    }

    const pricing = calculatePricing(
      order.boardSpec,
      order.fabHouseId,
      order.quantity,
      order.bomItems,
      order.selectedShipping ?? undefined,
    );

    order.pricing = pricing;
    if (order.stage === 'draft') {
      this.advanceStage(orderId, 'quoting');
    }
    order.updatedAt = Date.now();
    this.saveOrders();
    this.notify();
    return pricing;
  }

  // ── Shipping ──

  setShipping(orderId: string, shippingMethod: string): void {
    const order = this.orders.get(orderId);
    if (!order) {
      return;
    }
    order.selectedShipping = shippingMethod;
    order.updatedAt = Date.now();

    // Recalculate pricing with shipping
    if (order.boardSpec) {
      order.pricing = calculatePricing(
        order.boardSpec,
        order.fabHouseId,
        order.quantity,
        order.bomItems,
        shippingMethod,
      );
    }

    this.saveOrders();
    this.notify();
  }

  getShippingOptions(orderId: string): ShippingOption[] {
    const order = this.orders.get(orderId);
    if (!order) {
      return [];
    }
    return FAB_HOUSE_PROFILES[order.fabHouseId]?.shipping ?? [];
  }

  // ── Stage management ──

  advanceStage(orderId: string, targetStage?: OrderStage): boolean {
    const order = this.orders.get(orderId);
    if (!order) {
      return false;
    }

    const currentIdx = ORDER_STAGE_PIPELINE.indexOf(order.stage);
    if (currentIdx < 0) {
      return false;
    }

    let nextStage: OrderStage;
    if (targetStage) {
      const targetIdx = ORDER_STAGE_PIPELINE.indexOf(targetStage);
      if (targetIdx <= currentIdx) {
        return false; // Can only advance forward
      }
      nextStage = targetStage;
    } else {
      if (currentIdx >= ORDER_STAGE_PIPELINE.length - 1) {
        return false; // Already at final stage
      }
      nextStage = ORDER_STAGE_PIPELINE[currentIdx + 1];
    }

    order.stage = nextStage;
    order.stageHistory.push({ stage: nextStage, timestamp: Date.now() });
    order.updatedAt = Date.now();
    this.saveOrders();
    this.notify();
    return true;
  }

  submitOrder(orderId: string): boolean {
    const order = this.orders.get(orderId);
    if (!order || !order.boardSpec || !order.pricing) {
      return false;
    }
    return this.advanceStage(orderId, 'submitted');
  }

  setTrackingNumber(orderId: string, trackingNumber: string): void {
    const order = this.orders.get(orderId);
    if (!order) {
      return;
    }
    order.trackingNumber = trackingNumber;
    order.updatedAt = Date.now();
    this.saveOrders();
    this.notify();
  }

  setEstimatedDelivery(orderId: string, date: number): void {
    const order = this.orders.get(orderId);
    if (!order) {
      return;
    }
    order.estimatedDelivery = date;
    order.updatedAt = Date.now();
    this.saveOrders();
    this.notify();
  }

  setNotes(orderId: string, notes: string): void {
    const order = this.orders.get(orderId);
    if (!order) {
      return;
    }
    order.notes = notes;
    order.updatedAt = Date.now();
    this.saveOrders();
    this.notify();
  }

  setQuantity(orderId: string, quantity: number): void {
    const order = this.orders.get(orderId);
    if (!order) {
      return;
    }
    order.quantity = Math.max(1, Math.floor(quantity));
    order.updatedAt = Date.now();

    // Recalculate pricing
    if (order.boardSpec) {
      order.pricing = calculatePricing(
        order.boardSpec,
        order.fabHouseId,
        order.quantity,
        order.bomItems,
        order.selectedShipping ?? undefined,
      );
    }

    this.saveOrders();
    this.notify();
  }

  // ── Lead time ──

  getLeadTime(orderId: string, speed: 'economy' | 'standard' | 'rush' = 'standard'): number {
    const order = this.orders.get(orderId);
    if (!order) {
      return 0;
    }
    return estimateLeadTime(order.fabHouseId, speed, order.selectedShipping ?? undefined);
  }

  // ── Summary ──

  getOrderSummary(orderId: string): string {
    const order = this.orders.get(orderId);
    if (!order) {
      return 'Order not found.';
    }
    return generateOrderSummary(order);
  }

  // ── Comparison ──

  compareQuotes(boardSpec: BoardSpec, quantity: number, bomItems: BomLineItem[] = []): {
    fabHouseId: FabHouseId;
    name: string;
    pricing: PricingBreakdown;
    leadTime: number;
    errors: string[];
  }[] {
    const fabHouseIds: FabHouseId[] = ['jlcpcb', 'pcbway', 'oshpark', 'elecrow', 'allpcb'];
    return fabHouseIds.map((id) => {
      const profile = FAB_HOUSE_PROFILES[id];
      const errors = validateBoardSpec(boardSpec, id);
      const pricing = calculatePricing(boardSpec, id, quantity, bomItems);
      const leadTime = estimateLeadTime(id, 'standard');
      return {
        fabHouseId: id,
        name: profile.name,
        pricing,
        leadTime,
        errors,
      };
    });
  }

  /**
   * Snapshot for useSyncExternalStore.
   */
  getSnapshot(): { orders: FabOrder[]; orderCount: number } {
    return {
      orders: Array.from(this.orders.values()),
      orderCount: this.orders.size,
    };
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useFabPipeline(): {
  orders: FabOrder[];
  orderCount: number;
  createOrder: (name: string, fabHouseId: FabHouseId, quantity?: number) => FabOrder;
  getOrder: (id: string) => FabOrder | undefined;
  deleteOrder: (id: string) => boolean;
  addBoardSpec: (orderId: string, spec: BoardSpec) => string[];
  setBomItems: (orderId: string, items: BomLineItem[]) => void;
  requestQuote: (orderId: string) => PricingBreakdown | null;
  setShipping: (orderId: string, method: string) => void;
  getShippingOptions: (orderId: string) => ShippingOption[];
  submitOrder: (orderId: string) => boolean;
  advanceStage: (orderId: string, stage?: OrderStage) => boolean;
  setTrackingNumber: (orderId: string, tracking: string) => void;
  setEstimatedDelivery: (orderId: string, date: number) => void;
  setNotes: (orderId: string, notes: string) => void;
  setQuantity: (orderId: string, quantity: number) => void;
  getLeadTime: (orderId: string, speed?: 'economy' | 'standard' | 'rush') => number;
  getOrderSummary: (orderId: string) => string;
  getOrdersByStage: (stage: OrderStage) => FabOrder[];
  compareQuotes: (spec: BoardSpec, qty: number, bom?: BomLineItem[]) => ReturnType<FabPipelineManager['compareQuotes']>;
} {
  const mgr = FabPipelineManager.getInstance();
  const [snapshot, setSnapshot] = useState(() => mgr.getSnapshot());

  useEffect(() => {
    return mgr.subscribe(() => {
      setSnapshot(mgr.getSnapshot());
    });
  }, [mgr]);

  return {
    orders: snapshot.orders,
    orderCount: snapshot.orderCount,
    createOrder: useCallback((name: string, fabHouseId: FabHouseId, quantity?: number) => mgr.createOrder(name, fabHouseId, quantity), [mgr]),
    getOrder: useCallback((id: string) => mgr.getOrder(id), [mgr]),
    deleteOrder: useCallback((id: string) => mgr.deleteOrder(id), [mgr]),
    addBoardSpec: useCallback((orderId: string, spec: BoardSpec) => mgr.addBoardSpec(orderId, spec), [mgr]),
    setBomItems: useCallback((orderId: string, items: BomLineItem[]) => { mgr.setBomItems(orderId, items); }, [mgr]),
    requestQuote: useCallback((orderId: string) => mgr.requestQuote(orderId), [mgr]),
    setShipping: useCallback((orderId: string, method: string) => { mgr.setShipping(orderId, method); }, [mgr]),
    getShippingOptions: useCallback((orderId: string) => mgr.getShippingOptions(orderId), [mgr]),
    submitOrder: useCallback((orderId: string) => mgr.submitOrder(orderId), [mgr]),
    advanceStage: useCallback((orderId: string, stage?: OrderStage) => mgr.advanceStage(orderId, stage), [mgr]),
    setTrackingNumber: useCallback((orderId: string, tracking: string) => { mgr.setTrackingNumber(orderId, tracking); }, [mgr]),
    setEstimatedDelivery: useCallback((orderId: string, date: number) => { mgr.setEstimatedDelivery(orderId, date); }, [mgr]),
    setNotes: useCallback((orderId: string, notes: string) => { mgr.setNotes(orderId, notes); }, [mgr]),
    setQuantity: useCallback((orderId: string, quantity: number) => { mgr.setQuantity(orderId, quantity); }, [mgr]),
    getLeadTime: useCallback((orderId: string, speed?: 'economy' | 'standard' | 'rush') => mgr.getLeadTime(orderId, speed), [mgr]),
    getOrderSummary: useCallback((orderId: string) => mgr.getOrderSummary(orderId), [mgr]),
    getOrdersByStage: useCallback((stage: OrderStage) => mgr.getOrdersByStage(stage), [mgr]),
    compareQuotes: useCallback((spec: BoardSpec, qty: number, bom?: BomLineItem[]) => mgr.compareQuotes(spec, qty, bom), [mgr]),
  };
}
