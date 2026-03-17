import { describe, it, expect } from 'vitest';
import type { ComponentIdResult } from '@/components/panels/CameraComponentId';
import {
  suggestAdditionalAngles,
  mergeMultiAngleResults,
  shouldRequestMultiAngle,
  confidenceToNumeric,
  numericToConfidence,
  categorizeComponentType,
  getAllAngles,
  getAngleInfo,
  LOW_CONFIDENCE_THRESHOLD,
  ANGLE_LABELS,
  ANGLE_DESCRIPTIONS,
} from '../multi-angle-capture';
import type {
  PhotoAngle,
  AngleResult,
  ComponentCategory,
  PhotoAngleRequest,
} from '../multi-angle-capture';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResult(overrides: Partial<ComponentIdResult> = {}): ComponentIdResult {
  return {
    componentType: 'IC',
    packageType: 'SOIC-8',
    partNumber: null,
    manufacturer: null,
    pinCount: 8,
    confidence: 'low',
    description: 'An integrated circuit in SOIC-8 package.',
    specifications: [],
    suggestedBom: null,
    notes: null,
    ...overrides,
  };
}

function makeAngleResult(
  angle: PhotoAngle,
  result: ComponentIdResult | null,
): AngleResult {
  return {
    angle,
    imageData: 'data:image/jpeg;base64,abc123',
    result,
  };
}

// ---------------------------------------------------------------------------
// confidenceToNumeric — boundary & exhaustive
// ---------------------------------------------------------------------------

describe('confidenceToNumeric (follow-up)', () => {
  it('returns distinct numeric values for each confidence level', () => {
    const values = new Set([
      confidenceToNumeric('high'),
      confidenceToNumeric('medium'),
      confidenceToNumeric('low'),
    ]);
    expect(values.size).toBe(3);
  });

  it('maintains ordering: high > medium > low', () => {
    expect(confidenceToNumeric('high')).toBeGreaterThan(confidenceToNumeric('medium'));
    expect(confidenceToNumeric('medium')).toBeGreaterThan(confidenceToNumeric('low'));
  });

  it('all values are in [0, 1] range', () => {
    for (const level of ['high', 'medium', 'low'] as const) {
      const val = confidenceToNumeric(level);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// numericToConfidence — boundary conditions
// ---------------------------------------------------------------------------

describe('numericToConfidence (follow-up)', () => {
  it('boundary: exactly 0.75 returns high', () => {
    expect(numericToConfidence(0.75)).toBe('high');
  });

  it('boundary: just below 0.75 returns medium', () => {
    expect(numericToConfidence(0.7499)).toBe('medium');
  });

  it('boundary: exactly 0.45 returns medium', () => {
    expect(numericToConfidence(0.45)).toBe('medium');
  });

  it('boundary: just below 0.45 returns low', () => {
    expect(numericToConfidence(0.4499)).toBe('low');
  });

  it('handles negative values gracefully (returns low)', () => {
    expect(numericToConfidence(-0.1)).toBe('low');
    expect(numericToConfidence(-1)).toBe('low');
  });

  it('handles values above 1 (returns high)', () => {
    expect(numericToConfidence(1.5)).toBe('high');
    expect(numericToConfidence(100)).toBe('high');
  });

  it('round-trip: numericToConfidence(confidenceToNumeric(level)) preserves level', () => {
    for (const level of ['high', 'medium', 'low'] as const) {
      expect(numericToConfidence(confidenceToNumeric(level))).toBe(level);
    }
  });
});

// ---------------------------------------------------------------------------
// categorizeComponentType — deeper coverage
// ---------------------------------------------------------------------------

describe('categorizeComponentType (follow-up)', () => {
  it('is case-insensitive', () => {
    expect(categorizeComponentType('RESISTOR')).toBe('passive');
    expect(categorizeComponentType('rEsIsToR')).toBe('passive');
    expect(categorizeComponentType('resistor')).toBe('passive');
  });

  it('matches substrings in compound names', () => {
    expect(categorizeComponentType('Power MOSFET N-Channel')).toBe('discrete');
    expect(categorizeComponentType('0805 SMD Capacitor 100nF')).toBe('passive');
    expect(categorizeComponentType('ARM Cortex Processor Board')).toBe('ic');
  });

  it('IC keywords: chip, flash, timer, uart, spi, i2c, dac', () => {
    expect(categorizeComponentType('Flash Memory')).toBe('ic');
    expect(categorizeComponentType('555 Timer')).toBe('ic');
    expect(categorizeComponentType('UART Interface')).toBe('ic');
    expect(categorizeComponentType('SPI Controller')).toBe('ic');
    expect(categorizeComponentType('I2C Bus Expander')).toBe('ic');
    expect(categorizeComponentType('DAC Converter')).toBe('ic');
    expect(categorizeComponentType('Small Chip')).toBe('ic');
  });

  it('passive uses word boundary: does not match "flux capacitor" without "capacitor" word', () => {
    // "capacitor" IS a word in "flux capacitor" so it SHOULD match passive
    expect(categorizeComponentType('flux capacitor')).toBe('passive');
    // "thermistor" is passive
    expect(categorizeComponentType('NTC Thermistor 10K')).toBe('passive');
    // "varistor" is passive
    expect(categorizeComponentType('Metal Oxide Varistor')).toBe('passive');
    // "oscillator" is passive
    expect(categorizeComponentType('32.768kHz Crystal Oscillator')).toBe('passive');
  });

  it('connector keywords: terminal, barrel, hdmi', () => {
    expect(categorizeComponentType('Screw Terminal Block')).toBe('connector');
    expect(categorizeComponentType('DC Barrel Jack')).toBe('connector');
    expect(categorizeComponentType('HDMI Receptacle')).toBe('connector');
  });

  it('electromechanical keywords: motor, buzzer, speaker, solenoid', () => {
    expect(categorizeComponentType('DC Motor 12V')).toBe('electromechanical');
    expect(categorizeComponentType('Piezo Buzzer')).toBe('electromechanical');
    expect(categorizeComponentType('8 Ohm Speaker')).toBe('electromechanical');
    expect(categorizeComponentType('12V Solenoid Valve')).toBe('electromechanical');
  });

  it('discrete keywords: bjt, scr, triac, rectifier', () => {
    expect(categorizeComponentType('2N2222 BJT')).toBe('discrete');
    expect(categorizeComponentType('Thyristor SCR')).toBe('discrete');
    expect(categorizeComponentType('TRIAC 600V')).toBe('discrete');
    expect(categorizeComponentType('Bridge Rectifier')).toBe('discrete');
  });

  it('module keywords: shield, hat, esp8266, raspberry', () => {
    expect(categorizeComponentType('Motor Shield V2')).toBe('module');
    expect(categorizeComponentType('Sense HAT')).toBe('module');
    expect(categorizeComponentType('ESP8266 WiFi')).toBe('module');
    expect(categorizeComponentType('Raspberry Pi Pico')).toBe('module');
  });

  it('prioritizes IC over other categories when multiple keywords match', () => {
    // "sensor" is IC keyword, checked before others
    expect(categorizeComponentType('Temperature Sensor Module')).toBe('ic');
    // "driver" is IC keyword
    expect(categorizeComponentType('LED Driver IC')).toBe('ic');
    // "amplifier" is IC keyword
    expect(categorizeComponentType('Audio Amplifier Board')).toBe('ic');
  });

  it('returns unknown for completely unrecognized strings', () => {
    expect(categorizeComponentType('xyz')).toBe('unknown');
    expect(categorizeComponentType('12345')).toBe('unknown');
    expect(categorizeComponentType('just some random text')).toBe('unknown');
  });

  it('handles empty string as unknown', () => {
    expect(categorizeComponentType('')).toBe('unknown');
  });

  it('handles whitespace-only string as unknown', () => {
    expect(categorizeComponentType('   ')).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// shouldRequestMultiAngle — threshold behavior
// ---------------------------------------------------------------------------

describe('shouldRequestMultiAngle (follow-up)', () => {
  it('LOW_CONFIDENCE_THRESHOLD is a number between 0 and 1', () => {
    expect(typeof LOW_CONFIDENCE_THRESHOLD).toBe('number');
    expect(LOW_CONFIDENCE_THRESHOLD).toBeGreaterThan(0);
    expect(LOW_CONFIDENCE_THRESHOLD).toBeLessThanOrEqual(1);
  });

  it('high confidence numeric (0.9) >= threshold (0.7) so returns false', () => {
    const result = makeResult({ confidence: 'high' });
    expect(shouldRequestMultiAngle(result)).toBe(false);
    expect(confidenceToNumeric('high')).toBeGreaterThanOrEqual(LOW_CONFIDENCE_THRESHOLD);
  });

  it('medium confidence numeric (0.6) < threshold (0.7) so returns true', () => {
    const result = makeResult({ confidence: 'medium' });
    expect(shouldRequestMultiAngle(result)).toBe(true);
    expect(confidenceToNumeric('medium')).toBeLessThan(LOW_CONFIDENCE_THRESHOLD);
  });

  it('low confidence numeric (0.3) < threshold (0.7) so returns true', () => {
    const result = makeResult({ confidence: 'low' });
    expect(shouldRequestMultiAngle(result)).toBe(true);
    expect(confidenceToNumeric('low')).toBeLessThan(LOW_CONFIDENCE_THRESHOLD);
  });
});

// ---------------------------------------------------------------------------
// suggestAdditionalAngles — deeper edge cases
// ---------------------------------------------------------------------------

describe('suggestAdditionalAngles (follow-up)', () => {
  it('uses result.componentType when no override is provided', () => {
    const result = makeResult({ confidence: 'low', componentType: 'Relay' });
    const suggestions = suggestAdditionalAngles(result);
    // Relay = electromechanical, first priority is 'top'
    expect(suggestions[0].angle).toBe('top');
  });

  it('componentType override takes precedence over result.componentType', () => {
    const result = makeResult({ confidence: 'low', componentType: 'Relay' });
    // Override with IC type
    const suggestions = suggestAdditionalAngles(result, 'Microcontroller');
    // IC first priority is 'markings'
    expect(suggestions[0].angle).toBe('markings');
  });

  it('returns all category angles for very low confidence (0.3)', () => {
    const result = makeResult({ confidence: 'low', componentType: 'IC' });
    const suggestions = suggestAdditionalAngles(result);
    // IC has 5 angles, low confidence gets all
    expect(suggestions).toHaveLength(5);
  });

  it('returns at most 3 for medium confidence (0.6)', () => {
    const result = makeResult({ confidence: 'medium', componentType: 'IC' });
    const suggestions = suggestAdditionalAngles(result);
    expect(suggestions.length).toBeLessThanOrEqual(3);
  });

  it('passive category has exactly 3 angles configured', () => {
    const result = makeResult({ confidence: 'low', componentType: 'Capacitor' });
    const suggestions = suggestAdditionalAngles(result);
    expect(suggestions).toHaveLength(3);
    const angles = suggestions.map((s) => s.angle);
    expect(angles).toContain('markings');
    expect(angles).toContain('top');
    expect(angles).toContain('side');
  });

  it('connector category has 4 angles configured', () => {
    const result = makeResult({ confidence: 'low', componentType: 'USB Connector' });
    const suggestions = suggestAdditionalAngles(result);
    expect(suggestions).toHaveLength(4);
  });

  it('filtering all angles for a small category returns empty', () => {
    // passive has: markings, top, side
    const result = makeResult({ confidence: 'low', componentType: 'Resistor' });
    const suggestions = suggestAdditionalAngles(result, undefined, ['markings', 'top', 'side']);
    expect(suggestions).toHaveLength(0);
  });

  it('filtering partial angles removes only those specific angles', () => {
    const result = makeResult({ confidence: 'low', componentType: 'IC' });
    const suggestions = suggestAdditionalAngles(result, undefined, ['markings']);
    // Should still have top, pins, side, bottom (4 remaining from 5)
    expect(suggestions).toHaveLength(4);
    expect(suggestions.every((s) => s.angle !== 'markings')).toBe(true);
    // Top should now be first (priority 2, lowest remaining)
    expect(suggestions[0].angle).toBe('top');
  });

  it('unknown category gets all 5 angles for low confidence', () => {
    const result = makeResult({ confidence: 'low', componentType: 'Alien Technology' });
    const suggestions = suggestAdditionalAngles(result);
    expect(suggestions).toHaveLength(5);
  });

  it('each suggestion has a valid PhotoAngle value', () => {
    const validAngles: PhotoAngle[] = ['top', 'side', 'bottom', 'markings', 'pins'];
    for (const category of ['IC', 'Resistor', 'Connector', 'Relay', 'LED', 'ESP32 Module', 'Unknown'] as const) {
      const result = makeResult({ confidence: 'low', componentType: category });
      const suggestions = suggestAdditionalAngles(result);
      for (const s of suggestions) {
        expect(validAngles).toContain(s.angle);
      }
    }
  });

  it('all priorities are positive integers', () => {
    for (const type of ['IC', 'Resistor', 'USB Connector', 'Relay', 'MOSFET', 'ESP32 Module', 'Unknown']) {
      const result = makeResult({ confidence: 'low', componentType: type });
      const suggestions = suggestAdditionalAngles(result);
      for (const s of suggestions) {
        expect(s.priority).toBeGreaterThan(0);
        expect(Number.isInteger(s.priority)).toBe(true);
      }
    }
  });

  it('no duplicate angles in suggestions', () => {
    for (const type of ['IC', 'Resistor', 'Connector', 'Relay', 'LED', 'ESP32', 'Unknown']) {
      const result = makeResult({ confidence: 'low', componentType: type });
      const suggestions = suggestAdditionalAngles(result);
      const angles = suggestions.map((s) => s.angle);
      expect(new Set(angles).size).toBe(angles.length);
    }
  });
});

// ---------------------------------------------------------------------------
// mergeMultiAngleResults — deeper edge cases
// ---------------------------------------------------------------------------

describe('mergeMultiAngleResults (follow-up)', () => {
  it('single valid result among nulls returns that result', () => {
    const valid = makeResult({ confidence: 'medium', partNumber: 'LM317' });
    const results: AngleResult[] = [
      makeAngleResult('top', null),
      makeAngleResult('markings', valid),
      makeAngleResult('side', null),
      makeAngleResult('pins', null),
    ];
    const merged = mergeMultiAngleResults(results);
    expect(merged).not.toBeNull();
    expect(merged!.partNumber).toBe('LM317');
    expect(merged!.confidence).toBe('medium');
  });

  it('merging two low-confidence results still boosts confidence', () => {
    const results: AngleResult[] = [
      makeAngleResult('top', makeResult({ confidence: 'low' })),
      makeAngleResult('side', makeResult({ confidence: 'low' })),
    ];
    const merged = mergeMultiAngleResults(results);
    expect(merged).not.toBeNull();
    // low = 0.3, boost = 0.3 * 0.2 / 1 = 0.06, total = 0.36 => low
    // but it should still be >= 0.3 (at least as confident as best)
    const mergedNum = confidenceToNumeric(merged!.confidence);
    expect(mergedNum).toBeGreaterThanOrEqual(confidenceToNumeric('low'));
  });

  it('merging three medium-confidence results reaches high', () => {
    const results: AngleResult[] = [
      makeAngleResult('top', makeResult({ confidence: 'medium' })),
      makeAngleResult('markings', makeResult({ confidence: 'medium' })),
      makeAngleResult('side', makeResult({ confidence: 'medium' })),
    ];
    const merged = mergeMultiAngleResults(results);
    // medium=0.6, boost = 0.6*0.2/1 + 0.6*0.2/2 = 0.12 + 0.06 = 0.18, total=0.78 => high
    expect(merged!.confidence).toBe('high');
  });

  it('confidence never exceeds 0.95 internally (maps to high)', () => {
    // 5 high results
    const results: AngleResult[] = getAllAngles().map((a) =>
      makeAngleResult(a, makeResult({ confidence: 'high' })),
    );
    const merged = mergeMultiAngleResults(results);
    expect(merged!.confidence).toBe('high');
  });

  it('preserves empty specifications arrays', () => {
    const results: AngleResult[] = [
      makeAngleResult('top', makeResult({ specifications: [] })),
      makeAngleResult('side', makeResult({ specifications: [] })),
    ];
    const merged = mergeMultiAngleResults(results);
    expect(merged!.specifications).toEqual([]);
  });

  it('handles mixed null and non-null partNumbers correctly', () => {
    const results: AngleResult[] = [
      makeAngleResult('top', makeResult({ confidence: 'high', partNumber: null })),
      makeAngleResult('side', makeResult({ confidence: 'low', partNumber: null })),
      makeAngleResult('markings', makeResult({ confidence: 'medium', partNumber: 'ATtiny85' })),
    ];
    const merged = mergeMultiAngleResults(results);
    expect(merged!.partNumber).toBe('ATtiny85');
  });

  it('returns null partNumber when all results have null partNumber', () => {
    const results: AngleResult[] = [
      makeAngleResult('top', makeResult({ confidence: 'high', partNumber: null })),
      makeAngleResult('side', makeResult({ confidence: 'medium', partNumber: null })),
    ];
    const merged = mergeMultiAngleResults(results);
    expect(merged!.partNumber).toBeNull();
  });

  it('returns null manufacturer when all results have null manufacturer', () => {
    const results: AngleResult[] = [
      makeAngleResult('top', makeResult({ confidence: 'high', manufacturer: null })),
      makeAngleResult('side', makeResult({ confidence: 'medium', manufacturer: null })),
    ];
    const merged = mergeMultiAngleResults(results);
    expect(merged!.manufacturer).toBeNull();
  });

  it('returns null suggestedBom when no result has one', () => {
    const results: AngleResult[] = [
      makeAngleResult('top', makeResult({ suggestedBom: null })),
      makeAngleResult('side', makeResult({ suggestedBom: null })),
    ];
    const merged = mergeMultiAngleResults(results);
    expect(merged!.suggestedBom).toBeNull();
  });

  it('handles empty descriptions gracefully', () => {
    const results: AngleResult[] = [
      makeAngleResult('top', makeResult({ description: '' })),
      makeAngleResult('side', makeResult({ description: '' })),
    ];
    const merged = mergeMultiAngleResults(results);
    // Empty strings trimmed and filtered out
    expect(merged!.description).toBe('');
  });

  it('handles whitespace-only descriptions by trimming them', () => {
    const results: AngleResult[] = [
      makeAngleResult('top', makeResult({ description: '   ' })),
      makeAngleResult('side', makeResult({ description: 'Actual description.' })),
    ];
    const merged = mergeMultiAngleResults(results);
    expect(merged!.description).toBe('Actual description.');
  });

  it('handles whitespace-only notes by trimming them', () => {
    const results: AngleResult[] = [
      makeAngleResult('top', makeResult({ notes: '   ' })),
      makeAngleResult('side', makeResult({ notes: 'Real note.' })),
    ];
    const merged = mergeMultiAngleResults(results);
    expect(merged!.notes).toBe('Real note.');
  });

  it('deduplicates notes', () => {
    const results: AngleResult[] = [
      makeAngleResult('top', makeResult({ notes: 'Same note' })),
      makeAngleResult('side', makeResult({ notes: 'Same note' })),
      makeAngleResult('bottom', makeResult({ notes: 'Different note' })),
    ];
    const merged = mergeMultiAngleResults(results);
    expect(merged!.notes).toContain('Same note');
    expect(merged!.notes).toContain('Different note');
    // Should appear once, not twice
    const sameNoteCount = merged!.notes!.split('Same note').length - 1;
    expect(sameNoteCount).toBe(1);
  });

  it('pinCount uses most frequent value across results', () => {
    const results: AngleResult[] = [
      makeAngleResult('top', makeResult({ confidence: 'low', pinCount: 8 })),
      makeAngleResult('side', makeResult({ confidence: 'low', pinCount: 16 })),
      makeAngleResult('pins', makeResult({ confidence: 'low', pinCount: 16 })),
      makeAngleResult('bottom', makeResult({ confidence: 'low', pinCount: 16 })),
    ];
    const merged = mergeMultiAngleResults(results);
    expect(merged!.pinCount).toBe(16);
  });

  it('pinCount falls back to best result when all null', () => {
    const results: AngleResult[] = [
      makeAngleResult('top', makeResult({ confidence: 'high', pinCount: null })),
      makeAngleResult('side', makeResult({ confidence: 'low', pinCount: null })),
    ];
    const merged = mergeMultiAngleResults(results);
    expect(merged!.pinCount).toBeNull();
  });

  it('specifications union includes all unique specs from all results', () => {
    const results: AngleResult[] = [
      makeAngleResult('top', makeResult({ specifications: ['5V', '20mA'] })),
      makeAngleResult('markings', makeResult({ specifications: ['3.3V', '20mA', '100MHz'] })),
      makeAngleResult('side', makeResult({ specifications: ['5V', '100MHz', '-40C to 85C'] })),
    ];
    const merged = mergeMultiAngleResults(results);
    expect(merged!.specifications).toContain('5V');
    expect(merged!.specifications).toContain('20mA');
    expect(merged!.specifications).toContain('3.3V');
    expect(merged!.specifications).toContain('100MHz');
    expect(merged!.specifications).toContain('-40C to 85C');
    // All unique, so 5 total
    expect(merged!.specifications).toHaveLength(5);
  });

  it('suggestedBom from lower-confidence result is used when higher has null', () => {
    const bom = {
      partNumber: 'STM32F103C8T6',
      manufacturer: 'STMicroelectronics',
      description: 'ARM Cortex-M3 MCU',
      category: 'ICs',
      unitPrice: 3.5,
    };
    const results: AngleResult[] = [
      makeAngleResult('top', makeResult({ confidence: 'high', suggestedBom: null })),
      makeAngleResult('markings', makeResult({ confidence: 'low', suggestedBom: bom })),
    ];
    const merged = mergeMultiAngleResults(results);
    expect(merged!.suggestedBom).toEqual(bom);
  });

  it('suggestedBom from highest-confidence result with bom wins', () => {
    const bomLow = {
      partNumber: 'NE555',
      manufacturer: 'TI',
      description: 'Timer',
      category: 'ICs',
      unitPrice: 0.5,
    };
    const bomMed = {
      partNumber: 'NE555P',
      manufacturer: 'Texas Instruments',
      description: 'Precision Timer',
      category: 'ICs',
      unitPrice: 0.65,
    };
    const results: AngleResult[] = [
      makeAngleResult('top', makeResult({ confidence: 'high', suggestedBom: null })),
      makeAngleResult('markings', makeResult({ confidence: 'medium', suggestedBom: bomMed })),
      makeAngleResult('side', makeResult({ confidence: 'low', suggestedBom: bomLow })),
    ];
    const merged = mergeMultiAngleResults(results);
    expect(merged!.suggestedBom).toEqual(bomMed);
  });
});

// ---------------------------------------------------------------------------
// getAllAngles — structural
// ---------------------------------------------------------------------------

describe('getAllAngles (follow-up)', () => {
  it('returns an array of strings', () => {
    const angles = getAllAngles();
    expect(Array.isArray(angles)).toBe(true);
    for (const a of angles) {
      expect(typeof a).toBe('string');
    }
  });

  it('every returned angle has entries in ANGLE_LABELS and ANGLE_DESCRIPTIONS', () => {
    const angles = getAllAngles();
    for (const a of angles) {
      expect(ANGLE_LABELS[a]).toBeDefined();
      expect(ANGLE_DESCRIPTIONS[a]).toBeDefined();
    }
  });

  it('returns a new array each call (no shared mutation)', () => {
    const a1 = getAllAngles();
    const a2 = getAllAngles();
    expect(a1).not.toBe(a2);
    expect(a1).toEqual(a2);
  });
});

// ---------------------------------------------------------------------------
// getAngleInfo — structural
// ---------------------------------------------------------------------------

describe('getAngleInfo (follow-up)', () => {
  it('returns an object with exactly label and description keys', () => {
    const info = getAngleInfo('top');
    expect(Object.keys(info).sort()).toEqual(['description', 'label']);
  });

  it('label matches ANGLE_LABELS for all angles', () => {
    for (const angle of getAllAngles()) {
      expect(getAngleInfo(angle).label).toBe(ANGLE_LABELS[angle]);
    }
  });

  it('description matches ANGLE_DESCRIPTIONS for all angles', () => {
    for (const angle of getAllAngles()) {
      expect(getAngleInfo(angle).description).toBe(ANGLE_DESCRIPTIONS[angle]);
    }
  });

  it('all labels are non-empty strings', () => {
    for (const angle of getAllAngles()) {
      expect(getAngleInfo(angle).label.length).toBeGreaterThan(0);
    }
  });

  it('all descriptions are non-empty strings', () => {
    for (const angle of getAllAngles()) {
      expect(getAngleInfo(angle).description.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Constants — structural verification
// ---------------------------------------------------------------------------

describe('ANGLE_LABELS and ANGLE_DESCRIPTIONS (follow-up)', () => {
  it('ANGLE_LABELS has entries for all 5 angles', () => {
    const expected: PhotoAngle[] = ['top', 'side', 'bottom', 'markings', 'pins'];
    for (const angle of expected) {
      expect(ANGLE_LABELS[angle]).toBeDefined();
      expect(typeof ANGLE_LABELS[angle]).toBe('string');
    }
  });

  it('ANGLE_DESCRIPTIONS has entries for all 5 angles', () => {
    const expected: PhotoAngle[] = ['top', 'side', 'bottom', 'markings', 'pins'];
    for (const angle of expected) {
      expect(ANGLE_DESCRIPTIONS[angle]).toBeDefined();
      expect(typeof ANGLE_DESCRIPTIONS[angle]).toBe('string');
    }
  });

  it('all descriptions end with a period', () => {
    for (const angle of getAllAngles()) {
      expect(ANGLE_DESCRIPTIONS[angle].endsWith('.')).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Integration: multi-angle workflow edge cases
// ---------------------------------------------------------------------------

describe('multi-angle workflow (follow-up)', () => {
  it('high-confidence result does not trigger multi-angle, no suggestions needed', () => {
    const result = makeResult({ confidence: 'high', componentType: 'ATmega328P' });
    expect(shouldRequestMultiAngle(result)).toBe(false);
  });

  it('progressive angle capture: suggest, capture one, suggest again with fewer', () => {
    const initial = makeResult({ confidence: 'low', componentType: 'IC' });

    // First round: get all suggestions
    const firstSuggestions = suggestAdditionalAngles(initial);
    expect(firstSuggestions.length).toBe(5);

    // Capture markings (first suggestion)
    const capturedAngles: PhotoAngle[] = ['markings'];
    const secondSuggestions = suggestAdditionalAngles(initial, undefined, capturedAngles);
    expect(secondSuggestions.length).toBe(4);
    expect(secondSuggestions.every((s) => s.angle !== 'markings')).toBe(true);

    // Capture top (next suggestion)
    capturedAngles.push('top');
    const thirdSuggestions = suggestAdditionalAngles(initial, undefined, capturedAngles);
    expect(thirdSuggestions.length).toBe(3);
    expect(thirdSuggestions.every((s) => s.angle !== 'markings' && s.angle !== 'top')).toBe(true);
  });

  it('merging results from all 5 angles produces a comprehensive result', () => {
    const results: AngleResult[] = [
      makeAngleResult('top', makeResult({
        confidence: 'medium',
        componentType: 'IC',
        packageType: 'TQFP-32',
        description: 'Square IC package.',
      })),
      makeAngleResult('markings', makeResult({
        confidence: 'high',
        componentType: 'STM32F103',
        partNumber: 'STM32F103C8T6',
        manufacturer: 'STMicroelectronics',
        description: 'Part number clearly visible.',
        specifications: ['ARM Cortex-M3', '72MHz'],
      })),
      makeAngleResult('pins', makeResult({
        confidence: 'medium',
        componentType: 'IC',
        pinCount: 48,
        description: '48 pins visible.',
        specifications: ['LQFP-48'],
      })),
      makeAngleResult('side', makeResult({
        confidence: 'low',
        componentType: 'IC',
        description: 'Thin profile IC.',
      })),
      makeAngleResult('bottom', makeResult({
        confidence: 'low',
        componentType: 'IC',
        description: 'Thermal pad visible.',
        notes: 'Exposed thermal pad on bottom.',
      })),
    ];

    const merged = mergeMultiAngleResults(results);
    expect(merged).not.toBeNull();

    // Best (high confidence) determines componentType
    expect(merged!.componentType).toBe('STM32F103');
    expect(merged!.partNumber).toBe('STM32F103C8T6');
    expect(merged!.manufacturer).toBe('STMicroelectronics');
    expect(merged!.confidence).toBe('high');

    // Specs union
    expect(merged!.specifications).toContain('ARM Cortex-M3');
    expect(merged!.specifications).toContain('72MHz');
    expect(merged!.specifications).toContain('LQFP-48');

    // Description combines all unique descriptions
    expect(merged!.description).toContain('Part number clearly visible.');
    expect(merged!.description).toContain('Thermal pad visible.');

    // Notes from bottom view
    expect(merged!.notes).toContain('Exposed thermal pad on bottom.');
  });

  it('workflow with only null results after capture returns null merge', () => {
    const initial = makeResult({ confidence: 'low', componentType: 'Unknown Part' });
    expect(shouldRequestMultiAngle(initial)).toBe(true);

    const results: AngleResult[] = [
      makeAngleResult('top', null),
      makeAngleResult('markings', null),
      makeAngleResult('side', null),
    ];
    const merged = mergeMultiAngleResults(results);
    expect(merged).toBeNull();
  });

  it('merging identical results deduplicates descriptions and specs', () => {
    const sameResult = makeResult({
      confidence: 'medium',
      description: 'Same IC.',
      specifications: ['5V', '16MHz'],
      notes: 'Repeated note.',
    });
    const results: AngleResult[] = [
      makeAngleResult('top', sameResult),
      makeAngleResult('side', { ...sameResult }),
      makeAngleResult('markings', { ...sameResult }),
    ];
    const merged = mergeMultiAngleResults(results);
    expect(merged!.description).toBe('Same IC.');
    expect(merged!.specifications).toHaveLength(2);
    expect(merged!.notes).toBe('Repeated note.');
  });
});
