import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const migrationPath = resolve(import.meta.dirname, '../../migrations/0001_add_enum_constraints.sql');
const migrationSQL = readFileSync(migrationPath, 'utf-8');

describe('0001_add_enum_constraints migration', () => {
  it('contains valid ALTER TABLE ... ADD CONSTRAINT syntax for each constraint', () => {
    const expectedConstraints = [
      { table: 'chat_messages', name: 'chk_chat_role' },
      { table: 'validation_issues', name: 'chk_validation_severity' },
      { table: 'bom_items', name: 'chk_bom_status' },
    ];

    for (const { table, name } of expectedConstraints) {
      const pattern = new RegExp(
        `ALTER\\s+TABLE\\s+${table}\\s+ADD\\s+CONSTRAINT\\s+${name}\\s+CHECK\\s*\\(`,
        'i',
      );
      expect(migrationSQL).toMatch(pattern);
    }
  });

  it('constrains chat_messages.role to user, assistant, system', () => {
    const roleCheckPattern = /chk_chat_role\s+CHECK\s*\(\s*role\s+IN\s*\(\s*'user'\s*,\s*'assistant'\s*,\s*'system'\s*\)\s*\)/i;
    expect(migrationSQL).toMatch(roleCheckPattern);
  });

  it('constrains validation_issues.severity to error, warning, info', () => {
    const severityCheckPattern =
      /chk_validation_severity\s+CHECK\s*\(\s*severity\s+IN\s*\(\s*'error'\s*,\s*'warning'\s*,\s*'info'\s*\)\s*\)/i;
    expect(migrationSQL).toMatch(severityCheckPattern);
  });

  it('constrains bom_items.status to In Stock, Low Stock, Out of Stock, On Order', () => {
    const statusCheckPattern =
      /chk_bom_status\s+CHECK\s*\(\s*status\s+IN\s*\(\s*'In Stock'\s*,\s*'Low Stock'\s*,\s*'Out of Stock'\s*,\s*'On Order'\s*\)\s*\)/i;
    expect(migrationSQL).toMatch(statusCheckPattern);
  });

  it('does not modify the original 0000_green_prodigy migration', () => {
    const original0000Path = resolve(import.meta.dirname, '../../migrations/0000_green_prodigy.sql');
    const original0000 = readFileSync(original0000Path, 'utf-8');
    expect(original0000).not.toContain('chk_chat_role');
    expect(original0000).not.toContain('chk_validation_severity');
    expect(original0000).not.toContain('chk_bom_status');
  });

  it('has exactly 3 ALTER TABLE statements', () => {
    const alterTableCount = (migrationSQL.match(/ALTER\s+TABLE\b/gi) ?? []).length;
    expect(alterTableCount).toBe(3);
  });

  it('has matching constraint values with the Zod schemas in shared/schema.ts', () => {
    // These values must stay in sync with the z.enum() calls in shared/schema.ts
    const zodRoleValues = ['user', 'assistant', 'system'];
    const zodSeverityValues = ['error', 'warning', 'info'];
    const zodStatusValues = ['In Stock', 'Low Stock', 'Out of Stock', 'On Order'];

    for (const val of zodRoleValues) {
      expect(migrationSQL).toContain(`'${val}'`);
    }
    for (const val of zodSeverityValues) {
      expect(migrationSQL).toContain(`'${val}'`);
    }
    for (const val of zodStatusValues) {
      expect(migrationSQL).toContain(`'${val}'`);
    }
  });

  it('migration journal includes the new migration entry', () => {
    const journalPath = resolve(import.meta.dirname, '../../migrations/meta/_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf-8')) as {
      entries: Array<{ idx: number; tag: string }>;
    };

    const entry = journal.entries.find((e) => e.tag === '0001_add_enum_constraints');
    expect(entry).toBeDefined();
    expect(entry!.idx).toBe(1);
  });

  it('snapshot file exists and references the correct constraints', () => {
    const snapshotPath = resolve(import.meta.dirname, '../../migrations/meta/0001_snapshot.json');
    const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf-8')) as {
      id: string;
      prevId: string;
      tables: Record<string, { checkConstraints?: Record<string, { name: string; value: string }> }>;
    };

    expect(snapshot.id).toBeTruthy();
    expect(snapshot.prevId).toBeTruthy();

    const chatChecks = snapshot.tables['public.chat_messages']?.checkConstraints;
    expect(chatChecks).toBeDefined();
    expect(chatChecks!['chk_chat_role']).toBeDefined();

    const validationChecks = snapshot.tables['public.validation_issues']?.checkConstraints;
    expect(validationChecks).toBeDefined();
    expect(validationChecks!['chk_validation_severity']).toBeDefined();

    const bomChecks = snapshot.tables['public.bom_items']?.checkConstraints;
    expect(bomChecks).toBeDefined();
    expect(bomChecks!['chk_bom_status']).toBeDefined();
  });
});
