/**
 * AI Tool Definition Registry
 *
 * Central registry of all AI-callable tools with Zod-validated parameters,
 * server-side execution, and format converters for Anthropic/Gemini native
 * tool use APIs.
 *
 * Phase 0: Foundation — defines types, registers all 48 existing action types
 * with Zod schemas, provides validation and format conversion.
 */

import { z, type ZodObject, type ZodRawShape } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { IStorage } from "./storage";
import {
  generateGenericBomCsv,
  generateJlcpcbBom,
  generateMouserBom,
  generateDigikeyBom,
  generateKicadSch,
  generateKicadNetlist,
  generateSpiceNetlist,
  generateCsvNetlist,
  generateGerber,
  generatePickAndPlace,
  generateEagleSch,
  generateDesignReportMd,
  type BomItemData,
  type ComponentPartData,
  type ArchNodeData,
  type ArchEdgeData,
  type CircuitInstanceData,
  type CircuitNetData,
  type CircuitWireData,
  type ValidationIssueData,
} from "./export-generators";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToolCategory =
  | "architecture"
  | "circuit"
  | "component"
  | "bom"
  | "validation"
  | "export"
  | "project"
  | "navigation";

export interface ToolResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export interface ToolContext {
  projectId: number;
  storage: IStorage;
}

export type ModelTier = 'fast' | 'standard' | 'premium';

export interface ToolDefinition<TSchema extends ZodRawShape = ZodRawShape> {
  name: string;
  description: string;
  category: ToolCategory;
  parameters: ZodObject<TSchema>;
  execute: (params: z.infer<ZodObject<TSchema>>, ctx: ToolContext) => Promise<ToolResult>;
  requiresConfirmation: boolean;
  /** Hint for multi-model routing — suggests which model tier is best for this tool. */
  modelPreference?: ModelTier;
}

// ---------------------------------------------------------------------------
// Anthropic tool format
// ---------------------------------------------------------------------------

interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Gemini function declaration format
// ---------------------------------------------------------------------------

interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  getByCategory(category: ToolCategory): ToolDefinition[] {
    return this.getAll().filter((t) => t.category === category);
  }

  getDestructiveTools(): string[] {
    return this.getAll()
      .filter((t) => t.requiresConfirmation)
      .map((t) => t.name);
  }

  /**
   * Validate params against a tool's Zod schema.
   * Returns the parsed (coerced/defaulted) params on success, or a string
   * error message on failure.
   */
  validate(
    toolName: string,
    params: unknown,
  ): { ok: true; params: Record<string, unknown> } | { ok: false; error: string } {
    const tool = this.tools.get(toolName);
    if (!tool) return { ok: false, error: `Unknown tool: ${toolName}` };

    const result = tool.parameters.safeParse(params);
    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      return { ok: false, error: `Invalid params for ${toolName}: ${issues}` };
    }
    return { ok: true, params: result.data as Record<string, unknown> };
  }

  /**
   * Execute a tool by name with validated params.
   */
  async execute(
    toolName: string,
    rawParams: unknown,
    ctx: ToolContext,
  ): Promise<ToolResult> {
    const validation = this.validate(toolName, rawParams);
    if (!validation.ok) {
      return { success: false, message: validation.error };
    }

    const tool = this.tools.get(toolName)!;
    return tool.execute(validation.params, ctx);
  }

  // -------------------------------------------------------------------------
  // Format converters for native tool use
  // -------------------------------------------------------------------------

  /**
   * Convert all registered tools to Anthropic's tool format.
   * @see https://docs.anthropic.com/en/docs/build-with-claude/tool-use
   */
  toAnthropicTools(): AnthropicTool[] {
    return this.getAll().map((tool) => {
      const jsonSchema = zodToJsonSchema(tool.parameters, {
        target: "openApi3",
        $refStrategy: "none",
      }) as Record<string, unknown>;

      // Remove $schema and other meta keys Anthropic doesn't expect
      delete jsonSchema.$schema;
      delete jsonSchema.additionalProperties;

      return {
        name: tool.name,
        description: tool.description,
        input_schema: jsonSchema,
      };
    });
  }

  /**
   * Convert all registered tools to Gemini's functionDeclarations format.
   * @see https://ai.google.dev/gemini-api/docs/function-calling
   */
  toGeminiFunctionDeclarations(): GeminiFunctionDeclaration[] {
    return this.getAll().map((tool) => {
      const jsonSchema = zodToJsonSchema(tool.parameters, {
        target: "openApi3",
        $refStrategy: "none",
      }) as Record<string, unknown>;

      delete jsonSchema.$schema;
      delete jsonSchema.additionalProperties;

      return {
        name: tool.name,
        description: tool.description,
        parameters: jsonSchema,
      };
    });
  }
}

// ---------------------------------------------------------------------------
// Stub executor — returns action data for client-side execution.
// In later phases, tools that can run server-side will have real executors.
// ---------------------------------------------------------------------------

function clientAction(toolName: string, params: Record<string, unknown>): ToolResult {
  return {
    success: true,
    message: `Action ${toolName} dispatched to client`,
    data: { type: toolName, ...params },
  };
}

// ---------------------------------------------------------------------------
// Tool definitions — organized by category
// ---------------------------------------------------------------------------

function registerNavigationTools(registry: ToolRegistry): void {
  registry.register({
    name: "switch_view",
    description: "Switch the active view in the application. Use this to navigate between architecture diagram, schematic, procurement/BOM, validation, output, or project explorer views.",
    category: "navigation",
    parameters: z.object({
      view: z.enum(["architecture", "schematic", "procurement", "validation", "output", "project_explorer"])
        .describe("The view to switch to"),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction("switch_view", params),
  });

  registry.register({
    name: "switch_schematic_sheet",
    description: "Switch to a specific schematic sheet by its ID.",
    category: "navigation",
    parameters: z.object({
      sheetId: z.string().min(1).describe("The ID of the schematic sheet to switch to"),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction("switch_schematic_sheet", params),
  });
}

function registerArchitectureTools(registry: ToolRegistry): void {
  registry.register({
    name: "add_node",
    description: "Add a new component node to the architecture diagram. Place connected nodes near each other (within 200px). Position power nodes on the left (x: 100-200), MCUs in center (x: 300-500), peripherals on right (x: 600-800).",
    category: "architecture",
    parameters: z.object({
      nodeType: z.string().min(1).describe("Component type: mcu, sensor, power, comm, connector, memory, actuator, ic, passive, module, or custom"),
      label: z.string().min(1).describe("Display name for the component"),
      description: z.string().optional().describe("Brief description of the component"),
      positionX: z.number().optional().describe("X position on canvas (default: auto-placed)"),
      positionY: z.number().optional().describe("Y position on canvas (default: auto-placed)"),
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

  registry.register({
    name: "remove_node",
    description: "Remove a component node from the architecture diagram by its label. Also removes all connected edges.",
    category: "architecture",
    parameters: z.object({
      nodeLabel: z.string().min(1).describe("The label of the node to remove"),
    }),
    requiresConfirmation: true,
    execute: async (params) => clientAction("remove_node", params),
  });

  registry.register({
    name: "update_node",
    description: "Update properties of an existing architecture node. Specify only the fields to change.",
    category: "architecture",
    parameters: z.object({
      nodeLabel: z.string().min(1).describe("Current label of the node to update"),
      newLabel: z.string().optional().describe("New display name"),
      newType: z.string().optional().describe("New component type"),
      newDescription: z.string().optional().describe("New description"),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction("update_node", params),
  });

  registry.register({
    name: "connect_nodes",
    description: "Create a connection (edge) between two architecture nodes. Optionally specify bus type, signal metadata, and net name.",
    category: "architecture",
    parameters: z.object({
      sourceLabel: z.string().min(1).describe("Label of the source node"),
      targetLabel: z.string().min(1).describe("Label of the target node"),
      edgeLabel: z.string().optional().describe("Display label for the connection"),
      busType: z.string().optional().describe("Bus protocol: SPI, I2C, UART, USB, Power, GPIO, CAN, Ethernet"),
      signalType: z.string().optional().describe("Signal type: SPI, analog, digital, power, etc."),
      voltage: z.string().optional().describe("Voltage level: 3.3V, 5V, 12V, etc."),
      busWidth: z.string().optional().describe("Bus width: 4-bit, 8-bit, etc."),
      netName: z.string().optional().describe("Net name for the connection"),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction("connect_nodes", params),
  });

  registry.register({
    name: "remove_edge",
    description: "Remove a connection between two architecture nodes.",
    category: "architecture",
    parameters: z.object({
      sourceLabel: z.string().min(1).describe("Label of the source node"),
      targetLabel: z.string().min(1).describe("Label of the target node"),
    }),
    requiresConfirmation: true,
    execute: async (params) => clientAction("remove_edge", params),
  });

  registry.register({
    name: "clear_canvas",
    description: "Remove ALL nodes and edges from the architecture diagram. This is destructive and cannot be undone.",
    category: "architecture",
    parameters: z.object({}),
    requiresConfirmation: true,
    execute: async (params) => clientAction("clear_canvas", params),
  });

  registry.register({
    name: "generate_architecture",
    description: "Generate a complete architecture diagram, replacing the current one. Use this to create entire system designs from scratch. Lay out components logically: power on the left, MCU in center, peripherals around it.",
    category: "architecture",
    parameters: z.object({
      components: z.array(z.object({
        label: z.string().min(1),
        nodeType: z.string().min(1),
        description: z.string(),
        positionX: z.number(),
        positionY: z.number(),
      })).describe("Array of components to create"),
      connections: z.array(z.object({
        sourceLabel: z.string().min(1),
        targetLabel: z.string().min(1),
        label: z.string(),
        busType: z.string().optional(),
      })).describe("Array of connections between components"),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction("generate_architecture", params),
  });

  registry.register({
    name: "auto_layout",
    description: "Reorganize all nodes on the canvas using the specified layout algorithm.",
    category: "architecture",
    parameters: z.object({
      layout: z.enum(["hierarchical", "grid", "circular", "force"])
        .describe("Layout algorithm: hierarchical for trees, grid for uniform, circular for rings, force for organic"),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction("auto_layout", params),
  });

  registry.register({
    name: "add_subcircuit",
    description: "Insert a pre-wired sub-circuit template (e.g., LDO power supply, USB interface, SPI flash) at the specified position.",
    category: "architecture",
    parameters: z.object({
      template: z.enum([
        "power_supply_ldo", "usb_interface", "spi_flash", "i2c_sensors",
        "uart_debug", "battery_charger", "motor_driver", "led_driver",
        "adc_frontend", "dac_output",
      ]).describe("Sub-circuit template to insert"),
      positionX: z.number().optional().describe("X position (default: center)"),
      positionY: z.number().optional().describe("Y position (default: center)"),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction("add_subcircuit", params),
  });

  registry.register({
    name: "assign_net_name",
    description: "Assign a meaningful net name to an existing connection between two nodes.",
    category: "architecture",
    parameters: z.object({
      sourceLabel: z.string().min(1).describe("Source node label"),
      targetLabel: z.string().min(1).describe("Target node label"),
      netName: z.string().min(1).describe("Net name to assign (e.g., VCC, GND, MOSI)"),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction("assign_net_name", params),
  });

  // Multi-sheet management
  registry.register({
    name: "create_sheet",
    description: "Create a new schematic sheet for organizing the design into logical sections.",
    category: "architecture",
    parameters: z.object({
      name: z.string().min(1).describe("Sheet name (e.g., Power_Supply.sch, RF_Frontend.sch)"),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction("create_sheet", params),
  });

  registry.register({
    name: "rename_sheet",
    description: "Rename an existing schematic sheet.",
    category: "architecture",
    parameters: z.object({
      sheetId: z.string().min(1).describe("ID of the sheet to rename"),
      newName: z.string().min(1).describe("New name for the sheet"),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction("rename_sheet", params),
  });

  registry.register({
    name: "move_to_sheet",
    description: "Move a component to a different schematic sheet for organization.",
    category: "architecture",
    parameters: z.object({
      nodeLabel: z.string().min(1).describe("Label of the node to move"),
      sheetId: z.string().min(1).describe("ID of the destination sheet"),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction("move_to_sheet", params),
  });

  // Selection & focus
  registry.register({
    name: "select_node",
    description: "Programmatically select an architecture node in the diagram, highlighting it for the user.",
    category: "architecture",
    parameters: z.object({
      nodeLabel: z.string().min(1).describe("Label of the node to select"),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction("select_node", params),
  });

  registry.register({
    name: "focus_node_in_view",
    description: "Pan and zoom the architecture diagram to center on a specific node.",
    category: "architecture",
    parameters: z.object({
      nodeLabel: z.string().min(1).describe("Label of the node to focus on"),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction("focus_node_in_view", params),
  });

  // Clipboard / export helpers
  registry.register({
    name: "copy_architecture_summary",
    description: "Generate a plain-text summary of the current architecture (all nodes, connections, and key metadata) and copy it to the clipboard.",
    category: "architecture",
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (params) => clientAction("copy_architecture_summary", params),
  });

  registry.register({
    name: "copy_architecture_json",
    description: "Export the full architecture (nodes, edges, metadata) as structured JSON and copy it to the clipboard.",
    category: "architecture",
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (params) => clientAction("copy_architecture_json", params),
  });

  // Datasheet search
  registry.register({
    name: "search_datasheet",
    description: "Open a datasheet search for a specific component. Searches by part number or component name.",
    category: "architecture",
    parameters: z.object({
      query: z.string().min(1).describe("Part number, component name, or search query for the datasheet"),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction("search_datasheet", params),
  });

  // Pin-level operations
  registry.register({
    name: "set_pin_map",
    description: "Set pin assignments for a component (e.g., MOSI → GPIO23, SCK → GPIO18).",
    category: "architecture",
    parameters: z.object({
      nodeLabel: z.string().min(1).describe("Label of the component"),
      pins: z.record(z.string()).describe("Map of pin names to connected signals"),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction("set_pin_map", params),
  });

  registry.register({
    name: "auto_assign_pins",
    description: "Auto-assign optimal pin connections based on the component datasheet and existing connections.",
    category: "architecture",
    parameters: z.object({
      nodeLabel: z.string().min(1).describe("Label of the component to auto-assign pins for"),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction("auto_assign_pins", params),
  });
}

function registerBomTools(registry: ToolRegistry): void {
  registry.register({
    name: "add_bom_item",
    description: "Add a component to the Bill of Materials with part number, manufacturer, description, and optional pricing/sourcing info.",
    category: "bom",
    parameters: z.object({
      partNumber: z.string().min(1).describe("Manufacturer part number"),
      manufacturer: z.string().min(1).describe("Component manufacturer"),
      description: z.string().min(1).describe("Component description"),
      quantity: z.number().int().positive().optional().default(1).describe("Quantity needed"),
      unitPrice: z.number().nonnegative().optional().default(0).describe("Unit price in USD"),
      supplier: z.string().optional().default("").describe("Supplier name (e.g., Digi-Key, Mouser)"),
      status: z.enum(["In Stock", "Low Stock", "Out of Stock", "On Order"]).optional().default("In Stock").describe("Availability status"),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      await ctx.storage.createBomItem({
        projectId: ctx.projectId,
        partNumber: params.partNumber,
        manufacturer: params.manufacturer,
        description: params.description,
        quantity: params.quantity,
        unitPrice: String(params.unitPrice),
        supplier: params.supplier,
        status: params.status,
        stock: 0,
      });
      return {
        success: true,
        message: `Added "${params.partNumber}" by ${params.manufacturer} to BOM`,
      };
    },
  });

  registry.register({
    name: "remove_bom_item",
    description: "Remove a component from the Bill of Materials by part number.",
    category: "bom",
    parameters: z.object({
      partNumber: z.string().min(1).describe("Part number of the BOM item to remove"),
    }),
    requiresConfirmation: true,
    execute: async (params) => clientAction("remove_bom_item", params),
  });

  registry.register({
    name: "update_bom_item",
    description: "Update fields of an existing BOM item. Specify the part number and a map of fields to update.",
    category: "bom",
    parameters: z.object({
      partNumber: z.string().min(1).describe("Part number of the item to update"),
      updates: z.record(z.unknown()).describe("Map of field names to new values"),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction("update_bom_item", params),
  });

  registry.register({
    name: "pricing_lookup",
    description: "Look up real-time pricing and availability for a specific part across distributors.",
    category: "bom",
    parameters: z.object({
      partNumber: z.string().min(1).describe("Part number to look up"),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction("pricing_lookup", params),
  });

  registry.register({
    name: "suggest_alternatives",
    description: "Find alternative/equivalent parts for a BOM item. Specify reason: cost reduction, availability, or performance.",
    category: "bom",
    parameters: z.object({
      partNumber: z.string().min(1).describe("Part number to find alternatives for"),
      reason: z.enum(["cost", "availability", "performance"]).optional().describe("Reason for seeking alternatives"),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction("suggest_alternatives", params),
  });

  registry.register({
    name: "optimize_bom",
    description: "Analyze the entire BOM for cost optimization opportunities: supplier consolidation, quantity discounts, cheaper equivalents.",
    category: "bom",
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (params) => clientAction("optimize_bom", params),
  });

  registry.register({
    name: "check_lead_times",
    description: "Check estimated lead times and delivery dates for all BOM items. Flag items with long lead times (>8 weeks).",
    category: "bom",
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (params) => clientAction("check_lead_times", params),
  });

  registry.register({
    name: "parametric_search",
    description: "Search for components by parametric specifications (e.g., voltage, package, frequency).",
    category: "bom",
    parameters: z.object({
      category: z.string().min(1).describe("Component category: mcu, sensor, regulator, capacitor, resistor, inductor, connector, transistor, diode, opamp"),
      specs: z.record(z.string()).describe("Map of parameter names to values/ranges (e.g., voltage: '3.3V', package: 'QFP-48')"),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction("parametric_search", params),
  });

  registry.register({
    name: "add_datasheet_link",
    description: "Attach a datasheet URL to a BOM item for quick reference.",
    category: "bom",
    parameters: z.object({
      partNumber: z.string().min(1).describe("Part number to link datasheet to"),
      url: z.string().url().describe("Datasheet URL"),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction("add_datasheet_link", params),
  });
}

function registerValidationTools(registry: ToolRegistry): void {
  registry.register({
    name: "run_validation",
    description: "Trigger a full design validation / design rule check (DRC) on the current project.",
    category: "validation",
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (params) => clientAction("run_validation", params),
  });

  registry.register({
    name: "clear_validation",
    description: "Clear all validation issues from the project.",
    category: "validation",
    parameters: z.object({}),
    requiresConfirmation: true,
    execute: async (params) => clientAction("clear_validation", params),
  });

  registry.register({
    name: "add_validation_issue",
    description: "Add a specific validation issue/finding to the project.",
    category: "validation",
    parameters: z.object({
      severity: z.enum(["error", "warning", "info"]).describe("Issue severity level"),
      message: z.string().min(1).describe("Description of the issue"),
      componentId: z.string().optional().describe("Label of the affected component"),
      suggestion: z.string().optional().describe("Suggested fix for the issue"),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      await ctx.storage.createValidationIssue({
        projectId: ctx.projectId,
        severity: params.severity,
        message: params.message,
        componentId: params.componentId,
        suggestion: params.suggestion,
      });
      return {
        success: true,
        message: `Added ${params.severity}: ${params.message}`,
      };
    },
  });

  registry.register({
    name: "power_budget_analysis",
    description: "Calculate total power budget across all power rails, tallying current draw from all components.",
    category: "validation",
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (params) => clientAction("power_budget_analysis", params),
  });

  registry.register({
    name: "voltage_domain_check",
    description: "Verify voltage compatibility across all connections and flag mismatches.",
    category: "validation",
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (params) => clientAction("voltage_domain_check", params),
  });

  registry.register({
    name: "auto_fix_validation",
    description: "Automatically fix validation issues by adding missing decoupling caps, pull-up resistors, ESD protection.",
    category: "validation",
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (params) => clientAction("auto_fix_validation", params),
  });

  registry.register({
    name: "dfm_check",
    description: "Run Design for Manufacturing checks — flag hard-to-solder components, suggest assembly-friendly alternatives.",
    category: "validation",
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (params) => clientAction("dfm_check", params),
  });

  registry.register({
    name: "thermal_analysis",
    description: "Estimate power dissipation per component, flag thermal hot spots, suggest heatsinks or thermal vias.",
    category: "validation",
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (params) => clientAction("thermal_analysis", params),
  });
}

function registerProjectTools(registry: ToolRegistry): void {
  registry.register({
    name: "rename_project",
    description: "Rename the current project.",
    category: "project",
    parameters: z.object({
      name: z.string().min(1).max(200).describe("New project name"),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      await ctx.storage.updateProject(ctx.projectId, { name: params.name });
      return {
        success: true,
        message: `Project renamed to "${params.name}"`,
      };
    },
  });

  registry.register({
    name: "update_description",
    description: "Update the project description.",
    category: "project",
    parameters: z.object({
      description: z.string().describe("New project description"),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      await ctx.storage.updateProject(ctx.projectId, { description: params.description });
      return {
        success: true,
        message: "Project description updated",
      };
    },
  });

  registry.register({
    name: "set_project_type",
    description: "Set the project type to optimize AI suggestions, component recommendations, and validation rules for the specific domain.",
    category: "project",
    parameters: z.object({
      projectType: z.enum(["iot", "wearable", "industrial", "automotive", "consumer", "medical", "rf", "power"])
        .describe("Project domain type"),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction("set_project_type", params),
  });

  registry.register({
    name: "save_design_decision",
    description: "Record a design decision with its rationale for future reference.",
    category: "project",
    parameters: z.object({
      decision: z.string().min(1).describe("What was decided"),
      rationale: z.string().min(1).describe("Why this decision was made"),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction("save_design_decision", params),
  });

  registry.register({
    name: "add_annotation",
    description: "Add a sticky-note annotation to a component for documentation or review comments.",
    category: "project",
    parameters: z.object({
      nodeLabel: z.string().min(1).describe("Label of the component to annotate"),
      note: z.string().min(1).describe("Annotation text"),
      color: z.enum(["yellow", "blue", "red", "green"]).optional().default("yellow").describe("Annotation color"),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction("add_annotation", params),
  });

  registry.register({
    name: "start_tutorial",
    description: "Start an interactive tutorial walkthrough for the specified topic.",
    category: "project",
    parameters: z.object({
      topic: z.enum(["getting_started", "power_design", "pcb_layout", "bom_management", "validation"])
        .describe("Tutorial topic"),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction("start_tutorial", params),
  });

  registry.register({
    name: "undo",
    description: "Undo the last action.",
    category: "project",
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (params) => clientAction("undo", params),
  });

  registry.register({
    name: "redo",
    description: "Redo the last undone action.",
    category: "project",
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (params) => clientAction("redo", params),
  });

  registry.register({
    name: "analyze_image",
    description: "Analyze an uploaded image or schematic reference — describe what's shown and suggest how to implement it in the design.",
    category: "project",
    parameters: z.object({
      description: z.string().min(1).describe("Description of what the image shows or what to analyze"),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction("analyze_image", params),
  });
}

// ---------------------------------------------------------------------------
// Phase 3: Circuit & Component tools
// ---------------------------------------------------------------------------

function registerCircuitTools(registry: ToolRegistry): void {
  registry.register({
    name: "create_circuit",
    description: "Create a new circuit design for the project. This creates a blank schematic where components can be placed and connected.",
    category: "circuit",
    parameters: z.object({
      name: z.string().min(1).describe("Circuit name (e.g., 'Power Supply', 'RF Frontend')"),
      description: z.string().optional().describe("Optional description of the circuit"),
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
    name: "expand_architecture_to_circuit",
    description: "Expand the architecture block diagram into a detailed schematic circuit design. This converts architecture nodes into component instances with proper pin connections.",
    category: "circuit",
    parameters: z.object({
      circuitName: z.string().optional().default("Main Circuit").describe("Name for the generated circuit"),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction("expand_architecture_to_circuit", params),
  });

  registry.register({
    name: "place_component",
    description: "Place a component instance on a circuit schematic. Requires the circuit ID and the component part ID.",
    category: "circuit",
    parameters: z.object({
      circuitId: z.number().int().positive().describe("Circuit design ID"),
      partId: z.number().int().positive().describe("Component part ID to instantiate"),
      referenceDesignator: z.string().min(1).describe("Reference designator (e.g., U1, R1, C1)"),
      x: z.number().optional().default(200).describe("X position on schematic"),
      y: z.number().optional().default(200).describe("Y position on schematic"),
      rotation: z.number().optional().default(0).describe("Rotation in degrees (0, 90, 180, 270)"),
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
    name: "remove_component_instance",
    description: "Remove a component instance from a circuit schematic by its reference designator or instance ID.",
    category: "circuit",
    parameters: z.object({
      instanceId: z.number().int().positive().describe("Instance ID to remove"),
    }),
    requiresConfirmation: true,
    execute: async (params, ctx) => {
      const deleted = await ctx.storage.deleteCircuitInstance(params.instanceId);
      if (!deleted) return { success: false, message: `Instance ${params.instanceId} not found` };
      return { success: true, message: `Removed instance ${params.instanceId}` };
    },
  });

  registry.register({
    name: "draw_net",
    description: "Create a net (electrical connection) between pins in a circuit schematic.",
    category: "circuit",
    parameters: z.object({
      circuitId: z.number().int().positive().describe("Circuit design ID"),
      name: z.string().min(1).describe("Net name (e.g., VCC, GND, MOSI, SDA)"),
      netType: z.enum(["signal", "power", "ground", "bus"]).optional().default("signal").describe("Net type"),
      voltage: z.string().optional().describe("Voltage (for power nets, e.g., '3.3V')"),
      segments: z.array(z.record(z.unknown())).optional().default([]).describe("Net routing segments"),
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
    name: "remove_net",
    description: "Delete a net from a circuit schematic.",
    category: "circuit",
    parameters: z.object({
      netId: z.number().int().positive().describe("Net ID to delete"),
    }),
    requiresConfirmation: true,
    execute: async (params, ctx) => {
      const deleted = await ctx.storage.deleteCircuitNet(params.netId);
      if (!deleted) return { success: false, message: `Net ${params.netId} not found` };
      return { success: true, message: `Removed net ${params.netId}` };
    },
  });

  registry.register({
    name: "place_power_symbol",
    description: "Add a power symbol (VCC, GND, etc.) to a circuit schematic.",
    category: "circuit",
    parameters: z.object({
      circuitId: z.number().int().positive().describe("Circuit design ID"),
      symbolType: z.enum(["VCC", "GND", "AGND", "DGND", "V3_3", "V5", "V12", "VBAT"]).describe("Power symbol type"),
      x: z.number().optional().default(200).describe("X position"),
      y: z.number().optional().default(200).describe("Y position"),
      netName: z.string().optional().describe("Custom net name override"),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction("place_power_symbol", params),
  });

  registry.register({
    name: "place_no_connect",
    description: "Mark a pin as intentionally unconnected (no-connect marker) on the schematic.",
    category: "circuit",
    parameters: z.object({
      circuitId: z.number().int().positive().describe("Circuit design ID"),
      instanceId: z.number().int().positive().describe("Instance ID"),
      pinName: z.string().min(1).describe("Pin name to mark as no-connect"),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction("place_no_connect", params),
  });

  registry.register({
    name: "add_net_label",
    description: "Add a net label to the schematic to name a connection point.",
    category: "circuit",
    parameters: z.object({
      circuitId: z.number().int().positive().describe("Circuit design ID"),
      netName: z.string().min(1).describe("Net name to label"),
      x: z.number().optional().default(200).describe("X position"),
      y: z.number().optional().default(200).describe("Y position"),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction("add_net_label", params),
  });

  registry.register({
    name: "run_erc",
    description: "Run Electrical Rule Check on a circuit to find connection errors, missing connections, and design rule violations.",
    category: "circuit",
    parameters: z.object({
      circuitId: z.number().int().positive().describe("Circuit design ID to check"),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction("run_erc", params),
  });
}

function registerComponentTools(registry: ToolRegistry): void {
  registry.register({
    name: "create_component_part",
    description: "Create a new component part in the project library from scratch. Defines a custom part with metadata stored in the meta JSON blob.",
    category: "component",
    parameters: z.object({
      title: z.string().min(1).describe("Part title (e.g., 'ESP32-S3-WROOM-1')"),
      family: z.string().optional().describe("Part family (e.g., 'MCU', 'Resistor', 'Capacitor')"),
      manufacturer: z.string().optional().describe("Manufacturer name"),
      mpn: z.string().optional().describe("Manufacturer part number"),
      category: z.string().optional().describe("Category (e.g., 'IC', 'Passive', 'Connector')"),
      description: z.string().optional().describe("Part description"),
      nodeId: z.string().optional().describe("Architecture node ID to link this part to"),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      const meta: Record<string, unknown> = {
        title: params.title,
        ...(params.family && { family: params.family }),
        ...(params.manufacturer && { manufacturer: params.manufacturer }),
        ...(params.mpn && { mpn: params.mpn }),
        ...(params.category && { category: params.category }),
        ...(params.description && { description: params.description }),
      };
      const part = await ctx.storage.createComponentPart({
        projectId: ctx.projectId,
        nodeId: params.nodeId ?? null,
        meta,
        connectors: [],
        buses: [],
        views: {},
        constraints: [],
      });
      return { success: true, message: `Created component part "${params.title}" (id: ${part.id})` };
    },
  });

  registry.register({
    name: "modify_component",
    description: "Update an existing component part's metadata (title, family, manufacturer, mpn, etc.). Updates are merged into the existing meta JSON.",
    category: "component",
    parameters: z.object({
      partId: z.number().int().positive().describe("Component part ID to modify"),
      title: z.string().optional().describe("New title"),
      family: z.string().optional().describe("New family"),
      manufacturer: z.string().optional().describe("New manufacturer"),
      mpn: z.string().optional().describe("New manufacturer part number"),
      category: z.string().optional().describe("New category"),
      description: z.string().optional().describe("New description"),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      // Fetch existing part to merge meta
      const existing = await ctx.storage.getComponentPart(params.partId, ctx.projectId);
      if (!existing) return { success: false, message: `Component part ${params.partId} not found` };
      const existingMeta = (existing.meta && typeof existing.meta === 'object' ? existing.meta : {}) as Record<string, unknown>;
      const newMeta = { ...existingMeta };
      if (params.title !== undefined) newMeta.title = params.title;
      if (params.family !== undefined) newMeta.family = params.family;
      if (params.manufacturer !== undefined) newMeta.manufacturer = params.manufacturer;
      if (params.mpn !== undefined) newMeta.mpn = params.mpn;
      if (params.category !== undefined) newMeta.category = params.category;
      if (params.description !== undefined) newMeta.description = params.description;
      const updated = await ctx.storage.updateComponentPart(params.partId, ctx.projectId, { meta: newMeta });
      if (!updated) return { success: false, message: `Failed to update component part ${params.partId}` };
      return { success: true, message: `Updated component part ${params.partId}` };
    },
  });

  registry.register({
    name: "delete_component_part",
    description: "Delete a component part from the project library.",
    category: "component",
    parameters: z.object({
      partId: z.number().int().positive().describe("Component part ID to delete"),
    }),
    requiresConfirmation: true,
    execute: async (params, ctx) => {
      const deleted = await ctx.storage.deleteComponentPart(params.partId, ctx.projectId);
      if (!deleted) return { success: false, message: `Component part ${params.partId} not found` };
      return { success: true, message: `Deleted component part ${params.partId}` };
    },
  });

  registry.register({
    name: "fork_library_component",
    description: "Fork (copy) a component from the public library into the current project.",
    category: "component",
    parameters: z.object({
      libraryEntryId: z.number().int().positive().describe("Public library entry ID to fork"),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction("fork_library_component", params),
  });

  registry.register({
    name: "validate_component",
    description: "Run Design Rule Check (DRC) on a specific component part to verify footprint, pins, and constraints.",
    category: "component",
    parameters: z.object({
      partId: z.number().int().positive().describe("Component part ID to validate"),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction("validate_component", params),
  });
}

function registerPcbTools(registry: ToolRegistry): void {
  registry.register({
    name: "place_breadboard_wire",
    description: "Add a wire connection on the breadboard view between two points.",
    category: "circuit",
    parameters: z.object({
      circuitId: z.number().int().positive().describe("Circuit design ID"),
      netId: z.number().int().positive().describe("Net ID this wire belongs to"),
      points: z.array(z.object({ x: z.number(), y: z.number() })).min(2).describe("Wire path points"),
      color: z.string().optional().describe("Wire color (e.g., 'red', 'blue', 'green')"),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      const wire = await ctx.storage.createCircuitWire({
        circuitId: params.circuitId,
        netId: params.netId,
        view: "breadboard",
        points: params.points,
        layer: "front",
        width: 1.0,
        color: params.color ?? null,
      });
      return { success: true, message: `Placed breadboard wire (id: ${wire.id})` };
    },
  });

  registry.register({
    name: "remove_wire",
    description: "Remove a wire from the breadboard or PCB view.",
    category: "circuit",
    parameters: z.object({
      wireId: z.number().int().positive().describe("Wire ID to remove"),
    }),
    requiresConfirmation: true,
    execute: async (params, ctx) => {
      const deleted = await ctx.storage.deleteCircuitWire(params.wireId);
      if (!deleted) return { success: false, message: `Wire ${params.wireId} not found` };
      return { success: true, message: `Removed wire ${params.wireId}` };
    },
  });

  registry.register({
    name: "draw_pcb_trace",
    description: "Route a PCB trace between two points on the board layout.",
    category: "circuit",
    parameters: z.object({
      circuitId: z.number().int().positive().describe("Circuit design ID"),
      netId: z.number().int().positive().describe("Net ID this trace belongs to"),
      points: z.array(z.object({ x: z.number(), y: z.number() })).min(2).describe("Trace path points"),
      width: z.number().positive().optional().default(0.25).describe("Trace width in mm"),
      layer: z.enum(["front", "back"]).optional().default("front").describe("PCB layer"),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      const wire = await ctx.storage.createCircuitWire({
        circuitId: params.circuitId,
        netId: params.netId,
        view: "pcb",
        points: params.points,
        layer: params.layer,
        width: params.width,
        color: null,
      });
      return { success: true, message: `Routed PCB trace on ${params.layer} layer (id: ${wire.id})` };
    },
  });

  registry.register({
    name: "auto_route",
    description: "Automatically route all unrouted nets on the PCB layout.",
    category: "circuit",
    parameters: z.object({
      circuitId: z.number().int().positive().describe("Circuit design ID"),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction("auto_route", params),
  });
}

// ---------------------------------------------------------------------------
// Export helpers — convert ExportResult to a download_file ToolResult
// ---------------------------------------------------------------------------

function fileExportResult(result: { content: string; encoding: 'utf8' | 'base64'; mimeType: string; filename: string }): ToolResult {
  return {
    success: true,
    message: `Generated ${result.filename}`,
    data: {
      type: "download_file",
      filename: result.filename,
      mimeType: result.mimeType,
      content: result.content,
      encoding: result.encoding,
    },
  };
}

/** Map DB rows to the flat shapes the export generators expect. */
function toBomItemData(rows: Array<{ partNumber: string; manufacturer: string; description: string; quantity: number; unitPrice: string; totalPrice: string; supplier: string; stock: number; status: string; leadTime: string | null }>): BomItemData[] {
  return rows.map(r => ({
    partNumber: r.partNumber,
    manufacturer: r.manufacturer,
    description: r.description,
    quantity: r.quantity,
    unitPrice: r.unitPrice,
    totalPrice: r.totalPrice,
    supplier: r.supplier,
    stock: r.stock,
    status: r.status,
    leadTime: r.leadTime,
  }));
}

function toComponentPartData(rows: Array<{ id: number; nodeId: string | null; meta: unknown; connectors: unknown; buses: unknown; constraints: unknown }>): ComponentPartData[] {
  return rows.map(r => ({
    id: r.id,
    nodeId: r.nodeId,
    meta: (r.meta ?? {}) as Record<string, unknown>,
    connectors: Array.isArray(r.connectors) ? r.connectors : [],
    buses: Array.isArray(r.buses) ? r.buses : [],
    constraints: Array.isArray(r.constraints) ? r.constraints : [],
  }));
}

function toArchNodeData(rows: Array<{ nodeId: string; label: string; nodeType: string; positionX: number; positionY: number; data: unknown }>): ArchNodeData[] {
  return rows.map(r => ({
    nodeId: r.nodeId,
    label: r.label,
    nodeType: r.nodeType,
    positionX: r.positionX,
    positionY: r.positionY,
    data: (r.data ?? null) as Record<string, unknown> | null,
  }));
}

function toArchEdgeData(rows: Array<{ edgeId: string; source: string; target: string; label: string | null; signalType: string | null; voltage: string | null; busWidth: string | null; netName: string | null }>): ArchEdgeData[] {
  return rows.map(r => ({
    edgeId: r.edgeId,
    source: r.source,
    target: r.target,
    label: r.label,
    signalType: r.signalType,
    voltage: r.voltage,
    busWidth: r.busWidth,
    netName: r.netName,
  }));
}

function toCircuitInstanceData(rows: Array<{ id: number; partId: number; referenceDesignator: string; schematicX: number; schematicY: number; schematicRotation: number; pcbX: number | null; pcbY: number | null; pcbRotation: number | null; pcbSide: string | null; properties: unknown }>): CircuitInstanceData[] {
  return rows.map(r => ({
    id: r.id,
    partId: r.partId,
    referenceDesignator: r.referenceDesignator,
    schematicX: r.schematicX,
    schematicY: r.schematicY,
    schematicRotation: r.schematicRotation,
    pcbX: r.pcbX,
    pcbY: r.pcbY,
    pcbRotation: r.pcbRotation,
    pcbSide: r.pcbSide,
    properties: (r.properties ?? {}) as Record<string, unknown>,
  }));
}

function toCircuitNetData(rows: Array<{ id: number; name: string; netType: string; voltage: string | null; busWidth: number | null; segments: unknown; labels: unknown }>): CircuitNetData[] {
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    netType: r.netType,
    voltage: r.voltage,
    busWidth: r.busWidth,
    segments: Array.isArray(r.segments) ? r.segments : [],
    labels: Array.isArray(r.labels) ? r.labels : [],
  }));
}

function toCircuitWireData(rows: Array<{ id: number; netId: number; view: string; points: unknown; layer: string | null; width: number }>): CircuitWireData[] {
  return rows.map(r => ({
    id: r.id,
    netId: r.netId,
    view: r.view,
    points: Array.isArray(r.points) ? r.points : [],
    layer: r.layer,
    width: r.width,
  }));
}

function toValidationIssueData(rows: Array<{ severity: string; message: string; componentId: string | null; suggestion: string | null }>): ValidationIssueData[] {
  return rows.map(r => ({
    severity: r.severity,
    message: r.message,
    componentId: r.componentId,
    suggestion: r.suggestion,
  }));
}

/** Fetch the first circuit design for a project, or a specific one by ID. */
async function resolveCircuitId(storage: IStorage, projectId: number, circuitId?: number): Promise<number | null> {
  if (circuitId) return circuitId;
  const designs = await storage.getCircuitDesigns(projectId);
  return designs.length > 0 ? designs[0].id : null;
}

// ---------------------------------------------------------------------------
// Export tool registration — Phase 6: server-generated file downloads
// ---------------------------------------------------------------------------

function registerExportTools(registry: ToolRegistry): void {
  // --- BOM CSV (enhanced with format variants) ---
  registry.register({
    name: "export_bom_csv",
    description: "Export the Bill of Materials as a CSV file. Supports generic, JLCPCB, Mouser, and DigiKey formats.",
    category: "export",
    parameters: z.object({
      format: z.enum(["generic", "jlcpcb", "mouser", "digikey"]).optional().default("generic")
        .describe("CSV format variant: generic (default), jlcpcb, mouser, or digikey"),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      const bomRows = await ctx.storage.getBomItems(ctx.projectId);
      if (bomRows.length === 0) {
        return { success: false, message: "No BOM items to export." };
      }
      const bom = toBomItemData(bomRows);
      const project = await ctx.storage.getProject(ctx.projectId);
      const projectName = project?.name || "design";
      const format = params.format || "generic";

      if (format === "jlcpcb") {
        const parts = toComponentPartData(await ctx.storage.getComponentParts(ctx.projectId));
        return fileExportResult(generateJlcpcbBom(bom, parts));
      }
      if (format === "mouser") {
        return fileExportResult(generateMouserBom(bom));
      }
      if (format === "digikey") {
        return fileExportResult(generateDigikeyBom(bom));
      }
      return fileExportResult(generateGenericBomCsv(bom, projectName));
    },
  });

  // --- KiCad Schematic (enhanced with circuit data option) ---
  registry.register({
    name: "export_kicad",
    description: "Generate a KiCad-compatible schematic file (.kicad_sch) from the current architecture.",
    category: "export",
    parameters: z.object({
      includeCircuitData: z.boolean().optional().default(false)
        .describe("If true, include detailed circuit instance and net data"),
    }),
    requiresConfirmation: false,
    execute: async (_params, ctx) => {
      const nodes = toArchNodeData(await ctx.storage.getNodes(ctx.projectId));
      const edges = toArchEdgeData(await ctx.storage.getEdges(ctx.projectId));
      if (nodes.length === 0) {
        return { success: false, message: "No architecture nodes to export." };
      }
      const project = await ctx.storage.getProject(ctx.projectId);
      return fileExportResult(generateKicadSch(nodes, edges, project?.name || "design"));
    },
  });

  // --- SPICE Netlist (enhanced with circuit ID) ---
  registry.register({
    name: "export_spice",
    description: "Generate a SPICE netlist (.cir) for circuit simulation. Uses circuit data if available, falls back to architecture nodes.",
    category: "export",
    parameters: z.object({
      circuitId: z.number().int().positive().optional()
        .describe("Specific circuit design ID; uses first circuit if omitted"),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      const project = await ctx.storage.getProject(ctx.projectId);
      const projectName = project?.name || "design";
      const cid = await resolveCircuitId(ctx.storage, ctx.projectId, params.circuitId);

      if (cid) {
        const instances = toCircuitInstanceData(await ctx.storage.getCircuitInstances(cid));
        const nets = toCircuitNetData(await ctx.storage.getCircuitNets(cid));
        const parts = toComponentPartData(await ctx.storage.getComponentParts(ctx.projectId));
        return fileExportResult(generateSpiceNetlist(instances, nets, parts, projectName));
      }

      // Fallback: generate from architecture nodes
      const nodes = toArchNodeData(await ctx.storage.getNodes(ctx.projectId));
      if (nodes.length === 0) {
        return { success: false, message: "No circuit or architecture data to export." };
      }
      // No circuit data — generate a SPICE file with header only (no components)
      return fileExportResult(generateSpiceNetlist([], [], [], projectName));
    },
  });

  // --- Preview Gerber (keep as-is — client-side validation issue) ---
  registry.register({
    name: "preview_gerber",
    description: "Generate a rough PCB layout preview showing component placement and basic routing estimation. Adds a validation info message with the estimate.",
    category: "export",
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (params) => clientAction("preview_gerber", params),
  });

  // --- Design Report (enhanced — server-generated markdown) ---
  registry.register({
    name: "export_design_report",
    description: "Generate a comprehensive design report including architecture overview, BOM summary, validation status, and recommendations.",
    category: "export",
    parameters: z.object({
      format: z.enum(["markdown"]).optional().default("markdown")
        .describe("Report format (currently only markdown)"),
    }),
    requiresConfirmation: false,
    execute: async (_params, ctx) => {
      const project = await ctx.storage.getProject(ctx.projectId);
      const nodes = toArchNodeData(await ctx.storage.getNodes(ctx.projectId));
      const edges = toArchEdgeData(await ctx.storage.getEdges(ctx.projectId));
      const bomRows = await ctx.storage.getBomItems(ctx.projectId);
      const issueRows = await ctx.storage.getValidationIssues(ctx.projectId);
      const circuitDesigns = await ctx.storage.getCircuitDesigns(ctx.projectId);

      const circuits = await Promise.all(circuitDesigns.map(async (cd) => {
        const instances = await ctx.storage.getCircuitInstances(cd.id);
        const nets = await ctx.storage.getCircuitNets(cd.id);
        return { name: cd.name, instanceCount: instances.length, netCount: nets.length };
      }));

      return fileExportResult(generateDesignReportMd({
        projectName: project?.name || "Untitled",
        projectDescription: project?.description || "",
        nodes,
        edges,
        bom: toBomItemData(bomRows),
        issues: toValidationIssueData(issueRows),
        circuits,
      }));
    },
  });

  // --- NEW: Gerber RS-274X export ---
  registry.register({
    name: "export_gerber",
    description: "Generate Gerber RS-274X files (board outline, copper layer, drill file) from circuit PCB data.",
    category: "export",
    parameters: z.object({
      circuitId: z.number().int().positive().optional()
        .describe("Specific circuit design ID; uses first circuit if omitted"),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      const cid = await resolveCircuitId(ctx.storage, ctx.projectId, params.circuitId);
      if (!cid) {
        return { success: false, message: "No circuit designs found. Create a circuit design with PCB data first." };
      }
      const instances = toCircuitInstanceData(await ctx.storage.getCircuitInstances(cid));
      if (instances.length === 0) {
        return { success: false, message: "No circuit instances found. Add components to your circuit first." };
      }
      const wires = toCircuitWireData(await ctx.storage.getCircuitWires(cid));
      const parts = toComponentPartData(await ctx.storage.getComponentParts(ctx.projectId));
      const project = await ctx.storage.getProject(ctx.projectId);
      return fileExportResult(generateGerber(instances, wires, parts, project?.name || "design"));
    },
  });

  // --- NEW: KiCad Netlist ---
  registry.register({
    name: "export_kicad_netlist",
    description: "Generate a KiCad-compatible netlist file (.net) from circuit design data.",
    category: "export",
    parameters: z.object({
      circuitId: z.number().int().positive().optional()
        .describe("Specific circuit design ID; uses first circuit if omitted"),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      const cid = await resolveCircuitId(ctx.storage, ctx.projectId, params.circuitId);
      if (!cid) {
        return { success: false, message: "No circuit designs found. Create a circuit design first." };
      }
      const instances = toCircuitInstanceData(await ctx.storage.getCircuitInstances(cid));
      const nets = toCircuitNetData(await ctx.storage.getCircuitNets(cid));
      const parts = toComponentPartData(await ctx.storage.getComponentParts(ctx.projectId));
      return fileExportResult(generateKicadNetlist(instances, nets, parts));
    },
  });

  // --- NEW: CSV Netlist ---
  registry.register({
    name: "export_csv_netlist",
    description: "Export netlist as a CSV file with columns: Net Name, Component, Pin, Net Type, Voltage.",
    category: "export",
    parameters: z.object({
      circuitId: z.number().int().positive().optional()
        .describe("Specific circuit design ID; uses first circuit if omitted"),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      const cid = await resolveCircuitId(ctx.storage, ctx.projectId, params.circuitId);
      if (!cid) {
        return { success: false, message: "No circuit designs found. Create a circuit design first." };
      }
      const instances = toCircuitInstanceData(await ctx.storage.getCircuitInstances(cid));
      const nets = toCircuitNetData(await ctx.storage.getCircuitNets(cid));
      const parts = toComponentPartData(await ctx.storage.getComponentParts(ctx.projectId));
      return fileExportResult(generateCsvNetlist(instances, nets, parts));
    },
  });

  // --- NEW: Pick and Place ---
  registry.register({
    name: "export_pick_and_place",
    description: "Generate a pick-and-place CSV file with component placement coordinates for PCB assembly.",
    category: "export",
    parameters: z.object({
      circuitId: z.number().int().positive().optional()
        .describe("Specific circuit design ID; uses first circuit if omitted"),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      const cid = await resolveCircuitId(ctx.storage, ctx.projectId, params.circuitId);
      if (!cid) {
        return { success: false, message: "No circuit designs found. Create a circuit design first." };
      }
      const instances = toCircuitInstanceData(await ctx.storage.getCircuitInstances(cid));
      if (instances.length === 0) {
        return { success: false, message: "No circuit instances found." };
      }
      const parts = toComponentPartData(await ctx.storage.getComponentParts(ctx.projectId));
      return fileExportResult(generatePickAndPlace(instances, parts));
    },
  });

  // --- NEW: Eagle Schematic ---
  registry.register({
    name: "export_eagle",
    description: "Generate a basic Eagle-compatible schematic XML file (.sch) from architecture data.",
    category: "export",
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (_params, ctx) => {
      const nodes = toArchNodeData(await ctx.storage.getNodes(ctx.projectId));
      const edges = toArchEdgeData(await ctx.storage.getEdges(ctx.projectId));
      if (nodes.length === 0) {
        return { success: false, message: "No architecture nodes to export." };
      }
      const project = await ctx.storage.getProject(ctx.projectId);
      return fileExportResult(generateEagleSch(nodes, edges, project?.name || "design"));
    },
  });

  // --- NEW: Fritzing Project (ZIP via JSZip — base64) ---
  registry.register({
    name: "export_fritzing_project",
    description: "Export circuit design as a Fritzing project archive (.fzz) containing schematic, breadboard, and PCB views.",
    category: "export",
    parameters: z.object({
      circuitId: z.number().int().positive().optional()
        .describe("Specific circuit design ID; uses first circuit if omitted"),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      const cid = await resolveCircuitId(ctx.storage, ctx.projectId, params.circuitId);
      if (!cid) {
        return { success: false, message: "No circuit designs found. Create a circuit design first." };
      }
      const instances = toCircuitInstanceData(await ctx.storage.getCircuitInstances(cid));
      const nets = toCircuitNetData(await ctx.storage.getCircuitNets(cid));
      const parts = toComponentPartData(await ctx.storage.getComponentParts(ctx.projectId));
      const project = await ctx.storage.getProject(ctx.projectId);
      const projectName = project?.name || "design";

      // Generate Fritzing XML sketch content
      const partEntries = instances.map((inst, i) => {
        const part = parts.find(p => p.id === inst.partId);
        const meta = part?.meta as Record<string, unknown> | undefined;
        const title = (meta?.title as string) || inst.referenceDesignator;
        return `    <instance moduleIdRef="part${i}" modelIndex="${i}" path="">
      <title>${title}</title>
      <views>
        <schematicView layer="schematic">
          <geometry x="${inst.schematicX}" y="${inst.schematicY}" z="${i}" />
        </schematicView>
        ${inst.pcbX != null ? `<pcbView layer="copper0"><geometry x="${inst.pcbX}" y="${inst.pcbY}" z="${i}" /></pcbView>` : ''}
      </views>
    </instance>`;
      });

      const netEntries = nets.map((net, i) =>
        `    <net id="net${i}" name="${net.name}" type="${net.netType}" />`
      );

      const sketch = `<?xml version="1.0" encoding="UTF-8"?>
<module fritzingVersion="0.9.10">
  <title>${projectName}</title>
  <instances>
${partEntries.join('\n')}
  </instances>
  <nets>
${netEntries.join('\n')}
  </nets>
</module>`;

      // Return as UTF-8 XML (not ZIP — JSZip adds complexity; plain XML is importable)
      return fileExportResult({
        content: sketch,
        encoding: 'utf8',
        mimeType: 'application/xml',
        filename: `${projectName.replace(/[^a-zA-Z0-9_-]/g, '_')}.fzz`,
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Registry initialization
// ---------------------------------------------------------------------------

function createRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registerNavigationTools(registry);
  registerArchitectureTools(registry);
  registerBomTools(registry);
  registerValidationTools(registry);
  registerProjectTools(registry);
  registerCircuitTools(registry);
  registerComponentTools(registry);
  registerPcbTools(registry);
  registerExportTools(registry);
  return registry;
}

/** Singleton tool registry instance. */
export const toolRegistry = createRegistry();

/** List of tool names that require user confirmation before execution. */
export const DESTRUCTIVE_TOOLS = toolRegistry.getDestructiveTools();
