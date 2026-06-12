/**
 * WireLayer — SVG layer rendering committed breadboard wires (with simulation
 * current-flow animation, jumper endpoints, sim current labels) plus the
 * in-progress wire polyline.
 *
 * Extracted verbatim from breadboard-canvas/index.tsx (audit #32, W1.12b).
 * Purely presentational: all state stays in BreadboardCanvas.
 */

import { cn } from '@/lib/utils';
import { formatSIValue } from '@/lib/simulation/visual-state';
import type { WireVisualState } from '@/lib/simulation/visual-state';
import type { CircuitWireRow } from '@shared/schema';
import type { WireInProgress } from './canvas-helpers';

export interface WireLayerProps {
  /** Breadboard-view wires only (pre-filtered by the canvas). */
  wires: CircuitWireRow[];
  /** Whether a live simulation is running (enables animated current flow). */
  isLive: boolean;
  /** Per-net simulation visual states, keyed by String(netId). */
  wireVisualStates: Map<string, WireVisualState>;
  selectedWireId: number | null;
  onSelectWire: (wireId: number) => void;
  onWireContextMenu: (e: React.MouseEvent, wireId: number) => void;
  /** Wire currently being drawn with the wire tool, if any. */
  wireInProgress: WireInProgress | null;
}

export function WireLayer({
  wires,
  isLive,
  wireVisualStates,
  selectedWireId,
  onSelectWire,
  onWireContextMenu,
  wireInProgress,
}: WireLayerProps) {
  return (
    <>
      {/* Existing wires */}
      {wires.map((wire: CircuitWireRow) => {
        const pts = (wire.points as Array<{ x: number; y: number }>) ?? [];
        if (pts.length < 2) return null;
        const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        const isJumper = wire.provenance === 'jumper';
        const isSynced = wire.provenance === 'synced';
        const isCoach = wire.provenance === 'coach';

        // Look up simulation wire visual state
        const wireState: WireVisualState | undefined = isLive
          ? wireVisualStates.get(String(wire.netId))
          : undefined;
        const isAnimated = wireState != null && wireState.animationSpeed > 0;
        const animDuration = isAnimated ? Math.max(0.05, 16 / wireState.animationSpeed) : 0;
        const animDirection = wireState?.currentDirection === -1 ? 'reverse' : 'forward';

        return (
          <g key={wire.id}>
            {/* Simulation current flow glow */}
            {isAnimated && (
              <path
                d={pathD}
                stroke="var(--color-editor-accent)"
                strokeWidth={(wire.width ?? 1.5) + 1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                opacity={0.2}
                style={{ filter: 'blur(1.5px)' }}
                pointerEvents="none"
              />
            )}
            <path
              d={pathD}
              stroke={isAnimated ? 'var(--color-editor-accent)' : isJumper ? '#f59e0b' : (wire.color ?? '#3498db')}
              strokeWidth={isJumper ? 3 : (wire.width ?? 1.5)}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={isSynced ? '6 3' : isCoach ? '3 3' : undefined}
              fill="none"
              className={cn(
                isAnimated ? 'sim-wire-animated' : 'transition-opacity cursor-pointer',
                !isAnimated && (selectedWireId === wire.id ? 'opacity-100' : 'opacity-80 hover:opacity-100'),
              )}
              style={isAnimated ? { animationDuration: `${animDuration}s` } : undefined}
              data-direction={isAnimated ? animDirection : undefined}
              onClick={(e) => {
                e.stopPropagation();
                onSelectWire(wire.id);
              }}
              onContextMenu={(e) => onWireContextMenu(e, wire.id)}
              data-testid={isAnimated ? `wire-animated-${wire.id}` : `wire-${wire.id}`}
            />
            {/* Jumper wire endpoint connectors */}
            {isJumper && pts.length >= 2 && (
              <>
                <circle cx={pts[0].x} cy={pts[0].y} r={3} fill="#f59e0b" stroke="#92400e" strokeWidth={0.5} />
                <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={3} fill="#f59e0b" stroke="#92400e" strokeWidth={0.5} />
              </>
            )}
            {/* Simulation current label at wire midpoint */}
            {isAnimated && pts.length >= 2 && (() => {
              const midIdx = Math.floor(pts.length / 2);
              const midPt = pts[midIdx];
              return (
                <g pointerEvents="none">
                  <rect
                    x={midPt.x + 2}
                    y={midPt.y - 6}
                    width={30}
                    height={10}
                    rx={2}
                    fill="rgba(0,0,0,0.7)"
                    stroke="rgba(0,240,255,0.2)"
                    strokeWidth={0.5}
                  />
                  <text
                    x={midPt.x + 4}
                    y={midPt.y + 1}
                    fill="var(--color-editor-accent)"
                    fontSize={6}
                    fontFamily="monospace"
                    data-testid={`wire-sim-label-${wire.id}`}
                  >
                    {formatSIValue(wireState.currentMagnitude, 'A')}
                  </text>
                </g>
              );
            })()}
          </g>
        );
      })}

      {/* Wire in progress */}
      {wireInProgress && wireInProgress.points.length >= 1 && (
        <g data-testid="wire-in-progress">
          <polyline
            points={wireInProgress.points.map(p => `${p.x},${p.y}`).join(' ')}
            stroke={wireInProgress.color}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray="2,1"
            opacity={0.8}
          />
          {wireInProgress.points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={1.5}
              fill={wireInProgress.color}
              opacity={0.6}
            />
          ))}
        </g>
      )}
    </>
  );
}
