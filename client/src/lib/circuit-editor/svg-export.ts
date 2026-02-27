/**
 * SVG/PNG Export Utility (Phase 12.14)
 *
 * Client-side utilities for exporting any view as SVG or PNG.
 * Works by serializing the DOM SVG element and optionally rasterizing
 * it via an offscreen canvas.
 */

// ---------------------------------------------------------------------------
// SVG Serialization
// ---------------------------------------------------------------------------

/**
 * Serialize an SVG element to a standalone SVG string with inlined styles.
 */
export function serializeSvg(svgElement: SVGSVGElement): string {
  // Clone to avoid modifying the live DOM
  const clone = svgElement.cloneNode(true) as SVGSVGElement;

  // Ensure xmlns is set
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  // Inline computed styles on all elements to make it standalone
  inlineStyles(svgElement, clone);

  // Remove any data-testid attributes from the clone
  const allElements = clone.querySelectorAll('[data-testid]');
  allElements.forEach(el => el.removeAttribute('data-testid'));

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clone);

  // Add XML declaration
  return `<?xml version="1.0" encoding="UTF-8"?>\n${svgString}`;
}

/**
 * Recursively inline computed styles from source to clone elements.
 * Only includes styles that differ from the default to keep the output clean.
 */
function inlineStyles(source: Element, clone: Element) {
  const computed = window.getComputedStyle(source);
  const defaultStyle = getDefaultStyles(source.tagName);

  const relevantProps = [
    'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin',
    'opacity', 'font-family', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline',
    'visibility', 'display', 'transform',
  ];

  const styleEntries: string[] = [];
  for (const prop of relevantProps) {
    const value = computed.getPropertyValue(prop);
    if (value && value !== defaultStyle[prop] && value !== 'none' && value !== 'normal' && value !== '0px') {
      styleEntries.push(`${prop}:${value}`);
    }
  }

  if (styleEntries.length > 0) {
    const existing = clone.getAttribute('style') || '';
    clone.setAttribute('style', existing ? `${existing};${styleEntries.join(';')}` : styleEntries.join(';'));
  }

  // Recurse into children
  const sourceChildren = source.children;
  const cloneChildren = clone.children;
  const len = Math.min(sourceChildren.length, cloneChildren.length);
  for (let i = 0; i < len; i++) {
    inlineStyles(sourceChildren[i], cloneChildren[i]);
  }
}

// Cache default styles per tag name
const defaultStyleCache = new Map<string, Record<string, string>>();

function getDefaultStyles(tagName: string): Record<string, string> {
  const cached = defaultStyleCache.get(tagName);
  if (cached) return cached;

  const el = document.createElement(tagName);
  document.body.appendChild(el);
  const computed = window.getComputedStyle(el);
  const styles: Record<string, string> = {};
  const props = ['fill', 'stroke', 'stroke-width', 'opacity', 'font-family', 'font-size', 'font-weight', 'text-anchor'];
  for (const prop of props) {
    styles[prop] = computed.getPropertyValue(prop);
  }
  document.body.removeChild(el);
  defaultStyleCache.set(tagName, styles);
  return styles;
}

// ---------------------------------------------------------------------------
// PNG Rasterization
// ---------------------------------------------------------------------------

export interface RasterOptions {
  width?: number;       // Target width in pixels (default: SVG intrinsic width or 1920)
  height?: number;      // Target height in pixels (default: maintain aspect ratio)
  scale?: number;       // Scale factor (default: 2 for retina)
  background?: string;  // Background color (default: 'white')
}

/**
 * Rasterize an SVG string to a PNG blob using an offscreen canvas.
 */
export function rasterizeSvgToPng(svgString: string, options: RasterOptions = {}): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const scale = options.scale || 2;
    const background = options.background || 'white';

    // Parse SVG dimensions from the string
    const widthMatch = /width="([\d.]+)(?:px|mm)?"/i.exec(svgString);
    const heightMatch = /height="([\d.]+)(?:px|mm)?"/i.exec(svgString);
    const viewBoxMatch = /viewBox="[\d.]+ [\d.]+ ([\d.]+) ([\d.]+)"/i.exec(svgString);

    let svgWidth = options.width || (widthMatch ? parseFloat(widthMatch[1]) : 0) || (viewBoxMatch ? parseFloat(viewBoxMatch[1]) : 0) || 1920;
    let svgHeight = options.height || (heightMatch ? parseFloat(heightMatch[1]) : 0) || (viewBoxMatch ? parseFloat(viewBoxMatch[2]) : 0) || 1080;

    // If only width specified, maintain aspect ratio
    if (options.width && !options.height && svgHeight > 0) {
      svgHeight = (options.width / svgWidth) * svgHeight;
      svgWidth = options.width;
    }

    const canvasW = Math.ceil(svgWidth * scale);
    const canvasH = Math.ceil(svgHeight * scale);

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Failed to get canvas 2d context'));
      return;
    }

    // Fill background
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Create image from SVG
    const img = new Image();
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvasW, canvasH);
      URL.revokeObjectURL(url);

      canvas.toBlob(
        (pngBlob) => {
          if (pngBlob) {
            resolve(pngBlob);
          } else {
            reject(new Error('Failed to generate PNG blob'));
          }
        },
        'image/png',
        1.0,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG image for rasterization'));
    };

    img.src = url;
  });
}

// ---------------------------------------------------------------------------
// Download Helpers
// ---------------------------------------------------------------------------

/**
 * Download an SVG string as a .svg file.
 */
export function downloadSvg(svgString: string, filename: string = 'export.svg') {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(blob, filename);
}

/**
 * Download a PNG blob as a .png file.
 */
export function downloadPng(pngBlob: Blob, filename: string = 'export.png') {
  downloadBlob(pngBlob, filename);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Convenience: Export SVG element as PNG
// ---------------------------------------------------------------------------

/**
 * Export an SVG DOM element directly to PNG file download.
 */
export async function exportSvgElementAsPng(
  svgElement: SVGSVGElement,
  filename: string = 'export.png',
  options: RasterOptions = {},
): Promise<void> {
  const svgString = serializeSvg(svgElement);
  const pngBlob = await rasterizeSvgToPng(svgString, options);
  downloadPng(pngBlob, filename);
}

/**
 * Export an SVG DOM element directly to SVG file download.
 */
export function exportSvgElementAsSvg(
  svgElement: SVGSVGElement,
  filename: string = 'export.svg',
): void {
  const svgString = serializeSvg(svgElement);
  downloadSvg(svgString, filename);
}
