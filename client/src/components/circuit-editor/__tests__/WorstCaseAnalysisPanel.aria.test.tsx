/**
 * ARIA contract tests for WorstCaseAnalysisPanel's NumberInput migration
 * (BL-0781 — docs/audits/bl-0781-number-input-audit.md).
 *
 * Covers 2 of 2 instances:
 *   - wca-param-nominal: OMIT-MAX, no min — pure contract lock (no aria-valuemax
 *     synthesized, matching the primitive's WAI-ARIA-1.2 omission behavior).
 *   - wca-param-tolerance: OMIT-MAX; KEEP min [STRING→NUM] (`min="0"` -> `min={0}`).
 *     The `aria-valuemin="0"` mirror is the RED->GREEN witness: a raw
 *     `<input type="number" min="0">` never gets an `aria-valuemin` DOM attribute
 *     (Chromium synthesizes ARIA bounds only in the real accessibility tree, which
 *     happy-dom does not reproduce), so this assertion is absent -> present across
 *     the migration and also proves the string->number conversion actually landed
 *     (a string `min` silently fails NumberInput's `typeof min === 'number'` gate).
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { WorstCaseAnalysisPanel } from '../WorstCaseAnalysisPanel';

describe('WorstCaseAnalysisPanel — NumberInput ARIA contract (BL-0781)', () => {
  it('nominal field omits aria-valuemax and max (no ceiling on this field)', () => {
    render(<WorstCaseAnalysisPanel />);
    const nominal = screen.getByTestId('wca-param-nominal');
    expect(nominal.hasAttribute('aria-valuemax')).toBe(false);
    expect(nominal.hasAttribute('max')).toBe(false);
  });

  it('tolerance field mirrors min={0} onto aria-valuemin (STRING->NUM conversion witness)', () => {
    render(<WorstCaseAnalysisPanel />);
    const tolerance = screen.getByTestId('wca-param-tolerance');
    expect(tolerance.getAttribute('aria-valuemin')).toBe('0');
    expect(tolerance.getAttribute('min')).toBe('0');
    // Still no max — dual-mode %/absolute bound can't be statically ceilinged.
    expect(tolerance.hasAttribute('aria-valuemax')).toBe(false);
    expect(tolerance.hasAttribute('max')).toBe(false);
  });
});
