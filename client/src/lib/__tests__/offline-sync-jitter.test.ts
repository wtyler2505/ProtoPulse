/**
 * Offline Sync Retry Jitter Tests
 *
 * Validates the addJitter() function used by OfflineSyncManager to prevent
 * thundering-herd effects when multiple clients retry simultaneously.
 */

import { describe, expect, it, vi } from 'vitest';

import { addJitter } from '@/lib/offline-sync';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Collect N jittered samples for a given base / percent. */
function collectSamples(
  base: number,
  jitterPercent: number | undefined,
  count: number,
): number[] {
  const results: number[] = [];
  for (let i = 0; i < count; i++) {
    results.push(jitterPercent === undefined ? addJitter(base) : addJitter(base, jitterPercent));
  }
  return results;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('addJitter', () => {
  // -------------------------------------------------------------------------
  // Range validation
  // -------------------------------------------------------------------------

  it('produces values within ±20% of base with default jitter', () => {
    const base = 1000;
    const samples = collectSamples(base, undefined, 200);
    const lo = base * 0.8;
    const hi = base * 1.2;
    for (const s of samples) {
      expect(s).toBeGreaterThanOrEqual(lo);
      expect(s).toBeLessThanOrEqual(hi);
    }
  });

  it('produces values within ±50% when jitterPercent is 0.5', () => {
    const base = 2000;
    const samples = collectSamples(base, 0.5, 200);
    const lo = base * 0.5;
    const hi = base * 1.5;
    for (const s of samples) {
      expect(s).toBeGreaterThanOrEqual(lo);
      expect(s).toBeLessThanOrEqual(hi);
    }
  });

  it('produces values within ±10% when jitterPercent is 0.1', () => {
    const base = 5000;
    const samples = collectSamples(base, 0.1, 200);
    const lo = base * 0.9;
    const hi = base * 1.1;
    for (const s of samples) {
      expect(s).toBeGreaterThanOrEqual(lo);
      expect(s).toBeLessThanOrEqual(hi);
    }
  });

  // -------------------------------------------------------------------------
  // Non-determinism
  // -------------------------------------------------------------------------

  it('multiple calls produce different values (not deterministic)', () => {
    const samples = collectSamples(10_000, undefined, 50);
    const unique = new Set(samples);
    // With 50 samples on a 10 000ms base, we'd expect many distinct values
    expect(unique.size).toBeGreaterThan(1);
  });

  it('produces a reasonable spread across the range', () => {
    const base = 10_000;
    const samples = collectSamples(base, undefined, 500);
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    // Spread should cover a meaningful portion of the ±20% window (4 000ms)
    expect(max - min).toBeGreaterThan(base * 0.1);
  });

  // -------------------------------------------------------------------------
  // Configurable percentage
  // -------------------------------------------------------------------------

  it('uses default jitter of 20% when no percent is given', () => {
    // Mock Math.random to return 0 → minimum jitter (1 - 0.2 = 0.8)
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(addJitter(1000)).toBe(Math.round(1000 * 0.8));
    spy.mockReturnValue(1);
    expect(addJitter(1000)).toBe(Math.round(1000 * 1.2));
    spy.mockRestore();
  });

  it('respects custom jitterPercent = 0.5', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(addJitter(1000, 0.5)).toBe(Math.round(1000 * 0.5));
    spy.mockReturnValue(1);
    expect(addJitter(1000, 0.5)).toBe(Math.round(1000 * 1.5));
    spy.mockRestore();
  });

  it('respects custom jitterPercent = 0', () => {
    // Zero jitter → always returns base
    const samples = collectSamples(3000, 0, 20);
    for (const s of samples) {
      expect(s).toBe(3000);
    }
  });

  it('respects custom jitterPercent = 1.0 (full range)', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(addJitter(1000, 1.0)).toBe(Math.round(1000 * 0)); // 0
    spy.mockReturnValue(1);
    expect(addJitter(1000, 1.0)).toBe(Math.round(1000 * 2.0)); // 2000
    spy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  it('returns zero when base is zero', () => {
    expect(addJitter(0)).toBe(0);
    expect(addJitter(0, 0.5)).toBe(0);
    expect(addJitter(0, 1.0)).toBe(0);
  });

  it('clamps negative jitterPercent to 0 (no jitter)', () => {
    const samples = collectSamples(1000, -0.5, 20);
    for (const s of samples) {
      expect(s).toBe(1000);
    }
  });

  it('clamps jitterPercent above 1 to 1', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    // jitterPercent=2.0 clamped to 1.0 → factor = 1 + (0*2-1)*1 = 0 → result = 0
    expect(addJitter(1000, 2.0)).toBe(0);
    spy.mockReturnValue(1);
    // factor = 1 + (1*2-1)*1 = 2 → result = 2000
    expect(addJitter(1000, 2.0)).toBe(2000);
    spy.mockRestore();
  });

  it('returns integer values (rounded)', () => {
    const samples = collectSamples(1337, undefined, 100);
    for (const s of samples) {
      expect(Number.isInteger(s)).toBe(true);
    }
  });

  it('handles very small base values', () => {
    const samples = collectSamples(1, undefined, 100);
    for (const s of samples) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(2);
    }
  });

  it('handles very large base values', () => {
    const base = 1_000_000;
    const samples = collectSamples(base, undefined, 100);
    for (const s of samples) {
      expect(s).toBeGreaterThanOrEqual(base * 0.8);
      expect(s).toBeLessThanOrEqual(base * 1.2);
    }
  });

  // -------------------------------------------------------------------------
  // Deterministic Math.random mock scenarios
  // -------------------------------------------------------------------------

  it('returns exact base when Math.random returns 0.5 (midpoint)', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    // factor = 1 + (0.5*2 - 1)*0.2 = 1 + 0*0.2 = 1.0
    expect(addJitter(1000)).toBe(1000);
    spy.mockRestore();
  });

  it('returns lower bound when Math.random returns 0', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    // factor = 1 + (0*2 - 1)*0.2 = 1 - 0.2 = 0.8
    expect(addJitter(1000)).toBe(800);
    spy.mockRestore();
  });

  it('returns upper bound when Math.random returns 1', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(1);
    // factor = 1 + (1*2 - 1)*0.2 = 1 + 0.2 = 1.2
    expect(addJitter(1000)).toBe(1200);
    spy.mockRestore();
  });
});
