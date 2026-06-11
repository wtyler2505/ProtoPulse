import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Box,
  ChevronDown,
  ChevronUp,
  FlipVertical2,
  Home,
  MoveHorizontal,
  RotateCcw,
  Ruler,
  Scissors,
  Trash2,
} from 'lucide-react';
import type { CameraViewPreset } from '../scene/CameraControlsRig';
import { formatMeasurementDistance } from '../scene/measurement';

interface SceneToolsPanelProps {
  measureActive: boolean;
  measurePending: boolean;
  measureSegmentCount: number;
  latestMeasureDistanceMm: number | null;
  sectionEnabled: boolean;
  sectionConstant: number;
  sectionRange: { min: number; max: number };
  exploded: boolean;
  explodeProgress: number;
  explodeAnimating: boolean;
  cameraPreset: CameraViewPreset;
  cameraStatus: string;
  onToggleMeasure: () => void;
  onClearMeasures: () => void;
  onToggleSection: () => void;
  onSetSectionConstant: (constant: number) => void;
  onToggleExploded: () => void;
  onCameraPreset: (preset: CameraViewPreset | 'flip') => void;
}

export function SceneToolsPanel({
  measureActive,
  measurePending,
  measureSegmentCount,
  latestMeasureDistanceMm,
  sectionEnabled,
  sectionConstant,
  sectionRange,
  exploded,
  explodeProgress,
  explodeAnimating,
  cameraPreset,
  cameraStatus,
  onToggleMeasure,
  onClearMeasures,
  onToggleSection,
  onSetSectionConstant,
  onToggleExploded,
  onCameraPreset,
}: SceneToolsPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const measureState = measureActive ? (measurePending ? 'Point A' : 'Armed') : 'Off';
  const latestDistance = latestMeasureDistanceMm == null ? '--' : formatMeasurementDistance(latestMeasureDistanceMm);

  return (
    <section
      data-testid="viewer-3d-webgl-tools-panel"
      data-measure-active={measureActive ? 'true' : 'false'}
      data-section-enabled={sectionEnabled ? 'true' : 'false'}
      data-exploded={exploded ? 'true' : 'false'}
      className="absolute right-3 top-24 z-10 max-h-[min(68%,28rem)] w-[min(18rem,calc(100%-1.5rem))] min-w-[14rem] resize overflow-auto rounded-md border border-border/70 bg-background/95 text-xs shadow-xl backdrop-blur"
      aria-label="WebGL 3D scene tools"
    >
      <div className="sticky top-0 flex items-center justify-between gap-2 border-b border-border/60 bg-background/95 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Ruler className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold leading-tight">Tools</h3>
            <p className="truncate text-[10px] text-muted-foreground">
              {measureSegmentCount} measure{measureSegmentCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <button
          type="button"
          data-testid="viewer-3d-webgl-tools-panel-collapse"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border/70 bg-background/80 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={collapsed ? 'Expand WebGL tools' : 'Collapse WebGL tools'}
          title={collapsed ? 'Expand tools' : 'Collapse tools'}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
      </div>
      {!collapsed && (
        <div className="space-y-2 p-3">
          <div data-testid="viewer-3d-webgl-camera-row" className="rounded border border-border/45 bg-muted/20 p-2">
            <div className="mb-2 flex items-center gap-2">
              <Box className="h-3.5 w-3.5 shrink-0 text-cyan-300" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">Camera</div>
                <div data-testid="viewer-3d-webgl-camera-panel-status" className="truncate text-[10px] text-muted-foreground">
                  {cameraStatus}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-6 gap-1">
              <button
                type="button"
                data-testid="viewer-3d-webgl-camera-home"
                data-active={cameraPreset === 'home' ? 'true' : 'false'}
                className="inline-flex h-7 items-center justify-center rounded border border-border/70 bg-background/80 text-muted-foreground hover:bg-muted hover:text-foreground data-[active=true]:border-cyan-300/60 data-[active=true]:text-cyan-200"
                aria-label="Restore WebGL home camera"
                title="Home camera"
                onClick={() => onCameraPreset('home')}
              >
                <Home className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                data-testid="viewer-3d-webgl-camera-iso"
                data-active={cameraPreset === 'iso' ? 'true' : 'false'}
                className="inline-flex h-7 items-center justify-center rounded border border-border/70 bg-background/80 text-muted-foreground hover:bg-muted hover:text-foreground data-[active=true]:border-cyan-300/60 data-[active=true]:text-cyan-200"
                aria-label="Set WebGL camera to iso view"
                title="Iso view"
                onClick={() => onCameraPreset('iso')}
              >
                <Box className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                data-testid="viewer-3d-webgl-camera-top"
                data-active={cameraPreset === 'top' ? 'true' : 'false'}
                className="inline-flex h-7 items-center justify-center rounded border border-border/70 bg-background/80 text-muted-foreground hover:bg-muted hover:text-foreground data-[active=true]:border-cyan-300/60 data-[active=true]:text-cyan-200"
                aria-label="Set WebGL camera to top view"
                title="Top view"
                onClick={() => onCameraPreset('top')}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                data-testid="viewer-3d-webgl-camera-bottom"
                data-active={cameraPreset === 'bottom' ? 'true' : 'false'}
                className="inline-flex h-7 items-center justify-center rounded border border-border/70 bg-background/80 text-muted-foreground hover:bg-muted hover:text-foreground data-[active=true]:border-cyan-300/60 data-[active=true]:text-cyan-200"
                aria-label="Set WebGL camera to bottom view"
                title="Bottom view"
                onClick={() => onCameraPreset('bottom')}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                data-testid="viewer-3d-webgl-camera-front"
                data-active={cameraPreset === 'front' ? 'true' : 'false'}
                className="inline-flex h-7 items-center justify-center rounded border border-border/70 bg-background/80 text-muted-foreground hover:bg-muted hover:text-foreground data-[active=true]:border-cyan-300/60 data-[active=true]:text-cyan-200"
                aria-label="Set WebGL camera to front view"
                title="Front view"
                onClick={() => onCameraPreset('front')}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                data-testid="viewer-3d-webgl-camera-flip"
                className="inline-flex h-7 items-center justify-center rounded border border-border/70 bg-background/80 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Flip WebGL camera between top and bottom"
                title="Flip camera"
                onClick={() => onCameraPreset('flip')}
              >
                <FlipVertical2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div data-testid="viewer-3d-webgl-explode-row" className="rounded border border-border/45 bg-muted/20 p-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="viewer-3d-webgl-explode-toggle"
                data-active={exploded ? 'true' : 'false'}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border/70 bg-background/80 text-muted-foreground hover:bg-muted hover:text-foreground data-[active=true]:border-cyan-300/60 data-[active=true]:text-cyan-200"
                aria-label={exploded ? 'Collapse WebGL exploded view' : 'Explode WebGL board layers'}
                title={exploded ? 'Collapse layers' : 'Explode layers'}
                onClick={onToggleExploded}
              >
                <Box className="h-3.5 w-3.5" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">Explode</div>
                <div data-testid="viewer-3d-webgl-explode-status" className="font-mono text-[10px] text-muted-foreground">
                  {Math.round(explodeProgress * 100)}%{explodeAnimating ? ' moving' : ''}
                </div>
              </div>
            </div>
          </div>
          <div className="rounded border border-border/45 bg-muted/20 p-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="viewer-3d-webgl-measure-toggle"
                data-active={measureActive ? 'true' : 'false'}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border/70 bg-background/80 text-muted-foreground hover:bg-muted hover:text-foreground data-[active=true]:border-cyan-300/60 data-[active=true]:text-cyan-200"
                aria-label={measureActive ? 'Disable WebGL measurement' : 'Enable WebGL measurement'}
                title={measureActive ? 'Disable measure' : 'Enable measure'}
                onClick={onToggleMeasure}
              >
                <Ruler className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                data-testid="viewer-3d-webgl-measure-clear"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border/70 bg-background/80 text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45"
                aria-label="Clear WebGL measurements"
                title="Clear measurements"
                disabled={measureSegmentCount === 0 && !measurePending}
                onClick={onClearMeasures}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">Measure</div>
                <div
                  data-testid="viewer-3d-webgl-measure-status"
                  className="truncate font-mono text-[10px] text-muted-foreground"
                >
                  {measureState} | {latestDistance}
                </div>
              </div>
            </div>
          </div>
          <div data-testid="viewer-3d-webgl-section-row" className="rounded border border-border/45 bg-muted/20 p-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="viewer-3d-webgl-section-toggle"
                data-active={sectionEnabled ? 'true' : 'false'}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border/70 bg-background/80 text-muted-foreground hover:bg-muted hover:text-foreground data-[active=true]:border-cyan-300/60 data-[active=true]:text-cyan-200"
                aria-label={sectionEnabled ? 'Disable WebGL section plane' : 'Enable WebGL section plane'}
                title={sectionEnabled ? 'Disable section' : 'Enable section'}
                onClick={onToggleSection}
              >
                <Scissors className="h-3.5 w-3.5" />
              </button>
              <MoveHorizontal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">Section</div>
                <div className="font-mono text-[10px] text-muted-foreground">{sectionConstant.toFixed(1)} mm</div>
              </div>
            </div>
            <input
              data-testid="viewer-3d-webgl-section-slider"
              className="mt-2 h-2 w-full accent-cyan-300"
              type="range"
              min={sectionRange.min}
              max={sectionRange.max}
              step={0.5}
              value={sectionConstant}
              aria-label="WebGL section plane position"
              disabled={!sectionEnabled}
              onChange={(event) => onSetSectionConstant(Number(event.target.value))}
            />
          </div>
        </div>
      )}
    </section>
  );
}
