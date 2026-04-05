import { describe, expect, it } from 'vitest';
import { RIORAND_KJL01 } from '../riorand-kjl01';

describe('RioRand KJL-01 BLDC Controller board definition', () => {
  it('has correct identity', () => {
    expect(RIORAND_KJL01.id).toBe('riorand-kjl01');
    expect(RIORAND_KJL01.title).toContain('RioRand');
    expect(RIORAND_KJL01.manufacturer).toBe('RioRand');
    expect(RIORAND_KJL01.mpn).toBe('KJL-01');
    expect(RIORAND_KJL01.family).toBe('driver');
  });

  it('is not breadboard-friendly', () => {
    expect(RIORAND_KJL01.breadboardFit).toBe('not_breadboard_friendly');
  });

  it('has ~14 terminals total', () => {
    expect(RIORAND_KJL01.pins).toHaveLength(14);
  });

  it('has 2 power input terminals (V+, V-)', () => {
    const power = RIORAND_KJL01.pins.filter(
      (p) => p.headerGroup === 'power-input',
    );
    expect(power).toHaveLength(2);
    expect(power.find((p) => p.id === 'V_PLUS')).toBeDefined();
    expect(power.find((p) => p.id === 'V_MINUS')).toBeDefined();
  });

  it('has 3 motor phase outputs (U, V, W)', () => {
    const phases = RIORAND_KJL01.pins.filter(
      (p) => p.headerGroup === 'motor-output',
    );
    expect(phases).toHaveLength(3);
    expect(phases.find((p) => p.id === 'PHASE_U')).toBeDefined();
    expect(phases.find((p) => p.id === 'PHASE_V')).toBeDefined();
    expect(phases.find((p) => p.id === 'PHASE_W')).toBeDefined();
  });

  it('has 5 hall sensor pins (+5V, GND, Ha, Hb, Hc)', () => {
    const hall = RIORAND_KJL01.pins.filter(
      (p) => p.headerGroup === 'hall-sensor',
    );
    expect(hall).toHaveLength(5);
    expect(hall.find((p) => p.id === 'HALL_VCC')).toBeDefined();
    expect(hall.find((p) => p.id === 'HALL_GND')).toBeDefined();
    expect(hall.find((p) => p.id === 'HALL_A')).toBeDefined();
    expect(hall.find((p) => p.id === 'HALL_B')).toBeDefined();
    expect(hall.find((p) => p.id === 'HALL_C')).toBeDefined();
  });

  it('has 4 control terminals (SPEED, STOP, BRAKE, DIR)', () => {
    const control = RIORAND_KJL01.pins.filter(
      (p) => p.headerGroup === 'control',
    );
    expect(control).toHaveLength(4);
    expect(control.find((p) => p.id === 'SPEED')).toBeDefined();
    expect(control.find((p) => p.id === 'STOP')).toBeDefined();
    expect(control.find((p) => p.id === 'BRAKE')).toBeDefined();
    expect(control.find((p) => p.id === 'DIR')).toBeDefined();
  });

  it('STOP is active-low', () => {
    const stop = RIORAND_KJL01.pins.find((p) => p.id === 'STOP');
    expect(stop?.warnings?.some((w) => w.includes('Active LOW'))).toBe(true);
  });

  it('BRAKE is active-high', () => {
    const brake = RIORAND_KJL01.pins.find((p) => p.id === 'BRAKE');
    expect(brake?.warnings?.some((w) => w.includes('Active HIGH'))).toBe(true);
  });

  it('SPEED accepts 0-5V analog input', () => {
    const speed = RIORAND_KJL01.pins.find((p) => p.id === 'SPEED');
    expect(speed?.functions.some((fn) => fn.type === 'adc')).toBe(true);
    expect(speed?.warnings?.some((w) => w.includes('0-5V'))).toBe(true);
  });

  it('has motor phase bus', () => {
    const motorBus = RIORAND_KJL01.buses.find((b) => b.id === 'motor-phases');
    expect(motorBus).toBeDefined();
    expect(motorBus?.pinIds).toEqual(['PHASE_U', 'PHASE_V', 'PHASE_W']);
  });

  it('has hall sensor bus', () => {
    const hallBus = RIORAND_KJL01.buses.find((b) => b.id === 'hall-sensors');
    expect(hallBus).toBeDefined();
    expect(hallBus?.type).toBe('hall');
    expect(hallBus?.pinIds).toHaveLength(5);
  });

  it('has MCU control bus', () => {
    const mcuBus = RIORAND_KJL01.buses.find((b) => b.id === 'mcu-control');
    expect(mcuBus).toBeDefined();
    expect(mcuBus?.pinIds).toEqual(['SPEED', 'STOP', 'BRAKE', 'DIR']);
  });

  it('has marketplace-level evidence (not official datasheet)', () => {
    const marketplace = RIORAND_KJL01.evidence.find(
      (e) => e.type === 'marketplace-listing',
    );
    expect(marketplace).toBeDefined();
    expect(marketplace?.confidence).toBe('medium');
    expect(marketplace?.href).toContain('amazon.com');

    // Should NOT have an official datasheet
    const datasheet = RIORAND_KJL01.evidence.find((e) => e.type === 'datasheet');
    expect(datasheet).toBeUndefined();
  });

  it('accepts 6-60V input range', () => {
    expect(RIORAND_KJL01.inputVoltageRange).toEqual([6, 60]);
  });

  it('warns about reverse polarity', () => {
    expect(RIORAND_KJL01.warnings.some((w) => w.includes('reverse polarity'))).toBe(true);
  });

  it('warns about phase wiring order', () => {
    expect(RIORAND_KJL01.warnings.some((w) => w.includes('phase') || w.includes('Phase'))).toBe(true);
  });

  it('has searchable aliases', () => {
    expect(RIORAND_KJL01.aliases).toContain('RioRand Motor Controller');
    expect(RIORAND_KJL01.aliases).toContain('KJL-01');
    expect(RIORAND_KJL01.aliases.length).toBeGreaterThanOrEqual(4);
  });

  it('all pins reference valid header groups', () => {
    const headerIds = new Set(RIORAND_KJL01.headerLayout.map((h) => h.id));
    for (const pin of RIORAND_KJL01.pins) {
      expect(headerIds.has(pin.headerGroup)).toBe(true);
    }
  });

  it('all bus pinIds reference valid pins', () => {
    const pinIds = new Set(RIORAND_KJL01.pins.map((p) => p.id));
    for (const bus of RIORAND_KJL01.buses) {
      for (const pid of bus.pinIds) {
        expect(pinIds.has(pid)).toBe(true);
      }
    }
  });
});
