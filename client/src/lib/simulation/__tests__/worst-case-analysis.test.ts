import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  worstCaseAnalyzer,
  type WCAParameter,
  type WCAResult,
  type CornerType,
} from '../worst-case-analysis';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Standard voltage divider: Vout = Vin * R2 / (R1 + R2) */
function voltageDivider(vin: number) {
  return (values: Record<string, number>): number => {
    const r1 = values['R1']!;
    const r2 = values['R2']!;
    return vin * r2 / (r1 + r2);
  };
}

/** Simple linear function: output = 2*A + 3*B */
function linearFn(values: Record<string, number>): number {
  return 2 * (values['A'] ?? 0) + 3 * (values['B'] ?? 0);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WorstCaseAnalyzer', () => {
  beforeEach(() => {
    worstCaseAnalyzer._reset();
  });

  // ---- Singleton & subscribe ----

  describe('singleton + subscribe', () => {
    it('should be a singleton instance', () => {
      expect(worstCaseAnalyzer).toBeDefined();
      expect(worstCaseAnalyzer.getState).toBeDefined();
      expect(worstCaseAnalyzer.subscribe).toBeDefined();
    });

    it('should start with empty state', () => {
      const state = worstCaseAnalyzer.getState();
      expect(state.parameters).toEqual([]);
      expect(state.result).toBeNull();
      expect(state.running).toBe(false);
    });

    it('should notify subscribers on defineParameters', () => {
      const listener = vi.fn();
      const unsub = worstCaseAnalyzer.subscribe(listener);

      worstCaseAnalyzer.defineParameters([
        { id: 'R1', name: 'R1', nominal: 1000, tolerance: 0.05, toleranceType: 'percentage' },
      ]);

      expect(listener).toHaveBeenCalled();
      unsub();
    });

    it('should stop notifying after unsubscribe', () => {
      const listener = vi.fn();
      const unsub = worstCaseAnalyzer.subscribe(listener);
      unsub();

      worstCaseAnalyzer.defineParameters([
        { id: 'R1', name: 'R1', nominal: 1000, tolerance: 0.05, toleranceType: 'percentage' },
      ]);

      expect(listener).not.toHaveBeenCalled();
    });

    it('should increment version on state changes', () => {
      const v0 = worstCaseAnalyzer.version;
      worstCaseAnalyzer.defineParameters([
        { id: 'R1', name: 'R1', nominal: 1000, tolerance: 50, toleranceType: 'absolute' },
      ]);
      expect(worstCaseAnalyzer.version).toBeGreaterThan(v0);
    });

    it('should support multiple subscribers', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const unsub1 = worstCaseAnalyzer.subscribe(listener1);
      const unsub2 = worstCaseAnalyzer.subscribe(listener2);

      worstCaseAnalyzer.defineParameters([
        { id: 'R1', name: 'R1', nominal: 1000, tolerance: 0.05, toleranceType: 'percentage' },
      ]);

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
      unsub1();
      unsub2();
    });
  });

  // ---- Parameter management ----

  describe('parameter management', () => {
    it('should define parameters', () => {
      const params: WCAParameter[] = [
        { id: 'R1', name: 'R1 Resistance', nominal: 10000, tolerance: 0.05, toleranceType: 'percentage' },
        { id: 'R2', name: 'R2 Resistance', nominal: 10000, tolerance: 0.05, toleranceType: 'percentage' },
      ];
      worstCaseAnalyzer.defineParameters(params);

      const state = worstCaseAnalyzer.getState();
      expect(state.parameters).toHaveLength(2);
      expect(state.parameters[0].id).toBe('R1');
      expect(state.parameters[1].id).toBe('R2');
    });

    it('should replace parameters on re-define', () => {
      worstCaseAnalyzer.defineParameters([
        { id: 'R1', name: 'R1', nominal: 1000, tolerance: 0.05, toleranceType: 'percentage' },
      ]);
      worstCaseAnalyzer.defineParameters([
        { id: 'C1', name: 'C1', nominal: 0.0001, tolerance: 0.1, toleranceType: 'percentage' },
      ]);

      const state = worstCaseAnalyzer.getState();
      expect(state.parameters).toHaveLength(1);
      expect(state.parameters[0].id).toBe('C1');
    });

    it('should add a parameter', () => {
      worstCaseAnalyzer.defineParameters([
        { id: 'R1', name: 'R1', nominal: 1000, tolerance: 50, toleranceType: 'absolute' },
      ]);
      worstCaseAnalyzer.addParameter(
        { id: 'R2', name: 'R2', nominal: 2000, tolerance: 100, toleranceType: 'absolute' },
      );

      expect(worstCaseAnalyzer.getState().parameters).toHaveLength(2);
    });

    it('should replace existing parameter on addParameter with same ID', () => {
      worstCaseAnalyzer.defineParameters([
        { id: 'R1', name: 'R1', nominal: 1000, tolerance: 50, toleranceType: 'absolute' },
      ]);
      worstCaseAnalyzer.addParameter(
        { id: 'R1', name: 'R1 Updated', nominal: 2000, tolerance: 100, toleranceType: 'absolute' },
      );

      const state = worstCaseAnalyzer.getState();
      expect(state.parameters).toHaveLength(1);
      expect(state.parameters[0].nominal).toBe(2000);
      expect(state.parameters[0].name).toBe('R1 Updated');
    });

    it('should remove a parameter', () => {
      worstCaseAnalyzer.defineParameters([
        { id: 'R1', name: 'R1', nominal: 1000, tolerance: 50, toleranceType: 'absolute' },
        { id: 'R2', name: 'R2', nominal: 2000, tolerance: 100, toleranceType: 'absolute' },
      ]);

      const removed = worstCaseAnalyzer.removeParameter('R1');
      expect(removed).toBe(true);
      expect(worstCaseAnalyzer.getState().parameters).toHaveLength(1);
      expect(worstCaseAnalyzer.getState().parameters[0].id).toBe('R2');
    });

    it('should return false when removing nonexistent parameter', () => {
      expect(worstCaseAnalyzer.removeParameter('nonexistent')).toBe(false);
    });

    it('should update a parameter', () => {
      worstCaseAnalyzer.defineParameters([
        { id: 'R1', name: 'R1', nominal: 1000, tolerance: 50, toleranceType: 'absolute' },
      ]);

      const updated = worstCaseAnalyzer.updateParameter('R1', { nominal: 2200, name: 'R1 2.2k' });
      expect(updated).toBe(true);

      const state = worstCaseAnalyzer.getState();
      expect(state.parameters[0].nominal).toBe(2200);
      expect(state.parameters[0].name).toBe('R1 2.2k');
      expect(state.parameters[0].tolerance).toBe(50); // unchanged
    });

    it('should return false when updating nonexistent parameter', () => {
      expect(worstCaseAnalyzer.updateParameter('ghost', { nominal: 1 })).toBe(false);
    });

    it('should clear all parameters', () => {
      worstCaseAnalyzer.defineParameters([
        { id: 'R1', name: 'R1', nominal: 1000, tolerance: 50, toleranceType: 'absolute' },
      ]);
      worstCaseAnalyzer.clearParameters();

      const state = worstCaseAnalyzer.getState();
      expect(state.parameters).toHaveLength(0);
      expect(state.result).toBeNull();
    });

    it('should clear result when parameters change', () => {
      worstCaseAnalyzer.defineParameters([
        { id: 'A', name: 'A', nominal: 10, tolerance: 1, toleranceType: 'absolute' },
      ]);
      worstCaseAnalyzer.runAnalysis((v) => v['A']! * 2);
      expect(worstCaseAnalyzer.getState().result).not.toBeNull();

      // Now change parameters — result should be cleared
      worstCaseAnalyzer.addParameter(
        { id: 'B', name: 'B', nominal: 5, tolerance: 0.5, toleranceType: 'absolute' },
      );
      expect(worstCaseAnalyzer.getState().result).toBeNull();
    });

    it('should deep-copy parameters (no mutation leaks)', () => {
      const original: WCAParameter = {
        id: 'R1', name: 'R1', nominal: 1000, tolerance: 50, toleranceType: 'absolute',
      };
      worstCaseAnalyzer.defineParameters([original]);

      // Mutate the original
      original.nominal = 9999;

      expect(worstCaseAnalyzer.getState().parameters[0].nominal).toBe(1000);
    });
  });

  // ---- Nominal corner ----

  describe('nominal corner', () => {
    it('should evaluate at nominal values', () => {
      worstCaseAnalyzer.defineParameters([
        { id: 'R1', name: 'R1', nominal: 10000, tolerance: 0.05, toleranceType: 'percentage' },
        { id: 'R2', name: 'R2', nominal: 10000, tolerance: 0.05, toleranceType: 'percentage' },
      ]);

      const result = worstCaseAnalyzer.runAnalysis(voltageDivider(10));

      const nominalCorner = result.corners.find((c) => c.type === 'nominal');
      expect(nominalCorner).toBeDefined();
      expect(nominalCorner!.result).toBeCloseTo(5, 10); // 10 * 10k / (10k + 10k) = 5V
      expect(nominalCorner!.deviation).toBe(0);
      expect(nominalCorner!.values['R1']).toBe(10000);
      expect(nominalCorner!.values['R2']).toBe(10000);
    });

    it('should set nominal as result.nominal', () => {
      worstCaseAnalyzer.defineParameters([
        { id: 'A', name: 'A', nominal: 100, tolerance: 10, toleranceType: 'absolute' },
      ]);

      const result = worstCaseAnalyzer.runAnalysis((v) => v['A']! * 3);
      expect(result.nominal).toBe(300);
    });
  });

  // ---- All-min / all-max corners ----

  describe('all-min / all-max corners', () => {
    it('should set all parameters to min for all_min corner', () => {
      worstCaseAnalyzer.defineParameters([
        { id: 'R1', name: 'R1', nominal: 10000, tolerance: 0.05, toleranceType: 'percentage' },
        { id: 'R2', name: 'R2', nominal: 10000, tolerance: 0.05, toleranceType: 'percentage' },
      ]);

      const result = worstCaseAnalyzer.runAnalysis(voltageDivider(10));
      const allMin = result.corners.find((c) => c.type === 'all_min');

      expect(allMin).toBeDefined();
      // R1 at 9500, R2 at 9500 -> Vout = 10 * 9500 / (9500 + 9500) = 5V (same for equal Rs)
      expect(allMin!.values['R1']).toBeCloseTo(9500);
      expect(allMin!.values['R2']).toBeCloseTo(9500);
    });

    it('should set all parameters to max for all_max corner', () => {
      worstCaseAnalyzer.defineParameters([
        { id: 'R1', name: 'R1', nominal: 10000, tolerance: 0.05, toleranceType: 'percentage' },
        { id: 'R2', name: 'R2', nominal: 10000, tolerance: 0.05, toleranceType: 'percentage' },
      ]);

      const result = worstCaseAnalyzer.runAnalysis(voltageDivider(10));
      const allMax = result.corners.find((c) => c.type === 'all_max');

      expect(allMax).toBeDefined();
      expect(allMax!.values['R1']).toBeCloseTo(10500);
      expect(allMax!.values['R2']).toBeCloseTo(10500);
    });

    it('should compute correct deviation for linear function', () => {
      worstCaseAnalyzer.defineParameters([
        { id: 'A', name: 'A', nominal: 10, tolerance: 1, toleranceType: 'absolute' },
        { id: 'B', name: 'B', nominal: 5, tolerance: 0.5, toleranceType: 'absolute' },
      ]);

      const result = worstCaseAnalyzer.runAnalysis(linearFn);

      // Nominal: 2*10 + 3*5 = 35
      expect(result.nominal).toBeCloseTo(35);

      // All-min: 2*9 + 3*4.5 = 18 + 13.5 = 31.5
      const allMin = result.corners.find((c) => c.type === 'all_min')!;
      expect(allMin.result).toBeCloseTo(31.5);
      expect(allMin.deviation).toBeCloseTo(-3.5);

      // All-max: 2*11 + 3*5.5 = 22 + 16.5 = 38.5
      const allMax = result.corners.find((c) => c.type === 'all_max')!;
      expect(allMax.result).toBeCloseTo(38.5);
      expect(allMax.deviation).toBeCloseTo(3.5);
    });

    it('should handle absolute tolerance correctly', () => {
      worstCaseAnalyzer.defineParameters([
        { id: 'X', name: 'X', nominal: 100, tolerance: 10, toleranceType: 'absolute' },
      ]);

      const result = worstCaseAnalyzer.runAnalysis((v) => v['X']!);

      const allMin = result.corners.find((c) => c.type === 'all_min')!;
      expect(allMin.values['X']).toBe(90);

      const allMax = result.corners.find((c) => c.type === 'all_max')!;
      expect(allMax.values['X']).toBe(110);
    });

    it('should handle percentage tolerance correctly', () => {
      worstCaseAnalyzer.defineParameters([
        { id: 'X', name: 'X', nominal: 200, tolerance: 0.1, toleranceType: 'percentage' },
      ]);

      const result = worstCaseAnalyzer.runAnalysis((v) => v['X']!);

      const allMin = result.corners.find((c) => c.type === 'all_min')!;
      expect(allMin.values['X']).toBeCloseTo(180); // 200 - 20

      const allMax = result.corners.find((c) => c.type === 'all_max')!;
      expect(allMax.values['X']).toBeCloseTo(220); // 200 + 20
    });
  });

  // ---- RSS corners ----

  describe('RSS corners', () => {
    it('should produce rss_min and rss_max corners', () => {
      worstCaseAnalyzer.defineParameters([
        { id: 'A', name: 'A', nominal: 10, tolerance: 1, toleranceType: 'absolute' },
        { id: 'B', name: 'B', nominal: 5, tolerance: 0.5, toleranceType: 'absolute' },
      ]);

      const result = worstCaseAnalyzer.runAnalysis(linearFn);
      const rssMin = result.corners.find((c) => c.type === 'rss_min');
      const rssMax = result.corners.find((c) => c.type === 'rss_max');

      expect(rssMin).toBeDefined();
      expect(rssMax).toBeDefined();
    });

    it('should have RSS deviation less than or equal to all-min/all-max deviation', () => {
      worstCaseAnalyzer.defineParameters([
        { id: 'A', name: 'A', nominal: 10, tolerance: 1, toleranceType: 'absolute' },
        { id: 'B', name: 'B', nominal: 5, tolerance: 0.5, toleranceType: 'absolute' },
      ]);

      const result = worstCaseAnalyzer.runAnalysis(linearFn);

      const allMin = result.corners.find((c) => c.type === 'all_min')!;
      const allMax = result.corners.find((c) => c.type === 'all_max')!;
      const rssMin = result.corners.find((c) => c.type === 'rss_min')!;
      const rssMax = result.corners.find((c) => c.type === 'rss_max')!;

      // RSS is statistical — should be tighter than absolute worst
      expect(Math.abs(rssMin.deviation)).toBeLessThanOrEqual(Math.abs(allMin.deviation) + 0.001);
      expect(Math.abs(rssMax.deviation)).toBeLessThanOrEqual(Math.abs(allMax.deviation) + 0.001);
    });

    it('should compute correct RSS deviation for linear function', () => {
      // For f = 2*A + 3*B:
      //   dF/dA = 2, dF/dB = 3
      //   deltaA = 1, deltaB = 0.5
      //   RSS = sqrt((2*1)^2 + (3*0.5)^2) = sqrt(4 + 2.25) = sqrt(6.25) = 2.5
      worstCaseAnalyzer.defineParameters([
        { id: 'A', name: 'A', nominal: 10, tolerance: 1, toleranceType: 'absolute' },
        { id: 'B', name: 'B', nominal: 5, tolerance: 0.5, toleranceType: 'absolute' },
      ]);

      const result = worstCaseAnalyzer.runAnalysis(linearFn);
      const rssMax = result.corners.find((c) => c.type === 'rss_max')!;
      const rssMin = result.corners.find((c) => c.type === 'rss_min')!;

      // RSS deviation should be ~2.5
      expect(rssMax.deviation).toBeCloseTo(2.5, 1);
      expect(rssMin.deviation).toBeCloseTo(-2.5, 1);
    });

    it('should be symmetric around nominal for symmetric functions', () => {
      worstCaseAnalyzer.defineParameters([
        { id: 'A', name: 'A', nominal: 10, tolerance: 1, toleranceType: 'absolute' },
      ]);

      const result = worstCaseAnalyzer.runAnalysis((v) => v['A']! * 5);
      const rssMax = result.corners.find((c) => c.type === 'rss_max')!;
      const rssMin = result.corners.find((c) => c.type === 'rss_min')!;

      expect(rssMax.deviation).toBeCloseTo(-rssMin.deviation, 5);
    });
  });

  // ---- Sensitivity analysis ----

  describe('sensitivity analysis', () => {
    it('should identify the dominant parameter', () => {
      // f = 2*A + 3*B, with equal tolerances
      // dF/dA = 2, dF/dB = 3 -> B is more influential
      worstCaseAnalyzer.defineParameters([
        { id: 'A', name: 'A', nominal: 10, tolerance: 1, toleranceType: 'absolute' },
        { id: 'B', name: 'B', nominal: 10, tolerance: 1, toleranceType: 'absolute' },
      ]);

      const result = worstCaseAnalyzer.runAnalysis(linearFn);
      const sensB = result.sensitivities.find((s) => s.parameterId === 'B')!;
      const sensA = result.sensitivities.find((s) => s.parameterId === 'A')!;

      expect(sensB.influence).toBeGreaterThan(sensA.influence);
      // B should have influence = 1 (it's the dominant one)
      expect(sensB.influence).toBeCloseTo(1, 5);
    });

    it('should detect positive and negative sensitivity directions', () => {
      // f = A - B
      worstCaseAnalyzer.defineParameters([
        { id: 'A', name: 'A', nominal: 10, tolerance: 1, toleranceType: 'absolute' },
        { id: 'B', name: 'B', nominal: 5, tolerance: 1, toleranceType: 'absolute' },
      ]);

      const result = worstCaseAnalyzer.runAnalysis((v) => v['A']! - v['B']!);
      const sensA = result.sensitivities.find((s) => s.parameterId === 'A')!;
      const sensB = result.sensitivities.find((s) => s.parameterId === 'B')!;

      expect(sensA.direction).toBe('positive');
      expect(sensB.direction).toBe('negative');
    });

    it('should have normalized influence in [0, 1]', () => {
      worstCaseAnalyzer.defineParameters([
        { id: 'A', name: 'A', nominal: 10, tolerance: 1, toleranceType: 'absolute' },
        { id: 'B', name: 'B', nominal: 5, tolerance: 0.5, toleranceType: 'absolute' },
        { id: 'C', name: 'C', nominal: 20, tolerance: 2, toleranceType: 'absolute' },
      ]);

      const result = worstCaseAnalyzer.runAnalysis(linearFn);

      for (const s of result.sensitivities) {
        expect(s.influence).toBeGreaterThanOrEqual(0);
        expect(s.influence).toBeLessThanOrEqual(1);
      }

      // At least one should be 1 (the most influential)
      const maxInfluence = Math.max(...result.sensitivities.map((s) => s.influence));
      expect(maxInfluence).toBeCloseTo(1, 5);
    });

    it('should return sensitivities via getSensitivities()', () => {
      worstCaseAnalyzer.defineParameters([
        { id: 'A', name: 'A', nominal: 10, tolerance: 1, toleranceType: 'absolute' },
      ]);

      worstCaseAnalyzer.runAnalysis((v) => v['A']! * 2);

      const sensitivities = worstCaseAnalyzer.getSensitivities();
      expect(sensitivities).toHaveLength(1);
      expect(sensitivities[0].parameterId).toBe('A');
    });

    it('should return empty array for getSensitivities() before any run', () => {
      expect(worstCaseAnalyzer.getSensitivities()).toEqual([]);
    });

    it('should assign zero sensitivity when parameter has no effect', () => {
      // f = A * 2, B has no effect
      worstCaseAnalyzer.defineParameters([
        { id: 'A', name: 'A', nominal: 10, tolerance: 1, toleranceType: 'absolute' },
        { id: 'B', name: 'B', nominal: 5, tolerance: 0.5, toleranceType: 'absolute' },
      ]);

      const result = worstCaseAnalyzer.runAnalysis((v) => v['A']! * 2);
      const sensB = result.sensitivities.find((s) => s.parameterId === 'B')!;
      expect(sensB.rawSensitivity).toBeCloseTo(0, 10);
      expect(sensB.influence).toBeCloseTo(0, 5);
    });
  });

  // ---- Voltage divider example ----

  describe('voltage divider example', () => {
    it('should compute correct worst-case spread for unequal divider', () => {
      // Vin = 12V, R1 = 10k ±5%, R2 = 4.7k ±5%
      // Nominal Vout = 12 * 4700 / (10000 + 4700) = 3.836...
      worstCaseAnalyzer.defineParameters([
        { id: 'R1', name: 'R1', nominal: 10000, tolerance: 0.05, toleranceType: 'percentage' },
        { id: 'R2', name: 'R2', nominal: 4700, tolerance: 0.05, toleranceType: 'percentage' },
      ]);

      const result = worstCaseAnalyzer.runAnalysis(voltageDivider(12));

      expect(result.nominal).toBeCloseTo(12 * 4700 / 14700, 5);
      expect(result.spread).toBeGreaterThan(0);
      expect(result.minResult).toBeLessThan(result.nominal);
      expect(result.maxResult).toBeGreaterThan(result.nominal);
    });

    it('should show R2 has more influence in a 10k/4.7k divider', () => {
      // In a voltage divider, the lower resistor (R2) has more effect on output
      // because Vout = Vin * R2/(R1+R2), sensitivity to R2 > sensitivity to R1
      worstCaseAnalyzer.defineParameters([
        { id: 'R1', name: 'R1', nominal: 10000, tolerance: 0.05, toleranceType: 'percentage' },
        { id: 'R2', name: 'R2', nominal: 4700, tolerance: 0.05, toleranceType: 'percentage' },
      ]);

      const result = worstCaseAnalyzer.runAnalysis(voltageDivider(12));
      const sensR1 = result.sensitivities.find((s) => s.parameterId === 'R1')!;
      const sensR2 = result.sensitivities.find((s) => s.parameterId === 'R2')!;

      // R1 increases -> Vout decreases (negative direction)
      expect(sensR1.direction).toBe('negative');
      // R2 increases -> Vout increases (positive direction)
      expect(sensR2.direction).toBe('positive');
    });
  });

  // ---- Spread and minResult/maxResult ----

  describe('spread calculation', () => {
    it('should compute correct spread', () => {
      worstCaseAnalyzer.defineParameters([
        { id: 'A', name: 'A', nominal: 100, tolerance: 10, toleranceType: 'absolute' },
      ]);

      const result = worstCaseAnalyzer.runAnalysis((v) => v['A']!);

      // Min = 90, Max = 110, spread = 20
      expect(result.minResult).toBeCloseTo(90, 1);
      expect(result.maxResult).toBeCloseTo(110, 1);
      expect(result.spread).toBeCloseTo(20, 1);
    });

    it('should have minResult <= nominal <= maxResult', () => {
      worstCaseAnalyzer.defineParameters([
        { id: 'A', name: 'A', nominal: 10, tolerance: 2, toleranceType: 'absolute' },
        { id: 'B', name: 'B', nominal: 5, tolerance: 1, toleranceType: 'absolute' },
      ]);

      const result = worstCaseAnalyzer.runAnalysis(linearFn);

      expect(result.minResult).toBeLessThanOrEqual(result.nominal);
      expect(result.maxResult).toBeGreaterThanOrEqual(result.nominal);
    });
  });

  // ---- Edge cases ----

  describe('edge cases', () => {
    it('should throw when no parameters are defined', () => {
      expect(() => {
        worstCaseAnalyzer.runAnalysis(() => 42);
      }).toThrow('No parameters defined');
    });

    it('should handle zero tolerance', () => {
      worstCaseAnalyzer.defineParameters([
        { id: 'A', name: 'A', nominal: 100, tolerance: 0, toleranceType: 'absolute' },
      ]);

      const result = worstCaseAnalyzer.runAnalysis((v) => v['A']! * 2);

      // All corners should be the same as nominal
      expect(result.nominal).toBe(200);
      for (const corner of result.corners) {
        expect(corner.result).toBeCloseTo(200, 5);
      }
      expect(result.spread).toBeCloseTo(0, 5);
    });

    it('should handle zero percentage tolerance', () => {
      worstCaseAnalyzer.defineParameters([
        { id: 'A', name: 'A', nominal: 100, tolerance: 0, toleranceType: 'percentage' },
      ]);

      const result = worstCaseAnalyzer.runAnalysis((v) => v['A']!);
      expect(result.spread).toBeCloseTo(0, 5);
    });

    it('should handle single parameter', () => {
      worstCaseAnalyzer.defineParameters([
        { id: 'X', name: 'X', nominal: 50, tolerance: 5, toleranceType: 'absolute' },
      ]);

      const result = worstCaseAnalyzer.runAnalysis((v) => v['X']! * 2);

      expect(result.corners).toHaveLength(5); // nominal, all_min, all_max, rss_min, rss_max
      expect(result.nominal).toBe(100);
    });

    it('should produce all 5 corner types', () => {
      worstCaseAnalyzer.defineParameters([
        { id: 'A', name: 'A', nominal: 10, tolerance: 1, toleranceType: 'absolute' },
      ]);

      const result = worstCaseAnalyzer.runAnalysis((v) => v['A']!);
      const types = result.corners.map((c) => c.type).sort();
      const expected: CornerType[] = ['all_max', 'all_min', 'nominal', 'rss_max', 'rss_min'];
      expect(types).toEqual(expected);
    });

    it('should handle negative nominal values', () => {
      worstCaseAnalyzer.defineParameters([
        { id: 'V', name: 'V', nominal: -5, tolerance: 0.1, toleranceType: 'percentage' },
      ]);

      const result = worstCaseAnalyzer.runAnalysis((v) => v['V']!);

      // Delta = |-5| * 0.1 = 0.5
      // Min = -5 - 0.5 = -5.5, Max = -5 + 0.5 = -4.5
      const allMin = result.corners.find((c) => c.type === 'all_min')!;
      const allMax = result.corners.find((c) => c.type === 'all_max')!;
      expect(allMin.values['V']).toBeCloseTo(-5.5);
      expect(allMax.values['V']).toBeCloseTo(-4.5);
    });

    it('should handle very small nominal values', () => {
      worstCaseAnalyzer.defineParameters([
        { id: 'C1', name: 'C1', nominal: 1e-12, tolerance: 0.2, toleranceType: 'percentage' },
      ]);

      const result = worstCaseAnalyzer.runAnalysis((v) => v['C1']! * 1e12);

      expect(result.nominal).toBeCloseTo(1, 5);
      const allMin = result.corners.find((c) => c.type === 'all_min')!;
      expect(allMin.result).toBeCloseTo(0.8, 5);
    });

    it('should handle many parameters', () => {
      const params: WCAParameter[] = [];
      for (let i = 0; i < 20; i++) {
        params.push({
          id: `P${i}`,
          name: `Param ${i}`,
          nominal: 100 + i,
          tolerance: 5,
          toleranceType: 'absolute',
        });
      }
      worstCaseAnalyzer.defineParameters(params);

      const result = worstCaseAnalyzer.runAnalysis((values) => {
        let sum = 0;
        for (const p of params) {
          sum += values[p.id]!;
        }
        return sum;
      });

      expect(result.corners).toHaveLength(5);
      expect(result.sensitivities).toHaveLength(20);
      expect(result.spread).toBeGreaterThan(0);
    });
  });

  // ---- Running state ----

  describe('running state', () => {
    it('should set running=false after successful analysis', () => {
      worstCaseAnalyzer.defineParameters([
        { id: 'A', name: 'A', nominal: 10, tolerance: 1, toleranceType: 'absolute' },
      ]);

      worstCaseAnalyzer.runAnalysis((v) => v['A']!);
      expect(worstCaseAnalyzer.getState().running).toBe(false);
    });

    it('should set running=false after failed analysis', () => {
      worstCaseAnalyzer.defineParameters([
        { id: 'A', name: 'A', nominal: 10, tolerance: 1, toleranceType: 'absolute' },
      ]);

      try {
        worstCaseAnalyzer.runAnalysis(() => {
          throw new Error('eval error');
        });
      } catch {
        // expected
      }

      expect(worstCaseAnalyzer.getState().running).toBe(false);
    });

    it('should store result in state after successful run', () => {
      worstCaseAnalyzer.defineParameters([
        { id: 'A', name: 'A', nominal: 10, tolerance: 1, toleranceType: 'absolute' },
      ]);

      const result = worstCaseAnalyzer.runAnalysis((v) => v['A']!);
      expect(worstCaseAnalyzer.getState().result).toBe(result);
    });
  });

  // ---- Reset ----

  describe('_reset', () => {
    it('should clear all state', () => {
      worstCaseAnalyzer.defineParameters([
        { id: 'A', name: 'A', nominal: 10, tolerance: 1, toleranceType: 'absolute' },
      ]);
      worstCaseAnalyzer.runAnalysis((v) => v['A']!);

      worstCaseAnalyzer._reset();

      const state = worstCaseAnalyzer.getState();
      expect(state.parameters).toEqual([]);
      expect(state.result).toBeNull();
      expect(state.running).toBe(false);
    });
  });
});
