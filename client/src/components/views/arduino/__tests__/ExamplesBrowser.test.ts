import { describe, it, expect } from 'vitest';
import {
  ARDUINO_EXAMPLES,
  ARDUINO_EXAMPLE_CATEGORIES,
} from '@shared/arduino-examples';
import type { ArduinoExample, ArduinoExampleCategory } from '@shared/arduino-examples';

// ---------------------------------------------------------------------------
// Data integrity tests for the Arduino examples library (BL-0606)
// ---------------------------------------------------------------------------
describe('Arduino Examples Library (BL-0606)', () => {
  it('exports a non-empty examples array', () => {
    expect(ARDUINO_EXAMPLES.length).toBeGreaterThanOrEqual(15);
  });

  it('exports all expected categories', () => {
    expect(ARDUINO_EXAMPLE_CATEGORIES).toContain('Basics');
    expect(ARDUINO_EXAMPLE_CATEGORIES).toContain('Digital');
    expect(ARDUINO_EXAMPLE_CATEGORIES).toContain('Analog');
    expect(ARDUINO_EXAMPLE_CATEGORIES).toContain('Communication');
    expect(ARDUINO_EXAMPLE_CATEGORIES).toContain('Sensors');
    expect(ARDUINO_EXAMPLE_CATEGORIES).toContain('Display');
    expect(ARDUINO_EXAMPLE_CATEGORIES).toContain('Motors');
  });

  it('every example has a unique id', () => {
    const ids = ARDUINO_EXAMPLES.map(e => e.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('every example has required fields', () => {
    for (const ex of ARDUINO_EXAMPLES) {
      expect(ex.id).toBeTruthy();
      expect(ex.title).toBeTruthy();
      expect(ex.description).toBeTruthy();
      expect(ex.code).toBeTruthy();
      expect(ex.tags.length).toBeGreaterThan(0);
      expect(['beginner', 'intermediate', 'advanced']).toContain(ex.difficulty);
    }
  });

  it('every example belongs to a valid category', () => {
    for (const ex of ARDUINO_EXAMPLES) {
      expect(ARDUINO_EXAMPLE_CATEGORIES).toContain(ex.category);
    }
  });

  it('every category has at least one example', () => {
    for (const cat of ARDUINO_EXAMPLE_CATEGORIES) {
      const count = ARDUINO_EXAMPLES.filter(e => e.category === cat).length;
      expect(count).toBeGreaterThanOrEqual(1);
    }
  });

  it('every example code contains setup() and loop() or is a valid sketch', () => {
    for (const ex of ARDUINO_EXAMPLES) {
      // All Arduino sketches must have setup() and loop()
      const hasSetup = ex.code.includes('void setup()');
      const hasLoop = ex.code.includes('void loop()');
      expect(hasSetup).toBe(true);
      expect(hasLoop).toBe(true);
    }
  });

  it('Blink example is present with correct structure', () => {
    const blink = ARDUINO_EXAMPLES.find(e => e.id === 'blink');
    expect(blink).toBeDefined();
    expect(blink!.title).toBe('Blink');
    expect(blink!.category).toBe('Basics');
    expect(blink!.difficulty).toBe('beginner');
    expect(blink!.code).toContain('LED_BUILTIN');
    expect(blink!.code).toContain('digitalWrite');
  });

  it('Fade example uses analogWrite', () => {
    const fade = ARDUINO_EXAMPLES.find(e => e.id === 'fade');
    expect(fade).toBeDefined();
    expect(fade!.code).toContain('analogWrite');
  });

  it('Servo Sweep example includes Servo.h', () => {
    const sweep = ARDUINO_EXAMPLES.find(e => e.id === 'servo-sweep');
    expect(sweep).toBeDefined();
    expect(sweep!.code).toContain('#include <Servo.h>');
    expect(sweep!.category).toBe('Motors');
  });

  it('examples have reasonable code length (not empty stubs)', () => {
    for (const ex of ARDUINO_EXAMPLES) {
      // Each example should have at least 100 chars of code (non-trivial)
      expect(ex.code.length).toBeGreaterThanOrEqual(100);
    }
  });

  it('search filtering works correctly', () => {
    // Simulate the search logic from ExamplesBrowser
    const query = 'servo';
    const filtered = ARDUINO_EXAMPLES.filter((ex) =>
      ex.title.toLowerCase().includes(query) ||
      ex.description.toLowerCase().includes(query) ||
      ex.tags.some((t) => t.includes(query)),
    );
    expect(filtered.length).toBeGreaterThanOrEqual(2);
    expect(filtered.some(e => e.id === 'servo-sweep')).toBe(true);
    expect(filtered.some(e => e.id === 'servo-knob')).toBe(true);
  });

  it('category filtering works correctly', () => {
    const digitalExamples = ARDUINO_EXAMPLES.filter(e => e.category === 'Digital');
    expect(digitalExamples.length).toBeGreaterThanOrEqual(2);
    for (const ex of digitalExamples) {
      expect(ex.category).toBe('Digital');
    }
  });

  it('difficulty distribution is reasonable', () => {
    const beginnerCount = ARDUINO_EXAMPLES.filter(e => e.difficulty === 'beginner').length;
    const intermediateCount = ARDUINO_EXAMPLES.filter(e => e.difficulty === 'intermediate').length;
    const advancedCount = ARDUINO_EXAMPLES.filter(e => e.difficulty === 'advanced').length;

    // Should have at least some of each level
    expect(beginnerCount).toBeGreaterThanOrEqual(5);
    expect(intermediateCount).toBeGreaterThanOrEqual(3);
    expect(advancedCount).toBeGreaterThanOrEqual(1);
  });

  it('tags are lowercase strings', () => {
    for (const ex of ARDUINO_EXAMPLES) {
      for (const tag of ex.tags) {
        expect(tag).toBe(tag.toLowerCase());
        expect(typeof tag).toBe('string');
        expect(tag.length).toBeGreaterThan(0);
      }
    }
  });

  it('combined search + category filter narrows results', () => {
    const query = 'button';
    const category: ArduinoExampleCategory = 'Digital';
    const filtered = ARDUINO_EXAMPLES.filter((ex) => {
      if (ex.category !== category) return false;
      return (
        ex.title.toLowerCase().includes(query) ||
        ex.description.toLowerCase().includes(query) ||
        ex.tags.some((t) => t.includes(query))
      );
    });
    expect(filtered.length).toBeGreaterThanOrEqual(1);
    expect(filtered.every(e => e.category === 'Digital')).toBe(true);
  });
});
