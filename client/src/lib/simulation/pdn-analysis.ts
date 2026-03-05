/**
 * Power Distribution Network (PDN) / Power Integrity Analysis Engine
 *
 * Performs frequency-domain impedance analysis of power delivery networks,
 * including decoupling capacitor optimization, via modeling, plane capacitance,
 * VRM output impedance, IR drop estimation, and resonance detection.
 *
 * Physics basis:
 *   - Each decoupling cap is modeled as series RLC: Z = ESR + j(2*pi*f*ESL - 1/(2*pi*f*C))
 *   - Parallel combination of all caps: 1/Z_total = sum(1/Z_i)
 *   - Via inductance: L = (mu0 * h / 2*pi) * ln(D_antipad / D_via)
 *   - Via resistance: R = rho_Cu * h / (pi * (r_outer^2 - r_inner^2))
 *   - Plane capacitance: C = eps0 * eps_r * A / d
 *   - VRM: Z_vrm = R_out * (1 + j*f/f_bw) (rising above bandwidth)
 *
 * Usage:
 *   const analyzer = new PDNAnalyzer(powerNet, stackupLayers);
 *   analyzer.addVRM(vrm);
 *   analyzer.addDecouplingCap(cap);
 *   const result = analyzer.analyze();
 *
 * React hook:
 *   const { analyze, result, isAnalyzing } = usePDNAnalysis();
 */

import { useCallback, useState } from 'react';

import type { StackupLayer } from '@/lib/board-stackup';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Permeability of free space (H/m). */
const MU_0 = 4 * Math.PI * 1e-7;

/** Permittivity of free space (F/m). */
const EPSILON_0 = 8.854e-12;

/** Resistivity of copper (ohm-m). */
const RHO_CU = 1.724e-8;

/** Default frequency sweep: 100 Hz to 1 GHz. */
const DEFAULT_FREQ_START = 100;
const DEFAULT_FREQ_END = 1e9;
const DEFAULT_POINTS_PER_DECADE = 100;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PowerNet {
  name: string;
  voltage: number;
  maxCurrent: number;
  rippleTarget: number; // mV
}

export interface DecouplingCap {
  id: string;
  value: number; // farads
  esr: number; // ohms
  esl: number; // henries
  position: { x: number; y: number }; // mm
  mountingInductance: number; // nH
  tolerance: number; // fraction (e.g. 0.1 for +/-10%)
}

export interface PowerVia {
  position: { x: number; y: number };
  diameter: number; // mm
  fromLayer: string;
  toLayer: string;
  inductance: number; // nH (calculated)
  resistance: number; // milliohms (calculated)
}

export interface VRM {
  id: string;
  name: string;
  outputVoltage: number; // V
  maxCurrent: number; // A
  outputImpedance: number; // milliohms at DC
  bandwidth: number; // Hz (control loop bandwidth)
  position: { x: number; y: number };
}

export interface PDNTarget {
  frequency: number;
  impedance: number;
}

export interface ImpedancePoint {
  frequency: number;
  impedance: number; // ohms (magnitude)
  phase: number; // degrees
}

export interface IRDropResult {
  maxDrop: number; // mV
  dropMap: Array<{ x: number; y: number; drop: number }>;
  worstPath: string;
  meetsTarget: boolean;
}

export interface Resonance {
  frequency: number;
  impedance: number;
  type: 'parallel' | 'series';
  involvedComponents: string[];
}

export interface DecapAnalysis {
  effectiveBandwidth: number;
  gaps: Array<{ lowFreq: number; highFreq: number; peakZ: number }>;
  recommendations: string[];
}

export interface CurrentDistribution {
  viaId: string;
  current: number;
  utilizationPercent: number;
}

export interface PDNSummary {
  meetsTarget: boolean;
  lowestMargin: number; // dB below target (negative = failing)
  criticalFrequency: number;
  overallRisk: 'low' | 'moderate' | 'high' | 'critical';
  recommendations: string[];
}

export interface PDNResult {
  impedanceProfile: ImpedancePoint[];
  irDrop: IRDropResult;
  resonances: Resonance[];
  decapAnalysis: DecapAnalysis;
  currentDistribution: CurrentDistribution[];
  summary: PDNSummary;
}

// ---------------------------------------------------------------------------
// Standard decoupling cap database
// ---------------------------------------------------------------------------

interface DecapParams {
  esr: number; // ohms
  esl: number; // henries
}

const STANDARD_DECAP_DB: Record<string, DecapParams> = {
  '100pF_0402': { esr: 0.1, esl: 0.4e-9 },
  '1nF_0402': { esr: 0.05, esl: 0.4e-9 },
  '10nF_0402': { esr: 0.02, esl: 0.5e-9 },
  '100nF_0402': { esr: 0.01, esl: 0.5e-9 },
  '100nF_0603': { esr: 0.015, esl: 0.7e-9 },
  '1uF_0402': { esr: 0.008, esl: 0.5e-9 },
  '1uF_0603': { esr: 0.01, esl: 0.7e-9 },
  '10uF_0805': { esr: 0.005, esl: 1.0e-9 },
  '10uF_1206': { esr: 0.003, esl: 1.2e-9 },
  '100uF_electrolytic': { esr: 0.05, esl: 5.0e-9 },
  '1000uF_electrolytic': { esr: 0.02, esl: 10.0e-9 },
};

/** Standard cap values for recommendation engine (farads). */
const STANDARD_CAP_VALUES = [
  100e-12, 1e-9, 10e-9, 100e-9, 1e-6, 10e-6, 100e-6, 1000e-6,
];

// ---------------------------------------------------------------------------
// Complex arithmetic helpers
// ---------------------------------------------------------------------------

interface Complex {
  re: number;
  im: number;
}

function cAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

function cDiv(a: Complex, b: Complex): Complex {
  const denom = b.re * b.re + b.im * b.im;
  if (denom === 0) {
    return { re: 0, im: 0 };
  }
  return {
    re: (a.re * b.re + a.im * b.im) / denom,
    im: (a.im * b.re - a.re * b.im) / denom,
  };
}

function cMag(z: Complex): number {
  return Math.sqrt(z.re * z.re + z.im * z.im);
}

function cPhase(z: Complex): number {
  return (Math.atan2(z.im, z.re) * 180) / Math.PI;
}

function cReciprocal(z: Complex): Complex {
  return cDiv({ re: 1, im: 0 }, z);
}

// ---------------------------------------------------------------------------
// PDNAnalyzer
// ---------------------------------------------------------------------------

export class PDNAnalyzer {
  private readonly powerNet: PowerNet;
  private readonly stackupLayers: StackupLayer[];
  private vrms: VRM[] = [];
  private caps: DecouplingCap[] = [];
  private vias: PowerVia[] = [];
  private planeArea = 0; // mm^2
  private targetImpedanceOverride: number | null = null;

  constructor(powerNet: PowerNet, stackupLayers: StackupLayer[]) {
    this.powerNet = powerNet;
    this.stackupLayers = stackupLayers;
  }

  // -----------------------------------------------------------------------
  // Configuration
  // -----------------------------------------------------------------------

  addVRM(vrm: VRM): void {
    this.vrms.push(vrm);
  }

  addDecouplingCap(cap: DecouplingCap): void {
    this.caps.push(cap);
  }

  addPowerVia(via: PowerVia): void {
    this.vias.push(via);
  }

  setPlaneArea(area: number): void {
    this.planeArea = area;
  }

  setTargetImpedance(target: number): void {
    this.targetImpedanceOverride = target;
  }

  // -----------------------------------------------------------------------
  // Static utility methods
  // -----------------------------------------------------------------------

  /**
   * Calculate via inductance in nH.
   * @param height - layer separation in mm
   * @param viaDiameter - drill diameter in mm
   * @param antipadDiameter - antipad diameter in mm
   */
  static calculateViaInductance(height: number, viaDiameter: number, antipadDiameter: number): number {
    if (height <= 0 || viaDiameter <= 0 || antipadDiameter <= viaDiameter) {
      return 0;
    }
    const h = height * 1e-3; // mm to m
    const ratio = antipadDiameter / viaDiameter;
    const inductanceH = (MU_0 * h) / (2 * Math.PI) * Math.log(ratio);
    return inductanceH * 1e9; // H to nH
  }

  /**
   * Calculate via resistance in milliohms.
   * @param height - layer separation in mm
   * @param drillDiameter - drill diameter in mm
   * @param platingThickness - copper plating thickness in mm
   */
  static calculateViaResistance(height: number, drillDiameter: number, platingThickness: number): number {
    if (height <= 0 || drillDiameter <= 0 || platingThickness <= 0) {
      return 0;
    }
    const h = height * 1e-3; // m
    const rOuter = (drillDiameter / 2) * 1e-3; // m
    const rInner = rOuter - platingThickness * 1e-3; // m
    if (rInner <= 0) {
      // Solid via (fully filled)
      const area = Math.PI * rOuter * rOuter;
      return (RHO_CU * h / area) * 1e3; // ohm to milliohm
    }
    const area = Math.PI * (rOuter * rOuter - rInner * rInner);
    return (RHO_CU * h / area) * 1e3; // milliohms
  }

  /**
   * Calculate plane capacitance in farads.
   * @param area - overlap area in mm^2
   * @param thickness - dielectric thickness in mm
   * @param dielectricConstant - relative permittivity
   */
  static calculatePlaneCapacitance(area: number, thickness: number, dielectricConstant: number): number {
    if (area <= 0 || thickness <= 0 || dielectricConstant <= 0) {
      return 0;
    }
    const areaM2 = area * 1e-6; // mm^2 to m^2
    const thicknessM = thickness * 1e-3; // mm to m
    return EPSILON_0 * dielectricConstant * areaM2 / thicknessM;
  }

  /**
   * Calculate target impedance in ohms.
   * @param voltage - nominal supply voltage (V)
   * @param ripplePercent - maximum allowed ripple as percentage (e.g., 5 for 5%)
   * @param transientCurrent - transient load current (A)
   */
  static calculateTargetImpedance(voltage: number, ripplePercent: number, transientCurrent: number): number {
    if (transientCurrent <= 0 || ripplePercent <= 0 || voltage <= 0) {
      return 0;
    }
    return (voltage * ripplePercent / 100) / transientCurrent;
  }

  /**
   * Look up ESR and ESL for a standard decoupling cap.
   * @param value - capacitance in farads
   * @param packageSize - package (e.g. '0402', '0603', '0805', 'electrolytic')
   */
  static lookupDecapParams(value: number, packageSize: string): { esr: number; esl: number } | null {
    // Build key from value + package
    // Iterate largest unit first so 1uF matches 'uF' not '1000nF'
    const valuePrefixes: Array<{ threshold: number; suffix: string }> = [
      { threshold: 1e-6, suffix: 'uF' },
      { threshold: 1e-9, suffix: 'nF' },
      { threshold: 1e-12, suffix: 'pF' },
    ];

    let label = '';
    for (const { threshold, suffix } of valuePrefixes) {
      const scaled = value / threshold;
      if (scaled >= 0.999 && scaled < 1000.5) {
        label = `${Math.round(scaled)}${suffix}`;
        break;
      }
    }

    if (!label) {
      return null;
    }

    const key = `${label}_${packageSize}`;
    const entry = STANDARD_DECAP_DB[key];
    if (!entry) {
      return null;
    }
    return { esr: entry.esr, esl: entry.esl };
  }

  // -----------------------------------------------------------------------
  // Core analysis
  // -----------------------------------------------------------------------

  /**
   * Run the full PDN analysis.
   */
  analyze(
    freqStart: number = DEFAULT_FREQ_START,
    freqEnd: number = DEFAULT_FREQ_END,
    pointsPerDecade: number = DEFAULT_POINTS_PER_DECADE,
  ): PDNResult {
    const targetZ = this.getTargetImpedance();
    const frequencies = this.generateFrequencies(freqStart, freqEnd, pointsPerDecade);
    const impedanceProfile = this.computeImpedanceProfile(frequencies);
    const resonances = this.detectResonances(impedanceProfile, targetZ);
    const decapAnalysis = this.analyzeDecaps(impedanceProfile, targetZ);
    const irDrop = this.computeIRDrop();
    const currentDistribution = this.computeCurrentDistribution();
    const summary = this.buildSummary(impedanceProfile, targetZ, resonances, decapAnalysis, irDrop);

    return {
      impedanceProfile,
      irDrop,
      resonances,
      decapAnalysis,
      currentDistribution,
      summary,
    };
  }

  /**
   * Suggest decoupling caps to fill impedance gaps.
   */
  suggestDecouplingCaps(targetZ: number): DecouplingCap[] {
    const frequencies = this.generateFrequencies(DEFAULT_FREQ_START, DEFAULT_FREQ_END, DEFAULT_POINTS_PER_DECADE);
    const profile = this.computeImpedanceProfile(frequencies);

    // Find frequency ranges where Z > targetZ
    const gaps: Array<{ lowFreq: number; highFreq: number }> = [];
    let gapStart: number | null = null;

    for (const pt of profile) {
      if (pt.impedance > targetZ) {
        if (gapStart === null) {
          gapStart = pt.frequency;
        }
      } else {
        if (gapStart !== null) {
          gaps.push({ lowFreq: gapStart, highFreq: pt.frequency });
          gapStart = null;
        }
      }
    }
    if (gapStart !== null) {
      gaps.push({ lowFreq: gapStart, highFreq: frequencies[frequencies.length - 1] });
    }

    const suggestions: DecouplingCap[] = [];

    for (const gap of gaps) {
      // Target self-resonant frequency at geometric center of gap
      const centerFreq = Math.sqrt(gap.lowFreq * gap.highFreq);

      // Find the standard cap value whose SRF is closest to centerFreq
      // SRF = 1 / (2*pi*sqrt(ESL*C))
      let bestCap: DecouplingCap | null = null;
      let bestDelta = Infinity;

      for (const capValue of STANDARD_CAP_VALUES) {
        // Try typical ESL values
        const eslValues = [0.5e-9, 1.0e-9];
        for (const esl of eslValues) {
          const srf = 1 / (2 * Math.PI * Math.sqrt(esl * capValue));
          const delta = Math.abs(Math.log10(srf) - Math.log10(centerFreq));
          if (delta < bestDelta) {
            bestDelta = delta;
            bestCap = {
              id: `suggested_${capValue}_${esl}`,
              value: capValue,
              esr: 0.01,
              esl,
              position: { x: 0, y: 0 },
              mountingInductance: 0.5,
              tolerance: 0.1,
            };
          }
        }
      }

      if (bestCap) {
        // Avoid duplicate suggestions
        const isDuplicate = suggestions.some((s) => s.value === bestCap!.value && s.esl === bestCap!.esl);
        if (!isDuplicate) {
          suggestions.push(bestCap);
        }
      }
    }

    return suggestions;
  }

  // -----------------------------------------------------------------------
  // Internal: impedance computation
  // -----------------------------------------------------------------------

  private getTargetImpedance(): number {
    if (this.targetImpedanceOverride !== null) {
      return this.targetImpedanceOverride;
    }
    // Z_target = ripple_voltage / max_transient_current
    // rippleTarget is in mV
    const rippleMV = this.powerNet.rippleTarget;
    const current = this.powerNet.maxCurrent;
    if (current <= 0) {
      return 1; // fallback
    }
    return (rippleMV / 1000) / current;
  }

  private generateFrequencies(start: number, end: number, pointsPerDecade: number): number[] {
    const frequencies: number[] = [];
    const logStart = Math.log10(start);
    const logEnd = Math.log10(end);
    const totalDecades = logEnd - logStart;
    const totalPoints = Math.round(totalDecades * pointsPerDecade);

    for (let i = 0; i <= totalPoints; i++) {
      const logF = logStart + (i / totalPoints) * (logEnd - logStart);
      frequencies.push(Math.pow(10, logF));
    }
    return frequencies;
  }

  private computeImpedanceProfile(frequencies: number[]): ImpedancePoint[] {
    const planeCapacitance = this.computePlaneCapacitance();
    const profile: ImpedancePoint[] = [];

    for (const f of frequencies) {
      const omega = 2 * Math.PI * f;
      // Start with infinite impedance (no path)
      let totalAdmittance: Complex = { re: 0, im: 0 };

      // VRM contributions (each in parallel)
      for (const vrm of this.vrms) {
        const zVrm = this.vrmImpedance(vrm, f);
        const yVrm = cReciprocal(zVrm);
        totalAdmittance = cAdd(totalAdmittance, yVrm);
      }

      // Decoupling cap contributions (each in parallel)
      for (const cap of this.caps) {
        const zCap = this.capImpedance(cap, omega);
        const yCap = cReciprocal(zCap);
        totalAdmittance = cAdd(totalAdmittance, yCap);
      }

      // Plane capacitance (in parallel)
      if (planeCapacitance > 0) {
        // Model plane as pure capacitor (low-loss assumption)
        const zPlane: Complex = { re: 0, im: -1 / (omega * planeCapacitance) };
        const yPlane = cReciprocal(zPlane);
        totalAdmittance = cAdd(totalAdmittance, yPlane);
      }

      // Via inductance contribution (series in the power path, but for PDN Z
      // we model the aggregate via farm as adding inductance in parallel paths)
      if (this.vias.length > 0) {
        // Parallel combination of all via impedances
        let viaAdmittance: Complex = { re: 0, im: 0 };
        for (const via of this.vias) {
          const zVia: Complex = {
            re: via.resistance * 1e-3, // milliohm to ohm
            im: omega * via.inductance * 1e-9, // nH to H
          };
          const yVia = cReciprocal(zVia);
          viaAdmittance = cAdd(viaAdmittance, yVia);
        }
        // The via farm acts as a series element in the PDN path,
        // so its impedance adds to the total PDN impedance.
        // We handle this by reducing the overall admittance.
        // Z_total = Z_caps_parallel + Z_vias_parallel
        // For simplicity, we add via impedance as a series element
        // after computing the parallel cap network.
        // We'll handle this below after the parallel computation.
      }

      // Compute total impedance from admittance
      let totalZ: Complex;
      if (cMag(totalAdmittance) < 1e-30) {
        // No components — open circuit
        totalZ = { re: 1e6, im: 0 };
      } else {
        totalZ = cReciprocal(totalAdmittance);
      }

      // Add series via impedance (aggregate parallel via impedance in series with cap network)
      if (this.vias.length > 0) {
        let viaAdmittance: Complex = { re: 0, im: 0 };
        for (const via of this.vias) {
          const zVia: Complex = {
            re: via.resistance * 1e-3,
            im: omega * via.inductance * 1e-9,
          };
          viaAdmittance = cAdd(viaAdmittance, cReciprocal(zVia));
        }
        if (cMag(viaAdmittance) > 1e-30) {
          const zViaParallel = cReciprocal(viaAdmittance);
          totalZ = cAdd(totalZ, zViaParallel);
        }
      }

      profile.push({
        frequency: f,
        impedance: cMag(totalZ),
        phase: cPhase(totalZ),
      });
    }

    return profile;
  }

  private capImpedance(cap: DecouplingCap, omega: number): Complex {
    // Z_cap = ESR + j*(omega*ESL_total - 1/(omega*C))
    const totalEsl = cap.esl + cap.mountingInductance * 1e-9; // nH to H
    const capacitiveReactance = omega > 0 ? 1 / (omega * cap.value) : 1e12;
    const inductiveReactance = omega * totalEsl;
    return {
      re: cap.esr,
      im: inductiveReactance - capacitiveReactance,
    };
  }

  private vrmImpedance(vrm: VRM, f: number): Complex {
    // Z_vrm = R_out * sqrt(1 + (f/f_bw)^2)  with phase
    // More precisely: Z_vrm = R_out * (1 + j*f/f_bw)
    const rOut = vrm.outputImpedance * 1e-3; // milliohm to ohm
    return {
      re: rOut,
      im: rOut * (f / vrm.bandwidth),
    };
  }

  private computePlaneCapacitance(): number {
    if (this.planeArea <= 0) {
      return 0;
    }

    // Find adjacent power/ground plane pairs and sum their capacitance
    const sorted = [...this.stackupLayers].sort((a, b) => a.order - b.order);
    let totalCap = 0;

    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      const isPowerGroundPair =
        (a.type === 'power' && b.type === 'ground') ||
        (a.type === 'ground' && b.type === 'power');

      if (isPowerGroundPair) {
        // Dielectric thickness between these layers: estimate from layer thickness
        // In a real stackup, the dielectric is between layers; use average of thicknesses
        // as a rough proxy (the stackup stores thickness in mils).
        const thicknessMils = (a.thickness + b.thickness) / 2;
        const thicknessMm = thicknessMils * 0.0254; // mils to mm
        const er = (a.dielectricConstant + b.dielectricConstant) / 2;
        totalCap += PDNAnalyzer.calculatePlaneCapacitance(this.planeArea, thicknessMm, er);
      }
    }

    return totalCap;
  }

  // -----------------------------------------------------------------------
  // Internal: resonance detection
  // -----------------------------------------------------------------------

  private detectResonances(profile: ImpedancePoint[], targetZ: number): Resonance[] {
    const resonances: Resonance[] = [];
    if (profile.length < 3) {
      return resonances;
    }

    for (let i = 1; i < profile.length - 1; i++) {
      const prev = profile[i - 1];
      const curr = profile[i];
      const next = profile[i + 1];

      // Local maximum (parallel resonance — anti-resonance peak)
      if (curr.impedance > prev.impedance && curr.impedance > next.impedance) {
        // Determine involved caps: caps whose SRF brackets this frequency
        const involved = this.findInvolvedCaps(curr.frequency);
        resonances.push({
          frequency: curr.frequency,
          impedance: curr.impedance,
          type: 'parallel',
          involvedComponents: involved,
        });
      }

      // Local minimum (series resonance — cap self-resonance)
      if (curr.impedance < prev.impedance && curr.impedance < next.impedance) {
        const involved = this.findInvolvedCaps(curr.frequency);
        resonances.push({
          frequency: curr.frequency,
          impedance: curr.impedance,
          type: 'series',
          involvedComponents: involved,
        });
      }
    }

    return resonances;
  }

  private findInvolvedCaps(frequency: number): string[] {
    const involved: string[] = [];
    for (const cap of this.caps) {
      const totalEsl = cap.esl + cap.mountingInductance * 1e-9;
      if (totalEsl <= 0 || cap.value <= 0) {
        continue;
      }
      const srf = 1 / (2 * Math.PI * Math.sqrt(totalEsl * cap.value));
      // Consider involved if frequency is within 1 decade of SRF
      const ratio = frequency / srf;
      if (ratio >= 0.1 && ratio <= 10) {
        involved.push(cap.id);
      }
    }
    return involved;
  }

  // -----------------------------------------------------------------------
  // Internal: decap analysis
  // -----------------------------------------------------------------------

  private analyzeDecaps(profile: ImpedancePoint[], targetZ: number): DecapAnalysis {
    const recommendations: string[] = [];

    // Find frequency range where Z <= targetZ
    let lowFreqMet = Infinity;
    let highFreqMet = 0;
    for (const pt of profile) {
      if (pt.impedance <= targetZ) {
        if (pt.frequency < lowFreqMet) {
          lowFreqMet = pt.frequency;
        }
        if (pt.frequency > highFreqMet) {
          highFreqMet = pt.frequency;
        }
      }
    }

    const effectiveBandwidth = highFreqMet > lowFreqMet ? highFreqMet - lowFreqMet : 0;

    // Find gaps where Z > targetZ
    const gaps: Array<{ lowFreq: number; highFreq: number; peakZ: number }> = [];
    let gapStart: number | null = null;
    let gapPeakZ = 0;

    for (const pt of profile) {
      if (pt.impedance > targetZ) {
        if (gapStart === null) {
          gapStart = pt.frequency;
          gapPeakZ = pt.impedance;
        } else if (pt.impedance > gapPeakZ) {
          gapPeakZ = pt.impedance;
        }
      } else {
        if (gapStart !== null) {
          gaps.push({ lowFreq: gapStart, highFreq: pt.frequency, peakZ: gapPeakZ });
          gapStart = null;
          gapPeakZ = 0;
        }
      }
    }
    if (gapStart !== null) {
      gaps.push({
        lowFreq: gapStart,
        highFreq: profile[profile.length - 1].frequency,
        peakZ: gapPeakZ,
      });
    }

    // Generate recommendations
    if (this.caps.length === 0) {
      recommendations.push('No decoupling capacitors present. Add bypass caps near load ICs.');
    }

    for (const gap of gaps) {
      const centerFreq = Math.sqrt(gap.lowFreq * gap.highFreq);
      if (centerFreq < 1e6) {
        recommendations.push(
          `Add more bulk capacitance (10-100 uF) to cover ${this.formatFreq(gap.lowFreq)} - ${this.formatFreq(gap.highFreq)} gap.`,
        );
      } else if (centerFreq < 100e6) {
        recommendations.push(
          `Add intermediate decoupling caps (100 nF - 1 uF) near load for ${this.formatFreq(gap.lowFreq)} - ${this.formatFreq(gap.highFreq)} gap.`,
        );
      } else {
        recommendations.push(
          `Add small high-frequency caps (100 pF - 10 nF, 0402 package) very close to load for ${this.formatFreq(gap.lowFreq)} - ${this.formatFreq(gap.highFreq)} gap.`,
        );
      }
    }

    if (gaps.length === 0 && this.caps.length > 0) {
      recommendations.push('Decoupling strategy meets target impedance across the frequency range.');
    }

    return { effectiveBandwidth, gaps, recommendations };
  }

  // -----------------------------------------------------------------------
  // Internal: IR drop
  // -----------------------------------------------------------------------

  private computeIRDrop(): IRDropResult {
    if (this.vrms.length === 0) {
      return {
        maxDrop: 0,
        dropMap: [],
        worstPath: 'No VRM defined',
        meetsTarget: false,
      };
    }

    // Simple IR drop model: compute sheet resistance of copper planes
    // and estimate voltage drop from VRM to each load point.
    // For simplicity, assume uniform current distribution across the plane.

    // Find copper thickness from power layers
    const powerLayers = this.stackupLayers.filter((l) => l.type === 'power' || l.type === 'ground');
    if (powerLayers.length === 0) {
      return {
        maxDrop: 0,
        dropMap: [],
        worstPath: 'No power/ground planes in stackup',
        meetsTarget: false,
      };
    }

    // Use first power layer thickness (in mils) -> convert to m
    const copperThicknessMils = powerLayers[0].thickness;
    const copperThicknessM = copperThicknessMils * 0.0254 * 1e-3; // mils -> mm -> m
    const sheetResistance = RHO_CU / copperThicknessM; // ohms/square

    // For each VRM, compute drop to each cap position (simplified 2D model)
    const vrm = this.vrms[0]; // primary VRM
    const totalCurrent = this.powerNet.maxCurrent;
    const dropMap: Array<{ x: number; y: number; drop: number }> = [];
    let maxDrop = 0;
    let worstPath = '';

    // Create a grid of sample points if we have plane area
    const gridSize = this.planeArea > 0 ? Math.sqrt(this.planeArea) : 50; // mm

    // Sample at cap positions and via positions
    const samplePoints: Array<{ x: number; y: number; label: string }> = [];

    for (const cap of this.caps) {
      samplePoints.push({ x: cap.position.x, y: cap.position.y, label: `cap:${cap.id}` });
    }

    for (let i = 0; i < this.vias.length; i++) {
      samplePoints.push({ x: this.vias[i].position.x, y: this.vias[i].position.y, label: `via:${i}` });
    }

    // If no sample points, create a grid
    if (samplePoints.length === 0) {
      const step = gridSize / 5;
      for (let x = 0; x <= gridSize; x += step) {
        for (let y = 0; y <= gridSize; y += step) {
          samplePoints.push({ x, y, label: `grid:${x},${y}` });
        }
      }
    }

    for (const pt of samplePoints) {
      // Distance from VRM to point in mm
      const dx = pt.x - vrm.position.x;
      const dy = pt.y - vrm.position.y;
      const distMm = Math.sqrt(dx * dx + dy * dy);
      const distM = distMm * 1e-3;

      // Simple model: V_drop = I * R_sheet * (distance / width)
      // Assume effective current path width ~ sqrt(planeArea) or 10mm minimum
      const pathWidth = Math.max(gridSize, 10) * 1e-3; // m

      // Number of squares in path
      const numSquares = distM / pathWidth;
      const pathResistance = sheetResistance * numSquares;

      // Add via resistance if vias exist
      let totalResistance = pathResistance;
      if (this.vias.length > 0) {
        // Average via resistance in series
        const avgViaR = this.vias.reduce((sum, v) => sum + v.resistance, 0) / this.vias.length;
        totalResistance += avgViaR * 1e-3; // milliohm to ohm
      }

      const drop = totalCurrent * totalResistance * 1000; // convert to mV
      dropMap.push({ x: pt.x, y: pt.y, drop });

      if (drop > maxDrop) {
        maxDrop = drop;
        worstPath = `${vrm.name} to ${pt.label} (${distMm.toFixed(1)} mm, ${drop.toFixed(2)} mV)`;
      }
    }

    // Target: ripple target in mV, IR drop should be fraction of that
    const meetsTarget = maxDrop <= this.powerNet.rippleTarget * 0.5;

    return { maxDrop, dropMap, worstPath, meetsTarget };
  }

  // -----------------------------------------------------------------------
  // Internal: current distribution
  // -----------------------------------------------------------------------

  private computeCurrentDistribution(): CurrentDistribution[] {
    if (this.vias.length === 0) {
      return [];
    }

    const totalCurrent = this.powerNet.maxCurrent;

    // Distribute current inversely proportional to via resistance
    const conductances = this.vias.map((v) => {
      const r = v.resistance > 0 ? v.resistance * 1e-3 : 1e-6; // milliohm to ohm
      return 1 / r;
    });
    const totalConductance = conductances.reduce((a, b) => a + b, 0);

    return this.vias.map((via, i) => {
      const fraction = totalConductance > 0 ? conductances[i] / totalConductance : 1 / this.vias.length;
      const current = totalCurrent * fraction;
      // Utilization: compare to a "max safe current" estimate
      // Rule of thumb: ~1A per 0.3mm drill via
      const maxSafeCurrent = (via.diameter / 0.3) * 1;
      const utilization = maxSafeCurrent > 0 ? (current / maxSafeCurrent) * 100 : 100;

      return {
        viaId: `via_${i}`,
        current,
        utilizationPercent: Math.min(utilization, 100),
      };
    });
  }

  // -----------------------------------------------------------------------
  // Internal: summary
  // -----------------------------------------------------------------------

  private buildSummary(
    profile: ImpedancePoint[],
    targetZ: number,
    resonances: Resonance[],
    decapAnalysis: DecapAnalysis,
    irDrop: IRDropResult,
  ): PDNSummary {
    const recommendations: string[] = [];

    // Find worst margin point
    let lowestMarginDb = Infinity;
    let criticalFrequency = 0;

    for (const pt of profile) {
      // Margin in dB: positive = meeting target, negative = failing
      const marginDb = 20 * Math.log10(targetZ / pt.impedance);
      if (marginDb < lowestMarginDb) {
        lowestMarginDb = marginDb;
        criticalFrequency = pt.frequency;
      }
    }

    const meetsTarget = lowestMarginDb >= 0;

    // Risk assessment
    let overallRisk: 'low' | 'moderate' | 'high' | 'critical';
    if (lowestMarginDb >= 6) {
      overallRisk = 'low'; // 6dB+ margin
    } else if (lowestMarginDb >= 3) {
      overallRisk = 'moderate'; // 3-6dB margin
    } else if (lowestMarginDb >= 0) {
      overallRisk = 'high'; // barely meeting target
    } else {
      overallRisk = 'critical'; // failing
    }

    // Recommendations
    if (!meetsTarget) {
      recommendations.push(
        `Target impedance exceeded at ${this.formatFreq(criticalFrequency)} — margin is ${lowestMarginDb.toFixed(1)} dB.`,
      );
    }

    // Check for dangerous resonances (anti-resonance peaks above target)
    const dangerousResonances = resonances.filter((r) => r.type === 'parallel' && r.impedance > targetZ);
    if (dangerousResonances.length > 0) {
      recommendations.push(
        `${dangerousResonances.length} anti-resonance peak(s) exceed target impedance. Consider adding damping or intermediate-value caps.`,
      );
    }

    if (!irDrop.meetsTarget) {
      recommendations.push(
        `IR drop (${irDrop.maxDrop.toFixed(2)} mV) exceeds 50% of ripple budget. Consider wider traces, more vias, or heavier copper.`,
      );
    }

    if (this.caps.length === 0) {
      recommendations.push('Add decoupling capacitors to establish a low-impedance power distribution network.');
    }

    if (this.vrms.length === 0) {
      recommendations.push('No VRM defined. Add a voltage regulator to establish the power source model.');
    }

    // Add decap recommendations
    for (const rec of decapAnalysis.recommendations) {
      if (!recommendations.includes(rec)) {
        recommendations.push(rec);
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('PDN design meets all targets with adequate margin.');
    }

    return {
      meetsTarget,
      lowestMargin: lowestMarginDb,
      criticalFrequency,
      overallRisk,
      recommendations,
    };
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private formatFreq(hz: number): string {
    if (hz >= 1e9) {
      return `${(hz / 1e9).toFixed(1)} GHz`;
    }
    if (hz >= 1e6) {
      return `${(hz / 1e6).toFixed(1)} MHz`;
    }
    if (hz >= 1e3) {
      return `${(hz / 1e3).toFixed(1)} kHz`;
    }
    return `${hz.toFixed(0)} Hz`;
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export interface PDNAnalysisConfig {
  powerNet: PowerNet;
  vrms: VRM[];
  caps: DecouplingCap[];
  vias: PowerVia[];
  planeArea: number;
  stackup: StackupLayer[];
}

export function usePDNAnalysis(): {
  analyze: (config: PDNAnalysisConfig) => PDNResult;
  result: PDNResult | null;
  isAnalyzing: boolean;
} {
  const [result, setResult] = useState<PDNResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyze = useCallback((config: PDNAnalysisConfig): PDNResult => {
    setIsAnalyzing(true);
    try {
      const analyzer = new PDNAnalyzer(config.powerNet, config.stackup);
      for (const vrm of config.vrms) {
        analyzer.addVRM(vrm);
      }
      for (const cap of config.caps) {
        analyzer.addDecouplingCap(cap);
      }
      for (const via of config.vias) {
        analyzer.addPowerVia(via);
      }
      analyzer.setPlaneArea(config.planeArea);

      const analysisResult = analyzer.analyze();
      setResult(analysisResult);
      return analysisResult;
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  return { analyze, result, isAnalyzing };
}
