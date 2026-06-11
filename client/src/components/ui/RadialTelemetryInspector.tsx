import { useEffect, useMemo, useState } from 'react';
import { Activity, Trash2, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { radialSlotMeta } from '@/lib/radial-menu-actions';
import {
  clearRadialTelemetry,
  readRadialTelemetry,
  subscribeRadialTelemetry,
  type RadialTelemetryEvent,
  type RadialTelemetryEventName,
} from '@/lib/radial-menu-telemetry';

const RECENT_EVENT_LIMIT = 6;
const COMPACT_RECENT_EVENT_LIMIT = 3;
const FAST_OPEN_BUDGET_MS = 32;
const WATCH_OPEN_BUDGET_MS = 80;
const MASTERY_LOCKED_STREAK = 3;

type GestureMasteryStatus = 'waiting' | 'started' | 'building' | 'locked';

interface RadialTelemetryInspectorProps {
  density?: 'normal' | 'compact';
}

interface GestureMastery {
  status: GestureMasteryStatus;
  statusLabel: string;
  value: string;
  detail: string;
  count: number;
}

const eventLabels: Record<RadialTelemetryEventName, string> = {
  'visible-open': 'Open',
  'keyboard-open': 'Keyboard open',
  'visible-mounted': 'Mounted',
  'visible-select': 'Select',
  'visible-repeat-ai': 'Repeat AI',
  'ai-draft': 'AI draft',
  'ai-send-now': 'AI send',
  'destructive-confirm-requested': 'Confirm',
  'destructive-undo-offered': 'Undo ready',
  'destructive-undo-run': 'Undo run',
  'customize-open': 'Customize',
  'mark-start': 'Mark start',
  'mark-threshold': 'Threshold',
  'mark-select': 'Mark select',
  'mark-confirm-required': 'Mark confirm',
  'mark-cancel': 'Mark cancel',
};

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? average([sorted[middle - 1], sorted[middle]]) : sorted[middle];
}

function formatMs(value: number | null | undefined): string {
  if (value == null) {
    return 'n/a';
  }
  if (value < 10) {
    return `${value.toFixed(1)}ms`;
  }
  return `${Math.round(value)}ms`;
}

function metricClasses(value: number | null): string {
  return cn(
    'rounded border px-2 py-1',
    value == null
      ? 'border-border/70 bg-muted/25 text-muted-foreground'
      : value <= FAST_OPEN_BUDGET_MS
        ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-100'
        : value <= WATCH_OPEN_BUDGET_MS
          ? 'border-amber-400/40 bg-amber-500/10 text-amber-100'
          : 'border-red-400/40 bg-red-500/10 text-red-100',
  );
}

function budgetStatus(value: number | null): {
  label: string;
  note: string;
  className: string;
} {
  if (value == null) {
    return {
      label: 'Waiting',
      note: `open budget <=${String(FAST_OPEN_BUDGET_MS)}ms`,
      className: 'border-border/70 bg-muted/25 text-muted-foreground',
    };
  }

  if (value <= FAST_OPEN_BUDGET_MS) {
    return {
      label: 'Fast',
      note: `typical open inside <=${String(FAST_OPEN_BUDGET_MS)}ms budget`,
      className: 'border-emerald-400/35 bg-emerald-500/10 text-emerald-100',
    };
  }

  if (value <= WATCH_OPEN_BUDGET_MS) {
    return {
      label: 'Watch',
      note: `typical open above ${String(FAST_OPEN_BUDGET_MS)}ms target`,
      className: 'border-amber-400/40 bg-amber-500/10 text-amber-100',
    };
  }

  return {
    label: 'Laggy',
    note: `typical open above ${String(WATCH_OPEN_BUDGET_MS)}ms ceiling`,
    className: 'border-red-400/40 bg-red-500/10 text-red-100',
  };
}

function eventDetails(event: RadialTelemetryEvent): string {
  const parts = [
    event.commandId,
    event.slot != null ? `slot ${String(event.slot)}` : undefined,
    event.durationMs != null ? formatMs(event.durationMs) : undefined,
    event.promptChars != null ? `${String(event.promptChars)} chars` : undefined,
    event.reason,
  ];
  return parts.filter(Boolean).join(' / ') || `${event.view} ${event.target}`;
}

function formatCommandLabel(commandId: string): string {
  return commandId
    .split(/[_-]+/)
    .filter(Boolean)
    .map((word) => (word.toLowerCase() === 'ai' ? 'AI' : `${word.charAt(0).toUpperCase()}${word.slice(1)}`))
    .join(' ');
}

function buildGestureMastery(events: RadialTelemetryEvent[]): GestureMastery {
  const gestureEvents = events.filter((event) =>
    event.name === 'mark-select' || event.name === 'mark-cancel' || event.name === 'mark-confirm-required',
  );
  const latestGesture = gestureEvents.at(-1);

  if (
    !latestGesture
    || latestGesture.name !== 'mark-select'
    || latestGesture.commandId == null
    || latestGesture.slot == null
  ) {
    return {
      status: 'waiting',
      statusLabel: 'Waiting',
      value: 'No streak yet',
      detail: 'Use marks to train muscle memory',
      count: 0,
    };
  }

  let count = 0;
  for (let index = gestureEvents.length - 1; index >= 0; index -= 1) {
    const event = gestureEvents[index];
    if (
      event.name !== 'mark-select'
      || event.commandId !== latestGesture.commandId
      || event.slot !== latestGesture.slot
      || event.view !== latestGesture.view
      || event.target !== latestGesture.target
    ) {
      break;
    }
    count += 1;
  }

  const status: GestureMasteryStatus =
    count >= MASTERY_LOCKED_STREAK ? 'locked' : count === 2 ? 'building' : 'started';
  const direction = radialSlotMeta[latestGesture.slot].direction;
  const commandLabel = formatCommandLabel(latestGesture.commandId);
  const statusLabel = status === 'locked' ? 'Locked' : status === 'building' ? 'Building' : 'Started';

  return {
    status,
    statusLabel,
    value: `${String(count)}x ${commandLabel}`,
    detail: `${direction} gesture trained`,
    count,
  };
}

function masteryClasses(status: GestureMasteryStatus): string {
  switch (status) {
    case 'locked':
      return 'border-emerald-300/40 bg-emerald-500/10 text-emerald-100';
    case 'building':
      return 'border-amber-300/40 bg-amber-500/10 text-amber-100';
    case 'started':
      return 'border-sky-300/35 bg-sky-500/10 text-sky-100';
    case 'waiting':
      return 'border-border/70 bg-muted/25 text-muted-foreground';
  }
}

export default function RadialTelemetryInspector({ density = 'normal' }: RadialTelemetryInspectorProps) {
  const [events, setEvents] = useState<RadialTelemetryEvent[]>(() => readRadialTelemetry());
  const isCompact = density === 'compact';

  useEffect(
    () =>
      subscribeRadialTelemetry(() => {
        setEvents(readRadialTelemetry());
      }),
    [],
  );

  const summary = useMemo(() => {
    const mountedDurations = events
      .filter((event) => event.name === 'visible-mounted' && event.durationMs != null)
      .map((event) => event.durationMs as number);
    const markDurations = events
      .filter((event) => event.name === 'mark-select' && event.durationMs != null)
      .map((event) => event.durationMs as number);
    const cancels = events.filter((event) => event.name === 'mark-cancel').length;
    const aiDrafts = events.filter((event) => event.name === 'ai-draft').length;
    const aiSends = events.filter((event) => event.name === 'ai-send-now').length;

    return {
      mountedTypical: median(mountedDurations),
      markAverage: average(markDurations),
      cancels,
      aiDrafts,
      aiSends,
      aiPrompts: aiDrafts + aiSends,
      total: events.length,
    };
  }, [events]);

  const recentEventLimit = isCompact ? COMPACT_RECENT_EVENT_LIMIT : RECENT_EVENT_LIMIT;
  const recentEvents = useMemo(() => events.slice(-recentEventLimit).reverse(), [events, recentEventLimit]);
  const budget = useMemo(() => budgetStatus(summary.mountedTypical), [summary.mountedTypical]);
  const mastery = useMemo(() => buildGestureMastery(events), [events]);

  return (
    <section
      data-testid="radial-telemetry-inspector"
      data-density={density}
      aria-label="Radial wheel timing"
      className={cn('rounded border border-border/70 bg-background/45', isCompact ? 'p-1.5' : 'p-2')}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-foreground">
          <Activity className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span>Timing</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span
            data-testid="radial-telemetry-budget"
            className={cn('rounded border px-1.5 py-1 text-[9px] font-semibold leading-none', budget.className)}
          >
            {budget.label}
          </span>
          <button
            type="button"
            data-testid="radial-telemetry-clear"
            aria-label="Clear radial timing events"
            title="Clear timing"
            className="rounded border border-border/70 bg-muted/30 p-1.5 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            disabled={events.length === 0}
            onClick={clearRadialTelemetry}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className={cn('grid grid-cols-4 gap-1 text-center text-[10px] leading-tight', isCompact ? 'mt-1.5' : 'mt-2')}>
        <div className="rounded border border-border/70 bg-muted/25 px-2 py-1">
          <div data-testid="radial-telemetry-total" className="font-semibold text-foreground">
            {summary.total}
          </div>
          <div className="text-muted-foreground">events</div>
        </div>
        <div className={metricClasses(summary.mountedTypical)}>
          <div data-testid="radial-telemetry-open-average" className="font-semibold">
            {formatMs(summary.mountedTypical)}
          </div>
          <div className="text-muted-foreground">open</div>
        </div>
        <div className={metricClasses(summary.markAverage)}>
          <div data-testid="radial-telemetry-mark-average" className="font-semibold">
            {formatMs(summary.markAverage)}
          </div>
          <div className="text-muted-foreground">mark</div>
        </div>
        <div className="rounded border border-border/70 bg-muted/25 px-2 py-1">
          <div data-testid="radial-telemetry-cancel-count" className="font-semibold text-foreground">
            {summary.cancels}
          </div>
          <div className="text-muted-foreground">cancel</div>
        </div>
      </div>

      <div data-testid="radial-telemetry-budget-note" className="mt-1 truncate text-[10px] text-muted-foreground">
        {budget.note}
      </div>

      <div
        data-testid="radial-telemetry-mastery"
        data-status={mastery.status}
        className={cn(
          'flex min-w-0 items-center justify-between gap-2 rounded border px-2 py-1.5 text-[10px] leading-tight',
          isCompact ? 'mt-1.5' : 'mt-2',
          masteryClasses(mastery.status),
        )}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 shrink-0" />
          <div className="min-w-0">
            <div className="truncate font-semibold text-foreground">Gesture streak</div>
            <div data-testid="radial-telemetry-mastery-detail" className="truncate text-muted-foreground">
              {mastery.detail}
            </div>
          </div>
        </div>
        <div className="min-w-0 shrink-0 text-right">
          <div data-testid="radial-telemetry-mastery-value" className="max-w-28 truncate font-semibold">
            {mastery.value}
          </div>
          <div data-testid="radial-telemetry-mastery-status" className="text-muted-foreground">
            {mastery.statusLabel}
          </div>
        </div>
      </div>

      <div
        data-testid="radial-telemetry-ai-summary"
        className={cn('grid grid-cols-3 gap-1 text-center text-[10px] leading-tight', isCompact ? 'mt-1.5' : 'mt-2')}
      >
        <div className="rounded border border-sky-400/35 bg-sky-500/10 px-2 py-1 text-sky-100">
          <div data-testid="radial-telemetry-ai-total-count" className="font-semibold">
            {summary.aiPrompts}
          </div>
          <div className="text-muted-foreground">AI prompts</div>
        </div>
        <div className="rounded border border-fuchsia-400/35 bg-fuchsia-500/10 px-2 py-1 text-fuchsia-100">
          <div data-testid="radial-telemetry-ai-draft-count" className="font-semibold">
            {summary.aiDrafts}
          </div>
          <div className="text-muted-foreground">drafts</div>
        </div>
        <div className="rounded border border-emerald-400/35 bg-emerald-500/10 px-2 py-1 text-emerald-100">
          <div data-testid="radial-telemetry-ai-send-count" className="font-semibold">
            {summary.aiSends}
          </div>
          <div className="text-muted-foreground">sends</div>
        </div>
      </div>

      {recentEvents.length === 0 ? (
        <div
          data-testid="radial-telemetry-empty"
          className="mt-2 rounded border border-dashed border-border/70 px-2 py-2 text-center text-[10px] text-muted-foreground"
        >
          No radial events yet.
        </div>
      ) : (
        <div className={cn('space-y-1 overflow-y-auto pr-1', isCompact ? 'mt-1.5 max-h-20' : 'mt-2 max-h-28')}>
          {recentEvents.map((event, index) => (
            <div
              key={`${String(event.timestamp)}-${event.name}-${String(index)}`}
              data-testid={`radial-telemetry-row-${String(index)}`}
              className="flex items-center justify-between gap-2 rounded border border-border/55 bg-card/55 px-2 py-1 text-[10px]"
            >
              <span className="min-w-0 truncate font-medium text-foreground">{eventLabels[event.name]}</span>
              <span className="min-w-0 truncate text-right text-muted-foreground">{eventDetails(event)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
