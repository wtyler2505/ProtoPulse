import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolRegistry } from '../ai-tools/registry';
import { registerGenerativeTools } from '../ai-tools/generative';
import type { ToolContext } from '../ai-tools/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registerGenerativeTools(registry);
  return registry;
}

function mockContext(): ToolContext {
  return {
    projectId: 1,
    storage: {} as ToolContext['storage'],
  };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

describe('registerGenerativeTools', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = createRegistry();
  });

  it('registers generate_circuit_candidates tool', () => {
    expect(registry.get('generate_circuit_candidates')).toBeDefined();
  });

  it('registers explain_design_tradeoffs tool', () => {
    expect(registry.get('explain_design_tradeoffs')).toBeDefined();
  });

  it('both tools have category "circuit"', () => {
    const gen = registry.get('generate_circuit_candidates');
    const explain = registry.get('explain_design_tradeoffs');
    expect(gen?.category).toBe('circuit');
    expect(explain?.category).toBe('circuit');
  });

  it('neither tool requires confirmation', () => {
    const gen = registry.get('generate_circuit_candidates');
    const explain = registry.get('explain_design_tradeoffs');
    expect(gen?.requiresConfirmation).toBe(false);
    expect(explain?.requiresConfirmation).toBe(false);
  });

  it('throws on duplicate registration', () => {
    expect(() => registerGenerativeTools(registry)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// generate_circuit_candidates — validation
// ---------------------------------------------------------------------------

describe('generate_circuit_candidates validation', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = createRegistry();
  });

  it('validates valid input', () => {
    const result = registry.validate('generate_circuit_candidates', {
      description: 'LED driver for 12V',
      candidateCount: 4,
    });
    expect(result.ok).toBe(true);
  });

  it('rejects empty description', () => {
    const result = registry.validate('generate_circuit_candidates', {
      description: '',
      candidateCount: 4,
    });
    expect(result.ok).toBe(false);
  });

  it('applies default candidateCount when omitted', () => {
    const result = registry.validate('generate_circuit_candidates', {
      description: 'voltage regulator',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.params['candidateCount']).toBe(6);
    }
  });

  it('rejects candidateCount below 1', () => {
    const result = registry.validate('generate_circuit_candidates', {
      description: 'test',
      candidateCount: 0,
    });
    expect(result.ok).toBe(false);
  });

  it('accepts optional budget constraint', () => {
    const result = registry.validate('generate_circuit_candidates', {
      description: 'motor controller',
      budgetUsd: 50,
    });
    expect(result.ok).toBe(true);
  });

  it('accepts optional maxPowerWatts constraint', () => {
    const result = registry.validate('generate_circuit_candidates', {
      description: 'sensor board',
      maxPowerWatts: 2.5,
    });
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// generate_circuit_candidates — execution
// ---------------------------------------------------------------------------

describe('generate_circuit_candidates execution', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = createRegistry();
  });

  it('returns success with candidates', async () => {
    const result = await registry.execute(
      'generate_circuit_candidates',
      { description: 'LED driver for 12V, 350mA', candidateCount: 3 },
      mockContext(),
    );
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('returns CircuitIR-shaped candidates in data', async () => {
    const result = await registry.execute(
      'generate_circuit_candidates',
      { description: 'voltage divider', candidateCount: 2 },
      mockContext(),
    );
    expect(result.success).toBe(true);
    const data = result.data as { type: string; candidates: Array<{ meta: unknown; components: unknown[] }> };
    expect(data.type).toBe('generate_circuit_candidates');
    expect(data.candidates).toBeDefined();
    expect(data.candidates.length).toBe(2);
    for (const candidate of data.candidates) {
      expect(candidate.meta).toBeDefined();
      expect(candidate.components).toBeDefined();
    }
  });

  it('includes fitness scores in data', async () => {
    const result = await registry.execute(
      'generate_circuit_candidates',
      { description: 'power supply', candidateCount: 2 },
      mockContext(),
    );
    const data = result.data as { fitnessScores: Array<{ overall: number }> };
    expect(data.fitnessScores).toBeDefined();
    expect(data.fitnessScores.length).toBe(2);
    for (const score of data.fitnessScores) {
      expect(score.overall).toBeGreaterThanOrEqual(0);
      expect(score.overall).toBeLessThanOrEqual(1);
    }
  });

  it('respects budget constraint in scoring', async () => {
    const result = await registry.execute(
      'generate_circuit_candidates',
      { description: 'test circuit', candidateCount: 2, budgetUsd: 5 },
      mockContext(),
    );
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// explain_design_tradeoffs — validation
// ---------------------------------------------------------------------------

describe('explain_design_tradeoffs validation', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = createRegistry();
  });

  it('validates valid input', () => {
    const result = registry.validate('explain_design_tradeoffs', {
      candidates: [
        {
          name: 'Design A',
          componentCount: 5,
          estimatedCost: 10.5,
          fitnessScore: 0.85,
        },
      ],
    });
    expect(result.ok).toBe(true);
  });

  it('rejects empty candidates array', () => {
    const result = registry.validate('explain_design_tradeoffs', {
      candidates: [],
    });
    expect(result.ok).toBe(false);
  });

  it('rejects missing candidates', () => {
    const result = registry.validate('explain_design_tradeoffs', {});
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// explain_design_tradeoffs — execution
// ---------------------------------------------------------------------------

describe('explain_design_tradeoffs execution', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = createRegistry();
  });

  it('returns success with explanation', async () => {
    const result = await registry.execute(
      'explain_design_tradeoffs',
      {
        candidates: [
          { name: 'Design A', componentCount: 3, estimatedCost: 5.0, fitnessScore: 0.9 },
          { name: 'Design B', componentCount: 8, estimatedCost: 15.0, fitnessScore: 0.7 },
        ],
      },
      mockContext(),
    );
    expect(result.success).toBe(true);
    expect(result.message).toBeTruthy();
  });

  it('returns explanation data', async () => {
    const result = await registry.execute(
      'explain_design_tradeoffs',
      {
        candidates: [
          { name: 'Design A', componentCount: 3, estimatedCost: 5.0, fitnessScore: 0.9 },
        ],
      },
      mockContext(),
    );
    const data = result.data as { type: string; explanation: string };
    expect(data.type).toBe('explain_design_tradeoffs');
    expect(data.explanation).toBeTruthy();
  });

  it('mentions candidate names in explanation', async () => {
    const result = await registry.execute(
      'explain_design_tradeoffs',
      {
        candidates: [
          { name: 'Compact LED Driver', componentCount: 3, estimatedCost: 5.0, fitnessScore: 0.9 },
          { name: 'Full Featured Driver', componentCount: 10, estimatedCost: 25.0, fitnessScore: 0.6 },
        ],
      },
      mockContext(),
    );
    const data = result.data as { explanation: string };
    expect(data.explanation).toContain('Compact LED Driver');
    expect(data.explanation).toContain('Full Featured Driver');
  });
});
