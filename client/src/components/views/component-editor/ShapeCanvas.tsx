import { useState, useRef, useCallback, useEffect } from 'react';
import { useComponentEditor } from '@/lib/component-editor/ComponentEditorProvider';
import type { Shape, RectShape, CircleShape, PathShape, TextShape, GroupShape } from '@shared/component-types';
import { nanoid } from 'nanoid';
import { MousePointer2, Square, Circle as CircleIcon, Type } from 'lucide-react';

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

  const activeTool = state.ui.activeTool;
  const selectedIds = state.ui.selectedShapeIds;
  const shapes = state.present.views[view].shapes;

  const toPartSpace = useCallback((sx: number, sy: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    return { x: (sx - r.left - panX) / zoom, y: (sy - r.top - panY) / zoom };
  }, [panX, panY, zoom]);

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
      if (!shapeEl) dispatch({ type: 'SET_SELECTION', payload: [] });
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
    if (activeTool === 'rect' || activeTool === 'circle') {
      const pos = toPartSpace(e.clientX, e.clientY);
      setDrawStart(pos);
      setDrawCurrent(pos);
    }
  }, [spaceHeld, panX, panY, activeTool, dispatch, toPartSpace, view]);

  const handleShapeMouseDown = useCallback((e: React.MouseEvent, shapeId: string) => {
    if (activeTool !== 'select') return;
    e.stopPropagation();
    dispatch({ type: 'SET_SELECTION', payload: [shapeId] });
    const pos = toPartSpace(e.clientX, e.clientY);
    setIsDragging(true);
    setDragStart(pos);
    const origins = new Map<string, { x: number; y: number }>();
    const ids = selectedIds.includes(shapeId) ? selectedIds : [shapeId];
    shapes.forEach((s) => { if (ids.includes(s.id)) origins.set(s.id, { x: s.x, y: s.y }); });
    if (!selectedIds.includes(shapeId)) {
      const shape = shapes.find((s) => s.id === shapeId);
      if (shape) origins.set(shapeId, { x: shape.x, y: shape.y });
    }
    setDragOrigins(origins);
  }, [activeTool, dispatch, toPartSpace, selectedIds, shapes]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPanX(e.clientX - panStart.x);
      setPanY(e.clientY - panStart.y);
      return;
    }
    if (drawStart) { setDrawCurrent(toPartSpace(e.clientX, e.clientY)); return; }
    if (isDragging && dragStart) {
      const pos = toPartSpace(e.clientX, e.clientY);
      const dx = pos.x - dragStart.x, dy = pos.y - dragStart.y;
      const moves = Array.from(dragOrigins.entries()).map(([id, o]) => ({ id, x: o.x + dx, y: o.y + dy }));
      dispatch({ type: 'MOVE_SHAPES', payload: { view, moves } });
    }
  }, [isPanning, panStart, drawStart, toPartSpace, isDragging, dragStart, dragOrigins, dispatch, view]);

  const handleMouseUp = useCallback(() => {
    if (isPanning) { setIsPanning(false); return; }
    if (isDragging) { setIsDragging(false); setDragStart(null); setDragOrigins(new Map()); return; }
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
        }
      }
      setDrawStart(null);
      setDrawCurrent(null);
    }
  }, [isPanning, isDragging, drawStart, drawCurrent, activeTool, dispatch, view]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); setSpaceHeld(true); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        dispatch({ type: 'DELETE_SHAPES', payload: { view, shapeIds: selectedIds } });
        dispatch({ type: 'SET_SELECTION', payload: [] });
      }
    };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') setSpaceHeld(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [selectedIds, dispatch, view]);

  const gps = GRID_SIZE * zoom;
  const preview = drawStart && drawCurrent ? (() => {
    const x = Math.min(drawStart.x, drawCurrent.x), y = Math.min(drawStart.y, drawCurrent.y);
    const w = Math.abs(drawCurrent.x - drawStart.x), h = Math.abs(drawCurrent.y - drawStart.y);
    if (activeTool === 'circle') {
      const sz = Math.max(w, h);
      return <circle cx={x + sz / 2} cy={y + sz / 2} r={sz / 2}
        fill="rgba(0,240,255,0.1)" stroke={SEL} strokeWidth={1} strokeDasharray="4 2" />;
    }
    return <rect x={x} y={y} width={w} height={h}
      fill="rgba(0,240,255,0.1)" stroke={SEL} strokeWidth={1} strokeDasharray="4 2" />;
  })() : null;

  return (
    <div className="flex flex-col flex-1 h-full" data-testid="shape-canvas-container">
      <div className="flex items-center gap-1 px-2 py-1 border-b border-border bg-card" data-testid="canvas-toolbar">
        {TOOLS.map((t) => (
          <button key={t.id} data-testid={`tool-${t.id}`} title={t.label}
            className={`p-1.5 rounded transition-colors ${activeTool === t.id
              ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
            onClick={() => dispatch({ type: 'SET_TOOL', payload: t.id })}>
            <t.icon className="w-4 h-4" />
          </button>
        ))}
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
          {preview}
        </g>
      </svg>
    </div>
  );
}