/**
 * Tests for component-visual-renderers.ts
 *
 * BL-0619: Component visual state rendering during simulation
 */

import { describe, it, expect } from 'vitest';
import {
  mapSimulationToVisual,
  normalizeComponentType,
  getVisualCSS,
  getComponentVisualClass,
  mapAllComponentVisuals,
} from '../component-visual-renderers';
import type {
  SimulationValues,
  ComponentMapping,
  ComponentVisualProps,
} from '../component-visual-renderers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSim(
  nodeVoltages: Record<number, number>,
  branchCurrents: Record<string, number>,
): SimulationValues {
  return { nodeVoltages, branchCurrents };
}

function makeMapping(
  overrides: Partial<ComponentMapping> = {},
): ComponentMapping {
  return {
    instanceId: 'inst-1',
    componentType: 'resistor',
    componentId: 'R1',
    nodePositive: 1,
    nodeNegative: 0,
    properties: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// normalizeComponentType
// ---------------------------------------------------------------------------

describe('normalizeComponentType', () => {
  it('maps led aliases correctly', () => {
    expect(normalizeComponentType('led')).toBe('led');
    expect(normalizeComponentType('LED')).toBe('led');
    expect(normalizeComponentType('diode_led')).toBe('led');
    expect(normalizeComponentType('light-emitting-diode')).toBe('led');
  });

  it('maps resistor aliases correctly', () => {
    expect(normalizeComponentType('resistor')).toBe('resistor');
    expect(normalizeComponentType('R')).toBe('resistor');
    expect(normalizeComponentType('res')).toBe('resistor');
  });

  it('maps motor aliases', () => {
    expect(normalizeComponentType('motor')).toBe('motor');
    expect(normalizeComponentType('DC Motor')).toBe('motor');
    expect(normalizeComponentType('dcmotor')).toBe('motor');
  });

  it('maps servo aliases', () => {
    expect(normalizeComponentType('servo')).toBe('servo');
    expect(normalizeComponentType('servo_motor')).toBe('servo');
  });

  it('maps relay aliases', () => {
    expect(normalizeComponentType('relay')).toBe('relay');
    expect(normalizeComponentType('spdt_relay')).toBe('relay');
    expect(normalizeComponentType('dpdt_relay')).toBe('relay');
  });

  it('maps switch aliases', () => {
    expect(normalizeComponentType('switch')).toBe('switch');
    expect(normalizeComponentType('SPST')).toBe('switch');
    expect(normalizeComponentType('button')).toBe('switch');
    expect(normalizeComponentType('pushbutton')).toBe('switch');
    expect(normalizeComponentType('tactile_switch')).toBe('switch');
  });

  it('maps buzzer aliases', () => {
    expect(normalizeComponentType('buzzer')).toBe('buzzer');
    expect(normalizeComponentType('piezo')).toBe('buzzer');
    expect(normalizeComponentType('speaker')).toBe('buzzer');
  });

  it('maps potentiometer aliases', () => {
    expect(normalizeComponentType('potentiometer')).toBe('potentiometer');
    expect(normalizeComponentType('pot')).toBe('potentiometer');
    expect(normalizeComponentType('trimpot')).toBe('potentiometer');
    expect(normalizeComponentType('variable_resistor')).toBe('potentiometer');
  });

  it('maps seven_segment aliases', () => {
    expect(normalizeComponentType('seven_segment')).toBe('seven_segment');
    expect(normalizeComponentType('7seg')).toBe('seven_segment');
    expect(normalizeComponentType('7segment')).toBe('seven_segment');
    expect(normalizeComponentType('seven_seg')).toBe('seven_segment');
  });

  it('returns generic for unknown types', () => {
    expect(normalizeComponentType('capacitor')).toBe('generic');
    expect(normalizeComponentType('inductor')).toBe('generic');
    expect(normalizeComponentType('transistor')).toBe('generic');
    expect(normalizeComponentType('')).toBe('generic');
  });

  it('handles whitespace and hyphens in names', () => {
    expect(normalizeComponentType('DC Motor')).toBe('motor');
    expect(normalizeComponentType('tactile-switch')).toBe('switch');
    expect(normalizeComponentType('variable resistor')).toBe('potentiometer');
  });
});

// ---------------------------------------------------------------------------
// mapSimulationToVisual — LED
// ---------------------------------------------------------------------------

describe('mapSimulationToVisual — LED', () => {
  it('returns not glowing when current is below threshold', () => {
    const sim = makeSim({ 1: 2.0, 0: 0 }, { LED1: 0.0005 }); // 0.5mA < 1mA threshold
    const result = mapSimulationToVisual('led', sim, makeMapping({
      componentType: 'led',
      componentId: 'LED1',
      properties: { color: 'red' },
    }));

    expect(result.type).toBe('led');
    if (result.type === 'led') {
      expect(result.props.glowing).toBe(false);
      expect(result.props.glowIntensity).toBe(0);
    }
  });

  it('returns dim glow at low current', () => {
    const sim = makeSim({ 1: 2.0, 0: 0 }, { LED1: 0.002 }); // 2mA
    const result = mapSimulationToVisual('led', sim, makeMapping({
      componentType: 'led',
      componentId: 'LED1',
      properties: { color: 'green' },
    }));

    expect(result.type).toBe('led');
    if (result.type === 'led') {
      expect(result.props.glowing).toBe(true);
      expect(result.props.glowIntensity).toBeGreaterThan(0);
      expect(result.props.glowIntensity).toBeLessThan(1);
      expect(result.props.color).toBe('#22c55e');
    }
  });

  it('returns full glow at max current', () => {
    const sim = makeSim({ 1: 3.0, 0: 0 }, { LED1: 0.025 }); // 25mA > 20mA max
    const result = mapSimulationToVisual('led', sim, makeMapping({
      componentType: 'led',
      componentId: 'LED1',
      properties: { color: 'blue' },
    }));

    expect(result.type).toBe('led');
    if (result.type === 'led') {
      expect(result.props.glowing).toBe(true);
      expect(result.props.glowIntensity).toBe(1);
      expect(result.props.color).toBe('#3b82f6');
    }
  });

  it('defaults to red when no color specified', () => {
    const sim = makeSim({ 1: 2.0, 0: 0 }, { LED1: 0.010 });
    const result = mapSimulationToVisual('led', sim, makeMapping({
      componentType: 'led',
      componentId: 'LED1',
    }));

    expect(result.type).toBe('led');
    if (result.type === 'led') {
      expect(result.props.color).toBe('#ef4444');
    }
  });

  it('handles zero current', () => {
    const sim = makeSim({ 1: 0, 0: 0 }, { LED1: 0 });
    const result = mapSimulationToVisual('led', sim, makeMapping({
      componentType: 'led',
      componentId: 'LED1',
    }));

    expect(result.type).toBe('led');
    if (result.type === 'led') {
      expect(result.props.glowing).toBe(false);
      expect(result.props.glowIntensity).toBe(0);
    }
  });

  it('handles negative current (abs value used)', () => {
    const sim = makeSim({ 1: 0, 0: 2.0 }, { LED1: -0.015 });
    const result = mapSimulationToVisual('led', sim, makeMapping({
      componentType: 'led',
      componentId: 'LED1',
      properties: { color: 'yellow' },
    }));

    expect(result.type).toBe('led');
    if (result.type === 'led') {
      expect(result.props.glowing).toBe(true);
      expect(result.props.glowIntensity).toBeGreaterThan(0.5);
      expect(result.props.color).toBe('#eab308');
    }
  });

  it('supports all LED colors', () => {
    const sim = makeSim({ 1: 2, 0: 0 }, { L: 0.010 });
    const colors = ['red', 'green', 'blue', 'yellow', 'white', 'orange', 'purple', 'pink'];
    const expectedCSS = ['#ef4444', '#22c55e', '#3b82f6', '#eab308', '#f5f5f5', '#f97316', '#a855f7', '#ec4899'];

    for (let i = 0; i < colors.length; i++) {
      const result = mapSimulationToVisual('led', sim, makeMapping({
        componentId: 'L',
        properties: { color: colors[i] },
      }));
      if (result.type === 'led') {
        expect(result.props.color).toBe(expectedCSS[i]);
      }
    }
  });

  it('handles diode_led alias', () => {
    const sim = makeSim({ 1: 2, 0: 0 }, { D1: 0.010 });
    const result = mapSimulationToVisual('diode_led', sim, makeMapping({
      componentId: 'D1',
      properties: { color: 'white' },
    }));
    expect(result.type).toBe('led');
  });
});

// ---------------------------------------------------------------------------
// mapSimulationToVisual — Resistor
// ---------------------------------------------------------------------------

describe('mapSimulationToVisual — Resistor', () => {
  it('returns zero heat at zero power', () => {
    const sim = makeSim({ 1: 0, 0: 0 }, { R1: 0 });
    const result = mapSimulationToVisual('resistor', sim, makeMapping());

    expect(result.type).toBe('resistor');
    if (result.type === 'resistor') {
      expect(result.props.heatLevel).toBe(0);
      expect(result.props.powerDissipation).toBe(0);
    }
  });

  it('returns partial heat at moderate power', () => {
    const sim = makeSim({ 1: 5.0, 0: 0 }, { R1: 0.050 }); // 5V * 50mA = 0.25W
    const result = mapSimulationToVisual('resistor', sim, makeMapping());

    expect(result.type).toBe('resistor');
    if (result.type === 'resistor') {
      expect(result.props.heatLevel).toBeCloseTo(0.5, 1);
      expect(result.props.powerDissipation).toBeCloseTo(0.25, 2);
    }
  });

  it('clamps heat at 1.0 for high power', () => {
    const sim = makeSim({ 1: 12, 0: 0 }, { R1: 0.1 }); // 12V * 0.1A = 1.2W > 0.5W max
    const result = mapSimulationToVisual('resistor', sim, makeMapping());

    expect(result.type).toBe('resistor');
    if (result.type === 'resistor') {
      expect(result.props.heatLevel).toBe(1);
    }
  });

  it('handles negative voltage/current (abs values used)', () => {
    const sim = makeSim({ 1: 0, 0: 3.0 }, { R1: -0.030 });
    const result = mapSimulationToVisual('resistor', sim, makeMapping());

    expect(result.type).toBe('resistor');
    if (result.type === 'resistor') {
      expect(result.props.powerDissipation).toBeCloseTo(0.09, 2);
      expect(result.props.heatLevel).toBeGreaterThan(0);
    }
  });

  it('recognizes "R" alias as resistor', () => {
    const sim = makeSim({ 1: 5, 0: 0 }, { R1: 0.01 });
    const result = mapSimulationToVisual('R', sim, makeMapping());
    expect(result.type).toBe('resistor');
  });
});

// ---------------------------------------------------------------------------
// mapSimulationToVisual — Motor
// ---------------------------------------------------------------------------

describe('mapSimulationToVisual — Motor', () => {
  it('returns stopped below minimum voltage', () => {
    const sim = makeSim({ 1: 0.3, 0: 0 }, { M1: 0 });
    const result = mapSimulationToVisual('motor', sim, makeMapping({
      componentId: 'M1',
      componentType: 'motor',
    }));

    expect(result.type).toBe('motor');
    if (result.type === 'motor') {
      expect(result.props.direction).toBe('stopped');
      expect(result.props.rotationSpeed).toBe(0);
    }
  });

  it('returns CW rotation at positive voltage', () => {
    const sim = makeSim({ 1: 6.0, 0: 0 }, { M1: 0.5 });
    const result = mapSimulationToVisual('motor', sim, makeMapping({
      componentId: 'M1',
      componentType: 'motor',
    }));

    expect(result.type).toBe('motor');
    if (result.type === 'motor') {
      expect(result.props.direction).toBe('cw');
      expect(result.props.rotationSpeed).toBeGreaterThan(0);
      expect(result.props.rotationSpeed).toBeLessThanOrEqual(720);
    }
  });

  it('returns CCW rotation at negative voltage', () => {
    const sim = makeSim({ 1: 0, 0: 6.0 }, { M1: -0.5 });
    const result = mapSimulationToVisual('motor', sim, makeMapping({
      componentId: 'M1',
      componentType: 'motor',
    }));

    expect(result.type).toBe('motor');
    if (result.type === 'motor') {
      expect(result.props.direction).toBe('ccw');
      expect(result.props.rotationSpeed).toBeGreaterThan(0);
    }
  });

  it('caps speed at nominal voltage', () => {
    const sim = makeSim({ 1: 24, 0: 0 }, { M1: 2 }); // 24V > 12V nominal
    const result = mapSimulationToVisual('motor', sim, makeMapping({
      componentId: 'M1',
      componentType: 'motor',
    }));

    expect(result.type).toBe('motor');
    if (result.type === 'motor') {
      expect(result.props.rotationSpeed).toBe(720); // max
    }
  });

  it('handles dc_motor alias', () => {
    const sim = makeSim({ 1: 5, 0: 0 }, { M1: 0.3 });
    const result = mapSimulationToVisual('dc_motor', sim, makeMapping({ componentId: 'M1' }));
    expect(result.type).toBe('motor');
  });
});

// ---------------------------------------------------------------------------
// mapSimulationToVisual — Servo
// ---------------------------------------------------------------------------

describe('mapSimulationToVisual — Servo', () => {
  it('defaults to 90 degrees (center) without controlSignal', () => {
    const sim = makeSim({ 1: 5, 0: 0 }, {});
    const result = mapSimulationToVisual('servo', sim, makeMapping({
      componentType: 'servo',
      properties: {},
    }));

    expect(result.type).toBe('servo');
    if (result.type === 'servo') {
      expect(result.props.angle).toBe(90);
    }
  });

  it('uses controlSignal from properties', () => {
    const sim = makeSim({ 1: 5, 0: 0 }, {});
    const result = mapSimulationToVisual('servo', sim, makeMapping({
      componentType: 'servo',
      properties: { controlSignal: 45 },
    }));

    expect(result.type).toBe('servo');
    if (result.type === 'servo') {
      expect(result.props.angle).toBe(45);
    }
  });

  it('clamps controlSignal to 0-180 range', () => {
    const sim = makeSim({}, {});
    const resultLow = mapSimulationToVisual('servo', sim, makeMapping({
      componentType: 'servo',
      properties: { controlSignal: -10 },
    }));
    const resultHigh = mapSimulationToVisual('servo', sim, makeMapping({
      componentType: 'servo',
      properties: { controlSignal: 200 },
    }));

    if (resultLow.type === 'servo') { expect(resultLow.props.angle).toBe(0); }
    if (resultHigh.type === 'servo') { expect(resultHigh.props.angle).toBe(180); }
  });
});

// ---------------------------------------------------------------------------
// mapSimulationToVisual — Relay
// ---------------------------------------------------------------------------

describe('mapSimulationToVisual — Relay', () => {
  it('is de-energized below threshold', () => {
    const sim = makeSim({ 1: 5, 0: 0 }, { K1: 0.020 }); // 20mA < 50mA threshold
    const result = mapSimulationToVisual('relay', sim, makeMapping({
      componentId: 'K1',
      componentType: 'relay',
    }));

    expect(result.type).toBe('relay');
    if (result.type === 'relay') {
      expect(result.props.energized).toBe(false);
      expect(result.props.coilCurrent).toBe(0.020);
    }
  });

  it('is energized at/above threshold', () => {
    const sim = makeSim({ 1: 12, 0: 0 }, { K1: 0.060 }); // 60mA >= 50mA
    const result = mapSimulationToVisual('relay', sim, makeMapping({
      componentId: 'K1',
      componentType: 'relay',
    }));

    expect(result.type).toBe('relay');
    if (result.type === 'relay') {
      expect(result.props.energized).toBe(true);
    }
  });

  it('handles zero current', () => {
    const sim = makeSim({ 1: 0, 0: 0 }, { K1: 0 });
    const result = mapSimulationToVisual('relay', sim, makeMapping({
      componentId: 'K1',
      componentType: 'relay',
    }));

    if (result.type === 'relay') {
      expect(result.props.energized).toBe(false);
      expect(result.props.coilCurrent).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// mapSimulationToVisual — Switch
// ---------------------------------------------------------------------------

describe('mapSimulationToVisual — Switch', () => {
  it('is open when no current flows', () => {
    const sim = makeSim({ 1: 0, 0: 0 }, { SW1: 0 });
    const result = mapSimulationToVisual('switch', sim, makeMapping({
      componentId: 'SW1',
      componentType: 'switch',
    }));

    expect(result.type).toBe('switch');
    if (result.type === 'switch') {
      expect(result.props.closed).toBe(false);
    }
  });

  it('is closed when current flows', () => {
    const sim = makeSim({ 1: 5, 0: 0 }, { SW1: 0.010 });
    const result = mapSimulationToVisual('switch', sim, makeMapping({
      componentId: 'SW1',
      componentType: 'switch',
    }));

    expect(result.type).toBe('switch');
    if (result.type === 'switch') {
      expect(result.props.closed).toBe(true);
    }
  });

  it('handles SPST alias', () => {
    const sim = makeSim({}, { SW1: 0.001 });
    const result = mapSimulationToVisual('SPST', sim, makeMapping({ componentId: 'SW1' }));
    expect(result.type).toBe('switch');
  });

  it('handles button alias', () => {
    const sim = makeSim({}, { B1: 0 });
    const result = mapSimulationToVisual('button', sim, makeMapping({ componentId: 'B1' }));
    expect(result.type).toBe('switch');
  });
});

// ---------------------------------------------------------------------------
// mapSimulationToVisual — Buzzer
// ---------------------------------------------------------------------------

describe('mapSimulationToVisual — Buzzer', () => {
  it('is not pulsing below minimum voltage', () => {
    const sim = makeSim({ 1: 1.0, 0: 0 }, { BZ1: 0.001 });
    const result = mapSimulationToVisual('buzzer', sim, makeMapping({
      componentId: 'BZ1',
      componentType: 'buzzer',
    }));

    expect(result.type).toBe('buzzer');
    if (result.type === 'buzzer') {
      expect(result.props.pulsing).toBe(false);
      expect(result.props.frequency).toBe(0);
    }
  });

  it('is pulsing at sufficient voltage', () => {
    const sim = makeSim({ 1: 5.0, 0: 0 }, { BZ1: 0.020 });
    const result = mapSimulationToVisual('buzzer', sim, makeMapping({
      componentId: 'BZ1',
      componentType: 'buzzer',
    }));

    expect(result.type).toBe('buzzer');
    if (result.type === 'buzzer') {
      expect(result.props.pulsing).toBe(true);
      expect(result.props.frequency).toBeGreaterThan(0);
      expect(result.props.frequency).toBeLessThanOrEqual(10);
    }
  });

  it('handles zero voltage', () => {
    const sim = makeSim({ 1: 0, 0: 0 }, { BZ1: 0 });
    const result = mapSimulationToVisual('buzzer', sim, makeMapping({
      componentId: 'BZ1',
      componentType: 'buzzer',
    }));

    if (result.type === 'buzzer') {
      expect(result.props.pulsing).toBe(false);
    }
  });

  it('handles piezo alias', () => {
    const sim = makeSim({ 1: 3, 0: 0 }, { P: 0.01 });
    const result = mapSimulationToVisual('piezo', sim, makeMapping({ componentId: 'P' }));
    expect(result.type).toBe('buzzer');
  });
});

// ---------------------------------------------------------------------------
// mapSimulationToVisual — Potentiometer
// ---------------------------------------------------------------------------

describe('mapSimulationToVisual — Potentiometer', () => {
  it('defaults to 50% position', () => {
    const sim = makeSim({}, {});
    const result = mapSimulationToVisual('potentiometer', sim, makeMapping({
      componentType: 'potentiometer',
    }));

    expect(result.type).toBe('potentiometer');
    if (result.type === 'potentiometer') {
      expect(result.props.position).toBe(0.5);
      expect(result.props.angle).toBe(135); // 0.5 * 270
    }
  });

  it('uses position from properties', () => {
    const sim = makeSim({}, {});
    const result = mapSimulationToVisual('pot', sim, makeMapping({
      componentType: 'pot',
      properties: { position: 0.75 },
    }));

    if (result.type === 'potentiometer') {
      expect(result.props.position).toBe(0.75);
      expect(result.props.angle).toBeCloseTo(202.5, 1); // 0.75 * 270
    }
  });

  it('clamps position to 0-1', () => {
    const sim = makeSim({}, {});
    const resultLow = mapSimulationToVisual('potentiometer', sim, makeMapping({
      properties: { position: -0.5 },
    }));
    const resultHigh = mapSimulationToVisual('potentiometer', sim, makeMapping({
      properties: { position: 1.5 },
    }));

    if (resultLow.type === 'potentiometer') {
      expect(resultLow.props.position).toBe(0);
      expect(resultLow.props.angle).toBe(0);
    }
    if (resultHigh.type === 'potentiometer') {
      expect(resultHigh.props.position).toBe(1);
      expect(resultHigh.props.angle).toBe(270);
    }
  });
});

// ---------------------------------------------------------------------------
// mapSimulationToVisual — SevenSegment
// ---------------------------------------------------------------------------

describe('mapSimulationToVisual — SevenSegment', () => {
  it('displays digit 0 from digit property', () => {
    const sim = makeSim({}, {});
    const result = mapSimulationToVisual('seven_segment', sim, makeMapping({
      properties: { digit: 0 },
    }));

    expect(result.type).toBe('seven_segment');
    if (result.type === 'seven_segment') {
      // Digit 0: a,b,c,d,e,f on; g off
      expect(result.props.segments).toEqual([true, true, true, true, true, true, false]);
    }
  });

  it('displays digit 1 correctly', () => {
    const sim = makeSim({}, {});
    const result = mapSimulationToVisual('seven_segment', sim, makeMapping({
      properties: { digit: 1 },
    }));

    if (result.type === 'seven_segment') {
      expect(result.props.segments).toEqual([false, true, true, false, false, false, false]);
    }
  });

  it('displays digit 8 (all segments)', () => {
    const sim = makeSim({}, {});
    const result = mapSimulationToVisual('seven_segment', sim, makeMapping({
      properties: { digit: 8 },
    }));

    if (result.type === 'seven_segment') {
      expect(result.props.segments).toEqual([true, true, true, true, true, true, true]);
    }
  });

  it('uses segmentBits array when provided', () => {
    const sim = makeSim({}, {});
    const segs = [true, false, true, false, true, false, true];
    const result = mapSimulationToVisual('seven_segment', sim, makeMapping({
      properties: { segmentBits: segs },
    }));

    if (result.type === 'seven_segment') {
      expect(result.props.segments).toEqual(segs);
    }
  });

  it('uses numeric bitmask for segmentBits', () => {
    const sim = makeSim({}, {});
    // bitmask 0b01010101 = 85 → a=1, b=0, c=1, d=0, e=1, f=0, g=1
    const result = mapSimulationToVisual('seven_segment', sim, makeMapping({
      properties: { segmentBits: 0b01010101 },
    }));

    if (result.type === 'seven_segment') {
      expect(result.props.segments).toEqual([true, false, true, false, true, false, true]);
    }
  });

  it('handles decimal point in bitmask', () => {
    const sim = makeSim({}, {});
    const result = mapSimulationToVisual('seven_segment', sim, makeMapping({
      properties: { segmentBits: 0b11111111 }, // all segments + dp
    }));

    if (result.type === 'seven_segment') {
      expect(result.props.decimalPoint).toBe(true);
    }
  });

  it('defaults to all off with no properties', () => {
    const sim = makeSim({}, {});
    const result = mapSimulationToVisual('seven_segment', sim, makeMapping({
      properties: {},
    }));

    if (result.type === 'seven_segment') {
      expect(result.props.segments).toEqual([false, false, false, false, false, false, false]);
      expect(result.props.decimalPoint).toBe(false);
    }
  });

  it('handles 7seg alias', () => {
    const sim = makeSim({}, {});
    const result = mapSimulationToVisual('7seg', sim, makeMapping({
      properties: { digit: 5 },
    }));
    expect(result.type).toBe('seven_segment');
  });
});

// ---------------------------------------------------------------------------
// mapSimulationToVisual — Generic
// ---------------------------------------------------------------------------

describe('mapSimulationToVisual — Generic (unknown types)', () => {
  it('returns generic with voltage and current for unknown types', () => {
    const sim = makeSim({ 1: 3.3, 0: 0 }, { C1: 0.001 });
    const result = mapSimulationToVisual('capacitor', sim, makeMapping({
      componentId: 'C1',
      componentType: 'capacitor',
    }));

    expect(result.type).toBe('generic');
    if (result.type === 'generic') {
      expect(result.props.voltageDrop).toBeCloseTo(3.3, 1);
      expect(result.props.current).toBe(0.001);
    }
  });

  it('handles missing component in branchCurrents', () => {
    const sim = makeSim({ 1: 5, 0: 0 }, {});
    const result = mapSimulationToVisual('inductor', sim, makeMapping({
      componentId: 'L1',
    }));

    if (result.type === 'generic') {
      expect(result.props.current).toBe(0);
    }
  });

  it('handles missing nodes in nodeVoltages', () => {
    const sim = makeSim({}, { X1: 0.5 });
    const result = mapSimulationToVisual('unknown', sim, makeMapping({
      componentId: 'X1',
      nodePositive: 99,
      nodeNegative: 100,
    }));

    if (result.type === 'generic') {
      expect(result.props.voltageDrop).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// getVisualCSS
// ---------------------------------------------------------------------------

describe('getVisualCSS', () => {
  it('returns base style for non-glowing LED', () => {
    const css = getVisualCSS({ type: 'led', props: { glowIntensity: 0, color: '#ef4444', glowing: false } });
    expect(css.transition).toBeDefined();
    expect(css.boxShadow).toBeUndefined();
  });

  it('returns box-shadow for glowing LED', () => {
    const css = getVisualCSS({ type: 'led', props: { glowIntensity: 0.8, color: '#22c55e', glowing: true } });
    expect(css.boxShadow).toBeDefined();
    expect(css.boxShadow).toContain('#22c55e');
    expect(css.borderRadius).toBe('50%');
  });

  it('returns heat glow for hot resistor', () => {
    const css = getVisualCSS({ type: 'resistor', props: { heatLevel: 0.7, powerDissipation: 0.35 } });
    expect(css.boxShadow).toBeDefined();
    expect(css.borderStyle).toBe('solid');
  });

  it('returns no extra styling for cold resistor', () => {
    const css = getVisualCSS({ type: 'resistor', props: { heatLevel: 0, powerDissipation: 0 } });
    expect(css.boxShadow).toBeUndefined();
  });

  it('returns animation for spinning motor', () => {
    const css = getVisualCSS({ type: 'motor', props: { rotationSpeed: 360, direction: 'cw' } });
    expect(css.animation).toBeDefined();
    expect(css.animation).toContain('sim-motor-spin');
  });

  it('returns no animation for stopped motor', () => {
    const css = getVisualCSS({ type: 'motor', props: { rotationSpeed: 0, direction: 'stopped' } });
    expect(css.animation).toBeUndefined();
  });

  it('returns rotation transform for servo', () => {
    const css = getVisualCSS({ type: 'servo', props: { angle: 45 } });
    expect(css.transform).toBe('rotate(-45deg)');
    expect(css.transformOrigin).toBe('center center');
  });

  it('returns green border for energized relay', () => {
    const css = getVisualCSS({ type: 'relay', props: { energized: true, coilCurrent: 0.1 } });
    expect(css.borderColor).toBe('#22c55e');
  });

  it('returns red border for de-energized relay', () => {
    const css = getVisualCSS({ type: 'relay', props: { energized: false, coilCurrent: 0 } });
    expect(css.borderColor).toBe('#ef4444');
  });

  it('returns solid border for closed switch', () => {
    const css = getVisualCSS({ type: 'switch', props: { closed: true } });
    expect(css.borderStyle).toBe('solid');
    expect(css.borderColor).toBe('#22c55e');
  });

  it('returns dashed border for open switch', () => {
    const css = getVisualCSS({ type: 'switch', props: { closed: false } });
    expect(css.borderStyle).toBe('dashed');
    expect(css.borderColor).toBe('#ef4444');
  });

  it('returns pulse animation for active buzzer', () => {
    const css = getVisualCSS({ type: 'buzzer', props: { pulsing: true, frequency: 5 } });
    expect(css.animation).toContain('sim-buzzer-pulse');
    expect(css.animation).toContain('0.2s'); // 1/5Hz = 0.2s
  });

  it('returns rotation for potentiometer', () => {
    const css = getVisualCSS({ type: 'potentiometer', props: { angle: 135, position: 0.5 } });
    expect(css.transform).toBe('rotate(135deg)');
  });

  it('returns base style for seven_segment', () => {
    const css = getVisualCSS({
      type: 'seven_segment',
      props: { segments: Array(7).fill(true) as boolean[], decimalPoint: false },
    });
    expect(css.transition).toBeDefined();
  });

  it('returns base style for generic', () => {
    const css = getVisualCSS({ type: 'generic', props: { voltageDrop: 5, current: 0.01 } });
    expect(css.transition).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// getComponentVisualClass
// ---------------------------------------------------------------------------

describe('getComponentVisualClass', () => {
  it('includes base class for all types', () => {
    const types: ComponentVisualProps[] = [
      { type: 'led', props: { glowIntensity: 0, color: '#f00', glowing: false } },
      { type: 'resistor', props: { heatLevel: 0, powerDissipation: 0 } },
      { type: 'motor', props: { rotationSpeed: 0, direction: 'stopped' } },
      { type: 'switch', props: { closed: true } },
      { type: 'generic', props: { voltageDrop: 0, current: 0 } },
    ];

    for (const vis of types) {
      expect(getComponentVisualClass(vis)).toContain('sim-component-visual');
    }
  });

  it('adds active class for glowing LED', () => {
    const cls = getComponentVisualClass({ type: 'led', props: { glowIntensity: 1, color: '#f00', glowing: true } });
    expect(cls).toContain('sim-vis-led-active');
  });

  it('adds hot class for resistor above 0.5 heat', () => {
    const cls = getComponentVisualClass({ type: 'resistor', props: { heatLevel: 0.6, powerDissipation: 0.3 } });
    expect(cls).toContain('sim-vis-resistor-hot');
    expect(cls).not.toContain('sim-vis-resistor-critical');
  });

  it('adds critical class for resistor above 0.8 heat', () => {
    const cls = getComponentVisualClass({ type: 'resistor', props: { heatLevel: 0.9, powerDissipation: 0.45 } });
    expect(cls).toContain('sim-vis-resistor-hot');
    expect(cls).toContain('sim-vis-resistor-critical');
  });

  it('adds spinning class for active motor', () => {
    const cls = getComponentVisualClass({ type: 'motor', props: { rotationSpeed: 360, direction: 'cw' } });
    expect(cls).toContain('sim-vis-motor-spinning');
  });

  it('adds energized class for relay', () => {
    const cls = getComponentVisualClass({ type: 'relay', props: { energized: true, coilCurrent: 0.1 } });
    expect(cls).toContain('sim-vis-relay-energized');
  });

  it('adds closed/open class for switch', () => {
    expect(getComponentVisualClass({ type: 'switch', props: { closed: true } }))
      .toContain('sim-vis-switch-closed');
    expect(getComponentVisualClass({ type: 'switch', props: { closed: false } }))
      .toContain('sim-vis-switch-open');
  });

  it('adds active class for buzzer', () => {
    const cls = getComponentVisualClass({ type: 'buzzer', props: { pulsing: true, frequency: 5 } });
    expect(cls).toContain('sim-vis-buzzer-active');
  });
});

// ---------------------------------------------------------------------------
// mapAllComponentVisuals
// ---------------------------------------------------------------------------

describe('mapAllComponentVisuals', () => {
  it('maps multiple components in a single call', () => {
    const sim = makeSim({ 1: 5, 0: 0, 2: 3.3 }, { R1: 0.050, LED1: 0.015 });
    const components: ComponentMapping[] = [
      { instanceId: 'i-1', componentType: 'resistor', componentId: 'R1', nodePositive: 1, nodeNegative: 0 },
      { instanceId: 'i-2', componentType: 'led', componentId: 'LED1', nodePositive: 2, nodeNegative: 0, properties: { color: 'green' } },
    ];

    const result = mapAllComponentVisuals(components, sim);

    expect(result.size).toBe(2);
    expect(result.get('i-1')?.type).toBe('resistor');
    expect(result.get('i-2')?.type).toBe('led');
  });

  it('returns empty map for empty component list', () => {
    const result = mapAllComponentVisuals([], makeSim({}, {}));
    expect(result.size).toBe(0);
  });

  it('handles mixed known and unknown types', () => {
    const sim = makeSim({ 1: 5, 0: 0 }, { C1: 0.001, M1: 0.5 });
    const components: ComponentMapping[] = [
      { instanceId: 'i-1', componentType: 'capacitor', componentId: 'C1', nodePositive: 1, nodeNegative: 0 },
      { instanceId: 'i-2', componentType: 'motor', componentId: 'M1', nodePositive: 1, nodeNegative: 0 },
    ];

    const result = mapAllComponentVisuals(components, sim);

    expect(result.get('i-1')?.type).toBe('generic');
    expect(result.get('i-2')?.type).toBe('motor');
  });
});
