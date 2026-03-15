import { describe, it, expect } from 'vitest';
import {
  mapPin,
  mapEdgePins,
  extractConnectors,
} from '../semantic-pin-mapper';
import type { ConnectorInfo, EdgeContext } from '../semantic-pin-mapper';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pin(id: string, name: string, description?: string): ConnectorInfo {
  return { id, name, description };
}

/** Typical MCU-style connector set */
const MCU_PINS: ConnectorInfo[] = [
  pin('pin1', 'VCC'),
  pin('pin2', 'GND'),
  pin('pin3', 'PB0'),
  pin('pin4', 'PB1'),
  pin('pin5', 'PB2'),
  pin('pin6', 'SDA'),
  pin('pin7', 'SCL'),
  pin('pin8', 'MOSI'),
  pin('pin9', 'MISO'),
  pin('pin10', 'SCK'),
  pin('pin11', 'CS'),
  pin('pin12', 'TX'),
  pin('pin13', 'RX'),
  pin('pin14', 'A0'),
  pin('pin15', 'A1'),
  pin('pin16', 'D0'),
  pin('pin17', 'D1'),
];

/** Sensor with I2C interface */
const I2C_SENSOR_PINS: ConnectorInfo[] = [
  pin('p1', 'VDD'),
  pin('p2', 'GND'),
  pin('p3', 'SDA'),
  pin('p4', 'SCL'),
];

/** SPI flash chip */
const SPI_FLASH_PINS: ConnectorInfo[] = [
  pin('p1', 'VCC'),
  pin('p2', 'GND'),
  pin('p3', 'DI'),   // MOSI / SDI
  pin('p4', 'DO'),   // MISO / SDO
  pin('p5', 'CLK'),  // SCK
  pin('p6', 'CS'),
];

/** Simple two-terminal passive */
const PASSIVE_PINS: ConnectorInfo[] = [
  pin('pin1', '1'),
  pin('pin2', '2'),
];

/** Regulator with named pins */
const REGULATOR_PINS: ConnectorInfo[] = [
  pin('p1', 'IN'),
  pin('p2', 'GND'),
  pin('p3', 'OUT'),
];

// ---------------------------------------------------------------------------
// mapPin — Power rail matching
// ---------------------------------------------------------------------------

describe('mapPin — power rail matching', () => {
  it('matches VCC on power signalType', () => {
    const result = mapPin(MCU_PINS, { signalType: 'power' }, 'source');
    expect(result.pinId).toBe('pin1');
    expect(result.strategy).toBe('power');
  });

  it('matches GND on ground signalType', () => {
    const result = mapPin(MCU_PINS, { signalType: 'ground' }, 'source');
    expect(result.pinId).toBe('pin2');
    expect(result.strategy).toBe('ground');
  });

  it('matches VDD on target I2C sensor for power edge', () => {
    const result = mapPin(I2C_SENSOR_PINS, { signalType: 'power', label: '3.3V' }, 'target');
    expect(result.pinId).toBe('p1');
    expect(result.strategy).toBe('power');
  });

  it('matches GND by label keyword', () => {
    const result = mapPin(I2C_SENSOR_PINS, { label: 'GND rail' }, 'target');
    expect(result.pinId).toBe('p2');
    expect(result.strategy).toBe('ground');
  });

  it('matches power pin from label containing voltage', () => {
    const result = mapPin(MCU_PINS, { label: '5V supply' }, 'source');
    expect(result.pinId).toBe('pin1');
    expect(result.strategy).toBe('power');
  });

  it('matches power pin from netName', () => {
    const result = mapPin(MCU_PINS, { netName: 'VCC_3V3' }, 'source');
    expect(result.pinId).toBe('pin1');
    expect(result.strategy).toBe('power');
  });

  it('matches GND from netName keyword', () => {
    const result = mapPin(MCU_PINS, { netName: 'GND_NET' }, 'source');
    expect(result.pinId).toBe('pin2');
    expect(result.strategy).toBe('ground');
  });

  it('maps IN pin on regulator for power edge', () => {
    const result = mapPin(REGULATOR_PINS, { signalType: 'power', label: 'VIN' }, 'target');
    // No VCC/VDD pin — should fall through to name-similarity on "VIN" → "IN"
    expect(result.strategy).toBe('name-similarity');
    expect(result.pinId).toBe('p1');
  });
});

// ---------------------------------------------------------------------------
// mapPin — I2C matching
// ---------------------------------------------------------------------------

describe('mapPin — I2C matching', () => {
  it('matches SDA on MCU for I2C edge', () => {
    const result = mapPin(MCU_PINS, { label: 'I2C' }, 'source');
    expect(result.pinId).toBe('pin6');
    expect(result.strategy).toBe('i2c');
  });

  it('matches SDA on sensor for I2C edge', () => {
    const result = mapPin(I2C_SENSOR_PINS, { label: 'I2C bus' }, 'target');
    expect(result.pinId).toBe('p3');
    expect(result.strategy).toBe('i2c');
  });

  it('matches SCL when SDA is already used', () => {
    const used = new Set(['p3']);
    const result = mapPin(I2C_SENSOR_PINS, { label: 'I2C' }, 'target', used);
    expect(result.pinId).toBe('p4');
    expect(result.strategy).toBe('i2c');
  });

  it('detects I2C from netName', () => {
    const result = mapPin(MCU_PINS, { netName: 'I2C_DATA' }, 'source');
    expect(result.pinId).toBe('pin6');
    expect(result.strategy).toBe('i2c');
  });

  it('detects TWI as I2C alias', () => {
    const result = mapPin(MCU_PINS, { label: 'TWI bus' }, 'source');
    expect(result.pinId).toBe('pin6');
    expect(result.strategy).toBe('i2c');
  });
});

// ---------------------------------------------------------------------------
// mapPin — SPI matching
// ---------------------------------------------------------------------------

describe('mapPin — SPI matching', () => {
  it('matches MOSI on source MCU for SPI edge', () => {
    const result = mapPin(MCU_PINS, { label: 'SPI' }, 'source');
    expect(result.pinId).toBe('pin8');
    expect(result.strategy).toBe('spi');
  });

  it('matches MISO on target for SPI edge', () => {
    const result = mapPin(MCU_PINS, { label: 'SPI' }, 'target');
    expect(result.pinId).toBe('pin9');
    expect(result.strategy).toBe('spi');
  });

  it('matches DI (MOSI alias) on SPI flash as target', () => {
    // SPI flash target should try MISO first, but the flash uses DO for output
    // The target prefers MISO → DO matches SPI_MISO_PATTERNS
    const result = mapPin(SPI_FLASH_PINS, { label: 'SPI' }, 'target');
    expect(result.pinId).toBe('p4'); // DO
    expect(result.strategy).toBe('spi');
  });

  it('matches DI (MOSI alias) on SPI flash as source', () => {
    const result = mapPin(SPI_FLASH_PINS, { label: 'SPI' }, 'source');
    expect(result.pinId).toBe('p3'); // DI → matches MOSI patterns
    expect(result.strategy).toBe('spi');
  });

  it('picks SCK when MOSI is used on source', () => {
    const used = new Set(['pin8']);
    const result = mapPin(MCU_PINS, { label: 'SPI' }, 'source', used);
    expect(result.pinId).toBe('pin10'); // SCK
    expect(result.strategy).toBe('spi');
  });

  it('picks CS when MOSI and SCK are used', () => {
    const used = new Set(['pin8', 'pin10']);
    const result = mapPin(MCU_PINS, { label: 'SPI' }, 'source', used);
    expect(result.pinId).toBe('pin11'); // CS
    expect(result.strategy).toBe('spi');
  });
});

// ---------------------------------------------------------------------------
// mapPin — UART matching
// ---------------------------------------------------------------------------

describe('mapPin — UART matching', () => {
  it('matches TX on source for UART edge', () => {
    const result = mapPin(MCU_PINS, { label: 'UART' }, 'source');
    expect(result.pinId).toBe('pin12');
    expect(result.strategy).toBe('uart');
  });

  it('matches RX on target for UART edge', () => {
    const result = mapPin(MCU_PINS, { label: 'UART' }, 'target');
    expect(result.pinId).toBe('pin13');
    expect(result.strategy).toBe('uart');
  });

  it('detects serial keyword as UART', () => {
    const result = mapPin(MCU_PINS, { label: 'Serial' }, 'source');
    expect(result.pinId).toBe('pin12');
    expect(result.strategy).toBe('uart');
  });

  it('detects USART keyword as UART', () => {
    const result = mapPin(MCU_PINS, { label: 'USART debug' }, 'target');
    expect(result.pinId).toBe('pin13');
    expect(result.strategy).toBe('uart');
  });

  it('picks TX when RX is used on target', () => {
    const used = new Set(['pin13']);
    const result = mapPin(MCU_PINS, { label: 'UART' }, 'target', used);
    expect(result.pinId).toBe('pin12'); // falls back to TX
    expect(result.strategy).toBe('uart');
  });
});

// ---------------------------------------------------------------------------
// mapPin — Analog matching
// ---------------------------------------------------------------------------

describe('mapPin — analog matching', () => {
  it('matches A0 for ADC edge', () => {
    const result = mapPin(MCU_PINS, { label: 'ADC input' }, 'source');
    expect(result.pinId).toBe('pin14');
    expect(result.strategy).toBe('analog');
  });

  it('matches A1 when A0 is used', () => {
    const used = new Set(['pin14']);
    const result = mapPin(MCU_PINS, { label: 'analog sensor' }, 'source', used);
    expect(result.pinId).toBe('pin15'); // A1
    expect(result.strategy).toBe('analog');
  });

  it('detects analog from netName', () => {
    const result = mapPin(MCU_PINS, { netName: 'AIN_TEMP' }, 'source');
    expect(result.pinId).toBe('pin14');
    expect(result.strategy).toBe('analog');
  });
});

// ---------------------------------------------------------------------------
// mapPin — Digital / GPIO matching
// ---------------------------------------------------------------------------

describe('mapPin — digital/GPIO matching', () => {
  it('matches D0 for generic signal edge', () => {
    const result = mapPin(MCU_PINS, { signalType: 'signal' }, 'source');
    expect(result.pinId).toBe('pin16');
    expect(result.strategy).toBe('digital');
  });

  it('matches PB0 when D0/D1 are used', () => {
    const used = new Set(['pin16', 'pin17']);
    const result = mapPin(MCU_PINS, { signalType: 'signal' }, 'source', used);
    expect(result.pinId).toBe('pin3'); // PB0
    expect(result.strategy).toBe('digital');
  });

  it('matches digital for empty signalType', () => {
    const result = mapPin(MCU_PINS, {}, 'source');
    expect(result.pinId).toBe('pin16');
    expect(result.strategy).toBe('digital');
  });

  it('matches digital for bus signalType', () => {
    const result = mapPin(MCU_PINS, { signalType: 'bus' }, 'source');
    expect(result.pinId).toBe('pin16');
    expect(result.strategy).toBe('digital');
  });
});

// ---------------------------------------------------------------------------
// mapPin — Name similarity matching
// ---------------------------------------------------------------------------

describe('mapPin — name similarity', () => {
  it('matches pin by name token overlap', () => {
    const pins = [pin('p1', 'ENABLE'), pin('p2', 'RESET'), pin('p3', 'OUTPUT')];
    const result = mapPin(pins, { label: 'Reset signal', signalType: 'control' }, 'source');
    expect(result.pinId).toBe('p2');
    expect(result.strategy).toBe('name-similarity');
  });

  it('matches partial name overlap', () => {
    const pins = [pin('p1', 'LED_OUT'), pin('p2', 'BUZZER'), pin('p3', 'MOTOR_PWM')];
    const result = mapPin(pins, { label: 'LED driver', signalType: 'control' }, 'source');
    expect(result.pinId).toBe('p1');
    expect(result.strategy).toBe('name-similarity');
  });

  it('prefers unused pin on name similarity', () => {
    const pins = [pin('p1', 'ENABLE'), pin('p2', 'ENABLE_2')];
    const used = new Set(['p1']);
    const result = mapPin(pins, { label: 'ENABLE control', signalType: 'control' }, 'source', used);
    expect(result.pinId).toBe('p2');
    expect(result.strategy).toBe('name-similarity');
  });
});

// ---------------------------------------------------------------------------
// mapPin — Positional fallback
// ---------------------------------------------------------------------------

describe('mapPin — positional fallback', () => {
  it('falls back to first pin on passive part', () => {
    const result = mapPin(PASSIVE_PINS, { signalType: 'signal' }, 'source');
    expect(result.pinId).toBe('pin1');
    expect(result.strategy).toBe('positional-fallback');
  });

  it('falls back to pin1 when connectors are empty', () => {
    const result = mapPin([], { signalType: 'power' }, 'source');
    expect(result.pinId).toBe('pin1');
    expect(result.strategy).toBe('positional-fallback');
  });

  it('prefers unused pin in fallback', () => {
    const used = new Set(['pin1']);
    const result = mapPin(PASSIVE_PINS, { signalType: 'signal' }, 'source', used);
    expect(result.pinId).toBe('pin2');
    expect(result.strategy).toBe('positional-fallback');
  });
});

// ---------------------------------------------------------------------------
// mapEdgePins — batch helper
// ---------------------------------------------------------------------------

describe('mapEdgePins', () => {
  it('maps both sides of an I2C edge', () => {
    const usedSrc = new Set<string>();
    const usedTgt = new Set<string>();
    const edge: EdgeContext = { label: 'I2C', signalType: 'signal' };

    const result = mapEdgePins(MCU_PINS, I2C_SENSOR_PINS, edge, usedSrc, usedTgt);

    expect(result.fromPin.strategy).toBe('i2c');
    expect(result.fromPin.pinId).toBe('pin6'); // SDA on MCU
    expect(result.toPin.strategy).toBe('i2c');
    expect(result.toPin.pinId).toBe('p3'); // SDA on sensor
  });

  it('tracks used pins across successive calls', () => {
    const usedSrc = new Set<string>();
    const usedTgt = new Set<string>();
    const edge: EdgeContext = { label: 'I2C', signalType: 'signal' };

    // First call claims SDA on both sides
    const first = mapEdgePins(MCU_PINS, I2C_SENSOR_PINS, edge, usedSrc, usedTgt);
    expect(first.fromPin.pinId).toBe('pin6'); // SDA
    expect(first.toPin.pinId).toBe('p3');     // SDA

    // Second call should claim SCL (SDA already used)
    const second = mapEdgePins(MCU_PINS, I2C_SENSOR_PINS, edge, usedSrc, usedTgt);
    expect(second.fromPin.pinId).toBe('pin7'); // SCL
    expect(second.toPin.pinId).toBe('p4');     // SCL
  });

  it('maps power edge correctly', () => {
    const usedSrc = new Set<string>();
    const usedTgt = new Set<string>();
    const edge: EdgeContext = { signalType: 'power', label: '3.3V' };

    const result = mapEdgePins(REGULATOR_PINS, I2C_SENSOR_PINS, edge, usedSrc, usedTgt);
    // Regulator has no VCC/VDD pin, so falls through to name-similarity or fallback
    // Sensor has VDD
    expect(result.toPin.pinId).toBe('p1'); // VDD
    expect(result.toPin.strategy).toBe('power');
  });

  it('maps UART edge with correct TX/RX crossover', () => {
    const srcPins = [pin('s1', 'TX'), pin('s2', 'RX'), pin('s3', 'VCC'), pin('s4', 'GND')];
    const tgtPins = [pin('t1', 'RX'), pin('t2', 'TX'), pin('t3', 'VCC'), pin('t4', 'GND')];
    const usedSrc = new Set<string>();
    const usedTgt = new Set<string>();
    const edge: EdgeContext = { label: 'UART' };

    const result = mapEdgePins(srcPins, tgtPins, edge, usedSrc, usedTgt);
    expect(result.fromPin.pinId).toBe('s1'); // TX on source
    expect(result.fromPin.strategy).toBe('uart');
    expect(result.toPin.pinId).toBe('t1');   // RX on target
    expect(result.toPin.strategy).toBe('uart');
  });
});

// ---------------------------------------------------------------------------
// extractConnectors
// ---------------------------------------------------------------------------

describe('extractConnectors', () => {
  it('extracts valid connectors from part object', () => {
    const part = {
      connectors: [
        { id: 'c1', name: 'VCC', description: 'Power' },
        { id: 'c2', name: 'GND' },
      ],
    };
    const result = extractConnectors(part);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 'c1', name: 'VCC', description: 'Power' });
    expect(result[1]).toEqual({ id: 'c2', name: 'GND', description: undefined });
  });

  it('returns empty array for missing connectors', () => {
    expect(extractConnectors({})).toEqual([]);
  });

  it('returns empty array for non-array connectors', () => {
    expect(extractConnectors({ connectors: 'invalid' })).toEqual([]);
  });

  it('filters out malformed connector entries', () => {
    const part = {
      connectors: [
        { id: 'c1', name: 'VCC' },
        { id: 42, name: 'BAD_ID' },  // id not string
        { name: 'NO_ID' },            // missing id
        null,
        'string',
        { id: 'c2' },                 // missing name
      ],
    };
    const result = extractConnectors(part);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c1');
  });

  it('returns empty array for null connectors', () => {
    expect(extractConnectors({ connectors: null })).toEqual([]);
  });
});
