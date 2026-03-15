/**
 * Tests for calculator-apply — mapping calculator results to BOM items and instance properties.
 */

import { describe, it, expect } from 'vitest';
import {
  getApplicableActions,
  mapResultToBomItem,
  mapResultToInstanceProperty,
} from '@/lib/calculator-apply';
import type { CalcResult } from '@/lib/calculator-apply';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResult(overrides: Partial<CalcResult> = {}): CalcResult {
  return {
    calculatorName: 'ohms-law',
    resultName: 'Resistance',
    value: 4700,
    unit: 'Ω',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getApplicableActions
// ---------------------------------------------------------------------------

describe('getApplicableActions', () => {
  it('returns both actions for a resistor value', () => {
    const actions = getApplicableActions(makeResult({ unit: 'Ω', value: 1000 }));
    expect(actions).toContain('add_to_bom');
    expect(actions).toContain('apply_to_instance');
  });

  it('returns both actions for a capacitor value', () => {
    const actions = getApplicableActions(makeResult({ unit: 'F', value: 0.000001 }));
    expect(actions).toContain('add_to_bom');
    expect(actions).toContain('apply_to_instance');
  });

  it('returns both actions for an inductor value', () => {
    const actions = getApplicableActions(makeResult({ unit: 'H', value: 0.01 }));
    expect(actions).toContain('add_to_bom');
    expect(actions).toContain('apply_to_instance');
  });

  it('returns only apply_to_instance for voltage', () => {
    const actions = getApplicableActions(makeResult({ unit: 'V', value: 3.3 }));
    expect(actions).not.toContain('add_to_bom');
    expect(actions).toContain('apply_to_instance');
  });

  it('returns only apply_to_instance for current', () => {
    const actions = getApplicableActions(makeResult({ unit: 'A', value: 0.02 }));
    expect(actions).not.toContain('add_to_bom');
    expect(actions).toContain('apply_to_instance');
  });

  it('returns only apply_to_instance for power', () => {
    const actions = getApplicableActions(makeResult({ unit: 'W', value: 0.5 }));
    expect(actions).not.toContain('add_to_bom');
    expect(actions).toContain('apply_to_instance');
  });

  it('returns only apply_to_instance for frequency', () => {
    const actions = getApplicableActions(makeResult({ unit: 'Hz', value: 1000 }));
    expect(actions).not.toContain('add_to_bom');
    expect(actions).toContain('apply_to_instance');
  });

  it('returns only apply_to_instance for time', () => {
    const actions = getApplicableActions(makeResult({ unit: 's', value: 0.01 }));
    expect(actions).not.toContain('add_to_bom');
    expect(actions).toContain('apply_to_instance');
  });

  it('returns empty array for zero value', () => {
    expect(getApplicableActions(makeResult({ value: 0 }))).toEqual([]);
  });

  it('returns empty array for negative value', () => {
    expect(getApplicableActions(makeResult({ value: -100 }))).toEqual([]);
  });

  it('returns empty array for NaN', () => {
    expect(getApplicableActions(makeResult({ value: NaN }))).toEqual([]);
  });

  it('returns empty array for Infinity', () => {
    expect(getApplicableActions(makeResult({ value: Infinity }))).toEqual([]);
  });

  it('returns empty array for unrecognized unit', () => {
    expect(getApplicableActions(makeResult({ unit: 'dB' }))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// mapResultToBomItem
// ---------------------------------------------------------------------------

describe('mapResultToBomItem', () => {
  it('maps a resistance result to a BOM item', () => {
    const bom = mapResultToBomItem(makeResult({ value: 4700, unit: 'Ω', calculatorName: 'ohms-law' }));
    expect(bom).not.toBeNull();
    expect(bom!.description).toContain('Resistor');
    expect(bom!.description).toContain('4.7 kΩ');
    expect(bom!.description).toContain("Ohm's Law");
    expect(bom!.partNumber).toMatch(/^CALC-RES-/);
    expect(bom!.quantity).toBe(1);
    expect(bom!.unitPrice).toBe('0.0000');
    expect(bom!.status).toBe('In Stock');
  });

  it('maps a capacitance result to a BOM item', () => {
    const bom = mapResultToBomItem(makeResult({ value: 0.000001, unit: 'F', calculatorName: 'rc-time-constant' }));
    expect(bom).not.toBeNull();
    expect(bom!.description).toContain('Capacitor');
    expect(bom!.description).toContain('1 µF');
    expect(bom!.description).toContain('RC Time Constant');
    expect(bom!.partNumber).toMatch(/^CALC-CAP-/);
  });

  it('maps an inductance result to a BOM item', () => {
    const bom = mapResultToBomItem(makeResult({ value: 0.01, unit: 'H', calculatorName: 'filter-cutoff' }));
    expect(bom).not.toBeNull();
    expect(bom!.description).toContain('Inductor');
    expect(bom!.description).toContain('10 mH');
    expect(bom!.partNumber).toMatch(/^CALC-IND-/);
  });

  it('uses componentType override when provided', () => {
    const bom = mapResultToBomItem(makeResult({ componentType: 'Potentiometer' }));
    expect(bom).not.toBeNull();
    expect(bom!.description).toContain('Potentiometer');
  });

  it('returns null for voltage (not a BOM-able component)', () => {
    expect(mapResultToBomItem(makeResult({ unit: 'V' }))).toBeNull();
  });

  it('returns null for current', () => {
    expect(mapResultToBomItem(makeResult({ unit: 'A' }))).toBeNull();
  });

  it('returns null for power', () => {
    expect(mapResultToBomItem(makeResult({ unit: 'W' }))).toBeNull();
  });

  it('returns null for zero value', () => {
    expect(mapResultToBomItem(makeResult({ value: 0 }))).toBeNull();
  });

  it('returns null for negative value', () => {
    expect(mapResultToBomItem(makeResult({ value: -100 }))).toBeNull();
  });

  it('returns null for NaN', () => {
    expect(mapResultToBomItem(makeResult({ value: NaN }))).toBeNull();
  });

  it('generates correct description for LED resistor calculator', () => {
    const bom = mapResultToBomItem(makeResult({ value: 150, unit: 'Ω', calculatorName: 'led-resistor' }));
    expect(bom!.description).toContain('LED Resistor');
  });

  it('generates correct description for voltage divider calculator', () => {
    const bom = mapResultToBomItem(makeResult({ value: 10000, unit: 'Ω', calculatorName: 'voltage-divider' }));
    expect(bom!.description).toContain('Voltage Divider');
  });
});

// ---------------------------------------------------------------------------
// mapResultToInstanceProperty
// ---------------------------------------------------------------------------

describe('mapResultToInstanceProperty', () => {
  it('maps resistance to instance property', () => {
    const prop = mapResultToInstanceProperty(makeResult({ value: 4700, unit: 'Ω' }));
    expect(prop).not.toBeNull();
    expect(prop!.property).toBe('resistance');
    expect(prop!.value).toBe('4.7 kΩ');
  });

  it('maps voltage to instance property', () => {
    const prop = mapResultToInstanceProperty(makeResult({ value: 3.3, unit: 'V' }));
    expect(prop).not.toBeNull();
    expect(prop!.property).toBe('voltage');
    expect(prop!.value).toBe('3.3 V');
  });

  it('maps current to instance property', () => {
    const prop = mapResultToInstanceProperty(makeResult({ value: 0.02, unit: 'A' }));
    expect(prop).not.toBeNull();
    expect(prop!.property).toBe('current');
    expect(prop!.value).toBe('20 mA');
  });

  it('maps power to instance property', () => {
    const prop = mapResultToInstanceProperty(makeResult({ value: 0.25, unit: 'W' }));
    expect(prop).not.toBeNull();
    expect(prop!.property).toBe('power');
    expect(prop!.value).toBe('250 mW');
  });

  it('maps capacitance to instance property', () => {
    const prop = mapResultToInstanceProperty(makeResult({ value: 0.0000001, unit: 'F' }));
    expect(prop).not.toBeNull();
    expect(prop!.property).toBe('capacitance');
    expect(prop!.value).toBe('100 nF');
  });

  it('maps inductance to instance property', () => {
    const prop = mapResultToInstanceProperty(makeResult({ value: 0.001, unit: 'H' }));
    expect(prop).not.toBeNull();
    expect(prop!.property).toBe('inductance');
    expect(prop!.value).toBe('1 mH');
  });

  it('maps frequency to instance property', () => {
    const prop = mapResultToInstanceProperty(makeResult({ value: 15900, unit: 'Hz' }));
    expect(prop).not.toBeNull();
    expect(prop!.property).toBe('frequency');
    expect(prop!.value).toBe('15.9 kHz');
  });

  it('maps time to instance property', () => {
    const prop = mapResultToInstanceProperty(makeResult({ value: 0.01, unit: 's' }));
    expect(prop).not.toBeNull();
    expect(prop!.property).toBe('time_constant');
    expect(prop!.value).toBe('10 ms');
  });

  it('returns null for unrecognized unit', () => {
    expect(mapResultToInstanceProperty(makeResult({ unit: 'dB' }))).toBeNull();
  });

  it('returns null for zero value', () => {
    expect(mapResultToInstanceProperty(makeResult({ value: 0 }))).toBeNull();
  });

  it('returns null for negative value', () => {
    expect(mapResultToInstanceProperty(makeResult({ value: -5 }))).toBeNull();
  });

  it('returns null for NaN', () => {
    expect(mapResultToInstanceProperty(makeResult({ value: NaN }))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Integration: calculator-specific result shapes
// ---------------------------------------------------------------------------

describe('calculator-specific integration', () => {
  it('handles LED resistor E24 result', () => {
    const result: CalcResult = {
      calculatorName: 'led-resistor',
      resultName: 'Nearest E24',
      value: 150,
      unit: 'Ω',
    };
    const actions = getApplicableActions(result);
    expect(actions).toEqual(['add_to_bom', 'apply_to_instance']);

    const bom = mapResultToBomItem(result);
    expect(bom!.description).toContain('Resistor 150 Ω');

    const prop = mapResultToInstanceProperty(result);
    expect(prop!.property).toBe('resistance');
    expect(prop!.value).toBe('150 Ω');
  });

  it('handles power dissipation result with watts', () => {
    const result: CalcResult = {
      calculatorName: 'power-dissipation',
      resultName: 'Power',
      value: 0.06,
      unit: 'W',
    };
    const actions = getApplicableActions(result);
    expect(actions).toEqual(['apply_to_instance']);
    expect(mapResultToBomItem(result)).toBeNull();
    expect(mapResultToInstanceProperty(result)!.property).toBe('power');
  });

  it('handles filter cutoff frequency result', () => {
    const result: CalcResult = {
      calculatorName: 'filter-cutoff',
      resultName: 'Cutoff Frequency',
      value: 159.155,
      unit: 'Hz',
    };
    const prop = mapResultToInstanceProperty(result);
    expect(prop!.property).toBe('frequency');
  });
});
