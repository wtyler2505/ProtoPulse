/**
 * Semantic Pin Mapper Tests
 *
 * Tests for client/src/lib/semantic-pin-mapper.ts.
 * Covers classifyPinRole, mapPinsBySemantics, and getUnmappedPins.
 */

import { describe, it, expect } from 'vitest';
import {
  classifyPinRole,
  mapPinsBySemantics,
  getUnmappedPins,
} from '../semantic-pin-mapper';
import type {
  PinRole,
  SemanticPin,
  PinMapping,
} from '../semantic-pin-mapper';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sPin(name: string, role: PinRole, extra?: Partial<SemanticPin>): SemanticPin {
  return { name, role, ...extra };
}

// ---------------------------------------------------------------------------
// classifyPinRole — Power pins
// ---------------------------------------------------------------------------

describe('classifyPinRole — power pins', () => {
  it.each([
    ['VCC', 'power'],
    ['VDD', 'power'],
    ['VIN', 'power'],
    ['VBUS', 'power'],
    ['VBAT', 'power'],
    ['VSYS', 'power'],
    ['3V3', 'power'],
    ['5V', 'power'],
    ['12V', 'power'],
    ['V+', 'power'],
    ['VOUT', 'power'],
    ['AVCC', 'power'],
    ['DVCC', 'power'],
  ] as const)('classifies %s as %s', (name, expected) => {
    expect(classifyPinRole(name)).toBe(expected);
  });

  it('is case-insensitive for power pins', () => {
    expect(classifyPinRole('vcc')).toBe('power');
    expect(classifyPinRole('Vdd')).toBe('power');
  });
});

// ---------------------------------------------------------------------------
// classifyPinRole — Ground pins
// ---------------------------------------------------------------------------

describe('classifyPinRole — ground pins', () => {
  it.each([
    ['GND', 'ground'],
    ['VSS', 'ground'],
    ['V-', 'ground'],
    ['GROUND', 'ground'],
    ['AGND', 'ground'],
    ['DGND', 'ground'],
    ['PGND', 'ground'],
    ['GNDA', 'ground'],
    ['GNDD', 'ground'],
  ] as const)('classifies %s as %s', (name, expected) => {
    expect(classifyPinRole(name)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// classifyPinRole — Clock pins
// ---------------------------------------------------------------------------

describe('classifyPinRole — clock pins', () => {
  it.each([
    ['SCL', 'clock'],
    ['SCK', 'clock'],
    ['SCLK', 'clock'],
    ['CLK', 'clock'],
    ['CLOCK', 'clock'],
    ['XTAL', 'clock'],
    ['XTAL1', 'clock'],
    ['OSC', 'clock'],
    ['OSC1', 'clock'],
    ['I2C_SCL', 'clock'],
    ['TWI_SCL', 'clock'],
    ['SPI_SCK', 'clock'],
    ['SPI_CLK', 'clock'],
  ] as const)('classifies %s as %s', (name, expected) => {
    expect(classifyPinRole(name)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// classifyPinRole — Data pins
// ---------------------------------------------------------------------------

describe('classifyPinRole — data pins', () => {
  it.each([
    ['SDA', 'data'],
    ['MOSI', 'data'],
    ['MISO', 'data'],
    ['SDI', 'data'],
    ['SDO', 'data'],
    ['DI', 'data'],
    ['DO', 'data'],
    ['SI', 'data'],
    ['SO', 'data'],
    ['I2C_SDA', 'data'],
    ['TWI_SDA', 'data'],
    ['SPI_MOSI', 'data'],
    ['SPI_MISO', 'data'],
  ] as const)('classifies %s as %s', (name, expected) => {
    expect(classifyPinRole(name)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// classifyPinRole — Enable pins
// ---------------------------------------------------------------------------

describe('classifyPinRole — enable pins', () => {
  it.each([
    ['EN', 'enable'],
    ['CE', 'enable'],
    ['CS', 'enable'],
    ['SS', 'enable'],
    ['NSS', 'enable'],
    ['OE', 'enable'],
    ['NCS', 'enable'],
    ['CSN', 'enable'],
    ['CHIP_EN', 'enable'],
    ['ENABLE', 'enable'],
  ] as const)('classifies %s as %s', (name, expected) => {
    expect(classifyPinRole(name)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// classifyPinRole — Reset pins
// ---------------------------------------------------------------------------

describe('classifyPinRole — reset pins', () => {
  it.each([
    ['RST', 'reset'],
    ['NRST', 'reset'],
    ['RESET', 'reset'],
    ['NRESET', 'reset'],
    ['MR', 'reset'],
    ['MCLR', 'reset'],
  ] as const)('classifies %s as %s', (name, expected) => {
    expect(classifyPinRole(name)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// classifyPinRole — Analog pins
// ---------------------------------------------------------------------------

describe('classifyPinRole — analog pins', () => {
  it.each([
    ['A0', 'analog'],
    ['A7', 'analog'],
    ['ADC', 'analog'],
    ['ADC0', 'analog'],
    ['AIN', 'analog'],
    ['AIN3', 'analog'],
    ['AN0', 'analog'],
    ['AN7', 'analog'],
    ['ANALOG', 'analog'],
    ['ANALOG0', 'analog'],
  ] as const)('classifies %s as %s', (name, expected) => {
    expect(classifyPinRole(name)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// classifyPinRole — PWM pins
// ---------------------------------------------------------------------------

describe('classifyPinRole — PWM pins', () => {
  it.each([
    ['PWM', 'pwm'],
    ['PWM0', 'pwm'],
    ['PWM3', 'pwm'],
    ['OC1A', 'pwm'],
    ['OC2B', 'pwm'],
    ['TIMER1_CH2', 'pwm'],
  ] as const)('classifies %s as %s', (name, expected) => {
    expect(classifyPinRole(name)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// classifyPinRole — Output pins
// ---------------------------------------------------------------------------

describe('classifyPinRole — output pins', () => {
  it.each([
    ['TX', 'output'],
    ['TXD', 'output'],
    ['UART_TX', 'output'],
    ['USART_TX', 'output'],
    ['TXO', 'output'],
    ['TOUT', 'output'],
    ['OUT', 'output'],
    ['OUT0', 'output'],
    ['Q', 'output'],
    ['QBAR', 'output'],
    ['DOUT', 'output'],
  ] as const)('classifies %s as %s', (name, expected) => {
    expect(classifyPinRole(name)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// classifyPinRole — Input pins
// ---------------------------------------------------------------------------

describe('classifyPinRole — input pins', () => {
  it.each([
    ['RX', 'input'],
    ['RXD', 'input'],
    ['UART_RX', 'input'],
    ['USART_RX', 'input'],
    ['RXI', 'input'],
    ['RIN', 'input'],
    ['IN', 'input'],
    ['IN0', 'input'],
    ['DIN', 'input'],
    ['COMP_IN', 'input'],
  ] as const)('classifies %s as %s', (name, expected) => {
    expect(classifyPinRole(name)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// classifyPinRole — Bidirectional / GPIO pins
// ---------------------------------------------------------------------------

describe('classifyPinRole — bidirectional pins', () => {
  it.each([
    ['D0', 'bidirectional'],
    ['D13', 'bidirectional'],
    ['GPIO', 'bidirectional'],
    ['GPIO0', 'bidirectional'],
    ['IO0', 'bidirectional'],
    ['DIGITAL0', 'bidirectional'],
    ['PA0', 'bidirectional'],
    ['PB0', 'bidirectional'],
    ['PC3', 'bidirectional'],
    ['PD7', 'bidirectional'],
  ] as const)('classifies %s as %s', (name, expected) => {
    expect(classifyPinRole(name)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// classifyPinRole — Edge cases
// ---------------------------------------------------------------------------

describe('classifyPinRole — edge cases', () => {
  it('defaults unrecognised names to bidirectional', () => {
    expect(classifyPinRole('FOOBAR')).toBe('bidirectional');
    expect(classifyPinRole('MY_SIGNAL')).toBe('bidirectional');
    expect(classifyPinRole('X1')).toBe('bidirectional');
  });

  it('returns bidirectional for empty string', () => {
    expect(classifyPinRole('')).toBe('bidirectional');
  });

  it('trims whitespace before classifying', () => {
    expect(classifyPinRole('  VCC  ')).toBe('power');
    expect(classifyPinRole('\tGND\n')).toBe('ground');
  });

  it('is case-insensitive across all roles', () => {
    expect(classifyPinRole('sda')).toBe('data');
    expect(classifyPinRole('Scl')).toBe('clock');
    expect(classifyPinRole('rst')).toBe('reset');
    expect(classifyPinRole('pwm0')).toBe('pwm');
  });
});

// ---------------------------------------------------------------------------
// mapPinsBySemantics — basic matching
// ---------------------------------------------------------------------------

describe('mapPinsBySemantics — basic matching', () => {
  it('matches identical pins with high confidence', () => {
    const source = [sPin('VCC', 'power')];
    const target = [sPin('VCC', 'power')];
    const result = mapPinsBySemantics(source, target);

    expect(result).toHaveLength(1);
    expect(result[0].sourcePin.name).toBe('VCC');
    expect(result[0].targetPin.name).toBe('VCC');
    expect(result[0].confidence).toBeGreaterThan(0.8);
  });

  it('matches same-role pins with different names', () => {
    const source = [sPin('VCC', 'power')];
    const target = [sPin('VDD', 'power')];
    const result = mapPinsBySemantics(source, target);

    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBeGreaterThan(0.4);
  });

  it('returns empty array when source is empty', () => {
    const result = mapPinsBySemantics([], [sPin('VCC', 'power')]);
    expect(result).toEqual([]);
  });

  it('returns empty array when target is empty', () => {
    const result = mapPinsBySemantics([sPin('VCC', 'power')], []);
    expect(result).toEqual([]);
  });

  it('returns empty array when both are empty', () => {
    expect(mapPinsBySemantics([], [])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// mapPinsBySemantics — role-based matching
// ---------------------------------------------------------------------------

describe('mapPinsBySemantics — role-based matching', () => {
  it('prefers same-role matches over name similarity', () => {
    const source = [sPin('VCC', 'power')];
    const target = [
      sPin('GND', 'ground'),
      sPin('VDD', 'power'),
    ];
    const result = mapPinsBySemantics(source, target);

    expect(result).toHaveLength(1);
    expect(result[0].targetPin.name).toBe('VDD');
  });

  it('matches power to power, ground to ground in a mixed set', () => {
    const source = [
      sPin('VCC', 'power'),
      sPin('GND', 'ground'),
    ];
    const target = [
      sPin('VSS', 'ground'),
      sPin('VDD', 'power'),
    ];
    const result = mapPinsBySemantics(source, target);

    expect(result).toHaveLength(2);

    const powerMapping = result.find((m) => m.sourcePin.name === 'VCC');
    const groundMapping = result.find((m) => m.sourcePin.name === 'GND');

    expect(powerMapping?.targetPin.name).toBe('VDD');
    expect(groundMapping?.targetPin.name).toBe('VSS');
  });

  it('matches complementary input/output roles', () => {
    const source = [sPin('TX', 'output')];
    const target = [sPin('RX', 'input')];
    const result = mapPinsBySemantics(source, target);

    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBeGreaterThan(0.3);
  });

  it('matches clock to clock pins', () => {
    const source = [sPin('SCL', 'clock')];
    const target = [sPin('CLK', 'clock')];
    const result = mapPinsBySemantics(source, target);

    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBeGreaterThan(0.4);
  });

  it('matches data to data pins', () => {
    const source = [sPin('SDA', 'data')];
    const target = [sPin('MOSI', 'data')];
    const result = mapPinsBySemantics(source, target);

    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBeGreaterThan(0.4);
  });
});

// ---------------------------------------------------------------------------
// mapPinsBySemantics — name similarity
// ---------------------------------------------------------------------------

describe('mapPinsBySemantics — name similarity', () => {
  it('boosts confidence for exact name match', () => {
    const source = [sPin('SDA', 'data')];
    const target = [
      sPin('SDA', 'data'),
      sPin('MISO', 'data'),
    ];
    const result = mapPinsBySemantics(source, target);

    expect(result).toHaveLength(1);
    expect(result[0].targetPin.name).toBe('SDA');
  });

  it('matches partial name overlap', () => {
    const source = [sPin('I2C_SDA', 'data')];
    const target = [sPin('SDA', 'data')];
    const result = mapPinsBySemantics(source, target);

    expect(result).toHaveLength(1);
    // SDA appears as a token in both — partial overlap boosts confidence
    expect(result[0].confidence).toBeGreaterThan(0.5);
  });
});

// ---------------------------------------------------------------------------
// mapPinsBySemantics — electrical type
// ---------------------------------------------------------------------------

describe('mapPinsBySemantics — electrical type matching', () => {
  it('gives bonus for matching electrical types', () => {
    const source = [sPin('D0', 'bidirectional', { electricalType: 'bidirectional' })];
    const target = [sPin('D0', 'bidirectional', { electricalType: 'bidirectional' })];
    const resultWithType = mapPinsBySemantics(source, target);

    const sourceNoType = [sPin('D0', 'bidirectional')];
    const targetNoType = [sPin('D0', 'bidirectional')];
    const resultWithout = mapPinsBySemantics(sourceNoType, targetNoType);

    expect(resultWithType[0].confidence).toBeGreaterThan(resultWithout[0].confidence);
  });

  it('gives partial bonus for complementary electrical types', () => {
    const source = [sPin('TX', 'output', { electricalType: 'output' })];
    const target = [sPin('RX', 'input', { electricalType: 'input' })];
    const result = mapPinsBySemantics(source, target);

    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBeGreaterThan(0.35);
  });

  it('gives no electrical type bonus when types are undefined', () => {
    const source = [sPin('D0', 'bidirectional')];
    const target = [sPin('D1', 'bidirectional')];
    const result = mapPinsBySemantics(source, target);

    // Role match alone = 0.5
    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// mapPinsBySemantics — greedy assignment
// ---------------------------------------------------------------------------

describe('mapPinsBySemantics — greedy assignment', () => {
  it('does not assign the same target pin twice', () => {
    const source = [
      sPin('VCC', 'power'),
      sPin('VIN', 'power'),
    ];
    const target = [sPin('VDD', 'power')];
    const result = mapPinsBySemantics(source, target);

    // Only 1 target available → max 1 mapping
    expect(result).toHaveLength(1);
  });

  it('does not assign the same source pin twice', () => {
    const source = [sPin('VCC', 'power')];
    const target = [
      sPin('VDD', 'power'),
      sPin('3V3', 'power'),
    ];
    const result = mapPinsBySemantics(source, target);

    expect(result).toHaveLength(1);
  });

  it('sorts results by confidence descending', () => {
    const source = [
      sPin('VCC', 'power'),
      sPin('GND', 'ground'),
      sPin('SDA', 'data'),
    ];
    const target = [
      sPin('VDD', 'power'),
      sPin('VSS', 'ground'),
      sPin('SCL', 'clock'), // weaker match for SDA
    ];
    const result = mapPinsBySemantics(source, target);

    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].confidence).toBeGreaterThanOrEqual(result[i].confidence);
    }
  });

  it('handles many-to-many matching', () => {
    const source = [
      sPin('VCC', 'power'),
      sPin('GND', 'ground'),
      sPin('SDA', 'data'),
      sPin('SCL', 'clock'),
      sPin('RST', 'reset'),
    ];
    const target = [
      sPin('VDD', 'power'),
      sPin('VSS', 'ground'),
      sPin('SDA', 'data'),
      sPin('SCL', 'clock'),
      sPin('NRST', 'reset'),
    ];
    const result = mapPinsBySemantics(source, target);

    expect(result).toHaveLength(5);
    // Each target should appear exactly once
    const targetNames = result.map((m) => m.targetPin.name);
    expect(new Set(targetNames).size).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// mapPinsBySemantics — zero-confidence exclusion
// ---------------------------------------------------------------------------

describe('mapPinsBySemantics — zero-confidence exclusion', () => {
  it('excludes mappings with zero confidence', () => {
    // power and ground have roleCompatibility = 0
    const source = [sPin('VCC', 'power')];
    const target = [sPin('GND', 'ground')];
    const result = mapPinsBySemantics(source, target);

    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// mapPinsBySemantics — realistic component swap scenario
// ---------------------------------------------------------------------------

describe('mapPinsBySemantics — realistic scenarios', () => {
  it('maps Arduino Uno to ESP32 I2C pins', () => {
    const arduinoPins: SemanticPin[] = [
      sPin('VCC', 'power'),
      sPin('GND', 'ground'),
      sPin('SDA', 'data'),
      sPin('SCL', 'clock'),
      sPin('A0', 'analog'),
      sPin('D2', 'bidirectional'),
    ];
    const esp32Pins: SemanticPin[] = [
      sPin('3V3', 'power'),
      sPin('GND', 'ground'),
      sPin('SDA', 'data'),
      sPin('SCL', 'clock'),
      sPin('GPIO36', 'bidirectional'),
      sPin('GPIO4', 'bidirectional'),
    ];
    const result = mapPinsBySemantics(arduinoPins, esp32Pins);

    // VCC → 3V3 (both power)
    const powerMap = result.find((m) => m.sourcePin.name === 'VCC');
    expect(powerMap?.targetPin.name).toBe('3V3');

    // GND → GND (exact)
    const gndMap = result.find((m) => m.sourcePin.name === 'GND');
    expect(gndMap?.targetPin.name).toBe('GND');

    // SDA → SDA (exact)
    const sdaMap = result.find((m) => m.sourcePin.name === 'SDA');
    expect(sdaMap?.targetPin.name).toBe('SDA');

    // SCL → SCL (exact)
    const sclMap = result.find((m) => m.sourcePin.name === 'SCL');
    expect(sclMap?.targetPin.name).toBe('SCL');
  });

  it('maps UART between two MCUs', () => {
    const mcu1: SemanticPin[] = [
      sPin('TX', 'output'),
      sPin('RX', 'input'),
    ];
    const mcu2: SemanticPin[] = [
      sPin('RX', 'input'),
      sPin('TX', 'output'),
    ];
    const result = mapPinsBySemantics(mcu1, mcu2);

    expect(result).toHaveLength(2);
    // TX→TX and RX→RX both have confidence (same-name boosts beyond role complement)
    // but TX (output)→TX (output) has role=1.0 (same role) vs TX→RX which has role=0.7
    // So TX→TX and RX→RX win
    const txMap = result.find((m) => m.sourcePin.name === 'TX');
    expect(txMap).toBeDefined();
    const rxMap = result.find((m) => m.sourcePin.name === 'RX');
    expect(rxMap).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// mapPinsBySemantics — pin number included
// ---------------------------------------------------------------------------

describe('mapPinsBySemantics — pins with numbers', () => {
  it('preserves pin number in mappings', () => {
    const source = [sPin('VCC', 'power', { number: 1 })];
    const target = [sPin('VDD', 'power', { number: '14' })];
    const result = mapPinsBySemantics(source, target);

    expect(result).toHaveLength(1);
    expect(result[0].sourcePin.number).toBe(1);
    expect(result[0].targetPin.number).toBe('14');
  });
});

// ---------------------------------------------------------------------------
// getUnmappedPins — basic usage
// ---------------------------------------------------------------------------

describe('getUnmappedPins', () => {
  it('returns pins not present in any mapping', () => {
    const allPins: SemanticPin[] = [
      sPin('VCC', 'power'),
      sPin('GND', 'ground'),
      sPin('SDA', 'data'),
    ];
    const mappings: PinMapping[] = [
      { sourcePin: allPins[0], targetPin: sPin('VDD', 'power'), confidence: 0.85 },
    ];

    const unmapped = getUnmappedPins(mappings, allPins);
    expect(unmapped).toHaveLength(2);
    expect(unmapped).toContain(allPins[1]);
    expect(unmapped).toContain(allPins[2]);
  });

  it('returns empty array when all pins are mapped', () => {
    const allPins: SemanticPin[] = [
      sPin('VCC', 'power'),
      sPin('GND', 'ground'),
    ];
    const mappings: PinMapping[] = [
      { sourcePin: allPins[0], targetPin: sPin('VDD', 'power'), confidence: 0.85 },
      { sourcePin: sPin('X', 'data'), targetPin: allPins[1], confidence: 0.5 },
    ];

    const unmapped = getUnmappedPins(mappings, allPins);
    expect(unmapped).toHaveLength(0);
  });

  it('returns all pins when mappings are empty', () => {
    const allPins: SemanticPin[] = [
      sPin('VCC', 'power'),
      sPin('GND', 'ground'),
      sPin('D0', 'bidirectional'),
    ];

    const unmapped = getUnmappedPins([], allPins);
    expect(unmapped).toHaveLength(3);
  });

  it('returns empty array when allPins is empty', () => {
    const mappings: PinMapping[] = [
      { sourcePin: sPin('VCC', 'power'), targetPin: sPin('VDD', 'power'), confidence: 0.85 },
    ];
    expect(getUnmappedPins(mappings, [])).toEqual([]);
  });

  it('checks both source and target sides of mappings', () => {
    const pin1 = sPin('VCC', 'power');
    const pin2 = sPin('GND', 'ground');
    const pin3 = sPin('SDA', 'data');

    const mappings: PinMapping[] = [
      { sourcePin: pin1, targetPin: pin2, confidence: 0.5 },
    ];

    // pin1 is source, pin2 is target — both mapped
    const unmapped = getUnmappedPins(mappings, [pin1, pin2, pin3]);
    expect(unmapped).toHaveLength(1);
    expect(unmapped[0]).toBe(pin3);
  });

  it('uses reference equality for pin matching', () => {
    const pin1 = sPin('VCC', 'power');
    const pin1Clone = sPin('VCC', 'power'); // different object, same values

    const mappings: PinMapping[] = [
      { sourcePin: pin1, targetPin: sPin('VDD', 'power'), confidence: 0.85 },
    ];

    // pin1Clone is a different object — should NOT be considered mapped
    const unmapped = getUnmappedPins(mappings, [pin1Clone]);
    expect(unmapped).toHaveLength(1);
  });

  it('works end-to-end with mapPinsBySemantics', () => {
    const source: SemanticPin[] = [
      sPin('VCC', 'power'),
      sPin('GND', 'ground'),
      sPin('NC', 'bidirectional'),  // no-connect, unlikely to match well
    ];
    const target: SemanticPin[] = [
      sPin('VDD', 'power'),
      sPin('VSS', 'ground'),
    ];

    const mappings = mapPinsBySemantics(source, target);
    const unmappedSource = getUnmappedPins(mappings, source);
    const unmappedTarget = getUnmappedPins(mappings, target);

    // VCC→VDD and GND→VSS should match; NC left over
    expect(unmappedSource).toHaveLength(1);
    expect(unmappedSource[0].name).toBe('NC');
    expect(unmappedTarget).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Integration — full component mapping scenario
// ---------------------------------------------------------------------------

describe('integration — full component mapping', () => {
  it('maps an I2C sensor breakout to an MCU', () => {
    const sensorPins: SemanticPin[] = [
      sPin('VCC', 'power'),
      sPin('GND', 'ground'),
      sPin('SDA', 'data'),
      sPin('SCL', 'clock'),
      sPin('INT', 'output'),
    ];
    const mcuPins: SemanticPin[] = [
      sPin('3V3', 'power'),
      sPin('GND', 'ground'),
      sPin('SDA', 'data'),
      sPin('SCL', 'clock'),
      sPin('D2', 'bidirectional'),
      sPin('D3', 'bidirectional'),
      sPin('A0', 'analog'),
    ];

    const mappings = mapPinsBySemantics(sensorPins, mcuPins);

    // 5 sensor pins should all find a match
    expect(mappings.length).toBeGreaterThanOrEqual(4);

    // All confidences should be positive
    for (const m of mappings) {
      expect(m.confidence).toBeGreaterThan(0);
    }

    // VCC, GND, SDA, SCL should match with high confidence
    const highConfidence = mappings.filter((m) => m.confidence > 0.4);
    expect(highConfidence.length).toBeGreaterThanOrEqual(4);

    const unmappedMcu = getUnmappedPins(mappings, mcuPins);
    // At least some MCU pins should be unmapped (more MCU pins than sensor pins)
    expect(unmappedMcu.length).toBeGreaterThan(0);
  });
});
