import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  failureInjectionManager,
  OPEN_CIRCUIT_RESISTANCE,
  SHORT_CIRCUIT_RESISTANCE,
  DEFAULT_SEED,
} from '../failure-injection';
import type { CreateFaultData, FaultType } from '../failure-injection';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFault(overrides: Partial<CreateFaultData> = {}): CreateFaultData {
  return {
    componentId: 'R1',
    componentName: 'Resistor R1',
    faultType: 'open',
    severity: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FailureInjectionManager', () => {
  beforeEach(() => {
    failureInjectionManager._reset();
  });

  // ---- Singleton ----

  describe('singleton', () => {
    it('exports a singleton instance', () => {
      expect(failureInjectionManager).toBeDefined();
      expect(typeof failureInjectionManager.injectFault).toBe('function');
    });

    it('returns the same instance across imports', async () => {
      const { failureInjectionManager: mgr2 } = await import('../failure-injection');
      expect(mgr2).toBe(failureInjectionManager);
    });
  });

  // ---- Inject / Remove / Clear ----

  describe('inject / remove / clear', () => {
    it('injects a fault and returns a unique ID', () => {
      const id = failureInjectionManager.injectFault(makeFault());
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('lists injected faults', () => {
      failureInjectionManager.injectFault(makeFault({ componentId: 'R1' }));
      failureInjectionManager.injectFault(makeFault({ componentId: 'C1', componentName: 'Cap C1' }));

      const faults = failureInjectionManager.listFaults();
      expect(faults).toHaveLength(2);
      expect(faults[0].componentId).toBe('R1');
      expect(faults[1].componentId).toBe('C1');
    });

    it('gets a fault by ID', () => {
      const id = failureInjectionManager.injectFault(makeFault());
      const fault = failureInjectionManager.getFault(id);
      expect(fault).toBeDefined();
      expect(fault!.id).toBe(id);
      expect(fault!.componentId).toBe('R1');
    });

    it('returns undefined for unknown fault ID', () => {
      expect(failureInjectionManager.getFault('nonexistent')).toBeUndefined();
    });

    it('removes a fault by ID', () => {
      const id = failureInjectionManager.injectFault(makeFault());
      expect(failureInjectionManager.removeFault(id)).toBe(true);
      expect(failureInjectionManager.listFaults()).toHaveLength(0);
    });

    it('returns false when removing a nonexistent fault', () => {
      expect(failureInjectionManager.removeFault('nonexistent')).toBe(false);
    });

    it('clears all faults', () => {
      failureInjectionManager.injectFault(makeFault({ componentId: 'R1' }));
      failureInjectionManager.injectFault(makeFault({ componentId: 'R2' }));
      failureInjectionManager.injectFault(makeFault({ componentId: 'R3' }));

      failureInjectionManager.clearAllFaults();
      expect(failureInjectionManager.listFaults()).toHaveLength(0);
    });

    it('clearAllFaults does not notify when already empty', () => {
      const listener = vi.fn();
      failureInjectionManager.subscribe(listener);

      failureInjectionManager.clearAllFaults();
      expect(listener).not.toHaveBeenCalled();
    });

    it('injects multiple faults with unique IDs', () => {
      const id1 = failureInjectionManager.injectFault(makeFault());
      const id2 = failureInjectionManager.injectFault(makeFault());
      expect(id1).not.toBe(id2);
    });

    it('clamps severity to [0, 1]', () => {
      const id1 = failureInjectionManager.injectFault(makeFault({ severity: -0.5 }));
      const id2 = failureInjectionManager.injectFault(makeFault({ severity: 2.0 }));

      expect(failureInjectionManager.getFault(id1)!.severity).toBe(0);
      expect(failureInjectionManager.getFault(id2)!.severity).toBe(1);
    });
  });

  // ---- Subscribe ----

  describe('subscribe / unsubscribe', () => {
    it('notifies listeners on inject', () => {
      const listener = vi.fn();
      failureInjectionManager.subscribe(listener);

      failureInjectionManager.injectFault(makeFault());
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies listeners on remove', () => {
      const id = failureInjectionManager.injectFault(makeFault());
      const listener = vi.fn();
      failureInjectionManager.subscribe(listener);

      failureInjectionManager.removeFault(id);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies listeners on clearAll', () => {
      failureInjectionManager.injectFault(makeFault());
      const listener = vi.fn();
      failureInjectionManager.subscribe(listener);

      failureInjectionManager.clearAllFaults();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('stops notifying after unsubscribe', () => {
      const listener = vi.fn();
      const unsub = failureInjectionManager.subscribe(listener);

      failureInjectionManager.injectFault(makeFault());
      expect(listener).toHaveBeenCalledTimes(1);

      unsub();
      failureInjectionManager.injectFault(makeFault());
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('version increments on each mutation', () => {
      const v0 = failureInjectionManager.version;

      failureInjectionManager.injectFault(makeFault());
      const v1 = failureInjectionManager.version;
      expect(v1).toBeGreaterThan(v0);

      const id = failureInjectionManager.injectFault(makeFault());
      const v2 = failureInjectionManager.version;
      expect(v2).toBeGreaterThan(v1);

      failureInjectionManager.removeFault(id);
      const v3 = failureInjectionManager.version;
      expect(v3).toBeGreaterThan(v2);
    });

    it('does not increment version on failed remove', () => {
      const v0 = failureInjectionManager.version;
      failureInjectionManager.removeFault('nonexistent');
      expect(failureInjectionManager.version).toBe(v0);
    });
  });

  // ---- Fault Report ----

  describe('getFaultReport', () => {
    it('returns empty report when no faults', () => {
      const report = failureInjectionManager.getFaultReport();
      expect(report.totalFaults).toBe(0);
      expect(report.affectedComponents).toHaveLength(0);
      expect(report.byType.open).toBe(0);
      expect(report.byType.short).toBe(0);
      expect(report.byType.noise).toBe(0);
      expect(report.byType.drift).toBe(0);
      expect(report.byType.intermittent).toBe(0);
    });

    it('correctly counts faults by type', () => {
      failureInjectionManager.injectFault(makeFault({ faultType: 'open' }));
      failureInjectionManager.injectFault(makeFault({ faultType: 'open' }));
      failureInjectionManager.injectFault(makeFault({ faultType: 'short' }));
      failureInjectionManager.injectFault(makeFault({ faultType: 'noise' }));
      failureInjectionManager.injectFault(makeFault({ faultType: 'drift' }));
      failureInjectionManager.injectFault(makeFault({ faultType: 'intermittent' }));

      const report = failureInjectionManager.getFaultReport();
      expect(report.totalFaults).toBe(6);
      expect(report.byType.open).toBe(2);
      expect(report.byType.short).toBe(1);
      expect(report.byType.noise).toBe(1);
      expect(report.byType.drift).toBe(1);
      expect(report.byType.intermittent).toBe(1);
    });

    it('lists unique affected components', () => {
      failureInjectionManager.injectFault(makeFault({ componentId: 'R1', faultType: 'open' }));
      failureInjectionManager.injectFault(makeFault({ componentId: 'R1', faultType: 'noise' }));
      failureInjectionManager.injectFault(makeFault({ componentId: 'C1', componentName: 'Cap C1', faultType: 'short' }));

      const report = failureInjectionManager.getFaultReport();
      expect(report.affectedComponents).toHaveLength(2);
      expect(report.affectedComponents).toContain('R1');
      expect(report.affectedComponents).toContain('C1');
    });
  });

  // ---- applyFaults: Open ----

  describe('applyFaults — open', () => {
    it('sets value to very high resistance at severity=1', () => {
      failureInjectionManager.injectFault(makeFault({ faultType: 'open', severity: 1 }));
      const result = failureInjectionManager.applyFaults({ R1: 1000 });
      expect(result.R1).toBe(OPEN_CIRCUIT_RESISTANCE);
    });

    it('interpolates at partial severity', () => {
      failureInjectionManager.injectFault(makeFault({ faultType: 'open', severity: 0.5 }));
      const result = failureInjectionManager.applyFaults({ R1: 1000 });
      // Midpoint between 1000 and 1e12
      const expected = 1000 + (OPEN_CIRCUIT_RESISTANCE - 1000) * 0.5;
      expect(result.R1).toBeCloseTo(expected, 0);
    });

    it('has no effect at severity=0', () => {
      failureInjectionManager.injectFault(makeFault({ faultType: 'open', severity: 0 }));
      const result = failureInjectionManager.applyFaults({ R1: 1000 });
      expect(result.R1).toBe(1000);
    });
  });

  // ---- applyFaults: Short ----

  describe('applyFaults — short', () => {
    it('sets value to near-zero resistance at severity=1', () => {
      failureInjectionManager.injectFault(makeFault({ faultType: 'short', severity: 1 }));
      const result = failureInjectionManager.applyFaults({ R1: 1000 });
      expect(result.R1).toBeCloseTo(SHORT_CIRCUIT_RESISTANCE, 6);
    });

    it('interpolates at partial severity', () => {
      failureInjectionManager.injectFault(makeFault({ faultType: 'short', severity: 0.5 }));
      const result = failureInjectionManager.applyFaults({ R1: 1000 });
      const expected = 1000 + (SHORT_CIRCUIT_RESISTANCE - 1000) * 0.5;
      expect(result.R1).toBeCloseTo(expected, 2);
    });

    it('has no effect at severity=0', () => {
      failureInjectionManager.injectFault(makeFault({ faultType: 'short', severity: 0 }));
      const result = failureInjectionManager.applyFaults({ R1: 1000 });
      expect(result.R1).toBe(1000);
    });
  });

  // ---- applyFaults: Noise ----

  describe('applyFaults — noise', () => {
    it('adds noise that varies the value', () => {
      failureInjectionManager.injectFault(
        makeFault({ faultType: 'noise', severity: 1, noiseAmplitude: 100, seed: 123 }),
      );
      const result = failureInjectionManager.applyFaults({ R1: 1000 });
      // Value should differ from nominal
      expect(result.R1).not.toBe(1000);
      // But should stay within a reasonable range (noise amplitude = 100, Gaussian can exceed but unlikely for seed 123)
      expect(Math.abs(result.R1 - 1000)).toBeLessThan(500);
    });

    it('produces reproducible noise with same seed', () => {
      failureInjectionManager.injectFault(
        makeFault({ faultType: 'noise', severity: 1, noiseAmplitude: 100, seed: 42 }),
      );
      const result1 = failureInjectionManager.applyFaults({ R1: 1000 });

      failureInjectionManager._reset();
      failureInjectionManager.injectFault(
        makeFault({ faultType: 'noise', severity: 1, noiseAmplitude: 100, seed: 42 }),
      );
      const result2 = failureInjectionManager.applyFaults({ R1: 1000 });

      expect(result1.R1).toBe(result2.R1);
    });

    it('produces different noise with different seeds', () => {
      failureInjectionManager.injectFault(
        makeFault({ faultType: 'noise', severity: 1, noiseAmplitude: 100, seed: 1 }),
      );
      const result1 = failureInjectionManager.applyFaults({ R1: 1000 });

      failureInjectionManager._reset();
      failureInjectionManager.injectFault(
        makeFault({ faultType: 'noise', severity: 1, noiseAmplitude: 100, seed: 999 }),
      );
      const result2 = failureInjectionManager.applyFaults({ R1: 1000 });

      expect(result1.R1).not.toBe(result2.R1);
    });

    it('uses default noise amplitude (10% of nominal) when not specified', () => {
      failureInjectionManager.injectFault(
        makeFault({ faultType: 'noise', severity: 1, seed: 42 }),
      );
      const result = failureInjectionManager.applyFaults({ R1: 1000 });
      // Default amplitude is 100 (10% of 1000). Value should be perturbed.
      expect(result.R1).not.toBe(1000);
    });

    it('uses default seed when none provided', () => {
      failureInjectionManager.injectFault(
        makeFault({ faultType: 'noise', severity: 1, noiseAmplitude: 100 }),
      );
      const result1 = failureInjectionManager.applyFaults({ R1: 1000 });

      failureInjectionManager._reset();
      failureInjectionManager.injectFault(
        makeFault({ faultType: 'noise', severity: 1, noiseAmplitude: 100, seed: DEFAULT_SEED }),
      );
      const result2 = failureInjectionManager.applyFaults({ R1: 1000 });

      // Default seed is 42 = DEFAULT_SEED
      expect(result1.R1).toBe(result2.R1);
    });

    it('scales noise with severity', () => {
      // Full severity
      failureInjectionManager.injectFault(
        makeFault({ faultType: 'noise', severity: 1, noiseAmplitude: 100, seed: 77 }),
      );
      const fullResult = failureInjectionManager.applyFaults({ R1: 1000 });
      const fullDelta = Math.abs(fullResult.R1 - 1000);

      failureInjectionManager._reset();

      // Half severity
      failureInjectionManager.injectFault(
        makeFault({ faultType: 'noise', severity: 0.5, noiseAmplitude: 100, seed: 77 }),
      );
      const halfResult = failureInjectionManager.applyFaults({ R1: 1000 });
      const halfDelta = Math.abs(halfResult.R1 - 1000);

      // Half severity should produce half the delta (same seed => same Gaussian sample)
      expect(halfDelta).toBeCloseTo(fullDelta * 0.5, 6);
    });
  });

  // ---- applyFaults: Drift ----

  describe('applyFaults — drift', () => {
    it('shifts value upward by drift percentage * severity', () => {
      failureInjectionManager.injectFault(
        makeFault({ faultType: 'drift', severity: 1, driftPercent: 0.2 }),
      );
      const result = failureInjectionManager.applyFaults({ R1: 1000 });
      // Shift = |1000| * 0.2 * 1 = 200
      expect(result.R1).toBeCloseTo(1200, 6);
    });

    it('uses default drift (severity * 50%) when driftPercent not specified', () => {
      failureInjectionManager.injectFault(
        makeFault({ faultType: 'drift', severity: 0.6 }),
      );
      const result = failureInjectionManager.applyFaults({ R1: 1000 });
      // Default drift = 0.6 * 0.5 = 0.3, shift = 1000 * 0.3 * 0.6 = 180
      expect(result.R1).toBeCloseTo(1180, 6);
    });

    it('has no effect at severity=0', () => {
      failureInjectionManager.injectFault(
        makeFault({ faultType: 'drift', severity: 0, driftPercent: 0.5 }),
      );
      const result = failureInjectionManager.applyFaults({ R1: 1000 });
      expect(result.R1).toBe(1000);
    });

    it('works with negative nominal values', () => {
      failureInjectionManager.injectFault(
        makeFault({ faultType: 'drift', severity: 1, driftPercent: 0.1 }),
      );
      const result = failureInjectionManager.applyFaults({ R1: -500 });
      // Shift = |-500| * 0.1 * 1 = 50
      expect(result.R1).toBeCloseTo(-450, 6);
    });
  });

  // ---- applyFaults: Intermittent ----

  describe('applyFaults — intermittent', () => {
    it('opens the circuit when PRNG roll < severity', () => {
      // Find a seed where the first roll is < 0.5
      // mulberry32(1) first value: let's test empirically
      failureInjectionManager.injectFault(
        makeFault({ faultType: 'intermittent', severity: 1, seed: 1 }),
      );
      const result = failureInjectionManager.applyFaults({ R1: 1000 });
      // Severity=1 means probability of open is 100%
      expect(result.R1).toBe(OPEN_CIRCUIT_RESISTANCE);
    });

    it('keeps the circuit closed when PRNG roll >= severity', () => {
      failureInjectionManager.injectFault(
        makeFault({ faultType: 'intermittent', severity: 0, seed: 1 }),
      );
      const result = failureInjectionManager.applyFaults({ R1: 1000 });
      // Severity=0 means never open
      expect(result.R1).toBe(1000);
    });

    it('is deterministic with the same seed', () => {
      failureInjectionManager.injectFault(
        makeFault({ faultType: 'intermittent', severity: 0.5, seed: 77 }),
      );
      const result1 = failureInjectionManager.applyFaults({ R1: 1000 });

      failureInjectionManager._reset();
      failureInjectionManager.injectFault(
        makeFault({ faultType: 'intermittent', severity: 0.5, seed: 77 }),
      );
      const result2 = failureInjectionManager.applyFaults({ R1: 1000 });

      expect(result1.R1).toBe(result2.R1);
    });
  });

  // ---- applyFaults: Multiple faults ----

  describe('applyFaults — multiple faults', () => {
    it('applies faults to different components independently', () => {
      failureInjectionManager.injectFault(
        makeFault({ componentId: 'R1', faultType: 'open', severity: 1 }),
      );
      failureInjectionManager.injectFault(
        makeFault({ componentId: 'C1', componentName: 'Cap C1', faultType: 'short', severity: 1 }),
      );

      const result = failureInjectionManager.applyFaults({ R1: 1000, C1: 0.001, R2: 2200 });
      expect(result.R1).toBe(OPEN_CIRCUIT_RESISTANCE);
      expect(result.C1).toBeCloseTo(SHORT_CIRCUIT_RESISTANCE, 6);
      // R2 unaffected
      expect(result.R2).toBe(2200);
    });

    it('stacks multiple faults on the same component', () => {
      // First drift, then more drift
      failureInjectionManager.injectFault(
        makeFault({ componentId: 'R1', faultType: 'drift', severity: 1, driftPercent: 0.1 }),
      );
      failureInjectionManager.injectFault(
        makeFault({ componentId: 'R1', faultType: 'drift', severity: 1, driftPercent: 0.1 }),
      );

      const result = failureInjectionManager.applyFaults({ R1: 1000 });
      // First drift: 1000 + 1000 * 0.1 * 1 = 1100
      // Second drift: 1100 + 1000 * 0.1 * 1 = 1200
      expect(result.R1).toBeCloseTo(1200, 6);
    });

    it('ignores faults for components not in the input', () => {
      failureInjectionManager.injectFault(
        makeFault({ componentId: 'NONEXISTENT', faultType: 'open', severity: 1 }),
      );
      const result = failureInjectionManager.applyFaults({ R1: 1000 });
      expect(result.R1).toBe(1000);
    });

    it('does not mutate the input object', () => {
      failureInjectionManager.injectFault(makeFault({ faultType: 'open', severity: 1 }));
      const input = { R1: 1000 };
      failureInjectionManager.applyFaults(input);
      expect(input.R1).toBe(1000);
    });
  });

  // ---- Edge cases ----

  describe('edge cases', () => {
    it('handles zero-value component for noise fault', () => {
      failureInjectionManager.injectFault(
        makeFault({ faultType: 'noise', severity: 1, noiseAmplitude: 50, seed: 42 }),
      );
      const result = failureInjectionManager.applyFaults({ R1: 0 });
      // Should still add noise (amplitude is explicit, not fraction-based)
      expect(typeof result.R1).toBe('number');
      expect(isFinite(result.R1)).toBe(true);
    });

    it('handles zero-value component for drift fault', () => {
      failureInjectionManager.injectFault(
        makeFault({ faultType: 'drift', severity: 1, driftPercent: 0.5 }),
      );
      const result = failureInjectionManager.applyFaults({ R1: 0 });
      // |0| * 0.5 * 1 = 0, so no change
      expect(result.R1).toBe(0);
    });

    it('handles all fault types in sequence', () => {
      const types: FaultType[] = ['open', 'short', 'noise', 'drift', 'intermittent'];
      for (const ft of types) {
        failureInjectionManager._reset();
        failureInjectionManager.injectFault(
          makeFault({ faultType: ft, severity: 0.5, noiseAmplitude: 10, driftPercent: 0.1, seed: 42 }),
        );
        const result = failureInjectionManager.applyFaults({ R1: 1000 });
        expect(typeof result.R1).toBe('number');
        expect(isFinite(result.R1)).toBe(true);
      }
    });

    it('returns an empty result for empty input', () => {
      failureInjectionManager.injectFault(makeFault({ faultType: 'open', severity: 1 }));
      const result = failureInjectionManager.applyFaults({});
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('preserves optional fields in stored fault', () => {
      const id = failureInjectionManager.injectFault(
        makeFault({ faultType: 'noise', noiseAmplitude: 55, driftPercent: 0.3, seed: 99 }),
      );
      const fault = failureInjectionManager.getFault(id)!;
      expect(fault.noiseAmplitude).toBe(55);
      expect(fault.driftPercent).toBe(0.3);
      expect(fault.seed).toBe(99);
    });

    it('handles undefined optional fields gracefully', () => {
      const id = failureInjectionManager.injectFault(
        makeFault({ faultType: 'noise', severity: 0.5 }),
      );
      const fault = failureInjectionManager.getFault(id)!;
      expect(fault.noiseAmplitude).toBeUndefined();
      expect(fault.driftPercent).toBeUndefined();
      expect(fault.seed).toBeUndefined();
    });
  });
});
