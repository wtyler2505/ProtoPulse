import { describe, it, expect } from 'vitest';
import { detectPinConflicts } from '../pin-conflict-checker';
import type { PinConstant } from '@shared/arduino-pin-generator';

const MOCK_SCHEMATIC_PINS: PinConstant[] = [
  { name: 'LED_RED', originalLabel: 'LED_RED', pinNumber: 13, category: 'digital_output', comment: '' },
  { name: 'MOTOR_A', originalLabel: 'MOTOR_A', pinNumber: 5, category: 'pwm', comment: '' },
  { name: 'TEMP_SENSE', originalLabel: 'TEMP_SENSE', pinNumber: 'A0', category: 'analog_input', comment: '' },
];

describe('detectPinConflicts', () => {
  it('detects a conflict when #define value differs from schematic', () => {
    const code = `
      #define LED_RED 12
      void setup() {}
    `;
    const conflicts = detectPinConflicts(code, MOCK_SCHEMATIC_PINS);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].severity).toBe('error');
    expect(conflicts[0].codeName).toBe('LED_RED');
    expect(conflicts[0].codeValue).toBe('12');
    expect(conflicts[0].schematicValue).toBe(13);
  });

  it('detects a conflict when const int value differs from schematic', () => {
    const code = `
      const int motorA = 6;
      void setup() {}
    `;
    const conflicts = detectPinConflicts(code, MOCK_SCHEMATIC_PINS);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].severity).toBe('error');
    expect(conflicts[0].codeName).toBe('motorA');
    expect(conflicts[0].codeValue).toBe('6');
    expect(conflicts[0].schematicValue).toBe(5);
  });

  it('reports no conflicts when values match perfectly', () => {
    const code = `
      #define LED_RED 13
      const int MOTOR_A_PIN = 5;
      constexpr uint8_t temp_sense = A0;
    `;
    const conflicts = detectPinConflicts(code, MOCK_SCHEMATIC_PINS);
    expect(conflicts).toHaveLength(0);
  });

  it('warns on pin collision (different semantic name but same physical pin)', () => {
    const code = `
      const int BUTTON_PIN = 13; // Schematic has LED_RED on 13
    `;
    const conflicts = detectPinConflicts(code, MOCK_SCHEMATIC_PINS);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].severity).toBe('warning');
    expect(conflicts[0].codeName).toBe('BUTTON_PIN');
    expect(conflicts[0].codeValue).toBe('13');
    expect(conflicts[0].schematicName).toBe('LED_RED');
  });

  it('handles zero-padded values and whitespace', () => {
    const code = `
      #define LED_RED    013
      const int motorA =  05 ;
    `;
    const conflicts = detectPinConflicts(code, MOCK_SCHEMATIC_PINS);
    expect(conflicts).toHaveLength(0);
  });

  it('ignores non-pin constants', () => {
    const code = `
      const int MAX_SPEED = 255;
      #define DELAY_MS 1000
    `;
    const conflicts = detectPinConflicts(code, MOCK_SCHEMATIC_PINS);
    expect(conflicts).toHaveLength(0); // No warning because names do not contain "PIN" and don't match schematic
  });
});
