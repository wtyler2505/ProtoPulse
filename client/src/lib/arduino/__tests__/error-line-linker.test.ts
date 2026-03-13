import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ErrorLineLinkManager } from '../error-line-linker';
import type { ErrorLineLink, GutterMark } from '../error-line-linker';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLink(overrides: Partial<ErrorLineLink> = {}): ErrorLineLink {
  return {
    file: 'sketch.ino',
    line: 1,
    column: 1,
    severity: 'error',
    message: 'test error',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ErrorLineLinkManager', () => {
  let manager: ErrorLineLinkManager;

  beforeEach(() => {
    manager = ErrorLineLinkManager.createInstance();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance on repeated calls', () => {
      ErrorLineLinkManager.resetInstance();
      const a = ErrorLineLinkManager.getInstance();
      const b = ErrorLineLinkManager.getInstance();
      expect(a).toBe(b);
      ErrorLineLinkManager.resetInstance();
    });

    it('resetInstance clears and creates a fresh singleton', () => {
      ErrorLineLinkManager.resetInstance();
      const first = ErrorLineLinkManager.getInstance();
      first.setDiagnostics([makeLink()]);
      ErrorLineLinkManager.resetInstance();
      const second = ErrorLineLinkManager.getInstance();
      expect(second).not.toBe(first);
      expect(second.getAllDiagnostics()).toHaveLength(0);
      ErrorLineLinkManager.resetInstance();
    });

    it('createInstance returns a non-singleton instance', () => {
      const instance = ErrorLineLinkManager.createInstance();
      const singleton = ErrorLineLinkManager.getInstance();
      expect(instance).not.toBe(singleton);
      ErrorLineLinkManager.resetInstance();
    });
  });

  // -----------------------------------------------------------------------
  // setDiagnostics / getAllDiagnostics / clearDiagnostics
  // -----------------------------------------------------------------------

  describe('setDiagnostics', () => {
    it('stores diagnostics', () => {
      const diags = [makeLink(), makeLink({ line: 2 })];
      manager.setDiagnostics(diags);
      expect(manager.getAllDiagnostics()).toHaveLength(2);
    });

    it('replaces previous diagnostics', () => {
      manager.setDiagnostics([makeLink(), makeLink({ line: 2 })]);
      manager.setDiagnostics([makeLink({ line: 5 })]);
      expect(manager.getAllDiagnostics()).toHaveLength(1);
      expect(manager.getAllDiagnostics()[0].line).toBe(5);
    });

    it('does not mutate the input array', () => {
      const diags = [makeLink()];
      manager.setDiagnostics(diags);
      diags.push(makeLink({ line: 99 }));
      expect(manager.getAllDiagnostics()).toHaveLength(1);
    });

    it('notifies subscribers', () => {
      const listener = vi.fn();
      manager.subscribe(listener);
      manager.setDiagnostics([makeLink()]);
      expect(listener).toHaveBeenCalledOnce();
    });
  });

  describe('clearDiagnostics', () => {
    it('removes all diagnostics', () => {
      manager.setDiagnostics([makeLink(), makeLink({ line: 2 })]);
      manager.clearDiagnostics();
      expect(manager.getAllDiagnostics()).toHaveLength(0);
    });

    it('notifies subscribers when clearing non-empty', () => {
      const listener = vi.fn();
      manager.setDiagnostics([makeLink()]);
      manager.subscribe(listener);
      manager.clearDiagnostics();
      expect(listener).toHaveBeenCalledOnce();
    });

    it('does not notify when already empty', () => {
      const listener = vi.fn();
      manager.subscribe(listener);
      manager.clearDiagnostics();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // getDiagnosticsForFile
  // -----------------------------------------------------------------------

  describe('getDiagnosticsForFile', () => {
    it('filters by exact file name', () => {
      manager.setDiagnostics([
        makeLink({ file: 'a.ino', line: 1 }),
        makeLink({ file: 'b.ino', line: 2 }),
        makeLink({ file: 'a.ino', line: 3 }),
      ]);
      const result = manager.getDiagnosticsForFile('a.ino');
      expect(result).toHaveLength(2);
      expect(result.every((d) => d.file === 'a.ino')).toBe(true);
    });

    it('returns empty array when no match', () => {
      manager.setDiagnostics([makeLink({ file: 'a.ino' })]);
      expect(manager.getDiagnosticsForFile('nonexistent.ino')).toHaveLength(0);
    });

    it('sorts by line ascending', () => {
      manager.setDiagnostics([
        makeLink({ file: 'x.ino', line: 10 }),
        makeLink({ file: 'x.ino', line: 2 }),
        makeLink({ file: 'x.ino', line: 5 }),
      ]);
      const result = manager.getDiagnosticsForFile('x.ino');
      expect(result.map((d) => d.line)).toEqual([2, 5, 10]);
    });

    it('sorts by column when lines are equal', () => {
      manager.setDiagnostics([
        makeLink({ file: 'x.ino', line: 5, column: 20 }),
        makeLink({ file: 'x.ino', line: 5, column: 3 }),
        makeLink({ file: 'x.ino', line: 5, column: 10 }),
      ]);
      const result = manager.getDiagnosticsForFile('x.ino');
      expect(result.map((d) => d.column)).toEqual([3, 10, 20]);
    });

    it('returns empty when no diagnostics set', () => {
      expect(manager.getDiagnosticsForFile('anything')).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // getGutterMarks
  // -----------------------------------------------------------------------

  describe('getGutterMarks', () => {
    it('creates one mark per line', () => {
      manager.setDiagnostics([
        makeLink({ file: 'a.ino', line: 1 }),
        makeLink({ file: 'a.ino', line: 2 }),
        makeLink({ file: 'a.ino', line: 3 }),
      ]);
      expect(manager.getGutterMarks('a.ino')).toHaveLength(3);
    });

    it('aggregates multiple diagnostics on the same line', () => {
      manager.setDiagnostics([
        makeLink({ file: 'a.ino', line: 5, message: 'first' }),
        makeLink({ file: 'a.ino', line: 5, message: 'second' }),
        makeLink({ file: 'a.ino', line: 5, message: 'third' }),
      ]);
      const marks = manager.getGutterMarks('a.ino');
      expect(marks).toHaveLength(1);
      expect(marks[0].count).toBe(3);
      expect(marks[0].messages).toEqual(['first', 'second', 'third']);
    });

    it('uses highest severity for aggregated marks (error > warning > note)', () => {
      manager.setDiagnostics([
        makeLink({ file: 'a.ino', line: 5, severity: 'note', message: 'a' }),
        makeLink({ file: 'a.ino', line: 5, severity: 'error', message: 'b' }),
        makeLink({ file: 'a.ino', line: 5, severity: 'warning', message: 'c' }),
      ]);
      const marks = manager.getGutterMarks('a.ino');
      expect(marks[0].severity).toBe('error');
    });

    it('warning beats note in severity', () => {
      manager.setDiagnostics([
        makeLink({ file: 'a.ino', line: 5, severity: 'note', message: 'a' }),
        makeLink({ file: 'a.ino', line: 5, severity: 'warning', message: 'b' }),
      ]);
      const marks = manager.getGutterMarks('a.ino');
      expect(marks[0].severity).toBe('warning');
    });

    it('returns marks sorted by line', () => {
      manager.setDiagnostics([
        makeLink({ file: 'a.ino', line: 10 }),
        makeLink({ file: 'a.ino', line: 2 }),
        makeLink({ file: 'a.ino', line: 7 }),
      ]);
      const marks = manager.getGutterMarks('a.ino');
      expect(marks.map((m) => m.line)).toEqual([2, 7, 10]);
    });

    it('filters to specified file only', () => {
      manager.setDiagnostics([
        makeLink({ file: 'a.ino', line: 1 }),
        makeLink({ file: 'b.ino', line: 1 }),
      ]);
      const marks = manager.getGutterMarks('a.ino');
      expect(marks).toHaveLength(1);
    });

    it('returns empty array for unknown file', () => {
      manager.setDiagnostics([makeLink({ file: 'a.ino' })]);
      expect(manager.getGutterMarks('unknown.ino')).toHaveLength(0);
    });

    it('returns empty array when no diagnostics', () => {
      expect(manager.getGutterMarks('anything')).toHaveLength(0);
    });

    it('single diagnostic produces count=1 and single message', () => {
      manager.setDiagnostics([makeLink({ file: 'a.ino', line: 1, message: 'only one' })]);
      const marks = manager.getGutterMarks('a.ino');
      expect(marks[0].count).toBe(1);
      expect(marks[0].messages).toEqual(['only one']);
    });
  });

  // -----------------------------------------------------------------------
  // getFirstError
  // -----------------------------------------------------------------------

  describe('getFirstError', () => {
    it('returns null when no diagnostics', () => {
      expect(manager.getFirstError()).toBeNull();
    });

    it('returns null when only warnings and notes', () => {
      manager.setDiagnostics([
        makeLink({ severity: 'warning' }),
        makeLink({ severity: 'note' }),
      ]);
      expect(manager.getFirstError()).toBeNull();
    });

    it('returns the error with earliest file name', () => {
      manager.setDiagnostics([
        makeLink({ file: 'z.ino', line: 1, severity: 'error', message: 'z' }),
        makeLink({ file: 'a.ino', line: 1, severity: 'error', message: 'a' }),
      ]);
      expect(manager.getFirstError()?.file).toBe('a.ino');
    });

    it('returns the error with earliest line in same file', () => {
      manager.setDiagnostics([
        makeLink({ file: 'x.ino', line: 20, severity: 'error', message: 'late' }),
        makeLink({ file: 'x.ino', line: 3, severity: 'error', message: 'early' }),
      ]);
      expect(manager.getFirstError()?.line).toBe(3);
    });

    it('returns the error with earliest column on same line', () => {
      manager.setDiagnostics([
        makeLink({ file: 'x.ino', line: 5, column: 30, severity: 'error', message: 'b' }),
        makeLink({ file: 'x.ino', line: 5, column: 2, severity: 'error', message: 'a' }),
      ]);
      expect(manager.getFirstError()?.column).toBe(2);
    });

    it('ignores warnings when finding first error', () => {
      manager.setDiagnostics([
        makeLink({ file: 'a.ino', line: 1, severity: 'warning' }),
        makeLink({ file: 'z.ino', line: 50, severity: 'error', message: 'the one' }),
      ]);
      expect(manager.getFirstError()?.message).toBe('the one');
    });
  });

  // -----------------------------------------------------------------------
  // resolveFilePath
  // -----------------------------------------------------------------------

  describe('resolveFilePath', () => {
    it('resolves relative path against sketch directory', () => {
      expect(manager.resolveFilePath('utils.h', '/home/user/sketch')).toBe(
        '/home/user/sketch/utils.h',
      );
    });

    it('handles trailing slash on sketch directory', () => {
      expect(manager.resolveFilePath('utils.h', '/home/user/sketch/')).toBe(
        '/home/user/sketch/utils.h',
      );
    });

    it('collapses parent directory references', () => {
      expect(manager.resolveFilePath('../lib/helper.h', '/home/user/sketch')).toBe(
        '/home/user/lib/helper.h',
      );
    });

    it('collapses current directory references', () => {
      expect(manager.resolveFilePath('./main.ino', '/home/user/sketch')).toBe(
        '/home/user/sketch/main.ino',
      );
    });

    it('returns absolute path unchanged (normalized)', () => {
      expect(manager.resolveFilePath('/usr/lib/avr/io.h', '/home/user/sketch')).toBe(
        '/usr/lib/avr/io.h',
      );
    });

    it('handles backslash paths (Windows)', () => {
      expect(manager.resolveFilePath('src\\utils.h', 'C:\\Users\\me\\sketch')).toBe(
        'C:/Users/me/sketch/src/utils.h',
      );
    });

    it('handles multiple parent traversals', () => {
      expect(manager.resolveFilePath('../../shared/types.h', '/home/user/project/src')).toBe(
        '/home/user/shared/types.h',
      );
    });

    it('does not go above root', () => {
      expect(manager.resolveFilePath('../../../../x.h', '/a/b')).toBe('/x.h');
    });

    it('resolves nested relative path', () => {
      expect(manager.resolveFilePath('lib/sensors/dht.h', '/sketch')).toBe(
        '/sketch/lib/sensors/dht.h',
      );
    });
  });

  // -----------------------------------------------------------------------
  // getErrorLines / getWarningLines
  // -----------------------------------------------------------------------

  describe('getErrorLines', () => {
    it('returns set of lines with errors', () => {
      manager.setDiagnostics([
        makeLink({ file: 'a.ino', line: 3, severity: 'error' }),
        makeLink({ file: 'a.ino', line: 7, severity: 'error' }),
        makeLink({ file: 'a.ino', line: 3, severity: 'error', message: 'dupe line' }),
      ]);
      const lines = manager.getErrorLines('a.ino');
      expect(lines.size).toBe(2);
      expect(lines.has(3)).toBe(true);
      expect(lines.has(7)).toBe(true);
    });

    it('excludes warnings and notes', () => {
      manager.setDiagnostics([
        makeLink({ file: 'a.ino', line: 1, severity: 'warning' }),
        makeLink({ file: 'a.ino', line: 2, severity: 'note' }),
        makeLink({ file: 'a.ino', line: 3, severity: 'error' }),
      ]);
      const lines = manager.getErrorLines('a.ino');
      expect(lines.size).toBe(1);
      expect(lines.has(3)).toBe(true);
    });

    it('filters to specified file', () => {
      manager.setDiagnostics([
        makeLink({ file: 'a.ino', line: 1, severity: 'error' }),
        makeLink({ file: 'b.ino', line: 2, severity: 'error' }),
      ]);
      expect(manager.getErrorLines('a.ino').size).toBe(1);
    });

    it('returns empty set when no errors', () => {
      expect(manager.getErrorLines('missing.ino').size).toBe(0);
    });
  });

  describe('getWarningLines', () => {
    it('returns set of lines with warnings', () => {
      manager.setDiagnostics([
        makeLink({ file: 'a.ino', line: 5, severity: 'warning' }),
        makeLink({ file: 'a.ino', line: 9, severity: 'warning' }),
      ]);
      const lines = manager.getWarningLines('a.ino');
      expect(lines.size).toBe(2);
      expect(lines.has(5)).toBe(true);
      expect(lines.has(9)).toBe(true);
    });

    it('excludes errors and notes', () => {
      manager.setDiagnostics([
        makeLink({ file: 'a.ino', line: 1, severity: 'error' }),
        makeLink({ file: 'a.ino', line: 2, severity: 'note' }),
        makeLink({ file: 'a.ino', line: 3, severity: 'warning' }),
      ]);
      const lines = manager.getWarningLines('a.ino');
      expect(lines.size).toBe(1);
      expect(lines.has(3)).toBe(true);
    });

    it('returns empty set when no warnings', () => {
      expect(manager.getWarningLines('empty.ino').size).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // getSummary
  // -----------------------------------------------------------------------

  describe('getSummary', () => {
    it('returns zero counts when empty', () => {
      expect(manager.getSummary()).toEqual({ files: 0, errors: 0, warnings: 0, notes: 0 });
    });

    it('counts errors, warnings, notes correctly', () => {
      manager.setDiagnostics([
        makeLink({ file: 'a.ino', severity: 'error' }),
        makeLink({ file: 'a.ino', severity: 'error' }),
        makeLink({ file: 'a.ino', severity: 'warning' }),
        makeLink({ file: 'a.ino', severity: 'note' }),
      ]);
      expect(manager.getSummary()).toEqual({ files: 1, errors: 2, warnings: 1, notes: 1 });
    });

    it('counts unique files', () => {
      manager.setDiagnostics([
        makeLink({ file: 'a.ino', severity: 'error' }),
        makeLink({ file: 'b.ino', severity: 'warning' }),
        makeLink({ file: 'c.ino', severity: 'note' }),
        makeLink({ file: 'a.ino', severity: 'error' }),
      ]);
      expect(manager.getSummary().files).toBe(3);
    });

    it('updates after setDiagnostics', () => {
      manager.setDiagnostics([makeLink({ severity: 'error' })]);
      expect(manager.getSummary().errors).toBe(1);
      manager.setDiagnostics([]);
      expect(manager.getSummary().errors).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // subscribe / getSnapshot
  // -----------------------------------------------------------------------

  describe('subscribe + getSnapshot', () => {
    it('increments snapshot version on setDiagnostics', () => {
      const v1 = manager.getSnapshot();
      manager.setDiagnostics([makeLink()]);
      expect(manager.getSnapshot()).toBe(v1 + 1);
    });

    it('increments snapshot version on clearDiagnostics', () => {
      manager.setDiagnostics([makeLink()]);
      const v = manager.getSnapshot();
      manager.clearDiagnostics();
      expect(manager.getSnapshot()).toBe(v + 1);
    });

    it('does not increment when clearing empty', () => {
      const v = manager.getSnapshot();
      manager.clearDiagnostics();
      expect(manager.getSnapshot()).toBe(v);
    });

    it('calls listener on set', () => {
      const listener = vi.fn();
      manager.subscribe(listener);
      manager.setDiagnostics([makeLink()]);
      manager.setDiagnostics([makeLink({ line: 2 })]);
      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('unsubscribe prevents further calls', () => {
      const listener = vi.fn();
      const unsub = manager.subscribe(listener);
      manager.setDiagnostics([makeLink()]);
      expect(listener).toHaveBeenCalledOnce();
      unsub();
      manager.setDiagnostics([makeLink({ line: 2 })]);
      expect(listener).toHaveBeenCalledOnce();
    });

    it('supports multiple listeners', () => {
      const a = vi.fn();
      const b = vi.fn();
      manager.subscribe(a);
      manager.subscribe(b);
      manager.setDiagnostics([makeLink()]);
      expect(a).toHaveBeenCalledOnce();
      expect(b).toHaveBeenCalledOnce();
    });
  });

  // -----------------------------------------------------------------------
  // navigateToError / onNavigate
  // -----------------------------------------------------------------------

  describe('navigation events', () => {
    it('fires callback when navigateToError is called', () => {
      const cb = vi.fn();
      manager.onNavigate(cb);
      const link = makeLink({ line: 42, message: 'navigate me' });
      manager.navigateToError(link);
      expect(cb).toHaveBeenCalledOnce();
      expect(cb).toHaveBeenCalledWith(link);
    });

    it('fires multiple callbacks', () => {
      const a = vi.fn();
      const b = vi.fn();
      manager.onNavigate(a);
      manager.onNavigate(b);
      const link = makeLink();
      manager.navigateToError(link);
      expect(a).toHaveBeenCalledOnce();
      expect(b).toHaveBeenCalledOnce();
    });

    it('unsubscribe stops callback', () => {
      const cb = vi.fn();
      const unsub = manager.onNavigate(cb);
      unsub();
      manager.navigateToError(makeLink());
      expect(cb).not.toHaveBeenCalled();
    });

    it('does not fire storechange listeners on navigate', () => {
      const listener = vi.fn();
      manager.subscribe(listener);
      manager.navigateToError(makeLink());
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // destroy
  // -----------------------------------------------------------------------

  describe('destroy', () => {
    it('clears diagnostics and listeners', () => {
      const listener = vi.fn();
      manager.subscribe(listener);
      manager.setDiagnostics([makeLink(), makeLink({ line: 2 })]);
      manager.destroy();
      expect(manager.getAllDiagnostics()).toHaveLength(0);
      // Listeners were cleared, so setting again should not fire old listener
      manager.setDiagnostics([makeLink()]);
      expect(listener).toHaveBeenCalledOnce(); // Only the first set, not after destroy
    });

    it('clears navigate callbacks', () => {
      const cb = vi.fn();
      manager.onNavigate(cb);
      manager.destroy();
      manager.navigateToError(makeLink());
      expect(cb).not.toHaveBeenCalled();
    });

    it('resets version to zero', () => {
      manager.setDiagnostics([makeLink()]);
      expect(manager.getSnapshot()).toBeGreaterThan(0);
      manager.destroy();
      expect(manager.getSnapshot()).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles empty diagnostics array', () => {
      manager.setDiagnostics([]);
      expect(manager.getAllDiagnostics()).toHaveLength(0);
      expect(manager.getSummary()).toEqual({ files: 0, errors: 0, warnings: 0, notes: 0 });
    });

    it('handles diagnostics with hint field', () => {
      const link = makeLink({ hint: 'did you mean: Serial.begin()?' });
      manager.setDiagnostics([link]);
      expect(manager.getAllDiagnostics()[0].hint).toBe('did you mean: Serial.begin()?');
    });

    it('handles diagnostics with column 0', () => {
      manager.setDiagnostics([makeLink({ column: 0 })]);
      expect(manager.getDiagnosticsForFile('sketch.ino')[0].column).toBe(0);
    });

    it('handles many diagnostics across many files', () => {
      const diags: ErrorLineLink[] = [];
      for (let f = 0; f < 10; f++) {
        for (let l = 1; l <= 20; l++) {
          diags.push(makeLink({ file: `file${f}.ino`, line: l, severity: 'error' }));
        }
      }
      manager.setDiagnostics(diags);
      expect(manager.getSummary()).toEqual({ files: 10, errors: 200, warnings: 0, notes: 0 });
      expect(manager.getDiagnosticsForFile('file3.ino')).toHaveLength(20);
    });

    it('gutter marks preserve message order by column', () => {
      manager.setDiagnostics([
        makeLink({ file: 'a.ino', line: 1, column: 20, message: 'second' }),
        makeLink({ file: 'a.ino', line: 1, column: 5, message: 'first' }),
      ]);
      const marks = manager.getGutterMarks('a.ino');
      // Messages appear in column-sorted order since getDiagnosticsForFile sorts
      expect(marks[0].messages).toEqual(['first', 'second']);
    });

    it('getGutterMarks type-checks as GutterMark[]', () => {
      manager.setDiagnostics([makeLink({ line: 1 })]);
      const marks: GutterMark[] = manager.getGutterMarks('sketch.ino');
      expect(marks).toHaveLength(1);
      expect(marks[0]).toHaveProperty('line');
      expect(marks[0]).toHaveProperty('severity');
      expect(marks[0]).toHaveProperty('count');
      expect(marks[0]).toHaveProperty('messages');
    });
  });
});
