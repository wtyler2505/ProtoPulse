/**
 * CostOptimizerPanel — BL-0781 ARIA spinbutton contract.
 *
 * Asserts that the three cost-optimizer number inputs (target budget, PCB
 * fabrication cost, assembly cost) mirror `min`/`max` props to
 * `aria-valuemin`/`aria-valuemax` per the WAI-ARIA 1.2 spinbutton spec —
 * fixing the Chromium synthesized `aria-valuemax="0"` accessibility bug
 * (E2E-236/271/284).
 *
 * Migration plan: docs/audits/bl-0781-number-input-audit.md (Teammate 5 →
 * CostOptimizerPanel.tsx). Action: raw <input> → NumberInput + ADD-MAX.
 */

// @vitest-environment happy-dom

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { CostOptimizerPanel } from '../CostOptimizerPanel';

describe('CostOptimizerPanel — BL-0781 ARIA spinbutton contract', () => {
  it('mirrors min={0} max={1_000_000_000} for the target-budget input', () => {
    render(<CostOptimizerPanel bom={[]} />);
    const input = screen.getByTestId('input-budget') as HTMLInputElement;
    expect(input.getAttribute('type')).toBe('number');
    expect(input.getAttribute('aria-valuemin')).toBe('0');
    expect(input.getAttribute('aria-valuemax')).toBe('1000000000');
    expect(input.getAttribute('min')).toBe('0');
    expect(input.getAttribute('max')).toBe('1000000000');
  });

  it('mirrors min={0} max={1_000_000} step={0.5} for the PCB-cost input', () => {
    render(<CostOptimizerPanel bom={[]} />);
    const input = screen.getByTestId('input-pcb-cost') as HTMLInputElement;
    expect(input.getAttribute('type')).toBe('number');
    expect(input.getAttribute('aria-valuemin')).toBe('0');
    expect(input.getAttribute('aria-valuemax')).toBe('1000000');
    expect(input.getAttribute('min')).toBe('0');
    expect(input.getAttribute('max')).toBe('1000000');
    expect(input.getAttribute('step')).toBe('0.5');
  });

  it('mirrors min={0} max={1_000_000} step={0.5} for the assembly-cost input', () => {
    render(<CostOptimizerPanel bom={[]} />);
    const input = screen.getByTestId('input-assembly-cost') as HTMLInputElement;
    expect(input.getAttribute('type')).toBe('number');
    expect(input.getAttribute('aria-valuemin')).toBe('0');
    expect(input.getAttribute('aria-valuemax')).toBe('1000000');
    expect(input.getAttribute('min')).toBe('0');
    expect(input.getAttribute('max')).toBe('1000000');
    expect(input.getAttribute('step')).toBe('0.5');
  });
});
