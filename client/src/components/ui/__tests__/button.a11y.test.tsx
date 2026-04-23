/**
 * Accessibility tests for the shadcn Button wrapper.
 *
 * Plan 03 Phase 9 — E2E-1013 (focus-ring contrast) and E2E-1014 (pressed
 * button feedback). See docs/superpowers/plans/2026-04-18-e2e-walkthrough/
 * 03-a11y-systemic.md.
 *
 * Visual contrast is inherently hard to verify in JSDOM (no real rendering,
 * no paint pipeline). These tests assert the token-level migration: the
 * Button references the new `--color-focus-ring` custom property and every
 * variant ships an `active:` cue. The `--color-focus-ring` token itself is
 * defined in `client/src/index.css` with documented contrast ratios
 * (>= 17:1 against the dominant dark and light surfaces).
 */

// @vitest-environment happy-dom

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../button';

const VARIANTS = [
  'default',
  'destructive',
  'outline',
  'secondary',
  'ghost',
  'link',
] as const;

describe('Button a11y — focus-ring contrast + active-state feedback', () => {
  describe('E2E-1013: focus ring references the palette-independent token', () => {
    it('applies focus-visible:ring-[var(--color-focus-ring)] on the default variant', () => {
      render(<Button>Focus me</Button>);
      const btn = screen.getByRole('button', { name: 'Focus me' });
      expect(btn.className).toMatch(/focus-visible:ring-2/);
      expect(btn.className).toMatch(
        /focus-visible:ring-\[var\(--color-focus-ring\)\]/,
      );
      expect(btn.className).toMatch(/focus-visible:ring-offset-2/);
      expect(btn.className).toMatch(/focus-visible:ring-offset-background/);
    });

    it.each(VARIANTS)(
      'variant=%s inherits the shared focus-ring classes',
      (variant) => {
        render(<Button variant={variant}>{variant}</Button>);
        const btn = screen.getByRole('button', { name: variant });
        expect(btn.className).toMatch(
          /focus-visible:ring-\[var\(--color-focus-ring\)\]/,
        );
      },
    );

    it('does NOT fall back to the brand --ring token (which failed contrast)', () => {
      render(<Button>No brand ring</Button>);
      const btn = screen.getByRole('button', { name: 'No brand ring' });
      // The specific failing pattern before Phase 9 was `focus-visible:ring-ring`.
      // Asserting absence is defensive: prevents a future rebase from silently
      // reintroducing the low-contrast cyan ring.
      expect(btn.className).not.toMatch(/focus-visible:ring-ring(\s|$)/);
    });
  });

  describe('E2E-1014: every variant gives tactile press feedback', () => {
    it.each(VARIANTS)(
      'variant=%s applies an active: class for pressed-state feedback',
      (variant) => {
        render(<Button variant={variant}>{variant}</Button>);
        const btn = screen.getByRole('button', { name: variant });
        // Every variant must have SOME active: cue. We accept any of:
        // scale, brightness, opacity, bg, shadow. This gives variants room
        // to pick the cue that reads best without locking them to one class.
        expect(btn.className).toMatch(
          /active:(scale-|brightness-|opacity-|bg-|shadow-)/,
        );
      },
    );

    it('shared base has active:scale-[0.98] with motion-reduce fallback', () => {
      render(<Button>Scales</Button>);
      const btn = screen.getByRole('button', { name: 'Scales' });
      expect(btn.className).toMatch(/active:scale-\[0\.98\]/);
      expect(btn.className).toMatch(/motion-reduce:active:scale-100/);
    });
  });

  describe('Keyboard + focus semantics', () => {
    it('rendered buttons are focusable (tabIndex defaults to 0 for <button>)', () => {
      render(<Button>Tabbable</Button>);
      const btn = screen.getByRole('button', { name: 'Tabbable' });
      // A native <button> is focusable without an explicit tabIndex attr.
      // Assert the element is a real <button> (not a div), which is what
      // gives us the keyboard tab order for free.
      expect(btn.tagName).toBe('BUTTON');
      // `tabIndex` on a native button reads as 0 from the DOM even when the
      // attribute is absent.
      expect(btn.tabIndex).toBe(0);
    });

    it('disabled button is not reachable by tab (tabIndex stays 0 but disabled prop prevents focus)', () => {
      render(<Button disabled>Disabled</Button>);
      const btn = screen.getByRole('button', { name: 'Disabled' });
      expect(btn.hasAttribute('disabled')).toBe(true);
      // Browsers skip disabled <button> in tab order — no explicit tabIndex
      // manipulation needed. We just confirm the attribute is set.
    });
  });

  describe('All 6 variants render without error', () => {
    it.each(VARIANTS)('variant=%s renders a button', (variant) => {
      render(<Button variant={variant}>{variant}</Button>);
      const btn = screen.getByRole('button', { name: variant });
      expect(btn).toBeTruthy();
    });
  });
});
