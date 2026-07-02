/**
 * ARIA contract tests for FunctionGeneratorPanel's NumberInput migration
 * (BL-0781 — docs/audits/bl-0781-number-input-audit.md).
 *
 * 3 instances:
 *   - frequency / amplitude: OMIT-MAX with existing min={0}. The mirrored
 *     aria-valuemin is the RED->GREEN witness: a raw
 *     `<input type="number" min={0}>` never gets an `aria-valuemin` DOM
 *     attribute (Chromium synthesizes ARIA bounds only in the real
 *     accessibility tree, which happy-dom doesn't reproduce), so this
 *     assertion is absent pre-migration and present post-migration.
 *   - DC offset: OMIT-MIN, OMIT-MAX (bipolar, no floor or ceiling) — a pure
 *     contract lock since the migration adds no observable DOM attribute
 *     here.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { FunctionGeneratorPanel } from '../FunctionGeneratorPanel';

describe('FunctionGeneratorPanel — NumberInput ARIA contract (BL-0781)', () => {
  it('frequency field mirrors min={0} and omits aria-valuemax', () => {
    render(<FunctionGeneratorPanel availableNets={[]} />);
    const el = screen.getByTestId('funcgen-frequency-input');
    expect(el.getAttribute('aria-valuemin')).toBe('0');
    expect(el.hasAttribute('aria-valuemax')).toBe(false);
    expect(el.hasAttribute('max')).toBe(false);
  });

  it('amplitude field mirrors min={0} and omits aria-valuemax', () => {
    render(<FunctionGeneratorPanel availableNets={[]} />);
    const el = screen.getByTestId('funcgen-amplitude-input');
    expect(el.getAttribute('aria-valuemin')).toBe('0');
    expect(el.hasAttribute('aria-valuemax')).toBe(false);
    expect(el.hasAttribute('max')).toBe(false);
  });

  it('DC offset field omits both aria-valuemin and aria-valuemax (bipolar, no bound)', () => {
    render(<FunctionGeneratorPanel availableNets={[]} />);
    const el = screen.getByTestId('funcgen-dc-offset-input');
    expect(el.hasAttribute('aria-valuemin')).toBe(false);
    expect(el.hasAttribute('min')).toBe(false);
    expect(el.hasAttribute('aria-valuemax')).toBe(false);
    expect(el.hasAttribute('max')).toBe(false);
  });
});
