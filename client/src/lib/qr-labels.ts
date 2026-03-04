/**
 * QR Code Label Generator
 *
 * Generates printable inventory labels with a visual QR-style pattern
 * and human-readable component information. Designed for makers who
 * want to label storage bins, bags, or shelves with component data.
 *
 * The QR "code" area uses a deterministic checkerboard-like pattern
 * derived from the encoded data. For actual scanning, integrate a
 * real QR library (e.g., qrcode) to replace generateQRPattern().
 *
 * Usage:
 *   const svg = generateLabelSVG({ id: '1', name: 'ATmega328P' });
 *   const page = generatePrintPage(items, { columns: 3 });
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QRLabelItem {
  id: string;
  name: string;
  location?: string;
  quantity?: number;
  partNumber?: string;
  category?: string;
}

export interface QRLabelOptions {
  /** Pixel size of the label (width). Default 200. */
  size?: number;
  /** Include human-readable text below the pattern. Default true. */
  includeText?: boolean;
  /** Output format. Default 'svg'. */
  format?: 'svg' | 'dataurl';
}

export interface PrintPageOptions {
  /** Number of label columns per row. Default 3. */
  columns?: number;
  /** Individual label size in pixels. Default 200. */
  labelSize?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_SIZE = 200;
const DEFAULT_COLUMNS = 3;
const QR_GRID_MODULES = 21; // 21x21 module grid (Version 1 QR standard size)
const QR_PREFIX = 'PP:'; // ProtoPulse data prefix for identification

// ---------------------------------------------------------------------------
// Data encoding / decoding
// ---------------------------------------------------------------------------

/**
 * Encode a QRLabelItem as a compact prefixed JSON string.
 * Only includes fields that have values to minimize data size.
 */
export function encodeQRData(item: QRLabelItem): string {
  const compact: Record<string, string | number> = { i: item.id, n: item.name };
  if (item.location != null && item.location !== '') {
    compact.l = item.location;
  }
  if (item.quantity != null) {
    compact.q = item.quantity;
  }
  if (item.partNumber != null && item.partNumber !== '') {
    compact.p = item.partNumber;
  }
  if (item.category != null && item.category !== '') {
    compact.c = item.category;
  }
  return QR_PREFIX + JSON.stringify(compact);
}

/**
 * Parse a QR data string back into a QRLabelItem.
 * Returns null if the data is malformed or missing required fields.
 */
export function parseQRData(data: string): QRLabelItem | null {
  try {
    if (!data.startsWith(QR_PREFIX)) {
      return null;
    }
    const json = data.slice(QR_PREFIX.length);
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    const obj = parsed as Record<string, unknown>;

    // Required fields
    if (typeof obj.i !== 'string' || typeof obj.n !== 'string') {
      return null;
    }

    const item: QRLabelItem = {
      id: obj.i,
      name: obj.n,
    };

    if (typeof obj.l === 'string' && obj.l !== '') {
      item.location = obj.l;
    }
    if (typeof obj.q === 'number' && Number.isFinite(obj.q)) {
      item.quantity = obj.q;
    }
    if (typeof obj.p === 'string' && obj.p !== '') {
      item.partNumber = obj.p;
    }
    if (typeof obj.c === 'string' && obj.c !== '') {
      item.category = obj.c;
    }

    return item;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// QR pattern generation (visual stand-in)
// ---------------------------------------------------------------------------

/**
 * Simple string hash producing a 32-bit integer (djb2 algorithm).
 */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

/**
 * Generate a deterministic QR-like boolean grid from data.
 * Uses the data hash to seed a pseudo-random pattern, then overlays
 * QR finder patterns in three corners for visual authenticity.
 */
function generateQRPattern(data: string): boolean[][] {
  const grid: boolean[][] = [];
  const seed = hashString(data);

  // Fill with pseudo-random modules seeded from data
  for (let row = 0; row < QR_GRID_MODULES; row++) {
    grid[row] = [];
    for (let col = 0; col < QR_GRID_MODULES; col++) {
      const cellSeed = hashString(`${seed}:${row}:${col}`);
      grid[row][col] = (cellSeed & 1) === 1;
    }
  }

  // Overlay finder patterns (7x7 squares in three corners)
  const finderOffsets = [
    [0, 0],
    [0, QR_GRID_MODULES - 7],
    [QR_GRID_MODULES - 7, 0],
  ];

  for (const [offRow, offCol] of finderOffsets) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isEdge = r === 0 || r === 6 || c === 0 || c === 6;
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        grid[offRow + r][offCol + c] = isEdge || isInner;
      }
    }
  }

  return grid;
}

// ---------------------------------------------------------------------------
// SVG generation
// ---------------------------------------------------------------------------

/**
 * Escape a string for safe inclusion in XML/SVG attributes and text.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Truncate a string to maxLen characters, adding ellipsis if needed.
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) {
    return str;
  }
  return str.slice(0, maxLen - 1) + '\u2026';
}

/**
 * Generate a single label SVG for a component.
 *
 * Layout:
 *   - QR pattern area (square, centered horizontally)
 *   - Component name (bold)
 *   - Part number (if present)
 *   - Location and quantity line
 */
export function generateLabelSVG(item: QRLabelItem, options?: QRLabelOptions): string {
  const size = options?.size ?? DEFAULT_SIZE;
  const includeText = options?.includeText ?? true;
  const format = options?.format ?? 'svg';

  const data = encodeQRData(item);
  const grid = generateQRPattern(data);

  const qrAreaSize = Math.floor(size * 0.55);
  const moduleSize = qrAreaSize / QR_GRID_MODULES;
  const qrOffsetX = Math.floor((size - qrAreaSize) / 2);
  const qrOffsetY = 10;

  // Build QR module rectangles
  const modules: string[] = [];
  for (let row = 0; row < QR_GRID_MODULES; row++) {
    for (let col = 0; col < QR_GRID_MODULES; col++) {
      if (grid[row][col]) {
        const x = qrOffsetX + col * moduleSize;
        const y = qrOffsetY + row * moduleSize;
        modules.push(
          `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${moduleSize.toFixed(2)}" height="${moduleSize.toFixed(2)}" fill="#000"/>`,
        );
      }
    }
  }

  // Text lines
  const textLines: string[] = [];
  if (includeText) {
    const textStartY = qrOffsetY + qrAreaSize + 16;
    const fontSize = Math.max(8, Math.floor(size * 0.055));
    const lineHeight = fontSize + 4;
    const maxChars = Math.floor(size / (fontSize * 0.55));
    let lineIndex = 0;

    // Component name (bold)
    textLines.push(
      `<text x="${size / 2}" y="${textStartY + lineIndex * lineHeight}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#000">${escapeXml(truncate(item.name, maxChars))}</text>`,
    );
    lineIndex++;

    // Part number
    if (item.partNumber) {
      textLines.push(
        `<text x="${size / 2}" y="${textStartY + lineIndex * lineHeight}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize - 1}" fill="#333">${escapeXml(truncate(item.partNumber, maxChars))}</text>`,
      );
      lineIndex++;
    }

    // Location + quantity
    const details: string[] = [];
    if (item.location) {
      details.push(item.location);
    }
    if (item.quantity != null) {
      details.push(`Qty: ${item.quantity}`);
    }
    if (details.length > 0) {
      textLines.push(
        `<text x="${size / 2}" y="${textStartY + lineIndex * lineHeight}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize - 1}" fill="#555">${escapeXml(truncate(details.join(' | '), maxChars))}</text>`,
      );
      lineIndex++;
    }

    // Category
    if (item.category) {
      textLines.push(
        `<text x="${size / 2}" y="${textStartY + lineIndex * lineHeight}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize - 2}" fill="#777">${escapeXml(truncate(item.category, maxChars))}</text>`,
      );
    }
  }

  // Calculate total height
  const textHeight = includeText ? 80 : 10;
  const totalHeight = qrOffsetY + qrAreaSize + textHeight;

  const svgContent = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${totalHeight}" viewBox="0 0 ${size} ${totalHeight}">`,
    `<rect width="${size}" height="${totalHeight}" fill="#fff" rx="4"/>`,
    `<rect x="${qrOffsetX}" y="${qrOffsetY}" width="${qrAreaSize}" height="${qrAreaSize}" fill="#fff" stroke="#ddd" stroke-width="0.5"/>`,
    ...modules,
    ...textLines,
    '</svg>',
  ].join('\n');

  if (format === 'dataurl') {
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgContent)));
  }

  return svgContent;
}

// ---------------------------------------------------------------------------
// Batch operations
// ---------------------------------------------------------------------------

/**
 * Generate label SVGs for multiple items.
 */
export function generateBatchLabels(items: QRLabelItem[], options?: QRLabelOptions): string[] {
  return items.map((item) => generateLabelSVG(item, options));
}

/**
 * Generate a complete HTML page with a grid of labels, ready for printing.
 *
 * The page includes print-optimized CSS with page break handling
 * and a grid layout matching the requested column count.
 */
export function generatePrintPage(
  items: QRLabelItem[],
  options?: PrintPageOptions,
): string {
  const columns = options?.columns ?? DEFAULT_COLUMNS;
  const labelSize = options?.labelSize ?? DEFAULT_SIZE;

  const labels = generateBatchLabels(items, { size: labelSize, includeText: true, format: 'svg' });

  const labelCells = labels
    .map(
      (svg) =>
        `<div class="label-cell">${svg}</div>`,
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>ProtoPulse Inventory Labels</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; padding: 10mm; }
  .label-grid {
    display: grid;
    grid-template-columns: repeat(${columns}, 1fr);
    gap: 8px;
  }
  .label-cell {
    border: 1px dashed #ccc;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .label-cell svg { max-width: 100%; height: auto; }
  @media print {
    body { padding: 5mm; }
    .label-cell { border-color: #eee; }
  }
</style>
</head>
<body>
<div class="label-grid">
${labelCells}
</div>
</body>
</html>`;
}
