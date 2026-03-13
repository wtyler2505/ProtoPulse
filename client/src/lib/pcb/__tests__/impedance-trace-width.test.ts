/**
 * Tests for ImpedanceTraceWidthManager — impedance-aware trace width enforcement.
 *
 * Covers:
 * - Microstrip width calculation with known reference values
 * - Stripline width calculation
 * - Width suggestion batch
 * - Compliance check (pass/fail)
 * - Edge cases: very high Z, very low Z, zero thickness
 * - FR4 defaults (εr=4.4), Rogers 4003C (εr=3.55)
 * - Singleton + subscribe/unsubscribe
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ImpedanceTraceWidthManager,
  calculateImpedance,
} from '../impedance-trace-width';
import type {
  StackupParams,
  NetWithTarget,
} from '../impedance-trace-width';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Standard FR4 stackup: εr=4.4, 0.2mm dielectric, 1oz copper, microstrip. */
const FR4_MICROSTRIP: StackupParams = {
  dielectricConstant: 4.4,
  dielectricHeight: 0.2,
  copperThickness: 0.035,
  traceType: 'microstrip',
};

/** FR4 stripline: εr=4.4, 0.2mm dielectric, 1oz copper. */
const FR4_STRIPLINE: StackupParams = {
  dielectricConstant: 4.4,
  dielectricHeight: 0.2,
  copperThickness: 0.035,
  traceType: 'stripline',
};

/** Rogers 4003C microstrip: εr=3.55, 0.2mm dielectric, 1oz copper. */
const ROGERS_MICROSTRIP: StackupParams = {
  dielectricConstant: 3.55,
  dielectricHeight: 0.2,
  copperThickness: 0.035,
  traceType: 'microstrip',
};

/** Rogers 4003C stripline. */
const ROGERS_STRIPLINE: StackupParams = {
  dielectricConstant: 3.55,
  dielectricHeight: 0.2,
  copperThickness: 0.035,
  traceType: 'stripline',
};

/** Thick dielectric FR4 microstrip for low-impedance testing. */
const THICK_FR4: StackupParams = {
  dielectricConstant: 4.4,
  dielectricHeight: 1.0,
  copperThickness: 0.035,
  traceType: 'microstrip',
};

// ---------------------------------------------------------------------------
// Singleton & subscribe
// ---------------------------------------------------------------------------

describe('ImpedanceTraceWidthManager — Singleton & Subscribe', () => {
  beforeEach(() => {
    ImpedanceTraceWidthManager.resetForTesting();
  });

  it('returns the same instance on repeated calls', () => {
    const a = ImpedanceTraceWidthManager.getInstance();
    const b = ImpedanceTraceWidthManager.getInstance();
    expect(a).toBe(b);
  });

  it('returns a new instance after resetForTesting', () => {
    const a = ImpedanceTraceWidthManager.getInstance();
    ImpedanceTraceWidthManager.resetForTesting();
    const b = ImpedanceTraceWidthManager.getInstance();
    expect(a).not.toBe(b);
  });

  it('subscribes and receives notifications on stackup change', () => {
    const mgr = ImpedanceTraceWidthManager.getInstance();
    let callCount = 0;
    const unsub = mgr.subscribe(() => {
      callCount++;
    });

    mgr.setStackupParams(FR4_MICROSTRIP);
    expect(callCount).toBe(1);

    mgr.setStackupParams(FR4_STRIPLINE);
    expect(callCount).toBe(2);

    unsub();
    mgr.setStackupParams(ROGERS_MICROSTRIP);
    expect(callCount).toBe(2); // no further calls after unsubscribe
  });

  it('notifies on tolerance change', () => {
    const mgr = ImpedanceTraceWidthManager.getInstance();
    let called = false;
    const unsub = mgr.subscribe(() => {
      called = true;
    });

    mgr.setTolerance(0.1);
    expect(called).toBe(true);
    unsub();
  });

  it('getSnapshot returns a copy of stackup params', () => {
    const mgr = ImpedanceTraceWidthManager.getInstance();
    mgr.setStackupParams(FR4_MICROSTRIP);
    const snap = mgr.getSnapshot();
    expect(snap).toEqual(FR4_MICROSTRIP);
    expect(snap).not.toBe(mgr.getSnapshot()); // different reference
  });
});

// ---------------------------------------------------------------------------
// calculateImpedance — raw function
// ---------------------------------------------------------------------------

describe('calculateImpedance (raw function)', () => {
  it('returns a positive impedance for FR4 microstrip', () => {
    const z = calculateImpedance(0.3, FR4_MICROSTRIP);
    expect(z).toBeGreaterThan(0);
    expect(z).toBeLessThan(200);
  });

  it('returns a positive impedance for FR4 stripline', () => {
    const z = calculateImpedance(0.3, FR4_STRIPLINE);
    expect(z).toBeGreaterThan(0);
    expect(z).toBeLessThan(200);
  });

  it('stripline impedance is lower than microstrip for same geometry', () => {
    const zMicrostrip = calculateImpedance(0.2, FR4_MICROSTRIP);
    const zStripline = calculateImpedance(0.2, FR4_STRIPLINE);
    // Stripline is fully embedded in dielectric → lower impedance
    expect(zStripline).toBeLessThan(zMicrostrip);
  });

  it('impedance decreases with wider trace', () => {
    const zNarrow = calculateImpedance(0.1, FR4_MICROSTRIP);
    const zWide = calculateImpedance(0.5, FR4_MICROSTRIP);
    expect(zNarrow).toBeGreaterThan(zWide);
  });

  it('impedance decreases with higher dielectric constant', () => {
    const zFR4 = calculateImpedance(0.2, FR4_MICROSTRIP);
    // Use a high-εr material
    const highEr: StackupParams = { ...FR4_MICROSTRIP, dielectricConstant: 10.0 };
    const zHighEr = calculateImpedance(0.2, highEr);
    expect(zHighEr).toBeLessThan(zFR4);
  });

  it('returns NaN for zero or negative width', () => {
    expect(Number.isNaN(calculateImpedance(0, FR4_MICROSTRIP))).toBe(true);
    expect(Number.isNaN(calculateImpedance(-1, FR4_MICROSTRIP))).toBe(true);
  });

  it('returns NaN for zero or negative dielectric height', () => {
    const bad: StackupParams = { ...FR4_MICROSTRIP, dielectricHeight: 0 };
    expect(Number.isNaN(calculateImpedance(0.2, bad))).toBe(true);
  });

  it('returns NaN for εr < 1', () => {
    const bad: StackupParams = { ...FR4_MICROSTRIP, dielectricConstant: 0.5 };
    expect(Number.isNaN(calculateImpedance(0.2, bad))).toBe(true);
  });

  it('Rogers 4003C gives higher impedance than FR4 for same geometry (lower εr)', () => {
    const zFR4 = calculateImpedance(0.2, FR4_MICROSTRIP);
    const zRogers = calculateImpedance(0.2, ROGERS_MICROSTRIP);
    expect(zRogers).toBeGreaterThan(zFR4);
  });
});

// ---------------------------------------------------------------------------
// calculateRequiredWidth — microstrip
// ---------------------------------------------------------------------------

describe('calculateRequiredWidth — microstrip', () => {
  beforeEach(() => {
    ImpedanceTraceWidthManager.resetForTesting();
  });

  it('finds a width for 50Ω on FR4 microstrip', () => {
    const mgr = ImpedanceTraceWidthManager.getInstance();
    const result = mgr.calculateRequiredWidth(50, FR4_MICROSTRIP);
    expect(result).not.toBeNull();
    expect(result!.width).toBeGreaterThan(0);
    expect(result!.error).toBeLessThan(1);
    // Verify round-trip: impedance at the computed width should be ~50Ω
    const z = calculateImpedance(result!.width, FR4_MICROSTRIP);
    expect(Math.abs(z - 50)).toBeLessThan(1);
  });

  it('finds a width for 75Ω on FR4 microstrip', () => {
    const mgr = ImpedanceTraceWidthManager.getInstance();
    const result = mgr.calculateRequiredWidth(75, FR4_MICROSTRIP);
    expect(result).not.toBeNull();
    expect(result!.error).toBeLessThan(1);
    // 75Ω requires a narrower trace than 50Ω
    const result50 = mgr.calculateRequiredWidth(50, FR4_MICROSTRIP);
    expect(result!.width).toBeLessThan(result50!.width);
  });

  it('finds a width for 100Ω on FR4 microstrip', () => {
    const mgr = ImpedanceTraceWidthManager.getInstance();
    const result = mgr.calculateRequiredWidth(100, FR4_MICROSTRIP);
    expect(result).not.toBeNull();
    expect(result!.error).toBeLessThan(1);
  });

  it('finds a width for 50Ω on Rogers 4003C microstrip', () => {
    const mgr = ImpedanceTraceWidthManager.getInstance();
    const result = mgr.calculateRequiredWidth(50, ROGERS_MICROSTRIP);
    expect(result).not.toBeNull();
    expect(result!.error).toBeLessThan(1);
    // Rogers 4003C (εr=3.55) → wider trace for same impedance vs FR4 (εr=4.4)
    const resultFR4 = mgr.calculateRequiredWidth(50, FR4_MICROSTRIP);
    expect(result!.width).toBeGreaterThan(resultFR4!.width);
  });

  it('uses instance default stackup when no stackup provided', () => {
    const mgr = ImpedanceTraceWidthManager.getInstance();
    mgr.setStackupParams(FR4_MICROSTRIP);
    const result = mgr.calculateRequiredWidth(50);
    const resultExplicit = mgr.calculateRequiredWidth(50, FR4_MICROSTRIP);
    expect(result).not.toBeNull();
    expect(result!.width).toBeCloseTo(resultExplicit!.width, 3);
  });

  it('returns null for non-positive target impedance', () => {
    const mgr = ImpedanceTraceWidthManager.getInstance();
    expect(mgr.calculateRequiredWidth(0, FR4_MICROSTRIP)).toBeNull();
    expect(mgr.calculateRequiredWidth(-50, FR4_MICROSTRIP)).toBeNull();
  });

  it('handles very high target impedance (narrow trace)', () => {
    const mgr = ImpedanceTraceWidthManager.getInstance();
    const result = mgr.calculateRequiredWidth(200, THICK_FR4);
    expect(result).not.toBeNull();
    // Should return a very narrow trace or indicate best approximation
    expect(result!.width).toBeGreaterThan(0);
  });

  it('handles very low target impedance (wide trace)', () => {
    const mgr = ImpedanceTraceWidthManager.getInstance();
    const result = mgr.calculateRequiredWidth(10, THICK_FR4);
    expect(result).not.toBeNull();
    expect(result!.width).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// calculateRequiredWidth — stripline
// ---------------------------------------------------------------------------

describe('calculateRequiredWidth — stripline', () => {
  beforeEach(() => {
    ImpedanceTraceWidthManager.resetForTesting();
  });

  it('finds a width for 50Ω on FR4 stripline', () => {
    const mgr = ImpedanceTraceWidthManager.getInstance();
    const result = mgr.calculateRequiredWidth(50, FR4_STRIPLINE);
    expect(result).not.toBeNull();
    expect(result!.error).toBeLessThan(1);
    const z = calculateImpedance(result!.width, FR4_STRIPLINE);
    expect(Math.abs(z - 50)).toBeLessThan(1);
  });

  it('stripline width for 50Ω is narrower than microstrip (higher εr effect)', () => {
    const mgr = ImpedanceTraceWidthManager.getInstance();
    const stripResult = mgr.calculateRequiredWidth(50, FR4_STRIPLINE);
    const microResult = mgr.calculateRequiredWidth(50, FR4_MICROSTRIP);
    expect(stripResult).not.toBeNull();
    expect(microResult).not.toBeNull();
    // Stripline in full dielectric → narrower trace for same impedance
    expect(stripResult!.width).toBeLessThan(microResult!.width);
  });

  it('finds a width for 50Ω on Rogers 4003C stripline', () => {
    const mgr = ImpedanceTraceWidthManager.getInstance();
    const result = mgr.calculateRequiredWidth(50, ROGERS_STRIPLINE);
    expect(result).not.toBeNull();
    expect(result!.error).toBeLessThan(1);
  });

  it('finds a width for 75Ω on FR4 stripline', () => {
    const mgr = ImpedanceTraceWidthManager.getInstance();
    const result = mgr.calculateRequiredWidth(75, FR4_STRIPLINE);
    expect(result).not.toBeNull();
    expect(result!.error).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// checkCompliance
// ---------------------------------------------------------------------------

describe('checkCompliance', () => {
  beforeEach(() => {
    ImpedanceTraceWidthManager.resetForTesting();
  });

  it('reports compliant when width matches target impedance', () => {
    const mgr = ImpedanceTraceWidthManager.getInstance();
    // First find the correct width for 50Ω
    const result = mgr.calculateRequiredWidth(50, FR4_MICROSTRIP);
    expect(result).not.toBeNull();

    const compliance = mgr.checkCompliance('net1', result!.width, 50, FR4_MICROSTRIP);
    expect(compliance.compliant).toBe(true);
    expect(compliance.deviation).toBeLessThan(0.05);
    expect(compliance.targetZ).toBe(50);
  });

  it('reports non-compliant when width is too wide for target', () => {
    const mgr = ImpedanceTraceWidthManager.getInstance();
    // Very wide trace → low impedance → non-compliant for 50Ω
    const compliance = mgr.checkCompliance('net1', 2.0, 50, FR4_MICROSTRIP);
    expect(compliance.compliant).toBe(false);
    expect(compliance.actualZ).toBeLessThan(50);
    expect(compliance.suggestedWidth).toBeLessThan(2.0);
  });

  it('reports non-compliant when width is too narrow for target', () => {
    const mgr = ImpedanceTraceWidthManager.getInstance();
    // Very narrow trace → high impedance → non-compliant for 50Ω target
    const compliance = mgr.checkCompliance('net1', 0.01, 50, THICK_FR4);
    expect(compliance.compliant).toBe(false);
    expect(compliance.actualZ).toBeGreaterThan(50);
  });

  it('uses instance default stackup when not provided', () => {
    const mgr = ImpedanceTraceWidthManager.getInstance();
    mgr.setStackupParams(FR4_MICROSTRIP);
    const result = mgr.calculateRequiredWidth(50);
    expect(result).not.toBeNull();

    const c1 = mgr.checkCompliance('net1', result!.width, 50);
    const c2 = mgr.checkCompliance('net1', result!.width, 50, FR4_MICROSTRIP);
    expect(c1.compliant).toBe(c2.compliant);
    expect(c1.actualZ).toBeCloseTo(c2.actualZ, 1);
  });

  it('deviation is 0 for perfect impedance match', () => {
    const mgr = ImpedanceTraceWidthManager.getInstance();
    const result = mgr.calculateRequiredWidth(50, FR4_MICROSTRIP);
    expect(result).not.toBeNull();
    const compliance = mgr.checkCompliance('net1', result!.width, 50, FR4_MICROSTRIP);
    expect(compliance.deviation).toBeLessThan(0.01);
  });

  it('respects custom tolerance', () => {
    const mgr = ImpedanceTraceWidthManager.getInstance();
    mgr.setTolerance(0.01); // very tight: 1%

    // Find exact width and then offset it slightly
    const result = mgr.calculateRequiredWidth(50, THICK_FR4);
    expect(result).not.toBeNull();

    // At the exact width it should still be compliant (error < 0.01Ω)
    const complianceExact = mgr.checkCompliance('net1', result!.width, 50, THICK_FR4);
    expect(complianceExact.compliant).toBe(true);

    // With a 20% wider trace, it should be non-compliant at 1% tolerance
    const complianceWide = mgr.checkCompliance('net1', result!.width * 1.5, 50, THICK_FR4);
    expect(complianceWide.compliant).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getWidthSuggestions
// ---------------------------------------------------------------------------

describe('getWidthSuggestions', () => {
  beforeEach(() => {
    ImpedanceTraceWidthManager.resetForTesting();
  });

  it('returns suggestions for multiple nets', () => {
    const mgr = ImpedanceTraceWidthManager.getInstance();
    const nets: NetWithTarget[] = [
      { netId: 'clk', netName: 'CLK', currentWidth: 0.2, targetImpedance: 50 },
      { netId: 'data', netName: 'DATA', currentWidth: 0.15, targetImpedance: 75 },
      { netId: 'pwr', netName: 'VCC', currentWidth: 0.5, targetImpedance: 30 },
    ];

    const suggestions = mgr.getWidthSuggestions(nets, THICK_FR4);
    expect(suggestions).toHaveLength(3);

    for (const s of suggestions) {
      expect(s.netId).toBeTruthy();
      expect(s.netName).toBeTruthy();
      expect(s.suggestedWidth).toBeGreaterThan(0);
      expect(s.targetZ).toBeGreaterThan(0);
    }
  });

  it('marks compliant nets correctly', () => {
    const mgr = ImpedanceTraceWidthManager.getInstance();
    // Find the correct width for 50Ω, then use it as current
    const result = mgr.calculateRequiredWidth(50, THICK_FR4);
    expect(result).not.toBeNull();

    const nets: NetWithTarget[] = [
      { netId: 'net1', netName: 'CLK', currentWidth: result!.width, targetImpedance: 50 },
    ];

    const suggestions = mgr.getWidthSuggestions(nets, THICK_FR4);
    expect(suggestions[0].compliant).toBe(true);
  });

  it('marks non-compliant nets correctly', () => {
    const mgr = ImpedanceTraceWidthManager.getInstance();
    const nets: NetWithTarget[] = [
      { netId: 'net1', netName: 'DATA', currentWidth: 2.0, targetImpedance: 100 },
    ];

    const suggestions = mgr.getWidthSuggestions(nets, THICK_FR4);
    expect(suggestions[0].compliant).toBe(false);
    expect(suggestions[0].actualZ).toBeLessThan(100);
  });

  it('uses instance default stackup when not provided', () => {
    const mgr = ImpedanceTraceWidthManager.getInstance();
    mgr.setStackupParams(THICK_FR4);

    const nets: NetWithTarget[] = [
      { netId: 'net1', netName: 'CLK', currentWidth: 0.2, targetImpedance: 50 },
    ];

    const s1 = mgr.getWidthSuggestions(nets);
    const s2 = mgr.getWidthSuggestions(nets, THICK_FR4);
    expect(s1[0].suggestedWidth).toBeCloseTo(s2[0].suggestedWidth, 3);
  });

  it('handles empty nets array', () => {
    const mgr = ImpedanceTraceWidthManager.getInstance();
    const suggestions = mgr.getWidthSuggestions([], THICK_FR4);
    expect(suggestions).toHaveLength(0);
  });

  it('suggestion netId and netName match input', () => {
    const mgr = ImpedanceTraceWidthManager.getInstance();
    const nets: NetWithTarget[] = [
      { netId: 'abc-123', netName: 'MY_NET', currentWidth: 0.3, targetImpedance: 50 },
    ];
    const suggestions = mgr.getWidthSuggestions(nets, THICK_FR4);
    expect(suggestions[0].netId).toBe('abc-123');
    expect(suggestions[0].netName).toBe('MY_NET');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('Edge cases', () => {
  beforeEach(() => {
    ImpedanceTraceWidthManager.resetForTesting();
  });

  it('handles zero copper thickness', () => {
    const mgr = ImpedanceTraceWidthManager.getInstance();
    const stackup: StackupParams = { ...FR4_MICROSTRIP, copperThickness: 0 };
    const result = mgr.calculateRequiredWidth(50, stackup);
    // Should still work — copper thickness of 0 means t=0 in the formula
    expect(result).not.toBeNull();
    expect(result!.width).toBeGreaterThan(0);
  });

  it('tolerance validation rejects out-of-range values', () => {
    const mgr = ImpedanceTraceWidthManager.getInstance();
    expect(() => {
      mgr.setTolerance(-0.1);
    }).toThrow('Tolerance must be between 0 and 1');
    expect(() => {
      mgr.setTolerance(1.5);
    }).toThrow('Tolerance must be between 0 and 1');
  });

  it('tolerance 0 means only exact match is compliant', () => {
    const mgr = ImpedanceTraceWidthManager.getInstance();
    mgr.setTolerance(0);
    // Even the computed width may have slight error
    const result = mgr.calculateRequiredWidth(50, THICK_FR4);
    expect(result).not.toBeNull();
    // deviation > 0 means non-compliant at 0% tolerance (unless perfect match)
    const compliance = mgr.checkCompliance('net1', result!.width * 1.01, 50, THICK_FR4);
    expect(compliance.compliant).toBe(false);
  });

  it('tolerance 1.0 means everything is compliant', () => {
    const mgr = ImpedanceTraceWidthManager.getInstance();
    mgr.setTolerance(1.0);
    // Even a wildly wrong width should be compliant at 100% tolerance
    const compliance = mgr.checkCompliance('net1', 5.0, 50, THICK_FR4);
    expect(compliance.compliant).toBe(true);
  });

  it('very thin dielectric gives high impedance for narrow trace', () => {
    const thin: StackupParams = {
      dielectricConstant: 4.4,
      dielectricHeight: 0.05, // very thin
      copperThickness: 0.035,
      traceType: 'microstrip',
    };
    const z = calculateImpedance(0.05, thin);
    // Should be finite and positive
    expect(Number.isFinite(z)).toBe(true);
    expect(z).toBeGreaterThan(0);
  });

  it('very thick dielectric gives lower impedance sensitivity', () => {
    const thick: StackupParams = {
      dielectricConstant: 4.4,
      dielectricHeight: 2.0, // very thick
      copperThickness: 0.035,
      traceType: 'microstrip',
    };
    const result = calculateImpedance(0.2, thick);
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThan(0);
    // Thicker dielectric → higher impedance for same trace width
    const zThin = calculateImpedance(0.2, FR4_MICROSTRIP);
    expect(result).toBeGreaterThan(zThin);
  });

  it('NaN impedance for very wide trace on thin dielectric (ln arg <= 1)', () => {
    const thin: StackupParams = {
      dielectricConstant: 4.4,
      dielectricHeight: 0.01,
      copperThickness: 0.035,
      traceType: 'microstrip',
    };
    // Very wide trace on very thin dielectric → arg = 5.98*0.01 / (0.8*10 + 0.035) ≈ 0.007 < 1
    const z = calculateImpedance(10, thin);
    expect(Number.isNaN(z)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Material comparisons (FR4 vs Rogers)
// ---------------------------------------------------------------------------

describe('Material comparisons', () => {
  beforeEach(() => {
    ImpedanceTraceWidthManager.resetForTesting();
  });

  it('Rogers 4003C requires wider trace than FR4 for 50Ω microstrip', () => {
    const mgr = ImpedanceTraceWidthManager.getInstance();
    const fr4 = mgr.calculateRequiredWidth(50, FR4_MICROSTRIP);
    const rogers = mgr.calculateRequiredWidth(50, ROGERS_MICROSTRIP);
    expect(fr4).not.toBeNull();
    expect(rogers).not.toBeNull();
    // Lower εr (Rogers 3.55 vs FR4 4.4) → higher impedance at same width → wider trace needed for 50Ω
    expect(rogers!.width).toBeGreaterThan(fr4!.width);
  });

  it('Rogers 4003C requires wider trace than FR4 for 50Ω stripline', () => {
    const mgr = ImpedanceTraceWidthManager.getInstance();
    const fr4 = mgr.calculateRequiredWidth(50, FR4_STRIPLINE);
    const rogers = mgr.calculateRequiredWidth(50, ROGERS_STRIPLINE);
    expect(fr4).not.toBeNull();
    expect(rogers).not.toBeNull();
    expect(rogers!.width).toBeGreaterThan(fr4!.width);
  });

  it('impedance at same width is higher on Rogers than FR4', () => {
    const zFR4 = calculateImpedance(0.2, FR4_MICROSTRIP);
    const zRogers = calculateImpedance(0.2, ROGERS_MICROSTRIP);
    expect(zRogers).toBeGreaterThan(zFR4);
  });
});

// ---------------------------------------------------------------------------
// Configuration persistence
// ---------------------------------------------------------------------------

describe('Configuration', () => {
  beforeEach(() => {
    ImpedanceTraceWidthManager.resetForTesting();
  });

  it('getStackupParams returns set values', () => {
    const mgr = ImpedanceTraceWidthManager.getInstance();
    mgr.setStackupParams(ROGERS_MICROSTRIP);
    expect(mgr.getStackupParams()).toEqual(ROGERS_MICROSTRIP);
  });

  it('getTolerance returns set value', () => {
    const mgr = ImpedanceTraceWidthManager.getInstance();
    mgr.setTolerance(0.08);
    expect(mgr.getTolerance()).toBe(0.08);
  });

  it('setStackupParams makes a defensive copy', () => {
    const mgr = ImpedanceTraceWidthManager.getInstance();
    const params = { ...FR4_MICROSTRIP };
    mgr.setStackupParams(params);
    params.dielectricConstant = 999;
    expect(mgr.getStackupParams().dielectricConstant).toBe(4.4);
  });

  it('getStackupParams returns a copy (mutations do not affect internal state)', () => {
    const mgr = ImpedanceTraceWidthManager.getInstance();
    mgr.setStackupParams(FR4_MICROSTRIP);
    const snap = mgr.getStackupParams();
    snap.dielectricConstant = 999;
    expect(mgr.getStackupParams().dielectricConstant).toBe(4.4);
  });
});
