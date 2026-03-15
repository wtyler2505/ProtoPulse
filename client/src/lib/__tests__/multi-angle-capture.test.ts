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
// confidenceToNumeric
// ---------------------------------------------------------------------------

describe('confidenceToNumeric', () => {
  it('maps high to 0.9', () => {
    expect(confidenceToNumeric('high')).toBe(0.9);
  });

  it('maps medium to 0.6', () => {
    expect(confidenceToNumeric('medium')).toBe(0.6);
  });

  it('maps low to 0.3', () => {
    expect(confidenceToNumeric('low')).toBe(0.3);
  });
});

// ---------------------------------------------------------------------------
// numericToConfidence
// ---------------------------------------------------------------------------

describe('numericToConfidence', () => {
  it('returns high for score >= 0.75', () => {
    expect(numericToConfidence(0.75)).toBe('high');
    expect(numericToConfidence(0.9)).toBe('high');
    expect(numericToConfidence(1.0)).toBe('high');
  });

  it('returns medium for score >= 0.45 and < 0.75', () => {
    expect(numericToConfidence(0.45)).toBe('medium');
    expect(numericToConfidence(0.6)).toBe('medium');
    expect(numericToConfidence(0.74)).toBe('medium');
  });

  it('returns low for score < 0.45', () => {
    expect(numericToConfidence(0.0)).toBe('low');
    expect(numericToConfidence(0.3)).toBe('low');
    expect(numericToConfidence(0.44)).toBe('low');
  });
});

// ---------------------------------------------------------------------------
// categorizeComponentType
// ---------------------------------------------------------------------------

describe('categorizeComponentType', () => {
  const icTerms = ['IC', 'Microcontroller', 'MCU', 'Processor', 'op-amp', 'voltage regulator', 'EEPROM', 'sensor', 'ADC driver'];
  const passiveTerms = ['Resistor', 'Capacitor', 'Inductor', 'Ferrite Bead', 'Fuse', 'Crystal'];
  const connectorTerms = ['Connector', 'Pin Header', 'USB-C Socket', 'RJ45 Jack', 'Barrel Plug'];
  const electroTerms = ['Relay', 'Toggle Switch', 'Push Button', 'Potentiometer', 'Rotary Encoder'];
  const discreteTerms = ['Diode', 'LED', 'NPN Transistor', 'MOSFET', 'Zener Diode', 'Schottky Rectifier'];
  const moduleTerms = ['WiFi Module', 'Breakout Board', 'Arduino Nano', 'ESP32 DevKit', 'Raspberry Pi Hat'];

  it.each(icTerms)('classifies "%s" as ic', (term) => {
    expect(categorizeComponentType(term)).toBe('ic' as ComponentCategory);
  });

  it.each(passiveTerms)('classifies "%s" as passive', (term) => {
    expect(categorizeComponentType(term)).toBe('passive' as ComponentCategory);
  });

  it.each(connectorTerms)('classifies "%s" as connector', (term) => {
    expect(categorizeComponentType(term)).toBe('connector' as ComponentCategory);
  });

  it.each(electroTerms)('classifies "%s" as electromechanical', (term) => {
    expect(categorizeComponentType(term)).toBe('electromechanical' as ComponentCategory);
  });

  it.each(discreteTerms)('classifies "%s" as discrete', (term) => {
    expect(categorizeComponentType(term)).toBe('discrete' as ComponentCategory);
  });

  it.each(moduleTerms)('classifies "%s" as module', (term) => {
    expect(categorizeComponentType(term)).toBe('module' as ComponentCategory);
  });

  it('returns unknown for unrecognized types', () => {
    expect(categorizeComponentType('mystery part')).toBe('unknown');
    expect(categorizeComponentType('')).toBe('unknown');
    expect(categorizeComponentType('flux capacitor')).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// shouldRequestMultiAngle
// ---------------------------------------------------------------------------

describe('shouldRequestMultiAngle', () => {
  it('returns true for low confidence', () => {
    expect(shouldRequestMultiAngle(makeResult({ confidence: 'low' }))).toBe(true);
  });

  it('returns true for medium confidence (0.6 < 0.7)', () => {
    expect(shouldRequestMultiAngle(makeResult({ confidence: 'medium' }))).toBe(true);
  });

  it('returns false for high confidence (0.9 >= 0.7)', () => {
    expect(shouldRequestMultiAngle(makeResult({ confidence: 'high' }))).toBe(false);
  });

  it('threshold is 0.7', () => {
    expect(LOW_CONFIDENCE_THRESHOLD).toBe(0.7);
  });
});

// ---------------------------------------------------------------------------
// suggestAdditionalAngles
// ---------------------------------------------------------------------------

describe('suggestAdditionalAngles', () => {
  it('returns angle suggestions for an IC with low confidence', () => {
    const result = makeResult({ confidence: 'low', componentType: 'IC' });
    const suggestions = suggestAdditionalAngles(result);
    expect(suggestions.length).toBeGreaterThan(0);
    // IC markings should be highest priority
    expect(suggestions[0].angle).toBe('markings');
  });

  it('returns angle suggestions for a connector', () => {
    const result = makeResult({ confidence: 'low', componentType: 'USB Connector' });
    const suggestions = suggestAdditionalAngles(result);
    expect(suggestions.length).toBeGreaterThan(0);
    // Connector pins should be highest priority
    expect(suggestions[0].angle).toBe('pins');
  });

  it('returns angle suggestions for passives', () => {
    const result = makeResult({ confidence: 'medium', componentType: 'Resistor' });
    const suggestions = suggestAdditionalAngles(result);
    expect(suggestions.length).toBeGreaterThan(0);
    // Passive markings should be highest priority
    expect(suggestions[0].angle).toBe('markings');
  });

  it('returns angle suggestions for discrete semiconductors', () => {
    const result = makeResult({ confidence: 'low', componentType: 'MOSFET' });
    const suggestions = suggestAdditionalAngles(result);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].angle).toBe('markings');
  });

  it('returns angle suggestions for electromechanical', () => {
    const result = makeResult({ confidence: 'low', componentType: 'Relay' });
    const suggestions = suggestAdditionalAngles(result);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].angle).toBe('top');
  });

  it('returns angle suggestions for modules', () => {
    const result = makeResult({ confidence: 'low', componentType: 'ESP32 Module' });
    const suggestions = suggestAdditionalAngles(result);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].angle).toBe('top');
  });

  it('returns angle suggestions for unknown types', () => {
    const result = makeResult({ confidence: 'low', componentType: 'Mystery Part' });
    const suggestions = suggestAdditionalAngles(result);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].angle).toBe('top');
  });

  it('filters out already-captured angles', () => {
    const result = makeResult({ confidence: 'low', componentType: 'IC' });
    const suggestions = suggestAdditionalAngles(result, undefined, ['markings', 'top']);
    // markings and top should be filtered out
    for (const s of suggestions) {
      expect(s.angle).not.toBe('markings');
      expect(s.angle).not.toBe('top');
    }
  });

  it('returns empty array when all angles are already captured', () => {
    const result = makeResult({ confidence: 'low', componentType: 'Resistor' });
    const allPassiveAngles: PhotoAngle[] = ['markings', 'top', 'side'];
    const suggestions = suggestAdditionalAngles(result, undefined, allPassiveAngles);
    expect(suggestions).toHaveLength(0);
  });

  it('returns more suggestions for very low confidence (low) than medium', () => {
    const lowResult = makeResult({ confidence: 'low', componentType: 'IC' });
    const medResult = makeResult({ confidence: 'medium', componentType: 'IC' });

    const lowSuggestions = suggestAdditionalAngles(lowResult);
    const medSuggestions = suggestAdditionalAngles(medResult);

    // Low confidence should get all remaining angles (5 for IC)
    // Medium confidence should get max 3
    expect(lowSuggestions.length).toBeGreaterThanOrEqual(medSuggestions.length);
  });

  it('uses componentType override when provided', () => {
    const result = makeResult({ confidence: 'low', componentType: 'Unknown Part' });
    const suggestions = suggestAdditionalAngles(result, 'Relay');
    // Should use Relay = electromechanical, not unknown
    expect(suggestions[0].angle).toBe('top');
  });

  it('suggestions are sorted by priority (ascending)', () => {
    const result = makeResult({ confidence: 'low', componentType: 'IC' });
    const suggestions = suggestAdditionalAngles(result);
    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i].priority).toBeGreaterThanOrEqual(suggestions[i - 1].priority);
    }
  });

  it('each suggestion has instruction and reason', () => {
    const result = makeResult({ confidence: 'low', componentType: 'Capacitor' });
    const suggestions = suggestAdditionalAngles(result);
    for (const s of suggestions) {
      expect(s.instruction).toBeTruthy();
      expect(s.reason).toBeTruthy();
      expect(typeof s.instruction).toBe('string');
      expect(typeof s.reason).toBe('string');
      expect(s.instruction.length).toBeGreaterThan(10);
      expect(s.reason.length).toBeGreaterThan(10);
    }
  });

  it('medium confidence (0.6) limits to at most 3 suggestions', () => {
    const result = makeResult({ confidence: 'medium', componentType: 'IC' });
    const suggestions = suggestAdditionalAngles(result);
    expect(suggestions.length).toBeLessThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// mergeMultiAngleResults
// ---------------------------------------------------------------------------

describe('mergeMultiAngleResults', () => {
  it('returns null for empty results array', () => {
    expect(mergeMultiAngleResults([])).toBeNull();
  });

  it('returns null when all results have null identification', () => {
    const results: AngleResult[] = [
      makeAngleResult('top', null),
      makeAngleResult('side', null),
    ];
    expect(mergeMultiAngleResults(results)).toBeNull();
  });

  it('returns the single result unchanged when only one valid result', () => {
    const idResult = makeResult({ confidence: 'medium', partNumber: 'ATmega328P' });
    const results: AngleResult[] = [makeAngleResult('top', idResult)];
    const merged = mergeMultiAngleResults(results);
    expect(merged).not.toBeNull();
    expect(merged!.componentType).toBe(idResult.componentType);
    expect(merged!.partNumber).toBe('ATmega328P');
    expect(merged!.confidence).toBe('medium');
  });

  it('uses componentType from highest-confidence result', () => {
    const results: AngleResult[] = [
      makeAngleResult('top', makeResult({ confidence: 'low', componentType: 'Chip' })),
      makeAngleResult('markings', makeResult({ confidence: 'high', componentType: 'ATmega328P MCU' })),
    ];
    const merged = mergeMultiAngleResults(results);
    expect(merged!.componentType).toBe('ATmega328P MCU');
  });

  it('uses packageType from highest-confidence result', () => {
    const results: AngleResult[] = [
      makeAngleResult('top', makeResult({ confidence: 'low', packageType: 'QFP' })),
      makeAngleResult('side', makeResult({ confidence: 'medium', packageType: 'TQFP-32' })),
    ];
    const merged = mergeMultiAngleResults(results);
    expect(merged!.packageType).toBe('TQFP-32');
  });

  it('picks first non-null partNumber from highest to lowest confidence', () => {
    const results: AngleResult[] = [
      makeAngleResult('top', makeResult({ confidence: 'high', partNumber: null })),
      makeAngleResult('markings', makeResult({ confidence: 'medium', partNumber: 'NE555P' })),
      makeAngleResult('side', makeResult({ confidence: 'low', partNumber: 'NE555' })),
    ];
    const merged = mergeMultiAngleResults(results);
    expect(merged!.partNumber).toBe('NE555P');
  });

  it('picks first non-null manufacturer from highest to lowest confidence', () => {
    const results: AngleResult[] = [
      makeAngleResult('top', makeResult({ confidence: 'medium', manufacturer: null })),
      makeAngleResult('markings', makeResult({ confidence: 'low', manufacturer: 'Texas Instruments' })),
    ];
    const merged = mergeMultiAngleResults(results);
    expect(merged!.manufacturer).toBe('Texas Instruments');
  });

  it('uses most common pinCount across results', () => {
    const results: AngleResult[] = [
      makeAngleResult('top', makeResult({ confidence: 'high', pinCount: 8 })),
      makeAngleResult('pins', makeResult({ confidence: 'medium', pinCount: 14 })),
      makeAngleResult('side', makeResult({ confidence: 'low', pinCount: 14 })),
    ];
    const merged = mergeMultiAngleResults(results);
    // 14 appears twice vs 8 once
    expect(merged!.pinCount).toBe(14);
  });

  it('falls back to best result pinCount when all unique', () => {
    const results: AngleResult[] = [
      makeAngleResult('top', makeResult({ confidence: 'high', pinCount: 8 })),
      makeAngleResult('pins', makeResult({ confidence: 'low', pinCount: 14 })),
    ];
    const merged = mergeMultiAngleResults(results);
    // Both appear once, 8 comes first in iteration (higher confidence)
    expect(merged!.pinCount).toBe(8);
  });

  it('merges specifications as a union of unique values', () => {
    const results: AngleResult[] = [
      makeAngleResult('top', makeResult({ specifications: ['5V', '16MHz'] })),
      makeAngleResult('markings', makeResult({ specifications: ['16MHz', '32KB Flash'] })),
    ];
    const merged = mergeMultiAngleResults(results);
    expect(merged!.specifications).toContain('5V');
    expect(merged!.specifications).toContain('16MHz');
    expect(merged!.specifications).toContain('32KB Flash');
    // No duplicates
    expect(merged!.specifications.filter((s) => s === '16MHz')).toHaveLength(1);
  });

  it('merges unique descriptions joined by pipe', () => {
    const results: AngleResult[] = [
      makeAngleResult('top', makeResult({ confidence: 'high', description: 'A microcontroller.' })),
      makeAngleResult('markings', makeResult({ confidence: 'low', description: 'An IC with markings.' })),
    ];
    const merged = mergeMultiAngleResults(results);
    expect(merged!.description).toContain('A microcontroller.');
    expect(merged!.description).toContain('An IC with markings.');
    expect(merged!.description).toContain(' | ');
  });

  it('deduplicates identical descriptions', () => {
    const results: AngleResult[] = [
      makeAngleResult('top', makeResult({ description: 'Same description.' })),
      makeAngleResult('side', makeResult({ description: 'Same description.' })),
    ];
    const merged = mergeMultiAngleResults(results);
    expect(merged!.description).toBe('Same description.');
  });

  it('merges unique notes joined by pipe', () => {
    const results: AngleResult[] = [
      makeAngleResult('top', makeResult({ notes: 'Note 1' })),
      makeAngleResult('side', makeResult({ notes: 'Note 2' })),
    ];
    const merged = mergeMultiAngleResults(results);
    expect(merged!.notes).toContain('Note 1');
    expect(merged!.notes).toContain('Note 2');
  });

  it('returns null notes when no results have notes', () => {
    const results: AngleResult[] = [
      makeAngleResult('top', makeResult({ notes: null })),
      makeAngleResult('side', makeResult({ notes: null })),
    ];
    const merged = mergeMultiAngleResults(results);
    expect(merged!.notes).toBeNull();
  });

  it('uses suggestedBom from highest-confidence result that has one', () => {
    const bom = {
      partNumber: 'ATmega328P-AU',
      manufacturer: 'Microchip',
      description: 'MCU 8-bit AVR',
      category: 'ICs',
      unitPrice: 2.5,
    };
    const results: AngleResult[] = [
      makeAngleResult('top', makeResult({ confidence: 'high', suggestedBom: null })),
      makeAngleResult('markings', makeResult({ confidence: 'medium', suggestedBom: bom })),
    ];
    const merged = mergeMultiAngleResults(results);
    expect(merged!.suggestedBom).toEqual(bom);
  });

  it('boosts confidence when multiple results are merged', () => {
    const results: AngleResult[] = [
      makeAngleResult('top', makeResult({ confidence: 'medium' })),
      makeAngleResult('markings', makeResult({ confidence: 'medium' })),
      makeAngleResult('side', makeResult({ confidence: 'low' })),
    ];
    const merged = mergeMultiAngleResults(results);
    // Medium (0.6) + boost should reach high threshold
    expect(merged!.confidence).toBe('high');
  });

  it('confidence is capped and never exceeds high', () => {
    const results: AngleResult[] = [
      makeAngleResult('top', makeResult({ confidence: 'high' })),
      makeAngleResult('markings', makeResult({ confidence: 'high' })),
      makeAngleResult('side', makeResult({ confidence: 'high' })),
      makeAngleResult('pins', makeResult({ confidence: 'high' })),
      makeAngleResult('bottom', makeResult({ confidence: 'high' })),
    ];
    const merged = mergeMultiAngleResults(results);
    expect(merged!.confidence).toBe('high');
  });

  it('skips null results in the array', () => {
    const results: AngleResult[] = [
      makeAngleResult('top', null),
      makeAngleResult('markings', makeResult({ confidence: 'medium', partNumber: 'LM7805' })),
      makeAngleResult('side', null),
    ];
    const merged = mergeMultiAngleResults(results);
    expect(merged).not.toBeNull();
    expect(merged!.partNumber).toBe('LM7805');
  });
});

// ---------------------------------------------------------------------------
// getAllAngles
// ---------------------------------------------------------------------------

describe('getAllAngles', () => {
  it('returns all 5 photo angles', () => {
    const angles = getAllAngles();
    expect(angles).toHaveLength(5);
    expect(angles).toContain('top');
    expect(angles).toContain('side');
    expect(angles).toContain('bottom');
    expect(angles).toContain('markings');
    expect(angles).toContain('pins');
  });
});

// ---------------------------------------------------------------------------
// getAngleInfo
// ---------------------------------------------------------------------------

describe('getAngleInfo', () => {
  it('returns label and description for each angle', () => {
    const allAngles: PhotoAngle[] = ['top', 'side', 'bottom', 'markings', 'pins'];
    for (const angle of allAngles) {
      const info = getAngleInfo(angle);
      expect(info.label).toBe(ANGLE_LABELS[angle]);
      expect(info.description).toBe(ANGLE_DESCRIPTIONS[angle]);
      expect(info.label.length).toBeGreaterThan(0);
      expect(info.description.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Integration: full multi-angle workflow
// ---------------------------------------------------------------------------

describe('multi-angle workflow integration', () => {
  it('full flow: low confidence -> suggest -> merge', () => {
    // Step 1: Initial low-confidence result
    const initial = makeResult({
      confidence: 'low',
      componentType: 'IC',
      description: 'Looks like an IC chip.',
      partNumber: null,
      manufacturer: null,
    });

    // Step 2: Check if multi-angle is needed
    expect(shouldRequestMultiAngle(initial)).toBe(true);

    // Step 3: Get angle suggestions
    const suggestions = suggestAdditionalAngles(initial, 'IC', ['top']);
    expect(suggestions.length).toBeGreaterThan(0);
    // Since top is already captured, first suggestion should be markings
    expect(suggestions[0].angle).toBe('markings');

    // Step 4: Simulate capturing additional angles and getting results
    const angleResults: AngleResult[] = [
      makeAngleResult('top', initial),
      makeAngleResult('markings', makeResult({
        confidence: 'medium',
        componentType: 'ATmega328P',
        partNumber: 'ATmega328P-AU',
        manufacturer: 'Microchip',
        description: 'Markings show ATmega328P-AU.',
        specifications: ['8-bit AVR', '16MHz'],
      })),
      makeAngleResult('pins', makeResult({
        confidence: 'medium',
        componentType: 'IC',
        pinCount: 32,
        description: '32-pin TQFP package.',
        packageType: 'TQFP-32',
        specifications: ['32-pin'],
      })),
    ];

    // Step 5: Merge results
    const merged = mergeMultiAngleResults(angleResults);
    expect(merged).not.toBeNull();

    // Merged result should have boosted confidence
    expect(merged!.confidence).toBe('high');

    // Should pick the best component type
    expect(merged!.componentType).toBe('ATmega328P');

    // Should have the part number from markings
    expect(merged!.partNumber).toBe('ATmega328P-AU');

    // Should have merged specifications
    expect(merged!.specifications).toContain('8-bit AVR');
    expect(merged!.specifications).toContain('16MHz');
    expect(merged!.specifications).toContain('32-pin');

    // Merged result should not need more angles
    expect(shouldRequestMultiAngle(merged!)).toBe(false);
  });
});
