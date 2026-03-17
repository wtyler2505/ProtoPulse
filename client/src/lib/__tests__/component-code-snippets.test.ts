import { describe, it, expect } from 'vitest';
import {
  BUILT_IN_SNIPPETS,
  getSnippetsForComponent,
  searchSnippets,
  generateSetupCode,
} from '../component-code-snippets';
import type { CodeSnippet } from '../component-code-snippets';

// ---------------------------------------------------------------------------
// BUILT_IN_SNIPPETS integrity
// ---------------------------------------------------------------------------

describe('BUILT_IN_SNIPPETS', () => {
  it('contains at least 20 snippets', () => {
    expect(BUILT_IN_SNIPPETS.length).toBeGreaterThanOrEqual(20);
  });

  it('has unique IDs', () => {
    const ids = BUILT_IN_SNIPPETS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every snippet has non-empty id, title, code, and description', () => {
    for (const snippet of BUILT_IN_SNIPPETS) {
      expect(snippet.id.length).toBeGreaterThan(0);
      expect(snippet.title.length).toBeGreaterThan(0);
      expect(snippet.code.length).toBeGreaterThan(0);
      expect(snippet.description.length).toBeGreaterThan(0);
    }
  });

  it('every snippet has a componentType', () => {
    for (const snippet of BUILT_IN_SNIPPETS) {
      expect(snippet.componentType.length).toBeGreaterThan(0);
    }
  });

  it('pins is always an array', () => {
    for (const snippet of BUILT_IN_SNIPPETS) {
      expect(Array.isArray(snippet.pins)).toBe(true);
    }
  });

  it('includes is always an array', () => {
    for (const snippet of BUILT_IN_SNIPPETS) {
      expect(Array.isArray(snippet.includes)).toBe(true);
    }
  });

  it('IDs are kebab-case', () => {
    const kebabRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    for (const snippet of BUILT_IN_SNIPPETS) {
      expect(snippet.id).toMatch(kebabRegex);
    }
  });

  it('snippets with library includes list them in both includes and code', () => {
    const snippetsWithIncludes = BUILT_IN_SNIPPETS.filter((s) => s.includes.length > 0);
    expect(snippetsWithIncludes.length).toBeGreaterThan(0);
    for (const snippet of snippetsWithIncludes) {
      for (const inc of snippet.includes) {
        expect(snippet.code).toContain(`#include ${inc}`);
      }
    }
  });

  it('covers expected component types', () => {
    const types = new Set(BUILT_IN_SNIPPETS.map((s) => s.componentType));
    expect(types).toContain('led');
    expect(types).toContain('servo');
    expect(types).toContain('dht22');
    expect(types).toContain('ultrasonic');
    expect(types).toContain('i2c');
    expect(types).toContain('spi');
    expect(types).toContain('button');
    expect(types).toContain('potentiometer');
    expect(types).toContain('oled');
    expect(types).toContain('relay');
    expect(types).toContain('stepper');
    expect(types).toContain('neopixel');
    expect(types).toContain('motor');
  });

  it('led-blink snippet has expected shape', () => {
    const blink = BUILT_IN_SNIPPETS.find((s) => s.id === 'led-blink');
    expect(blink).toBeDefined();
    expect(blink!.componentType).toBe('led');
    expect(blink!.title).toBe('LED Blink');
    expect(blink!.pins).toEqual(['LED_PIN']);
    expect(blink!.includes).toEqual([]);
    expect(blink!.code).toContain('digitalWrite');
    expect(blink!.code).toContain('delay');
  });

  it('servo-sweep snippet requires Servo.h', () => {
    const servo = BUILT_IN_SNIPPETS.find((s) => s.id === 'servo-sweep');
    expect(servo).toBeDefined();
    expect(servo!.includes).toContain('<Servo.h>');
    expect(servo!.code).toContain('#include <Servo.h>');
  });
});

// ---------------------------------------------------------------------------
// getSnippetsForComponent
// ---------------------------------------------------------------------------

describe('getSnippetsForComponent', () => {
  it('returns LED snippets for "led" type', () => {
    const results = getSnippetsForComponent('led');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.every((s) => s.componentType === 'led')).toBe(true);
  });

  it('is case-insensitive', () => {
    const lower = getSnippetsForComponent('led');
    const upper = getSnippetsForComponent('LED');
    const mixed = getSnippetsForComponent('Led');
    expect(lower).toEqual(upper);
    expect(lower).toEqual(mixed);
  });

  it('resolves aliases — "hc-sr04" returns ultrasonic snippets', () => {
    const results = getSnippetsForComponent('hc-sr04');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.every((s) => s.componentType === 'ultrasonic')).toBe(true);
  });

  it('resolves aliases — "ws2812" returns neopixel snippets', () => {
    const results = getSnippetsForComponent('ws2812');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.every((s) => s.componentType === 'neopixel')).toBe(true);
  });

  it('resolves aliases — "push_button" returns button snippets', () => {
    const results = getSnippetsForComponent('push_button');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.every((s) => s.componentType === 'button')).toBe(true);
  });

  it('resolves aliases — "dc_motor" returns motor snippets', () => {
    const results = getSnippetsForComponent('dc_motor');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.every((s) => s.componentType === 'motor')).toBe(true);
  });

  it('resolves aliases — "ssd1306" returns oled snippets', () => {
    const results = getSnippetsForComponent('ssd1306');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.every((s) => s.componentType === 'oled')).toBe(true);
  });

  it('resolves aliases — "dht11" returns dht22 snippets', () => {
    const results = getSnippetsForComponent('dht11');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.every((s) => s.componentType === 'dht22')).toBe(true);
  });

  it('returns empty array for unknown component type', () => {
    const results = getSnippetsForComponent('quantum_flux_capacitor');
    expect(results).toEqual([]);
  });

  it('normalises hyphens to underscores', () => {
    const results = getSnippetsForComponent('push-button');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.every((s) => s.componentType === 'button')).toBe(true);
  });

  it('normalises spaces to underscores', () => {
    const results = getSnippetsForComponent('stepper motor');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.every((s) => s.componentType === 'stepper')).toBe(true);
  });

  it('returns multiple snippets for LED', () => {
    const results = getSnippetsForComponent('led');
    // led-blink, pwm-fade, millis-timing — all componentType 'led'
    expect(results.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// searchSnippets
// ---------------------------------------------------------------------------

describe('searchSnippets', () => {
  it('returns all snippets for empty query', () => {
    expect(searchSnippets('')).toHaveLength(BUILT_IN_SNIPPETS.length);
  });

  it('returns all snippets for whitespace-only query', () => {
    expect(searchSnippets('   ')).toHaveLength(BUILT_IN_SNIPPETS.length);
  });

  it('finds "servo" by title', () => {
    const results = searchSnippets('servo');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((s) => s.id === 'servo-sweep')).toBe(true);
  });

  it('finds snippets by description keyword', () => {
    const results = searchSnippets('temperature');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((s) => s.id === 'dht22-read')).toBe(true);
  });

  it('finds snippets by pin name', () => {
    const results = searchSnippets('TRIG_PIN');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((s) => s.id === 'ultrasonic-distance')).toBe(true);
  });

  it('is case-insensitive', () => {
    const upper = searchSnippets('SERVO');
    const lower = searchSnippets('servo');
    expect(upper).toEqual(lower);
  });

  it('supports multi-word AND search', () => {
    const results = searchSnippets('motor reverse');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((s) => s.id === 'motor-driver')).toBe(true);
  });

  it('returns empty array when no terms match', () => {
    const results = searchSnippets('xyzzyx quantum entanglement');
    expect(results).toEqual([]);
  });

  it('finds snippets by include library name', () => {
    const results = searchSnippets('Wire.h');
    expect(results.length).toBeGreaterThanOrEqual(1);
    // i2c-scan, oled-hello, lcd-i2c, bme280-read all use Wire.h
  });

  it('finds snippets by component type', () => {
    const results = searchSnippets('piezo');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((s) => s.id === 'piezo-tone')).toBe(true);
  });

  it('finds snippets by id fragment', () => {
    const results = searchSnippets('neopixel');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((s) => s.id === 'neopixel-rainbow')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// generateSetupCode
// ---------------------------------------------------------------------------

describe('generateSetupCode', () => {
  it('returns empty string for empty array', () => {
    expect(generateSetupCode([])).toBe('');
  });

  it('generates valid code for a single snippet', () => {
    const blink = BUILT_IN_SNIPPETS.find((s) => s.id === 'led-blink')!;
    const code = generateSetupCode([blink]);
    expect(code).toContain('void setup()');
    expect(code).toContain('void loop()');
    expect(code).toContain('LED_PIN');
    expect(code).toContain('pinMode');
    expect(code).toContain('digitalWrite');
  });

  it('deduplicates #include directives', () => {
    const i2c = BUILT_IN_SNIPPETS.find((s) => s.id === 'i2c-scan')!;
    const oled = BUILT_IN_SNIPPETS.find((s) => s.id === 'oled-hello')!;
    const code = generateSetupCode([i2c, oled]);

    // Wire.h used by both — should appear only once
    const wireMatches = code.match(/#include <Wire\.h>/g);
    expect(wireMatches).not.toBeNull();
    expect(wireMatches!.length).toBe(1);
  });

  it('merges setup bodies from multiple snippets', () => {
    const blink = BUILT_IN_SNIPPETS.find((s) => s.id === 'led-blink')!;
    const pot = BUILT_IN_SNIPPETS.find((s) => s.id === 'potentiometer-read')!;
    const code = generateSetupCode([blink, pot]);

    // Should have one setup() containing both bodies
    const setupMatches = code.match(/void setup\(\)/g);
    expect(setupMatches).toHaveLength(1);

    // Both snippets' setup code should be present
    expect(code).toContain('pinMode(LED_PIN, OUTPUT)');
    expect(code).toContain('Serial.begin(9600)');
  });

  it('merges loop bodies from multiple snippets', () => {
    const blink = BUILT_IN_SNIPPETS.find((s) => s.id === 'led-blink')!;
    const pot = BUILT_IN_SNIPPETS.find((s) => s.id === 'potentiometer-read')!;
    const code = generateSetupCode([blink, pot]);

    const loopMatches = code.match(/void loop\(\)/g);
    expect(loopMatches).toHaveLength(1);

    // Both loop contents present
    expect(code).toContain('digitalWrite(LED_PIN');
    expect(code).toContain('analogRead(POT_PIN)');
  });

  it('includes section comment headers per snippet', () => {
    const blink = BUILT_IN_SNIPPETS.find((s) => s.id === 'led-blink')!;
    const relay = BUILT_IN_SNIPPETS.find((s) => s.id === 'relay-toggle')!;
    const code = generateSetupCode([blink, relay]);

    expect(code).toContain('// --- LED Blink ---');
    expect(code).toContain('// --- Relay Toggle ---');
    expect(code).toContain('// LED Blink');
    expect(code).toContain('// Relay Toggle');
  });

  it('preserves global variable declarations', () => {
    const debounce = BUILT_IN_SNIPPETS.find((s) => s.id === 'button-debounce')!;
    const code = generateSetupCode([debounce]);
    expect(code).toContain('const int BUTTON_PIN = 2');
    expect(code).toContain('unsigned long lastDebounceTime = 0');
  });

  it('handles snippets with no setup or no loop', () => {
    // piezo-tone has an empty setup()
    const piezo = BUILT_IN_SNIPPETS.find((s) => s.id === 'piezo-tone')!;
    const code = generateSetupCode([piezo]);
    expect(code).toContain('void setup()');
    expect(code).toContain('void loop()');
    expect(code).toContain('tone(PIEZO_PIN');
  });

  it('sorts #include directives alphabetically', () => {
    const oled = BUILT_IN_SNIPPETS.find((s) => s.id === 'oled-hello')!;
    const code = generateSetupCode([oled]);
    const includeLines = code
      .split('\n')
      .filter((line) => line.startsWith('#include'));
    expect(includeLines.length).toBeGreaterThanOrEqual(2);

    // Verify sorted order
    for (let i = 1; i < includeLines.length; i++) {
      expect(includeLines[i]! >= includeLines[i - 1]!).toBe(true);
    }
  });

  it('merges three or more snippets correctly', () => {
    const led = BUILT_IN_SNIPPETS.find((s) => s.id === 'led-blink')!;
    const pot = BUILT_IN_SNIPPETS.find((s) => s.id === 'potentiometer-read')!;
    const relay = BUILT_IN_SNIPPETS.find((s) => s.id === 'relay-toggle')!;
    const code = generateSetupCode([led, pot, relay]);

    // All three globals
    expect(code).toContain('LED_PIN');
    expect(code).toContain('POT_PIN');
    expect(code).toContain('RELAY_PIN');

    // Single setup and loop
    const setupMatches = code.match(/void setup\(\)/g);
    const loopMatches = code.match(/void loop\(\)/g);
    expect(setupMatches).toHaveLength(1);
    expect(loopMatches).toHaveLength(1);
  });

  it('preserves ISR function definitions in globals', () => {
    const encoder = BUILT_IN_SNIPPETS.find((s) => s.id === 'encoder-read')!;
    const code = generateSetupCode([encoder]);
    expect(code).toContain('void readEncoder()');
    expect(code).toContain('encoderPos++');
  });

  it('handles snippet with multiple includes', () => {
    const lcd = BUILT_IN_SNIPPETS.find((s) => s.id === 'lcd-i2c')!;
    const code = generateSetupCode([lcd]);
    expect(code).toContain('#include <Wire.h>');
    expect(code).toContain('#include <LiquidCrystal_I2C.h>');
  });

  it('handles snippet with no pins gracefully', () => {
    const i2c = BUILT_IN_SNIPPETS.find((s) => s.id === 'i2c-scan')!;
    expect(i2c.pins).toEqual([]);
    const code = generateSetupCode([i2c]);
    expect(code).toContain('void setup()');
    expect(code).toContain('Wire.begin()');
  });
});

// ---------------------------------------------------------------------------
// CodeSnippet type structure
// ---------------------------------------------------------------------------

describe('CodeSnippet type structure', () => {
  it('all fields are readonly at the array level', () => {
    // BUILT_IN_SNIPPETS is readonly — verify we cannot push
    // (This is a compile-time check; at runtime we just verify the shape.)
    const snippet: CodeSnippet = BUILT_IN_SNIPPETS[0]!;
    expect(typeof snippet.id).toBe('string');
    expect(typeof snippet.componentType).toBe('string');
    expect(typeof snippet.title).toBe('string');
    expect(typeof snippet.code).toBe('string');
    expect(Array.isArray(snippet.pins)).toBe(true);
    expect(typeof snippet.description).toBe('string');
    expect(Array.isArray(snippet.includes)).toBe(true);
  });
});
