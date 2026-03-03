/**
 * Vitest tests for the DC Operating Point Analysis Engine
 *
 * Coverage:
 *   - Simple resistive divider (2 resistors, 1 voltage source)
 *   - Series resistors (verify V=IR at each)
 *   - Parallel resistors (verify equivalent resistance)
 *   - Current source with resistive load
 *   - Multiple voltage sources
 *   - Kirchhoff's current law (KCL): sum of currents at each node = 0
 *   - Kirchhoff's voltage law (KVL): sum of voltages around loop = 0
 *   - Power conservation: source power = dissipated power
 *   - Edge cases: open circuit, short circuit detection, singular matrix
 *   - Formatting functions (mV, V, kV, etc.)
 *   - Ground node selection
 *   - SolverInput interop via solverInputToDCCircuit
 *   - Inductors as short circuits at DC
 *   - Capacitors as open circuits at DC
 *   - VCVS (voltage-controlled voltage source)
 *   - VCCS (voltage-controlled current source)
 */

import { describe, it, expect } from 'vitest';
import {
  solveDCOperatingPoint,
  solverInputToDCCircuit,
  formatVoltage,
  formatCurrent,
  formatPower,
} from '../dc-analysis';
import type { DCCircuitDefinition, DCComponent } from '../dc-analysis';
import type { SolverInput } from '../circuit-solver';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Absolute tolerance for floating-point comparisons. */
const TOL = 1e-6;

/** Relative tolerance for physics-level checks. */
const REL_TOL = 0.01; // 1%

function approx(actual: number, expected: number, tolerance = TOL): boolean {
  return Math.abs(actual - expected) <= tolerance;
}

function relApprox(actual: number, expected: number, relTol = REL_TOL): boolean {
  if (expected === 0) {
    return Math.abs(actual) < relTol;
  }
  return Math.abs((actual - expected) / expected) <= relTol;
}

// ---------------------------------------------------------------------------
// Simple resistive divider
// ---------------------------------------------------------------------------

describe('DC Analysis: Resistive Voltage Divider', () => {
  // Circuit: V1 (5V, node 1 to GND) -> R1 (1k, node 1 to 2) -> R2 (1k, node 2 to GND)
  // Expected: V(node 1) = 5V, V(node 2) = 2.5V
  const divider: DCCircuitDefinition = {
    nodeIds: ['1', '2'],
    components: [
      { id: 'V1', type: 'V', value: 5, nodes: ['1', '0'] },
      { id: 'R1', type: 'R', value: 1000, nodes: ['1', '2'] },
      { id: 'R2', type: 'R', value: 1000, nodes: ['2', '0'] },
    ],
    groundNode: '0',
  };

  it('converges successfully', () => {
    const result = solveDCOperatingPoint(divider);
    expect(result.converged).toBe(true);
    expect(result.iterations).toBe(1);
  });

  it('node 1 voltage is 5V (source voltage)', () => {
    const result = solveDCOperatingPoint(divider);
    expect(approx(result.nodeVoltages.get('1') ?? NaN, 5)).toBe(true);
  });

  it('node 2 voltage is 2.5V (half of source)', () => {
    const result = solveDCOperatingPoint(divider);
    expect(approx(result.nodeVoltages.get('2') ?? NaN, 2.5)).toBe(true);
  });

  it('ground node voltage is 0V', () => {
    const result = solveDCOperatingPoint(divider);
    expect(result.nodeVoltages.get('0')).toBe(0);
  });

  it('current through R1 equals current through R2', () => {
    const result = solveDCOperatingPoint(divider);
    const iR1 = result.branchCurrents.get('R1') ?? NaN;
    const iR2 = result.branchCurrents.get('R2') ?? NaN;
    expect(approx(iR1, iR2)).toBe(true);
  });

  it('current is V/R_total = 5/(1000+1000) = 2.5mA', () => {
    const result = solveDCOperatingPoint(divider);
    const iR1 = result.branchCurrents.get('R1') ?? NaN;
    expect(approx(iR1, 5 / 2000)).toBe(true);
  });

  it('total power is source voltage * current', () => {
    const result = solveDCOperatingPoint(divider);
    const expectedPower = 5 * (5 / 2000); // V * I = 12.5 mW
    expect(relApprox(result.totalPower, expectedPower)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Series resistors
// ---------------------------------------------------------------------------

describe('DC Analysis: Series Resistors', () => {
  // V1 (10V) -> R1 (1k, node 1->2) -> R2 (2k, node 2->3) -> R3 (2k, node 3->GND)
  // Total R = 5k, I = 10V / 5k = 2mA
  // V(1) = 10V, V(2) = 10 - 2mA*1k = 8V, V(3) = 8 - 2mA*2k = 4V
  const series: DCCircuitDefinition = {
    nodeIds: ['1', '2', '3'],
    components: [
      { id: 'V1', type: 'V', value: 10, nodes: ['1', '0'] },
      { id: 'R1', type: 'R', value: 1000, nodes: ['1', '2'] },
      { id: 'R2', type: 'R', value: 2000, nodes: ['2', '3'] },
      { id: 'R3', type: 'R', value: 2000, nodes: ['3', '0'] },
    ],
    groundNode: '0',
  };

  it('converges', () => {
    const result = solveDCOperatingPoint(series);
    expect(result.converged).toBe(true);
  });

  it('V(node 1) = 10V', () => {
    const result = solveDCOperatingPoint(series);
    expect(approx(result.nodeVoltages.get('1') ?? NaN, 10)).toBe(true);
  });

  it('V(node 2) = 8V', () => {
    const result = solveDCOperatingPoint(series);
    expect(approx(result.nodeVoltages.get('2') ?? NaN, 8)).toBe(true);
  });

  it('V(node 3) = 4V', () => {
    const result = solveDCOperatingPoint(series);
    expect(approx(result.nodeVoltages.get('3') ?? NaN, 4)).toBe(true);
  });

  it('all resistor currents are equal (series circuit)', () => {
    const result = solveDCOperatingPoint(series);
    const iR1 = result.branchCurrents.get('R1') ?? NaN;
    const iR2 = result.branchCurrents.get('R2') ?? NaN;
    const iR3 = result.branchCurrents.get('R3') ?? NaN;
    expect(approx(iR1, iR2)).toBe(true);
    expect(approx(iR2, iR3)).toBe(true);
  });

  it('current is 2mA (V=IR: 10V / 5kOhm)', () => {
    const result = solveDCOperatingPoint(series);
    const iR1 = result.branchCurrents.get('R1') ?? NaN;
    expect(approx(iR1, 0.002)).toBe(true);
  });

  it('V=IR holds for each resistor', () => {
    const result = solveDCOperatingPoint(series);
    const v = result.nodeVoltages;
    const i = result.branchCurrents;

    // R1: V(1) - V(2) = I_R1 * 1k
    const vR1 = (v.get('1') ?? 0) - (v.get('2') ?? 0);
    expect(approx(vR1, (i.get('R1') ?? 0) * 1000)).toBe(true);

    // R2: V(2) - V(3) = I_R2 * 2k
    const vR2 = (v.get('2') ?? 0) - (v.get('3') ?? 0);
    expect(approx(vR2, (i.get('R2') ?? 0) * 2000)).toBe(true);

    // R3: V(3) - V(GND) = I_R3 * 2k
    const vR3 = (v.get('3') ?? 0) - 0;
    expect(approx(vR3, (i.get('R3') ?? 0) * 2000)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Parallel resistors
// ---------------------------------------------------------------------------

describe('DC Analysis: Parallel Resistors', () => {
  // V1 (6V) -> R1 (1k) || R2 (2k), both from node 1 to GND
  // R_eq = (1k * 2k) / (1k + 2k) = 666.67 Ohm
  // I_total = 6V / R_eq = 9mA
  // I_R1 = 6V / 1k = 6mA, I_R2 = 6V / 2k = 3mA
  const parallel: DCCircuitDefinition = {
    nodeIds: ['1'],
    components: [
      { id: 'V1', type: 'V', value: 6, nodes: ['1', '0'] },
      { id: 'R1', type: 'R', value: 1000, nodes: ['1', '0'] },
      { id: 'R2', type: 'R', value: 2000, nodes: ['1', '0'] },
    ],
    groundNode: '0',
  };

  it('node voltage equals source voltage', () => {
    const result = solveDCOperatingPoint(parallel);
    expect(approx(result.nodeVoltages.get('1') ?? NaN, 6)).toBe(true);
  });

  it('R1 current is 6mA (V/R = 6V/1kOhm)', () => {
    const result = solveDCOperatingPoint(parallel);
    expect(approx(result.branchCurrents.get('R1') ?? NaN, 0.006)).toBe(true);
  });

  it('R2 current is 3mA (V/R = 6V/2kOhm)', () => {
    const result = solveDCOperatingPoint(parallel);
    expect(approx(result.branchCurrents.get('R2') ?? NaN, 0.003)).toBe(true);
  });

  it('total current = sum of parallel branch currents = 9mA', () => {
    const result = solveDCOperatingPoint(parallel);
    const iV1 = Math.abs(result.branchCurrents.get('V1') ?? NaN);
    expect(approx(iV1, 0.009)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Current source with resistive load
// ---------------------------------------------------------------------------

describe('DC Analysis: Current Source', () => {
  // I1 (5mA, node 1 to GND) -> R1 (2k, node 1 to GND)
  // V(1) = I * R = 5mA * 2k = 10V
  const currentSource: DCCircuitDefinition = {
    nodeIds: ['1'],
    components: [
      { id: 'I1', type: 'I', value: 0.005, nodes: ['1', '0'] },
      { id: 'R1', type: 'R', value: 2000, nodes: ['1', '0'] },
    ],
    groundNode: '0',
  };

  it('converges', () => {
    const result = solveDCOperatingPoint(currentSource);
    expect(result.converged).toBe(true);
  });

  it('node voltage is I*R = 10V', () => {
    const result = solveDCOperatingPoint(currentSource);
    expect(approx(result.nodeVoltages.get('1') ?? NaN, 10)).toBe(true);
  });

  it('current source current equals its defined value', () => {
    const result = solveDCOperatingPoint(currentSource);
    expect(approx(result.branchCurrents.get('I1') ?? NaN, 0.005)).toBe(true);
  });

  it('resistor current equals source current', () => {
    const result = solveDCOperatingPoint(currentSource);
    expect(approx(result.branchCurrents.get('R1') ?? NaN, 0.005)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Multiple voltage sources
// ---------------------------------------------------------------------------

describe('DC Analysis: Multiple Voltage Sources', () => {
  // V1 (5V, node 1->GND) and V2 (3V, node 2->GND) with R1 (1k, node 1->2)
  // I_R1 = (V1 - V2) / R1 = (5 - 3) / 1k = 2mA
  const multiSource: DCCircuitDefinition = {
    nodeIds: ['1', '2'],
    components: [
      { id: 'V1', type: 'V', value: 5, nodes: ['1', '0'] },
      { id: 'V2', type: 'V', value: 3, nodes: ['2', '0'] },
      { id: 'R1', type: 'R', value: 1000, nodes: ['1', '2'] },
    ],
    groundNode: '0',
  };

  it('V(1) = 5V and V(2) = 3V', () => {
    const result = solveDCOperatingPoint(multiSource);
    expect(approx(result.nodeVoltages.get('1') ?? NaN, 5)).toBe(true);
    expect(approx(result.nodeVoltages.get('2') ?? NaN, 3)).toBe(true);
  });

  it('resistor current is (V1-V2)/R = 2mA', () => {
    const result = solveDCOperatingPoint(multiSource);
    expect(approx(result.branchCurrents.get('R1') ?? NaN, 0.002)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Kirchhoff's Current Law (KCL)
// ---------------------------------------------------------------------------

describe('DC Analysis: Kirchhoff Current Law', () => {
  // KCL: sum of currents entering any node = 0
  // Use a T-network: V1 (10V) -> R1 (1k, 1->2) -> R2 (1k, 2->3) -> R3 (1k, 3->GND)
  //                                                    R4 (2k, 2->GND)
  const tNetwork: DCCircuitDefinition = {
    nodeIds: ['1', '2', '3'],
    components: [
      { id: 'V1', type: 'V', value: 10, nodes: ['1', '0'] },
      { id: 'R1', type: 'R', value: 1000, nodes: ['1', '2'] },
      { id: 'R2', type: 'R', value: 1000, nodes: ['2', '3'] },
      { id: 'R3', type: 'R', value: 1000, nodes: ['3', '0'] },
      { id: 'R4', type: 'R', value: 2000, nodes: ['2', '0'] },
    ],
    groundNode: '0',
  };

  it('KCL at node 2: current in = current out', () => {
    const result = solveDCOperatingPoint(tNetwork);
    const v = result.nodeVoltages;
    const v1 = v.get('1') ?? 0;
    const v2 = v.get('2') ?? 0;
    const v3 = v.get('3') ?? 0;

    // Current into node 2 from R1: (V1 - V2) / R1
    const iR1 = (v1 - v2) / 1000;
    // Current out of node 2 via R2: (V2 - V3) / R2
    const iR2 = (v2 - v3) / 1000;
    // Current out of node 2 via R4: V2 / R4
    const iR4 = v2 / 2000;

    // KCL: iR1 - iR2 - iR4 = 0
    expect(approx(iR1 - iR2 - iR4, 0)).toBe(true);
  });

  it('KCL at node 3: current in = current out', () => {
    const result = solveDCOperatingPoint(tNetwork);
    const v = result.nodeVoltages;
    const v2 = v.get('2') ?? 0;
    const v3 = v.get('3') ?? 0;

    const iR2 = (v2 - v3) / 1000;
    const iR3 = v3 / 1000;

    // KCL: iR2 - iR3 = 0
    expect(approx(iR2 - iR3, 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Kirchhoff's Voltage Law (KVL)
// ---------------------------------------------------------------------------

describe('DC Analysis: Kirchhoff Voltage Law', () => {
  // KVL: sum of voltages around any closed loop = 0
  // Loop: V1 -> R1 -> R2 -> GND -> V1
  // V1 = V_R1 + V_R2
  const kvlCircuit: DCCircuitDefinition = {
    nodeIds: ['1', '2'],
    components: [
      { id: 'V1', type: 'V', value: 12, nodes: ['1', '0'] },
      { id: 'R1', type: 'R', value: 3000, nodes: ['1', '2'] },
      { id: 'R2', type: 'R', value: 1000, nodes: ['2', '0'] },
    ],
    groundNode: '0',
  };

  it('sum of voltages around loop = 0', () => {
    const result = solveDCOperatingPoint(kvlCircuit);
    const v1 = result.nodeVoltages.get('1') ?? 0;
    const v2 = result.nodeVoltages.get('2') ?? 0;

    // KVL: V_source - V_R1 - V_R2 = 0
    // V_source = 12, V_R1 = V1-V2, V_R2 = V2-0
    const vR1 = v1 - v2;
    const vR2 = v2;
    expect(approx(12 - vR1 - vR2, 0)).toBe(true);
  });

  it('voltage divider: V(2) = V1 * R2/(R1+R2) = 3V', () => {
    const result = solveDCOperatingPoint(kvlCircuit);
    expect(approx(result.nodeVoltages.get('2') ?? NaN, 3)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Power conservation
// ---------------------------------------------------------------------------

describe('DC Analysis: Power Conservation', () => {
  // Power delivered by source = power dissipated in resistors
  const powerCircuit: DCCircuitDefinition = {
    nodeIds: ['1', '2'],
    components: [
      { id: 'V1', type: 'V', value: 10, nodes: ['1', '0'] },
      { id: 'R1', type: 'R', value: 500, nodes: ['1', '2'] },
      { id: 'R2', type: 'R', value: 500, nodes: ['2', '0'] },
    ],
    groundNode: '0',
  };

  it('source power equals sum of resistor power', () => {
    const result = solveDCOperatingPoint(powerCircuit);
    const pV1 = result.powerDissipation.get('V1') ?? 0;
    const pR1 = result.powerDissipation.get('R1') ?? 0;
    const pR2 = result.powerDissipation.get('R2') ?? 0;

    expect(relApprox(pV1, pR1 + pR2)).toBe(true);
  });

  it('P = V^2/R for each resistor', () => {
    const result = solveDCOperatingPoint(powerCircuit);
    const v1 = result.nodeVoltages.get('1') ?? 0;
    const v2 = result.nodeVoltages.get('2') ?? 0;

    // R1: V_R1 = V1 - V2, P = V^2/R
    const vR1 = v1 - v2;
    const expectedPR1 = (vR1 * vR1) / 500;
    expect(relApprox(result.powerDissipation.get('R1') ?? NaN, expectedPR1)).toBe(true);

    // R2: V_R2 = V2, P = V^2/R
    const expectedPR2 = (v2 * v2) / 500;
    expect(relApprox(result.powerDissipation.get('R2') ?? NaN, expectedPR2)).toBe(true);
  });

  it('P = I^2 * R for each resistor', () => {
    const result = solveDCOperatingPoint(powerCircuit);
    const iR1 = result.branchCurrents.get('R1') ?? 0;
    const iR2 = result.branchCurrents.get('R2') ?? 0;

    expect(relApprox(result.powerDissipation.get('R1') ?? NaN, iR1 * iR1 * 500)).toBe(true);
    expect(relApprox(result.powerDissipation.get('R2') ?? NaN, iR2 * iR2 * 500)).toBe(true);
  });

  it('totalPower matches source power', () => {
    const result = solveDCOperatingPoint(powerCircuit);
    // I = 10V / 1000 Ohm = 10mA, P = V*I = 10 * 0.01 = 0.1W
    expect(relApprox(result.totalPower, 0.1)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('DC Analysis: Edge Cases', () => {
  it('empty circuit returns converged with empty maps', () => {
    const empty: DCCircuitDefinition = {
      nodeIds: [],
      components: [],
      groundNode: '0',
    };
    const result = solveDCOperatingPoint(empty);
    expect(result.converged).toBe(true);
    expect(result.nodeVoltages.get('0')).toBe(0);
    expect(result.iterations).toBe(0);
  });

  it('singular matrix (floating node) returns converged=false', () => {
    // Two nodes but no path between them
    const floating: DCCircuitDefinition = {
      nodeIds: ['1', '2'],
      components: [
        { id: 'V1', type: 'V', value: 5, nodes: ['1', '0'] },
        // Node 2 is completely floating — no component connects it
      ],
      groundNode: '0',
    };
    const result = solveDCOperatingPoint(floating);
    expect(result.converged).toBe(false);
  });

  it('short circuit (V source across 0 Ohm) results in singular matrix', () => {
    // Two voltage sources in parallel with different voltages -> contradiction
    const shortCircuit: DCCircuitDefinition = {
      nodeIds: ['1'],
      components: [
        { id: 'V1', type: 'V', value: 5, nodes: ['1', '0'] },
        { id: 'V2', type: 'V', value: 3, nodes: ['1', '0'] },
      ],
      groundNode: '0',
    };
    const result = solveDCOperatingPoint(shortCircuit);
    // Two voltage sources at same node with different values -> singular
    expect(result.converged).toBe(false);
  });

  it('single resistor to ground with no source: all voltages are 0', () => {
    const noSource: DCCircuitDefinition = {
      nodeIds: ['1'],
      components: [
        { id: 'R1', type: 'R', value: 1000, nodes: ['1', '0'] },
      ],
      groundNode: '0',
    };
    const result = solveDCOperatingPoint(noSource);
    expect(result.converged).toBe(true);
    expect(approx(result.nodeVoltages.get('1') ?? NaN, 0)).toBe(true);
  });

  it('handles custom ground node', () => {
    // Use node 'gnd' instead of '0'
    const customGnd: DCCircuitDefinition = {
      nodeIds: ['A', 'B'],
      components: [
        { id: 'V1', type: 'V', value: 5, nodes: ['A', 'gnd'] },
        { id: 'R1', type: 'R', value: 1000, nodes: ['A', 'B'] },
        { id: 'R2', type: 'R', value: 1000, nodes: ['B', 'gnd'] },
      ],
      groundNode: 'gnd',
    };
    const result = solveDCOperatingPoint(customGnd, { groundNode: 'gnd' });
    expect(result.converged).toBe(true);
    expect(approx(result.nodeVoltages.get('A') ?? NaN, 5)).toBe(true);
    expect(approx(result.nodeVoltages.get('B') ?? NaN, 2.5)).toBe(true);
    expect(result.nodeVoltages.get('gnd')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Inductors and capacitors at DC
// ---------------------------------------------------------------------------

describe('DC Analysis: Reactive Components', () => {
  it('inductor is short circuit at DC (0V across it)', () => {
    // V1 (5V) -> L1 (100mH, short at DC) -> R1 (1k, to GND)
    // V(1) = 5V, V(2) = 5V (inductor is 0V drop), I = 5mA
    const withInductor: DCCircuitDefinition = {
      nodeIds: ['1', '2'],
      components: [
        { id: 'V1', type: 'V', value: 5, nodes: ['1', '0'] },
        { id: 'L1', type: 'L', value: 0.1, nodes: ['1', '2'] },
        { id: 'R1', type: 'R', value: 1000, nodes: ['2', '0'] },
      ],
      groundNode: '0',
    };
    const result = solveDCOperatingPoint(withInductor);
    expect(result.converged).toBe(true);
    expect(approx(result.nodeVoltages.get('1') ?? NaN, 5)).toBe(true);
    expect(approx(result.nodeVoltages.get('2') ?? NaN, 5)).toBe(true);
    // All 5V drops across R1
    expect(approx(result.branchCurrents.get('R1') ?? NaN, 0.005)).toBe(true);
  });

  it('inductor has zero power dissipation at DC', () => {
    const withInductor: DCCircuitDefinition = {
      nodeIds: ['1', '2'],
      components: [
        { id: 'V1', type: 'V', value: 5, nodes: ['1', '0'] },
        { id: 'L1', type: 'L', value: 0.1, nodes: ['1', '2'] },
        { id: 'R1', type: 'R', value: 1000, nodes: ['2', '0'] },
      ],
      groundNode: '0',
    };
    const result = solveDCOperatingPoint(withInductor);
    expect(result.powerDissipation.get('L1')).toBe(0);
  });

  it('capacitor is open circuit at DC (no current through it)', () => {
    // V1 (5V) -> R1 (1k, 1->2) -> C1 (1uF, 2->GND, open at DC)
    // With cap open, node 2 has no path to ground besides the cap
    // So it's a floating node scenario. Let's add a large resistor for a real test.
    // V1 (5V) -> R1 (1k, 1->2) -> C1 (open) and R2 (10k, 2->GND)
    // V(2) = 5 * 10k / (1k + 10k) = 4.545V
    const withCap: DCCircuitDefinition = {
      nodeIds: ['1', '2'],
      components: [
        { id: 'V1', type: 'V', value: 5, nodes: ['1', '0'] },
        { id: 'R1', type: 'R', value: 1000, nodes: ['1', '2'] },
        { id: 'C1', type: 'C', value: 1e-6, nodes: ['2', '0'] },
        { id: 'R2', type: 'R', value: 10000, nodes: ['2', '0'] },
      ],
      groundNode: '0',
    };
    const result = solveDCOperatingPoint(withCap);
    expect(result.converged).toBe(true);
    // Capacitor is ignored at DC; voltage divider R1+R2
    const expectedV2 = 5 * 10000 / (1000 + 10000);
    expect(relApprox(result.nodeVoltages.get('2') ?? NaN, expectedV2)).toBe(true);
  });

  it('capacitor has zero power dissipation at DC', () => {
    const withCap: DCCircuitDefinition = {
      nodeIds: ['1', '2'],
      components: [
        { id: 'V1', type: 'V', value: 5, nodes: ['1', '0'] },
        { id: 'R1', type: 'R', value: 1000, nodes: ['1', '2'] },
        { id: 'C1', type: 'C', value: 1e-6, nodes: ['2', '0'] },
        { id: 'R2', type: 'R', value: 10000, nodes: ['2', '0'] },
      ],
      groundNode: '0',
    };
    const result = solveDCOperatingPoint(withCap);
    expect(result.powerDissipation.get('C1')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Dependent sources
// ---------------------------------------------------------------------------

describe('DC Analysis: VCVS (Voltage-Controlled Voltage Source)', () => {
  // V1 (2V, 1->GND), VCVS gain=3 controlled by node 1, output at node 2->GND
  // R_load (1k, 2->GND)
  // V(2) = gain * V(1) = 3 * 2 = 6V
  const vcvsCircuit: DCCircuitDefinition = {
    nodeIds: ['1', '2'],
    components: [
      { id: 'V1', type: 'V', value: 2, nodes: ['1', '0'] },
      { id: 'E1', type: 'VCVS', value: 3, nodes: ['2', '0'], controlNodes: ['1', '0'] },
      { id: 'R1', type: 'R', value: 1000, nodes: ['2', '0'] },
    ],
    groundNode: '0',
  };

  it('output voltage is gain * control voltage', () => {
    const result = solveDCOperatingPoint(vcvsCircuit);
    expect(result.converged).toBe(true);
    expect(approx(result.nodeVoltages.get('2') ?? NaN, 6)).toBe(true);
  });
});

describe('DC Analysis: VCCS (Voltage-Controlled Current Source)', () => {
  // V1 (2V, 1->GND), VCCS gm=0.001 S controlled by node 1, output at node 2
  // R_load (1k, 2->GND)
  // MNA VCCS convention: I = gm * V_ctrl flows from nMinus to nPlus externally.
  // With nodes [0, 2] (nPlus=GND, nMinus=2): current enters node 2.
  // V(2) = gm * V(1) * R = 0.001 * 2 * 1000 = 2V
  const vccsCircuit: DCCircuitDefinition = {
    nodeIds: ['1', '2'],
    components: [
      { id: 'V1', type: 'V', value: 2, nodes: ['1', '0'] },
      { id: 'G1', type: 'VCCS', value: 0.001, nodes: ['0', '2'], controlNodes: ['1', '0'] },
      { id: 'R1', type: 'R', value: 1000, nodes: ['2', '0'] },
    ],
    groundNode: '0',
  };

  it('output voltage is gm * V_control * R_load', () => {
    const result = solveDCOperatingPoint(vccsCircuit);
    expect(result.converged).toBe(true);
    // VCCS: I = gm * V_control = 0.001 * 2 = 2mA enters node 2
    // V(2) = I * R1 = 0.002 * 1000 = 2V
    const v2 = result.nodeVoltages.get('2') ?? NaN;
    expect(approx(v2, 2)).toBe(true);
  });

  it('VCCS with reversed polarity gives negative voltage', () => {
    // Same circuit but VCCS nodes [2, 0]: current leaves node 2
    const reversed: DCCircuitDefinition = {
      nodeIds: ['1', '2'],
      components: [
        { id: 'V1', type: 'V', value: 2, nodes: ['1', '0'] },
        { id: 'G1', type: 'VCCS', value: 0.001, nodes: ['2', '0'], controlNodes: ['1', '0'] },
        { id: 'R1', type: 'R', value: 1000, nodes: ['2', '0'] },
      ],
      groundNode: '0',
    };
    const result = solveDCOperatingPoint(reversed);
    expect(result.converged).toBe(true);
    // Current leaves node 2, so V(2) = -2V
    expect(approx(result.nodeVoltages.get('2') ?? NaN, -2)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SolverInput interop
// ---------------------------------------------------------------------------

describe('solverInputToDCCircuit', () => {
  it('converts numeric SolverInput to string-based DCCircuitDefinition', () => {
    const solverInput: SolverInput = {
      numNodes: 2,
      groundNode: 0,
      components: [
        { id: 'V1', type: 'V', value: 5, nodes: [1, 0] },
        { id: 'R1', type: 'R', value: 1000, nodes: [1, 2] },
        { id: 'R2', type: 'R', value: 1000, nodes: [2, 0] },
      ],
    };

    const dcCircuit = solverInputToDCCircuit(solverInput);
    expect(dcCircuit.nodeIds).toEqual(['1', '2']);
    expect(dcCircuit.groundNode).toBe('0');
    expect(dcCircuit.components).toHaveLength(3);
    expect(dcCircuit.components[0].nodes).toEqual(['1', '0']);
  });

  it('produces correct DC analysis from converted SolverInput', () => {
    const solverInput: SolverInput = {
      numNodes: 2,
      groundNode: 0,
      components: [
        { id: 'V1', type: 'V', value: 10, nodes: [1, 0] },
        { id: 'R1', type: 'R', value: 1000, nodes: [1, 2] },
        { id: 'R2', type: 'R', value: 1000, nodes: [2, 0] },
      ],
    };

    const dcCircuit = solverInputToDCCircuit(solverInput);
    const result = solveDCOperatingPoint(dcCircuit);
    expect(result.converged).toBe(true);
    expect(approx(result.nodeVoltages.get('1') ?? NaN, 10)).toBe(true);
    expect(approx(result.nodeVoltages.get('2') ?? NaN, 5)).toBe(true);
  });

  it('handles controlNodes for dependent sources', () => {
    const solverInput: SolverInput = {
      numNodes: 2,
      groundNode: 0,
      components: [
        { id: 'V1', type: 'V', value: 1, nodes: [1, 0] },
        { id: 'E1', type: 'VCVS', value: 2, nodes: [2, 0], controlNodes: [1, 0] },
        { id: 'R1', type: 'R', value: 1000, nodes: [2, 0] },
      ],
    };

    const dcCircuit = solverInputToDCCircuit(solverInput);
    expect(dcCircuit.components[1].controlNodes).toEqual(['1', '0']);

    const result = solveDCOperatingPoint(dcCircuit);
    expect(result.converged).toBe(true);
    expect(approx(result.nodeVoltages.get('2') ?? NaN, 2)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Formatting functions
// ---------------------------------------------------------------------------

describe('formatVoltage', () => {
  it('formats zero', () => {
    expect(formatVoltage(0)).toBe('0 V');
  });

  it('formats volts', () => {
    expect(formatVoltage(3.3)).toContain('V');
    expect(formatVoltage(3.3)).toContain('3.3');
  });

  it('formats millivolts', () => {
    const result = formatVoltage(0.5);
    expect(result).toContain('mV');
    expect(result).toContain('500');
  });

  it('formats kilovolts', () => {
    const result = formatVoltage(1200);
    expect(result).toContain('kV');
    expect(result).toContain('1.2');
  });

  it('formats microvolts', () => {
    const result = formatVoltage(0.000050);
    expect(result).toContain('\u00B5V');
    expect(result).toContain('50');
  });

  it('formats negative voltages', () => {
    const result = formatVoltage(-3.3);
    expect(result).toContain('-');
    expect(result).toContain('V');
  });
});

describe('formatCurrent', () => {
  it('formats zero', () => {
    expect(formatCurrent(0)).toBe('0 A');
  });

  it('formats milliamps', () => {
    const result = formatCurrent(0.01);
    expect(result).toContain('mA');
    expect(result).toContain('10');
  });

  it('formats microamps', () => {
    const result = formatCurrent(0.000500);
    expect(result).toContain('\u00B5A');
    expect(result).toContain('500');
  });

  it('formats amps', () => {
    const result = formatCurrent(2.5);
    expect(result).toContain('A');
    expect(result).toContain('2.5');
  });

  it('formats nanoamps', () => {
    const result = formatCurrent(1e-9);
    expect(result).toContain('nA');
  });
});

describe('formatPower', () => {
  it('formats zero', () => {
    expect(formatPower(0)).toBe('0 W');
  });

  it('formats milliwatts', () => {
    const result = formatPower(0.250);
    expect(result).toContain('mW');
    expect(result).toContain('250');
  });

  it('formats watts', () => {
    const result = formatPower(1.5);
    expect(result).toContain('W');
    expect(result).toContain('1.5');
  });

  it('formats microwatts', () => {
    const result = formatPower(0.000050);
    expect(result).toContain('\u00B5W');
    expect(result).toContain('50');
  });

  it('formats kilowatts', () => {
    const result = formatPower(2500);
    expect(result).toContain('kW');
    expect(result).toContain('2.5');
  });
});

// ---------------------------------------------------------------------------
// Ground node selection
// ---------------------------------------------------------------------------

describe('DC Analysis: Ground Node Selection', () => {
  it('default ground node is "0"', () => {
    const circuit: DCCircuitDefinition = {
      nodeIds: ['1'],
      components: [
        { id: 'V1', type: 'V', value: 5, nodes: ['1', '0'] },
        { id: 'R1', type: 'R', value: 1000, nodes: ['1', '0'] },
      ],
      groundNode: '0',
    };
    const result = solveDCOperatingPoint(circuit);
    expect(result.nodeVoltages.get('0')).toBe(0);
    expect(approx(result.nodeVoltages.get('1') ?? NaN, 5)).toBe(true);
  });

  it('ground node from options overrides circuit definition', () => {
    const circuit: DCCircuitDefinition = {
      nodeIds: ['A', 'B'],
      components: [
        { id: 'V1', type: 'V', value: 5, nodes: ['A', 'ref'] },
        { id: 'R1', type: 'R', value: 1000, nodes: ['A', 'B'] },
        { id: 'R2', type: 'R', value: 1000, nodes: ['B', 'ref'] },
      ],
      groundNode: '0', // default
    };
    // Override with 'ref' as ground
    const result = solveDCOperatingPoint(circuit, { groundNode: 'ref' });
    expect(result.converged).toBe(true);
    expect(result.nodeVoltages.get('ref')).toBe(0);
    expect(approx(result.nodeVoltages.get('A') ?? NaN, 5)).toBe(true);
    expect(approx(result.nodeVoltages.get('B') ?? NaN, 2.5)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Complex circuit: Wheatstone bridge
// ---------------------------------------------------------------------------

describe('DC Analysis: Wheatstone Bridge', () => {
  // Classic Wheatstone bridge:
  //       V1 (10V)
  //        |
  //       [1]
  //      / | \
  //   R1(1k) R3(2k)
  //    /     \
  //  [2]     [3]
  //    \     /
  //   R2(2k) R4(1k)
  //      \ /
  //       GND
  // R_bridge (5k) from node 2 to node 3
  const bridge: DCCircuitDefinition = {
    nodeIds: ['1', '2', '3'],
    components: [
      { id: 'V1', type: 'V', value: 10, nodes: ['1', '0'] },
      { id: 'R1', type: 'R', value: 1000, nodes: ['1', '2'] },
      { id: 'R2', type: 'R', value: 2000, nodes: ['2', '0'] },
      { id: 'R3', type: 'R', value: 2000, nodes: ['1', '3'] },
      { id: 'R4', type: 'R', value: 1000, nodes: ['3', '0'] },
      { id: 'R5', type: 'R', value: 5000, nodes: ['2', '3'] },
    ],
    groundNode: '0',
  };

  it('converges', () => {
    const result = solveDCOperatingPoint(bridge);
    expect(result.converged).toBe(true);
  });

  it('node voltages are physically reasonable (between 0 and V_source)', () => {
    const result = solveDCOperatingPoint(bridge);
    const v1 = result.nodeVoltages.get('1') ?? NaN;
    const v2 = result.nodeVoltages.get('2') ?? NaN;
    const v3 = result.nodeVoltages.get('3') ?? NaN;

    expect(v1).toBe(10);
    expect(v2).toBeGreaterThan(0);
    expect(v2).toBeLessThan(10);
    expect(v3).toBeGreaterThan(0);
    expect(v3).toBeLessThan(10);
  });

  it('KCL holds at all nodes', () => {
    const result = solveDCOperatingPoint(bridge);
    const v = result.nodeVoltages;
    const v1 = v.get('1') ?? 0;
    const v2 = v.get('2') ?? 0;
    const v3 = v.get('3') ?? 0;

    // Node 2: R1 in, R2 out, R5 in/out
    const iR1 = (v1 - v2) / 1000;
    const iR2 = v2 / 2000;
    const iR5_from2 = (v2 - v3) / 5000;
    expect(approx(iR1 - iR2 - iR5_from2, 0)).toBe(true);

    // Node 3: R3 in, R4 out, R5 in/out
    const iR3 = (v1 - v3) / 2000;
    const iR4 = v3 / 1000;
    const iR5_from3 = (v3 - v2) / 5000;
    expect(approx(iR3 - iR4 - iR5_from3, 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Options: tolerance
// ---------------------------------------------------------------------------

describe('DC Analysis: Options', () => {
  it('custom tolerance does not affect linear circuit convergence', () => {
    const circuit: DCCircuitDefinition = {
      nodeIds: ['1'],
      components: [
        { id: 'V1', type: 'V', value: 5, nodes: ['1', '0'] },
        { id: 'R1', type: 'R', value: 1000, nodes: ['1', '0'] },
      ],
      groundNode: '0',
    };
    const result = solveDCOperatingPoint(circuit, { tolerance: 1e-12 });
    expect(result.converged).toBe(true);
    expect(approx(result.nodeVoltages.get('1') ?? NaN, 5)).toBe(true);
  });

  it('maxIterations is included in non-converged result', () => {
    const floating: DCCircuitDefinition = {
      nodeIds: ['1', '2'],
      components: [
        { id: 'V1', type: 'V', value: 5, nodes: ['1', '0'] },
      ],
      groundNode: '0',
    };
    const result = solveDCOperatingPoint(floating, { maxIterations: 50 });
    expect(result.converged).toBe(false);
    expect(result.iterations).toBe(50);
  });
});
