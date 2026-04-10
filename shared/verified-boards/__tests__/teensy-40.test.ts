import { describe, expect, it } from 'vitest';
import { TEENSY_40 } from '../teensy-40';

describe('Teensy 4.0 board definition', () => {
  it('has correct identity', () => {
    expect(TEENSY_40.id).toBe('teensy-40');
    expect(TEENSY_40.title).toBe('Teensy 4.0');
    expect(TEENSY_40.manufacturer).toBe('PJRC');
    expect(TEENSY_40.family).toBe('board-module');
  });

  it('has 28 through-hole pins (14 left + 14 right)', () => {
    expect(TEENSY_40.pins).toHaveLength(28);
  });

  it('has correct physical dimensions', () => {
    expect(TEENSY_40.dimensions.width).toBe(17.8);
    expect(TEENSY_40.dimensions.height).toBe(35.6);
    expect(TEENSY_40.breadboardFit).toBe('native');
    expect(TEENSY_40.pinSpacing).toBe(2.54);
  });

  it('operates at 3.3V', () => {
    expect(TEENSY_40.operatingVoltage).toBe(3.3);
  });

  it('accepts 3.6-5.5V input voltage', () => {
    expect(TEENSY_40.inputVoltageRange).toEqual([3.6, 5.5]);
  });

  it('has max 10mA per GPIO pin', () => {
    expect(TEENSY_40.maxCurrentPerPin).toBe(10);
  });

  it('all digital pins have PWM via FlexPWM or QuadTimer', () => {
    const digitalPins = TEENSY_40.pins.filter((p) => p.id.startsWith('D'));
    for (const pin of digitalPins) {
      expect(pin.functions.some((fn) => fn.type === 'pwm')).toBe(true);
    }
  });

  it('has analog input pins with 12-bit resolution', () => {
    const adcPins = TEENSY_40.pins.filter((p) =>
      p.functions.some((fn) => fn.type === 'adc'),
    );
    expect(adcPins.length).toBeGreaterThanOrEqual(8);
    for (const pin of adcPins) {
      const adcFn = pin.functions.find((fn) => fn.type === 'adc');
      expect(adcFn?.notes).toContain('12-bit');
    }
  });

  it('has SPI bus on D10-D13', () => {
    const spi = TEENSY_40.buses.find((b) => b.id === 'spi0');
    expect(spi).toBeDefined();
    expect(spi?.type).toBe('spi');
    expect(spi?.pinIds).toEqual(['D10', 'D11', 'D12', 'D13']);
  });

  it('has I2C bus on D18/D19', () => {
    const i2c = TEENSY_40.buses.find((b) => b.id === 'i2c0');
    expect(i2c).toBeDefined();
    expect(i2c?.pinIds).toEqual(['D18', 'D19']);
  });

  it('has Serial1 UART on D0/D1', () => {
    const uart = TEENSY_40.buses.find((b) => b.id === 'serial1');
    expect(uart).toBeDefined();
    expect(uart?.pinIds).toEqual(['D0', 'D1']);
  });

  it('has Serial2 UART on D7/D8', () => {
    const uart = TEENSY_40.buses.find((b) => b.id === 'serial2');
    expect(uart).toBeDefined();
    expect(uart?.pinIds).toEqual(['D7', 'D8']);
  });

  it('has 2 header groups with 14 pins each', () => {
    expect(TEENSY_40.headerLayout).toHaveLength(2);
    expect(TEENSY_40.headerLayout[0].pinCount).toBe(14);
    expect(TEENSY_40.headerLayout[1].pinCount).toBe(14);
  });

  it('D13 warns about on-board LED', () => {
    const d13 = TEENSY_40.pins.find((p) => p.id === 'D13');
    expect(d13).toBeDefined();
    expect(d13?.warnings?.some((w) => w.includes('LED'))).toBe(true);
  });

  it('warns about 3.3V only (not 5V tolerant)', () => {
    expect(TEENSY_40.warnings.some((w) => w.includes('3.3V') && w.includes('5V'))).toBe(true);
  });

  it('warns about bottom pad access', () => {
    expect(TEENSY_40.warnings.some((w) => w.includes('bottom') || w.includes('Bottom'))).toBe(true);
  });

  it('has searchable aliases', () => {
    expect(TEENSY_40.aliases.length).toBeGreaterThanOrEqual(3);
  });

  it('has official PJRC evidence', () => {
    const datasheet = TEENSY_40.evidence.find((e) => e.type === 'datasheet');
    expect(datasheet).toBeDefined();
    expect(datasheet?.confidence).toBe('high');
    expect(datasheet?.href).toContain('pjrc.com');
  });

  it('all pins reference valid header groups', () => {
    const headerIds = new Set(TEENSY_40.headerLayout.map((h) => h.id));
    for (const pin of TEENSY_40.pins) {
      expect(headerIds.has(pin.headerGroup)).toBe(true);
    }
  });

  it('all bus pinIds reference valid pins', () => {
    const pinIds = new Set(TEENSY_40.pins.map((p) => p.id));
    for (const bus of TEENSY_40.buses) {
      for (const pid of bus.pinIds) {
        expect(pinIds.has(pid)).toBe(true);
      }
    }
  });
});
