/**
 * BoardViewer3DView — 3D PCB board visualization using CSS 3D transforms.
 * Shows board, components with real footprint data, traces, vias,
 * camera angle buttons, layer visibility toggles, and dimensions.
 */

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { useProjectBoard } from '@/hooks/useProjectBoard';
import {
  Box,
  Eye,
  EyeOff,
  RotateCcw,
  Ruler,
  Download,
  Upload,
} from 'lucide-react';
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
import type { ViewAngle, LayerType3D, Component3D, BoardDimensions, BoardScene, Via3D, Trace3D } from '@/lib/board-viewer-3d';
import { FootprintLibrary } from '@/lib/pcb/footprint-library';

// ---------------------------------------------------------------------------
// Package height database (mm above board surface)
// ---------------------------------------------------------------------------

export const PACKAGE_HEIGHTS: Record<string, number> = {
  'DIP-8': 5.0, 'DIP-14': 5.0, 'DIP-16': 5.0, 'DIP-28': 5.0, 'DIP-40': 5.0,
  'SOIC-8': 1.75, 'SOIC-14': 1.75, 'SOIC-16': 1.75,
  'SOT-23': 1.1, 'SOT-23-5': 1.1, 'SOT-23-6': 1.1,
  'QFP-44': 1.6, 'QFP-64': 1.6, 'QFP-100': 1.6, 'QFP-144': 1.6,
  'QFN-16': 0.85, 'QFN-32': 0.85, 'QFN-48': 0.85,
  'SOP-8': 1.75,
  'TO-220': 4.5, 'TO-92': 4.5, 'TO-263': 2.5,
  '0402': 0.5, '0603': 0.6, '0805': 0.7, '1206': 0.8,
  'SOD-123': 1.1, 'SOD-323': 0.6,
};

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

// ---------------------------------------------------------------------------
// ComponentBox — CSS 3D component box with real footprint data
// ---------------------------------------------------------------------------

interface ComponentBoxProps {
  component: Component3D;
  boardThickness: number;
  boardWidth: number;
  boardHeight: number;
  scale: number;
}

const ComponentBox = memo(function ComponentBox({
  component,
  boardThickness,
  boardWidth,
  boardHeight,
  scale,
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

  return (
    <div
      data-testid={`component-3d-${component.id}`}
      className="absolute"
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
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundColor: color,
        opacity: 0,
        transformStyle: 'preserve-3d',
      }}
    >
      {trace.points.slice(0, -1).map((pt, i) => {
        const next = trace.points[i + 1];
        if (!next) { return null; }

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
          left: `${(outerPctW - drillPctW) / outerPctW * 50}%`,
          top: `${(outerPctH - drillPctH) / outerPctH * 50}%`,
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
            <span data-testid="board-width" className="font-mono">{board.width}mm</span>
          </div>
          <div>
            <span className="text-muted-foreground">Height: </span>
            <span data-testid="board-height" className="font-mono">{board.height}mm</span>
          </div>
          <div>
            <span className="text-muted-foreground">Thickness: </span>
            <span data-testid="board-thickness" className="font-mono">{board.thickness}mm</span>
          </div>
          <div>
            <span className="text-muted-foreground">Radius: </span>
            <span data-testid="board-corner-radius" className="font-mono">{board.cornerRadius}mm</span>
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

const LayerVisibilityPanel = memo(function LayerVisibilityPanel({ visibleLayers, scene, onToggle }: LayerVisibilityPanelProps) {
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
                onCheckedChange={() => { onToggle(layerType); }}
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
// BoardViewer3DView
// ---------------------------------------------------------------------------

export default function BoardViewer3DView() {
  const {
    board,
    setBoard,
    components,
    vias,
    traces,
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
  const { board: projectBoard, updateBoard } = useProjectBoard(projectId);

  // Sync server board -> 3D singleton whenever the server row changes.
  useEffect(() => {
    setBoard({
      width: projectBoard.widthMm,
      height: projectBoard.heightMm,
      thickness: projectBoard.thicknessMm,
      cornerRadius: projectBoard.cornerRadiusMm,
    });
  }, [
    projectBoard.widthMm,
    projectBoard.heightMm,
    projectBoard.thicknessMm,
    projectBoard.cornerRadiusMm,
    setBoard,
  ]);

  const [viewAngle, setViewAngle] = useState<ViewAngle>('isometric');
  const [editWidth, setEditWidth] = useState(String(board.width));
  const [editHeight, setEditHeight] = useState(String(board.height));
  const [editThickness, setEditThickness] = useState(String(board.thickness));

  // Keep the edit fields in sync with the server-side board as it updates
  // from other views (e.g. user resized in PCBLayoutView).
  useEffect(() => {
    setEditWidth(String(projectBoard.widthMm));
    setEditHeight(String(projectBoard.heightMm));
    setEditThickness(String(projectBoard.thicknessMm));
  }, [projectBoard.widthMm, projectBoard.heightMm, projectBoard.thicknessMm]);

  const rotation = VIEW_ROTATIONS[viewAngle];
  const scale = 2; // px per mm for CSS 3D depth

  const toggleLayer = useCallback((layer: LayerType3D) => {
    const viewer = BoardViewer3D.getInstance();
    const isVisible = viewer.getVisibleLayers().includes(layer);
    viewer.setLayerVisible(layer, !isVisible);
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
        file.text().then((text) => {
          importScene(text);
        }).catch(() => {
          // ignore read errors
        });
      }
    };
    input.click();
  }, [importScene]);

  return (
    <div data-testid="board-viewer-3d-view" className="flex flex-col h-full gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Box className="w-5 h-5 text-primary" />
          <h2 data-testid="viewer-title" className="text-lg font-semibold">3D Board Viewer</h2>
          <Badge data-testid="component-count" variant="secondary">{components.length} components</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button data-testid="viewer-export" variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1" />
            Export
          </Button>
          <Button data-testid="viewer-import" variant="outline" size="sm" onClick={handleImport}>
            <Upload className="w-4 h-4 mr-1" />
            Import
          </Button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* 3D Viewport */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {/* Camera angle buttons */}
          <div data-testid="view-angle-buttons" className="flex items-center gap-1 flex-wrap">
            {VIEW_ANGLES.map((angle) => (
              <Button
                key={angle}
                data-testid={`view-angle-${angle}`}
                variant={viewAngle === angle ? 'default' : 'outline'}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => { setViewAngle(angle); }}
              >
                {VIEW_ROTATIONS[angle].label}
              </Button>
            ))}
            <Button
              data-testid="view-reset"
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => { setViewAngle('isometric'); }}
            >
              <RotateCcw className="w-3 h-3" />
            </Button>
          </div>

          {/* 3D Scene Container */}
          <div
            data-testid="board-3d-viewport"
            className="flex-1 rounded-lg border border-border/50 overflow-hidden flex items-center justify-center"
            style={{ backgroundColor: renderOptions.backgroundColor, perspective: '800px' }}
          >
            <div
              data-testid="board-3d-scene"
              className="relative"
              style={{
                width: `${Math.min(board.width * 2.5, 500)}px`,
                height: `${Math.min(board.height * 2.5, 400)}px`,
                transformStyle: 'preserve-3d',
                transform: `rotateX(${rotation.rotateX}deg) rotateY(${rotation.rotateY}deg)`,
                transition: 'transform 0.5s ease',
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

                {/* Traces */}
                {traces.map((trace) => (
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

                {/* Components */}
                {components.map((comp) => (
                  <ComponentBox
                    key={comp.id}
                    component={comp}
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
          </div>
        </div>

        {/* Right panel */}
        <ScrollArea className="w-56 flex-shrink-0">
          <div className="space-y-3">
            <BoardDimensionsDisplay board={board} />

            <LayerVisibilityPanel
              visibleLayers={layerVisibility}
              scene={scene}
              onToggle={toggleLayer}
            />

            {/* Edit dimensions */}
            <Card className="bg-card/60">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs font-medium">Edit Board</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-2">
                <div>
                  <Label className="text-xs">Width (mm)</Label>
                  <NumberInput
                    data-testid="edit-board-width"
                    value={editWidth}
                    onChange={(e) => { setEditWidth(e.target.value); }}
                    min={1}
                    max={500}
                    step={0.1}
                    className="h-7 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Height (mm)</Label>
                  <NumberInput
                    data-testid="edit-board-height"
                    value={editHeight}
                    onChange={(e) => { setEditHeight(e.target.value); }}
                    min={1}
                    max={500}
                    step={0.1}
                    className="h-7 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Thickness (mm)</Label>
                  <NumberInput
                    data-testid="edit-board-thickness"
                    value={editThickness}
                    onChange={(e) => { setEditThickness(e.target.value); }}
                    min={0.4}
                    max={3.2}
                    step={0.1}
                    className="h-7 text-xs"
                  />
                </div>
                <Button
                  data-testid="edit-board-apply"
                  variant="outline"
                  size="sm"
                  className="w-full h-7 text-xs"
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
