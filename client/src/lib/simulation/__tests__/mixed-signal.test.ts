import { describe, it, expect, beforeEach } from 'vitest';
import {
  evaluateGate,
  generateTruthTable,
  schmittTriggerConvert,
  adcConvert,
  dacConvert,
  solveAnalogDC,
  detectBoundaries,
  classifyNodes,
  MixedSignalSimulator,
} from '../mixed-signal';
import type {
  GateType,
  LogicLevel,
  MixedSignalCircuit,
  AnalogComponent,
  DigitalGate,
  AdcModel,
  DacModel,
  SchmittTriggerParams,
} from '../mixed-signal';

// ---------------------------------------------------------------------------
// evaluateGate
// ---------------------------------------------------------------------------

describe('evaluateGate', () => {
  it('AND gate — all high', () => {
    expect(evaluateGate('AND', [1, 1, 1])).toBe(1);
  });

  it('AND gate — one low', () => {
    expect(evaluateGate('AND', [1, 0, 1])).toBe(0);
  });

  it('AND gate — all low', () => {
    expect(evaluateGate('AND', [0, 0])).toBe(0);
  });

  it('OR gate — one high', () => {
    expect(evaluateGate('OR', [0, 1, 0])).toBe(1);
  });

  it('OR gate — all low', () => {
    expect(evaluateGate('OR', [0, 0, 0])).toBe(0);
  });

  it('OR gate — all high', () => {
    expect(evaluateGate('OR', [1, 1])).toBe(1);
  });

  it('NOT gate — invert high', () => {
    expect(evaluateGate('NOT', [1])).toBe(0);
  });

  it('NOT gate — invert low', () => {
    expect(evaluateGate('NOT', [0])).toBe(1);
  });

  it('NAND gate — all high', () => {
    expect(evaluateGate('NAND', [1, 1])).toBe(0);
  });

  it('NAND gate — one low', () => {
    expect(evaluateGate('NAND', [1, 0])).toBe(1);
  });

  it('NOR gate — all low', () => {
    expect(evaluateGate('NOR', [0, 0])).toBe(1);
  });

  it('NOR gate — one high', () => {
    expect(evaluateGate('NOR', [1, 0])).toBe(0);
  });

  it('XOR gate — odd count of 1s', () => {
    expect(evaluateGate('XOR', [1, 0])).toBe(1);
  });

  it('XOR gate — even count of 1s', () => {
    expect(evaluateGate('XOR', [1, 1])).toBe(0);
  });

  it('XOR gate — three inputs, two high', () => {
    expect(evaluateGate('XOR', [1, 1, 0])).toBe(0);
  });

  it('XOR gate — three inputs, three high', () => {
    expect(evaluateGate('XOR', [1, 1, 1])).toBe(1);
  });

  it('XNOR gate — even count of 1s', () => {
    expect(evaluateGate('XNOR', [1, 1])).toBe(1);
  });

  it('XNOR gate — odd count of 1s', () => {
    expect(evaluateGate('XNOR', [1, 0])).toBe(0);
  });

  it('BUFFER gate — pass through high', () => {
    expect(evaluateGate('BUFFER', [1])).toBe(1);
  });

  it('BUFFER gate — pass through low', () => {
    expect(evaluateGate('BUFFER', [0])).toBe(0);
  });

  it('returns X for empty inputs', () => {
    expect(evaluateGate('AND', [])).toBe('X');
  });

  it('propagates X on any X input (AND)', () => {
    expect(evaluateGate('AND', [1, 'X'])).toBe('X');
  });

  it('propagates X on any X input (OR)', () => {
    expect(evaluateGate('OR', [0, 'X'])).toBe('X');
  });

  it('propagates X through NOT', () => {
    expect(evaluateGate('NOT', ['X'])).toBe('X');
  });

  it('propagates X through BUFFER', () => {
    expect(evaluateGate('BUFFER', ['X'])).toBe('X');
  });

  it('propagates X through NAND', () => {
    expect(evaluateGate('NAND', ['X', 1])).toBe('X');
  });

  it('propagates X through NOR', () => {
    expect(evaluateGate('NOR', ['X', 0])).toBe('X');
  });

  it('propagates X through XOR', () => {
    expect(evaluateGate('XOR', ['X', 1])).toBe('X');
  });

  it('propagates X through XNOR', () => {
    expect(evaluateGate('XNOR', ['X', 0])).toBe('X');
  });
});

// ---------------------------------------------------------------------------
// generateTruthTable
// ---------------------------------------------------------------------------

describe('generateTruthTable', () => {
  it('generates correct 2-input AND table', () => {
    const table = generateTruthTable('AND', 2);
    expect(table).toHaveLength(4);
    expect(table[0]).toEqual({ inputs: [0, 0], output: 0 });
    expect(table[1]).toEqual({ inputs: [0, 1], output: 0 });
    expect(table[2]).toEqual({ inputs: [1, 0], output: 0 });
    expect(table[3]).toEqual({ inputs: [1, 1], output: 1 });
  });

  it('generates correct 1-input NOT table', () => {
    const table = generateTruthTable('NOT', 1);
    expect(table).toHaveLength(2);
    expect(table[0]).toEqual({ inputs: [0], output: 1 });
    expect(table[1]).toEqual({ inputs: [1], output: 0 });
  });

  it('generates correct 2-input XOR table', () => {
    const table = generateTruthTable('XOR', 2);
    expect(table).toHaveLength(4);
    expect(table[0]).toEqual({ inputs: [0, 0], output: 0 });
    expect(table[1]).toEqual({ inputs: [0, 1], output: 1 });
    expect(table[2]).toEqual({ inputs: [1, 0], output: 1 });
    expect(table[3]).toEqual({ inputs: [1, 1], output: 0 });
  });

  it('generates 3-input NOR table with 8 rows', () => {
    const table = generateTruthTable('NOR', 3);
    expect(table).toHaveLength(8);
    // Only all-zeros → 1
    expect(table[0]).toEqual({ inputs: [0, 0, 0], output: 1 });
    for (let i = 1; i < 8; i++) {
      expect(table[i].output).toBe(0);
    }
  });

  it('throws for numInputs < 1', () => {
    expect(() => generateTruthTable('AND', 0)).toThrow('numInputs must be 1–8');
  });

  it('throws for numInputs > 8', () => {
    expect(() => generateTruthTable('OR', 9)).toThrow('numInputs must be 1–8');
  });

  it('generates correct 2-input XNOR table', () => {
    const table = generateTruthTable('XNOR', 2);
    expect(table).toHaveLength(4);
    expect(table[0]).toEqual({ inputs: [0, 0], output: 1 });
    expect(table[1]).toEqual({ inputs: [0, 1], output: 0 });
    expect(table[2]).toEqual({ inputs: [1, 0], output: 0 });
    expect(table[3]).toEqual({ inputs: [1, 1], output: 1 });
  });

  it('generates 1-input BUFFER table', () => {
    const table = generateTruthTable('BUFFER', 1);
    expect(table).toHaveLength(2);
    expect(table[0]).toEqual({ inputs: [0], output: 0 });
    expect(table[1]).toEqual({ inputs: [1], output: 1 });
  });
});

// ---------------------------------------------------------------------------
// schmittTriggerConvert
// ---------------------------------------------------------------------------

describe('schmittTriggerConvert', () => {
  const params: SchmittTriggerParams = { vHigh: 3.0, vLow: 1.5 };

  it('returns 1 when voltage >= vHigh', () => {
    expect(schmittTriggerConvert(3.0, 0, params)).toBe(1);
    expect(schmittTriggerConvert(4.5, 0, params)).toBe(1);
  });

  it('returns 0 when voltage <= vLow', () => {
    expect(schmittTriggerConvert(1.5, 1, params)).toBe(0);
    expect(schmittTriggerConvert(0.5, 1, params)).toBe(0);
  });

  it('maintains previous state in hysteresis band', () => {
    expect(schmittTriggerConvert(2.0, 0, params)).toBe(0);
    expect(schmittTriggerConvert(2.0, 1, params)).toBe(1);
  });

  it('converts X to 0 in hysteresis band', () => {
    expect(schmittTriggerConvert(2.0, 'X', params)).toBe(0);
  });

  it('uses default params when none provided', () => {
    expect(schmittTriggerConvert(5.0, 0)).toBe(1);
    expect(schmittTriggerConvert(0.0, 1)).toBe(0);
  });

  it('hysteresis prevents toggling for small oscillations', () => {
    // Start low, ramp up to 2.5V (still below vHigh 3.0)
    let state: LogicLevel = 0;
    state = schmittTriggerConvert(2.5, state, params);
    expect(state).toBe(0); // Still in hysteresis band, stays low

    // Cross above vHigh
    state = schmittTriggerConvert(3.5, state, params);
    expect(state).toBe(1);

    // Drop back to 2.5V (above vLow 1.5)
    state = schmittTriggerConvert(2.5, state, params);
    expect(state).toBe(1); // Stays high — hysteresis!

    // Drop below vLow
    state = schmittTriggerConvert(1.0, state, params);
    expect(state).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// adcConvert
// ---------------------------------------------------------------------------

describe('adcConvert', () => {
  it('converts 0V to code 0', () => {
    expect(adcConvert(0, 10, 5.0)).toBe(0);
  });

  it('converts vRef to max code', () => {
    expect(adcConvert(5.0, 10, 5.0)).toBe(1023);
  });

  it('converts half vRef to ~half max code', () => {
    expect(adcConvert(2.5, 10, 5.0)).toBe(512);
  });

  it('clamps negative voltage to 0', () => {
    expect(adcConvert(-1.0, 10, 5.0)).toBe(0);
  });

  it('clamps above vRef to max code', () => {
    expect(adcConvert(6.0, 10, 5.0)).toBe(1023);
  });

  it('works with 8-bit resolution', () => {
    expect(adcConvert(5.0, 8, 5.0)).toBe(255);
    expect(adcConvert(2.5, 8, 5.0)).toBe(128);
  });

  it('works with 1-bit resolution', () => {
    expect(adcConvert(0, 1, 5.0)).toBe(0);
    expect(adcConvert(5.0, 1, 5.0)).toBe(1);
  });

  it('works with 16-bit resolution', () => {
    expect(adcConvert(5.0, 16, 5.0)).toBe(65535);
  });

  it('converts 3.3V ref correctly', () => {
    expect(adcConvert(3.3, 10, 3.3)).toBe(1023);
  });
});

// ---------------------------------------------------------------------------
// dacConvert
// ---------------------------------------------------------------------------

describe('dacConvert', () => {
  it('all-zero inputs produce 0V', () => {
    expect(dacConvert([0, 0, 0, 0], 5.0)).toBe(0);
  });

  it('all-one inputs produce vRef', () => {
    expect(dacConvert([1, 1, 1, 1], 5.0)).toBe(5.0);
  });

  it('MSB-only produces half vRef (approximately)', () => {
    // 4-bit: 1000 = 8/15 * 5.0 ≈ 2.667V
    const v = dacConvert([1, 0, 0, 0], 5.0);
    expect(v).toBeCloseTo(8 / 15 * 5.0, 5);
  });

  it('returns 0V for empty inputs', () => {
    expect(dacConvert([], 5.0)).toBe(0);
  });

  it('returns 0V when any input is X', () => {
    expect(dacConvert([1, 'X', 0], 5.0)).toBe(0);
  });

  it('single bit DAC: 0 → 0V, 1 → vRef', () => {
    expect(dacConvert([0], 3.3)).toBe(0);
    expect(dacConvert([1], 3.3)).toBe(3.3);
  });

  it('8-bit DAC produces correct mid-range voltage', () => {
    // 10000000 = 128/255 * 5.0 ≈ 2.510V
    const inputs: LogicLevel[] = [1, 0, 0, 0, 0, 0, 0, 0];
    const v = dacConvert(inputs, 5.0);
    expect(v).toBeCloseTo(128 / 255 * 5.0, 5);
  });
});

// ---------------------------------------------------------------------------
// solveAnalogDC
// ---------------------------------------------------------------------------

describe('solveAnalogDC', () => {
  it('returns empty map for 0 nodes', () => {
    const result = solveAnalogDC(0, []);
    expect(result.size).toBe(0);
  });

  it('solves single voltage source', () => {
    const components: AnalogComponent[] = [
      { id: 'V1', type: 'V', value: 5.0, nodes: [1, 0] },
    ];
    const result = solveAnalogDC(1, components);
    expect(result.get(0)).toBe(0);
    expect(result.get(1)).toBeCloseTo(5.0, 10);
  });

  it('solves voltage divider R1=10k R2=10k → 2.5V', () => {
    const components: AnalogComponent[] = [
      { id: 'V1', type: 'V', value: 5.0, nodes: [1, 0] },
      { id: 'R1', type: 'R', value: 10000, nodes: [1, 2] },
      { id: 'R2', type: 'R', value: 10000, nodes: [2, 0] },
    ];
    const result = solveAnalogDC(2, components);
    expect(result.get(0)).toBe(0);
    expect(result.get(1)).toBeCloseTo(5.0, 6);
    expect(result.get(2)).toBeCloseTo(2.5, 6);
  });

  it('solves current source with resistor', () => {
    // I=1mA through R=1k → V = 1V
    const components: AnalogComponent[] = [
      { id: 'I1', type: 'I', value: 0.001, nodes: [0, 1] },
      { id: 'R1', type: 'R', value: 1000, nodes: [1, 0] },
    ];
    const result = solveAnalogDC(1, components);
    expect(result.get(1)).toBeCloseTo(1.0, 6);
  });

  it('handles multiple voltage sources', () => {
    const components: AnalogComponent[] = [
      { id: 'V1', type: 'V', value: 5.0, nodes: [1, 0] },
      { id: 'V2', type: 'V', value: 3.3, nodes: [2, 0] },
      { id: 'R1', type: 'R', value: 1000, nodes: [1, 2] },
    ];
    const result = solveAnalogDC(2, components);
    expect(result.get(1)).toBeCloseTo(5.0, 6);
    expect(result.get(2)).toBeCloseTo(3.3, 6);
  });

  it('skips zero-value resistors', () => {
    const components: AnalogComponent[] = [
      { id: 'V1', type: 'V', value: 5.0, nodes: [1, 0] },
      { id: 'R0', type: 'R', value: 0, nodes: [1, 2] },
      { id: 'R1', type: 'R', value: 1000, nodes: [2, 0] },
    ];
    // Zero resistor is skipped — node 2 only connected via R1 to ground
    const result = solveAnalogDC(2, components);
    expect(result.get(1)).toBeCloseTo(5.0, 6);
  });
});

// ---------------------------------------------------------------------------
// detectBoundaries
// ---------------------------------------------------------------------------

describe('detectBoundaries', () => {
  it('detects ADC boundaries', () => {
    const circuit: MixedSignalCircuit = {
      numAnalogNodes: 2,
      analogComponents: [],
      digitalGates: [],
      adcModels: [
        { id: 'adc1', analogInput: 1, digitalOutput: 'd_out', bits: 10, vRef: 5.0 },
      ],
      dacModels: [],
    };
    const boundaries = detectBoundaries(circuit);
    expect(boundaries).toHaveLength(1);
    expect(boundaries[0].type).toBe('adc');
    expect(boundaries[0].analogNode).toBe(1);
    expect(boundaries[0].digitalNodes).toEqual(['d_out']);
  });

  it('detects DAC boundaries', () => {
    const circuit: MixedSignalCircuit = {
      numAnalogNodes: 1,
      analogComponents: [],
      digitalGates: [],
      adcModels: [],
      dacModels: [
        { id: 'dac1', digitalInputs: ['d0', 'd1'], analogOutput: 1, vRef: 5.0 },
      ],
    };
    const boundaries = detectBoundaries(circuit);
    expect(boundaries).toHaveLength(1);
    expect(boundaries[0].type).toBe('dac');
    expect(boundaries[0].analogNode).toBe(1);
    expect(boundaries[0].digitalNodes).toEqual(['d0', 'd1']);
  });

  it('detects multiple boundaries', () => {
    const circuit: MixedSignalCircuit = {
      numAnalogNodes: 2,
      analogComponents: [],
      digitalGates: [],
      adcModels: [
        { id: 'adc1', analogInput: 1, digitalOutput: 'd_out', bits: 10, vRef: 5.0 },
      ],
      dacModels: [
        { id: 'dac1', digitalInputs: ['d0'], analogOutput: 2, vRef: 3.3 },
      ],
    };
    const boundaries = detectBoundaries(circuit);
    expect(boundaries).toHaveLength(2);
  });

  it('returns empty for pure analog circuit', () => {
    const circuit: MixedSignalCircuit = {
      numAnalogNodes: 1,
      analogComponents: [{ id: 'R1', type: 'R', value: 1000, nodes: [1, 0] }],
      digitalGates: [],
      adcModels: [],
      dacModels: [],
    };
    expect(detectBoundaries(circuit)).toHaveLength(0);
  });

  it('returns empty for pure digital circuit', () => {
    const circuit: MixedSignalCircuit = {
      numAnalogNodes: 0,
      analogComponents: [],
      digitalGates: [{ id: 'g1', gateType: 'NOT', inputs: ['a'], output: 'b' }],
      adcModels: [],
      dacModels: [],
    };
    expect(detectBoundaries(circuit)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// classifyNodes
// ---------------------------------------------------------------------------

describe('classifyNodes', () => {
  it('classifies analog component nodes', () => {
    const circuit: MixedSignalCircuit = {
      numAnalogNodes: 2,
      analogComponents: [
        { id: 'R1', type: 'R', value: 1000, nodes: [1, 2] },
      ],
      digitalGates: [],
      adcModels: [],
      dacModels: [],
    };
    const map = classifyNodes(circuit);
    expect(map.get('analog:1')).toBe('analog');
    expect(map.get('analog:2')).toBe('analog');
  });

  it('classifies digital gate nodes', () => {
    const circuit: MixedSignalCircuit = {
      numAnalogNodes: 0,
      analogComponents: [],
      digitalGates: [
        { id: 'g1', gateType: 'AND', inputs: ['a', 'b'], output: 'c' },
      ],
      adcModels: [],
      dacModels: [],
    };
    const map = classifyNodes(circuit);
    expect(map.get('a')).toBe('digital');
    expect(map.get('b')).toBe('digital');
    expect(map.get('c')).toBe('digital');
  });

  it('classifies ADC nodes in both domains', () => {
    const circuit: MixedSignalCircuit = {
      numAnalogNodes: 1,
      analogComponents: [],
      digitalGates: [],
      adcModels: [
        { id: 'adc1', analogInput: 1, digitalOutput: 'd_out', bits: 10, vRef: 5.0 },
      ],
      dacModels: [],
    };
    const map = classifyNodes(circuit);
    expect(map.get('analog:1')).toBe('analog');
    expect(map.get('d_out')).toBe('digital');
  });

  it('classifies DAC nodes in both domains', () => {
    const circuit: MixedSignalCircuit = {
      numAnalogNodes: 1,
      analogComponents: [],
      digitalGates: [],
      adcModels: [],
      dacModels: [
        { id: 'dac1', digitalInputs: ['d0', 'd1'], analogOutput: 1, vRef: 5.0 },
      ],
    };
    const map = classifyNodes(circuit);
    expect(map.get('analog:1')).toBe('analog');
    expect(map.get('d0')).toBe('digital');
    expect(map.get('d1')).toBe('digital');
  });
});

// ---------------------------------------------------------------------------
// MixedSignalSimulator — singleton + lifecycle
// ---------------------------------------------------------------------------

describe('MixedSignalSimulator', () => {
  beforeEach(() => {
    MixedSignalSimulator.resetInstance();
  });

  it('returns singleton instance', () => {
    const a = MixedSignalSimulator.getInstance();
    const b = MixedSignalSimulator.getInstance();
    expect(a).toBe(b);
  });

  it('resetInstance creates fresh instance', () => {
    const a = MixedSignalSimulator.getInstance();
    MixedSignalSimulator.resetInstance();
    const b = MixedSignalSimulator.getInstance();
    expect(a).not.toBe(b);
  });

  it('throws when stepping without loaded circuit', () => {
    const sim = MixedSignalSimulator.getInstance();
    expect(() => sim.step()).toThrow('No circuit loaded');
  });

  it('throws when analyzing without loaded circuit', () => {
    const sim = MixedSignalSimulator.getInstance();
    expect(() => sim.analyze()).toThrow('No circuit loaded');
  });

  it('subscribe notifies on loadCircuit', () => {
    const sim = MixedSignalSimulator.getInstance();
    let called = 0;
    sim.subscribe(() => { called++; });

    const circuit: MixedSignalCircuit = {
      numAnalogNodes: 0,
      analogComponents: [],
      digitalGates: [],
      adcModels: [],
      dacModels: [],
    };
    sim.loadCircuit(circuit);
    expect(called).toBeGreaterThan(0);
  });

  it('unsubscribe stops notifications', () => {
    const sim = MixedSignalSimulator.getInstance();
    let called = 0;
    const unsub = sim.subscribe(() => { called++; });
    unsub();

    const circuit: MixedSignalCircuit = {
      numAnalogNodes: 0,
      analogComponents: [],
      digitalGates: [],
      adcModels: [],
      dacModels: [],
    };
    sim.loadCircuit(circuit);
    expect(called).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// MixedSignalSimulator — pure digital simulation
// ---------------------------------------------------------------------------

describe('MixedSignalSimulator — digital only', () => {
  beforeEach(() => {
    MixedSignalSimulator.resetInstance();
  });

  it('simulates NOT gate chain', () => {
    const sim = MixedSignalSimulator.getInstance();
    const circuit: MixedSignalCircuit = {
      numAnalogNodes: 0,
      analogComponents: [],
      digitalGates: [
        { id: 'inv1', gateType: 'NOT', inputs: ['in'], output: 'mid' },
        { id: 'inv2', gateType: 'NOT', inputs: ['mid'], output: 'out' },
      ],
      adcModels: [],
      dacModels: [],
    };
    sim.loadCircuit(circuit);
    sim.setDigitalInputs(new Map([['in', 1 as LogicLevel]]));

    const step = sim.step();
    expect(step.digitalStates.get('mid')).toBe(0);
    expect(step.digitalStates.get('out')).toBe(1);
  });

  it('simulates AND gate', () => {
    const sim = MixedSignalSimulator.getInstance();
    const circuit: MixedSignalCircuit = {
      numAnalogNodes: 0,
      analogComponents: [],
      digitalGates: [
        { id: 'and1', gateType: 'AND', inputs: ['a', 'b'], output: 'out' },
      ],
      adcModels: [],
      dacModels: [],
    };
    sim.loadCircuit(circuit);

    sim.setDigitalInputs(new Map([['a', 1 as LogicLevel], ['b', 0 as LogicLevel]]));
    const step1 = sim.step();
    expect(step1.digitalStates.get('out')).toBe(0);

    sim.setDigitalInputs(new Map([['b', 1 as LogicLevel]]));
    const step2 = sim.step();
    expect(step2.digitalStates.get('out')).toBe(1);
  });

  it('simulates SR latch (NOR-NOR)', () => {
    const sim = MixedSignalSimulator.getInstance();
    const circuit: MixedSignalCircuit = {
      numAnalogNodes: 0,
      analogComponents: [],
      digitalGates: [
        { id: 'nor1', gateType: 'NOR', inputs: ['S', 'Q_bar'], output: 'Q' },
        { id: 'nor2', gateType: 'NOR', inputs: ['R', 'Q'], output: 'Q_bar' },
      ],
      adcModels: [],
      dacModels: [],
    };
    sim.loadCircuit(circuit);

    // Set S=1, R=0 → Q should be 1
    sim.setDigitalInputs(new Map([['S', 1 as LogicLevel], ['R', 0 as LogicLevel]]));
    const step1 = sim.step();
    expect(step1.digitalStates.get('Q')).toBe(0); // NOR(1, Q_bar) = 0 since S=1

    // More complex — the latch behavior depends on propagation
    // After S=1, Q_bar should go 0, then Q = NOR(1, 0) = 0 — S=1 forces Q to 0 for NOR-based
    // Actually for active-high NOR latch: S=1,R=0 → Q=0 (Q_bar NOR with R=0,Q=0 → 1)
    // Let's just check it reaches a stable state
    expect(step1.digitalStates.get('Q')).not.toBe('X');
  });

  it('tracks step count correctly', () => {
    const sim = MixedSignalSimulator.getInstance();
    const circuit: MixedSignalCircuit = {
      numAnalogNodes: 0,
      analogComponents: [],
      digitalGates: [{ id: 'buf', gateType: 'BUFFER', inputs: ['in'], output: 'out' }],
      adcModels: [],
      dacModels: [],
    };
    sim.loadCircuit(circuit);
    sim.setDigitalInputs(new Map([['in', 1 as LogicLevel]]));

    const s1 = sim.step();
    const s2 = sim.step();
    const s3 = sim.step();

    expect(s1.stepIndex).toBe(0);
    expect(s2.stepIndex).toBe(1);
    expect(s3.stepIndex).toBe(2);
  });

  it('generates events on state change', () => {
    const sim = MixedSignalSimulator.getInstance();
    const circuit: MixedSignalCircuit = {
      numAnalogNodes: 0,
      analogComponents: [],
      digitalGates: [{ id: 'not1', gateType: 'NOT', inputs: ['in'], output: 'out' }],
      adcModels: [],
      dacModels: [],
    };
    sim.loadCircuit(circuit);
    sim.setDigitalInputs(new Map([['in', 0 as LogicLevel]]));

    const step = sim.step();
    const gateEvents = step.events.filter((e) => e.type === 'gate_eval');
    expect(gateEvents.length).toBeGreaterThan(0);
    expect(gateEvents[0].description).toContain('NOT');
  });
});

// ---------------------------------------------------------------------------
// MixedSignalSimulator — pure analog simulation
// ---------------------------------------------------------------------------

describe('MixedSignalSimulator — analog only', () => {
  beforeEach(() => {
    MixedSignalSimulator.resetInstance();
  });

  it('simulates voltage divider', () => {
    const sim = MixedSignalSimulator.getInstance();
    const circuit: MixedSignalCircuit = {
      numAnalogNodes: 2,
      analogComponents: [
        { id: 'V1', type: 'V', value: 10.0, nodes: [1, 0] },
        { id: 'R1', type: 'R', value: 1000, nodes: [1, 2] },
        { id: 'R2', type: 'R', value: 1000, nodes: [2, 0] },
      ],
      digitalGates: [],
      adcModels: [],
      dacModels: [],
    };
    sim.loadCircuit(circuit);
    const step = sim.step();
    expect(step.analogVoltages.get(2)).toBeCloseTo(5.0, 6);
  });
});

// ---------------------------------------------------------------------------
// MixedSignalSimulator — mixed-signal (ADC + DAC)
// ---------------------------------------------------------------------------

describe('MixedSignalSimulator — mixed-signal', () => {
  beforeEach(() => {
    MixedSignalSimulator.resetInstance();
  });

  it('ADC converts analog voltage to digital', () => {
    const sim = MixedSignalSimulator.getInstance();
    const circuit: MixedSignalCircuit = {
      numAnalogNodes: 1,
      analogComponents: [
        { id: 'V1', type: 'V', value: 4.0, nodes: [1, 0] },
      ],
      digitalGates: [],
      adcModels: [
        { id: 'adc1', analogInput: 1, digitalOutput: 'd_out', bits: 10, vRef: 5.0 },
      ],
      dacModels: [],
    };
    sim.loadCircuit(circuit);
    const step = sim.step();

    // 4V / 5V * 1023 ≈ 818
    expect(step.adcOutputs.get('adc1')).toBe(818);
    // 818 >= 512 → digital output is 1
    expect(step.digitalStates.get('d_out')).toBe(1);
  });

  it('ADC with Schmitt trigger provides hysteresis', () => {
    const sim = MixedSignalSimulator.getInstance();
    const circuit: MixedSignalCircuit = {
      numAnalogNodes: 1,
      analogComponents: [
        { id: 'V1', type: 'V', value: 2.0, nodes: [1, 0] },
      ],
      digitalGates: [],
      adcModels: [
        {
          id: 'adc1',
          analogInput: 1,
          digitalOutput: 'd_out',
          bits: 1,
          vRef: 5.0,
          schmittTrigger: { vHigh: 3.0, vLow: 1.5 },
        },
      ],
      dacModels: [],
    };
    sim.loadCircuit(circuit);

    // 2.0V is in hysteresis band, initial state is X → defaults to 0
    const step1 = sim.step();
    expect(step1.digitalStates.get('d_out')).toBe(0);

    // ADC output events generated
    const adcEvents = step1.events.filter((e) => e.type === 'adc_convert');
    expect(adcEvents.length).toBe(1);
  });

  it('DAC converts digital inputs to analog voltage', () => {
    const sim = MixedSignalSimulator.getInstance();
    const circuit: MixedSignalCircuit = {
      numAnalogNodes: 1,
      analogComponents: [
        { id: 'R1', type: 'R', value: 1000, nodes: [1, 0] },
      ],
      digitalGates: [],
      adcModels: [],
      dacModels: [
        { id: 'dac1', digitalInputs: ['d0', 'd1'], analogOutput: 1, vRef: 5.0 },
      ],
    };
    sim.loadCircuit(circuit);

    // Set digital inputs to [1, 1] = 3/3 * 5.0 = 5.0V
    sim.setDigitalInputs(new Map([
      ['d0', 1 as LogicLevel],
      ['d1', 1 as LogicLevel],
    ]));

    const step = sim.step();
    expect(step.dacVoltages.get('dac1')).toBeCloseTo(5.0, 5);

    // DAC events generated
    const dacEvents = step.events.filter((e) => e.type === 'dac_convert');
    expect(dacEvents.length).toBe(1);
  });

  it('end-to-end: analog → ADC → digital logic → DAC → analog', () => {
    const sim = MixedSignalSimulator.getInstance();
    const circuit: MixedSignalCircuit = {
      numAnalogNodes: 2,
      analogComponents: [
        { id: 'V1', type: 'V', value: 4.0, nodes: [1, 0] },
        { id: 'R1', type: 'R', value: 1000, nodes: [2, 0] },
      ],
      digitalGates: [
        { id: 'not1', gateType: 'NOT', inputs: ['adc_out'], output: 'dac_in' },
      ],
      adcModels: [
        {
          id: 'adc1',
          analogInput: 1,
          digitalOutput: 'adc_out',
          bits: 1,
          vRef: 5.0,
          schmittTrigger: { vHigh: 3.0, vLow: 1.5 },
        },
      ],
      dacModels: [
        { id: 'dac1', digitalInputs: ['dac_in'], analogOutput: 2, vRef: 5.0 },
      ],
    };
    sim.loadCircuit(circuit);

    const step = sim.step();

    // 4.0V > 3.0V (vHigh) → ADC outputs 1
    expect(step.digitalStates.get('adc_out')).toBe(1);
    // NOT(1) = 0
    expect(step.digitalStates.get('dac_in')).toBe(0);
    // DAC with single input [0] → 0V
    expect(step.dacVoltages.get('dac1')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// MixedSignalSimulator — run + reset
// ---------------------------------------------------------------------------

describe('MixedSignalSimulator — run and reset', () => {
  beforeEach(() => {
    MixedSignalSimulator.resetInstance();
  });

  it('run() executes multiple steps', () => {
    const sim = MixedSignalSimulator.getInstance();
    const circuit: MixedSignalCircuit = {
      numAnalogNodes: 1,
      analogComponents: [{ id: 'V1', type: 'V', value: 5.0, nodes: [1, 0] }],
      digitalGates: [],
      adcModels: [],
      dacModels: [],
    };
    sim.loadCircuit(circuit);

    const steps = sim.run(5);
    expect(steps).toHaveLength(5);
    expect(steps[0].stepIndex).toBe(0);
    expect(steps[4].stepIndex).toBe(4);
  });

  it('run() throws for numSteps < 1', () => {
    const sim = MixedSignalSimulator.getInstance();
    sim.loadCircuit({
      numAnalogNodes: 0, analogComponents: [], digitalGates: [],
      adcModels: [], dacModels: [],
    });
    expect(() => sim.run(0)).toThrow('numSteps must be 1–10000');
  });

  it('run() throws for numSteps > 10000', () => {
    const sim = MixedSignalSimulator.getInstance();
    sim.loadCircuit({
      numAnalogNodes: 0, analogComponents: [], digitalGates: [],
      adcModels: [], dacModels: [],
    });
    expect(() => sim.run(10001)).toThrow('numSteps must be 1–10000');
  });

  it('reset() clears steps and restores initial states', () => {
    const sim = MixedSignalSimulator.getInstance();
    const circuit: MixedSignalCircuit = {
      numAnalogNodes: 0,
      analogComponents: [],
      digitalGates: [{ id: 'buf', gateType: 'BUFFER', inputs: ['in'], output: 'out' }],
      adcModels: [],
      dacModels: [],
    };
    sim.loadCircuit(circuit);
    sim.setDigitalInputs(new Map([['in', 1 as LogicLevel]]));
    sim.run(3);
    expect(sim.getSteps()).toHaveLength(3);

    sim.reset();
    expect(sim.getSteps()).toHaveLength(0);
  });

  it('analyze() returns boundaries and classification', () => {
    const sim = MixedSignalSimulator.getInstance();
    const circuit: MixedSignalCircuit = {
      numAnalogNodes: 1,
      analogComponents: [{ id: 'V1', type: 'V', value: 5.0, nodes: [1, 0] }],
      digitalGates: [{ id: 'not1', gateType: 'NOT', inputs: ['d_in'], output: 'd_out' }],
      adcModels: [
        { id: 'adc1', analogInput: 1, digitalOutput: 'd_in', bits: 10, vRef: 5.0 },
      ],
      dacModels: [],
    };
    sim.loadCircuit(circuit);
    sim.step();

    const result = sim.analyze();
    expect(result.boundaries).toHaveLength(1);
    expect(result.boundaries[0].type).toBe('adc');
    expect(result.nodeClassification.get('analog:1')).toBe('analog');
    expect(result.nodeClassification.get('d_in')).toBe('digital');
    expect(result.nodeClassification.get('d_out')).toBe('digital');
    expect(result.steps).toHaveLength(1);
  });

  it('getCircuit() returns loaded circuit', () => {
    const sim = MixedSignalSimulator.getInstance();
    expect(sim.getCircuit()).toBeNull();

    const circuit: MixedSignalCircuit = {
      numAnalogNodes: 0, analogComponents: [], digitalGates: [],
      adcModels: [], dacModels: [],
    };
    sim.loadCircuit(circuit);
    expect(sim.getCircuit()).toBe(circuit);
  });

  it('time increments correctly across steps', () => {
    const sim = MixedSignalSimulator.getInstance();
    sim.loadCircuit({
      numAnalogNodes: 0, analogComponents: [], digitalGates: [],
      adcModels: [], dacModels: [],
    });

    const steps = sim.run(3, 0.001);
    expect(steps[0].time).toBeCloseTo(0, 10);
    expect(steps[1].time).toBeCloseTo(0.001, 10);
    expect(steps[2].time).toBeCloseTo(0.002, 10);
  });
});
