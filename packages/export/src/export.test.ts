import { materialize } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { describe, expect, it } from 'vitest';

import { exportBomCsv } from './bom-csv.js';
import { compareRefs, exportKicadNetlist } from './kicad-netlist.js';

import type { OpBody } from '@protopulse/graph';

const parts = seedPartDb();
const DATE = '2026-01-01T00:00:00.000Z';

function graphOf(ops: OpBody[]) {
  return materialize(ops.map((op, i) => ({ actor: 't', lamport: i + 1, ts: 0, op }))).graph;
}

function ledOps(): OpBody[] {
  return [
    { kind: 'add_component', id: 'bat', ref: 'BT1', partId: 'core:battery', partRev: 1, value: '9V' },
    { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1, value: '330' },
    { kind: 'add_component', id: 'r10', ref: 'R10', partId: 'core:resistor', partRev: 1, value: '330' },
    { kind: 'add_component', id: 'r2', ref: 'R2', partId: 'core:resistor', partRev: 1, value: '1k' },
    { kind: 'add_component', id: 'led', ref: 'D1', partId: 'core:led', partRev: 1, value: 'red' },
    { kind: 'connect', port: 'bat:+', newNetId: 'nv' },
    { kind: 'connect', port: 'r1:1', netId: 'nv' },
    { kind: 'connect', port: 'r1:2', newNetId: 'nm' },
    { kind: 'connect', port: 'led:A', netId: 'nm' },
    { kind: 'connect', port: 'led:K', newNetId: 'ng' },
    { kind: 'connect', port: 'bat:-', netId: 'ng' },
    { kind: 'rename_net', netId: 'nv', name: 'VBAT' },
    { kind: 'rename_net', netId: 'ng', name: 'GND' },
  ];
}

describe('compareRefs (natural sort)', () => {
  it('sorts R2 before R10 and groups prefixes', () => {
    expect(['R10', 'R2', 'U1', 'C1', 'R1'].sort(compareRefs)).toEqual(['C1', 'R1', 'R2', 'R10', 'U1']);
  });
  it('falls back lexicographically for non-numeric refs', () => {
    expect(compareRefs('GND', 'GND')).toBe(0);
    expect(compareRefs('A?', 'A1') > 0 || compareRefs('A?', 'A1') < 0).toBe(true);
  });
});

describe('exportKicadNetlist', () => {
  it('emits the legacy-E shape with reserved net code 0', () => {
    const out = exportKicadNetlist(graphOf(ledOps()), parts, { date: DATE });
    expect(out).toContain('(export (version "E")');
    expect(out).toContain('(net (code 0) (name ""))');
    expect(out).toContain(`(date "${DATE}")`);
    expect(out).toContain('(comp (ref "BT1")');
    expect(out).toContain('(node (ref "R1") (pin "2"))');
  });

  it('is deterministic and order-independent: nets numbered by sorted name', () => {
    const a = exportKicadNetlist(graphOf(ledOps()), parts, { date: DATE });
    // Same design, ops shuffled into a different but equivalent order.
    const ops = ledOps();
    const swapped = [ops[1], ops[0], ...ops.slice(2)] as OpBody[];
    const b = exportKicadNetlist(graphOf(swapped), parts, { date: DATE });
    expect(a).toBe(b);
    // GND sorts before N$2 (auto middle net) and VBAT.
    const gndIdx = a.indexOf('(name "GND")');
    const vbatIdx = a.indexOf('(name "VBAT")');
    expect(gndIdx).toBeGreaterThan(-1);
    expect(gndIdx).toBeLessThan(vbatIdx);
  });

  it('excludes DNP components and their nodes; skips fully-DNP nets', () => {
    const out = exportKicadNetlist(
      graphOf([...ledOps(), { kind: 'set_component_props', id: 'led', props: { dnp: true } }]),
      parts,
      { date: DATE },
    );
    expect(out).not.toContain('(ref "D1")');
    // GND now only carries bat:- — still emitted (one node).
    expect(out).toContain('(name "GND")');
  });

  it('escapes quotes and backslashes in names', () => {
    const out = exportKicadNetlist(
      graphOf([
        { kind: 'add_component', id: 'c1', ref: 'R1', partId: 'core:resistor', partRev: 1, value: '4k7 "sel"' },
        { kind: 'connect', port: 'c1:1', newNetId: 'n1' },
        { kind: 'rename_net', netId: 'n1', name: 'NET\\ODD' },
      ]),
      parts,
      { date: DATE },
    );
    expect(out).toContain('(value "4k7 \\"sel\\"")');
    expect(out).toContain('(name "NET\\\\ODD")');
  });
});

describe('exportBomCsv', () => {
  it('groups by part+value with natural ref order and CRLF rows', () => {
    const csv = exportBomCsv(graphOf(ledOps()), parts);
    const lines = csv.trimEnd().split('\r\n');
    expect(lines[0]).toBe('Refs,Qty,Value,Part,MPN,DNP');
    expect(lines).toContain('R1 R10,2,330,Resistor,,');
    expect(lines).toContain('R2,1,1k,Resistor,,');
    expect(lines).toContain('D1,1,red,LED,,');
  });

  it('marks DNP groups and quotes fields containing commas', () => {
    const csv = exportBomCsv(
      graphOf([
        { kind: 'add_component', id: 'c1', ref: 'C1', partId: 'core:capacitor', partRev: 1, value: '100nF, X7R' },
        { kind: 'set_component_props', id: 'c1', props: { dnp: true } },
      ]),
      parts,
    );
    expect(csv).toContain('"100nF, X7R"');
    expect(csv).toContain(',DNP');
  });
});
