import type { Shape, RectShape, CircleShape, PathShape, TextShape, GroupShape, ShapeStyle } from '../shared/component-types';
import { nanoid } from 'nanoid';

const SKIP_ELEMENTS = new Set([
  'defs', 'clippath', 'mask', 'filter', 'lineargradient', 'radialgradient',
  'stop', 'symbol', 'use', 'marker', 'pattern', 'metadata', 'title', 'desc',
  'style', 'script', 'foreignobject', 'switch', 'image',
]);

function getAttr(element: string, name: string): string | null {
  const re = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i');
  const match = element.match(re);
  if (match) return match[1];
  const reSingle = new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`, 'i');
  const matchSingle = element.match(reSingle);
  return matchSingle ? matchSingle[1] : null;
}

function numAttr(element: string, name: string, defaultVal = 0): number {
  const val = getAttr(element, name);
  if (val === null) return defaultVal;
  const n = parseFloat(val);
  return isNaN(n) ? defaultVal : n;
}

function extractStyle(element: string): ShapeStyle {
  const style: ShapeStyle = {};

  const fill = getAttr(element, 'fill');
  if (fill && fill !== 'inherit') style.fill = fill;

  const stroke = getAttr(element, 'stroke');
  if (stroke && stroke !== 'inherit') style.stroke = stroke;

  const strokeWidth = getAttr(element, 'stroke-width');
  if (strokeWidth) {
    const sw = parseFloat(strokeWidth);
    if (!isNaN(sw)) style.strokeWidth = sw;
  }

  const opacity = getAttr(element, 'opacity');
  if (opacity) {
    const op = parseFloat(opacity);
    if (!isNaN(op)) style.opacity = op;
  }

  const fontSize = getAttr(element, 'font-size');
  if (fontSize) {
    const fs = parseFloat(fontSize);
    if (!isNaN(fs)) style.fontSize = fs;
  }

  const fontFamily = getAttr(element, 'font-family');
  if (fontFamily) style.fontFamily = fontFamily;

  const styleAttr = getAttr(element, 'style');
  if (styleAttr) {
    const pairs = styleAttr.split(';');
    for (const pair of pairs) {
      const [key, value] = pair.split(':').map(s => s.trim());
      if (!key || !value) continue;
      switch (key) {
        case 'fill':
          if (value !== 'inherit') style.fill = value;
          break;
        case 'stroke':
          if (value !== 'inherit') style.stroke = value;
          break;
        case 'stroke-width': {
          const sw = parseFloat(value);
          if (!isNaN(sw)) style.strokeWidth = sw;
          break;
        }
        case 'opacity': {
          const op = parseFloat(value);
          if (!isNaN(op)) style.opacity = op;
          break;
        }
        case 'font-size': {
          const fs = parseFloat(value);
          if (!isNaN(fs)) style.fontSize = fs;
          break;
        }
        case 'font-family':
          style.fontFamily = value.replace(/['"]/g, '');
          break;
        case 'text-anchor':
          style.textAnchor = value;
          break;
      }
    }
  }

  const textAnchor = getAttr(element, 'text-anchor');
  if (textAnchor && !style.textAnchor) style.textAnchor = textAnchor;

  return style;
}

function extractTransform(element: string): { rotate: number; translateX: number; translateY: number } {
  const result = { rotate: 0, translateX: 0, translateY: 0 };
  const transform = getAttr(element, 'transform');
  if (!transform) return result;

  const rotateMatch = transform.match(/rotate\(\s*([-\d.]+)(?:\s*,\s*[-\d.]+\s*,\s*[-\d.]+)?\s*\)/);
  if (rotateMatch) {
    result.rotate = parseFloat(rotateMatch[1]) || 0;
  }

  const translateMatch = transform.match(/translate\(\s*([-\d.]+)[\s,]+([-\d.]+)\s*\)/);
  if (translateMatch) {
    result.translateX = parseFloat(translateMatch[1]) || 0;
    result.translateY = parseFloat(translateMatch[2]) || 0;
  } else {
    const translateSingle = transform.match(/translate\(\s*([-\d.]+)\s*\)/);
    if (translateSingle) {
      result.translateX = parseFloat(translateSingle[1]) || 0;
    }
  }

  return result;
}

function computePathBoundingBox(d: string): { x: number; y: number; width: number; height: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let cx = 0, cy = 0;
  let startX = 0, startY = 0;

  const commands = d.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) || [];

  function updateBounds(x: number, y: number) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  for (const cmd of commands) {
    const type = cmd[0];
    const nums = (cmd.slice(1).match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || []).map(Number);

    switch (type) {
      case 'M':
        for (let i = 0; i < nums.length; i += 2) {
          cx = nums[i]; cy = nums[i + 1];
          updateBounds(cx, cy);
          if (i === 0) { startX = cx; startY = cy; }
        }
        break;
      case 'm':
        for (let i = 0; i < nums.length; i += 2) {
          cx += nums[i]; cy += nums[i + 1];
          updateBounds(cx, cy);
          if (i === 0) { startX = cx; startY = cy; }
        }
        break;
      case 'L':
        for (let i = 0; i < nums.length; i += 2) {
          cx = nums[i]; cy = nums[i + 1];
          updateBounds(cx, cy);
        }
        break;
      case 'l':
        for (let i = 0; i < nums.length; i += 2) {
          cx += nums[i]; cy += nums[i + 1];
          updateBounds(cx, cy);
        }
        break;
      case 'H':
        for (const n of nums) { cx = n; updateBounds(cx, cy); }
        break;
      case 'h':
        for (const n of nums) { cx += n; updateBounds(cx, cy); }
        break;
      case 'V':
        for (const n of nums) { cy = n; updateBounds(cx, cy); }
        break;
      case 'v':
        for (const n of nums) { cy += n; updateBounds(cx, cy); }
        break;
      case 'C':
        for (let i = 0; i < nums.length; i += 6) {
          updateBounds(nums[i], nums[i + 1]);
          updateBounds(nums[i + 2], nums[i + 3]);
          cx = nums[i + 4]; cy = nums[i + 5];
          updateBounds(cx, cy);
        }
        break;
      case 'c':
        for (let i = 0; i < nums.length; i += 6) {
          updateBounds(cx + nums[i], cy + nums[i + 1]);
          updateBounds(cx + nums[i + 2], cy + nums[i + 3]);
          cx += nums[i + 4]; cy += nums[i + 5];
          updateBounds(cx, cy);
        }
        break;
      case 'S':
        for (let i = 0; i < nums.length; i += 4) {
          updateBounds(nums[i], nums[i + 1]);
          cx = nums[i + 2]; cy = nums[i + 3];
          updateBounds(cx, cy);
        }
        break;
      case 's':
        for (let i = 0; i < nums.length; i += 4) {
          updateBounds(cx + nums[i], cy + nums[i + 1]);
          cx += nums[i + 2]; cy += nums[i + 3];
          updateBounds(cx, cy);
        }
        break;
      case 'Q':
        for (let i = 0; i < nums.length; i += 4) {
          updateBounds(nums[i], nums[i + 1]);
          cx = nums[i + 2]; cy = nums[i + 3];
          updateBounds(cx, cy);
        }
        break;
      case 'q':
        for (let i = 0; i < nums.length; i += 4) {
          updateBounds(cx + nums[i], cy + nums[i + 1]);
          cx += nums[i + 2]; cy += nums[i + 3];
          updateBounds(cx, cy);
        }
        break;
      case 'T':
        for (let i = 0; i < nums.length; i += 2) {
          cx = nums[i]; cy = nums[i + 1];
          updateBounds(cx, cy);
        }
        break;
      case 't':
        for (let i = 0; i < nums.length; i += 2) {
          cx += nums[i]; cy += nums[i + 1];
          updateBounds(cx, cy);
        }
        break;
      case 'A':
        for (let i = 0; i < nums.length; i += 7) {
          cx = nums[i + 5]; cy = nums[i + 6];
          updateBounds(cx, cy);
        }
        break;
      case 'a':
        for (let i = 0; i < nums.length; i += 7) {
          cx += nums[i + 5]; cy += nums[i + 6];
          updateBounds(cx, cy);
        }
        break;
      case 'Z':
      case 'z':
        cx = startX; cy = startY;
        break;
    }
  }

  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 0; maxY = 0; }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function parsePoints(pointsStr: string): Array<{ x: number; y: number }> {
  const nums = pointsStr.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
  if (!nums) return [];
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < nums.length - 1; i += 2) {
    points.push({ x: parseFloat(nums[i]), y: parseFloat(nums[i + 1]) });
  }
  return points;
}

function pointsToPath(points: Array<{ x: number; y: number }>, close: boolean): string {
  if (points.length === 0) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  if (close) d += ' Z';
  return d;
}

function getInnerContent(tag: string, content: string): string | null {
  const openRe = new RegExp(`<${tag}(\\s[^>]*)?>`, 'i');
  const match = content.match(openRe);
  if (!match) return null;

  const startIdx = match.index! + match[0].length;
  const closeTag = `</${tag}>`;
  let depth = 1;
  let idx = startIdx;

  while (idx < content.length && depth > 0) {
    const nextOpen = content.indexOf(`<${tag}`, idx);
    const nextClose = content.indexOf(closeTag, idx);

    if (nextClose === -1) break;

    if (nextOpen !== -1 && nextOpen < nextClose) {
      const afterOpen = content.indexOf('>', nextOpen);
      if (afterOpen !== -1 && content[afterOpen - 1] !== '/') {
        depth++;
      }
      idx = afterOpen + 1;
    } else {
      depth--;
      if (depth === 0) {
        return content.substring(startIdx, nextClose);
      }
      idx = nextClose + closeTag.length;
    }
  }

  return content.substring(startIdx);
}

function getTextContent(element: string): string {
  return element.replace(/<[^>]*>/g, '').trim();
}

function findElements(content: string): Array<{ tag: string; fullMatch: string; innerContent: string | null }> {
  const elements: Array<{ tag: string; fullMatch: string; innerContent: string | null }> = [];

  const selfClosingRe = /<(\w[\w-]*)((?:\s+[^>]*?)?)\/>/g;
  const openTagRe = /<(\w[\w-]*)((?:\s+[^>]*?)?)>/g;

  const allTags: Array<{ index: number; tag: string; attrs: string; selfClosing: boolean }> = [];

  let m: RegExpExecArray | null;

  while ((m = selfClosingRe.exec(content)) !== null) {
    allTags.push({ index: m.index, tag: m[1].toLowerCase(), attrs: m[0], selfClosing: true });
  }

  while ((m = openTagRe.exec(content)) !== null) {
    const tag = m[1].toLowerCase();
    if (tag.startsWith('/')) continue;
    if (allTags.some(t => t.index === m!.index)) continue;
    allTags.push({ index: m.index, tag, attrs: m[0], selfClosing: false });
  }

  allTags.sort((a, b) => a.index - b.index);

  const processed = new Set<number>();

  for (const t of allTags) {
    if (processed.has(t.index)) continue;
    processed.add(t.index);

    if (t.selfClosing) {
      elements.push({ tag: t.tag, fullMatch: t.attrs, innerContent: null });
    } else {
      const inner = getInnerContent(t.tag, content.substring(t.index));
      elements.push({ tag: t.tag, fullMatch: t.attrs, innerContent: inner });
    }
  }

  return elements;
}

function parseElement(tag: string, openTag: string, innerContent: string | null, offsetX: number, offsetY: number): Shape | null {
  if (SKIP_ELEMENTS.has(tag)) return null;

  const style = extractStyle(openTag);
  const transform = extractTransform(openTag);
  const tx = offsetX + transform.translateX;
  const ty = offsetY + transform.translateY;

  switch (tag) {
    case 'rect': {
      const x = numAttr(openTag, 'x') + tx;
      const y = numAttr(openTag, 'y') + ty;
      const width = numAttr(openTag, 'width');
      const height = numAttr(openTag, 'height');
      const rx = numAttr(openTag, 'rx', 0);
      if (width <= 0 || height <= 0) return null;
      const shape: RectShape = {
        id: nanoid(),
        type: 'rect',
        x, y, width, height,
        rotation: transform.rotate,
        style: Object.keys(style).length > 0 ? style : undefined,
      };
      if (rx > 0) shape.rx = rx;
      return shape;
    }

    case 'circle': {
      const cx = numAttr(openTag, 'cx') + tx;
      const cy = numAttr(openTag, 'cy') + ty;
      const r = numAttr(openTag, 'r');
      if (r <= 0) return null;
      return {
        id: nanoid(),
        type: 'circle',
        x: cx - r, y: cy - r,
        width: r * 2, height: r * 2,
        cx, cy,
        rotation: transform.rotate,
        style: Object.keys(style).length > 0 ? style : undefined,
      } as CircleShape;
    }

    case 'ellipse': {
      const cx = numAttr(openTag, 'cx') + tx;
      const cy = numAttr(openTag, 'cy') + ty;
      const rx = numAttr(openTag, 'rx');
      const ry = numAttr(openTag, 'ry');
      if (rx <= 0 || ry <= 0) return null;
      return {
        id: nanoid(),
        type: 'circle',
        x: cx - rx, y: cy - ry,
        width: rx * 2, height: ry * 2,
        cx, cy,
        rotation: transform.rotate,
        style: Object.keys(style).length > 0 ? style : undefined,
      } as CircleShape;
    }

    case 'path': {
      const d = getAttr(openTag, 'd');
      if (!d) return null;
      const bbox = computePathBoundingBox(d);
      return {
        id: nanoid(),
        type: 'path',
        x: bbox.x + tx, y: bbox.y + ty,
        width: bbox.width, height: bbox.height,
        d,
        rotation: transform.rotate,
        style: Object.keys(style).length > 0 ? style : undefined,
      } as PathShape;
    }

    case 'text': {
      const x = numAttr(openTag, 'x') + tx;
      const y = numAttr(openTag, 'y') + ty;
      const text = innerContent !== null ? getTextContent(innerContent) : '';
      if (!text) return null;
      if (!style.fontSize) style.fontSize = 12;
      const estimatedWidth = text.length * (style.fontSize * 0.6);
      return {
        id: nanoid(),
        type: 'text',
        x, y: y - (style.fontSize || 12),
        width: estimatedWidth, height: style.fontSize || 12,
        text,
        rotation: transform.rotate,
        style,
      } as TextShape;
    }

    case 'g': {
      if (!innerContent) return null;
      const children = parseElements(innerContent, tx, ty);
      if (children.length === 0) return null;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const child of children) {
        if (child.x < minX) minX = child.x;
        if (child.y < minY) minY = child.y;
        if (child.x + child.width > maxX) maxX = child.x + child.width;
        if (child.y + child.height > maxY) maxY = child.y + child.height;
      }
      return {
        id: nanoid(),
        type: 'group',
        x: isFinite(minX) ? minX : 0,
        y: isFinite(minY) ? minY : 0,
        width: isFinite(maxX - minX) ? maxX - minX : 0,
        height: isFinite(maxY - minY) ? maxY - minY : 0,
        children,
        rotation: transform.rotate,
        style: Object.keys(style).length > 0 ? style : undefined,
      } as GroupShape;
    }

    case 'line': {
      const x1 = numAttr(openTag, 'x1') + tx;
      const y1 = numAttr(openTag, 'y1') + ty;
      const x2 = numAttr(openTag, 'x2') + tx;
      const y2 = numAttr(openTag, 'y2') + ty;
      const d = `M ${x1} ${y1} L ${x2} ${y2}`;
      const bbox = computePathBoundingBox(d);
      return {
        id: nanoid(),
        type: 'path',
        x: bbox.x, y: bbox.y,
        width: bbox.width || 1, height: bbox.height || 1,
        d,
        rotation: transform.rotate,
        style: Object.keys(style).length > 0 ? style : undefined,
      } as PathShape;
    }

    case 'polygon': {
      const pointsStr = getAttr(openTag, 'points');
      if (!pointsStr) return null;
      const points = parsePoints(pointsStr).map(p => ({ x: p.x + tx, y: p.y + ty }));
      if (points.length < 2) return null;
      const d = pointsToPath(points, true);
      const bbox = computePathBoundingBox(d);
      return {
        id: nanoid(),
        type: 'path',
        x: bbox.x, y: bbox.y,
        width: bbox.width, height: bbox.height,
        d,
        rotation: transform.rotate,
        style: Object.keys(style).length > 0 ? style : undefined,
      } as PathShape;
    }

    case 'polyline': {
      const pointsStr = getAttr(openTag, 'points');
      if (!pointsStr) return null;
      const points = parsePoints(pointsStr).map(p => ({ x: p.x + tx, y: p.y + ty }));
      if (points.length < 2) return null;
      const d = pointsToPath(points, false);
      const bbox = computePathBoundingBox(d);
      return {
        id: nanoid(),
        type: 'path',
        x: bbox.x, y: bbox.y,
        width: bbox.width, height: bbox.height,
        d,
        rotation: transform.rotate,
        style: Object.keys(style).length > 0 ? style : undefined,
      } as PathShape;
    }

    default:
      return null;
  }
}

function parseElements(content: string, offsetX = 0, offsetY = 0): Shape[] {
  const shapes: Shape[] = [];
  const elements = findElements(content);

  for (const el of elements) {
    const shape = parseElement(el.tag, el.fullMatch, el.innerContent, offsetX, offsetY);
    if (shape) shapes.push(shape);
  }

  return shapes;
}

export function parseSvgToShapes(svgContent: string): Shape[] {
  let content = svgContent
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '');

  const svgMatch = content.match(/<svg\b([^>]*)>([\s\S]*)<\/svg>/i);
  if (!svgMatch) {
    throw new Error('No valid SVG root element found');
  }

  const svgAttrs = svgMatch[1];
  const svgBody = svgMatch[2];

  const viewBox = getAttr(`<svg ${svgAttrs}>`, 'viewBox');
  let _vbX = 0, _vbY = 0;
  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/).map(Number);
    if (parts.length >= 2) {
      _vbX = parts[0] || 0;
      _vbY = parts[1] || 0;
    }
  }

  return parseElements(svgBody, 0, 0);
}
