import { useState, useRef, useCallback, useEffect } from 'react';
import { useComponentEditor } from '@/lib/component-editor/ComponentEditorProvider';
import type { Shape, RectShape, CircleShape, PathShape, TextShape, GroupShape, Connector } from '@shared/component-types';
import { nanoid } from 'nanoid';
import { MousePointer2, Square, Circle as CircleIcon, Type, MapPin, Minus, Maximize2, Ruler } from 'lucide-react';
import { computeSnap, getShapeBounds, type SnapTarget } from '@/lib/component-editor/snap-engine';
import SnapGuides from './SnapGuides';
import RulerOverlay, { type Measurement } from './RulerOverlay';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;
const GRID_SIZE = 10;
const SEL = '#00F0FF';

function renderShape(shape: Shape, selectedIds: string[], onMD?: (e: React.MouseEvent, id: string) => void): React.ReactNode {
  const sel = selectedIds.includes(shape.id);
  const st = shape.style || {};
  const cmn = { opacity: st.opacity ?? 1, cursor: 'pointer' as const };
  const wrap = (id: string, children: React.ReactNode) => (
    <g key={id} data-testid={`shape-${id}`} onMouseDown={(e) => onMD?.(e, id)}>{children}</g>
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
  { id: 'select' as const, icon: MousePointer2, label: 'Select' },
  { id: 'rect' as const, icon: Square, label: 'Rectangle' },
  { id: 'circle' as const, icon: CircleIcon, label: 'Circle' },
  { id: 'text' as const, icon: Type, label: 'Text' },
  { id: 'line' as const, icon: Minus, label: 'Line' },
  { id: 'connector' as const, icon: MapPin, label: 'Pin' },
  { id: 'measure' as const, icon: Ruler, label: 'Measure' },
];

export default function ShapeCanvas({ view }: { view: 'breadboard' | 'schematic' | 'pcb' }) {
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

  const activeTool = state.ui.activeTool;
  const selectedIds = state.ui.selectedShapeIds;
  const shapes = state.present.views[view].shapes;
  const connectors = state.present.connectors;

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
    if (activeTool === 'rect' || activeTool === 'circle' || activeTool === 'line') {
      const pos = toPartSpace(e.clientX, e.clientY);
      setDrawStart(pos);
      setDrawCurrent(pos);
    }
  }, [spaceHeld, panX, panY, activeTool, dispatch, toPartSpace, view, connectors.length, pendingMeasureStart]);

  const handleShapeMouseDown = useCallback((e: React.MouseEvent, shapeId: string) => {
    if (activeTool !== 'select') return;
    e.stopPropagation();
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
  }, [activeTool, dispatch, toPartSpace, selectedIds, shapes]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (activeTool === 'connector') {
      setCursorPos(toPartSpace(e.clientX, e.clientY));
    }
    if (activeTool === 'measure') {
      setMeasureCursorPos(toPartSpace(e.clientX, e.clientY));
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
  }, [isPanning, panStart, drawStart, toPartSpace, isDragging, dragStart, dragOrigins, dispatch, view, marqueeStart, activeTool, shapes]);

  const handleMouseUp = useCallback(() => {
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
  }, [isPanning, isDragging, drawStart, drawCurrent, activeTool, dispatch, view, marqueeStart, marqueeCurrent, shapes]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); setSpaceHeld(true); }
      if (e.key === 'Escape') {
        setPendingMeasureStart(null);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
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
    };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') setSpaceHeld(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [selectedIds, dispatch, view, zoomToFit]);

  const gps = GRID_SIZE * zoom;

  const preview = drawStart && drawCurrent ? (() => {
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
  })() : null;

  const marqueeRect = marqueeStart && marqueeCurrent ? (() => {
    const x = Math.min(marqueeStart.x, marqueeCurrent.x);
    const y = Math.min(marqueeStart.y, marqueeCurrent.y);
    const w = Math.abs(marqueeCurrent.x - marqueeStart.x);
    const h = Math.abs(marqueeCurrent.y - marqueeStart.y);
    return <rect x={x} y={y} width={w} height={h}
      fill="rgba(0,240,255,0.1)" stroke="#00F0FF" strokeWidth={1} strokeDasharray="4 2" />;
  })() : null;

  const connectorGhost = activeTool === 'connector' && cursorPos ? (
    <circle cx={cursorPos.x} cy={cursorPos.y} r={3}
      fill="none" stroke={SEL} strokeWidth={1} strokeDasharray="4 2" pointerEvents="none" />
  ) : null;

  return (
    <div className="flex flex-col flex-1 h-full" data-testid="shape-canvas-container">
      <div className="flex items-center gap-1 px-2 py-1 border-b border-border bg-card" data-testid="canvas-toolbar">
        {TOOLS.map((t) => (
          <button key={t.id} data-testid={`tool-${t.id}`} title={t.label}
            className={`p-1.5 rounded transition-colors ${activeTool === t.id
              ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
            onClick={() => {
              if (activeTool === 'measure' && t.id !== 'measure') {
                setMeasurements([]);
                setPendingMeasureStart(null);
              }
              dispatch({ type: 'SET_TOOL', payload: t.id });
            }}>
            <t.icon className="w-4 h-4" />
          </button>
        ))}
        <div className="w-px h-4 bg-border mx-1" />
        <button data-testid="button-zoom-fit" title="Zoom to fit (Ctrl+0)"
          className="p-1.5 rounded transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={zoomToFit}>
          <Maximize2 className="w-4 h-4" />
        </button>
        <span className="ml-auto text-xs text-muted-foreground" data-testid="zoom-indicator">
          {Math.round(zoom * 100)}%
        </span>
      </div>
      <svg ref={svgRef} data-testid="shape-canvas-svg" className="flex-1 w-full"
        style={{ background: '#0a0a0a', cursor: isPanning || spaceHeld ? 'grabbing' : activeTool === 'select' ? 'default' : 'crosshair' }}
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
          {shapes.map((s) => renderShape(s, selectedIds, handleShapeMouseDown))}
          <SnapGuides guides={activeGuides} />
          <RulerOverlay measurements={measurements} pendingStart={pendingMeasureStart}
            cursorPos={measureCursorPos} zoom={zoom} />
          {preview}
          {marqueeRect}
          {connectorGhost}
        </g>
      </svg>
    </div>
  );
}
