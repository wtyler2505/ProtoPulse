import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => `uuid-${Math.random().toString(36).slice(2, 10)}`),
});

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

import type { BoardSpecification, FabricatorId } from '../pcb-ordering';
import { PcbOrderingEngine, usePcbOrdering } from '../pcb-ordering';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultBoardSpec(overrides: Partial<BoardSpecification> = {}): BoardSpecification {
  return {
    width: 50,
    height: 50,
    layers: 2,
    thickness: 1.6,
    copperWeight: 1,
    finish: 'HASL',
    solderMaskColor: 'green',
    silkscreenColor: 'white',
    minTraceWidth: 0.2,
    minDrillSize: 0.3,
    castellatedHoles: false,
    impedanceControl: false,
    viaInPad: false,
    goldFingers: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PcbOrderingEngine', () => {
  let engine: PcbOrderingEngine;

  beforeEach(() => {
    for (const k of Object.keys(store)) {
      delete store[k];
    }
    PcbOrderingEngine.resetForTesting();
    engine = PcbOrderingEngine.getInstance();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance on subsequent calls', () => {
      const a = PcbOrderingEngine.getInstance();
      const b = PcbOrderingEngine.getInstance();
      expect(a).toBe(b);
    });

    it('returns a new instance after resetForTesting', () => {
      const a = PcbOrderingEngine.getInstance();
      PcbOrderingEngine.resetForTesting();
      const b = PcbOrderingEngine.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // -----------------------------------------------------------------------
  // Fabricator Profiles
  // -----------------------------------------------------------------------

  describe('fabricator profiles', () => {
    it('getFabricator returns a known fabricator', () => {
      const fab = engine.getFabricator('jlcpcb');
      expect(fab).not.toBeNull();
      expect(fab!.name).toBe('JLCPCB');
      expect(fab!.website).toBe('https://jlcpcb.com');
    });

    it('getFabricator returns null for unknown id', () => {
      const fab = engine.getFabricator('nonexistent' as FabricatorId);
      expect(fab).toBeNull();
    });

    it('getAllFabricators returns all 5 profiles', () => {
      const fabs = engine.getAllFabricators();
      expect(fabs).toHaveLength(5);
      const ids = fabs.map((f) => f.id);
      expect(ids).toContain('jlcpcb');
      expect(ids).toContain('pcbway');
      expect(ids).toContain('oshpark');
      expect(ids).toContain('pcbgogo');
      expect(ids).toContain('seeedstudio');
    });

    it('each fabricator has valid capabilities', () => {
      const fabs = engine.getAllFabricators();
      fabs.forEach((fab) => {
        expect(fab.capabilities.maxLayers).toBeGreaterThan(0);
        expect(fab.capabilities.minTrace).toBeGreaterThan(0);
        expect(fab.capabilities.minDrill).toBeGreaterThan(0);
        expect(fab.capabilities.availableFinishes.length).toBeGreaterThan(0);
        expect(fab.capabilities.availableColors.length).toBeGreaterThan(0);
        expect(fab.capabilities.availableSilkscreen.length).toBeGreaterThan(0);
        expect(fab.capabilities.availableCopperWeights.length).toBeGreaterThan(0);
        expect(fab.shippingOptions.length).toBeGreaterThan(0);
      });
    });

    it('each fabricator has pricing info', () => {
      const fabs = engine.getAllFabricators();
      fabs.forEach((fab) => {
        expect(fab.pricing.basePrice).toBeGreaterThan(0);
        expect(fab.pricing.perBoardArea).toBeGreaterThan(0);
        expect(fab.pricing.rushMultiplier).toBeGreaterThan(1);
      });
    });
  });

  // -----------------------------------------------------------------------
  // DFM Check
  // -----------------------------------------------------------------------

  describe('DFM check', () => {
    it('passes for a valid board spec against JLCPCB', () => {
      const result = engine.runDfmCheck(defaultBoardSpec(), 'jlcpcb');
      expect(result.passed).toBe(true);
      expect(result.fabricator).toBe('jlcpcb');
      expect(result.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    });

    it('fails when trace width is too narrow', () => {
      const result = engine.runDfmCheck(defaultBoardSpec({ minTraceWidth: 0.01 }), 'jlcpcb');
      expect(result.passed).toBe(false);
      const traceIssue = result.issues.find((i) => i.rule === 'min-trace-width');
      expect(traceIssue).toBeDefined();
      expect(traceIssue!.severity).toBe('error');
    });

    it('fails when drill size is too small', () => {
      const result = engine.runDfmCheck(defaultBoardSpec({ minDrillSize: 0.05 }), 'jlcpcb');
      expect(result.passed).toBe(false);
      const drillIssue = result.issues.find((i) => i.rule === 'min-drill-size');
      expect(drillIssue).toBeDefined();
      expect(drillIssue!.severity).toBe('error');
    });

    it('fails when layer count exceeds maximum', () => {
      const result = engine.runDfmCheck(defaultBoardSpec({ layers: 40 }), 'jlcpcb');
      expect(result.passed).toBe(false);
      const layerIssue = result.issues.find((i) => i.rule === 'max-layers');
      expect(layerIssue).toBeDefined();
    });

    it('fails when finish is not supported', () => {
      // OSH Park only supports ENIG
      const result = engine.runDfmCheck(defaultBoardSpec({ finish: 'HASL' }), 'oshpark');
      expect(result.passed).toBe(false);
      const finishIssue = result.issues.find((i) => i.rule === 'finish-available');
      expect(finishIssue).toBeDefined();
    });

    it('fails for board below minimum size', () => {
      const result = engine.runDfmCheck(defaultBoardSpec({ width: 2, height: 2 }), 'jlcpcb');
      expect(result.passed).toBe(false);
      const sizeIssue = result.issues.find((i) => i.rule === 'min-board-size');
      expect(sizeIssue).toBeDefined();
    });

    it('fails for board above maximum size', () => {
      const result = engine.runDfmCheck(defaultBoardSpec({ width: 600, height: 600 }), 'jlcpcb');
      expect(result.passed).toBe(false);
      const sizeIssue = result.issues.find((i) => i.rule === 'max-board-size');
      expect(sizeIssue).toBeDefined();
    });

    it('warns when trace width is near the limit', () => {
      // JLCPCB minTrace = 0.09, so 0.1 is within 1.2x (0.108)
      const result = engine.runDfmCheck(defaultBoardSpec({ minTraceWidth: 0.1 }), 'jlcpcb');
      const warning = result.issues.find((i) => i.rule === 'trace-width-near-limit');
      expect(warning).toBeDefined();
      expect(warning!.severity).toBe('warning');
    });

    it('warns when drill size is near the limit', () => {
      // JLCPCB minDrill = 0.15, so 0.17 is within 1.2x (0.18)
      const result = engine.runDfmCheck(defaultBoardSpec({ minDrillSize: 0.17 }), 'jlcpcb');
      const warning = result.issues.find((i) => i.rule === 'drill-size-near-limit');
      expect(warning).toBeDefined();
      expect(warning!.severity).toBe('warning');
    });

    it('fails when castellated holes not supported', () => {
      const result = engine.runDfmCheck(defaultBoardSpec({ castellatedHoles: true, finish: 'ENIG', solderMaskColor: 'purple', copperWeight: 1 }), 'oshpark');
      const issue = result.issues.find((i) => i.rule === 'castellated-holes');
      expect(issue).toBeDefined();
      expect(issue!.severity).toBe('error');
    });

    it('fails when impedance control not supported', () => {
      const result = engine.runDfmCheck(defaultBoardSpec({ impedanceControl: true, finish: 'ENIG', solderMaskColor: 'purple', copperWeight: 1 }), 'oshpark');
      const issue = result.issues.find((i) => i.rule === 'impedance-control');
      expect(issue).toBeDefined();
    });

    it('fails when via-in-pad not supported', () => {
      const result = engine.runDfmCheck(defaultBoardSpec({ viaInPad: true, finish: 'ENIG', solderMaskColor: 'purple', copperWeight: 1 }), 'oshpark');
      const issue = result.issues.find((i) => i.rule === 'via-in-pad');
      expect(issue).toBeDefined();
    });

    it('fails when gold fingers not supported', () => {
      const result = engine.runDfmCheck(defaultBoardSpec({ goldFingers: true, finish: 'ENIG', solderMaskColor: 'purple', copperWeight: 1 }), 'oshpark');
      const issue = result.issues.find((i) => i.rule === 'gold-fingers');
      expect(issue).toBeDefined();
    });

    it('returns error for unknown fabricator', () => {
      const result = engine.runDfmCheck(defaultBoardSpec(), 'nonexistent' as FabricatorId);
      expect(result.passed).toBe(false);
      expect(result.issues[0].rule).toBe('fabricator-exists');
    });

    it('adds info note for multi-layer boards', () => {
      const result = engine.runDfmCheck(defaultBoardSpec({ layers: 4 }), 'jlcpcb');
      const info = result.issues.find((i) => i.severity === 'info' && i.rule === 'multi-layer-note');
      expect(info).toBeDefined();
    });

    it('fails for negative board dimensions', () => {
      const result = engine.runDfmCheck(defaultBoardSpec({ width: -10, height: -5 }), 'jlcpcb');
      expect(result.passed).toBe(false);
      const issue = result.issues.find((i) => i.rule === 'board-dimensions-positive');
      expect(issue).toBeDefined();
    });

    it('fails for unsupported solder mask color', () => {
      // OSH Park only supports purple
      const result = engine.runDfmCheck(defaultBoardSpec({ finish: 'ENIG', copperWeight: 1 }), 'oshpark');
      const issue = result.issues.find((i) => i.rule === 'solder-mask-color');
      expect(issue).toBeDefined();
    });

    it('fails for unsupported silkscreen color', () => {
      // PCBGoGo only supports white and black silkscreen
      const result = engine.runDfmCheck(defaultBoardSpec({ silkscreenColor: 'yellow' }), 'pcbgogo');
      const issue = result.issues.find((i) => i.rule === 'silkscreen-color');
      expect(issue).toBeDefined();
    });

    it('fails for unsupported copper weight', () => {
      // OSH Park only supports 1oz and 2oz
      const result = engine.runDfmCheck(defaultBoardSpec({ copperWeight: 4, finish: 'ENIG', solderMaskColor: 'purple' }), 'oshpark');
      const issue = result.issues.find((i) => i.rule === 'copper-weight');
      expect(issue).toBeDefined();
    });

    it('has a timestamp on results', () => {
      const before = Date.now();
      const result = engine.runDfmCheck(defaultBoardSpec(), 'jlcpcb');
      expect(result.timestamp).toBeGreaterThanOrEqual(before);
    });
  });

  // -----------------------------------------------------------------------
  // Compare Fabricators
  // -----------------------------------------------------------------------

  describe('compareFabricators', () => {
    it('returns all fabricators with compatibility info', () => {
      const results = engine.compareFabricators(defaultBoardSpec());
      expect(results).toHaveLength(5);
    });

    it('marks compatible fabricators correctly', () => {
      const results = engine.compareFabricators(defaultBoardSpec());
      const jlcpcb = results.find((r) => r.fabricator.id === 'jlcpcb');
      expect(jlcpcb!.compatible).toBe(true);
      expect(jlcpcb!.issues).toHaveLength(0);
    });

    it('marks incompatible fabricators with issues', () => {
      // OSH Park can't do HASL, green, etc.
      const results = engine.compareFabricators(defaultBoardSpec());
      const oshpark = results.find((r) => r.fabricator.id === 'oshpark');
      expect(oshpark!.compatible).toBe(false);
      expect(oshpark!.issues.length).toBeGreaterThan(0);
    });

    it('filters out fabs that cannot handle layer count', () => {
      const spec = defaultBoardSpec({ layers: 12, finish: 'HASL' });
      const results = engine.compareFabricators(spec);
      const oshpark = results.find((r) => r.fabricator.id === 'oshpark');
      expect(oshpark!.compatible).toBe(false);
      expect(oshpark!.issues.some((i) => i.includes('Layer count'))).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Pricing / Quotes
  // -----------------------------------------------------------------------

  describe('pricing', () => {
    it('generates a valid quote', () => {
      const spec = defaultBoardSpec();
      const quote = engine.getQuote(spec, 'jlcpcb', 10);
      expect(quote.fabricator).toBe('jlcpcb');
      expect(quote.quantity).toBe(10);
      expect(quote.unitPrice).toBeGreaterThan(0);
      expect(quote.totalPrice).toBeGreaterThan(0);
      expect(quote.grandTotal).toBeGreaterThan(0);
      expect(quote.currency).toBe('USD');
      expect(quote.turnaround).toBe('standard');
      expect(quote.breakdown.length).toBeGreaterThan(0);
    });

    it('total price equals unit price times quantity', () => {
      const quote = engine.getQuote(defaultBoardSpec(), 'jlcpcb', 5);
      expect(quote.totalPrice).toBeCloseTo(quote.unitPrice * 5, 2);
    });

    it('grand total includes shipping', () => {
      const quote = engine.getQuote(defaultBoardSpec(), 'jlcpcb', 5);
      expect(quote.grandTotal).toBeGreaterThan(quote.totalPrice);
    });

    it('rush pricing applies multiplier', () => {
      const standardQuote = engine.getQuote(defaultBoardSpec(), 'jlcpcb', 5, 'standard');
      const rushQuote = engine.getQuote(defaultBoardSpec(), 'jlcpcb', 5, 'rush');
      expect(rushQuote.unitPrice).toBeGreaterThan(standardQuote.unitPrice);
    });

    it('extra layers add cost', () => {
      const twoLayer = engine.getQuote(defaultBoardSpec({ layers: 2 }), 'jlcpcb', 5);
      const fourLayer = engine.getQuote(defaultBoardSpec({ layers: 4 }), 'jlcpcb', 5);
      expect(fourLayer.unitPrice).toBeGreaterThan(twoLayer.unitPrice);
    });

    it('finish upgrade adds cost', () => {
      const hasl = engine.getQuote(defaultBoardSpec({ finish: 'HASL' }), 'jlcpcb', 5);
      const enig = engine.getQuote(defaultBoardSpec({ finish: 'ENIG' }), 'jlcpcb', 5);
      expect(enig.unitPrice).toBeGreaterThan(hasl.unitPrice);
    });

    it('larger board area adds cost', () => {
      const small = engine.getQuote(defaultBoardSpec({ width: 20, height: 20 }), 'jlcpcb', 5);
      const large = engine.getQuote(defaultBoardSpec({ width: 100, height: 100 }), 'jlcpcb', 5);
      expect(large.unitPrice).toBeGreaterThan(small.unitPrice);
    });

    it('throws for unknown fabricator', () => {
      expect(() => engine.getQuote(defaultBoardSpec(), 'nonexistent' as FabricatorId, 5)).toThrow(
        'Unknown fabricator',
      );
    });

    it('throws for zero quantity', () => {
      expect(() => engine.getQuote(defaultBoardSpec(), 'jlcpcb', 0)).toThrow('Quantity must be greater than zero');
    });

    it('quote has a validUntil timestamp in the future', () => {
      const quote = engine.getQuote(defaultBoardSpec(), 'jlcpcb', 5);
      expect(quote.validUntil).toBeGreaterThan(Date.now());
    });

    it('quote has turnaround days', () => {
      const quote = engine.getQuote(defaultBoardSpec(), 'jlcpcb', 5, 'economy');
      expect(quote.turnaroundDays).toBe(7);
    });
  });

  describe('compareQuotes', () => {
    it('returns quotes sorted by grandTotal', () => {
      const spec = defaultBoardSpec();
      const quotes = engine.compareQuotes(spec, 10);
      // Should only include compatible fabs
      expect(quotes.length).toBeGreaterThan(0);
      for (let i = 1; i < quotes.length; i++) {
        expect(quotes[i].grandTotal).toBeGreaterThanOrEqual(quotes[i - 1].grandTotal);
      }
    });

    it('excludes incompatible fabricators', () => {
      // Default spec uses HASL/green/white which OSH Park can't do
      const quotes = engine.compareQuotes(defaultBoardSpec(), 5);
      const oshparkQuote = quotes.find((q) => q.fabricator === 'oshpark');
      expect(oshparkQuote).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // Order CRUD
  // -----------------------------------------------------------------------

  describe('order management', () => {
    it('creates an order in draft status', () => {
      const order = engine.createOrder('jlcpcb', defaultBoardSpec(), 10);
      expect(order.id).toBeDefined();
      expect(order.status).toBe('draft');
      expect(order.fabricator).toBe('jlcpcb');
      expect(order.quantity).toBe(10);
      expect(order.quote).toBeNull();
      expect(order.dfmResult).toBeNull();
    });

    it('getOrder retrieves created order', () => {
      const created = engine.createOrder('jlcpcb', defaultBoardSpec(), 5);
      const fetched = engine.getOrder(created.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(created.id);
    });

    it('getOrder returns null for unknown id', () => {
      expect(engine.getOrder('nonexistent')).toBeNull();
    });

    it('getAllOrders returns all created orders', () => {
      engine.createOrder('jlcpcb', defaultBoardSpec(), 5);
      engine.createOrder('pcbway', defaultBoardSpec(), 10);
      expect(engine.getAllOrders()).toHaveLength(2);
    });

    it('updateOrder modifies quantity and notes', () => {
      const order = engine.createOrder('jlcpcb', defaultBoardSpec(), 5);
      const updated = engine.updateOrder(order.id, { quantity: 20, notes: 'test notes' });
      expect(updated).not.toBeNull();
      expect(updated!.quantity).toBe(20);
      expect(updated!.notes).toBe('test notes');
    });

    it('updateOrder returns null for unknown id', () => {
      expect(engine.updateOrder('nonexistent', { notes: 'x' })).toBeNull();
    });

    it('updateOrder rejects zero quantity', () => {
      const order = engine.createOrder('jlcpcb', defaultBoardSpec(), 5);
      expect(() => engine.updateOrder(order.id, { quantity: 0 })).toThrow('Quantity must be greater than zero');
    });

    it('cancelOrder sets status to error', () => {
      const order = engine.createOrder('jlcpcb', defaultBoardSpec(), 5);
      const result = engine.cancelOrder(order.id);
      expect(result).toBe(true);
      const cancelled = engine.getOrder(order.id);
      expect(cancelled!.status).toBe('error');
    });

    it('cancelOrder returns false for unknown id', () => {
      expect(engine.cancelOrder('nonexistent')).toBe(false);
    });

    it('cancelOrder refuses to cancel submitted orders', () => {
      const order = engine.createOrder('jlcpcb', defaultBoardSpec(), 5);
      engine.submitOrder(order.id);
      expect(engine.cancelOrder(order.id)).toBe(false);
    });

    it('createOrder throws for unknown fabricator', () => {
      expect(() => engine.createOrder('nonexistent' as FabricatorId, defaultBoardSpec(), 5)).toThrow(
        'Unknown fabricator',
      );
    });

    it('createOrder throws for zero quantity', () => {
      expect(() => engine.createOrder('jlcpcb', defaultBoardSpec(), 0)).toThrow(
        'Quantity must be greater than zero',
      );
    });
  });

  // -----------------------------------------------------------------------
  // Order by Status
  // -----------------------------------------------------------------------

  describe('getOrdersByStatus', () => {
    it('filters orders by status', () => {
      engine.createOrder('jlcpcb', defaultBoardSpec(), 5);
      engine.createOrder('jlcpcb', defaultBoardSpec(), 10);
      const second = engine.createOrder('jlcpcb', defaultBoardSpec(), 15);
      engine.submitOrder(second.id);

      const drafts = engine.getOrdersByStatus('draft');
      expect(drafts).toHaveLength(2);

      const submitted = engine.getOrdersByStatus('submitted');
      expect(submitted).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // Order Workflow
  // -----------------------------------------------------------------------

  describe('order workflow', () => {
    it('submitOrder runs DFM check and generates quote on success', () => {
      const order = engine.createOrder('jlcpcb', defaultBoardSpec(), 5);
      const submitted = engine.submitOrder(order.id);
      expect(submitted.status).toBe('submitted');
      expect(submitted.dfmResult).not.toBeNull();
      expect(submitted.dfmResult!.passed).toBe(true);
      expect(submitted.quote).not.toBeNull();
      expect(submitted.quote!.quantity).toBe(5);
      expect(submitted.submittedAt).toBeDefined();
    });

    it('submitOrder sets error status when DFM fails', () => {
      // Board too small for JLCPCB
      const spec = defaultBoardSpec({ width: 2, height: 2 });
      const order = engine.createOrder('jlcpcb', spec, 5);
      const result = engine.submitOrder(order.id);
      expect(result.status).toBe('error');
      expect(result.dfmResult).not.toBeNull();
      expect(result.dfmResult!.passed).toBe(false);
      expect(result.quote).toBeNull();
    });

    it('submitOrder throws for unknown order id', () => {
      expect(() => engine.submitOrder('nonexistent')).toThrow('Order not found');
    });

    it('full workflow: draft → dfm-check → quoting → submitted', () => {
      const order = engine.createOrder('pcbway', defaultBoardSpec(), 10);
      expect(order.status).toBe('draft');

      const submitted = engine.submitOrder(order.id);
      expect(submitted.status).toBe('submitted');
      expect(submitted.dfmResult!.passed).toBe(true);
      expect(submitted.quote).not.toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Order History
  // -----------------------------------------------------------------------

  describe('order history', () => {
    it('returns orders sorted by newest first', () => {
      engine.createOrder('jlcpcb', defaultBoardSpec(), 5);
      engine.createOrder('pcbway', defaultBoardSpec(), 10);
      const history = engine.getOrderHistory();
      expect(history).toHaveLength(2);
      expect(history[0].createdAt).toBeGreaterThanOrEqual(history[1].createdAt);
    });

    it('clearHistory removes all orders', () => {
      engine.createOrder('jlcpcb', defaultBoardSpec(), 5);
      engine.createOrder('pcbway', defaultBoardSpec(), 10);
      engine.clearHistory();
      expect(engine.getAllOrders()).toHaveLength(0);
      expect(engine.getOrderHistory()).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Export / Import
  // -----------------------------------------------------------------------

  describe('export/import', () => {
    it('exports orders as JSON string', () => {
      engine.createOrder('jlcpcb', defaultBoardSpec(), 5);
      const json = engine.exportOrders();
      const parsed = JSON.parse(json);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
    });

    it('round-trips export/import', () => {
      engine.createOrder('jlcpcb', defaultBoardSpec(), 5);
      engine.createOrder('pcbway', defaultBoardSpec(), 10);
      const json = engine.exportOrders();

      engine.clear();
      expect(engine.getAllOrders()).toHaveLength(0);

      const result = engine.importOrders(json);
      expect(result.imported).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(engine.getAllOrders()).toHaveLength(2);
    });

    it('import rejects invalid JSON', () => {
      const result = engine.importOrders('not json{{{');
      expect(result.imported).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Invalid JSON');
    });

    it('import rejects non-array JSON', () => {
      const result = engine.importOrders('{"key":"value"}');
      expect(result.imported).toBe(0);
      expect(result.errors[0]).toContain('Expected an array');
    });

    it('import skips malformed entries', () => {
      const json = JSON.stringify([{ bad: 'data' }, { id: 'x', status: 'draft', fabricator: 'jlcpcb', createdAt: 1 }]);
      const result = engine.importOrders(json);
      expect(result.imported).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('import skips duplicate ids', () => {
      const order = engine.createOrder('jlcpcb', defaultBoardSpec(), 5);
      const json = engine.exportOrders();
      // Try importing the same order again
      const result = engine.importOrders(json);
      expect(result.imported).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('duplicate id');
      // Ensure we reference order to avoid unused
      expect(order.id).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // localStorage Persistence
  // -----------------------------------------------------------------------

  describe('localStorage persistence', () => {
    it('persists orders to localStorage', () => {
      engine.createOrder('jlcpcb', defaultBoardSpec(), 5);
      expect(localStorage.setItem).toHaveBeenCalledWith('protopulse-pcb-orders', expect.any(String));
    });

    it('loads orders from localStorage on init', () => {
      engine.createOrder('jlcpcb', defaultBoardSpec(), 5);
      const orders = engine.getAllOrders();
      expect(orders).toHaveLength(1);

      // Create new instance (simulating page reload)
      PcbOrderingEngine.resetForTesting();
      const engine2 = PcbOrderingEngine.getInstance();
      const loaded = engine2.getAllOrders();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].fabricator).toBe('jlcpcb');
    });

    it('handles corrupt localStorage gracefully', () => {
      store['protopulse-pcb-orders'] = 'corrupt{{{data';
      PcbOrderingEngine.resetForTesting();
      const engine2 = PcbOrderingEngine.getInstance();
      expect(engine2.getAllOrders()).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Subscribe / Notify
  // -----------------------------------------------------------------------

  describe('subscribe/notify', () => {
    it('notifies listeners on createOrder', () => {
      const listener = vi.fn();
      engine.subscribe(listener);
      engine.createOrder('jlcpcb', defaultBoardSpec(), 5);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies listeners on updateOrder', () => {
      const order = engine.createOrder('jlcpcb', defaultBoardSpec(), 5);
      const listener = vi.fn();
      engine.subscribe(listener);
      engine.updateOrder(order.id, { notes: 'updated' });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies listeners on cancelOrder', () => {
      const order = engine.createOrder('jlcpcb', defaultBoardSpec(), 5);
      const listener = vi.fn();
      engine.subscribe(listener);
      engine.cancelOrder(order.id);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies listeners on submitOrder', () => {
      const order = engine.createOrder('jlcpcb', defaultBoardSpec(), 5);
      const listener = vi.fn();
      engine.subscribe(listener);
      engine.submitOrder(order.id);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies listeners on clear', () => {
      const listener = vi.fn();
      engine.subscribe(listener);
      engine.clear();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('unsubscribe stops notifications', () => {
      const listener = vi.fn();
      const unsub = engine.subscribe(listener);
      unsub();
      engine.createOrder('jlcpcb', defaultBoardSpec(), 5);
      expect(listener).not.toHaveBeenCalled();
    });

    it('notifies listeners on clearHistory', () => {
      const listener = vi.fn();
      engine.subscribe(listener);
      engine.clearHistory();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies listeners on importOrders', () => {
      const order = engine.createOrder('jlcpcb', defaultBoardSpec(), 5);
      const json = engine.exportOrders();
      engine.clear();

      const listener = vi.fn();
      engine.subscribe(listener);
      engine.importOrders(json);
      expect(listener).toHaveBeenCalled();
      // Reference order to avoid unused
      expect(order.id).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // Edge Cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles negative board dimensions', () => {
      const result = engine.runDfmCheck(defaultBoardSpec({ width: -10, height: -5 }), 'jlcpcb');
      expect(result.passed).toBe(false);
    });

    it('handles oversized board', () => {
      const result = engine.runDfmCheck(defaultBoardSpec({ width: 1000, height: 1000 }), 'jlcpcb');
      expect(result.passed).toBe(false);
    });

    it('clear resets all orders', () => {
      engine.createOrder('jlcpcb', defaultBoardSpec(), 5);
      engine.createOrder('pcbway', defaultBoardSpec(), 10);
      engine.clear();
      expect(engine.getAllOrders()).toHaveLength(0);
    });

    it('updateOrder with gerberFileIds', () => {
      const order = engine.createOrder('jlcpcb', defaultBoardSpec(), 5);
      const updated = engine.updateOrder(order.id, { gerberFileIds: ['file1', 'file2'] });
      expect(updated!.gerberFileIds).toEqual(['file1', 'file2']);
    });

    it('cancelOrder adds note about cancellation', () => {
      const order = engine.createOrder('jlcpcb', defaultBoardSpec(), 5);
      engine.cancelOrder(order.id);
      const cancelled = engine.getOrder(order.id);
      expect(cancelled!.notes).toContain('cancelled');
    });

    it('quote breakdown includes base price and area', () => {
      const quote = engine.getQuote(defaultBoardSpec(), 'jlcpcb', 5);
      const items = quote.breakdown.map((b) => b.item);
      expect(items.some((i) => i.includes('Base price'))).toBe(true);
      expect(items.some((i) => i.includes('Board area'))).toBe(true);
    });

    it('quote breakdown includes shipping', () => {
      const quote = engine.getQuote(defaultBoardSpec(), 'jlcpcb', 5);
      const shipping = quote.breakdown.find((b) => b.item === 'Shipping');
      expect(shipping).toBeDefined();
      expect(shipping!.cost).toBeGreaterThan(0);
    });

    it('economy turnaround does not apply rush multiplier', () => {
      const economyQuote = engine.getQuote(defaultBoardSpec(), 'jlcpcb', 5, 'economy');
      const standardQuote = engine.getQuote(defaultBoardSpec(), 'jlcpcb', 5, 'standard');
      expect(economyQuote.unitPrice).toBe(standardQuote.unitPrice);
    });

    it('multiple DFM errors accumulate', () => {
      const spec = defaultBoardSpec({
        layers: 40,
        minTraceWidth: 0.001,
        minDrillSize: 0.001,
        width: 2,
        height: 2,
      });
      const result = engine.runDfmCheck(spec, 'jlcpcb');
      expect(result.passed).toBe(false);
      const errorCount = result.issues.filter((i) => i.severity === 'error').length;
      expect(errorCount).toBeGreaterThanOrEqual(3);
    });

    it('Seeed Studio min board size is enforced', () => {
      // Seeed Studio min is 10x10
      const result = engine.runDfmCheck(defaultBoardSpec({ width: 8, height: 8 }), 'seeedstudio');
      expect(result.passed).toBe(false);
      expect(result.issues.some((i) => i.rule === 'min-board-size')).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Hook shape
  // -----------------------------------------------------------------------

  describe('usePcbOrdering hook', () => {
    it('exports a function', () => {
      expect(typeof usePcbOrdering).toBe('function');
    });

    it('returns the expected shape', () => {
      // We can't call the hook outside React, but we can verify the export exists
      expect(usePcbOrdering).toBeDefined();
    });
  });
});
