import { newUuid } from '@protopulse/graph';
import { z } from 'zod';

import { ToolRegistry } from '../registry.js';

import type { ToolResult } from '../registry.js';
import type { DesignGraph, OpBody } from '@protopulse/graph';

/**
 * The Architect's 4 tools — structure as ops. Unlike the Analyst
 * (injected sim) and the Router (injected routing stack), the
 * Architect needs NO host hooks: buses and sheets are graph entities,
 * and the agent loop already holds the graph. The purest proof yet of
 * "once the substrate exists, a crew member is an assembly job".
 */

export const ARCHITECT_TOOLS = [
  'read_structure',
  'create_bus',
  'create_sheet',
  'move_components',
] as const;

const zBusKind = z.enum(['SPI', 'I2C', 'UART', 'USB', 'CAN', 'PWR', 'GPIO', 'custom']);

const zPort = z.object({
  name: z.string().min(1),
  direction: z.enum(['in', 'out', 'inout']),
  net: z.string().min(1).describe('Net name the port binds'),
});
type PortInput = z.infer<typeof zPort>;

function netByName(graph: DesignGraph, name: string) {
  return [...graph.nets.values()].find((n) => n.name === name) ?? graph.nets.get(name);
}

function sheetByName(graph: DesignGraph, name: string) {
  return [...graph.sheets.values()].find((s) => s.name === name) ?? graph.sheets.get(name);
}

function componentByRef(graph: DesignGraph, ref: string) {
  return [...graph.components.values()].find((c) => c.ref === ref) ?? graph.components.get(ref);
}

export function createArchitectRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register({
    name: 'read_structure',
    description:
      "Read the design's structure: the sheet tree (with component refs per sheet and interface ports), every bus with its member nets, and nets not yet on any bus. Call this before and after reorganizing.",
    schema: z.object({}),
    destructive: false,
    costClass: 'cheap',
    execute: (_input, ctx): ToolResult => {
      const g = ctx.graph;
      const sheets = [...g.sheets.values()]
        .map((sheet) => ({
          name: sheet.name,
          parent: sheet.parentId === null ? null : (g.sheets.get(sheet.parentId)?.name ?? sheet.parentId),
          components: [...g.components.values()]
            .filter((c) => c.sheetId === sheet.id)
            .map((c) => c.ref)
            .sort(),
          interface: sheet.interface.map((p) => ({
            name: p.name,
            direction: p.direction,
            net: g.nets.get(p.netId)?.name ?? p.netId,
          })),
        }))
        .sort((a, b) => (a.name < b.name ? -1 : 1));
      const rootComponents = [...g.components.values()]
        .filter((c) => c.sheetId === undefined)
        .map((c) => c.ref)
        .sort();
      const buses = [...g.buses.values()]
        .map((bus) => ({
          name: bus.name,
          kind: bus.kind,
          nets: bus.memberNets.map((id) => g.nets.get(id)?.name ?? id).sort(),
        }))
        .sort((a, b) => (a.name < b.name ? -1 : 1));
      const unbussed = [...g.nets.values()]
        .filter((n) => n.busId === undefined)
        .map((n) => n.name)
        .sort();
      return {
        ops: [],
        data: { sheets, rootComponents, buses, unbussed },
        summary: `${String(sheets.length)} sheet(s), ${String(buses.length)} bus(es), ${String(unbussed.length)} unbussed net(s), ${String(rootComponents.length)} root component(s)`,
      };
    },
    explain: () => "read the design's structure",
  });

  registry.register({
    name: 'create_bus',
    description:
      'Create a named bus and assign nets to it by NET NAME (read_structure lists them). Unknown nets fail the whole call — nothing partial lands.',
    schema: z.object({
      name: z.string().min(1).describe('Bus name, e.g. "POWER" or "SPI0"'),
      busKind: zBusKind,
      nets: z.array(z.string().min(1)).min(1).describe('Net names to assign'),
    }),
    destructive: true,
    costClass: 'cheap',
    execute: (input, ctx): ToolResult => {
      const busId = newUuid();
      const ops: OpBody[] = [{ kind: 'create_bus', id: busId, name: input.name, busKind: input.busKind }];
      for (const name of input.nets) {
        const net = netByName(ctx.graph, name);
        if (!net) throw new Error(`no net named "${name}" — read_structure lists net names`);
        ops.push({ kind: 'assign_to_bus', netId: net.id, busId });
      }
      return { ops, summary: `bus ${input.name} (${input.busKind}) with ${String(input.nets.length)} net(s)` };
    },
    explain: (input) => `create ${input.busKind} bus "${input.name}" over ${String(input.nets.length)} net(s)`,
  });

  registry.register({
    name: 'create_sheet',
    description:
      'Create a hierarchical sheet, optionally under a parent sheet (by name), move components onto it (by ref), and declare its interface ports (name + direction + net name).',
    schema: z.object({
      name: z.string().min(1),
      parent: z.string().min(1).optional().describe('Parent sheet name; omit for top level'),
      components: z.array(z.string().min(1)).describe('Component refs to move onto the sheet'),
      interface: z.array(zPort).optional(),
    }),
    destructive: true,
    costClass: 'standard',
    execute: (input, ctx): ToolResult => {
      const sheetId = newUuid();
      let parentId: string | null = null;
      if (input.parent !== undefined) {
        const parent = sheetByName(ctx.graph, input.parent);
        if (!parent) throw new Error(`no sheet named "${input.parent}"`);
        parentId = parent.id;
      }
      const ops: OpBody[] = [{ kind: 'add_sheet', id: sheetId, name: input.name, parentId }];
      if (input.interface !== undefined && input.interface.length > 0) {
        const ports = input.interface.map((port: PortInput) => {
          const net = netByName(ctx.graph, port.net);
          if (!net) throw new Error(`interface port ${port.name}: no net named "${port.net}"`);
          return { name: port.name, direction: port.direction, netId: net.id };
        });
        ops.push({ kind: 'set_sheet_interface', sheetId, interface: ports });
      }
      for (const ref of input.components) {
        const comp = componentByRef(ctx.graph, ref);
        if (!comp) throw new Error(`no component "${ref}" — read_structure lists refs`);
        ops.push({ kind: 'move_to_sheet', componentId: comp.id, sheetId });
      }
      return {
        ops,
        summary: `sheet ${input.name}${input.parent ? ` under ${input.parent}` : ''}, ${String(input.components.length)} component(s), ${String(input.interface?.length ?? 0)} port(s)`,
      };
    },
    explain: (input) =>
      `create sheet "${input.name}" and move ${String(input.components.length)} component(s) onto it`,
  });

  registry.register({
    name: 'move_components',
    description:
      'Move components (by ref) onto an EXISTING sheet by name, or back to the root with sheet: null.',
    schema: z.object({
      components: z.array(z.string().min(1)).min(1),
      sheet: z.string().min(1).nullable().describe('Target sheet name, or null for the root'),
    }),
    destructive: true,
    costClass: 'cheap',
    execute: (input, ctx): ToolResult => {
      let sheetId: string | null = null;
      if (input.sheet !== null) {
        const sheet = sheetByName(ctx.graph, input.sheet);
        if (!sheet) throw new Error(`no sheet named "${input.sheet}"`);
        sheetId = sheet.id;
      }
      const ops: OpBody[] = [];
      for (const ref of input.components) {
        const comp = componentByRef(ctx.graph, ref);
        if (!comp) throw new Error(`no component "${ref}"`);
        ops.push({ kind: 'move_to_sheet', componentId: comp.id, sheetId });
      }
      return {
        ops,
        summary: `moved ${String(input.components.length)} component(s) to ${input.sheet ?? 'the root sheet'}`,
      };
    },
    explain: (input) =>
      `move ${input.components.join(', ')} to ${input.sheet ?? 'the root sheet'}`,
  });

  return registry;
}
