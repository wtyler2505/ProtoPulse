/// <reference lib="dom" />

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { RotationInputPanel } from '../RotationInputPanel';

describe('RotationInputPanel — BL-0781 ARIA spinbutton contract', () => {
  it('mirrors min/max to aria-valuemin/aria-valuemax on rotation-angle-input', () => {
    render(<RotationInputPanel angle={0} onChange={vi.fn()} />);
    const input = screen.getByTestId('rotation-angle-input') as HTMLInputElement;

    expect(input.getAttribute('aria-valuemin')).toBe('0');
    expect(input.getAttribute('aria-valuemax')).toBe('359');
    expect(input.getAttribute('min')).toBe('0');
    expect(input.getAttribute('max')).toBe('359');
  });
});
