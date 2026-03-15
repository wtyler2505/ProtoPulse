import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  normalizeContent,
  computeDiff,
  formatDriftResult,
  parseArgs,
  readCommittedTypes,
  checkApiTypes,
} from '../check-api-types';
import type { DriftCheckResult } from '../check-api-types';

// ---------------------------------------------------------------------------
// normalizeContent
// ---------------------------------------------------------------------------

describe('normalizeContent', () => {
  it('trims trailing whitespace from each line', () => {
    const input = 'hello   \nworld  \n';
    expect(normalizeContent(input)).toBe('hello\nworld\n');
  });

  it('ensures a single trailing newline', () => {
    expect(normalizeContent('abc')).toBe('abc\n');
    expect(normalizeContent('abc\n')).toBe('abc\n');
    expect(normalizeContent('abc\n\n\n')).toBe('abc\n');
  });

  it('preserves leading whitespace (indentation)', () => {
    const input = '  indented\n    deeper\n';
    expect(normalizeContent(input)).toBe('  indented\n    deeper\n');
  });

  it('handles empty string', () => {
    expect(normalizeContent('')).toBe('\n');
  });

  it('handles single newline', () => {
    expect(normalizeContent('\n')).toBe('\n');
  });

  it('normalizes mixed trailing whitespace (tabs + spaces)', () => {
    const input = 'line1\t  \nline2   \t\n';
    expect(normalizeContent(input)).toBe('line1\nline2\n');
  });
});

// ---------------------------------------------------------------------------
// computeDiff
// ---------------------------------------------------------------------------

describe('computeDiff', () => {
  it('returns empty string when contents are identical', () => {
    const content = 'line1\nline2\nline3\n';
    expect(computeDiff(content, content)).toBe('');
  });

  it('detects a changed line', () => {
    const committed = 'aaa\nbbb\nccc\n';
    const generated = 'aaa\nBBB\nccc\n';
    const diff = computeDiff(committed, generated);
    expect(diff).toContain('line 2:');
    expect(diff).toContain('  - bbb');
    expect(diff).toContain('  + BBB');
  });

  it('detects added lines at the end', () => {
    const committed = 'aaa\n';
    const generated = 'aaa\nbbb\n';
    const diff = computeDiff(committed, generated);
    expect(diff).toContain('line 2:');
    expect(diff).toContain('  + bbb');
  });

  it('detects removed lines at the end', () => {
    const committed = 'aaa\nbbb\n';
    const generated = 'aaa\n';
    const diff = computeDiff(committed, generated);
    expect(diff).toContain('line 2:');
    expect(diff).toContain('  - bbb');
  });

  it('handles completely different content', () => {
    const committed = 'old1\nold2\n';
    const generated = 'new1\nnew2\nnew3\n';
    const diff = computeDiff(committed, generated);
    expect(diff).toContain('line 1:');
    expect(diff).toContain('line 2:');
    expect(diff).toContain('line 3:');
  });

  it('handles empty strings on both sides', () => {
    expect(computeDiff('', '')).toBe('');
  });

  it('handles empty committed, non-empty generated', () => {
    const diff = computeDiff('', 'new\n');
    expect(diff).toContain('line 1:');
    expect(diff).toContain('  + new');
  });
});

// ---------------------------------------------------------------------------
// formatDriftResult
// ---------------------------------------------------------------------------

describe('formatDriftResult', () => {
  it('outputs success message when not drifted', () => {
    const result: DriftCheckResult = {
      drifted: false,
      diff: '',
      generatedContent: 'content\n',
      committedContent: 'content\n',
    };
    const output = formatDriftResult(result);
    expect(output).toContain('passed');
    expect(output).toContain('up-to-date');
  });

  it('outputs failure message with diff when drifted', () => {
    const result: DriftCheckResult = {
      drifted: true,
      diff: 'line 1:\n  - old\n  + new',
      generatedContent: 'new\n',
      committedContent: 'old\n',
    };
    const output = formatDriftResult(result);
    expect(output).toContain('FAILED');
    expect(output).toContain('drifted');
    expect(output).toContain('npm run types:generate');
    expect(output).toContain('Diff:');
    expect(output).toContain('  - old');
    expect(output).toContain('  + new');
  });

  it('includes regeneration instructions in failure', () => {
    const result: DriftCheckResult = {
      drifted: true,
      diff: 'some diff',
      generatedContent: '',
      committedContent: '',
    };
    const output = formatDriftResult(result);
    expect(output).toContain('npm run types:generate');
    expect(output).toContain('commit the result');
  });

  it('does not include diff section for passing result', () => {
    const result: DriftCheckResult = {
      drifted: false,
      diff: '',
      generatedContent: 'x\n',
      committedContent: 'x\n',
    };
    const output = formatDriftResult(result);
    expect(output).not.toContain('Diff:');
  });
});

// ---------------------------------------------------------------------------
// parseArgs
// ---------------------------------------------------------------------------

describe('parseArgs', () => {
  it('parses --project-root flag', () => {
    const result = parseArgs(['--project-root=/tmp/myproject']);
    expect(result.projectRoot).toBe('/tmp/myproject');
  });

  it('returns undefined projectRoot when flag is absent', () => {
    const result = parseArgs(['--other=value']);
    expect(result.projectRoot).toBeUndefined();
  });

  it('returns undefined projectRoot for empty args', () => {
    const result = parseArgs([]);
    expect(result.projectRoot).toBeUndefined();
  });

  it('handles relative paths', () => {
    const result = parseArgs(['--project-root=./relative/path']);
    expect(result.projectRoot).toBe('./relative/path');
  });

  it('uses the first match when multiple --project-root flags exist', () => {
    const result = parseArgs(['--project-root=/first', '--project-root=/second']);
    expect(result.projectRoot).toBe('/first');
  });
});

// ---------------------------------------------------------------------------
// readCommittedTypes — integration (reads real filesystem)
// ---------------------------------------------------------------------------

describe('readCommittedTypes', () => {
  it('returns file content for the real project root', () => {
    const projectRoot = process.cwd();
    const content = readCommittedTypes(projectRoot);
    // The real file should exist and contain the auto-generated header
    expect(content).not.toBeNull();
    expect(content).toContain('AUTO-GENERATED');
    expect(content).toContain("from './schema'");
  });

  it('returns null for a nonexistent project root', () => {
    const content = readCommittedTypes('/tmp/__nonexistent_protopulse_project__');
    expect(content).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// checkApiTypes — integration (actually runs the generator)
// ---------------------------------------------------------------------------

describe('checkApiTypes', () => {
  it('reports no drift for the current project state', () => {
    const projectRoot = process.cwd();
    const result = checkApiTypes(projectRoot);
    expect(result.drifted).toBe(false);
    expect(result.diff).toBe('');
    expect(result.committedContent.length).toBeGreaterThan(0);
    expect(result.generatedContent.length).toBeGreaterThan(0);
  }, 30_000);

  it('reports drift when committed file is missing', () => {
    const result = checkApiTypes('/tmp/__nonexistent_protopulse_project__');
    expect(result.drifted).toBe(true);
    expect(result.diff).toContain('does not exist');
  });

  it('does not dirty the working tree after running', () => {
    const { readFileSync } = require('node:fs') as typeof import('node:fs');
    const { resolve } = require('node:path') as typeof import('node:path');
    const projectRoot = process.cwd();
    const filePath = resolve(projectRoot, 'shared', 'api-types.generated.ts');

    const before = readFileSync(filePath, 'utf-8');
    checkApiTypes(projectRoot);
    const after = readFileSync(filePath, 'utf-8');

    expect(after).toBe(before);
  }, 30_000);
});

// ---------------------------------------------------------------------------
// DriftCheckResult shape
// ---------------------------------------------------------------------------

describe('DriftCheckResult shape', () => {
  it('has all required fields for a passing result', () => {
    const result: DriftCheckResult = {
      drifted: false,
      diff: '',
      generatedContent: 'content\n',
      committedContent: 'content\n',
    };
    expect(result).toHaveProperty('drifted');
    expect(result).toHaveProperty('diff');
    expect(result).toHaveProperty('generatedContent');
    expect(result).toHaveProperty('committedContent');
  });

  it('has all required fields for a failing result', () => {
    const result: DriftCheckResult = {
      drifted: true,
      diff: 'some diff',
      generatedContent: 'new\n',
      committedContent: 'old\n',
    };
    expect(typeof result.drifted).toBe('boolean');
    expect(typeof result.diff).toBe('string');
    expect(typeof result.generatedContent).toBe('string');
    expect(typeof result.committedContent).toBe('string');
  });
});
