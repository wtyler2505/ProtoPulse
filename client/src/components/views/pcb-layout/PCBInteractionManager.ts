/**
 * PCBInteractionManager — Mouse/keyboard event handler factories
 * for the PCB layout canvas.
 *
 * Returns pure handler functions. No React hooks — all state updates
 * are performed through callback parameters.
 */

import { screenToBoardCoords, snapToGrid, computeWheelZoom, roundForDisplay } from './PCBCoordinateSystem';
import { TRACE_COLORS, toggleLayer } from './LayerManager';
import type { ActiveLayer, PcbTool } from './LayerManager';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Point {
  x: number;
  y: number;
}

export interface PanState {
  isPanning: boolean;
  lastMouse: Point;
}

/** Mutable ref state for marquee selection tracking. */
export interface SelectionDragState {
  isDragging: boolean;
  origin: Point;
}

/** Immutable rect describing an active selection marquee in board coordinates. */
export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasCallbacks {
  setTool: (tool: PcbTool) => void;
  setActiveLayer: (updater: (prev: ActiveLayer) => ActiveLayer) => void;
  setZoom: (updater: (prev: number) => number) => void;
  setPanOffset: (updater: (prev: Point) => Point) => void;
  setSelectedInstanceId: (id: number | null) => void;
  setSelectedWireId: (id: number | null) => void;
  setTracePoints: (updater: (prev: Point[]) => Point[]) => void;
  setMouseBoardPos: (pos: Point | null) => void;
  setInstanceRotation: (instanceId: number, rotation: number) => void;
  setSelectionRect?: (rect: SelectionRect | null) => void;
  setSelectedInstanceIds?: (ids: number[]) => void;
}

export interface TraceFinishParams {
  circuitId: number;
  activeLayer: ActiveLayer;
  traceWidth: number;
  firstNetId: number | undefined;
  createWire: (params: {
    circuitId: number;
    netId: number;
    view: string;
    points: Point[];
    layer: string;
    width: number;
    color: string;
    wireType: 'wire' | 'jump';
  }) => void;
}

export interface DeleteParams {
  circuitId: number;
  deleteWire: (params: { circuitId: number; id: number }) => void;
}

// ---------------------------------------------------------------------------
// Canvas click handler
// ---------------------------------------------------------------------------

export function handleCanvasClick(
  tool: PcbTool,
  svgEl: SVGSVGElement | null,
  panOffset: Point,
  zoom: number,
  callbacks: Pick<CanvasCallbacks, 'setSelectedInstanceId' | 'setSelectedWireId' | 'setTracePoints'>,
  e: React.MouseEvent,
): void {
  if (tool === 'trace') {
    if (!svgEl) {
      return;
    }
    const rect = svgEl.getBoundingClientRect();
    const bc = screenToBoardCoords(e.clientX, e.clientY, rect, panOffset.x, panOffset.y, zoom);
    const snapped = snapToGrid(bc.x, bc.y);
    callbacks.setTracePoints((prev) => [...prev, snapped]);
  } else {
    callbacks.setSelectedInstanceId(null);
    callbacks.setSelectedWireId(null);
  }
}

// ---------------------------------------------------------------------------
// Double-click: finish trace
// ---------------------------------------------------------------------------

export function handleDoubleClick(
  tool: PcbTool,
  tracePoints: Point[],
  params: TraceFinishParams,
  clearTrace: () => void,
): void {
  if (tool === 'trace' && tracePoints.length >= 2 && params.firstNetId != null) {
    params.createWire({
      circuitId: params.circuitId,
      netId: params.firstNetId,
      view: 'pcb',
      points: tracePoints,
      layer: params.activeLayer,
      width: params.traceWidth,
      color: TRACE_COLORS[params.activeLayer],
      wireType: 'wire' as const,
    });
    clearTrace();
  }
}

// ---------------------------------------------------------------------------
// Keyboard shortcuts
// ---------------------------------------------------------------------------

export function handleKeyDown(
  e: React.KeyboardEvent,
  selectedWireId: number | null,
  deleteParams: DeleteParams,
  callbacks: CanvasCallbacks,
  selectedInstanceId: number | null = null,
  tool: PcbTool = 'select',
  currentRotation: number = 0,
): void {
  if (e.key === 'Escape') {
    callbacks.setTracePoints(() => []);
    callbacks.setSelectedInstanceId(null);
    callbacks.setSelectedWireId(null);
  }

  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedWireId != null) {
    deleteParams.deleteWire({ circuitId: deleteParams.circuitId, id: selectedWireId });
    callbacks.setSelectedWireId(null);
  }

  if (e.key === '1') {
    callbacks.setTool('select');
  }
  if (e.key === '2') {
    callbacks.setTool('trace');
  }
  if (e.key === '3') {
    callbacks.setTool('delete');
  }
  if (e.key === '4') {
    callbacks.setTool('via');
  }
  if (e.key === 'f' || e.key === 'F') {
    callbacks.setActiveLayer(toggleLayer);
  }

  if ((e.key === 'r' || e.key === 'R') && selectedInstanceId != null && tool === 'select') {
    const newRotation = (currentRotation + 90) % 360;
    callbacks.setInstanceRotation(selectedInstanceId, newRotation);
  }
}

// ---------------------------------------------------------------------------
// Mouse: pan start + selection rect start
// ---------------------------------------------------------------------------

export function handleMouseDown(
  e: React.MouseEvent,
  tool: PcbTool,
  selectedInstanceId: number | null,
  panState: PanState,
  selectionState?: SelectionDragState,
  svgEl?: SVGSVGElement | null,
  panOffset?: Point,
  zoom?: number,
): void {
  if (e.button === 1) {
    // Middle-click always pans
    panState.isPanning = true;
    panState.lastMouse = { x: e.clientX, y: e.clientY };
    return;
  }

  if (e.button === 0 && tool === 'select' && selectedInstanceId == null) {
    // Left-click on empty space with select tool — start selection rect
    if (selectionState && svgEl && panOffset != null && zoom != null) {
      const rect = svgEl.getBoundingClientRect();
      const bc = screenToBoardCoords(e.clientX, e.clientY, rect, panOffset.x, panOffset.y, zoom);
      selectionState.isDragging = true;
      selectionState.origin = bc;
    } else {
      // Fallback: pan if selection state not provided
      panState.isPanning = true;
      panState.lastMouse = { x: e.clientX, y: e.clientY };
    }
  }
}

// ---------------------------------------------------------------------------
// Mouse: pan move + coordinate readout
// ---------------------------------------------------------------------------

export function handleMouseMove(
  e: React.MouseEvent,
  panState: PanState,
  svgEl: SVGSVGElement | null,
  panOffset: Point,
  zoom: number,
  callbacks: Pick<CanvasCallbacks, 'setPanOffset' | 'setMouseBoardPos' | 'setSelectionRect'>,
  selectionState?: SelectionDragState,
): void {
  if (panState.isPanning) {
    const dx = e.clientX - panState.lastMouse.x;
    const dy = e.clientY - panState.lastMouse.y;
    callbacks.setPanOffset((prev) => ({
      x: prev.x + dx,
      y: prev.y + dy,
    }));
    panState.lastMouse = { x: e.clientX, y: e.clientY };
  }

  if (!svgEl) {
    return;
  }
  const rect = svgEl.getBoundingClientRect();
  const bc = screenToBoardCoords(e.clientX, e.clientY, rect, panOffset.x, panOffset.y, zoom);
  callbacks.setMouseBoardPos({
    x: roundForDisplay(bc.x),
    y: roundForDisplay(bc.y),
  });

  // Update selection marquee rect while dragging
  if (selectionState?.isDragging && callbacks.setSelectionRect) {
    const ox = selectionState.origin.x;
    const oy = selectionState.origin.y;
    callbacks.setSelectionRect({
      x: Math.min(ox, bc.x),
      y: Math.min(oy, bc.y),
      width: Math.abs(bc.x - ox),
      height: Math.abs(bc.y - oy),
    });
  }
}

// ---------------------------------------------------------------------------
// Mouse: pan end
// ---------------------------------------------------------------------------

export function handleMouseUp(
  panState: PanState,
  selectionState?: SelectionDragState,
  selectionRect?: SelectionRect | null,
  instances?: Array<{ id: number; pcbX: number | null; pcbY: number | null }>,
  callbacks?: Pick<CanvasCallbacks, 'setSelectionRect' | 'setSelectedInstanceIds'>,
): void {
  panState.isPanning = false;

  // Finalize marquee selection
  if (selectionState?.isDragging) {
    selectionState.isDragging = false;

    if (selectionRect && instances && callbacks?.setSelectedInstanceIds) {
      const { x, y, width, height } = selectionRect;
      const selected = instances
        .filter((inst) => {
          if (inst.pcbX == null || inst.pcbY == null) { return false; }
          return (
            inst.pcbX >= x &&
            inst.pcbX <= x + width &&
            inst.pcbY >= y &&
            inst.pcbY <= y + height
          );
        })
        .map((inst) => inst.id);
      callbacks.setSelectedInstanceIds(selected);
    }

    callbacks?.setSelectionRect?.(null);
  }
}

// ---------------------------------------------------------------------------
// Wheel: zoom
// ---------------------------------------------------------------------------

export function handleWheel(
  e: WheelEvent,
  callbacks: Pick<CanvasCallbacks, 'setZoom'>,
): void {
  e.preventDefault();
  callbacks.setZoom((z) => computeWheelZoom(z, e.deltaY));
}
