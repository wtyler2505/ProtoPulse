import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  DEFAULT_CONFIG,
  mergeConfig,
  getResponsiveTableClasses,
  shouldCollapseColumns,
  getMobileColumnPriority,
  getVisibleColumns,
  useMobileTable,
} from '../mobile-table-overflow';
import type { MobileTableConfig, ColumnDescriptor } from '../mobile-table-overflow';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Shorthand to build a ColumnDescriptor. */
function col(key: string, label?: string, priority?: number): ColumnDescriptor {
  return { key, label: label ?? key, priority };
}

/**
 * Create a minimal mock element + ResizeObserver wiring for hook tests.
 * Returns the ref-compatible object and a function to simulate resize.
 */
function createMockContainer(initialWidth = 1024) {
  let resizeCallback: ResizeObserverCallback | null = null;

  const element = {
    getBoundingClientRect: vi.fn(() => ({ width: initialWidth, height: 600 }) as DOMRect),
  } as unknown as HTMLDivElement;

  // Mock ResizeObserver globally.
  const mockObserve = vi.fn();
  const mockDisconnect = vi.fn();

  class MockResizeObserver {
    constructor(cb: ResizeObserverCallback) {
      resizeCallback = cb;
    }
    observe = mockObserve;
    unobserve = vi.fn();
    disconnect = mockDisconnect;
  }

  vi.stubGlobal('ResizeObserver', MockResizeObserver);

  function simulateResize(width: number) {
    if (resizeCallback) {
      resizeCallback(
        [{ contentRect: { width, height: 600 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    }
  }

  return { element, simulateResize, mockObserve, mockDisconnect };
}

// ---------------------------------------------------------------------------
// Tests — DEFAULT_CONFIG
// ---------------------------------------------------------------------------

describe('DEFAULT_CONFIG', () => {
  it('has breakpoint 768', () => {
    expect(DEFAULT_CONFIG.breakpoint).toBe(768);
  });

  it('defaults to horizontal scroll', () => {
    expect(DEFAULT_CONFIG.scrollDirection).toBe('horizontal');
  });

  it('defaults stickyFirstColumn to false', () => {
    expect(DEFAULT_CONFIG.stickyFirstColumn).toBe(false);
  });

  it('defaults collapsible to false', () => {
    expect(DEFAULT_CONFIG.collapsible).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests — mergeConfig
// ---------------------------------------------------------------------------

describe('mergeConfig', () => {
  it('returns defaults when called with no argument', () => {
    const result = mergeConfig();
    expect(result).toEqual(DEFAULT_CONFIG);
  });

  it('returns defaults when called with undefined', () => {
    const result = mergeConfig(undefined);
    expect(result).toEqual(DEFAULT_CONFIG);
  });

  it('returns defaults when called with empty object', () => {
    const result = mergeConfig({});
    expect(result).toEqual(DEFAULT_CONFIG);
  });

  it('overrides breakpoint only', () => {
    const result = mergeConfig({ breakpoint: 480 });
    expect(result.breakpoint).toBe(480);
    expect(result.scrollDirection).toBe('horizontal');
    expect(result.stickyFirstColumn).toBe(false);
    expect(result.collapsible).toBe(false);
  });

  it('overrides scrollDirection to vertical', () => {
    const result = mergeConfig({ scrollDirection: 'vertical' });
    expect(result.scrollDirection).toBe('vertical');
  });

  it('overrides stickyFirstColumn to true', () => {
    const result = mergeConfig({ stickyFirstColumn: true });
    expect(result.stickyFirstColumn).toBe(true);
  });

  it('overrides collapsible to true', () => {
    const result = mergeConfig({ collapsible: true });
    expect(result.collapsible).toBe(true);
  });

  it('overrides multiple fields at once', () => {
    const result = mergeConfig({
      breakpoint: 1024,
      scrollDirection: 'vertical',
      stickyFirstColumn: true,
      collapsible: true,
    });
    expect(result).toEqual({
      breakpoint: 1024,
      scrollDirection: 'vertical',
      stickyFirstColumn: true,
      collapsible: true,
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — getResponsiveTableClasses
// ---------------------------------------------------------------------------

describe('getResponsiveTableClasses', () => {
  it('includes base classes (relative, w-full)', () => {
    const classes = getResponsiveTableClasses();
    expect(classes).toContain('relative');
    expect(classes).toContain('w-full');
  });

  it('includes horizontal overflow by default', () => {
    const classes = getResponsiveTableClasses();
    expect(classes).toContain('overflow-x-auto');
    expect(classes).toContain('overflow-y-hidden');
    expect(classes).not.toContain('overflow-y-auto');
  });

  it('includes vertical overflow when scrollDirection is vertical', () => {
    const classes = getResponsiveTableClasses({ scrollDirection: 'vertical' });
    expect(classes).toContain('overflow-y-auto');
    expect(classes).toContain('overflow-x-hidden');
    expect(classes).not.toContain('overflow-x-auto');
  });

  it('does not include sticky classes by default', () => {
    const classes = getResponsiveTableClasses();
    expect(classes).not.toContain('sticky');
  });

  it('includes sticky first-column classes when stickyFirstColumn is true', () => {
    const classes = getResponsiveTableClasses({ stickyFirstColumn: true });
    expect(classes).toContain('[&_th:first-child]:sticky');
    expect(classes).toContain('[&_td:first-child]:sticky');
    expect(classes).toContain('[&_th:first-child]:left-0');
    expect(classes).toContain('[&_td:first-child]:left-0');
    expect(classes).toContain('[&_th:first-child]:z-10');
    expect(classes).toContain('[&_td:first-child]:z-10');
    expect(classes).toContain('[&_th:first-child]:bg-inherit');
    expect(classes).toContain('[&_td:first-child]:bg-inherit');
  });

  it('combines horizontal scroll and sticky column', () => {
    const classes = getResponsiveTableClasses({
      scrollDirection: 'horizontal',
      stickyFirstColumn: true,
    });
    expect(classes).toContain('overflow-x-auto');
    expect(classes).toContain('[&_td:first-child]:sticky');
  });

  it('combines vertical scroll and sticky column', () => {
    const classes = getResponsiveTableClasses({
      scrollDirection: 'vertical',
      stickyFirstColumn: true,
    });
    expect(classes).toContain('overflow-y-auto');
    expect(classes).toContain('[&_td:first-child]:sticky');
  });
});

// ---------------------------------------------------------------------------
// Tests — shouldCollapseColumns
// ---------------------------------------------------------------------------

describe('shouldCollapseColumns', () => {
  it('returns false when columns fit comfortably', () => {
    // 800px / 4 columns = 200px each > 100px min
    expect(shouldCollapseColumns(800, 4)).toBe(false);
  });

  it('returns true when columns are too narrow', () => {
    // 300px / 5 columns = 60px each < 100px min
    expect(shouldCollapseColumns(300, 5)).toBe(true);
  });

  it('returns false on the exact boundary (100px each)', () => {
    // 500px / 5 columns = exactly 100px — not less than MIN_COLUMN_WIDTH_PX
    expect(shouldCollapseColumns(500, 5)).toBe(false);
  });

  it('returns true just below the boundary', () => {
    // 499px / 5 columns = 99.8px < 100px min
    expect(shouldCollapseColumns(499, 5)).toBe(true);
  });

  it('returns false for zero columns', () => {
    expect(shouldCollapseColumns(100, 0)).toBe(false);
  });

  it('returns false for negative column count', () => {
    expect(shouldCollapseColumns(100, -1)).toBe(false);
  });

  it('returns true for zero width with positive columns', () => {
    expect(shouldCollapseColumns(0, 5)).toBe(true);
  });

  it('returns true for negative width with positive columns', () => {
    expect(shouldCollapseColumns(-100, 5)).toBe(true);
  });

  it('returns false for single column at any positive width', () => {
    expect(shouldCollapseColumns(50, 1)).toBe(false);
  });

  it('handles large column counts', () => {
    // 1920px / 20 columns = 96px each < 100
    expect(shouldCollapseColumns(1920, 20)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests — getMobileColumnPriority
// ---------------------------------------------------------------------------

describe('getMobileColumnPriority', () => {
  it('returns empty array for empty input', () => {
    expect(getMobileColumnPriority([])).toEqual([]);
  });

  it('returns single column unchanged', () => {
    const columns = [col('name', 'Name', 1)];
    expect(getMobileColumnPriority(columns)).toEqual(columns);
  });

  it('sorts by priority ascending', () => {
    const columns = [col('c', 'C', 3), col('a', 'A', 1), col('b', 'B', 2)];
    const result = getMobileColumnPriority(columns);
    expect(result.map((c) => c.key)).toEqual(['a', 'b', 'c']);
  });

  it('places columns without priority after prioritized ones', () => {
    const columns = [col('x', 'X'), col('a', 'A', 1), col('y', 'Y')];
    const result = getMobileColumnPriority(columns);
    expect(result.map((c) => c.key)).toEqual(['a', 'x', 'y']);
  });

  it('preserves original order for columns with equal priority', () => {
    const columns = [col('b', 'B', 1), col('a', 'A', 1), col('c', 'C', 1)];
    const result = getMobileColumnPriority(columns);
    // All have same priority — original order preserved (stable sort).
    expect(result.map((c) => c.key)).toEqual(['b', 'a', 'c']);
  });

  it('preserves original order for columns without priority', () => {
    const columns = [col('z', 'Z'), col('a', 'A'), col('m', 'M')];
    const result = getMobileColumnPriority(columns);
    expect(result.map((c) => c.key)).toEqual(['z', 'a', 'm']);
  });

  it('handles mixed priority and no-priority columns', () => {
    const columns = [
      col('status', 'Status'),
      col('name', 'Name', 1),
      col('price', 'Price', 2),
      col('notes', 'Notes'),
      col('id', 'ID', 0),
    ];
    const result = getMobileColumnPriority(columns);
    expect(result.map((c) => c.key)).toEqual(['id', 'name', 'price', 'status', 'notes']);
  });

  it('does not mutate the input array', () => {
    const columns = [col('b', 'B', 2), col('a', 'A', 1)];
    const copy = [...columns];
    getMobileColumnPriority(columns);
    expect(columns).toEqual(copy);
  });
});

// ---------------------------------------------------------------------------
// Tests — getVisibleColumns
// ---------------------------------------------------------------------------

describe('getVisibleColumns', () => {
  const columns = [
    col('name', 'Name', 0),
    col('value', 'Value', 1),
    col('package', 'Package', 2),
    col('stock', 'Stock', 3),
    col('notes', 'Notes', 4),
  ];

  it('returns all columns when container is wider than breakpoint', () => {
    const result = getVisibleColumns(columns, 1024, 768);
    expect(result).toEqual(columns);
  });

  it('returns all columns when container equals breakpoint', () => {
    const result = getVisibleColumns(columns, 768, 768);
    expect(result).toEqual(columns);
  });

  it('trims columns when container is narrower than breakpoint', () => {
    // 350px => max 3 columns (350 / 100 = 3.5 => floor = 3)
    const result = getVisibleColumns(columns, 350, 768);
    expect(result.length).toBe(3);
    expect(result.map((c) => c.key)).toEqual(['name', 'value', 'package']);
  });

  it('returns at least 1 column even for tiny widths', () => {
    const result = getVisibleColumns(columns, 10, 768);
    expect(result.length).toBe(1);
    expect(result[0].key).toBe('name');
  });

  it('returns empty for empty column list', () => {
    expect(getVisibleColumns([], 300, 768)).toEqual([]);
  });

  it('returns all columns when fewer columns than max visible slots', () => {
    // 500px => max 5 columns, but we only have 2
    const small = [col('a', 'A'), col('b', 'B')];
    const result = getVisibleColumns(small, 500, 768);
    expect(result.length).toBe(2);
  });

  it('handles zero-width container', () => {
    // max(1, floor(0/100)) = max(1, 0) = 1
    const result = getVisibleColumns(columns, 0, 768);
    expect(result.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Tests — useMobileTable hook
// ---------------------------------------------------------------------------

describe('useMobileTable', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns classes and all columns when container is wide', () => {
    const { element } = createMockContainer(1024);
    const ref = { current: element };

    const columns = [col('name', 'Name', 0), col('value', 'Value', 1)];
    const { result } = renderHook(() => useMobileTable(ref, columns));

    expect(result.current.classes).toContain('overflow-x-auto');
    expect(result.current.visibleColumns.length).toBe(2);
    expect(result.current.collapsed).toBe(false);
  });

  it('collapses columns when collapsible is true and container is narrow', () => {
    const { element, simulateResize } = createMockContainer(300);
    const ref = { current: element };

    const columns = [
      col('name', 'Name', 0),
      col('value', 'Value', 1),
      col('package', 'Package', 2),
      col('stock', 'Stock', 3),
      col('notes', 'Notes', 4),
    ];

    const { result } = renderHook(() =>
      useMobileTable(ref, columns, { collapsible: true }),
    );

    // Simulate a narrow resize.
    act(() => {
      simulateResize(300);
    });

    expect(result.current.collapsed).toBe(true);
    // 300 / 100 = 3 visible
    expect(result.current.visibleColumns.length).toBe(3);
    expect(result.current.visibleColumns.map((c) => c.key)).toEqual([
      'name',
      'value',
      'package',
    ]);
  });

  it('does not collapse columns when collapsible is false', () => {
    const { element, simulateResize } = createMockContainer(300);
    const ref = { current: element };

    const columns = [
      col('name', 'Name', 0),
      col('value', 'Value', 1),
      col('package', 'Package', 2),
      col('stock', 'Stock', 3),
    ];

    const { result } = renderHook(() =>
      useMobileTable(ref, columns, { collapsible: false }),
    );

    act(() => {
      simulateResize(300);
    });

    expect(result.current.collapsed).toBe(false);
    // All columns returned (prioritized) since collapsible is off.
    expect(result.current.visibleColumns.length).toBe(4);
  });

  it('updates containerWidth on resize', () => {
    const { element, simulateResize } = createMockContainer(800);
    const ref = { current: element };

    const columns = [col('a', 'A')];
    const { result } = renderHook(() => useMobileTable(ref, columns));

    act(() => {
      simulateResize(400);
    });

    expect(result.current.containerWidth).toBe(400);
  });

  it('reports containerWidth 0 when ref is null', () => {
    const ref = { current: null };
    const columns = [col('a', 'A')];
    const { result } = renderHook(() => useMobileTable(ref, columns));

    expect(result.current.containerWidth).toBe(0);
  });

  it('passes config through to classes', () => {
    const { element } = createMockContainer(1024);
    const ref = { current: element };

    const columns = [col('a', 'A')];
    const { result } = renderHook(() =>
      useMobileTable(ref, columns, { stickyFirstColumn: true }),
    );

    expect(result.current.classes).toContain('[&_td:first-child]:sticky');
  });

  it('prioritizes columns by priority field', () => {
    const { element } = createMockContainer(1024);
    const ref = { current: element };

    const columns = [col('z', 'Z', 5), col('a', 'A', 1), col('m', 'M', 3)];
    const { result } = renderHook(() => useMobileTable(ref, columns));

    expect(result.current.visibleColumns.map((c) => c.key)).toEqual(['a', 'm', 'z']);
  });

  it('disconnects ResizeObserver on unmount', () => {
    const { element, mockDisconnect } = createMockContainer(800);
    const ref = { current: element };

    const columns = [col('a', 'A')];
    const { unmount } = renderHook(() => useMobileTable(ref, columns));

    unmount();
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('uses vertical overflow classes when configured', () => {
    const { element } = createMockContainer(1024);
    const ref = { current: element };

    const columns = [col('a', 'A')];
    const { result } = renderHook(() =>
      useMobileTable(ref, columns, { scrollDirection: 'vertical' }),
    );

    expect(result.current.classes).toContain('overflow-y-auto');
    expect(result.current.classes).not.toContain('overflow-x-auto');
  });
});
