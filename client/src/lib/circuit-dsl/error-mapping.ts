/**
 * Maps evaluation errors and ERC warnings to CodeMirror diagnostics.
 *
 * Severity rules:
 * - SyntaxError / TypeError / ReferenceError → 'error'
 * - Everything else (runtime warnings, ERC violations) → 'warning'
 */

import type { Diagnostic } from '@codemirror/lint';

export interface EvalError {
  message: string;
  line?: number;
}

/** Error prefixes that indicate hard errors (not warnings). */
const ERROR_PREFIXES = ['SyntaxError:', 'TypeError:', 'ReferenceError:'];

function classifySeverity(message: string): 'error' | 'warning' {
  for (const prefix of ERROR_PREFIXES) {
    if (message.startsWith(prefix)) {
      return 'error';
    }
  }
  return 'warning';
}

/**
 * Compute the character offset range for a 1-based line number in `docText`.
 * Returns `{ from, to }` representing the start and end of the line content
 * (excluding the trailing newline).
 */
function lineRange(lineNum: number, docText: string): { from: number; to: number } {
  const lines = docText.split('\n');
  const totalLines = lines.length;
  const clamped = Math.max(1, Math.min(lineNum, totalLines));

  let from = 0;
  for (let i = 0; i < clamped - 1; i++) {
    // +1 for the '\n' delimiter
    from += lines[i].length + 1;
  }
  const to = from + lines[clamped - 1].length;

  return { from, to };
}

/**
 * Convert a single evaluation error to a CodeMirror Diagnostic.
 */
export function evalErrorToDiagnostic(error: EvalError, docText: string): Diagnostic {
  const targetLine = error.line ?? 1;
  const { from, to } = lineRange(targetLine, docText);

  return {
    from,
    to,
    severity: classifySeverity(error.message),
    message: error.message,
  };
}

/**
 * Convert an array of evaluation errors to CodeMirror Diagnostics.
 */
export function evalErrorsToDiagnostics(errors: EvalError[], docText: string): Diagnostic[] {
  return errors.map((e) => evalErrorToDiagnostic(e, docText));
}
