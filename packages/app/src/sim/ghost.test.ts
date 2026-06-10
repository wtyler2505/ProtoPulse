import { describe, expect, it } from 'vitest';

import { ghostFromVectors, ghostTint, voltageColor } from './ghost.js';

const STAMP = { branch: 'main', opsVersion: 7 };

const NODE_OF = new Map([
  ['net-vbat', 'vbat'],
  ['net-led', 'led_a'],
  ['net-gnd', '0'],
]);

const TRAN_VECTORS = [
  { name: 'time', values: [0, 0.5e-3, 1e-3] },
  { name: 'V(vbat)', values: [9, 9, 9] },
  { name: 'v(led_a)', values: [0, 1.4, 1.9] },
];

describe('ghostFromVectors', () => {
  it('joins tran vectors to nets at the final timepoint; ground is 0V', () => {
    const ghost = ghostFromVectors('tran', TRAN_VECTORS, NODE_OF, STAMP);
    expect(ghost).not.toBeNull();
    expect(ghost?.voltsByNet.get('net-vbat')).toBe(9);
    expect(ghost?.voltsByNet.get('net-led')).toBe(1.9);
    expect(ghost?.voltsByNet.get('net-gnd')).toBe(0);
    expect(ghost?.min).toBe(0);
    expect(ghost?.max).toBe(9);
    expect(ghost?.label).toBe('t = 1ms');
    expect(ghost?.branch).toBe('main');
    expect(ghost?.opsVersion).toBe(7);
  });

  it('op runs label as operating point', () => {
    const ghost = ghostFromVectors(
      'op',
      [{ name: 'v(vbat)', values: [9] }, { name: 'v(led_a)', values: [1.8] }],
      NODE_OF,
      STAMP,
    );
    expect(ghost?.label).toBe('operating point');
  });

  it('refuses frequency-domain and sweep kinds — a ghost there would lie', () => {
    expect(ghostFromVectors('ac', TRAN_VECTORS, NODE_OF, STAMP)).toBeNull();
    expect(ghostFromVectors('noise', TRAN_VECTORS, NODE_OF, STAMP)).toBeNull();
    expect(ghostFromVectors('dc', TRAN_VECTORS, NODE_OF, STAMP)).toBeNull();
  });

  it('returns null when nothing matches', () => {
    expect(ghostFromVectors('tran', [{ name: 'time', values: [0] }], new Map(), STAMP)).toBeNull();
  });

  it('skips non-finite values', () => {
    const ghost = ghostFromVectors(
      'tran',
      [{ name: 'v(vbat)', values: [Number.NaN] }, { name: 'v(led_a)', values: [2] }],
      NODE_OF,
      STAMP,
    );
    expect(ghost?.voltsByNet.has('net-vbat')).toBe(false);
    expect(ghost?.voltsByNet.get('net-led')).toBe(2);
  });
});

describe('voltage colors', () => {
  it('cold at min, warm at max, midpoint when the range is flat', () => {
    expect(voltageColor(0, 0, 9)[2]).toBeCloseTo(0.95); // blue end
    expect(voltageColor(9, 0, 9)[0]).toBeCloseTo(1.0); // warm end
    const flat = voltageColor(5, 5, 5);
    expect(flat[0]).toBeGreaterThan(0.25);
    expect(flat[0]).toBeLessThan(1.0);
  });

  it('ghostTint maps every net', () => {
    const ghost = ghostFromVectors('tran', TRAN_VECTORS, NODE_OF, STAMP);
    const tint = ghostTint(ghost!);
    expect(tint.size).toBe(3);
    expect(tint.get('net-gnd')?.[2]).toBeCloseTo(0.95); // ground = coldest
  });
});
