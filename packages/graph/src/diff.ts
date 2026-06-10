import type { Component, DesignGraph, Net, PortRef, Uuid } from './types.js';

/**
 * Visual diff — Vol II §A.7. Materialize both heads, compare graphs
 * entity-wise. Net identity uses UUID first, with a connectivity-
 * fingerprint fallback so a delete+recreate of "the same" net diffs as
 * changed, not remove+add.
 */
export interface PropDelta {
  field: string;
  a: unknown;
  b: unknown;
}

export interface NetMembershipDelta {
  addedPorts: PortRef[];
  removedPorts: PortRef[];
}

export interface GraphDelta {
  components: {
    added: Uuid[];
    removed: Uuid[];
    changed: Map<Uuid, PropDelta[]>;
  };
  nets: {
    added: Uuid[];
    removed: Uuid[];
    membership: Map<Uuid, NetMembershipDelta>;
    renamed: Map<Uuid, [string, string]>;
    /** UUID pairs matched by fingerprint: [idInA, idInB]. */
    recreated: [Uuid, Uuid][];
  };
  constraints: { added: Uuid[]; removed: Uuid[]; changed: Uuid[] };
  schematicView: {
    placed: Uuid[];
    unplaced: Uuid[];
    moved: Uuid[];
    wiresChanged: Uuid[];
  };
}

export function isEmptyDelta(d: GraphDelta): boolean {
  return (
    d.components.added.length === 0 &&
    d.components.removed.length === 0 &&
    d.components.changed.size === 0 &&
    d.nets.added.length === 0 &&
    d.nets.removed.length === 0 &&
    d.nets.membership.size === 0 &&
    d.nets.renamed.size === 0 &&
    d.nets.recreated.length === 0 &&
    d.constraints.added.length === 0 &&
    d.constraints.removed.length === 0 &&
    d.constraints.changed.length === 0 &&
    d.schematicView.placed.length === 0 &&
    d.schematicView.unplaced.length === 0 &&
    d.schematicView.moved.length === 0 &&
    d.schematicView.wiresChanged.length === 0
  );
}

/** Hash of sorted member port keys — net identity across delete+recreate. */
export function netFingerprint(net: Net): string {
  return net.ports.join('|');
}

function componentDeltas(a: Component, b: Component): PropDelta[] {
  const out: PropDelta[] = [];
  if (a.ref !== b.ref) out.push({ field: 'ref', a: a.ref, b: b.ref });
  if ((a.value ?? null) !== (b.value ?? null)) out.push({ field: 'value', a: a.value, b: b.value });
  if (a.dnp !== b.dnp) out.push({ field: 'dnp', a: a.dnp, b: b.dnp });
  if (a.partId !== b.partId) out.push({ field: 'partId', a: a.partId, b: b.partId });
  if (a.partRev !== b.partRev) out.push({ field: 'partRev', a: a.partRev, b: b.partRev });
  if (JSON.stringify(a.fields) !== JSON.stringify(b.fields)) {
    out.push({ field: 'fields', a: a.fields, b: b.fields });
  }
  return out;
}

export function diff(a: DesignGraph, b: DesignGraph): GraphDelta {
  const delta: GraphDelta = {
    components: { added: [], removed: [], changed: new Map() },
    nets: { added: [], removed: [], membership: new Map(), renamed: new Map(), recreated: [] },
    constraints: { added: [], removed: [], changed: [] },
    schematicView: { placed: [], unplaced: [], moved: [], wiresChanged: [] },
  };

  // ── Components ──
  for (const [id, compB] of b.components) {
    const compA = a.components.get(id);
    if (!compA) {
      delta.components.added.push(id);
      continue;
    }
    const deltas = componentDeltas(compA, compB);
    if (deltas.length > 0) delta.components.changed.set(id, deltas);
  }
  for (const id of a.components.keys()) {
    if (!b.components.has(id)) delta.components.removed.push(id);
  }

  // ── Nets: UUID identity first ──
  const unmatchedA: Net[] = [];
  const unmatchedB: Net[] = [];
  for (const [id, netB] of b.nets) {
    const netA = a.nets.get(id);
    if (!netA) {
      unmatchedB.push(netB);
      continue;
    }
    compareNetPair(delta, netA, netB, id);
  }
  for (const [id, netA] of a.nets) {
    if (!b.nets.has(id)) unmatchedA.push(netA);
  }

  // Fingerprint fallback: pair removed and added nets with identical
  // connectivity so delete+recreate reads as "changed", not remove+add.
  const byFingerprint = new Map<string, Net>();
  for (const netA of unmatchedA) byFingerprint.set(netFingerprint(netA), netA);
  const consumedA = new Set<Uuid>();
  for (const netB of unmatchedB) {
    const match = byFingerprint.get(netFingerprint(netB));
    if (match && !consumedA.has(match.id)) {
      consumedA.add(match.id);
      delta.nets.recreated.push([match.id, netB.id]);
      compareNetPair(delta, match, netB, netB.id);
    } else {
      delta.nets.added.push(netB.id);
    }
  }
  for (const netA of unmatchedA) {
    if (!consumedA.has(netA.id)) delta.nets.removed.push(netA.id);
  }

  // ── Constraints ──
  for (const [id, cB] of b.constraints) {
    const cA = a.constraints.get(id);
    if (!cA) delta.constraints.added.push(id);
    else if (JSON.stringify(cA.body) !== JSON.stringify(cB.body)) delta.constraints.changed.push(id);
  }
  for (const id of a.constraints.keys()) {
    if (!b.constraints.has(id)) delta.constraints.removed.push(id);
  }

  // ── Schematic view ──
  for (const [id, pB] of b.schematic.placements) {
    const pA = a.schematic.placements.get(id);
    if (!pA) {
      delta.schematicView.placed.push(id);
    } else if (
      pA.at.x !== pB.at.x ||
      pA.at.y !== pB.at.y ||
      pA.rot !== pB.rot ||
      pA.mirror !== pB.mirror
    ) {
      delta.schematicView.moved.push(id);
    }
  }
  for (const id of a.schematic.placements.keys()) {
    if (!b.schematic.placements.has(id)) delta.schematicView.unplaced.push(id);
  }
  const wireNets = new Set([...a.schematic.wires.keys(), ...b.schematic.wires.keys()]);
  for (const netId of wireNets) {
    const wA = a.schematic.wires.get(netId) ?? [];
    const wB = b.schematic.wires.get(netId) ?? [];
    if (JSON.stringify(wA) !== JSON.stringify(wB)) delta.schematicView.wiresChanged.push(netId);
  }

  return delta;
}

function compareNetPair(delta: GraphDelta, netA: Net, netB: Net, id: Uuid): void {
  if (netA.name !== netB.name) delta.nets.renamed.set(id, [netA.name, netB.name]);
  const portsA = new Set(netA.ports);
  const portsB = new Set(netB.ports);
  const addedPorts = netB.ports.filter((p) => !portsA.has(p));
  const removedPorts = netA.ports.filter((p) => !portsB.has(p));
  if (addedPorts.length > 0 || removedPorts.length > 0) {
    delta.nets.membership.set(id, { addedPorts, removedPorts });
  }
}
