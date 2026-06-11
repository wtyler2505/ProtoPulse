/// <reference lib="dom" />

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/pcb/impedance-trace-width', () => {
  const stableSuggestions: never[] = [];
  return {
    ImpedanceTraceWidthManager: {
      getInstance: () => ({
        setStackupParams: () => {},
        setTolerance: () => {},
        getWidthSuggestions: () => stableSuggestions,
      }),
    },
    calculateImpedance: () => 50,
  };
});

import { ImpedanceTraceWidthPanel } from '../ImpedanceTraceWidthPanel';

describe('ImpedanceTraceWidthPanel — BL-0781 ARIA spinbutton contract', () => {
  it('mirrors min/max to aria-valuemin/aria-valuemax on input-dielectric-constant', () => {
    render(<ImpedanceTraceWidthPanel />);
    const input = screen.getByTestId('input-dielectric-constant') as HTMLInputElement;

    expect(input.getAttribute('aria-valuemin')).toBe('1');
    expect(input.getAttribute('aria-valuemax')).toBe('20');
    expect(input.getAttribute('min')).toBe('1');
    expect(input.getAttribute('max')).toBe('20');
  });

  it('mirrors min/max to aria-valuemin/aria-valuemax on input-dielectric-height', () => {
    render(<ImpedanceTraceWidthPanel />);
    const input = screen.getByTestId('input-dielectric-height') as HTMLInputElement;

    expect(input.getAttribute('aria-valuemin')).toBe('0.01');
    expect(input.getAttribute('aria-valuemax')).toBe('5');
    expect(input.getAttribute('min')).toBe('0.01');
    expect(input.getAttribute('max')).toBe('5');
  });

  it('mirrors min/max to aria-valuemin/aria-valuemax on input-copper-thickness', () => {
    render(<ImpedanceTraceWidthPanel />);
    const input = screen.getByTestId('input-copper-thickness') as HTMLInputElement;

    expect(input.getAttribute('aria-valuemin')).toBe('0');
    expect(input.getAttribute('aria-valuemax')).toBe('0.5');
    expect(input.getAttribute('min')).toBe('0');
    expect(input.getAttribute('max')).toBe('0.5');
  });

  it('mirrors min/max to aria-valuemin/aria-valuemax on input-tolerance', () => {
    render(<ImpedanceTraceWidthPanel />);
    const input = screen.getByTestId('input-tolerance') as HTMLInputElement;

    expect(input.getAttribute('aria-valuemin')).toBe('0');
    expect(input.getAttribute('aria-valuemax')).toBe('100');
    expect(input.getAttribute('min')).toBe('0');
    expect(input.getAttribute('max')).toBe('100');
  });
});
