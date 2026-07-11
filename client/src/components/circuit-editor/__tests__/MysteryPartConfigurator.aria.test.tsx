/**
 * ARIA contract tests for MysteryPartConfigurator's NumberInput migration
 * (BL-0781 — docs/audits/bl-0781-number-input-audit.md).
 *
 * All 3 instances are KEEP — already-numeric drop-in swaps:
 *   - pin count: MYSTERY_PART_MIN_PINS/MAX_PINS constants (2/40)
 *   - body width / body height: min={1} max={20}
 * The mirrored aria-valuemin/aria-valuemax are the RED->GREEN witness: a raw
 * `<input type="number" min={1} max={20}>` never gets `aria-valuemin`/
 * `aria-valuemax` DOM attributes (Chromium synthesizes ARIA bounds only in the
 * real accessibility tree, which happy-dom doesn't reproduce), so these
 * assertions are absent pre-migration and present post-migration.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { MysteryPartConfigurator } from '../MysteryPartConfigurator';
import { MYSTERY_PART_MIN_PINS, MYSTERY_PART_MAX_PINS } from '@shared/component-types';

describe('MysteryPartConfigurator — NumberInput ARIA contract (BL-0781)', () => {
  it('pin count field mirrors MYSTERY_PART_MIN_PINS/MAX_PINS constants', () => {
    render(<MysteryPartConfigurator open onOpenChange={vi.fn()} onApply={vi.fn()} />);
    const el = screen.getByTestId('mystery-pin-count');
    expect(el.getAttribute('aria-valuemin')).toBe(String(MYSTERY_PART_MIN_PINS));
    expect(el.getAttribute('aria-valuemax')).toBe(String(MYSTERY_PART_MAX_PINS));
  });

  it('body width / body height fields mirror min={1} max={20}', () => {
    render(<MysteryPartConfigurator open onOpenChange={vi.fn()} onApply={vi.fn()} />);
    const width = screen.getByTestId('mystery-body-width');
    expect(width.getAttribute('aria-valuemin')).toBe('1');
    expect(width.getAttribute('aria-valuemax')).toBe('20');

    const height = screen.getByTestId('mystery-body-height');
    expect(height.getAttribute('aria-valuemin')).toBe('1');
    expect(height.getAttribute('aria-valuemax')).toBe('20');
  });
});
