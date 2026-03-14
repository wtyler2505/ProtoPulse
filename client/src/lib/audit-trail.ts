// ---------------------------------------------------------------------------
// Audit Trail — types and utilities for tracking project changes
// ---------------------------------------------------------------------------

/**
 * Supported entity types that can appear in an audit entry.
 */
export type AuditEntityType =
  | 'project'
  | 'architecture_node'
  | 'architecture_edge'
  | 'bom_item'
  | 'circuit_design'
  | 'circuit_instance'
  | 'circuit_net'
  | 'circuit_wire'
  | 'validation_issue'
  | 'component'
  | 'setting'
  | 'snapshot'
  | 'comment';

/**
 * Action verb for what happened to the entity.
 */
export type AuditAction = 'create' | 'update' | 'delete' | 'restore' | 'export' | 'import';

/**
 * A single audit trail entry representing one change event.
 */
export interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entityLabel?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * A single property-level diff line.
 */
export interface DiffLine {
  field: string;
  type: 'added' | 'removed' | 'changed';
  oldValue?: unknown;
  newValue?: unknown;
}

/**
 * Filters for narrowing the audit entry list.
 */
export interface AuditFilters {
  dateRange?: { start: string; end: string };
  userId?: string;
  entityType?: AuditEntityType;
  action?: AuditAction;
  search?: string;
}

// ---------------------------------------------------------------------------
// Diff utility
// ---------------------------------------------------------------------------

/**
 * Compute property-level diffs between a `before` and `after` snapshot.
 * Returns an array of {@link DiffLine} items sorted by field name.
 */
export function formatAuditDiff(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
): DiffLine[] {
  const lines: DiffLine[] = [];

  if (!before && !after) {
    return lines;
  }

  const beforeKeys = before ? Object.keys(before) : [];
  const afterKeys = after ? Object.keys(after) : [];
  const allKeys = Array.from(new Set([...beforeKeys, ...afterKeys]));

  for (const key of allKeys) {
    const inBefore = before !== undefined && key in before;
    const inAfter = after !== undefined && key in after;

    if (inBefore && !inAfter) {
      lines.push({ field: key, type: 'removed', oldValue: before![key] });
    } else if (!inBefore && inAfter) {
      lines.push({ field: key, type: 'added', newValue: after![key] });
    } else if (inBefore && inAfter) {
      const oldVal = before![key];
      const newVal = after![key];
      if (!deepEqual(oldVal, newVal)) {
        lines.push({ field: key, type: 'changed', oldValue: oldVal, newValue: newVal });
      }
    }
  }

  lines.sort((a, b) => a.field.localeCompare(b.field));
  return lines;
}

// ---------------------------------------------------------------------------
// Deep equality (simple JSON-value comparison)
// ---------------------------------------------------------------------------

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (a === null || b === null || typeof a !== typeof b) {
    return false;
  }
  if (typeof a !== 'object') {
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    return a.every((v, i) => deepEqual(v, (b as unknown[])[i]));
  }
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  return aKeys.every((k) => deepEqual(aObj[k], bObj[k]));
}

// ---------------------------------------------------------------------------
// Filter utility
// ---------------------------------------------------------------------------

/**
 * Filter audit entries by the given criteria. All filter fields are optional;
 * only those that are set are applied. Returns a new array.
 */
export function filterAuditEntries(entries: AuditEntry[], filters: AuditFilters): AuditEntry[] {
  return entries.filter((entry) => {
    // Date range
    if (filters.dateRange) {
      const ts = new Date(entry.timestamp).getTime();
      const start = new Date(filters.dateRange.start).getTime();
      const end = new Date(filters.dateRange.end).getTime();
      if (Number.isNaN(ts) || ts < start || ts > end) {
        return false;
      }
    }

    // User
    if (filters.userId && entry.userId !== filters.userId) {
      return false;
    }

    // Entity type
    if (filters.entityType && entry.entityType !== filters.entityType) {
      return false;
    }

    // Action
    if (filters.action && entry.action !== filters.action) {
      return false;
    }

    // Free-text search (case-insensitive)
    if (filters.search) {
      const needle = filters.search.toLowerCase();
      const haystack = [
        entry.userName,
        entry.entityType,
        entry.entityId,
        entry.entityLabel ?? '',
        entry.action,
        JSON.stringify(entry.metadata ?? {}),
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(needle)) {
        return false;
      }
    }

    return true;
  });
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

/**
 * Convert audit entries to a CSV string suitable for download.
 */
export function exportAuditCSV(entries: AuditEntry[]): string {
  const header = 'Timestamp,User,Action,Entity Type,Entity ID,Entity Label,Fields Changed';
  const rows = entries.map((e) => {
    const diffs = formatAuditDiff(e.before, e.after);
    const fieldsChanged = diffs.map((d) => d.field).join('; ');
    return [
      e.timestamp,
      csvEscape(e.userName),
      e.action,
      e.entityType,
      csvEscape(e.entityId),
      csvEscape(e.entityLabel ?? ''),
      csvEscape(fieldsChanged),
    ].join(',');
  });
  return [header, ...rows].join('\n');
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/**
 * Human-readable label for an entity type.
 */
export function entityTypeLabel(type: AuditEntityType): string {
  const labels: Record<AuditEntityType, string> = {
    project: 'Project',
    architecture_node: 'Architecture Node',
    architecture_edge: 'Architecture Edge',
    bom_item: 'BOM Item',
    circuit_design: 'Circuit Design',
    circuit_instance: 'Circuit Instance',
    circuit_net: 'Circuit Net',
    circuit_wire: 'Circuit Wire',
    validation_issue: 'Validation Issue',
    component: 'Component',
    setting: 'Setting',
    snapshot: 'Snapshot',
    comment: 'Comment',
  };
  return labels[type];
}

/**
 * Human-readable label for an action.
 */
export function actionLabel(action: AuditAction): string {
  const labels: Record<AuditAction, string> = {
    create: 'Created',
    update: 'Updated',
    delete: 'Deleted',
    restore: 'Restored',
    export: 'Exported',
    import: 'Imported',
  };
  return labels[action];
}

/**
 * Format an unknown value into a short string for diff display.
 */
export function formatDiffValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '(empty)';
  }
  if (typeof value === 'string') {
    return value.length > 80 ? `${value.slice(0, 77)}...` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  const json = JSON.stringify(value);
  return json.length > 80 ? `${json.slice(0, 77)}...` : json;
}
