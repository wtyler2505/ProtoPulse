// ---------------------------------------------------------------------------
// Audit Log Explorer — types & utilities for filtering, grouping, summarising,
// and searching audit log entries.
// ---------------------------------------------------------------------------

import { useCallback, useMemo, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Severity levels for audit log entries. */
export type AuditLogSeverity = 'info' | 'warning' | 'critical';

/** A single audit log entry. */
export interface AuditLogEntry {
  readonly id: string;
  readonly timestamp: string;
  readonly userId?: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly details: Record<string, unknown>;
  readonly severity: AuditLogSeverity;
}

/** Filter criteria for narrowing audit log entries. */
export interface AuditLogFilter {
  dateRange?: { start: string; end: string };
  action?: string;
  entityType?: string;
  severity?: AuditLogSeverity;
  userId?: string;
}

/** Summary statistics for a collection of audit log entries. */
export interface AuditLogSummary {
  total: number;
  bySeverity: Record<AuditLogSeverity, number>;
  byAction: Record<string, number>;
  timeRange: { earliest: string; latest: string } | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_SEVERITIES: ReadonlySet<string> = new Set<string>(['info', 'warning', 'critical']);

function isValidSeverity(value: string): value is AuditLogSeverity {
  return VALID_SEVERITIES.has(value);
}

/**
 * Parse a timestamp string into epoch milliseconds.
 * Returns `NaN` for invalid values.
 */
function parseTimestamp(ts: string): number {
  return new Date(ts).getTime();
}

/**
 * Return a date-only key (`YYYY-MM-DD`) for a timestamp string.
 * Returns `'Invalid Date'` when the timestamp cannot be parsed.
 */
function dateKey(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) {
    return 'Invalid Date';
  }
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// filterAuditLogs
// ---------------------------------------------------------------------------

/**
 * Filter audit log entries by the given criteria and return them sorted by
 * timestamp descending (newest first). All filter fields are optional; only
 * those that are set are applied (AND logic).
 */
export function filterAuditLogs(entries: readonly AuditLogEntry[], filter: AuditLogFilter): AuditLogEntry[] {
  const result = entries.filter((entry) => {
    // Date range
    if (filter.dateRange) {
      const ts = parseTimestamp(entry.timestamp);
      const start = parseTimestamp(filter.dateRange.start);
      const end = parseTimestamp(filter.dateRange.end);
      if (Number.isNaN(ts) || ts < start || ts > end) {
        return false;
      }
    }

    // Action
    if (filter.action !== undefined && entry.action !== filter.action) {
      return false;
    }

    // Entity type
    if (filter.entityType !== undefined && entry.entityType !== filter.entityType) {
      return false;
    }

    // Severity
    if (filter.severity !== undefined) {
      if (!isValidSeverity(filter.severity) || entry.severity !== filter.severity) {
        return false;
      }
    }

    // User ID
    if (filter.userId !== undefined && entry.userId !== filter.userId) {
      return false;
    }

    return true;
  });

  // Sort newest-first (descending timestamp)
  result.sort((a, b) => {
    const ta = parseTimestamp(a.timestamp);
    const tb = parseTimestamp(b.timestamp);
    if (Number.isNaN(ta) && Number.isNaN(tb)) {
      return 0;
    }
    if (Number.isNaN(ta)) {
      return 1;
    }
    if (Number.isNaN(tb)) {
      return -1;
    }
    return tb - ta;
  });

  return result;
}

// ---------------------------------------------------------------------------
// groupByDate
// ---------------------------------------------------------------------------

/**
 * Group audit log entries by their date portion (`YYYY-MM-DD`).
 * Within each group, entries are sorted newest-first.
 */
export function groupByDate(entries: readonly AuditLogEntry[]): Record<string, AuditLogEntry[]> {
  const groups: Record<string, AuditLogEntry[]> = {};

  for (const entry of entries) {
    const key = dateKey(entry.timestamp);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(entry);
  }

  // Sort within each group
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => {
      const ta = parseTimestamp(a.timestamp);
      const tb = parseTimestamp(b.timestamp);
      if (Number.isNaN(ta) && Number.isNaN(tb)) {
        return 0;
      }
      if (Number.isNaN(ta)) {
        return 1;
      }
      if (Number.isNaN(tb)) {
        return -1;
      }
      return tb - ta;
    });
  }

  return groups;
}

// ---------------------------------------------------------------------------
// groupByAction
// ---------------------------------------------------------------------------

/**
 * Group audit log entries by their `action` field.
 * Within each group, entries are sorted newest-first.
 */
export function groupByAction(entries: readonly AuditLogEntry[]): Record<string, AuditLogEntry[]> {
  const groups: Record<string, AuditLogEntry[]> = {};

  for (const entry of entries) {
    const key = entry.action;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(entry);
  }

  // Sort within each group
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => {
      const ta = parseTimestamp(a.timestamp);
      const tb = parseTimestamp(b.timestamp);
      if (Number.isNaN(ta) && Number.isNaN(tb)) {
        return 0;
      }
      if (Number.isNaN(ta)) {
        return 1;
      }
      if (Number.isNaN(tb)) {
        return -1;
      }
      return tb - ta;
    });
  }

  return groups;
}

// ---------------------------------------------------------------------------
// getAuditSummary
// ---------------------------------------------------------------------------

/**
 * Compute summary statistics for a collection of audit log entries.
 */
export function getAuditSummary(entries: readonly AuditLogEntry[]): AuditLogSummary {
  const bySeverity: Record<AuditLogSeverity, number> = { info: 0, warning: 0, critical: 0 };
  const byAction: Record<string, number> = {};
  let earliest = Infinity;
  let latest = -Infinity;
  let hasValidTimestamp = false;

  for (const entry of entries) {
    // Severity counts
    bySeverity[entry.severity] = (bySeverity[entry.severity] ?? 0) + 1;

    // Action counts
    byAction[entry.action] = (byAction[entry.action] ?? 0) + 1;

    // Time range
    const ts = parseTimestamp(entry.timestamp);
    if (!Number.isNaN(ts)) {
      hasValidTimestamp = true;
      if (ts < earliest) {
        earliest = ts;
      }
      if (ts > latest) {
        latest = ts;
      }
    }
  }

  return {
    total: entries.length,
    bySeverity,
    byAction,
    timeRange: hasValidTimestamp
      ? { earliest: new Date(earliest).toISOString(), latest: new Date(latest).toISOString() }
      : null,
  };
}

// ---------------------------------------------------------------------------
// searchAuditLogs
// ---------------------------------------------------------------------------

/**
 * Full-text search across `action`, `entityType`, `entityId`, and stringified
 * `details`. Case-insensitive. Returns entries sorted newest-first.
 */
export function searchAuditLogs(entries: readonly AuditLogEntry[], query: string): AuditLogEntry[] {
  if (!query.trim()) {
    // Return a copy sorted newest-first for empty queries
    return [...entries].sort((a, b) => {
      const ta = parseTimestamp(a.timestamp);
      const tb = parseTimestamp(b.timestamp);
      if (Number.isNaN(ta) && Number.isNaN(tb)) {
        return 0;
      }
      if (Number.isNaN(ta)) {
        return 1;
      }
      if (Number.isNaN(tb)) {
        return -1;
      }
      return tb - ta;
    });
  }

  const needle = query.toLowerCase();

  const result = entries.filter((entry) => {
    const haystack = [
      entry.action,
      entry.entityType,
      entry.entityId,
      entry.userId ?? '',
      JSON.stringify(entry.details),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(needle);
  });

  result.sort((a, b) => {
    const ta = parseTimestamp(a.timestamp);
    const tb = parseTimestamp(b.timestamp);
    if (Number.isNaN(ta) && Number.isNaN(tb)) {
      return 0;
    }
    if (Number.isNaN(ta)) {
      return 1;
    }
    if (Number.isNaN(tb)) {
      return -1;
    }
    return tb - ta;
  });

  return result;
}

// ---------------------------------------------------------------------------
// React Hook — useAuditLogExplorer
// ---------------------------------------------------------------------------

/**
 * React hook for exploring audit log entries with filtering, grouping,
 * searching, and summary computation.
 */
export function useAuditLogExplorer(entries: readonly AuditLogEntry[]): {
  filter: AuditLogFilter;
  setFilter: (filter: AuditLogFilter) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filtered: AuditLogEntry[];
  searched: AuditLogEntry[];
  groupedByDate: Record<string, AuditLogEntry[]>;
  groupedByAction: Record<string, AuditLogEntry[]>;
  summary: AuditLogSummary;
} {
  const [filter, setFilter] = useState<AuditLogFilter>({});
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => filterAuditLogs(entries, filter), [entries, filter]);

  const searched = useMemo(
    () => (searchQuery.trim() ? searchAuditLogs(filtered, searchQuery) : filtered),
    [filtered, searchQuery],
  );

  const groupedByDate = useMemo(() => groupByDate(searched), [searched]);
  const groupedByAction = useMemo(() => groupByAction(searched), [searched]);
  const summary = useMemo(() => getAuditSummary(searched), [searched]);

  const stableSetFilter = useCallback((f: AuditLogFilter) => {
    setFilter(f);
  }, []);

  const stableSetSearchQuery = useCallback((q: string) => {
    setSearchQuery(q);
  }, []);

  return {
    filter,
    setFilter: stableSetFilter,
    searchQuery,
    setSearchQuery: stableSetSearchQuery,
    filtered,
    searched,
    groupedByDate,
    groupedByAction,
    summary,
  };
}
