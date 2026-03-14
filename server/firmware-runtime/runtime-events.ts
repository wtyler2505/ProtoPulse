/**
 * Runtime Events — VCD/UART output parsing from simavr.
 *
 * Provides:
 * - RuntimeEvent discriminated union for all simulator event types
 * - VCD (Value Change Dump) header and value-change parsers
 * - UART line parser for simavr stderr output
 * - RuntimeEventBuffer ring buffer (fixed-capacity, FIFO eviction)
 */

// ---------------------------------------------------------------------------
// RuntimeEvent discriminated union
// ---------------------------------------------------------------------------

export interface PinChangeEvent {
  type: 'pin_change';
  pin: string;
  value: 0 | 1;
  timestampNs: number;
}

export interface UartDataEvent {
  type: 'uart_data';
  port: number;
  byte: number;
  char: string;
  timestampNs: number;
}

export interface TimerTickEvent {
  type: 'timer_tick';
  timer: string;
  value: number;
  timestampNs: number;
}

export interface CycleCountEvent {
  type: 'cycle_count';
  cycles: number;
  timestampNs: number;
}

export interface ErrorEvent {
  type: 'error';
  message: string;
  timestampNs: number;
}

export type RuntimeEvent =
  | PinChangeEvent
  | UartDataEvent
  | TimerTickEvent
  | CycleCountEvent
  | ErrorEvent;

// ---------------------------------------------------------------------------
// VCD parsing
// ---------------------------------------------------------------------------

/**
 * Parsed VCD signal definition.
 *
 * VCD header lines look like:
 *   $var wire 1 ! portb0 $end
 * Fields: $var <type> <width> <alias> <name> $end
 */
export interface VcdSignal {
  name: string;
  alias: string;
  width: number;
}

/** Maps VCD alias characters to their signal definitions. */
export type VcdSignalMap = Map<string, VcdSignal>;

/**
 * Parse the VCD header section, extracting $var declarations into a signal map.
 *
 * Scans all lines for `$var` directives. Stops early if `$enddefinitions`
 * is encountered, but tolerates files that lack it.
 *
 * @param lines — All lines of the VCD file (or at least the header portion).
 * @returns A map from alias → VcdSignal.
 */
export function parseVcdHeader(lines: string[]): VcdSignalMap {
  const map: VcdSignalMap = new Map();

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('$enddefinitions')) {
      break;
    }

    if (!trimmed.startsWith('$var')) {
      continue;
    }

    // Format: $var <type> <width> <alias> <name> $end
    // Example: $var wire 1 ! portb0 $end
    const parts = trimmed.split(/\s+/);
    // Minimum valid: ['$var', type, width, alias, name, '$end']
    if (parts.length < 6) {
      continue;
    }

    const width = parseInt(parts[2], 10);
    if (Number.isNaN(width)) {
      continue;
    }

    const alias = parts[3];
    const name = parts[4];

    map.set(alias, { name, alias, width });
  }

  return map;
}

/**
 * Parse a single VCD value-change line into a PinChangeEvent.
 *
 * Value-change formats:
 * - Single-bit: `0!` or `1!` — value char followed by alias char(s)
 * - Multi-bit:  `bXXXX symbol` — 'b' prefix, binary digits, space, alias
 *
 * Timestamp lines (`#1000`) are NOT parsed here — the caller is expected
 * to track the current timestamp externally and pass it in.
 *
 * @param line      — A single VCD body line (trimmed).
 * @param signalMap — The signal map from parseVcdHeader.
 * @param timestampNs — Current VCD timestamp in nanoseconds.
 * @returns A PinChangeEvent if the line is a recognized value change, or null.
 */
export function parseVcdValueChange(
  line: string,
  signalMap: VcdSignalMap,
  timestampNs: number,
): PinChangeEvent | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return null;
  }

  // Multi-bit value: bXXXX alias
  if (trimmed.startsWith('b') || trimmed.startsWith('B')) {
    const spaceIdx = trimmed.indexOf(' ');
    if (spaceIdx === -1) {
      return null;
    }
    const binaryStr = trimmed.slice(1, spaceIdx);
    const alias = trimmed.slice(spaceIdx + 1).trim();
    const signal = signalMap.get(alias);
    if (!signal) {
      return null;
    }
    const numericValue = parseInt(binaryStr, 2);
    return {
      type: 'pin_change',
      pin: signal.name,
      value: (numericValue & 1) as 0 | 1,
      timestampNs,
    };
  }

  // Single-bit value: first char is 0/1/x/X/z/Z, rest is alias
  const firstChar = trimmed[0];
  if (firstChar === '0' || firstChar === '1') {
    const alias = trimmed.slice(1);
    const signal = signalMap.get(alias);
    if (!signal) {
      return null;
    }
    return {
      type: 'pin_change',
      pin: signal.name,
      value: firstChar === '1' ? 1 : 0,
      timestampNs,
    };
  }

  // x/z values — treat as 0 (unknown/high-impedance)
  if (firstChar === 'x' || firstChar === 'X' || firstChar === 'z' || firstChar === 'Z') {
    const alias = trimmed.slice(1);
    const signal = signalMap.get(alias);
    if (!signal) {
      return null;
    }
    return {
      type: 'pin_change',
      pin: signal.name,
      value: 0,
      timestampNs,
    };
  }

  return null;
}

/**
 * Extract a VCD timestamp from a line.
 *
 * VCD timestamps are lines starting with `#` followed by a non-negative integer.
 * Example: `#1000` → 1000
 *
 * @returns The timestamp value, or null if the line is not a timestamp.
 */
export function parseVcdTimestamp(line: string): number | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('#')) {
    return null;
  }
  const value = parseInt(trimmed.slice(1), 10);
  if (Number.isNaN(value) || value < 0) {
    return null;
  }
  return value;
}

/**
 * Parse a complete VCD string into an array of PinChangeEvents.
 *
 * Convenience function that combines header parsing, timestamp tracking,
 * and value-change parsing in one pass.
 */
export function parseVcd(vcdContent: string): PinChangeEvent[] {
  const lines = vcdContent.split('\n');
  const signalMap = parseVcdHeader(lines);
  const events: PinChangeEvent[] = [];

  let inBody = false;
  let currentTimestamp = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('$enddefinitions')) {
      inBody = true;
      continue;
    }

    if (!inBody) {
      continue;
    }

    // Check for timestamp
    const ts = parseVcdTimestamp(trimmed);
    if (ts !== null) {
      currentTimestamp = ts;
      continue;
    }

    // Try to parse as a value change
    const event = parseVcdValueChange(trimmed, signalMap, currentTimestamp);
    if (event) {
      events.push(event);
    }
  }

  return events;
}

// ---------------------------------------------------------------------------
// UART parsing
// ---------------------------------------------------------------------------

/**
 * Parse a simavr UART stderr line into a UartDataEvent.
 *
 * simavr commonly outputs UART data on stderr in the format:
 *   `UART0: XX` or `uart0_pty_out: 0xXX`
 * where XX is a hex byte value.
 *
 * Also supports numbered ports: `UART1: XX`, `UART2: XX`, etc.
 *
 * @param line        — A single stderr line from simavr.
 * @param timestampNs — Timestamp to assign (caller provides, since UART
 *                       lines don't carry their own timing).
 * @returns A UartDataEvent if the line matches a UART pattern, or null.
 */
export function parseUartLine(line: string, timestampNs: number = 0): UartDataEvent | null {
  const trimmed = line.trim();

  // Pattern 1: UART0: XX  or  UART1: XX  (hex byte, 1-2 digits)
  const uartMatch = /^UART(\d+):\s*([0-9A-Fa-f]{1,2})$/i.exec(trimmed);
  if (uartMatch) {
    const port = parseInt(uartMatch[1], 10);
    const byte = parseInt(uartMatch[2], 16);
    return {
      type: 'uart_data',
      port,
      byte,
      char: byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '.',
      timestampNs,
    };
  }

  // Pattern 2: uart0_pty_out: 0xXX
  const ptyMatch = /^uart(\d+)_pty_out:\s*0x([0-9A-Fa-f]{1,2})$/i.exec(trimmed);
  if (ptyMatch) {
    const port = parseInt(ptyMatch[1], 10);
    const byte = parseInt(ptyMatch[2], 16);
    return {
      type: 'uart_data',
      port,
      byte,
      char: byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '.',
      timestampNs,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// RuntimeEventBuffer — ring buffer
// ---------------------------------------------------------------------------

const DEFAULT_MAX_EVENTS = 10_000;

/**
 * Fixed-capacity ring buffer for RuntimeEvents.
 *
 * When the buffer is full, the oldest event is overwritten (FIFO eviction).
 * All retrieval methods return events in chronological insertion order.
 */
export class RuntimeEventBuffer {
  private readonly buffer: Array<RuntimeEvent | undefined>;
  private readonly maxSize: number;
  private head = 0; // next write position
  private count = 0;

  constructor(maxSize: number = DEFAULT_MAX_EVENTS) {
    if (maxSize < 1) {
      throw new Error('RuntimeEventBuffer maxSize must be >= 1');
    }
    this.maxSize = maxSize;
    this.buffer = new Array<RuntimeEvent | undefined>(maxSize);
  }

  /**
   * Add an event to the buffer. Evicts the oldest event if full.
   */
  push(event: RuntimeEvent): void {
    this.buffer[this.head] = event;
    this.head = (this.head + 1) % this.maxSize;
    if (this.count < this.maxSize) {
      this.count++;
    }
  }

  /**
   * Get all events in chronological insertion order.
   */
  getAll(): RuntimeEvent[] {
    if (this.count === 0) {
      return [];
    }

    const result: RuntimeEvent[] = [];
    const start = this.count < this.maxSize ? 0 : this.head;

    for (let i = 0; i < this.count; i++) {
      const idx = (start + i) % this.maxSize;
      const event = this.buffer[idx];
      if (event !== undefined) {
        result.push(event);
      }
    }

    return result;
  }

  /**
   * Get all events with timestampNs strictly greater than the given value.
   */
  getSince(timestampNs: number): RuntimeEvent[] {
    return this.getAll().filter((e) => e.timestampNs > timestampNs);
  }

  /**
   * Get all events of a specific type.
   */
  getByType<T extends RuntimeEvent['type']>(
    eventType: T,
  ): Extract<RuntimeEvent, { type: T }>[] {
    return this.getAll().filter(
      (e): e is Extract<RuntimeEvent, { type: T }> => e.type === eventType,
    );
  }

  /**
   * Remove all events from the buffer.
   */
  clear(): void {
    this.buffer.fill(undefined);
    this.head = 0;
    this.count = 0;
  }

  /**
   * Current number of events stored.
   */
  get size(): number {
    return this.count;
  }
}
