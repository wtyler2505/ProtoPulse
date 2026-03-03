/**
 * Architecture tools — node/edge management, layout, sheets, pins, clipboard.
 *
 * These tools operate on the architecture block diagram, allowing the AI to
 * add/remove/update component nodes and edges, manage multi-sheet organization,
 * perform auto-layout, insert sub-circuit templates, assign pin mappings, and
 * export architecture summaries.
 *
 * Tools that modify database state (e.g., `add_node`) execute server-side.
 * Tools that manipulate the canvas UI (e.g., `auto_layout`, `select_node`)
 * are dispatched client-side via `clientAction`.
 *
 * @module ai-tools/architecture
 */

import { z } from 'zod';
import type { ToolRegistry } from './registry';
import { clientAction } from './registry';

/**
 * Register all architecture-category tools with the given registry.
 *
 * Tools registered (22 total):
 *
 * **Node CRUD:**
 * - `add_node`         — Create a new component node (server-side, writes to DB).
 * - `remove_node`      — Delete a node and its edges (destructive, requires confirmation).
 * - `update_node`      — Update label, type, or description of an existing node.
 *
 * **Edge CRUD:**
 * - `connect_nodes`    — Create an edge between two nodes with optional bus/signal metadata.
 * - `remove_edge`      — Delete a connection (destructive, requires confirmation).
 *
 * **Bulk operations:**
 * - `clear_canvas`     — Remove all nodes and edges (destructive, requires confirmation).
 * - `generate_architecture` — Generate a complete architecture from scratch.
 *
 * **Layout:**
 * - `auto_layout`      — Reorganize nodes using hierarchical/grid/circular/force algorithms.
 * - `add_subcircuit`   — Insert a pre-wired sub-circuit template.
 *
 * **Net naming:**
 * - `assign_net_name`  — Assign a meaningful net name to an edge.
 *
 * **Multi-sheet management:**
 * - `create_sheet`     — Create a new schematic sheet.
 * - `rename_sheet`     — Rename an existing sheet.
 * - `move_to_sheet`    — Move a node to a different sheet.
 *
 * **Selection & focus:**
 * - `select_node`      — Programmatically select/highlight a node.
 * - `focus_node_in_view` — Pan and zoom to center on a node.
 *
 * **Clipboard / export:**
 * - `copy_architecture_summary` — Copy a plain-text summary to clipboard.
 * - `copy_architecture_json`    — Copy full architecture as JSON to clipboard.
 *
 * **Datasheet:**
 * - `search_datasheet` — Open a datasheet search for a component.
 *
 * **Pin-level operations:**
 * - `set_pin_map`      — Set pin assignments for a component.
 * - `auto_assign_pins` — Auto-assign optimal pin connections.
 *
 * @param registry - The ToolRegistry instance to register tools into.
 */
export function registerArchitectureTools(registry: ToolRegistry): void {
  /**
   * add_node — Create a new component node on the architecture diagram.
   *
   * Executes server-side: generates a UUID, writes to the database via
   * `storage.createNode()`, and returns the new node ID. If position is
   * omitted, a random offset from (300, 200) is used.
   */
  registry.register({
    name: 'add_node',
    description:
      'Add a new component node to the architecture diagram. Place connected nodes near each other (within 200px). Position power nodes on the left (x: 100-200), MCUs in center (x: 300-500), peripherals on right (x: 600-800).',
    category: 'architecture',
    parameters: z.object({
      nodeType: z
        .string()
        .min(1)
        .describe(
          'Component type: mcu, sensor, power, comm, connector, memory, actuator, ic, passive, module, or custom',
        ),
      label: z.string().min(1).describe('Display name for the component'),
      description: z.string().optional().describe('Brief description of the component'),
      positionX: z.number().optional().describe('X position on canvas (default: auto-placed)'),
      positionY: z.number().optional().describe('Y position on canvas (default: auto-placed)'),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      const nodeId = crypto.randomUUID();
      await ctx.storage.createNode({
        projectId: ctx.projectId,
        nodeId,
        nodeType: params.nodeType,
        label: params.label,
        positionX: params.positionX ?? 300 + Math.random() * 200,
        positionY: params.positionY ?? 200 + Math.random() * 200,
        data: params.description ? { description: params.description } : null,
      });
      return {
        success: true,
        message: `Added ${params.nodeType} node "${params.label}" (id: ${nodeId})`,
      };
    },
  });

  /**
   * remove_node — Remove a component node and all its connected edges.
   *
   * Dispatched client-side. Requires user confirmation (`requiresConfirmation: true`)
   * because the operation is destructive and cannot be undone.
   */
  registry.register({
    name: 'remove_node',
    description:
      'Remove a component node from the architecture diagram by its label. Also removes all connected edges.',
    category: 'architecture',
    parameters: z.object({
      nodeLabel: z.string().min(1).describe('The label of the node to remove'),
    }),
    requiresConfirmation: true,
    execute: async (params) => clientAction('remove_node', params),
  });

  /**
   * update_node — Update properties of an existing architecture node.
   *
   * Dispatched client-side. Only the specified fields are changed; omitted
   * fields retain their current values.
   */
  registry.register({
    name: 'update_node',
    description: 'Update properties of an existing architecture node. Specify only the fields to change.',
    category: 'architecture',
    parameters: z.object({
      nodeLabel: z.string().min(1).describe('Current label of the node to update'),
      newLabel: z.string().optional().describe('New display name'),
      newType: z.string().optional().describe('New component type'),
      newDescription: z.string().optional().describe('New description'),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction('update_node', params),
  });

  /**
   * connect_nodes — Create a connection (edge) between two architecture nodes.
   *
   * Dispatched client-side. Supports optional bus type (SPI, I2C, UART, etc.),
   * signal metadata (voltage, bus width), and net naming.
   */
  registry.register({
    name: 'connect_nodes',
    description:
      'Create a connection (edge) between two architecture nodes. Optionally specify bus type, signal metadata, and net name.',
    category: 'architecture',
    parameters: z.object({
      sourceLabel: z.string().min(1).describe('Label of the source node'),
      targetLabel: z.string().min(1).describe('Label of the target node'),
      edgeLabel: z.string().optional().describe('Display label for the connection'),
      busType: z.string().optional().describe('Bus protocol: SPI, I2C, UART, USB, Power, GPIO, CAN, Ethernet'),
      signalType: z.string().optional().describe('Signal type: SPI, analog, digital, power, etc.'),
      voltage: z.string().optional().describe('Voltage level: 3.3V, 5V, 12V, etc.'),
      busWidth: z.string().optional().describe('Bus width: 4-bit, 8-bit, etc.'),
      netName: z.string().optional().describe('Net name for the connection'),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction('connect_nodes', params),
  });

  /**
   * remove_edge — Remove a connection between two architecture nodes.
   *
   * Dispatched client-side. Requires user confirmation because the operation
   * is destructive.
   */
  registry.register({
    name: 'remove_edge',
    description: 'Remove a connection between two architecture nodes.',
    category: 'architecture',
    parameters: z.object({
      sourceLabel: z.string().min(1).describe('Label of the source node'),
      targetLabel: z.string().min(1).describe('Label of the target node'),
    }),
    requiresConfirmation: true,
    execute: async (params) => clientAction('remove_edge', params),
  });

  registry.register({
    name: 'clear_canvas',
    description: 'Remove ALL nodes and edges from the architecture diagram. This is destructive and cannot be undone.',
    category: 'architecture',
    parameters: z.object({}),
    requiresConfirmation: true,
    execute: async (params) => clientAction('clear_canvas', params),
  });

  registry.register({
    name: 'generate_architecture',
    description:
      'Generate a complete architecture diagram, replacing the current one. Use this to create entire system designs from scratch. Lay out components logically: power on the left, MCU in center, peripherals around it.',
    category: 'architecture',
    parameters: z.object({
      components: z
        .array(
          z.object({
            label: z.string().min(1),
            nodeType: z.string().min(1),
            description: z.string(),
            positionX: z.number(),
            positionY: z.number(),
          }),
        )
        .describe('Array of components to create'),
      connections: z
        .array(
          z.object({
            sourceLabel: z.string().min(1),
            targetLabel: z.string().min(1),
            label: z.string(),
            busType: z.string().optional(),
          }),
        )
        .describe('Array of connections between components'),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction('generate_architecture', params),
  });

  registry.register({
    name: 'auto_layout',
    description: 'Reorganize all nodes on the canvas using the specified layout algorithm.',
    category: 'architecture',
    parameters: z.object({
      layout: z
        .enum(['hierarchical', 'grid', 'circular', 'force'])
        .describe(
          'Layout algorithm: hierarchical for trees, grid for uniform, circular for rings, force for organic',
        ),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction('auto_layout', params),
  });

  registry.register({
    name: 'add_subcircuit',
    description:
      'Insert a pre-wired sub-circuit template (e.g., LDO power supply, USB interface, SPI flash) at the specified position.',
    category: 'architecture',
    parameters: z.object({
      template: z
        .enum([
          'power_supply_ldo',
          'usb_interface',
          'spi_flash',
          'i2c_sensors',
          'uart_debug',
          'battery_charger',
          'motor_driver',
          'led_driver',
          'adc_frontend',
          'dac_output',
        ])
        .describe('Sub-circuit template to insert'),
      positionX: z.number().optional().describe('X position (default: center)'),
      positionY: z.number().optional().describe('Y position (default: center)'),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction('add_subcircuit', params),
  });

  registry.register({
    name: 'assign_net_name',
    description: 'Assign a meaningful net name to an existing connection between two nodes.',
    category: 'architecture',
    parameters: z.object({
      sourceLabel: z.string().min(1).describe('Source node label'),
      targetLabel: z.string().min(1).describe('Target node label'),
      netName: z.string().min(1).describe('Net name to assign (e.g., VCC, GND, MOSI)'),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction('assign_net_name', params),
  });

  // Multi-sheet management
  registry.register({
    name: 'create_sheet',
    description: 'Create a new schematic sheet for organizing the design into logical sections.',
    category: 'architecture',
    parameters: z.object({
      name: z.string().min(1).describe('Sheet name (e.g., Power_Supply.sch, RF_Frontend.sch)'),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction('create_sheet', params),
  });

  registry.register({
    name: 'rename_sheet',
    description: 'Rename an existing schematic sheet.',
    category: 'architecture',
    parameters: z.object({
      sheetId: z.string().min(1).describe('ID of the sheet to rename'),
      newName: z.string().min(1).describe('New name for the sheet'),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction('rename_sheet', params),
  });

  registry.register({
    name: 'move_to_sheet',
    description: 'Move a component to a different schematic sheet for organization.',
    category: 'architecture',
    parameters: z.object({
      nodeLabel: z.string().min(1).describe('Label of the node to move'),
      sheetId: z.string().min(1).describe('ID of the destination sheet'),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction('move_to_sheet', params),
  });

  // Selection & focus
  registry.register({
    name: 'select_node',
    description:
      'Programmatically select an architecture node in the diagram, highlighting it for the user.',
    category: 'architecture',
    parameters: z.object({
      nodeLabel: z.string().min(1).describe('Label of the node to select'),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction('select_node', params),
  });

  registry.register({
    name: 'focus_node_in_view',
    description: 'Pan and zoom the architecture diagram to center on a specific node.',
    category: 'architecture',
    parameters: z.object({
      nodeLabel: z.string().min(1).describe('Label of the node to focus on'),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction('focus_node_in_view', params),
  });

  // Clipboard / export helpers
  registry.register({
    name: 'copy_architecture_summary',
    description:
      'Generate a plain-text summary of the current architecture (all nodes, connections, and key metadata) and copy it to the clipboard.',
    category: 'architecture',
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (params) => clientAction('copy_architecture_summary', params),
  });

  registry.register({
    name: 'copy_architecture_json',
    description:
      'Export the full architecture (nodes, edges, metadata) as structured JSON and copy it to the clipboard.',
    category: 'architecture',
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (params) => clientAction('copy_architecture_json', params),
  });

  // Datasheet search
  registry.register({
    name: 'search_datasheet',
    description: 'Open a datasheet search for a specific component. Searches by part number or component name.',
    category: 'architecture',
    parameters: z.object({
      query: z.string().min(1).describe('Part number, component name, or search query for the datasheet'),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction('search_datasheet', params),
  });

  // Pin-level operations
  registry.register({
    name: 'set_pin_map',
    description: 'Set pin assignments for a component (e.g., MOSI -> GPIO23, SCK -> GPIO18).',
    category: 'architecture',
    parameters: z.object({
      nodeLabel: z.string().min(1).describe('Label of the component'),
      pins: z.record(z.string()).describe('Map of pin names to connected signals'),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction('set_pin_map', params),
  });

  registry.register({
    name: 'auto_assign_pins',
    description:
      'Auto-assign optimal pin connections based on the component datasheet and existing connections.',
    category: 'architecture',
    parameters: z.object({
      nodeLabel: z.string().min(1).describe('Label of the component to auto-assign pins for'),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction('auto_assign_pins', params),
  });
}
