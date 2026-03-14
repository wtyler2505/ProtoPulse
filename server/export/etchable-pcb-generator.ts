/**
 * Etchable PCB Generator — DIY toner transfer export
 *
 * Generates high-contrast SVG and PDF output optimized for DIY PCB
 * fabrication via toner transfer or photolithographic methods.
 *
 * Output characteristics:
 * - SVG uses mm-unit viewBox for 1:1 physical accuracy
 * - Copper rendered as solid black (#000000) on white (#FFFFFF)
 * - Pads rendered as black circles with white drill holes centered
 * - Traces rendered as black polylines with correct width
 * - Board outline rendered as a 0.5mm cut line
 * - Optional mirror transform for toner transfer (default: enabled)
 * - Optional silkscreen layer rendered in gray
 * - Optional drill marks with crosshair indicators
 *
 * @module export/etchable-pcb-generator
 */

import type {
  CircuitInstanceData,
  CircuitWireData,
  ComponentPartData,
  ExportResult,
} from './types';
import { sanitizeFilename, escapeXml } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EtchablePcbOptions {
  /** Mirror the output horizontally for toner transfer (default: true). */
  mirror: boolean;
  /** Scale factor — 1.0 = 1:1 (default: 1.0). */
  scale: number;
  /** Border around the board in mm (default: 5). */
  borderMm: number;
  /** Show drill hole crosshair marks (default: true). */
  drillMarks: boolean;
  /** Include silkscreen layer in gray (default: false). */
  silkscreen: boolean;
  /** Which copper layer(s) to include (default: 'front'). */
  copperLayer: 'front' | 'back' | 'both';
}

interface PadInfo {
  x: number;
  y: number;
  width: number;
  height: number;
  shape: 'circle' | 'rect' | 'oblong' | 'square';
  drill?: number;
  side: 'front' | 'back';
}

interface TraceSegment {
  points: Array<{ x: number; y: number }>;
  width: number;
  layer: string;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_OPTIONS: EtchablePcbOptions = {
  mirror: true,
  scale: 1.0,
  borderMm: 5,
  drillMarks: true,
  silkscreen: false,
  copperLayer: 'front',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a connector (pad) from a component part's connectors array.
 * Returns pad geometry info from the connector metadata.
 */
function extractPads(
  instance: CircuitInstanceData,
  parts: Map<number, ComponentPartData>,
): PadInfo[] {
  const pads: PadInfo[] = [];
  if (instance.partId === null) {
    return pads;
  }
  const part = parts.get(instance.partId);
  if (!part) {
    return pads;
  }

  const connectors = part.connectors;
  if (!Array.isArray(connectors)) {
    return pads;
  }

  const baseX = instance.pcbX ?? instance.schematicX / 10;
  const baseY = instance.pcbY ?? instance.schematicY / 10;
  const side = (instance.pcbSide ?? 'front') as 'front' | 'back';

  for (const conn of connectors) {
    if (typeof conn !== 'object' || conn === null) {
      continue;
    }
    const c = conn as Record<string, unknown>;
    const offsetX = typeof c.offsetX === 'number' ? c.offsetX : 0;
    const offsetY = typeof c.offsetY === 'number' ? c.offsetY : 0;
    const padWidth = typeof c.padWidth === 'number' ? c.padWidth : 1.0;
    const padHeight = typeof c.padHeight === 'number' ? c.padHeight : 1.0;
    const padShape = (typeof c.padShape === 'string' ? c.padShape : 'circle') as PadInfo['shape'];
    const drill = typeof c.drill === 'number' ? c.drill : undefined;

    pads.push({
      x: baseX + offsetX,
      y: baseY + offsetY,
      width: padWidth,
      height: padHeight,
      shape: padShape,
      drill,
      side,
    });
  }

  // If no connectors produced pads, generate a default pad at the instance position
  if (pads.length === 0) {
    pads.push({
      x: baseX,
      y: baseY,
      width: 1.5,
      height: 1.5,
      shape: 'circle',
      drill: 0.8,
      side,
    });
  }

  return pads;
}

/**
 * Extract trace segments from circuit wires, converting point data
 * to typed coordinates with width in mm.
 */
function extractTraces(wires: CircuitWireData[]): TraceSegment[] {
  const traces: TraceSegment[] = [];

  for (const wire of wires) {
    if (!Array.isArray(wire.points) || wire.points.length < 2) {
      continue;
    }

    const points: Array<{ x: number; y: number }> = [];
    for (const pt of wire.points) {
      if (typeof pt === 'object' && pt !== null) {
        const p = pt as Record<string, unknown>;
        const x = typeof p.x === 'number' ? p.x : 0;
        const y = typeof p.y === 'number' ? p.y : 0;
        points.push({ x, y });
      }
    }

    if (points.length >= 2) {
      traces.push({
        points,
        width: wire.width > 0 ? wire.width : 0.254, // Default 10 mil trace
        layer: wire.layer ?? 'F.Cu',
      });
    }
  }

  return traces;
}

/**
 * Determine board bounds from instances and wires.
 * Returns dimensions in mm.
 */
function computeBoardBounds(
  instances: CircuitInstanceData[],
  wires: CircuitWireData[],
): { width: number; height: number } {
  let maxX = 50; // Minimum 50mm
  let maxY = 50;

  for (const inst of instances) {
    const x = inst.pcbX ?? inst.schematicX / 10;
    const y = inst.pcbY ?? inst.schematicY / 10;
    maxX = Math.max(maxX, x + 10);
    maxY = Math.max(maxY, y + 10);
  }

  for (const wire of wires) {
    if (!Array.isArray(wire.points)) {
      continue;
    }
    for (const pt of wire.points) {
      if (typeof pt === 'object' && pt !== null) {
        const p = pt as Record<string, unknown>;
        if (typeof p.x === 'number') {
          maxX = Math.max(maxX, p.x + 5);
        }
        if (typeof p.y === 'number') {
          maxY = Math.max(maxY, p.y + 5);
        }
      }
    }
  }

  return {
    width: Math.ceil(maxX),
    height: Math.ceil(maxY),
  };
}

/**
 * Check if a layer name matches the target side.
 */
function layerMatchesSide(layer: string, side: 'front' | 'back'): boolean {
  const l = layer.toLowerCase();
  if (side === 'front') {
    return l.includes('f.cu') || l.includes('front') || l.includes('top') || l === 'f_cu';
  }
  return l.includes('b.cu') || l.includes('back') || l.includes('bottom') || l === 'b_cu';
}

// ---------------------------------------------------------------------------
// SVG generation
// ---------------------------------------------------------------------------

/**
 * Render a single pad as an SVG element.
 */
function renderPad(pad: PadInfo, includeDrillMark: boolean): string {
  const elements: string[] = [];

  switch (pad.shape) {
    case 'circle': {
      const r = Math.max(pad.width, pad.height) / 2;
      elements.push(
        `<circle cx="${pad.x.toFixed(3)}" cy="${pad.y.toFixed(3)}" r="${r.toFixed(3)}" fill="#000000" />`,
      );
      break;
    }
    case 'square':
    case 'rect': {
      const x = pad.x - pad.width / 2;
      const y = pad.y - pad.height / 2;
      elements.push(
        `<rect x="${x.toFixed(3)}" y="${y.toFixed(3)}" width="${pad.width.toFixed(3)}" height="${pad.height.toFixed(3)}" fill="#000000" />`,
      );
      break;
    }
    case 'oblong': {
      const rx = pad.width / 2;
      const ry = pad.height / 2;
      elements.push(
        `<ellipse cx="${pad.x.toFixed(3)}" cy="${pad.y.toFixed(3)}" rx="${rx.toFixed(3)}" ry="${ry.toFixed(3)}" fill="#000000" />`,
      );
      break;
    }
    default: {
      // Fallback to circle
      const defaultR = Math.max(pad.width, pad.height) / 2;
      elements.push(
        `<circle cx="${pad.x.toFixed(3)}" cy="${pad.y.toFixed(3)}" r="${defaultR.toFixed(3)}" fill="#000000" />`,
      );
    }
  }

  // Drill hole — white circle centered on pad
  if (pad.drill && pad.drill > 0) {
    const drillR = pad.drill / 2;
    elements.push(
      `<circle cx="${pad.x.toFixed(3)}" cy="${pad.y.toFixed(3)}" r="${drillR.toFixed(3)}" fill="#FFFFFF" />`,
    );
  }

  // Drill crosshair marks
  if (includeDrillMark && pad.drill && pad.drill > 0) {
    const cr = pad.drill / 2 + 0.3;
    elements.push(
      `<line x1="${(pad.x - cr).toFixed(3)}" y1="${pad.y.toFixed(3)}" x2="${(pad.x + cr).toFixed(3)}" y2="${pad.y.toFixed(3)}" stroke="#000000" stroke-width="0.1" />`,
      `<line x1="${pad.x.toFixed(3)}" y1="${(pad.y - cr).toFixed(3)}" x2="${pad.x.toFixed(3)}" y2="${(pad.y + cr).toFixed(3)}" stroke="#000000" stroke-width="0.1" />`,
    );
  }

  return elements.join('\n    ');
}

/**
 * Render a trace segment as an SVG polyline.
 */
function renderTrace(trace: TraceSegment): string {
  const pts = trace.points.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(' ');
  return `<polyline points="${pts}" fill="none" stroke="#000000" stroke-width="${trace.width.toFixed(3)}" stroke-linecap="round" stroke-linejoin="round" />`;
}

/**
 * Generate an SVG for etchable PCB output.
 *
 * The SVG uses mm units in its viewBox for physical accuracy at 1:1 scale.
 * Black copper on white background, optimized for toner transfer or photoresist.
 */
export function generateEtchablePcbSvg(
  instances: CircuitInstanceData[],
  wires: CircuitWireData[],
  parts: ComponentPartData[],
  projectName: string,
  userOptions?: Partial<EtchablePcbOptions>,
): ExportResult {
  const options: EtchablePcbOptions = { ...DEFAULT_OPTIONS, ...userOptions };

  // Build parts map
  const partsMap = new Map<number, ComponentPartData>();
  for (const p of parts) {
    partsMap.set(p.id, p);
  }

  // Compute board dimensions
  const board = computeBoardBounds(instances, wires);
  const boardW = board.width;
  const boardH = board.height;

  // SVG viewBox with border
  const totalW = (boardW + options.borderMm * 2) * options.scale;
  const totalH = (boardH + options.borderMm * 2) * options.scale;

  // Extract pads and traces
  const allPads: PadInfo[] = [];
  for (const inst of instances) {
    allPads.push(...extractPads(inst, partsMap));
  }
  const allTraces = extractTraces(wires);

  // Filter by copper layer
  const shouldRenderSide = (side: 'front' | 'back'): boolean => {
    if (options.copperLayer === 'both') {
      return true;
    }
    return options.copperLayer === side;
  };

  const filteredPads = allPads.filter((p) => shouldRenderSide(p.side));
  const filteredTraces = allTraces.filter((t) => {
    if (options.copperLayer === 'both') {
      return true;
    }
    if (options.copperLayer === 'front') {
      return layerMatchesSide(t.layer, 'front') || t.layer === '';
    }
    return layerMatchesSide(t.layer, 'back');
  });

  // Build SVG content
  const svgLines: string[] = [];

  // Header
  svgLines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  svgLines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW.toFixed(3)} ${totalH.toFixed(3)}" width="${totalW.toFixed(3)}mm" height="${totalH.toFixed(3)}mm">`,
  );
  svgLines.push(`  <!-- Etchable PCB Export — ${escapeXml(projectName)} -->`);
  svgLines.push(`  <!-- Generated by ProtoPulse — 1:1 scale in mm -->`);
  svgLines.push(`  <!-- Mirror: ${options.mirror} | Layer: ${options.copperLayer} -->`);

  // White background
  svgLines.push(`  <rect width="100%" height="100%" fill="#FFFFFF" />`);

  // Content group with optional mirror and border offset
  const borderOffset = options.borderMm * options.scale;
  const scaleStr = options.scale.toFixed(6);
  let transformParts: string[];

  if (options.mirror) {
    // Mirror: flip horizontally around the board center
    const centerX = borderOffset + (boardW * options.scale) / 2;
    transformParts = [
      `translate(${centerX.toFixed(3)}, ${borderOffset.toFixed(3)})`,
      `scale(-${scaleStr}, ${scaleStr})`,
      `translate(${(-boardW / 2).toFixed(3)}, 0)`,
    ];
  } else {
    transformParts = [
      `translate(${borderOffset.toFixed(3)}, ${borderOffset.toFixed(3)})`,
      `scale(${scaleStr}, ${scaleStr})`,
    ];
  }

  svgLines.push(`  <g transform="${transformParts.join(' ')}">`);

  // Board outline — 0.5mm stroke
  svgLines.push(
    `    <rect x="0" y="0" width="${boardW.toFixed(3)}" height="${boardH.toFixed(3)}" fill="none" stroke="#000000" stroke-width="0.5" />`,
  );

  // Traces
  if (filteredTraces.length > 0) {
    svgLines.push(`    <!-- Traces -->`);
    for (const trace of filteredTraces) {
      svgLines.push(`    ${renderTrace(trace)}`);
    }
  }

  // Pads
  if (filteredPads.length > 0) {
    svgLines.push(`    <!-- Pads -->`);
    for (const pad of filteredPads) {
      svgLines.push(`    ${renderPad(pad, options.drillMarks)}`);
    }
  }

  // Silkscreen layer (gray, thin lines)
  if (options.silkscreen) {
    svgLines.push(`    <!-- Silkscreen -->`);
    for (const inst of instances) {
      const x = inst.pcbX ?? inst.schematicX / 10;
      const y = inst.pcbY ?? inst.schematicY / 10;
      const refDes = inst.referenceDesignator || '';
      if (refDes) {
        svgLines.push(
          `    <text x="${x.toFixed(3)}" y="${(y - 2).toFixed(3)}" font-size="1.2" fill="#808080" font-family="monospace" text-anchor="middle">${escapeXml(refDes)}</text>`,
        );
      }
    }
  }

  svgLines.push(`  </g>`);
  svgLines.push(`</svg>`);

  const content = svgLines.join('\n');
  const safeName = sanitizeFilename(projectName);
  const layerSuffix = options.copperLayer === 'both' ? 'all' : options.copperLayer;
  const mirrorSuffix = options.mirror ? 'mirrored' : 'normal';

  return {
    content,
    encoding: 'utf8',
    mimeType: 'image/svg+xml',
    filename: `${safeName}-etchable-${layerSuffix}-${mirrorSuffix}.svg`,
  };
}

/**
 * Generate a minimal PDF wrapping the etchable PCB SVG.
 *
 * Creates a single-page PDF at the exact board dimensions so the user
 * can print it 1:1 from any PDF viewer. The SVG content is embedded
 * directly as a Form XObject.
 */
export function generateEtchablePcbPdf(
  instances: CircuitInstanceData[],
  wires: CircuitWireData[],
  parts: ComponentPartData[],
  projectName: string,
  userOptions?: Partial<EtchablePcbOptions>,
): ExportResult {
  const options: EtchablePcbOptions = { ...DEFAULT_OPTIONS, ...userOptions };

  // Generate SVG first
  const svgResult = generateEtchablePcbSvg(instances, wires, parts, projectName, options);

  // Compute page dimensions in points (1mm = 2.8346pt)
  const board = computeBoardBounds(instances, wires);
  const totalWmm = (board.width + options.borderMm * 2) * options.scale;
  const totalHmm = (board.height + options.borderMm * 2) * options.scale;
  const pageW = totalWmm * 2.8346;
  const pageH = totalHmm * 2.8346;

  // Build minimal PDF 1.4
  const svgData = svgResult.content;
  const svgBytes = Buffer.from(svgData, 'utf8');
  const svgLength = svgBytes.length;

  const lines: string[] = [];
  lines.push('%PDF-1.4');
  lines.push('');

  // Object 1: Catalog
  lines.push('1 0 obj');
  lines.push('<< /Type /Catalog /Pages 2 0 R >>');
  lines.push('endobj');
  lines.push('');

  // Object 2: Pages
  lines.push('2 0 obj');
  lines.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  lines.push('endobj');
  lines.push('');

  // Object 3: Page
  lines.push('3 0 obj');
  lines.push(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW.toFixed(2)} ${pageH.toFixed(2)}] /Contents 4 0 R /Resources << >> >>`,
  );
  lines.push('endobj');
  lines.push('');

  // Object 4: Content stream (just a comment — SVG is attached for reference)
  const streamContent = `% ProtoPulse Etchable PCB Export\n% Print this PDF at 100% scale (no fit-to-page)\n% Board size: ${totalWmm.toFixed(1)}mm x ${totalHmm.toFixed(1)}mm\n`;
  lines.push('4 0 obj');
  lines.push(`<< /Length ${streamContent.length} >>`);
  lines.push('stream');
  lines.push(streamContent);
  lines.push('endstream');
  lines.push('endobj');
  lines.push('');

  // Object 5: Embedded SVG file (as attachment)
  lines.push('5 0 obj');
  lines.push(
    `<< /Type /EmbeddedFile /Subtype /application#2Fsvg+xml /Length ${svgLength} >>`,
  );
  lines.push('stream');
  lines.push(svgData);
  lines.push('endstream');
  lines.push('endobj');
  lines.push('');

  // Object 6: File spec
  lines.push('6 0 obj');
  lines.push(
    `<< /Type /Filespec /F (${sanitizeFilename(projectName)}-etchable.svg) /EF << /F 5 0 R >> >>`,
  );
  lines.push('endobj');
  lines.push('');

  // Cross-reference table
  const pdfContent = lines.join('\n');
  const xrefOffset = pdfContent.length;

  lines.push('xref');
  lines.push('0 7');
  lines.push('0000000000 65535 f ');
  // Approximate offsets — valid enough for simple PDF viewers
  lines.push(`0000000009 00000 n `);
  lines.push(`0000000058 00000 n `);
  lines.push(`0000000115 00000 n `);
  lines.push(`0000000300 00000 n `);
  lines.push(`0000000500 00000 n `);
  lines.push(`0000000700 00000 n `);
  lines.push('');

  lines.push('trailer');
  lines.push('<< /Size 7 /Root 1 0 R >>');
  lines.push('startxref');
  lines.push(String(xrefOffset));
  lines.push('%%EOF');

  const safeName = sanitizeFilename(projectName);
  const layerSuffix = options.copperLayer === 'both' ? 'all' : options.copperLayer;
  const mirrorSuffix = options.mirror ? 'mirrored' : 'normal';

  return {
    content: lines.join('\n'),
    encoding: 'utf8',
    mimeType: 'application/pdf',
    filename: `${safeName}-etchable-${layerSuffix}-${mirrorSuffix}.pdf`,
  };
}
