/**
 * ComponentVisualOverlay — renders per-component visual effects during
 * simulation. Overlays glow, heat, rotation, toggle states, and segment
 * displays on top of schematic/breadboard component instances.
 *
 * BL-0619: Component visual state rendering during simulation
 */

import { memo } from 'react';
import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import {
  getVisualCSS,
  getComponentVisualClass,
} from '@/lib/simulation/component-visual-renderers';
import type { ComponentVisualProps } from '@/lib/simulation/component-visual-renderers';
import { formatSIValue } from '@/lib/simulation/visual-state';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ComponentVisualOverlayProps {
  instanceId: string;
  componentType: string;
  visualProps: ComponentVisualProps;
  /** Position and size from the parent layout (absolute coords) */
  x: number;
  y: number;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Sub-renderers
// ---------------------------------------------------------------------------

function LEDOverlay({
  visualProps,
  width,
  height,
}: {
  visualProps: ComponentVisualProps & { type: 'led' };
  width: number;
  height: number;
}) {
  const { glowIntensity, color, glowing } = visualProps.props;
  if (!glowing) { return null; }

  const radius = Math.max(width, height) * 0.6;
  const cx = width / 2;
  const cy = height / 2;

  return (
    <svg
      width={width}
      height={height}
      className="sim-led-glow"
      style={{
        overflow: 'visible',
        ['--led-color' as string]: color,
        ['--led-brightness' as string]: glowIntensity,
      }}
      data-testid="sim-vis-led-svg"
    >
      <circle cx={cx} cy={cy} r={radius} fill={color} opacity={glowIntensity * 0.35} />
      <circle cx={cx} cy={cy} r={radius * 0.5} fill={color} opacity={glowIntensity * 0.65} />
    </svg>
  );
}

function ResistorHeatOverlay({
  visualProps,
  width,
  height,
}: {
  visualProps: ComponentVisualProps & { type: 'resistor' };
  width: number;
  height: number;
}) {
  const { heatLevel, powerDissipation } = visualProps.props;
  if (heatLevel <= 0.05) { return null; }

  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{ width, height }}
      data-testid="sim-vis-resistor-heat"
    >
      <span
        className="text-[7px] font-mono leading-none"
        style={{ color: heatLevel > 0.6 ? '#ef4444' : '#00F0FF' }}
      >
        {formatSIValue(powerDissipation, 'W')}
      </span>
    </div>
  );
}

function MotorOverlay({
  visualProps,
  width,
  height,
}: {
  visualProps: ComponentVisualProps & { type: 'motor' };
  width: number;
  height: number;
}) {
  const { rotationSpeed, direction } = visualProps.props;
  if (direction === 'stopped') { return null; }

  const duration = rotationSpeed > 0 ? 360 / rotationSpeed : 0;
  const animDir = direction === 'ccw' ? 'reverse' : 'normal';
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) * 0.3;

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }} data-testid="sim-vis-motor-svg">
      <g
        style={{
          transformOrigin: `${cx}px ${cy}px`,
          animation: duration > 0 ? `sim-motor-spin ${duration}s linear infinite ${animDir}` : 'none',
        }}
      >
        {/* 3-spoke indicator */}
        {[0, 120, 240].map((deg) => (
          <line
            key={deg}
            x1={cx}
            y1={cy}
            x2={cx + r * Math.cos((deg * Math.PI) / 180)}
            y2={cy + r * Math.sin((deg * Math.PI) / 180)}
            stroke="#00F0FF"
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.8}
          />
        ))}
        <circle cx={cx} cy={cy} r={3} fill="#00F0FF" opacity={0.9} />
      </g>
    </svg>
  );
}

function ServoOverlay({
  visualProps,
  width,
  height,
}: {
  visualProps: ComponentVisualProps & { type: 'servo' };
  width: number;
  height: number;
}) {
  const { angle } = visualProps.props;
  const cx = width / 2;
  const cy = height / 2;
  const armLen = Math.min(width, height) * 0.4;
  // Servo range: 0° maps to -90°, 180° maps to +90° in visual space
  const visualAngle = angle - 90;
  const radians = (visualAngle * Math.PI) / 180;

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }} data-testid="sim-vis-servo-svg">
      {/* Arc showing range */}
      <path
        d={`M ${cx - armLen} ${cy} A ${armLen} ${armLen} 0 0 1 ${cx + armLen} ${cy}`}
        fill="none"
        stroke="#00F0FF"
        strokeWidth={1}
        opacity={0.2}
        strokeDasharray="2,2"
      />
      {/* Current position arm */}
      <line
        x1={cx}
        y1={cy}
        x2={cx + armLen * Math.cos(radians)}
        y2={cy + armLen * Math.sin(radians)}
        stroke="#00F0FF"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r={3} fill="#00F0FF" />
      {/* Angle label */}
      <text
        x={cx}
        y={cy + armLen + 10}
        fill="#00F0FF"
        fontSize={7}
        textAnchor="middle"
        fontFamily="monospace"
        opacity={0.8}
      >
        {Math.round(angle)}°
      </text>
    </svg>
  );
}

function RelayOverlay({
  visualProps,
  width,
  height,
}: {
  visualProps: ComponentVisualProps & { type: 'relay' };
  width: number;
  height: number;
}) {
  const { energized } = visualProps.props;
  const cx = width / 2;
  const cy = height / 2;

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }} data-testid="sim-vis-relay-svg">
      {/* Contact indicator */}
      <rect
        x={cx - 8}
        y={cy - 4}
        width={16}
        height={8}
        rx={2}
        fill={energized ? 'rgba(34, 197, 94, 0.3)' : 'transparent'}
        stroke={energized ? '#22c55e' : '#ef4444'}
        strokeWidth={1.5}
      />
      {/* Contact arm */}
      <line
        x1={cx - 6}
        y1={energized ? cy : cy - 3}
        x2={cx + 6}
        y2={energized ? cy : cy + 3}
        stroke={energized ? '#22c55e' : '#ef4444'}
        strokeWidth={2}
        strokeLinecap="round"
        style={{ transition: 'all 0.2s ease' }}
      />
    </svg>
  );
}

function SwitchOverlay({
  visualProps,
  width,
}: {
  visualProps: ComponentVisualProps & { type: 'switch' };
  width: number;
}) {
  const { closed } = visualProps.props;

  return (
    <div
      className="flex items-center justify-center"
      style={{ width, height: 16 }}
      data-testid="sim-vis-switch-state"
    >
      <span
        className={cn(
          'text-[8px] font-bold font-mono',
          closed ? 'text-emerald-400' : 'text-red-400',
        )}
      >
        {closed ? 'CLOSED' : 'OPEN'}
      </span>
    </div>
  );
}

function BuzzerOverlay({
  visualProps,
  width,
  height,
}: {
  visualProps: ComponentVisualProps & { type: 'buzzer' };
  width: number;
  height: number;
}) {
  const { pulsing, frequency } = visualProps.props;
  if (!pulsing) { return null; }

  const period = frequency > 0 ? 1 / frequency : 1;
  const cx = width / 2;
  const cy = height / 2;

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }} data-testid="sim-vis-buzzer-svg">
      {/* Sound wave arcs */}
      {[1, 2, 3].map((i) => (
        <path
          key={i}
          d={`M ${cx + 6 + i * 4} ${cy - 4 - i * 2} Q ${cx + 10 + i * 4} ${cy} ${cx + 6 + i * 4} ${cy + 4 + i * 2}`}
          fill="none"
          stroke="#eab308"
          strokeWidth={1}
          opacity={0.3 + (0.2 / i)}
          style={{
            animation: `sim-buzzer-pulse ${period}s ease-in-out infinite`,
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </svg>
  );
}

function PotentiometerOverlay({
  visualProps,
  width,
  height,
}: {
  visualProps: ComponentVisualProps & { type: 'potentiometer' };
  width: number;
  height: number;
}) {
  const { angle, position } = visualProps.props;
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) * 0.3;
  // Map 0-270° to visual angle starting from -135°
  const visualAngle = -135 + angle;
  const radians = (visualAngle * Math.PI) / 180;

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }} data-testid="sim-vis-pot-svg">
      {/* Arc track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#00F0FF" strokeWidth={1} opacity={0.2} />
      {/* Wiper position */}
      <line
        x1={cx}
        y1={cy}
        x2={cx + r * Math.cos(radians)}
        y2={cy + r * Math.sin(radians)}
        stroke="#00F0FF"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r={2} fill="#00F0FF" />
      {/* Percentage label */}
      <text
        x={cx}
        y={cy + r + 10}
        fill="#00F0FF"
        fontSize={7}
        textAnchor="middle"
        fontFamily="monospace"
        opacity={0.8}
      >
        {Math.round(position * 100)}%
      </text>
    </svg>
  );
}

/** Standard 7-segment display segment paths (relative to a 20x30 bounding box) */
const SEG_PATHS: Record<string, string> = {
  a: 'M 3,1 L 17,1 L 15,3 L 5,3 Z',      // top
  b: 'M 18,2 L 18,14 L 16,12 L 16,4 Z',   // top-right
  c: 'M 18,16 L 18,28 L 16,26 L 16,18 Z',  // bottom-right
  d: 'M 3,29 L 17,29 L 15,27 L 5,27 Z',    // bottom
  e: 'M 2,16 L 2,28 L 4,26 L 4,18 Z',      // bottom-left
  f: 'M 2,2 L 2,14 L 4,12 L 4,4 Z',        // top-left
  g: 'M 3,15 L 17,15 L 15,17 L 5,17 Z',    // middle
};

function SevenSegmentOverlay({
  visualProps,
  width,
  height,
}: {
  visualProps: ComponentVisualProps & { type: 'seven_segment' };
  width: number;
  height: number;
}) {
  const { segments, decimalPoint } = visualProps.props;
  const segLabels = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const scale = Math.min(width / 24, height / 34);
  const offsetX = (width - 20 * scale) / 2;
  const offsetY = (height - 30 * scale) / 2;

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }} data-testid="sim-vis-7seg-svg">
      <g transform={`translate(${offsetX}, ${offsetY}) scale(${scale})`}>
        {segLabels.map((label, i) => (
          <path
            key={label}
            d={SEG_PATHS[label]}
            fill={segments[i] ? '#ef4444' : 'rgba(239, 68, 68, 0.1)'}
            style={{ transition: 'fill 0.15s ease' }}
          />
        ))}
        {/* Decimal point */}
        <circle
          cx={21}
          cy={29}
          r={1.5}
          fill={decimalPoint ? '#ef4444' : 'rgba(239, 68, 68, 0.1)'}
          style={{ transition: 'fill 0.15s ease' }}
        />
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main overlay component
// ---------------------------------------------------------------------------

/**
 * Renders a single component's visual simulation overlay.
 * Positioned absolutely by the parent container.
 */
const ComponentVisualOverlay = memo(function ComponentVisualOverlay({
  instanceId,
  componentType,
  visualProps,
  x,
  y,
  width,
  height,
}: ComponentVisualOverlayProps) {
  const cssStyle: CSSProperties = {
    ...getVisualCSS(visualProps),
    position: 'absolute',
    left: x,
    top: y,
    width,
    height,
  };

  const className = getComponentVisualClass(visualProps);

  return (
    <div
      className={cn(className, 'pointer-events-none')}
      style={cssStyle}
      data-testid={`sim-vis-overlay-${instanceId}`}
      data-component-type={componentType}
    >
      {renderVisualContent(visualProps, width, height)}
    </div>
  );
});

function renderVisualContent(
  visualProps: ComponentVisualProps,
  width: number,
  height: number,
): React.ReactNode {
  switch (visualProps.type) {
    case 'led':
      return <LEDOverlay visualProps={visualProps} width={width} height={height} />;
    case 'resistor':
      return <ResistorHeatOverlay visualProps={visualProps} width={width} height={height} />;
    case 'motor':
      return <MotorOverlay visualProps={visualProps} width={width} height={height} />;
    case 'servo':
      return <ServoOverlay visualProps={visualProps} width={width} height={height} />;
    case 'relay':
      return <RelayOverlay visualProps={visualProps} width={width} height={height} />;
    case 'switch':
      return <SwitchOverlay visualProps={visualProps} width={width} />;
    case 'buzzer':
      return <BuzzerOverlay visualProps={visualProps} width={width} height={height} />;
    case 'potentiometer':
      return <PotentiometerOverlay visualProps={visualProps} width={width} height={height} />;
    case 'seven_segment':
      return <SevenSegmentOverlay visualProps={visualProps} width={width} height={height} />;
    case 'generic':
      return null;
  }
}

export default ComponentVisualOverlay;
