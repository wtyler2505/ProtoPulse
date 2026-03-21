import { describe, it, expect } from 'vitest';
import {
  computeDiff,
  computeLcsTable,
  backtrackLcs,
  groupIntoHunks,
  computeSimilarity,
  detectConflicts,
  formatUnifiedDiff,
  parseUnifiedDiff,
  applyDiff,
  reverseDiff,
  diffSummary,
  stripCComments,
  normalizeWhitespace,
  preprocessLines,
} from '../code-diff-viewer';
import type { DiffLine, DiffHunk, DiffResult } from '../code-diff-viewer';

// ──────────────────────────────────────────────────────────────────
// stripCComments
// ──────────────────────────────────────────────────────────────────

describe('stripCComments', () => {
  it('removes single-line comments', () => {
    expect(stripCComments('int x = 5; // set x')).toBe('int x = 5; ');
  });

  it('removes multi-line comments', () => {
    expect(stripCComments('int x; /* comment */ int y;')).toBe('int x;  int y;');
  });

  it('removes multi-line comment spanning lines', () => {
    const result = stripCComments('a /* start\nmiddle\nend */ b');
    expect(result).toBe('a  b');
  });

  it('preserves code without comments', () => {
    expect(stripCComments('int x = 5;')).toBe('int x = 5;');
  });

  it('handles multiple comments', () => {
    const result = stripCComments('a // x\nb // y');
    expect(result).toBe('a \nb ');
  });
});

// ──────────────────────────────────────────────────────────────────
// normalizeWhitespace
// ──────────────────────────────────────────────────────────────────

describe('normalizeWhitespace', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normalizeWhitespace('  hello  ')).toBe('hello');
  });

  it('collapses internal whitespace', () => {
    expect(normalizeWhitespace('a   b    c')).toBe('a b c');
  });

  it('handles tabs', () => {
    expect(normalizeWhitespace('\ta\t\tb')).toBe('a b');
  });

  it('handles empty string', () => {
    expect(normalizeWhitespace('')).toBe('');
  });
});

// ──────────────────────────────────────────────────────────────────
// preprocessLines
// ──────────────────────────────────────────────────────────────────

describe('preprocessLines', () => {
  it('strips comments when ignoreComments is true', () => {
    const lines = ['int x; // comment', 'int y;'];
    const result = preprocessLines(lines, { ignoreComments: true });
    expect(result[0]).not.toContain('comment');
  });

  it('normalizes whitespace when ignoreWhitespace is true', () => {
    const lines = ['  int   x  ;'];
    const result = preprocessLines(lines, { ignoreWhitespace: true });
    expect(result[0]).toBe('int x ;');
  });

  it('removes blank lines when ignoreBlankLines is true', () => {
    const lines = ['a', '', '  ', 'b'];
    const result = preprocessLines(lines, { ignoreBlankLines: true });
    expect(result).toEqual(['a', 'b']);
  });

  it('applies multiple options', () => {
    const lines = ['  a  ; // comment', '', 'b'];
    const result = preprocessLines(lines, {
      ignoreComments: true,
      ignoreWhitespace: true,
      ignoreBlankLines: true,
    });
    expect(result).toHaveLength(2);
    expect(result[0]).not.toContain('comment');
  });

  it('returns unchanged lines with no options', () => {
    const lines = ['a', 'b'];
    const result = preprocessLines(lines, {});
    expect(result).toEqual(['a', 'b']);
  });
});

// ──────────────────────────────────────────────────────────────────
// computeLcsTable
// ──────────────────────────────────────────────────────────────────

describe('computeLcsTable', () => {
  it('computes table for identical sequences', () => {
    const table = computeLcsTable(['a', 'b'], ['a', 'b']);
    expect(table[2][2]).toBe(2);
  });

  it('computes table for completely different sequences', () => {
    const table = computeLcsTable(['a', 'b'], ['c', 'd']);
    expect(table[2][2]).toBe(0);
  });

  it('computes table for partial overlap', () => {
    const table = computeLcsTable(['a', 'b', 'c'], ['a', 'x', 'c']);
    expect(table[3][3]).toBe(2); // LCS = ['a', 'c']
  });

  it('handles empty old', () => {
    const table = computeLcsTable([], ['a', 'b']);
    expect(table[0][2]).toBe(0);
  });

  it('handles empty new', () => {
    const table = computeLcsTable(['a', 'b'], []);
    expect(table[2][0]).toBe(0);
  });

  it('handles both empty', () => {
    const table = computeLcsTable([], []);
    expect(table[0][0]).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// backtrackLcs
// ──────────────────────────────────────────────────────────────────

describe('backtrackLcs', () => {
  it('produces correct diff for simple change', () => {
    const old = ['a', 'b', 'c'];
    const nw = ['a', 'x', 'c'];
    const table = computeLcsTable(old, nw);
    const diff = backtrackLcs(old, nw, table);

    expect(diff).toHaveLength(4);
    expect(diff[0]).toEqual({ type: 'context', content: 'a', oldLineNumber: 1, newLineNumber: 1 });
    expect(diff[1]).toEqual({ type: 'remove', content: 'b', oldLineNumber: 2 });
    expect(diff[2]).toEqual({ type: 'add', content: 'x', newLineNumber: 2 });
    expect(diff[3]).toEqual({ type: 'context', content: 'c', oldLineNumber: 3, newLineNumber: 3 });
  });

  it('handles all additions', () => {
    const old: string[] = [];
    const nw = ['a', 'b'];
    const table = computeLcsTable(old, nw);
    const diff = backtrackLcs(old, nw, table);

    expect(diff).toHaveLength(2);
    expect(diff[0].type).toBe('add');
    expect(diff[1].type).toBe('add');
  });

  it('handles all removals', () => {
    const old = ['a', 'b'];
    const nw: string[] = [];
    const table = computeLcsTable(old, nw);
    const diff = backtrackLcs(old, nw, table);

    expect(diff).toHaveLength(2);
    expect(diff[0].type).toBe('remove');
    expect(diff[1].type).toBe('remove');
  });

  it('handles identical inputs', () => {
    const old = ['a', 'b'];
    const nw = ['a', 'b'];
    const table = computeLcsTable(old, nw);
    const diff = backtrackLcs(old, nw, table);

    expect(diff).toHaveLength(2);
    diff.forEach((d) => {
      expect(d.type).toBe('context');
    });
  });
});

// ──────────────────────────────────────────────────────────────────
// groupIntoHunks
// ──────────────────────────────────────────────────────────────────

describe('groupIntoHunks', () => {
  it('returns empty for no changes', () => {
    const lines: DiffLine[] = [
      { type: 'context', content: 'a', oldLineNumber: 1, newLineNumber: 1 },
    ];
    expect(groupIntoHunks(lines, 3)).toHaveLength(0);
  });

  it('returns empty for empty input', () => {
    expect(groupIntoHunks([], 3)).toHaveLength(0);
  });

  it('creates single hunk for adjacent changes', () => {
    const lines: DiffLine[] = [
      { type: 'context', content: 'a', oldLineNumber: 1, newLineNumber: 1 },
      { type: 'remove', content: 'b', oldLineNumber: 2 },
      { type: 'add', content: 'x', newLineNumber: 2 },
      { type: 'context', content: 'c', oldLineNumber: 3, newLineNumber: 3 },
    ];
    const hunks = groupIntoHunks(lines, 1);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].lines.length).toBeGreaterThanOrEqual(2);
  });

  it('merges nearby changes into one hunk', () => {
    const lines: DiffLine[] = [
      { type: 'remove', content: 'a', oldLineNumber: 1 },
      { type: 'context', content: 'b', oldLineNumber: 2, newLineNumber: 1 },
      { type: 'add', content: 'c', newLineNumber: 2 },
    ];
    const hunks = groupIntoHunks(lines, 3);
    expect(hunks).toHaveLength(1);
  });

  it('separates distant changes into multiple hunks', () => {
    const lines: DiffLine[] = [
      { type: 'remove', content: 'a', oldLineNumber: 1 },
      ...Array.from({ length: 10 }, (_, i) => ({
        type: 'context' as const,
        content: `ctx${i}`,
        oldLineNumber: i + 2,
        newLineNumber: i + 1,
      })),
      { type: 'add', content: 'z', newLineNumber: 12 },
    ];
    const hunks = groupIntoHunks(lines, 1);
    expect(hunks).toHaveLength(2);
  });

  it('includes correct line counts in hunks', () => {
    const lines: DiffLine[] = [
      { type: 'context', content: 'a', oldLineNumber: 1, newLineNumber: 1 },
      { type: 'remove', content: 'b', oldLineNumber: 2 },
      { type: 'add', content: 'x', newLineNumber: 2 },
      { type: 'add', content: 'y', newLineNumber: 3 },
      { type: 'context', content: 'c', oldLineNumber: 3, newLineNumber: 4 },
    ];
    const hunks = groupIntoHunks(lines, 3);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].oldCount).toBe(3); // a, b (removed), c
    expect(hunks[0].newCount).toBe(4); // a, x (added), y (added), c
  });
});

// ──────────────────────────────────────────────────────────────────
// computeSimilarity
// ──────────────────────────────────────────────────────────────────

describe('computeSimilarity', () => {
  it('returns 1.0 for identical inputs', () => {
    expect(computeSimilarity(['a', 'b'], ['a', 'b'])).toBe(1.0);
  });

  it('returns 0.0 for completely different inputs', () => {
    expect(computeSimilarity(['a', 'b'], ['c', 'd'])).toBe(0.0);
  });

  it('returns 1.0 for both empty', () => {
    expect(computeSimilarity([], [])).toBe(1.0);
  });

  it('returns 0.0 when one side is empty', () => {
    expect(computeSimilarity(['a'], [])).toBe(0.0);
    expect(computeSimilarity([], ['a'])).toBe(0.0);
  });

  it('returns partial similarity', () => {
    const sim = computeSimilarity(['a', 'b', 'c'], ['a', 'x', 'c']);
    expect(sim).toBeGreaterThan(0.5);
    expect(sim).toBeLessThan(1.0);
  });

  it('is symmetric', () => {
    const old = ['a', 'b', 'c'];
    const nw = ['x', 'b', 'y'];
    expect(computeSimilarity(old, nw)).toBeCloseTo(computeSimilarity(nw, old), 5);
  });
});

// ──────────────────────────────────────────────────────────────────
// detectConflicts
// ──────────────────────────────────────────────────────────────────

describe('detectConflicts', () => {
  it('detects conflict when threshold met', () => {
    const lines: DiffLine[] = [
      { type: 'remove', content: 'a', oldLineNumber: 1 },
      { type: 'remove', content: 'b', oldLineNumber: 2 },
      { type: 'remove', content: 'c', oldLineNumber: 3 },
      { type: 'add', content: 'x', newLineNumber: 1 },
      { type: 'add', content: 'y', newLineNumber: 2 },
      { type: 'add', content: 'z', newLineNumber: 3 },
    ];
    const conflicts = detectConflicts(lines, 3);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].oldContent).toEqual(['a', 'b', 'c']);
    expect(conflicts[0].newContent).toEqual(['x', 'y', 'z']);
  });

  it('does not detect conflict below threshold', () => {
    const lines: DiffLine[] = [
      { type: 'remove', content: 'a', oldLineNumber: 1 },
      { type: 'remove', content: 'b', oldLineNumber: 2 },
      { type: 'add', content: 'x', newLineNumber: 1 },
      { type: 'add', content: 'y', newLineNumber: 2 },
    ];
    const conflicts = detectConflicts(lines, 3);
    expect(conflicts).toHaveLength(0);
  });

  it('returns empty for context-only diff', () => {
    const lines: DiffLine[] = [
      { type: 'context', content: 'a', oldLineNumber: 1, newLineNumber: 1 },
    ];
    expect(detectConflicts(lines)).toHaveLength(0);
  });

  it('detects multiple conflicts', () => {
    const lines: DiffLine[] = [
      { type: 'remove', content: 'a', oldLineNumber: 1 },
      { type: 'remove', content: 'b', oldLineNumber: 2 },
      { type: 'remove', content: 'c', oldLineNumber: 3 },
      { type: 'add', content: 'x', newLineNumber: 1 },
      { type: 'add', content: 'y', newLineNumber: 2 },
      { type: 'add', content: 'z', newLineNumber: 3 },
      { type: 'context', content: 'mid', oldLineNumber: 4, newLineNumber: 4 },
      { type: 'remove', content: 'd', oldLineNumber: 5 },
      { type: 'remove', content: 'e', oldLineNumber: 6 },
      { type: 'remove', content: 'f', oldLineNumber: 7 },
      { type: 'add', content: 'p', newLineNumber: 5 },
      { type: 'add', content: 'q', newLineNumber: 6 },
      { type: 'add', content: 'r', newLineNumber: 7 },
    ];
    const conflicts = detectConflicts(lines, 3);
    expect(conflicts).toHaveLength(2);
  });
});

// ──────────────────────────────────────────────────────────────────
// formatUnifiedDiff
// ──────────────────────────────────────────────────────────────────

describe('formatUnifiedDiff', () => {
  it('formats a single hunk', () => {
    const hunks: DiffHunk[] = [{
      oldStart: 1, oldCount: 3, newStart: 1, newCount: 3,
      lines: [
        { type: 'context', content: 'a', oldLineNumber: 1, newLineNumber: 1 },
        { type: 'remove', content: 'b', oldLineNumber: 2 },
        { type: 'add', content: 'x', newLineNumber: 2 },
        { type: 'context', content: 'c', oldLineNumber: 3, newLineNumber: 3 },
      ],
    }];
    const output = formatUnifiedDiff(hunks, 'old.ino', 'new.ino');
    expect(output).toContain('--- old.ino');
    expect(output).toContain('+++ new.ino');
    expect(output).toContain('@@ -1,3 +1,3 @@');
    expect(output).toContain(' a');
    expect(output).toContain('-b');
    expect(output).toContain('+x');
    expect(output).toContain(' c');
  });

  it('returns empty string for no hunks', () => {
    expect(formatUnifiedDiff([])).toBe('');
  });

  it('uses default filenames', () => {
    const hunks: DiffHunk[] = [{
      oldStart: 1, oldCount: 1, newStart: 1, newCount: 1,
      lines: [{ type: 'add', content: 'x', newLineNumber: 1 }],
    }];
    const output = formatUnifiedDiff(hunks);
    expect(output).toContain('--- a/file');
    expect(output).toContain('+++ b/file');
  });
});

// ──────────────────────────────────────────────────────────────────
// parseUnifiedDiff
// ──────────────────────────────────────────────────────────────────

describe('parseUnifiedDiff', () => {
  it('parses a simple unified diff', () => {
    const diff = [
      '--- a/file',
      '+++ b/file',
      '@@ -1,3 +1,3 @@',
      ' a',
      '-b',
      '+x',
      ' c',
    ].join('\n');

    const hunks = parseUnifiedDiff(diff);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].oldStart).toBe(1);
    expect(hunks[0].oldCount).toBe(3);
    expect(hunks[0].newStart).toBe(1);
    expect(hunks[0].newCount).toBe(3);
    expect(hunks[0].lines).toHaveLength(4);
  });

  it('parses multiple hunks', () => {
    const diff = [
      '--- a',
      '+++ b',
      '@@ -1,2 +1,2 @@',
      '-old1',
      '+new1',
      ' same',
      '@@ -10,2 +10,2 @@',
      '-old2',
      '+new2',
      ' same2',
    ].join('\n');

    const hunks = parseUnifiedDiff(diff);
    expect(hunks).toHaveLength(2);
  });

  it('returns empty for non-diff input', () => {
    expect(parseUnifiedDiff('just some text')).toHaveLength(0);
  });

  it('assigns correct line numbers', () => {
    const diff = [
      '@@ -5,3 +5,3 @@',
      ' ctx',
      '-old',
      '+new',
      ' ctx2',
    ].join('\n');

    const hunks = parseUnifiedDiff(diff);
    expect(hunks[0].lines[0].oldLineNumber).toBe(5);
    expect(hunks[0].lines[0].newLineNumber).toBe(5);
    expect(hunks[0].lines[1].oldLineNumber).toBe(6);
    expect(hunks[0].lines[2].newLineNumber).toBe(6);
  });
});

// ──────────────────────────────────────────────────────────────────
// applyDiff
// ──────────────────────────────────────────────────────────────────

describe('applyDiff', () => {
  it('applies a simple replacement', () => {
    const old = 'a\nb\nc';
    const hunks: DiffHunk[] = [{
      oldStart: 1, oldCount: 3, newStart: 1, newCount: 3,
      lines: [
        { type: 'context', content: 'a', oldLineNumber: 1, newLineNumber: 1 },
        { type: 'remove', content: 'b', oldLineNumber: 2 },
        { type: 'add', content: 'x', newLineNumber: 2 },
        { type: 'context', content: 'c', oldLineNumber: 3, newLineNumber: 3 },
      ],
    }];
    expect(applyDiff(old, hunks)).toBe('a\nx\nc');
  });

  it('applies additions', () => {
    const old = 'a\nc';
    const hunks: DiffHunk[] = [{
      oldStart: 1, oldCount: 2, newStart: 1, newCount: 3,
      lines: [
        { type: 'context', content: 'a', oldLineNumber: 1, newLineNumber: 1 },
        { type: 'add', content: 'b', newLineNumber: 2 },
        { type: 'context', content: 'c', oldLineNumber: 2, newLineNumber: 3 },
      ],
    }];
    expect(applyDiff(old, hunks)).toBe('a\nb\nc');
  });

  it('applies removals', () => {
    const old = 'a\nb\nc';
    const hunks: DiffHunk[] = [{
      oldStart: 1, oldCount: 3, newStart: 1, newCount: 2,
      lines: [
        { type: 'context', content: 'a', oldLineNumber: 1, newLineNumber: 1 },
        { type: 'remove', content: 'b', oldLineNumber: 2 },
        { type: 'context', content: 'c', oldLineNumber: 3, newLineNumber: 2 },
      ],
    }];
    expect(applyDiff(old, hunks)).toBe('a\nc');
  });

  it('applies no-change hunks', () => {
    const old = 'a\nb\nc';
    expect(applyDiff(old, [])).toBe('a\nb\nc');
  });
});

// ──────────────────────────────────────────────────────────────────
// reverseDiff
// ──────────────────────────────────────────────────────────────────

describe('reverseDiff', () => {
  it('swaps adds and removes', () => {
    const hunks: DiffHunk[] = [{
      oldStart: 1, oldCount: 2, newStart: 1, newCount: 2,
      lines: [
        { type: 'remove', content: 'old', oldLineNumber: 1 },
        { type: 'add', content: 'new', newLineNumber: 1 },
      ],
    }];
    const reversed = reverseDiff(hunks);
    expect(reversed[0].lines[0].type).toBe('add');
    expect(reversed[0].lines[0].content).toBe('old');
    expect(reversed[0].lines[1].type).toBe('remove');
    expect(reversed[0].lines[1].content).toBe('new');
  });

  it('swaps old/new start and count', () => {
    const hunks: DiffHunk[] = [{
      oldStart: 5, oldCount: 3, newStart: 10, newCount: 4,
      lines: [],
    }];
    const reversed = reverseDiff(hunks);
    expect(reversed[0].oldStart).toBe(10);
    expect(reversed[0].oldCount).toBe(4);
    expect(reversed[0].newStart).toBe(5);
    expect(reversed[0].newCount).toBe(3);
  });

  it('preserves context lines', () => {
    const hunks: DiffHunk[] = [{
      oldStart: 1, oldCount: 1, newStart: 1, newCount: 1,
      lines: [{ type: 'context', content: 'same', oldLineNumber: 1, newLineNumber: 1 }],
    }];
    const reversed = reverseDiff(hunks);
    expect(reversed[0].lines[0].type).toBe('context');
    expect(reversed[0].lines[0].content).toBe('same');
  });

  it('returns empty for empty input', () => {
    expect(reverseDiff([])).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────
// computeDiff — integration
// ──────────────────────────────────────────────────────────────────

describe('computeDiff', () => {
  it('computes diff for identical code', () => {
    const code = 'int x = 5;\nreturn x;';
    const result = computeDiff(code, code);
    expect(result.addedLines).toBe(0);
    expect(result.removedLines).toBe(0);
    expect(result.similarityScore).toBe(1.0);
    expect(result.hunks).toHaveLength(0);
    expect(result.hasConflicts).toBe(false);
  });

  it('detects added lines', () => {
    const old = 'a\nc';
    const nw = 'a\nb\nc';
    const result = computeDiff(old, nw);
    expect(result.addedLines).toBe(1);
    expect(result.removedLines).toBe(0);
    expect(result.newLineCount).toBe(3);
  });

  it('detects removed lines', () => {
    const old = 'a\nb\nc';
    const nw = 'a\nc';
    const result = computeDiff(old, nw);
    expect(result.addedLines).toBe(0);
    expect(result.removedLines).toBe(1);
  });

  it('detects modified lines', () => {
    const old = 'a\nb\nc';
    const nw = 'a\nx\nc';
    const result = computeDiff(old, nw);
    expect(result.addedLines).toBe(1);
    expect(result.removedLines).toBe(1);
    expect(result.hunks.length).toBeGreaterThanOrEqual(1);
  });

  it('ignores whitespace when configured', () => {
    const old = 'int   x  =  5;';
    const nw = 'int x = 5;';
    const result = computeDiff(old, nw, { ignoreWhitespace: true });
    expect(result.addedLines).toBe(0);
    expect(result.removedLines).toBe(0);
  });

  it('ignores comments when configured', () => {
    const old = 'int x = 5; // old comment';
    const nw = 'int x = 5; // new comment';
    const result = computeDiff(old, nw, { ignoreComments: true });
    expect(result.addedLines).toBe(0);
    expect(result.removedLines).toBe(0);
  });

  it('ignores blank lines when configured', () => {
    const old = 'a\n\nb';
    const nw = 'a\nb';
    const result = computeDiff(old, nw, { ignoreBlankLines: true });
    expect(result.addedLines).toBe(0);
    expect(result.removedLines).toBe(0);
  });

  it('detects conflicts in large divergences', () => {
    const oldLines = Array.from({ length: 5 }, (_, i) => `old_line_${i}`);
    const newLines = Array.from({ length: 5 }, (_, i) => `new_line_${i}`);
    const result = computeDiff(oldLines.join('\n'), newLines.join('\n'));
    expect(result.hasConflicts).toBe(true);
    expect(result.conflicts.length).toBeGreaterThanOrEqual(1);
  });

  it('reports correct line counts', () => {
    const old = 'a\nb\nc';
    const nw = 'a\nx\ny\nz';
    const result = computeDiff(old, nw);
    expect(result.oldLineCount).toBe(3);
    expect(result.newLineCount).toBe(4);
  });

  it('uses custom context lines', () => {
    const old = Array.from({ length: 20 }, (_, i) => `line${i}`).join('\n');
    const nw = old.replace('line10', 'changed');
    const result0 = computeDiff(old, nw, { contextLines: 0 });
    const result5 = computeDiff(old, nw, { contextLines: 5 });
    // More context = more lines in hunks
    if (result0.hunks.length > 0 && result5.hunks.length > 0) {
      expect(result5.hunks[0].lines.length).toBeGreaterThanOrEqual(
        result0.hunks[0].lines.length,
      );
    }
  });
});

// ──────────────────────────────────────────────────────────────────
// Round-trip: computeDiff → applyDiff
// ──────────────────────────────────────────────────────────────────

describe('round-trip diff/apply', () => {
  it('applying diff produces new code', () => {
    const old = 'int x = 5;\nint y = 10;\nreturn x + y;';
    const nw = 'int x = 5;\nint y = 20;\nint z = 30;\nreturn x + y + z;';
    const result = computeDiff(old, nw);
    const applied = applyDiff(old, result.hunks);
    expect(applied).toBe(nw);
  });

  it('round-trips with only additions', () => {
    const old = 'a\nc';
    const nw = 'a\nb\nc';
    const result = computeDiff(old, nw);
    expect(applyDiff(old, result.hunks)).toBe(nw);
  });

  it('round-trips with only removals', () => {
    const old = 'a\nb\nc';
    const nw = 'a\nc';
    const result = computeDiff(old, nw);
    expect(applyDiff(old, result.hunks)).toBe(nw);
  });
});

// ──────────────────────────────────────────────────────────────────
// Round-trip: formatUnifiedDiff → parseUnifiedDiff
// ──────────────────────────────────────────────────────────────────

describe('format/parse round-trip', () => {
  it('round-trips unified diff format', () => {
    const old = 'a\nb\nc';
    const nw = 'a\nx\nc';
    const result = computeDiff(old, nw);
    const formatted = formatUnifiedDiff(result.hunks);
    const parsed = parseUnifiedDiff(formatted);

    expect(parsed).toHaveLength(result.hunks.length);
    parsed.forEach((hunk, i) => {
      expect(hunk.oldStart).toBe(result.hunks[i].oldStart);
      expect(hunk.newStart).toBe(result.hunks[i].newStart);
      expect(hunk.lines.length).toBe(result.hunks[i].lines.length);
    });
  });
});

// ──────────────────────────────────────────────────────────────────
// diffSummary
// ──────────────────────────────────────────────────────────────────

describe('diffSummary', () => {
  it('returns identical message for no changes', () => {
    const result: DiffResult = {
      hunks: [], oldLineCount: 5, newLineCount: 5,
      addedLines: 0, removedLines: 0, contextLines: 5,
      similarityScore: 1.0, hasConflicts: false, conflicts: [],
    };
    expect(diffSummary(result)).toBe('Files are identical.');
  });

  it('describes additions', () => {
    const result: DiffResult = {
      hunks: [], oldLineCount: 5, newLineCount: 8,
      addedLines: 3, removedLines: 0, contextLines: 5,
      similarityScore: 0.8, hasConflicts: false, conflicts: [],
    };
    const summary = diffSummary(result);
    expect(summary).toContain('3 lines added');
    expect(summary).toContain('80% similar');
  });

  it('describes removals', () => {
    const result: DiffResult = {
      hunks: [], oldLineCount: 5, newLineCount: 4,
      addedLines: 0, removedLines: 1, contextLines: 4,
      similarityScore: 0.9, hasConflicts: false, conflicts: [],
    };
    expect(diffSummary(result)).toContain('1 line removed');
  });

  it('describes conflicts', () => {
    const result: DiffResult = {
      hunks: [], oldLineCount: 10, newLineCount: 10,
      addedLines: 5, removedLines: 5, contextLines: 5,
      similarityScore: 0.5, hasConflicts: true,
      conflicts: [{ startLine: 1, endLine: 5, description: '', oldContent: [], newContent: [] }],
    };
    expect(diffSummary(result)).toContain('1 conflict detected');
  });

  it('pluralizes correctly', () => {
    const result: DiffResult = {
      hunks: [], oldLineCount: 10, newLineCount: 10,
      addedLines: 1, removedLines: 1, contextLines: 8,
      similarityScore: 0.8, hasConflicts: false, conflicts: [],
    };
    const summary = diffSummary(result);
    expect(summary).toContain('1 line added');
    expect(summary).toContain('1 line removed');
  });
});
