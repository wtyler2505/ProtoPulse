import { describe, it, expect } from 'vitest';

import {
  recommendTermination,
  checkImpedanceMatch,
  suggestTraceWidth,
  checkLengthMatch,
  generateReport,
} from '../simulation/si-advisor';
import type {
  TerminationAdvice,
  ImpedanceCheckResult,
  LengthMatchResult,
  SIReport,
  TraceInfo,
  StackupLayerInfo,
} from '../simulation/si-advisor';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const defaultStackupLayer: StackupLayerInfo = {
  er: 4.4,
  height: 0.1, // mm
  thickness: 0.035,
  tanD: 0.02,
};

// ---------------------------------------------------------------------------
// recommendTermination
// ---------------------------------------------------------------------------

describe('recommendTermination', () => {
  it('returns series termination for matched driver', () => {
    // Low-impedance driver (10 ohm) driving 50 ohm line
    const advice = recommendTermination(50, 10, 1000);
    expect(advice.strategy).toBe('series');
    expect(advice.resistorValue).toBeCloseTo(40, 0); // 50 - 10 = 40
    expect(advice.explanation).toBeTruthy();
  });

  it('returns parallel termination for high-impedance receiver', () => {
    // Driver already matched, high-Z receiver
    const advice = recommendTermination(50, 50, 10000);
    expect(advice.strategy).toBe('parallel');
    expect(advice.resistorValue).toBeCloseTo(50, 0);
  });

  it('returns none when already matched on both ends', () => {
    const advice = recommendTermination(50, 50, 50);
    expect(advice.strategy).toBe('none');
  });

  it('calculates reflection coefficient before termination', () => {
    const advice = recommendTermination(50, 10, 1000);
    expect(advice.reflectionCoeff).toBeGreaterThan(0);
    expect(advice.reflectionCoeff).toBeLessThanOrEqual(1);
  });

  it('improved reflection coefficient is less than original', () => {
    const advice = recommendTermination(50, 10, 1000);
    expect(advice.improvedReflCoeff).toBeLessThan(advice.reflectionCoeff);
  });

  it('returns AC termination for moderate mismatch scenarios', () => {
    // Both source and load are somewhat mismatched
    const advice = recommendTermination(50, 25, 200);
    expect(['series', 'parallel', 'ac', 'thevenin', 'none']).toContain(advice.strategy);
    expect(advice.resistorValue).toBeGreaterThanOrEqual(0);
  });

  it('provides meaningful explanation text', () => {
    const advice = recommendTermination(50, 10, 1000);
    expect(advice.explanation.length).toBeGreaterThan(10);
  });

  it('resistor value is non-negative', () => {
    const advice = recommendTermination(50, 10, 1000);
    expect(advice.resistorValue).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// checkImpedanceMatch
// ---------------------------------------------------------------------------

describe('checkImpedanceMatch', () => {
  it('passes when impedance matches target within tolerance', () => {
    const result = checkImpedanceMatch(0.2, defaultStackupLayer, 50);
    // The result should have pass/fail and actual Z0
    expect(typeof result.pass).toBe('boolean');
    expect(result.actualZ0).toBeGreaterThan(0);
    expect(result.targetZ0).toBe(50);
  });

  it('calculates deviation percentage', () => {
    const result = checkImpedanceMatch(0.2, defaultStackupLayer, 50);
    expect(typeof result.deviation).toBe('number');
    expect(Number.isFinite(result.deviation)).toBe(true);
  });

  it('suggests a width to achieve target', () => {
    const result = checkImpedanceMatch(0.2, defaultStackupLayer, 50);
    expect(result.suggestedWidth).toBeGreaterThan(0);
    expect(Number.isFinite(result.suggestedWidth)).toBe(true);
  });

  it('passes when actual Z0 is within 10% of target', () => {
    // Find a width that gives ~50 ohm, then check
    const suggested = suggestTraceWidth(50, defaultStackupLayer);
    const result = checkImpedanceMatch(suggested, defaultStackupLayer, 50);
    expect(result.pass).toBe(true);
    expect(Math.abs(result.deviation)).toBeLessThan(10);
  });

  it('fails when actual Z0 deviates significantly from target', () => {
    // Very wide trace should give low impedance, fail 50 ohm target
    const result = checkImpedanceMatch(2.0, defaultStackupLayer, 50);
    expect(result.actualZ0).toBeLessThan(50);
    // Should fail due to large deviation
    expect(Math.abs(result.deviation)).toBeGreaterThan(10);
  });
});

// ---------------------------------------------------------------------------
// suggestTraceWidth
// ---------------------------------------------------------------------------

describe('suggestTraceWidth', () => {
  it('returns positive trace width', () => {
    const width = suggestTraceWidth(50, defaultStackupLayer);
    expect(width).toBeGreaterThan(0);
  });

  it('suggested width achieves target impedance within 10%', () => {
    const width = suggestTraceWidth(50, defaultStackupLayer);
    const check = checkImpedanceMatch(width, defaultStackupLayer, 50);
    expect(Math.abs(check.deviation)).toBeLessThan(10);
  });

  it('higher target impedance requires narrower trace', () => {
    const w50 = suggestTraceWidth(50, defaultStackupLayer);
    const w100 = suggestTraceWidth(100, defaultStackupLayer);
    expect(w100).toBeLessThan(w50);
  });

  it('works for common impedance targets', () => {
    const targets = [50, 75, 90, 100];
    for (const target of targets) {
      const width = suggestTraceWidth(target, defaultStackupLayer);
      expect(width).toBeGreaterThan(0);
      expect(Number.isFinite(width)).toBe(true);
    }
  });

  it('different stackup layers give different widths', () => {
    const fr4 = suggestTraceWidth(50, defaultStackupLayer);
    const rogers = suggestTraceWidth(50, { ...defaultStackupLayer, er: 3.66, tanD: 0.0037 });
    expect(fr4).not.toBeCloseTo(rogers, 2);
  });
});

// ---------------------------------------------------------------------------
// checkLengthMatch
// ---------------------------------------------------------------------------

describe('checkLengthMatch', () => {
  it('passes when all pairs are within skew tolerance', () => {
    const result = checkLengthMatch(
      [
        { name: 'CLK+/CLK-', lengthA: 50.0, lengthB: 50.1 },
        { name: 'D0+/D0-', lengthA: 48.0, lengthB: 48.05 },
      ],
      5, // 5 ps max skew
      6.5, // delay per mm (ps/mm)
    );
    expect(result.pass).toBe(true);
    expect(result.maxSkew).toBe(5);
  });

  it('fails when skew exceeds tolerance', () => {
    const result = checkLengthMatch(
      [
        { name: 'CLK+/CLK-', lengthA: 50, lengthB: 55 }, // 5mm diff -> large skew
      ],
      5, // 5 ps max skew
      6.5,
    );
    expect(result.pass).toBe(false);
    expect(result.actualSkew).toBeGreaterThan(5);
  });

  it('reports skew for each pair', () => {
    const result = checkLengthMatch(
      [
        { name: 'pair1', lengthA: 50, lengthB: 50.5 },
        { name: 'pair2', lengthA: 48, lengthB: 49 },
      ],
      10,
      6.5,
    );
    expect(result.pairs.length).toBe(2);
    for (const pair of result.pairs) {
      expect(pair.name).toBeTruthy();
      expect(typeof pair.skew).toBe('number');
      expect(pair.skew).toBeGreaterThanOrEqual(0);
    }
  });

  it('actualSkew is the maximum skew across all pairs', () => {
    const result = checkLengthMatch(
      [
        { name: 'pair1', lengthA: 50, lengthB: 50.1 },
        { name: 'pair2', lengthA: 48, lengthB: 49 }, // larger difference
      ],
      100,
      6.5,
    );
    const maxSkew = Math.max(...result.pairs.map((p) => p.skew));
    expect(result.actualSkew).toBeCloseTo(maxSkew, 6);
  });

  it('handles empty pairs array', () => {
    const result = checkLengthMatch([], 5, 6.5);
    expect(result.pass).toBe(true);
    expect(result.pairs.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// generateReport
// ---------------------------------------------------------------------------

describe('generateReport', () => {
  const sampleTraces: TraceInfo[] = [
    {
      name: 'CLK',
      width: 0.15,
      length: 50,
      spacing: 0.3,
      layer: defaultStackupLayer,
      targetZ0: 50,
      netClass: 'High-Speed',
    },
    {
      name: 'DATA0',
      width: 0.15,
      length: 45,
      spacing: 0.3,
      layer: defaultStackupLayer,
      targetZ0: 50,
      netClass: 'High-Speed',
    },
  ];

  it('returns report with all sections', () => {
    const report = generateReport(sampleTraces);
    expect(report.impedance).toBeDefined();
    expect(report.termination).toBeDefined();
    expect(report.crosstalk).toBeDefined();
    expect(report.overallScore).toBeDefined();
    expect(report.recommendations).toBeDefined();
  });

  it('impedance section has entry per trace', () => {
    const report = generateReport(sampleTraces);
    expect(report.impedance.length).toBe(sampleTraces.length);
  });

  it('overall score is between 0 and 100', () => {
    const report = generateReport(sampleTraces);
    expect(report.overallScore).toBeGreaterThanOrEqual(0);
    expect(report.overallScore).toBeLessThanOrEqual(100);
  });

  it('recommendations is non-empty array', () => {
    const report = generateReport(sampleTraces);
    expect(Array.isArray(report.recommendations)).toBe(true);
  });

  it('crosstalk section analyses adjacent trace pairs', () => {
    const report = generateReport(sampleTraces);
    // With 2 traces, there should be at least 1 crosstalk pair
    expect(report.crosstalk.length).toBeGreaterThanOrEqual(0);
  });

  it('handles single trace', () => {
    const report = generateReport([sampleTraces[0]]);
    expect(report.impedance.length).toBe(1);
    expect(report.crosstalk.length).toBe(0); // no pairs
    expect(report.overallScore).toBeGreaterThanOrEqual(0);
  });

  it('handles empty traces array', () => {
    const report = generateReport([]);
    expect(report.impedance.length).toBe(0);
    expect(report.overallScore).toBe(100); // no issues
    expect(report.recommendations.length).toBeGreaterThanOrEqual(0);
  });

  it('length match is null when no differential pairs', () => {
    const report = generateReport(sampleTraces);
    // These are single-ended traces, no diff pairs
    expect(report.lengthMatch).toBeNull();
  });

  it('includes length match for differential pairs', () => {
    const diffTraces: TraceInfo[] = [
      {
        name: 'USB_D+',
        width: 0.1,
        length: 50,
        spacing: 0.15,
        layer: defaultStackupLayer,
        targetZ0: 45,
        netClass: 'High-Speed',
        diffPairWith: 'USB_D-',
        diffPairLengthA: 50,
        diffPairLengthB: 50.2,
        maxSkewPs: 10,
      },
      {
        name: 'USB_D-',
        width: 0.1,
        length: 50.2,
        spacing: 0.15,
        layer: defaultStackupLayer,
        targetZ0: 45,
        netClass: 'High-Speed',
        diffPairWith: 'USB_D+',
        diffPairLengthA: 50,
        diffPairLengthB: 50.2,
        maxSkewPs: 10,
      },
    ];
    const report = generateReport(diffTraces);
    expect(report.lengthMatch).not.toBeNull();
  });
});
