import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  OtaVariableWatchManager,
  decodeValue,
  encodeValue,
  getTypeSize,
  isAddressWritable,
  isAddressValid,
  findRegion,
  resolveSymbol,
  parseSymbolTable,
  ATMEGA328P_MAP,
  ESP32_MAP,
  DEFAULT_POLL_INTERVAL_MS,
  MAX_BREAK_EVENTS,
} from '../ota-variable-watch';
import type {
  ElfSymbol,
  VariableType,
  BoardMemoryMap,
  OtaWatchSnapshot,
} from '../ota-variable-watch';

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function makeReadHandler(valueMap: Map<number, Uint8Array>): (addr: number, size: number) => Promise<Uint8Array> {
  return async (addr: number, size: number) => {
    const bytes = valueMap.get(addr);
    if (bytes) {
      return bytes.subarray(0, size);
    }
    return new Uint8Array(size);
  };
}

function makeWriteHandler(): { handler: (addr: number, bytes: Uint8Array) => Promise<boolean>; writes: Array<{ addr: number; bytes: Uint8Array }> } {
  const writes: Array<{ addr: number; bytes: Uint8Array }> = [];
  return {
    handler: async (addr: number, bytes: Uint8Array) => {
      writes.push({ addr, bytes: new Uint8Array(bytes) });
      return true;
    },
    writes,
  };
}

// ──────────────────────────────────────────────────────────────────
// Singleton
// ──────────────────────────────────────────────────────────────────

describe('OtaVariableWatchManager — singleton', () => {
  it('returns the same instance from getInstance()', () => {
    const a = OtaVariableWatchManager.getInstance();
    const b = OtaVariableWatchManager.getInstance();
    expect(a).toBe(b);
  });

  it('create() returns a fresh non-singleton instance', () => {
    const a = OtaVariableWatchManager.create();
    const b = OtaVariableWatchManager.create();
    expect(a).not.toBe(b);
  });
});

// ──────────────────────────────────────────────────────────────────
// getTypeSize
// ──────────────────────────────────────────────────────────────────

describe('getTypeSize', () => {
  it('returns correct sizes for all types', () => {
    expect(getTypeSize('uint8')).toBe(1);
    expect(getTypeSize('int8')).toBe(1);
    expect(getTypeSize('bool')).toBe(1);
    expect(getTypeSize('uint16')).toBe(2);
    expect(getTypeSize('int16')).toBe(2);
    expect(getTypeSize('uint32')).toBe(4);
    expect(getTypeSize('int32')).toBe(4);
    expect(getTypeSize('float')).toBe(4);
    expect(getTypeSize('string')).toBe(128);
  });
});

// ──────────────────────────────────────────────────────────────────
// decodeValue
// ──────────────────────────────────────────────────────────────────

describe('decodeValue', () => {
  it('decodes uint8', () => {
    expect(decodeValue(new Uint8Array([42]), 'uint8')).toBe(42);
  });

  it('decodes int8 negative', () => {
    expect(decodeValue(new Uint8Array([0xff]), 'int8')).toBe(-1);
  });

  it('decodes uint16 little-endian', () => {
    expect(decodeValue(new Uint8Array([0x00, 0x01]), 'uint16', 'little')).toBe(256);
  });

  it('decodes uint16 big-endian', () => {
    expect(decodeValue(new Uint8Array([0x01, 0x00]), 'uint16', 'big')).toBe(256);
  });

  it('decodes int16 negative little-endian', () => {
    expect(decodeValue(new Uint8Array([0xff, 0xff]), 'int16', 'little')).toBe(-1);
  });

  it('decodes uint32 little-endian', () => {
    expect(decodeValue(new Uint8Array([0x01, 0x00, 0x00, 0x00]), 'uint32', 'little')).toBe(1);
  });

  it('decodes int32 negative', () => {
    expect(decodeValue(new Uint8Array([0xff, 0xff, 0xff, 0xff]), 'int32', 'little')).toBe(-1);
  });

  it('decodes float', () => {
    const buf = new ArrayBuffer(4);
    new DataView(buf).setFloat32(0, 3.14, true);
    const result = decodeValue(new Uint8Array(buf), 'float', 'little');
    expect(result).toBeCloseTo(3.14, 2);
  });

  it('decodes bool true', () => {
    expect(decodeValue(new Uint8Array([1]), 'bool')).toBe(true);
  });

  it('decodes bool false', () => {
    expect(decodeValue(new Uint8Array([0]), 'bool')).toBe(false);
  });

  it('decodes bool non-zero as true', () => {
    expect(decodeValue(new Uint8Array([255]), 'bool')).toBe(true);
  });

  it('decodes null-terminated string', () => {
    const bytes = new TextEncoder().encode('hello\0world');
    expect(decodeValue(bytes, 'string')).toBe('hello');
  });

  it('decodes string without null terminator', () => {
    const bytes = new TextEncoder().encode('hello');
    expect(decodeValue(bytes, 'string')).toBe('hello');
  });

  it('throws on empty bytes', () => {
    expect(() => decodeValue(new Uint8Array(0), 'uint8')).toThrow('Cannot decode empty bytes');
  });

  it('throws on insufficient bytes for uint16', () => {
    expect(() => decodeValue(new Uint8Array([1]), 'uint16')).toThrow('at least 2 bytes');
  });

  it('throws on insufficient bytes for float', () => {
    expect(() => decodeValue(new Uint8Array([1, 2]), 'float')).toThrow('at least 4 bytes');
  });
});

// ──────────────────────────────────────────────────────────────────
// encodeValue
// ──────────────────────────────────────────────────────────────────

describe('encodeValue', () => {
  it('encodes uint8', () => {
    const bytes = encodeValue(42, 'uint8');
    expect(bytes).toEqual(new Uint8Array([42]));
  });

  it('encodes int8 negative', () => {
    const bytes = encodeValue(-1, 'int8');
    expect(new DataView(bytes.buffer).getInt8(0)).toBe(-1);
  });

  it('encodes uint16 little-endian', () => {
    const bytes = encodeValue(256, 'uint16', 'little');
    expect(bytes).toEqual(new Uint8Array([0x00, 0x01]));
  });

  it('encodes uint16 big-endian', () => {
    const bytes = encodeValue(256, 'uint16', 'big');
    expect(bytes).toEqual(new Uint8Array([0x01, 0x00]));
  });

  it('encodes float', () => {
    const bytes = encodeValue(3.14, 'float', 'little');
    const decoded = new DataView(bytes.buffer).getFloat32(0, true);
    expect(decoded).toBeCloseTo(3.14, 2);
  });

  it('encodes bool true', () => {
    expect(encodeValue(true, 'bool')).toEqual(new Uint8Array([1]));
  });

  it('encodes bool false', () => {
    expect(encodeValue(false, 'bool')).toEqual(new Uint8Array([0]));
  });

  it('encodes string with null terminator', () => {
    const bytes = encodeValue('hi', 'string');
    expect(bytes.length).toBe(3); // 'h', 'i', 0x00
    expect(bytes[2]).toBe(0);
  });

  it('round-trips uint32', () => {
    const encoded = encodeValue(12345678, 'uint32', 'little');
    const decoded = decodeValue(encoded, 'uint32', 'little');
    expect(decoded).toBe(12345678);
  });

  it('round-trips int32 negative', () => {
    const encoded = encodeValue(-54321, 'int32', 'little');
    const decoded = decodeValue(encoded, 'int32', 'little');
    expect(decoded).toBe(-54321);
  });
});

// ──────────────────────────────────────────────────────────────────
// Memory map utilities
// ──────────────────────────────────────────────────────────────────

describe('Memory map utilities', () => {
  it('isAddressValid for ATmega328P SRAM', () => {
    expect(isAddressValid(0x0100, 4, ATMEGA328P_MAP)).toBe(true);
  });

  it('isAddressValid returns false for out-of-range', () => {
    expect(isAddressValid(0xFFFF, 4, ATMEGA328P_MAP)).toBe(false);
  });

  it('isAddressWritable for ATmega328P SRAM', () => {
    expect(isAddressWritable(0x0100, 4, ATMEGA328P_MAP)).toBe(true);
  });

  it('isAddressWritable returns false for ESP32 IRAM (read-only)', () => {
    expect(isAddressWritable(0x40080000, 4, ESP32_MAP)).toBe(false);
  });

  it('isAddressWritable for ESP32 DRAM', () => {
    expect(isAddressWritable(0x3ffb0000, 4, ESP32_MAP)).toBe(true);
  });

  it('isAddressValid validates size fits within region', () => {
    // Just before end of SRAM (0x0900)
    expect(isAddressValid(0x08fe, 2, ATMEGA328P_MAP)).toBe(true);
    // Overflows SRAM
    expect(isAddressValid(0x08ff, 2, ATMEGA328P_MAP)).toBe(false);
  });

  it('findRegion returns the correct region', () => {
    const region = findRegion(0x0200, ATMEGA328P_MAP);
    expect(region).not.toBeNull();
    expect(region!.name).toBe('SRAM');
  });

  it('findRegion returns null for unmapped address', () => {
    expect(findRegion(0xFFFF, ATMEGA328P_MAP)).toBeNull();
  });

  it('findRegion for ESP32 DRAM', () => {
    const region = findRegion(0x3ffb0000, ESP32_MAP);
    expect(region).not.toBeNull();
    expect(region!.name).toBe('DRAM');
  });
});

// ──────────────────────────────────────────────────────────────────
// ELF symbol resolution
// ──────────────────────────────────────────────────────────────────

describe('ELF symbol resolution', () => {
  const symbols: ElfSymbol[] = [
    { name: 'temperature', address: 0x0200, size: 4, type: 'float', section: '.bss' },
    { name: 'led_state', address: 0x0204, size: 1, type: 'bool', section: '.data' },
    { name: 'counter', address: 0x0205, size: 2, type: 'uint16', section: '.bss' },
  ];

  it('resolveSymbol finds by name', () => {
    const sym = resolveSymbol('temperature', symbols);
    expect(sym).not.toBeNull();
    expect(sym!.address).toBe(0x0200);
    expect(sym!.type).toBe('float');
  });

  it('resolveSymbol returns null for unknown', () => {
    expect(resolveSymbol('nonexistent', symbols)).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────
// parseSymbolTable
// ──────────────────────────────────────────────────────────────────

describe('parseSymbolTable', () => {
  it('parses valid symbol table', () => {
    const text = [
      '0x20000100 4 float temperature .bss',
      '0x20000104 1 bool led_state .data',
      '0x20000105 2 uint16 counter .bss',
    ].join('\n');

    const symbols = parseSymbolTable(text);
    expect(symbols).toHaveLength(3);
    expect(symbols[0].name).toBe('temperature');
    expect(symbols[0].address).toBe(0x20000100);
    expect(symbols[0].type).toBe('float');
    expect(symbols[0].section).toBe('.bss');
    expect(symbols[1].type).toBe('bool');
    expect(symbols[2].type).toBe('uint16');
  });

  it('skips invalid lines', () => {
    const text = [
      '0x20000100 4 float temperature .bss',
      'not a valid line',
      '',
      '0x20000104 1 bool led .data',
    ].join('\n');

    const symbols = parseSymbolTable(text);
    expect(symbols).toHaveLength(2);
  });

  it('skips lines with invalid types', () => {
    const text = '0x20000100 4 badtype myvar .bss';
    const symbols = parseSymbolTable(text);
    expect(symbols).toHaveLength(0);
  });

  it('handles empty input', () => {
    expect(parseSymbolTable('')).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// Connection management
// ──────────────────────────────────────────────────────────────────

describe('OtaVariableWatchManager — connection', () => {
  let mgr: OtaVariableWatchManager;

  beforeEach(() => {
    mgr = OtaVariableWatchManager.create();
  });

  it('starts disconnected', () => {
    expect(mgr.getConnectionState()).toBe('disconnected');
  });

  it('connect transitions to connected', async () => {
    await mgr.connect();
    expect(mgr.getConnectionState()).toBe('connected');
  });

  it('connect is idempotent when already connected', async () => {
    await mgr.connect();
    await mgr.connect();
    expect(mgr.getConnectionState()).toBe('connected');
  });

  it('disconnect transitions to disconnected', async () => {
    await mgr.connect();
    mgr.disconnect();
    expect(mgr.getConnectionState()).toBe('disconnected');
  });
});

// ──────────────────────────────────────────────────────────────────
// Board type and memory map
// ──────────────────────────────────────────────────────────────────

describe('OtaVariableWatchManager — board type', () => {
  let mgr: OtaVariableWatchManager;

  beforeEach(() => {
    mgr = OtaVariableWatchManager.create();
  });

  it('defaults to atmega328p', () => {
    expect(mgr.getBoardType()).toBe('atmega328p');
  });

  it('setBoardType changes the board and memory map', () => {
    mgr.setBoardType('esp32');
    expect(mgr.getBoardType()).toBe('esp32');
    const map = mgr.getMemoryMap();
    expect(map.boardType).toBe('esp32');
    expect(map.pointerSize).toBe(4);
  });

  it('setCustomMemoryMap sets custom board type', () => {
    const customMap: BoardMemoryMap = {
      boardType: 'custom',
      regions: [{ name: 'RAM', startAddress: 0, endAddress: 0x10000, writable: true }],
      endianness: 'big',
      pointerSize: 4,
    };
    mgr.setCustomMemoryMap(customMap);
    expect(mgr.getBoardType()).toBe('custom');
    expect(mgr.getMemoryMap().endianness).toBe('big');
  });
});

// ──────────────────────────────────────────────────────────────────
// Variable watching
// ──────────────────────────────────────────────────────────────────

describe('OtaVariableWatchManager — variable watching', () => {
  let mgr: OtaVariableWatchManager;

  beforeEach(() => {
    mgr = OtaVariableWatchManager.create();
  });

  it('addVariable creates a watched variable', () => {
    const id = mgr.addVariable('temp', 0x0200, 'float');
    expect(mgr.getVariableCount()).toBe(1);
    const v = mgr.getVariable(id);
    expect(v).not.toBeNull();
    expect(v!.name).toBe('temp');
    expect(v!.type).toBe('float');
    expect(v!.value).toBeNull();
  });

  it('addVariable auto-sizes based on type', () => {
    const id = mgr.addVariable('flag', 0x0200, 'bool');
    expect(mgr.getVariable(id)!.size).toBe(1);
  });

  it('addVariable accepts custom size', () => {
    const id = mgr.addVariable('str', 0x0200, 'string', 64);
    expect(mgr.getVariable(id)!.size).toBe(64);
  });

  it('removeVariable removes by ID', () => {
    const id = mgr.addVariable('temp', 0x0200, 'float');
    expect(mgr.removeVariable(id)).toBe(true);
    expect(mgr.getVariableCount()).toBe(0);
  });

  it('removeVariable returns false for unknown ID', () => {
    expect(mgr.removeVariable('nonexistent')).toBe(false);
  });

  it('getVariable returns null for unknown ID', () => {
    expect(mgr.getVariable('nonexistent')).toBeNull();
  });

  it('getVariables returns all in order', () => {
    mgr.addVariable('a', 0x0200, 'uint8');
    mgr.addVariable('b', 0x0201, 'uint16');
    mgr.addVariable('c', 0x0203, 'float');
    const vars = mgr.getVariables();
    expect(vars).toHaveLength(3);
    expect(vars[0].name).toBe('a');
    expect(vars[1].name).toBe('b');
    expect(vars[2].name).toBe('c');
  });

  it('watchSymbol resolves and adds a variable', () => {
    mgr.setSymbols([
      { name: 'temperature', address: 0x0200, size: 4, type: 'float', section: '.bss' },
    ]);
    const id = mgr.watchSymbol('temperature');
    expect(id).not.toBeNull();
    expect(mgr.getVariable(id!)!.name).toBe('temperature');
    expect(mgr.getVariable(id!)!.type).toBe('float');
  });

  it('watchSymbol returns null for unknown symbol', () => {
    expect(mgr.watchSymbol('nonexistent')).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────
// Polling and reading
// ──────────────────────────────────────────────────────────────────

describe('OtaVariableWatchManager — polling', () => {
  let mgr: OtaVariableWatchManager;

  beforeEach(async () => {
    mgr = OtaVariableWatchManager.create();
    await mgr.connect();
  });

  it('pollVariables reads and decodes variable values', async () => {
    const floatBuf = new Uint8Array(4);
    new DataView(floatBuf.buffer).setFloat32(0, 25.5, true);
    const valueMap = new Map<number, Uint8Array>();
    valueMap.set(0x0100, floatBuf);

    mgr.setReadHandler(makeReadHandler(valueMap));
    const id = mgr.addVariable('temp', 0x0100, 'float');

    await mgr.pollVariables();

    const v = mgr.getVariable(id);
    expect(v!.value).toBeCloseTo(25.5, 1);
    expect(v!.readCount).toBe(1);
    expect(v!.lastReadTimestamp).not.toBeNull();
  });

  it('pollVariables skips if not connected', async () => {
    mgr.disconnect();
    mgr.setReadHandler(vi.fn());
    mgr.addVariable('temp', 0x0100, 'float');
    await mgr.pollVariables();
    // No error, just skipped
  });

  it('pollVariables skips if no read handler', async () => {
    mgr.addVariable('temp', 0x0100, 'float');
    await mgr.pollVariables(); // No read handler set — no error
  });

  it('pollVariables handles read errors gracefully', async () => {
    mgr.setReadHandler(async () => {
      throw new Error('Read failed');
    });
    const id = mgr.addVariable('temp', 0x0100, 'float');
    await mgr.pollVariables();
    expect(mgr.getVariable(id)!.value).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────
// Break-on-change
// ──────────────────────────────────────────────────────────────────

describe('OtaVariableWatchManager — break-on-change', () => {
  let mgr: OtaVariableWatchManager;
  let callCount: number;

  beforeEach(async () => {
    mgr = OtaVariableWatchManager.create();
    await mgr.connect();
    callCount = 0;

    mgr.setReadHandler(async () => {
      callCount++;
      const buf = new Uint8Array(1);
      buf[0] = callCount; // Value changes each poll
      return buf;
    });
  });

  it('detects change and records break event', async () => {
    const id = mgr.addVariable('counter', 0x0100, 'uint8');
    mgr.setBreakOnChange(id, true);

    // First poll — sets initial value
    await mgr.pollVariables();
    expect(mgr.getVariable(id)!.broken).toBe(false);

    // Second poll — value changed
    await mgr.pollVariables();
    expect(mgr.getVariable(id)!.broken).toBe(true);
    expect(mgr.getBreakEvents()).toHaveLength(1);
    expect(mgr.getBreakEvents()[0].variableName).toBe('counter');
  });

  it('acknowledgeBreak clears the broken flag', async () => {
    const id = mgr.addVariable('counter', 0x0100, 'uint8');
    mgr.setBreakOnChange(id, true);

    await mgr.pollVariables();
    await mgr.pollVariables();
    expect(mgr.getVariable(id)!.broken).toBe(true);

    mgr.acknowledgeBreak(id);
    expect(mgr.getVariable(id)!.broken).toBe(false);
  });

  it('clearBreakEvents clears all events and flags', async () => {
    const id = mgr.addVariable('counter', 0x0100, 'uint8');
    mgr.setBreakOnChange(id, true);
    await mgr.pollVariables();
    await mgr.pollVariables();

    mgr.clearBreakEvents();
    expect(mgr.getBreakEvents()).toHaveLength(0);
    expect(mgr.getVariable(id)!.broken).toBe(false);
  });

  it('disabling break-on-change clears broken flag', async () => {
    const id = mgr.addVariable('counter', 0x0100, 'uint8');
    mgr.setBreakOnChange(id, true);
    await mgr.pollVariables();
    await mgr.pollVariables();

    mgr.setBreakOnChange(id, false);
    expect(mgr.getVariable(id)!.broken).toBe(false);
  });

  it('caps break events at MAX_BREAK_EVENTS', async () => {
    const id = mgr.addVariable('counter', 0x0100, 'uint8');
    mgr.setBreakOnChange(id, true);

    // Generate more than MAX_BREAK_EVENTS breaks
    for (let i = 0; i < MAX_BREAK_EVENTS + 10; i++) {
      await mgr.pollVariables();
    }

    expect(mgr.getBreakEvents().length).toBeLessThanOrEqual(MAX_BREAK_EVENTS);
  });
});

// ──────────────────────────────────────────────────────────────────
// Memory read/write
// ──────────────────────────────────────────────────────────────────

describe('OtaVariableWatchManager — memory read/write', () => {
  let mgr: OtaVariableWatchManager;

  beforeEach(async () => {
    mgr = OtaVariableWatchManager.create();
    await mgr.connect();
  });

  it('readMemory returns result with timestamp', async () => {
    const valueMap = new Map<number, Uint8Array>();
    valueMap.set(0x0100, new Uint8Array([1, 2, 3, 4]));
    mgr.setReadHandler(makeReadHandler(valueMap));

    const result = await mgr.readMemory(0x0100, 4);
    expect(result.address).toBe(0x0100);
    expect(result.bytes).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it('readMemory throws without handler', async () => {
    await expect(mgr.readMemory(0x0100, 4)).rejects.toThrow('No read handler');
  });

  it('readMemory throws when not connected', async () => {
    mgr.disconnect();
    mgr.setReadHandler(async () => new Uint8Array(4));
    await expect(mgr.readMemory(0x0100, 4)).rejects.toThrow('Not connected');
  });

  it('writeMemory writes bytes', async () => {
    const wh = makeWriteHandler();
    mgr.setWriteHandler(wh.handler);

    await mgr.writeMemory(0x0100, new Uint8Array([42]));
    expect(wh.writes).toHaveLength(1);
    expect(wh.writes[0].addr).toBe(0x0100);
  });

  it('writeMemory throws without handler', async () => {
    await expect(mgr.writeMemory(0x0100, new Uint8Array([1]))).rejects.toThrow('No write handler');
  });

  it('writeMemory throws when not connected', async () => {
    mgr.disconnect();
    mgr.setWriteHandler(async () => true);
    await expect(mgr.writeMemory(0x0100, new Uint8Array([1]))).rejects.toThrow('Not connected');
  });

  it('writeMemory throws for non-writable address', async () => {
    mgr.setBoardType('esp32');
    mgr.setWriteHandler(async () => true);
    // IRAM is not writable
    await expect(mgr.writeMemory(0x40080000, new Uint8Array([1]))).rejects.toThrow('not in a writable region');
  });

  it('writeVariable encodes and writes', async () => {
    const wh = makeWriteHandler();
    mgr.setWriteHandler(wh.handler);
    mgr.setReadHandler(async () => new Uint8Array(1));

    const id = mgr.addVariable('flag', 0x0100, 'uint8');
    await mgr.writeVariable(id, 42);

    expect(wh.writes).toHaveLength(1);
    expect(wh.writes[0].bytes[0]).toBe(42);

    // Value is updated on the variable
    expect(mgr.getVariable(id)!.value).toBe(42);
  });

  it('writeVariable throws for unknown variable', async () => {
    mgr.setWriteHandler(async () => true);
    await expect(mgr.writeVariable('nonexistent', 1)).rejects.toThrow('not found');
  });
});

// ──────────────────────────────────────────────────────────────────
// Polling control
// ──────────────────────────────────────────────────────────────────

describe('OtaVariableWatchManager — polling control', () => {
  let mgr: OtaVariableWatchManager;

  beforeEach(async () => {
    vi.useFakeTimers();
    mgr = OtaVariableWatchManager.create();
    await mgr.connect();
    mgr.setReadHandler(async () => new Uint8Array([42]));
  });

  afterEach(() => {
    mgr.stopPolling();
    vi.useRealTimers();
  });

  it('startPolling begins periodic reads', () => {
    mgr.addVariable('x', 0x0100, 'uint8');
    mgr.startPolling();
    expect(mgr.isPolling()).toBe(true);
  });

  it('stopPolling stops periodic reads', () => {
    mgr.startPolling();
    mgr.stopPolling();
    expect(mgr.isPolling()).toBe(false);
  });

  it('startPolling does nothing when not connected', () => {
    mgr.disconnect();
    mgr.startPolling();
    expect(mgr.isPolling()).toBe(false);
  });

  it('startPolling is idempotent', () => {
    mgr.startPolling();
    mgr.startPolling();
    expect(mgr.isPolling()).toBe(true);
  });

  it('pausePolling prevents reads during interval', async () => {
    const readFn = vi.fn().mockResolvedValue(new Uint8Array([42]));
    mgr.setReadHandler(readFn);
    mgr.addVariable('x', 0x0100, 'uint8');
    mgr.startPolling();
    mgr.pausePolling();
    expect(mgr.isPaused()).toBe(true);

    await vi.advanceTimersByTimeAsync(DEFAULT_POLL_INTERVAL_MS + 10);
    expect(readFn).not.toHaveBeenCalled();
  });

  it('resumePolling allows reads again', async () => {
    const readFn = vi.fn().mockResolvedValue(new Uint8Array([42]));
    mgr.setReadHandler(readFn);
    mgr.addVariable('x', 0x0100, 'uint8');
    mgr.startPolling();
    mgr.pausePolling();
    mgr.resumePolling();
    expect(mgr.isPaused()).toBe(false);

    await vi.advanceTimersByTimeAsync(DEFAULT_POLL_INTERVAL_MS + 10);
    expect(readFn).toHaveBeenCalled();
  });

  it('setPollInterval changes interval', () => {
    mgr.setPollInterval(500);
    expect(mgr.getPollInterval()).toBe(500);
  });

  it('setPollInterval clamps minimum to 10ms', () => {
    mgr.setPollInterval(5);
    expect(mgr.getPollInterval()).toBe(10);
  });

  it('setPollInterval restarts polling if active', () => {
    mgr.startPolling();
    mgr.setPollInterval(1000);
    expect(mgr.isPolling()).toBe(true);
    expect(mgr.getPollInterval()).toBe(1000);
  });

  it('default poll interval is DEFAULT_POLL_INTERVAL_MS', () => {
    expect(mgr.getPollInterval()).toBe(DEFAULT_POLL_INTERVAL_MS);
  });
});

// ──────────────────────────────────────────────────────────────────
// Subscription
// ──────────────────────────────────────────────────────────────────

describe('OtaVariableWatchManager — subscription', () => {
  let mgr: OtaVariableWatchManager;

  beforeEach(() => {
    mgr = OtaVariableWatchManager.create();
  });

  it('notifies listeners on addVariable', () => {
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.addVariable('x', 0x0100, 'uint8');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe stops notifications', () => {
    const listener = vi.fn();
    const unsub = mgr.subscribe(listener);
    unsub();
    mgr.addVariable('x', 0x0100, 'uint8');
    expect(listener).not.toHaveBeenCalled();
  });

  it('getSnapshot returns cached snapshot', () => {
    mgr.addVariable('x', 0x0100, 'uint8');
    const s1 = mgr.getSnapshot();
    const s2 = mgr.getSnapshot();
    expect(s1).toBe(s2);
  });

  it('getSnapshot invalidates after state change', () => {
    mgr.addVariable('x', 0x0100, 'uint8');
    const s1 = mgr.getSnapshot();
    mgr.addVariable('y', 0x0101, 'uint8');
    const s2 = mgr.getSnapshot();
    expect(s1).not.toBe(s2);
  });
});

// ──────────────────────────────────────────────────────────────────
// Snapshot shape
// ──────────────────────────────────────────────────────────────────

describe('OtaVariableWatchManager — snapshot', () => {
  it('snapshot includes all expected fields', async () => {
    const mgr = OtaVariableWatchManager.create();
    await mgr.connect();
    mgr.addVariable('temp', 0x0100, 'float');
    mgr.setSymbols([{ name: 'x', address: 0x200, size: 1, type: 'uint8', section: '.bss' }]);

    const snap = mgr.getSnapshot();
    expect(snap.connectionState).toBe('connected');
    expect(snap.boardType).toBe('atmega328p');
    expect(snap.variables).toHaveLength(1);
    expect(snap.symbols).toHaveLength(1);
    expect(snap.breakEvents).toHaveLength(0);
    expect(snap.pollIntervalMs).toBe(DEFAULT_POLL_INTERVAL_MS);
    expect(snap.isPaused).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────
// Reset
// ──────────────────────────────────────────────────────────────────

describe('OtaVariableWatchManager — reset', () => {
  it('reset clears all state', async () => {
    const mgr = OtaVariableWatchManager.create();
    await mgr.connect();
    mgr.addVariable('x', 0x0100, 'uint8');
    mgr.setSymbols([{ name: 'x', address: 0x200, size: 1, type: 'uint8', section: '.bss' }]);

    mgr.reset();
    expect(mgr.getConnectionState()).toBe('disconnected');
    expect(mgr.getVariableCount()).toBe(0);
    expect(mgr.getSymbols()).toHaveLength(0);
    expect(mgr.getBreakEvents()).toHaveLength(0);
    expect(mgr.isPolling()).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────
// Symbol loading
// ──────────────────────────────────────────────────────────────────

describe('OtaVariableWatchManager — symbol loading', () => {
  let mgr: OtaVariableWatchManager;

  beforeEach(() => {
    mgr = OtaVariableWatchManager.create();
  });

  it('loadSymbols parses text and stores symbols', () => {
    mgr.loadSymbols('0x20000100 4 float temperature .bss\n0x20000104 1 bool led .data');
    expect(mgr.getSymbols()).toHaveLength(2);
    expect(mgr.getSymbols()[0].name).toBe('temperature');
  });

  it('setSymbols replaces symbols directly', () => {
    mgr.setSymbols([
      { name: 'a', address: 0x100, size: 1, type: 'uint8', section: '.bss' },
    ]);
    expect(mgr.getSymbols()).toHaveLength(1);
  });

  it('getSymbols returns a copy', () => {
    mgr.setSymbols([
      { name: 'a', address: 0x100, size: 1, type: 'uint8', section: '.bss' },
    ]);
    const syms = mgr.getSymbols();
    syms.pop();
    expect(mgr.getSymbols()).toHaveLength(1);
  });
});

// ──────────────────────────────────────────────────────────────────
// ATmega328P memory map
// ──────────────────────────────────────────────────────────────────

describe('ATmega328P memory map', () => {
  it('has 4 regions', () => {
    expect(ATMEGA328P_MAP.regions).toHaveLength(4);
  });

  it('SRAM starts at 0x0100', () => {
    const sram = ATMEGA328P_MAP.regions.find((r) => r.name === 'SRAM');
    expect(sram).toBeDefined();
    expect(sram!.startAddress).toBe(0x0100);
    expect(sram!.endAddress).toBe(0x0900);
  });

  it('uses little-endian and 2-byte pointers', () => {
    expect(ATMEGA328P_MAP.endianness).toBe('little');
    expect(ATMEGA328P_MAP.pointerSize).toBe(2);
  });
});

// ──────────────────────────────────────────────────────────────────
// ESP32 memory map
// ──────────────────────────────────────────────────────────────────

describe('ESP32 memory map', () => {
  it('has 4 regions', () => {
    expect(ESP32_MAP.regions).toHaveLength(4);
  });

  it('IRAM is not writable', () => {
    const iram = ESP32_MAP.regions.find((r) => r.name === 'IRAM');
    expect(iram!.writable).toBe(false);
  });

  it('DRAM is writable', () => {
    const dram = ESP32_MAP.regions.find((r) => r.name === 'DRAM');
    expect(dram!.writable).toBe(true);
  });

  it('uses little-endian and 4-byte pointers', () => {
    expect(ESP32_MAP.endianness).toBe('little');
    expect(ESP32_MAP.pointerSize).toBe(4);
  });
});

// ──────────────────────────────────────────────────────────────────
// Edge cases
// ──────────────────────────────────────────────────────────────────

describe('OtaVariableWatchManager — edge cases', () => {
  it('disconnect stops active polling', async () => {
    vi.useFakeTimers();
    const mgr = OtaVariableWatchManager.create();
    await mgr.connect();
    mgr.setReadHandler(async () => new Uint8Array([1]));
    mgr.addVariable('x', 0x0100, 'uint8');
    mgr.startPolling();
    expect(mgr.isPolling()).toBe(true);

    mgr.disconnect();
    expect(mgr.isPolling()).toBe(false);
    vi.useRealTimers();
  });

  it('multiple listeners all get notified', () => {
    const mgr = OtaVariableWatchManager.create();
    const l1 = vi.fn();
    const l2 = vi.fn();
    mgr.subscribe(l1);
    mgr.subscribe(l2);
    mgr.addVariable('x', 0x0100, 'uint8');
    expect(l1).toHaveBeenCalledTimes(1);
    expect(l2).toHaveBeenCalledTimes(1);
  });

  it('acknowledgeBreak on unknown variable is no-op', () => {
    const mgr = OtaVariableWatchManager.create();
    mgr.acknowledgeBreak('nonexistent'); // No error
  });

  it('setBreakOnChange on unknown variable is no-op', () => {
    const mgr = OtaVariableWatchManager.create();
    mgr.setBreakOnChange('nonexistent', true); // No error
  });
});
