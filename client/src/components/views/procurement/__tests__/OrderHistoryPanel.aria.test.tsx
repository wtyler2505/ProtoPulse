/**
 * OrderHistoryPanel — BL-0781 ARIA spinbutton contract.
 *
 * Asserts that the three Add-Order form number inputs (quantity, unit cost,
 * total cost) mirror `min`/`max` props to `aria-valuemin`/`aria-valuemax`
 * per the WAI-ARIA 1.2 spinbutton spec — fixing the Chromium synthesized
 * `aria-valuemax="0"` accessibility bug (E2E-236/271/284).
 *
 * Migration plan: docs/audits/bl-0781-number-input-audit.md (Teammate 5 →
 * OrderHistoryPanel.tsx). Action: raw <input> → NumberInput + ADD-MAX.
 */

// @vitest-environment happy-dom

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/lib/project-context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/project-context')>();
  return {
    ...actual,
    useProjectId: () => 1,
  };
});

vi.mock('@/lib/order-history', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/order-history')>();
  return {
    ...actual,
    useOrderHistory: () => ({
      orders: [],
      activeOrders: [],
      totalSpent: 0,
      costByCategory: { pcb: 0, components: 0, assembly: 0 },
      createOrder: () => null,
      updateStatus: () => null,
      updateTracking: () => null,
      deleteOrder: () => null,
    }),
  };
});

import { OrderHistoryPanel } from '../OrderHistoryPanel';

function openAddForm(): void {
  fireEvent.click(screen.getByTestId('btn-add-order'));
}

describe('OrderHistoryPanel — BL-0781 ARIA spinbutton contract', () => {
  it('mirrors min={1} max={999_999} for the quantity input', () => {
    render(<OrderHistoryPanel />);
    openAddForm();
    const input = screen.getByTestId('input-quantity') as HTMLInputElement;
    expect(input.getAttribute('type')).toBe('number');
    expect(input.getAttribute('aria-valuemin')).toBe('1');
    expect(input.getAttribute('aria-valuemax')).toBe('999999');
    expect(input.getAttribute('min')).toBe('1');
    expect(input.getAttribute('max')).toBe('999999');
  });

  it('mirrors min={0} max={1_000_000} step={0.01} for the unit-cost input', () => {
    render(<OrderHistoryPanel />);
    openAddForm();
    const input = screen.getByTestId('input-unit-cost') as HTMLInputElement;
    expect(input.getAttribute('type')).toBe('number');
    expect(input.getAttribute('aria-valuemin')).toBe('0');
    expect(input.getAttribute('aria-valuemax')).toBe('1000000');
    expect(input.getAttribute('min')).toBe('0');
    expect(input.getAttribute('max')).toBe('1000000');
    expect(input.getAttribute('step')).toBe('0.01');
  });

  it('mirrors min={0} max={1_000_000_000} step={0.01} for the total-cost input', () => {
    render(<OrderHistoryPanel />);
    openAddForm();
    const input = screen.getByTestId('input-total-cost') as HTMLInputElement;
    expect(input.getAttribute('type')).toBe('number');
    expect(input.getAttribute('aria-valuemin')).toBe('0');
    expect(input.getAttribute('aria-valuemax')).toBe('1000000000');
    expect(input.getAttribute('min')).toBe('0');
    expect(input.getAttribute('max')).toBe('1000000000');
    expect(input.getAttribute('step')).toBe('0.01');
  });
});
