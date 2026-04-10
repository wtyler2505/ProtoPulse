import { describe, expect, it } from 'vitest';
import { ARDUINO_NANO } from '../arduino-nano';

describe('Arduino Nano board definition', () => {
  it('has correct identity', () => {
    expect(ARDUINO_NANO.id).toBe('arduino-nano');
    expect(ARDUINO_NANO.title).toBe('Arduino Nano');
    expect(ARDUINO_NANO.manufacturer).toBe('Arduino');
    expect(ARDUINO_NANO.mpn).toBe('A000005');
    expect(ARDUINO_NANO.family).toBe('board-module');
  });

  it('has 30 total pins (2x15 DIP)', () => {
    expect(ARDUINO_NANO.pins).toHaveLength(30);
  });

  it('has correct physical dimensions', () => {
    expect(ARDUINO_NANO.dimensions.width).toBe(18);
    expect(ARDUINO_NANO.dimensions.height).toBe(45);
    expect(ARDUINO_NANO.breadboardFit).toBe('native');
    expect(ARDUINO_NANO.pinSpacing).toBe(2.54);
  });

  it('operates at 5V', () => {
    expect(ARDUINO_NANO.operatingVoltage).toBe(5);
  });

  it('has 6 PWM pins (3, 5, 6, 9, 10, 11)', () => {
    const pwmPins = ARDUINO_NANO.pins.filter((p) =>
      p.functions.some((fn) => fn.type === 'pwm'),
    );
    expect(pwmPins).toHaveLength(6);
  });

  it('has 8 analog input pins (A0-A7)', () => {
    const analogPins = ARDUINO_NANO.pins.filter((p) =>
      p.functions.some((fn) => fn.type === 'adc'),
    );
    expect(analogPins).toHaveLength(8);
  });

  it('has SPI bus on D10-D13', () => {
    const spi = ARDUINO_NANO.buses.find((b) => b.id === 'spi0');
    expect(spi).toBeDefined();
    expect(spi?.type).toBe('spi');
    expect(spi?.pinIds).toEqual(['D10', 'D11', 'D12', 'D13']);
  });

  it('has I2C bus on A4/A5', () => {
    const i2c = ARDUINO_NANO.buses.find((b) => b.id === 'i2c0');
    expect(i2c).toBeDefined();
    expect(i2c?.pinIds).toEqual(['A4', 'A5']);
  });

  it('A4/A5 have dual ADC and I2C functions', () => {
    const a4 = ARDUINO_NANO.pins.find((p) => p.id === 'A4');
    expect(a4?.functions.some((fn) => fn.type === 'adc')).toBe(true);
    expect(a4?.functions.some((fn) => fn.type === 'i2c' && fn.signal === 'SDA')).toBe(true);

    const a5 = ARDUINO_NANO.pins.find((p) => p.id === 'A5');
    expect(a5?.functions.some((fn) => fn.type === 'adc')).toBe(true);
    expect(a5?.functions.some((fn) => fn.type === 'i2c' && fn.signal === 'SCL')).toBe(true);
  });

  it('has UART bus on D0/D1', () => {
    const uart = ARDUINO_NANO.buses.find((b) => b.id === 'serial0');
    expect(uart).toBeDefined();
    expect(uart?.pinIds).toEqual(['D0', 'D1']);
  });

  it('D0/D1 warn about USB serial sharing', () => {
    const d0 = ARDUINO_NANO.pins.find((p) => p.id === 'D0');
    const d1 = ARDUINO_NANO.pins.find((p) => p.id === 'D1');
    expect(d0?.warnings?.some((w) => w.includes('USB') || w.includes('serial'))).toBe(true);
    expect(d1?.warnings?.some((w) => w.includes('USB') || w.includes('serial'))).toBe(true);
  });

  it('has 2 header groups with 15 pins each', () => {
    expect(ARDUINO_NANO.headerLayout).toHaveLength(2);
    expect(ARDUINO_NANO.headerLayout[0].pinCount).toBe(15);
    expect(ARDUINO_NANO.headerLayout[1].pinCount).toBe(15);
  });

  it('has 2 external interrupt pins (D2=INT0, D3=INT1)', () => {
    const d2 = ARDUINO_NANO.pins.find((p) => p.id === 'D2');
    const d3 = ARDUINO_NANO.pins.find((p) => p.id === 'D3');
    expect(d2?.functions.some((fn) => fn.type === 'interrupt')).toBe(true);
    expect(d3?.functions.some((fn) => fn.type === 'interrupt')).toBe(true);
  });

  it('warns about 5V logic and clone drivers', () => {
    expect(ARDUINO_NANO.warnings.some((w) => w.includes('5V'))).toBe(true);
    expect(ARDUINO_NANO.warnings.some((w) => w.includes('clone') || w.includes('CH340'))).toBe(true);
  });

  it('has searchable aliases', () => {
    expect(ARDUINO_NANO.aliases.length).toBeGreaterThanOrEqual(3);
  });

  it('has official evidence', () => {
    const datasheet = ARDUINO_NANO.evidence.find((e) => e.type === 'datasheet');
    expect(datasheet).toBeDefined();
    expect(datasheet?.confidence).toBe('high');
  });

  it('all pins reference valid header groups', () => {
    const headerIds = new Set(ARDUINO_NANO.headerLayout.map((h) => h.id));
    for (const pin of ARDUINO_NANO.pins) {
      expect(headerIds.has(pin.headerGroup)).toBe(true);
    }
  });

  it('all bus pinIds reference valid pins', () => {
    const pinIds = new Set(ARDUINO_NANO.pins.map((p) => p.id));
    for (const bus of ARDUINO_NANO.buses) {
      for (const pid of bus.pinIds) {
        expect(pinIds.has(pid)).toBe(true);
      }
    }
  });

  it('D13 warns about on-board LED', () => {
    const d13 = ARDUINO_NANO.pins.find((p) => p.id === 'D13');
    expect(d13?.warnings?.some((w) => w.includes('LED'))).toBe(true);
  });
});
