/**
 * NetClassPanel — BL-0781 ARIA spinbutton contract.
 *
 * Asserts that the three NetClass dialog number inputs (trace width, clearance,
 * via diameter) mirror their `min`/`max` props to `aria-valuemin`/`aria-valuemax`
 * per the WAI-ARIA 1.2 spinbutton spec — fixing the Chromium synthesized
 * `aria-valuemax="0"` accessibility bug (E2E-236/271/284).
 *
 * Migration plan: `docs/audits/bl-0781-number-input-audit.md` (Teammate 3 →
 * NetClassPanel.tsx). Action: ADD-MAX, max=10mm, on all three inputs.
 */

// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/lib/contexts/project-id-context', () => ({
  useProjectId: () => 1,
}));

const mockUseCircuitNets = vi.fn().mockReturnValue({ data: [] });
vi.mock('@/lib/circuit-editor/hooks', () => ({
  useCircuitNets: () => mockUseCircuitNets(),
}));

import NetClassPanel from '../NetClassPanel';

function openDialog(): void {
  const addBtn = screen.getByTestId('button-add-net-class');
  fireEvent.click(addBtn);
}

describe('NetClassPanel — BL-0781 ARIA spinbutton contract', () => {
  beforeEach(() => {
    mockUseCircuitNets.mockReturnValue({ data: [] });
  });

  it('mirrors min={0.01} max={10} onto aria-valuemin/aria-valuemax for trace-width input', () => {
    render(<NetClassPanel circuitId={1} />);
    openDialog();
    const input = screen.getByTestId('input-trace-width') as HTMLInputElement;
    expect(input.getAttribute('type')).toBe('number');
    expect(input.getAttribute('aria-valuemin')).toBe('0.01');
    expect(input.getAttribute('aria-valuemax')).toBe('10');
    expect(input.getAttribute('min')).toBe('0.01');
    expect(input.getAttribute('max')).toBe('10');
  });

  it('mirrors min={0.01} max={10} onto aria-valuemin/aria-valuemax for clearance input', () => {
    render(<NetClassPanel circuitId={1} />);
    openDialog();
    const input = screen.getByTestId('input-clearance') as HTMLInputElement;
    expect(input.getAttribute('type')).toBe('number');
    expect(input.getAttribute('aria-valuemin')).toBe('0.01');
    expect(input.getAttribute('aria-valuemax')).toBe('10');
    expect(input.getAttribute('min')).toBe('0.01');
    expect(input.getAttribute('max')).toBe('10');
  });

  it('mirrors min={0.1} max={10} onto aria-valuemin/aria-valuemax for via-diameter input', () => {
    render(<NetClassPanel circuitId={1} />);
    openDialog();
    const input = screen.getByTestId('input-via-diameter') as HTMLInputElement;
    expect(input.getAttribute('type')).toBe('number');
    expect(input.getAttribute('aria-valuemin')).toBe('0.1');
    expect(input.getAttribute('aria-valuemax')).toBe('10');
    expect(input.getAttribute('min')).toBe('0.1');
    expect(input.getAttribute('max')).toBe('10');
  });
});
