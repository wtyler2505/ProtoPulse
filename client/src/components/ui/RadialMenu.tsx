import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getTargetSummary,
  getViewSummary,
  radialSlotMeta,
  RADIAL_SLOT_COUNT,
  type MenuContext,
  type RadialCommandGroup,
  type RadialMenuItem,
  type RadialSlot,
} from '@/lib/radial-menu-actions';
import { recordRadialTelemetry } from '@/lib/radial-menu-telemetry';
import type { RadialCommandPreviewState } from '@/components/ui/RadialCommandPreview';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RadialMenuPosition {
  x: number;
  y: number;
}

export interface RadialMenuSelectOptions {
  sendNow?: boolean;
  input: 'mouse' | 'keyboard' | 'marking';
  modifier?: 'shift';
}

export interface RadialMenuProps {
  /** Items to display as pie segments. Best with 3-8. */
  items: RadialMenuItem[];
  /** Context shown in the center well. */
  context?: MenuContext;
  /** Screen-space position where the menu opens (center point). */
  position: RadialMenuPosition;
  /** Performance timestamp captured before the menu was scheduled for render. */
  openedAt?: number;
  /** Called when the menu should close (Escape, click-away, item select). */
  onClose: () => void;
  /** Called when an item is selected. */
  onSelect: (itemId: string, options: RadialMenuSelectOptions) => void;
  /** Optional destructive item that should open already armed for confirmation. */
  confirmItemId?: string;
  /** Called when the user wants to customize the current wheel layout. */
  onCustomize?: () => void;
  /** Called when the user wants to resend the most recent radial AI prompt. */
  onRepeatLastAi?: () => void;
  /** Accessible label for the repeat AI affordance. */
  repeatLastAiLabel?: string;
  /** Tooltip/description for the repeat AI affordance. */
  repeatLastAiDescription?: string;
  /** Called when the active command changes so the workspace can show a lightweight preview. */
  onPreviewChange?: (preview: RadialCommandPreviewState | null) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Outer radius of the radial menu (px). */
const OUTER_RADIUS = 132;
/** Inner radius — the dead zone in the center (px). */
const INNER_RADIUS = 46;
/** Viewport margin — the menu won't render outside this buffer (px). */
const VIEWPORT_MARGIN = 12;
/** Total diameter including a small padding for labels. */
const MENU_SIZE = (OUTER_RADIUS + 70) * 2;
const SLOT_ANGLE = 360 / RADIAL_SLOT_COUNT;
const CENTER = MENU_SIZE / 2;
const DESTRUCTIVE_CONFIRM_TIMEOUT_MS = 5200;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Scale the wheel down only when the viewport cannot fit the full command
 * surface. The menu still uses the same SVG geometry, so hover math and labels
 * stay stable.
 */
function getViewportScale(): number {
  if (typeof window === 'undefined') {
    return 1;
  }

  const availableWidth = window.innerWidth - VIEWPORT_MARGIN * 2;
  const availableHeight = window.innerHeight - VIEWPORT_MARGIN * 2;
  return Math.min(1, availableWidth / MENU_SIZE, availableHeight / MENU_SIZE);
}

/**
 * Clamp position so the entire menu stays within the viewport.
 */
function clampPosition(pos: RadialMenuPosition, scale = 1): RadialMenuPosition {
  const halfSize = (MENU_SIZE * scale) / 2;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1080;
  return {
    x: Math.max(halfSize + VIEWPORT_MARGIN, Math.min(vw - halfSize - VIEWPORT_MARGIN, pos.x)),
    y: Math.max(halfSize + VIEWPORT_MARGIN, Math.min(vh - halfSize - VIEWPORT_MARGIN, pos.y)),
  };
}

function slotFromNumberShortcut(event: KeyboardEvent): RadialSlot | null {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !/^[1-8]$/.test(event.key)) {
    return null;
  }

  return (Number(event.key) - 1) as RadialSlot;
}

/**
 * Build the SVG arc path for a single pie segment.
 */
function arcPath(
  cx: number,
  cy: number,
  startAngle: number,
  endAngle: number,
  innerR: number,
  outerR: number,
): string {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const sr = toRad(startAngle);
  const er = toRad(endAngle);
  const x1 = cx + outerR * Math.cos(sr);
  const y1 = cy + outerR * Math.sin(sr);
  const x2 = cx + outerR * Math.cos(er);
  const y2 = cy + outerR * Math.sin(er);
  const x3 = cx + innerR * Math.cos(er);
  const y3 = cy + innerR * Math.sin(er);
  const x4 = cx + innerR * Math.cos(sr);
  const y4 = cy + innerR * Math.sin(sr);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${String(x1)} ${String(y1)}`,
    `A ${String(outerR)} ${String(outerR)} 0 ${String(largeArc)} 1 ${String(x2)} ${String(y2)}`,
    `L ${String(x3)} ${String(y3)}`,
    `A ${String(innerR)} ${String(innerR)} 0 ${String(largeArc)} 0 ${String(x4)} ${String(y4)}`,
    'Z',
  ].join(' ');
}

function slotAngles(slot: number): { start: number; end: number; mid: number } {
  const mid = -90 + slot * SLOT_ANGLE;
  return {
    start: mid - SLOT_ANGLE / 2,
    end: mid + SLOT_ANGLE / 2,
    mid,
  };
}

function polarPoint(cx: number, cy: number, radius: number, angleDeg: number): { x: number; y: number } {
  const angle = (angleDeg * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

interface SlotLayout {
  slot: number;
  angles: { start: number; end: number; mid: number };
  segmentPath: string;
  guide: { x1: number; y1: number; x2: number; y2: number };
  icon: { x: number; y: number };
  label: { x: number; y: number };
}

interface GroupTone {
  idle: string;
  hover: string;
  icon: string;
  text: string;
  badge: string;
}

const DELETE_TONE: GroupTone = {
  idle: 'fill-red-500/10 stroke-red-500/35',
  hover: 'fill-red-500/30 stroke-red-300',
  icon: 'text-red-300',
  text: 'text-red-100',
  badge: 'border-red-400/40 bg-red-500/15 text-red-100',
};

const GROUP_TONES: Record<RadialCommandGroup, GroupTone> = {
  create: {
    idle: 'fill-emerald-500/10 stroke-emerald-400/35',
    hover: 'fill-emerald-500/25 stroke-emerald-300',
    icon: 'text-emerald-200',
    text: 'text-emerald-50',
    badge: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-50',
  },
  transform: {
    idle: 'fill-sky-500/10 stroke-sky-400/35',
    hover: 'fill-sky-500/25 stroke-sky-300',
    icon: 'text-sky-200',
    text: 'text-sky-50',
    badge: 'border-sky-400/40 bg-sky-500/15 text-sky-50',
  },
  connect: {
    idle: 'fill-cyan-500/10 stroke-cyan-400/35',
    hover: 'fill-cyan-500/25 stroke-cyan-300',
    icon: 'text-cyan-200',
    text: 'text-cyan-50',
    badge: 'border-cyan-400/40 bg-cyan-500/15 text-cyan-50',
  },
  inspect: {
    idle: 'fill-teal-500/10 stroke-teal-400/35',
    hover: 'fill-teal-500/25 stroke-teal-300',
    icon: 'text-teal-200',
    text: 'text-teal-50',
    badge: 'border-teal-400/40 bg-teal-500/15 text-teal-50',
  },
  run: {
    idle: 'fill-amber-500/10 stroke-amber-400/35',
    hover: 'fill-amber-500/25 stroke-amber-300',
    icon: 'text-amber-200',
    text: 'text-amber-50',
    badge: 'border-amber-400/40 bg-amber-500/15 text-amber-50',
  },
  delete: DELETE_TONE,
  edit: {
    idle: 'fill-blue-500/10 stroke-blue-400/35',
    hover: 'fill-blue-500/25 stroke-blue-300',
    icon: 'text-blue-200',
    text: 'text-blue-50',
    badge: 'border-blue-400/40 bg-blue-500/15 text-blue-50',
  },
  reuse: {
    idle: 'fill-lime-500/10 stroke-lime-400/35',
    hover: 'fill-lime-500/25 stroke-lime-300',
    icon: 'text-lime-200',
    text: 'text-lime-50',
    badge: 'border-lime-400/40 bg-lime-500/15 text-lime-50',
  },
};

function groupClasses(group: RadialCommandGroup, destructive?: boolean): GroupTone {
  return destructive ? DELETE_TONE : GROUP_TONES[group];
}

function buildSelectOptions(
  input: RadialMenuSelectOptions['input'],
  sendNow = false,
): RadialMenuSelectOptions {
  return sendNow ? { input, sendNow: true, modifier: 'shift' } : { input };
}

function slotShortcut(slot: RadialSlot): string {
  return String(slot + 1);
}

const SLOT_LAYOUTS: SlotLayout[] = Array.from({ length: RADIAL_SLOT_COUNT }, (_, slot) => {
  const angles = slotAngles(slot);
  const midAngle = (angles.mid * Math.PI) / 180;
  const iconR = (INNER_RADIUS + OUTER_RADIUS) / 2;
  const labelR = OUTER_RADIUS + 36;
  const guideStart = polarPoint(CENTER, CENTER, INNER_RADIUS + 7, angles.start);
  const guideEnd = polarPoint(CENTER, CENTER, OUTER_RADIUS + 10, angles.start);

  return {
    slot,
    angles,
    segmentPath: arcPath(CENTER, CENTER, angles.start, angles.end, INNER_RADIUS, OUTER_RADIUS),
    guide: {
      x1: guideStart.x,
      y1: guideStart.y,
      x2: guideEnd.x,
      y2: guideEnd.y,
    },
    icon: {
      x: CENTER + iconR * Math.cos(midAngle),
      y: CENTER + iconR * Math.sin(midAngle),
    },
    label: {
      x: CENTER + labelR * Math.cos(midAngle),
      y: CENTER + labelR * Math.sin(midAngle),
    },
  };
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function RadialMenu({
  items,
  context,
  position,
  openedAt,
  onClose,
  onSelect,
  confirmItemId,
  onCustomize,
  onRepeatLastAi,
  repeatLastAiLabel,
  repeatLastAiDescription,
  onPreviewChange,
}: RadialMenuProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number>(-1);
  const [isOpen, setIsOpen] = useState(false);
  const [armedItemId, setArmedItemId] = useState<string | null>(confirmItemId ?? null);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemLayouts = useMemo(
    () => items.map((item, index) => ({
      item,
      layout: SLOT_LAYOUTS[item.slot] ?? SLOT_LAYOUTS[index % RADIAL_SLOT_COUNT],
      tone: groupClasses(item.group, item.destructive),
      slotMeta: radialSlotMeta[item.slot],
      shortcut: slotShortcut(item.slot),
    })),
    [items],
  );
  const updateActivePreview = useCallback((index: number) => {
    setHoveredIndex(index);
    if (!context) {
      onPreviewChange?.(null);
      return;
    }
    const item = items[index];
    onPreviewChange?.(item ? { context, item, position } : null);
  }, [context, items, onPreviewChange, position]);

  const clearActivePreview = useCallback(() => {
    setHoveredIndex(-1);
    onPreviewChange?.(null);
  }, [onPreviewChange]);

  const runRepeatLastAi = useCallback(() => {
    if (!onRepeatLastAi) {
      return;
    }

    onPreviewChange?.(null);
    onRepeatLastAi();
    onClose();
  }, [onClose, onPreviewChange, onRepeatLastAi]);

  useEffect(() => {
    setArmedItemId(confirmItemId ?? null);
    if (confirmItemId) {
      const index = items.findIndex((item) => item.id === confirmItemId);
      if (index >= 0) {
        updateActivePreview(index);
      }
    }
  }, [confirmItemId, items, updateActivePreview]);

  useEffect(() => {
    if (!armedItemId) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setArmedItemId((current) => current === armedItemId ? null : current);
    }, DESTRUCTIVE_CONFIRM_TIMEOUT_MS);

    return () => window.clearTimeout(timeout);
  }, [armedItemId]);

  useEffect(() => () => {
    onPreviewChange?.(null);
  }, [onPreviewChange]);

  useLayoutEffect(() => {
    if (openedAt == null || !context) {
      return;
    }
    recordRadialTelemetry({
      name: 'visible-mounted',
      view: context.view,
      target: context.target,
      durationMs: performance.now() - openedAt,
      actionCount: items.length,
    });
  }, [context, items.length, openedAt]);

  // Trigger open animation after the first committed paint.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setIsOpen(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const selectItem = useCallback((item: RadialMenuItem, index: number, options: RadialMenuSelectOptions) => {
    if (item.disabled) {
      return;
    }

    if (item.destructive && armedItemId !== item.id) {
      setArmedItemId(item.id);
      updateActivePreview(index);
      if (context) {
        recordRadialTelemetry({
          name: 'destructive-confirm-requested',
          view: context.view,
          target: context.target,
          commandId: item.id,
          slot: item.slot,
          actionCount: items.length,
        });
      }
      return;
    }

    onPreviewChange?.(null);
    onSelect(item.id, options);
    onClose();
  }, [armedItemId, context, items.length, onClose, onPreviewChange, onSelect, updateActivePreview]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (
        onCustomize &&
        e.key.toLowerCase() === 'c' &&
        !e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey
      ) {
        e.preventDefault();
        e.stopPropagation();
        onPreviewChange?.(null);
        onCustomize();
        return;
      }
      if (
        onRepeatLastAi &&
        e.key.toLowerCase() === 'r' &&
        !e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey
      ) {
        e.preventDefault();
        e.stopPropagation();
        runRepeatLastAi();
        return;
      }
      if (items.length === 0) { return; }

      const targetSlot = slotFromNumberShortcut(e);
      if (targetSlot != null) {
        e.preventDefault();
        e.stopPropagation();
        const targetIndex = items.findIndex((item) => item.slot === targetSlot);
        if (targetIndex >= 0) {
          updateActivePreview(targetIndex);
          selectItem(items[targetIndex], targetIndex, buildSelectOptions('keyboard'));
        }
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = hoveredIndex + 1 >= items.length ? 0 : hoveredIndex + 1;
        updateActivePreview(next);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const next = hoveredIndex - 1 < 0 ? items.length - 1 : hoveredIndex - 1;
        updateActivePreview(next);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (hoveredIndex >= 0 && hoveredIndex < items.length) {
          const item = items[hoveredIndex];
          selectItem(item, hoveredIndex, buildSelectOptions('keyboard', e.shiftKey));
        }
      }
    },
    [hoveredIndex, items, onClose, onCustomize, onPreviewChange, onRepeatLastAi, runRepeatLastAi, selectItem, updateActivePreview],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Click-away close
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay attaching so the opening right-click doesn't immediately close
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleClick);
    }, 50);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  if (items.length === 0) { return null; }

  const viewportScale = getViewportScale();
  const clamped = clampPosition(position, viewportScale);
  const activeItem = hoveredIndex >= 0 ? items[hoveredIndex] : undefined;
  const isConfirmingActiveItem = activeItem?.destructive === true && armedItemId === activeItem.id;
  const centerTitle = isConfirmingActiveItem
    ? `Confirm ${activeItem.label}`
    : activeItem?.label ?? (context ? getTargetSummary(context) : 'Action Wheel');
  const centerDescription = isConfirmingActiveItem
    ? `Click ${activeItem.label} again to run this destructive command.`
    : activeItem?.disabled && activeItem.disabledReason
    ? activeItem.disabledReason
    : activeItem?.description ?? (context ? `${getViewSummary(context)} ${context.target}` : 'Right-click, arrow keys, or flick a direction.');
  const centerMeta = activeItem
    ? radialSlotMeta[activeItem.slot]
    : undefined;
  const centerShortcut = activeItem ? slotShortcut(activeItem.slot) : undefined;
  const menuKeyShortcuts = onRepeatLastAi
    ? 'ArrowRight ArrowLeft ArrowDown ArrowUp Enter Space Escape C R 1 2 3 4 5 6 7 8'
    : 'ArrowRight ArrowLeft ArrowDown ArrowUp Enter Space Escape C 1 2 3 4 5 6 7 8';
  const repeatAiDescription =
    repeatLastAiDescription ?? repeatLastAiLabel ?? 'Repeat the most recent radial AI command.';

  return (
    <div
      ref={containerRef}
      data-testid="radial-menu"
      data-radial-scale={viewportScale.toFixed(3)}
      role="menu"
      tabIndex={-1}
      aria-label="Radial context menu"
      aria-keyshortcuts={menuKeyShortcuts}
      aria-activedescendant={activeItem ? `radial-menuitem-${activeItem.id}` : undefined}
      aria-orientation="vertical"
      className={cn(
        'fixed z-[9999] pointer-events-none',
        'origin-center transform-gpu transition-[transform,opacity] duration-150 ease-out [contain:layout_paint_style] [will-change:transform,opacity]',
        isOpen ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
      )}
      style={{
        left: clamped.x - MENU_SIZE / 2,
        top: clamped.y - MENU_SIZE / 2,
        width: MENU_SIZE,
        height: MENU_SIZE,
        transform: `translateZ(0) scale(${String(isOpen ? viewportScale : viewportScale * 0.5)})`,
      }}
    >
      <svg
        width={MENU_SIZE}
        height={MENU_SIZE}
        viewBox={`0 0 ${String(MENU_SIZE)} ${String(MENU_SIZE)}`}
        className="pointer-events-auto"
        onMouseLeave={clearActivePreview}
      >
        <defs>
          <filter id="radial-command-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="16" stdDeviation="16" floodColor="rgba(0,0,0,0.42)" />
          </filter>
        </defs>
        <circle
          cx={CENTER}
          cy={CENTER}
          r={OUTER_RADIUS + 18}
          className="fill-background/75 stroke-border/80"
          strokeWidth={1}
          filter="url(#radial-command-shadow)"
        />
        {SLOT_LAYOUTS.map((layout) => {
          return (
            <line
              key={`guide-${String(layout.slot)}`}
              x1={layout.guide.x1}
              y1={layout.guide.y1}
              x2={layout.guide.x2}
              y2={layout.guide.y2}
              className="stroke-border/45"
              strokeWidth={1}
              pointerEvents="none"
            />
          );
        })}
        {itemLayouts.map(({ item, layout, tone, slotMeta, shortcut }, i) => {
          const isHovered = hoveredIndex === i;
          const isArmed = armedItemId === item.id && item.destructive === true;
          const Icon = item.icon;
          const shortcutLabel = `${shortcut} / ${item.hint ?? slotMeta.direction}`;

          return (
            <g
              key={item.id}
              id={`radial-menuitem-${item.id}`}
              role="menuitem"
              aria-label={item.label}
              aria-keyshortcuts={shortcut}
              aria-disabled={item.disabled ?? false}
              data-testid={`radial-item-${item.id}`}
              data-slot={item.slot}
              data-shortcut={shortcut}
              className={cn(
                'cursor-pointer transition-colors',
                item.disabled && 'opacity-40 cursor-not-allowed',
              )}
              onMouseEnter={() => updateActivePreview(i)}
              onClick={(event) => {
                if (!item.disabled) {
                  selectItem(item, i, buildSelectOptions('mouse', event.shiftKey));
                }
              }}
            >
              <title>{`${item.label}: press ${shortcut} or flick ${item.hint ?? slotMeta.direction}`}</title>
              {/* Segment arc */}
              <path
                d={layout.segmentPath}
                className={cn(
                  'transition-all duration-100',
                  isHovered || isArmed ? tone.hover : tone.idle,
                )}
                strokeWidth={isHovered || isArmed ? 2.5 : 1.5}
              />
              {/* Icon */}
              <foreignObject
                x={layout.icon.x - 15}
                y={layout.icon.y - 15}
                width={30}
                height={30}
                className="pointer-events-none"
              >
                <div className={cn(
                  'flex h-full w-full items-center justify-center rounded-full border bg-background/85 shadow-sm',
                  isHovered || isArmed ? tone.badge : 'border-border/70 text-foreground/80',
                  isArmed && 'ring-2 ring-red-300/80',
                )}>
                  <Icon
                    className={cn(
                      'w-4 h-4',
                      isHovered || isArmed ? tone.icon : 'text-foreground/70',
                    )}
                  />
                </div>
              </foreignObject>
              {/* Label */}
              <foreignObject
                x={layout.label.x - 48}
                y={layout.label.y - 18}
                width={96}
                height={36}
                className="pointer-events-none"
              >
                <div
                  data-testid={`radial-label-${item.id}`}
                  data-slot={item.slot}
                  className={cn(
                    'flex h-full flex-col items-center justify-center rounded border px-1 text-center shadow-sm backdrop-blur',
                    isHovered || isArmed ? tone.badge : 'border-border/70 bg-background/80 text-foreground/75',
                    isArmed && 'ring-2 ring-red-300/80',
                  )}
                >
                  <span className="max-w-full truncate text-[10px] font-semibold leading-tight">
                    {isArmed ? `Confirm ${item.label}` : item.label}
                  </span>
                  <span
                    data-testid={`radial-shortcut-${item.id}`}
                    className="text-[9px] leading-none opacity-70"
                  >
                    {shortcutLabel}
                  </span>
                </div>
              </foreignObject>
            </g>
          );
        })}
        {/* Center context well */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={INNER_RADIUS + 22}
          className="fill-background/95 stroke-border"
          strokeWidth={1.5}
        />
        <foreignObject
          x={CENTER - 66}
          y={CENTER - 44}
          width={132}
          height={88}
          className="pointer-events-none"
        >
          <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center">
            <div className="max-w-full truncate text-[12px] font-semibold leading-tight text-foreground" data-testid="radial-center-title">
              {centerTitle}
            </div>
            <div className="line-clamp-2 text-[10px] leading-tight text-muted-foreground" data-testid="radial-center-description">
              {centerDescription}
            </div>
            <div className="mt-1 flex items-center gap-1">
              {centerMeta && (
                <span className={cn('rounded border px-1.5 py-0.5 text-[9px] leading-none', groupClasses(centerMeta.group).badge)}>
                  {centerShortcut ? `${centerShortcut}/${centerMeta.direction}` : centerMeta.direction}
                </span>
              )}
              {isConfirmingActiveItem && (
                <span
                  className="rounded border border-red-400/50 bg-red-500/15 px-1.5 py-0.5 text-[9px] leading-none text-red-100"
                  data-testid="radial-confirm-state"
                >
                  Confirm
                </span>
              )}
              <span className="rounded border border-border/70 bg-muted/40 px-1.5 py-0.5 text-[9px] leading-none text-muted-foreground">
                Esc closes
              </span>
            </div>
          </div>
        </foreignObject>
      </svg>
      {onCustomize && (
        <button
          type="button"
          data-testid="radial-customize"
          aria-label="Customize radial wheel"
          aria-keyshortcuts="C"
          title="Customize wheel"
          className="pointer-events-auto absolute right-20 top-20 flex h-8 w-8 items-center justify-center rounded-full border border-border/80 bg-background/90 text-muted-foreground shadow-lg backdrop-blur transition-colors hover:border-primary/50 hover:text-foreground"
          onClick={(event) => {
            event.stopPropagation();
            onCustomize();
          }}
      >
        <SlidersHorizontal className="h-4 w-4" />
      </button>
      )}
      {onRepeatLastAi && repeatLastAiLabel && (
        <button
          type="button"
          data-testid="radial-repeat-ai"
          aria-label={repeatLastAiLabel}
          aria-keyshortcuts="R"
          title={repeatAiDescription}
          className="pointer-events-auto absolute left-20 top-20 flex h-8 items-center gap-1.5 rounded-full border border-sky-300/45 bg-background/90 px-2.5 text-[11px] font-semibold text-sky-100 shadow-lg backdrop-blur transition-colors hover:border-sky-200 hover:bg-sky-500/15 hover:text-white"
          onClick={(event) => {
            event.stopPropagation();
            runRepeatLastAi();
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Repeat AI</span>
        </button>
      )}
    </div>
  );
}

export default memo(RadialMenu);
