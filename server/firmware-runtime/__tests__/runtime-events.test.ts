/**
 * Runtime Events Tests
 *
 * Tests for VCD/UART parsers and RuntimeEventBuffer in
 * server/firmware-runtime/runtime-events.ts.
 * Runs in server project config (node environment).
 */

import { describe, it, expect } from 'vitest';
import {
  parseVcdHeader,
  parseVcdValueChange,
  parseVcdTimestamp,
  parseVcd,
  parseUartLine,
  RuntimeEventBuffer,
} from '../runtime-events';
import type {
  RuntimeEvent,
  PinChangeEvent,
  UartDataEvent,
  VcdSignalMap,
} from '../runtime-events';

// ---------------------------------------------------------------------------
// VCD Header Parsing
// ---------------------------------------------------------------------------

describe('parseVcdHeader', () => {
  it('parses a single $var declaration', () => {
    const lines = [
      '$timescale 1ns $end',
      '$scope module top $end',
      '$var wire 1 ! portb0 $end',
      '$upscope $end',
      '$enddefinitions $end',
    ];
    const map = parseVcdHeader(lines);
    expect(map.size).toBe(1);
    expect(map.get('!')).toEqual({ name: 'portb0', alias: '!', width: 1 });
  });

  it('parses multiple $var declarations', () => {
    const lines = [
      '$var wire 1 ! portb0 $end',
      '$var wire 1 " portb1 $end',
      '$var wire 1 # portb2 $end',
      '$var wire 8 $ portd $end',
      '$enddefinitions $end',
    ];
    const map = parseVcdHeader(lines);
    expect(map.size).toBe(4);
    expect(map.get('!')?.name).toBe('portb0');
    expect(map.get('"')?.name).toBe('portb1');
    expect(map.get('#')?.name).toBe('portb2');
    expect(map.get('$')).toEqual({ name: 'portd', alias: '$', width: 8 });
  });

  it('stops at $enddefinitions', () => {
    const lines = [
      '$var wire 1 ! portb0 $end',
      '$enddefinitions $end',
      '$var wire 1 " portb1 $end',
    ];
    const map = parseVcdHeader(lines);
    expect(map.size).toBe(1);
    expect(map.has('"')).toBe(false);
  });

  it('handles empty input', () => {
    const map = parseVcdHeader([]);
    expect(map.size).toBe(0);
  });

  it('skips malformed $var lines with missing fields', () => {
    const lines = [
      '$var wire 1 $end',  // too few parts
      '$var wire 1 ! portb0 $end',  // valid
      '$enddefinitions $end',
    ];
    const map = parseVcdHeader(lines);
    expect(map.size).toBe(1);
  });

  it('skips $var lines with non-numeric width', () => {
    const lines = [
      '$var wire abc ! portb0 $end',
      '$enddefinitions $end',
    ];
    const map = parseVcdHeader(lines);
    expect(map.size).toBe(0);
  });

  it('ignores non-$var header lines', () => {
    const lines = [
      '$timescale 1ns $end',
      '$scope module top $end',
      '$comment This is a comment $end',
      '$var wire 1 ! portb0 $end',
      '$upscope $end',
      '$enddefinitions $end',
    ];
    const map = parseVcdHeader(lines);
    expect(map.size).toBe(1);
  });

  it('handles whitespace and indentation', () => {
    const lines = [
      '   $var wire 1 ! portb0 $end  ',
      '\t$var wire 1 " portb1 $end',
      '$enddefinitions $end',
    ];
    const map = parseVcdHeader(lines);
    expect(map.size).toBe(2);
  });

  it('parses multi-character aliases', () => {
    const lines = [
      '$var wire 1 abc signal_a $end',
      '$enddefinitions $end',
    ];
    const map = parseVcdHeader(lines);
    expect(map.get('abc')).toEqual({ name: 'signal_a', alias: 'abc', width: 1 });
  });

  it('tolerates files without $enddefinitions', () => {
    const lines = [
      '$var wire 1 ! portb0 $end',
      '$var wire 1 " portb1 $end',
    ];
    const map = parseVcdHeader(lines);
    expect(map.size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// VCD Timestamp Parsing
// ---------------------------------------------------------------------------

describe('parseVcdTimestamp', () => {
  it('parses a simple timestamp', () => {
    expect(parseVcdTimestamp('#1000')).toBe(1000);
  });

  it('parses zero timestamp', () => {
    expect(parseVcdTimestamp('#0')).toBe(0);
  });

  it('parses large timestamps', () => {
    expect(parseVcdTimestamp('#999999999')).toBe(999999999);
  });

  it('returns null for non-timestamp lines', () => {
    expect(parseVcdTimestamp('0!')).toBeNull();
    expect(parseVcdTimestamp('$var wire 1 ! portb0 $end')).toBeNull();
    expect(parseVcdTimestamp('')).toBeNull();
  });

  it('returns null for negative values after #', () => {
    expect(parseVcdTimestamp('#-5')).toBeNull();
  });

  it('returns null for non-numeric content after #', () => {
    expect(parseVcdTimestamp('#abc')).toBeNull();
  });

  it('handles leading/trailing whitespace', () => {
    expect(parseVcdTimestamp('  #500  ')).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// VCD Value Change Parsing
// ---------------------------------------------------------------------------

describe('parseVcdValueChange', () => {
  const signalMap: VcdSignalMap = new Map([
    ['!', { name: 'portb0', alias: '!', width: 1 }],
    ['"', { name: 'portb1', alias: '"', width: 1 }],
    ['$', { name: 'portd', alias: '$', width: 8 }],
  ]);

  it('parses single-bit value going high', () => {
    const event = parseVcdValueChange('1!', signalMap, 1000);
    expect(event).toEqual({
      type: 'pin_change',
      pin: 'portb0',
      value: 1,
      timestampNs: 1000,
    });
  });

  it('parses single-bit value going low', () => {
    const event = parseVcdValueChange('0!', signalMap, 2000);
    expect(event).toEqual({
      type: 'pin_change',
      pin: 'portb0',
      value: 0,
      timestampNs: 2000,
    });
  });

  it('parses a different signal alias', () => {
    const event = parseVcdValueChange('1"', signalMap, 3000);
    expect(event).toEqual({
      type: 'pin_change',
      pin: 'portb1',
      value: 1,
      timestampNs: 3000,
    });
  });

  it('parses multi-bit binary value', () => {
    const event = parseVcdValueChange('b10110011 $', signalMap, 4000);
    expect(event).not.toBeNull();
    expect(event!.pin).toBe('portd');
    // 0b10110011 = 179, LSB = 1
    expect(event!.value).toBe(1);
    expect(event!.timestampNs).toBe(4000);
  });

  it('parses multi-bit binary value with even LSB', () => {
    const event = parseVcdValueChange('b10110010 $', signalMap, 5000);
    expect(event).not.toBeNull();
    // 0b10110010 = 178, LSB = 0
    expect(event!.value).toBe(0);
  });

  it('handles uppercase B prefix', () => {
    const event = parseVcdValueChange('B1010 $', signalMap, 6000);
    expect(event).not.toBeNull();
    expect(event!.pin).toBe('portd');
  });

  it('returns null for unknown alias', () => {
    expect(parseVcdValueChange('1%', signalMap, 0)).toBeNull();
  });

  it('returns null for empty line', () => {
    expect(parseVcdValueChange('', signalMap, 0)).toBeNull();
  });

  it('returns null for whitespace-only line', () => {
    expect(parseVcdValueChange('   ', signalMap, 0)).toBeNull();
  });

  it('returns null for timestamp lines', () => {
    // Timestamp lines should be handled separately
    expect(parseVcdValueChange('#1000', signalMap, 0)).toBeNull();
  });

  it('treats x (unknown) as value 0', () => {
    const event = parseVcdValueChange('x!', signalMap, 7000);
    expect(event).toEqual({
      type: 'pin_change',
      pin: 'portb0',
      value: 0,
      timestampNs: 7000,
    });
  });

  it('treats X (uppercase unknown) as value 0', () => {
    const event = parseVcdValueChange('X!', signalMap, 7500);
    expect(event).not.toBeNull();
    expect(event!.value).toBe(0);
  });

  it('treats z (high-impedance) as value 0', () => {
    const event = parseVcdValueChange('z!', signalMap, 8000);
    expect(event).toEqual({
      type: 'pin_change',
      pin: 'portb0',
      value: 0,
      timestampNs: 8000,
    });
  });

  it('treats Z (uppercase high-impedance) as value 0', () => {
    const event = parseVcdValueChange('Z!', signalMap, 8500);
    expect(event).not.toBeNull();
    expect(event!.value).toBe(0);
  });

  it('returns null for multi-bit with no space', () => {
    expect(parseVcdValueChange('b1010$', signalMap, 0)).toBeNull();
  });

  it('returns null for multi-bit with unknown alias', () => {
    expect(parseVcdValueChange('b1010 %', signalMap, 0)).toBeNull();
  });

  it('handles leading/trailing whitespace', () => {
    const event = parseVcdValueChange('  1!  ', signalMap, 9000);
    expect(event).not.toBeNull();
    expect(event!.pin).toBe('portb0');
    expect(event!.value).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Full VCD Parsing
// ---------------------------------------------------------------------------

describe('parseVcd', () => {
  it('parses a complete VCD file', () => {
    const vcd = [
      '$timescale 1ns $end',
      '$scope module top $end',
      '$var wire 1 ! portb0 $end',
      '$var wire 1 " portb1 $end',
      '$upscope $end',
      '$enddefinitions $end',
      '#0',
      '0!',
      '0"',
      '#1000',
      '1!',
      '#2000',
      '0!',
      '1"',
      '#3000',
      '0"',
    ].join('\n');

    const events = parseVcd(vcd);

    expect(events).toHaveLength(6);

    // t=0: both pins low
    expect(events[0]).toEqual({ type: 'pin_change', pin: 'portb0', value: 0, timestampNs: 0 });
    expect(events[1]).toEqual({ type: 'pin_change', pin: 'portb1', value: 0, timestampNs: 0 });

    // t=1000: portb0 goes high
    expect(events[2]).toEqual({ type: 'pin_change', pin: 'portb0', value: 1, timestampNs: 1000 });

    // t=2000: portb0 low, portb1 high
    expect(events[3]).toEqual({ type: 'pin_change', pin: 'portb0', value: 0, timestampNs: 2000 });
    expect(events[4]).toEqual({ type: 'pin_change', pin: 'portb1', value: 1, timestampNs: 2000 });

    // t=3000: portb1 low
    expect(events[5]).toEqual({ type: 'pin_change', pin: 'portb1', value: 0, timestampNs: 3000 });
  });

  it('returns empty array for header-only VCD', () => {
    const vcd = [
      '$var wire 1 ! portb0 $end',
      '$enddefinitions $end',
    ].join('\n');

    const events = parseVcd(vcd);
    expect(events).toHaveLength(0);
  });

  it('returns empty array for empty input', () => {
    expect(parseVcd('')).toHaveLength(0);
  });

  it('handles VCD with multi-bit values', () => {
    const vcd = [
      '$var wire 8 $ portd $end',
      '$enddefinitions $end',
      '#0',
      'b00000000 $',
      '#500',
      'b11111111 $',
    ].join('\n');

    const events = parseVcd(vcd);
    expect(events).toHaveLength(2);
    expect(events[0].value).toBe(0); // 0b00000000 LSB = 0
    expect(events[1].value).toBe(1); // 0b11111111 LSB = 1
  });

  it('ignores body lines before $enddefinitions', () => {
    const vcd = [
      '1!',  // looks like a value change but is before $enddefinitions
      '$var wire 1 ! portb0 $end',
      '$enddefinitions $end',
      '#0',
      '1!',
    ].join('\n');

    const events = parseVcd(vcd);
    expect(events).toHaveLength(1);
    expect(events[0].timestampNs).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// UART Parsing
// ---------------------------------------------------------------------------

describe('parseUartLine', () => {
  it('parses UART0: XX format (lowercase hex)', () => {
    const event = parseUartLine('UART0: 48', 1000);
    expect(event).toEqual({
      type: 'uart_data',
      port: 0,
      byte: 0x48,
      char: 'H',
      timestampNs: 1000,
    });
  });

  it('parses UART0: XX format (uppercase hex)', () => {
    const event = parseUartLine('UART0: 4F', 2000);
    expect(event).toEqual({
      type: 'uart_data',
      port: 0,
      byte: 0x4f,
      char: 'O',
      timestampNs: 2000,
    });
  });

  it('parses different UART port numbers', () => {
    const event = parseUartLine('UART1: 41', 3000);
    expect(event).not.toBeNull();
    expect(event!.port).toBe(1);
    expect(event!.byte).toBe(0x41);
    expect(event!.char).toBe('A');
  });

  it('parses UART2 port', () => {
    const event = parseUartLine('UART2: 42', 4000);
    expect(event).not.toBeNull();
    expect(event!.port).toBe(2);
  });

  it('parses uart_pty_out format', () => {
    const event = parseUartLine('uart0_pty_out: 0x48', 5000);
    expect(event).toEqual({
      type: 'uart_data',
      port: 0,
      byte: 0x48,
      char: 'H',
      timestampNs: 5000,
    });
  });

  it('parses uart_pty_out with different port', () => {
    const event = parseUartLine('uart1_pty_out: 0x41', 6000);
    expect(event).not.toBeNull();
    expect(event!.port).toBe(1);
  });

  it('uses dot for non-printable ASCII bytes', () => {
    // 0x01 is a control character
    const event = parseUartLine('UART0: 01', 7000);
    expect(event).not.toBeNull();
    expect(event!.byte).toBe(1);
    expect(event!.char).toBe('.');
  });

  it('uses dot for DEL (0x7F)', () => {
    const event = parseUartLine('UART0: 7F', 7500);
    expect(event).not.toBeNull();
    expect(event!.byte).toBe(0x7f);
    expect(event!.char).toBe('.');
  });

  it('handles printable space character (0x20)', () => {
    const event = parseUartLine('UART0: 20', 8000);
    expect(event).not.toBeNull();
    expect(event!.char).toBe(' ');
  });

  it('handles tilde (0x7E) — last printable ASCII', () => {
    const event = parseUartLine('UART0: 7E', 8500);
    expect(event).not.toBeNull();
    expect(event!.char).toBe('~');
  });

  it('returns null for non-UART lines', () => {
    expect(parseUartLine('some random output')).toBeNull();
    expect(parseUartLine('simavr: starting...')).toBeNull();
    expect(parseUartLine('')).toBeNull();
  });

  it('returns null for malformed UART lines', () => {
    expect(parseUartLine('UART0: GG')).toBeNull(); // invalid hex
    expect(parseUartLine('UART0:')).toBeNull(); // missing value
    expect(parseUartLine('UART: 48')).toBeNull(); // missing port number
  });

  it('defaults timestampNs to 0 when not provided', () => {
    const event = parseUartLine('UART0: 48');
    expect(event).not.toBeNull();
    expect(event!.timestampNs).toBe(0);
  });

  it('is case-insensitive for UART prefix', () => {
    const event = parseUartLine('uart0: 48', 9000);
    expect(event).not.toBeNull();
    expect(event!.byte).toBe(0x48);
  });

  it('handles single hex digit', () => {
    const event = parseUartLine('UART0: A', 10000);
    expect(event).not.toBeNull();
    expect(event!.byte).toBe(0x0a);
    expect(event!.char).toBe('.');
  });

  it('handles whitespace', () => {
    const event = parseUartLine('  UART0: 48  ', 11000);
    expect(event).not.toBeNull();
    expect(event!.byte).toBe(0x48);
  });
});

// ---------------------------------------------------------------------------
// RuntimeEventBuffer
// ---------------------------------------------------------------------------

describe('RuntimeEventBuffer', () => {
  const makeEvent = (type: RuntimeEvent['type'], timestampNs: number): RuntimeEvent => {
    switch (type) {
      case 'pin_change':
        return { type, pin: 'portb0', value: 1, timestampNs };
      case 'uart_data':
        return { type, port: 0, byte: 0x48, char: 'H', timestampNs };
      case 'timer_tick':
        return { type, timer: 'timer0', value: 42, timestampNs };
      case 'cycle_count':
        return { type, cycles: 1000, timestampNs };
      case 'error':
        return { type, message: 'test error', timestampNs };
    }
  };

  describe('construction', () => {
    it('creates an empty buffer', () => {
      const buf = new RuntimeEventBuffer(100);
      expect(buf.size).toBe(0);
      expect(buf.getAll()).toEqual([]);
    });

    it('uses default max size of 10000', () => {
      const buf = new RuntimeEventBuffer();
      expect(buf.size).toBe(0);
      // Fill it to just over default — should not throw
      for (let i = 0; i < 10_001; i++) {
        buf.push(makeEvent('pin_change', i));
      }
      expect(buf.size).toBe(10_000);
    });

    it('throws for maxSize < 1', () => {
      expect(() => new RuntimeEventBuffer(0)).toThrow('maxSize must be >= 1');
      expect(() => new RuntimeEventBuffer(-1)).toThrow('maxSize must be >= 1');
    });
  });

  describe('push and getAll', () => {
    it('stores and retrieves a single event', () => {
      const buf = new RuntimeEventBuffer(10);
      const event = makeEvent('pin_change', 1000);
      buf.push(event);
      expect(buf.size).toBe(1);
      expect(buf.getAll()).toEqual([event]);
    });

    it('stores multiple events in order', () => {
      const buf = new RuntimeEventBuffer(10);
      const e1 = makeEvent('pin_change', 1000);
      const e2 = makeEvent('uart_data', 2000);
      const e3 = makeEvent('timer_tick', 3000);
      buf.push(e1);
      buf.push(e2);
      buf.push(e3);
      expect(buf.size).toBe(3);
      expect(buf.getAll()).toEqual([e1, e2, e3]);
    });

    it('evicts oldest event when full', () => {
      const buf = new RuntimeEventBuffer(3);
      const e1 = makeEvent('pin_change', 1000);
      const e2 = makeEvent('uart_data', 2000);
      const e3 = makeEvent('timer_tick', 3000);
      const e4 = makeEvent('cycle_count', 4000);
      buf.push(e1);
      buf.push(e2);
      buf.push(e3);
      buf.push(e4);
      expect(buf.size).toBe(3);
      const all = buf.getAll();
      expect(all).toEqual([e2, e3, e4]);
    });

    it('evicts multiple oldest events as more are added', () => {
      const buf = new RuntimeEventBuffer(3);
      for (let i = 0; i < 6; i++) {
        buf.push(makeEvent('pin_change', i * 1000));
      }
      expect(buf.size).toBe(3);
      const all = buf.getAll();
      expect(all).toHaveLength(3);
      expect(all[0].timestampNs).toBe(3000);
      expect(all[1].timestampNs).toBe(4000);
      expect(all[2].timestampNs).toBe(5000);
    });

    it('handles maxSize of 1', () => {
      const buf = new RuntimeEventBuffer(1);
      buf.push(makeEvent('pin_change', 1000));
      buf.push(makeEvent('uart_data', 2000));
      expect(buf.size).toBe(1);
      expect(buf.getAll()[0].timestampNs).toBe(2000);
    });

    it('wraps around correctly after many insertions', () => {
      const buf = new RuntimeEventBuffer(5);
      // Insert 12 events — wraps around 2+ times
      for (let i = 0; i < 12; i++) {
        buf.push(makeEvent('pin_change', i * 100));
      }
      expect(buf.size).toBe(5);
      const all = buf.getAll();
      expect(all.map((e) => e.timestampNs)).toEqual([700, 800, 900, 1000, 1100]);
    });
  });

  describe('getSince', () => {
    it('returns events after the given timestamp', () => {
      const buf = new RuntimeEventBuffer(10);
      buf.push(makeEvent('pin_change', 1000));
      buf.push(makeEvent('pin_change', 2000));
      buf.push(makeEvent('pin_change', 3000));
      buf.push(makeEvent('pin_change', 4000));

      const since = buf.getSince(2000);
      expect(since).toHaveLength(2);
      expect(since[0].timestampNs).toBe(3000);
      expect(since[1].timestampNs).toBe(4000);
    });

    it('returns all events when timestamp is before all events', () => {
      const buf = new RuntimeEventBuffer(10);
      buf.push(makeEvent('pin_change', 1000));
      buf.push(makeEvent('pin_change', 2000));
      expect(buf.getSince(0)).toHaveLength(2);
    });

    it('returns empty array when timestamp is after all events', () => {
      const buf = new RuntimeEventBuffer(10);
      buf.push(makeEvent('pin_change', 1000));
      buf.push(makeEvent('pin_change', 2000));
      expect(buf.getSince(5000)).toHaveLength(0);
    });

    it('returns empty array on empty buffer', () => {
      const buf = new RuntimeEventBuffer(10);
      expect(buf.getSince(0)).toEqual([]);
    });

    it('excludes events with exact matching timestamp', () => {
      const buf = new RuntimeEventBuffer(10);
      buf.push(makeEvent('pin_change', 1000));
      buf.push(makeEvent('pin_change', 2000));
      buf.push(makeEvent('pin_change', 3000));

      const since = buf.getSince(1000);
      expect(since).toHaveLength(2);
      expect(since[0].timestampNs).toBe(2000);
    });
  });

  describe('getByType', () => {
    it('returns only events of the specified type', () => {
      const buf = new RuntimeEventBuffer(10);
      buf.push(makeEvent('pin_change', 1000));
      buf.push(makeEvent('uart_data', 2000));
      buf.push(makeEvent('pin_change', 3000));
      buf.push(makeEvent('timer_tick', 4000));
      buf.push(makeEvent('uart_data', 5000));

      const pinEvents = buf.getByType('pin_change');
      expect(pinEvents).toHaveLength(2);
      expect(pinEvents.every((e) => e.type === 'pin_change')).toBe(true);
      expect(pinEvents[0].timestampNs).toBe(1000);
      expect(pinEvents[1].timestampNs).toBe(3000);
    });

    it('returns typed results for pin_change', () => {
      const buf = new RuntimeEventBuffer(10);
      buf.push({ type: 'pin_change', pin: 'portb0', value: 1, timestampNs: 100 });
      const events = buf.getByType('pin_change');
      // TypeScript should narrow to PinChangeEvent[]
      expect(events[0].pin).toBe('portb0');
      expect(events[0].value).toBe(1);
    });

    it('returns typed results for uart_data', () => {
      const buf = new RuntimeEventBuffer(10);
      buf.push({ type: 'uart_data', port: 0, byte: 0x48, char: 'H', timestampNs: 200 });
      const events = buf.getByType('uart_data');
      expect(events[0].port).toBe(0);
      expect(events[0].char).toBe('H');
    });

    it('returns empty array when no events match', () => {
      const buf = new RuntimeEventBuffer(10);
      buf.push(makeEvent('pin_change', 1000));
      expect(buf.getByType('error')).toEqual([]);
    });

    it('returns empty array on empty buffer', () => {
      const buf = new RuntimeEventBuffer(10);
      expect(buf.getByType('pin_change')).toEqual([]);
    });

    it('works correctly with all event types', () => {
      const buf = new RuntimeEventBuffer(10);
      buf.push(makeEvent('pin_change', 1000));
      buf.push(makeEvent('uart_data', 2000));
      buf.push(makeEvent('timer_tick', 3000));
      buf.push(makeEvent('cycle_count', 4000));
      buf.push(makeEvent('error', 5000));

      expect(buf.getByType('pin_change')).toHaveLength(1);
      expect(buf.getByType('uart_data')).toHaveLength(1);
      expect(buf.getByType('timer_tick')).toHaveLength(1);
      expect(buf.getByType('cycle_count')).toHaveLength(1);
      expect(buf.getByType('error')).toHaveLength(1);
    });
  });

  describe('clear', () => {
    it('removes all events', () => {
      const buf = new RuntimeEventBuffer(10);
      buf.push(makeEvent('pin_change', 1000));
      buf.push(makeEvent('uart_data', 2000));
      buf.push(makeEvent('timer_tick', 3000));
      buf.clear();
      expect(buf.size).toBe(0);
      expect(buf.getAll()).toEqual([]);
    });

    it('allows adding events after clear', () => {
      const buf = new RuntimeEventBuffer(10);
      buf.push(makeEvent('pin_change', 1000));
      buf.clear();
      const newEvent = makeEvent('uart_data', 5000);
      buf.push(newEvent);
      expect(buf.size).toBe(1);
      expect(buf.getAll()).toEqual([newEvent]);
    });

    it('is idempotent on empty buffer', () => {
      const buf = new RuntimeEventBuffer(10);
      buf.clear();
      buf.clear();
      expect(buf.size).toBe(0);
    });

    it('resets ring buffer state correctly after wrap-around', () => {
      const buf = new RuntimeEventBuffer(3);
      // Fill and wrap around
      for (let i = 0; i < 5; i++) {
        buf.push(makeEvent('pin_change', i * 1000));
      }
      expect(buf.size).toBe(3);

      buf.clear();
      expect(buf.size).toBe(0);

      // New events should start fresh
      buf.push(makeEvent('uart_data', 9000));
      buf.push(makeEvent('timer_tick', 10000));
      expect(buf.size).toBe(2);
      const all = buf.getAll();
      expect(all).toHaveLength(2);
      expect(all[0].timestampNs).toBe(9000);
      expect(all[1].timestampNs).toBe(10000);
    });
  });

  describe('size', () => {
    it('reports 0 for empty buffer', () => {
      expect(new RuntimeEventBuffer(10).size).toBe(0);
    });

    it('tracks size as events are added', () => {
      const buf = new RuntimeEventBuffer(10);
      buf.push(makeEvent('pin_change', 1000));
      expect(buf.size).toBe(1);
      buf.push(makeEvent('pin_change', 2000));
      expect(buf.size).toBe(2);
    });

    it('caps at maxSize', () => {
      const buf = new RuntimeEventBuffer(3);
      for (let i = 0; i < 10; i++) {
        buf.push(makeEvent('pin_change', i));
      }
      expect(buf.size).toBe(3);
    });

    it('resets to 0 after clear', () => {
      const buf = new RuntimeEventBuffer(10);
      buf.push(makeEvent('pin_change', 1000));
      buf.push(makeEvent('pin_change', 2000));
      buf.clear();
      expect(buf.size).toBe(0);
    });
  });

  describe('mixed event types', () => {
    it('stores and retrieves all RuntimeEvent variants', () => {
      const buf = new RuntimeEventBuffer(10);
      const events: RuntimeEvent[] = [
        { type: 'pin_change', pin: 'portb0', value: 1, timestampNs: 100 },
        { type: 'uart_data', port: 0, byte: 0x48, char: 'H', timestampNs: 200 },
        { type: 'timer_tick', timer: 'timer0', value: 42, timestampNs: 300 },
        { type: 'cycle_count', cycles: 16000000, timestampNs: 400 },
        { type: 'error', message: 'watchdog timeout', timestampNs: 500 },
      ];

      for (const e of events) {
        buf.push(e);
      }

      expect(buf.getAll()).toEqual(events);
    });

    it('preserves discriminated union structure through ring buffer', () => {
      const buf = new RuntimeEventBuffer(3);
      buf.push({ type: 'pin_change', pin: 'portb0', value: 1, timestampNs: 100 });
      buf.push({ type: 'uart_data', port: 0, byte: 0x48, char: 'H', timestampNs: 200 });
      buf.push({ type: 'error', message: 'oops', timestampNs: 300 });
      // Push one more to trigger eviction
      buf.push({ type: 'timer_tick', timer: 'timer0', value: 1, timestampNs: 400 });

      const all = buf.getAll();
      expect(all).toHaveLength(3);
      expect(all[0].type).toBe('uart_data');
      expect(all[1].type).toBe('error');
      expect(all[2].type).toBe('timer_tick');
    });
  });
});

// ---------------------------------------------------------------------------
// Type narrowing smoke tests
// ---------------------------------------------------------------------------

describe('type exports', () => {
  it('RuntimeEvent type narrows correctly', () => {
    const event: RuntimeEvent = {
      type: 'pin_change',
      pin: 'portb0',
      value: 1,
      timestampNs: 0,
    };

    // This is a compile-time check — if it compiles, the types are correct
    if (event.type === 'pin_change') {
      const _pin: string = event.pin;
      const _val: 0 | 1 = event.value;
      expect(_pin).toBe('portb0');
      expect(_val).toBe(1);
    }
  });

  it('PinChangeEvent is assignable to RuntimeEvent', () => {
    const pin: PinChangeEvent = { type: 'pin_change', pin: 'p', value: 0, timestampNs: 0 };
    const _event: RuntimeEvent = pin;
    expect(_event.type).toBe('pin_change');
  });

  it('UartDataEvent is assignable to RuntimeEvent', () => {
    const uart: UartDataEvent = { type: 'uart_data', port: 0, byte: 0, char: '.', timestampNs: 0 };
    const _event: RuntimeEvent = uart;
    expect(_event.type).toBe('uart_data');
  });
});
