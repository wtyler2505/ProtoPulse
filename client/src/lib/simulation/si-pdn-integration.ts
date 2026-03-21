/**
 * SI-PDN Integration Engine — Cross-domain Signal + Power Integrity Analysis
 *
 * Runs both PDN impedance analysis and SI report generation, then correlates
 * results to find cross-domain issues:
 *   - PDN noise coupling into signal traces (shared return planes)
 *   - Via inductance affecting both SI and PDN
 *   - Simultaneous switching noise (SSN) estimation
 *   - Decoupling adequacy vs signal edge rates
 *   - Unified recommendations combining both domains
 *
 * The engine does NOT duplicate PDN/SI logic — it delegates to the existing
 * PDNAnalyzer and si-advisor modules, then adds a correlation + scoring layer.
 *
 * Usage:
 *   const engine = new SiPdnIntegrationEngine();
 *   engine.setPdnConfig(powerNet, stackup, vrms, caps);
 *   engine.setSiTraces(traces);
 *   const result = engine.analyze();
 *
 * References:
 *   - Eric Bogatin, "Signal and Power Integrity — Simplified"
 *   - Smith, "Decoupling Capacitor Calculations for CMOS Circuits"
 *   - Xilinx XAPP623: "Power Distribution System (PDS) Design"
 */

import type { StackupLayer } from '@/lib/board-stackup';

import type {
  TraceInfo,
  SIReport,
  TerminationAdvice,
  ImpedanceCheckResult,
} from './si-advisor';
import {
  generateReport as generateSiReport,
} from './si-advisor';

import type {
  PowerNet,
  DecouplingCap,
  VRM,
  PDNResult,
  ImpedancePoint,
  Resonance,
} from './pdn-analysis';
import { PDNAnalyzer } from './pdn-analysis';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IssueSeverity = 'info' | 'warning' | 'critical';
export type IssueDomain = 'si' | 'pdn' | 'cross-domain';

export interface CrossDomainIssue {
  id: string;
  severity: IssueSeverity;
  domain: IssueDomain;
  title: string;
  description: string;
  affectedNets: string[];
  recommendation: string;
}

export interface SsnEstimate {
  /** Number of simultaneously switching outputs. */
  numSwitching: number;
  /** Estimated di/dt in A/ns. */
  diDt: number;
  /** Estimated SSN voltage bounce in mV. */
  bounceMv: number;
  /** Whether bounce exceeds noise margin. */
  exceededMargin: boolean;
  /** Noise margin used (mV). */
  noiseMarginMv: number;
}

export interface ReturnPlaneIssue {
  traceName: string;
  sharedPlaneLayer: string;
  powerNetName: string;
  riskLevel: 'low' | 'moderate' | 'high';
  explanation: string;
}

export interface DecouplingAdequacy {
  /** Highest signal frequency (Hz) based on edge rates. */
  maxSignalFreq: number;
  /** Frequency at which PDN impedance first exceeds target. */
  pdnCoverageFreq: number;
  /** Whether decoupling covers all signal frequencies. */
  adequate: boolean;
  /** Gap in frequency decades if inadequate. */
  gapDecades: number;
}

export interface CorrelatedResult {
  siReport: SIReport;
  pdnResult: PDNResult;
  crossDomainIssues: CrossDomainIssue[];
  ssnEstimate: SsnEstimate | null;
  returnPlaneIssues: ReturnPlaneIssue[];
  decouplingAdequacy: DecouplingAdequacy;
  unifiedScore: number; // 0-100
  unifiedRecommendations: string[];
}

export interface SiPdnConfig {
  powerNet: PowerNet;
  stackupLayers: StackupLayer[];
  vrms: VRM[];
  caps: DecouplingCap[];
  traces: TraceInfo[];
  /** Number of simultaneously switching outputs (for SSN). */
  numSwitchingOutputs?: number;
  /** Per-output switching current in amps. */
  switchingCurrentPerOutput?: number;
  /** Edge rate in ns (rise/fall time). */
  edgeRateNs?: number;
  /** Noise margin in mV (default 400 for 3.3V CMOS). */
  noiseMarginMv?: number;
  /** Plane area in mm^2. */
  planeAreaMm2?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default edge rate for CMOS logic (ns). */
const DEFAULT_EDGE_RATE_NS = 1.0;

/** Default per-output switching current (A). */
const DEFAULT_SWITCHING_CURRENT = 0.05;

/** Default noise margin for 3.3V CMOS (mV). */
const DEFAULT_NOISE_MARGIN_MV = 400;

/** Weight factors for unified scoring. */
const SCORE_WEIGHT_SI = 0.35;
const SCORE_WEIGHT_PDN = 0.35;
const SCORE_WEIGHT_CROSS = 0.30;

// ---------------------------------------------------------------------------
// SiPdnIntegrationEngine
// ---------------------------------------------------------------------------

export class SiPdnIntegrationEngine {
  private config: SiPdnConfig | null = null;

  /**
   * Configure the engine with all inputs.
   */
  setConfig(config: SiPdnConfig): void {
    this.config = config;
  }

  /**
   * Run the full correlated analysis.
   * Delegates to PDNAnalyzer + si-advisor, then cross-correlates.
   */
  analyze(): CorrelatedResult {
    if (!this.config) {
      throw new Error('SiPdnIntegrationEngine: config not set. Call setConfig() first.');
    }

    const { powerNet, stackupLayers, vrms, caps, traces } = this.config;

    // --- 1. Run PDN analysis ---
    const pdnAnalyzer = new PDNAnalyzer(powerNet, stackupLayers);
    for (const vrm of vrms) {
      pdnAnalyzer.addVRM(vrm);
    }
    for (const cap of caps) {
      pdnAnalyzer.addDecouplingCap(cap);
    }
    if (this.config.planeAreaMm2) {
      pdnAnalyzer.setPlaneArea(this.config.planeAreaMm2);
    }
    const pdnResult = pdnAnalyzer.analyze();

    // --- 2. Run SI analysis ---
    const siReport = generateSiReport(traces);

    // --- 3. Cross-domain correlation ---
    const crossDomainIssues = this.findCrossDomainIssues(siReport, pdnResult);

    // --- 4. SSN estimation ---
    const ssnEstimate = this.estimateSSN(pdnResult);

    // --- 5. Return plane analysis ---
    const returnPlaneIssues = this.analyzeReturnPlanes(traces);

    // --- 6. Decoupling adequacy ---
    const decouplingAdequacy = this.checkDecouplingAdequacy(pdnResult);

    // --- 7. Add cross-domain issues from SSN, return planes, decoupling ---
    if (ssnEstimate && ssnEstimate.exceededMargin) {
      crossDomainIssues.push({
        id: 'ssn-exceeded',
        severity: 'critical',
        domain: 'cross-domain',
        title: 'Simultaneous Switching Noise exceeds noise margin',
        description: `Estimated SSN bounce of ${ssnEstimate.bounceMv.toFixed(1)} mV exceeds ${ssnEstimate.noiseMarginMv} mV noise margin with ${ssnEstimate.numSwitching} simultaneous outputs.`,
        affectedNets: [this.config.powerNet.name],
        recommendation: 'Add decoupling capacitors near switching ICs, reduce simultaneous switching count, or use staggered output enables.',
      });
    }

    for (const rp of returnPlaneIssues) {
      if (rp.riskLevel === 'high') {
        crossDomainIssues.push({
          id: `return-plane-${rp.traceName}`,
          severity: 'warning',
          domain: 'cross-domain',
          title: `Shared return plane coupling: ${rp.traceName}`,
          description: rp.explanation,
          affectedNets: [rp.traceName, rp.powerNetName],
          recommendation: 'Use separate ground planes for sensitive signals, or add stitching vias to reduce return path inductance.',
        });
      }
    }

    if (!decouplingAdequacy.adequate) {
      crossDomainIssues.push({
        id: 'decoupling-gap',
        severity: 'warning',
        domain: 'cross-domain',
        title: 'Decoupling coverage gap',
        description: `PDN impedance coverage extends to ${formatFrequency(decouplingAdequacy.pdnCoverageFreq)} but signals require coverage up to ${formatFrequency(decouplingAdequacy.maxSignalFreq)} (gap: ${decouplingAdequacy.gapDecades.toFixed(1)} decades).`,
        affectedNets: [this.config.powerNet.name],
        recommendation: 'Add high-frequency decoupling capacitors (100pF-1nF in 0402 packages) placed close to the ICs.',
      });
    }

    // --- 8. Unified score ---
    const unifiedScore = this.computeUnifiedScore(siReport, pdnResult, crossDomainIssues);

    // --- 9. Unified recommendations ---
    const unifiedRecommendations = this.buildUnifiedRecommendations(
      siReport,
      pdnResult,
      crossDomainIssues,
      ssnEstimate,
      decouplingAdequacy,
    );

    return {
      siReport,
      pdnResult,
      crossDomainIssues,
      ssnEstimate,
      returnPlaneIssues,
      decouplingAdequacy,
      unifiedScore,
      unifiedRecommendations,
    };
  }

  // -----------------------------------------------------------------------
  // Cross-domain issue detection
  // -----------------------------------------------------------------------

  private findCrossDomainIssues(siReport: SIReport, pdnResult: PDNResult): CrossDomainIssue[] {
    const issues: CrossDomainIssue[] = [];

    // Issue 1: PDN resonances near signal frequencies
    if (this.config) {
      const edgeRateNs = this.config.edgeRateNs ?? DEFAULT_EDGE_RATE_NS;
      const kneeFreq = 0.35 / (edgeRateNs * 1e-9); // Hz

      for (const resonance of pdnResult.resonances) {
        if (resonance.type === 'parallel') {
          // Parallel resonance = high impedance peak in PDN
          const ratio = resonance.frequency / kneeFreq;
          if (ratio > 0.1 && ratio < 10) {
            issues.push({
              id: `pdn-resonance-${resonance.frequency.toFixed(0)}`,
              severity: resonance.impedance > 0.1 ? 'critical' : 'warning',
              domain: 'cross-domain',
              title: `PDN resonance near signal bandwidth`,
              description: `PDN parallel resonance at ${formatFrequency(resonance.frequency)} (Z=${resonance.impedance.toFixed(3)} ohm) is within the signal bandwidth knee frequency ${formatFrequency(kneeFreq)}.`,
              affectedNets: resonance.involvedComponents,
              recommendation: 'Add damping resistor in series with the offending decoupling capacitor, or add a capacitor at the resonance frequency.',
            });
          }
        }
      }
    }

    // Issue 2: SI impedance mismatches combined with poor PDN
    if (!pdnResult.summary.meetsTarget) {
      const failingTraces = siReport.impedance
        .map((check, i) => ({ check, trace: this.config?.traces[i] }))
        .filter((entry): entry is { check: ImpedanceCheckResult; trace: TraceInfo } =>
          !entry.check.pass && entry.trace !== undefined);

      if (failingTraces.length > 0) {
        issues.push({
          id: 'combined-si-pdn-fail',
          severity: 'critical',
          domain: 'cross-domain',
          title: 'Combined SI + PDN failure',
          description: `${failingTraces.length} trace(s) have impedance mismatches while PDN also fails target. Signal quality will compound — impedance mismatches cause reflections, and PDN noise adds to the reflected waveform.`,
          affectedNets: failingTraces.map((e) => e.trace.name),
          recommendation: 'Fix PDN first (decoupling), then address SI impedance matching. Combined issues are worse than the sum of individual problems.',
        });
      }
    }

    // Issue 3: High reflection coefficients with high PDN impedance
    const highReflTerminations = siReport.termination.filter(
      (t: TerminationAdvice) => t.reflectionCoeff > 0.4,
    );
    if (highReflTerminations.length > 0 && pdnResult.summary.overallRisk !== 'low') {
      issues.push({
        id: 'reflection-pdn-interaction',
        severity: 'warning',
        domain: 'cross-domain',
        title: 'Signal reflections may amplify PDN noise',
        description: `${highReflTerminations.length} signal(s) have reflection coefficients > 0.4. Combined with ${pdnResult.summary.overallRisk}-risk PDN, reflected energy will create additional current transients on the power rail.`,
        affectedNets: this.config?.traces
          .filter((_t, i) => siReport.termination[i]?.reflectionCoeff > 0.4)
          .map((t) => t.name) ?? [],
        recommendation: 'Apply termination resistors to reduce reflections, and ensure adequate decoupling near the receiver.',
      });
    }

    // Issue 4: IR drop affecting signal levels
    if (pdnResult.irDrop.maxDrop > 100) {
      // > 100mV drop is significant for CMOS
      issues.push({
        id: 'ir-drop-signal-impact',
        severity: pdnResult.irDrop.maxDrop > 200 ? 'critical' : 'warning',
        domain: 'cross-domain',
        title: 'IR drop may reduce signal noise margins',
        description: `Max IR drop of ${pdnResult.irDrop.maxDrop.toFixed(1)} mV will reduce effective VCC at ICs, shrinking both output drive strength and input noise margins.`,
        affectedNets: [this.config?.powerNet.name ?? 'VCC'],
        recommendation: 'Widen power traces, add power vias, or place VRM closer to high-current loads.',
      });
    }

    return issues;
  }

  // -----------------------------------------------------------------------
  // SSN estimation
  // -----------------------------------------------------------------------

  estimateSSN(pdnResult: PDNResult): SsnEstimate | null {
    if (!this.config) {
      return null;
    }

    const numSwitching = this.config.numSwitchingOutputs ?? 0;
    if (numSwitching === 0) {
      return null;
    }

    const currentPerOutput = this.config.switchingCurrentPerOutput ?? DEFAULT_SWITCHING_CURRENT;
    const edgeRateNs = this.config.edgeRateNs ?? DEFAULT_EDGE_RATE_NS;
    const noiseMarginMv = this.config.noiseMarginMv ?? DEFAULT_NOISE_MARGIN_MV;

    // di/dt = N * I_per_output / t_rise
    const diDt = (numSwitching * currentPerOutput) / edgeRateNs; // A/ns

    // Find PDN impedance at the knee frequency
    const kneeFreq = 0.35 / (edgeRateNs * 1e-9); // Hz
    const pdnZAtKnee = interpolateImpedance(pdnResult.impedanceProfile, kneeFreq);

    // V_bounce = L_eff * di/dt = Z_pdn(f_knee) * di/dt * t_rise (simplified)
    // More directly: V = Z_pdn * I_transient_peak
    // I_transient = N * I_per_output
    const transientCurrent = numSwitching * currentPerOutput;
    const bounceMv = pdnZAtKnee * transientCurrent * 1000; // V to mV

    return {
      numSwitching,
      diDt,
      bounceMv,
      exceededMargin: bounceMv > noiseMarginMv,
      noiseMarginMv,
    };
  }

  // -----------------------------------------------------------------------
  // Return plane analysis
  // -----------------------------------------------------------------------

  private analyzeReturnPlanes(traces: TraceInfo[]): ReturnPlaneIssue[] {
    const issues: ReturnPlaneIssue[] = [];
    const powerNetName = this.config?.powerNet.name ?? 'VCC';

    for (const trace of traces) {
      // High-speed signals that share a reference plane with the power net
      // are susceptible to PDN noise coupling through the shared plane.
      // We flag traces on signal layers adjacent to power planes.
      const isHighSpeed = trace.netClass === 'High-Speed' || trace.targetZ0 <= 50;
      const hasLongCoupledLength = trace.length > 50; // mm

      if (isHighSpeed && hasLongCoupledLength) {
        issues.push({
          traceName: trace.name,
          sharedPlaneLayer: 'adjacent reference plane',
          powerNetName,
          riskLevel: trace.length > 100 ? 'high' : 'moderate',
          explanation: `High-speed trace "${trace.name}" (${trace.length.toFixed(1)} mm, ${trace.netClass}) shares a reference plane with power net "${powerNetName}". PDN noise on the plane will couple into the signal return current.`,
        });
      }
    }

    return issues;
  }

  // -----------------------------------------------------------------------
  // Decoupling adequacy
  // -----------------------------------------------------------------------

  private checkDecouplingAdequacy(pdnResult: PDNResult): DecouplingAdequacy {
    const edgeRateNs = this.config?.edgeRateNs ?? DEFAULT_EDGE_RATE_NS;

    // Maximum signal frequency content based on edge rate
    // f_knee = 0.35 / t_rise (rule of thumb)
    const maxSignalFreq = 0.35 / (edgeRateNs * 1e-9);

    // Find the highest frequency where PDN impedance is still below target
    const targetZ = pdnResult.summary.meetsTarget
      ? this.getTargetImpedance()
      : this.getTargetImpedance();

    let pdnCoverageFreq = 0;
    for (const pt of pdnResult.impedanceProfile) {
      if (pt.impedance <= targetZ) {
        pdnCoverageFreq = pt.frequency;
      } else {
        // First exceedance after coverage — stop
        if (pdnCoverageFreq > 0) {
          break;
        }
      }
    }

    // If no coverage at all, set to 0
    if (pdnCoverageFreq === 0 && pdnResult.impedanceProfile.length > 0) {
      // Check if at least the first point is below target
      if (pdnResult.impedanceProfile[0].impedance <= targetZ) {
        pdnCoverageFreq = pdnResult.impedanceProfile[0].frequency;
      }
    }

    const adequate = pdnCoverageFreq >= maxSignalFreq;
    const gapDecades = adequate
      ? 0
      : pdnCoverageFreq > 0
        ? Math.log10(maxSignalFreq) - Math.log10(pdnCoverageFreq)
        : Math.log10(maxSignalFreq);

    return {
      maxSignalFreq,
      pdnCoverageFreq,
      adequate,
      gapDecades: Math.max(0, gapDecades),
    };
  }

  // -----------------------------------------------------------------------
  // Unified scoring
  // -----------------------------------------------------------------------

  private computeUnifiedScore(
    siReport: SIReport,
    pdnResult: PDNResult,
    issues: CrossDomainIssue[],
  ): number {
    // SI score (0-100)
    const siScore = siReport.overallScore;

    // PDN score: derive from summary risk level
    const pdnRiskScores: Record<string, number> = {
      low: 95,
      moderate: 70,
      high: 40,
      critical: 15,
    };
    const pdnScore = pdnRiskScores[pdnResult.summary.overallRisk] ?? 50;

    // Cross-domain penalty
    let crossScore = 100;
    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          crossScore -= 25;
          break;
        case 'warning':
          crossScore -= 10;
          break;
        case 'info':
          crossScore -= 3;
          break;
      }
    }
    crossScore = Math.max(0, crossScore);

    const weighted =
      siScore * SCORE_WEIGHT_SI +
      pdnScore * SCORE_WEIGHT_PDN +
      crossScore * SCORE_WEIGHT_CROSS;

    return Math.max(0, Math.min(100, Math.round(weighted)));
  }

  // -----------------------------------------------------------------------
  // Unified recommendations
  // -----------------------------------------------------------------------

  private buildUnifiedRecommendations(
    siReport: SIReport,
    pdnResult: PDNResult,
    issues: CrossDomainIssue[],
    ssnEstimate: SsnEstimate | null,
    decoupling: DecouplingAdequacy,
  ): string[] {
    const recs: string[] = [];

    // Priority 1: Critical cross-domain issues
    const criticals = issues.filter((i) => i.severity === 'critical');
    for (const issue of criticals) {
      recs.push(`[CRITICAL] ${issue.title}: ${issue.recommendation}`);
    }

    // Priority 2: PDN issues
    if (!pdnResult.summary.meetsTarget) {
      recs.push(`[PDN] Target impedance not met. Worst margin: ${pdnResult.summary.lowestMargin.toFixed(1)} dB at ${formatFrequency(pdnResult.summary.criticalFrequency)}.`);
      for (const rec of pdnResult.summary.recommendations.slice(0, 3)) {
        recs.push(`[PDN] ${rec}`);
      }
    }

    // Priority 3: SI issues
    if (siReport.overallScore < 80) {
      recs.push(`[SI] Overall score ${siReport.overallScore}/100. ${siReport.recommendations.length} issue(s) found.`);
      for (const rec of siReport.recommendations.slice(0, 3)) {
        recs.push(`[SI] ${rec}`);
      }
    }

    // Priority 4: SSN
    if (ssnEstimate && ssnEstimate.bounceMv > ssnEstimate.noiseMarginMv * 0.5) {
      recs.push(`[SSN] Estimated bounce ${ssnEstimate.bounceMv.toFixed(1)} mV (${((ssnEstimate.bounceMv / ssnEstimate.noiseMarginMv) * 100).toFixed(0)}% of noise margin). Consider reducing simultaneous switching.`);
    }

    // Priority 5: Decoupling
    if (!decoupling.adequate) {
      recs.push(`[DECOUPLING] Coverage gap of ${decoupling.gapDecades.toFixed(1)} decades. Add caps for frequencies above ${formatFrequency(decoupling.pdnCoverageFreq)}.`);
    }

    // Priority 6: Warnings
    const warnings = issues.filter((i) => i.severity === 'warning');
    for (const issue of warnings) {
      recs.push(`[WARNING] ${issue.title}: ${issue.recommendation}`);
    }

    // If everything looks good
    if (recs.length === 0) {
      recs.push('SI and PDN analysis shows no critical issues. Design looks solid.');
    }

    return recs;
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private getTargetImpedance(): number {
    if (!this.config) {
      return 0.05; // 50 milliohm default
    }
    const { powerNet } = this.config;
    if (powerNet.maxCurrent <= 0) {
      return 0.05;
    }
    return (powerNet.rippleTarget / 1000) / powerNet.maxCurrent;
  }
}

// ---------------------------------------------------------------------------
// Utility functions (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Interpolate PDN impedance at a specific frequency from the profile.
 * Uses linear interpolation on log-frequency / log-impedance.
 */
export function interpolateImpedance(profile: ImpedancePoint[], frequency: number): number {
  if (profile.length === 0) {
    return 1; // 1 ohm fallback
  }

  if (frequency <= profile[0].frequency) {
    return profile[0].impedance;
  }

  const lastPt = profile[profile.length - 1];
  if (frequency >= lastPt.frequency) {
    return lastPt.impedance;
  }

  // Binary search for the bracket
  let lo = 0;
  let hi = profile.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (profile[mid].frequency <= frequency) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const a = profile[lo];
  const b = profile[hi];

  // Log-linear interpolation
  const logFa = Math.log10(a.frequency);
  const logFb = Math.log10(b.frequency);
  const logF = Math.log10(frequency);
  const t = (logF - logFa) / (logFb - logFa);

  const logZa = Math.log10(Math.max(a.impedance, 1e-12));
  const logZb = Math.log10(Math.max(b.impedance, 1e-12));
  const logZ = logZa + t * (logZb - logZa);

  return Math.pow(10, logZ);
}

/**
 * Format a frequency value for human readability.
 */
export function formatFrequency(freq: number): string {
  if (freq >= 1e9) {
    return `${(freq / 1e9).toFixed(2)} GHz`;
  }
  if (freq >= 1e6) {
    return `${(freq / 1e6).toFixed(2)} MHz`;
  }
  if (freq >= 1e3) {
    return `${(freq / 1e3).toFixed(2)} kHz`;
  }
  return `${freq.toFixed(2)} Hz`;
}

/**
 * Compute the knee frequency from a rise time.
 * f_knee = 0.35 / t_rise (standard approximation).
 */
export function kneeFrequency(riseTimeNs: number): number {
  if (riseTimeNs <= 0) {
    return 0;
  }
  return 0.35 / (riseTimeNs * 1e-9);
}

/**
 * Estimate SSN ground bounce from output count, current, and PDN impedance.
 * V_bounce = Z_pdn * N * I_per_output
 */
export function estimateGroundBounce(
  pdnImpedanceOhms: number,
  numOutputs: number,
  currentPerOutput: number,
): number {
  return pdnImpedanceOhms * numOutputs * currentPerOutput * 1000; // mV
}
