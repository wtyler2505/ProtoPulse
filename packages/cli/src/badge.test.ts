import { describe, expect, it } from 'vitest';

import { badgeSvg } from './badge.js';

describe('badgeSvg', () => {
  it('clean designs get the green badge', () => {
    const svg = badgeSvg({ errors: 0, warnings: 0, corrupt: false });
    expect(svg).toContain('ERC clean');
    expect(svg).toContain('#4c1');
    expect(svg).toContain('aria-label="circuit: ERC clean"');
  });

  it('warnings go amber with a count, errors go red and win', () => {
    const warn = badgeSvg({ errors: 0, warnings: 3, corrupt: false });
    expect(warn).toContain('clean · 3 warnings');
    expect(warn).toContain('#dfb317');

    const oneWarn = badgeSvg({ errors: 0, warnings: 1, corrupt: false });
    expect(oneWarn).toContain('clean · 1 warning');

    const err = badgeSvg({ errors: 2, warnings: 5, corrupt: false });
    expect(err).toContain('2 errors');
    expect(err).toContain('#e05d44');
    expect(err).not.toContain('warning');
  });

  it('a corrupt log outranks everything', () => {
    const svg = badgeSvg({ errors: 0, warnings: 0, corrupt: true });
    expect(svg).toContain('corrupt log');
    expect(svg).toContain('#e05d44');
  });

  it('is deterministic and well-formed', () => {
    const a = badgeSvg({ errors: 1, warnings: 0, corrupt: false });
    const b = badgeSvg({ errors: 1, warnings: 0, corrupt: false });
    expect(a).toBe(b);
    expect(a.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(a.trimEnd().endsWith('</svg>')).toBe(true);
    // Width grows with the status text.
    const short = badgeSvg({ errors: 0, warnings: 0, corrupt: false });
    const long = badgeSvg({ errors: 0, warnings: 12, corrupt: false });
    const widthOf = (svg: string): number => Number(/width="(\d+)"/.exec(svg)?.[1] ?? 0);
    expect(widthOf(long)).toBeGreaterThan(widthOf(short));
  });

  it('supports a custom label', () => {
    expect(badgeSvg({ errors: 0, warnings: 0, corrupt: false }, 'power-board')).toContain(
      'aria-label="power-board: ERC clean"',
    );
  });
});
