import { describe, it, expect } from 'vitest';
import {
  evalErrorToDiagnostic,
  evalErrorsToDiagnostics,
} from '../error-mapping';
import type { EvalError } from '../error-mapping';

describe('error-mapping', () => {
  // ---------------------------------------------------------------------------
  // evalErrorToDiagnostic
  // ---------------------------------------------------------------------------

  describe('evalErrorToDiagnostic', () => {
    it('maps a syntax error with a line number to an error diagnostic', () => {
      const docText = 'line 1\nline 2\nline 3\nline 4\nline 5';
      const error: EvalError = { message: 'SyntaxError: Unexpected token', line: 5 };
      const diag = evalErrorToDiagnostic(error, docText);

      expect(diag.severity).toBe('error');
      expect(diag.message).toBe('SyntaxError: Unexpected token');
      // Line 5 starts at position 28 ("line 1\nline 2\nline 3\nline 4\n" = 28 chars)
      // Line 5 content is "line 5" which is 6 chars, so to = 34
      expect(diag.from).toBe(28);
      expect(diag.to).toBe(34);
    });

    it('maps a runtime error with a line number to a warning diagnostic', () => {
      const docText = 'a\nbb\nccc';
      const error: EvalError = { message: 'Resistor has 2 pins', line: 3 };
      const diag = evalErrorToDiagnostic(error, docText);

      expect(diag.severity).toBe('warning');
      expect(diag.message).toBe('Resistor has 2 pins');
      // Line 1: "a\n" (2), line 2: "bb\n" (3), line 3 starts at 5
      // Line 3 content: "ccc" (3 chars), to = 8
      expect(diag.from).toBe(5);
      expect(diag.to).toBe(8);
    });

    it('defaults to position 0 when no line is provided', () => {
      const docText = 'hello\nworld';
      const error: EvalError = { message: 'Unknown error' };
      const diag = evalErrorToDiagnostic(error, docText);

      expect(diag.severity).toBe('warning');
      // No line → highlights the entire first line
      expect(diag.from).toBe(0);
      expect(diag.to).toBe(5);
    });

    it('clamps line numbers that exceed the document line count', () => {
      const docText = 'only one line';
      const error: EvalError = { message: 'SyntaxError: oops', line: 99 };
      const diag = evalErrorToDiagnostic(error, docText);

      expect(diag.severity).toBe('error');
      // Clamped to line 1 (the only line)
      expect(diag.from).toBe(0);
      expect(diag.to).toBe(13);
    });

    it('clamps line numbers below 1 to line 1', () => {
      const docText = 'first\nsecond';
      const error: EvalError = { message: 'SyntaxError: bad', line: 0 };
      const diag = evalErrorToDiagnostic(error, docText);

      expect(diag.from).toBe(0);
      expect(diag.to).toBe(5);
    });

    it('handles an empty document', () => {
      const docText = '';
      const error: EvalError = { message: 'SyntaxError: empty', line: 1 };
      const diag = evalErrorToDiagnostic(error, docText);

      expect(diag.severity).toBe('error');
      expect(diag.from).toBe(0);
      expect(diag.to).toBe(0);
    });

    it('treats "TypeError:" prefix as an error severity', () => {
      const docText = 'abc\ndef';
      const error: EvalError = { message: 'TypeError: x is not a function', line: 2 };
      const diag = evalErrorToDiagnostic(error, docText);

      expect(diag.severity).toBe('error');
    });

    it('treats "ReferenceError:" prefix as an error severity', () => {
      const docText = 'abc';
      const error: EvalError = { message: 'ReferenceError: x is not defined', line: 1 };
      const diag = evalErrorToDiagnostic(error, docText);

      expect(diag.severity).toBe('error');
    });

    it('correctly calculates positions for line 1', () => {
      const docText = 'first line\nsecond line';
      const error: EvalError = { message: 'some warning', line: 1 };
      const diag = evalErrorToDiagnostic(error, docText);

      expect(diag.from).toBe(0);
      expect(diag.to).toBe(10);
    });

    it('correctly calculates positions for a middle line', () => {
      const docText = 'aaa\nbbb\nccc\nddd';
      const error: EvalError = { message: 'warning here', line: 3 };
      const diag = evalErrorToDiagnostic(error, docText);

      // Line 1: "aaa\n" = 4, Line 2: "bbb\n" = 4, Line 3 starts at 8
      // Line 3: "ccc" = 3 chars, to = 11
      expect(diag.from).toBe(8);
      expect(diag.to).toBe(11);
    });
  });

  // ---------------------------------------------------------------------------
  // evalErrorsToDiagnostics
  // ---------------------------------------------------------------------------

  describe('evalErrorsToDiagnostics', () => {
    it('converts an array of errors to diagnostics', () => {
      const docText = 'line1\nline2\nline3';
      const errors: EvalError[] = [
        { message: 'SyntaxError: oops', line: 1 },
        { message: 'Bad connection', line: 3 },
      ];
      const diags = evalErrorsToDiagnostics(errors, docText);

      expect(diags).toHaveLength(2);
      expect(diags[0].severity).toBe('error');
      expect(diags[0].from).toBe(0);
      expect(diags[0].to).toBe(5);
      expect(diags[1].severity).toBe('warning');
      expect(diags[1].from).toBe(12);
      expect(diags[1].to).toBe(17);
    });

    it('returns an empty array for empty errors', () => {
      const diags = evalErrorsToDiagnostics([], 'some code');
      expect(diags).toEqual([]);
    });
  });
});
