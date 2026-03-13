/**
 * SimulationVisualOverlay — renders visual simulation state on top of the
 * schematic canvas. Shows LED glow effects, resistor value labels, and
 * switch states when simulation is active.
 *
 * BL-0619: Component visual state rendering during simulation
 */

import { memo, useMemo } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useSimulation } from '@/lib/contexts/simulation-context';
import {
  ledColorToCSS,
  formatSIValue,
} from '@/lib/simulation/visual-state';
import type {
  ComponentVisualState,
  LEDVisualState,
  ResistorVisualState,
} from '@/lib/simulation/visual-state';
import './simulation-overlays.css';

interface NodePosition {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  refDes: string;
}

/**
 * LED glow effect rendered as an absolutely-positioned SVG overlay.
 */
function LEDGlowOverlay({ pos, state }: { pos: NodePosition; state: LEDVisualState }) {
  if (!state.glowing) { return null; }

  const color = ledColorToCSS(state.color);
  const brightness = state.brightness;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: pos.x,
        top: pos.y,
        width: pos.width,
        height: pos.height,
        ['--led-color' as string]: color,
        ['--led-brightness' as string]: brightness,
      }}
      data-testid={`sim-led-glow-${pos.refDes}`}
    >
      <svg
        width={pos.width}
        height={pos.height}
        className="sim-led-glow"
        style={{ overflow: 'visible' }}
      >
        <circle
          cx={pos.width / 2}
          cy={pos.height / 2}
          r={Math.max(pos.width, pos.height) * 0.6}
          fill={color}
          opacity={brightness * 0.4}
        />
        <circle
          cx={pos.width / 2}
          cy={pos.height / 2}
          r={Math.max(pos.width, pos.height) * 0.3}
          fill={color}
          opacity={brightness * 0.7}
        />
      </svg>
    </div>
  );
}

/**
 * Resistor/generic component value label overlay.
 */
function ValueLabelOverlay({ pos, state }: { pos: NodePosition; state: ResistorVisualState }) {
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: pos.x + pos.width + 4,
        top: pos.y - 2,
      }}
      data-testid={`sim-value-label-${pos.refDes}`}
    >
      <div className="bg-black/70 border border-[#00F0FF]/20 px-1.5 py-0.5 rounded whitespace-nowrap">
        <span className="text-[8px] font-mono text-[#00F0FF] block leading-tight">
          {formatSIValue(state.voltageDrop, 'V')}
        </span>
        <span className="text-[8px] font-mono text-[#00F0FF]/70 block leading-tight">
          {formatSIValue(state.current, 'A')}
        </span>
      </div>
    </div>
  );
}

/**
 * Main overlay component — reads simulation state and positions annotations
 * relative to React Flow nodes.
 */
const SimulationVisualOverlay = memo(function SimulationVisualOverlay() {
  const { isLive, componentVisualStates } = useSimulation();
  const reactFlow = useReactFlow();

  // Collect node positions from React Flow
  const nodePositions = useMemo((): NodePosition[] => {
    if (!isLive || componentVisualStates.size === 0) { return []; }

    const nodes = reactFlow.getNodes();
    const positions: NodePosition[] = [];

    for (const node of nodes) {
      if (!node.id.startsWith('instance-')) { continue; }
      const refDes = (node.data as Record<string, unknown>)?.referenceDesignator;
      if (typeof refDes !== 'string') { continue; }
      if (!componentVisualStates.has(refDes)) { continue; }

      const measured = node.measured;
      const width = measured?.width ?? 80;
      const height = measured?.height ?? 40;

      positions.push({
        id: node.id,
        x: node.position.x,
        y: node.position.y,
        width,
        height,
        refDes,
      });
    }

    return positions;
  }, [isLive, componentVisualStates, reactFlow]);

  if (!isLive || componentVisualStates.size === 0) { return null; }

  return (
    <div className="absolute inset-0 pointer-events-none z-[5]" data-testid="simulation-visual-overlay">
      {nodePositions.map((pos) => {
        const state = componentVisualStates.get(pos.refDes);
        if (!state) { return null; }

        return (
          <OverlayForState key={pos.id} pos={pos} state={state} />
        );
      })}
    </div>
  );
});

function OverlayForState({ pos, state }: { pos: NodePosition; state: ComponentVisualState }) {
  switch (state.type) {
    case 'led':
      return <LEDGlowOverlay pos={pos} state={state} />;
    case 'resistor':
      return <ValueLabelOverlay pos={pos} state={state} />;
    case 'generic':
      if (Math.abs(state.current) > 0.0001) {
        return <ValueLabelOverlay pos={pos} state={{ type: 'resistor', voltageDrop: state.voltageDrop, current: state.current }} />;
      }
      return null;
    case 'switch':
      return (
        <div
          className="absolute pointer-events-none"
          style={{ left: pos.x + pos.width + 4, top: pos.y + pos.height / 2 - 8 }}
          data-testid={`sim-switch-${pos.refDes}`}
        >
          <span className={`text-[9px] font-bold ${state.closed ? 'text-emerald-400' : 'text-red-400'}`}>
            {state.closed ? 'ON' : 'OFF'}
          </span>
        </div>
      );
    default:
      return null;
  }
}

export default SimulationVisualOverlay;
