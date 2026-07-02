/**
 * BL-0781 — NumberInput migration ARIA contract for PcbOrderTrackerPanel.
 *
 * Quantity is OMIT-MAX (no coded ceiling on PCB order quantity). The
 * estimated-delivery-days field is the one ADD-MAX row in the procurement
 * set: no max existed before, but the audit proposes max={365} as a genuine
 * real-world-bounded quantity (delivery days) to prevent fat-finger entry —
 * a deliberate, justified new bound, not an invented one.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ProjectIdProvider } from '@/lib/contexts/project-id-context';
import { PcbOrderTrackerPanel } from '../PcbOrderTrackerPanel';

function renderPanel() {
  return render(
    <ProjectIdProvider projectId={1}>
      <PcbOrderTrackerPanel />
    </ProjectIdProvider>,
  );
}

describe('PcbOrderTrackerPanel — NumberInput ARIA contract (BL-0781)', () => {
  it('renders the quantity spinbutton with min mirrored but max omitted', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByTestId('btn-add-pcb-order'));

    const quantityInput = screen.getByTestId('input-pcb-quantity');
    expect(quantityInput.getAttribute('type')).toBe('number');
    expect(quantityInput.getAttribute('min')).toBe('1');
    expect(quantityInput.getAttribute('aria-valuemin')).toBe('1');
    expect(quantityInput.hasAttribute('max')).toBe(false);
    expect(quantityInput.hasAttribute('aria-valuemax')).toBe(false);
  });

  it('renders the delivery-days spinbutton with the new max={365} bound mirrored (ADD-MAX)', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByTestId('btn-add-pcb-order'));

    const deliveryDaysInput = screen.getByTestId('input-pcb-delivery-days');
    expect(deliveryDaysInput.getAttribute('min')).toBe('0');
    expect(deliveryDaysInput.getAttribute('max')).toBe('365');
    expect(deliveryDaysInput.getAttribute('aria-valuemin')).toBe('0');
    expect(deliveryDaysInput.getAttribute('aria-valuemax')).toBe('365');
  });
});
