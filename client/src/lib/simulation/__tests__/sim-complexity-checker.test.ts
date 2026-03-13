/**
 * Tests for sim-complexity-checker.ts (BL-0514)
 *
 * Coverage:
 *   - analyzeComplexity: various circuit sizes and compositions
 *   - checkThresholds: severity levels, custom thresholds
 *   - estimateTransientRuntime: accuracy and edge cases
 *   - getSimplificationSuggestions: deduplication and relevance
 *   - formatRuntimeEstimate: human-readable formatting
 *   - Edge cases: empty circuits, single node, all-nonlinear, huge circuits
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeComplexity,
  checkThresholds,
  estimateTransientRuntime,
  getSimplificationSuggestions,
  formatRuntimeEstimate,
  DEFAULT_THRESHOLDS,
} from '../sim-complexity-checker';
import type {
  CircuitComplexityMetrics,
  SimComplexityThresholds,
  TransientParams,
  ComplexityWarning,
} from '../sim-complexity-checker';
import type { SolverInput, SolverComponent } from '../circuit-solver';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResistor(id: string, n1: number, n2: number, value = 1000): SolverComponent {
  return { id, type: 'R', value, nodes: [n1, n2] };
}

function makeCapacitor(id: string, n1: number, n2: number, value = 1e-6): SolverComponent {
  return { id, type: 'C', value, nodes: [n1, n2] };
}

function makeInductor(id: string, n1: number, n2: number, value = 1e-3): SolverComponent {
  return { id, type: 'L', value, nodes: [n1, n2] };
}

function makeVoltageSource(id: string, n1: number, n2: number, value = 5): SolverComponent {
  return { id, type: 'V', value, nodes: [n1, n2] };
}

function makeCurrentSource(id: string, n1: number, n2: number, value = 0.01): SolverComponent {
  return { id, type: 'I', value, nodes: [n1, n2] };
}

function makeDiode(id: string, n1: number, n2: number): SolverComponent {
  return { id, type: 'D', value: 0, nodes: [n1, n2] };
}

function makeBJT(id: string, n1: number, n2: number): SolverComponent {
  return { id, type: 'Q', value: 0, nodes: [n1, n2], thirdNode: 0 };
}

function makeMOSFET(id: string, n1: number, n2: number): SolverComponent {
  return { id, type: 'M', value: 0, nodes: [n1, n2], thirdNode: 0 };
}

function makeInput(numNodes: number, components: SolverComponent[]): SolverInput {
  return { numNodes, components, groundNode: 0 };
}

/** Build a simple resistor-divider circuit with N stages. */
function makeResistorChain(stages: number): SolverInput {
  const components: SolverComponent[] = [
    makeVoltageSource('V1', 1, 0, 5),
  ];
  for (let i = 0; i < stages; i++) {
    components.push(makeResistor(`R${i + 1}`, i + 1, i + 2, 1000));
  }
  // Last node to ground
  components.push(makeResistor(`R${stages + 1}`, stages + 1, 0, 1000));
  return makeInput(stages + 1, components);
}

// ---------------------------------------------------------------------------
// analyzeComplexity
// ---------------------------------------------------------------------------

describe('analyzeComplexity', () => {
  it('returns correct metrics for a simple RC circuit', () => {
    const input = makeInput(2, [
      makeVoltageSource('V1', 1, 0, 5),
      makeResistor('R1', 1, 2, 1000),
      makeCapacitor('C1', 2, 0, 1e-6),
    ]);
    const metrics = analyzeComplexity(input);

    expect(metrics.nodeCount).toBe(2);
    expect(metrics.linearDeviceCount).toBe(2); // R + C
    expect(metrics.nonlinearDeviceCount).toBe(0);
    expect(metrics.netCount).toBe(2);
    expect(metrics.estimatedMatrixSize).toBe(3); // 2 nodes + 1 voltage source
    expect(metrics.coupledInductors).toBe(0);
    expect(metrics.transmissionLines).toBe(0);
  });

  it('counts nonlinear devices correctly', () => {
    const input = makeInput(4, [
      makeVoltageSource('V1', 1, 0),
      makeResistor('R1', 1, 2, 1000),
      makeDiode('D1', 2, 3),
      makeBJT('Q1', 3, 4),
      makeMOSFET('M1', 4, 0),
    ]);
    const metrics = analyzeComplexity(input);

    expect(metrics.nonlinearDeviceCount).toBe(3);
    expect(metrics.linearDeviceCount).toBe(1); // R only
  });

  it('counts inductors and voltage sources in matrix size', () => {
    const input = makeInput(3, [
      makeVoltageSource('V1', 1, 0),
      makeVoltageSource('V2', 2, 0),
      makeInductor('L1', 2, 3, 1e-3),
      makeResistor('R1', 3, 0, 100),
    ]);
    const metrics = analyzeComplexity(input);

    // Matrix = 3 nodes + 2 voltage sources + 1 inductor = 6
    expect(metrics.estimatedMatrixSize).toBe(6);
    expect(metrics.linearDeviceCount).toBe(2); // R + L
  });

  it('estimates memory for a DC analysis (no transient)', () => {
    const input = makeResistorChain(10);
    const metrics = analyzeComplexity(input);

    expect(metrics.estimatedMemoryMB).toBeGreaterThan(0);
    expect(metrics.estimatedMemoryMB).toBeLessThan(1); // Small circuit
  });

  it('estimates memory increases with transient parameters', () => {
    const input = makeResistorChain(10);
    const metricsDC = analyzeComplexity(input);
    const metricsTrans = analyzeComplexity(input, { timeSpan: 0.01, timeStep: 1e-5 });

    expect(metricsTrans.estimatedMemoryMB).toBeGreaterThan(metricsDC.estimatedMemoryMB);
  });

  it('returns runtime estimate for transient', () => {
    const input = makeResistorChain(10);
    const metrics = analyzeComplexity(input, { timeSpan: 0.01, timeStep: 1e-5 });

    expect(metrics.estimatedRuntimeMs).toBeGreaterThan(0);
  });

  it('returns runtime estimate for DC', () => {
    const input = makeResistorChain(5);
    const metrics = analyzeComplexity(input);

    expect(metrics.estimatedRuntimeMs).toBeGreaterThan(0);
  });

  it('nonlinear devices increase runtime estimate', () => {
    const linearInput = makeInput(5, [
      makeVoltageSource('V1', 1, 0),
      makeResistor('R1', 1, 2, 1000),
      makeResistor('R2', 2, 3, 1000),
      makeResistor('R3', 3, 4, 1000),
      makeResistor('R4', 4, 5, 1000),
      makeResistor('R5', 5, 0, 1000),
    ]);
    const nlInput = makeInput(5, [
      makeVoltageSource('V1', 1, 0),
      makeResistor('R1', 1, 2, 1000),
      makeDiode('D1', 2, 3),
      makeBJT('Q1', 3, 4),
      makeMOSFET('M1', 4, 5),
      makeResistor('R2', 5, 0, 1000),
    ]);

    const linearMetrics = analyzeComplexity(linearInput, { timeSpan: 0.001, timeStep: 1e-5 });
    const nlMetrics = analyzeComplexity(nlInput, { timeSpan: 0.001, timeStep: 1e-5 });

    expect(nlMetrics.estimatedRuntimeMs).toBeGreaterThan(linearMetrics.estimatedRuntimeMs);
  });

  it('passes through coupledInductors and transmissionLines', () => {
    const input = makeInput(2, [makeResistor('R1', 1, 2, 100)]);
    const metrics = analyzeComplexity(input, undefined, 3, 2);

    expect(metrics.coupledInductors).toBe(3);
    expect(metrics.transmissionLines).toBe(2);
  });

  it('handles transient with zero time step gracefully', () => {
    const input = makeResistorChain(5);
    const metrics = analyzeComplexity(input, { timeSpan: 0.01, timeStep: 0 });

    // Should not crash, memory should still be calculated for DC-like
    expect(metrics.estimatedMemoryMB).toBeGreaterThan(0);
    expect(metrics.estimatedRuntimeMs).toBeGreaterThanOrEqual(0);
  });

  it('larger circuits produce larger matrix sizes', () => {
    const small = analyzeComplexity(makeResistorChain(5));
    const large = analyzeComplexity(makeResistorChain(50));

    expect(large.estimatedMatrixSize).toBeGreaterThan(small.estimatedMatrixSize);
    expect(large.estimatedMemoryMB).toBeGreaterThan(small.estimatedMemoryMB);
  });
});

// ---------------------------------------------------------------------------
// checkThresholds
// ---------------------------------------------------------------------------

describe('checkThresholds', () => {
  it('returns empty warnings for a small simple circuit', () => {
    const metrics: CircuitComplexityMetrics = {
      nodeCount: 5,
      nonlinearDeviceCount: 0,
      linearDeviceCount: 5,
      netCount: 5,
      coupledInductors: 0,
      transmissionLines: 0,
      estimatedMatrixSize: 6,
      estimatedMemoryMB: 0.1,
      estimatedRuntimeMs: 10,
    };
    const warnings = checkThresholds(metrics);
    expect(warnings).toHaveLength(0);
  });

  it('warns when node count exceeds threshold', () => {
    const metrics: CircuitComplexityMetrics = {
      nodeCount: 60,
      nonlinearDeviceCount: 0,
      linearDeviceCount: 60,
      netCount: 60,
      coupledInductors: 0,
      transmissionLines: 0,
      estimatedMatrixSize: 61,
      estimatedMemoryMB: 1,
      estimatedRuntimeMs: 100,
    };
    const warnings = checkThresholds(metrics);

    expect(warnings.length).toBeGreaterThanOrEqual(1);
    const nodeWarning = warnings.find((w) => w.metric === 'nodeCount');
    expect(nodeWarning).toBeDefined();
    expect(nodeWarning!.value).toBe(60);
    expect(nodeWarning!.threshold).toBe(DEFAULT_THRESHOLDS.maxNodes);
  });

  it('warns when nonlinear device count exceeds threshold', () => {
    const metrics: CircuitComplexityMetrics = {
      nodeCount: 10,
      nonlinearDeviceCount: 25,
      linearDeviceCount: 5,
      netCount: 10,
      coupledInductors: 0,
      transmissionLines: 0,
      estimatedMatrixSize: 11,
      estimatedMemoryMB: 0.5,
      estimatedRuntimeMs: 500,
    };
    const warnings = checkThresholds(metrics);

    const nlWarning = warnings.find((w) => w.metric === 'nonlinearDeviceCount');
    expect(nlWarning).toBeDefined();
    expect(nlWarning!.value).toBe(25);
  });

  it('warns when matrix size exceeds threshold', () => {
    const metrics: CircuitComplexityMetrics = {
      nodeCount: 150,
      nonlinearDeviceCount: 0,
      linearDeviceCount: 200,
      netCount: 150,
      coupledInductors: 0,
      transmissionLines: 0,
      estimatedMatrixSize: 250,
      estimatedMemoryMB: 5,
      estimatedRuntimeMs: 2000,
    };
    const warnings = checkThresholds(metrics);

    const matrixWarning = warnings.find((w) => w.metric === 'estimatedMatrixSize');
    expect(matrixWarning).toBeDefined();
    expect(matrixWarning!.value).toBe(250);
  });

  it('warns when memory exceeds threshold', () => {
    const metrics: CircuitComplexityMetrics = {
      nodeCount: 30,
      nonlinearDeviceCount: 0,
      linearDeviceCount: 30,
      netCount: 30,
      coupledInductors: 0,
      transmissionLines: 0,
      estimatedMatrixSize: 31,
      estimatedMemoryMB: 150,
      estimatedRuntimeMs: 1000,
    };
    const warnings = checkThresholds(metrics);

    const memWarning = warnings.find((w) => w.metric === 'estimatedMemoryMB');
    expect(memWarning).toBeDefined();
    expect(memWarning!.level).not.toBe('info'); // 150/100 = 1.5 => 'warning'
  });

  it('assigns info level when ratio is between 1 and 1.5', () => {
    const metrics: CircuitComplexityMetrics = {
      nodeCount: 55, // 55/50 = 1.1 -> info
      nonlinearDeviceCount: 0,
      linearDeviceCount: 55,
      netCount: 55,
      coupledInductors: 0,
      transmissionLines: 0,
      estimatedMatrixSize: 56,
      estimatedMemoryMB: 0.5,
      estimatedRuntimeMs: 50,
    };
    const warnings = checkThresholds(metrics);

    const nodeWarning = warnings.find((w) => w.metric === 'nodeCount');
    expect(nodeWarning).toBeDefined();
    expect(nodeWarning!.level).toBe('info');
  });

  it('assigns warning level when ratio is between 1.5 and 3', () => {
    const metrics: CircuitComplexityMetrics = {
      nodeCount: 100, // 100/50 = 2.0 -> warning
      nonlinearDeviceCount: 0,
      linearDeviceCount: 100,
      netCount: 100,
      coupledInductors: 0,
      transmissionLines: 0,
      estimatedMatrixSize: 101,
      estimatedMemoryMB: 2,
      estimatedRuntimeMs: 500,
    };
    const warnings = checkThresholds(metrics);

    const nodeWarning = warnings.find((w) => w.metric === 'nodeCount');
    expect(nodeWarning).toBeDefined();
    expect(nodeWarning!.level).toBe('warning');
  });

  it('assigns danger level when ratio exceeds 3', () => {
    const metrics: CircuitComplexityMetrics = {
      nodeCount: 200, // 200/50 = 4.0 -> danger
      nonlinearDeviceCount: 0,
      linearDeviceCount: 200,
      netCount: 200,
      coupledInductors: 0,
      transmissionLines: 0,
      estimatedMatrixSize: 201,
      estimatedMemoryMB: 10,
      estimatedRuntimeMs: 5000,
    };
    const warnings = checkThresholds(metrics);

    const nodeWarning = warnings.find((w) => w.metric === 'nodeCount');
    expect(nodeWarning).toBeDefined();
    expect(nodeWarning!.level).toBe('danger');
  });

  it('warns for transient with small timestep and large span', () => {
    const metrics: CircuitComplexityMetrics = {
      nodeCount: 10,
      nonlinearDeviceCount: 0,
      linearDeviceCount: 10,
      netCount: 10,
      coupledInductors: 0,
      transmissionLines: 0,
      estimatedMatrixSize: 11,
      estimatedMemoryMB: 5,
      estimatedRuntimeMs: 10000,
    };
    const transient: TransientParams = {
      timeSpan: 0.1, // 100ms — exceeds 10ms threshold
      timeStep: 1e-7, // 0.1us — less than 1us
    };
    const warnings = checkThresholds(metrics, {}, transient);

    const transientWarning = warnings.find((w) => w.metric === 'transientSpan');
    expect(transientWarning).toBeDefined();
    expect(transientWarning!.message).toContain('time steps');
  });

  it('does not warn for transient with large timestep', () => {
    const metrics: CircuitComplexityMetrics = {
      nodeCount: 10,
      nonlinearDeviceCount: 0,
      linearDeviceCount: 10,
      netCount: 10,
      coupledInductors: 0,
      transmissionLines: 0,
      estimatedMatrixSize: 11,
      estimatedMemoryMB: 0.5,
      estimatedRuntimeMs: 100,
    };
    const transient: TransientParams = {
      timeSpan: 0.01,
      timeStep: 1e-4, // 100us — not less than 1us
    };
    const warnings = checkThresholds(metrics, {}, transient);

    const transientWarning = warnings.find((w) => w.metric === 'transientSpan');
    expect(transientWarning).toBeUndefined();
  });

  it('respects custom thresholds', () => {
    const metrics: CircuitComplexityMetrics = {
      nodeCount: 30,
      nonlinearDeviceCount: 10,
      linearDeviceCount: 20,
      netCount: 30,
      coupledInductors: 0,
      transmissionLines: 0,
      estimatedMatrixSize: 31,
      estimatedMemoryMB: 0.5,
      estimatedRuntimeMs: 100,
    };

    // Default thresholds: no warnings (30 < 50, 10 < 20)
    expect(checkThresholds(metrics)).toHaveLength(0);

    // Custom lower thresholds: should warn
    const custom: Partial<SimComplexityThresholds> = {
      maxNodes: 20,
      maxNonlinear: 5,
    };
    const warnings = checkThresholds(metrics, custom);
    expect(warnings.length).toBeGreaterThanOrEqual(2);
    expect(warnings.some((w) => w.metric === 'nodeCount')).toBe(true);
    expect(warnings.some((w) => w.metric === 'nonlinearDeviceCount')).toBe(true);
  });

  it('can produce multiple warnings simultaneously', () => {
    const metrics: CircuitComplexityMetrics = {
      nodeCount: 100,
      nonlinearDeviceCount: 50,
      linearDeviceCount: 50,
      netCount: 100,
      coupledInductors: 0,
      transmissionLines: 0,
      estimatedMatrixSize: 250,
      estimatedMemoryMB: 200,
      estimatedRuntimeMs: 50000,
    };
    const transient: TransientParams = { timeSpan: 0.1, timeStep: 1e-8 };
    const warnings = checkThresholds(metrics, {}, transient);

    expect(warnings.length).toBeGreaterThanOrEqual(4);
  });

  it('every warning has all required fields', () => {
    const metrics: CircuitComplexityMetrics = {
      nodeCount: 100,
      nonlinearDeviceCount: 50,
      linearDeviceCount: 50,
      netCount: 100,
      coupledInductors: 0,
      transmissionLines: 0,
      estimatedMatrixSize: 250,
      estimatedMemoryMB: 200,
      estimatedRuntimeMs: 50000,
    };
    const warnings = checkThresholds(metrics);

    for (const w of warnings) {
      expect(w.level).toMatch(/^(info|warning|danger)$/);
      expect(typeof w.metric).toBe('string');
      expect(typeof w.value).toBe('number');
      expect(typeof w.threshold).toBe('number');
      expect(w.message.length).toBeGreaterThan(0);
      expect(w.suggestion.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// estimateTransientRuntime
// ---------------------------------------------------------------------------

describe('estimateTransientRuntime', () => {
  it('returns 0 for zero timeStep', () => {
    expect(estimateTransientRuntime(10, 0.01, 0, 0)).toBe(0);
  });

  it('returns 0 for zero timeSpan', () => {
    expect(estimateTransientRuntime(10, 0, 1e-5, 0)).toBe(0);
  });

  it('returns positive value for valid inputs', () => {
    const result = estimateTransientRuntime(10, 0.001, 1e-5, 0);
    expect(result).toBeGreaterThan(0);
  });

  it('larger node count increases runtime', () => {
    const small = estimateTransientRuntime(5, 0.001, 1e-5, 0);
    const large = estimateTransientRuntime(50, 0.001, 1e-5, 0);
    expect(large).toBeGreaterThan(small);
  });

  it('more time steps increases runtime', () => {
    const short = estimateTransientRuntime(10, 0.001, 1e-5, 0);
    const long = estimateTransientRuntime(10, 0.01, 1e-5, 0);
    expect(long).toBeGreaterThan(short);
  });

  it('nonlinear devices increase runtime', () => {
    const linear = estimateTransientRuntime(10, 0.001, 1e-5, 0);
    const nonlinear = estimateTransientRuntime(10, 0.001, 1e-5, 5);
    expect(nonlinear).toBeGreaterThan(linear);
  });

  it('more nonlinear devices further increases runtime', () => {
    const few = estimateTransientRuntime(10, 0.001, 1e-5, 2);
    const many = estimateTransientRuntime(10, 0.001, 1e-5, 20);
    expect(many).toBeGreaterThan(few);
  });

  it('runtime scales roughly with step count', () => {
    const r1 = estimateTransientRuntime(10, 0.001, 1e-5, 0);  // 100 steps
    const r2 = estimateTransientRuntime(10, 0.01, 1e-5, 0);   // 1000 steps

    // Should scale approximately linearly with steps
    const ratio = r2 / r1;
    expect(ratio).toBeGreaterThan(5);   // Should be ~10x
    expect(ratio).toBeLessThan(15);
  });
});

// ---------------------------------------------------------------------------
// getSimplificationSuggestions
// ---------------------------------------------------------------------------

describe('getSimplificationSuggestions', () => {
  it('returns empty array for no warnings', () => {
    expect(getSimplificationSuggestions([])).toHaveLength(0);
  });

  it('returns suggestion from warning', () => {
    const warnings: ComplexityWarning[] = [{
      level: 'warning',
      metric: 'nodeCount',
      value: 100,
      threshold: 50,
      message: 'Too many nodes',
      suggestion: 'Split the circuit into smaller subcircuits or use hierarchical simulation.',
    }];

    const suggestions = getSimplificationSuggestions(warnings);
    expect(suggestions.length).toBeGreaterThanOrEqual(1);
    expect(suggestions[0]).toContain('subcircuit');
  });

  it('deduplicates identical suggestions', () => {
    const warnings: ComplexityWarning[] = [
      {
        level: 'warning',
        metric: 'nodeCount',
        value: 100,
        threshold: 50,
        message: 'msg1',
        suggestion: 'Same suggestion',
      },
      {
        level: 'danger',
        metric: 'estimatedMatrixSize',
        value: 300,
        threshold: 200,
        message: 'msg2',
        suggestion: 'Same suggestion',
      },
    ];

    const suggestions = getSimplificationSuggestions(warnings);
    const duplicates = suggestions.filter((s) => s === 'Same suggestion');
    expect(duplicates).toHaveLength(1);
  });

  it('adds extra suggestions for nonlinear warnings', () => {
    const warnings: ComplexityWarning[] = [{
      level: 'warning',
      metric: 'nonlinearDeviceCount',
      value: 30,
      threshold: 20,
      message: 'Too many nonlinear',
      suggestion: 'Replace some nonlinear models with linear approximations where precision is not critical.',
    }];

    const suggestions = getSimplificationSuggestions(warnings);
    expect(suggestions.length).toBeGreaterThanOrEqual(2);
    expect(suggestions.some((s) => s.includes('switch model'))).toBe(true);
  });

  it('adds extra suggestions for transient warnings', () => {
    const warnings: ComplexityWarning[] = [{
      level: 'warning',
      metric: 'transientSpan',
      value: 0.1,
      threshold: 0.01,
      message: 'Long transient',
      suggestion: 'Reduce the transient time span or increase the time step size.',
    }];

    const suggestions = getSimplificationSuggestions(warnings);
    expect(suggestions.some((s) => s.includes('adaptive timestep'))).toBe(true);
  });

  it('adds subcircuit suggestion for memory warnings', () => {
    const warnings: ComplexityWarning[] = [{
      level: 'danger',
      metric: 'estimatedMemoryMB',
      value: 500,
      threshold: 100,
      message: 'Memory high',
      suggestion: 'Reduce transient simulation span, increase time step, or simplify the circuit.',
    }];

    const suggestions = getSimplificationSuggestions(warnings);
    expect(suggestions.some((s) => s.includes('subcircuit'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// formatRuntimeEstimate
// ---------------------------------------------------------------------------

describe('formatRuntimeEstimate', () => {
  it('formats sub-100ms as "Less than a second"', () => {
    expect(formatRuntimeEstimate(50)).toBe('Less than a second');
  });

  it('formats 100-999ms as "About a second"', () => {
    expect(formatRuntimeEstimate(500)).toBe('About a second');
  });

  it('formats 1-5 seconds as "A few seconds"', () => {
    expect(formatRuntimeEstimate(3000)).toBe('A few seconds');
  });

  it('formats 5-30 seconds with approximate value', () => {
    const result = formatRuntimeEstimate(15000);
    expect(result).toContain('15');
    expect(result).toContain('seconds');
  });

  it('formats 30-120 seconds with minutes equivalent', () => {
    const result = formatRuntimeEstimate(60000);
    expect(result).toContain('60');
    expect(result).toContain('min');
  });

  it('formats 2-10 minutes', () => {
    const result = formatRuntimeEstimate(300000);
    expect(result).toContain('5.0');
    expect(result).toContain('minutes');
  });

  it('formats 10+ minutes with simplification hint', () => {
    const result = formatRuntimeEstimate(900000);
    expect(result).toContain('simplifying');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('empty circuit returns zero metrics', () => {
    const input = makeInput(0, []);
    const metrics = analyzeComplexity(input);

    expect(metrics.nodeCount).toBe(0);
    expect(metrics.linearDeviceCount).toBe(0);
    expect(metrics.nonlinearDeviceCount).toBe(0);
    expect(metrics.estimatedMatrixSize).toBe(0);
    expect(metrics.estimatedMemoryMB).toBe(0);
  });

  it('single-node circuit with one resistor', () => {
    const input = makeInput(1, [makeResistor('R1', 1, 0, 1000)]);
    const metrics = analyzeComplexity(input);

    expect(metrics.nodeCount).toBe(1);
    expect(metrics.estimatedMatrixSize).toBe(1);
    expect(metrics.estimatedMemoryMB).toBeGreaterThan(0);
  });

  it('all-nonlinear circuit', () => {
    const components: SolverComponent[] = [];
    for (let i = 0; i < 30; i++) {
      components.push(makeDiode(`D${i + 1}`, i + 1, 0));
    }
    const input = makeInput(30, components);
    const metrics = analyzeComplexity(input);

    expect(metrics.nonlinearDeviceCount).toBe(30);
    expect(metrics.linearDeviceCount).toBe(0);

    const warnings = checkThresholds(metrics);
    expect(warnings.some((w) => w.metric === 'nonlinearDeviceCount')).toBe(true);
  });

  it('huge circuit with 500 nodes', () => {
    const components: SolverComponent[] = [];
    for (let i = 0; i < 500; i++) {
      components.push(makeResistor(`R${i + 1}`, i + 1, (i + 2) % 501, 1000));
    }
    const input = makeInput(500, components);
    const metrics = analyzeComplexity(input);

    expect(metrics.nodeCount).toBe(500);
    expect(metrics.estimatedMatrixSize).toBe(500);
    expect(metrics.estimatedMemoryMB).toBeGreaterThan(1);

    const warnings = checkThresholds(metrics);
    expect(warnings.some((w) => w.level === 'danger')).toBe(true);
  });

  it('circuit with only voltage sources', () => {
    const input = makeInput(3, [
      makeVoltageSource('V1', 1, 0, 5),
      makeVoltageSource('V2', 2, 0, 3.3),
      makeVoltageSource('V3', 3, 0, 1.8),
    ]);
    const metrics = analyzeComplexity(input);

    // Matrix = 3 nodes + 3 voltage sources = 6
    expect(metrics.estimatedMatrixSize).toBe(6);
    expect(metrics.linearDeviceCount).toBe(0);
  });

  it('circuit with only current sources', () => {
    const input = makeInput(2, [
      makeCurrentSource('I1', 1, 0, 0.01),
      makeCurrentSource('I2', 2, 0, 0.02),
    ]);
    const metrics = analyzeComplexity(input);

    // Current sources don't add extra MNA rows
    expect(metrics.estimatedMatrixSize).toBe(2);
    expect(metrics.linearDeviceCount).toBe(2);
  });

  it('VCVS counts as voltage source in matrix size', () => {
    const input = makeInput(4, [
      makeVoltageSource('V1', 1, 0, 5),
      makeResistor('R1', 1, 2, 1000),
      { id: 'E1', type: 'VCVS' as const, value: 2, nodes: [3, 0] as [number, number], controlNodes: [1, 2] as [number, number] },
      makeResistor('R2', 3, 4, 1000),
      makeResistor('R3', 4, 0, 1000),
    ]);
    const metrics = analyzeComplexity(input);

    // 4 nodes + 1 V source + 1 VCVS = 6
    expect(metrics.estimatedMatrixSize).toBe(6);
  });

  it('checkThresholds with no transient params does not produce transient warning', () => {
    const metrics: CircuitComplexityMetrics = {
      nodeCount: 10,
      nonlinearDeviceCount: 0,
      linearDeviceCount: 10,
      netCount: 10,
      coupledInductors: 0,
      transmissionLines: 0,
      estimatedMatrixSize: 11,
      estimatedMemoryMB: 0.1,
      estimatedRuntimeMs: 10,
    };
    const warnings = checkThresholds(metrics);
    expect(warnings.find((w) => w.metric === 'transientSpan')).toBeUndefined();
  });

  it('memory estimation is non-negative', () => {
    const input = makeInput(0, []);
    const metrics = analyzeComplexity(input, { timeSpan: 0.01, timeStep: 1e-5 });
    expect(metrics.estimatedMemoryMB).toBeGreaterThanOrEqual(0);
  });

  it('runtime estimation with negative timeSpan returns 0', () => {
    expect(estimateTransientRuntime(10, -1, 1e-5, 0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Integration: analyzeComplexity → checkThresholds → getSimplificationSuggestions
// ---------------------------------------------------------------------------

describe('full pipeline', () => {
  it('small circuit produces no warnings and no suggestions', () => {
    const input = makeInput(3, [
      makeVoltageSource('V1', 1, 0),
      makeResistor('R1', 1, 2, 1000),
      makeCapacitor('C1', 2, 0, 1e-6),
    ]);

    const metrics = analyzeComplexity(input);
    const warnings = checkThresholds(metrics);
    const suggestions = getSimplificationSuggestions(warnings);

    expect(warnings).toHaveLength(0);
    expect(suggestions).toHaveLength(0);
  });

  it('complex circuit produces warnings and suggestions', () => {
    const components: SolverComponent[] = [
      makeVoltageSource('V1', 1, 0),
    ];
    // 60 nodes with BJTs
    for (let i = 0; i < 30; i++) {
      components.push(makeBJT(`Q${i + 1}`, i * 2 + 2, i * 2 + 3));
      components.push(makeResistor(`R${i + 1}`, i * 2 + 3, 0, 1000));
    }

    const input = makeInput(61, components);
    const transient: TransientParams = { timeSpan: 0.1, timeStep: 5e-7 };

    const metrics = analyzeComplexity(input, transient);
    const warnings = checkThresholds(metrics, {}, transient);
    const suggestions = getSimplificationSuggestions(warnings);

    expect(warnings.length).toBeGreaterThanOrEqual(2);
    expect(suggestions.length).toBeGreaterThanOrEqual(2);
    expect(metrics.nonlinearDeviceCount).toBe(30);
    expect(metrics.nodeCount).toBe(61);
  });

  it('medium circuit at boundary produces info-level warnings', () => {
    const components: SolverComponent[] = [makeVoltageSource('V1', 1, 0)];
    for (let i = 0; i < 52; i++) {
      components.push(makeResistor(`R${i + 1}`, i + 1, i + 2, 1000));
    }
    components.push(makeResistor('Rload', 53, 0, 1000));

    const input = makeInput(53, components);
    const metrics = analyzeComplexity(input);
    const warnings = checkThresholds(metrics);

    // nodeCount = 53 > 50 => info level (53/50 = 1.06)
    const nodeWarning = warnings.find((w) => w.metric === 'nodeCount');
    expect(nodeWarning).toBeDefined();
    expect(nodeWarning!.level).toBe('info');
  });
});
