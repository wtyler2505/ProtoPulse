/// <reference lib="dom" />

import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import GeneratorModal from '../GeneratorModal';

/**
 * BL-0781 ARIA spinbutton contract for GeneratorModal.
 *
 * Audit row mapping (docs/audits/bl-0781-number-input-audit.md, T4 section):
 *   L204 input-pin-count     min={packageType==='qfp'?4:2}, max=500
 *   L219 input-pitch         min=0.1, max=10, step=0.01
 *   L234 input-row-spacing   min=1, max=100, step=0.01 (DIP only)
 *   L249 input-body-size     min=1, max=100, step=0.1 (QFP only)
 *   L265 input-cols          min=1, max=100 (header only)
 *   L276 input-rows          min=1, max=100 (header only)
 *
 * Default packageType is 'dip' so pin-count + pitch + row-spacing render
 * without switching the Select.
 */

function renderOpen(): void {
  render(
    <GeneratorModal
      open={true}
      onClose={vi.fn()}
      onGenerate={vi.fn()}
    />,
  );
}

function switchPackageType(label: string): void {
  fireEvent.click(screen.getByTestId('select-package-type'));
  fireEvent.click(screen.getByRole('option', { name: label }));
}

describe('GeneratorModal — BL-0781 ARIA spinbutton contract', () => {
  it('mirrors min/max on default (DIP) inputs: pin-count + pitch + row-spacing', () => {
    renderOpen();
    const pinCount = screen.getByTestId('input-pin-count') as HTMLInputElement;
    const pitch = screen.getByTestId('input-pitch') as HTMLInputElement;
    const rowSpacing = screen.getByTestId('input-row-spacing') as HTMLInputElement;

    expect(pinCount.getAttribute('aria-valuemin')).toBe('2');
    expect(pinCount.getAttribute('aria-valuemax')).toBe('500');
    expect(pitch.getAttribute('aria-valuemin')).toBe('0.1');
    expect(pitch.getAttribute('aria-valuemax')).toBe('10');
    expect(rowSpacing.getAttribute('aria-valuemin')).toBe('1');
    expect(rowSpacing.getAttribute('aria-valuemax')).toBe('100');
  });

  it('mirrors min/max on QFP body-size when packageType=qfp', () => {
    renderOpen();
    switchPackageType('QFP (Quad Flat Package)');
    const bodySize = screen.getByTestId('input-body-size') as HTMLInputElement;
    const pinCount = screen.getByTestId('input-pin-count') as HTMLInputElement;

    expect(bodySize.getAttribute('aria-valuemin')).toBe('1');
    expect(bodySize.getAttribute('aria-valuemax')).toBe('100');
    // QFP pin-count min flips to 4
    expect(pinCount.getAttribute('aria-valuemin')).toBe('4');
    expect(pinCount.getAttribute('aria-valuemax')).toBe('500');
  });

  it('mirrors min/max on header cols + rows when packageType=header', () => {
    renderOpen();
    switchPackageType('Pin Header');
    const cols = screen.getByTestId('input-cols') as HTMLInputElement;
    const rows = screen.getByTestId('input-rows') as HTMLInputElement;

    expect(cols.getAttribute('aria-valuemin')).toBe('1');
    expect(cols.getAttribute('aria-valuemax')).toBe('100');
    expect(rows.getAttribute('aria-valuemin')).toBe('1');
    expect(rows.getAttribute('aria-valuemax')).toBe('100');
  });
});
