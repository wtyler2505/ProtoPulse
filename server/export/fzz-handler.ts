/**
 * Fritzing Full Project (.fzz) Import/Export Handler (Phase 12.10)
 *
 * .fzz files are ZIP archives containing:
 * - fz/  — sketch files (breadboard.xml, schematic.xml, pcb.xml)
 * - part.<hash>.fzp  — part definition XML files
 * - svg/  — SVG files for part views
 *
 * This module handles round-tripping between ProtoPulse circuit data
 * and Fritzing .fzz format.
 */

import JSZip from 'jszip';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FzzInstance {
  moduleIdRef: string;
  referenceDesignator: string;
  title: string;
  properties: Record<string, string>;
  views: {
    breadboard?: { x: number; y: number; rotation: number };
    schematic?: { x: number; y: number; rotation: number };
    pcb?: { x: number; y: number; rotation: number; layer?: string };
  };
  connectorPins: Array<{ connectorId: string; netName: string }>;
}

export interface FzzNet {
  name: string;
  connections: Array<{
    instanceRef: string;     // moduleIdRef of the instance
    connectorId: string;     // connector ID on the part
  }>;
}

export interface FzzPart {
  moduleId: string;
  title: string;
  family: string;
  description: string;
  properties: Record<string, string>;
  connectors: Array<{
    id: string;
    name: string;
    type: string;       // 'male' | 'female' | 'pad'
  }>;
  svgBreadboard?: string;
  svgSchematic?: string;
  svgPcb?: string;
}

export interface FzzProject {
  title: string;
  instances: FzzInstance[];
  nets: FzzNet[];
  parts: FzzPart[];
  metadata: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Export Input — from ProtoPulse data model
// ---------------------------------------------------------------------------

export interface FzzExportInput {
  circuit: { id: number; name: string };
  instances: Array<{
    id: number;
    partId: number | null;
    referenceDesignator: string;
    schematicX: number;
    schematicY: number;
    schematicRotation: number;
    breadboardX: number | null;
    breadboardY: number | null;
    breadboardRotation: number | null;
    pcbX: number | null;
    pcbY: number | null;
    pcbRotation: number | null;
    pcbSide: string | null;
    properties: Record<string, unknown>;
  }>;
  nets: Array<{
    id: number;
    name: string;
    netType: string;
    segments: Array<{
      fromInstanceId: number;
      fromPin: string;
      toInstanceId: number;
      toPin: string;
    }>;
  }>;
  parts: Map<number, {
    id: number;
    meta: Record<string, unknown>;
    connectors: Array<{ id: string; name: string; type?: string }>;
    views?: Record<string, unknown>;
  }>;
}

// ---------------------------------------------------------------------------
// XML Helpers
// ---------------------------------------------------------------------------

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function xmlAttr(name: string, value: string | number | undefined | null): string {
  if (value == null) return '';
  return ` ${name}="${escapeXml(String(value))}"`;
}

function indent(level: number): string {
  return '  '.repeat(level);
}

// Simple deterministic ID from input string
function stableId(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

// ---------------------------------------------------------------------------
// FZZ Export
// ---------------------------------------------------------------------------

function generateFzpXml(part: {
  moduleId: string;
  title: string;
  family: string;
  connectors: Array<{ id: string; name: string; type?: string }>;
  meta: Record<string, unknown>;
}): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<module fritzingVersion="0.9.10" moduleId="${escapeXml(part.moduleId)}">`);
  lines.push(`${indent(1)}<version>1</version>`);
  lines.push(`${indent(1)}<title>${escapeXml(part.title)}</title>`);
  lines.push(`${indent(1)}<label>${escapeXml((part.meta.prefix as string) || 'U')}</label>`);
  lines.push(`${indent(1)}<date>${new Date().toISOString().slice(0, 10)}</date>`);
  lines.push(`${indent(1)}<author>ProtoPulse EDA</author>`);
  lines.push(`${indent(1)}<description>${escapeXml((part.meta.description as string) || '')}</description>`);

  // Tags
  lines.push(`${indent(1)}<tags>`);
  if (part.family) lines.push(`${indent(2)}<tag>${escapeXml(part.family)}</tag>`);
  lines.push(`${indent(1)}</tags>`);

  // Properties
  lines.push(`${indent(1)}<properties>`);
  lines.push(`${indent(2)}<property name="family">${escapeXml(part.family)}</property>`);
  if (part.meta.package) {
    lines.push(`${indent(2)}<property name="package">${escapeXml(String(part.meta.package))}</property>`);
  }
  lines.push(`${indent(1)}</properties>`);

  // Views
  const svgPrefix = `svg.part.${stableId(part.moduleId)}`;
  lines.push(`${indent(1)}<views>`);
  for (const view of ['breadboardView', 'schematicView', 'pcbView']) {
    const svgFile = `${svgPrefix}.${view.replace('View', '')}.svg`;
    lines.push(`${indent(2)}<${view}>`);
    lines.push(`${indent(3)}<layers image="${escapeXml(svgFile)}">`);
    lines.push(`${indent(4)}<layer layerId="${view === 'pcbView' ? 'copper0' : view === 'schematicView' ? 'schematic' : 'breadboard'}"/>`);
    lines.push(`${indent(3)}</layers>`);
    lines.push(`${indent(2)}</${view}>`);
  }
  lines.push(`${indent(1)}</views>`);

  // Connectors
  lines.push(`${indent(1)}<connectors>`);
  for (const conn of part.connectors) {
    const connType = conn.type || 'male';
    lines.push(`${indent(2)}<connector id="${escapeXml(conn.id)}" name="${escapeXml(conn.name)}" type="${escapeXml(connType)}">`);
    lines.push(`${indent(3)}<description>${escapeXml(conn.name)}</description>`);
    lines.push(`${indent(3)}<views>`);
    for (const viewName of ['breadboardView', 'schematicView', 'pcbView']) {
      const layerId = viewName === 'pcbView' ? 'copper0' : viewName === 'schematicView' ? 'schematic' : 'breadboard';
      lines.push(`${indent(4)}<${viewName}>`);
      lines.push(`${indent(5)}<p layer="${layerId}" svgId="${escapeXml(conn.id)}"/>`);
      lines.push(`${indent(4)}</${viewName}>`);
    }
    lines.push(`${indent(3)}</views>`);
    lines.push(`${indent(2)}</connector>`);
  }
  lines.push(`${indent(1)}</connectors>`);

  lines.push('</module>');
  return lines.join('\n');
}

function generateMinimalSvg(title: string, connectors: Array<{ id: string; name: string }>, viewType: string): string {
  const pinCount = connectors.length || 2;
  const width = Math.max(60, pinCount * 15);
  const height = 40;

  const lines: string[] = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`);

  if (viewType === 'breadboard') {
    lines.push(`  <rect x="2" y="2" width="${width - 4}" height="${height - 4}" fill="#333" stroke="#666" rx="3"/>`);
    lines.push(`  <text x="${width / 2}" y="${height / 2 + 4}" font-family="sans-serif" font-size="8" fill="white" text-anchor="middle">${escapeXml(title)}</text>`);
  } else if (viewType === 'schematic') {
    lines.push(`  <rect x="10" y="2" width="${width - 20}" height="${height - 4}" fill="none" stroke="black" stroke-width="1"/>`);
    lines.push(`  <text x="${width / 2}" y="${height / 2 + 3}" font-family="sans-serif" font-size="7" fill="black" text-anchor="middle">${escapeXml(title)}</text>`);
  } else {
    // PCB
    lines.push(`  <rect x="2" y="2" width="${width - 4}" height="${height - 4}" fill="none" stroke="#c00" stroke-width="0.5"/>`);
  }

  // Pin circles
  for (let i = 0; i < connectors.length; i++) {
    const x = 10 + (i * (width - 20)) / Math.max(1, connectors.length - 1);
    const cy = viewType === 'schematic' ? height - 1 : height - 3;
    lines.push(`  <circle id="${escapeXml(connectors[i].id)}" cx="${x.toFixed(1)}" cy="${cy}" r="2" fill="${viewType === 'pcb' ? '#c90' : '#999'}"/>`);
  }

  lines.push('</svg>');
  return lines.join('\n');
}

function generateSketchXml(
  viewType: 'breadboard' | 'schematic' | 'pcb',
  input: FzzExportInput,
): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<module fritzingVersion="0.9.10">`);
  lines.push(`${indent(1)}<views>`);
  lines.push(`${indent(2)}<view name="${viewType}" viewId="${viewType}View">`);

  // Instances
  lines.push(`${indent(3)}<instances>`);
  for (const inst of input.instances) {
    const part = inst.partId != null ? input.parts.get(inst.partId) : undefined;
    if (!part) continue;

    const moduleId = `part.${stableId(`${inst.partId}`)}`;
    let x = 0, y = 0, rot = 0;

    if (viewType === 'breadboard') {
      x = inst.breadboardX ?? inst.schematicX;
      y = inst.breadboardY ?? inst.schematicY;
      rot = inst.breadboardRotation ?? 0;
    } else if (viewType === 'schematic') {
      x = inst.schematicX;
      y = inst.schematicY;
      rot = inst.schematicRotation;
    } else {
      x = inst.pcbX ?? inst.schematicX;
      y = inst.pcbY ?? inst.schematicY;
      rot = inst.pcbRotation ?? 0;
    }

    lines.push(`${indent(4)}<instance moduleIdRef="${escapeXml(moduleId)}" modelIndex="${inst.id}"${xmlAttr('path', moduleId + '.fzp')}>`);
    lines.push(`${indent(5)}<title>${escapeXml(inst.referenceDesignator)}</title>`);
    lines.push(`${indent(5)}<views>`);
    lines.push(`${indent(6)}<${viewType}View>`);
    lines.push(`${indent(7)}<geometry x="${x}" y="${y}" z="0"${rot ? ` transform="rotate(${rot})"` : ''}/>`);
    lines.push(`${indent(6)}</${viewType}View>`);
    lines.push(`${indent(5)}</views>`);
    lines.push(`${indent(4)}</instance>`);
  }
  lines.push(`${indent(3)}</instances>`);

  lines.push(`${indent(2)}</view>`);
  lines.push(`${indent(1)}</views>`);

  // Nets
  lines.push(`${indent(1)}<programs/>`);
  lines.push(`${indent(1)}<nets>`);

  for (const net of input.nets) {
    lines.push(`${indent(2)}<net name="${escapeXml(net.name)}">`);

    // Build connection list from segments
    for (const seg of net.segments) {
      const fromModuleId = `part.${stableId(`${findPartId(input, seg.fromInstanceId)}`)}`;
      const toModuleId = `part.${stableId(`${findPartId(input, seg.toInstanceId)}`)}`;

      lines.push(`${indent(3)}<connector connectorId="${escapeXml(seg.fromPin)}" modelIndex="${seg.fromInstanceId}" moduleIdRef="${escapeXml(fromModuleId)}"/>`);
      lines.push(`${indent(3)}<connector connectorId="${escapeXml(seg.toPin)}" modelIndex="${seg.toInstanceId}" moduleIdRef="${escapeXml(toModuleId)}"/>`);
    }

    lines.push(`${indent(2)}</net>`);
  }

  lines.push(`${indent(1)}</nets>`);
  lines.push('</module>');
  return lines.join('\n');
}

function findPartId(input: FzzExportInput, instanceId: number): number {
  const inst = input.instances.find(i => i.id === instanceId);
  return inst?.partId ?? 0;
}

export async function exportFzz(input: FzzExportInput): Promise<Buffer> {
  const zip = new JSZip();

  // Generate unique parts
  const uniquePartIds = new Set<number>();
  for (const inst of input.instances) {
    if (inst.partId != null) uniquePartIds.add(inst.partId);
  }

  // For each unique part, create FZP + SVGs
  uniquePartIds.forEach(partId => {
    const part = input.parts.get(partId);
    if (!part) return;

    const moduleId = `part.${stableId(`${partId}`)}`;
    const meta = part.meta;
    const title = (meta.title as string) || 'Component';
    const family = (meta.family as string) || '';

    // FZP file
    const fzpXml = generateFzpXml({
      moduleId,
      title,
      family,
      connectors: part.connectors,
      meta,
    });
    zip.file(`${moduleId}.fzp`, fzpXml);

    // SVG files
    const svgPrefix = `svg.part.${stableId(moduleId)}`;
    zip.file(`svg/${svgPrefix}.breadboard.svg`, generateMinimalSvg(title, part.connectors, 'breadboard'));
    zip.file(`svg/${svgPrefix}.schematic.svg`, generateMinimalSvg(title, part.connectors, 'schematic'));
    zip.file(`svg/${svgPrefix}.pcb.svg`, generateMinimalSvg(title, part.connectors, 'pcb'));
  });

  // Sketch files for each view
  zip.file('fz/breadboard.xml', generateSketchXml('breadboard', input));
  zip.file('fz/schematic.xml', generateSketchXml('schematic', input));
  zip.file('fz/pcb.xml', generateSketchXml('pcb', input));

  // Metadata
  zip.file('fz/meta.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<metadata>',
    `  <title>${escapeXml(input.circuit.name)}</title>`,
    '  <author>ProtoPulse EDA</author>',
    `  <date>${new Date().toISOString().slice(0, 10)}</date>`,
    '  <fritzingVersion>0.9.10</fritzingVersion>',
    '</metadata>',
  ].join('\n'));

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return buffer;
}

// ---------------------------------------------------------------------------
// FZZ Import
// ---------------------------------------------------------------------------

interface ParsedSketchInstance {
  moduleIdRef: string;
  modelIndex: string;
  title: string;
  geometry: { x: number; y: number; rotation: number };
}

interface ParsedSketchNet {
  name: string;
  connections: Array<{ connectorId: string; modelIndex: string; moduleIdRef: string }>;
}

/**
 * Minimal XML tag parser. Handles simple attribute-based XML without
 * a full DOM parser dependency. Good enough for Fritzing's XML format.
 */
function extractTagAttributes(xml: string, tagName: string): Array<Record<string, string>> {
  const results: Array<Record<string, string>> = [];
  const regex = new RegExp(`<${tagName}\\b([^>]*)(?:/>|>)`, 'g');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    const attrs: Record<string, string> = {};
    const attrStr = match[1];
    const attrRegex = /(\w+)="([^"]*)"/g;
    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = attrRegex.exec(attrStr)) !== null) {
      attrs[attrMatch[1]] = attrMatch[2];
    }
    results.push(attrs);
  }
  return results;
}

function extractTagContent(xml: string, tagName: string): string[] {
  const results: string[] = [];
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'g');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1]);
  }
  return results;
}

function extractSingleTagContent(xml: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`);
  const match = regex.exec(xml);
  return match ? match[1].trim() : '';
}

function parseSketchXml(xml: string): { instances: ParsedSketchInstance[]; nets: ParsedSketchNet[] } {
  const instances: ParsedSketchInstance[] = [];
  const nets: ParsedSketchNet[] = [];

  // Parse instances
  const instanceBlocks = extractTagContent(xml, 'instance');
  const instanceAttrs = extractTagAttributes(xml, 'instance');

  for (let i = 0; i < instanceBlocks.length; i++) {
    const block = instanceBlocks[i];
    const attrs = instanceAttrs[i] || {};
    const title = extractSingleTagContent(block, 'title');
    const geoAttrs = extractTagAttributes(block, 'geometry');
    const geo = geoAttrs[0] || {};

    let rotation = 0;
    const transform = geo.transform || '';
    const rotMatch = /rotate\(([^)]+)\)/.exec(transform);
    if (rotMatch) {
      rotation = parseFloat(rotMatch[1]) || 0;
    }

    instances.push({
      moduleIdRef: attrs.moduleIdRef || '',
      modelIndex: attrs.modelIndex || '',
      title,
      geometry: {
        x: parseFloat(geo.x || '0'),
        y: parseFloat(geo.y || '0'),
        rotation,
      },
    });
  }

  // Parse nets
  const netBlocks = extractTagContent(xml, 'net');
  const netAttrs = extractTagAttributes(xml, 'net');

  for (let i = 0; i < netBlocks.length; i++) {
    const block = netBlocks[i];
    const attrs = netAttrs[i] || {};
    const connAttrs = extractTagAttributes(block, 'connector');

    nets.push({
      name: attrs.name || `Net_${i + 1}`,
      connections: connAttrs.map(ca => ({
        connectorId: ca.connectorId || '',
        modelIndex: ca.modelIndex || '',
        moduleIdRef: ca.moduleIdRef || '',
      })),
    });
  }

  return { instances, nets };
}

function parseFzp(xml: string): FzzPart {
  const moduleAttrs = extractTagAttributes(xml, 'module');
  const moduleId = (moduleAttrs[0] || {}).moduleId || '';
  const title = extractSingleTagContent(xml, 'title');
  const description = extractSingleTagContent(xml, 'description');

  // Properties
  const properties: Record<string, string> = {};
  const propBlocks = extractTagContent(xml, 'property');
  const propAttrs = extractTagAttributes(xml, 'property');
  for (let i = 0; i < propBlocks.length; i++) {
    const name = (propAttrs[i] || {}).name || '';
    if (name) {
      properties[name] = propBlocks[i].trim();
    }
  }

  // Connectors
  const connBlocks = extractTagContent(xml, 'connector');
  const connAttrs = extractTagAttributes(xml, 'connector');
  const connectors: FzzPart['connectors'] = [];
  for (let i = 0; i < connAttrs.length; i++) {
    const ca = connAttrs[i];
    connectors.push({
      id: ca.id || `pin${i}`,
      name: ca.name || ca.id || `Pin ${i + 1}`,
      type: ca.type || 'male',
    });
  }

  return {
    moduleId,
    title,
    family: properties.family || '',
    description,
    properties,
    connectors,
  };
}

export interface FzzImportResult {
  project: FzzProject;
  warnings: string[];
}

export async function importFzz(buffer: Buffer): Promise<FzzImportResult> {
  const zip = await JSZip.loadAsync(buffer);
  const warnings: string[] = [];

  // 1. Parse all FZP files → parts
  const parts: FzzPart[] = [];
  const partByModuleId = new Map<string, FzzPart>();

  const fzpFiles = Object.keys(zip.files).filter(f => f.endsWith('.fzp'));
  for (const fzpPath of fzpFiles) {
    const content = await zip.file(fzpPath)?.async('string');
    if (!content) continue;
    try {
      const part = parseFzp(content);
      parts.push(part);
      partByModuleId.set(part.moduleId, part);
    } catch {
      warnings.push(`Failed to parse part: ${fzpPath}`);
    }
  }

  // 2. Try to read SVGs and attach to parts
  for (const part of parts) {
    const svgPrefix = `svg.part.${stableId(part.moduleId)}`;
    const bbSvg = await zip.file(`svg/${svgPrefix}.breadboard.svg`)?.async('string');
    const schSvg = await zip.file(`svg/${svgPrefix}.schematic.svg`)?.async('string');
    const pcbSvg = await zip.file(`svg/${svgPrefix}.pcb.svg`)?.async('string');
    if (bbSvg) part.svgBreadboard = bbSvg;
    if (schSvg) part.svgSchematic = schSvg;
    if (pcbSvg) part.svgPcb = pcbSvg;
  }

  // 3. Parse sketch files — try breadboard first (most common primary view in Fritzing)
  const viewPriority = ['fz/breadboard.xml', 'fz/schematic.xml', 'fz/pcb.xml'];
  let primarySketch: ReturnType<typeof parseSketchXml> | null = null;
  const allSketches: Record<string, ReturnType<typeof parseSketchXml>> = {};

  for (const viewPath of viewPriority) {
    const content = await zip.file(viewPath)?.async('string');
    if (!content) continue;
    try {
      const parsed = parseSketchXml(content);
      allSketches[viewPath] = parsed;
      if (!primarySketch) primarySketch = parsed;
    } catch {
      warnings.push(`Failed to parse sketch: ${viewPath}`);
    }
  }

  if (!primarySketch) {
    warnings.push('No valid sketch files found in .fzz archive');
    return {
      project: { title: 'Untitled', instances: [], nets: [], parts, metadata: {} },
      warnings,
    };
  }

  // 4. Build instances by merging positions from all views
  const bbSketch = allSketches['fz/breadboard.xml'];
  const schSketch = allSketches['fz/schematic.xml'];
  const pcbSketch = allSketches['fz/pcb.xml'];

  // Index by modelIndex
  const bbInstances = new Map<string, ParsedSketchInstance>();
  const schInstances = new Map<string, ParsedSketchInstance>();
  const pcbInstances = new Map<string, ParsedSketchInstance>();

  if (bbSketch) {
    for (const inst of bbSketch.instances) {
      bbInstances.set(inst.modelIndex, inst);
    }
  }
  if (schSketch) {
    for (const inst of schSketch.instances) {
      schInstances.set(inst.modelIndex, inst);
    }
  }
  if (pcbSketch) {
    for (const inst of pcbSketch.instances) {
      pcbInstances.set(inst.modelIndex, inst);
    }
  }

  // Merge instances across views
  const instanceMap = new Map<string, FzzInstance>();
  for (const inst of primarySketch.instances) {
    const bb = bbInstances.get(inst.modelIndex);
    const sch = schInstances.get(inst.modelIndex);
    const pcb = pcbInstances.get(inst.modelIndex);

    instanceMap.set(inst.modelIndex, {
      moduleIdRef: inst.moduleIdRef,
      referenceDesignator: inst.title || inst.modelIndex,
      title: inst.title,
      properties: {},
      views: {
        breadboard: bb ? { x: bb.geometry.x, y: bb.geometry.y, rotation: bb.geometry.rotation } : undefined,
        schematic: sch ? { x: sch.geometry.x, y: sch.geometry.y, rotation: sch.geometry.rotation } : undefined,
        pcb: pcb ? { x: pcb.geometry.x, y: pcb.geometry.y, rotation: pcb.geometry.rotation } : undefined,
      },
      connectorPins: [],
    });
  }

  // 5. Build nets from primary sketch
  const nets: FzzNet[] = primarySketch.nets.map(n => ({
    name: n.name,
    connections: n.connections.map(c => ({
      instanceRef: c.moduleIdRef,
      connectorId: c.connectorId,
    })),
  }));

  // Attach connector-to-net mapping to instances
  for (const net of primarySketch.nets) {
    for (const conn of net.connections) {
      const instance = instanceMap.get(conn.modelIndex);
      if (instance) {
        instance.connectorPins.push({ connectorId: conn.connectorId, netName: net.name });
      }
    }
  }

  // 6. Parse metadata
  const metadata: Record<string, string> = {};
  const metaContent = await zip.file('fz/meta.xml')?.async('string');
  if (metaContent) {
    metadata.title = extractSingleTagContent(metaContent, 'title');
    metadata.author = extractSingleTagContent(metaContent, 'author');
    metadata.date = extractSingleTagContent(metaContent, 'date');
  }

  const instances = Array.from(instanceMap.values());

  return {
    project: {
      title: metadata.title || 'Imported Fritzing Project',
      instances,
      nets,
      parts,
      metadata,
    },
    warnings,
  };
}
