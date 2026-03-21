import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Stub globals before importing the module
// ---------------------------------------------------------------------------

const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, val: string) => {
    store[key] = val;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    for (const k of Object.keys(store)) {
      delete store[k];
    }
  }),
});

vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => `uuid-${Math.random().toString(36).slice(2, 10)}`),
});

import {
  FabPipelineManager,
  FAB_HOUSE_PROFILES,
  ORDER_STAGE_PIPELINE,
  ORDER_STAGE_LABELS,
  boardAreaCm2,
  validateBoardSpec,
  calculatePricing,
  estimateLeadTime,
  checkComponentAvailability,
  suggestSubstitutes,
  generateOrderSummary,
  useFabPipeline,
} from '../fab-pipeline';
import type {
  FabHouseId,
  BoardSpec,
  BomLineItem,
  FabOrder,
  PricingBreakdown,
  SubstitutePart,
  OrderStage,
  ShippingOption,
  FabHouseProfile,
} from '../fab-pipeline';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clearStore(): void {
  for (const k of Object.keys(store)) {
    delete store[k];
  }
}

function defaultBoardSpec(overrides: Partial<BoardSpec> = {}): BoardSpec {
  return {
    width: 50,
    height: 50,
    layers: 2,
    thickness: 1.6,
    copperWeight: 1,
    finish: 'HASL',
    solderMask: 'green',
    minTraceWidth: 0.2,
    minDrillSize: 0.3,
    castellatedHoles: false,
    impedanceControl: false,
    panelized: false,
    panelCountX: 1,
    panelCountY: 1,
    ...overrides,
  };
}

function defaultBomItem(overrides: Partial<BomLineItem> = {}): BomLineItem {
  return {
    partNumber: 'RC0805JR-07100KL',
    description: '100k 0805 resistor',
    quantity: 10,
    unitCost: 0.01,
    available: true,
    leadTimeDays: 3,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests — Constants / Profiles
// ---------------------------------------------------------------------------

describe('FAB_HOUSE_PROFILES', () => {
  it('has 5 fab house profiles', () => {
    expect(Object.keys(FAB_HOUSE_PROFILES).length).toBe(5);
  });

  it('includes JLCPCB, PCBWay, OSH Park, Elecrow, ALLPCB', () => {
    expect(FAB_HOUSE_PROFILES.jlcpcb).toBeDefined();
    expect(FAB_HOUSE_PROFILES.pcbway).toBeDefined();
    expect(FAB_HOUSE_PROFILES.oshpark).toBeDefined();
    expect(FAB_HOUSE_PROFILES.elecrow).toBeDefined();
    expect(FAB_HOUSE_PROFILES.allpcb).toBeDefined();
  });

  it('each profile has required structure', () => {
    for (const profile of Object.values(FAB_HOUSE_PROFILES)) {
      expect(profile.id).toBeTruthy();
      expect(profile.name).toBeTruthy();
      expect(profile.website).toBeTruthy();
      expect(profile.currency).toBe('USD');
      expect(profile.capabilities.maxLayers).toBeGreaterThan(0);
      expect(profile.capabilities.finishes.length).toBeGreaterThan(0);
      expect(profile.capabilities.solderMasks.length).toBeGreaterThan(0);
      expect(profile.shipping.length).toBeGreaterThan(0);
      expect(profile.leadTimes.economy).toBeGreaterThan(0);
      expect(profile.leadTimes.standard).toBeGreaterThan(0);
      expect(profile.leadTimes.rush).toBeGreaterThan(0);
    }
  });

  it('JLCPCB supports up to 32 layers', () => {
    expect(FAB_HOUSE_PROFILES.jlcpcb.capabilities.maxLayers).toBe(32);
  });

  it('OSH Park only offers ENIG finish', () => {
    expect(FAB_HOUSE_PROFILES.oshpark.capabilities.finishes).toEqual(['ENIG']);
  });

  it('OSH Park only offers purple solder mask', () => {
    expect(FAB_HOUSE_PROFILES.oshpark.capabilities.solderMasks).toEqual(['purple']);
  });
});

describe('ORDER_STAGE_PIPELINE', () => {
  it('has 5 stages in order', () => {
    expect(ORDER_STAGE_PIPELINE).toEqual(['draft', 'quoting', 'submitted', 'manufacturing', 'shipped']);
  });

  it('ORDER_STAGE_LABELS covers all stages', () => {
    for (const stage of ORDER_STAGE_PIPELINE) {
      expect(ORDER_STAGE_LABELS[stage]).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// Tests — boardAreaCm2
// ---------------------------------------------------------------------------

describe('boardAreaCm2', () => {
  it('calculates area for a 50x50mm board', () => {
    const spec = defaultBoardSpec();
    expect(boardAreaCm2(spec)).toBe(25); // 5cm * 5cm
  });

  it('calculates area for a panelized board', () => {
    const spec = defaultBoardSpec({ panelized: true, panelCountX: 2, panelCountY: 3 });
    expect(boardAreaCm2(spec)).toBe(150); // 25 * 6 panels
  });

  it('non-panelized ignores panel counts', () => {
    const spec = defaultBoardSpec({ panelized: false, panelCountX: 5, panelCountY: 5 });
    expect(boardAreaCm2(spec)).toBe(25);
  });

  it('handles small boards', () => {
    const spec = defaultBoardSpec({ width: 10, height: 10 });
    expect(boardAreaCm2(spec)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Tests — validateBoardSpec
// ---------------------------------------------------------------------------

describe('validateBoardSpec', () => {
  it('returns no errors for valid spec against JLCPCB', () => {
    const errors = validateBoardSpec(defaultBoardSpec(), 'jlcpcb');
    expect(errors).toEqual([]);
  });

  it('catches layer count exceeding max', () => {
    const errors = validateBoardSpec(defaultBoardSpec({ layers: 64 }), 'jlcpcb');
    expect(errors.some((e) => e.includes('Layer count'))).toBe(true);
  });

  it('catches trace width below minimum', () => {
    const errors = validateBoardSpec(defaultBoardSpec({ minTraceWidth: 0.01 }), 'jlcpcb');
    expect(errors.some((e) => e.includes('trace width'))).toBe(true);
  });

  it('catches drill size below minimum', () => {
    const errors = validateBoardSpec(defaultBoardSpec({ minDrillSize: 0.05 }), 'jlcpcb');
    expect(errors.some((e) => e.includes('drill size'))).toBe(true);
  });

  it('catches board too small', () => {
    const errors = validateBoardSpec(defaultBoardSpec({ width: 1, height: 1 }), 'jlcpcb');
    expect(errors.some((e) => e.includes('too small'))).toBe(true);
  });

  it('catches board too large', () => {
    const errors = validateBoardSpec(defaultBoardSpec({ width: 1000, height: 1000 }), 'jlcpcb');
    expect(errors.some((e) => e.includes('too large'))).toBe(true);
  });

  it('catches unavailable finish', () => {
    const errors = validateBoardSpec(defaultBoardSpec({ finish: 'ENEPIG' }), 'oshpark');
    expect(errors.some((e) => e.includes('Finish'))).toBe(true);
  });

  it('catches unavailable solder mask', () => {
    const errors = validateBoardSpec(defaultBoardSpec({ solderMask: 'green' }), 'oshpark');
    expect(errors.some((e) => e.includes('Solder mask'))).toBe(true);
  });

  it('catches castellated holes not supported', () => {
    const errors = validateBoardSpec(defaultBoardSpec({ castellatedHoles: true }), 'oshpark');
    expect(errors.some((e) => e.includes('Castellated'))).toBe(true);
  });

  it('catches impedance control not supported', () => {
    const errors = validateBoardSpec(defaultBoardSpec({ impedanceControl: true }), 'oshpark');
    expect(errors.some((e) => e.includes('Impedance'))).toBe(true);
  });

  it('returns error for unknown fab house', () => {
    const errors = validateBoardSpec(defaultBoardSpec(), 'unknown' as FabHouseId);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('Unknown');
  });
});

// ---------------------------------------------------------------------------
// Tests — calculatePricing
// ---------------------------------------------------------------------------

describe('calculatePricing', () => {
  it('calculates basic pricing for a 2-layer board', () => {
    const pricing = calculatePricing(defaultBoardSpec(), 'jlcpcb', 10, []);
    expect(pricing.pcbFabrication).toBeGreaterThan(0);
    expect(pricing.layerUpcharge).toBe(0);
    expect(pricing.total).toBeGreaterThan(0);
    expect(pricing.perBoard).toBe(pricing.total / 10);
    expect(pricing.currency).toBe('USD');
  });

  it('adds layer upcharge for 4-layer board', () => {
    const twoLayer = calculatePricing(defaultBoardSpec(), 'jlcpcb', 10, []);
    const fourLayer = calculatePricing(defaultBoardSpec({ layers: 4 }), 'jlcpcb', 10, []);
    expect(fourLayer.layerUpcharge).toBeGreaterThan(0);
    expect(fourLayer.total).toBeGreaterThan(twoLayer.total);
  });

  it('adds finish upcharge for ENIG', () => {
    const hasl = calculatePricing(defaultBoardSpec(), 'jlcpcb', 10, []);
    const enig = calculatePricing(defaultBoardSpec({ finish: 'ENIG' }), 'jlcpcb', 10, []);
    expect(enig.finishUpcharge).toBeGreaterThan(0);
    expect(enig.total).toBeGreaterThan(hasl.total);
  });

  it('adds special feature upcharges', () => {
    const plain = calculatePricing(defaultBoardSpec(), 'jlcpcb', 10, []);
    const special = calculatePricing(
      defaultBoardSpec({ castellatedHoles: true, impedanceControl: true }),
      'jlcpcb',
      10,
      [],
    );
    expect(special.specialFeatures).toBeGreaterThan(0);
    expect(special.total).toBeGreaterThan(plain.total);
  });

  it('adds panelization fee', () => {
    const single = calculatePricing(defaultBoardSpec(), 'jlcpcb', 10, []);
    const panel = calculatePricing(
      defaultBoardSpec({ panelized: true, panelCountX: 2, panelCountY: 2 }),
      'jlcpcb',
      10,
      [],
    );
    expect(panel.panelization).toBeGreaterThan(0);
    expect(panel.total).toBeGreaterThan(single.total);
  });

  it('includes component costs from BOM', () => {
    const items = [defaultBomItem({ quantity: 10, unitCost: 0.5 })];
    const pricing = calculatePricing(defaultBoardSpec(), 'jlcpcb', 5, items);
    expect(pricing.componentCost).toBe(25); // 10 * 0.5 * 5
  });

  it('includes shipping cost when specified', () => {
    const noShip = calculatePricing(defaultBoardSpec(), 'jlcpcb', 10, []);
    const withShip = calculatePricing(defaultBoardSpec(), 'jlcpcb', 10, [], 'DHL Express');
    expect(withShip.shipping).toBeGreaterThan(0);
    expect(withShip.total).toBeGreaterThan(noShip.total);
  });

  it('rounds all values to 2 decimal places', () => {
    const pricing = calculatePricing(defaultBoardSpec(), 'jlcpcb', 3, []);
    const check = (n: number) => expect(Math.round(n * 100) / 100).toBe(n);
    check(pricing.pcbFabrication);
    check(pricing.total);
    check(pricing.perBoard);
  });

  it('returns zeros for unknown fab house', () => {
    const pricing = calculatePricing(defaultBoardSpec(), 'unknown' as FabHouseId, 10, []);
    expect(pricing.total).toBe(0);
  });

  it('handles zero quantity', () => {
    const pricing = calculatePricing(defaultBoardSpec(), 'jlcpcb', 0, []);
    expect(pricing.perBoard).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests — estimateLeadTime
// ---------------------------------------------------------------------------

describe('estimateLeadTime', () => {
  it('calculates standard lead time', () => {
    const days = estimateLeadTime('jlcpcb', 'standard');
    expect(days).toBe(FAB_HOUSE_PROFILES.jlcpcb.leadTimes.standard);
  });

  it('adds shipping days', () => {
    const fabOnly = estimateLeadTime('jlcpcb', 'standard');
    const withShipping = estimateLeadTime('jlcpcb', 'standard', 'DHL Express');
    expect(withShipping).toBeGreaterThan(fabOnly);
  });

  it('rush is faster than economy', () => {
    const rush = estimateLeadTime('jlcpcb', 'rush');
    const economy = estimateLeadTime('jlcpcb', 'economy');
    expect(rush).toBeLessThan(economy);
  });

  it('returns 0 for unknown fab house', () => {
    expect(estimateLeadTime('unknown' as FabHouseId)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests — checkComponentAvailability
// ---------------------------------------------------------------------------

describe('checkComponentAvailability', () => {
  it('separates available from unavailable', () => {
    const items = [
      defaultBomItem({ partNumber: 'R1', available: true }),
      defaultBomItem({ partNumber: 'R2', available: false }),
      defaultBomItem({ partNumber: 'R3', available: true }),
    ];
    const result = checkComponentAvailability(items);
    expect(result.totalAvailable).toBe(2);
    expect(result.totalItems).toBe(3);
    expect(result.available.length).toBe(2);
    expect(result.unavailable.length).toBe(1);
  });

  it('handles empty BOM', () => {
    const result = checkComponentAvailability([]);
    expect(result.totalItems).toBe(0);
    expect(result.totalAvailable).toBe(0);
  });

  it('handles all available', () => {
    const items = [defaultBomItem(), defaultBomItem()];
    const result = checkComponentAvailability(items);
    expect(result.unavailable.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests — suggestSubstitutes
// ---------------------------------------------------------------------------

describe('suggestSubstitutes', () => {
  it('suggests larger package for 0402', () => {
    const subs = suggestSubstitutes([
      defaultBomItem({ partNumber: 'RC0402JR-07100KL', available: false }),
    ]);
    expect(subs.length).toBe(1);
    expect(subs[0].substitute).toContain('0603');
    expect(subs[0].compatible).toBe(true);
  });

  it('suggests larger package for 0603', () => {
    const subs = suggestSubstitutes([
      defaultBomItem({ partNumber: 'RC0603JR-07100KL', available: false }),
    ]);
    expect(subs.length).toBe(1);
    expect(subs[0].substitute).toContain('0805');
  });

  it('suggests MCU substitutes for ATmega328P', () => {
    const subs = suggestSubstitutes([
      defaultBomItem({ partNumber: 'ATmega328P-AU', description: 'ATmega328P microcontroller', available: false }),
    ]);
    expect(subs.length).toBe(1);
    expect(subs[0].substitute).toContain('ATmega328PB');
  });

  it('returns incompatible flag when no substitute found', () => {
    const subs = suggestSubstitutes([
      defaultBomItem({ partNumber: 'EXOTIC-PART-12345', description: 'Exotic widget', available: false }),
    ]);
    expect(subs.length).toBe(1);
    expect(subs[0].compatible).toBe(false);
    expect(subs[0].substitute).toBe('');
  });

  it('handles empty input', () => {
    expect(suggestSubstitutes([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tests — generateOrderSummary
// ---------------------------------------------------------------------------

describe('generateOrderSummary', () => {
  let mgr: FabPipelineManager;

  beforeEach(() => {
    clearStore();
    FabPipelineManager.resetForTesting();
    mgr = FabPipelineManager.getInstance();
  });

  it('generates markdown with order name and status', () => {
    const order = mgr.createOrder('Test Board', 'jlcpcb');
    const md = generateOrderSummary(order);
    expect(md).toContain('Test Board');
    expect(md).toContain('Draft');
    expect(md).toContain('JLCPCB');
  });

  it('includes board specification table', () => {
    const order = mgr.createOrder('Test', 'jlcpcb');
    mgr.addBoardSpec(order.id, defaultBoardSpec());
    const updated = mgr.getOrder(order.id)!;
    const md = generateOrderSummary(updated);
    expect(md).toContain('Board Specification');
    expect(md).toContain('50 x 50');
  });

  it('includes BOM table', () => {
    const order = mgr.createOrder('Test', 'jlcpcb');
    mgr.setBomItems(order.id, [defaultBomItem()]);
    const updated = mgr.getOrder(order.id)!;
    const md = generateOrderSummary(updated);
    expect(md).toContain('Bill of Materials');
    expect(md).toContain('RC0805JR');
  });

  it('includes pricing breakdown', () => {
    const order = mgr.createOrder('Test', 'jlcpcb');
    mgr.addBoardSpec(order.id, defaultBoardSpec());
    mgr.requestQuote(order.id);
    const updated = mgr.getOrder(order.id)!;
    const md = generateOrderSummary(updated);
    expect(md).toContain('Pricing Breakdown');
    expect(md).toContain('PCB Fabrication');
    expect(md).toContain('Total');
  });

  it('includes tracking number when set', () => {
    const order = mgr.createOrder('Test', 'jlcpcb');
    mgr.setTrackingNumber(order.id, 'TRACK123');
    const updated = mgr.getOrder(order.id)!;
    const md = generateOrderSummary(updated);
    expect(md).toContain('TRACK123');
  });
});

// ---------------------------------------------------------------------------
// Tests — FabPipelineManager singleton
// ---------------------------------------------------------------------------

describe('FabPipelineManager', () => {
  let mgr: FabPipelineManager;

  beforeEach(() => {
    clearStore();
    FabPipelineManager.resetForTesting();
    mgr = FabPipelineManager.getInstance();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Singleton ──

  describe('singleton', () => {
    it('returns the same instance on subsequent calls', () => {
      const a = FabPipelineManager.getInstance();
      const b = FabPipelineManager.getInstance();
      expect(a).toBe(b);
    });

    it('returns a new instance after resetForTesting', () => {
      const a = FabPipelineManager.getInstance();
      FabPipelineManager.resetForTesting();
      const b = FabPipelineManager.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // ── Subscribe ──

  describe('subscribe', () => {
    it('notifies on createOrder', () => {
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.createOrder('Board', 'jlcpcb');
      expect(listener).toHaveBeenCalled();
    });

    it('unsubscribe stops notifications', () => {
      const listener = vi.fn();
      const unsub = mgr.subscribe(listener);
      unsub();
      mgr.createOrder('Board', 'jlcpcb');
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ── CRUD ──

  describe('createOrder', () => {
    it('creates an order with draft stage', () => {
      const order = mgr.createOrder('My Board', 'jlcpcb');
      expect(order.name).toBe('My Board');
      expect(order.fabHouseId).toBe('jlcpcb');
      expect(order.stage).toBe('draft');
      expect(order.stageHistory).toEqual([{ stage: 'draft', timestamp: expect.any(Number) as number }]);
    });

    it('uses default quantity of 5', () => {
      const order = mgr.createOrder('Board', 'pcbway');
      expect(order.quantity).toBe(5);
    });

    it('accepts custom quantity', () => {
      const order = mgr.createOrder('Board', 'pcbway', 100);
      expect(order.quantity).toBe(100);
    });
  });

  describe('getOrder', () => {
    it('retrieves an order by ID', () => {
      const order = mgr.createOrder('Board', 'jlcpcb');
      const retrieved = mgr.getOrder(order.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.name).toBe('Board');
    });

    it('returns undefined for unknown ID', () => {
      expect(mgr.getOrder('nonexistent')).toBeUndefined();
    });
  });

  describe('getAllOrders', () => {
    it('returns all orders', () => {
      mgr.createOrder('A', 'jlcpcb');
      mgr.createOrder('B', 'pcbway');
      expect(mgr.getAllOrders().length).toBe(2);
    });
  });

  describe('getOrdersByStage', () => {
    it('filters by stage', () => {
      const o1 = mgr.createOrder('A', 'jlcpcb');
      mgr.createOrder('B', 'pcbway');
      mgr.addBoardSpec(o1.id, defaultBoardSpec());
      mgr.requestQuote(o1.id); // advances to quoting
      expect(mgr.getOrdersByStage('draft').length).toBe(1);
      expect(mgr.getOrdersByStage('quoting').length).toBe(1);
    });
  });

  describe('deleteOrder', () => {
    it('removes an order', () => {
      const order = mgr.createOrder('Board', 'jlcpcb');
      expect(mgr.deleteOrder(order.id)).toBe(true);
      expect(mgr.getOrder(order.id)).toBeUndefined();
    });

    it('returns false for nonexistent order', () => {
      expect(mgr.deleteOrder('nonexistent')).toBe(false);
    });
  });

  // ── Board spec ──

  describe('addBoardSpec', () => {
    it('sets board spec on order', () => {
      const order = mgr.createOrder('Board', 'jlcpcb');
      const errors = mgr.addBoardSpec(order.id, defaultBoardSpec());
      expect(errors).toEqual([]);
      expect(mgr.getOrder(order.id)!.boardSpec).not.toBeNull();
    });

    it('returns validation errors', () => {
      const order = mgr.createOrder('Board', 'oshpark');
      const errors = mgr.addBoardSpec(order.id, defaultBoardSpec({ finish: 'HASL' }));
      expect(errors.length).toBeGreaterThan(0);
    });

    it('returns error for unknown order', () => {
      const errors = mgr.addBoardSpec('nonexistent', defaultBoardSpec());
      expect(errors).toEqual(['Order not found']);
    });
  });

  // ── BOM ──

  describe('setBomItems', () => {
    it('sets BOM items on order', () => {
      const order = mgr.createOrder('Board', 'jlcpcb');
      const items = [defaultBomItem(), defaultBomItem({ partNumber: 'C1', available: false })];
      mgr.setBomItems(order.id, items);
      const updated = mgr.getOrder(order.id)!;
      expect(updated.bomItems.length).toBe(2);
    });

    it('auto-generates substitutes for unavailable items', () => {
      const order = mgr.createOrder('Board', 'jlcpcb');
      mgr.setBomItems(order.id, [
        defaultBomItem({ partNumber: 'RC0402JR-100K', available: false }),
      ]);
      const updated = mgr.getOrder(order.id)!;
      expect(updated.substitutes.length).toBe(1);
    });

    it('does nothing for unknown order', () => {
      // Should not throw
      mgr.setBomItems('nonexistent', []);
    });
  });

  // ── Quoting ──

  describe('requestQuote', () => {
    it('generates pricing and advances to quoting', () => {
      const order = mgr.createOrder('Board', 'jlcpcb');
      mgr.addBoardSpec(order.id, defaultBoardSpec());
      const pricing = mgr.requestQuote(order.id);
      expect(pricing).not.toBeNull();
      expect(pricing!.total).toBeGreaterThan(0);
      expect(mgr.getOrder(order.id)!.stage).toBe('quoting');
    });

    it('returns null without board spec', () => {
      const order = mgr.createOrder('Board', 'jlcpcb');
      expect(mgr.requestQuote(order.id)).toBeNull();
    });

    it('returns null for unknown order', () => {
      expect(mgr.requestQuote('nonexistent')).toBeNull();
    });
  });

  // ── Shipping ──

  describe('setShipping', () => {
    it('sets shipping method and recalculates pricing', () => {
      const order = mgr.createOrder('Board', 'jlcpcb');
      mgr.addBoardSpec(order.id, defaultBoardSpec());
      mgr.requestQuote(order.id);
      mgr.setShipping(order.id, 'DHL Express');
      const updated = mgr.getOrder(order.id)!;
      expect(updated.selectedShipping).toBe('DHL Express');
      expect(updated.pricing!.shipping).toBeGreaterThan(0);
    });
  });

  describe('getShippingOptions', () => {
    it('returns shipping options for order fab house', () => {
      const order = mgr.createOrder('Board', 'jlcpcb');
      const options = mgr.getShippingOptions(order.id);
      expect(options.length).toBeGreaterThan(0);
      expect(options[0].method).toBeTruthy();
    });

    it('returns empty for unknown order', () => {
      expect(mgr.getShippingOptions('nonexistent')).toEqual([]);
    });
  });

  // ── Stage management ──

  describe('advanceStage', () => {
    it('advances from draft to quoting', () => {
      const order = mgr.createOrder('Board', 'jlcpcb');
      expect(mgr.advanceStage(order.id)).toBe(true);
      expect(mgr.getOrder(order.id)!.stage).toBe('quoting');
    });

    it('advances through full pipeline', () => {
      const order = mgr.createOrder('Board', 'jlcpcb');
      mgr.advanceStage(order.id); // → quoting
      mgr.advanceStage(order.id); // → submitted
      mgr.advanceStage(order.id); // → manufacturing
      mgr.advanceStage(order.id); // → shipped
      expect(mgr.getOrder(order.id)!.stage).toBe('shipped');
    });

    it('returns false when already at final stage', () => {
      const order = mgr.createOrder('Board', 'jlcpcb');
      for (let i = 0; i < 4; i++) {
        mgr.advanceStage(order.id);
      }
      expect(mgr.advanceStage(order.id)).toBe(false);
    });

    it('records stage history', () => {
      const order = mgr.createOrder('Board', 'jlcpcb');
      mgr.advanceStage(order.id);
      mgr.advanceStage(order.id);
      const updated = mgr.getOrder(order.id)!;
      expect(updated.stageHistory.length).toBe(3); // draft + quoting + submitted
    });

    it('accepts target stage', () => {
      const order = mgr.createOrder('Board', 'jlcpcb');
      expect(mgr.advanceStage(order.id, 'submitted')).toBe(true);
      expect(mgr.getOrder(order.id)!.stage).toBe('submitted');
    });

    it('rejects backward stage transition', () => {
      const order = mgr.createOrder('Board', 'jlcpcb');
      mgr.advanceStage(order.id, 'submitted');
      expect(mgr.advanceStage(order.id, 'draft')).toBe(false);
    });

    it('returns false for unknown order', () => {
      expect(mgr.advanceStage('nonexistent')).toBe(false);
    });
  });

  describe('submitOrder', () => {
    it('submits an order with board spec and pricing', () => {
      const order = mgr.createOrder('Board', 'jlcpcb');
      mgr.addBoardSpec(order.id, defaultBoardSpec());
      mgr.requestQuote(order.id);
      expect(mgr.submitOrder(order.id)).toBe(true);
      expect(mgr.getOrder(order.id)!.stage).toBe('submitted');
    });

    it('fails without board spec', () => {
      const order = mgr.createOrder('Board', 'jlcpcb');
      expect(mgr.submitOrder(order.id)).toBe(false);
    });

    it('fails without pricing', () => {
      const order = mgr.createOrder('Board', 'jlcpcb');
      mgr.addBoardSpec(order.id, defaultBoardSpec());
      expect(mgr.submitOrder(order.id)).toBe(false);
    });
  });

  // ── Metadata setters ──

  describe('metadata setters', () => {
    it('setTrackingNumber', () => {
      const order = mgr.createOrder('Board', 'jlcpcb');
      mgr.setTrackingNumber(order.id, 'TRACK-123');
      expect(mgr.getOrder(order.id)!.trackingNumber).toBe('TRACK-123');
    });

    it('setEstimatedDelivery', () => {
      const order = mgr.createOrder('Board', 'jlcpcb');
      const ts = Date.now() + 86400000;
      mgr.setEstimatedDelivery(order.id, ts);
      expect(mgr.getOrder(order.id)!.estimatedDelivery).toBe(ts);
    });

    it('setNotes', () => {
      const order = mgr.createOrder('Board', 'jlcpcb');
      mgr.setNotes(order.id, 'Rush this order');
      expect(mgr.getOrder(order.id)!.notes).toBe('Rush this order');
    });

    it('setQuantity clamps to minimum 1', () => {
      const order = mgr.createOrder('Board', 'jlcpcb');
      mgr.setQuantity(order.id, 0);
      expect(mgr.getOrder(order.id)!.quantity).toBe(1);
    });

    it('setQuantity floors to integer', () => {
      const order = mgr.createOrder('Board', 'jlcpcb');
      mgr.setQuantity(order.id, 7.9);
      expect(mgr.getOrder(order.id)!.quantity).toBe(7);
    });

    it('setQuantity recalculates pricing', () => {
      const order = mgr.createOrder('Board', 'jlcpcb');
      mgr.addBoardSpec(order.id, defaultBoardSpec());
      mgr.requestQuote(order.id);
      const priceBefore = mgr.getOrder(order.id)!.pricing!.total;
      mgr.setQuantity(order.id, 100);
      const priceAfter = mgr.getOrder(order.id)!.pricing!.total;
      expect(priceAfter).toBeGreaterThan(priceBefore);
    });
  });

  // ── Lead time ──

  describe('getLeadTime', () => {
    it('returns lead time for order', () => {
      const order = mgr.createOrder('Board', 'jlcpcb');
      const lt = mgr.getLeadTime(order.id, 'standard');
      expect(lt).toBe(FAB_HOUSE_PROFILES.jlcpcb.leadTimes.standard);
    });

    it('includes shipping time', () => {
      const order = mgr.createOrder('Board', 'jlcpcb');
      mgr.setShipping(order.id, 'DHL Express');
      const lt = mgr.getLeadTime(order.id, 'standard');
      expect(lt).toBeGreaterThan(FAB_HOUSE_PROFILES.jlcpcb.leadTimes.standard);
    });

    it('returns 0 for unknown order', () => {
      expect(mgr.getLeadTime('nonexistent')).toBe(0);
    });
  });

  // ── Summary ──

  describe('getOrderSummary', () => {
    it('returns markdown for valid order', () => {
      const order = mgr.createOrder('Test', 'jlcpcb');
      const md = mgr.getOrderSummary(order.id);
      expect(md).toContain('Test');
    });

    it('returns error for unknown order', () => {
      expect(mgr.getOrderSummary('nonexistent')).toContain('not found');
    });
  });

  // ── Comparison ──

  describe('compareQuotes', () => {
    it('returns quotes from all 5 fab houses', () => {
      const results = mgr.compareQuotes(defaultBoardSpec(), 10);
      expect(results.length).toBe(5);
    });

    it('each result has pricing and errors', () => {
      const results = mgr.compareQuotes(defaultBoardSpec(), 10);
      for (const r of results) {
        expect(r.fabHouseId).toBeTruthy();
        expect(r.name).toBeTruthy();
        expect(r.pricing).toBeDefined();
        expect(r.leadTime).toBeGreaterThan(0);
        expect(Array.isArray(r.errors)).toBe(true);
      }
    });

    it('flags validation errors for incompatible specs', () => {
      // OSH Park doesn't support HASL or green solder mask
      const results = mgr.compareQuotes(defaultBoardSpec(), 10);
      const oshpark = results.find((r) => r.fabHouseId === 'oshpark');
      expect(oshpark!.errors.length).toBeGreaterThan(0);
    });

    it('includes BOM costs in comparison', () => {
      const bom = [defaultBomItem({ quantity: 10, unitCost: 1.0 })];
      const results = mgr.compareQuotes(defaultBoardSpec(), 10, bom);
      for (const r of results) {
        expect(r.pricing.componentCost).toBeGreaterThan(0);
      }
    });
  });

  // ── Persistence ──

  describe('persistence', () => {
    it('persists orders to localStorage', () => {
      mgr.createOrder('Persistent', 'jlcpcb');
      expect(store['protopulse:fab-pipeline-orders']).toBeTruthy();
    });

    it('restores orders from localStorage', () => {
      mgr.createOrder('Persistent', 'jlcpcb');
      FabPipelineManager.resetForTesting();
      const mgr2 = FabPipelineManager.getInstance();
      expect(mgr2.getAllOrders().length).toBe(1);
      expect(mgr2.getAllOrders()[0].name).toBe('Persistent');
    });
  });

  // ── Snapshot ──

  describe('getSnapshot', () => {
    it('returns current state', () => {
      mgr.createOrder('A', 'jlcpcb');
      mgr.createOrder('B', 'pcbway');
      const snap = mgr.getSnapshot();
      expect(snap.orderCount).toBe(2);
      expect(snap.orders.length).toBe(2);
    });
  });
});
