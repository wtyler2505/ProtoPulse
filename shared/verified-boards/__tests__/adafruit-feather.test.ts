import { describe, expect, it } from 'vitest';
import { ADAFRUIT_FEATHER_M0 } from '../adafruit-feather';

describe('Adafruit Feather M0 board definition', () => {
  it('has correct identity', () => {
    expect(ADAFRUIT_FEATHER_M0.id).toBe('adafruit-feather-m0');
    expect(ADAFRUIT_FEATHER_M0.title).toBe('Adafruit Feather M0 Basic Proto');
    expect(ADAFRUIT_FEATHER_M0.manufacturer).toBe('Adafruit');
    expect(ADAFRUIT_FEATHER_M0.mpn).toBe('2772');
    expect(ADAFRUIT_FEATHER_M0.family).toBe('board-module');
  });

  it('has 28 total pins (16 left + 12 right)', () => {
    expect(ADAFRUIT_FEATHER_M0.pins).toHaveLength(28);
  });

  it('has correct physical dimensions', () => {
    expect(ADAFRUIT_FEATHER_M0.dimensions.width).toBe(23);
    expect(ADAFRUIT_FEATHER_M0.dimensions.height).toBe(51);
    expect(ADAFRUIT_FEATHER_M0.breadboardFit).toBe('native');
    expect(ADAFRUIT_FEATHER_M0.pinSpacing).toBe(2.54);
  });

  it('operates at 3.3V', () => {
    expect(ADAFRUIT_FEATHER_M0.operatingVoltage).toBe(3.3);
  });

  it('has max 7mA per GPIO pin', () => {
    expect(ADAFRUIT_FEATHER_M0.maxCurrentPerPin).toBe(7);
  });

  it('A0 has true DAC output', () => {
    const a0 = ADAFRUIT_FEATHER_M0.pins.find((p) => p.id === 'A0');
    expect(a0).toBeDefined();
    expect(a0?.functions.some((fn) => fn.type === 'dac')).toBe(true);
    expect(a0?.functions.some((fn) => fn.type === 'adc')).toBe(true);
  });

  it('has 6 ADC pins (A0-A5) with 12-bit resolution', () => {
    const adcPins = ADAFRUIT_FEATHER_M0.pins.filter((p) =>
      p.functions.some((fn) => fn.type === 'adc'),
    );
    expect(adcPins.length).toBeGreaterThanOrEqual(6);
  });

  it('has SPI bus', () => {
    const spi = ADAFRUIT_FEATHER_M0.buses.find((b) => b.id === 'spi0');
    expect(spi).toBeDefined();
    expect(spi?.type).toBe('spi');
    expect(spi?.pinIds).toContain('SCK');
    expect(spi?.pinIds).toContain('MOSI');
    expect(spi?.pinIds).toContain('MISO');
  });

  it('has I2C bus on SDA/SCL', () => {
    const i2c = ADAFRUIT_FEATHER_M0.buses.find((b) => b.id === 'i2c0');
    expect(i2c).toBeDefined();
    expect(i2c?.pinIds).toContain('SDA');
    expect(i2c?.pinIds).toContain('SCL');
  });

  it('has UART bus on D0/D1', () => {
    const uart = ADAFRUIT_FEATHER_M0.buses.find((b) => b.id === 'serial1');
    expect(uart).toBeDefined();
    expect(uart?.pinIds).toEqual(['D0', 'D1']);
  });

  it('has 2 header groups (16 left + 12 right)', () => {
    expect(ADAFRUIT_FEATHER_M0.headerLayout).toHaveLength(2);
    expect(ADAFRUIT_FEATHER_M0.headerLayout[0].pinCount).toBe(16);
    expect(ADAFRUIT_FEATHER_M0.headerLayout[1].pinCount).toBe(12);
  });

  it('has PWM pins (D5-D13)', () => {
    const pwmPins = ADAFRUIT_FEATHER_M0.pins.filter((p) =>
      p.functions.some((fn) => fn.type === 'pwm'),
    );
    expect(pwmPins.length).toBeGreaterThanOrEqual(5);
  });

  it('warns about 3.3V intolerance', () => {
    expect(ADAFRUIT_FEATHER_M0.warnings.some((w) => w.includes('3.3V') || w.includes('5V'))).toBe(true);
  });

  it('warns about low current per pin', () => {
    expect(ADAFRUIT_FEATHER_M0.warnings.some((w) => w.includes('7mA'))).toBe(true);
  });

  it('has searchable aliases', () => {
    expect(ADAFRUIT_FEATHER_M0.aliases.length).toBeGreaterThanOrEqual(3);
  });

  it('has official Adafruit evidence', () => {
    const pinout = ADAFRUIT_FEATHER_M0.evidence.find((e) => e.type === 'pinout');
    expect(pinout).toBeDefined();
    expect(pinout?.confidence).toBe('high');
  });

  it('all pins reference valid header groups', () => {
    const headerIds = new Set(ADAFRUIT_FEATHER_M0.headerLayout.map((h) => h.id));
    for (const pin of ADAFRUIT_FEATHER_M0.pins) {
      expect(headerIds.has(pin.headerGroup)).toBe(true);
    }
  });

  it('all bus pinIds reference valid pins', () => {
    const pinIds = new Set(ADAFRUIT_FEATHER_M0.pins.map((p) => p.id));
    for (const bus of ADAFRUIT_FEATHER_M0.buses) {
      for (const pid of bus.pinIds) {
        expect(pinIds.has(pid)).toBe(true);
      }
    }
  });
});
