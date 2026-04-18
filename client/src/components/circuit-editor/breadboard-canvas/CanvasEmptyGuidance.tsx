/**
 * CanvasEmptyGuidance — empty-state banner (BB-02 / BB-03).
 *
 * Extracted from breadboard-canvas/index.tsx (audit #32, phase 2 — W1.12b).
 */

import { Info } from 'lucide-react';
import type { CircuitInstanceRow } from '@shared/schema';

export interface CanvasEmptyGuidanceProps {
  instances: CircuitInstanceRow[] | undefined;
}

export function CanvasEmptyGuidance({ instances }: CanvasEmptyGuidanceProps) {
  const hasPlaced = !!instances && instances.filter((i) => i.breadboardX != null).length > 0;
  if (hasPlaced) {
    return null;
  }
  return (
    <div
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-card/80 backdrop-blur-xl border border-border px-4 py-2.5 shadow-lg max-w-sm text-center"
      data-testid="breadboard-empty-guidance"
    >
      <div className="flex items-center gap-2 justify-center mb-1">
        <Info className="w-4 h-4 text-primary shrink-0" />
        <span className="text-xs font-medium text-foreground">Start Wiring</span>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Drag a starter part or a project library component onto the board, then use the <strong>Wire tool (2)</strong> to connect real pin rows. <strong>Double-click</strong> finishes a wire run.
      </p>
    </div>
  );
}
