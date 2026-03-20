import { describe, it, expect } from 'vitest';
import {
  sanitizeLabel,
  deduplicateNames,
  detectPinCategory,
  extractPinFromLabel,
  isPowerNet,
  generatePinConstants,
  formatAsDefines,
  getBoardPinMap,
  getConstantsSummary,
} from '@shared/arduino-pin-generator';
import type {
  BoardPinMap,
  BoardType,
  NetInfo,
  InstanceInfo,
  PinGeneratorOptions,
  PinConstant,
} from '@shared/arduino-pin-generator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOptions(overrides?: Partial<PinGeneratorOptions>): PinGeneratorOptions {
  return {
    boardType: 'uno',
    includeComments: true,
    groupByCategory: true,
    ...overrides,
  };
}

function makeNet(id: string, name: string): NetInfo {
  return { id, name };
}

function makeInstance(overrides: Partial<InstanceInfo> & { id: string }): InstanceInfo {
  return {
    componentType: 'generic',
    label: 'U1',
    pins: [],
    ...overrides,
  };
}

// ===========================================================================
// sanitizeLabel
// ===========================================================================

describe('sanitizeLabel', () => {
  it('converts to UPPER_CASE', () => {
    expect(sanitizeLabel('led pin')).toBe('LED_PIN');
  });

  it('replaces spaces with underscores', () => {
    expect(sanitizeLabel('motor enable')).toBe('MOTOR_ENABLE');
  });

  it('replaces dashes with underscores', () => {
    expect(sanitizeLabel('sensor-data')).toBe('SENSOR_DATA');
  });

  it('replaces dots with underscores', () => {
    expect(sanitizeLabel('pin.out')).toBe('PIN_OUT');
  });

  it('replaces slashes with underscores', () => {
    expect(sanitizeLabel('tx/rx')).toBe('TX_RX');
  });

  it('removes non-alphanumeric chars', () => {
    expect(sanitizeLabel('LED@Pin#1!')).toBe('LEDPIN1');
  });

  it('collapses consecutive underscores', () => {
    expect(sanitizeLabel('a - - b')).toBe('A_B');
  });

  it('prefixes with underscore when starting with digit', () => {
    expect(sanitizeLabel('3v3')).toBe('_3V3');
  });

  it('trims leading/trailing underscores', () => {
    expect(sanitizeLabel('_hello_')).toBe('HELLO');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(sanitizeLabel('   ')).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeLabel('')).toBe('');
  });

  it('handles complex mixed-case labels', () => {
    expect(sanitizeLabel('LED Pin 1')).toBe('LED_PIN_1');
  });

  it('handles backslashes', () => {
    expect(sanitizeLabel('a\\b')).toBe('A_B');
  });
});

// ===========================================================================
// deduplicateNames
// ===========================================================================

describe('deduplicateNames', () => {
  it('returns unchanged names when no duplicates', () => {
    expect(deduplicateNames(['A', 'B', 'C'])).toEqual(['A', 'B', 'C']);
  });

  it('appends _2 to the second occurrence', () => {
    expect(deduplicateNames(['LED', 'LED'])).toEqual(['LED', 'LED_2']);
  });

  it('appends incrementing suffixes for multiple duplicates', () => {
    expect(deduplicateNames(['X', 'X', 'X'])).toEqual(['X', 'X_2', 'X_3']);
  });

  it('handles interleaved duplicates', () => {
    expect(deduplicateNames(['A', 'B', 'A', 'B'])).toEqual(['A', 'B', 'A_2', 'B_2']);
  });

  it('handles empty array', () => {
    expect(deduplicateNames([])).toEqual([]);
  });
});

// ===========================================================================
// detectPinCategory
// ===========================================================================

describe('detectPinCategory', () => {
  const unoMap = getBoardPinMap('uno');
  const megaMap = getBoardPinMap('mega');

  it('detects analog pin from string', () => {
    expect(detectPinCategory('A0', unoMap)).toBe('analog_input');
  });

  it('returns unmapped for unknown analog string', () => {
    expect(detectPinCategory('A10', unoMap)).toBe('unmapped');
  });

  it('detects I2C SDA pin on Uno', () => {
    // A4 = pin 18 in digital numbering for I2C
    expect(detectPinCategory(18, unoMap)).toBe('i2c');
  });

  it('detects I2C SCL pin on Uno', () => {
    expect(detectPinCategory(19, unoMap)).toBe('i2c');
  });

  it('detects I2C on Mega (pin 20=SDA, 21=SCL)', () => {
    expect(detectPinCategory(20, megaMap)).toBe('i2c');
    expect(detectPinCategory(21, megaMap)).toBe('i2c');
  });

  it('detects SPI pins on Uno', () => {
    expect(detectPinCategory(11, unoMap)).toBe('spi');
    expect(detectPinCategory(12, unoMap)).toBe('spi');
    expect(detectPinCategory(13, unoMap)).toBe('spi');
    expect(detectPinCategory(10, unoMap)).toBe('spi');
  });

  it('detects Serial pins on Uno', () => {
    expect(detectPinCategory(0, unoMap)).toBe('serial');
    expect(detectPinCategory(1, unoMap)).toBe('serial');
  });

  it('detects PWM pin', () => {
    expect(detectPinCategory(3, unoMap)).toBe('pwm');
    expect(detectPinCategory(5, unoMap)).toBe('pwm');
    expect(detectPinCategory(6, unoMap)).toBe('pwm');
    expect(detectPinCategory(9, unoMap)).toBe('pwm');
  });

  it('detects regular digital pin', () => {
    expect(detectPinCategory(2, unoMap)).toBe('digital_output');
    expect(detectPinCategory(4, unoMap)).toBe('digital_output');
    expect(detectPinCategory(7, unoMap)).toBe('digital_output');
    expect(detectPinCategory(8, unoMap)).toBe('digital_output');
  });

  it('returns unmapped for out-of-range pin on Uno', () => {
    expect(detectPinCategory(54, unoMap)).toBe('unmapped');
  });

  it('detects high digital pins on Mega', () => {
    expect(detectPinCategory(44, megaMap)).toBe('pwm');
    expect(detectPinCategory(30, megaMap)).toBe('digital_output');
  });

  it('detects SPI on Mega (different pins)', () => {
    expect(detectPinCategory(51, megaMap)).toBe('spi');
    expect(detectPinCategory(50, megaMap)).toBe('spi');
    expect(detectPinCategory(52, megaMap)).toBe('spi');
    expect(detectPinCategory(53, megaMap)).toBe('spi');
  });
});

// ===========================================================================
// extractPinFromLabel
// ===========================================================================

describe('extractPinFromLabel', () => {
  const unoMap = getBoardPinMap('uno');
  const megaMap = getBoardPinMap('mega');

  it('extracts analog pin "A0"', () => {
    expect(extractPinFromLabel('A0', unoMap)).toBe('A0');
  });

  it('extracts analog pin "A5"', () => {
    expect(extractPinFromLabel('A5', unoMap)).toBe('A5');
  });

  it('returns null for out-of-range analog on Uno', () => {
    expect(extractPinFromLabel('A6', unoMap)).toBeNull();
  });

  it('extracts A6 on Nano (has A6, A7)', () => {
    const nanoMap = getBoardPinMap('nano');
    expect(extractPinFromLabel('A6', nanoMap)).toBe('A6');
  });

  it('extracts digital pin "D3"', () => {
    expect(extractPinFromLabel('D3', unoMap)).toBe(3);
  });

  it('extracts digital pin "D13"', () => {
    expect(extractPinFromLabel('D13', unoMap)).toBe(13);
  });

  it('returns null for out-of-range digital', () => {
    expect(extractPinFromLabel('D14', unoMap)).toBeNull();
  });

  it('extracts D30 on Mega', () => {
    expect(extractPinFromLabel('D30', megaMap)).toBe(30);
  });

  it('extracts "PIN_5"', () => {
    expect(extractPinFromLabel('PIN_5', unoMap)).toBe(5);
  });

  it('extracts "PIN5"', () => {
    expect(extractPinFromLabel('PIN5', unoMap)).toBe(5);
  });

  it('extracts "GPIO_12"', () => {
    expect(extractPinFromLabel('GPIO_12', unoMap)).toBe(12);
  });

  it('extracts "GPIO12"', () => {
    expect(extractPinFromLabel('GPIO12', unoMap)).toBe(12);
  });

  it('extracts SDA', () => {
    expect(extractPinFromLabel('SDA', unoMap)).toBe(18);
  });

  it('extracts SCL', () => {
    expect(extractPinFromLabel('SCL', unoMap)).toBe(19);
  });

  it('extracts MOSI', () => {
    expect(extractPinFromLabel('MOSI', unoMap)).toBe(11);
  });

  it('extracts RX', () => {
    expect(extractPinFromLabel('RX', unoMap)).toBe(0);
  });

  it('extracts TX', () => {
    expect(extractPinFromLabel('TX', unoMap)).toBe(1);
  });

  it('extracts LED_BUILTIN', () => {
    expect(extractPinFromLabel('LED_BUILTIN', unoMap)).toBe(13);
  });

  it('returns null for unrecognizable label', () => {
    expect(extractPinFromLabel('MOTOR_SPEED', unoMap)).toBeNull();
  });

  it('is case-insensitive', () => {
    expect(extractPinFromLabel('a0', unoMap)).toBe('A0');
    expect(extractPinFromLabel('d3', unoMap)).toBe(3);
    expect(extractPinFromLabel('sda', unoMap)).toBe(18);
  });
});

// ===========================================================================
// isPowerNet
// ===========================================================================

describe('isPowerNet', () => {
  it.each([
    'VCC', 'GND', '5V', '3V3', '3.3V', 'VDD', 'VSS', 'VIN',
    'AVCC', 'AREF', 'VBAT', 'VBUS', 'GROUND', 'POWER',
    '+5V', '-12V', 'V+', 'V-', '12V',
  ])('identifies "%s" as a power net', (name) => {
    expect(isPowerNet(name)).toBe(true);
  });

  it.each([
    'LED', 'MOTOR', 'SENSOR', 'D3', 'A0', 'DATA', 'CLK',
  ])('does not flag "%s" as a power net', (name) => {
    expect(isPowerNet(name)).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isPowerNet('vcc')).toBe(true);
    expect(isPowerNet('gnd')).toBe(true);
  });

  it('trims whitespace', () => {
    expect(isPowerNet('  VCC  ')).toBe(true);
  });
});

// ===========================================================================
// getBoardPinMap
// ===========================================================================

describe('getBoardPinMap', () => {
  it('returns Uno pin map', () => {
    const map = getBoardPinMap('uno');
    expect(map.boardType).toBe('uno');
    expect(map.digitalPins).toHaveLength(14);
    expect(map.analogPins).toEqual(['A0', 'A1', 'A2', 'A3', 'A4', 'A5']);
    expect(map.pwmPins).toEqual([3, 5, 6, 9, 10, 11]);
  });

  it('returns Nano pin map with A6, A7', () => {
    const map = getBoardPinMap('nano');
    expect(map.boardType).toBe('nano');
    expect(map.analogPins).toContain('A6');
    expect(map.analogPins).toContain('A7');
    expect(map.analogPins).toHaveLength(8);
  });

  it('returns Mega pin map with 54 digital pins', () => {
    const map = getBoardPinMap('mega');
    expect(map.boardType).toBe('mega');
    expect(map.digitalPins).toHaveLength(54);
    expect(map.analogPins).toHaveLength(16);
    expect(map.i2cPins).toEqual({ sda: 20, scl: 21 });
    expect(map.spiPins).toEqual({ mosi: 51, miso: 50, sck: 52, ss: 53 });
    expect(map.pwmPins).toContain(44);
    expect(map.pwmPins).toContain(45);
    expect(map.pwmPins).toContain(46);
  });
});

// ===========================================================================
// generatePinConstants
// ===========================================================================

describe('generatePinConstants', () => {
  it('generates constants from net labels with pin patterns', () => {
    const nets = [makeNet('n1', 'D3'), makeNet('n2', 'A0')];
    const result = generatePinConstants(nets, [], makeOptions());
    expect(result).toHaveLength(2);
    expect(result.find((c) => c.name === 'D3')).toBeDefined();
    expect(result.find((c) => c.name === 'A0')).toBeDefined();
  });

  it('uses instance physicalPin when label is not a pin pattern', () => {
    const nets = [makeNet('n1', 'MOTOR_EN')];
    const instances = [
      makeInstance({
        id: 'i1',
        pins: [{ pinName: 'EN', netId: 'n1', physicalPin: 9 }],
      }),
    ];
    const result = generatePinConstants(nets, instances, makeOptions());
    expect(result).toHaveLength(1);
    expect(result[0].pinNumber).toBe(9);
    expect(result[0].category).toBe('pwm');
  });

  it('marks unmapped when no pin info available', () => {
    const nets = [makeNet('n1', 'MYSTERY_NET')];
    const result = generatePinConstants(nets, [], makeOptions());
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('unmapped');
    expect(result[0].pinNumber).toBe('??');
  });

  it('skips power nets', () => {
    const nets = [makeNet('n1', 'VCC'), makeNet('n2', 'GND'), makeNet('n3', 'LED')];
    const result = generatePinConstants(nets, [], makeOptions());
    expect(result).toHaveLength(1);
    expect(result[0].originalLabel).toBe('LED');
  });

  it('skips empty net names', () => {
    const nets = [makeNet('n1', ''), makeNet('n2', '   ')];
    const result = generatePinConstants(nets, [], makeOptions());
    expect(result).toHaveLength(0);
  });

  it('deduplicates names', () => {
    const nets = [makeNet('n1', 'led'), makeNet('n2', 'LED')];
    const result = generatePinConstants(nets, [], makeOptions());
    expect(result).toHaveLength(2);
    const names = result.map((c) => c.name);
    expect(names).toContain('LED');
    expect(names).toContain('LED_2');
  });

  it('sorts by category order', () => {
    const nets = [
      makeNet('n1', 'MYSTERY'),
      makeNet('n2', 'A0'),
      makeNet('n3', 'D2'),
    ];
    const result = generatePinConstants(nets, [], makeOptions());
    expect(result[0].name).toBe('D2');       // digital_output first
    expect(result[1].name).toBe('A0');       // analog_input second
    expect(result[2].name).toBe('MYSTERY');  // unmapped last
  });

  it('works with Mega board type', () => {
    const nets = [makeNet('n1', 'D44')];
    const result = generatePinConstants(nets, [], makeOptions({ boardType: 'mega' }));
    expect(result).toHaveLength(1);
    expect(result[0].pinNumber).toBe(44);
    expect(result[0].category).toBe('pwm');
  });

  it('handles no nets', () => {
    const result = generatePinConstants([], [], makeOptions());
    expect(result).toHaveLength(0);
  });

  it('prefers label extraction over instance pin', () => {
    const nets = [makeNet('n1', 'D3')];
    const instances = [
      makeInstance({
        id: 'i1',
        pins: [{ pinName: 'OUT', netId: 'n1', physicalPin: 7 }],
      }),
    ];
    const result = generatePinConstants(nets, instances, makeOptions());
    expect(result[0].pinNumber).toBe(3); // label wins
  });
});

// ===========================================================================
// formatAsDefines
// ===========================================================================

describe('formatAsDefines', () => {
  it('formats constants as #define directives', () => {
    const constants: PinConstant[] = [
      { name: 'LED_PIN', originalLabel: 'LED Pin', pinNumber: 13, category: 'digital_output', comment: 'LED' },
    ];
    const output = formatAsDefines(constants, makeOptions({ groupByCategory: false }));
    expect(output).toContain('#define LED_PIN');
    expect(output).toContain('13');
  });

  it('comments out unmapped constants', () => {
    const constants: PinConstant[] = [
      { name: 'MYSTERY', originalLabel: 'mystery', pinNumber: '??', category: 'unmapped', comment: 'unknown' },
    ];
    const output = formatAsDefines(constants, makeOptions({ groupByCategory: false }));
    expect(output).toContain('// #define MYSTERY');
  });

  it('includes header comments when includeComments is true', () => {
    const constants: PinConstant[] = [
      { name: 'X', originalLabel: 'x', pinNumber: 2, category: 'digital_output', comment: 'test' },
    ];
    const output = formatAsDefines(constants, makeOptions({ includeComments: true }));
    expect(output).toContain('ProtoPulse Pin Constants');
    expect(output).toContain('Arduino Uno');
  });

  it('omits header when includeComments is false', () => {
    const constants: PinConstant[] = [
      { name: 'X', originalLabel: 'x', pinNumber: 2, category: 'digital_output', comment: 'test' },
    ];
    const output = formatAsDefines(constants, makeOptions({ includeComments: false, groupByCategory: false }));
    expect(output).not.toContain('ProtoPulse');
    expect(output).toContain('#define X');
  });

  it('groups by category when enabled', () => {
    const constants: PinConstant[] = [
      { name: 'BTN', originalLabel: 'btn', pinNumber: 2, category: 'digital_output', comment: '' },
      { name: 'TEMP', originalLabel: 'temp', pinNumber: 'A0', category: 'analog_input', comment: '' },
    ];
    const output = formatAsDefines(constants, makeOptions({ groupByCategory: true, includeComments: true }));
    expect(output).toContain('=== Digital Outputs ===');
    expect(output).toContain('=== Analog Inputs ===');
  });

  it('returns minimal text for empty constants with comments', () => {
    const output = formatAsDefines([], makeOptions({ includeComments: true }));
    expect(output).toContain('No pin constants generated');
  });

  it('returns empty string for empty constants without comments', () => {
    const output = formatAsDefines([], makeOptions({ includeComments: false }));
    expect(output).toBe('');
  });

  it('aligns defines to longest name', () => {
    const constants: PinConstant[] = [
      { name: 'A', originalLabel: 'a', pinNumber: 2, category: 'digital_output', comment: '' },
      { name: 'LONG_NAME', originalLabel: 'long', pinNumber: 3, category: 'pwm', comment: '' },
    ];
    const output = formatAsDefines(constants, makeOptions({ includeComments: false, groupByCategory: false }));
    // The shorter name should have more padding
    const lines = output.split('\n').filter((l) => l.startsWith('#define'));
    expect(lines).toHaveLength(2);
    // Both should have pin values aligned at same column
    const aIdx = lines[0].indexOf('2');
    const lIdx = lines[1].indexOf('3');
    expect(aIdx).toBe(lIdx);
  });

  it('uses correct board name for mega', () => {
    const constants: PinConstant[] = [
      { name: 'X', originalLabel: 'x', pinNumber: 2, category: 'digital_output', comment: 'test' },
    ];
    const output = formatAsDefines(constants, makeOptions({ boardType: 'mega', includeComments: true }));
    expect(output).toContain('Arduino Mega 2560');
  });

  it('formats analog pins as strings not numbers', () => {
    const constants: PinConstant[] = [
      { name: 'SENSOR', originalLabel: 'sensor', pinNumber: 'A0', category: 'analog_input', comment: '' },
    ];
    const output = formatAsDefines(constants, makeOptions({ includeComments: false, groupByCategory: false }));
    expect(output).toContain('#define SENSOR');
    expect(output).toContain('A0');
  });
});

// ===========================================================================
// getConstantsSummary
// ===========================================================================

describe('getConstantsSummary', () => {
  it('returns correct summary', () => {
    const constants: PinConstant[] = [
      { name: 'A', originalLabel: 'a', pinNumber: 2, category: 'digital_output', comment: '' },
      { name: 'B', originalLabel: 'b', pinNumber: '??', category: 'unmapped', comment: '' },
    ];
    const summary = getConstantsSummary(constants, 5);
    expect(summary).toBe('2 pin constants generated from 5 nets (1 mapped, 1 unmapped)');
  });

  it('handles singular', () => {
    const constants: PinConstant[] = [
      { name: 'A', originalLabel: 'a', pinNumber: 2, category: 'digital_output', comment: '' },
    ];
    const summary = getConstantsSummary(constants, 1);
    expect(summary).toBe('1 pin constant generated from 1 net (1 mapped, 0 unmapped)');
  });

  it('handles zero constants', () => {
    const summary = getConstantsSummary([], 0);
    expect(summary).toBe('0 pin constants generated from 0 nets (0 mapped, 0 unmapped)');
  });
});
