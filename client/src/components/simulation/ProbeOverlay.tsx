import { useState, useCallback, useRef, memo } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VoltageProbe {
  id: string;
  netName: string;
  x: number;
  y: number;
  color: string;
  value?: number;
  unit?: string;
  waveformTraceId?: string;
}

export interface CurrentProbe {
  id: string;
  componentRefDes: string;
  x: number;
  y: number;
  color: string;
  value?: number;
  unit?: string;
  waveformTraceId?: string;
}

export interface ProbeOverlayProps {
  voltageProbes: VoltageProbe[];
  currentProbes: CurrentProbe[];
  onAddVoltageProbe?: (netName: string, x: number, y: number) => void;
  onAddCurrentProbe?: (refDes: string, x: number, y: number) => void;
  onRemoveProbe?: (probeId: string) => void;
  onMoveProbe?: (probeId: string, x: number, y: number) => void;
  /** Circuit instances for hit-testing probe placement targets */
  circuitInstances?: Array<{ id: number; referenceDesignator: string; schematicX: number; schematicY: number }>;
  /** Circuit nets for hit-testing voltage probe targets */
  circuitNets?: Array<{ id: number; name: string }>;
  mode: 'view' | 'place-voltage' | 'place-current';
  showValues?: boolean;
  scale?: number;
}

// ---------------------------------------------------------------------------
// SI prefix formatter
// ---------------------------------------------------------------------------

const SI_PREFIXES: Array<{ threshold: number; symbol: string; divisor: number }> = [
  { threshold: 1e12, symbol: 'T', divisor: 1e12 },
  { threshold: 1e9,  symbol: 'G', divisor: 1e9 },
  { threshold: 1e6,  symbol: 'M', divisor: 1e6 },
  { threshold: 1e3,  symbol: 'k', divisor: 1e3 },
  { threshold: 1,    symbol: '',  divisor: 1 },
  { threshold: 1e-3, symbol: 'm', divisor: 1e-3 },
  { threshold: 1e-6, symbol: '\u03BC', divisor: 1e-6 },  // μ
  { threshold: 1e-9, symbol: 'n', divisor: 1e-9 },
  { threshold: 1e-12, symbol: 'p', divisor: 1e-12 },
];

function formatSI(value: number, unit: string): string {
  if (value === 0) return `0${unit}`;

  const absVal = Math.abs(value);

  for (let i = 0; i < SI_PREFIXES.length; i++) {
    const prefix = SI_PREFIXES[i];
    if (absVal >= prefix.threshold) {
      const scaled = value / prefix.divisor;
      // Use up to 3 significant digits
      const formatted = parseFloat(scaled.toPrecision(3)).toString();
      return `${formatted}${prefix.symbol}${unit}`;
    }
  }

  // Sub-pico: use scientific notation
  return `${value.toExponential(2)}${unit}`;
}

// ---------------------------------------------------------------------------
// Probe geometry constants (in SVG user units)
// ---------------------------------------------------------------------------

const PROBE_SIZE = 12;
const LABEL_FONT_SIZE = 10;
const VALUE_FONT_SIZE = 9;
const LABEL_OFFSET_Y = PROBE_SIZE + 4;
const VALUE_OFFSET_Y = LABEL_OFFSET_Y + VALUE_FONT_SIZE + 2;
const GLOW_FILTER_ID = 'probe-glow';
const HOVER_GLOW_FILTER_ID = 'probe-hover-glow';

// ---------------------------------------------------------------------------
// Voltage probe marker: downward-pointing triangle
// ---------------------------------------------------------------------------

function voltageProbePoints(size: number): string {
  const half = size / 2;
  // Triangle: top-left, top-right, bottom-center
  return `${-half},${-half} ${half},${-half} 0,${half}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface VoltageProbeMarkerProps {
  probe: VoltageProbe;
  showValue: boolean;
  scaleFactor: number;
  onRemove?: (id: string) => void;
  onDragStart: (id: string, startX: number, startY: number) => void;
}

const VoltageProbeMarker = memo(function VoltageProbeMarker({
  probe,
  showValue,
  scaleFactor,
  onRemove,
  onDragStart,
}: VoltageProbeMarkerProps) {
  const [hovered, setHovered] = useState(false);
  const fontSize = LABEL_FONT_SIZE / scaleFactor;
  const valueFontSize = VALUE_FONT_SIZE / scaleFactor;
  const probeSize = PROBE_SIZE / scaleFactor;
  const labelOffsetY = (LABEL_OFFSET_Y) / scaleFactor;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 0) {
        e.stopPropagation();
        onDragStart(probe.id, e.clientX, e.clientY);
      }
    },
    [probe.id, onDragStart],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onRemove?.(probe.id);
    },
    [probe.id, onRemove],
  );

  const trianglePoints = voltageProbePoints(probeSize);

  return (
    <g
      data-testid={`voltage-probe-${probe.id}`}
      transform={`translate(${probe.x}, ${probe.y})`}
      pointerEvents="all"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      style={{ cursor: 'grab' }}
    >
      {/* Probe triangle */}
      <polygon
        points={trianglePoints}
        fill={probe.color}
        stroke={hovered ? '#fff' : 'rgba(0,0,0,0.4)'}
        strokeWidth={1.2 / scaleFactor}
        filter={hovered ? `url(#${HOVER_GLOW_FILTER_ID})` : undefined}
      />

      {/* Net name label */}
      <text
        x={0}
        y={labelOffsetY}
        textAnchor="middle"
        fill={probe.color}
        fontSize={fontSize}
        fontFamily="monospace"
        fontWeight={600}
        pointerEvents="none"
      >
        {probe.netName}
      </text>

      {/* Value label */}
      {showValue && probe.value !== undefined && (
        <text
          data-testid={`probe-value-${probe.id}`}
          x={probeSize * 0.8}
          y={-probeSize * 0.15}
          textAnchor="start"
          fill="#fff"
          fontSize={valueFontSize}
          fontFamily="monospace"
          fontWeight={500}
          pointerEvents="none"
        >
          <tspan
            dx={2 / scaleFactor}
            dy={0}
            fill={probe.color}
          >
            {formatSI(probe.value, probe.unit ?? 'V')}
          </tspan>
        </text>
      )}
    </g>
  );
});

interface CurrentProbeMarkerProps {
  probe: CurrentProbe;
  showValue: boolean;
  scaleFactor: number;
  onRemove?: (id: string) => void;
  onDragStart: (id: string, startX: number, startY: number) => void;
}

const CurrentProbeMarker = memo(function CurrentProbeMarker({
  probe,
  showValue,
  scaleFactor,
  onRemove,
  onDragStart,
}: CurrentProbeMarkerProps) {
  const [hovered, setHovered] = useState(false);
  const fontSize = LABEL_FONT_SIZE / scaleFactor;
  const valueFontSize = VALUE_FONT_SIZE / scaleFactor;
  const probeSize = PROBE_SIZE / scaleFactor;
  const labelOffsetY = LABEL_OFFSET_Y / scaleFactor;
  const r = probeSize / 2;
  const strokeW = 1.5 / scaleFactor;
  const arrowLen = probeSize * 0.7;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 0) {
        e.stopPropagation();
        onDragStart(probe.id, e.clientX, e.clientY);
      }
    },
    [probe.id, onDragStart],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onRemove?.(probe.id);
    },
    [probe.id, onRemove],
  );

  return (
    <g
      data-testid={`current-probe-${probe.id}`}
      transform={`translate(${probe.x}, ${probe.y})`}
      pointerEvents="all"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      style={{ cursor: 'grab' }}
    >
      {/* Circle (ammeter body) */}
      <circle
        cx={0}
        cy={0}
        r={r}
        fill={probe.color}
        fillOpacity={0.2}
        stroke={hovered ? '#fff' : probe.color}
        strokeWidth={strokeW}
        filter={hovered ? `url(#${HOVER_GLOW_FILTER_ID})` : undefined}
      />

      {/* Arrow through circle (left to right) */}
      <line
        x1={-arrowLen / 2}
        y1={0}
        x2={arrowLen / 2}
        y2={0}
        stroke={probe.color}
        strokeWidth={strokeW}
        pointerEvents="none"
      />
      {/* Arrowhead */}
      <polygon
        points={`${arrowLen / 2},0 ${arrowLen / 2 - 3 / scaleFactor},${-2.5 / scaleFactor} ${arrowLen / 2 - 3 / scaleFactor},${2.5 / scaleFactor}`}
        fill={probe.color}
        pointerEvents="none"
      />

      {/* Component ref des label */}
      <text
        x={0}
        y={labelOffsetY}
        textAnchor="middle"
        fill={probe.color}
        fontSize={fontSize}
        fontFamily="monospace"
        fontWeight={600}
        pointerEvents="none"
      >
        {probe.componentRefDes}
      </text>

      {/* Value label */}
      {showValue && probe.value !== undefined && (
        <text
          data-testid={`probe-value-${probe.id}`}
          x={r + 2 / scaleFactor}
          y={-r * 0.2}
          textAnchor="start"
          fill="#fff"
          fontSize={valueFontSize}
          fontFamily="monospace"
          fontWeight={500}
          pointerEvents="none"
        >
          <tspan
            dx={2 / scaleFactor}
            dy={0}
            fill={probe.color}
          >
            {formatSI(probe.value, probe.unit ?? 'A')}
          </tspan>
        </text>
      )}
    </g>
  );
});

// ---------------------------------------------------------------------------
// Ghost probe (follows mouse in placement mode)
// ---------------------------------------------------------------------------

interface GhostProbeProps {
  type: 'voltage' | 'current';
  x: number;
  y: number;
  scaleFactor: number;
}

function GhostProbe({ type, x, y, scaleFactor }: GhostProbeProps) {
  const probeSize = PROBE_SIZE / scaleFactor;

  if (type === 'voltage') {
    return (
      <g transform={`translate(${x}, ${y})`} pointerEvents="none" opacity={0.5}>
        <polygon
          points={voltageProbePoints(probeSize)}
          fill="#00F0FF"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth={1 / scaleFactor}
        />
      </g>
    );
  }

  const r = probeSize / 2;
  const strokeW = 1.5 / scaleFactor;
  const arrowLen = probeSize * 0.7;

  return (
    <g transform={`translate(${x}, ${y})`} pointerEvents="none" opacity={0.5}>
      <circle
        cx={0}
        cy={0}
        r={r}
        fill="rgba(0, 240, 255, 0.2)"
        stroke="#00F0FF"
        strokeWidth={strokeW}
      />
      <line
        x1={-arrowLen / 2}
        y1={0}
        x2={arrowLen / 2}
        y2={0}
        stroke="#00F0FF"
        strokeWidth={strokeW}
      />
      <polygon
        points={`${arrowLen / 2},0 ${arrowLen / 2 - 3 / scaleFactor},${-2.5 / scaleFactor} ${arrowLen / 2 - 3 / scaleFactor},${2.5 / scaleFactor}`}
        fill="#00F0FF"
      />
    </g>
  );
}

// ---------------------------------------------------------------------------
// SVG filter definitions
// ---------------------------------------------------------------------------

function ProbeFilters() {
  return (
    <defs>
      {/* Subtle ambient glow for probes */}
      <filter id={GLOW_FILTER_ID} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      {/* Stronger glow on hover */}
      <filter id={HOVER_GLOW_FILTER_ID} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
        <feColorMatrix
          in="blur"
          type="matrix"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1.5 0"
          result="brightBlur"
        />
        <feMerge>
          <feMergeNode in="brightBlur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const ProbeOverlay = memo(function ProbeOverlay({
  voltageProbes,
  currentProbes,
  onAddVoltageProbe,
  onAddCurrentProbe,
  onRemoveProbe,
  onMoveProbe,
  circuitInstances,
  circuitNets,
  mode,
  showValues = true,
  scale = 1,
}: ProbeOverlayProps) {
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);
  const [dragState, setDragState] = useState<{
    probeId: string;
    startClientX: number;
    startClientY: number;
    startProbeX: number;
    startProbeY: number;
  } | null>(null);

  const overlayRef = useRef<SVGGElement>(null);

  // Scale factor: invert so that visuals remain a consistent screen size
  const scaleFactor = scale;

  // -----------------------------------------------------------------------
  // Coordinate conversion: client screen coords -> SVG user coords
  // -----------------------------------------------------------------------

  const clientToSVG = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const g = overlayRef.current;
      if (!g) return null;
      const svg = g.ownerSVGElement;
      if (!svg) return null;
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const ctm = g.getScreenCTM();
      if (!ctm) return null;
      const svgPt = pt.matrixTransform(ctm.inverse());
      return { x: svgPt.x, y: svgPt.y };
    },
    [],
  );

  // -----------------------------------------------------------------------
  // Placement mode: track mouse for ghost probe
  // -----------------------------------------------------------------------

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (mode === 'place-voltage' || mode === 'place-current') {
        const pos = clientToSVG(e.clientX, e.clientY);
        if (pos) setGhostPos(pos);
      }
    },
    [mode, clientToSVG],
  );

  const handleMouseLeave = useCallback(() => {
    setGhostPos(null);
  }, []);

  // -----------------------------------------------------------------------
  // Placement mode: click to place probe
  // -----------------------------------------------------------------------

  // Find the nearest circuit instance to a given SVG position (within a threshold)
  const findNearestInstance = useCallback(
    (x: number, y: number): string => {
      if (!circuitInstances || circuitInstances.length === 0) { return ''; }
      const HIT_RADIUS = 40 / scale; // 40px screen-space hit radius
      let closest = '';
      let minDist = HIT_RADIUS;
      for (const inst of circuitInstances) {
        const dx = inst.schematicX - x;
        const dy = inst.schematicY - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
          minDist = dist;
          closest = inst.referenceDesignator;
        }
      }
      return closest;
    },
    [circuitInstances, scale],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (mode === 'place-voltage' && onAddVoltageProbe) {
        const pos = clientToSVG(e.clientX, e.clientY);
        if (pos) {
          // Resolve net name from nearest instance or use first available net
          const nearestRef = findNearestInstance(pos.x, pos.y);
          const netName = nearestRef
            ? nearestRef
            : (circuitNets && circuitNets.length > 0 ? circuitNets[0].name : `net_${Math.floor(pos.x)}_${Math.floor(pos.y)}`);
          onAddVoltageProbe(netName, pos.x, pos.y);
        }
      } else if (mode === 'place-current' && onAddCurrentProbe) {
        const pos = clientToSVG(e.clientX, e.clientY);
        if (pos) {
          // Resolve refDes from nearest circuit instance
          const refDes = findNearestInstance(pos.x, pos.y);
          onAddCurrentProbe(refDes || `probe_${Math.floor(pos.x)}_${Math.floor(pos.y)}`, pos.x, pos.y);
        }
      }
    },
    [mode, clientToSVG, onAddVoltageProbe, onAddCurrentProbe, findNearestInstance, circuitNets],
  );

  // -----------------------------------------------------------------------
  // Drag probes to reposition
  // -----------------------------------------------------------------------

  const handleDragStart = useCallback(
    (probeId: string, startClientX: number, startClientY: number) => {
      // Find the probe's current position
      const vp = voltageProbes.find((p) => p.id === probeId);
      const cp = currentProbes.find((p) => p.id === probeId);
      const probe = vp ?? cp;
      if (!probe) return;

      setDragState({
        probeId,
        startClientX,
        startClientY,
        startProbeX: probe.x,
        startProbeY: probe.y,
      });

      const handleDragMove = (ev: MouseEvent) => {
        // We need the current dragState, but since this is a closure we
        // captured it above — compute delta from the initial values.
        const dx = (ev.clientX - startClientX) / scale;
        const dy = (ev.clientY - startClientY) / scale;

        // Directly update the SVG transform for smooth visual feedback.
        // The probe array is immutable from our perspective, so we move
        // the entire probe's <g> element via a CSS transform override.
        const el = overlayRef.current?.querySelector(
          `[data-testid="voltage-probe-${probeId}"], [data-testid="current-probe-${probeId}"]`,
        );
        if (el) {
          const newX = (vp ?? cp)!.x + dx;
          const newY = (vp ?? cp)!.y + dy;
          el.setAttribute('transform', `translate(${newX}, ${newY})`);
        }
      };

      const handleDragEnd = (ev: MouseEvent) => {
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
        setDragState(null);

        const dx = (ev.clientX - startClientX) / scale;
        const dy = (ev.clientY - startClientY) / scale;

        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) {
          // Clicked without meaningful drag — reset transform
          const el = overlayRef.current?.querySelector(
            `[data-testid="voltage-probe-${probeId}"], [data-testid="current-probe-${probeId}"]`,
          );
          if (el && probe) {
            el.setAttribute('transform', `translate(${probe.x}, ${probe.y})`);
          }
          return;
        }

        const newX = probe.x + dx;
        const newY = probe.y + dy;

        if (onMoveProbe) {
          // Report the new position to the parent
          onMoveProbe(probeId, newX, newY);
        } else {
          // No move handler: reset to original position
          const el = overlayRef.current?.querySelector(
            `[data-testid="voltage-probe-${probeId}"], [data-testid="current-probe-${probeId}"]`,
          );
          if (el && probe) {
            el.setAttribute('transform', `translate(${probe.x}, ${probe.y})`);
          }
        }
      };

      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
    },
    [voltageProbes, currentProbes, scale, onMoveProbe],
  );

  // -----------------------------------------------------------------------
  // Cursor style based on mode
  // -----------------------------------------------------------------------

  const cursorStyle: React.CSSProperties =
    mode === 'place-voltage' || mode === 'place-current'
      ? { cursor: 'crosshair' }
      : {};

  // -----------------------------------------------------------------------
  // Determine if we're in a placement mode (affects hit-area overlay)
  // -----------------------------------------------------------------------

  const isPlacing = mode === 'place-voltage' || mode === 'place-current';

  return (
    <g
      ref={overlayRef}
      data-testid="probe-overlay"
      style={cursorStyle}
      onMouseMove={isPlacing ? handleMouseMove : undefined}
      onMouseLeave={isPlacing ? handleMouseLeave : undefined}
      onClick={isPlacing ? handleClick : undefined}
    >
      <ProbeFilters />

      {/* Transparent hit area in placement modes so mouse events are captured
          even over empty space. */}
      {isPlacing && (
        <rect
          x={-1e6}
          y={-1e6}
          width={2e6}
          height={2e6}
          fill="transparent"
          pointerEvents="all"
        />
      )}

      {/* Voltage probes */}
      <g data-testid="voltage-probes-group">
        {voltageProbes.map((probe) => (
          <VoltageProbeMarker
            key={probe.id}
            probe={probe}
            showValue={showValues}
            scaleFactor={scaleFactor}
            onRemove={onRemoveProbe}
            onDragStart={handleDragStart}
          />
        ))}
      </g>

      {/* Current probes */}
      <g data-testid="current-probes-group">
        {currentProbes.map((probe) => (
          <CurrentProbeMarker
            key={probe.id}
            probe={probe}
            showValue={showValues}
            scaleFactor={scaleFactor}
            onRemove={onRemoveProbe}
            onDragStart={handleDragStart}
          />
        ))}
      </g>

      {/* Probe tool state label (UX-035) */}
      {isPlacing && (
        <text
          data-testid="probe-tool-label"
          x={20 / scaleFactor}
          y={20 / scaleFactor}
          fill="#00F0FF"
          fontSize={12 / scaleFactor}
          fontFamily="monospace"
          fontWeight={600}
          opacity={0.8}
          pointerEvents="none"
        >
          {mode === 'place-voltage' ? 'Placing Voltage Probe — click to place' : 'Placing Current Probe — click to place'}
        </text>
      )}

      {/* Ghost probe in placement mode */}
      {isPlacing && ghostPos && (
        <GhostProbe
          type={mode === 'place-voltage' ? 'voltage' : 'current'}
          x={ghostPos.x}
          y={ghostPos.y}
          scaleFactor={scaleFactor}
        />
      )}
    </g>
  );
});

export default ProbeOverlay;
