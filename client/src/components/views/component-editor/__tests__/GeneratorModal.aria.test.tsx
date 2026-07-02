/**
 * GeneratorModal — NumberInput ARIA-contract migration test (BL-0781).
 *
 * Per the BL-0781 audit (docs/audits/bl-0781-number-input-audit.md,
 * "Component-editor + views" table), all 6 GeneratorModal number instances are
 * OMIT-MAX: pin count (despite real DIP/SOIC/QFP max pin counts existing, none
 * are enforced today), pitch, row spacing, body size, header columns, header
 * rows. Each keeps its existing `min` (a real floor), but none gets a `max`
 * invented — that's the audit's explicit instruction, not a gap.
 *
 * The shadcn `Select` (Radix-based) package-type picker doesn't drive real
 * open/close + pointer-capture behavior under happy-dom, so it's mocked here
 * (following the established pattern in
 * client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx) —
 * `SelectItem` clicks route straight to `onValueChange`.
 */

// @vitest-environment happy-dom

import type { ReactNode } from 'react';

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/components/ui/select', () => {
  let currentOnValueChange: ((v: string) => void) | undefined;
  return {
    Select: ({ children, onValueChange }: { children: ReactNode; onValueChange: (v: string) => void }) => {
      currentOnValueChange = onValueChange;
      return <div>{children}</div>;
    },
    SelectTrigger: ({ children, ...props }: { children: ReactNode; 'data-testid'?: string }) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
    SelectValue: () => null,
    SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SelectItem: ({ children, value, ...props }: { children: ReactNode; value: string; 'data-testid'?: string }) => (
      <div {...props} onClick={() => currentOnValueChange?.(value)}>
        {children}
      </div>
    ),
  };
});

import GeneratorModal from '../GeneratorModal';

function renderModal() {
  return render(<GeneratorModal open onClose={vi.fn()} onGenerate={vi.fn()} />);
}

describe('GeneratorModal — NumberInput ARIA contract (BL-0781)', () => {
  it('pin count (DIP default): renders as a spinbutton, OMIT-MAX, keeps min', () => {
    renderModal();
    const el = screen.getByTestId('input-pin-count');
    expect(el.getAttribute('type')).toBe('number');
    expect(el.hasAttribute('aria-valuemax')).toBe(false);
    expect(el.hasAttribute('max')).toBe(false);
    expect(el.getAttribute('aria-valuemin')).toBe('2');
    expect(el.getAttribute('min')).toBe('2');
  });

  it('pitch: OMIT-MAX, keeps min=0.1', () => {
    renderModal();
    const el = screen.getByTestId('input-pitch');
    expect(el.hasAttribute('aria-valuemax')).toBe(false);
    expect(el.hasAttribute('max')).toBe(false);
    expect(el.getAttribute('aria-valuemin')).toBe('0.1');
  });

  it('row spacing (DIP-only field): OMIT-MAX, keeps min=1', () => {
    renderModal();
    const el = screen.getByTestId('input-row-spacing');
    expect(el.hasAttribute('aria-valuemax')).toBe(false);
    expect(el.hasAttribute('max')).toBe(false);
    expect(el.getAttribute('aria-valuemin')).toBe('1');
  });

  it('body size (QFP): OMIT-MAX, keeps min=1', () => {
    renderModal();
    fireEvent.click(screen.getByTestId('option-qfp'));
    const el = screen.getByTestId('input-body-size');
    expect(el.hasAttribute('aria-valuemax')).toBe(false);
    expect(el.hasAttribute('max')).toBe(false);
    expect(el.getAttribute('aria-valuemin')).toBe('1');
  });

  it('header columns/rows (header package): both OMIT-MAX, keep min=1', () => {
    renderModal();
    fireEvent.click(screen.getByTestId('option-header'));

    const cols = screen.getByTestId('input-cols');
    expect(cols.hasAttribute('aria-valuemax')).toBe(false);
    expect(cols.hasAttribute('max')).toBe(false);
    expect(cols.getAttribute('aria-valuemin')).toBe('1');

    const rows = screen.getByTestId('input-rows');
    expect(rows.hasAttribute('aria-valuemax')).toBe(false);
    expect(rows.hasAttribute('max')).toBe(false);
    expect(rows.getAttribute('aria-valuemin')).toBe('1');
  });

  it('regression guard: pin count never coerces the missing max to aria-valuemax="0"', () => {
    renderModal();
    const el = screen.getByTestId('input-pin-count');
    expect(el.getAttribute('aria-valuemax')).not.toBe('0');
  });

  it('mirrors the pin count value onto aria-valuenow (DIP default = 8)', () => {
    renderModal();
    const el = screen.getByTestId('input-pin-count');
    expect(el.getAttribute('aria-valuenow')).toBe('8');
  });
});
