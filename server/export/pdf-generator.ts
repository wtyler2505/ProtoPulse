/**
 * PDF View Export Generator (Phase 12.9)
 *
 * Generates PDF-like SVG documents for printing/archiving circuit views.
 * Since we don't add a heavy PDF library dependency, we generate well-structured
 * SVG with print-ready dimensions that can be converted to PDF client-side
 * (via browser print or a lightweight SVG-to-PDF tool).
 *
 * Each view type (schematic, breadboard, PCB) gets appropriate styling,
 * title blocks, borders, and scaling.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TitleBlock {
  projectName: string;
  circuitName: string;
  revision?: string;
  date?: string;
  author?: string;
  sheetNumber?: number;
  totalSheets?: number;
}

export type PaperSize = 'A4' | 'A3' | 'letter' | 'tabloid';

export interface PaperDimensions {
  width: number;   // mm
  height: number;  // mm
}

const PAPER_SIZES: Record<PaperSize, PaperDimensions> = {
  A4: { width: 297, height: 210 },
  A3: { width: 420, height: 297 },
  letter: { width: 279.4, height: 215.9 },
  tabloid: { width: 431.8, height: 279.4 },
};

export type ViewType = 'schematic' | 'breadboard' | 'pcb';

export interface PdfExportOptions {
  paperSize?: PaperSize;
  landscape?: boolean;       // default true
  scale?: 'fit' | '1:1';    // default 'fit'
  titleBlock?: TitleBlock;
  showBorder?: boolean;      // default true
  showGrid?: boolean;        // default false
  margin?: number;           // mm, default 10
}

// Schematic view data
export interface SchematicViewData {
  type: 'schematic';
  instances: Array<{
    referenceDesignator: string;
    x: number;
    y: number;
    rotation: number;
    value: string;
    pinCount: number;
  }>;
  wires: Array<{
    points: Array<{ x: number; y: number }>;
    netName: string;
  }>;
  labels: Array<{
    text: string;
    x: number;
    y: number;
  }>;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

// Breadboard view data
export interface BreadboardViewData {
  type: 'breadboard';
  instances: Array<{
    referenceDesignator: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
  }>;
  wires: Array<{
    points: Array<{ x: number; y: number }>;
    color: string;
    width: number;
  }>;
  boardWidth: number;
  boardHeight: number;
}

// PCB view data — per-layer or composite
export interface PcbViewData {
  type: 'pcb';
  layers: Array<{
    name: string;        // F.Cu, B.Cu, F.SilkS, etc.
    color: string;
    visible: boolean;
  }>;
  instances: Array<{
    referenceDesignator: string;
    x: number;
    y: number;
    rotation: number;
    side: string;
    width: number;
    height: number;
  }>;
  traces: Array<{
    points: Array<{ x: number; y: number }>;
    layer: string;
    width: number;
  }>;
  boardOutline: Array<{ x: number; y: number }>;
  boardWidth: number;
  boardHeight: number;
  renderMode: 'composite' | 'per-layer';
}

export type ViewData = SchematicViewData | BreadboardViewData | PcbViewData;

// ---------------------------------------------------------------------------
// SVG Helpers
// ---------------------------------------------------------------------------

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getPaperDimensions(size: PaperSize, landscape: boolean): PaperDimensions {
  const base = PAPER_SIZES[size];
  if (landscape) {
    return { width: Math.max(base.width, base.height), height: Math.min(base.width, base.height) };
  }
  return { width: Math.min(base.width, base.height), height: Math.max(base.width, base.height) };
}

// ---------------------------------------------------------------------------
// Title Block Renderer
// ---------------------------------------------------------------------------

function renderTitleBlock(tb: TitleBlock, x: number, y: number, width: number, height: number): string {
  const lines: string[] = [];
  const bx = x;
  const by = y;
  const bw = width;
  const bh = height;

  // Outer border
  lines.push(`<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="white" stroke="black" stroke-width="0.5"/>`);

  // Dividers — 3 rows
  const row1 = by + bh * 0.4;
  const row2 = by + bh * 0.7;
  lines.push(`<line x1="${bx}" y1="${row1}" x2="${bx + bw}" y2="${row1}" stroke="black" stroke-width="0.3"/>`);
  lines.push(`<line x1="${bx}" y1="${row2}" x2="${bx + bw}" y2="${row2}" stroke="black" stroke-width="0.3"/>`);

  // Vertical divider in row 3
  const colMid = bx + bw * 0.6;
  lines.push(`<line x1="${colMid}" y1="${row2}" x2="${colMid}" y2="${by + bh}" stroke="black" stroke-width="0.3"/>`);

  // Text — project name (large)
  lines.push(`<text x="${bx + bw / 2}" y="${by + bh * 0.25}" font-family="sans-serif" font-size="4" font-weight="bold" text-anchor="middle" fill="black">${escapeXml(tb.projectName)}</text>`);

  // Circuit name
  lines.push(`<text x="${bx + bw / 2}" y="${(row1 + row2) / 2 + 1.5}" font-family="sans-serif" font-size="3" text-anchor="middle" fill="black">${escapeXml(tb.circuitName)}</text>`);

  // Date + revision
  const dateStr = tb.date || new Date().toISOString().slice(0, 10);
  lines.push(`<text x="${bx + 2}" y="${row2 + (by + bh - row2) / 2 + 1}" font-family="sans-serif" font-size="2.5" fill="black">Date: ${escapeXml(dateStr)}</text>`);
  if (tb.revision) {
    lines.push(`<text x="${bx + 2}" y="${row2 + (by + bh - row2) / 2 + 4}" font-family="sans-serif" font-size="2.5" fill="black">Rev: ${escapeXml(tb.revision)}</text>`);
  }

  // Sheet number
  if (tb.sheetNumber != null) {
    const sheetText = tb.totalSheets ? `Sheet ${tb.sheetNumber}/${tb.totalSheets}` : `Sheet ${tb.sheetNumber}`;
    lines.push(`<text x="${colMid + 2}" y="${row2 + (by + bh - row2) / 2 + 1}" font-family="sans-serif" font-size="2.5" fill="black">${escapeXml(sheetText)}</text>`);
  }

  // Author
  if (tb.author) {
    lines.push(`<text x="${colMid + 2}" y="${row2 + (by + bh - row2) / 2 + 4}" font-family="sans-serif" font-size="2.5" fill="black">By: ${escapeXml(tb.author)}</text>`);
  }

  // ProtoPulse branding
  lines.push(`<text x="${bx + bw - 2}" y="${by + 3}" font-family="sans-serif" font-size="1.8" text-anchor="end" fill="#888">ProtoPulse EDA</text>`);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Border Renderer
// ---------------------------------------------------------------------------

function renderBorder(paperW: number, paperH: number, margin: number): string {
  const lines: string[] = [];
  lines.push(`<rect x="${margin}" y="${margin}" width="${paperW - 2 * margin}" height="${paperH - 2 * margin}" fill="none" stroke="black" stroke-width="0.5"/>`);

  // Inner border (double line effect)
  const inner = margin + 1;
  lines.push(`<rect x="${inner}" y="${inner}" width="${paperW - 2 * inner}" height="${paperH - 2 * inner}" fill="none" stroke="black" stroke-width="0.2"/>`);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// View Renderers
// ---------------------------------------------------------------------------

function renderSchematic(data: SchematicViewData, vx: number, vy: number, vw: number, vh: number, scale: number, showGrid: boolean): string {
  const lines: string[] = [];
  const bounds = data.bounds;
  const contentW = bounds.maxX - bounds.minX || 1;
  const contentH = bounds.maxY - bounds.minY || 1;

  let s: number;
  let offsetX: number;
  let offsetY: number;

  if (scale === 0) {
    // fit mode
    s = Math.min(vw / contentW, vh / contentH) * 0.9;
    offsetX = vx + (vw - contentW * s) / 2 - bounds.minX * s;
    offsetY = vy + (vh - contentH * s) / 2 - bounds.minY * s;
  } else {
    s = scale;
    offsetX = vx + (vw - contentW * s) / 2 - bounds.minX * s;
    offsetY = vy + (vh - contentH * s) / 2 - bounds.minY * s;
  }

  // Clip path
  lines.push(`<clipPath id="schematic-clip"><rect x="${vx}" y="${vy}" width="${vw}" height="${vh}"/></clipPath>`);
  lines.push(`<g clip-path="url(#schematic-clip)">`);

  // Grid
  if (showGrid) {
    const gridStep = 2.54 * s;
    if (gridStep > 1) {
      lines.push(`<defs><pattern id="sch-grid" width="${gridStep}" height="${gridStep}" patternUnits="userSpaceOnUse"><circle cx="${gridStep / 2}" cy="${gridStep / 2}" r="0.15" fill="#ddd"/></pattern></defs>`);
      lines.push(`<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="url(#sch-grid)"/>`);
    }
  }

  // Wires
  for (const wire of data.wires) {
    if (wire.points.length < 2) continue;
    const pts = wire.points.map(p => `${p.x * s + offsetX},${p.y * s + offsetY}`).join(' ');
    lines.push(`<polyline points="${pts}" fill="none" stroke="#2e8b57" stroke-width="${0.3 * s}" stroke-linecap="round" stroke-linejoin="round"/>`);
  }

  // Instances (simplified — rectangle with pins)
  for (const inst of data.instances) {
    const ix = inst.x * s + offsetX;
    const iy = inst.y * s + offsetY;
    const size = Math.max(8, inst.pinCount * 2) * s;
    const hw = size / 2;
    const hh = size / 2;

    lines.push(`<rect x="${ix - hw}" y="${iy - hh}" width="${size}" height="${size}" fill="white" stroke="black" stroke-width="${0.2 * s}"/>`);
    lines.push(`<text x="${ix}" y="${iy - hh - 1 * s}" font-family="sans-serif" font-size="${2 * s}" text-anchor="middle" fill="black">${escapeXml(inst.referenceDesignator)}</text>`);
    lines.push(`<text x="${ix}" y="${iy + 1 * s}" font-family="sans-serif" font-size="${1.5 * s}" text-anchor="middle" fill="#555">${escapeXml(inst.value)}</text>`);
  }

  // Labels
  for (const label of data.labels) {
    lines.push(`<text x="${label.x * s + offsetX}" y="${label.y * s + offsetY}" font-family="sans-serif" font-size="${2 * s}" fill="black">${escapeXml(label.text)}</text>`);
  }

  lines.push('</g>');
  return lines.join('\n');
}

function renderBreadboard(data: BreadboardViewData, vx: number, vy: number, vw: number, vh: number, showGrid: boolean): string {
  const lines: string[] = [];
  const contentW = data.boardWidth || 1;
  const contentH = data.boardHeight || 1;
  const s = Math.min(vw / contentW, vh / contentH) * 0.9;
  const offsetX = vx + (vw - contentW * s) / 2;
  const offsetY = vy + (vh - contentH * s) / 2;

  lines.push(`<clipPath id="bb-clip"><rect x="${vx}" y="${vy}" width="${vw}" height="${vh}"/></clipPath>`);
  lines.push(`<g clip-path="url(#bb-clip)">`);

  // Board background
  lines.push(`<rect x="${offsetX}" y="${offsetY}" width="${contentW * s}" height="${contentH * s}" fill="#e8e0c8" stroke="#999" stroke-width="0.5" rx="2"/>`);

  // Grid dots
  if (showGrid) {
    const pitch = 2.54 * s;
    if (pitch > 1) {
      lines.push(`<defs><pattern id="bb-grid" width="${pitch}" height="${pitch}" patternUnits="userSpaceOnUse"><circle cx="${pitch / 2}" cy="${pitch / 2}" r="0.3" fill="#bbb"/></pattern></defs>`);
      lines.push(`<rect x="${offsetX}" y="${offsetY}" width="${contentW * s}" height="${contentH * s}" fill="url(#bb-grid)"/>`);
    }
  }

  // Components
  for (const inst of data.instances) {
    const cx = inst.x * s + offsetX;
    const cy = inst.y * s + offsetY;
    const w = inst.width * s;
    const h = inst.height * s;
    lines.push(`<rect x="${cx}" y="${cy}" width="${w}" height="${h}" fill="${escapeXml(inst.color)}" stroke="#333" stroke-width="${0.2 * s}" rx="${0.5 * s}"/>`);
    lines.push(`<text x="${cx + w / 2}" y="${cy - 1 * s}" font-family="sans-serif" font-size="${1.5 * s}" text-anchor="middle" fill="black">${escapeXml(inst.referenceDesignator)}</text>`);
  }

  // Wires
  for (const wire of data.wires) {
    if (wire.points.length < 2) continue;
    const pts = wire.points.map(p => `${p.x * s + offsetX},${p.y * s + offsetY}`).join(' ');
    lines.push(`<polyline points="${pts}" fill="none" stroke="${escapeXml(wire.color)}" stroke-width="${wire.width * s}" stroke-linecap="round" stroke-linejoin="round"/>`);
  }

  lines.push('</g>');
  return lines.join('\n');
}

function renderPcb(data: PcbViewData, vx: number, vy: number, vw: number, vh: number, showGrid: boolean): string {
  const lines: string[] = [];
  const contentW = data.boardWidth || 1;
  const contentH = data.boardHeight || 1;
  const s = Math.min(vw / contentW, vh / contentH) * 0.9;
  const offsetX = vx + (vw - contentW * s) / 2;
  const offsetY = vy + (vh - contentH * s) / 2;

  const LAYER_COLORS: Record<string, string> = {
    'F.Cu': '#c00000',
    'B.Cu': '#0000c0',
    'F.SilkS': '#c0c000',
    'B.SilkS': '#808000',
    'Edge.Cuts': '#c0c000',
  };

  lines.push(`<clipPath id="pcb-clip"><rect x="${vx}" y="${vy}" width="${vw}" height="${vh}"/></clipPath>`);
  lines.push(`<g clip-path="url(#pcb-clip)">`);

  // Dark background (PCB substrate)
  lines.push(`<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="#1a2a1a"/>`);

  // Grid
  if (showGrid) {
    const pitch = 0.5 * s;
    if (pitch > 1) {
      lines.push(`<defs><pattern id="pcb-grid" width="${pitch}" height="${pitch}" patternUnits="userSpaceOnUse"><rect width="${pitch}" height="${pitch}" fill="none" stroke="#2a3a2a" stroke-width="0.1"/></pattern></defs>`);
      lines.push(`<rect x="${offsetX}" y="${offsetY}" width="${contentW * s}" height="${contentH * s}" fill="url(#pcb-grid)"/>`);
    }
  }

  // Board outline
  if (data.boardOutline.length >= 2) {
    const pts = data.boardOutline.map(p => `${p.x * s + offsetX},${p.y * s + offsetY}`).join(' ');
    lines.push(`<polygon points="${pts}" fill="#0a3a0a" stroke="#c0c000" stroke-width="0.3"/>`);
  } else {
    // Default rectangle
    lines.push(`<rect x="${offsetX}" y="${offsetY}" width="${contentW * s}" height="${contentH * s}" fill="#0a3a0a" stroke="#c0c000" stroke-width="0.3"/>`);
  }

  // Back layer traces first
  for (const trace of data.traces) {
    if (trace.layer !== 'back') continue;
    if (trace.points.length < 2) continue;
    const pts = trace.points.map(p => `${p.x * s + offsetX},${p.y * s + offsetY}`).join(' ');
    const color = LAYER_COLORS['B.Cu'] || '#0000c0';
    lines.push(`<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="${trace.width * s}" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>`);
  }

  // Components
  for (const inst of data.instances) {
    const cx = inst.x * s + offsetX;
    const cy = inst.y * s + offsetY;
    const w = inst.width * s;
    const h = inst.height * s;
    const fillColor = inst.side === 'front' ? '#2a5a2a' : '#2a2a5a';
    lines.push(`<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" fill="${fillColor}" stroke="#aaa" stroke-width="${0.15 * s}"/>`);
    lines.push(`<text x="${cx}" y="${cy + 0.5 * s}" font-family="monospace" font-size="${1.5 * s}" text-anchor="middle" fill="#fff">${escapeXml(inst.referenceDesignator)}</text>`);
  }

  // Front layer traces on top
  for (const trace of data.traces) {
    if (trace.layer !== 'front') continue;
    if (trace.points.length < 2) continue;
    const pts = trace.points.map(p => `${p.x * s + offsetX},${p.y * s + offsetY}`).join(' ');
    const color = LAYER_COLORS['F.Cu'] || '#c00000';
    lines.push(`<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="${trace.width * s}" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>`);
  }

  lines.push('</g>');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main Export Function
// ---------------------------------------------------------------------------

export interface PdfExportResult {
  svg: string;          // Complete SVG document (printable, convertible to PDF)
  paperSize: PaperSize;
  widthMm: number;
  heightMm: number;
}

export function generateViewPdf(data: ViewData, options: PdfExportOptions = {}): PdfExportResult {
  const paperSize = options.paperSize || 'A4';
  const landscape = options.landscape !== false;
  const margin = options.margin || 10;
  const showBorder = options.showBorder !== false;
  const showGrid = options.showGrid || false;

  const paper = getPaperDimensions(paperSize, landscape);
  const { width: pw, height: ph } = paper;

  // Title block dimensions
  const titleBlockW = 80;
  const titleBlockH = 20;
  const hasTitleBlock = !!options.titleBlock;

  // Viewport for the view content
  const viewX = margin + 2;
  const viewY = margin + 2;
  const viewW = pw - 2 * margin - 4;
  const viewH = ph - 2 * margin - 4 - (hasTitleBlock ? titleBlockH + 2 : 0);

  // Scale for 1:1 mode (1mm on paper = 1mm in design)
  const scaleValue = options.scale === '1:1' ? 1 : 0; // 0 means "fit"

  // Build SVG
  const svgParts: string[] = [];

  svgParts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${pw}mm" height="${ph}mm" viewBox="0 0 ${pw} ${ph}">`);

  // White background
  svgParts.push(`<rect width="${pw}" height="${ph}" fill="white"/>`);

  // Border
  if (showBorder) {
    svgParts.push(renderBorder(pw, ph, margin));
  }

  // View content
  if (data.type === 'schematic') {
    svgParts.push(renderSchematic(data, viewX, viewY, viewW, viewH, scaleValue, showGrid));
  } else if (data.type === 'breadboard') {
    svgParts.push(renderBreadboard(data, viewX, viewY, viewW, viewH, showGrid));
  } else if (data.type === 'pcb') {
    svgParts.push(renderPcb(data, viewX, viewY, viewW, viewH, showGrid));
  }

  // Title block
  if (hasTitleBlock && options.titleBlock) {
    const tbX = pw - margin - 2 - titleBlockW;
    const tbY = ph - margin - 2 - titleBlockH;
    svgParts.push(renderTitleBlock(options.titleBlock, tbX, tbY, titleBlockW, titleBlockH));
  }

  svgParts.push('</svg>');

  return {
    svg: svgParts.join('\n'),
    paperSize,
    widthMm: pw,
    heightMm: ph,
  };
}

/**
 * Generate a per-layer PCB PDF set — one SVG per layer.
 */
export function generatePcbLayerPdfs(
  data: PcbViewData,
  options: PdfExportOptions = {},
): PdfExportResult[] {
  const visibleLayers = data.layers.filter(l => l.visible);

  return visibleLayers.map((layer, idx) => {
    // Filter traces to only this layer
    const layerMapping: Record<string, string> = {
      'F.Cu': 'front',
      'B.Cu': 'back',
      'F.SilkS': 'front',
      'B.SilkS': 'back',
    };
    const side = layerMapping[layer.name] || 'front';
    const filteredData: PcbViewData = {
      ...data,
      renderMode: 'per-layer',
      traces: data.traces.filter(t => t.layer === side),
      instances: layer.name.includes('Cu') ? data.instances.filter(i => i.side === side) : [],
    };

    const layerOptions: PdfExportOptions = {
      ...options,
      titleBlock: options.titleBlock ? {
        ...options.titleBlock,
        circuitName: `${options.titleBlock.circuitName} — ${layer.name}`,
        sheetNumber: idx + 1,
        totalSheets: visibleLayers.length,
      } : undefined,
    };

    return generateViewPdf(filteredData, layerOptions);
  });
}
