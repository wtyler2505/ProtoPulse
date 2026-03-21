import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  parseVoltage,
  parseCurrent,
  parsePower,
  detectVoltageMismatch,
  detectMissingDecoupling,
  detectUnprotectedIo,
  detectFloatingInputs,
  detectReversePolarity,
  detectOvercurrent,
  detectEsdExposure,
  detectMissingLevelShifter,
  detectPowerOverload,
  detectAdcReference,
  detectThermalRisk,
  detectBusContention,
  getSelfHealingAssistant,
  resetSelfHealingAssistant,
  resetIdCounter,
} from '../self-healing';
import type {
  AnalysisInstance,
  AnalysisNet,
  HazardType,
  HazardSeverity,
} from '../self-healing';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inst(
  refDes: string,
  label: string,
  props: Record<string, unknown> = {},
  connectedNets: string[] = [],
): AnalysisInstance {
  return { refDes, label, properties: props, connectedNets };
}

function net(name: string, netType = 'signal', voltage?: string): AnalysisNet {
  return { name, netType, voltage: voltage ?? undefined };
}

// ---------------------------------------------------------------------------
// parseVoltage
// ---------------------------------------------------------------------------

describe('parseVoltage', () => {
  it('parses "5V"', () => {
    expect(parseVoltage('5V')).toBe(5);
  });

  it('parses "3.3V"', () => {
    expect(parseVoltage('3.3V')).toBe(3.3);
  });

  it('parses "3V3" format', () => {
    expect(parseVoltage('3V3')).toBe(3.3);
  });

  it('parses "12"', () => {
    expect(parseVoltage('12')).toBe(12);
  });

  it('parses numeric input', () => {
    expect(parseVoltage(5)).toBe(5);
  });

  it('returns null for null/undefined', () => {
    expect(parseVoltage(null)).toBeNull();
    expect(parseVoltage(undefined)).toBeNull();
  });

  it('returns null for invalid strings', () => {
    expect(parseVoltage('abc')).toBeNull();
  });

  it('parses "1V8"', () => {
    expect(parseVoltage('1V8')).toBe(1.8);
  });
});

// ---------------------------------------------------------------------------
// parseCurrent
// ---------------------------------------------------------------------------

describe('parseCurrent', () => {
  it('parses "20mA"', () => {
    expect(parseCurrent('20mA')).toBe(20);
  });

  it('parses "1.5A" → 1500 mA', () => {
    expect(parseCurrent('1.5A')).toBe(1500);
  });

  it('parses plain number as mA', () => {
    expect(parseCurrent('100')).toBe(100);
  });

  it('parses numeric input as mA', () => {
    expect(parseCurrent(50)).toBe(50);
  });

  it('returns null for null/undefined', () => {
    expect(parseCurrent(null)).toBeNull();
    expect(parseCurrent(undefined)).toBeNull();
  });

  it('returns null for invalid strings', () => {
    expect(parseCurrent('abc')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parsePower
// ---------------------------------------------------------------------------

describe('parsePower', () => {
  it('parses "0.5W"', () => {
    expect(parsePower('0.5W')).toBe(0.5);
  });

  it('parses "250mW" → 0.25W', () => {
    expect(parsePower('250mW')).toBe(0.25);
  });

  it('parses plain number as watts', () => {
    expect(parsePower('1.5')).toBe(1.5);
  });

  it('parses numeric input', () => {
    expect(parsePower(2.0)).toBe(2.0);
  });

  it('returns null for null/undefined', () => {
    expect(parsePower(null)).toBeNull();
    expect(parsePower(undefined)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// detectVoltageMismatch
// ---------------------------------------------------------------------------

describe('detectVoltageMismatch', () => {
  beforeEach(() => { resetIdCounter(); });

  it('detects when component Vmax < rail voltage', () => {
    const instances = [inst('U1', 'IC', { vmax: '3.3V' }, ['VCC_5V'])];
    const nets = [net('VCC_5V', 'power', '5V')];
    const hazards = detectVoltageMismatch(instances, nets);
    expect(hazards.length).toBe(1);
    expect(hazards[0].type).toBe('voltage_mismatch');
    expect(hazards[0].severity).toBe('critical');
    expect(hazards[0].affectedRefs).toContain('U1');
  });

  it('no hazard when Vmax >= rail voltage', () => {
    const instances = [inst('U1', 'IC', { vmax: '5V' }, ['VCC_5V'])];
    const nets = [net('VCC_5V', 'power', '5V')];
    expect(detectVoltageMismatch(instances, nets)).toEqual([]);
  });

  it('skips components without Vmax', () => {
    const instances = [inst('U1', 'IC', {}, ['VCC_5V'])];
    const nets = [net('VCC_5V', 'power', '5V')];
    expect(detectVoltageMismatch(instances, nets)).toEqual([]);
  });

  it('uses maxVoltage property as fallback', () => {
    const instances = [inst('U1', 'IC', { maxVoltage: '3V' }, ['VCC_5V'])];
    const nets = [net('VCC_5V', 'power', '5V')];
    const hazards = detectVoltageMismatch(instances, nets);
    expect(hazards.length).toBe(1);
  });

  it('provides fix proposal', () => {
    const instances = [inst('U1', 'IC', { vmax: '3.3V' }, ['VCC_5V'])];
    const nets = [net('VCC_5V', 'power', '5V')];
    const hazards = detectVoltageMismatch(instances, nets);
    expect(hazards[0].fix).not.toBeNull();
    expect(hazards[0].fix?.status).toBe('pending');
    expect(hazards[0].fix?.components.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// detectMissingDecoupling
// ---------------------------------------------------------------------------

describe('detectMissingDecoupling', () => {
  beforeEach(() => { resetIdCounter(); });

  it('detects IC without decoupling cap', () => {
    const instances = [inst('U1', 'ATmega328', {}, ['VCC', 'GND', 'D0'])];
    const nets = [net('VCC', 'power', '5V'), net('GND', 'power', '0V')];
    const hazards = detectMissingDecoupling(instances, nets);
    expect(hazards.length).toBe(1);
    expect(hazards[0].type).toBe('missing_decoupling');
    expect(hazards[0].severity).toBe('warning');
  });

  it('no hazard when cap shares power net', () => {
    const instances = [
      inst('U1', 'ATmega328', {}, ['VCC', 'GND']),
      inst('C1', '100nF', {}, ['VCC', 'GND']),
    ];
    const nets = [net('VCC', 'power', '5V'), net('GND', 'power', '0V')];
    expect(detectMissingDecoupling(instances, nets)).toEqual([]);
  });

  it('skips non-IC components', () => {
    const instances = [inst('R1', 'Resistor', {}, ['VCC'])];
    const nets = [net('VCC', 'power', '5V')];
    expect(detectMissingDecoupling(instances, nets)).toEqual([]);
  });

  it('provides fix with bypass cap component', () => {
    const instances = [inst('U1', 'ESP32', {}, ['VCC_3V3'])];
    const nets = [net('VCC_3V3', 'power', '3.3V')];
    const hazards = detectMissingDecoupling(instances, nets);
    expect(hazards[0].fix?.components[0].description).toContain('100nF');
  });

  it('no hazard when IC has no power nets', () => {
    const instances = [inst('U1', 'Arduino Nano', {}, ['D0', 'D1'])];
    const nets = [net('D0', 'signal'), net('D1', 'signal')];
    expect(detectMissingDecoupling(instances, nets)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// detectUnprotectedIo
// ---------------------------------------------------------------------------

describe('detectUnprotectedIo', () => {
  beforeEach(() => { resetIdCounter(); });

  it('detects connector → IC without series resistor', () => {
    const instances = [
      inst('J1', 'USB Connector', {}, ['DATA_LINE']),
      inst('U1', 'MCU', {}, ['DATA_LINE', 'VCC']),
    ];
    const nets = [net('DATA_LINE', 'signal'), net('VCC', 'power', '5V')];
    const hazards = detectUnprotectedIo(instances, nets);
    expect(hazards.length).toBe(1);
    expect(hazards[0].type).toBe('unprotected_io');
  });

  it('no hazard when series resistor exists', () => {
    const instances = [
      inst('J1', 'USB Connector', {}, ['DATA_LINE']),
      inst('U1', 'MCU', {}, ['DATA_LINE', 'VCC']),
      inst('R1', '220R', {}, ['DATA_LINE']),
    ];
    const nets = [net('DATA_LINE', 'signal'), net('VCC', 'power', '5V')];
    expect(detectUnprotectedIo(instances, nets)).toEqual([]);
  });

  it('no hazard when protection diode exists', () => {
    const instances = [
      inst('J1', 'USB Connector', {}, ['DATA_LINE']),
      inst('U1', 'MCU', {}, ['DATA_LINE']),
      inst('D1', 'TVS diode', {}, ['DATA_LINE', 'GND']),
    ];
    const nets = [net('DATA_LINE', 'signal')];
    expect(detectUnprotectedIo(instances, nets)).toEqual([]);
  });

  it('skips power nets', () => {
    const instances = [
      inst('J1', 'Power Jack', {}, ['VCC']),
      inst('U1', 'MCU', {}, ['VCC']),
    ];
    const nets = [net('VCC', 'power', '5V')];
    expect(detectUnprotectedIo(instances, nets)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// detectFloatingInputs
// ---------------------------------------------------------------------------

describe('detectFloatingInputs', () => {
  beforeEach(() => { resetIdCounter(); });

  it('detects input without pull-up/pull-down', () => {
    const instances = [
      inst('U1', 'MCU', { inputPins: ['BUTTON_NET'] }, ['BUTTON_NET', 'VCC']),
    ];
    const nets = [net('BUTTON_NET', 'signal'), net('VCC', 'power', '5V')];
    const hazards = detectFloatingInputs(instances, nets);
    expect(hazards.length).toBe(1);
    expect(hazards[0].type).toBe('floating_input');
  });

  it('no hazard when pull-up resistor exists', () => {
    const instances = [
      inst('U1', 'MCU', { inputPins: ['BUTTON_NET'] }, ['BUTTON_NET', 'VCC']),
      inst('R1', '10K', {}, ['BUTTON_NET', 'VCC']),
    ];
    const nets = [net('BUTTON_NET', 'signal'), net('VCC', 'power', '5V')];
    expect(detectFloatingInputs(instances, nets)).toEqual([]);
  });

  it('skips components without inputPins property', () => {
    const instances = [inst('U1', 'MCU', {}, ['BUTTON_NET'])];
    const nets = [net('BUTTON_NET', 'signal')];
    expect(detectFloatingInputs(instances, nets)).toEqual([]);
  });

  it('provides fix proposal with pull-up resistor', () => {
    const instances = [
      inst('U1', 'MCU', { inputPins: ['RESET'] }, ['RESET', 'VCC']),
    ];
    const nets = [net('RESET', 'signal'), net('VCC', 'power', '5V')];
    const hazards = detectFloatingInputs(instances, nets);
    expect(hazards[0].fix?.components[0].description).toContain('10K');
  });
});

// ---------------------------------------------------------------------------
// detectReversePolarity
// ---------------------------------------------------------------------------

describe('detectReversePolarity', () => {
  beforeEach(() => { resetIdCounter(); });

  it('detects power connector without protection', () => {
    const instances = [inst('J1', 'DC Jack', {}, ['VIN'])];
    const nets = [net('VIN', 'power', '12V')];
    const hazards = detectReversePolarity(instances, nets);
    expect(hazards.length).toBe(1);
    expect(hazards[0].type).toBe('reverse_polarity');
  });

  it('no hazard when Schottky diode exists', () => {
    const instances = [
      inst('J1', 'DC Jack', {}, ['VIN']),
      inst('D1', 'Schottky protection', {}, ['VIN', 'VCC']),
    ];
    const nets = [net('VIN', 'power', '12V')];
    expect(detectReversePolarity(instances, nets)).toEqual([]);
  });

  it('skips non-power connectors', () => {
    const instances = [inst('J1', 'USB Connector', {}, ['DATA'])];
    const nets = [net('DATA', 'signal')];
    expect(detectReversePolarity(instances, nets)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// detectOvercurrent
// ---------------------------------------------------------------------------

describe('detectOvercurrent', () => {
  beforeEach(() => { resetIdCounter(); });

  it('detects load exceeding max pin current', () => {
    const instances = [inst('MOT1', 'DC Motor', { current: '500mA' }, ['MOTOR_PIN'])];
    const hazards = detectOvercurrent(instances, [], 20);
    expect(hazards.length).toBe(1);
    expect(hazards[0].type).toBe('overcurrent');
    expect(hazards[0].severity).toBe('critical');
  });

  it('no hazard when current within limits', () => {
    const instances = [inst('LED1', 'LED', { current: '15mA' }, ['LED_PIN'])];
    expect(detectOvercurrent(instances, [], 20)).toEqual([]);
  });

  it('uses loadCurrent property', () => {
    const instances = [inst('M1', 'Servo', { loadCurrent: '200mA' }, ['SERVO'])];
    const hazards = detectOvercurrent(instances, [], 40);
    expect(hazards.length).toBe(1);
  });

  it('skips components without current spec', () => {
    const instances = [inst('R1', 'Resistor', {}, ['NET1'])];
    expect(detectOvercurrent(instances, [], 20)).toEqual([]);
  });

  it('provides fix with MOSFET driver', () => {
    const instances = [inst('MOT1', 'Motor', { current: '1A' }, ['MOTOR'])];
    const hazards = detectOvercurrent(instances, [], 20);
    expect(hazards[0].fix?.components[0].description).toContain('MOSFET');
  });
});

// ---------------------------------------------------------------------------
// detectEsdExposure
// ---------------------------------------------------------------------------

describe('detectEsdExposure', () => {
  beforeEach(() => { resetIdCounter(); });

  it('detects connector signal lines without ESD protection', () => {
    const instances = [inst('J1', 'USB Header', {}, ['D+', 'D-'])];
    const nets = [net('D+', 'signal'), net('D-', 'signal')];
    const hazards = detectEsdExposure(instances, nets);
    expect(hazards.length).toBe(1);
    expect(hazards[0].type).toBe('esd_exposure');
    expect(hazards[0].severity).toBe('info');
  });

  it('no hazard when TVS diode exists', () => {
    const instances = [
      inst('J1', 'USB Header', {}, ['D+', 'D-']),
      inst('D1', 'ESD protection array', {}, ['D+', 'D-', 'GND']),
    ];
    const nets = [net('D+', 'signal'), net('D-', 'signal')];
    expect(detectEsdExposure(instances, nets)).toEqual([]);
  });

  it('skips connectors with only power nets', () => {
    const instances = [inst('J1', 'Power Jack', {}, ['VCC'])];
    const nets = [net('VCC', 'power', '5V')];
    expect(detectEsdExposure(instances, nets)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// detectMissingLevelShifter
// ---------------------------------------------------------------------------

describe('detectMissingLevelShifter', () => {
  beforeEach(() => { resetIdCounter(); });

  it('detects voltage mismatch between ICs on same signal net', () => {
    const instances = [
      inst('U1', 'Arduino (5V MCU)', { voltage: '5V' }, ['SDA', 'VCC_5V']),
      inst('U2', 'BME280 Sensor (3.3V)', { voltage: '3.3V' }, ['SDA', 'VCC_3V3']),
    ];
    const nets = [
      net('SDA', 'signal'),
      net('VCC_5V', 'power', '5V'),
      net('VCC_3V3', 'power', '3.3V'),
    ];
    const hazards = detectMissingLevelShifter(instances, nets);
    expect(hazards.length).toBe(1);
    expect(hazards[0].type).toBe('missing_level_shifter');
  });

  it('no hazard when level shifter exists', () => {
    const instances = [
      inst('U1', 'Arduino', { voltage: '5V' }, ['SDA']),
      inst('U2', 'BME280', { voltage: '3.3V' }, ['SDA']),
      inst('U3', 'TXS0108E Level Shifter', {}, ['SDA']),
    ];
    const nets = [net('SDA', 'signal')];
    const hazards = detectMissingLevelShifter(instances, nets);
    expect(hazards.length).toBe(0);
  });

  it('no hazard when ICs have same voltage', () => {
    const instances = [
      inst('U1', 'MCU', { voltage: '3.3V' }, ['SDA']),
      inst('U2', 'Sensor', { voltage: '3.3V' }, ['SDA']),
    ];
    const nets = [net('SDA', 'signal')];
    expect(detectMissingLevelShifter(instances, nets)).toEqual([]);
  });

  it('skips power nets', () => {
    const instances = [
      inst('U1', 'MCU', { voltage: '5V' }, ['VCC']),
      inst('U2', 'IC', { voltage: '3.3V' }, ['VCC']),
    ];
    const nets = [net('VCC', 'power', '5V')];
    expect(detectMissingLevelShifter(instances, nets)).toEqual([]);
  });

  it('detects voltage from connected power nets', () => {
    const instances = [
      inst('U1', 'Arduino', {}, ['SDA', 'VCC_5V']),
      inst('U2', 'Sensor', {}, ['SDA', 'VCC_3V3']),
    ];
    const nets = [
      net('SDA', 'signal'),
      net('VCC_5V', 'power', '5V'),
      net('VCC_3V3', 'power', '3.3V'),
    ];
    const hazards = detectMissingLevelShifter(instances, nets);
    expect(hazards.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// detectPowerOverload
// ---------------------------------------------------------------------------

describe('detectPowerOverload', () => {
  beforeEach(() => { resetIdCounter(); });

  it('detects total load exceeding regulator rating', () => {
    const instances = [
      inst('VR1', 'LM7805 Regulator', { maxCurrent: '500mA' }, ['VCC_5V']),
      inst('U1', 'MCU', { current: '200mA' }, ['VCC_5V']),
      inst('U2', 'Display', { current: '400mA' }, ['VCC_5V']),
    ];
    const nets = [net('VCC_5V', 'power', '5V')];
    const hazards = detectPowerOverload(instances, nets, 500);
    expect(hazards.length).toBe(1);
    expect(hazards[0].type).toBe('power_overload');
    expect(hazards[0].severity).toBe('critical');
  });

  it('no hazard when load within rating', () => {
    const instances = [
      inst('VR1', 'AMS1117 Regulator', { maxCurrent: '1000mA' }, ['VCC_3V3']),
      inst('U1', 'ESP32', { current: '300mA' }, ['VCC_3V3']),
    ];
    const nets = [net('VCC_3V3', 'power', '3.3V')];
    expect(detectPowerOverload(instances, nets, 1000)).toEqual([]);
  });

  it('uses default max current when not specified', () => {
    const instances = [
      inst('VR1', 'Voltage Regulator', {}, ['VCC']),
      inst('U1', 'MCU', { current: '600mA' }, ['VCC']),
    ];
    const nets = [net('VCC', 'power', '5V')];
    const hazards = detectPowerOverload(instances, nets, 500);
    expect(hazards.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// detectAdcReference
// ---------------------------------------------------------------------------

describe('detectAdcReference', () => {
  beforeEach(() => { resetIdCounter(); });

  it('detects ADC input exceeding reference voltage', () => {
    const instances = [
      inst('U1', 'MCU', { adcPins: ['SENSOR_OUT'] }, ['SENSOR_OUT', 'VCC']),
    ];
    const nets = [net('SENSOR_OUT', 'signal', '5V'), net('VCC', 'power', '3.3V')];
    const hazards = detectAdcReference(instances, nets, 3.3);
    expect(hazards.length).toBe(1);
    expect(hazards[0].type).toBe('adc_reference');
    expect(hazards[0].severity).toBe('critical');
  });

  it('no hazard when voltage within reference', () => {
    const instances = [
      inst('U1', 'MCU', { adcPins: ['SENSOR'] }, ['SENSOR']),
    ];
    const nets = [net('SENSOR', 'signal', '3V')];
    expect(detectAdcReference(instances, nets, 3.3)).toEqual([]);
  });

  it('provides fix with voltage divider', () => {
    const instances = [
      inst('U1', 'MCU', { adcPins: ['HV_SENSE'] }, ['HV_SENSE']),
    ];
    const nets = [net('HV_SENSE', 'signal', '12V')];
    const hazards = detectAdcReference(instances, nets, 3.3);
    expect(hazards[0].fix?.components.length).toBe(2);
    expect(hazards[0].fix?.components[0].description).toContain('divider');
  });

  it('skips ICs without adcPins', () => {
    const instances = [inst('U1', 'MCU', {}, ['SENSOR'])];
    const nets = [net('SENSOR', 'signal', '12V')];
    expect(detectAdcReference(instances, nets, 3.3)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// detectThermalRisk
// ---------------------------------------------------------------------------

describe('detectThermalRisk', () => {
  beforeEach(() => { resetIdCounter(); });

  it('detects high-power component without heatsink', () => {
    const instances = [inst('VR1', 'LM7805', { powerDissipation: '2W' }, ['VCC'])];
    const hazards = detectThermalRisk(instances, [], 0.5);
    expect(hazards.length).toBe(1);
    expect(hazards[0].type).toBe('thermal_risk');
    expect(hazards[0].severity).toBe('warning');
  });

  it('no hazard when dissipation below threshold', () => {
    const instances = [inst('R1', 'Resistor', { power: '0.25W' }, ['NET1'])];
    expect(detectThermalRisk(instances, [], 0.5)).toEqual([]);
  });

  it('no hazard when heatsink mentioned', () => {
    const instances = [inst('VR1', 'LM7805 with Heatsink', { power: '2W' }, ['VCC'])];
    expect(detectThermalRisk(instances, [], 0.5)).toEqual([]);
  });

  it('no hazard when heatsink property set', () => {
    const instances = [inst('VR1', 'LM7805', { power: '2W', heatsink: true }, ['VCC'])];
    expect(detectThermalRisk(instances, [], 0.5)).toEqual([]);
  });

  it('uses power property as fallback', () => {
    const instances = [inst('Q1', 'MOSFET', { power: '1.5W' }, ['DRAIN'])];
    const hazards = detectThermalRisk(instances, [], 0.5);
    expect(hazards.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// detectBusContention
// ---------------------------------------------------------------------------

describe('detectBusContention', () => {
  beforeEach(() => { resetIdCounter(); });

  it('detects multiple outputs driving same net', () => {
    const instances = [
      inst('U1', 'MCU A', { outputPins: ['DATA_BUS'] }, ['DATA_BUS']),
      inst('U2', 'MCU B', { outputPins: ['DATA_BUS'] }, ['DATA_BUS']),
    ];
    const nets = [net('DATA_BUS', 'signal')];
    const hazards = detectBusContention(instances, nets);
    expect(hazards.length).toBe(1);
    expect(hazards[0].type).toBe('bus_contention');
    expect(hazards[0].severity).toBe('critical');
  });

  it('no hazard with single output', () => {
    const instances = [
      inst('U1', 'MCU', { outputPins: ['TX'] }, ['TX']),
      inst('U2', 'UART', {}, ['TX']),
    ];
    const nets = [net('TX', 'signal')];
    expect(detectBusContention(instances, nets)).toEqual([]);
  });

  it('skips power nets', () => {
    const instances = [
      inst('U1', 'MCU', { outputPins: ['VCC'] }, ['VCC']),
      inst('U2', 'MCU', { outputPins: ['VCC'] }, ['VCC']),
    ];
    const nets = [net('VCC', 'power', '5V')];
    expect(detectBusContention(instances, nets)).toEqual([]);
  });

  it('provides fix with tri-state buffer', () => {
    const instances = [
      inst('U1', 'IC A', { outputPins: ['BUS'] }, ['BUS']),
      inst('U2', 'IC B', { outputPins: ['BUS'] }, ['BUS']),
    ];
    const nets = [net('BUS', 'signal')];
    const hazards = detectBusContention(instances, nets);
    expect(hazards[0].fix?.components[0].description).toContain('Tri-state');
  });
});

// ---------------------------------------------------------------------------
// SelfHealingAssistant
// ---------------------------------------------------------------------------

describe('SelfHealingAssistant', () => {
  beforeEach(() => {
    resetSelfHealingAssistant();
    resetIdCounter();
  });

  it('returns singleton instance', () => {
    const a = getSelfHealingAssistant();
    const b = getSelfHealingAssistant();
    expect(a).toBe(b);
  });

  it('resets singleton', () => {
    const a = getSelfHealingAssistant();
    resetSelfHealingAssistant();
    const b = getSelfHealingAssistant();
    expect(a).not.toBe(b);
  });

  describe('subscribe/notify', () => {
    it('notifies on scan', () => {
      const mgr = getSelfHealingAssistant();
      let called = 0;
      mgr.subscribe(() => { called++; });
      mgr.scan([], []);
      expect(called).toBe(1);
    });

    it('notifies on config update', () => {
      const mgr = getSelfHealingAssistant();
      let called = 0;
      mgr.subscribe(() => { called++; });
      mgr.updateConfig({ defaultMaxPinCurrentMa: 40 });
      expect(called).toBe(1);
    });

    it('notifies on reset', () => {
      const mgr = getSelfHealingAssistant();
      let called = 0;
      mgr.subscribe(() => { called++; });
      mgr.reset();
      expect(called).toBe(1);
    });

    it('unsubscribes correctly', () => {
      const mgr = getSelfHealingAssistant();
      let called = 0;
      const unsub = mgr.subscribe(() => { called++; });
      unsub();
      mgr.scan([], []);
      expect(called).toBe(0);
    });
  });

  describe('getSnapshot', () => {
    it('returns initial snapshot', () => {
      const snap = getSelfHealingAssistant().getSnapshot();
      expect(snap.hazards).toEqual([]);
      expect(snap.activeHazards).toEqual([]);
      expect(snap.pendingFixes).toEqual([]);
      expect(snap.lastScanAt).toBeNull();
    });

    it('reflects scan results', () => {
      const mgr = getSelfHealingAssistant();
      const instances = [inst('U1', 'ATmega328', {}, ['VCC'])];
      const nets = [net('VCC', 'power', '5V')];
      mgr.scan(instances, nets);
      const snap = mgr.getSnapshot();
      expect(snap.hazards.length).toBeGreaterThan(0);
      expect(snap.lastScanAt).not.toBeNull();
    });
  });

  describe('scan', () => {
    it('runs all enabled checks', () => {
      const mgr = getSelfHealingAssistant();
      const instances = [
        inst('U1', 'MCU', { vmax: '3.3V', inputPins: ['BTN'] }, ['VCC_5V', 'BTN']),
        inst('J1', 'USB Connector', {}, ['DATA', 'VCC_5V']),
        inst('MOT1', 'Motor', { current: '500mA' }, ['MOTOR_PIN']),
      ];
      const nets = [
        net('VCC_5V', 'power', '5V'),
        net('DATA', 'signal'),
        net('BTN', 'signal'),
        net('MOTOR_PIN', 'signal'),
      ];
      const hazards = mgr.scan(instances, nets);
      expect(hazards.length).toBeGreaterThan(0);
      const types = new Set(hazards.map((h) => h.type));
      expect(types.size).toBeGreaterThan(1);
    });

    it('respects disabled checks', () => {
      const mgr = getSelfHealingAssistant();
      mgr.updateConfig({
        enabledChecks: {
          voltage_mismatch: false,
          missing_decoupling: false,
          unprotected_io: false,
          floating_input: false,
          reverse_polarity: false,
          overcurrent: false,
          esd_exposure: false,
          missing_level_shifter: false,
          power_overload: false,
          adc_reference: false,
          thermal_risk: false,
          bus_contention: false,
        },
      });
      const instances = [inst('U1', 'MCU', { vmax: '3.3V' }, ['VCC_5V'])];
      const nets = [net('VCC_5V', 'power', '5V')];
      const hazards = mgr.scan(instances, nets);
      expect(hazards.length).toBe(0);
    });

    it('returns empty for empty circuit', () => {
      const mgr = getSelfHealingAssistant();
      expect(mgr.scan([], [])).toEqual([]);
    });
  });

  describe('approval gates', () => {
    it('approves a pending fix', () => {
      const mgr = getSelfHealingAssistant();
      const instances = [inst('U1', 'IC', { vmax: '3.3V' }, ['VCC_5V'])];
      const nets = [net('VCC_5V', 'power', '5V')];
      mgr.scan(instances, nets);
      const snap = mgr.getSnapshot();
      const fixId = snap.pendingFixes[0]?.id;
      expect(fixId).toBeDefined();
      expect(mgr.approveFix(fixId!)).toBe(true);
      expect(mgr.getApprovedFixes().length).toBe(1);
    });

    it('rejects a pending fix', () => {
      const mgr = getSelfHealingAssistant();
      const instances = [inst('U1', 'IC', { vmax: '3.3V' }, ['VCC_5V'])];
      const nets = [net('VCC_5V', 'power', '5V')];
      mgr.scan(instances, nets);
      const fixId = mgr.getSnapshot().pendingFixes[0]?.id;
      expect(mgr.rejectFix(fixId!)).toBe(true);
      expect(mgr.getSnapshot().pendingFixes.length).toBe(0);
    });

    it('returns false for unknown fix ID', () => {
      const mgr = getSelfHealingAssistant();
      expect(mgr.approveFix('nonexistent')).toBe(false);
      expect(mgr.rejectFix('nonexistent')).toBe(false);
    });

    it('expires fixes after expiry time', () => {
      const mgr = getSelfHealingAssistant();
      mgr.updateConfig({ approvalExpiryMs: 100 }); // 100ms for test

      const instances = [inst('U1', 'IC', { vmax: '3.3V' }, ['VCC_5V'])];
      const nets = [net('VCC_5V', 'power', '5V')];
      mgr.scan(instances, nets);

      // Force expiry by manipulating fix timestamp
      const hazards = mgr.getSnapshot().hazards;
      for (const h of hazards) {
        if (h.fix) {
          h.fix.expiresAt = Date.now() - 1;
        }
      }

      const expired = mgr.expirePendingFixes();
      expect(expired).toBeGreaterThan(0);
    });

    it('cannot approve an expired fix', () => {
      const mgr = getSelfHealingAssistant();
      const instances = [inst('U1', 'IC', { vmax: '3.3V' }, ['VCC_5V'])];
      const nets = [net('VCC_5V', 'power', '5V')];
      mgr.scan(instances, nets);

      const fixId = mgr.getSnapshot().pendingFixes[0]?.id;
      // Force expiry
      const hazards = mgr.getSnapshot().hazards;
      for (const h of hazards) {
        if (h.fix && h.fix.id === fixId) {
          h.fix.expiresAt = Date.now() - 1;
        }
      }

      expect(mgr.approveFix(fixId!)).toBe(false);
    });
  });

  describe('dismissHazard', () => {
    it('dismisses a hazard', () => {
      const mgr = getSelfHealingAssistant();
      const instances = [inst('U1', 'MCU', {}, ['VCC'])];
      const nets = [net('VCC', 'power', '5V')];
      mgr.scan(instances, nets);

      const hazardId = mgr.getSnapshot().hazards[0]?.id;
      if (hazardId) {
        expect(mgr.dismissHazard(hazardId)).toBe(true);
        expect(mgr.getSnapshot().activeHazards.length).toBeLessThan(
          mgr.getSnapshot().hazards.length,
        );
      }
    });

    it('returns false for unknown hazard', () => {
      const mgr = getSelfHealingAssistant();
      expect(mgr.dismissHazard('nonexistent')).toBe(false);
    });
  });

  describe('queries', () => {
    it('getHazardsByType filters correctly', () => {
      const mgr = getSelfHealingAssistant();
      const instances = [
        inst('U1', 'MCU', { vmax: '3.3V' }, ['VCC_5V']),
        inst('MOT1', 'Motor', { current: '500mA' }, ['MOTOR']),
      ];
      const nets = [net('VCC_5V', 'power', '5V')];
      mgr.scan(instances, nets);
      const vm = mgr.getHazardsByType('voltage_mismatch');
      for (const h of vm) {
        expect(h.type).toBe('voltage_mismatch');
      }
    });

    it('getHazardsBySeverity filters correctly', () => {
      const mgr = getSelfHealingAssistant();
      const instances = [
        inst('U1', 'MCU', { vmax: '3.3V' }, ['VCC_5V']),
      ];
      const nets = [net('VCC_5V', 'power', '5V')];
      mgr.scan(instances, nets);
      const critical = mgr.getHazardsBySeverity('critical');
      for (const h of critical) {
        expect(h.severity).toBe('critical');
      }
    });

    it('getHazardsForRef filters correctly', () => {
      const mgr = getSelfHealingAssistant();
      const instances = [inst('U1', 'MCU', { vmax: '3.3V' }, ['VCC_5V'])];
      const nets = [net('VCC_5V', 'power', '5V')];
      mgr.scan(instances, nets);
      const u1Hazards = mgr.getHazardsForRef('U1');
      for (const h of u1Hazards) {
        expect(h.affectedRefs).toContain('U1');
      }
    });

    it('getApprovedFixes returns only approved', () => {
      const mgr = getSelfHealingAssistant();
      const instances = [inst('U1', 'IC', { vmax: '3.3V' }, ['VCC_5V'])];
      const nets = [net('VCC_5V', 'power', '5V')];
      mgr.scan(instances, nets);
      expect(mgr.getApprovedFixes().length).toBe(0);
      const fixId = mgr.getSnapshot().pendingFixes[0]?.id;
      if (fixId) {
        mgr.approveFix(fixId);
        expect(mgr.getApprovedFixes().length).toBe(1);
      }
    });
  });

  describe('updateConfig', () => {
    it('merges config', () => {
      const mgr = getSelfHealingAssistant();
      mgr.updateConfig({ defaultMaxPinCurrentMa: 40, defaultAdcRefVoltage: 5.0 });
      const cfg = mgr.getConfig();
      expect(cfg.defaultMaxPinCurrentMa).toBe(40);
      expect(cfg.defaultAdcRefVoltage).toBe(5.0);
      // Unchanged
      expect(cfg.approvalExpiryMs).toBe(300000);
    });

    it('merges enabledChecks partially', () => {
      const mgr = getSelfHealingAssistant();
      mgr.updateConfig({ enabledChecks: { voltage_mismatch: false } as Record<HazardType, boolean> });
      const cfg = mgr.getConfig();
      expect(cfg.enabledChecks.voltage_mismatch).toBe(false);
      expect(cfg.enabledChecks.missing_decoupling).toBe(true);
    });
  });

  describe('reset', () => {
    it('clears all state', () => {
      const mgr = getSelfHealingAssistant();
      mgr.scan(
        [inst('U1', 'MCU', { vmax: '3.3V' }, ['VCC_5V'])],
        [net('VCC_5V', 'power', '5V')],
      );
      mgr.updateConfig({ defaultMaxPinCurrentMa: 100 });

      mgr.reset();
      const snap = mgr.getSnapshot();
      expect(snap.hazards).toEqual([]);
      expect(snap.lastScanAt).toBeNull();
      expect(snap.config.defaultMaxPinCurrentMa).toBe(20);
    });
  });
});
