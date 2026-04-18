/**
 * PCB and breadboard physical layout tools — breadboard wiring, trace routing,
 * wire removal, auto-routing.
 *
 * @module ai-tools/circuit/pcb
 */

import { z } from 'zod';
import type { ToolRegistry } from '../registry';
import { clientAction } from '../registry';
import { guardCircuitInProject } from './shared';

/**
 * Register PCB and breadboard physical layout tools with the given registry.
 *
 * These tools handle the physical representation of circuits: breadboard
 * wiring, PCB trace routing, wire removal, and automatic routing.
 *
 * Tools registered (4 total):
 *
 * **Breadboard:**
 * - `place_breadboard_wire` — Add a wire on the breadboard view (server-side, writes to DB).
 *
 * **Wire management:**
 * - `remove_wire`           — Remove a wire from any view (destructive, requires confirmation).
 *
 * **PCB layout:**
 * - `draw_pcb_trace`        — Route a PCB trace between two points (server-side, writes to DB).
 * - `auto_route`            — Automatically route all unrouted nets.
 *
 * @param registry - The {@link ToolRegistry} instance to register tools into.
 */
export function registerPcbTools(registry: ToolRegistry): void {
  /**
   * place_breadboard_wire — Add a wire connection on the breadboard view.
   *
   * Executes server-side: creates a new wire record via `storage.createCircuitWire()`
   * with the `breadboard` view type, path points, and optional color.
   *
   * @side-effect Writes a new row to the `circuit_wires` table.
   */
  registry.register({
    name: 'place_breadboard_wire',
    description: 'Add a wire connection on the breadboard view between two points.',
    category: 'circuit',
    parameters: z.object({
      circuitId: z.number().int().positive().describe('Circuit design ID'),
      netId: z.number().int().positive().describe('Net ID this wire belongs to'),
      points: z
        .array(z.object({ x: z.number(), y: z.number() }))
        .min(2)
        .describe('Wire path points'),
      color: z.string().optional().describe("Wire color (e.g., 'red', 'blue', 'green')"),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      const guard = await guardCircuitInProject(params.circuitId, ctx);
      if (guard) return guard;
      const wire = await ctx.storage.createCircuitWire({
        circuitId: params.circuitId,
        netId: params.netId,
        view: 'breadboard',
        points: params.points,
        layer: 'front',
        width: 1.0,
        color: params.color ?? null,
      });
      return { success: true, message: `Placed breadboard wire (id: ${wire.id})` };
    },
  });

  /**
   * remove_wire — Remove a wire from the breadboard or PCB view.
   *
   * Executes server-side: deletes the wire via `storage.deleteCircuitWire()`.
   * Requires user confirmation (`requiresConfirmation: true`) because the
   * operation is destructive.
   *
   * @side-effect Deletes a row from the `circuit_wires` table.
   */
  registry.register({
    name: 'remove_wire',
    description: 'Remove a wire from the breadboard or PCB view.',
    category: 'circuit',
    parameters: z.object({
      wireId: z.number().int().positive().describe('Wire ID to remove'),
    }),
    requiresConfirmation: true,
    execute: async (params, ctx) => {
      const deleted = await ctx.storage.deleteCircuitWire(params.wireId);
      if (!deleted) {
        return { success: false, message: `Wire ${params.wireId} not found` };
      }
      return { success: true, message: `Removed wire ${params.wireId}` };
    },
  });

  /**
   * draw_pcb_trace — Route a PCB trace between two points on the board layout.
   *
   * Executes server-side: creates a new wire record via `storage.createCircuitWire()`
   * with the `pcb` view type, configurable trace width (mm), and layer (front/back).
   *
   * @side-effect Writes a new row to the `circuit_wires` table.
   */
  registry.register({
    name: 'draw_pcb_trace',
    description: 'Route a PCB trace between two points on the board layout.',
    category: 'circuit',
    parameters: z.object({
      circuitId: z.number().int().positive().describe('Circuit design ID'),
      netId: z.number().int().positive().describe('Net ID this trace belongs to'),
      points: z
        .array(z.object({ x: z.number(), y: z.number() }))
        .min(2)
        .describe('Trace path points'),
      width: z.number().positive().optional().default(0.25).describe('Trace width in mm'),
      layer: z.enum(['front', 'back']).optional().default('front').describe('PCB layer'),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      const guard = await guardCircuitInProject(params.circuitId, ctx);
      if (guard) return guard;
      const wire = await ctx.storage.createCircuitWire({
        circuitId: params.circuitId,
        netId: params.netId,
        view: 'pcb',
        points: params.points,
        layer: params.layer,
        width: params.width,
        color: null,
      });
      return { success: true, message: `Routed PCB trace on ${params.layer} layer (id: ${wire.id})` };
    },
  });

  /**
   * auto_route — Automatically route all unrouted nets on the PCB layout.
   *
   * Dispatched client-side. Invokes the client-side auto-router which
   * analyzes unrouted nets and generates optimal PCB traces.
   */
  registry.register({
    name: 'auto_route',
    description: 'Automatically route all unrouted nets on the PCB layout.',
    category: 'circuit',
    parameters: z.object({
      circuitId: z.number().int().positive().describe('Circuit design ID'),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction('auto_route', params),
  });
}
