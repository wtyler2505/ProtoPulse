import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { RadialMenuItem } from '@/lib/radial-menu-actions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RadialMenuPosition {
  x: number;
  y: number;
}

export interface RadialMenuProps {
  /** Items to display as pie segments. Best with 3-8. */
  items: RadialMenuItem[];
  /** Screen-space position where the menu opens (center point). */
  position: RadialMenuPosition;
  /** Called when the menu should close (Escape, click-away, item select). */
  onClose: () => void;
  /** Called when an item is selected. */
  onSelect: (itemId: string) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Outer radius of the radial menu (px). */
const OUTER_RADIUS = 110;
/** Inner radius — the dead zone in the center (px). */
const INNER_RADIUS = 36;
/** Viewport margin — the menu won't render outside this buffer (px). */
const VIEWPORT_MARGIN = 12;
/** Total diameter including a small padding for labels. */
const MENU_SIZE = (OUTER_RADIUS + 40) * 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Clamp position so the entire menu stays within the viewport.
 */
function clampPosition(pos: RadialMenuPosition): RadialMenuPosition {
  const halfSize = MENU_SIZE / 2;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1080;
  return {
    x: Math.max(halfSize + VIEWPORT_MARGIN, Math.min(vw - halfSize - VIEWPORT_MARGIN, pos.x)),
    y: Math.max(halfSize + VIEWPORT_MARGIN, Math.min(vh - halfSize - VIEWPORT_MARGIN, pos.y)),
  };
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RadialMenu({ items, position, onClose, onSelect }: RadialMenuProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number>(-1);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Trigger open animation on mount
  useEffect(() => {
    // Use rAF to ensure the initial state is painted before animating
    const raf = requestAnimationFrame(() => {
      setIsOpen(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (items.length === 0) { return; }

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setHoveredIndex((prev) => {
          const next = prev + 1;
          return next >= items.length ? 0 : next;
        });
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setHoveredIndex((prev) => {
          const next = prev - 1;
          return next < 0 ? items.length - 1 : next;
        });
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (hoveredIndex >= 0 && hoveredIndex < items.length) {
          const item = items[hoveredIndex];
          if (!item.disabled) {
            onSelect(item.id);
            onClose();
          }
        }
      }
    },
    [items, hoveredIndex, onClose, onSelect],
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

  const clamped = clampPosition(position);
  const cx = MENU_SIZE / 2;
  const cy = MENU_SIZE / 2;
  const segmentAngle = 360 / items.length;
  // Start at -90deg so first item points up
  const startOffset = -90;

  return (
    <div
      ref={containerRef}
      data-testid="radial-menu"
      role="menu"
      aria-label="Radial context menu"
      className={cn(
        'fixed z-[9999] pointer-events-none',
        'transition-transform transition-opacity duration-150 ease-out origin-center',
        isOpen ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
      )}
      style={{
        left: clamped.x - MENU_SIZE / 2,
        top: clamped.y - MENU_SIZE / 2,
        width: MENU_SIZE,
        height: MENU_SIZE,
      }}
    >
      <svg
        width={MENU_SIZE}
        height={MENU_SIZE}
        viewBox={`0 0 ${String(MENU_SIZE)} ${String(MENU_SIZE)}`}
        className="pointer-events-auto"
      >
        {items.map((item, i) => {
          const a0 = startOffset + i * segmentAngle;
          const a1 = a0 + segmentAngle;
          const midAngle = ((a0 + a1) / 2) * (Math.PI / 180);
          const iconR = (INNER_RADIUS + OUTER_RADIUS) / 2;
          const iconX = cx + iconR * Math.cos(midAngle);
          const iconY = cy + iconR * Math.sin(midAngle);
          const labelR = OUTER_RADIUS + 16;
          const labelX = cx + labelR * Math.cos(midAngle);
          const labelY = cy + labelR * Math.sin(midAngle);
          const isHovered = hoveredIndex === i;
          const Icon = item.icon;

          return (
            <g
              key={item.id}
              role="menuitem"
              aria-label={item.label}
              aria-disabled={item.disabled ?? false}
              data-testid={`radial-item-${item.id}`}
              className={cn(
                'cursor-pointer transition-colors',
                item.disabled && 'opacity-40 cursor-not-allowed',
              )}
              onMouseEnter={() => { if (!item.disabled) { setHoveredIndex(i); } }}
              onMouseLeave={() => setHoveredIndex(-1)}
              onClick={() => {
                if (!item.disabled) {
                  onSelect(item.id);
                  onClose();
                }
              }}
            >
              {/* Segment arc */}
              <path
                d={arcPath(cx, cy, a0, a1, INNER_RADIUS, OUTER_RADIUS)}
                className={cn(
                  'transition-all duration-100',
                  isHovered
                    ? item.destructive
                      ? 'fill-destructive/30 stroke-destructive'
                      : 'fill-primary/20 stroke-primary'
                    : 'fill-card/90 stroke-border',
                )}
                strokeWidth={1.5}
              />
              {/* Icon */}
              <foreignObject
                x={iconX - 10}
                y={iconY - 10}
                width={20}
                height={20}
                className="pointer-events-none"
              >
                <div className="flex items-center justify-center w-full h-full">
                  <Icon
                    className={cn(
                      'w-4 h-4',
                      isHovered
                        ? item.destructive
                          ? 'text-destructive'
                          : 'text-primary'
                        : 'text-foreground/70',
                    )}
                  />
                </div>
              </foreignObject>
              {/* Label (visible on hover) */}
              {isHovered && (
                <foreignObject
                  x={labelX - 40}
                  y={labelY - 10}
                  width={80}
                  height={20}
                  className="pointer-events-none"
                >
                  <div
                    data-testid={`radial-label-${item.id}`}
                    className={cn(
                      'text-[11px] font-medium text-center truncate',
                      item.destructive ? 'text-destructive' : 'text-foreground',
                    )}
                  >
                    {item.label}
                  </div>
                </foreignObject>
              )}
            </g>
          );
        })}
        {/* Center circle — decorative */}
        <circle
          cx={cx}
          cy={cy}
          r={INNER_RADIUS - 2}
          className="fill-background/80 stroke-border"
          strokeWidth={1}
        />
      </svg>
    </div>
  );
}
