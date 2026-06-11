import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Eye, EyeOff, Layers } from 'lucide-react';
import type { BoardScene, LayerType3D } from '@/lib/board-viewer-3d';
import {
  getLayerOpacity,
  getLayerTestIdSegment,
  isLayerVisible,
  WEBGL_LAYER_LABELS,
  type WebGLLayerSettings,
} from '../layer-settings';

interface WebGLLayerPanelProps {
  layers: BoardScene['layers'];
  settings: WebGLLayerSettings;
  onToggleLayer: (layer: LayerType3D) => void;
  onSetLayerOpacity: (layer: LayerType3D, opacity: number) => void;
}

function clampOpacity(value: number): number {
  return Math.min(1, Math.max(0.15, value));
}

export function LayerPanel({ layers, settings, onToggleLayer, onSetLayerOpacity }: WebGLLayerPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const visibleCount = useMemo(
    () => layers.filter((layer) => isLayerVisible(settings, layer.type)).length,
    [layers, settings],
  );

  return (
    <section
      data-testid="viewer-3d-webgl-layer-panel"
      data-visible-layer-count={visibleCount}
      className="absolute left-3 top-3 z-10 max-h-[min(70%,26rem)] w-[min(20rem,calc(100%-1.5rem))] min-w-[15rem] resize overflow-auto rounded-md border border-border/70 bg-background/95 text-xs shadow-xl backdrop-blur"
      aria-label="WebGL 3D layer controls"
    >
      <div className="sticky top-0 flex items-center justify-between gap-2 border-b border-border/60 bg-background/95 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold leading-tight">Layers</h3>
            <p className="truncate text-[10px] text-muted-foreground">
              {visibleCount}/{layers.length} visible
            </p>
          </div>
        </div>
        <button
          type="button"
          data-testid="viewer-3d-webgl-layer-panel-collapse"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border/70 bg-background/80 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={collapsed ? 'Expand WebGL layer controls' : 'Collapse WebGL layer controls'}
          title={collapsed ? 'Expand layer controls' : 'Collapse layer controls'}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
      </div>
      {!collapsed && (
        <div className="space-y-2 p-3">
          {layers.map((layer) => {
            const segment = getLayerTestIdSegment(layer.type);
            const visible = isLayerVisible(settings, layer.type);
            const opacity = getLayerOpacity(settings, layer.type);
            return (
              <div
                key={layer.type}
                data-testid={`viewer-3d-webgl-layer-row-${segment}`}
                data-visible={visible ? 'true' : 'false'}
                data-opacity={opacity.toFixed(2)}
                className="rounded border border-border/45 bg-muted/20 p-2"
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid={`viewer-3d-webgl-layer-toggle-${segment}`}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border/70 bg-background/80 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={`${visible ? 'Hide' : 'Show'} ${WEBGL_LAYER_LABELS[layer.type]}`}
                    title={`${visible ? 'Hide' : 'Show'} ${WEBGL_LAYER_LABELS[layer.type]}`}
                    onClick={() => onToggleLayer(layer.type)}
                  >
                    {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                  <span
                    className="h-3 w-3 shrink-0 rounded-sm border border-white/20"
                    style={{ backgroundColor: layer.color }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{WEBGL_LAYER_LABELS[layer.type]}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{Math.round(opacity * 100)}%</div>
                  </div>
                </div>
                <input
                  data-testid={`viewer-3d-webgl-layer-opacity-${segment}`}
                  className="mt-2 h-2 w-full accent-cyan-300"
                  type="range"
                  min={15}
                  max={100}
                  step={5}
                  value={Math.round(opacity * 100)}
                  aria-label={`${WEBGL_LAYER_LABELS[layer.type]} opacity`}
                  disabled={!visible}
                  onChange={(event) => onSetLayerOpacity(layer.type, clampOpacity(Number(event.target.value) / 100))}
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
