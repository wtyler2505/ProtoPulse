/**
 * WireColorMenu — right-click wire color picker (BL-0591).
 *
 * Extracted from breadboard-canvas/index.tsx (audit #32, phase 2 — W1.12b).
 */

import { WIRE_COLOR_PRESETS } from '@/lib/circuit-editor/breadboard-model';

export interface WireColorMenuProps {
  wireId: number | null;
  position: { x: number; y: number } | null;
  onColorChange: (wireId: number, color: string) => void;
  onClose: () => void;
}

export function WireColorMenu({ wireId, position, onColorChange, onClose }: WireColorMenuProps) {
  if (wireId == null || !position) {
    return null;
  }
  return (
    {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Phase 3 InteractiveCard migration (Plan 03-a11y-systemic) */}
    <div
      className="absolute z-20 bg-card border border-border rounded-md shadow-lg p-1.5"
      style={{ left: position.x, top: position.y }}
      data-testid="wire-color-menu"
      onMouseLeave={onClose}
    >
      <div className="text-[10px] text-muted-foreground px-1.5 py-0.5 mb-1 font-medium">Wire Color</div>
      <div className="grid grid-cols-4 gap-1">
        {WIRE_COLOR_PRESETS.map((preset) => (
          <button
            key={preset.hex}
            type="button"
            className="w-6 h-6 rounded-sm border border-border hover:border-primary transition-colors cursor-pointer"
            style={{ backgroundColor: preset.hex }}
            title={preset.name}
            onClick={() => onColorChange(wireId, preset.hex)}
            data-testid={`wire-color-${preset.name.toLowerCase()}`}
          />
        ))}
      </div>
    </div>
  );
}
