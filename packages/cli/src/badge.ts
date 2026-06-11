/**
 * Shields-style SVG badge for `protopulse check --badge` — CI for
 * circuits gets the same README furniture CI for code has. Pure text
 * generation, fully deterministic (no fonts measured, no timestamps):
 * text width is estimated at a flat per-character advance, which is
 * how the badge stays byte-stable across machines.
 */

export interface BadgeInput {
  errors: number;
  warnings: number;
  /** Invariant violations — the log itself is corrupt. */
  corrupt: boolean;
}

const COLORS = {
  label: '#555',
  clean: '#4c1',
  warn: '#dfb317',
  error: '#e05d44',
};

/** Flat per-char advance for 11px Verdana-ish text (deliberately
 *  generous — a slightly roomy badge beats a clipped one). */
const CHAR_W = 7;
const PAD = 10;

function statusOf(input: BadgeInput): { text: string; color: string } {
  if (input.corrupt) return { text: 'corrupt log', color: COLORS.error };
  if (input.errors > 0) {
    return { text: `${String(input.errors)} error${input.errors === 1 ? '' : 's'}`, color: COLORS.error };
  }
  if (input.warnings > 0) {
    return {
      text: `clean · ${String(input.warnings)} warning${input.warnings === 1 ? '' : 's'}`,
      color: COLORS.warn,
    };
  }
  return { text: 'ERC clean', color: COLORS.clean };
}

export function badgeSvg(input: BadgeInput, label = 'circuit'): string {
  const status = statusOf(input);
  const labelW = label.length * CHAR_W + 2 * PAD;
  const statusW = status.text.length * CHAR_W + 2 * PAD;
  const w = labelW + statusW;
  const textY = 14;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${String(w)}" height="20" role="img" aria-label="${label}: ${status.text}">`,
    `<title>${label}: ${status.text}</title>`,
    `<clipPath id="r"><rect width="${String(w)}" height="20" rx="3" fill="#fff"/></clipPath>`,
    `<g clip-path="url(#r)">`,
    `<rect width="${String(labelW)}" height="20" fill="${COLORS.label}"/>`,
    `<rect x="${String(labelW)}" width="${String(statusW)}" height="20" fill="${status.color}"/>`,
    `</g>`,
    `<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">`,
    `<text x="${String(labelW / 2)}" y="${String(textY)}">${label}</text>`,
    `<text x="${String(labelW + statusW / 2)}" y="${String(textY)}">${status.text}</text>`,
    `</g>`,
    `</svg>`,
    ``,
  ].join('\n');
}
