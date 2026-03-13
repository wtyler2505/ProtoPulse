/**
 * Protocol Decoder tests — I2C, SPI, UART decoders + formatting + manager.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  decodeI2C,
  decodeSPI,
  decodeUART,
  formatFrame,
  formatTimestamp,
  ProtocolDecoderManager,
} from '../protocol-decoder';
import type {
  I2CFrame,
  SPIFrame,
  UARTFrame,
  DecodedFrame,
  DisplayMode,
} from '../protocol-decoder';

// ---------------------------------------------------------------------------
// Constants mirrored from source (sentinel bytes)
// ---------------------------------------------------------------------------

const I2C_START = 0xfe;
const I2C_STOP = 0xff;
const I2C_REPEATED_START = 0xfd;
const ACK = 0x00;
const NACK = 0x01;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a 7-bit I2C address byte: address << 1 | rw (0=W, 1=R). */
function i2cAddrByte(address: number, read: boolean): number {
  return ((address & 0x7f) << 1) | (read ? 1 : 0);
}

// ===========================================================================
// I2C Decoder
// ===========================================================================

describe('decodeI2C', () => {
  it('decodes a valid 7-bit write transaction', () => {
    const bytes = [I2C_START, i2cAddrByte(0x50, false), ACK, 0x42, ACK, I2C_STOP];
    const frames = decodeI2C(bytes);

    expect(frames).toHaveLength(1);
    const f = frames[0];
    expect(f.protocol).toBe('I2C');
    expect(f.startCondition).toBe(true);
    expect(f.address).toBe(0x50);
    expect(f.readWrite).toBe('W');
    expect(f.ackNack).toContain('ACK');
    expect(f.dataBytes).toEqual([0x42]);
    expect(f.stopCondition).toBe(true);
    expect(f.errors).toHaveLength(0);
  });

  it('decodes a valid 7-bit read transaction', () => {
    const bytes = [I2C_START, i2cAddrByte(0x3c, true), ACK, 0xab, ACK, I2C_STOP];
    const frames = decodeI2C(bytes);

    expect(frames).toHaveLength(1);
    expect(frames[0].readWrite).toBe('R');
    expect(frames[0].address).toBe(0x3c);
    expect(frames[0].dataBytes).toEqual([0xab]);
  });

  it('detects NACK on address byte', () => {
    const bytes = [I2C_START, i2cAddrByte(0x50, false), NACK, I2C_STOP];
    const frames = decodeI2C(bytes);

    expect(frames).toHaveLength(1);
    expect(frames[0].ackNack).toContain('NACK');
    expect(frames[0].errors.length).toBeGreaterThan(0);
    expect(frames[0].errors[0]).toContain('NACK');
  });

  it('decodes multiple data bytes with ACK/NACK', () => {
    const bytes = [
      I2C_START,
      i2cAddrByte(0x50, false), ACK,
      0x10, ACK,
      0x20, ACK,
      0x30, NACK,
      I2C_STOP,
    ];
    const frames = decodeI2C(bytes);

    expect(frames).toHaveLength(1);
    expect(frames[0].dataBytes).toEqual([0x10, 0x20, 0x30]);
    expect(frames[0].ackNack).toEqual(['ACK', 'ACK', 'ACK', 'NACK']);
  });

  it('decodes 10-bit address mode', () => {
    // 10-bit: first byte = 11110 XX R/W, second byte = lower 8 bits
    const firstByte = (0x78 | (0x01 << 1)) & 0xfe; // upper 2 = 01, write
    const secondByte = 0x55; // lower 8 bits
    const bytes = [I2C_START, firstByte, ACK, secondByte, ACK, 0xaa, ACK, I2C_STOP];
    const frames = decodeI2C(bytes, { addressMode: '10bit' });

    expect(frames).toHaveLength(1);
    expect(frames[0].addressMode).toBe('10bit');
    expect(frames[0].address).toBe((1 << 8) | 0x55);
  });

  it('handles 10-bit address with NACK on first byte', () => {
    const firstByte = 0x78; // upper 2 = 00, write
    const bytes = [I2C_START, firstByte, NACK, 0x00, ACK, I2C_STOP];
    const frames = decodeI2C(bytes, { addressMode: '10bit' });

    expect(frames).toHaveLength(1);
    expect(frames[0].errors).toContain('NACK on first address byte (10-bit)');
  });

  it('handles 10-bit address with NACK on second byte', () => {
    const firstByte = 0x78; // upper 2 = 00, write
    const bytes = [I2C_START, firstByte, ACK, 0x00, NACK, I2C_STOP];
    const frames = decodeI2C(bytes, { addressMode: '10bit' });

    expect(frames).toHaveLength(1);
    expect(frames[0].errors).toContain('NACK on second address byte (10-bit)');
  });

  it('detects repeated start condition', () => {
    const bytes = [
      I2C_START, i2cAddrByte(0x50, false), ACK, 0x00, ACK,
      I2C_REPEATED_START, i2cAddrByte(0x50, true), ACK, 0xab, ACK, I2C_STOP,
    ];
    const frames = decodeI2C(bytes);

    expect(frames).toHaveLength(2);
    expect(frames[0].repeatedStart).toBe(false);
    expect(frames[1].repeatedStart).toBe(true);
    expect(frames[1].readWrite).toBe('R');
  });

  it('warns on missing STOP condition', () => {
    const bytes = [I2C_START, i2cAddrByte(0x50, false), ACK, 0x42, ACK];
    const frames = decodeI2C(bytes);

    expect(frames).toHaveLength(1);
    expect(frames[0].warnings.length).toBeGreaterThan(0);
    expect(frames[0].warnings[0]).toContain('Missing STOP');
  });

  it('returns empty array for empty input', () => {
    expect(decodeI2C([])).toEqual([]);
  });

  it('returns empty array when no start condition found', () => {
    expect(decodeI2C([0x42, 0x43, 0x44])).toEqual([]);
  });

  it('handles start immediately followed by stop', () => {
    const bytes = [I2C_START, I2C_STOP];
    const frames = decodeI2C(bytes);
    // START then STOP: address is 0x7F (STOP=0xFF >> 1), rw=R (0xFF & 1)
    // and STOP was consumed as address byte — frame stops with no data
    expect(frames).toHaveLength(1);
  });

  it('decodes multiple consecutive transactions', () => {
    const bytes = [
      I2C_START, i2cAddrByte(0x10, false), ACK, 0x01, ACK, I2C_STOP,
      I2C_START, i2cAddrByte(0x20, true), ACK, 0x02, ACK, I2C_STOP,
    ];
    const frames = decodeI2C(bytes);

    expect(frames).toHaveLength(2);
    expect(frames[0].address).toBe(0x10);
    expect(frames[1].address).toBe(0x20);
  });

  it('handles address byte at end of stream', () => {
    const bytes = [I2C_START, i2cAddrByte(0x50, false)];
    const frames = decodeI2C(bytes);

    expect(frames).toHaveLength(1);
    expect(frames[0].address).toBe(0x50);
    expect(frames[0].ackNack).toHaveLength(0);
  });

  it('assigns sequential timestamps', () => {
    const bytes = [
      I2C_START, i2cAddrByte(0x10, false), ACK, I2C_STOP,
      I2C_START, i2cAddrByte(0x20, false), ACK, I2C_STOP,
    ];
    const frames = decodeI2C(bytes);

    expect(frames[0].timestamp).toBe(0);
    expect(frames[1].timestamp).toBe(1);
  });

  it('uses default 7bit address mode', () => {
    const bytes = [I2C_START, i2cAddrByte(0x50, false), ACK, I2C_STOP];
    const frames = decodeI2C(bytes);
    expect(frames[0].addressMode).toBe('7bit');
  });

  it('passes speed grade option through', () => {
    const bytes = [I2C_START, i2cAddrByte(0x50, false), ACK, I2C_STOP];
    const frames = decodeI2C(bytes, { speedGrade: 'highspeed' });
    // Speed grade doesn't affect decoding but is accepted without error
    expect(frames).toHaveLength(1);
  });
});

// ===========================================================================
// SPI Decoder
// ===========================================================================

describe('decodeSPI', () => {
  it('decodes a single-byte transfer (mode 0, MSB)', () => {
    const frames = decodeSPI([0xab], [0xcd]);

    expect(frames).toHaveLength(1);
    const f = frames[0];
    expect(f.protocol).toBe('SPI');
    expect(f.csActive).toBe(true);
    expect(f.mosiData).toEqual([0xab]);
    expect(f.misoData).toEqual([0xcd]);
    expect(f.bitCount).toBe(8);
    expect(f.wordSize).toBe(8);
    expect(f.cpol).toBe(0);
    expect(f.cpha).toBe(0);
  });

  it('decodes mode 1 (CPOL=0, CPHA=1)', () => {
    const frames = decodeSPI([0x55], [0xaa], { cpol: 0, cpha: 1 });

    expect(frames).toHaveLength(1);
    expect(frames[0].cpol).toBe(0);
    expect(frames[0].cpha).toBe(1);
  });

  it('decodes mode 2 (CPOL=1, CPHA=0)', () => {
    const frames = decodeSPI([0x55], [0xaa], { cpol: 1, cpha: 0 });

    expect(frames).toHaveLength(1);
    expect(frames[0].cpol).toBe(1);
    expect(frames[0].cpha).toBe(0);
  });

  it('decodes mode 3 (CPOL=1, CPHA=1)', () => {
    const frames = decodeSPI([0x55], [0xaa], { cpol: 1, cpha: 1 });

    expect(frames).toHaveLength(1);
    expect(frames[0].cpol).toBe(1);
    expect(frames[0].cpha).toBe(1);
  });

  it('handles LSB-first bit order', () => {
    // 0xA5 = 10100101 → reversed = 10100101 = 0xA5 (palindrome)
    // 0x80 = 10000000 → reversed = 00000001 = 0x01
    const frames = decodeSPI([0x80], [0x01], { bitOrder: 'LSB' });

    expect(frames).toHaveLength(1);
    expect(frames[0].mosiData).toEqual([0x01]); // reversed
    expect(frames[0].misoData).toEqual([0x80]); // reversed
  });

  it('handles MSB-first bit order (default)', () => {
    const frames = decodeSPI([0x80], [0x01], { bitOrder: 'MSB' });

    expect(frames).toHaveLength(1);
    expect(frames[0].mosiData).toEqual([0x80]); // unchanged
    expect(frames[0].misoData).toEqual([0x01]); // unchanged
  });

  it('groups into 16-bit words', () => {
    const frames = decodeSPI([0x12, 0x34, 0x56, 0x78], [0xab, 0xcd, 0xef, 0x01], { wordSize: 16 });

    expect(frames).toHaveLength(2);
    expect(frames[0].mosiData).toEqual([0x12, 0x34]);
    expect(frames[0].misoData).toEqual([0xab, 0xcd]);
    expect(frames[1].mosiData).toEqual([0x56, 0x78]);
    expect(frames[1].misoData).toEqual([0xef, 0x01]);
    expect(frames[0].wordSize).toBe(16);
  });

  it('groups into 32-bit words', () => {
    const mosi = [0x01, 0x02, 0x03, 0x04];
    const miso = [0x05, 0x06, 0x07, 0x08];
    const frames = decodeSPI(mosi, miso, { wordSize: 32 });

    expect(frames).toHaveLength(1);
    expect(frames[0].mosiData).toEqual([0x01, 0x02, 0x03, 0x04]);
    expect(frames[0].bitCount).toBe(32);
  });

  it('warns on incomplete word', () => {
    const frames = decodeSPI([0x12, 0x34, 0x56], [0xab, 0xcd, 0xef], { wordSize: 16 });

    expect(frames).toHaveLength(2);
    expect(frames[1].warnings.length).toBeGreaterThan(0);
    expect(frames[1].warnings[0]).toContain('Incomplete word');
  });

  it('pads shorter MISO array', () => {
    const frames = decodeSPI([0x12, 0x34], [0xab]);

    expect(frames).toHaveLength(2);
    expect(frames[1].misoData).toEqual([0x00]);
  });

  it('pads shorter MOSI array', () => {
    const frames = decodeSPI([0x12], [0xab, 0xcd]);

    expect(frames).toHaveLength(2);
    expect(frames[1].mosiData).toEqual([0x00]);
  });

  it('returns empty array for empty input', () => {
    expect(decodeSPI([], [])).toEqual([]);
  });

  it('assigns sequential timestamps', () => {
    const frames = decodeSPI([0x01, 0x02, 0x03], [0x04, 0x05, 0x06]);

    expect(frames[0].timestamp).toBe(0);
    expect(frames[1].timestamp).toBe(1);
    expect(frames[2].timestamp).toBe(2);
  });
});

// ===========================================================================
// UART Decoder
// ===========================================================================

describe('decodeUART', () => {
  it('decodes standard 8N1 bytes', () => {
    const frames = decodeUART([0x48, 0x65, 0x6c, 0x6c, 0x6f]);

    expect(frames).toHaveLength(5);
    expect(frames[0].protocol).toBe('UART');
    expect(frames[0].data).toBe(0x48); // 'H'
    expect(frames[0].dataBits).toBe(8);
    expect(frames[0].parity).toBe('none');
    expect(frames[0].stopBits).toBe(1);
    expect(frames[0].parityError).toBe(false);
    expect(frames[0].framingError).toBe(false);
  });

  it('decodes with 7 data bits', () => {
    const frames = decodeUART([0x48], { dataBits: 7 });

    expect(frames).toHaveLength(1);
    expect(frames[0].dataBits).toBe(7);
    expect(frames[0].data).toBe(0x48);
  });

  it('decodes with 5 data bits', () => {
    const frames = decodeUART([0x1f], { dataBits: 5 });

    expect(frames).toHaveLength(1);
    expect(frames[0].data).toBe(0x1f);
    expect(frames[0].framingError).toBe(false);
  });

  it('decodes with 9 data bits', () => {
    const frames = decodeUART([0xff], { dataBits: 9 });

    expect(frames).toHaveLength(1);
    expect(frames[0].data).toBe(0xff);
  });

  it('detects framing error when byte exceeds data-bit range', () => {
    // 5-bit max is 0x1F; 0x20 exceeds it
    const frames = decodeUART([0x20], { dataBits: 5 });

    expect(frames).toHaveLength(1);
    expect(frames[0].framingError).toBe(true);
    expect(frames[0].errors.length).toBeGreaterThan(0);
    expect(frames[0].errors[0]).toContain('Framing error');
  });

  it('detects even parity error', () => {
    // dataBits=7, parity=even, value=0x41 (01000001) → 2 ones → even parity bit should be 0
    // Byte: data=0x41 (bits 0-6), parityBit=bit7=1 → wrong (should be 0)
    const byteWithBadParity = 0x41 | (1 << 7); // 0xC1
    const frames = decodeUART([byteWithBadParity], { dataBits: 7, parity: 'even' });

    expect(frames).toHaveLength(1);
    expect(frames[0].parityError).toBe(true);
    expect(frames[0].errors[0]).toContain('Parity error');
  });

  it('accepts valid even parity', () => {
    // 0x41 = 01000001 → 2 ones → even parity bit = 0
    const byteWithGoodParity = 0x41; // parity bit (bit 7) = 0
    const frames = decodeUART([byteWithGoodParity], { dataBits: 7, parity: 'even' });

    expect(frames).toHaveLength(1);
    expect(frames[0].parityError).toBe(false);
  });

  it('detects odd parity error', () => {
    // 0x41 = 01000001 → 2 ones → odd parity bit should be 1
    // Byte with parity bit 0 = just 0x41 → wrong for odd parity
    const frames = decodeUART([0x41], { dataBits: 7, parity: 'odd' });

    expect(frames).toHaveLength(1);
    expect(frames[0].parityError).toBe(true);
  });

  it('accepts valid odd parity', () => {
    // 0x41 = 01000001 → 2 ones → odd parity bit = 1
    const byteWithGoodOddParity = 0x41 | (1 << 7); // 0xC1
    const frames = decodeUART([byteWithGoodOddParity], { dataBits: 7, parity: 'odd' });

    expect(frames).toHaveLength(1);
    expect(frames[0].parityError).toBe(false);
  });

  it('handles stop bits configuration', () => {
    const frames1 = decodeUART([0x48], { stopBits: 1 });
    const frames2 = decodeUART([0x48], { stopBits: 2 });
    const frames3 = decodeUART([0x48], { stopBits: 1.5 });

    expect(frames1[0].stopBits).toBe(1);
    expect(frames2[0].stopBits).toBe(2);
    expect(frames3[0].stopBits).toBe(1.5);
  });

  it('returns empty array for empty input', () => {
    expect(decodeUART([])).toEqual([]);
  });

  it('assigns sequential timestamps', () => {
    const frames = decodeUART([0x41, 0x42, 0x43]);

    expect(frames[0].timestamp).toBe(0);
    expect(frames[1].timestamp).toBe(1);
    expect(frames[2].timestamp).toBe(2);
  });

  it('masks data to data-bit width', () => {
    // 0xFF with 5 data bits should mask to 0x1F
    // But when parity=none and value > max, it's a framing error
    // Use parity=even so masking occurs without framing error
    const frames = decodeUART([0xff], { dataBits: 5, parity: 'even' });

    expect(frames).toHaveLength(1);
    expect(frames[0].data).toBe(0x1f); // lower 5 bits
  });

  it('uses default options when none provided', () => {
    const frames = decodeUART([0x48]);

    expect(frames[0].dataBits).toBe(8);
    expect(frames[0].parity).toBe('none');
    expect(frames[0].stopBits).toBe(1);
  });
});

// ===========================================================================
// Format Functions
// ===========================================================================

describe('formatFrame', () => {
  const makeI2CFrame = (overrides?: Partial<I2CFrame>): I2CFrame => ({
    protocol: 'I2C',
    timestamp: 0,
    startCondition: true,
    address: 0x50,
    addressMode: '7bit',
    readWrite: 'W',
    ackNack: ['ACK'],
    dataBytes: [0x42],
    stopCondition: true,
    repeatedStart: false,
    errors: [],
    warnings: [],
    ...overrides,
  });

  const makeSPIFrame = (overrides?: Partial<SPIFrame>): SPIFrame => ({
    protocol: 'SPI',
    timestamp: 0,
    csActive: true,
    mosiData: [0xab],
    misoData: [0xcd],
    bitCount: 8,
    wordSize: 8,
    cpol: 0,
    cpha: 0,
    bitOrder: 'MSB',
    errors: [],
    warnings: [],
    ...overrides,
  });

  const makeUARTFrame = (overrides?: Partial<UARTFrame>): UARTFrame => ({
    protocol: 'UART',
    timestamp: 0,
    dataBits: 8,
    parity: 'none',
    stopBits: 1,
    data: 0x48,
    parityError: false,
    framingError: false,
    errors: [],
    warnings: [],
    ...overrides,
  });

  it('formats I2C frame in hex mode', () => {
    const result = formatFrame(makeI2CFrame(), 'hex');
    expect(result).toContain('[I2C]');
    expect(result).toContain('0x50');
    expect(result).toContain('W');
    expect(result).toContain('0x42');
  });

  it('formats I2C frame in decimal mode', () => {
    const result = formatFrame(makeI2CFrame(), 'decimal');
    expect(result).toContain('80'); // 0x50 = 80
    expect(result).toContain('66'); // 0x42 = 66
  });

  it('formats I2C frame in binary mode', () => {
    const result = formatFrame(makeI2CFrame({ address: 0x01, dataBytes: [0x02] }), 'binary');
    expect(result).toContain('0b00000001');
    expect(result).toContain('0b00000010');
  });

  it('formats I2C frame in ASCII mode', () => {
    const result = formatFrame(makeI2CFrame({ dataBytes: [0x41] }), 'ascii');
    expect(result).toContain('A'); // 0x41 = 'A'
  });

  it('formats SPI frame in hex mode', () => {
    const result = formatFrame(makeSPIFrame(), 'hex');
    expect(result).toContain('[SPI]');
    expect(result).toContain('MOSI');
    expect(result).toContain('0xAB');
    expect(result).toContain('MISO');
    expect(result).toContain('0xCD');
  });

  it('formats UART frame in hex mode', () => {
    const result = formatFrame(makeUARTFrame(), 'hex');
    expect(result).toContain('[UART]');
    expect(result).toContain('0x48');
  });

  it('formats UART frame with parity error', () => {
    const result = formatFrame(makeUARTFrame({ parityError: true }), 'hex');
    expect(result).toContain('PARITY_ERR');
  });

  it('formats UART frame with framing error', () => {
    const result = formatFrame(makeUARTFrame({ framingError: true }), 'hex');
    expect(result).toContain('FRAME_ERR');
  });

  it('formats non-printable ASCII as dot', () => {
    const result = formatFrame(makeUARTFrame({ data: 0x01 }), 'ascii');
    expect(result).toContain('.');
  });
});

describe('formatTimestamp', () => {
  it('formats absolute timestamp', () => {
    const ts = new Date(2026, 0, 15, 14, 30, 45, 123).getTime();
    const result = formatTimestamp(ts, 'absolute');
    expect(result).toBe('14:30:45.123');
  });

  it('formats relative timestamp', () => {
    const result = formatTimestamp(1500, 'relative', 1000);
    expect(result).toBe('+500.000ms');
  });

  it('formats relative timestamp with default ref', () => {
    const result = formatTimestamp(500, 'relative');
    expect(result).toBe('+500.000ms');
  });

  it('formats delta timestamp in milliseconds', () => {
    const result = formatTimestamp(1500, 'delta', 1000);
    expect(result).toBe('500.000ms');
  });

  it('formats delta timestamp in seconds for large values', () => {
    const result = formatTimestamp(5000, 'delta', 0);
    expect(result).toBe('5.000s');
  });

  it('formats delta timestamp with default ref', () => {
    const result = formatTimestamp(250, 'delta');
    expect(result).toBe('250.000ms');
  });

  it('formats midnight absolute timestamp', () => {
    const ts = new Date(2026, 0, 1, 0, 0, 0, 0).getTime();
    const result = formatTimestamp(ts, 'absolute');
    expect(result).toBe('00:00:00.000');
  });

  it('formats zero delta', () => {
    const result = formatTimestamp(100, 'delta', 100);
    expect(result).toBe('0.000ms');
  });
});

// ===========================================================================
// Edge Cases
// ===========================================================================

describe('edge cases', () => {
  it('I2C: single byte input (just start)', () => {
    const frames = decodeI2C([I2C_START]);
    // START at end of stream — no address byte available
    expect(frames).toHaveLength(0);
  });

  it('I2C: handles garbage before start', () => {
    const bytes = [0x42, 0x43, I2C_START, i2cAddrByte(0x10, false), ACK, I2C_STOP];
    const frames = decodeI2C(bytes);
    expect(frames).toHaveLength(1);
    expect(frames[0].address).toBe(0x10);
  });

  it('SPI: single byte MOSI only', () => {
    const frames = decodeSPI([0xff], []);
    expect(frames).toHaveLength(1);
    expect(frames[0].mosiData).toEqual([0xff]);
    expect(frames[0].misoData).toEqual([0x00]);
  });

  it('SPI: single byte MISO only', () => {
    const frames = decodeSPI([], [0xff]);
    expect(frames).toHaveLength(1);
    expect(frames[0].mosiData).toEqual([0x00]);
    expect(frames[0].misoData).toEqual([0xff]);
  });

  it('UART: single byte', () => {
    const frames = decodeUART([0x00]);
    expect(frames).toHaveLength(1);
    expect(frames[0].data).toBe(0);
  });

  it('UART: max value for 8-bit', () => {
    const frames = decodeUART([0xff]);
    expect(frames).toHaveLength(1);
    expect(frames[0].data).toBe(0xff);
    expect(frames[0].framingError).toBe(false);
  });

  it('UART: byte 0xFF with 7 data bits is a framing error', () => {
    const frames = decodeUART([0xff], { dataBits: 7 });
    expect(frames).toHaveLength(1);
    expect(frames[0].framingError).toBe(true);
  });

  it('I2C: all bytes are stops', () => {
    const frames = decodeI2C([I2C_STOP, I2C_STOP, I2C_STOP]);
    expect(frames).toHaveLength(0);
  });
});

// ===========================================================================
// ProtocolDecoderManager
// ===========================================================================

describe('ProtocolDecoderManager', () => {
  beforeEach(() => {
    ProtocolDecoderManager.resetInstance();
  });

  it('returns a singleton instance', () => {
    const a = ProtocolDecoderManager.getInstance();
    const b = ProtocolDecoderManager.getInstance();
    expect(a).toBe(b);
  });

  it('returns a new instance after reset', () => {
    const a = ProtocolDecoderManager.getInstance();
    ProtocolDecoderManager.resetInstance();
    const b = ProtocolDecoderManager.getInstance();
    expect(a).not.toBe(b);
  });

  it('defaults to I2C protocol and hex display', () => {
    const mgr = ProtocolDecoderManager.getInstance();
    const state = mgr.getSnapshot();
    expect(state.protocol).toBe('I2C');
    expect(state.displayMode).toBe('hex');
    expect(state.frames).toEqual([]);
  });

  it('subscribe and unsubscribe work', () => {
    const mgr = ProtocolDecoderManager.getInstance();
    let callCount = 0;
    const unsub = mgr.subscribe(() => {
      callCount++;
    });

    mgr.setProtocol('SPI');
    expect(callCount).toBe(1);

    unsub();
    mgr.setProtocol('UART');
    expect(callCount).toBe(1); // no more calls after unsubscribe
  });

  it('setProtocol changes protocol and clears frames', () => {
    const mgr = ProtocolDecoderManager.getInstance();
    mgr.decodeBytes([0x48]); // decode as I2C (some result)
    mgr.setProtocol('UART');

    const state = mgr.getSnapshot();
    expect(state.protocol).toBe('UART');
    expect(state.frames).toEqual([]);
  });

  it('setDisplayMode changes display mode', () => {
    const mgr = ProtocolDecoderManager.getInstance();
    mgr.setDisplayMode('binary');
    expect(mgr.getSnapshot().displayMode).toBe('binary');
  });

  it('setTimestampFormat changes timestamp format', () => {
    const mgr = ProtocolDecoderManager.getInstance();
    mgr.setTimestampFormat('relative');
    expect(mgr.getSnapshot().timestampFormat).toBe('relative');
  });

  it('decodeBytes decodes using current protocol', () => {
    const mgr = ProtocolDecoderManager.getInstance();
    mgr.setProtocol('UART');
    mgr.decodeBytes([0x48, 0x65]);

    const state = mgr.getSnapshot();
    expect(state.frames).toHaveLength(2);
    expect(state.frames[0].protocol).toBe('UART');
  });

  it('decodeBytes accumulates frames', () => {
    const mgr = ProtocolDecoderManager.getInstance();
    mgr.setProtocol('UART');
    mgr.decodeBytes([0x48]);
    mgr.decodeBytes([0x65]);

    expect(mgr.getSnapshot().frames).toHaveLength(2);
  });

  it('decodeSPIBytes decodes SPI with separate MOSI/MISO', () => {
    const mgr = ProtocolDecoderManager.getInstance();
    mgr.setProtocol('SPI');
    const frames = mgr.decodeSPIBytes([0xab], [0xcd]);

    expect(frames).toHaveLength(1);
    expect(frames[0].protocol).toBe('SPI');
    expect(frames[0].mosiData).toEqual([0xab]);
  });

  it('clearFrames removes all frames', () => {
    const mgr = ProtocolDecoderManager.getInstance();
    mgr.setProtocol('UART');
    mgr.decodeBytes([0x48, 0x65]);
    mgr.clearFrames();

    expect(mgr.getSnapshot().frames).toEqual([]);
  });

  it('exportFrames returns formatted string', () => {
    const mgr = ProtocolDecoderManager.getInstance();
    mgr.setProtocol('UART');
    mgr.decodeBytes([0x48]);

    const exported = mgr.exportFrames();
    expect(exported).toContain('[UART]');
    expect(exported).toContain('0x48');
  });

  it('setI2COptions updates I2C options', () => {
    const mgr = ProtocolDecoderManager.getInstance();
    mgr.setI2COptions({ addressMode: '10bit' });
    expect(mgr.getSnapshot().i2cOptions.addressMode).toBe('10bit');
    expect(mgr.getSnapshot().i2cOptions.speedGrade).toBe('standard'); // unchanged
  });

  it('setSPIOptions updates SPI options', () => {
    const mgr = ProtocolDecoderManager.getInstance();
    mgr.setSPIOptions({ cpol: 1, wordSize: 16 });
    const opts = mgr.getSnapshot().spiOptions;
    expect(opts.cpol).toBe(1);
    expect(opts.wordSize).toBe(16);
    expect(opts.cpha).toBe(0); // unchanged
  });

  it('setUARTOptions updates UART options', () => {
    const mgr = ProtocolDecoderManager.getInstance();
    mgr.setUARTOptions({ baudRate: 9600, dataBits: 7 });
    const opts = mgr.getSnapshot().uartOptions;
    expect(opts.baudRate).toBe(9600);
    expect(opts.dataBits).toBe(7);
    expect(opts.parity).toBe('none'); // unchanged
  });

  it('notifies all subscribers on state change', () => {
    const mgr = ProtocolDecoderManager.getInstance();
    let count1 = 0;
    let count2 = 0;
    mgr.subscribe(() => { count1++; });
    mgr.subscribe(() => { count2++; });

    mgr.setProtocol('SPI');
    expect(count1).toBe(1);
    expect(count2).toBe(1);
  });

  it('getSnapshot returns immutable-style new object on change', () => {
    const mgr = ProtocolDecoderManager.getInstance();
    const snap1 = mgr.getSnapshot();
    mgr.setProtocol('SPI');
    const snap2 = mgr.getSnapshot();

    expect(snap1).not.toBe(snap2);
    expect(snap1.protocol).toBe('I2C');
    expect(snap2.protocol).toBe('SPI');
  });
});
