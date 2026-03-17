import { describe, it, expect, beforeEach } from 'vitest';
import {
  auditButtonTypes,
  getViolationReport,
  isInsideForm,
  DEFAULT_BUTTON_TYPE,
} from '../button-type-audit';
import type { ButtonAuditResult } from '../button-type-audit';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

function addButton(attrs: Record<string, string> = {}, innerHTML = ''): HTMLButtonElement {
  const btn = document.createElement('button');
  for (const [key, value] of Object.entries(attrs)) {
    btn.setAttribute(key, value);
  }
  btn.innerHTML = innerHTML;
  container.appendChild(btn);
  return btn;
}

function addButtonInForm(attrs: Record<string, string> = {}, innerHTML = ''): HTMLButtonElement {
  const form = document.createElement('form');
  const btn = document.createElement('button');
  for (const [key, value] of Object.entries(attrs)) {
    btn.setAttribute(key, value);
  }
  btn.innerHTML = innerHTML;
  form.appendChild(btn);
  container.appendChild(form);
  return btn;
}

// ---------------------------------------------------------------------------
// DEFAULT_BUTTON_TYPE constant
// ---------------------------------------------------------------------------

describe('DEFAULT_BUTTON_TYPE', () => {
  it('equals "button" (not "submit")', () => {
    expect(DEFAULT_BUTTON_TYPE).toBe('button');
  });
});

// ---------------------------------------------------------------------------
// isInsideForm
// ---------------------------------------------------------------------------

describe('isInsideForm', () => {
  it('returns true when button is a direct child of <form>', () => {
    const btn = addButtonInForm({ type: 'button' });
    expect(isInsideForm(btn)).toBe(true);
  });

  it('returns true when button is deeply nested inside <form>', () => {
    const form = document.createElement('form');
    const div1 = document.createElement('div');
    const div2 = document.createElement('div');
    const btn = document.createElement('button');
    div2.appendChild(btn);
    div1.appendChild(div2);
    form.appendChild(div1);
    container.appendChild(form);

    expect(isInsideForm(btn)).toBe(true);
  });

  it('returns false when button is outside any <form>', () => {
    const btn = addButton({ type: 'submit' });
    expect(isInsideForm(btn)).toBe(false);
  });

  it('returns false for a top-level button (no parent)', () => {
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    expect(isInsideForm(btn)).toBe(false);
    document.body.removeChild(btn);
  });
});

// ---------------------------------------------------------------------------
// auditButtonTypes
// ---------------------------------------------------------------------------

describe('auditButtonTypes', () => {
  it('returns zero totals for an empty container', () => {
    const result = auditButtonTypes(container);
    expect(result.total).toBe(0);
    expect(result.withType).toBe(0);
    expect(result.withoutType).toBe(0);
    expect(result.percentage).toBe(100);
    expect(result.violations).toEqual([]);
  });

  it('reports 100% when all buttons have explicit type', () => {
    addButton({ type: 'button' });
    addButton({ type: 'submit' });
    addButton({ type: 'reset' });

    const result = auditButtonTypes(container);
    expect(result.total).toBe(3);
    expect(result.withType).toBe(3);
    expect(result.withoutType).toBe(0);
    expect(result.percentage).toBe(100);
    expect(result.violations).toHaveLength(0);
  });

  it('reports 0% when no buttons have explicit type', () => {
    addButton();
    addButton();

    const result = auditButtonTypes(container);
    expect(result.total).toBe(2);
    expect(result.withType).toBe(0);
    expect(result.withoutType).toBe(2);
    expect(result.percentage).toBe(0);
    expect(result.violations).toHaveLength(2);
  });

  it('computes correct percentage for mixed buttons', () => {
    addButton({ type: 'button' });
    addButton();
    addButton({ type: 'submit' });
    addButton();

    const result = auditButtonTypes(container);
    expect(result.total).toBe(4);
    expect(result.withType).toBe(2);
    expect(result.withoutType).toBe(2);
    expect(result.percentage).toBe(50);
  });

  it('captures selector with id and classes in violation', () => {
    addButton({ id: 'save-btn', class: 'primary large' });

    const result = auditButtonTypes(container);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].selector).toBe('button#save-btn.primary.large');
  });

  it('captures plain "button" selector when no id/class', () => {
    addButton();

    const result = auditButtonTypes(container);
    expect(result.violations[0].selector).toBe('button');
  });

  it('captures innerHTML in violation', () => {
    addButton({}, 'Click me');

    const result = auditButtonTypes(container);
    expect(result.violations[0].innerHTML).toBe('Click me');
  });

  it('truncates long innerHTML at 80 characters', () => {
    const longText = 'A'.repeat(120);
    addButton({}, longText);

    const result = auditButtonTypes(container);
    expect(result.violations[0].innerHTML).toHaveLength(81); // 80 + ellipsis char
    expect(result.violations[0].innerHTML?.endsWith('\u2026')).toBe(true);
  });

  it('sets innerHTML to undefined for empty buttons', () => {
    addButton();

    const result = auditButtonTypes(container);
    expect(result.violations[0].innerHTML).toBeUndefined();
  });

  it('collapses whitespace in innerHTML', () => {
    addButton({}, '  Hello   World  ');

    const result = auditButtonTypes(container);
    expect(result.violations[0].innerHTML).toBe('Hello World');
  });

  it('sets parentForm when button is inside a form', () => {
    addButtonInForm({}, 'Submit');

    const result = auditButtonTypes(container);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].parentForm).toBe(true);
  });

  it('does not set parentForm when button is outside a form', () => {
    addButton({}, 'Click');

    const result = auditButtonTypes(container);
    expect(result.violations[0].parentForm).toBeUndefined();
  });

  it('defaults to document.body when no container is provided', () => {
    // The container is already appended to document.body by beforeEach
    addButton({ type: 'button' }, 'Typed');
    addButton({}, 'Untyped');

    const result = auditButtonTypes();
    // Should find at least the buttons we added (others may exist in body)
    expect(result.total).toBeGreaterThanOrEqual(2);
    expect(result.withoutType).toBeGreaterThanOrEqual(1);
  });

  it('only inspects buttons within the given container', () => {
    addButton({}, 'In container');

    const otherContainer = document.createElement('div');
    const otherBtn = document.createElement('button');
    otherBtn.textContent = 'Outside';
    otherContainer.appendChild(otherBtn);
    document.body.appendChild(otherContainer);

    const result = auditButtonTypes(container);
    expect(result.total).toBe(1);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].innerHTML).toBe('In container');

    document.body.removeChild(otherContainer);
  });

  it('does not flag buttons that have type="button"', () => {
    addButton({ type: 'button' }, 'Safe');
    const result = auditButtonTypes(container);
    expect(result.violations).toHaveLength(0);
  });

  it('does not flag buttons that have type="submit"', () => {
    addButton({ type: 'submit' }, 'Submit');
    const result = auditButtonTypes(container);
    expect(result.violations).toHaveLength(0);
  });

  it('does not flag buttons that have type="reset"', () => {
    addButton({ type: 'reset' }, 'Reset');
    const result = auditButtonTypes(container);
    expect(result.violations).toHaveLength(0);
  });

  it('handles buttons with class but no id', () => {
    addButton({ class: 'btn-danger' }, 'Delete');
    const result = auditButtonTypes(container);
    expect(result.violations[0].selector).toBe('button.btn-danger');
  });

  it('handles mixed form and non-form violations', () => {
    addButton({}, 'Outside form');
    addButtonInForm({}, 'Inside form');

    const result = auditButtonTypes(container);
    expect(result.violations).toHaveLength(2);

    const formViolation = result.violations.find((v) => v.parentForm === true);
    const noFormViolation = result.violations.find((v) => v.parentForm === undefined);
    expect(formViolation).toBeDefined();
    expect(noFormViolation).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// getViolationReport
// ---------------------------------------------------------------------------

describe('getViolationReport', () => {
  it('generates a clean report for zero violations', () => {
    const result: ButtonAuditResult = {
      total: 5,
      withType: 5,
      withoutType: 0,
      percentage: 100,
      violations: [],
    };

    const report = getViolationReport(result);
    expect(report).toContain('5/5 (100%)');
    expect(report).toContain('No violations found.');
  });

  it('generates a report with violations', () => {
    const result: ButtonAuditResult = {
      total: 3,
      withType: 1,
      withoutType: 2,
      percentage: 33.33,
      violations: [
        { selector: 'button.btn-primary', innerHTML: 'Click me', parentForm: true },
        { selector: 'button#save' },
      ],
    };

    const report = getViolationReport(result);
    expect(report).toContain('1/3 (33.33%)');
    expect(report).toContain('2 violations found:');
    expect(report).toContain('1. button.btn-primary');
    expect(report).toContain('"Click me"');
    expect(report).toContain('inside <form>');
    expect(report).toContain('2. button#save');
  });

  it('uses singular "violation" for a single violation', () => {
    const result: ButtonAuditResult = {
      total: 1,
      withType: 0,
      withoutType: 1,
      percentage: 0,
      violations: [{ selector: 'button' }],
    };

    const report = getViolationReport(result);
    expect(report).toContain('1 violation found:');
    expect(report).not.toContain('violations found:');
  });

  it('handles empty total gracefully', () => {
    const result: ButtonAuditResult = {
      total: 0,
      withType: 0,
      withoutType: 0,
      percentage: 100,
      violations: [],
    };

    const report = getViolationReport(result);
    expect(report).toContain('0/0 (100%)');
    expect(report).toContain('No violations found.');
  });

  it('omits innerHTML segment when undefined', () => {
    const result: ButtonAuditResult = {
      total: 1,
      withType: 0,
      withoutType: 1,
      percentage: 0,
      violations: [{ selector: 'button.ghost' }],
    };

    const report = getViolationReport(result);
    // Should NOT have an extra " — " after selector
    expect(report).toContain('1. button.ghost');
    expect(report).not.toContain('""');
  });

  it('omits parentForm segment when falsy', () => {
    const result: ButtonAuditResult = {
      total: 1,
      withType: 0,
      withoutType: 1,
      percentage: 0,
      violations: [{ selector: 'button', innerHTML: 'OK' }],
    };

    const report = getViolationReport(result);
    expect(report).not.toContain('inside <form>');
  });

  it('includes both innerHTML and parentForm when present', () => {
    const result: ButtonAuditResult = {
      total: 1,
      withType: 0,
      withoutType: 1,
      percentage: 0,
      violations: [{ selector: 'button', innerHTML: 'Send', parentForm: true }],
    };

    const report = getViolationReport(result);
    expect(report).toContain('"Send" — inside <form>');
  });
});
