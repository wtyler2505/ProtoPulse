/// <reference lib="dom" />

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { FunctionGeneratorPanel } from '../FunctionGeneratorPanel';

describe('FunctionGeneratorPanel — BL-0781 ARIA spinbutton contract', () => {
  it('mirrors min/max to aria-valuemin/aria-valuemax on funcgen-frequency-input', () => {
    render(<FunctionGeneratorPanel availableNets={[]} />);
    const input = screen.getByTestId('funcgen-frequency-input') as HTMLInputElement;
    expect(input.getAttribute('aria-valuemin')).toBe('0');
    expect(input.getAttribute('aria-valuemax')).toBe('1000000000');
    expect(input.getAttribute('min')).toBe('0');
    expect(input.getAttribute('max')).toBe('1000000000');
  });

  it('mirrors min/max to aria-valuemin/aria-valuemax on funcgen-amplitude-input', () => {
    render(<FunctionGeneratorPanel availableNets={[]} />);
    const input = screen.getByTestId('funcgen-amplitude-input') as HTMLInputElement;
    expect(input.getAttribute('aria-valuemin')).toBe('0');
    expect(input.getAttribute('aria-valuemax')).toBe('1000');
    expect(input.getAttribute('min')).toBe('0');
    expect(input.getAttribute('max')).toBe('1000');
  });

  it('mirrors min/max to aria-valuemin/aria-valuemax on funcgen-dc-offset-input', () => {
    render(<FunctionGeneratorPanel availableNets={[]} />);
    const input = screen.getByTestId('funcgen-dc-offset-input') as HTMLInputElement;
    expect(input.getAttribute('aria-valuemin')).toBe('-1000');
    expect(input.getAttribute('aria-valuemax')).toBe('1000');
    expect(input.getAttribute('min')).toBe('-1000');
    expect(input.getAttribute('max')).toBe('1000');
  });
});
