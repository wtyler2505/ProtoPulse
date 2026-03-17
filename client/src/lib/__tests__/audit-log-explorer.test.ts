import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  filterAuditLogs,
  groupByDate,
  groupByAction,
  getAuditSummary,
  searchAuditLogs,
  useAuditLogExplorer,
} from '../audit-log-explorer';
import type { AuditLogEntry, AuditLogFilter, AuditLogSeverity } from '../audit-log-explorer';

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: 'entry-1',
    timestamp: '2026-03-10T12:00:00Z',
    userId: 'user-1',
    action: 'update',
    entityType: 'bom_item',
    entityId: 'bom-42',
    details: { field: 'quantity', from: 5, to: 10 },
    severity: 'info',
    ...overrides,
  };
}

const SAMPLE_ENTRIES: readonly AuditLogEntry[] = [
  makeEntry({
    id: 'e1',
    timestamp: '2026-03-10T08:00:00Z',
    action: 'create',
    entityType: 'project',
    entityId: 'proj-1',
    severity: 'info',
    details: { name: 'OmniTrek' },
  }),
  makeEntry({
    id: 'e2',
    timestamp: '2026-03-10T12:00:00Z',
    action: 'update',
    entityType: 'bom_item',
    entityId: 'bom-42',
    severity: 'warning',
    details: { field: 'quantity', from: 5, to: 10 },
  }),
  makeEntry({
    id: 'e3',
    timestamp: '2026-03-11T09:30:00Z',
    action: 'delete',
    entityType: 'architecture_node',
    entityId: 'node-7',
    severity: 'critical',
    userId: 'user-2',
    details: { reason: 'obsolete' },
  }),
  makeEntry({
    id: 'e4',
    timestamp: '2026-03-12T15:00:00Z',
    action: 'export',
    entityType: 'circuit_design',
    entityId: 'cd-99',
    severity: 'info',
    details: { format: 'KiCad' },
  }),
  makeEntry({
    id: 'e5',
    timestamp: '2026-03-12T16:00:00Z',
    action: 'update',
    entityType: 'bom_item',
    entityId: 'bom-43',
    severity: 'warning',
    details: { field: 'unitPrice', from: 1.5, to: 2.0 },
  }),
];

// ---------------------------------------------------------------------------
// filterAuditLogs
// ---------------------------------------------------------------------------

describe('filterAuditLogs', () => {
  it('returns all entries sorted newest-first with empty filter', () => {
    const result = filterAuditLogs(SAMPLE_ENTRIES, {});
    expect(result).toHaveLength(5);
    expect(result[0].id).toBe('e5');
    expect(result[4].id).toBe('e1');
  });

  it('filters by date range', () => {
    const filter: AuditLogFilter = {
      dateRange: { start: '2026-03-10T10:00:00Z', end: '2026-03-11T10:00:00Z' },
    };
    const result = filterAuditLogs(SAMPLE_ENTRIES, filter);
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toEqual(['e3', 'e2']);
  });

  it('filters by action', () => {
    const result = filterAuditLogs(SAMPLE_ENTRIES, { action: 'update' });
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.action === 'update')).toBe(true);
  });

  it('filters by entityType', () => {
    const result = filterAuditLogs(SAMPLE_ENTRIES, { entityType: 'bom_item' });
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.entityType === 'bom_item')).toBe(true);
  });

  it('filters by severity', () => {
    const result = filterAuditLogs(SAMPLE_ENTRIES, { severity: 'critical' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e3');
  });

  it('filters by userId', () => {
    const result = filterAuditLogs(SAMPLE_ENTRIES, { userId: 'user-2' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e3');
  });

  it('combines multiple filters with AND logic', () => {
    const result = filterAuditLogs(SAMPLE_ENTRIES, {
      action: 'update',
      entityType: 'bom_item',
      severity: 'warning',
    });
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.action === 'update' && e.severity === 'warning')).toBe(true);
  });

  it('returns empty array when no entries match', () => {
    const result = filterAuditLogs(SAMPLE_ENTRIES, { action: 'import' });
    expect(result).toHaveLength(0);
  });

  it('excludes entries with invalid timestamps when date range is set', () => {
    const entries = [makeEntry({ id: 'bad', timestamp: 'not-a-date' })];
    const result = filterAuditLogs(entries, {
      dateRange: { start: '2026-01-01T00:00:00Z', end: '2026-12-31T23:59:59Z' },
    });
    expect(result).toHaveLength(0);
  });

  it('handles entries with undefined userId when filtering by userId', () => {
    const entries = [makeEntry({ id: 'no-user', userId: undefined })];
    const result = filterAuditLogs(entries, { userId: 'user-1' });
    expect(result).toHaveLength(0);
  });

  it('sorts invalid timestamps after valid ones', () => {
    const entries = [
      makeEntry({ id: 'valid', timestamp: '2026-03-10T12:00:00Z' }),
      makeEntry({ id: 'invalid', timestamp: 'bad-date' }),
    ];
    const result = filterAuditLogs(entries, {});
    expect(result[0].id).toBe('valid');
    expect(result[1].id).toBe('invalid');
  });
});

// ---------------------------------------------------------------------------
// groupByDate
// ---------------------------------------------------------------------------

describe('groupByDate', () => {
  it('groups entries by date portion', () => {
    const groups = groupByDate(SAMPLE_ENTRIES);
    expect(Object.keys(groups).sort()).toEqual(['2026-03-10', '2026-03-11', '2026-03-12']);
    expect(groups['2026-03-10']).toHaveLength(2);
    expect(groups['2026-03-11']).toHaveLength(1);
    expect(groups['2026-03-12']).toHaveLength(2);
  });

  it('sorts entries within each group newest-first', () => {
    const groups = groupByDate(SAMPLE_ENTRIES);
    const march12 = groups['2026-03-12'];
    expect(march12[0].id).toBe('e5');
    expect(march12[1].id).toBe('e4');
  });

  it('returns empty object for empty input', () => {
    const groups = groupByDate([]);
    expect(Object.keys(groups)).toHaveLength(0);
  });

  it('handles entries with invalid timestamps', () => {
    const entries = [makeEntry({ id: 'bad', timestamp: 'not-a-date' })];
    const groups = groupByDate(entries);
    expect(groups['Invalid Date']).toHaveLength(1);
  });

  it('groups all same-date entries together', () => {
    const entries = [
      makeEntry({ id: 'a', timestamp: '2026-03-10T01:00:00Z' }),
      makeEntry({ id: 'b', timestamp: '2026-03-10T23:59:59Z' }),
      makeEntry({ id: 'c', timestamp: '2026-03-10T12:00:00Z' }),
    ];
    const groups = groupByDate(entries);
    expect(Object.keys(groups)).toEqual(['2026-03-10']);
    expect(groups['2026-03-10']).toHaveLength(3);
    // Newest first
    expect(groups['2026-03-10'][0].id).toBe('b');
  });
});

// ---------------------------------------------------------------------------
// groupByAction
// ---------------------------------------------------------------------------

describe('groupByAction', () => {
  it('groups entries by action', () => {
    const groups = groupByAction(SAMPLE_ENTRIES);
    expect(Object.keys(groups).sort()).toEqual(['create', 'delete', 'export', 'update']);
    expect(groups['update']).toHaveLength(2);
    expect(groups['create']).toHaveLength(1);
  });

  it('sorts entries within each group newest-first', () => {
    const groups = groupByAction(SAMPLE_ENTRIES);
    const updates = groups['update'];
    expect(updates[0].id).toBe('e5');
    expect(updates[1].id).toBe('e2');
  });

  it('returns empty object for empty input', () => {
    const groups = groupByAction([]);
    expect(Object.keys(groups)).toHaveLength(0);
  });

  it('handles single-entry groups', () => {
    const entries = [
      makeEntry({ id: 'a', action: 'create' }),
      makeEntry({ id: 'b', action: 'delete' }),
      makeEntry({ id: 'c', action: 'export' }),
    ];
    const groups = groupByAction(entries);
    expect(groups['create']).toHaveLength(1);
    expect(groups['delete']).toHaveLength(1);
    expect(groups['export']).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// getAuditSummary
// ---------------------------------------------------------------------------

describe('getAuditSummary', () => {
  it('computes total count', () => {
    const summary = getAuditSummary(SAMPLE_ENTRIES);
    expect(summary.total).toBe(5);
  });

  it('counts by severity', () => {
    const summary = getAuditSummary(SAMPLE_ENTRIES);
    expect(summary.bySeverity.info).toBe(2);
    expect(summary.bySeverity.warning).toBe(2);
    expect(summary.bySeverity.critical).toBe(1);
  });

  it('counts by action', () => {
    const summary = getAuditSummary(SAMPLE_ENTRIES);
    expect(summary.byAction['update']).toBe(2);
    expect(summary.byAction['create']).toBe(1);
    expect(summary.byAction['delete']).toBe(1);
    expect(summary.byAction['export']).toBe(1);
  });

  it('computes time range from valid timestamps', () => {
    const summary = getAuditSummary(SAMPLE_ENTRIES);
    expect(summary.timeRange).not.toBeNull();
    expect(summary.timeRange!.earliest).toBe('2026-03-10T08:00:00.000Z');
    expect(summary.timeRange!.latest).toBe('2026-03-12T16:00:00.000Z');
  });

  it('returns null timeRange for empty entries', () => {
    const summary = getAuditSummary([]);
    expect(summary.total).toBe(0);
    expect(summary.timeRange).toBeNull();
  });

  it('returns null timeRange when all timestamps are invalid', () => {
    const entries = [
      makeEntry({ timestamp: 'bad1' }),
      makeEntry({ timestamp: 'bad2' }),
    ];
    const summary = getAuditSummary(entries);
    expect(summary.timeRange).toBeNull();
  });

  it('initialises all severity counters to zero even when absent', () => {
    const entries = [makeEntry({ severity: 'info' })];
    const summary = getAuditSummary(entries);
    expect(summary.bySeverity.warning).toBe(0);
    expect(summary.bySeverity.critical).toBe(0);
  });

  it('handles single entry', () => {
    const entries = [makeEntry({ timestamp: '2026-06-01T00:00:00Z' })];
    const summary = getAuditSummary(entries);
    expect(summary.total).toBe(1);
    expect(summary.timeRange!.earliest).toBe(summary.timeRange!.latest);
  });
});

// ---------------------------------------------------------------------------
// searchAuditLogs
// ---------------------------------------------------------------------------

describe('searchAuditLogs', () => {
  it('returns all entries (sorted) for empty query', () => {
    const result = searchAuditLogs(SAMPLE_ENTRIES, '');
    expect(result).toHaveLength(5);
    expect(result[0].id).toBe('e5');
  });

  it('returns all entries for whitespace-only query', () => {
    const result = searchAuditLogs(SAMPLE_ENTRIES, '   ');
    expect(result).toHaveLength(5);
  });

  it('searches across action field', () => {
    const result = searchAuditLogs(SAMPLE_ENTRIES, 'export');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e4');
  });

  it('searches across entityType field', () => {
    const result = searchAuditLogs(SAMPLE_ENTRIES, 'architecture_node');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e3');
  });

  it('searches across entityId field', () => {
    const result = searchAuditLogs(SAMPLE_ENTRIES, 'cd-99');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e4');
  });

  it('searches across stringified details', () => {
    const result = searchAuditLogs(SAMPLE_ENTRIES, 'KiCad');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e4');
  });

  it('searches across userId', () => {
    const result = searchAuditLogs(SAMPLE_ENTRIES, 'user-2');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e3');
  });

  it('is case-insensitive', () => {
    const result = searchAuditLogs(SAMPLE_ENTRIES, 'KICAD');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e4');
  });

  it('returns empty array when no match', () => {
    const result = searchAuditLogs(SAMPLE_ENTRIES, 'nonexistent-term');
    expect(result).toHaveLength(0);
  });

  it('results are sorted newest-first', () => {
    const result = searchAuditLogs(SAMPLE_ENTRIES, 'bom_item');
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('e5');
    expect(result[1].id).toBe('e2');
  });
});

// ---------------------------------------------------------------------------
// useAuditLogExplorer hook
// ---------------------------------------------------------------------------

describe('useAuditLogExplorer', () => {
  it('returns all entries as filtered when no filter is set', () => {
    const { result } = renderHook(() => useAuditLogExplorer(SAMPLE_ENTRIES));
    expect(result.current.filtered).toHaveLength(5);
    expect(result.current.searched).toHaveLength(5);
  });

  it('computes summary from searched entries', () => {
    const { result } = renderHook(() => useAuditLogExplorer(SAMPLE_ENTRIES));
    expect(result.current.summary.total).toBe(5);
    expect(result.current.summary.bySeverity.info).toBe(2);
  });

  it('applies filter when setFilter is called', () => {
    const { result } = renderHook(() => useAuditLogExplorer(SAMPLE_ENTRIES));
    act(() => {
      result.current.setFilter({ severity: 'critical' });
    });
    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].id).toBe('e3');
  });

  it('applies search on top of filter', () => {
    const { result } = renderHook(() => useAuditLogExplorer(SAMPLE_ENTRIES));
    act(() => {
      result.current.setFilter({ action: 'update' });
    });
    expect(result.current.filtered).toHaveLength(2);

    act(() => {
      result.current.setSearchQuery('unitPrice');
    });
    expect(result.current.searched).toHaveLength(1);
    expect(result.current.searched[0].id).toBe('e5');
  });

  it('groups by date correctly', () => {
    const { result } = renderHook(() => useAuditLogExplorer(SAMPLE_ENTRIES));
    const dateGroups = result.current.groupedByDate;
    expect(Object.keys(dateGroups)).toContain('2026-03-10');
    expect(Object.keys(dateGroups)).toContain('2026-03-12');
  });

  it('groups by action correctly', () => {
    const { result } = renderHook(() => useAuditLogExplorer(SAMPLE_ENTRIES));
    const actionGroups = result.current.groupedByAction;
    expect(actionGroups['update']).toHaveLength(2);
    expect(actionGroups['create']).toHaveLength(1);
  });

  it('updates summary when filter changes', () => {
    const { result } = renderHook(() => useAuditLogExplorer(SAMPLE_ENTRIES));
    act(() => {
      result.current.setFilter({ severity: 'warning' });
    });
    expect(result.current.summary.total).toBe(2);
    expect(result.current.summary.bySeverity.warning).toBe(2);
    expect(result.current.summary.bySeverity.info).toBe(0);
  });

  it('initialises filter and searchQuery to empty', () => {
    const { result } = renderHook(() => useAuditLogExplorer(SAMPLE_ENTRIES));
    expect(result.current.filter).toEqual({});
    expect(result.current.searchQuery).toBe('');
  });
});
