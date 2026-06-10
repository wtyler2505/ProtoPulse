import { describe, expect, it } from 'vitest';

import { parseIntelHex } from './intel-hex.js';

// All records below are hand-built; checksums computed by hand as the
// two's complement of the byte sum (count + address + type + data).

const EOF = ':00000001FF';

describe('parseIntelHex', () => {
  it('parses a single data record at offset 0', () => {
    // 02 00 00 00 0C 94 → sum 0xA2 → checksum 0x5E
    const image = parseIntelHex(`:020000000C945E\n${EOF}\n`);
    expect([...image]).toEqual([0x0c, 0x94]);
  });

  it('honors the record address offset and fills gaps with 0xFF (erased flash)', () => {
    // 02 00 10 00 AB CD → sum 0x8A → checksum 0x76
    const image = parseIntelHex(`:02001000ABCD76\n${EOF}`);
    expect(image.length).toBe(0x12);
    expect(image[0x10]).toBe(0xab);
    expect(image[0x11]).toBe(0xcd);
    // Everything before the record is erased-flash fill.
    expect([...image.subarray(0, 0x10)].every((b) => b === 0xff)).toBe(true);
  });

  it('concatenates multiple data records', () => {
    // 04 00 00 00 11 22 33 44 → sum 0xAE → checksum 0x52
    // 02 00 04 00 55 66       → sum 0xC1 → checksum 0x3F
    const image = parseIntelHex(`:040000001122334452\n:0200040055663F\n${EOF}`);
    expect([...image]).toEqual([0x11, 0x22, 0x33, 0x44, 0x55, 0x66]);
  });

  it('tolerates CRLF line endings and blank lines', () => {
    const image = parseIntelHex(`\r\n:020000000C945E\r\n\r\n${EOF}\r\n`);
    expect([...image]).toEqual([0x0c, 0x94]);
  });

  it('rejects a record with a bad checksum', () => {
    // Same record as above with the checksum off by one.
    expect(() => parseIntelHex(`:020000000C945F\n${EOF}`)).toThrow(/checksum mismatch/);
  });

  it('rejects a record missing the leading colon', () => {
    expect(() => parseIntelHex(`020000000C945E\n${EOF}`)).toThrow(/must start with ':'/);
  });

  it('rejects unsupported record types (e.g. 04 extended linear address)', () => {
    // 02 00 00 04 00 00 → sum 0x06 → checksum 0xFA (valid), but type 04.
    expect(() => parseIntelHex(`:020000040000FA\n${EOF}`)).toThrow(/unsupported record type 0x04/);
  });

  it('rejects non-hex digits', () => {
    expect(() => parseIntelHex(`:02000000ZZ945E\n${EOF}`)).toThrow(/invalid hex digits/);
  });

  it('rejects a record whose length disagrees with its count field', () => {
    // Count field claims 3 data bytes but only 2 are present.
    expect(() => parseIntelHex(`:030000000C945E\n${EOF}`)).toThrow(/length mismatch/);
  });

  it('rejects input with no EOF record', () => {
    expect(() => parseIntelHex(':020000000C945E\n')).toThrow(/missing EOF record/);
  });

  it('rejects records after the EOF record', () => {
    expect(() => parseIntelHex(`${EOF}\n:020000000C945E\n`)).toThrow(/after EOF/);
  });

  it('rejects an EOF record that carries data', () => {
    // 01 00 00 01 AA → sum 0xAC → checksum 0x54
    expect(() => parseIntelHex(':01000001AA54\n')).toThrow(/EOF record must carry no data/);
  });
});
