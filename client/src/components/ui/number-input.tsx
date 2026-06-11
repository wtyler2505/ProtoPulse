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
 * Render a finite number as a plain (non-exponential) decimal string with NO
 * precision loss.
 *
 * BL-0881: the previous implementation used
 * `value.toLocaleString('en-US', { maximumFractionDigits: 20 })` to strip
 * exponential notation. That has a hard floor — any magnitude below `1e-20`
 * (e.g. `1e-21`, a zeptofarad reactance) rounds to the string `"0"`, silently
 * lying about the value while still passing axe's `aria-valid-attr-value`
 * check. Intl's `maximumFractionDigits` cap (20 in ES2020 engines) makes
 * "bump the digit count" a fragile non-fix.
 *
 * Instead we expand JS exponential notation (`String(value)` emits it for
 * |value| < 1e-6 or >= 1e21) into a full decimal string by repositioning the
 * decimal point. This is lossless for every finite double — the shortest
 * round-trippable representation is preserved, just written out in full.
 */
function formatAriaNumber(value: number): string {
  const str = String(value);
  const match = /^(-?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/.exec(str);
  // Not in exponential form (ordinary integers/decimals) → already plain.
  if (!match) return str;

  const [, sign, intPart, fracPart = '', expStr] = match;
  const exp = parseInt(expStr, 10);
  const digits = intPart + fracPart;
  // Index (within `digits`) where the decimal point lands after applying exp.
  const pointPos = intPart.length + exp;

  let body: string;
  if (pointPos <= 0) {
    // Pure fraction: 0.000…<digits>
    body = `0.${'0'.repeat(-pointPos)}${digits}`;
  } else if (pointPos >= digits.length) {
    // Whole number padded with trailing zeros.
    body = digits + '0'.repeat(pointPos - digits.length);
  } else {
    body = `${digits.slice(0, pointPos)}.${digits.slice(pointPos)}`;
  }
  return sign + body;
}

function ariaValueNow(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return formatAriaNumber(value);
  if (typeof value === 'string' && value.trim() !== '') {
    const trimmed = value.trim();
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? formatAriaNumber(parsed) : undefined;
  }
  return undefined;
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  function NumberInput({ min, max, step, value, ...props }, ref) {
    const ariaAttrs: Record<string, string> = {};
    const safeMin =
      typeof min === 'number' && Number.isFinite(min) ? min : undefined;
    const safeMax =
      typeof max === 'number' && Number.isFinite(max) ? max : undefined;
    if (typeof safeMin === 'number') {
      ariaAttrs['aria-valuemin'] = formatAriaNumber(safeMin);
    }
    if (typeof safeMax === 'number') {
      ariaAttrs['aria-valuemax'] = formatAriaNumber(safeMax);
    }
    const now = ariaValueNow(value);
    if (typeof now === 'string') ariaAttrs['aria-valuenow'] = now;

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
