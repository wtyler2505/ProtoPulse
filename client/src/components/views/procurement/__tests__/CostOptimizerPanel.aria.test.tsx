/**
 * BL-0781 — NumberInput migration ARIA contract for CostOptimizerPanel.
 *
 * All three spinbuttons (budget, PCB fab cost, assembly cost) are dollar
 * magnitudes with a real floor (can't budget negative dollars) but no
 * domain ceiling — OMIT-MAX per the audit. The primitive must omit
 * aria-valuemax/max entirely rather than defaulting to "0".
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CostOptimizerPanel } from '../CostOptimizerPanel';

describe('CostOptimizerPanel — NumberInput ARIA contract (BL-0781)', () => {
  it('renders the budget spinbutton with min mirrored but max omitted', () => {
    render(<CostOptimizerPanel bom={[]} />);

    const budgetInput = screen.getByTestId('input-budget');
    expect(budgetInput.getAttribute('type')).toBe('number');
    expect(budgetInput.getAttribute('min')).toBe('0');
    expect(budgetInput.getAttribute('aria-valuemin')).toBe('0');
    expect(budgetInput.hasAttribute('max')).toBe(false);
    expect(budgetInput.hasAttribute('aria-valuemax')).toBe(false);
  });

  it('renders the PCB fab cost and assembly cost spinbuttons with max omitted', () => {
    render(<CostOptimizerPanel bom={[]} />);

    const pcbInput = screen.getByTestId('input-pcb-cost');
    expect(pcbInput.getAttribute('min')).toBe('0');
    expect(pcbInput.hasAttribute('max')).toBe(false);
    expect(pcbInput.hasAttribute('aria-valuemax')).toBe(false);

    const assemblyInput = screen.getByTestId('input-assembly-cost');
    expect(assemblyInput.getAttribute('min')).toBe('0');
    expect(assemblyInput.hasAttribute('max')).toBe(false);
    expect(assemblyInput.hasAttribute('aria-valuemax')).toBe(false);
  });
});
