import { memo } from 'react';
import { cn } from '@/lib/utils';
import { radialSlotMeta, type RadialSlot } from '@/lib/radial-menu-actions';
import type { RadialMenuPosition } from '@/components/ui/RadialMenu';

export interface RadialMarkingPreviewState {
  origin: RadialMenuPosition;
  current: RadialMenuPosition;
  slot: RadialSlot;
  commandId?: string;
  label?: string;
  disabled?: boolean;
}

interface RadialMarkingPreviewProps {
  preview: RadialMarkingPreviewState;
}

function RadialMarkingPreview({ preview }: RadialMarkingPreviewProps) {
  const slotMeta = radialSlotMeta[preview.slot];
  const dx = preview.current.x - preview.origin.x;
  const dy = preview.current.y - preview.origin.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const unitX = dx / distance;
  const unitY = dy / distance;
  const endX = preview.current.x - unitX * 10;
  const endY = preview.current.y - unitY * 10;
  const label = preview.label ?? 'No command';

  return (
    <div
      data-testid="radial-marking-preview"
      className="pointer-events-none fixed inset-0 z-[9998] [contain:layout_paint_style]"
      aria-hidden="true"
    >
      <svg className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <filter id="radial-marking-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="rgba(34,211,238,0.55)" />
          </filter>
        </defs>
        <line
          x1={preview.origin.x}
          y1={preview.origin.y}
          x2={endX}
          y2={endY}
          className={cn(preview.disabled ? 'stroke-muted-foreground/70' : 'stroke-cyan-300')}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray="8 7"
          filter="url(#radial-marking-glow)"
        />
        <circle
          cx={preview.origin.x}
          cy={preview.origin.y}
          r={5}
          className="fill-background stroke-cyan-200"
          strokeWidth={2}
        />
        <circle
          cx={preview.current.x}
          cy={preview.current.y}
          r={9}
          className={cn(preview.disabled ? 'fill-muted stroke-muted-foreground' : 'fill-cyan-300 stroke-background')}
          strokeWidth={2}
        />
      </svg>
      <div
        data-testid="radial-marking-chip"
        className={cn(
          'fixed flex min-w-28 max-w-44 translate-x-3 translate-y-3 items-center gap-2 rounded border px-2 py-1.5 text-xs shadow-2xl backdrop-blur-xl',
          preview.disabled
            ? 'border-border bg-background/90 text-muted-foreground'
            : 'border-cyan-300/50 bg-background/90 text-cyan-50 shadow-cyan-950/40',
        )}
        style={{
          left: preview.current.x,
          top: preview.current.y,
        }}
      >
        <span className="rounded border border-cyan-300/40 bg-cyan-400/15 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-cyan-100">
          {slotMeta.direction}
        </span>
        <span data-testid="radial-marking-label" className="min-w-0 truncate font-semibold">
          {label}
        </span>
      </div>
    </div>
  );
}

export default memo(RadialMarkingPreview);
