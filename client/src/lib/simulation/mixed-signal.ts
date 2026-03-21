/**
 * Mixed-Signal Simulation Engine (BL-0121)
 *
 * Simulates circuits containing both analog and digital domains.
 * Provides:
 *   - Analog node voltages via simple resistive/source MNA
 *   - Digital node logic states with 8 gate types (AND, OR, NOT, NAND, NOR, XOR, XNOR, BUFFER)
 *   - ADC/DAC models for domain boundary crossing
 *   - Schmitt trigger analog-to-digital conversion with hysteresis
 *   - Truth table evaluation for combinational logic
 *   - Step-by-step simulation with event-driven digital propagation
 *   - Domain boundary detection and classification
 *
 * Pure module — no React/DOM dependencies.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Listener = () => void;

/** Supported digital gate types. */
export type GateType = 'AND' | 'OR' | 'NOT' | 'NAND' | 'NOR' | 'XOR' | 'XNOR' | 'BUFFER';

/** Logic level for digital nodes. */
export type LogicLevel = 0 | 1 | 'X';

/** Domain classification for a node. */
export type NodeDomain = 'analog' | 'digital';

/** An analog component in the mixed-signal circuit. */
export interface AnalogComponent {
  readonly id: string;
  readonly type: 'R' | 'V' | 'I';
  /** Value in ohms (R), volts (V), or amps (I). */
  readonly value: number;
  /** [positive, negative] node indices. Node 0 = ground. */
  readonly nodes: readonly [number, number];
}

/** A digital gate in the mixed-signal circuit. */
export interface DigitalGate {
  readonly id: string;
  readonly gateType: GateType;
  /** Input node IDs (digital domain). */
  readonly inputs: readonly string[];
  /** Output node ID (digital domain). */
  readonly output: string;
  /** Propagation delay in nanoseconds (default 10). */
  readonly propagationDelay?: number;
}

/** Schmitt trigger parameters for analog-to-digital conversion. */
export interface SchmittTriggerParams {
  /** High threshold voltage (default 3.0V for 5V logic). */
  readonly vHigh: number;
  /** Low threshold voltage (default 1.5V for 5V logic). */
  readonly vLow: number;
}

/** ADC model — converts an analog node voltage to a digital output. */
export interface AdcModel {
  readonly id: string;
  /** Analog input node index. */
  readonly analogInput: number;
  /** Digital output node ID. */
  readonly digitalOutput: string;
  /** Number of bits (1–16, default 10). */
  readonly bits: number;
  /** Reference voltage (default 5.0V). */
  readonly vRef: number;
  /** Optional Schmitt trigger for 1-bit ADC. */
  readonly schmittTrigger?: SchmittTriggerParams;
}

/** DAC model — converts a digital code to an analog output voltage. */
export interface DacModel {
  readonly id: string;
  /** Digital input node IDs (MSB first). */
  readonly digitalInputs: readonly string[];
  /** Analog output node index. */
  readonly analogOutput: number;
  /** Reference voltage (default 5.0V). */
  readonly vRef: number;
}

/** Domain boundary — detected crossing between analog and digital domains. */
export interface DomainBoundary {
  readonly id: string;
  readonly type: 'adc' | 'dac';
  readonly analogNode: number;
  readonly digitalNodes: readonly string[];
}

/** A truth table row: input pattern → output. */
export interface TruthTableRow {
  readonly inputs: readonly LogicLevel[];
  readonly output: LogicLevel;
}

/** Complete mixed-signal circuit definition. */
export interface MixedSignalCircuit {
  /** Number of analog nodes (excluding ground = node 0). */
  readonly numAnalogNodes: number;
  readonly analogComponents: readonly AnalogComponent[];
  readonly digitalGates: readonly DigitalGate[];
  readonly adcModels: readonly AdcModel[];
  readonly dacModels: readonly DacModel[];
}

/** Result of a single simulation step. */
export interface SimulationStep {
  readonly stepIndex: number;
  readonly time: number;
  readonly analogVoltages: ReadonlyMap<number, number>;
  readonly digitalStates: ReadonlyMap<string, LogicLevel>;
  readonly adcOutputs: ReadonlyMap<string, number>;
  readonly dacVoltages: ReadonlyMap<string, number>;
  readonly events: readonly SimulationEvent[];
}

/** An event during simulation (gate evaluation, domain crossing, etc.). */
export interface SimulationEvent {
  readonly time: number;
  readonly type: 'gate_eval' | 'adc_convert' | 'dac_convert' | 'state_change';
  readonly nodeId: string;
  readonly description: string;
}

/** Full simulation result. */
export interface MixedSignalResult {
  readonly steps: readonly SimulationStep[];
  readonly boundaries: readonly DomainBoundary[];
  readonly nodeClassification: ReadonlyMap<string, NodeDomain>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_SCHMITT: SchmittTriggerParams = { vHigh: 3.0, vLow: 1.5 };
const DEFAULT_PROPAGATION_DELAY_NS = 10;
const MAX_PROPAGATION_ITERATIONS = 100;

// ---------------------------------------------------------------------------
// Truth Table Evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluates a gate's truth table for given inputs.
 * Returns the output logic level.
 */
export function evaluateGate(gateType: GateType, inputs: readonly LogicLevel[]): LogicLevel {
  if (inputs.length === 0) {
    return 'X';
  }

  // Any 'X' input propagates as 'X' for most gates
  if (inputs.some((i) => i === 'X')) {
    // NOT and BUFFER with X input → X
    // Multi-input gates with X → X (conservative)
    return 'X';
  }

  const boolInputs = inputs as readonly (0 | 1)[];

  switch (gateType) {
    case 'AND':
      return boolInputs.every((i) => i === 1) ? 1 : 0;
    case 'OR':
      return boolInputs.some((i) => i === 1) ? 1 : 0;
    case 'NOT':
      return boolInputs[0] === 1 ? 0 : 1;
    case 'NAND':
      return boolInputs.every((i) => i === 1) ? 0 : 1;
    case 'NOR':
      return boolInputs.some((i) => i === 1) ? 0 : 1;
    case 'XOR': {
      let count = 0;
      for (const b of boolInputs) {
        if (b === 1) { count++; }
      }
      return (count % 2 === 1) ? 1 : 0;
    }
    case 'XNOR': {
      let count = 0;
      for (const b of boolInputs) {
        if (b === 1) { count++; }
      }
      return (count % 2 === 0) ? 1 : 0;
    }
    case 'BUFFER':
      return boolInputs[0];
    default: {
      const _exhaustive: never = gateType;
      return _exhaustive;
    }
  }
}

/**
 * Generates a complete truth table for a gate type with the given number of inputs.
 */
export function generateTruthTable(gateType: GateType, numInputs: number): readonly TruthTableRow[] {
  if (numInputs < 1 || numInputs > 8) {
    throw new Error(`numInputs must be 1–8, got ${numInputs}`);
  }

  const rows: TruthTableRow[] = [];
  const totalCombinations = 1 << numInputs;

  for (let combo = 0; combo < totalCombinations; combo++) {
    const inputs: LogicLevel[] = [];
    for (let bit = numInputs - 1; bit >= 0; bit--) {
      inputs.push(((combo >> bit) & 1) as 0 | 1);
    }
    const output = evaluateGate(gateType, inputs);
    rows.push({ inputs, output });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Schmitt Trigger
// ---------------------------------------------------------------------------

/**
 * Schmitt trigger analog-to-digital conversion with hysteresis.
 * Returns the new digital state given the analog voltage and the previous state.
 */
export function schmittTriggerConvert(
  voltage: number,
  previousState: LogicLevel,
  params: SchmittTriggerParams = DEFAULT_SCHMITT,
): LogicLevel {
  if (voltage >= params.vHigh) {
    return 1;
  }
  if (voltage <= params.vLow) {
    return 0;
  }
  // In hysteresis band — maintain previous state
  return previousState === 'X' ? 0 : previousState;
}

// ---------------------------------------------------------------------------
// ADC / DAC Models
// ---------------------------------------------------------------------------

/**
 * Converts an analog voltage to a digital code (integer) via an ADC model.
 * Returns clamped value in range [0, 2^bits - 1].
 */
export function adcConvert(voltage: number, bits: number, vRef: number): number {
  const maxCode = (1 << bits) - 1;
  const normalized = voltage / vRef;
  const code = Math.round(normalized * maxCode);
  return Math.max(0, Math.min(maxCode, code));
}

/**
 * Converts a set of digital inputs to an analog voltage via a DAC model.
 * digitalInputs: MSB-first array of logic levels.
 * Returns voltage in [0, vRef].
 */
export function dacConvert(digitalInputs: readonly LogicLevel[], vRef: number): number {
  const bits = digitalInputs.length;
  if (bits === 0) { return 0; }

  let code = 0;
  for (let i = 0; i < bits; i++) {
    const level = digitalInputs[i];
    if (level === 'X') { return 0; } // undefined inputs → 0V
    code = (code << 1) | level;
  }

  const maxCode = (1 << bits) - 1;
  return (code / maxCode) * vRef;
}

// ---------------------------------------------------------------------------
// Analog MNA Solver (lightweight, resistive + independent sources only)
// ---------------------------------------------------------------------------

/**
 * Solves a simple resistive MNA system. Supports R, V, I components.
 * Returns a Map from node index → voltage.
 */
export function solveAnalogDC(
  numNodes: number,
  components: readonly AnalogComponent[],
): Map<number, number> {
  // Count voltage sources for MNA extended matrix size
  const voltageSources = components.filter((c) => c.type === 'V');
  const size = numNodes + voltageSources.length;

  if (size === 0) {
    return new Map();
  }

  // Build MNA matrix A and RHS vector b
  const A: number[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
  const b: number[] = Array.from({ length: size }, () => 0);

  let vsIdx = 0;

  for (const comp of components) {
    const [np, nn] = comp.nodes;

    switch (comp.type) {
      case 'R': {
        if (comp.value === 0) { continue; }
        const g = 1 / comp.value;
        if (np > 0) { A[np - 1][np - 1] += g; }
        if (nn > 0) { A[nn - 1][nn - 1] += g; }
        if (np > 0 && nn > 0) {
          A[np - 1][nn - 1] -= g;
          A[nn - 1][np - 1] -= g;
        }
        break;
      }
      case 'V': {
        const row = numNodes + vsIdx;
        if (np > 0) { A[row][np - 1] = 1; A[np - 1][row] = 1; }
        if (nn > 0) { A[row][nn - 1] = -1; A[nn - 1][row] = -1; }
        b[row] = comp.value;
        vsIdx++;
        break;
      }
      case 'I': {
        // Current source: positive current flows from np to nn
        if (np > 0) { b[np - 1] -= comp.value; }
        if (nn > 0) { b[nn - 1] += comp.value; }
        break;
      }
    }
  }

  // Gaussian elimination with partial pivoting
  const x = gaussianElimination(A, b, size);

  const voltages = new Map<number, number>();
  voltages.set(0, 0); // ground
  for (let i = 0; i < numNodes; i++) {
    voltages.set(i + 1, x[i]);
  }

  return voltages;
}

/** Gaussian elimination with partial pivoting. Returns solution vector. */
function gaussianElimination(A: number[][], b: number[], n: number): number[] {
  // Augment
  const aug: number[][] = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivoting
    let maxRow = col;
    let maxVal = Math.abs(aug[col][col]);
    for (let row = col + 1; row < n; row++) {
      const absVal = Math.abs(aug[row][col]);
      if (absVal > maxVal) {
        maxVal = absVal;
        maxRow = row;
      }
    }
    if (maxRow !== col) {
      [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    }

    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-15) {
      continue; // Singular — skip
    }

    // Eliminate
    for (let row = col + 1; row < n; row++) {
      const factor = aug[row][col] / pivot;
      for (let j = col; j <= n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  // Back-substitution
  const x = Array.from({ length: n }, () => 0);
  for (let row = n - 1; row >= 0; row--) {
    const pivot = aug[row][row];
    if (Math.abs(pivot) < 1e-15) { continue; }
    let sum = aug[row][n];
    for (let j = row + 1; j < n; j++) {
      sum -= aug[row][j] * x[j];
    }
    x[row] = sum / pivot;
  }

  return x;
}

// ---------------------------------------------------------------------------
// Domain Boundary Detection
// ---------------------------------------------------------------------------

/**
 * Detects domain boundaries in a mixed-signal circuit.
 * A boundary exists wherever an ADC or DAC bridges analog ↔ digital.
 */
export function detectBoundaries(circuit: MixedSignalCircuit): DomainBoundary[] {
  const boundaries: DomainBoundary[] = [];

  for (const adc of circuit.adcModels) {
    boundaries.push({
      id: adc.id,
      type: 'adc',
      analogNode: adc.analogInput,
      digitalNodes: [adc.digitalOutput],
    });
  }

  for (const dac of circuit.dacModels) {
    boundaries.push({
      id: dac.id,
      type: 'dac',
      analogNode: dac.analogOutput,
      digitalNodes: dac.digitalInputs,
    });
  }

  return boundaries;
}

/**
 * Classifies all nodes in the circuit as analog or digital.
 */
export function classifyNodes(circuit: MixedSignalCircuit): Map<string, NodeDomain> {
  const classification = new Map<string, NodeDomain>();

  // Analog nodes: referenced by analog components or ADC/DAC analog side
  for (const comp of circuit.analogComponents) {
    for (const node of comp.nodes) {
      classification.set(`analog:${node}`, 'analog');
    }
  }
  for (const adc of circuit.adcModels) {
    classification.set(`analog:${adc.analogInput}`, 'analog');
  }
  for (const dac of circuit.dacModels) {
    classification.set(`analog:${dac.analogOutput}`, 'analog');
  }

  // Digital nodes: referenced by gates or ADC/DAC digital side
  for (const gate of circuit.digitalGates) {
    for (const input of gate.inputs) {
      classification.set(input, 'digital');
    }
    classification.set(gate.output, 'digital');
  }
  for (const adc of circuit.adcModels) {
    classification.set(adc.digitalOutput, 'digital');
  }
  for (const dac of circuit.dacModels) {
    for (const input of dac.digitalInputs) {
      classification.set(input, 'digital');
    }
  }

  return classification;
}

// ---------------------------------------------------------------------------
// Digital Propagation (event-driven)
// ---------------------------------------------------------------------------

/**
 * Propagates digital logic through all gates until steady state.
 * Returns the final digital state map and a list of events.
 */
function propagateDigital(
  gates: readonly DigitalGate[],
  initialStates: Map<string, LogicLevel>,
): { states: Map<string, LogicLevel>; events: SimulationEvent[]; time: number } {
  const states = new Map(initialStates);
  const events: SimulationEvent[] = [];
  let changed = true;
  let iterations = 0;
  let maxDelay = 0;

  while (changed && iterations < MAX_PROPAGATION_ITERATIONS) {
    changed = false;
    iterations++;

    for (const gate of gates) {
      const inputs = gate.inputs.map((id) => states.get(id) ?? ('X' as LogicLevel));
      const newOutput = evaluateGate(gate.gateType, inputs);
      const currentOutput = states.get(gate.output) ?? ('X' as LogicLevel);

      if (newOutput !== currentOutput) {
        states.set(gate.output, newOutput);
        changed = true;
        const delay = gate.propagationDelay ?? DEFAULT_PROPAGATION_DELAY_NS;
        maxDelay = Math.max(maxDelay, delay);

        events.push({
          time: delay,
          type: 'gate_eval',
          nodeId: gate.output,
          description: `${gate.id} (${gate.gateType}): inputs=[${inputs.join(',')}] → output=${newOutput}`,
        });
      }
    }
  }

  if (iterations >= MAX_PROPAGATION_ITERATIONS) {
    events.push({
      time: 0,
      type: 'state_change',
      nodeId: 'system',
      description: 'Digital propagation did not converge — possible oscillation detected',
    });
  }

  return { states, events, time: maxDelay };
}

// ---------------------------------------------------------------------------
// MixedSignalSimulator (singleton + subscribe)
// ---------------------------------------------------------------------------

export class MixedSignalSimulator {
  private circuit: MixedSignalCircuit | null = null;
  private steps: SimulationStep[] = [];
  private currentDigitalStates = new Map<string, LogicLevel>();
  private previousSchmittStates = new Map<string, LogicLevel>();
  private listeners = new Set<Listener>();
  private stepCount = 0;

  // Singleton
  private static instance: MixedSignalSimulator | null = null;

  static getInstance(): MixedSignalSimulator {
    if (!MixedSignalSimulator.instance) {
      MixedSignalSimulator.instance = new MixedSignalSimulator();
    }
    return MixedSignalSimulator.instance;
  }

  static resetInstance(): void {
    MixedSignalSimulator.instance = null;
  }

  // Subscribe pattern for useSyncExternalStore
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private notify(): void {
    this.listeners.forEach((fn) => { fn(); });
  }

  getSteps(): readonly SimulationStep[] {
    return this.steps;
  }

  getCircuit(): MixedSignalCircuit | null {
    return this.circuit;
  }

  /**
   * Load a circuit for simulation.
   */
  loadCircuit(circuit: MixedSignalCircuit): void {
    this.circuit = circuit;
    this.steps = [];
    this.stepCount = 0;
    this.currentDigitalStates = new Map<string, LogicLevel>();
    this.previousSchmittStates = new Map<string, LogicLevel>();

    // Initialize all digital nodes to 'X'
    for (const gate of circuit.digitalGates) {
      for (const input of gate.inputs) {
        if (!this.currentDigitalStates.has(input)) {
          this.currentDigitalStates.set(input, 'X');
        }
      }
      this.currentDigitalStates.set(gate.output, 'X');
    }
    for (const adc of circuit.adcModels) {
      this.currentDigitalStates.set(adc.digitalOutput, 'X');
    }
    for (const dac of circuit.dacModels) {
      for (const input of dac.digitalInputs) {
        if (!this.currentDigitalStates.has(input)) {
          this.currentDigitalStates.set(input, 'X');
        }
      }
    }

    this.notify();
  }

  /**
   * Set digital node states externally (e.g., user-driven inputs).
   */
  setDigitalInputs(inputs: ReadonlyMap<string, LogicLevel>): void {
    Array.from(inputs.entries()).forEach(([key, value]) => {
      this.currentDigitalStates.set(key, value);
    });
    this.notify();
  }

  /**
   * Execute one simulation step.
   *
   * Flow:
   *   1. Inject DAC voltages into analog domain
   *   2. Solve analog DC
   *   3. Convert analog → digital via ADC/Schmitt trigger
   *   4. Propagate digital logic through gates
   *   5. Record step
   */
  step(timeIncrement: number = 1e-6): SimulationStep {
    if (!this.circuit) {
      throw new Error('No circuit loaded. Call loadCircuit() first.');
    }

    const circuit = this.circuit;
    const events: SimulationEvent[] = [];
    const time = this.stepCount * timeIncrement;

    // --- 1. DAC: digital → analog voltage sources ---
    const dacVoltages = new Map<string, number>();
    const extraAnalogComponents: AnalogComponent[] = [];

    for (const dac of circuit.dacModels) {
      const digitalInputs = dac.digitalInputs.map((id) =>
        this.currentDigitalStates.get(id) ?? ('X' as LogicLevel),
      );
      const voltage = dacConvert(digitalInputs, dac.vRef);
      dacVoltages.set(dac.id, voltage);

      // Add the DAC output as a voltage source on the analog output node
      extraAnalogComponents.push({
        id: `dac-vsrc-${dac.id}`,
        type: 'V',
        value: voltage,
        nodes: [dac.analogOutput, 0],
      });

      events.push({
        time,
        type: 'dac_convert',
        nodeId: dac.id,
        description: `DAC ${dac.id}: digital=[${digitalInputs.join(',')}] → ${voltage.toFixed(3)}V`,
      });
    }

    // --- 2. Solve analog DC ---
    const allAnalogComponents = [...circuit.analogComponents, ...extraAnalogComponents];
    const analogVoltages = solveAnalogDC(circuit.numAnalogNodes, allAnalogComponents);

    // --- 3. ADC: analog → digital ---
    const adcOutputs = new Map<string, number>();

    for (const adc of circuit.adcModels) {
      const inputVoltage = analogVoltages.get(adc.analogInput) ?? 0;

      if (adc.schmittTrigger || adc.bits === 1) {
        // 1-bit ADC / Schmitt trigger
        const params = adc.schmittTrigger ?? DEFAULT_SCHMITT;
        const prev = this.previousSchmittStates.get(adc.id) ?? ('X' as LogicLevel);
        const digitalOut = schmittTriggerConvert(inputVoltage, prev, params);
        this.currentDigitalStates.set(adc.digitalOutput, digitalOut);
        this.previousSchmittStates.set(adc.id, digitalOut);
        adcOutputs.set(adc.id, digitalOut === 1 ? 1 : 0);
      } else {
        // Multi-bit ADC
        const code = adcConvert(inputVoltage, adc.bits, adc.vRef);
        adcOutputs.set(adc.id, code);
        // For multi-bit ADC, set the single output node to 1 if code > half-range
        this.currentDigitalStates.set(adc.digitalOutput, code >= (1 << (adc.bits - 1)) ? 1 : 0);
      }

      events.push({
        time,
        type: 'adc_convert',
        nodeId: adc.id,
        description: `ADC ${adc.id}: ${inputVoltage.toFixed(3)}V → code=${adcOutputs.get(adc.id)}`,
      });
    }

    // --- 4. Propagate digital logic ---
    const { states: newDigitalStates, events: digitalEvents } = propagateDigital(
      circuit.digitalGates,
      this.currentDigitalStates,
    );

    // Track state changes
    Array.from(newDigitalStates.entries()).forEach(([nodeId, newState]) => {
      const oldState = this.currentDigitalStates.get(nodeId);
      if (oldState !== newState) {
        events.push({
          time,
          type: 'state_change',
          nodeId,
          description: `${nodeId}: ${String(oldState)} → ${String(newState)}`,
        });
      }
    });

    this.currentDigitalStates = newDigitalStates;
    events.push(...digitalEvents);

    // --- 5. Record step ---
    const step: SimulationStep = {
      stepIndex: this.stepCount,
      time,
      analogVoltages: new Map(analogVoltages),
      digitalStates: new Map(this.currentDigitalStates),
      adcOutputs: new Map(adcOutputs),
      dacVoltages: new Map(dacVoltages),
      events,
    };

    this.steps.push(step);
    this.stepCount++;
    this.notify();

    return step;
  }

  /**
   * Run multiple simulation steps.
   */
  run(numSteps: number, timeIncrement: number = 1e-6): readonly SimulationStep[] {
    if (numSteps < 1 || numSteps > 10000) {
      throw new Error(`numSteps must be 1–10000, got ${numSteps}`);
    }
    const results: SimulationStep[] = [];
    for (let i = 0; i < numSteps; i++) {
      results.push(this.step(timeIncrement));
    }
    return results;
  }

  /**
   * Reset the simulator state.
   */
  reset(): void {
    this.steps = [];
    this.stepCount = 0;
    this.currentDigitalStates = new Map<string, LogicLevel>();
    this.previousSchmittStates = new Map<string, LogicLevel>();

    if (this.circuit) {
      // Re-initialize digital node states to 'X'
      for (const gate of this.circuit.digitalGates) {
        for (const input of gate.inputs) {
          if (!this.currentDigitalStates.has(input)) {
            this.currentDigitalStates.set(input, 'X');
          }
        }
        this.currentDigitalStates.set(gate.output, 'X');
      }
      for (const adc of this.circuit.adcModels) {
        this.currentDigitalStates.set(adc.digitalOutput, 'X');
      }
      for (const dac of this.circuit.dacModels) {
        for (const input of dac.digitalInputs) {
          if (!this.currentDigitalStates.has(input)) {
            this.currentDigitalStates.set(input, 'X');
          }
        }
      }
    }

    this.notify();
  }

  /**
   * Analyze the circuit and return full simulation result.
   */
  analyze(): MixedSignalResult {
    if (!this.circuit) {
      throw new Error('No circuit loaded. Call loadCircuit() first.');
    }

    return {
      steps: [...this.steps],
      boundaries: detectBoundaries(this.circuit),
      nodeClassification: classifyNodes(this.circuit),
    };
  }
}
