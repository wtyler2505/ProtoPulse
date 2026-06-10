import { makePortRef, materialize } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { describe, expect, it } from 'vitest';

import { createProfessorRegistry, PROFESSOR_TOOL_NAMES } from './professor.js';

import type { CodeToConcept, ConceptLookup } from './professor.js';
import type { ToolCtx } from '../registry.js';
import type { DesignGraph, OpBody, OpEnvelope } from '@protopulse/graph';
import type { PartDb } from '@protopulse/parts';

const parts: PartDb = seedPartDb();

function env(lamport: number, op: OpBody): OpEnvelope {
  return { actor: 'test', lamport, ts: 0, op };
}

function fixtureGraph(): DesignGraph {
  const rRev = parts.latest('core:resistor')?.rev ?? 1;
  const result = materialize([
    env(1, { kind: 'add_component', id: 'c-r1', ref: 'R1', partId: 'core:resistor', partRev: rRev, value: '10k' }),
    env(2, { kind: 'connect', port: makePortRef('c-r1', '2'), newNetId: 'n-out' }),
    env(3, { kind: 'rename_net', netId: 'n-out', name: 'VOUT' }),
  ]);
  expect(result.warnings).toEqual([]);
  return result.graph;
}

function ctx(): ToolCtx {
  return { graph: fixtureGraph(), parts };
}

const ARTICLES: Record<string, { title: string; body: string }> = {
  'pull-up-pull-down': {
    title: 'Pull-up and pull-down resistors',
    body: '## What it is\nA resistor that defines an idle logic level…',
  },
  'floating-inputs': { title: 'Floating inputs', body: '## What it is\nAn undriven CMOS input…' },
};

const lookup: ConceptLookup = (slug) => ARTICLES[slug];
const codeToConcept: CodeToConcept = (code) =>
  code === 'ERC-OC-NO-PULLUP' ? 'pull-up-pull-down' : code === 'REV-GHOST' ? 'not-written-yet' : undefined;

function registry() {
  return createProfessorRegistry(lookup, codeToConcept);
}

describe("createProfessorRegistry — the Professor's tools", () => {
  it('exposes exactly the professor tool names', () => {
    expect(registry().names().sort()).toEqual([...PROFESSOR_TOOL_NAMES].sort());
  });

  it('read_design returns the shared digest shape (components, nets, constraints)', () => {
    const res = registry().dispatch('read_design', {}, ctx());
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.result.ops).toEqual([]);
      const data = res.result.data as { components: string[]; nets: string[]; constraints: string[] };
      expect(data.components).toEqual(['R1 10k Resistor']);
      expect(data.nets).toEqual(['VOUT: R1:2']);
      expect(data.constraints).toEqual([]);
      expect(res.result.summary).toContain('1 component(s)');
    }
  });

  it('lookup_concept returns the article on a hit', () => {
    const res = registry().dispatch('lookup_concept', { slug: 'floating-inputs' }, ctx());
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.result.data).toEqual({
        slug: 'floating-inputs',
        title: 'Floating inputs',
        body: ARTICLES['floating-inputs']?.body,
      });
      expect(res.result.summary).toContain('Floating inputs');
    }
  });

  it('lookup_concept errors on an unknown slug', () => {
    const res = registry().dispatch('lookup_concept', { slug: 'warp-drives' }, ctx());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/unknown concept "warp-drives"/);
  });

  it('explain_finding maps a known code to its slug AND article', () => {
    const res = registry().dispatch(
      'explain_finding',
      { code: 'ERC-OC-NO-PULLUP', message: 'Open-collector net SDA has no pull-up' },
      ctx(),
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.result.data).toMatchObject({
        code: 'ERC-OC-NO-PULLUP',
        message: 'Open-collector net SDA has no pull-up',
        conceptSlug: 'pull-up-pull-down',
        article: { slug: 'pull-up-pull-down', title: 'Pull-up and pull-down resistors' },
      });
      expect(res.result.summary).toContain('pull-up-pull-down');
    }
  });

  it('explain_finding returns pure data with conceptSlug null for unmapped codes', () => {
    const res = registry().dispatch(
      'explain_finding',
      { code: 'REV-MYSTERY', message: 'something odd', context: 'check: layout' },
      ctx(),
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.result.data).toMatchObject({
        code: 'REV-MYSTERY',
        conceptSlug: null,
        article: null,
        context: 'check: layout',
      });
      expect(res.result.summary).toContain('no concept mapping');
    }
  });

  it('explain_finding flags a mapped slug whose article is not written yet', () => {
    const res = registry().dispatch('explain_finding', { code: 'REV-GHOST', message: 'm' }, ctx());
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.result.data).toMatchObject({ conceptSlug: 'not-written-yet', article: null });
      expect(res.result.summary).toMatch(/not written yet/);
    }
  });

  it('every professor tool is non-destructive and proposes zero ops', () => {
    const reg = registry();
    for (const name of PROFESSOR_TOOL_NAMES) {
      expect(reg.get(name)?.destructive).toBe(false);
    }
  });

  it('analyst tools are rejected in the professor slice (scope is physical, not polite)', () => {
    const reg = registry();
    for (const name of ['run_simulation', 'measure']) {
      const res = reg.dispatch(name, {}, ctx());
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toMatch(/unknown or out-of-scope/);
    }
  });
});
