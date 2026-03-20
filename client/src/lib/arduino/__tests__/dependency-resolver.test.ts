import { describe, it, expect } from 'vitest';
import {
  extractIncludes,
  resolveDependencies,
  ARDUINO_CORE_HEADERS,
  KNOWN_LIBRARY_HEADERS,
} from '../dependency-resolver';

// ──────────────────────────────────────────────────────────────────
// extractIncludes
// ──────────────────────────────────────────────────────────────────

describe('extractIncludes', () => {
  it('extracts system includes with angle brackets', () => {
    const code = `#include <Arduino.h>\n#include <Wire.h>`;
    const includes = extractIncludes(code);
    expect(includes).toHaveLength(2);
    expect(includes[0]).toEqual({ header: 'Arduino.h', line: 1, isSystem: true });
    expect(includes[1]).toEqual({ header: 'Wire.h', line: 2, isSystem: true });
  });

  it('extracts local includes with double quotes', () => {
    const code = `#include "config.h"\n#include "motors.h"`;
    const includes = extractIncludes(code);
    expect(includes).toHaveLength(2);
    expect(includes[0]).toEqual({ header: 'config.h', line: 1, isSystem: false });
    expect(includes[1]).toEqual({ header: 'motors.h', line: 2, isSystem: false });
  });

  it('handles mixed include types', () => {
    const code = `#include <Arduino.h>\n#include "config.h"\n#include <Wire.h>`;
    const includes = extractIncludes(code);
    expect(includes).toHaveLength(3);
    expect(includes[0].isSystem).toBe(true);
    expect(includes[1].isSystem).toBe(false);
    expect(includes[2].isSystem).toBe(true);
  });

  it('handles whitespace around include directive', () => {
    const code = `  #include <Wire.h>\n  #  include  <SPI.h>`;
    const includes = extractIncludes(code);
    expect(includes).toHaveLength(2);
    expect(includes[0].header).toBe('Wire.h');
    expect(includes[1].header).toBe('SPI.h');
  });

  it('ignores commented-out includes', () => {
    const code = `// #include <Wire.h>\n#include <SPI.h>`;
    const includes = extractIncludes(code);
    expect(includes).toHaveLength(1);
    expect(includes[0].header).toBe('SPI.h');
  });

  it('handles include with trailing comment', () => {
    const code = `#include <Wire.h> // I2C library`;
    const includes = extractIncludes(code);
    expect(includes).toHaveLength(1);
    expect(includes[0].header).toBe('Wire.h');
  });

  it('returns empty for code without includes', () => {
    const code = `void setup() {}\nvoid loop() {}`;
    expect(extractIncludes(code)).toHaveLength(0);
  });

  it('handles subpath headers', () => {
    const code = `#include <avr/io.h>\n#include <avr/interrupt.h>`;
    const includes = extractIncludes(code);
    expect(includes).toHaveLength(2);
    expect(includes[0].header).toBe('avr/io.h');
    expect(includes[1].header).toBe('avr/interrupt.h');
  });

  it('tracks correct line numbers', () => {
    const code = `\n\n#include <Wire.h>\n\n\n#include <SPI.h>`;
    const includes = extractIncludes(code);
    expect(includes[0].line).toBe(3);
    expect(includes[1].line).toBe(6);
  });

  it('handles whitespace inside angle brackets', () => {
    const code = `#include < Wire.h >`;
    const includes = extractIncludes(code);
    expect(includes).toHaveLength(1);
    expect(includes[0].header).toBe('Wire.h');
  });
});

// ──────────────────────────────────────────────────────────────────
// ARDUINO_CORE_HEADERS
// ──────────────────────────────────────────────────────────────────

describe('ARDUINO_CORE_HEADERS', () => {
  it('contains Arduino.h', () => {
    expect(ARDUINO_CORE_HEADERS.has('Arduino.h')).toBe(true);
  });

  it('contains AVR headers', () => {
    expect(ARDUINO_CORE_HEADERS.has('avr/io.h')).toBe(true);
    expect(ARDUINO_CORE_HEADERS.has('avr/interrupt.h')).toBe(true);
    expect(ARDUINO_CORE_HEADERS.has('avr/pgmspace.h')).toBe(true);
  });

  it('contains standard C headers', () => {
    expect(ARDUINO_CORE_HEADERS.has('stdint.h')).toBe(true);
    expect(ARDUINO_CORE_HEADERS.has('string.h')).toBe(true);
    expect(ARDUINO_CORE_HEADERS.has('math.h')).toBe(true);
  });

  it('does not contain library headers', () => {
    expect(ARDUINO_CORE_HEADERS.has('Wire.h')).toBe(false);
    expect(ARDUINO_CORE_HEADERS.has('FastLED.h')).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────
// KNOWN_LIBRARY_HEADERS
// ──────────────────────────────────────────────────────────────────

describe('KNOWN_LIBRARY_HEADERS', () => {
  it('contains at least 30 mappings', () => {
    expect(KNOWN_LIBRARY_HEADERS.size).toBeGreaterThanOrEqual(30);
  });

  it('maps common headers correctly', () => {
    expect(KNOWN_LIBRARY_HEADERS.get('Wire.h')).toBe('Wire');
    expect(KNOWN_LIBRARY_HEADERS.get('Servo.h')).toBe('Servo');
    expect(KNOWN_LIBRARY_HEADERS.get('FastLED.h')).toBe('FastLED');
    expect(KNOWN_LIBRARY_HEADERS.get('ArduinoJson.h')).toBe('ArduinoJson');
    expect(KNOWN_LIBRARY_HEADERS.get('Adafruit_NeoPixel.h')).toBe('Adafruit NeoPixel');
  });

  it('maps ESP32 headers correctly', () => {
    expect(KNOWN_LIBRARY_HEADERS.get('BluetoothSerial.h')).toBe('BluetoothSerial');
    expect(KNOWN_LIBRARY_HEADERS.get('WiFiManager.h')).toBe('WiFiManager');
  });

  it('maps display libraries correctly', () => {
    expect(KNOWN_LIBRARY_HEADERS.get('U8g2lib.h')).toBe('U8g2');
    expect(KNOWN_LIBRARY_HEADERS.get('TFT_eSPI.h')).toBe('TFT_eSPI');
    expect(KNOWN_LIBRARY_HEADERS.get('LiquidCrystal_I2C.h')).toBe('LiquidCrystal I2C');
  });
});

// ──────────────────────────────────────────────────────────────────
// resolveDependencies — basic resolution
// ──────────────────────────────────────────────────────────────────

describe('resolveDependencies — basic resolution', () => {
  it('resolves installed libraries', () => {
    const code = `#include <Wire.h>\n#include <Servo.h>`;
    const installed = new Map([
      ['Wire', '1.0'],
      ['Servo', '1.2.1'],
    ]);
    const result = resolveDependencies(code, installed);
    expect(result.resolved).toHaveLength(2);
    expect(result.missing).toHaveLength(0);
    expect(result.resolved[0].name).toBe('Wire');
    expect(result.resolved[0].installed).toBe(true);
    expect(result.resolved[0].version).toBe('1.0');
  });

  it('identifies missing libraries', () => {
    const code = `#include <FastLED.h>`;
    const installed = new Map<string, string>();
    const result = resolveDependencies(code, installed);
    expect(result.resolved).toHaveLength(0);
    expect(result.missing).toHaveLength(1);
    expect(result.missing[0].name).toBe('FastLED');
    expect(result.missing[0].installed).toBe(false);
  });

  it('skips Arduino core headers', () => {
    const code = `#include <Arduino.h>\n#include <avr/io.h>\n#include <Wire.h>`;
    const installed = new Map([['Wire', '1.0']]);
    const result = resolveDependencies(code, installed);
    expect(result.resolved).toHaveLength(1);
    expect(result.resolved[0].name).toBe('Wire');
  });

  it('skips standard C headers', () => {
    const code = `#include <stdint.h>\n#include <string.h>\n#include <SPI.h>`;
    const installed = new Map([['SPI', '1.0']]);
    const result = resolveDependencies(code, installed);
    expect(result.resolved).toHaveLength(1);
    expect(result.resolved[0].name).toBe('SPI');
  });

  it('skips local includes that are not known libraries', () => {
    const code = `#include "config.h"\n#include "my_module.h"\n#include <Wire.h>`;
    const installed = new Map([['Wire', '1.0']]);
    const result = resolveDependencies(code, installed);
    expect(result.resolved).toHaveLength(1);
  });

  it('returns empty result for code with only core headers', () => {
    const code = `#include <Arduino.h>\n#include <avr/interrupt.h>`;
    const result = resolveDependencies(code, new Map());
    expect(result.resolved).toHaveLength(0);
    expect(result.missing).toHaveLength(0);
  });

  it('deduplicates libraries from multiple includes', () => {
    const code = `#include <Wire.h>\n#include <Wire.h>`;
    const installed = new Map([['Wire', '1.0']]);
    const result = resolveDependencies(code, installed);
    expect(result.resolved).toHaveLength(1);
  });
});

// ──────────────────────────────────────────────────────────────────
// resolveDependencies — alternatives
// ──────────────────────────────────────────────────────────────────

describe('resolveDependencies — alternatives', () => {
  it('includes alternatives for known headers', () => {
    const code = `#include <DHT.h>`;
    const installed = new Map([['DHT sensor library', '1.4.4']]);
    const result = resolveDependencies(code, installed);
    expect(result.resolved).toHaveLength(1);
    expect(result.resolved[0].alternatives).toBeDefined();
    expect(result.resolved[0].alternatives!.length).toBeGreaterThan(0);
  });

  it('suggests alternative when primary is missing but alt is installed', () => {
    const code = `#include <DHT.h>`;
    const installed = new Map([['SimpleDHT', '1.0.0']]);
    const result = resolveDependencies(code, installed);
    expect(result.suggestions.some((s) => s.includes('SimpleDHT'))).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────
// resolveDependencies — conflicts
// ──────────────────────────────────────────────────────────────────

describe('resolveDependencies — conflicts', () => {
  it('detects WiFi library conflicts', () => {
    const code = `#include <WiFi.h>\n#include <ESP8266WiFi.h>`;
    const installed = new Map([
      ['WiFi', '1.0'],
      ['ESP8266WiFi', '1.0'],
    ]);
    const result = resolveDependencies(code, installed);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].library).toBe('WiFi');
    expect(result.conflicts[0].sources).toContain('WiFi');
    expect(result.conflicts[0].sources).toContain('ESP8266WiFi');
  });

  it('no conflict for single WiFi library', () => {
    const code = `#include <WiFi.h>`;
    const installed = new Map([['WiFi', '1.0']]);
    const result = resolveDependencies(code, installed);
    expect(result.conflicts).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// resolveDependencies — dependency suggestions
// ──────────────────────────────────────────────────────────────────

describe('resolveDependencies — dependency suggestions', () => {
  it('suggests Adafruit_GFX when Adafruit_SSD1306 is included without it', () => {
    const code = `#include <Adafruit_SSD1306.h>`;
    const installed = new Map([['Adafruit SSD1306', '2.5.7']]);
    const result = resolveDependencies(code, installed);
    expect(result.suggestions.some((s) => s.includes('Adafruit GFX'))).toBe(true);
  });

  it('does not suggest Adafruit_GFX when both are included', () => {
    const code = `#include <Adafruit_GFX.h>\n#include <Adafruit_SSD1306.h>`;
    const installed = new Map([
      ['Adafruit GFX Library', '1.11.3'],
      ['Adafruit SSD1306', '2.5.7'],
    ]);
    const result = resolveDependencies(code, installed);
    expect(result.suggestions.filter((s) => s.includes('Adafruit GFX'))).toHaveLength(0);
  });

  it('suggests OneWire when DallasTemperature is included without it', () => {
    const code = `#include <DallasTemperature.h>`;
    const installed = new Map([['DallasTemperature', '3.9.0']]);
    const result = resolveDependencies(code, installed);
    expect(result.suggestions.some((s) => s.includes('OneWire'))).toBe(true);
  });

  it('does not suggest OneWire when both are included', () => {
    const code = `#include <OneWire.h>\n#include <DallasTemperature.h>`;
    const installed = new Map([
      ['OneWire', '2.3.7'],
      ['DallasTemperature', '3.9.0'],
    ]);
    const result = resolveDependencies(code, installed);
    expect(result.suggestions.filter((s) => s.includes('OneWire'))).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// resolveDependencies — unknown headers
// ──────────────────────────────────────────────────────────────────

describe('resolveDependencies — unknown headers', () => {
  it('handles unknown system headers', () => {
    const code = `#include <MyCustomLib.h>`;
    const installed = new Map<string, string>();
    const result = resolveDependencies(code, installed);
    expect(result.missing).toHaveLength(1);
    expect(result.missing[0].name).toBe('MyCustomLib');
    expect(result.missing[0].headerFile).toBe('MyCustomLib.h');
    expect(result.suggestions.some((s) => s.includes('Unknown library'))).toBe(true);
  });

  it('resolves unknown header by fuzzy-matching installed library name', () => {
    const code = `#include <MyCustomLib.h>`;
    const installed = new Map([['MyCustomLib', '2.0.0']]);
    const result = resolveDependencies(code, installed);
    expect(result.resolved).toHaveLength(1);
    expect(result.resolved[0].name).toBe('MyCustomLib');
    expect(result.resolved[0].version).toBe('2.0.0');
  });

  it('case-insensitive match for unknown headers against installed', () => {
    const code = `#include <mycustomlib.h>`;
    const installed = new Map([['MyCustomLib', '1.0.0']]);
    const result = resolveDependencies(code, installed);
    expect(result.resolved).toHaveLength(1);
    expect(result.resolved[0].name).toBe('MyCustomLib');
  });
});

// ──────────────────────────────────────────────────────────────────
// resolveDependencies — real-world scenarios
// ──────────────────────────────────────────────────────────────────

describe('resolveDependencies — real-world scenarios', () => {
  it('resolves a typical Arduino Uno sketch', () => {
    const code = `
#include <Arduino.h>
#include <Servo.h>
#include <Wire.h>
#include "config.h"

void setup() {
  Serial.begin(9600);
}
void loop() {}
`;
    const installed = new Map([
      ['Servo', '1.2.1'],
      ['Wire', '1.0'],
    ]);
    const result = resolveDependencies(code, installed);
    expect(result.resolved).toHaveLength(2);
    expect(result.missing).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);
  });

  it('resolves an ESP32 IoT sketch with missing libraries', () => {
    const code = `
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
`;
    const installed = new Map([
      ['WiFi', '1.0'],
      ['ArduinoJson', '6.21.3'],
    ]);
    const result = resolveDependencies(code, installed);
    expect(result.resolved).toHaveLength(2);
    expect(result.missing.some((d) => d.name === 'PubSubClient')).toBe(true);
    expect(result.missing.some((d) => d.name === 'DHT sensor library')).toBe(true);
  });

  it('resolves an Adafruit OLED display project', () => {
    const code = `
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
`;
    const installed = new Map([
      ['Wire', '1.0'],
      ['Adafruit GFX Library', '1.11.3'],
      ['Adafruit SSD1306', '2.5.7'],
    ]);
    const result = resolveDependencies(code, installed);
    expect(result.resolved).toHaveLength(3);
    expect(result.missing).toHaveLength(0);
  });

  it('handles empty code', () => {
    const result = resolveDependencies('', new Map());
    expect(result.resolved).toHaveLength(0);
    expect(result.missing).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);
    expect(result.suggestions).toHaveLength(0);
  });

  it('handles code with only comments', () => {
    const code = `// #include <Wire.h>\n/* #include <SPI.h> */`;
    const result = resolveDependencies(code, new Map());
    expect(result.resolved).toHaveLength(0);
    expect(result.missing).toHaveLength(0);
  });

  it('display library suggestion for many display includes', () => {
    const code = `
#include <Adafruit_SSD1306.h>
#include <U8g2lib.h>
#include <LiquidCrystal.h>
`;
    const installed = new Map([
      ['Adafruit SSD1306', '2.5.7'],
      ['U8g2', '2.34.17'],
      ['LiquidCrystal', '1.0.7'],
    ]);
    const result = resolveDependencies(code, installed);
    expect(result.suggestions.some((s) => s.includes('Multiple display libraries'))).toBe(true);
  });
});
