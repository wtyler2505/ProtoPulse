import { describe, it, expect, beforeEach } from 'vitest';
import {
  SensorInputManager,
  SENSOR_TYPES,
  detectSensors,
  hcSr04EchoTime,
  hcSr04Distance,
} from '../sensor-inputs';
import type { DetectableInstance, SensorFamily } from '../sensor-inputs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInstance(refDes: string, componentType: string, name = ''): DetectableInstance {
  return {
    referenceDesignator: refDes,
    properties: { componentType, name },
  };
}

// ---------------------------------------------------------------------------
// SensorInputManager — singleton + subscribe
// ---------------------------------------------------------------------------

describe('SensorInputManager', () => {
  beforeEach(() => {
    SensorInputManager.resetInstance();
  });

  it('returns a singleton instance', () => {
    const a = SensorInputManager.getInstance();
    const b = SensorInputManager.getInstance();
    expect(a).toBe(b);
  });

  it('resetInstance creates a fresh instance', () => {
    const a = SensorInputManager.getInstance();
    SensorInputManager.resetInstance();
    const b = SensorInputManager.getInstance();
    expect(a).not.toBe(b);
  });

  it('starts with zero sensors', () => {
    const mgr = SensorInputManager.getInstance();
    expect(mgr.size).toBe(0);
    expect(mgr.getSnapshot().sensors).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------------

  describe('registerSensors', () => {
    it('detects sensors from instances', () => {
      const mgr = SensorInputManager.getInstance();
      mgr.registerSensors([
        makeInstance('U1', 'LM35'),
        makeInstance('R1', 'NTC'),
        makeInstance('R2', 'resistor'), // Not a sensor
      ]);
      expect(mgr.size).toBe(2);
      expect(mgr.getSensor('U1')).toBeDefined();
      expect(mgr.getSensor('R1')).toBeDefined();
      expect(mgr.getSensor('R2')).toBeUndefined();
    });

    it('replaces previous registrations', () => {
      const mgr = SensorInputManager.getInstance();
      mgr.registerSensors([makeInstance('U1', 'LM35')]);
      expect(mgr.size).toBe(1);

      mgr.registerSensors([makeInstance('U2', 'DHT22')]);
      expect(mgr.size).toBe(1);
      expect(mgr.getSensor('U1')).toBeUndefined();
      expect(mgr.getSensor('U2')).toBeDefined();
    });

    it('handles empty instance list', () => {
      const mgr = SensorInputManager.getInstance();
      mgr.registerSensors([]);
      expect(mgr.size).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Subscribe / notify
  // -------------------------------------------------------------------------

  describe('subscribe', () => {
    it('notifies listeners on registerSensors', () => {
      const mgr = SensorInputManager.getInstance();
      let callCount = 0;
      mgr.subscribe(() => { callCount++; });
      mgr.registerSensors([makeInstance('U1', 'LM35')]);
      expect(callCount).toBe(1);
    });

    it('notifies listeners on setEnvironmentalValue', () => {
      const mgr = SensorInputManager.getInstance();
      mgr.registerSensors([makeInstance('U1', 'LM35')]);
      let callCount = 0;
      mgr.subscribe(() => { callCount++; });
      mgr.setEnvironmentalValue('U1', 30);
      expect(callCount).toBe(1);
    });

    it('notifies on resetAll', () => {
      const mgr = SensorInputManager.getInstance();
      mgr.registerSensors([makeInstance('U1', 'LM35')]);
      let callCount = 0;
      mgr.subscribe(() => { callCount++; });
      mgr.resetAll();
      expect(callCount).toBe(1);
    });

    it('notifies on clear', () => {
      const mgr = SensorInputManager.getInstance();
      mgr.registerSensors([makeInstance('U1', 'LM35')]);
      let callCount = 0;
      mgr.subscribe(() => { callCount++; });
      mgr.clear();
      expect(callCount).toBe(1);
    });

    it('unsubscribe stops notifications', () => {
      const mgr = SensorInputManager.getInstance();
      let callCount = 0;
      const unsub = mgr.subscribe(() => { callCount++; });
      mgr.registerSensors([makeInstance('U1', 'LM35')]);
      expect(callCount).toBe(1);

      unsub();
      mgr.registerSensors([makeInstance('U2', 'DHT11')]);
      expect(callCount).toBe(1); // No additional call
    });
  });

  // -------------------------------------------------------------------------
  // getSnapshot
  // -------------------------------------------------------------------------

  describe('getSnapshot', () => {
    it('returns stable reference when no changes', () => {
      const mgr = SensorInputManager.getInstance();
      mgr.registerSensors([makeInstance('U1', 'LM35')]);
      const snap1 = mgr.getSnapshot();
      const snap2 = mgr.getSnapshot();
      expect(snap1).toBe(snap2);
    });

    it('returns new reference after mutation', () => {
      const mgr = SensorInputManager.getInstance();
      mgr.registerSensors([makeInstance('U1', 'LM35')]);
      const snap1 = mgr.getSnapshot();
      mgr.setEnvironmentalValue('U1', 30);
      const snap2 = mgr.getSnapshot();
      expect(snap1).not.toBe(snap2);
    });

    it('snapshot contains all sensors', () => {
      const mgr = SensorInputManager.getInstance();
      mgr.registerSensors([
        makeInstance('U1', 'LM35'),
        makeInstance('U2', 'DHT22'),
      ]);
      const snap = mgr.getSnapshot();
      expect(snap.sensors).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // setEnvironmentalValue
  // -------------------------------------------------------------------------

  describe('setEnvironmentalValue', () => {
    it('updates the current value', () => {
      const mgr = SensorInputManager.getInstance();
      mgr.registerSensors([makeInstance('U1', 'LM35')]);
      mgr.setEnvironmentalValue('U1', 42);
      expect(mgr.getSensor('U1')?.currentValue).toBe(42);
    });

    it('clamps to min', () => {
      const mgr = SensorInputManager.getInstance();
      mgr.registerSensors([makeInstance('U1', 'LM35')]);
      // LM35 min is -55
      mgr.setEnvironmentalValue('U1', -100);
      expect(mgr.getSensor('U1')?.currentValue).toBe(-55);
    });

    it('clamps to max', () => {
      const mgr = SensorInputManager.getInstance();
      mgr.registerSensors([makeInstance('U1', 'LM35')]);
      // LM35 max is 150
      mgr.setEnvironmentalValue('U1', 200);
      expect(mgr.getSensor('U1')?.currentValue).toBe(150);
    });

    it('ignores unknown sensor ids', () => {
      const mgr = SensorInputManager.getInstance();
      mgr.registerSensors([makeInstance('U1', 'LM35')]);
      // Should not throw
      mgr.setEnvironmentalValue('UNKNOWN', 42);
      expect(mgr.size).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // getVoltage / getAdcValue
  // -------------------------------------------------------------------------

  describe('getVoltage', () => {
    it('returns 0 for unknown sensor', () => {
      const mgr = SensorInputManager.getInstance();
      expect(mgr.getVoltage('UNKNOWN')).toBe(0);
    });

    it('returns voltage for LM35 at 25°C', () => {
      const mgr = SensorInputManager.getInstance();
      mgr.registerSensors([makeInstance('U1', 'LM35')]);
      mgr.setEnvironmentalValue('U1', 25);
      // LM35: 10mV/°C → 0.25V at 25°C
      expect(mgr.getVoltage('U1')).toBeCloseTo(0.25, 3);
    });

    it('returns voltage for NTC at 25°C', () => {
      const mgr = SensorInputManager.getInstance();
      mgr.registerSensors([makeInstance('R1', 'NTC')]);
      mgr.setEnvironmentalValue('R1', 25);
      // NTC at 25°C: R = R0 = 10kΩ, Vdiv = 5 * 10k/(10k+10k) = 2.5V
      expect(mgr.getVoltage('R1')).toBeCloseTo(2.5, 1);
    });
  });

  describe('getAdcValue', () => {
    it('returns 0 for unknown sensor', () => {
      const mgr = SensorInputManager.getInstance();
      expect(mgr.getAdcValue('UNKNOWN')).toBe(0);
    });

    it('returns ADC for potentiometer at 50%', () => {
      const mgr = SensorInputManager.getInstance();
      mgr.registerSensors([makeInstance('R1', 'potentiometer')]);
      mgr.setEnvironmentalValue('R1', 50);
      // Pot at 50%: Vout = 2.5V, ADC(10bit) = 2.5/5 * 1023 ≈ 512
      expect(mgr.getAdcValue('R1')).toBe(512);
    });

    it('returns ADC with custom resolution', () => {
      const mgr = SensorInputManager.getInstance();
      mgr.registerSensors([makeInstance('R1', 'potentiometer')]);
      mgr.setEnvironmentalValue('R1', 100);
      // Pot at 100%: Vout = 5V, ADC(12bit) = 5/5 * 4095 = 4095
      expect(mgr.getAdcValue('R1', 12)).toBe(4095);
    });

    it('returns ADC with custom vRef', () => {
      const mgr = SensorInputManager.getInstance();
      mgr.registerSensors([makeInstance('R1', 'potentiometer')]);
      mgr.setEnvironmentalValue('R1', 50);
      // Pot at 50%: Vout = 2.5V, with vRef=3.3V → ADC = 2.5/3.3 * 1023 ≈ 775
      expect(mgr.getAdcValue('R1', 10, 3.3)).toBe(775);
    });
  });

  // -------------------------------------------------------------------------
  // resetAll / clear
  // -------------------------------------------------------------------------

  describe('resetAll', () => {
    it('resets all sensors to default values', () => {
      const mgr = SensorInputManager.getInstance();
      mgr.registerSensors([
        makeInstance('U1', 'LM35'),
        makeInstance('R1', 'potentiometer'),
      ]);
      mgr.setEnvironmentalValue('U1', 100);
      mgr.setEnvironmentalValue('R1', 90);

      mgr.resetAll();
      // LM35 default is 25, pot default is 50
      expect(mgr.getSensor('U1')?.currentValue).toBe(25);
      expect(mgr.getSensor('R1')?.currentValue).toBe(50);
    });
  });

  describe('clear', () => {
    it('removes all sensors', () => {
      const mgr = SensorInputManager.getInstance();
      mgr.registerSensors([makeInstance('U1', 'LM35')]);
      mgr.clear();
      expect(mgr.size).toBe(0);
      expect(mgr.getSnapshot().sensors).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// Voltage calculations — per sensor type
// ---------------------------------------------------------------------------

describe('Sensor voltage functions', () => {
  describe('LM35', () => {
    const lm35 = SENSOR_TYPES.get('lm35')!;

    it('0°C → 0V', () => {
      expect(lm35.voltageFunction(0)).toBeCloseTo(0, 3);
    });

    it('25°C → 0.25V', () => {
      expect(lm35.voltageFunction(25)).toBeCloseTo(0.25, 3);
    });

    it('100°C → 1.0V', () => {
      expect(lm35.voltageFunction(100)).toBeCloseTo(1.0, 3);
    });

    it('-40°C → -0.4V (negative output)', () => {
      expect(lm35.voltageFunction(-40)).toBeCloseTo(-0.4, 3);
    });
  });

  describe('NTC 10K', () => {
    const ntc = SENSOR_TYPES.get('ntc_10k')!;

    it('25°C → ~2.5V (R = R0, equal divider)', () => {
      expect(ntc.voltageFunction(25)).toBeCloseTo(2.5, 1);
    });

    it('high temperature → lower resistance → lower voltage', () => {
      const v100 = ntc.voltageFunction(100);
      const v25 = ntc.voltageFunction(25);
      expect(v100).toBeLessThan(v25);
    });

    it('low temperature → higher resistance → higher voltage', () => {
      const vNeg20 = ntc.voltageFunction(-20);
      const v25 = ntc.voltageFunction(25);
      expect(vNeg20).toBeGreaterThan(v25);
    });

    it('voltage stays within 0-5V for all temps', () => {
      for (let t = -40; t <= 125; t += 5) {
        const v = ntc.voltageFunction(t);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(5);
      }
    });
  });

  describe('LDR', () => {
    const ldr = SENSOR_TYPES.get('ldr')!;

    it('high light → low resistance → low voltage', () => {
      const v10k = ldr.voltageFunction(10_000);
      expect(v10k).toBeLessThan(1.0);
    });

    it('low light → high resistance → high voltage', () => {
      const v1 = ldr.voltageFunction(1);
      expect(v1).toBeGreaterThan(3.0);
    });

    it('voltage stays within 0-5V', () => {
      for (const lux of [0.1, 1, 10, 100, 1000, 10_000, 100_000]) {
        const v = ldr.voltageFunction(lux);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(5);
      }
    });
  });

  describe('Photodiode', () => {
    const pd = SENSOR_TYPES.get('photodiode')!;

    it('0 lux → 0V', () => {
      expect(pd.voltageFunction(0)).toBeCloseTo(0, 3);
    });

    it('linear: 1000 lux → 0.1V', () => {
      expect(pd.voltageFunction(1000)).toBeCloseTo(0.1, 3);
    });

    it('clamped at 5V', () => {
      expect(pd.voltageFunction(100_000)).toBeLessThanOrEqual(5.0);
    });
  });

  describe('HC-SR04', () => {
    const hcsr = SENSOR_TYPES.get('hc_sr04')!;

    it('2cm (min) → low voltage', () => {
      const v = hcsr.voltageFunction(2);
      expect(v).toBeCloseTo(2 / 400 * 5.0, 2);
    });

    it('400cm (max) → 5V', () => {
      expect(hcsr.voltageFunction(400)).toBeCloseTo(5.0, 2);
    });

    it('200cm → 2.5V', () => {
      expect(hcsr.voltageFunction(200)).toBeCloseTo(2.5, 2);
    });
  });

  describe('Potentiometer', () => {
    const pot = SENSOR_TYPES.get('potentiometer')!;

    it('0% → 0V', () => {
      expect(pot.voltageFunction(0)).toBeCloseTo(0, 3);
    });

    it('50% → 2.5V', () => {
      expect(pot.voltageFunction(50)).toBeCloseTo(2.5, 3);
    });

    it('100% → 5V', () => {
      expect(pot.voltageFunction(100)).toBeCloseTo(5.0, 3);
    });
  });

  describe('DHT11', () => {
    const dht11 = SENSOR_TYPES.get('dht11')!;

    it('50% RH → 1.5V (30mV per %RH)', () => {
      expect(dht11.voltageFunction(50)).toBeCloseTo(1.5, 2);
    });

    it('clamps below 20% RH', () => {
      expect(dht11.voltageFunction(10)).toBeCloseTo(20 * 0.03, 3);
    });
  });

  describe('DHT22', () => {
    const dht22 = SENSOR_TYPES.get('dht22')!;

    it('0% RH → 0V', () => {
      expect(dht22.voltageFunction(0)).toBeCloseTo(0, 3);
    });

    it('100% RH → 3.0V', () => {
      expect(dht22.voltageFunction(100)).toBeCloseTo(3.0, 3);
    });
  });

  describe('BMP280', () => {
    const bmp = SENSOR_TYPES.get('bmp280')!;

    it('300 hPa → 0.5V', () => {
      expect(bmp.voltageFunction(300)).toBeCloseTo(0.5, 2);
    });

    it('1100 hPa → 4.5V', () => {
      expect(bmp.voltageFunction(1100)).toBeCloseTo(4.5, 2);
    });

    it('1013.25 hPa (sea level) → ~4.06V', () => {
      const v = bmp.voltageFunction(1013.25);
      expect(v).toBeGreaterThan(3.5);
      expect(v).toBeLessThan(4.5);
    });
  });
});

// ---------------------------------------------------------------------------
// ADC conversion accuracy
// ---------------------------------------------------------------------------

describe('ADC conversion', () => {
  it('0V → ADC 0 (any sensor)', () => {
    const pot = SENSOR_TYPES.get('potentiometer')!;
    expect(pot.adcFunction(0)).toBe(0);
  });

  it('5V → ADC 1023 (10-bit)', () => {
    const pot = SENSOR_TYPES.get('potentiometer')!;
    expect(pot.adcFunction(100, 10)).toBe(1023);
  });

  it('5V → ADC 4095 (12-bit)', () => {
    const pot = SENSOR_TYPES.get('potentiometer')!;
    expect(pot.adcFunction(100, 12)).toBe(4095);
  });

  it('5V → ADC 255 (8-bit)', () => {
    const pot = SENSOR_TYPES.get('potentiometer')!;
    expect(pot.adcFunction(100, 8)).toBe(255);
  });

  it('2.5V → ADC ~512 (10-bit, 5V ref)', () => {
    const pot = SENSOR_TYPES.get('potentiometer')!;
    expect(pot.adcFunction(50, 10, 5.0)).toBe(512);
  });

  it('LM35 at 25°C with 3.3V ref → ~78 (10-bit)', () => {
    const lm35 = SENSOR_TYPES.get('lm35')!;
    // 0.25V / 3.3V * 1023 ≈ 77.5
    const adc = lm35.adcFunction(25, 10, 3.3);
    expect(adc).toBeGreaterThanOrEqual(77);
    expect(adc).toBeLessThanOrEqual(78);
  });

  it('voltage above vRef clamps to max ADC', () => {
    const pot = SENSOR_TYPES.get('potentiometer')!;
    // 100% pot = 5V, but vRef = 3.3V → clamped to 3.3V → ADC = 1023
    expect(pot.adcFunction(100, 10, 3.3)).toBe(1023);
  });
});

// ---------------------------------------------------------------------------
// detectSensors
// ---------------------------------------------------------------------------

describe('detectSensors', () => {
  it('returns empty array for no instances', () => {
    expect(detectSensors([])).toEqual([]);
  });

  it('returns empty for non-sensor components', () => {
    const instances = [
      makeInstance('R1', 'resistor'),
      makeInstance('C1', 'capacitor'),
      makeInstance('U1', 'mcu'),
    ];
    expect(detectSensors(instances)).toEqual([]);
  });

  it('detects NTC thermistor', () => {
    const sensors = detectSensors([makeInstance('R1', 'NTC thermistor')]);
    expect(sensors).toHaveLength(1);
    expect(sensors[0].type.family).toBe('ntc_10k');
  });

  it('detects LM35', () => {
    const sensors = detectSensors([makeInstance('U1', 'LM35')]);
    expect(sensors).toHaveLength(1);
    expect(sensors[0].type.family).toBe('lm35');
  });

  it('detects LDR / photoresistor', () => {
    const sensors1 = detectSensors([makeInstance('R1', 'LDR')]);
    expect(sensors1[0].type.family).toBe('ldr');

    const sensors2 = detectSensors([makeInstance('R1', 'photo resistor')]);
    expect(sensors2[0].type.family).toBe('ldr');
  });

  it('detects photodiode', () => {
    const sensors = detectSensors([makeInstance('D1', 'photodiode')]);
    expect(sensors).toHaveLength(1);
    expect(sensors[0].type.family).toBe('photodiode');
  });

  it('detects HC-SR04', () => {
    const sensors = detectSensors([makeInstance('U1', 'HC-SR04')]);
    expect(sensors).toHaveLength(1);
    expect(sensors[0].type.family).toBe('hc_sr04');
  });

  it('detects ultrasonic (alias for HC-SR04)', () => {
    const sensors = detectSensors([makeInstance('U1', 'ultrasonic sensor')]);
    expect(sensors).toHaveLength(1);
    expect(sensors[0].type.family).toBe('hc_sr04');
  });

  it('detects potentiometer', () => {
    const sensors = detectSensors([makeInstance('R1', 'potentiometer')]);
    expect(sensors).toHaveLength(1);
    expect(sensors[0].type.family).toBe('potentiometer');
  });

  it('detects pot (short alias)', () => {
    const sensors = detectSensors([makeInstance('R1', 'pot')]);
    expect(sensors).toHaveLength(1);
    expect(sensors[0].type.family).toBe('potentiometer');
  });

  it('detects DHT11', () => {
    const sensors = detectSensors([makeInstance('U1', 'DHT11')]);
    expect(sensors).toHaveLength(1);
    expect(sensors[0].type.family).toBe('dht11');
  });

  it('detects DHT22 / AM2302', () => {
    const sensors1 = detectSensors([makeInstance('U1', 'DHT22')]);
    expect(sensors1[0].type.family).toBe('dht22');

    const sensors2 = detectSensors([makeInstance('U1', 'AM2302')]);
    expect(sensors2[0].type.family).toBe('dht22');
  });

  it('detects BMP280', () => {
    const sensors = detectSensors([makeInstance('U1', 'BMP280')]);
    expect(sensors).toHaveLength(1);
    expect(sensors[0].type.family).toBe('bmp280');
  });

  it('detects sensor from name property', () => {
    const sensors = detectSensors([{
      referenceDesignator: 'U1',
      properties: { componentType: 'sensor', name: 'BMP280 Breakout' },
    }]);
    expect(sensors).toHaveLength(1);
    expect(sensors[0].type.family).toBe('bmp280');
  });

  it('handles null properties gracefully', () => {
    const sensors = detectSensors([{
      referenceDesignator: 'U1',
      properties: null,
    }]);
    expect(sensors).toEqual([]);
  });

  it('initializes sensors with default values', () => {
    const sensors = detectSensors([makeInstance('U1', 'LM35')]);
    expect(sensors[0].currentValue).toBe(25); // LM35 default
  });

  it('sorts results by reference designator', () => {
    const sensors = detectSensors([
      makeInstance('U3', 'DHT22'),
      makeInstance('R1', 'NTC'),
      makeInstance('U1', 'LM35'),
    ]);
    expect(sensors.map((s) => s.id)).toEqual(['R1', 'U1', 'U3']);
  });

  it('detects multiple sensors of different types', () => {
    const sensors = detectSensors([
      makeInstance('R1', 'NTC'),
      makeInstance('U1', 'LM35'),
      makeInstance('R2', 'LDR'),
      makeInstance('U2', 'HC-SR04'),
      makeInstance('R3', 'potentiometer'),
      makeInstance('U3', 'DHT22'),
      makeInstance('U4', 'BMP280'),
    ]);
    expect(sensors).toHaveLength(7);

    const families = sensors.map((s) => s.type.family);
    expect(families).toContain('ntc_10k');
    expect(families).toContain('lm35');
    expect(families).toContain('ldr');
    expect(families).toContain('hc_sr04');
    expect(families).toContain('potentiometer');
    expect(families).toContain('dht22');
    expect(families).toContain('bmp280');
  });
});

// ---------------------------------------------------------------------------
// SENSOR_TYPES registry
// ---------------------------------------------------------------------------

describe('SENSOR_TYPES registry', () => {
  const expectedFamilies: SensorFamily[] = [
    'ntc_10k', 'lm35', 'ldr', 'photodiode', 'hc_sr04',
    'potentiometer', 'dht11', 'dht22', 'bmp280',
  ];

  it('contains all 9 sensor types', () => {
    expect(SENSOR_TYPES.size).toBe(9);
  });

  it.each(expectedFamilies)('has definition for %s', (family) => {
    const def = SENSOR_TYPES.get(family);
    expect(def).toBeDefined();
    expect(def!.family).toBe(family);
    expect(def!.name).toBeTruthy();
    expect(def!.unit).toBeTruthy();
    expect(def!.min).toBeLessThan(def!.max);
    expect(def!.defaultValue).toBeGreaterThanOrEqual(def!.min);
    expect(def!.defaultValue).toBeLessThanOrEqual(def!.max);
    expect(typeof def!.voltageFunction).toBe('function');
    expect(typeof def!.adcFunction).toBe('function');
  });

  it.each(expectedFamilies)('%s voltageFunction returns a finite number at default', (family) => {
    const def = SENSOR_TYPES.get(family)!;
    const v = def.voltageFunction(def.defaultValue);
    expect(Number.isFinite(v)).toBe(true);
  });

  it.each(expectedFamilies)('%s adcFunction returns an integer at default', (family) => {
    const def = SENSOR_TYPES.get(family)!;
    const adc = def.adcFunction(def.defaultValue);
    expect(Number.isInteger(adc)).toBe(true);
    expect(adc).toBeGreaterThanOrEqual(0);
    expect(adc).toBeLessThanOrEqual(1023);
  });
});

// ---------------------------------------------------------------------------
// HC-SR04 utility functions
// ---------------------------------------------------------------------------

describe('HC-SR04 utilities', () => {
  it('hcSr04EchoTime at 100cm', () => {
    // duration = 100 * 2 / 0.0343 ≈ 5831 µs
    const echoTime = hcSr04EchoTime(100);
    expect(echoTime).toBeCloseTo(5831, -1);
  });

  it('hcSr04Distance round-trips with echoTime', () => {
    const dist = 75;
    const echo = hcSr04EchoTime(dist);
    const recovered = hcSr04Distance(echo);
    expect(recovered).toBeCloseTo(dist, 5);
  });

  it('hcSr04Distance at 0 echo → 0cm', () => {
    expect(hcSr04Distance(0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('Edge cases', () => {
  beforeEach(() => {
    SensorInputManager.resetInstance();
  });

  it('getVoltage at min value returns finite number', () => {
    for (const [, def] of Array.from(SENSOR_TYPES.entries())) {
      const v = def.voltageFunction(def.min);
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('getVoltage at max value returns finite number', () => {
    for (const [, def] of Array.from(SENSOR_TYPES.entries())) {
      const v = def.voltageFunction(def.max);
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('ADC at min value returns non-negative integer', () => {
    for (const [, def] of Array.from(SENSOR_TYPES.entries())) {
      const adc = def.adcFunction(def.min);
      expect(Number.isInteger(adc)).toBe(true);
      expect(adc).toBeGreaterThanOrEqual(0);
    }
  });

  it('ADC at max value returns integer within range', () => {
    for (const [, def] of Array.from(SENSOR_TYPES.entries())) {
      const adc = def.adcFunction(def.max);
      expect(Number.isInteger(adc)).toBe(true);
      expect(adc).toBeLessThanOrEqual(1023);
    }
  });

  it('multiple subscribe/unsubscribe cycles work correctly', () => {
    const mgr = SensorInputManager.getInstance();
    mgr.registerSensors([makeInstance('U1', 'LM35')]);

    let count1 = 0;
    let count2 = 0;
    const unsub1 = mgr.subscribe(() => { count1++; });
    const unsub2 = mgr.subscribe(() => { count2++; });

    mgr.setEnvironmentalValue('U1', 30);
    expect(count1).toBe(1);
    expect(count2).toBe(1);

    unsub1();
    mgr.setEnvironmentalValue('U1', 40);
    expect(count1).toBe(1); // Unsubscribed
    expect(count2).toBe(2); // Still subscribed

    unsub2();
    mgr.setEnvironmentalValue('U1', 50);
    expect(count1).toBe(1);
    expect(count2).toBe(2);
  });

  it('getAllSensors returns a readonly map', () => {
    const mgr = SensorInputManager.getInstance();
    mgr.registerSensors([makeInstance('U1', 'LM35')]);
    const allSensors = mgr.getAllSensors();
    expect(allSensors.size).toBe(1);
    expect(allSensors.get('U1')).toBeDefined();
  });
});
