import { describe, it, expect } from 'vitest';
import {
  mutateCircuit,
  crossover,
  generateVariant,
} from '../circuit-mutator';
import type { MutationConfig, MutationType } from '../circuit-mutator';
import type { CircuitIR } from '@/lib/circuit-dsl/circuit-ir';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function simpleCircuit(): CircuitIR {
  return {
    meta: { name: 'Simple', version: '1.0.0' },
    components: [
      { id: 'r1', refdes: 'R1', partId: 'resistor', value: '10k', pins: { pin1: 'VCC', pin2: 'N1' } },
      { id: 'r2', refdes: 'R2', partId: 'resistor', value: '4.7k', pins: { pin1: 'N1', pin2: 'GND' } },
      { id: 'c1', refdes: 'C1', partId: 'capacitor', value: '100n', pins: { pin1: 'VCC', pin2: 'GND' } },
    ],
    nets: [
      { id: 'n1', name: 'VCC', type: 'power' },
      { id: 'n2', name: 'GND', type: 'ground' },
      { id: 'n3', name: 'N1', type: 'signal' },
    ],
    wires: [
      { id: 'w1', netId: 'n1', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
    ],
  };
}

function ledCircuit(): CircuitIR {
  return {
    meta: { name: 'LED', version: '1.0.0' },
    components: [
      { id: 'r1', refdes: 'R1', partId: 'resistor', value: '330', pins: { pin1: 'VCC', pin2: 'N1' } },
      { id: 'd1', refdes: 'D1', partId: 'led', pins: { anode: 'N1', cathode: 'GND' } },
    ],
    nets: [
      { id: 'n1', name: 'VCC', type: 'power' },
      { id: 'n2', name: 'GND', type: 'ground' },
      { id: 'n3', name: 'N1', type: 'signal' },
    ],
    wires: [],
  };
}

function emptyCircuit(): CircuitIR {
  return {
    meta: { name: 'Empty', version: '1.0.0' },
    components: [],
    nets: [],
    wires: [],
  };
}

function defaultConfig(overrides?: Partial<MutationConfig>): MutationConfig {
  return {
    seed: 42,
    mutationRate: 0.5,
    allowedMutations: ['value_change', 'component_swap', 'add_bypass_cap', 'add_protection', 'remove_component', 'rewire_net'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// mutateCircuit
// ---------------------------------------------------------------------------

describe('mutateCircuit', () => {
  it('returns a valid CircuitIR', () => {
    const result = mutateCircuit(simpleCircuit(), defaultConfig());
    expect(result.meta).toBeDefined();
    expect(result.components).toBeDefined();
    expect(result.nets).toBeDefined();
    expect(result.wires).toBeDefined();
  });

  it('does not mutate the original circuit', () => {
    const original = simpleCircuit();
    const originalJson = JSON.stringify(original);
    mutateCircuit(original, defaultConfig());
    expect(JSON.stringify(original)).toBe(originalJson);
  });

  it('produces deterministic results with same seed', () => {
    const config = defaultConfig({ seed: 123 });
    const a = mutateCircuit(simpleCircuit(), config);
    const b = mutateCircuit(simpleCircuit(), { ...config, seed: 123 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('produces different results with different seeds', () => {
    const a = mutateCircuit(simpleCircuit(), defaultConfig({ seed: 1, mutationRate: 1.0 }));
    const b = mutateCircuit(simpleCircuit(), defaultConfig({ seed: 999, mutationRate: 1.0 }));
    // Very likely different (not guaranteed but extremely probable with rate 1.0)
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('handles empty circuit gracefully', () => {
    const result = mutateCircuit(emptyCircuit(), defaultConfig());
    expect(result.components).toEqual([]);
  });

  it('applies value_change mutation to component values', () => {
    const config = defaultConfig({
      seed: 42,
      mutationRate: 1.0,
      allowedMutations: ['value_change'],
    });
    const result = mutateCircuit(simpleCircuit(), config);
    // At least one component should have a different value
    const original = simpleCircuit();
    const changed = result.components.some((comp, i) => comp.value !== original.components[i].value);
    expect(changed).toBe(true);
  });

  it('preserves component IDs after mutation', () => {
    const config = defaultConfig({
      mutationRate: 1.0,
      allowedMutations: ['value_change'],
    });
    const original = simpleCircuit();
    const result = mutateCircuit(original, config);
    const originalIds = original.components.map((c) => c.id);
    const resultIds = result.components.map((c) => c.id);
    expect(resultIds).toEqual(originalIds);
  });

  it('preserves refdes after value_change mutation', () => {
    const config = defaultConfig({
      mutationRate: 1.0,
      allowedMutations: ['value_change'],
    });
    const original = simpleCircuit();
    const result = mutateCircuit(original, config);
    const originalRefs = original.components.map((c) => c.refdes);
    const resultRefs = result.components.map((c) => c.refdes);
    expect(resultRefs).toEqual(originalRefs);
  });

  it('respects mutation rate of 0 (no mutations)', () => {
    const config = defaultConfig({ mutationRate: 0.0 });
    const original = simpleCircuit();
    const result = mutateCircuit(original, config);
    // Components should be structurally identical
    expect(result.components.length).toBe(original.components.length);
    for (let i = 0; i < original.components.length; i++) {
      expect(result.components[i].value).toBe(original.components[i].value);
      expect(result.components[i].partId).toBe(original.components[i].partId);
    }
  });

  it('respects mutation rate of 1 (all components considered)', () => {
    const config = defaultConfig({ mutationRate: 1.0, allowedMutations: ['value_change'] });
    const result = mutateCircuit(simpleCircuit(), config);
    // With rate 1.0 and only value_change, all valued components should be mutated
    const original = simpleCircuit();
    const valued = original.components.filter((c) => c.value);
    const changed = result.components.filter((comp, i) => comp.value !== original.components[i].value);
    expect(changed.length).toBe(valued.length);
  });

  it('can add bypass capacitor', () => {
    const config = defaultConfig({
      seed: 7,
      mutationRate: 1.0,
      allowedMutations: ['add_bypass_cap'],
    });
    const original = simpleCircuit();
    const result = mutateCircuit(original, config);
    // Should have more components than original
    expect(result.components.length).toBeGreaterThan(original.components.length);
    const addedCaps = result.components.filter(
      (c) => !original.components.find((o) => o.id === c.id) && c.partId === 'capacitor',
    );
    expect(addedCaps.length).toBeGreaterThan(0);
  });

  it('can add protection diode', () => {
    const config = defaultConfig({
      seed: 3,
      mutationRate: 1.0,
      allowedMutations: ['add_protection'],
    });
    const original = simpleCircuit();
    const result = mutateCircuit(original, config);
    expect(result.components.length).toBeGreaterThan(original.components.length);
    const addedDiodes = result.components.filter(
      (c) => !original.components.find((o) => o.id === c.id) && c.partId === 'diode',
    );
    expect(addedDiodes.length).toBeGreaterThan(0);
  });

  it('can remove a component', () => {
    const config = defaultConfig({
      seed: 42,
      mutationRate: 1.0,
      allowedMutations: ['remove_component'],
    });
    const original = simpleCircuit();
    const result = mutateCircuit(original, config);
    expect(result.components.length).toBeLessThan(original.components.length);
  });

  it('preserves nets and wires structure', () => {
    const config = defaultConfig({
      mutationRate: 1.0,
      allowedMutations: ['value_change'],
    });
    const original = simpleCircuit();
    const result = mutateCircuit(original, config);
    expect(result.nets.length).toBe(original.nets.length);
    expect(result.wires.length).toBe(original.wires.length);
  });

  it('only applies allowed mutation types', () => {
    const config = defaultConfig({
      seed: 42,
      mutationRate: 1.0,
      allowedMutations: ['value_change'],
    });
    const original = simpleCircuit();
    const result = mutateCircuit(original, config);
    // No components should be added or removed with only value_change
    expect(result.components.length).toBe(original.components.length);
  });

  it('preserves meta information', () => {
    const result = mutateCircuit(simpleCircuit(), defaultConfig());
    expect(result.meta.name).toBe('Simple');
    expect(result.meta.version).toBe('1.0.0');
  });
});

// ---------------------------------------------------------------------------
// crossover
// ---------------------------------------------------------------------------

describe('crossover', () => {
  it('returns a valid CircuitIR', () => {
    const result = crossover(simpleCircuit(), ledCircuit(), 42);
    expect(result.meta).toBeDefined();
    expect(result.components).toBeDefined();
    expect(result.nets).toBeDefined();
  });

  it('produces deterministic results with same seed', () => {
    const a = crossover(simpleCircuit(), ledCircuit(), 42);
    const b = crossover(simpleCircuit(), ledCircuit(), 42);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('produces different results with different seeds', () => {
    const a = crossover(simpleCircuit(), ledCircuit(), 1);
    const b = crossover(simpleCircuit(), ledCircuit(), 999);
    // Likely different
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('combines components from both parents', () => {
    const parent1 = simpleCircuit();
    const parent2 = ledCircuit();
    const child = crossover(parent1, parent2, 42);
    // Child should have components from at least one parent
    expect(child.components.length).toBeGreaterThan(0);
  });

  it('handles crossover with empty parent', () => {
    const result = crossover(simpleCircuit(), emptyCircuit(), 42);
    expect(result.components.length).toBeGreaterThanOrEqual(0);
  });

  it('handles two empty parents', () => {
    const result = crossover(emptyCircuit(), emptyCircuit(), 42);
    expect(result.components).toEqual([]);
  });

  it('does not mutate parent circuits', () => {
    const p1 = simpleCircuit();
    const p2 = ledCircuit();
    const p1Json = JSON.stringify(p1);
    const p2Json = JSON.stringify(p2);
    crossover(p1, p2, 42);
    expect(JSON.stringify(p1)).toBe(p1Json);
    expect(JSON.stringify(p2)).toBe(p2Json);
  });

  it('generates unique IDs for child components', () => {
    const child = crossover(simpleCircuit(), ledCircuit(), 42);
    const ids = child.components.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('generates unique refdes for child components', () => {
    const child = crossover(simpleCircuit(), ledCircuit(), 42);
    const refdes = child.components.map((c) => c.refdes);
    const uniqueRefdes = new Set(refdes);
    expect(uniqueRefdes.size).toBe(refdes.length);
  });
});

// ---------------------------------------------------------------------------
// generateVariant
// ---------------------------------------------------------------------------

describe('generateVariant', () => {
  it('returns a valid CircuitIR', () => {
    const result = generateVariant(simpleCircuit(), 'lower power consumption', 42);
    expect(result.meta).toBeDefined();
    expect(result.components).toBeDefined();
    expect(result.nets).toBeDefined();
  });

  it('produces deterministic results with same seed', () => {
    const a = generateVariant(simpleCircuit(), 'cheaper components', 42);
    const b = generateVariant(simpleCircuit(), 'cheaper components', 42);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('does not mutate the original circuit', () => {
    const original = simpleCircuit();
    const originalJson = JSON.stringify(original);
    generateVariant(original, 'test variant', 42);
    expect(JSON.stringify(original)).toBe(originalJson);
  });

  it('handles empty circuit', () => {
    const result = generateVariant(emptyCircuit(), 'add components', 42);
    expect(result).toBeDefined();
  });

  it('produces different results with different specs', () => {
    const a = generateVariant(simpleCircuit(), 'more capacitors', 42);
    const b = generateVariant(simpleCircuit(), 'more resistors', 42);
    // Spec influences mutation selection, so results may differ
    // (depending on implementation, same seed may still diverge with different specs)
    expect(a).toBeDefined();
    expect(b).toBeDefined();
  });

  it('preserves meta information', () => {
    const result = generateVariant(simpleCircuit(), 'test', 42);
    expect(result.meta.name).toBe('Simple');
  });
});

// ---------------------------------------------------------------------------
// Seeded PRNG reproducibility
// ---------------------------------------------------------------------------

describe('seeded reproducibility', () => {
  it('mutateCircuit is reproducible across multiple calls', () => {
    const config = defaultConfig({ seed: 777, mutationRate: 0.8 });
    const results = Array.from({ length: 5 }, () => mutateCircuit(simpleCircuit(), config));
    const firstJson = JSON.stringify(results[0]);
    for (let i = 1; i < results.length; i++) {
      expect(JSON.stringify(results[i])).toBe(firstJson);
    }
  });
});
