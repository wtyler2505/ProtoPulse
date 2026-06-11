import { materialize, MM } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { describe, expect, it } from 'vitest';

import { computePour, DEFAULT_SPOKE_WIDTH_NM, pourArea } from './pour.js';

import type { DesignGraph, OpBody, Zone } from '@protopulse/graph';

const parts = seedPartDb();
const CLEARANCE = 127_000;

function graphOf(ops: OpBody[]): DesignGraph {
  const r = materialize(ops.map((op, i) => ({ actor: 't', lamport: i + 1, ts: 0, op })));
  const failed = r.warnings.filter((w) => w.kind === 'apply_failed');
  if (failed.length > 0) throw new Error(failed.map((w) => w.message).join('; '));
  return r.graph;
}

/** 20×20mm GND zone; nets via two far-away resistors. */
const ZONE_OPS: OpBody[] = [
  { kind: 'add_component', id: 'ra', ref: 'R1', partId: 'core:resistor', partRev: 1 },
  { kind: 'connect', port: 'ra:1', newNetId: 'n-gnd' },
  { kind: 'connect', port: 'ra:2', newNetId: 'n-sig' },
  { kind: 'place_footprint', componentId: 'ra', at: { x: 100 * MM, y: 0 }, rotMilli: 0, side: 'top', locked: false },
  {
    kind: 'place_zone',
    id: 'z1',
    netId: 'n-gnd',
    layerId: 'F.Cu',
    outline: [
      { x: 0, y: 0 },
      { x: 20 * MM, y: 0 },
      { x: 20 * MM, y: 20 * MM },
      { x: 0, y: 20 * MM },
    ],
  },
];

function zoneOf(g: DesignGraph): Zone {
  const z = g.pcb.zones.get('z1');
  if (!z) throw new Error('no zone');
  return z;
}

const FULL_AREA = 20 * MM * 20 * MM;

describe('computePour', () => {
  it('an empty board pours the whole outline', () => {
    const g = graphOf(ZONE_OPS);
    const pour = computePour(zoneOf(g), g, parts, CLEARANCE);
    expect(pour.polygons).toHaveLength(1);
    expect(pour.keepouts).toBe(0);
    expect(pourArea(pour.polygons[0]!)).toBe(FULL_AREA);
  });

  it('a crossing foreign trace splits the pour and carves clearance', () => {
    const g = graphOf([
      ...ZONE_OPS,
      {
        kind: 'route_trace', id: 't-sig', netId: 'n-sig', layerId: 'F.Cu', widthNm: 250_000,
        path: [{ x: 10 * MM, y: -1 * MM }, { x: 10 * MM, y: 21 * MM }],
      },
    ]);
    const pour = computePour(zoneOf(g), g, parts, CLEARANCE);
    expect(pour.keepouts).toBe(1);
    expect(pour.polygons).toHaveLength(2); // split left/right
    const total = pour.polygons.reduce((a, p) => a + pourArea(p), 0);
    // Carved strip: width 2*(r+clearance) across the 20mm height.
    const strip = 2 * (125_000 + CLEARANCE) * 20 * MM;
    expect(total).toBe(FULL_AREA - strip);
  });

  it('same-net copper does NOT carve (the pour connects to it)', () => {
    const g = graphOf([
      ...ZONE_OPS,
      {
        kind: 'route_trace', id: 't-gnd', netId: 'n-gnd', layerId: 'F.Cu', widthNm: 250_000,
        path: [{ x: 10 * MM, y: -1 * MM }, { x: 10 * MM, y: 21 * MM }],
      },
    ]);
    const pour = computePour(zoneOf(g), g, parts, CLEARANCE);
    expect(pour.keepouts).toBe(0);
    expect(pourArea(pour.polygons[0]!)).toBe(FULL_AREA);
  });

  it('an enclosed foreign via becomes a HOLE; zone clearance override widens it', () => {
    const viaOp: OpBody = {
      kind: 'place_via', id: 'v1', netId: 'n-sig', at: { x: 10 * MM, y: 10 * MM },
      drillNm: 300_000, padNm: 600_000, span: ['F.Cu', 'B.Cu'],
    };
    const g = graphOf([...ZONE_OPS, viaOp]);
    const pour = computePour(zoneOf(g), g, parts, CLEARANCE);
    expect(pour.polygons).toHaveLength(1);
    expect(pour.polygons[0]!.holes).toHaveLength(1);
    const holeArea = FULL_AREA - pourArea(pour.polygons[0]!);
    const r = 300_000 + CLEARANCE; // via pad/2 + clearance, square box
    expect(holeArea).toBe((2 * r) ** 2);

    // Override: clearanceNm on the zone wins over the deck.
    const g2 = graphOf([
      ...ZONE_OPS.map((op) =>
        op.kind === 'place_zone' ? { ...op, clearanceNm: 300_000 } : op,
      ),
      viaOp,
    ]);
    const pour2 = computePour(zoneOf(g2), g2, parts, CLEARANCE);
    const holeArea2 = FULL_AREA - pourArea(pour2.polygons[0]!);
    expect(holeArea2).toBe((2 * (300_000 + 300_000)) ** 2);
    expect(holeArea2).toBeGreaterThan(holeArea);
  });

  it('other-layer copper is ignored; pads on placed parts carve', () => {
    const g = graphOf([
      ...ZONE_OPS,
      {
        kind: 'route_trace', id: 't-b', netId: 'n-sig', layerId: 'B.Cu', widthNm: 250_000,
        path: [{ x: 10 * MM, y: -1 * MM }, { x: 10 * MM, y: 21 * MM }],
      },
    ]);
    expect(computePour(zoneOf(g), g, parts, CLEARANCE).keepouts).toBe(0);

    // Move the resistor INTO the zone: its sig pad carves, its gnd pad doesn't.
    const g2 = graphOf([
      ...ZONE_OPS.map((op) =>
        op.kind === 'place_footprint' ? { ...op, at: { x: 10 * MM, y: 10 * MM } } : op,
      ),
    ]);
    const pour2 = computePour(zoneOf(g2), g2, parts, CLEARANCE);
    expect(pour2.keepouts).toBe(1); // only the foreign-net pad
    expect(pourArea(pour2.polygons[0]!)).toBeLessThan(FULL_AREA);
  });

  it('thermal connect carves 4 corner notches around same-net pads; spokes bridge', () => {
    // Resistor centered in the zone: gnd pad gets the relief, sig pad
    // is foreign copper and carves fully, exactly as in solid mode.
    const thermalOps = ZONE_OPS.map((op) => {
      if (op.kind === 'place_footprint') return { ...op, at: { x: 10 * MM, y: 10 * MM } };
      if (op.kind === 'place_zone') return { ...op, connect: 'thermal' as const };
      return op;
    });
    const g = graphOf(thermalOps);
    const pour = computePour(zoneOf(g), g, parts, CLEARANCE);
    expect(pour.reliefs).toBe(1);
    expect(pour.keepouts).toBe(1);

    // Exact notch area: inflated pad box minus the two spoke strips
    // (union: s·W + s·H − s², W/H = pad + 2·clearance per side).
    const pad = parts.get('core:resistor', 1)?.footprint?.pads[0];
    if (!pad) throw new Error('resistor footprint missing');
    const W = pad.wNm + 2 * CLEARANCE;
    const H = pad.hNm + 2 * CLEARANCE;
    const s = DEFAULT_SPOKE_WIDTH_NM;
    const notchArea = W * H - (s * W + s * H - s * s);

    const gSolid = graphOf(ZONE_OPS.map((op) =>
      op.kind === 'place_footprint' ? { ...op, at: { x: 10 * MM, y: 10 * MM } } : op,
    ));
    const solid = computePour(zoneOf(gSolid), gSolid, parts, CLEARANCE);
    expect(solid.reliefs).toBe(0);

    const thermalArea = pour.polygons.reduce((a, p) => a + pourArea(p), 0);
    const solidArea = solid.polygons.reduce((a, p) => a + pourArea(p), 0);
    expect(solidArea - thermalArea).toBe(notchArea);
  });

  it('thermal zones leave same-net traces and vias solid-connect (the honest cut)', () => {
    const g = graphOf([
      ...ZONE_OPS.map((op) =>
        op.kind === 'place_zone' ? { ...op, connect: 'thermal' as const } : op,
      ),
      {
        kind: 'route_trace', id: 't-gnd', netId: 'n-gnd', layerId: 'F.Cu', widthNm: 250_000,
        path: [{ x: 10 * MM, y: -1 * MM }, { x: 10 * MM, y: 21 * MM }],
      },
      {
        kind: 'place_via', id: 'v-gnd', netId: 'n-gnd', at: { x: 5 * MM, y: 5 * MM },
        drillNm: 300_000, padNm: 600_000, span: ['F.Cu', 'B.Cu'],
      },
    ]);
    const pour = computePour(zoneOf(g), g, parts, CLEARANCE);
    expect(pour.reliefs).toBe(0);
    expect(pour.keepouts).toBe(0);
    expect(pourArea(pour.polygons[0]!)).toBe(FULL_AREA);
  });
});
