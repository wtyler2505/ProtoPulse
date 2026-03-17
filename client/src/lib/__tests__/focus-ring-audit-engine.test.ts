import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  auditFocusRings,
  buildSelector,
  isHiddenOrDisabled,
  hasFocusIndicator,
  detectMissingFocusRings,
  generateFocusRingCSS,
  DEFAULT_FOCUS_RING_CONFIG,
  FOCUS_RING_CSS,
  INTERACTIVE_SELECTORS,
  FOCUS_INDICATOR_PROPERTIES,
} from '../focus-ring-audit';
import type {
  FocusRingViolation,
  FocusRingAuditResult,
  FocusRingConfig,
  AuditFocusRingsOptions,
} from '../focus-ring-audit';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let container: HTMLDivElement;

function setup(html: string): HTMLDivElement {
  container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
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

// ===========================================================================
// FocusRingConfig / DEFAULT_FOCUS_RING_CONFIG
// ===========================================================================

describe('DEFAULT_FOCUS_RING_CONFIG', () => {
  it('has neon cyan as the default color', () => {
    expect(DEFAULT_FOCUS_RING_CONFIG.color).toBe('#00F0FF');
  });

  it('has width of 2px', () => {
    expect(DEFAULT_FOCUS_RING_CONFIG.width).toBe(2);
  });

  it('has offset of 2px', () => {
    expect(DEFAULT_FOCUS_RING_CONFIG.offset).toBe(2);
  });

  it('has solid style by default', () => {
    expect(DEFAULT_FOCUS_RING_CONFIG.style).toBe('solid');
  });

  it('is readonly / frozen shape', () => {
    const config: Readonly<FocusRingConfig> = DEFAULT_FOCUS_RING_CONFIG;
    expect(config).toEqual({
      color: '#00F0FF',
      width: 2,
      offset: 2,
      style: 'solid',
    });
  });
});

// ===========================================================================
// generateFocusRingCSS
// ===========================================================================

describe('generateFocusRingCSS', () => {
  it('generates valid CSS with default config', () => {
    const css = generateFocusRingCSS();
    expect(css).toContain(':focus-visible {');
    expect(css).toContain('outline: 2px solid #00F0FF;');
    expect(css).toContain('outline-offset: 2px;');
    expect(css).toContain('}');
  });

  it('overrides color when provided', () => {
    const css = generateFocusRingCSS({ color: '#FF0000' });
    expect(css).toContain('#FF0000');
    expect(css).not.toContain('#00F0FF');
  });

  it('overrides width when provided', () => {
    const css = generateFocusRingCSS({ width: 4 });
    expect(css).toContain('outline: 4px solid');
  });

  it('overrides offset when provided', () => {
    const css = generateFocusRingCSS({ offset: 0 });
    expect(css).toContain('outline-offset: 0px;');
  });

  it('overrides style when provided', () => {
    const css = generateFocusRingCSS({ style: 'dashed' });
    expect(css).toContain('dashed');
    expect(css).not.toContain('solid');
  });

  it('merges partial config with defaults', () => {
    const css = generateFocusRingCSS({ color: 'red', width: 3 });
    expect(css).toContain('outline: 3px solid red;');
    // offset should still be default
    expect(css).toContain('outline-offset: 2px;');
  });

  it('accepts empty object and uses all defaults', () => {
    const css = generateFocusRingCSS({});
    expect(css).toBe(FOCUS_RING_CSS);
  });

  it('supports dotted style', () => {
    const css = generateFocusRingCSS({ style: 'dotted' });
    expect(css).toContain('dotted');
  });

  it('supports double style', () => {
    const css = generateFocusRingCSS({ style: 'double' });
    expect(css).toContain('double');
  });
});

// ===========================================================================
// FOCUS_RING_CSS (pre-built constant)
// ===========================================================================

describe('FOCUS_RING_CSS', () => {
  it('is a non-empty string', () => {
    expect(typeof FOCUS_RING_CSS).toBe('string');
    expect(FOCUS_RING_CSS.length).toBeGreaterThan(0);
  });

  it('matches output of generateFocusRingCSS with no args', () => {
    expect(FOCUS_RING_CSS).toBe(generateFocusRingCSS());
  });

  it('contains :focus-visible selector', () => {
    expect(FOCUS_RING_CSS).toContain(':focus-visible');
  });

  it('contains the default neon cyan color', () => {
    expect(FOCUS_RING_CSS).toContain('#00F0FF');
  });
});

// ===========================================================================
// detectMissingFocusRings
// ===========================================================================

describe('detectMissingFocusRings', () => {
  it('returns FocusRingAuditResult shape', () => {
    setup('<div><p>Nothing interactive</p></div>');
    const result = detectMissingFocusRings(container);
    expect(result).toHaveProperty('violations');
    expect(result).toHaveProperty('totalScanned');
    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('skipped');
    expect(result).toHaveProperty('passRate');
    expect(result).toHaveProperty('timestamp');
  });

  it('returns empty violations when no interactive elements exist', () => {
    setup('<div><span>Text</span></div>');
    const result = detectMissingFocusRings(container);
    expect(result.violations).toEqual([]);
    expect(result.totalScanned).toBe(0);
    expect(result.passed).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.passRate).toBe(1);
  });

  it('counts passing elements with focus-ring class', () => {
    setup(`
      <button class="focus-ring">A</button>
      <button class="focus-ring">B</button>
    `);
    const result = detectMissingFocusRings(container);
    expect(result.passed).toBe(2);
    expect(result.violations.length).toBe(0);
    expect(result.passRate).toBe(1);
  });

  it('counts violations for elements without focus indicators', () => {
    setup(`
      <a href="/one">Link 1</a>
      <a href="/two">Link 2</a>
      <div role="button">Fake btn</div>
    `);
    const result = detectMissingFocusRings(container);
    expect(result.violations.length).toBe(3);
    expect(result.passed).toBe(0);
    expect(result.passRate).toBe(0);
  });

  it('counts skipped disabled elements', () => {
    setup(`
      <button disabled>Disabled</button>
      <button class="focus-ring">Enabled</button>
    `);
    const result = detectMissingFocusRings(container);
    expect(result.skipped).toBe(1);
    expect(result.passed).toBe(1);
    expect(result.totalScanned).toBe(2);
  });

  it('counts skipped aria-hidden elements', () => {
    setup(`
      <div aria-hidden="true"><button>Hidden</button></div>
      <button class="focus-ring">Visible</button>
    `);
    const result = detectMissingFocusRings(container);
    expect(result.skipped).toBe(1);
    expect(result.passed).toBe(1);
  });

  it('respects exclude option for skipped count', () => {
    setup(`
      <div class="skip-me"><button>Excluded</button></div>
      <button class="focus-ring">Included</button>
    `);
    const result = detectMissingFocusRings(container, { exclude: '.skip-me' });
    expect(result.skipped).toBe(1);
    expect(result.passed).toBe(1);
    expect(result.violations.length).toBe(0);
  });

  it('calculates passRate correctly with mixed results', () => {
    setup(`
      <button class="focus-ring">Good</button>
      <a href="/bad">Bad</a>
    `);
    const result = detectMissingFocusRings(container);
    // 1 passed / (2 scanned - 0 skipped) = 0.5
    expect(result.passed).toBe(1);
    expect(result.violations.length).toBe(1);
    expect(result.passRate).toBe(0.5);
  });

  it('passRate is 1 when all non-skipped elements pass', () => {
    setup(`
      <input type="text" />
      <select><option>A</option></select>
      <button disabled>Skip me</button>
    `);
    const result = detectMissingFocusRings(container);
    expect(result.passRate).toBe(1);
  });

  it('includes ISO timestamp', () => {
    setup('<div></div>');
    const before = new Date().toISOString();
    const result = detectMissingFocusRings(container);
    const after = new Date().toISOString();
    // timestamp should be between before and after
    expect(result.timestamp >= before).toBe(true);
    expect(result.timestamp <= after).toBe(true);
  });

  it('violations have correct FocusRingViolation shape', () => {
    setup('<div role="switch" tabindex="0">Toggle</div>');
    const result = detectMissingFocusRings(container);
    expect(result.violations.length).toBeGreaterThanOrEqual(1);
    const v = result.violations[0];
    expect(v.element).toBeInstanceOf(Element);
    expect(typeof v.selector).toBe('string');
    expect(typeof v.reason).toBe('string');
    expect(typeof v.tagName).toBe('string');
    expect(v.role).toBe('switch');
  });

  it('totalScanned equals passed + skipped + violations', () => {
    setup(`
      <button class="focus-ring">Pass</button>
      <button disabled>Skip</button>
      <a href="/x">Fail</a>
      <div role="button">Fail2</div>
    `);
    const result = detectMissingFocusRings(container);
    expect(result.totalScanned).toBe(result.passed + result.skipped + result.violations.length);
  });

  it('handles native form controls as passing', () => {
    setup(`
      <input type="text" />
      <textarea></textarea>
      <select><option>X</option></select>
    `);
    const result = detectMissingFocusRings(container);
    expect(result.passed).toBe(3);
    expect(result.violations.length).toBe(0);
    expect(result.passRate).toBe(1);
  });

  it('handles deeply nested interactive elements', () => {
    setup(`
      <div><div><div><a href="/deep" class="focus-visible:ring-2">Deep link</a></div></div></div>
      <div><div><div role="slider" tabindex="0">Slider</div></div></div>
    `);
    const result = detectMissingFocusRings(container);
    expect(result.passed).toBe(1);
    expect(result.violations.length).toBeGreaterThanOrEqual(1);
  });

  it('scans only within the provided container', () => {
    // Add elements outside the container
    const outside = document.createElement('div');
    outside.innerHTML = '<button class="bare">Outside</button>';
    document.body.appendChild(outside);

    setup('<button class="focus-ring">Inside</button>');
    const result = detectMissingFocusRings(container);
    expect(result.totalScanned).toBe(1);
    expect(result.violations.length).toBe(0);
  });
});

// ===========================================================================
// FOCUS_INDICATOR_PROPERTIES constant
// ===========================================================================

describe('FOCUS_INDICATOR_PROPERTIES', () => {
  it('includes outlineStyle', () => {
    expect(FOCUS_INDICATOR_PROPERTIES).toContain('outlineStyle');
  });

  it('includes outlineWidth', () => {
    expect(FOCUS_INDICATOR_PROPERTIES).toContain('outlineWidth');
  });

  it('includes outlineColor', () => {
    expect(FOCUS_INDICATOR_PROPERTIES).toContain('outlineColor');
  });

  it('includes boxShadow', () => {
    expect(FOCUS_INDICATOR_PROPERTIES).toContain('boxShadow');
  });

  it('has exactly 4 properties', () => {
    expect(FOCUS_INDICATOR_PROPERTIES.length).toBe(4);
  });
});

// ===========================================================================
// INTERACTIVE_SELECTORS coverage
// ===========================================================================

describe('INTERACTIVE_SELECTORS completeness', () => {
  it('covers all ARIA widget roles', () => {
    const widgetRoles = ['button', 'link', 'checkbox', 'radio', 'tab', 'menuitem', 'switch', 'slider', 'spinbutton', 'combobox', 'option'];
    for (const role of widgetRoles) {
      expect(INTERACTIVE_SELECTORS).toContain(`[role="${role}"]`);
    }
  });

  it('covers contenteditable', () => {
    expect(INTERACTIVE_SELECTORS).toContain('[contenteditable="true"]');
  });

  it('has at least 18 selectors', () => {
    expect(INTERACTIVE_SELECTORS.length).toBeGreaterThanOrEqual(18);
  });
});

// ===========================================================================
// Edge cases and integration-style tests
// ===========================================================================

describe('edge cases', () => {
  it('buildSelector truncates to 120 chars max', () => {
    setup('<div role="button" class="a-really-long-class-name-that-goes-on-and-on another-long-class more-classes-here even-more-to-overflow-the-limit-of-120-characters">X</div>');
    const el = container.querySelector('[role="button"]')!;
    const sel = buildSelector(el);
    expect(sel.length).toBeLessThanOrEqual(120);
  });

  it('isHiddenOrDisabled returns false for aria-hidden="false"', () => {
    setup('<button aria-hidden="false">Visible</button>');
    const el = container.querySelector('button')!;
    expect(isHiddenOrDisabled(el)).toBe(false);
  });

  it('hasFocusIndicator handles element with empty className', () => {
    setup('<button class="">Empty class</button>');
    const el = container.querySelector('button')!;
    // Button without focus classes but no crash
    expect(typeof hasFocusIndicator(el)).toBe('boolean');
  });

  it('auditFocusRings handles container with mixed passing and failing elements', () => {
    setup(`
      <button class="focus-ring">Pass</button>
      <button>Fail</button>
      <input type="text" />
      <a href="/">Fail link</a>
      <div role="tab" tabindex="0" class="focus-visible:ring-2">Pass tab</div>
    `);
    const violations = auditFocusRings({ root: container });
    // button without focus-ring and anchor should fail
    expect(violations.length).toBe(2);
    const failingTags = violations.map((v) => v.tagName);
    expect(failingTags).toContain('button');
    expect(failingTags).toContain('a');
  });

  it('detectMissingFocusRings passRate handles all-skipped edge case', () => {
    setup(`
      <button disabled>A</button>
      <button disabled>B</button>
    `);
    const result = detectMissingFocusRings(container);
    // All elements skipped => passRate defaults to 1
    expect(result.passRate).toBe(1);
    expect(result.skipped).toBe(2);
    expect(result.passed).toBe(0);
    expect(result.violations.length).toBe(0);
  });

  it('type exports are accessible (FocusRingAuditResult)', () => {
    // This is a compile-time check — verifying the type can be used
    const result: FocusRingAuditResult = {
      violations: [],
      totalScanned: 0,
      passed: 0,
      skipped: 0,
      passRate: 1,
      timestamp: new Date().toISOString(),
    };
    expect(result.passRate).toBe(1);
  });

  it('type exports are accessible (FocusRingConfig)', () => {
    const config: FocusRingConfig = {
      color: 'blue',
      width: 1,
      offset: 0,
      style: 'dotted',
    };
    expect(config.style).toBe('dotted');
  });
});
