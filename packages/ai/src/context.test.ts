import { runErc } from '@protopulse/erc';
import {
  applyOp,
  emptyGraph
  
  
} from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { describe, expect, it } from 'vitest';

import { assembleContext, CONTEXT_BUDGETS } from './context.js';

import type {DesignGraph, OpEnvelope} from '@protopulse/graph';

const parts = seedPartDb();

function graphWithComponents(n: number): DesignGraph {
  const graph = emptyGraph();
  const rev = parts.latest('core:resistor')?.rev ?? 1;
  for (let i = 1; i <= n; i++) {
    const id = `c-${String(i)}`;
    expect(applyOp(graph, {
      kind: 'add_component', id, ref: `R${String(i)}`, partId: 'core:resistor', partRev: rev, value: '10k',
    }).ok).toBe(true);
    expect(applyOp(graph, {
      kind: 'place_symbol', componentId: id, at: { x: 1_270_000 * i, y: 2_540_000 }, rot: 0, mirror: false,
    }).ok).toBe(true);
  }
  return graph;
}

describe('assembleContext', () => {
  it('renders components as "REF value name @ (x, y)mm"', () => {
    const graph = graphWithComponents(2);
    const out = assembleContext(graph, parts, [], []);
    expect(out).toMatch(/R1 10k Resistor @ \(1\.3, 2\.5\)mm/);
    expect(out).toMatch(/2 component\(s\), 0 net\(s\)\./);
  });

  it('renders nets as "NAME: REF:pin, REF:pin"', () => {
    const graph = graphWithComponents(2);
    expect(applyOp(graph, { kind: 'connect', port: 'c-1:1', newNetId: 'n-1' }).ok).toBe(true);
    expect(applyOp(graph, { kind: 'connect', port: 'c-2:1', netId: 'n-1' }).ok).toBe(true);
    expect(applyOp(graph, { kind: 'rename_net', netId: 'n-1', name: 'VCC' }).ok).toBe(true);
    const out = assembleContext(graph, parts, [], []);
    expect(out).toMatch(/VCC: R1:1, R2:1/);
  });

  it('is deterministic — identical inputs produce identical output', () => {
    const graph = graphWithComponents(20);
    const findings = runErc(graph, parts);
    const a = assembleContext(graph, parts, findings, []);
    const b = assembleContext(graph, parts, findings, []);
    expect(a).toBe(b);
  });

  it('respects the component budget with a truncation marker', () => {
    const graph = graphWithComponents(500); // ~40+ chars/line × 500 ≫ 8k budget
    const out = assembleContext(graph, parts, [], []);
    const componentSection = out.split('### Components')[1]?.split('### Nets')[0] ?? '';
    expect(componentSection.length).toBeLessThanOrEqual(CONTEXT_BUDGETS.components + 200);
    expect(componentSection).toMatch(/… \[\d+ more truncated\]/);
  });

  it('respects the findings budget with a truncation marker', () => {
    const graph = graphWithComponents(1);
    const findings = Array.from({ length: 400 }, (_, i) => ({
      severity: 'warn' as const,
      code: 'ERC-SINGLE-PORT-NET',
      message: `Net N$${String(i)} connects only one pin — dangling wire or unfinished connection`,
      anchors: [],
    }));
    const out = assembleContext(graph, parts, findings, []);
    const section = out.split('## Open ERC findings')[1]?.split('## Recent operations')[0] ?? '';
    expect(section.length).toBeLessThanOrEqual(CONTEXT_BUDGETS.findings + 200);
    expect(section).toMatch(/… \[\d+ more truncated\]/);
  });

  it('lists recent ops latest-first with rationales, capped', () => {
    const graph = graphWithComponents(1);
    const ops: OpEnvelope[] = [
      {
        actor: 'a', lamport: 1, ts: 0,
        op: { kind: 'rename_net', netId: 'n', name: 'OLD' },
        meta: { agent: 'draftsman', rationale: 'first edit' },
      },
      {
        actor: 'a', lamport: 2, ts: 0,
        op: { kind: 'batch', ops: [], label: 'decoupling pass' },
        meta: { agent: 'draftsman', rationale: 'latest edit' },
      },
    ];
    const out = assembleContext(graph, parts, [], ops);
    const latestIdx = out.indexOf('latest edit');
    const firstIdx = out.indexOf('first edit');
    expect(latestIdx).toBeGreaterThan(-1);
    expect(firstIdx).toBeGreaterThan(-1);
    expect(latestIdx).toBeLessThan(firstIdx); // latest first
    expect(out).toMatch(/batch "decoupling pass" by draftsman — latest edit/);
  });

  it('respects the recent-ops budget', () => {
    const graph = graphWithComponents(1);
    const ops: OpEnvelope[] = Array.from({ length: 500 }, (_, i) => ({
      actor: 'a', lamport: i, ts: 0,
      op: { kind: 'rename_net' as const, netId: 'n', name: `NET_${String(i)}` },
      meta: { rationale: `because of reason number ${String(i)} which is fairly long` },
    }));
    const out = assembleContext(graph, parts, [], ops);
    const section = out.split('## Recent operations (latest first)')[1] ?? '';
    expect(section.length).toBeLessThanOrEqual(CONTEXT_BUDGETS.recentOps + 200);
    expect(section).toMatch(/… \[\d+ more truncated\]/);
  });

  it('puts focusRefs components first', () => {
    const graph = graphWithComponents(30);
    const out = assembleContext(graph, parts, [], [], ['R25']);
    const section = out.split('### Components')[1] ?? '';
    const firstLine = section.trim().split('\n')[0] ?? '';
    expect(firstLine.startsWith('R25 ')).toBe(true);
  });

  it('marks empty sections as (none)', () => {
    const out = assembleContext(emptyGraph(), parts, [], []);
    expect(out).toMatch(/### Components\n\(none\)/);
    expect(out).toMatch(/## Open ERC findings\n\(none\)/);
  });
});
