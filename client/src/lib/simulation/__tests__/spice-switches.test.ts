/**
 * Vitest tests for SPICE S/W Switch Elements (BL-0512)
 *
 * Coverage:
 *   - S switch parsing (valid, errors)
 *   - W switch parsing (valid, errors)
 *   - Switch model parsing (.MODEL SW/CSW with Ron/Roff/Vt/Vh/It/Ih)
 *   - Resistance calculation: fully on (≈Ron), fully off (≈Roff), at threshold (midpoint)
 *   - Sigmoid smoothness (continuous, no discontinuity, monotonic)
 *   - Hysteresis (different transition widths)
 *   - MNA stamp (conductance values)
 *   - Conductance derivative
 *   - H-bridge example (4 switches, complementary control)
 *   - Edge cases: zero hysteresis, Ron=Roff (degenerate), very large Roff, negative control
 *   - Parse errors (missing fields, invalid model type)
 */

import { describe, it, expect } from 'vitest';
import {
  parseSSwitch,
  parseWSwitch,
  parseSwitchModel,
  getSwitchResistance,
  stampSwitch,
  getSwitchConductanceDerivative,
  SW_DEFAULTS,
  CSW_DEFAULTS,
} from '../spice-switches';
import type {
  SSwitchDef,
  WSwitchDef,
  SwitchModel,
  MNAMatrix,
} from '../spice-switches';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a zero-filled NxN MNA matrix. */
function createMNA(size: number): MNAMatrix {
  const G: number[][] = [];
  for (let i = 0; i < size; i++) {
    G.push(new Array(size).fill(0));
  }
  return { G, b: new Array(size).fill(0) };
}

/** Relative tolerance check. */
function relClose(actual: number, expected: number, tol = 0.05): boolean {
  if (expected === 0) {
    return Math.abs(actual) < tol;
  }
  return Math.abs((actual - expected) / expected) <= tol;
}

// ---------------------------------------------------------------------------
// S Switch Parsing
// ---------------------------------------------------------------------------

describe('parseSSwitch', () => {
  it('parses a standard S switch line', () => {
    const result = parseSSwitch('S1 out 0 ctrl+ ctrl- SMOD');
    expect(result).toEqual({
      name: 'S1',
      node1: 'out',
      node2: '0',
      ctrlPlus: 'ctrl+',
      ctrlMinus: 'ctrl-',
      modelName: 'SMOD',
    } satisfies SSwitchDef);
  });

  it('parses with numeric node names', () => {
    const result = parseSSwitch('S2 3 0 5 6 MYSWITCH');
    expect(result.name).toBe('S2');
    expect(result.node1).toBe('3');
    expect(result.node2).toBe('0');
    expect(result.ctrlPlus).toBe('5');
    expect(result.ctrlMinus).toBe('6');
    expect(result.modelName).toBe('MYSWITCH');
  });

  it('parses case-insensitively for name prefix', () => {
    const result = parseSSwitch('sHigh 1 2 3 4 SW1');
    expect(result.name).toBe('sHigh');
    expect(result.modelName).toBe('SW1');
  });

  it('handles extra whitespace', () => {
    const result = parseSSwitch('  S1   out   0   ctrl   gnd   MOD  ');
    expect(result.name).toBe('S1');
    expect(result.node1).toBe('out');
    expect(result.modelName).toBe('MOD');
  });

  it('throws on empty line', () => {
    expect(() => parseSSwitch('')).toThrow('Empty S switch line');
  });

  it('throws on too few tokens', () => {
    expect(() => parseSSwitch('S1 out 0 ctrl SMOD')).toThrow('S switch requires 6 fields');
  });

  it('throws on wrong prefix', () => {
    expect(() => parseSSwitch('R1 out 0 ctrl+ ctrl- SMOD')).toThrow("must start with 'S'");
  });
});

// ---------------------------------------------------------------------------
// W Switch Parsing
// ---------------------------------------------------------------------------

describe('parseWSwitch', () => {
  it('parses a standard W switch line', () => {
    const result = parseWSwitch('W1 out 0 Vsense WMOD');
    expect(result).toEqual({
      name: 'W1',
      node1: 'out',
      node2: '0',
      senseElement: 'Vsense',
      modelName: 'WMOD',
    } satisfies WSwitchDef);
  });

  it('parses with numeric node names', () => {
    const result = parseWSwitch('W2 3 0 V1 CSWMOD');
    expect(result.name).toBe('W2');
    expect(result.node1).toBe('3');
    expect(result.node2).toBe('0');
    expect(result.senseElement).toBe('V1');
    expect(result.modelName).toBe('CSWMOD');
  });

  it('handles lowercase prefix', () => {
    const result = parseWSwitch('w1 a b Vsense MOD1');
    expect(result.name).toBe('w1');
  });

  it('throws on empty line', () => {
    expect(() => parseWSwitch('')).toThrow('Empty W switch line');
  });

  it('throws on too few tokens', () => {
    expect(() => parseWSwitch('W1 out 0 WMOD')).toThrow('W switch requires 5 fields');
  });

  it('throws on wrong prefix', () => {
    expect(() => parseWSwitch('R1 out 0 Vsense WMOD')).toThrow("must start with 'W'");
  });
});

// ---------------------------------------------------------------------------
// Switch Model Parsing
// ---------------------------------------------------------------------------

describe('parseSwitchModel', () => {
  it('parses an SW model with parenthesized params', () => {
    const model = parseSwitchModel('.MODEL SMOD SW(Ron=1 Roff=1Meg Vt=2.5 Vh=0.5)');
    expect(model.name).toBe('SMOD');
    expect(model.type).toBe('SW');
    expect(model.Ron).toBe(1);
    expect(model.Roff).toBe(1e6);
    expect(model.threshold).toBe(2.5);
    expect(model.hysteresis).toBe(0.5);
  });

  it('parses a CSW model', () => {
    const model = parseSwitchModel('.MODEL CMOD CSW(Ron=0.5 Roff=10Meg It=100m Ih=10m)');
    expect(model.name).toBe('CMOD');
    expect(model.type).toBe('CSW');
    expect(model.Ron).toBeCloseTo(0.5);
    expect(model.Roff).toBeCloseTo(1e7);
    expect(model.threshold).toBeCloseTo(0.1);
    expect(model.hysteresis).toBeCloseTo(0.01);
  });

  it('parses SW model without parentheses', () => {
    const model = parseSwitchModel('.MODEL SW1 SW Ron=10 Roff=100k Vt=1.5');
    expect(model.name).toBe('SW1');
    expect(model.type).toBe('SW');
    expect(model.Ron).toBe(10);
    expect(model.Roff).toBe(100e3);
    expect(model.threshold).toBe(1.5);
    expect(model.hysteresis).toBe(0); // default
  });

  it('uses defaults for missing SW parameters', () => {
    const model = parseSwitchModel('.MODEL SDEF SW()');
    expect(model.Ron).toBe(SW_DEFAULTS.Ron);
    expect(model.Roff).toBe(SW_DEFAULTS.Roff);
    expect(model.threshold).toBe(SW_DEFAULTS.threshold);
    expect(model.hysteresis).toBe(SW_DEFAULTS.hysteresis);
  });

  it('uses defaults for missing CSW parameters', () => {
    const model = parseSwitchModel('.MODEL CDEF CSW()');
    expect(model.Ron).toBe(CSW_DEFAULTS.Ron);
    expect(model.Roff).toBe(CSW_DEFAULTS.Roff);
    expect(model.threshold).toBe(CSW_DEFAULTS.threshold);
    expect(model.hysteresis).toBe(CSW_DEFAULTS.hysteresis);
  });

  it('is case-insensitive for .MODEL keyword', () => {
    const model = parseSwitchModel('.model mymod sw(Ron=5)');
    expect(model.name).toBe('mymod');
    expect(model.type).toBe('SW');
    expect(model.Ron).toBe(5);
  });

  it('throws on empty line', () => {
    expect(() => parseSwitchModel('')).toThrow('Empty switch model line');
  });

  it('throws on invalid model type', () => {
    expect(() => parseSwitchModel('.MODEL BAD NPN(Ron=1)')).toThrow('Invalid switch model line');
  });

  it('throws on missing .MODEL prefix', () => {
    expect(() => parseSwitchModel('SMOD SW(Ron=1)')).toThrow('Invalid switch model line');
  });
});

// ---------------------------------------------------------------------------
// Resistance Calculation — Basic
// ---------------------------------------------------------------------------

describe('getSwitchResistance', () => {
  const model: SwitchModel = {
    name: 'TEST',
    type: 'SW',
    Ron: 1,
    Roff: 1e6,
    threshold: 2.5,
    hysteresis: 0,
  };

  it('returns approximately Ron when far above threshold', () => {
    const R = getSwitchResistance(100, model);
    expect(relClose(R, model.Ron, 0.01)).toBe(true);
  });

  it('returns approximately Roff when far below threshold', () => {
    const R = getSwitchResistance(-100, model);
    expect(relClose(R, model.Roff, 0.01)).toBe(true);
  });

  it('returns geometric midpoint at threshold (zero hysteresis)', () => {
    // With log-space interpolation, the midpoint is sqrt(Ron * Roff) = sqrt(1 * 1e6) = 1000
    const R = getSwitchResistance(2.5, model);
    const geometricMid = Math.sqrt(model.Ron * model.Roff);
    expect(relClose(R, geometricMid, 0.01)).toBe(true);
  });

  it('resistance decreases monotonically as control increases', () => {
    const values = [-5, -2, 0, 1, 2, 2.5, 3, 4, 5, 10];
    const resistances = values.map((v) => getSwitchResistance(v, model));
    for (let i = 1; i < resistances.length; i++) {
      expect(resistances[i]).toBeLessThanOrEqual(resistances[i - 1]);
    }
  });

  it('transitions smoothly — no jumps between adjacent points', () => {
    // Sample densely around threshold and check that the change between
    // adjacent samples is bounded (no step discontinuity)
    const step = 0.01;
    let prevR = getSwitchResistance(2.0, model);
    for (let v = 2.0 + step; v <= 3.0; v += step) {
      const R = getSwitchResistance(v, model);
      // The ratio between adjacent samples should be close to 1
      // (no more than 2x change per 0.01V step)
      const ratio = prevR / R;
      expect(ratio).toBeGreaterThan(0.5);
      expect(ratio).toBeLessThan(2.0);
      prevR = R;
    }
  });
});

// ---------------------------------------------------------------------------
// Resistance Calculation — Hysteresis
// ---------------------------------------------------------------------------

describe('getSwitchResistance with hysteresis', () => {
  const model: SwitchModel = {
    name: 'HYS',
    type: 'SW',
    Ron: 1,
    Roff: 1e6,
    threshold: 2.5,
    hysteresis: 1.0,
  };

  it('transition band is wider with hysteresis', () => {
    // With Vh=1.0, the 10%-90% transition should span approximately 1V
    // At threshold (2.5V), should be at geometric midpoint
    const R_at_threshold = getSwitchResistance(2.5, model);
    const geometricMid = Math.sqrt(model.Ron * model.Roff);
    expect(relClose(R_at_threshold, geometricMid, 0.01)).toBe(true);
  });

  it('wider transition than zero-hysteresis model', () => {
    const noHys: SwitchModel = { ...model, hysteresis: 0 };

    // At 0.3V above threshold, the zero-hysteresis model should be closer to Ron
    const R_hys = getSwitchResistance(2.8, model);
    const R_noHys = getSwitchResistance(2.8, noHys);

    // The hysteresis model should be more resistive (closer to Roff) at the same offset
    expect(R_hys).toBeGreaterThan(R_noHys);
  });

  it('still converges to Ron far above threshold', () => {
    const R = getSwitchResistance(100, model);
    expect(relClose(R, model.Ron, 0.01)).toBe(true);
  });

  it('still converges to Roff far below threshold', () => {
    const R = getSwitchResistance(-100, model);
    expect(relClose(R, model.Roff, 0.01)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Edge Cases
// ---------------------------------------------------------------------------

describe('getSwitchResistance edge cases', () => {
  it('handles Ron = Roff (degenerate)', () => {
    const model: SwitchModel = {
      name: 'DEG',
      type: 'SW',
      Ron: 100,
      Roff: 100,
      threshold: 0,
      hysteresis: 0,
    };
    expect(getSwitchResistance(0, model)).toBe(100);
    expect(getSwitchResistance(100, model)).toBe(100);
    expect(getSwitchResistance(-100, model)).toBe(100);
  });

  it('handles very large Roff', () => {
    const model: SwitchModel = {
      name: 'BIG',
      type: 'SW',
      Ron: 0.01,
      Roff: 1e12,
      threshold: 5,
      hysteresis: 0,
    };
    const R_off = getSwitchResistance(-100, model);
    expect(relClose(R_off, 1e12, 0.01)).toBe(true);
    const R_on = getSwitchResistance(100, model);
    expect(relClose(R_on, 0.01, 0.01)).toBe(true);
  });

  it('handles negative control value with positive threshold', () => {
    const model: SwitchModel = {
      name: 'NEG',
      type: 'SW',
      Ron: 1,
      Roff: 1e6,
      threshold: 5,
      hysteresis: 0,
    };
    // -10 is well below threshold of 5, should be off
    const R = getSwitchResistance(-10, model);
    expect(relClose(R, 1e6, 0.01)).toBe(true);
  });

  it('handles negative threshold', () => {
    const model: SwitchModel = {
      name: 'NEGTH',
      type: 'SW',
      Ron: 1,
      Roff: 1e6,
      threshold: -2,
      hysteresis: 0,
    };
    // Control at 0 is above threshold of -2
    const R = getSwitchResistance(0, model);
    expect(R).toBeLessThan(100); // should be closer to Ron
  });

  it('handles zero threshold', () => {
    const model: SwitchModel = {
      name: 'ZERO',
      type: 'SW',
      Ron: 10,
      Roff: 1e5,
      threshold: 0,
      hysteresis: 0,
    };
    const R = getSwitchResistance(0, model);
    const geometricMid = Math.sqrt(10 * 1e5);
    expect(relClose(R, geometricMid, 0.01)).toBe(true);
  });

  it('handles CSW model identically to SW (same math)', () => {
    const swModel: SwitchModel = {
      name: 'SW1',
      type: 'SW',
      Ron: 1,
      Roff: 1e6,
      threshold: 0.5,
      hysteresis: 0.1,
    };
    const cswModel: SwitchModel = {
      name: 'CSW1',
      type: 'CSW',
      Ron: 1,
      Roff: 1e6,
      threshold: 0.5,
      hysteresis: 0.1,
    };
    // Same parameters, same math — type only affects parsing
    expect(getSwitchResistance(0.5, swModel)).toBe(getSwitchResistance(0.5, cswModel));
    expect(getSwitchResistance(10, swModel)).toBe(getSwitchResistance(10, cswModel));
  });
});

// ---------------------------------------------------------------------------
// MNA Stamping
// ---------------------------------------------------------------------------

describe('stampSwitch', () => {
  it('stamps conductance between node1 and node2 for S switch', () => {
    const mna = createMNA(3);
    const switchDef: SSwitchDef = {
      name: 'S1',
      node1: '1',
      node2: '2',
      ctrlPlus: '3',
      ctrlMinus: '0',
      modelName: 'SMOD',
    };
    const model: SwitchModel = {
      name: 'SMOD',
      type: 'SW',
      Ron: 1,
      Roff: 1e6,
      threshold: 2.5,
      hysteresis: 0,
    };
    const nodeMap: Record<string, number> = { '1': 1, '2': 2, '3': 3, '0': 0 };

    // Control at 100V — switch fully ON, R ≈ 1 ohm, G ≈ 1 S
    stampSwitch(mna, switchDef, model, 100, nodeMap);

    const expectedG = 1 / getSwitchResistance(100, model);
    expect(mna.G[0][0]).toBeCloseTo(expectedG, 3);
    expect(mna.G[1][1]).toBeCloseTo(expectedG, 3);
    expect(mna.G[0][1]).toBeCloseTo(-expectedG, 3);
    expect(mna.G[1][0]).toBeCloseTo(-expectedG, 3);
  });

  it('stamps conductance for W switch', () => {
    const mna = createMNA(2);
    const switchDef: WSwitchDef = {
      name: 'W1',
      node1: '1',
      node2: '2',
      senseElement: 'Vsense',
      modelName: 'WMOD',
    };
    const model: SwitchModel = {
      name: 'WMOD',
      type: 'CSW',
      Ron: 0.5,
      Roff: 1e7,
      threshold: 0.1,
      hysteresis: 0,
    };
    const nodeMap: Record<string, number> = { '1': 1, '2': 2, '0': 0 };

    // Control at 10A — switch fully ON, R ≈ 0.5 ohm
    stampSwitch(mna, switchDef, model, 10, nodeMap);

    const expectedG = 1 / getSwitchResistance(10, model);
    expect(mna.G[0][0]).toBeCloseTo(expectedG, 3);
    expect(mna.G[1][1]).toBeCloseTo(expectedG, 3);
    expect(mna.G[0][1]).toBeCloseTo(-expectedG, 3);
    expect(mna.G[1][0]).toBeCloseTo(-expectedG, 3);
  });

  it('handles ground node correctly (node 0 not stamped)', () => {
    const mna = createMNA(2);
    const switchDef: SSwitchDef = {
      name: 'S1',
      node1: '1',
      node2: '0',
      ctrlPlus: '2',
      ctrlMinus: '0',
      modelName: 'MOD',
    };
    const model: SwitchModel = {
      name: 'MOD',
      type: 'SW',
      Ron: 10,
      Roff: 1e5,
      threshold: 0,
      hysteresis: 0,
    };
    const nodeMap: Record<string, number> = { '1': 1, '2': 2, '0': 0 };

    stampSwitch(mna, switchDef, model, 100, nodeMap);

    // Only node 1 diagonal should be stamped (node 0 = ground)
    const expectedG = 1 / getSwitchResistance(100, model);
    expect(mna.G[0][0]).toBeCloseTo(expectedG, 3);
    // Off-diagonal involving ground should remain 0
    // (ground node is not in matrix)
  });

  it('OFF state produces very small conductance', () => {
    const mna = createMNA(2);
    const switchDef: SSwitchDef = {
      name: 'S1',
      node1: '1',
      node2: '2',
      ctrlPlus: '3',
      ctrlMinus: '0',
      modelName: 'SMOD',
    };
    const model: SwitchModel = {
      name: 'SMOD',
      type: 'SW',
      Ron: 1,
      Roff: 1e6,
      threshold: 5,
      hysteresis: 0,
    };
    const nodeMap: Record<string, number> = { '1': 1, '2': 2, '3': 3, '0': 0 };

    // Control at -100V — switch fully OFF, G ≈ 1e-6 S
    stampSwitch(mna, switchDef, model, -100, nodeMap);

    const expectedG = 1 / getSwitchResistance(-100, model);
    expect(expectedG).toBeCloseTo(1e-6, 8);
    expect(mna.G[0][0]).toBeCloseTo(expectedG, 8);
  });
});

// ---------------------------------------------------------------------------
// Conductance Derivative
// ---------------------------------------------------------------------------

describe('getSwitchConductanceDerivative', () => {
  const model: SwitchModel = {
    name: 'TEST',
    type: 'SW',
    Ron: 1,
    Roff: 1e6,
    threshold: 2.5,
    hysteresis: 0,
  };

  it('is approximately zero far from threshold', () => {
    expect(Math.abs(getSwitchConductanceDerivative(100, model))).toBeLessThan(1e-6);
    expect(Math.abs(getSwitchConductanceDerivative(-100, model))).toBeLessThan(1e-6);
  });

  it('is nonzero near threshold', () => {
    const dG = getSwitchConductanceDerivative(2.5, model);
    expect(Math.abs(dG)).toBeGreaterThan(1e-3);
  });

  it('has correct sign (conductance increases as control increases)', () => {
    // When Ron < Roff, increasing control increases conductance (decreases resistance)
    // So dG/dx should be positive near threshold
    const dG = getSwitchConductanceDerivative(2.5, model);
    expect(dG).toBeGreaterThan(0);
  });

  it('matches numerical derivative', () => {
    const dx = 1e-6;
    const G1 = 1 / getSwitchResistance(2.5, model);
    const G2 = 1 / getSwitchResistance(2.5 + dx, model);
    const numericalDG = (G2 - G1) / dx;
    const analyticalDG = getSwitchConductanceDerivative(2.5, model);
    expect(relClose(analyticalDG, numericalDG, 0.01)).toBe(true);
  });

  it('is zero for degenerate model (Ron = Roff)', () => {
    const degModel: SwitchModel = {
      name: 'DEG',
      type: 'SW',
      Ron: 100,
      Roff: 100,
      threshold: 0,
      hysteresis: 0,
    };
    expect(getSwitchConductanceDerivative(0, degModel)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// H-Bridge Example (4 switches, complementary control)
// ---------------------------------------------------------------------------

describe('H-bridge scenario', () => {
  // Classic H-bridge: 4 switches S1-S4
  // S1: VCC to OUT_A (high-side left)
  // S2: OUT_A to GND (low-side left)
  // S3: VCC to OUT_B (high-side right)
  // S4: OUT_B to GND (low-side right)
  //
  // Forward: S1 ON, S4 ON (S2 OFF, S3 OFF) → motor drives forward
  // Reverse: S2 ON, S3 ON (S1 OFF, S4 OFF) → motor drives reverse

  const model: SwitchModel = {
    name: 'HBSW',
    type: 'SW',
    Ron: 0.1,
    Roff: 1e8,
    threshold: 2.5,
    hysteresis: 0.5,
  };

  it('forward drive: S1/S4 ON, S2/S3 OFF', () => {
    const controlHigh = 5; // well above threshold
    const controlLow = 0; // well below threshold

    const R_S1 = getSwitchResistance(controlHigh, model);
    const R_S2 = getSwitchResistance(controlLow, model);
    const R_S3 = getSwitchResistance(controlLow, model);
    const R_S4 = getSwitchResistance(controlHigh, model);

    // S1 and S4 should be ON (low resistance)
    expect(relClose(R_S1, 0.1, 0.01)).toBe(true);
    expect(relClose(R_S4, 0.1, 0.01)).toBe(true);

    // S2 and S3 should be OFF (high resistance)
    expect(relClose(R_S2, 1e8, 0.01)).toBe(true);
    expect(relClose(R_S3, 1e8, 0.01)).toBe(true);

    // On/Off ratio
    expect(R_S2 / R_S1).toBeGreaterThan(1e8);
  });

  it('reverse drive: S2/S3 ON, S1/S4 OFF', () => {
    const controlHigh = 5;
    const controlLow = 0;

    const R_S1 = getSwitchResistance(controlLow, model);
    const R_S2 = getSwitchResistance(controlHigh, model);
    const R_S3 = getSwitchResistance(controlHigh, model);
    const R_S4 = getSwitchResistance(controlLow, model);

    expect(relClose(R_S2, 0.1, 0.01)).toBe(true);
    expect(relClose(R_S3, 0.1, 0.01)).toBe(true);
    expect(relClose(R_S1, 1e8, 0.01)).toBe(true);
    expect(relClose(R_S4, 1e8, 0.01)).toBe(true);
  });

  it('shoot-through prevention: both controls at threshold should be mid-range', () => {
    const R_mid = getSwitchResistance(2.5, model);
    const geometricMid = Math.sqrt(0.1 * 1e8);
    expect(relClose(R_mid, geometricMid, 0.01)).toBe(true);
  });

  it('H-bridge MNA stamping does not cross-contaminate', () => {
    // 4 nodes: VCC(1), GND(0), OUT_A(2), OUT_B(3)
    const mna = createMNA(3);
    const nodeMap: Record<string, number> = { VCC: 1, GND: 0, OUT_A: 2, OUT_B: 3 };

    const s1: SSwitchDef = { name: 'S1', node1: 'VCC', node2: 'OUT_A', ctrlPlus: 'C1', ctrlMinus: 'GND', modelName: 'HBSW' };
    const s4: SSwitchDef = { name: 'S4', node1: 'OUT_B', node2: 'GND', ctrlPlus: 'C4', ctrlMinus: 'GND', modelName: 'HBSW' };

    stampSwitch(mna, s1, model, 5, nodeMap); // ON
    stampSwitch(mna, s4, model, 5, nodeMap); // ON

    const G_on = 1 / getSwitchResistance(5, model);

    // S1 stamps between VCC(1) and OUT_A(2)
    expect(mna.G[0][0]).toBeCloseTo(G_on, 3); // VCC diagonal
    expect(mna.G[1][1]).toBeCloseTo(G_on, 3); // OUT_A diagonal
    expect(mna.G[0][1]).toBeCloseTo(-G_on, 3);
    expect(mna.G[1][0]).toBeCloseTo(-G_on, 3);

    // S4 stamps between OUT_B(3) and GND(0) — only OUT_B diagonal
    expect(mna.G[2][2]).toBeCloseTo(G_on, 3);
  });
});

// ---------------------------------------------------------------------------
// Default Models
// ---------------------------------------------------------------------------

describe('Default models', () => {
  it('SW_DEFAULTS has sensible values', () => {
    expect(SW_DEFAULTS.type).toBe('SW');
    expect(SW_DEFAULTS.Ron).toBe(1);
    expect(SW_DEFAULTS.Roff).toBe(1e6);
    expect(SW_DEFAULTS.threshold).toBe(0);
    expect(SW_DEFAULTS.hysteresis).toBe(0);
  });

  it('CSW_DEFAULTS has sensible values', () => {
    expect(CSW_DEFAULTS.type).toBe('CSW');
    expect(CSW_DEFAULTS.Ron).toBe(1);
    expect(CSW_DEFAULTS.Roff).toBe(1e6);
    expect(CSW_DEFAULTS.threshold).toBe(0);
    expect(CSW_DEFAULTS.hysteresis).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Round-trip: parse model then compute resistance
// ---------------------------------------------------------------------------

describe('Parse → Compute round-trip', () => {
  it('parsed SW model produces correct resistance values', () => {
    const model = parseSwitchModel('.MODEL MySwitch SW(Ron=0.5 Roff=500k Vt=3.3 Vh=0.2)');

    // Far above threshold — ON
    const R_on = getSwitchResistance(10, model);
    expect(relClose(R_on, 0.5, 0.05)).toBe(true);

    // Far below threshold — OFF
    const R_off = getSwitchResistance(-10, model);
    expect(relClose(R_off, 500e3, 0.05)).toBe(true);
  });

  it('parsed CSW model produces correct resistance values', () => {
    const model = parseSwitchModel('.MODEL MySensor CSW(Ron=2 Roff=10Meg It=50m Ih=5m)');

    // 1A through sense element — well above 50mA threshold
    const R_on = getSwitchResistance(1, model);
    expect(relClose(R_on, 2, 0.05)).toBe(true);

    // 0A — well below threshold
    const R_off = getSwitchResistance(-1, model);
    expect(relClose(R_off, 10e6, 0.05)).toBe(true);
  });
});
