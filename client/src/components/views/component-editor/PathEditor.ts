/**
 * PathEditor — SVG path parsing, serialization, node editing, simplification.
 *
 * Extracts all path-related pure logic from ShapeCanvas so it can be tested
 * and maintained independently.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PathNode {
  x: number;
  y: number;
  type: 'M' | 'L' | 'C' | 'Q';
  cp1?: { x: number; y: number };
  cp2?: { x: number; y: number };
}

export interface PathPoint {
  x: number;
  y: number;
  cp1?: { x: number; y: number };
  cp2?: { x: number; y: number };
}

// ---------------------------------------------------------------------------
// Parsing: SVG path `d` attribute → PathNode[]
// ---------------------------------------------------------------------------

export function pathDToNodes(d: string): PathNode[] {
  const nodes: PathNode[] = [];
  const tokens = d.match(/[MLCQSTZmlcqstz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
  if (!tokens) { return nodes; }
  let i = 0;
  let cx = 0;
  let cy = 0;
  while (i < tokens.length) {
    const cmd = tokens[i];
    if (cmd === 'M' || cmd === 'm') {
      i++;
      const x = parseFloat(tokens[i++]);
      const y = parseFloat(tokens[i++]);
      const absX = cmd === 'm' ? cx + x : x;
      const absY = cmd === 'm' ? cy + y : y;
      nodes.push({ x: absX, y: absY, type: 'M' });
      cx = absX;
      cy = absY;
    } else if (cmd === 'L' || cmd === 'l') {
      i++;
      const x = parseFloat(tokens[i++]);
      const y = parseFloat(tokens[i++]);
      const absX = cmd === 'l' ? cx + x : x;
      const absY = cmd === 'l' ? cy + y : y;
      nodes.push({ x: absX, y: absY, type: 'L' });
      cx = absX;
      cy = absY;
    } else if (cmd === 'C' || cmd === 'c') {
      i++;
      const cp1x = parseFloat(tokens[i++]);
      const cp1y = parseFloat(tokens[i++]);
      const cp2x = parseFloat(tokens[i++]);
      const cp2y = parseFloat(tokens[i++]);
      const x = parseFloat(tokens[i++]);
      const y = parseFloat(tokens[i++]);
      if (cmd === 'c') {
        nodes.push({ x: cx + x, y: cy + y, type: 'C', cp1: { x: cx + cp1x, y: cy + cp1y }, cp2: { x: cx + cp2x, y: cy + cp2y } });
        cx += x;
        cy += y;
      } else {
        nodes.push({ x, y, type: 'C', cp1: { x: cp1x, y: cp1y }, cp2: { x: cp2x, y: cp2y } });
        cx = x;
        cy = y;
      }
    } else if (cmd === 'Q' || cmd === 'q') {
      i++;
      const cp1x = parseFloat(tokens[i++]);
      const cp1y = parseFloat(tokens[i++]);
      const x = parseFloat(tokens[i++]);
      const y = parseFloat(tokens[i++]);
      if (cmd === 'q') {
        nodes.push({ x: cx + x, y: cy + y, type: 'Q', cp1: { x: cx + cp1x, y: cy + cp1y } });
        cx += x;
        cy += y;
      } else {
        nodes.push({ x, y, type: 'Q', cp1: { x: cp1x, y: cp1y } });
        cx = x;
        cy = y;
      }
    } else if (cmd === 'S' || cmd === 's') {
      i++;
      const cp2x = parseFloat(tokens[i++]);
      const cp2y = parseFloat(tokens[i++]);
      const x = parseFloat(tokens[i++]);
      const y = parseFloat(tokens[i++]);
      if (cmd === 's') {
        nodes.push({ x: cx + x, y: cy + y, type: 'C', cp2: { x: cx + cp2x, y: cy + cp2y } });
        cx += x;
        cy += y;
      } else {
        nodes.push({ x, y, type: 'C', cp2: { x: cp2x, y: cp2y } });
        cx = x;
        cy = y;
      }
    } else if (cmd === 'T' || cmd === 't') {
      i++;
      const x = parseFloat(tokens[i++]);
      const y = parseFloat(tokens[i++]);
      const absX = cmd === 't' ? cx + x : x;
      const absY = cmd === 't' ? cy + y : y;
      nodes.push({ x: absX, y: absY, type: 'Q' });
      cx = absX;
      cy = absY;
    } else if (cmd === 'Z' || cmd === 'z') {
      i++;
    } else {
      i++;
    }
  }
  return nodes;
}

// ---------------------------------------------------------------------------
// Serialization: PathNode[] → SVG `d` string
// ---------------------------------------------------------------------------

export function nodesToPathD(nodes: PathNode[]): string {
  return nodes.map((n) => {
    switch (n.type) {
      case 'M': return `M ${n.x} ${n.y}`;
      case 'L': return `L ${n.x} ${n.y}`;
      case 'C': return `C ${n.cp1?.x ?? n.x} ${n.cp1?.y ?? n.y} ${n.cp2?.x ?? n.x} ${n.cp2?.y ?? n.y} ${n.x} ${n.y}`;
      case 'Q': return `Q ${n.cp1?.x ?? n.x} ${n.cp1?.y ?? n.y} ${n.x} ${n.y}`;
      default: return '';
    }
  }).join(' ');
}

// ---------------------------------------------------------------------------
// Simplification: Ramer-Douglas-Peucker on linear segments
// ---------------------------------------------------------------------------

function perpendicularDistance(
  pt: { x: number; y: number },
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number },
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) { return Math.sqrt((pt.x - lineStart.x) ** 2 + (pt.y - lineStart.y) ** 2); }
  const t = Math.max(0, Math.min(1, ((pt.x - lineStart.x) * dx + (pt.y - lineStart.y) * dy) / lenSq));
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;
  return Math.sqrt((pt.x - projX) ** 2 + (pt.y - projY) ** 2);
}

export function simplifyPath(nodes: PathNode[], tolerance: number): PathNode[] {
  if (nodes.length <= 2) { return nodes.map((n) => ({ ...n })); }

  // Internal RDP that uses the tolerance
  function rdpTolerance(pts: PathNode[], startIdx: number, endIdx: number, keep: boolean[]): void {
    if (endIdx - startIdx <= 1) { return; }
    let maxDist = 0;
    let maxIdx = startIdx;
    for (let i = startIdx + 1; i < endIdx; i++) {
      const d = perpendicularDistance(pts[i], pts[startIdx], pts[endIdx]);
      if (d > maxDist) { maxDist = d; maxIdx = i; }
    }
    if (maxDist > tolerance) {
      keep[maxIdx] = true;
      rdpTolerance(pts, startIdx, maxIdx, keep);
      rdpTolerance(pts, maxIdx, endIdx, keep);
    }
  }

  const segments: PathNode[][] = [];
  let currentSeg: PathNode[] = [];
  for (const node of nodes) {
    if (node.type === 'M' && currentSeg.length > 0) {
      segments.push(currentSeg);
      currentSeg = [];
    }
    currentSeg.push(node);
  }
  if (currentSeg.length > 0) { segments.push(currentSeg); }

  const result: PathNode[] = [];
  for (const seg of segments) {
    if (seg.length <= 2) {
      result.push(...seg.map((n) => ({ ...n })));
      continue;
    }
    const keep = new Array<boolean>(seg.length).fill(false);
    keep[0] = true;
    keep[seg.length - 1] = true;
    rdpTolerance(seg, 0, seg.length - 1, keep);
    for (let i = 0; i < seg.length; i++) {
      if (keep[i]) {
        const node: PathNode = { x: seg[i].x, y: seg[i].y, type: seg[i].type };
        if (i === 0) { node.type = 'M'; } else { node.type = 'L'; }
        result.push(node);
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Bounds calculation from PathNode[]
// ---------------------------------------------------------------------------

export function computeNodesBounds(nodes: PathNode[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x);
    maxY = Math.max(maxY, n.y);
    if (n.cp1) {
      minX = Math.min(minX, n.cp1.x);
      minY = Math.min(minY, n.cp1.y);
      maxX = Math.max(maxX, n.cp1.x);
      maxY = Math.max(maxY, n.cp1.y);
    }
    if (n.cp2) {
      minX = Math.min(minX, n.cp2.x);
      minY = Math.min(minY, n.cp2.y);
      maxX = Math.max(maxX, n.cp2.x);
      maxY = Math.max(maxY, n.cp2.y);
    }
  }
  return { minX, minY, maxX, maxY };
}

// ---------------------------------------------------------------------------
// PathPoint[] bounds (used when finishing a new path)
// ---------------------------------------------------------------------------

export function computePathPointsBounds(points: PathPoint[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const pt of points) {
    minX = Math.min(minX, pt.x);
    minY = Math.min(minY, pt.y);
    maxX = Math.max(maxX, pt.x);
    maxY = Math.max(maxY, pt.y);
    if (pt.cp1) {
      minX = Math.min(minX, pt.cp1.x);
      minY = Math.min(minY, pt.cp1.y);
      maxX = Math.max(maxX, pt.cp1.x);
      maxY = Math.max(maxY, pt.cp1.y);
    }
    if (pt.cp2) {
      minX = Math.min(minX, pt.cp2.x);
      minY = Math.min(minY, pt.cp2.y);
      maxX = Math.max(maxX, pt.cp2.x);
      maxY = Math.max(maxY, pt.cp2.y);
    }
  }
  return { minX, minY, maxX, maxY };
}

// ---------------------------------------------------------------------------
// Convert PathPoint[] → PathNode[] (used when finishing path creation)
// ---------------------------------------------------------------------------

export function pathPointsToNodes(points: PathPoint[]): PathNode[] {
  return points.map((pt, i) => {
    if (i === 0) { return { x: pt.x, y: pt.y, type: 'M' as const }; }
    if (pt.cp1 || pt.cp2) {
      const prev = points[i - 1];
      const cp1 = pt.cp1 || { x: prev.x, y: prev.y };
      const cp2 = pt.cp2 || { x: pt.x, y: pt.y };
      return { x: pt.x, y: pt.y, type: 'C' as const, cp1, cp2 };
    }
    return { x: pt.x, y: pt.y, type: 'L' as const };
  });
}

// ---------------------------------------------------------------------------
// Toggle node type between corner ↔ smooth
// ---------------------------------------------------------------------------

export function toggleNodeType(nodes: PathNode[], index: number): PathNode[] {
  const newNodes = nodes.map((n) => {
    const copy = { ...n };
    if (copy.cp1) { copy.cp1 = { ...copy.cp1 }; }
    if (copy.cp2) { copy.cp2 = { ...copy.cp2 }; }
    return copy;
  });
  const node = newNodes[index];
  if (node.cp1 || node.cp2) {
    delete node.cp1;
    delete node.cp2;
    if (node.type !== 'M') { node.type = 'L'; }
  } else if (node.type === 'L') {
    const prev = newNodes[index - 1] || node;
    const next = newNodes[index + 1] || node;
    node.cp1 = { x: node.x - (next.x - prev.x) / 6, y: node.y - (next.y - prev.y) / 6 };
    node.cp2 = { x: node.x + (next.x - prev.x) / 6, y: node.y + (next.y - prev.y) / 6 };
    node.type = 'C';
  }
  return newNodes;
}
