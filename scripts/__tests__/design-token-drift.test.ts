// @ts-nocheck
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  checkTokenDrift,
  formatTokenDriftReport,
  parseCssColorVariables,
  parseDesignColorTokens,
} from '../design/check-token-drift.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

describe('design token drift checker', () => {
  it('extracts color tokens from DESIGN.md frontmatter', () => {
    const tokens = parseDesignColorTokens([
      '---',
      'colors:',
      '  primary: "#00b7db"',
      "  focus-ring: '#fff'",
      'typography:',
      '  body-md:',
      '---',
      '',
    ].join('\n'));

    expect(tokens.get('primary')).toBe('#00B7DB');
    expect(tokens.get('focus-ring')).toBe('#FFFFFF');
    expect(tokens.has('body-md')).toBe(false);
  });

  it('extracts CSS color variables', () => {
    const variables = parseCssColorVariables(':root { --color-primary: #00b7db; --not-color: #fff; }');

    expect(variables.get('--color-primary')).toBe('#00B7DB');
    expect(variables.has('--not-color')).toBe(false);
  });

  it('reports drift between DESIGN.md and CSS aliases', () => {
    const result = checkTokenDrift({
      designSource: [
        '---',
        'colors:',
        '  primary: "#00B7DB"',
        '---',
        '',
      ].join('\n'),
      cssSource: '--color-primary: #00B7DB; --color-accent: #884DFF;',
      tokenMap: [{ design: 'primary', css: ['--color-primary', '--color-accent', '--color-ring'] }],
    });

    expect(result.issues).toEqual([
      '--color-accent drifted from colors.primary: expected #00B7DB, found #884DFF.',
      'client/src/index.css is missing --color-ring for colors.primary.',
    ]);
    expect(formatTokenDriftReport(result)).toContain('Token drift found');
  });

  it('keeps DESIGN.md color tokens synchronized with index.css variables', async () => {
    const [designSource, cssSource] = await Promise.all([
      readFile(path.join(repoRoot, 'DESIGN.md'), 'utf8'),
      readFile(path.join(repoRoot, 'client/src/index.css'), 'utf8'),
    ]);

    const result = checkTokenDrift({ designSource, cssSource });

    expect(result.checked.length).toBeGreaterThan(25);
    expect(result.issues).toEqual([]);
  });
});
