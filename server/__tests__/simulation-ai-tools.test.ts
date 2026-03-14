import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolRegistry } from '../ai-tools/registry';
import { registerSimulationTools } from '../ai-tools/simulation';
import type { ToolContext } from '../ai-tools/types';
import type { IStorage } from '../storage';
import type {
  CircuitDesignRow,
  CircuitInstanceRow,
  SimulationResultRow,
  SimulationScenario,
} from '@shared/schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registerSimulationTools(registry);
  return registry;
}

const now = new Date();

function makeCircuitDesign(overrides: Partial<CircuitDesignRow> = {}): CircuitDesignRow {
  return {
    id: 1,
    projectId: 1,
    name: 'Main Circuit',
    description: null,
    parentDesignId: null,
    settings: {},
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as CircuitDesignRow;
}

function makeCircuitInstance(overrides: Partial<CircuitInstanceRow> = {}): CircuitInstanceRow {
  return {
    id: 1,
    circuitId: 1,
    partId: null,
    subDesignId: null,
    referenceDesignator: 'R1',
    schematicX: 100,
    schematicY: 100,
    schematicRotation: 0,
    breadboardX: null,
    breadboardY: null,
    breadboardRotation: 0,
    pcbX: null,
    pcbY: null,
    pcbRotation: 0,
    pcbSide: 'front',
    properties: {},
    createdAt: now,
    ...overrides,
  };
}

function makeSimulationResult(overrides: Partial<SimulationResultRow> = {}): SimulationResultRow {
  return {
    id: 1,
    circuitId: 1,
    analysisType: 'dc',
    config: {},
    results: { nodeVoltages: { V1: 5.0 } },
    status: 'completed',
    engineUsed: 'mna-solver',
    elapsedMs: 42,
    sizeBytes: 256,
    error: null,
    createdAt: now,
    ...overrides,
  };
}

function makeSimulationScenario(overrides: Partial<SimulationScenario> = {}): SimulationScenario {
  return {
    id: 1,
    projectId: 1,
    circuitId: 1,
    name: 'DC Steady State',
    description: null,
    config: { analysisType: 'dc' },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

interface MockStorageData {
  design?: CircuitDesignRow | undefined;
  instances?: CircuitInstanceRow[];
  simResults?: SimulationResultRow[];
  scenario?: SimulationScenario;
}

function createMockStorage(data: MockStorageData = {}): IStorage {
  return {
    getCircuitDesign: vi.fn().mockResolvedValue('design' in data ? data.design : makeCircuitDesign()),
    getCircuitInstances: vi.fn().mockResolvedValue(data.instances ?? [makeCircuitInstance()]),
    getSimulationResults: vi.fn().mockResolvedValue(data.simResults ?? []),
    createSimulationScenario: vi.fn().mockResolvedValue(data.scenario ?? makeSimulationScenario()),
  } as unknown as IStorage;
}

function createCtx(storage?: IStorage, projectId = 1): ToolContext {
  return {
    projectId,
    storage: storage ?? createMockStorage(),
    confirmed: true,
  };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

describe('Simulation tools — registration', () => {
  const registry = createRegistry();

  const expectedTools = [
    'run_dc_analysis',
    'run_ac_analysis',
    'run_transient',
    'get_sim_results',
    'set_sim_parameters',
  ];

  it.each(expectedTools)('registers "%s"', (name) => {
    expect(registry.get(name)).toBeDefined();
  });

  it('all simulation tools have category "simulation"', () => {
    const simTools = registry.getByCategory('simulation');
    expect(simTools.length).toBe(expectedTools.length);
    for (const tool of simTools) {
      expect(tool.category).toBe('simulation');
    }
  });

  it('no simulation tools require confirmation', () => {
    const destructive = registry.getDestructiveTools();
    for (const name of expectedTools) {
      expect(destructive).not.toContain(name);
    }
  });
});

// ---------------------------------------------------------------------------
// Parameter validation
// ---------------------------------------------------------------------------

describe('Simulation tools — parameter validation', () => {
  const registry = createRegistry();

  describe('run_dc_analysis', () => {
    it('accepts valid circuitDesignId', () => {
      const result = registry.validate('run_dc_analysis', { circuitDesignId: 1 });
      expect(result.ok).toBe(true);
    });

    it('rejects missing circuitDesignId', () => {
      const result = registry.validate('run_dc_analysis', {});
      expect(result.ok).toBe(false);
    });

    it('rejects non-positive circuitDesignId', () => {
      const result = registry.validate('run_dc_analysis', { circuitDesignId: 0 });
      expect(result.ok).toBe(false);
    });

    it('rejects non-integer circuitDesignId', () => {
      const result = registry.validate('run_dc_analysis', { circuitDesignId: 1.5 });
      expect(result.ok).toBe(false);
    });
  });

  describe('run_ac_analysis', () => {
    it('accepts valid params with defaults', () => {
      const result = registry.validate('run_ac_analysis', { circuitDesignId: 1 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.params.startFreq).toBe(1);
        expect(result.params.stopFreq).toBe(1e6);
        expect(result.params.points).toBe(100);
      }
    });

    it('accepts custom frequency range', () => {
      const result = registry.validate('run_ac_analysis', {
        circuitDesignId: 1,
        startFreq: 100,
        stopFreq: 1e9,
        points: 500,
      });
      expect(result.ok).toBe(true);
    });

    it('rejects points exceeding max', () => {
      const result = registry.validate('run_ac_analysis', {
        circuitDesignId: 1,
        points: 20000,
      });
      expect(result.ok).toBe(false);
    });

    it('rejects non-positive startFreq', () => {
      const result = registry.validate('run_ac_analysis', {
        circuitDesignId: 1,
        startFreq: -10,
      });
      expect(result.ok).toBe(false);
    });
  });

  describe('run_transient', () => {
    it('accepts valid params with defaults', () => {
      const result = registry.validate('run_transient', { circuitDesignId: 1 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.params.duration).toBe(0.01);
        expect(result.params.timestep).toBe(1e-5);
      }
    });

    it('accepts custom duration and timestep', () => {
      const result = registry.validate('run_transient', {
        circuitDesignId: 1,
        duration: 1.0,
        timestep: 1e-4,
      });
      expect(result.ok).toBe(true);
    });

    it('rejects duration exceeding max', () => {
      const result = registry.validate('run_transient', {
        circuitDesignId: 1,
        duration: 100,
      });
      expect(result.ok).toBe(false);
    });

    it('rejects non-positive timestep', () => {
      const result = registry.validate('run_transient', {
        circuitDesignId: 1,
        timestep: -0.001,
      });
      expect(result.ok).toBe(false);
    });
  });

  describe('get_sim_results', () => {
    it('accepts circuitDesignId only', () => {
      const result = registry.validate('get_sim_results', { circuitDesignId: 1 });
      expect(result.ok).toBe(true);
    });

    it('accepts with analysisType filter', () => {
      const result = registry.validate('get_sim_results', {
        circuitDesignId: 1,
        analysisType: 'ac',
      });
      expect(result.ok).toBe(true);
    });

    it('rejects invalid analysisType', () => {
      const result = registry.validate('get_sim_results', {
        circuitDesignId: 1,
        analysisType: 'invalid',
      });
      expect(result.ok).toBe(false);
    });
  });

  describe('set_sim_parameters', () => {
    it('accepts valid scenario config', () => {
      const result = registry.validate('set_sim_parameters', {
        circuitDesignId: 1,
        name: 'My Scenario',
        parameters: { analysisType: 'dc' },
      });
      expect(result.ok).toBe(true);
    });

    it('accepts AC scenario with frequency range', () => {
      const result = registry.validate('set_sim_parameters', {
        circuitDesignId: 1,
        name: 'Filter Sweep',
        description: 'Low-pass filter frequency response',
        parameters: {
          analysisType: 'ac',
          startFreq: 10,
          stopFreq: 100000,
          points: 200,
        },
      });
      expect(result.ok).toBe(true);
    });

    it('rejects empty name', () => {
      const result = registry.validate('set_sim_parameters', {
        circuitDesignId: 1,
        name: '',
        parameters: { analysisType: 'dc' },
      });
      expect(result.ok).toBe(false);
    });

    it('rejects missing parameters', () => {
      const result = registry.validate('set_sim_parameters', {
        circuitDesignId: 1,
        name: 'Test',
      });
      expect(result.ok).toBe(false);
    });

    it('rejects invalid analysisType in parameters', () => {
      const result = registry.validate('set_sim_parameters', {
        circuitDesignId: 1,
        name: 'Test',
        parameters: { analysisType: 'magic' },
      });
      expect(result.ok).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Execution — run_dc_analysis
// ---------------------------------------------------------------------------

describe('run_dc_analysis — execution', () => {
  const registry = createRegistry();

  it('dispatches client action for valid circuit', async () => {
    const storage = createMockStorage();
    const ctx = createCtx(storage);
    const result = await registry.execute('run_dc_analysis', { circuitDesignId: 1 }, ctx);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(
      expect.objectContaining({ type: 'run_dc_analysis', analysisType: 'dc', circuitDesignId: 1 }),
    );
  });

  it('fails when circuit not found', async () => {
    const storage = createMockStorage({ design: undefined });
    const ctx = createCtx(storage);
    const result = await registry.execute('run_dc_analysis', { circuitDesignId: 999 }, ctx);
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('fails when circuit belongs to different project', async () => {
    const storage = createMockStorage({ design: makeCircuitDesign({ projectId: 2 }) });
    const ctx = createCtx(storage, 1);
    const result = await registry.execute('run_dc_analysis', { circuitDesignId: 1 }, ctx);
    expect(result.success).toBe(false);
    expect(result.message).toContain('does not belong');
  });

  it('fails when circuit has no components', async () => {
    const storage = createMockStorage({ instances: [] });
    const ctx = createCtx(storage);
    const result = await registry.execute('run_dc_analysis', { circuitDesignId: 1 }, ctx);
    expect(result.success).toBe(false);
    expect(result.message).toContain('no components');
  });
});

// ---------------------------------------------------------------------------
// Execution — run_ac_analysis
// ---------------------------------------------------------------------------

describe('run_ac_analysis — execution', () => {
  const registry = createRegistry();

  it('dispatches client action with frequency params', async () => {
    const storage = createMockStorage();
    const ctx = createCtx(storage);
    const result = await registry.execute(
      'run_ac_analysis',
      { circuitDesignId: 1, startFreq: 100, stopFreq: 1e6, points: 200 },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.data).toEqual(
      expect.objectContaining({
        type: 'run_ac_analysis',
        analysisType: 'ac',
        startFreq: 100,
        stopFreq: 1e6,
        points: 200,
      }),
    );
  });

  it('fails when circuit not found', async () => {
    const storage = createMockStorage({ design: undefined });
    const ctx = createCtx(storage);
    const result = await registry.execute('run_ac_analysis', { circuitDesignId: 999 }, ctx);
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('fails when circuit belongs to different project', async () => {
    const storage = createMockStorage({ design: makeCircuitDesign({ projectId: 5 }) });
    const ctx = createCtx(storage, 1);
    const result = await registry.execute('run_ac_analysis', { circuitDesignId: 1 }, ctx);
    expect(result.success).toBe(false);
    expect(result.message).toContain('does not belong');
  });

  it('fails when circuit has no components', async () => {
    const storage = createMockStorage({ instances: [] });
    const ctx = createCtx(storage);
    const result = await registry.execute('run_ac_analysis', { circuitDesignId: 1 }, ctx);
    expect(result.success).toBe(false);
    expect(result.message).toContain('no components');
  });

  it('fails when startFreq >= stopFreq', async () => {
    const storage = createMockStorage();
    const ctx = createCtx(storage);
    const result = await registry.execute(
      'run_ac_analysis',
      { circuitDesignId: 1, startFreq: 1e6, stopFreq: 100 },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain('Start frequency must be less than stop frequency');
  });

  it('fails when startFreq equals stopFreq', async () => {
    const storage = createMockStorage();
    const ctx = createCtx(storage);
    const result = await registry.execute(
      'run_ac_analysis',
      { circuitDesignId: 1, startFreq: 1000, stopFreq: 1000 },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain('Start frequency must be less than stop frequency');
  });
});

// ---------------------------------------------------------------------------
// Execution — run_transient
// ---------------------------------------------------------------------------

describe('run_transient — execution', () => {
  const registry = createRegistry();

  it('dispatches client action with transient params', async () => {
    const storage = createMockStorage();
    const ctx = createCtx(storage);
    const result = await registry.execute(
      'run_transient',
      { circuitDesignId: 1, duration: 0.1, timestep: 1e-4 },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.data).toEqual(
      expect.objectContaining({
        type: 'run_transient',
        analysisType: 'transient',
        duration: 0.1,
        timestep: 1e-4,
      }),
    );
  });

  it('fails when circuit not found', async () => {
    const storage = createMockStorage({ design: undefined });
    const ctx = createCtx(storage);
    const result = await registry.execute('run_transient', { circuitDesignId: 999 }, ctx);
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('fails when circuit belongs to different project', async () => {
    const storage = createMockStorage({ design: makeCircuitDesign({ projectId: 3 }) });
    const ctx = createCtx(storage, 1);
    const result = await registry.execute('run_transient', { circuitDesignId: 1 }, ctx);
    expect(result.success).toBe(false);
    expect(result.message).toContain('does not belong');
  });

  it('fails when circuit has no components', async () => {
    const storage = createMockStorage({ instances: [] });
    const ctx = createCtx(storage);
    const result = await registry.execute('run_transient', { circuitDesignId: 1 }, ctx);
    expect(result.success).toBe(false);
    expect(result.message).toContain('no components');
  });

  it('fails when timestep >= duration', async () => {
    const storage = createMockStorage();
    const ctx = createCtx(storage);
    const result = await registry.execute(
      'run_transient',
      { circuitDesignId: 1, duration: 0.001, timestep: 0.01 },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain('Timestep must be smaller than the simulation duration');
  });

  it('fails when timestep equals duration', async () => {
    const storage = createMockStorage();
    const ctx = createCtx(storage);
    const result = await registry.execute(
      'run_transient',
      { circuitDesignId: 1, duration: 0.01, timestep: 0.01 },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain('Timestep must be smaller than the simulation duration');
  });
});

// ---------------------------------------------------------------------------
// Execution — get_sim_results
// ---------------------------------------------------------------------------

describe('get_sim_results — execution', () => {
  const registry = createRegistry();

  it('returns stored results', async () => {
    const simResults = [
      makeSimulationResult({ id: 1, analysisType: 'dc' }),
      makeSimulationResult({ id: 2, analysisType: 'ac' }),
    ];
    const storage = createMockStorage({ simResults });
    const ctx = createCtx(storage);
    const result = await registry.execute('get_sim_results', { circuitDesignId: 1 }, ctx);
    expect(result.success).toBe(true);
    expect(result.message).toContain('2 simulation result(s)');
    expect((result.data as { results: unknown[] }).results).toHaveLength(2);
  });

  it('filters by analysisType', async () => {
    const simResults = [
      makeSimulationResult({ id: 1, analysisType: 'dc' }),
      makeSimulationResult({ id: 2, analysisType: 'ac' }),
      makeSimulationResult({ id: 3, analysisType: 'dc' }),
    ];
    const storage = createMockStorage({ simResults });
    const ctx = createCtx(storage);
    const result = await registry.execute(
      'get_sim_results',
      { circuitDesignId: 1, analysisType: 'dc' },
      ctx,
    );
    expect(result.success).toBe(true);
    expect((result.data as { results: unknown[] }).results).toHaveLength(2);
  });

  it('returns empty message when no results', async () => {
    const storage = createMockStorage({ simResults: [] });
    const ctx = createCtx(storage);
    const result = await registry.execute('get_sim_results', { circuitDesignId: 1 }, ctx);
    expect(result.success).toBe(true);
    expect(result.message).toContain('No simulation results');
    expect((result.data as { results: unknown[] }).results).toHaveLength(0);
  });

  it('includes type in empty message when filtered', async () => {
    const storage = createMockStorage({ simResults: [] });
    const ctx = createCtx(storage);
    const result = await registry.execute(
      'get_sim_results',
      { circuitDesignId: 1, analysisType: 'transient' },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.message).toContain('of type "transient"');
  });

  it('fails when circuit not found', async () => {
    const storage = createMockStorage({ design: undefined });
    const ctx = createCtx(storage);
    const result = await registry.execute('get_sim_results', { circuitDesignId: 999 }, ctx);
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('fails when circuit belongs to different project', async () => {
    const storage = createMockStorage({ design: makeCircuitDesign({ projectId: 7 }) });
    const ctx = createCtx(storage, 1);
    const result = await registry.execute('get_sim_results', { circuitDesignId: 1 }, ctx);
    expect(result.success).toBe(false);
    expect(result.message).toContain('does not belong');
  });

  it('includes result metadata in response', async () => {
    const simResults = [
      makeSimulationResult({
        id: 5,
        analysisType: 'transient',
        engineUsed: 'trap-integration',
        elapsedMs: 150,
        status: 'completed',
      }),
    ];
    const storage = createMockStorage({ simResults });
    const ctx = createCtx(storage);
    const result = await registry.execute('get_sim_results', { circuitDesignId: 1 }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as { results: Array<Record<string, unknown>> };
    expect(data.results[0]).toEqual(
      expect.objectContaining({
        id: 5,
        analysisType: 'transient',
        engineUsed: 'trap-integration',
        elapsedMs: 150,
        status: 'completed',
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Execution — set_sim_parameters
// ---------------------------------------------------------------------------

describe('set_sim_parameters — execution', () => {
  const registry = createRegistry();

  it('creates a simulation scenario', async () => {
    const scenario = makeSimulationScenario({ id: 42, name: 'Custom Sweep' });
    const storage = createMockStorage({ scenario });
    const ctx = createCtx(storage);
    const result = await registry.execute(
      'set_sim_parameters',
      {
        circuitDesignId: 1,
        name: 'Custom Sweep',
        parameters: { analysisType: 'ac', startFreq: 10, stopFreq: 1e6 },
      },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.message).toContain('Custom Sweep');
    expect(result.message).toContain('42');
    expect((result.data as { scenarioId: number }).scenarioId).toBe(42);
  });

  it('passes correct data to storage', async () => {
    const storage = createMockStorage();
    const ctx = createCtx(storage);
    await registry.execute(
      'set_sim_parameters',
      {
        circuitDesignId: 1,
        name: 'DC Check',
        description: 'Quick DC check',
        parameters: { analysisType: 'dc' },
      },
      ctx,
    );
    expect(storage.createSimulationScenario).toHaveBeenCalledWith({
      projectId: 1,
      circuitId: 1,
      name: 'DC Check',
      description: 'Quick DC check',
      config: { analysisType: 'dc' },
    });
  });

  it('sets description to null when omitted', async () => {
    const storage = createMockStorage();
    const ctx = createCtx(storage);
    await registry.execute(
      'set_sim_parameters',
      {
        circuitDesignId: 1,
        name: 'No Desc',
        parameters: { analysisType: 'transient', duration: 0.1 },
      },
      ctx,
    );
    expect(storage.createSimulationScenario).toHaveBeenCalledWith(
      expect.objectContaining({ description: null }),
    );
  });

  it('fails when circuit not found', async () => {
    const storage = createMockStorage({ design: undefined });
    const ctx = createCtx(storage);
    const result = await registry.execute(
      'set_sim_parameters',
      {
        circuitDesignId: 999,
        name: 'Test',
        parameters: { analysisType: 'dc' },
      },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('fails when circuit belongs to different project', async () => {
    const storage = createMockStorage({ design: makeCircuitDesign({ projectId: 10 }) });
    const ctx = createCtx(storage, 1);
    const result = await registry.execute(
      'set_sim_parameters',
      {
        circuitDesignId: 1,
        name: 'Test',
        parameters: { analysisType: 'dc' },
      },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain('does not belong');
  });
});
