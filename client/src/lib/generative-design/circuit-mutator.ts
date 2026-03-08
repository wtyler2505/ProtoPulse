/**
 * Circuit Mutator — Mutation and crossover operators for evolving CircuitIR candidates.
 *
 * Provides genetic-algorithm-style operators for generative circuit design:
 * - **Value mutation**: Change component values within tolerance ranges
 * - **Component swap**: Replace a component with a different type
 * - **Add bypass cap**: Insert decoupling capacitors near power pins
 * - **Add protection**: Insert protection diodes on signal inputs
 * - **Remove component**: Remove a non-essential component
 * - **Rewire net**: Reroute a signal net to a different component pin
 *
 * All operations use a seeded PRNG (mulberry32) for reproducibility.
 *
 * @module generative-design/circuit-mutator
 */

import type { CircuitIR, IRComponent, IRNet } from '@/lib/circuit-dsl/circuit-ir';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MutationType =
  | 'value_change'
  | 'component_swap'
  | 'add_bypass_cap'
  | 'add_protection'
  | 'remove_component'
  | 'rewire_net';

export interface MutationConfig {
  seed: number;
  mutationRate: number;
  allowedMutations: MutationType[];
}

// ---------------------------------------------------------------------------
// Seeded PRNG — mulberry32 (copied from monte-carlo.ts to avoid circular deps)
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Deep clone helper
// ---------------------------------------------------------------------------

function deepClone(ir: CircuitIR): CircuitIR {
  return JSON.parse(JSON.stringify(ir)) as CircuitIR;
}

// ---------------------------------------------------------------------------
// Value mutation tables
// ---------------------------------------------------------------------------

/** Standard E12 resistor values (multiplied by decade). */
const E12_VALUES = [
  '1', '1.2', '1.5', '1.8', '2.2', '2.7', '3.3', '3.9', '4.7', '5.6', '6.8', '8.2',
];

const RESISTOR_SUFFIXES = ['', 'k', 'M'];

/** Standard capacitor values. */
const CAP_VALUES = [
  '1p', '10p', '22p', '47p', '100p', '220p', '470p',
  '1n', '10n', '22n', '47n', '100n', '220n', '470n',
  '1u', '4.7u', '10u', '22u', '47u', '100u', '220u', '470u',
  '1000u',
];

/** Standard inductor values. */
const INDUCTOR_VALUES = [
  '1u', '2.2u', '4.7u', '10u', '22u', '47u', '100u', '220u', '470u', '1m', '10m',
];

function generateResistorValues(): string[] {
  const values: string[] = [];
  for (const suffix of RESISTOR_SUFFIXES) {
    for (const base of E12_VALUES) {
      values.push(`${base}${suffix}`);
    }
  }
  return values;
}

const RESISTOR_VALUES = generateResistorValues();

function pickRandomValue(partId: string, rng: () => number): string | undefined {
  const key = partId.toLowerCase();
  if (key === 'resistor') {
    return RESISTOR_VALUES[Math.floor(rng() * RESISTOR_VALUES.length)];
  }
  if (key === 'capacitor') {
    return CAP_VALUES[Math.floor(rng() * CAP_VALUES.length)];
  }
  if (key === 'inductor') {
    return INDUCTOR_VALUES[Math.floor(rng() * INDUCTOR_VALUES.length)];
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Component swap table
// ---------------------------------------------------------------------------

/** Components that can be swapped for each other. */
const SWAP_GROUPS: Record<string, string[]> = {
  resistor: ['resistor'],
  capacitor: ['capacitor'],
  inductor: ['inductor'],
  led: ['led', 'diode'],
  diode: ['diode', 'led'],
  transistor: ['transistor', 'mosfet'],
  mosfet: ['mosfet', 'transistor'],
};

// ---------------------------------------------------------------------------
// Unique ID generator using PRNG
// ---------------------------------------------------------------------------

function generateId(prefix: string, rng: () => number): string {
  const hex = Math.floor(rng() * 0xffffffff).toString(16).padStart(8, '0');
  return `${prefix}-${hex}`;
}

// ---------------------------------------------------------------------------
// Individual mutation operators
// ---------------------------------------------------------------------------

function applyValueChange(comp: IRComponent, rng: () => number): void {
  const newValue = pickRandomValue(comp.partId, rng);
  if (newValue !== undefined) {
    comp.value = newValue;
  }
}

function applyComponentSwap(comp: IRComponent, rng: () => number): void {
  const group = SWAP_GROUPS[comp.partId.toLowerCase()];
  if (group && group.length > 1) {
    const candidates = group.filter((g) => g !== comp.partId.toLowerCase());
    if (candidates.length > 0) {
      comp.partId = candidates[Math.floor(rng() * candidates.length)];
    }
  }
}

function applyAddBypassCap(
  ir: CircuitIR,
  rng: () => number,
): void {
  // Find power and ground nets
  const powerNet = ir.nets.find((n) => n.type === 'power');
  const groundNet = ir.nets.find((n) => n.type === 'ground');
  if (!powerNet || !groundNet) {
    return;
  }

  const id = generateId('bcap', rng);
  const refNum = ir.components.filter((c) => c.partId === 'capacitor').length + 1;
  const capValues = ['100n', '10u', '1u', '470n'];
  const value = capValues[Math.floor(rng() * capValues.length)];

  ir.components.push({
    id,
    refdes: `C${refNum + 100}`, // Offset to avoid collisions
    partId: 'capacitor',
    value,
    pins: { pin1: powerNet.name, pin2: groundNet.name },
  });
}

function applyAddProtection(
  ir: CircuitIR,
  rng: () => number,
): void {
  // Find a signal net to protect
  const signalNets = ir.nets.filter((n) => n.type === 'signal');
  if (signalNets.length === 0) {
    return;
  }

  const targetNet = signalNets[Math.floor(rng() * signalNets.length)];
  const groundNet = ir.nets.find((n) => n.type === 'ground');
  if (!groundNet) {
    return;
  }

  const id = generateId('prot', rng);
  const diodeNum = ir.components.filter((c) => c.partId === 'diode').length + 1;

  ir.components.push({
    id,
    refdes: `D${diodeNum + 100}`,
    partId: 'diode',
    pins: { anode: groundNet.name, cathode: targetNet.name },
  });
}

function applyRemoveComponent(
  ir: CircuitIR,
  rng: () => number,
): void {
  if (ir.components.length === 0) {
    return;
  }

  // Prefer removing non-essential components (capacitors, protection diodes)
  const removable = ir.components.filter((c) => {
    const key = c.partId.toLowerCase();
    return key === 'capacitor' || key === 'diode' || key === 'led';
  });

  const pool = removable.length > 0 ? removable : ir.components;
  const target = pool[Math.floor(rng() * pool.length)];
  const idx = ir.components.findIndex((c) => c.id === target.id);
  if (idx >= 0) {
    ir.components.splice(idx, 1);
  }
}

function applyRewireNet(
  ir: CircuitIR,
  rng: () => number,
): void {
  // Pick a random component and change one of its pin connections to a different net
  if (ir.components.length === 0 || ir.nets.length < 2) {
    return;
  }

  const comp = ir.components[Math.floor(rng() * ir.components.length)];
  const pinNames = Object.keys(comp.pins);
  if (pinNames.length === 0) {
    return;
  }

  const pinToRewire = pinNames[Math.floor(rng() * pinNames.length)];
  const currentNet = comp.pins[pinToRewire];
  const otherNets = ir.nets.filter((n) => n.name !== currentNet);
  if (otherNets.length === 0) {
    return;
  }

  const newNet = otherNets[Math.floor(rng() * otherNets.length)];
  comp.pins[pinToRewire] = newNet.name;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Apply random mutations to a CircuitIR candidate.
 *
 * Each component is considered for mutation with probability `config.mutationRate`.
 * A random mutation type is selected from `config.allowedMutations`.
 * Uses seeded PRNG for reproducibility.
 *
 * @param ir     - Source circuit (not mutated)
 * @param config - Mutation configuration (seed, rate, allowed types)
 * @returns A new mutated CircuitIR
 */
export function mutateCircuit(ir: CircuitIR, config: MutationConfig): CircuitIR {
  const result = deepClone(ir);
  const rng = mulberry32(config.seed);

  if (config.allowedMutations.length === 0 || config.mutationRate <= 0) {
    return result;
  }

  // Structural mutations (add/remove) are applied once per circuit, not per component
  const structuralMutations: MutationType[] = ['add_bypass_cap', 'add_protection', 'remove_component'];
  const perComponentMutations: MutationType[] = ['value_change', 'component_swap', 'rewire_net'];

  const allowedStructural = config.allowedMutations.filter((m) => structuralMutations.includes(m));
  const allowedPerComponent = config.allowedMutations.filter((m) => perComponentMutations.includes(m));

  // Apply per-component mutations
  if (allowedPerComponent.length > 0) {
    for (const comp of result.components) {
      if (rng() >= config.mutationRate) {
        continue;
      }

      const mutation = allowedPerComponent[Math.floor(rng() * allowedPerComponent.length)];
      switch (mutation) {
        case 'value_change':
          applyValueChange(comp, rng);
          break;
        case 'component_swap':
          applyComponentSwap(comp, rng);
          break;
        case 'rewire_net':
          applyRewireNet(result, rng);
          break;
      }
    }
  }

  // Apply structural mutations (once per circuit)
  if (allowedStructural.length > 0 && rng() < config.mutationRate) {
    const mutation = allowedStructural[Math.floor(rng() * allowedStructural.length)];
    switch (mutation) {
      case 'add_bypass_cap':
        applyAddBypassCap(result, rng);
        break;
      case 'add_protection':
        applyAddProtection(result, rng);
        break;
      case 'remove_component':
        applyRemoveComponent(result, rng);
        break;
    }
  }

  return result;
}

/**
 * Crossover two parent CircuitIRs to produce a child.
 *
 * Uses uniform crossover: for each component in the combined pool,
 * randomly select from parent1 or parent2. Deduplicates by partId+value.
 * Generates fresh IDs and refdes for the child.
 *
 * @param parent1 - First parent circuit
 * @param parent2 - Second parent circuit
 * @param seed    - PRNG seed for reproducibility
 * @returns A new child CircuitIR
 */
export function crossover(parent1: CircuitIR, parent2: CircuitIR, seed: number): CircuitIR {
  const rng = mulberry32(seed);

  // Collect all components from both parents
  const allComponents: IRComponent[] = [
    ...parent1.components.map((c) => ({ ...c, pins: { ...c.pins } })),
    ...parent2.components.map((c) => ({ ...c, pins: { ...c.pins } })),
  ];

  // Collect all nets from both parents (deduplicate by name)
  const netMap = new Map<string, IRNet>();
  for (const net of [...parent1.nets, ...parent2.nets]) {
    if (!netMap.has(net.name)) {
      netMap.set(net.name, { ...net });
    }
  }

  // Uniform crossover: randomly include each component with 50% probability
  const selectedComponents: IRComponent[] = [];
  for (const comp of allComponents) {
    if (rng() < 0.5) {
      selectedComponents.push(comp);
    }
  }

  // Generate fresh IDs and deduplicate refdes
  const usedRefdes = new Set<string>();
  const refCounters: Record<string, number> = {};

  const childComponents: IRComponent[] = selectedComponents.map((comp) => {
    let refdes = comp.refdes;
    if (usedRefdes.has(refdes)) {
      // Generate new refdes
      const prefix = refdes.replace(/\d+$/, '');
      refCounters[prefix] = (refCounters[prefix] ?? 0) + 1;
      refdes = `${prefix}${100 + refCounters[prefix]}`;
    }
    usedRefdes.add(refdes);

    return {
      ...comp,
      id: generateId('cx', rng),
      refdes,
      pins: { ...comp.pins },
    };
  });

  // Only include nets that are referenced by selected components
  const usedNetNames = new Set<string>();
  for (const comp of childComponents) {
    for (const netName of Object.values(comp.pins)) {
      usedNetNames.add(netName);
    }
  }

  const childNets: IRNet[] = [];
  for (const [name, net] of Array.from(netMap.entries())) {
    if (usedNetNames.has(name)) {
      childNets.push({
        ...net,
        id: generateId('net', rng),
      });
    }
  }

  return {
    meta: { ...parent1.meta },
    components: childComponents,
    nets: childNets,
    wires: [], // Wires are regenerated from net connections
  };
}

/**
 * Generate a variant of a circuit informed by a text specification.
 *
 * Uses heuristic rules based on keywords in the spec to bias mutation:
 * - "power" / "low power" → prefer value changes on resistors (higher values)
 * - "cheap" / "cost" → prefer removing components
 * - "robust" / "protection" → prefer adding protection diodes and bypass caps
 * - Default → balanced mutation with all types
 *
 * @param base - Base circuit to derive from
 * @param spec - Natural language guidance for the variant
 * @param seed - PRNG seed
 * @returns A new variant CircuitIR
 */
export function generateVariant(base: CircuitIR, spec: string, seed: number): CircuitIR {
  const lower = spec.toLowerCase();

  let allowedMutations: MutationType[];
  let mutationRate: number;

  if (lower.includes('power') || lower.includes('efficient')) {
    allowedMutations = ['value_change', 'remove_component'];
    mutationRate = 0.6;
  } else if (lower.includes('cheap') || lower.includes('cost')) {
    allowedMutations = ['remove_component', 'component_swap', 'value_change'];
    mutationRate = 0.7;
  } else if (lower.includes('robust') || lower.includes('protection') || lower.includes('reliable')) {
    allowedMutations = ['add_bypass_cap', 'add_protection'];
    mutationRate = 0.8;
  } else if (lower.includes('capacitor')) {
    allowedMutations = ['add_bypass_cap', 'value_change'];
    mutationRate = 0.7;
  } else if (lower.includes('resistor')) {
    allowedMutations = ['value_change', 'component_swap'];
    mutationRate = 0.6;
  } else {
    allowedMutations = ['value_change', 'component_swap', 'add_bypass_cap', 'add_protection'];
    mutationRate = 0.5;
  }

  return mutateCircuit(base, {
    seed,
    mutationRate,
    allowedMutations,
  });
}
