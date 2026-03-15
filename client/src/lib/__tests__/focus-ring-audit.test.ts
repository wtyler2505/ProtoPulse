import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  auditFocusRings,
  buildSelector,
  isHiddenOrDisabled,
  hasFocusIndicator,
  INTERACTIVE_SELECTORS,
} from '../focus-ring-audit';
import type { FocusRingViolation } from '../focus-ring-audit';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let container: HTMLDivElement;

function setup(html: string): void {
  container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
});

// ---------------------------------------------------------------------------
// buildSelector
// ---------------------------------------------------------------------------

describe('buildSelector', () => {
  it('uses data-testid when present', () => {
    setup('<button data-testid="save-btn">Save</button>');
    const el = container.querySelector('button')!;
    expect(buildSelector(el)).toBe('button[data-testid="save-btn"]');
  });

  it('includes id when present', () => {
    setup('<a id="home-link" href="/">Home</a>');
    const el = container.querySelector('a')!;
    expect(buildSelector(el)).toContain('#home-link');
  });

  it('includes role attribute', () => {
    setup('<div role="button">Click</div>');
    const el = container.querySelector('[role="button"]')!;
    expect(buildSelector(el)).toContain('[role="button"]');
  });

  it('includes type attribute for inputs', () => {
    setup('<input type="email" />');
    const el = container.querySelector('input')!;
    expect(buildSelector(el)).toContain('[type="email"]');
  });

  it('includes up to 3 class names', () => {
    setup('<button class="btn btn-primary btn-lg btn-extra">X</button>');
    const el = container.querySelector('button')!;
    const sel = buildSelector(el);
    expect(sel).toContain('.btn.btn-primary.btn-lg');
    expect(sel).not.toContain('btn-extra');
  });

  it('handles elements with no attributes gracefully', () => {
    setup('<button>Plain</button>');
    const el = container.querySelector('button')!;
    expect(buildSelector(el)).toBe('button');
  });
});

// ---------------------------------------------------------------------------
// isHiddenOrDisabled
// ---------------------------------------------------------------------------

describe('isHiddenOrDisabled', () => {
  it('returns true for disabled buttons', () => {
    setup('<button disabled>Disabled</button>');
    const el = container.querySelector('button')!;
    expect(isHiddenOrDisabled(el)).toBe(true);
  });

  it('returns true for aria-hidden elements', () => {
    setup('<button aria-hidden="true">Hidden</button>');
    const el = container.querySelector('button')!;
    expect(isHiddenOrDisabled(el)).toBe(true);
  });

  it('returns true for elements inside aria-hidden ancestors', () => {
    setup('<div aria-hidden="true"><button>Nested</button></div>');
    const el = container.querySelector('button')!;
    expect(isHiddenOrDisabled(el)).toBe(true);
  });

  it('returns false for visible enabled elements', () => {
    setup('<button>Visible</button>');
    const el = container.querySelector('button')!;
    expect(isHiddenOrDisabled(el)).toBe(false);
  });

  it('returns true for disabled inputs', () => {
    setup('<input type="text" disabled />');
    const el = container.querySelector('input')!;
    expect(isHiddenOrDisabled(el)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// hasFocusIndicator
// ---------------------------------------------------------------------------

describe('hasFocusIndicator', () => {
  it('returns true when element has focus-ring class', () => {
    setup('<button class="focus-ring">OK</button>');
    const el = container.querySelector('button')!;
    expect(hasFocusIndicator(el)).toBe(true);
  });

  it('returns true for Tailwind focus-visible:ring-* classes', () => {
    setup('<button class="focus-visible:ring-2 focus-visible:ring-ring">OK</button>');
    const el = container.querySelector('button')!;
    expect(hasFocusIndicator(el)).toBe(true);
  });

  it('returns true for Tailwind focus-visible:outline-* classes', () => {
    setup('<button class="focus-visible:outline-none focus-visible:ring-1">OK</button>');
    const el = container.querySelector('button')!;
    expect(hasFocusIndicator(el)).toBe(true);
  });

  it('returns true for native form controls (input)', () => {
    setup('<input type="text" />');
    const el = container.querySelector('input')!;
    expect(hasFocusIndicator(el)).toBe(true);
  });

  it('returns true for native form controls (select)', () => {
    setup('<select><option>A</option></select>');
    const el = container.querySelector('select')!;
    expect(hasFocusIndicator(el)).toBe(true);
  });

  it('returns true for native form controls (textarea)', () => {
    setup('<textarea></textarea>');
    const el = container.querySelector('textarea')!;
    expect(hasFocusIndicator(el)).toBe(true);
  });

  it('returns false for bare div[role=button] without focus classes', () => {
    setup('<div role="button">Click</div>');
    const el = container.querySelector('[role="button"]')!;
    expect(hasFocusIndicator(el)).toBe(false);
  });

  it('returns false for anchor with no focus classes', () => {
    setup('<a href="/test">Link</a>');
    const el = container.querySelector('a')!;
    expect(hasFocusIndicator(el)).toBe(false);
  });

  it('returns false for plain button without focus classes', () => {
    setup('<button class="btn-plain">No ring</button>');
    const el = container.querySelector('button')!;
    expect(hasFocusIndicator(el)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// auditFocusRings
// ---------------------------------------------------------------------------

describe('auditFocusRings', () => {
  it('returns empty array when no interactive elements exist', () => {
    setup('<div><p>Static content</p></div>');
    const violations = auditFocusRings({ root: container });
    expect(violations).toEqual([]);
  });

  it('returns empty array when all elements have focus indicators', () => {
    setup(`
      <button class="focus-ring">OK</button>
      <input type="text" />
      <a href="/" class="focus-visible:ring-2">Home</a>
    `);
    const violations = auditFocusRings({ root: container });
    expect(violations).toEqual([]);
  });

  it('detects violation on bare anchor without focus classes', () => {
    setup('<a href="/about">About</a>');
    const violations = auditFocusRings({ root: container });
    expect(violations.length).toBe(1);
    expect(violations[0].tagName).toBe('a');
    expect(violations[0].reason).toContain('No visible :focus-visible indicator');
  });

  it('detects violation on div[role=button] without focus classes', () => {
    setup('<div role="button" tabindex="0">Click me</div>');
    const violations = auditFocusRings({ root: container });
    // Both [role="button"] and [tabindex] selectors match, but it should be deduplicated
    const roleButtonViolations = violations.filter((v) => v.role === 'button');
    expect(roleButtonViolations.length).toBeGreaterThanOrEqual(1);
    expect(roleButtonViolations[0].reason).toContain('No visible :focus-visible indicator');
  });

  it('detects violation on button without focus classes', () => {
    setup('<button class="bare-button">Submit</button>');
    const violations = auditFocusRings({ root: container });
    expect(violations.length).toBe(1);
    expect(violations[0].tagName).toBe('button');
  });

  it('skips disabled elements', () => {
    setup('<button disabled>Disabled</button>');
    const violations = auditFocusRings({ root: container });
    expect(violations).toEqual([]);
  });

  it('skips aria-hidden elements', () => {
    setup('<button aria-hidden="true">Hidden</button>');
    const violations = auditFocusRings({ root: container });
    expect(violations).toEqual([]);
  });

  it('skips hidden inputs', () => {
    setup('<input type="hidden" name="csrf" value="abc" />');
    const violations = auditFocusRings({ root: container });
    expect(violations).toEqual([]);
  });

  it('respects exclude option', () => {
    setup(`
      <div class="toolbar"><button class="bare">Tool</button></div>
      <div class="main"><button class="bare">Main</button></div>
    `);
    const violations = auditFocusRings({ root: container, exclude: '.toolbar' });
    expect(violations.length).toBe(1);
    expect(violations[0].selector).not.toContain('toolbar');
  });

  it('scans custom root instead of document.body', () => {
    // Add a violation outside the custom root — should not be detected
    const outsideDiv = document.createElement('div');
    outsideDiv.innerHTML = '<button class="no-focus">Outside</button>';
    document.body.appendChild(outsideDiv);

    setup('<button class="focus-ring">Inside</button>');
    const violations = auditFocusRings({ root: container });
    expect(violations).toEqual([]);
  });

  it('returns correct violation shape', () => {
    setup('<div role="tab" tabindex="0" data-testid="settings-tab">Settings</div>');
    const violations = auditFocusRings({ root: container });
    expect(violations.length).toBeGreaterThanOrEqual(1);
    const v = violations[0];
    expect(v).toHaveProperty('element');
    expect(v).toHaveProperty('selector');
    expect(v).toHaveProperty('reason');
    expect(v).toHaveProperty('tagName');
    expect(v).toHaveProperty('role');
    expect(v.tagName).toBe('div');
    expect(v.role).toBe('tab');
    expect(v.selector).toContain('data-testid="settings-tab"');
  });

  it('handles multiple violations correctly', () => {
    setup(`
      <a href="/one">One</a>
      <a href="/two">Two</a>
      <div role="button">Three</div>
    `);
    const violations = auditFocusRings({ root: container });
    expect(violations.length).toBe(3);
    const tags = violations.map((v) => v.tagName);
    expect(tags).toContain('a');
    expect(tags).toContain('div');
  });

  it('returns empty array when root is null-ish', () => {
    // Passing undefined root defaults to document.body (which is empty after cleanup)
    const violations = auditFocusRings();
    expect(violations).toEqual([]);
  });

  it('does not flag elements with tabindex=-1', () => {
    setup('<div tabindex="-1">Not focusable</div>');
    const violations = auditFocusRings({ root: container });
    expect(violations).toEqual([]);
  });

  it('detects violations on [role=checkbox] without focus classes', () => {
    setup('<div role="checkbox" tabindex="0" aria-checked="false">Check</div>');
    const violations = auditFocusRings({ root: container });
    const checkboxViolations = violations.filter((v) => v.role === 'checkbox');
    expect(checkboxViolations.length).toBeGreaterThanOrEqual(1);
  });

  it('detects violations on [role=menuitem] without focus classes', () => {
    setup('<li role="menuitem" tabindex="0">Menu Item</li>');
    const violations = auditFocusRings({ root: container });
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations.some((v) => v.role === 'menuitem')).toBe(true);
  });

  it('detects violations on contenteditable elements', () => {
    setup('<div contenteditable="true">Editable</div>');
    const violations = auditFocusRings({ root: container });
    expect(violations.length).toBe(1);
    expect(violations[0].tagName).toBe('div');
  });
});

// ---------------------------------------------------------------------------
// INTERACTIVE_SELECTORS
// ---------------------------------------------------------------------------

describe('INTERACTIVE_SELECTORS', () => {
  it('includes all expected interactive element selectors', () => {
    expect(INTERACTIVE_SELECTORS).toContain('a[href]');
    expect(INTERACTIVE_SELECTORS).toContain('button');
    expect(INTERACTIVE_SELECTORS).toContain('input:not([type="hidden"])');
    expect(INTERACTIVE_SELECTORS).toContain('select');
    expect(INTERACTIVE_SELECTORS).toContain('textarea');
    expect(INTERACTIVE_SELECTORS).toContain('[role="button"]');
    expect(INTERACTIVE_SELECTORS).toContain('[role="tab"]');
    expect(INTERACTIVE_SELECTORS).toContain('[contenteditable="true"]');
  });

  it('excludes tabindex=-1 from interactive selectors', () => {
    const tabindexSelector = INTERACTIVE_SELECTORS.find((s) => s.includes('tabindex'));
    expect(tabindexSelector).toBe('[tabindex]:not([tabindex="-1"])');
  });
});
