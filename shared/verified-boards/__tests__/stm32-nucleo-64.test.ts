import { describe, expect, it } from 'vitest';
import { STM32_NUCLEO_64 } from '../stm32-nucleo-64';

describe('STM32 Nucleo-64 (F401RE) board definition', () => {
  it('has correct identity', () => {
    expect(STM32_NUCLEO_64.id).toBe('stm32-nucleo-64');
    expect(STM32_NUCLEO_64.title).toBe('STM32 Nucleo-64 (F401RE)');
    expect(STM32_NUCLEO_64.manufacturer).toBe('STMicroelectronics');
    expect(STM32_NUCLEO_64.mpn).toBe('NUCLEO-F401RE');
    expect(STM32_NUCLEO_64.family).toBe('board-module');
  });

  it('has 32 Arduino-header pins', () => {
    expect(STM32_NUCLEO_64.pins).toHaveLength(32);
  });

  it('has correct physical dimensions', () => {
    expect(STM32_NUCLEO_64.dimensions.width).toBe(70);
    expect(STM32_NUCLEO_64.dimensions.height).toBe(82.5);
    expect(STM32_NUCLEO_64.breadboardFit).toBe('not_breadboard_friendly');
    expect(STM32_NUCLEO_64.pinSpacing).toBe(2.54);
  });

  it('operates at 3.3V', () => {
    expect(STM32_NUCLEO_64.operatingVoltage).toBe(3.3);
  });

  it('has 6 analog pins with 12-bit ADC', () => {
    const adcPins = STM32_NUCLEO_64.pins.filter((p) =>
      p.functions.some((fn) => fn.type === 'adc'),
    );
    expect(adcPins).toHaveLength(6);
    for (const pin of adcPins) {
      const adcFn = pin.functions.find((fn) => fn.type === 'adc');
      expect(adcFn?.notes).toContain('12-bit');
    }
  });

  it('has SPI1 bus on D10-D13', () => {
    const spi = STM32_NUCLEO_64.buses.find((b) => b.id === 'spi1');
    expect(spi).toBeDefined();
    expect(spi?.type).toBe('spi');
    expect(spi?.pinIds).toContain('D10');
    expect(spi?.pinIds).toContain('D13');
  });

  it('has I2C1 bus with SDA/SCL and A4/A5', () => {
    const i2c = STM32_NUCLEO_64.buses.find((b) => b.id === 'i2c1');
    expect(i2c).toBeDefined();
    expect(i2c?.pinIds).toContain('SDA');
    expect(i2c?.pinIds).toContain('SCL');
  });

  it('has USART2 connected to ST-LINK', () => {
    const uart = STM32_NUCLEO_64.buses.find((b) => b.id === 'usart2');
    expect(uart).toBeDefined();
    expect(uart?.notes).toContain('ST-LINK');
  });

  it('has 4 header groups (power, analog, digital-low, digital-high)', () => {
    expect(STM32_NUCLEO_64.headerLayout).toHaveLength(4);
    const ids = STM32_NUCLEO_64.headerLayout.map((h) => h.id);
    expect(ids).toContain('power');
    expect(ids).toContain('analog');
    expect(ids).toContain('digital-low');
    expect(ids).toContain('digital-high');
  });

  it('has PWM pins', () => {
    const pwmPins = STM32_NUCLEO_64.pins.filter((p) =>
      p.functions.some((fn) => fn.type === 'pwm'),
    );
    expect(pwmPins.length).toBeGreaterThanOrEqual(4);
  });

  it('D0/D1 warn about ST-LINK connection', () => {
    const d0 = STM32_NUCLEO_64.pins.find((p) => p.id === 'D0');
    const d1 = STM32_NUCLEO_64.pins.find((p) => p.id === 'D1');
    expect(d0?.warnings?.some((w) => w.includes('ST-LINK'))).toBe(true);
    expect(d1?.warnings?.some((w) => w.includes('ST-LINK'))).toBe(true);
  });

  it('warns about 3.3V logic', () => {
    expect(STM32_NUCLEO_64.warnings.some((w) => w.includes('3.3V'))).toBe(true);
  });

  it('has searchable aliases', () => {
    expect(STM32_NUCLEO_64.aliases.length).toBeGreaterThanOrEqual(3);
  });

  it('has official ST evidence', () => {
    expect(STM32_NUCLEO_64.evidence.length).toBeGreaterThanOrEqual(2);
    const datasheet = STM32_NUCLEO_64.evidence.find((e) => e.type === 'datasheet');
    expect(datasheet?.confidence).toBe('high');
  });

  it('all pins reference valid header groups', () => {
    const headerIds = new Set(STM32_NUCLEO_64.headerLayout.map((h) => h.id));
    for (const pin of STM32_NUCLEO_64.pins) {
      expect(headerIds.has(pin.headerGroup)).toBe(true);
    }
  });

  it('all bus pinIds reference valid pins', () => {
    const pinIds = new Set(STM32_NUCLEO_64.pins.map((p) => p.id));
    for (const bus of STM32_NUCLEO_64.buses) {
      for (const pid of bus.pinIds) {
        expect(pinIds.has(pid)).toBe(true);
      }
    }
  });
});
