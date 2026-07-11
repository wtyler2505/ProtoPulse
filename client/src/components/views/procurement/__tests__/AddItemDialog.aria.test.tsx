/**
 * BL-0781 — NumberInput migration ARIA contract for AddItemDialog.
 *
 * Both spinbuttons here were flagged [STRING->NUM] in the audit: the
 * pre-migration bounds were string literals (`min="1"` / `max="999999"`,
 * `min="0"` / `max="99999.99"` / `step="0.01"`). NumberInput's internal gate
 * is `typeof x === 'number' && Number.isFinite(x)` — a string silently fails
 * that check and the bound (and its ARIA mirror) disappears. This test
 * proves the migrated numeric literals are correctly mirrored onto
 * aria-valuemin/aria-valuemax (KEEP action for both rows).
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AddItemDialog, type NewItemValues } from '../AddItemDialog';

const baseNewItem: NewItemValues = {
  partNumber: '',
  manufacturer: '',
  description: '',
  quantity: 1,
  unitPrice: 0,
  supplier: 'Digi-Key',
};

describe('AddItemDialog — NumberInput ARIA contract (BL-0781)', () => {
  it('mirrors quantity bounds (min=1, max=999999) onto aria-value* attrs', () => {
    render(
      <AddItemDialog
        open
        onOpenChange={vi.fn()}
        newItem={baseNewItem}
        onNewItemChange={vi.fn()}
        onAddItem={vi.fn()}
      />,
    );

    const quantityInput = screen.getByTestId('input-add-quantity');
    expect(quantityInput.getAttribute('type')).toBe('number');
    expect(quantityInput.getAttribute('min')).toBe('1');
    expect(quantityInput.getAttribute('max')).toBe('999999');
    expect(quantityInput.getAttribute('aria-valuemin')).toBe('1');
    expect(quantityInput.getAttribute('aria-valuemax')).toBe('999999');
  });

  it('mirrors unit-price bounds (min=0, max=99999.99) onto aria-value* attrs', () => {
    render(
      <AddItemDialog
        open
        onOpenChange={vi.fn()}
        newItem={baseNewItem}
        onNewItemChange={vi.fn()}
        onAddItem={vi.fn()}
      />,
    );

    const unitPriceInput = screen.getByTestId('input-add-unit-price');
    expect(unitPriceInput.getAttribute('type')).toBe('number');
    expect(unitPriceInput.getAttribute('min')).toBe('0');
    expect(unitPriceInput.getAttribute('max')).toBe('99999.99');
    expect(unitPriceInput.getAttribute('step')).toBe('0.01');
    expect(unitPriceInput.getAttribute('aria-valuemin')).toBe('0');
    expect(unitPriceInput.getAttribute('aria-valuemax')).toBe('99999.99');
  });
});
