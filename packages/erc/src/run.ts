import { parsePortRef } from '@protopulse/graph';

import { compareFindings   } from './findings.js';
import { pinPairVerdict } from './matrix.js';

import type {Anchor, Finding} from './findings.js';
import type { DesignGraph, OpBody, PortRef, Uuid } from '@protopulse/graph';
import type { PartDb, PinElectricalType } from '@protopulse/parts';

/**
 * The ERC engine: each rule is a pure function (graph, parts) → findings.
 * Output order is deterministic (severity, code, anchors) so reports and
 * golden files are stable.
 */

interface TypedPort {
  port: PortRef;
  componentId: Uuid;
  pinKey: string;
  type: PinElectricalType;
}

interface ErcCtx {
  graph: DesignGraph;
  parts: PartDb;
  /** Resolved pin types per net (ports with unknown parts excluded). */
  netPorts: Map<Uuid, TypedPort[]>;
}

function netAnchor(netId: Uuid): Anchor {
  return { kind: 'net', netId };
}

function buildCtx(graph: DesignGraph, parts: PartDb): { ctx: ErcCtx; findings: Finding[] } {
  const findings: Finding[] = [];
  const netPorts = new Map<Uuid, TypedPort[]>();
  const unknownParts = new Set<Uuid>();

  for (const comp of graph.components.values()) {
    if (!parts.get(comp.partId, comp.partRev)) {
      unknownParts.add(comp.id);
      findings.push({
        severity: 'warn',
        code: 'ERC-UNKNOWN-PART',
        message: `${comp.ref}: part ${comp.partId} rev ${String(comp.partRev)} is not in the part registry`,
        anchors: [{ kind: 'component', componentId: comp.id }],
      });
    }
  }

  for (const net of graph.nets.values()) {
    const typed: TypedPort[] = [];
    for (const port of net.ports) {
      const { componentId, pinKey } = parsePortRef(port);
      const comp = graph.components.get(componentId);
      if (!comp || unknownParts.has(componentId)) continue;
      const type = parts.pinType(comp.partId, comp.partRev, pinKey);
      if (type === undefined) {
        findings.push({
          severity: 'warn',
          code: 'ERC-UNKNOWN-PIN',
          message: `${comp.ref}: pin ${pinKey} does not exist on part ${comp.partId}`,
          anchors: [{ kind: 'port', port }],
        });
        continue;
      }
      typed.push({ port, componentId, pinKey, type });
    }
    netPorts.set(net.id, typed);
  }

  return { ctx: { graph, parts, netPorts }, findings };
}

// ── Rules ────────────────────────────────────────────────────────────

function ruleMatrixConflicts(ctx: ErcCtx): Finding[] {
  const out: Finding[] = [];
  for (const [netId, ports] of ctx.netPorts) {
    const net = ctx.graph.nets.get(netId);
    if (!net) continue;
    for (let i = 0; i < ports.length; i++) {
      for (let j = i + 1; j < ports.length; j++) {
        const a = ports[i];
        const b = ports[j];
        if (!a || !b) continue;
        const verdict = pinPairVerdict(a.type, b.type);
        if (verdict.severity === 'ok') continue;
        out.push({
          severity: verdict.severity,
          code: verdict.code ?? 'ERC-MATRIX',
          message: `Net ${net.name}: ${refOf(ctx, a)} (${a.type}) meets ${refOf(ctx, b)} (${b.type}) — ${verdict.reason ?? 'pin conflict'}`,
          anchors: [netAnchor(netId), { kind: 'port', port: a.port }, { kind: 'port', port: b.port }],
        });
      }
    }
  }
  return out;
}

function refOf(ctx: ErcCtx, p: TypedPort): string {
  const comp = ctx.graph.components.get(p.componentId);
  return comp ? `${comp.ref}:${p.pinKey}` : p.port;
}

/** Floating inputs: an input (or supply) pin on no net is a latent bug. */
function ruleFloatingPins(ctx: ErcCtx): Finding[] {
  const out: Finding[] = [];
  const connected = new Set<PortRef>();
  for (const net of ctx.graph.nets.values()) {
    for (const port of net.ports) connected.add(port);
  }
  for (const comp of ctx.graph.components.values()) {
    const part = ctx.parts.get(comp.partId, comp.partRev);
    if (!part) continue;
    for (const pin of part.pins) {
      const port = `${comp.id}:${pin.key}`;
      if (connected.has(port)) continue;
      if (pin.electricalType === 'input') {
        out.push({
          severity: 'error',
          code: 'ERC-FLOATING-INPUT',
          message: `${comp.ref}:${pin.name} is a floating input — it will read noise, not a level`,
          anchors: [{ kind: 'port', port }],
        });
      } else if (pin.electricalType === 'power_in') {
        out.push({
          severity: 'error',
          code: 'ERC-POWER-UNSOURCED',
          message: `${comp.ref}:${pin.name} is an unconnected supply pin`,
          anchors: [{ kind: 'port', port }],
        });
      }
    }
  }
  return out;
}

/** A net with power_in pins needs a power_out source somewhere on it. */
function rulePowerUnsourced(ctx: ErcCtx): Finding[] {
  const out: Finding[] = [];
  for (const [netId, ports] of ctx.netPorts) {
    const net = ctx.graph.nets.get(netId);
    if (!net) continue;
    const sinks = ports.filter((p) => p.type === 'power_in');
    if (sinks.length === 0) continue;
    if (ports.some((p) => p.type === 'power_out')) continue;
    out.push({
      severity: 'error',
      code: 'ERC-POWER-UNSOURCED',
      message: `Net ${net.name} feeds ${String(sinks.length)} supply pin(s) but has no power source on it`,
      anchors: [netAnchor(netId), ...sinks.map((p): Anchor => ({ kind: 'port', port: p.port }))],
    });
  }
  return out;
}

function ruleSinglePortNets(ctx: ErcCtx): Finding[] {
  const out: Finding[] = [];
  for (const net of ctx.graph.nets.values()) {
    if (net.ports.length === 1) {
      out.push({
        severity: 'warn',
        code: 'ERC-SINGLE-PORT-NET',
        message: `Net ${net.name} connects only one pin — dangling wire or unfinished connection`,
        anchors: [netAnchor(net.id)],
      });
    }
  }
  return out;
}

/**
 * Open-collector nets need a pull-up to a power net — this catches an
 * entire genre of I2C bugs. The fix is executable: add a 10k resistor
 * from the net to a candidate supply rail.
 */
function rulePullupMissing(ctx: ErcCtx): Finding[] {
  const out: Finding[] = [];
  for (const [netId, ports] of ctx.netPorts) {
    const net = ctx.graph.nets.get(netId);
    if (!net) continue;
    if (!ports.some((p) => p.type === 'open_collector' || p.type === 'open_emitter')) continue;
    if (netHasPullupToPower(ctx, netId)) continue;
    const fix = buildPullupFix(ctx, netId);
    out.push({
      severity: 'warn',
      code: 'ERC-OC-NO-PULLUP',
      message: `Net ${net.name} has open-collector/emitter drivers but no pull-up to a supply — the bus will never rise`,
      anchors: [netAnchor(netId)],
      ...(fix ? { fix } : {}),
    });
  }
  return out;
}

function netHasPullupToPower(ctx: ErcCtx, netId: Uuid): boolean {
  for (const comp of ctx.graph.components.values()) {
    const part = ctx.parts.get(comp.partId, comp.partRev);
    if (part?.class !== 'resistor' || comp.dnp) continue;
    let onNet = false;
    let otherNetId: Uuid | undefined;
    for (const pin of part.pins) {
      const port = `${comp.id}:${pin.key}`;
      const home = findNetOf(ctx, port);
      if (home === netId) onNet = true;
      else if (home !== undefined) otherNetId = home;
    }
    if (onNet && otherNetId !== undefined && netIsSupplyRail(ctx, otherNetId)) return true;
  }
  return false;
}

/** A net that has a power source and is not ground-flavored. Ground-ness
 *  is read from the sourcing pin's NAME (nets are often auto-named). */
function netIsSupplyRail(ctx: ErcCtx, netId: Uuid): boolean {
  const net = ctx.graph.nets.get(netId);
  if (!net) return false;
  const sources = (ctx.netPorts.get(netId) ?? []).filter((p) => p.type === 'power_out');
  if (sources.length === 0) return false;
  const groundish = /gnd|ground|vss|0v/i;
  if (groundish.test(net.name)) return false;
  for (const src of sources) {
    const comp = ctx.graph.components.get(src.componentId);
    if (!comp) continue;
    const pinName = ctx.parts.get(comp.partId, comp.partRev)?.pins.find((p) => p.key === src.pinKey)?.name;
    if (pinName !== undefined && groundish.test(pinName)) return false;
  }
  return true;
}

function findNetOf(ctx: ErcCtx, port: PortRef): Uuid | undefined {
  for (const net of ctx.graph.nets.values()) {
    if (net.ports.includes(port)) return net.id;
  }
  return undefined;
}


function buildPullupFix(ctx: ErcCtx, netId: Uuid): OpBody[] | undefined {
  // Candidate rail: a powered net that isn't ground-flavored.
  let railId: Uuid | undefined;
  for (const net of ctx.graph.nets.values()) {
    if (!netIsSupplyRail(ctx, net.id)) continue;
    railId = net.id;
    break;
  }
  if (railId === undefined) return undefined;
  // Component IDs feed PortRefs (componentId:pinKey) — no colons allowed.
  const resistorId = `fix-pullup-${netId.replace(/:/g, '_')}`;
  const ref = nextFreeRef(ctx, 'R');
  return [
    {
      kind: 'batch',
      label: `Add pull-up on ${ctx.graph.nets.get(netId)?.name ?? netId}`,
      ops: [
        { kind: 'add_component', id: resistorId, ref, partId: 'core:resistor', partRev: 1, value: '10k' },
        { kind: 'connect', port: `${resistorId}:1`, netId },
        { kind: 'connect', port: `${resistorId}:2`, netId: railId },
      ],
    },
  ];
}

function nextFreeRef(ctx: ErcCtx, prefix: string): string {
  const used = new Set([...ctx.graph.components.values()].map((c) => c.ref));
  let n = 1;
  while (used.has(`${prefix}${String(n)}`)) n += 1;
  return `${prefix}${String(n)}`;
}

/** current_max constraints vs the sum of declared draws on the net. */
function ruleCurrentBudget(ctx: ErcCtx): Finding[] {
  const out: Finding[] = [];
  for (const constraint of ctx.graph.constraints.values()) {
    if (constraint.body.kind !== 'current_max') continue;
    const { netId, amps } = constraint.body;
    const net = ctx.graph.nets.get(netId);
    if (!net) continue;
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
    if (total > amps) {
      out.push({
        severity: 'error',
        code: 'ERC-CURRENT-BUDGET',
        message: `Net ${net.name}: declared draws total ${(total * 1000).toFixed(1)}mA, over the ${(amps * 1000).toFixed(1)}mA budget${constraint.rationale ? ` (${constraint.rationale})` : ''}`,
        anchors: [netAnchor(netId), ...draws.map((id): Anchor => ({ kind: 'component', componentId: id }))],
      });
    }
  }
  return out;
}

// ── Entry point ──────────────────────────────────────────────────────

const RULES: ((ctx: ErcCtx) => Finding[])[] = [
  ruleMatrixConflicts,
  ruleFloatingPins,
  rulePowerUnsourced,
  ruleSinglePortNets,
  rulePullupMissing,
  ruleCurrentBudget,
];

export function runErc(graph: DesignGraph, parts: PartDb): Finding[] {
  const { ctx, findings } = buildCtx(graph, parts);
  for (const rule of RULES) findings.push(...rule(ctx));
  return findings.sort(compareFindings);
}
