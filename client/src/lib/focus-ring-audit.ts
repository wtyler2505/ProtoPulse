/**
 * Focus Ring Audit — BL-0321
 *
 * Scans the DOM for interactive elements that lack visible :focus-visible styles.
 * Returns a list of violations so developers and automated tests can catch
 * accessibility regressions early.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single focus-ring audit violation. */
export interface FocusRingViolation {
  /** The offending DOM element. */
  element: Element;
  /** CSS selector that uniquely identifies the element (best-effort). */
  selector: string;
  /** Human-readable reason the element was flagged. */
  reason: string;
  /** The element's tag name (lowercase). */
  tagName: string;
  /** The element's role attribute value, if any. */
  role: string | null;
}

/** Options for `auditFocusRings`. */
export interface AuditFocusRingsOptions {
  /**
   * Root element to scan. Defaults to `document.body`.
   */
  root?: Element;
  /**
   * CSS selector for elements to skip (e.g. hidden utilities).
   * Matched elements and their descendants are excluded.
   */
  exclude?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Interactive element selectors that MUST have visible focus indicators. */
const INTERACTIVE_SELECTORS = [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  '[tabindex]:not([tabindex="-1"])',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="switch"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="combobox"]',
  '[role="option"]',
  '[contenteditable="true"]',
] as const;

/** CSS properties that indicate a visible focus style is applied. */
const FOCUS_INDICATOR_PROPERTIES = [
  'outlineStyle',
  'outlineWidth',
  'outlineColor',
  'boxShadow',
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a best-effort CSS selector for an element.
 */
export function buildSelector(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const classes = el.className && typeof el.className === 'string'
    ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.')
    : '';
  const role = el.getAttribute('role') ? `[role="${el.getAttribute('role')}"]` : '';
  const type = el.getAttribute('type') ? `[type="${el.getAttribute('type')}"]` : '';
  const testId = el.getAttribute('data-testid') ? `[data-testid="${el.getAttribute('data-testid')}"]` : '';

  // Prefer data-testid for clarity
  if (testId) {
    return `${tag}${testId}`;
  }
  return `${tag}${id}${role}${type}${classes}`.slice(0, 120);
}

/**
 * Check whether an element is effectively hidden from the user
 * (display:none, visibility:hidden, aria-hidden, disabled, zero dimensions).
 */
export function isHiddenOrDisabled(el: Element): boolean {
  // Disabled elements are not keyboard-focusable in most browsers
  if ((el as HTMLButtonElement).disabled) {
    return true;
  }
  if (el.getAttribute('aria-hidden') === 'true') {
    return true;
  }
  if (el.closest('[aria-hidden="true"]')) {
    return true;
  }
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') {
    return true;
  }
  // In a real browser, zero-dimension elements are effectively invisible.
  // In test environments (happy-dom/jsdom), getBoundingClientRect always returns
  // zeroes, so we only apply this check when layout is actually computed.
  if (typeof el.getBoundingClientRect === 'function') {
    const rect = el.getBoundingClientRect();
    // Only treat as hidden if the element also has display/visibility that
    // would cause zero dimensions. Zero-rect alone is unreliable in test envs.
    if (rect.width === 0 && rect.height === 0 && style.display !== '' && style.overflow === 'hidden') {
      return true;
    }
  }
  return false;
}

/**
 * Determine whether an element has a visible focus indicator.
 *
 * We check:
 * 1. The element or an ancestor has the `.focus-ring` utility class.
 * 2. Inline focus-visible classes from Tailwind (focus-visible:ring-*, focus-visible:outline-*).
 * 3. The computed outline/boxShadow are non-trivial.
 *
 * Note: In a test (JSDOM / happy-dom) environment, `getComputedStyle` won't
 * reflect real CSS so we rely on class-based heuristics there.
 */
export function hasFocusIndicator(el: Element): boolean {
  const classList = el.className && typeof el.className === 'string' ? el.className : '';

  // Class-based detection (works in both DOM and test environments)
  if (el.classList.contains('focus-ring')) {
    return true;
  }

  // Tailwind focus-visible utility classes
  if (/focus-visible:(outline|ring)/.test(classList)) {
    return true;
  }

  // Check computed styles (only meaningful in a real browser)
  if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
    const style = window.getComputedStyle(el);

    // Non-none outline with positive width
    const outlineStyle = style.getPropertyValue('outline-style');
    const outlineWidth = parseFloat(style.getPropertyValue('outline-width') || '0');
    if (outlineStyle && outlineStyle !== 'none' && outlineWidth > 0) {
      return true;
    }

    // box-shadow that looks like a ring (non-"none" value)
    const shadow = style.getPropertyValue('box-shadow');
    if (shadow && shadow !== 'none') {
      return true;
    }
  }

  // Native form controls have browser-default focus rings
  const tag = el.tagName.toLowerCase();
  if (['input', 'select', 'textarea'].includes(tag)) {
    // These get global :focus-visible styles from index.css
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Main audit function
// ---------------------------------------------------------------------------

/**
 * Scan the DOM tree for interactive elements that lack visible focus indicators.
 *
 * @returns Array of violations. An empty array means all interactive elements
 *          have visible focus styles.
 */
export function auditFocusRings(options: AuditFocusRingsOptions = {}): FocusRingViolation[] {
  const root = options.root ?? document.body;
  if (!root) {
    return [];
  }

  const combinedSelector = INTERACTIVE_SELECTORS.join(', ');
  const candidates = root.querySelectorAll(combinedSelector);
  const violations: FocusRingViolation[] = [];

  for (const el of Array.from(candidates)) {
    // Skip excluded subtrees
    if (options.exclude && el.closest(options.exclude)) {
      continue;
    }

    // Skip hidden / disabled elements
    if (isHiddenOrDisabled(el)) {
      continue;
    }

    // Check for focus indicator
    if (!hasFocusIndicator(el)) {
      violations.push({
        element: el,
        selector: buildSelector(el),
        reason: 'No visible :focus-visible indicator detected (no outline, ring, or focus-ring class)',
        tagName: el.tagName.toLowerCase(),
        role: el.getAttribute('role'),
      });
    }
  }

  return violations;
}

/** Re-export constants for testing. */
export { INTERACTIVE_SELECTORS, FOCUS_INDICATOR_PROPERTIES };
