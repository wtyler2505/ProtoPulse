// ---------------------------------------------------------------------------
// button-type-audit.ts — Audits <button> elements for explicit `type` attributes
//
// Browsers default <button> to type="submit", which causes accidental form
// submissions when a button lacks an explicit type. This module provides
// utilities to detect such buttons and generate violation reports.
// ---------------------------------------------------------------------------

/**
 * The recommended default type for buttons. Buttons should explicitly set
 * `type="button"` unless they intentionally submit a form.
 */
export const DEFAULT_BUTTON_TYPE = 'button' as const;

/** A single button that is missing an explicit `type` attribute. */
export interface ButtonViolation {
  /** CSS-like selector describing the element (tag + id + classes). */
  selector: string;
  /** Truncated innerHTML of the button (for identification). */
  innerHTML?: string;
  /** Whether the button is nested inside a <form> element (higher risk). */
  parentForm?: boolean;
}

/** Aggregate result of a button-type audit. */
export interface ButtonAuditResult {
  /** Total number of <button> elements inspected. */
  total: number;
  /** Count of buttons that have an explicit `type` attribute. */
  withType: number;
  /** Count of buttons missing an explicit `type` attribute. */
  withoutType: number;
  /** Percentage (0-100) of buttons that have an explicit type. */
  percentage: number;
  /** Detailed list of every button missing an explicit type. */
  violations: ButtonViolation[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Checks whether a given button element is inside a `<form>`.
 * Walks up the DOM tree looking for a `<form>` ancestor.
 */
export function isInsideForm(button: Element): boolean {
  let current: Element | null = button.parentElement;
  while (current) {
    if (current.tagName === 'FORM') {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

/**
 * Builds a CSS-like selector string for a button element.
 * Format: `button#id.class1.class2` (id and classes are optional).
 */
function buildSelector(button: Element): string {
  let selector = 'button';
  if (button.id) {
    selector += `#${button.id}`;
  }
  if (button.classList.length > 0) {
    selector += Array.from(button.classList)
      .map((cls) => `.${cls}`)
      .join('');
  }
  return selector;
}

/**
 * Truncates innerHTML for display purposes, stripping excessive whitespace.
 * Returns `undefined` if the content is empty.
 */
function truncateInnerHTML(html: string, maxLength = 80): string | undefined {
  const trimmed = html.replace(/\s+/g, ' ').trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return trimmed.slice(0, maxLength) + '…';
}

// ---------------------------------------------------------------------------
// Core audit function
// ---------------------------------------------------------------------------

/**
 * Audits all `<button>` elements within the given container (defaults to
 * `document.body`) and reports which ones are missing an explicit `type`
 * attribute.
 *
 * @param container - The DOM element to search within. Defaults to `document.body`.
 * @returns An audit result with totals, percentage, and individual violations.
 */
export function auditButtonTypes(container?: Element): ButtonAuditResult {
  const root = container ?? document.body;
  const buttons = Array.from(root.querySelectorAll('button'));

  const violations: ButtonViolation[] = [];

  for (const button of buttons) {
    if (!button.hasAttribute('type')) {
      violations.push({
        selector: buildSelector(button),
        innerHTML: truncateInnerHTML(button.innerHTML),
        parentForm: isInsideForm(button) || undefined,
      });
    }
  }

  const total = buttons.length;
  const withoutType = violations.length;
  const withType = total - withoutType;
  const percentage = total === 0 ? 100 : Math.round((withType / total) * 10000) / 100;

  return {
    total,
    withType,
    withoutType,
    percentage,
    violations,
  };
}

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

/**
 * Generates a human-readable text report from an audit result.
 *
 * Example output:
 * ```
 * Button Type Audit: 8/10 (80%) have explicit type
 * 2 violations found:
 *   1. button.btn-primary — "Click me" — inside <form>
 *   2. button#save — "Save"
 * ```
 */
export function getViolationReport(result: ButtonAuditResult): string {
  const lines: string[] = [];

  lines.push(
    `Button Type Audit: ${result.withType}/${result.total} (${result.percentage}%) have explicit type`,
  );

  if (result.violations.length === 0) {
    lines.push('No violations found.');
    return lines.join('\n');
  }

  lines.push(`${result.violations.length} violation${result.violations.length === 1 ? '' : 's'} found:`);

  for (let i = 0; i < result.violations.length; i++) {
    const v = result.violations[i];
    const parts: string[] = [`  ${i + 1}. ${v.selector}`];
    if (v.innerHTML) {
      parts.push(`"${v.innerHTML}"`);
    }
    if (v.parentForm) {
      parts.push('inside <form>');
    }
    lines.push(parts.join(' — '));
  }

  return lines.join('\n');
}
