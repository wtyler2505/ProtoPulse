import { describe, it, expect } from 'vitest';
import {
  generateFirmware,
  generateManifestCode,
  generateReadLoop,
  boardPinCount,
  type FirmwareConfig,
  type PinConfig,
  type BoardType,
} from '../firmware-templates';

// ---------------------------------------------------------------------------
// boardPinCount
// ---------------------------------------------------------------------------

describe('boardPinCount', () => {
  it('returns correct pin counts for Arduino Uno', () => {
    const info = boardPinCount('arduino_uno');
    expect(info.digital).toBe(14);
    expect(info.analog).toBe(6);
    expect(info.pwm).toBe(6);
  });

  it('returns correct pin counts for Arduino Mega', () => {
    const info = boardPinCount('arduino_mega');
    expect(info.digital).toBe(54);
    expect(info.analog).toBe(16);
    expect(info.pwm).toBe(15);
  });

  it('returns correct pin counts for ESP32', () => {
    const info = boardPinCount('esp32');
    expect(info.digital).toBe(34);
    expect(info.analog).toBe(18);
    expect(info.pwm).toBe(16);
  });

  it('returns correct pin counts for ESP32-S3', () => {
    const info = boardPinCount('esp32_s3');
    expect(info.digital).toBe(45);
    expect(info.analog).toBe(20);
    expect(info.pwm).toBe(16);
  });

  it('returns correct pin counts for Arduino Nano', () => {
    const info = boardPinCount('arduino_nano');
    expect(info.digital).toBe(14);
    expect(info.analog).toBe(8);
    expect(info.pwm).toBe(6);
  });

  it('returns a copy (not a reference)', () => {
    const a = boardPinCount('arduino_uno');
    const b = boardPinCount('arduino_uno');
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// generateFirmware
// ---------------------------------------------------------------------------

describe('generateFirmware', () => {
  function makeConfig(overrides?: Partial<FirmwareConfig>): FirmwareConfig {
    return {
      board: 'arduino_uno',
      baudRate: 115200,
      sampleRateHz: 10,
      pins: [
        { pin: 2, id: 'D2', name: 'Button', type: 'digital_in' },
        { pin: 13, id: 'D13', name: 'LED', type: 'digital_out' },
        { pin: 0, id: 'A0', name: 'Analog 0', type: 'analog_in' },
      ],
      includeManifest: true,
      includeDesiredHandler: true,
      ...overrides,
    };
  }

  it('generates valid sketch with header comment', () => {
    const sketch = generateFirmware(makeConfig());
    expect(sketch).toContain('// ProtoPulse Digital Twin');
    expect(sketch).toContain('Arduino Uno');
  });

  it('includes correct Serial.begin with baud rate', () => {
    const sketch = generateFirmware(makeConfig({ baudRate: 9600 }));
    expect(sketch).toContain('Serial.begin(9600)');
  });

  it('includes correct Serial.begin for default baud rate', () => {
    const sketch = generateFirmware(makeConfig());
    expect(sketch).toContain('Serial.begin(115200)');
  });

  it('includes sample interval calculation', () => {
    const sketch = generateFirmware(makeConfig({ sampleRateHz: 50 }));
    // 1000 / 50 = 20ms
    expect(sketch).toContain('SAMPLE_INTERVAL_MS = 20');
  });

  it('includes sample interval for 10 Hz', () => {
    const sketch = generateFirmware(makeConfig({ sampleRateHz: 10 }));
    // 1000 / 10 = 100ms
    expect(sketch).toContain('SAMPLE_INTERVAL_MS = 100');
  });

  it('includes pin definitions', () => {
    const sketch = generateFirmware(makeConfig());
    expect(sketch).toContain('PIN_D2');
    expect(sketch).toContain('PIN_D13');
    expect(sketch).toContain('PIN_A0');
  });

  it('includes pinMode for digital input', () => {
    const sketch = generateFirmware(makeConfig());
    expect(sketch).toContain('pinMode(PIN_D2, INPUT)');
  });

  it('includes pinMode for digital output', () => {
    const sketch = generateFirmware(makeConfig());
    expect(sketch).toContain('pinMode(PIN_D13, OUTPUT)');
  });

  it('includes manifest function when includeManifest is true', () => {
    const sketch = generateFirmware(makeConfig({ includeManifest: true }));
    expect(sketch).toContain('void sendManifest()');
    expect(sketch).toContain('sendManifest()');
  });

  it('omits manifest function when includeManifest is false', () => {
    const sketch = generateFirmware(makeConfig({ includeManifest: false }));
    expect(sketch).not.toContain('void sendManifest()');
  });

  it('includes desired handler when includeDesiredHandler is true', () => {
    const sketch = generateFirmware(makeConfig({ includeDesiredHandler: true }));
    expect(sketch).toContain('void handleSerial()');
    expect(sketch).toContain('void processCommand');
  });

  it('omits desired handler when includeDesiredHandler is false', () => {
    const sketch = generateFirmware(makeConfig({ includeDesiredHandler: false }));
    expect(sketch).not.toContain('void handleSerial()');
    expect(sketch).not.toContain('void processCommand');
  });

  it('includes telemetry function with JSON output', () => {
    const sketch = generateFirmware(makeConfig());
    expect(sketch).toContain('void sendTelemetry()');
    // Generated code uses escaped quotes for Serial.print
    expect(sketch).toContain('\\"type\\":\\"telemetry\\"');
    expect(sketch).toContain('\\"ts\\":');
    expect(sketch).toContain('\\"ch\\":{');
  });

  it('reads digital pins with digitalRead', () => {
    const sketch = generateFirmware(makeConfig());
    expect(sketch).toContain('digitalRead(PIN_D2)');
  });

  it('reads analog pins with analogRead', () => {
    const sketch = generateFirmware(makeConfig());
    expect(sketch).toContain('analogRead(PIN_A0)');
  });

  it('generates for each board type without error', () => {
    const boards: BoardType[] = ['arduino_uno', 'arduino_mega', 'esp32', 'esp32_s3', 'arduino_nano'];
    for (const board of boards) {
      const sketch = generateFirmware(makeConfig({ board }));
      expect(sketch).toContain('void setup()');
      expect(sketch).toContain('void loop()');
      expect(sketch.length).toBeGreaterThan(100);
    }
  });

  it('handles empty pins array', () => {
    const sketch = generateFirmware(makeConfig({ pins: [] }));
    expect(sketch).toContain('void setup()');
    expect(sketch).toContain('void loop()');
    // No pin definitions
    expect(sketch).not.toContain('const int PIN_');
  });

  it('handles PWM output pins', () => {
    const config = makeConfig({
      pins: [{ pin: 3, id: 'PWM3', name: 'PWM Pin 3', type: 'pwm_out' }],
    });
    const sketch = generateFirmware(config);
    expect(sketch).toContain('PIN_PWM3');
    expect(sketch).toContain('analogWrite');
  });

  it('includes millis() for timestamps', () => {
    const sketch = generateFirmware(makeConfig());
    expect(sketch).toContain('millis()');
  });

  it('ends with newline', () => {
    const sketch = generateFirmware(makeConfig());
    expect(sketch.endsWith('\n')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// generateManifestCode
// ---------------------------------------------------------------------------

describe('generateManifestCode', () => {
  it('generates manifest function with board info', () => {
    const config: FirmwareConfig = {
      board: 'arduino_mega',
      baudRate: 115200,
      sampleRateHz: 10,
      pins: [{ pin: 54, id: 'A0', name: 'Analog 0', type: 'analog_in' }],
      includeManifest: true,
      includeDesiredHandler: false,
    };
    const code = generateManifestCode(config);
    expect(code).toContain('void sendManifest()');
    expect(code).toContain('Arduino Mega 2560');
    expect(code).toContain('\\"firmware\\":\\"1.0.0\\"');
    expect(code).toContain('\\"channels\\":[');
    expect(code).toContain('\\"id\\":\\"A0\\"');
    expect(code).toContain('\\"dataType\\":\\"analog\\"');
  });

  it('includes pin number in manifest', () => {
    const config: FirmwareConfig = {
      board: 'arduino_uno',
      baudRate: 115200,
      sampleRateHz: 10,
      pins: [{ pin: 13, id: 'D13', name: 'LED', type: 'digital_out' }],
      includeManifest: true,
      includeDesiredHandler: false,
    };
    const code = generateManifestCode(config);
    expect(code).toContain('\\"pin\\":13');
  });
});

// ---------------------------------------------------------------------------
// generateReadLoop
// ---------------------------------------------------------------------------

describe('generateReadLoop', () => {
  it('generates digitalRead for digital input', () => {
    const pins: PinConfig[] = [{ pin: 2, id: 'D2', name: 'Button', type: 'digital_in' }];
    const code = generateReadLoop(pins);
    expect(code).toContain('digitalRead');
  });

  it('generates analogRead for analog input', () => {
    const pins: PinConfig[] = [{ pin: 0, id: 'A0', name: 'Analog', type: 'analog_in' }];
    const code = generateReadLoop(pins);
    expect(code).toContain('analogRead');
  });

  it('skips reading for PWM output', () => {
    const pins: PinConfig[] = [{ pin: 3, id: 'PWM3', name: 'PWM', type: 'pwm_out' }];
    const code = generateReadLoop(pins);
    expect(code).not.toContain('analogRead');
    expect(code).not.toContain('digitalRead');
    expect(code).toContain('no read needed');
  });

  it('generates read for digital output (readback)', () => {
    const pins: PinConfig[] = [{ pin: 13, id: 'D13', name: 'LED', type: 'digital_out' }];
    const code = generateReadLoop(pins);
    expect(code).toContain('digitalRead');
  });

  it('handles empty pins', () => {
    const code = generateReadLoop([]);
    expect(code).toBe('\n');
  });
});
