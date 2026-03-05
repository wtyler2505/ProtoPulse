/**
 * Web Serial API Hardware Communication Library
 *
 * Provides browser-based serial communication for connecting to
 * Arduino, ESP32, and other serial devices directly from the browser.
 * Uses the Web Serial API (Chrome/Edge only).
 *
 * Features:
 * - Port discovery and connection with configurable baud rate
 * - Auto-reconnection with exponential backoff
 * - Send/receive data (text and binary modes)
 * - Serial monitor buffer with configurable max lines
 * - Line ending configuration (CR, LF, CRLF, None)
 * - DTR/RTS signal control (Arduino reset)
 * - Port filters by USB vendor/product ID
 * - Connection profiles (JSON export/import, localStorage persistence)
 * - Singleton+subscribe pattern with React hook
 *
 * Usage:
 *   const manager = WebSerialManager.getInstance();
 *   await manager.requestPort();
 *   await manager.connect({ baudRate: 115200 });
 *   manager.send('Hello Arduino!\n');
 *
 * React hook:
 *   const { state, connect, disconnect, send, monitor } = useWebSerial();
 */

// ---------------------------------------------------------------------------
// Web Serial API type declarations (Chrome/Edge only, not in standard DOM lib)
// ---------------------------------------------------------------------------

interface SerialPortOpenOptions {
  baudRate: number;
  dataBits?: 7 | 8;
  stopBits?: 1 | 2;
  parity?: 'none' | 'even' | 'odd';
  bufferSize?: number;
  flowControl?: 'none' | 'hardware';
}

interface SerialOutputSignals {
  dataTerminalReady?: boolean;
  requestToSend?: boolean;
  break?: boolean;
}

interface SerialPortInfoData {
  usbVendorId?: number;
  usbProductId?: number;
}

interface SerialPortRequestOptions {
  filters?: Array<{ usbVendorId: number; usbProductId?: number }>;
}

interface SerialPort extends EventTarget {
  readonly readable: ReadableStream<Uint8Array> | null;
  readonly writable: WritableStream<Uint8Array> | null;
  open(options: SerialPortOpenOptions): Promise<void>;
  close(): Promise<void>;
  getInfo(): SerialPortInfoData;
  setSignals(signals: SerialOutputSignals): Promise<void>;
}

interface Serial extends EventTarget {
  requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
  getPorts(): Promise<SerialPort[]>;
}

declare global {
  interface Navigator {
    readonly serial?: Serial;
  }
}

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export type LineEnding = 'none' | 'cr' | 'lf' | 'crlf';

export type DataMode = 'text' | 'binary';

export interface SerialPortFilter {
  usbVendorId: number;
  usbProductId?: number;
}

export interface ConnectionOptions {
  baudRate: number;
  dataBits?: 7 | 8;
  stopBits?: 1 | 2;
  parity?: 'none' | 'even' | 'odd';
  bufferSize?: number;
  flowControl?: 'none' | 'hardware';
}

export interface SerialMonitorLine {
  timestamp: number;
  direction: 'rx' | 'tx';
  data: string;
}

export interface ConnectionProfile {
  name: string;
  baudRate: number;
  dataBits: 7 | 8;
  stopBits: 1 | 2;
  parity: 'none' | 'even' | 'odd';
  flowControl: 'none' | 'hardware';
  lineEnding: LineEnding;
  dataMode: DataMode;
  dtr: boolean;
  rts: boolean;
  filters?: SerialPortFilter[];
}

export interface WebSerialState {
  connectionState: ConnectionState;
  portInfo: SerialPortInfo | null;
  baudRate: number;
  lineEnding: LineEnding;
  dataMode: DataMode;
  dtr: boolean;
  rts: boolean;
  monitor: SerialMonitorLine[];
  error: string | null;
  isSupported: boolean;
  bytesReceived: number;
  bytesSent: number;
}

export interface SerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}

export interface WebSerialEvent {
  type: 'data' | 'state_change' | 'error';
  data?: string | Uint8Array;
  state?: ConnectionState;
  error?: string;
}

export interface UseWebSerialOptions {
  onData?: (data: string) => void;
  onStateChange?: (state: ConnectionState) => void;
  onError?: (error: string) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const COMMON_BAUD_RATES: readonly number[] = [
  300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600,
] as const;

/**
 * Common USB vendor/product IDs for Arduino and ESP32 boards.
 * Used as default port filters for requestPort().
 */
export const KNOWN_BOARD_FILTERS: readonly (SerialPortFilter & { label: string })[] = [
  { label: 'Arduino Uno/Mega (ATmega16U2)', usbVendorId: 0x2341, usbProductId: 0x0043 },
  { label: 'Arduino Uno R3', usbVendorId: 0x2341, usbProductId: 0x0001 },
  { label: 'Arduino Leonardo', usbVendorId: 0x2341, usbProductId: 0x8036 },
  { label: 'Arduino Micro', usbVendorId: 0x2341, usbProductId: 0x8037 },
  { label: 'Arduino Due', usbVendorId: 0x2341, usbProductId: 0x003d },
  { label: 'Arduino Mega 2560', usbVendorId: 0x2341, usbProductId: 0x0042 },
  { label: 'Espressif ESP32', usbVendorId: 0x303a },
  { label: 'Silicon Labs CP2102 (ESP32/NodeMCU)', usbVendorId: 0x10c4, usbProductId: 0xea60 },
  { label: 'FTDI FT232R', usbVendorId: 0x0403, usbProductId: 0x6001 },
  { label: 'WCH CH340 (Arduino clones)', usbVendorId: 0x1a86, usbProductId: 0x7523 },
  { label: 'Adafruit Feather', usbVendorId: 0x239a },
  { label: 'SparkFun (various)', usbVendorId: 0x1b4f },
  { label: 'Teensy (PJRC)', usbVendorId: 0x16c0, usbProductId: 0x0483 },
  { label: 'STMicroelectronics STLink', usbVendorId: 0x0483, usbProductId: 0x374b },
  { label: 'Raspberry Pi Pico', usbVendorId: 0x2e8a, usbProductId: 0x0005 },
] as const;

const DEFAULT_BAUD_RATE = 115200;
const DEFAULT_MAX_MONITOR_LINES = 1000;
const DEFAULT_DATA_BITS = 8 as const;
const DEFAULT_STOP_BITS = 1 as const;
const DEFAULT_PARITY = 'none' as const;
const DEFAULT_FLOW_CONTROL = 'none' as const;

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30000;
const RECONNECT_BACKOFF_MULTIPLIER = 2;

const STORAGE_KEY_PROFILES = 'protopulse:serial:profiles';
const STORAGE_KEY_PREFERENCES = 'protopulse:serial:preferences';

const LINE_ENDING_MAP: Record<LineEnding, string> = {
  none: '',
  cr: '\r',
  lf: '\n',
  crlf: '\r\n',
};

// ---------------------------------------------------------------------------
// WebSerialManager
// ---------------------------------------------------------------------------

/**
 * Central manager for Web Serial communication.
 * Singleton with subscribe pattern for React integration.
 */
export class WebSerialManager {
  private static instance: WebSerialManager | null = null;

  private subscribers: Set<(event: WebSerialEvent) => void>;
  private stateSubscribers: Set<() => void>;

  // Serial port state
  private _port: SerialPort | null;
  private _reader: ReadableStreamDefaultReader<Uint8Array> | null;
  private _writer: WritableStreamDefaultWriter<Uint8Array> | null;
  private _connectionState: ConnectionState;
  private _portInfo: SerialPortInfo | null;
  private _error: string | null;

  // Configuration
  private _baudRate: number;
  private _lineEnding: LineEnding;
  private _dataMode: DataMode;
  private _dtr: boolean;
  private _rts: boolean;
  private _connectionOptions: ConnectionOptions | null;

  // Monitor buffer
  private _monitor: SerialMonitorLine[];
  private _maxMonitorLines: number;
  private _bytesReceived: number;
  private _bytesSent: number;

  // Auto-reconnect
  private _autoReconnect: boolean;
  private _reconnectAttempt: number;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null;

  // Read loop
  private _readLoopActive: boolean;
  private _readAbortController: AbortController | null;

  // Partial line buffer for text mode
  private _rxBuffer: string;

  constructor() {
    this.subscribers = new Set();
    this.stateSubscribers = new Set();

    this._port = null;
    this._reader = null;
    this._writer = null;
    this._connectionState = 'disconnected';
    this._portInfo = null;
    this._error = null;

    this._baudRate = DEFAULT_BAUD_RATE;
    this._lineEnding = 'lf';
    this._dataMode = 'text';
    this._dtr = true;
    this._rts = true;
    this._connectionOptions = null;

    this._monitor = [];
    this._maxMonitorLines = DEFAULT_MAX_MONITOR_LINES;
    this._bytesReceived = 0;
    this._bytesSent = 0;

    this._autoReconnect = true;
    this._reconnectAttempt = 0;
    this._reconnectTimer = null;

    this._readLoopActive = false;
    this._readAbortController = null;

    this._rxBuffer = '';

    this.loadPreferences();
  }

  /** Get or create the singleton instance. */
  static getInstance(): WebSerialManager {
    if (!WebSerialManager.instance) {
      WebSerialManager.instance = new WebSerialManager();
    }
    return WebSerialManager.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetInstance(): void {
    if (WebSerialManager.instance) {
      WebSerialManager.instance.destroy();
    }
    WebSerialManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // State accessors
  // -----------------------------------------------------------------------

  get connectionState(): ConnectionState {
    return this._connectionState;
  }

  get portInfo(): SerialPortInfo | null {
    return this._portInfo;
  }

  get baudRate(): number {
    return this._baudRate;
  }

  get lineEnding(): LineEnding {
    return this._lineEnding;
  }

  get dataMode(): DataMode {
    return this._dataMode;
  }

  get dtr(): boolean {
    return this._dtr;
  }

  get rts(): boolean {
    return this._rts;
  }

  get monitor(): readonly SerialMonitorLine[] {
    return this._monitor;
  }

  get error(): string | null {
    return this._error;
  }

  get bytesReceived(): number {
    return this._bytesReceived;
  }

  get bytesSent(): number {
    return this._bytesSent;
  }

  get autoReconnect(): boolean {
    return this._autoReconnect;
  }

  get maxMonitorLines(): number {
    return this._maxMonitorLines;
  }

  get isConnected(): boolean {
    return this._connectionState === 'connected';
  }

  /** Get the full state snapshot. */
  getState(): WebSerialState {
    return {
      connectionState: this._connectionState,
      portInfo: this._portInfo,
      baudRate: this._baudRate,
      lineEnding: this._lineEnding,
      dataMode: this._dataMode,
      dtr: this._dtr,
      rts: this._rts,
      monitor: [...this._monitor],
      error: this._error,
      isSupported: WebSerialManager.isSupported(),
      bytesReceived: this._bytesReceived,
      bytesSent: this._bytesSent,
    };
  }

  // -----------------------------------------------------------------------
  // Browser support check
  // -----------------------------------------------------------------------

  /** Check if the Web Serial API is supported in this browser. */
  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  // -----------------------------------------------------------------------
  // Port management
  // -----------------------------------------------------------------------

  /**
   * Request a serial port from the user.
   * This MUST be called from a user gesture (click, keypress, etc.)
   * due to Web Serial API security requirements.
   */
  async requestPort(filters?: SerialPortFilter[]): Promise<boolean> {
    if (!WebSerialManager.isSupported()) {
      this.setError('Web Serial API is not supported in this browser. Use Chrome or Edge.');
      return false;
    }

    try {
      const options: SerialPortRequestOptions = {};
      if (filters && filters.length > 0) {
        options.filters = filters.map((f) => ({
          usbVendorId: f.usbVendorId,
          ...(f.usbProductId !== undefined ? { usbProductId: f.usbProductId } : {}),
        }));
      }

      // isSupported() already verified navigator.serial exists
      this._port = await navigator.serial!.requestPort(options);
      this._portInfo = this.extractPortInfo(this._port);
      this._error = null;
      this.notifyState();
      return true;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        // User cancelled the port picker — not an error
        return false;
      }
      this.setError(`Failed to request port: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  /**
   * Get previously authorized ports (no user gesture needed).
   */
  async getPorts(): Promise<SerialPortInfo[]> {
    if (!WebSerialManager.isSupported()) {
      return [];
    }
    try {
      const ports = await navigator.serial!.getPorts();
      return ports.map((p: SerialPort) => this.extractPortInfo(p));
    } catch {
      return [];
    }
  }

  // -----------------------------------------------------------------------
  // Connection
  // -----------------------------------------------------------------------

  /**
   * Open the serial connection with the given options.
   * Port must have been requested first via requestPort().
   */
  async connect(options?: Partial<ConnectionOptions>): Promise<boolean> {
    if (!this._port) {
      this.setError('No port selected. Call requestPort() first.');
      return false;
    }

    if (this._connectionState === 'connected' || this._connectionState === 'connecting') {
      return this._connectionState === 'connected';
    }

    this.setConnectionState('connecting');
    this.cancelReconnect();

    const connOpts: ConnectionOptions = {
      baudRate: options?.baudRate ?? this._baudRate,
      dataBits: options?.dataBits ?? DEFAULT_DATA_BITS,
      stopBits: options?.stopBits ?? DEFAULT_STOP_BITS,
      parity: options?.parity ?? DEFAULT_PARITY,
      bufferSize: options?.bufferSize ?? 8192,
      flowControl: options?.flowControl ?? DEFAULT_FLOW_CONTROL,
    };

    this._baudRate = connOpts.baudRate;
    this._connectionOptions = connOpts;

    try {
      await this._port.open({
        baudRate: connOpts.baudRate,
        dataBits: connOpts.dataBits,
        stopBits: connOpts.stopBits,
        parity: connOpts.parity,
        bufferSize: connOpts.bufferSize,
        flowControl: connOpts.flowControl,
      });

      // Set DTR/RTS signals
      await this.setSignals({ dtr: this._dtr, rts: this._rts });

      this._reconnectAttempt = 0;
      this.setConnectionState('connected');
      this.startReadLoop();
      this.savePreferences();

      return true;
    } catch (err) {
      const message = `Connection failed: ${err instanceof Error ? err.message : String(err)}`;
      this.setError(message);
      this.setConnectionState('error');
      this.scheduleReconnect();
      return false;
    }
  }

  /**
   * Disconnect the serial port.
   */
  async disconnect(): Promise<void> {
    this.cancelReconnect();
    this._autoReconnect = false;
    await this.closePort();
    this._autoReconnect = true;
    this.setConnectionState('disconnected');
  }

  // -----------------------------------------------------------------------
  // Data sending
  // -----------------------------------------------------------------------

  /**
   * Send data over the serial port.
   * In text mode, appends the configured line ending.
   * In binary mode, sends raw bytes.
   */
  async send(data: string | Uint8Array): Promise<boolean> {
    if (this._connectionState !== 'connected' || !this._port?.writable) {
      this.setError('Cannot send: not connected.');
      return false;
    }

    try {
      if (!this._writer) {
        this._writer = this._port.writable.getWriter();
      }

      let bytes: Uint8Array;
      let displayData: string;

      if (typeof data === 'string') {
        const textWithEnding = data + LINE_ENDING_MAP[this._lineEnding];
        bytes = new TextEncoder().encode(textWithEnding);
        displayData = data;
      } else {
        bytes = data;
        displayData = this.formatBinaryData(data);
      }

      await this._writer.write(bytes);

      this._bytesSent += bytes.length;
      this.addMonitorLine('tx', displayData);
      this.notifyState();

      return true;
    } catch (err) {
      const message = `Send failed: ${err instanceof Error ? err.message : String(err)}`;
      this.setError(message);
      await this.handleDisconnection();
      return false;
    }
  }

  // -----------------------------------------------------------------------
  // DTR/RTS signal control
  // -----------------------------------------------------------------------

  /**
   * Set serial control signals (DTR, RTS).
   * DTR toggle is commonly used to reset Arduino boards.
   */
  async setSignals(signals: { dtr?: boolean; rts?: boolean }): Promise<boolean> {
    if (!this._port) {
      return false;
    }

    try {
      const signalValues: SerialOutputSignals = {};
      if (signals.dtr !== undefined) {
        signalValues.dataTerminalReady = signals.dtr;
        this._dtr = signals.dtr;
      }
      if (signals.rts !== undefined) {
        signalValues.requestToSend = signals.rts;
        this._rts = signals.rts;
      }

      await this._port.setSignals(signalValues);
      this.notifyState();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Toggle DTR to reset an Arduino board.
   * Pulls DTR low, waits briefly, then pulls it high again.
   */
  async resetBoard(delayMs = 250): Promise<boolean> {
    if (!this._port) {
      return false;
    }

    try {
      await this._port.setSignals({ dataTerminalReady: false });
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      await this._port.setSignals({ dataTerminalReady: true });
      this.addMonitorLine('tx', '[Board Reset]');
      this.notifyState();
      return true;
    } catch {
      return false;
    }
  }

  // -----------------------------------------------------------------------
  // Configuration
  // -----------------------------------------------------------------------

  setBaudRate(baudRate: number): void {
    this._baudRate = baudRate;
    this.savePreferences();
    this.notifyState();
  }

  setLineEnding(lineEnding: LineEnding): void {
    this._lineEnding = lineEnding;
    this.savePreferences();
    this.notifyState();
  }

  setDataMode(dataMode: DataMode): void {
    this._dataMode = dataMode;
    this.savePreferences();
    this.notifyState();
  }

  setAutoReconnect(enabled: boolean): void {
    this._autoReconnect = enabled;
    if (!enabled) {
      this.cancelReconnect();
    }
  }

  setMaxMonitorLines(max: number): void {
    this._maxMonitorLines = Math.max(1, max);
    this.trimMonitor();
    this.notifyState();
  }

  // -----------------------------------------------------------------------
  // Monitor buffer
  // -----------------------------------------------------------------------

  /** Clear the serial monitor buffer. */
  clearMonitor(): void {
    this._monitor = [];
    this._bytesReceived = 0;
    this._bytesSent = 0;
    this.notifyState();
  }

  /** Get a copy of the monitor buffer. */
  getMonitorLines(): SerialMonitorLine[] {
    return [...this._monitor];
  }

  // -----------------------------------------------------------------------
  // Connection profiles
  // -----------------------------------------------------------------------

  /** Create a connection profile from current settings. */
  createProfile(name: string): ConnectionProfile {
    return {
      name,
      baudRate: this._baudRate,
      dataBits: DEFAULT_DATA_BITS,
      stopBits: DEFAULT_STOP_BITS,
      parity: DEFAULT_PARITY,
      flowControl: DEFAULT_FLOW_CONTROL,
      lineEnding: this._lineEnding,
      dataMode: this._dataMode,
      dtr: this._dtr,
      rts: this._rts,
    };
  }

  /** Apply a connection profile. */
  applyProfile(profile: ConnectionProfile): void {
    this._baudRate = profile.baudRate;
    this._lineEnding = profile.lineEnding;
    this._dataMode = profile.dataMode;
    this._dtr = profile.dtr;
    this._rts = profile.rts;
    this.savePreferences();
    this.notifyState();
  }

  /** Save a connection profile to localStorage. */
  saveProfile(profile: ConnectionProfile): void {
    const profiles = this.loadProfiles();
    const existingIndex = profiles.findIndex((p) => p.name === profile.name);
    if (existingIndex >= 0) {
      profiles[existingIndex] = profile;
    } else {
      profiles.push(profile);
    }
    this.persistProfiles(profiles);
    this.notifyState();
  }

  /** Delete a connection profile from localStorage. */
  deleteProfile(name: string): boolean {
    const profiles = this.loadProfiles();
    const filtered = profiles.filter((p) => p.name !== name);
    if (filtered.length === profiles.length) {
      return false;
    }
    this.persistProfiles(filtered);
    this.notifyState();
    return true;
  }

  /** Load all saved connection profiles. */
  loadProfiles(): ConnectionProfile[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PROFILES);
      if (!raw) {
        return [];
      }
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter(isValidProfile);
    } catch {
      return [];
    }
  }

  /** Export profiles as JSON string. */
  exportProfiles(): string {
    return JSON.stringify(this.loadProfiles(), null, 2);
  }

  /** Import profiles from JSON string. Returns count of imported profiles. */
  importProfiles(json: string): number {
    try {
      const parsed: unknown = JSON.parse(json);
      if (!Array.isArray(parsed)) {
        return 0;
      }
      const valid = parsed.filter(isValidProfile);
      if (valid.length === 0) {
        return 0;
      }
      const existing = this.loadProfiles();
      for (const profile of valid) {
        const idx = existing.findIndex((p) => p.name === profile.name);
        if (idx >= 0) {
          existing[idx] = profile;
        } else {
          existing.push(profile);
        }
      }
      this.persistProfiles(existing);
      return valid.length;
    } catch {
      return 0;
    }
  }

  // -----------------------------------------------------------------------
  // Subscription (event-based)
  // -----------------------------------------------------------------------

  /** Subscribe to serial events (data, state changes, errors). */
  on(callback: (event: WebSerialEvent) => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /** Subscribe to state changes (for React re-renders). */
  subscribe(callback: () => void): () => void {
    this.stateSubscribers.add(callback);
    return () => {
      this.stateSubscribers.delete(callback);
    };
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  /** Full cleanup: close port, clear timers, remove listeners. */
  destroy(): void {
    this.cancelReconnect();
    this._autoReconnect = false;
    this._readLoopActive = false;
    this._readAbortController?.abort();
    this.releaseWriter();
    this.releaseReader();
    if (this._port) {
      try {
        // Best-effort close — may already be closed
        void this._port.close().catch(() => {});
      } catch {
        // Ignore
      }
    }
    this._port = null;
    this.subscribers.clear();
    this.stateSubscribers.clear();
  }

  // -----------------------------------------------------------------------
  // Private: connection internals
  // -----------------------------------------------------------------------

  private async closePort(): Promise<void> {
    this._readLoopActive = false;
    this._readAbortController?.abort();

    this.releaseWriter();
    this.releaseReader();

    if (this._port) {
      try {
        await this._port.close();
      } catch {
        // Port may already be closed
      }
    }

    this._rxBuffer = '';
  }

  private releaseReader(): void {
    if (this._reader) {
      try {
        this._reader.releaseLock();
      } catch {
        // Ignore
      }
      this._reader = null;
    }
  }

  private releaseWriter(): void {
    if (this._writer) {
      try {
        this._writer.releaseLock();
      } catch {
        // Ignore
      }
      this._writer = null;
    }
  }

  // -----------------------------------------------------------------------
  // Private: read loop
  // -----------------------------------------------------------------------

  private startReadLoop(): void {
    if (!this._port?.readable) {
      return;
    }

    this._readLoopActive = true;
    this._readAbortController = new AbortController();

    void this.readLoop();
  }

  private async readLoop(): Promise<void> {
    while (this._readLoopActive && this._port?.readable) {
      try {
        this._reader = this._port.readable.getReader();

        while (this._readLoopActive) {
          const { value, done } = await this._reader.read();

          if (done) {
            this.releaseReader();
            break;
          }

          if (value) {
            this.processIncomingData(value);
          }
        }

        this.releaseReader();
      } catch (err) {
        this.releaseReader();

        if (!this._readLoopActive) {
          break;
        }

        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('break') || message.includes('framing') || message.includes('parity')) {
          // Line errors — log but continue
          this.addMonitorLine('rx', `[Error: ${message}]`);
          this.notifyState();
          continue;
        }

        // Fatal error — device disconnected
        await this.handleDisconnection();
        break;
      }
    }
  }

  private processIncomingData(data: Uint8Array): void {
    this._bytesReceived += data.length;

    if (this._dataMode === 'binary') {
      const hexStr = this.formatBinaryData(data);
      this.addMonitorLine('rx', hexStr);
      this.emitEvent({ type: 'data', data });
    } else {
      const text = new TextDecoder().decode(data);
      this._rxBuffer += text;

      // Split on line boundaries
      const lines = this._rxBuffer.split(/\r\n|\r|\n/);

      // If the buffer ends with a newline, the last split element is empty
      // meaning all lines are complete. Otherwise, keep the last partial line.
      if (this._rxBuffer.endsWith('\n') || this._rxBuffer.endsWith('\r')) {
        this._rxBuffer = '';
        // Filter out trailing empty string from split
        const completeLines = lines.filter((l) => l.length > 0);
        for (const line of completeLines) {
          this.addMonitorLine('rx', line);
        }
      } else {
        // Last element is an incomplete line — keep in buffer
        this._rxBuffer = lines.pop() ?? '';
        for (const line of lines) {
          if (line.length > 0) {
            this.addMonitorLine('rx', line);
          }
        }
      }

      this.emitEvent({ type: 'data', data: text });
    }

    this.notifyState();
  }

  // -----------------------------------------------------------------------
  // Private: auto-reconnection
  // -----------------------------------------------------------------------

  private async handleDisconnection(): Promise<void> {
    await this.closePort();
    this.setConnectionState('error');
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (!this._autoReconnect || !this._port || this._reconnectTimer !== null) {
      return;
    }

    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * Math.pow(RECONNECT_BACKOFF_MULTIPLIER, this._reconnectAttempt),
      RECONNECT_MAX_DELAY_MS,
    );

    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._reconnectAttempt++;
      void this.attemptReconnect();
    }, delay);
  }

  private async attemptReconnect(): Promise<void> {
    if (this._connectionState === 'connected' || !this._port) {
      return;
    }

    if (this._connectionOptions) {
      await this.connect(this._connectionOptions);
    } else {
      await this.connect({ baudRate: this._baudRate });
    }
  }

  private cancelReconnect(): void {
    if (this._reconnectTimer !== null) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this._reconnectAttempt = 0;
  }

  /** Compute the delay in ms for the current reconnect attempt. Exposed for testing. */
  getReconnectDelay(): number {
    return Math.min(
      RECONNECT_BASE_DELAY_MS * Math.pow(RECONNECT_BACKOFF_MULTIPLIER, this._reconnectAttempt),
      RECONNECT_MAX_DELAY_MS,
    );
  }

  /** Get the current reconnect attempt number. Exposed for testing. */
  get reconnectAttempt(): number {
    return this._reconnectAttempt;
  }

  // -----------------------------------------------------------------------
  // Private: monitor buffer
  // -----------------------------------------------------------------------

  private addMonitorLine(direction: 'rx' | 'tx', data: string): void {
    this._monitor.push({
      timestamp: Date.now(),
      direction,
      data,
    });
    this.trimMonitor();
  }

  private trimMonitor(): void {
    if (this._monitor.length > this._maxMonitorLines) {
      this._monitor = this._monitor.slice(-this._maxMonitorLines);
    }
  }

  // -----------------------------------------------------------------------
  // Private: state management
  // -----------------------------------------------------------------------

  private setConnectionState(state: ConnectionState): void {
    if (this._connectionState === state) {
      return;
    }
    this._connectionState = state;
    if (state !== 'error') {
      this._error = null;
    }
    this.emitEvent({ type: 'state_change', state });
    this.notifyState();
  }

  private setError(message: string): void {
    this._error = message;
    this.emitEvent({ type: 'error', error: message });
    this.notifyState();
  }

  // -----------------------------------------------------------------------
  // Private: notification
  // -----------------------------------------------------------------------

  private emitEvent(event: WebSerialEvent): void {
    this.subscribers.forEach((cb) => {
      cb(event);
    });
  }

  private notifyState(): void {
    this.stateSubscribers.forEach((cb) => {
      cb();
    });
  }

  // -----------------------------------------------------------------------
  // Private: helpers
  // -----------------------------------------------------------------------

  private extractPortInfo(port: SerialPort): SerialPortInfo {
    try {
      const info = port.getInfo();
      return {
        usbVendorId: info.usbVendorId,
        usbProductId: info.usbProductId,
      };
    } catch {
      return {};
    }
  }

  private formatBinaryData(data: Uint8Array): string {
    return Array.from(data)
      .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
  }

  // -----------------------------------------------------------------------
  // Private: localStorage persistence
  // -----------------------------------------------------------------------

  private savePreferences(): void {
    try {
      const prefs = {
        baudRate: this._baudRate,
        lineEnding: this._lineEnding,
        dataMode: this._dataMode,
        dtr: this._dtr,
        rts: this._rts,
      };
      localStorage.setItem(STORAGE_KEY_PREFERENCES, JSON.stringify(prefs));
    } catch {
      // localStorage may be unavailable
    }
  }

  private loadPreferences(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PREFERENCES);
      if (!raw) {
        return;
      }
      const prefs: unknown = JSON.parse(raw);
      if (typeof prefs !== 'object' || prefs === null) {
        return;
      }
      const obj = prefs as Record<string, unknown>;

      if (typeof obj.baudRate === 'number' && COMMON_BAUD_RATES.includes(obj.baudRate)) {
        this._baudRate = obj.baudRate;
      }
      if (typeof obj.lineEnding === 'string' && isValidLineEnding(obj.lineEnding)) {
        this._lineEnding = obj.lineEnding;
      }
      if (typeof obj.dataMode === 'string' && (obj.dataMode === 'text' || obj.dataMode === 'binary')) {
        this._dataMode = obj.dataMode;
      }
      if (typeof obj.dtr === 'boolean') {
        this._dtr = obj.dtr;
      }
      if (typeof obj.rts === 'boolean') {
        this._rts = obj.rts;
      }
    } catch {
      // Ignore corrupted localStorage
    }
  }

  private persistProfiles(profiles: ConnectionProfile[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(profiles));
    } catch {
      // localStorage may be unavailable
    }
  }
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function isValidLineEnding(value: string): value is LineEnding {
  return value === 'none' || value === 'cr' || value === 'lf' || value === 'crlf';
}

function isValidProfile(value: unknown): value is ConnectionProfile {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.name === 'string' &&
    obj.name.length > 0 &&
    typeof obj.baudRate === 'number' &&
    obj.baudRate > 0 &&
    typeof obj.lineEnding === 'string' &&
    isValidLineEnding(obj.lineEnding)
  );
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * React hook for Web Serial communication.
 * Subscribes to the WebSerialManager singleton and re-renders on state changes.
 *
 * Usage:
 *   const { state, connect, disconnect, send, requestPort } = useWebSerial();
 */
export function useWebSerial(options?: UseWebSerialOptions): {
  state: WebSerialState;
  requestPort: (filters?: SerialPortFilter[]) => Promise<boolean>;
  connect: (opts?: Partial<ConnectionOptions>) => Promise<boolean>;
  disconnect: () => Promise<void>;
  send: (data: string | Uint8Array) => Promise<boolean>;
  setSignals: (signals: { dtr?: boolean; rts?: boolean }) => Promise<boolean>;
  resetBoard: () => Promise<boolean>;
  setBaudRate: (baudRate: number) => void;
  setLineEnding: (lineEnding: LineEnding) => void;
  setDataMode: (dataMode: DataMode) => void;
  clearMonitor: () => void;
  profiles: ConnectionProfile[];
  saveProfile: (profile: ConnectionProfile) => void;
  deleteProfile: (name: string) => boolean;
  applyProfile: (profile: ConnectionProfile) => void;
  isSupported: boolean;
} {
  const [, setTick] = useState(0);

  // Event callbacks
  useEffect(() => {
    const manager = WebSerialManager.getInstance();
    const unsubscribe = manager.on((event) => {
      if (event.type === 'data' && typeof event.data === 'string' && options?.onData) {
        options.onData(event.data);
      }
      if (event.type === 'state_change' && event.state && options?.onStateChange) {
        options.onStateChange(event.state);
      }
      if (event.type === 'error' && event.error && options?.onError) {
        options.onError(event.error);
      }
    });
    return unsubscribe;
  }, [options?.onData, options?.onStateChange, options?.onError]);

  // State subscription for re-renders
  useEffect(() => {
    const manager = WebSerialManager.getInstance();
    const unsubscribe = manager.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const manager = WebSerialManager.getInstance();

  const requestPort = useCallback(async (filters?: SerialPortFilter[]) => {
    return WebSerialManager.getInstance().requestPort(filters);
  }, []);

  const connect = useCallback(async (opts?: Partial<ConnectionOptions>) => {
    return WebSerialManager.getInstance().connect(opts);
  }, []);

  const disconnect = useCallback(async () => {
    return WebSerialManager.getInstance().disconnect();
  }, []);

  const send = useCallback(async (data: string | Uint8Array) => {
    return WebSerialManager.getInstance().send(data);
  }, []);

  const setSignals = useCallback(async (signals: { dtr?: boolean; rts?: boolean }) => {
    return WebSerialManager.getInstance().setSignals(signals);
  }, []);

  const resetBoard = useCallback(async () => {
    return WebSerialManager.getInstance().resetBoard();
  }, []);

  const setBaudRate = useCallback((baudRate: number) => {
    WebSerialManager.getInstance().setBaudRate(baudRate);
  }, []);

  const setLineEnding = useCallback((lineEnding: LineEnding) => {
    WebSerialManager.getInstance().setLineEnding(lineEnding);
  }, []);

  const setDataMode = useCallback((dataMode: DataMode) => {
    WebSerialManager.getInstance().setDataMode(dataMode);
  }, []);

  const clearMonitor = useCallback(() => {
    WebSerialManager.getInstance().clearMonitor();
  }, []);

  const saveProfile = useCallback((profile: ConnectionProfile) => {
    WebSerialManager.getInstance().saveProfile(profile);
  }, []);

  const deleteProfile = useCallback((name: string) => {
    return WebSerialManager.getInstance().deleteProfile(name);
  }, []);

  const applyProfile = useCallback((profile: ConnectionProfile) => {
    WebSerialManager.getInstance().applyProfile(profile);
  }, []);

  return {
    state: manager.getState(),
    requestPort,
    connect,
    disconnect,
    send,
    setSignals,
    resetBoard,
    setBaudRate,
    setLineEnding,
    setDataMode,
    clearMonitor,
    profiles: manager.loadProfiles(),
    saveProfile,
    deleteProfile,
    applyProfile,
    isSupported: WebSerialManager.isSupported(),
  };
}
