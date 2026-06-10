import { runErc } from '@protopulse/erc';
import { parsePortRef } from '@protopulse/graph';

import { compareReviewFindings, DECK_REV } from './report.js';

import type { ReviewFinding, ReviewReport } from './report.js';
import type { Anchor } from '@protopulse/erc';
import type { DesignGraph, OpBody, PortRef, Uuid } from '@protopulse/graph';
import type { Part, PartDb, PinElectricalType } from '@protopulse/parts';

/**
 * The Design Review deck — Vol II §G.4. Each check is a pure function
 * (graph, parts) → findings; output order is deterministic (severity,
 * code, anchors, check) so reports diff cleanly across runs.
 */

interface TypedPort {
  port: PortRef;
  componentId: Uuid;
  pinKey: string;
  type: PinElectricalType;
}

interface ReviewCtx {
  graph: DesignGraph;
  parts: PartDb;
  /** Resolved pin types per net. Unknown parts/pins are silently skipped
   *  here — the embedded 'erc' check already reports them. */
  netPorts: Map<Uuid, TypedPort[]>;
}

function buildCtx(graph: DesignGraph, parts: PartDb): ReviewCtx {
  const netPorts = new Map<Uuid, TypedPort[]>();
  for (const net of graph.nets.values()) {
    const typed: TypedPort[] = [];
    for (const port of net.ports) {
      const { componentId, pinKey } = parsePortRef(port);
      const comp = graph.components.get(componentId);
      if (!comp) continue;
      const type = parts.pinType(comp.partId, comp.partRev, pinKey);
      if (type === undefined) continue;
      typed.push({ port, componentId, pinKey, type });
    }
    netPorts.set(net.id, typed);
  }
  return { graph, parts, netPorts };
}

// ── Shared reasoning (copied from erc's run.ts, which keeps it private) ──

const GROUNDISH = /gnd|ground|vss|0v/i;

/** Ground-flavor: net name, or any power_out source pin named like ground. */
function netIsGroundish(ctx: ReviewCtx, netId: Uuid): boolean {
  const net = ctx.graph.nets.get(netId);
  if (!net) return false;
  if (GROUNDISH.test(net.name)) return true;
  const sources = (ctx.netPorts.get(netId) ?? []).filter((p) => p.type === 'power_out');
  for (const src of sources) {
    const comp = ctx.graph.components.get(src.componentId);
    if (!comp) continue;
    const pinName = ctx.parts.get(comp.partId, comp.partRev)?.pins.find((p) => p.key === src.pinKey)?.name;
    if (pinName !== undefined && GROUNDISH.test(pinName)) return true;
  }
  return false;
}

/** A net that has a power source and is not ground-flavored (erc's rule). */
function netIsSupplyRail(ctx: ReviewCtx, netId: Uuid): boolean {
  const net = ctx.graph.nets.get(netId);
  if (!net) return false;
  const sources = (ctx.netPorts.get(netId) ?? []).filter((p) => p.type === 'power_out');
  if (sources.length === 0) return false;
  if (GROUNDISH.test(net.name)) return false;
  for (const src of sources) {
    const comp = ctx.graph.components.get(src.componentId);
    if (!comp) continue;
    const pinName = ctx.parts.get(comp.partId, comp.partRev)?.pins.find((p) => p.key === src.pinKey)?.name;
    if (pinName !== undefined && GROUNDISH.test(pinName)) return false;
  }
  return true;
}

function findNetOf(ctx: ReviewCtx, port: PortRef): Uuid | undefined {
  for (const net of ctx.graph.nets.values()) {
    if (net.ports.includes(port)) return net.id;
  }
  return undefined;
}

/** Distinct nets a component touches, in net iteration order. */
function netsOfComponent(ctx: ReviewCtx, componentId: Uuid): Uuid[] {
  const out: Uuid[] = [];
  for (const net of ctx.graph.nets.values()) {
    if (net.ports.some((p) => parsePortRef(p).componentId === componentId)) out.push(net.id);
  }
  return out;
}

function nextFreeRef(ctx: ReviewCtx, prefix: string): string {
  const used = new Set([...ctx.graph.components.values()].map((c) => c.ref));
  let n = 1;
  while (used.has(`${prefix}${String(n)}`)) n += 1;
  return `${prefix}${String(n)}`;
}

// ── Checks ───────────────────────────────────────────────────────────

/** Check 'erc': embed the full ERC run, codes unchanged. */
function checkErc(ctx: ReviewCtx): ReviewFinding[] {
  return runErc(ctx.graph, ctx.parts).map((f): ReviewFinding => ({ ...f, check: 'erc' }));
}

/**
 * Check 'decoupling': every IC should have at least one capacitor that
 * shares a net with it and whose other pin reaches a ground-flavored
 * net. The fix is executable: a 100nF cap from the IC's supply-pin net
 * to ground.
 */
function checkDecoupling(ctx: ReviewCtx): ReviewFinding[] {
  const out: ReviewFinding[] = [];
  for (const comp of ctx.graph.components.values()) {
    const part = ctx.parts.get(comp.partId, comp.partRev);
    if (part?.class !== 'ic' || comp.dnp) continue;
    const icNets = new Set(netsOfComponent(ctx, comp.id));
    if (hasDecouplingCap(ctx, icNets)) continue;
    const fix = buildDecouplingFix(ctx, comp.id, comp.ref, part);
    out.push({
      severity: 'warn',
      code: 'REV-DECOUPLING-MISSING',
      check: 'decoupling',
      message: `${comp.ref} has no decoupling capacitor — no cap bridges any of its nets to ground, so fast supply transients land on the chip`,
      anchors: [{ kind: 'component', componentId: comp.id }],
      ...(fix ? { fix } : {}),
    });
  }
  return out;
}

function hasDecouplingCap(ctx: ReviewCtx, icNets: Set<Uuid>): boolean {
  for (const cap of ctx.graph.components.values()) {
    const part = ctx.parts.get(cap.partId, cap.partRev);
    if (part?.class !== 'capacitor' || cap.dnp) continue;
    const homes = part.pins
      .map((pin) => findNetOf(ctx, `${cap.id}:${pin.key}`))
      .filter((n): n is Uuid => n !== undefined);
    // One pin on a net the IC touches, a *different* pin reaching ground.
    for (let i = 0; i < homes.length; i++) {
      for (let j = 0; j < homes.length; j++) {
        if (i === j) continue;
        const a = homes[i];
        const b = homes[j];
        if (a === undefined || b === undefined) continue;
        if (icNets.has(a) && netIsGroundish(ctx, b)) return true;
      }
    }
  }
  return false;
}

function buildDecouplingFix(ctx: ReviewCtx, componentId: Uuid, ref: string, part: Part): OpBody[] | undefined {
  // Supply net: the net under a power_in pin whose NAME isn't ground-flavored.
  let vccNetId: Uuid | undefined;
  let gndNetId: Uuid | undefined;
  for (const pin of part.pins) {
    if (pin.electricalType !== 'power_in') continue;
    const home = findNetOf(ctx, `${componentId}:${pin.key}`);
    if (home === undefined) continue;
    if (GROUNDISH.test(pin.name)) gndNetId ??= home;
    else vccNetId ??= home;
  }
  if (gndNetId === undefined) {
    for (const net of ctx.graph.nets.values()) {
      if (netIsGroundish(ctx, net.id)) {
        gndNetId = net.id;
        break;
      }
    }
  }
  if (vccNetId === undefined || gndNetId === undefined) return undefined;
  // Component IDs feed PortRefs (componentId:pinKey) — no colons allowed.
  const capId = `fix-decouple-${componentId.replace(/:/g, '_')}`;
  return [
    {
      kind: 'batch',
      label: `Add 100nF decoupling on ${ref}`,
      ops: [
        { kind: 'add_component', id: capId, ref: nextFreeRef(ctx, 'C'), partId: 'core:capacitor', partRev: 1, value: '100nF' },
        { kind: 'connect', port: `${capId}:1`, netId: vccNetId },
        { kind: 'connect', port: `${capId}:2`, netId: gndNetId },
      ],
    },
  ];
}

/**
 * Check 'power-tree': per supply rail, sum the declared currentDrawA of
 * its (non-DNP) components and report it as info.
 *
 * Double-reporting decision: REV-RAIL-OVERBUDGET is NOT emitted. erc's
 * ruleCurrentBudget fires ERC-CURRENT-BUDGET for every exceeded
 * current_max constraint — including ones targeting a rail — and the
 * 'erc' check embeds those findings in this report, so a review-side
 * rail error would always duplicate it. The summary alone is the
 * power-tree's contribution. (See codes.ts and the regression test.)
 */
function checkPowerTree(ctx: ReviewCtx): ReviewFinding[] {
  const out: ReviewFinding[] = [];
  for (const net of ctx.graph.nets.values()) {
    if (!netIsSupplyRail(ctx, net.id)) continue;
    let total = 0;
    const draws: Uuid[] = [];
    const seen = new Set<Uuid>();
    for (const port of net.ports) {
      const { componentId } = parsePortRef(port);
      if (seen.has(componentId)) continue;
      seen.add(componentId);
      const comp = ctx.graph.components.get(componentId);
      if (!comp || comp.dnp) continue;
      const draw = ctx.parts.get(comp.partId, comp.partRev)?.parametrics?.currentDrawA;
      if (draw !== undefined) {
        total += draw;
        draws.push(componentId);
      }
    }
    out.push({
      severity: 'info',
      code: 'REV-POWER-SUMMARY',
      check: 'power-tree',
      message: `${net.name}: ${formatMilliamps(total)} declared`,
      anchors: [{ kind: 'net', netId: net.id }, ...draws.map((id): Anchor => ({ kind: 'component', componentId: id }))],
    });
  }
  return out;
}

function formatMilliamps(amps: number): string {
  return `${String(Number((amps * 1000).toFixed(3)))}mA`;
}

/**
 * Check 'unverified-parts': unverified parts are fine as passives, but
 * in load-bearing roles (ICs, transistors, diodes, anything with power
 * pins) a wrong pinout costs a board spin.
 */
const LOAD_BEARING_CLASSES = new Set<Part['class']>(['ic', 'transistor', 'diode']);

function checkUnverifiedParts(ctx: ReviewCtx): ReviewFinding[] {
  const out: ReviewFinding[] = [];
  for (const comp of ctx.graph.components.values()) {
    const part = ctx.parts.get(comp.partId, comp.partRev);
    if (part?.provenance !== 'unverified') continue;
    const hasPowerPins = part.pins.some((p) => p.electricalType === 'power_in' || p.electricalType === 'power_out');
    if (!LOAD_BEARING_CLASSES.has(part.class) && !hasPowerPins) continue;
    const why = LOAD_BEARING_CLASSES.has(part.class) ? `class '${part.class}'` : 'it has power pins';
    out.push({
      severity: 'warn',
      code: 'REV-UNVERIFIED-PART',
      check: 'unverified-parts',
      message: `${comp.ref}: part ${comp.partId} is unverified but sits in a load-bearing role (${why}) — verify the pinout against a datasheet before fab`,
      anchors: [{ kind: 'component', componentId: comp.id }],
    });
  }
  return out;
}

/** Check 'single-pin-ics': an IC on fewer than two nets cannot be doing
 *  its job — at minimum supply and ground must be wired. */
function checkSinglePinIcs(ctx: ReviewCtx): ReviewFinding[] {
  const out: ReviewFinding[] = [];
  for (const comp of ctx.graph.components.values()) {
    const part = ctx.parts.get(comp.partId, comp.partRev);
    if (part?.class !== 'ic') continue;
    const nets = netsOfComponent(ctx, comp.id);
    if (nets.length >= 2) continue;
    out.push({
      severity: 'error',
      code: 'REV-IC-UNWIRED',
      check: 'single-pin-ics',
      message: `${comp.ref} is connected to ${String(nets.length)} net(s) — an IC needs at least supply and ground wiring`,
      anchors: [{ kind: 'component', componentId: comp.id }],
    });
  }
  return out;
}

/**
 * Check 'dnp-power': a net feeding power_in pins whose only power_out
 * source(s) are DNP components passes ERC (the source pin exists on the
 * net) but is dead on the assembled board.
 */
function checkDnpPower(ctx: ReviewCtx): ReviewFinding[] {
  const out: ReviewFinding[] = [];
  for (const [netId, ports] of ctx.netPorts) {
    const net = ctx.graph.nets.get(netId);
    if (!net) continue;
    if (!ports.some((p) => p.type === 'power_in')) continue;
    const sources = ports.filter((p) => p.type === 'power_out');
    if (sources.length === 0) continue; // ERC-POWER-UNSOURCED owns that case
    if (sources.some((p) => ctx.graph.components.get(p.componentId)?.dnp === false)) continue;
    const refs = [...new Set(sources.map((p) => ctx.graph.components.get(p.componentId)?.ref ?? p.componentId))];
    out.push({
      severity: 'error',
      code: 'REV-DNP-RAIL',
      check: 'dnp-power',
      message: `Net ${net.name} feeds supply pins but its only power source (${refs.join(', ')}) is marked DNP — the rail is dead on the assembled board`,
      anchors: [{ kind: 'net', netId }, ...sources.map((p): Anchor => ({ kind: 'port', port: p.port }))],
    });
  }
  return out;
}

// ── Entry point ──────────────────────────────────────────────────────

const CHECKS: ((ctx: ReviewCtx) => ReviewFinding[])[] = [
  checkErc,
  checkDecoupling,
  checkPowerTree,
  checkUnverifiedParts,
  checkSinglePinIcs,
  checkDnpPower,
];

export interface ReviewOptions {
  /** Injected so identical designs review byte-identically across days. */
  date: string;
  designId?: string;
  branch?: string;
}

export function runReview(graph: DesignGraph, parts: PartDb, opts: ReviewOptions): ReviewReport {
  const ctx = buildCtx(graph, parts);
  const findings: ReviewFinding[] = [];
  for (const check of CHECKS) findings.push(...check(ctx));
  findings.sort(compareReviewFindings);
  const counts = { error: 0, warn: 0, info: 0 };
  for (const f of findings) counts[f.severity] += 1;
  return {
    tool: 'protopulse-review',
    deckRev: DECK_REV,
    date: opts.date,
    ...(opts.designId !== undefined ? { designId: opts.designId } : {}),
    ...(opts.branch !== undefined ? { branch: opts.branch } : {}),
    counts,
    findings,
  };
}
