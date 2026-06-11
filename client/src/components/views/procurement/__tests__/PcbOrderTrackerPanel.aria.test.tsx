/**
 * PcbOrderTrackerPanel — BL-0781 ARIA spinbutton contract.
 *
 * Asserts that the two PCB-order number inputs (quantity, estimated delivery
 * days) mirror `min`/`max` props to `aria-valuemin`/`aria-valuemax` per the
 * WAI-ARIA 1.2 spinbutton spec — fixing the Chromium synthesized
 * `aria-valuemax="0"` accessibility bug (E2E-236/271/284).
 *
 * Migration plan: docs/audits/bl-0781-number-input-audit.md (Teammate 5 →
 * PcbOrderTrackerPanel.tsx). Action: raw <input> → NumberInput + ADD-MAX.
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

vi.mock('@/lib/pcb-order-tracker', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/pcb-order-tracker')>();
  return {
    ...actual,
    usePcbOrderTracker: () => ({
      orders: [],
      activeOrders: [],
      completedOrders: [],
      createOrder: () => null,
      updateStatus: () => null,
      updateTracking: () => null,
      updateEstimatedDelivery: () => null,
      deleteOrder: () => null,
      getDaysUntilDelivery: () => null,
    }),
  };
});

import { PcbOrderTrackerPanel } from '../PcbOrderTrackerPanel';

function openAddForm(): void {
  fireEvent.click(screen.getByTestId('btn-add-pcb-order'));
}

describe('PcbOrderTrackerPanel — BL-0781 ARIA spinbutton contract', () => {
  it('mirrors min={1} max={999_999} for the pcb-quantity input', () => {
    render(<PcbOrderTrackerPanel />);
    openAddForm();
    const input = screen.getByTestId('input-pcb-quantity') as HTMLInputElement;
    expect(input.getAttribute('type')).toBe('number');
    expect(input.getAttribute('aria-valuemin')).toBe('1');
    expect(input.getAttribute('aria-valuemax')).toBe('999999');
    expect(input.getAttribute('min')).toBe('1');
    expect(input.getAttribute('max')).toBe('999999');
  });

  it('mirrors min={0} max={365} for the pcb-delivery-days input', () => {
    render(<PcbOrderTrackerPanel />);
    openAddForm();
    const input = screen.getByTestId('input-pcb-delivery-days') as HTMLInputElement;
    expect(input.getAttribute('type')).toBe('number');
    expect(input.getAttribute('aria-valuemin')).toBe('0');
    expect(input.getAttribute('aria-valuemax')).toBe('365');
    expect(input.getAttribute('min')).toBe('0');
    expect(input.getAttribute('max')).toBe('365');
  });
});
