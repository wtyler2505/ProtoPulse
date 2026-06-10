import { parsePortRef } from '@protopulse/graph';

import { emitComponent, isGroundPart } from './models.js';

import type { FidelityEntry } from './models.js';
import type { Component, DesignGraph, Uuid } from '@protopulse/graph';
import type { Part, PartDb } from '@protopulse/parts';

/**
 * Design graph → SPICE netlist body (Vol II §D.1).
 *
 * The body carries the title, element lines, and `.model` cards — but
 * NOT the analysis card or `.end`; the engine wrapper appends those.
 * Output is deterministic: same graph, byte-identical netlist.
 */

export interface NetlistOpts {
  /** Title line (SPICE requires one; defaults to 'ProtoPulse design'). */
  title?: string;
}

export interface NetlistResult {
  /** Netlist body without analysis card and `.end`. */
  netlist: string;
  /** Per-component model fidelity, sorted by natural ref order. */
  manifest: FidelityEntry[];
  /** netId → SPICE node name. */
  nodeOf: Map<Uuid, string>;
}

/** Natural ref sort: R2 before R10, U1 before U10. */
export function compareRefs(a: string, b: string): number {
  const re = /^([A-Za-z$_]*)(\d*)$/;
  const ma = re.exec(a);
  const mb = re.exec(b);
  const prefixA = ma?.[1] ?? a;
  const prefixB = mb?.[1] ?? b;
  if (prefixA !== prefixB) return prefixA < prefixB ? -1 : 1;
  const numA = ma?.[2] ? Number(ma[2]) : Number.NaN;
  const numB = mb?.[2] ? Number(mb[2]) : Number.NaN;
  if (!Number.isNaN(numA) && !Number.isNaN(numB) && numA !== numB) return numA - numB;
  return a < b ? -1 : a > b ? 1 : 0;
}

const GROUND_NAME = /^(gnd|ground|vss|0)$/i;

function sanitizeToken(raw: string): string {
  const out = raw
    .toLowerCase()
    .replace(/\+/g, 'p')
    .replace(/[-−]/g, 'n')
    .replace(/[^a-z0-9_]/g, '_');
  return out.length > 0 ? out : '_';
}

/** Assign deterministic SPICE node names to every net. */
function assignNodeNames(
  graph: DesignGraph,
  parts: PartDb,
): Map<Uuid, string> {
  // Nets wired to a (non-DNP) ground pseudo-symbol are node 0.
  const groundNetIds = new Set<Uuid>();
  for (const net of graph.nets.values()) {
    for (const port of net.ports) {
      const { componentId } = parsePortRef(port);
      const comp = graph.components.get(componentId);
      if (!comp || comp.dnp) continue;
      const part = parts.get(comp.partId, comp.partRev);
      if (part && isGroundPart(part)) {
        groundNetIds.add(net.id);
        break;
      }
    }
  }

  const nodeOf = new Map<Uuid, string>();
  const used = new Set<string>();
  const ordered = [...graph.nets.values()].sort(
    (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : 1),
  );
  for (const net of ordered) {
    if (groundNetIds.has(net.id) || GROUND_NAME.test(net.name)) {
      nodeOf.set(net.id, '0');
      continue;
    }
    const base = sanitizeToken(net.name);
    let candidate = base === '0' ? 'n0' : base;
    let suffix = 2;
    while (used.has(candidate)) {
      candidate = `${base}_${String(suffix)}`;
      suffix += 1;
    }
    used.add(candidate);
    nodeOf.set(net.id, candidate);
  }
  return nodeOf;
}

function makeNodeLookup(
  graph: DesignGraph,
  nodeOf: Map<Uuid, string>,
  component: Component,
  part: Part,
): (pinKey: string) => string {
  // PortRef → netId index, scoped to this component's ports.
  const netOfPin = new Map<string, string>();
  for (const net of graph.nets.values()) {
    for (const port of net.ports) {
      const { componentId, pinKey } = parsePortRef(port);
      if (componentId === component.id) {
        netOfPin.set(pinKey, net.id);
      }
    }
  }
  return (pinKey: string): string => {
    if (!part.pins.some((p) => p.key === pinKey)) {
      throw new Error(`part ${part.id} has no pin "${pinKey}" (component ${component.ref})`);
    }
    const netId = netOfPin.get(pinKey);
    const node = netId !== undefined ? nodeOf.get(netId) : undefined;
    if (node !== undefined) return node;
    // Unconnected pin: park it on a unique dangling node.
    return `nc_${sanitizeToken(component.ref)}_${sanitizeToken(pinKey)}`;
  };
}

export function generateSpiceNetlist(
  graph: DesignGraph,
  parts: PartDb,
  opts: NetlistOpts = {},
): NetlistResult {
  const nodeOf = assignNodeNames(graph, parts);

  const components = [...graph.components.values()].sort((a, b) => compareRefs(a.ref, b.ref));

  const elementLines: string[] = [];
  const modelCards = new Set<string>();
  const manifest: FidelityEntry[] = [];

  for (const component of components) {
    if (component.dnp) {
      manifest.push({
        ref: component.ref,
        partId: component.partId,
        tier: 'stub',
        note: 'DNP — excluded from simulation',
      });
      continue;
    }
    const part = parts.get(component.partId, component.partRev);
    if (!part) {
      manifest.push({
        ref: component.ref,
        partId: component.partId,
        tier: 'stub',
        note: 'part not found in registry — excluded from simulation',
      });
      continue;
    }
    const emission = emitComponent({
      component,
      part,
      node: makeNodeLookup(graph, nodeOf, component, part),
    });
    elementLines.push(...emission.lines);
    for (const card of emission.models) modelCards.add(card);
    manifest.push({ ref: component.ref, partId: component.partId, ...emission.entry });
  }

  const lines = [
    `* ${opts.title ?? 'ProtoPulse design'}`,
    ...elementLines,
    ...[...modelCards].sort(),
  ];
  return { netlist: `${lines.join('\n')}\n`, manifest, nodeOf };
}
