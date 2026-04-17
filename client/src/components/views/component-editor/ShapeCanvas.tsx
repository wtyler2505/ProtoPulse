import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useComponentEditor } from '@/lib/component-editor/ComponentEditorProvider';
import type { CircleShape, PathShape, TextShape, DRCViolation } from '@shared/component-types';
import { nanoid } from 'nanoid';
import { MousePointer2, Square, Circle as CircleIcon, Type, MapPin, Minus, Maximize2, Ruler, ImageIcon, Lock, Unlock, X, Layers, Spline } from 'lucide-react';
import type { SnapTarget } from '@/lib/component-editor/snap-engine';
import SnapGuides from './SnapGuides';
import RulerOverlay, { type Measurement } from './RulerOverlay';
import LayerPanel, { getDefaultLayerConfig } from './LayerPanel';

// Decomposed modules
import { GRID_SIZE, MIN_ZOOM, MAX_ZOOM, computeWheelZoom, computeZoomToFit, screenToPartSpace } from './CanvasTransforms';
import { renderShape, buildDrcOverlay, buildConstraintLines, buildDrawPreview, buildMarqueeRect, buildConnectorGhost, buildPathPreview, buildPathEditOverlay } from './ShapeRenderer';
import { shapesInMarquee } from './HitTester';
import { buildDragOrigins, computeDragMove } from './DragManager';
import { pathDToNodes, nodesToPathD, simplifyPath, computeNodesBounds, computePathPointsBounds, pathPointsToNodes, toggleNodeType } from './PathEditor';
import type { PathNode, PathPoint } from './PathEditor';

const SEL = '#00F0FF';

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

  // --- Canvas transform state ---
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [spaceHeld, setSpaceHeld] = useState(false);

  // --- Drawing state ---
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);

  // --- Drag state ---
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragOrigins, setDragOrigins] = useState<Map<string, { x: number; y: number }>>(new Map());

  // --- Marquee state ---
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null);
  const [marqueeCurrent, setMarqueeCurrent] = useState<{ x: number; y: number } | null>(null);

  // --- Connector cursor ---
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // --- Snap guides ---
  const [activeGuides, setActiveGuides] = useState<SnapTarget[]>([]);

  // --- Measurement state ---
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [pendingMeasureStart, setPendingMeasureStart] = useState<{ x: number; y: number } | null>(null);
  const [measureCursorPos, setMeasureCursorPos] = useState<{ x: number; y: number } | null>(null);

  // --- Reference image state ---
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
  const [calibrationPoints, setCalibrationPoints] = useState<Array<{ x: number; y: number }>>([]);
  const refImageInputRef = useRef<HTMLInputElement>(null);

  // --- Layer panel ---
  const [showLayerPanel, setShowLayerPanel] = useState(false);

  // --- Path drawing state ---
  const [pathPoints, setPathPoints] = useState<PathPoint[]>([]);
  const [isDrawingPath, setIsDrawingPath] = useState(false);
  const [pathCursorPos, setPathCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [pathClickStart, setPathClickStart] = useState<{ x: number; y: number } | null>(null);
  const [pathDraggingHandle, setPathDraggingHandle] = useState(false);

  // --- Path editing state ---
  const [editingPathNodes, setEditingPathNodes] = useState<PathNode[] | null>(null);
  const [editingNodeDrag, setEditingNodeDrag] = useState<{ nodeIndex: number; handle: 'point' | 'cp1' | 'cp2' } | null>(null);

  // --- Derived state ---
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

  // --- Coordinate conversion ---
  const toPartSpace = useCallback((sx: number, sy: number) => {
    const svg = svgRef.current;
    if (!svg) { return { x: 0, y: 0 }; }
    const r = svg.getBoundingClientRect();
    return screenToPartSpace(sx, sy, r, panX, panY, zoom);
  }, [panX, panY, zoom]);

  // --- Zoom to fit ---
  const zoomToFit = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) { return; }
    const rect = svg.getBoundingClientRect();
    const result = computeZoomToFit(shapes, rect.width, rect.height);
    setPanX(result.panX);
    setPanY(result.panY);
    setZoom(result.zoom);
  }, [shapes]);

  // --- Reference image ---
  const handleRefImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) { return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setRefImage({
        url, x: 0, y: 0,
        width: img.naturalWidth, height: img.naturalHeight,
        opacity: 0.5, locked: false, scale: 1,
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

  // --- Path creation ---
  const finishPath = useCallback(() => {
    if (pathPoints.length < 2) {
      setPathPoints([]);
      setIsDrawingPath(false);
      setPathCursorPos(null);
      return;
    }
    const nodes = pathPointsToNodes(pathPoints);
    const d = nodesToPathD(nodes);
    const bounds = computePathPointsBounds(pathPoints);
    dispatch({ type: 'ADD_SHAPE', payload: { view, shape: {
      id: nanoid(), type: 'path', x: bounds.minX, y: bounds.minY,
      width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY, rotation: 0, d,
      style: { stroke: '#888', strokeWidth: 2, fill: 'none' },
    } as PathShape } });
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

  // --- Path editing (selected path) ---
  const selectedPathShape = useMemo(() => {
    if (activeTool !== 'select' || selectedIds.length !== 1) { return null; }
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

  // --- Mouse: wheel zoom ---
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) { return; }
    const r = svg.getBoundingClientRect();
    const result = computeWheelZoom(e.deltaY, e.clientX, e.clientY, r, zoom, panX, panY);
    setPanX(result.panX);
    setPanY(result.panY);
    setZoom(result.zoom);
  }, [zoom, panX, panY]);

  // --- Mouse: down ---
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (spaceHeld && e.button === 0)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panX, y: e.clientY - panY });
      e.preventDefault();
      return;
    }
    if (e.button !== 0) { return; }
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
        style: { fill: 'var(--color-editor-accent)', stroke: 'var(--color-editor-accent)', strokeWidth: 1 },
      };
      dispatch({ type: 'ADD_SHAPE', payload: { view, shape: pinShape } });
      dispatch({ type: 'ADD_CONNECTOR', payload: {
        id: connectorId,
        name: `pin${connectors.length + 1}`,
        connectorType: 'male',
        shapeIds: { [view]: [shapeId] },
        terminalPositions: { [view]: { x: pos.x, y: pos.y } },
      } });
      return;
    }
    if (activeTool === 'text') {
      const pos = toPartSpace(e.clientX, e.clientY);
      const text = prompt('Enter text:');
      if (text) {
        dispatch({ type: 'ADD_SHAPE', payload: { view, shape: {
          id: nanoid(), type: 'text', x: pos.x, y: pos.y, width: 100, height: 20, rotation: 0,
          text, style: { fill: '#ccc', fontSize: 14, fontFamily: 'sans-serif' },
        } as TextShape } });
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

  // --- Mouse: shape click (drag start) ---
  const handleShapeMouseDown = useCallback((e: React.MouseEvent, shapeId: string) => {
    if (activeTool !== 'select') { return; }
    e.stopPropagation();
    const targetShape = shapes.find((s) => s.id === shapeId);
    if (targetShape && isLayerLocked(targetShape.layer)) { return; }
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
    setDragOrigins(buildDragOrigins(shapes, selectedIds, shapeId, e.shiftKey));
  }, [activeTool, dispatch, toPartSpace, selectedIds, shapes, isLayerLocked]);

  // --- Mouse: move ---
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
        if (node.cp1) { node.cp1 = { x: node.cp1.x + dx, y: node.cp1.y + dy }; }
        if (node.cp2) { node.cp2 = { x: node.cp2.x + dx, y: node.cp2.y + dy }; }
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
      const result = computeDragMove(dragOrigins, dragStart, pos, shapes);
      dispatch({ type: 'MOVE_SHAPES', payload: { view, moves: result.moves } });
      setActiveGuides(result.guides);
    }
  }, [isPanning, panStart, drawStart, toPartSpace, isDragging, dragStart, dragOrigins, dispatch, view, marqueeStart, activeTool, shapes, isDrawingPath, pathClickStart, editingNodeDrag, selectedPathShape, editingPathNodes]);

  // --- Mouse: up ---
  const handleMouseUp = useCallback(() => {
    if (editingNodeDrag && selectedPathShape && editingPathNodes) {
      const d = nodesToPathD(editingPathNodes);
      const bounds = computeNodesBounds(editingPathNodes);
      dispatch({ type: 'UPDATE_SHAPE', payload: { view, shapeId: selectedPathShape.id, updates: { d, x: bounds.minX, y: bounds.minY, width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY } } });
      setEditingNodeDrag(null);
      return;
    }
    if (pathClickStart && activeTool === 'path') {
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
      const mw = Math.abs(marqueeCurrent.x - marqueeStart.x);
      const mh = Math.abs(marqueeCurrent.y - marqueeStart.y);
      if (mw > 2 || mh > 2) {
        const hit = shapesInMarquee(shapes, marqueeStart, marqueeCurrent);
        dispatch({ type: 'SET_SELECTION', payload: hit });
      }
      setMarqueeStart(null);
      setMarqueeCurrent(null);
      return;
    }
    if (drawStart && drawCurrent) {
      const x = Math.min(drawStart.x, drawCurrent.x);
      const y = Math.min(drawStart.y, drawCurrent.y);
      const w = Math.abs(drawCurrent.x - drawStart.x);
      const h = Math.abs(drawCurrent.y - drawStart.y);
      if (w > 2 || h > 2) {
        if (activeTool === 'rect') {
          dispatch({ type: 'ADD_SHAPE', payload: { view, shape: {
            id: nanoid(), type: 'rect', x, y, width: w, height: h, rotation: 0,
            style: { fill: '#555', stroke: '#888', strokeWidth: 1 },
          } as import('@shared/component-types').RectShape } });
        } else if (activeTool === 'circle') {
          const sz = Math.max(w, h);
          dispatch({ type: 'ADD_SHAPE', payload: { view, shape: {
            id: nanoid(), type: 'circle', x, y, width: sz, height: sz,
            cx: x + sz / 2, cy: y + sz / 2, rotation: 0,
            style: { fill: '#555', stroke: '#888', strokeWidth: 1 },
          } as CircleShape } });
        } else if (activeTool === 'line') {
          dispatch({ type: 'ADD_SHAPE', payload: { view, shape: {
            id: nanoid(), type: 'path', x: drawStart.x, y: drawStart.y,
            width: w, height: h, rotation: 0,
            d: `M ${drawStart.x} ${drawStart.y} L ${drawCurrent.x} ${drawCurrent.y}`,
            style: { stroke: '#888', strokeWidth: 2 },
          } as PathShape } });
        }
      }
      setDrawStart(null);
      setDrawCurrent(null);
    }
  }, [isPanning, isDragging, drawStart, drawCurrent, activeTool, dispatch, view, marqueeStart, marqueeCurrent, shapes, editingNodeDrag, selectedPathShape, editingPathNodes, pathClickStart, pathDraggingHandle, pathCursorPos]);

  // --- Keyboard shortcuts ---
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
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') { setSpaceHeld(false); } };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [selectedIds, dispatch, view, zoomToFit, activeTool, isDrawingPath, finishPath, cancelPath]);

  // --- Path node toggle / simplify ---
  const handleToggleNodeType = useCallback((i: number) => {
    if (!editingPathNodes || !selectedPathShape) { return; }
    const newNodes = toggleNodeType(editingPathNodes, i);
    setEditingPathNodes(newNodes);
    const d = nodesToPathD(newNodes);
    const bounds = computeNodesBounds(newNodes);
    dispatch({ type: 'UPDATE_SHAPE', payload: { view, shapeId: selectedPathShape.id, updates: { d, x: bounds.minX, y: bounds.minY, width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY } } });
  }, [editingPathNodes, selectedPathShape, dispatch, view]);

  const handleSimplifyPath = useCallback(() => {
    if (!editingPathNodes || !selectedPathShape || editingPathNodes.length < 4) { return; }
    const simplified = simplifyPath(editingPathNodes, 2);
    setEditingPathNodes(simplified);
    const d = nodesToPathD(simplified);
    const bounds = computeNodesBounds(simplified);
    dispatch({ type: 'UPDATE_SHAPE', payload: { view, shapeId: selectedPathShape.id, updates: { d, x: bounds.minX, y: bounds.minY, width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY } } });
  }, [editingPathNodes, selectedPathShape, dispatch, view]);

  // --- Memoized SVG elements ---
  const gps = GRID_SIZE * zoom;

  const renderedShapes = useMemo(
    () => shapes.map((s) => renderShape(s, selectedIds, handleShapeMouseDown)),
    [shapes, selectedIds, handleShapeMouseDown],
  );

  const drcOverlayElements = useMemo(() => buildDrcOverlay(drcViolations, zoom), [drcViolations, zoom]);

  const constraintLines = useMemo(() => {
    const constraints = state.present.constraints || [];
    const viewShapes = state.present.views[view].shapes;
    return buildConstraintLines(constraints, viewShapes, zoom);
  }, [state.present.constraints, state.present.views, view, zoom]);

  const preview = useMemo(() => buildDrawPreview(drawStart, drawCurrent, activeTool), [drawStart, drawCurrent, activeTool]);

  const marqueeRect = useMemo(() => buildMarqueeRect(marqueeStart, marqueeCurrent), [marqueeStart, marqueeCurrent]);

  const connectorGhost = useMemo(() => buildConnectorGhost(activeTool, cursorPos), [activeTool, cursorPos]);

  const pathPreview = useMemo(
    () => buildPathPreview(pathPoints, pathCursorPos, isDrawingPath, pathClickStart, pathDraggingHandle),
    [pathPoints, pathCursorPos, isDrawingPath, pathClickStart, pathDraggingHandle],
  );

  const pathEditOverlay = useMemo(
    () => buildPathEditOverlay(
      editingPathNodes,
      selectedPathShape?.id ?? null,
      (nodeIndex, handle) => setEditingNodeDrag({ nodeIndex, handle }),
      handleToggleNodeType,
    ),
    [editingPathNodes, selectedPathShape, handleToggleNodeType],
  );

  // --- Toolbar ---
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

  // --- Render ---
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
            color: 'var(--color-editor-accent)',
            border: '1px solid var(--color-editor-accent)',
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
