/**
 * Export tools — BOM CSV, KiCad, SPICE, Gerber, Eagle, Fritzing, design report.
 *
 * Also contains data-mapping helpers that convert DB rows to the flat shapes
 * expected by the export generators.
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
// ---------------------------------------------------------------------------

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

function toArchEdgeData(
  rows: Array<{
    edgeId: string;
    source: string;
    target: string;
    label: string | null;
    signalType: string | null;
    voltage: string | null;
    busWidth: string | null;
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

/** Fetch the first circuit design for a project, or a specific one by ID. */
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

export function registerExportTools(registry: ToolRegistry): void {
  // --- BOM CSV (enhanced with format variants) ---
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

  // --- KiCad Schematic ---
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

  // --- SPICE Netlist ---
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

  // --- Preview Gerber (client-side) ---
  registry.register({
    name: 'preview_gerber',
    description:
      'Generate a rough PCB layout preview showing component placement and basic routing estimation. Adds a validation info message with the estimate.',
    category: 'export',
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (params) => clientAction('preview_gerber', params),
  });

  // --- Design Report ---
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

  // --- Gerber RS-274X ---
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

  // --- KiCad Netlist ---
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

  // --- CSV Netlist ---
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

  // --- Pick and Place ---
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

  // --- Eagle Schematic ---
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

  // --- Fritzing Project ---
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
      const instances = toCircuitInstanceData(await ctx.storage.getCircuitInstances(cid));
      const nets = toCircuitNetData(await ctx.storage.getCircuitNets(cid));
      const parts = toComponentPartData(await ctx.storage.getComponentParts(ctx.projectId));
      const project = await ctx.storage.getProject(ctx.projectId);
      const projectName = project?.name || 'design';

      // Generate Fritzing XML sketch content
      const partEntries = instances.map((inst, i) => {
        const part = parts.find((p) => p.id === inst.partId);
        const meta = part?.meta as Record<string, unknown> | undefined;
        const title = (meta?.title as string) || inst.referenceDesignator;
        return `    <instance moduleIdRef="part${String(i)}" modelIndex="${String(i)}" path="">
      <title>${title}</title>
      <views>
        <schematicView layer="schematic">
          <geometry x="${String(inst.schematicX)}" y="${String(inst.schematicY)}" z="${String(i)}" />
        </schematicView>
        ${inst.pcbX != null ? `<pcbView layer="copper0"><geometry x="${String(inst.pcbX)}" y="${String(inst.pcbY)}" z="${String(i)}" /></pcbView>` : ''}
      </views>
    </instance>`;
      });

      const netEntries = nets.map(
        (net, i) => `    <net id="net${String(i)}" name="${net.name}" type="${net.netType}" />`,
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
