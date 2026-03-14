import { describe, it, expect } from 'vitest';
import {
  formatAuditDiff,
  filterAuditEntries,
  exportAuditCSV,
  entityTypeLabel,
  actionLabel,
  formatDiffValue,
} from '../audit-trail';
import type { AuditEntry, AuditFilters } from '../audit-trail';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: 'entry-1',
    timestamp: '2026-03-10T12:00:00Z',
    userId: 'user-1',
    userName: 'Tyler',
    action: 'update',
    entityType: 'bom_item',
    entityId: 'bom-42',
    entityLabel: 'ATmega328P',
    before: { quantity: 5, unitPrice: 2.5 },
    after: { quantity: 10, unitPrice: 2.5 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// formatAuditDiff
// ---------------------------------------------------------------------------

describe('formatAuditDiff', () => {
  it('returns empty array when both before and after are undefined', () => {
    expect(formatAuditDiff(undefined, undefined)).toEqual([]);
  });

  it('detects added fields (before undefined)', () => {
    const diffs = formatAuditDiff(undefined, { name: 'R1', value: 100 });
    expect(diffs).toHaveLength(2);
    expect(diffs.every((d) => d.type === 'added')).toBe(true);
    const nameField = diffs.find((d) => d.field === 'name');
    expect(nameField?.newValue).toBe('R1');
  });

  it('detects removed fields (after undefined)', () => {
    const diffs = formatAuditDiff({ name: 'R1', value: 100 }, undefined);
    expect(diffs).toHaveLength(2);
    expect(diffs.every((d) => d.type === 'removed')).toBe(true);
    const valueField = diffs.find((d) => d.field === 'value');
    expect(valueField?.oldValue).toBe(100);
  });

  it('detects changed fields', () => {
    const diffs = formatAuditDiff({ qty: 5, price: 2.5 }, { qty: 10, price: 2.5 });
    expect(diffs).toHaveLength(1);
    expect(diffs[0].field).toBe('qty');
    expect(diffs[0].type).toBe('changed');
    expect(diffs[0].oldValue).toBe(5);
    expect(diffs[0].newValue).toBe(10);
  });

  it('handles mixed added, removed, and changed fields', () => {
    const diffs = formatAuditDiff(
      { a: 1, b: 2, c: 3 },
      { a: 1, b: 99, d: 4 },
    );
    // a unchanged, b changed, c removed, d added
    expect(diffs).toHaveLength(3);
    expect(diffs.find((d) => d.field === 'b')?.type).toBe('changed');
    expect(diffs.find((d) => d.field === 'c')?.type).toBe('removed');
    expect(diffs.find((d) => d.field === 'd')?.type).toBe('added');
  });

  it('ignores fields that are equal', () => {
    const diffs = formatAuditDiff({ x: 1, y: 2 }, { x: 1, y: 2 });
    expect(diffs).toHaveLength(0);
  });

  it('handles deep equality for nested objects', () => {
    const diffs = formatAuditDiff(
      { data: { nested: true } },
      { data: { nested: true } },
    );
    expect(diffs).toHaveLength(0);
  });

  it('detects changes in nested objects', () => {
    const diffs = formatAuditDiff(
      { data: { nested: true } },
      { data: { nested: false } },
    );
    expect(diffs).toHaveLength(1);
    expect(diffs[0].type).toBe('changed');
  });

  it('handles array comparison (equal)', () => {
    const diffs = formatAuditDiff({ tags: [1, 2, 3] }, { tags: [1, 2, 3] });
    expect(diffs).toHaveLength(0);
  });

  it('handles array comparison (different)', () => {
    const diffs = formatAuditDiff({ tags: [1, 2] }, { tags: [1, 2, 3] });
    expect(diffs).toHaveLength(1);
    expect(diffs[0].type).toBe('changed');
  });

  it('sorts diff lines by field name', () => {
    const diffs = formatAuditDiff(undefined, { zebra: 1, alpha: 2, mid: 3 });
    expect(diffs.map((d) => d.field)).toEqual(['alpha', 'mid', 'zebra']);
  });

  it('handles null values correctly', () => {
    const diffs = formatAuditDiff({ a: null }, { a: 'value' });
    expect(diffs).toHaveLength(1);
    expect(diffs[0].type).toBe('changed');
    expect(diffs[0].oldValue).toBeNull();
    expect(diffs[0].newValue).toBe('value');
  });

  it('treats empty before as all-added', () => {
    const diffs = formatAuditDiff({}, { x: 1 });
    expect(diffs).toHaveLength(1);
    expect(diffs[0].type).toBe('added');
  });
});

// ---------------------------------------------------------------------------
// filterAuditEntries
// ---------------------------------------------------------------------------

describe('filterAuditEntries', () => {
  const entries: AuditEntry[] = [
    makeEntry({ id: 'e1', timestamp: '2026-03-10T10:00:00Z', action: 'create', entityType: 'project', userName: 'Alice' }),
    makeEntry({ id: 'e2', timestamp: '2026-03-10T12:00:00Z', action: 'update', entityType: 'bom_item', userName: 'Tyler' }),
    makeEntry({ id: 'e3', timestamp: '2026-03-11T08:00:00Z', action: 'delete', entityType: 'architecture_node', userName: 'Bob', userId: 'user-2' }),
    makeEntry({ id: 'e4', timestamp: '2026-03-12T09:00:00Z', action: 'export', entityType: 'circuit_design', userName: 'Tyler', entityLabel: 'Motor Driver' }),
  ];

  it('returns all entries with empty filters', () => {
    expect(filterAuditEntries(entries, {})).toHaveLength(4);
  });

  it('filters by date range', () => {
    const filters: AuditFilters = {
      dateRange: { start: '2026-03-10T11:00:00Z', end: '2026-03-11T10:00:00Z' },
    };
    const result = filterAuditEntries(entries, filters);
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toEqual(['e2', 'e3']);
  });

  it('filters by userId', () => {
    const result = filterAuditEntries(entries, { userId: 'user-2' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e3');
  });

  it('filters by entityType', () => {
    const result = filterAuditEntries(entries, { entityType: 'bom_item' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e2');
  });

  it('filters by action', () => {
    const result = filterAuditEntries(entries, { action: 'delete' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e3');
  });

  it('filters by search text (case-insensitive)', () => {
    const result = filterAuditEntries(entries, { search: 'motor driver' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e4');
  });

  it('search matches userName', () => {
    const result = filterAuditEntries(entries, { search: 'alice' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e1');
  });

  it('combines multiple filters (AND logic)', () => {
    const result = filterAuditEntries(entries, { action: 'update', entityType: 'bom_item' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e2');
  });

  it('returns empty when no entries match', () => {
    const result = filterAuditEntries(entries, { action: 'import' });
    expect(result).toHaveLength(0);
  });

  it('handles entries with invalid timestamps gracefully', () => {
    const badEntries = [makeEntry({ timestamp: 'not-a-date' })];
    const result = filterAuditEntries(badEntries, {
      dateRange: { start: '2026-01-01T00:00:00Z', end: '2026-12-31T23:59:59Z' },
    });
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// exportAuditCSV
// ---------------------------------------------------------------------------

describe('exportAuditCSV', () => {
  it('produces a header row plus data rows', () => {
    const entries = [makeEntry()];
    const csv = exportAuditCSV(entries);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('Timestamp');
    expect(lines[0]).toContain('User');
    expect(lines[0]).toContain('Entity Type');
  });

  it('escapes values containing commas', () => {
    const entries = [makeEntry({ entityLabel: 'Part A, Part B' })];
    const csv = exportAuditCSV(entries);
    expect(csv).toContain('"Part A, Part B"');
  });

  it('escapes values containing double quotes', () => {
    const entries = [makeEntry({ entityId: 'id-with-"quotes"' })];
    const csv = exportAuditCSV(entries);
    expect(csv).toContain('"id-with-""quotes"""');
  });

  it('lists changed fields in the Fields Changed column', () => {
    const entries = [makeEntry({ before: { a: 1 }, after: { a: 2, b: 3 } })];
    const csv = exportAuditCSV(entries);
    expect(csv).toContain('a; b');
  });

  it('handles entries with no before/after', () => {
    const entries = [makeEntry({ before: undefined, after: undefined })];
    const csv = exportAuditCSV(entries);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// entityTypeLabel
// ---------------------------------------------------------------------------

describe('entityTypeLabel', () => {
  it('returns human-readable label for each entity type', () => {
    expect(entityTypeLabel('bom_item')).toBe('BOM Item');
    expect(entityTypeLabel('architecture_node')).toBe('Architecture Node');
    expect(entityTypeLabel('circuit_design')).toBe('Circuit Design');
    expect(entityTypeLabel('project')).toBe('Project');
  });
});

// ---------------------------------------------------------------------------
// actionLabel
// ---------------------------------------------------------------------------

describe('actionLabel', () => {
  it('returns past tense for each action', () => {
    expect(actionLabel('create')).toBe('Created');
    expect(actionLabel('update')).toBe('Updated');
    expect(actionLabel('delete')).toBe('Deleted');
    expect(actionLabel('restore')).toBe('Restored');
    expect(actionLabel('export')).toBe('Exported');
    expect(actionLabel('import')).toBe('Imported');
  });
});

// ---------------------------------------------------------------------------
// formatDiffValue
// ---------------------------------------------------------------------------

describe('formatDiffValue', () => {
  it('returns (empty) for null', () => {
    expect(formatDiffValue(null)).toBe('(empty)');
  });

  it('returns (empty) for undefined', () => {
    expect(formatDiffValue(undefined)).toBe('(empty)');
  });

  it('returns string values as-is when short', () => {
    expect(formatDiffValue('hello')).toBe('hello');
  });

  it('truncates long strings', () => {
    const long = 'a'.repeat(100);
    const result = formatDiffValue(long);
    expect(result.length).toBeLessThanOrEqual(80);
    expect(result).toContain('...');
  });

  it('converts numbers to string', () => {
    expect(formatDiffValue(42)).toBe('42');
  });

  it('converts booleans to string', () => {
    expect(formatDiffValue(true)).toBe('true');
  });

  it('serializes objects to JSON', () => {
    expect(formatDiffValue({ a: 1 })).toBe('{"a":1}');
  });

  it('truncates long JSON', () => {
    const obj: Record<string, number> = {};
    for (let i = 0; i < 50; i++) {
      obj[`key${i}`] = i;
    }
    const result = formatDiffValue(obj);
    expect(result.length).toBeLessThanOrEqual(80);
    expect(result).toContain('...');
  });
});
