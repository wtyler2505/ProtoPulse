/**
 * Vitest tests for Newton-Raphson convergence in the MNA Circuit Solver (BL-0484)
 *
 * Tests nonlinear device support (diodes, BJTs, MOSFETs) in solveDCOperatingPoint
 * using the companion model NR iteration loop.
 *
 * Coverage:
 *   - Diode + resistor: convergence, KVL, correct operating point
 *   - BJT common-emitter: active region bias, KCL
 *   - MOSFET common-source: saturation region, correct drain current
 *   - NR convergence options: tolerance, max iterations, damping
 *   - Edge cases: multiple diodes, zero-bias, non-convergent circuits
 */

import { describe, it, expect } from 'vitest';
import {
  solveDCOperatingPoint,
  buildSolverInput,
  type SolverInput,
} from '../circuit-solver';
import { DIODE_DEFAULTS, BJT_DEFAULTS, NMOS_DEFAULTS } from '../device-models';
import type { DiodeParams, BJTParams, MOSFETParams } from '../device-models';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TOL = 1e-4;
const REL_TOL = 0.05; // 5%

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
// Diode + Resistor (basic NR convergence)
// ---------------------------------------------------------------------------

describe('NR Convergence: Diode + Resistor', () => {
  it('converges for simple diode circuit: 5V, 1k resistor', () => {
    // Circuit: V1=5V (node 1 to GND), R1=1k (node 1 to node 2), D1 (node 2 anode to GND cathode)
    const input: SolverInput = {
      numNodes: 2,
      groundNode: 0,
      components: [
        { id: 'V1', type: 'V', value: 5, nodes: [1, 0] },
        { id: 'R1', type: 'R', value: 1000, nodes: [1, 2] },
        { id: 'D1', type: 'D', value: 0, nodes: [2, 0], diodeParams: { ...DIODE_DEFAULTS } },
      ],
    };

    const result = solveDCOperatingPoint(input);
    expect(result.converged).toBe(true);
    expect(result.iterations).toBeGreaterThan(1); // Must iterate (not single solve)
    expect(result.iterations).toBeLessThan(50); // Should converge quickly
  });

  it('diode voltage is approximately 0.65-0.75V for typical silicon diode', () => {
    const input: SolverInput = {
      numNodes: 2,
      groundNode: 0,
      components: [
        { id: 'V1', type: 'V', value: 5, nodes: [1, 0] },
        { id: 'R1', type: 'R', value: 1000, nodes: [1, 2] },
        { id: 'D1', type: 'D', value: 0, nodes: [2, 0], diodeParams: { ...DIODE_DEFAULTS } },
      ],
    };

    const result = solveDCOperatingPoint(input);
    expect(result.converged).toBe(true);

    const vDiode = result.nodeVoltages[2] ?? 0;
    expect(vDiode).toBeGreaterThan(0.6);
    expect(vDiode).toBeLessThan(0.8);
  });

  it('KVL: V_source = I*R + V_diode', () => {
    const Vs = 5.0;
    const R = 1000;
    const input: SolverInput = {
      numNodes: 2,
      groundNode: 0,
      components: [
        { id: 'V1', type: 'V', value: Vs, nodes: [1, 0] },
        { id: 'R1', type: 'R', value: R, nodes: [1, 2] },
        { id: 'D1', type: 'D', value: 0, nodes: [2, 0], diodeParams: { ...DIODE_DEFAULTS } },
      ],
    };

    const result = solveDCOperatingPoint(input);
    expect(result.converged).toBe(true);

    const vNode1 = result.nodeVoltages[1] ?? 0;
    const vNode2 = result.nodeVoltages[2] ?? 0; // diode voltage
    const iR = result.branchCurrents['R1'] ?? 0;

    // KVL: Vs = I*R + Vd
    const kvlResidual = Math.abs(iR * R + vNode2 - Vs);
    expect(kvlResidual).toBeLessThan(1e-3);
  });

  it('higher source voltage gives higher current but similar diode voltage', () => {
    const makeCircuit = (vs: number): SolverInput => ({
      numNodes: 2,
      groundNode: 0,
      components: [
        { id: 'V1', type: 'V', value: vs, nodes: [1, 0] },
        { id: 'R1', type: 'R', value: 1000, nodes: [1, 2] },
        { id: 'D1', type: 'D', value: 0, nodes: [2, 0], diodeParams: { ...DIODE_DEFAULTS } },
      ],
    });

    const r5 = solveDCOperatingPoint(makeCircuit(5));
    const r10 = solveDCOperatingPoint(makeCircuit(10));
    expect(r5.converged).toBe(true);
    expect(r10.converged).toBe(true);

    // Higher voltage -> higher current through resistor
    const i5 = r5.branchCurrents['R1'] ?? 0;
    const i10 = r10.branchCurrents['R1'] ?? 0;
    expect(i10).toBeGreaterThan(i5 * 1.5);

    // Diode voltage only changes logarithmically
    const vd5 = r5.nodeVoltages[2] ?? 0;
    const vd10 = r10.nodeVoltages[2] ?? 0;
    expect(Math.abs(vd10 - vd5)).toBeLessThan(0.1); // < 100mV difference
  });

  it('converges for high source voltage (100V, 10k)', () => {
    const input: SolverInput = {
      numNodes: 2,
      groundNode: 0,
      components: [
        { id: 'V1', type: 'V', value: 100, nodes: [1, 0] },
        { id: 'R1', type: 'R', value: 10000, nodes: [1, 2] },
        { id: 'D1', type: 'D', value: 0, nodes: [2, 0], diodeParams: { ...DIODE_DEFAULTS } },
      ],
    };

    const result = solveDCOperatingPoint(input);
    expect(result.converged).toBe(true);
    // Most voltage across R, Vd < 1V
    const vDiode = result.nodeVoltages[2] ?? 0;
    expect(vDiode).toBeLessThan(1.0);
    expect(vDiode).toBeGreaterThan(0.5);
  });

  it('two diodes in series: voltage roughly doubles', () => {
    // V1=5V -> R1=1k -> D1 -> D2 -> GND
    const input: SolverInput = {
      numNodes: 3,
      groundNode: 0,
      components: [
        { id: 'V1', type: 'V', value: 5, nodes: [1, 0] },
        { id: 'R1', type: 'R', value: 1000, nodes: [1, 2] },
        { id: 'D1', type: 'D', value: 0, nodes: [2, 3], diodeParams: { ...DIODE_DEFAULTS } },
        { id: 'D2', type: 'D', value: 0, nodes: [3, 0], diodeParams: { ...DIODE_DEFAULTS } },
      ],
    };

    const result = solveDCOperatingPoint(input);
    expect(result.converged).toBe(true);

    // Total diode drop should be ~1.3-1.5V
    const vNode2 = result.nodeVoltages[2] ?? 0;
    expect(vNode2).toBeGreaterThan(1.2);
    expect(vNode2).toBeLessThan(1.6);
  });

  it('reverse-biased diode: negligible current', () => {
    // D1 reverse biased: cathode at +5V, anode at GND through R
    const input: SolverInput = {
      numNodes: 2,
      groundNode: 0,
      components: [
        { id: 'V1', type: 'V', value: 5, nodes: [1, 0] },
        { id: 'R1', type: 'R', value: 1000, nodes: [1, 2] },
        { id: 'D1', type: 'D', value: 0, nodes: [0, 2], diodeParams: { ...DIODE_DEFAULTS } }, // cathode=node2, anode=GND → reverse biased
      ],
    };

    const result = solveDCOperatingPoint(input);
    expect(result.converged).toBe(true);

    // Diode current should be negligible (reverse saturation ~ 1e-14 A)
    const iDiode = result.branchCurrents['D1'] ?? 0;
    expect(Math.abs(iDiode)).toBeLessThan(1e-10);
  });
});

// ---------------------------------------------------------------------------
// Diode via buildSolverInput
// ---------------------------------------------------------------------------

describe('NR Convergence: buildSolverInput with diode', () => {
  it('buildSolverInput handles diode type', () => {
    const input = buildSolverInput([
      { id: 'V1', type: 'V', value: 5, nodePlus: 1, nodeMinus: 0 },
      { id: 'R1', type: 'R', value: 1000, nodePlus: 1, nodeMinus: 2 },
      { id: 'D1', type: 'D', value: 0, nodePlus: 2, nodeMinus: 0, diodeParams: { ...DIODE_DEFAULTS } },
    ]);

    const result = solveDCOperatingPoint(input);
    expect(result.converged).toBe(true);

    const vDiode = result.nodeVoltages[2] ?? 0;
    expect(vDiode).toBeGreaterThan(0.6);
    expect(vDiode).toBeLessThan(0.8);
  });
});

// ---------------------------------------------------------------------------
// BJT common-emitter
// ---------------------------------------------------------------------------

describe('NR Convergence: BJT Common-Emitter', () => {
  it('converges for NPN common-emitter with base bias', () => {
    // V_CC=12V at node 1, R_C=1k (node1→node2=collector), R_B=100k (node1→node3=base)
    // Q1: collector=node2, base=node3, emitter=GND
    const input: SolverInput = {
      numNodes: 3,
      groundNode: 0,
      components: [
        { id: 'VCC', type: 'V', value: 12, nodes: [1, 0] },
        { id: 'RC', type: 'R', value: 1000, nodes: [1, 2] },
        { id: 'RB', type: 'R', value: 100000, nodes: [1, 3] },
        {
          id: 'Q1', type: 'Q', value: 0,
          nodes: [2, 3], // [collector, base]
          thirdNode: 0,  // emitter = GND
          bjtParams: { ...BJT_DEFAULTS },
        },
      ],
    };

    const result = solveDCOperatingPoint(input);
    expect(result.converged).toBe(true);
    expect(result.iterations).toBeGreaterThan(1);
    expect(result.iterations).toBeLessThan(100);
  });

  it('base voltage is approximately 0.65-0.75V (Vbe forward)', () => {
    const input: SolverInput = {
      numNodes: 3,
      groundNode: 0,
      components: [
        { id: 'VCC', type: 'V', value: 12, nodes: [1, 0] },
        { id: 'RC', type: 'R', value: 1000, nodes: [1, 2] },
        { id: 'RB', type: 'R', value: 100000, nodes: [1, 3] },
        {
          id: 'Q1', type: 'Q', value: 0,
          nodes: [2, 3],
          thirdNode: 0,
          bjtParams: { ...BJT_DEFAULTS },
        },
      ],
    };

    const result = solveDCOperatingPoint(input);
    expect(result.converged).toBe(true);

    const vBase = result.nodeVoltages[3] ?? 0;
    expect(vBase).toBeGreaterThan(0.55);
    expect(vBase).toBeLessThan(0.85);
  });

  it('KCL: Ie = -(Ic + Ib)', () => {
    const input: SolverInput = {
      numNodes: 3,
      groundNode: 0,
      components: [
        { id: 'VCC', type: 'V', value: 12, nodes: [1, 0] },
        { id: 'RC', type: 'R', value: 1000, nodes: [1, 2] },
        { id: 'RB', type: 'R', value: 100000, nodes: [1, 3] },
        {
          id: 'Q1', type: 'Q', value: 0,
          nodes: [2, 3],
          thirdNode: 0,
          bjtParams: { ...BJT_DEFAULTS },
        },
      ],
    };

    const result = solveDCOperatingPoint(input);
    expect(result.converged).toBe(true);

    const Ic = result.branchCurrents['Q1_Ic'] ?? 0;
    const Ib = result.branchCurrents['Q1_Ib'] ?? 0;
    const Ie = result.branchCurrents['Q1_Ie'] ?? 0;
    expect(approx(Ie, -(Ic + Ib), 1e-9)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// MOSFET common-source
// ---------------------------------------------------------------------------

describe('NR Convergence: MOSFET Common-Source', () => {
  it('converges for NMOS common-source with gate bias', () => {
    // VDD=5V at node 1, RD=1k (node1→node2=drain)
    // Gate biased at 2V: V_gate=2V at node 3
    // M1: drain=node2, gate=node3, source=GND
    const input: SolverInput = {
      numNodes: 3,
      groundNode: 0,
      components: [
        { id: 'VDD', type: 'V', value: 5, nodes: [1, 0] },
        { id: 'RD', type: 'R', value: 1000, nodes: [1, 2] },
        { id: 'VG', type: 'V', value: 2, nodes: [3, 0] },
        {
          id: 'M1', type: 'M', value: 0,
          nodes: [2, 3], // [drain, gate]
          thirdNode: 0,  // source = GND
          mosfetParams: { ...NMOS_DEFAULTS },
        },
      ],
    };

    const result = solveDCOperatingPoint(input);
    expect(result.converged).toBe(true);
    expect(result.iterations).toBeGreaterThan(1);
  });

  it('drain current matches Level 1 model in saturation', () => {
    // Vgs=2V, Vth=0.7V, Vov=1.3V. If Vds > Vov → saturation.
    // Id_sat = Kp/2 * Vov^2 * (1+lambda*Vds)
    // With Kp=1e-4, Vov=1.3: Id_sat ~ 0.5*1e-4*1.69 = 8.45e-5 A ≈ 84.5 uA
    // Vds = VDD - Id*RD. If Id ~ 84.5uA, Vds ~ 5 - 0.0845 = 4.92V (saturation OK)
    const input: SolverInput = {
      numNodes: 3,
      groundNode: 0,
      components: [
        { id: 'VDD', type: 'V', value: 5, nodes: [1, 0] },
        { id: 'RD', type: 'R', value: 1000, nodes: [1, 2] },
        { id: 'VG', type: 'V', value: 2, nodes: [3, 0] },
        {
          id: 'M1', type: 'M', value: 0,
          nodes: [2, 3],
          thirdNode: 0,
          mosfetParams: { ...NMOS_DEFAULTS },
        },
      ],
    };

    const result = solveDCOperatingPoint(input);
    expect(result.converged).toBe(true);

    const Id = result.branchCurrents['M1'] ?? 0;
    // Expected ~ 84.5 uA (within 10% due to lambda correction)
    expect(Id).toBeGreaterThan(70e-6);
    expect(Id).toBeLessThan(100e-6);
  });

  it('MOSFET in cutoff when Vgs < Vth: drain current is zero', () => {
    const input: SolverInput = {
      numNodes: 3,
      groundNode: 0,
      components: [
        { id: 'VDD', type: 'V', value: 5, nodes: [1, 0] },
        { id: 'RD', type: 'R', value: 1000, nodes: [1, 2] },
        { id: 'VG', type: 'V', value: 0.3, nodes: [3, 0] }, // Below Vth=0.7V
        {
          id: 'M1', type: 'M', value: 0,
          nodes: [2, 3],
          thirdNode: 0,
          mosfetParams: { ...NMOS_DEFAULTS },
        },
      ],
    };

    const result = solveDCOperatingPoint(input);
    expect(result.converged).toBe(true);

    const Id = result.branchCurrents['M1'] ?? 0;
    expect(Math.abs(Id)).toBeLessThan(1e-10);

    // Drain voltage should be at VDD (no current through RD)
    const vDrain = result.nodeVoltages[2] ?? 0;
    expect(approx(vDrain, 5, 0.01)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// NR options
// ---------------------------------------------------------------------------

describe('NR Convergence: Options and Limits', () => {
  it('respects maxIterations limit — returns converged:false if too few', () => {
    const input: SolverInput = {
      numNodes: 2,
      groundNode: 0,
      components: [
        { id: 'V1', type: 'V', value: 5, nodes: [1, 0] },
        { id: 'R1', type: 'R', value: 1000, nodes: [1, 2] },
        { id: 'D1', type: 'D', value: 0, nodes: [2, 0], diodeParams: { ...DIODE_DEFAULTS } },
      ],
      nrOptions: { maxIterations: 1 }, // Too few to converge
    };

    const result = solveDCOperatingPoint(input);
    // With only 1 iteration allowed and convergence check requiring iter > 0,
    // this should not converge
    expect(result.iterations).toBe(1);
    expect(result.converged).toBe(false);
  });

  it('tighter tolerance takes more iterations but still converges', () => {
    const makeDiodeCircuit = (vntol: number): SolverInput => ({
      numNodes: 2,
      groundNode: 0,
      components: [
        { id: 'V1', type: 'V', value: 5, nodes: [1, 0] },
        { id: 'R1', type: 'R', value: 1000, nodes: [1, 2] },
        { id: 'D1', type: 'D', value: 0, nodes: [2, 0], diodeParams: { ...DIODE_DEFAULTS } },
      ],
      nrOptions: { vntol },
    });

    const loose = solveDCOperatingPoint(makeDiodeCircuit(1e-3));
    const tight = solveDCOperatingPoint(makeDiodeCircuit(1e-12));

    expect(loose.converged).toBe(true);
    expect(tight.converged).toBe(true);
    expect(tight.iterations).toBeGreaterThanOrEqual(loose.iterations);
  });

  it('linear circuit still works (fast path, single iteration)', () => {
    // Voltage divider — no nonlinear devices
    const input: SolverInput = {
      numNodes: 2,
      groundNode: 0,
      components: [
        { id: 'V1', type: 'V', value: 10, nodes: [1, 0] },
        { id: 'R1', type: 'R', value: 1000, nodes: [1, 2] },
        { id: 'R2', type: 'R', value: 1000, nodes: [2, 0] },
      ],
    };

    const result = solveDCOperatingPoint(input);
    expect(result.converged).toBe(true);
    expect(result.iterations).toBe(1); // Linear fast path
    expect(approx(result.nodeVoltages[2], 5, TOL)).toBe(true);
  });
});
