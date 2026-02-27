import { memo, useMemo } from 'react';
import { useViewport } from '@xyflow/react';
import type { ERCViolation } from '@shared/circuit-types';

// ---------------------------------------------------------------------------
// ERC Overlay — renders violation markers on the schematic canvas
// ---------------------------------------------------------------------------

interface ERCOverlayProps {
  violations: ERCViolation[];
  highlightedId?: string | null;
}

const MARKER_SIZE = 18;

function ERCOverlayInner({ violations, highlightedId }: ERCOverlayProps) {
  const { x: vx, y: vy, zoom } = useViewport();

  // Group violations by location to stack markers
  const markers = useMemo(() => {
    const locationMap = new Map<string, ERCViolation[]>();
    for (const v of violations) {
      const key = `${v.location.x},${v.location.y}`;
      const existing = locationMap.get(key) ?? [];
      existing.push(v);
      locationMap.set(key, existing);
    }
    return Array.from(locationMap.entries()).map(([key, group]) => {
      // Use the highest severity in the group
      const hasSeverity = group.some((v) => v.severity === 'error');
      return {
        key,
        x: group[0].location.x,
        y: group[0].location.y,
        count: group.length,
        severity: hasSeverity ? 'error' as const : 'warning' as const,
        ids: group.map((v) => v.id),
        messages: group.map((v) => v.message),
      };
    });
  }, [violations]);

  if (violations.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width: '100%', height: '100%', overflow: 'visible' }}
      data-testid="erc-overlay"
    >
      <g transform={`translate(${vx}, ${vy}) scale(${zoom})`}>
        {markers.map((marker) => {
          const isHighlighted = marker.ids.some((id) => id === highlightedId);
          const isError = marker.severity === 'error';
          const color = isError ? '#ef4444' : '#f59e0b';
          const glowColor = isError ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)';
          const halfSize = MARKER_SIZE / 2;

          return (
            <g
              key={marker.key}
              transform={`translate(${marker.x}, ${marker.y})`}
              data-testid={`erc-marker-${marker.key}`}
            >
              {/* Glow ring for highlighted violation */}
              {isHighlighted && (
                <circle
                  cx={0}
                  cy={0}
                  r={halfSize + 4}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  opacity={0.6}
                >
                  <animate
                    attributeName="r"
                    values={`${halfSize + 2};${halfSize + 6};${halfSize + 2}`}
                    dur="1.2s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.6;0.2;0.6"
                    dur="1.2s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}

              {/* Background glow */}
              <circle cx={0} cy={0} r={halfSize} fill={glowColor} />

              {isError ? (
                /* Error: circle with X */
                <>
                  <circle
                    cx={0}
                    cy={0}
                    r={halfSize - 1}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.5}
                  />
                  <line
                    x1={-4}
                    y1={-4}
                    x2={4}
                    y2={4}
                    stroke={color}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                  />
                  <line
                    x1={4}
                    y1={-4}
                    x2={-4}
                    y2={4}
                    stroke={color}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                  />
                </>
              ) : (
                /* Warning: triangle with ! */
                <>
                  <polygon
                    points={`0,${-halfSize + 1} ${halfSize - 1},${halfSize - 2} ${-(halfSize - 1)},${halfSize - 2}`}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.5}
                    strokeLinejoin="round"
                  />
                  <line
                    x1={0}
                    y1={-3}
                    x2={0}
                    y2={3}
                    stroke={color}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                  />
                  <circle cx={0} cy={5.5} r={0.8} fill={color} />
                </>
              )}

              {/* Badge count (when multiple violations at same location) */}
              {marker.count > 1 && (
                <>
                  <circle
                    cx={halfSize - 2}
                    cy={-(halfSize - 2)}
                    r={5}
                    fill={color}
                  />
                  <text
                    x={halfSize - 2}
                    y={-(halfSize - 2)}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="white"
                    fontSize={7}
                    fontWeight="bold"
                  >
                    {marker.count > 9 ? '9+' : marker.count}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export default memo(ERCOverlayInner);
