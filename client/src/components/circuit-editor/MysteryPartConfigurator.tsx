import { useCallback, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

import type { MysteryPartConfig, MysteryPartPinSide } from '@shared/component-types';
import {
  createDefaultMysteryPartConfig,
  distributePins,
  MYSTERY_PART_MAX_PINS,
  MYSTERY_PART_MIN_PINS,
} from '@shared/component-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MysteryPartConfiguratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Initial config to populate the dialog. When omitted, defaults are used. */
  initialConfig?: MysteryPartConfig;
  /** Called with the final config when the user clicks Apply. */
  onApply: (config: MysteryPartConfig) => void;
}

const ALL_SIDES: MysteryPartPinSide[] = ['top', 'right', 'bottom', 'left'];

// ---------------------------------------------------------------------------
// SVG Preview
// ---------------------------------------------------------------------------

const GRID_PX = 20;
const PIN_R = 3;
const PAD = 40; // padding around body for pin stubs

interface PreviewProps {
  config: MysteryPartConfig;
}

function MysteryPartPreview({ config }: PreviewProps) {
  const bodyW = config.bodyWidth * GRID_PX;
  const bodyH = config.bodyHeight * GRID_PX;
  const svgW = bodyW + PAD * 2;
  const svgH = bodyH + PAD * 2;

  // Group pins by side
  const bySide = useMemo(() => {
    const m = new Map<MysteryPartPinSide, typeof config.pins>();
    for (const pin of config.pins) {
      const arr = m.get(pin.side) ?? [];
      arr.push(pin);
      m.set(pin.side, arr);
    }
    return m;
  }, [config.pins]);

  const pinElements = useMemo(() => {
    const els: { cx: number; cy: number; label: string; key: string }[] = [];

    for (const pin of config.pins) {
      const sidePins = bySide.get(pin.side) ?? [];
      const count = sidePins.length;
      let cx: number;
      let cy: number;

      switch (pin.side) {
        case 'left': {
          const spacing = bodyH / (count + 1);
          cx = PAD - 10;
          cy = PAD + spacing * (pin.index + 1);
          break;
        }
        case 'right': {
          const spacing = bodyH / (count + 1);
          cx = PAD + bodyW + 10;
          cy = PAD + spacing * (pin.index + 1);
          break;
        }
        case 'top': {
          const spacing = bodyW / (count + 1);
          cx = PAD + spacing * (pin.index + 1);
          cy = PAD - 10;
          break;
        }
        case 'bottom': {
          const spacing = bodyW / (count + 1);
          cx = PAD + spacing * (pin.index + 1);
          cy = PAD + bodyH + 10;
          break;
        }
      }

      els.push({ cx, cy, label: pin.label, key: `${pin.side}-${pin.index}` });
    }
    return els;
  }, [config.pins, bySide, bodyW, bodyH]);

  return (
    <svg
      data-testid="mystery-preview"
      width={svgW}
      height={svgH}
      viewBox={`0 0 ${svgW} ${svgH}`}
      className="mx-auto"
    >
      {/* Body */}
      <rect
        x={PAD}
        y={PAD}
        width={bodyW}
        height={bodyH}
        fill="#2A2A2A"
        stroke="var(--color-editor-accent)"
        strokeWidth={2}
        rx={3}
      />
      {/* Name label */}
      <text
        x={PAD + bodyW / 2}
        y={PAD + bodyH / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--color-editor-accent)"
        fontSize={10}
        fontFamily="monospace"
      >
        {config.name || '?'}
      </text>
      {/* Pins */}
      {pinElements.map((p) => (
        <g key={p.key}>
          <circle cx={p.cx} cy={p.cy} r={PIN_R} fill="#C0C0C0" stroke="#888" strokeWidth={1} />
          <text
            x={p.cx}
            y={p.cy - PIN_R - 2}
            textAnchor="middle"
            fill="#aaa"
            fontSize={7}
            fontFamily="monospace"
          >
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function MysteryPartConfigurator({
  open,
  onOpenChange,
  initialConfig,
  onApply,
}: MysteryPartConfiguratorProps) {
  const [config, setConfig] = useState<MysteryPartConfig>(
    () => initialConfig ?? createDefaultMysteryPartConfig(),
  );
  const [pinCountInput, setPinCountInput] = useState(() => String(config.pins.length));
  const [selectedSides, setSelectedSides] = useState<MysteryPartPinSide[]>(() => {
    // Derive initial selected sides from the config's pins
    const sides = new Set(config.pins.map((p) => p.side));
    return sides.size > 0 ? (Array.from(sides) as MysteryPartPinSide[]) : ['left', 'right'];
  });

  // Resets state when dialog opens with a new initialConfig
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        const cfg = initialConfig ?? createDefaultMysteryPartConfig();
        setConfig(cfg);
        setPinCountInput(String(cfg.pins.length));
        const sides = new Set(cfg.pins.map((p) => p.side));
        setSelectedSides(sides.size > 0 ? (Array.from(sides) as MysteryPartPinSide[]) : ['left', 'right']);
      }
      onOpenChange(nextOpen);
    },
    [initialConfig, onOpenChange],
  );

  // -- Pin count --------------------------------------------------------

  const pinCountError = useMemo(() => {
    const n = Number(pinCountInput);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      return 'Must be a whole number';
    }
    if (n < MYSTERY_PART_MIN_PINS) {
      return `Minimum ${MYSTERY_PART_MIN_PINS} pins`;
    }
    if (n > MYSTERY_PART_MAX_PINS) {
      return `Maximum ${MYSTERY_PART_MAX_PINS} pins`;
    }
    return null;
  }, [pinCountInput]);

  const applyPinCount = useCallback(
    (raw: string) => {
      setPinCountInput(raw);
      const n = Number(raw);
      if (!Number.isFinite(n) || !Number.isInteger(n)) {
        return;
      }
      if (n < MYSTERY_PART_MIN_PINS || n > MYSTERY_PART_MAX_PINS) {
        return;
      }
      const sides = selectedSides.length > 0 ? selectedSides : ['left', 'right'] as MysteryPartPinSide[];
      const newPins = distributePins(n, sides);
      // Preserve existing labels where possible
      for (let i = 0; i < Math.min(newPins.length, config.pins.length); i++) {
        newPins[i].label = config.pins[i].label;
      }
      setConfig((prev) => ({ ...prev, pins: newPins }));
    },
    [selectedSides, config.pins],
  );

  // -- Side toggles -----------------------------------------------------

  const toggleSide = useCallback(
    (side: MysteryPartPinSide) => {
      setSelectedSides((prev) => {
        const next = prev.includes(side) ? prev.filter((s) => s !== side) : [...prev, side];
        // Must have at least one side
        if (next.length === 0) {
          return prev;
        }
        // Redistribute pins across new sides
        const n = config.pins.length;
        const newPins = distributePins(n, next);
        // Preserve existing labels
        for (let i = 0; i < Math.min(newPins.length, config.pins.length); i++) {
          newPins[i].label = config.pins[i].label;
        }
        setConfig((c) => ({ ...c, pins: newPins }));
        return next;
      });
    },
    [config.pins],
  );

  // -- Pin label editing ------------------------------------------------

  const updatePinLabel = useCallback((pinIndex: number, label: string) => {
    setConfig((prev) => {
      const newPins = [...prev.pins];
      newPins[pinIndex] = { ...newPins[pinIndex], label };
      return { ...prev, pins: newPins };
    });
  }, []);

  // -- Body dimensions --------------------------------------------------

  const updateBodyWidth = useCallback((raw: string) => {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 1 && n <= 20) {
      setConfig((prev) => ({ ...prev, bodyWidth: n }));
    }
  }, []);

  const updateBodyHeight = useCallback((raw: string) => {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 1 && n <= 20) {
      setConfig((prev) => ({ ...prev, bodyHeight: n }));
    }
  }, []);

  // -- Apply / Cancel ---------------------------------------------------

  const handleApply = useCallback(() => {
    if (pinCountError) {
      return;
    }
    onApply(config);
    onOpenChange(false);
  }, [config, pinCountError, onApply, onOpenChange]);

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        data-testid="mystery-configurator-dialog"
      >
        <DialogHeader>
          <DialogTitle>Mystery Part Configurator</DialogTitle>
          <DialogDescription>
            Define a placeholder component with custom pin layout for unknown or custom parts.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden grid grid-cols-2 gap-4">
          {/* Left column — settings */}
          <ScrollArea className="h-[400px] pr-3">
            <div className="space-y-4">
              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="mystery-name">Name</Label>
                <Input
                  id="mystery-name"
                  data-testid="mystery-name"
                  value={config.name}
                  onChange={(e) => setConfig((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Mystery Part"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="mystery-description">Description</Label>
                <Input
                  id="mystery-description"
                  data-testid="mystery-description"
                  value={config.description}
                  onChange={(e) => setConfig((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional notes..."
                />
              </div>

              {/* Pin count */}
              <div className="space-y-1.5">
                <Label htmlFor="mystery-pin-count">Pin Count ({MYSTERY_PART_MIN_PINS}-{MYSTERY_PART_MAX_PINS})</Label>
                <Input
                  id="mystery-pin-count"
                  data-testid="mystery-pin-count"
                  type="number"
                  min={MYSTERY_PART_MIN_PINS}
                  max={MYSTERY_PART_MAX_PINS}
                  value={pinCountInput}
                  onChange={(e) => applyPinCount(e.target.value)}
                />
                {pinCountError && (
                  <p className="text-xs text-destructive" data-testid="mystery-pin-count-error">
                    {pinCountError}
                  </p>
                )}
              </div>

              {/* Pin sides */}
              <div className="space-y-1.5">
                <Label>Pin Sides</Label>
                <div className="flex flex-wrap gap-3">
                  {ALL_SIDES.map((side) => (
                    <label
                      key={side}
                      className="flex items-center gap-1.5 text-sm capitalize cursor-pointer"
                    >
                      <Checkbox
                        data-testid={`mystery-side-${side}`}
                        checked={selectedSides.includes(side)}
                        onCheckedChange={() => toggleSide(side)}
                      />
                      {side}
                    </label>
                  ))}
                </div>
              </div>

              {/* Body dimensions */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="mystery-body-width">Body Width</Label>
                  <Input
                    id="mystery-body-width"
                    data-testid="mystery-body-width"
                    type="number"
                    min={1}
                    max={20}
                    value={config.bodyWidth}
                    onChange={(e) => updateBodyWidth(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mystery-body-height">Body Height</Label>
                  <Input
                    id="mystery-body-height"
                    data-testid="mystery-body-height"
                    type="number"
                    min={1}
                    max={20}
                    value={config.bodyHeight}
                    onChange={(e) => updateBodyHeight(e.target.value)}
                  />
                </div>
              </div>

              {/* Pin label editor */}
              <div className="space-y-1.5">
                <Label>Pin Labels</Label>
                <div className="space-y-1 max-h-[200px] overflow-y-auto rounded border border-border p-2">
                  {config.pins.map((pin, i) => (
                    <div key={`${pin.side}-${pin.index}`} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-6 text-right shrink-0">
                        {i + 1}
                      </span>
                      <Input
                        data-testid={`mystery-pin-label-${i}`}
                        className="h-7 text-xs"
                        value={pin.label}
                        onChange={(e) => updatePinLabel(i, e.target.value)}
                      />
                      <span className="text-xs text-muted-foreground capitalize shrink-0 w-10">
                        {pin.side}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>

          {/* Right column — preview */}
          <div className="flex flex-col items-center justify-center bg-muted/30 rounded-lg border border-border p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <MysteryPartPreview config={config} />
            <p className="text-xs text-muted-foreground mt-2">
              {config.pins.length} pin{config.pins.length !== 1 ? 's' : ''} &middot;{' '}
              {config.bodyWidth}&times;{config.bodyHeight} grid units
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} data-testid="mystery-cancel">
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={!!pinCountError} data-testid="mystery-apply">
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
