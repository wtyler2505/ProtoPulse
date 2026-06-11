import { describe, expect, it } from 'vitest';
import {
  formatConfidencePercent,
  formatTrustLevelLabel,
  trustLevelToKind,
} from '../trust-provenance';

describe('trust provenance helpers', () => {
  it('maps source trust levels to reusable UI trust kinds', () => {
    expect(trustLevelToKind('manufacturer_verified')).toBe('verified');
    expect(trustLevelToKind('protopulse_gold')).toBe('verified');
    expect(trustLevelToKind('verified')).toBe('verified');
    expect(trustLevelToKind('library')).toBe('estimated');
    expect(trustLevelToKind('community')).toBe('estimated');
    expect(trustLevelToKind('user')).toBe('unverified');
    expect(trustLevelToKind(null)).toBe('unverified');
  });

  it('formats source labels and confidence percentages consistently', () => {
    expect(formatTrustLevelLabel('manufacturer_verified')).toBe('manufacturer verified');
    expect(formatTrustLevelLabel(undefined, 'no source')).toBe('no source');
    expect(formatConfidencePercent(0.876, { suffix: 'match' })).toBe('88% match');
    expect(formatConfidencePercent(Number.NaN, { fallback: 'score pending' })).toBe('score pending');
  });
});
