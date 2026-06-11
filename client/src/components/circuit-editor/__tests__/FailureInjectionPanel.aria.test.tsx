/// <reference lib="dom" />

import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { FailureInjectionPanel } from '../FailureInjectionPanel';

/**
 * Open the AddFaultForm and select a fault type (noise/drift/intermittent) so
 * that the type-specific number inputs render.
 */
function openFormWithType(type: 'noise' | 'drift' | 'intermittent') {
  fireEvent.click(screen.getByTestId('fault-add-button'));
  // Click the SelectTrigger to open the listbox
  fireEvent.click(screen.getByTestId('fault-form-type'));
  // Select the option text
  const optionLabel = type === 'noise' ? 'Noisy Sensor' : type === 'drift' ? 'Value Drift' : 'Intermittent';
  fireEvent.click(screen.getByText(optionLabel));
}

describe('FailureInjectionPanel — BL-0781 ARIA spinbutton contract', () => {
  it('mirrors min/max on fault-form-noise-amplitude (ADD-MIN, ADD-MAX)', () => {
    render(<FailureInjectionPanel components={{ R1: 'R1' }} />);
    openFormWithType('noise');
    const input = screen.getByTestId('fault-form-noise-amplitude') as HTMLInputElement;

    expect(input.getAttribute('aria-valuemin')).toBe('0');
    expect(input.getAttribute('aria-valuemax')).toBe('10000');
    expect(input.getAttribute('min')).toBe('0');
    expect(input.getAttribute('max')).toBe('10000');
  });

  it('mirrors min/max on fault-form-drift-percent (ADD-MIN, ADD-MAX, signed)', () => {
    render(<FailureInjectionPanel components={{ R1: 'R1' }} />);
    openFormWithType('drift');
    const input = screen.getByTestId('fault-form-drift-percent') as HTMLInputElement;

    expect(input.getAttribute('aria-valuemin')).toBe('-100');
    expect(input.getAttribute('aria-valuemax')).toBe('100');
    expect(input.getAttribute('min')).toBe('-100');
    expect(input.getAttribute('max')).toBe('100');
  });

  it('omits aria-valuemin/aria-valuemax and HTML min/max on fault-form-seed (OMIT-MAX/OMIT-MIN)', () => {
    render(<FailureInjectionPanel components={{ R1: 'R1' }} />);
    openFormWithType('noise');
    const input = screen.getByTestId('fault-form-seed') as HTMLInputElement;

    expect(input.hasAttribute('aria-valuemax')).toBe(false);
    expect(input.hasAttribute('aria-valuemin')).toBe(false);
    expect(input.getAttribute('max')).toBe(null);
    expect(input.getAttribute('min')).toBe(null);
    expect(input.getAttribute('aria-valuemax')).not.toBe('0');
  });
});
