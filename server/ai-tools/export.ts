/**
 * Export tools — BOM CSV, KiCad, SPICE, Gerber, Eagle, Fritzing, design report.
 *
 * Provides AI tools for exporting project data in industry-standard EDA formats:
 * BOM CSV (generic, JLCPCB, Mouser, DigiKey), KiCad schematic and netlist,
 * SPICE netlist, Gerber RS-274X, Eagle schematic XML, Fritzing project,
 * CSV netlist, pick-and-place, design report, and Gerber preview.
 *
 * Also contains data-mapping helpers that convert database rows (with their
 * ORM-specific shapes) into the flat data-transfer objects expected by the
 * export generator modules in `server/export/`.
 *
 * All export tools execute server-side, reading project data from storage and
 * generating file content. The exception is `preview_gerber`, which is
 * dispatched client-side via {@link clientAction}.
 *
 * @module ai-tools/export
 */

import { z } from 'zod';
import type { ToolRegistry } from './registry';
import { clientAction } from './registry';
import type { ToolResult } from './types';
import type { IStorage } from '../storage';
import {
  generateGenericBomCsv,
  generateJlcpcbBom,
  generateMouserBom,
  generateDigikeyBom,
} from '../export/bom-exporter';
import { generateKicadSch, generateKicadNetlist } from '../export/kicad-exporter';
import { generateSpiceNetlist } from '../export/spice-exporter';
import { generateLegacyCsvNetlist as generateCsvNetlist } from '../export/netlist-generator';
import { generateLegacyGerber as generateGerber } from '../export/gerber-generator';
import { generateLegacyPickAndPlace as generatePickAndPlace } from '../export/pick-place-generator';
import { generateEagleSch } from '../export/eagle-exporter';
import { generateDesignReportMd } from '../export/design-report';
import { generateFritzingProject } from '../export/fritzing-exporter';
import { generateTinkercadProject } from '../export/tinkercad-exporter';
import { exportBomToSheet, exportDesignReportToDoc, exportProjectToDrive } from '../google-workspace';
import type {
  BomItemData,
  ComponentPartData,
  ArchNodeData,
  ArchEdgeData,
  CircuitInstanceData,
  CircuitNetData,
  CircuitWireData,
  ValidationIssueData,
} from '../export/types';

// ---------------------------------------------------------------------------
// Export helpers — convert ExportResult to a download_file ToolResult
// ---------------------------------------------------------------------------

/**
 * Wrap a generated file's content into a standardized {@link ToolResult} with
 * a `download_file` data payload.
 *
 * The client action executor interprets `data.type === 'download_file'` to
 * trigger a browser file download with the given filename and MIME type.
 *
 * @param result - The generated export output containing file content, encoding,
 *                 MIME type, and filename.
 * @returns A successful {@link ToolResult} with `data.type` set to `'download_file'`.
 */
function fileExportResult(result: {
  content: string;
  encoding: 'utf8' | 'base64';
  mimeType: string;
  filename: string;
}): ToolResult {
  return {
    success: true,
    message: `Generated ${result.filename}`,
    data: {
      type: 'download_file',
      filename: result.filename,
      mimeType: result.mimeType,
      content: result.content,
      encoding: result.encoding,
    },
  };
}

// ---------------------------------------------------------------------------
// Data mappers — convert DB rows to flat export shapes
//
// These pure functions transform ORM result rows (which may contain extra
// columns, null-able JSON blobs, etc.) into the strict flat shapes defined
// in `server/export/types.ts`. This decouples the export generators from
// the database layer.
// ---------------------------------------------------------------------------

/**
 * Convert BOM item database rows to the flat {@link BomItemData} shape
 * expected by the BOM CSV export generators.
 *
 * @param rows - Array of BOM item rows from `storage.getBomItems()`.
 * @returns Array of {@link BomItemData} objects with only the fields needed for export.
 */
function toBomItemData(
  rows: Array<{
    partNumber: string;
    manufacturer: string;
    description: string;
    quantity: number;
    unitPrice: string;
    totalPrice: string;
    supplier: string;
    stock: number;
    status: string;
    leadTime: string | null;
  }>,
): BomItemData[] {
  return rows.map((r) => ({
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

/**
 * Convert component part database rows to the flat {@link ComponentPartData} shape.
 *
 * Safely coerces `meta` from `unknown` to `Record<string, unknown>` (defaulting
 * to `{}`), and ensures `connectors`, `buses`, and `constraints` are arrays.
 *
 * @param rows - Array of component part rows from `storage.getComponentParts()`.
 * @returns Array of {@link ComponentPartData} objects.
 */
function toComponentPartData(
  rows: Array<{
    id: number;
    nodeId: string | null;
    meta: unknown;
    connectors: unknown;
    buses: unknown;
    constraints: unknown;
  }>,
): ComponentPartData[] {
  return rows.map((r) => ({
    id: r.id,
    nodeId: r.nodeId,
    meta: (r.meta ?? {}) as Record<string, unknown>,
    connectors: Array.isArray(r.connectors) ? r.connectors : [],
    buses: Array.isArray(r.buses) ? r.buses : [],
    constraints: Array.isArray(r.constraints) ? r.constraints : [],
  }));
}

/**
 * Convert architecture node database rows to the flat {@link ArchNodeData} shape.
 *
 * Safely coerces the `data` JSON blob from `unknown` to `Record<string, unknown> | null`.
 *
 * @param rows - Array of architecture node rows from `storage.getNodes()`.
 * @returns Array of {@link ArchNodeData} objects.
 */
function toArchNodeData(
  rows: Array<{
    nodeId: string;
    label: string;
    nodeType: string;
    positionX: number;
    positionY: number;
    data: unknown;
  }>,
): ArchNodeData[] {
  return rows.map((r) => ({
    nodeId: r.nodeId,
    label: r.label,
    nodeType: r.nodeType,
    positionX: r.positionX,
    positionY: r.positionY,
    data: (r.data ?? null) as Record<string, unknown> | null,
  }));
}

/**
 * Convert architecture edge database rows to the flat {@link ArchEdgeData} shape.
 *
 * @param rows - Array of architecture edge rows from `storage.getEdges()`.
 * @returns Array of {@link ArchEdgeData} objects with source, target, label, and signal metadata.
 */
function toArchEdgeData(
  rows: Array<{
    edgeId: string;
    source: string;
    target: string;
    label: string | null;
    signalType: string | null;
    voltage: string | null;
    busWidth: number | null;
    netName: string | null;
  }>,
): ArchEdgeData[] {
  return rows.map((r) => ({
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

/**
 * Convert circuit instance database rows to the flat {@link CircuitInstanceData} shape.
 *
 * Safely coerces the `properties` JSON blob from `unknown` to `Record<string, unknown>`.
 * Preserves nullable PCB placement fields (`pcbX`, `pcbY`, `pcbRotation`, `pcbSide`).
 *
 * @param rows - Array of circuit instance rows from `storage.getCircuitInstances()`.
 * @returns Array of {@link CircuitInstanceData} objects.
 */
function toCircuitInstanceData(
  rows: Array<{
    id: number;
    partId: number | null;
    referenceDesignator: string;
    schematicX: number;
    schematicY: number;
    schematicRotation: number;
    pcbX: number | null;
    pcbY: number | null;
    pcbRotation: number | null;
    pcbSide: string | null;
    properties: unknown;
  }>,
): CircuitInstanceData[] {
  return rows.map((r) => ({
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

/**
 * Convert circuit net database rows to the flat {@link CircuitNetData} shape.
 *
 * Ensures `segments` and `labels` are arrays even if the DB stores them as
 * null or a non-array JSON value.
 *
 * @param rows - Array of circuit net rows from `storage.getCircuitNets()`.
 * @returns Array of {@link CircuitNetData} objects.
 */
function toCircuitNetData(
  rows: Array<{
    id: number;
    name: string;
    netType: string;
    voltage: string | null;
    busWidth: number | null;
    segments: unknown;
    labels: unknown;
  }>,
): CircuitNetData[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    netType: r.netType,
    voltage: r.voltage,
    busWidth: r.busWidth,
    segments: Array.isArray(r.segments) ? r.segments : [],
    labels: Array.isArray(r.labels) ? r.labels : [],
  }));
}

/**
 * Convert circuit wire database rows to the flat {@link CircuitWireData} shape.
 *
 * Ensures `points` is an array even if the DB stores it as null or a non-array
 * JSON value.
 *
 * @param rows - Array of circuit wire rows from `storage.getCircuitWires()`.
 * @returns Array of {@link CircuitWireData} objects.
 */
function toCircuitWireData(
  rows: Array<{
    id: number;
    netId: number;
    view: string;
    points: unknown;
    layer: string | null;
    width: number;
  }>,
): CircuitWireData[] {
  return rows.map((r) => ({
    id: r.id,
    netId: r.netId,
    view: r.view,
    points: Array.isArray(r.points) ? r.points : [],
    layer: r.layer,
    width: r.width,
  }));
}

/**
 * Convert validation issue database rows to the flat {@link ValidationIssueData} shape.
 *
 * @param rows - Array of validation issue rows from `storage.getValidationIssues()`.
 * @returns Array of {@link ValidationIssueData} objects.
 */
function toValidationIssueData(
  rows: Array<{
    severity: string;
    message: string;
    componentId: string | null;
    suggestion: string | null;
  }>,
): ValidationIssueData[] {
  return rows.map((r) => ({
    severity: r.severity,
    message: r.message,
    componentId: r.componentId,
    suggestion: r.suggestion,
  }));
}

/**
 * Resolve a circuit design ID for export operations.
 *
 * If an explicit `circuitId` is provided, returns it directly. Otherwise,
 * queries `storage.getCircuitDesigns()` and returns the first circuit's ID,
 * or `null` if the project has no circuit designs.
 *
 * @param storage   - The storage layer to query for circuit designs.
 * @param projectId - The project ID to look up circuit designs for.
 * @param circuitId - Optional explicit circuit design ID to use.
 * @returns The resolved circuit ID, or `null` if no circuits exist.
 */
async function resolveCircuitId(
  storage: IStorage,
  projectId: number,
  circuitId?: number,
): Promise<number | null> {
  if (circuitId) {
    return circuitId;
  }
  const designs = await storage.getCircuitDesigns(projectId);
  return designs.length > 0 ? designs[0].id : null;
}

// ---------------------------------------------------------------------------
// Export tool registration
// ---------------------------------------------------------------------------

/**
 * Register all export-category tools with the given registry.
 *
 * Tools registered (12 total):
 *
 * **BOM export:**
 * - `export_bom_csv`          — Export BOM as CSV (generic, JLCPCB, Mouser, DigiKey formats).
 *
 * **Schematic export:**
 * - `export_kicad`            — Generate KiCad-compatible schematic (.kicad_sch).
 * - `export_eagle`            — Generate Eagle-compatible schematic XML (.sch).
 * - `export_fritzing_project` — Export as Fritzing project (.fzz).
 *
 * **Netlist export:**
 * - `export_spice`            — Generate SPICE netlist (.cir).
 * - `export_kicad_netlist`    — Generate KiCad netlist (.net).
 * - `export_csv_netlist`      — Export netlist as CSV.
 *
 * **PCB fabrication:**
 * - `export_gerber`           — Generate Gerber RS-274X files.
 * - `export_pick_and_place`   — Generate pick-and-place CSV for PCB assembly.
 * - `preview_gerber`          — Generate rough PCB layout preview (client-side).
 *
 * **Reporting:**
 * - `export_design_report`    — Generate comprehensive design report (markdown).
 *
 * @param registry - The {@link ToolRegistry} instance to register tools into.
 */
export function registerExportTools(registry: ToolRegistry): void {
  /**
   * export_bom_csv — Export the Bill of Materials as a CSV file.
   *
   * Executes server-side: fetches BOM items, selects the appropriate format
   * generator (generic, JLCPCB, Mouser, or DigiKey), and returns a downloadable
   * CSV file. JLCPCB format also fetches component parts for LCSC part numbers.
   *
   * @side-effect Reads from `bom_items`, `projects`, and optionally `component_parts` tables.
   */
  registry.register({
    name: 'export_bom_csv',
    description:
      'Export the Bill of Materials as a CSV file. Supports generic, JLCPCB, Mouser, and DigiKey formats.',
    category: 'export',
    parameters: z.object({
      format: z
        .enum(['generic', 'jlcpcb', 'mouser', 'digikey'])
        .optional()
        .default('generic')
        .describe('CSV format variant: generic (default), jlcpcb, mouser, or digikey'),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      const bomRows = await ctx.storage.getBomItems(ctx.projectId);
      if (bomRows.length === 0) {
        return { success: false, message: 'No BOM items to export.' };
      }
      const bom = toBomItemData(bomRows);
      const project = await ctx.storage.getProject(ctx.projectId);
      const projectName = project?.name || 'design';
      const format = params.format || 'generic';

      if (format === 'jlcpcb') {
        const parts = toComponentPartData(await ctx.storage.getComponentParts(ctx.projectId));
        return fileExportResult(generateJlcpcbBom(bom, parts));
      }
      if (format === 'mouser') {
        return fileExportResult(generateMouserBom(bom));
      }
      if (format === 'digikey') {
        return fileExportResult(generateDigikeyBom(bom));
      }
      return fileExportResult(generateGenericBomCsv(bom, projectName));
    },
  });

  /**
   * export_kicad — Generate a KiCad-compatible schematic file (.kicad_sch).
   *
   * Executes server-side: fetches architecture nodes and edges, then generates
   * a KiCad S-expression schematic file via `generateKicadSch()`.
   *
   * @side-effect Reads from `architecture_nodes`, `architecture_edges`, and `projects` tables.
   */
  registry.register({
    name: 'export_kicad',
    description:
      'Generate a KiCad-compatible schematic file (.kicad_sch) from the current architecture.',
    category: 'export',
    parameters: z.object({
      includeCircuitData: z
        .boolean()
        .optional()
        .default(false)
        .describe('If true, include detailed circuit instance and net data'),
    }),
    requiresConfirmation: false,
    execute: async (_params, ctx) => {
      const nodes = toArchNodeData(await ctx.storage.getNodes(ctx.projectId));
      const edges = toArchEdgeData(await ctx.storage.getEdges(ctx.projectId));
      if (nodes.length === 0) {
        return { success: false, message: 'No architecture nodes to export.' };
      }
      const project = await ctx.storage.getProject(ctx.projectId);
      return fileExportResult(generateKicadSch(nodes, edges, project?.name || 'design'));
    },
  });

  /**
   * export_spice — Generate a SPICE netlist (.cir) for circuit simulation.
   *
   * Executes server-side: resolves the target circuit (or uses the first one),
   * fetches instances, nets, and parts, then generates a SPICE netlist via
   * `generateSpiceNetlist()`. Falls back to a header-only file if no circuit
   * data exists but architecture nodes are present.
   *
   * @side-effect Reads from `circuit_designs`, `circuit_instances`, `circuit_nets`,
   *              `component_parts`, `architecture_nodes`, and `projects` tables.
   */
  registry.register({
    name: 'export_spice',
    description:
      'Generate a SPICE netlist (.cir) for circuit simulation. Uses circuit data if available, falls back to architecture nodes.',
    category: 'export',
    parameters: z.object({
      circuitId: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Specific circuit design ID; uses first circuit if omitted'),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      const project = await ctx.storage.getProject(ctx.projectId);
      const projectName = project?.name || 'design';
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
        return { success: false, message: 'No circuit or architecture data to export.' };
      }
      // No circuit data — generate a SPICE file with header only (no components)
      return fileExportResult(generateSpiceNetlist([], [], [], projectName));
    },
  });

  /**
   * preview_gerber — Generate a rough PCB layout preview.
   *
   * Dispatched client-side. Shows component placement and basic routing
   * estimation, adding a validation info message with the size estimate.
   */
  registry.register({
    name: 'preview_gerber',
    description:
      'Generate a rough PCB layout preview showing component placement and basic routing estimation. Adds a validation info message with the estimate.',
    category: 'export',
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (params) => clientAction('preview_gerber', params),
  });

  /**
   * export_design_report — Generate a comprehensive design report.
   *
   * Executes server-side: fetches the full project state (architecture, BOM,
   * validation issues, circuit summaries) and generates a markdown design
   * report via `generateDesignReportMd()`.
   *
   * @side-effect Reads from `projects`, `architecture_nodes`, `architecture_edges`,
   *              `bom_items`, `validation_issues`, `circuit_designs`, `circuit_instances`,
   *              and `circuit_nets` tables.
   */
  registry.register({
    name: 'export_design_report',
    description:
      'Generate a comprehensive design report including architecture overview, BOM summary, validation status, and recommendations.',
    category: 'export',
    parameters: z.object({
      format: z
        .enum(['markdown'])
        .optional()
        .default('markdown')
        .describe('Report format (currently only markdown)'),
    }),
    requiresConfirmation: false,
    execute: async (_params, ctx) => {
      const project = await ctx.storage.getProject(ctx.projectId);
      const nodes = toArchNodeData(await ctx.storage.getNodes(ctx.projectId));
      const edges = toArchEdgeData(await ctx.storage.getEdges(ctx.projectId));
      const bomRows = await ctx.storage.getBomItems(ctx.projectId);
      const issueRows = await ctx.storage.getValidationIssues(ctx.projectId);
      const circuitDesigns = await ctx.storage.getCircuitDesigns(ctx.projectId);

      const circuits = await Promise.all(
        circuitDesigns.map(async (cd) => {
          const instances = await ctx.storage.getCircuitInstances(cd.id);
          const nets = await ctx.storage.getCircuitNets(cd.id);
          return { name: cd.name, instanceCount: instances.length, netCount: nets.length };
        }),
      );

      return fileExportResult(
        generateDesignReportMd({
          projectName: project?.name || 'Untitled',
          projectDescription: project?.description || '',
          nodes,
          edges,
          bom: toBomItemData(bomRows),
          issues: toValidationIssueData(issueRows),
          circuits,
        }),
      );
    },
  });

  /**
   * export_gerber — Generate Gerber RS-274X files from circuit PCB data.
   *
   * Executes server-side: resolves the target circuit, fetches instances,
   * wires, and parts, then generates Gerber files (board outline, copper
   * layer, drill file) via `generateGerber()`.
   *
   * @side-effect Reads from `circuit_designs`, `circuit_instances`, `circuit_wires`,
   *              `component_parts`, and `projects` tables.
   */
  registry.register({
    name: 'export_gerber',
    description:
      'Generate Gerber RS-274X files (board outline, copper layer, drill file) from circuit PCB data.',
    category: 'export',
    parameters: z.object({
      circuitId: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Specific circuit design ID; uses first circuit if omitted'),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      const cid = await resolveCircuitId(ctx.storage, ctx.projectId, params.circuitId);
      if (!cid) {
        return {
          success: false,
          message: 'No circuit designs found. Create a circuit design with PCB data first.',
        };
      }
      const instances = toCircuitInstanceData(await ctx.storage.getCircuitInstances(cid));
      if (instances.length === 0) {
        return {
          success: false,
          message: 'No circuit instances found. Add components to your circuit first.',
        };
      }
      const wires = toCircuitWireData(await ctx.storage.getCircuitWires(cid));
      const parts = toComponentPartData(await ctx.storage.getComponentParts(ctx.projectId));
      const project = await ctx.storage.getProject(ctx.projectId);
      return fileExportResult(generateGerber(instances, wires, parts, project?.name || 'design'));
    },
  });

  /**
   * export_kicad_netlist — Generate a KiCad-compatible netlist file (.net).
   *
   * Executes server-side: resolves the target circuit, fetches instances,
   * nets, and parts, then generates a KiCad netlist via `generateKicadNetlist()`.
   *
   * @side-effect Reads from `circuit_designs`, `circuit_instances`, `circuit_nets`,
   *              and `component_parts` tables.
   */
  registry.register({
    name: 'export_kicad_netlist',
    description: 'Generate a KiCad-compatible netlist file (.net) from circuit design data.',
    category: 'export',
    parameters: z.object({
      circuitId: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Specific circuit design ID; uses first circuit if omitted'),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      const cid = await resolveCircuitId(ctx.storage, ctx.projectId, params.circuitId);
      if (!cid) {
        return { success: false, message: 'No circuit designs found. Create a circuit design first.' };
      }
      const instances = toCircuitInstanceData(await ctx.storage.getCircuitInstances(cid));
      const nets = toCircuitNetData(await ctx.storage.getCircuitNets(cid));
      const parts = toComponentPartData(await ctx.storage.getComponentParts(ctx.projectId));
      return fileExportResult(generateKicadNetlist(instances, nets, parts));
    },
  });

  /**
   * export_csv_netlist — Export netlist as a CSV file.
   *
   * Executes server-side: resolves the target circuit, fetches instances,
   * nets, and parts, then generates a CSV with columns: Net Name, Component,
   * Pin, Net Type, Voltage via `generateCsvNetlist()`.
   *
   * @side-effect Reads from `circuit_designs`, `circuit_instances`, `circuit_nets`,
   *              and `component_parts` tables.
   */
  registry.register({
    name: 'export_csv_netlist',
    description: 'Export netlist as a CSV file with columns: Net Name, Component, Pin, Net Type, Voltage.',
    category: 'export',
    parameters: z.object({
      circuitId: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Specific circuit design ID; uses first circuit if omitted'),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      const cid = await resolveCircuitId(ctx.storage, ctx.projectId, params.circuitId);
      if (!cid) {
        return { success: false, message: 'No circuit designs found. Create a circuit design first.' };
      }
      const instances = toCircuitInstanceData(await ctx.storage.getCircuitInstances(cid));
      const nets = toCircuitNetData(await ctx.storage.getCircuitNets(cid));
      const parts = toComponentPartData(await ctx.storage.getComponentParts(ctx.projectId));
      return fileExportResult(generateCsvNetlist(instances, nets, parts));
    },
  });

  /**
   * export_pick_and_place — Generate a pick-and-place CSV for PCB assembly.
   *
   * Executes server-side: resolves the target circuit, fetches instances and
   * parts, then generates a CSV with component placement coordinates (X, Y,
   * rotation, side) via `generatePickAndPlace()`.
   *
   * @side-effect Reads from `circuit_designs`, `circuit_instances`, and
   *              `component_parts` tables.
   */
  registry.register({
    name: 'export_pick_and_place',
    description:
      'Generate a pick-and-place CSV file with component placement coordinates for PCB assembly.',
    category: 'export',
    parameters: z.object({
      circuitId: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Specific circuit design ID; uses first circuit if omitted'),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      const cid = await resolveCircuitId(ctx.storage, ctx.projectId, params.circuitId);
      if (!cid) {
        return { success: false, message: 'No circuit designs found. Create a circuit design first.' };
      }
      const instances = toCircuitInstanceData(await ctx.storage.getCircuitInstances(cid));
      if (instances.length === 0) {
        return { success: false, message: 'No circuit instances found.' };
      }
      const parts = toComponentPartData(await ctx.storage.getComponentParts(ctx.projectId));
      return fileExportResult(generatePickAndPlace(instances, parts));
    },
  });

  /**
   * export_eagle — Generate a basic Eagle-compatible schematic XML file (.sch).
   *
   * Executes server-side: fetches architecture nodes and edges, then generates
   * an Eagle XML schematic via `generateEagleSch()`.
   *
   * @side-effect Reads from `architecture_nodes`, `architecture_edges`, and `projects` tables.
   */
  registry.register({
    name: 'export_eagle',
    description:
      'Generate a basic Eagle-compatible schematic XML file (.sch) from architecture data.',
    category: 'export',
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (_params, ctx) => {
      const nodes = toArchNodeData(await ctx.storage.getNodes(ctx.projectId));
      const edges = toArchEdgeData(await ctx.storage.getEdges(ctx.projectId));
      if (nodes.length === 0) {
        return { success: false, message: 'No architecture nodes to export.' };
      }
      const project = await ctx.storage.getProject(ctx.projectId);
      return fileExportResult(generateEagleSch(nodes, edges, project?.name || 'design'));
    },
  });

  /**
   * export_fritzing_project — Export circuit design as a Fritzing project (.fzz).
   *
   * Executes server-side: resolves the target circuit, fetches instances, nets,
   * and parts, then generates a Fritzing-compatible .fzz archive.
   */
  registry.register({
    name: 'export_fritzing_project',
    description:
      'Export circuit design as a Fritzing project archive (.fzz) containing schematic, breadboard, and PCB views.',
    category: 'export',
    parameters: z.object({
      circuitId: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Specific circuit design ID; uses first circuit if omitted'),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      const cid = await resolveCircuitId(ctx.storage, ctx.projectId, params.circuitId);
      if (!cid) {
        return { success: false, message: 'No circuit designs found. Create a circuit design first.' };
      }
      const [instances, nets, parts, project] = await Promise.all([
        ctx.storage.getCircuitInstances(cid),
        ctx.storage.getCircuitNets(cid),
        ctx.storage.getComponentParts(ctx.projectId),
        ctx.storage.getProject(ctx.projectId),
      ]);

      return fileExportResult(await generateFritzingProject({
        projectName: project?.name || 'design',
        instances,
        nets,
        parts,
      }));
    },
  });

  /**
   * export_tinkercad_project — Export the circuit as a TinkerCad Circuits project.
   *
   * Executes server-side: gathers circuit data and returns a TinkerCad-compatible 
   * JSON structure.
   */
  registry.register({
    name: 'export_tinkercad_project',
    description: 'Export your circuit design as a TinkerCad Circuits project file (JSON), compatible with the TinkerCad breadboard and simulation environment.',
    category: 'export',
    parameters: z.object({
      circuitId: z.number().int().min(1).optional().describe('The ID of the circuit to export.'),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      const cid = await resolveCircuitId(ctx.storage, ctx.projectId, params.circuitId);
      if (!cid) {
        return { success: false, message: 'No circuit designs found.' };
      }

      const [project, instances, nets, parts] = await Promise.all([
        ctx.storage.getProject(ctx.projectId),
        ctx.storage.getCircuitInstances(cid),
        ctx.storage.getCircuitNets(cid),
        ctx.storage.getComponentParts(ctx.projectId),
      ]);

      return fileExportResult(await generateTinkercadProject({
        projectName: project?.name || 'design',
        instances,
        nets,
        parts,
      }));
    },
  });

  // ---------------------------------------------------------------------------
  // BL-0575: Conversational export tools
  // ---------------------------------------------------------------------------

  /**
   * Available export formats and their corresponding API routes.
   * Used by both `trigger_export` and `get_export_status`.
   */
  const EXPORT_FORMATS: Record<string, { label: string; route: string; requiresCircuit: boolean }> = {
    'bom-csv': { label: 'BOM CSV', route: '/export/bom', requiresCircuit: false },
    'kicad': { label: 'KiCad Project', route: '/export/kicad', requiresCircuit: true },
    'eagle': { label: 'Eagle Project', route: '/export/eagle', requiresCircuit: true },
    'gerber': { label: 'Gerber (RS-274X)', route: '/export/gerber', requiresCircuit: true },
    'netlist-spice': { label: 'SPICE Netlist', route: '/export/netlist', requiresCircuit: true },
    'netlist-kicad': { label: 'KiCad Netlist', route: '/export/netlist', requiresCircuit: true },
    'netlist-csv': { label: 'CSV Netlist', route: '/export/netlist', requiresCircuit: true },
    'pick-place': { label: 'Pick & Place CSV', route: '/export/pick-place', requiresCircuit: true },
    'odb-plus-plus': { label: 'ODB++', route: '/export/odb-plus-plus', requiresCircuit: true },
    'ipc2581': { label: 'IPC-2581', route: '/export/ipc2581', requiresCircuit: true },
    'fzz': { label: 'Fritzing Project (FZZ)', route: '/export/fzz', requiresCircuit: true },
    'firmware': { label: 'Firmware Scaffold', route: '/export/firmware', requiresCircuit: false },
    'report-pdf': { label: 'Design Report PDF', route: '/export/report-pdf', requiresCircuit: false },
    'fmea': { label: 'FMEA Report', route: '/export/fmea', requiresCircuit: false },
    'pdf': { label: 'PDF/SVG View', route: '/export/pdf', requiresCircuit: false },
  };

  /**
   * get_export_status — List available export formats and readiness for the current project.
   *
   * Checks whether the project has circuit data and BOM items, then returns a
   * list of available formats with readiness indicators so the AI can guide the
   * user toward the right export.
   */
  registry.register({
    name: 'get_export_status',
    description:
      'List all available export formats for the current project design and indicate which ones are ready to use (have the required data: BOM items, circuit designs, etc.).',
    category: 'export',
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (_params, ctx) => {
      const [bomItems, circuits, nodes] = await Promise.all([
        ctx.storage.getBomItems(ctx.projectId),
        ctx.storage.getCircuitDesigns(ctx.projectId),
        ctx.storage.getNodes(ctx.projectId),
      ]);

      const hasBom = bomItems.length > 0;
      const hasCircuit = circuits.length > 0;
      const hasArchitecture = nodes.length > 0;

      const formats = Object.entries(EXPORT_FORMATS).map(([key, fmt]) => {
        let ready = true;
        const reasons: string[] = [];

        if (fmt.requiresCircuit && !hasCircuit) {
          ready = false;
          reasons.push('no circuit design found');
        }
        if (key === 'bom-csv' && !hasBom) {
          ready = false;
          reasons.push('no BOM items');
        }
        if ((key === 'fmea' || key === 'firmware') && !hasArchitecture) {
          ready = false;
          reasons.push('no architecture nodes');
        }

        return {
          format: key,
          label: fmt.label,
          ready,
          reason: reasons.length > 0 ? reasons.join(', ') : undefined,
        };
      });

      const readyCount = formats.filter((f) => f.ready).length;

      return {
        success: true,
        message: `${readyCount} of ${formats.length} export formats are ready. ${hasCircuit ? `Circuit: "${circuits[0].name}"` : 'No circuit design yet.'} ${hasBom ? `BOM: ${bomItems.length} items.` : 'No BOM items yet.'}`,
        data: { type: 'export_status', formats },
      };
    },
  });

  /**
   * trigger_export — Trigger an export in a specific format and return the download URL.
   *
   * The AI uses this to direct the user to the correct export API endpoint.
   * Returns a POST URL that the client can call to download the export file.
   */
  registry.register({
    name: 'trigger_export',
    description:
      'Trigger an export in the specified format and return the download URL. The client will POST to this URL to generate and download the file. Supported formats: bom-csv, kicad, eagle, gerber, netlist-spice, netlist-kicad, netlist-csv, pick-place, odb-plus-plus, ipc2581, fzz, firmware, report-pdf, fmea, pdf.',
    category: 'export',
    parameters: z.object({
      format: z
        .string()
        .describe(
          'Export format key: bom-csv, kicad, eagle, gerber, netlist-spice, netlist-kicad, netlist-csv, pick-place, odb-plus-plus, ipc2581, fzz, firmware, report-pdf, fmea, pdf',
        ),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      const fmt = EXPORT_FORMATS[params.format];
      if (!fmt) {
        const validFormats = Object.keys(EXPORT_FORMATS).join(', ');
        return {
          success: false,
          message: `Unknown export format "${params.format}". Valid formats: ${validFormats}`,
        };
      }

      // Pre-flight check: Approval Gate for Manufacturing Exports
      const manufacturingFormats = ['gerber', 'pick-place', 'odb-plus-plus', 'ipc2581'];
      if (manufacturingFormats.includes(params.format)) {
        const project = await ctx.storage.getProject(ctx.projectId);
        if (!project?.approvedAt) {
          return {
            success: false,
            message: `**Approval Required:** You cannot export manufacturing files (${fmt.label}) until the project has been approved. Please review the design and mark it as approved first.`
          };
        }
      }

      // Pre-flight check: does the project have the required data?
      if (fmt.requiresCircuit) {
        const circuits = await ctx.storage.getCircuitDesigns(ctx.projectId);
        if (circuits.length === 0) {
          return {
            success: false,
            message: `Cannot export ${fmt.label}: no circuit designs found. Create a circuit design first.`,
          };
        }
      }

      if (params.format === 'bom-csv') {
        const bomItems = await ctx.storage.getBomItems(ctx.projectId);
        if (bomItems.length === 0) {
          return {
            success: false,
            message: 'Cannot export BOM CSV: no BOM items found. Add components to the BOM first.',
          };
        }
      }

      // Build the body hints for netlist sub-formats
      let bodyHint: Record<string, unknown> = {};
      if (params.format === 'netlist-spice') {
        bodyHint = { netlistFormat: 'spice' };
      } else if (params.format === 'netlist-kicad') {
        bodyHint = { netlistFormat: 'kicad' };
      } else if (params.format === 'netlist-csv') {
        bodyHint = { netlistFormat: 'csv' };
      }

      const downloadUrl = `/api/projects/${ctx.projectId}${fmt.route}`;

      return {
        success: true,
        message: `Ready to export **${fmt.label}**. Use the download link below to generate and save the file.`,
        data: {
          type: 'export_download',
          format: params.format,
          label: fmt.label,
          downloadUrl,
          method: 'POST',
          body: bodyHint,
        },
      };
    },
  });

  /**
   * export_bom_to_google_sheet — Syncs the current BOM to a live Google Sheet.
   * Requires a valid googleWorkspaceToken in the tool context.
   */
  registry.register({
    name: 'export_bom_to_google_sheet',
    description: 'Creates a live Google Sheet containing the current Bill of Materials, calculating costs, and providing a shareable link. Requires the user to have provided a Google Workspace Token.',
    category: 'export',
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (_params, ctx) => {
      if (!ctx.googleWorkspaceToken) {
        return {
          success: false,
          message: 'Missing Google Workspace Token. Please add your token in the AI Settings panel (gear icon) before syncing to Google Sheets.'
        };
      }
      try {
        const sheetUrl = await exportBomToSheet(ctx.projectId, ctx.googleWorkspaceToken);
        return {
          success: true,
          message: `Successfully synced the Bill of Materials to Google Sheets! \n\n[Open BOM Sheet](${sheetUrl})`
        };
      } catch (err: any) {
        return { success: false, message: `Failed to export BOM to Google Sheets: ${err.message}` };
      }
    }
  });

  /**
   * export_design_report_to_google_doc — Syncs a design report to a live Google Doc.
   * Requires a valid googleWorkspaceToken in the tool context.
   */
  registry.register({
    name: 'export_design_report_to_google_doc',
    description: 'Creates a live Google Doc containing a comprehensive design report, including executive summary, BOM overview, and validation status. Requires the user to have provided a Google Workspace Token.',
    category: 'export',
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (_params, ctx) => {
      if (!ctx.googleWorkspaceToken) {
        return {
          success: false,
          message: 'Missing Google Workspace Token. Please add your token in the AI Settings panel (gear icon) before syncing to Google Docs.'
        };
      }
      try {
        const docUrl = await exportDesignReportToDoc(ctx.projectId, ctx.googleWorkspaceToken);
        return {
          success: true,
          message: `Successfully generated the Design Report in Google Docs! \n\n[Open Design Report](${docUrl})`
        };
      } catch (err: any) {
        return { success: false, message: `Failed to export Design Report to Google Docs: ${err.message}` };
      }
    }
  });

  /**
   * export_project_to_drive — BL-0476 One-click manufacturing package wizard.
   * Compiles Gerbers, Firmware, and BOM into a ZIP and uploads to Google Drive.
   */
  registry.register({
    name: 'export_project_to_drive',
    description: 'Generates a complete manufacturing package (Gerbers, Firmware Scaffold, BOM CSV) and uploads it as a ZIP file to a new Google Drive folder. Requires the user to have provided a Google Workspace Token.',
    category: 'export',
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (_params, ctx) => {
      if (!ctx.googleWorkspaceToken) {
        return {
          success: false,
          message: 'Missing Google Workspace Token. Please add your token in the AI Settings panel (gear icon) before exporting to Google Drive.'
        };
      }
      try {
        const driveUrl = await exportProjectToDrive(ctx.projectId, ctx.googleWorkspaceToken);
        return {
          success: true,
          message: `Successfully generated the full Manufacturing Package and uploaded it to Google Drive! \n\n[Open Drive Folder](${driveUrl})`
        };
      } catch (err: any) {
        return { success: false, message: `Failed to export project to Google Drive: ${err.message}` };
      }
    }
  });
}
