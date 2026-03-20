export interface IncludeDirective {
  header: string;
  line: number;
  isSystem: boolean;
}

export interface LibraryDependency {
  name: string;
  headerFile: string;
  required: boolean;
  installed: boolean;
  version?: string;
  alternatives?: string[];
}

export interface DependencyConflict {
  library: string;
  versions: string[];
  sources: string[];
  resolution: string;
}

export interface DependencyResolution {
  resolved: LibraryDependency[];
  missing: LibraryDependency[];
  conflicts: DependencyConflict[];
  suggestions: string[];
}

/**
 * Headers that are part of Arduino core — always available, never need installation.
 */
export const ARDUINO_CORE_HEADERS: Set<string> = new Set([
  'Arduino.h',
  'HardwareSerial.h',
  'Print.h',
  'Printable.h',
  'Stream.h',
  'WCharacter.h',
  'WString.h',
  'binary.h',
  'pins_arduino.h',
  'wiring_private.h',
  // AVR-specific core headers
  'avr/io.h',
  'avr/interrupt.h',
  'avr/pgmspace.h',
  'avr/eeprom.h',
  'avr/wdt.h',
  'avr/sleep.h',
  'avr/power.h',
  // Standard C/C++ headers commonly available
  'stdint.h',
  'stdbool.h',
  'stdlib.h',
  'string.h',
  'stdio.h',
  'math.h',
  'ctype.h',
  'limits.h',
  'float.h',
  'inttypes.h',
  'assert.h',
  'errno.h',
  'setjmp.h',
  'signal.h',
  'stdarg.h',
  'stddef.h',
  'time.h',
]);

/**
 * Mapping from header file name to Arduino library name.
 * Used for resolving `#include` directives to installable library names.
 */
export const KNOWN_LIBRARY_HEADERS: Map<string, string> = new Map([
  // Built-in Arduino libraries (bundled with IDE)
  ['Wire.h', 'Wire'],
  ['SPI.h', 'SPI'],
  ['Servo.h', 'Servo'],
  ['EEPROM.h', 'EEPROM'],
  ['SoftwareSerial.h', 'SoftwareSerial'],
  ['Stepper.h', 'Stepper'],
  ['LiquidCrystal.h', 'LiquidCrystal'],
  ['SD.h', 'SD'],
  ['Ethernet.h', 'Ethernet'],
  ['Firmata.h', 'Firmata'],
  ['Keyboard.h', 'Keyboard'],
  ['Mouse.h', 'Mouse'],
  ['WiFi.h', 'WiFi'],
  ['WiFiNINA.h', 'WiFiNINA'],

  // Popular third-party libraries
  ['Adafruit_NeoPixel.h', 'Adafruit NeoPixel'],
  ['Adafruit_SSD1306.h', 'Adafruit SSD1306'],
  ['Adafruit_GFX.h', 'Adafruit GFX Library'],
  ['Adafruit_Sensor.h', 'Adafruit Unified Sensor'],
  ['Adafruit_BME280.h', 'Adafruit BME280 Library'],
  ['DHT.h', 'DHT sensor library'],
  ['IRremote.h', 'IRremote'],
  ['FastLED.h', 'FastLED'],
  ['AccelStepper.h', 'AccelStepper'],
  ['PubSubClient.h', 'PubSubClient'],
  ['ArduinoJson.h', 'ArduinoJson'],
  ['OneWire.h', 'OneWire'],
  ['DallasTemperature.h', 'DallasTemperature'],
  ['MPU6050.h', 'MPU6050'],
  ['Encoder.h', 'Encoder'],
  ['Bounce2.h', 'Bounce2'],

  // ESP32/ESP8266 libraries
  ['AsyncTCP.h', 'AsyncTCP'],
  ['ESPAsyncWebServer.h', 'ESPAsyncWebServer'],
  ['BluetoothSerial.h', 'BluetoothSerial'],
  ['WiFiManager.h', 'WiFiManager'],
  ['ESP8266WiFi.h', 'ESP8266WiFi'],
  ['ESPmDNS.h', 'ESPmDNS'],
  ['WebServer.h', 'WebServer'],
  ['WiFiClient.h', 'WiFiClient'],
  ['WiFiClientSecure.h', 'WiFiClientSecure'],

  // Display libraries
  ['U8g2lib.h', 'U8g2'],
  ['TFT_eSPI.h', 'TFT_eSPI'],
  ['Adafruit_ILI9341.h', 'Adafruit ILI9341'],
  ['LiquidCrystal_I2C.h', 'LiquidCrystal I2C'],

  // Sensor libraries
  ['Adafruit_BMP085.h', 'Adafruit BMP085 Library'],
  ['Adafruit_BNO055.h', 'Adafruit BNO055'],
  ['HX711.h', 'HX711'],
  ['SparkFunLSM9DS1.h', 'SparkFun LSM9DS1'],
  ['VL53L0X.h', 'VL53L0X'],

  // Motor/actuator libraries
  ['AFMotor.h', 'Adafruit Motor Shield V1'],
  ['Adafruit_MotorShield.h', 'Adafruit Motor Shield V2'],

  // Communication libraries
  ['RF24.h', 'RF24'],
  ['LoRa.h', 'LoRa'],
  ['CAN.h', 'CAN'],
  ['Modbus.h', 'Modbus'],
  ['RH_ASK.h', 'RadioHead'],

  // Timing/scheduling
  ['TaskScheduler.h', 'TaskScheduler'],
  ['TimerOne.h', 'TimerOne'],
  ['elapsedMillis.h', 'elapsedMillis'],

  // Audio
  ['TMRpcm.h', 'TMRpcm'],
  ['Audio.h', 'Audio'],
]);

/**
 * Known alternative libraries for common headers — when multiple libraries provide similar functionality.
 */
const LIBRARY_ALTERNATIVES: Map<string, string[]> = new Map([
  ['DHT.h', ['DHT sensor library', 'DHT sensor library for ESPx', 'SimpleDHT']],
  ['WiFi.h', ['WiFi', 'WiFiNINA', 'ESP8266WiFi', 'WiFi101']],
  ['LiquidCrystal.h', ['LiquidCrystal', 'LiquidCrystal I2C', 'hd44780']],
  ['IRremote.h', ['IRremote', 'IRremoteESP8266', 'IRLib2']],
  ['Servo.h', ['Servo', 'ESP32Servo', 'ServoEasing']],
  ['Adafruit_SSD1306.h', ['Adafruit SSD1306', 'SSD1306Ascii', 'U8g2']],
  ['Encoder.h', ['Encoder', 'RotaryEncoder', 'ESP32Encoder']],
]);

/**
 * Parse `#include` directives from Arduino/C++ source code.
 * Returns all includes with their line numbers and whether they use angle brackets (system) or quotes (local).
 */
export function extractIncludes(code: string): IncludeDirective[] {
  const includes: IncludeDirective[] = [];
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip comments
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      continue;
    }

    // Check for // comment after the include
    const commentIdx = line.indexOf('//');
    const relevantPart = commentIdx !== -1 ? line.slice(0, commentIdx) : line;

    // Match #include <header.h> (system/library include)
    const systemMatch = /^\s*#\s*include\s*<\s*([^>]+)\s*>/.exec(relevantPart);
    if (systemMatch) {
      includes.push({
        header: systemMatch[1].trim(),
        line: i + 1,
        isSystem: true,
      });
      continue;
    }

    // Match #include "header.h" (local include)
    const localMatch = /^\s*#\s*include\s*"([^"]+)"/.exec(relevantPart);
    if (localMatch) {
      includes.push({
        header: localMatch[1].trim(),
        line: i + 1,
        isSystem: false,
      });
    }
  }

  return includes;
}

/**
 * Resolve dependencies from Arduino source code.
 * Matches `#include` directives against known libraries and checks installation status.
 *
 * @param code - Arduino source code
 * @param installedLibraries - Map of library name → installed version (e.g., "Wire" → "1.0", "FastLED" → "3.6.0")
 */
export function resolveDependencies(
  code: string,
  installedLibraries: Map<string, string>,
): DependencyResolution {
  const resolved: LibraryDependency[] = [];
  const missing: LibraryDependency[] = [];
  const conflicts: DependencyConflict[] = [];
  const suggestions: string[] = [];

  const includes = extractIncludes(code);
  const seenLibraries = new Set<string>();

  for (const inc of includes) {
    // Skip Arduino core headers — always available
    if (ARDUINO_CORE_HEADERS.has(inc.header)) {
      continue;
    }

    // Skip local includes (user's own files)
    if (!inc.isSystem && !KNOWN_LIBRARY_HEADERS.has(inc.header)) {
      continue;
    }

    const libraryName = KNOWN_LIBRARY_HEADERS.get(inc.header);

    if (!libraryName) {
      // Unknown system header — might be a library we don't know about
      const dep: LibraryDependency = {
        name: inc.header.replace(/\.h$/, ''),
        headerFile: inc.header,
        required: true,
        installed: false,
      };

      // Check if the inferred name matches anything installed
      for (const [name, version] of Array.from(installedLibraries.entries())) {
        if (name.toLowerCase() === dep.name.toLowerCase()) {
          dep.installed = true;
          dep.version = version;
          dep.name = name; // Use the properly-cased name
          break;
        }
      }

      if (dep.installed) {
        resolved.push(dep);
      } else {
        missing.push(dep);
        suggestions.push(
          `Unknown library for '${inc.header}'. Search the Arduino Library Manager for a library that provides this header.`,
        );
      }
      continue;
    }

    // Skip duplicate library references
    if (seenLibraries.has(libraryName)) {
      continue;
    }
    seenLibraries.add(libraryName);

    const installedVersion = installedLibraries.get(libraryName);
    const alternatives = LIBRARY_ALTERNATIVES.get(inc.header);

    const dep: LibraryDependency = {
      name: libraryName,
      headerFile: inc.header,
      required: true,
      installed: installedVersion !== undefined,
      version: installedVersion,
      alternatives: alternatives?.filter((a) => a !== libraryName),
    };

    if (dep.installed) {
      resolved.push(dep);
    } else {
      // Check if an alternative library is installed
      let altInstalled = false;
      if (alternatives) {
        for (const alt of alternatives) {
          const altVersion = installedLibraries.get(alt);
          if (altVersion !== undefined) {
            altInstalled = true;
            suggestions.push(
              `'${libraryName}' is not installed, but alternative '${alt}' (v${altVersion}) is. They may provide compatible functionality.`,
            );
            break;
          }
        }
      }

      if (!altInstalled) {
        missing.push(dep);
      } else {
        resolved.push({ ...dep, installed: false });
      }
    }
  }

  // Detect conflicts: multiple includes that resolve to the same functional group
  // e.g., both WiFi.h and ESP8266WiFi.h included
  const wifiHeaders = includes.filter((inc) =>
    ['WiFi.h', 'WiFiNINA.h', 'ESP8266WiFi.h', 'WiFi101.h'].includes(inc.header),
  );
  if (wifiHeaders.length > 1) {
    const wifiLibs = wifiHeaders
      .map((h) => KNOWN_LIBRARY_HEADERS.get(h.header))
      .filter((n): n is string => n !== undefined);
    const wifiVersions = wifiLibs
      .map((name) => installedLibraries.get(name))
      .filter((v): v is string => v !== undefined);

    conflicts.push({
      library: 'WiFi',
      versions: wifiVersions.length > 0 ? wifiVersions : ['unknown'],
      sources: wifiLibs,
      resolution: 'Use only one WiFi library. Choose based on your board: WiFi (Arduino), WiFiNINA (MKR/Nano 33 IoT), ESP8266WiFi (ESP8266).',
    });
  }

  // Detect display library conflicts
  const displayHeaders = includes.filter((inc) =>
    ['Adafruit_SSD1306.h', 'U8g2lib.h', 'LiquidCrystal.h', 'LiquidCrystal_I2C.h', 'TFT_eSPI.h'].includes(
      inc.header,
    ),
  );
  if (displayHeaders.length > 2) {
    suggestions.push(
      'Multiple display libraries detected. Ensure each library is for a different physical display to avoid I2C address conflicts.',
    );
  }

  // Check for Adafruit_SSD1306 requiring Adafruit_GFX
  const hasSSD1306 = includes.some((inc) => inc.header === 'Adafruit_SSD1306.h');
  const hasGFX = includes.some((inc) => inc.header === 'Adafruit_GFX.h');
  if (hasSSD1306 && !hasGFX) {
    suggestions.push(
      "Adafruit SSD1306 requires 'Adafruit GFX Library'. Add: #include <Adafruit_GFX.h>",
    );
    if (!seenLibraries.has('Adafruit GFX Library')) {
      const gfxVersion = installedLibraries.get('Adafruit GFX Library');
      missing.push({
        name: 'Adafruit GFX Library',
        headerFile: 'Adafruit_GFX.h',
        required: true,
        installed: gfxVersion !== undefined,
        version: gfxVersion,
      });
    }
  }

  // Check for DallasTemperature requiring OneWire
  const hasDallas = includes.some((inc) => inc.header === 'DallasTemperature.h');
  const hasOneWire = includes.some((inc) => inc.header === 'OneWire.h');
  if (hasDallas && !hasOneWire) {
    suggestions.push(
      "DallasTemperature library requires 'OneWire'. Add: #include <OneWire.h>",
    );
    if (!seenLibraries.has('OneWire')) {
      const owVersion = installedLibraries.get('OneWire');
      missing.push({
        name: 'OneWire',
        headerFile: 'OneWire.h',
        required: true,
        installed: owVersion !== undefined,
        version: owVersion,
      });
    }
  }

  return { resolved, missing, conflicts, suggestions };
}
