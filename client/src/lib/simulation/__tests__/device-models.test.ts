/**
 * Vitest tests for Nonlinear Semiconductor Device Models (FG-23)
 *
 * Coverage:
 *   - Diode: Shockley equation forward/reverse, temperature, breakdown, series R
 *   - BJT: Ebers-Moll NPN/PNP, active/saturation/cutoff, Early voltage
 *   - MOSFET: Level 1 NMOS/PMOS, cutoff/linear/saturation, channel-length modulation
 *   - Companion model: diode linearization for Newton-Raphson
 *   - Newton-Raphson solver: convergence for diode + resistor circuit
 *   - Physical constants and thermal voltage
 *   - Edge cases: zero voltage, extreme voltages, parameter validation
 */

import { describe, it, expect } from 'vitest';
import {
  K_B,
  Q_ELECTRON,
  T_DEFAULT,
  V_T_DEFAULT,
  thermalVoltage,
  evaluateDiode,
  evaluateBJT,
  evaluateMOSFET,
  diodeCompanion,
  solveNonlinear,
  DIODE_DEFAULTS,
  BJT_DEFAULTS,
  NMOS_DEFAULTS,
  PMOS_DEFAULTS,
} from '../device-models';
import type {
  DiodeParams,
  BJTParams,
  MOSFETParams,
} from '../device-models';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Absolute tolerance for floating-point comparisons. */
const TOL = 1e-6;

/** Relative tolerance for physics-level checks. */
const REL_TOL = 0.05; // 5% for analog approximations

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
// Physical constants
// ---------------------------------------------------------------------------

describe('Physical Constants', () => {
  it('Boltzmann constant has correct value', () => {
    expect(approx(K_B, 1.380649e-23, 1e-28)).toBe(true);
  });

  it('electron charge has correct value', () => {
    expect(approx(Q_ELECTRON, 1.602176634e-19, 1e-25)).toBe(true);
  });

  it('default temperature is 300K (27 degrees C)', () => {
    expect(T_DEFAULT).toBe(300);
  });

  it('default thermal voltage is approximately 25.85 mV', () => {
    expect(relApprox(V_T_DEFAULT, 0.02585, 0.01)).toBe(true);
  });

  it('thermalVoltage(300) matches V_T_DEFAULT', () => {
    expect(approx(thermalVoltage(300), V_T_DEFAULT)).toBe(true);
  });

  it('thermalVoltage scales linearly with temperature', () => {
    const Vt300 = thermalVoltage(300);
    const Vt600 = thermalVoltage(600);
    expect(relApprox(Vt600, 2 * Vt300, 0.001)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Diode Model
// ---------------------------------------------------------------------------

describe('Diode Model: Forward Bias', () => {
  const params: DiodeParams = { ...DIODE_DEFAULTS };

  it('at V=0, current is approximately 0', () => {
    const { I } = evaluateDiode(0, params);
    expect(Math.abs(I)).toBeLessThan(1e-15);
  });

  it('at V=0.7V with Is=1e-14, current is approximately 1mA', () => {
    const { I } = evaluateDiode(0.7, params);
    // I = 1e-14 * (exp(0.7 / 0.02585) - 1) ~ 5.8e-3 A
    expect(I).toBeGreaterThan(1e-4);
    expect(I).toBeLessThan(0.1);
  });

  it('current increases exponentially with voltage', () => {
    const { I: I1 } = evaluateDiode(0.6, params);
    const { I: I2 } = evaluateDiode(0.7, params);
    const { I: I3 } = evaluateDiode(0.8, params);
    // Each ~0.1V increment should multiply current by ~50x at n=1
    expect(I2).toBeGreaterThan(I1 * 10);
    expect(I3).toBeGreaterThan(I2 * 10);
  });

  it('derivative dI/dV is positive in forward bias', () => {
    const { dIdV } = evaluateDiode(0.6, params);
    expect(dIdV).toBeGreaterThan(0);
  });

  it('derivative dI/dV approximately equals I / (n * Vt) for large forward bias', () => {
    const V = 0.7;
    const { I, dIdV } = evaluateDiode(V, params);
    const Vt = thermalVoltage(T_DEFAULT);
    // For large forward bias, dI/dV ~ I / (n * Vt)
    // because exp(V/nVt) >> 1, so I ~ Is*exp(V/nVt) and dI/dV ~ I/(nVt)
    const expected = I / (params.n * Vt);
    expect(relApprox(dIdV, expected, 0.01)).toBe(true);
  });

  it('handles very large forward voltage without overflow', () => {
    const { I, dIdV } = evaluateDiode(5.0, params);
    expect(isFinite(I)).toBe(true);
    expect(isFinite(dIdV)).toBe(true);
    expect(I).toBeGreaterThan(0);
  });
});

describe('Diode Model: Reverse Bias', () => {
  const params: DiodeParams = { ...DIODE_DEFAULTS };

  it('reverse bias current is approximately -Is', () => {
    const { I } = evaluateDiode(-1.0, params);
    // I = Is * (exp(-1/0.02585) - 1) ~ -Is
    expect(approx(I, -params.Is, 1e-15)).toBe(true);
  });

  it('reverse bias current is very small (nanoamps or less)', () => {
    const { I } = evaluateDiode(-5.0, params);
    expect(Math.abs(I)).toBeLessThan(1e-10);
  });

  it('derivative in reverse bias is very small but positive', () => {
    const { dIdV } = evaluateDiode(-1.0, params);
    // dI/dV = Is/nVt * exp(V/nVt) which is very small for negative V
    expect(dIdV).toBeGreaterThan(0);
    expect(dIdV).toBeLessThan(1e-10);
  });
});

describe('Diode Model: Temperature Dependence', () => {
  it('higher temperature produces higher current at same voltage', () => {
    const paramsLow: DiodeParams = { Is: 1e-14, n: 1, T: 300 };
    const paramsHigh: DiodeParams = { Is: 1e-14, n: 1, T: 400 };
    const { I: I_low } = evaluateDiode(0.6, paramsLow);
    const { I: I_high } = evaluateDiode(0.6, paramsHigh);
    expect(I_high).toBeGreaterThan(I_low);
  });

  it('thermal voltage at 400K is higher than at 300K', () => {
    expect(thermalVoltage(400)).toBeGreaterThan(thermalVoltage(300));
  });
});

describe('Diode Model: Ideality Factor', () => {
  it('n=2 reduces current compared to n=1 at same voltage', () => {
    const params1: DiodeParams = { Is: 1e-14, n: 1 };
    const params2: DiodeParams = { Is: 1e-14, n: 2 };
    const { I: I1 } = evaluateDiode(0.7, params1);
    const { I: I2 } = evaluateDiode(0.7, params2);
    expect(I1).toBeGreaterThan(I2);
  });
});

describe('Diode Model: Breakdown', () => {
  it('reverse current increases sharply beyond breakdown voltage', () => {
    const params: DiodeParams = { Is: 1e-14, n: 1, Vbr: 50 };
    const { I: I_before } = evaluateDiode(-49, params);
    const { I: I_after } = evaluateDiode(-51, params);
    // After breakdown, current magnitude should be much larger
    expect(Math.abs(I_after)).toBeGreaterThan(Math.abs(I_before) * 10);
  });

  it('current just before breakdown is approximately -Is', () => {
    const params: DiodeParams = { Is: 1e-14, n: 1, Vbr: 50 };
    const { I } = evaluateDiode(-30, params);
    expect(approx(I, -params.Is, 1e-13)).toBe(true);
  });

  it('breakdown current is negative (reverse direction)', () => {
    const params: DiodeParams = { Is: 1e-14, n: 1, Vbr: 50 };
    const { I } = evaluateDiode(-55, params);
    expect(I).toBeLessThan(0);
  });
});

describe('Diode Model: Series Resistance', () => {
  it('series resistance reduces effective conductance', () => {
    const paramsNoRs: DiodeParams = { Is: 1e-14, n: 1 };
    const paramsWithRs: DiodeParams = { Is: 1e-14, n: 1, Rs: 10 };
    const { dIdV: dIdV_no } = evaluateDiode(0.7, paramsNoRs);
    const { dIdV: dIdV_with } = evaluateDiode(0.7, paramsWithRs);
    expect(dIdV_with).toBeLessThan(dIdV_no);
  });

  it('zero Rs gives same result as no Rs', () => {
    const paramsNoRs: DiodeParams = { Is: 1e-14, n: 1 };
    const paramsZeroRs: DiodeParams = { Is: 1e-14, n: 1, Rs: 0 };
    const r1 = evaluateDiode(0.7, paramsNoRs);
    const r2 = evaluateDiode(0.7, paramsZeroRs);
    expect(approx(r1.I, r2.I)).toBe(true);
    expect(approx(r1.dIdV, r2.dIdV)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// BJT Model
// ---------------------------------------------------------------------------

describe('BJT Model: Active Region (NPN)', () => {
  const params: BJTParams = { ...BJT_DEFAULTS };

  it('active region: Vbe=0.7V, Vce=5V gives positive Ic', () => {
    const result = evaluateBJT(0.7, 5.0, params);
    expect(result.Ic).toBeGreaterThan(0);
    expect(result.region).toBe('active');
  });

  it('Ic approximately equals betaF * Ib in active region', () => {
    const result = evaluateBJT(0.7, 5.0, params);
    // Ic / Ib ~ betaF (approximately, ignoring reverse current)
    if (result.Ib > 0) {
      const ratio = result.Ic / result.Ib;
      expect(relApprox(ratio, params.betaF, 0.1)).toBe(true);
    }
  });

  it('KCL: Ie = -(Ic + Ib)', () => {
    const result = evaluateBJT(0.7, 5.0, params);
    expect(approx(result.Ie, -(result.Ic + result.Ib), 1e-12)).toBe(true);
  });

  it('gm = Ic / Vt in active region', () => {
    const result = evaluateBJT(0.7, 5.0, params);
    const Vt = thermalVoltage(T_DEFAULT);
    const expectedGm = result.Ic / Vt;
    expect(relApprox(result.gm, expectedGm, 0.05)).toBe(true);
  });

  it('gpi = gm / betaF', () => {
    const result = evaluateBJT(0.7, 5.0, params);
    if (result.gm > 0) {
      expect(relApprox(result.gpi, result.gm / params.betaF, 0.01)).toBe(true);
    }
  });
});

describe('BJT Model: Cutoff Region', () => {
  const params: BJTParams = { ...BJT_DEFAULTS };

  it('cutoff when Vbe < 0.5V: Ic approximately 0', () => {
    const result = evaluateBJT(0.0, 5.0, params);
    expect(result.region).toBe('cutoff');
    expect(Math.abs(result.Ic)).toBeLessThan(1e-10);
  });

  it('cutoff: Ib approximately 0', () => {
    const result = evaluateBJT(0.0, 5.0, params);
    expect(Math.abs(result.Ib)).toBeLessThan(1e-10);
  });

  it('negative Vbe gives cutoff', () => {
    const result = evaluateBJT(-1.0, 5.0, params);
    expect(result.region).toBe('cutoff');
  });
});

describe('BJT Model: Saturation Region', () => {
  const params: BJTParams = { ...BJT_DEFAULTS };

  it('saturation when both junctions forward biased', () => {
    // Vbe=0.7V (BE forward), Vce=0.1V so Vbc=0.6V (BC clearly forward)
    const result = evaluateBJT(0.7, 0.1, params);
    expect(result.region).toBe('saturation');
  });

  it('Vce_sat: collector current is reduced in saturation', () => {
    const active = evaluateBJT(0.7, 5.0, params);
    const sat = evaluateBJT(0.7, 0.1, params);
    expect(active.Ic).toBeGreaterThan(sat.Ic);
  });
});

describe('BJT Model: PNP', () => {
  const params: BJTParams = { ...BJT_DEFAULTS, type: 'pnp' };

  it('PNP: negative Vbe (i.e. Veb > 0) gives negative Ic', () => {
    // For PNP, Vbe = -0.7V means the EB junction is forward biased
    const result = evaluateBJT(-0.7, -5.0, params);
    expect(result.Ic).toBeLessThan(0);
  });

  it('PNP: KCL holds', () => {
    const result = evaluateBJT(-0.7, -5.0, params);
    expect(approx(result.Ie, -(result.Ic + result.Ib), 1e-12)).toBe(true);
  });

  it('PNP active region: magnitude of Ic/Ib ~ betaF', () => {
    const result = evaluateBJT(-0.7, -5.0, params);
    if (Math.abs(result.Ib) > 0) {
      const ratio = Math.abs(result.Ic) / Math.abs(result.Ib);
      expect(relApprox(ratio, params.betaF, 0.1)).toBe(true);
    }
  });
});

describe('BJT Model: Early Voltage', () => {
  it('Early voltage increases Ic with Vce', () => {
    const params: BJTParams = { ...BJT_DEFAULTS, Vaf: 100 };
    const result1 = evaluateBJT(0.7, 2.0, params);
    const result2 = evaluateBJT(0.7, 10.0, params);
    expect(result2.Ic).toBeGreaterThan(result1.Ic);
  });

  it('output conductance go = Ic / Vaf', () => {
    const Vaf = 100;
    const params: BJTParams = { ...BJT_DEFAULTS, Vaf };
    const result = evaluateBJT(0.7, 5.0, params);
    const expectedGo = result.Ic / Vaf;
    expect(relApprox(result.go, expectedGo, 0.05)).toBe(true);
  });

  it('no Early voltage: go = 0', () => {
    const params: BJTParams = { ...BJT_DEFAULTS };
    const result = evaluateBJT(0.7, 5.0, params);
    expect(result.go).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// MOSFET Model
// ---------------------------------------------------------------------------

describe('MOSFET Model: Cutoff Region (NMOS)', () => {
  const params: MOSFETParams = { ...NMOS_DEFAULTS };

  it('cutoff when Vgs < Vth: Id = 0', () => {
    const result = evaluateMOSFET(0.3, 5.0, params);
    expect(result.Id).toBe(0);
    expect(result.region).toBe('cutoff');
  });

  it('cutoff: gm = 0', () => {
    const result = evaluateMOSFET(0.0, 5.0, params);
    expect(result.gm).toBe(0);
  });

  it('cutoff: gds = 0', () => {
    const result = evaluateMOSFET(0.0, 5.0, params);
    expect(result.gds).toBe(0);
  });

  it('exactly at Vth: Id = 0 (Vov = 0)', () => {
    const result = evaluateMOSFET(params.Vth, 5.0, params);
    expect(result.Id).toBe(0);
    expect(result.region).toBe('cutoff');
  });
});

describe('MOSFET Model: Linear Region (NMOS)', () => {
  const params: MOSFETParams = { ...NMOS_DEFAULTS };

  it('linear region: Vgs > Vth and Vds < Vgs - Vth', () => {
    // Vgs = 2V, Vth = 0.7V, Vov = 1.3V, Vds = 0.5V < Vov
    const result = evaluateMOSFET(2.0, 0.5, params);
    expect(result.region).toBe('linear');
    expect(result.Id).toBeGreaterThan(0);
  });

  it('linear region: Id increases with Vds', () => {
    const r1 = evaluateMOSFET(2.0, 0.2, params);
    const r2 = evaluateMOSFET(2.0, 0.5, params);
    expect(r2.Id).toBeGreaterThan(r1.Id);
  });

  it('linear region: Id = Kp * [(Vov)*Vds - Vds^2/2] * (1+lambda*Vds)', () => {
    const Vgs = 2.0;
    const Vds = 0.5;
    const Vov = Vgs - params.Vth;
    const lambda = params.lambda;
    const expected = params.Kp * (Vov * Vds - Vds * Vds / 2) * (1 + lambda * Vds);
    const result = evaluateMOSFET(Vgs, Vds, params);
    expect(relApprox(result.Id, expected, 0.001)).toBe(true);
  });

  it('linear region: gm = Kp * Vds * (1 + lambda*Vds)', () => {
    const Vgs = 2.0;
    const Vds = 0.5;
    const lambda = params.lambda;
    const expectedGm = params.Kp * Vds * (1 + lambda * Vds);
    const result = evaluateMOSFET(Vgs, Vds, params);
    expect(relApprox(result.gm, expectedGm, 0.001)).toBe(true);
  });
});

describe('MOSFET Model: Saturation Region (NMOS)', () => {
  const params: MOSFETParams = { ...NMOS_DEFAULTS };

  it('saturation region: Vgs > Vth and Vds >= Vgs - Vth', () => {
    // Vgs = 2V, Vth = 0.7V, Vov = 1.3V, Vds = 5V >= Vov
    const result = evaluateMOSFET(2.0, 5.0, params);
    expect(result.region).toBe('saturation');
    expect(result.Id).toBeGreaterThan(0);
  });

  it('saturation: Id = Kp/2 * Vov^2 * (1 + lambda*Vds)', () => {
    const Vgs = 2.0;
    const Vds = 5.0;
    const Vov = Vgs - params.Vth;
    const lambda = params.lambda;
    const expected = (params.Kp / 2) * Vov * Vov * (1 + lambda * Vds);
    const result = evaluateMOSFET(Vgs, Vds, params);
    expect(relApprox(result.Id, expected, 0.001)).toBe(true);
  });

  it('saturation: gm = Kp * Vov * (1 + lambda*Vds)', () => {
    const Vgs = 2.0;
    const Vds = 5.0;
    const Vov = Vgs - params.Vth;
    const lambda = params.lambda;
    const expectedGm = params.Kp * Vov * (1 + lambda * Vds);
    const result = evaluateMOSFET(Vgs, Vds, params);
    expect(relApprox(result.gm, expectedGm, 0.001)).toBe(true);
  });

  it('saturation: gds = Kp/2 * Vov^2 * lambda (channel-length modulation)', () => {
    const Vgs = 2.0;
    const Vds = 5.0;
    const Vov = Vgs - params.Vth;
    const expectedGds = (params.Kp / 2) * Vov * Vov * params.lambda;
    const result = evaluateMOSFET(Vgs, Vds, params);
    expect(relApprox(result.gds, expectedGds, 0.001)).toBe(true);
  });

  it('saturation: gm = 2 * Id / Vov (approximately, ignoring lambda)', () => {
    const Vgs = 2.0;
    const Vds = 5.0;
    const Vov = Vgs - params.Vth;
    const result = evaluateMOSFET(Vgs, Vds, params);
    // gm = 2*Id/Vov is the approximation when lambda*Vds << 1
    const gmApprox = 2 * result.Id / Vov;
    expect(relApprox(result.gm, gmApprox, 0.1)).toBe(true);
  });

  it('saturation: Id barely changes with Vds (current source behavior)', () => {
    const r1 = evaluateMOSFET(2.0, 2.0, params);
    const r2 = evaluateMOSFET(2.0, 10.0, params);
    // Should differ only by lambda*(Vds2-Vds1) factor
    const ratio = r2.Id / r1.Id;
    expect(ratio).toBeGreaterThan(0.95);
    expect(ratio).toBeLessThan(1.15);
  });
});

describe('MOSFET Model: PMOS', () => {
  const params: MOSFETParams = { ...PMOS_DEFAULTS };

  it('PMOS cutoff: Vgs > Vth (Vth is negative for PMOS)', () => {
    // For PMOS with Vth=-0.7V, cutoff when Vgs > -0.7V (i.e. Vgs=0)
    const result = evaluateMOSFET(0, -5.0, params);
    expect(result.region).toBe('cutoff');
    expect(result.Id).toBe(0);
  });

  it('PMOS saturation: Vgs < Vth, |Vds| > |Vgs - Vth|', () => {
    // Vgs = -2V, Vth = -0.7V, Vsg = 2V, so on (PMOS active)
    const result = evaluateMOSFET(-2.0, -5.0, params);
    expect(result.region).toBe('saturation');
    expect(result.Id).toBeLessThan(0); // PMOS current is negative (flows source to drain)
  });

  it('PMOS: current magnitude increases with |Vgs - Vth|', () => {
    const r1 = evaluateMOSFET(-1.5, -5.0, params);
    const r2 = evaluateMOSFET(-2.5, -5.0, params);
    expect(Math.abs(r2.Id)).toBeGreaterThan(Math.abs(r1.Id));
  });
});

describe('MOSFET Model: W/L Scaling', () => {
  it('doubling W doubles the current', () => {
    const params1: MOSFETParams = { ...NMOS_DEFAULTS, W: 10e-6, L: 1e-6 };
    const params2: MOSFETParams = { ...NMOS_DEFAULTS, W: 20e-6, L: 1e-6 };
    const r1 = evaluateMOSFET(2.0, 5.0, params1);
    const r2 = evaluateMOSFET(2.0, 5.0, params2);
    expect(relApprox(r2.Id, 2 * r1.Id, 0.01)).toBe(true);
  });

  it('doubling L halves the current', () => {
    const params1: MOSFETParams = { ...NMOS_DEFAULTS, W: 10e-6, L: 1e-6 };
    const params2: MOSFETParams = { ...NMOS_DEFAULTS, W: 10e-6, L: 2e-6 };
    const r1 = evaluateMOSFET(2.0, 5.0, params1);
    const r2 = evaluateMOSFET(2.0, 5.0, params2);
    expect(relApprox(r2.Id, r1.Id / 2, 0.01)).toBe(true);
  });
});

describe('MOSFET Model: Region Boundary', () => {
  it('at Vds = Vov: transitions to saturation (boundary)', () => {
    const Vgs = 2.0;
    const Vov = Vgs - NMOS_DEFAULTS.Vth; // 1.3V
    const result = evaluateMOSFET(Vgs, Vov, NMOS_DEFAULTS);
    expect(result.region).toBe('saturation');
  });

  it('at Vds just below Vov: still in linear region', () => {
    const Vgs = 2.0;
    const Vov = Vgs - NMOS_DEFAULTS.Vth;
    const result = evaluateMOSFET(Vgs, Vov - 0.001, NMOS_DEFAULTS);
    expect(result.region).toBe('linear');
  });
});

// ---------------------------------------------------------------------------
// Companion Model
// ---------------------------------------------------------------------------

describe('Diode Companion Model', () => {
  const params: DiodeParams = { ...DIODE_DEFAULTS };

  it('Geq is positive for forward bias', () => {
    const { Geq } = diodeCompanion(0.6, params);
    expect(Geq).toBeGreaterThan(0);
  });

  it('Geq increases with forward voltage', () => {
    const c1 = diodeCompanion(0.5, params);
    const c2 = diodeCompanion(0.7, params);
    expect(c2.Geq).toBeGreaterThan(c1.Geq);
  });

  it('companion linearization: I = Geq * V + Ieq reproduces I(V0) at V0', () => {
    const V0 = 0.65;
    const { Geq, Ieq } = diodeCompanion(V0, params);
    const { I: I_exact } = evaluateDiode(V0, params);
    const I_companion = Geq * V0 + Ieq;
    expect(relApprox(I_companion, I_exact, 0.01)).toBe(true);
  });

  it('Geq has minimum conductance to prevent singular matrix', () => {
    // At large reverse bias, dI/dV is extremely small
    const { Geq } = diodeCompanion(-10, params);
    expect(Geq).toBeGreaterThan(0);
    expect(Geq).toBeGreaterThanOrEqual(1e-12);
  });
});

// ---------------------------------------------------------------------------
// Newton-Raphson Solver
// ---------------------------------------------------------------------------

describe('Newton-Raphson Solver: Diode + Resistor', () => {
  const params: DiodeParams = { ...DIODE_DEFAULTS };

  it('converges for simple circuit: 5V source, 1k resistor', () => {
    const result = solveNonlinear(5.0, 1000, params);
    expect(result.converged).toBe(true);
    expect(result.iterations).toBeLessThan(20);
  });

  it('diode voltage is approximately 0.65-0.75V for typical circuit', () => {
    const result = solveNonlinear(5.0, 1000, params);
    expect(result.Vd).toBeGreaterThan(0.6);
    expect(result.Vd).toBeLessThan(0.8);
  });

  it('KVL: Vs = Id * R + Vd', () => {
    const Vs = 5.0;
    const R = 1000;
    const result = solveNonlinear(Vs, R, params);
    const kvlSum = result.Id * R + result.Vd;
    expect(relApprox(kvlSum, Vs, 0.001)).toBe(true);
  });

  it('converges for high source voltage (100V, 10k)', () => {
    const result = solveNonlinear(100, 10000, params);
    expect(result.converged).toBe(true);
    // Most voltage should be across R, Vd ~ 0.7-0.8V
    expect(result.Vd).toBeLessThan(1.0);
  });

  it('converges for small source voltage (0.1V, 100 Ohm)', () => {
    const result = solveNonlinear(0.1, 100, params);
    expect(result.converged).toBe(true);
    expect(result.Vd).toBeGreaterThan(0);
    expect(result.Vd).toBeLessThan(0.1);
  });

  it('converges for zero source voltage', () => {
    const result = solveNonlinear(0, 1000, params);
    expect(result.converged).toBe(true);
    expect(Math.abs(result.Id)).toBeLessThan(1e-10);
  });

  it('convergence within specified tolerance', () => {
    const tol = 1e-12;
    const result = solveNonlinear(5.0, 1000, params, 50, tol);
    expect(result.converged).toBe(true);
    // Verify by checking KVL residual
    const residual = Math.abs(result.Id * 1000 + result.Vd - 5.0);
    expect(residual).toBeLessThan(1e-6);
  });

  it('different R values give different operating points', () => {
    const r1 = solveNonlinear(5.0, 100, params);
    const r2 = solveNonlinear(5.0, 10000, params);
    // Higher resistance -> lower current -> lower Vd
    expect(r1.Id).toBeGreaterThan(r2.Id);
    expect(r1.Vd).toBeGreaterThan(r2.Vd);
  });
});

// ---------------------------------------------------------------------------
// Default parameter objects
// ---------------------------------------------------------------------------

describe('Default Parameter Objects', () => {
  it('DIODE_DEFAULTS has reasonable values', () => {
    expect(DIODE_DEFAULTS.Is).toBe(1e-14);
    expect(DIODE_DEFAULTS.n).toBe(1);
    expect(DIODE_DEFAULTS.T).toBe(300);
  });

  it('BJT_DEFAULTS has reasonable values', () => {
    expect(BJT_DEFAULTS.type).toBe('npn');
    expect(BJT_DEFAULTS.Is).toBe(1e-15);
    expect(BJT_DEFAULTS.betaF).toBe(100);
    expect(BJT_DEFAULTS.betaR).toBe(1);
  });

  it('NMOS_DEFAULTS has reasonable values', () => {
    expect(NMOS_DEFAULTS.type).toBe('nmos');
    expect(NMOS_DEFAULTS.Vth).toBe(0.7);
    expect(NMOS_DEFAULTS.Kp).toBe(1e-4);
    expect(NMOS_DEFAULTS.lambda).toBe(0.01);
  });

  it('PMOS_DEFAULTS has negative threshold voltage', () => {
    expect(PMOS_DEFAULTS.type).toBe('pmos');
    expect(PMOS_DEFAULTS.Vth).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('Edge Cases', () => {
  it('diode with Is=0 returns zero current', () => {
    const params: DiodeParams = { Is: 0, n: 1 };
    const { I } = evaluateDiode(0.7, params);
    expect(I).toBe(0);
  });

  it('BJT with betaF=0 does not divide by zero in gpi', () => {
    const params: BJTParams = { type: 'npn', Is: 1e-15, betaF: 0, betaR: 1 };
    const result = evaluateBJT(0.7, 5.0, params);
    expect(isFinite(result.gpi)).toBe(true);
  });

  it('MOSFET with lambda=0 gives zero gds in saturation', () => {
    const params: MOSFETParams = { ...NMOS_DEFAULTS, lambda: 0 };
    const result = evaluateMOSFET(2.0, 5.0, params);
    expect(result.gds).toBe(0);
  });

  it('MOSFET with negative Vgs for NMOS gives cutoff', () => {
    const result = evaluateMOSFET(-1.0, 5.0, NMOS_DEFAULTS);
    expect(result.region).toBe('cutoff');
    expect(result.Id).toBe(0);
  });

  it('very large Vbe in BJT does not produce NaN/Infinity', () => {
    const result = evaluateBJT(5.0, 10.0, BJT_DEFAULTS);
    expect(isFinite(result.Ic)).toBe(true);
    expect(isFinite(result.Ib)).toBe(true);
    expect(isFinite(result.gm)).toBe(true);
  });
});
