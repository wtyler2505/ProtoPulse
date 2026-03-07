import { describe, it, expect } from 'vitest';
import { STARTER_TEMPLATE, SNIPPET_TEMPLATES } from '../circuit-lang';

describe('STARTER_TEMPLATE', () => {
  it('is a non-empty string', () => {
    expect(typeof STARTER_TEMPLATE).toBe('string');
    expect(STARTER_TEMPLATE.length).toBeGreaterThan(0);
  });

  it('contains circuit( call', () => {
    expect(STARTER_TEMPLATE).toContain('circuit(');
  });

  it('contains export() call', () => {
    expect(STARTER_TEMPLATE).toContain('export()');
  });
});

describe('SNIPPET_TEMPLATES', () => {
  const requiredSnippets = ['voltage-divider', 'led-circuit', 'h-bridge', 'op-amp-inverting'] as const;

  it('has all required snippet keys', () => {
    for (const key of requiredSnippets) {
      expect(SNIPPET_TEMPLATES).toHaveProperty(key);
    }
  });

  for (const key of requiredSnippets) {
    describe(`snippet: ${key}`, () => {
      it('has label and description strings', () => {
        const snippet = SNIPPET_TEMPLATES[key];
        expect(typeof snippet.label).toBe('string');
        expect(snippet.label.length).toBeGreaterThan(0);
        expect(typeof snippet.description).toBe('string');
        expect(snippet.description.length).toBeGreaterThan(0);
      });

      it('has valid DSL code containing circuit( and export()', () => {
        const snippet = SNIPPET_TEMPLATES[key];
        expect(typeof snippet.code).toBe('string');
        expect(snippet.code).toContain('circuit(');
        expect(snippet.code).toContain('export()');
      });
    });
  }
});

describe('CodeEditor component', () => {
  // CodeEditor tests are in a separate block because they need React/DOM mocking.
  // CodeMirror requires a real DOM with getClientRects, so we test rendering and props
  // with a mock approach.

  it('exports CodeEditor as a component', async () => {
    const mod = await import('../../../components/views/circuit-code/CodeEditor');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default === 'function' || typeof mod.default === 'object').toBe(true);
  });
});
