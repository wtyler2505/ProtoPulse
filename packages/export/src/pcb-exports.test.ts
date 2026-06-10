import { materialize } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { describe, expect, it } from 'vitest';

import { exportExcellon } from './excellon.js';
import { exportGerberLayer } from './gerber.js';
import { exportPickPlace } from './pick-place.js';

import type { OpBody } from '@protopulse/graph';

const parts = seedPartDb();
const DATE = '2026-01-01T00:00:00.000Z';

function graphOf(ops: OpBody[]) {
  return materialize(ops.map((op, i) => ({ actor: 't', lamport: i + 1, ts: 0, op }))).graph;
}

/** R1 + D1 (0805 SMD), routed on F.Cu, via to B.Cu, B.Cu return. */
function routedSmdOps(): OpBody[] {
  return [
    { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1, value: '330' },
    { kind: 'add_component', id: 'd1', ref: 'D1', partId: 'core:led', partRev: 1, value: 'red' },
    { kind: 'connect', port: 'r1:2', newNetId: 'nm' },
    { kind: 'connect', port: 'd1:A', netId: 'nm' },
    { kind: 'place_footprint', componentId: 'r1', at: { x: 5_000_000, y: 0 }, rotMilli: 0, side: 'top', locked: false },
    { kind: 'place_footprint', componentId: 'd1', at: { x: 15_000_000, y: 0 }, rotMilli: 0, side: 'top', locked: false },
    { kind: 'route_trace', id: 'tr-a', netId: 'nm', layerId: 'F.Cu', widthNm: 250_000, path: [{ x: 5_950_000, y: 0 }, { x: 10_000_000, y: 0 }] },
    { kind: 'place_via', id: 'via-a', netId: 'nm', at: { x: 10_000_000, y: 0 }, drillNm: 300_000, padNm: 600_000, span: ['F.Cu', 'B.Cu'] },
    { kind: 'route_trace', id: 'tr-b', netId: 'nm', layerId: 'B.Cu', widthNm: 250_000, path: [{ x: 10_000_000, y: 0 }, { x: 14_050_000, y: 0 }] },
  ];
}

/** A through-hole part: NE555 in the DIP-8 seed footprint at origin. */
function dipOps(): OpBody[] {
  return [
    { kind: 'add_component', id: 'u1', ref: 'U1', partId: 'core:ne555', partRev: 1 },
    { kind: 'place_footprint', componentId: 'u1', at: { x: 0, y: 0 }, rotMilli: 0, side: 'top', locked: false },
  ];
}

describe('exportGerberLayer', () => {
  it('emits the X2 header shape with injected date and M02 end', () => {
    const out = exportGerberLayer(graphOf(routedSmdOps()), parts, 'F.Cu', { date: DATE });
    expect(out.startsWith('%TF.GenerationSoftware,ProtoPulse,export,0.1.0*%\n')).toBe(true);
    expect(out).toContain(`%TF.CreationDate,${DATE}*%`);
    expect(out).toContain('%TF.FileFunction,Copper,L1,Top*%');
    expect(out).toContain('%TF.FilePolarity,Positive*%');
    expect(out).toContain('%FSLAX46Y46*%');
    expect(out).toContain('%MOMM*%');
    expect(out.endsWith('M02*\n')).toBe(true);
  });

  it('labels B.Cu as Copper,L2,Bot', () => {
    const out = exportGerberLayer(graphOf(routedSmdOps()), parts, 'B.Cu', { date: DATE });
    expect(out).toContain('%TF.FileFunction,Copper,L2,Bot*%');
  });

  it('flashes SMD pads at transformed positions on the placement side only', () => {
    const top = exportGerberLayer(graphOf(routedSmdOps()), parts, 'F.Cu', { date: DATE });
    // R1 at (5mm,0): pads at ±0.95mm → 4.05mm / 5.95mm.
    expect(top).toContain('X4050000Y0D03*');
    expect(top).toContain('X5950000Y0D03*');
    const bottom = exportGerberLayer(graphOf(routedSmdOps()), parts, 'B.Cu', { date: DATE });
    expect(bottom).not.toContain('X4050000Y0D03*');
  });

  it('dedupes apertures: identical pads, trace widths share one D-code', () => {
    const out = exportGerberLayer(graphOf(routedSmdOps()), parts, 'F.Cu', { date: DATE });
    const ads = out.match(/%ADD\d+/g) ?? [];
    // One rect aperture for all four 0805 pads, one circle for the trace
    // width (0.25), one circle for the via pad (0.6) — three total.
    expect(ads).toEqual(['%ADD10', '%ADD11', '%ADD12']);
    expect(out).toContain('C,0.25*%');
    expect(out).toContain('C,0.6*%');
    expect(out).toContain('R,1X1.25*%');
  });

  it('sorts apertures circles-first by dimension, D-codes from 10', () => {
    const out = exportGerberLayer(graphOf(routedSmdOps()), parts, 'F.Cu', { date: DATE });
    expect(out).toContain('%ADD10C,0.25*%');
    expect(out).toContain('%ADD11C,0.6*%');
    expect(out).toContain('%ADD12R,1X1.25*%');
  });

  it('flashes through-hole pads on BOTH copper layers', () => {
    for (const layer of ['F.Cu', 'B.Cu'] as const) {
      const out = exportGerberLayer(graphOf(dipOps()), parts, layer, { date: DATE });
      // DIP-8 pin 1 at (-3.81mm, +3.81mm), 1.6mm circle pad.
      expect(out).toContain('C,1.6*%');
      expect(out).toContain('X-3810000Y3810000D03*');
    }
  });

  it('flashes via pads on BOTH copper layers', () => {
    for (const layer of ['F.Cu', 'B.Cu'] as const) {
      const out = exportGerberLayer(graphOf(routedSmdOps()), parts, layer, { date: DATE });
      expect(out).toContain('C,0.6*%');
      expect(out).toContain('X10000000Y0D03*');
    }
  });

  it('draws traces as D02 move + D01 segments on their own layer only', () => {
    const top = exportGerberLayer(graphOf(routedSmdOps()), parts, 'F.Cu', { date: DATE });
    expect(top).toContain('X5950000Y0D02*\nX10000000Y0D01*');
    expect(top).not.toContain('X14050000Y0D01*');
    const bottom = exportGerberLayer(graphOf(routedSmdOps()), parts, 'B.Cu', { date: DATE });
    expect(bottom).toContain('X10000000Y0D02*\nX14050000Y0D01*');
  });

  it('applies the bottom-side transform: mirror X before rotation', () => {
    const ops: OpBody[] = [
      { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1 },
      { kind: 'place_footprint', componentId: 'r1', at: { x: 10_000_000, y: 0 }, rotMilli: 0, side: 'bottom', locked: false },
    ];
    const bottom = exportGerberLayer(graphOf(ops), parts, 'B.Cu', { date: DATE });
    // Pad 1 local (-0.95mm,0) mirrors to +0.95mm → 10.95mm.
    expect(bottom).toContain('X10950000Y0D03*');
    expect(exportGerberLayer(graphOf(ops), parts, 'F.Cu', { date: DATE })).not.toContain('D03*');
  });

  it('rotates rect apertures: 90° swaps width and height', () => {
    const ops: OpBody[] = [
      { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1 },
      { kind: 'place_footprint', componentId: 'r1', at: { x: 0, y: 0 }, rotMilli: 90_000, side: 'top', locked: false },
    ];
    const out = exportGerberLayer(graphOf(ops), parts, 'F.Cu', { date: DATE });
    expect(out).toContain('R,1.25X1*%');
    // Pad 1 local (-0.95mm,0) rotated CCW 90° → (0,-0.95mm).
    expect(out).toContain('X0Y-950000D03*');
  });

  it('is deterministic: op order does not change the bytes', () => {
    const a = exportGerberLayer(graphOf(routedSmdOps()), parts, 'F.Cu', { date: DATE });
    const ops = routedSmdOps();
    const swapped = [ops[1], ops[0], ops[2], ops[3], ops[5], ops[4], ...ops.slice(6)] as OpBody[];
    const b = exportGerberLayer(graphOf(swapped), parts, 'F.Cu', { date: DATE });
    expect(a).toBe(b);
  });

  it('formats mm with 6dp max and no float dust', () => {
    const ops: OpBody[] = [
      { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1 },
      { kind: 'connect', port: 'r1:1', newNetId: 'n1' },
      { kind: 'route_trace', id: 't1', netId: 'n1', layerId: 'F.Cu', widthNm: 333_333, path: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
      { kind: 'route_trace', id: 't2', netId: 'n1', layerId: 'F.Cu', widthNm: 100_000, path: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
      { kind: 'route_trace', id: 't3', netId: 'n1', layerId: 'F.Cu', widthNm: 1_000_000, path: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
    ];
    const out = exportGerberLayer(graphOf(ops), parts, 'F.Cu', { date: DATE });
    expect(out).toContain('C,0.333333*%');
    expect(out).toContain('C,0.1*%');
    expect(out).toContain('C,1*%');
    expect(out).not.toMatch(/\d\.\d{7,}/);
  });
});

describe('exportExcellon', () => {
  it('emits M48/METRIC header, injected date, M30 end', () => {
    const out = exportExcellon(graphOf(routedSmdOps()), parts, { date: DATE });
    expect(out.startsWith('M48\n')).toBe(true);
    expect(out).toContain(`; Created: ${DATE}`);
    expect(out).toContain('METRIC');
    expect(out.endsWith('M30\n')).toBe(true);
  });

  it('dedupes tools and sorts them by diameter', () => {
    const out = exportExcellon(graphOf([...routedSmdOps(), ...dipOps()]), parts, { date: DATE });
    // Via drill 0.3 then the eight DIP pads' shared 0.8 drill.
    expect(out).toContain('T1C0.300\nT2C0.800\n%');
    expect(out.match(/C0\.800/g)).toHaveLength(1);
  });

  it('emits hits per tool in mm 3.3 format', () => {
    const out = exportExcellon(graphOf([...routedSmdOps(), ...dipOps()]), parts, { date: DATE });
    expect(out).toContain('T1\nX10.000Y0.000');
    // DIP-8 pin 1 world position (-3.81mm, +3.81mm).
    expect(out).toContain('X-3.810Y3.810');
  });

  it('SMD-only boards drill only the vias', () => {
    const out = exportExcellon(graphOf(routedSmdOps()), parts, { date: DATE });
    expect(out).toContain('T1C0.300');
    expect(out).not.toContain('T2');
  });

  it('is deterministic: op order does not change the bytes', () => {
    const ops = [...routedSmdOps(), ...dipOps()];
    const swapped = [ops[1], ops[0], ...ops.slice(2)] as OpBody[];
    expect(exportExcellon(graphOf(swapped), parts, { date: DATE })).toBe(
      exportExcellon(graphOf(ops), parts, { date: DATE }),
    );
  });
});

describe('exportPickPlace', () => {
  it('lists placed components sorted by natural ref with mm positions', () => {
    const csv = exportPickPlace(graphOf(routedSmdOps()), parts);
    const lines = csv.trimEnd().split('\r\n');
    expect(lines[0]).toBe('Ref,Val,Package,PosX,PosY,Rot,Side');
    expect(lines[1]).toBe('D1,red,LED,15,0,0,top');
    expect(lines[2]).toBe('R1,330,Resistor,5,0,0,top');
    expect(lines).toHaveLength(3);
  });

  it('excludes DNP and unplaced components', () => {
    const csv = exportPickPlace(
      graphOf([
        ...routedSmdOps(),
        { kind: 'add_component', id: 'bat', ref: 'BT1', partId: 'core:battery', partRev: 1 },
        { kind: 'set_component_props', id: 'd1', props: { dnp: true } },
      ]),
      parts,
    );
    expect(csv).not.toContain('D1');
    expect(csv).not.toContain('BT1');
    expect(csv).toContain('R1');
  });

  it('reports bottom side and rotation in degrees', () => {
    const csv = exportPickPlace(
      graphOf([
        { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1, value: '330' },
        { kind: 'place_footprint', componentId: 'r1', at: { x: 1_250_000, y: -2_000_000 }, rotMilli: 90_000, side: 'bottom', locked: false },
      ]),
      parts,
    );
    expect(csv).toContain('R1,330,Resistor,1.25,-2,90,bottom');
  });

  it('quotes fields containing commas', () => {
    const csv = exportPickPlace(
      graphOf([
        { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1, value: '330, 1%' },
        { kind: 'place_footprint', componentId: 'r1', at: { x: 0, y: 0 }, rotMilli: 0, side: 'top', locked: false },
      ]),
      parts,
    );
    expect(csv).toContain('"330, 1%"');
  });
});
