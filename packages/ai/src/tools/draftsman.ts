import { z } from 'zod';
import {
  MM,
  SCHEMATIC_GRID,
  applyOp,
  cloneGraph,
  makePortRef,
  netOfPort,
  newUuid,
  type Component,
  type DesignGraph,
  type Net,
  type Nm,
  type OpBody,
  type PortRef,
  type Rot,
  type WireSegment,
} from '@protopulse/graph';
import { runErc, type Finding } from '@protopulse/erc';
import type { AiTool, ToolCtx, ToolResult } from '../registry.js';
import { ToolRegistry } from '../registry.js';

/**
 * The Draftsman's 8 tools — Vol III §6 Milestone 1. Inputs speak the
 * model's language (refs like "R1:1", millimeters); outputs are exact
 * graph ops in integer nanometers. Execution is pure: ops are PROPOSED,
 * the host applies them.
 */

// ── Shared helpers ───────────────────────────────────────────────────

/** Snap a millimeter coordinate onto the 1.27mm schematic grid, in nm. */
export function snapMmToGrid(mm: number): Nm {
  return Math.round((mm * MM) / SCHEMATIC_GRID) * SCHEMATIC_GRID;
}

function nmToMm(nm: Nm): number {
  return nm / MM;
}

function componentByRef(graph: DesignGraph, ref: string): Component {
  for (const comp of graph.components.values()) {
    if (comp.ref === ref) return comp;
  }
  throw new Error(`no component with ref ${ref} in the design`);
}

/** "R1:1" → canonical PortRef (componentId:pinKey), pin validated. */
function resolvePort(ctx: ToolCtx, refPort: string): PortRef {
  const idx = refPort.indexOf(':');
  if (idx <= 0 || idx === refPort.length - 1) {
    throw new Error(`malformed port "${refPort}" — expected REF:pinKey, e.g. "R1:1"`);
  }
  const ref = refPort.slice(0, idx);
  const pinKey = refPort.slice(idx + 1);
  const comp = componentByRef(ctx.graph, ref);
  if (!ctx.parts.pinExists(comp.partId, comp.partRev, pinKey)) {
    throw new Error(`pin ${pinKey} does not exist on ${ref} (part ${comp.partId})`);
  }
  return makePortRef(comp.id, pinKey);
}

/** Resolve a net by current name or id. */
function resolveNet(graph: DesignGraph, nameOrId: string): Net {
  const byId = graph.nets.get(nameOrId);
  if (byId) return byId;
  for (const net of graph.nets.values()) {
    if (net.name === nameOrId) return net;
  }
  throw new Error(`no net named or with id "${nameOrId}" in the design`);
}

function nextFreeRef(graph: DesignGraph, prefix: string): string {
  const used = new Set([...graph.components.values()].map((c) => c.ref));
  let n = 1;
  while (used.has(`${prefix}${String(n)}`)) n += 1;
  return `${prefix}${String(n)}`;
}

/** Next free cell on a simple cursor grid: 10mm pitch, 8 columns per row. */
function nextFreePlacement(graph: DesignGraph): { x: Nm; y: Nm } {
  const occupied = new Set(
    [...graph.schematic.placements.values()].map((p) => `${String(p.at.x)},${String(p.at.y)}`),
  );
  for (let i = 0; ; i++) {
    const x = snapMmToGrid((i % 8) * 10);
    const y = snapMmToGrid(Math.floor(i / 8) * 10);
    if (!occupied.has(`${String(x)},${String(y)}`)) return { x, y };
  }
}

const zMmPoint = z.object({ x_mm: z.number(), y_mm: z.number() });
const zRotInput = z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]);

// ── add_component ────────────────────────────────────────────────────

const addComponentSchema = z.object({
  part_id: z.string().min(1).describe('Library part id, e.g. "core:resistor"'),
  value: z.string().optional().describe('Component value, e.g. "10k" or "100nF"'),
  ref: z.string().min(1).optional().describe('Reference designator; auto-assigned if omitted'),
  at: zMmPoint.optional().describe('Placement in mm; auto-placed if omitted'),
});

const addComponent: AiTool<typeof addComponentSchema> = {
  name: 'add_component',
  description:
    'Add a component from the part library to the design and place its symbol on the schematic. ' +
    'Resolves the latest part revision; auto-assigns the next free reference designator if ref is omitted; ' +
    'auto-places on a 10mm cursor grid if at is omitted. Coordinates are millimeters, snapped to the 1.27mm grid.',
  schema: addComponentSchema,
  destructive: true,
  costClass: 'standard',
  execute(input, ctx): ToolResult {
    const part = ctx.parts.latest(input.part_id);
    if (!part) {
      throw new Error(
        `unknown part id "${input.part_id}" — use one of the part ids listed in the system prompt`,
      );
    }
    const ref = input.ref ?? nextFreeRef(ctx.graph, part.refPrefix);
    for (const comp of ctx.graph.components.values()) {
      if (comp.ref === ref) throw new Error(`ref designator ${ref} is already in use`);
    }
    const componentId = newUuid();
    const at = input.at
      ? { x: snapMmToGrid(input.at.x_mm), y: snapMmToGrid(input.at.y_mm) }
      : nextFreePlacement(ctx.graph);
    const batch: OpBody = {
      kind: 'batch',
      label: `Add ${ref} (${part.id}${input.value ? ` ${input.value}` : ''})`,
      ops: [
        {
          kind: 'add_component',
          id: componentId,
          ref,
          partId: part.id,
          partRev: part.rev,
          ...(input.value !== undefined ? { value: input.value } : {}),
        },
        { kind: 'place_symbol', componentId, at, rot: 0, mirror: false },
      ],
    };
    return {
      ops: [batch],
      data: { component_id: componentId, ref },
      summary: `Added ${ref} (${part.name}${input.value ? ` ${input.value}` : ''}) at (${String(nmToMm(at.x))}, ${String(nmToMm(at.y))})mm`,
    };
  },
  explain(input): string {
    const value = input.value ? ` "${input.value}"` : '';
    const ref = input.ref ? ` as ${input.ref}` : '';
    const at = input.at ? ` at (${String(input.at.x_mm)}, ${String(input.at.y_mm)})mm` : '';
    return `Place a ${input.part_id}${value}${ref}${at}`;
  },
};

// ── connect ──────────────────────────────────────────────────────────

const connectSchema = z.object({
  from_port: z.string().min(3).describe('Port as REF:pinKey, e.g. "R1:1"'),
  to_port: z.string().min(3).describe('Port as REF:pinKey, e.g. "U1:8"'),
});

const connect: AiTool<typeof connectSchema> = {
  name: 'connect',
  description:
    'Electrically connect two pins. Ports are "REF:pinKey" (e.g. "R1:1", "U1:8"). ' +
    'Creates a net, joins an existing net, or merges two nets as needed.',
  schema: connectSchema,
  destructive: true,
  costClass: 'standard',
  execute(input, ctx): ToolResult {
    const a = resolvePort(ctx, input.from_port);
    const b = resolvePort(ctx, input.to_port);
    if (a === b) throw new Error(`cannot connect ${input.from_port} to itself`);
    const netA = netOfPort(ctx.graph, a);
    const netB = netOfPort(ctx.graph, b);

    if (!netA && !netB) {
      const newNetId = newUuid();
      // applyOp auto-names the net N$<counter+1> deterministically.
      const predictedName = `N$${String(ctx.graph.counters.net + 1)}`;
      return {
        ops: [
          { kind: 'connect', port: a, newNetId },
          { kind: 'connect', port: b, netId: newNetId },
        ],
        data: { net_id: newNetId, net_name: predictedName },
        summary: `Connected ${input.from_port} and ${input.to_port} on new net ${predictedName}`,
      };
    }
    if (netA && netB && netA.id === netB.id) {
      return {
        ops: [],
        data: { net_id: netA.id, net_name: netA.name },
        summary: `${input.from_port} and ${input.to_port} are already on net ${netA.name} — nothing to do`,
      };
    }
    if (netA && netB) {
      return {
        ops: [{ kind: 'merge_nets', survivor: netA.id, absorbed: netB.id }],
        data: { net_id: netA.id, net_name: netA.name },
        summary: `Merged net ${netB.name} into ${netA.name} (${input.from_port} ↔ ${input.to_port})`,
      };
    }
    const net = (netA ?? netB) as Net;
    const loose = netA ? b : a;
    const loosePortLabel = netA ? input.to_port : input.from_port;
    return {
      ops: [{ kind: 'connect', port: loose, netId: net.id }],
      data: { net_id: net.id, net_name: net.name },
      summary: `Connected ${loosePortLabel} to net ${net.name}`,
    };
  },
  explain(input): string {
    return `Connect ${input.from_port} to ${input.to_port}`;
  },
};

// ── place_symbol ─────────────────────────────────────────────────────

const placeSymbolSchema = z.object({
  ref: z.string().min(1).describe('Reference designator of the component to place/move'),
  at: zMmPoint.describe('Target position in mm'),
  rot: zRotInput.optional().describe('Rotation in degrees (0/90/180/270), default 0'),
  mirror: z.boolean().optional().describe('Mirror the symbol, default false'),
});

const placeSymbol: AiTool<typeof placeSymbolSchema> = {
  name: 'place_symbol',
  description:
    'Place or move a component symbol on the schematic. Coordinates are millimeters, snapped to the 1.27mm grid.',
  schema: placeSymbolSchema,
  destructive: true,
  costClass: 'cheap',
  execute(input, ctx): ToolResult {
    const comp = componentByRef(ctx.graph, input.ref);
    const at = { x: snapMmToGrid(input.at.x_mm), y: snapMmToGrid(input.at.y_mm) };
    const rot: Rot = input.rot ?? 0;
    const mirror = input.mirror ?? false;
    const placed = ctx.graph.schematic.placements.has(comp.id);
    return {
      ops: [
        placed
          ? { kind: 'move_symbol', componentId: comp.id, at, rot, mirror }
          : { kind: 'place_symbol', componentId: comp.id, at, rot, mirror },
      ],
      data: { component_id: comp.id, ref: comp.ref },
      summary: `${placed ? 'Moved' : 'Placed'} ${comp.ref} to (${String(nmToMm(at.x))}, ${String(nmToMm(at.y))})mm rot ${String(rot)}`,
    };
  },
  explain(input): string {
    return `Place ${input.ref} at (${String(input.at.x_mm)}, ${String(input.at.y_mm)})mm${input.rot ? ` rotated ${String(input.rot)}°` : ''}`;
  },
};

// ── set_wire_geometry ────────────────────────────────────────────────

const setWireGeometrySchema = z.object({
  net: z.string().min(1).describe('Net name or id'),
  segments: z
    .array(
      z.object({
        ax_mm: z.number(),
        ay_mm: z.number(),
        bx_mm: z.number(),
        by_mm: z.number(),
      }),
    )
    .min(1)
    .describe('Wire segments to APPEND, in mm'),
});

const setWireGeometry: AiTool<typeof setWireGeometrySchema> = {
  name: 'set_wire_geometry',
  description:
    'Append wire segments to a net on the schematic. Pure geometry — connectivity is unchanged. ' +
    'Coordinates are millimeters, snapped to the 1.27mm grid. Segments are appended to existing geometry.',
  schema: setWireGeometrySchema,
  destructive: true,
  costClass: 'cheap',
  execute(input, ctx): ToolResult {
    const net = resolveNet(ctx.graph, input.net);
    const existing: WireSegment[] = ctx.graph.schematic.wires.get(net.id) ?? [];
    const appended: WireSegment[] = input.segments.map((s) => ({
      a: { x: snapMmToGrid(s.ax_mm), y: snapMmToGrid(s.ay_mm) },
      b: { x: snapMmToGrid(s.bx_mm), y: snapMmToGrid(s.by_mm) },
    }));
    return {
      ops: [
        {
          kind: 'set_wire_geometry',
          netId: net.id,
          segments: [...existing.map((s) => ({ a: { ...s.a }, b: { ...s.b } })), ...appended],
        },
      ],
      data: { net_id: net.id, net_name: net.name, segment_count: existing.length + appended.length },
      summary: `Appended ${String(appended.length)} wire segment(s) to net ${net.name}`,
    };
  },
  explain(input): string {
    return `Draw ${String(input.segments.length)} wire segment(s) on net ${input.net}`;
  },
};

// ── rename_net ───────────────────────────────────────────────────────

const renameNetSchema = z.object({
  net: z.string().min(1).describe('Current net name or id'),
  new_name: z.string().min(1).describe('New net name, e.g. "VCC"'),
});

const renameNet: AiTool<typeof renameNetSchema> = {
  name: 'rename_net',
  description: 'Rename a net (by current name or id) to a meaningful name like "VCC" or "GND".',
  schema: renameNetSchema,
  destructive: true,
  costClass: 'cheap',
  execute(input, ctx): ToolResult {
    const net = resolveNet(ctx.graph, input.net);
    return {
      ops: [{ kind: 'rename_net', netId: net.id, name: input.new_name }],
      data: { net_id: net.id, net_name: input.new_name },
      summary: `Renamed net ${net.name} to ${input.new_name}`,
    };
  },
  explain(input): string {
    return `Rename net ${input.net} to ${input.new_name}`;
  },
};

// ── add_constraint ───────────────────────────────────────────────────

const addConstraintSchema = z.object({
  kind: z.literal('current_max').describe('M1 supports only current_max'),
  net: z.string().min(1).describe('Net name or id the budget applies to'),
  amps: z.number().positive().describe('Maximum current in amps'),
  rationale: z.string().optional().describe('Why this budget exists'),
});

const addConstraint: AiTool<typeof addConstraintSchema> = {
  name: 'add_constraint',
  description:
    'Add a current_max constraint to a net. ERC checks declared component draws against the budget.',
  schema: addConstraintSchema,
  destructive: true,
  costClass: 'cheap',
  execute(input, ctx): ToolResult {
    const net = resolveNet(ctx.graph, input.net);
    const id = newUuid();
    return {
      ops: [
        {
          kind: 'add_constraint',
          id,
          body: { kind: 'current_max', netId: net.id, amps: input.amps },
          ...(input.rationale !== undefined ? { rationale: input.rationale } : {}),
        },
      ],
      data: { constraint_id: id, net_id: net.id, net_name: net.name },
      summary: `Constrained net ${net.name} to ${String(input.amps * 1000)}mA max`,
    };
  },
  explain(input): string {
    return `Limit net ${input.net} to ${String(input.amps * 1000)}mA${input.rationale ? ` (${input.rationale})` : ''}`;
  },
};

// ── run_erc ──────────────────────────────────────────────────────────

const runErcSchema = z.object({});

function summarizeFindings(findings: Finding[]): string {
  const errors = findings.filter((f) => f.severity === 'error').length;
  const warns = findings.filter((f) => f.severity === 'warn').length;
  const infos = findings.filter((f) => f.severity === 'info').length;
  if (findings.length === 0) return 'ERC clean: 0 errors, 0 warnings';
  const parts = [`${String(errors)} error${errors === 1 ? '' : 's'}`, `${String(warns)} warning${warns === 1 ? '' : 's'}`];
  if (infos > 0) parts.push(`${String(infos)} info`);
  return parts.join(', ');
}

const runErcTool: AiTool<typeof runErcSchema> = {
  name: 'run_erc',
  description:
    'Run the electrical rules check on the current design. Returns findings with severity, code, message, and anchors. Always run this after mutating the design.',
  schema: runErcSchema,
  destructive: false,
  costClass: 'cheap',
  execute(_input, ctx): ToolResult {
    const findings = runErc(ctx.graph, ctx.parts);
    return {
      ops: [],
      data: findings.map((f) => ({
        severity: f.severity,
        code: f.code,
        message: f.message,
        anchors: f.anchors,
      })),
      summary: summarizeFindings(findings),
    };
  },
  explain(): string {
    return 'Run the electrical rules check';
  },
};

// ── batch ────────────────────────────────────────────────────────────

const batchStepSchema = z.object({
  tool: z.string().min(1).describe('Name of a draftsman tool'),
  input: z.unknown().describe('Input for that tool'),
});

const batchSchema = z.object({
  steps: z.array(batchStepSchema).min(1),
  label: z.string().optional().describe('Undo-history label for the batch'),
});

/**
 * batch composes the other tools' proposed ops into ONE atomic batch op.
 * Steps validate and execute against a working copy so later steps see
 * earlier steps' effects (add a component, then connect to its ref).
 */
function makeBatchTool(inner: ToolRegistry): AiTool<typeof batchSchema> {
  return {
    name: 'batch',
    description:
      'Compose several tool calls into ONE atomic, single-undo operation. Each step is {tool, input} using the other draftsman tools. ' +
      'Prefer this for any multi-step edit (e.g. add a part and wire it up).',
    schema: batchSchema,
    destructive: true,
    costClass: 'standard',
    destructiveFor(input): boolean {
      return input.steps.some((step) => {
        const tool = inner.get(step.tool);
        return tool ? tool.destructive : true;
      });
    },
    execute(input, ctx): ToolResult {
      const working = cloneGraph(ctx.graph);
      const composed: OpBody[] = [];
      const summaries: string[] = [];
      const stepData: unknown[] = [];
      for (const [i, step] of input.steps.entries()) {
        if (step.tool === 'batch') {
          throw new Error(`step ${String(i + 1)}: batch steps cannot nest batch`);
        }
        const res = inner.dispatch(step.tool, step.input, { graph: working, parts: ctx.parts });
        if (!res.ok) throw new Error(`step ${String(i + 1)} (${step.tool}): ${res.error}`);
        for (const op of res.result.ops) {
          const applied = applyOp(working, op);
          if (!applied.ok) {
            throw new Error(`step ${String(i + 1)} (${step.tool}) op failed: ${applied.error}`);
          }
          composed.push(op);
        }
        summaries.push(res.result.summary);
        stepData.push(res.result.data);
      }
      const label = input.label ?? `Draftsman batch (${String(input.steps.length)} steps)`;
      return {
        ops: [{ kind: 'batch', ops: composed, label }],
        data: { steps: stepData },
        summary: `${label}: ${summaries.join('; ')}`,
      };
    },
    explain(input): string {
      const tools = input.steps.map((s) => s.tool).join(', ');
      return `Apply ${String(input.steps.length)} steps as one edit: ${tools}`;
    },
  };
}

// ── Assembly ─────────────────────────────────────────────────────────

export const DRAFTSMAN_TOOL_NAMES = [
  'add_component',
  'connect',
  'place_symbol',
  'set_wire_geometry',
  'rename_net',
  'add_constraint',
  'run_erc',
  'batch',
] as const;

/** Build a registry holding exactly the 8 M1 draftsman tools. */
export function createDraftsmanRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(addComponent as AiTool);
  registry.register(connect as AiTool);
  registry.register(placeSymbol as AiTool);
  registry.register(setWireGeometry as AiTool);
  registry.register(renameNet as AiTool);
  registry.register(addConstraint as AiTool);
  registry.register(runErcTool as AiTool);
  registry.register(makeBatchTool(registry) as AiTool);
  return registry;
}
