/**
 * BreadboardWireEditor — SVG overlay for selecting, deleting, and
 * dragging breadboard wire endpoints.  BL-0543
 *
 * Renders:
 *   - A selection highlight (yellow glow) on the selected wire
 *   - Draggable circle handles at both endpoints of the selected wire
 *   - A small "x" delete button near the wire midpoint
 *
 * All coordinates are in board-space (pre-zoom/pan transform).
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  selectWireAtPoint,
  getWireEndpoints,
  hitTestEndpoint,
  type BreadboardWire,
  type WireEndpoint,
} from '@/lib/circuit-editor/breadboard-wire-editor';
import { pixelToCoord, coordToPixel } from '@/lib/circuit-editor/breadboard-model';
import type { PixelPos } from '@/lib/circuit-editor/breadboard-model';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface BreadboardWireEditorProps {
  /** All breadboard-view wires (the component filters internally). */
  wires: ReadonlyArray<BreadboardWire>;
  /** Currently selected wire ID (lifted state). */
  selectedWireId: number | null;
  /** Called when a wire is selected or deselected (null). */
  onSelectWire: (id: number | null) => void;
  /** Called when the user requests deletion of the selected wire. */
  onDeleteWire: (id: number) => void;
  /** Called when the user drags an endpoint to a new position. */
  onMoveEndpoint: (wireId: number, endpoint: WireEndpoint, newPos: PixelPos) => void;
  /** Current zoom level — needed to keep handle sizes constant on screen. */
  zoom: number;
  /** Whether the select tool is active (disables editor when false). */
  active: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Radius of endpoint drag handles (in screen pixels, divided by zoom). */
const HANDLE_RADIUS_PX = 5;
/** Radius of the delete button circle. */
const DELETE_RADIUS_PX = 6;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BreadboardWireEditor({
  wires,
  selectedWireId,
  onSelectWire,
  onDeleteWire,
  onMoveEndpoint,
  zoom,
  active,
}: BreadboardWireEditorProps) {
  const [dragging, setDragging] = useState<{
    wireId: number;
    endpoint: WireEndpoint;
    current: PixelPos;
  } | null>(null);

  const dragRef = useRef(dragging);
  dragRef.current = dragging;

  // Scaled sizes so handles appear constant regardless of zoom
  const handleR = HANDLE_RADIUS_PX / zoom;
  const deleteR = DELETE_RADIUS_PX / zoom;
  const strokeW = 1 / zoom;

  // --- Find the selected wire object ---
  const selectedWire = selectedWireId != null
    ? wires.find(w => w.id === selectedWireId) ?? null
    : null;

  const endpoints = selectedWire ? getWireEndpoints(selectedWire) : null;

  // --- Click handler: select wire at point ---
  const handleClick = useCallback(
    (e: React.MouseEvent<SVGGElement>) => {
      if (!active) { return; }
      // Get click position in board-space from the SVG <g> coordinate system
      const svg = (e.target as SVGElement).ownerSVGElement;
      if (!svg) { return; }

      const rect = svg.getBoundingClientRect();
      const g = svg.querySelector<SVGGElement>('[data-testid="breadboard-wire-editor-root"]');
      if (!g) { return; }

      // Use the SVG CTM to convert client coords → board coords
      const ctm = g.getScreenCTM();
      if (!ctm) { return; }
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const boardPt = pt.matrixTransform(ctm.inverse());

      const hit = selectWireAtPoint(boardPt.x, boardPt.y, wires);
      if (hit) {
        onSelectWire(hit.wire.id);
      }
    },
    [active, wires, onSelectWire],
  );

  // --- Drag start on endpoint handle ---
  const handleDragStart = useCallback(
    (wireId: number, endpoint: WireEndpoint, startPos: PixelPos) => {
      setDragging({ wireId, endpoint, current: startPos });
    },
    [],
  );

  // --- Global mousemove / mouseup for dragging ---
  useEffect(() => {
    if (!dragging) { return; }

    const handleMouseMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) { return; }
      // We need to get the SVG element to convert coordinates
      const svg = document.querySelector<SVGSVGElement>('[data-testid="breadboard-svg"]');
      if (!svg) { return; }
      const g = svg.querySelector<SVGGElement>('[data-testid="breadboard-wire-editor-root"]');
      if (!g) { return; }
      const ctm = g.getScreenCTM();
      if (!ctm) { return; }
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const boardPt = pt.matrixTransform(ctm.inverse());
      setDragging({ ...d, current: { x: boardPt.x, y: boardPt.y } });
    };

    const handleMouseUp = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) { return; }

      // Snap to nearest grid point
      const svg = document.querySelector<SVGSVGElement>('[data-testid="breadboard-svg"]');
      if (svg) {
        const g = svg.querySelector<SVGGElement>('[data-testid="breadboard-wire-editor-root"]');
        const ctm = g?.getScreenCTM();
        if (ctm) {
          const pt = svg.createSVGPoint();
          pt.x = e.clientX;
          pt.y = e.clientY;
          const boardPt = pt.matrixTransform(ctm.inverse());
          const coord = pixelToCoord({ x: boardPt.x, y: boardPt.y });
          const snapped = coord ? coordToPixel(coord) : { x: boardPt.x, y: boardPt.y };
          onMoveEndpoint(d.wireId, d.endpoint, snapped);
        }
      }

      setDragging(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, onMoveEndpoint]);

  // --- Keyboard: Delete / Backspace ---
  useEffect(() => {
    if (selectedWireId == null) { return; }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        onDeleteWire(selectedWireId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedWireId, onDeleteWire]);

  if (!active) { return null; }

  // --- Compute midpoint of selected wire for the delete button ---
  let midpoint: PixelPos | null = null;
  if (selectedWire && selectedWire.points.length >= 2) {
    const pts = selectedWire.points;
    const midIdx = Math.floor(pts.length / 2);
    if (pts.length % 2 === 0) {
      // Even: average of two middle points
      midpoint = {
        x: (pts[midIdx - 1].x + pts[midIdx].x) / 2,
        y: (pts[midIdx - 1].y + pts[midIdx].y) / 2,
      };
    } else {
      midpoint = { x: pts[midIdx].x, y: pts[midIdx].y };
    }
  }

  // Use drag preview position for the moving handle
  const displayEndpoints = endpoints
    ? {
        start: dragging?.endpoint === 'start'
          ? dragging.current
          : endpoints.start,
        end: dragging?.endpoint === 'end'
          ? dragging.current
          : endpoints.end,
      }
    : null;

  return (
    <g data-testid="breadboard-wire-editor-root" onClick={handleClick}>
      {/* Transparent overlay to capture clicks on wires */}
      {wires
        .filter(w => w.view === 'breadboard' && w.points.length >= 2)
        .map(wire => {
          const pts = wire.points;
          const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
          return (
            <path
              key={`hit-${wire.id}`}
              d={pathD}
              stroke="transparent"
              strokeWidth={Math.max(8 / zoom, (wire.width ?? 1.5) + 4 / zoom)}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ cursor: 'pointer' }}
              data-testid={`wire-hit-area-${wire.id}`}
            />
          );
        })}

      {/* Selection highlight */}
      {selectedWire && selectedWire.points.length >= 2 && (() => {
        const pts = selectedWire.points;
        const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        return (
          <path
            d={pathD}
            stroke="#facc15"
            strokeWidth={(selectedWire.width ?? 1.5) + 2 / zoom}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={0.5}
            pointerEvents="none"
            data-testid="wire-selection-highlight"
          />
        );
      })()}

      {/* Endpoint drag handles */}
      {displayEndpoints && selectedWireId != null && (
        <>
          {(['start', 'end'] as const).map(ep => {
            const pos = displayEndpoints[ep];
            const isDragging = dragging?.endpoint === ep;
            return (
              <circle
                key={ep}
                cx={pos.x}
                cy={pos.y}
                r={handleR}
                fill={isDragging ? '#facc15' : '#ffffff'}
                stroke="#facc15"
                strokeWidth={strokeW}
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleDragStart(selectedWireId, ep, pos);
                }}
                data-testid={`wire-handle-${ep}`}
              />
            );
          })}
        </>
      )}

      {/* Delete button at wire midpoint */}
      {midpoint && selectedWireId != null && !dragging && (
        <g
          style={{ cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation();
            onDeleteWire(selectedWireId);
          }}
          data-testid="wire-delete-button"
        >
          <circle
            cx={midpoint.x}
            cy={midpoint.y - 8 / zoom}
            r={deleteR}
            fill="#ef4444"
            stroke="#ffffff"
            strokeWidth={strokeW}
          />
          <text
            x={midpoint.x}
            y={midpoint.y - 8 / zoom}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#ffffff"
            fontSize={8 / zoom}
            fontFamily="sans-serif"
            fontWeight="bold"
            pointerEvents="none"
          >
            ×
          </text>
        </g>
      )}

      {/* Drag preview: dashed line showing wire with moved endpoint */}
      {dragging && selectedWire && selectedWire.points.length >= 2 && (() => {
        const pts = selectedWire.points.map((p, i) => {
          if (dragging.endpoint === 'start' && i === 0) { return dragging.current; }
          if (dragging.endpoint === 'end' && i === selectedWire.points.length - 1) { return dragging.current; }
          return p;
        });
        const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        return (
          <path
            d={pathD}
            stroke="#facc15"
            strokeWidth={(selectedWire.width ?? 1.5)}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={`${3 / zoom},${2 / zoom}`}
            opacity={0.7}
            pointerEvents="none"
            data-testid="wire-drag-preview"
          />
        );
      })()}
    </g>
  );
}
