/**
 * Signal Integrity Advisor — Design advice engine
 *
 * Provides actionable signal integrity recommendations:
 *   - Termination strategy selection (series, parallel, AC, Thevenin)
 *   - Impedance matching validation and trace width suggestions
 *   - Differential pair length matching (skew analysis)
 *   - Comprehensive SI report generation with scoring
 *
 * The advisor doesn't require a full circuit simulation — it works from
 * trace geometry, stackup information, and net class rules to produce
 * fast, practical design guidance suitable for PCB layout review.
 *
 * References:
 *   - Howard Johnson, "High Speed Digital Design"
 *   - Eric Bogatin, "Signal and Power Integrity — Simplified"
 *   - Intel/TI app notes on termination strategies
 *
 * Usage:
 *   import { recommendTermination, generateReport } from './si-advisor';
 *   const advice = recommendTermination(50, 10, 1000);
 *   const report = generateReport(traces);
 */

import { microstripZ0 } from './transmission-line';
import type { TransmissionLineParams } from './transmission-line';
import { analyzeCoupling } from './crosstalk-solver';
import type { CrosstalkResult } from './crosstalk-solver';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StackupLayerInfo {
  er: number; // relative permittivity
  height: number; // mm (dielectric thickness to reference plane)
  thickness: number; // mm (copper thickness)
  tanD: number; // loss tangent
}

export interface TerminationAdvice {
  strategy: 'series' | 'parallel' | 'ac' | 'thevenin' | 'none';
  resistorValue: number; // ohms
  explanation: string;
  reflectionCoeff: number; // before termination
  improvedReflCoeff: number; // after termination
}

export interface ImpedanceCheckResult {
  pass: boolean;
  actualZ0: number; // ohms
  targetZ0: number; // ohms
  deviation: number; // percent
  suggestedWidth: number; // mm to achieve target
}

export interface LengthMatchResult {
  pass: boolean;
  maxSkew: number; // ps (tolerance)
  actualSkew: number; // ps (worst case)
  pairs: Array<{ name: string; lengthA: number; lengthB: number; skew: number }>;
}

export interface TraceInfo {
  name: string;
  width: number; // mm
  length: number; // mm
  spacing: number; // mm (to nearest neighbor trace)
  layer: StackupLayerInfo;
  targetZ0: number; // ohms
  netClass: string;
  // Optional differential pair info
  diffPairWith?: string; // name of paired trace
  diffPairLengthA?: number; // mm
  diffPairLengthB?: number; // mm
  maxSkewPs?: number; // ps
  // Optional driver/receiver impedance
  zDriver?: number; // ohms
  zReceiver?: number; // ohms
}

export interface SIReport {
  impedance: ImpedanceCheckResult[];
  termination: TerminationAdvice[];
  crosstalk: CrosstalkResult[];
  lengthMatch: LengthMatchResult | null;
  overallScore: number; // 0-100
  recommendations: string[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Reflection coefficient: |Gamma| = |(ZL - Z0) / (ZL + Z0)| */
function reflectionCoeff(z0: number, zLoad: number): number {
  if (z0 + zLoad === 0) {
    return 1;
  }
  return Math.abs((zLoad - z0) / (zLoad + z0));
}

/** Compute microstrip Z0 from layer info and trace width. */
function computeZ0(width: number, layer: StackupLayerInfo): number {
  const params: TransmissionLineParams = {
    width,
    height: layer.height,
    thickness: layer.thickness,
    er: layer.er,
    tanD: layer.tanD,
    length: 1, // length doesn't affect Z0
  };

  try {
    const result = microstripZ0(params);
    return result.z0;
  } catch {
    return 0;
  }
}

/** Compute propagation delay (ps/mm) from layer info and trace width. */
function computeDelay(width: number, layer: StackupLayerInfo): number {
  const params: TransmissionLineParams = {
    width,
    height: layer.height,
    thickness: layer.thickness,
    er: layer.er,
    tanD: layer.tanD,
    length: 1,
  };

  try {
    const result = microstripZ0(params);
    return result.delay; // ps/mm
  } catch {
    return 6.5; // fallback: typical FR4 delay
  }
}

// ---------------------------------------------------------------------------
// Termination recommendation
// ---------------------------------------------------------------------------

/**
 * Recommend a termination strategy based on source, line, and load impedances.
 *
 * Decision logic:
 *   - If driver Z matches line Z: no source termination needed.
 *     Check receiver. If receiver Z matches line Z: no termination.
 *     If receiver is high-Z: add parallel termination at receiver.
 *   - If driver Z < line Z: add series resistor at source (Z0 - Zdriver).
 *   - If moderate mismatch on both ends: AC termination (series RC at receiver).
 *   - If matched on both ends: none needed.
 *
 * @param z0 - Characteristic impedance of the transmission line (ohms)
 * @param zDriver - Driver output impedance (ohms)
 * @param zReceiver - Receiver input impedance (ohms)
 * @returns Termination advice with strategy, value, and explanation
 */
export function recommendTermination(
  z0: number,
  zDriver: number,
  zReceiver: number,
): TerminationAdvice {
  const sourceGamma = reflectionCoeff(z0, zDriver);
  const loadGamma = reflectionCoeff(z0, zReceiver);

  // Mismatch thresholds
  const matchThreshold = 0.1; // < 10% reflection = "matched"

  // Case 1: Both ends matched
  if (sourceGamma < matchThreshold && loadGamma < matchThreshold) {
    return {
      strategy: 'none',
      resistorValue: 0,
      explanation: `Both source (${zDriver} ohm) and load (${zReceiver} ohm) are well matched to the ${z0} ohm line. No termination needed.`,
      reflectionCoeff: Math.max(sourceGamma, loadGamma),
      improvedReflCoeff: Math.max(sourceGamma, loadGamma),
    };
  }

  // Case 2: Low-impedance driver, high-impedance receiver
  // -> Series termination at source
  if (zDriver < z0 && zReceiver > 2 * z0) {
    const rSeries = Math.max(0, z0 - zDriver);
    const newSourceGamma = reflectionCoeff(z0, zDriver + rSeries);
    return {
      strategy: 'series',
      resistorValue: Math.round(rSeries * 10) / 10,
      explanation: `Low driver impedance (${zDriver} ohm) with high receiver impedance (${zReceiver} ohm). Add ${rSeries.toFixed(1)} ohm series resistor at the source to match the ${z0} ohm line. Signal arrives at half amplitude and doubles at the receiver.`,
      reflectionCoeff: sourceGamma,
      improvedReflCoeff: newSourceGamma,
    };
  }

  // Case 3: Source matched, receiver mismatched (high-Z)
  // -> Parallel termination at receiver
  if (sourceGamma < matchThreshold && loadGamma >= matchThreshold) {
    const rParallel = z0;
    const newLoadGamma = reflectionCoeff(z0, rParallel);
    return {
      strategy: 'parallel',
      resistorValue: Math.round(rParallel * 10) / 10,
      explanation: `Source is matched but receiver (${zReceiver} ohm) causes reflections. Add ${rParallel} ohm parallel resistor at the receiver. Note: this increases steady-state current draw.`,
      reflectionCoeff: loadGamma,
      improvedReflCoeff: newLoadGamma,
    };
  }

  // Case 4: Receiver is low-Z or moderate mismatch
  // -> AC termination (series R-C at receiver)
  if (loadGamma >= matchThreshold && zReceiver <= 2 * z0) {
    const rAc = z0;
    const newLoadGamma = reflectionCoeff(z0, rAc);
    return {
      strategy: 'ac',
      resistorValue: Math.round(rAc * 10) / 10,
      explanation: `Moderate impedance mismatch. Use AC termination: ${rAc} ohm resistor in series with 100pF capacitor at the receiver. This absorbs reflections during transitions without DC power dissipation.`,
      reflectionCoeff: loadGamma,
      improvedReflCoeff: newLoadGamma,
    };
  }

  // Case 5: General mismatch — Thevenin termination
  const rThevenin = z0;
  const newGamma = reflectionCoeff(z0, rThevenin);
  return {
    strategy: 'thevenin',
    resistorValue: Math.round(rThevenin * 10) / 10,
    explanation: `General impedance mismatch (driver ${zDriver} ohm, receiver ${zReceiver} ohm, line ${z0} ohm). Use Thevenin termination: two ${(2 * rThevenin).toFixed(0)} ohm resistors to VCC and GND forming a ${rThevenin} ohm equivalent at the bias point.`,
    reflectionCoeff: Math.max(sourceGamma, loadGamma),
    improvedReflCoeff: newGamma,
  };
}

// ---------------------------------------------------------------------------
// Impedance matching check
// ---------------------------------------------------------------------------

/**
 * Check if a trace width produces the target impedance.
 *
 * @param traceWidth - Current trace width in mm
 * @param layer - Stackup layer parameters
 * @param targetZ0 - Target impedance in ohms
 * @returns Check result with pass/fail, deviation, and suggested width
 */
export function checkImpedanceMatch(
  traceWidth: number,
  layer: StackupLayerInfo,
  targetZ0: number,
): ImpedanceCheckResult {
  const actualZ0 = computeZ0(traceWidth, layer);
  const deviation = targetZ0 > 0 ? ((actualZ0 - targetZ0) / targetZ0) * 100 : 0;
  const pass = Math.abs(deviation) < 10; // 10% tolerance

  const suggestedWidth = suggestTraceWidth(targetZ0, layer);

  return {
    pass,
    actualZ0: Math.round(actualZ0 * 100) / 100,
    targetZ0,
    deviation: Math.round(deviation * 100) / 100,
    suggestedWidth,
  };
}

// ---------------------------------------------------------------------------
// Trace width suggestion (binary search)
// ---------------------------------------------------------------------------

/**
 * Find the trace width that produces a target impedance using binary search.
 *
 * Impedance decreases monotonically as trace width increases, so binary
 * search converges reliably.
 *
 * @param targetZ0 - Target impedance in ohms
 * @param layer - Stackup layer parameters
 * @returns Suggested trace width in mm
 */
export function suggestTraceWidth(
  targetZ0: number,
  layer: StackupLayerInfo,
): number {
  // First, find the valid range where computeZ0 returns non-zero results.
  // The maximum valid width depends on the geometry (5.98*h / (0.8*w+t) > 1).
  // maxWidth ~ (5.98 * h - t) / 0.8
  const maxValidWidth = Math.max(0.01, (5.98 * layer.height - layer.thickness) / 0.8 * 0.95);

  let lo = 0.005; // mm (very narrow trace)
  let hi = Math.min(maxValidWidth, 5.0); // mm — stay within valid geometry
  const maxIterations = 100;
  const tolerance = 0.5; // ohms

  for (let i = 0; i < maxIterations; i++) {
    const mid = (lo + hi) / 2;
    const z0 = computeZ0(mid, layer);

    if (z0 === 0) {
      // Invalid geometry — trace too wide, search narrower
      hi = mid;
      continue;
    }

    const diff = z0 - targetZ0;

    if (Math.abs(diff) < tolerance) {
      return Math.round(mid * 10000) / 10000;
    }

    if (diff > 0) {
      // Z0 too high — need wider trace to reduce it
      lo = mid;
    } else {
      // Z0 too low — need narrower trace to increase it
      hi = mid;
    }
  }

  // Return best approximation
  return Math.round(((lo + hi) / 2) * 10000) / 10000;
}

// ---------------------------------------------------------------------------
// Length matching (differential pair skew)
// ---------------------------------------------------------------------------

/**
 * Check length matching for differential pairs.
 *
 * Computes timing skew from length differences and propagation delay,
 * comparing against the maximum allowed skew.
 *
 * @param pairs - Array of named trace pairs with lengths
 * @param maxSkewPs - Maximum allowed skew in picoseconds
 * @param delayPerMm - Propagation delay in ps/mm
 * @returns Length match result
 */
export function checkLengthMatch(
  pairs: Array<{ name: string; lengthA: number; lengthB: number }>,
  maxSkewPs: number,
  delayPerMm: number,
): LengthMatchResult {
  if (pairs.length === 0) {
    return {
      pass: true,
      maxSkew: maxSkewPs,
      actualSkew: 0,
      pairs: [],
    };
  }

  const results = pairs.map((pair) => {
    const lengthDiff = Math.abs(pair.lengthA - pair.lengthB);
    const skew = lengthDiff * delayPerMm; // ps
    return {
      name: pair.name,
      lengthA: pair.lengthA,
      lengthB: pair.lengthB,
      skew,
    };
  });

  const actualSkew = Math.max(...results.map((r) => r.skew));
  const pass = actualSkew <= maxSkewPs;

  return {
    pass,
    maxSkew: maxSkewPs,
    actualSkew,
    pairs: results,
  };
}

// ---------------------------------------------------------------------------
// Comprehensive SI report
// ---------------------------------------------------------------------------

/**
 * Generate a comprehensive signal integrity report for a set of traces.
 *
 * Analyzes:
 *   1. Impedance matching for each trace
 *   2. Termination recommendations (for traces with driver/receiver info)
 *   3. Crosstalk between adjacent traces
 *   4. Length matching for differential pairs
 *   5. Overall score (0-100)
 *
 * @param traces - Array of trace descriptions
 * @returns Full SI report with scores and recommendations
 */
export function generateReport(traces: TraceInfo[]): SIReport {
  const impedance: ImpedanceCheckResult[] = [];
  const termination: TerminationAdvice[] = [];
  const crosstalk: CrosstalkResult[] = [];
  const recommendations: string[] = [];
  let lengthMatch: LengthMatchResult | null = null;

  if (traces.length === 0) {
    return {
      impedance: [],
      termination: [],
      crosstalk: [],
      lengthMatch: null,
      overallScore: 100,
      recommendations: [],
    };
  }

  // --- 1. Impedance checks ---
  let impedanceScore = 100;
  for (const trace of traces) {
    const check = checkImpedanceMatch(trace.width, trace.layer, trace.targetZ0);
    impedance.push(check);

    if (!check.pass) {
      impedanceScore -= 15;
      recommendations.push(
        `${trace.name}: Impedance mismatch — actual ${check.actualZ0} ohm vs target ${check.targetZ0} ohm (${check.deviation.toFixed(1)}% deviation). Suggested width: ${check.suggestedWidth.toFixed(4)} mm.`,
      );
    }
  }

  // --- 2. Termination recommendations ---
  let terminationScore = 100;
  for (const trace of traces) {
    const zDriver = trace.zDriver ?? 25; // default CMOS driver ~25 ohm
    const zReceiver = trace.zReceiver ?? 10000; // default high-Z CMOS input
    const z0 = computeZ0(trace.width, trace.layer) || trace.targetZ0;

    const advice = recommendTermination(z0, zDriver, zReceiver);
    termination.push(advice);

    if (advice.strategy !== 'none' && advice.reflectionCoeff > 0.3) {
      terminationScore -= 10;
      recommendations.push(
        `${trace.name}: ${advice.strategy} termination recommended — ${advice.explanation}`,
      );
    }
  }

  // --- 3. Crosstalk analysis (adjacent pairs) ---
  let crosstalkScore = 100;
  const riseTime = 0.5e-9; // assume 500ps rise time for High-Speed signals

  for (let i = 0; i < traces.length - 1; i++) {
    const t1 = traces[i];
    const t2 = traces[i + 1];

    // Use the minimum spacing between the two traces
    const spacing = Math.min(t1.spacing, t2.spacing);
    const coupledLength = Math.min(t1.length, t2.length);

    const coupling = analyzeCoupling(
      {
        spacing,
        height: t1.layer.height,
        width: (t1.width + t2.width) / 2,
        length: coupledLength,
        er: t1.layer.er,
      },
      riseTime,
    );

    crosstalk.push(coupling);

    // Flag if NEXT or FEXT exceed -20 dB
    if (coupling.nextDb > -20 || coupling.fextDb > -20) {
      crosstalkScore -= 15;
      recommendations.push(
        `${t1.name} / ${t2.name}: Crosstalk concern — NEXT ${coupling.nextDb.toFixed(1)} dB, FEXT ${coupling.fextDb.toFixed(1)} dB. Increase spacing or add guard trace.`,
      );
    }
  }

  // --- 4. Length matching for differential pairs ---
  const diffPairs: Array<{ name: string; lengthA: number; lengthB: number }> = [];
  const processedPairs = new Set<string>();
  let lengthMatchScore = 100;

  for (const trace of traces) {
    if (trace.diffPairWith && !processedPairs.has(trace.name)) {
      processedPairs.add(trace.name);
      processedPairs.add(trace.diffPairWith);

      if (
        trace.diffPairLengthA !== undefined &&
        trace.diffPairLengthB !== undefined
      ) {
        diffPairs.push({
          name: `${trace.name}/${trace.diffPairWith}`,
          lengthA: trace.diffPairLengthA,
          lengthB: trace.diffPairLengthB,
        });
      }
    }
  }

  if (diffPairs.length > 0) {
    // Get delay from first diff pair trace
    const firstDiffTrace = traces.find((t) => t.diffPairWith);
    const delay = firstDiffTrace
      ? computeDelay(firstDiffTrace.width, firstDiffTrace.layer)
      : 6.5;
    const maxSkew = firstDiffTrace?.maxSkewPs ?? 10;

    lengthMatch = checkLengthMatch(diffPairs, maxSkew, delay);

    if (!lengthMatch.pass) {
      lengthMatchScore -= 20;
      recommendations.push(
        `Differential pair length mismatch: worst skew ${lengthMatch.actualSkew.toFixed(1)} ps exceeds ${lengthMatch.maxSkew} ps tolerance.`,
      );
      for (const pair of lengthMatch.pairs) {
        if (pair.skew > maxSkew) {
          recommendations.push(
            `  ${pair.name}: ${pair.lengthA.toFixed(2)} mm vs ${pair.lengthB.toFixed(2)} mm (skew: ${pair.skew.toFixed(1)} ps)`,
          );
        }
      }
    }
  }

  // --- 5. Overall score ---
  const scores = [impedanceScore, terminationScore, crosstalkScore, lengthMatchScore];
  const overallScore = Math.max(
    0,
    Math.min(100, Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)),
  );

  // Add general recommendations if score is high
  if (overallScore >= 90 && recommendations.length === 0) {
    recommendations.push('Signal integrity looks good. No critical issues found.');
  }

  return {
    impedance,
    termination,
    crosstalk,
    lengthMatch,
    overallScore,
    recommendations,
  };
}
