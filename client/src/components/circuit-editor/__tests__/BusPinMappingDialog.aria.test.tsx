/**
 * BusPinMappingDialog — BL-0781 ARIA spinbutton contract.
 *
 * The "Width" input already declares `min={1} max={64}` as number literals
 * (audit action: KEEP). This test pins the migrated `<NumberInput>` to mirror
 * those bounds onto `aria-valuemin`/`aria-valuemax`, preventing reintroduction
 * of the Chromium synthesized `aria-valuemax="0"` bug (E2E-236/271/284).
 */

// @vitest-environment happy-dom

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/circuit-editor/bus-pin-mapper', () => ({
  busPinMapper: {
    subscribe: () => () => undefined,
    version: 0,
    getBusDefinitions: () => [],
  },
}));

import BusPinMappingDialog from '../BusPinMappingDialog';

describe('BusPinMappingDialog — BL-0781 ARIA spinbutton contract', () => {
  it('mirrors min={1} max={64} onto aria-valuemin/aria-valuemax for bus-width input', { timeout: 30000 }, () => {
    render(
      <BusPinMappingDialog open={true} onOpenChange={() => undefined} nets={[]} />,
    );
    const input = screen.getByTestId('bus-width-input') as HTMLInputElement;
    expect(input.getAttribute('type')).toBe('number');
    expect(input.getAttribute('aria-valuemin')).toBe('1');
    expect(input.getAttribute('aria-valuemax')).toBe('64');
    expect(input.getAttribute('min')).toBe('1');
    expect(input.getAttribute('max')).toBe('64');
  });
});
