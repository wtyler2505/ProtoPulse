/// <reference lib="dom" />

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { MysteryPartConfigurator } from '../MysteryPartConfigurator';

describe('MysteryPartConfigurator — BL-0781 ARIA spinbutton contract', () => {
  it('mirrors min/max to aria-valuemin/aria-valuemax on mystery-pin-count (MIN_PINS=2, MAX_PINS=40)', () => {
    render(
      <MysteryPartConfigurator open onOpenChange={vi.fn()} onApply={vi.fn()} />,
    );
    const input = screen.getByTestId('mystery-pin-count') as HTMLInputElement;

    expect(input.getAttribute('aria-valuemin')).toBe('2');
    expect(input.getAttribute('aria-valuemax')).toBe('40');
    expect(input.getAttribute('min')).toBe('2');
    expect(input.getAttribute('max')).toBe('40');
  });

  it('mirrors min/max to aria-valuemin/aria-valuemax on mystery-body-width', () => {
    render(
      <MysteryPartConfigurator open onOpenChange={vi.fn()} onApply={vi.fn()} />,
    );
    const input = screen.getByTestId('mystery-body-width') as HTMLInputElement;

    expect(input.getAttribute('aria-valuemin')).toBe('1');
    expect(input.getAttribute('aria-valuemax')).toBe('20');
    expect(input.getAttribute('min')).toBe('1');
    expect(input.getAttribute('max')).toBe('20');
  });

  it('mirrors min/max to aria-valuemin/aria-valuemax on mystery-body-height', () => {
    render(
      <MysteryPartConfigurator open onOpenChange={vi.fn()} onApply={vi.fn()} />,
    );
    const input = screen.getByTestId('mystery-body-height') as HTMLInputElement;

    expect(input.getAttribute('aria-valuemin')).toBe('1');
    expect(input.getAttribute('aria-valuemax')).toBe('20');
    expect(input.getAttribute('min')).toBe('1');
    expect(input.getAttribute('max')).toBe('20');
  });
});
