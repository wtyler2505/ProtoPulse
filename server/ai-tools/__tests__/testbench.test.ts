/**
 * Tests for testbench AI tools — suggest_testbench, explain_test_point, generate_test_sequence.
 *
 * Covers: registration, schema validation, input rejection, server-side execution
 * with mock storage, topology classification, edge cases (empty circuits, missing nets).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolRegistry } from '../registry';
import { registerTestbenchTools } from '../testbench';
import type { ToolContext } from '../types';
import type { IStorage } from '../../storage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRegistry(): ToolRegistry {
  const r = new ToolRegistry();
  registerTestbenchTools(r);
  return r;
}

function createMockStorage(overrides?: Partial<IStorage>): IStorage {
  return {
    getCircuitDesign: vi.fn().mockResolvedValue({ id: 1, name: 'Test Circuit', projectId: 1 }),
    getCircuitInstances: vi.fn().mockResolvedValue([]),
    getCircuitNets: vi.fn().mockResolvedValue([]),
    getCircuitWires: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as IStorage;
}

function createCtx(overrides?: Partial<ToolContext>): ToolContext {
  return {
    projectId: 1,
    storage: createMockStorage(),
    confirmed: true,
    ...overrides,
  };
}

// Sample circuit data factories
function makeInstance(id: number, refDes: string, partId = 1) {
  return { id, referenceDesignator: refDes, partId, positionX: 0, positionY: 0, rotation: 0, properties: {} };
}

function makeNet(id: number, name: string, netType: string | null = 'signal', voltage: string | null = null) {
  return { id, name, netType, voltage, circuitDesignId: 1 };
}

function makeWire(id: number, netId: number | null) {
  return { id, netId, view: 'schematic', layer: null, wireType: 'signal', points: [] };
}

// ---------------------------------------------------------------------------
// 1. Registration
// ---------------------------------------------------------------------------

describe('Testbench tools — registration', () => {
  const registry = createRegistry();

  it('registers exactly 3 tools', () => {
    expect(registry.getAll()).toHaveLength(3);
  });

  it('registers suggest_testbench', () => {
    expect(registry.get('suggest_testbench')).toBeDefined();
  });

  it('registers explain_test_point', () => {
    expect(registry.get('explain_test_point')).toBeDefined();
  });

  it('registers generate_test_sequence', () => {
    expect(registry.get('generate_test_sequence')).toBeDefined();
  });

  it('all tools are in the simulation category', () => {
    for (const tool of registry.getAll()) {
      expect(tool.category).toBe('simulation');
    }
  });

  it('no tools require confirmation', () => {
    for (const tool of registry.getAll()) {
      expect(tool.requiresConfirmation).toBe(false);
    }
  });

  it('all tools have standard model preference', () => {
    for (const tool of registry.getAll()) {
      expect(tool.modelPreference).toBe('standard');
    }
  });

  it('throws on duplicate registration', () => {
    const r = createRegistry();
    expect(() => registerTestbenchTools(r)).toThrow('already registered');
  });
});

// ---------------------------------------------------------------------------
// 2. Schema validation — suggest_testbench
// ---------------------------------------------------------------------------

describe('suggest_testbench — schema validation', () => {
  const registry = createRegistry();

  it('accepts valid circuitDesignId', () => {
    const v = registry.validate('suggest_testbench', { circuitDesignId: 1 });
    expect(v.ok).toBe(true);
  });

  it('rejects missing circuitDesignId', () => {
    const v = registry.validate('suggest_testbench', {});
    expect(v.ok).toBe(false);
  });

  it('rejects zero circuitDesignId', () => {
    const v = registry.validate('suggest_testbench', { circuitDesignId: 0 });
    expect(v.ok).toBe(false);
  });

  it('rejects negative circuitDesignId', () => {
    const v = registry.validate('suggest_testbench', { circuitDesignId: -1 });
    expect(v.ok).toBe(false);
  });

  it('rejects float circuitDesignId', () => {
    const v = registry.validate('suggest_testbench', { circuitDesignId: 1.5 });
    expect(v.ok).toBe(false);
  });

  it('rejects string circuitDesignId', () => {
    const v = registry.validate('suggest_testbench', { circuitDesignId: 'abc' });
    expect(v.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Schema validation — explain_test_point
// ---------------------------------------------------------------------------

describe('explain_test_point — schema validation', () => {
  const registry = createRegistry();

  it('accepts valid params', () => {
    const v = registry.validate('explain_test_point', { circuitDesignId: 1, netName: 'VCC' });
    expect(v.ok).toBe(true);
  });

  it('rejects missing netName', () => {
    const v = registry.validate('explain_test_point', { circuitDesignId: 1 });
    expect(v.ok).toBe(false);
  });

  it('rejects empty netName', () => {
    const v = registry.validate('explain_test_point', { circuitDesignId: 1, netName: '' });
    expect(v.ok).toBe(false);
  });

  it('rejects missing circuitDesignId', () => {
    const v = registry.validate('explain_test_point', { netName: 'VCC' });
    expect(v.ok).toBe(false);
  });

  it('rejects zero circuitDesignId', () => {
    const v = registry.validate('explain_test_point', { circuitDesignId: 0, netName: 'VCC' });
    expect(v.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Schema validation — generate_test_sequence
// ---------------------------------------------------------------------------

describe('generate_test_sequence — schema validation', () => {
  const registry = createRegistry();

  it('accepts valid params with default focus', () => {
    const v = registry.validate('generate_test_sequence', { circuitDesignId: 1 });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.params.focus).toBe('all');
    }
  });

  it('accepts focus=dc', () => {
    const v = registry.validate('generate_test_sequence', { circuitDesignId: 1, focus: 'dc' });
    expect(v.ok).toBe(true);
  });

  it('accepts focus=ac', () => {
    const v = registry.validate('generate_test_sequence', { circuitDesignId: 1, focus: 'ac' });
    expect(v.ok).toBe(true);
  });

  it('accepts focus=transient', () => {
    const v = registry.validate('generate_test_sequence', { circuitDesignId: 1, focus: 'transient' });
    expect(v.ok).toBe(true);
  });

  it('rejects invalid focus', () => {
    const v = registry.validate('generate_test_sequence', { circuitDesignId: 1, focus: 'invalid' });
    expect(v.ok).toBe(false);
  });

  it('rejects missing circuitDesignId', () => {
    const v = registry.validate('generate_test_sequence', {});
    expect(v.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. Execution — suggest_testbench
// ---------------------------------------------------------------------------

describe('suggest_testbench — execution', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = createRegistry();
  });

  it('returns error when circuit design not found', async () => {
    const storage = createMockStorage({
      getCircuitDesign: vi.fn().mockResolvedValue(null),
    });
    const ctx = createCtx({ storage });
    const result = await registry.execute('suggest_testbench', { circuitDesignId: 99 }, ctx);

    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('returns error when circuit belongs to different project', async () => {
    const storage = createMockStorage({
      getCircuitDesign: vi.fn().mockResolvedValue({ id: 1, name: 'X', projectId: 999 }),
    });
    const ctx = createCtx({ storage });
    const result = await registry.execute('suggest_testbench', { circuitDesignId: 1 }, ctx);

    expect(result.success).toBe(false);
    expect(result.message).toContain('does not belong');
  });

  it('returns error when circuit has no components', async () => {
    const storage = createMockStorage({
      getCircuitInstances: vi.fn().mockResolvedValue([]),
      getCircuitNets: vi.fn().mockResolvedValue([]),
      getCircuitWires: vi.fn().mockResolvedValue([]),
    });
    const ctx = createCtx({ storage });
    const result = await registry.execute('suggest_testbench', { circuitDesignId: 1 }, ctx);

    expect(result.success).toBe(false);
    expect(result.message).toContain('no components');
  });

  it('recommends DC analysis for circuit with power nets', async () => {
    const storage = createMockStorage({
      getCircuitInstances: vi.fn().mockResolvedValue([
        makeInstance(1, 'V1'),
        makeInstance(2, 'R1'),
      ]),
      getCircuitNets: vi.fn().mockResolvedValue([
        makeNet(1, 'VCC', 'power', '5V'),
        makeNet(2, 'GND', 'ground'),
      ]),
      getCircuitWires: vi.fn().mockResolvedValue([
        makeWire(1, 1),
        makeWire(2, 2),
      ]),
    });
    const ctx = createCtx({ storage });
    const result = await registry.execute('suggest_testbench', { circuitDesignId: 1 }, ctx);

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.designName).toBe('Test Circuit');
    const recs = data.recommendations as Array<{ analysisType: string; priority: string }>;
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.some((r) => r.analysisType === 'dc')).toBe(true);
  });

  it('recommends AC analysis for circuit with passives and signals', async () => {
    const storage = createMockStorage({
      getCircuitInstances: vi.fn().mockResolvedValue([
        makeInstance(1, 'R1'),
        makeInstance(2, 'C1'),
        makeInstance(3, 'L1'),
      ]),
      getCircuitNets: vi.fn().mockResolvedValue([
        makeNet(1, 'INPUT', 'signal'),
        makeNet(2, 'OUTPUT', 'signal'),
      ]),
      getCircuitWires: vi.fn().mockResolvedValue([
        makeWire(1, 1),
        makeWire(2, 2),
      ]),
    });
    const ctx = createCtx({ storage });
    const result = await registry.execute('suggest_testbench', { circuitDesignId: 1 }, ctx);

    expect(result.success).toBe(true);
    const recs = (result.data as Record<string, unknown>).recommendations as Array<{ analysisType: string }>;
    expect(recs.some((r) => r.analysisType === 'ac')).toBe(true);
  });

  it('recommends transient analysis for circuit with clock nets', async () => {
    const storage = createMockStorage({
      getCircuitInstances: vi.fn().mockResolvedValue([
        makeInstance(1, 'U1'),
        makeInstance(2, 'R1'),
      ]),
      getCircuitNets: vi.fn().mockResolvedValue([
        makeNet(1, 'CLK', 'signal'),
        makeNet(2, 'DATA', 'signal'),
      ]),
      getCircuitWires: vi.fn().mockResolvedValue([
        makeWire(1, 1),
        makeWire(2, 2),
      ]),
    });
    const ctx = createCtx({ storage });
    const result = await registry.execute('suggest_testbench', { circuitDesignId: 1 }, ctx);

    expect(result.success).toBe(true);
    const recs = (result.data as Record<string, unknown>).recommendations as Array<{ analysisType: string }>;
    expect(recs.some((r) => r.analysisType === 'transient')).toBe(true);
  });

  it('returns topology breakdown with net and instance roles', async () => {
    const storage = createMockStorage({
      getCircuitInstances: vi.fn().mockResolvedValue([
        makeInstance(1, 'V1'),
        makeInstance(2, 'R1'),
        makeInstance(3, 'U1'),
      ]),
      getCircuitNets: vi.fn().mockResolvedValue([
        makeNet(1, 'VCC', 'power', '3.3V'),
        makeNet(2, 'GND', 'ground'),
        makeNet(3, 'SDA', 'signal'),
      ]),
      getCircuitWires: vi.fn().mockResolvedValue([
        makeWire(1, 1),
        makeWire(2, 2),
        makeWire(3, 3),
      ]),
    });
    const ctx = createCtx({ storage });
    const result = await registry.execute('suggest_testbench', { circuitDesignId: 1 }, ctx);

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    const topology = data.topology as Record<string, unknown>;
    expect(topology.instanceCount).toBe(3);
    expect(topology.netCount).toBe(3);

    const netsByRole = topology.netsByRole as Record<string, number>;
    expect(netsByRole.power).toBe(1);
    expect(netsByRole.ground).toBe(1);

    const instancesByRole = topology.instancesByRole as Record<string, number>;
    expect(instancesByRole.source).toBe(1);
    expect(instancesByRole.passive).toBe(1);
    expect(instancesByRole.active).toBe(1);
  });

  it('returns sources array with net references', async () => {
    const storage = createMockStorage({
      getCircuitInstances: vi.fn().mockResolvedValue([makeInstance(1, 'R1')]),
      getCircuitNets: vi.fn().mockResolvedValue([makeNet(1, 'VCC', 'power')]),
      getCircuitWires: vi.fn().mockResolvedValue([]),
    });
    const ctx = createCtx({ storage });
    const result = await registry.execute('suggest_testbench', { circuitDesignId: 1 }, ctx);

    expect(result.success).toBe(true);
    expect(result.sources).toBeDefined();
    expect(result.sources!.length).toBeGreaterThan(0);
    expect(result.sources![0].type).toBe('net');
  });

  it('provides fallback DC recommendation when no specific topology features detected', async () => {
    const storage = createMockStorage({
      getCircuitInstances: vi.fn().mockResolvedValue([
        makeInstance(1, 'X1'),
      ]),
      getCircuitNets: vi.fn().mockResolvedValue([
        makeNet(1, 'NET1', null),
      ]),
      getCircuitWires: vi.fn().mockResolvedValue([]),
    });
    const ctx = createCtx({ storage });
    const result = await registry.execute('suggest_testbench', { circuitDesignId: 1 }, ctx);

    expect(result.success).toBe(true);
    const recs = (result.data as Record<string, unknown>).recommendations as Array<{ analysisType: string; priority: string }>;
    expect(recs.length).toBe(1);
    expect(recs[0].analysisType).toBe('dc');
    expect(recs[0].priority).toBe('low');
  });
});

// ---------------------------------------------------------------------------
// 6. Execution — explain_test_point
// ---------------------------------------------------------------------------

describe('explain_test_point — execution', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = createRegistry();
  });

  it('returns error when circuit not found', async () => {
    const storage = createMockStorage({
      getCircuitDesign: vi.fn().mockResolvedValue(null),
    });
    const ctx = createCtx({ storage });
    const result = await registry.execute('explain_test_point', { circuitDesignId: 99, netName: 'VCC' }, ctx);

    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('returns error when net not found', async () => {
    const storage = createMockStorage({
      getCircuitNets: vi.fn().mockResolvedValue([makeNet(1, 'GND', 'ground')]),
    });
    const ctx = createCtx({ storage });
    const result = await registry.execute('explain_test_point', { circuitDesignId: 1, netName: 'MISSING' }, ctx);

    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
    expect(result.message).toContain('GND');
  });

  it('explains a power net correctly', async () => {
    const storage = createMockStorage({
      getCircuitNets: vi.fn().mockResolvedValue([makeNet(1, 'VCC', 'power', '5V')]),
      getCircuitWires: vi.fn().mockResolvedValue([makeWire(1, 1), makeWire(2, 1)]),
      getCircuitInstances: vi.fn().mockResolvedValue([makeInstance(1, 'U1')]),
    });
    const ctx = createCtx({ storage });
    const result = await registry.execute('explain_test_point', { circuitDesignId: 1, netName: 'VCC' }, ctx);

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.role).toBe('power');
    expect(data.voltage).toBe('5V');
    expect(data.suggestedMeasurement).toBe('dc_voltage');
    expect((data.explanation as string).length).toBeGreaterThan(0);
  });

  it('explains a ground net correctly', async () => {
    const storage = createMockStorage({
      getCircuitNets: vi.fn().mockResolvedValue([makeNet(1, 'GND', 'ground')]),
      getCircuitWires: vi.fn().mockResolvedValue([]),
      getCircuitInstances: vi.fn().mockResolvedValue([]),
    });
    const ctx = createCtx({ storage });
    const result = await registry.execute('explain_test_point', { circuitDesignId: 1, netName: 'GND' }, ctx);

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.role).toBe('ground');
    expect(data.suggestedMeasurement).toBe('dc_voltage');
  });

  it('explains a clock net correctly', async () => {
    const storage = createMockStorage({
      getCircuitNets: vi.fn().mockResolvedValue([makeNet(1, 'CLK', 'signal')]),
      getCircuitWires: vi.fn().mockResolvedValue([]),
      getCircuitInstances: vi.fn().mockResolvedValue([]),
    });
    const ctx = createCtx({ storage });
    const result = await registry.execute('explain_test_point', { circuitDesignId: 1, netName: 'CLK' }, ctx);

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.role).toBe('clock');
    expect(data.suggestedMeasurement).toBe('oscilloscope_frequency');
  });

  it('explains a bus net (SDA) correctly', async () => {
    const storage = createMockStorage({
      getCircuitNets: vi.fn().mockResolvedValue([makeNet(1, 'SDA', 'signal')]),
      getCircuitWires: vi.fn().mockResolvedValue([]),
      getCircuitInstances: vi.fn().mockResolvedValue([]),
    });
    const ctx = createCtx({ storage });
    const result = await registry.execute('explain_test_point', { circuitDesignId: 1, netName: 'SDA' }, ctx);

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.role).toBe('bus');
    expect(data.suggestedMeasurement).toBe('logic_analyzer');
  });

  it('performs case-insensitive net name matching', async () => {
    const storage = createMockStorage({
      getCircuitNets: vi.fn().mockResolvedValue([makeNet(1, 'VCC', 'power', '3.3V')]),
      getCircuitWires: vi.fn().mockResolvedValue([]),
      getCircuitInstances: vi.fn().mockResolvedValue([]),
    });
    const ctx = createCtx({ storage });
    const result = await registry.execute('explain_test_point', { circuitDesignId: 1, netName: 'vcc' }, ctx);

    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).netName).toBe('VCC');
  });

  it('returns sources array with the matched net', async () => {
    const storage = createMockStorage({
      getCircuitNets: vi.fn().mockResolvedValue([makeNet(42, 'DATA', 'signal')]),
      getCircuitWires: vi.fn().mockResolvedValue([]),
      getCircuitInstances: vi.fn().mockResolvedValue([]),
    });
    const ctx = createCtx({ storage });
    const result = await registry.execute('explain_test_point', { circuitDesignId: 1, netName: 'DATA' }, ctx);

    expect(result.success).toBe(true);
    expect(result.sources).toHaveLength(1);
    expect(result.sources![0]).toEqual({ type: 'net', label: 'DATA', id: 42 });
  });

  it('returns circuit context with instance role counts', async () => {
    const storage = createMockStorage({
      getCircuitNets: vi.fn().mockResolvedValue([makeNet(1, 'OUT', 'signal')]),
      getCircuitWires: vi.fn().mockResolvedValue([]),
      getCircuitInstances: vi.fn().mockResolvedValue([
        makeInstance(1, 'V1'),
        makeInstance(2, 'R1'),
        makeInstance(3, 'C1'),
        makeInstance(4, 'U1'),
      ]),
    });
    const ctx = createCtx({ storage });
    const result = await registry.execute('explain_test_point', { circuitDesignId: 1, netName: 'OUT' }, ctx);

    expect(result.success).toBe(true);
    const context = (result.data as Record<string, unknown>).circuitContext as Record<string, unknown>;
    expect(context.totalInstances).toBe(4);
    const roles = context.instanceRoles as Record<string, number>;
    expect(roles.source).toBe(1);
    expect(roles.passive).toBe(2);
    expect(roles.active).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 7. Execution — generate_test_sequence
// ---------------------------------------------------------------------------

describe('generate_test_sequence — execution', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = createRegistry();
  });

  it('returns error when circuit not found', async () => {
    const storage = createMockStorage({
      getCircuitDesign: vi.fn().mockResolvedValue(null),
    });
    const ctx = createCtx({ storage });
    const result = await registry.execute('generate_test_sequence', { circuitDesignId: 99 }, ctx);

    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('returns error when circuit has no components', async () => {
    const storage = createMockStorage({
      getCircuitInstances: vi.fn().mockResolvedValue([]),
      getCircuitNets: vi.fn().mockResolvedValue([]),
      getCircuitWires: vi.fn().mockResolvedValue([]),
    });
    const ctx = createCtx({ storage });
    const result = await registry.execute('generate_test_sequence', { circuitDesignId: 1 }, ctx);

    expect(result.success).toBe(false);
    expect(result.message).toContain('no components');
  });

  it('generates test sequence with visual inspection as first step', async () => {
    const storage = createMockStorage({
      getCircuitInstances: vi.fn().mockResolvedValue([
        makeInstance(1, 'V1'),
        makeInstance(2, 'R1'),
        makeInstance(3, 'U1'),
      ]),
      getCircuitNets: vi.fn().mockResolvedValue([
        makeNet(1, 'VCC', 'power', '5V'),
        makeNet(2, 'GND', 'ground'),
        makeNet(3, 'OUT', 'signal'),
      ]),
      getCircuitWires: vi.fn().mockResolvedValue([
        makeWire(1, 1),
        makeWire(2, 2),
        makeWire(3, 3),
      ]),
    });
    const ctx = createCtx({ storage });
    const result = await registry.execute('generate_test_sequence', { circuitDesignId: 1 }, ctx);

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    const steps = data.steps as Array<{ stepNumber: number; analysisType: string; action: string }>;
    expect(steps.length).toBeGreaterThanOrEqual(2);
    expect(steps[0].stepNumber).toBe(1);
    expect(steps[0].analysisType).toBe('visual');
    expect(steps[0].action).toContain('inspect');
  });

  it('generates DC verification steps for power circuits', async () => {
    const storage = createMockStorage({
      getCircuitInstances: vi.fn().mockResolvedValue([
        makeInstance(1, 'V1'),
        makeInstance(2, 'R1'),
        makeInstance(3, 'U1'),
      ]),
      getCircuitNets: vi.fn().mockResolvedValue([
        makeNet(1, 'VCC', 'power', '5V'),
        makeNet(2, 'GND', 'ground'),
      ]),
      getCircuitWires: vi.fn().mockResolvedValue([
        makeWire(1, 1),
        makeWire(2, 2),
      ]),
    });
    const ctx = createCtx({ storage });
    const result = await registry.execute('generate_test_sequence', { circuitDesignId: 1 }, ctx);

    expect(result.success).toBe(true);
    const steps = (result.data as Record<string, unknown>).steps as Array<{ analysisType: string }>;
    expect(steps.some((s) => s.analysisType === 'dc')).toBe(true);
  });

  it('filters steps by focus=dc', async () => {
    const storage = createMockStorage({
      getCircuitInstances: vi.fn().mockResolvedValue([
        makeInstance(1, 'V1'),
        makeInstance(2, 'R1'),
        makeInstance(3, 'C1'),
        makeInstance(4, 'U1'),
      ]),
      getCircuitNets: vi.fn().mockResolvedValue([
        makeNet(1, 'VCC', 'power', '5V'),
        makeNet(2, 'GND', 'ground'),
        makeNet(3, 'CLK', 'signal'),
        makeNet(4, 'OUT', 'signal'),
      ]),
      getCircuitWires: vi.fn().mockResolvedValue([
        makeWire(1, 1),
        makeWire(2, 2),
        makeWire(3, 3),
        makeWire(4, 4),
      ]),
    });
    const ctx = createCtx({ storage });
    const result = await registry.execute('generate_test_sequence', { circuitDesignId: 1, focus: 'dc' }, ctx);

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.focus).toBe('dc');
    const recs = data.recommendations as Array<{ analysisType: string }>;
    for (const rec of recs) {
      expect(rec.analysisType).toBe('dc');
    }
  });

  it('includes integration step for circuits with 3+ components', async () => {
    const storage = createMockStorage({
      getCircuitInstances: vi.fn().mockResolvedValue([
        makeInstance(1, 'V1'),
        makeInstance(2, 'R1'),
        makeInstance(3, 'U1'),
      ]),
      getCircuitNets: vi.fn().mockResolvedValue([
        makeNet(1, 'VCC', 'power', '5V'),
        makeNet(2, 'OUT', 'signal'),
      ]),
      getCircuitWires: vi.fn().mockResolvedValue([makeWire(1, 1)]),
    });
    const ctx = createCtx({ storage });
    const result = await registry.execute('generate_test_sequence', { circuitDesignId: 1 }, ctx);

    expect(result.success).toBe(true);
    const steps = (result.data as Record<string, unknown>).steps as Array<{ action: string }>;
    const lastStep = steps[steps.length - 1];
    expect(lastStep.action).toContain('end-to-end');
  });

  it('returns topology summary in response', async () => {
    const storage = createMockStorage({
      getCircuitInstances: vi.fn().mockResolvedValue([makeInstance(1, 'R1')]),
      getCircuitNets: vi.fn().mockResolvedValue([makeNet(1, 'NET1', null)]),
      getCircuitWires: vi.fn().mockResolvedValue([]),
    });
    const ctx = createCtx({ storage });
    const result = await registry.execute('generate_test_sequence', { circuitDesignId: 1 }, ctx);

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    const topology = data.topology as Record<string, number>;
    expect(topology.instanceCount).toBe(1);
    expect(topology.netCount).toBe(1);
  });

  it('returns sources array', async () => {
    const storage = createMockStorage({
      getCircuitInstances: vi.fn().mockResolvedValue([makeInstance(1, 'R1')]),
      getCircuitNets: vi.fn().mockResolvedValue([makeNet(5, 'VCC', 'power')]),
      getCircuitWires: vi.fn().mockResolvedValue([]),
    });
    const ctx = createCtx({ storage });
    const result = await registry.execute('generate_test_sequence', { circuitDesignId: 1 }, ctx);

    expect(result.success).toBe(true);
    expect(result.sources).toBeDefined();
    expect(result.sources!.some((s) => s.type === 'net' && s.label === 'VCC')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 8. Net classification edge cases
// ---------------------------------------------------------------------------

describe('Net classification patterns', () => {
  const registry = createRegistry();

  const classificationCases = [
    { name: 'VCC', expectedRole: 'power' },
    { name: 'VDD', expectedRole: 'power' },
    { name: '+3V3', expectedRole: 'power' },
    { name: 'VBAT', expectedRole: 'power' },
    { name: 'GND', expectedRole: 'ground' },
    { name: 'AGND', expectedRole: 'ground' },
    { name: 'VSS', expectedRole: 'ground' },
    { name: 'CLK', expectedRole: 'clock' },
    { name: 'SCLK', expectedRole: 'clock' },
    { name: 'SDA', expectedRole: 'bus' },
    { name: 'MOSI', expectedRole: 'bus' },
    { name: 'TX', expectedRole: 'bus' },
  ];

  it.each(classificationCases)(
    'classifies net "$name" as $expectedRole',
    async ({ name, expectedRole }) => {
      const storage = createMockStorage({
        getCircuitInstances: vi.fn().mockResolvedValue([makeInstance(1, 'R1')]),
        getCircuitNets: vi.fn().mockResolvedValue([makeNet(1, name, 'signal')]),
        getCircuitWires: vi.fn().mockResolvedValue([]),
      });
      const ctx = createCtx({ storage });
      const result = await registry.execute('suggest_testbench', { circuitDesignId: 1 }, ctx);

      expect(result.success).toBe(true);
      const nets = (result.data as Record<string, unknown>).nets as Array<{ name: string; role: string }>;
      expect(nets[0].role).toBe(expectedRole);
    },
  );
});

// ---------------------------------------------------------------------------
// 9. Instance classification edge cases
// ---------------------------------------------------------------------------

describe('Instance classification patterns', () => {
  const registry = createRegistry();

  const instanceCases = [
    { refDes: 'V1', expectedRole: 'source' },
    { refDes: 'I1', expectedRole: 'source' },
    { refDes: 'R1', expectedRole: 'passive' },
    { refDes: 'C1', expectedRole: 'passive' },
    { refDes: 'L1', expectedRole: 'passive' },
    { refDes: 'U1', expectedRole: 'active' },
    { refDes: 'Q1', expectedRole: 'active' },
    { refDes: 'D1', expectedRole: 'active' },
    { refDes: 'J1', expectedRole: 'connector' },
    { refDes: 'P1', expectedRole: 'connector' },
  ];

  it.each(instanceCases)(
    'classifies instance "$refDes" as $expectedRole',
    async ({ refDes, expectedRole }) => {
      const storage = createMockStorage({
        getCircuitInstances: vi.fn().mockResolvedValue([makeInstance(1, refDes)]),
        getCircuitNets: vi.fn().mockResolvedValue([makeNet(1, 'NET1', null)]),
        getCircuitWires: vi.fn().mockResolvedValue([]),
      });
      const ctx = createCtx({ storage });
      const result = await registry.execute('suggest_testbench', { circuitDesignId: 1 }, ctx);

      expect(result.success).toBe(true);
      const instances = (result.data as Record<string, unknown>).instances as Array<{ refDes: string; role: string }>;
      expect(instances[0].role).toBe(expectedRole);
    },
  );
});

// ---------------------------------------------------------------------------
// 10. Anthropic / Gemini format conversion
// ---------------------------------------------------------------------------

describe('getAll includes testbench tools', () => {
  const registry = createRegistry();

  it('getAll includes all 3 testbench tools', () => {
    const tools = registry.getAll();
    expect(tools).toHaveLength(3);
    const names = tools.map((t: { name: string }) => t.name);
    expect(names).toContain('suggest_testbench');
    expect(names).toContain('explain_test_point');
    expect(names).toContain('generate_test_sequence');
  });

  it('all tools have parameters and description', () => {
    const tools = registry.getAll();
    for (const tool of tools) {
      expect(tool.parameters).toBeDefined();
      expect(tool.description).toBeDefined();
    }
  });
});
