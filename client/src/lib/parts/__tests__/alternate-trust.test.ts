import { describe, expect, it } from 'vitest';
import {
  alternateTrustKind,
  describeAlternateMatchReason,
  describeAlternateTradeoff,
  formatAlternateMatchScore,
  formatAlternateTrustLabel,
} from '../alternate-trust';

describe('alternate trust helpers', () => {
  it('maps catalog trust levels into UI trust kinds', () => {
    expect(alternateTrustKind('manufacturer_verified')).toBe('verified');
    expect(alternateTrustKind('protopulse_gold')).toBe('verified');
    expect(alternateTrustKind('verified')).toBe('verified');
    expect(alternateTrustKind('library')).toBe('estimated');
    expect(alternateTrustKind('community')).toBe('estimated');
    expect(alternateTrustKind('user')).toBe('unverified');
    expect(alternateTrustKind(undefined)).toBe('unverified');
  });

  it('formats trust labels and match scores for dense UI', () => {
    expect(formatAlternateTrustLabel('manufacturer_verified')).toBe('manufacturer verified');
    expect(formatAlternateTrustLabel(null)).toBe('unknown trust');
    expect(formatAlternateMatchScore(0.923)).toBe('92% match');
    expect(formatAlternateMatchScore(undefined)).toBe('match pending');
  });

  it('describes match reason by score band', () => {
    expect(describeAlternateMatchReason({ matchScore: 0.95 })).toContain('Strong catalog match');
    expect(describeAlternateMatchReason({ matchScore: 0.75 })).toContain('Likely functional substitute');
    expect(describeAlternateMatchReason({ matchScore: 0.42 })).toContain('Candidate substitute only');
  });

  it('describes manufacturer, category, and trust tradeoffs', () => {
    expect(
      describeAlternateTradeoff({
        manufacturer: 'Yageo',
        canonicalCategory: 'resistor',
        trustLevel: 'library',
      }),
    ).toBe('Yageo part in resistor; trust source is library.');
  });
});
