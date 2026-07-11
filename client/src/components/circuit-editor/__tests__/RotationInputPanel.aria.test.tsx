/**
 * ARIA contract test for RotationInputPanel's NumberInput migration
 * (BL-0781 — docs/audits/bl-0781-number-input-audit.md).
 *
 * Single instance, KEEP min={0} max={359} — already-numeric drop-in swap.
 * The mirrored aria-valuemin/aria-valuemax are the RED->GREEN witness: a raw
 * `<input type="number" min={0} max={359}>` never gets `aria-valuemin`/
 * `aria-valuemax` DOM attributes (Chromium synthesizes ARIA bounds only in the
 * real accessibility tree, which happy-dom doesn't reproduce), so these
 * assertions are absent pre-migration and present post-migration.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { RotationInputPanel } from '../RotationInputPanel';

describe('RotationInputPanel — NumberInput ARIA contract (BL-0781)', () => {
  it('angle input mirrors min={0} max={359}', () => {
    render(<RotationInputPanel angle={45} onChange={vi.fn()} />);
    const el = screen.getByTestId('rotation-angle-input');
    expect(el.getAttribute('aria-valuemin')).toBe('0');
    expect(el.getAttribute('aria-valuemax')).toBe('359');
    expect(el.getAttribute('aria-valuenow')).toBe('45');
    expect(el.getAttribute('min')).toBe('0');
    expect(el.getAttribute('max')).toBe('359');
  });
});
