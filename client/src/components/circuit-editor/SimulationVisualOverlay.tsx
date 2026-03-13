/**
 * SimulationVisualOverlay — renders visual simulation state on top of the
 * schematic canvas. Shows LED glow effects, resistor value labels,
 * switch states, and interactive controls when simulation is active.
 *
 * BL-0619: Component visual state rendering during simulation
 * BL-0621: Interactive component controls during simulation
 */

import { memo, useMemo, useCallback, useSyncExternalStore } from 'react';
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
import { InteractiveControlManager } from '@/lib/simulation/interactive-controls';
import type { InteractiveControl } from '@/lib/simulation/interactive-controls';
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

// ---------------------------------------------------------------------------
// Interactive control overlays (BL-0621)
// ---------------------------------------------------------------------------

/**
 * Hook to subscribe to InteractiveControlManager changes.
 */
function useInteractiveControls(): ReadonlyMap<string, InteractiveControl> {
  const mgr = InteractiveControlManager.getInstance();
  const subscribe = useCallback(
    (onStoreChange: () => void) => mgr.subscribe(onStoreChange),
    [mgr],
  );
  const getSnapshot = useCallback(
    () => mgr.getAllControls(),
    [mgr],
  );
  return useSyncExternalStore(subscribe, getSnapshot);
}

/**
 * Toggle switch control — clickable ON/OFF button.
 */
function SwitchControlOverlay({ pos, control }: { pos: NodePosition; control: InteractiveControl }) {
  const isOn = control.value === true;
  const handleClick = useCallback(() => {
    InteractiveControlManager.getInstance().applyControl(pos.refDes, 'toggle', !isOn);
  }, [pos.refDes, isOn]);

  return (
    <div
      className="absolute z-10"
      style={{ left: pos.x + pos.width + 4, top: pos.y + pos.height / 2 - 12 }}
    >
      <button
        type="button"
        className={`pointer-events-auto px-2 py-0.5 rounded text-[9px] font-bold border transition-colors cursor-pointer ${
          isOn
            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-400 hover:bg-emerald-500/30'
            : 'bg-red-500/20 border-red-400 text-red-400 hover:bg-red-500/30'
        }`}
        onClick={handleClick}
        data-testid={`sim-control-toggle-${pos.refDes}`}
      >
        {isOn ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}

/**
 * Momentary button control — active while held (mousedown/mouseup).
 */
function MomentaryControlOverlay({ pos }: { pos: NodePosition }) {
  const handleDown = useCallback(() => {
    InteractiveControlManager.getInstance().applyControl(pos.refDes, 'momentary', true);
  }, [pos.refDes]);

  const handleUp = useCallback(() => {
    InteractiveControlManager.getInstance().applyControl(pos.refDes, 'momentary', false);
  }, [pos.refDes]);

  return (
    <div
      className="absolute z-10"
      style={{ left: pos.x + pos.width + 4, top: pos.y + pos.height / 2 - 12 }}
    >
      <button
        type="button"
        className="pointer-events-auto px-2 py-0.5 rounded text-[9px] font-bold border border-amber-400 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors cursor-pointer active:bg-amber-500/50"
        onMouseDown={handleDown}
        onMouseUp={handleUp}
        onMouseLeave={handleUp}
        data-testid={`sim-control-momentary-${pos.refDes}`}
      >
        PUSH
      </button>
    </div>
  );
}

/**
 * Slider control for potentiometers / variable resistors.
 */
function SliderControlOverlay({ pos, control }: { pos: NodePosition; control: InteractiveControl }) {
  const value = typeof control.value === 'number' ? control.value : 0;
  const min = control.min ?? 0;
  const max = control.max ?? 1;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      InteractiveControlManager.getInstance().applyControl(pos.refDes, 'slider', parseFloat(e.target.value));
    },
    [pos.refDes],
  );

  const pct = max > min ? Math.round(((value - min) / (max - min)) * 100) : 0;

  return (
    <div
      className="absolute z-10"
      style={{ left: pos.x + pos.width + 4, top: pos.y + pos.height / 2 - 16 }}
    >
      <div className="pointer-events-auto bg-black/80 border border-[#00F0FF]/30 rounded px-1.5 py-1 flex flex-col items-center gap-0.5">
        <input
          type="range"
          min={min}
          max={max}
          step={0.01}
          value={value}
          onChange={handleChange}
          className="w-16 h-1 accent-[#00F0FF] cursor-pointer"
          data-testid={`sim-control-slider-${pos.refDes}`}
        />
        <span className="text-[8px] font-mono text-[#00F0FF]/80" data-testid={`sim-control-slider-value-${pos.refDes}`}>
          {pct}%
        </span>
      </div>
    </div>
  );
}

/**
 * Indicator overlay — shows voltage reading on LEDs/indicators.
 */
function IndicatorControlOverlay({ pos, control }: { pos: NodePosition; control: InteractiveControl }) {
  const value = typeof control.value === 'number' ? control.value : 0;
  return (
    <div
      className="absolute pointer-events-none z-10"
      style={{ left: pos.x + pos.width + 4, top: pos.y + pos.height / 2 - 8 }}
      data-testid={`sim-control-indicator-${pos.refDes}`}
    >
      <span className="text-[8px] font-mono text-[#00F0FF]/70">
        {formatSIValue(value, control.unit ?? 'V')}
      </span>
    </div>
  );
}

/**
 * Routes a single interactive control to the correct overlay widget.
 */
function InteractiveControlOverlay({ pos, control }: { pos: NodePosition; control: InteractiveControl }) {
  switch (control.controlType) {
    case 'toggle':
      return <SwitchControlOverlay pos={pos} control={control} />;
    case 'momentary':
      return <MomentaryControlOverlay pos={pos} />;
    case 'slider':
      return <SliderControlOverlay pos={pos} control={control} />;
    case 'indicator':
      return <IndicatorControlOverlay pos={pos} control={control} />;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Main overlay
// ---------------------------------------------------------------------------

/**
 * Main overlay component — reads simulation state and positions annotations
 * relative to React Flow nodes. Also renders interactive controls (BL-0621).
 */
const SimulationVisualOverlay = memo(function SimulationVisualOverlay() {
  const { isLive, componentVisualStates } = useSimulation();
  const reactFlow = useReactFlow();
  const interactiveControls = useInteractiveControls();

  // Collect node positions from React Flow — include nodes that have either
  // a visual state or an interactive control
  const nodePositions = useMemo((): NodePosition[] => {
    const hasVisuals = isLive && componentVisualStates.size > 0;
    const hasControls = isLive && interactiveControls.size > 0;
    if (!hasVisuals && !hasControls) { return []; }

    const nodes = reactFlow.getNodes();
    const positions: NodePosition[] = [];

    for (const node of nodes) {
      if (!node.id.startsWith('instance-')) { continue; }
      const refDes = (node.data as Record<string, unknown>)?.referenceDesignator;
      if (typeof refDes !== 'string') { continue; }
      if (!componentVisualStates.has(refDes) && !interactiveControls.has(refDes)) { continue; }

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
  }, [isLive, componentVisualStates, interactiveControls, reactFlow]);

  if (!isLive || (componentVisualStates.size === 0 && interactiveControls.size === 0)) { return null; }

  return (
    <div className="absolute inset-0 pointer-events-none z-[5]" data-testid="simulation-visual-overlay">
      {nodePositions.map((pos) => {
        const state = componentVisualStates.get(pos.refDes);
        const control = interactiveControls.get(pos.refDes);

        return (
          <div key={pos.id}>
            {state ? <OverlayForState pos={pos} state={state} /> : null}
            {control ? <InteractiveControlOverlay pos={pos} control={control} /> : null}
          </div>
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
