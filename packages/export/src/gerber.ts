import { computePour } from '@protopulse/route';

import { compareRefs } from './kicad-netlist.js';
import { applyPcbPlacement, formatMm, quarterTurnsOf } from './pcb-common.js';
import { textToStrokes } from './stroke-font.js';

import type { DesignGraph, Vec } from '@protopulse/graph';
import type { PartDb } from '@protopulse/parts';
import type { FootprintSource } from '@protopulse/route';

/**
 * Gerber X2 (RS-274X) copper-layer exporter. FSLAX46Y46 + MOMM means
 * coordinates carry 6 decimal places of a millimeter — i.e. the body
 * coordinate integers ARE nanometers, emitted directly with no float
 * arithmetic anywhere.
 *
 * Deterministic by construction: apertures sorted (circles before
 * rects, then by dimensions), objects sorted by (type, entity ref/id,
 * index). Pad flashing rules: SMD pads land on the placement side's
 * copper layer; through-hole pads and via pads flash on BOTH copper
 * layers. The date is injected (never `new Date()`).
 */

export type CopperLayer = 'F.Cu' | 'B.Cu';

export interface GerberOpts {
  /** ISO timestamp recorded in %TF.CreationDate. */
  date: string;
  /** Pour clearance for zone fills (the deck's min_clearance). REQUIRED
   *  when the design has zones on the layer — exporting a zone without
   *  knowing its clearance would freeze a guess into a fab file. */
  pourClearanceNm?: number;
}

type Aperture = { kind: 'C'; dNm: number } | { kind: 'R'; wNm: number; hNm: number };

function apertureKey(a: Aperture): string {
  return a.kind === 'C' ? `C:${String(a.dNm)}` : `R:${String(a.wNm)}x${String(a.hNm)}`;
}

function apertureTemplate(a: Aperture): string {
  return a.kind === 'C' ? `C,${formatMm(a.dNm)}` : `R,${formatMm(a.wNm)}X${formatMm(a.hNm)}`;
}

function compareApertures(a: Aperture, b: Aperture): number {
  if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1; // C before R
  if (a.kind === 'C' && b.kind === 'C') return a.dNm - b.dNm;
  if (a.kind === 'R' && b.kind === 'R') return a.wNm - b.wNm || a.hNm - b.hNm;
  return 0;
}

/** Sort key: (type, entity ref/id via natural order, index). */
interface GerberObject {
  type: 0 | 1 | 2; // 0 = pad flash, 1 = via flash, 2 = trace draw
  entity: string; // component ref / via id / trace id
  index: number; // pad index within the footprint; 0 otherwise
  aperture: Aperture;
  /** Flash position (types 0/1) or polyline (type 2). */
  at?: Vec;
  path?: Vec[];
}

function compareObjects(a: GerberObject, b: GerberObject): number {
  return a.type - b.type || compareRefs(a.entity, b.entity) || a.index - b.index;
}

function xy(p: Vec): string {
  return `X${String(Math.round(p.x))}Y${String(Math.round(p.y))}`;
}

export function exportGerberLayer(graph: DesignGraph, parts: PartDb, layer: CopperLayer, opts: GerberOpts): string {
  const objects: GerberObject[] = [];

  // Pads. Copper exists on the board whether or not the part is
  // populated, so DNP does not filter here (it filters pick-and-place).
  for (const [componentId, placement] of graph.pcb.placements) {
    const comp = graph.components.get(componentId);
    if (!comp) continue;
    const footprint = parts.get(comp.partId, comp.partRev)?.footprint;
    if (!footprint) continue;
    const sideLayer: CopperLayer = placement.side === 'bottom' ? 'B.Cu' : 'F.Cu';
    const swap = quarterTurnsOf(placement.rotMilli) % 2 === 1;
    footprint.pads.forEach((pad, index) => {
      const throughHole = pad.drillNm !== undefined;
      if (!throughHole && sideLayer !== layer) return; // SMD: one layer only
      const aperture: Aperture =
        pad.shape === 'circle'
          ? { kind: 'C', dNm: pad.wNm }
          : { kind: 'R', wNm: swap ? pad.hNm : pad.wNm, hNm: swap ? pad.wNm : pad.hNm };
      objects.push({
        type: 0,
        entity: comp.ref,
        index,
        aperture,
        at: applyPcbPlacement(pad.at, placement),
      });
    });
  }

  // Vias flash their pad on both copper layers.
  for (const via of graph.pcb.vias.values()) {
    objects.push({
      type: 1,
      entity: via.id,
      index: 0,
      aperture: { kind: 'C', dNm: via.padNm },
      at: via.at,
    });
  }

  // Traces draw on their own layer only.
  for (const trace of graph.pcb.traces.values()) {
    if (trace.layerId !== layer) continue;
    if (trace.path.length < 2) continue;
    objects.push({
      type: 2,
      entity: trace.id,
      index: 0,
      aperture: { kind: 'C', dNm: trace.widthNm },
      path: trace.path,
    });
  }

  objects.sort(compareObjects);

  // Aperture table: dedupe, sort, assign D-codes from D10.
  const unique = new Map<string, Aperture>();
  for (const obj of objects) unique.set(apertureKey(obj.aperture), obj.aperture);
  const apertures = [...unique.values()].sort(compareApertures);
  const dcodes = new Map<string, number>();
  apertures.forEach((a, i) => dcodes.set(apertureKey(a), 10 + i));

  const lines: string[] = [
    '%TF.GenerationSoftware,ProtoPulse,export,0.1.0*%',
    `%TF.CreationDate,${opts.date}*%`,
    layer === 'F.Cu' ? '%TF.FileFunction,Copper,L1,Top*%' : '%TF.FileFunction,Copper,L2,Bot*%',
    '%TF.FilePolarity,Positive*%',
    '%FSLAX46Y46*%',
    '%MOMM*%',
    'G01*',
    '%LPD*%',
  ];
  for (const a of apertures) {
    lines.push(`%ADD${String(dcodes.get(apertureKey(a)))}${apertureTemplate(a)}*%`);
  }

  // ── Zone pours as G36/G37 regions ──
  // Dark outers first, then their holes as LPC (clear) regions, then
  // polarity restored BEFORE pads/traces draw — so carved foreign
  // copper still lands dark on top of its own clearance hole.
  const zones = [...graph.pcb.zones.values()].filter((z) => z.layerId === layer).sort((a, b) => (a.id < b.id ? -1 : 1));
  if (zones.length > 0) {
    if (opts.pourClearanceNm === undefined) {
      throw new Error('gerber export: design has zones — pass pourClearanceNm (the deck min_clearance)');
    }
    const region = (ring: readonly Vec[]): void => {
      const [first, ...rest] = ring;
      if (!first) return;
      lines.push('G36*', `${xy(first)}D02*`);
      for (const p of rest) lines.push(`${xy(p)}D01*`);
      lines.push(`${xy(first)}D01*`, 'G37*');
    };
    const pours = zones.map((z) =>
      computePour(z, graph, parts as unknown as FootprintSource, opts.pourClearanceNm ?? 0),
    );
    for (const pour of pours) {
      for (const poly of pour.polygons) region(poly.outer);
    }
    const holes = pours.flatMap((pour) => pour.polygons.flatMap((poly) => poly.holes));
    if (holes.length > 0) {
      lines.push('%LPC*%');
      for (const hole of holes) region(hole);
      lines.push('%LPD*%');
    }
  }

  let current: number | undefined;
  for (const obj of objects) {
    const code = dcodes.get(apertureKey(obj.aperture));
    if (code === undefined) continue; // unreachable: every object registered its aperture
    if (code !== current) {
      lines.push(`D${String(code)}*`);
      current = code;
    }
    if (obj.path) {
      const [first, ...rest] = obj.path;
      if (!first) continue;
      lines.push(`${xy(first)}D02*`);
      for (const p of rest) lines.push(`${xy(p)}D01*`);
    } else if (obj.at) {
      lines.push(`${xy(obj.at)}D03*`);
    }
  }

  lines.push('M02*');
  return lines.join('\n') + '\n';
}

/**
 * Board outline (Edge.Cuts) as a Gerber profile layer: the closed
 * outline stroked with a thin 0.1mm aperture — the KiCad convention
 * fabs expect. Returns null when the design has no outline yet (an
 * honest absence, not an empty file).
 */
export function exportEdgeCuts(
  graph: DesignGraph,
  opts: { date: string },
  /** Extra straight scores (panel V-cuts) drawn after the outline. */
  vCuts: readonly { a: Vec; b: Vec }[] = [],
): string | null {
  const outline = graph.pcb.outline;
  if (!outline || outline.length < 3) return null;
  const lines: string[] = [
    '%TF.GenerationSoftware,ProtoPulse,export,0.1.0*%',
    `%TF.CreationDate,${opts.date}*%`,
    '%TF.FileFunction,Profile,NP*%',
    '%FSLAX46Y46*%',
    '%MOMM*%',
    'G01*',
    '%LPD*%',
    '%ADD10C,0.100000*%',
    'D10*',
  ];
  const [first, ...rest] = outline;
  if (!first) return null;
  lines.push(`${xy(first)}D02*`);
  for (const p of rest) lines.push(`${xy(p)}D01*`);
  lines.push(`${xy(first)}D01*`);
  for (const cut of vCuts) {
    lines.push(`${xy(cut.a)}D02*`, `${xy(cut.b)}D01*`);
  }
  lines.push('M02*');
  return lines.join('\n') + '\n';
}

// ─────────────────────────────────────────────────────────────────────────
// Soldermask / paste / silkscreen — the rest of a "board fab set". Ported
// from the legacy exporter (server/export/gerber/{soldermask,paste,
// silkscreen,stroke-font}.ts), adapted to integer-nanometer geometry and
// this file's shared aperture/object machinery.
// ─────────────────────────────────────────────────────────────────────────

export type MaskLayer = 'F.Mask' | 'B.Mask';
export type PasteLayer = 'F.Paste' | 'B.Paste';
export type SilkLayer = 'F.SilkS' | 'B.SilkS';

export interface MaskOpts {
  date: string;
  /** Soldermask clearance (radial, per side) added around every pad and
   *  via opening, in nm — REQUIRED, same reasoning as GerberOpts.
   *  pourClearanceNm: an undocumented guess would freeze into the fab
   *  file. 100_000 (0.1mm) matches the legacy exporter's fixed value and
   *  is a reasonable default to pass if the deck doesn't specify one. */
  clearanceNm: number;
}

function expandAperture(a: Aperture, clearanceNm: number): Aperture {
  return a.kind === 'C'
    ? { kind: 'C', dNm: a.dNm + clearanceNm * 2 }
    : { kind: 'R', wNm: a.wNm + clearanceNm * 2, hNm: a.hNm + clearanceNm * 2 };
}

function padAperture(pad: { wNm: number; hNm: number; shape: 'circle' | 'rect' }, swap: boolean): Aperture {
  return pad.shape === 'circle'
    ? { kind: 'C', dNm: pad.wNm }
    : { kind: 'R', wNm: swap ? pad.hNm : pad.wNm, hNm: swap ? pad.wNm : pad.hNm };
}

/** Shared header for the mask/paste/silk file kinds — same X2 preamble as
 *  the copper layer, parameterized by TF.FileFunction. */
function fabLayerHeader(fileFunction: string, date: string): string[] {
  return [
    '%TF.GenerationSoftware,ProtoPulse,export,0.1.0*%',
    `%TF.CreationDate,${date}*%`,
    `%TF.FileFunction,${fileFunction}*%`,
    '%FSLAX46Y46*%',
    '%MOMM*%',
    'G01*',
    '%LPD*%',
  ];
}

/**
 * Soldermask layer: one flash per pad opening (where mask is REMOVED,
 * exposing copper), expanded by `clearanceNm` beyond the pad's own size so
 * the mask doesn't creep onto the copper at fab tolerances. Through-hole
 * pads open on both mask layers, same as copper; SMD pads only on their
 * placement side. Every via also gets a mask opening — the engine has no
 * "tented via" concept yet, so this is the honest default (an untented
 * via) rather than a silent guess either way.
 */
export function exportSoldermaskLayer(graph: DesignGraph, parts: PartDb, layer: MaskLayer, opts: MaskOpts): string {
  const side = layer === 'F.Mask' ? 'top' : 'bottom';
  const objects: GerberObject[] = [];

  for (const [componentId, placement] of graph.pcb.placements) {
    const comp = graph.components.get(componentId);
    if (!comp) continue;
    const footprint = parts.get(comp.partId, comp.partRev)?.footprint;
    if (!footprint) continue;
    const sidePad = placement.side === 'bottom' ? 'bottom' : 'top';
    const swap = quarterTurnsOf(placement.rotMilli) % 2 === 1;
    footprint.pads.forEach((pad, index) => {
      const throughHole = pad.drillNm !== undefined;
      if (!throughHole && sidePad !== side) return;
      objects.push({
        type: 0,
        entity: comp.ref,
        index,
        aperture: expandAperture(padAperture(pad, swap), opts.clearanceNm),
        at: applyPcbPlacement(pad.at, placement),
      });
    });
  }

  for (const via of graph.pcb.vias.values()) {
    objects.push({
      type: 1,
      entity: via.id,
      index: 0,
      aperture: expandAperture({ kind: 'C', dNm: via.padNm }, opts.clearanceNm),
      at: via.at,
    });
  }

  objects.sort(compareObjects);
  return emitFlashOnlyLayer(objects, fabLayerHeader(`Soldermask,${side === 'top' ? 'Top' : 'Bot'}`, opts.date));
}

/**
 * Paste layer: SMD pads only (through-hole pads never get paste), exact
 * pad size (no clearance expansion — the stencil apertures ARE the pad
 * footprint), placement side only.
 */
export function exportPasteLayer(graph: DesignGraph, parts: PartDb, layer: PasteLayer, opts: { date: string }): string {
  const side = layer === 'F.Paste' ? 'top' : 'bottom';
  const objects: GerberObject[] = [];

  for (const [componentId, placement] of graph.pcb.placements) {
    const comp = graph.components.get(componentId);
    if (!comp) continue;
    const footprint = parts.get(comp.partId, comp.partRev)?.footprint;
    if (!footprint) continue;
    const sidePad = placement.side === 'bottom' ? 'bottom' : 'top';
    if (sidePad !== side) continue;
    const swap = quarterTurnsOf(placement.rotMilli) % 2 === 1;
    footprint.pads.forEach((pad, index) => {
      if (pad.drillNm !== undefined) return; // through-hole pads get no paste
      objects.push({
        type: 0,
        entity: comp.ref,
        index,
        aperture: padAperture(pad, swap),
        at: applyPcbPlacement(pad.at, placement),
      });
    });
  }

  objects.sort(compareObjects);
  return emitFlashOnlyLayer(objects, fabLayerHeader(`Paste,${side === 'top' ? 'Top' : 'Bot'}`, opts.date));
}

/** Shared aperture-table + flash emitter for mask/paste (no draws, no
 *  zones — just D03 flashes, same D-code-dedup discipline as copper). */
function emitFlashOnlyLayer(objects: GerberObject[], header: string[]): string {
  const unique = new Map<string, Aperture>();
  for (const obj of objects) unique.set(apertureKey(obj.aperture), obj.aperture);
  const apertures = [...unique.values()].sort(compareApertures);
  const dcodes = new Map<string, number>();
  apertures.forEach((a, i) => dcodes.set(apertureKey(a), 10 + i));

  const lines = [...header];
  for (const a of apertures) {
    lines.push(`%ADD${String(dcodes.get(apertureKey(a)))}${apertureTemplate(a)}*%`);
  }
  let current: number | undefined;
  for (const obj of objects) {
    const code = dcodes.get(apertureKey(obj.aperture));
    if (code === undefined || !obj.at) continue;
    if (code !== current) {
      lines.push(`D${String(code)}*`);
      current = code;
    }
    lines.push(`${xy(obj.at)}D03*`);
  }
  lines.push('M02*');
  return lines.join('\n') + '\n';
}

const SILK_APERTURE_NM = 100_000; // 0.1mm stroke width, matches legacy SILKSCREEN_APERTURE
const SILK_BODY_MARGIN_NM = 100_000; // 0.1mm, matches legacy SILKSCREEN_BODY_MARGIN
const SILK_CHAR_W_NM = 800_000;
const SILK_CHAR_H_NM = 1_000_000;
const SILK_CHAR_SPACING_NM = 200_000;

/**
 * Silkscreen layer: a component body outline (the courtyard rectangle,
 * expanded by a small margin), a pin-1 marker dash, and the reference
 * designator text. The outline and pin-1 marker are transformed through
 * the same side-mirror/rotate/translate placement math as copper/mask/
 * paste; the reference designator text is deliberately kept axis-aligned
 * (not rotated with the component) and placed above the transformed
 * outline's bounding box — matching common real-EDA convention of
 * keeping silkscreen text upright and readable regardless of part
 * rotation, and simpler/more correct than the legacy exporter's
 * world-space-naive text placement (which ignores rotation entirely
 * when picking the text's edge).
 */
export function exportSilkscreenLayer(
  graph: DesignGraph,
  parts: PartDb,
  layer: SilkLayer,
  opts: { date: string },
): string {
  const side = layer === 'F.SilkS' ? 'top' : 'bottom';
  const lines = fabLayerHeader(`Legend,${side === 'top' ? 'Top' : 'Bot'}`, opts.date);
  lines.push(`%ADD10C,${formatMm(SILK_APERTURE_NM)}*%`, 'D10*');

  const placements = [...graph.pcb.placements.entries()]
    .filter(([, p]) => (p.side === 'bottom' ? 'bottom' : 'top') === side)
    .sort(([a], [b]) => compareRefs(graph.components.get(a)?.ref ?? a, graph.components.get(b)?.ref ?? b));

  for (const [componentId, placement] of placements) {
    const comp = graph.components.get(componentId);
    if (!comp) continue;
    const footprint = parts.get(comp.partId, comp.partRev)?.footprint;
    if (!footprint) continue;

    const halfW = footprint.courtyard.wNm / 2 + SILK_BODY_MARGIN_NM;
    const halfH = footprint.courtyard.hNm / 2 + SILK_BODY_MARGIN_NM;
    const localCorners: Vec[] = [
      { x: -halfW, y: -halfH },
      { x: halfW, y: -halfH },
      { x: halfW, y: halfH },
      { x: -halfW, y: halfH },
    ];
    const corners = localCorners.map((c) => applyPcbPlacement(c, placement));

    const [c0, c1] = corners;
    if (!c0 || !c1) continue;
    lines.push(`${xy(c0)}D02*`);
    for (const c of corners.slice(1)) lines.push(`${xy(c)}D01*`);
    lines.push(`${xy(c0)}D01*`);

    // Pin-1 marker: a short dash from corner 0 toward the midpoint of edge 0-1.
    const midX = (c0.x + c1.x) / 2;
    const midY = (c0.y + c1.y) / 2;
    const markerX = (c0.x + midX) / 2;
    const markerY = (c0.y + midY) / 2;
    lines.push(`${xy(c0)}D02*`, `${xy({ x: markerX, y: markerY })}D01*`);

    // Reference designator text, axis-aligned, above the AABB of the
    // transformed outline (see docblock: deliberately not rotated).
    const minY = Math.min(...corners.map((c) => c.y));
    const centerX = corners.reduce((sum, c) => sum + c.x, 0) / corners.length;
    const textWidthNm = comp.ref.length * (SILK_CHAR_W_NM + SILK_CHAR_SPACING_NM);
    const origin: Vec = {
      x: centerX - textWidthNm / 2,
      y: minY - SILK_BODY_MARGIN_NM - SILK_CHAR_H_NM,
    };
    for (const stroke of textToStrokes(comp.ref, origin, SILK_CHAR_W_NM, SILK_CHAR_H_NM, SILK_CHAR_SPACING_NM)) {
      lines.push(`${xy(stroke.a)}D02*`, `${xy(stroke.b)}D01*`);
    }
  }

  lines.push('M02*');
  return lines.join('\n') + '\n';
}
