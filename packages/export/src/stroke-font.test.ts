import { describe, expect, it } from 'vitest';

import { textToStrokes } from './stroke-font.js';

describe('textToStrokes', () => {
  it('renders a known glyph as strokes at the origin, scaled to cell size', () => {
    // 'I' = [[0.2,0,0.8,0],[0.5,0,0.5,1],[0.2,1,0.8,1]] — 3 strokes.
    const strokes = textToStrokes('I', { x: 0, y: 0 }, 1_000_000, 1_000_000, 200_000);
    expect(strokes).toHaveLength(3);
    expect(strokes[0]).toEqual({ a: { x: 200_000, y: 0 }, b: { x: 800_000, y: 0 } });
    expect(strokes[1]).toEqual({ a: { x: 500_000, y: 0 }, b: { x: 500_000, y: 1_000_000 } });
  });

  it('advances the cursor by charWidth + spacing per character', () => {
    const one = textToStrokes('I', { x: 0, y: 0 }, 1_000_000, 1_000_000, 200_000);
    const two = textToStrokes('II', { x: 0, y: 0 }, 1_000_000, 1_000_000, 200_000);
    expect(two).toHaveLength(6);
    // Second 'I' cursor starts at 1_000_000 + 200_000 = 1_200_000.
    expect(two[3]).toEqual({ a: { x: 1_400_000, y: 0 }, b: { x: 2_000_000, y: 0 } });
    expect(one).toHaveLength(3);
  });

  it('is case-insensitive and skips unknown characters while still advancing', () => {
    const lower = textToStrokes('i', { x: 0, y: 0 }, 1_000_000, 1_000_000, 200_000);
    const upper = textToStrokes('I', { x: 0, y: 0 }, 1_000_000, 1_000_000, 200_000);
    expect(lower).toEqual(upper);

    // '#' has no glyph — zero strokes, but 'A' after it is positioned as if '#' were drawn.
    const withUnknown = textToStrokes('#A', { x: 0, y: 0 }, 1_000_000, 1_000_000, 200_000);
    const justA = textToStrokes('A', { x: 1_200_000, y: 0 }, 1_000_000, 1_000_000, 200_000);
    expect(withUnknown).toEqual(justA);
  });

  it('offsets from a non-zero origin and rounds to whole nanometers', () => {
    const strokes = textToStrokes('I', { x: 5_000_000, y: 3_000_000 }, 900_000, 1_100_000, 150_000);
    // First stroke x: origin.x + 0.2*charW = 5_000_000 + 180_000 = 5_180_000
    expect(strokes[0]?.a.x).toBe(5_180_000);
    expect(strokes[0]?.a.y).toBe(3_000_000);
  });

  it('is deterministic — identical inputs produce identical output', () => {
    const a = textToStrokes('R1', { x: 1_234_567, y: -987_654 }, 800_000, 1_000_000, 200_000);
    const b = textToStrokes('R1', { x: 1_234_567, y: -987_654 }, 800_000, 1_000_000, 200_000);
    expect(a).toEqual(b);
  });
});
