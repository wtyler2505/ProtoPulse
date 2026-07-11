/**
 * ARIA contract tests for NetClassPanel's NumberInput migration
 * (BL-0781 — docs/audits/bl-0781-number-input-audit.md).
 *
 * All 3 instances (trace width, clearance, via diameter) are OMIT-MAX with an
 * existing numeric min. The mirrored `aria-valuemin` is the RED->GREEN
 * witness: a raw `<input type="number" min={0.01}>` never gets an
 * `aria-valuemin` DOM attribute (Chromium synthesizes ARIA bounds only in the
 * real accessibility tree, which happy-dom doesn't reproduce), so this
 * assertion is absent pre-migration and present post-migration.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import NetClassPanel from '../NetClassPanel';

vi.mock('@/lib/contexts/project-id-context', () => ({
  useProjectId: () => 1,
}));

vi.mock('@/lib/circuit-editor/hooks', () => ({
  useCircuitNets: () => ({ data: [] }),
}));

describe('NetClassPanel — NumberInput ARIA contract (BL-0781)', () => {
  it('trace width / clearance / via diameter fields mirror their numeric min onto aria-valuemin', async () => {
    const user = userEvent.setup();
    render(<NetClassPanel circuitId={1} />);
    await user.click(screen.getByTestId('button-add-net-class'));

    const traceWidth = await screen.findByTestId('input-trace-width');
    expect(traceWidth.getAttribute('aria-valuemin')).toBe('0.01');
    expect(traceWidth.hasAttribute('aria-valuemax')).toBe(false);
    expect(traceWidth.hasAttribute('max')).toBe(false);

    const clearance = screen.getByTestId('input-clearance');
    expect(clearance.getAttribute('aria-valuemin')).toBe('0.01');
    expect(clearance.hasAttribute('aria-valuemax')).toBe(false);

    const viaDiameter = screen.getByTestId('input-via-diameter');
    expect(viaDiameter.getAttribute('aria-valuemin')).toBe('0.1');
    expect(viaDiameter.hasAttribute('aria-valuemax')).toBe(false);
  });
});
