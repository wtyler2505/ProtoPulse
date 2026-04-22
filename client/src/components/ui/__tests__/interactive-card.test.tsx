/**
 * Tests for the InteractiveCard primitive — Plan 03 Phase 3
 * (E2E-018, E2E-068, E2E-261, E2E-267).
 *
 * Replaces the systemic `<div role="button" onClick={...}>` pattern with a
 * real `<button>` so that:
 *  - Enter and Space activate natively (no manual onKeyDown needed)
 *  - Screen readers announce role=button from the tag
 *  - disabled state is honored by the browser
 */

// @vitest-environment happy-dom

import { describe, it, expect, vi } from 'vitest';
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { InteractiveCard } from '../interactive-card';

describe('InteractiveCard', () => {
  it('renders as a real <button> element (not a div with role=button)', () => {
    render(<InteractiveCard>Hello</InteractiveCard>);
    const btn = screen.getByRole('button', { name: 'Hello' });
    expect(btn.tagName).toBe('BUTTON');
  });

  it('defaults to type="button" so it does not submit surrounding forms', () => {
    render(<InteractiveCard>Hello</InteractiveCard>);
    const btn = screen.getByRole('button', { name: 'Hello' });
    expect(btn.getAttribute('type')).toBe('button');
  });

  it('forwards aria-label for accessible name', () => {
    render(
      <InteractiveCard aria-label="Open dashboard card">
        <span>Visual content</span>
      </InteractiveCard>,
    );
    expect(
      screen.getByRole('button', { name: 'Open dashboard card' }),
    ).toBeTruthy();
  });

  it('fires onClick when clicked', async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<InteractiveCard onClick={handler}>Click me</InteractiveCard>);
    await user.click(screen.getByRole('button', { name: 'Click me' }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('fires onAction alias when clicked', async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<InteractiveCard onAction={handler}>Click me</InteractiveCard>);
    await user.click(screen.getByRole('button', { name: 'Click me' }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('fires handler on Enter and Space (native <button> behavior)', async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<InteractiveCard onClick={handler}>Keyed</InteractiveCard>);
    const btn = screen.getByRole('button', { name: 'Keyed' });
    btn.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('does not fire handler when disabled', async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(
      <InteractiveCard onClick={handler} disabled>
        Disabled
      </InteractiveCard>,
    );
    await user.click(screen.getByRole('button', { name: 'Disabled' }));
    expect(handler).not.toHaveBeenCalled();
  });

  it('applies a focus-visible ring class', () => {
    render(<InteractiveCard>Focus me</InteractiveCard>);
    const btn = screen.getByRole('button', { name: 'Focus me' });
    // focus-visible ring tokens come from shadcn; assert the class survives
    expect(btn.className).toMatch(/focus-visible:ring-2/);
    expect(btn.className).toMatch(/focus-visible:ring-ring/);
  });

  it('resets native button chrome so card layout classes win', () => {
    render(<InteractiveCard>Chromeless</InteractiveCard>);
    const btn = screen.getByRole('button', { name: 'Chromeless' });
    expect(btn.className).toMatch(/appearance-none/);
    expect(btn.className).toMatch(/bg-transparent/);
    expect(btn.className).toMatch(/text-left/);
  });

  it('forwards refs', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<InteractiveCard ref={ref}>Ref target</InteractiveCard>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('accepts and forwards consumer className alongside reset classes', () => {
    render(
      <InteractiveCard className="bg-card rounded-xl p-6">
        Styled
      </InteractiveCard>,
    );
    const btn = screen.getByRole('button', { name: 'Styled' });
    // Both consumer classes AND the primitive's reset classes should be present.
    expect(btn.className).toMatch(/bg-card/);
    expect(btn.className).toMatch(/rounded-xl/);
    expect(btn.className).toMatch(/appearance-none/);
  });

  it('fires onClick before onAction and respects preventDefault', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn((e: React.MouseEvent) => {
      e.preventDefault();
    });
    const onAction = vi.fn();
    render(
      <InteractiveCard onClick={onClick} onAction={onAction}>
        Both
      </InteractiveCard>,
    );
    await user.click(screen.getByRole('button', { name: 'Both' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    // onAction skipped because onClick called preventDefault
    expect(onAction).not.toHaveBeenCalled();
  });
});
