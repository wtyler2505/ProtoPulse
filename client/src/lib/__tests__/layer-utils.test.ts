import { describe, it, expect } from 'vitest';
import {
  normalizeLegacyLayer,
  getLayerIndex,
  getLayerName,
  isOuterLayer,
  isInnerLayer,
  getCopperLayers,
  generateLayerColors,
  getLayerSpan,
  areLayersAdjacent,
  DEFAULT_LAYER_COUNT,
  MAX_LAYER_COUNT,
  STANDARD_LAYER_NAMES,
} from '@/lib/pcb/layer-utils';

// ---------------------------------------------------------------------------
// normalizeLegacyLayer
// ---------------------------------------------------------------------------

describe('normalizeLegacyLayer', () => {
  it('maps "front" to "F.Cu"', () => {
    expect(normalizeLegacyLayer('front')).toBe('F.Cu');
  });

  it('maps "back" to "B.Cu"', () => {
    expect(normalizeLegacyLayer('back')).toBe('B.Cu');
  });

  it('maps "Top" to "F.Cu"', () => {
    expect(normalizeLegacyLayer('Top')).toBe('F.Cu');
  });

  it('maps "Bottom" to "B.Cu"', () => {
    expect(normalizeLegacyLayer('Bottom')).toBe('B.Cu');
  });

  it('passes through standard names unchanged', () => {
    expect(normalizeLegacyLayer('F.Cu')).toBe('F.Cu');
    expect(normalizeLegacyLayer('B.Cu')).toBe('B.Cu');
    expect(normalizeLegacyLayer('In1.Cu')).toBe('In1.Cu');
    expect(normalizeLegacyLayer('In15.Cu')).toBe('In15.Cu');
  });

  it('passes through unknown names unchanged', () => {
    expect(normalizeLegacyLayer('SomethingElse')).toBe('SomethingElse');
  });
});

// ---------------------------------------------------------------------------
// getLayerIndex
// ---------------------------------------------------------------------------

describe('getLayerIndex', () => {
  it('returns 0 for F.Cu on any layer count', () => {
    expect(getLayerIndex('F.Cu', 2)).toBe(0);
    expect(getLayerIndex('F.Cu', 4)).toBe(0);
    expect(getLayerIndex('F.Cu', 32)).toBe(0);
  });

  it('returns layerCount-1 for B.Cu', () => {
    expect(getLayerIndex('B.Cu', 2)).toBe(1);
    expect(getLayerIndex('B.Cu', 4)).toBe(3);
    expect(getLayerIndex('B.Cu', 32)).toBe(31);
  });

  it('returns 0 for "front" (legacy)', () => {
    expect(getLayerIndex('front', 4)).toBe(0);
  });

  it('returns layerCount-1 for "back" (legacy)', () => {
    expect(getLayerIndex('back', 4)).toBe(3);
  });

  it('returns inner layer index from In{N}.Cu names', () => {
    expect(getLayerIndex('In1.Cu', 4)).toBe(1);
    expect(getLayerIndex('In2.Cu', 4)).toBe(2);
    expect(getLayerIndex('In1.Cu', 6)).toBe(1);
    expect(getLayerIndex('In4.Cu', 6)).toBe(4);
  });

  it('returns 0 for out-of-bounds inner layer index', () => {
    // In3.Cu is out of bounds for a 4-layer board (valid indices: 0,1,2,3)
    expect(getLayerIndex('In3.Cu', 4)).toBe(0);
    expect(getLayerIndex('In10.Cu', 4)).toBe(0);
  });

  it('returns 0 for unrecognized names', () => {
    expect(getLayerIndex('unknown', 4)).toBe(0);
    expect(getLayerIndex('', 4)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getLayerName
// ---------------------------------------------------------------------------

describe('getLayerName', () => {
  it('returns F.Cu for index 0', () => {
    expect(getLayerName(0, 2)).toBe('F.Cu');
    expect(getLayerName(0, 4)).toBe('F.Cu');
    expect(getLayerName(0, 32)).toBe('F.Cu');
  });

  it('returns B.Cu for last index', () => {
    expect(getLayerName(1, 2)).toBe('B.Cu');
    expect(getLayerName(3, 4)).toBe('B.Cu');
    expect(getLayerName(31, 32)).toBe('B.Cu');
  });

  it('returns In{N}.Cu for inner layers', () => {
    expect(getLayerName(1, 4)).toBe('In1.Cu');
    expect(getLayerName(2, 4)).toBe('In2.Cu');
    expect(getLayerName(1, 6)).toBe('In1.Cu');
    expect(getLayerName(4, 6)).toBe('In4.Cu');
    expect(getLayerName(15, 32)).toBe('In15.Cu');
  });
});

// ---------------------------------------------------------------------------
// isOuterLayer / isInnerLayer
// ---------------------------------------------------------------------------

describe('isOuterLayer', () => {
  it('returns true for F.Cu and B.Cu', () => {
    expect(isOuterLayer('F.Cu', 4)).toBe(true);
    expect(isOuterLayer('B.Cu', 4)).toBe(true);
    expect(isOuterLayer('front', 4)).toBe(true);
    expect(isOuterLayer('back', 4)).toBe(true);
  });

  it('returns false for inner layers', () => {
    expect(isOuterLayer('In1.Cu', 4)).toBe(false);
    expect(isOuterLayer('In2.Cu', 4)).toBe(false);
    expect(isOuterLayer('In10.Cu', 32)).toBe(false);
  });

  it('works for 2-layer boards', () => {
    expect(isOuterLayer('F.Cu', 2)).toBe(true);
    expect(isOuterLayer('B.Cu', 2)).toBe(true);
  });
});

describe('isInnerLayer', () => {
  it('returns false for F.Cu and B.Cu', () => {
    expect(isInnerLayer('F.Cu', 4)).toBe(false);
    expect(isInnerLayer('B.Cu', 4)).toBe(false);
  });

  it('returns true for inner layers', () => {
    expect(isInnerLayer('In1.Cu', 4)).toBe(true);
    expect(isInnerLayer('In2.Cu', 4)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getCopperLayers
// ---------------------------------------------------------------------------

describe('getCopperLayers', () => {
  it('returns 2 layers for 2-layer board', () => {
    expect(getCopperLayers(2)).toEqual(['F.Cu', 'B.Cu']);
  });

  it('returns 4 layers for 4-layer board', () => {
    expect(getCopperLayers(4)).toEqual(['F.Cu', 'In1.Cu', 'In2.Cu', 'B.Cu']);
  });

  it('returns 6 layers for 6-layer board', () => {
    const layers = getCopperLayers(6);
    expect(layers).toHaveLength(6);
    expect(layers[0]).toBe('F.Cu');
    expect(layers[1]).toBe('In1.Cu');
    expect(layers[2]).toBe('In2.Cu');
    expect(layers[3]).toBe('In3.Cu');
    expect(layers[4]).toBe('In4.Cu');
    expect(layers[5]).toBe('B.Cu');
  });

  it('returns 32 layers for 32-layer board', () => {
    const layers = getCopperLayers(32);
    expect(layers).toHaveLength(32);
    expect(layers[0]).toBe('F.Cu');
    expect(layers[31]).toBe('B.Cu');
    expect(layers[15]).toBe('In15.Cu');
  });

  it('clamps to at least 2 layers', () => {
    expect(getCopperLayers(1)).toEqual(['F.Cu', 'B.Cu']);
    expect(getCopperLayers(0)).toEqual(['F.Cu', 'B.Cu']);
  });

  it('clamps to at most MAX_LAYER_COUNT layers', () => {
    const layers = getCopperLayers(100);
    expect(layers).toHaveLength(MAX_LAYER_COUNT);
  });
});

// ---------------------------------------------------------------------------
// generateLayerColors
// ---------------------------------------------------------------------------

describe('generateLayerColors', () => {
  it('returns red for F.Cu and blue for B.Cu on 2-layer', () => {
    const colors = generateLayerColors(2);
    expect(colors['F.Cu']).toBe('#e74c3c');
    expect(colors['B.Cu']).toBe('#3498db');
  });

  it('includes legacy "front" and "back" aliases', () => {
    const colors = generateLayerColors(2);
    expect(colors['front']).toBe('#e74c3c');
    expect(colors['back']).toBe('#3498db');
  });

  it('generates colors for inner layers on 4-layer board', () => {
    const colors = generateLayerColors(4);
    expect(colors['F.Cu']).toBeDefined();
    expect(colors['B.Cu']).toBeDefined();
    expect(colors['In1.Cu']).toBeDefined();
    expect(colors['In2.Cu']).toBeDefined();
    // Inner layer colors should be HSL strings
    expect(colors['In1.Cu']).toMatch(/^hsl\(/);
    expect(colors['In2.Cu']).toMatch(/^hsl\(/);
  });

  it('generates unique colors for all layers on 8-layer board', () => {
    const colors = generateLayerColors(8);
    const innerColors = new Set<string>();
    for (let i = 1; i <= 6; i++) {
      const name = `In${String(i)}.Cu`;
      expect(colors[name]).toBeDefined();
      innerColors.add(colors[name]);
    }
    // All inner colors should be unique
    expect(innerColors.size).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// getLayerSpan
// ---------------------------------------------------------------------------

describe('getLayerSpan', () => {
  it('returns 2 for F.Cu to B.Cu on 2-layer board', () => {
    expect(getLayerSpan('F.Cu', 'B.Cu', 2)).toBe(2);
  });

  it('returns 4 for F.Cu to B.Cu on 4-layer board', () => {
    expect(getLayerSpan('F.Cu', 'B.Cu', 4)).toBe(4);
  });

  it('returns 2 for adjacent layers', () => {
    expect(getLayerSpan('F.Cu', 'In1.Cu', 4)).toBe(2);
    expect(getLayerSpan('In2.Cu', 'B.Cu', 4)).toBe(2);
  });

  it('works regardless of direction', () => {
    expect(getLayerSpan('B.Cu', 'F.Cu', 4)).toBe(4);
    expect(getLayerSpan('In2.Cu', 'In1.Cu', 6)).toBe(2);
  });

  it('returns 1 for same layer', () => {
    expect(getLayerSpan('F.Cu', 'F.Cu', 4)).toBe(1);
    expect(getLayerSpan('In1.Cu', 'In1.Cu', 4)).toBe(1);
  });

  it('handles legacy names', () => {
    expect(getLayerSpan('front', 'back', 4)).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// areLayersAdjacent
// ---------------------------------------------------------------------------

describe('areLayersAdjacent', () => {
  it('returns true for adjacent layers', () => {
    expect(areLayersAdjacent('F.Cu', 'In1.Cu', 4)).toBe(true);
    expect(areLayersAdjacent('In1.Cu', 'In2.Cu', 4)).toBe(true);
    expect(areLayersAdjacent('In2.Cu', 'B.Cu', 4)).toBe(true);
  });

  it('returns false for non-adjacent layers', () => {
    expect(areLayersAdjacent('F.Cu', 'In2.Cu', 4)).toBe(false);
    expect(areLayersAdjacent('F.Cu', 'B.Cu', 4)).toBe(false);
  });

  it('returns true for F.Cu and B.Cu on 2-layer board (they are adjacent)', () => {
    expect(areLayersAdjacent('F.Cu', 'B.Cu', 2)).toBe(true);
  });

  it('returns false for same layer', () => {
    expect(areLayersAdjacent('F.Cu', 'F.Cu', 4)).toBe(false);
  });

  it('works with legacy names', () => {
    expect(areLayersAdjacent('front', 'In1.Cu', 4)).toBe(true);
    expect(areLayersAdjacent('back', 'In2.Cu', 4)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('constants', () => {
  it('DEFAULT_LAYER_COUNT is 2', () => {
    expect(DEFAULT_LAYER_COUNT).toBe(2);
  });

  it('MAX_LAYER_COUNT is 32', () => {
    expect(MAX_LAYER_COUNT).toBe(32);
  });

  it('STANDARD_LAYER_NAMES has 32 entries', () => {
    expect(STANDARD_LAYER_NAMES).toHaveLength(32);
    expect(STANDARD_LAYER_NAMES[0]).toBe('F.Cu');
    expect(STANDARD_LAYER_NAMES[31]).toBe('B.Cu');
  });
});
