import { describe, expect, it } from 'vitest';
import { SPARKFUN_THING_PLUS } from '../sparkfun-thing-plus';

describe('SparkFun Thing Plus ESP32 board definition', () => {
  it('has correct identity', () => {
    expect(SPARKFUN_THING_PLUS.id).toBe('sparkfun-thing-plus-esp32');
    expect(SPARKFUN_THING_PLUS.title).toBe('SparkFun Thing Plus ESP32 WROOM');
    expect(SPARKFUN_THING_PLUS.manufacturer).toBe('SparkFun');
    expect(SPARKFUN_THING_PLUS.mpn).toBe('WRL-20168');
    expect(SPARKFUN_THING_PLUS.family).toBe('board-module');
  });

  it('has 28 total pins (16 left + 12 right)', () => {
    expect(SPARKFUN_THING_PLUS.pins).toHaveLength(28);
  });

  it('has correct physical dimensions', () => {
    expect(SPARKFUN_THING_PLUS.dimensions.width).toBe(23);
    expect(SPARKFUN_THING_PLUS.dimensions.height).toBe(58);
    expect(SPARKFUN_THING_PLUS.breadboardFit).toBe('native');
    expect(SPARKFUN_THING_PLUS.pinSpacing).toBe(2.54);
  });

  it('operates at 3.3V', () => {
    expect(SPARKFUN_THING_PLUS.operatingVoltage).toBe(3.3);
  });

  it('has 3 input-only pins (GPIO36, GPIO39, GPIO34)', () => {
    const inputOnly = SPARKFUN_THING_PLUS.pins.filter(
      (p) => ['GPIO36', 'GPIO39', 'GPIO34'].includes(p.id) && p.direction === 'input',
    );
    expect(inputOnly).toHaveLength(3);
  });

  it('has 2 DAC pins (GPIO25, GPIO26)', () => {
    const dacPins = SPARKFUN_THING_PLUS.pins.filter((p) =>
      p.functions.some((fn) => fn.type === 'dac'),
    );
    expect(dacPins).toHaveLength(2);
  });

  it('ADC2 pins carry WiFi unavailability warning', () => {
    const adc2Pins = SPARKFUN_THING_PLUS.pins.filter((p) =>
      p.functions.some((fn) => fn.type === 'adc' && fn.channel?.startsWith('ADC2')),
    );
    expect(adc2Pins.length).toBeGreaterThanOrEqual(5);
    for (const pin of adc2Pins) {
      const adcFn = pin.functions.find((fn) => fn.type === 'adc' && fn.channel?.startsWith('ADC2'));
      expect(adcFn?.notes).toContain('WiFi');
    }
  });

  it('has 4 boot/strapping pins', () => {
    expect(SPARKFUN_THING_PLUS.bootPins).toBeDefined();
    expect(SPARKFUN_THING_PLUS.bootPins).toHaveLength(4);
  });

  it('GPIO12 boot config warns about flash voltage danger', () => {
    const gpio12Boot = SPARKFUN_THING_PLUS.bootPins!.find((bp) => bp.pinId === 'GPIO12');
    expect(gpio12Boot).toBeDefined();
    expect(gpio12Boot!.highBehavior).toContain('1.8V');
    expect(gpio12Boot!.designRule).toContain('CRITICAL');
  });

  it('has VSPI bus', () => {
    const vspi = SPARKFUN_THING_PLUS.buses.find((b) => b.id === 'vspi');
    expect(vspi).toBeDefined();
    expect(vspi?.type).toBe('spi');
    expect(vspi?.pinIds).toContain('GPIO18');
    expect(vspi?.pinIds).toContain('GPIO23');
  });

  it('has I2C bus with Qwiic connector notes', () => {
    const i2c = SPARKFUN_THING_PLUS.buses.find((b) => b.id === 'i2c0');
    expect(i2c).toBeDefined();
    expect(i2c?.notes).toContain('Qwiic');
  });

  it('has UART2 bus on GPIO16/17', () => {
    const uart = SPARKFUN_THING_PLUS.buses.find((b) => b.id === 'serial2');
    expect(uart).toBeDefined();
    expect(uart?.pinIds).toEqual(['GPIO16', 'GPIO17']);
  });

  it('has 2 header groups (16 left + 12 right)', () => {
    expect(SPARKFUN_THING_PLUS.headerLayout).toHaveLength(2);
    expect(SPARKFUN_THING_PLUS.headerLayout[0].pinCount).toBe(16);
    expect(SPARKFUN_THING_PLUS.headerLayout[1].pinCount).toBe(12);
  });

  it('has touch-capable pins', () => {
    const touchPins = SPARKFUN_THING_PLUS.pins.filter((p) =>
      p.functions.some((fn) => fn.type === 'touch'),
    );
    expect(touchPins.length).toBeGreaterThanOrEqual(5);
  });

  it('warns about 3.3V only', () => {
    expect(SPARKFUN_THING_PLUS.warnings.some((w) => w.includes('3.3V'))).toBe(true);
  });

  it('has searchable aliases', () => {
    expect(SPARKFUN_THING_PLUS.aliases.length).toBeGreaterThanOrEqual(3);
  });

  it('has official SparkFun evidence', () => {
    expect(SPARKFUN_THING_PLUS.evidence.length).toBeGreaterThanOrEqual(2);
    const pinout = SPARKFUN_THING_PLUS.evidence.find((e) => e.type === 'pinout');
    expect(pinout?.confidence).toBe('high');
  });

  it('all pins reference valid header groups', () => {
    const headerIds = new Set(SPARKFUN_THING_PLUS.headerLayout.map((h) => h.id));
    for (const pin of SPARKFUN_THING_PLUS.pins) {
      expect(headerIds.has(pin.headerGroup)).toBe(true);
    }
  });

  it('all bus pinIds reference valid pins', () => {
    const pinIds = new Set(SPARKFUN_THING_PLUS.pins.map((p) => p.id));
    for (const bus of SPARKFUN_THING_PLUS.buses) {
      for (const pid of bus.pinIds) {
        expect(pinIds.has(pid)).toBe(true);
      }
    }
  });
});
