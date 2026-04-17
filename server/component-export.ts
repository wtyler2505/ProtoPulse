import JSZip from 'jszip';
import { nanoid } from 'nanoid';
import type {
  PartState,
  PartMeta,
  Connector,
  Bus,
  PartViews,
  ViewData,
  Shape,
  ShapeStyle,
  RectShape,
  CircleShape,
  PathShape,
  TextShape,
  GroupShape,
} from '@shared/component-types';
import { createDefaultPartMeta, createDefaultViewData, createDefaultPartState } from '@shared/component-types';
import { sanitizeSvg as sharedSanitizeSvg } from '@shared/svg-sanitize';

// ---------------------------------------------------------------------------
// Fritzing 9px grid utilities
// ---------------------------------------------------------------------------

/**
 * Fritzing breadboard grid = 0.1" at 90 DPI = 9px per grid unit.
 * All connector positions must land on exact 9px multiples for proper
 * alignment in Fritzing's breadboard view.
 */
const FRITZING_GRID_PX = 9;

/**
 * Snap a coordinate to the nearest Fritzing 9px grid point.
 */
export function snapToFritzingGrid(value: number): number {
  return Math.round(value / FRITZING_GRID_PX) * FRITZING_GRID_PX;
}

export interface FritzingGridViolation {
  id: string;
  originalX: number;
  originalY: number;
  snappedX: number;
  snappedY: number;
}

export interface FritzingGridValidation {
  valid: boolean;
  violations: FritzingGridViolation[];
}

/**
 * Validate that all connector positions fall on the Fritzing 9px grid.
 * Returns a list of violations with the corrected (snapped) coordinates.
 */
export function validateFritzingGrid(
  positions: Array<{ id: string; x: number; y: number }>,
): FritzingGridValidation {
  const violations: FritzingGridViolation[] = [];

  for (const pos of positions) {
    const snappedX = snapToFritzingGrid(pos.x);
    const snappedY = snapToFritzingGrid(pos.y);

    if (pos.x !== snappedX || pos.y !== snappedY) {
      violations.push({
        id: pos.id,
        originalX: pos.x,
        originalY: pos.y,
        snappedX,
        snappedY,
      });
    }
  }

  return { valid: violations.length === 0, violations };
}

// ---------------------------------------------------------------------------
// Connector ID matching validation
// ---------------------------------------------------------------------------

export interface ConnectorIdValidation {
  /** True when every FZP svgId has a matching SVG element ID */
  valid: boolean;
  /** svgIds referenced in FZP XML but missing from the SVG */
  missingInSvg: string[];
  /** connector-pattern IDs in SVG that no FZP svgId references */
  orphanedInSvg: string[];
}

/**
 * Validate that every `svgId` attribute in FZP XML has a matching
 * `id` attribute in the SVG content. Mismatches cause Fritzing to
 * fail rendering the connector.
 */
export function validateConnectorIdMatching(fzpXml: string, svgContent: string): ConnectorIdValidation {
  // Extract all svgId values from FZP XML
  const svgIdRegex = /svgId="([^"]+)"/g;
  const fzpSvgIds = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = svgIdRegex.exec(fzpXml)) !== null) {
    fzpSvgIds.add(match[1]);
  }

  // Extract all id values from SVG content
  const idRegex = /\bid="([^"]+)"/g;
  const svgIds = new Set<string>();
  while ((match = idRegex.exec(svgContent)) !== null) {
    svgIds.add(match[1]);
  }

  // Check for FZP svgIds missing from SVG
  const missingInSvg: string[] = [];
  for (const svgId of Array.from(fzpSvgIds)) {
    if (!svgIds.has(svgId)) {
      missingInSvg.push(svgId);
    }
  }

  // Check for connector-pattern IDs in SVG not referenced by FZP
  const connectorPattern = /^connector\d+(pin|terminal)$/;
  const orphanedInSvg: string[] = [];
  for (const id of Array.from(svgIds)) {
    if (connectorPattern.test(id) && !fzpSvgIds.has(id)) {
      orphanedInSvg.push(id);
    }
  }

  return {
    valid: missingInSvg.length === 0,
    missingInSvg,
    orphanedInSvg,
  };
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

function sanitizeTitle(title: string): string {
  return (title || 'component').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function styleToSvgAttr(style?: ShapeStyle): string {
  if (!style) return '';
  const parts: string[] = [];
  if (style.fill) parts.push(`fill="${escapeXml(style.fill)}"`);
  if (style.stroke) parts.push(`stroke="${escapeXml(style.stroke)}"`);
  if (style.strokeWidth !== undefined) parts.push(`stroke-width="${style.strokeWidth}"`);
  if (style.opacity !== undefined) parts.push(`opacity="${style.opacity}"`);
  if (style.fontSize !== undefined) parts.push(`font-size="${style.fontSize}"`);
  if (style.fontFamily) parts.push(`font-family="${escapeXml(style.fontFamily)}"`);
  if (style.textAnchor) parts.push(`text-anchor="${escapeXml(style.textAnchor)}"`);
  return parts.join(' ');
}

function rotationTransform(shape: { x: number; y: number; width: number; height: number; rotation: number }): string {
  if (!shape.rotation) return '';
  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;
  return ` transform="rotate(${shape.rotation}, ${cx}, ${cy})"`;
}

function shapeToSvg(shape: Shape): string {
  const styleAttr = styleToSvgAttr(shape.style);
  const rot = rotationTransform(shape);

  switch (shape.type) {
    case 'rect': {
      const rx = shape.rx ? ` rx="${shape.rx}"` : '';
      return `<rect id="${escapeXml(shape.id)}" x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}"${rx} ${styleAttr}${rot}/>`;
    }
    case 'circle': {
      const r = shape.width / 2;
      return `<circle id="${escapeXml(shape.id)}" cx="${shape.cx}" cy="${shape.cy}" r="${r}" ${styleAttr}${rot}/>`;
    }
    case 'path':
      return `<path id="${escapeXml(shape.id)}" d="${escapeXml(shape.d)}" ${styleAttr}${rot}/>`;
    case 'text':
      return `<text id="${escapeXml(shape.id)}" x="${shape.x}" y="${shape.y}" ${styleAttr}${rot}>${escapeXml(shape.text)}</text>`;
    case 'group': {
      const children = (shape.children || []).map(shapeToSvg).join('\n  ');
      return `<g id="${escapeXml(shape.id)}"${rot}>\n  ${children}\n</g>`;
    }
    default:
      return '';
  }
}

function buildSvg(viewData: ViewData, connectors: Connector[], viewName: string): string {
  let maxW = 200;
  let maxH = 200;
  for (const s of viewData.shapes) {
    const right = s.x + s.width;
    const bottom = s.y + s.height;
    if (right > maxW) maxW = right;
    if (bottom > maxH) maxH = bottom;
  }
  maxW += 20;
  maxH += 20;

  const shapesSvg = viewData.shapes.map(shapeToSvg).join('\n  ');

  const isBreadboard = viewName === 'breadboard';
  const pinsSvg = connectors.map((c, i) => {
    const pos = c.terminalPositions?.[viewName];
    if (!pos) return '';
    // Snap to Fritzing 9px grid for breadboard view compatibility
    const cx = isBreadboard ? snapToFritzingGrid(pos.x) : pos.x;
    const cy = isBreadboard ? snapToFritzingGrid(pos.y) : pos.y;
    return `<circle id="connector${i}pin" cx="${cx}" cy="${cy}" r="3" fill="none" stroke="none"/>`;
  }).filter(Boolean).join('\n  ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${maxW} ${maxH}">
  ${shapesSvg}
  ${pinsSvg}
</svg>`;
}

function buildFzpXml(partState: PartState, sanitized: string): string {
  const meta = partState.meta;
  const tagsXml = meta.tags.map(t => `    <tag>${escapeXml(t)}</tag>`).join('\n');
  const propsXml = (meta.properties || []).map(p =>
    `    <property name="${escapeXml(p.key)}">${escapeXml(p.value)}</property>`
  ).join('\n');

  const connectorsXml = partState.connectors.map((c, i) => {
    const viewsInner = ['breadboard', 'schematic', 'pcb'].map(v => {
      const viewTag = v === 'breadboard' ? 'breadboardView' : v === 'schematic' ? 'schematicView' : 'pcbView';
      const pos = c.terminalPositions?.[v];
      const pAttr = pos ? ` svgId="connector${i}pin" terminalId="connector${i}terminal"` : '';
      return `        <${viewTag}>
          <p layer="${v}"${pAttr}/>
        </${viewTag}>`;
    }).join('\n');

    return `    <connector id="connector${i}" name="${escapeXml(c.name)}" type="${c.connectorType}">
      ${c.description ? `<description>${escapeXml(c.description)}</description>` : ''}
      <views>
${viewsInner}
      </views>
    </connector>`;
  }).join('\n');

  const busesXml = partState.buses.length > 0
    ? `  <buses>\n${partState.buses.map(b => {
        const members = b.connectorIds.map((cId, _) => {
          const idx = partState.connectors.findIndex(c => c.id === cId);
          return idx >= 0 ? `      <nodeMember connectorId="connector${idx}"/>` : '';
        }).filter(Boolean).join('\n');
        return `    <bus id="${escapeXml(b.id)}" name="${escapeXml(b.name)}">\n${members}\n    </bus>`;
      }).join('\n')}\n  </buses>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<module fritzingVersion="0.9.10">
  <title>${escapeXml(meta.title || 'Untitled')}</title>
  ${meta.description ? `<description>${escapeXml(meta.description)}</description>` : '<description/>'}
  <tags>
${tagsXml}
  </tags>
  <properties>
    ${meta.family ? `<property name="family">${escapeXml(meta.family)}</property>` : ''}
    ${meta.manufacturer ? `<property name="manufacturer">${escapeXml(meta.manufacturer)}</property>` : ''}
    ${meta.mpn ? `<property name="mpn">${escapeXml(meta.mpn)}</property>` : ''}
    ${meta.mountingType ? `<property name="mounting">${escapeXml(meta.mountingType)}</property>` : ''}
    ${meta.packageType ? `<property name="package">${escapeXml(meta.packageType)}</property>` : ''}
${propsXml}
  </properties>
  <views>
    <breadboardView>
      <layers image="svg.breadboard.${sanitized}.svg"/>
    </breadboardView>
    <schematicView>
      <layers image="svg.schematic.${sanitized}.svg"/>
    </schematicView>
    <pcbView>
      <layers image="svg.pcb.${sanitized}.svg"/>
    </pcbView>
  </views>
  <connectors>
${connectorsXml}
  </connectors>
${busesXml}
</module>`;
}

export async function exportToFzpz(partState: PartState): Promise<Buffer> {
  const sanitized = sanitizeTitle(partState.meta.title);
  const fzpXml = buildFzpXml(partState, sanitized);

  const bbSvg = buildSvg(partState.views.breadboard || { shapes: [] }, partState.connectors, 'breadboard');
  const schSvg = buildSvg(partState.views.schematic || { shapes: [] }, partState.connectors, 'schematic');
  const pcbSvg = buildSvg(partState.views.pcb || { shapes: [] }, partState.connectors, 'pcb');

  const zip = new JSZip();
  zip.file('part.fzp', fzpXml);
  zip.file(`svg.breadboard.${sanitized}.svg`, bbSvg);
  zip.file(`svg.schematic.${sanitized}.svg`, schSvg);
  zip.file(`svg.pcb.${sanitized}.svg`, pcbSvg);

  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  return buf;
}

function getTagContent(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m = xml.match(re);
  return m ? m[1].trim() : '';
}

function getAllMatches(xml: string, regex: RegExp): RegExpExecArray[] {
  const results: RegExpExecArray[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match);
  }
  return results;
}

function getAttr(tag: string, attr: string): string {
  const re = new RegExp(`${attr}\\s*=\\s*"([^"]*)"`, 'i');
  const m = tag.match(re);
  return m ? m[1] : '';
}

function parseStyleFromAttrs(tag: string): ShapeStyle {
  const style: ShapeStyle = {};
  const fill = getAttr(tag, 'fill');
  if (fill && fill !== 'none') style.fill = fill;
  const stroke = getAttr(tag, 'stroke');
  if (stroke && stroke !== 'none') style.stroke = stroke;
  const sw = getAttr(tag, 'stroke-width');
  if (sw) style.strokeWidth = parseFloat(sw);
  const op = getAttr(tag, 'opacity');
  if (op) style.opacity = parseFloat(op);
  const fs = getAttr(tag, 'font-size');
  if (fs) style.fontSize = parseFloat(fs);
  const ff = getAttr(tag, 'font-family');
  if (ff) style.fontFamily = ff;
  const ta = getAttr(tag, 'text-anchor');
  if (ta) style.textAnchor = ta;
  return style;
}

function parseRotation(tag: string): number {
  const transform = getAttr(tag, 'transform');
  if (!transform) return 0;
  const m = transform.match(/rotate\(\s*([\d.-]+)/);
  return m ? parseFloat(m[1]) : 0;
}

/**
 * Sanitizes SVG content by stripping dangerous elements and attributes
 * that could be used for XSS attacks in imported FZPZ component files.
 *
 * Backed by isomorphic-dompurify (see shared/svg-sanitize.ts). The prior
 * regex implementation had 20+ known XSS bypasses (self-closing script,
 * mutation XSS via nested tags, data:text/html, vbscript:, <animate>,
 * <iframe>/<embed>/<object>, <style>, <meta>, <link>, billion-laughs,
 * XXE, etc.) all documented in client/src/lib/__tests__/svg-sanitize.test.ts.
 */
function sanitizeSvgContent(svgString: string): string {
  return sharedSanitizeSvg(svgString);
}

function parseSvgShapes(svgContent: string): Shape[] {
  const shapes: Shape[] = [];

  const rectRe = /<rect\s[^>]*?\/?>/gi;
  for (const m of getAllMatches(svgContent, rectRe)) {
    const tag = m[0];
    const id = getAttr(tag, 'id') || nanoid(8);
    if (id.startsWith('connector')) continue;
    const x = parseFloat(getAttr(tag, 'x') || '0');
    const y = parseFloat(getAttr(tag, 'y') || '0');
    const w = parseFloat(getAttr(tag, 'width') || '0');
    const h = parseFloat(getAttr(tag, 'height') || '0');
    const rx = parseFloat(getAttr(tag, 'rx') || '0');
    const shape: RectShape = {
      id, type: 'rect', x, y, width: w, height: h,
      rotation: parseRotation(tag),
      style: parseStyleFromAttrs(tag),
    };
    if (rx) shape.rx = rx;
    shapes.push(shape);
  }

  const circleRe = /<circle\s[^>]*?\/?>/gi;
  for (const m of getAllMatches(svgContent, circleRe)) {
    const tag = m[0];
    const id = getAttr(tag, 'id') || nanoid(8);
    if (id.startsWith('connector')) continue;
    const cx = parseFloat(getAttr(tag, 'cx') || '0');
    const cy = parseFloat(getAttr(tag, 'cy') || '0');
    const r = parseFloat(getAttr(tag, 'r') || '0');
    const shape: CircleShape = {
      id, type: 'circle',
      x: cx - r, y: cy - r, width: r * 2, height: r * 2,
      cx, cy,
      rotation: parseRotation(tag),
      style: parseStyleFromAttrs(tag),
    };
    shapes.push(shape);
  }

  const pathRe = /<path\s[^>]*?\/?>/gi;
  for (const m of getAllMatches(svgContent, pathRe)) {
    const tag = m[0];
    const id = getAttr(tag, 'id') || nanoid(8);
    const d = getAttr(tag, 'd');
    if (!d) continue;
    const shape: PathShape = {
      id, type: 'path',
      x: 0, y: 0, width: 0, height: 0,
      d,
      rotation: parseRotation(tag),
      style: parseStyleFromAttrs(tag),
    };
    shapes.push(shape);
  }

  const textRe = /<text\s([^>]*)>([\s\S]*?)<\/text>/gi;
  for (const m of getAllMatches(svgContent, textRe)) {
    const tag = m[0];
    const attrs = m[1];
    const text = m[2].replace(/<[^>]*>/g, '').trim();
    const id = getAttr(tag, 'id') || nanoid(8);
    const x = parseFloat(getAttr(tag, 'x') || '0');
    const y = parseFloat(getAttr(tag, 'y') || '0');
    const shape: TextShape = {
      id, type: 'text',
      x, y, width: 80, height: 20,
      text,
      rotation: parseRotation(tag),
      style: parseStyleFromAttrs(tag),
    };
    shapes.push(shape);
  }

  return shapes;
}

function parseFzpConnectors(fzpXml: string): Connector[] {
  const connectors: Connector[] = [];
  const connectorRe = /<connector\s([^>]*)>([\s\S]*?)<\/connector>/gi;

  for (const m of getAllMatches(fzpXml, connectorRe)) {
    const attrs = m[1];
    const body = m[2];
    const id = getAttr(`<c ${attrs}>`, 'id') || `pin${connectors.length}`;
    const name = getAttr(`<c ${attrs}>`, 'name') || id;
    const type = getAttr(`<c ${attrs}>`, 'type') || 'pad';

    const descMatch = body.match(/<description>([\s\S]*?)<\/description>/i);
    const description = descMatch ? descMatch[1].trim() : undefined;

    const terminalPositions: Record<string, { x: number; y: number }> = {};
    const shapeIds: Record<string, string[]> = {};

    for (const viewName of ['breadboard', 'schematic', 'pcb']) {
      const viewTag = viewName === 'breadboard' ? 'breadboardView' : viewName === 'schematic' ? 'schematicView' : 'pcbView';
      const viewRe = new RegExp(`<${viewTag}>[\\s\\S]*?</${viewTag}>`, 'i');
      const viewMatch = body.match(viewRe);
      if (viewMatch) {
        const pRe = /<p\s([^>]*)\/?>/i;
        const pMatch = viewMatch[0].match(pRe);
        if (pMatch) {
          const svgId = getAttr(`<p ${pMatch[1]}>`, 'svgId');
          if (svgId) {
            shapeIds[viewName] = [svgId];
          }
        }
        terminalPositions[viewName] = { x: 0, y: 0 };
      }
    }

    const connectorType = (type === 'male' || type === 'female') ? type : 'pad' as const;

    connectors.push({
      id: `pin${connectors.length + 1}`,
      name,
      description,
      connectorType,
      shapeIds,
      terminalPositions,
    });
  }

  return connectors;
}

function parseFzpBuses(fzpXml: string, connectors: Connector[]): Bus[] {
  const buses: Bus[] = [];
  const busRe = /<bus\s([^>]*)>([\s\S]*?)<\/bus>/gi;

  for (const m of getAllMatches(fzpXml, busRe)) {
    const attrs = m[1];
    const body = m[2];
    const id = getAttr(`<b ${attrs}>`, 'id') || nanoid(8);
    const name = getAttr(`<b ${attrs}>`, 'name') || id;

    const memberRe = /connectorId\s*=\s*"([^"]*)"/gi;
    const connectorIds: string[] = [];
    for (const mem of getAllMatches(body, memberRe)) {
      const connId = mem[1];
      const idx = parseInt(connId.replace('connector', ''), 10);
      if (!isNaN(idx) && connectors[idx]) {
        connectorIds.push(connectors[idx].id);
      }
    }

    buses.push({ id, name, connectorIds });
  }

  return buses;
}

const MAX_ZIP_FILES = 20;
const MAX_UNCOMPRESSED_SIZE = 50 * 1024 * 1024;

export async function importFromFzpz(buffer: Buffer): Promise<PartState> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error('Invalid FZPZ file: could not read ZIP archive');
  }

  const fileEntries = Object.entries(zip.files).filter(([, f]) => !f.dir);
  if (fileEntries.length > MAX_ZIP_FILES) {
    throw new Error(`FZPZ file contains too many entries (${fileEntries.length}, max ${MAX_ZIP_FILES})`);
  }

  let totalUncompressed = 0;

  let fzpContent = '';
  let fzpFound = false;
  for (const [filename, file] of fileEntries) {
    if (filename.endsWith('.fzp') && !file.dir) {
      const content = await file.async('string');
      totalUncompressed += Buffer.byteLength(content, 'utf8');
      if (totalUncompressed > MAX_UNCOMPRESSED_SIZE) {
        throw new Error(`FZPZ file uncompressed content too large (max ${MAX_UNCOMPRESSED_SIZE / 1024 / 1024}MB)`);
      }
      fzpContent = content;
      fzpFound = true;
      break;
    }
  }

  if (!fzpFound) {
    throw new Error('Invalid FZPZ file: no .fzp file found in archive');
  }

  const title = getTagContent(fzpContent, 'title') || 'Imported Component';
  const description = getTagContent(fzpContent, 'description') || '';

  const tagsContent = getTagContent(fzpContent, 'tags');
  const tags: string[] = [];
  const tagRe = /<tag>([\s\S]*?)<\/tag>/gi;
  for (const m of getAllMatches(tagsContent, tagRe)) {
    const t = m[1].trim();
    if (t) tags.push(t);
  }

  const propsContent = getTagContent(fzpContent, 'properties');
  const properties: { key: string; value: string }[] = [];
  let family = '';
  let manufacturer = '';
  let mpn = '';
  let mountingType: PartMeta['mountingType'] = '';
  let packageType = '';

  const propRe = /<property\s+name="([^"]*)">([\s\S]*?)<\/property>/gi;
  for (const m of getAllMatches(propsContent, propRe)) {
    const key = m[1];
    const value = m[2].trim();
    if (key === 'family') { family = value; continue; }
    if (key === 'manufacturer') { manufacturer = value; continue; }
    if (key === 'mpn') { mpn = value; continue; }
    if (key === 'mounting') {
      mountingType = (value === 'tht' || value === 'smd' || value === 'other') ? value : '';
      continue;
    }
    if (key === 'package') { packageType = value; continue; }
    properties.push({ key, value });
  }

  const meta: PartMeta = {
    title, description, tags, properties,
    family: family || undefined,
    manufacturer: manufacturer || undefined,
    mpn: mpn || undefined,
    mountingType,
    packageType: packageType || undefined,
  };

  const connectors = parseFzpConnectors(fzpContent);
  const buses = parseFzpBuses(fzpContent, connectors);

  const views: PartViews = {
    breadboard: createDefaultViewData(),
    schematic: createDefaultViewData(),
    pcb: createDefaultViewData(),
  };

  for (const [filename, file] of Object.entries(zip.files)) {
    if (file.dir || !filename.endsWith('.svg')) continue;
    const rawSvgContent = await file.async('string');
    totalUncompressed += Buffer.byteLength(rawSvgContent, 'utf8');
    if (totalUncompressed > MAX_UNCOMPRESSED_SIZE) {
      throw new Error(`FZPZ file uncompressed content too large (max ${MAX_UNCOMPRESSED_SIZE / 1024 / 1024}MB)`);
    }
    const svgContent = sanitizeSvgContent(rawSvgContent);
    const lowerName = filename.toLowerCase();

    let viewKey: 'breadboard' | 'schematic' | 'pcb' | null = null;
    if (lowerName.includes('breadboard')) viewKey = 'breadboard';
    else if (lowerName.includes('schematic')) viewKey = 'schematic';
    else if (lowerName.includes('pcb')) viewKey = 'pcb';

    if (viewKey) {
      views[viewKey] = { shapes: parseSvgShapes(svgContent) };
    }
  }

  return { meta, connectors, buses, views };
}
