/**
 * Minimal Intel-HEX parser for firmware loading (Vol II §D.2).
 *
 * Supports exactly what avr-gcc / Arduino emit for parts with ≤64 KiB
 * flash: data records (type 00) and the EOF record (type 01), with the
 * record checksum verified and the load offset honored. Extended
 * address records (types 02/04) are rejected loudly rather than
 * silently mis-loaded — an ATmega328P never needs them.
 *
 * Gaps between records are filled with 0xFF (erased flash).
 */

const RECORD_DATA = 0x00;
const RECORD_EOF = 0x01;

function fail(lineNo: number, message: string): never {
  throw new Error(`intel-hex line ${lineNo}: ${message}`);
}

/** Parse Intel-HEX text into a flat program image (byte 0 = address 0). */
export function parseIntelHex(text: string): Uint8Array {
  const chunks: { address: number; data: Uint8Array }[] = [];
  let end = 0;
  let sawEof = false;

  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = (lines[i] ?? '').trim();
    if (line.length === 0) {
      continue;
    }
    if (sawEof) {
      fail(lineNo, 'record after EOF record');
    }
    if (!line.startsWith(':')) {
      fail(lineNo, `record must start with ':' (got "${line.slice(0, 8)}")`);
    }
    if (line.length < 11 || (line.length - 1) % 2 !== 0) {
      fail(lineNo, 'record too short or odd number of hex digits');
    }

    // Decode all byte fields, accumulating the checksum as we go.
    const fieldCount = (line.length - 1) / 2;
    const fields: number[] = [];
    let sum = 0;
    for (let j = 0; j < fieldCount; j++) {
      const pair = line.slice(1 + j * 2, 3 + j * 2);
      if (!/^[0-9A-Fa-f]{2}$/.test(pair)) {
        fail(lineNo, `invalid hex digits "${pair}"`);
      }
      const byte = parseInt(pair, 16);
      fields.push(byte);
      sum = (sum + byte) & 0xff;
    }

    const byteCount = fields[0] ?? 0;
    if (fieldCount !== byteCount + 5) {
      fail(lineNo, `record length mismatch: count field says ${byteCount} data bytes`);
    }
    // Two's-complement checksum: all bytes including the checksum sum to 0.
    if (sum !== 0) {
      fail(lineNo, 'checksum mismatch');
    }

    const address = (((fields[1] ?? 0) << 8) | (fields[2] ?? 0)) & 0xffff;
    const type = fields[3] ?? 0;

    if (type === RECORD_EOF) {
      if (byteCount !== 0) {
        fail(lineNo, 'EOF record must carry no data');
      }
      sawEof = true;
      continue;
    }
    if (type !== RECORD_DATA) {
      fail(lineNo, `unsupported record type 0x${type.toString(16).padStart(2, '0')} (only 00/01)`);
    }
    chunks.push({ address, data: Uint8Array.from(fields.slice(4, 4 + byteCount)) });
    end = Math.max(end, address + byteCount);
  }

  if (!sawEof) {
    throw new Error('intel-hex: missing EOF record (type 01)');
  }

  const out = new Uint8Array(end).fill(0xff);
  for (const { address, data } of chunks) {
    out.set(data, address);
  }
  return out;
}
