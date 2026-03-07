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
// Mouse: pan start
// ---------------------------------------------------------------------------

export function handleMouseDown(
  e: React.MouseEvent,
  tool: PcbTool,
  selectedInstanceId: number | null,
  panState: PanState,
): void {
  if (e.button === 1 || (e.button === 0 && tool === 'select' && selectedInstanceId == null)) {
    panState.isPanning = true;
    panState.lastMouse = { x: e.clientX, y: e.clientY };
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
  callbacks: Pick<CanvasCallbacks, 'setPanOffset' | 'setMouseBoardPos'>,
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
}

// ---------------------------------------------------------------------------
// Mouse: pan end
// ---------------------------------------------------------------------------

export function handleMouseUp(panState: PanState): void {
  panState.isPanning = false;
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
