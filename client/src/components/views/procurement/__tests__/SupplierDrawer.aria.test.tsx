/**
 * SupplierDrawer — BL-0781 ARIA spinbutton contract.
 *
 * Asserts that the comparison-quantity number input mirrors `min`/`max` props
 * to `aria-valuemin`/`aria-valuemax` per the WAI-ARIA 1.2 spinbutton spec —
 * fixing the Chromium synthesized `aria-valuemax="0"` accessibility bug
 * (E2E-236/271/284).
 *
 * Migration plan: docs/audits/bl-0781-number-input-audit.md (Teammate 5 →
 * SupplierDrawer.tsx). Action: ADD-MAX, max=999_999, on the quantity input.
 */

// @vitest-environment happy-dom

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { SupplierDrawer } from '../SupplierDrawer';

describe('SupplierDrawer — BL-0781 ARIA spinbutton contract', () => {
  it('mirrors min={1} max={999_999} onto aria-valuemin/aria-valuemax for comparison-quantity input', () => {
    render(<SupplierDrawer open={true} onOpenChange={() => {}} />);
    const input = screen.getByTestId('input-comparison-quantity') as HTMLInputElement;
    expect(input.getAttribute('type')).toBe('number');
    expect(input.getAttribute('aria-valuemin')).toBe('1');
    expect(input.getAttribute('aria-valuemax')).toBe('999999');
    expect(input.getAttribute('min')).toBe('1');
    expect(input.getAttribute('max')).toBe('999999');
  });
});
