import { applyOp, emptyGraph } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { describe, expect, it } from 'vitest';

import { runBuyer } from './buyer.js';
import { FakeProvider } from './fake-provider.js';
import { createBuyerRegistry } from './tools/buyer.js';

import type { CatalogLike } from './tools/buyer.js';
import type { DesignGraph, OpBody } from '@protopulse/graph';

const parts = seedPartDb();

const CATALOG: CatalogLike = {
  rev: '2026-06',
  vendor: 'jlcpcb',
  note: 'test snapshot — classes drift, verify at order time',
  entries: [
    { partId: 'core:resistor', value: '10k', lcsc: 'C25804', mpn: '0603WAF1002T5E', mfr: 'UNI-ROYAL', package: '0603', class: 'basic', description: '10k 1%' },
    { partId: 'core:resistor', value: '1k', lcsc: 'C21190', mpn: '0603WAF1001T5E', mfr: 'UNI-ROYAL', package: '0603', class: 'basic', description: '1k 1%' },
    { partId: 'core:ne555', lcsc: 'C7593', mpn: 'NE555DR', mfr: 'TI', package: 'SOIC-8', class: 'extended', description: '555 timer' },
  ],
};

/** Two 10k resistors, one valueless resistor, one 555. */
function design(): DesignGraph {
  const g = emptyGraph();
  const ops: OpBody[] = [
    { kind: 'add_component', id: 'ra', ref: 'R1', partId: 'core:resistor', partRev: 1 },
    { kind: 'set_component_props', id: 'ra', props: { value: '10k' } },
    { kind: 'add_component', id: 'rb', ref: 'R2', partId: 'core:resistor', partRev: 1 },
    { kind: 'set_component_props', id: 'rb', props: { value: '10K' } }, // case differs, value agrees
    { kind: 'add_component', id: 'rc', ref: 'R3', partId: 'core:resistor', partRev: 1 },
    { kind: 'add_component', id: 'u1', ref: 'U1', partId: 'core:ne555', partRev: 1 },
  ];
  for (const op of ops) {
    const res = applyOp(g, op);
    if (!res.ok) throw new Error(res.error);
  }
  return g;
}

describe('buyer tools', () => {
  it('read_bom groups by (part, value) and reports sourcing state', () => {
    const registry = createBuyerRegistry(CATALOG);
    const res = registry.dispatch('read_bom', {}, { graph: design(), parts });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.result.summary).toBe('3 BOM line(s), 0 sourced');
    const data = res.result.data as { lines: { refs: string[]; qty: number; value: string | null }[] };
    expect(data.lines.find((l) => l.qty === 2)?.refs).toEqual(['R1', 'R2']); // 10k ≡ 10K
  });

  it('find_offers resolves by ref or partId+value; empty results say so honestly', () => {
    const registry = createBuyerRegistry(CATALOG);
    const ctx = { graph: design(), parts };

    const byRef = registry.dispatch('find_offers', { ref: 'R1' }, ctx);
    expect(byRef.ok).toBe(true);
    if (byRef.ok) expect(byRef.result.summary).toContain('1 offer(s)');

    const none = registry.dispatch('find_offers', { partId: 'core:resistor', value: '47k' }, ctx);
    expect(none.ok).toBe(true);
    if (none.ok) expect(none.result.summary).toContain('no jlcpcb offer');

    expect(registry.dispatch('find_offers', {}, ctx).ok).toBe(false);
    expect(registry.dispatch('find_offers', { ref: 'GHOST' }, ctx).ok).toBe(false);
  });

  it('assign_sourcing emits field ops, preserves existing fields, and guards mismatches', () => {
    const registry = createBuyerRegistry(CATALOG);
    const g = design();
    applyOp(g, { kind: 'set_component_props', id: 'ra', props: { fields: { note: 'keep me' } } });
    const ctx = { graph: g, parts };

    const ok = registry.dispatch('assign_sourcing', { refs: ['R1', 'R2'], lcsc: 'C25804' }, ctx);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.result.ops).toHaveLength(2);
      expect(ok.result.ops[0]).toMatchObject({
        kind: 'set_component_props',
        id: 'ra',
        props: { fields: { note: 'keep me', lcsc: 'C25804', mpn: '0603WAF1002T5E' } },
      });
    }

    // Wrong part for the offer; value-specific offer vs valueless component.
    expect(registry.dispatch('assign_sourcing', { refs: ['U1'], lcsc: 'C25804' }, ctx).ok).toBe(false);
    expect(registry.dispatch('assign_sourcing', { refs: ['R3'], lcsc: 'C25804' }, ctx).ok).toBe(false);
    expect(registry.dispatch('assign_sourcing', { refs: ['R1'], lcsc: 'C-GHOST' }, ctx).ok).toBe(false);
  });

  it('sourcing_report counts classes and lists unsourced refs', () => {
    const registry = createBuyerRegistry(CATALOG);
    const g = design();
    for (const [id, lcsc, mpn] of [
      ['ra', 'C25804', '0603WAF1002T5E'],
      ['rb', 'C25804', '0603WAF1002T5E'],
      ['u1', 'C7593', 'NE555DR'],
    ] as const) {
      applyOp(g, { kind: 'set_component_props', id, props: { fields: { lcsc, mpn } } });
    }
    const res = registry.dispatch('sourcing_report', {}, { graph: g, parts });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.result.summary).toBe('3 line(s): 1 basic, 1 extended, 0 off-catalog, 1 ref(s) unsourced');
    const data = res.result.data as { unsourced: string[] };
    expect(data.unsourced).toEqual(['R3']);
  });
});

describe('runBuyer (FakeProvider end-to-end)', () => {
  it('reads → sources the resistors → reports, applying ops to the working copy', async () => {
    const provider = new FakeProvider([
      [{ kind: 'tool_use', id: 't1', name: 'read_bom', input: {} }],
      [{ kind: 'tool_use', id: 't2', name: 'find_offers', input: { ref: 'R1' } }],
      [{ kind: 'tool_use', id: 't3', name: 'assign_sourcing', input: { refs: ['R1', 'R2'], lcsc: 'C25804' } }],
      [{ kind: 'tool_use', id: 't4', name: 'sourcing_report', input: {} }],
      [{ kind: 'text', text: 'Sourced the 10k resistors as C25804 (basic). R3 has no value; U1 has no assignment yet.' }],
    ]);

    const result = await runBuyer({
      prompt: 'source this design',
      graph: design(),
      parts,
      provider,
      catalog: CATALOG,
    });

    expect(result.ops.map((o) => o.kind)).toEqual(['set_component_props', 'set_component_props']);
    expect(result.envelopes).toHaveLength(2);
    expect(result.envelopes[0]?.meta).toMatchObject({ agent: 'buyer' });
    expect(result.finalText).toContain('C25804');

    // The closing report saw the WORKING copy: the resistor line is sourced.
    const flat = JSON.stringify(result.transcript);
    expect(flat).toContain('1 basic, 0 extended, 0 off-catalog, 2 ref(s) unsourced');
  });

  it('destructive sourcing honors the confirm gate', async () => {
    const provider = new FakeProvider([
      [{ kind: 'tool_use', id: 't1', name: 'assign_sourcing', input: { refs: ['R1'], lcsc: 'C25804' } }],
      [{ kind: 'text', text: 'declined' }],
    ]);
    const result = await runBuyer({
      prompt: 'source it',
      graph: design(),
      parts,
      provider,
      catalog: CATALOG,
      confirmDestructive: () => false,
    });
    expect(result.ops).toEqual([]);
    expect(JSON.stringify(result.transcript)).toContain('user declined');
  });
});
