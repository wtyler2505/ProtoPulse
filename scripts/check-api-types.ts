import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Core logic — exported for testing
// ---------------------------------------------------------------------------

/**
 * Regenerates `shared/api-types.generated.ts` by running the generator
 * script, then compares the result to the committed version.
 *
 * Exit codes:
 *   0 — types are up-to-date
 *   1 — drift detected (committed file differs from freshly generated)
 *   2 — infrastructure error (missing files, generator failure, etc.)
 */

export interface DriftCheckResult {
  drifted: boolean;
  diff: string;
  generatedContent: string;
  committedContent: string;
}

/**
 * Reads the committed api-types file from disk.
 * Returns null if the file does not exist.
 */
export function readCommittedTypes(projectRoot: string): string | null {
  const filePath = resolve(projectRoot, 'shared', 'api-types.generated.ts');
  if (!existsSync(filePath)) {
    return null;
  }
  return readFileSync(filePath, 'utf-8');
}

/**
 * Runs the generator script and captures the freshly generated content.
 * The generator writes to `shared/api-types.generated.ts` in-place,
 * so we snapshot before, run, read the new version, then restore the original.
 */
export function regenerateTypes(projectRoot: string): string {
  const filePath = resolve(projectRoot, 'shared', 'api-types.generated.ts');
  const original = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : null;

  try {
    execSync('npx tsx script/generate-api-types.ts', {
      cwd: projectRoot,
      stdio: 'pipe',
      timeout: 30_000,
    });

    if (!existsSync(filePath)) {
      throw new Error('Generator did not produce shared/api-types.generated.ts');
    }

    return readFileSync(filePath, 'utf-8');
  } finally {
    // Restore the original committed content so the working tree is not dirtied
    if (original !== null) {
      const { writeFileSync } = require('node:fs') as typeof import('node:fs');
      writeFileSync(filePath, original, 'utf-8');
    }
  }
}

/**
 * Normalizes content for comparison: trims trailing whitespace per line
 * and ensures a single trailing newline. This avoids false positives from
 * insignificant whitespace differences.
 */
export function normalizeContent(content: string): string {
  return (
    content
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n')
      .trimEnd() + '\n'
  );
}

/**
 * Produces a unified-diff-style summary of the differences between
 * committed and generated content. Returns an empty string if equal.
 */
export function computeDiff(committed: string, generated: string): string {
  const commitLines = committed.split('\n');
  const genLines = generated.split('\n');

  const diffLines: string[] = [];
  const maxLen = Math.max(commitLines.length, genLines.length);

  for (let i = 0; i < maxLen; i++) {
    const cl = commitLines[i] ?? '';
    const gl = genLines[i] ?? '';
    if (cl !== gl) {
      diffLines.push(`line ${String(i + 1)}:`);
      if (i < commitLines.length) {
        diffLines.push(`  - ${cl}`);
      }
      if (i < genLines.length) {
        diffLines.push(`  + ${gl}`);
      }
    }
  }

  return diffLines.join('\n');
}

/**
 * Performs the full drift check: regenerate, compare, produce diff.
 */
export function checkApiTypes(projectRoot: string): DriftCheckResult {
  const committed = readCommittedTypes(projectRoot);
  if (committed === null) {
    return {
      drifted: true,
      diff: 'shared/api-types.generated.ts does not exist — run `npm run types:generate` first',
      generatedContent: '',
      committedContent: '',
    };
  }

  const generated = regenerateTypes(projectRoot);

  const normalizedCommitted = normalizeContent(committed);
  const normalizedGenerated = normalizeContent(generated);

  const drifted = normalizedCommitted !== normalizedGenerated;
  const diff = drifted ? computeDiff(normalizedCommitted, normalizedGenerated) : '';

  return {
    drifted,
    diff,
    generatedContent: normalizedGenerated,
    committedContent: normalizedCommitted,
  };
}

/**
 * Formats a DriftCheckResult into human-readable CI output.
 */
export function formatDriftResult(result: DriftCheckResult): string {
  if (!result.drifted) {
    return 'API types check passed — shared/api-types.generated.ts is up-to-date.';
  }

  const lines = [
    'API types check FAILED — shared/api-types.generated.ts has drifted.',
    '',
    'The committed file does not match what `npm run types:generate` produces.',
    'Run `npm run types:generate` and commit the result.',
    '',
    'Diff:',
    result.diff,
  ];

  return lines.join('\n');
}

/**
 * Parses CLI arguments. Accepts `--project-root=<path>`.
 */
export function parseArgs(args: string[]): { projectRoot: string | undefined } {
  for (const arg of args) {
    const match = /^--project-root=(.+)$/.exec(arg);
    if (match) {
      return { projectRoot: match[1] };
    }
  }
  return { projectRoot: undefined };
}

// ---------------------------------------------------------------------------
// Main — runs when executed directly
// ---------------------------------------------------------------------------

function main(): void {
  const args = process.argv.slice(2);
  const { projectRoot: rootArg } = parseArgs(args);
  const projectRoot = rootArg ? resolve(rootArg) : process.cwd();

  let result: DriftCheckResult;
  try {
    result = checkApiTypes(projectRoot);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`API types check failed with error: ${message}`);
    process.exit(2);
  }

  console.log(formatDriftResult(result));

  if (result.drifted) {
    process.exit(1);
  }
}

const isDirectExecution = process.argv[1]?.endsWith('check-api-types.ts') ?? false;
if (isDirectExecution) {
  main();
}
