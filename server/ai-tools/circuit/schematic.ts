/**
 * Circuit schematic tools — create circuits, place components, draw nets,
 * annotate, and run ERC.
 *
 * @module ai-tools/circuit/schematic
 */

import { z } from 'zod';
import { buildExactPartAiPolicy } from '@shared/exact-part-ai-policy';
import type { ToolRegistry } from '../registry';
import { clientAction } from '../registry';
import { guardCircuitInProject } from './shared';

/**
 * Register all circuit schematic tools with the given registry.
 *
 * Tools registered (10 total):
 *
 * **Circuit management:**
 * - `create_circuit`              — Create a new blank circuit design (server-side, writes to DB).
 * - `expand_architecture_to_circuit` — Convert architecture block diagram into detailed schematic.
 *
 * **Component placement:**
 * - `place_component`             — Place a component instance on a schematic (server-side, writes to DB).
 * - `remove_component_instance`   — Remove an instance from a schematic (destructive, requires confirmation).
 *
 * **Net management:**
 * - `draw_net`                    — Create a net (electrical connection) between pins (server-side).
 * - `remove_net`                  — Delete a net (destructive, requires confirmation).
 *
 * **Schematic annotations:**
 * - `place_power_symbol`          — Add VCC/GND/etc. power symbols.
 * - `place_no_connect`            — Mark a pin as intentionally unconnected.
 * - `add_net_label`               — Add a text label to a net connection point.
 *
 * **Verification:**
 * - `run_erc`                     — Run Electrical Rule Check on a circuit.
 *
 * @param registry - The {@link ToolRegistry} instance to register tools into.
 */
export function registerCircuitTools(registry: ToolRegistry): void {
  /**
   * create_circuit — Create a new circuit design for the project.
   *
   * Executes server-side: creates a blank circuit design record via
   * `storage.createCircuitDesign()` with the given name and optional description.
   *
   * @side-effect Writes a new row to the `circuit_designs` table.
   */
  registry.register({
    name: 'create_circuit',
    description:
      'Create a new circuit design for the project. This creates a blank schematic where components can be placed and connected.',
    category: 'circuit',
    parameters: z.object({
      name: z.string().min(1).describe("Circuit name (e.g., 'Power Supply', 'RF Frontend')"),
      description: z.string().optional().describe('Optional description of the circuit'),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      const circuit = await ctx.storage.createCircuitDesign({
        projectId: ctx.projectId,
        name: params.name,
        description: params.description ?? null,
        settings: {},
      });
      return { success: true, message: `Created circuit "${params.name}" (id: ${circuit.id})` };
    },
  });

  /**
   * expand_architecture_to_circuit — Convert architecture blocks into schematic components.
   *
   * Dispatched client-side. Reads the current architecture block diagram and
   * generates a detailed circuit schematic with component instances and proper
   * pin connections.
   */
  registry.register({
    name: 'expand_architecture_to_circuit',
    description:
      'Expand the architecture block diagram into a detailed schematic circuit design. This converts architecture nodes into component instances with proper pin connections.',
    category: 'circuit',
    parameters: z.object({
      circuitName: z.string().optional().default('Main Circuit').describe('Name for the generated circuit'),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction('expand_architecture_to_circuit', params),
  });

  /**
   * place_component — Place a component instance on a circuit schematic.
   *
   * Executes server-side: creates a new circuit instance record via
   * `storage.createCircuitInstance()` with position, rotation, and reference
   * designator (e.g., U1, R1, C1).
   *
   * @side-effect Writes a new row to the `circuit_instances` table.
   */
  registry.register({
    name: 'place_component',
    description:
      'Place a component instance on a circuit schematic. Requires the circuit ID and the component part ID.',
    category: 'circuit',
    parameters: z.object({
      circuitId: z.number().int().positive().describe('Circuit design ID'),
      partId: z.number().int().positive().describe('Component part ID to instantiate'),
      referenceDesignator: z.string().min(1).describe('Reference designator (e.g., U1, R1, C1)'),
      x: z.number().optional().default(200).describe('X position on schematic'),
      y: z.number().optional().default(200).describe('Y position on schematic'),
      rotation: z.number().optional().default(0).describe('Rotation in degrees (0, 90, 180, 270)'),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      const guard = await guardCircuitInProject(params.circuitId, ctx);
      if (guard) return guard;
      const part = await ctx.storage.getComponentPart(params.partId, ctx.projectId);
      if (!part) {
        return { success: false, message: `Component part ${String(params.partId)} not found` };
      }

      const exactPartPolicy = buildExactPartAiPolicy(part);
      const instance = await ctx.storage.createCircuitInstance({
        circuitId: params.circuitId,
        partId: params.partId,
        referenceDesignator: params.referenceDesignator,
        schematicX: params.x,
        schematicY: params.y,
        schematicRotation: params.rotation,
        properties: {
          exactPartTrust: {
            authoritativeWiringAllowed: exactPartPolicy.authoritativeWiringAllowed,
            family: exactPartPolicy.family,
            level: exactPartPolicy.level,
            placementMode: exactPartPolicy.placementMode,
            requiresVerification: exactPartPolicy.requiresVerification,
            status: exactPartPolicy.status,
            summary: exactPartPolicy.summary,
            title: exactPartPolicy.title,
          },
          provisionalWiring:
            exactPartPolicy.requiresVerification && !exactPartPolicy.authoritativeWiringAllowed,
        },
      });

      return {
        success: true,
        message: exactPartPolicy.placementMode === 'provisional-exact'
          ? `Placed ${params.referenceDesignator} as a provisional exact part (instance id: ${instance.id}). ProtoPulse can place "${exactPartPolicy.title}" visually, but exact wiring guidance stays blocked until verification is complete.`
          : exactPartPolicy.placementMode === 'verified-exact'
            ? `Placed ${params.referenceDesignator} using verified exact part "${exactPartPolicy.title}" (instance id: ${instance.id}).`
            : `Placed ${params.referenceDesignator} (instance id: ${instance.id})`,
        data: {
          exactPartTrust: exactPartPolicy,
        },
      };
    },
  });

  /**
   * remove_component_instance — Remove a component instance from a circuit schematic.
   *
   * Executes server-side: deletes the instance via `storage.deleteCircuitInstance()`.
   * Requires user confirmation (`requiresConfirmation: true`) because the
   * operation is destructive.
   *
   * @side-effect Deletes a row from the `circuit_instances` table.
   */
  registry.register({
    name: 'remove_component_instance',
    description: 'Remove a component instance from a circuit schematic by its reference designator or instance ID.',
    category: 'circuit',
    parameters: z.object({
      instanceId: z.number().int().positive().describe('Instance ID to remove'),
    }),
    requiresConfirmation: true,
    execute: async (params, ctx) => {
      const deleted = await ctx.storage.deleteCircuitInstance(params.instanceId);
      if (!deleted) {
        return { success: false, message: `Instance ${params.instanceId} not found` };
      }
      return { success: true, message: `Removed instance ${params.instanceId}` };
    },
  });

  /**
   * draw_net — Create a net (electrical connection) between pins.
   *
   * Executes server-side: creates a new net record via `storage.createCircuitNet()`
   * with name, type (signal/power/ground/bus), optional voltage, and routing segments.
   *
   * @side-effect Writes a new row to the `circuit_nets` table.
   */
  registry.register({
    name: 'draw_net',
    description: 'Create a net (electrical connection) between pins in a circuit schematic.',
    category: 'circuit',
    parameters: z.object({
      circuitId: z.number().int().positive().describe('Circuit design ID'),
      name: z.string().min(1).describe('Net name (e.g., VCC, GND, MOSI, SDA)'),
      netType: z
        .enum(['signal', 'power', 'ground', 'bus'])
        .optional()
        .default('signal')
        .describe('Net type'),
      voltage: z.string().optional().describe("Voltage (for power nets, e.g., '3.3V')"),
      segments: z
        .array(
          z
            .object({
              x1: z.number().optional(),
              y1: z.number().optional(),
              x2: z.number().optional(),
              y2: z.number().optional(),
              layer: z.string().optional(),
              width: z.number().optional(),
            })
            .passthrough(),
        )
        .optional()
        .default([])
        .describe('Net routing segments'),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      const guard = await guardCircuitInProject(params.circuitId, ctx);
      if (guard) return guard;
      const net = await ctx.storage.createCircuitNet({
        circuitId: params.circuitId,
        name: params.name,
        netType: params.netType,
        voltage: params.voltage ?? null,
        segments: params.segments,
      });
      return { success: true, message: `Created net "${params.name}" (id: ${net.id})` };
    },
  });

  /**
   * remove_net — Delete a net from a circuit schematic.
   *
   * Executes server-side: deletes the net via `storage.deleteCircuitNet()`.
   * Requires user confirmation (`requiresConfirmation: true`) because the
   * operation is destructive and removes all associated connectivity.
   *
   * @side-effect Deletes a row from the `circuit_nets` table.
   */
  registry.register({
    name: 'remove_net',
    description: 'Delete a net from a circuit schematic.',
    category: 'circuit',
    parameters: z.object({
      netId: z.number().int().positive().describe('Net ID to delete'),
    }),
    requiresConfirmation: true,
    execute: async (params, ctx) => {
      const deleted = await ctx.storage.deleteCircuitNet(params.netId);
      if (!deleted) {
        return { success: false, message: `Net ${params.netId} not found` };
      }
      return { success: true, message: `Removed net ${params.netId}` };
    },
  });

  /**
   * place_power_symbol — Add a power symbol (VCC, GND, etc.) to a schematic.
   *
   * Dispatched client-side. Places a standard power symbol at the specified
   * position, optionally overriding the default net name.
   */
  registry.register({
    name: 'place_power_symbol',
    description: 'Add a power symbol (VCC, GND, etc.) to a circuit schematic.',
    category: 'circuit',
    parameters: z.object({
      circuitId: z.number().int().positive().describe('Circuit design ID'),
      symbolType: z
        .enum(['VCC', 'GND', 'AGND', 'DGND', 'V3_3', 'V5', 'V12', 'VBAT'])
        .describe('Power symbol type'),
      x: z.number().optional().default(200).describe('X position'),
      y: z.number().optional().default(200).describe('Y position'),
      netName: z.string().optional().describe('Custom net name override'),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction('place_power_symbol', params),
  });

  /**
   * place_no_connect — Mark a pin as intentionally unconnected.
   *
   * Dispatched client-side. Adds a no-connect marker (X symbol) to the
   * specified pin, suppressing ERC warnings about unconnected pins.
   */
  registry.register({
    name: 'place_no_connect',
    description: 'Mark a pin as intentionally unconnected (no-connect marker) on the schematic.',
    category: 'circuit',
    parameters: z.object({
      circuitId: z.number().int().positive().describe('Circuit design ID'),
      instanceId: z.number().int().positive().describe('Instance ID'),
      pinName: z.string().min(1).describe('Pin name to mark as no-connect'),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction('place_no_connect', params),
  });

  /**
   * add_net_label — Add a net label to name a connection point on the schematic.
   *
   * Dispatched client-side. Places a text label at the specified position
   * to identify a net by name, enabling off-page connections.
   */
  registry.register({
    name: 'add_net_label',
    description: 'Add a net label to the schematic to name a connection point.',
    category: 'circuit',
    parameters: z.object({
      circuitId: z.number().int().positive().describe('Circuit design ID'),
      netName: z.string().min(1).describe('Net name to label'),
      x: z.number().optional().default(200).describe('X position'),
      y: z.number().optional().default(200).describe('Y position'),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction('add_net_label', params),
  });

  /**
   * run_erc — Run Electrical Rule Check on a circuit design.
   *
   * Dispatched client-side. Analyzes the circuit for connection errors,
   * missing connections, floating pins, and design rule violations.
   * Results are displayed in the validation panel.
   */
  registry.register({
    name: 'run_erc',
    description:
      'Run Electrical Rule Check on a circuit to find connection errors, missing connections, and design rule violations.',
    category: 'circuit',
    parameters: z.object({
      circuitId: z.number().int().positive().describe('Circuit design ID to check'),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction('run_erc', params),
  });
}
