#!/usr/bin/env node
/**
 * BL-0781 regression guard — refuses raw `<input type="number">` and
 * `<Input type="number">` in client/src/components/, except in the allowlist
 * (the NumberInput primitive itself, its test file, and Recharts `<XAxis>` /
 * `<YAxis>` which use `type="number"` as a declarative axis-type, not an HTML
 * input attribute).
 *
 * Background: the Chromium accessibility tree synthesises `aria-valuemax="0"`
 * on `<input type="number">` elements lacking an explicit `max` attribute,
 * breaking spinbutton announcements (E2E-236/271/284). The `NumberInput`
 * primitive at client/src/components/ui/number-input.tsx is the canonical fix.
 * This guard prevents reintroduction by forcing all new number-typed inputs to
 * go through the primitive.
 *
 * Usage:
 *   node scripts/check-raw-number-inputs.mjs
 *
 * Exit codes:
 *   0 — no violations
 *   1 — one or more violations found (paths + line numbers printed)
 *
 * Wired into package.json as `npm run lint:no-raw-number-input` once Phase 1
 * of the BL-0781 migration wave lands. See:
 *   - docs/audits/bl-0781-number-input-audit.md
 *   - ~/.claude/plans/claude-devfleet-sp-write-plan-bl-0781-hidden-pancake.md
 *
 * Implementation note: uses ripgrep with a windowed back-scan to identify the
 * enclosing JSX tag for each `type="number"` match. ast-grep's positional
 * pattern syntax (`<Input type="number" $$$/>`) only matches when `type` is the
 * first attribute, which misses the dominant pattern in this codebase where
 * `type="number"` follows `id`, `data-testid`, etc. Lines-based scanning is
 * less elegant but reliably catches every case.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const ALLOWED_FILES = new Set([
  'client/src/components/ui/number-input.tsx',
  'client/src/components/ui/__tests__/number-input.test.tsx',
]);

/**
 * Element kinds we EXCLUDE (declarative `type="number"`, not HTML input attr).
 * Extend this list if more Recharts/D3/Recharts-like libraries are added.
 */
const ALLOWED_TAGS = new Set([
  'XAxis',
  'YAxis',
  'ZAxis',
  'Scatter',
  'NumberValue',
]);

const TARGET_DIR = 'client/src/components';

function listHits() {
  let stdout;
  try {
    stdout = execSync(
      `rg --no-heading --line-number --glob '*.tsx' 'type=[\\"\\x27]number[\\"\\x27]' ${TARGET_DIR}`,
      { cwd: repoRoot, encoding: 'utf8' },
    );
  } catch (err) {
    if (err.status === 1) return [];
    throw err;
  }
  return stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const m = /^([^:]+):(\d+):(.*)$/.exec(line);
      if (!m) return null;
      return { file: m[1], line: Number(m[2]), text: m[3] };
    })
    .filter(Boolean);
}

/**
 * Walk back from the line containing `type="number"` to find the enclosing
 * JSX opening tag. Returns the tag name (`Input`, `input`, `XAxis`, etc.) or
 * null if no plausible tag is found within a 30-line back-window.
 */
function findEnclosingTag(filePath, hitLine) {
  const fullPath = path.resolve(repoRoot, filePath);
  const lines = readFileSync(fullPath, 'utf8').split('\n');
  for (let i = Math.min(hitLine - 1, lines.length - 1); i >= Math.max(0, hitLine - 30); i--) {
    const m = /<([A-Za-z][A-Za-z0-9_]*)\b/.exec(lines[i] ?? '');
    if (m) return m[1];
  }
  return null;
}

const hits = listHits();
const violations = [];
for (const hit of hits) {
  if (ALLOWED_FILES.has(hit.file)) continue;
  const tag = findEnclosingTag(hit.file, hit.line);
  if (tag === null) continue;
  if (ALLOWED_TAGS.has(tag)) continue;
  if (tag !== 'input' && tag !== 'Input') {
    // Some unknown wrapper component — flag as violation; the author can
    // explicitly add it to ALLOWED_TAGS if it's a non-HTML declarative use.
  }
  violations.push({ ...hit, tag });
}

violations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

if (violations.length === 0) {
  console.log('OK: no raw type="number" inputs found (BL-0781 guard passes).');
  process.exit(0);
}

console.error(`FAIL: ${violations.length} raw number-input(s) detected. Use <NumberInput> from @/components/ui/number-input.`);
console.error('');
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}  (<${v.tag}>)`);
}
console.error('');
console.error('See docs/audits/bl-0781-number-input-audit.md for the migration spec.');
console.error('Allowed exceptions: the NumberInput primitive itself and Recharts <XAxis>/<YAxis>.');
process.exit(1);
