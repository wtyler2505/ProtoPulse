#!/usr/bin/env node
/* global console, process */
/**
 * BL-0781 regression guard: fail if any client/src/components/**\/*.tsx file
 * (besides the NumberInput primitive itself and its own tests) contains a raw
 * <input type="number"> or shadcn <Input type="number">. Both should route
 * through NumberInput (client/src/components/ui/number-input.tsx) so the
 * ARIA-mirroring contract that fixes the Chromium synthesized-aria-valuemax="0"
 * bug (E2E-236/271/284) stays in force everywhere, not just where BL-0781
 * happened to look.
 */
import { execFileSync } from 'node:child_process';

const ALLOWED = new Set([
  'client/src/components/ui/number-input.tsx', // the primitive itself
  'client/src/components/ui/__tests__/number-input.test.tsx', // its tests
]);

function findMatches(pattern) {
  let stdout;
  try {
    stdout = execFileSync(
      'ast-grep',
      ['--pattern', pattern, '--lang', 'tsx', 'client/src/components', '--json'],
      { encoding: 'utf8' },
    );
  } catch (err) {
    // ast-grep follows grep's exit-code convention: 1 means "ran fine, zero
    // matches" (stdout is still valid JSON, `[]`), not an invocation error.
    // Only treat this as fatal if stdout isn't parseable JSON.
    stdout = err.stdout ?? '';
    try {
      JSON.parse(stdout);
    } catch {
      console.error(`ast-grep invocation failed for pattern "${pattern}":`);
      console.error(err.stderr || err.message);
      process.exit(1);
    }
  }

  const matches = JSON.parse(stdout);
  return matches.filter((m) => !ALLOWED.has(m.file.replace(process.cwd() + '/', '')));
}

const raw = findMatches('<input type="number" $$$/>');
const wrapped = findMatches('<Input type="number" $$$/>');
const violations = [...raw, ...wrapped];

if (violations.length === 0) {
  console.log('OK: no raw type="number" inputs found outside NumberInput (BL-0781 guard passes).');
  process.exit(0);
}

for (const v of violations) {
  const relPath = v.file.replace(process.cwd() + '/', '');
  // ast-grep's range.start.line is 0-indexed; report 1-indexed to match editors.
  console.error(`${relPath}:${v.range.start.line + 1}: ${v.lines.trim()}`);
}
console.error(
  `\nFAIL: ${violations.length} raw number-input(s) detected. Use <NumberInput> from ` +
    "'@/components/ui/number-input' instead of type=\"number\" on <input>/<Input>.",
);
process.exit(1);
