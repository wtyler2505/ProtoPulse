/**
 * Simulation Complexity Warning Dialog (BL-0514)
 *
 * Shows a pre-flight analysis of circuit complexity before running a
 * simulation. Displays metrics, severity-coded warnings, and actionable
 * simplification suggestions.
 *
 * Supports two modes:
 *   - Full dialog: metrics table + warnings + suggestions + Run Anyway / Cancel
 *   - Compact inline: icon + tooltip when there are no warnings
 */

import { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';
import {
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCircle2,
  Cpu,
  Lightbulb,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  CircuitComplexityMetrics,
  ComplexityWarning,
} from '@/lib/simulation/sim-complexity-checker';
import { formatRuntimeEstimate } from '@/lib/simulation/sim-complexity-checker';
import type { WarningLevel } from '@/lib/simulation/sim-complexity-checker';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SimComplexityWarningDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Callback to change open state. */
  onOpenChange: (open: boolean) => void;
  /** Complexity metrics from analyzeComplexity(). */
  metrics: CircuitComplexityMetrics;
  /** Warnings from checkThresholds(). */
  warnings: ComplexityWarning[];
  /** Suggestions from getSimplificationSuggestions(). */
  suggestions: string[];
  /** Callback when user chooses to run the simulation anyway. */
  onRunAnyway: () => void;
  /** Callback when user cancels. */
  onCancel: () => void;
}

interface SimComplexityCompactProps {
  /** Complexity metrics. */
  metrics: CircuitComplexityMetrics;
  /** Warnings (empty = green check). */
  warnings: ComplexityWarning[];
  /** Click handler to open the full dialog. */
  onClick?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function levelIcon(level: WarningLevel, className?: string) {
  switch (level) {
    case 'danger':
      return <AlertOctagon data-testid="icon-danger" className={cn('h-4 w-4 text-red-500', className)} />;
    case 'warning':
      return <AlertTriangle data-testid="icon-warning" className={cn('h-4 w-4 text-yellow-500', className)} />;
    case 'info':
      return <Info data-testid="icon-info" className={cn('h-4 w-4 text-blue-400', className)} />;
  }
}

function levelBadgeVariant(level: WarningLevel): string {
  switch (level) {
    case 'danger':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'warning':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'info':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  }
}

function formatMemory(mb: number): string {
  if (mb < 1) {
    return `${(mb * 1024).toFixed(0)} KB`;
  }
  return `${mb.toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Metrics Table
// ---------------------------------------------------------------------------

function MetricsTable({ metrics }: { metrics: CircuitComplexityMetrics }) {
  const rows = useMemo(() => [
    { label: 'Circuit nodes', value: metrics.nodeCount },
    { label: 'Linear devices', value: metrics.linearDeviceCount },
    { label: 'Nonlinear devices', value: metrics.nonlinearDeviceCount },
    { label: 'MNA matrix size', value: `${metrics.estimatedMatrixSize} x ${metrics.estimatedMatrixSize}` },
    { label: 'Estimated memory', value: formatMemory(metrics.estimatedMemoryMB) },
    { label: 'Estimated runtime', value: formatRuntimeEstimate(metrics.estimatedRuntimeMs) },
    ...(metrics.coupledInductors > 0
      ? [{ label: 'Coupled inductors', value: metrics.coupledInductors }]
      : []),
    ...(metrics.transmissionLines > 0
      ? [{ label: 'Transmission lines', value: metrics.transmissionLines }]
      : []),
  ], [metrics]);

  return (
    <div data-testid="metrics-table" className="rounded-md border border-zinc-700 overflow-hidden">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.label}
              className={cn(
                'border-b border-zinc-700 last:border-b-0',
                i % 2 === 0 ? 'bg-zinc-900/50' : 'bg-zinc-800/30',
              )}
            >
              <td className="px-3 py-1.5 text-zinc-400 font-medium">{row.label}</td>
              <td className="px-3 py-1.5 text-right text-zinc-200 tabular-nums">{String(row.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Warning List
// ---------------------------------------------------------------------------

function WarningList({ warnings }: { warnings: ComplexityWarning[] }) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <div data-testid="warning-list" className="space-y-2">
      <h4 className="text-sm font-medium text-zinc-300">Warnings</h4>
      {warnings.map((w, i) => (
        <div
          key={`${w.metric}-${i}`}
          data-testid={`warning-item-${w.metric}`}
          className={cn(
            'flex items-start gap-2 rounded-md border p-2.5 text-sm',
            levelBadgeVariant(w.level),
          )}
        >
          <div className="mt-0.5 shrink-0">{levelIcon(w.level)}</div>
          <div className="space-y-1">
            <p>{w.message}</p>
            <Badge
              data-testid={`badge-${w.level}`}
              className={cn('text-[10px] uppercase tracking-wider', levelBadgeVariant(w.level))}
            >
              {w.level}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Suggestion Cards
// ---------------------------------------------------------------------------

function SuggestionCards({ suggestions }: { suggestions: string[] }) {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div data-testid="suggestion-list" className="space-y-2">
      <h4 className="text-sm font-medium text-zinc-300 flex items-center gap-1.5">
        <Lightbulb className="h-3.5 w-3.5 text-[var(--color-editor-accent)]" />
        Suggestions
      </h4>
      {suggestions.map((s, i) => (
        <div
          key={i}
          data-testid={`suggestion-item-${i}`}
          className="flex items-start gap-2 rounded-md border border-zinc-700 bg-zinc-900/50 p-2.5 text-sm text-zinc-300"
        >
          <span className="text-[var(--color-editor-accent)] font-medium shrink-0">{i + 1}.</span>
          <span>{s}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Full Dialog
// ---------------------------------------------------------------------------

export default function SimComplexityWarningDialog({
  open,
  onOpenChange,
  metrics,
  warnings,
  suggestions,
  onRunAnyway,
  onCancel,
}: SimComplexityWarningDialogProps) {
  const highestLevel = useMemo((): WarningLevel | null => {
    if (warnings.length === 0) {
      return null;
    }
    if (warnings.some((w) => w.level === 'danger')) {
      return 'danger';
    }
    if (warnings.some((w) => w.level === 'warning')) {
      return 'warning';
    }
    return 'info';
  }, [warnings]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="sim-complexity-dialog"
        className="max-w-lg max-h-[80vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-[var(--color-editor-accent)]" />
            Simulation Complexity Analysis
          </DialogTitle>
          <DialogDescription>
            {warnings.length === 0
              ? 'Your circuit is within recommended limits.'
              : `${warnings.length} potential issue${warnings.length > 1 ? 's' : ''} detected. Review before running.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <MetricsTable metrics={metrics} />
          <WarningList warnings={warnings} />
          <SuggestionCards suggestions={suggestions} />
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button
            data-testid="btn-cancel"
            variant="outline"
            onClick={() => {
              onCancel();
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            data-testid="btn-run-anyway"
            variant={highestLevel === 'danger' ? 'destructive' : 'default'}
            onClick={() => {
              onRunAnyway();
              onOpenChange(false);
            }}
            className={highestLevel !== 'danger' ? 'bg-[var(--color-editor-accent)] text-black hover:bg-[#00D4E0]' : undefined}
          >
            {warnings.length > 0 ? 'Run Anyway' : 'Run Simulation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Compact Inline Mode
// ---------------------------------------------------------------------------

export function SimComplexityCompact({
  metrics,
  warnings,
  onClick,
}: SimComplexityCompactProps) {
  const hasWarnings = warnings.length > 0;
  const highestLevel = useMemo((): WarningLevel | null => {
    if (warnings.length === 0) {
      return null;
    }
    if (warnings.some((w) => w.level === 'danger')) {
      return 'danger';
    }
    if (warnings.some((w) => w.level === 'warning')) {
      return 'warning';
    }
    return 'info';
  }, [warnings]);

  const tooltipText = hasWarnings
    ? `${warnings.length} complexity warning${warnings.length > 1 ? 's' : ''} — click for details`
    : `${metrics.nodeCount} nodes, ${metrics.estimatedMatrixSize}x${metrics.estimatedMatrixSize} matrix — all OK`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            data-testid="sim-complexity-compact"
            onClick={onClick}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
              'border hover:bg-zinc-800',
              hasWarnings
                ? highestLevel === 'danger'
                  ? 'border-red-500/40 text-red-400'
                  : highestLevel === 'warning'
                    ? 'border-yellow-500/40 text-yellow-400'
                    : 'border-blue-500/40 text-blue-400'
                : 'border-zinc-700 text-zinc-400',
            )}
          >
            {hasWarnings
              ? highestLevel === 'danger'
                ? <AlertOctagon className="h-3.5 w-3.5" />
                : highestLevel === 'warning'
                  ? <AlertTriangle className="h-3.5 w-3.5" />
                  : <Info className="h-3.5 w-3.5" />
              : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
            <span>{metrics.nodeCount}N</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
