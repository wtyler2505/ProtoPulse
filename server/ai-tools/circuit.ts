/**
 * Circuit tools — schematic components, nets, wires, PCB traces, ERC.
 */

import { z } from 'zod';
import type { ToolRegistry } from './registry';
import { clientAction } from './registry';

export function registerCircuitTools(registry: ToolRegistry): void {
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
      const instance = await ctx.storage.createCircuitInstance({
        circuitId: params.circuitId,
        partId: params.partId,
        referenceDesignator: params.referenceDesignator,
        schematicX: params.x,
        schematicY: params.y,
        schematicRotation: params.rotation,
      });
      return { success: true, message: `Placed ${params.referenceDesignator} (instance id: ${instance.id})` };
    },
  });

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
      segments: z.array(z.record(z.unknown())).optional().default([]).describe('Net routing segments'),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
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

// ---------------------------------------------------------------------------
// PCB / breadboard tools — also category "circuit"
// ---------------------------------------------------------------------------

export function registerPcbTools(registry: ToolRegistry): void {
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
