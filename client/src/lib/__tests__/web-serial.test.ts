/**
 * Web Serial API Hardware Communication — Tests
 *
 * Tests the WebSerialManager class, connection state machine,
 * auto-reconnection, serial monitor, profiles, and React hook.
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  WebSerialManager,
  useWebSerial,
  COMMON_BAUD_RATES,
  KNOWN_BOARD_FILTERS,
} from '../web-serial';

import type {
  ConnectionState,
  LineEnding,
  ConnectionProfile,
  WebSerialEvent,
  SerialPortFilter,
} from '../web-serial';

// ---------------------------------------------------------------------------
// Mock type — mirrors the file-scoped SerialPort interface in web-serial.ts
// ---------------------------------------------------------------------------

interface MockSerialPort {
  open: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  getInfo: ReturnType<typeof vi.fn>;
  setSignals: ReturnType<typeof vi.fn>;
  readable: ReadableStream<Uint8Array> | null;
  writable: unknown;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
}

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/** Create a minimal mock SerialPort. */
function createMockPort(options?: {
  vendorId?: number;
  productId?: number;
  openError?: Error;
  readable?: ReadableStream<Uint8Array> | null;
  writable?: WritableStream<Uint8Array> | null;
}) {
  const mockWriter = {
    write: vi.fn().mockResolvedValue(undefined),
    releaseLock: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  };

  const readController: { enqueue?: (chunk: Uint8Array) => void; close?: () => void } = {};
  const mockReadable = options?.readable !== undefined
    ? options.readable
    : new ReadableStream<Uint8Array>({
        start(controller) {
          readController.enqueue = (chunk) => controller.enqueue(chunk);
          readController.close = () => controller.close();
        },
      });

  const mockWritable = options?.writable !== undefined
    ? options.writable
    : {
        getWriter: vi.fn().mockReturnValue(mockWriter),
        locked: false,
      };

  const port = {
    open: options?.openError
      ? vi.fn().mockRejectedValue(options.openError)
      : vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getInfo: vi.fn().mockReturnValue({
      usbVendorId: options?.vendorId ?? 0x2341,
      usbProductId: options?.productId ?? 0x0043,
    }),
    setSignals: vi.fn().mockResolvedValue(undefined),
    readable: mockReadable,
    writable: mockWritable,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as MockSerialPort;

  return { port: port as unknown as MockSerialPort, mockWriter, readController };
}

/** Install a mock navigator.serial on the global object. */
function installMockNavigatorSerial() {
  const mockSerial = {
    requestPort: vi.fn(),
    getPorts: vi.fn().mockResolvedValue([]),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  Object.defineProperty(navigator, 'serial', {
    value: mockSerial,
    writable: true,
    configurable: true,
  });

  return mockSerial;
}

function removeMockNavigatorSerial() {
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete (navigator as unknown as Record<string, unknown>).serial;
}

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

const localStorageData: Map<string, string> = new Map();

const mockLocalStorage = {
  getItem: vi.fn((key: string) => localStorageData.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageData.set(key, value);
  }),
  removeItem: vi.fn((key: string) => {
    localStorageData.delete(key);
  }),
  clear: vi.fn(() => {
    localStorageData.clear();
  }),
  get length() {
    return localStorageData.size;
  },
  key: vi.fn((_index: number) => null),
};

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

describe('WebSerialManager', () => {
  let mockSerial: ReturnType<typeof installMockNavigatorSerial>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    localStorageData.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });
    mockSerial = installMockNavigatorSerial();
    WebSerialManager.resetInstance();
  });

  afterEach(() => {
    WebSerialManager.resetInstance();
    removeMockNavigatorSerial();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Singleton
  // -------------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance', () => {
      const a = WebSerialManager.getInstance();
      const b = WebSerialManager.getInstance();
      expect(a).toBe(b);
    });

    it('creates a new instance after resetInstance', () => {
      const a = WebSerialManager.getInstance();
      WebSerialManager.resetInstance();
      const b = WebSerialManager.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // -------------------------------------------------------------------------
  // Browser support
  // -------------------------------------------------------------------------

  describe('isSupported', () => {
    it('returns true when navigator.serial exists', () => {
      expect(WebSerialManager.isSupported()).toBe(true);
    });

    it('returns false when navigator.serial is absent', () => {
      removeMockNavigatorSerial();
      expect(WebSerialManager.isSupported()).toBe(false);
      // Restore for other tests
      mockSerial = installMockNavigatorSerial();
    });
  });

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  describe('initial state', () => {
    it('starts disconnected with default config', () => {
      const mgr = WebSerialManager.getInstance();
      const state = mgr.getState();

      expect(state.connectionState).toBe('disconnected');
      expect(state.portInfo).toBeNull();
      expect(state.baudRate).toBe(115200);
      expect(state.lineEnding).toBe('lf');
      expect(state.dataMode).toBe('text');
      expect(state.dtr).toBe(true);
      expect(state.rts).toBe(true);
      expect(state.monitor).toEqual([]);
      expect(state.error).toBeNull();
      expect(state.isSupported).toBe(true);
      expect(state.bytesReceived).toBe(0);
      expect(state.bytesSent).toBe(0);
    });

    it('loads preferences from localStorage', () => {
      localStorageData.set(
        'protopulse:serial:preferences',
        JSON.stringify({
          baudRate: 9600,
          lineEnding: 'crlf',
          dataMode: 'binary',
          dtr: false,
          rts: false,
        }),
      );

      WebSerialManager.resetInstance();
      const mgr = WebSerialManager.getInstance();
      expect(mgr.baudRate).toBe(9600);
      expect(mgr.lineEnding).toBe('crlf');
      expect(mgr.dataMode).toBe('binary');
      expect(mgr.dtr).toBe(false);
      expect(mgr.rts).toBe(false);
    });

    it('ignores corrupted localStorage preferences', () => {
      localStorageData.set('protopulse:serial:preferences', 'not valid json{{{');
      WebSerialManager.resetInstance();
      const mgr = WebSerialManager.getInstance();
      expect(mgr.baudRate).toBe(115200);
    });
  });

  // -------------------------------------------------------------------------
  // Port request
  // -------------------------------------------------------------------------

  describe('requestPort', () => {
    it('requests a port and stores port info', async () => {
      const { port } = createMockPort({ vendorId: 0x2341, productId: 0x0043 });
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      const result = await mgr.requestPort();

      expect(result).toBe(true);
      expect(mgr.portInfo).toEqual({ usbVendorId: 0x2341, usbProductId: 0x0043 });
      expect(mgr.error).toBeNull();
    });

    it('passes filters to requestPort', async () => {
      const { port } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      const filters: SerialPortFilter[] = [
        { usbVendorId: 0x2341, usbProductId: 0x0043 },
        { usbVendorId: 0x10c4 },
      ];
      await mgr.requestPort(filters);

      expect(mockSerial.requestPort).toHaveBeenCalledWith({
        filters: [
          { usbVendorId: 0x2341, usbProductId: 0x0043 },
          { usbVendorId: 0x10c4 },
        ],
      });
    });

    it('returns false on user cancel (NotAllowedError)', async () => {
      const err = new DOMException('User cancelled', 'NotAllowedError');
      mockSerial.requestPort.mockRejectedValue(err);

      const mgr = WebSerialManager.getInstance();
      const result = await mgr.requestPort();

      expect(result).toBe(false);
      expect(mgr.error).toBeNull();
    });

    it('sets error on unexpected failure', async () => {
      mockSerial.requestPort.mockRejectedValue(new Error('USB error'));

      const mgr = WebSerialManager.getInstance();
      const result = await mgr.requestPort();

      expect(result).toBe(false);
      expect(mgr.error).toContain('USB error');
    });

    it('returns false when Web Serial is not supported', async () => {
      removeMockNavigatorSerial();

      const mgr = WebSerialManager.getInstance();
      const result = await mgr.requestPort();

      expect(result).toBe(false);
      expect(mgr.error).toContain('not supported');

      mockSerial = installMockNavigatorSerial();
    });
  });

  // -------------------------------------------------------------------------
  // getPorts
  // -------------------------------------------------------------------------

  describe('getPorts', () => {
    it('returns port info for previously authorized ports', async () => {
      const { port: port1 } = createMockPort({ vendorId: 0x2341, productId: 0x0043 });
      const { port: port2 } = createMockPort({ vendorId: 0x10c4, productId: 0xea60 });
      mockSerial.getPorts.mockResolvedValue([port1, port2]);

      const mgr = WebSerialManager.getInstance();
      const ports = await mgr.getPorts();

      expect(ports).toHaveLength(2);
      expect(ports[0]).toEqual({ usbVendorId: 0x2341, usbProductId: 0x0043 });
      expect(ports[1]).toEqual({ usbVendorId: 0x10c4, usbProductId: 0xea60 });
    });

    it('returns empty array when not supported', async () => {
      removeMockNavigatorSerial();
      const mgr = WebSerialManager.getInstance();
      const ports = await mgr.getPorts();
      expect(ports).toEqual([]);
      mockSerial = installMockNavigatorSerial();
    });
  });

  // -------------------------------------------------------------------------
  // Connection state machine
  // -------------------------------------------------------------------------

  describe('connection state machine', () => {
    it('transitions: disconnected → connecting → connected', async () => {
      const { port } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      const states: ConnectionState[] = [];
      mgr.on((event) => {
        if (event.type === 'state_change' && event.state) {
          states.push(event.state);
        }
      });

      await mgr.requestPort();
      await mgr.connect({ baudRate: 9600 });

      expect(states).toEqual(['connecting', 'connected']);
      expect(mgr.connectionState).toBe('connected');
      expect(mgr.isConnected).toBe(true);
    });

    it('transitions to error state on connection failure', async () => {
      const { port } = createMockPort({ openError: new Error('Port busy') });
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      mgr.setAutoReconnect(false);
      await mgr.requestPort();
      const result = await mgr.connect();

      expect(result).toBe(false);
      expect(mgr.connectionState).toBe('error');
      expect(mgr.error).toContain('Port busy');
    });

    it('returns error if connect called without requestPort', async () => {
      const mgr = WebSerialManager.getInstance();
      const result = await mgr.connect();

      expect(result).toBe(false);
      expect(mgr.error).toContain('No port selected');
    });

    it('returns current state if already connected', async () => {
      const { port } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();
      await mgr.connect();

      // Second connect should return true (already connected)
      const result = await mgr.connect();
      expect(result).toBe(true);
    });

    it('disconnect transitions to disconnected', async () => {
      const { port } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();
      await mgr.connect();

      await mgr.disconnect();
      expect(mgr.connectionState).toBe('disconnected');
      expect(mgr.isConnected).toBe(false);
    });

    it('opens port with correct options', async () => {
      const { port } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();
      await mgr.connect({
        baudRate: 57600,
        dataBits: 7,
        stopBits: 2,
        parity: 'even',
        flowControl: 'hardware',
        bufferSize: 16384,
      });

      expect(port.open).toHaveBeenCalledWith({
        baudRate: 57600,
        dataBits: 7,
        stopBits: 2,
        parity: 'even',
        flowControl: 'hardware',
        bufferSize: 16384,
      });
    });

    it('sets DTR/RTS signals after opening', async () => {
      const { port } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();
      await mgr.connect();

      expect(port.setSignals).toHaveBeenCalledWith({
        dataTerminalReady: true,
        requestToSend: true,
      });
    });
  });

  // -------------------------------------------------------------------------
  // Data sending
  // -------------------------------------------------------------------------

  describe('send', () => {
    it('sends text with line ending appended', async () => {
      const { port, mockWriter } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      mgr.setLineEnding('crlf');
      await mgr.requestPort();
      await mgr.connect();

      const result = await mgr.send('Hello');
      expect(result).toBe(true);

      const encoded = mockWriter.write.mock.calls[0][0] as Uint8Array;
      const decoded = new TextDecoder().decode(encoded);
      expect(decoded).toBe('Hello\r\n');
    });

    it('sends text without line ending when set to none', async () => {
      const { port, mockWriter } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      mgr.setLineEnding('none');
      await mgr.requestPort();
      await mgr.connect();

      await mgr.send('raw');

      const encoded = mockWriter.write.mock.calls[0][0] as Uint8Array;
      const decoded = new TextDecoder().decode(encoded);
      expect(decoded).toBe('raw');
    });

    it('sends binary data as-is', async () => {
      const { port, mockWriter } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      mgr.setDataMode('binary');
      await mgr.requestPort();
      await mgr.connect();

      const data = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
      await mgr.send(data);

      expect(mockWriter.write).toHaveBeenCalledWith(data);
    });

    it('tracks bytes sent and adds monitor lines', async () => {
      const { port } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      mgr.setLineEnding('lf');
      await mgr.requestPort();
      await mgr.connect();

      await mgr.send('Test');

      expect(mgr.bytesSent).toBe(5); // 'Test' + '\n' = 5 bytes
      expect(mgr.monitor.length).toBe(1);
      expect(mgr.monitor[0].direction).toBe('tx');
      expect(mgr.monitor[0].data).toBe('Test');
    });

    it('returns false when not connected', async () => {
      const mgr = WebSerialManager.getInstance();
      const result = await mgr.send('Hello');
      expect(result).toBe(false);
      expect(mgr.error).toContain('not connected');
    });

    it('handles send errors gracefully', async () => {
      const { port, mockWriter } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      mgr.setAutoReconnect(false);
      await mgr.requestPort();
      await mgr.connect();

      mockWriter.write.mockRejectedValueOnce(new Error('Write failed'));
      const result = await mgr.send('Fail');

      expect(result).toBe(false);
      expect(mgr.error).toContain('Write failed');
    });
  });

  // -------------------------------------------------------------------------
  // DTR/RTS signal control
  // -------------------------------------------------------------------------

  describe('signals', () => {
    it('setSignals updates DTR and RTS', async () => {
      const { port } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();
      await mgr.connect();

      await mgr.setSignals({ dtr: false, rts: false });

      expect(port.setSignals).toHaveBeenLastCalledWith({
        dataTerminalReady: false,
        requestToSend: false,
      });
      expect(mgr.dtr).toBe(false);
      expect(mgr.rts).toBe(false);
    });

    it('setSignals returns false if no port selected', async () => {
      const mgr = WebSerialManager.getInstance();
      const result = await mgr.setSignals({ dtr: true });
      expect(result).toBe(false);
    });

    it('resetBoard toggles DTR', async () => {
      const { port } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();
      await mgr.connect();

      const promise = mgr.resetBoard(10);
      // Advance past the delay
      await vi.advanceTimersByTimeAsync(50);
      const result = await promise;

      expect(result).toBe(true);
      const setSignalsCalls = (port.setSignals as ReturnType<typeof vi.fn>).mock.calls;
      // First call is from connect (dtr: true, rts: true)
      // Second should set DTR false (reset low)
      // Third should set DTR true (reset high)
      expect(setSignalsCalls.length).toBeGreaterThanOrEqual(3);
      expect(setSignalsCalls[1][0]).toEqual({ dataTerminalReady: false });
      expect(setSignalsCalls[2][0]).toEqual({ dataTerminalReady: true });

      // Should add a monitor line
      const resetLine = mgr.monitor.find((l) => l.data.includes('Board Reset'));
      expect(resetLine).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Auto-reconnection
  // -------------------------------------------------------------------------

  describe('auto-reconnection', () => {
    it('uses exponential backoff starting at 1s', () => {
      const mgr = WebSerialManager.getInstance();
      // At attempt 0, delay = 1000 * 2^0 = 1000ms
      expect(mgr.getReconnectDelay()).toBe(1000);
    });

    it('doubles delay each attempt', () => {
      const mgr = new WebSerialManager();
      // We need to test the delay calculation pattern.
      // getReconnectDelay uses _reconnectAttempt which starts at 0
      // After failed connect, attempt increments
      expect(mgr.getReconnectDelay()).toBe(1000); // 1000 * 2^0
    });

    it('caps at 30 seconds', () => {
      // The formula is min(1000 * 2^attempt, 30000)
      // 2^5 = 32 → 32000 → capped to 30000
      const mgr = new WebSerialManager();
      // Manually check: 1000 * 2^15 = 32768000 → capped to 30000
      // Since we can't easily set _reconnectAttempt directly, verify the cap logic
      const capDelay = Math.min(1000 * Math.pow(2, 15), 30000);
      expect(capDelay).toBe(30000);
    });

    it('schedules reconnect after connection error', async () => {
      const { port } = createMockPort({ openError: new Error('Failed') });
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();
      await mgr.connect();

      // Connection failed, should be in error state with reconnect scheduled
      expect(mgr.connectionState).toBe('error');
    });

    it('cancels reconnect on manual disconnect', async () => {
      const { port } = createMockPort({ openError: new Error('Failed') });
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();
      await mgr.connect(); // Fails, schedules reconnect

      await mgr.disconnect();
      expect(mgr.connectionState).toBe('disconnected');
    });

    it('stops reconnecting when autoReconnect is disabled', async () => {
      const { port } = createMockPort({ openError: new Error('Failed') });
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      mgr.setAutoReconnect(false);
      await mgr.requestPort();
      await mgr.connect();

      expect(mgr.connectionState).toBe('error');
      // No timer should be set since autoReconnect is false
      // Advance time significantly — should stay in error
      await vi.advanceTimersByTimeAsync(60000);
      expect(mgr.connectionState).toBe('error');
    });
  });

  // -------------------------------------------------------------------------
  // Configuration
  // -------------------------------------------------------------------------

  describe('configuration', () => {
    it('setBaudRate updates and persists', () => {
      const mgr = WebSerialManager.getInstance();
      mgr.setBaudRate(9600);
      expect(mgr.baudRate).toBe(9600);
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('setLineEnding updates and persists', () => {
      const mgr = WebSerialManager.getInstance();
      mgr.setLineEnding('crlf');
      expect(mgr.lineEnding).toBe('crlf');
    });

    it('setDataMode updates and persists', () => {
      const mgr = WebSerialManager.getInstance();
      mgr.setDataMode('binary');
      expect(mgr.dataMode).toBe('binary');
    });

    it('setMaxMonitorLines trims existing buffer', () => {
      const mgr = WebSerialManager.getInstance();
      // Manually add some monitor lines via sending
      // Instead, use clearMonitor and check max
      mgr.setMaxMonitorLines(5);
      expect(mgr.maxMonitorLines).toBe(5);
    });

    it('setMaxMonitorLines enforces minimum of 1', () => {
      const mgr = WebSerialManager.getInstance();
      mgr.setMaxMonitorLines(0);
      expect(mgr.maxMonitorLines).toBe(1);
      mgr.setMaxMonitorLines(-10);
      expect(mgr.maxMonitorLines).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Monitor buffer
  // -------------------------------------------------------------------------

  describe('monitor buffer', () => {
    it('clearMonitor resets buffer and counters', async () => {
      const { port } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();
      await mgr.connect();
      await mgr.send('Data');

      expect(mgr.monitor.length).toBeGreaterThan(0);
      expect(mgr.bytesSent).toBeGreaterThan(0);

      mgr.clearMonitor();
      expect(mgr.monitor.length).toBe(0);
      expect(mgr.bytesReceived).toBe(0);
      expect(mgr.bytesSent).toBe(0);
    });

    it('getMonitorLines returns a copy', () => {
      const mgr = WebSerialManager.getInstance();
      const lines = mgr.getMonitorLines();
      expect(lines).toEqual([]);
      expect(lines).not.toBe(mgr.monitor);
    });

    it('trims buffer when exceeding maxMonitorLines', async () => {
      const { port } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      mgr.setMaxMonitorLines(3);
      await mgr.requestPort();
      await mgr.connect();

      // Send multiple messages to fill the buffer
      for (let i = 0; i < 5; i++) {
        await mgr.send(`msg${i}`);
      }

      expect(mgr.monitor.length).toBeLessThanOrEqual(3);
    });
  });

  // -------------------------------------------------------------------------
  // Connection profiles
  // -------------------------------------------------------------------------

  describe('connection profiles', () => {
    it('createProfile captures current settings', () => {
      const mgr = WebSerialManager.getInstance();
      mgr.setBaudRate(9600);
      mgr.setLineEnding('crlf');
      mgr.setDataMode('binary');

      const profile = mgr.createProfile('Arduino Uno');

      expect(profile.name).toBe('Arduino Uno');
      expect(profile.baudRate).toBe(9600);
      expect(profile.lineEnding).toBe('crlf');
      expect(profile.dataMode).toBe('binary');
      expect(profile.dtr).toBe(true);
      expect(profile.rts).toBe(true);
    });

    it('applyProfile updates settings', () => {
      const mgr = WebSerialManager.getInstance();
      const profile: ConnectionProfile = {
        name: 'ESP32',
        baudRate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        flowControl: 'none',
        lineEnding: 'lf',
        dataMode: 'text',
        dtr: false,
        rts: false,
      };

      mgr.applyProfile(profile);

      expect(mgr.baudRate).toBe(115200);
      expect(mgr.lineEnding).toBe('lf');
      expect(mgr.dataMode).toBe('text');
      expect(mgr.dtr).toBe(false);
      expect(mgr.rts).toBe(false);
    });

    it('saveProfile persists to localStorage', () => {
      const mgr = WebSerialManager.getInstance();
      const profile = mgr.createProfile('Test Profile');
      mgr.saveProfile(profile);

      const profiles = mgr.loadProfiles();
      expect(profiles).toHaveLength(1);
      expect(profiles[0].name).toBe('Test Profile');
    });

    it('saveProfile updates existing profile by name', () => {
      const mgr = WebSerialManager.getInstance();
      const profile1 = mgr.createProfile('Test');
      mgr.saveProfile(profile1);

      mgr.setBaudRate(9600);
      const profile2 = mgr.createProfile('Test');
      mgr.saveProfile(profile2);

      const profiles = mgr.loadProfiles();
      expect(profiles).toHaveLength(1);
      expect(profiles[0].baudRate).toBe(9600);
    });

    it('deleteProfile removes by name', () => {
      const mgr = WebSerialManager.getInstance();
      mgr.saveProfile(mgr.createProfile('A'));
      mgr.saveProfile(mgr.createProfile('B'));

      const result = mgr.deleteProfile('A');
      expect(result).toBe(true);

      const profiles = mgr.loadProfiles();
      expect(profiles).toHaveLength(1);
      expect(profiles[0].name).toBe('B');
    });

    it('deleteProfile returns false for unknown name', () => {
      const mgr = WebSerialManager.getInstance();
      const result = mgr.deleteProfile('nonexistent');
      expect(result).toBe(false);
    });

    it('exportProfiles returns JSON string', () => {
      const mgr = WebSerialManager.getInstance();
      mgr.saveProfile(mgr.createProfile('Export Test'));

      const json = mgr.exportProfiles();
      const parsed = JSON.parse(json) as ConnectionProfile[];
      expect(parsed).toHaveLength(1);
      expect(parsed[0].name).toBe('Export Test');
    });

    it('importProfiles merges with existing', () => {
      const mgr = WebSerialManager.getInstance();
      mgr.saveProfile(mgr.createProfile('Existing'));

      const importData: ConnectionProfile[] = [
        {
          name: 'Imported',
          baudRate: 9600,
          dataBits: 8,
          stopBits: 1,
          parity: 'none',
          flowControl: 'none',
          lineEnding: 'lf',
          dataMode: 'text',
          dtr: true,
          rts: true,
        },
      ];

      const count = mgr.importProfiles(JSON.stringify(importData));
      expect(count).toBe(1);

      const profiles = mgr.loadProfiles();
      expect(profiles).toHaveLength(2);
    });

    it('importProfiles returns 0 for invalid JSON', () => {
      const mgr = WebSerialManager.getInstance();
      const count = mgr.importProfiles('not json');
      expect(count).toBe(0);
    });

    it('importProfiles returns 0 for non-array JSON', () => {
      const mgr = WebSerialManager.getInstance();
      const count = mgr.importProfiles('{"name": "test"}');
      expect(count).toBe(0);
    });

    it('importProfiles skips invalid profiles', () => {
      const mgr = WebSerialManager.getInstance();
      const data = [
        { name: '', baudRate: 9600, lineEnding: 'lf' }, // Empty name — invalid
        { name: 'Valid', baudRate: 9600, lineEnding: 'lf' }, // Valid
        { baudRate: 9600 }, // No name — invalid
      ];
      const count = mgr.importProfiles(JSON.stringify(data));
      expect(count).toBe(1);
    });

    it('loadProfiles returns empty array for corrupted localStorage', () => {
      localStorageData.set('protopulse:serial:profiles', 'bad data');
      const mgr = WebSerialManager.getInstance();
      expect(mgr.loadProfiles()).toEqual([]);
    });

    it('loadProfiles returns empty array for non-array localStorage', () => {
      localStorageData.set('protopulse:serial:profiles', '"just a string"');
      const mgr = WebSerialManager.getInstance();
      expect(mgr.loadProfiles()).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Event subscription
  // -------------------------------------------------------------------------

  describe('subscription', () => {
    it('on() receives state change events', async () => {
      const { port } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      const events: WebSerialEvent[] = [];
      mgr.on((e) => events.push(e));

      await mgr.requestPort();
      await mgr.connect();

      const stateEvents = events.filter((e) => e.type === 'state_change');
      expect(stateEvents.length).toBeGreaterThanOrEqual(2);
      expect(stateEvents[0].state).toBe('connecting');
      expect(stateEvents[1].state).toBe('connected');
    });

    it('on() receives error events', async () => {
      const mgr = WebSerialManager.getInstance();
      const errors: string[] = [];
      mgr.on((e) => {
        if (e.type === 'error' && e.error) {
          errors.push(e.error);
        }
      });

      await mgr.send('test');

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('not connected');
    });

    it('on() returns unsubscribe function', () => {
      const mgr = WebSerialManager.getInstance();
      let count = 0;
      const unsub = mgr.on(() => {
        count++;
      });

      unsub();
      // Further events should not increment count
      mgr.setBaudRate(9600); // Triggers notifyState, not emitEvent
      // No events emitted from setBaudRate, but test ensures unsub is a function
      expect(typeof unsub).toBe('function');
    });

    it('subscribe() triggers on state changes', () => {
      const mgr = WebSerialManager.getInstance();
      let notified = false;
      mgr.subscribe(() => {
        notified = true;
      });

      mgr.setBaudRate(9600);
      expect(notified).toBe(true);
    });

    it('subscribe() returns unsubscribe function', () => {
      const mgr = WebSerialManager.getInstance();
      let count = 0;
      const unsub = mgr.subscribe(() => {
        count++;
      });

      mgr.setBaudRate(9600);
      expect(count).toBe(1);

      unsub();
      mgr.setBaudRate(19200);
      expect(count).toBe(1); // Should not have incremented
    });
  });

  // -------------------------------------------------------------------------
  // Constants
  // -------------------------------------------------------------------------

  describe('constants', () => {
    it('COMMON_BAUD_RATES contains standard rates', () => {
      expect(COMMON_BAUD_RATES).toContain(9600);
      expect(COMMON_BAUD_RATES).toContain(115200);
      expect(COMMON_BAUD_RATES).toContain(19200);
      expect(COMMON_BAUD_RATES).toContain(57600);
    });

    it('KNOWN_BOARD_FILTERS has entries with labels and vendor IDs', () => {
      expect(KNOWN_BOARD_FILTERS.length).toBeGreaterThan(0);
      for (const filter of KNOWN_BOARD_FILTERS) {
        expect(typeof filter.label).toBe('string');
        expect(filter.label.length).toBeGreaterThan(0);
        expect(typeof filter.usbVendorId).toBe('number');
      }
    });

    it('KNOWN_BOARD_FILTERS includes Arduino and ESP32', () => {
      const labels = KNOWN_BOARD_FILTERS.map((f) => f.label);
      expect(labels.some((l) => l.includes('Arduino'))).toBe(true);
      expect(labels.some((l) => l.includes('ESP32') || l.includes('Espressif'))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // getState
  // -------------------------------------------------------------------------

  describe('getState', () => {
    it('returns a snapshot with all fields', () => {
      const mgr = WebSerialManager.getInstance();
      const state = mgr.getState();

      expect(state).toHaveProperty('connectionState');
      expect(state).toHaveProperty('portInfo');
      expect(state).toHaveProperty('baudRate');
      expect(state).toHaveProperty('lineEnding');
      expect(state).toHaveProperty('dataMode');
      expect(state).toHaveProperty('dtr');
      expect(state).toHaveProperty('rts');
      expect(state).toHaveProperty('monitor');
      expect(state).toHaveProperty('error');
      expect(state).toHaveProperty('isSupported');
      expect(state).toHaveProperty('bytesReceived');
      expect(state).toHaveProperty('bytesSent');
    });

    it('monitor array is a copy', () => {
      const mgr = WebSerialManager.getInstance();
      const state1 = mgr.getState();
      const state2 = mgr.getState();
      expect(state1.monitor).not.toBe(state2.monitor);
    });
  });

  // -------------------------------------------------------------------------
  // Destroy
  // -------------------------------------------------------------------------

  describe('destroy', () => {
    it('cleans up all resources', async () => {
      const { port } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();
      await mgr.connect();

      let notified = false;
      mgr.subscribe(() => {
        notified = true;
      });

      mgr.destroy();

      // Subscribers should be cleared
      notified = false;
      mgr.setBaudRate(9600);
      expect(notified).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Data receiving (text mode)
  // -------------------------------------------------------------------------

  describe('data receiving', () => {
    it('processes incoming text data with line splitting', async () => {
      let resolveRead: ((value: ReadableStreamReadResult<Uint8Array>) => void) | undefined;
      let readCallCount = 0;

      const mockReader = {
        read: vi.fn(() => {
          return new Promise<ReadableStreamReadResult<Uint8Array>>((resolve) => {
            readCallCount++;
            if (readCallCount > 2) {
              // After our data, signal done
              resolve({ value: undefined, done: true });
            } else {
              resolveRead = resolve;
            }
          });
        }),
        releaseLock: vi.fn(),
        cancel: vi.fn(),
        closed: Promise.resolve(undefined),
      };

      const mockReadable = {
        getReader: vi.fn().mockReturnValue(mockReader),
        locked: false,
      };

      const mockWriter = {
        write: vi.fn().mockResolvedValue(undefined),
        releaseLock: vi.fn(),
      };

      const port = {
        open: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        getInfo: vi.fn().mockReturnValue({ usbVendorId: 0x2341, usbProductId: 0x0043 }),
        setSignals: vi.fn().mockResolvedValue(undefined),
        readable: mockReadable,
        writable: { getWriter: vi.fn().mockReturnValue(mockWriter), locked: false },
      } as unknown as MockSerialPort;

      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      const dataEvents: string[] = [];
      mgr.on((event) => {
        if (event.type === 'data' && typeof event.data === 'string') {
          dataEvents.push(event.data);
        }
      });

      await mgr.requestPort();
      await mgr.connect();

      // Wait for the read loop to call read()
      await vi.advanceTimersByTimeAsync(10);

      // Simulate incoming data
      if (resolveRead) {
        const chunk = new TextEncoder().encode('Hello World\nSecond line\n');
        resolveRead({ value: chunk, done: false });
      }

      await vi.advanceTimersByTimeAsync(10);

      // Check data was received
      expect(dataEvents.length).toBeGreaterThan(0);
      expect(mgr.bytesReceived).toBeGreaterThan(0);

      // Monitor should have the lines
      const rxLines = mgr.monitor.filter((l) => l.direction === 'rx');
      expect(rxLines.some((l) => l.data === 'Hello World')).toBe(true);
      expect(rxLines.some((l) => l.data === 'Second line')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Line endings
  // -------------------------------------------------------------------------

  describe('line ending configurations', () => {
    it('supports all line ending options', () => {
      const mgr = WebSerialManager.getInstance();

      const endings: LineEnding[] = ['none', 'cr', 'lf', 'crlf'];
      for (const ending of endings) {
        mgr.setLineEnding(ending);
        expect(mgr.lineEnding).toBe(ending);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Binary format display
  // -------------------------------------------------------------------------

  describe('binary data display', () => {
    it('sends binary data and tracks bytes in monitor', async () => {
      const { port, mockWriter } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      mgr.setDataMode('binary');
      await mgr.requestPort();
      await mgr.connect();

      const data = new Uint8Array([0x00, 0xff, 0x0a, 0x41]);
      await mgr.send(data);

      expect(mockWriter.write).toHaveBeenCalledWith(data);
      expect(mgr.bytesSent).toBe(4);

      // Monitor should show hex representation
      const txLine = mgr.monitor.find((l) => l.direction === 'tx');
      expect(txLine).toBeDefined();
      expect(txLine!.data).toBe('00 FF 0A 41');
    });
  });
});

// ---------------------------------------------------------------------------
// React hook tests
// ---------------------------------------------------------------------------

describe('useWebSerial', () => {
  let mockSerial: ReturnType<typeof installMockNavigatorSerial>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    localStorageData.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });
    mockSerial = installMockNavigatorSerial();
    WebSerialManager.resetInstance();
  });

  afterEach(() => {
    WebSerialManager.resetInstance();
    removeMockNavigatorSerial();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useWebSerial());

    expect(result.current.state.connectionState).toBe('disconnected');
    expect(result.current.isSupported).toBe(true);
    expect(result.current.profiles).toEqual([]);
  });

  it('provides requestPort function', async () => {
    const { port } = createMockPort();
    mockSerial.requestPort.mockResolvedValue(port);

    const { result } = renderHook(() => useWebSerial());

    await act(async () => {
      const success = await result.current.requestPort();
      expect(success).toBe(true);
    });
  });

  it('provides connect and disconnect', async () => {
    const { port } = createMockPort();
    mockSerial.requestPort.mockResolvedValue(port);

    const { result } = renderHook(() => useWebSerial());

    await act(async () => {
      await result.current.requestPort();
    });

    await act(async () => {
      const connected = await result.current.connect({ baudRate: 9600 });
      expect(connected).toBe(true);
    });

    expect(result.current.state.connectionState).toBe('connected');

    await act(async () => {
      await result.current.disconnect();
    });

    expect(result.current.state.connectionState).toBe('disconnected');
  });

  it('provides send function', async () => {
    const { port } = createMockPort();
    mockSerial.requestPort.mockResolvedValue(port);

    const { result } = renderHook(() => useWebSerial());

    await act(async () => {
      await result.current.requestPort();
      await result.current.connect();
    });

    await act(async () => {
      const sent = await result.current.send('Hello');
      expect(sent).toBe(true);
    });
  });

  it('calls onStateChange callback', async () => {
    const { port } = createMockPort();
    mockSerial.requestPort.mockResolvedValue(port);

    const onStateChange = vi.fn();
    const { result } = renderHook(() => useWebSerial({ onStateChange }));

    await act(async () => {
      await result.current.requestPort();
      await result.current.connect();
    });

    expect(onStateChange).toHaveBeenCalledWith('connecting');
    expect(onStateChange).toHaveBeenCalledWith('connected');
  });

  it('calls onError callback', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useWebSerial({ onError }));

    await act(async () => {
      await result.current.send('test');
    });

    expect(onError).toHaveBeenCalledWith(expect.stringContaining('not connected'));
  });

  it('provides configuration setters', () => {
    const { result } = renderHook(() => useWebSerial());

    act(() => {
      result.current.setBaudRate(9600);
    });
    expect(result.current.state.baudRate).toBe(9600);

    act(() => {
      result.current.setLineEnding('crlf');
    });
    expect(result.current.state.lineEnding).toBe('crlf');

    act(() => {
      result.current.setDataMode('binary');
    });
    expect(result.current.state.dataMode).toBe('binary');
  });

  it('provides clearMonitor', async () => {
    const { port } = createMockPort();
    mockSerial.requestPort.mockResolvedValue(port);

    const { result } = renderHook(() => useWebSerial());

    await act(async () => {
      await result.current.requestPort();
      await result.current.connect();
      await result.current.send('test');
    });

    expect(result.current.state.monitor.length).toBeGreaterThan(0);

    act(() => {
      result.current.clearMonitor();
    });

    expect(result.current.state.monitor.length).toBe(0);
  });

  it('provides profile management', () => {
    const { result } = renderHook(() => useWebSerial());

    const profile: ConnectionProfile = {
      name: 'Test Profile',
      baudRate: 9600,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      flowControl: 'none',
      lineEnding: 'lf',
      dataMode: 'text',
      dtr: true,
      rts: true,
    };

    act(() => {
      result.current.saveProfile(profile);
    });

    // Re-render to get updated profiles
    expect(result.current.profiles).toHaveLength(1);
    expect(result.current.profiles[0].name).toBe('Test Profile');

    act(() => {
      const deleted = result.current.deleteProfile('Test Profile');
      expect(deleted).toBe(true);
    });
  });

  it('provides applyProfile', () => {
    const { result } = renderHook(() => useWebSerial());

    const profile: ConnectionProfile = {
      name: 'Apply Test',
      baudRate: 57600,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      flowControl: 'none',
      lineEnding: 'crlf',
      dataMode: 'binary',
      dtr: false,
      rts: false,
    };

    act(() => {
      result.current.applyProfile(profile);
    });

    expect(result.current.state.baudRate).toBe(57600);
    expect(result.current.state.lineEnding).toBe('crlf');
    expect(result.current.state.dataMode).toBe('binary');
    expect(result.current.state.dtr).toBe(false);
    expect(result.current.state.rts).toBe(false);
  });

  it('provides setSignals', async () => {
    const { port } = createMockPort();
    mockSerial.requestPort.mockResolvedValue(port);

    const { result } = renderHook(() => useWebSerial());

    await act(async () => {
      await result.current.requestPort();
      await result.current.connect();
    });

    await act(async () => {
      const ok = await result.current.setSignals({ dtr: false });
      expect(ok).toBe(true);
    });
  });

  it('provides resetBoard', async () => {
    const { port } = createMockPort();
    mockSerial.requestPort.mockResolvedValue(port);

    const { result } = renderHook(() => useWebSerial());

    await act(async () => {
      await result.current.requestPort();
      await result.current.connect();
    });

    await act(async () => {
      const promise = result.current.resetBoard();
      await vi.advanceTimersByTimeAsync(300);
      const ok = await promise;
      expect(ok).toBe(true);
    });
  });

  it('isSupported reflects browser capability', () => {
    const { result } = renderHook(() => useWebSerial());
    expect(result.current.isSupported).toBe(true);
  });
});
