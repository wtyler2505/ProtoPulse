import { describe, it, expect } from 'vitest';

import {
  microstripZ0,
  striplineZ0,
  differentialZ0,
  skinEffectLoss,
  dielectricLoss,
  insertionLoss,
  returnLoss,
  impedanceVsFrequency,
  SPEED_OF_LIGHT,
  COPPER_CONDUCTIVITY,
  MU_0,
} from '../simulation/transmission-line';
import type {
  TransmissionLineParams,
  TransmissionLineResult,
  LossResult,
  ImpedancePoint,
} from '../simulation/transmission-line';

// ---------------------------------------------------------------------------
// Constants for tests
// ---------------------------------------------------------------------------

/** Standard FR4 microstrip: 8 mil trace, 4 mil dielectric, 1oz copper */
const FR4_MICROSTRIP: TransmissionLineParams = {
  width: 0.2032, // 8 mil in mm
  height: 0.1016, // 4 mil in mm
  thickness: 0.035, // 1oz copper
  er: 4.4,
  tanD: 0.02,
  length: 50, // 50 mm trace
};

/** Rogers 4350B microstrip for high-speed */
const ROGERS_MICROSTRIP: TransmissionLineParams = {
  width: 0.3,
  height: 0.2,
  thickness: 0.035,
  er: 3.66,
  tanD: 0.0037,
  length: 100,
};

/** Stripline embedded in FR4 */
const FR4_STRIPLINE: TransmissionLineParams = {
  width: 0.15,
  height: 0.2, // distance to reference plane
  thickness: 0.035,
  er: 4.4,
  tanD: 0.02,
  length: 75,
};

// ---------------------------------------------------------------------------
// microstripZ0
// ---------------------------------------------------------------------------

describe('microstripZ0', () => {
  it('calculates impedance for standard FR4 microstrip', () => {
    const result = microstripZ0(FR4_MICROSTRIP);
    expect(result.z0).toBeGreaterThan(20);
    expect(result.z0).toBeLessThan(200);
    expect(result.erEff).toBeGreaterThan(1);
    expect(result.erEff).toBeLessThan(FR4_MICROSTRIP.er);
    expect(result.delay).toBeGreaterThan(0);
    expect(result.velocity).toBeGreaterThan(0);
  });

  it('returns correct Z0 using IPC-2141 formula', () => {
    // Z0 = 87/sqrt(er+1.41) * ln(5.98*h/(0.8*w+t))
    const p = FR4_MICROSTRIP;
    const expected = (87 / Math.sqrt(p.er + 1.41)) * Math.log((5.98 * p.height) / (0.8 * p.width + p.thickness));
    const result = microstripZ0(p);
    expect(result.z0).toBeCloseTo(expected, 2);
  });

  it('wider trace gives lower impedance', () => {
    const narrow = microstripZ0({ ...FR4_MICROSTRIP, width: 0.1 });
    const wide = microstripZ0({ ...FR4_MICROSTRIP, width: 0.5 });
    expect(wide.z0).toBeLessThan(narrow.z0);
  });

  it('taller dielectric gives higher impedance', () => {
    const short = microstripZ0({ ...FR4_MICROSTRIP, height: 0.05 });
    const tall = microstripZ0({ ...FR4_MICROSTRIP, height: 0.3 });
    expect(tall.z0).toBeGreaterThan(short.z0);
  });

  it('higher er gives lower impedance', () => {
    const lowEr = microstripZ0({ ...FR4_MICROSTRIP, er: 2.0 });
    const highEr = microstripZ0({ ...FR4_MICROSTRIP, er: 10.0 });
    expect(highEr.z0).toBeLessThan(lowEr.z0);
  });

  it('calculates effective dielectric constant between 1 and er', () => {
    const result = microstripZ0(FR4_MICROSTRIP);
    expect(result.erEff).toBeGreaterThan(1);
    expect(result.erEff).toBeLessThan(FR4_MICROSTRIP.er);
  });

  it('propagation delay is consistent with velocity', () => {
    const result = microstripZ0(FR4_MICROSTRIP);
    // delay (ps/mm) * velocity (mm/ps) should equal 1
    expect(result.delay * result.velocity).toBeCloseTo(1, 4);
  });

  it('velocity is less than speed of light', () => {
    const result = microstripZ0(FR4_MICROSTRIP);
    const cMmPerPs = SPEED_OF_LIGHT * 1e-9; // mm/ps
    expect(result.velocity).toBeLessThan(cMmPerPs);
  });

  it('handles Rogers material correctly', () => {
    const result = microstripZ0(ROGERS_MICROSTRIP);
    // Rogers 4350B has lower er, should give higher Z0 than FR4 (all else equal)
    const fr4Result = microstripZ0({ ...ROGERS_MICROSTRIP, er: 4.4, tanD: 0.02 });
    expect(result.z0).toBeGreaterThan(fr4Result.z0);
  });

  it('throws or returns safely for zero width', () => {
    expect(() => microstripZ0({ ...FR4_MICROSTRIP, width: 0 })).toThrow();
  });

  it('throws or returns safely for zero height', () => {
    expect(() => microstripZ0({ ...FR4_MICROSTRIP, height: 0 })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// striplineZ0
// ---------------------------------------------------------------------------

describe('striplineZ0', () => {
  it('calculates impedance for FR4 stripline', () => {
    const result = striplineZ0(FR4_STRIPLINE);
    expect(result.z0).toBeGreaterThan(20);
    expect(result.z0).toBeLessThan(200);
  });

  it('returns correct Z0 using stripline formula', () => {
    // Z0 = 60/sqrt(er) * ln(4*b/(0.67*pi*(0.8*w+t)))
    // where b = 2*height (total dielectric thickness between both ref planes)
    const p = FR4_STRIPLINE;
    const b = 2 * p.height;
    const expected = (60 / Math.sqrt(p.er)) * Math.log((4 * b) / (0.67 * Math.PI * (0.8 * p.width + p.thickness)));
    const result = striplineZ0(p);
    expect(result.z0).toBeCloseTo(expected, 2);
  });

  it('erEff equals er for stripline (fully embedded)', () => {
    const result = striplineZ0(FR4_STRIPLINE);
    expect(result.erEff).toBeCloseTo(FR4_STRIPLINE.er, 2);
  });

  it('wider trace gives lower impedance', () => {
    const narrow = striplineZ0({ ...FR4_STRIPLINE, width: 0.1 });
    const wide = striplineZ0({ ...FR4_STRIPLINE, width: 0.5 });
    expect(wide.z0).toBeLessThan(narrow.z0);
  });

  it('velocity is slower than microstrip (higher erEff)', () => {
    const microResult = microstripZ0({ ...FR4_MICROSTRIP, height: 0.2, width: 0.15 });
    const stripResult = striplineZ0(FR4_STRIPLINE);
    // Stripline erEff = er, microstrip erEff < er => stripline is slower
    expect(stripResult.velocity).toBeLessThan(microResult.velocity);
  });
});

// ---------------------------------------------------------------------------
// differentialZ0
// ---------------------------------------------------------------------------

describe('differentialZ0', () => {
  it('calculates differential impedance', () => {
    const result = differentialZ0(FR4_MICROSTRIP, 0.2);
    expect(result.z0).toBeGreaterThan(0);
    expect(result.erEff).toBeGreaterThan(1);
  });

  it('differential impedance is approximately 2x single-ended with coupling correction', () => {
    const single = microstripZ0(FR4_MICROSTRIP);
    const diff = differentialZ0(FR4_MICROSTRIP, 1.0); // large spacing -> minimal coupling
    // With large spacing, Zdiff approaches 2 * Z0
    expect(diff.z0).toBeCloseTo(2 * single.z0, -1); // within 10 ohms
  });

  it('tighter spacing reduces differential impedance', () => {
    const wide = differentialZ0(FR4_MICROSTRIP, 1.0);
    const tight = differentialZ0(FR4_MICROSTRIP, 0.05);
    expect(tight.z0).toBeLessThan(wide.z0);
  });

  it('100 ohm differential pairs are achievable', () => {
    // Typical 100 ohm differential pair geometry
    const params: TransmissionLineParams = {
      width: 0.12,
      height: 0.1,
      thickness: 0.035,
      er: 4.4,
      tanD: 0.02,
      length: 50,
    };
    const result = differentialZ0(params, 0.15);
    // Should be in a reasonable range for 100 ohm diff pairs
    expect(result.z0).toBeGreaterThan(50);
    expect(result.z0).toBeLessThan(200);
  });
});

// ---------------------------------------------------------------------------
// skinEffectLoss
// ---------------------------------------------------------------------------

describe('skinEffectLoss', () => {
  it('calculates non-zero conductor loss at 1 GHz', () => {
    const loss = skinEffectLoss(1e9, 0.2, 0.035, 50);
    expect(loss).toBeGreaterThan(0);
  });

  it('loss increases with frequency', () => {
    const loss1G = skinEffectLoss(1e9, 0.2, 0.035, 50);
    const loss10G = skinEffectLoss(10e9, 0.2, 0.035, 50);
    expect(loss10G).toBeGreaterThan(loss1G);
  });

  it('loss increases with trace length', () => {
    const short = skinEffectLoss(1e9, 0.2, 0.035, 10);
    const long = skinEffectLoss(1e9, 0.2, 0.035, 100);
    expect(long).toBeGreaterThan(short);
  });

  it('narrower traces have more loss', () => {
    const wide = skinEffectLoss(1e9, 0.5, 0.035, 50);
    const narrow = skinEffectLoss(1e9, 0.1, 0.035, 50);
    expect(narrow).toBeGreaterThan(wide);
  });

  it('returns 0 for DC (0 Hz)', () => {
    const loss = skinEffectLoss(0, 0.2, 0.035, 50);
    expect(loss).toBe(0);
  });

  it('returns loss in dB (positive value)', () => {
    const loss = skinEffectLoss(1e9, 0.2, 0.035, 50);
    expect(loss).toBeGreaterThan(0);
    expect(Number.isFinite(loss)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// dielectricLoss
// ---------------------------------------------------------------------------

describe('dielectricLoss', () => {
  it('calculates non-zero dielectric loss', () => {
    const erEff = 3.3;
    const loss = dielectricLoss(1e9, erEff, 0.02, 50);
    expect(loss).toBeGreaterThan(0);
  });

  it('loss increases with frequency', () => {
    const loss1G = dielectricLoss(1e9, 3.3, 0.02, 50);
    const loss5G = dielectricLoss(5e9, 3.3, 0.02, 50);
    expect(loss5G).toBeGreaterThan(loss1G);
  });

  it('higher tanD gives more loss', () => {
    const lowLoss = dielectricLoss(1e9, 3.3, 0.002, 50);
    const highLoss = dielectricLoss(1e9, 3.3, 0.02, 50);
    expect(highLoss).toBeGreaterThan(lowLoss);
  });

  it('loss scales with tanD linearly', () => {
    const loss1 = dielectricLoss(1e9, 3.3, 0.01, 50);
    const loss2 = dielectricLoss(1e9, 3.3, 0.02, 50);
    expect(loss2 / loss1).toBeCloseTo(2, 1);
  });

  it('returns 0 for DC (0 Hz)', () => {
    const loss = dielectricLoss(0, 3.3, 0.02, 50);
    expect(loss).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// insertionLoss
// ---------------------------------------------------------------------------

describe('insertionLoss', () => {
  it('total insertion loss is sum of conductor + dielectric', () => {
    const result = insertionLoss(1e9, FR4_MICROSTRIP);
    expect(result.totalLoss).toBeCloseTo(result.conductorLoss + result.dielectricLoss, 6);
  });

  it('returns all loss components', () => {
    const result = insertionLoss(1e9, FR4_MICROSTRIP);
    expect(result.conductorLoss).toBeGreaterThan(0);
    expect(result.dielectricLoss).toBeGreaterThan(0);
    expect(result.totalLoss).toBeGreaterThan(0);
    expect(result.lossPerMm).toBeGreaterThan(0);
  });

  it('lossPerMm equals totalLoss / length', () => {
    const result = insertionLoss(1e9, FR4_MICROSTRIP);
    expect(result.lossPerMm).toBeCloseTo(result.totalLoss / FR4_MICROSTRIP.length, 6);
  });

  it('Rogers material has less dielectric loss than FR4', () => {
    const fr4Loss = insertionLoss(1e9, FR4_MICROSTRIP);
    const rogersLoss = insertionLoss(1e9, { ...FR4_MICROSTRIP, er: 3.66, tanD: 0.0037 });
    expect(rogersLoss.dielectricLoss).toBeLessThan(fr4Loss.dielectricLoss);
  });

  it('loss increases with frequency', () => {
    const low = insertionLoss(100e6, FR4_MICROSTRIP);
    const high = insertionLoss(5e9, FR4_MICROSTRIP);
    expect(high.totalLoss).toBeGreaterThan(low.totalLoss);
  });
});

// ---------------------------------------------------------------------------
// returnLoss
// ---------------------------------------------------------------------------

describe('returnLoss', () => {
  it('perfect match gives very low return loss (large negative dB)', () => {
    const rl = returnLoss(50, 50);
    // Perfect match: reflection coefficient = 0, S11 = -infinity
    expect(rl).toBeLessThan(-40);
  });

  it('open circuit gives 0 dB return loss', () => {
    const rl = returnLoss(50, 1e9); // very high load approximates open
    expect(rl).toBeCloseTo(0, 0);
  });

  it('short circuit gives 0 dB return loss', () => {
    const rl = returnLoss(50, 0);
    expect(rl).toBeCloseTo(0, 0);
  });

  it('2:1 mismatch gives known return loss', () => {
    // Z0=50, ZL=100 => gamma = (100-50)/(100+50) = 1/3
    // S11 = 20*log10(1/3) = -9.54 dB
    const rl = returnLoss(50, 100);
    expect(rl).toBeCloseTo(-9.54, 1);
  });

  it('symmetric for high and low impedance mismatches', () => {
    // |gamma| should be the same for ZL=25 and ZL=100 with Z0=50
    const rl25 = returnLoss(50, 25);
    const rl100 = returnLoss(50, 100);
    expect(rl25).toBeCloseTo(rl100, 1);
  });
});

// ---------------------------------------------------------------------------
// impedanceVsFrequency
// ---------------------------------------------------------------------------

describe('impedanceVsFrequency', () => {
  it('generates the correct number of frequency points', () => {
    const result = impedanceVsFrequency(FR4_MICROSTRIP, 1e6, 1e9, 10);
    expect(result.length).toBe(10);
  });

  it('frequencies span the requested range', () => {
    const result = impedanceVsFrequency(FR4_MICROSTRIP, 1e6, 1e9, 20);
    expect(result[0].frequency).toBeCloseTo(1e6, -3);
    expect(result[result.length - 1].frequency).toBeCloseTo(1e9, -3);
  });

  it('each point has valid impedance data', () => {
    const result = impedanceVsFrequency(FR4_MICROSTRIP, 1e6, 1e9, 10);
    for (const pt of result) {
      expect(pt.frequency).toBeGreaterThan(0);
      expect(pt.z0).toBeGreaterThan(0);
      expect(pt.loss).toBeGreaterThan(0);
      expect(Number.isFinite(pt.z0)).toBe(true);
      expect(Number.isFinite(pt.loss)).toBe(true);
    }
  });

  it('loss increases monotonically with frequency', () => {
    const result = impedanceVsFrequency(FR4_MICROSTRIP, 1e6, 10e9, 20);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].loss).toBeGreaterThanOrEqual(result[i - 1].loss);
    }
  });
});

// ---------------------------------------------------------------------------
// Physical constant exports
// ---------------------------------------------------------------------------

describe('physical constants', () => {
  it('exports speed of light in m/s', () => {
    expect(SPEED_OF_LIGHT).toBeCloseTo(299792458, 0);
  });

  it('exports copper conductivity in S/m', () => {
    expect(COPPER_CONDUCTIVITY).toBeCloseTo(5.8e7, -5);
  });

  it('exports permeability of free space', () => {
    expect(MU_0).toBeCloseTo(4 * Math.PI * 1e-7, 12);
  });
});
