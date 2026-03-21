/**
 * OtaVariableWatchManager — Live variable inspection via OTA debug protocol (BL-0704)
 *
 * Manages OTA debug connections to microcontrollers, providing variable watching
 * with type-aware decoding (uint8/int16/float/bool/string), memory read/write,
 * ELF symbol resolution, break-on-change detection, and board-specific memory maps
 * (ATmega328P/ESP32).
 *
 * Uses singleton+subscribe pattern for useSyncExternalStore compatibility.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Listener = () => void;

/** Supported variable data types for decoding. */
export type VariableType = 'uint8' | 'int8' | 'uint16' | 'int16' | 'uint32' | 'int32' | 'float' | 'bool' | 'string';

/** Byte order for multi-byte values. */
export type Endianness = 'little' | 'big';

/** OTA connection state. */
export type OtaConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/** Target board type. */
export type BoardType = 'atmega328p' | 'esp32' | 'custom';

/** Memory region definition. */
export interface MemoryRegion {
  /** Region name (e.g. 'SRAM', 'Flash', 'IRAM'). */
  name: string;
  /** Start address. */
  startAddress: number;
  /** End address (exclusive). */
  endAddress: number;
  /** Whether writable. */
  writable: boolean;
}

/** Board memory map. */
export interface BoardMemoryMap {
  boardType: BoardType;
  regions: MemoryRegion[];
  endianness: Endianness;
  pointerSize: number;
}

/** ELF symbol entry. */
export interface ElfSymbol {
  /** Symbol name. */
  name: string;
  /** Memory address. */
  address: number;
  /** Size in bytes. */
  size: number;
  /** Inferred or declared variable type. */
  type: VariableType;
  /** Section name (e.g. '.bss', '.data'). */
  section: string;
}

/** A watched variable definition. */
export interface WatchedVariable {
  /** Unique watch ID. */
  id: string;
  /** Variable name (from ELF or user-assigned). */
  name: string;
  /** Memory address. */
  address: number;
  /** Data type for decoding. */
  type: VariableType;
  /** Size in bytes. */
  size: number;
  /** Current decoded value (null if not yet read). */
  value: VariableValue | null;
  /** Previous value for break-on-change. */
  previousValue: VariableValue | null;
  /** Whether break-on-change is enabled. */
  breakOnChange: boolean;
  /** Whether this variable triggered a break. */
  broken: boolean;
  /** Number of times this variable has been read. */
  readCount: number;
  /** Last read timestamp (Date.now()). */
  lastReadTimestamp: number | null;
}

/** Decoded variable value. */
export type VariableValue = number | boolean | string;

/** Memory read result. */
export interface MemoryReadResult {
  address: number;
  bytes: Uint8Array;
  timestamp: number;
}

/** Memory write request. */
export interface MemoryWriteRequest {
  address: number;
  bytes: Uint8Array;
}

/** Break event emitted when a watched variable changes. */
export interface BreakEvent {
  variableId: string;
  variableName: string;
  oldValue: VariableValue | null;
  newValue: VariableValue;
  timestamp: number;
}

/** OTA Variable Watch snapshot for useSyncExternalStore. */
export interface OtaWatchSnapshot {
  connectionState: OtaConnectionState;
  boardType: BoardType;
  variables: WatchedVariable[];
  symbols: ElfSymbol[];
  breakEvents: BreakEvent[];
  pollIntervalMs: number;
  isPaused: boolean;
}

// ---------------------------------------------------------------------------
// Constants & Built-in Memory Maps
// ---------------------------------------------------------------------------

const DEFAULT_POLL_INTERVAL_MS = 250;
const MAX_BREAK_EVENTS = 100;
const MAX_STRING_LENGTH = 128;

/** ATmega328P memory map. */
const ATMEGA328P_MAP: BoardMemoryMap = {
  boardType: 'atmega328p',
  regions: [
    { name: 'Registers', startAddress: 0x0000, endAddress: 0x0020, writable: true },
    { name: 'IO', startAddress: 0x0020, endAddress: 0x0060, writable: true },
    { name: 'ExtIO', startAddress: 0x0060, endAddress: 0x0100, writable: true },
    { name: 'SRAM', startAddress: 0x0100, endAddress: 0x0900, writable: true },
  ],
  endianness: 'little',
  pointerSize: 2,
};

/** ESP32 memory map. */
const ESP32_MAP: BoardMemoryMap = {
  boardType: 'esp32',
  regions: [
    { name: 'IRAM', startAddress: 0x40080000, endAddress: 0x400a0000, writable: false },
    { name: 'DRAM', startAddress: 0x3ffb0000, endAddress: 0x40000000, writable: true },
    { name: 'RTC_FAST', startAddress: 0x3ff80000, endAddress: 0x3ff82000, writable: true },
    { name: 'RTC_SLOW', startAddress: 0x50000000, endAddress: 0x50002000, writable: true },
  ],
  endianness: 'little',
  pointerSize: 4,
};

const BOARD_MAPS: Record<BoardType, BoardMemoryMap | null> = {
  atmega328p: ATMEGA328P_MAP,
  esp32: ESP32_MAP,
  custom: null,
};

/** Get the byte size for a variable type. */
export function getTypeSize(type: VariableType): number {
  switch (type) {
    case 'uint8':
    case 'int8':
    case 'bool':
      return 1;
    case 'uint16':
    case 'int16':
      return 2;
    case 'uint32':
    case 'int32':
    case 'float':
      return 4;
    case 'string':
      return MAX_STRING_LENGTH;
  }
}

/** Decode raw bytes to a typed value. */
export function decodeValue(bytes: Uint8Array, type: VariableType, endianness: Endianness = 'little'): VariableValue {
  if (bytes.length === 0) {
    throw new Error('Cannot decode empty bytes');
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const le = endianness === 'little';

  switch (type) {
    case 'uint8':
      return view.getUint8(0);
    case 'int8':
      return view.getInt8(0);
    case 'uint16':
      if (bytes.length < 2) {
        throw new Error('Need at least 2 bytes for uint16');
      }
      return view.getUint16(0, le);
    case 'int16':
      if (bytes.length < 2) {
        throw new Error('Need at least 2 bytes for int16');
      }
      return view.getInt16(0, le);
    case 'uint32':
      if (bytes.length < 4) {
        throw new Error('Need at least 4 bytes for uint32');
      }
      return view.getUint32(0, le);
    case 'int32':
      if (bytes.length < 4) {
        throw new Error('Need at least 4 bytes for int32');
      }
      return view.getInt32(0, le);
    case 'float':
      if (bytes.length < 4) {
        throw new Error('Need at least 4 bytes for float');
      }
      return view.getFloat32(0, le);
    case 'bool':
      return view.getUint8(0) !== 0;
    case 'string': {
      // Null-terminated string
      let end = bytes.indexOf(0);
      if (end === -1) {
        end = bytes.length;
      }
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(bytes.subarray(0, end));
    }
  }
}

/** Encode a typed value to raw bytes. */
export function encodeValue(value: VariableValue, type: VariableType, endianness: Endianness = 'little'): Uint8Array {
  const le = endianness === 'little';

  switch (type) {
    case 'uint8': {
      const buf = new Uint8Array(1);
      new DataView(buf.buffer).setUint8(0, Number(value) & 0xff);
      return buf;
    }
    case 'int8': {
      const buf = new Uint8Array(1);
      new DataView(buf.buffer).setInt8(0, Number(value));
      return buf;
    }
    case 'uint16': {
      const buf = new Uint8Array(2);
      new DataView(buf.buffer).setUint16(0, Number(value) & 0xffff, le);
      return buf;
    }
    case 'int16': {
      const buf = new Uint8Array(2);
      new DataView(buf.buffer).setInt16(0, Number(value), le);
      return buf;
    }
    case 'uint32': {
      const buf = new Uint8Array(4);
      new DataView(buf.buffer).setUint32(0, Number(value) >>> 0, le);
      return buf;
    }
    case 'int32': {
      const buf = new Uint8Array(4);
      new DataView(buf.buffer).setInt32(0, Number(value), le);
      return buf;
    }
    case 'float': {
      const buf = new Uint8Array(4);
      new DataView(buf.buffer).setFloat32(0, Number(value), le);
      return buf;
    }
    case 'bool': {
      const buf = new Uint8Array(1);
      buf[0] = value ? 1 : 0;
      return buf;
    }
    case 'string': {
      const encoder = new TextEncoder();
      const encoded = encoder.encode(String(value));
      // Null-terminate
      const buf = new Uint8Array(encoded.length + 1);
      buf.set(encoded);
      buf[encoded.length] = 0;
      return buf;
    }
  }
}

/** Validate that an address falls within a writable memory region. */
export function isAddressWritable(address: number, size: number, memoryMap: BoardMemoryMap): boolean {
  for (let i = 0; i < memoryMap.regions.length; i++) {
    const region = memoryMap.regions[i];
    if (
      region.writable &&
      address >= region.startAddress &&
      address + size <= region.endAddress
    ) {
      return true;
    }
  }
  return false;
}

/** Validate that an address falls within any memory region. */
export function isAddressValid(address: number, size: number, memoryMap: BoardMemoryMap): boolean {
  for (let i = 0; i < memoryMap.regions.length; i++) {
    const region = memoryMap.regions[i];
    if (address >= region.startAddress && address + size <= region.endAddress) {
      return true;
    }
  }
  return false;
}

/** Find the memory region containing an address. */
export function findRegion(address: number, memoryMap: BoardMemoryMap): MemoryRegion | null {
  for (let i = 0; i < memoryMap.regions.length; i++) {
    const region = memoryMap.regions[i];
    if (address >= region.startAddress && address < region.endAddress) {
      return region;
    }
  }
  return null;
}

/** Resolve an ELF symbol by name. */
export function resolveSymbol(name: string, symbols: ElfSymbol[]): ElfSymbol | null {
  for (let i = 0; i < symbols.length; i++) {
    if (symbols[i].name === name) {
      return symbols[i];
    }
  }
  return null;
}

/** Parse a simple ELF symbol table (nm-like output format). */
export function parseSymbolTable(text: string): ElfSymbol[] {
  const symbols: ElfSymbol[] = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') {
      continue;
    }

    // Format: address size type name section
    // e.g.: 0x20000100 4 float temperature .bss
    const match = /^(0x[0-9a-fA-F]+)\s+(\d+)\s+(\w+)\s+(\S+)\s+(\S+)$/.exec(line);
    if (match) {
      const type = match[3] as VariableType;
      if (isValidType(type)) {
        symbols.push({
          address: parseInt(match[1], 16),
          size: parseInt(match[2], 10),
          type,
          name: match[4],
          section: match[5],
        });
      }
    }
  }

  return symbols;
}

function isValidType(type: string): type is VariableType {
  return ['uint8', 'int8', 'uint16', 'int16', 'uint32', 'int32', 'float', 'bool', 'string'].includes(type);
}

// ---------------------------------------------------------------------------
// OtaVariableWatchManager
// ---------------------------------------------------------------------------

export class OtaVariableWatchManager {
  private static _instance: OtaVariableWatchManager | null = null;

  private _listeners = new Set<Listener>();
  private _snapshotCache: OtaWatchSnapshot | null = null;

  private _connectionState: OtaConnectionState = 'disconnected';
  private _boardType: BoardType = 'atmega328p';
  private _memoryMap: BoardMemoryMap = ATMEGA328P_MAP;
  private _variables = new Map<string, WatchedVariable>();
  private _variableOrder: string[] = [];
  private _symbols: ElfSymbol[] = [];
  private _breakEvents: BreakEvent[] = [];
  private _pollIntervalMs = DEFAULT_POLL_INTERVAL_MS;
  private _pollTimerId: ReturnType<typeof setInterval> | null = null;
  private _isPaused = false;
  private _nextId = 1;

  // Read handler: simulates OTA memory read (replaceable for real hardware)
  private _readHandler: ((address: number, size: number) => Promise<Uint8Array>) | null = null;
  // Write handler: simulates OTA memory write (replaceable for real hardware)
  private _writeHandler: ((address: number, bytes: Uint8Array) => Promise<boolean>) | null = null;

  private constructor() {}

  static getInstance(): OtaVariableWatchManager {
    if (!OtaVariableWatchManager._instance) {
      OtaVariableWatchManager._instance = new OtaVariableWatchManager();
    }
    return OtaVariableWatchManager._instance;
  }

  /** Create a fresh (non-singleton) instance. Useful for testing. */
  static create(): OtaVariableWatchManager {
    return new OtaVariableWatchManager();
  }

  // -----------------------------------------------------------------------
  // Subscription (useSyncExternalStore compatible)
  // -----------------------------------------------------------------------

  subscribe = (listener: Listener): (() => void) => {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  };

  getSnapshot = (): OtaWatchSnapshot => {
    if (this._snapshotCache) {
      return this._snapshotCache;
    }
    this._snapshotCache = this._buildSnapshot();
    return this._snapshotCache;
  };

  private _invalidateCache(): void {
    this._snapshotCache = null;
  }

  private _notify(): void {
    this._invalidateCache();
    const listeners = Array.from(this._listeners);
    for (let i = 0; i < listeners.length; i++) {
      listeners[i]();
    }
  }

  // -----------------------------------------------------------------------
  // Connection management
  // -----------------------------------------------------------------------

  /** Set the board type and load its memory map. */
  setBoardType(boardType: BoardType): void {
    this._boardType = boardType;
    const map = BOARD_MAPS[boardType];
    if (map) {
      this._memoryMap = map;
    }
    this._notify();
  }

  /** Get the current board type. */
  getBoardType(): BoardType {
    return this._boardType;
  }

  /** Get the current memory map. */
  getMemoryMap(): BoardMemoryMap {
    return { ...this._memoryMap };
  }

  /** Set a custom memory map (for 'custom' board type). */
  setCustomMemoryMap(map: BoardMemoryMap): void {
    this._boardType = 'custom';
    this._memoryMap = map;
    this._notify();
  }

  /** Set the OTA read handler (called when polling variables). */
  setReadHandler(handler: (address: number, size: number) => Promise<Uint8Array>): void {
    this._readHandler = handler;
  }

  /** Set the OTA write handler (called when writing memory). */
  setWriteHandler(handler: (address: number, bytes: Uint8Array) => Promise<boolean>): void {
    this._writeHandler = handler;
  }

  /** Connect to the target. */
  async connect(): Promise<void> {
    if (this._connectionState === 'connected' || this._connectionState === 'connecting') {
      return;
    }

    this._connectionState = 'connecting';
    this._notify();

    try {
      // In real implementation, this would establish a serial/network connection
      this._connectionState = 'connected';
      this._notify();
    } catch {
      this._connectionState = 'error';
      this._notify();
    }
  }

  /** Disconnect from the target. */
  disconnect(): void {
    this._stopPolling();
    this._connectionState = 'disconnected';
    this._notify();
  }

  /** Get the current connection state. */
  getConnectionState(): OtaConnectionState {
    return this._connectionState;
  }

  // -----------------------------------------------------------------------
  // Symbol resolution
  // -----------------------------------------------------------------------

  /** Load ELF symbols from a symbol table string. */
  loadSymbols(symbolTableText: string): void {
    this._symbols = parseSymbolTable(symbolTableText);
    this._notify();
  }

  /** Set symbols directly. */
  setSymbols(symbols: ElfSymbol[]): void {
    this._symbols = [...symbols];
    this._notify();
  }

  /** Get all loaded symbols. */
  getSymbols(): ElfSymbol[] {
    return [...this._symbols];
  }

  /** Resolve a symbol by name and add it as a watched variable. */
  watchSymbol(symbolName: string): string | null {
    const sym = resolveSymbol(symbolName, this._symbols);
    if (!sym) {
      return null;
    }

    return this.addVariable(sym.name, sym.address, sym.type, sym.size);
  }

  // -----------------------------------------------------------------------
  // Variable watching
  // -----------------------------------------------------------------------

  /** Add a variable to watch. Returns the variable ID. */
  addVariable(name: string, address: number, type: VariableType, size?: number): string {
    const id = `var-${String(this._nextId++)}`;
    const computedSize = size ?? getTypeSize(type);

    const variable: WatchedVariable = {
      id,
      name,
      address,
      type,
      size: computedSize,
      value: null,
      previousValue: null,
      breakOnChange: false,
      broken: false,
      readCount: 0,
      lastReadTimestamp: null,
    };

    this._variables.set(id, variable);
    this._variableOrder.push(id);
    this._notify();
    return id;
  }

  /** Remove a watched variable by ID. */
  removeVariable(id: string): boolean {
    if (!this._variables.has(id)) {
      return false;
    }
    this._variables.delete(id);
    this._variableOrder = this._variableOrder.filter((vid) => vid !== id);
    this._notify();
    return true;
  }

  /** Get a watched variable by ID. */
  getVariable(id: string): WatchedVariable | null {
    const v = this._variables.get(id);
    return v ? { ...v } : null;
  }

  /** Get all watched variables in order. */
  getVariables(): WatchedVariable[] {
    return this._variableOrder.map((id) => {
      const v = this._variables.get(id);
      return v ? { ...v } : null;
    }).filter((v): v is WatchedVariable => v !== null);
  }

  /** Get the number of watched variables. */
  getVariableCount(): number {
    return this._variableOrder.length;
  }

  /** Enable or disable break-on-change for a variable. */
  setBreakOnChange(id: string, enabled: boolean): void {
    const v = this._variables.get(id);
    if (!v) {
      return;
    }
    v.breakOnChange = enabled;
    if (!enabled) {
      v.broken = false;
    }
    this._notify();
  }

  /** Acknowledge (clear) a break event on a variable. */
  acknowledgeBreak(id: string): void {
    const v = this._variables.get(id);
    if (!v) {
      return;
    }
    v.broken = false;
    this._notify();
  }

  /** Clear all break events. */
  clearBreakEvents(): void {
    this._breakEvents = [];
    this._variableOrder.forEach((id) => {
      const v = this._variables.get(id);
      if (v) {
        v.broken = false;
      }
    });
    this._notify();
  }

  /** Get all break events. */
  getBreakEvents(): BreakEvent[] {
    return [...this._breakEvents];
  }

  // -----------------------------------------------------------------------
  // Memory read/write
  // -----------------------------------------------------------------------

  /** Read memory from the target at the specified address. */
  async readMemory(address: number, size: number): Promise<MemoryReadResult> {
    if (!this._readHandler) {
      throw new Error('No read handler configured');
    }
    if (this._connectionState !== 'connected') {
      throw new Error('Not connected');
    }

    const bytes = await this._readHandler(address, size);
    return {
      address,
      bytes,
      timestamp: Date.now(),
    };
  }

  /** Write memory to the target at the specified address. */
  async writeMemory(address: number, bytes: Uint8Array): Promise<boolean> {
    if (!this._writeHandler) {
      throw new Error('No write handler configured');
    }
    if (this._connectionState !== 'connected') {
      throw new Error('Not connected');
    }

    if (!isAddressWritable(address, bytes.length, this._memoryMap)) {
      throw new Error(`Address 0x${address.toString(16)} is not in a writable region`);
    }

    return this._writeHandler(address, bytes);
  }

  /** Write a typed value to a watched variable. */
  async writeVariable(id: string, value: VariableValue): Promise<boolean> {
    const v = this._variables.get(id);
    if (!v) {
      throw new Error(`Variable ${id} not found`);
    }

    const bytes = encodeValue(value, v.type, this._memoryMap.endianness);
    const success = await this.writeMemory(v.address, bytes);

    if (success) {
      v.previousValue = v.value;
      v.value = value;
      this._notify();
    }

    return success;
  }

  /** Poll (read) all watched variables once. */
  async pollVariables(): Promise<void> {
    if (!this._readHandler || this._connectionState !== 'connected') {
      return;
    }

    const ids = [...this._variableOrder];
    for (let i = 0; i < ids.length; i++) {
      const v = this._variables.get(ids[i]);
      if (!v) {
        continue;
      }

      try {
        const bytes = await this._readHandler(v.address, v.size);
        const decoded = decodeValue(bytes, v.type, this._memoryMap.endianness);

        v.previousValue = v.value;
        v.value = decoded;
        v.readCount++;
        v.lastReadTimestamp = Date.now();

        // Break-on-change detection
        if (v.breakOnChange && v.previousValue !== null && v.previousValue !== decoded) {
          v.broken = true;
          const breakEvent: BreakEvent = {
            variableId: v.id,
            variableName: v.name,
            oldValue: v.previousValue,
            newValue: decoded,
            timestamp: Date.now(),
          };
          this._breakEvents.push(breakEvent);

          // Cap break events
          if (this._breakEvents.length > MAX_BREAK_EVENTS) {
            this._breakEvents = this._breakEvents.slice(-MAX_BREAK_EVENTS);
          }
        }
      } catch {
        // Skip variables that fail to read
      }
    }

    this._notify();
  }

  // -----------------------------------------------------------------------
  // Polling control
  // -----------------------------------------------------------------------

  /** Start automatic polling at the configured interval. */
  startPolling(): void {
    if (this._pollTimerId !== null) {
      return;
    }
    if (this._connectionState !== 'connected') {
      return;
    }

    this._isPaused = false;
    this._pollTimerId = setInterval(() => {
      if (!this._isPaused) {
        void this.pollVariables();
      }
    }, this._pollIntervalMs);
    this._notify();
  }

  /** Stop automatic polling. */
  stopPolling(): void {
    this._stopPolling();
    this._notify();
  }

  /** Pause polling (timer stays alive but reads are skipped). */
  pausePolling(): void {
    this._isPaused = true;
    this._notify();
  }

  /** Resume polling. */
  resumePolling(): void {
    this._isPaused = false;
    this._notify();
  }

  /** Set the polling interval in ms. */
  setPollInterval(ms: number): void {
    if (ms < 10) {
      ms = 10;
    }
    this._pollIntervalMs = ms;

    // Restart polling if active
    if (this._pollTimerId !== null) {
      this._stopPolling();
      this.startPolling();
    }
    this._notify();
  }

  /** Get the current polling interval in ms. */
  getPollInterval(): number {
    return this._pollIntervalMs;
  }

  /** Whether polling is currently active. */
  isPolling(): boolean {
    return this._pollTimerId !== null;
  }

  /** Whether polling is paused. */
  isPaused(): boolean {
    return this._isPaused;
  }

  // -----------------------------------------------------------------------
  // Reset
  // -----------------------------------------------------------------------

  /** Reset all state. */
  reset(): void {
    this._stopPolling();
    this._connectionState = 'disconnected';
    this._variables.clear();
    this._variableOrder = [];
    this._symbols = [];
    this._breakEvents = [];
    this._isPaused = false;
    this._nextId = 1;
    this._readHandler = null;
    this._writeHandler = null;
    this._notify();
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private _stopPolling(): void {
    if (this._pollTimerId !== null) {
      clearInterval(this._pollTimerId);
      this._pollTimerId = null;
    }
  }

  private _buildSnapshot(): OtaWatchSnapshot {
    return {
      connectionState: this._connectionState,
      boardType: this._boardType,
      variables: this.getVariables(),
      symbols: [...this._symbols],
      breakEvents: [...this._breakEvents],
      pollIntervalMs: this._pollIntervalMs,
      isPaused: this._isPaused,
    };
  }
}

// Re-export constants for testing
export { DEFAULT_POLL_INTERVAL_MS, MAX_BREAK_EVENTS, MAX_STRING_LENGTH, ATMEGA328P_MAP, ESP32_MAP, BOARD_MAPS };
