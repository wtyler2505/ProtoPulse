import { describe, expect, it } from 'vitest';
import { asUnverified, asVerified, isUnverified, normalizeTrustBoundary } from '@/types/TrustBoundaries';

describe('TrustBoundaries', () => {
  it('builds verified and unverified envelopes with explicit trust metadata', () => {
    const verified = asVerified(2.5, 'live_supplier_api');
    const unverified = asUnverified(2.5, 'historical_estimate', { isMock: true, note: 'fallback' });

    expect(verified).toEqual({
      value: 2.5,
      source: 'live_supplier_api',
      note: undefined,
      verified: true,
    });
    expect(unverified).toEqual({
      value: 2.5,
      source: 'historical_estimate',
      note: 'fallback',
      verified: false,
      isMock: true,
    });
  });

  it('detects unverified values even when the input is unknown', () => {
    expect(isUnverified({ verified: false, value: 1, source: 'fallback_unknown', isMock: true })).toBe(true);
    expect(isUnverified({ verified: true, value: 1, source: 'live_supplier_api' })).toBe(false);
    expect(isUnverified(null)).toBe(false);
    expect(isUnverified('bad')).toBe(false);
  });

  it('normalizes missing trust values to an explicit unverified fallback', () => {
    const fallback = asUnverified(0, 'fallback_unknown', { note: 'missing', isMock: true });
    const normalized = normalizeTrustBoundary(undefined, fallback);
    expect(normalized).toEqual(fallback);
    expect(isUnverified(normalized)).toBe(true);
  });
});
