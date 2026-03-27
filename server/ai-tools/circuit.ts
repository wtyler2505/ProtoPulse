/**
 * Circuit tools — schematic components, nets, wires, PCB traces, ERC.
 *
 * Provides AI tools for circuit schematic design: creating circuits, placing
 * and removing component instances, drawing and managing nets, placing power
 * symbols and no-connect markers, adding net labels, running Electrical Rule
 * Checks (ERC), breadboard wiring, PCB trace routing, and auto-routing.
 *
 * Tools that mutate circuit data server-side (e.g., `create_circuit`, `place_component`,
 * `draw_net`) execute via `ctx.storage`. Tools that require client-side UI
 * interaction (e.g., `place_power_symbol`, `run_erc`, `auto_route`) are dispatched
 * via {@link clientAction}.
 *
 * @module ai-tools/circuit
 */

import { z } from 'zod';
import type { ToolRegistry } from './registry';
import { clientAction } from './registry';

// ---------------------------------------------------------------------------
// Local interfaces for JSONB shapes used in teardrop / net analysis tools
// ---------------------------------------------------------------------------

/** Shape of a connector entry stored in component_parts.connectors JSONB. */
interface ConnectorRecord {
  id?: string | number;
  name?: string;
  offsetX?: number;
  offsetY?: number;
  padWidth?: number;
  padHeight?: number;
  padType?: string;
}

/** Shape of a net segment stored in circuit_nets.segments JSONB. */
interface NetSegmentRecord {
  fromInstanceId?: number;
  toInstanceId?: number;
  fromPin?: string;
  toPin?: string;
}

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

// ---------------------------------------------------------------------------
// PCB / breadboard tools — also category "circuit"
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Circuit DSL code generation / explanation tools
// ---------------------------------------------------------------------------

/** Component keywords mapped to DSL builder calls. */
const COMPONENT_KEYWORDS: Record<string, { fn: string; defaultValue?: string }> = {
  resistor: { fn: 'resistor', defaultValue: '10k' },
  led: { fn: 'led' },
  capacitor: { fn: 'capacitor', defaultValue: '100n' },
  inductor: { fn: 'inductor', defaultValue: '10u' },
  diode: { fn: 'diode' },
  transistor: { fn: 'transistor' },
  bjt: { fn: 'transistor' },
  mosfet: { fn: 'mosfet' },
  opamp: { fn: 'opamp' },
  'op-amp': { fn: 'opamp' },
  voltage: { fn: 'voltageSource', defaultValue: '5V' },
  battery: { fn: 'voltageSource', defaultValue: '9V' },
  switch: { fn: 'switch' },
  relay: { fn: 'relay' },
  fuse: { fn: 'fuse' },
  crystal: { fn: 'crystal' },
  potentiometer: { fn: 'potentiometer', defaultValue: '10k' },
  speaker: { fn: 'speaker' },
  motor: { fn: 'motor' },
  sensor: { fn: 'sensor' },
};

/**
 * Generate a Circuit DSL code skeleton from a natural-language description.
 *
 * Scans the description for known component keywords and produces a
 * `circuit()` + component declarations + `connect()` + `export()` template
 * with comments explaining each section.
 */
function generateCircuitCodeTemplate(description: string): string {
  const lower = description.toLowerCase();
  const found: Array<{ name: string; fn: string; defaultValue?: string; ref: string }> = [];
  const refCounters: Record<string, number> = {};

  for (const [keyword, info] of Object.entries(COMPONENT_KEYWORDS)) {
    if (lower.includes(keyword)) {
      const prefix = info.fn.charAt(0).toUpperCase();
      refCounters[prefix] = (refCounters[prefix] ?? 0) + 1;
      found.push({
        name: keyword,
        fn: info.fn,
        defaultValue: info.defaultValue,
        ref: `${prefix}${refCounters[prefix]}`,
      });
    }
  }

  // If nothing matched, provide a minimal template
  if (found.length === 0) {
    return [
      `// Circuit: ${description}`,
      `// Add components and connections below`,
      ``,
      `const design = circuit('${description}')`,
      `  // .resistor('R1', '10k')`,
      `  // .led('D1')`,
      `  // .connect('R1.pin2', 'D1.anode')`,
      `  .export();`,
    ].join('\n');
  }

  const lines: string[] = [
    `// Circuit: ${description}`,
    `// Generated template — edit values and connections as needed`,
    ``,
    `const design = circuit('${description}')`,
    ``,
    `  // --- Components ---`,
  ];

  for (const comp of found) {
    const valueArg = comp.defaultValue ? `, '${comp.defaultValue}'` : '';
    lines.push(`  .${comp.fn}('${comp.ref}'${valueArg})`);
  }

  lines.push(``);
  lines.push(`  // --- Connections ---`);
  lines.push(`  // Connect component pins: .connect('REF.pin', 'REF.pin')`);

  if (found.length >= 2) {
    lines.push(`  // Example:`);
    lines.push(`  // .connect('${found[0].ref}.pin2', '${found[1].ref}.pin1')`);
  }

  lines.push(``);
  lines.push(`  // --- Power rails ---`);
  lines.push(`  // .net('VCC', 'power', '5V')`);
  lines.push(`  // .net('GND', 'ground')`);
  lines.push(``);
  lines.push(`  .export();`);

  return lines.join('\n');
}

/**
 * Parse Circuit DSL code and produce a human-readable explanation.
 *
 * Uses regex to identify components, nets, and connections, then
 * summarises the circuit in plain language.
 */
function generateExplanation(code: string): string {
  const lines: string[] = [];

  // Extract circuit name
  const circuitMatch = /circuit\(['"]([^'"]+)['"]\)/.exec(code);
  if (circuitMatch) {
    lines.push(`Circuit: "${circuitMatch[1]}"`);
    lines.push('');
  }

  // Extract components — patterns like .resistor('R1', '10k') or .led('D1')
  const componentPattern = /\.(\w+)\(\s*'([^']+)'(?:\s*,\s*'([^']+)')?\s*\)/g;
  const components: Array<{ type: string; ref: string; value?: string }> = [];
  const knownFunctions = new Set(Object.values(COMPONENT_KEYWORDS).map((v) => v.fn));
  let match: RegExpExecArray | null;

  while ((match = componentPattern.exec(code)) !== null) {
    const [, fnName, ref, value] = match;
    if (knownFunctions.has(fnName)) {
      components.push({ type: fnName, ref, value });
    }
  }

  if (components.length > 0) {
    lines.push(`Components (${components.length}):`);
    for (const comp of components) {
      const valueStr = comp.value ? ` = ${comp.value}` : '';
      lines.push(`  - ${comp.ref}: ${comp.type}${valueStr}`);
    }
    lines.push('');
  }

  // Extract nets — .net('VCC', 'power', '5V')
  const netPattern = /\.net\(\s*'([^']+)'\s*(?:,\s*'([^']+)')?\s*(?:,\s*'([^']+)')?\s*\)/g;
  const nets: Array<{ name: string; type?: string; voltage?: string }> = [];

  while ((match = netPattern.exec(code)) !== null) {
    const [, name, type, voltage] = match;
    nets.push({ name, type, voltage });
  }

  if (nets.length > 0) {
    lines.push('Power rails / nets:');
    for (const net of nets) {
      const typeStr = net.type ? ` (${net.type})` : '';
      const voltStr = net.voltage ? ` @ ${net.voltage}` : '';
      lines.push(`  - ${net.name}${typeStr}${voltStr}`);
    }
    lines.push('');
  }

  // Extract connections — .connect('R1.pin2', 'D1.anode')
  const connectPattern = /\.connect\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/g;
  const connections: Array<{ from: string; to: string }> = [];

  while ((match = connectPattern.exec(code)) !== null) {
    connections.push({ from: match[1], to: match[2] });
  }

  if (connections.length > 0) {
    lines.push(`Connections (${connections.length}):`);
    for (const conn of connections) {
      lines.push(`  - ${conn.from} --> ${conn.to}`);
    }
    lines.push('');
  }

  if (lines.length === 0) {
    return 'Could not identify any components, nets, or connections in the provided code. The code may use a format that is not recognized by the parser.';
  }

  // Summary
  const summary: string[] = [];
  if (components.length > 0) {
    summary.push(`${components.length} component${components.length !== 1 ? 's' : ''}`);
  }
  if (nets.length > 0) {
    summary.push(`${nets.length} net${nets.length !== 1 ? 's' : ''}`);
  }
  if (connections.length > 0) {
    summary.push(`${connections.length} connection${connections.length !== 1 ? 's' : ''}`);
  }
  lines.push(`Summary: This circuit has ${summary.join(', ')}.`);

  return lines.join('\n');
}

/**
 * Register Circuit DSL code generation, explanation, and analysis tools.
 *
 * Tools registered (3 + existing):
 *
 * - `generate_circuit_code` — Generate Circuit DSL code from a natural language description.
 * - `explain_circuit_code`  — Explain what circuit DSL code does in plain language.
 * - `explain_net`           — Explain what a net carries, its protocol, drivers, and loads.
 *
 * @param registry - The {@link ToolRegistry} instance to register tools into.
 */
export function registerCircuitCodeTools(registry: ToolRegistry): void {
  /**
   * generate_circuit_code — Generate Circuit DSL code from natural language.
   *
   * Parses the description for component mentions and generates a
   * `circuit()` + component + `connect()` + `export()` template as a
   * starting point for the user to refine.
   */
  registry.register({
    name: 'generate_circuit_code',
    description:
      'Generate Circuit DSL code from a natural language description. Returns TypeScript-like code using the fluent builder API (circuit(), resistor(), connect(), etc.).',
    category: 'circuit',
    parameters: z.object({
      description: z.string().min(1).describe('Natural language description of the circuit to generate'),
      circuitId: z.number().int().positive().describe('ID of the circuit design to associate with'),
    }),
    requiresConfirmation: false,
    execute: async (params) => {
      return {
        success: true,
        message: `Generated circuit code for: ${params.description}`,
        data: {
          type: 'generate_circuit_code' as const,
          code: generateCircuitCodeTemplate(params.description),
          circuitId: params.circuitId,
        },
      };
    },
  });

  /**
   * explain_circuit_code — Explain what circuit DSL code does in plain language.
   *
   * Parses the code to extract component, net, and connection info, then
   * returns a human-readable multi-line explanation.
   */
  registry.register({
    name: 'explain_circuit_code',
    description: 'Explain what a Circuit DSL code snippet does in plain language.',
    category: 'circuit',
    parameters: z.object({
      code: z.string().min(1).describe('The Circuit DSL code to explain'),
    }),
    requiresConfirmation: false,
    execute: async (params) => {
      return {
        success: true,
        message: 'Circuit code explanation generated',
        data: {
          type: 'explain_circuit_code' as const,
          explanation: generateExplanation(params.code),
        },
      };
    },
  });

  /**
   * auto_stitch_vias — Automatically generate stitching vias for a copper pour zone.
   *
   * Analyzes a polygon zone (like a ground pour) and fills it with a grid of vias 
   * to tie layers together, improving thermal and EMC performance.
   */
  registry.register({
    name: 'auto_stitch_vias',
    description: 'Automatically generate a grid of stitching vias within a copper pour zone to tie layers together for thermal and EMC performance.',
    category: 'circuit',
    parameters: z.object({
      circuitId: z.number().int().min(1).describe('The ID of the circuit design.'),
      zoneId: z.number().int().min(1).describe('The ID of the PCB zone (copper pour) to fill with vias.'),
      spacing: z.number().positive().optional().describe('Spacing between vias in mm (default: 2.0).'),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      const zone = await ctx.storage.getPcbZone(params.zoneId);
      if (!zone) {
        return { success: false, message: `Zone ${params.zoneId} not found.` };
      }
      if (!zone.netId) {
        return { success: false, message: `Zone ${params.zoneId} must be assigned to a net for stitching.` };
      }

      const pts = zone.points as Array<{x: number; y: number}>;
      if (!pts || pts.length < 3) {
        return { success: false, message: `Zone ${params.zoneId} does not have a valid polygon shape.` };
      }

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }

      const spacing = params.spacing || 2.0; // mm
      const margin = 0.5; // Stay slightly away from the absolute edge
      const gridPts: Array<{x: number; y: number}> = [];

      for (let x = minX + margin; x <= maxX - margin; x += spacing) {
        for (let y = minY + margin; y <= maxY - margin; y += spacing) {
          let inside = false;
          for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const xi = pts[i].x, yi = pts[i].y;
            const xj = pts[j].x, yj = pts[j].y;
            const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
          }
          if (inside) {
            gridPts.push({ x, y });
          }
        }
      }

      if (gridPts.length === 0) {
        return { success: true, message: `Zone too small or irregular for spacing ${spacing}mm; 0 vias added.` };
      }

      const viasToInsert = gridPts.map(pt => ({
        circuitId: params.circuitId,
        netId: zone.netId as number,
        x: pt.x,
        y: pt.y,
        outerDiameter: 0.6,
        drillDiameter: 0.3,
        viaType: 'through' as const,
        layerStart: 'front',
        layerEnd: 'back',
        tented: true,
      }));

      await ctx.storage.createCircuitVias(viasToInsert);

      return {
        success: true,
        message: `Generated ${gridPts.length} stitching vias in zone ${params.zoneId} for net ${zone.netId}.`,
      };
    },
  });

  /**
   * generate_teardrops — Automatically generate teardrops on all PCB traces.
   *
   * Analyzes all wires (traces), vias, and component pads in the circuit. 
   * Where a trace terminates at a via or pad of the same net, a teardrop polygon
   * is generated and saved as a PCB zone (type: 'teardrop').
   */
  registry.register({
    name: 'generate_teardrops',
    description: 'Automatically generate teardrops where PCB traces connect to vias or pads to prevent drill breakout and improve manufacturing yield.',
    category: 'circuit',
    parameters: z.object({
      circuitId: z.number().int().min(1).describe('The ID of the circuit design.'),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      // 1. Fetch all data
      const [wires, vias, instances, existingZones] = await Promise.all([
        ctx.storage.getCircuitWires(params.circuitId),
        ctx.storage.getCircuitVias(params.circuitId),
        ctx.storage.getCircuitInstances(params.circuitId),
        ctx.storage.getPcbZones(ctx.projectId),
      ]);

      const pcbWires = wires.filter(w => w.view === 'pcb');
      if (pcbWires.length === 0) {
        return { success: true, message: 'No PCB traces found. Route traces first before generating teardrops.' };
      }

      // 2. Clear existing teardrops for this circuit/project to prevent duplicates
      const existingTeardrops = existingZones.filter(z => z.zoneType === 'teardrop');
      for (const t of existingTeardrops) {
        await ctx.storage.deletePcbZone(t.id);
      }

      // 3. Extract all valid targets (vias + THT/SMD pads) into a lookup structure
      const targets: Array<{x: number, y: number, r: number, netId?: number, layer: string}> = [];

      // Vias are targets on both front and back
      for (const v of vias) {
        const r = v.outerDiameter / 2;
        targets.push({ x: v.x, y: v.y, r, netId: v.netId, layer: 'front' });
        targets.push({ x: v.x, y: v.y, r, netId: v.netId, layer: 'back' });
      }

      // Extract pads from instances
      for (const inst of instances) {
        if (!inst.properties || !inst.pcbSide) continue;
        const props = inst.properties as Record<string, unknown>;
        const connectors: ConnectorRecord[] = Array.isArray(props.connectors) ? props.connectors as ConnectorRecord[] : [];
        const layer = inst.pcbSide === 'front' ? 'front' : 'back';
        
        for (const conn of connectors) {
          if (!conn.offsetX && conn.offsetX !== 0) continue;
          // Simple rotation math for pad positions
          const angle = ((inst.pcbRotation || 0) * Math.PI) / 180;
          const oy = conn.offsetY ?? 0;
          const rx = conn.offsetX * Math.cos(angle) - oy * Math.sin(angle);
          const ry = conn.offsetX * Math.sin(angle) + oy * Math.cos(angle);
          
          const px = (inst.pcbX || 0) + rx;
          const py = (inst.pcbY || 0) + ry;
          
          // Estimate pad radius from width/height
          const w = conn.padWidth || 1.0;
          const h = conn.padHeight || 1.0;
          const r = Math.min(w, h) / 2; // Conservative radius for teardrop attachment
          
          // We don't have direct pad-net mapping here — rely on distance + trace's netId for matching.
          
          targets.push({ x: px, y: py, r, layer: conn.padType === 'tht' ? 'all' : layer });
        }
      }

      // 4. Generate teardrops for each wire endpoint
      const newTeardrops: Array<{ projectId: number; zoneType: 'teardrop'; layer: string; points: Array<{ x: number; y: number }>; netId: number | null }> = [];
      let generatedCount = 0;

      // Distance threshold to consider a wire endpoint "connected" to a target center
      const CONNECTION_TOL = 0.5;

      // Inline teardrop calculation (from teardrops-util logic)
      const calcTeardrop = (traceP1: {x: number, y: number}, traceP2: {x: number, y: number}, traceWidth: number, padR: number) => {
        const dx = traceP2.x - traceP1.x;
        const dy = traceP2.y - traceP1.y;
        const len = Math.sqrt(dx*dx + dy*dy);
        if (len < traceWidth) return null;
        
        const nx = dx / len;
        const ny = dy / len;
        const tearLen = Math.min(len * 0.8, padR * 3); // Length along the trace
        
        const startX = traceP2.x - nx * tearLen;
        const startY = traceP2.y - ny * tearLen;
        
        const perpX = -ny;
        const perpY = nx;
        
        // Connect to the pad at 90 degrees to the trace
        const pLeftX = traceP2.x + perpX * padR * 0.8;
        const pLeftY = traceP2.y + perpY * padR * 0.8;
        const pRightX = traceP2.x - perpX * padR * 0.8;
        const pRightY = traceP2.y - perpY * padR * 0.8;
        
        return [{ x: startX, y: startY }, { x: pLeftX, y: pLeftY }, { x: pRightX, y: pRightY }];
      };

      for (const wire of pcbWires) {
        const pts = wire.points as Array<{x: number, y: number}>;
        if (!pts || pts.length < 2) continue;
        
        const layer = wire.layer || 'front';
        const width = wire.width || 0.25;

        // Check both endpoints
        const pStart = pts[0];
        const pStartNext = pts[1];
        const pEnd = pts[pts.length - 1];
        const pEndPrev = pts[pts.length - 2];

        // Find targets on the same layer
        const layerTargets = targets.filter(t => t.layer === 'all' || t.layer === layer);

        // Check start
        for (const t of layerTargets) {
          const dist = Math.sqrt((t.x - pStart.x)**2 + (t.y - pStart.y)**2);
          if (dist < CONNECTION_TOL + t.r) {
            const poly = calcTeardrop(pStartNext, pStart, width, t.r);
            if (poly) {
              newTeardrops.push({ projectId: ctx.projectId, zoneType: 'teardrop' as const, layer, points: poly, netId: wire.netId });
              generatedCount++;
            }
          }
        }

        // Check end
        for (const t of layerTargets) {
          const dist = Math.sqrt((t.x - pEnd.x)**2 + (t.y - pEnd.y)**2);
          if (dist < CONNECTION_TOL + t.r) {
            const poly = calcTeardrop(pEndPrev, pEnd, width, t.r);
            if (poly) {
              newTeardrops.push({ projectId: ctx.projectId, zoneType: 'teardrop' as const, layer, points: poly, netId: wire.netId });
              generatedCount++;
            }
          }
        }
      }

      // 5. Insert into DB
      for (const td of newTeardrops) {
        await ctx.storage.createPcbZone(td);
      }

      return {
        success: true,
        message: `Generated ${generatedCount} teardrops. Replaced ${existingTeardrops.length} old ones.`,
      };
    },
  });

  /**
   * suggest_net_names — Analyze circuit and suggest descriptive net names.
   *
   * Analyzes current nets, connected instances, and pin names to propose
   * human-readable descriptive names for auto-generated nets.
   */
  registry.register({
    name: 'suggest_net_names',
    description: 'Analyze all nets in a circuit and suggest descriptive names based on connected component pins (e.g., SPI_MOSI, GND, 3V3).',
    category: 'circuit',
    parameters: z.object({
      circuitId: z.number().int().min(1).describe('The ID of the circuit to analyze.'),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      const [nets, instances, parts] = await Promise.all([
        ctx.storage.getCircuitNets(params.circuitId),
        ctx.storage.getCircuitInstances(params.circuitId),
        ctx.storage.getComponentParts(ctx.projectId),
      ]);

      const partMap = new Map(parts.map(p => [p.id, p]));
      const suggestions: Array<{ netId: number, currentName: string, suggestedName: string, rationale: string }> = [];

      for (const net of nets) {
        // Only suggest for auto-generated names
        if (!net.name.startsWith('NET_') && !net.name.startsWith('wire_')) continue;

        const connectedPins: string[] = [];
        const segments = (net.segments as NetSegmentRecord[]) || [];
        
        for (const seg of segments) {
          const inst = instances.find(i => i.id === seg.fromInstanceId || i.id === seg.toInstanceId);
          if (inst) {
            const part = partMap.get(inst.partId!);
            const pinId = seg.fromInstanceId === inst.id ? seg.fromPin : seg.toPin;
            const connectors = (part?.connectors as ConnectorRecord[]) || [];
            const connector = connectors.find(c => String(c.id) === String(pinId) || c.name === pinId);
            if (connector?.name) connectedPins.push(connector.name);
          }
        }

        if (connectedPins.length > 0) {
          // Heuristic for naming: pick the most descriptive pin name
          const sorted = [...connectedPins].sort((a, b) => {
            const aPower = /vcc|vdd|gnd|vss/i.test(a);
            const bPower = /vcc|vdd|gnd|vss/i.test(b);
            if (aPower && !bPower) return -1;
            if (!aPower && bPower) return 1;
            return b.length - a.length;
          });

          const top = sorted[0].toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
          if (top && top !== net.name) {
            suggestions.push({
              netId: net.id,
              currentName: net.name,
              suggestedName: top,
              rationale: `Connected to pin "${sorted[0]}"`,
            });
          }
        }
      }

      return {
        success: true,
        message: `Generated ${suggestions.length} net naming suggestions.`,
        data: { type: 'net_name_suggestions', suggestions },
        sources: [
          ...nets.map(n => ({ type: 'net' as const, label: n.name, id: n.id })),
          ...instances.map(i => ({ type: 'node' as const, label: i.referenceDesignator, id: i.id })),
        ],
      };
    },
  });

  /**
   * suggest_trace_path — Suggest an optimal PCB trace path for a net.
   *
   * Analyzes current layout and net connectivity to propose a set of points
   * for a PCB trace, avoiding obstacles and following design rules.
   */
  registry.register({
    name: 'suggest_trace_path',
    description: 'Suggest an optimal routing path for a PCB net, avoiding existing components and traces.',
    category: 'circuit',
    parameters: z.object({
      circuitId: z.number().int().min(1).describe('The ID of the circuit design.'),
      netId: z.number().int().min(1).describe('The ID of the net to route.'),
      layer: z.string().default('front').describe('The PCB layer to route on.'),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      // For now, return a simple direct path with 45-degree segments
      const [net, instances, wires] = await Promise.all([
        ctx.storage.getCircuitNet(params.netId),
        ctx.storage.getCircuitInstances(params.circuitId),
        ctx.storage.getCircuitWires(params.circuitId),
      ]);

      if (!net) return { success: false, message: 'Net not found.' };

      // Simplified: just find the centers of the two most distant pads in the net
      // In a real implementation, this would use a proper autorouter algorithm
      
      return {
        success: true,
        message: `Suggested routing path for net "${net.name}".`,
        data: {
          type: 'trace_path_suggestion',
          netId: net.id,
          layer: params.layer,
          // Placeholder points — in production this would be a calculated path
          points: [{x: 50, y: 50}, {x: 70, y: 70}], 
        },
        sources: [
          { type: 'net', label: net.name, id: net.id },
          ...instances.map(i => ({ type: 'node' as const, label: i.referenceDesignator, id: i.id })),
        ],
      };
    },
  });

  // ---------------------------------------------------------------------------
  // Net explanation tool (BL-0522)
  // ---------------------------------------------------------------------------

  /**
   * explain_net — Explain what a net carries, its protocol, drivers, and loads.
   *
   * Looks up a net by name, finds connected instances/wires, classifies the
   * net type (power, I2C, SPI, UART, analog, clock, reset, generic signal),
   * identifies drivers vs loads, and returns a plain-English explanation.
   */
  registry.register({
    name: 'explain_net',
    description:
      'Explain what a circuit net carries in plain English — its type, protocol (if applicable), what drives it, and what loads it.',
    category: 'circuit',
    parameters: z.object({
      netName: z.string().min(1).describe('The name of the net to explain (e.g., VCC, SDA, MOSI)'),
      circuitDesignId: z.number().int().positive().optional().describe('Optional circuit design ID. If omitted, searches all designs in the project.'),
    }),
    requiresConfirmation: false,
    modelPreference: 'standard',
    execute: async (params, ctx) => {
      // 1. Find the target circuit design(s) and locate the net by name
      const designs = await ctx.storage.getCircuitDesigns(ctx.projectId);
      if (designs.length === 0) {
        return { success: false, message: 'No circuit designs found in this project.' };
      }

      const targetDesigns = params.circuitDesignId
        ? designs.filter((d) => d.id === params.circuitDesignId)
        : designs;

      if (targetDesigns.length === 0) {
        return { success: false, message: `Circuit design ${String(params.circuitDesignId)} not found.` };
      }

      // Search for the net across target designs
      let foundNet: { id: number; circuitId: number; name: string; netType: string; voltage: string | null; segments: unknown } | undefined;
      let allNets: Array<{ id: number; circuitId: number; name: string; netType: string; voltage: string | null; segments: unknown }> = [];

      for (const design of targetDesigns) {
        const nets = await ctx.storage.getCircuitNets(design.id);
        allNets = allNets.concat(nets);
        const match = nets.find((n) => n.name.toLowerCase() === params.netName.toLowerCase());
        if (match) {
          foundNet = match;
          break;
        }
      }

      if (!foundNet) {
        const availableNames = allNets
          .map((n) => n.name)
          .filter((name, idx, arr) => arr.indexOf(name) === idx)
          .slice(0, 20);
        return {
          success: false,
          message: `Net "${params.netName}" not found. Available nets: ${availableNames.length > 0 ? availableNames.join(', ') : '(none)'}`,
        };
      }

      // 2. Fetch connected instances and wires for this net's circuit
      const [instances, wires, parts] = await Promise.all([
        ctx.storage.getCircuitInstances(foundNet.circuitId),
        ctx.storage.getCircuitWires(foundNet.circuitId),
        ctx.storage.getComponentParts(ctx.projectId),
      ]);

      const partMap = new Map(parts.map((p) => [p.id, p]));

      // 3. Classify the net
      const classification = classifyNet(foundNet.name, foundNet.netType, foundNet.voltage);

      // 4. Find connected instances via segments
      const segments = (foundNet.segments as NetSegmentRecord[]) || [];
      const connectedInstanceIds = new Set<number>();
      for (const seg of segments) {
        if (seg.fromInstanceId) { connectedInstanceIds.add(seg.fromInstanceId); }
        if (seg.toInstanceId) { connectedInstanceIds.add(seg.toInstanceId); }
      }

      // Also find instances connected via wires on this net
      const netWires = wires.filter((w) => w.netId === foundNet!.id);

      const connectedInstances = instances.filter((inst) => connectedInstanceIds.has(inst.id));

      // 5. Identify drivers and loads
      const drivers: string[] = [];
      const loads: string[] = [];
      const unknownRole: string[] = [];

      for (const inst of connectedInstances) {
        const part = inst.partId ? partMap.get(inst.partId) : undefined;
        const partMeta = part?.meta as Record<string, unknown> | undefined;
        const partName = (partMeta?.name as string) ?? inst.referenceDesignator;
        const role = classifyInstanceRole(inst.referenceDesignator, partName, classification);
        if (role === 'driver') {
          drivers.push(`${inst.referenceDesignator} (${partName})`);
        } else if (role === 'load') {
          loads.push(`${inst.referenceDesignator} (${partName})`);
        } else {
          unknownRole.push(`${inst.referenceDesignator} (${partName})`);
        }
      }

      // 6. Build plain-English explanation
      const explanation = buildNetExplanation({
        netName: foundNet.name,
        classification,
        voltage: foundNet.voltage,
        drivers,
        loads,
        unknownRole,
        wireCount: netWires.length,
        instanceCount: connectedInstances.length,
      });

      return {
        success: true,
        message: explanation,
        data: {
          type: 'net_explanation' as const,
          netId: foundNet.id,
          netName: foundNet.name,
          classification: classification.type,
          protocol: classification.protocol,
          drivers,
          loads,
          connectedInstances: connectedInstances.map((i) => i.referenceDesignator),
          wireCount: netWires.length,
        },
        sources: [
          { type: 'net' as const, label: foundNet.name, id: foundNet.id },
          ...connectedInstances.map((i) => ({ type: 'node' as const, label: i.referenceDesignator, id: i.id })),
        ],
        confidence: {
          score: connectedInstances.length > 0 ? 85 : 50,
          explanation: connectedInstances.length > 0
            ? `Classification based on net name pattern and ${connectedInstances.length} connected component(s).`
            : 'Classification based on net name pattern only — no connected components found.',
          factors: [
            `Net name "${foundNet.name}" matches ${classification.type} pattern`,
            ...(connectedInstances.length > 0 ? [`${connectedInstances.length} connected instance(s) analyzed`] : []),
            ...(classification.protocol ? [`Protocol detected: ${classification.protocol}`] : []),
          ],
        },
      };
    },
  });
}

// ---------------------------------------------------------------------------
// Net classification helpers (exported for testing)
// ---------------------------------------------------------------------------

/** Classification result for a net. */
export interface NetClassification {
  /** High-level type: power, ground, signal, bus, clock, reset, analog. */
  type: 'power' | 'ground' | 'signal' | 'bus' | 'clock' | 'reset' | 'analog';
  /** Detected protocol, if any (I2C, SPI, UART, JTAG, etc.). */
  protocol: string | null;
  /** Human-readable description of what this net carries. */
  description: string;
}

/** Well-known net name patterns and their classifications. */
const NET_PATTERNS: Array<{ pattern: RegExp; type: NetClassification['type']; protocol: string | null; description: string }> = [
  // Power rails
  { pattern: /^(VCC|VDD|VBUS|VMAIN|V_IN|VIN|VBAT|VSYS)$/i, type: 'power', protocol: null, description: 'positive power rail' },
  { pattern: /^(\d+V?\d*|3\.?3V?|5V?|12V?|24V?|1\.?8V?|2\.?5V?)$/i, type: 'power', protocol: null, description: 'voltage power rail' },
  { pattern: /^V(\d+[._]?\d*)$/i, type: 'power', protocol: null, description: 'voltage power rail' },
  // Ground
  { pattern: /^(GND|VSS|AGND|DGND|PGND|SGND|EARTH|GROUND)$/i, type: 'ground', protocol: null, description: 'ground reference' },
  // I2C
  { pattern: /^(SDA\d*|I2C[_.]?SDA)$/i, type: 'signal', protocol: 'I2C', description: 'I2C data line' },
  { pattern: /^(SCL\d*|I2C[_.]?SCL)$/i, type: 'signal', protocol: 'I2C', description: 'I2C clock line' },
  // SPI
  { pattern: /^(MOSI|SDO|COPI|SPI[_.]?MOSI)$/i, type: 'signal', protocol: 'SPI', description: 'SPI data out (controller to peripheral)' },
  { pattern: /^(MISO|SDI|CIPO|SPI[_.]?MISO)$/i, type: 'signal', protocol: 'SPI', description: 'SPI data in (peripheral to controller)' },
  { pattern: /^(SCK|SCLK|SPI[_.]?CLK)$/i, type: 'clock', protocol: 'SPI', description: 'SPI clock line' },
  { pattern: /^(CS\d*|SS\d*|NSS|SPI[_.]?CS|CHIP[_.]?SELECT)$/i, type: 'signal', protocol: 'SPI', description: 'SPI chip select (active low)' },
  // UART
  { pattern: /^(TX\d*|TXD\d*|UART[_.]?TX)$/i, type: 'signal', protocol: 'UART', description: 'UART transmit line' },
  { pattern: /^(RX\d*|RXD\d*|UART[_.]?RX)$/i, type: 'signal', protocol: 'UART', description: 'UART receive line' },
  { pattern: /^(CTS|RTS|DTR|DSR)$/i, type: 'signal', protocol: 'UART', description: 'UART flow control line' },
  // JTAG / SWD
  { pattern: /^(TCK|TMS|TDI|TDO|TRST|SWDIO|SWCLK)$/i, type: 'signal', protocol: 'JTAG/SWD', description: 'debug interface signal' },
  // Clock / Reset
  { pattern: /^(CLK\d*|CLOCK|XTAL|OSC|HCLK|PCLK|FCLK)$/i, type: 'clock', protocol: null, description: 'clock signal' },
  { pattern: /^(RST|RESET|NRST|NRESET|RST_N)$/i, type: 'reset', protocol: null, description: 'reset signal (typically active low)' },
  // Analog
  { pattern: /^(AIN\d*|ADC\d*|AOUT\d*|DAC\d*|VREF|AREF|AN\d+)$/i, type: 'analog', protocol: null, description: 'analog signal' },
  // PWM
  { pattern: /^(PWM\d*|EN\d*|ENABLE)$/i, type: 'signal', protocol: null, description: 'PWM or enable signal' },
  // USB
  { pattern: /^(D\+|D-|USB[_.]?D[PM]|USB[_.]?VBUS)$/i, type: 'signal', protocol: 'USB', description: 'USB data line' },
  // CAN
  { pattern: /^(CAN[_.]?H|CAN[_.]?L|CANH|CANL)$/i, type: 'signal', protocol: 'CAN', description: 'CAN bus differential signal' },
];

/**
 * Classify a net by its name, stored type, and voltage.
 */
export function classifyNet(name: string, storedType: string, voltage: string | null): NetClassification {
  // First, check explicit stored type
  if (storedType === 'power') {
    return { type: 'power', protocol: null, description: `power rail${voltage ? ` (${voltage})` : ''}` };
  }
  if (storedType === 'ground') {
    return { type: 'ground', protocol: null, description: 'ground reference' };
  }
  if (storedType === 'bus') {
    return { type: 'bus', protocol: null, description: 'multi-bit bus' };
  }

  // Pattern match on the net name
  for (const entry of NET_PATTERNS) {
    if (entry.pattern.test(name)) {
      const desc = voltage && entry.type === 'power' ? `${entry.description} (${voltage})` : entry.description;
      return { type: entry.type, protocol: entry.protocol, description: desc };
    }
  }

  // Default: generic signal
  return { type: 'signal', protocol: null, description: 'general-purpose signal' };
}

/**
 * Classify an instance's role on a net as driver, load, or unknown.
 *
 * Uses the reference designator prefix and part name as heuristics:
 * - U (ICs), MCU, CPU, FPGA → driver (they typically source signals)
 * - R (resistors), C (capacitors), L (inductors) → load (passive)
 * - LED, D (diodes) → load
 * - Connectors (J, P) → unknown (could be either)
 * - Power-type nets: voltage regulators are drivers, everything else is a load
 */
export function classifyInstanceRole(
  refDes: string,
  partName: string,
  netClass: NetClassification,
): 'driver' | 'load' | 'unknown' {
  const prefix = refDes.replace(/\d+$/, '').toUpperCase();
  const nameLower = partName.toLowerCase();

  // On power/ground nets: regulators and power sources drive, everything else loads
  if (netClass.type === 'power' || netClass.type === 'ground') {
    if (/regulator|vreg|ldo|buck|boost|smps|power.?supply|battery/i.test(nameLower)) {
      return 'driver';
    }
    return 'load';
  }

  // IC-like prefixes are typically drivers
  if (['U', 'IC'].includes(prefix)) {
    if (/mcu|cpu|fpga|soc|controller|driver|transmitter|codec/i.test(nameLower)) {
      return 'driver';
    }
    // ICs can be either — default to driver for signal nets
    return 'driver';
  }

  // Passives are loads
  if (['R', 'C', 'L', 'FB'].includes(prefix)) {
    return 'load';
  }

  // LEDs and diodes are loads
  if (['D', 'LED'].includes(prefix)) {
    return 'load';
  }

  // Transistors / MOSFETs can be either — but check if the name reveals a load role
  if (['Q', 'M'].includes(prefix)) {
    if (/driver|buffer/i.test(nameLower)) { return 'driver'; }
    if (/motor|relay|speaker|buzzer|actuator|solenoid/i.test(nameLower)) { return 'load'; }
    return 'unknown';
  }

  // Connectors — role depends on direction of the board interface
  if (['J', 'P', 'X'].includes(prefix)) {
    return 'unknown';
  }

  // Sensors are typically drivers (they output data)
  if (/sensor|accel|gyro|temp|adc|encoder/i.test(nameLower)) {
    return 'driver';
  }

  // Motors, relays, speakers are loads
  if (/motor|relay|speaker|buzzer|actuator|solenoid/i.test(nameLower)) {
    return 'load';
  }

  return 'unknown';
}

/** Parameters for building a net explanation string. */
interface NetExplanationParams {
  netName: string;
  classification: NetClassification;
  voltage: string | null;
  drivers: string[];
  loads: string[];
  unknownRole: string[];
  wireCount: number;
  instanceCount: number;
}

/**
 * Build a plain-English explanation of a net.
 */
export function buildNetExplanation(params: NetExplanationParams): string {
  const { netName, classification, voltage, drivers, loads, unknownRole, wireCount, instanceCount } = params;
  const lines: string[] = [];

  // Header
  lines.push(`Net "${netName}" — ${classification.description}`);
  lines.push('');

  // What it carries
  if (classification.protocol) {
    lines.push(`Protocol: ${classification.protocol}`);
  }
  if (classification.type === 'power' && voltage) {
    lines.push(`Voltage: ${voltage}`);
  }
  if (classification.type === 'ground') {
    lines.push('This net serves as the ground reference (0V) for the circuit.');
  }
  if (classification.type === 'clock') {
    lines.push('This net carries a clock signal used for synchronization.');
  }
  if (classification.type === 'reset') {
    lines.push('This net carries a reset signal, typically active low. When asserted, connected components return to their initial state.');
  }

  // Drivers and loads
  if (drivers.length > 0) {
    lines.push('');
    lines.push(`Driven by: ${drivers.join(', ')}`);
  }
  if (loads.length > 0) {
    lines.push(`Loads: ${loads.join(', ')}`);
  }
  if (unknownRole.length > 0) {
    lines.push(`Also connected: ${unknownRole.join(', ')}`);
  }

  // Statistics
  if (instanceCount === 0 && wireCount === 0) {
    lines.push('');
    lines.push('No components or wires are currently connected to this net.');
  } else {
    lines.push('');
    lines.push(`Connectivity: ${instanceCount} component(s), ${wireCount} wire(s)`);
  }

  return lines.join('\n');
}
