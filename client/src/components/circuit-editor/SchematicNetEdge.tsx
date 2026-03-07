import { memo } from 'react';
import {
  getSmoothStepPath,
  EdgeLabelRenderer,
  type EdgeProps,
  type Edge,
} from '@xyflow/react';
import type { NetType } from '@shared/circuit-types';

export interface NetEdgeData {
  netName: string;
  netType: NetType;
  color?: string;
  busWidth?: number;
  highlighted?: boolean;
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
  const { netName, netType, color, busWidth, highlighted } = data ?? {};
  const isBus = netType === 'bus';
  const isHighlighted = highlighted || selected;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 0,
  });

  const baseStrokeColor =
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
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        style={{
          ...style,
          stroke: strokeColor,
          strokeWidth,
          fill: 'none',
        }}
        markerEnd={markerEnd}
      />
      {/* Net name + optional bus width label */}
      {netName && (
        <EdgeLabelRenderer>
          <div
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
            className="absolute text-[9px] text-muted-foreground bg-background/80 px-1 rounded pointer-events-none nodrag nopan"
          >
            {netName}
            {isBus && busWidth ? ` [${busWidth}]` : ''}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

export default SchematicNetEdge;
