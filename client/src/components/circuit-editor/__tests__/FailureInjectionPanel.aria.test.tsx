/**
 * ARIA contract tests for FailureInjectionPanel's NumberInput migration
 * (BL-0781 — docs/audits/bl-0781-number-input-audit.md).
 *
 * All 3 instances in this file are OMIT-MAX with no min (noise amplitude,
 * drift percent, PRNG seed) — the audit table calls these pure omissions with
 * no genuine domain ceiling. Unlike files where the migration adds a mirrored
 * aria-valuemin/aria-valuemax attribute, these fields have nothing added by the
 * migration: a raw `<input type="number">` and a `<NumberInput>` with no
 * min/max are DOM-identical in happy-dom (the Chromium `aria-valuemax="0"`
 * bug this migration fixes is accessibility-tree synthesis in the real
 * browser, which happy-dom does not reproduce). So these assertions cannot
 * show RED before the migration and GREEN after — they are contract locks
 * proving the primitive's omission behavior holds post-migration, not
 * RED->GREEN witnesses. See BL-0781 migration report for the full breakdown.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FailureInjectionPanel } from '../FailureInjectionPanel';

const COMPONENTS = { R1: 'R1 — 10k Resistor', U1: 'U1 — ESP32' };

describe('FailureInjectionPanel — NumberInput ARIA contract (BL-0781)', () => {
  it('noise amplitude and seed fields omit aria-valuemax/max and aria-valuemin/min', async () => {
    const user = userEvent.setup();
    render(<FailureInjectionPanel components={COMPONENTS} />);

    await user.click(screen.getByTestId('fault-add-button'));
    await user.click(screen.getByTestId('fault-form-type'));
    await user.click(await screen.findByText('Noisy Sensor'));

    const amplitude = await screen.findByTestId('fault-form-noise-amplitude');
    expect(amplitude.hasAttribute('aria-valuemax')).toBe(false);
    expect(amplitude.hasAttribute('max')).toBe(false);
    expect(amplitude.hasAttribute('aria-valuemin')).toBe(false);
    expect(amplitude.hasAttribute('min')).toBe(false);

    const seed = screen.getByTestId('fault-form-seed');
    expect(seed.hasAttribute('aria-valuemax')).toBe(false);
    expect(seed.hasAttribute('max')).toBe(false);
    expect(seed.hasAttribute('aria-valuemin')).toBe(false);
    expect(seed.hasAttribute('min')).toBe(false);
  });

  it('drift percent field omits aria-valuemax/max and aria-valuemin/min', async () => {
    const user = userEvent.setup();
    render(<FailureInjectionPanel components={COMPONENTS} />);

    await user.click(screen.getByTestId('fault-add-button'));
    await user.click(screen.getByTestId('fault-form-type'));
    await user.click(await screen.findByText('Value Drift'));

    const drift = await screen.findByTestId('fault-form-drift-percent');
    expect(drift.hasAttribute('aria-valuemax')).toBe(false);
    expect(drift.hasAttribute('max')).toBe(false);
    expect(drift.hasAttribute('aria-valuemin')).toBe(false);
    expect(drift.hasAttribute('min')).toBe(false);
  });
});
