/**
 * BL-0781 — NumberInput migration ARIA contract for OrderHistoryPanel.
 *
 * Quantity, unit cost, and total cost are all OMIT-MAX rows in the audit —
 * no coded ceiling exists for any of them (bulk orders / dollar magnitudes
 * are legitimately unbounded). The add-order form is revealed by clicking
 * "Add Order", so the flow here mounts the panel, opens the form, then
 * asserts the ARIA contract on the revealed spinbuttons.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ProjectIdProvider } from '@/lib/contexts/project-id-context';
import { OrderHistoryPanel } from '../OrderHistoryPanel';

function renderPanel() {
  return render(
    <ProjectIdProvider projectId={1}>
      <OrderHistoryPanel />
    </ProjectIdProvider>,
  );
}

describe('OrderHistoryPanel — NumberInput ARIA contract (BL-0781)', () => {
  it('renders quantity/unit-cost/total-cost spinbuttons with max omitted', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByTestId('btn-add-order'));

    const quantityInput = screen.getByTestId('input-quantity');
    expect(quantityInput.getAttribute('type')).toBe('number');
    expect(quantityInput.getAttribute('min')).toBe('1');
    expect(quantityInput.getAttribute('aria-valuemin')).toBe('1');
    expect(quantityInput.hasAttribute('max')).toBe(false);
    expect(quantityInput.hasAttribute('aria-valuemax')).toBe(false);

    const unitCostInput = screen.getByTestId('input-unit-cost');
    expect(unitCostInput.getAttribute('min')).toBe('0');
    expect(unitCostInput.hasAttribute('max')).toBe(false);
    expect(unitCostInput.hasAttribute('aria-valuemax')).toBe(false);

    const totalCostInput = screen.getByTestId('input-total-cost');
    expect(totalCostInput.getAttribute('min')).toBe('0');
    expect(totalCostInput.hasAttribute('max')).toBe(false);
    expect(totalCostInput.hasAttribute('aria-valuemax')).toBe(false);
  });
});
