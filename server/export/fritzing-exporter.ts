/**
 * Fritzing Exporter
 *
 * Generates a .fzz archive (zipped XML) compatible with Fritzing.
 * Produces a complete project with:
 *   - Instance geometry (breadboard, schematic, PCB views)
 *   - Wire routing data with color preservation
 *   - Net connectivity information
 *   - Embedded part references
 *   - Project metadata
 */

import JSZip from 'jszip';
import type {
  CircuitInstanceRow,
  CircuitNetRow,
  CircuitWireRow,
  ComponentPart,
} from '@shared/schema';
import type { NetSegment } from '@shared/circuit-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FritzingExportOptions {
  projectName: string;
  instances: CircuitInstanceRow[];
  nets: CircuitNetRow[];
  parts: ComponentPart[];
  /** Optional wire data — when provided, wire routing is included in the export */
  wires?: CircuitWireRow[];
}

interface FritzingExportResult {
  content: string;
  encoding: 'base64';
  mimeType: 'application/x-fritzing-fz';
  filename: string;
}

// ---------------------------------------------------------------------------
// XML helpers
// ---------------------------------------------------------------------------

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ---------------------------------------------------------------------------
// Instance XML generation
// ---------------------------------------------------------------------------

function generateInstanceXml(
  inst: CircuitInstanceRow,
  index: number,
  partMap: Map<number, ComponentPart>,
): string {
  const part = inst.partId ? partMap.get(inst.partId) : null;
  const meta = (part?.meta ?? {}) as Record<string, unknown>;
  const moduleId = (meta.title as string) || 'generic_part';
  const partName = ((meta.title as string) || 'part').replace(/\s+/g, '_');
  const modelIndex = 5000 + index;

  const bbX = inst.breadboardX ?? 0;
  const bbY = inst.breadboardY ?? 0;
  const schX = inst.schematicX ?? 0;
  const schY = inst.schematicY ?? 0;
  const rotation = inst.rotation ?? 0;
  const rotAttr = rotation !== 0 ? ` transform="rotate(${String(rotation)})"` : '';

  return [
    `    <instance moduleIdRef="${escapeXml(moduleId)}" modelIndex="${String(modelIndex)}" path="${escapeXml(partName)}.fzp">`,
    `      <title>${escapeXml(inst.referenceDesignator)}</title>`,
    `      <views>`,
    `        <breadboardView layer="breadboard">`,
    `          <geometry x="${String(bbX)}" y="${String(bbY)}" z="0"${rotAttr}/>`,
    `        </breadboardView>`,
    `        <schematicView layer="schematic">`,
    `          <geometry x="${String(schX)}" y="${String(schY)}" z="0"${rotAttr}/>`,
    `        </schematicView>`,
    `        <pcbView layer="copper0">`,
    `          <geometry x="${String(bbX)}" y="${String(bbY)}" z="0"${rotAttr}/>`,
    `        </pcbView>`,
    `      </views>`,
    `    </instance>`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Wire XML generation (Fritzing wire elements)
// ---------------------------------------------------------------------------

const WIRE_MODULE_ID = 'WireModuleID';
const DEFAULT_WIRE_COLOR = '#418dd9';

function generateWireXml(
  wire: CircuitWireRow,
  wireIndex: number,
  baseModelIndex: number,
): string {
  const points = Array.isArray(wire.points) ? (wire.points as Array<{ x: number; y: number }>) : [];
  if (points.length < 2) return '';

  const modelIndex = baseModelIndex + wireIndex;
  const wireColor = wire.color ?? DEFAULT_WIRE_COLOR;
  const viewLayer = wire.view === 'schematic' ? 'schematicView' : 'breadboardView';
  const layerName = wire.view === 'schematic' ? 'schematic' : 'breadboard';

  // Generate polyline geometry from points
  const start = points[0];
  const end = points[points.length - 1];
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  return [
    `    <instance moduleIdRef="${WIRE_MODULE_ID}" modelIndex="${String(modelIndex)}" path=":/resources/wires.fzp">`,
    `      <title>Wire ${String(wire.id)}</title>`,
    `      <views>`,
    `        <${viewLayer} layer="${layerName}">`,
    `          <geometry x="${String(start.x)}" y="${String(start.y)}" z="1" wireFlags="0">`,
    `            <line x1="0" y1="0" x2="${String(dx)}" y2="${String(dy)}" strokeWidth="2" stroke="${escapeXml(wireColor)}"/>`,
    `          </geometry>`,
    `        </${viewLayer}>`,
    `      </views>`,
    `    </instance>`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Net connectivity XML
// ---------------------------------------------------------------------------

function extractSegments(net: CircuitNetRow): NetSegment[] {
  const raw = net.segments;
  if (!Array.isArray(raw)) return [];
  return raw as NetSegment[];
}

function generateNetsXml(
  nets: CircuitNetRow[],
  instances: CircuitInstanceRow[],
): string {
  if (nets.length === 0) return '';

  const instanceModelIndices = new Map<number, number>();
  instances.forEach((inst, i) => {
    instanceModelIndices.set(inst.id, 5000 + i);
  });

  const netEntries: string[] = [];

  for (const net of nets) {
    const segments = extractSegments(net);
    if (segments.length === 0) continue;

    const connections: string[] = [];

    for (const seg of segments) {
      const fromIdx = instanceModelIndices.get(seg.fromInstanceId);
      const toIdx = instanceModelIndices.get(seg.toInstanceId);

      if (fromIdx != null) {
        connections.push(
          `        <connector connectorId="${escapeXml(seg.fromPin)}" modelIndex="${String(fromIdx)}"/>`,
        );
      }
      if (toIdx != null) {
        connections.push(
          `        <connector connectorId="${escapeXml(seg.toPin)}" modelIndex="${String(toIdx)}"/>`,
        );
      }
    }

    if (connections.length > 0) {
      netEntries.push([
        `      <net name="${escapeXml(net.name)}" netId="${String(net.id)}">`,
        ...connections,
        `      </net>`,
      ].join('\n'));
    }
  }

  if (netEntries.length === 0) return '';

  return [
    `    <nets>`,
    ...netEntries,
    `    </nets>`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Main export function
// ---------------------------------------------------------------------------

export async function generateFritzingProject(opts: FritzingExportOptions): Promise<FritzingExportResult> {
  const { projectName, instances, nets, parts, wires = [] } = opts;
  const zip = new JSZip();

  const partMap = new Map(parts.map((p) => [p.id, p]));

  // ── Build the .fz XML content ──────────────────────────────────────────

  let fz = `<?xml version="1.0" encoding="utf-8"?>\n`;
  fz += `<module fritzingVersion="0.9.10" moduleId="${escapeXml(projectName)}">\n`;
  fz += `  <title>${escapeXml(projectName)}</title>\n`;

  // Views declaration
  fz += `  <views>\n`;
  fz += `    <breadboardView><layers image="breadboard"><layer layerId="breadboard"/></layers></breadboardView>\n`;
  fz += `    <schematicView><layers image="schematic"><layer layerId="schematic"/></layers></schematicView>\n`;
  fz += `    <pcbView><layers image="pcb"><layer layerId="copper0"/><layer layerId="silkscreen"/><layer layerId="copper1"/></layers></pcbView>\n`;
  fz += `  </views>\n`;

  // Instances section (components + wires)
  fz += `  <instances>\n`;

  // Component instances
  instances.forEach((inst, i) => {
    fz += generateInstanceXml(inst, i, partMap) + '\n';
  });

  // Wire instances
  const wireBaseIndex = 10000;
  const viewWires = wires.filter((w) => w.view === 'breadboard' || w.view === 'schematic');
  viewWires.forEach((wire, i) => {
    const wireXml = generateWireXml(wire, i, wireBaseIndex);
    if (wireXml) {
      fz += wireXml + '\n';
    }
  });

  fz += `  </instances>\n`;

  // Net connectivity
  const netsXml = generateNetsXml(nets, instances);
  if (netsXml) {
    fz += netsXml + '\n';
  }

  // Programs section (empty but expected by Fritzing)
  fz += `  <programs>\n`;
  fz += `    <program language="protopulse">\n`;
  fz += `      <![CDATA[/* Generated by ProtoPulse EDA */]]>\n`;
  fz += `    </program>\n`;
  fz += `  </programs>\n`;

  fz += `</module>\n`;

  zip.file(`${projectName}.fz`, fz);

  // ── Generate the .fzz (zipped) buffer ──────────────────────────────────

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

  return {
    content: buffer.toString('base64'),
    encoding: 'base64' as const,
    mimeType: 'application/x-fritzing-fz',
    filename: `${projectName.replace(/\s+/g, '_')}.fzz`,
  };
}
