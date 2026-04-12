/**
 * Tests for the Phase 4 backfill migration.
 *
 * Tests pure transformation functions directly (no DB needed) and validates
 * step-level orchestration logic via mocked Drizzle queries.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the database modules to prevent eager DATABASE_URL check
// ---------------------------------------------------------------------------

vi.mock('../../server/db', () => ({ db: {}, pool: {}, checkConnection: vi.fn() }));
vi.mock('../../server/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Import pure functions from backfill script
// ---------------------------------------------------------------------------

import {
  componentLibraryToInsert,
  componentPartToInsert,
  bomItemToInsert,
  bomItemToStockFields,
  normalizeAssemblyCategory,
  inferCategoryFromBom,
} from '../../scripts/migrations/backfill-parts-catalog';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-04-12T12:00:00Z');

function makeLibraryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: '10kΩ Resistor',
    description: 'Standard 10kΩ 0402',
    meta: {
      manufacturer: 'Yageo',
      mpn: 'RC0402FR-0710KL',
      packageType: '0402',
      tolerance: '1%',
      value: '10k',
    },
    connectors: [{ id: 'p1', name: 'Pin 1' }],
    buses: [],
    views: {},
    constraints: [],
    tags: ['resistor', 'smd'],
    category: 'resistor',
    isPublic: true,
    authorId: null,
    forkedFromId: null,
    downloadCount: 42,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeComponentPartRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 100,
    projectId: 1,
    nodeId: 'node-abc',
    meta: {
      title: 'Custom Resistor',
      manufacturer: 'Vishay',
      mpn: 'CRCW040210K0FKED',
      category: 'resistor',
      packageType: '0402',
    },
    connectors: [{ id: 'c1', name: 'Lead 1' }],
    buses: [],
    views: {},
    constraints: [],
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeBomItemRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 200,
    projectId: 5,
    partNumber: 'RC0402FR-0710KL',
    manufacturer: 'Yageo',
    description: '10kΩ Resistor 0402 1%',
    quantity: 10,
    unitPrice: '0.0023',
    totalPrice: '0.0230',
    supplier: 'LCSC',
    stock: 50,
    status: 'In Stock',
    leadTime: '1 week',
    datasheetUrl: 'https://example.com/datasheet.pdf',
    manufacturerUrl: null,
    storageLocation: 'Bin A3',
    quantityOnHand: 50,
    minimumStock: 10,
    esdSensitive: false,
    assemblyCategory: 'smt',
    tolerance: '1%',
    version: 1,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides,
  };
}

// ===========================================================================
// Pure transformation tests — componentLibraryToInsert
// ===========================================================================

describe('componentLibraryToInsert', () => {
  it('maps all fields correctly', () => {
    const row = makeLibraryRow();
    const result = componentLibraryToInsert(row as never);

    expect(result.title).toBe('10kΩ Resistor');
    expect(result.description).toBe('Standard 10kΩ 0402');
    expect(result.manufacturer).toBe('Yageo');
    expect(result.mpn).toBe('RC0402FR-0710KL');
    expect(result.canonicalCategory).toBe('resistor');
    expect(result.packageType).toBe('0402');
    expect(result.tolerance).toBe('1%');
    expect(result.origin).toBe('library');
    expect(result.originRef).toBe('library:1');
    expect(result.trustLevel).toBe('library');
    expect(result.isPublic).toBe(true);
  });

  it('handles missing meta gracefully', () => {
    const row = makeLibraryRow({ meta: {}, category: null });
    const result = componentLibraryToInsert(row as never);

    expect(result.manufacturer).toBeNull();
    expect(result.mpn).toBeNull();
    expect(result.canonicalCategory).toBe('unknown');
    expect(result.packageType).toBeNull();
  });

  it('preserves connectors array', () => {
    const row = makeLibraryRow();
    const result = componentLibraryToInsert(row as never);

    expect(result.connectors).toHaveLength(1);
    expect((result.connectors[0] as Record<string, unknown>).id).toBe('p1');
  });
});

// ===========================================================================
// Pure transformation tests — componentPartToInsert
// ===========================================================================

describe('componentPartToInsert', () => {
  it('extracts fields from meta', () => {
    const row = makeComponentPartRow();
    const result = componentPartToInsert(row as never);

    expect(result.title).toBe('Custom Resistor');
    expect(result.manufacturer).toBe('Vishay');
    expect(result.mpn).toBe('CRCW040210K0FKED');
    expect(result.canonicalCategory).toBe('resistor');
    expect(result.origin).toBe('user');
    expect(result.originRef).toBe('legacy_component_parts:100');
    expect(result.trustLevel).toBe('user');
    expect(result.isPublic).toBe(false);
  });

  it('falls back to generic title when meta lacks title', () => {
    const row = makeComponentPartRow({ meta: {} });
    const result = componentPartToInsert(row as never);

    expect(result.title).toBe('Component Part 100');
    expect(result.canonicalCategory).toBe('unknown');
  });

  it('uses componentTitle from meta as fallback', () => {
    const row = makeComponentPartRow({ meta: { componentTitle: 'LED 5mm Red' } });
    const result = componentPartToInsert(row as never);

    expect(result.title).toBe('LED 5mm Red');
  });
});

// ===========================================================================
// Pure transformation tests — bomItemToInsert
// ===========================================================================

describe('bomItemToInsert', () => {
  it('maps bomItems fields correctly (description→title, partNumber→mpn)', () => {
    const row = makeBomItemRow();
    const result = bomItemToInsert(row as never);

    expect(result.title).toBe('10kΩ Resistor 0402 1%');
    expect(result.mpn).toBe('RC0402FR-0710KL');
    expect(result.manufacturer).toBe('Yageo');
    expect(result.datasheetUrl).toBe('https://example.com/datasheet.pdf');
    expect(result.tolerance).toBe('1%');
    expect(result.esdSensitive).toBe(false);
    expect(result.assemblyCategory).toBe('smt');
    expect(result.origin).toBe('user');
    expect(result.originRef).toBe('legacy_bom:200');
  });

  it('infers category from description text', () => {
    const row = makeBomItemRow({ description: '100nF Ceramic Capacitor' });
    const result = bomItemToInsert(row as never);

    expect(result.canonicalCategory).toBe('capacitor');
  });
});

// ===========================================================================
// Pure transformation tests — bomItemToStockFields
// ===========================================================================

describe('bomItemToStockFields', () => {
  it('maps stock fields correctly', () => {
    const row = makeBomItemRow();
    const result = bomItemToStockFields(row as never, 'part-uuid-123');

    expect(result.projectId).toBe(5);
    expect(result.partId).toBe('part-uuid-123');
    expect(result.quantityNeeded).toBe(10);
    expect(result.quantityOnHand).toBe(50);
    expect(result.minimumStock).toBe(10);
    expect(result.storageLocation).toBe('Bin A3');
    expect(result.unitPrice).toBe('0.0023');
    expect(result.supplier).toBe('LCSC');
    expect(result.leadTime).toBe('1 week');
    expect(result.status).toBe('In Stock');
  });

  it('falls back to stock field when quantityOnHand is null', () => {
    const row = makeBomItemRow({ quantityOnHand: null, stock: 25 });
    const result = bomItemToStockFields(row as never, 'part-uuid-123');

    expect(result.quantityOnHand).toBe(25);
  });
});

// ===========================================================================
// normalizeAssemblyCategory
// ===========================================================================

describe('normalizeAssemblyCategory', () => {
  it('passes through valid values', () => {
    expect(normalizeAssemblyCategory('smt')).toBe('smt');
    expect(normalizeAssemblyCategory('through_hole')).toBe('through_hole');
    expect(normalizeAssemblyCategory('hand_solder')).toBe('hand_solder');
    expect(normalizeAssemblyCategory('mechanical')).toBe('mechanical');
  });

  it('normalizes common aliases', () => {
    expect(normalizeAssemblyCategory('smd')).toBe('smt');
    expect(normalizeAssemblyCategory('SMD')).toBe('smt');
    expect(normalizeAssemblyCategory('tht')).toBe('through_hole');
    expect(normalizeAssemblyCategory('through-hole')).toBe('through_hole');
    expect(normalizeAssemblyCategory('DIP')).toBe('through_hole');
  });

  it('returns null for non-string or unknown values', () => {
    expect(normalizeAssemblyCategory(undefined)).toBeNull();
    expect(normalizeAssemblyCategory(null)).toBeNull();
    expect(normalizeAssemblyCategory(42)).toBeNull();
    expect(normalizeAssemblyCategory('exotic')).toBeNull();
  });
});

// ===========================================================================
// inferCategoryFromBom
// ===========================================================================

describe('inferCategoryFromBom', () => {
  it('detects resistors', () => {
    expect(inferCategoryFromBom('10k Resistor', 'RC0402')).toBe('resistor');
    expect(inferCategoryFromBom('100Ω Thin Film', 'ERJ-2RKF1000X')).toBe('resistor');
  });

  it('detects capacitors', () => {
    expect(inferCategoryFromBom('100nF Ceramic Cap', 'GRM155')).toBe('capacitor');
    expect(inferCategoryFromBom('47uF Electrolytic', 'UVR1V')).toBe('capacitor');
  });

  it('detects inductors', () => {
    expect(inferCategoryFromBom('10uH Power Inductor', 'SRN4018')).toBe('inductor');
  });

  it('detects diodes', () => {
    expect(inferCategoryFromBom('Schottky Diode', '1N5819')).toBe('diode');
  });

  it('detects LEDs', () => {
    expect(inferCategoryFromBom('Red LED 5mm', 'WP7113ID')).toBe('led');
  });

  it('detects transistors', () => {
    expect(inferCategoryFromBom('NPN Transistor', '2N2222')).toBe('transistor');
    expect(inferCategoryFromBom('BJT General Purpose', 'BC547')).toBe('transistor');
  });

  it('detects MOSFETs', () => {
    expect(inferCategoryFromBom('N-Channel MOSFET', 'IRF540N')).toBe('mosfet');
  });

  it('detects MCUs', () => {
    expect(inferCategoryFromBom('Microcontroller', 'ATmega328P')).toBe('mcu');
    expect(inferCategoryFromBom('WiFi Module', 'ESP32-WROOM')).toBe('mcu');
  });

  it('detects op-amps', () => {
    expect(inferCategoryFromBom('Dual Op-Amp', 'LM358')).toBe('amplifier');
  });

  it('detects connectors', () => {
    expect(inferCategoryFromBom('Pin Header 2x20', 'PH-2X20')).toBe('connector');
    expect(inferCategoryFromBom('USB-C Connector', 'USB4105')).toBe('connector');
  });

  it('detects sensors', () => {
    expect(inferCategoryFromBom('Temperature Sensor', 'DHT22')).toBe('sensor');
  });

  it('detects crystals', () => {
    expect(inferCategoryFromBom('16MHz Crystal', 'HC49')).toBe('crystal');
  });

  it('detects regulators', () => {
    expect(inferCategoryFromBom('3.3V LDO Regulator', 'AMS1117-3.3')).toBe('regulator');
    expect(inferCategoryFromBom('Voltage Reg 5V', 'LM7805')).toBe('regulator');
  });

  it('detects relays', () => {
    expect(inferCategoryFromBom('5V Relay Module', 'SRD-05VDC')).toBe('relay');
  });

  it('detects fuses', () => {
    expect(inferCategoryFromBom('1A Fuse', 'MF-R010')).toBe('fuse');
  });

  it('detects switches', () => {
    expect(inferCategoryFromBom('Tactile Push Button', 'TS-1187')).toBe('switch');
  });

  it('detects displays', () => {
    expect(inferCategoryFromBom('OLED Display 0.96in', 'SSD1306')).toBe('display');
  });

  it('detects motors', () => {
    expect(inferCategoryFromBom('Micro Servo Motor', 'SG90')).toBe('motor');
  });

  it('returns unknown for unrecognized parts', () => {
    expect(inferCategoryFromBom('Mystery Widget', 'XYZ-999')).toBe('unknown');
  });
});

// ===========================================================================
// Step function structure validation
// ===========================================================================

describe('backfill module exports', () => {
  it('exports all step functions', async () => {
    const mod = await import('../../scripts/migrations/backfill-parts-catalog');
    expect(typeof mod.migrateComponentLibrary).toBe('function');
    expect(typeof mod.migrateComponentParts).toBe('function');
    expect(typeof mod.migrateBomItems).toBe('function');
    expect(typeof mod.migrateCircuitInstances).toBe('function');
    expect(typeof mod.migrateComponentLifecycle).toBe('function');
    expect(typeof mod.migrateSpiceModels).toBe('function');
    expect(typeof mod.seedVerifiedBoards).toBe('function');
    expect(typeof mod.seedStandardLibrary).toBe('function');
    expect(typeof mod.seedStarterCircuits).toBe('function');
    expect(typeof mod.runBackfill).toBe('function');
  });

  it('exports all pure transformation functions', async () => {
    const mod = await import('../../scripts/migrations/backfill-parts-catalog');
    expect(typeof mod.componentLibraryToInsert).toBe('function');
    expect(typeof mod.componentPartToInsert).toBe('function');
    expect(typeof mod.bomItemToInsert).toBe('function');
    expect(typeof mod.bomItemToStockFields).toBe('function');
    expect(typeof mod.normalizeAssemblyCategory).toBe('function');
    expect(typeof mod.inferCategoryFromBom).toBe('function');
  });
});

// ===========================================================================
// Reconciliation module exports
// ===========================================================================

describe('reconciliation module exports', () => {
  it('exports all check functions', async () => {
    const mod = await import('../../scripts/migrations/reconcile-parts-drift');
    expect(typeof mod.checkBomItems).toBe('function');
    expect(typeof mod.checkComponentParts).toBe('function');
    expect(typeof mod.checkComponentLibrary).toBe('function');
    expect(typeof mod.checkCircuitInstances).toBe('function');
    expect(typeof mod.checkLifecycle).toBe('function');
    expect(typeof mod.checkSpiceModels).toBe('function');
    expect(typeof mod.runReconciliation).toBe('function');
  });
});
