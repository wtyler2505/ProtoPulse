import { describe, expect, it } from 'vitest';
import { RPI_PICO } from '../rpi-pico';

describe('Raspberry Pi Pico board definition', () => {
  it('has correct identity', () => {
    expect(RPI_PICO.id).toBe('rpi-pico');
    expect(RPI_PICO.title).toBe('Raspberry Pi Pico');
    expect(RPI_PICO.manufacturer).toBe('Raspberry Pi');
    expect(RPI_PICO.family).toBe('board-module');
  });

  it('has 40 total pins (2x20 DIP)', () => {
    expect(RPI_PICO.pins).toHaveLength(40);
  });

  it('has correct physical dimensions', () => {
    expect(RPI_PICO.dimensions.width).toBe(21);
    expect(RPI_PICO.dimensions.height).toBe(51);
    expect(RPI_PICO.breadboardFit).toBe('native');
    expect(RPI_PICO.pinSpacing).toBe(2.54);
  });

  it('operates at 3.3V', () => {
    expect(RPI_PICO.operatingVoltage).toBe(3.3);
  });

  it('has ADC pins with 12-bit resolution', () => {
    const adcPins = RPI_PICO.pins.filter((p) =>
      p.functions.some((fn) => fn.type === 'adc'),
    );
    expect(adcPins.length).toBeGreaterThanOrEqual(3);
    for (const pin of adcPins) {
      const adcFn = pin.functions.find((fn) => fn.type === 'adc');
      expect(adcFn?.notes).toContain('12-bit');
    }
  });

  it('has 6 buses (2 UART, 2 SPI, 2 I2C)', () => {
    expect(RPI_PICO.buses).toHaveLength(6);
    const uarts = RPI_PICO.buses.filter((b) => b.type === 'uart');
    const spis = RPI_PICO.buses.filter((b) => b.type === 'spi');
    const i2cs = RPI_PICO.buses.filter((b) => b.type === 'i2c');
    expect(uarts).toHaveLength(2);
    expect(spis).toHaveLength(2);
    expect(i2cs).toHaveLength(2);
  });

  it('has 2 header groups with 20 pins each', () => {
    expect(RPI_PICO.headerLayout).toHaveLength(2);
    expect(RPI_PICO.headerLayout[0].pinCount).toBe(20);
    expect(RPI_PICO.headerLayout[1].pinCount).toBe(20);
  });

  it('has PWM-capable digital pins', () => {
    const pwmPins = RPI_PICO.pins.filter((p) =>
      p.functions.some((fn) => fn.type === 'pwm'),
    );
    expect(pwmPins.length).toBeGreaterThanOrEqual(16);
  });

  it('warns about 3.3V logic', () => {
    expect(RPI_PICO.warnings.some((w) => w.includes('3.3V'))).toBe(true);
  });

  it('has searchable aliases including RP2040', () => {
    expect(RPI_PICO.aliases.some((a) => a.includes('RP2040') || a.includes('Pico'))).toBe(true);
  });

  it('has official evidence', () => {
    const datasheet = RPI_PICO.evidence.find((e) => e.type === 'datasheet');
    expect(datasheet).toBeDefined();
    expect(datasheet?.confidence).toBe('high');
  });

  it('all pins reference valid header groups', () => {
    const headerIds = new Set(RPI_PICO.headerLayout.map((h) => h.id));
    for (const pin of RPI_PICO.pins) {
      expect(headerIds.has(pin.headerGroup)).toBe(true);
    }
  });

  it('all bus pinIds reference valid pins', () => {
    const pinIds = new Set(RPI_PICO.pins.map((p) => p.id));
    for (const bus of RPI_PICO.buses) {
      for (const pid of bus.pinIds) {
        expect(pinIds.has(pid)).toBe(true);
      }
    }
  });
});
