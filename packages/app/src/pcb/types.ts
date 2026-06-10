import type { OpBody, Uuid, Vec } from '@protopulse/graph';

/**
 * PINNED v0.4 PCB op contracts. @protopulse/graph's pcb apply support is
 * landing on a parallel track; these local types keep the app compiling
 * (and its tests meaningful) independent of that work. Once the graph
 * package ships the ops, these unions describe a subset of OpBody and
 * `asOpBodies` becomes a no-op identity.
 *
 * Until graph's apply() accepts them, session.dispatch validates against
 * a draft and REJECTS pcb ops — the canvas stays consistent and the
 * status bar tells the user nothing landed.
 */

export type PcbLayerId = 'F.Cu' | 'B.Cu';

/** PCB placement/routing snap grid: 0.25mm. (0.05mm felt sub-pixel at
 *  default zoom and 0.5mm fights 0.1in-pitch footprints' half-grid pads;
 *  0.25mm divides both 0.5mm and 1.27/2 ≈ 0.635mm-ish workflows well
 *  enough for v0.4.) */
export const PCB_SNAP_NM = 250_000;

/** Default trace width: 0.2mm (comfortably above the JLC 2-layer deck's
 *  0.127mm min_trace; the deck minimum is a floor, not a default). */
export const DEFAULT_TRACE_WIDTH_NM = 200_000;
export const DEFAULT_VIA_DRILL_NM = 300_000;
export const DEFAULT_VIA_PAD_NM = 600_000;
/** v0.4 boards are 2-layer; vias always span the full stack. */
export const VIA_SPAN: [PcbLayerId, PcbLayerId] = ['F.Cu', 'B.Cu'];

export type PcbOpBody =
  | {
      kind: 'place_footprint';
      componentId: Uuid;
      at: Vec;
      rotMilli: number;
      side: 'top' | 'bottom';
      locked: boolean;
    }
  | {
      kind: 'move_footprint';
      componentId: Uuid;
      at: Vec;
      rotMilli: number;
      side: 'top' | 'bottom';
      locked: boolean;
    }
  | { kind: 'unplace_footprint'; componentId: Uuid }
  | {
      kind: 'route_trace';
      id: Uuid;
      netId: Uuid;
      layerId: PcbLayerId;
      widthNm: number;
      path: Vec[];
    }
  | { kind: 'remove_trace'; id: Uuid }
  | {
      kind: 'place_via';
      id: Uuid;
      netId: Uuid;
      at: Vec;
      drillNm: number;
      padNm: number;
      span: [PcbLayerId, PcbLayerId];
    }
  | { kind: 'remove_via'; id: Uuid };

/** The single sanctioned cast from pinned pcb ops to the graph op union. */
export function asOpBodies(ops: PcbOpBody[]): OpBody[] {
  return ops as unknown as OpBody[];
}
