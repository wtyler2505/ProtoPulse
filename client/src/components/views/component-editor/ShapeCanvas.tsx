import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useComponentEditor } from '@/lib/component-editor/ComponentEditorProvider';
import type { Shape, RectShape, CircleShape, PathShape, TextShape, GroupShape, Connector, DRCViolation, Constraint } from '@shared/component-types';
import { getShapeCenter, detectConflicts } from '@/lib/component-editor/constraint-solver';
import { nanoid } from 'nanoid';
import { MousePointer2, Square, Circle as CircleIcon, Type, MapPin, Minus, Maximize2, Ruler, ImageIcon, Lock, Unlock, X, Layers, Spline } from 'lucide-react';
import { computeSnap, getShapeBounds, type SnapTarget } from '@/lib/component-editor/snap-engine';
import SnapGuides from './SnapGuides';
import RulerOverlay, { type Measurement } from './RulerOverlay';
import LayerPanel, { getDefaultLayerConfig } from './LayerPanel';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;
const GRID_SIZE = 10;
const SEL = '#00F0FF';

interface PathNode {
  x: number;
  y: number;
  type: 'M' | 'L' | 'C' | 'Q';
  cp1?: { x: number; y: number };
  cp2?: { x: number; y: number };
}

function pathDToNodes(d: string): PathNode[] {
  const nodes: PathNode[] = [];
  const tokens = d.match(/[MLCQSTZmlcqstz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
  if (!tokens) return nodes;
  let i = 0;
  let cx = 0, cy = 0;
  while (i < tokens.length) {
    const cmd = tokens[i];
    if (cmd === 'M' || cmd === 'm') {
      i++;
      const x = parseFloat(tokens[i++]);
      const y = parseFloat(tokens[i++]);
      const absX = cmd === 'm' ? cx + x : x;
      const absY = cmd === 'm' ? cy + y : y;
      nodes.push({ x: absX, y: absY, type: 'M' });
      cx = absX; cy = absY;
    } else if (cmd === 'L' || cmd === 'l') {
      i++;
      const x = parseFloat(tokens[i++]);
      const y = parseFloat(tokens[i++]);
      const absX = cmd === 'l' ? cx + x : x;
      const absY = cmd === 'l' ? cy + y : y;
      nodes.push({ x: absX, y: absY, type: 'L' });
      cx = absX; cy = absY;
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
        cx += x; cy += y;
      } else {
        nodes.push({ x, y, type: 'C', cp1: { x: cp1x, y: cp1y }, cp2: { x: cp2x, y: cp2y } });
        cx = x; cy = y;
      }
    } else if (cmd === 'Q' || cmd === 'q') {
      i++;
      const cp1x = parseFloat(tokens[i++]);
      const cp1y = parseFloat(tokens[i++]);
      const x = parseFloat(tokens[i++]);
      const y = parseFloat(tokens[i++]);
      if (cmd === 'q') {
        nodes.push({ x: cx + x, y: cy + y, type: 'Q', cp1: { x: cx + cp1x, y: cy + cp1y } });
        cx += x; cy += y;
      } else {
        nodes.push({ x, y, type: 'Q', cp1: { x: cp1x, y: cp1y } });
        cx = x; cy = y;
      }
    } else if (cmd === 'S' || cmd === 's') {
      i++;
      const cp2x = parseFloat(tokens[i++]);
      const cp2y = parseFloat(tokens[i++]);
      const x = parseFloat(tokens[i++]);
      const y = parseFloat(tokens[i++]);
      if (cmd === 's') {
        nodes.push({ x: cx + x, y: cy + y, type: 'C', cp2: { x: cx + cp2x, y: cy + cp2y } });
        cx += x; cy += y;
      } else {
        nodes.push({ x, y, type: 'C', cp2: { x: cp2x, y: cp2y } });
        cx = x; cy = y;
      }
    } else if (cmd === 'T' || cmd === 't') {
      i++;
      const x = parseFloat(tokens[i++]);
      const y = parseFloat(tokens[i++]);
      const absX = cmd === 't' ? cx + x : x;
      const absY = cmd === 't' ? cy + y : y;
      nodes.push({ x: absX, y: absY, type: 'Q' });
      cx = absX; cy = absY;
    } else if (cmd === 'Z' || cmd === 'z') {
      i++;
    } else {
      i++;
    }
  }
  return nodes;
}

function nodesToPathD(nodes: PathNode[]): string {
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

function simplifyPath(nodes: PathNode[], tolerance: number): PathNode[] {
  if (nodes.length <= 2) return [...nodes];
  function perpendicularDistance(pt: { x: number; y: number }, lineStart: { x: number; y: number }, lineEnd: { x: number; y: number }): number {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.sqrt((pt.x - lineStart.x) ** 2 + (pt.y - lineStart.y) ** 2);
    const t = Math.max(0, Math.min(1, ((pt.x - lineStart.x) * dx + (pt.y - lineStart.y) * dy) / lenSq));
    const projX = lineStart.x + t * dx;
    const projY = lineStart.y + t * dy;
    return Math.sqrt((pt.x - projX) ** 2 + (pt.y - projY) ** 2);
  }
  function rdp(pts: PathNode[], startIdx: number, endIdx: number, keep: boolean[]): void {
    if (endIdx - startIdx <= 1) return;
    let maxDist = 0;
    let maxIdx = startIdx;
    for (let i = startIdx + 1; i < endIdx; i++) {
      const d = perpendicularDistance(pts[i], pts[startIdx], pts[endIdx]);
      if (d > maxDist) { maxDist = d; maxIdx = i; }
    }
    if (maxDist > tolerance) {
      keep[maxIdx] = true;
      rdp(pts, startIdx, maxIdx, keep);
      rdp(pts, maxIdx, endIdx, keep);
    }
  }
  const keep = new Array(nodes.length).fill(false);
  keep[0] = true;
  keep[nodes.length - 1] = true;
  rdp(nodes, 0, nodes.length - 1, keep);
  const result: PathNode[] = [];
  for (let i = 0; i < nodes.length; i++) {
    if (keep[i]) {
      const node = { ...nodes[i] };
      if (node.cp1) node.cp1 = { ...node.cp1 };
      if (node.cp2) node.cp2 = { ...node.cp2 };
      result.push(node);
    }
  }
  if (result.length > 0) result[0] = { ...result[0], type: 'M' };
  for (let i = 1; i < result.length; i++) {
    if (!result[i].cp1 && !result[i].cp2 && result[i].type === 'C') {
      result[i] = { ...result[i], type: 'L' };
    }
  }
  return result;
}

interface PathPoint {
  x: number;
  y: number;
  cp1?: { x: number; y: number };
  cp2?: { x: number; y: number };
}

function renderShape(shape: Shape, selectedIds: string[], onMD?: (e: React.MouseEvent, id: string) => void): React.ReactNode {
  const sel = selectedIds.includes(shape.id);
  const st = shape.style || {};
  const cmn = { opacity: st.opacity ?? 1, cursor: 'pointer' as const };
  const shapeLabel = (() => {
    switch (shape.type) {
      case 'rect': return `Rectangle at position ${Math.round(shape.x)}, ${Math.round(shape.y)}`;
      case 'circle': return `Circle at position ${Math.round(shape.x)}, ${Math.round(shape.y)}`;
      case 'path': return `Path at position ${Math.round(shape.x)}, ${Math.round(shape.y)}`;
      case 'text': return `Text "${(shape as TextShape).text}" at position ${Math.round(shape.x)}, ${Math.round(shape.y)}`;
      case 'group': return `Group at position ${Math.round(shape.x)}, ${Math.round(shape.y)}`;
      default: return `Shape at position ${Math.round(shape.x)}, ${Math.round(shape.y)}`;
    }
  })();
  const wrap = (id: string, children: React.ReactNode) => (
    <g key={id} data-testid={`shape-${id}`} role="img" aria-label={shapeLabel} onMouseDown={(e) => onMD?.(e, id)}>{children}</g>
  );
  const selBox = sel ? (
    <rect x={shape.x - 2} y={shape.y - 2} width={shape.width + 4} height={shape.height + 4}
      fill="none" stroke={SEL} strokeWidth={1.5} strokeDasharray="4 2" pointerEvents="none" />
  ) : null;

  switch (shape.type) {
    case 'rect': {
      const s = shape as RectShape;
      return wrap(s.id, <>
        <rect x={s.x} y={s.y} width={s.width} height={s.height} rx={s.rx ?? 0}
          fill={st.fill ?? '#555'} stroke={st.stroke ?? '#888'} strokeWidth={st.strokeWidth ?? 1} style={cmn} />
        {selBox}
      </>);
    }
    case 'circle': {
      const s = shape as CircleShape;
      const r = Math.min(s.width, s.height) / 2;
      return wrap(s.id, <>
        <circle cx={s.cx} cy={s.cy} r={r} fill={st.fill ?? '#555'} stroke={st.stroke ?? '#888'}
          strokeWidth={st.strokeWidth ?? 1} style={cmn} />
        {sel && <rect x={s.cx - r - 2} y={s.cy - r - 2} width={r * 2 + 4} height={r * 2 + 4}
          fill="none" stroke={SEL} strokeWidth={1.5} strokeDasharray="4 2" pointerEvents="none" />}
      </>);
    }
    case 'path': {
      const s = shape as PathShape;
      return wrap(s.id, <>
        <path d={s.d} fill={st.fill ?? 'none'} stroke={st.stroke ?? '#888'}
          strokeWidth={st.strokeWidth ?? 1} style={cmn} />
        {selBox}
      </>);
    }
    case 'text': {
      const s = shape as TextShape;
      return wrap(s.id, <>
        <text x={s.x} y={s.y} fill={st.fill ?? '#ccc'} fontSize={st.fontSize ?? 14}
          fontFamily={st.fontFamily ?? 'sans-serif'} style={cmn}>{s.text}</text>
        {selBox}
      </>);
    }
    case 'group': {
      const s = shape as GroupShape;
      return wrap(s.id, <>
        {s.children.map((c) => renderShape(c, selectedIds, onMD))}
        {selBox}
      </>);
    }
    default:
      return null;
  }
}

const TOOLS = [
  { id: 'select' as const, icon: MousePointer2, label: 'Select', shortcut: 'S' },
  { id: 'rect' as const, icon: Square, label: 'Rectangle', shortcut: 'R' },
  { id: 'circle' as const, icon: CircleIcon, label: 'Circle', shortcut: 'C' },
  { id: 'text' as const, icon: Type, label: 'Text', shortcut: 'T' },
  { id: 'line' as const, icon: Minus, label: 'Line', shortcut: 'L' },
  { id: 'connector' as const, icon: MapPin, label: 'Pin', shortcut: 'P' },
  { id: 'measure' as const, icon: Ruler, label: 'Measure', shortcut: 'M' },
  { id: 'path' as const, icon: Spline, label: 'Path', shortcut: 'B' },
];

const SHORTCUT_MAP: Record<string, typeof TOOLS[number]['id']> = {};
TOOLS.forEach((t) => { SHORTCUT_MAP[t.shortcut.toLowerCase()] = t.id; });

interface ShapeCanvasProps {
  view: 'breadboard' | 'schematic' | 'pcb';
  drcViolations?: DRCViolation[];
}

export default function ShapeCanvas({ view, drcViolations = [] }: ShapeCanvasProps) {
  const { state, dispatch } = useComponentEditor();
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragOrigins, setDragOrigins] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null);
  const [marqueeCurrent, setMarqueeCurrent] = useState<{ x: number; y: number } | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [activeGuides, setActiveGuides] = useState<SnapTarget[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [pendingMeasureStart, setPendingMeasureStart] = useState<{ x: number; y: number } | null>(null);
  const [measureCursorPos, setMeasureCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [refImage, setRefImage] = useState<{
    url: string;
    x: number;
    y: number;
    width: number;
    height: number;
    opacity: number;
    locked: boolean;
    scale: number;
  } | null>(null);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationPoints, setCalibrationPoints] = useState<Array<{x: number; y: number}>>([]);
  const refImageInputRef = useRef<HTMLInputElement>(null);
  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const [pathPoints, setPathPoints] = useState<PathPoint[]>([]);
  const [isDrawingPath, setIsDrawingPath] = useState(false);
  const [pathDragIndex, setPathDragIndex] = useState<number | null>(null);
  const [pathCursorPos, setPathCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [pathClickStart, setPathClickStart] = useState<{ x: number; y: number } | null>(null);
  const [pathDraggingHandle, setPathDraggingHandle] = useState(false);
  const [editingPathNodes, setEditingPathNodes] = useState<PathNode[] | null>(null);
  const [editingNodeDrag, setEditingNodeDrag] = useState<{ nodeIndex: number; handle: 'point' | 'cp1' | 'cp2' } | null>(null);

  const activeTool = state.ui.activeTool;
  const selectedIds = state.ui.selectedShapeIds;
  const allShapes = state.present.views[view].shapes;
  const connectors = state.present.connectors;
  const layerConfig = state.present.views[view].layerConfig || getDefaultLayerConfig(view);

  const shapes = useMemo(() => {
    return allShapes.filter((s) => {
      const layer = s.layer || 'default';
      const cfg = layerConfig[layer];
      return !cfg || cfg.visible;
    });
  }, [allShapes, layerConfig]);

  const isLayerLocked = useCallback((shapeLayer?: string) => {
    const layer = shapeLayer || 'default';
    const cfg = layerConfig[layer];
    return cfg?.locked ?? false;
  }, [layerConfig]);

  const toPartSpace = useCallback((sx: number, sy: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    return { x: (sx - r.left - panX) / zoom, y: (sy - r.top - panY) / zoom };
  }, [panX, panY, zoom]);

  const zoomToFit = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (shapes.length === 0) {
      setPanX(0);
      setPanY(0);
      setZoom(1);
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    shapes.forEach((s) => {
      minX = Math.min(minX, s.x);
      minY = Math.min(minY, s.y);
      maxX = Math.max(maxX, s.x + s.width);
      maxY = Math.max(maxY, s.y + s.height);
    });
    const pad = 20;
    const bw = maxX - minX;
    const bh = maxY - minY;
    const vw = rect.width - pad * 2;
    const vh = rect.height - pad * 2;
    if (bw <= 0 || bh <= 0) { setPanX(0); setPanY(0); setZoom(1); return; }
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(vw / bw, vh / bh)));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setPanX(rect.width / 2 - cx * newZoom);
    setPanY(rect.height / 2 - cy * newZoom);
    setZoom(newZoom);
  }, [shapes]);

  const handleRefImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setRefImage({
        url,
        x: 0,
        y: 0,
        width: img.naturalWidth,
        height: img.naturalHeight,
        opacity: 0.5,
        locked: false,
        scale: 1,
      });
    };
    img.src = url;
    e.target.value = '';
  }, []);

  const handleCalibrationClick = useCallback((pos: { x: number; y: number }) => {
    const newPoints = [...calibrationPoints, pos];
    setCalibrationPoints(newPoints);
    if (newPoints.length >= 2) {
      const dx = newPoints[1].x - newPoints[0].x;
      const dy = newPoints[1].y - newPoints[0].y;
      const pixelDistance = Math.sqrt(dx * dx + dy * dy);
      if (pixelDistance > 0) {
        const input = window.prompt('Enter the real distance between the two points in mils (thousandths of inch):');
        if (input) {
          const realDistance = parseFloat(input);
          if (!isNaN(realDistance) && realDistance > 0 && refImage) {
            const newScale = refImage.scale * (realDistance / pixelDistance);
            setRefImage({ ...refImage, scale: newScale });
          }
        }
      }
      setCalibrationPoints([]);
      setIsCalibrating(false);
    }
  }, [calibrationPoints, refImage]);

  const finishPath = useCallback(() => {
    if (pathPoints.length < 2) {
      setPathPoints([]);
      setIsDrawingPath(false);
      setPathCursorPos(null);
      return;
    }
    const nodes: PathNode[] = pathPoints.map((pt, i) => {
      if (i === 0) return { x: pt.x, y: pt.y, type: 'M' as const };
      if (pt.cp1 || pt.cp2) {
        const prev = pathPoints[i - 1];
        const cp1 = pt.cp1 || { x: prev.x, y: prev.y };
        const cp2 = pt.cp2 || { x: pt.x, y: pt.y };
        return { x: pt.x, y: pt.y, type: 'C' as const, cp1, cp2 };
      }
      return { x: pt.x, y: pt.y, type: 'L' as const };
    });
    const d = nodesToPathD(nodes);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    pathPoints.forEach((pt) => {
      minX = Math.min(minX, pt.x); minY = Math.min(minY, pt.y);
      maxX = Math.max(maxX, pt.x); maxY = Math.max(maxY, pt.y);
      if (pt.cp1) { minX = Math.min(minX, pt.cp1.x); minY = Math.min(minY, pt.cp1.y); maxX = Math.max(maxX, pt.cp1.x); maxY = Math.max(maxY, pt.cp1.y); }
      if (pt.cp2) { minX = Math.min(minX, pt.cp2.x); minY = Math.min(minY, pt.cp2.y); maxX = Math.max(maxX, pt.cp2.x); maxY = Math.max(maxY, pt.cp2.y); }
    });
    dispatch({ type: 'ADD_SHAPE', payload: { view, shape: {
      id: nanoid(), type: 'path', x: minX, y: minY,
      width: maxX - minX, height: maxY - minY, rotation: 0, d,
      style: { stroke: '#888', strokeWidth: 2, fill: 'none' },
    } as PathShape }});
    setPathPoints([]);
    setIsDrawingPath(false);
    setPathCursorPos(null);
  }, [pathPoints, dispatch, view]);

  const cancelPath = useCallback(() => {
    setPathPoints([]);
    setIsDrawingPath(false);
    setPathCursorPos(null);
    setPathClickStart(null);
    setPathDraggingHandle(false);
  }, []);

  const selectedPathShape = useMemo(() => {
    if (activeTool !== 'select' || selectedIds.length !== 1) return null;
    const s = shapes.find((sh) => sh.id === selectedIds[0]);
    return s && s.type === 'path' ? s as PathShape : null;
  }, [activeTool, selectedIds, shapes]);

  useEffect(() => {
    if (selectedPathShape && !editingNodeDrag) {
      setEditingPathNodes(pathDToNodes(selectedPathShape.d));
    } else if (!selectedPathShape) {
      setEditingPathNodes(null);
    }
  }, [selectedPathShape?.id, selectedPathShape?.d]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
    setPanX(mx - (mx - panX) * (nz / zoom));
    setPanY(my - (my - panY) * (nz / zoom));
    setZoom(nz);
  }, [zoom, panX, panY]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (spaceHeld && e.button === 0)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panX, y: e.clientY - panY });
      e.preventDefault();
      return;
    }
    if (e.button !== 0) return;
    if (isCalibrating) {
      const pos = toPartSpace(e.clientX, e.clientY);
      handleCalibrationClick(pos);
      return;
    }
    const shapeEl = (e.target as SVGElement).closest('[data-testid^="shape-"]');
    if (activeTool === 'select') {
      if (!shapeEl) {
        const pos = toPartSpace(e.clientX, e.clientY);
        setMarqueeStart(pos);
        setMarqueeCurrent(pos);
        dispatch({ type: 'SET_SELECTION', payload: [] });
      }
      return;
    }
    if (activeTool === 'measure') {
      const pos = toPartSpace(e.clientX, e.clientY);
      if (!pendingMeasureStart) {
        setPendingMeasureStart(pos);
      } else {
        const dx = pos.x - pendingMeasureStart.x;
        const dy = pos.y - pendingMeasureStart.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        setMeasurements((prev) => [...prev, { start: pendingMeasureStart, end: pos, distance }]);
        setPendingMeasureStart(null);
      }
      return;
    }
    if (activeTool === 'connector') {
      const pos = toPartSpace(e.clientX, e.clientY);
      const shapeId = nanoid();
      const connectorId = nanoid();
      const pinShape: CircleShape = {
        id: shapeId, type: 'circle', x: pos.x - 3, y: pos.y - 3,
        width: 6, height: 6, cx: pos.x, cy: pos.y, rotation: 0,
        style: { fill: '#00F0FF', stroke: '#00F0FF', strokeWidth: 1 },
      };
      dispatch({ type: 'ADD_SHAPE', payload: { view, shape: pinShape } });
      const connector: Connector = {
        id: connectorId,
        name: `pin${connectors.length + 1}`,
        connectorType: 'male',
        shapeIds: { [view]: [shapeId] },
        terminalPositions: { [view]: { x: pos.x, y: pos.y } },
      };
      dispatch({ type: 'ADD_CONNECTOR', payload: connector });
      return;
    }
    if (activeTool === 'text') {
      const pos = toPartSpace(e.clientX, e.clientY);
      const text = prompt('Enter text:');
      if (text) {
        dispatch({ type: 'ADD_SHAPE', payload: { view, shape: {
          id: nanoid(), type: 'text', x: pos.x, y: pos.y, width: 100, height: 20, rotation: 0,
          text, style: { fill: '#ccc', fontSize: 14, fontFamily: 'sans-serif' },
        } as TextShape }});
      }
      return;
    }
    if (activeTool === 'path') {
      if (e.detail === 2) {
        finishPath();
        return;
      }
      const pos = toPartSpace(e.clientX, e.clientY);
      setPathClickStart(pos);
      setPathDraggingHandle(false);
      return;
    }
    if (activeTool === 'rect' || activeTool === 'circle' || activeTool === 'line') {
      const pos = toPartSpace(e.clientX, e.clientY);
      setDrawStart(pos);
      setDrawCurrent(pos);
    }
  }, [spaceHeld, panX, panY, activeTool, dispatch, toPartSpace, view, connectors.length, pendingMeasureStart, isCalibrating, handleCalibrationClick, finishPath]);

  const handleShapeMouseDown = useCallback((e: React.MouseEvent, shapeId: string) => {
    if (activeTool !== 'select') return;
    e.stopPropagation();
    const targetShape = shapes.find((s) => s.id === shapeId);
    if (targetShape && isLayerLocked(targetShape.layer)) return;
    if (e.shiftKey) {
      const newSelection = selectedIds.includes(shapeId)
        ? selectedIds.filter((id) => id !== shapeId)
        : [...selectedIds, shapeId];
      dispatch({ type: 'SET_SELECTION', payload: newSelection });
    } else {
      dispatch({ type: 'SET_SELECTION', payload: [shapeId] });
    }
    const pos = toPartSpace(e.clientX, e.clientY);
    setIsDragging(true);
    setDragStart(pos);
    const origins = new Map<string, { x: number; y: number }>();
    const ids = e.shiftKey
      ? (selectedIds.includes(shapeId) ? selectedIds.filter((id) => id !== shapeId) : [...selectedIds, shapeId])
      : (selectedIds.includes(shapeId) ? selectedIds : [shapeId]);
    shapes.forEach((s) => { if (ids.includes(s.id)) origins.set(s.id, { x: s.x, y: s.y }); });
    if (!ids.includes(shapeId)) {
      const shape = shapes.find((s) => s.id === shapeId);
      if (shape) origins.set(shapeId, { x: shape.x, y: shape.y });
    }
    setDragOrigins(origins);
  }, [activeTool, dispatch, toPartSpace, selectedIds, shapes, isLayerLocked]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (activeTool === 'path' || isDrawingPath) {
      const pos = toPartSpace(e.clientX, e.clientY);
      setPathCursorPos(pos);
      if (pathClickStart) {
        const dx = pos.x - pathClickStart.x;
        const dy = pos.y - pathClickStart.y;
        if (dx * dx + dy * dy > 9) {
          setPathDraggingHandle(true);
        }
      }
    }
    if (activeTool === 'connector') {
      setCursorPos(toPartSpace(e.clientX, e.clientY));
    }
    if (activeTool === 'measure') {
      setMeasureCursorPos(toPartSpace(e.clientX, e.clientY));
    }
    if (editingNodeDrag && selectedPathShape && editingPathNodes) {
      const pos = toPartSpace(e.clientX, e.clientY);
      const updatedNodes = [...editingPathNodes];
      const node = { ...updatedNodes[editingNodeDrag.nodeIndex] };
      if (editingNodeDrag.handle === 'point') {
        const dx = pos.x - node.x;
        const dy = pos.y - node.y;
        node.x = pos.x;
        node.y = pos.y;
        if (node.cp1) node.cp1 = { x: node.cp1.x + dx, y: node.cp1.y + dy };
        if (node.cp2) node.cp2 = { x: node.cp2.x + dx, y: node.cp2.y + dy };
      } else if (editingNodeDrag.handle === 'cp1' && node.cp1) {
        node.cp1 = { x: pos.x, y: pos.y };
      } else if (editingNodeDrag.handle === 'cp2' && node.cp2) {
        node.cp2 = { x: pos.x, y: pos.y };
      }
      updatedNodes[editingNodeDrag.nodeIndex] = node;
      setEditingPathNodes(updatedNodes);
      return;
    }
    if (isPanning) {
      setPanX(e.clientX - panStart.x);
      setPanY(e.clientY - panStart.y);
      return;
    }
    if (marqueeStart) {
      setMarqueeCurrent(toPartSpace(e.clientX, e.clientY));
      return;
    }
    if (drawStart) { setDrawCurrent(toPartSpace(e.clientX, e.clientY)); return; }
    if (isDragging && dragStart) {
      const pos = toPartSpace(e.clientX, e.clientY);
      const rawDx = pos.x - dragStart.x, rawDy = pos.y - dragStart.y;

      const draggedIds = Array.from(dragOrigins.keys());
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      Array.from(dragOrigins.entries()).forEach(([id, origin]) => {
        const shape = shapes.find(s => s.id === id);
        if (!shape) return;
        const b = getShapeBounds(shape);
        const w = b.right - b.left;
        const h = b.bottom - b.top;
        const newLeft = origin.x + rawDx;
        const newTop = origin.y + rawDy;
        minX = Math.min(minX, newLeft);
        minY = Math.min(minY, newTop);
        maxX = Math.max(maxX, newLeft + w);
        maxY = Math.max(maxY, newTop + h);
      });

      const movingBounds = {
        left: minX, right: maxX, top: minY, bottom: maxY,
        centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2,
      };

      const snapResult = computeSnap(movingBounds, shapes, draggedIds);
      const snapDx = snapResult.snappedX - minX;
      const snapDy = snapResult.snappedY - minY;

      const moves = Array.from(dragOrigins.entries()).map(([id, o]) => ({
        id, x: o.x + rawDx + snapDx, y: o.y + rawDy + snapDy,
      }));
      dispatch({ type: 'MOVE_SHAPES', payload: { view, moves } });
      setActiveGuides(snapResult.guides);
    }
  }, [isPanning, panStart, drawStart, toPartSpace, isDragging, dragStart, dragOrigins, dispatch, view, marqueeStart, activeTool, shapes, isDrawingPath, pathClickStart, editingNodeDrag, selectedPathShape, editingPathNodes]);

  const handleMouseUp = useCallback(() => {
    if (editingNodeDrag && selectedPathShape && editingPathNodes) {
      const d = nodesToPathD(editingPathNodes);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      editingPathNodes.forEach((n) => {
        minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y);
        if (n.cp1) { minX = Math.min(minX, n.cp1.x); minY = Math.min(minY, n.cp1.y); maxX = Math.max(maxX, n.cp1.x); maxY = Math.max(maxY, n.cp1.y); }
        if (n.cp2) { minX = Math.min(minX, n.cp2.x); minY = Math.min(minY, n.cp2.y); maxX = Math.max(maxX, n.cp2.x); maxY = Math.max(maxY, n.cp2.y); }
      });
      dispatch({ type: 'UPDATE_SHAPE', payload: { view, shapeId: selectedPathShape.id, updates: { d, x: minX, y: minY, width: maxX - minX, height: maxY - minY } } });
      setEditingNodeDrag(null);
      return;
    }
    if (pathClickStart && activeTool === 'path') {
      const pos = pathDraggingHandle && pathCursorPos ? pathCursorPos : pathClickStart;
      const newPoint: PathPoint = { x: pathClickStart.x, y: pathClickStart.y };
      if (pathDraggingHandle && pathCursorPos) {
        const dx = pathCursorPos.x - pathClickStart.x;
        const dy = pathCursorPos.y - pathClickStart.y;
        newPoint.cp1 = { x: pathClickStart.x - dx, y: pathClickStart.y - dy };
        newPoint.cp2 = { x: pathCursorPos.x, y: pathCursorPos.y };
      }
      setPathPoints((prev) => [...prev, newPoint]);
      setIsDrawingPath(true);
      setPathClickStart(null);
      setPathDraggingHandle(false);
      return;
    }
    if (isPanning) { setIsPanning(false); return; }
    if (isDragging) { setIsDragging(false); setDragStart(null); setDragOrigins(new Map()); setActiveGuides([]); return; }
    if (marqueeStart && marqueeCurrent) {
      const mx = Math.min(marqueeStart.x, marqueeCurrent.x);
      const my = Math.min(marqueeStart.y, marqueeCurrent.y);
      const mw = Math.abs(marqueeCurrent.x - marqueeStart.x);
      const mh = Math.abs(marqueeCurrent.y - marqueeStart.y);
      if (mw > 2 || mh > 2) {
        const hit = shapes.filter((s) => {
          const sx = s.x, sy = s.y, sw = s.width, sh = s.height;
          return sx < mx + mw && sx + sw > mx && sy < my + mh && sy + sh > my;
        }).map((s) => s.id);
        dispatch({ type: 'SET_SELECTION', payload: hit });
      }
      setMarqueeStart(null);
      setMarqueeCurrent(null);
      return;
    }
    if (drawStart && drawCurrent) {
      const x = Math.min(drawStart.x, drawCurrent.x), y = Math.min(drawStart.y, drawCurrent.y);
      const w = Math.abs(drawCurrent.x - drawStart.x), h = Math.abs(drawCurrent.y - drawStart.y);
      if (w > 2 || h > 2) {
        if (activeTool === 'rect') {
          dispatch({ type: 'ADD_SHAPE', payload: { view, shape: {
            id: nanoid(), type: 'rect', x, y, width: w, height: h, rotation: 0,
            style: { fill: '#555', stroke: '#888', strokeWidth: 1 },
          } as RectShape }});
        } else if (activeTool === 'circle') {
          const sz = Math.max(w, h);
          dispatch({ type: 'ADD_SHAPE', payload: { view, shape: {
            id: nanoid(), type: 'circle', x, y, width: sz, height: sz,
            cx: x + sz / 2, cy: y + sz / 2, rotation: 0,
            style: { fill: '#555', stroke: '#888', strokeWidth: 1 },
          } as CircleShape }});
        } else if (activeTool === 'line') {
          dispatch({ type: 'ADD_SHAPE', payload: { view, shape: {
            id: nanoid(), type: 'path', x: drawStart.x, y: drawStart.y,
            width: w, height: h, rotation: 0,
            d: `M ${drawStart.x} ${drawStart.y} L ${drawCurrent.x} ${drawCurrent.y}`,
            style: { stroke: '#888', strokeWidth: 2 },
          } as PathShape }});
        }
      }
      setDrawStart(null);
      setDrawCurrent(null);
    }
  }, [isPanning, isDragging, drawStart, drawCurrent, activeTool, dispatch, view, marqueeStart, marqueeCurrent, shapes, editingNodeDrag, selectedPathShape, editingPathNodes, pathClickStart, pathDraggingHandle, pathCursorPos]);

  useEffect(() => {
    const isInputFocused = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable;
    };
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); setSpaceHeld(true); }
      if (e.key === 'Enter' && isDrawingPath) {
        e.preventDefault();
        finishPath();
        return;
      }
      if (e.key === 'Escape' && isDrawingPath) {
        cancelPath();
        return;
      }
      if (e.key === 'Escape') {
        setPendingMeasureStart(null);
        setIsCalibrating(false);
        setCalibrationPoints([]);
        dispatch({ type: 'SET_SELECTION', payload: [] });
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0 && !isInputFocused(e)) {
        dispatch({ type: 'DELETE_SHAPES', payload: { view, shapeIds: selectedIds } });
        dispatch({ type: 'SET_SELECTION', payload: [] });
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        dispatch({ type: 'COPY_SHAPES', payload: { view } });
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        dispatch({ type: 'PASTE_SHAPES', payload: { view } });
      }
      if (((e.ctrlKey || e.metaKey) && e.key === '0') || e.key === 'Home') {
        e.preventDefault();
        zoomToFit();
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !isInputFocused(e)) {
        const toolId = SHORTCUT_MAP[e.key.toLowerCase()];
        if (toolId) {
          if (activeTool === 'measure' && toolId !== 'measure') {
            setMeasurements([]);
            setPendingMeasureStart(null);
          }
          dispatch({ type: 'SET_TOOL', payload: toolId });
        }
      }
    };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') setSpaceHeld(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [selectedIds, dispatch, view, zoomToFit, activeTool, isDrawingPath, finishPath, cancelPath]);

  const gps = GRID_SIZE * zoom;

  const renderedShapes = useMemo(
    () => shapes.map((s) => renderShape(s, selectedIds, handleShapeMouseDown)),
    [shapes, selectedIds, handleShapeMouseDown]
  );

  const drcOverlayElements = useMemo(() => {
    if (drcViolations.length === 0) return null;
    return (
      <g data-testid="drc-overlays" className="drc-overlays" pointerEvents="none">
        {drcViolations.map(v => {
          const color = v.severity === 'error' ? '#ef4444' : '#f59e0b';
          const size = 20;
          return (
            <g key={v.id} data-testid={`drc-overlay-${v.id}`}>
              <circle cx={v.location.x} cy={v.location.y} r={size} fill={color} fillOpacity={0.15} stroke={color} strokeWidth={2 / zoom} strokeDasharray={`${4 / zoom} ${2 / zoom}`} />
              {v.actual !== undefined && v.required !== undefined && (
                <text x={v.location.x} y={v.location.y - size - 4 / zoom} textAnchor="middle" fill={color} fontSize={10 / zoom} fontFamily="JetBrains Mono, monospace">
                  {v.actual.toFixed(1)} / {v.required}
                </text>
              )}
            </g>
          );
        })}
      </g>
    );
  }, [drcViolations, zoom]);

  const constraintLines = useMemo(() => {
    const constraints = state.present.constraints || [];
    if (constraints.length === 0) return null;
    const shapes = state.present.views[view].shapes;
    const shapeMap = new Map(shapes.map(s => [s.id, s]));
    const conflictIds = new Set(detectConflicts(constraints.filter(c => c.enabled), shapes));

    return (
      <g data-testid="constraint-overlays" pointerEvents="none">
        {constraints.filter(c => c.enabled).map(c => {
          const centers = c.shapeIds.map(id => {
            const s = shapeMap.get(id);
            return s ? getShapeCenter(s) : null;
          }).filter(Boolean) as { x: number; y: number }[];

          const isSatisfied = !conflictIds.has(c.id);
          const lineColor = isSatisfied ? '#22c55e' : '#ef4444';
          const labelColor = isSatisfied ? '#22c55e' : '#ef4444';

          if (centers.length < 2) {
            if (c.type === 'fixed' && centers.length === 1) {
              const fixedX = Number(c.params.x) || 0;
              const fixedY = Number(c.params.y) || 0;
              const dx = centers[0].x - fixedX;
              const dy = centers[0].y - fixedY;
              const isFixed = Math.abs(dx) < 1 && Math.abs(dy) < 1;
              const fixColor = isFixed ? '#22c55e' : '#ef4444';
              return (
                <g key={c.id}>
                  <circle cx={centers[0].x} cy={centers[0].y} r={4 / zoom} fill="none" stroke={fixColor} strokeWidth={1.5 / zoom} />
                  <line x1={centers[0].x - 4 / zoom} y1={centers[0].y} x2={centers[0].x + 4 / zoom} y2={centers[0].y} stroke={fixColor} strokeWidth={1 / zoom} />
                  <line x1={centers[0].x} y1={centers[0].y - 4 / zoom} x2={centers[0].x} y2={centers[0].y + 4 / zoom} stroke={fixColor} strokeWidth={1 / zoom} />
                </g>
              );
            }
            return null;
          }

          const dx = centers[1].x - centers[0].x;
          const dy = centers[1].y - centers[0].y;
          const currentDist = Math.sqrt(dx * dx + dy * dy);

          let label: string = c.type;
          if (c.type === 'distance' && c.params.distance !== undefined) {
            label = `${currentDist.toFixed(0)}/${c.params.distance}`;
          } else if (c.type === 'pitch' && c.params.pitch !== undefined) {
            label = `pitch ${c.params.pitch}`;
          } else if (c.type === 'alignment') {
            const axis = (c.params.axis as string) || 'x';
            const diff = axis === 'x' ? Math.abs(centers[0].x - centers[1].x) : Math.abs(centers[0].y - centers[1].y);
            label = `align-${axis} \u0394${diff.toFixed(0)}`;
          } else if (c.type === 'symmetric') {
            label = `sym-${c.params.axis || 'x'}`;
          } else if (c.type === 'equal') {
            label = `eq-${c.params.property || 'width'}`;
          }

          return (
            <g key={c.id}>
              <line x1={centers[0].x} y1={centers[0].y} x2={centers[1].x} y2={centers[1].y}
                stroke={lineColor} strokeWidth={1.2 / zoom} strokeDasharray={isSatisfied ? 'none' : `${4 / zoom} ${3 / zoom}`} opacity={0.8} />
              {isSatisfied && (
                <>
                  <circle cx={(centers[0].x + centers[1].x) / 2} cy={(centers[0].y + centers[1].y) / 2} r={4 / zoom} fill="#22c55e" opacity={0.3} />
                  <circle cx={(centers[0].x + centers[1].x) / 2} cy={(centers[0].y + centers[1].y) / 2} r={2 / zoom} fill="#22c55e" opacity={0.6} />
                </>
              )}
              <text x={(centers[0].x + centers[1].x) / 2} y={(centers[0].y + centers[1].y) / 2 - 6 / zoom}
                fill={labelColor} fontSize={9 / zoom} textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontWeight={isSatisfied ? 'normal' : 'bold'}>
                {label}
              </text>
            </g>
          );
        })}
      </g>
    );
  }, [state.present.constraints, state.present.views, view, zoom]);

  const preview = useMemo(() => {
    if (!drawStart || !drawCurrent) return null;
    const x = Math.min(drawStart.x, drawCurrent.x), y = Math.min(drawStart.y, drawCurrent.y);
    const w = Math.abs(drawCurrent.x - drawStart.x), h = Math.abs(drawCurrent.y - drawStart.y);
    if (activeTool === 'circle') {
      const sz = Math.max(w, h);
      return <circle cx={x + sz / 2} cy={y + sz / 2} r={sz / 2}
        fill="rgba(0,240,255,0.1)" stroke={SEL} strokeWidth={1} strokeDasharray="4 2" />;
    }
    if (activeTool === 'line') {
      return <line x1={drawStart.x} y1={drawStart.y} x2={drawCurrent.x} y2={drawCurrent.y}
        stroke={SEL} strokeWidth={2} strokeDasharray="4 2" />;
    }
    return <rect x={x} y={y} width={w} height={h}
      fill="rgba(0,240,255,0.1)" stroke={SEL} strokeWidth={1} strokeDasharray="4 2" />;
  }, [drawStart, drawCurrent, activeTool]);

  const marqueeRect = useMemo(() => {
    if (!marqueeStart || !marqueeCurrent) return null;
    const x = Math.min(marqueeStart.x, marqueeCurrent.x);
    const y = Math.min(marqueeStart.y, marqueeCurrent.y);
    const w = Math.abs(marqueeCurrent.x - marqueeStart.x);
    const h = Math.abs(marqueeCurrent.y - marqueeStart.y);
    return <rect x={x} y={y} width={w} height={h}
      fill="rgba(0,240,255,0.1)" stroke="#00F0FF" strokeWidth={1} strokeDasharray="4 2" />;
  }, [marqueeStart, marqueeCurrent]);

  const connectorGhost = useMemo(() => {
    if (activeTool !== 'connector' || !cursorPos) return null;
    return <circle cx={cursorPos.x} cy={cursorPos.y} r={3}
      fill="none" stroke={SEL} strokeWidth={1} strokeDasharray="4 2" pointerEvents="none" />;
  }, [activeTool, cursorPos]);

  const pathPreview = useMemo(() => {
    if (!isDrawingPath && pathPoints.length === 0 && !pathClickStart) return null;
    const allPts = [...pathPoints];
    const elements: React.ReactNode[] = [];
    if (allPts.length > 0) {
      let dStr = `M ${allPts[0].x} ${allPts[0].y}`;
      for (let i = 1; i < allPts.length; i++) {
        const pt = allPts[i];
        if (pt.cp1 || pt.cp2) {
          const prev = allPts[i - 1];
          const cp1 = pt.cp1 || { x: prev.x, y: prev.y };
          const cp2 = pt.cp2 || { x: pt.x, y: pt.y };
          dStr += ` C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${pt.x} ${pt.y}`;
        } else {
          dStr += ` L ${pt.x} ${pt.y}`;
        }
      }
      elements.push(<path key="path-preview-solid" d={dStr} fill="none" stroke={SEL} strokeWidth={2} pointerEvents="none" />);
    }
    if (pathCursorPos && allPts.length > 0) {
      const last = allPts[allPts.length - 1];
      elements.push(<line key="path-preview-dashed" x1={last.x} y1={last.y} x2={pathCursorPos.x} y2={pathCursorPos.y}
        stroke={SEL} strokeWidth={1} strokeDasharray="4 2" pointerEvents="none" />);
    }
    allPts.forEach((pt, i) => {
      elements.push(<rect key={`path-pt-${i}`} x={pt.x - 2} y={pt.y - 2} width={4} height={4}
        fill={SEL} stroke="none" pointerEvents="none" />);
      if (pt.cp1) {
        elements.push(<line key={`path-cp1-line-${i}`} x1={pt.x} y1={pt.y} x2={pt.cp1.x} y2={pt.cp1.y}
          stroke={SEL} strokeWidth={0.5} strokeDasharray="2 2" pointerEvents="none" />);
        elements.push(<circle key={`path-cp1-${i}`} cx={pt.cp1.x} cy={pt.cp1.y} r={2.5}
          fill={SEL} stroke="none" pointerEvents="none" />);
      }
      if (pt.cp2) {
        elements.push(<line key={`path-cp2-line-${i}`} x1={pt.x} y1={pt.y} x2={pt.cp2.x} y2={pt.cp2.y}
          stroke={SEL} strokeWidth={0.5} strokeDasharray="2 2" pointerEvents="none" />);
        elements.push(<circle key={`path-cp2-${i}`} cx={pt.cp2.x} cy={pt.cp2.y} r={2.5}
          fill={SEL} stroke="none" pointerEvents="none" />);
      }
    });
    if (pathClickStart && pathDraggingHandle && pathCursorPos) {
      const dx = pathCursorPos.x - pathClickStart.x;
      const dy = pathCursorPos.y - pathClickStart.y;
      const mirrorX = pathClickStart.x - dx;
      const mirrorY = pathClickStart.y - dy;
      elements.push(<rect key="path-drag-pt" x={pathClickStart.x - 2} y={pathClickStart.y - 2} width={4} height={4}
        fill={SEL} stroke="none" pointerEvents="none" />);
      elements.push(<line key="path-drag-handle-line" x1={mirrorX} y1={mirrorY} x2={pathCursorPos.x} y2={pathCursorPos.y}
        stroke={SEL} strokeWidth={0.5} strokeDasharray="2 2" pointerEvents="none" />);
      elements.push(<circle key="path-drag-cp1" cx={mirrorX} cy={mirrorY} r={2.5}
        fill={SEL} stroke="none" pointerEvents="none" />);
      elements.push(<circle key="path-drag-cp2" cx={pathCursorPos.x} cy={pathCursorPos.y} r={2.5}
        fill={SEL} stroke="none" pointerEvents="none" />);
    }
    return <g data-testid="path-preview">{elements}</g>;
  }, [pathPoints, pathCursorPos, isDrawingPath, pathClickStart, pathDraggingHandle]);

  const handleToggleNodeType = useCallback((i: number) => {
    if (!editingPathNodes || !selectedPathShape) return;
    const newNodes = editingPathNodes.map(n => {
      const copy = { ...n };
      if (copy.cp1) copy.cp1 = { ...copy.cp1 };
      if (copy.cp2) copy.cp2 = { ...copy.cp2 };
      return copy;
    });
    const node = newNodes[i];
    if (node.cp1 || node.cp2) {
      delete node.cp1;
      delete node.cp2;
      if (node.type !== 'M') node.type = 'L';
    } else if (node.type === 'L') {
      const prev = newNodes[i - 1] || node;
      const next = newNodes[i + 1] || node;
      node.cp1 = { x: prev.x + (node.x - prev.x) / 3, y: prev.y + (node.y - prev.y) / 3 };
      node.cp2 = { x: node.x + (next.x - node.x) / 3, y: node.y + (next.y - node.y) / 3 };
      node.type = 'C';
    }
    setEditingPathNodes(newNodes);
    const d = nodesToPathD(newNodes);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    newNodes.forEach((n) => {
      minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y);
      if (n.cp1) { minX = Math.min(minX, n.cp1.x); minY = Math.min(minY, n.cp1.y); maxX = Math.max(maxX, n.cp1.x); maxY = Math.max(maxY, n.cp1.y); }
      if (n.cp2) { minX = Math.min(minX, n.cp2.x); minY = Math.min(minY, n.cp2.y); maxX = Math.max(maxX, n.cp2.x); maxY = Math.max(maxY, n.cp2.y); }
    });
    dispatch({ type: 'UPDATE_SHAPE', payload: { view, shapeId: selectedPathShape.id, updates: { d, x: minX, y: minY, width: maxX - minX, height: maxY - minY } } });
  }, [editingPathNodes, selectedPathShape, dispatch, view]);

  const handleSimplifyPath = useCallback(() => {
    if (!editingPathNodes || !selectedPathShape || editingPathNodes.length < 4) return;
    const simplified = simplifyPath(editingPathNodes, 2);
    setEditingPathNodes(simplified);
    const d = nodesToPathD(simplified);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    simplified.forEach((n) => {
      minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y);
      if (n.cp1) { minX = Math.min(minX, n.cp1.x); minY = Math.min(minY, n.cp1.y); maxX = Math.max(maxX, n.cp1.x); maxY = Math.max(maxY, n.cp1.y); }
      if (n.cp2) { minX = Math.min(minX, n.cp2.x); minY = Math.min(minY, n.cp2.y); maxX = Math.max(maxX, n.cp2.x); maxY = Math.max(maxY, n.cp2.y); }
    });
    dispatch({ type: 'UPDATE_SHAPE', payload: { view, shapeId: selectedPathShape.id, updates: { d, x: minX, y: minY, width: maxX - minX, height: maxY - minY } } });
  }, [editingPathNodes, selectedPathShape, dispatch, view]);

  const pathEditOverlay = useMemo(() => {
    if (!editingPathNodes || !selectedPathShape) return null;
    const elements: React.ReactNode[] = [];
    editingPathNodes.forEach((node, i) => {
      if (node.cp1) {
        elements.push(<line key={`edit-cp1-line-${i}`} x1={node.x} y1={node.y} x2={node.cp1.x} y2={node.cp1.y}
          stroke="#FFD700" strokeWidth={0.5} strokeDasharray="2 2" pointerEvents="none" />);
        elements.push(<circle key={`edit-cp1-${i}`} cx={node.cp1.x} cy={node.cp1.y} r={3}
          fill="#FFD700" stroke="none" style={{ cursor: 'pointer' }}
          onMouseDown={(e) => { e.stopPropagation(); setEditingNodeDrag({ nodeIndex: i, handle: 'cp1' }); }} />);
      }
      if (node.cp2) {
        elements.push(<line key={`edit-cp2-line-${i}`} x1={node.x} y1={node.y} x2={node.cp2.x} y2={node.cp2.y}
          stroke="#FFD700" strokeWidth={0.5} strokeDasharray="2 2" pointerEvents="none" />);
        elements.push(<circle key={`edit-cp2-${i}`} cx={node.cp2.x} cy={node.cp2.y} r={3}
          fill="#FFD700" stroke="none" style={{ cursor: 'pointer' }}
          onMouseDown={(e) => { e.stopPropagation(); setEditingNodeDrag({ nodeIndex: i, handle: 'cp2' }); }} />);
      }
      const isSmooth = node.type === 'C' || node.type === 'Q';
      const titleText = isSmooth ? 'Smooth node (double-click to make corner)' : 'Corner node (double-click to make smooth)';
      if (isSmooth) {
        elements.push(<circle key={`edit-pt-${i}`} data-testid={`path-node-${i}`} cx={node.x} cy={node.y} r={3}
          fill={SEL} stroke="none" style={{ cursor: 'move' }}
          onMouseDown={(e) => { e.stopPropagation(); setEditingNodeDrag({ nodeIndex: i, handle: 'point' }); }}
          onDoubleClick={(e) => { e.stopPropagation(); handleToggleNodeType(i); }}>
          <title>{titleText}</title>
        </circle>);
      } else {
        elements.push(<rect key={`edit-pt-${i}`} data-testid={`path-node-${i}`} x={node.x - 3} y={node.y - 3} width={6} height={6}
          fill={SEL} stroke="none" style={{ cursor: 'move' }}
          onMouseDown={(e) => { e.stopPropagation(); setEditingNodeDrag({ nodeIndex: i, handle: 'point' }); }}
          onDoubleClick={(e) => { e.stopPropagation(); handleToggleNodeType(i); }}>
          <title>{titleText}</title>
        </rect>);
      }
    });
    return <g data-testid="path-edit-overlay">{elements}</g>;
  }, [editingPathNodes, selectedPathShape, handleToggleNodeType]);

  const toolbar = useMemo(() => (
    <div className="flex items-center gap-1 px-2 py-1 border-b border-border bg-card" data-testid="canvas-toolbar" role="toolbar" aria-label="Drawing tools">
      {TOOLS.map((t) => (
        <button key={t.id} data-testid={`tool-${t.id}`} title={`${t.label} (${t.shortcut})`}
          aria-label={`${t.label} (${t.shortcut})`} aria-pressed={activeTool === t.id}
          className={`p-1.5 rounded transition-colors ${activeTool === t.id
            ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
          onClick={() => {
            if (activeTool === 'measure' && t.id !== 'measure') {
              setMeasurements([]);
              setPendingMeasureStart(null);
            }
            if (isDrawingPath && t.id !== 'path') {
              cancelPath();
            }
            dispatch({ type: 'SET_TOOL', payload: t.id });
          }}>
          <t.icon className="w-4 h-4" />
        </button>
      ))}
      <div className="w-px h-4 bg-border mx-1" />
      <div className="relative">
        <button data-testid="button-layers" title="Toggle layers panel"
          aria-pressed={showLayerPanel}
          className={`p-1.5 rounded transition-colors ${showLayerPanel
            ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
          onClick={() => setShowLayerPanel(!showLayerPanel)}>
          <Layers className="w-4 h-4" />
        </button>
        {showLayerPanel && (
          <div className="absolute top-full left-0 mt-1 z-50">
            <LayerPanel view={view} />
          </div>
        )}
      </div>
      <div className="w-px h-4 bg-border mx-1" />
      <button data-testid="button-zoom-fit" title="Zoom to fit (Ctrl+0)"
        className="p-1.5 rounded transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
        onClick={zoomToFit}>
        <Maximize2 className="w-4 h-4" />
      </button>
      <div className="w-px h-4 bg-border mx-1" />
      <input ref={refImageInputRef} type="file" accept=".png,.jpg,.jpeg,.gif,.bmp,.webp"
        className="hidden" data-testid="ref-image-input" onChange={handleRefImageUpload} />
      <button data-testid="button-ref-image" title="Upload reference image"
        className="p-1.5 rounded transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
        onClick={() => refImageInputRef.current?.click()}>
        <ImageIcon className="w-4 h-4" />
      </button>
      {refImage && (
        <>
          <label className="flex items-center gap-1 text-xs text-muted-foreground ml-1" title="Reference image opacity">
            <span>Op</span>
            <input data-testid="ref-image-opacity" type="range" min="0" max="100"
              value={Math.round(refImage.opacity * 100)}
              className="w-14 h-3 accent-primary"
              onChange={(e) => setRefImage({ ...refImage, opacity: parseInt(e.target.value) / 100 })} />
          </label>
          <label className="flex items-center gap-1 text-xs text-muted-foreground ml-1" title="Reference image X offset">
            <span>X</span>
            <input data-testid="ref-image-x" type="number" value={Math.round(refImage.x)}
              className="w-14 h-5 text-xs bg-background border border-border rounded px-1"
              onChange={(e) => setRefImage({ ...refImage, x: parseFloat(e.target.value) || 0 })} />
          </label>
          <label className="flex items-center gap-1 text-xs text-muted-foreground" title="Reference image Y offset">
            <span>Y</span>
            <input data-testid="ref-image-y" type="number" value={Math.round(refImage.y)}
              className="w-14 h-5 text-xs bg-background border border-border rounded px-1"
              onChange={(e) => setRefImage({ ...refImage, y: parseFloat(e.target.value) || 0 })} />
          </label>
          <button data-testid="button-ref-lock" title={refImage.locked ? 'Unlock reference image' : 'Lock reference image'}
            className={`p-1.5 rounded transition-colors ${refImage.locked
              ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
            onClick={() => setRefImage({ ...refImage, locked: !refImage.locked })}>
            {refImage.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          </button>
          <button data-testid="button-ref-calibrate" title={isCalibrating ? 'Calibrating... click 2 points' : 'Calibrate reference image'}
            className={`p-1.5 rounded transition-colors ${isCalibrating
              ? 'bg-yellow-500/20 text-yellow-400' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
            onClick={() => { setIsCalibrating(!isCalibrating); setCalibrationPoints([]); }}>
            <Ruler className="w-4 h-4" />
          </button>
          <button data-testid="button-ref-remove" title="Remove reference image"
            className="p-1.5 rounded transition-colors text-muted-foreground hover:text-destructive hover:bg-muted"
            onClick={() => { URL.revokeObjectURL(refImage.url); setRefImage(null); setIsCalibrating(false); setCalibrationPoints([]); }}>
            <X className="w-4 h-4" />
          </button>
        </>
      )}
      {isCalibrating && (
        <span className="text-xs text-yellow-400 ml-1">
          {calibrationPoints.length === 0 ? 'Click first point' : 'Click second point'}
        </span>
      )}
      <span className="ml-auto text-xs text-muted-foreground" data-testid="zoom-indicator" aria-live="polite">
        {Math.round(zoom * 100)}%
      </span>
    </div>
  ), [activeTool, dispatch, zoomToFit, zoom, refImage, isCalibrating, calibrationPoints, handleRefImageUpload, showLayerPanel, view, isDrawingPath, cancelPath]);

  return (
    <div className="flex flex-col flex-1 h-full relative" data-testid="shape-canvas-container">
      {toolbar}
      <svg ref={svgRef} data-testid="shape-canvas-svg" className="flex-1 w-full"
        role="application" aria-label={`Component editor canvas - ${view} view`} aria-roledescription="drawing canvas" tabIndex={0}
        style={{ background: '#0a0a0a', cursor: isPanning || spaceHeld ? 'grabbing' : isCalibrating ? 'crosshair' : activeTool === 'select' ? 'default' : 'crosshair' }}
        onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp} onContextMenu={(e) => e.preventDefault()}>
        <defs>
          <pattern id={`grid-${view}`} width={gps} height={gps} patternUnits="userSpaceOnUse"
            x={panX % gps} y={panY % gps}>
            <circle cx={gps / 2} cy={gps / 2} r={0.5} fill="#222" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#grid-${view})`} />
        <g transform={`translate(${panX}, ${panY}) scale(${zoom})`}>
          <line x1="-10000" y1="0" x2="10000" y2="0" stroke="#333" strokeWidth={0.5 / zoom} />
          <line x1="0" y1="-10000" x2="0" y2="10000" stroke="#333" strokeWidth={0.5 / zoom} />
          {refImage && (
            <image
              href={refImage.url}
              x={refImage.x}
              y={refImage.y}
              width={refImage.width * refImage.scale}
              height={refImage.height * refImage.scale}
              opacity={refImage.opacity}
              style={{ pointerEvents: refImage.locked ? 'none' : 'auto' }}
              data-testid="ref-image-overlay"
            />
          )}
          {isCalibrating && calibrationPoints.map((pt, i) => (
            <g key={`cal-${i}`}>
              <circle cx={pt.x} cy={pt.y} r={4 / zoom} fill="none" stroke="#f59e0b" strokeWidth={2 / zoom} />
              <circle cx={pt.x} cy={pt.y} r={1 / zoom} fill="#f59e0b" />
            </g>
          ))}
          {renderedShapes}
          {drcOverlayElements}
          {constraintLines}
          <SnapGuides guides={activeGuides} />
          <RulerOverlay measurements={measurements} pendingStart={pendingMeasureStart}
            cursorPos={measureCursorPos} zoom={zoom} />
          {preview}
          {marqueeRect}
          {connectorGhost}
          {pathPreview}
          {pathEditOverlay}
        </g>
      </svg>
      {editingPathNodes && editingPathNodes.length >= 4 && (
        <button
          data-testid="path-simplify-btn"
          onClick={handleSimplifyPath}
          style={{
            position: 'absolute',
            top: 48,
            right: 12,
            zIndex: 20,
            padding: '4px 10px',
            fontSize: 12,
            background: '#1a1a2e',
            color: '#00F0FF',
            border: '1px solid #00F0FF',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Simplify Path
        </button>
      )}
    </div>
  );
}
