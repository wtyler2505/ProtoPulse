/**
 * LayerStackPanel — Board stackup cross-section visualization
 *
 * Displays all copper layers and dielectrics from the BoardStackup singleton,
 * shows total thickness, surface finish, layer count, and provides quick
 * preset buttons for common stackup configurations.
 *
 * Copper layers are clickable when they map to an ActiveLayer (front/back);
 * inner layers are displayed but not selectable as active.
 */

import { memo, useState } from 'react';
import { ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { useBoardStackup } from '@/lib/board-stackup';
import type { StackupLayer, DielectricLayer, LayerType } from '@/lib/board-stackup';
import type { ActiveLayer } from './LayerManager';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LayerStackPanelProps {
  activeLayer: ActiveLayer;
  onLayerSelect: (layer: ActiveLayer) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map a stackup copper layer to an ActiveLayer based on its position.
 * All copper layers are selectable: front, back, and inner layers.
 */
function stackupLayerToActiveLayer(
  layer: StackupLayer,
  allLayers: StackupLayer[],
): ActiveLayer | null {
  if (layer.type !== 'signal' && layer.type !== 'power' && layer.type !== 'ground' && layer.type !== 'mixed') {
    return null;
  }
  const sorted = [...allLayers].sort((a, b) => a.order - b.order);
  if (sorted.length === 0) {
    return null;
  }
  const idx = sorted.findIndex((l) => l.id === layer.id);
  if (idx === -1) {
    return null;
  }
  if (idx === 0) {
    return 'front';
  }
  if (idx === sorted.length - 1) {
    return 'back';
  }
  return `In${String(idx)}.Cu`;
}

/** Tailwind class for the layer-type color dot. */
function layerTypeColor(type: LayerType): string {
  switch (type) {
    case 'signal':
      return 'bg-yellow-500';
    case 'ground':
      return 'bg-green-500';
    case 'power':
      return 'bg-red-500';
    case 'mixed':
      return 'bg-purple-500';
  }
}

/** Format a thickness value for display. */
function formatThickness(value: number): string {
  // Show one decimal place consistently
  return `${value.toFixed(1)} mil`;
}

// ---------------------------------------------------------------------------
// Interleaved layer type — merges copper + dielectric by order
// ---------------------------------------------------------------------------

type InterleavedEntry =
  | { kind: 'copper'; data: StackupLayer; order: number }
  | { kind: 'dielectric'; data: DielectricLayer; order: number };

function interleave(
  layers: StackupLayer[],
  dielectrics: DielectricLayer[],
): InterleavedEntry[] {
  const entries: InterleavedEntry[] = [
    ...layers.map((l) => ({ kind: 'copper' as const, data: l, order: l.order })),
    ...dielectrics.map((d) => ({ kind: 'dielectric' as const, data: d, order: d.order })),
  ];
  entries.sort((a, b) => a.order - b.order);
  return entries;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const LayerStackPanel = memo(function LayerStackPanel({
  activeLayer,
  onLayerSelect,
  collapsed: controlledCollapsed,
  onToggleCollapse,
}: LayerStackPanelProps) {
  const {
    layers,
    dielectrics,
    totalThickness,
    surfaceFinish,
    presets,
    applyPreset,
  } = useBoardStackup();

  // Internal collapse state when not controlled externally
  const [internalCollapsed, setInternalCollapsed] = useState(false);

  const isCollapsed = controlledCollapsed ?? internalCollapsed;

  const handleToggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed((prev) => !prev);
    }
  };

  const interleaved = interleave(layers, dielectrics);
  const isEmpty = layers.length === 0;

  return (
    <div
      data-testid="layer-stack-panel"
      className={cn(
        'rounded-lg border border-border bg-card/95 backdrop-blur-sm',
        'text-card-foreground shadow-md',
        'w-64 select-none',
      )}
    >
      {/* Header */}
      <button
        data-testid="layer-stack-header"
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2',
          'text-sm font-medium',
          'hover:bg-accent/50 rounded-t-lg transition-colors',
        )}
        onClick={handleToggle}
      >
        <span data-testid="layer-stack-toggle" className="flex items-center">
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </span>
        <Layers className="h-4 w-4 text-primary" />
        <span>Layer Stack</span>
      </button>

      {/* Body — hidden when collapsed */}
      {!isCollapsed && (
        <div data-testid="layer-stack-body" className="px-3 pb-3">
          {isEmpty ? (
            /* Empty state */
            <div data-testid="layer-stack-empty" className="py-4 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                No stackup configured
              </p>
              <button
                data-testid="empty-apply-preset"
                className={cn(
                  'rounded-md border border-primary/40 px-3 py-1.5',
                  'text-xs text-primary hover:bg-primary/10 transition-colors',
                )}
                onClick={() => {
                  applyPreset('2-layer');
                }}
              >
                Apply 2-layer preset
              </button>
            </div>
          ) : (
            <>
              {/* Layer list */}
              <div className="space-y-0.5 mb-2">
                {interleaved.map((entry) => {
                  if (entry.kind === 'copper') {
                    const layer = entry.data;
                    const mappedActive = stackupLayerToActiveLayer(layer, layers);
                    const isActive = mappedActive !== null && mappedActive === activeLayer;
                    const isSelectable = mappedActive !== null;

                    return (
                      <div
                        key={layer.id}
                        data-testid={`copper-layer-${layer.id}`}
                        className={cn(
                          'flex items-center gap-2 rounded px-2 py-1 text-xs',
                          isSelectable && 'cursor-pointer hover:bg-accent/50',
                          !isSelectable && 'opacity-70',
                          isActive && 'bg-primary/10 border-l-2 border-primary',
                          !isActive && 'border-l-2 border-transparent',
                        )}
                        onClick={() => {
                          if (mappedActive !== null) {
                            onLayerSelect(mappedActive);
                          }
                        }}
                      >
                        {/* Type dot */}
                        <span
                          data-testid={`layer-type-dot-${layer.id}`}
                          className={cn(
                            'inline-block h-2.5 w-2.5 rounded-full shrink-0',
                            layerTypeColor(layer.type),
                          )}
                        />
                        {/* Name */}
                        <span className="flex-1 truncate font-medium">
                          {layer.name}
                        </span>
                        {/* Copper weight */}
                        <span className="text-muted-foreground shrink-0">
                          {layer.copperWeight}
                        </span>
                        {/* Thickness */}
                        <span className="text-muted-foreground shrink-0 w-14 text-right">
                          {formatThickness(layer.thickness)}
                        </span>
                      </div>
                    );
                  }

                  // Dielectric
                  const diel = entry.data;
                  return (
                    <div
                      key={diel.id}
                      data-testid={`dielectric-layer-${diel.id}`}
                      className={cn(
                        'flex items-center gap-2 rounded px-2 py-0.5 text-xs',
                        'opacity-60 border-l-2 border-transparent',
                      )}
                    >
                      {/* Hatched pattern indicator */}
                      <span className="inline-block h-2.5 w-2.5 rounded-sm shrink-0 bg-amber-800/50 border border-amber-700/30" />
                      {/* Name */}
                      <span className="flex-1 truncate text-muted-foreground">
                        {diel.name}
                      </span>
                      {/* Material */}
                      <span className="text-muted-foreground shrink-0">
                        {diel.material}
                      </span>
                      {/* Thickness */}
                      <span className="text-muted-foreground shrink-0 w-14 text-right">
                        {formatThickness(diel.thickness)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Divider */}
              <div className="border-t border-border my-2" />

              {/* Summary */}
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                <span data-testid="total-thickness">
                  Total: {totalThickness} mil
                </span>
                <span data-testid="layer-count">
                  {layers.length}-layer
                </span>
              </div>
              <div className="text-xs text-muted-foreground mb-3">
                <span data-testid="surface-finish">
                  Surface: {surfaceFinish}
                </span>
              </div>

              {/* Preset buttons */}
              <div className="flex gap-1">
                {presets.map((preset) => (
                  <button
                    key={preset.name}
                    data-testid={`preset-${preset.name}`}
                    className={cn(
                      'flex-1 rounded border border-border px-2 py-1',
                      'text-xs text-muted-foreground',
                      'hover:bg-accent/50 hover:text-foreground transition-colors',
                    )}
                    onClick={() => {
                      applyPreset(preset.name);
                    }}
                    title={preset.description}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
});
