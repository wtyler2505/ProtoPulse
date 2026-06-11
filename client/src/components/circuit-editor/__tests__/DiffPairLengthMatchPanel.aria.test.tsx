/// <reference lib="dom" />

import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/lib/pcb/diff-pair-length-match', () => {
  const stableResults: never[] = [];
  return {
    DiffPairLengthMatcher: {
      instance: () => ({
        targetDelta: 0,
        constraints: { maxAmplitude: 2, spacing: 0.5 },
        subscribe: () => () => {},
        getSnapshot: () => stableResults,
        autoMatchAll: () => {},
        matchSingle: () => ({ pairId: '', before: {}, suggestion: null, achievable: false }),
        setConstraints: () => {},
        get lastResults() {
          return stableResults;
        },
      }),
    },
  };
});

import { DiffPairLengthMatchPanel } from '../DiffPairLengthMatchPanel';

describe('DiffPairLengthMatchPanel — BL-0781 ARIA spinbutton contract', () => {
  it('mirrors min/max on target-delta-input after opening settings', () => {
    render(<DiffPairLengthMatchPanel pairs={[]} />);
    fireEvent.click(screen.getByTestId('length-match-settings-btn'));
    const input = screen.getByTestId('target-delta-input') as HTMLInputElement;

    expect(input.getAttribute('aria-valuemin')).toBe('0');
    expect(input.getAttribute('aria-valuemax')).toBe('100');
    expect(input.getAttribute('min')).toBe('0');
    expect(input.getAttribute('max')).toBe('100');
  });

  it('mirrors min/max on max-amplitude-input after opening settings', () => {
    render(<DiffPairLengthMatchPanel pairs={[]} />);
    fireEvent.click(screen.getByTestId('length-match-settings-btn'));
    const input = screen.getByTestId('max-amplitude-input') as HTMLInputElement;

    expect(input.getAttribute('aria-valuemin')).toBe('0.1');
    expect(input.getAttribute('aria-valuemax')).toBe('100');
    expect(input.getAttribute('min')).toBe('0.1');
    expect(input.getAttribute('max')).toBe('100');
  });

  it('mirrors min/max on spacing-input after opening settings', () => {
    render(<DiffPairLengthMatchPanel pairs={[]} />);
    fireEvent.click(screen.getByTestId('length-match-settings-btn'));
    const input = screen.getByTestId('spacing-input') as HTMLInputElement;

    expect(input.getAttribute('aria-valuemin')).toBe('0.1');
    expect(input.getAttribute('aria-valuemax')).toBe('100');
    expect(input.getAttribute('min')).toBe('0.1');
    expect(input.getAttribute('max')).toBe('100');
  });
});
