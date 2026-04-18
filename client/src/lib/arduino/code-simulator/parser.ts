/**
 * Arduino sketch parser — splits source into structured sections.
 *
 * Extracted from code-simulator.ts during the oversized-file split (T2).
 * Handles setup(), loop(), global declarations, and user-defined functions.
 */

import type { ParsedFunction, ParsedSketch } from './types';

/**
 * Parse an Arduino sketch into structured sections.
 * Handles setup(), loop(), global declarations, and user-defined functions.
 */
export function parseSketch(source: string): ParsedSketch {
  const rawLines = source.split('\n');
  const globals: string[] = [];
  const functions = new Map<string, ParsedFunction>();
  let setupBody: string[] = [];
  let loopBody: string[] = [];

  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i].trim();

    // Skip blank lines and single-line comments at top level
    if (line === '' || line.startsWith('//') || line.startsWith('#include')) {
      globals.push(rawLines[i]);
      i++;
      continue;
    }

    // Block comment
    if (line.startsWith('/*')) {
      while (i < rawLines.length && !rawLines[i].includes('*/')) {
        globals.push(rawLines[i]);
        i++;
      }
      if (i < rawLines.length) {
        globals.push(rawLines[i]);
        i++;
      }
      continue;
    }

    // Detect function definitions
    const funcMatch = line.match(/^(\w[\w\s*]*?)\s+(\w+)\s*\(([^)]*)\)\s*\{?\s*$/);
    if (funcMatch) {
      const [, , funcName, params] = funcMatch;
      const startLine = i;
      const body: string[] = [];
      let braceCount = line.includes('{') ? 1 : 0;

      if (braceCount === 0) {
        i++;
        // Next line should have opening brace
        if (i < rawLines.length && rawLines[i].trim() === '{') {
          braceCount = 1;
          i++;
        }
      } else {
        i++;
      }

      while (i < rawLines.length && braceCount > 0) {
        const bodyLine = rawLines[i];
        const trimmed = bodyLine.trim();
        for (const ch of trimmed) {
          if (ch === '{') {
            braceCount++;
          }
          if (ch === '}') {
            braceCount--;
          }
        }
        if (braceCount > 0) {
          body.push(trimmed);
        }
        i++;
      }

      const paramList = params.split(',').map((p) => p.trim()).filter((p) => p !== '');

      if (funcName === 'setup') {
        setupBody = body;
      } else if (funcName === 'loop') {
        loopBody = body;
      } else {
        functions.set(funcName, { name: funcName, params: paramList, body, startLine });
      }
      continue;
    }

    // Global variable/constant declarations
    globals.push(rawLines[i]);
    i++;
  }

  return { globals, setupBody, loopBody, functions, rawLines };
}
