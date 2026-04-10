import { describe, expect, it } from 'vitest';
import { ARDUINO_UNO_R3 } from '../arduino-uno-r3';

describe('Arduino Uno R3 board definition', () => {
  it('has correct identity', () => {
    expect(ARDUINO_UNO_R3.id).toBe('arduino-uno-r3');
    expect(ARDUINO_UNO_R3.title).toBe('Arduino Uno R3');
    expect(ARDUINO_UNO_R3.manufacturer).toBe('Arduino');
    expect(ARDUINO_UNO_R3.mpn).toBe('A000066');
    expect(ARDUINO_UNO_R3.family).toBe('board-module');
  });

  it('has 31 total pins', () => {
    expect(ARDUINO_UNO_R3.pins).toHaveLength(31);
  });

  it('has correct physical dimensions', () => {
    expect(ARDUINO_UNO_R3.dimensions.width).toBe(68.6);
    expect(ARDUINO_UNO_R3.dimensions.height).toBe(53.4);
    expect(ARDUINO_UNO_R3.breadboardFit).toBe('not_breadboard_friendly');
    expect(ARDUINO_UNO_R3.pinSpacing).toBe(2.54);
  });

  it('operates at 5V', () => {
    expect(ARDUINO_UNO_R3.operatingVoltage).toBe(5);
  });

  it('has 6 PWM pins (3, 5, 6, 9, 10, 11)', () => {
    const pwmPins = ARDUINO_UNO_R3.pins.filter((p) =>
      p.functions.some((fn) => fn.type === 'pwm'),
    );
    expect(pwmPins).toHaveLength(6);
    const pwmIds = new Set(pwmPins.map((p) => p.id));
    for (const id of ['D3', 'D5', 'D6', 'D9', 'D10', 'D11']) {
      expect(pwmIds.has(id)).toBe(true);
    }
  });

  it('has 6 analog input pins (A0-A5)', () => {
    const analogPins = ARDUINO_UNO_R3.pins.filter((p) =>
      p.functions.some((fn) => fn.type === 'adc'),
    );
    expect(analogPins).toHaveLength(6);
  });

  it('has SPI bus on D10-D13', () => {
    const spi = ARDUINO_UNO_R3.buses.find((b) => b.id === 'spi0');
    expect(spi).toBeDefined();
    expect(spi?.type).toBe('spi');
    expect(spi?.pinIds).toContain('D10');
    expect(spi?.pinIds).toContain('D11');
    expect(spi?.pinIds).toContain('D12');
    expect(spi?.pinIds).toContain('D13');
  });

  it('has I2C bus on A4/A5', () => {
    const i2c = ARDUINO_UNO_R3.buses.find((b) => b.id === 'i2c0');
    expect(i2c).toBeDefined();
    expect(i2c?.pinIds).toContain('A4');
    expect(i2c?.pinIds).toContain('A5');
  });

  it('has UART bus on D0/D1', () => {
    const uart = ARDUINO_UNO_R3.buses.find((b) => b.id === 'serial0');
    expect(uart).toBeDefined();
    expect(uart?.pinIds).toEqual(['D0', 'D1']);
  });

  it('has 4 header groups', () => {
    expect(ARDUINO_UNO_R3.headerLayout).toHaveLength(4);
  });

  it('warns about 5V logic', () => {
    expect(ARDUINO_UNO_R3.warnings.some((w) => w.includes('5V'))).toBe(true);
  });

  it('has searchable aliases', () => {
    expect(ARDUINO_UNO_R3.aliases.length).toBeGreaterThanOrEqual(3);
    expect(ARDUINO_UNO_R3.aliases).toContain('Uno R3');
  });

  it('has official evidence', () => {
    const datasheet = ARDUINO_UNO_R3.evidence.find((e) => e.type === 'datasheet');
    expect(datasheet).toBeDefined();
    expect(datasheet?.confidence).toBe('high');
  });

  it('all pins reference valid header groups', () => {
    const headerIds = new Set(ARDUINO_UNO_R3.headerLayout.map((h) => h.id));
    for (const pin of ARDUINO_UNO_R3.pins) {
      expect(headerIds.has(pin.headerGroup)).toBe(true);
    }
  });

  it('all bus pinIds reference valid pins', () => {
    const pinIds = new Set(ARDUINO_UNO_R3.pins.map((p) => p.id));
    for (const bus of ARDUINO_UNO_R3.buses) {
      for (const pid of bus.pinIds) {
        expect(pinIds.has(pid)).toBe(true);
      }
    }
  });

  it('D13 warns about on-board LED', () => {
    const d13 = ARDUINO_UNO_R3.pins.find((p) => p.id === 'D13');
    expect(d13).toBeDefined();
    expect(d13?.warnings?.some((w) => w.includes('LED'))).toBe(true);
  });
});
