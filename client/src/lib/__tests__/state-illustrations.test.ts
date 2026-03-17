import { describe, it, expect } from 'vitest';

import {
  getStateIllustration,
  getAvailableStateTypes,
  getAvailableContexts,
  STATE_ILLUSTRATIONS,
} from '../state-illustrations';
import type { StateType, StateContext, StateIllustration } from '../state-illustrations';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_STATE_TYPES: StateType[] = [
  'empty',
  'error',
  'offline',
  'loading',
  'success',
  'no_results',
  'permission_denied',
  'first_use',
];

const ALL_CONTEXTS: StateContext[] = [
  'bom',
  'schematic',
  'architecture',
  'pcb',
  'simulation',
  'chat',
  'validation',
  'components',
  'projects',
  'history',
  'export',
];

function assertValidIllustration(ill: StateIllustration): void {
  expect(ill.type).toBeTruthy();
  expect(typeof ill.title).toBe('string');
  expect(ill.title.length).toBeGreaterThan(0);
  expect(typeof ill.description).toBe('string');
  expect(ill.description.length).toBeGreaterThan(0);
  expect(typeof ill.svgContent).toBe('string');
  expect(ill.svgContent).toContain('<svg');
  expect(ill.svgContent).toContain('</svg>');
}

// ---------------------------------------------------------------------------
// STATE_ILLUSTRATIONS record
// ---------------------------------------------------------------------------

describe('STATE_ILLUSTRATIONS', () => {
  it('has an entry for every StateType', () => {
    for (const type of ALL_STATE_TYPES) {
      expect(STATE_ILLUSTRATIONS[type]).toBeDefined();
    }
  });

  it('contains exactly 8 state types', () => {
    expect(Object.keys(STATE_ILLUSTRATIONS)).toHaveLength(8);
  });

  it.each(ALL_STATE_TYPES)('"%s" illustration has valid structure', (type) => {
    const ill = STATE_ILLUSTRATIONS[type];
    assertValidIllustration(ill);
    expect(ill.type).toBe(type);
  });

  it.each(ALL_STATE_TYPES)('"%s" SVG uses neon-cyan (#00F0FF) colour', (type) => {
    expect(STATE_ILLUSTRATIONS[type].svgContent).toContain('#00F0FF');
  });

  it.each(ALL_STATE_TYPES)('"%s" SVG has a viewBox attribute', (type) => {
    expect(STATE_ILLUSTRATIONS[type].svgContent).toMatch(/viewBox="[^"]+"/);
  });

  it('empty state has an actionLabel', () => {
    expect(STATE_ILLUSTRATIONS.empty.actionLabel).toBeTruthy();
  });

  it('error state has an actionLabel', () => {
    expect(STATE_ILLUSTRATIONS.error.actionLabel).toBe('Retry');
  });

  it('loading state has no actionLabel', () => {
    expect(STATE_ILLUSTRATIONS.loading.actionLabel).toBeUndefined();
  });

  it('permission_denied state has actionHref to /auth', () => {
    expect(STATE_ILLUSTRATIONS.permission_denied.actionHref).toBe('/auth');
  });

  it('success state has no actionLabel', () => {
    expect(STATE_ILLUSTRATIONS.success.actionLabel).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getStateIllustration — no context
// ---------------------------------------------------------------------------

describe('getStateIllustration (no context)', () => {
  it.each(ALL_STATE_TYPES)('returns a valid illustration for "%s"', (type) => {
    const ill = getStateIllustration(type);
    assertValidIllustration(ill);
    expect(ill.type).toBe(type);
  });

  it('returns a shallow copy, not the same reference', () => {
    const a = getStateIllustration('empty');
    const b = getStateIllustration('empty');
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('mutating the returned object does not affect the source', () => {
    const ill = getStateIllustration('error');
    ill.title = 'MUTATED';
    const fresh = getStateIllustration('error');
    expect(fresh.title).not.toBe('MUTATED');
  });
});

// ---------------------------------------------------------------------------
// getStateIllustration — context-aware overrides
// ---------------------------------------------------------------------------

describe('getStateIllustration (with context)', () => {
  // --- empty contexts ---

  it('returns BOM-specific messaging for empty + bom', () => {
    const ill = getStateIllustration('empty', 'bom');
    expect(ill.title).toContain('BOM');
    expect(ill.type).toBe('empty');
  });

  it('returns schematic-specific messaging for empty + schematic', () => {
    const ill = getStateIllustration('empty', 'schematic');
    expect(ill.title.toLowerCase()).toContain('schematic');
  });

  it('returns architecture-specific messaging for empty + architecture', () => {
    const ill = getStateIllustration('empty', 'architecture');
    expect(ill.title.toLowerCase()).toContain('architecture');
  });

  it('returns PCB-specific messaging for empty + pcb', () => {
    const ill = getStateIllustration('empty', 'pcb');
    expect(ill.title.toLowerCase()).toContain('pcb');
  });

  it('returns simulation-specific messaging for empty + simulation', () => {
    const ill = getStateIllustration('empty', 'simulation');
    expect(ill.title.toLowerCase()).toContain('simulation');
  });

  it('returns chat-specific messaging for empty + chat', () => {
    const ill = getStateIllustration('empty', 'chat');
    expect(ill.title.toLowerCase()).toContain('message');
  });

  it('returns validation-specific messaging for empty + validation', () => {
    const ill = getStateIllustration('empty', 'validation');
    expect(ill.title.toLowerCase()).toContain('validation');
  });

  it('returns components-specific messaging for empty + components', () => {
    const ill = getStateIllustration('empty', 'components');
    expect(ill.title.toLowerCase()).toContain('component');
  });

  it('returns projects-specific messaging for empty + projects', () => {
    const ill = getStateIllustration('empty', 'projects');
    expect(ill.title.toLowerCase()).toContain('project');
  });

  it('returns history-specific messaging for empty + history', () => {
    const ill = getStateIllustration('empty', 'history');
    expect(ill.title.toLowerCase()).toContain('history');
  });

  it('returns export-specific messaging for empty + export', () => {
    const ill = getStateIllustration('empty', 'export');
    expect(ill.title.toLowerCase()).toContain('export');
  });

  // --- error contexts ---

  it('returns BOM-specific error messaging', () => {
    const ill = getStateIllustration('error', 'bom');
    expect(ill.title.toLowerCase()).toContain('bom');
    expect(ill.type).toBe('error');
  });

  it('returns schematic-specific error messaging', () => {
    const ill = getStateIllustration('error', 'schematic');
    expect(ill.title.toLowerCase()).toContain('schematic');
  });

  it('returns simulation-specific error with advice', () => {
    const ill = getStateIllustration('error', 'simulation');
    expect(ill.title.toLowerCase()).toContain('simulation');
    expect(ill.description.toLowerCase()).toContain('ground');
  });

  it('returns chat error suggesting API key check', () => {
    const ill = getStateIllustration('error', 'chat');
    expect(ill.description.toLowerCase()).toContain('api key');
  });

  // --- no_results contexts ---

  it('returns BOM no-results messaging', () => {
    const ill = getStateIllustration('no_results', 'bom');
    expect(ill.title.toLowerCase()).toContain('part');
  });

  it('returns components no-results messaging', () => {
    const ill = getStateIllustration('no_results', 'components');
    expect(ill.title.toLowerCase()).toContain('component');
  });

  // --- first_use contexts ---

  it('returns BOM first-use onboarding', () => {
    const ill = getStateIllustration('first_use', 'bom');
    expect(ill.title).toContain('Bill of Materials');
    expect(ill.actionLabel).toBeTruthy();
  });

  it('returns schematic first-use onboarding', () => {
    const ill = getStateIllustration('first_use', 'schematic');
    expect(ill.title.toLowerCase()).toContain('schematic');
  });

  it('returns architecture first-use onboarding', () => {
    const ill = getStateIllustration('first_use', 'architecture');
    expect(ill.title.toLowerCase()).toContain('architecture');
  });

  it('returns projects first-use onboarding', () => {
    const ill = getStateIllustration('first_use', 'projects');
    expect(ill.title.toLowerCase()).toContain('project');
  });

  // --- loading contexts ---

  it('returns simulation-specific loading text', () => {
    const ill = getStateIllustration('loading', 'simulation');
    expect(ill.title.toLowerCase()).toContain('simulation');
  });

  it('returns export-specific loading text', () => {
    const ill = getStateIllustration('loading', 'export');
    expect(ill.title.toLowerCase()).toContain('export');
  });

  it('returns chat-specific loading text', () => {
    const ill = getStateIllustration('loading', 'chat');
    expect(ill.title.toLowerCase()).toContain('ai');
  });
});

// ---------------------------------------------------------------------------
// getStateIllustration — fallback behaviour
// ---------------------------------------------------------------------------

describe('getStateIllustration (fallback)', () => {
  it('falls back to generic illustration when context has no override', () => {
    // success has no context overrides at all
    const ill = getStateIllustration('success', 'bom');
    expect(ill).toEqual(getStateIllustration('success'));
  });

  it('falls back to generic when context is undefined', () => {
    const ill = getStateIllustration('offline', undefined);
    expect(ill).toEqual(getStateIllustration('offline'));
  });

  it('preserves SVG content from base even with context override', () => {
    const base = getStateIllustration('empty');
    const contextual = getStateIllustration('empty', 'bom');
    expect(contextual.svgContent).toBe(base.svgContent);
    expect(contextual.type).toBe(base.type);
  });

  it('overrides title and description but keeps SVG for error + pcb', () => {
    const base = getStateIllustration('error');
    const contextual = getStateIllustration('error', 'pcb');
    expect(contextual.svgContent).toBe(base.svgContent);
    expect(contextual.title).not.toBe(base.title);
    expect(contextual.description).not.toBe(base.description);
  });
});

// ---------------------------------------------------------------------------
// getAvailableStateTypes
// ---------------------------------------------------------------------------

describe('getAvailableStateTypes', () => {
  it('returns all 8 state types', () => {
    const types = getAvailableStateTypes();
    expect(types).toHaveLength(8);
    for (const t of ALL_STATE_TYPES) {
      expect(types).toContain(t);
    }
  });

  it('returns a fresh array each call', () => {
    const a = getAvailableStateTypes();
    const b = getAvailableStateTypes();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// getAvailableContexts
// ---------------------------------------------------------------------------

describe('getAvailableContexts', () => {
  it('returns contexts for "empty" type (all 11 contexts)', () => {
    const contexts = getAvailableContexts('empty');
    expect(contexts.length).toBe(11);
    for (const c of ALL_CONTEXTS) {
      expect(contexts).toContain(c);
    }
  });

  it('returns contexts for "error" type (all 11 contexts)', () => {
    const contexts = getAvailableContexts('error');
    expect(contexts.length).toBe(11);
  });

  it('returns contexts for "no_results" type', () => {
    const contexts = getAvailableContexts('no_results');
    expect(contexts.length).toBeGreaterThan(0);
    expect(contexts).toContain('bom');
    expect(contexts).toContain('components');
  });

  it('returns contexts for "first_use" type', () => {
    const contexts = getAvailableContexts('first_use');
    expect(contexts.length).toBeGreaterThan(0);
    expect(contexts).toContain('bom');
    expect(contexts).toContain('schematic');
  });

  it('returns contexts for "loading" type', () => {
    const contexts = getAvailableContexts('loading');
    expect(contexts).toContain('simulation');
    expect(contexts).toContain('export');
    expect(contexts).toContain('chat');
  });

  it('returns empty array for types with no overrides', () => {
    const contexts = getAvailableContexts('success');
    expect(contexts).toEqual([]);
  });

  it('returns empty array for "offline" (no overrides)', () => {
    expect(getAvailableContexts('offline')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// SVG content validation
// ---------------------------------------------------------------------------

describe('SVG content quality', () => {
  it.each(ALL_STATE_TYPES)('"%s" SVG is well-formed (opens and closes)', (type) => {
    const svg = STATE_ILLUSTRATIONS[type].svgContent;
    const openCount = (svg.match(/<svg/g) ?? []).length;
    const closeCount = (svg.match(/<\/svg>/g) ?? []).length;
    expect(openCount).toBe(1);
    expect(closeCount).toBe(1);
  });

  it.each(ALL_STATE_TYPES)('"%s" SVG has xmlns attribute', (type) => {
    expect(STATE_ILLUSTRATIONS[type].svgContent).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it.each(ALL_STATE_TYPES)('"%s" SVG has width and height', (type) => {
    const svg = STATE_ILLUSTRATIONS[type].svgContent;
    expect(svg).toMatch(/width="\d+"/);
    expect(svg).toMatch(/height="\d+"/);
  });

  it('all SVGs are reasonably sized (under 1KB each)', () => {
    for (const type of ALL_STATE_TYPES) {
      const size = new TextEncoder().encode(STATE_ILLUSTRATIONS[type].svgContent).length;
      expect(size).toBeLessThan(1024);
    }
  });

  it('no SVG contains <script> tags', () => {
    for (const type of ALL_STATE_TYPES) {
      expect(STATE_ILLUSTRATIONS[type].svgContent.toLowerCase()).not.toContain('<script');
    }
  });

  it('no SVG contains event handler attributes', () => {
    for (const type of ALL_STATE_TYPES) {
      expect(STATE_ILLUSTRATIONS[type].svgContent).not.toMatch(/\bon\w+=/i);
    }
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('actionLabel from override replaces base actionLabel', () => {
    const base = getStateIllustration('empty');
    const bom = getStateIllustration('empty', 'bom');
    expect(base.actionLabel).toBe('Get started');
    expect(bom.actionLabel).toBe('Add component');
  });

  it('validation empty has no actionLabel (base has one but override does not set one)', () => {
    const ill = getStateIllustration('empty', 'validation');
    // The override for validation does not include actionLabel, so the base actionLabel
    // should NOT leak through — context overrides are explicit replacements
    expect(ill.actionLabel).toBeUndefined();
  });

  it('history empty has no actionLabel (no action makes sense)', () => {
    const ill = getStateIllustration('empty', 'history');
    expect(ill.actionLabel).toBeUndefined();
  });

  it('permission_denied actionHref preserved when no context override exists', () => {
    const ill = getStateIllustration('permission_denied', 'bom');
    // No context override for permission_denied + bom, falls back to base
    expect(ill.actionHref).toBe('/auth');
  });
});
