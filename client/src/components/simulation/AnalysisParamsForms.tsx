import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

import type { TransientParams, ACParams, DCSweepParams, DCOPResult } from './simulation-types';

// ---------------------------------------------------------------------------
// Collapsible section wrapper
// ---------------------------------------------------------------------------

export function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
  testId,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  testId?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border/50" data-testid={testId}>
      <button
        type="button"
        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        {title}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable form field
// ---------------------------------------------------------------------------

export function ParamField({
  label,
  value,
  onChange,
  placeholder,
  unit,
  testId,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  unit?: string;
  testId?: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
      <div className="flex items-center">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          data-testid={testId}
          className={cn(
            'flex-1 h-8 px-2.5 text-xs bg-background border border-border text-foreground',
            'placeholder:text-muted-foreground/50',
            'focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-colors',
            unit ? 'rounded-l' : '',
          )}
        />
        {unit && (
          <span className="h-8 px-2 flex items-center text-[10px] font-mono text-muted-foreground bg-muted/30 border border-l-0 border-border rounded-r select-none">
            {unit}
          </span>
        )}
      </div>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Parameter forms per analysis type
// ---------------------------------------------------------------------------

export function TransientParamsForm({
  params,
  onChange,
  disabled,
}: {
  params: TransientParams;
  onChange: (p: TransientParams) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <ParamField
        label="Start Time"
        value={params.startTime}
        onChange={(v) => onChange({ ...params, startTime: v })}
        placeholder="0"
        unit="s"
        testId="param-transient-start"
        disabled={disabled}
      />
      <ParamField
        label="Stop Time"
        value={params.stopTime}
        onChange={(v) => onChange({ ...params, stopTime: v })}
        placeholder="10ms"
        unit="s"
        testId="param-transient-stop"
        disabled={disabled}
      />
      <ParamField
        label="Time Step"
        value={params.timeStep}
        onChange={(v) => onChange({ ...params, timeStep: v })}
        placeholder="auto"
        unit="s"
        testId="param-transient-step"
        disabled={disabled}
      />
    </div>
  );
}

export function ACParamsForm({
  params,
  onChange,
  disabled,
}: {
  params: ACParams;
  onChange: (p: ACParams) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <ParamField
        label="Start Frequency"
        value={params.startFrequency}
        onChange={(v) => onChange({ ...params, startFrequency: v })}
        placeholder="1Hz"
        unit="Hz"
        testId="param-ac-start"
        disabled={disabled}
      />
      <ParamField
        label="Stop Frequency"
        value={params.stopFrequency}
        onChange={(v) => onChange({ ...params, stopFrequency: v })}
        placeholder="1MHz"
        unit="Hz"
        testId="param-ac-stop"
        disabled={disabled}
      />
      <ParamField
        label="Points/Decade"
        value={params.pointsPerDecade}
        onChange={(v) => onChange({ ...params, pointsPerDecade: v })}
        placeholder="100"
        testId="param-ac-points"
        disabled={disabled}
      />
    </div>
  );
}

export function DCSweepParamsForm({
  params,
  onChange,
  disabled,
  sources,
}: {
  params: DCSweepParams;
  onChange: (p: DCSweepParams) => void;
  disabled: boolean;
  sources: string[];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-[11px] text-muted-foreground font-medium">Source</span>
        <select
          value={params.source}
          onChange={(e) => onChange({ ...params, source: e.target.value })}
          disabled={disabled || sources.length === 0}
          data-testid="param-dcsweep-source"
          className={cn(
            'h-8 px-2 text-xs bg-background border border-border text-foreground',
            'focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-colors appearance-none',
          )}
        >
          <option value="">
            {sources.length === 0 ? 'No sources in circuit' : 'Select a source...'}
          </option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <ParamField
        label="Start Value"
        value={params.startValue}
        onChange={(v) => onChange({ ...params, startValue: v })}
        placeholder="0"
        unit="V"
        testId="param-dcsweep-start"
        disabled={disabled}
      />
      <ParamField
        label="Stop Value"
        value={params.stopValue}
        onChange={(v) => onChange({ ...params, stopValue: v })}
        placeholder="5V"
        unit="V"
        testId="param-dcsweep-stop"
        disabled={disabled}
      />
      <ParamField
        label="Step Value"
        value={params.stepValue}
        onChange={(v) => onChange({ ...params, stepValue: v })}
        placeholder="0.1V"
        unit="V"
        testId="param-dcsweep-step"
        disabled={disabled}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// DC Operating Point results table
// ---------------------------------------------------------------------------

export function DCOPResultTable({ rows }: { rows: DCOPResult['rows'] }) {
  return (
    <div className="overflow-auto max-h-72">
      <table className="w-full text-xs" data-testid="dcop-results-table">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="text-left py-2 px-3 font-semibold">Node / Component</th>
            <th className="text-right py-2 px-3 font-semibold">Value</th>
            <th className="text-left py-2 px-3 font-semibold">Unit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={`${row.node}-${i}`}
              className="border-b border-border/30 hover:bg-muted/20 transition-colors"
            >
              <td className="py-1.5 px-3 font-mono text-foreground">{row.node}</td>
              <td className="py-1.5 px-3 text-right font-mono text-primary">
                {row.value.toFixed(6)}
              </td>
              <td className="py-1.5 px-3 text-muted-foreground">{row.unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
