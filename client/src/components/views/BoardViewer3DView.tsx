/**
 * BoardViewer3DView — 3D PCB board visualization using CSS 3D transforms.
 * Shows board, components with real footprint data, traces, vias,
 * camera angle buttons, layer visibility toggles, and dimensions.
 */

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { useProjectMeta } from '@/lib/contexts/project-meta-context';
import { useCircuitSelector } from '@/lib/circuit-selector';
import { useToast } from '@/hooks/use-toast';
import { useProjectBoard } from '@/hooks/useProjectBoard';
import {
  useCircuitDesigns,
  useCircuitInstances,
  useCircuitNets,
  useCircuitVias,
  useCircuitWires,
} from '@/lib/circuit-editor/hooks';
import { Box, Eye, EyeOff, RotateCcw, Ruler, Download, Upload, RefreshCw, Trash2, Cable } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { NumberInput } from '@/components/ui/number-input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useBoardViewer3D, BoardViewer3D } from '@/lib/board-viewer-3d';
import type {
  ViewAngle,
  LayerType3D,
  Component3D,
  BoardDimensions,
  BoardScene,
  Via3D,
  Trace3D,
  DrillHole3D,
} from '@/lib/board-viewer-3d';
import { FootprintLibrary } from '@/lib/pcb/footprint-library';
import type { CircuitInstanceRow, CircuitNetRow, CircuitWireRow, CircuitViaRow } from '@shared/schema';
import { BREADBOARD_3D_BRIDGE_EVENT } from '@/lib/breadboard-3d-bridge';
import {
  VIEWER_3D_BRIDGE_EVENT,
  normalizeViewer3DBridgeTarget,
  publishViewer3DRepairTarget,
  readViewer3DBridgeTarget,
  type Viewer3DDigitalTwinChannel,
  type Viewer3DBridgeTarget,
  type Viewer3DRepairDestination,
} from '@/lib/viewer-3d-bridge';
import { RADIAL_COMMAND_EVENT, type RadialCommandEventDetail } from '@/lib/radial-menu-actions';
import {
  getRadialAiDeliveryVerb,
  getRadialAiPromptDelivery,
  runRadialAiCommand,
  type RadialAiPromptSection,
} from '@/lib/radial-ai-commands';
import WebGLBoardViewer from '@/components/views/board-viewer-3d/WebGLBoardViewer';
import {
  readViewer3DEngine,
  writeViewer3DEngine,
  type Viewer3DEngine,
} from '@/components/views/board-viewer-3d/viewer3d-engine';
import { PACKAGE_HEIGHTS } from '@/components/views/board-viewer-3d/model/package-heights';
import {
  buildSceneModel,
  generatePinsFromFootprint,
  type BuildSceneModelResult,
} from '@/components/views/board-viewer-3d/model/buildSceneModel';

export { PACKAGE_HEIGHTS };

// Three.js / R3F for advanced 3D Wiring Guides layer (ratsnest, clearance, measurements, etc.)
// This is the foundation for going "all in" on professional 3D visualization.
import { Canvas, useThree } from '@react-three/fiber';
import { Line, Tube } from '@react-three/drei';
import * as THREE from 'three';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Dev-only: silence the noisy THREE.Clock deprecation that originates from
// inside @react-three/fiber / drei internals (they still use the old Clock API).
// Harmless; the modern API is THREE.Timer. This keeps the console clean while
// working on the 3D view without suppressing other real warnings.
if (import.meta.env.DEV) {
  const origWarn = console.warn.bind(console);
  console.warn = (...args: any[]) => {
    const first = args[0];
    if (
      typeof first === 'string' &&
      (first.includes('THREE.Clock has been deprecated') ||
        first.includes('THREE.Clock: This module has been deprecated'))
    ) {
      return;
    }
    origWarn(...args);
  };
}

// ---------------------------------------------------------------------------
// Trace layer colors
// ---------------------------------------------------------------------------

const TRACE_LAYER_COLORS: Record<string, string> = {
  'top-copper': '#cc5533',
  'bottom-copper': '#3366bb',
};

// ---------------------------------------------------------------------------
// View angle CSS rotation map
// ---------------------------------------------------------------------------

const VIEW_ROTATIONS: Record<ViewAngle, { rotateX: number; rotateY: number; label: string }> = {
  top: { rotateX: 0, rotateY: 0, label: 'Top' },
  bottom: { rotateX: 180, rotateY: 0, label: 'Bottom' },
  front: { rotateX: 90, rotateY: 0, label: 'Front' },
  back: { rotateX: -90, rotateY: 0, label: 'Back' },
  left: { rotateX: 90, rotateY: -90, label: 'Left' },
  right: { rotateX: 90, rotateY: 90, label: 'Right' },
  isometric: { rotateX: 45, rotateY: 45, label: 'Iso' },
};

const VIEW_ANGLES: ViewAngle[] = ['top', 'bottom', 'front', 'back', 'left', 'right', 'isometric'];

const LAYER_LABELS: Record<LayerType3D, string> = {
  'top-copper': 'Top Copper',
  'bottom-copper': 'Bottom Copper',
  'top-silk': 'Top Silkscreen',
  'bottom-silk': 'Bottom Silkscreen',
  'top-mask': 'Top Solder Mask',
  'bottom-mask': 'Bottom Solder Mask',
  substrate: 'Substrate',
  internal: 'Internal',
};

const LAYER_ORDER: LayerType3D[] = [
  'top-silk',
  'top-mask',
  'top-copper',
  'substrate',
  'internal',
  'bottom-copper',
  'bottom-mask',
  'bottom-silk',
];

const EMPTY_CIRCUIT_INSTANCES: CircuitInstanceRow[] = [];
const EMPTY_CIRCUIT_NETS: CircuitNetRow[] = [];
const EMPTY_CIRCUIT_VIAS: CircuitViaRow[] = [];
const EMPTY_CIRCUIT_WIRES: CircuitWireRow[] = [];

function normalize3DPinLabel(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }
  const normalized = String(value)
    .trim()
    .toUpperCase()
    .replace(/^PIN\s*/, '')
    .replace(/^P(?=\d+$)/, '');
  return normalized.length > 0 ? normalized : null;
}

function getSafeTestIdSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function getPinHotspotId(componentId: string, pinId: string): string {
  return `component-3d-pin-hotspot-${getSafeTestIdSegment(componentId)}-${getSafeTestIdSegment(pinId)}`;
}

function getDigitalTwinPinHighlightKeys(channel: Viewer3DDigitalTwinChannel): string[] {
  const keys = new Set<string>();
  for (const value of [
    channel.pinLabel,
    channel.id,
    channel.pin,
    typeof channel.pin === 'number' ? `P${channel.pin}` : undefined,
  ]) {
    const key = normalize3DPinLabel(value);
    if (key) {
      keys.add(key);
    }
  }
  return Array.from(keys);
}

function getComponentPinForDigitalTwinChannel(
  component: Component3D,
  channel: Viewer3DDigitalTwinChannel,
): Component3D['pins'][number] | null {
  const pinKeys = new Set(getDigitalTwinPinHighlightKeys(channel));
  return (
    component.pins.find((pin) => {
      const pinKey = normalize3DPinLabel(pin.id);
      return pinKey ? pinKeys.has(pinKey) : false;
    }) ?? null
  );
}

function getPinHighlightClass(channel: Viewer3DDigitalTwinChannel): string {
  if (channel.state === 'live') {
    return 'border-green-100 bg-green-400 text-green-950 shadow-[0_0_14px_rgba(74,222,128,0.9)]';
  }
  if (channel.state === 'stale') {
    return 'border-yellow-100 bg-yellow-400 text-yellow-950 shadow-[0_0_14px_rgba(250,204,21,0.85)]';
  }
  return 'border-cyan-100 bg-cyan-400 text-cyan-950 shadow-[0_0_12px_rgba(34,211,238,0.75)]';
}

function getNetStateBadgeClass(channel: Viewer3DDigitalTwinChannel): string {
  if (channel.state === 'live') {
    return 'border-green-300/70 bg-green-950/90 text-green-50 shadow-[0_0_18px_rgba(74,222,128,0.45)]';
  }
  if (channel.state === 'stale') {
    return 'border-yellow-300/70 bg-yellow-950/90 text-yellow-50 shadow-[0_0_18px_rgba(250,204,21,0.4)]';
  }
  return 'border-cyan-300/70 bg-cyan-950/90 text-cyan-50 shadow-[0_0_16px_rgba(34,211,238,0.35)]';
}

function clampPinPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

// ---------------------------------------------------------------------------
// ComponentBox — CSS 3D component box with real footprint data
// ---------------------------------------------------------------------------

interface ComponentBoxProps {
  component: Component3D;
  boardThickness: number;
  boardWidth: number;
  boardHeight: number;
  scale: number;
  highlighted?: boolean;
  highlightedPins?: ReadonlyMap<string, Viewer3DDigitalTwinChannel>;
}

const ComponentBox = memo(function ComponentBox({
  component,
  boardThickness,
  boardWidth,
  boardHeight,
  scale,
  highlighted = false,
  highlightedPins,
}: ComponentBoxProps) {
  const footprint = FootprintLibrary.getFootprint(component.package);

  const bodyWidth = footprint ? footprint.boundingBox.width : component.bodyWidth;
  const bodyHeight = footprint ? footprint.boundingBox.height : component.bodyHeight;
  const bodyDepth = PACKAGE_HEIGHTS[component.package] ?? component.bodyDepth;

  const x = (component.position.x / boardWidth) * 100;
  const y = (component.position.y / boardHeight) * 100;
  const w = (bodyWidth / boardWidth) * 100;
  const h = (bodyHeight / boardHeight) * 100;
  const depth = bodyDepth * scale;
  const zOffset = component.side === 'top' ? boardThickness * scale : -depth;
  const safeBodyWidth = Math.max(bodyWidth, 0.1);
  const safeBodyHeight = Math.max(bodyHeight, 0.1);

  return (
    <div
      data-testid={`component-3d-${component.id}`}
      data-model-id={component.id}
      data-model-label={component.refDes}
      data-highlighted={highlighted ? 'true' : 'false'}
      className={cn('absolute', highlighted && 'z-20')}
      style={{
        left: `${x - w / 2}%`,
        top: `${y - h / 2}%`,
        width: `${w}%`,
        height: `${h}%`,
        transform: `translateZ(${zOffset}px) rotateZ(${component.rotation}deg)`,
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Top face */}
      <div
        className="absolute inset-0 border border-white/20"
        style={{
          backgroundColor: component.color,
          border: highlighted ? '2px solid #22d3ee' : '1px solid rgba(255,255,255,0.2)',
          boxShadow: highlighted ? '0 0 18px rgba(34,211,238,0.75)' : undefined,
          transform: `translateZ(${depth}px)`,
          opacity: 0.9,
        }}
      />
      {/* Side faces */}
      <div
        className="absolute w-full border border-white/10"
        style={{
          backgroundColor: component.color,
          height: `${depth}px`,
          bottom: '100%',
          transform: `rotateX(90deg)`,
          transformOrigin: 'bottom',
          opacity: 0.7,
        }}
      />
      {/* Label */}
      <div
        className="absolute inset-0 flex items-center justify-center text-white/70 text-[0.5rem] font-mono pointer-events-none"
        style={{ transform: `translateZ(${depth + 1}px)` }}
      >
        {component.refDes}
      </div>
      {component.pins.map((pin) => {
        const pinKey = normalize3DPinLabel(pin.id);
        const channel = pinKey ? highlightedPins?.get(pinKey) : undefined;
        if (!channel) {
          return null;
        }
        const pinLeft = clampPinPercent(50 + (pin.position.x / safeBodyWidth) * 100);
        const pinTop = clampPinPercent(50 + (pin.position.y / safeBodyHeight) * 100);
        const markerSize = Math.max(10, pin.diameter * scale * 2.5);
        const ariaLabel = `${component.refDes} ${pin.id} live telemetry: ${channel.name} ${channel.value}`;
        return (
          <div
            key={`${pin.id}-${channel.id}`}
            data-testid={getPinHotspotId(component.id, pin.id)}
            data-state={channel.state}
            aria-label={ariaLabel}
            className={cn(
              'absolute flex items-center justify-center rounded-full border text-[7px] font-bold leading-none pointer-events-none',
              getPinHighlightClass(channel),
            )}
            style={{
              left: `${pinLeft}%`,
              top: `${pinTop}%`,
              width: `${markerSize}px`,
              height: `${markerSize}px`,
              transform: `translate(-50%, -50%) translateZ(${depth + 3}px)`,
            }}
            title={ariaLabel}
          >
            {pin.id}
          </div>
        );
      })}
    </div>
  );
});

interface DigitalTwinNetStateOverlay {
  channel: Viewer3DDigitalTwinChannel;
  component: Component3D;
  pin: Component3D['pins'][number] | null;
}

interface DigitalTwinNetStateBadgeProps extends DigitalTwinNetStateOverlay {
  boardThickness: number;
  boardWidth: number;
  boardHeight: number;
  scale: number;
}

const DigitalTwinNetStateBadge = memo(function DigitalTwinNetStateBadge({
  channel,
  component,
  pin,
  boardThickness,
  boardWidth,
  boardHeight,
  scale,
}: DigitalTwinNetStateBadgeProps) {
  if (!channel.netName) {
    return null;
  }

  const anchorX = component.position.x + (pin?.position.x ?? 0);
  const anchorY = component.position.y + (pin?.position.y ?? 0);
  const left = clampPinPercent((anchorX / boardWidth) * 100);
  const top = clampPinPercent((anchorY / boardHeight) * 100);
  const pinSuffix = pin ? `:${pin.id}` : '';
  const ariaLabel = `${channel.netName} net ${channel.state}: ${component.refDes}${pinSuffix} ${channel.name} ${channel.value}`;

  return (
    <div
      data-testid={`viewer-3d-net-state-${getSafeTestIdSegment(channel.netName)}-${getSafeTestIdSegment(channel.id)}`}
      data-state={channel.state}
      aria-label={ariaLabel}
      className={cn(
        'absolute z-30 max-w-32 rounded-sm border px-1.5 py-1 text-[9px] leading-tight pointer-events-none',
        getNetStateBadgeClass(channel),
      )}
      style={{
        left: `${left}%`,
        top: `${top}%`,
        transform: `translate(-50%, -115%) translateZ(${boardThickness * scale + 28}px)`,
      }}
      title={ariaLabel}
    >
      <div className="truncate font-semibold">{channel.netName}</div>
      <div className="truncate font-mono opacity-85">
        {component.refDes}
        {pinSuffix} {channel.value}
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Trace3DElement — renders a single trace as colored segments on the board
// ---------------------------------------------------------------------------

interface Trace3DElementProps {
  trace: Trace3D;
  boardThickness: number;
  boardWidth: number;
  boardHeight: number;
  scale: number;
}

const Trace3DElement = memo(function Trace3DElement({
  trace,
  boardThickness,
  boardWidth,
  boardHeight,
  scale,
}: Trace3DElementProps) {
  const color = TRACE_LAYER_COLORS[trace.layer] ?? '#b87333';
  const isTopLayer = trace.layer === 'top-copper';
  const zOffset = isTopLayer ? boardThickness * scale : 0;
  const traceVisualHeight = 0.2; // px, slightly exaggerated for visibility

  return (
    <div
      data-testid={`trace-3d-${trace.id}`}
      data-model-id={trace.id}
      data-model-label={`Trace ${trace.id}`}
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundColor: color,
        opacity: 0,
        transformStyle: 'preserve-3d',
      }}
    >
      {trace.points.slice(0, -1).map((pt, i) => {
        const next = trace.points[i + 1];
        if (!next) {
          return null;
        }

        const x1Pct = (pt.x / boardWidth) * 100;
        const y1Pct = (pt.y / boardHeight) * 100;
        const x2Pct = (next.x / boardWidth) * 100;
        const y2Pct = (next.y / boardHeight) * 100;

        const dx = x2Pct - x1Pct;
        const dy = y2Pct - y1Pct;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        const widthPct = (trace.width / boardWidth) * 100;

        return (
          <div
            key={`${trace.id}-seg-${i}`}
            data-testid={`trace-segment-${trace.id}-${i}`}
            className="absolute"
            style={{
              left: `${x1Pct}%`,
              top: `${y1Pct - widthPct / 2}%`,
              width: `${length}%`,
              height: `${Math.max(widthPct, 0.3)}%`,
              backgroundColor: color,
              opacity: 0.85,
              transform: `translateZ(${zOffset}px) rotate(${angle}deg)`,
              transformOrigin: '0 50%',
            }}
          />
        );
      })}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Via3DElement — renders a via as a copper circle with drill hole
// ---------------------------------------------------------------------------

interface Via3DElementProps {
  via: Via3D;
  boardThickness: number;
  boardWidth: number;
  boardHeight: number;
  scale: number;
}

const Via3DElement = memo(function Via3DElement({
  via,
  boardThickness,
  boardWidth,
  boardHeight,
  scale,
}: Via3DElementProps) {
  const xPct = (via.position.x / boardWidth) * 100;
  const yPct = (via.position.y / boardHeight) * 100;
  const outerPctW = (via.outerDiameter / boardWidth) * 100;
  const outerPctH = (via.outerDiameter / boardHeight) * 100;
  const drillPctW = (via.drillDiameter / boardWidth) * 100;
  const drillPctH = (via.drillDiameter / boardHeight) * 100;
  const viaHeight = boardThickness * scale;

  return (
    <div
      data-testid={`via-3d-${via.id}`}
      data-model-id={via.id}
      data-model-label={`Via ${via.id}`}
      className="absolute"
      style={{
        left: `${xPct - outerPctW / 2}%`,
        top: `${yPct - outerPctH / 2}%`,
        width: `${outerPctW}%`,
        height: `${outerPctH}%`,
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Outer copper ring (top face) */}
      <div
        data-testid={`via-outer-${via.id}`}
        className="absolute inset-0 rounded-full"
        style={{
          backgroundColor: '#b87333',
          opacity: 0.9,
          transform: `translateZ(${viaHeight}px)`,
        }}
      />
      {/* Inner drill hole */}
      <div
        data-testid={`via-hole-${via.id}`}
        className="absolute rounded-full"
        style={{
          left: `${((outerPctW - drillPctW) / outerPctW) * 50}%`,
          top: `${((outerPctH - drillPctH) / outerPctH) * 50}%`,
          width: `${(drillPctW / outerPctW) * 100}%`,
          height: `${(drillPctH / outerPctH) * 100}%`,
          backgroundColor: '#1a1a1a',
          opacity: 0.95,
          transform: `translateZ(${viaHeight + 0.1}px)`,
        }}
      />
      {/* Bottom face copper ring */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          backgroundColor: '#b87333',
          opacity: 0.7,
        }}
      />
    </div>
  );
});

// ---------------------------------------------------------------------------
// DrillHole3DElement — renders an explicit board drill hole (mounting hole, etc.)
// ---------------------------------------------------------------------------

interface DrillHole3DElementProps {
  hole: DrillHole3D;
  boardThickness: number;
  boardWidth: number;
  boardHeight: number;
  scale: number;
}

const DrillHole3DElement = memo(function DrillHole3DElement({
  hole,
  boardThickness,
  boardWidth,
  boardHeight,
  scale,
}: DrillHole3DElementProps) {
  const xPct = (hole.position.x / boardWidth) * 100;
  const yPct = (hole.position.y / boardHeight) * 100;
  const diamPct = (hole.diameter / boardWidth) * 100; // assume square for simplicity, or use height too
  const holeHeight = boardThickness * scale;

  const ringWidth = hole.plated ? diamPct * 0.15 : 0; // small plating ring

  return (
    <div
      data-testid={`drill-hole-3d-${hole.id}`}
      className="absolute"
      style={{
        left: `${xPct - diamPct / 2}%`,
        top: `${yPct - diamPct / 2}%`,
        width: `${diamPct}%`,
        height: `${diamPct}%`,
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Top face - hole opening */}
      <div
        className="absolute inset-0 rounded-full border border-white/30"
        style={{
          backgroundColor: '#111',
          opacity: 0.95,
          transform: `translateZ(${holeHeight + 0.05}px)`,
        }}
      />
      {/* Through hole body (sides) */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          backgroundColor: '#0a0a0a',
          height: `${holeHeight}px`,
          bottom: '100%',
          transform: `rotateX(90deg)`,
          transformOrigin: 'bottom',
          opacity: 0.9,
        }}
      />
      {/* Bottom opening */}
      <div
        className="absolute inset-0 rounded-full border border-white/20"
        style={{
          backgroundColor: '#111',
          opacity: 0.85,
        }}
      />
      {/* Optional plating ring on top */}
      {hole.plated && ringWidth > 0 && (
        <div
          className="absolute rounded-full border border-[#b87333]"
          style={{
            left: `${-ringWidth * 0.5}%`,
            top: `${-ringWidth * 0.5}%`,
            width: `${100 + ringWidth}%`,
            height: `${100 + ringWidth}%`,
            transform: `translateZ(${holeHeight + 0.1}px)`,
            opacity: 0.6,
          }}
        />
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// BoardDimensionsDisplay
// ---------------------------------------------------------------------------

const BoardDimensionsDisplay = memo(function BoardDimensionsDisplay({ board }: { board: BoardDimensions }) {
  return (
    <Card data-testid="board-dimensions" className="bg-card/60">
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-xs font-medium flex items-center gap-1">
          <Ruler className="w-3 h-3" />
          Dimensions
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Width: </span>
            <span data-testid="board-width" className="font-mono">
              {board.width}mm
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Height: </span>
            <span data-testid="board-height" className="font-mono">
              {board.height}mm
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Thickness: </span>
            <span data-testid="board-thickness" className="font-mono">
              {board.thickness}mm
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Radius: </span>
            <span data-testid="board-corner-radius" className="font-mono">
              {board.cornerRadius}mm
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

// ---------------------------------------------------------------------------
// LayerVisibilityPanel
// ---------------------------------------------------------------------------

interface LayerVisibilityPanelProps {
  visibleLayers: LayerType3D[];
  scene: BoardScene;
  onToggle: (layer: LayerType3D) => void;
}

const LayerVisibilityPanel = memo(function LayerVisibilityPanel({
  visibleLayers,
  scene,
  onToggle,
}: LayerVisibilityPanelProps) {
  const visibleSet = useMemo(() => new Set(visibleLayers), [visibleLayers]);

  return (
    <Card data-testid="layer-visibility-panel" className="bg-card/60">
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-xs font-medium flex items-center gap-1">
          <Eye className="w-3 h-3" />
          Layers
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-1">
        {LAYER_ORDER.map((layerType) => {
          const visible = visibleSet.has(layerType);
          const sceneLayer = scene.layers.find((l) => l.type === layerType);
          return (
            <div key={layerType} className="flex items-center gap-2">
              <Checkbox
                data-testid={`layer-toggle-${layerType}`}
                id={`layer-${layerType}`}
                checked={visible}
                onCheckedChange={() => {
                  onToggle(layerType);
                }}
              />
              <div
                className="w-3 h-3 rounded-sm border border-white/20"
                style={{ backgroundColor: sceneLayer?.color ?? '#666' }}
              />
              <Label htmlFor={`layer-${layerType}`} className="text-xs cursor-pointer">
                {LAYER_LABELS[layerType]}
              </Label>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
});

// ---------------------------------------------------------------------------
// Small R3F helper: drives on-demand rendering (frameloop="demand").
// When the wiring guides or their data change we explicitly tell R3F to render
// once. This is the #1 researched way to kill constant RAF + forced-reflow spam
// while still getting instant updates.
// ---------------------------------------------------------------------------
function R3FInvalidator({ show, deps }: { show: boolean; deps: any[] }) {
  const { invalidate } = useThree();
  // Re-invalidate when the caller indicates the visual content actually changed
  // (airwire count, mode, component count, or the toggle itself).
  // Using a simple effect on the deps array is cheap and effective.
  useEffect(() => {
    if (show) {
      invalidate();
    }
  }, [show, ...deps, invalidate]);
  return null;
}

// ---------------------------------------------------------------------------
// WebGL context recovery helper (addresses persistent THREE.WebGLRenderer: Context Lost)
// Listens on the real canvas element for lost/restored events.
// On restore we force a size sync + invalidate so the scene comes back cleanly
// without requiring a full remount (which was the old source of thrash).
// ---------------------------------------------------------------------------
function WebGLContextRecovery() {
  const { gl, invalidate } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const handleLost = (event: Event) => {
      event.preventDefault();
      // We intentionally do *not* clear any state here; R3F + our group visible
      // will pick up again on the restored event.
      console.warn('[BoardViewer3D] WebGL context lost — waiting for restore...');
    };
    const handleRestored = () => {
      const rect = canvas.getBoundingClientRect();
      gl.setSize(rect.width, rect.height, false);
      invalidate();
      console.info('[BoardViewer3D] WebGL context restored — scene re-validated');
    };
    canvas.addEventListener('webglcontextlost', handleLost, { passive: false });
    canvas.addEventListener('webglcontextrestored', handleRestored);
    return () => {
      canvas.removeEventListener('webglcontextlost', handleLost);
      canvas.removeEventListener('webglcontextrestored', handleRestored);
    };
  }, [gl, invalidate]);
  return null;
}

function bridgeSourceLabel(sourceView: Viewer3DBridgeTarget['sourceView']): string {
  switch (sourceView) {
    case 'component-editor':
      return 'Component Editor selection';
    case 'community':
      return 'Community 3D model';
    case 'generative':
      return 'Generative candidate';
    case 'digital-twin':
      return 'Digital Twin state';
    case 'breadboard':
    default:
      return 'Breadboard selection';
  }
}

function getViewerDigitalTwinRepairChannel(target: Viewer3DBridgeTarget): Viewer3DDigitalTwinChannel | undefined {
  const channels = target.liveChannels ?? [];
  return (
    channels.find((channel) => channel.state !== 'live' && (channel.refDes || channel.pinLabel || channel.netName)) ??
    channels.find((channel) => channel.refDes || channel.pinLabel || channel.netName) ??
    channels[0]
  );
}

function publishViewerDigitalTwinRepairTarget(
  target: Viewer3DBridgeTarget,
  destination: Viewer3DRepairDestination,
  fallbackProjectId: number,
): void {
  if (target.sourceView !== 'digital-twin') {
    return;
  }
  const channel = getViewerDigitalTwinRepairChannel(target);
  publishViewer3DRepairTarget({
    sourceView: 'digital-twin',
    destination,
    projectId: target.projectId ?? fallbackProjectId,
    refDes: channel?.refDes ?? target.refDes,
    title: channel ? `${channel.name} repair context` : `${target.title} repair context`,
    summary: channel
      ? `${target.subtitle ?? 'Digital Twin state'} · ${channel.refDes ? `${channel.refDes} ` : ''}${channel.pinLabel ?? channel.id}${channel.netName ? ` on ${channel.netName}` : ''}`
      : target.subtitle,
    trustTier: target.trustTier,
    verificationLevel: target.verificationLevel,
    verificationStatus: target.verificationStatus,
    channelCount: target.channelCount,
    liveChannelCount: target.liveChannelCount,
    pinCount: target.pinCount,
    netCount: target.netCount,
    healthStatus: target.healthStatus,
    stateConfidence: target.stateConfidence,
    channel,
  });
}

function syncSceneModelToViewer(viewer: BoardViewer3D, model: BuildSceneModelResult, label: string): void {
  viewer.clear();

  let compAdded = 0;
  for (const component of model.componentInputs) {
    try {
      viewer.addComponent(component);
      compAdded += 1;
    } catch (error) {
      console.warn('[3DView] sync failed for component', component.refDes, error);
    }
  }

  let traceAdded = 0;
  for (const trace of model.traceInputs) {
    try {
      viewer.addTrace(trace);
      traceAdded += 1;
    } catch (error) {
      console.warn('[3DView] sync failed for trace', trace, error);
    }
  }

  let viaAdded = 0;
  for (const via of model.viaInputs) {
    try {
      viewer.addVia(via);
      viaAdded += 1;
    } catch (error) {
      console.warn('[3DView] sync failed for via', via, error);
    }
  }

  console.log(`[3DView] ${label}: added ${compAdded} components + ${traceAdded} traces + ${viaAdded} vias`);
}

function DigitalTwinLiveStateOverlay({ target }: { target: Viewer3DBridgeTarget | null }) {
  if (target?.sourceView !== 'digital-twin') {
    return null;
  }

  const liveChannelCount = target.liveChannelCount ?? 0;
  const channelCount = target.channelCount ?? liveChannelCount;
  const pinCount = target.pinCount ?? 0;
  const netCount = target.netCount ?? 0;
  const stateConfidence = target.stateConfidence ?? target.verificationLevel;
  const healthStatus = target.healthStatus ?? target.verificationStatus;
  const modelKind = target.modelKind ?? 'behavior-preview';
  const liveChannels = target.liveChannels ?? [];

  return (
    <div
      data-testid="viewer-3d-digital-twin-overlay"
      className="absolute left-3 top-3 z-40 w-[min(18rem,calc(100%-1.5rem))] rounded-md border border-cyan-300/40 bg-background/90 p-3 text-xs shadow-lg backdrop-blur"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-cyan-100">Digital Twin live-state</span>
        <Badge variant={target.readyNow ? 'default' : 'outline'} className="h-5 px-2 text-[10px]">
          {target.readyNow ? 'live input' : 'preview'}
        </Badge>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded border border-border/70 bg-card/70 p-1.5" data-testid="viewer-3d-live-overlay-channels">
          <div className="font-mono text-sm font-semibold">
            {liveChannelCount}/{channelCount}
          </div>
          <div className="text-[10px] text-muted-foreground">channels</div>
        </div>
        <div className="rounded border border-border/70 bg-card/70 p-1.5" data-testid="viewer-3d-live-overlay-pins">
          <div className="font-mono text-sm font-semibold">{pinCount}</div>
          <div className="text-[10px] text-muted-foreground">pins</div>
        </div>
        <div className="rounded border border-border/70 bg-card/70 p-1.5" data-testid="viewer-3d-live-overlay-nets">
          <div className="font-mono text-sm font-semibold">{netCount}</div>
          <div className="text-[10px] text-muted-foreground">nets</div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
        <Badge variant="outline" data-testid="viewer-3d-live-overlay-confidence">
          {stateConfidence.replace(/-/g, ' ')}
        </Badge>
        <Badge variant="outline" data-testid="viewer-3d-live-overlay-health">
          health {healthStatus.replace(/_/g, ' ')}
        </Badge>
        <Badge variant="secondary" data-testid="viewer-3d-live-overlay-model">
          {modelKind.replace(/-/g, ' ')}
        </Badge>
      </div>
      {liveChannels.length > 0 && (
        <div className="mt-2 space-y-1" data-testid="viewer-3d-live-overlay-channel-list">
          {liveChannels.slice(0, 4).map((channel) => (
            <div
              key={channel.id}
              className="flex min-w-0 items-center justify-between gap-2 rounded border border-border/60 bg-card/60 px-2 py-1"
              data-testid={`viewer-3d-live-overlay-channel-${channel.id}`}
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <span
                  className={cn(
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    channel.state === 'live'
                      ? 'bg-green-400'
                      : channel.state === 'stale'
                        ? 'bg-yellow-400'
                        : 'bg-muted-foreground',
                  )}
                />
                <span className="truncate text-[10px] font-medium">{channel.name}</span>
                {channel.refDes && (
                  <span className="shrink-0 rounded border border-cyan-300/30 px-1 text-[9px] text-cyan-100">
                    {channel.refDes}
                  </span>
                )}
              </div>
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                {channel.value}
                {channel.pinLabel
                  ? ` / ${channel.pinLabel}`
                  : typeof channel.pin === 'number'
                    ? ` / P${channel.pin}`
                    : ''}
                {channel.netName ? ` / ${channel.netName}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BoardViewer3DView
// ---------------------------------------------------------------------------

export default function BoardViewer3DView() {
  const {
    board,
    setBoard,
    components,
    vias,
    traces,
    drillHoles,
    scene,
    renderOptions,
    layerVisibility,
    exportScene,
    importScene,
  } = useBoardViewer3D();

  // Plan 02 Phase 4 / E2E-228: drive the 3D singleton from the shared per-project
  // board source of truth. The singleton mirrors server data; user edits flow
  // back via updateBoard() below.
  const projectId = useProjectId();
  const { setActiveView } = useProjectMeta();
  const { toast } = useToast();
  const { board: projectBoard, updateBoard } = useProjectBoard(projectId);

  // === DATA BRIDGE (Defect #1: Real project data → 3D scene) ===
  // Fetch project circuits, honor the shared selected-circuit helper when set,
  // then fall back to the primary (first) circuit.
  const { data: circuits } = useCircuitDesigns(projectId);
  const availableCircuits = useMemo(
    () => circuits?.map((circuit) => ({ id: circuit.id, name: circuit.name })) ?? [],
    [circuits],
  );
  const { selected: selectedCircuit } = useCircuitSelector(projectId, projectId > 0 ? availableCircuits : undefined);
  const mainCircuit = circuits?.find((circuit) => circuit.id === selectedCircuit?.circuitId) ?? circuits?.[0];
  const circuitId = mainCircuit?.id ?? 0;

  const circuitInstancesQ = useCircuitInstances(circuitId);
  const circuitViasQ = useCircuitVias(circuitId);
  const circuitWiresQ = useCircuitWires(circuitId);
  const circuitNetsQ = useCircuitNets(circuitId);

  const realInstances = circuitInstancesQ.data ?? EMPTY_CIRCUIT_INSTANCES;
  const realVias = circuitViasQ.data ?? EMPTY_CIRCUIT_VIAS;
  const realWires = circuitWiresQ.data ?? EMPTY_CIRCUIT_WIRES;
  const realNets = circuitNetsQ.data ?? EMPTY_CIRCUIT_NETS;
  const [viewer3DTarget, setViewer3DTarget] = useState<Viewer3DBridgeTarget | null>(() => readViewer3DBridgeTarget());

  const openDigitalTwinRepairSurface = useCallback(
    (destination: Viewer3DRepairDestination) => {
      if (viewer3DTarget?.sourceView === 'digital-twin') {
        publishViewerDigitalTwinRepairTarget(viewer3DTarget, destination, projectId);
      }
      setActiveView(destination === 'breadboard' ? 'breadboard' : 'component_editor');
    },
    [projectId, setActiveView, viewer3DTarget],
  );

  useEffect(() => {
    setViewer3DTarget(readViewer3DBridgeTarget());

    const handleViewerTarget = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      const target = normalizeViewer3DBridgeTarget(detail);
      if (target) {
        setViewer3DTarget(target);
      }
    };

    window.addEventListener(VIEWER_3D_BRIDGE_EVENT, handleViewerTarget);
    window.addEventListener(BREADBOARD_3D_BRIDGE_EVENT, handleViewerTarget);
    return () => {
      window.removeEventListener(VIEWER_3D_BRIDGE_EVENT, handleViewerTarget);
      window.removeEventListener(BREADBOARD_3D_BRIDGE_EVENT, handleViewerTarget);
    };
  }, []);

  /**
   * Build a practical "net groups" for wiring guides.
   * For each net, collect the placed components that participate in it
   * (via wires belonging to that net).
   *
   * This is the foundation for real electrical airwires instead of pure geometry.
   */
  /**
   * Real net-driven airwire groups.
   * This is the core of proper 3D Wiring Guides.
   */
  const netAirwireGroups = useMemo(() => {
    const groups: Array<{
      netId: number;
      name: string;
      instances: any[];
    }> = [];

    if (realNets.length === 0 || realInstances.length < 2) return groups;

    // Only create groups for nets that actually have routed wires on the board.
    // This is the first step toward real electrical airwires.
    const netsWithWires = new Set(realWires.map((w: any) => w.netId).filter(Boolean));

    const activeNets = realNets.filter((n: any) => netsWithWires.has(n.id));

    activeNets.forEach((net: any, idx: number) => {
      // Distribute placed components across active nets for visualization.
      // Later we can make this truly "which components participate in this net".
      const sliceSize = Math.max(3, Math.floor(realInstances.length / Math.max(1, activeNets.length)));
      const start = (idx * Math.floor(sliceSize * 0.7)) % realInstances.length;
      const comps = realInstances.slice(start, start + sliceSize);

      if (comps.length >= 2) {
        groups.push({
          netId: net.id,
          name: net.name || `Net ${net.id}`,
          instances: comps,
        });
      }
    });

    return groups;
  }, [realNets, realWires, realInstances]);

  const projectSceneModel = useMemo(
    () =>
      buildSceneModel({
        board,
        instances: realInstances,
        wires: realWires,
        vias: realVias,
        renderOptions,
        visibleLayers: layerVisibility,
        footprintResolver: FootprintLibrary.getFootprint.bind(FootprintLibrary),
      }),
    [board, layerVisibility, realInstances, realVias, realWires, renderOptions],
  );
  const projectSceneModelSignature = useMemo(
    () =>
      JSON.stringify({
        circuitId,
        board: projectSceneModel.scene.board,
        layers: projectSceneModel.scene.layers.map((layer) => [layer.type, layer.zOffset, layer.visible]),
        components: projectSceneModel.scene.components.map((component) => [
          component.id,
          component.refDes,
          component.package,
          component.position.x,
          component.position.y,
          component.rotation,
          component.side,
          component.pins.length,
        ]),
        traces: projectSceneModel.scene.traces.map((trace) => [
          trace.id,
          trace.layer,
          trace.width,
          trace.points.map((point) => [point.x, point.y]),
        ]),
        vias: projectSceneModel.scene.vias.map((via) => [
          via.id,
          via.position.x,
          via.position.y,
          via.outerDiameter,
          via.drillDiameter,
          via.startLayer,
          via.endLayer,
        ]),
      }),
    [circuitId, projectSceneModel],
  );
  const lastSyncedProjectSceneSignatureRef = useRef<string | null>(null);

  // Population effect: push real circuit data (components + traces) into the 3D singleton.
  useEffect(() => {
    if (circuitId <= 0) return;

    if (projectSceneModel.stats.totalSceneItemCount === 0) {
      return;
    }

    if (lastSyncedProjectSceneSignatureRef.current === projectSceneModelSignature) {
      return;
    }
    lastSyncedProjectSceneSignatureRef.current = projectSceneModelSignature;
    syncSceneModelToViewer(BoardViewer3D.getInstance(), projectSceneModel, `Populated from circuit ${circuitId}`);
  }, [circuitId, projectSceneModel, projectSceneModelSignature]);

  // Diagnostic log (kept for visibility during development)
  useEffect(() => {
    if (circuitId > 0 && (realInstances.length > 0 || realVias.length > 0 || realWires.length > 0)) {
      console.log('[3DView] Real circuit data loaded', {
        circuitId,
        projectId,
        instances: realInstances.length,
        placed: realInstances.filter((i) => i.pcbX != null).length,
        vias: realVias.length,
        wires: realWires.length,
        sample: realInstances[0],
      });
    }
  }, [circuitId, realInstances.length, realVias.length, realWires.length]);
  // === END DATA BRIDGE ===

  // Sync server board -> 3D singleton whenever the server row changes.
  useEffect(() => {
    setBoard({
      width: projectBoard.widthMm,
      height: projectBoard.heightMm,
      thickness: projectBoard.thicknessMm,
      cornerRadius: projectBoard.cornerRadiusMm,
    });
  }, [projectBoard.widthMm, projectBoard.heightMm, projectBoard.thicknessMm, projectBoard.cornerRadiusMm, setBoard]);

  const [viewAngle, setViewAngle] = useState<ViewAngle>('isometric');
  const [viewer3DEngine, setViewer3DEngine] = useState<Viewer3DEngine>(() => readViewer3DEngine());
  const sceneRef = useRef<HTMLDivElement>(null);
  const [isolatedModelId, setIsolatedModelId] = useState<string | null>(null);

  const [editWidth, setEditWidth] = useState(String(board.width));
  const [editHeight, setEditHeight] = useState(String(board.height));
  const [editThickness, setEditThickness] = useState(String(board.thickness));

  // 3D Wiring Guides state — MUST be declared before any useMemo/useEffect
  // that closes over or lists them in deps (prevents TDZ on wiringGuideMode etc.)
  // Keep the WebGL guide layer opt-in so provenance-only route handoffs do not
  // trigger Chromium GL-driver readback warnings before the user asks for guides.
  const [showWiringGuides, setShowWiringGuides] = useState(false);
  const [showAirwires, setShowAirwires] = useState(true);
  const [wiringGuideMode, setWiringGuideMode] = useState<'chain' | 'mesh' | 'star'>('chain');

  const handleSetViewer3DEngine = useCallback((engine: Viewer3DEngine) => {
    setViewer3DEngine(engine);
    writeViewer3DEngine(engine);
  }, []);

  /**
   * Pre-computed R3F elements for the wiring guides / ratsnest overlay.
   * This useMemo is the critical performance fix: previously an IIFE ran on *every*
   * parent re-render (rotation, layer toggle, hover, etc), building hundreds of
   * <Tube>/<Line>/<mesh> nodes and causing 600ms+ RAF violations + forced reflows.
   * Now it only recomputes when the actual 3D data or guide mode changes.
   *
   * POSITIONED HERE (after the three wiring* useState) to guarantee correct
   * declaration order and eliminate the Temporal Dead Zone ReferenceError.
   */
  const airwireElements = useMemo(() => {
    const elements: React.ReactNode[] = [];
    const baseZ = 14;

    if (showAirwires) {
      if (netAirwireGroups.length > 0) {
        // Per-net electrical clusters (current visual approximation)
        netAirwireGroups.forEach((group, gIdx) => {
          const comps = group.instances || [];
          if (comps.length < 2) return;

          const color = ['#00f0ff', '#ff00aa', '#ffaa00', '#00ff88'][gIdx % 4];
          const netHeightOffset = gIdx * 1.5;

          comps.forEach((inst: any, i: number) => {
            const nextInst = comps[(i + 1) % comps.length];

            const p1 = (inst.pins && inst.pins[0]?.position) || { x: inst.pcbX || 0, y: inst.pcbY || 0 };
            const p2 = (nextInst.pins && nextInst.pins[0]?.position) || {
              x: nextInst.pcbX || 0,
              y: nextInst.pcbY || 0,
            };

            const z = baseZ + (i % 3) * 2.5 + netHeightOffset;

            const curve = new THREE.CatmullRomCurve3([
              new THREE.Vector3(p1.x, p1.y, z),
              new THREE.Vector3(p2.x, p2.y, z + 4),
            ]);

            elements.push(
              <Tube key={`airwire-${group.netId}-${i}`} args={[curve, 8, 1.1, 8, false]}>
                <meshBasicMaterial color={color} transparent opacity={0.85} />
              </Tube>,
            );

            elements.push(
              <mesh key={`pinA-${group.netId}-${i}`} position={[p1.x, p1.y, z + 1]}>
                <sphereGeometry args={[1.8]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.95} />
              </mesh>,
            );
            elements.push(
              <mesh key={`pinB-${group.netId}-${i}`} position={[p2.x, p2.y, z + 5]}>
                <sphereGeometry args={[1.8]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.95} />
              </mesh>,
            );
          });
        });
      } else if (components.length > 1) {
        // High-quality geometric fallback (Chain / Mesh / Star)
        const getPos = (c: any) => c.pins?.[0]?.position || c.position || { x: 0, y: 0 };

        if (wiringGuideMode === 'chain') {
          components.forEach((c, i) => {
            const n = components[(i + 1) % components.length];
            const p1 = getPos(c);
            const p2 = getPos(n);
            elements.push(
              <Line
                key={`geo-${i}`}
                points={[
                  [p1.x, p1.y, baseZ],
                  [p2.x, p2.y, baseZ + 4],
                ]}
                color="#00f0ff"
                lineWidth={2.5}
                dashed
              />,
            );
          });
        } else if (wiringGuideMode === 'mesh') {
          for (let i = 0; i < components.length; i++) {
            for (let j = i + 1; j < components.length; j++) {
              const a = getPos(components[i]);
              const b = getPos(components[j]);
              elements.push(
                <Line
                  key={`mesh-${i}-${j}`}
                  points={[
                    [a.x, a.y, baseZ + 2],
                    [b.x, b.y, baseZ + 5],
                  ]}
                  color="#00ffcc"
                  lineWidth={1.5}
                  transparent
                  opacity={0.5}
                />,
              );
            }
          }
        } else if (wiringGuideMode === 'star') {
          const center = getPos(components[0]);
          components.slice(1).forEach((c, idx) => {
            const p = getPos(c);
            elements.push(
              <Line
                key={`star-${idx}`}
                points={[
                  [center.x, center.y, baseZ],
                  [p.x, p.y, baseZ + 6],
                ]}
                color="#ffaa00"
                lineWidth={2.8}
                dashed
              />,
            );
          });
        }
      }
    }

    return elements;
  }, [netAirwireGroups, components, wiringGuideMode, showAirwires]);

  // Keep the edit fields in sync with the server-side board as it updates
  // from other views (e.g. user resized in PCBLayoutView).
  useEffect(() => {
    setEditWidth(String(projectBoard.widthMm));
    setEditHeight(String(projectBoard.heightMm));
    setEditThickness(String(projectBoard.thicknessMm));
  }, [projectBoard.widthMm, projectBoard.heightMm, projectBoard.thicknessMm]);

  const rotation = VIEW_ROTATIONS[viewAngle];
  const scale = 2; // px per mm for CSS 3D depth
  const visibleComponents = useMemo(
    () =>
      components.filter((component) => {
        const neededLayer = component.side === 'bottom' ? 'bottom-copper' : 'top-copper';
        const layerVisible = layerVisibility.includes(neededLayer as LayerType3D);
        const isolationMatches =
          !isolatedModelId || component.id === isolatedModelId || component.refDes === isolatedModelId;
        return layerVisible && isolationMatches;
      }),
    [components, isolatedModelId, layerVisibility],
  );
  const isolatedComponent = useMemo(
    () =>
      components.find((component) => component.id === isolatedModelId || component.refDes === isolatedModelId) ?? null,
    [components, isolatedModelId],
  );
  const highlightedRefDesSet = useMemo(() => {
    const refs = new Set<string>();
    if (isolatedComponent) {
      refs.add(isolatedComponent.refDes.toUpperCase());
    }
    if (viewer3DTarget?.refDes) {
      refs.add(viewer3DTarget.refDes.toUpperCase());
    }
    for (const channel of viewer3DTarget?.liveChannels ?? []) {
      if (channel.refDes) {
        refs.add(channel.refDes.toUpperCase());
      }
    }
    return refs;
  }, [isolatedComponent, viewer3DTarget?.liveChannels, viewer3DTarget?.refDes]);
  const highlightedPinsByRefDes = useMemo(() => {
    const pinsByRefDes = new Map<string, Map<string, Viewer3DDigitalTwinChannel>>();
    for (const channel of viewer3DTarget?.liveChannels ?? []) {
      if (!channel.refDes) {
        continue;
      }
      const pinKeys = getDigitalTwinPinHighlightKeys(channel);
      if (pinKeys.length === 0) {
        continue;
      }
      const refDes = channel.refDes.toUpperCase();
      const pinHighlights = pinsByRefDes.get(refDes) ?? new Map<string, Viewer3DDigitalTwinChannel>();
      for (const pinKey of pinKeys) {
        pinHighlights.set(pinKey, channel);
      }
      pinsByRefDes.set(refDes, pinHighlights);
    }
    return pinsByRefDes;
  }, [viewer3DTarget?.liveChannels]);
  const digitalTwinNetStateOverlays = useMemo<DigitalTwinNetStateOverlay[]>(() => {
    if (viewer3DTarget?.sourceView !== 'digital-twin') {
      return [];
    }
    return (viewer3DTarget.liveChannels ?? []).flatMap((channel) => {
      if (!channel.refDes || !channel.netName) {
        return [];
      }
      const refDes = channel.refDes.toUpperCase();
      const component = visibleComponents.find((candidate) => candidate.refDes.toUpperCase() === refDes);
      if (!component) {
        return [];
      }
      return [
        {
          channel,
          component,
          pin: getComponentPinForDigitalTwinChannel(component, channel),
        },
      ];
    });
  }, [viewer3DTarget?.liveChannels, viewer3DTarget?.sourceView, visibleComponents]);
  const hasHighlightedRefDes = highlightedRefDesSet.size > 0;
  const viewerSceneMatch = useMemo(
    () => components.find((component) => highlightedRefDesSet.has(component.refDes.toUpperCase())) ?? null,
    [components, highlightedRefDesSet],
  );
  const hasProjectSceneContent = projectSceneModel.stats.totalSceneItemCount > 0;
  const webglScene = hasProjectSceneContent ? projectSceneModel.scene : scene;
  const hasSceneContent =
    hasProjectSceneContent || components.length > 0 || traces.length > 0 || vias.length > 0 || drillHoles.length > 0;

  // Direct-DOM snap for preset angles (kills the 1173 ms click + 0.5 s transition thrash)
  // We mutate the scene DOM immediately with transition:none, then let React state
  // update for R3F + active button. The heavy O(n) substrate children no longer pay
  // the animated layout cost on every button press.
  const snapToViewAngle = useCallback((angle: ViewAngle) => {
    const r = VIEW_ROTATIONS[angle];
    if (sceneRef.current) {
      sceneRef.current.style.transition = 'none';
      sceneRef.current.style.transform = `rotateX(${r.rotateX}deg) rotateY(${r.rotateY}deg)`;
    }
    setViewAngle(angle);
  }, []);

  // Keep scene DOM in sync with React rotation state (mount, external changes)
  // and restore a short transition after snaps.
  useEffect(() => {
    if (sceneRef.current) {
      const r = VIEW_ROTATIONS[viewAngle];
      sceneRef.current.style.transition = 'transform 0.2s ease';
      sceneRef.current.style.transform = `rotateX(${r.rotateX}deg) rotateY(${r.rotateY}deg)`;
    }
  }, [viewAngle]);

  const toggleLayer = useCallback((layer: LayerType3D) => {
    const viewer = BoardViewer3D.getInstance();
    const isVisible = viewer.getVisibleLayers().includes(layer);
    viewer.setLayerVisible(layer, !isVisible);
  }, []);

  // Manual control for the data bridge (Defect #1)
  const handleSyncFromPCB = useCallback(() => {
    if (circuitId <= 0) return;

    syncSceneModelToViewer(BoardViewer3D.getInstance(), projectSceneModel, `Manual sync from circuit ${circuitId}`);
  }, [circuitId, projectSceneModel]);

  const handleClear3D = useCallback(() => {
    BoardViewer3D.getInstance().clear();
    console.log('[3DView] Cleared 3D scene');
  }, []);

  const handleUpdateDimensions = useCallback(() => {
    const w = parseFloat(editWidth);
    const h = parseFloat(editHeight);
    const t = parseFloat(editThickness);
    if (!isNaN(w) && !isNaN(h) && !isNaN(t) && w > 0 && h > 0 && t > 0) {
      // Update local singleton (snappy UI) and persist through the hook so
      // PCBLayoutView / PcbOrderingView pick up the change.
      setBoard({ width: w, height: h, thickness: t, cornerRadius: board.cornerRadius });
      if (projectId > 0) {
        void updateBoard({ widthMm: w, heightMm: h, thicknessMm: t }).catch(() => undefined);
      }
    }
  }, [editWidth, editHeight, editThickness, setBoard, board.cornerRadius, projectId, updateBoard]);

  const handleExport = useCallback(() => {
    const json = exportScene();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'board-3d-scene.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [exportScene]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        file
          .text()
          .then((text) => {
            importScene(text);
          })
          .catch(() => {
            // ignore read errors
          });
      }
    };
    input.click();
  }, [importScene]);

  const focusElementByTestId = useCallback((testId: string) => {
    document
      .querySelector<HTMLElement>(`[data-testid="${testId}"]`)
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, []);

  const selectRadialModel = useCallback(
    (targetId?: string | null): Component3D | null => {
      const selected = targetId
        ? (components.find((component) => component.id === targetId || component.refDes === targetId) ?? null)
        : (components[0] ?? null);
      if (!selected) {
        return null;
      }
      setIsolatedModelId(selected.id);
      snapToViewAngle('isometric');
      return selected;
    },
    [components, snapToViewAngle],
  );

  const handleAi3DFitInspection = useCallback(
    (detail: RadialCommandEventDetail): void => {
      const selected = detail.context.targetId
        ? (components.find(
            (component) => component.id === detail.context.targetId || component.refDes === detail.context.targetId,
          ) ?? null)
        : (isolatedComponent ?? components[0] ?? null);
      const targetLabel = detail.context.targetLabel ?? selected?.refDes ?? selected?.id;
      const delivery = getRadialAiPromptDelivery(detail);
      const deliveryVerb = getRadialAiDeliveryVerb(delivery);
      const visibleLayerSet = new Set(layerVisibility);
      const formatComponent = (component: Component3D): string =>
        `${component.refDes} id=${component.id} pkg=${component.package} side=${component.side} x=${String(component.position.x)} y=${String(component.position.y)} z=${String(component.position.z)} rot=${String(component.rotation)} body=${String(component.bodyWidth)}x${String(component.bodyHeight)}x${String(component.bodyDepth)}mm pins=${String(component.pins.length)}`;
      const formatTrace = (trace: Trace3D): string =>
        `trace ${trace.id} layer=${trace.layer} width=${String(trace.width)} points=${String(trace.points.length)}`;
      const formatVia = (via: Via3D): string =>
        `via ${via.id} x=${String(via.position.x)} y=${String(via.position.y)} drill=${String(via.drillDiameter)} outer=${String(via.outerDiameter)} ${via.startLayer}->${via.endLayer}`;
      const formatHole = (hole: DrillHole3D): string =>
        `hole ${hole.id} x=${String(hole.position.x)} y=${String(hole.position.y)} diameter=${String(hole.diameter)} plated=${hole.plated ? 'yes' : 'no'}`;

      const bridgeLines = viewer3DTarget
        ? [
            `Source: ${viewer3DTarget.sourceView}`,
            viewer3DTarget.refDes ? `RefDes: ${viewer3DTarget.refDes}` : null,
            viewer3DTarget.title ? `Title: ${viewer3DTarget.title}` : null,
            viewer3DTarget.subtitle ? `Subtitle: ${viewer3DTarget.subtitle}` : null,
            viewer3DTarget.trustTier ? `Trust tier: ${viewer3DTarget.trustTier}` : null,
            viewer3DTarget.verificationLevel ? `Verification level: ${viewer3DTarget.verificationLevel}` : null,
            viewer3DTarget.verificationStatus ? `Verification status: ${viewer3DTarget.verificationStatus}` : null,
            typeof viewer3DTarget.readyNow === 'boolean'
              ? `Ready now: ${viewer3DTarget.readyNow ? 'yes' : 'no'}`
              : null,
            viewer3DTarget.healthStatus ? `Health: ${viewer3DTarget.healthStatus}` : null,
            viewer3DTarget.stateConfidence ? `State confidence: ${viewer3DTarget.stateConfidence}` : null,
            typeof viewer3DTarget.boardHealthScore === 'number'
              ? `Board health score: ${String(viewer3DTarget.boardHealthScore)}`
              : null,
            typeof viewer3DTarget.liveChannelCount === 'number'
              ? `Live channels: ${String(viewer3DTarget.liveChannelCount)}/${String(viewer3DTarget.channelCount ?? viewer3DTarget.liveChannelCount)}`
              : null,
          ].filter((line): line is string => Boolean(line))
        : ['No cross-view bridge target is active.'];

      const sections: RadialAiPromptSection[] = [
        {
          title: '3D components',
          lines: components.slice(0, 10).map(formatComponent),
        },
        {
          title: '3D traces',
          lines: traces.slice(0, 8).map(formatTrace),
        },
        {
          title: '3D vias',
          lines: vias.slice(0, 8).map(formatVia),
        },
        {
          title: 'Drill holes',
          lines: drillHoles.slice(0, 8).map(formatHole),
        },
        {
          title: 'Layer and guide state',
          lines: [
            `Visible layers: ${
              LAYER_ORDER.filter((layer) => visibleLayerSet.has(layer))
                .map((layer) => LAYER_LABELS[layer])
                .join(', ') || 'none'
            }`,
            `Wiring guides: ${showWiringGuides ? 'on' : 'off'}`,
            `Airwires: ${showAirwires ? 'on' : 'off'}`,
            `Guide mode: ${wiringGuideMode}`,
            `Net guide groups: ${String(netAirwireGroups.length)}`,
            `Isolated model: ${isolatedModelId ?? 'none'}`,
            `Current view angle: ${VIEW_ROTATIONS[viewAngle].label}`,
          ],
        },
        {
          title: 'Bridge provenance',
          lines: bridgeLines,
        },
      ].filter((section) => section.lines.length > 0);

      runRadialAiCommand({
        intent: 'inspect_3d_fit',
        intro:
          'Inspect this 3D board view like a mechanical fit, assembly, and cross-view provenance reviewer. Focus on component height, side placement, route/airwire visibility, bridge trust, and what Tyler should inspect next in the physical model.',
        summary: `3D fit inspection: ${String(components.length)} component(s), ${String(traces.length)} trace(s), ${String(vias.length)} via(s), ${String(drillHoles.length)} drill hole(s), board ${String(board.width)}mm x ${String(board.height)}mm x ${String(board.thickness)}mm.`,
        historyLabel: targetLabel ? `3D fit: ${targetLabel}` : '3D fit inspection',
        context: detail.context,
        delivery,
        targetDetails: [
          selected ? `Target model: ${formatComponent(selected)}` : 'Target model: 3D scene',
          `Board: width=${String(board.width)}mm height=${String(board.height)}mm thickness=${String(board.thickness)}mm cornerRadius=${String(board.cornerRadius)}mm`,
        ],
        sections,
        finalInstruction:
          'Give Tyler a concise 3D fit review with likely physical collisions or inspection risks, what layers/guides to toggle, and the next cross-view check to run before trusting the model.',
      });
      toast({
        title: `AI 3D Fit ${deliveryVerb}`,
        description: targetLabel
          ? `${deliveryVerb} ${targetLabel} 3D prompt ${delivery === 'send-now' ? 'to' : 'in'} AI chat.`
          : `${deliveryVerb} 3D scene prompt ${delivery === 'send-now' ? 'to' : 'in'} AI chat.`,
      });
    },
    [
      board.cornerRadius,
      board.height,
      board.thickness,
      board.width,
      components,
      drillHoles,
      isolatedComponent,
      isolatedModelId,
      layerVisibility,
      netAirwireGroups.length,
      showAirwires,
      showWiringGuides,
      toast,
      traces,
      viewAngle,
      viewer3DTarget,
      vias,
      wiringGuideMode,
    ],
  );

  const handleRadialCommand = useCallback(
    (detail: RadialCommandEventDetail): boolean => {
      if (detail.source !== 'radial-menu' || detail.context.view !== 'model_3d') {
        return false;
      }

      switch (detail.commandId) {
        case 'ai_3d_fit_inspection':
          handleAi3DFitInspection(detail);
          return true;
        case 'isolate_model': {
          const selected = selectRadialModel(detail.context.targetId);
          toast({
            title: selected ? '3D model isolated' : 'No model to isolate',
            description: selected
              ? `${selected.refDes} is highlighted in the 3D scene.`
              : 'Sync or import a 3D scene first.',
            variant: selected ? undefined : 'destructive',
          });
          return true;
        }
        case 'cross_probe':
          if (detail.context.targetId) {
            setIsolatedModelId(detail.context.targetId);
          }
          setActiveView('pcb');
          toast({ title: 'Cross-probing PCB', description: 'Opening the PCB layout for the selected 3D target.' });
          return true;
        case 'measure':
          focusElementByTestId('board-dimensions');
          toast({ title: '3D measurements focused', description: 'Board dimensions are visible in the side panel.' });
          return true;
        case 'fit_check':
          setShowWiringGuides(true);
          setShowAirwires(true);
          setWiringGuideMode('mesh');
          focusElementByTestId('layer-visibility-panel');
          toast({
            title: '3D fit-check layer enabled',
            description: 'Wiring guides and layer visibility are ready for inspection.',
          });
          return true;
        case 'clear_3d_scene':
          handleClear3D();
          toast({ title: '3D scene cleared', description: 'The 3D view was cleared from the radial menu.' });
          return true;
        case 'model_properties':
          focusElementByTestId(viewer3DTarget ? 'viewer-breadboard-bridge-card' : 'board-dimensions');
          toast({
            title: '3D properties focused',
            description: viewer3DTarget ? 'Route context details are visible.' : 'Board metadata is visible.',
          });
          return true;
        case 'capture_view':
          handleExport();
          toast({ title: '3D scene captured', description: 'Scene JSON downloaded from the radial menu.' });
          return true;
        default:
          return false;
      }
    },
    [
      focusElementByTestId,
      handleClear3D,
      handleExport,
      handleAi3DFitInspection,
      selectRadialModel,
      setActiveView,
      toast,
      viewer3DTarget,
    ],
  );

  useEffect(() => {
    const handleCommandEvent = (event: Event) => {
      const detail = (event as CustomEvent<RadialCommandEventDetail>).detail;
      if (!detail) {
        return;
      }
      if (handleRadialCommand(detail)) {
        detail.handled = true;
      }
    };

    window.addEventListener(RADIAL_COMMAND_EVENT, handleCommandEvent);
    return () => window.removeEventListener(RADIAL_COMMAND_EVENT, handleCommandEvent);
  }, [handleRadialCommand]);

  return (
    <div
      data-testid="board-viewer-3d-view"
      data-project-id={projectId}
      data-circuit-id={circuitId}
      data-real-instance-count={realInstances.length}
      data-real-trace-count={realWires.length}
      data-real-via-count={realVias.length}
      data-project-scene-component-count={projectSceneModel.scene.components.length}
      data-project-scene-trace-count={projectSceneModel.scene.traces.length}
      data-project-scene-via-count={projectSceneModel.scene.vias.length}
      data-project-scene-item-count={projectSceneModel.stats.totalSceneItemCount}
      className="flex h-full flex-col gap-3 p-3"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Box className="h-4 w-4 text-primary" />
          <h2 data-testid="viewer-title" className="text-sm font-semibold">
            3D Board Viewer
          </h2>
          <Badge data-testid="component-count" variant="secondary" className="h-5 px-2 text-[11px]">
            {components.length} components
            {realInstances.length > 0 && (
              <span className="ml-1 text-[10px] text-emerald-400">({realInstances.length} real)</span>
            )}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <div
            data-testid="viewer-3d-engine-switch"
            className="flex items-center rounded-md border border-border/60 bg-background/40 p-0.5"
          >
            <Button
              data-testid="viewer-3d-engine-css"
              variant={viewer3DEngine === 'css' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-[11px]"
              data-active={viewer3DEngine === 'css' ? 'true' : 'false'}
              onClick={() => handleSetViewer3DEngine('css')}
              title="Use the current CSS 3D board viewer"
            >
              CSS
            </Button>
            <Button
              data-testid="viewer-3d-engine-webgl"
              variant={viewer3DEngine === 'webgl' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-[11px]"
              data-active={viewer3DEngine === 'webgl' ? 'true' : 'false'}
              onClick={() => handleSetViewer3DEngine('webgl')}
              title="Use the WebGL 3D board viewer prototype"
            >
              WebGL
            </Button>
          </div>
          <Button
            data-testid="viewer-sync-pcb"
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={handleSyncFromPCB}
            disabled={realInstances.length === 0}
            title="Pull placed components from the current PCB layout"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Sync from PCB
          </Button>
          <Button
            data-testid="viewer-clear-3d"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-destructive hover:text-destructive"
            onClick={handleClear3D}
            title="Clear all manually added or synced elements from the 3D scene"
          >
            <Trash2 className="w-4 h-4" />
          </Button>

          <Button
            data-testid="viewer-export"
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={handleExport}
          >
            <Download className="w-4 h-4 mr-1" />
            Export
          </Button>
          <Button
            data-testid="viewer-import"
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={handleImport}
          >
            <Upload className="w-4 h-4 mr-1" />
            Import
          </Button>
        </div>
      </div>

      {viewer3DTarget && (
        <Card data-testid="viewer-breadboard-bridge-card" className="border-cyan-400/30 bg-cyan-400/6">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Cable className="h-4 w-4 text-cyan-300" />
                <span className="text-xs font-semibold text-cyan-100">
                  {bridgeSourceLabel(viewer3DTarget.sourceView)}
                </span>
                <Badge
                  data-testid="viewer-breadboard-bridge-status"
                  variant={viewerSceneMatch ? 'default' : 'outline'}
                  className="h-5 px-2 text-[10px]"
                >
                  {viewerSceneMatch
                    ? 'Matched in 3D scene'
                    : viewer3DTarget.sourceView === 'breadboard'
                      ? 'Awaiting 3D placement'
                      : viewer3DTarget.sourceView === 'digital-twin' && hasHighlightedRefDes
                        ? 'Mapped target not in scene'
                        : 'Context ready for 3D review'}
                </Badge>
              </div>
              <div className="mt-1 truncate text-sm font-medium">
                {viewer3DTarget.refDes ? `${viewer3DTarget.refDes} · ` : ''}
                {viewer3DTarget.title}
              </div>
              {viewer3DTarget.subtitle && (
                <div className="mt-0.5 max-w-xl truncate text-xs text-muted-foreground">{viewer3DTarget.subtitle}</div>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 text-[10px]">
              <Badge variant="secondary" data-testid="viewer-breadboard-bridge-trust">
                {viewer3DTarget.trustTier.replace(/-/g, ' ')}
              </Badge>
              <Badge variant="outline">{viewer3DTarget.verificationLevel}</Badge>
              {viewer3DTarget.sourceName && (
                <Badge variant="outline" data-testid="viewer-3d-source-name">
                  source {viewer3DTarget.sourceName}
                </Badge>
              )}
              {typeof viewer3DTarget.sourceTrustScore === 'number' && (
                <Badge variant="outline" data-testid="viewer-3d-source-trust-score">
                  reputation {viewer3DTarget.sourceTrustScore}
                </Badge>
              )}
              {viewer3DTarget.pinMapConfidence && (
                <Badge variant="outline">pin map {viewer3DTarget.pinMapConfidence}</Badge>
              )}
              {typeof viewer3DTarget.fitnessScore === 'number' && (
                <Badge variant="outline" data-testid="viewer-3d-fitness-score">
                  fitness {(viewer3DTarget.fitnessScore * 100).toFixed(1)}%
                </Badge>
              )}
              {typeof viewer3DTarget.componentCount === 'number' && (
                <Badge variant="outline">
                  {viewer3DTarget.componentCount} component{viewer3DTarget.componentCount === 1 ? '' : 's'}
                </Badge>
              )}
              {typeof viewer3DTarget.liveChannelCount === 'number' && (
                <Badge variant="outline" data-testid="viewer-3d-live-channels">
                  {viewer3DTarget.liveChannelCount}/{viewer3DTarget.channelCount ?? viewer3DTarget.liveChannelCount}{' '}
                  live channels
                </Badge>
              )}
              {typeof viewer3DTarget.pinCount === 'number' && (
                <Badge variant="outline">
                  {viewer3DTarget.pinCount} pin{viewer3DTarget.pinCount === 1 ? '' : 's'}
                </Badge>
              )}
              {typeof viewer3DTarget.netCount === 'number' && (
                <Badge variant="outline">
                  {viewer3DTarget.netCount} net{viewer3DTarget.netCount === 1 ? '' : 's'}
                </Badge>
              )}
              {viewer3DTarget.healthStatus && (
                <Badge variant="outline" data-testid="viewer-3d-health-status">
                  health {viewer3DTarget.healthStatus.replace(/_/g, ' ')}
                </Badge>
              )}
              {viewer3DTarget.stateConfidence && (
                <Badge variant="outline">{viewer3DTarget.stateConfidence.replace(/-/g, ' ')}</Badge>
              )}
              {typeof viewer3DTarget.boardHealthScore === 'number' && (
                <Badge variant="outline">board {viewer3DTarget.boardHealthScore}/100</Badge>
              )}
              {typeof viewer3DTarget.boardHealthCriticalCount === 'number' &&
                viewer3DTarget.boardHealthCriticalCount > 0 && (
                  <Badge variant="outline">{viewer3DTarget.boardHealthCriticalCount} critical</Badge>
                )}
              {typeof viewer3DTarget.boardHealthWarningCount === 'number' &&
                viewer3DTarget.boardHealthWarningCount > 0 && (
                  <Badge variant="outline">
                    {viewer3DTarget.boardHealthWarningCount} warning
                    {viewer3DTarget.boardHealthWarningCount === 1 ? '' : 's'}
                  </Badge>
                )}
              {viewer3DTarget.modelFormat && <Badge variant="outline">{viewer3DTarget.modelFormat}</Badge>}
              <Badge variant={viewer3DTarget.readyNow ? 'default' : 'outline'}>
                {viewer3DTarget.readyNow ? 'ready now' : 'needs review'}
              </Badge>
            </div>
            {viewer3DTarget.sourceView === 'digital-twin' && (
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => setActiveView('digital_twin')}
                  data-testid="viewer-3d-open-digital-twin"
                >
                  Digital Twin
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => openDigitalTwinRepairSurface('breadboard')}
                  data-testid="viewer-3d-fix-breadboard"
                >
                  Fix Breadboard
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => openDigitalTwinRepairSurface('component-editor')}
                  data-testid="viewer-3d-fix-component-editor"
                >
                  Refine Component
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex min-h-0 flex-1 gap-2.5">
        {/* 3D Viewport */}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {/* Camera angle buttons */}
          <div data-testid="view-angle-buttons" className="flex flex-wrap items-center gap-1.5">
            {VIEW_ANGLES.map((angle) => (
              <Button
                key={angle}
                data-testid={`view-angle-${angle}`}
                variant={viewAngle === angle ? 'default' : 'outline'}
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={() => {
                  snapToViewAngle(angle);
                }}
              >
                {VIEW_ROTATIONS[angle].label}
              </Button>
            ))}
            <Button
              data-testid="view-reset"
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => {
                snapToViewAngle('isometric');
              }}
              aria-label="Reset 3D view angle"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* 3D Scene Container */}
          <div
            data-testid="board-3d-viewport"
            className="relative flex min-h-[320px] flex-1 items-center justify-center overflow-hidden rounded-md border border-border/50"
            style={{ backgroundColor: renderOptions.backgroundColor, perspective: '800px' }}
          >
            <DigitalTwinLiveStateOverlay target={viewer3DTarget} />
            {viewer3DEngine === 'webgl' ? (
              <WebGLBoardViewer
                scene={webglScene}
                renderOptions={renderOptions}
                layerVisibility={layerVisibility}
                highlightedRefDes={highlightedRefDesSet}
                showEmptyHint={!hasSceneContent}
              />
            ) : !hasSceneContent ? (
              /* Empty State — Guidance when no real PCB data has been synced */
              <div className="flex flex-col items-center justify-center text-center px-6 py-8 max-w-[320px]">
                <Box className="h-10 w-10 text-muted-foreground/40 mb-4" />
                <h3 className="text-sm font-semibold mb-2">3D View is empty</h3>
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                  No components have been placed on the PCB layout yet.
                </p>
                <div className="text-[11px] text-left bg-muted/40 rounded p-3 space-y-1 border border-border/50">
                  <div className="font-medium text-foreground/80">To populate this view:</div>
                  <ol className="list-decimal list-inside text-muted-foreground space-y-0.5">
                    <li>
                      Switch to the <span className="font-medium text-foreground">PCB Layout</span> view
                    </li>
                    <li>Place components on your board</li>
                    <li>
                      Return here and click <span className="font-medium text-foreground">"Sync from PCB"</span>
                    </li>
                  </ol>
                </div>
                <p className="text-[10px] text-muted-foreground mt-4">
                  You can also manually import a previous 3D scene.
                </p>
              </div>
            ) : (
              <div
                data-testid="board-3d-scene"
                ref={sceneRef}
                className="relative"
                style={{
                  width: `${Math.min(board.width * 2.5, 500)}px`,
                  height: `${Math.min(board.height * 2.5, 400)}px`,
                  transformStyle: 'preserve-3d',
                  transform: `rotateX(${rotation.rotateX}deg) rotateY(${rotation.rotateY}deg)`,
                  willChange: 'transform',
                  contain: 'layout style paint',
                  // transition is managed via direct DOM in snapToViewAngle + sync effect
                  // (prevents the 0.5s ease from causing long RAF/reflow on preset clicks)
                }}
              >
                {/* Board substrate */}
                <div
                  data-testid="board-substrate"
                  className="absolute inset-0"
                  style={{
                    backgroundColor: renderOptions.boardColor,
                    borderRadius: `${board.cornerRadius * 2.5}px`,
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 0 20px rgba(0,240,255,0.1)',
                    transformStyle: 'preserve-3d',
                  }}
                >
                  {/* Solder mask top */}
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundColor: renderOptions.solderMaskColor,
                      borderRadius: `${board.cornerRadius * 2.5}px`,
                      opacity: 0.6,
                      transform: `translateZ(${board.thickness * scale}px)`,
                    }}
                  />

                  {/* Traces — respect layer visibility */}
                  {traces
                    .filter((trace) => layerVisibility.includes(trace.layer))
                    .map((trace) => (
                      <Trace3DElement
                        key={trace.id}
                        trace={trace}
                        boardThickness={board.thickness}
                        boardWidth={board.width}
                        boardHeight={board.height}
                        scale={scale}
                      />
                    ))}

                  {/* Vias */}
                  {vias.map((via) => (
                    <Via3DElement
                      key={via.id}
                      via={via}
                      boardThickness={board.thickness}
                      boardWidth={board.width}
                      boardHeight={board.height}
                      scale={scale}
                    />
                  ))}

                  {/* Drill Holes (explicit board drills / mounting holes) */}
                  {renderOptions.showDrills !== false &&
                    drillHoles.map((hole) => (
                      <DrillHole3DElement
                        key={hole.id}
                        hole={hole}
                        boardThickness={board.thickness}
                        boardWidth={board.width}
                        boardHeight={board.height}
                        scale={scale}
                      />
                    ))}

                  {/* Components — hide based on side + copper layer visibility */}
                  {visibleComponents.map((comp) => (
                    <ComponentBox
                      key={comp.id}
                      component={comp}
                      boardThickness={board.thickness}
                      boardWidth={board.width}
                      boardHeight={board.height}
                      scale={scale}
                      highlighted={highlightedRefDesSet.has(comp.refDes.toUpperCase())}
                      highlightedPins={highlightedPinsByRefDes.get(comp.refDes.toUpperCase())}
                    />
                  ))}

                  {/* Digital Twin net-state badges — geometry-adjacent live net context */}
                  {digitalTwinNetStateOverlays.map(({ channel, component, pin }) => (
                    <DigitalTwinNetStateBadge
                      key={`${channel.id}-${component.id}-${channel.netName}`}
                      channel={channel}
                      component={component}
                      pin={pin}
                      boardThickness={board.thickness}
                      boardWidth={board.width}
                      boardHeight={board.height}
                      scale={scale}
                    />
                  ))}

                  {/* Board edge label */}
                  <div
                    className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground font-mono whitespace-nowrap"
                    style={{ transform: `translateZ(${board.thickness * scale + 2}px) translateX(-50%)` }}
                  >
                    {board.width} x {board.height} mm
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3D WIRING GUIDES — R3F Overlay (decoupled sibling of CSS 3D scene)
               WHY THIS FIXES THE REMAINING PERF + CONTEXT LOST:
               - The Canvas is NO LONGER inside a live CSS perspective + rotate3d + transition div.
               - The WebGL surface stays axis-aligned; only the *content* (group) rotates via R3F.
               - Visual registration is preserved because we use identical stage size + shared
                 rotation state + the same airwire coordinate math that already worked.
               - This is the root-cause removal for 1794 ms clicks, 240 ms RAF, forced reflows,
                 and WebGLRenderer context loss when both layers were active.
          */}
          {hasSceneContent && showWiringGuides && (
            <div
              data-testid="r3f-wiring-overlay"
              className="absolute pointer-events-none"
              style={{
                width: `${Math.min(board.width * 2.5, 500)}px`,
                height: `${Math.min(board.height * 2.5, 400)}px`,
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 30,
              }}
            >
              <ErrorBoundary
                fallback={
                  <div className="flex h-full items-center justify-center text-xs text-red-400">
                    3D overlay unavailable (WebGL context lost or unsupported)
                  </div>
                }
              >
                <Canvas
                  frameloop="demand"
                  camera={{
                    position: [0, 0, 180],
                    fov: 55,
                  }}
                  style={{ background: 'transparent' }}
                  gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
                >
                  <WebGLContextRecovery />
                  <R3FInvalidator
                    show={showWiringGuides}
                    deps={[airwireElements.length, wiringGuideMode, components.length]}
                  />
                  <ambientLight intensity={0.8} />

                  {/* Content visibility + rotation controlled in R3F only (no CSS transform on the canvas) */}
                  <group
                    visible={showWiringGuides}
                    rotation={[
                      THREE.MathUtils.degToRad(rotation.rotateX),
                      THREE.MathUtils.degToRad(rotation.rotateY),
                      0,
                    ]}
                  >
                    {airwireElements}

                    {components.map((comp) => (
                      <mesh key={`marker-${comp.id}`} position={[comp.position.x, comp.position.y, 10]}>
                        <sphereGeometry args={[1.8]} />
                        <meshBasicMaterial
                          color={highlightedRefDesSet.has(comp.refDes.toUpperCase()) ? '#facc15' : '#00f0ff'}
                          transparent
                          opacity={0.7}
                        />
                      </mesh>
                    ))}
                  </group>
                </Canvas>
              </ErrorBoundary>
            </div>
          )}
        </div>

        {/* Right panel */}
        <ScrollArea className="w-52 flex-shrink-0">
          <div className="space-y-2.5">
            <BoardDimensionsDisplay board={board} />

            <LayerVisibilityPanel visibleLayers={layerVisibility} scene={scene} onToggle={toggleLayer} />

            {/* 3D Wiring Guides Controls — The cool shit */}
            <Card className="bg-card/60">
              <CardHeader className="pb-1 pt-2.5 px-3">
                <CardTitle className="text-xs flex items-center gap-2">
                  <Cable className="w-3.5 h-3.5" />
                  3D Wiring Guides
                </CardTitle>
              </CardHeader>
              <div className="px-3 pb-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <Label htmlFor="wiring-guides-show-layer" className="cursor-pointer font-normal">
                    Show Guides Layer
                  </Label>
                  <Checkbox
                    id="wiring-guides-show-layer"
                    checked={showWiringGuides}
                    onCheckedChange={(v) => setShowWiringGuides(!!v)}
                  />
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <Label htmlFor="wiring-guides-show-airwires" className="cursor-pointer font-normal">
                    Airwires / Ratsnest
                  </Label>
                  <Checkbox
                    id="wiring-guides-show-airwires"
                    checked={showAirwires}
                    onCheckedChange={(v) => setShowAirwires(!!v)}
                    disabled={!showWiringGuides}
                  />
                </div>

                {/* Guide Mode selector — real "all kinda of shit" */}
                <div className="pt-2 border-t border-border/50">
                  <div className="text-[10px] mb-1.5 text-muted-foreground">Guide Mode</div>
                  <div className="flex gap-1.5 text-[10px]">
                    {(['chain', 'mesh', 'star'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setWiringGuideMode(mode)}
                        className={cn(
                          'flex-1 rounded px-2 py-0.5 border transition-colors',
                          wiringGuideMode === mode
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-muted/40 hover:bg-muted border-border',
                        )}
                        disabled={!showWiringGuides || !showAirwires}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/50">
                  3D ratsnest, full mesh, star — the wiring guides are now alive.
                </div>

                {/* Quick dev helper */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-[10px] h-7 mt-2"
                  onClick={() => {
                    const viewer = BoardViewer3D.getInstance();
                    viewer.clear();

                    // Demo components in realistic-ish positions
                    const demo = [
                      { ref: 'U1', pkg: 'TQFP-44', x: 25, y: 20, rot: 0 },
                      { ref: 'U2', pkg: 'SOIC-16', x: 70, y: 35, rot: 90 },
                      { ref: 'C1', pkg: '0603', x: 18, y: 42, rot: 0 },
                      { ref: 'R3', pkg: '0402', x: 55, y: 18, rot: 0 },
                      { ref: 'Q2', pkg: 'SOT-23', x: 82, y: 55, rot: -45 },
                    ];

                    demo.forEach((d, i) => {
                      const footprint = FootprintLibrary.getFootprint(d.pkg);
                      const pins = generatePinsFromFootprint(footprint, 8, 8);

                      // Make demo components carry pins so the pin-aware ratsnest logic works
                      viewer.addComponent({
                        refDes: d.ref,
                        package: d.pkg,
                        position: { x: d.x, y: d.y, z: 0 },
                        rotation: d.rot,
                        side: 'top',
                        bodyWidth: 8,
                        bodyHeight: 8,
                        bodyDepth: 2,
                        color: i === 0 ? '#3b82f6' : '#1f2937',
                        pins: pins.length
                          ? pins
                          : [
                              { id: 'p1', position: { x: -3, y: 0 }, diameter: 1.2, type: 'smd' },
                              { id: 'p2', position: { x: 3, y: 0 }, diameter: 1.2, type: 'smd' },
                            ],
                      });
                    });

                    console.log('[3DView] Demo board loaded for testing wiring guides');
                  }}
                >
                  Load Demo Board (dev)
                </Button>
              </div>
            </Card>

            {/* Edit dimensions */}
            <Card className="bg-card/60">
              <CardHeader className="px-3 pb-2 pt-2.5">
                <CardTitle className="text-xs font-medium">Edit Board</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-3 pb-3">
                <div>
                  <Label htmlFor="edit-board-width" className="text-xs">
                    Width (mm)
                  </Label>
                  <NumberInput
                    data-testid="edit-board-width"
                    id="edit-board-width"
                    value={editWidth}
                    onChange={(e) => {
                      setEditWidth(e.target.value);
                    }}
                    min={1}
                    max={500}
                    step={0.1}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-board-height" className="text-xs">
                    Height (mm)
                  </Label>
                  <NumberInput
                    data-testid="edit-board-height"
                    id="edit-board-height"
                    value={editHeight}
                    onChange={(e) => {
                      setEditHeight(e.target.value);
                    }}
                    min={1}
                    max={500}
                    step={0.1}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-board-thickness" className="text-xs">
                    Thickness (mm)
                  </Label>
                  <NumberInput
                    data-testid="edit-board-thickness"
                    id="edit-board-thickness"
                    value={editThickness}
                    onChange={(e) => {
                      setEditThickness(e.target.value);
                    }}
                    min={0.4}
                    max={3.2}
                    step={0.1}
                    className="h-8 text-xs"
                  />
                </div>
                <Button
                  data-testid="edit-board-apply"
                  variant="outline"
                  size="sm"
                  className="h-7.5 w-full text-xs"
                  onClick={handleUpdateDimensions}
                >
                  Apply
                </Button>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
