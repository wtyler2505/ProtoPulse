import { describe, expect, it } from 'vitest';
import { MEGA_2560_R3 } from '../mega-2560-r3';

describe('Arduino Mega 2560 R3 board definition', () => {
  it('has correct identity', () => {
    expect(MEGA_2560_R3.id).toBe('arduino-mega-2560-r3');
    expect(MEGA_2560_R3.title).toBe('Arduino Mega 2560 R3');
    expect(MEGA_2560_R3.manufacturer).toBe('Arduino');
    expect(MEGA_2560_R3.mpn).toBe('A000067');
    expect(MEGA_2560_R3.family).toBe('board-module');
  });

  it('has correct physical dimensions', () => {
    expect(MEGA_2560_R3.dimensions.width).toBe(101.6);
    expect(MEGA_2560_R3.dimensions.height).toBe(53.34);
    expect(MEGA_2560_R3.breadboardFit).toBe('not_breadboard_friendly');
    expect(MEGA_2560_R3.pinSpacing).toBe(2.54);
  });

  it('has correct electrical specs', () => {
    expect(MEGA_2560_R3.operatingVoltage).toBe(5);
    expect(MEGA_2560_R3.inputVoltageRange).toEqual([7, 12]);
    expect(MEGA_2560_R3.maxCurrentPerPin).toBe(40);
    expect(MEGA_2560_R3.maxTotalCurrent).toBe(200);
  });

  it('has all 54 digital pins (D0-D53)', () => {
    for (let i = 0; i <= 53; i++) {
      expect(MEGA_2560_R3.pins.find((p) => p.id === `D${i}`)).toBeDefined();
    }
  });

  it('has all 16 analog pins (A0-A15)', () => {
    for (let i = 0; i <= 15; i++) {
      expect(MEGA_2560_R3.pins.find((p) => p.id === `A${i}`)).toBeDefined();
    }
    // Exactly 16 analog-role pins
    const analogPins = MEGA_2560_R3.pins.filter((p) => p.role === 'analog');
    expect(analogPins).toHaveLength(16);
  });

  it('has exactly 15 PWM pins', () => {
    const pwmPins = MEGA_2560_R3.pins.filter((p) =>
      p.functions.some((fn) => fn.type === 'pwm'),
    );
    expect(pwmPins).toHaveLength(15);
    const pwmIds = new Set(pwmPins.map((p) => p.id));
    for (const expected of ['D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13', 'D44', 'D45', 'D46']) {
      expect(pwmIds.has(expected)).toBe(true);
    }
  });

  it('has 4 UART buses with correct pin assignments', () => {
    const uartBuses = MEGA_2560_R3.buses.filter((b) => b.type === 'uart');
    expect(uartBuses).toHaveLength(4);

    const serial0 = uartBuses.find((b) => b.id === 'serial0');
    expect(serial0?.pinIds).toEqual(['D0', 'D1']);

    const serial1 = uartBuses.find((b) => b.id === 'serial1');
    expect(serial1?.pinIds).toEqual(['D18', 'D19']);

    const serial2 = uartBuses.find((b) => b.id === 'serial2');
    expect(serial2?.pinIds).toEqual(['D16', 'D17']);

    const serial3 = uartBuses.find((b) => b.id === 'serial3');
    expect(serial3?.pinIds).toEqual(['D14', 'D15']);
  });

  it('has SPI bus on pins 50-53', () => {
    const spiBus = MEGA_2560_R3.buses.find((b) => b.id === 'spi0');
    expect(spiBus).toBeDefined();
    expect(spiBus?.pinIds).toEqual(['D50', 'D51', 'D52', 'D53']);
  });

  it('has I2C bus on pins 20-21', () => {
    const i2cBus = MEGA_2560_R3.buses.find((b) => b.id === 'i2c0');
    expect(i2cBus).toBeDefined();
    expect(i2cBus?.pinIds).toEqual(['D20', 'D21']);
  });

  it('has 6 external interrupt pins', () => {
    const interruptPins = MEGA_2560_R3.pins.filter((p) =>
      p.functions.some((fn) => fn.type === 'interrupt'),
    );
    expect(interruptPins).toHaveLength(6);
    const ids = new Set(interruptPins.map((p) => p.id));
    for (const expected of ['D2', 'D3', 'D18', 'D19', 'D20', 'D21']) {
      expect(ids.has(expected)).toBe(true);
    }
  });

  it('has official datasheet evidence', () => {
    const datasheet = MEGA_2560_R3.evidence.find((e) => e.type === 'datasheet');
    expect(datasheet).toBeDefined();
    expect(datasheet?.confidence).toBe('high');
    expect(datasheet?.href).toContain('arduino.cc');
  });

  it('warns about pins 0/1 USB serial sharing', () => {
    const pin0 = MEGA_2560_R3.pins.find((p) => p.id === 'D0');
    expect(pin0?.warnings?.some((w) => w.includes('USB'))).toBe(true);
  });

  it('warns about pin 13 LED', () => {
    const pin13 = MEGA_2560_R3.pins.find((p) => p.id === 'D13');
    expect(pin13?.warnings?.some((w) => w.includes('LED'))).toBe(true);
  });

  it('has searchable aliases', () => {
    expect(MEGA_2560_R3.aliases).toContain('Arduino Mega');
    expect(MEGA_2560_R3.aliases).toContain('Mega 2560');
    expect(MEGA_2560_R3.aliases.length).toBeGreaterThanOrEqual(4);
  });

  it('all pins reference valid header groups', () => {
    const headerIds = new Set(MEGA_2560_R3.headerLayout.map((h) => h.id));
    for (const pin of MEGA_2560_R3.pins) {
      expect(headerIds.has(pin.headerGroup)).toBe(true);
    }
  });

  it('all bus pinIds reference valid pins', () => {
    const pinIds = new Set(MEGA_2560_R3.pins.map((p) => p.id));
    for (const bus of MEGA_2560_R3.buses) {
      for (const pid of bus.pinIds) {
        expect(pinIds.has(pid)).toBe(true);
      }
    }
  });
});
