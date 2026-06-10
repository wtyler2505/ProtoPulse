import { materialize } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { describe, expect, it } from 'vitest';

import { elementName } from './models.js';
import { compareRefs, generateSpiceNetlist } from './netlist.js';

import type { DesignGraph, OpBody } from '@protopulse/graph';

const parts = seedPartDb();

function graphOf(ops: OpBody[]): DesignGraph {
  return materialize(ops.map((op, i) => ({ actor: 't', lamport: i + 1, ts: 0, op }))).graph;
}

/** Battery + resistor + LED, fully wired, GND named explicitly. */
function ledOps(): OpBody[] {
  return [
    { kind: 'add_component', id: 'bat', ref: 'BT1', partId: 'core:battery', partRev: 1, value: '9V' },
    { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1, value: '330' },
    { kind: 'add_component', id: 'led', ref: 'D1', partId: 'core:led', partRev: 1, value: 'red' },
    { kind: 'connect', port: 'bat:+', newNetId: 'nv' },
    { kind: 'connect', port: 'r1:1', netId: 'nv' },
    { kind: 'connect', port: 'r1:2', newNetId: 'nm' },
    { kind: 'connect', port: 'led:A', netId: 'nm' },
    { kind: 'connect', port: 'led:K', newNetId: 'ng' },
    { kind: 'connect', port: 'bat:-', netId: 'ng' },
    { kind: 'rename_net', netId: 'nv', name: 'VBAT' },
    { kind: 'rename_net', netId: 'nm', name: 'LED_A' },
    { kind: 'rename_net', netId: 'ng', name: 'GND' },
  ];
}

describe('compareRefs', () => {
  it('natural-sorts refs', () => {
    expect(['R10', 'R2', 'BT1', 'D1', 'R1'].sort(compareRefs)).toEqual([
      'BT1',
      'D1',
      'R1',
      'R2',
      'R10',
    ]);
  });
});

describe('elementName', () => {
  it('keeps refs that already start with the element letter', () => {
    expect(elementName('R', 'R1')).toBe('R1');
    expect(elementName('D', 'D12')).toBe('D12');
  });
  it('prefixes refs that do not', () => {
    expect(elementName('V', 'BT1')).toBe('VBT1');
    expect(elementName('R', 'SW1')).toBe('RSW1');
    expect(elementName('M', 'Q2')).toBe('MQ2');
  });
});

describe('generateSpiceNetlist — battery + R + LED', () => {
  it('emits the exact deck body', () => {
    const { netlist } = generateSpiceNetlist(graphOf(ledOps()), parts);
    expect(netlist).toBe(
      [
        '* ProtoPulse design',
        'VBT1 vbat 0 DC 9',
        'D1 led_a 0 DLED_D1',
        'R1 vbat led_a 330',
        '.model DLED_D1 D(IS=1e-20 N=2.0)',
        '',
      ].join('\n'),
    );
  });

  it('maps a net named GND to node 0', () => {
    const { nodeOf } = generateSpiceNetlist(graphOf(ledOps()), parts);
    expect(nodeOf.get('ng')).toBe('0');
    expect(nodeOf.get('nv')).toBe('vbat');
    expect(nodeOf.get('nm')).toBe('led_a');
  });

  it('reports honest tiers in the manifest, sorted by ref', () => {
    const { manifest } = generateSpiceNetlist(graphOf(ledOps()), parts);
    expect(manifest.map((e) => [e.ref, e.tier])).toEqual([
      ['BT1', 'behavioral'],
      ['D1', 'behavioral'],
      ['R1', 'spice'],
    ]);
    expect(manifest[1]?.note).toContain('no color binning');
  });

  it('uses a custom title', () => {
    const { netlist } = generateSpiceNetlist(graphOf(ledOps()), parts, { title: 'blinky' });
    expect(netlist.startsWith('* blinky\n')).toBe(true);
  });

  it('is deterministic across repeated and reordered materialization', () => {
    const a = generateSpiceNetlist(graphOf(ledOps()), parts);
    const b = generateSpiceNetlist(graphOf(ledOps()), parts);
    const ops = ledOps();
    const swapped = [ops[1], ops[0], ...ops.slice(2)] as OpBody[];
    const c = generateSpiceNetlist(graphOf(swapped), parts);
    expect(b.netlist).toBe(a.netlist);
    expect(c.netlist).toBe(a.netlist);
    expect(b.manifest).toEqual(a.manifest);
  });
});

describe('generateSpiceNetlist — ground aliasing and node names', () => {
  it('aliases any net wired to core:pwr-gnd to node 0', () => {
    const { netlist, nodeOf } = generateSpiceNetlist(
      graphOf([
        { kind: 'add_component', id: 'bat', ref: 'BT1', partId: 'core:battery', partRev: 1, value: '5V' },
        { kind: 'add_component', id: 'gnd', ref: 'PWR1', partId: 'core:pwr-gnd', partRev: 1 },
        { kind: 'connect', port: 'bat:+', newNetId: 'np' },
        { kind: 'connect', port: 'bat:-', newNetId: 'nr' },
        { kind: 'connect', port: 'gnd:1', netId: 'nr' },
        { kind: 'rename_net', netId: 'np', name: 'VIN' },
        { kind: 'rename_net', netId: 'nr', name: 'RAIL_RETURN' },
      ]),
      parts,
    );
    expect(nodeOf.get('nr')).toBe('0');
    expect(netlist).toContain('VBT1 vin 0 DC 5');
    // The ground pseudo-symbol emits no element of its own.
    expect(netlist).not.toContain('PWR1');
  });

  it('sanitizes net names and resolves collisions deterministically', () => {
    const { nodeOf } = generateSpiceNetlist(
      graphOf([
        { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1, value: '1k' },
        { kind: 'add_component', id: 'r2', ref: 'R2', partId: 'core:resistor', partRev: 1, value: '1k' },
        { kind: 'connect', port: 'r1:1', newNetId: 'na' },
        { kind: 'connect', port: 'r2:1', newNetId: 'nb' },
        { kind: 'rename_net', netId: 'na', name: 'OUT' },
        { kind: 'rename_net', netId: 'nb', name: 'out' },
      ]),
      parts,
    );
    // Both sanitize to 'out'; 'OUT' sorts first and claims it.
    expect(nodeOf.get('na')).toBe('out');
    expect(nodeOf.get('nb')).toBe('out_2');
  });

  it('parks unconnected pins on unique dangling nodes', () => {
    const { netlist } = generateSpiceNetlist(
      graphOf([
        { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1, value: '470' },
        { kind: 'connect', port: 'r1:1', newNetId: 'na' },
        { kind: 'rename_net', netId: 'na', name: 'IN' },
      ]),
      parts,
    );
    expect(netlist).toContain('R1 in nc_r1_2 470');
  });
});

describe('generateSpiceNetlist — exclusions', () => {
  it('excludes DNP components with an honest note', () => {
    const { netlist, manifest } = generateSpiceNetlist(
      graphOf([...ledOps(), { kind: 'set_component_props', id: 'led', props: { dnp: true } }]),
      parts,
    );
    expect(netlist).not.toContain('DLED');
    const led = manifest.find((e) => e.ref === 'D1');
    expect(led).toEqual({
      ref: 'D1',
      partId: 'core:led',
      tier: 'stub',
      note: 'DNP — excluded from simulation',
    });
  });

  it('stubs unmodelable parts (header, USB-C) without emitting elements', () => {
    const { netlist, manifest } = generateSpiceNetlist(
      graphOf([
        { kind: 'add_component', id: 'j1', ref: 'J1', partId: 'core:header-2x10', partRev: 1 },
        { kind: 'add_component', id: 'j2', ref: 'J2', partId: 'core:usbc-power-stub', partRev: 1 },
      ]),
      parts,
    );
    expect(netlist).toBe('* ProtoPulse design\n');
    expect(manifest.map((e) => [e.ref, e.tier, e.note])).toEqual([
      ['J1', 'stub', 'no model — excluded from simulation'],
      ['J2', 'stub', 'no model — excluded from simulation'],
    ]);
  });

  it('stubs components whose part is missing from the registry', () => {
    const { manifest } = generateSpiceNetlist(
      graphOf([
        { kind: 'add_component', id: 'x1', ref: 'X1', partId: 'core:does-not-exist', partRev: 1 },
      ]),
      parts,
    );
    expect(manifest).toEqual([
      {
        ref: 'X1',
        partId: 'core:does-not-exist',
        tier: 'stub',
        note: 'part not found in registry — excluded from simulation',
      },
    ]);
  });
});

describe('generateSpiceNetlist — model zoo', () => {
  it('emits BAT54S as two series diodes through the common pin 3', () => {
    const { netlist } = generateSpiceNetlist(
      graphOf([
        { kind: 'add_component', id: 'd1', ref: 'D1', partId: 'core:bat54s', partRev: 1 },
        { kind: 'connect', port: 'd1:1', newNetId: 'na' },
        { kind: 'connect', port: 'd1:3', newNetId: 'nm' },
        { kind: 'connect', port: 'd1:2', newNetId: 'nk' },
        { kind: 'rename_net', netId: 'na', name: 'A' },
        { kind: 'rename_net', netId: 'nm', name: 'MID' },
        { kind: 'rename_net', netId: 'nk', name: 'K' },
      ]),
      parts,
    );
    expect(netlist).toContain('D1A a mid DBAT54');
    expect(netlist).toContain('D1B mid k DBAT54');
    expect(netlist).toContain('.model DBAT54 D(IS=1e-7 N=1.08 RS=0.8)');
  });

  it('emits the 2N3904 with SPICE C B E node order', () => {
    const { netlist, manifest } = generateSpiceNetlist(
      graphOf([
        { kind: 'add_component', id: 'q1', ref: 'Q1', partId: 'core:2n3904', partRev: 1 },
        { kind: 'connect', port: 'q1:B', newNetId: 'nb' },
        { kind: 'connect', port: 'q1:C', newNetId: 'nc' },
        { kind: 'connect', port: 'q1:E', newNetId: 'ne' },
        { kind: 'rename_net', netId: 'nb', name: 'BASE' },
        { kind: 'rename_net', netId: 'nc', name: 'COLL' },
        { kind: 'rename_net', netId: 'ne', name: 'EMIT' },
      ]),
      parts,
    );
    expect(netlist).toContain('Q1 coll base emit Q2N3904');
    expect(manifest[0]?.tier).toBe('spice');
  });

  it('emits the AO3400 NMOS as level-1 with bulk tied to source', () => {
    const { netlist, manifest } = generateSpiceNetlist(
      graphOf([
        { kind: 'add_component', id: 'q1', ref: 'Q1', partId: 'core:nmos-ao3400', partRev: 1 },
        { kind: 'connect', port: 'q1:G', newNetId: 'ng' },
        { kind: 'connect', port: 'q1:D', newNetId: 'nd' },
        { kind: 'connect', port: 'q1:S', newNetId: 'ns' },
        { kind: 'rename_net', netId: 'ng', name: 'GATE' },
        { kind: 'rename_net', netId: 'nd', name: 'DRAIN' },
        { kind: 'rename_net', netId: 'ns', name: 'SRC' },
      ]),
      parts,
    );
    expect(netlist).toContain('MQ1 drain gate src src NMOS_AO3400');
    expect(netlist).toContain('.model NMOS_AO3400 NMOS(VTO=1.05 KP=20 LAMBDA=0.01)');
    expect(manifest[0]?.note).toContain('no gate charge');
  });

  it('emits 1N4148 (spice tier) and 1N5819 (behavioral) with their model cards', () => {
    const { netlist, manifest } = generateSpiceNetlist(
      graphOf([
        { kind: 'add_component', id: 'd1', ref: 'D1', partId: 'core:1n4148', partRev: 1 },
        { kind: 'add_component', id: 'd2', ref: 'D2', partId: 'core:1n5819', partRev: 1 },
      ]),
      parts,
    );
    expect(netlist).toContain('D1 nc_d1_a nc_d1_k D1N4148');
    expect(netlist).toContain('D2 nc_d2_a nc_d2_k D1N5819');
    expect(netlist).toContain(
      '.model D1N4148 D(IS=4.352e-9 N=1.906 RS=0.6458 CJO=7.048e-13 TT=3.48e-9 BV=100)',
    );
    expect(netlist).toContain('.model D1N5819 D(IS=3.1e-6 N=1.0 RS=0.06 CJO=110e-12 TT=0 BV=40)');
    expect(manifest.map((e) => e.tier)).toEqual(['spice', 'behavioral']);
  });

  it('instantiates the NE555 as a behavioral subcircuit in DIP-8 pin order', () => {
    const { netlist, manifest } = generateSpiceNetlist(
      graphOf([
        { kind: 'add_component', id: 'u1', ref: 'U1', partId: 'core:ne555', partRev: 1 },
        { kind: 'connect', port: 'u1:1', newNetId: 'ng' },
        { kind: 'connect', port: 'u1:2', newNetId: 'nt' },
        { kind: 'connect', port: 'u1:3', newNetId: 'no' },
        { kind: 'connect', port: 'u1:6', netId: 'nt' },
        { kind: 'connect', port: 'u1:8', newNetId: 'nv' },
        { kind: 'rename_net', netId: 'ng', name: 'GND' },
        { kind: 'rename_net', netId: 'nt', name: 'TIMING' },
        { kind: 'rename_net', netId: 'no', name: 'OUT' },
        { kind: 'rename_net', netId: 'nv', name: 'VCC' },
      ]),
      parts,
    );
    // GND TRIG OUT RESET CONT THRES DISCH VCC; pins 4/5/7 dangle.
    expect(netlist).toContain('XU1 0 timing out nc_u1_4 nc_u1_5 timing nc_u1_7 vcc NE555_PP');
    expect(netlist).toContain('.subckt NE555_PP gnd trig out reset cont thres disch vcc');
    expect(netlist).toContain('.ends NE555_PP');
    expect(manifest).toEqual([
      {
        ref: 'U1',
        partId: 'core:ne555',
        tier: 'behavioral',
        note: 'behavioral macromodel — ideal comparators, simplified SR latch, approximate output stage; no supply-current modeling',
      },
    ]);
  });

  it('emits the NE555 subcircuit definition once for multiple instances', () => {
    const { netlist } = generateSpiceNetlist(
      graphOf([
        { kind: 'add_component', id: 'u1', ref: 'U1', partId: 'core:ne555', partRev: 1 },
        { kind: 'add_component', id: 'u2', ref: 'U2', partId: 'core:ne555', partRev: 1 },
      ]),
      parts,
    );
    expect(netlist.match(/^\.subckt NE555_PP /gm)).toHaveLength(1);
    expect(netlist.match(/^XU\d /gm)).toHaveLength(2);
  });

  it('takes the TVS breakdown voltage from the component value', () => {
    const { netlist } = generateSpiceNetlist(
      graphOf([
        { kind: 'add_component', id: 'd1', ref: 'D1', partId: 'core:tvs-unidirectional', partRev: 1, value: '12V' },
        { kind: 'add_component', id: 'd2', ref: 'D2', partId: 'core:tvs-unidirectional', partRev: 1 },
      ]),
      parts,
    );
    expect(netlist).toContain('.model DTVS_D1 D(IS=1e-12 N=1.0 BV=12 IBV=1e-3)');
    // No value → datasheet-less 24V default.
    expect(netlist).toContain('.model DTVS_D2 D(IS=1e-12 N=1.0 BV=24 IBV=1e-3)');
  });

  it('models the pushbutton as a closed 1mΩ switch', () => {
    const { netlist, manifest } = generateSpiceNetlist(
      graphOf([
        { kind: 'add_component', id: 'sw', ref: 'SW1', partId: 'core:pushbutton', partRev: 1 },
      ]),
      parts,
    );
    expect(netlist).toContain('RSW1 nc_sw1_1 nc_sw1_2 0.001');
    expect(manifest[0]?.note).toBe('modeled closed (pressed)');
  });

  it('emits pwr-vcc as an ideal rail to ground with a 5V default', () => {
    const { netlist, manifest } = generateSpiceNetlist(
      graphOf([
        { kind: 'add_component', id: 'p1', ref: 'PWR1', partId: 'core:pwr-vcc', partRev: 1 },
        { kind: 'add_component', id: 'p2', ref: 'PWR2', partId: 'core:pwr-vcc', partRev: 1, value: '3.3V' },
        { kind: 'connect', port: 'p1:1', newNetId: 'nv' },
        { kind: 'connect', port: 'p2:1', newNetId: 'nw' },
        { kind: 'rename_net', netId: 'nv', name: 'VCC' },
        { kind: 'rename_net', netId: 'nw', name: 'V33' },
      ]),
      parts,
    );
    expect(netlist).toContain('VPWR1 vcc 0 DC 5');
    expect(netlist).toContain('VPWR2 v33 0 DC 3.3');
    expect(manifest[0]?.note).toContain('ideal rail');
    expect(manifest[0]?.note).toContain('defaulted to 5V');
    expect(manifest[1]?.note).toBe('ideal rail');
  });

  it('applies valueOverrides by component id without mutating the graph', () => {
    const graph = graphOf(ledOps());
    const { netlist, manifest } = generateSpiceNetlist(graph, parts, {
      valueOverrides: new Map([
        ['r1', '1k'],
        ['bat', '5V'],
      ]),
    });
    expect(netlist).toContain('R1 vbat led_a 1000');
    expect(netlist).toContain('VBT1 vbat 0 DC 5');
    expect(manifest.map((e) => [e.ref, e.tier])).toEqual([
      ['BT1', 'behavioral'],
      ['D1', 'behavioral'],
      ['R1', 'spice'],
    ]);
    // The graph still carries the original values.
    expect(graph.components.get('r1')?.value).toBe('330');
    expect(graph.components.get('bat')?.value).toBe('9V');
    // Without overrides the original deck comes back.
    expect(generateSpiceNetlist(graph, parts).netlist).toContain('R1 vbat led_a 330');
  });

  it('routes unparseable overrides through the default-with-note path', () => {
    const { netlist, manifest } = generateSpiceNetlist(graphOf(ledOps()), parts, {
      valueOverrides: new Map([['r1', 'garbage']]),
    });
    expect(netlist).toContain('R1 vbat led_a 1000');
    expect(manifest.find((e) => e.ref === 'R1')?.note).toBe(
      'value "garbage" unparseable — defaulted to 1k',
    );
  });

  it('defaults unparseable values with a manifest note', () => {
    const { netlist, manifest } = generateSpiceNetlist(
      graphOf([
        { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1, value: 'TBD' },
        { kind: 'add_component', id: 'c1', ref: 'C1', partId: 'core:capacitor', partRev: 1 },
        { kind: 'add_component', id: 'c2', ref: 'C2', partId: 'core:capacitor-electrolytic', partRev: 1, value: '10uF' },
      ]),
      parts,
    );
    expect(netlist).toContain('R1 nc_r1_1 nc_r1_2 1000');
    expect(netlist).toContain('C1 nc_c1_1 nc_c1_2 1e-7');
    expect(netlist).toContain('C2 nc_c2_1 nc_c2_2 1e-5');
    const byRef = new Map(manifest.map((e) => [e.ref, e]));
    expect(byRef.get('R1')?.note).toBe('value "TBD" unparseable — defaulted to 1k');
    expect(byRef.get('C1')?.note).toBe('no value — defaulted to 100nF');
    expect(byRef.get('C2')?.note).toBeUndefined();
  });
});
