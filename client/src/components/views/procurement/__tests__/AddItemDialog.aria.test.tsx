/**
 * AddItemDialog — BL-0781 ARIA spinbutton contract.
 *
 * Asserts that the quantity and unit-price number inputs mirror `min`/`max`
 * props to `aria-valuemin`/`aria-valuemax` per the WAI-ARIA 1.2 spinbutton
 * spec — fixing the Chromium synthesized `aria-valuemax="0"` accessibility
 * bug (E2E-236/271/284).
 *
 * Migration plan: docs/audits/bl-0781-number-input-audit.md (Teammate 5 →
 * AddItemDialog.tsx). Action: KEEP + CONVERT-TYPE (strings → numbers via
 * NumberInput).
 */

// @vitest-environment happy-dom

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { AddItemDialog, type NewItemValues } from '../AddItemDialog';

const baseItem: NewItemValues = {
  partNumber: '',
  manufacturer: '',
  description: '',
  quantity: 1,
  unitPrice: 0,
  supplier: 'Digi-Key',
};

describe('AddItemDialog — BL-0781 ARIA spinbutton contract', () => {
  it('mirrors min={1} max={999_999} for the quantity input', () => {
    render(
      <AddItemDialog
        open={true}
        onOpenChange={() => {}}
        newItem={baseItem}
        onNewItemChange={() => {}}
        onAddItem={() => {}}
      />,
    );
    const input = screen.getByTestId('input-add-quantity') as HTMLInputElement;
    expect(input.getAttribute('type')).toBe('number');
    expect(input.getAttribute('aria-valuemin')).toBe('1');
    expect(input.getAttribute('aria-valuemax')).toBe('999999');
    expect(input.getAttribute('min')).toBe('1');
    expect(input.getAttribute('max')).toBe('999999');
  });

  it('mirrors min={0} max={99_999.99} step={0.01} for the unit-price input', () => {
    render(
      <AddItemDialog
        open={true}
        onOpenChange={() => {}}
        newItem={baseItem}
        onNewItemChange={() => {}}
        onAddItem={() => {}}
      />,
    );
    const input = screen.getByTestId('input-add-unit-price') as HTMLInputElement;
    expect(input.getAttribute('type')).toBe('number');
    expect(input.getAttribute('aria-valuemin')).toBe('0');
    expect(input.getAttribute('aria-valuemax')).toBe('99999.99');
    expect(input.getAttribute('min')).toBe('0');
    expect(input.getAttribute('max')).toBe('99999.99');
    expect(input.getAttribute('step')).toBe('0.01');
  });
});
