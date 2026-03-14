import { describe, it, expect } from 'vitest';
import {
  classifyItem,
  groupBomByAssembly,
  getOrderedGroups,
  GROUP_LABELS,
  GROUP_COLORS,
  GROUP_DESCRIPTIONS,
} from '../assembly-grouping';
import type { AssemblyGroup, GroupedBomItem, AssemblyGroupingResult } from '../assembly-grouping';
import type { BomItem } from '@shared/schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBomItem(overrides: Partial<BomItem> = {}): BomItem {
  return {
    id: 1,
    projectId: 1,
    partNumber: 'TEST-001',
    manufacturer: 'TestCo',
    description: 'Test component',
    quantity: 1,
    unitPrice: '1.0000',
    totalPrice: '1.0000',
    supplier: 'Digi-Key',
    stock: 10,
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
  } as BomItem;
}

// ---------------------------------------------------------------------------
// classifyItem — SMT detection
// ---------------------------------------------------------------------------

describe('classifyItem', () => {
  describe('SMT classification', () => {
    it('detects chip packages (0402)', () => {
      const result = classifyItem(makeBomItem({ description: '100nF 0402 MLCC' }));
      expect(result.group).toBe('smt');
      expect(result.confidence).toBe(1.0);
      expect(result.matchedRule).toBe('chip_package');
    });

    it('detects chip packages (0603)', () => {
      const result = classifyItem(makeBomItem({ description: '10K resistor 0603' }));
      expect(result.group).toBe('smt');
      expect(result.matchedRule).toBe('chip_package');
    });

    it('detects chip packages (0805)', () => {
      const result = classifyItem(makeBomItem({ description: '4.7uF 0805 ceramic' }));
      expect(result.group).toBe('smt');
    });

    it('detects chip packages (1206)', () => {
      const result = classifyItem(makeBomItem({ description: '100uF 1206 tantalum' }));
      expect(result.group).toBe('smt');
    });

    it('detects explicit SMD keyword', () => {
      const result = classifyItem(makeBomItem({ description: 'LED SMD Red 3mm' }));
      expect(result.group).toBe('smt');
      expect(result.matchedRule).toBe('smt_explicit');
    });

    it('detects explicit SMT keyword', () => {
      const result = classifyItem(makeBomItem({ description: 'SMT capacitor 10nF' }));
      expect(result.group).toBe('smt');
    });

    it('detects surface mount keyword', () => {
      const result = classifyItem(makeBomItem({ description: 'Surface Mount inductor 22uH' }));
      expect(result.group).toBe('smt');
    });

    it('detects QFP packages', () => {
      const result = classifyItem(makeBomItem({ description: 'STM32F4 LQFP-48' }));
      expect(result.group).toBe('smt');
      expect(result.matchedRule).toBe('qfp_bga');
    });

    it('detects QFN packages', () => {
      const result = classifyItem(makeBomItem({ description: 'ATmega328P QFN-32' }));
      expect(result.group).toBe('smt');
    });

    it('detects BGA packages', () => {
      const result = classifyItem(makeBomItem({ description: 'FPGA BGA-256' }));
      expect(result.group).toBe('smt');
      expect(result.matchedRule).toBe('qfp_bga');
    });

    it('detects SOIC packages', () => {
      const result = classifyItem(makeBomItem({ description: 'Op-amp SOIC-8' }));
      expect(result.group).toBe('smt');
      expect(result.matchedRule).toBe('soic_sop');
    });

    it('detects TSSOP packages', () => {
      const result = classifyItem(makeBomItem({ description: 'Shift register TSSOP-16' }));
      expect(result.group).toBe('smt');
    });

    it('detects SOT-23 packages', () => {
      const result = classifyItem(makeBomItem({ description: 'MOSFET SOT-23' }));
      expect(result.group).toBe('smt');
      expect(result.matchedRule).toBe('sot');
    });

    it('detects SOT-223 packages', () => {
      const result = classifyItem(makeBomItem({ description: 'LDO regulator SOT-223' }));
      expect(result.group).toBe('smt');
    });

    it('detects D-PAK packages', () => {
      const result = classifyItem(makeBomItem({ description: 'Voltage regulator D-PAK' }));
      expect(result.group).toBe('smt');
    });
  });

  // ---------------------------------------------------------------------------
  // classifyItem — THT detection
  // ---------------------------------------------------------------------------

  describe('THT classification', () => {
    it('detects DIP packages', () => {
      const result = classifyItem(makeBomItem({ description: 'ATmega328P DIP-28' }));
      expect(result.group).toBe('tht');
      expect(result.matchedRule).toBe('dip_sip');
    });

    it('detects SIP packages', () => {
      const result = classifyItem(makeBomItem({ description: 'Resistor network SIP-8' }));
      expect(result.group).toBe('tht');
    });

    it('detects TO-92 packages', () => {
      const result = classifyItem(makeBomItem({ description: '2N2222 NPN TO-92' }));
      expect(result.group).toBe('tht');
      expect(result.matchedRule).toBe('to_package');
    });

    it('detects TO-220 packages', () => {
      const result = classifyItem(makeBomItem({ description: 'LM7805 TO-220' }));
      expect(result.group).toBe('tht');
    });

    it('detects explicit through-hole keyword', () => {
      const result = classifyItem(makeBomItem({ description: 'Through-hole resistor 1K' }));
      expect(result.group).toBe('tht');
      expect(result.confidence).toBe(1.0);
      expect(result.matchedRule).toBe('tht_explicit');
    });

    it('detects THT keyword', () => {
      const result = classifyItem(makeBomItem({ description: 'THT LED 5mm green' }));
      expect(result.group).toBe('tht');
    });

    it('detects radial package', () => {
      const result = classifyItem(makeBomItem({ description: '100uF 16V radial electrolytic' }));
      expect(result.group).toBe('tht');
      expect(result.matchedRule).toBe('radial_axial');
    });

    it('detects axial package', () => {
      const result = classifyItem(makeBomItem({ description: '1N4148 axial diode' }));
      expect(result.group).toBe('tht');
    });
  });

  // ---------------------------------------------------------------------------
  // classifyItem — Manual detection
  // ---------------------------------------------------------------------------

  describe('Manual classification', () => {
    it('detects connectors', () => {
      const result = classifyItem(makeBomItem({ description: '2-pin JST connector' }));
      expect(result.group).toBe('manual');
      expect(result.matchedRule).toBe('connector');
    });

    it('detects Molex connectors', () => {
      const result = classifyItem(makeBomItem({ description: 'Molex 4-pin power' }));
      expect(result.group).toBe('manual');
    });

    it('detects headers', () => {
      const result = classifyItem(makeBomItem({ description: 'Male header 2x20 2.54mm' }));
      expect(result.group).toBe('manual');
    });

    it('detects USB connectors', () => {
      const result = classifyItem(makeBomItem({ description: 'USB-C receptacle' }));
      expect(result.group).toBe('manual');
    });

    it('detects heatsinks', () => {
      const result = classifyItem(makeBomItem({ description: 'Aluminum heatsink TO-220' }));
      expect(result.group).toBe('manual');
      expect(result.matchedRule).toBe('mechanical');
    });

    it('detects standoffs', () => {
      const result = classifyItem(makeBomItem({ description: 'M3 nylon standoff 10mm' }));
      expect(result.group).toBe('manual');
    });

    it('detects switches', () => {
      const result = classifyItem(makeBomItem({ description: 'Tactile switch 6x6mm' }));
      expect(result.group).toBe('manual');
      expect(result.matchedRule).toBe('switch_misc');
    });

    it('detects potentiometers', () => {
      const result = classifyItem(makeBomItem({ description: '10K potentiometer linear' }));
      expect(result.group).toBe('manual');
    });

    it('detects relays', () => {
      const result = classifyItem(makeBomItem({ description: '5V SPDT relay' }));
      expect(result.group).toBe('manual');
    });

    it('detects battery holders', () => {
      const result = classifyItem(makeBomItem({ description: 'CR2032 battery holder' }));
      expect(result.group).toBe('manual');
    });
  });

  // ---------------------------------------------------------------------------
  // classifyItem — Unclassified
  // ---------------------------------------------------------------------------

  describe('Unclassified items', () => {
    it('returns unclassified for generic descriptions', () => {
      const result = classifyItem(makeBomItem({ description: 'Custom part XYZ', partNumber: 'CUSTOM-001' }));
      expect(result.group).toBe('unclassified');
      expect(result.confidence).toBe(0);
      expect(result.matchedRule).toBeNull();
    });

    it('returns unclassified for empty description', () => {
      const result = classifyItem(makeBomItem({ description: '' }));
      expect(result.group).toBe('unclassified');
    });
  });

  // ---------------------------------------------------------------------------
  // classifyItem — DB category override
  // ---------------------------------------------------------------------------

  describe('DB category override', () => {
    it('uses stored assemblyCategory=smt', () => {
      const result = classifyItem(makeBomItem({ assemblyCategory: 'smt', description: 'Generic part' }));
      expect(result.group).toBe('smt');
      expect(result.confidence).toBe(1.0);
      expect(result.matchedRule).toBe('db_category');
    });

    it('maps stored through_hole to tht', () => {
      const result = classifyItem(makeBomItem({ assemblyCategory: 'through_hole' }));
      expect(result.group).toBe('tht');
      expect(result.matchedRule).toBe('db_category');
    });

    it('maps stored hand_solder to manual', () => {
      const result = classifyItem(makeBomItem({ assemblyCategory: 'hand_solder' }));
      expect(result.group).toBe('manual');
    });

    it('maps stored mechanical to manual', () => {
      const result = classifyItem(makeBomItem({ assemblyCategory: 'mechanical' }));
      expect(result.group).toBe('manual');
    });

    it('falls back to pattern matching for unknown stored category', () => {
      const result = classifyItem(makeBomItem({ assemblyCategory: 'something_else', description: '0603 resistor' }));
      expect(result.group).toBe('smt');
      expect(result.matchedRule).toBe('chip_package');
    });
  });

  // ---------------------------------------------------------------------------
  // classifyItem — part number patterns
  // ---------------------------------------------------------------------------

  describe('Part number matching', () => {
    it('classifies from part number when description is vague', () => {
      const result = classifyItem(makeBomItem({ description: 'Capacitor', partNumber: 'GRM155R71C104KA88 0402' }));
      expect(result.group).toBe('smt');
    });
  });
});

// ---------------------------------------------------------------------------
// groupBomByAssembly
// ---------------------------------------------------------------------------

describe('groupBomByAssembly', () => {
  it('returns empty groups for empty BOM', () => {
    const result = groupBomByAssembly([]);
    expect(result.totalItems).toBe(0);
    expect(result.totalCost).toBe(0);
    expect(result.classificationRate).toBe(1);
    expect(result.groups.smt.itemCount).toBe(0);
    expect(result.groups.tht.itemCount).toBe(0);
    expect(result.groups.manual.itemCount).toBe(0);
    expect(result.groups.unclassified.itemCount).toBe(0);
  });

  it('groups a mixed BOM correctly', () => {
    const items = [
      makeBomItem({ id: 1, description: '10K 0402 resistor', quantity: 10, totalPrice: '1.0000' }),
      makeBomItem({ id: 2, description: '100nF 0603 capacitor', quantity: 5, totalPrice: '0.5000' }),
      makeBomItem({ id: 3, description: 'ATmega328P DIP-28', quantity: 1, totalPrice: '3.0000' }),
      makeBomItem({ id: 4, description: 'JST connector 2-pin', quantity: 2, totalPrice: '0.8000' }),
      makeBomItem({ id: 5, description: 'Custom widget', quantity: 1, totalPrice: '5.0000' }),
    ];

    const result = groupBomByAssembly(items);

    expect(result.totalItems).toBe(5);
    expect(result.groups.smt.itemCount).toBe(2);
    expect(result.groups.smt.totalQuantity).toBe(15);
    expect(result.groups.smt.totalCost).toBeCloseTo(1.5);

    expect(result.groups.tht.itemCount).toBe(1);
    expect(result.groups.tht.totalQuantity).toBe(1);
    expect(result.groups.tht.totalCost).toBeCloseTo(3.0);

    expect(result.groups.manual.itemCount).toBe(1);
    expect(result.groups.manual.totalQuantity).toBe(2);
    expect(result.groups.manual.totalCost).toBeCloseTo(0.8);

    expect(result.groups.unclassified.itemCount).toBe(1);
    expect(result.groups.unclassified.totalCost).toBeCloseTo(5.0);
  });

  it('calculates correct classification rate', () => {
    const items = [
      makeBomItem({ id: 1, description: '0402 resistor' }),
      makeBomItem({ id: 2, description: 'DIP-8 IC' }),
      makeBomItem({ id: 3, description: 'Connector header' }),
      makeBomItem({ id: 4, description: 'Mystery part' }),
    ];

    const result = groupBomByAssembly(items);
    expect(result.classificationRate).toBeCloseTo(0.75);
  });

  it('handles all items classified', () => {
    const items = [
      makeBomItem({ id: 1, description: '0402 resistor' }),
      makeBomItem({ id: 2, description: 'TO-220 regulator' }),
    ];

    const result = groupBomByAssembly(items);
    expect(result.classificationRate).toBe(1.0);
  });

  it('accumulates totalCost correctly', () => {
    const items = [
      makeBomItem({ id: 1, description: '0402 cap', totalPrice: '2.5000' }),
      makeBomItem({ id: 2, description: '0603 res', totalPrice: '1.2500' }),
      makeBomItem({ id: 3, description: 'DIP IC', totalPrice: '4.0000' }),
    ];

    const result = groupBomByAssembly(items);
    expect(result.totalCost).toBeCloseTo(7.75);
  });

  it('stores items in the correct group', () => {
    const items = [
      makeBomItem({ id: 10, description: 'SOIC-8 op-amp' }),
      makeBomItem({ id: 20, description: 'SOIC-16 driver' }),
    ];

    const result = groupBomByAssembly(items);
    expect(result.groups.smt.items).toHaveLength(2);
    expect(result.groups.smt.items[0].item.id).toBe(10);
    expect(result.groups.smt.items[1].item.id).toBe(20);
  });

  it('preserves group labels', () => {
    const result = groupBomByAssembly([]);
    expect(result.groups.smt.label).toBe('SMT (Surface Mount)');
    expect(result.groups.tht.label).toBe('THT (Through-Hole)');
    expect(result.groups.manual.label).toBe('Manual Assembly');
    expect(result.groups.unclassified.label).toBe('Unclassified');
  });
});

// ---------------------------------------------------------------------------
// getOrderedGroups
// ---------------------------------------------------------------------------

describe('getOrderedGroups', () => {
  it('returns only non-empty groups', () => {
    const items = [
      makeBomItem({ id: 1, description: '0402 resistor' }),
      makeBomItem({ id: 2, description: 'DIP-28 MCU' }),
    ];

    const result = groupBomByAssembly(items);
    const ordered = getOrderedGroups(result);

    expect(ordered).toHaveLength(2);
    expect(ordered[0].group).toBe('smt');
    expect(ordered[1].group).toBe('tht');
  });

  it('returns groups in display order: smt, tht, manual, unclassified', () => {
    const items = [
      makeBomItem({ id: 1, description: 'Mystery part' }),
      makeBomItem({ id: 2, description: 'JST connector' }),
      makeBomItem({ id: 3, description: 'DIP-8 chip' }),
      makeBomItem({ id: 4, description: '0603 cap' }),
    ];

    const result = groupBomByAssembly(items);
    const ordered = getOrderedGroups(result);

    expect(ordered).toHaveLength(4);
    expect(ordered[0].group).toBe('smt');
    expect(ordered[1].group).toBe('tht');
    expect(ordered[2].group).toBe('manual');
    expect(ordered[3].group).toBe('unclassified');
  });

  it('returns empty array when all groups are empty', () => {
    const result = groupBomByAssembly([]);
    const ordered = getOrderedGroups(result);
    expect(ordered).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('constants', () => {
  it('GROUP_LABELS has all 4 groups', () => {
    expect(Object.keys(GROUP_LABELS)).toHaveLength(4);
    expect(GROUP_LABELS.smt).toBeDefined();
    expect(GROUP_LABELS.tht).toBeDefined();
    expect(GROUP_LABELS.manual).toBeDefined();
    expect(GROUP_LABELS.unclassified).toBeDefined();
  });

  it('GROUP_COLORS has all 4 groups with text/bg/border', () => {
    const groups: AssemblyGroup[] = ['smt', 'tht', 'manual', 'unclassified'];
    for (const g of groups) {
      expect(GROUP_COLORS[g].text).toBeDefined();
      expect(GROUP_COLORS[g].bg).toBeDefined();
      expect(GROUP_COLORS[g].border).toBeDefined();
    }
  });

  it('GROUP_DESCRIPTIONS has all 4 groups', () => {
    expect(Object.keys(GROUP_DESCRIPTIONS)).toHaveLength(4);
  });
});
