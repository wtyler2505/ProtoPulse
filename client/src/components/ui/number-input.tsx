/**
 * NumberInput — accessible numeric input wrapper.
 *
 * Fixes E2E-236 / E2E-271 / E2E-284: the Chrome DevTools accessibility tree
 * was reporting `valuemax="0"` on `<input type="number">` elements that had
 * no `max` attribute set, which made assistive tech (and automated tooling)
 * believe the spinbutton's upper bound was 0 — i.e., could not be incremented
 * at all.
 *
 * The two-part remediation is:
 *   1. Consumers of NumberInput must pass a real `max` (and `min` where
 *      meaningful). That way the HTML `max` attribute is present and Chromium
 *      does NOT synthesise a zero default on the accessibility tree.
 *   2. NumberInput explicitly mirrors the `min`/`max`/`value` props onto
 *      `aria-valuemin`/`aria-valuemax`/`aria-valuenow` so that the spinbutton
 *      role's exposed bounds always agree with the HTML constraint attrs.
 *      When `max` (or `min`) is intentionally undefined, we OMIT the ARIA
 *      attribute entirely rather than emitting a bogus `0` — matching the
 *      WAI-ARIA 1.2 guidance that `aria-valuemax` should be absent when the
 *      spinbutton has no defined upper bound.
 *
 * Reference:
 *   - https://www.w3.org/TR/wai-aria-1.2/#spinbutton
 *   - docs/audits/2026-04-18-frontend-e2e-walkthrough.md (E2E-236/271/284)
 *   - docs/superpowers/plans/2026-04-18-e2e-walkthrough/02-p1-dead-buttons.md
 *     (Plan 02 Phase 7)
 */

import * as React from 'react';

import { Input } from '@/components/ui/input';

export interface NumberInputProps
  extends Omit<React.ComponentPropsWithoutRef<typeof Input>, 'type'> {
  /** Minimum allowed value (mirrored to `min` and `aria-valuemin`). */
  min?: number;
  /** Maximum allowed value (mirrored to `max` and `aria-valuemax`). */
  max?: number;
  /** Step — forwarded as-is to the underlying input. */
  step?: number | string;
}

/**
 * Coerce the Input `value` prop into an ARIA-compatible numeric value.
 * Returns `undefined` when the value cannot be parsed, which signals callers
 * to OMIT the `aria-valuenow` attribute rather than emit `NaN` or `0`.
 */
function ariaValueNow(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  function NumberInput({ min, max, step, value, ...props }, ref) {
    const ariaAttrs: Record<string, number> = {};
    const safeMin =
      typeof min === 'number' && Number.isFinite(min) ? min : undefined;
    const safeMax =
      typeof max === 'number' && Number.isFinite(max) ? max : undefined;
    if (typeof safeMin === 'number') ariaAttrs['aria-valuemin'] = safeMin;
    if (typeof safeMax === 'number') ariaAttrs['aria-valuemax'] = safeMax;
    const now = ariaValueNow(value);
    if (typeof now === 'number') ariaAttrs['aria-valuenow'] = now;

    return (
      <Input
        ref={ref}
        type="number"
        min={safeMin}
        max={safeMax}
        step={step}
        value={value}
        {...ariaAttrs}
        {...props}
      />
    );
  },
);

NumberInput.displayName = 'NumberInput';

export { NumberInput };
