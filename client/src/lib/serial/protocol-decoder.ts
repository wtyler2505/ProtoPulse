/**
 * Protocol Decoder Library — I2C, SPI, UART
 *
 * Decodes raw byte streams into structured protocol frames for
 * monitoring embedded communication buses. Supports display in
 * hex, ASCII, decimal, and binary formats.
 *
 * Singleton+subscribe pattern for React integration via useSyncExternalStore.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProtocolType = 'I2C' | 'SPI' | 'UART';

export type DisplayMode = 'hex' | 'ascii' | 'decimal' | 'binary';

export type TimestampFormat = 'absolute' | 'relative' | 'delta';

export type I2CAddressMode = '7bit' | '10bit';

export type I2CSpeedGrade = 'standard' | 'fast' | 'fastplus' | 'highspeed';

export type BitOrder = 'MSB' | 'LSB';

export type ParityMode = 'none' | 'even' | 'odd';

export type StopBitsValue = 1 | 1.5 | 2;

export type SPIWordSize = 8 | 16 | 32;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface I2COptions {
  addressMode?: I2CAddressMode;
  speedGrade?: I2CSpeedGrade;
}

export interface SPIOptions {
  cpol?: 0 | 1;
  cpha?: 0 | 1;
  bitOrder?: BitOrder;
  wordSize?: SPIWordSize;
}

export interface UARTOptions {
  baudRate?: number;
  dataBits?: 5 | 6 | 7 | 8 | 9;
  parity?: ParityMode;
  stopBits?: StopBitsValue;
}

// ---------------------------------------------------------------------------
// Frame types
// ---------------------------------------------------------------------------

export interface I2CFrame {
  protocol: 'I2C';
  timestamp: number;
  startCondition: boolean;
  address: number;
  addressMode: I2CAddressMode;
  readWrite: 'R' | 'W';
  ackNack: Array<'ACK' | 'NACK'>;
  dataBytes: number[];
  stopCondition: boolean;
  repeatedStart: boolean;
  errors: string[];
  warnings: string[];
}

export interface SPIFrame {
  protocol: 'SPI';
  timestamp: number;
  csActive: boolean;
  mosiData: number[];
  misoData: number[];
  bitCount: number;
  wordSize: SPIWordSize;
  cpol: 0 | 1;
  cpha: 0 | 1;
  bitOrder: BitOrder;
  errors: string[];
  warnings: string[];
}

export interface UARTFrame {
  protocol: 'UART';
  timestamp: number;
  dataBits: number;
  parity: ParityMode;
  stopBits: StopBitsValue;
  data: number;
  parityError: boolean;
  framingError: boolean;
  errors: string[];
  warnings: string[];
}

export type DecodedFrame = I2CFrame | SPIFrame | UARTFrame;

// ---------------------------------------------------------------------------
// I2C Constants
// ---------------------------------------------------------------------------

/** Marker byte: start condition (0xFE chosen as out-of-band sentinel). */
const I2C_START = 0xfe;
/** Marker byte: stop condition. */
const I2C_STOP = 0xff;
/** Marker byte: repeated start. */
const I2C_REPEATED_START = 0xfd;

/** 10-bit address prefix mask: top 5 bits are 11110. */
const TEN_BIT_PREFIX = 0x78; // 0b01111000

// ---------------------------------------------------------------------------
// I2C Decoder
// ---------------------------------------------------------------------------

/**
 * Decode an I2C byte stream into frames.
 *
 * Expected byte format:
 *   [START, addressByte, ACK/NACK, data0, ACK/NACK, ..., STOP]
 *
 * - 0xFE = START condition
 * - 0xFF = STOP condition
 * - 0xFD = Repeated START
 * - After address byte and each data byte, next byte is 0x00 (ACK) or 0x01 (NACK)
 */
export function decodeI2C(bytes: number[], options?: I2COptions): I2CFrame[] {
  const addressMode = options?.addressMode ?? '7bit';
  const frames: I2CFrame[] = [];

  if (bytes.length === 0) {
    return frames;
  }

  let i = 0;
  let timestamp = 0;

  while (i < bytes.length) {
    // Look for a start condition
    if (bytes[i] !== I2C_START && bytes[i] !== I2C_REPEATED_START) {
      i++;
      continue;
    }

    const isRepeatedStart = bytes[i] === I2C_REPEATED_START;
    i++; // consume START

    if (i >= bytes.length) {
      break;
    }

    const frame: I2CFrame = {
      protocol: 'I2C',
      timestamp: timestamp++,
      startCondition: true,
      address: 0,
      addressMode,
      readWrite: 'W',
      ackNack: [],
      dataBytes: [],
      stopCondition: false,
      repeatedStart: isRepeatedStart,
      errors: [],
      warnings: [],
    };

    // Parse address byte
    const addrByte = bytes[i];
    i++;

    if (addressMode === '10bit' && (addrByte >> 3) === (TEN_BIT_PREFIX >> 3)) {
      // 10-bit addressing: first byte has upper 2 bits of address
      const upper2 = (addrByte >> 1) & 0x03;
      frame.readWrite = (addrByte & 0x01) === 1 ? 'R' : 'W';

      // Read ACK for first address byte
      if (i < bytes.length) {
        const ack = bytes[i] === 0x00 ? 'ACK' as const : 'NACK' as const;
        frame.ackNack.push(ack);
        if (ack === 'NACK') {
          frame.errors.push('NACK on first address byte (10-bit)');
        }
        i++;
      }

      // Second address byte has lower 8 bits
      if (i < bytes.length) {
        const secondByte = bytes[i];
        frame.address = (upper2 << 8) | secondByte;
        i++;

        // ACK for second address byte
        if (i < bytes.length) {
          const ack2 = bytes[i] === 0x00 ? 'ACK' as const : 'NACK' as const;
          frame.ackNack.push(ack2);
          if (ack2 === 'NACK') {
            frame.errors.push('NACK on second address byte (10-bit)');
          }
          i++;
        }
      }
    } else {
      // 7-bit addressing
      frame.address = (addrByte >> 1) & 0x7f;
      frame.readWrite = (addrByte & 0x01) === 1 ? 'R' : 'W';

      // Read ACK/NACK for address
      if (i < bytes.length) {
        const ack = bytes[i] === 0x00 ? 'ACK' as const : 'NACK' as const;
        frame.ackNack.push(ack);
        if (ack === 'NACK') {
          frame.errors.push('NACK on address byte');
        }
        i++;
      }
    }

    // Read data bytes until STOP or next START
    while (i < bytes.length) {
      const b = bytes[i];
      if (b === I2C_STOP) {
        frame.stopCondition = true;
        i++;
        break;
      }
      if (b === I2C_START || b === I2C_REPEATED_START) {
        // Next frame starts; don't consume this byte
        break;
      }

      frame.dataBytes.push(b);
      i++;

      // ACK/NACK after data byte
      if (i < bytes.length && bytes[i] !== I2C_STOP && bytes[i] !== I2C_START && bytes[i] !== I2C_REPEATED_START) {
        const ack = bytes[i] === 0x00 ? 'ACK' as const : 'NACK' as const;
        frame.ackNack.push(ack);
        i++;
      }
    }

    if (!frame.stopCondition && i >= bytes.length) {
      frame.warnings.push('Missing STOP condition');
    }

    frames.push(frame);
  }

  return frames;
}

// ---------------------------------------------------------------------------
// SPI Decoder
// ---------------------------------------------------------------------------

/**
 * Reverse the bits in a byte (LSB first ↔ MSB first).
 */
function reverseByte(b: number): number {
  let result = 0;
  for (let bit = 0; bit < 8; bit++) {
    result = (result << 1) | ((b >> bit) & 1);
  }
  return result;
}

/**
 * Decode SPI MOSI+MISO byte streams into frames.
 *
 * Each frame represents one CS-active transfer.
 * MOSI and MISO arrays should be the same length; shorter one is
 * zero-padded internally.
 */
export function decodeSPI(
  mosiBytes: number[],
  misoBytes: number[],
  options?: SPIOptions,
): SPIFrame[] {
  const wordSize = options?.wordSize ?? 8;
  const bitOrder = options?.bitOrder ?? 'MSB';
  const cpol = options?.cpol ?? 0;
  const cpha = options?.cpha ?? 0;

  if (mosiBytes.length === 0 && misoBytes.length === 0) {
    return [];
  }

  // Normalise lengths
  const len = Math.max(mosiBytes.length, misoBytes.length);
  const mosi = mosiBytes.slice();
  const miso = misoBytes.slice();
  while (mosi.length < len) {
    mosi.push(0);
  }
  while (miso.length < len) {
    miso.push(0);
  }

  // Apply bit reversal for LSB-first
  const mosiProcessed = bitOrder === 'LSB' ? mosi.map(reverseByte) : mosi;
  const misoProcessed = bitOrder === 'LSB' ? miso.map(reverseByte) : miso;

  // Group into word-sized frames
  const bytesPerWord = wordSize / 8;
  const frames: SPIFrame[] = [];
  let timestamp = 0;

  for (let offset = 0; offset < len; offset += bytesPerWord) {
    const mosiSlice = mosiProcessed.slice(offset, offset + bytesPerWord);
    const misoSlice = misoProcessed.slice(offset, offset + bytesPerWord);

    const frame: SPIFrame = {
      protocol: 'SPI',
      timestamp: timestamp++,
      csActive: true,
      mosiData: mosiSlice,
      misoData: misoSlice,
      bitCount: mosiSlice.length * 8,
      wordSize,
      cpol,
      cpha,
      bitOrder,
      errors: [],
      warnings: [],
    };

    if (mosiSlice.length < bytesPerWord) {
      frame.warnings.push(`Incomplete word: expected ${bytesPerWord} bytes, got ${mosiSlice.length}`);
    }

    frames.push(frame);
  }

  return frames;
}

// ---------------------------------------------------------------------------
// UART Decoder
// ---------------------------------------------------------------------------

/**
 * Compute even parity for a value with the given number of data bits.
 */
function computeEvenParity(value: number, bits: number): number {
  let ones = 0;
  for (let i = 0; i < bits; i++) {
    if ((value >> i) & 1) {
      ones++;
    }
  }
  return ones % 2;
}

/**
 * Decode UART byte stream into frames.
 *
 * Each input byte is treated as one UART data word.
 * Parity is validated if enabled. Framing errors are flagged
 * when a byte exceeds the valid range for the configured data bits.
 */
export function decodeUART(bytes: number[], options?: UARTOptions): UARTFrame[] {
  const dataBits = options?.dataBits ?? 8;
  const parity = options?.parity ?? 'none';
  const stopBits = options?.stopBits ?? 1;

  if (bytes.length === 0) {
    return [];
  }

  const maxValue = (1 << dataBits) - 1;
  const frames: UARTFrame[] = [];
  let timestamp = 0;

  for (const rawByte of bytes) {
    let dataValue: number;
    let parityBit: number | null = null;

    if (parity !== 'none' && dataBits < 8) {
      // When parity is enabled and data bits < 8, the parity bit
      // is the bit above the data bits within the byte
      dataValue = rawByte & maxValue;
      parityBit = (rawByte >> dataBits) & 1;
    } else {
      dataValue = rawByte & maxValue;
    }

    const frame: UARTFrame = {
      protocol: 'UART',
      timestamp: timestamp++,
      dataBits,
      parity,
      stopBits,
      data: dataValue,
      parityError: false,
      framingError: false,
      errors: [],
      warnings: [],
    };

    // Check framing error: value exceeds data-bit width
    if (rawByte > maxValue && parity === 'none') {
      frame.framingError = true;
      frame.errors.push(`Framing error: byte 0x${rawByte.toString(16).padStart(2, '0')} exceeds ${dataBits}-bit range`);
    }

    // Parity check
    if (parity !== 'none' && parityBit !== null) {
      const expectedParity = computeEvenParity(dataValue, dataBits);
      const isError =
        parity === 'even'
          ? parityBit !== expectedParity
          : parityBit === expectedParity; // odd parity is inverted

      if (isError) {
        frame.parityError = true;
        frame.errors.push(
          `Parity error: expected ${parity} parity, got ${parityBit} for data 0x${dataValue.toString(16)}`,
        );
      }
    }

    frames.push(frame);
  }

  return frames;
}

// ---------------------------------------------------------------------------
// Display formatting
// ---------------------------------------------------------------------------

/**
 * Format a byte value in the specified display mode.
 */
function formatByte(b: number, mode: DisplayMode): string {
  switch (mode) {
    case 'hex':
      return '0x' + b.toString(16).toUpperCase().padStart(2, '0');
    case 'ascii':
      return b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.';
    case 'decimal':
      return b.toString(10);
    case 'binary':
      return '0b' + b.toString(2).padStart(8, '0');
  }
}

/**
 * Format a decoded frame into a human-readable string.
 */
export function formatFrame(frame: DecodedFrame, displayMode: DisplayMode): string {
  switch (frame.protocol) {
    case 'I2C': {
      const addrStr = formatByte(frame.address, displayMode);
      const rw = frame.readWrite;
      const data = frame.dataBytes.map((b) => formatByte(b, displayMode)).join(' ');
      const acks = frame.ackNack.join('/');
      return `[I2C] Addr:${addrStr} ${rw} Data:[${data}] ${acks}`;
    }
    case 'SPI': {
      const mosiStr = frame.mosiData.map((b) => formatByte(b, displayMode)).join(' ');
      const misoStr = frame.misoData.map((b) => formatByte(b, displayMode)).join(' ');
      return `[SPI] MOSI:[${mosiStr}] MISO:[${misoStr}]`;
    }
    case 'UART': {
      const dataStr = formatByte(frame.data, displayMode);
      const status = frame.parityError ? ' PARITY_ERR' : frame.framingError ? ' FRAME_ERR' : '';
      return `[UART] ${dataStr}${status}`;
    }
  }
}

/**
 * Format a timestamp in the specified format.
 *
 * @param ts     Timestamp in milliseconds
 * @param format Display format
 * @param refTs  Reference timestamp for 'relative' and 'delta' formats
 */
export function formatTimestamp(ts: number, format: TimestampFormat, refTs?: number): string {
  switch (format) {
    case 'absolute': {
      const date = new Date(ts);
      const h = date.getHours().toString().padStart(2, '0');
      const m = date.getMinutes().toString().padStart(2, '0');
      const s = date.getSeconds().toString().padStart(2, '0');
      const ms = date.getMilliseconds().toString().padStart(3, '0');
      return `${h}:${m}:${s}.${ms}`;
    }
    case 'relative': {
      const ref = refTs ?? 0;
      const delta = ts - ref;
      return `+${delta.toFixed(3)}ms`;
    }
    case 'delta': {
      const ref = refTs ?? 0;
      const delta = ts - ref;
      if (delta < 1000) {
        return `${delta.toFixed(3)}ms`;
      }
      return `${(delta / 1000).toFixed(3)}s`;
    }
  }
}

// ---------------------------------------------------------------------------
// Manager state
// ---------------------------------------------------------------------------

export interface ProtocolDecoderState {
  protocol: ProtocolType;
  frames: DecodedFrame[];
  displayMode: DisplayMode;
  timestampFormat: TimestampFormat;
  i2cOptions: Required<I2COptions>;
  spiOptions: Required<SPIOptions>;
  uartOptions: Required<UARTOptions>;
}

// ---------------------------------------------------------------------------
// ProtocolDecoderManager — singleton + subscribe
// ---------------------------------------------------------------------------

/**
 * Central manager for protocol decoding.
 * Singleton with subscribe pattern for React integration.
 */
export class ProtocolDecoderManager {
  private static instance: ProtocolDecoderManager | null = null;

  private _state: ProtocolDecoderState;
  private _listeners: Set<() => void>;

  constructor() {
    this._listeners = new Set();
    this._state = {
      protocol: 'I2C',
      frames: [],
      displayMode: 'hex',
      timestampFormat: 'absolute',
      i2cOptions: {
        addressMode: '7bit',
        speedGrade: 'standard',
      },
      spiOptions: {
        cpol: 0,
        cpha: 0,
        bitOrder: 'MSB',
        wordSize: 8,
      },
      uartOptions: {
        baudRate: 115200,
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
      },
    };
  }

  static getInstance(): ProtocolDecoderManager {
    if (!ProtocolDecoderManager.instance) {
      ProtocolDecoderManager.instance = new ProtocolDecoderManager();
    }
    return ProtocolDecoderManager.instance;
  }

  /** Reset singleton — useful for testing. */
  static resetInstance(): void {
    ProtocolDecoderManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscribe (useSyncExternalStore compatible)
  // -----------------------------------------------------------------------

  subscribe = (listener: () => void): (() => void) => {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  };

  getSnapshot = (): ProtocolDecoderState => {
    return this._state;
  };

  private notify(): void {
    const listeners = Array.from(this._listeners);
    for (let i = 0; i < listeners.length; i++) {
      listeners[i]();
    }
  }

  // -----------------------------------------------------------------------
  // Protocol selection
  // -----------------------------------------------------------------------

  setProtocol(protocol: ProtocolType): void {
    this._state = { ...this._state, protocol, frames: [] };
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Display settings
  // -----------------------------------------------------------------------

  setDisplayMode(mode: DisplayMode): void {
    this._state = { ...this._state, displayMode: mode };
    this.notify();
  }

  setTimestampFormat(format: TimestampFormat): void {
    this._state = { ...this._state, timestampFormat: format };
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Options
  // -----------------------------------------------------------------------

  setI2COptions(options: Partial<I2COptions>): void {
    this._state = {
      ...this._state,
      i2cOptions: { ...this._state.i2cOptions, ...options },
    };
    this.notify();
  }

  setSPIOptions(options: Partial<SPIOptions>): void {
    this._state = {
      ...this._state,
      spiOptions: { ...this._state.spiOptions, ...options },
    };
    this.notify();
  }

  setUARTOptions(options: Partial<UARTOptions>): void {
    this._state = {
      ...this._state,
      uartOptions: { ...this._state.uartOptions, ...options },
    };
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Decode
  // -----------------------------------------------------------------------

  /** Feed raw bytes and decode using the currently selected protocol. */
  decodeBytes(bytes: number[]): DecodedFrame[] {
    const { protocol } = this._state;
    let newFrames: DecodedFrame[];

    switch (protocol) {
      case 'I2C':
        newFrames = decodeI2C(bytes, this._state.i2cOptions);
        break;
      case 'SPI':
        // For SPI via single byte array, split alternating MOSI/MISO
        newFrames = decodeSPI(bytes, [], this._state.spiOptions);
        break;
      case 'UART':
        newFrames = decodeUART(bytes, this._state.uartOptions);
        break;
    }

    this._state = {
      ...this._state,
      frames: [...this._state.frames, ...newFrames],
    };
    this.notify();
    return newFrames;
  }

  /** Feed separate MOSI/MISO byte arrays for SPI decoding. */
  decodeSPIBytes(mosiBytes: number[], misoBytes: number[]): SPIFrame[] {
    const frames = decodeSPI(mosiBytes, misoBytes, this._state.spiOptions);
    this._state = {
      ...this._state,
      frames: [...this._state.frames, ...frames],
    };
    this.notify();
    return frames;
  }

  // -----------------------------------------------------------------------
  // Clear / export
  // -----------------------------------------------------------------------

  clearFrames(): void {
    this._state = { ...this._state, frames: [] };
    this.notify();
  }

  exportFrames(): string {
    const { frames, displayMode } = this._state;
    const lines = frames.map((f) => formatFrame(f, displayMode));
    return lines.join('\n');
  }
}
