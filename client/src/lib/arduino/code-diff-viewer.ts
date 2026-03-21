// ──────────────────────────────────────────────────────────────────
// BL-0401 — Round-Trip Diff Viewer (ProtoPulse vs IDE)
// ──────────────────────────────────────────────────────────────────
// LCS-based line diff algorithm, hunk grouping with context,
// similarity score, comment/whitespace stripping, unified diff
// output, conflict detection.
// ──────────────────────────────────────────────────────────────────

// ─── Types ───────────────────────────────────────────────────────

export type DiffLineType = 'context' | 'add' | 'remove';

export interface DiffLine {
  type: DiffLineType;
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
}

export interface DiffResult {
  hunks: DiffHunk[];
  oldLineCount: number;
  newLineCount: number;
  addedLines: number;
  removedLines: number;
  contextLines: number;
  similarityScore: number;
  hasConflicts: boolean;
  conflicts: ConflictRegion[];
}

export interface ConflictRegion {
  startLine: number;
  endLine: number;
  description: string;
  oldContent: string[];
  newContent: string[];
}

export interface DiffOptions {
  contextLines?: number;
  ignoreWhitespace?: boolean;
  ignoreComments?: boolean;
  ignoreBlankLines?: boolean;
}

// ─── Text Preprocessing ─────────────────────────────────────────

/**
 * Strip C/C++ single-line and multi-line comments from code.
 */
export function stripCComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

/**
 * Normalize whitespace: trim lines and collapse internal runs.
 */
export function normalizeWhitespace(line: string): string {
  return line.trim().replace(/\s+/g, ' ');
}

/**
 * Preprocess lines based on diff options.
 */
export function preprocessLines(lines: string[], options: DiffOptions): string[] {
  let result = [...lines];

  if (options.ignoreComments) {
    const joined = result.join('\n');
    result = stripCComments(joined).split('\n');
  }

  if (options.ignoreWhitespace) {
    result = result.map((l) => normalizeWhitespace(l));
  }

  if (options.ignoreBlankLines) {
    result = result.filter((l) => l.trim() !== '');
  }

  return result;
}

// ─── LCS Algorithm ───────────────────────────────────────────────

/**
 * Compute the Longest Common Subsequence table.
 * Returns a 2D array where lcs[i][j] is the LCS length of
 * oldLines[0..i-1] and newLines[0..j-1].
 */
export function computeLcsTable(oldLines: string[], newLines: string[]): number[][] {
  const m = oldLines.length;
  const n = newLines.length;

  // Allocate table
  const table: number[][] = [];
  for (let i = 0; i <= m; i++) {
    table[i] = new Array<number>(n + 1).fill(0);
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        table[i][j] = table[i - 1][j - 1] + 1;
      } else {
        table[i][j] = Math.max(table[i - 1][j], table[i][j - 1]);
      }
    }
  }

  return table;
}

/**
 * Backtrack through the LCS table to produce diff lines.
 */
export function backtrackLcs(
  oldLines: string[],
  newLines: string[],
  table: number[][],
): DiffLine[] {
  const result: DiffLine[] = [];
  let i = oldLines.length;
  let j = newLines.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.push({
        type: 'context',
        content: oldLines[i - 1],
        oldLineNumber: i,
        newLineNumber: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || table[i][j - 1] >= table[i - 1][j])) {
      result.push({
        type: 'add',
        content: newLines[j - 1],
        newLineNumber: j,
      });
      j--;
    } else {
      result.push({
        type: 'remove',
        content: oldLines[i - 1],
        oldLineNumber: i,
      });
      i--;
    }
  }

  return result.reverse();
}

// ─── Hunk Grouping ───────────────────────────────────────────────

/**
 * Group diff lines into hunks with surrounding context.
 */
export function groupIntoHunks(diffLines: DiffLine[], contextSize: number): DiffHunk[] {
  if (diffLines.length === 0) {
    return [];
  }

  // Find indices of changed lines
  const changedIndices: number[] = [];
  diffLines.forEach((line, idx) => {
    if (line.type !== 'context') {
      changedIndices.push(idx);
    }
  });

  if (changedIndices.length === 0) {
    return [];
  }

  // Build ranges with context
  const ranges: Array<{ start: number; end: number }> = [];
  changedIndices.forEach((idx) => {
    const start = Math.max(0, idx - contextSize);
    const end = Math.min(diffLines.length - 1, idx + contextSize);

    if (ranges.length > 0 && start <= ranges[ranges.length - 1].end + 1) {
      // Merge with previous range
      ranges[ranges.length - 1].end = end;
    } else {
      ranges.push({ start, end });
    }
  });

  // Convert ranges to hunks
  return ranges.map((range) => {
    const hunkLines = diffLines.slice(range.start, range.end + 1);

    // Calculate old/new start and count
    let oldStart = 0;
    let oldCount = 0;
    let newStart = 0;
    let newCount = 0;
    let foundOldStart = false;
    let foundNewStart = false;

    hunkLines.forEach((line) => {
      if (line.type === 'context' || line.type === 'remove') {
        if (!foundOldStart && line.oldLineNumber !== undefined) {
          oldStart = line.oldLineNumber;
          foundOldStart = true;
        }
        oldCount++;
      }
      if (line.type === 'context' || line.type === 'add') {
        if (!foundNewStart && line.newLineNumber !== undefined) {
          newStart = line.newLineNumber;
          foundNewStart = true;
        }
        newCount++;
      }
    });

    // Fallback: derive from first available line numbers
    if (!foundOldStart) {
      const firstWithOld = hunkLines.find((l) => l.oldLineNumber !== undefined);
      oldStart = firstWithOld?.oldLineNumber ?? 1;
    }
    if (!foundNewStart) {
      const firstWithNew = hunkLines.find((l) => l.newLineNumber !== undefined);
      newStart = firstWithNew?.newLineNumber ?? 1;
    }

    return {
      oldStart,
      oldCount,
      newStart,
      newCount,
      lines: hunkLines,
    };
  });
}

// ─── Similarity Score ────────────────────────────────────────────

/**
 * Compute a similarity score (0-1) between two texts.
 * 1.0 = identical, 0.0 = completely different.
 * Based on the ratio of LCS length to the average of old+new line counts.
 */
export function computeSimilarity(oldLines: string[], newLines: string[]): number {
  if (oldLines.length === 0 && newLines.length === 0) {
    return 1.0;
  }
  if (oldLines.length === 0 || newLines.length === 0) {
    return 0.0;
  }

  const table = computeLcsTable(oldLines, newLines);
  const lcsLength = table[oldLines.length][newLines.length];
  const maxLen = Math.max(oldLines.length, newLines.length);

  return lcsLength / maxLen;
}

// ─── Conflict Detection ─────────────────────────────────────────

/**
 * Detect "conflict regions" — areas with significant adjacent
 * additions and removals that indicate potentially conflicting edits.
 * A conflict is 3+ adjacent remove lines followed/preceded by 3+ add lines.
 */
export function detectConflicts(diffLines: DiffLine[], threshold: number = 3): ConflictRegion[] {
  const conflicts: ConflictRegion[] = [];
  let i = 0;

  while (i < diffLines.length) {
    // Look for a run of removes
    const removeStart = i;
    const removeContent: string[] = [];
    while (i < diffLines.length && diffLines[i].type === 'remove') {
      removeContent.push(diffLines[i].content);
      i++;
    }

    // Look for immediate run of adds
    const addContent: string[] = [];
    while (i < diffLines.length && diffLines[i].type === 'add') {
      addContent.push(diffLines[i].content);
      i++;
    }

    // If both runs meet threshold, it's a conflict
    if (removeContent.length >= threshold && addContent.length >= threshold) {
      const startLine = diffLines[removeStart].oldLineNumber ?? removeStart + 1;
      conflicts.push({
        startLine,
        endLine: startLine + removeContent.length - 1,
        description: `Significant divergence: ${removeContent.length} lines removed, ${addContent.length} lines added.`,
        oldContent: removeContent,
        newContent: addContent,
      });
    } else if (diffLines[i - 1]?.type === 'add' || diffLines[i - 1]?.type === 'remove') {
      // Continue scanning
    }

    // Skip context lines
    if (i < diffLines.length && diffLines[i].type === 'context') {
      i++;
    }
  }

  return conflicts;
}

// ─── Unified Diff Output ─────────────────────────────────────────

/**
 * Generate unified diff format output string.
 */
export function formatUnifiedDiff(
  hunks: DiffHunk[],
  oldFileName: string = 'a/file',
  newFileName: string = 'b/file',
): string {
  if (hunks.length === 0) {
    return '';
  }

  const lines: string[] = [];
  lines.push(`--- ${oldFileName}`);
  lines.push(`+++ ${newFileName}`);

  hunks.forEach((hunk) => {
    lines.push(`@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`);
    hunk.lines.forEach((line) => {
      switch (line.type) {
        case 'context':
          lines.push(` ${line.content}`);
          break;
        case 'add':
          lines.push(`+${line.content}`);
          break;
        case 'remove':
          lines.push(`-${line.content}`);
          break;
      }
    });
  });

  return lines.join('\n');
}

// ─── Main Diff Function ─────────────────────────────────────────

/**
 * Compute a full diff between two code strings.
 */
export function computeDiff(oldCode: string, newCode: string, options?: DiffOptions): DiffResult {
  const opts: DiffOptions = {
    contextLines: 3,
    ignoreWhitespace: false,
    ignoreComments: false,
    ignoreBlankLines: false,
    ...options,
  };

  const rawOldLines = oldCode.split('\n');
  const rawNewLines = newCode.split('\n');

  // Preprocess for comparison
  const compareOld = preprocessLines(rawOldLines, opts);
  const compareNew = preprocessLines(rawNewLines, opts);

  // Compute LCS and diff
  const table = computeLcsTable(compareOld, compareNew);
  const diffLines = backtrackLcs(compareOld, compareNew, table);

  // Group into hunks
  const hunks = groupIntoHunks(diffLines, opts.contextLines ?? 3);

  // Count changes
  let addedLines = 0;
  let removedLines = 0;
  let contextLines = 0;
  diffLines.forEach((line) => {
    switch (line.type) {
      case 'add':
        addedLines++;
        break;
      case 'remove':
        removedLines++;
        break;
      case 'context':
        contextLines++;
        break;
    }
  });

  // Compute similarity
  const similarityScore = computeSimilarity(compareOld, compareNew);

  // Detect conflicts
  const conflicts = detectConflicts(diffLines);

  return {
    hunks,
    oldLineCount: rawOldLines.length,
    newLineCount: rawNewLines.length,
    addedLines,
    removedLines,
    contextLines,
    similarityScore,
    hasConflicts: conflicts.length > 0,
    conflicts,
  };
}

// ─── Parse Unified Diff ──────────────────────────────────────────

/**
 * Parse a unified diff string back into hunks.
 */
export function parseUnifiedDiff(diff: string): DiffHunk[] {
  const lines = diff.split('\n');
  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;

  const hunkHeaderRe = /^@@ -(\d+),(\d+) \+(\d+),(\d+) @@/;

  let oldLine = 0;
  let newLine = 0;

  lines.forEach((line) => {
    const headerMatch = hunkHeaderRe.exec(line);
    if (headerMatch) {
      if (currentHunk) {
        hunks.push(currentHunk);
      }
      oldLine = parseInt(headerMatch[1], 10);
      newLine = parseInt(headerMatch[3], 10);
      currentHunk = {
        oldStart: oldLine,
        oldCount: parseInt(headerMatch[2], 10),
        newStart: newLine,
        newCount: parseInt(headerMatch[4], 10),
        lines: [],
      };
      return;
    }

    if (!currentHunk) {
      return;
    }

    if (line.startsWith('+')) {
      currentHunk.lines.push({
        type: 'add',
        content: line.substring(1),
        newLineNumber: newLine++,
      });
    } else if (line.startsWith('-')) {
      currentHunk.lines.push({
        type: 'remove',
        content: line.substring(1),
        oldLineNumber: oldLine++,
      });
    } else if (line.startsWith(' ')) {
      currentHunk.lines.push({
        type: 'context',
        content: line.substring(1),
        oldLineNumber: oldLine++,
        newLineNumber: newLine++,
      });
    }
  });

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return hunks;
}

// ─── Apply / Reverse Diff ────────────────────────────────────────

/**
 * Apply hunks to the old text to produce the new text.
 */
export function applyDiff(oldCode: string, hunks: DiffHunk[]): string {
  const oldLines = oldCode.split('\n');
  const result: string[] = [];
  let oldIdx = 0;

  hunks.forEach((hunk) => {
    // Copy context lines before this hunk
    while (oldIdx < hunk.oldStart - 1) {
      result.push(oldLines[oldIdx]);
      oldIdx++;
    }

    // Process hunk lines
    hunk.lines.forEach((line) => {
      switch (line.type) {
        case 'context':
          result.push(line.content);
          oldIdx++;
          break;
        case 'add':
          result.push(line.content);
          break;
        case 'remove':
          oldIdx++;
          break;
      }
    });
  });

  // Copy remaining lines
  while (oldIdx < oldLines.length) {
    result.push(oldLines[oldIdx]);
    oldIdx++;
  }

  return result.join('\n');
}

/**
 * Reverse a diff: swap adds and removes.
 */
export function reverseDiff(hunks: DiffHunk[]): DiffHunk[] {
  return hunks.map((hunk) => ({
    oldStart: hunk.newStart,
    oldCount: hunk.newCount,
    newStart: hunk.oldStart,
    newCount: hunk.oldCount,
    lines: hunk.lines.map((line) => {
      switch (line.type) {
        case 'add':
          return {
            type: 'remove' as const,
            content: line.content,
            oldLineNumber: line.newLineNumber,
          };
        case 'remove':
          return {
            type: 'add' as const,
            content: line.content,
            newLineNumber: line.oldLineNumber,
          };
        case 'context':
          return {
            type: 'context' as const,
            content: line.content,
            oldLineNumber: line.newLineNumber,
            newLineNumber: line.oldLineNumber,
          };
      }
    }),
  }));
}

// ─── Summary Helpers ─────────────────────────────────────────────

/**
 * Generate a human-readable diff summary.
 */
export function diffSummary(result: DiffResult): string {
  const parts: string[] = [];

  if (result.addedLines === 0 && result.removedLines === 0) {
    return 'Files are identical.';
  }

  if (result.addedLines > 0) {
    parts.push(`${result.addedLines} line${result.addedLines === 1 ? '' : 's'} added`);
  }
  if (result.removedLines > 0) {
    parts.push(`${result.removedLines} line${result.removedLines === 1 ? '' : 's'} removed`);
  }

  const pct = Math.round(result.similarityScore * 100);
  parts.push(`${pct}% similar`);

  if (result.hasConflicts) {
    parts.push(`${result.conflicts.length} conflict${result.conflicts.length === 1 ? '' : 's'} detected`);
  }

  return parts.join(', ') + '.';
}
