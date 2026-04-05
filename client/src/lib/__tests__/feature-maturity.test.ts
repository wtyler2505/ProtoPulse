import { describe, expect, it } from 'vitest';

import {
  getFeatureMaturityLabel,
  getViewFeatureMaturity,
} from '@/lib/feature-maturity';

describe('feature maturity metadata', () => {
  it('returns the expected maturity metadata for trust-sensitive views', () => {
    expect(getViewFeatureMaturity('arduino')).toMatchObject({
      maturity: 'setup_required',
      shortLabel: 'Setup',
    });
    expect(getViewFeatureMaturity('ordering')).toMatchObject({
      maturity: 'advanced',
      shortLabel: 'Advanced',
    });
    expect(getViewFeatureMaturity('output')).toMatchObject({
      maturity: 'setup_required',
      shortLabel: 'Prep',
    });
    expect(getViewFeatureMaturity('community')).toMatchObject({
      maturity: 'experimental',
      shortLabel: 'Beta',
    });
  });

  it('returns user-facing labels for each maturity state', () => {
    expect(getFeatureMaturityLabel('ready')).toBe('Ready');
    expect(getFeatureMaturityLabel('setup_required')).toBe('Setup required');
    expect(getFeatureMaturityLabel('experimental')).toBe('Experimental');
    expect(getFeatureMaturityLabel('advanced')).toBe('Advanced');
  });

  it('returns undefined for views without maturity metadata', () => {
    expect(getViewFeatureMaturity('architecture')).toBeUndefined();
    expect(getViewFeatureMaturity('dashboard')).toBeUndefined();
  });
});
