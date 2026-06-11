/// <reference lib="dom" />

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import BreadboardQuickIntake from '../BreadboardQuickIntake';

describe('BreadboardQuickIntake — BL-0781 ARIA spinbutton contract', () => {
  it('mirrors min/max to aria-valuemin/aria-valuemax on quick-intake-quantity', () => {
    render(<BreadboardQuickIntake onAdd={vi.fn()} />);
    const input = screen.getByTestId('quick-intake-quantity') as HTMLInputElement;

    expect(input.getAttribute('aria-valuemin')).toBe('1');
    expect(input.getAttribute('aria-valuemax')).toBe('9999');
    expect(input.getAttribute('min')).toBe('1');
    expect(input.getAttribute('max')).toBe('9999');
  });
});
