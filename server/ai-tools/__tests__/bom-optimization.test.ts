/**
 * Tests for BOM Optimization AI tools.
 *
 * Validates the three BOM optimization tools:
 * - analyze_bom_optimization
 * - suggest_alternate_part
 * - consolidate_packages
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolRegistry } from '../registry';
import { registerBomOptimizationTools } from '../bom-optimization';
import type { ToolContext } from '../types';
import type { IStorage } from '../../storage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockStorage(bomItems: unknown[] = []): IStorage {
  return {
    getBomItems: vi.fn().mockResolvedValue(bomItems),
    getNodes: vi.fn().mockResolvedValue([]),
    getEdges: vi.fn().mockResolvedValue([]),
    getProject: vi.fn().mockResolvedValue({ id: 1, name: 'Test' }),
  } as unknown as IStorage;
}

function createCtx(storage: IStorage, overrides?: Partial<ToolContext>): ToolContext {
  return {
    projectId: 1,
    storage,
    confirmed: true,
    ...overrides,
  };
}

function createBomItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    projectId: 1,
    partNumber: 'RC0805JR-07100RL',
    manufacturer: 'Yageo',
    description: '100 ohm resistor 0805',
    quantity: 10,
    unitPrice: '0.01',
    totalPrice: '0.10',
    supplier: 'Digi-Key',
    stock: 100,
    status: 'In Stock',
    leadTime: '2 weeks',
    datasheetUrl: null,
    manufacturerUrl: null,
    deletedAt: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

describe('BOM Optimization tool registration', () => {
  it('registers 3 tools', () => {
    const registry = new ToolRegistry();
    registerBomOptimizationTools(registry);
    expect(registry.getAll()).toHaveLength(3);
  });

  it('all tools are in the bom category', () => {
    const registry = new ToolRegistry();
    registerBomOptimizationTools(registry);
    for (const tool of registry.getAll()) {
      expect(tool.category).toBe('bom');
    }
  });

  it('registers analyze_bom_optimization', () => {
    const registry = new ToolRegistry();
    registerBomOptimizationTools(registry);
    expect(registry.get('analyze_bom_optimization')).toBeDefined();
  });

  it('registers suggest_alternate_part', () => {
    const registry = new ToolRegistry();
    registerBomOptimizationTools(registry);
    expect(registry.get('suggest_alternate_part')).toBeDefined();
  });

  it('registers consolidate_packages', () => {
    const registry = new ToolRegistry();
    registerBomOptimizationTools(registry);
    expect(registry.get('consolidate_packages')).toBeDefined();
  });

  it('throws on double registration', () => {
    const registry = new ToolRegistry();
    registerBomOptimizationTools(registry);
    expect(() => registerBomOptimizationTools(registry)).toThrow('already registered');
  });

  it('no tool requires confirmation', () => {
    const registry = new ToolRegistry();
    registerBomOptimizationTools(registry);
    for (const tool of registry.getAll()) {
      expect(tool.requiresConfirmation).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

describe('BOM Optimization schema validation', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
    registerBomOptimizationTools(registry);
  });

  // analyze_bom_optimization
  it('analyze_bom_optimization accepts empty params (defaults focus to all)', () => {
    const v = registry.validate('analyze_bom_optimization', {});
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.params.focus).toBe('all');
    }
  });

  it('analyze_bom_optimization accepts valid focus values', () => {
    for (const focus of ['all', 'cost', 'consolidation', 'overspec', 'unique_parts']) {
      const v = registry.validate('analyze_bom_optimization', { focus });
      expect(v.ok).toBe(true);
    }
  });

  it('analyze_bom_optimization rejects invalid focus', () => {
    const v = registry.validate('analyze_bom_optimization', { focus: 'invalid' });
    expect(v.ok).toBe(false);
  });

  // suggest_alternate_part
  it('suggest_alternate_part requires bomItemId', () => {
    const v = registry.validate('suggest_alternate_part', {});
    expect(v.ok).toBe(false);
  });

  it('suggest_alternate_part rejects non-positive bomItemId', () => {
    const v = registry.validate('suggest_alternate_part', { bomItemId: 0 });
    expect(v.ok).toBe(false);
  });

  it('suggest_alternate_part rejects negative bomItemId', () => {
    const v = registry.validate('suggest_alternate_part', { bomItemId: -1 });
    expect(v.ok).toBe(false);
  });

  it('suggest_alternate_part rejects float bomItemId', () => {
    const v = registry.validate('suggest_alternate_part', { bomItemId: 1.5 });
    expect(v.ok).toBe(false);
  });

  it('suggest_alternate_part accepts valid bomItemId with default reason', () => {
    const v = registry.validate('suggest_alternate_part', { bomItemId: 1 });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.params.reason).toBe('cost');
    }
  });

  it('suggest_alternate_part accepts all valid reason values', () => {
    for (const reason of ['cost', 'availability', 'package_size', 'performance']) {
      const v = registry.validate('suggest_alternate_part', { bomItemId: 1, reason });
      expect(v.ok).toBe(true);
    }
  });

  it('suggest_alternate_part rejects invalid reason', () => {
    const v = registry.validate('suggest_alternate_part', { bomItemId: 1, reason: 'looks_cool' });
    expect(v.ok).toBe(false);
  });

  // consolidate_packages
  it('consolidate_packages accepts empty params', () => {
    const v = registry.validate('consolidate_packages', {});
    expect(v.ok).toBe(true);
  });

  it('consolidate_packages accepts targetPackage', () => {
    const v = registry.validate('consolidate_packages', { targetPackage: '0805' });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.params.targetPackage).toBe('0805');
    }
  });
});

// ---------------------------------------------------------------------------
// analyze_bom_optimization execution
// ---------------------------------------------------------------------------

describe('analyze_bom_optimization execution', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
    registerBomOptimizationTools(registry);
  });

  it('returns empty suggestions for empty BOM', async () => {
    const storage = createMockStorage([]);
    const ctx = createCtx(storage);
    const result = await registry.execute('analyze_bom_optimization', {}, ctx);

    expect(result.success).toBe(true);
    expect(result.message).toContain('No BOM items');
    const data = result.data as Record<string, unknown>;
    expect(data.suggestions).toEqual([]);
    expect(data.totalItems).toBe(0);
  });

  it('calculates total cost correctly', async () => {
    const items = [
      createBomItem({ id: 1, unitPrice: '1.50', quantity: 10 }),
      createBomItem({ id: 2, partNumber: 'CAP-100nF', unitPrice: '0.05', quantity: 20 }),
    ];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute('analyze_bom_optimization', {}, ctx);

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    const summary = data.summary as Record<string, unknown>;
    expect(summary.totalCost).toBe('16.00'); // 1.5*10 + 0.05*20
  });

  it('counts unique part numbers', async () => {
    const items = [
      createBomItem({ id: 1, partNumber: 'R1' }),
      createBomItem({ id: 2, partNumber: 'R2' }),
      createBomItem({ id: 3, partNumber: 'R1' }), // duplicate
    ];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute('analyze_bom_optimization', {}, ctx);

    const data = result.data as Record<string, unknown>;
    const summary = data.summary as Record<string, unknown>;
    expect(summary.uniquePartNumbers).toBe(2);
    expect(summary.totalItems).toBe(3);
  });

  it('counts suppliers correctly', async () => {
    const items = [
      createBomItem({ id: 1, supplier: 'Digi-Key' }),
      createBomItem({ id: 2, supplier: 'Mouser' }),
      createBomItem({ id: 3, supplier: 'Digi-Key' }),
    ];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute('analyze_bom_optimization', {}, ctx);

    const data = result.data as Record<string, unknown>;
    const summary = data.summary as Record<string, unknown>;
    expect(summary.supplierCount).toBe(2);
    const breakdown = summary.supplierBreakdown as Array<{ name: string; itemCount: number }>;
    expect(breakdown[0]).toEqual({ name: 'Digi-Key', itemCount: 2 });
    expect(breakdown[1]).toEqual({ name: 'Mouser', itemCount: 1 });
  });

  it('flags overpriced resistors', async () => {
    const items = [
      createBomItem({ id: 1, description: '100 ohm resistor 0805', unitPrice: '0.50' }),
    ];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute('analyze_bom_optimization', {}, ctx);

    const data = result.data as Record<string, unknown>;
    const suggestions = data.costSuggestions as Array<Record<string, unknown>>;
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((s) => s.category === 'overpriced_passive')).toBe(true);
  });

  it('flags overpriced capacitors', async () => {
    const items = [
      createBomItem({ id: 1, description: '100nF capacitor 0805', unitPrice: '1.00', partNumber: 'CAP-100nF' }),
    ];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute('analyze_bom_optimization', {}, ctx);

    const data = result.data as Record<string, unknown>;
    const suggestions = data.costSuggestions as Array<Record<string, unknown>>;
    expect(suggestions.some((s) => s.category === 'overpriced_passive')).toBe(true);
  });

  it('flags single-quantity high-value parts for quantity pricing', async () => {
    const items = [
      createBomItem({ id: 1, unitPrice: '10.00', quantity: 1, description: 'MCU IC', partNumber: 'STM32F103' }),
    ];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute('analyze_bom_optimization', {}, ctx);

    const data = result.data as Record<string, unknown>;
    const suggestions = data.costSuggestions as Array<Record<string, unknown>>;
    expect(suggestions.some((s) => s.category === 'quantity_pricing')).toBe(true);
  });

  it('detects package consolidation opportunities', async () => {
    const items = [
      createBomItem({ id: 1, description: '100 ohm resistor 0402', partNumber: 'R1' }),
      createBomItem({ id: 2, description: '220 ohm resistor 0805', partNumber: 'R2' }),
      createBomItem({ id: 3, description: '1k ohm resistor 0805', partNumber: 'R3' }),
    ];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute('analyze_bom_optimization', {}, ctx);

    const data = result.data as Record<string, unknown>;
    const consolidation = data.consolidationOpportunities as Array<Record<string, unknown>>;
    expect(consolidation.length).toBeGreaterThan(0);
    expect(consolidation[0].componentType).toBe('resistor');
    expect(consolidation[0].recommendedPackage).toBe('0805');
  });

  it('detects over-spec\'d large resistor packages', async () => {
    const items = [
      createBomItem({ id: 1, description: '100 ohm resistor 2512', partNumber: 'R1' }),
    ];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute('analyze_bom_optimization', {}, ctx);

    const data = result.data as Record<string, unknown>;
    const overspec = data.overspecItems as Array<Record<string, unknown>>;
    expect(overspec.length).toBe(1);
    expect((overspec[0].reason as string)).toContain('2512');
  });

  it('returns sources for all analyzed items', async () => {
    const items = [
      createBomItem({ id: 1 }),
      createBomItem({ id: 2, partNumber: 'CAP-100nF' }),
    ];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute('analyze_bom_optimization', {}, ctx);

    expect(result.sources).toBeDefined();
    expect(result.sources).toHaveLength(2);
    expect(result.sources![0].type).toBe('bom_item');
  });

  it('does not flag cheap resistors', async () => {
    const items = [
      createBomItem({ id: 1, description: '100 ohm resistor 0805', unitPrice: '0.01' }),
    ];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute('analyze_bom_optimization', {}, ctx);

    const data = result.data as Record<string, unknown>;
    const suggestions = data.costSuggestions as Array<Record<string, unknown>>;
    expect(suggestions.filter((s) => s.category === 'overpriced_passive')).toHaveLength(0);
  });

  it('handles items with missing supplier gracefully', async () => {
    const items = [
      createBomItem({ id: 1, supplier: '' }),
      createBomItem({ id: 2, supplier: null }),
    ];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute('analyze_bom_optimization', {}, ctx);

    expect(result.success).toBe(true);
  });

  it('builds package distribution correctly', async () => {
    const items = [
      createBomItem({ id: 1, description: '100 ohm resistor 0805', partNumber: 'R1' }),
      createBomItem({ id: 2, description: '220 ohm resistor 0805', partNumber: 'R2' }),
      createBomItem({ id: 3, description: '1k ohm resistor 0603', partNumber: 'R3' }),
    ];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute('analyze_bom_optimization', {}, ctx);

    const data = result.data as Record<string, unknown>;
    const dist = data.packageDistribution as Record<string, Record<string, number>>;
    expect(dist.resistor).toBeDefined();
    expect(dist.resistor['0805']).toBe(2);
    expect(dist.resistor['0603']).toBe(1);
  });

  it('calls storage.getBomItems with projectId', async () => {
    const storage = createMockStorage([]);
    const ctx = createCtx(storage, { projectId: 42 });
    await registry.execute('analyze_bom_optimization', {}, ctx);

    expect(storage.getBomItems).toHaveBeenCalledWith(42);
  });
});

// ---------------------------------------------------------------------------
// suggest_alternate_part execution
// ---------------------------------------------------------------------------

describe('suggest_alternate_part execution', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
    registerBomOptimizationTools(registry);
  });

  it('returns failure for nonexistent BOM item', async () => {
    const storage = createMockStorage([]);
    const ctx = createCtx(storage);
    const result = await registry.execute('suggest_alternate_part', { bomItemId: 999 }, ctx);

    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('suggests IC alternates for LM7805', async () => {
    const items = [
      createBomItem({ id: 1, partNumber: 'LM7805', description: 'Voltage regulator IC', manufacturer: 'TI' }),
    ];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute('suggest_alternate_part', { bomItemId: 1 }, ctx);

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    const alternates = data.alternates as Array<Record<string, unknown>>;
    expect(alternates.length).toBeGreaterThan(0);
    const altNames = alternates.map((a) => a.suggestion as string);
    expect(altNames.some((n) => n.includes('L7805') || n.includes('MC7805'))).toBe(true);
  });

  it('suggests IC alternates for NE555', async () => {
    const items = [
      createBomItem({ id: 1, partNumber: 'NE555', description: 'Timer IC', manufacturer: 'TI' }),
    ];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute('suggest_alternate_part', { bomItemId: 1 }, ctx);

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    const alternates = data.alternates as Array<Record<string, unknown>>;
    expect(alternates.length).toBeGreaterThan(0);
    expect(alternates.some((a) => (a.suggestion as string).includes('LM555'))).toBe(true);
  });

  it('suggests cost-optimized package for resistor in 1206', async () => {
    const items = [
      createBomItem({ id: 1, description: '100 ohm resistor 1206', partNumber: 'R1' }),
    ];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute(
      'suggest_alternate_part',
      { bomItemId: 1, reason: 'cost' },
      ctx,
    );

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    const alternates = data.alternates as Array<Record<string, unknown>>;
    expect(alternates.some((a) => (a.suggestion as string).includes('0603') || (a.suggestion as string).includes('0805'))).toBe(true);
  });

  it('suggests smaller package for resistor when reason is package_size', async () => {
    const items = [
      createBomItem({ id: 1, description: '100 ohm resistor 0805', partNumber: 'R1' }),
    ];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute(
      'suggest_alternate_part',
      { bomItemId: 1, reason: 'package_size' },
      ctx,
    );

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    const alternates = data.alternates as Array<Record<string, unknown>>;
    expect(alternates.some((a) => (a.suggestion as string).includes('0603'))).toBe(true);
  });

  it('does not suggest cost-optimized package for resistor already in 0805', async () => {
    const items = [
      createBomItem({ id: 1, description: '100 ohm resistor 0805', partNumber: 'R1' }),
    ];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute(
      'suggest_alternate_part',
      { bomItemId: 1, reason: 'cost' },
      ctx,
    );

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    const alternates = data.alternates as Array<Record<string, unknown>>;
    // Should not suggest 0603/0805 since already in 0805
    expect(alternates.filter((a) => a.type === 'cost_optimized_package')).toHaveLength(0);
  });

  it('suggests multi-source for availability reason', async () => {
    const items = [
      createBomItem({ id: 1, description: '100 ohm resistor 0805', manufacturer: 'Yageo' }),
    ];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute(
      'suggest_alternate_part',
      { bomItemId: 1, reason: 'availability' },
      ctx,
    );

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    const alternates = data.alternates as Array<Record<string, unknown>>;
    expect(alternates.some((a) => a.type === 'multi_source')).toBe(true);
  });

  it('returns original item details in response', async () => {
    const items = [
      createBomItem({ id: 5, partNumber: 'LM317', manufacturer: 'TI', description: 'Adj voltage regulator IC', unitPrice: '0.75', quantity: 3 }),
    ];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute('suggest_alternate_part', { bomItemId: 5 }, ctx);

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    const original = data.originalItem as Record<string, unknown>;
    expect(original.partNumber).toBe('LM317');
    expect(original.manufacturer).toBe('TI');
    expect(original.unitPrice).toBe('0.75');
    expect(original.componentType).toBe('ic');
  });

  it('returns sources with the BOM item', async () => {
    const items = [
      createBomItem({ id: 3, partNumber: 'ESP32' }),
    ];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute('suggest_alternate_part', { bomItemId: 3 }, ctx);

    expect(result.success).toBe(true);
    expect(result.sources).toHaveLength(1);
    expect(result.sources![0].type).toBe('bom_item');
    expect(result.sources![0].id).toBe(3);
  });

  it('detects reverse IC alternate (current part is an alternate)', async () => {
    const items = [
      createBomItem({ id: 1, partNumber: 'MC7805', description: 'Voltage regulator IC' }),
    ];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute('suggest_alternate_part', { bomItemId: 1 }, ctx);

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    const alternates = data.alternates as Array<Record<string, unknown>>;
    expect(alternates.some((a) => (a.suggestion as string).includes('LM7805'))).toBe(true);
  });

  it('suggests cost-optimized capacitor package', async () => {
    const items = [
      createBomItem({ id: 1, description: '100nF capacitor 1206', partNumber: 'C1' }),
    ];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute(
      'suggest_alternate_part',
      { bomItemId: 1, reason: 'cost' },
      ctx,
    );

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    const alternates = data.alternates as Array<Record<string, unknown>>;
    expect(alternates.some((a) => a.type === 'cost_optimized_package')).toBe(true);
  });

  it('handles component with no known alternates gracefully', async () => {
    const items = [
      createBomItem({ id: 1, partNumber: 'CUSTOM-PART-XYZ', description: 'Custom sensor module' }),
    ];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute(
      'suggest_alternate_part',
      { bomItemId: 1, reason: 'cost' },
      ctx,
    );

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.alternates).toBeDefined();
  });

  it('suggests multi_source for TI manufacturer with alternate names', async () => {
    const items = [
      createBomItem({ id: 1, manufacturer: 'TI', description: 'Timer IC', partNumber: 'CUSTOM-IC' }),
    ];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute(
      'suggest_alternate_part',
      { bomItemId: 1, reason: 'availability' },
      ctx,
    );

    const data = result.data as Record<string, unknown>;
    const alternates = data.alternates as Array<Record<string, unknown>>;
    const multiSource = alternates.find((a) => a.type === 'multi_source');
    expect(multiSource).toBeDefined();
    expect((multiSource!.suggestion as string)).toContain('alternate manufacturer');
  });
});

// ---------------------------------------------------------------------------
// consolidate_packages execution
// ---------------------------------------------------------------------------

describe('consolidate_packages execution', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
    registerBomOptimizationTools(registry);
  });

  it('returns empty groups for empty BOM', async () => {
    const storage = createMockStorage([]);
    const ctx = createCtx(storage);
    const result = await registry.execute('consolidate_packages', {}, ctx);

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.groups).toEqual([]);
  });

  it('finds consolidation opportunity for resistors with mixed packages', async () => {
    const items = [
      createBomItem({ id: 1, description: '100 ohm resistor 0402', partNumber: 'R1' }),
      createBomItem({ id: 2, description: '220 ohm resistor 0805', partNumber: 'R2' }),
      createBomItem({ id: 3, description: '1k ohm resistor 0805', partNumber: 'R3' }),
      createBomItem({ id: 4, description: '4.7k ohm resistor 0805', partNumber: 'R4' }),
    ];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute('consolidate_packages', {}, ctx);

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    const groups = data.groups as Array<Record<string, unknown>>;
    expect(groups).toHaveLength(1);
    expect(groups[0].componentType).toBe('resistor');
    expect(groups[0].recommendedPackage).toBe('0805'); // most common
  });

  it('uses specified targetPackage when valid', async () => {
    const items = [
      createBomItem({ id: 1, description: '100 ohm resistor 0402', partNumber: 'R1' }),
      createBomItem({ id: 2, description: '220 ohm resistor 0805', partNumber: 'R2' }),
    ];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute('consolidate_packages', { targetPackage: '0402' }, ctx);

    const data = result.data as Record<string, unknown>;
    const groups = data.groups as Array<Record<string, unknown>>;
    expect(groups[0].recommendedPackage).toBe('0402');
  });

  it('falls back to most common when targetPackage is not in the group', async () => {
    const items = [
      createBomItem({ id: 1, description: '100 ohm resistor 0402', partNumber: 'R1' }),
      createBomItem({ id: 2, description: '220 ohm resistor 0805', partNumber: 'R2' }),
      createBomItem({ id: 3, description: '1k ohm resistor 0805', partNumber: 'R3' }),
    ];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute('consolidate_packages', { targetPackage: '1206' }, ctx);

    const data = result.data as Record<string, unknown>;
    const groups = data.groups as Array<Record<string, unknown>>;
    expect(groups[0].recommendedPackage).toBe('0805');
  });

  it('identifies items to migrate', async () => {
    const items = [
      createBomItem({ id: 1, description: '100 ohm resistor 0402', partNumber: 'R1' }),
      createBomItem({ id: 2, description: '220 ohm resistor 0805', partNumber: 'R2' }),
    ];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute('consolidate_packages', {}, ctx);

    const data = result.data as Record<string, unknown>;
    const groups = data.groups as Array<Record<string, unknown>>;
    const migrateItems = groups[0].itemsToMigrate as Array<Record<string, unknown>>;
    // The one not matching the recommended package should be in migrate list
    expect(migrateItems.length).toBe(1);
    expect(migrateItems[0].currentPackage).not.toBe(groups[0].recommendedPackage);
  });

  it('assigns easy migration difficulty for adjacent packages', async () => {
    const items = [
      createBomItem({ id: 1, description: '100 ohm resistor 0603', partNumber: 'R1' }),
      createBomItem({ id: 2, description: '220 ohm resistor 0805', partNumber: 'R2' }),
    ];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute('consolidate_packages', {}, ctx);

    const data = result.data as Record<string, unknown>;
    const groups = data.groups as Array<Record<string, unknown>>;
    const migrateItems = groups[0].itemsToMigrate as Array<Record<string, unknown>>;
    expect(migrateItems[0].migrationDifficulty).toBe('easy');
  });

  it('assigns hard migration difficulty for distant packages', async () => {
    const items = [
      createBomItem({ id: 1, description: '100 ohm resistor 0201', partNumber: 'R1' }),
      createBomItem({ id: 2, description: '220 ohm resistor 1206', partNumber: 'R2' }),
      createBomItem({ id: 3, description: '1k ohm resistor 1206', partNumber: 'R3' }),
    ];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute('consolidate_packages', {}, ctx);

    const data = result.data as Record<string, unknown>;
    const groups = data.groups as Array<Record<string, unknown>>;
    const migrateItems = groups[0].itemsToMigrate as Array<Record<string, unknown>>;
    const r0201Item = migrateItems.find((m) => m.currentPackage === '0201');
    expect(r0201Item?.migrationDifficulty).toBe('hard');
  });

  it('skips component types that are already consolidated', async () => {
    const items = [
      createBomItem({ id: 1, description: '100 ohm resistor 0805', partNumber: 'R1' }),
      createBomItem({ id: 2, description: '220 ohm resistor 0805', partNumber: 'R2' }),
    ];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute('consolidate_packages', {}, ctx);

    const data = result.data as Record<string, unknown>;
    const groups = data.groups as Array<Record<string, unknown>>;
    expect(groups).toHaveLength(0); // Already consolidated
  });

  it('handles mixed component types (resistor + capacitor)', async () => {
    const items = [
      createBomItem({ id: 1, description: '100 ohm resistor 0402', partNumber: 'R1' }),
      createBomItem({ id: 2, description: '220 ohm resistor 0805', partNumber: 'R2' }),
      createBomItem({ id: 3, description: '100nF capacitor 0402', partNumber: 'C1' }),
      createBomItem({ id: 4, description: '10uF capacitor 0805', partNumber: 'C2' }),
    ];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute('consolidate_packages', {}, ctx);

    const data = result.data as Record<string, unknown>;
    const groups = data.groups as Array<Record<string, unknown>>;
    expect(groups).toHaveLength(2); // resistor + capacitor
    const types = groups.map((g) => g.componentType);
    expect(types).toContain('resistor');
    expect(types).toContain('capacitor');
  });

  it('reports assembly cost impact in message', async () => {
    const items = [
      createBomItem({ id: 1, description: '100 ohm resistor 0402', partNumber: 'R1' }),
      createBomItem({ id: 2, description: '220 ohm resistor 0805', partNumber: 'R2' }),
    ];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute('consolidate_packages', {}, ctx);

    const data = result.data as Record<string, unknown>;
    const groups = data.groups as Array<Record<string, unknown>>;
    expect(groups[0].assemblyCostImpact).toContain('feeder slots');
  });

  it('returns summary with total analyzed and migration counts', async () => {
    const items = [
      createBomItem({ id: 1, description: '100 ohm resistor 0402', partNumber: 'R1' }),
      createBomItem({ id: 2, description: '220 ohm resistor 0805', partNumber: 'R2' }),
    ];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute('consolidate_packages', {}, ctx);

    const data = result.data as Record<string, unknown>;
    const summary = data.summary as Record<string, unknown>;
    expect(summary.totalAnalyzed).toBe(2);
    expect(summary.componentTypesWithOpportunities).toBe(1);
    expect(summary.totalItemsToMigrate).toBe(1);
  });

  it('returns sources for items with detected packages', async () => {
    const items = [
      createBomItem({ id: 1, description: '100 ohm resistor 0805', partNumber: 'R1' }),
      createBomItem({ id: 2, description: 'Custom sensor module', partNumber: 'SENSOR-1' }), // no package
    ];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute('consolidate_packages', {}, ctx);

    expect(result.sources).toBeDefined();
    // Only the item with a detected package should be in sources
    expect(result.sources!.length).toBe(1);
    expect(result.sources![0].id).toBe(1);
  });

  it('ignores ICs and connectors (no package consolidation)', async () => {
    const items = [
      createBomItem({ id: 1, description: 'MCU IC QFP-48', partNumber: 'STM32F103' }),
      createBomItem({ id: 2, description: 'Timer IC DIP-8', partNumber: 'NE555' }),
    ];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute('consolidate_packages', {}, ctx);

    const data = result.data as Record<string, unknown>;
    const groups = data.groups as Array<Record<string, unknown>>;
    expect(groups).toHaveLength(0); // ICs are not consolidated
  });

  it('calls storage.getBomItems with correct projectId', async () => {
    const storage = createMockStorage([]);
    const ctx = createCtx(storage, { projectId: 77 });
    await registry.execute('consolidate_packages', {}, ctx);

    expect(storage.getBomItems).toHaveBeenCalledWith(77);
  });
});

// ---------------------------------------------------------------------------
// Component type detection
// ---------------------------------------------------------------------------

describe('Component type detection via tool behavior', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
    registerBomOptimizationTools(registry);
  });

  it('detects resistors from description', async () => {
    const items = [createBomItem({ id: 1, description: '10k ohm resistor 0805', partNumber: 'R1' })];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute('suggest_alternate_part', { bomItemId: 1 }, ctx);

    const data = result.data as Record<string, unknown>;
    const original = data.originalItem as Record<string, unknown>;
    expect(original.componentType).toBe('resistor');
  });

  it('detects capacitors from description', async () => {
    const items = [createBomItem({ id: 1, description: '100nF ceramic capacitor 0805', partNumber: 'C1' })];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute('suggest_alternate_part', { bomItemId: 1 }, ctx);

    const data = result.data as Record<string, unknown>;
    const original = data.originalItem as Record<string, unknown>;
    expect(original.componentType).toBe('capacitor');
  });

  it('detects ICs from description', async () => {
    const items = [createBomItem({ id: 1, description: 'Voltage regulator IC', partNumber: 'LM7805' })];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute('suggest_alternate_part', { bomItemId: 1 }, ctx);

    const data = result.data as Record<string, unknown>;
    const original = data.originalItem as Record<string, unknown>;
    expect(original.componentType).toBe('ic');
  });

  it('detects connectors from description', async () => {
    const items = [createBomItem({ id: 1, description: '2.54mm pin header connector', partNumber: 'J1' })];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute('suggest_alternate_part', { bomItemId: 1 }, ctx);

    const data = result.data as Record<string, unknown>;
    const original = data.originalItem as Record<string, unknown>;
    expect(original.componentType).toBe('connector');
  });

  it('falls back to other for unknown components', async () => {
    const items = [createBomItem({ id: 1, description: 'Custom module XYZ', partNumber: 'MOD-1' })];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute('suggest_alternate_part', { bomItemId: 1 }, ctx);

    const data = result.data as Record<string, unknown>;
    const original = data.originalItem as Record<string, unknown>;
    expect(original.componentType).toBe('other');
  });
});

// ---------------------------------------------------------------------------
// Package extraction via tool behavior
// ---------------------------------------------------------------------------

describe('Package extraction via tool behavior', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
    registerBomOptimizationTools(registry);
  });

  it('extracts 0805 package from description', async () => {
    const items = [createBomItem({ id: 1, description: '100 ohm resistor 0805' })];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute('suggest_alternate_part', { bomItemId: 1 }, ctx);

    const data = result.data as Record<string, unknown>;
    const original = data.originalItem as Record<string, unknown>;
    expect(original.currentPackage).toBe('0805');
  });

  it('extracts SOT-23 package from description', async () => {
    const items = [createBomItem({ id: 1, description: 'MOSFET transistor SOT-23' })];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute('suggest_alternate_part', { bomItemId: 1 }, ctx);

    const data = result.data as Record<string, unknown>;
    const original = data.originalItem as Record<string, unknown>;
    expect(original.currentPackage).toBe('SOT-23');
  });

  it('returns null for description without package', async () => {
    const items = [createBomItem({ id: 1, description: 'Custom sensor module' })];
    const storage = createMockStorage(items);
    const ctx = createCtx(storage);
    const result = await registry.execute('suggest_alternate_part', { bomItemId: 1 }, ctx);

    const data = result.data as Record<string, unknown>;
    const original = data.originalItem as Record<string, unknown>;
    expect(original.currentPackage).toBeNull();
  });
});
