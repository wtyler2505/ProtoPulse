/**
 * ARIA contract tests for ImpedanceTraceWidthPanel's NumberInput migration
 * (BL-0781 — docs/audits/bl-0781-number-input-audit.md).
 *
 * All 4 instances are KEEP + [STRING->NUM]: the original `min="X" max="Y"`
 * string literals had to convert to numeric literals (`min={X} max={Y}`)
 * because NumberInput's bound props are typed `number` and gated by
 * `typeof x === 'number'` — a string silently fails that check and both the
 * HTML attribute and its ARIA mirror disappear. The aria-valuemin/aria-valuemax
 * assertions below are RED->GREEN witnesses: a raw `<input type="number"
 * min="1" max="20">` never gets `aria-valuemin`/`aria-valuemax` DOM attributes
 * (that's a Chromium accessibility-tree synthesis behavior happy-dom doesn't
 * reproduce), so these assertions are absent pre-migration and present
 * post-migration — and they would also have caught a botched
 * string-to-number conversion (a leftover `min="1"` would silently produce no
 * mirror at all).
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ImpedanceTraceWidthPanel } from '../ImpedanceTraceWidthPanel';

describe('ImpedanceTraceWidthPanel — NumberInput ARIA contract (BL-0781)', () => {
  it('dielectric constant mirrors min={1} max={20}', () => {
    render(<ImpedanceTraceWidthPanel />);
    const el = screen.getByTestId('input-dielectric-constant');
    expect(el.getAttribute('aria-valuemin')).toBe('1');
    expect(el.getAttribute('aria-valuemax')).toBe('20');
    expect(el.getAttribute('min')).toBe('1');
    expect(el.getAttribute('max')).toBe('20');
  });

  it('dielectric height mirrors min={0.01} max={5}', () => {
    render(<ImpedanceTraceWidthPanel />);
    const el = screen.getByTestId('input-dielectric-height');
    expect(el.getAttribute('aria-valuemin')).toBe('0.01');
    expect(el.getAttribute('aria-valuemax')).toBe('5');
  });

  it('copper thickness mirrors min={0} max={0.5}', () => {
    render(<ImpedanceTraceWidthPanel />);
    const el = screen.getByTestId('input-copper-thickness');
    expect(el.getAttribute('aria-valuemin')).toBe('0');
    expect(el.getAttribute('aria-valuemax')).toBe('0.5');
  });

  it('tolerance mirrors min={0} max={100}', () => {
    render(<ImpedanceTraceWidthPanel />);
    const el = screen.getByTestId('input-tolerance');
    expect(el.getAttribute('aria-valuemin')).toBe('0');
    expect(el.getAttribute('aria-valuemax')).toBe('100');
  });
});
