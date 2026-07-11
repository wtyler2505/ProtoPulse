/**
 * BL-0781 — NumberInput migration ARIA contract for SupplierDrawer.
 *
 * The comparison-quantity spinbutton has a real `min={1}` (comparison quantity
 * can't be zero or negative) but intentionally no `max` — bulk-buy comparisons
 * can legitimately exceed any fixed ceiling (audit row: OMIT-MAX). Per the
 * NumberInput contract, that means `aria-valuemax`/`max` must be absent
 * entirely rather than synthesized as `0` (the Chromium a11y bug BL-0781 fixes).
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SupplierDrawer } from '../SupplierDrawer';

describe('SupplierDrawer — NumberInput ARIA contract (BL-0781)', () => {
  it('renders the comparison-quantity spinbutton with min mirrored but max omitted', () => {
    render(<SupplierDrawer open onOpenChange={vi.fn()} />);

    const quantityInput = screen.getByTestId('input-comparison-quantity');
    expect(quantityInput.getAttribute('type')).toBe('number');

    // KEEP min={1} — real lower bound (quantity can't be zero/negative)
    expect(quantityInput.getAttribute('min')).toBe('1');
    expect(quantityInput.getAttribute('aria-valuemin')).toBe('1');

    // OMIT-MAX — no domain ceiling exists (bulk quantities are unbounded);
    // the primitive must NOT synthesize aria-valuemax="0"
    expect(quantityInput.hasAttribute('max')).toBe(false);
    expect(quantityInput.hasAttribute('aria-valuemax')).toBe(false);
  });
});
