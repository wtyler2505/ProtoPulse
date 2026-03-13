import { memo, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  getSmoothStepPath,
  EdgeLabelRenderer,
  type EdgeProps,
  type Edge,
} from '@xyflow/react';
import type { NetType } from '@shared/circuit-types';
import { useSimulation } from '@/lib/contexts/simulation-context';
import { formatSIValue } from '@/lib/simulation/visual-state';
import { netColorManager } from '@/lib/circuit-editor/net-colors';
import './simulation-overlays.css';

// Stable subscribe function — defined at module level to avoid re-subscriptions every render
const subscribeNetColors = (cb: () => void) => netColorManager.subscribe(cb);

export interface NetEdgeData {
  netName: string;
  netType: NetType;
  color?: string;
  busWidth?: number;
  highlighted?: boolean;
  /** Net ID for wire visual state lookup (set during simulation) */
  netId?: number;
  /** BL-0489: Callback to rename the net via inline editing */
  onNetNameChange?: (netId: number, newName: string) => void;
  [key: string]: unknown; // Required by @xyflow/react — all edge data types must be indexable
}

const SchematicNetEdge = memo(function SchematicNetEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style,
  markerEnd,
  selected,
}: EdgeProps<Edge<NetEdgeData>>) {
  const { netName, netType, color, busWidth, highlighted, netId, onNetNameChange } = data ?? {};
  const isBus = netType === 'bus';
  const isHighlighted = highlighted || selected;

  // BL-0489: Inline editing state for net label
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(netName ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const commitEdit = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== netName && netId != null && onNetNameChange) {
      onNetNameChange(netId, trimmed);
    }
    setIsEditing(false);
  }, [editValue, netName, netId, onNetNameChange]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditValue(netName ?? '');
  }, [netName]);

  const { isLive, wireVisualStates } = useSimulation();

  // BL-0490: Subscribe to net color manager for per-net custom colors
  const getNetColorSnapshot = useCallback(
    () => (netId != null ? netColorManager.getNetColor(netId) : undefined),
    [netId],
  );
  const netColorSnapshot = useSyncExternalStore(subscribeNetColors, getNetColorSnapshot);

  // Look up wire visual state from simulation context
  const wireState = isLive && netId != null
    ? wireVisualStates.get(String(netId))
    : undefined;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 0,
  });

  // BL-0490: Priority: custom net color > edge-level color > type-based default
  const baseStrokeColor =
    netColorSnapshot ??
    color ??
    (netType === 'power'
      ? '#ef4444'
      : netType === 'ground'
        ? '#22c55e'
        : isBus
          ? '#f59e0b'
          : '#06b6d4');

  // When highlighted via net selection, use bright neon cyan
  const strokeColor = isHighlighted ? '#00F0FF' : baseStrokeColor;

  // Bus nets render thicker to indicate multiple signals
  const baseWidth = isBus ? 3 : 1.5;
  const strokeWidth = isHighlighted ? baseWidth + 2 : baseWidth;

  // Wire animation properties
  const isAnimated = wireState != null && wireState.animationSpeed > 0;
  const animDuration = isAnimated ? Math.max(0.05, 16 / wireState.animationSpeed) : 0;
  const animDirection = wireState?.currentDirection === -1 ? 'reverse' : 'forward';

  return (
    <>
      {/* Glow effect for highlighted net */}
      {isHighlighted && (
        <path
          d={edgePath}
          style={{
            stroke: '#00F0FF',
            strokeWidth: strokeWidth + 4,
            fill: 'none',
            opacity: 0.25,
            filter: 'blur(3px)',
          }}
        />
      )}

      {/* Simulation current flow glow (subtle) */}
      {isAnimated && (
        <path
          d={edgePath}
          style={{
            stroke: '#00F0FF',
            strokeWidth: strokeWidth + 2,
            fill: 'none',
            opacity: 0.15,
            filter: 'blur(2px)',
          }}
        />
      )}

      <path
        id={id}
        className={`react-flow__edge-path${isAnimated ? ' sim-wire-animated' : ''}`}
        d={edgePath}
        style={{
          ...style,
          stroke: isAnimated ? '#00F0FF' : strokeColor,
          strokeWidth,
          fill: 'none',
          ...(isAnimated ? { animationDuration: `${animDuration}s` } : {}),
        }}
        data-direction={isAnimated ? animDirection : undefined}
        markerEnd={markerEnd}
        data-testid={isAnimated ? `wire-animated-${id}` : undefined}
      />

      {/* Net name + optional bus width label + simulation voltage */}
      <EdgeLabelRenderer>
        {netName && !isEditing && (
          <div
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
            className="absolute text-[9px] text-muted-foreground bg-background/80 px-1 rounded nodrag nopan cursor-pointer"
            data-testid={`net-edge-label-${id}`}
            onDoubleClick={() => {
              if (onNetNameChange && netId != null) {
                setEditValue(netName);
                setIsEditing(true);
              }
            }}
          >
            {netName}
            {isBus && busWidth ? ` [${busWidth}]` : ''}
          </div>
        )}

        {/* BL-0489: Inline editing input for net name */}
        {isEditing && (
          <div
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
            className="absolute nodrag nopan"
          >
            <input
              ref={inputRef}
              data-testid={`net-edge-label-input-${id}`}
              className="text-[9px] font-mono text-cyan-400 bg-background border border-cyan-400 rounded px-1 py-0 outline-none w-24"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { commitEdit(); }
                if (e.key === 'Escape') { cancelEdit(); }
                e.stopPropagation();
              }}
              onBlur={commitEdit}
              onMouseDown={(e) => e.stopPropagation()}
            />
          </div>
        )}

        {/* BL-0128: Voltage label at midpoint during simulation */}
        {isLive && wireState != null && wireState.currentMagnitude > 0.0001 && (
          <div
            style={{
              transform: `translate(-50%, 6px) translate(${labelX}px,${labelY}px)`,
            }}
            className="absolute text-[8px] font-mono text-[#00F0FF] bg-black/70 px-1 py-0.5 rounded pointer-events-none nodrag nopan whitespace-nowrap"
            data-testid={`wire-sim-label-${id}`}
          >
            {formatSIValue(wireState.currentMagnitude, 'A')}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
});

export default SchematicNetEdge;
