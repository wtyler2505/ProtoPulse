import { describe, expect, it } from 'vitest';
import { NODEMCU_ESP32S } from '../nodemcu-esp32s';

describe('NodeMCU ESP32-S board definition', () => {
  it('has correct identity', () => {
    expect(NODEMCU_ESP32S.id).toBe('nodemcu-esp32s');
    expect(NODEMCU_ESP32S.title).toBe('NodeMCU ESP32-S');
    expect(NODEMCU_ESP32S.manufacturer).toContain('Espressif');
    expect(NODEMCU_ESP32S.mpn).toBe('ESP-WROOM-32');
    expect(NODEMCU_ESP32S.family).toBe('board-module');
  });

  it('has 38 total pins (2x19)', () => {
    expect(NODEMCU_ESP32S.pins).toHaveLength(38);
  });

  it('has correct physical dimensions', () => {
    expect(NODEMCU_ESP32S.dimensions.width).toBe(25.4);
    expect(NODEMCU_ESP32S.dimensions.height).toBe(54);
    expect(NODEMCU_ESP32S.breadboardFit).toBe('requires_jumpers');
    expect(NODEMCU_ESP32S.pinSpacing).toBe(2.54);
  });

  it('operates at 3.3V', () => {
    expect(NODEMCU_ESP32S.operatingVoltage).toBe(3.3);
  });

  it('has exactly 6 restricted flash-connected pins (GPIO 6-11)', () => {
    const restricted = NODEMCU_ESP32S.pins.filter((p) => p.restricted === true);
    expect(restricted).toHaveLength(6);
    const restrictedIds = new Set(restricted.map((p) => p.id));
    for (const gpio of ['GPIO6', 'GPIO7', 'GPIO8', 'GPIO9', 'GPIO10', 'GPIO11']) {
      expect(restrictedIds.has(gpio)).toBe(true);
    }
    for (const pin of restricted) {
      expect(pin.restrictionReason).toContain('SPI flash');
    }
  });

  it('has 6 input-only pins (GPIO 34-39)', () => {
    const inputOnly = NODEMCU_ESP32S.pins.filter(
      (p) => ['GPIO34', 'GPIO35', 'GPIO36', 'GPIO39'].includes(p.id) && p.direction === 'input',
    );
    expect(inputOnly).toHaveLength(4);
    // GPIO36 (VP) and GPIO39 (VN) are also input-only
    const vp = NODEMCU_ESP32S.pins.find((p) => p.id === 'GPIO36');
    const vn = NODEMCU_ESP32S.pins.find((p) => p.id === 'GPIO39');
    expect(vp?.direction).toBe('input');
    expect(vn?.direction).toBe('input');
  });

  it('has 5 boot/strapping pins', () => {
    expect(NODEMCU_ESP32S.bootPins).toBeDefined();
    expect(NODEMCU_ESP32S.bootPins).toHaveLength(5);

    const bootPinIds = new Set(NODEMCU_ESP32S.bootPins!.map((bp) => bp.pinId));
    for (const expected of ['GPIO0', 'GPIO2', 'GPIO5', 'GPIO12', 'GPIO15']) {
      expect(bootPinIds.has(expected)).toBe(true);
    }
  });

  it('GPIO12 boot config warns about 1.8V flash danger', () => {
    const gpio12Boot = NODEMCU_ESP32S.bootPins!.find((bp) => bp.pinId === 'GPIO12');
    expect(gpio12Boot).toBeDefined();
    expect(gpio12Boot!.highBehavior).toContain('1.8V');
    expect(gpio12Boot!.internalDefault).toBe('low');
    expect(gpio12Boot!.designRule).toContain('CRITICAL');
  });

  it('ADC2 pins carry WiFi unavailability warning', () => {
    const adc2Pins = NODEMCU_ESP32S.pins.filter((p) =>
      p.functions.some((fn) => fn.type === 'adc' && fn.channel?.startsWith('ADC2')),
    );
    expect(adc2Pins.length).toBeGreaterThanOrEqual(8);
    for (const pin of adc2Pins) {
      const adcFn = pin.functions.find((fn) => fn.type === 'adc' && fn.channel?.startsWith('ADC2'));
      expect(adcFn?.notes).toContain('WiFi');
    }
  });

  it('has VSPI bus with correct pins', () => {
    const vspi = NODEMCU_ESP32S.buses.find((b) => b.id === 'vspi');
    expect(vspi).toBeDefined();
    expect(vspi?.type).toBe('spi');
    expect(vspi?.pinIds).toEqual(['GPIO23', 'GPIO19', 'GPIO18', 'GPIO5']);
  });

  it('has HSPI bus with correct pins', () => {
    const hspi = NODEMCU_ESP32S.buses.find((b) => b.id === 'hspi');
    expect(hspi).toBeDefined();
    expect(hspi?.type).toBe('spi');
    expect(hspi?.pinIds).toEqual(['GPIO13', 'GPIO12', 'GPIO14', 'GPIO15']);
  });

  it('has I2C bus on GPIO21/22', () => {
    const i2c = NODEMCU_ESP32S.buses.find((b) => b.id === 'i2c0');
    expect(i2c).toBeDefined();
    expect(i2c?.pinIds).toEqual(['GPIO21', 'GPIO22']);
  });

  it('has UART0 (USB) and UART2 buses', () => {
    const uart0 = NODEMCU_ESP32S.buses.find((b) => b.id === 'uart0');
    expect(uart0?.pinIds).toEqual(['GPIO1', 'GPIO3']);

    const uart2 = NODEMCU_ESP32S.buses.find((b) => b.id === 'uart2');
    expect(uart2?.pinIds).toEqual(['GPIO17', 'GPIO16']);
  });

  it('has hall sensor bus', () => {
    const hall = NODEMCU_ESP32S.buses.find((b) => b.id === 'hall-sensor');
    expect(hall).toBeDefined();
    expect(hall?.pinIds).toEqual(['GPIO36', 'GPIO39']);
  });

  it('has 2 DAC outputs on GPIO25/26', () => {
    const dacPins = NODEMCU_ESP32S.pins.filter((p) =>
      p.functions.some((fn) => fn.type === 'dac'),
    );
    expect(dacPins).toHaveLength(2);
    const dacIds = new Set(dacPins.map((p) => p.id));
    expect(dacIds.has('GPIO25')).toBe(true);
    expect(dacIds.has('GPIO26')).toBe(true);
  });

  it('has 10 capacitive touch pins', () => {
    const touchPins = NODEMCU_ESP32S.pins.filter((p) =>
      p.functions.some((fn) => fn.type === 'touch'),
    );
    expect(touchPins).toHaveLength(10);
  });

  it('has official Espressif datasheet evidence', () => {
    const datasheet = NODEMCU_ESP32S.evidence.find((e) => e.type === 'datasheet');
    expect(datasheet).toBeDefined();
    expect(datasheet?.confidence).toBe('high');
    expect(datasheet?.href).toContain('espressif.com');
  });

  it('warns about 5V intolerance', () => {
    expect(NODEMCU_ESP32S.warnings.some((w) => w.includes('3.3V') || w.includes('5V'))).toBe(true);
  });

  it('has searchable aliases including ESP32 variants', () => {
    expect(NODEMCU_ESP32S.aliases).toContain('ESP32 DevKit');
    expect(NODEMCU_ESP32S.aliases).toContain('ESP-WROOM-32');
    expect(NODEMCU_ESP32S.aliases.length).toBeGreaterThanOrEqual(5);
  });

  it('all pins reference valid header groups', () => {
    const headerIds = new Set(NODEMCU_ESP32S.headerLayout.map((h) => h.id));
    for (const pin of NODEMCU_ESP32S.pins) {
      expect(headerIds.has(pin.headerGroup)).toBe(true);
    }
  });

  it('all bus pinIds reference valid pins', () => {
    const pinIds = new Set(NODEMCU_ESP32S.pins.map((p) => p.id));
    for (const bus of NODEMCU_ESP32S.buses) {
      for (const pid of bus.pinIds) {
        expect(pinIds.has(pid)).toBe(true);
      }
    }
  });

  it('two header groups with 19 pins each', () => {
    expect(NODEMCU_ESP32S.headerLayout).toHaveLength(2);
    expect(NODEMCU_ESP32S.headerLayout[0].pinCount).toBe(19);
    expect(NODEMCU_ESP32S.headerLayout[1].pinCount).toBe(19);
  });
});
