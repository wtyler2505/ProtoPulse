/**
 * Tests for the NumberInput primitive — fix for E2E-236 / E2E-271 / E2E-284.
 *
 * Contract:
 *   - Always renders a spinbutton (input[type="number"]).
 *   - When `max` is provided, mirrors it onto `aria-valuemax`.
 *   - When `max` is undefined, OMITS `aria-valuemax` entirely (NOT `"0"`).
 *   - Same behaviour for `min` ↔ `aria-valuemin`.
 *   - When `value` is numeric (or a parseable numeric string), mirrors onto
 *     `aria-valuenow`; otherwise omits it.
 *   - Forwards the ref and extra props (e.g., `data-testid`, `id`).
 */

// @vitest-environment happy-dom

import { createRef } from 'react';

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { NumberInput } from '../number-input';

const noop = (): void => {
  /* intentionally empty — tests don't care about change events */
};

describe('NumberInput — aria-valuemax / aria-valuemin contract (E2E-236/271/284)', () => {
  it('renders a spinbutton via input[type="number"]', () => {
    render(<NumberInput data-testid="spin" />);
    const el = screen.getByTestId('spin');
    expect(el.getAttribute('type')).toBe('number');
    // happy-dom exposes input[type="number"] via role="spinbutton"
    expect(el.getAttribute('role') ?? 'spinbutton').toBe('spinbutton');
  });

  it('forwards max prop to aria-valuemax (E2E-236/271/284)', () => {
    render(<NumberInput data-testid="spin" value={5} min={0} max={100} onChange={noop} />);
    const el = screen.getByTestId('spin');
    expect(el.getAttribute('aria-valuemax')).toBe('100');
    expect(el.getAttribute('aria-valuemin')).toBe('0');
    expect(el.getAttribute('aria-valuenow')).toBe('5');
    // HTML constraint attrs also present
    expect(el.getAttribute('max')).toBe('100');
    expect(el.getAttribute('min')).toBe('0');
  });

  it('omits aria-valuemax when max is undefined (not "0")', () => {
    render(<NumberInput data-testid="spin" value={5} min={0} onChange={noop} />);
    const el = screen.getByTestId('spin');
    expect(el.hasAttribute('aria-valuemax')).toBe(false);
    expect(el.getAttribute('aria-valuemin')).toBe('0');
  });

  it('omits aria-valuemin when min is undefined', () => {
    render(<NumberInput data-testid="spin" value={5} max={10} onChange={noop} />);
    const el = screen.getByTestId('spin');
    expect(el.hasAttribute('aria-valuemin')).toBe(false);
    expect(el.getAttribute('aria-valuemax')).toBe('10');
  });

  it('omits all three aria-value* attrs when no min/max/value provided', () => {
    render(<NumberInput data-testid="spin" onChange={noop} />);
    const el = screen.getByTestId('spin');
    expect(el.hasAttribute('aria-valuemin')).toBe(false);
    expect(el.hasAttribute('aria-valuemax')).toBe(false);
    expect(el.hasAttribute('aria-valuenow')).toBe(false);
  });

  it('coerces a numeric string value into aria-valuenow', () => {
    render(<NumberInput data-testid="spin" value="42" max={100} onChange={noop} />);
    const el = screen.getByTestId('spin');
    expect(el.getAttribute('aria-valuenow')).toBe('42');
  });

  it('omits aria-valuenow when value is an empty or non-numeric string', () => {
    render(<NumberInput data-testid="spin" value="" max={100} onChange={noop} />);
    const el = screen.getByTestId('spin');
    expect(el.hasAttribute('aria-valuenow')).toBe(false);
  });

  it('does not coerce undefined max or min to 0 (regression guard)', () => {
    // This is the heart of E2E-236/271/284 — a missing max prop MUST NOT end up
    // as aria-valuemax="0", which would tell screen readers and automated a11y
    // tools the spinbutton upper bound is 0 and cannot be incremented.
    render(<NumberInput data-testid="spin" onChange={noop} />);
    const el = screen.getByTestId('spin');
    expect(el.getAttribute('aria-valuemax')).not.toBe('0');
    expect(el.getAttribute('aria-valuemin')).not.toBe('0');
  });

  it('forwards ref to the underlying input', () => {
    const ref = createRef<HTMLInputElement>();
    render(<NumberInput ref={ref} data-testid="spin" max={100} />);
    expect(ref.current).toBe(screen.getByTestId('spin'));
    expect(ref.current?.tagName).toBe('INPUT');
  });

  it('forwards onChange events', () => {
    const onChange = vi.fn();
    render(<NumberInput data-testid="spin" max={100} onChange={onChange} />);
    const el = screen.getByTestId('spin');
    fireEvent.change(el, { target: { value: '7' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('ignores NaN / Infinity passed as max (regression guard)', () => {
    render(
      <NumberInput data-testid="spin" max={Number.NaN as unknown as number} min={0} />,
    );
    const el = screen.getByTestId('spin');
    expect(el.hasAttribute('aria-valuemax')).toBe(false);
    expect(el.getAttribute('aria-valuemin')).toBe('0');
  });
});
