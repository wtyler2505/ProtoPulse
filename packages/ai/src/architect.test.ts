import { applyOp, emptyGraph } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { describe, expect, it } from 'vitest';

import { runArchitect } from './architect.js';
import { FakeProvider } from './fake-provider.js';
import { createArchitectRegistry } from './tools/architect.js';

import type { DesignGraph, OpBody } from '@protopulse/graph';

const parts = seedPartDb();

/** Tiny PSU-ish design: R1/R2/C1, nets VCC / GND / SIG, no structure yet. */
function design(): DesignGraph {
  const g = emptyGraph();
  const ops: OpBody[] = [
    { kind: 'add_component', id: 'ra', ref: 'R1', partId: 'core:resistor', partRev: 1 },
    { kind: 'add_component', id: 'rb', ref: 'R2', partId: 'core:resistor', partRev: 1 },
    { kind: 'add_component', id: 'ca', ref: 'C1', partId: 'core:capacitor', partRev: 1 },
    { kind: 'connect', port: 'ra:1', newNetId: 'n-vcc' },
    { kind: 'connect', port: 'ca:1', netId: 'n-vcc' },
    { kind: 'rename_net', netId: 'n-vcc', name: 'VCC' },
    { kind: 'connect', port: 'ca:2', newNetId: 'n-gnd' },
    { kind: 'connect', port: 'rb:2', netId: 'n-gnd' },
    { kind: 'rename_net', netId: 'n-gnd', name: 'GND' },
    { kind: 'connect', port: 'ra:2', newNetId: 'n-sig' },
    { kind: 'connect', port: 'rb:1', netId: 'n-sig' },
    { kind: 'rename_net', netId: 'n-sig', name: 'SIG' },
  ];
  for (const op of ops) {
    const res = applyOp(g, op);
    if (!res.ok) throw new Error(res.error);
  }
  return g;
}

/** Apply a tool result's ops so later dispatches see the new structure. */
function applyAll(g: DesignGraph, ops: OpBody[]): void {
  for (const op of ops) {
    const res = applyOp(g, op);
    if (!res.ok) throw new Error(res.error);
  }
}

describe('architect tools', () => {
  it('read_structure digests sheets, buses, unbussed nets, and root components', () => {
    const registry = createArchitectRegistry();
    const res = registry.dispatch('read_structure', {}, { graph: design(), parts });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.result.summary).toBe('0 sheet(s), 0 bus(es), 3 unbussed net(s), 3 root component(s)');
    const data = res.result.data as { unbussed: string[]; rootComponents: string[] };
    expect(data.unbussed).toEqual(['GND', 'SIG', 'VCC']);
    expect(data.rootComponents).toEqual(['C1', 'R1', 'R2']);
  });

  it('create_bus resolves net NAMES to ids and fails whole on unknown nets', () => {
    const registry = createArchitectRegistry();
    const ctx = { graph: design(), parts };

    const ok = registry.dispatch(
      'create_bus',
      { name: 'POWER', busKind: 'PWR', nets: ['VCC', 'GND'] },
      ctx,
    );
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.result.ops[0]).toMatchObject({ kind: 'create_bus', name: 'POWER', busKind: 'PWR' });
      expect(ok.result.ops.slice(1)).toMatchObject([
        { kind: 'assign_to_bus', netId: 'n-vcc' },
        { kind: 'assign_to_bus', netId: 'n-gnd' },
      ]);
    }

    const bad = registry.dispatch(
      'create_bus',
      { name: 'X', busKind: 'custom', nets: ['VCC', 'GHOST'] },
      ctx,
    );
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toContain('no net named "GHOST"');
  });

  it('create_sheet emits add_sheet + interface + moves, resolving parents by name', () => {
    const registry = createArchitectRegistry();
    const g = design();
    const ctx = { graph: g, parts };

    const psu = registry.dispatch(
      'create_sheet',
      {
        name: 'PSU',
        components: ['R1', 'C1'],
        interface: [
          { name: 'VOUT', direction: 'out', net: 'VCC' },
          { name: 'GND', direction: 'inout', net: 'GND' },
        ],
      },
      ctx,
    );
    expect(psu.ok).toBe(true);
    if (!psu.ok) return;
    expect(psu.result.ops.map((o) => o.kind)).toEqual([
      'add_sheet',
      'set_sheet_interface',
      'move_to_sheet',
      'move_to_sheet',
    ]);
    applyAll(g, psu.result.ops);

    // Child under PSU by NAME; sheet structure is live in the working graph.
    const child = registry.dispatch(
      'create_sheet',
      { name: 'Filter', parent: 'PSU', components: [] },
      ctx,
    );
    expect(child.ok).toBe(true);
    if (child.ok) {
      const add = child.result.ops[0];
      expect(add).toMatchObject({ kind: 'add_sheet', name: 'Filter' });
      if (add?.kind === 'add_sheet') {
        expect(g.sheets.get(add.parentId ?? '')?.name).toBe('PSU');
      }
    }

    const orphan = registry.dispatch(
      'create_sheet',
      { name: 'X', parent: 'GHOST', components: [] },
      ctx,
    );
    expect(orphan.ok).toBe(false);

    const badPort = registry.dispatch(
      'create_sheet',
      { name: 'Y', components: [], interface: [{ name: 'P', direction: 'in', net: 'GHOST' }] },
      ctx,
    );
    expect(badPort.ok).toBe(false);
    if (!badPort.ok) expect(badPort.error).toContain('interface port P');
  });

  it('move_components targets existing sheets by name, or the root with null', () => {
    const registry = createArchitectRegistry();
    const g = design();
    const ctx = { graph: g, parts };
    applyAll(g, [{ kind: 'add_sheet', id: 'sh-psu', name: 'PSU', parentId: null }]);

    const onto = registry.dispatch('move_components', { components: ['R2'], sheet: 'PSU' }, ctx);
    expect(onto.ok).toBe(true);
    if (onto.ok) {
      expect(onto.result.ops).toEqual([{ kind: 'move_to_sheet', componentId: 'rb', sheetId: 'sh-psu' }]);
    }

    const back = registry.dispatch('move_components', { components: ['R2'], sheet: null }, ctx);
    expect(back.ok).toBe(true);
    if (back.ok) {
      expect(back.result.ops).toEqual([{ kind: 'move_to_sheet', componentId: 'rb', sheetId: null }]);
    }

    expect(registry.dispatch('move_components', { components: ['R2'], sheet: 'GHOST' }, ctx).ok).toBe(false);
    expect(registry.dispatch('move_components', { components: ['GHOST'], sheet: null }, ctx).ok).toBe(false);
  });
});

describe('runArchitect (FakeProvider end-to-end)', () => {
  it('reads → buses power → sheets the PSU → verifies, applying ops to the working copy', async () => {
    const provider = new FakeProvider([
      [{ kind: 'tool_use', id: 't1', name: 'read_structure', input: {} }],
      [
        {
          kind: 'tool_use',
          id: 't2',
          name: 'create_bus',
          input: { name: 'POWER', busKind: 'PWR', nets: ['VCC', 'GND'] },
        },
      ],
      [
        {
          kind: 'tool_use',
          id: 't3',
          name: 'create_sheet',
          input: {
            name: 'PSU',
            components: ['R1', 'C1'],
            interface: [{ name: 'VOUT', direction: 'out', net: 'VCC' }],
          },
        },
      ],
      [{ kind: 'tool_use', id: 't4', name: 'read_structure', input: {} }],
      [{ kind: 'text', text: 'Organized: POWER bus over VCC+GND, PSU sheet with R1 and C1.' }],
    ]);

    const result = await runArchitect({
      prompt: 'organize this design',
      graph: design(),
      parts,
      provider,
    });

    expect(result.ops.map((o) => o.kind)).toEqual([
      'create_bus',
      'assign_to_bus',
      'assign_to_bus',
      'add_sheet',
      'set_sheet_interface',
      'move_to_sheet',
      'move_to_sheet',
    ]);
    expect(result.envelopes).toHaveLength(7);
    expect(result.envelopes[0]?.meta).toMatchObject({ agent: 'architect' });
    expect(result.envelopes[0]?.meta?.rationale).toContain('POWER');
    expect(result.finalText).toContain('Organized');

    // The closing read_structure saw the WORKING copy: structure landed.
    const flat = JSON.stringify(result.transcript);
    expect(flat).toContain('1 sheet(s), 1 bus(es), 1 unbussed net(s), 1 root component(s)');
  });

  it('destructive structure changes honor the confirm gate', async () => {
    const provider = new FakeProvider([
      [
        {
          kind: 'tool_use',
          id: 't1',
          name: 'create_bus',
          input: { name: 'POWER', busKind: 'PWR', nets: ['VCC'] },
        },
      ],
      [{ kind: 'text', text: 'declined' }],
    ]);
    const result = await runArchitect({
      prompt: 'organize it',
      graph: design(),
      parts,
      provider,
      confirmDestructive: () => false,
    });
    expect(result.ops).toEqual([]);
    expect(JSON.stringify(result.transcript)).toContain('user declined');
  });
});
