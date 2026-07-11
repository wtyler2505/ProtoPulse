/**
 * ARIA contract test for BusPinMappingDialog's NumberInput migration
 * (BL-0781 — docs/audits/bl-0781-number-input-audit.md).
 *
 * Single instance, KEEP min={1} max={64} — already-numeric drop-in swap.
 * The mirrored aria-valuemin/aria-valuemax are the RED->GREEN witness: a raw
 * `<input type="number" min={1} max={64}>` never gets `aria-valuemin`/
 * `aria-valuemax` DOM attributes (Chromium synthesizes ARIA bounds only in the
 * real accessibility tree, which happy-dom doesn't reproduce), so these
 * assertions are absent pre-migration and present post-migration.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import BusPinMappingDialog from '../BusPinMappingDialog';

describe('BusPinMappingDialog — NumberInput ARIA contract (BL-0781)', () => {
  it('bus width input mirrors min={1} max={64}', () => {
    render(<BusPinMappingDialog open onOpenChange={vi.fn()} nets={[]} onApply={vi.fn()} />);
    const el = screen.getByTestId('bus-width-input');
    expect(el.getAttribute('aria-valuemin')).toBe('1');
    expect(el.getAttribute('aria-valuemax')).toBe('64');
    expect(el.getAttribute('min')).toBe('1');
    expect(el.getAttribute('max')).toBe('64');
  });
});
