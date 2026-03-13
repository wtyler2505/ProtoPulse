/**
 * Tests for simulation visual state utilities (BL-0619, BL-0128).
 */

import { describe, it, expect } from 'vitest';
import {
  ledCurrentToBrightness,
  inferLEDColor,
  ledColorToCSS,
  currentToAnimationSpeed,
  computeComponentVisualStates,
  computeWireVisualStates,
  formatSIValue,
} from '../visual-state';
import type {
  ComponentInfo,
  WireInfo,
  LEDColor,
} from '../visual-state';
import type { DCResult } from '../circuit-solver';

// ---------------------------------------------------------------------------
// ledCurrentToBrightness
// ---------------------------------------------------------------------------

describe('ledCurrentToBrightness', () => {
  it('returns 0 for current below threshold (< 1mA)', () => {
    expect(ledCurrentToBrightness(0)).toBe(0);
    expect(ledCurrentToBrightness(0.0005)).toBe(0);
    expect(ledCurrentToBrightness(0.0009)).toBe(0);
  });

  it('returns 1 for current at or above max (>= 20mA)', () => {
    expect(ledCurrentToBrightness(0.020)).toBe(1);
    expect(ledCurrentToBrightness(0.050)).toBe(1);
    expect(ledCurrentToBrightness(1.0)).toBe(1);
  });

  it('returns intermediate value for typical LED current (5mA)', () => {
    const brightness = ledCurrentToBrightness(0.005);
    expect(brightness).toBeGreaterThan(0);
    expect(brightness).toBeLessThan(1);
  });

  it('is monotonically increasing across the range', () => {
    const currents = [0.001, 0.002, 0.005, 0.010, 0.015, 0.020];
    const brightnesses = currents.map(ledCurrentToBrightness);
    for (let i = 1; i < brightnesses.length; i++) {
      expect(brightnesses[i]).toBeGreaterThanOrEqual(brightnesses[i - 1]);
    }
  });

  it('returns exactly 0 at the minimum threshold', () => {
    // Just below threshold
    expect(ledCurrentToBrightness(0.00099)).toBe(0);
    // At threshold — should return 0 (log(min)/log(min) - log(min)/log(min) = 0)
    const atMin = ledCurrentToBrightness(0.001);
    expect(atMin).toBeCloseTo(0, 5);
  });
});

// ---------------------------------------------------------------------------
// inferLEDColor
// ---------------------------------------------------------------------------

describe('inferLEDColor', () => {
  it('returns color from properties when valid', () => {
    expect(inferLEDColor('D1', { color: 'Green' })).toBe('green');
    expect(inferLEDColor('D1', { color: 'BLUE' })).toBe('blue');
    expect(inferLEDColor('D1', { color: 'yellow' })).toBe('yellow');
    expect(inferLEDColor('D1', { color: 'white' })).toBe('white');
    expect(inferLEDColor('D1', { color: 'Red' })).toBe('red');
  });

  it('infers from refdes suffix when no property color', () => {
    expect(inferLEDColor('LED_R1')).toBe('red');
    expect(inferLEDColor('LED_G1')).toBe('green');
    expect(inferLEDColor('LED_B1')).toBe('blue');
    expect(inferLEDColor('LED_Y1')).toBe('yellow');
    expect(inferLEDColor('LED_W1')).toBe('white');
  });

  it('infers from refdes containing color name', () => {
    expect(inferLEDColor('LED_RED_1')).toBe('red');
    expect(inferLEDColor('LED_GRN_2')).toBe('green');
    expect(inferLEDColor('LED_BLU_3')).toBe('blue');
    expect(inferLEDColor('LED_YEL_4')).toBe('yellow');
    expect(inferLEDColor('LED_WHT_5')).toBe('white');
  });

  it('defaults to red when no color info', () => {
    expect(inferLEDColor('D1')).toBe('red');
    expect(inferLEDColor('LED1')).toBe('red');
    expect(inferLEDColor('D1', {})).toBe('red');
  });

  it('ignores invalid color properties', () => {
    expect(inferLEDColor('D1', { color: 'purple' })).toBe('red');
    expect(inferLEDColor('D1', { color: 123 })).toBe('red');
  });
});

// ---------------------------------------------------------------------------
// ledColorToCSS
// ---------------------------------------------------------------------------

describe('ledColorToCSS', () => {
  it('maps each color to a CSS hex value', () => {
    const colors: LEDColor[] = ['red', 'green', 'blue', 'yellow', 'white'];
    for (const color of colors) {
      const css = ledColorToCSS(color);
      expect(css).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('returns specific expected values', () => {
    expect(ledColorToCSS('red')).toBe('#ef4444');
    expect(ledColorToCSS('green')).toBe('#22c55e');
    expect(ledColorToCSS('blue')).toBe('#3b82f6');
    expect(ledColorToCSS('yellow')).toBe('#eab308');
    expect(ledColorToCSS('white')).toBe('#f5f5f5');
  });
});

// ---------------------------------------------------------------------------
// currentToAnimationSpeed
// ---------------------------------------------------------------------------

describe('currentToAnimationSpeed', () => {
  it('returns 0 for current below threshold (< 100uA)', () => {
    expect(currentToAnimationSpeed(0)).toBe(0);
    expect(currentToAnimationSpeed(0.00005)).toBe(0);
    expect(currentToAnimationSpeed(0.00009)).toBe(0);
  });

  it('returns max speed (200 px/s) at 1A or above', () => {
    expect(currentToAnimationSpeed(1.0)).toBe(200);
    expect(currentToAnimationSpeed(5.0)).toBe(200);
  });

  it('returns intermediate speed for typical currents', () => {
    const speed = currentToAnimationSpeed(0.01); // 10mA
    expect(speed).toBeGreaterThan(10);
    expect(speed).toBeLessThan(200);
  });

  it('is monotonically increasing', () => {
    const currents = [0.0001, 0.001, 0.01, 0.1, 1.0];
    const speeds = currents.map(currentToAnimationSpeed);
    for (let i = 1; i < speeds.length; i++) {
      expect(speeds[i]).toBeGreaterThanOrEqual(speeds[i - 1]);
    }
  });

  it('minimum speed is 10 px/s at threshold', () => {
    const speed = currentToAnimationSpeed(0.0001);
    expect(speed).toBeCloseTo(10, 1);
  });
});

// ---------------------------------------------------------------------------
// computeComponentVisualStates
// ---------------------------------------------------------------------------

describe('computeComponentVisualStates', () => {
  const baseDCResult: DCResult = {
    nodeVoltages: { 0: 0, 1: 5, 2: 2.5 },
    branchCurrents: { 'R1': 0.01, 'D1': 0.005, 'SW1': 0.1 },
    converged: true,
    iterations: 3,
  };

  it('creates LED visual state for LED components', () => {
    const components: ComponentInfo[] = [{
      id: 'D1',
      referenceDesignator: 'D1',
      componentType: 'led',
      nodePositive: 1,
      nodeNegative: 2,
      properties: { color: 'green' },
    }];

    const states = computeComponentVisualStates(components, baseDCResult);
    expect(states.size).toBe(1);
    const state = states.get('D1');
    expect(state).toBeDefined();
    expect(state?.type).toBe('led');
    if (state?.type === 'led') {
      expect(state.glowing).toBe(true);
      expect(state.brightness).toBeGreaterThan(0);
      expect(state.color).toBe('green');
      expect(state.forwardCurrent).toBeCloseTo(0.005);
    }
  });

  it('creates resistor visual state for resistors', () => {
    const components: ComponentInfo[] = [{
      id: 'R1',
      referenceDesignator: 'R1',
      componentType: 'resistor',
      nodePositive: 1,
      nodeNegative: 2,
    }];

    const states = computeComponentVisualStates(components, baseDCResult);
    const state = states.get('R1');
    expect(state?.type).toBe('resistor');
    if (state?.type === 'resistor') {
      expect(state.voltageDrop).toBeCloseTo(2.5);
      expect(state.current).toBeCloseTo(0.01);
    }
  });

  it('creates switch visual state for switches', () => {
    const components: ComponentInfo[] = [{
      id: 'SW1',
      referenceDesignator: 'SW1',
      componentType: 'switch',
      nodePositive: 1,
      nodeNegative: 0,
    }];

    const states = computeComponentVisualStates(components, baseDCResult);
    const state = states.get('SW1');
    expect(state?.type).toBe('switch');
    if (state?.type === 'switch') {
      expect(state.closed).toBe(true);
    }
  });

  it('creates switch OFF state when no current flows', () => {
    const dcResult: DCResult = {
      ...baseDCResult,
      branchCurrents: { 'SW1': 0 },
    };
    const components: ComponentInfo[] = [{
      id: 'SW1',
      referenceDesignator: 'SW1',
      componentType: 'spst',
      nodePositive: 1,
      nodeNegative: 0,
    }];

    const states = computeComponentVisualStates(components, dcResult);
    const state = states.get('SW1');
    if (state?.type === 'switch') {
      expect(state.closed).toBe(false);
    }
  });

  it('creates generic visual state for unknown component types', () => {
    const components: ComponentInfo[] = [{
      id: 'C1',
      referenceDesignator: 'C1',
      componentType: 'capacitor',
      nodePositive: 1,
      nodeNegative: 0,
    }];
    const dcResult: DCResult = {
      ...baseDCResult,
      branchCurrents: { 'C1': 0.002 },
    };

    const states = computeComponentVisualStates(components, dcResult);
    const state = states.get('C1');
    expect(state?.type).toBe('generic');
    if (state?.type === 'generic') {
      expect(state.voltageDrop).toBeCloseTo(5);
      expect(state.current).toBeCloseTo(0.002);
    }
  });

  it('LED not glowing when current is below threshold', () => {
    const dcResult: DCResult = {
      ...baseDCResult,
      branchCurrents: { 'D1': 0.0001 },
    };
    const components: ComponentInfo[] = [{
      id: 'D1',
      referenceDesignator: 'D1',
      componentType: 'led',
      nodePositive: 1,
      nodeNegative: 0,
    }];

    const states = computeComponentVisualStates(components, dcResult);
    const state = states.get('D1');
    if (state?.type === 'led') {
      expect(state.glowing).toBe(false);
      expect(state.brightness).toBe(0);
    }
  });

  it('handles missing node voltages gracefully (defaults to 0)', () => {
    const dcResult: DCResult = {
      nodeVoltages: {},
      branchCurrents: { 'R1': 0.01 },
      converged: true,
      iterations: 1,
    };
    const components: ComponentInfo[] = [{
      id: 'R1',
      referenceDesignator: 'R1',
      componentType: 'resistor',
      nodePositive: 99,
      nodeNegative: 100,
    }];

    const states = computeComponentVisualStates(components, dcResult);
    const state = states.get('R1');
    if (state?.type === 'resistor') {
      expect(state.voltageDrop).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// computeWireVisualStates
// ---------------------------------------------------------------------------

describe('computeWireVisualStates', () => {
  const baseDCResult: DCResult = {
    nodeVoltages: { 0: 0, 1: 5, 2: 2.5 },
    branchCurrents: { 'R1': 0.01, 'R2': -0.005 },
    converged: true,
    iterations: 3,
  };

  it('computes wire state with positive current', () => {
    const wires: WireInfo[] = [{
      id: 'net1',
      sourceNode: 1,
      targetNode: 2,
      componentId: 'R1',
    }];

    const states = computeWireVisualStates(wires, baseDCResult);
    const state = states.get('net1');
    expect(state).toBeDefined();
    expect(state?.currentMagnitude).toBeCloseTo(0.01);
    expect(state?.currentDirection).toBe(1);
    expect(state?.animationSpeed).toBeGreaterThan(0);
    expect(state?.sourceVoltage).toBeCloseTo(5);
    expect(state?.targetVoltage).toBeCloseTo(2.5);
  });

  it('computes wire state with negative current (reverse direction)', () => {
    const wires: WireInfo[] = [{
      id: 'net2',
      sourceNode: 2,
      targetNode: 0,
      componentId: 'R2',
    }];

    const states = computeWireVisualStates(wires, baseDCResult);
    const state = states.get('net2');
    expect(state?.currentDirection).toBe(-1);
    expect(state?.currentMagnitude).toBeCloseTo(0.005);
  });

  it('wire with no component has zero current', () => {
    const wires: WireInfo[] = [{
      id: 'net3',
      sourceNode: 1,
      targetNode: 0,
    }];

    const states = computeWireVisualStates(wires, baseDCResult);
    const state = states.get('net3');
    expect(state?.currentMagnitude).toBe(0);
    expect(state?.currentDirection).toBe(0);
    expect(state?.animationSpeed).toBe(0);
  });

  it('handles missing voltages gracefully', () => {
    const wires: WireInfo[] = [{
      id: 'net4',
      sourceNode: 99,
      targetNode: 100,
    }];

    const states = computeWireVisualStates(wires, baseDCResult);
    const state = states.get('net4');
    expect(state?.sourceVoltage).toBe(0);
    expect(state?.targetVoltage).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// formatSIValue
// ---------------------------------------------------------------------------

describe('formatSIValue', () => {
  it('formats zero', () => {
    expect(formatSIValue(0, 'V')).toBe('0 V');
    expect(formatSIValue(0, 'A')).toBe('0 A');
  });

  it('formats mega values', () => {
    expect(formatSIValue(1500000, 'V')).toBe('1.5 MV');
  });

  it('formats kilo values', () => {
    expect(formatSIValue(4700, 'V')).toBe('4.7 kV');
  });

  it('formats unit values', () => {
    expect(formatSIValue(3.3, 'V')).toBe('3.30 V');
    expect(formatSIValue(12, 'V')).toBe('12.00 V');
  });

  it('formats milli values', () => {
    expect(formatSIValue(0.005, 'A')).toBe('5.0 mA');
    expect(formatSIValue(0.020, 'A')).toBe('20.0 mA');
  });

  it('formats micro values', () => {
    expect(formatSIValue(0.000100, 'A')).toBe('100.0 uA');
  });

  it('formats nano values', () => {
    expect(formatSIValue(0.000000001, 'A')).toBe('1.0 nA');
  });

  it('formats pico values', () => {
    expect(formatSIValue(0.000000000001, 'F')).toBe('1.0 pF');
  });

  it('handles negative values', () => {
    expect(formatSIValue(-3.3, 'V')).toBe('-3.30 V');
    expect(formatSIValue(-0.005, 'A')).toBe('-5.0 mA');
  });
});
