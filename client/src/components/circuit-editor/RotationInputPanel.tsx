/**
 * RotationInputPanel — UI for arbitrary-angle rotation of circuit components.
 *
 * Provides a numeric angle input, preset buttons, fine-adjustment controls,
 * snap toggle, and a visual angle indicator.
 */

import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { normalizeAngle, snapToAngle } from '@/lib/circuit-editor/rotation-utils';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RotationInputPanelProps {
  /** Current angle in degrees [0, 360). */
  angle: number;
  /** Called when the angle changes. Value is always normalized to [0, 360). */
  onChange: (angle: number) => void;
  /** Optional className for the root container. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRESET_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315] as const;

const SNAP_INCREMENT = 15;

// ---------------------------------------------------------------------------
// AngleIndicator — small SVG showing the current angle visually
// ---------------------------------------------------------------------------

interface AngleIndicatorProps {
  angle: number;
}

function AngleIndicator({ angle }: AngleIndicatorProps) {
  const cx = 24;
  const cy = 24;
  const radius = 18;
  const rad = (angle - 90) * (Math.PI / 180); // -90 so 0 degrees points up
  const lineX = cx + radius * Math.cos(rad);
  const lineY = cy + radius * Math.sin(rad);

  return (
    <svg
      width={48}
      height={48}
      viewBox="0 0 48 48"
      className="shrink-0"
      data-testid="rotation-angle-indicator"
      aria-label={`Angle indicator showing ${angle} degrees`}
    >
      {/* Outer ring */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="text-border"
      />
      {/* Tick marks at 0, 90, 180, 270 */}
      {[0, 90, 180, 270].map((tick) => {
        const tickRad = (tick - 90) * (Math.PI / 180);
        const inner = radius - 3;
        const outer = radius;
        return (
          <line
            key={tick}
            x1={cx + inner * Math.cos(tickRad)}
            y1={cy + inner * Math.sin(tickRad)}
            x2={cx + outer * Math.cos(tickRad)}
            y2={cy + outer * Math.sin(tickRad)}
            stroke="currentColor"
            strokeWidth={1}
            className="text-muted-foreground/60"
          />
        );
      })}
      {/* Center dot */}
      <circle cx={cx} cy={cy} r={2} className="fill-[#00F0FF]" />
      {/* Direction line */}
      <line
        x1={cx}
        y1={cy}
        x2={lineX}
        y2={lineY}
        stroke="#00F0FF"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// RotationInputPanel
// ---------------------------------------------------------------------------

export function RotationInputPanel({
  angle,
  onChange,
  className,
}: RotationInputPanelProps) {
  const [snapEnabled, setSnapEnabled] = useState(false);

  const applyAngle = useCallback(
    (raw: number) => {
      const normalized = normalizeAngle(raw);
      const final = snapEnabled ? snapToAngle(normalized, SNAP_INCREMENT) : normalized;
      onChange(final);
    },
    [snapEnabled, onChange],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      if (!Number.isNaN(val)) {
        applyAngle(val);
      }
    },
    [applyAngle],
  );

  const handleInputBlur = useCallback(() => {
    // Ensure the displayed value is normalized on blur
    applyAngle(angle);
  }, [angle, applyAngle]);

  const nudge = useCallback(
    (delta: number) => {
      applyAngle(angle + delta);
    },
    [angle, applyAngle],
  );

  return (
    <div
      className={cn('space-y-3', className)}
      data-testid="rotation-input-panel"
    >
      {/* Row 1: Angle indicator + numeric input */}
      <div className="flex items-center gap-3">
        <AngleIndicator angle={angle} />
        <div className="flex-1 space-y-1">
          <Label htmlFor="rotation-angle-input" className="text-xs text-muted-foreground">
            Angle
          </Label>
          <div className="flex items-center gap-1.5">
            <Input
              id="rotation-angle-input"
              type="number"
              min={0}
              max={359}
              value={Math.round(angle)}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              className="h-7 w-20 font-mono text-xs px-2"
              data-testid="rotation-angle-input"
              aria-label="Rotation angle in degrees"
            />
            <span className="text-xs text-muted-foreground">deg</span>
          </div>
        </div>
      </div>

      {/* Row 2: Preset angle buttons */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Presets</Label>
        <div className="flex flex-wrap gap-1" data-testid="rotation-presets">
          {PRESET_ANGLES.map((preset) => (
            <Button
              key={preset}
              variant={angle === preset ? 'default' : 'outline'}
              size="sm"
              className={cn(
                'h-6 px-2 text-[10px] font-mono',
                angle === preset && 'bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF]/30',
              )}
              onClick={() => { onChange(preset); }}
              data-testid={`rotation-preset-${preset}`}
              aria-label={`Set rotation to ${preset} degrees`}
            >
              {preset}°
            </Button>
          ))}
        </div>
      </div>

      {/* Row 3: Fine adjustment buttons */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Fine Adjust</Label>
        <div className="flex gap-1" data-testid="rotation-fine-adjust">
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[10px] font-mono"
            onClick={() => { nudge(-15); }}
            data-testid="rotation-nudge-minus-15"
            aria-label="Decrease angle by 15 degrees"
          >
            -15°
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[10px] font-mono"
            onClick={() => { nudge(-1); }}
            data-testid="rotation-nudge-minus-1"
            aria-label="Decrease angle by 1 degree"
          >
            -1°
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[10px] font-mono"
            onClick={() => { nudge(1); }}
            data-testid="rotation-nudge-plus-1"
            aria-label="Increase angle by 1 degree"
          >
            +1°
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[10px] font-mono"
            onClick={() => { nudge(15); }}
            data-testid="rotation-nudge-plus-15"
            aria-label="Increase angle by 15 degrees"
          >
            +15°
          </Button>
        </div>
      </div>

      {/* Row 4: Snap toggle */}
      <div className="flex items-center gap-2" data-testid="rotation-snap-toggle">
        <Checkbox
          id="rotation-snap-checkbox"
          checked={snapEnabled}
          onCheckedChange={(checked) => {
            const enabled = checked === true;
            setSnapEnabled(enabled);
            if (enabled) {
              onChange(snapToAngle(angle, SNAP_INCREMENT));
            }
          }}
          data-testid="rotation-snap-checkbox"
          aria-label="Enable angle snapping"
        />
        <Label
          htmlFor="rotation-snap-checkbox"
          className="text-xs text-muted-foreground cursor-pointer"
        >
          Snap to {SNAP_INCREMENT}° increments
        </Label>
      </div>
    </div>
  );
}
