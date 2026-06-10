import { z } from 'zod';

import { opEnvelopeSchema  } from '../ops.js';

import type { BranchState } from '../branch.js';
import type {OpEnvelope} from '../ops.js';
import type { DesignGraph } from '../types.js';

/**
 * Serialization for the .ppx formats. JSON Lines for op segments because
 * greppable beats compact for a format meant to outlive the app.
 */

// ── Op segments (JSON Lines) ─────────────────────────────────────────

export function encodeOpl(ops: readonly OpEnvelope[]): string {
  return ops.map((op) => JSON.stringify(op)).join('\n') + (ops.length > 0 ? '\n' : '');
}

export function decodeOpl(text: string): OpEnvelope[] {
  const out: OpEnvelope[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    out.push(opEnvelopeSchema.parse(JSON.parse(trimmed)));
  }
  return out;
}

// ── Graph snapshots (Maps ↔ entry arrays) ────────────────────────────

export interface GraphSnapshotJson {
  components: unknown[];
  nets: unknown[];
  buses: unknown[];
  constraints: unknown[];
  schematic: { placements: unknown[]; wires: unknown[] };
  pcb: { placements: unknown[]; traces: unknown[]; vias: unknown[] };
  annotations: unknown[];
  meta: Record<string, string>;
  counters: { net: number };
}

export function graphToJson(graph: DesignGraph): GraphSnapshotJson {
  return {
    components: [...graph.components.entries()],
    nets: [...graph.nets.entries()],
    buses: [...graph.buses.entries()],
    constraints: [...graph.constraints.entries()],
    schematic: {
      placements: [...graph.schematic.placements.entries()],
      wires: [...graph.schematic.wires.entries()],
    },
    pcb: {
      placements: [...graph.pcb.placements.entries()],
      traces: [...graph.pcb.traces.entries()],
      vias: [...graph.pcb.vias.entries()],
    },
    annotations: graph.annotations,
    meta: graph.meta,
    counters: graph.counters,
  };
}

export function graphFromJson(json: GraphSnapshotJson): DesignGraph {
  return {
    components: new Map(json.components as [string, never][]),
    nets: new Map(json.nets as [string, never][]),
    buses: new Map(json.buses as [string, never][]),
    constraints: new Map(json.constraints as [string, never][]),
    schematic: {
      placements: new Map(json.schematic.placements as [string, never][]),
      wires: new Map(json.schematic.wires as [string, never][]),
    },
    pcb: {
      placements: new Map(json.pcb.placements as [string, never][]),
      traces: new Map(json.pcb.traces as [string, never][]),
      vias: new Map(json.pcb.vias as [string, never][]),
    },
    annotations: json.annotations as never[],
    meta: json.meta,
    counters: json.counters,
  };
}

// ── Design bundle (single-file .ppx.json for browser save/load) ──────

export const PPX_FORMAT_VERSION = 1;

const branchRefSchema = z.object({
  branch: z.string().nullable(),
  opCount: z.number().int().nonnegative(),
});

const branchStateSchema: z.ZodType<BranchState> = z.object({
  name: z.string().min(1),
  base: branchRefSchema,
  ops: z.array(opEnvelopeSchema),
});

export interface DesignBundle {
  format: 'ppx-bundle';
  version: number;
  designId: string;
  head: string;
  branches: BranchState[];
}

export const designBundleSchema: z.ZodType<DesignBundle> = z.object({
  format: z.literal('ppx-bundle'),
  version: z.number().int().positive(),
  designId: z.string().min(1),
  head: z.string().min(1),
  branches: z.array(branchStateSchema).min(1),
});

export function encodeBundle(bundle: DesignBundle): string {
  return JSON.stringify(bundle, null, 2);
}

export function decodeBundle(text: string): DesignBundle {
  return designBundleSchema.parse(JSON.parse(text));
}
