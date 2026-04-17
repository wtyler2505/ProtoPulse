/**
 * Generative Adopt — Compare, adopt, and export generative design candidates.
 *
 * Provides three workflows for moving candidates out of the generative engine:
 * 1. **Compare** — Diff a candidate against the current project architecture
 * 2. **Adopt** — Promote a candidate's IR into real architecture nodes/edges
 * 3. **Export** — Download a candidate as a standalone JSON file
 *
 * @module generative-design/generative-adopt
 */

import type { Node, Edge } from '@xyflow/react';
import type { CircuitIR, IRComponent, IRNet } from '@/lib/circuit-dsl/circuit-ir';
import type { CandidateEntry } from './generative-engine';
import type { FitnessResult } from './fitness-scorer';

// ---------------------------------------------------------------------------
// Comparison types
// ---------------------------------------------------------------------------

export interface ComponentDiff {
  status: 'added' | 'removed' | 'changed' | 'unchanged';
  refdes: string;
  partId: string;
  candidateValue?: string;
  currentValue?: string;
  details?: string;
}

export interface NetDiff {
  status: 'added' | 'removed' | 'unchanged';
  name: string;
  type: string;
}

export interface ComparisonResult {
  componentsAdded: number;
  componentsRemoved: number;
  componentsChanged: number;
  componentsUnchanged: number;
  netsAdded: number;
  netsRemoved: number;
  netsUnchanged: number;
  componentDiffs: ComponentDiff[];
  netDiffs: NetDiff[];
  candidateFitness: FitnessResult;
  summary: string;
}

// ---------------------------------------------------------------------------
// Adopt types
// ---------------------------------------------------------------------------

export interface ArchitectureNodeInput {
  nodeId: string;
  nodeType: string;
  label: string;
  positionX: number;
  positionY: number;
  data: Record<string, unknown>;
}

export interface ArchitectureEdgeInput {
  edgeId: string;
  source: string;
  target: string;
  label: string;
}

export interface AdoptResult {
  nodes: ArchitectureNodeInput[];
  edges: ArchitectureEdgeInput[];
  componentCount: number;
  netCount: number;
}

// ---------------------------------------------------------------------------
// Export types
// ---------------------------------------------------------------------------

export interface ExportPayload {
  format: 'protopulse-candidate';
  version: '1.0.0';
  exportedAt: string;
  candidate: {
    id: string;
    ir: CircuitIR;
    fitness: FitnessResult;
  };
}

// ---------------------------------------------------------------------------
// architectureToCurrentIR
// ---------------------------------------------------------------------------

/**
 * Derive a CircuitIR from the current project architecture (xyflow nodes + edges).
 *
 * Used by the generative design Compare/Adopt flow so that diffs are computed
 * against the REAL project state, not a hardcoded seed.
 *
 * Derivation strategy:
 * - Each node becomes an IRComponent.
 *   - refdes: preserved from previously adopted generative nodes (node.data.irRefdes)
 *     or falls back to the node's label / id.
 *   - partId: preserved from adopted nodes (node.data.irPartId) or derived from
 *     node.data.type (hand-built nodes).
 *   - value / footprint / pins: preserved if available from a previous adopt;
 *     otherwise pins are inferred from connected edges (edge.label as netName)
 *     with a synthetic `_unconnected` pin if the node has no edges (the IR
 *     comparison code tolerates any pin shape; validation is not invoked here).
 * - Each unique edge label contributes a net (type inferred from name heuristics).
 *
 * Accepts empty arrays and returns an IR with zero components — consumers of
 * `compareCandidateWithCurrent` already handle the empty case.
 */
export function architectureToCurrentIR(nodes: Node[], edges: Edge[]): CircuitIR {
  // Map node id -> list of net names connected to it (from edges).
  const nodeNets = new Map<string, string[]>();
  for (const e of edges) {
    const net = (e.label as string) || (((e.data as { netName?: string } | undefined)?.netName) ?? '');
    if (!net) continue;
    for (const endpoint of [e.source, e.target]) {
      const list = nodeNets.get(endpoint) ?? [];
      if (!list.includes(net)) list.push(net);
      nodeNets.set(endpoint, list);
    }
  }

  const components: IRComponent[] = nodes.map((n) => {
    const data = (n.data ?? {}) as {
      irRefdes?: string;
      irPartId?: string;
      label?: string;
      type?: string;
      value?: string;
      footprint?: string;
      pins?: Record<string, string>;
    };
    const refdes = data.irRefdes ?? data.label ?? n.id;
    const partId = data.irPartId ?? data.type ?? 'unknown';

    let pins: Record<string, string>;
    if (data.pins && Object.keys(data.pins).length > 0) {
      pins = data.pins;
    } else {
      const connected = nodeNets.get(n.id) ?? [];
      if (connected.length > 0) {
        pins = {};
        connected.forEach((netName, idx) => {
          pins[`pin${idx + 1}`] = netName;
        });
      } else {
        pins = { pin1: '_unconnected' };
      }
    }

    return {
      id: n.id,
      refdes,
      partId,
      value: data.value,
      footprint: data.footprint,
      pins,
    };
  });

  // Derive unique nets from edge labels.
  const seenNets = new Set<string>();
  const nets: IRNet[] = [];
  for (const e of edges) {
    const name = (e.label as string) || (((e.data as { netName?: string } | undefined)?.netName) ?? '');
    if (!name || seenNets.has(name)) continue;
    seenNets.add(name);
    const lower = name.toLowerCase();
    let type: IRNet['type'] = 'signal';
    if (lower === 'gnd' || lower === 'ground' || lower.includes('gnd')) {
      type = 'ground';
    } else if (lower === 'vcc' || lower === 'vdd' || lower.startsWith('v') || lower.includes('power') || lower.includes('pwr')) {
      type = 'power';
    }
    nets.push({ id: `net-${nets.length + 1}`, name, type });
  }

  return {
    meta: { name: 'Current Architecture', version: '1.0.0' },
    components,
    nets,
    wires: [],
  };
}

// ---------------------------------------------------------------------------
// compareCandidateWithCurrent
// ---------------------------------------------------------------------------

/**
 * Diff a generative candidate against the current circuit IR state.
 *
 * Matching is by refdes. Components with the same refdes are compared by
 * partId and value. Nets are matched by name.
 */
export function compareCandidateWithCurrent(
  candidate: CandidateEntry,
  currentIR: CircuitIR | null,
): ComparisonResult {
  const candidateComps = candidate.ir.components;
  const candidateNets = candidate.ir.nets;

  const currentComps: IRComponent[] = currentIR?.components ?? [];
  const currentNets: IRNet[] = currentIR?.nets ?? [];

  // --- Component diff by refdes ---
  const currentByRefdes = new Map<string, IRComponent>();
  for (const comp of currentComps) {
    currentByRefdes.set(comp.refdes, comp);
  }

  const candidateByRefdes = new Map<string, IRComponent>();
  for (const comp of candidateComps) {
    candidateByRefdes.set(comp.refdes, comp);
  }

  const componentDiffs: ComponentDiff[] = [];
  const seenRefdes = new Set<string>();

  // Walk candidate components
  for (const comp of candidateComps) {
    seenRefdes.add(comp.refdes);
    const current = currentByRefdes.get(comp.refdes);
    if (!current) {
      componentDiffs.push({
        status: 'added',
        refdes: comp.refdes,
        partId: comp.partId,
        candidateValue: comp.value,
      });
    } else if (current.partId !== comp.partId) {
      componentDiffs.push({
        status: 'changed',
        refdes: comp.refdes,
        partId: comp.partId,
        candidateValue: comp.value,
        currentValue: current.value,
        details: `Part changed: ${current.partId} -> ${comp.partId}`,
      });
    } else if (current.value !== comp.value) {
      componentDiffs.push({
        status: 'changed',
        refdes: comp.refdes,
        partId: comp.partId,
        candidateValue: comp.value,
        currentValue: current.value,
        details: `Value changed: ${current.value ?? 'none'} -> ${comp.value ?? 'none'}`,
      });
    } else {
      componentDiffs.push({
        status: 'unchanged',
        refdes: comp.refdes,
        partId: comp.partId,
        candidateValue: comp.value,
        currentValue: current.value,
      });
    }
  }

  // Components in current but not in candidate => removed
  for (const comp of currentComps) {
    if (!seenRefdes.has(comp.refdes)) {
      componentDiffs.push({
        status: 'removed',
        refdes: comp.refdes,
        partId: comp.partId,
        currentValue: comp.value,
      });
    }
  }

  // --- Net diff by name ---
  const currentNetNames = new Set(currentNets.map((n) => n.name));
  const candidateNetNames = new Set(candidateNets.map((n) => n.name));

  const netDiffs: NetDiff[] = [];

  for (const net of candidateNets) {
    if (!currentNetNames.has(net.name)) {
      netDiffs.push({ status: 'added', name: net.name, type: net.type });
    } else {
      netDiffs.push({ status: 'unchanged', name: net.name, type: net.type });
    }
  }

  for (const net of currentNets) {
    if (!candidateNetNames.has(net.name)) {
      netDiffs.push({ status: 'removed', name: net.name, type: net.type });
    }
  }

  // --- Aggregate counts ---
  const componentsAdded = componentDiffs.filter((d) => d.status === 'added').length;
  const componentsRemoved = componentDiffs.filter((d) => d.status === 'removed').length;
  const componentsChanged = componentDiffs.filter((d) => d.status === 'changed').length;
  const componentsUnchanged = componentDiffs.filter((d) => d.status === 'unchanged').length;
  const netsAdded = netDiffs.filter((d) => d.status === 'added').length;
  const netsRemoved = netDiffs.filter((d) => d.status === 'removed').length;
  const netsUnchanged = netDiffs.filter((d) => d.status === 'unchanged').length;

  // --- Summary ---
  const parts: string[] = [];
  if (componentsAdded > 0) { parts.push(`${componentsAdded} component${componentsAdded > 1 ? 's' : ''} added`); }
  if (componentsRemoved > 0) { parts.push(`${componentsRemoved} component${componentsRemoved > 1 ? 's' : ''} removed`); }
  if (componentsChanged > 0) { parts.push(`${componentsChanged} component${componentsChanged > 1 ? 's' : ''} changed`); }
  if (netsAdded > 0) { parts.push(`${netsAdded} net${netsAdded > 1 ? 's' : ''} added`); }
  if (netsRemoved > 0) { parts.push(`${netsRemoved} net${netsRemoved > 1 ? 's' : ''} removed`); }

  const summary = parts.length > 0 ? parts.join(', ') : 'No differences';

  return {
    componentsAdded,
    componentsRemoved,
    componentsChanged,
    componentsUnchanged,
    netsAdded,
    netsRemoved,
    netsUnchanged,
    componentDiffs,
    netDiffs,
    candidateFitness: candidate.fitness,
    summary,
  };
}

// ---------------------------------------------------------------------------
// adoptCandidate — convert CircuitIR to architecture nodes + edges
// ---------------------------------------------------------------------------

const GRID_SPACING = 200;
const COLUMNS = 4;

/**
 * Convert a candidate's CircuitIR into architecture node/edge inputs ready
 * to be submitted to the project via mutations.
 *
 * Layout: components are placed in a grid, with edges connecting components
 * that share nets.
 */
export function adoptCandidate(candidate: CandidateEntry): AdoptResult {
  const { ir } = candidate;
  const nodes: ArchitectureNodeInput[] = [];
  const edges: ArchitectureEdgeInput[] = [];

  // Place each component as an architecture node on a grid
  for (let i = 0; i < ir.components.length; i++) {
    const comp = ir.components[i];
    const col = i % COLUMNS;
    const row = Math.floor(i / COLUMNS);

    nodes.push({
      nodeId: `gen-${comp.id}`,
      nodeType: comp.partId,
      label: `${comp.refdes}${comp.value ? ` (${comp.value})` : ''}`,
      positionX: col * GRID_SPACING + GRID_SPACING,
      positionY: row * GRID_SPACING + GRID_SPACING,
      data: {
        generatedFrom: 'generative-design',
        candidateId: candidate.id,
        irPartId: comp.partId,
        value: comp.value,
        footprint: comp.footprint,
        pins: comp.pins,
      },
    });
  }

  // Build net->component membership map
  const netToComponents = new Map<string, string[]>();
  for (const comp of ir.components) {
    for (const netName of Object.values(comp.pins)) {
      const list = netToComponents.get(netName) ?? [];
      list.push(comp.id);
      netToComponents.set(netName, list);
    }
  }

  // Create edges between components sharing nets
  let edgeIndex = 0;
  for (const [netName, compIds] of Array.from(netToComponents.entries())) {
    // Connect in chain: comp[0]->comp[1], comp[1]->comp[2], etc.
    const uniqueIds = Array.from(new Set(compIds));
    for (let i = 0; i < uniqueIds.length - 1; i++) {
      edges.push({
        edgeId: `gen-edge-${edgeIndex++}`,
        source: `gen-${uniqueIds[i]}`,
        target: `gen-${uniqueIds[i + 1]}`,
        label: netName,
      });
    }
  }

  return {
    nodes,
    edges,
    componentCount: ir.components.length,
    netCount: ir.nets.length,
  };
}

// ---------------------------------------------------------------------------
// exportCandidate — create a JSON payload for download
// ---------------------------------------------------------------------------

/**
 * Build the export payload for a candidate. Returns a serializable object
 * suitable for JSON download.
 */
export function buildExportPayload(candidate: CandidateEntry): ExportPayload {
  return {
    format: 'protopulse-candidate',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    candidate: {
      id: candidate.id,
      ir: candidate.ir,
      fitness: candidate.fitness,
    },
  };
}

/**
 * Trigger a browser download of the candidate as a JSON file.
 */
export function exportCandidate(candidate: CandidateEntry): void {
  const payload = buildExportPayload(candidate);
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `candidate-${candidate.id}.json`;
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
