/**
 * Mobile Table Overflow Handling
 *
 * Provides responsive table overflow management for small-screen devices.
 * Handles horizontal/vertical scrolling, sticky columns, collapsible columns,
 * and column priority for graceful degradation on narrow viewports.
 *
 * Usage:
 *   const classes = getResponsiveTableClasses({ stickyFirstColumn: true });
 *   const collapse = shouldCollapseColumns(375, 8);
 *   const visible = getMobileColumnPriority(columns);
 *
 * React hook:
 *   const ref = useRef<HTMLDivElement>(null);
 *   const { classes, visibleColumns, collapsed } = useMobileTable(ref, columns);
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Scroll direction strategy for overflowed table content. */
export type ScrollDirection = 'horizontal' | 'vertical';

/** Configuration for responsive table behaviour. */
export interface MobileTableConfig {
  /** Viewport width (px) below which mobile layout activates. Default: 768. */
  breakpoint: number;
  /** Scroll axis when the table overflows its container. Default: 'horizontal'. */
  scrollDirection: ScrollDirection;
  /** Whether the first column stays fixed while the rest scroll. Default: false. */
  stickyFirstColumn: boolean;
  /** Whether low-priority columns are collapsed on small screens. Default: false. */
  collapsible: boolean;
}

/** Column descriptor with optional priority for mobile visibility ranking. */
export interface ColumnDescriptor {
  /** Unique key for the column. */
  key: string;
  /** Human-readable header text. */
  label: string;
  /**
   * Visibility priority — lower numbers are shown first on narrow screens.
   * Columns without a priority are treated as lowest priority (shown last / hidden first).
   */
  priority?: number;
}

/** Result returned by the `useMobileTable` hook. */
export interface MobileTableState {
  /** CSS class string to apply to the table wrapper. */
  classes: string;
  /** Columns that should be visible at the current container width. */
  visibleColumns: ColumnDescriptor[];
  /** Whether columns have been collapsed (container narrower than breakpoint). */
  collapsed: boolean;
  /** Current measured container width in pixels (0 before first measurement). */
  containerWidth: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default configuration values. */
export const DEFAULT_CONFIG: MobileTableConfig = {
  breakpoint: 768,
  scrollDirection: 'horizontal',
  stickyFirstColumn: false,
  collapsible: false,
};

/**
 * Minimum column width (px) used to estimate how many columns can fit
 * before collapsing is recommended.
 */
const MIN_COLUMN_WIDTH_PX = 100;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Merge a partial config with defaults.
 * Exported for testing convenience.
 */
export function mergeConfig(partial?: Partial<MobileTableConfig>): MobileTableConfig {
  return { ...DEFAULT_CONFIG, ...partial };
}

/**
 * Build a CSS class string for the table wrapper based on the resolved config
 * and the current container width.
 *
 * The classes use Tailwind utility names and can be fed directly into `cn()`.
 */
export function getResponsiveTableClasses(config?: Partial<MobileTableConfig>): string {
  const resolved = mergeConfig(config);
  const classes: string[] = ['relative', 'w-full'];

  if (resolved.scrollDirection === 'horizontal') {
    classes.push('overflow-x-auto', 'overflow-y-hidden');
  } else {
    classes.push('overflow-y-auto', 'overflow-x-hidden');
  }

  if (resolved.stickyFirstColumn) {
    classes.push('[&_th:first-child]:sticky', '[&_th:first-child]:left-0', '[&_th:first-child]:z-10');
    classes.push('[&_td:first-child]:sticky', '[&_td:first-child]:left-0', '[&_td:first-child]:z-10');
    classes.push('[&_th:first-child]:bg-inherit', '[&_td:first-child]:bg-inherit');
  }

  return classes.join(' ');
}

/**
 * Determine whether a table with the given column count should collapse
 * columns at the specified container width.
 *
 * Uses a simple heuristic: if the available width divided by column count
 * drops below `MIN_COLUMN_WIDTH_PX`, collapsing is recommended.
 *
 * @param width   Container or viewport width in pixels.
 * @param columnCount  Total number of columns the table wants to show.
 * @returns `true` if columns should be collapsed.
 */
export function shouldCollapseColumns(width: number, columnCount: number): boolean {
  if (columnCount <= 0) {
    return false;
  }
  if (width <= 0) {
    return true;
  }
  return width / columnCount < MIN_COLUMN_WIDTH_PX;
}

/**
 * Rank columns by their `priority` field and return them sorted from
 * highest priority (lowest number) to lowest priority.
 *
 * Columns without a `priority` value are placed at the end, preserving
 * their original relative order (stable sort).
 */
export function getMobileColumnPriority(columns: ColumnDescriptor[]): ColumnDescriptor[] {
  if (columns.length === 0) {
    return [];
  }

  // Stable sort: columns with a defined priority come first (ascending),
  // then columns without a priority in their original order.
  const indexed = columns.map((col, i) => ({ col, idx: i }));
  indexed.sort((a, b) => {
    const aPri = a.col.priority;
    const bPri = b.col.priority;
    if (aPri !== undefined && bPri !== undefined) {
      return aPri - bPri;
    }
    if (aPri !== undefined) {
      return -1;
    }
    if (bPri !== undefined) {
      return 1;
    }
    // Both undefined — keep original order.
    return a.idx - b.idx;
  });

  return indexed.map((entry) => entry.col);
}

/**
 * Given a sorted (prioritized) column list, a container width, and the
 * breakpoint, determine the subset of columns that should remain visible.
 *
 * If the container is wider than the breakpoint, all columns are returned.
 * Otherwise the list is trimmed so that each visible column gets at least
 * `MIN_COLUMN_WIDTH_PX` of horizontal space, with a minimum of 1 column.
 */
export function getVisibleColumns(
  columns: ColumnDescriptor[],
  containerWidth: number,
  breakpoint: number,
): ColumnDescriptor[] {
  if (columns.length === 0) {
    return [];
  }
  if (containerWidth >= breakpoint) {
    return columns;
  }
  const maxVisible = Math.max(1, Math.floor(containerWidth / MIN_COLUMN_WIDTH_PX));
  return columns.slice(0, Math.min(maxVisible, columns.length));
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * React hook that observes a container element's width via `ResizeObserver`
 * and returns responsive table state: CSS classes, visible columns, and
 * whether the table is in collapsed mode.
 *
 * @param containerRef  Ref to the wrapper `<div>` around the table.
 * @param columns       Full set of column descriptors.
 * @param config        Optional override of default `MobileTableConfig` values.
 */
export function useMobileTable(
  containerRef: RefObject<HTMLDivElement | null>,
  columns: ColumnDescriptor[],
  config?: Partial<MobileTableConfig>,
): MobileTableState {
  const resolved = mergeConfig(config);
  const [containerWidth, setContainerWidth] = useState(0);

  // Keep a ref to the latest resolved config to avoid re-subscribing the
  // ResizeObserver every time `config` object identity changes.
  const resolvedRef = useRef(resolved);
  resolvedRef.current = resolved;

  // ResizeObserver subscription.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        setContainerWidth(width);
      }
    });

    observer.observe(element);

    // Seed the initial width synchronously when available.
    const rect = element.getBoundingClientRect();
    if (rect.width > 0) {
      setContainerWidth(rect.width);
    }

    return () => {
      observer.disconnect();
    };
  }, [containerRef]);

  // Derived state — recalculated on every render when width or columns change.
  const prioritized = getMobileColumnPriority(columns);
  const collapsed =
    resolved.collapsible && shouldCollapseColumns(containerWidth, columns.length);
  const visibleColumns = collapsed
    ? getVisibleColumns(prioritized, containerWidth, resolved.breakpoint)
    : prioritized;
  const classes = getResponsiveTableClasses(config);

  return { classes, visibleColumns, collapsed, containerWidth };
}
