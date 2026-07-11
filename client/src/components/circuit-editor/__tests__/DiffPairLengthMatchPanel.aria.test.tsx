/**
 * ARIA contract tests for DiffPairLengthMatchPanel's NumberInput migration
 * (BL-0781 — docs/audits/bl-0781-number-input-audit.md).
 *
 * All 3 instances (target delta, max meander amplitude, serpentine spacing)
 * are OMIT-MAX with an existing numeric min. The mirrored `aria-valuemin` is
 * the RED->GREEN witness: a raw `<input type="number" min={0.1}>` never gets
 * an `aria-valuemin` DOM attribute (Chromium synthesizes ARIA bounds only in
 * the real accessibility tree, which happy-dom doesn't reproduce), so this
 * assertion is absent pre-migration and present post-migration.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DiffPairLengthMatchPanel } from '../DiffPairLengthMatchPanel';

describe('DiffPairLengthMatchPanel — NumberInput ARIA contract (BL-0781)', () => {
  it('target delta / max amplitude / spacing fields mirror their numeric min onto aria-valuemin', async () => {
    const user = userEvent.setup();
    render(<DiffPairLengthMatchPanel pairs={[]} />);
    await user.click(screen.getByTestId('length-match-settings-btn'));

    const targetDelta = await screen.findByTestId('target-delta-input');
    expect(targetDelta.getAttribute('aria-valuemin')).toBe('0');
    expect(targetDelta.hasAttribute('aria-valuemax')).toBe(false);
    expect(targetDelta.hasAttribute('max')).toBe(false);

    const maxAmplitude = screen.getByTestId('max-amplitude-input');
    expect(maxAmplitude.getAttribute('aria-valuemin')).toBe('0.1');
    expect(maxAmplitude.hasAttribute('aria-valuemax')).toBe(false);

    const spacing = screen.getByTestId('spacing-input');
    expect(spacing.getAttribute('aria-valuemin')).toBe('0.1');
    expect(spacing.hasAttribute('aria-valuemax')).toBe(false);
  });
});
