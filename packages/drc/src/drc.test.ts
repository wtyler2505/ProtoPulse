import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadConceptDir } from '@protopulse/content';
import { materialize } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { describe, expect, it } from 'vitest';

import { conceptFor, DRC_CODES } from './codes.js';
import { runDrc } from './run.js';

import type { Deck } from '@protopulse/content';
import type { DesignGraph, OpBody } from '@protopulse/graph';

const parts = seedPartDb();

const deck: Deck = {
  deck: 'test-2layer',
  rev: '1',
  rules: {
    min_trace_nm: 127_000,
    min_clearance_nm: 127_000,
    min_drill_nm: 300_000,
    min_annular_nm: 130_000,
    copper_to_edge_nm: 300_000,
    silk_min_width_nm: 153_000,
  },
  classOverrides: { power: { min_trace_nm: 300_000 } },
};

function graphOf(ops: OpBody[]): DesignGraph {
  const result = materialize(ops.map((op, i) => ({ actor: 't', lamport: i + 1, ts: 0, op })));
  const failed = result.warnings.filter((w) => w.kind === 'apply_failed');
  if (failed.length > 0) throw new Error(failed.map((w) => w.message).join('; '));
  if (result.violations.length > 0) throw new Error(result.violations[0]?.message ?? 'violation');
  return result.graph;
}

function codes(ops: OpBody[]): string[] {
  return runDrc(graphOf(ops), parts, deck).map((f) => f.code);
}

/**
 * Battery → resistor → LED with both SMD parts placed: r1 at the origin,
 * the LED 10mm right. r1:2 pad lands at (0.95mm, 0), led:A at (9.05mm, 0).
 */
function placedBoard(): OpBody[] {
  return [
    { kind: 'add_component', id: 'bat', ref: 'BT1', partId: 'core:battery', partRev: 1 },
    { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1, value: '330' },
    { kind: 'add_component', id: 'led', ref: 'D1', partId: 'core:led', partRev: 1 },
    { kind: 'connect', port: 'bat:+', newNetId: 'nv' },
    { kind: 'connect', port: 'r1:1', netId: 'nv' },
    { kind: 'connect', port: 'r1:2', newNetId: 'nm' },
    { kind: 'connect', port: 'led:A', netId: 'nm' },
    { kind: 'connect', port: 'led:K', newNetId: 'ng' },
    { kind: 'connect', port: 'bat:-', netId: 'ng' },
    { kind: 'place_footprint', componentId: 'r1', at: { x: 0, y: 0 }, rotMilli: 0, side: 'top', locked: false },
    { kind: 'place_footprint', componentId: 'led', at: { x: 10_000_000, y: 0 }, rotMilli: 0, side: 'top', locked: false },
  ];
}

/** The mid trace that routes net nm pad-center to pad-center. */
const routeMid: OpBody = {
  kind: 'route_trace',
  id: 'tm',
  netId: 'nm',
  layerId: 'F.Cu',
  widthNm: 250_000,
  path: [{ x: 950_000, y: 0 }, { x: 9_050_000, y: 0 }],
};

describe('runDrc — integration', () => {
  it('a small routed board comes back clean', () => {
    expect(codes([...placedBoard(), routeMid])).toEqual([]);
  });

  it('a placed part without a footprint (battery) contributes nothing', () => {
    expect(
      codes([
        ...placedBoard(),
        routeMid,
        { kind: 'place_footprint', componentId: 'bat', at: { x: -20_000_000, y: 0 }, rotMilli: 0, side: 'top', locked: false },
      ]),
    ).toEqual([]);
  });

  it('runs deterministically', () => {
    const ops = [...placedBoard(), { ...routeMid, widthNm: 100_000 } as OpBody];
    expect(runDrc(graphOf(ops), parts, deck)).toEqual(runDrc(graphOf(ops), parts, deck));
  });
});

describe('DRC-TRACE-WIDTH', () => {
  it('flags a trace under the deck minimum', () => {
    const found = runDrc(graphOf([...placedBoard(), { ...routeMid, widthNm: 100_000 } as OpBody]), parts, deck);
    const width = found.find((f) => f.code === 'DRC-TRACE-WIDTH');
    expect(width).toBeDefined();
    expect(width?.severity).toBe('error');
    expect(width?.message).toContain('127000');
    expect(width?.anchors).toEqual([{ kind: 'net', netId: 'nm' }]);
  });

  it('honors classOverrides via the net class', () => {
    const asPower: OpBody = { kind: 'set_net_class', netId: 'nm', netClass: 'power' };
    // 250000nm passes the base rule but fails the power-class override.
    expect(codes([...placedBoard(), routeMid])).toEqual([]);
    expect(codes([...placedBoard(), routeMid, asPower])).toContain('DRC-TRACE-WIDTH');
  });
});

describe('DRC-CLEARANCE', () => {
  const closeTrace = (layerId: string): OpBody => ({
    kind: 'route_trace',
    id: 'tg',
    netId: 'ng',
    layerId,
    widthNm: 250_000,
    // 50000nm copper gap to tm (center distance 300000, both r=125000).
    path: [{ x: 2_000_000, y: 300_000 }, { x: 8_000_000, y: 300_000 }],
  });

  it('flags two traces of different nets too close on the same layer', () => {
    const found = runDrc(graphOf([...placedBoard(), routeMid, closeTrace('F.Cu')]), parts, deck);
    const clearance = found.find((f) => f.code === 'DRC-CLEARANCE');
    expect(clearance).toBeDefined();
    expect(clearance?.message).toContain('trace tm');
    expect(clearance?.message).toContain('trace tg');
    expect(clearance?.anchors).toContainEqual({ kind: 'net', netId: 'nm' });
    expect(clearance?.anchors).toContainEqual({ kind: 'net', netId: 'ng' });
  });

  it('ignores the same geometry on the other copper layer', () => {
    expect(codes([...placedBoard(), routeMid, closeTrace('B.Cu')])).toEqual([]);
  });

  it('never flags copper of the same net', () => {
    const overlap: OpBody = {
      kind: 'route_trace',
      id: 'tm2',
      netId: 'nm',
      layerId: 'F.Cu',
      widthNm: 250_000,
      path: [{ x: 950_000, y: 0 }, { x: 5_000_000, y: 0 }],
    };
    expect(codes([...placedBoard(), routeMid, overlap])).toEqual([]);
  });

  it('flags pads of different nets that collide', () => {
    // Move the LED so its A pad overlaps r1's pad 1 (different nets).
    const ops = placedBoard().map((op) =>
      op.kind === 'place_footprint' && op.componentId === 'led' ? { ...op, at: { x: 900_000, y: 0 } } : op,
    );
    expect(codes(ops)).toContain('DRC-CLEARANCE');
  });

  it('flags a via too close to a trace of another net (vias span both layers)', () => {
    const via: OpBody = {
      kind: 'place_via',
      id: 'vg',
      netId: 'ng',
      at: { x: 5_000_000, y: 200_000 },
      drillNm: 300_000,
      padNm: 600_000,
      span: ['F.Cu', 'B.Cu'],
    };
    const found = runDrc(graphOf([...placedBoard(), routeMid, via]), parts, deck);
    const clearance = found.find((f) => f.code === 'DRC-CLEARANCE');
    expect(clearance).toBeDefined();
    expect(clearance?.message).toContain('via vg');
  });
});

describe('DRC-ANNULAR and DRC-DRILL', () => {
  const via = (drillNm: number, padNm: number): OpBody => ({
    kind: 'place_via',
    id: 'v1',
    netId: 'nm',
    at: { x: 5_000_000, y: 0 },
    drillNm,
    padNm,
    span: ['F.Cu', 'B.Cu'],
  });

  it('a healthy via passes both checks', () => {
    expect(codes([...placedBoard(), routeMid, via(300_000, 600_000)])).toEqual([]);
  });

  it('flags an annular ring under the minimum', () => {
    // Ring = (500000 − 300000)/2 = 100000 < 130000.
    const found = codes([...placedBoard(), routeMid, via(300_000, 500_000)]);
    expect(found).toContain('DRC-ANNULAR');
    expect(found).not.toContain('DRC-DRILL');
  });

  it('flags a drill under the fab minimum', () => {
    // Ring = (800000 − 200000)/2 = 300000 (fine); drill 200000 < 300000.
    const found = codes([...placedBoard(), routeMid, via(200_000, 800_000)]);
    expect(found).toContain('DRC-DRILL');
    expect(found).not.toContain('DRC-ANNULAR');
  });
});

describe('DRC-UNROUTED', () => {
  it('flags a net whose placed pads have no copper between them', () => {
    const found = runDrc(graphOf(placedBoard()), parts, deck);
    const unrouted = found.find((f) => f.code === 'DRC-UNROUTED');
    expect(unrouted).toBeDefined();
    expect(unrouted?.message).toContain('R1:2');
    expect(unrouted?.message).toContain('D1:A');
    expect(unrouted?.anchors).toEqual([{ kind: 'net', netId: 'nm' }]);
    // Nets with fewer than two placed pads (nv, ng) make no routing demand.
    expect(found.filter((f) => f.code === 'DRC-UNROUTED')).toHaveLength(1);
  });

  it('a trace on the wrong layer does not connect SMD pads', () => {
    expect(codes([...placedBoard(), { ...routeMid, layerId: 'B.Cu' } as OpBody])).toContain('DRC-UNROUTED');
  });

  it('a via stitches layers: top trace + via + bottom trace reaches a bottom-side pad', () => {
    const ops: OpBody[] = [
      ...placedBoard().map((op) =>
        op.kind === 'place_footprint' && op.componentId === 'led' ? { ...op, side: 'bottom' as const } : op,
      ),
      { kind: 'route_trace', id: 't-top', netId: 'nm', layerId: 'F.Cu', widthNm: 250_000, path: [{ x: 950_000, y: 0 }, { x: 5_000_000, y: 0 }] },
      { kind: 'place_via', id: 'v1', netId: 'nm', at: { x: 5_000_000, y: 0 }, drillNm: 300_000, padNm: 600_000, span: ['F.Cu', 'B.Cu'] },
      { kind: 'route_trace', id: 't-bot', netId: 'nm', layerId: 'B.Cu', widthNm: 250_000, path: [{ x: 5_000_000, y: 0 }, { x: 9_050_000, y: 0 }] },
    ];
    expect(codes(ops)).toEqual([]);
    // Without the via the two half-routes never meet.
    expect(codes(ops.filter((op) => op.kind !== 'place_via'))).toContain('DRC-UNROUTED');
  });

  it('through-hole DIP pads connect on either copper layer', () => {
    const ops: OpBody[] = [
      { kind: 'add_component', id: 'u1', ref: 'U1', partId: 'core:ne555', partRev: 1 },
      { kind: 'connect', port: 'u1:1', newNetId: 'n5' },
      { kind: 'connect', port: 'u1:8', netId: 'n5' },
      { kind: 'place_footprint', componentId: 'u1', at: { x: 30_000_000, y: 0 }, rotMilli: 0, side: 'top', locked: false },
      // Pin 1 sits at (−3.81mm, +3.81mm) and pin 8 at (+3.81mm, +3.81mm) — route on the BOTTOM.
      { kind: 'route_trace', id: 't5', netId: 'n5', layerId: 'B.Cu', widthNm: 250_000, path: [{ x: 26_190_000, y: 3_810_000 }, { x: 33_810_000, y: 3_810_000 }] },
    ];
    expect(codes(ops)).toEqual([]);
  });
});

describe('DRC-UNSUPPORTED-ROTATION', () => {
  it('warns on a non-quarter-turn rotation and skips those pads', () => {
    const ops = placedBoard().map((op) =>
      op.kind === 'place_footprint' && op.componentId === 'r1' ? { ...op, rotMilli: 45_000 } : op,
    );
    const found = runDrc(graphOf([...ops, routeMid]), parts, deck);
    const rotation = found.find((f) => f.code === 'DRC-UNSUPPORTED-ROTATION');
    expect(rotation).toBeDefined();
    expect(rotation?.severity).toBe('warn');
    expect(rotation?.anchors).toEqual([{ kind: 'component', componentId: 'r1' }]);
    // r1's pads vanished, so net nm has one pad left — no unrouted noise.
    expect(found.map((f) => f.code)).not.toContain('DRC-UNROUTED');
  });

  it('quarter turns transform pads exactly: a 90° resistor routes from its rotated pad', () => {
    const ops = placedBoard().map((op) =>
      op.kind === 'place_footprint' && op.componentId === 'r1' ? { ...op, rotMilli: 90_000 } : op,
    );
    // Pad 2 rotates from (0.95mm, 0) to (0, 0.95mm).
    const routed: OpBody = {
      kind: 'route_trace',
      id: 'tm',
      netId: 'nm',
      layerId: 'F.Cu',
      widthNm: 250_000,
      path: [{ x: 0, y: 950_000 }, { x: 9_050_000, y: 950_000 }, { x: 9_050_000, y: 0 }],
    };
    expect(codes([...ops, routed])).toEqual([]);
    // The unrotated route start no longer touches pad 2.
    expect(codes([...ops, routeMid])).toContain('DRC-UNROUTED');
  });
});

describe('findings contract', () => {
  it('orders findings deterministically with errors before warns', () => {
    const ops = placedBoard().map((op) =>
      op.kind === 'place_footprint' && op.componentId === 'r1' ? { ...op, rotMilli: 45_000 } : op,
    );
    const found = runDrc(graphOf([...ops, { ...routeMid, widthNm: 100_000 } as OpBody]), parts, deck);
    const sevs = found.map((f) => f.severity);
    expect(sevs.filter((s) => s === 'error').length).toBeGreaterThan(0);
    expect(sevs.filter((s) => s === 'warn').length).toBeGreaterThan(0);
    expect([...sevs].sort((a, b) => (a === b ? 0 : a === 'error' ? -1 : 1))).toEqual(sevs);
  });

  it('every DRC code maps to an existing concept article, and every drcCodes frontmatter entry is a real DRC code', () => {
    const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
    const conceptsRoot = resolve(repoRoot, 'content/concepts');
    const concepts = readdirSync(conceptsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) => loadConceptDir(resolve(conceptsRoot, entry.name)));
    const slugs = new Set(concepts.map((c) => c.frontmatter.slug));
    expect(conceptFor('DRC-UNROUTED')?.conceptSlug).toBe('series-vs-parallel');
    expect(conceptFor('DRC-NOPE')).toBeUndefined();
    for (const [code, info] of Object.entries(DRC_CODES)) {
      expect(code).toMatch(/^DRC-/);
      expect(slugs.has(info.conceptSlug), `${code} → ${info.conceptSlug}`).toBe(true);
    }
    // The reverse direction: articles may only claim DRC codes that exist.
    // (Lives here, not in @protopulse/content — content can't depend on drc.)
    for (const concept of concepts) {
      for (const code of concept.frontmatter.drcCodes ?? []) {
        expect(DRC_CODES[code], `${concept.frontmatter.slug} references ${code}`).toBeDefined();
      }
    }
  });
});

describe('runDrc — zones', () => {
  const SQUARE = (x0: number, y0: number, s: number) => [
    { x: x0, y: y0 },
    { x: x0 + s, y: y0 },
    { x: x0 + s, y: y0 + s },
    { x: x0, y: y0 + s },
  ];

  it('overlapping different-net zones on one layer is an error; same net or other layer is fine', () => {
    const base = [...placedBoard(), routeMid];
    const zoneA: OpBody = { kind: 'place_zone', id: 'za', netId: 'ng', layerId: 'F.Cu', outline: SQUARE(-2_000_000, -5_000_000, 6_000_000) };
    const overlapForeign: OpBody = { kind: 'place_zone', id: 'zb', netId: 'nv', layerId: 'F.Cu', outline: SQUARE(0, -3_000_000, 6_000_000) };
    const overlapOtherLayer: OpBody = { ...overlapForeign, id: 'zc', layerId: 'B.Cu' } as OpBody;
    const overlapSameNet: OpBody = { ...overlapForeign, id: 'zd', netId: 'ng' } as OpBody;

    // Park the zones away from pads so only the overlap rule speaks…
    expect(codes([...base, zoneA, overlapForeign])).toContain('DRC-ZONE-OVERLAP');
    expect(codes([...base, zoneA, overlapOtherLayer])).not.toContain('DRC-ZONE-OVERLAP');
    expect(codes([...base, zoneA, overlapSameNet])).not.toContain('DRC-ZONE-OVERLAP');
  });

  it('a zone with no same-net copper inside pours an island — warn; one with copper is quiet', () => {
    const base = [...placedBoard(), routeMid];
    // ng has no placed copper at all — a far-away ng zone is an island.
    const island: OpBody = { kind: 'place_zone', id: 'zi', netId: 'ng', layerId: 'F.Cu', outline: SQUARE(20_000_000, 20_000_000, 5_000_000) };
    expect(codes([...base, island])).toContain('DRC-ZONE-ISOLATED');
    // An nm zone covering the mid trace is connected — no island warning.
    const connected: OpBody = { kind: 'place_zone', id: 'zk', netId: 'nm', layerId: 'F.Cu', outline: SQUARE(2_000_000, -2_000_000, 4_000_000) };
    const found = codes([...base, connected]);
    expect(found).not.toContain('DRC-ZONE-ISOLATED');
  });
});
