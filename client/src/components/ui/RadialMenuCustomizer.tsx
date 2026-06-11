import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  Ban,
  BookmarkPlus,
  Check,
  ChevronDown,
  ChevronUp,
  History,
  Copy,
  Crosshair,
  FileJson,
  Pin,
  PinOff,
  Play,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  Trophy,
  Undo2,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import RadialTelemetryInspector from '@/components/ui/RadialTelemetryInspector';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import {
  getRadialCoverageEntries,
  getTargetSummary,
  getViewSummary,
  isRadialAiCommand,
  radialSlotMeta,
  type MenuContext,
  type RadialCoverageEntry,
  type RadialCoverageLevel,
  type RadialMenuItem,
  type RadialSlot,
} from '@/lib/radial-menu-actions';
import {
  applyRadialLayoutPreset,
  getRadialNamedPresets,
  getRadialPinnedPreset,
  getRadialPreferenceKey,
  getRadialSuggestionSuppressionKey,
  getRadialSuppressedSuggestions,
  parseRadialLayoutPreset,
  radialPreferencesStore,
  serializeRadialLayoutPreset,
  useRadialPreferences,
  type RadialNamedLayoutPreset,
} from '@/lib/radial-menu-preferences';
import { readRadialTelemetry, subscribeRadialTelemetry, type RadialTelemetryEvent } from '@/lib/radial-menu-telemetry';

interface RadialMenuCustomizerProps {
  items: RadialMenuItem[];
  context: MenuContext;
  position: { x: number; y: number };
  onMove: (commandId: string, slot: RadialSlot) => void;
  onReset: () => void;
  onClose: () => void;
}

const PANEL_WIDTH = 368;
const PANEL_HEIGHT = 500;
const PANEL_MARGIN = 12;
const COMPACT_PANEL_MARGIN = 8;
const COLLAPSED_PRACTICE_STATUS_ID = 'radial-customizer-collapsed-practice-status';
const GESTURE_SUGGESTION_MISS_THRESHOLD = 2;
const COMMAND_MASTERY_LOCKED_STREAK = 3;
const PRACTICE_MIN_DISTANCE_PX = 28;
const RECENT_COMMAND_LIMIT = 3;
const RECENT_COMMAND_EVENT_NAMES = new Set<RadialTelemetryEvent['name']>([
  'visible-select',
  'visible-repeat-ai',
  'ai-draft',
  'ai-send-now',
  'mark-select',
]);

function getViewportSize(): { width: number; height: number } {
  return {
    width: typeof window === 'undefined' ? 1366 : window.innerWidth,
    height: typeof window === 'undefined' ? 768 : window.innerHeight,
  };
}

function getPanelLayout(position: { x: number; y: number }): {
  compact: boolean;
  style: CSSProperties;
} {
  const { width: viewportWidth, height: viewportHeight } = getViewportSize();
  const compact = viewportWidth <= PANEL_WIDTH + PANEL_MARGIN * 2 || viewportHeight <= PANEL_HEIGHT + PANEL_MARGIN * 2;

  if (compact) {
    return {
      compact,
      style: {
        left: COMPACT_PANEL_MARGIN,
        top: COMPACT_PANEL_MARGIN,
        width: `calc(100vw - ${String(COMPACT_PANEL_MARGIN * 2)}px)`,
        height: `calc(100dvh - ${String(COMPACT_PANEL_MARGIN * 2)}px)`,
      },
    };
  }

  return {
    compact,
    style: {
      left: Math.max(PANEL_MARGIN, Math.min(position.x + 24, viewportWidth - PANEL_WIDTH - PANEL_MARGIN)),
      top: Math.max(PANEL_MARGIN, Math.min(position.y - 180, viewportHeight - PANEL_HEIGHT - PANEL_MARGIN)),
    },
  };
}

function slotButtonClasses(active: boolean): string {
  return cn(
    'h-7 min-w-7 rounded border px-1 text-[9px] font-semibold leading-none transition-colors',
    active
      ? 'border-primary bg-primary/20 text-primary shadow-sm'
      : 'border-border/70 bg-muted/25 text-muted-foreground hover:border-primary/50 hover:bg-primary/10 hover:text-foreground',
  );
}

const ORDERED_SLOTS = Object.keys(radialSlotMeta).map((slot) => Number(slot) as RadialSlot);
const PREVIEW_SIZE = 184;
const PREVIEW_CENTER = PREVIEW_SIZE / 2;
const PREVIEW_SLOT_RADIUS = 66;
const PREVIEW_LABEL_RADIUS = 80;

function itemSignature(items: RadialMenuItem[]): string {
  return items.map((item) => `${item.id}:${String(item.slot)}`).join('|');
}

function getCommandSearchText(item: RadialMenuItem): string {
  return [item.label, item.description, item.group, item.hint, radialSlotMeta[item.slot].direction]
    .join(' ')
    .toLowerCase();
}

function matchesCommandQuery(item: RadialMenuItem, query: string): boolean {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) {
    return true;
  }

  const searchText = getCommandSearchText(item);
  return terms.every((term) => searchText.includes(term));
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

function slotFromAltShortcut(event: ReactKeyboardEvent): RadialSlot | null {
  if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !/^[1-8]$/.test(event.key)) {
    return null;
  }

  return (Number(event.key) - 1) as RadialSlot;
}

function slotPoint(slot: RadialSlot, radius: number): { x: number; y: number } {
  const angle = ((-90 + slot * 45) * Math.PI) / 180;
  return {
    x: PREVIEW_CENTER + radius * Math.cos(angle),
    y: PREVIEW_CENTER + radius * Math.sin(angle),
  };
}

function slotFromVector(dx: number, dy: number): RadialSlot {
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const slot = Math.round((angle + 90) / 45);
  return (((slot % 8) + 8) % 8) as RadialSlot;
}

function slotTone(group: RadialMenuItem['group'], destructive?: boolean): string {
  if (destructive) {
    return 'border-red-300/60 bg-red-500/20 text-red-50';
  }
  switch (group) {
    case 'create':
      return 'border-emerald-300/55 bg-emerald-500/15 text-emerald-50';
    case 'transform':
      return 'border-sky-300/55 bg-sky-500/15 text-sky-50';
    case 'connect':
      return 'border-cyan-300/55 bg-cyan-500/15 text-cyan-50';
    case 'inspect':
      return 'border-teal-300/55 bg-teal-500/15 text-teal-50';
    case 'run':
      return 'border-amber-300/55 bg-amber-500/15 text-amber-50';
    case 'delete':
      return 'border-red-300/60 bg-red-500/20 text-red-50';
    case 'edit':
      return 'border-blue-300/55 bg-blue-500/15 text-blue-50';
    case 'reuse':
      return 'border-lime-300/55 bg-lime-500/15 text-lime-50';
  }
}

function radialCoverageLevelLabel(level: RadialCoverageLevel): string {
  switch (level) {
    case 'full':
      return 'Full';
    case 'ready':
      return 'Ready';
    case 'thin':
      return 'Thin';
    case 'empty':
      return 'Empty';
  }
}

function radialCoverageRank(entry: RadialCoverageEntry, context: MenuContext): number {
  if (entry.context.view === context.view && entry.context.target === context.target) {
    return 0;
  }
  if (entry.context.view === context.view) {
    return 1;
  }
  if (entry.coverageLevel === 'empty') {
    return 2;
  }
  if (entry.coverageLevel === 'thin') {
    return 3;
  }
  return 4;
}

function sortRadialCoverageEntries(entries: RadialCoverageEntry[], context: MenuContext): RadialCoverageEntry[] {
  return [...entries].sort((a, b) => {
    const rankDiff = radialCoverageRank(a, context) - radialCoverageRank(b, context);
    if (rankDiff !== 0) {
      return rankDiff;
    }
    return `${a.viewLabel} ${a.targetLabel}`.localeCompare(`${b.viewLabel} ${b.targetLabel}`);
  });
}

function radialCoverageCellClasses(current: boolean): string {
  return cn(
    'min-w-0 rounded border px-1.5 py-1 text-left transition-colors',
    'data-[coverage=full]:border-emerald-300/45 data-[coverage=full]:bg-emerald-500/10 data-[coverage=full]:text-emerald-100',
    'data-[coverage=ready]:border-primary/35 data-[coverage=ready]:bg-primary/10 data-[coverage=ready]:text-primary',
    'data-[coverage=thin]:border-amber-300/45 data-[coverage=thin]:bg-amber-500/10 data-[coverage=thin]:text-amber-100',
    'data-[coverage=empty]:border-border/60 data-[coverage=empty]:bg-muted/20 data-[coverage=empty]:text-muted-foreground',
    current && 'outline outline-1 outline-primary/65',
  );
}

function coachSlotClasses(active: boolean, changed: boolean, destructive?: boolean): string {
  return cn(
    'min-h-12 rounded border px-2 py-1 text-left transition-colors',
    destructive
      ? 'border-red-300/45 bg-red-500/10 text-red-50 hover:border-red-200/70'
      : 'border-border/65 bg-background/45 text-foreground hover:border-primary/45 hover:bg-primary/10',
    active && 'border-primary/70 bg-primary/15 ring-1 ring-primary/45',
    changed && 'outline outline-1 outline-primary/65',
  );
}

function moveDraftItem(items: RadialMenuItem[], commandId: string, slot: RadialSlot): RadialMenuItem[] {
  const moving = items.find((item) => item.id === commandId);
  if (!moving || moving.customizable === false) {
    return items;
  }

  const existing = items.find((item) => item.id !== commandId && item.slot === slot && item.customizable !== false);
  return items
    .map((item) => {
      if (item.id === moving.id) {
        return { ...item, slot, hint: radialSlotMeta[slot].direction };
      }
      if (existing && item.id === existing.id) {
        return { ...item, slot: moving.slot, hint: radialSlotMeta[moving.slot].direction };
      }
      return item;
    })
    .sort((a, b) => a.slot - b.slot);
}

type PresetStatus = {
  tone: 'neutral' | 'success' | 'error';
  message: string;
};

type GestureSlotStats = {
  marks: number;
  misses: number;
  averageMs: number | null;
  commandMisses: Record<string, number>;
};

type GestureCoachInsights = {
  fastest: { slot: RadialSlot; averageMs: number } | null;
  watch: { slot: RadialSlot; misses: number } | null;
};

type GestureCoachSuggestion = {
  commandId: string;
  commandLabel: string;
  slot: RadialSlot;
  misses: number;
  source: 'command' | 'slot';
  impactLabel: string;
};

type CommandMasteryStatus = 'trained' | 'building' | 'cold';
type CommandMasteryFilter = 'all' | CommandMasteryStatus;
type CommandMasteryCounts = Record<CommandMasteryStatus, number>;

type CommandMastery = {
  status: CommandMasteryStatus;
  streak: number;
  label: string;
  detail: string;
};

type RecentCommandItem = {
  item: RadialMenuItem;
  count: number;
  lastUsedAt: number;
  direction: string;
};

type SmartLayoutMoveReason = 'preset' | 'recent-home' | 'gesture-miss' | 'coach-suggestion' | 'swap';

type SmartLayoutMove = {
  commandId: string;
  label: string;
  fromSlot: RadialSlot;
  toSlot: RadialSlot;
  fromDirection: string;
  toDirection: string;
  reasonIds: SmartLayoutMoveReason[];
  reasonLabel: string;
  evidence: string;
};

type SmartLayoutPreviewSlot = {
  slot: RadialSlot;
  direction: string;
  item: RadialMenuItem | null;
  move: SmartLayoutMove | null;
  changed: boolean;
};

type SmartLayoutSuggestion = {
  items: RadialMenuItem[];
  moves: SmartLayoutMove[];
  changeCount: number;
  recentSignalCount: number;
  semanticMoveCount: number;
  frictionMisses: number;
  presetId: string | null;
  presetName: string | null;
  primaryCommandId: string;
  summary: string;
  detail: string;
};

type PracticeStatus = 'idle' | 'aiming' | 'hit' | 'miss' | 'short';
type PracticeRecord = {
  attempts: number;
  hits: number;
  streak: number;
  status: PracticeStatus;
  lastDirection?: string;
};

type PracticeQueueProgress = {
  total: number;
  completed: number;
  remaining: number;
};
type PracticeQueueMode = 'cold' | 'replay';
type PracticeHeatStatus = 'weak' | 'hit' | 'tried' | 'idle';
type PracticeHeatItem = {
  item: RadialMenuItem;
  record: PracticeRecord;
  status: PracticeHeatStatus;
};
type CollapsedPracticeState = 'clean' | 'replay' | 'idle';

const COMMAND_MASTERY_FILTERS: Array<{ id: CommandMasteryFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'trained', label: 'Trained' },
  { id: 'building', label: 'Building' },
  { id: 'cold', label: 'Cold' },
];

function emptyGestureStats(): Record<RadialSlot, GestureSlotStats> {
  return ORDERED_SLOTS.reduce(
    (stats, slot) => {
      stats[slot] = { marks: 0, misses: 0, averageMs: null, commandMisses: {} };
      return stats;
    },
    {} as Record<RadialSlot, GestureSlotStats>,
  );
}

function formatGestureUsage(stats: GestureSlotStats): string {
  if (stats.marks === 0 && stats.misses === 0) {
    return 'No marks';
  }
  const markLabel = `${String(stats.marks)} mark${stats.marks === 1 ? '' : 's'}`;
  return stats.misses > 0 ? `${markLabel} / ${String(stats.misses)} miss${stats.misses === 1 ? '' : 'es'}` : markLabel;
}

function buildGestureStats(events: RadialTelemetryEvent[], context: MenuContext): Record<RadialSlot, GestureSlotStats> {
  const stats = emptyGestureStats();
  const durationBySlot = new Map<RadialSlot, number[]>();

  events.forEach((event) => {
    if (event.view !== context.view || event.target !== context.target) {
      return;
    }

    if (event.slot == null) {
      return;
    }

    if (event.name === 'mark-select' || event.name === 'mark-confirm-required') {
      stats[event.slot].marks += 1;
      if (event.durationMs != null) {
        durationBySlot.set(event.slot, [...(durationBySlot.get(event.slot) ?? []), event.durationMs]);
      }
      return;
    }

    if (event.name === 'mark-cancel') {
      stats[event.slot].misses += 1;
      if (event.commandId) {
        stats[event.slot].commandMisses[event.commandId] = (stats[event.slot].commandMisses[event.commandId] ?? 0) + 1;
      }
    }
  });

  durationBySlot.forEach((durations, slot) => {
    stats[slot].averageMs = durations.reduce((total, duration) => total + duration, 0) / durations.length;
  });

  return stats;
}

function buildGestureInsights(stats: Record<RadialSlot, GestureSlotStats>): GestureCoachInsights {
  const fastest =
    ORDERED_SLOTS.map((slot) => ({ slot, averageMs: stats[slot].averageMs }))
      .filter((entry): entry is { slot: RadialSlot; averageMs: number } => entry.averageMs != null)
      .sort((a, b) => a.averageMs - b.averageMs)[0] ?? null;

  const watch =
    ORDERED_SLOTS.map((slot) => ({ slot, misses: stats[slot].misses, marks: stats[slot].marks }))
      .filter((entry) => entry.misses > 0)
      .sort((a, b) => b.misses - a.misses || a.marks - b.marks || a.slot - b.slot)[0] ?? null;

  return {
    fastest,
    watch: watch ? { slot: watch.slot, misses: watch.misses } : null,
  };
}

function formatGestureMisses(count: number): string {
  return `${String(count)} miss${count === 1 ? '' : 'es'}`;
}

function buildGestureSuggestion(
  stats: Record<RadialSlot, GestureSlotStats>,
  selectedItem: RadialMenuItem | undefined,
  slotWatch: GestureCoachInsights['watch'],
  itemBySlot: Map<RadialSlot, RadialMenuItem>,
): GestureCoachSuggestion | null {
  if (!selectedItem || selectedItem.customizable === false) {
    return null;
  }

  const getImpactLabel = (slot: RadialSlot): string => {
    const displacedItem = itemBySlot.get(slot);
    return displacedItem && displacedItem.id !== selectedItem.id ? `Swap ${displacedItem.label}` : 'Empty slot';
  };

  const commandMiss =
    ORDERED_SLOTS.map((slot) => ({
      slot,
      misses: stats[slot].commandMisses[selectedItem.id] ?? 0,
    }))
      .filter((entry) => entry.slot !== selectedItem.slot && entry.misses >= GESTURE_SUGGESTION_MISS_THRESHOLD)
      .sort((a, b) => b.misses - a.misses || a.slot - b.slot)[0] ?? null;

  if (commandMiss) {
    return {
      commandId: selectedItem.id,
      commandLabel: selectedItem.label,
      slot: commandMiss.slot,
      misses: commandMiss.misses,
      source: 'command',
      impactLabel: getImpactLabel(commandMiss.slot),
    };
  }

  if (!slotWatch || slotWatch.misses < GESTURE_SUGGESTION_MISS_THRESHOLD || selectedItem.slot === slotWatch.slot) {
    return null;
  }

  return {
    commandId: selectedItem.id,
    commandLabel: selectedItem.label,
    slot: slotWatch.slot,
    misses: slotWatch.misses,
    source: 'slot',
    impactLabel: getImpactLabel(slotWatch.slot),
  };
}

function commandMasteryClasses(status: CommandMasteryStatus): string {
  switch (status) {
    case 'trained':
      return 'border-emerald-300/40 bg-emerald-500/10 text-emerald-100';
    case 'building':
      return 'border-amber-300/40 bg-amber-500/10 text-amber-100';
    case 'cold':
      return 'border-border/70 bg-muted/25 text-muted-foreground';
  }
}

function buildCommandMastery(
  items: RadialMenuItem[],
  events: RadialTelemetryEvent[],
  context: MenuContext,
): Record<string, CommandMastery> {
  return items.reduce(
    (mastery, item) => {
      let streak = 0;

      for (let index = events.length - 1; index >= 0; index -= 1) {
        const event = events[index];
        if (
          event.view !== context.view ||
          event.target !== context.target ||
          event.commandId !== item.id ||
          event.slot !== item.slot
        ) {
          continue;
        }

        if (event.name === 'mark-select') {
          streak += 1;
          continue;
        }

        if (event.name === 'mark-cancel' || event.name === 'mark-confirm-required') {
          break;
        }
      }

      const status: CommandMasteryStatus =
        streak >= COMMAND_MASTERY_LOCKED_STREAK ? 'trained' : streak > 0 ? 'building' : 'cold';
      mastery[item.id] = {
        status,
        streak,
        label: status === 'cold' ? 'Cold' : `${String(streak)}x`,
        detail:
          status === 'trained'
            ? `${item.label} trained on ${radialSlotMeta[item.slot].direction}`
            : status === 'building'
              ? `${item.label} building on ${radialSlotMeta[item.slot].direction}`
              : `${item.label} has no current ${radialSlotMeta[item.slot].direction} streak`,
      };

      return mastery;
    },
    {} as Record<string, CommandMastery>,
  );
}

function matchesMasteryFilter(
  item: RadialMenuItem,
  masteryById: Record<string, CommandMastery>,
  filter: CommandMasteryFilter,
): boolean {
  return filter === 'all' || masteryById[item.id]?.status === filter;
}

function formatMasteryCountLabel(count: number, label: CommandMasteryStatus): string {
  return `${String(count)} ${label}`;
}

function formatReplayCountLabel(count: number): string {
  return `${String(count)} replay${count === 1 ? '' : 's'}`;
}

function formatRecentCommandUsage(count: number): string {
  return `${String(count)} use${count === 1 ? '' : 's'}`;
}

function formatSmartLayoutChangeCount(count: number): string {
  return `${String(count)} staged move${count === 1 ? '' : 's'}`;
}

function buildRecentCommandItems(
  items: RadialMenuItem[],
  events: RadialTelemetryEvent[],
  context: MenuContext,
): RecentCommandItem[] {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const usageById = new Map<string, { count: number; lastUsedAt: number }>();

  events.forEach((event) => {
    if (
      event.view !== context.view ||
      event.target !== context.target ||
      !event.commandId ||
      !RECENT_COMMAND_EVENT_NAMES.has(event.name) ||
      !itemById.has(event.commandId)
    ) {
      return;
    }

    const usage = usageById.get(event.commandId);
    usageById.set(event.commandId, {
      count: (usage?.count ?? 0) + 1,
      lastUsedAt: Math.max(usage?.lastUsedAt ?? 0, event.timestamp),
    });
  });

  return Array.from(usageById.entries())
    .map(([commandId, usage]) => {
      const item = itemById.get(commandId);
      return item
        ? {
            item,
            count: usage.count,
            lastUsedAt: usage.lastUsedAt,
            direction: radialSlotMeta[item.slot].direction,
          }
        : null;
    })
    .filter((recent): recent is RecentCommandItem => recent != null)
    .sort(
      (a, b) =>
        b.lastUsedAt - a.lastUsedAt ||
        b.count - a.count ||
        a.item.label.localeCompare(b.item.label, undefined, { sensitivity: 'base' }),
    )
    .slice(0, RECENT_COMMAND_LIMIT);
}

function getGroupHomeSlot(item: RadialMenuItem): RadialSlot | null {
  return ORDERED_SLOTS.find((slot) => radialSlotMeta[slot].group === item.group && item.customizable !== false) ?? null;
}

function getBestFrictionSlot(
  commandId: string,
  currentSlot: RadialSlot,
  stats: Record<RadialSlot, GestureSlotStats>,
): { slot: RadialSlot; misses: number } | null {
  return (
    ORDERED_SLOTS.map((slot) => ({
      slot,
      misses: stats[slot].commandMisses[commandId] ?? 0,
    }))
      .filter((entry) => entry.slot !== currentSlot && entry.misses >= GESTURE_SUGGESTION_MISS_THRESHOLD)
      .sort((a, b) => b.misses - a.misses || a.slot - b.slot)[0] ?? null
  );
}

function countSlotChanges(before: RadialMenuItem[], after: RadialMenuItem[]): number {
  const beforeSlots = new Map(before.map((item) => [item.id, item.slot]));
  return after.filter((item) => beforeSlots.get(item.id) !== item.slot).length;
}

function getFirstChangedCommandId(before: RadialMenuItem[], after: RadialMenuItem[]): string | null {
  const beforeSlots = new Map(before.map((item) => [item.id, item.slot]));
  return after.find((item) => beforeSlots.get(item.id) !== item.slot)?.id ?? null;
}

function smartMoveReasonLabel(reason: SmartLayoutMoveReason): string {
  switch (reason) {
    case 'preset':
      return 'Preset';
    case 'recent-home':
      return 'Recent home';
    case 'gesture-miss':
      return 'Gesture miss';
    case 'coach-suggestion':
      return 'Coach';
    case 'swap':
      return 'Swap';
  }
}

function addSmartMoveReason(
  reasonMap: Map<string, { reasons: Set<SmartLayoutMoveReason>; evidence: string[] }>,
  commandId: string,
  reason: SmartLayoutMoveReason,
  evidence: string,
): void {
  const current = reasonMap.get(commandId) ?? { reasons: new Set<SmartLayoutMoveReason>(), evidence: [] };
  current.reasons.add(reason);
  if (!current.evidence.includes(evidence)) {
    current.evidence.push(evidence);
  }
  reasonMap.set(commandId, current);
}

function recordSmartMoveReasons(
  reasonMap: Map<string, { reasons: Set<SmartLayoutMoveReason>; evidence: string[] }>,
  before: RadialMenuItem[],
  after: RadialMenuItem[],
  intendedCommandId: string,
  reason: Exclude<SmartLayoutMoveReason, 'swap'>,
  evidence: string,
): void {
  const beforeSlots = new Map(before.map((item) => [item.id, item.slot]));
  const intendedLabel = before.find((item) => item.id === intendedCommandId)?.label ?? intendedCommandId;

  after.forEach((item) => {
    if (beforeSlots.get(item.id) === item.slot) {
      return;
    }

    if (item.id === intendedCommandId) {
      addSmartMoveReason(reasonMap, item.id, reason, evidence);
      return;
    }

    addSmartMoveReason(reasonMap, item.id, 'swap', `Made room for ${intendedLabel}`);
  });
}

function buildSmartLayoutMoves(
  before: RadialMenuItem[],
  after: RadialMenuItem[],
  reasonMap: Map<string, { reasons: Set<SmartLayoutMoveReason>; evidence: string[] }>,
): SmartLayoutMove[] {
  const beforeById = new Map(before.map((item) => [item.id, item]));

  return after
    .map((item) => {
      const previous = beforeById.get(item.id);
      if (!previous || previous.slot === item.slot) {
        return null;
      }

      const reasonEntry = reasonMap.get(item.id);
      const reasonIds = reasonEntry ? Array.from(reasonEntry.reasons) : (['swap'] as SmartLayoutMoveReason[]);
      const evidence = reasonEntry?.evidence.join(' / ') ?? 'Draft slot conflict';
      return {
        commandId: item.id,
        label: item.label,
        fromSlot: previous.slot,
        toSlot: item.slot,
        fromDirection: radialSlotMeta[previous.slot].direction,
        toDirection: radialSlotMeta[item.slot].direction,
        reasonIds,
        reasonLabel: reasonIds.map(smartMoveReasonLabel).join(' + '),
        evidence,
      };
    })
    .filter((move): move is SmartLayoutMove => move != null)
    .sort((a, b) => {
      const aDirect = a.reasonIds.some((reason) => reason !== 'swap');
      const bDirect = b.reasonIds.some((reason) => reason !== 'swap');
      if (aDirect !== bDirect) {
        return aDirect ? -1 : 1;
      }
      return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
    });
}

function buildSmartLayoutPreviewSlots(items: RadialMenuItem[], moves: SmartLayoutMove[]): SmartLayoutPreviewSlot[] {
  const itemBySlot = new Map(items.map((item) => [item.slot, item]));
  const moveByCommandId = new Map(moves.map((move) => [move.commandId, move]));

  return ORDERED_SLOTS.map((slot) => {
    const item = itemBySlot.get(slot) ?? null;
    const move = item ? (moveByCommandId.get(item.id) ?? null) : null;
    return {
      slot,
      direction: radialSlotMeta[slot].direction,
      item,
      move,
      changed: move != null,
    };
  });
}

function buildSmartLayoutSuggestion(
  items: RadialMenuItem[],
  recentCommands: RecentCommandItem[],
  stats: Record<RadialSlot, GestureSlotStats>,
  selectedSuggestion: GestureCoachSuggestion | null,
  recommendedPreset: RadialNamedLayoutPreset | null,
): SmartLayoutSuggestion | null {
  let nextItems = recommendedPreset ? applyRadialLayoutPreset(items, recommendedPreset.slots) : items;
  const presetMoveCount = recommendedPreset ? countSlotChanges(items, nextItems) : 0;
  const moveReasonMap = new Map<string, { reasons: Set<SmartLayoutMoveReason>; evidence: string[] }>();
  if (recommendedPreset) {
    nextItems.forEach((item) => {
      if (items.find((candidate) => candidate.id === item.id)?.slot !== item.slot) {
        addSmartMoveReason(moveReasonMap, item.id, 'preset', `${recommendedPreset.name} preset`);
      }
    });
  }
  let semanticMoveCount = 0;
  let frictionMisses = 0;
  let primaryCommandId: string | null = null;

  recentCommands.forEach(({ item }) => {
    const currentItem = nextItems.find((candidate) => candidate.id === item.id);
    if (!currentItem || currentItem.customizable === false) {
      return;
    }

    const frictionSlot = getBestFrictionSlot(currentItem.id, currentItem.slot, stats);
    if (frictionSlot) {
      const movedItems = moveDraftItem(nextItems, currentItem.id, frictionSlot.slot);
      if (countSlotChanges(nextItems, movedItems) > 0) {
        recordSmartMoveReasons(
          moveReasonMap,
          nextItems,
          movedItems,
          currentItem.id,
          'gesture-miss',
          `${String(frictionSlot.misses)} tried toward ${radialSlotMeta[frictionSlot.slot].direction}`,
        );
        nextItems = movedItems;
        frictionMisses += frictionSlot.misses;
        primaryCommandId ??= currentItem.id;
      }
      return;
    }

    if ((stats[currentItem.slot].commandMisses[currentItem.id] ?? 0) >= GESTURE_SUGGESTION_MISS_THRESHOLD) {
      return;
    }

    const homeSlot = getGroupHomeSlot(currentItem);
    if (homeSlot != null && currentItem.slot !== homeSlot) {
      const movedItems = moveDraftItem(nextItems, currentItem.id, homeSlot);
      if (countSlotChanges(nextItems, movedItems) > 0) {
        recordSmartMoveReasons(
          moveReasonMap,
          nextItems,
          movedItems,
          currentItem.id,
          'recent-home',
          `Recent ${radialSlotMeta[homeSlot].label.toLowerCase()} home`,
        );
        nextItems = movedItems;
        semanticMoveCount += 1;
        primaryCommandId ??= currentItem.id;
      }
    }
  });

  if (selectedSuggestion) {
    const movedItems = moveDraftItem(nextItems, selectedSuggestion.commandId, selectedSuggestion.slot);
    if (countSlotChanges(nextItems, movedItems) > 0) {
      recordSmartMoveReasons(
        moveReasonMap,
        nextItems,
        movedItems,
        selectedSuggestion.commandId,
        'coach-suggestion',
        `${String(selectedSuggestion.misses)} coach miss${selectedSuggestion.misses === 1 ? '' : 'es'}`,
      );
      nextItems = movedItems;
      frictionMisses += selectedSuggestion.misses;
      primaryCommandId ??= selectedSuggestion.commandId;
    }
  }

  const changeCount = countSlotChanges(items, nextItems);
  if (changeCount === 0) {
    return null;
  }

  const moves = buildSmartLayoutMoves(items, nextItems, moveReasonMap);
  const detailParts = [
    recommendedPreset && presetMoveCount > 0 ? `${recommendedPreset.name} preset` : null,
    semanticMoveCount > 0 ? `${String(semanticMoveCount)} recent home${semanticMoveCount === 1 ? '' : 's'}` : null,
    frictionMisses > 0 ? `${String(frictionMisses)} gesture miss${frictionMisses === 1 ? '' : 'es'}` : null,
  ].filter((part): part is string => part != null);
  const fallbackCommandId = getFirstChangedCommandId(items, nextItems) ?? recentCommands[0]?.item.id ?? items[0]?.id;

  return {
    items: nextItems,
    moves,
    changeCount,
    recentSignalCount: recentCommands.length,
    semanticMoveCount,
    frictionMisses,
    presetId: recommendedPreset?.id ?? null,
    presetName: recommendedPreset?.name ?? null,
    primaryCommandId: primaryCommandId ?? fallbackCommandId,
    summary: formatSmartLayoutChangeCount(changeCount),
    detail: detailParts.length > 0 ? detailParts.join(' + ') : 'current wheel signals',
  };
}

function formatPracticeAttemptCount(count: number): string {
  return `${String(count)}x`;
}

function formatPracticeWeakCount(count: number): string {
  return `${String(count)} weak`;
}

function emptyPracticeRecord(): PracticeRecord {
  return {
    attempts: 0,
    hits: 0,
    streak: 0,
    status: 'idle',
  };
}

function getPracticeRecord(records: Record<string, PracticeRecord>, commandId: string | undefined): PracticeRecord {
  if (!commandId) {
    return emptyPracticeRecord();
  }
  return records[commandId] ?? emptyPracticeRecord();
}

function hasLocalPracticeHit(records: Record<string, PracticeRecord>, commandId: string): boolean {
  return getPracticeRecord(records, commandId).hits > 0;
}

function hasWeakLocalPractice(records: Record<string, PracticeRecord>, commandId: string): boolean {
  const record = getPracticeRecord(records, commandId);
  return (
    record.attempts > 0 &&
    (record.status === 'miss' || record.status === 'short' || (record.streak === 0 && record.hits < record.attempts))
  );
}

function getPracticeHeatStatus(record: PracticeRecord): PracticeHeatStatus {
  if (record.attempts === 0) {
    return 'idle';
  }

  if (record.status === 'miss' || record.status === 'short' || (record.streak === 0 && record.hits < record.attempts)) {
    return 'weak';
  }

  return record.hits > 0 ? 'hit' : 'tried';
}

function practiceHeatStatusWeight(status: PracticeHeatStatus): number {
  switch (status) {
    case 'weak':
      return 3;
    case 'tried':
      return 2;
    case 'hit':
      return 1;
    case 'idle':
      return 0;
  }
}

function practiceHeatClasses(status: PracticeHeatStatus): string {
  switch (status) {
    case 'weak':
      return 'border-amber-300/45 bg-amber-500/15 text-amber-100 focus-visible:ring-amber-300/70';
    case 'hit':
      return 'border-emerald-300/45 bg-emerald-500/15 text-emerald-100 focus-visible:ring-emerald-300/70';
    case 'tried':
      return 'border-cyan-300/40 bg-cyan-500/10 text-cyan-100 focus-visible:ring-cyan-300/70';
    case 'idle':
      return 'border-border/65 bg-muted/20 text-muted-foreground focus-visible:ring-primary/70';
  }
}

function buildPracticeHeatItems(items: RadialMenuItem[], records: Record<string, PracticeRecord>): PracticeHeatItem[] {
  return items
    .map((item) => {
      const record = getPracticeRecord(records, item.id);
      return {
        item,
        record,
        status: getPracticeHeatStatus(record),
      };
    })
    .sort((a, b) => {
      const attemptDelta = b.record.attempts - a.record.attempts;
      if (attemptDelta !== 0) {
        return attemptDelta;
      }

      const statusDelta = practiceHeatStatusWeight(b.status) - practiceHeatStatusWeight(a.status);
      if (statusDelta !== 0) {
        return statusDelta;
      }

      return a.item.slot - b.item.slot;
    });
}

function getNextPracticeQueueItem(
  queueItems: RadialMenuItem[],
  records: Record<string, PracticeRecord>,
  completedCommandId?: string,
): RadialMenuItem | null {
  if (queueItems.length === 0) {
    return null;
  }

  const currentIndex = queueItems.findIndex((item) => item.id === completedCommandId);
  const startIndex = currentIndex >= 0 ? currentIndex : -1;
  for (let offset = 1; offset <= queueItems.length; offset += 1) {
    const candidate = queueItems[(startIndex + offset) % queueItems.length];
    if (candidate.id !== completedCommandId && !hasLocalPracticeHit(records, candidate.id)) {
      return candidate;
    }
  }

  return null;
}

function getNextWeakPracticeItem(
  weakItems: RadialMenuItem[],
  records: Record<string, PracticeRecord>,
  completedCommandId?: string,
): RadialMenuItem | null {
  if (weakItems.length === 0) {
    return null;
  }

  const currentIndex = weakItems.findIndex((item) => item.id === completedCommandId);
  const startIndex = currentIndex >= 0 ? currentIndex : -1;
  for (let offset = 1; offset <= weakItems.length; offset += 1) {
    const candidate = weakItems[(startIndex + offset) % weakItems.length];
    if (candidate.id !== completedCommandId && hasWeakLocalPractice(records, candidate.id)) {
      return candidate;
    }
  }

  return null;
}

function practiceStatusLabel(record: PracticeRecord, item: RadialMenuItem | undefined): string {
  const targetDirection = item ? radialSlotMeta[item.slot].direction : 'N';
  switch (record.status) {
    case 'aiming':
      return `Aim ${targetDirection}`;
    case 'hit':
      return `Hit ${record.lastDirection ?? targetDirection}`;
    case 'miss':
      return `Miss ${record.lastDirection ?? targetDirection}`;
    case 'short':
      return 'Too short';
    case 'idle':
      return `Aim ${targetDirection}`;
  }
}

export default function RadialMenuCustomizer({
  items,
  context,
  position,
  onMove,
  onReset,
  onClose,
}: RadialMenuCustomizerProps) {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const practicePadRef = useRef<HTMLDivElement | null>(null);
  const practiceStartRef = useRef<{ x: number; y: number; commandId: string; slot: RadialSlot } | null>(null);
  const pendingPracticeFocusRef = useRef(false);
  const panelLayout = getPanelLayout(position);
  const committedSignature = itemSignature(items);
  const radialPreferences = useRadialPreferences();
  const layoutKey = useMemo(() => getRadialPreferenceKey(context), [context.target, context.view]);
  const [draftItems, setDraftItems] = useState<RadialMenuItem[]>(() => items);
  const [selectedCommandId, setSelectedCommandId] = useState<string | null>(() => items[0]?.id ?? null);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [masteryFilter, setMasteryFilter] = useState<CommandMasteryFilter>('all');
  const [presetName, setPresetName] = useState('My wheel');
  const [presetText, setPresetText] = useState('');
  const [presetStatus, setPresetStatus] = useState<PresetStatus>({
    tone: 'neutral',
    message: 'Preset ready',
  });
  const [dismissedSuggestionKey, setDismissedSuggestionKey] = useState<string | null>(null);
  const [telemetryEvents, setTelemetryEvents] = useState<RadialTelemetryEvent[]>(() => readRadialTelemetry());
  const [practiceByCommand, setPracticeByCommand] = useState<Record<string, PracticeRecord>>({});
  const [practiceVector, setPracticeVector] = useState<{ dx: number; dy: number } | null>(null);
  const [practiceQueueActive, setPracticeQueueActive] = useState(false);
  const [practiceQueueMode, setPracticeQueueMode] = useState<PracticeQueueMode>('cold');
  const [practiceQueueMessage, setPracticeQueueMessage] = useState('Queue ready');
  const savedPresets = useMemo(
    () => getRadialNamedPresets(radialPreferences, layoutKey),
    [layoutKey, radialPreferences],
  );
  const pinnedPreset = useMemo(
    () => getRadialPinnedPreset(radialPreferences, layoutKey),
    [layoutKey, radialPreferences],
  );
  const pinnedPresetId = pinnedPreset?.id ?? null;
  const contextSummary = `${getViewSummary(context)} / ${getTargetSummary(context)}`;
  const radialCoverageEntries = useMemo(() => getRadialCoverageEntries(), []);
  const sortedRadialCoverageEntries = useMemo(
    () => sortRadialCoverageEntries(radialCoverageEntries, context),
    [context.target, context.view, radialCoverageEntries],
  );
  const currentRadialCoverage = useMemo(
    () =>
      radialCoverageEntries.find(
        (entry) => entry.context.view === context.view && entry.context.target === context.target,
      ) ?? null,
    [context.target, context.view, radialCoverageEntries],
  );
  const radialCoverageReadyCount = radialCoverageEntries.filter((entry) => entry.commandCount > 0).length;
  const radialCoverageFullCount = radialCoverageEntries.filter((entry) => entry.coverageLevel === 'full').length;
  const radialCoverageAiContextCount = radialCoverageEntries.filter((entry) => entry.aiCommandCount > 0).length;
  const pinnedPresetStatus = pinnedPreset
    ? `${pinnedPreset.name} pinned to ${contextSummary}.`
    : `No preset pinned to ${contextSummary}.`;
  const recommendedPreset = pinnedPreset ? null : (savedPresets[0] ?? null);
  const recommendedPresetStatus = recommendedPreset
    ? `Suggested: ${recommendedPreset.name} for ${contextSummary}.`
    : '';
  const committedSlotById = useMemo(() => new Map(items.map((item) => [item.id, item.slot])), [items]);
  const draftChangeCount = useMemo(
    () => draftItems.filter((item) => committedSlotById.get(item.id) !== item.slot).length,
    [committedSlotById, draftItems],
  );
  const selectedItem = useMemo(
    () => draftItems.find((item) => item.id === selectedCommandId) ?? draftItems[0],
    [draftItems, selectedCommandId],
  );
  const draftItemBySlot = useMemo(() => new Map(draftItems.map((item) => [item.slot, item])), [draftItems]);
  const gestureStatsBySlot = useMemo(
    () => buildGestureStats(telemetryEvents, context),
    [context.target, context.view, telemetryEvents],
  );
  const gestureInsights = useMemo(() => buildGestureInsights(gestureStatsBySlot), [gestureStatsBySlot]);
  const gestureSuggestion = useMemo(
    () => buildGestureSuggestion(gestureStatsBySlot, selectedItem, gestureInsights.watch, draftItemBySlot),
    [draftItemBySlot, gestureInsights.watch, gestureStatsBySlot, selectedItem],
  );
  const commandMasteryById = useMemo(
    () => buildCommandMastery(draftItems, telemetryEvents, context),
    [context.target, context.view, draftItems, telemetryEvents],
  );
  const recentCommandItems = useMemo(
    () => buildRecentCommandItems(draftItems, telemetryEvents, context),
    [context.target, context.view, draftItems, telemetryEvents],
  );
  const masteryCounts = useMemo(
    () =>
      draftItems.reduce(
        (counts, item) => {
          counts[commandMasteryById[item.id]?.status ?? 'cold'] += 1;
          return counts;
        },
        { trained: 0, building: 0, cold: 0 } as CommandMasteryCounts,
      ),
    [commandMasteryById, draftItems],
  );
  const gestureSuggestionKey = gestureSuggestion
    ? `${gestureSuggestion.source}:${gestureSuggestion.commandId}:${String(gestureSuggestion.slot)}:${String(gestureSuggestion.misses)}`
    : null;
  const gestureSuggestionSuppressionKey = gestureSuggestion
    ? getRadialSuggestionSuppressionKey(gestureSuggestion.commandId, gestureSuggestion.slot)
    : null;
  const suppressedGestureSuggestions = useMemo(
    () => new Set(getRadialSuppressedSuggestions(radialPreferences, layoutKey)),
    [layoutKey, radialPreferences],
  );
  const visibleGestureSuggestion =
    (gestureSuggestionKey && gestureSuggestionKey === dismissedSuggestionKey) ||
    (gestureSuggestionSuppressionKey && suppressedGestureSuggestions.has(gestureSuggestionSuppressionKey))
      ? null
      : gestureSuggestion;
  const smartLayoutSuggestion = useMemo(
    () =>
      buildSmartLayoutSuggestion(
        draftItems,
        recentCommandItems,
        gestureStatsBySlot,
        visibleGestureSuggestion,
        recommendedPreset,
      ),
    [draftItems, gestureStatsBySlot, recentCommandItems, recommendedPreset, visibleGestureSuggestion],
  );
  const smartLayoutPreviewSlots = useMemo(
    () =>
      smartLayoutSuggestion
        ? buildSmartLayoutPreviewSlots(smartLayoutSuggestion.items, smartLayoutSuggestion.moves)
        : [],
    [smartLayoutSuggestion],
  );
  const visibleDraftItems = useMemo(
    () =>
      draftItems.filter(
        (item) =>
          matchesCommandQuery(item, commandQuery) && matchesMasteryFilter(item, commandMasteryById, masteryFilter),
      ),
    [commandMasteryById, commandQuery, draftItems, masteryFilter],
  );
  const coldPracticeItems = useMemo(
    () => draftItems.filter((item) => (commandMasteryById[item.id]?.status ?? 'cold') === 'cold'),
    [commandMasteryById, draftItems],
  );
  const firstColdItem = useMemo(() => coldPracticeItems[0] ?? null, [coldPracticeItems]);
  const weakPracticeItems = useMemo(
    () => coldPracticeItems.filter((item) => hasWeakLocalPractice(practiceByCommand, item.id)),
    [coldPracticeItems, practiceByCommand],
  );
  const firstWeakPracticeItem = useMemo(() => weakPracticeItems[0] ?? null, [weakPracticeItems]);
  const practiceQueueProgress = useMemo(
    () =>
      coldPracticeItems.reduce(
        (progress, item) => {
          progress.total += 1;
          if (hasLocalPracticeHit(practiceByCommand, item.id)) {
            progress.completed += 1;
          }
          progress.remaining = progress.total - progress.completed;
          return progress;
        },
        { total: 0, completed: 0, remaining: 0 } as PracticeQueueProgress,
      ),
    [coldPracticeItems, practiceByCommand],
  );
  const practiceHeatItems = useMemo(
    () => buildPracticeHeatItems(coldPracticeItems, practiceByCommand),
    [coldPracticeItems, practiceByCommand],
  );
  const practiceHeatTriedCount = practiceHeatItems.filter(({ record }) => record.attempts > 0).length;
  const practiceHeatIdleCount = practiceHeatItems.length - practiceHeatTriedCount;
  const practiceHeatSummary =
    practiceHeatItems.length === 0
      ? 'All trained'
      : `${String(practiceHeatTriedCount)} tried / ${String(practiceHeatIdleCount)} idle`;
  const practiceRecapVisible =
    practiceQueueProgress.total > 0 && practiceQueueProgress.remaining === 0 && practiceHeatTriedCount > 0;
  const practiceRecapAttempts = practiceHeatItems.reduce((count, { record }) => count + record.attempts, 0);
  const practiceRecapHits = practiceHeatItems.reduce((count, { record }) => count + record.hits, 0);
  const practiceRecapHitLabel = `${String(practiceRecapHits)}/${String(practiceRecapAttempts)} hits`;
  const practiceRecapNextLabel = firstWeakPracticeItem
    ? `${firstWeakPracticeItem.label} ${radialSlotMeta[firstWeakPracticeItem.slot].direction}`
    : 'Replay clear';
  const practiceCleanRun =
    practiceRecapVisible &&
    practiceRecapAttempts > 0 &&
    practiceRecapHits === practiceRecapAttempts &&
    weakPracticeItems.length === 0;
  const practiceQueueProgressLabel =
    practiceQueueProgress.total === 0
      ? 'All trained'
      : `${String(practiceQueueProgress.completed)}/${String(practiceQueueProgress.total)}`;
  const collapsedPracticeState: CollapsedPracticeState = practiceCleanRun
    ? 'clean'
    : weakPracticeItems.length > 0
      ? 'replay'
      : 'idle';
  const collapsedPracticeReplayCleared =
    practiceQueueActive &&
    practiceQueueMode === 'replay' &&
    practiceQueueMessage === 'Replay clear' &&
    weakPracticeItems.length === 0 &&
    practiceRecapAttempts > 0 &&
    practiceRecapHits > 0;
  const collapsedPracticeLabel =
    collapsedPracticeState === 'clean'
      ? 'Clean run'
      : collapsedPracticeState === 'replay'
        ? formatReplayCountLabel(weakPracticeItems.length)
        : practiceQueueProgress.total === 0
          ? 'All trained'
          : `Practice ${practiceQueueProgressLabel}`;
  const collapsedPracticeTitle =
    collapsedPracticeState === 'clean'
      ? `Clean local practice run: ${practiceRecapHitLabel}`
      : collapsedPracticeState === 'replay'
        ? `${formatReplayCountLabel(weakPracticeItems.length)} ready in practice replay`
        : collapsedPracticeReplayCleared
          ? `Replay cleared: ${practiceQueueProgressLabel} local practice coverage`
          : practiceQueueProgress.total === 0
            ? 'No cold commands need practice'
            : `${practiceQueueProgressLabel} local practice coverage`;
  const collapsedPracticeStatus =
    collapsedPracticeState === 'clean'
      ? `Practice status: clean local run, ${practiceRecapHitLabel}.`
      : collapsedPracticeState === 'replay'
        ? `Practice status: ${formatReplayCountLabel(weakPracticeItems.length)} ready for replay, ${practiceQueueProgressLabel} coverage.`
        : collapsedPracticeReplayCleared
          ? `Practice status: replay cleared, ${practiceQueueProgressLabel} local practice coverage.`
          : practiceQueueProgress.total === 0
            ? 'Practice status: all commands trained.'
            : `Practice status: ${practiceQueueProgressLabel} local practice coverage.`;
  const collapsedPracticeHelp =
    collapsedPracticeState === 'clean'
      ? 'Clean practice run. Every local target was hit, so replay is clear.'
      : collapsedPracticeState === 'replay'
        ? `${formatReplayCountLabel(weakPracticeItems.length)} queued for replay. Expand practice to retry weak gestures safely.`
        : collapsedPracticeReplayCleared
          ? 'Replay cleared. Weak gestures are back under control.'
          : practiceQueueProgress.total === 0
            ? 'All commands are trained for this wheel.'
            : `${practiceQueueProgressLabel} practice coverage. Expand practice to drill the remaining cold gestures.`;
  const collapsedPracticeStreakSource = draftItems.reduce<{
    item: RadialMenuItem;
    record: PracticeRecord;
  } | null>((best, item) => {
    const record = practiceByCommand[item.id];
    if (!record || record.streak < 2) {
      return best;
    }

    if (!best || record.streak > best.record.streak) {
      return { item, record };
    }

    if (record.streak === best.record.streak && record.hits > best.record.hits) {
      return { item, record };
    }

    return best;
  }, null);
  const collapsedPracticeStreak = collapsedPracticeStreakSource?.record.streak ?? 0;
  const collapsedPracticeStreakVisible = collapsedPracticeStreakSource != null;
  const collapsedPracticeStreakLabel = `${String(collapsedPracticeStreak)}x`;
  const collapsedPracticeStreakSourceDirection = collapsedPracticeStreakSource
    ? radialSlotMeta[collapsedPracticeStreakSource.item.slot].direction
    : '';
  const collapsedPracticeStreakSourceLabel = collapsedPracticeStreakSource
    ? `${collapsedPracticeStreakSource.item.label} ${collapsedPracticeStreakSourceDirection}`
    : '';
  const collapsedPracticeStreakHelp = collapsedPracticeStreakSource
    ? `Best streak: ${collapsedPracticeStreakSourceLabel} at ${collapsedPracticeStreakLabel}.`
    : '';
  const collapsedPracticeStreakStatus = collapsedPracticeStreakVisible
    ? ` Best local streak: ${collapsedPracticeStreakLabel}.`
    : '';
  const collapsedPracticeResetAvailable = Object.values(practiceByCommand).some(
    (record) => record.attempts > 0 || record.hits > 0 || record.streak > 0 || record.status !== 'idle',
  );
  const collapsedPracticeResetHint = collapsedPracticeResetAvailable ? 'Shift+Backspace clears local practice.' : '';
  const collapsedPracticeKeyShortcuts = collapsedPracticeResetAvailable ? 'Enter Space Shift+Backspace' : 'Enter Space';
  const collapsedPracticeCoveragePercent =
    practiceQueueProgress.total === 0
      ? 100
      : Math.max(0, Math.min(100, Math.round((practiceQueueProgress.completed / practiceQueueProgress.total) * 100)));
  const collapsedPracticeProgressPercent = collapsedPracticeState === 'clean' ? 100 : collapsedPracticeCoveragePercent;
  const collapsedPracticeCue =
    collapsedPracticeState === 'replay' ? 'replay' : collapsedPracticeProgressPercent === 100 ? 'complete' : 'practice';
  const collapsedPracticeQuickOpenMode = collapsedPracticeState === 'replay' ? 'replay' : 'focus';
  const collapsedPracticeFlash = collapsedPracticeReplayCleared ? 'replay-clear' : 'none';
  const collapsedPracticeOpenLabel =
    collapsedPracticeState === 'replay'
      ? `Open replay practice: ${collapsedPracticeLabel}`
      : `Open practice lane: ${collapsedPracticeLabel}`;
  const collapsedPracticeKeyboardHint =
    collapsedPracticeState === 'replay' ? 'Enter/Space opens replay practice.' : 'Enter/Space opens practice.';
  const collapsedPracticeCueStyle = {
    '--collapsed-practice-progress': `${String(collapsedPracticeProgressPercent)}%`,
  } as CSSProperties & Record<'--collapsed-practice-progress', string>;
  const panelStyle: CSSProperties =
    isCollapsed && panelLayout.compact ? { ...panelLayout.style, height: undefined } : panelLayout.style;
  const draftStatus =
    draftChangeCount > 0
      ? `${String(draftChangeCount)} unsaved slot${draftChangeCount === 1 ? '' : 's'}`
      : 'Layout saved';
  const selectedPractice = getPracticeRecord(practiceByCommand, selectedItem?.id);
  const selectedPracticeStatus = practiceStatusLabel(selectedPractice, selectedItem);
  const selectedPracticeDirection = selectedItem ? radialSlotMeta[selectedItem.slot].direction : 'N';
  const selectedPracticeScore = `${String(selectedPractice.hits)}/${String(selectedPractice.attempts)} hits`;
  const practiceReplayActive = practiceQueueActive && practiceQueueMode === 'replay';
  const practiceQueueStatus =
    practiceQueueProgress.total === 0
      ? 'All trained'
      : practiceReplayActive
        ? practiceQueueMessage
        : practiceQueueProgress.remaining === 0
          ? weakPracticeItems.length > 0
            ? 'Replay ready'
            : 'Queue done'
          : practiceQueueActive
            ? practiceQueueMessage
            : 'Queue off';
  const practiceVectorDistance = practiceVector ? Math.min(46, Math.hypot(practiceVector.dx, practiceVector.dy)) : 0;
  const practiceVectorAngle = practiceVector ? (Math.atan2(practiceVector.dy, practiceVector.dx) * 180) / Math.PI : -90;
  const visibleGestureSuggestionDirection = visibleGestureSuggestion
    ? radialSlotMeta[visibleGestureSuggestion.slot].direction
    : null;
  const gestureSuggestionDismissHelp = visibleGestureSuggestion
    ? `Hide this ${visibleGestureSuggestion.commandLabel} suggestion for now. It can return when new gesture misses appear.`
    : 'Hide this suggestion for now.';
  const gestureSuggestionNeverHelp =
    visibleGestureSuggestion && visibleGestureSuggestionDirection
      ? `Never suggest moving ${visibleGestureSuggestion.commandLabel} to ${visibleGestureSuggestionDirection} on this wheel.`
      : 'Never suggest this move on this wheel.';

  const focusSearch = useCallback(() => {
    if (isCollapsed) {
      setIsCollapsed(false);
    }

    requestAnimationFrame(() => {
      searchInputRef.current?.focus({ preventScroll: true });
      searchInputRef.current?.select();
    });
  }, [isCollapsed]);

  const focusPracticePad = useCallback(() => {
    requestAnimationFrame(() => {
      practicePadRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      practicePadRef.current?.focus({ preventScroll: true });
    });
  }, []);

  const selectColdPracticeItem = useCallback(
    (item: RadialMenuItem, message?: string, primeAiming = false) => {
      setCommandQuery('');
      setMasteryFilter('cold');
      setSelectedCommandId(item.id);
      if (message) {
        setPracticeQueueMessage(message);
      }
      if (primeAiming) {
        setPracticeByCommand((current) => ({
          ...current,
          [item.id]: {
            ...getPracticeRecord(current, item.id),
            status: 'aiming',
          },
        }));
      }
      focusPracticePad();
    },
    [focusPracticePad],
  );

  const handleCollapsedPracticeOpen = useCallback(() => {
    pendingPracticeFocusRef.current = true;
    setIsCollapsed(false);

    if (collapsedPracticeState === 'replay' && firstWeakPracticeItem) {
      setPracticeQueueActive(true);
      setPracticeQueueMode('replay');
      selectColdPracticeItem(
        firstWeakPracticeItem,
        `Replay ${radialSlotMeta[firstWeakPracticeItem.slot].direction}`,
        true,
      );
    }
  }, [collapsedPracticeState, firstWeakPracticeItem, selectColdPracticeItem]);

  const handleCollapsedPracticeReset = useCallback(() => {
    pendingPracticeFocusRef.current = false;
    practiceStartRef.current = null;
    setPracticeVector(null);
    setPracticeByCommand({});
    setPracticeQueueActive(false);
    setPracticeQueueMode('cold');
    setPracticeQueueMessage('Queue ready');
  }, []);

  const handleCollapsedPracticeKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLSpanElement>) => {
      if (event.shiftKey && event.key === 'Backspace') {
        event.preventDefault();
        event.stopPropagation();
        if (collapsedPracticeResetAvailable) {
          handleCollapsedPracticeReset();
        }
        return;
      }

      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      handleCollapsedPracticeOpen();
    },
    [collapsedPracticeResetAvailable, handleCollapsedPracticeOpen, handleCollapsedPracticeReset],
  );

  const handleCollapsedPinnedPresetOpen = useCallback(() => {
    setIsCollapsed(false);
    setPresetsOpen(true);
  }, []);

  const handleCollapsedPinnedPresetKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLSpanElement>) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      handleCollapsedPinnedPresetOpen();
    },
    [handleCollapsedPinnedPresetOpen],
  );

  useEffect(() => {
    if (!isCollapsed) {
      if (pendingPracticeFocusRef.current) {
        pendingPracticeFocusRef.current = false;
        focusPracticePad();
        return;
      }

      focusSearch();
    }
  }, [focusPracticePad, focusSearch, isCollapsed]);

  useEffect(
    () =>
      subscribeRadialTelemetry(() => {
        setTelemetryEvents(readRadialTelemetry());
      }),
    [],
  );

  useEffect(() => {
    setDraftItems(items);
    setSelectedCommandId((current) =>
      current && items.some((item) => item.id === current) ? current : (items[0]?.id ?? null),
    );
    setCommandQuery('');
    setPracticeQueueActive(false);
    setPracticeQueueMode('cold');
    setPracticeQueueMessage('Queue ready');
  }, [committedSignature, items, layoutKey]);

  useEffect(() => {
    setPresetStatus({ tone: 'neutral', message: 'Preset ready' });
  }, [layoutKey]);

  useEffect(() => {
    if (visibleDraftItems.length === 0) {
      return;
    }

    setSelectedCommandId((current) =>
      current && visibleDraftItems.some((item) => item.id === current) ? current : visibleDraftItems[0].id,
    );
  }, [visibleDraftItems]);

  const handleMoveDraft = useCallback((commandId: string, slot: RadialSlot) => {
    setSelectedCommandId(commandId);
    setDraftItems((current) => moveDraftItem(current, commandId, slot));
  }, []);

  const handleSelectRecentCommand = useCallback((commandId: string) => {
    setCommandQuery('');
    setMasteryFilter('all');
    setSelectedCommandId(commandId);
  }, []);

  const handleApplySmartLayoutSuggestion = useCallback(() => {
    if (!smartLayoutSuggestion) {
      return;
    }

    setCommandQuery('');
    setMasteryFilter('all');
    setSelectedCommandId(smartLayoutSuggestion.primaryCommandId);
    setDraftItems(smartLayoutSuggestion.items);
  }, [smartLayoutSuggestion]);

  const handleRevertDraft = useCallback(() => {
    setDraftItems(items);
  }, [items]);

  const handleApplyDraft = useCallback(() => {
    for (const item of draftItems) {
      if (committedSlotById.get(item.id) !== item.slot) {
        onMove(item.id, item.slot);
      }
    }
    if (pinnedPresetId && draftChangeCount > 0) {
      setPresetStatus({ tone: 'neutral', message: 'Manual layout unpinned this context' });
    }
  }, [committedSlotById, draftChangeCount, draftItems, onMove, pinnedPresetId]);

  const handleCopyPreset = useCallback(() => {
    const serialized = serializeRadialLayoutPreset(layoutKey, draftItems);
    setPresetText(serialized);
    setPresetsOpen(true);
    setPresetStatus({ tone: 'success', message: 'Preset exported' });

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard
        .writeText(serialized)
        .then(() => {
          setPresetStatus({ tone: 'success', message: 'Preset copied' });
        })
        .catch(() => {
          setPresetStatus({ tone: 'neutral', message: 'Preset exported' });
        });
    }
  }, [draftItems, layoutKey]);

  const loadPresetSlots = useCallback(
    (preset: RadialNamedLayoutPreset) => {
      const result = parseRadialLayoutPreset(JSON.stringify(preset), layoutKey, draftItems);
      if (!result.ok) {
        setPresetStatus({ tone: 'error', message: result.reason });
        return;
      }

      setDraftItems((current) => applyRadialLayoutPreset(current, result.slots));
      setSelectedCommandId((current) => Object.keys(result.slots)[0] ?? current);
      setPresetStatus({ tone: 'success', message: `${preset.name} loaded` });
    },
    [draftItems, layoutKey],
  );

  const handleImportPreset = useCallback(() => {
    const result = parseRadialLayoutPreset(presetText, layoutKey, draftItems);
    if (!result.ok) {
      setPresetStatus({ tone: 'error', message: result.reason });
      return;
    }

    setDraftItems((current) => applyRadialLayoutPreset(current, result.slots));
    setSelectedCommandId((current) => Object.keys(result.slots)[0] ?? current);
    setPresetStatus({ tone: 'success', message: 'Preset loaded' });
  }, [draftItems, layoutKey, presetText]);

  const handleSaveNamedPreset = useCallback(() => {
    radialPreferencesStore.saveNamedPreset(layoutKey, presetName, draftItems);
    setPresetsOpen(true);
    setPresetStatus({ tone: 'success', message: `${presetName.trim() || 'Wheel preset'} saved` });
  }, [draftItems, layoutKey, presetName]);

  const handleDeleteNamedPreset = useCallback(
    (presetId: string, presetNameToDelete: string) => {
      radialPreferencesStore.deleteNamedPreset(layoutKey, presetId);
      setPresetStatus({
        tone: 'neutral',
        message:
          pinnedPresetId === presetId ? `${presetNameToDelete} deleted and unpinned` : `${presetNameToDelete} deleted`,
      });
    },
    [layoutKey, pinnedPresetId],
  );

  const handleTogglePinnedPreset = useCallback(
    (preset: RadialNamedLayoutPreset) => {
      if (pinnedPresetId === preset.id) {
        radialPreferencesStore.unpinNamedPreset(layoutKey);
        setPresetStatus({ tone: 'neutral', message: `${preset.name} unpinned` });
        return;
      }

      radialPreferencesStore.pinNamedPreset(layoutKey, preset.id);
      setPresetStatus({ tone: 'success', message: `${preset.name} pinned to this context` });
    },
    [layoutKey, pinnedPresetId],
  );

  const handlePinRecommendedPreset = useCallback(() => {
    if (!recommendedPreset) {
      return;
    }

    radialPreferencesStore.pinNamedPreset(layoutKey, recommendedPreset.id);
    setPresetStatus({ tone: 'success', message: `${recommendedPreset.name} pinned to this context` });
  }, [layoutKey, recommendedPreset]);

  const advancePracticeQueueAfterHit = useCallback(
    (commandId: string) => {
      const nextItem = getNextPracticeQueueItem(coldPracticeItems, practiceByCommand, commandId);
      if (!nextItem) {
        setPracticeQueueMessage('Queue done');
        focusPracticePad();
        return;
      }

      selectColdPracticeItem(nextItem, `Next ${radialSlotMeta[nextItem.slot].direction}`);
    },
    [coldPracticeItems, focusPracticePad, practiceByCommand, selectColdPracticeItem],
  );

  const advancePracticeReplayAfterHit = useCallback(
    (commandId: string) => {
      const nextItem = getNextWeakPracticeItem(weakPracticeItems, practiceByCommand, commandId);
      if (!nextItem) {
        setPracticeQueueMessage('Replay clear');
        focusPracticePad();
        return;
      }

      selectColdPracticeItem(nextItem, `Replay ${radialSlotMeta[nextItem.slot].direction}`, true);
    },
    [focusPracticePad, practiceByCommand, selectColdPracticeItem, weakPracticeItems],
  );

  const applyPracticeSlot = useCallback(
    (commandId: string, targetSlot: RadialSlot, practicedSlot: RadialSlot | null) => {
      const hit = practicedSlot === targetSlot;
      const attempted = practicedSlot != null;
      const direction = practicedSlot == null ? undefined : radialSlotMeta[practicedSlot].direction;
      setPracticeByCommand((current) => {
        const previous = current[commandId] ?? emptyPracticeRecord();
        return {
          ...current,
          [commandId]: {
            attempts: previous.attempts + 1,
            hits: previous.hits + (hit ? 1 : 0),
            streak: hit ? previous.streak + 1 : 0,
            status: attempted ? (hit ? 'hit' : 'miss') : 'short',
            lastDirection: direction,
          },
        };
      });

      if (!practiceQueueActive) {
        return;
      }

      if (hit) {
        if (practiceQueueMode === 'replay') {
          advancePracticeReplayAfterHit(commandId);
          return;
        }
        advancePracticeQueueAfterHit(commandId);
        return;
      }

      setPracticeQueueMessage(
        practicedSlot == null
          ? `Longer ${radialSlotMeta[targetSlot].direction}`
          : `Retry ${radialSlotMeta[targetSlot].direction}`,
      );
    },
    [advancePracticeQueueAfterHit, advancePracticeReplayAfterHit, practiceQueueActive, practiceQueueMode],
  );

  const handlePracticePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!selectedItem) {
        return;
      }
      event.preventDefault();
      if (typeof event.currentTarget.setPointerCapture === 'function') {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      practiceStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        commandId: selectedItem.id,
        slot: selectedItem.slot,
      };
      setPracticeVector({ dx: 0, dy: 0 });
      setPracticeByCommand((current) => ({
        ...current,
        [selectedItem.id]: {
          ...(current[selectedItem.id] ?? emptyPracticeRecord()),
          status: 'aiming',
        },
      }));
    },
    [selectedItem],
  );

  const handlePracticePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const start = practiceStartRef.current;
    if (!start) {
      return;
    }
    setPracticeVector({
      dx: event.clientX - start.x,
      dy: event.clientY - start.y,
    });
  }, []);

  const finishPracticePointer = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const start = practiceStartRef.current;
      if (!start) {
        return;
      }
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      const distance = Math.hypot(dx, dy);
      const practicedSlot = distance >= PRACTICE_MIN_DISTANCE_PX ? slotFromVector(dx, dy) : null;
      applyPracticeSlot(start.commandId, start.slot, practicedSlot);
      practiceStartRef.current = null;
      setPracticeVector(null);
      if (typeof event.currentTarget.releasePointerCapture === 'function') {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [applyPracticeSlot],
  );

  const handlePracticeKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!selectedItem || !/^[1-8]$/.test(event.key)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      applyPracticeSlot(selectedItem.id, selectedItem.slot, (Number(event.key) - 1) as RadialSlot);
    },
    [applyPracticeSlot, selectedItem],
  );

  const handlePracticeReset = useCallback(() => {
    if (!selectedItem) {
      return;
    }
    practiceStartRef.current = null;
    setPracticeVector(null);
    setPracticeByCommand((current) => ({
      ...current,
      [selectedItem.id]: emptyPracticeRecord(),
    }));
  }, [selectedItem]);

  const handlePracticeFirstCold = useCallback(() => {
    if (!firstColdItem) {
      return;
    }

    setPracticeQueueActive(false);
    setPracticeQueueMode('cold');
    setPracticeQueueMessage('Queue ready');
    selectColdPracticeItem(firstColdItem);
  }, [firstColdItem, selectColdPracticeItem]);

  const handlePracticeQueueToggle = useCallback(() => {
    if (practiceQueueActive) {
      setPracticeQueueActive(false);
      setPracticeQueueMessage('Queue paused');
      focusPracticePad();
      return;
    }

    const nextItem = getNextPracticeQueueItem(coldPracticeItems, practiceByCommand);
    if (!nextItem) {
      setPracticeQueueMessage(coldPracticeItems.length === 0 ? 'All trained' : 'Queue done');
      focusPracticePad();
      return;
    }

    setPracticeQueueActive(true);
    setPracticeQueueMode('cold');
    selectColdPracticeItem(nextItem, `Drill ${radialSlotMeta[nextItem.slot].direction}`);
  }, [coldPracticeItems, focusPracticePad, practiceByCommand, practiceQueueActive, selectColdPracticeItem]);

  const handlePracticeReplayWeak = useCallback(() => {
    if (!firstWeakPracticeItem) {
      setPracticeQueueMessage('Replay clear');
      focusPracticePad();
      return;
    }

    setPracticeQueueActive(true);
    setPracticeQueueMode('replay');
    selectColdPracticeItem(
      firstWeakPracticeItem,
      `Replay ${radialSlotMeta[firstWeakPracticeItem.slot].direction}`,
      true,
    );
  }, [firstWeakPracticeItem, focusPracticePad, selectColdPracticeItem]);

  const handlePracticeHeatSelect = useCallback(
    (item: RadialMenuItem) => {
      setPracticeQueueActive(false);
      setPracticeQueueMode('cold');
      selectColdPracticeItem(item, `Heat ${radialSlotMeta[item.slot].direction}`, true);
    },
    [selectColdPracticeItem],
  );

  const handleCustomizerKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      const key = event.key;
      const normalizedKey = key.toLowerCase();
      const textEntryTarget = isTextEntryTarget(event.target);

      if ((event.ctrlKey || event.metaKey) && normalizedKey === 'f') {
        event.preventDefault();
        focusSearch();
        return;
      }

      if (key === '/' && !textEntryTarget) {
        event.preventDefault();
        focusSearch();
        return;
      }

      if (key === 'Escape') {
        event.preventDefault();
        if (commandQuery.trim().length > 0) {
          setCommandQuery('');
          focusSearch();
          return;
        }
        onClose();
        return;
      }

      const targetSlot = slotFromAltShortcut(event);
      if (targetSlot == null || !selectedItem || selectedItem.customizable === false) {
        return;
      }

      event.preventDefault();
      handleMoveDraft(selectedItem.id, targetSlot);
      focusSearch();
    },
    [commandQuery, focusSearch, handleMoveDraft, onClose, selectedItem],
  );

  return (
    <section
      data-testid="radial-customizer"
      data-layout={panelLayout.compact ? 'compact-sheet' : 'floating'}
      data-collapsed={isCollapsed ? 'true' : 'false'}
      role="dialog"
      aria-label="Customize radial command wheel"
      aria-keyshortcuts="Control+F Meta+F / Alt+1 Alt+2 Alt+3 Alt+4 Alt+5 Alt+6 Alt+7 Alt+8 Escape"
      onKeyDown={handleCustomizerKeyDown}
      className={cn(
        'fixed z-[10000] flex flex-col overflow-hidden border border-border bg-card/95 shadow-2xl backdrop-blur-xl',
        panelLayout.compact
          ? 'max-h-[calc(100dvh-1rem)] resize-y rounded-lg'
          : 'max-h-[min(32rem,calc(100vh-1.5rem))] w-[23rem] max-w-[calc(100vw-1.5rem)] resize rounded-md',
        isCollapsed && 'resize-none',
      )}
      style={panelStyle}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
            <span>Wheel Layout</span>
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {getViewSummary(context)} - {getTargetSummary(context)}
          </div>
          {isCollapsed && (
            <div className="mt-0.5 grid gap-1">
              <div
                data-testid="radial-customizer-collapsed-summary"
                className="truncate text-[10px] text-muted-foreground"
              >
                {draftStatus}
              </div>
              <div
                data-testid="radial-customizer-collapsed-mastery"
                aria-label="Collapsed radial mastery summary"
                className="flex min-w-0 flex-wrap gap-1"
              >
                {(['trained', 'building', 'cold'] as const).map((status) => (
                  <span
                    key={status}
                    data-testid={`radial-customizer-collapsed-mastery-${status}`}
                    className={cn(
                      'rounded border px-1.5 py-0.5 text-[9px] font-semibold leading-none',
                      commandMasteryClasses(status),
                    )}
                  >
                    {formatMasteryCountLabel(masteryCounts[status], status)}
                  </span>
                ))}
                {pinnedPreset && (
                  <StyledTooltip
                    content={
                      <span data-testid="radial-customizer-collapsed-pinned-preset-help" className="grid gap-1">
                        <span>{pinnedPresetStatus}</span>
                        <span className="text-[10px] text-muted-foreground">Enter/Space opens Presets.</span>
                      </span>
                    }
                    side="bottom"
                    className="pointer-events-none z-[10001] max-w-52 leading-snug"
                  >
                    <span
                      data-testid="radial-customizer-collapsed-pinned-preset"
                      data-pinned="true"
                      data-preset-id={pinnedPreset.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open pinned preset: ${pinnedPreset.name}`}
                      aria-keyshortcuts="Enter Space"
                      title={pinnedPresetStatus}
                      onClick={handleCollapsedPinnedPresetOpen}
                      onKeyDown={handleCollapsedPinnedPresetKeyDown}
                      className="inline-flex max-w-[7rem] cursor-pointer items-center gap-1 rounded border border-primary/45 bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-primary outline-none transition-colors hover:border-primary/70 hover:bg-primary/15 focus-visible:ring-1 focus-visible:ring-primary/70"
                    >
                      <Pin className="h-2.5 w-2.5 shrink-0" />
                      <span className="min-w-0 truncate">{pinnedPreset.name}</span>
                    </span>
                  </StyledTooltip>
                )}
                <span
                  data-testid="radial-customizer-collapsed-practice"
                  data-state={collapsedPracticeState}
                  data-priority="clean replay idle"
                  data-progress={practiceQueueProgressLabel}
                  data-progress-percent={String(collapsedPracticeProgressPercent)}
                  data-cue={collapsedPracticeCue}
                  data-quick-open-mode={collapsedPracticeQuickOpenMode}
                  data-replay-cleared={collapsedPracticeReplayCleared ? 'true' : 'false'}
                  data-flash={collapsedPracticeFlash}
                  data-replay-count={String(weakPracticeItems.length)}
                  data-attempts={String(practiceRecapAttempts)}
                  data-streak={String(collapsedPracticeStreak)}
                  data-streak-active={collapsedPracticeStreakVisible ? 'true' : 'false'}
                  data-streak-label={collapsedPracticeStreakLabel}
                  data-streak-source-command-id={collapsedPracticeStreakSource?.item.id ?? ''}
                  data-streak-source-label={collapsedPracticeStreakSourceLabel}
                  data-streak-source-direction={collapsedPracticeStreakSourceDirection}
                  data-reset-available={collapsedPracticeResetAvailable ? 'true' : 'false'}
                  data-reset-hint={collapsedPracticeResetHint}
                  data-a11y-status={`${collapsedPracticeStatus}${collapsedPracticeStreakStatus}`}
                  data-help={collapsedPracticeHelp}
                  data-action-hint={collapsedPracticeKeyboardHint}
                  aria-label={`Collapsed practice state: ${collapsedPracticeLabel}`}
                  className="contents"
                >
                  <span
                    id={COLLAPSED_PRACTICE_STATUS_ID}
                    data-testid="radial-customizer-collapsed-practice-status"
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                    className="sr-only"
                  >
                    {collapsedPracticeStatus}
                    {collapsedPracticeStreakStatus}
                  </span>
                  <StyledTooltip
                    content={
                      <span data-testid="radial-customizer-collapsed-practice-help" className="grid gap-1">
                        <span>{collapsedPracticeHelp}</span>
                        {collapsedPracticeStreakVisible && (
                          <span
                            data-testid="radial-customizer-collapsed-practice-streak-source"
                            className="text-[10px] text-emerald-100/90"
                          >
                            {collapsedPracticeStreakHelp}
                          </span>
                        )}
                        {collapsedPracticeResetAvailable && (
                          <span
                            data-testid="radial-customizer-collapsed-practice-reset-hint"
                            className="text-[10px] text-amber-100/90"
                          >
                            {collapsedPracticeResetHint}
                          </span>
                        )}
                        <span
                          data-testid="radial-customizer-collapsed-practice-hint"
                          className="text-[10px] text-muted-foreground"
                        >
                          {collapsedPracticeKeyboardHint}
                        </span>
                      </span>
                    }
                    side="bottom"
                    className="pointer-events-none z-[10001] max-w-56 leading-snug"
                  >
                    <span
                      data-testid={`radial-customizer-collapsed-${collapsedPracticeState}`}
                      data-state={collapsedPracticeState}
                      data-clean={collapsedPracticeState === 'clean' ? 'true' : undefined}
                      data-count={collapsedPracticeState === 'replay' ? String(weakPracticeItems.length) : undefined}
                      data-attempts={collapsedPracticeState === 'clean' ? String(practiceRecapAttempts) : undefined}
                      data-progress={collapsedPracticeState === 'idle' ? practiceQueueProgressLabel : undefined}
                      data-progress-percent={String(collapsedPracticeProgressPercent)}
                      data-cue={collapsedPracticeCue}
                      data-quick-open="practice-pad"
                      data-quick-open-mode={collapsedPracticeQuickOpenMode}
                      data-replay-cleared={collapsedPracticeReplayCleared ? 'true' : 'false'}
                      data-flash={collapsedPracticeFlash}
                      data-action-hint={collapsedPracticeKeyboardHint}
                      data-streak={String(collapsedPracticeStreak)}
                      data-streak-active={collapsedPracticeStreakVisible ? 'true' : 'false'}
                      data-streak-label={collapsedPracticeStreakLabel}
                      data-streak-source-command-id={collapsedPracticeStreakSource?.item.id ?? ''}
                      data-streak-source-label={collapsedPracticeStreakSourceLabel}
                      data-streak-source-direction={collapsedPracticeStreakSourceDirection}
                      data-reset-available={collapsedPracticeResetAvailable ? 'true' : 'false'}
                      data-reset-hint={collapsedPracticeResetHint}
                      role="button"
                      aria-label={collapsedPracticeOpenLabel}
                      aria-keyshortcuts={collapsedPracticeKeyShortcuts}
                      aria-describedby={COLLAPSED_PRACTICE_STATUS_ID}
                      tabIndex={0}
                      title={collapsedPracticeTitle}
                      style={collapsedPracticeCueStyle}
                      onClick={handleCollapsedPracticeOpen}
                      onKeyDown={handleCollapsedPracticeKeyDown}
                      className={cn(
                        'relative inline-flex max-w-[7.5rem] cursor-pointer items-center gap-1 overflow-hidden rounded border px-1.5 py-0.5 text-[9px] font-semibold leading-none outline-none transition-colors before:pointer-events-none before:absolute before:bottom-0 before:left-0 before:h-0.5 before:w-[var(--collapsed-practice-progress)] before:rounded-full before:transition-[width,opacity] before:duration-300 after:pointer-events-none after:absolute after:inset-[-1px] after:rounded after:opacity-0 after:transition-opacity after:duration-500 focus-visible:ring-1 focus-visible:ring-primary/70',
                        collapsedPracticeState === 'clean'
                          ? 'border-cyan-300/40 bg-cyan-500/10 text-cyan-100 before:bg-cyan-300/80 before:shadow-[0_0_8px_rgba(103,232,249,0.45)] motion-safe:before:animate-[pulse_1.8s_ease-in-out_infinite]'
                          : collapsedPracticeState === 'replay'
                            ? 'border-amber-300/40 bg-amber-500/10 text-amber-100 before:bg-amber-300/80 before:shadow-[0_0_8px_rgba(252,211,77,0.45)] motion-safe:before:animate-[pulse_1.8s_ease-in-out_infinite]'
                            : collapsedPracticeReplayCleared
                              ? 'border-emerald-300/45 bg-emerald-500/10 text-emerald-100 before:bg-emerald-300/80 before:shadow-[0_0_8px_rgba(110,231,183,0.45)] after:opacity-100 after:shadow-[0_0_14px_rgba(110,231,183,0.38)] motion-safe:after:animate-[pulse_1.35s_ease-in-out_2]'
                              : 'border-border/70 bg-background/35 text-muted-foreground before:bg-muted-foreground/45',
                      )}
                    >
                      <span className="min-w-0 truncate">{collapsedPracticeLabel}</span>
                      {collapsedPracticeStreakVisible && (
                        <span
                          data-testid="radial-customizer-collapsed-practice-streak"
                          data-streak={String(collapsedPracticeStreak)}
                          data-streak-source-command-id={collapsedPracticeStreakSource?.item.id ?? ''}
                          data-streak-source-label={collapsedPracticeStreakSourceLabel}
                          data-streak-source-direction={collapsedPracticeStreakSourceDirection}
                          className="shrink-0 rounded border border-emerald-300/40 bg-emerald-500/15 px-1 py-px text-[8px] leading-none text-emerald-100"
                          title={`Best local practice streak: ${collapsedPracticeStreakSourceLabel} at ${collapsedPracticeStreakLabel}`}
                        >
                          {collapsedPracticeStreakLabel}
                        </span>
                      )}
                    </span>
                  </StyledTooltip>
                </span>
              </div>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            data-testid="radial-customizer-collapse"
            aria-label={isCollapsed ? 'Expand radial wheel customizer' : 'Collapse radial wheel customizer'}
            aria-controls="radial-customizer-body radial-customizer-footer"
            aria-expanded={!isCollapsed}
            title={isCollapsed ? 'Expand customizer' : 'Collapse customizer'}
            className="rounded border border-border/70 bg-muted/30 p-1.5 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            onClick={() => setIsCollapsed((collapsed) => !collapsed)}
          >
            {isCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            data-testid="radial-customizer-reset"
            aria-label="Reset radial wheel layout"
            title="Reset layout"
            className="rounded border border-border/70 bg-muted/30 p-1.5 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            onClick={onReset}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            data-testid="radial-customizer-close"
            aria-label="Close radial wheel customizer"
            title="Close"
            className="rounded border border-border/70 bg-muted/30 p-1.5 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div
          id="radial-customizer-body"
          data-testid="radial-customizer-body"
          className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3 pr-2"
        >
          <div
            data-testid="radial-customizer-preview-wheel"
            className="relative mx-auto h-[11.5rem] w-[11.5rem] shrink-0 rounded border border-border/70 bg-background/55 shadow-inner [contain:layout_paint_style]"
          >
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox={`0 0 ${String(PREVIEW_SIZE)} ${String(PREVIEW_SIZE)}`}
              aria-hidden="true"
            >
              <circle
                cx={PREVIEW_CENTER}
                cy={PREVIEW_CENTER}
                r={82}
                className="fill-background/45 stroke-border/70"
                strokeWidth={1}
              />
              <circle
                cx={PREVIEW_CENTER}
                cy={PREVIEW_CENTER}
                r={34}
                className="fill-card/85 stroke-border"
                strokeWidth={1}
              />
              {ORDERED_SLOTS.map((slot) => {
                const guideEnd = slotPoint(slot, 82);
                const label = slotPoint(slot, PREVIEW_LABEL_RADIUS);
                return (
                  <g key={slot}>
                    <line
                      x1={PREVIEW_CENTER}
                      y1={PREVIEW_CENTER}
                      x2={guideEnd.x}
                      y2={guideEnd.y}
                      className="stroke-border/40"
                      strokeWidth={1}
                    />
                    <text
                      x={label.x}
                      y={label.y + 3}
                      textAnchor="middle"
                      className="fill-muted-foreground text-[8px] font-semibold"
                    >
                      {radialSlotMeta[slot].direction}
                    </text>
                  </g>
                );
              })}
            </svg>
            {draftItems.map((item) => {
              const Icon = item.icon;
              const point = slotPoint(item.slot, PREVIEW_SLOT_RADIUS);
              const isSelected = selectedItem?.id === item.id;
              const changed = committedSlotById.get(item.id) !== item.slot;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`radial-customizer-preview-item-${item.id}`}
                  data-slot={item.slot}
                  aria-pressed={isSelected}
                  aria-label={`Preview ${item.label} in ${radialSlotMeta[item.slot].direction}`}
                  className={cn(
                    'absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border shadow-lg transition-colors',
                    slotTone(item.group, item.destructive),
                    isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                    changed && 'outline outline-1 outline-primary/70',
                  )}
                  style={{ left: point.x, top: point.y }}
                  onClick={() => setSelectedCommandId(item.id)}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
            <div className="pointer-events-none absolute inset-x-10 top-[4.85rem] text-center">
              <div
                data-testid="radial-customizer-preview-title"
                className="truncate text-[11px] font-semibold text-foreground"
              >
                {selectedItem?.label ?? 'Wheel'}
              </div>
              <div data-testid="radial-customizer-preview-direction" className="text-[9px] text-muted-foreground">
                {selectedItem ? radialSlotMeta[selectedItem.slot].direction : 'N'}
              </div>
            </div>
          </div>

          <div
            data-testid="radial-customizer-gesture-coach"
            className="order-first rounded border border-border/65 bg-background/45 p-2.5"
          >
            <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
              <div className="min-w-0 text-xs font-semibold text-foreground">
                <span>Compass</span>
              </div>
              <div className="flex min-w-0 items-center gap-1 text-[10px] text-muted-foreground">
                <span
                  data-testid="radial-customizer-gesture-selected-direction"
                  className="shrink-0 rounded border border-border/70 bg-muted/25 px-1.5 py-0.5 font-semibold"
                >
                  {selectedItem ? radialSlotMeta[selectedItem.slot].direction : 'N'}
                </span>
                <span data-testid="radial-customizer-gesture-selected-label" className="truncate">
                  {selectedItem?.label ?? 'Wheel'}
                </span>
              </div>
            </div>
            {(gestureInsights.fastest || gestureInsights.watch) && (
              <div data-testid="radial-customizer-gesture-insights" className="mb-2 grid grid-cols-2 gap-1">
                {gestureInsights.fastest && (
                  <div
                    data-testid="radial-customizer-gesture-fastest"
                    className="flex min-w-0 items-center gap-1 rounded border border-emerald-300/35 bg-emerald-500/10 px-1.5 py-1 text-[9px] font-semibold text-emerald-100"
                    title={`Fastest mark: ${radialSlotMeta[gestureInsights.fastest.slot].direction} / ${String(Math.round(gestureInsights.fastest.averageMs))}ms`}
                  >
                    <Zap className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      Fast {radialSlotMeta[gestureInsights.fastest.slot].direction}{' '}
                      {String(Math.round(gestureInsights.fastest.averageMs))}ms
                    </span>
                  </div>
                )}
                {gestureInsights.watch && (
                  <div
                    data-testid="radial-customizer-gesture-watch"
                    className="flex min-w-0 items-center gap-1 rounded border border-amber-300/40 bg-amber-500/10 px-1.5 py-1 text-[9px] font-semibold text-amber-100"
                    title={`Watch slot: ${radialSlotMeta[gestureInsights.watch.slot].direction} / ${formatGestureMisses(gestureInsights.watch.misses)}`}
                  >
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      Watch {radialSlotMeta[gestureInsights.watch.slot].direction}{' '}
                      {formatGestureMisses(gestureInsights.watch.misses)}
                    </span>
                  </div>
                )}
              </div>
            )}
            {visibleGestureSuggestion && (
              <div className="mb-2 flex min-w-0 items-stretch gap-1">
                <button
                  type="button"
                  data-testid="radial-customizer-gesture-suggestion"
                  data-source={visibleGestureSuggestion.source}
                  aria-label={`Preview moving ${visibleGestureSuggestion.commandLabel} to ${radialSlotMeta[visibleGestureSuggestion.slot].direction}`}
                  title={
                    visibleGestureSuggestion.source === 'command'
                      ? `${visibleGestureSuggestion.commandLabel} missed ${radialSlotMeta[visibleGestureSuggestion.slot].direction} ${String(visibleGestureSuggestion.misses)} times; preview this move before applying`
                      : `${formatGestureMisses(visibleGestureSuggestion.misses)} on ${radialSlotMeta[visibleGestureSuggestion.slot].direction}; preview this move before applying`
                  }
                  className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded border border-primary/45 bg-primary/10 px-2 py-1.5 text-left text-[10px] font-semibold text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/70"
                  onClick={() => handleMoveDraft(visibleGestureSuggestion.commandId, visibleGestureSuggestion.slot)}
                >
                  <span className="flex min-w-0 items-center gap-1">
                    <ArrowRightLeft className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      Try {visibleGestureSuggestion.commandLabel} in{' '}
                      {radialSlotMeta[visibleGestureSuggestion.slot].direction}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <span
                      data-testid="radial-customizer-gesture-suggestion-impact"
                      className="max-w-20 truncate rounded border border-primary/25 bg-background/50 px-1.5 py-0.5 text-[9px] text-primary/90"
                      title={visibleGestureSuggestion.impactLabel}
                    >
                      {visibleGestureSuggestion.impactLabel}
                    </span>
                    <span className="rounded border border-primary/35 bg-primary/10 px-1.5 py-0.5 text-[9px]">
                      Draft
                    </span>
                  </span>
                </button>
                <StyledTooltip
                  content={gestureSuggestionDismissHelp}
                  side="top"
                  className="z-[10001] max-w-52 leading-snug"
                >
                  <button
                    type="button"
                    data-testid="radial-customizer-gesture-suggestion-dismiss"
                    aria-label={`Hide suggestion to move ${visibleGestureSuggestion.commandLabel} for now`}
                    title={gestureSuggestionDismissHelp}
                    className="flex w-7 shrink-0 items-center justify-center rounded border border-primary/35 bg-primary/10 text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/70"
                    onClick={() => {
                      if (gestureSuggestionKey) {
                        setDismissedSuggestionKey(gestureSuggestionKey);
                      }
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </StyledTooltip>
                <StyledTooltip
                  content={gestureSuggestionNeverHelp}
                  side="top"
                  className="z-[10001] max-w-52 leading-snug"
                >
                  <button
                    type="button"
                    data-testid="radial-customizer-gesture-suggestion-never"
                    aria-label={`Never suggest moving ${visibleGestureSuggestion.commandLabel} to ${radialSlotMeta[visibleGestureSuggestion.slot].direction} on this wheel`}
                    title={gestureSuggestionNeverHelp}
                    className="flex w-7 shrink-0 items-center justify-center rounded border border-amber-300/35 bg-amber-500/10 text-amber-100 transition-colors hover:bg-amber-500/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-300/70"
                    onClick={() => {
                      if (gestureSuggestionSuppressionKey) {
                        radialPreferencesStore.suppressSuggestion(layoutKey, gestureSuggestionSuppressionKey);
                        setDismissedSuggestionKey(gestureSuggestionKey);
                      }
                    }}
                  >
                    <Ban className="h-3.5 w-3.5" />
                  </button>
                </StyledTooltip>
              </div>
            )}
            {selectedItem && (
              <div
                data-testid="radial-customizer-practice-lane"
                className="mb-2 grid gap-2 rounded border border-border/65 bg-card/35 p-2"
              >
                <div className="grid gap-1.5">
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold text-foreground">
                      <Crosshair className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="truncate">Practice</span>
                      <span
                        data-testid="radial-customizer-practice-target"
                        className="shrink-0 rounded border border-primary/35 bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary"
                      >
                        {selectedPracticeDirection}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span
                        data-testid="radial-customizer-practice-status"
                        className={cn(
                          'rounded border px-1.5 py-0.5 text-[9px] font-semibold',
                          selectedPractice.status === 'hit' &&
                            'border-emerald-300/40 bg-emerald-500/10 text-emerald-100',
                          selectedPractice.status === 'miss' && 'border-amber-300/40 bg-amber-500/10 text-amber-100',
                          selectedPractice.status === 'short' && 'border-red-300/40 bg-red-500/10 text-red-100',
                          (selectedPractice.status === 'idle' || selectedPractice.status === 'aiming') &&
                            'border-border/70 bg-muted/25 text-muted-foreground',
                        )}
                      >
                        {selectedPracticeStatus}
                      </span>
                      <button
                        type="button"
                        data-testid="radial-customizer-practice-reset"
                        aria-label={`Reset ${selectedItem.label} practice`}
                        title="Reset practice"
                        className="rounded border border-border/70 bg-muted/30 p-1 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                        onClick={handlePracticeReset}
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      data-testid="radial-customizer-practice-queue"
                      data-active={practiceQueueActive ? 'true' : 'false'}
                      data-progress={practiceQueueProgressLabel}
                      aria-pressed={practiceQueueActive}
                      aria-label={
                        practiceQueueProgress.total === 0
                          ? 'Practice queue has no cold radial commands'
                          : `${practiceQueueActive ? 'Pause' : 'Start'} cold radial practice queue`
                      }
                      title={
                        practiceQueueProgress.total === 0
                          ? 'All gestures are trained'
                          : `${practiceQueueActive ? 'Pause' : 'Start'} practice queue`
                      }
                      disabled={practiceQueueProgress.total === 0}
                      className={cn(
                        'flex min-w-0 items-center justify-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:border-border/60 disabled:bg-muted/20 disabled:text-muted-foreground',
                        practiceQueueActive
                          ? 'border-emerald-300/45 bg-emerald-500/15 text-emerald-100 focus-visible:ring-emerald-300/70'
                          : 'border-border/65 bg-muted/25 text-muted-foreground hover:border-primary/45 hover:text-foreground focus-visible:ring-primary/70',
                      )}
                      onClick={handlePracticeQueueToggle}
                    >
                      <Play className="h-3 w-3 shrink-0" />
                      <span className="truncate">Queue</span>
                    </button>
                    <button
                      type="button"
                      data-testid="radial-customizer-practice-replay"
                      data-active={practiceReplayActive ? 'true' : 'false'}
                      data-count={String(weakPracticeItems.length)}
                      aria-pressed={practiceReplayActive}
                      aria-label={
                        weakPracticeItems.length > 0
                          ? `Replay ${String(weakPracticeItems.length)} weak radial practice item${weakPracticeItems.length === 1 ? '' : 's'}`
                          : 'No weak radial practice items to replay'
                      }
                      title={
                        weakPracticeItems.length > 0
                          ? `Replay weak practice: ${String(weakPracticeItems.length)} item${weakPracticeItems.length === 1 ? '' : 's'}`
                          : 'No weak practice items'
                      }
                      disabled={weakPracticeItems.length === 0 && !practiceReplayActive}
                      className={cn(
                        'flex min-w-0 items-center justify-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:border-border/60 disabled:bg-muted/20 disabled:text-muted-foreground',
                        practiceReplayActive
                          ? 'border-amber-300/45 bg-amber-500/15 text-amber-100 focus-visible:ring-amber-300/70'
                          : 'border-amber-300/35 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15 focus-visible:ring-amber-300/70',
                      )}
                      onClick={handlePracticeReplayWeak}
                    >
                      <RotateCcw className="h-3 w-3 shrink-0" />
                      <span className="truncate">Replay</span>
                    </button>
                    <button
                      type="button"
                      data-testid="radial-customizer-practice-cold"
                      data-command-id={firstColdItem?.id ?? ''}
                      aria-label={
                        firstColdItem
                          ? `Practice first cold radial command: ${firstColdItem.label}`
                          : 'All radial gestures are trained'
                      }
                      title={firstColdItem ? `Practice cold command: ${firstColdItem.label}` : 'All gestures trained'}
                      disabled={!firstColdItem}
                      className="flex min-w-0 items-center justify-center gap-1 rounded border border-cyan-300/35 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-100 transition-colors hover:bg-cyan-500/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-300/70 disabled:cursor-not-allowed disabled:border-border/60 disabled:bg-muted/20 disabled:text-muted-foreground"
                      onClick={handlePracticeFirstCold}
                    >
                      <Zap className="h-3 w-3 shrink-0" />
                      <span className="truncate">Cold</span>
                    </button>
                  </div>
                </div>
                {practiceHeatItems.length > 0 && (
                  <div
                    data-testid="radial-customizer-practice-heat"
                    data-total={String(practiceHeatItems.length)}
                    data-tried={String(practiceHeatTriedCount)}
                    data-idle={String(practiceHeatIdleCount)}
                    className="grid gap-1 rounded border border-border/60 bg-background/40 p-1.5"
                  >
                    <div className="flex min-w-0 items-center justify-between gap-2 text-[9px] font-semibold">
                      <span className="text-muted-foreground">Heat</span>
                      <span
                        data-testid="radial-customizer-practice-heat-summary"
                        className="truncate text-foreground"
                        title={practiceHeatSummary}
                      >
                        {practiceHeatSummary}
                      </span>
                    </div>
                    <div aria-label="Local radial practice heat" className="flex min-w-0 gap-1 overflow-x-auto pb-0.5">
                      {practiceHeatItems.map(({ item, record, status }, index) => (
                        <button
                          key={item.id}
                          type="button"
                          data-testid={`radial-customizer-practice-heat-${item.id}`}
                          data-command-id={item.id}
                          data-rank={String(index + 1)}
                          data-attempts={String(record.attempts)}
                          data-hits={String(record.hits)}
                          data-status={status}
                          aria-label={`Practice ${item.label}: ${String(record.hits)} of ${String(record.attempts)} local hits, ${status}`}
                          title={`${item.label}: ${String(record.hits)}/${String(record.attempts)} local hits in ${radialSlotMeta[item.slot].direction}`}
                          className={cn(
                            'grid h-9 w-[5.4rem] shrink-0 content-center gap-0.5 rounded border px-1.5 text-left text-[9px] font-semibold leading-none transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-1',
                            practiceHeatClasses(status),
                          )}
                          onClick={() => handlePracticeHeatSelect(item)}
                        >
                          <span className="truncate">{item.label}</span>
                          <span className="flex min-w-0 items-center justify-between gap-1 text-[8px] uppercase tracking-normal opacity-85">
                            <span>{formatPracticeAttemptCount(record.attempts)}</span>
                            <span className="truncate">{status}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {practiceRecapVisible && (
                  <div
                    data-testid="radial-customizer-practice-recap"
                    data-hits={String(practiceRecapHits)}
                    data-attempts={String(practiceRecapAttempts)}
                    data-weak={String(weakPracticeItems.length)}
                    data-next-command-id={firstWeakPracticeItem?.id ?? ''}
                    className="grid gap-1.5 rounded border border-emerald-300/35 bg-emerald-500/10 p-1.5"
                  >
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[9px] font-semibold text-emerald-100">
                        <Trophy className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">Session recap</span>
                        {practiceCleanRun && (
                          <span
                            data-testid="radial-customizer-practice-milestone"
                            data-clean="true"
                            data-attempts={String(practiceRecapAttempts)}
                            className="rounded border border-cyan-300/35 bg-cyan-500/10 px-1.5 py-0.5 text-[8px] font-semibold leading-none text-cyan-100"
                            title={`Clean local practice run: ${practiceRecapHitLabel}`}
                          >
                            Clean run
                          </span>
                        )}
                      </div>
                      <span
                        data-testid="radial-customizer-practice-recap-next"
                        className="max-w-[8rem] truncate rounded border border-emerald-300/25 bg-background/45 px-1.5 py-0.5 text-[8px] font-semibold text-emerald-100"
                        title={`Next replay target: ${practiceRecapNextLabel}`}
                      >
                        {practiceRecapNextLabel}
                      </span>
                    </div>
                    <div className="grid grid-cols-[1fr_1fr_auto] gap-1">
                      <div className="rounded border border-emerald-300/25 bg-background/35 px-1.5 py-1 text-[9px] leading-tight text-emerald-100">
                        <div className="text-[8px] uppercase text-muted-foreground">Hits</div>
                        <div data-testid="radial-customizer-practice-recap-hits" className="truncate font-semibold">
                          {practiceRecapHitLabel}
                        </div>
                      </div>
                      <div className="rounded border border-amber-300/25 bg-background/35 px-1.5 py-1 text-[9px] leading-tight text-amber-100">
                        <div className="text-[8px] uppercase text-muted-foreground">Weak</div>
                        <div data-testid="radial-customizer-practice-recap-weak" className="truncate font-semibold">
                          {formatPracticeWeakCount(weakPracticeItems.length)}
                        </div>
                      </div>
                      <button
                        type="button"
                        data-testid="radial-customizer-practice-recap-replay"
                        aria-label={
                          firstWeakPracticeItem
                            ? `Replay next weak radial practice target: ${firstWeakPracticeItem.label}`
                            : 'No weak radial practice target to replay'
                        }
                        title={firstWeakPracticeItem ? `Replay ${practiceRecapNextLabel}` : 'Replay clear'}
                        disabled={!firstWeakPracticeItem}
                        className="flex min-w-[4.5rem] items-center justify-center gap-1 rounded border border-amber-300/35 bg-amber-500/10 px-1.5 py-1 text-[9px] font-semibold text-amber-100 transition-colors hover:bg-amber-500/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-300/70 disabled:cursor-not-allowed disabled:border-border/60 disabled:bg-muted/20 disabled:text-muted-foreground"
                        onClick={handlePracticeReplayWeak}
                      >
                        <RotateCcw className="h-3 w-3 shrink-0" />
                        <span className="truncate">Replay</span>
                      </button>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-[5.75rem_minmax(0,1fr)] items-center gap-2">
                  <div
                    ref={practicePadRef}
                    data-testid="radial-customizer-practice-pad"
                    role="button"
                    tabIndex={0}
                    aria-label={`Practice ${selectedItem.label} ${selectedPracticeDirection} gesture`}
                    className="relative h-20 w-20 touch-none overflow-hidden rounded-full border border-border/70 bg-background/70 shadow-inner outline-none transition-colors focus-visible:ring-1 focus-visible:ring-primary/70"
                    onPointerDown={handlePracticePointerDown}
                    onPointerMove={handlePracticePointerMove}
                    onPointerUp={finishPracticePointer}
                    onPointerCancel={finishPracticePointer}
                    onKeyDown={handlePracticeKeyDown}
                  >
                    {ORDERED_SLOTS.map((slot) => {
                      const point = slotPoint(slot, 32);
                      return (
                        <span
                          key={slot}
                          className="pointer-events-none absolute text-[7px] font-semibold text-muted-foreground"
                          style={{
                            left: `${String((point.x / PREVIEW_SIZE) * 100)}%`,
                            top: `${String((point.y / PREVIEW_SIZE) * 100)}%`,
                            transform: 'translate(-50%, -50%)',
                          }}
                        >
                          {radialSlotMeta[slot].direction}
                        </span>
                      );
                    })}
                    <span className="pointer-events-none absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/55 bg-primary/25" />
                    {practiceVector && (
                      <span
                        data-testid="radial-customizer-practice-vector"
                        className="pointer-events-none absolute left-1/2 top-1/2 h-0.5 origin-left rounded-full bg-primary"
                        style={{
                          width: `${String(practiceVectorDistance)}px`,
                          transform: `rotate(${String(practiceVectorAngle)}deg)`,
                        }}
                      />
                    )}
                  </div>
                  <div className="min-w-0 text-[10px] leading-tight">
                    <div
                      data-testid="radial-customizer-practice-label"
                      className="truncate font-semibold text-foreground"
                    >
                      {selectedItem.label}
                    </div>
                    <div data-testid="radial-customizer-practice-score" className="mt-1 truncate text-muted-foreground">
                      {selectedPracticeScore} / streak {String(selectedPractice.streak)}
                    </div>
                    <div
                      data-testid="radial-customizer-practice-queue-status"
                      className={cn(
                        'mt-1 truncate text-[9px] font-semibold',
                        practiceQueueActive || practiceQueueProgress.remaining === 0
                          ? 'text-emerald-200'
                          : 'text-muted-foreground',
                      )}
                      title={`Practice queue ${practiceQueueProgressLabel}: ${practiceQueueStatus}`}
                    >
                      Queue {practiceQueueProgressLabel} - {practiceQueueStatus}
                    </div>
                    <div className="mt-1 flex min-w-0 flex-wrap gap-1">
                      <span className="rounded border border-emerald-300/35 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-100">
                        Safe
                      </span>
                      <span className="rounded border border-border/60 bg-muted/20 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                        No command
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="grid grid-cols-4 gap-1.5">
              {ORDERED_SLOTS.map((slot) => {
                const slotItem = draftItemBySlot.get(slot);
                const isSelectedSlot = selectedItem?.slot === slot;
                const changed = Boolean(slotItem && committedSlotById.get(slotItem.id) !== slotItem.slot);
                const gestureStats = gestureStatsBySlot[slot];
                return (
                  <button
                    key={slot}
                    type="button"
                    data-testid={`radial-customizer-gesture-slot-${String(slot)}`}
                    data-command-id={slotItem?.id ?? ''}
                    aria-label={
                      slotItem
                        ? `${radialSlotMeta[slot].direction} slot contains ${slotItem.label}`
                        : `${radialSlotMeta[slot].direction} slot is empty`
                    }
                    aria-pressed={isSelectedSlot}
                    title={`Move selected command to ${radialSlotMeta[slot].direction} (Alt+${String(slot + 1)})`}
                    disabled={!selectedItem || selectedItem.customizable === false}
                    className={coachSlotClasses(isSelectedSlot, changed, slotItem?.destructive)}
                    onClick={() => {
                      if (!selectedItem || selectedItem.customizable === false) {
                        return;
                      }
                      handleMoveDraft(selectedItem.id, slot);
                    }}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[9px] font-semibold text-muted-foreground">
                        {radialSlotMeta[slot].direction}
                      </span>
                      <span className="flex shrink-0 items-center gap-0.5">
                        {slotItem && isRadialAiCommand(slotItem) && (
                          <span
                            data-testid={`radial-customizer-gesture-slot-ai-${String(slot)}`}
                            className="rounded border border-fuchsia-300/35 bg-fuchsia-500/15 px-1 text-[8px] font-semibold text-fuchsia-100"
                          >
                            AI
                          </span>
                        )}
                        {slotItem?.destructive && (
                          <span
                            data-testid={`radial-customizer-gesture-slot-risk-${String(slot)}`}
                            className="rounded border border-red-300/35 bg-red-500/15 px-1 text-[8px] font-semibold text-red-100"
                          >
                            Risk
                          </span>
                        )}
                        {changed && (
                          <span
                            data-testid={`radial-customizer-gesture-slot-moved-${String(slot)}`}
                            className="rounded border border-primary/35 bg-primary/15 px-1 text-[8px] font-semibold text-primary"
                          >
                            Moved
                          </span>
                        )}
                      </span>
                    </div>
                    <div
                      data-testid={`radial-customizer-gesture-slot-label-${String(slot)}`}
                      className="truncate text-[9px] font-medium leading-[1.1]"
                    >
                      {slotItem?.label ?? 'Empty'}
                    </div>
                    <div
                      data-testid={`radial-customizer-gesture-slot-usage-${String(slot)}`}
                      className="truncate text-[8px] leading-[1.1] text-muted-foreground"
                      title={
                        gestureStats.averageMs == null
                          ? formatGestureUsage(gestureStats)
                          : `${formatGestureUsage(gestureStats)} / avg ${String(Math.round(gestureStats.averageMs))}ms`
                      }
                    >
                      {formatGestureUsage(gestureStats)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded border border-border/65 bg-background/45">
            <button
              type="button"
              data-testid="radial-customizer-preset-toggle"
              aria-expanded={presetsOpen}
              className="flex w-full items-center justify-between gap-2 px-2 py-2 text-left text-xs font-semibold text-foreground transition-colors hover:bg-muted/25"
              onClick={() => setPresetsOpen((open) => !open)}
            >
              <span className="flex min-w-0 items-center gap-2">
                <FileJson className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate">Presets</span>
              </span>
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
                  presetsOpen && 'rotate-180',
                )}
              />
            </button>
            {presetsOpen && (
              <div data-testid="radial-customizer-preset-panel" className="space-y-2 border-t border-border/65 p-2">
                <div className="flex items-center gap-1">
                  <input
                    data-testid="radial-customizer-preset-name"
                    aria-label="Radial preset name"
                    value={presetName}
                    maxLength={40}
                    className="min-w-0 flex-1 rounded border border-border/70 bg-card/70 px-2 py-1.5 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/60"
                    onChange={(event) => setPresetName(event.currentTarget.value)}
                  />
                  <button
                    type="button"
                    data-testid="radial-customizer-preset-save"
                    aria-label="Save radial layout preset"
                    title="Save preset"
                    className="rounded border border-primary/55 bg-primary/15 p-1.5 text-primary transition-colors hover:bg-primary/25"
                    onClick={handleSaveNamedPreset}
                  >
                    <BookmarkPlus className="h-3.5 w-3.5" />
                  </button>
                </div>

                {recommendedPreset && (
                  <button
                    type="button"
                    data-testid="radial-customizer-preset-recommendation"
                    data-preset-id={recommendedPreset.id}
                    className="flex w-full min-w-0 items-center gap-1 rounded border border-primary/35 bg-primary/10 px-1.5 py-1 text-left text-[10px] text-primary transition-colors hover:border-primary/60 hover:bg-primary/15"
                    title={recommendedPresetStatus}
                    onClick={handlePinRecommendedPreset}
                  >
                    <Pin className="h-3 w-3 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{recommendedPresetStatus}</span>
                    <span className="shrink-0 rounded border border-primary/45 bg-background/35 px-1 py-px text-[8px] font-semibold uppercase tracking-normal">
                      Pin
                    </span>
                  </button>
                )}

                {savedPresets.length > 0 && (
                  <div
                    data-testid="radial-customizer-preset-shelf"
                    className="max-h-24 space-y-1 overflow-y-auto rounded border border-border/60 bg-card/45 p-1"
                  >
                    {savedPresets.map((preset) => (
                      <div
                        key={preset.id}
                        data-testid={`radial-customizer-saved-preset-${preset.id}`}
                        data-pinned={pinnedPresetId === preset.id ? 'true' : 'false'}
                        className={cn(
                          'flex items-center gap-1 rounded bg-background/50 px-1.5 py-1',
                          pinnedPresetId === preset.id && 'outline outline-1 outline-primary/55',
                        )}
                      >
                        <button
                          type="button"
                          data-testid={`radial-customizer-preset-load-${preset.id}`}
                          className="min-w-0 flex-1 truncate text-left text-[11px] font-semibold text-foreground transition-colors hover:text-primary"
                          title={`Load ${preset.name}`}
                          onClick={() => loadPresetSlots(preset)}
                        >
                          {preset.name}
                        </button>
                        <button
                          type="button"
                          data-testid={`radial-customizer-preset-pin-${preset.id}`}
                          aria-label={
                            pinnedPresetId === preset.id
                              ? `Unpin ${preset.name} from this context`
                              : `Pin ${preset.name} to this context`
                          }
                          aria-pressed={pinnedPresetId === preset.id}
                          title={pinnedPresetId === preset.id ? 'Unpin preset' : 'Pin preset to this context'}
                          className={cn(
                            'shrink-0 rounded border p-1 transition-colors',
                            pinnedPresetId === preset.id
                              ? 'border-primary/60 bg-primary/20 text-primary'
                              : 'border-border/60 bg-muted/20 text-muted-foreground hover:border-primary/50 hover:text-primary',
                          )}
                          onClick={() => handleTogglePinnedPreset(preset)}
                        >
                          {pinnedPresetId === preset.id ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                        </button>
                        <button
                          type="button"
                          data-testid={`radial-customizer-preset-delete-${preset.id}`}
                          aria-label={`Delete ${preset.name}`}
                          title="Delete preset"
                          className="shrink-0 rounded border border-border/60 bg-muted/20 p-1 text-muted-foreground transition-colors hover:border-red-300/50 hover:text-red-300"
                          onClick={() => handleDeleteNamedPreset(preset.id, preset.name)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div
                  data-testid="radial-customizer-pinned-preset"
                  data-pinned={pinnedPreset ? 'true' : 'false'}
                  data-preset-id={pinnedPreset?.id ?? ''}
                  className={cn(
                    'flex min-w-0 items-center gap-1 rounded border px-1.5 py-1 text-[10px]',
                    pinnedPreset
                      ? 'border-primary/45 bg-primary/10 text-primary'
                      : 'border-border/60 bg-muted/20 text-muted-foreground',
                  )}
                  title={pinnedPresetStatus}
                >
                  <Pin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{pinnedPresetStatus}</span>
                </div>

                <div className="flex gap-2">
                  <textarea
                    data-testid="radial-customizer-preset-text"
                    aria-label="Radial preset JSON"
                    value={presetText}
                    placeholder="Preset JSON"
                    className="h-20 min-h-16 flex-1 resize-y rounded border border-border/70 bg-card/70 p-2 font-mono text-[10px] leading-tight text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/60"
                    onChange={(event) => {
                      setPresetText(event.currentTarget.value);
                      if (presetStatus.tone === 'error') {
                        setPresetStatus({ tone: 'neutral', message: 'Preset ready' });
                      }
                    }}
                  />
                  <div className="grid shrink-0 content-start gap-1">
                    <button
                      type="button"
                      data-testid="radial-customizer-preset-copy"
                      aria-label="Copy radial layout preset"
                      title="Copy preset"
                      className="rounded border border-border/70 bg-muted/30 p-1.5 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                      onClick={handleCopyPreset}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      data-testid="radial-customizer-preset-import"
                      aria-label="Import radial layout preset"
                      title="Import preset"
                      className="rounded border border-primary/55 bg-primary/15 p-1.5 text-primary transition-colors hover:bg-primary/25"
                      onClick={handleImportPreset}
                    >
                      <Upload className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div
                  data-testid="radial-customizer-preset-status"
                  className={cn(
                    'truncate text-[10px]',
                    presetStatus.tone === 'success' && 'text-emerald-300',
                    presetStatus.tone === 'error' && 'text-red-300',
                    presetStatus.tone === 'neutral' && 'text-muted-foreground',
                  )}
                >
                  {presetStatus.message}
                </div>
              </div>
            )}
          </div>

          {smartLayoutSuggestion && (
            <div
              data-testid="radial-customizer-smart-layout"
              className="grid gap-1.5 rounded border border-primary/35 bg-primary/10 px-2 py-1.5"
            >
              <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2 text-[10px] font-semibold text-primary">
                  <Zap className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Smart wheel</span>
                </div>
                <span
                  data-testid="radial-customizer-smart-layout-count"
                  className="shrink-0 rounded border border-primary/45 bg-background/35 px-1.5 py-0.5 text-[9px] font-semibold text-primary"
                >
                  {smartLayoutSuggestion.summary}
                </span>
              </div>
              <button
                type="button"
                data-testid="radial-customizer-smart-layout-suggestion"
                data-change-count={smartLayoutSuggestion.changeCount}
                data-recent-count={smartLayoutSuggestion.recentSignalCount}
                data-semantic-move-count={smartLayoutSuggestion.semanticMoveCount}
                data-friction-misses={smartLayoutSuggestion.frictionMisses}
                data-preset-id={smartLayoutSuggestion.presetId ?? ''}
                data-preset-name={smartLayoutSuggestion.presetName ?? ''}
                data-primary-command-id={smartLayoutSuggestion.primaryCommandId}
                aria-label={`Stage smart radial wheel, ${smartLayoutSuggestion.summary}`}
                title={`Stage smart radial wheel: ${smartLayoutSuggestion.detail}`}
                className="flex min-w-0 items-center gap-1.5 rounded border border-primary/45 bg-background/35 px-1.5 py-1 text-left text-[10px] text-primary transition-colors hover:border-primary/70 hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                onClick={handleApplySmartLayoutSuggestion}
              >
                <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
                <span className="shrink-0 font-semibold">Tune wheel</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{smartLayoutSuggestion.detail}</span>
              </button>
              {smartLayoutPreviewSlots.length > 0 && (
                <div
                  data-testid="radial-customizer-smart-layout-preview"
                  data-slot-count={smartLayoutPreviewSlots.length}
                  data-change-count={smartLayoutSuggestion.changeCount}
                  className="grid gap-1"
                >
                  <div className="flex min-w-0 items-center justify-between gap-2 text-[9px] font-semibold text-muted-foreground">
                    <span className="truncate">After preview</span>
                    <span className="shrink-0 rounded border border-primary/25 bg-background/25 px-1 py-px">
                      {String(smartLayoutSuggestion.changeCount)} changed
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1" role="list" aria-label="Smart wheel after layout preview">
                    {smartLayoutPreviewSlots.map((previewSlot) => (
                      <div
                        key={previewSlot.slot}
                        data-testid={`radial-customizer-smart-layout-preview-slot-${String(previewSlot.slot)}`}
                        data-slot={previewSlot.slot}
                        data-direction={previewSlot.direction}
                        data-command-id={previewSlot.item?.id ?? ''}
                        data-changed={previewSlot.changed ? 'true' : 'false'}
                        data-reasons={previewSlot.move?.reasonIds.join(' ') ?? ''}
                        role="listitem"
                        title={
                          previewSlot.item
                            ? `${previewSlot.direction}: ${previewSlot.item.label}${previewSlot.move ? ` - ${previewSlot.move.reasonLabel}` : ''}`
                            : `${previewSlot.direction}: empty`
                        }
                        className={cn(
                          'min-w-0 rounded border px-1.5 py-1 text-[9px] transition-colors',
                          previewSlot.changed
                            ? 'border-primary/45 bg-primary/15 text-primary'
                            : 'border-border/55 bg-background/25 text-muted-foreground',
                        )}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold">{previewSlot.direction}</span>
                          {previewSlot.changed && (
                            <span className="rounded border border-primary/35 bg-background/35 px-1 text-[8px] font-semibold">
                              New
                            </span>
                          )}
                        </div>
                        <div className="truncate font-semibold text-foreground">
                          {previewSlot.item?.label ?? 'Empty'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {smartLayoutSuggestion.moves.length > 0 && (
                <div
                  data-testid="radial-customizer-smart-layout-moves"
                  data-count={smartLayoutSuggestion.moves.length}
                  className="grid gap-1"
                >
                  {smartLayoutSuggestion.moves.slice(0, 3).map((move) => (
                    <div
                      key={`${move.commandId}-${String(move.fromSlot)}-${String(move.toSlot)}`}
                      data-testid={`radial-customizer-smart-layout-move-${move.commandId}`}
                      data-command-id={move.commandId}
                      data-from-slot={move.fromSlot}
                      data-to-slot={move.toSlot}
                      data-from-direction={move.fromDirection}
                      data-to-direction={move.toDirection}
                      data-reasons={move.reasonIds.join(' ')}
                      data-evidence={move.evidence}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded border border-primary/25 bg-background/25 px-1.5 py-1 text-[9px]"
                      title={`${move.label}: ${move.fromDirection} to ${move.toDirection} - ${move.evidence}`}
                    >
                      <span className="min-w-0 truncate font-semibold text-foreground">{move.label}</span>
                      <span className="shrink-0 rounded border border-primary/35 bg-primary/10 px-1 py-px font-semibold text-primary">
                        {move.fromDirection} {'->'} {move.toDirection}
                      </span>
                      <span className="min-w-0 truncate text-muted-foreground">{move.reasonLabel}</span>
                      <span className="min-w-0 truncate text-right text-muted-foreground">{move.evidence}</span>
                    </div>
                  ))}
                  {smartLayoutSuggestion.moves.length > 3 && (
                    <div
                      data-testid="radial-customizer-smart-layout-move-overflow"
                      className="rounded border border-primary/25 bg-background/25 px-1.5 py-1 text-[9px] font-semibold text-muted-foreground"
                    >
                      +{String(smartLayoutSuggestion.moves.length - 3)} more staged moves
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div
            data-testid="radial-customizer-coverage-map"
            data-context-count={radialCoverageEntries.length}
            data-ready-count={radialCoverageReadyCount}
            data-full-count={radialCoverageFullCount}
            data-ai-context-count={radialCoverageAiContextCount}
            data-current-key={currentRadialCoverage?.key ?? ''}
            className="grid gap-1.5 rounded border border-border/65 bg-background/45 px-2 py-1.5"
          >
            <div className="flex min-w-0 items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2 text-[10px] font-semibold text-foreground">
                <Crosshair className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate">Coverage map</span>
              </div>
              <span className="shrink-0 rounded border border-border/60 bg-muted/25 px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                {String(radialCoverageReadyCount)}/{String(radialCoverageEntries.length)} live
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-[9px]">
              <span
                data-testid="radial-customizer-coverage-current-summary"
                data-command-count={currentRadialCoverage?.commandCount ?? 0}
                data-empty-slot-count={currentRadialCoverage?.emptySlotCount ?? 0}
                className="min-w-0 truncate rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-semibold text-primary"
                title={
                  currentRadialCoverage
                    ? `${currentRadialCoverage.viewLabel} ${currentRadialCoverage.targetLabel}: ${String(currentRadialCoverage.commandCount)} commands`
                    : 'No current coverage entry'
                }
              >
                {String(currentRadialCoverage?.commandCount ?? 0)}/8 here
              </span>
              <span
                data-testid="radial-customizer-coverage-full-count"
                className="min-w-0 truncate rounded border border-emerald-300/30 bg-emerald-500/10 px-1.5 py-0.5 font-semibold text-emerald-100"
              >
                {String(radialCoverageFullCount)} full
              </span>
              <span
                data-testid="radial-customizer-coverage-ai-count"
                className="min-w-0 truncate rounded border border-fuchsia-300/30 bg-fuchsia-500/10 px-1.5 py-0.5 font-semibold text-fuchsia-100"
              >
                AI {String(radialCoverageAiContextCount)}
              </span>
            </div>
            <div
              data-testid="radial-customizer-coverage-list"
              className="grid max-h-36 grid-cols-2 gap-1 overflow-y-auto pr-0.5"
              role="list"
              aria-label="Radial command coverage by context"
            >
              {sortedRadialCoverageEntries.map((entry) => {
                const current = entry.context.view === context.view && entry.context.target === context.target;
                const emptySlotLabel =
                  entry.emptySlotDirections.length > 0 ? entry.emptySlotDirections.join(' ') : 'none';
                return (
                  <div
                    key={entry.key}
                    data-testid={`radial-customizer-coverage-${entry.key}`}
                    data-view={entry.context.view}
                    data-target={entry.context.target}
                    data-current={current ? 'true' : 'false'}
                    data-command-count={entry.commandCount}
                    data-linear-command-count={entry.linearCommandCount}
                    data-empty-slot-count={entry.emptySlotCount}
                    data-ai-count={entry.aiCommandCount}
                    data-destructive-count={entry.destructiveCount}
                    data-coverage={entry.coverageLevel}
                    data-empty-slots={emptySlotLabel}
                    role="listitem"
                    title={`${entry.viewLabel} ${entry.targetLabel}: ${String(entry.commandCount)} radial commands, empty ${emptySlotLabel}`}
                    className={radialCoverageCellClasses(current)}
                  >
                    <div className="flex min-w-0 items-center justify-between gap-1">
                      <span className="min-w-0 truncate text-[9px] font-semibold text-foreground">
                        {entry.viewLabel}
                      </span>
                      <span className="shrink-0 rounded border border-current/25 px-1 text-[8px] font-semibold">
                        {radialCoverageLevelLabel(entry.coverageLevel)}
                      </span>
                    </div>
                    <div className="truncate text-[8px] leading-tight text-muted-foreground">{entry.targetLabel}</div>
                    <div className="mt-1 flex min-w-0 items-center gap-1 text-[8px]">
                      <span
                        data-testid={`radial-customizer-coverage-${entry.key}-commands`}
                        className="rounded border border-current/25 px-1 font-semibold"
                      >
                        {String(entry.commandCount)}/8
                      </span>
                      {entry.aiCommandCount > 0 && (
                        <span className="rounded border border-fuchsia-300/25 bg-fuchsia-500/10 px-1 font-semibold text-fuchsia-100">
                          AI {String(entry.aiCommandCount)}
                        </span>
                      )}
                      <span className="min-w-0 truncate text-muted-foreground">Empty {emptySlotLabel}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {recentCommandItems.length > 0 && (
            <div
              data-testid="radial-customizer-recent-commands"
              className="grid gap-1.5 rounded border border-border/65 bg-background/45 px-2 py-1.5"
            >
              <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2 text-[10px] font-semibold text-foreground">
                  <History className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="truncate">Recent here</span>
                </div>
                <span className="shrink-0 rounded border border-border/60 bg-muted/25 px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                  {contextSummary}
                </span>
              </div>
              <div className="grid gap-1">
                {recentCommandItems.map(({ item, count, direction }) => {
                  const Icon = item.icon;
                  const usageLabel = formatRecentCommandUsage(count);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-testid={`radial-customizer-recent-command-${item.id}`}
                      data-command-id={item.id}
                      data-count={count}
                      data-slot={item.slot}
                      data-direction={direction}
                      aria-label={`Select recent command ${item.label}, ${usageLabel}`}
                      title={`${item.label}: ${usageLabel} in ${contextSummary}`}
                      className="flex min-w-0 items-center gap-1.5 rounded border border-border/60 bg-muted/20 px-1.5 py-1 text-left text-[10px] text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/65"
                      onClick={() => handleSelectRecentCommand(item.id)}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="min-w-0 flex-1 truncate font-semibold text-foreground">{item.label}</span>
                      <span className="shrink-0 rounded border border-border/60 bg-background/45 px-1 py-px font-semibold">
                        {direction}
                      </span>
                      <span className="shrink-0 rounded border border-border/60 bg-background/45 px-1 py-px">
                        {usageLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div
            data-testid="radial-customizer-command-filter"
            className="grid gap-1.5 rounded border border-border/65 bg-background/45 px-2 py-1.5"
          >
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="search"
                data-testid="radial-customizer-command-search"
                aria-label="Search radial commands"
                aria-keyshortcuts="Control+F Meta+F / Escape"
                value={commandQuery}
                placeholder="Search commands"
                className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/70"
                onChange={(event) => setCommandQuery(event.currentTarget.value)}
              />
              <span
                data-testid="radial-customizer-command-count"
                className="shrink-0 rounded border border-border/60 bg-muted/25 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
              >
                {visibleDraftItems.length}/{draftItems.length}
              </span>
              {commandQuery.trim().length > 0 && (
                <button
                  type="button"
                  data-testid="radial-customizer-command-search-clear"
                  aria-label="Clear radial command search"
                  title="Clear search"
                  className="shrink-0 rounded border border-border/60 bg-muted/25 p-1 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                  onClick={() => setCommandQuery('')}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <div
              data-testid="radial-customizer-mastery-filter"
              className="grid grid-cols-4 gap-1"
              role="group"
              aria-label="Filter commands by gesture mastery"
            >
              {COMMAND_MASTERY_FILTERS.map((filter) => {
                const count = filter.id === 'all' ? draftItems.length : masteryCounts[filter.id];
                const active = masteryFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    type="button"
                    data-testid={`radial-customizer-mastery-filter-${filter.id}`}
                    aria-pressed={active}
                    title={`${filter.label} commands`}
                    className={cn(
                      'flex min-w-0 items-center justify-center gap-1 rounded border px-1.5 py-1 text-[9px] font-semibold transition-colors',
                      active
                        ? 'border-primary/55 bg-primary/15 text-primary'
                        : 'border-border/60 bg-muted/20 text-muted-foreground hover:border-primary/45 hover:text-foreground',
                    )}
                    onClick={() => setMasteryFilter(filter.id)}
                  >
                    <span className="truncate">{filter.label}</span>
                    <span
                      data-testid={`radial-customizer-mastery-filter-count-${filter.id}`}
                      className="rounded border border-current/25 px-1 text-[8px]"
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {visibleDraftItems.length === 0 && (
            <div
              data-testid="radial-customizer-command-empty"
              className="rounded border border-dashed border-border/70 bg-background/35 px-3 py-4 text-center text-[11px] text-muted-foreground"
            >
              No commands match this search.
            </div>
          )}

          {visibleDraftItems.map((item) => {
            const Icon = item.icon;
            const changed = committedSlotById.get(item.id) !== item.slot;
            const mastery = commandMasteryById[item.id] ?? {
              status: 'cold',
              streak: 0,
              label: 'Cold',
              detail: `${item.label} has no current ${radialSlotMeta[item.slot].direction} streak`,
            };
            return (
              <div
                key={item.id}
                data-testid={`radial-customizer-row-${item.id}`}
                className={cn(
                  'rounded border border-border/65 bg-background/45 p-2',
                  selectedItem?.id === item.id && 'border-primary/45 bg-primary/5',
                )}
                onMouseEnter={() => setSelectedCommandId(item.id)}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border/70 bg-muted/35 text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-xs font-semibold text-foreground">{item.label}</div>
                      <span
                        className={cn(
                          'rounded border border-border/70 bg-muted/35 px-1.5 py-0.5 text-[9px] text-muted-foreground',
                          changed && 'border-primary/45 text-primary',
                        )}
                      >
                        {radialSlotMeta[item.slot].direction}
                      </span>
                      <span
                        data-testid={`radial-customizer-mastery-${item.id}`}
                        data-status={mastery.status}
                        title={mastery.detail}
                        className={cn(
                          'flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-semibold',
                          commandMasteryClasses(mastery.status),
                        )}
                      >
                        <Trophy className="h-3 w-3" />
                        <span>{mastery.label}</span>
                      </span>
                    </div>
                    <div className="line-clamp-2 text-[10px] leading-tight text-muted-foreground">
                      {item.description}
                    </div>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-8 gap-1">
                  {ORDERED_SLOTS.map((slot) => (
                    <button
                      key={`${item.id}-${String(slot)}`}
                      type="button"
                      data-testid={`radial-customizer-slot-${item.id}-${String(slot)}`}
                      aria-label={`Move ${item.label} to ${radialSlotMeta[slot].direction}`}
                      aria-pressed={item.slot === slot}
                      disabled={item.customizable === false}
                      className={cn(
                        slotButtonClasses(item.slot === slot),
                        item.customizable === false && 'cursor-not-allowed opacity-40',
                      )}
                      onClick={() => handleMoveDraft(item.id, slot)}
                    >
                      {radialSlotMeta[slot].direction}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isCollapsed && (
        <div
          id="radial-customizer-footer"
          data-testid="radial-customizer-footer"
          className="max-h-[min(12rem,42dvh)] shrink-0 overflow-y-auto border-t border-border bg-card/70 p-3"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <div data-testid="radial-customizer-draft-status" className="truncate text-[10px] text-muted-foreground">
              {draftStatus}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                data-testid="radial-customizer-revert"
                aria-label="Revert draft radial layout"
                title="Revert draft"
                disabled={draftChangeCount === 0}
                className="rounded border border-border/70 bg-muted/30 p-1.5 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                onClick={handleRevertDraft}
              >
                <Undo2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                data-testid="radial-customizer-apply"
                aria-label="Apply radial wheel layout"
                title="Apply layout"
                disabled={draftChangeCount === 0}
                className="rounded border border-primary/55 bg-primary/15 p-1.5 text-primary transition-colors hover:bg-primary/25 disabled:cursor-not-allowed disabled:border-border/70 disabled:bg-muted/25 disabled:text-muted-foreground disabled:opacity-50"
                onClick={handleApplyDraft}
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <RadialTelemetryInspector density="compact" />
        </div>
      )}
    </section>
  );
}
