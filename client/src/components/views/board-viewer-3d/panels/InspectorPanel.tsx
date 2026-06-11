import { X } from 'lucide-react';
import type { Component3D } from '@/lib/board-viewer-3d';

function formatMm(value: number): string {
  return `${value.toFixed(2)} mm`;
}

function formatDegrees(value: number): string {
  return `${value.toFixed(0)} deg`;
}

export function InspectorPanel({
  component,
  onClear,
}: {
  component: Component3D;
  onClear: () => void;
}) {
  return (
    <aside
      data-testid="viewer-3d-webgl-inspector"
      data-selected-component-id={component.id}
      data-selected-refdes={component.refDes}
      className="absolute bottom-3 right-3 z-10 max-h-[min(60%,22rem)] min-h-[10rem] w-[min(20rem,calc(100%-1.5rem))] min-w-[14rem] resize overflow-auto rounded-md border border-cyan-300/45 bg-background/95 p-3 text-xs shadow-xl backdrop-blur"
      aria-label={`3D inspector for ${component.refDes}`}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-foreground">{component.refDes}</h3>
          <p className="truncate text-[11px] text-muted-foreground">{component.label ?? component.package}</p>
        </div>
        <button
          type="button"
          data-testid="viewer-3d-webgl-inspector-clear"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border/70 bg-background/80 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Clear selected 3D part"
          title="Clear selected 3D part"
          onClick={onClear}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
      <dl className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1.5">
        <dt className="text-muted-foreground">Package</dt>
        <dd data-testid="viewer-3d-webgl-inspector-package" className="truncate font-mono">
          {component.package}
        </dd>
        <dt className="text-muted-foreground">Side</dt>
        <dd className="font-mono capitalize">{component.side}</dd>
        <dt className="text-muted-foreground">Position</dt>
        <dd className="font-mono">
          {formatMm(component.position.x)}, {formatMm(component.position.y)}
        </dd>
        <dt className="text-muted-foreground">Rotation</dt>
        <dd className="font-mono">{formatDegrees(component.rotation)}</dd>
        <dt className="text-muted-foreground">Body</dt>
        <dd className="font-mono">
          {formatMm(component.bodyWidth)} x {formatMm(component.bodyHeight)} x {formatMm(component.bodyDepth)}
        </dd>
        <dt className="text-muted-foreground">Pins</dt>
        <dd data-testid="viewer-3d-webgl-inspector-pin-count" className="font-mono">
          {component.pins.length}
        </dd>
        <dt className="text-muted-foreground">Datasheet</dt>
        <dd className="truncate text-muted-foreground">Not linked</dd>
        <dt className="text-muted-foreground">Supplier</dt>
        <dd className="truncate text-muted-foreground">Not linked</dd>
      </dl>
    </aside>
  );
}
