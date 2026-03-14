// ---------------------------------------------------------------------------
// Arduino Code Formatter
// ---------------------------------------------------------------------------
// Pure TypeScript C/C++ code formatter for Arduino sketches.
// No external dependencies — implements basic structural formatting:
//   - Indentation based on brace/paren nesting
//   - Operator spacing normalization
//   - Preprocessor directives at column 0
//   - Blank line normalization
//   - String and comment preservation
//
// Designed to match Arduino IDE's Ctrl+T (Auto Format) behavior.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FormatOptions {
  /** Number of spaces per indent level. Default: 2. */
  indentWidth?: 2 | 4;
  /** Brace style: 'kr' = K&R (same line), 'allman' = Allman (new line). Default: 'kr'. */
  braceStyle?: 'allman' | 'kr';
  /** Maximum consecutive blank lines. Default: 2. */
  maxBlankLines?: number;
}

const DEFAULT_OPTIONS: Required<FormatOptions> = {
  indentWidth: 2,
  braceStyle: 'kr',
  maxBlankLines: 2,
};

// ---------------------------------------------------------------------------
// Token types for string/comment preservation
// ---------------------------------------------------------------------------

interface CodeSegment {
  type: 'code' | 'string' | 'char' | 'line_comment' | 'block_comment';
  value: string;
}

/**
 * Tokenize code into segments, preserving strings and comments literally.
 * This prevents the formatter from modifying content inside strings/comments.
 */
function tokenize(code: string): CodeSegment[] {
  const segments: CodeSegment[] = [];
  let i = 0;
  let codeBuffer = '';

  const flush = () => {
    if (codeBuffer.length > 0) {
      segments.push({ type: 'code', value: codeBuffer });
      codeBuffer = '';
    }
  };

  while (i < code.length) {
    // Line comment
    if (code[i] === '/' && code[i + 1] === '/') {
      flush();
      let end = i + 2;
      while (end < code.length && code[end] !== '\n') {
        end++;
      }
      segments.push({ type: 'line_comment', value: code.slice(i, end) });
      i = end;
      continue;
    }

    // Block comment
    if (code[i] === '/' && code[i + 1] === '*') {
      flush();
      let end = i + 2;
      while (end < code.length - 1 && !(code[end] === '*' && code[end + 1] === '/')) {
        end++;
      }
      end += 2; // consume */
      segments.push({ type: 'block_comment', value: code.slice(i, Math.min(end, code.length)) });
      i = Math.min(end, code.length);
      continue;
    }

    // String literal (double quotes)
    if (code[i] === '"') {
      flush();
      let end = i + 1;
      while (end < code.length && code[end] !== '"') {
        if (code[end] === '\\') {
          end++; // skip escaped char
        }
        end++;
      }
      end++; // consume closing quote
      segments.push({ type: 'string', value: code.slice(i, Math.min(end, code.length)) });
      i = Math.min(end, code.length);
      continue;
    }

    // Character literal (single quotes)
    if (code[i] === '\'') {
      flush();
      let end = i + 1;
      while (end < code.length && code[end] !== '\'') {
        if (code[end] === '\\') {
          end++; // skip escaped char
        }
        end++;
      }
      end++; // consume closing quote
      segments.push({ type: 'char', value: code.slice(i, Math.min(end, code.length)) });
      i = Math.min(end, code.length);
      continue;
    }

    codeBuffer += code[i];
    i++;
  }

  flush();
  return segments;
}

/**
 * Reconstruct a line from its segments back into a string.
 */
function segmentsToString(segments: CodeSegment[]): string {
  return segments.map(s => s.value).join('');
}

/**
 * Extract only the code segments (not strings/comments) from a line,
 * to safely analyze structure without being confused by content inside
 * strings or comments.
 */
function codeOnly(segments: CodeSegment[]): string {
  return segments
    .filter(s => s.type === 'code')
    .map(s => s.value)
    .join('');
}

// ---------------------------------------------------------------------------
// Operator spacing
// ---------------------------------------------------------------------------

/**
 * Normalize spacing around operators in code segments only.
 * Preserves strings and comments exactly as-is.
 */
function normalizeOperators(segments: CodeSegment[]): CodeSegment[] {
  return segments.map(seg => {
    if (seg.type !== 'code') {
      return seg;
    }

    let s = seg.value;

    // Assignment operators: +=, -=, *=, /=, %=, &=, |=, ^=, <<=, >>=
    // Must be done before single = to avoid double-replacing
    s = s.replace(/\s*(<<|>>)=\s*/g, ' $1= ');
    s = s.replace(/\s*([+\-*/%&|^])=\s*/g, ' $1= ');

    // Comparison/logical: ==, !=, <=, >=, &&, ||, <<, >>
    s = s.replace(/\s*(==|!=|<=|>=|&&|\|\||<<|>>)\s*/g, ' $1 ');

    // Single = (but not == or !=, <=, >=, +=, etc.)
    // Use lookbehind/lookahead to avoid double-spacing already-spaced compound ops
    s = s.replace(/(?<![=!<>+\-*/%&|^])=(?!=)/g, ' = ');

    // Binary +, -, but not unary (e.g. i++ or -5 or ->)
    // Only add space around + or - when surrounded by word chars or parens/digits
    s = s.replace(/(\w)\+(?!\+)(\w)/g, '$1 + $2');
    s = s.replace(/(\w)-(?!-)(?!>)(\w)/g, '$1 - $2');

    // Comma: ensure space after, remove space before
    s = s.replace(/\s*,\s*/g, ', ');

    // Semicolons inside for-loops: space after
    // (Don't touch end-of-statement semicolons — they're fine as-is)
    s = s.replace(/;\s*(?=\S)/g, '; ');

    // Clean up multiple spaces (but not at start of line — that's indentation)
    s = s.replace(/(?<=\S) {2,}/g, ' ');

    return { ...seg, value: s };
  });
}

// ---------------------------------------------------------------------------
// Preprocessor detection
// ---------------------------------------------------------------------------

function isPreprocessorDirective(trimmedLine: string): boolean {
  return /^#\s*(?:include|define|undef|if|ifdef|ifndef|elif|else|endif|pragma|error|warning|line)\b/.test(trimmedLine);
}

// ---------------------------------------------------------------------------
// Main formatter
// ---------------------------------------------------------------------------

/**
 * Format Arduino/C/C++ source code.
 *
 * The formatter:
 * 1. Preserves string literals and comments exactly as-is
 * 2. Fixes indentation based on brace nesting depth
 * 3. Normalizes operator spacing (within code only)
 * 4. Places preprocessor directives at column 0
 * 5. Limits consecutive blank lines
 * 6. Handles K&R and Allman brace styles
 */
export function formatArduinoCode(code: string, options?: FormatOptions): string {
  const opts: Required<FormatOptions> = { ...DEFAULT_OPTIONS, ...options };
  const indent = ' '.repeat(opts.indentWidth);

  // Split into lines, preserving original newlines
  const rawLines = code.split('\n');

  // Phase 1: Tokenize each line to preserve strings/comments
  const tokenizedLines = rawLines.map(line => tokenize(line));

  // Phase 2: Normalize operator spacing (only in code segments)
  const spacedLines = tokenizedLines.map(segments => normalizeOperators(segments));

  // Phase 3: Reconstruct lines and apply structural formatting
  const formattedLines: string[] = [];
  let depth = 0;
  let consecutiveBlankLines = 0;
  let inBlockComment = false;

  for (let lineIdx = 0; lineIdx < spacedLines.length; lineIdx++) {
    // When inside a multi-line block comment, use the RAW line (not the
    // tokenized/operator-normalized version) so comment content is preserved
    // exactly as written.
    if (inBlockComment) {
      const rawLine = rawLines[lineIdx].trim();
      const commentIndent = indent.repeat(Math.max(0, depth));
      if (rawLine.includes('*/')) {
        inBlockComment = false;
      }
      formattedLines.push(commentIndent + ' ' + rawLine);
      consecutiveBlankLines = 0;
      continue;
    }

    const segments = spacedLines[lineIdx];
    let line = segmentsToString(segments).trim();

    // Check if a block comment starts and doesn't end on this line
    const codeStr = codeOnly(segments);
    const hasBlockStart = codeStr.includes('/*') || segments.some(s => s.type === 'block_comment');
    if (hasBlockStart) {
      const fullLine = segmentsToString(segments);
      if (fullLine.includes('/*') && !fullLine.includes('*/')) {
        inBlockComment = true;
      }
    }

    // Blank line handling
    if (line.length === 0) {
      consecutiveBlankLines++;
      if (consecutiveBlankLines <= opts.maxBlankLines) {
        formattedLines.push('');
      }
      continue;
    }
    consecutiveBlankLines = 0;

    // Preprocessor directives — always at column 0
    if (isPreprocessorDirective(line)) {
      formattedLines.push(line);
      continue;
    }

    // Allman style: if line is just '{', it goes on its own line at current depth
    // K&R style: opening brace stays on the same line as the statement

    // Count braces in code-only (not strings/comments) to adjust depth
    const codeContent = codeOnly(segments);
    const openBraces = (codeContent.match(/\{/g) ?? []).length;
    const closeBraces = (codeContent.match(/\}/g) ?? []).length;

    // Decrease depth BEFORE indenting if line starts with }
    if (codeContent.trimStart().startsWith('}')) {
      depth = Math.max(0, depth - closeBraces);
      const currentIndent = indent.repeat(depth);

      // Handle Allman style: if we have '} else {' or similar
      if (opts.braceStyle === 'allman') {
        // Split "} else {" into separate lines
        const elseMatch = line.match(/^}\s*(else\s*(?:if\s*\(.*?\))?\s*)\{$/);
        if (elseMatch) {
          formattedLines.push(currentIndent + '}');
          formattedLines.push(currentIndent + elseMatch[1].trim());
          formattedLines.push(currentIndent + '{');
          depth += 1; // opening brace on the else
          continue;
        }
      }

      formattedLines.push(currentIndent + line);
      // If line also has opening braces (like "} else {"), increase depth after.
      // We already subtracted closeBraces above, so just add back openBraces.
      if (openBraces > 0) {
        depth += openBraces;
      }
    } else {
      // Line does NOT start with }
      const currentIndent = indent.repeat(depth);

      if (opts.braceStyle === 'allman' && line.endsWith('{') && !line.startsWith('{')) {
        // Allman: split "void setup() {" into "void setup()" and "{"
        const withoutBrace = line.slice(0, -1).trimEnd();
        if (withoutBrace.length > 0) {
          formattedLines.push(currentIndent + withoutBrace);
          formattedLines.push(currentIndent + '{');
        } else {
          formattedLines.push(currentIndent + '{');
        }
        depth += openBraces - closeBraces;
      } else {
        formattedLines.push(currentIndent + line);
        depth += openBraces - closeBraces;
      }
    }

    // Safety: depth should never go negative
    depth = Math.max(0, depth);
  }

  // Remove trailing blank lines (keep at most 1)
  while (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] === '') {
    formattedLines.pop();
  }

  // Ensure file ends with a single newline
  return formattedLines.join('\n') + '\n';
}
