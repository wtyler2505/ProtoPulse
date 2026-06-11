/// <reference lib="dom" />

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/simulation/worst-case-analysis', () => {
  const stableState = { parameters: [], result: null, running: false };
  return {
    worstCaseAnalyzer: {
      getState: () => stableState,
      subscribe: () => () => {},
      addParameter: () => {},
      removeParameter: () => {},
      updateParameter: () => {},
      run: () => {},
      clear: () => {},
    },
  };
});

import { WorstCaseAnalysisPanel } from '../WorstCaseAnalysisPanel';

describe('WorstCaseAnalysisPanel — BL-0781 ARIA spinbutton contract', () => {
  it('omits aria-valuemin/aria-valuemax and HTML min/max on wca-param-nominal (OMIT-MAX/OMIT-MIN)', () => {
    render(<WorstCaseAnalysisPanel />);
    const input = screen.getByTestId('wca-param-nominal') as HTMLInputElement;

    expect(input.hasAttribute('aria-valuemax')).toBe(false);
    expect(input.hasAttribute('aria-valuemin')).toBe(false);
    expect(input.getAttribute('max')).toBe(null);
    expect(input.getAttribute('min')).toBe(null);
    // Regression guard: must NOT synthesize "0" via raw input
    expect(input.getAttribute('aria-valuemax')).not.toBe('0');
  });

  it('mirrors min={0}/max={100} to aria-valuemin/aria-valuemax on wca-param-tolerance (default toleranceType=percentage)', () => {
    render(<WorstCaseAnalysisPanel />);
    const input = screen.getByTestId('wca-param-tolerance') as HTMLInputElement;

    // Default toleranceType is 'percentage' (EMPTY_FORM.toleranceType), so max=100
    expect(input.getAttribute('aria-valuemin')).toBe('0');
    expect(input.getAttribute('aria-valuemax')).toBe('100');
    expect(input.getAttribute('min')).toBe('0');
    expect(input.getAttribute('max')).toBe('100');
  });
});
