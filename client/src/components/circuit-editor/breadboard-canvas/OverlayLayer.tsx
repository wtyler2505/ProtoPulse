/**
 * OverlayLayer — SVG layer for transient canvas overlays: the keyboard cursor
 * indicator (S6-01), live-simulation component states (BL-0619 / BL-0128), and
 * the hovered inspector pin highlight.
 *
 * Extracted verbatim from breadboard-canvas/index.tsx (audit #32, W1.12b).
 * Purely presentational: all state stays in BreadboardCanvas.
 */

import { coordToPixel } from '@/lib/circuit-editor/breadboard-model';
import { formatSIValue } from '@/lib/simulation/visual-state';
import type { ComponentVisualState } from '@/lib/simulation/visual-state';
import type { CursorState } from '@/lib/circuit-editor/useBreadboardCursor';
import type { BreadboardSelectedPartModel } from '@/lib/breadboard-part-inspector';
import type { CircuitInstanceRow } from '@shared/schema';

export interface OverlayLayerProps {
  /** Keyboard navigation cursor state (S6-01). */
  cursor: CursorState;
  /** Whether a live simulation is running. */
  isLive: boolean;
  /** Per-refdes simulation component visual states. */
  componentVisualStates: Map<string, ComponentVisualState>;
  instances: CircuitInstanceRow[];
  selectedInstanceModel: BreadboardSelectedPartModel | null;
  hoveredInspectorPinId: string | null;
}

export function OverlayLayer({
  cursor,
  isLive,
  componentVisualStates,
  instances,
  selectedInstanceModel,
  hoveredInspectorPinId,
}: OverlayLayerProps) {
  return (
    <>
      {/* Keyboard cursor indicator — S6-01 */}
      {cursor.active && (() => {
        const cursorPx = coordToPixel({ type: 'terminal', col: cursor.col, row: cursor.row });
        return (
          <g data-testid="breadboard-keyboard-cursor" className="bb-cursor-blink">
            <circle
              cx={cursorPx.x}
              cy={cursorPx.y}
              r={6}
              fill="none"
              stroke="#facc15"
              strokeWidth={1.5}
              opacity={0.9}
            />
            <circle
              cx={cursorPx.x}
              cy={cursorPx.y}
              r={2}
              fill="#facc15"
              opacity={0.9}
            />
          </g>
        );
      })()}

      {/* BL-0619 / BL-0128: Simulation component visual overlays */}
      {isLive && componentVisualStates.size > 0 && instances.map((inst) => {
        if (inst.breadboardX == null || inst.breadboardY == null) { return null; }
        const state = componentVisualStates.get(inst.referenceDesignator);
        if (!state) { return null; }

        const x = inst.breadboardX;
        const y = inst.breadboardY;

        if (state.type === 'led' && state.glowing) {
          const color = state.color === 'red' ? '#ef4444'
            : state.color === 'green' ? '#22c55e'
            : state.color === 'blue' ? '#3b82f6'
            : state.color === 'yellow' ? '#facc15'
            : state.color === 'white' ? '#f5f5f5'
            : '#22c55e';
          return (
            <g key={`sim-led-${inst.id}`} pointerEvents="none" data-testid={`sim-bb-led-${inst.referenceDesignator}`}>
              <circle cx={x} cy={y} r={8} fill={color} opacity={state.brightness * 0.3} style={{ filter: 'blur(4px)' }} />
              <circle cx={x} cy={y} r={4} fill={color} opacity={state.brightness * 0.6} />
            </g>
          );
        }

        if (state.type === 'resistor' || (state.type === 'generic' && Math.abs(state.current) > 0.0001)) {
          return (
            <g key={`sim-val-${inst.id}`} pointerEvents="none" data-testid={`sim-bb-value-${inst.referenceDesignator}`}>
              <rect x={x + 8} y={y - 8} width={32} height={14} rx={2} fill="rgba(0,0,0,0.7)" stroke="rgba(0,240,255,0.2)" strokeWidth={0.5} />
              <text x={x + 10} y={y - 1} fill="var(--color-editor-accent)" fontSize={5} fontFamily="monospace">
                {formatSIValue(state.voltageDrop, 'V')}
              </text>
              <text x={x + 10} y={y + 4} fill="var(--color-editor-accent)" fontSize={5} fontFamily="monospace" opacity={0.7}>
                {formatSIValue(state.current, 'A')}
              </text>
            </g>
          );
        }

        if (state.type === 'switch') {
          return (
            <g key={`sim-sw-${inst.id}`} pointerEvents="none" data-testid={`sim-bb-switch-${inst.referenceDesignator}`}>
              <text
                x={x + 8}
                y={y + 2}
                fill={state.closed ? '#22c55e' : '#ef4444'}
                fontSize={6}
                fontFamily="sans-serif"
                fontWeight="bold"
              >
                {state.closed ? 'ON' : 'OFF'}
              </text>
            </g>
          );
        }

        return null;
      })}

      {/* Hovered inspector pin highlight */}
      {selectedInstanceModel && hoveredInspectorPinId && (() => {
        const pin = selectedInstanceModel.pins.find((candidate) => candidate.id === hoveredInspectorPinId);
        if (!pin) {
          return null;
        }

        return (
          <g data-testid="breadboard-pin-highlight" pointerEvents="none">
            <circle
              cx={pin.pixel.x}
              cy={pin.pixel.y}
              r={5}
              fill="rgba(0,240,255,0.14)"
              stroke="var(--color-editor-accent)"
              strokeWidth={1.2}
            />
            <circle
              cx={pin.pixel.x}
              cy={pin.pixel.y}
              r={2}
              fill="var(--color-editor-accent)"
              opacity={0.95}
            />
            <text
              x={pin.pixel.x + 6}
              y={pin.pixel.y - 6}
              fill="var(--color-editor-accent)"
              fontSize={5}
              fontFamily="monospace"
            >
              {pin.label} · {pin.coordLabel}
            </text>
          </g>
        );
      })()}
    </>
  );
}
