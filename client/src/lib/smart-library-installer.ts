/**
 * Smart Library Installer — Arduino Compile Error Parser & Library Suggester
 *
 * Parses arduino-cli compile output to detect missing #include headers and
 * undefined symbols, then suggests the correct Arduino library to install.
 * Designed for the maker audience who hits cryptic compiler errors and doesn't
 * know which library they need.
 *
 * Usage:
 *   const errors = parseCompileErrors(compilerOutput);
 *   const suggestions = suggestLibrariesForErrors(errors);
 *   const cmd = getInstallCommand(suggestions[0]);
 *   // → "arduino-cli lib install \"Adafruit NeoPixel\""
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompileError {
  /** 1-based line number from the compiler output, or 0 if unknown. */
  line: number;
  /** The raw error message from the compiler. */
  message: string;
  /** Classified error type. */
  type: 'missing_include' | 'undefined_symbol' | 'other';
}

export interface LibrarySuggestion {
  /** The Arduino library name (as used by `arduino-cli lib install`). */
  libraryName: string;
  /** Optional version constraint (e.g. "1.4.6"). */
  version?: string;
  /** Confidence level in [0, 1] where 1 = certain match. */
  confidence: number;
  /** Human-readable explanation of why this library was suggested. */
  reason: string;
}

// ---------------------------------------------------------------------------
// Include → Library mapping (50+ entries)
// ---------------------------------------------------------------------------

/**
 * Maps `#include` header filenames to their Arduino library names.
 * "built-in" means the header ships with the Arduino core and does not
 * require a separate library install.
 */
export const INCLUDE_TO_LIBRARY_MAP: Record<string, string> = {
  // --- Built-in Arduino core headers ---
  'Wire.h': 'built-in',
  'SPI.h': 'built-in',
  'Servo.h': 'built-in',
  'EEPROM.h': 'built-in',
  'SoftwareSerial.h': 'built-in',
  'HardwareSerial.h': 'built-in',
  'Arduino.h': 'built-in',
  'avr/io.h': 'built-in',
  'avr/interrupt.h': 'built-in',
  'avr/pgmspace.h': 'built-in',
  'SD.h': 'built-in',
  'Ethernet.h': 'built-in',
  'WiFi.h': 'built-in',
  'Mouse.h': 'built-in',
  'Keyboard.h': 'built-in',

  // --- Adafruit ecosystem ---
  'Adafruit_NeoPixel.h': 'Adafruit NeoPixel',
  'Adafruit_GFX.h': 'Adafruit GFX Library',
  'Adafruit_SSD1306.h': 'Adafruit SSD1306',
  'Adafruit_BME280.h': 'Adafruit BME280 Library',
  'Adafruit_BMP280.h': 'Adafruit BMP280 Library',
  'Adafruit_Sensor.h': 'Adafruit Unified Sensor',
  'Adafruit_NeoMatrix.h': 'Adafruit NeoMatrix',
  'Adafruit_ST7735.h': 'Adafruit ST7735 and ST7789 Library',
  'Adafruit_ILI9341.h': 'Adafruit ILI9341',
  'Adafruit_MPU6050.h': 'Adafruit MPU6050',
  'Adafruit_ADS1X15.h': 'Adafruit ADS1X15',
  'Adafruit_PWMServoDriver.h': 'Adafruit PWM Servo Driver Library',
  'Adafruit_MotorShield.h': 'Adafruit Motor Shield V2 Library',
  'Adafruit_MCP23X17.h': 'Adafruit MCP23017 Arduino Library',

  // --- Sensors ---
  'DHT.h': 'DHT sensor library',
  'DHT_U.h': 'DHT sensor library',
  'OneWire.h': 'OneWire',
  'DallasTemperature.h': 'DallasTemperature',
  'NewPing.h': 'NewPing',
  'MPU6050.h': 'MPU6050',
  'HX711.h': 'HX711 Arduino Library',
  'MAX6675.h': 'MAX6675 library',
  'BH1750.h': 'BH1750',
  'VL53L0X.h': 'VL53L0X',

  // --- Displays ---
  'LiquidCrystal.h': 'LiquidCrystal',
  'LiquidCrystal_I2C.h': 'LiquidCrystal I2C',
  'U8g2lib.h': 'U8g2',
  'TFT_eSPI.h': 'TFT_eSPI',
  'FastLED.h': 'FastLED',
  'MD_MAX72xx.h': 'MD_MAX72XX',
  'MD_Parola.h': 'MD_Parola',

  // --- Communication ---
  'RF24.h': 'RF24',
  'LoRa.h': 'LoRa',
  'PubSubClient.h': 'PubSubClient',
  'ArduinoJson.h': 'ArduinoJson',
  'ESP8266WiFi.h': 'ESP8266WiFi',
  'WiFiClient.h': 'built-in',
  'BluetoothSerial.h': 'built-in',
  'BLEDevice.h': 'built-in',
  'IRremote.h': 'IRremote',
  'IRrecv.h': 'IRremote',
  'RCSwitch.h': 'rc-switch',
  'CAN.h': 'CAN',

  // --- Motor / Servo / Stepper ---
  'AccelStepper.h': 'AccelStepper',
  'ESP32Servo.h': 'ESP32Servo',
  'Stepper.h': 'Stepper',

  // --- Timing / Scheduling ---
  'RTClib.h': 'RTClib',
  'TimeLib.h': 'Time',
  'TaskScheduler.h': 'TaskScheduler',
  'Ticker.h': 'Ticker',

  // --- Storage ---
  'SdFat.h': 'SdFat',
  'ArduinoOTA.h': 'ArduinoOTA',
  'SPIFFS.h': 'built-in',
  'LittleFS.h': 'LittleFS',

  // --- Miscellaneous ---
  'Bounce2.h': 'Bounce2',
  'Encoder.h': 'Encoder',
  'Keypad.h': 'Keypad',
  'AceButton.h': 'AceButton',
  'PCF8574.h': 'PCF8574',
};

// ---------------------------------------------------------------------------
// Symbol → Library mapping (common undefined symbols → probable library)
// ---------------------------------------------------------------------------

const SYMBOL_TO_LIBRARY_MAP: Record<string, string> = {
  NeoPixel: 'Adafruit NeoPixel',
  Adafruit_NeoPixel: 'Adafruit NeoPixel',
  DHT: 'DHT sensor library',
  DallasTemperature: 'DallasTemperature',
  OneWire: 'OneWire',
  LiquidCrystal_I2C: 'LiquidCrystal I2C',
  FastLED: 'FastLED',
  ArduinoJson: 'ArduinoJson',
  PubSubClient: 'PubSubClient',
  RF24: 'RF24',
  AccelStepper: 'AccelStepper',
  IRrecv: 'IRremote',
  decode_results: 'IRremote',
  Servo: 'built-in',
  Stepper: 'Stepper',
  HX711: 'HX711 Arduino Library',
  Adafruit_SSD1306: 'Adafruit SSD1306',
  Adafruit_GFX: 'Adafruit GFX Library',
  Adafruit_BME280: 'Adafruit BME280 Library',
  Adafruit_Sensor: 'Adafruit Unified Sensor',
  RTClib: 'RTClib',
  RTC_DS3231: 'RTClib',
  RTC_DS1307: 'RTClib',
  Bounce2: 'Bounce2',
  Bounce: 'Bounce2',
  Keypad: 'Keypad',
  Encoder: 'Encoder',
  TFT_eSPI: 'TFT_eSPI',
  U8G2: 'U8g2',
  U8X8: 'U8g2',
  LoRaClass: 'LoRa',
  NewPing: 'NewPing',
};

// ---------------------------------------------------------------------------
// Regex patterns for compiler error parsing
// ---------------------------------------------------------------------------

/**
 * Matches GCC/arduino-cli fatal error for missing includes.
 * Examples:
 *   sketch.ino:3:10: fatal error: DHT.h: No such file or directory
 *   /path/to/file.cpp:15:12: fatal error: Adafruit_NeoPixel.h: No such file or directory
 */
const MISSING_INCLUDE_RE = /^(.+?):(\d+):\d+:\s*fatal error:\s*(.+?):\s*No such file or directory/;

/**
 * Matches GCC "was not declared in this scope" errors.
 * Examples:
 *   sketch.ino:12:3: error: 'DHT' was not declared in this scope
 *   sketch.ino:5:1: error: 'Adafruit_NeoPixel' was not declared in this scope
 */
const UNDEFINED_SYMBOL_RE = /^(.+?):(\d+):\d+:\s*error:\s*'([^']+)'\s*was not declared in this scope/;

/**
 * Matches generic GCC error lines.
 * Examples:
 *   sketch.ino:20:5: error: expected ';' before '}' token
 */
const GENERIC_ERROR_RE = /^(.+?):(\d+):\d+:\s*error:\s*(.+)/;

// ---------------------------------------------------------------------------
// Public API — Parse
// ---------------------------------------------------------------------------

/**
 * Parse raw compiler output (from arduino-cli compile) into structured
 * {@link CompileError} objects. Each error line in the output becomes one entry.
 *
 * @param output - The raw stderr/stdout text from the compiler.
 * @returns Array of parsed errors, in the order they appear.
 */
export function parseCompileErrors(output: string): CompileError[] {
  if (!output || typeof output !== 'string') {
    return [];
  }

  const lines = output.split('\n');
  const errors: CompileError[] = [];
  const seen = new Set<string>();

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    // --- Missing include ---
    const includeMatch = MISSING_INCLUDE_RE.exec(line);
    if (includeMatch) {
      const lineNo = parseInt(includeMatch[2], 10);
      const headerFile = includeMatch[3].trim();
      const key = `missing_include:${headerFile}`;
      if (!seen.has(key)) {
        seen.add(key);
        errors.push({
          line: lineNo,
          message: `Missing header: ${headerFile}`,
          type: 'missing_include',
        });
      }
      continue;
    }

    // --- Undefined symbol ---
    const symbolMatch = UNDEFINED_SYMBOL_RE.exec(line);
    if (symbolMatch) {
      const lineNo = parseInt(symbolMatch[2], 10);
      const symbol = symbolMatch[3].trim();
      const key = `undefined_symbol:${symbol}`;
      if (!seen.has(key)) {
        seen.add(key);
        errors.push({
          line: lineNo,
          message: `Undefined symbol: '${symbol}'`,
          type: 'undefined_symbol',
        });
      }
      continue;
    }

    // --- Generic error ---
    const genericMatch = GENERIC_ERROR_RE.exec(line);
    if (genericMatch) {
      const lineNo = parseInt(genericMatch[2], 10);
      const msg = genericMatch[3].trim();
      const key = `other:${lineNo}:${msg}`;
      if (!seen.has(key)) {
        seen.add(key);
        errors.push({
          line: lineNo,
          message: msg,
          type: 'other',
        });
      }
      continue;
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Public API — Suggest
// ---------------------------------------------------------------------------

/**
 * Given a list of compile errors, suggest Arduino libraries that would
 * likely fix them. Missing include errors are resolved via the
 * {@link INCLUDE_TO_LIBRARY_MAP}; undefined symbol errors are resolved
 * via the internal symbol → library map.
 *
 * @param errors - Compile errors from {@link parseCompileErrors}.
 * @returns Deduplicated suggestions sorted by descending confidence.
 */
export function suggestLibrariesForErrors(errors: CompileError[]): LibrarySuggestion[] {
  if (!errors || errors.length === 0) {
    return [];
  }

  const suggestionMap = new Map<string, LibrarySuggestion>();

  for (const error of errors) {
    if (error.type === 'missing_include') {
      const header = extractHeader(error.message);
      if (!header) {
        continue;
      }

      const libraryName = INCLUDE_TO_LIBRARY_MAP[header];
      if (libraryName && libraryName !== 'built-in') {
        if (!suggestionMap.has(libraryName)) {
          suggestionMap.set(libraryName, {
            libraryName,
            confidence: 0.95,
            reason: `Header "${header}" is provided by the "${libraryName}" library`,
          });
        }
      } else if (libraryName === 'built-in') {
        // Built-in headers don't need library install — no suggestion
      } else {
        // Unknown header — try to guess from the filename
        const guess = guessLibraryFromHeader(header);
        if (guess && !suggestionMap.has(guess)) {
          suggestionMap.set(guess, {
            libraryName: guess,
            confidence: 0.5,
            reason: `Header "${header}" might be provided by "${guess}" (guessed from filename)`,
          });
        }
      }
    } else if (error.type === 'undefined_symbol') {
      const symbol = extractSymbol(error.message);
      if (!symbol) {
        continue;
      }

      const libraryName = SYMBOL_TO_LIBRARY_MAP[symbol];
      if (libraryName && libraryName !== 'built-in') {
        if (!suggestionMap.has(libraryName)) {
          suggestionMap.set(libraryName, {
            libraryName,
            confidence: 0.75,
            reason: `Symbol "${symbol}" is defined in the "${libraryName}" library`,
          });
        }
      }
    }
    // 'other' errors don't produce library suggestions
  }

  // Sort by descending confidence, then alphabetically by library name
  return Array.from(suggestionMap.values()).sort((a, b) => {
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence;
    }
    return a.libraryName.localeCompare(b.libraryName);
  });
}

// ---------------------------------------------------------------------------
// Public API — Install command
// ---------------------------------------------------------------------------

/**
 * Generate the `arduino-cli lib install` command for a given suggestion.
 *
 * @param suggestion - A library suggestion from {@link suggestLibrariesForErrors}.
 * @returns The full shell command string, e.g. `arduino-cli lib install "Adafruit NeoPixel"`.
 */
export function getInstallCommand(suggestion: LibrarySuggestion): string {
  const name = suggestion.libraryName;
  if (suggestion.version) {
    return `arduino-cli lib install "${name}@${suggestion.version}"`;
  }
  return `arduino-cli lib install "${name}"`;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extract header filename from a "Missing header: Foo.h" message.
 */
function extractHeader(message: string): string | null {
  const match = /Missing header:\s*(.+)/.exec(message);
  return match ? match[1].trim() : null;
}

/**
 * Extract symbol name from an "Undefined symbol: 'Foo'" message.
 */
function extractSymbol(message: string): string | null {
  const match = /Undefined symbol:\s*'([^']+)'/.exec(message);
  return match ? match[1].trim() : null;
}

/**
 * Best-effort guess: strip file extension and common prefixes/suffixes
 * to derive a likely library name from an unknown header.
 * e.g. "MyCustomLib.h" → "MyCustomLib"
 */
function guessLibraryFromHeader(header: string): string | null {
  // Strip .h/.hpp extension
  const name = header.replace(/\.(h|hpp)$/i, '').trim();
  if (!name || name.length < 2) {
    return null;
  }
  return name;
}
