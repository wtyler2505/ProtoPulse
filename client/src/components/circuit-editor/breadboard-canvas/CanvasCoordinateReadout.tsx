/**
 * CanvasCoordinateReadout — X/Y overlay that tracks the mouse in board-space.
 *
 * Extracted from breadboard-canvas/index.tsx (audit #32, phase 2 — W1.12b).
 */

export interface CanvasCoordinateReadoutProps {
  mouseBoardPos: { x: number; y: number } | null;
}

export function CanvasCoordinateReadout({ mouseBoardPos }: CanvasCoordinateReadoutProps) {
  if (!mouseBoardPos) {
    return null;
  }
  return (
    <div
      className="absolute bottom-3 right-3 z-10 bg-card/70 backdrop-blur-sm border border-border px-2 py-1 pointer-events-none select-none"
      data-testid="coordinate-readout"
    >
      <span className="text-[11px] font-mono tabular-nums text-[var(--color-editor-accent)]">
        X: {mouseBoardPos.x} &nbsp; Y: {mouseBoardPos.y}
      </span>
    </div>
  );
}
