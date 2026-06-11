import type { DesignGraph, OpBody } from '@protopulse/graph';

/**
 * PINNED contracts between the Router agent and the host's routing
 * stack (@protopulse/route + the app's pcb layer). Mirrors sim-types:
 * the ai package never imports the engines — the host injects them, so
 * tests fake them and the browser bundle stays in control of what
 * loads when.
 */

export interface PinnedUnroutedPair {
  netId: string;
  netName: string;
  /** Pad endpoints, world nm, with human labels ("R1:2"). */
  a: { x: number; y: number; label: string };
  b: { x: number; y: number; label: string };
}

export type PinnedRouteMode = 'walk' | 'shove';

export interface PinnedRouteRequest {
  netId: string;
  mode: PinnedRouteMode;
  layerId: string;
  /** Trace width in nm; the host applies its default when omitted. */
  widthNm?: number;
}

export type PinnedRouteOutcome =
  | { ok: true; ops: OpBody[]; summary: string }
  | { ok: false; reason: string };

/** Route ONE unrouted connection of the net on the given graph state. */
export type PinnedRouteFn = (graph: DesignGraph, req: PinnedRouteRequest) => PinnedRouteOutcome;

/** All currently unrouted connections (the ratsnest), for the graph. */
export type PinnedRatsnestFn = (graph: DesignGraph) => PinnedUnroutedPair[];

export interface PinnedDrcDigestFinding {
  severity: 'error' | 'warn' | 'info';
  code: string;
  message: string;
}

/** Run DRC against the graph; async because the host lazy-loads it. */
export type PinnedDrcFn = (graph: DesignGraph) => Promise<PinnedDrcDigestFinding[]>;

export interface RouterHooks {
  ratsnest: PinnedRatsnestFn;
  route: PinnedRouteFn;
  drc: PinnedDrcFn;
}
