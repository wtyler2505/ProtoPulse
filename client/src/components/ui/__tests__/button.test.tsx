/**
 * Tests for the shadcn Button wrapper — specifically the type="button"
 * default added 2026-04-17 (audit #61).
 *
 * Rationale: HTML's <button> defaults to type="submit" when rendered inside
 * a <form>, silently submitting on Enter/Space. The Button component now
 * forces type="button" unless the consumer explicitly passes one.
 */

// @vitest-environment happy-dom

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../button';

describe('Button — default type="button" prevents accidental form submission', () => {
  it('renders with type="button" by default', () => {
    render(<Button>Click me</Button>);
    const btn = screen.getByRole('button', { name: 'Click me' });
    expect(btn.getAttribute('type')).toBe('button');
  });

  it('respects explicit type="submit"', () => {
    render(<Button type="submit">Submit form</Button>);
    const btn = screen.getByRole('button', { name: 'Submit form' });
    expect(btn.getAttribute('type')).toBe('submit');
  });

  it('respects explicit type="reset"', () => {
    render(<Button type="reset">Reset</Button>);
    const btn = screen.getByRole('button', { name: 'Reset' });
    expect(btn.getAttribute('type')).toBe('reset');
  });

  it('does not submit form when Enter pressed on default-type button inside form', () => {
    let submittedCount = 0;
    const onSubmit = (e: React.FormEvent): void => {
      submittedCount += 1;
      e.preventDefault();
    };
    render(
      <form onSubmit={onSubmit} data-testid="host-form">
        <input type="text" defaultValue="abc" />
        <Button>Cancel</Button>
      </form>,
    );
    const btn = screen.getByRole('button', { name: 'Cancel' });
    // Synthesize what happens when user activates a button with Space/Enter:
    // Native behavior is form submit IFF type is "submit". Our default is
    // "button" which produces no submit. Assert via direct DOM form.submit
    // attempt: the button's click dispatches only if type==="submit".
    btn.click();
    expect(submittedCount).toBe(0);
  });

  it('DOES submit form when an explicit submit-type Button is clicked', () => {
    let submittedCount = 0;
    const onSubmit = (e: React.FormEvent): void => {
      submittedCount += 1;
      e.preventDefault();
    };
    render(
      <form onSubmit={onSubmit} data-testid="host-form">
        <Button type="submit">Save</Button>
      </form>,
    );
    const btn = screen.getByRole('button', { name: 'Save' });
    btn.click();
    expect(submittedCount).toBe(1);
  });

  it('passes all other props through (className, disabled, onClick)', () => {
    let clicks = 0;
    render(
      <Button
        className="custom-class"
        disabled
        onClick={() => {
          clicks += 1;
        }}
      >
        Disabled
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Disabled' });
    expect(btn.className).toContain('custom-class');
    expect(btn.hasAttribute('disabled')).toBe(true);
    btn.click();
    expect(clicks).toBe(0); // disabled buttons don't fire onClick
  });

  it('when asChild=true, does not force type= on the rendered child', () => {
    // asChild uses Radix Slot to render the child element directly. The
    // child is typically <a> or similar which doesn't have a type attr.
    render(
      <Button asChild>
        <a href="/somewhere">Link styled as button</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Link styled as button' });
    // <a> must NOT have a `type` attribute injected by our wrapper — that
    // would be semantically wrong (type on <a> means MIME type).
    expect(link.hasAttribute('type')).toBe(false);
  });

  it('asChild + explicit type="submit" still propagates nothing to anchor children', () => {
    render(
      <Button asChild type="submit">
        <a href="/elsewhere">Anchor</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Anchor' });
    // Even with explicit type, we don't force it onto a child that wouldn't
    // understand it. The user opted into asChild rendering.
    expect(link.hasAttribute('type')).toBe(false);
  });
});
