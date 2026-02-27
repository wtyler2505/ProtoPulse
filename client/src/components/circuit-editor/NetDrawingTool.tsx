import { useState, useCallback, useEffect } from 'react';
import { useReactFlow, useViewport } from '@xyflow/react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Point {
  x: number;
  y: number;
}

interface DrawingState {
  sourceInstanceId: number;
  sourcePin: string;
  /** Flow-space position of the source pin */
  sourcePos: Point;
  /** Waypoints placed by intermediate canvas clicks (flow-space) */
  waypoints: Point[];
}

export interface NetDrawingResult {
  sourceInstanceId: number;
  sourcePin: string;
  targetInstanceId: number;
  targetPin: string;
  waypoints: Point[];
}

interface NetDrawingToolProps {
  active: boolean;
  snapEnabled: boolean;
  gridSize: number;
  onNetCreated: (result: NetDrawingResult) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Snap a point to the grid if snapping is enabled. */
function snap(pos: Point, gridSize: number, enabled: boolean): Point {
  if (!enabled) return pos;
  return {
    x: Math.round(pos.x / gridSize) * gridSize,
    y: Math.round(pos.y / gridSize) * gridSize,
  };
}

/**
 * Build an SVG path string using Manhattan routing (horizontal-first).
 * Each pair of consecutive points is connected by going horizontal then vertical.
 */
function buildManhattanPath(points: Point[]): string {
  if (points.length < 2) return '';

  const parts: string[] = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    // Horizontal then vertical
    parts.push(`L ${curr.x} ${prev.y}`);
    parts.push(`L ${curr.x} ${curr.y}`);
  }
  return parts.join(' ');
}

/**
 * Resolve the pin handle and instance ID from a click target.
 * Returns null if the target isn't a React Flow handle inside a schematic instance node.
 */
function resolveHandleClick(
  target: HTMLElement,
  reactFlow: ReturnType<typeof useReactFlow>,
): { instanceId: number; pin: string; pos: Point } | null {
  const handle = target.closest('.react-flow__handle') as HTMLElement | null;
  if (!handle) return null;

  const handleId = handle.getAttribute('data-handleid');
  const nodeEl = handle.closest('.react-flow__node') as HTMLElement | null;
  const nodeId = nodeEl?.getAttribute('data-id');

  if (!handleId || !nodeId) return null;

  // Only match our instance nodes (not other potential React Flow nodes)
  if (!nodeId.startsWith('instance-')) return null;

  const pin = handleId.replace('pin-', '');
  const instanceId = parseInt(nodeId.replace('instance-', ''), 10);
  if (isNaN(instanceId)) return null;

  // Get the center of the handle in flow coordinates
  const rect = handle.getBoundingClientRect();
  const pos = reactFlow.screenToFlowPosition({
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  });

  return { instanceId, pin, pos };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NetDrawingTool({
  active,
  snapEnabled,
  gridSize,
  onNetCreated,
}: NetDrawingToolProps) {
  const reactFlow = useReactFlow();
  const viewport = useViewport();
  const [drawing, setDrawing] = useState<DrawingState | null>(null);
  const [cursorPos, setCursorPos] = useState<Point>({ x: 0, y: 0 });

  // Reset drawing state when tool is deactivated
  useEffect(() => {
    if (!active) setDrawing(null);
  }, [active]);

  // Track cursor position in flow coordinates while drawing
  useEffect(() => {
    if (!active || !drawing) return;

    const onMouseMove = (e: MouseEvent) => {
      const pos = reactFlow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setCursorPos(snap(pos, gridSize, snapEnabled));
    };

    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, [active, drawing, reactFlow, gridSize, snapEnabled]);

  // Handle clicks: pin clicks to start/end, canvas clicks for waypoints
  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (!active) return;

      const target = e.target as HTMLElement;
      const handleInfo = resolveHandleClick(target, reactFlow);

      if (handleInfo) {
        if (!drawing) {
          // Start drawing from this pin
          setDrawing({
            sourceInstanceId: handleInfo.instanceId,
            sourcePin: handleInfo.pin,
            sourcePos: handleInfo.pos,
            waypoints: [],
          });
          setCursorPos(handleInfo.pos);
        } else {
          // Complete drawing if clicking a different pin
          if (
            handleInfo.instanceId === drawing.sourceInstanceId &&
            handleInfo.pin === drawing.sourcePin
          ) {
            // Clicked same pin — cancel
            setDrawing(null);
            return;
          }

          onNetCreated({
            sourceInstanceId: drawing.sourceInstanceId,
            sourcePin: drawing.sourcePin,
            targetInstanceId: handleInfo.instanceId,
            targetPin: handleInfo.pin,
            waypoints: drawing.waypoints,
          });
          setDrawing(null);
        }
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      // Canvas click while drawing — add waypoint
      if (drawing) {
        const pos = reactFlow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
        const snapped = snap(pos, gridSize, snapEnabled);
        setDrawing((prev) =>
          prev
            ? { ...prev, waypoints: [...prev.waypoints, snapped] }
            : null,
        );
        e.stopPropagation();
        e.preventDefault();
      }
    },
    [active, drawing, reactFlow, gridSize, snapEnabled, onNetCreated],
  );

  // Register click handler on the document (capture phase to intercept before React Flow)
  useEffect(() => {
    if (!active) return;
    document.addEventListener('click', handleClick, { capture: true });
    return () => document.removeEventListener('click', handleClick, { capture: true });
  }, [active, handleClick]);

  // Keyboard: Escape to cancel, Backspace to undo last waypoint
  useEffect(() => {
    if (!active || !drawing) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawing(null);
      } else if (e.key === 'Backspace' && drawing.waypoints.length > 0) {
        setDrawing((prev) =>
          prev ? { ...prev, waypoints: prev.waypoints.slice(0, -1) } : null,
        );
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, drawing]);

  // Nothing to render if not drawing
  if (!active || !drawing) return null;

  // Build the path from source → waypoints → cursor
  const allPoints: Point[] = [
    drawing.sourcePos,
    ...drawing.waypoints,
    cursorPos,
  ];

  const pathD = buildManhattanPath(allPoints);

  // Scale stroke width inversely with zoom so it appears consistent
  const strokeWidth = 1.5 / viewport.zoom;
  const dotRadius = 3 / viewport.zoom;

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-20"
      data-testid="net-drawing-overlay"
      style={{ overflow: 'visible' }}
    >
      <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>
        {/* In-progress wire path */}
        <path
          d={pathD}
          stroke="#06b6d4"
          strokeWidth={strokeWidth}
          strokeDasharray={`${4 / viewport.zoom} ${3 / viewport.zoom}`}
          fill="none"
        />

        {/* Source pin marker */}
        <circle
          cx={drawing.sourcePos.x}
          cy={drawing.sourcePos.y}
          r={dotRadius}
          fill="#06b6d4"
        />

        {/* Waypoint markers */}
        {drawing.waypoints.map((wp, i) => (
          <circle
            key={i}
            cx={wp.x}
            cy={wp.y}
            r={dotRadius * 0.7}
            fill="#06b6d4"
            opacity={0.6}
          />
        ))}

        {/* Cursor endpoint marker */}
        <circle
          cx={cursorPos.x}
          cy={cursorPos.y}
          r={dotRadius}
          fill="#06b6d4"
          opacity={0.4}
        />
      </g>
    </svg>
  );
}
