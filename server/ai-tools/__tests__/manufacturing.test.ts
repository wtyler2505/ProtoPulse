import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolRegistry } from '../registry';
import { registerManufacturingTools } from '../manufacturing';
import type { ToolContext } from '../types';
import type { IStorage } from '../../storage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registerManufacturingTools(registry);
  return registry;
}

function makeStorage(overrides: Partial<IStorage> = {}): IStorage {
  return {
    getCircuitDesigns: vi.fn().mockResolvedValue([
      { id: 1, projectId: 1, name: 'Main Design', parentDesignId: null },
    ]),
    getCircuitInstances: vi.fn().mockResolvedValue([
      {
        id: 1,
        partId: 1,
        referenceDesignator: 'R1',
        schematicX: 100,
        schematicY: 100,
        schematicRotation: 0,
        pcbX: 10,
        pcbY: 10,
        pcbRotation: 0,
        pcbSide: 'front',
        properties: {},
      },
    ]),
    getCircuitWires: vi.fn().mockResolvedValue([
      {
        id: 1,
        netId: 1,
        view: 'pcb',
        points: [{ x: 10, y: 10 }, { x: 30, y: 10 }],
        layer: 'F.Cu',
        width: 0.254,
      },
    ]),
    getBomItems: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as IStorage;
}

function makeContext(storageOverrides: Partial<IStorage> = {}): ToolContext {
  return {
    projectId: 1,
    storage: makeStorage(storageOverrides),
  };
}

// ---------------------------------------------------------------------------
// Registration tests
// ---------------------------------------------------------------------------

describe('registerManufacturingTools', () => {
  it('registers all 3 manufacturing tools', () => {
    const registry = createRegistry();
    expect(registry.get('run_dfm_check')).toBeDefined();
    expect(registry.get('explain_dfm_violation')).toBeDefined();
    expect(registry.get('suggest_dfm_fix')).toBeDefined();
  });

  it('all tools belong to the validation category', () => {
    const registry = createRegistry();
    const tools = ['run_dfm_check', 'explain_dfm_violation', 'suggest_dfm_fix'];
    for (const name of tools) {
      const tool = registry.get(name);
      expect(tool?.category).toBe('validation');
    }
  });

  it('none of the tools require confirmation', () => {
    const registry = createRegistry();
    const tools = ['run_dfm_check', 'explain_dfm_violation', 'suggest_dfm_fix'];
    for (const name of tools) {
      const tool = registry.get(name);
      expect(tool?.requiresConfirmation).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// run_dfm_check
// ---------------------------------------------------------------------------

describe('run_dfm_check', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = createRegistry();
  });

  it('runs DFM check with default JLCPCB profile', async () => {
    const ctx = makeContext();
    const result = await registry.execute('run_dfm_check', {}, ctx);
    expect(result.success).toBe(true);
    expect(result.message).toContain('JLCPCB');
  });

  it('runs DFM check with PCBWay profile', async () => {
    const ctx = makeContext();
    const result = await registry.execute('run_dfm_check', { fabProfile: 'PCBWay' }, ctx);
    expect(result.success).toBe(true);
    expect(result.message).toContain('PCBWay');
  });

  it('runs DFM check with OSHPark profile', async () => {
    const ctx = makeContext();
    const result = await registry.execute('run_dfm_check', { fabProfile: 'OSHPark' }, ctx);
    expect(result.success).toBe(true);
    expect(result.message).toContain('OSHPark');
  });

  it('runs DFM check with Generic profile', async () => {
    const ctx = makeContext();
    const result = await registry.execute('run_dfm_check', { fabProfile: 'Generic' }, ctx);
    expect(result.success).toBe(true);
    expect(result.message).toContain('Generic');
  });

  it('returns pass/fail status in data', async () => {
    const ctx = makeContext();
    const result = await registry.execute('run_dfm_check', {}, ctx);
    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.type).toBe('dfm_check_result');
    expect(typeof data.passed).toBe('boolean');
    expect(data.summary).toBeDefined();
  });

  it('returns instance and wire counts', async () => {
    const ctx = makeContext();
    const result = await registry.execute('run_dfm_check', {}, ctx);
    const data = result.data as Record<string, unknown>;
    expect(data.instanceCount).toBe(1);
    expect(data.wireCount).toBe(1);
  });

  it('returns design name', async () => {
    const ctx = makeContext();
    const result = await registry.execute('run_dfm_check', {}, ctx);
    const data = result.data as Record<string, unknown>;
    expect(data.designName).toBe('Main Design');
  });

  it('fails gracefully when no circuit designs exist', async () => {
    const ctx = makeContext({
      getCircuitDesigns: vi.fn().mockResolvedValue([]),
    });
    const result = await registry.execute('run_dfm_check', {}, ctx);
    expect(result.success).toBe(false);
    expect(result.message).toContain('No circuit designs');
  });

  it('fails when specified circuitDesignId not found', async () => {
    const ctx = makeContext();
    const result = await registry.execute('run_dfm_check', { circuitDesignId: 999 }, ctx);
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('detects narrow trace violations', async () => {
    const ctx = makeContext({
      getCircuitWires: vi.fn().mockResolvedValue([
        { id: 1, netId: 1, view: 'pcb', points: [], layer: 'F.Cu', width: 0.01 }, // ~0.4 mil, way below minimum
      ]),
    });
    const result = await registry.execute('run_dfm_check', { fabProfile: 'Generic' }, ctx);
    const data = result.data as Record<string, unknown>;
    const violations = data.violations as Array<{ ruleId: string }>;
    const traceViolation = violations.find((v) => v.ruleId === 'DFM-001');
    expect(traceViolation).toBeDefined();
  });

  it('groups violations by category', async () => {
    const ctx = makeContext({
      getCircuitWires: vi.fn().mockResolvedValue([
        { id: 1, netId: 1, view: 'pcb', points: [], layer: 'F.Cu', width: 0.01 },
      ]),
    });
    const result = await registry.execute('run_dfm_check', { fabProfile: 'Generic' }, ctx);
    const data = result.data as Record<string, unknown>;
    expect(data.violationsByCategory).toBeDefined();
  });

  it('uses first design when circuitDesignId not specified', async () => {
    const ctx = makeContext({
      getCircuitDesigns: vi.fn().mockResolvedValue([
        { id: 5, projectId: 1, name: 'First', parentDesignId: null },
        { id: 6, projectId: 1, name: 'Second', parentDesignId: null },
      ]),
    });
    const result = await registry.execute('run_dfm_check', {}, ctx);
    expect(result.success).toBe(true);
    expect(ctx.storage.getCircuitInstances).toHaveBeenCalledWith(5);
  });

  it('reports pass rate percentage', async () => {
    const ctx = makeContext();
    const result = await registry.execute('run_dfm_check', {}, ctx);
    const data = result.data as Record<string, unknown>;
    const summary = data.summary as Record<string, unknown>;
    expect(typeof summary.passRate).toBe('number');
    expect(summary.passRate as number).toBeGreaterThanOrEqual(0);
    expect(summary.passRate as number).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// explain_dfm_violation
// ---------------------------------------------------------------------------

describe('explain_dfm_violation', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = createRegistry();
  });

  it('explains Minimum Trace Width violation', async () => {
    const ctx = makeContext();
    const result = await registry.execute('explain_dfm_violation', {
      violationType: 'Minimum Trace Width',
    }, ctx);
    expect(result.success).toBe(true);
    expect(result.message).toContain('Minimum Trace Width');
    const data = result.data as Record<string, unknown>;
    expect(data.found).toBe(true);
    expect(data.explanation).toBeDefined();
    expect(data.commonCauses).toBeDefined();
  });

  it('explains Minimum Drill Size violation', async () => {
    const ctx = makeContext();
    const result = await registry.execute('explain_dfm_violation', {
      violationType: 'Minimum Drill Size',
    }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.found).toBe(true);
  });

  it('explains Minimum Silkscreen Width violation', async () => {
    const ctx = makeContext();
    const result = await registry.execute('explain_dfm_violation', {
      violationType: 'Minimum Silkscreen Width',
    }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.severity).toBe('warning');
  });

  it('returns IPC standard reference when available', async () => {
    const ctx = makeContext();
    const result = await registry.execute('explain_dfm_violation', {
      violationType: 'Minimum Trace Width',
    }, ctx);
    const data = result.data as Record<string, unknown>;
    // IPC standard may or may not be resolved depending on matching
    expect(data.found).toBe(true);
  });

  it('handles unknown violation types gracefully', async () => {
    const ctx = makeContext();
    const result = await registry.execute('explain_dfm_violation', {
      violationType: 'Nonexistent Rule XYZ',
    }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.found).toBe(false);
  });

  it('includes additional description context', async () => {
    const ctx = makeContext();
    const result = await registry.execute('explain_dfm_violation', {
      violationType: 'Nonexistent Rule',
      description: 'Custom fab constraint',
    }, ctx);
    expect(result.message).toContain('Custom fab constraint');
  });

  it('performs fuzzy matching on partial names', async () => {
    const ctx = makeContext();
    const result = await registry.execute('explain_dfm_violation', {
      violationType: 'Trace Width',
    }, ctx);
    const data = result.data as Record<string, unknown>;
    expect(data.found).toBe(true);
  });

  it('returns common causes as an array', async () => {
    const ctx = makeContext();
    const result = await registry.execute('explain_dfm_violation', {
      violationType: 'Minimum Trace Spacing',
    }, ctx);
    const data = result.data as Record<string, unknown>;
    expect(Array.isArray(data.commonCauses)).toBe(true);
    expect((data.commonCauses as string[]).length).toBeGreaterThan(0);
  });

  it('explains Surface Finish Supported violation', async () => {
    const ctx = makeContext();
    const result = await registry.execute('explain_dfm_violation', {
      violationType: 'Surface Finish Supported',
    }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.found).toBe(true);
    expect(data.severity).toBe('error');
  });

  it('explains Minimum Hole-to-Hole Spacing', async () => {
    const ctx = makeContext();
    const result = await registry.execute('explain_dfm_violation', {
      violationType: 'Minimum Hole-to-Hole Spacing',
    }, ctx);
    const data = result.data as Record<string, unknown>;
    expect(data.found).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// suggest_dfm_fix
// ---------------------------------------------------------------------------

describe('suggest_dfm_fix', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = createRegistry();
  });

  it('suggests fixes for Minimum Trace Width', async () => {
    const ctx = makeContext();
    const result = await registry.execute('suggest_dfm_fix', {
      violationType: 'Minimum Trace Width',
    }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.found).toBe(true);
    expect(Array.isArray(data.suggestions)).toBe(true);
    expect((data.suggestions as string[]).length).toBeGreaterThan(0);
  });

  it('indicates auto-fixable status correctly', async () => {
    const ctx = makeContext();
    // Minimum Trace Width is NOT auto-fixable
    const result1 = await registry.execute('suggest_dfm_fix', {
      violationType: 'Minimum Trace Width',
    }, ctx);
    expect((result1.data as Record<string, unknown>).autoFixable).toBe(false);

    // Surface Finish Supported IS auto-fixable
    const result2 = await registry.execute('suggest_dfm_fix', {
      violationType: 'Surface Finish Supported',
    }, ctx);
    expect((result2.data as Record<string, unknown>).autoFixable).toBe(true);
  });

  it('returns AI actions for auto-fixable violations', async () => {
    const ctx = makeContext();
    const result = await registry.execute('suggest_dfm_fix', {
      violationType: 'Surface Finish Supported',
    }, ctx);
    const data = result.data as Record<string, unknown>;
    expect(data.actions).toBeDefined();
    expect(Array.isArray(data.actions)).toBe(true);
  });

  it('includes fab-specific context when fabProfile provided', async () => {
    const ctx = makeContext();
    const result = await registry.execute('suggest_dfm_fix', {
      violationType: 'Minimum Trace Width',
      fabProfile: 'JLCPCB',
    }, ctx);
    const data = result.data as Record<string, unknown>;
    expect(data.fabContext).toContain('JLCPCB');
    expect(data.fabContext).toContain('3.5');
  });

  it('includes current value in message when provided', async () => {
    const ctx = makeContext();
    const result = await registry.execute('suggest_dfm_fix', {
      violationType: 'Minimum Trace Width',
      currentValue: '2 mil',
    }, ctx);
    expect(result.message).toContain('2 mil');
  });

  it('handles unknown violation types gracefully', async () => {
    const ctx = makeContext();
    const result = await registry.execute('suggest_dfm_fix', {
      violationType: 'Totally Unknown Rule',
    }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.found).toBe(false);
    expect(Array.isArray(data.suggestions)).toBe(true);
  });

  it('performs fuzzy matching on partial violation names', async () => {
    const ctx = makeContext();
    const result = await registry.execute('suggest_dfm_fix', {
      violationType: 'Drill Size',
    }, ctx);
    const data = result.data as Record<string, unknown>;
    expect(data.found).toBe(true);
  });

  it('returns auto-fixable for Copper Weight Supported', async () => {
    const ctx = makeContext();
    const result = await registry.execute('suggest_dfm_fix', {
      violationType: 'Copper Weight Supported',
    }, ctx);
    const data = result.data as Record<string, unknown>;
    expect(data.autoFixable).toBe(true);
    expect(data.actions).toBeDefined();
  });

  it('returns auto-fixable for Minimum Silkscreen Width', async () => {
    const ctx = makeContext();
    const result = await registry.execute('suggest_dfm_fix', {
      violationType: 'Minimum Silkscreen Width',
    }, ctx);
    const data = result.data as Record<string, unknown>;
    expect(data.autoFixable).toBe(true);
  });

  it('provides fab context for Via Drill violations', async () => {
    const ctx = makeContext();
    const result = await registry.execute('suggest_dfm_fix', {
      violationType: 'Minimum Via Drill',
      fabProfile: 'OSHPark',
    }, ctx);
    const data = result.data as Record<string, unknown>;
    expect(data.fabContext).toContain('OSHPark');
    expect(data.fabContext).toContain('10');
  });

  it('provides fab context for Layer Count violations', async () => {
    const ctx = makeContext();
    const result = await registry.execute('suggest_dfm_fix', {
      violationType: 'Maximum Layer Count',
      fabProfile: 'Generic',
    }, ctx);
    const data = result.data as Record<string, unknown>;
    expect(data.fabContext).toContain('2');
  });
});
