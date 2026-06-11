#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_DESIGN_PATH = 'DESIGN.md';
export const DEFAULT_CSS_PATH = 'client/src/index.css';

export const COLOR_TOKEN_MAP = [
  { design: 'background', css: ['--color-background'] },
  { design: 'foreground', css: ['--color-foreground', '--color-card-foreground', '--color-popover-foreground'] },
  { design: 'foreground-muted', css: ['--color-muted-foreground'] },
  { design: 'surface', css: ['--color-card', '--color-popover'] },
  { design: 'surface-muted', css: ['--color-muted'] },
  { design: 'primary', css: ['--color-primary', '--color-accent', '--color-ring'] },
  { design: 'primary-foreground', css: ['--color-primary-foreground', '--color-accent-foreground', '--color-brand-foreground'] },
  { design: 'secondary', css: ['--color-secondary'] },
  { design: 'secondary-foreground', css: ['--color-secondary-foreground'] },
  { design: 'border', css: ['--color-border', '--color-input', '--color-sidebar-border'] },
  { design: 'sidebar', css: ['--color-sidebar'] },
  { design: 'editor-accent', css: ['--color-editor-accent'] },
  { design: 'brand', css: ['--color-brand'] },
  { design: 'power', css: ['--color-power'] },
  { design: 'signal', css: ['--color-signal'] },
  { design: 'data', css: ['--color-data'] },
  { design: 'warning', css: ['--color-warning'] },
  { design: 'success', css: ['--color-success'] },
  { design: 'info', css: ['--color-info'] },
  { design: 'error', css: ['--color-destructive'] },
  { design: 'focus-ring', css: ['--color-focus-ring'] },
];

export function normalizeColor(value) {
  const raw = String(value ?? '').trim().replace(/^['"]|['"]$/g, '');
  const shortHex = raw.match(/^#([0-9a-fA-F]{3})$/);
  if (shortHex) {
    return `#${shortHex[1].split('').map((char) => `${char}${char}`).join('').toUpperCase()}`;
  }
  const hex = raw.match(/^#([0-9a-fA-F]{6})$/);
  if (hex) {
    return `#${hex[1].toUpperCase()}`;
  }
  return raw;
}

export function parseDesignColorTokens(markdown) {
  const colors = new Map();
  const frontmatterMatch = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return colors;
  }

  let inColors = false;
  for (const line of frontmatterMatch[1].split('\n')) {
    if (/^\S/.test(line)) {
      inColors = line.trim() === 'colors:';
      continue;
    }
    if (!inColors) {
      continue;
    }
    const match = line.match(/^\s{2}([a-z0-9-]+):\s*(.+?)\s*$/i);
    if (match) {
      colors.set(match[1], normalizeColor(match[2]));
    }
  }
  return colors;
}

export function parseCssColorVariables(css) {
  const variables = new Map();
  const themeMatch = css.match(/@theme\s*\{([\s\S]*?)^\}/m);
  const tokenSource = (themeMatch ? themeMatch[1] : css).replace(/\/\*[\s\S]*?\*\//g, '');

  for (const match of tokenSource.matchAll(/(--color-[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    variables.set(match[1], normalizeColor(match[2]));
  }
  return variables;
}

export function checkTokenDrift({ designSource, cssSource, tokenMap = COLOR_TOKEN_MAP }) {
  const designColors = parseDesignColorTokens(designSource);
  const cssVariables = parseCssColorVariables(cssSource);
  const issues = [];
  const checked = [];

  for (const entry of tokenMap) {
    const expected = designColors.get(entry.design);
    if (!expected) {
      issues.push(`DESIGN.md is missing colors.${entry.design}.`);
      continue;
    }

    for (const cssVar of entry.css) {
      const actual = cssVariables.get(cssVar);
      if (!actual) {
        issues.push(`client/src/index.css is missing ${cssVar} for colors.${entry.design}.`);
        continue;
      }

      checked.push({ designToken: entry.design, cssVar, expected, actual });
      if (actual !== expected) {
        issues.push(`${cssVar} drifted from colors.${entry.design}: expected ${expected}, found ${actual}.`);
      }
    }
  }

  return { issues, checked, designColors, cssVariables };
}

export function formatTokenDriftReport(result) {
  const lines = [
    'ProtoPulse design token drift check',
    `Checked CSS variables: ${result.checked.length}`,
  ];

  if (result.issues.length === 0) {
    lines.push('', 'Token drift check passed.');
    return lines.join('\n');
  }

  lines.push('', 'Token drift found:');
  lines.push(...result.issues.map((issue) => `- ${issue}`));
  return lines.join('\n');
}

export async function runTokenDriftCheck(rootDir = process.cwd()) {
  const [designSource, cssSource] = await Promise.all([
    readFile(path.join(rootDir, DEFAULT_DESIGN_PATH), 'utf8'),
    readFile(path.join(rootDir, DEFAULT_CSS_PATH), 'utf8'),
  ]);
  return checkTokenDrift({ designSource, cssSource });
}

async function main() {
  const result = await runTokenDriftCheck();
  console.log(formatTokenDriftReport(result));
  if (result.issues.length > 0) {
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const thisPath = fileURLToPath(import.meta.url);
if (invokedPath === thisPath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
