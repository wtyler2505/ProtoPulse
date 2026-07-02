#!/usr/bin/env node
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

// Recharts' <XAxis type="number"> is a declarative axis-type prop, not an
// HTML input — same false positive the BL-0781 audit hit in BodePlot.tsx.
const RECHARTS_PATTERN = /<(XAxis|YAxis|ZAxis)\b/;

function findMatches(pattern) {
  let stdout;
  try {
    stdout = execFileSync(
      'ast-grep',
      ['--pattern', pattern, '--lang', 'tsx', 'client/src/components', '--json'],
      { encoding: 'utf8' },
    );
  } catch (err) {
    // ast-grep exits non-zero only on real invocation errors (bad pattern,
    // missing binary); zero matches still exits 0 with `[]`.
    console.error(`ast-grep invocation failed for pattern "${pattern}":`);
    console.error(err.stderr ?? err.message);
    process.exit(1);
  }

  const matches = JSON.parse(stdout);
  return matches.filter((m) => {
    const relPath = m.file.replace(process.cwd() + '/', '');
    if (ALLOWED.has(relPath)) return false;
    if (RECHARTS_PATTERN.test(m.lines)) return false;
    return true;
  });
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
