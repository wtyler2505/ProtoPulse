/**
 * WireRerouteHandle — SVG overlay for interactive wire segment drag-rerouting.
 *
 * Renders a small circle handle at the midpoint of the hovered wire segment.
 * During drag, shows a ghost preview of the rerouted path as a dashed cyan line.
 *
 * Integrates with the WireRerouterManager singleton without modifying
 * SchematicCanvas.tsx directly.
 */

import { memo, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useViewport } from '@xyflow/react';
import {
  wireRerouterManager,
  hitTestSegment,
  type Point,
  type WireSegment,
  type DragPreview,
  type ExistingWire,
} from '@/lib/circuit-editor/wire-rerouter';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WireRerouteHandleProps {
  /** All wire segments in the current schematic view. */
  segments: WireSegment[];
  /** Wires from other nets (for overlap validation on drop). */
  existingWires: ExistingWire[];
  /** Grid size for snapping. */
  gridSize: number;
  /** Callback when a wire is successfully rerouted. */
  onReroute: (wireId: string, newPoints: Point[]) => void;
  /** Whether the reroute tool is enabled. */
  enabled: boolean;
}

// Stable subscribe function at module level to avoid re-subscription every render
const subscribeRerouter = (cb: () => void) => wireRerouterManager.subscribe(cb);
const getSnapshot = () => wireRerouterManager.getSnapshot();

// ---------------------------------------------------------------------------
// Path builder
// ---------------------------------------------------------------------------

function buildPolylinePath(points: Point[]): string {
  if (points.length < 2) return '';
  const parts: string[] = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 1; i < points.length; i++) {
    parts.push(`L ${points[i].x} ${points[i].y}`);
  }
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const WireRerouteHandle = memo(function WireRerouteHandle({
  segments,
  existingWires,
  gridSize,
  onReroute,
  enabled,
}: WireRerouteHandleProps) {
  const viewport = useViewport();

  // Subscribe to rerouter manager state
  useSyncExternalStore(subscribeRerouter, getSnapshot);

  const [hoveredSegment, setHoveredSegment] = useState<{
    segment: WireSegment;
    midpoint: Point;
  } | null>(null);

  // Track mouse position for hit testing
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });

  // Set grid size on the manager
  useEffect(() => {
    wireRerouterManager.setGridSize(gridSize);
  }, [gridSize]);

  // Recompute hovered segment when mouse moves (only when not dragging)
  useEffect(() => {
    if (!enabled || wireRerouterManager.isDragging) {
      setHoveredSegment(null);
      return;
    }

    const result = hitTestSegment(mousePos, segments, 8);
    if (result) {
      const { start, end } = result.segment;
      const midpoint: Point = {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2,
      };
      setHoveredSegment({ segment: result.segment, midpoint });
    } else {
      setHoveredSegment(null);
    }
  }, [enabled, mousePos, segments]);

  // Global mouse move handler for hit testing + drag updates
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!enabled) return;

      // Convert screen position to flow position
      const flowX = (e.clientX - viewport.x) / viewport.zoom;
      const flowY = (e.clientY - viewport.y) / viewport.zoom;
      const flowPos: Point = { x: flowX, y: flowY };

      if (wireRerouterManager.isDragging) {
        wireRerouterManager.updateDrag(flowPos);
      } else {
        setMousePos(flowPos);
      }
    },
    [enabled, viewport],
  );

  // Global mouse up handler for ending drag
  const handleMouseUp = useCallback(() => {
    if (!wireRerouterManager.isDragging) return;

    const result = wireRerouterManager.endDrag(existingWires);
    if (result && result.isValid) {
      onReroute(result.wireId, result.newPoints);
    }
  }, [existingWires, onReroute]);

  // Escape key to cancel drag
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && wireRerouterManager.isDragging) {
      wireRerouterManager.cancelDrag();
    }
  }, []);

  // Register global event listeners
  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleMouseMove, handleMouseUp, handleKeyDown]);

  // Clean up drag state when disabled
  useEffect(() => {
    if (!enabled) {
      wireRerouterManager.cancelDrag();
      setHoveredSegment(null);
    }
  }, [enabled]);

  // Handle mousedown on the reroute handle circle
  const handleHandleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!hoveredSegment) return;
      e.stopPropagation();
      e.preventDefault();

      const { segment } = hoveredSegment;
      // Find the full wire points from segments with the same wireId
      const wireSegments = segments
        .filter((s) => s.wireId === segment.wireId)
        .sort((a, b) => a.segmentIndex - b.segmentIndex);

      // Reconstruct the wire points array from sorted segments
      const wirePoints: Point[] = [];
      if (wireSegments.length > 0) {
        wirePoints.push({ ...wireSegments[0].start });
        for (const ws of wireSegments) {
          wirePoints.push({ ...ws.end });
        }
      }

      wireRerouterManager.startDrag(segment.wireId, segment.segmentIndex, wirePoints);
    },
    [hoveredSegment, segments],
  );

  // Get current preview
  const preview: DragPreview | null = wireRerouterManager.getDragPreview();
  const previewPath = useMemo(
    () => (preview ? buildPolylinePath(preview.points) : ''),
    [preview],
  );

  // Scale sizes inversely with zoom for consistent appearance
  const handleRadius = 5 / viewport.zoom;
  const strokeWidth = 1.5 / viewport.zoom;
  const dashSize = 4 / viewport.zoom;

  if (!enabled) return null;

  const isDragging = wireRerouterManager.isDragging;

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-30"
      style={{
        overflow: 'visible',
        cursor: isDragging ? 'grabbing' : undefined,
      }}
      data-testid="wire-reroute-overlay"
    >
      <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>
        {/* Drag preview — dashed cyan ghost line */}
        {isDragging && previewPath && (
          <path
            d={previewPath}
            stroke="var(--color-editor-accent)"
            strokeWidth={strokeWidth}
            strokeDasharray={`${dashSize} ${dashSize * 0.75}`}
            fill="none"
            opacity={0.7}
            data-testid="wire-reroute-preview"
          />
        )}

        {/* Handle circle at midpoint of hovered segment (hidden during drag) */}
        {!isDragging && hoveredSegment && (
          <circle
            cx={hoveredSegment.midpoint.x}
            cy={hoveredSegment.midpoint.y}
            r={handleRadius}
            fill="var(--color-editor-accent)"
            fillOpacity={0.8}
            stroke="var(--color-editor-accent)"
            strokeWidth={strokeWidth * 0.5}
            style={{ cursor: 'grab', pointerEvents: 'all' }}
            onMouseDown={handleHandleMouseDown}
            data-testid="wire-reroute-handle"
          />
        )}
      </g>
    </svg>
  );
});

export default WireRerouteHandle;
