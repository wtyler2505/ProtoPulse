/**
 * BL-0542: BreadboardConnectivityOverlay
 *
 * SVG overlay that visualizes which breadboard rows/columns are
 * electrically connected during simulation. Holes are color-coded
 * by net type: power=red, ground=dark, signal=per-net color.
 * Semi-transparent fills with a subtle pulsing animation indicate
 * active connectivity.
 */

import { memo, useMemo } from 'react';
import {
  buildConnectivityMap,
  groupHolesByNet,
} from '@/lib/circuit-editor/breadboard-connectivity';
import type { ConnectedHole } from '@/lib/circuit-editor/breadboard-connectivity';
import type { CircuitNetRow, CircuitWireRow, CircuitInstanceRow, ComponentPart } from '@shared/schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BreadboardConnectivityOverlayProps {
  nets: CircuitNetRow[];
  wires: CircuitWireRow[];
  instances: CircuitInstanceRow[];
  parts: ComponentPart[];
  /** Whether to show the overlay (typically tied to simulation running) */
  visible: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HOLE_OVERLAY_RADIUS = 3.2;
const PULSE_DURATION = '2s';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders semi-transparent colored circles over breadboard holes
 * that belong to an active net, grouped by net type for color-coding.
 */
const BreadboardConnectivityOverlay = memo(function BreadboardConnectivityOverlay({
  nets,
  wires,
  instances,
  parts,
  visible,
}: BreadboardConnectivityOverlayProps) {
  // Build connectivity map from circuit data
  const connectivityMap = useMemo(
    () => buildConnectivityMap(nets, wires, instances, parts),
    [nets, wires, instances, parts],
  );

  // Group holes by net for efficient batch rendering
  const netGroups = useMemo(
    () => groupHolesByNet(connectivityMap),
    [connectivityMap],
  );

  if (!visible || netGroups.size === 0) {
    return null;
  }

  return (
    <g
      data-testid="breadboard-connectivity-overlay"
      pointerEvents="none"
      opacity={0.85}
    >
      {/* SVG animation definition for pulsing effect */}
      <defs>
        <filter id="bb-conn-glow">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {Array.from(netGroups.entries()).map(([netId, holes]) => {
        if (holes.length === 0) { return null; }
        const netInfo = connectivityMap.nets.get(netId);
        if (!netInfo) { return null; }

        return (
          <g
            key={`net-${netId}`}
            data-testid={`connectivity-net-${netId}`}
          >
            {holes.map((hole: ConnectedHole) => {
              const key = `${hole.coord.type === 'terminal'
                ? `${hole.coord.col}${hole.coord.row}`
                : `${hole.coord.rail}-${hole.coord.index}`}`;

              return (
                <circle
                  key={key}
                  cx={hole.pixel.x}
                  cy={hole.pixel.y}
                  r={HOLE_OVERLAY_RADIUS}
                  fill={hole.color}
                  opacity={0.45}
                  filter="url(#bb-conn-glow)"
                  data-testid={`connectivity-hole-${key}`}
                >
                  <animate
                    attributeName="opacity"
                    values="0.3;0.55;0.3"
                    dur={PULSE_DURATION}
                    repeatCount="indefinite"
                  />
                </circle>
              );
            })}

            {/* Net label at the first hole */}
            {holes.length > 0 && (
              <text
                x={holes[0].pixel.x}
                y={holes[0].pixel.y - 5}
                fill={netInfo.color}
                fontSize={5}
                fontFamily="monospace"
                fontWeight="bold"
                textAnchor="middle"
                opacity={0.8}
                data-testid={`connectivity-label-${netId}`}
              >
                {netInfo.name}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
});

export default BreadboardConnectivityOverlay;
