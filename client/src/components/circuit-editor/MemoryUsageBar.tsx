import { memo } from 'react';
import { HardDrive, Cpu, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { formatBytes, getThreshold } from '@/lib/arduino/memory-usage-parser';
import type { MemoryUsage, MemoryDelta, MemoryThreshold } from '@/lib/arduino/memory-usage-parser';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MemoryUsageBarProps {
  /** Parsed memory usage from a compile. Null = no data available. */
  usage: MemoryUsage | null;
  /** Delta from the previous build. Null = no prior build to compare. */
  delta?: MemoryDelta | null;
  /** Compact mode for embedding in a toolbar (single-line layout). */
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Theme colors per threshold
// ---------------------------------------------------------------------------

const THRESHOLD_COLORS: Record<MemoryThreshold, { bar: string; text: string; bg: string }> = {
  normal: {
    bar: 'bg-emerald-500',
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/20',
  },
  warning: {
    bar: 'bg-amber-500',
    text: 'text-amber-400',
    bg: 'bg-amber-500/20',
  },
  critical: {
    bar: 'bg-red-500',
    text: 'text-red-400',
    bg: 'bg-red-500/20',
  },
};

// ---------------------------------------------------------------------------
// DeltaIndicator — shows size change from previous build
// ---------------------------------------------------------------------------

interface DeltaIndicatorProps {
  delta: number;
  testIdPrefix: string;
}

function DeltaIndicator({ delta, testIdPrefix }: DeltaIndicatorProps) {
  if (delta === 0) {
    return (
      <span
        className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground"
        data-testid={`${testIdPrefix}-delta`}
      >
        <Minus className="h-2.5 w-2.5" />
        <span>0 B</span>
      </span>
    );
  }

  const isIncrease = delta > 0;
  const Icon = isIncrease ? TrendingUp : TrendingDown;
  const color = isIncrease ? 'text-red-400' : 'text-emerald-400';
  const prefix = isIncrease ? '+' : '';

  return (
    <span
      className={cn('inline-flex items-center gap-0.5 text-[10px]', color)}
      data-testid={`${testIdPrefix}-delta`}
    >
      <Icon className="h-2.5 w-2.5" />
      <span>{prefix}{formatBytes(delta)}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// SingleBar — one progress bar for a memory region
// ---------------------------------------------------------------------------

interface SingleBarProps {
  label: string;
  icon: typeof HardDrive;
  used: number;
  max: number;
  percent: number;
  delta?: number;
  testIdPrefix: string;
  compact?: boolean;
}

function SingleBar({ label, icon: Icon, used, max, percent, delta, testIdPrefix, compact }: SingleBarProps) {
  const threshold = getThreshold(percent);
  const colors = THRESHOLD_COLORS[threshold];
  const clampedPercent = Math.max(0, Math.min(100, percent));

  const barHeight = compact ? 'h-1.5' : 'h-2';
  const textSize = compact ? 'text-[10px]' : 'text-xs';

  return (
    <div className="space-y-0.5" data-testid={`${testIdPrefix}-region`}>
      <div className={cn('flex items-center justify-between gap-2', textSize)}>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Icon className={cn('shrink-0', compact ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
          <span className="font-medium" data-testid={`${testIdPrefix}-label`}>{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {delta !== undefined && <DeltaIndicator delta={delta} testIdPrefix={testIdPrefix} />}
          <span
            className={cn('font-mono tabular-nums', colors.text)}
            data-testid={`${testIdPrefix}-text`}
          >
            {formatBytes(used)} / {formatBytes(max)} ({percent}%)
          </span>
        </div>
      </div>
      <div
        className={cn('w-full overflow-hidden rounded-full', colors.bg, barHeight)}
        data-testid={`${testIdPrefix}-track`}
        role="progressbar"
        aria-valuenow={clampedPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${percent}%`}
      >
        <div
          className={cn('h-full rounded-full transition-all duration-300', colors.bar)}
          style={{ width: `${clampedPercent}%` }}
          data-testid={`${testIdPrefix}-fill`}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tooltip content — detailed breakdown
// ---------------------------------------------------------------------------

interface TooltipBreakdownProps {
  usage: MemoryUsage;
  delta?: MemoryDelta | null;
}

function TooltipBreakdown({ usage, delta }: TooltipBreakdownProps) {
  const flashThreshold = getThreshold(usage.flash.percent);
  const ramThreshold = getThreshold(usage.ram.percent);
  const flashFree = usage.flash.max - usage.flash.used;
  const ramFree = usage.ram.max - usage.ram.used;

  return (
    <div className="space-y-2 text-xs" data-testid="memory-usage-tooltip">
      <div className="font-medium text-foreground">Memory Usage Details</div>

      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Flash used:</span>
          <span className={cn('font-mono', THRESHOLD_COLORS[flashThreshold].text)}>
            {formatBytes(usage.flash.used)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Flash max:</span>
          <span className="font-mono">{formatBytes(usage.flash.max)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Flash free:</span>
          <span className="font-mono">{formatBytes(flashFree)}</span>
        </div>
        {delta && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Flash delta:</span>
            <DeltaIndicator delta={delta.flashDelta} testIdPrefix="tooltip-flash" />
          </div>
        )}
      </div>

      <div className="h-px bg-border" />

      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">RAM used:</span>
          <span className={cn('font-mono', THRESHOLD_COLORS[ramThreshold].text)}>
            {formatBytes(usage.ram.used)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">RAM max:</span>
          <span className="font-mono">{formatBytes(usage.ram.max)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">RAM free:</span>
          <span className="font-mono">{formatBytes(ramFree)}</span>
        </div>
        {delta && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">RAM delta:</span>
            <DeltaIndicator delta={delta.ramDelta} testIdPrefix="tooltip-ram" />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MemoryUsageBar — main component
// ---------------------------------------------------------------------------

function MemoryUsageBarInner({ usage, delta, compact = false }: MemoryUsageBarProps) {
  if (!usage) {
    return (
      <div
        className={cn(
          'rounded-md border border-border/50 bg-card/50 px-3',
          compact ? 'py-1.5' : 'py-2',
        )}
        data-testid="memory-usage-bar-empty"
      >
        <p className="text-xs text-muted-foreground italic">
          No memory usage data. Compile a sketch to see usage.
        </p>
      </div>
    );
  }

  const content = (
    <div
      className={cn(
        'rounded-md border border-border/50 bg-card/50 px-3',
        compact ? 'py-1.5 space-y-1' : 'py-2 space-y-1.5',
      )}
      data-testid="memory-usage-bar"
    >
      <SingleBar
        label="Flash"
        icon={HardDrive}
        used={usage.flash.used}
        max={usage.flash.max}
        percent={usage.flash.percent}
        delta={delta?.flashDelta}
        testIdPrefix="memory-flash"
        compact={compact}
      />
      <SingleBar
        label="RAM"
        icon={Cpu}
        used={usage.ram.used}
        max={usage.ram.max}
        percent={usage.ram.percent}
        delta={delta?.ramDelta}
        testIdPrefix="memory-ram"
        compact={compact}
      />
    </div>
  );

  return (
    <StyledTooltip
      content={<TooltipBreakdown usage={usage} delta={delta} />}
      side="top"
    >
      <div>{content}</div>
    </StyledTooltip>
  );
}

export const MemoryUsageBar = memo(MemoryUsageBarInner);
MemoryUsageBar.displayName = 'MemoryUsageBar';
