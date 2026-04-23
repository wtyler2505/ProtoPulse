/**
 * keyboard-helpers — Reusable Playwright helpers for the P1 keyboard-navigation
 * suite (Plan 03 Phase 6 / E2E-554).
 *
 * Kinetic counterpart to `a11y-helpers.ts` (static axe-core scan, Phase 5).
 * While axe catches structural WCAG issues, this module exercises interaction
 * semantics: WCAG 2.1 SC 2.1.1 (Keyboard), SC 2.1.2 (No Keyboard Trap),
 * SC 2.4.3 (Focus Order), and SC 2.4.7 (Focus Visible).
 *
 * Design goals:
 *   - Pure Playwright APIs (no page-script injection beyond `page.evaluate`).
 *   - Return structured data the caller can assert against — NOT bake asserts
 *     into the helpers so tests can inspect/log baselines.
 *   - Best-effort focus-ring detection: headless Chromium honours `:focus-visible`
 *     when focus is driven via `page.keyboard.press('Tab')`, so computed styles
 *     should reflect the real ring. If a caller gets false negatives, they can
 *     skip rather than fail.
 *
 * Intentional non-goals:
 *   - Arrow-key / roving-tabindex navigation inside composite widgets (grids,
 *     menubars) — those need widget-specific helpers.
 *   - Breadboard tie-point navigation — Plan 03 Phase 7 (E2E-625) deliberately
 *     omits per-hole tabIndex; any per-hole keyboard nav is out of scope.
 */

import type { Page } from '@playwright/test';

/**
 * A single focus stop captured while tabbing through the page.
 *
 * `accessibleName` is best-effort: aria-label > aria-labelledby-resolved text >
 * visible textContent (first 60 chars) > title > placeholder. Empty string
 * signals "no accessible name" — a WCAG 4.1.2 red flag the spec can assert on.
 */
export interface FocusStop {
  /** HTML tag name, uppercased (BUTTON, A, INPUT, ...). */
  tag: string;
  /** ARIA role — explicit `role` attr if present, otherwise empty. */
  role: string;
  /** `data-testid` if present, otherwise empty. */
  testid: string;
  /** Resolved accessible name — see interface docstring for priority order. */
  accessibleName: string;
  /** CSS selector stable enough to re-find the element (testid > tag+text). */
  selector: string;
}

/**
 * Snapshot the currently-focused element into a {@link FocusStop}.
 *
 * Runs inside the page via `page.evaluate` so it has live DOM access. Returns
 * `null` if `document.activeElement` is `null` or the `<body>` fallback.
 */
async function snapshotActiveElement(page: Page): Promise<FocusStop | null> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body || el === document.documentElement) {
      return null;
    }

    const ariaLabel = el.getAttribute('aria-label') ?? '';
    let labelledBy = '';
    const labelledById = el.getAttribute('aria-labelledby');
    if (labelledById) {
      const labelEl = document.getElementById(labelledById);
      labelledBy = labelEl?.textContent?.trim() ?? '';
    }
    const textContent = (el.textContent ?? '').trim().slice(0, 60);
    const title = el.getAttribute('title') ?? '';
    const placeholder = (el as HTMLInputElement).placeholder ?? '';

    const accessibleName =
      ariaLabel || labelledBy || textContent || title || placeholder || '';

    const testid = el.getAttribute('data-testid') ?? '';
    const role = el.getAttribute('role') ?? '';

    const selector = testid
      ? `[data-testid="${testid}"]`
      : `${el.tagName.toLowerCase()}${role ? `[role="${role}"]` : ''}`;

    return {
      tag: el.tagName,
      role,
      testid,
      accessibleName,
      selector,
    };
  });
}

export interface TabThroughOptions {
  /** Whether to start by focusing the body first (default: true). */
  resetFocus?: boolean;
  /** Delay (ms) between Tab presses — lets focus-visible/transitions settle. */
  stepDelayMs?: number;
}

/**
 * Press Tab `count` times, capturing the focused element after each press.
 *
 * Caller is responsible for having the page in a stable state before invocation
 * (navigation complete, lazy chunks resolved). The spec pattern is:
 *   await openView(page, 'dashboard');
 *   const stops = await tabThrough(page, 20);
 *
 * Returns an array of length ≤ `count`. Stops where `activeElement` is null/body
 * are represented as `null` entries so the caller can detect "tab fell off the
 * document" without losing position information.
 */
export async function tabThrough(
  page: Page,
  count: number,
  options: TabThroughOptions = {},
): Promise<Array<FocusStop | null>> {
  const { resetFocus = true, stepDelayMs = 20 } = options;

  if (resetFocus) {
    // Focus body so the first Tab lands on the first focusable element rather
    // than "next after whatever happened to be focused".
    await page.evaluate(() => {
      document.body.focus();
      (document.activeElement as HTMLElement | null)?.blur?.();
    });
  }

  const stops: Array<FocusStop | null> = [];
  for (let i = 0; i < count; i += 1) {
    await page.keyboard.press('Tab');
    if (stepDelayMs > 0) {
      // Allow any focus-visible transitions / async focus managers to settle.
      await page.waitForTimeout(stepDelayMs);
    }
    stops.push(await snapshotActiveElement(page));
  }
  return stops;
}

export interface NoKeyboardTrapOptions {
  /** Maximum Tabs to attempt before giving up and failing (default: 30). */
  maxSteps?: number;
  /**
   * Minimum distinct focus targets required to prove "no trap".
   * Default 5 — catches the common "focus pinned to a single modal close
   * button" trap while not demanding every app have 10+ tab stops.
   */
  minDistinctTargets?: number;
}

export interface NoKeyboardTrapResult {
  /** True iff we saw ≥ `minDistinctTargets` distinct focus targets. */
  escaped: boolean;
  /** Unique selectors observed during the scan. */
  distinctSelectors: string[];
  /** Raw sequence of focus stops for debugging. */
  stops: Array<FocusStop | null>;
}

/**
 * Verify that tabbing does NOT get trapped inside the page (WCAG SC 2.1.2).
 *
 * This is the "can the user escape?" check. We tab `maxSteps` times and count
 * the distinct focus targets; if we see a reasonable variety, the page is not
 * trapping focus on a single element.
 *
 * NOTE: This helper does NOT distinguish "trap inside a modal" from "app only
 * has one focusable element" — callers that open a modal should assert the
 * count is reasonable for that modal's content plus at least one focusable
 * outside of it, OR press Escape and re-run.
 */
export async function assertNoKeyboardTrap(
  page: Page,
  options: NoKeyboardTrapOptions = {},
): Promise<NoKeyboardTrapResult> {
  const { maxSteps = 30, minDistinctTargets = 5 } = options;
  const stops = await tabThrough(page, maxSteps, { resetFocus: true });
  const distinctSelectors = Array.from(
    new Set(stops.filter((s): s is FocusStop => s !== null).map((s) => s.selector)),
  );
  return {
    escaped: distinctSelectors.length >= minDistinctTargets,
    distinctSelectors,
    stops,
  };
}

/**
 * Focus the element matching `selector`, press Enter, and run `verify`.
 *
 * `verify` is an async callback the caller provides to assert the expected
 * outcome — e.g. a dialog became visible, a route changed, a handler fired.
 * This intentionally does NOT return a boolean; the caller uses Playwright's
 * own `expect()` inside `verify` so failures point to the real assertion.
 *
 * Returns true if the element was found + focused; false if `selector` did not
 * resolve. Callers typically `expect(true)` on the return value.
 */
export async function assertEnterActivates(
  page: Page,
  selector: string,
  verify: () => Promise<void>,
): Promise<boolean> {
  const locator = page.locator(selector).first();
  const count = await locator.count();
  if (count === 0) return false;

  await locator.focus();
  await page.keyboard.press('Enter');
  await verify();
  return true;
}

export interface FocusRingCheck {
  /** True iff getComputedStyle reported a non-zero outline OR non-none box-shadow. */
  visible: boolean;
  /** Raw computed outline string (e.g. "2px solid rgb(0, 240, 255)"). */
  outline: string;
  /** Raw computed box-shadow string. */
  boxShadow: string;
  /** Outline color alpha — 0 means transparent; informational. */
  outlineColor: string;
}

/**
 * Best-effort focus-ring visibility check (WCAG SC 2.4.7 Focus Visible).
 *
 * Focuses the first element matching `selector` and inspects computed styles
 * for either a non-zero outline OR a non-`none` box-shadow (the two idiomatic
 * ways Tailwind/shadcn express `:focus-visible` rings — see Plan 03 Phase 9
 * which ships `--color-focus-ring`).
 *
 * Returns `null` if `selector` did not resolve — callers should skip rather
 * than fail in that case.
 *
 * Known limitation: this does NOT measure contrast ratio (WCAG 1.4.11). That
 * requires sampling the adjacent surface colors and running a ΔL* calc; out of
 * scope for a green-baseline suite.
 */
export async function focusRingVisible(
  page: Page,
  selector: string,
): Promise<FocusRingCheck | null> {
  const locator = page.locator(selector).first();
  if ((await locator.count()) === 0) return null;

  await locator.focus();
  // Small settle — focus-visible transitions complete on next frame.
  await page.waitForTimeout(30);

  return page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) return null;
    const cs = window.getComputedStyle(el);
    const outline = cs.outline || '';
    const outlineWidth = parseFloat(cs.outlineWidth || '0');
    const boxShadow = cs.boxShadow || 'none';

    const hasOutline = outlineWidth > 0 && cs.outlineStyle !== 'none';
    const hasBoxShadow = boxShadow !== 'none' && boxShadow.trim().length > 0;

    return {
      visible: hasOutline || hasBoxShadow,
      outline,
      boxShadow,
      outlineColor: cs.outlineColor || '',
    };
  }, selector);
}
