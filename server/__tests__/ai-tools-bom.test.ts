import { describe, it, expect, vi, beforeEach } from 'vitest';

// Phase 2 introduced a `parts-ingress` dependency in ai-tools/bom.ts that
// transitively pulls in server/db.ts, which throws at module load when
// DATABASE_URL is unset. Mock it before any imports.
vi.mock('../db', () => ({ db: {}, pool: {}, checkConnection: vi.fn() }));
const mockIngressPart = vi.fn().mockResolvedValue({ partId: 'p1', slug: 'test', created: true, reused: false, stockId: 's1', placementId: null });
vi.mock('../parts-ingress', () => ({
  ingressPart: mockIngressPart,
  mirrorIngressBestEffort: vi.fn().mockResolvedValue(null),
}));
vi.mock('../env', () => ({ featureFlags: { partsCatalogV2: true } }));

import { ToolRegistry } from '../ai-tools/registry';
import { registerBomTools } from '../ai-tools/bom';
import type { ToolContext } from '../ai-tools/types';
import type { IStorage } from '../storage';
import type { ArchitectureNode } from '@shared/schema';
import type { BomItem } from '@shared/types/bom-compat';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registerBomTools(registry);
  return registry;
}

const now = new Date();

function makeBomItem(overrides: Partial<BomItem> = {}): BomItem {
  return {
    id: 1,
    projectId: 1,
    partNumber: 'ESP32-S3-WROOM-1',
    manufacturer: 'Espressif',
    description: 'WiFi+BLE SoC module',
    quantity: 5,
    unitPrice: '3.5000',
    totalPrice: '17.5000',
    supplier: 'Digi-Key',
    stock: 100,
    status: 'In Stock',
    leadTime: '2 weeks',
    datasheetUrl: null,
    manufacturerUrl: null,
    storageLocation: null,
    quantityOnHand: null,
    minimumStock: null,
    esdSensitive: null,
    assemblyCategory: null,
    version: 1,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  } as BomItem;
}

function makeNode(overrides: Partial<ArchitectureNode> = {}): ArchitectureNode {
  return {
    id: 1,
    projectId: 1,
    nodeId: 'uuid-1',
    nodeType: 'mcu',
    label: 'ESP32',
    positionX: 300,
    positionY: 200,
    data: null,
    version: 1,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  } as ArchitectureNode;
}

function createMockStorage(
  bomItems: BomItem[] = [],
  nodes: ArchitectureNode[] = [],
): IStorage {
  return {
    getBomItems: vi.fn().mockResolvedValue(bomItems),
    getNodes: vi.fn().mockResolvedValue(nodes),
  } as unknown as IStorage;
}

function createCtx(storage?: IStorage): ToolContext {
  return {
    projectId: 1,
    storage: storage ?? createMockStorage(),
    confirmed: true,
  };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

describe('BOM tools — registration', () => {
  const registry = createRegistry();

  const expectedTools = [
    'query_bom_items',
    'add_bom_item',
    'remove_bom_item',
    'update_bom_item',
    'pricing_lookup',
    'suggest_alternatives',
    'optimize_bom',
    'check_lead_times',
    'parametric_search',
    'add_datasheet_link',
    'compare_components',
    'lookup_datasheet',
  ];

  it.each(expectedTools)('registers "%s"', (name) => {
    expect(registry.get(name)).toBeDefined();
  });

  it('all BOM tools have category "bom"', () => {
    const bomTools = registry.getByCategory('bom');
    expect(bomTools.length).toBe(expectedTools.length);
    for (const tool of bomTools) {
      expect(tool.category).toBe('bom');
    }
  });

  it('marks remove_bom_item as destructive', () => {
    const destructive = registry.getDestructiveTools();
    expect(destructive).toContain('remove_bom_item');
  });

  it('does not mark add_bom_item as destructive', () => {
    const destructive = registry.getDestructiveTools();
    expect(destructive).not.toContain('add_bom_item');
  });
});

// ---------------------------------------------------------------------------
// Parameter validation
// ---------------------------------------------------------------------------

describe('BOM tools — parameter validation', () => {
  const registry = createRegistry();

  describe('add_bom_item', () => {
    it('accepts valid params with required fields only', () => {
      const result = registry.validate('add_bom_item', {
        partNumber: 'ESP32-S3',
        manufacturer: 'Espressif',
        description: 'WiFi SoC',
      });
      expect(result.ok).toBe(true);
    });

    it('applies defaults for optional fields', () => {
      const result = registry.validate('add_bom_item', {
        partNumber: 'ESP32-S3',
        manufacturer: 'Espressif',
        description: 'WiFi SoC',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.params.quantity).toBe(1);
        expect(result.params.unitPrice).toBe(0);
        expect(result.params.supplier).toBe('');
        expect(result.params.status).toBe('In Stock');
      }
    });

    it('accepts all optional fields', () => {
      const result = registry.validate('add_bom_item', {
        partNumber: 'LM1117-3.3',
        manufacturer: 'TI',
        description: '3.3V LDO Regulator',
        quantity: 10,
        unitPrice: 0.45,
        supplier: 'Mouser',
        status: 'Low Stock',
      });
      expect(result.ok).toBe(true);
    });

    it('rejects missing partNumber', () => {
      const result = registry.validate('add_bom_item', {
        manufacturer: 'TI',
        description: 'Regulator',
      });
      expect(result.ok).toBe(false);
    });

    it('rejects empty manufacturer', () => {
      const result = registry.validate('add_bom_item', {
        partNumber: 'LM1117',
        manufacturer: '',
        description: 'Regulator',
      });
      expect(result.ok).toBe(false);
    });

    it('rejects negative quantity', () => {
      const result = registry.validate('add_bom_item', {
        partNumber: 'LM1117',
        manufacturer: 'TI',
        description: 'Regulator',
        quantity: -1,
      });
      expect(result.ok).toBe(false);
    });

    it('rejects zero quantity', () => {
      const result = registry.validate('add_bom_item', {
        partNumber: 'LM1117',
        manufacturer: 'TI',
        description: 'Regulator',
        quantity: 0,
      });
      expect(result.ok).toBe(false);
    });

    it('rejects negative unitPrice', () => {
      const result = registry.validate('add_bom_item', {
        partNumber: 'LM1117',
        manufacturer: 'TI',
        description: 'Regulator',
        unitPrice: -5,
      });
      expect(result.ok).toBe(false);
    });

    it('rejects invalid status enum value', () => {
      const result = registry.validate('add_bom_item', {
        partNumber: 'LM1117',
        manufacturer: 'TI',
        description: 'Regulator',
        status: 'Discontinued',
      });
      expect(result.ok).toBe(false);
    });

    it.each(['In Stock', 'Low Stock', 'Out of Stock', 'On Order'] as const)(
      'accepts status "%s"',
      (status) => {
        const result = registry.validate('add_bom_item', {
          partNumber: 'X',
          manufacturer: 'Y',
          description: 'Z',
          status,
        });
        expect(result.ok).toBe(true);
      },
    );
  });

  describe('add_datasheet_link', () => {
    it('accepts valid URL', () => {
      const result = registry.validate('add_datasheet_link', {
        partNumber: 'ESP32-S3',
        url: 'https://example.com/datasheet.pdf',
      });
      expect(result.ok).toBe(true);
    });

    it('rejects invalid URL', () => {
      const result = registry.validate('add_datasheet_link', {
        partNumber: 'ESP32-S3',
        url: 'not-a-url',
      });
      expect(result.ok).toBe(false);
    });
  });

  describe('parametric_search', () => {
    it('accepts valid category and specs', () => {
      const result = registry.validate('parametric_search', {
        category: 'capacitor',
        specs: { voltage: '16V', package: '0402', capacitance: '100nF' },
      });
      expect(result.ok).toBe(true);
    });

    it('rejects missing category', () => {
      const result = registry.validate('parametric_search', {
        specs: { voltage: '16V' },
      });
      expect(result.ok).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Execution — add_bom_item
// ---------------------------------------------------------------------------

describe('BOM tools — add_bom_item execution', () => {
  let registry: ToolRegistry;
  let mockStorage: IStorage;
  let ctx: ToolContext;

  beforeEach(() => {
    registry = createRegistry();
    mockStorage = createMockStorage();
    ctx = createCtx(mockStorage);
  });

  it('calls ingressPart with correct params', async () => {
    mockIngressPart.mockClear();
    const result = await registry.execute(
      'add_bom_item',
      {
        partNumber: 'ESP32-S3-WROOM-1',
        manufacturer: 'Espressif',
        description: 'WiFi+BLE SoC module',
        quantity: 5,
        unitPrice: 3.5,
        supplier: 'Digi-Key',
        status: 'In Stock',
      },
      ctx,
    );

    expect(result.success).toBe(true);
    expect(mockIngressPart).toHaveBeenCalledTimes(1);
    const callArgs = mockIngressPart.mock.calls[0][0];
    expect(callArgs.projectId).toBe(1);
    expect(callArgs.fields.mpn).toBe('ESP32-S3-WROOM-1');
    expect(callArgs.fields.manufacturer).toBe('Espressif');
    expect(callArgs.stock.quantityNeeded).toBe(5);
    expect(callArgs.stock.unitPrice).toBe(3.5);
    expect(callArgs.stock.supplier).toBe('Digi-Key');
  });

  it('returns success message with partNumber and manufacturer', async () => {
    mockIngressPart.mockClear();
    const result = await registry.execute(
      'add_bom_item',
      {
        partNumber: 'ESP32-S3',
        manufacturer: 'Espressif',
        description: 'SoC',
      },
      ctx,
    );

    expect(result.success).toBe(true);
    expect(result.message).toContain('ESP32-S3');
    expect(result.message).toContain('Espressif');
  });

  it('returns error for invalid params without calling ingress', async () => {
    mockIngressPart.mockClear();
    const result = await registry.execute(
      'add_bom_item',
      { partNumber: '' },
      ctx,
    );

    expect(result.success).toBe(false);
    expect(mockIngressPart).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Execution — compare_components
// ---------------------------------------------------------------------------

describe('BOM tools — compare_components execution', () => {
  it('returns all BOM items when no filters are applied', async () => {
    const items = [
      makeBomItem({ id: 1, partNumber: 'ESP32-S3', description: 'MCU' }),
      makeBomItem({ id: 2, partNumber: 'BME280', description: 'Temp sensor' }),
    ];
    const nodes = [
      makeNode({ id: 1, label: 'ESP32', nodeType: 'mcu' }),
    ];
    const storage = createMockStorage(items, nodes);
    const registry = createRegistry();
    const ctx = createCtx(storage);

    const result = await registry.execute('compare_components', {}, ctx);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    const data = result.data as Record<string, unknown>;
    expect(data.totalBomItems).toBe(2);
    const components = data.components as Array<Record<string, unknown>>;
    expect(components).toHaveLength(2);
  });

  it('filters by specific partNumbers', async () => {
    const items = [
      makeBomItem({ id: 1, partNumber: 'ESP32-S3', description: 'MCU' }),
      makeBomItem({ id: 2, partNumber: 'BME280', description: 'Sensor' }),
      makeBomItem({ id: 3, partNumber: 'LM1117', description: 'LDO' }),
    ];
    const storage = createMockStorage(items, []);
    const registry = createRegistry();
    const ctx = createCtx(storage);

    const result = await registry.execute(
      'compare_components',
      { partNumbers: ['ESP32-S3', 'LM1117'] },
      ctx,
    );

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    const components = data.components as Array<Record<string, unknown>>;
    expect(components).toHaveLength(2);
    const partNumbers = components.map((c) => c.partNumber);
    expect(partNumbers).toContain('ESP32-S3');
    expect(partNumbers).toContain('LM1117');
    expect(partNumbers).not.toContain('BME280');
  });

  it('filters by category matching node type', async () => {
    const items = [
      makeBomItem({ id: 1, partNumber: 'ESP32-S3', description: 'ESP32 module' }),
      makeBomItem({ id: 2, partNumber: 'BME280', description: 'temp sensor' }),
    ];
    const nodes = [
      makeNode({ id: 1, label: 'ESP32', nodeType: 'mcu' }),
      makeNode({ id: 2, label: 'temp sensor', nodeType: 'sensor' }),
    ];
    const storage = createMockStorage(items, nodes);
    const registry = createRegistry();
    const ctx = createCtx(storage);

    const result = await registry.execute(
      'compare_components',
      { category: 'sensor' },
      ctx,
    );

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    const components = data.components as Array<Record<string, unknown>>;
    // "temp sensor" BOM item matches because its description matches the "temp sensor" node label
    expect(components.length).toBeGreaterThanOrEqual(1);
    expect(components.some((c) => c.partNumber === 'BME280')).toBe(true);
  });

  it('includes architectureNodes in response', async () => {
    const nodes = [
      makeNode({ id: 1, label: 'MCU', nodeType: 'mcu' }),
      makeNode({ id: 2, label: 'Sensor', nodeType: 'sensor' }),
    ];
    const storage = createMockStorage([], nodes);
    const registry = createRegistry();
    const ctx = createCtx(storage);

    const result = await registry.execute('compare_components', {}, ctx);

    const data = result.data as Record<string, unknown>;
    const archNodes = data.architectureNodes as Array<Record<string, unknown>>;
    expect(archNodes).toHaveLength(2);
    expect(archNodes[0]).toEqual({ label: 'MCU', type: 'mcu' });
  });

  it('maps architectureRole from node type by part number', async () => {
    const items = [
      makeBomItem({ id: 1, partNumber: 'ESP32', description: 'WiFi SoC' }),
    ];
    const nodes = [
      makeNode({ id: 1, label: 'esp32', nodeType: 'mcu' }),
    ];
    const storage = createMockStorage(items, nodes);
    const registry = createRegistry();
    const ctx = createCtx(storage);

    const result = await registry.execute('compare_components', {}, ctx);

    const data = result.data as Record<string, unknown>;
    const components = data.components as Array<Record<string, unknown>>;
    expect(components[0].architectureRole).toBe('mcu');
  });

  it('returns null architectureRole when no node matches', async () => {
    const items = [makeBomItem({ id: 1, partNumber: 'UNKNOWN-IC', description: 'Mystery chip' })];
    const storage = createMockStorage(items, []);
    const registry = createRegistry();
    const ctx = createCtx(storage);

    const result = await registry.execute('compare_components', {}, ctx);

    const data = result.data as Record<string, unknown>;
    const components = data.components as Array<Record<string, unknown>>;
    expect(components[0].architectureRole).toBeNull();
  });

  it('partNumber filtering is case-insensitive', async () => {
    const items = [
      makeBomItem({ id: 1, partNumber: 'ESP32-S3' }),
    ];
    const storage = createMockStorage(items, []);
    const registry = createRegistry();
    const ctx = createCtx(storage);

    const result = await registry.execute(
      'compare_components',
      { partNumbers: ['esp32-s3'] },
      ctx,
    );

    const data = result.data as Record<string, unknown>;
    const components = data.components as Array<Record<string, unknown>>;
    expect(components).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Execution — client-action BOM tools
// ---------------------------------------------------------------------------

describe('BOM tools — client-action execution', () => {
  const registry = createRegistry();
  const ctx = createCtx();

  it('remove_bom_item returns client action', async () => {
    const result = await registry.execute('remove_bom_item', { partNumber: 'ESP32-S3' }, ctx);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ type: 'remove_bom_item', partNumber: 'ESP32-S3' });
  });

  it('update_bom_item returns client action with updates', async () => {
    const result = await registry.execute(
      'update_bom_item',
      { partNumber: 'ESP32-S3', updates: { quantity: 10 } },
      ctx,
    );

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      type: 'update_bom_item',
      partNumber: 'ESP32-S3',
    });
  });

  it('pricing_lookup returns client action', async () => {
    const result = await registry.execute('pricing_lookup', { partNumber: 'STM32F407VG' }, ctx);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ type: 'pricing_lookup', partNumber: 'STM32F407VG' });
  });

  it('suggest_alternatives returns client action with reason', async () => {
    const result = await registry.execute(
      'suggest_alternatives',
      { partNumber: 'ESP32-S3', reason: 'cost' },
      ctx,
    );

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      type: 'suggest_alternatives',
      partNumber: 'ESP32-S3',
      reason: 'cost',
    });
  });

  it('optimize_bom returns client action', async () => {
    const result = await registry.execute('optimize_bom', {}, ctx);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ type: 'optimize_bom' });
  });

  it('check_lead_times returns client action', async () => {
    const result = await registry.execute('check_lead_times', {}, ctx);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ type: 'check_lead_times' });
  });
});
