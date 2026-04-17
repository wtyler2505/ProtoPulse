import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import type { WhatIfParam } from '@/lib/simulation/what-if-engine';
import { formatSIValue, computeSliderStep } from '@/lib/simulation/what-if-engine';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface WhatIfSliderPanelProps {
  /** Sweepable parameters to display sliders for. */
  params: WhatIfParam[];
  /** Called when the user adjusts a slider. */
  onParamChange: (id: string, value: number) => void;
  /** Current evaluation result (optional). */
  result?: number;
  /** Unit for the result display (e.g. "V", "A"). */
  resultUnit?: string;
  /** Label for the result (e.g. "Output Voltage"). */
  resultLabel?: string;
  /** Reset all parameters to nominal values. */
  onReset: () => void;
}

// ---------------------------------------------------------------------------
// Internal: single parameter slider row
// ---------------------------------------------------------------------------

interface ParamSliderRowProps {
  param: WhatIfParam;
  onChange: (id: string, value: number) => void;
  onResetOne: (id: string) => void;
}

function ParamSliderRow({ param, onChange, onResetOne }: ParamSliderRowProps) {
  const step = computeSliderStep(param.min, param.max);
  const isModified = Math.abs(param.currentValue - param.nominal) > step * 0.01;

  return (
    <div className="space-y-1.5" data-testid={`what-if-slider-${param.id}`}>
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-muted-foreground">
          {param.name}
        </Label>
        <div className="flex items-center gap-1.5">
          <Badge
            variant={isModified ? 'default' : 'secondary'}
            className={`font-mono text-[10px] px-1.5 py-0 ${isModified ? 'bg-[var(--color-editor-accent)]/20 text-[var(--color-editor-accent)] border-[var(--color-editor-accent)]/30' : ''}`}
          >
            {formatSIValue(param.currentValue, param.unit)}
          </Badge>
          {isModified && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground hover:text-foreground"
              onClick={() => { onResetOne(param.id); }}
              title="Reset to nominal"
              aria-label={`Reset ${param.id} to nominal`}
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <Slider
        min={param.min}
        max={param.max}
        step={step}
        value={[param.currentValue]}
        onValueChange={([v]) => {
          if (v !== undefined) {
            onChange(param.id, v);
          }
        }}
        className="[&_[data-slot=range]]:bg-[var(--color-editor-accent)] [&_[data-slot=thumb]]:border-[var(--color-editor-accent)]/50"
        aria-label={`${param.name} slider`}
      />

      <div className="flex justify-between text-[10px] text-muted-foreground/60 font-mono">
        <span>{formatSIValue(param.min, param.unit)}</span>
        <span className="text-muted-foreground/40">
          nom: {formatSIValue(param.nominal, param.unit)}
        </span>
        <span>{formatSIValue(param.max, param.unit)}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function WhatIfSliderPanel({
  params,
  onParamChange,
  result,
  resultUnit = '',
  resultLabel = 'Output',
  onReset,
}: WhatIfSliderPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  const hasModified = params.some((p) => {
    const step = computeSliderStep(p.min, p.max);
    return Math.abs(p.currentValue - p.nominal) > step * 0.01;
  });

  const handleResetOne = (id: string) => {
    const param = params.find((p) => p.id === id);
    if (param) {
      onParamChange(id, param.nominal);
    }
  };

  return (
    <Card
      className="border-border/50 bg-background/95 backdrop-blur"
      data-testid="what-if-panel"
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4">
        <CardTitle className="text-sm font-medium">
          What-If Sweep
          {hasModified && (
            <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-editor-accent)]" />
          )}
        </CardTitle>
        <div className="flex items-center gap-1">
          {hasModified && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={onReset}
              data-testid="what-if-reset"
              aria-label="Reset all parameters"
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              Reset All
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => { setCollapsed((c) => !c); }}
            aria-label={collapsed ? 'Expand what-if panel' : 'Collapse what-if panel'}
          >
            {collapsed ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </CardHeader>

      {!collapsed && (
        <CardContent className="space-y-4 px-4 pb-4 pt-0">
          {params.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              No sweepable parameters found. Add resistors, capacitors, inductors, or sources to your circuit.
            </p>
          ) : (
            <>
              {params.map((param) => (
                <ParamSliderRow
                  key={param.id}
                  param={param}
                  onChange={onParamChange}
                  onResetOne={handleResetOne}
                />
              ))}

              {result !== undefined && (
                <div className="mt-3 rounded-md border border-[var(--color-editor-accent)]/20 bg-[var(--color-editor-accent)]/5 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    {resultLabel}
                  </div>
                  <div className="text-lg font-mono font-semibold text-[var(--color-editor-accent)]">
                    {formatSIValue(result, resultUnit)}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
