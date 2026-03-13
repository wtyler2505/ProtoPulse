import { memo, useSyncExternalStore } from 'react';
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

export interface NetEdgeData {
  netName: string;
  netType: NetType;
  color?: string;
  busWidth?: number;
  highlighted?: boolean;
  /** Net ID for wire visual state lookup (set during simulation) */
  netId?: number;
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
  const { netName, netType, color, busWidth, highlighted, netId } = data ?? {};
  const isBus = netType === 'bus';
  const isHighlighted = highlighted || selected;

  const { isLive, wireVisualStates } = useSimulation();

  // BL-0490: Subscribe to net color manager for per-net custom colors
  const netColorSnapshot = useSyncExternalStore(
    (cb) => netColorManager.subscribe(cb),
    () => (netId != null ? netColorManager.getNetColor(netId) : undefined),
  );

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
        {netName && (
          <div
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
            className="absolute text-[9px] text-muted-foreground bg-background/80 px-1 rounded pointer-events-none nodrag nopan"
          >
            {netName}
            {isBus && busWidth ? ` [${busWidth}]` : ''}
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
