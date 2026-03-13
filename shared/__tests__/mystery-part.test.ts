import { describe, it, expect } from 'vitest';

import {
  createDefaultMysteryPartConfig,
  distributePins,
  buildMysteryPartView,
  MYSTERY_PART_MIN_PINS,
  MYSTERY_PART_MAX_PINS,
} from '../component-types';
import type { MysteryPartConfig, MysteryPartPin, MysteryPartPinSide } from '../component-types';

// =============================================================================
// Constants
// =============================================================================

describe('Mystery Part constants', () => {
  it('MYSTERY_PART_MIN_PINS is 2', () => {
    expect(MYSTERY_PART_MIN_PINS).toBe(2);
  });

  it('MYSTERY_PART_MAX_PINS is 40', () => {
    expect(MYSTERY_PART_MAX_PINS).toBe(40);
  });
});

// =============================================================================
// distributePins
// =============================================================================

describe('distributePins', () => {
  it('creates the correct number of pins', () => {
    expect(distributePins(4)).toHaveLength(4);
    expect(distributePins(2)).toHaveLength(2);
    expect(distributePins(8)).toHaveLength(8);
    expect(distributePins(16)).toHaveLength(16);
    expect(distributePins(40)).toHaveLength(40);
  });

  it('assigns default labels as 1-based ordinals', () => {
    const pins = distributePins(6);
    expect(pins.map((p) => p.label)).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('distributes round-robin across default sides (left, right)', () => {
    const pins = distributePins(4);
    // Round-robin: pin 0→left, 1→right, 2→left, 3→right
    expect(pins[0].side).toBe('left');
    expect(pins[1].side).toBe('right');
    expect(pins[2].side).toBe('left');
    expect(pins[3].side).toBe('right');
  });

  it('distributes round-robin across 4 sides', () => {
    const sides: MysteryPartPinSide[] = ['top', 'right', 'bottom', 'left'];
    const pins = distributePins(8, sides);

    expect(pins[0].side).toBe('top');
    expect(pins[1].side).toBe('right');
    expect(pins[2].side).toBe('bottom');
    expect(pins[3].side).toBe('left');
    expect(pins[4].side).toBe('top');
    expect(pins[5].side).toBe('right');
    expect(pins[6].side).toBe('bottom');
    expect(pins[7].side).toBe('left');
  });

  it('assigns per-side indices starting from 0', () => {
    const pins = distributePins(6, ['left', 'right']);
    // left: pins 0, 2, 4 → indices 0, 1, 2
    const leftPins = pins.filter((p) => p.side === 'left');
    expect(leftPins.map((p) => p.index)).toEqual([0, 1, 2]);
    // right: pins 1, 3, 5 → indices 0, 1, 2
    const rightPins = pins.filter((p) => p.side === 'right');
    expect(rightPins.map((p) => p.index)).toEqual([0, 1, 2]);
  });

  it('places all pins on one side when only one side is given', () => {
    const pins = distributePins(5, ['top']);
    expect(pins.every((p) => p.side === 'top')).toBe(true);
    expect(pins.map((p) => p.index)).toEqual([0, 1, 2, 3, 4]);
  });

  it('handles asymmetric distribution (3 sides, 7 pins)', () => {
    const sides: MysteryPartPinSide[] = ['left', 'top', 'right'];
    const pins = distributePins(7, sides);
    // left: 0, 3, 6 → 3 pins
    // top:  1, 4     → 2 pins
    // right: 2, 5    → 2 pins
    const leftCount = pins.filter((p) => p.side === 'left').length;
    const topCount = pins.filter((p) => p.side === 'top').length;
    const rightCount = pins.filter((p) => p.side === 'right').length;
    expect(leftCount).toBe(3);
    expect(topCount).toBe(2);
    expect(rightCount).toBe(2);
  });

  it('rejects pin count below minimum', () => {
    expect(() => distributePins(1)).toThrow(RangeError);
    expect(() => distributePins(0)).toThrow(RangeError);
    expect(() => distributePins(-1)).toThrow(RangeError);
  });

  it('rejects pin count above maximum', () => {
    expect(() => distributePins(41)).toThrow(RangeError);
    expect(() => distributePins(100)).toThrow(RangeError);
  });

  it('accepts exact minimum pin count', () => {
    const pins = distributePins(MYSTERY_PART_MIN_PINS);
    expect(pins).toHaveLength(MYSTERY_PART_MIN_PINS);
  });

  it('accepts exact maximum pin count', () => {
    const pins = distributePins(MYSTERY_PART_MAX_PINS);
    expect(pins).toHaveLength(MYSTERY_PART_MAX_PINS);
  });

  it('rejects empty sides array', () => {
    expect(() => distributePins(4, [])).toThrow(RangeError);
  });

  it('error message includes bounds', () => {
    try {
      distributePins(50);
    } catch (e) {
      expect((e as RangeError).message).toContain(String(MYSTERY_PART_MIN_PINS));
      expect((e as RangeError).message).toContain(String(MYSTERY_PART_MAX_PINS));
    }
  });
});

// =============================================================================
// createDefaultMysteryPartConfig
// =============================================================================

describe('createDefaultMysteryPartConfig', () => {
  it('creates a config with 4 pins', () => {
    const cfg = createDefaultMysteryPartConfig();
    expect(cfg.pins).toHaveLength(4);
  });

  it('has name "Mystery Part"', () => {
    const cfg = createDefaultMysteryPartConfig();
    expect(cfg.name).toBe('Mystery Part');
  });

  it('has empty description', () => {
    const cfg = createDefaultMysteryPartConfig();
    expect(cfg.description).toBe('');
  });

  it('has 4x4 body dimensions', () => {
    const cfg = createDefaultMysteryPartConfig();
    expect(cfg.bodyWidth).toBe(4);
    expect(cfg.bodyHeight).toBe(4);
  });

  it('distributes default pins across left and right', () => {
    const cfg = createDefaultMysteryPartConfig();
    const sides = new Set(cfg.pins.map((p) => p.side));
    expect(sides).toEqual(new Set(['left', 'right']));
  });

  it('assigns 2 pins per side by default', () => {
    const cfg = createDefaultMysteryPartConfig();
    const leftPins = cfg.pins.filter((p) => p.side === 'left');
    const rightPins = cfg.pins.filter((p) => p.side === 'right');
    expect(leftPins).toHaveLength(2);
    expect(rightPins).toHaveLength(2);
  });

  it('returns a fresh instance each time', () => {
    const a = createDefaultMysteryPartConfig();
    const b = createDefaultMysteryPartConfig();
    expect(a).not.toBe(b);
    expect(a.pins).not.toBe(b.pins);
  });
});

// =============================================================================
// MysteryPartConfig type-level validation
// =============================================================================

describe('MysteryPartConfig structure', () => {
  it('can construct a valid config with custom pin count 2', () => {
    const cfg: MysteryPartConfig = {
      name: 'Tiny Part',
      description: 'A 2-pin component',
      bodyWidth: 2,
      bodyHeight: 2,
      pins: distributePins(2, ['left']),
    };
    expect(cfg.pins).toHaveLength(2);
    expect(cfg.pins.every((p) => p.side === 'left')).toBe(true);
  });

  it('can construct a valid config with 8 pins on all 4 sides', () => {
    const allSides: MysteryPartPinSide[] = ['top', 'right', 'bottom', 'left'];
    const cfg: MysteryPartConfig = {
      name: '8-Pin DIP-style',
      description: '',
      bodyWidth: 4,
      bodyHeight: 6,
      pins: distributePins(8, allSides),
    };
    expect(cfg.pins).toHaveLength(8);
    // Each side should have exactly 2 pins (8 / 4 = 2)
    for (const side of allSides) {
      expect(cfg.pins.filter((p) => p.side === side)).toHaveLength(2);
    }
  });

  it('can construct a valid config with 16 pins', () => {
    const cfg: MysteryPartConfig = {
      name: 'QFP-16',
      description: '',
      bodyWidth: 6,
      bodyHeight: 6,
      pins: distributePins(16, ['top', 'right', 'bottom', 'left']),
    };
    expect(cfg.pins).toHaveLength(16);
    // 16 / 4 = 4 per side
    expect(cfg.pins.filter((p) => p.side === 'top')).toHaveLength(4);
    expect(cfg.pins.filter((p) => p.side === 'right')).toHaveLength(4);
    expect(cfg.pins.filter((p) => p.side === 'bottom')).toHaveLength(4);
    expect(cfg.pins.filter((p) => p.side === 'left')).toHaveLength(4);
  });

  it('can construct a valid config with 40 pins (maximum)', () => {
    const cfg: MysteryPartConfig = {
      name: 'Max Pin Part',
      description: '',
      bodyWidth: 10,
      bodyHeight: 10,
      pins: distributePins(40, ['left', 'right']),
    };
    expect(cfg.pins).toHaveLength(40);
    expect(cfg.pins.filter((p) => p.side === 'left')).toHaveLength(20);
    expect(cfg.pins.filter((p) => p.side === 'right')).toHaveLength(20);
  });

  it('pin label assignment is preserved', () => {
    const pins = distributePins(4);
    pins[0].label = 'VCC';
    pins[1].label = 'GND';
    pins[2].label = 'SDA';
    pins[3].label = 'SCL';

    const cfg: MysteryPartConfig = {
      name: 'I2C Module',
      description: '',
      bodyWidth: 4,
      bodyHeight: 4,
      pins,
    };

    expect(cfg.pins[0].label).toBe('VCC');
    expect(cfg.pins[1].label).toBe('GND');
    expect(cfg.pins[2].label).toBe('SDA');
    expect(cfg.pins[3].label).toBe('SCL');
  });
});

// =============================================================================
// MysteryPartPin interface
// =============================================================================

describe('MysteryPartPin', () => {
  it('has required fields: label, side, index', () => {
    const pin: MysteryPartPin = { label: 'A0', side: 'top', index: 0 };
    expect(pin.label).toBe('A0');
    expect(pin.side).toBe('top');
    expect(pin.index).toBe(0);
  });

  it('side accepts all four valid values', () => {
    const sides: MysteryPartPinSide[] = ['top', 'right', 'bottom', 'left'];
    for (const side of sides) {
      const pin: MysteryPartPin = { label: 'X', side, index: 0 };
      expect(pin.side).toBe(side);
    }
  });
});

// =============================================================================
// buildMysteryPartView
// =============================================================================

describe('buildMysteryPartView', () => {
  it('returns connectors matching pin count', () => {
    const cfg = createDefaultMysteryPartConfig();
    const view = buildMysteryPartView(cfg);
    expect(view.connectors).toHaveLength(cfg.pins.length);
  });

  it('creates shapes (body + label + pins)', () => {
    const cfg = createDefaultMysteryPartConfig();
    const view = buildMysteryPartView(cfg);
    // body + label + 4 pin shapes = 6
    expect(view.shapes).toHaveLength(cfg.pins.length + 2);
  });

  it('body shape has neon cyan stroke', () => {
    const cfg = createDefaultMysteryPartConfig();
    const view = buildMysteryPartView(cfg);
    const body = view.shapes.find((s) => s.id === 'body-sch');
    expect(body).toBeDefined();
    expect(body!.type).toBe('rect');
    if (body!.type === 'rect') {
      expect(body!.style?.stroke).toBe('#00F0FF');
    }
  });

  it('label shape contains config name', () => {
    const cfg = createDefaultMysteryPartConfig();
    cfg.name = 'Test IC';
    const view = buildMysteryPartView(cfg);
    const label = view.shapes.find((s) => s.id === 'label-sch');
    expect(label).toBeDefined();
    expect(label!.type).toBe('text');
    if (label!.type === 'text') {
      expect(label!.text).toBe('Test IC');
    }
  });

  it('connectors have pad specs with THT type', () => {
    const cfg = createDefaultMysteryPartConfig();
    const view = buildMysteryPartView(cfg);
    for (const conn of view.connectors) {
      expect(conn.padSpec).toBeDefined();
      expect(conn.padSpec!.type).toBe('tht');
    }
  });

  it('connectors have terminal positions in schematic view', () => {
    const cfg = createDefaultMysteryPartConfig();
    const view = buildMysteryPartView(cfg);
    for (const conn of view.connectors) {
      expect(conn.terminalPositions).toHaveProperty('schematic');
      expect(typeof conn.terminalPositions.schematic.x).toBe('number');
      expect(typeof conn.terminalPositions.schematic.y).toBe('number');
    }
  });

  it('connector names match pin labels', () => {
    const cfg = createDefaultMysteryPartConfig();
    cfg.pins[0].label = 'VIN';
    cfg.pins[1].label = 'VOUT';
    const view = buildMysteryPartView(cfg);
    expect(view.connectors[0].name).toBe('VIN');
    expect(view.connectors[1].name).toBe('VOUT');
  });

  it('handles single-side config', () => {
    const cfg: MysteryPartConfig = {
      name: 'Header',
      description: '',
      bodyWidth: 2,
      bodyHeight: 8,
      pins: distributePins(6, ['left']),
    };
    const view = buildMysteryPartView(cfg);
    expect(view.connectors).toHaveLength(6);
    expect(view.shapes).toHaveLength(8); // body + label + 6 pins
  });

  it('handles 4-side config', () => {
    const cfg: MysteryPartConfig = {
      name: 'QFP',
      description: '',
      bodyWidth: 8,
      bodyHeight: 8,
      pins: distributePins(20, ['top', 'right', 'bottom', 'left']),
    };
    const view = buildMysteryPartView(cfg);
    expect(view.connectors).toHaveLength(20);
    expect(view.shapes).toHaveLength(22); // body + label + 20 pins
  });

  it('uses config name in label shape, defaulting to ? for empty', () => {
    const cfg = createDefaultMysteryPartConfig();
    cfg.name = '';
    const view = buildMysteryPartView(cfg);
    const label = view.shapes.find((s) => s.id === 'label-sch');
    expect(label).toBeDefined();
    if (label!.type === 'text') {
      expect(label!.text).toBe('?');
    }
  });
});

// =============================================================================
// Edge cases
// =============================================================================

describe('Edge cases', () => {
  it('2-pin part has exactly 2 connectors and 4 shapes', () => {
    const cfg: MysteryPartConfig = {
      name: 'Diode',
      description: '',
      bodyWidth: 2,
      bodyHeight: 2,
      pins: distributePins(2, ['left', 'right']),
    };
    const view = buildMysteryPartView(cfg);
    expect(view.connectors).toHaveLength(2);
    expect(view.shapes).toHaveLength(4); // body + label + 2 pins
  });

  it('40-pin part has exactly 40 connectors', () => {
    const cfg: MysteryPartConfig = {
      name: 'Large IC',
      description: '',
      bodyWidth: 12,
      bodyHeight: 12,
      pins: distributePins(40, ['top', 'right', 'bottom', 'left']),
    };
    const view = buildMysteryPartView(cfg);
    expect(view.connectors).toHaveLength(40);
    expect(view.shapes).toHaveLength(42);
  });

  it('duplicate side in sides array still works', () => {
    // ['left', 'left'] — all pins go to left, just with double round-robin
    const pins = distributePins(4, ['left', 'left']);
    expect(pins.every((p) => p.side === 'left')).toBe(true);
    expect(pins).toHaveLength(4);
  });

  it('body dimensions scale correctly in view output', () => {
    const cfg: MysteryPartConfig = {
      name: 'Wide',
      description: '',
      bodyWidth: 10,
      bodyHeight: 3,
      pins: distributePins(4),
    };
    const view = buildMysteryPartView(cfg);
    const body = view.shapes.find((s) => s.id === 'body-sch');
    expect(body).toBeDefined();
    // gridPx = 30, so width=10*30=300, height=3*30=90
    expect(body!.width).toBe(300);
    expect(body!.height).toBe(90);
  });
});
