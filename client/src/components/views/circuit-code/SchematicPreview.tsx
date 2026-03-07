import { useCallback, useRef, useState } from 'react';
import type { SchematicLayout, ComponentLayout, NetPath, NetSegment, PinLayout } from '@/lib/circuit-dsl/ir-to-schematic';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NET_COLORS: Record<NetPath['type'], string> = {
  power: '#ef4444',
  ground: '#22c55e',
  signal: '#00F0FF',
};

const COMPONENT_FILL = '#1a1a2e';
const COMPONENT_STROKE = '#00F0FF';
const PIN_RADIUS = 3;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;

// ---------------------------------------------------------------------------
// SchematicPreview
// ---------------------------------------------------------------------------

interface SchematicPreviewProps {
  layout: SchematicLayout | null;
  isEvaluating?: boolean;
}

export function SchematicPreview({ layout, isEvaluating }: SchematicPreviewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number; vbX: number; vbY: number } | null>(null);

  const getViewBox = useCallback((): { x: number; y: number; w: number; h: number } => {
    if (viewBox) {
      return viewBox;
    }
    if (layout && layout.width > 0 && layout.height > 0) {
      return { x: 0, y: 0, w: layout.width, h: layout.height };
    }
    return { x: 0, y: 0, w: 400, h: 300 };
  }, [viewBox, layout]);

  const handleWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      e.preventDefault();
      const vb = getViewBox();
      const factor = e.deltaY > 0 ? 1.1 : 0.9;
      const newW = Math.min(Math.max(vb.w * factor, (layout?.width ?? 400) * MIN_ZOOM), (layout?.width ?? 400) * MAX_ZOOM);
      const newH = Math.min(Math.max(vb.h * factor, (layout?.height ?? 300) * MIN_ZOOM), (layout?.height ?? 300) * MAX_ZOOM);
      const dx = (vb.w - newW) / 2;
      const dy = (vb.h - newH) / 2;
      setViewBox({ x: vb.x + dx, y: vb.y + dy, w: newW, h: newH });
    },
    [getViewBox, layout],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (e.button !== 0) {
        return;
      }
      setIsPanning(true);
      const vb = getViewBox();
      panStart.current = { x: e.clientX, y: e.clientY, vbX: vb.x, vbY: vb.y };
    },
    [getViewBox],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!isPanning || !panStart.current || !svgRef.current) {
        return;
      }
      const vb = getViewBox();
      const rect = svgRef.current.getBoundingClientRect();
      const scaleX = vb.w / rect.width;
      const scaleY = vb.h / rect.height;
      const dx = (e.clientX - panStart.current.x) * scaleX;
      const dy = (e.clientY - panStart.current.y) * scaleY;
      setViewBox({ x: panStart.current.vbX - dx, y: panStart.current.vbY - dy, w: vb.w, h: vb.h });
    },
    [isPanning, getViewBox],
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    panStart.current = null;
  }, []);

  const vb = getViewBox();
  const viewBoxStr = `${String(vb.x)} ${String(vb.y)} ${String(vb.w)} ${String(vb.h)}`;

  const isEmpty = !layout || layout.components.length === 0;

  return (
    <div
      data-testid="schematic-preview"
      className="relative h-full w-full overflow-hidden bg-[#0a0a1a]"
    >
      {isEmpty && !isEvaluating && (
        <div className="absolute inset-0 flex items-center justify-center text-zinc-500">
          No components
        </div>
      )}

      {isEvaluating && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="animate-pulse text-cyan-400">Evaluating...</span>
        </div>
      )}

      {!isEmpty && !isEvaluating && (
        <svg
          ref={svgRef}
          data-testid="schematic-svg"
          className="h-full w-full"
          viewBox={viewBoxStr}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
        >
          {/* Net paths */}
          {layout.nets.map((net) => (
            <g key={net.netId} data-testid={`net-${net.netId}`}>
              {net.segments.map((seg, si) => (
                <line
                  key={si}
                  x1={seg.x1}
                  y1={seg.y1}
                  x2={seg.x2}
                  y2={seg.y2}
                  stroke={NET_COLORS[net.type]}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                />
              ))}
            </g>
          ))}

          {/* Components */}
          {layout.components.map((comp) => (
            <g key={comp.id} data-testid={`component-${comp.refdes}`}>
              {/* Component body */}
              <rect
                x={comp.x}
                y={comp.y}
                width={comp.width}
                height={comp.height}
                rx={4}
                ry={4}
                fill={COMPONENT_FILL}
                stroke={COMPONENT_STROKE}
                strokeWidth={1.5}
              />

              {/* Refdes label above */}
              <text
                x={comp.x + comp.width / 2}
                y={comp.y - 8}
                textAnchor="middle"
                fill="#e2e8f0"
                fontSize={11}
                fontFamily="monospace"
              >
                {comp.refdes}
              </text>

              {/* Value label below */}
              {comp.value && (
                <text
                  x={comp.x + comp.width / 2}
                  y={comp.y + comp.height + 16}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize={10}
                  fontFamily="monospace"
                >
                  {comp.value}
                </text>
              )}

              {/* Pins */}
              {comp.pins.map((pin) => (
                <g key={pin.name} data-testid={`pin-${comp.refdes}-${pin.name}`}>
                  <circle
                    cx={pin.x}
                    cy={pin.y}
                    r={PIN_RADIUS}
                    fill={COMPONENT_STROKE}
                  />
                  <text
                    x={pin.x < comp.x + comp.width / 2 ? pin.x + 6 : pin.x - 6}
                    y={pin.y + 3}
                    textAnchor={pin.x < comp.x + comp.width / 2 ? 'start' : 'end'}
                    fill="#94a3b8"
                    fontSize={8}
                    fontFamily="monospace"
                  >
                    {pin.name}
                  </text>
                </g>
              ))}

              {/* Power/Ground markers */}
              {comp.pins
                .filter((pin) => {
                  const netInfo = layout.nets.find((n) => n.netId === pin.netId);
                  return netInfo?.type === 'power' || netInfo?.type === 'ground';
                })
                .map((pin) => {
                  const netInfo = layout.nets.find((n) => n.netId === pin.netId);
                  if (!netInfo) {
                    return null;
                  }
                  if (netInfo.type === 'power') {
                    // Upward arrow marker
                    return (
                      <polygon
                        key={`power-${pin.name}`}
                        points={`${String(pin.x)},${String(pin.y - 12)} ${String(pin.x - 4)},${String(pin.y - 6)} ${String(pin.x + 4)},${String(pin.y - 6)}`}
                        fill="#ef4444"
                      />
                    );
                  }
                  // Ground bars marker
                  return (
                    <g key={`gnd-${pin.name}`}>
                      <line x1={pin.x - 6} y1={pin.y + 6} x2={pin.x + 6} y2={pin.y + 6} stroke="#22c55e" strokeWidth={1.5} />
                      <line x1={pin.x - 4} y1={pin.y + 9} x2={pin.x + 4} y2={pin.y + 9} stroke="#22c55e" strokeWidth={1.5} />
                      <line x1={pin.x - 2} y1={pin.y + 12} x2={pin.x + 2} y2={pin.y + 12} stroke="#22c55e" strokeWidth={1.5} />
                    </g>
                  );
                })}
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}
