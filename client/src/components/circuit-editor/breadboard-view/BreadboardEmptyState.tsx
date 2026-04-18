/**
 * BreadboardEmptyState — shown when no circuits exist yet in the breadboard view.
 *
 * Extracted verbatim from BreadboardView.tsx (audit #29).
 * Contains: hero card with 3 action buttons (Create wiring canvas,
 * Expand from architecture, Open schematic).
 */

import { Button } from '@/components/ui/button';
import { CircuitBoard, PanelLeftOpen, Sparkles } from 'lucide-react';

export interface BreadboardEmptyStateProps {
  onCreateCircuit: () => void;
  isCreating: boolean;
  onExpandArchitecture: () => void;
  isExpanding: boolean;
  onOpenSchematic: () => void;
}

export function BreadboardEmptyState({
  onCreateCircuit,
  isCreating,
  onExpandArchitecture,
  isExpanding,
  onOpenSchematic,
}: BreadboardEmptyStateProps) {
  return (
    <div className="flex flex-1 items-center justify-center p-6" data-testid="breadboard-empty">
      <div className="max-w-2xl rounded-[28px] border border-primary/15 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),rgba(15,23,42,0.78)_55%,rgba(15,23,42,0.96))] p-8 text-center shadow-[0_40px_120px_rgba(0,0,0,0.34)]">
        <span className="inline-flex h-16 w-16 items-center justify-center rounded-[22px] border border-primary/20 bg-background/50 text-primary">
          <CircuitBoard className="h-8 w-8" />
        </span>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/85">Breadboard Lab</p>
        <h3 className="mt-2 text-2xl font-semibold text-foreground">Build the wiring canvas first, then start placing parts immediately</h3>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          ProtoPulse can already render interactive breadboard parts and wires here. This screen now lets you create the canvas directly, drag starter parts, and then graduate into project-linked components with real pin-aware metadata.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button
            type="button"
            data-testid="button-create-first-breadboard-circuit"
            onClick={onCreateCircuit}
            disabled={isCreating}
            className="gap-2"
          >
            <CircuitBoard className="h-4 w-4" />
            {isCreating ? 'Creating…' : 'Create wiring canvas'}
          </Button>
          <Button
            type="button"
            variant="outline"
            data-testid="button-expand-architecture-to-breadboard"
            onClick={onExpandArchitecture}
            disabled={isExpanding}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            {isExpanding ? 'Expanding…' : 'Expand from architecture'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            data-testid="button-open-schematic-from-empty-breadboard"
            onClick={onOpenSchematic}
            className="gap-2"
          >
            <PanelLeftOpen className="h-4 w-4" />
            Open schematic
          </Button>
        </div>
      </div>
    </div>
  );
}
