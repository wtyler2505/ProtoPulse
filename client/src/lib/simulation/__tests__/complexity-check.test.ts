import { describe, it, expect } from 'vitest';
import { checkCircuitComplexity } from '../complexity-check';
import type { CircuitInstanceForComplexity } from '../complexity-check';

function makeInstances(count: number, type = 'resistor', prefix = 'R'): CircuitInstanceForComplexity[] {
  return Array.from({ length: count }, (_, i) => ({
    referenceDesignator: `${prefix}${i + 1}`,
    componentType: type,
    properties: { componentType: type },
  }));
}

function makeNonlinearInstances(count: number): CircuitInstanceForComplexity[] {
  return Array.from({ length: count }, (_, i) => ({
    referenceDesignator: `Q${i + 1}`,
    componentType: 'bjt_transistor',
    properties: { componentType: 'bjt_transistor' },
  }));
}

describe('checkCircuitComplexity', () => {
  it('returns no warning for small circuit', () => {
    const instances = makeInstances(5);
    const result = checkCircuitComplexity(instances);
    expect(result.shouldWarn).toBe(false);
    expect(result.warnings).toHaveLength(0);
    expect(result.metrics.componentCount).toBe(5);
  });

  it('returns no warning for empty circuit', () => {
    const result = checkCircuitComplexity([]);
    expect(result.shouldWarn).toBe(false);
    expect(result.metrics.nodeCount).toBe(0);
    expect(result.metrics.componentCount).toBe(0);
  });

  it('warns when node count exceeds threshold', () => {
    // 60 resistors => estimated ~60 nodes (2 pins each / ~2 shared)
    const instances = makeInstances(60);
    const result = checkCircuitComplexity(instances);
    expect(result.shouldWarn).toBe(true);
    expect(result.warnings.some(w => w.includes('nodes'))).toBe(true);
    expect(result.metrics.nodeCount).toBeGreaterThan(50);
  });

  it('warns when nonlinear device count exceeds threshold', () => {
    const instances = [
      ...makeInstances(5),
      ...makeNonlinearInstances(25),
    ];
    const result = checkCircuitComplexity(instances);
    expect(result.shouldWarn).toBe(true);
    expect(result.warnings.some(w => w.includes('nonlinear'))).toBe(true);
    expect(result.metrics.nonlinearDeviceCount).toBe(25);
  });

  it('warns for large transient step count', () => {
    const instances = makeInstances(5);
    const result = checkCircuitComplexity(instances, {
      spanSeconds: 0.1, // 100ms
      timeStepSeconds: 0.0000001, // 0.1us => 1M steps
    });
    expect(result.shouldWarn).toBe(true);
    expect(result.warnings.some(w => w.includes('time steps'))).toBe(true);
    expect(result.metrics.estimatedTimeSteps).toBeGreaterThan(100_000);
  });

  it('does not warn for reasonable transient', () => {
    const instances = makeInstances(5);
    const result = checkCircuitComplexity(instances, {
      spanSeconds: 0.01, // 10ms
      timeStepSeconds: 0.0001, // 0.1ms => 100 steps
    });
    expect(result.shouldWarn).toBe(false);
    expect(result.metrics.estimatedTimeSteps).toBe(100);
  });

  it('handles auto timestep (0) gracefully', () => {
    const instances = makeInstances(5);
    const result = checkCircuitComplexity(instances, {
      spanSeconds: 0.01,
      timeStepSeconds: 0,
    });
    expect(result.shouldWarn).toBe(false);
    // Auto step defaults to 1000 estimated steps
    expect(result.metrics.estimatedTimeSteps).toBe(1000);
  });

  it('detects diodes by refDes prefix', () => {
    const instances: CircuitInstanceForComplexity[] = Array.from({ length: 25 }, (_, i) => ({
      referenceDesignator: `D${i + 1}`,
      componentType: 'component',
      properties: {},
    }));
    const result = checkCircuitComplexity(instances);
    expect(result.metrics.nonlinearDeviceCount).toBe(25);
    expect(result.shouldWarn).toBe(true);
  });

  it('detects MOSFETs by componentType', () => {
    const instances: CircuitInstanceForComplexity[] = Array.from({ length: 25 }, (_, i) => ({
      referenceDesignator: `U${i + 1}`,
      componentType: 'mosfet',
      properties: { componentType: 'mosfet' },
    }));
    const result = checkCircuitComplexity(instances);
    expect(result.metrics.nonlinearDeviceCount).toBe(25);
  });

  it('provides estimated runtime string', () => {
    const instances = makeInstances(5);
    const result = checkCircuitComplexity(instances);
    expect(result.metrics.estimatedRuntime).toBeTruthy();
    expect(typeof result.metrics.estimatedRuntime).toBe('string');
  });

  it('can produce multiple warnings simultaneously', () => {
    const instances = [
      ...makeInstances(60),
      ...makeNonlinearInstances(25),
    ];
    const result = checkCircuitComplexity(instances, {
      spanSeconds: 1,
      timeStepSeconds: 0.000001, // 1M steps
    });
    expect(result.shouldWarn).toBe(true);
    expect(result.warnings.length).toBeGreaterThanOrEqual(2);
  });

  it('uses pin data when available', () => {
    const instances: CircuitInstanceForComplexity[] = [
      {
        referenceDesignator: 'R1',
        componentType: 'resistor',
        properties: {},
        pins: ['node1', 'node2'],
      },
      {
        referenceDesignator: 'R2',
        componentType: 'resistor',
        properties: {},
        pins: ['node2', 'node3'],
      },
    ];
    const result = checkCircuitComplexity(instances);
    expect(result.metrics.nodeCount).toBe(3);
  });
});
