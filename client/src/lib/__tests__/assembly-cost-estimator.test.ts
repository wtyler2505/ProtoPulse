import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  AssemblyCostEstimator,
  classifyMountType,
  estimatePinCount,
  bomItemToInput,
  bomToAssemblyParts,
  inferPackageType,
  convertCurrency,
  QUANTITY_TIERS,
} from '../assembly-cost-estimator';

import type {
  AssemblyProfileId,
  BomItemInput,
  BoardParameters,
  CurrencyCode,
  MountType,
  CostBreakdown,
} from '../assembly-cost-estimator';

import type { BomItem } from '@shared/types/bom-compat';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

const DEFAULT_BOARD: BoardParameters = {
  widthMm: 50,
  heightMm: 30,
  layers: 2,
  finish: 'HASL',
  impedanceControl: false,
  viaInPad: false,
  goldFingers: false,
};

function makeBomInput(overrides: Partial<BomItemInput> = {}): BomItemInput {
  return {
    partNumber: 'RC0805JR-0710KL',
    manufacturer: 'Yageo',
    description: '10K Ohm Resistor 0805 SMD',
    quantity: 4,
    unitPrice: 0.01,
    mountType: 'smt',
    pinCount: 2,
    assemblyCategory: null,
    ...overrides,
  };
}

function makeSampleBom(): BomItemInput[] {
  return [
    makeBomInput({ partNumber: 'R1', description: 'Resistor 10K 0805 SMD', quantity: 4, unitPrice: 0.01, mountType: 'smt', pinCount: 2 }),
    makeBomInput({ partNumber: 'R2', description: 'Resistor 4.7K 0805 SMD', quantity: 2, unitPrice: 0.01, mountType: 'smt', pinCount: 2 }),
    makeBomInput({ partNumber: 'C1', description: 'Capacitor 100nF 0603 SMD', quantity: 6, unitPrice: 0.02, mountType: 'smt', pinCount: 2 }),
    makeBomInput({ partNumber: 'U1', description: 'ATmega328P TQFP-32', quantity: 1, unitPrice: 2.50, mountType: 'smt', pinCount: 32 }),
    makeBomInput({ partNumber: 'J1', description: 'Pin Header 2x20 through-hole DIP', quantity: 1, unitPrice: 0.50, mountType: 'through_hole', pinCount: 40 }),
    makeBomInput({ partNumber: 'LED1', description: 'LED 0805 Green SMD', quantity: 3, unitPrice: 0.05, mountType: 'smt', pinCount: 2 }),
  ];
}

function makeBomItem(overrides: Partial<BomItem> = {}): BomItem {
  return {
    id: 1,
    projectId: 1,
    partNumber: 'RC0805JR-0710KL',
    manufacturer: 'Yageo',
    description: '10K Ohm Resistor 0805 SMD',
    quantity: 4,
    unitPrice: '0.0100',
    totalPrice: '0.0400',
    supplier: 'DigiKey',
    stock: 100,
    status: 'In Stock',
    leadTime: null,
    datasheetUrl: null,
    manufacturerUrl: null,
    storageLocation: null,
    quantityOnHand: null,
    minimumStock: null,
    esdSensitive: null,
    assemblyCategory: null,
    version: 1,
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as BomItem;
}

// ---------------------------------------------------------------------------
// Helper Function Tests
// ---------------------------------------------------------------------------

describe('classifyMountType', () => {
  it('classifies SMD/SMT components', () => {
    expect(classifyMountType('10K Resistor 0805 SMD')).toBe('smt');
    expect(classifyMountType('Cap 0603')).toBe('smt');
    expect(classifyMountType('QFP-44 IC')).toBe('smt');
    expect(classifyMountType('BGA-256 processor')).toBe('smt');
    expect(classifyMountType('SOIC-8 op-amp')).toBe('smt');
    expect(classifyMountType('TSSOP package')).toBe('smt');
    expect(classifyMountType('DFN device')).toBe('smt');
    expect(classifyMountType('LGA sensor')).toBe('smt');
  });

  it('classifies through-hole components', () => {
    expect(classifyMountType('DIP-8 IC')).toBe('through_hole');
    expect(classifyMountType('TO-220 regulator')).toBe('through_hole');
    expect(classifyMountType('Axial resistor')).toBe('through_hole');
    expect(classifyMountType('Radial capacitor')).toBe('through_hole');
    expect(classifyMountType('Through-hole connector')).toBe('through_hole');
    expect(classifyMountType('TO-92 transistor')).toBe('through_hole');
    expect(classifyMountType('PTH pin header')).toBe('through_hole');
  });

  it('classifies mixed mount components', () => {
    expect(classifyMountType('SMD 0805 with through-hole pins')).toBe('mixed');
  });

  it('returns unknown for unrecognized descriptions', () => {
    expect(classifyMountType('Generic part')).toBe('unknown');
    expect(classifyMountType('Wire assembly')).toBe('unknown');
  });

  it('uses assemblyCategory as fallback', () => {
    expect(classifyMountType('Generic sensor', 'SMT')).toBe('smt');
    expect(classifyMountType('Connector', 'through-hole')).toBe('through_hole');
  });
});

describe('estimatePinCount', () => {
  it('detects explicit pin counts', () => {
    expect(estimatePinCount('32-pin QFP')).toBe(32);
    expect(estimatePinCount('8 pin SOIC')).toBe(8);
    expect(estimatePinCount('100-pin LQFP')).toBe(100);
  });

  it('estimates from package codes', () => {
    expect(estimatePinCount('Resistor 0402')).toBe(2);
    expect(estimatePinCount('Cap 0603')).toBe(2);
    expect(estimatePinCount('LED 0805')).toBe(2);
    expect(estimatePinCount('Cap 1206')).toBe(2);
    expect(estimatePinCount('SOT-23 transistor')).toBe(3);
    expect(estimatePinCount('SOT-223 regulator')).toBe(4);
    expect(estimatePinCount('SOIC-8 op-amp')).toBe(8);
    expect(estimatePinCount('DIP-14 logic')).toBe(14);
    expect(estimatePinCount('SOIC-16 driver')).toBe(16);
    expect(estimatePinCount('TQFP-32 MCU')).toBe(32);
    expect(estimatePinCount('QFP-44 device')).toBe(44);
    expect(estimatePinCount('TQFP-64 IC')).toBe(64);
    expect(estimatePinCount('QFP-100 FPGA')).toBe(100);
  });

  it('estimates BGA pin counts', () => {
    expect(estimatePinCount('BGA-256 chip')).toBe(256);
    expect(estimatePinCount('BGA package')).toBe(64);
  });

  it('defaults to 2 for unknown packages', () => {
    expect(estimatePinCount('Generic widget')).toBe(2);
  });
});

describe('bomItemToInput', () => {
  it('converts a BomItem to BomItemInput', () => {
    const item = makeBomItem();
    const input = bomItemToInput(item);
    expect(input.partNumber).toBe('RC0805JR-0710KL');
    expect(input.manufacturer).toBe('Yageo');
    expect(input.quantity).toBe(4);
    expect(input.unitPrice).toBe(0.01);
    expect(input.mountType).toBe('smt');
    expect(input.pinCount).toBe(2);
  });

  it('handles string unitPrice from database', () => {
    const item = makeBomItem({ unitPrice: '2.5000' });
    const input = bomItemToInput(item);
    expect(input.unitPrice).toBe(2.5);
  });

  it('classifies mount type from description', () => {
    const thItem = makeBomItem({ description: 'DIP-8 IC through-hole' });
    expect(bomItemToInput(thItem).mountType).toBe('through_hole');
  });

  it('falls back to partNumber for mount type when description is generic', () => {
    const item = makeBomItem({ description: 'Resistor 10K', partNumber: 'RC0805JR-0710KL' });
    const input = bomItemToInput(item);
    expect(input.mountType).toBe('smt');
  });

  it('falls back to partNumber for pin count when description has no package info', () => {
    const item = makeBomItem({ description: 'IC voltage regulator', partNumber: 'LM7805-SOT-223' });
    const input = bomItemToInput(item);
    expect(input.pinCount).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// inferPackageType
// ---------------------------------------------------------------------------

describe('inferPackageType', () => {
  it('identifies chip resistor/capacitor packages from description', () => {
    expect(inferPackageType('10K Resistor 0805')).toBe('0805');
    expect(inferPackageType('100nF Cap 0603')).toBe('0603');
    expect(inferPackageType('Resistor 0402')).toBe('0402');
    expect(inferPackageType('Cap 1206')).toBe('1206');
    expect(inferPackageType('Resistor 1210')).toBe('1210');
    expect(inferPackageType('Power Resistor 2512')).toBe('2512');
    expect(inferPackageType('Tiny 0201 resistor')).toBe('0201');
  });

  it('identifies SOT packages', () => {
    expect(inferPackageType('Transistor SOT-23')).toBe('SOT-23');
    expect(inferPackageType('Regulator SOT-223')).toBe('SOT-223');
    expect(inferPackageType('Transistor SOT-89')).toBe('SOT-89');
  });

  it('identifies IC packages with pin counts', () => {
    expect(inferPackageType('Op-Amp SOIC-8')).toBe('SOIC-8');
    expect(inferPackageType('MCU TQFP-32')).toBe('TQFP-32');
    expect(inferPackageType('FPGA QFP-100')).toBe('QFP-100');
    expect(inferPackageType('Driver TSSOP-16')).toBe('TSSOP-16');
    expect(inferPackageType('Processor BGA-256')).toBe('BGA-256');
    expect(inferPackageType('Sensor QFN-20')).toBe('QFN-20');
    expect(inferPackageType('Logic DIP-14')).toBe('DIP-14');
    expect(inferPackageType('LQFP-48 MCU')).toBe('LQFP-48');
    expect(inferPackageType('MSOP-8 IC')).toBe('MSOP-8');
    expect(inferPackageType('DFN-8 sensor')).toBe('DFN-8');
    expect(inferPackageType('LGA-12 IMU')).toBe('LGA-12');
    expect(inferPackageType('SOP-8 EEPROM')).toBe('SOP-8');
  });

  it('identifies through-hole packages', () => {
    expect(inferPackageType('Regulator TO-220')).toBe('TO-220');
    expect(inferPackageType('Transistor TO-92')).toBe('TO-92');
    expect(inferPackageType('DPAK TO-252')).toBe('TO-252');
    expect(inferPackageType('IC DIP-8')).toBe('DIP-8');
    expect(inferPackageType('Connector SIP-4')).toBe('SIP-4');
  });

  it('uses partNumber as fallback', () => {
    expect(inferPackageType('Generic resistor', 'RC0805JR-07')).toBe('0805');
    expect(inferPackageType('Voltage regulator', 'LM7805-SOT-223')).toBe('SOT-223');
  });

  it('returns unknown for unrecognized packages', () => {
    expect(inferPackageType('Wire assembly')).toBe('unknown');
    expect(inferPackageType('Custom module')).toBe('unknown');
  });

  it('prefers more-specific package over less-specific', () => {
    // BGA should match before a generic number
    expect(inferPackageType('BGA-256 processor')).toBe('BGA-256');
    // TQFP should match before QFP
    expect(inferPackageType('TQFP-32 MCU')).toBe('TQFP-32');
  });
});

// ---------------------------------------------------------------------------
// bomToAssemblyParts
// ---------------------------------------------------------------------------

describe('bomToAssemblyParts', () => {
  it('converts an array of BomItems to BomItemInput[]', () => {
    const items = [
      makeBomItem({ id: 1, description: '10K Resistor 0805 SMD', quantity: 4, unitPrice: '0.0100' }),
      makeBomItem({ id: 2, description: 'ATmega328P TQFP-32', quantity: 1, unitPrice: '2.5000' }),
    ];
    const parts = bomToAssemblyParts(items);
    expect(parts).toHaveLength(2);
    expect(parts[0].mountType).toBe('smt');
    expect(parts[0].pinCount).toBe(2);
    expect(parts[0].quantity).toBe(4);
    expect(parts[0].unitPrice).toBe(0.01);
    expect(parts[1].mountType).toBe('smt');
    expect(parts[1].pinCount).toBe(32);
    expect(parts[1].quantity).toBe(1);
    expect(parts[1].unitPrice).toBe(2.5);
  });

  it('filters out items with zero quantity', () => {
    const items = [
      makeBomItem({ id: 1, quantity: 4 }),
      makeBomItem({ id: 2, quantity: 0 }),
    ];
    const parts = bomToAssemblyParts(items);
    expect(parts).toHaveLength(1);
  });

  it('handles empty BOM array', () => {
    expect(bomToAssemblyParts([])).toEqual([]);
  });

  it('infers SMD vs THT correctly for various packages', () => {
    const items = [
      makeBomItem({ id: 1, description: 'Resistor 0603 SMD' }),
      makeBomItem({ id: 2, description: 'QFP-48 MCU' }),
      makeBomItem({ id: 3, description: 'DIP-8 IC' }),
      makeBomItem({ id: 4, description: 'TO-220 regulator' }),
      makeBomItem({ id: 5, description: 'BGA-256 processor' }),
      makeBomItem({ id: 6, description: 'Axial resistor 1K' }),
    ];
    const parts = bomToAssemblyParts(items);
    expect(parts[0].mountType).toBe('smt');
    expect(parts[1].mountType).toBe('smt');
    expect(parts[2].mountType).toBe('through_hole');
    expect(parts[3].mountType).toBe('through_hole');
    expect(parts[4].mountType).toBe('smt');
    expect(parts[5].mountType).toBe('through_hole');
  });

  it('infers pin count from package type', () => {
    const items = [
      makeBomItem({ id: 1, description: 'Op-Amp SOIC-8' }),
      makeBomItem({ id: 2, description: 'SOT-23 transistor' }),
      makeBomItem({ id: 3, description: '14-pin DIP logic IC' }),
      makeBomItem({ id: 4, description: 'TQFP-64 MCU' }),
      makeBomItem({ id: 5, description: 'BGA-256 FPGA' }),
    ];
    const parts = bomToAssemblyParts(items);
    expect(parts[0].pinCount).toBe(8);
    expect(parts[1].pinCount).toBe(3);
    expect(parts[2].pinCount).toBe(14);
    expect(parts[3].pinCount).toBe(64);
    expect(parts[4].pinCount).toBe(256);
  });

  it('handles missing MPN gracefully', () => {
    const item = makeBomItem({ partNumber: '', description: 'Unknown part' });
    const parts = bomToAssemblyParts([item]);
    expect(parts).toHaveLength(1);
    expect(parts[0].partNumber).toBe('');
    expect(parts[0].mountType).toBe('unknown');
    expect(parts[0].pinCount).toBe(2);
  });

  it('handles blank description gracefully', () => {
    const item = makeBomItem({ description: '' });
    const parts = bomToAssemblyParts([item]);
    expect(parts).toHaveLength(1);
    // partNumber RC0805JR contains 0805, falls back there for mount type
    expect(parts[0].mountType).toBe('smt');
  });

  it('uses actual BOM quantity and unitPrice', () => {
    const item = makeBomItem({ quantity: 42, unitPrice: '3.1400' });
    const parts = bomToAssemblyParts([item]);
    expect(parts[0].quantity).toBe(42);
    expect(parts[0].unitPrice).toBeCloseTo(3.14);
  });

  it('preserves assemblyCategory from BOM item', () => {
    const item = makeBomItem({ assemblyCategory: 'SMT' });
    const parts = bomToAssemblyParts([item]);
    expect(parts[0].assemblyCategory).toBe('SMT');
  });
});

describe('convertCurrency', () => {
  it('returns same amount for same currency', () => {
    expect(convertCurrency(100, 'USD', 'USD')).toBe(100);
  });

  it('converts USD to EUR', () => {
    const result = convertCurrency(100, 'USD', 'EUR');
    expect(result).toBeGreaterThan(80);
    expect(result).toBeLessThan(100);
  });

  it('converts EUR to USD', () => {
    const result = convertCurrency(92, 'EUR', 'USD');
    expect(result).toBeCloseTo(100, 0);
  });

  it('converts USD to CNY', () => {
    const result = convertCurrency(100, 'USD', 'CNY');
    expect(result).toBeGreaterThan(700);
  });

  it('converts USD to JPY', () => {
    const result = convertCurrency(100, 'USD', 'JPY');
    expect(result).toBeGreaterThan(14000);
  });

  it('converts between non-USD currencies via USD', () => {
    const result = convertCurrency(100, 'EUR', 'GBP');
    expect(result).toBeGreaterThan(70);
    expect(result).toBeLessThan(100);
  });
});

// ---------------------------------------------------------------------------
// AssemblyCostEstimator — Singleton & Lifecycle
// ---------------------------------------------------------------------------

describe('AssemblyCostEstimator', () => {
  let estimator: AssemblyCostEstimator;

  beforeEach(() => {
    AssemblyCostEstimator.resetForTesting();
    localStorage.clear();
    estimator = AssemblyCostEstimator.getInstance();
  });

  afterEach(() => {
    AssemblyCostEstimator.resetForTesting();
    localStorage.clear();
  });

  describe('singleton pattern', () => {
    it('returns the same instance', () => {
      const a = AssemblyCostEstimator.getInstance();
      const b = AssemblyCostEstimator.getInstance();
      expect(a).toBe(b);
    });

    it('resetForTesting creates a new instance', () => {
      const a = AssemblyCostEstimator.getInstance();
      AssemblyCostEstimator.resetForTesting();
      const b = AssemblyCostEstimator.getInstance();
      expect(a).not.toBe(b);
    });
  });

  describe('subscribe/notify', () => {
    it('notifies listeners on state changes', () => {
      const listener = vi.fn();
      estimator.subscribe(listener);
      estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('unsubscribe stops notifications', () => {
      const listener = vi.fn();
      const unsub = estimator.subscribe(listener);
      unsub();
      estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      expect(listener).not.toHaveBeenCalled();
    });

    it('supports multiple listeners', () => {
      const l1 = vi.fn();
      const l2 = vi.fn();
      estimator.subscribe(l1);
      estimator.subscribe(l2);
      estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      expect(l1).toHaveBeenCalledTimes(1);
      expect(l2).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // Profiles
  // -----------------------------------------------------------------------

  describe('profiles', () => {
    it('has three built-in profiles', () => {
      const profiles = estimator.getAllProfiles();
      expect(profiles).toHaveLength(3);
    });

    it('retrieves JLCPCB profile by ID', () => {
      const profile = estimator.getProfile('jlcpcb_assembly');
      expect(profile).not.toBeNull();
      expect(profile!.name).toBe('JLCPCB Assembly');
    });

    it('retrieves PCBWay profile by ID', () => {
      const profile = estimator.getProfile('pcbway_assembly');
      expect(profile).not.toBeNull();
      expect(profile!.name).toBe('PCBWay Assembly');
    });

    it('retrieves Manual/DIY profile by ID', () => {
      const profile = estimator.getProfile('manual_diy');
      expect(profile).not.toBeNull();
      expect(profile!.name).toBe('Manual / DIY Assembly');
    });

    it('returns null for unknown profile', () => {
      expect(estimator.getProfile('nonexistent' as AssemblyProfileId)).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Estimate CRUD
  // -----------------------------------------------------------------------

  describe('estimate CRUD', () => {
    it('creates an estimate', () => {
      const est = estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD, 'Test Estimate');
      expect(est.id).toBeTruthy();
      expect(est.name).toBe('Test Estimate');
      expect(est.bomItems).toHaveLength(6);
      expect(est.boardParams.widthMm).toBe(50);
    });

    it('creates estimate with default name', () => {
      const est = estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      expect(est.name).toMatch(/^Estimate /);
    });

    it('gets an estimate by ID', () => {
      const created = estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      const retrieved = estimator.getEstimate(created.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
    });

    it('returns null for unknown estimate ID', () => {
      expect(estimator.getEstimate('nonexistent')).toBeNull();
    });

    it('lists all estimates', () => {
      estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD, 'A');
      estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD, 'B');
      const all = estimator.getAllEstimates();
      expect(all).toHaveLength(2);
    });

    it('updates an estimate name', () => {
      const est = estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD, 'Old Name');
      const updated = estimator.updateEstimate(est.id, { name: 'New Name' });
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('New Name');
    });

    it('updates estimate BOM items', () => {
      const est = estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      const newBom = [makeBomInput({ partNumber: 'R99' })];
      const updated = estimator.updateEstimate(est.id, { bomItems: newBom });
      expect(updated!.bomItems).toHaveLength(1);
      expect(updated!.bomItems[0].partNumber).toBe('R99');
    });

    it('updates estimate board params', () => {
      const est = estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      const updated = estimator.updateEstimate(est.id, {
        boardParams: { ...DEFAULT_BOARD, layers: 4 },
      });
      expect(updated!.boardParams.layers).toBe(4);
    });

    it('updates NRE overrides', () => {
      const est = estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      const updated = estimator.updateEstimate(est.id, { nreOverrides: { stencil: 25 } });
      expect(updated!.nreOverrides.stencil).toBe(25);
    });

    it('returns null when updating nonexistent estimate', () => {
      expect(estimator.updateEstimate('nope', { name: 'X' })).toBeNull();
    });

    it('deletes an estimate', () => {
      const est = estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      expect(estimator.deleteEstimate(est.id)).toBe(true);
      expect(estimator.getEstimate(est.id)).toBeNull();
      expect(estimator.getAllEstimates()).toHaveLength(0);
    });

    it('returns false when deleting nonexistent estimate', () => {
      expect(estimator.deleteEstimate('nope')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Cost Calculation
  // -----------------------------------------------------------------------

  describe('cost calculation', () => {
    let estId: string;

    beforeEach(() => {
      const est = estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      estId = est.id;
    });

    it('calculates cost for JLCPCB profile', () => {
      const breakdown = estimator.calculateCost(estId, 10, 'jlcpcb_assembly');
      expect(breakdown).not.toBeNull();
      expect(breakdown!.profileId).toBe('jlcpcb_assembly');
      expect(breakdown!.profileName).toBe('JLCPCB Assembly');
      expect(breakdown!.quantity).toBe(10);
      expect(breakdown!.grandTotal).toBeGreaterThan(0);
      expect(breakdown!.grandTotalPerUnit).toBeGreaterThan(0);
      expect(breakdown!.currency).toBe('USD');
    });

    it('calculates cost for PCBWay profile', () => {
      const breakdown = estimator.calculateCost(estId, 10, 'pcbway_assembly');
      expect(breakdown).not.toBeNull();
      expect(breakdown!.profileId).toBe('pcbway_assembly');
    });

    it('calculates cost for Manual/DIY profile', () => {
      const breakdown = estimator.calculateCost(estId, 10, 'manual_diy');
      expect(breakdown).not.toBeNull();
      expect(breakdown!.profileId).toBe('manual_diy');
    });

    it('returns null for nonexistent estimate', () => {
      expect(estimator.calculateCost('nope', 10, 'jlcpcb_assembly')).toBeNull();
    });

    it('returns null for nonexistent profile', () => {
      expect(estimator.calculateCost(estId, 10, 'nope' as AssemblyProfileId)).toBeNull();
    });

    it('returns null for zero quantity', () => {
      expect(estimator.calculateCost(estId, 0, 'jlcpcb_assembly')).toBeNull();
    });

    it('returns null for negative quantity', () => {
      expect(estimator.calculateCost(estId, -5, 'jlcpcb_assembly')).toBeNull();
    });

    it('includes PCB fabrication line item', () => {
      const breakdown = estimator.calculateCost(estId, 10, 'jlcpcb_assembly')!;
      const pcbLine = breakdown.lineItems.find((li) => li.category === 'pcb_fabrication');
      expect(pcbLine).toBeDefined();
      expect(pcbLine!.unitCost).toBeGreaterThan(0);
    });

    it('includes component procurement line item', () => {
      const breakdown = estimator.calculateCost(estId, 10, 'jlcpcb_assembly')!;
      const compLine = breakdown.lineItems.find((li) => li.category === 'component_procurement');
      expect(compLine).toBeDefined();
      expect(compLine!.unitCost).toBeGreaterThan(0);
    });

    it('includes SMT assembly line item', () => {
      const breakdown = estimator.calculateCost(estId, 10, 'jlcpcb_assembly')!;
      const smtLine = breakdown.lineItems.find((li) => li.category === 'smt_assembly');
      expect(smtLine).toBeDefined();
    });

    it('includes through-hole assembly line item', () => {
      const breakdown = estimator.calculateCost(estId, 10, 'jlcpcb_assembly')!;
      const thLine = breakdown.lineItems.find((li) => li.category === 'through_hole_assembly');
      expect(thLine).toBeDefined();
    });

    it('includes testing/QC line item', () => {
      const breakdown = estimator.calculateCost(estId, 10, 'jlcpcb_assembly')!;
      const testLine = breakdown.lineItems.find((li) => li.category === 'testing_qc');
      expect(testLine).toBeDefined();
    });

    it('includes setup fee line item for JLCPCB', () => {
      const breakdown = estimator.calculateCost(estId, 10, 'jlcpcb_assembly')!;
      const toolingLines = breakdown.lineItems.filter((li) => li.category === 'tooling');
      const setupLine = toolingLines.find((li) => li.label === 'Setup fee');
      expect(setupLine).toBeDefined();
    });

    it('calculates NRE costs', () => {
      const breakdown = estimator.calculateCost(estId, 10, 'jlcpcb_assembly')!;
      expect(breakdown.nre.stencil).toBeGreaterThan(0);
      expect(breakdown.nreTotal).toBeGreaterThan(0);
    });

    it('grandTotal = subtotalTotal + nreTotal', () => {
      const breakdown = estimator.calculateCost(estId, 10, 'jlcpcb_assembly')!;
      expect(breakdown.grandTotal).toBeCloseTo(breakdown.subtotalTotal + breakdown.nreTotal, 1);
    });

    it('higher quantity results in lower per-unit cost', () => {
      const b10 = estimator.calculateCost(estId, 10, 'jlcpcb_assembly')!;
      const b100 = estimator.calculateCost(estId, 100, 'jlcpcb_assembly')!;
      expect(b100.grandTotalPerUnit).toBeLessThan(b10.grandTotalPerUnit);
    });

    it('applies quantity discounts at 50+ units', () => {
      const b25 = estimator.calculateCost(estId, 25, 'jlcpcb_assembly')!;
      const b50 = estimator.calculateCost(estId, 50, 'jlcpcb_assembly')!;
      // Per-unit cost should drop more than linearly due to discount
      expect(b50.grandTotalPerUnit).toBeLessThan(b25.grandTotalPerUnit);
    });
  });

  // -----------------------------------------------------------------------
  // Board Parameter Effects
  // -----------------------------------------------------------------------

  describe('board parameter effects on cost', () => {
    it('more layers increase PCB cost', () => {
      const bom = makeSampleBom();
      const board2L = { ...DEFAULT_BOARD, layers: 2 };
      const board4L = { ...DEFAULT_BOARD, layers: 4 };
      const est2 = estimator.createEstimate(bom, board2L);
      const est4 = estimator.createEstimate(bom, board4L);
      const cost2 = estimator.calculateCost(est2.id, 10, 'jlcpcb_assembly')!;
      const cost4 = estimator.calculateCost(est4.id, 10, 'jlcpcb_assembly')!;
      expect(cost4.grandTotal).toBeGreaterThan(cost2.grandTotal);
    });

    it('larger board increases PCB cost', () => {
      const bom = makeSampleBom();
      const smallBoard = { ...DEFAULT_BOARD, widthMm: 30, heightMm: 20 };
      const largeBoard = { ...DEFAULT_BOARD, widthMm: 100, heightMm: 80 };
      const estS = estimator.createEstimate(bom, smallBoard);
      const estL = estimator.createEstimate(bom, largeBoard);
      const costS = estimator.calculateCost(estS.id, 10, 'jlcpcb_assembly')!;
      const costL = estimator.calculateCost(estL.id, 10, 'jlcpcb_assembly')!;
      expect(costL.grandTotal).toBeGreaterThan(costS.grandTotal);
    });

    it('ENIG finish adds upcharge', () => {
      const bom = makeSampleBom();
      const hasl = { ...DEFAULT_BOARD, finish: 'HASL' };
      const enig = { ...DEFAULT_BOARD, finish: 'ENIG' };
      const estH = estimator.createEstimate(bom, hasl);
      const estE = estimator.createEstimate(bom, enig);
      const costH = estimator.calculateCost(estH.id, 10, 'jlcpcb_assembly')!;
      const costE = estimator.calculateCost(estE.id, 10, 'jlcpcb_assembly')!;
      expect(costE.grandTotal).toBeGreaterThan(costH.grandTotal);
    });

    it('impedance control adds cost', () => {
      const bom = makeSampleBom();
      const normal = { ...DEFAULT_BOARD, impedanceControl: false };
      const impedance = { ...DEFAULT_BOARD, impedanceControl: true };
      const estN = estimator.createEstimate(bom, normal);
      const estI = estimator.createEstimate(bom, impedance);
      const costN = estimator.calculateCost(estN.id, 10, 'jlcpcb_assembly')!;
      const costI = estimator.calculateCost(estI.id, 10, 'jlcpcb_assembly')!;
      expect(costI.grandTotal).toBeGreaterThan(costN.grandTotal);
    });

    it('via-in-pad adds cost', () => {
      const bom = makeSampleBom();
      const normal = { ...DEFAULT_BOARD, viaInPad: false };
      const vip = { ...DEFAULT_BOARD, viaInPad: true };
      const estN = estimator.createEstimate(bom, normal);
      const estV = estimator.createEstimate(bom, vip);
      const costN = estimator.calculateCost(estN.id, 10, 'jlcpcb_assembly')!;
      const costV = estimator.calculateCost(estV.id, 10, 'jlcpcb_assembly')!;
      expect(costV.grandTotal).toBeGreaterThan(costN.grandTotal);
    });

    it('gold fingers adds cost', () => {
      const bom = makeSampleBom();
      const normal = { ...DEFAULT_BOARD, goldFingers: false };
      const gold = { ...DEFAULT_BOARD, goldFingers: true };
      const estN = estimator.createEstimate(bom, normal);
      const estG = estimator.createEstimate(bom, gold);
      const costN = estimator.calculateCost(estN.id, 10, 'jlcpcb_assembly')!;
      const costG = estimator.calculateCost(estG.id, 10, 'jlcpcb_assembly')!;
      expect(costG.grandTotal).toBeGreaterThan(costN.grandTotal);
    });
  });

  // -----------------------------------------------------------------------
  // calculateCostFromData
  // -----------------------------------------------------------------------

  describe('calculateCostFromData', () => {
    it('calculates without creating an estimate', () => {
      const breakdown = estimator.calculateCostFromData(
        makeSampleBom(),
        DEFAULT_BOARD,
        {},
        10,
        'jlcpcb_assembly',
      );
      expect(breakdown).not.toBeNull();
      expect(breakdown!.grandTotal).toBeGreaterThan(0);
    });

    it('accepts NRE overrides', () => {
      const base = estimator.calculateCostFromData(makeSampleBom(), DEFAULT_BOARD, {}, 10, 'jlcpcb_assembly')!;
      const withNre = estimator.calculateCostFromData(makeSampleBom(), DEFAULT_BOARD, { stencil: 50 }, 10, 'jlcpcb_assembly')!;
      expect(withNre.nre.stencil).toBe(50);
      expect(withNre.grandTotal).toBeGreaterThan(base.grandTotal);
    });

    it('returns null for unknown profile', () => {
      const result = estimator.calculateCostFromData(makeSampleBom(), DEFAULT_BOARD, {}, 10, 'nope' as AssemblyProfileId);
      expect(result).toBeNull();
    });

    it('returns null for zero quantity', () => {
      const result = estimator.calculateCostFromData(makeSampleBom(), DEFAULT_BOARD, {}, 0, 'jlcpcb_assembly');
      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Unique Part Penalty
  // -----------------------------------------------------------------------

  describe('unique part penalty', () => {
    it('applies penalty when exceeding threshold', () => {
      // JLCPCB threshold is 5
      const manyParts: BomItemInput[] = [];
      for (let i = 0; i < 10; i++) {
        manyParts.push(makeBomInput({ partNumber: `P${i}`, mountType: 'smt' }));
      }
      const est = estimator.createEstimate(manyParts, DEFAULT_BOARD);
      const breakdown = estimator.calculateCost(est.id, 10, 'jlcpcb_assembly')!;
      const penaltyLine = breakdown.lineItems.find((li) => li.label.includes('Unique part'));
      expect(penaltyLine).toBeDefined();
      expect(penaltyLine!.totalCost).toBeGreaterThan(0);
    });

    it('no penalty when under threshold', () => {
      const fewParts = [makeBomInput({ partNumber: 'A' }), makeBomInput({ partNumber: 'B' })];
      const est = estimator.createEstimate(fewParts, DEFAULT_BOARD);
      const breakdown = estimator.calculateCost(est.id, 10, 'jlcpcb_assembly')!;
      const penaltyLine = breakdown.lineItems.find((li) => li.label.includes('Unique part'));
      expect(penaltyLine).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // Hand Soldering
  // -----------------------------------------------------------------------

  describe('hand soldering for unknown mount type', () => {
    it('adds hand soldering cost for unknown mount type items', () => {
      const bom = [makeBomInput({ mountType: 'unknown', pinCount: 10, quantity: 2 })];
      const est = estimator.createEstimate(bom, DEFAULT_BOARD);
      const breakdown = estimator.calculateCost(est.id, 10, 'jlcpcb_assembly')!;
      const handLine = breakdown.lineItems.find((li) => li.category === 'hand_soldering');
      expect(handLine).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // Comparison
  // -----------------------------------------------------------------------

  describe('compareCosts', () => {
    it('compares all profiles sorted by cost', () => {
      const est = estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      const comparison = estimator.compareCosts(est.id, 10);
      expect(comparison).not.toBeNull();
      expect(comparison!.profiles.length).toBe(3);
      // Sorted ascending by grandTotal
      for (let i = 1; i < comparison!.profiles.length; i++) {
        expect(comparison!.profiles[i].grandTotal).toBeGreaterThanOrEqual(comparison!.profiles[i - 1].grandTotal);
      }
    });

    it('compares specific profiles', () => {
      const est = estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      const comparison = estimator.compareCosts(est.id, 10, ['jlcpcb_assembly', 'pcbway_assembly']);
      expect(comparison!.profiles.length).toBe(2);
    });

    it('returns null for nonexistent estimate', () => {
      expect(estimator.compareCosts('nope', 10)).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Quantity Curve
  // -----------------------------------------------------------------------

  describe('getQuantityCurve', () => {
    it('returns cost at all quantity tiers', () => {
      const est = estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      const curve = estimator.getQuantityCurve(est.id, 'jlcpcb_assembly');
      expect(curve).not.toBeNull();
      expect(curve!.points).toHaveLength(QUANTITY_TIERS.length);
      expect(curve!.profileId).toBe('jlcpcb_assembly');
    });

    it('unit cost decreases as quantity increases', () => {
      const est = estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      const curve = estimator.getQuantityCurve(est.id, 'jlcpcb_assembly')!;
      // Compare first and last — last should have lower per-unit
      const first = curve.points[0];
      const last = curve.points[curve.points.length - 1];
      expect(last.unitCost).toBeLessThan(first.unitCost);
    });

    it('total cost increases as quantity increases', () => {
      const est = estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      const curve = estimator.getQuantityCurve(est.id, 'jlcpcb_assembly')!;
      const first = curve.points[0];
      const last = curve.points[curve.points.length - 1];
      expect(last.totalCost).toBeGreaterThan(first.totalCost);
    });

    it('returns null for nonexistent estimate', () => {
      expect(estimator.getQuantityCurve('nope', 'jlcpcb_assembly')).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Currency Conversion
  // -----------------------------------------------------------------------

  describe('currency conversion in cost calculations', () => {
    it('returns costs in EUR when requested', () => {
      const est = estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      const usdBreakdown = estimator.calculateCost(est.id, 10, 'jlcpcb_assembly', 'USD')!;
      const eurBreakdown = estimator.calculateCost(est.id, 10, 'jlcpcb_assembly', 'EUR')!;
      expect(eurBreakdown.currency).toBe('EUR');
      expect(eurBreakdown.grandTotal).toBeLessThan(usdBreakdown.grandTotal);
    });

    it('returns costs in JPY when requested', () => {
      const est = estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      const breakdown = estimator.calculateCost(est.id, 10, 'jlcpcb_assembly', 'JPY')!;
      expect(breakdown.currency).toBe('JPY');
      expect(breakdown.grandTotal).toBeGreaterThan(1000); // JPY amounts are much larger
    });

    it('quantity curve respects currency', () => {
      const est = estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      const usdCurve = estimator.getQuantityCurve(est.id, 'jlcpcb_assembly', 'USD')!;
      const cnyCurve = estimator.getQuantityCurve(est.id, 'jlcpcb_assembly', 'CNY')!;
      expect(cnyCurve.points[0].totalCost).toBeGreaterThan(usdCurve.points[0].totalCost);
    });
  });

  describe('getSupportedCurrencies', () => {
    it('returns all five currencies', () => {
      const currencies = estimator.getSupportedCurrencies();
      expect(currencies).toContain('USD');
      expect(currencies).toContain('EUR');
      expect(currencies).toContain('GBP');
      expect(currencies).toContain('CNY');
      expect(currencies).toContain('JPY');
      expect(currencies).toHaveLength(5);
    });
  });

  describe('getExchangeRate', () => {
    it('returns 1 for same currency', () => {
      expect(estimator.getExchangeRate('USD', 'USD')).toBe(1);
    });

    it('returns rate for different currencies', () => {
      const rate = estimator.getExchangeRate('USD', 'EUR');
      expect(rate).toBeGreaterThan(0);
      expect(rate).toBeLessThan(1);
    });
  });

  // -----------------------------------------------------------------------
  // Cost Optimization Suggestions
  // -----------------------------------------------------------------------

  describe('getOptimizationSuggestions', () => {
    it('suggests consolidating resistor values', () => {
      const bom = [
        makeBomInput({ partNumber: 'R1', description: 'Resistor 10K 0805', mountType: 'smt' }),
        makeBomInput({ partNumber: 'R2', description: 'Resistor 4.7K 0805', mountType: 'smt' }),
        makeBomInput({ partNumber: 'R3', description: 'Resistor 1K 0805', mountType: 'smt' }),
      ];
      const est = estimator.createEstimate(bom, DEFAULT_BOARD);
      const suggestions = estimator.getOptimizationSuggestions(est.id, 'jlcpcb_assembly', 10);
      const consolidate = suggestions.find((s) => s.type === 'consolidate_values' && s.title.includes('resistor'));
      expect(consolidate).toBeDefined();
    });

    it('suggests consolidating capacitor values', () => {
      const bom = [
        makeBomInput({ partNumber: 'C1', description: 'Capacitor 100nF', mountType: 'smt' }),
        makeBomInput({ partNumber: 'C2', description: 'Capacitor 10uF', mountType: 'smt' }),
        makeBomInput({ partNumber: 'C3', description: 'Cap 1uF', mountType: 'smt' }),
      ];
      const est = estimator.createEstimate(bom, DEFAULT_BOARD);
      const suggestions = estimator.getOptimizationSuggestions(est.id, 'jlcpcb_assembly', 10);
      const consolidate = suggestions.find((s) => s.type === 'consolidate_values' && s.title.includes('capacitor'));
      expect(consolidate).toBeDefined();
    });

    it('suggests switching TH to SMT', () => {
      const bom = [
        makeBomInput({ partNumber: 'J1', description: 'Connector through-hole DIP', mountType: 'through_hole', pinCount: 20 }),
      ];
      const est = estimator.createEstimate(bom, DEFAULT_BOARD);
      const suggestions = estimator.getOptimizationSuggestions(est.id, 'jlcpcb_assembly', 10);
      const switchSmt = suggestions.find((s) => s.type === 'switch_to_smt');
      expect(switchSmt).toBeDefined();
    });

    it('suggests reducing unique parts when over threshold', () => {
      const bom: BomItemInput[] = [];
      for (let i = 0; i < 10; i++) {
        bom.push(makeBomInput({ partNumber: `P${i}`, mountType: 'smt' }));
      }
      const est = estimator.createEstimate(bom, DEFAULT_BOARD);
      const suggestions = estimator.getOptimizationSuggestions(est.id, 'jlcpcb_assembly', 10);
      const reduce = suggestions.find((s) => s.type === 'reduce_unique_parts');
      expect(reduce).toBeDefined();
    });

    it('suggests increasing quantity for small orders', () => {
      const est = estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      const suggestions = estimator.getOptimizationSuggestions(est.id, 'jlcpcb_assembly', 5);
      const increase = suggestions.find((s) => s.type === 'increase_quantity');
      expect(increase).toBeDefined();
    });

    it('suggests cheaper assembly profiles', () => {
      const est = estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      // PCBWay is typically more expensive than JLCPCB
      const suggestions = estimator.getOptimizationSuggestions(est.id, 'pcbway_assembly', 10);
      const changeProfile = suggestions.find((s) => s.type === 'change_profile');
      expect(changeProfile).toBeDefined();
    });

    it('returns empty for nonexistent estimate', () => {
      expect(estimator.getOptimizationSuggestions('nope', 'jlcpcb_assembly', 10)).toEqual([]);
    });

    it('returns empty for nonexistent profile', () => {
      const est = estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      expect(estimator.getOptimizationSuggestions(est.id, 'nope' as AssemblyProfileId, 10)).toEqual([]);
    });

    it('suggestions have estimated savings in requested currency', () => {
      const est = estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      const suggestions = estimator.getOptimizationSuggestions(est.id, 'jlcpcb_assembly', 10, 'EUR');
      suggestions.forEach((s) => {
        expect(s.currency).toBe('EUR');
      });
    });
  });

  // -----------------------------------------------------------------------
  // Margin Calculator
  // -----------------------------------------------------------------------

  describe('calculateMargin', () => {
    it('calculates margin correctly', () => {
      const est = estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      const margin = estimator.calculateMargin(est.id, 10, 'jlcpcb_assembly', 30);
      expect(margin).not.toBeNull();
      expect(margin!.marginPercent).toBe(30);
      expect(margin!.quantity).toBe(10);
      expect(margin!.sellingPricePerUnit).toBeGreaterThan(margin!.costPerUnit);
      expect(margin!.totalProfit).toBeGreaterThan(0);
      expect(margin!.totalRevenue).toBeGreaterThan(margin!.totalProfit);
    });

    it('markup = cost * marginPercent / 100', () => {
      const est = estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      const margin = estimator.calculateMargin(est.id, 10, 'jlcpcb_assembly', 50)!;
      expect(margin.markupPerUnit).toBeCloseTo(margin.costPerUnit * 0.5, 1);
    });

    it('sellingPrice = cost + markup', () => {
      const est = estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      const margin = estimator.calculateMargin(est.id, 10, 'jlcpcb_assembly', 25)!;
      expect(margin.sellingPricePerUnit).toBeCloseTo(margin.costPerUnit + margin.markupPerUnit, 1);
    });

    it('totalRevenue = sellingPrice * quantity', () => {
      const est = estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      const margin = estimator.calculateMargin(est.id, 100, 'jlcpcb_assembly', 40)!;
      expect(margin.totalRevenue).toBeCloseTo(margin.sellingPricePerUnit * margin.quantity, 0);
    });

    it('totalProfit = markup * quantity', () => {
      const est = estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      const margin = estimator.calculateMargin(est.id, 100, 'jlcpcb_assembly', 40)!;
      expect(margin.totalProfit).toBeCloseTo(margin.markupPerUnit * margin.quantity, 0);
    });

    it('returns null for nonexistent estimate', () => {
      expect(estimator.calculateMargin('nope', 10, 'jlcpcb_assembly', 30)).toBeNull();
    });

    it('supports currency conversion', () => {
      const est = estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      const usd = estimator.calculateMargin(est.id, 10, 'jlcpcb_assembly', 30, 'USD')!;
      const eur = estimator.calculateMargin(est.id, 10, 'jlcpcb_assembly', 30, 'EUR')!;
      expect(eur.currency).toBe('EUR');
      expect(eur.costPerUnit).toBeLessThan(usd.costPerUnit);
    });

    it('handles zero margin', () => {
      const est = estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      const margin = estimator.calculateMargin(est.id, 10, 'jlcpcb_assembly', 0)!;
      expect(margin.markupPerUnit).toBe(0);
      expect(margin.sellingPricePerUnit).toBe(margin.costPerUnit);
      expect(margin.totalProfit).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Import / Export
  // -----------------------------------------------------------------------

  describe('import / export', () => {
    it('exports estimates as JSON', () => {
      estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD, 'Export Test');
      const json = estimator.exportEstimates();
      const parsed = JSON.parse(json);
      expect(parsed.version).toBe(1);
      expect(parsed.estimates).toHaveLength(1);
      expect(parsed.estimates[0].name).toBe('Export Test');
    });

    it('imports estimates from JSON', () => {
      estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD, 'Original');
      const json = estimator.exportEstimates();

      // Reset and import
      AssemblyCostEstimator.resetForTesting();
      localStorage.clear();
      const fresh = AssemblyCostEstimator.getInstance();
      const result = fresh.importEstimates(json);
      expect(result.imported).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(fresh.getAllEstimates()).toHaveLength(1);
    });

    it('rejects invalid JSON', () => {
      const result = estimator.importEstimates('not json');
      expect(result.imported).toBe(0);
      expect(result.errors[0]).toContain('Invalid JSON');
    });

    it('rejects non-object', () => {
      const result = estimator.importEstimates('"just a string"');
      expect(result.imported).toBe(0);
    });

    it('skips duplicate IDs', () => {
      const est = estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      const json = estimator.exportEstimates();
      const result = estimator.importEstimates(json);
      expect(result.imported).toBe(0);
      expect(result.errors[0]).toContain('duplicate');
    });

    it('reports invalid items', () => {
      const json = JSON.stringify({ version: 1, estimates: [{ bad: true }] });
      const result = estimator.importEstimates(json);
      expect(result.imported).toBe(0);
      expect(result.errors[0]).toContain('missing required fields');
    });

    it('reports non-object items', () => {
      const json = JSON.stringify({ version: 1, estimates: [42] });
      const result = estimator.importEstimates(json);
      expect(result.imported).toBe(0);
      expect(result.errors[0]).toContain('not an object');
    });
  });

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  describe('localStorage persistence', () => {
    it('persists estimates across instances', () => {
      estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD, 'Persisted');
      AssemblyCostEstimator.resetForTesting();
      const fresh = AssemblyCostEstimator.getInstance();
      const all = fresh.getAllEstimates();
      expect(all).toHaveLength(1);
      expect(all[0].name).toBe('Persisted');
    });

    it('handles corrupt localStorage data', () => {
      localStorage.setItem('protopulse-assembly-cost-estimates', 'not-json');
      AssemblyCostEstimator.resetForTesting();
      const fresh = AssemblyCostEstimator.getInstance();
      expect(fresh.getAllEstimates()).toHaveLength(0);
    });

    it('handles non-array localStorage data', () => {
      localStorage.setItem('protopulse-assembly-cost-estimates', '{"not": "array"}');
      AssemblyCostEstimator.resetForTesting();
      const fresh = AssemblyCostEstimator.getInstance();
      expect(fresh.getAllEstimates()).toHaveLength(0);
    });

    it('filters out invalid items from localStorage', () => {
      localStorage.setItem(
        'protopulse-assembly-cost-estimates',
        JSON.stringify([{ id: 'ok', name: 'Valid', bomItems: [], createdAt: 1 }, { bad: true }]),
      );
      AssemblyCostEstimator.resetForTesting();
      const fresh = AssemblyCostEstimator.getInstance();
      expect(fresh.getAllEstimates()).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // Clear
  // -----------------------------------------------------------------------

  describe('clear', () => {
    it('removes all estimates', () => {
      estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      expect(estimator.getAllEstimates()).toHaveLength(2);
      estimator.clear();
      expect(estimator.getAllEstimates()).toHaveLength(0);
    });

    it('notifies listeners on clear', () => {
      const listener = vi.fn();
      estimator.subscribe(listener);
      estimator.clear();
      expect(listener).toHaveBeenCalled();
    });

    it('persists cleared state', () => {
      estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      estimator.clear();
      AssemblyCostEstimator.resetForTesting();
      const fresh = AssemblyCostEstimator.getInstance();
      expect(fresh.getAllEstimates()).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Edge Cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles empty BOM', () => {
      const est = estimator.createEstimate([], DEFAULT_BOARD);
      const breakdown = estimator.calculateCost(est.id, 10, 'jlcpcb_assembly');
      expect(breakdown).not.toBeNull();
      // Should still have PCB fabrication cost
      const pcbLine = breakdown!.lineItems.find((li) => li.category === 'pcb_fabrication');
      expect(pcbLine).toBeDefined();
      expect(pcbLine!.unitCost).toBeGreaterThan(0);
      // No assembly costs
      const smtLine = breakdown!.lineItems.find((li) => li.category === 'smt_assembly');
      expect(smtLine).toBeUndefined();
    });

    it('handles SMT-only BOM', () => {
      const bom = [makeBomInput({ mountType: 'smt', pinCount: 8 })];
      const est = estimator.createEstimate(bom, DEFAULT_BOARD);
      const breakdown = estimator.calculateCost(est.id, 10, 'jlcpcb_assembly')!;
      const smtLine = breakdown.lineItems.find((li) => li.category === 'smt_assembly');
      const thLine = breakdown.lineItems.find((li) => li.category === 'through_hole_assembly');
      expect(smtLine).toBeDefined();
      expect(thLine).toBeUndefined();
    });

    it('handles TH-only BOM', () => {
      const bom = [makeBomInput({ mountType: 'through_hole', pinCount: 8 })];
      const est = estimator.createEstimate(bom, DEFAULT_BOARD);
      const breakdown = estimator.calculateCost(est.id, 10, 'jlcpcb_assembly')!;
      const smtLine = breakdown.lineItems.find((li) => li.category === 'smt_assembly');
      const thLine = breakdown.lineItems.find((li) => li.category === 'through_hole_assembly');
      expect(smtLine).toBeUndefined();
      expect(thLine).toBeDefined();
    });

    it('handles mixed mount items contributing to both SMT and TH', () => {
      const bom = [makeBomInput({ mountType: 'mixed', pinCount: 10, quantity: 2 })];
      const est = estimator.createEstimate(bom, DEFAULT_BOARD);
      const breakdown = estimator.calculateCost(est.id, 10, 'jlcpcb_assembly')!;
      const smtLine = breakdown.lineItems.find((li) => li.category === 'smt_assembly');
      const thLine = breakdown.lineItems.find((li) => li.category === 'through_hole_assembly');
      expect(smtLine).toBeDefined();
      expect(thLine).toBeDefined();
    });

    it('applies SMT minimum charge', () => {
      // Single tiny part — should hit min charge
      const bom = [makeBomInput({ mountType: 'smt', pinCount: 2, quantity: 1 })];
      const est = estimator.createEstimate(bom, DEFAULT_BOARD);
      const breakdown = estimator.calculateCost(est.id, 10, 'jlcpcb_assembly')!;
      const smtLine = breakdown.lineItems.find((li) => li.category === 'smt_assembly');
      expect(smtLine).toBeDefined();
      // Min charge is $8 for JLCPCB
      expect(smtLine!.unitCost).toBeGreaterThanOrEqual(8);
    });

    it('applies TH minimum charge', () => {
      const bom = [makeBomInput({ mountType: 'through_hole', pinCount: 2, quantity: 1 })];
      const est = estimator.createEstimate(bom, DEFAULT_BOARD);
      const breakdown = estimator.calculateCost(est.id, 10, 'jlcpcb_assembly')!;
      const thLine = breakdown.lineItems.find((li) => li.category === 'through_hole_assembly');
      expect(thLine).toBeDefined();
      // Min charge is $15 for JLCPCB
      expect(thLine!.unitCost).toBeGreaterThanOrEqual(15);
    });

    it('handles quantity of 1', () => {
      const est = estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      const breakdown = estimator.calculateCost(est.id, 1, 'jlcpcb_assembly');
      expect(breakdown).not.toBeNull();
      expect(breakdown!.grandTotalPerUnit).toBe(breakdown!.grandTotal);
    });

    it('handles large quantity (1000)', () => {
      const est = estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      const breakdown = estimator.calculateCost(est.id, 1000, 'jlcpcb_assembly');
      expect(breakdown).not.toBeNull();
      expect(breakdown!.grandTotal).toBeGreaterThan(0);
    });

    it('unknown finish uses zero upcharge', () => {
      const bom = makeSampleBom();
      const board = { ...DEFAULT_BOARD, finish: 'UnknownFinish' };
      const est = estimator.createEstimate(bom, board);
      const breakdown = estimator.calculateCost(est.id, 10, 'jlcpcb_assembly');
      expect(breakdown).not.toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Manual/DIY Profile Specifics
  // -----------------------------------------------------------------------

  describe('manual/DIY profile', () => {
    it('has no setup fee', () => {
      const est = estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      const breakdown = estimator.calculateCost(est.id, 10, 'manual_diy')!;
      const setupLine = breakdown.lineItems.find((li) => li.label === 'Setup fee');
      expect(setupLine).toBeUndefined();
    });

    it('has no SMT per-pin cost (zero rates)', () => {
      const bom = [makeBomInput({ mountType: 'smt', pinCount: 100, quantity: 10 })];
      const est = estimator.createEstimate(bom, DEFAULT_BOARD);
      const breakdown = estimator.calculateCost(est.id, 10, 'manual_diy')!;
      // SMT line should not appear because smtCostPerPin=0 and smtMinCharge=0
      const smtLine = breakdown.lineItems.find((li) => li.category === 'smt_assembly');
      expect(smtLine).toBeUndefined();
    });

    it('has no quantity discounts', () => {
      const est = estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      const b10 = estimator.calculateCost(est.id, 10, 'manual_diy')!;
      const b100 = estimator.calculateCost(est.id, 100, 'manual_diy')!;
      // Per-unit cost difference should only be from NRE amortization
      const componentCost = makeSampleBom().reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
      const diff = b10.subtotalPerUnit - b100.subtotalPerUnit;
      // Diff should be very small since no assembly discount
      expect(diff).toBeLessThan(2);
    });

    it('is cheaper than JLCPCB for single units', () => {
      const est = estimator.createEstimate(makeSampleBom(), DEFAULT_BOARD);
      const diy = estimator.calculateCost(est.id, 1, 'manual_diy')!;
      const jlc = estimator.calculateCost(est.id, 1, 'jlcpcb_assembly')!;
      expect(diy.subtotalPerUnit).toBeLessThan(jlc.subtotalPerUnit);
    });
  });
});
