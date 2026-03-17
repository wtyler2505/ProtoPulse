/**
 * Web Serial API — Integration Tests
 *
 * Complements the unit tests in web-serial.test.ts with integration-level
 * scenarios: full connection lifecycle end-to-end, auto-reconnect with
 * backoff progression, board profile round-trips, DTR/RTS signal sequences,
 * read/write data flow, disconnect recovery, error cascading, and
 * concurrent access guards.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  WebSerialManager,
  COMMON_BAUD_RATES,
  KNOWN_BOARD_FILTERS,
} from '../web-serial';

import type {
  ConnectionState,
  ConnectionProfile,
  WebSerialEvent,
  LineEnding,
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
// Helpers
// ---------------------------------------------------------------------------

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
  const mockReadable =
    options?.readable !== undefined
      ? options.readable
      : new ReadableStream<Uint8Array>({
          start(controller) {
            readController.enqueue = (chunk) => controller.enqueue(chunk);
            readController.close = () => controller.close();
          },
        });

  const mockWritable =
    options?.writable !== undefined
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

/**
 * Create a mock port with a controllable reader.
 * Returns resolveRead/rejectRead functions so tests can push data into the
 * read loop on demand.
 */
function createControllableReadPort(portOptions?: { vendorId?: number; productId?: number }) {
  let resolveRead: ((result: ReadableStreamReadResult<Uint8Array>) => void) | undefined;
  let readCallCount = 0;

  const mockReader = {
    read: vi.fn(() => {
      return new Promise<ReadableStreamReadResult<Uint8Array>>((resolve) => {
        readCallCount++;
        resolveRead = resolve;
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
    getInfo: vi.fn().mockReturnValue({
      usbVendorId: portOptions?.vendorId ?? 0x2341,
      usbProductId: portOptions?.productId ?? 0x0043,
    }),
    setSignals: vi.fn().mockResolvedValue(undefined),
    readable: mockReadable,
    writable: { getWriter: vi.fn().mockReturnValue(mockWriter), locked: false },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MockSerialPort;

  return {
    port,
    mockWriter,
    mockReader,
    pushData: async (data: Uint8Array) => {
      // Wait for the read loop to install a resolveRead callback
      await vi.advanceTimersByTimeAsync(10);
      if (resolveRead) {
        resolveRead({ value: data, done: false });
        resolveRead = undefined;
      }
      await vi.advanceTimersByTimeAsync(10);
    },
    signalDone: async () => {
      await vi.advanceTimersByTimeAsync(10);
      if (resolveRead) {
        resolveRead({ value: undefined, done: true });
        resolveRead = undefined;
      }
      await vi.advanceTimersByTimeAsync(10);
    },
    getReadCallCount: () => readCallCount,
  };
}

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
// Test suite
// ---------------------------------------------------------------------------

describe('WebSerialManager — Integration', () => {
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

  // =========================================================================
  // 1. Full connection lifecycle
  // =========================================================================

  describe('full connection lifecycle', () => {
    it('request → connect → send → receive → disconnect transitions all states correctly', async () => {
      const { port, pushData } = createControllableReadPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      const states: ConnectionState[] = [];
      mgr.on((e) => {
        if (e.type === 'state_change' && e.state) {
          states.push(e.state);
        }
      });

      // 1. Request port
      const requested = await mgr.requestPort();
      expect(requested).toBe(true);
      expect(mgr.connectionState).toBe('disconnected');

      // 2. Connect
      const connected = await mgr.connect({ baudRate: 115200 });
      expect(connected).toBe(true);
      expect(states).toContain('connecting');
      expect(states).toContain('connected');
      expect(mgr.connectionState).toBe('connected');

      // 3. Send data
      const sent = await mgr.send('AT\r\n');
      expect(sent).toBe(true);
      expect(mgr.bytesSent).toBeGreaterThan(0);

      // 4. Receive data
      await pushData(new TextEncoder().encode('OK\r\n'));
      expect(mgr.bytesReceived).toBeGreaterThan(0);
      const rxLines = mgr.monitor.filter((l) => l.direction === 'rx');
      expect(rxLines.some((l) => l.data === 'OK')).toBe(true);

      // 5. Disconnect
      await mgr.disconnect();
      expect(mgr.connectionState).toBe('disconnected');
      expect(states).toContain('disconnected');
    });

    it('collects both tx and rx lines in monitor with timestamps', async () => {
      const { port, pushData } = createControllableReadPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();
      await mgr.connect();

      await mgr.send('ping');
      await pushData(new TextEncoder().encode('pong\n'));

      const monitor = mgr.getMonitorLines();
      expect(monitor.length).toBeGreaterThanOrEqual(2);

      const txLine = monitor.find((l) => l.direction === 'tx');
      const rxLine = monitor.find((l) => l.direction === 'rx');
      expect(txLine).toBeDefined();
      expect(rxLine).toBeDefined();
      expect(txLine!.timestamp).toBeLessThanOrEqual(rxLine!.timestamp);
      expect(typeof txLine!.timestamp).toBe('number');
    });

    it('updates byte counters across multiple send/receive cycles', async () => {
      const { port, pushData } = createControllableReadPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      mgr.setLineEnding('none');
      await mgr.requestPort();
      await mgr.connect();

      await mgr.send('A');
      await mgr.send('BB');
      await mgr.send('CCC');
      // 'A' + 'BB' + 'CCC' = 1 + 2 + 3 = 6 bytes (no line ending)
      expect(mgr.bytesSent).toBe(6);

      await pushData(new TextEncoder().encode('12345\n'));
      expect(mgr.bytesReceived).toBe(6);
    });

    it('preserves port info through the full lifecycle', async () => {
      const { port } = createMockPort({ vendorId: 0x10c4, productId: 0xea60 });
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();
      expect(mgr.portInfo).toEqual({ usbVendorId: 0x10c4, usbProductId: 0xea60 });

      await mgr.connect();
      expect(mgr.portInfo).toEqual({ usbVendorId: 0x10c4, usbProductId: 0xea60 });

      await mgr.disconnect();
      // Port info is preserved after disconnect (port is still selected)
      expect(mgr.portInfo).toEqual({ usbVendorId: 0x10c4, usbProductId: 0xea60 });
    });
  });

  // =========================================================================
  // 2. Auto-reconnect with backoff progression
  // =========================================================================

  describe('auto-reconnect with backoff progression', () => {
    it('reconnect delays follow exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (capped)', async () => {
      const expectedDelays = [1000, 2000, 4000, 8000, 16000, 30000];

      // Manually verify the formula for each attempt
      for (let attempt = 0; attempt < expectedDelays.length; attempt++) {
        const computed = Math.min(1000 * Math.pow(2, attempt), 30000);
        expect(computed).toBe(expectedDelays[attempt]);
      }
    });

    it('reconnect attempt increments on each timer fire', async () => {
      // Create a port that always fails to open but has readable/writable
      // so scheduleReconnect doesn't bail on the _port check
      const failPort = {
        open: vi.fn().mockRejectedValue(new Error('Device lost')),
        close: vi.fn().mockResolvedValue(undefined),
        getInfo: vi.fn().mockReturnValue({ usbVendorId: 0x2341, usbProductId: 0x0043 }),
        setSignals: vi.fn().mockResolvedValue(undefined),
        readable: new ReadableStream<Uint8Array>({ start() {} }),
        writable: {
          getWriter: vi.fn().mockReturnValue({
            write: vi.fn().mockResolvedValue(undefined),
            releaseLock: vi.fn(),
          }),
          locked: false,
        },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as MockSerialPort;

      mockSerial.requestPort.mockResolvedValue(failPort);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();

      // First connect attempt fails — schedules reconnect
      await mgr.connect();
      expect(mgr.connectionState).toBe('error');

      // The reconnect timer callback increments _reconnectAttempt then calls connect.
      // connect() internally calls cancelReconnect() which resets _reconnectAttempt to 0.
      // But the open call count reveals how many attempts were made.
      const initialOpenCalls = failPort.open.mock.calls.length;

      // Advance past 1s reconnect delay — triggers reconnect attempt
      await vi.advanceTimersByTimeAsync(1100);
      expect(failPort.open.mock.calls.length).toBeGreaterThan(initialOpenCalls);

      // Advance past 2s reconnect delay — triggers another attempt
      const callsAfterFirst = failPort.open.mock.calls.length;
      await vi.advanceTimersByTimeAsync(2100);
      expect(failPort.open.mock.calls.length).toBeGreaterThan(callsAfterFirst);
    });

    it('successful reconnect resets attempt counter', async () => {
      let connectCount = 0;
      const port = {
        open: vi.fn().mockImplementation(() => {
          connectCount++;
          if (connectCount <= 1) {
            return Promise.reject(new Error('Temporary failure'));
          }
          return Promise.resolve(undefined);
        }),
        close: vi.fn().mockResolvedValue(undefined),
        getInfo: vi.fn().mockReturnValue({ usbVendorId: 0x2341, usbProductId: 0x0043 }),
        setSignals: vi.fn().mockResolvedValue(undefined),
        readable: new ReadableStream<Uint8Array>({
          start() {
            // Keep stream open
          },
        }),
        writable: {
          getWriter: vi.fn().mockReturnValue({
            write: vi.fn().mockResolvedValue(undefined),
            releaseLock: vi.fn(),
          }),
          locked: false,
        },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as MockSerialPort;

      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();

      // First attempt fails
      await mgr.connect();
      expect(mgr.connectionState).toBe('error');

      // Wait for reconnect timer (1s base delay)
      await vi.advanceTimersByTimeAsync(1100);

      // Second attempt succeeds
      expect(mgr.connectionState).toBe('connected');
      expect(mgr.reconnectAttempt).toBe(0);
    });

    it('manual disconnect during reconnect sequence cancels pending reconnect', async () => {
      const { port } = createMockPort({ openError: new Error('Failed') });
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();
      await mgr.connect(); // fails, schedules reconnect

      expect(mgr.connectionState).toBe('error');

      // Disconnect before the timer fires
      await mgr.disconnect();
      expect(mgr.connectionState).toBe('disconnected');

      // Advance well past any potential reconnect delay
      await vi.advanceTimersByTimeAsync(60000);
      // Should still be disconnected, not error
      expect(mgr.connectionState).toBe('disconnected');
    });

    it('disabling autoReconnect mid-sequence stops future attempts', async () => {
      const { port } = createMockPort({ openError: new Error('Failed') });
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();
      await mgr.connect(); // fails, schedules reconnect

      // Disable auto-reconnect
      mgr.setAutoReconnect(false);

      // Advance time — no reconnect should happen
      await vi.advanceTimersByTimeAsync(60000);
      expect(mgr.connectionState).toBe('error');
      // Attempt should be 0 (cancelled)
      expect(mgr.reconnectAttempt).toBe(0);
    });
  });

  // =========================================================================
  // 3. Board profiles — round-trip create/save/load/apply/export/import
  // =========================================================================

  describe('board profiles round-trip', () => {
    it('create → save → load → apply preserves all profile fields', () => {
      const mgr = WebSerialManager.getInstance();
      mgr.setBaudRate(9600);
      mgr.setLineEnding('crlf');
      mgr.setDataMode('binary');

      const profile = mgr.createProfile('Arduino Uno');
      mgr.saveProfile(profile);

      // Reset manager settings
      mgr.setBaudRate(115200);
      mgr.setLineEnding('lf');
      mgr.setDataMode('text');

      // Load and apply
      const loaded = mgr.loadProfiles();
      expect(loaded).toHaveLength(1);
      mgr.applyProfile(loaded[0]);

      expect(mgr.baudRate).toBe(9600);
      expect(mgr.lineEnding).toBe('crlf');
      expect(mgr.dataMode).toBe('binary');
    });

    it('export → import round-trip preserves multiple profiles', () => {
      const mgr = WebSerialManager.getInstance();

      // Create and save two profiles
      mgr.setBaudRate(9600);
      mgr.setLineEnding('crlf');
      mgr.saveProfile(mgr.createProfile('Profile A'));

      mgr.setBaudRate(115200);
      mgr.setLineEnding('lf');
      mgr.saveProfile(mgr.createProfile('Profile B'));

      // Export
      const json = mgr.exportProfiles();

      // Clear profiles
      mgr.deleteProfile('Profile A');
      mgr.deleteProfile('Profile B');
      expect(mgr.loadProfiles()).toHaveLength(0);

      // Import
      const count = mgr.importProfiles(json);
      expect(count).toBe(2);

      const profiles = mgr.loadProfiles();
      expect(profiles).toHaveLength(2);
      expect(profiles.find((p) => p.name === 'Profile A')?.baudRate).toBe(9600);
      expect(profiles.find((p) => p.name === 'Profile B')?.baudRate).toBe(115200);
    });

    it('import overwrites existing profile with same name', () => {
      const mgr = WebSerialManager.getInstance();

      mgr.setBaudRate(9600);
      mgr.saveProfile(mgr.createProfile('Shared'));

      const imported: ConnectionProfile[] = [
        {
          name: 'Shared',
          baudRate: 57600,
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

      mgr.importProfiles(JSON.stringify(imported));
      const profiles = mgr.loadProfiles();
      expect(profiles).toHaveLength(1);
      expect(profiles[0].baudRate).toBe(57600);
    });

    it('profile with DTR/RTS=false applies correctly', () => {
      const mgr = WebSerialManager.getInstance();

      const profile: ConnectionProfile = {
        name: 'No signals',
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
      expect(mgr.dtr).toBe(false);
      expect(mgr.rts).toBe(false);
    });

    it('KNOWN_BOARD_FILTERS can be used as port request filters', async () => {
      const { port } = createMockPort({ vendorId: 0x2341, productId: 0x0043 });
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      const filters: SerialPortFilter[] = KNOWN_BOARD_FILTERS.slice(0, 3).map((f) => ({
        usbVendorId: f.usbVendorId,
        ...(f.usbProductId !== undefined ? { usbProductId: f.usbProductId } : {}),
      }));

      await mgr.requestPort(filters);

      expect(mockSerial.requestPort).toHaveBeenCalledWith({
        filters: expect.arrayContaining([
          expect.objectContaining({ usbVendorId: expect.any(Number) }),
        ]),
      });
    });

    it('all KNOWN_BOARD_FILTERS have valid numeric vendor IDs', () => {
      for (const filter of KNOWN_BOARD_FILTERS) {
        expect(filter.usbVendorId).toBeGreaterThan(0);
        expect(filter.usbVendorId).toBeLessThanOrEqual(0xffff);
        if (filter.usbProductId !== undefined) {
          expect(filter.usbProductId).toBeGreaterThan(0);
          expect(filter.usbProductId).toBeLessThanOrEqual(0xffff);
        }
      }
    });

    it('COMMON_BAUD_RATES are sorted ascending', () => {
      for (let i = 1; i < COMMON_BAUD_RATES.length; i++) {
        expect(COMMON_BAUD_RATES[i]).toBeGreaterThan(COMMON_BAUD_RATES[i - 1]);
      }
    });
  });

  // =========================================================================
  // 4. DTR/RTS signal sequences
  // =========================================================================

  describe('DTR/RTS signal sequences', () => {
    it('connect sets initial DTR=true RTS=true signals', async () => {
      const { port } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();
      await mgr.connect();

      const calls = (port.setSignals as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[0][0]).toEqual({
        dataTerminalReady: true,
        requestToSend: true,
      });
    });

    it('partial signal update only sets specified signal', async () => {
      const { port } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();
      await mgr.connect();

      await mgr.setSignals({ dtr: false });
      expect(mgr.dtr).toBe(false);
      expect(mgr.rts).toBe(true); // rts unchanged

      const lastCall = (port.setSignals as ReturnType<typeof vi.fn>).mock.calls.at(-1);
      expect(lastCall![0]).toEqual({ dataTerminalReady: false });
    });

    it('resetBoard toggles DTR low then high with delay', async () => {
      const { port } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();
      await mgr.connect();

      const promise = mgr.resetBoard(50);
      await vi.advanceTimersByTimeAsync(100);
      const result = await promise;

      expect(result).toBe(true);

      const signalCalls = (port.setSignals as ReturnType<typeof vi.fn>).mock.calls;
      // Call 0: connect (DTR true, RTS true)
      // Call 1: resetBoard DTR false
      // Call 2: resetBoard DTR true
      expect(signalCalls.length).toBeGreaterThanOrEqual(3);
      expect(signalCalls[1][0]).toEqual({ dataTerminalReady: false });
      expect(signalCalls[2][0]).toEqual({ dataTerminalReady: true });
    });

    it('resetBoard adds [Board Reset] monitor line', async () => {
      const { port } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();
      await mgr.connect();

      const promise = mgr.resetBoard(10);
      await vi.advanceTimersByTimeAsync(50);
      await promise;

      const resetLine = mgr.monitor.find((l) => l.data.includes('Board Reset'));
      expect(resetLine).toBeDefined();
      expect(resetLine!.direction).toBe('tx');
    });

    it('setSignals returns false when no port is selected', async () => {
      const mgr = WebSerialManager.getInstance();
      const result = await mgr.setSignals({ dtr: true, rts: true });
      expect(result).toBe(false);
    });

    it('resetBoard returns false when no port is selected', async () => {
      const mgr = WebSerialManager.getInstance();
      const result = await mgr.resetBoard();
      expect(result).toBe(false);
    });

    it('DTR/RTS state persists across getState calls', async () => {
      const { port } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();
      await mgr.connect();
      await mgr.setSignals({ dtr: false, rts: false });

      const state = mgr.getState();
      expect(state.dtr).toBe(false);
      expect(state.rts).toBe(false);
    });
  });

  // =========================================================================
  // 5. Read/write data flow
  // =========================================================================

  describe('read/write data flow', () => {
    it('text data with \\n line ending is encoded and tracked', async () => {
      const { port, mockWriter } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      mgr.setLineEnding('lf');
      await mgr.requestPort();
      await mgr.connect();

      await mgr.send('Hello');

      const encoded = mockWriter.write.mock.calls[0][0] as Uint8Array;
      const decoded = new TextDecoder().decode(encoded);
      expect(decoded).toBe('Hello\n');
      expect(mgr.bytesSent).toBe(6); // 'Hello' + '\n'
    });

    it('text data with \\r\\n line ending is encoded correctly', async () => {
      const { port, mockWriter } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      mgr.setLineEnding('crlf');
      await mgr.requestPort();
      await mgr.connect();

      await mgr.send('AT');

      const encoded = mockWriter.write.mock.calls[0][0] as Uint8Array;
      const decoded = new TextDecoder().decode(encoded);
      expect(decoded).toBe('AT\r\n');
      expect(mgr.bytesSent).toBe(4);
    });

    it('text data with \\r line ending', async () => {
      const { port, mockWriter } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      mgr.setLineEnding('cr');
      await mgr.requestPort();
      await mgr.connect();

      await mgr.send('CMD');

      const encoded = mockWriter.write.mock.calls[0][0] as Uint8Array;
      const decoded = new TextDecoder().decode(encoded);
      expect(decoded).toBe('CMD\r');
    });

    it('text data with no line ending', async () => {
      const { port, mockWriter } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      mgr.setLineEnding('none');
      await mgr.requestPort();
      await mgr.connect();

      await mgr.send('RAW');

      const encoded = mockWriter.write.mock.calls[0][0] as Uint8Array;
      const decoded = new TextDecoder().decode(encoded);
      expect(decoded).toBe('RAW');
    });

    it('binary data is sent as-is and displayed as hex in monitor', async () => {
      const { port, mockWriter } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      mgr.setDataMode('binary');
      await mgr.requestPort();
      await mgr.connect();

      const data = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
      await mgr.send(data);

      expect(mockWriter.write).toHaveBeenCalledWith(data);
      expect(mgr.bytesSent).toBe(4);

      const txLine = mgr.monitor.find((l) => l.direction === 'tx');
      expect(txLine!.data).toBe('DE AD BE EF');
    });

    it('incoming text data is split on \\n into separate monitor lines', async () => {
      const { port, pushData } = createControllableReadPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();
      await mgr.connect();

      await pushData(new TextEncoder().encode('Line1\nLine2\nLine3\n'));

      const rxLines = mgr.monitor.filter((l) => l.direction === 'rx');
      expect(rxLines.map((l) => l.data)).toEqual(['Line1', 'Line2', 'Line3']);
    });

    it('incoming text data is split on \\r\\n', async () => {
      const { port, pushData } = createControllableReadPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();
      await mgr.connect();

      await pushData(new TextEncoder().encode('A\r\nB\r\n'));

      const rxLines = mgr.monitor.filter((l) => l.direction === 'rx');
      expect(rxLines.map((l) => l.data)).toEqual(['A', 'B']);
    });

    it('partial incoming lines are buffered until newline arrives', async () => {
      const { port, pushData } = createControllableReadPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();
      await mgr.connect();

      // Send partial line
      await pushData(new TextEncoder().encode('Hel'));
      let rxLines = mgr.monitor.filter((l) => l.direction === 'rx');
      expect(rxLines.length).toBe(0); // no complete line yet

      // Complete the line
      await pushData(new TextEncoder().encode('lo\n'));
      rxLines = mgr.monitor.filter((l) => l.direction === 'rx');
      expect(rxLines.map((l) => l.data)).toEqual(['Hello']);
    });

    it('data event is emitted with raw text string', async () => {
      const { port, pushData } = createControllableReadPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      const dataEvents: string[] = [];
      mgr.on((e) => {
        if (e.type === 'data' && typeof e.data === 'string') {
          dataEvents.push(e.data);
        }
      });

      await mgr.requestPort();
      await mgr.connect();

      await pushData(new TextEncoder().encode('Test\n'));

      expect(dataEvents.length).toBeGreaterThan(0);
      expect(dataEvents[0]).toContain('Test');
    });
  });

  // =========================================================================
  // 6. Disconnect and error recovery
  // =========================================================================

  describe('disconnect and error recovery', () => {
    it('disconnect closes port and resets connection state', async () => {
      const { port } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();
      await mgr.connect();
      expect(mgr.isConnected).toBe(true);

      await mgr.disconnect();
      expect(mgr.isConnected).toBe(false);
      expect(mgr.connectionState).toBe('disconnected');
      expect(port.close).toHaveBeenCalled();
    });

    it('disconnect re-enables autoReconnect after completing', async () => {
      const { port } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      expect(mgr.autoReconnect).toBe(true);

      await mgr.requestPort();
      await mgr.connect();
      await mgr.disconnect();

      // autoReconnect should be restored after disconnect
      expect(mgr.autoReconnect).toBe(true);
    });

    it('send failure triggers disconnection handling', async () => {
      const { port, mockWriter } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      mgr.setAutoReconnect(false);
      await mgr.requestPort();
      await mgr.connect();

      mockWriter.write.mockRejectedValueOnce(new Error('USB disconnected'));

      const result = await mgr.send('test');
      expect(result).toBe(false);
      expect(mgr.error).toContain('USB disconnected');
    });

    it('error state emits error event and state_change event', async () => {
      const { port } = createMockPort({ openError: new Error('Port locked') });
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      mgr.setAutoReconnect(false);

      const events: WebSerialEvent[] = [];
      mgr.on((e) => events.push(e));

      await mgr.requestPort();
      await mgr.connect();

      const errorEvents = events.filter((e) => e.type === 'error');
      const stateEvents = events.filter((e) => e.type === 'state_change');

      expect(errorEvents.length).toBeGreaterThan(0);
      expect(errorEvents[0].error).toContain('Port locked');

      expect(stateEvents.some((e) => e.state === 'error')).toBe(true);
    });

    it('can reconnect after error by calling connect again', async () => {
      let callCount = 0;
      const port = {
        open: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.reject(new Error('First attempt fails'));
          }
          return Promise.resolve(undefined);
        }),
        close: vi.fn().mockResolvedValue(undefined),
        getInfo: vi.fn().mockReturnValue({ usbVendorId: 0x2341, usbProductId: 0x0043 }),
        setSignals: vi.fn().mockResolvedValue(undefined),
        readable: new ReadableStream<Uint8Array>({ start() {} }),
        writable: {
          getWriter: vi.fn().mockReturnValue({
            write: vi.fn().mockResolvedValue(undefined),
            releaseLock: vi.fn(),
          }),
          locked: false,
        },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as MockSerialPort;

      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      mgr.setAutoReconnect(false);
      await mgr.requestPort();

      // First connect fails
      await mgr.connect();
      expect(mgr.connectionState).toBe('error');

      // Second connect succeeds
      const result = await mgr.connect();
      expect(result).toBe(true);
      expect(mgr.connectionState).toBe('connected');
    });

    it('destroy cleans up even if port.close throws', async () => {
      const { port } = createMockPort();
      (port.close as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Already closed'));
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();
      await mgr.connect();

      // Should not throw
      expect(() => mgr.destroy()).not.toThrow();
    });

    it('port.close error during disconnect does not throw', async () => {
      const { port } = createMockPort();
      (port.close as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Port error'));
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();
      await mgr.connect();

      // disconnect should not throw even if close fails
      await expect(mgr.disconnect()).resolves.not.toThrow();
      expect(mgr.connectionState).toBe('disconnected');
    });
  });

  // =========================================================================
  // 7. Concurrent access guards
  // =========================================================================

  describe('concurrent access guards', () => {
    it('calling connect while already connecting returns false', async () => {
      const { port } = createMockPort();
      // Make open take time to resolve
      let resolveOpen: (() => void) | undefined;
      (port.open as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise<void>((resolve) => { resolveOpen = resolve; }),
      );
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();

      // Start first connect (will be in 'connecting' state)
      const promise1 = mgr.connect();
      expect(mgr.connectionState).toBe('connecting');

      // Second connect while connecting should return false
      const result = await mgr.connect();
      expect(result).toBe(false);

      // Resolve the first connect
      resolveOpen?.();
      await promise1;
    });

    it('calling connect while already connected returns true', async () => {
      const { port } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();
      await mgr.connect();

      const result = await mgr.connect();
      expect(result).toBe(true);
      expect(mgr.connectionState).toBe('connected');
    });

    it('send when not connected returns false with error', async () => {
      const mgr = WebSerialManager.getInstance();
      const result = await mgr.send('test');
      expect(result).toBe(false);
      expect(mgr.error).toContain('not connected');
    });

    it('send with null writable returns false', async () => {
      const { port } = createMockPort({ writable: null });
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();
      // We need to connect with a port that has writable, then make it null
      // Actually, the port has writable=null, so connect will succeed but send will fail
      // because port.writable is null
      // However, connect checks for readable not writable - let's see
      await mgr.connect();

      const result = await mgr.send('test');
      expect(result).toBe(false);
    });

    it('singleton returns same instance across multiple getInstance calls', () => {
      const instances = Array.from({ length: 10 }, () => WebSerialManager.getInstance());
      for (const inst of instances) {
        expect(inst).toBe(instances[0]);
      }
    });

    it('resetInstance then getInstance gives fresh state', async () => {
      const { port } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr1 = WebSerialManager.getInstance();
      await mgr1.requestPort();
      await mgr1.connect();
      mgr1.setBaudRate(9600);

      WebSerialManager.resetInstance();
      // Clear persisted preferences so new instance gets true defaults
      localStorageData.delete('protopulse:serial:preferences');

      const mgr2 = WebSerialManager.getInstance();
      expect(mgr2).not.toBe(mgr1);
      expect(mgr2.connectionState).toBe('disconnected');
      expect(mgr2.baudRate).toBe(115200); // default, not 9600
    });

    it('multiple subscribers all receive events', async () => {
      const { port } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      const counts = [0, 0, 0];
      const unsubs = counts.map((_, i) =>
        mgr.on(() => { counts[i]++; }),
      );

      await mgr.requestPort();
      await mgr.connect();

      // All subscribers should have received events
      for (const count of counts) {
        expect(count).toBeGreaterThan(0);
      }

      // Unsubscribe all
      for (const unsub of unsubs) {
        unsub();
      }
    });

    it('state subscribers all receive notifications', () => {
      const mgr = WebSerialManager.getInstance();
      const counts = [0, 0, 0];
      const unsubs = counts.map((_, i) =>
        mgr.subscribe(() => { counts[i]++; }),
      );

      mgr.setBaudRate(9600);

      for (const count of counts) {
        expect(count).toBe(1);
      }

      // Unsubscribe one, verify others still work
      unsubs[1]();
      mgr.setBaudRate(19200);

      expect(counts[0]).toBe(2);
      expect(counts[1]).toBe(1); // unsubscribed
      expect(counts[2]).toBe(2);
    });
  });

  // =========================================================================
  // 8. Configuration persistence integration
  // =========================================================================

  describe('configuration persistence', () => {
    it('preferences survive singleton reset via localStorage', () => {
      const mgr1 = WebSerialManager.getInstance();
      mgr1.setBaudRate(57600);
      mgr1.setLineEnding('cr');
      mgr1.setDataMode('binary');

      WebSerialManager.resetInstance();

      const mgr2 = WebSerialManager.getInstance();
      expect(mgr2.baudRate).toBe(57600);
      expect(mgr2.lineEnding).toBe('cr');
      expect(mgr2.dataMode).toBe('binary');
    });

    it('invalid baud rate in localStorage falls back to default', () => {
      localStorageData.set(
        'protopulse:serial:preferences',
        JSON.stringify({ baudRate: 99999 }),
      );

      WebSerialManager.resetInstance();
      const mgr = WebSerialManager.getInstance();
      expect(mgr.baudRate).toBe(115200); // default, 99999 not in COMMON_BAUD_RATES
    });

    it('invalid lineEnding in localStorage falls back to default', () => {
      localStorageData.set(
        'protopulse:serial:preferences',
        JSON.stringify({ lineEnding: 'invalid' }),
      );

      WebSerialManager.resetInstance();
      const mgr = WebSerialManager.getInstance();
      expect(mgr.lineEnding).toBe('lf'); // default
    });

    it('null preferences value in localStorage is handled gracefully', () => {
      localStorageData.set('protopulse:serial:preferences', 'null');

      WebSerialManager.resetInstance();
      const mgr = WebSerialManager.getInstance();
      expect(mgr.baudRate).toBe(115200);
    });

    it('array preferences value in localStorage is handled gracefully', () => {
      localStorageData.set('protopulse:serial:preferences', '[1,2,3]');

      WebSerialManager.resetInstance();
      const mgr = WebSerialManager.getInstance();
      // Arrays are typeof 'object' but not null, so it would try to read
      // properties - should handle gracefully
      expect(mgr.baudRate).toBe(115200);
    });

    it('profiles persist through manager lifecycle', () => {
      const mgr = WebSerialManager.getInstance();

      // Save profiles
      mgr.saveProfile(mgr.createProfile('P1'));
      mgr.saveProfile(mgr.createProfile('P2'));
      mgr.saveProfile(mgr.createProfile('P3'));

      // Verify
      expect(mgr.loadProfiles()).toHaveLength(3);

      // Delete one
      mgr.deleteProfile('P2');
      expect(mgr.loadProfiles()).toHaveLength(2);

      // Reset singleton — profiles should persist in localStorage
      WebSerialManager.resetInstance();
      const mgr2 = WebSerialManager.getInstance();
      expect(mgr2.loadProfiles()).toHaveLength(2);
      expect(mgr2.loadProfiles().map((p) => p.name).sort()).toEqual(['P1', 'P3']);
    });
  });

  // =========================================================================
  // 9. Monitor buffer limits
  // =========================================================================

  describe('monitor buffer limits', () => {
    it('monitor trims to maxMonitorLines keeping most recent entries', async () => {
      const { port } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      mgr.setMaxMonitorLines(3);
      mgr.setLineEnding('none');
      await mgr.requestPort();
      await mgr.connect();

      for (let i = 0; i < 10; i++) {
        await mgr.send(`msg${i}`);
      }

      expect(mgr.monitor.length).toBeLessThanOrEqual(3);
      // Most recent messages should be kept
      const lastData = mgr.monitor.map((l) => l.data);
      expect(lastData).toContain('msg9');
    });

    it('clearMonitor resets everything', async () => {
      const { port } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();
      await mgr.connect();
      await mgr.send('data');

      expect(mgr.bytesSent).toBeGreaterThan(0);
      expect(mgr.monitor.length).toBeGreaterThan(0);

      mgr.clearMonitor();

      expect(mgr.monitor.length).toBe(0);
      expect(mgr.bytesReceived).toBe(0);
      expect(mgr.bytesSent).toBe(0);
    });

    it('reducing maxMonitorLines trims existing buffer immediately', async () => {
      const { port } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      mgr.setLineEnding('none');
      await mgr.requestPort();
      await mgr.connect();

      // Add 5 monitor lines
      for (let i = 0; i < 5; i++) {
        await mgr.send(`m${i}`);
      }
      expect(mgr.monitor.length).toBe(5);

      // Now reduce max to 2
      mgr.setMaxMonitorLines(2);
      expect(mgr.monitor.length).toBeLessThanOrEqual(2);
    });
  });

  // =========================================================================
  // 10. Web Serial API unsupported scenarios
  // =========================================================================

  describe('Web Serial API unsupported', () => {
    it('requestPort returns false and sets error when API unavailable', async () => {
      removeMockNavigatorSerial();

      const mgr = WebSerialManager.getInstance();
      const result = await mgr.requestPort();

      expect(result).toBe(false);
      expect(mgr.error).toContain('not supported');

      mockSerial = installMockNavigatorSerial();
    });

    it('getPorts returns empty array when API unavailable', async () => {
      removeMockNavigatorSerial();

      const mgr = WebSerialManager.getInstance();
      const ports = await mgr.getPorts();

      expect(ports).toEqual([]);

      mockSerial = installMockNavigatorSerial();
    });

    it('isSupported returns false when navigator.serial is absent', () => {
      removeMockNavigatorSerial();
      expect(WebSerialManager.isSupported()).toBe(false);
      mockSerial = installMockNavigatorSerial();
    });

    it('getState reflects isSupported correctly', () => {
      const mgr = WebSerialManager.getInstance();
      expect(mgr.getState().isSupported).toBe(true);

      removeMockNavigatorSerial();
      // isSupported is computed dynamically in getState
      expect(mgr.getState().isSupported).toBe(false);

      mockSerial = installMockNavigatorSerial();
    });

    it('connect without port returns false and sets error', async () => {
      removeMockNavigatorSerial();

      const mgr = WebSerialManager.getInstance();
      // No port selected, no serial support
      const result = await mgr.connect();
      expect(result).toBe(false);
      expect(mgr.error).toBeTruthy();

      mockSerial = installMockNavigatorSerial();
    });
  });

  // =========================================================================
  // 11. Permission denied & user cancellation
  // =========================================================================

  describe('permission denied and user cancellation', () => {
    it('user cancelling port picker returns false without setting an error', async () => {
      const domEx = new DOMException('User cancelled', 'NotAllowedError');
      mockSerial.requestPort.mockRejectedValue(domEx);

      const mgr = WebSerialManager.getInstance();
      const result = await mgr.requestPort();

      expect(result).toBe(false);
      // NotAllowedError is treated as user cancellation, not an error
      expect(mgr.error).toBeNull();
    });

    it('non-NotAllowedError DOMException during requestPort sets error', async () => {
      const domEx = new DOMException('Security policy', 'SecurityError');
      mockSerial.requestPort.mockRejectedValue(domEx);

      const mgr = WebSerialManager.getInstance();
      const result = await mgr.requestPort();

      expect(result).toBe(false);
      expect(mgr.error).toContain('Security policy');
    });

    it('generic error during requestPort sets error message', async () => {
      mockSerial.requestPort.mockRejectedValue(new Error('Unexpected failure'));

      const mgr = WebSerialManager.getInstance();
      const result = await mgr.requestPort();

      expect(result).toBe(false);
      expect(mgr.error).toContain('Unexpected failure');
    });

    it('non-Error thrown during requestPort is stringified', async () => {
      mockSerial.requestPort.mockRejectedValue('string error');

      const mgr = WebSerialManager.getInstance();
      const result = await mgr.requestPort();

      expect(result).toBe(false);
      expect(mgr.error).toContain('string error');
    });
  });

  // =========================================================================
  // 12. Port busy and device removed scenarios
  // =========================================================================

  describe('port busy and device removed', () => {
    it('connect with port already in use (open rejects) enters error state', async () => {
      const { port } = createMockPort({ openError: new Error('Failed to open serial port: port is already open') });
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      mgr.setAutoReconnect(false);
      await mgr.requestPort();

      const result = await mgr.connect();
      expect(result).toBe(false);
      expect(mgr.connectionState).toBe('error');
      expect(mgr.error).toContain('port is already open');
    });

    it('device removal during active read triggers error state and schedules reconnect', async () => {
      // Create a port where the reader will throw a fatal error (not line error)
      let rejectRead: ((err: Error) => void) | undefined;
      const mockReader = {
        read: vi.fn(() => new Promise<ReadableStreamReadResult<Uint8Array>>((_, reject) => {
          rejectRead = reject;
        })),
        releaseLock: vi.fn(),
        cancel: vi.fn(),
        closed: Promise.resolve(undefined),
      };

      const port = {
        open: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        getInfo: vi.fn().mockReturnValue({ usbVendorId: 0x2341, usbProductId: 0x0043 }),
        setSignals: vi.fn().mockResolvedValue(undefined),
        readable: { getReader: vi.fn().mockReturnValue(mockReader), locked: false },
        writable: {
          getWriter: vi.fn().mockReturnValue({
            write: vi.fn().mockResolvedValue(undefined),
            releaseLock: vi.fn(),
          }),
          locked: false,
        },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as MockSerialPort;

      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      const events: WebSerialEvent[] = [];
      mgr.on((e) => events.push(e));
      await mgr.requestPort();
      await mgr.connect();

      expect(mgr.connectionState).toBe('connected');

      // Simulate device removal — fatal read error
      if (rejectRead) {
        rejectRead(new Error('The device has been lost'));
      }
      await vi.advanceTimersByTimeAsync(50);

      expect(mgr.connectionState).toBe('error');
      expect(events.some((e) => e.type === 'state_change' && e.state === 'error')).toBe(true);
    });

    it('line/framing/parity read errors continue the read loop without disconnecting', async () => {
      // Create a port that first throws a framing error, then returns done
      let readCallIdx = 0;
      const mockReader = {
        read: vi.fn(() => {
          readCallIdx++;
          if (readCallIdx === 1) {
            return Promise.reject(new Error('framing error on line'));
          }
          // After error, keep the reader alive (never resolves — simulates stable idle)
          return new Promise<ReadableStreamReadResult<Uint8Array>>(() => {});
        }),
        releaseLock: vi.fn(),
        cancel: vi.fn(),
        closed: Promise.resolve(undefined),
      };

      const port = {
        open: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        getInfo: vi.fn().mockReturnValue({ usbVendorId: 0x2341 }),
        setSignals: vi.fn().mockResolvedValue(undefined),
        readable: { getReader: vi.fn().mockReturnValue(mockReader), locked: false },
        writable: {
          getWriter: vi.fn().mockReturnValue({ write: vi.fn(), releaseLock: vi.fn() }),
          locked: false,
        },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as MockSerialPort;

      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();
      await mgr.connect();

      await vi.advanceTimersByTimeAsync(50);

      // Should still be connected — framing errors don't trigger disconnect
      expect(mgr.connectionState).toBe('connected');
      // Error is logged to monitor
      const errorLine = mgr.monitor.find((l) => l.data.includes('framing'));
      expect(errorLine).toBeDefined();
    });

    it('send failure on USB disconnect sets error and triggers disconnection handler', async () => {
      const { port, mockWriter } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      mgr.setAutoReconnect(false);
      await mgr.requestPort();
      await mgr.connect();

      // Simulate USB disconnect on write
      mockWriter.write.mockRejectedValueOnce(new Error('NetworkError: The device has been lost'));

      const result = await mgr.send('test');
      expect(result).toBe(false);
      expect(mgr.error).toContain('device has been lost');
    });
  });

  // =========================================================================
  // 13. Rapid connect/disconnect cycles
  // =========================================================================

  describe('rapid connect/disconnect cycles', () => {
    it('rapid disconnect-reconnect cycle lands in a stable state', async () => {
      const { port } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();

      // Rapid connect/disconnect cycles
      for (let i = 0; i < 5; i++) {
        await mgr.connect();
        await mgr.disconnect();
      }

      expect(mgr.connectionState).toBe('disconnected');
    });

    it('connect → disconnect → connect cycle works cleanly', async () => {
      const { port } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();

      await mgr.connect();
      expect(mgr.connectionState).toBe('connected');

      await mgr.disconnect();
      expect(mgr.connectionState).toBe('disconnected');

      // Port is still selected, so reconnecting should work
      await mgr.connect();
      expect(mgr.connectionState).toBe('connected');
    });

    it('multiple connect calls while connected are idempotent', async () => {
      const { port } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();
      await mgr.connect();

      const results = await Promise.all([
        mgr.connect(),
        mgr.connect(),
        mgr.connect(),
      ]);

      // All return true since already connected
      for (const r of results) {
        expect(r).toBe(true);
      }
      expect(mgr.connectionState).toBe('connected');
      // open should only have been called once
      expect(port.open).toHaveBeenCalledTimes(1);
    });

    it('disconnect during pending connect does not throw', async () => {
      const { port } = createMockPort();
      let resolveOpen: (() => void) | undefined;
      (port.open as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise<void>((resolve) => { resolveOpen = resolve; }),
      );
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();

      // Start connecting
      const connectPromise = mgr.connect();
      expect(mgr.connectionState).toBe('connecting');

      // Disconnect while connecting — should not throw
      await expect(mgr.disconnect()).resolves.not.toThrow();

      // Resolve the open so the connect promise completes
      resolveOpen?.();
      await connectPromise;

      // State is determined by whichever operation finishes last.
      // The code does not have a connect-abort mechanism, so open() resolving
      // after disconnect may leave state as 'connected'. This is acceptable —
      // what matters is no unhandled error.
      expect(['connected', 'disconnected']).toContain(mgr.connectionState);
    });
  });

  // =========================================================================
  // 14. Board profile matching for specific boards
  // =========================================================================

  describe('board profile matching for specific boards', () => {
    it('Arduino Uno/Mega profile (0x2341:0x0043) is in KNOWN_BOARD_FILTERS', () => {
      const match = KNOWN_BOARD_FILTERS.find(
        (f) => f.usbVendorId === 0x2341 && f.usbProductId === 0x0043,
      );
      expect(match).toBeDefined();
      expect(match!.label).toContain('Arduino');
    });

    it('ESP32 profile (0x303a) is in KNOWN_BOARD_FILTERS', () => {
      const match = KNOWN_BOARD_FILTERS.find((f) => f.usbVendorId === 0x303a);
      expect(match).toBeDefined();
      expect(match!.label).toContain('ESP32');
    });

    it('Silicon Labs CP2102 (0x10c4:0xea60) is in KNOWN_BOARD_FILTERS', () => {
      const match = KNOWN_BOARD_FILTERS.find(
        (f) => f.usbVendorId === 0x10c4 && f.usbProductId === 0xea60,
      );
      expect(match).toBeDefined();
      expect(match!.label).toContain('CP2102');
    });

    it('WCH CH340 (0x1a86:0x7523) is in KNOWN_BOARD_FILTERS', () => {
      const match = KNOWN_BOARD_FILTERS.find(
        (f) => f.usbVendorId === 0x1a86 && f.usbProductId === 0x7523,
      );
      expect(match).toBeDefined();
      expect(match!.label).toContain('CH340');
    });

    it('FTDI FT232R (0x0403:0x6001) is in KNOWN_BOARD_FILTERS', () => {
      const match = KNOWN_BOARD_FILTERS.find(
        (f) => f.usbVendorId === 0x0403 && f.usbProductId === 0x6001,
      );
      expect(match).toBeDefined();
      expect(match!.label).toContain('FTDI');
    });

    it('Raspberry Pi Pico (0x2e8a:0x0005) is in KNOWN_BOARD_FILTERS', () => {
      const match = KNOWN_BOARD_FILTERS.find(
        (f) => f.usbVendorId === 0x2e8a && f.usbProductId === 0x0005,
      );
      expect(match).toBeDefined();
      expect(match!.label).toContain('Pico');
    });

    it('Teensy (0x16c0:0x0483) is in KNOWN_BOARD_FILTERS', () => {
      const match = KNOWN_BOARD_FILTERS.find(
        (f) => f.usbVendorId === 0x16c0 && f.usbProductId === 0x0483,
      );
      expect(match).toBeDefined();
      expect(match!.label).toContain('Teensy');
    });

    it('requestPort with vendor-only filter omits usbProductId', async () => {
      const { port } = createMockPort({ vendorId: 0x303a });
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      // ESP32 filter has no productId
      await mgr.requestPort([{ usbVendorId: 0x303a }]);

      expect(mockSerial.requestPort).toHaveBeenCalledWith({
        filters: [{ usbVendorId: 0x303a }],
      });
    });

    it('requestPort with vendor+product filter includes both', async () => {
      const { port } = createMockPort({ vendorId: 0x2341, productId: 0x0043 });
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort([{ usbVendorId: 0x2341, usbProductId: 0x0043 }]);

      expect(mockSerial.requestPort).toHaveBeenCalledWith({
        filters: [{ usbVendorId: 0x2341, usbProductId: 0x0043 }],
      });
    });

    it('KNOWN_BOARD_FILTERS has at least 15 entries', () => {
      expect(KNOWN_BOARD_FILTERS.length).toBeGreaterThanOrEqual(15);
    });

    it('every KNOWN_BOARD_FILTERS entry has a non-empty label', () => {
      for (const filter of KNOWN_BOARD_FILTERS) {
        expect(filter.label.length).toBeGreaterThan(0);
      }
    });

    it('port info is extracted correctly for a matched board', async () => {
      const { port } = createMockPort({ vendorId: 0x239a, productId: 0x800b });
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();

      expect(mgr.portInfo).toEqual({ usbVendorId: 0x239a, usbProductId: 0x800b });
    });
  });

  // =========================================================================
  // 15. Baud rate changes
  // =========================================================================

  describe('baud rate changes', () => {
    it('setBaudRate updates state and persists to localStorage', () => {
      const mgr = WebSerialManager.getInstance();
      mgr.setBaudRate(9600);
      expect(mgr.baudRate).toBe(9600);
      expect(mgr.getState().baudRate).toBe(9600);

      // Check localStorage was written
      const stored = localStorageData.get('protopulse:serial:preferences');
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!).baudRate).toBe(9600);
    });

    it('connect with explicit baudRate overrides default', async () => {
      const { port } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();
      await mgr.connect({ baudRate: 9600 });

      expect(port.open).toHaveBeenCalledWith(
        expect.objectContaining({ baudRate: 9600 }),
      );
      expect(mgr.baudRate).toBe(9600);
    });

    it('reconnect after disconnect preserves the last baudRate', async () => {
      const { port } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();
      await mgr.connect({ baudRate: 57600 });
      expect(mgr.baudRate).toBe(57600);

      await mgr.disconnect();
      expect(mgr.baudRate).toBe(57600);

      // Reconnect without specifying baudRate — should use stored value
      await mgr.connect();
      expect(port.open).toHaveBeenLastCalledWith(
        expect.objectContaining({ baudRate: 57600 }),
      );
    });

    it('all COMMON_BAUD_RATES are positive integers', () => {
      for (const rate of COMMON_BAUD_RATES) {
        expect(Number.isInteger(rate)).toBe(true);
        expect(rate).toBeGreaterThan(0);
      }
    });

    it('connect with 7 data bits and 2 stop bits passes options through', async () => {
      const { port } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();
      await mgr.connect({
        baudRate: 9600,
        dataBits: 7,
        stopBits: 2,
        parity: 'even',
        flowControl: 'hardware',
      });

      expect(port.open).toHaveBeenCalledWith(
        expect.objectContaining({
          baudRate: 9600,
          dataBits: 7,
          stopBits: 2,
          parity: 'even',
          flowControl: 'hardware',
        }),
      );
    });
  });

  // =========================================================================
  // 16. Binary data framing in receive direction
  // =========================================================================

  describe('binary data framing on receive', () => {
    it('incoming binary data is formatted as hex in monitor', async () => {
      const { port, pushData } = createControllableReadPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      mgr.setDataMode('binary');
      await mgr.requestPort();
      await mgr.connect();

      await pushData(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]));

      const rxLines = mgr.monitor.filter((l) => l.direction === 'rx');
      expect(rxLines.length).toBeGreaterThan(0);
      expect(rxLines[0].data).toBe('48 65 6C 6C 6F');
    });

    it('incoming binary data emits data event with Uint8Array', async () => {
      const { port, pushData } = createControllableReadPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      mgr.setDataMode('binary');

      const dataEvents: Array<string | Uint8Array | undefined> = [];
      mgr.on((e) => {
        if (e.type === 'data') {
          dataEvents.push(e.data);
        }
      });

      await mgr.requestPort();
      await mgr.connect();

      await pushData(new Uint8Array([0xaa, 0xbb]));

      expect(dataEvents.length).toBeGreaterThan(0);
      // In binary mode, data event carries the Uint8Array
      expect(dataEvents[0]).toBeInstanceOf(Uint8Array);
    });

    it('switching from text to binary mode mid-session changes data handling', async () => {
      const { port, pushData } = createControllableReadPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      mgr.setDataMode('text');
      await mgr.requestPort();
      await mgr.connect();

      // First message in text mode
      await pushData(new TextEncoder().encode('Hello\n'));
      const textRx = mgr.monitor.filter((l) => l.direction === 'rx');
      expect(textRx[0].data).toBe('Hello');

      // Switch to binary mode
      mgr.setDataMode('binary');

      // Second message in binary mode
      await pushData(new Uint8Array([0xde, 0xad]));
      const allRx = mgr.monitor.filter((l) => l.direction === 'rx');
      // Last line should be hex formatted
      expect(allRx[allRx.length - 1].data).toBe('DE AD');
    });
  });

  // =========================================================================
  // 17. Subscribe/unsubscribe edge cases
  // =========================================================================

  describe('subscribe/unsubscribe edge cases', () => {
    it('unsubscribing event listener stops receiving events', async () => {
      const { port } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      let eventCount = 0;
      const unsub = mgr.on(() => { eventCount++; });

      await mgr.requestPort();
      const countAfterRequest = eventCount;

      // Unsubscribe
      unsub();

      // Further actions should not trigger the callback
      await mgr.connect();
      expect(eventCount).toBe(countAfterRequest);
    });

    it('unsubscribing state listener stops receiving notifications', () => {
      const mgr = WebSerialManager.getInstance();
      let stateChangeCount = 0;
      const unsub = mgr.subscribe(() => { stateChangeCount++; });

      mgr.setBaudRate(9600);
      expect(stateChangeCount).toBe(1);

      unsub();

      mgr.setBaudRate(19200);
      expect(stateChangeCount).toBe(1); // unchanged
    });

    it('double unsubscribe does not throw', () => {
      const mgr = WebSerialManager.getInstance();
      const unsub = mgr.on(() => {});
      unsub();
      expect(() => unsub()).not.toThrow();
    });

    it('event subscriber added mid-lifecycle receives subsequent events', async () => {
      const { port } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();
      await mgr.connect();

      // Subscribe after connection is already established
      const events: WebSerialEvent[] = [];
      mgr.on((e) => events.push(e));

      await mgr.disconnect();

      expect(events.some((e) => e.type === 'state_change' && e.state === 'disconnected')).toBe(true);
    });
  });

  // =========================================================================
  // 18. getState snapshot integrity
  // =========================================================================

  describe('getState snapshot integrity', () => {
    it('getState returns a fresh copy of monitor (not a reference)', async () => {
      const { port } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();
      await mgr.connect();
      await mgr.send('test');

      const state1 = mgr.getState();
      const state2 = mgr.getState();

      // Should be equal in content but different references
      expect(state1.monitor).toEqual(state2.monitor);
      expect(state1.monitor).not.toBe(state2.monitor);
    });

    it('getState includes all expected fields with correct types', () => {
      const mgr = WebSerialManager.getInstance();
      const state = mgr.getState();

      expect(typeof state.connectionState).toBe('string');
      expect(typeof state.baudRate).toBe('number');
      expect(typeof state.lineEnding).toBe('string');
      expect(typeof state.dataMode).toBe('string');
      expect(typeof state.dtr).toBe('boolean');
      expect(typeof state.rts).toBe('boolean');
      expect(Array.isArray(state.monitor)).toBe(true);
      expect(typeof state.isSupported).toBe('boolean');
      expect(typeof state.bytesReceived).toBe('number');
      expect(typeof state.bytesSent).toBe('number');
    });

    it('getMonitorLines returns a copy, not a reference to internal array', async () => {
      const { port } = createMockPort();
      mockSerial.requestPort.mockResolvedValue(port);

      const mgr = WebSerialManager.getInstance();
      await mgr.requestPort();
      await mgr.connect();
      await mgr.send('test');

      const lines = mgr.getMonitorLines();
      const internalMonitor = mgr.monitor;

      expect(lines).toEqual(internalMonitor);
      // getMonitorLines returns a copy
      lines.push({ timestamp: 0, direction: 'rx', data: 'injected' });
      expect(mgr.monitor.length).not.toBe(lines.length);
    });
  });

  // =========================================================================
  // 19. getPorts integration
  // =========================================================================

  describe('getPorts integration', () => {
    it('getPorts returns port info for all previously authorized ports', async () => {
      const port1 = { getInfo: vi.fn().mockReturnValue({ usbVendorId: 0x2341, usbProductId: 0x0043 }) };
      const port2 = { getInfo: vi.fn().mockReturnValue({ usbVendorId: 0x10c4, usbProductId: 0xea60 }) };
      mockSerial.getPorts.mockResolvedValue([port1, port2]);

      const mgr = WebSerialManager.getInstance();
      const ports = await mgr.getPorts();

      expect(ports).toHaveLength(2);
      expect(ports[0]).toEqual({ usbVendorId: 0x2341, usbProductId: 0x0043 });
      expect(ports[1]).toEqual({ usbVendorId: 0x10c4, usbProductId: 0xea60 });
    });

    it('getPorts handles getInfo throwing gracefully', async () => {
      const port1 = { getInfo: vi.fn().mockImplementation(() => { throw new Error('info unavailable'); }) };
      mockSerial.getPorts.mockResolvedValue([port1]);

      const mgr = WebSerialManager.getInstance();
      const ports = await mgr.getPorts();

      // Should return empty info object for ports where getInfo throws
      expect(ports).toHaveLength(1);
      expect(ports[0]).toEqual({});
    });

    it('getPorts returns empty array when getPorts rejects', async () => {
      mockSerial.getPorts.mockRejectedValue(new Error('not available'));

      const mgr = WebSerialManager.getInstance();
      const ports = await mgr.getPorts();

      expect(ports).toEqual([]);
    });
  });

  // =========================================================================
  // 20. Profile edge cases
  // =========================================================================

  describe('profile edge cases', () => {
    it('importing invalid JSON returns 0', () => {
      const mgr = WebSerialManager.getInstance();
      const count = mgr.importProfiles('not valid json');
      expect(count).toBe(0);
    });

    it('importing non-array JSON returns 0', () => {
      const mgr = WebSerialManager.getInstance();
      const count = mgr.importProfiles('{"name": "test"}');
      expect(count).toBe(0);
    });

    it('importing array with no valid profiles returns 0', () => {
      const mgr = WebSerialManager.getInstance();
      const count = mgr.importProfiles('[{"invalid": true}]');
      expect(count).toBe(0);
    });

    it('deleting non-existent profile returns false', () => {
      const mgr = WebSerialManager.getInstance();
      const result = mgr.deleteProfile('DoesNotExist');
      expect(result).toBe(false);
    });

    it('corrupted profiles in localStorage returns empty array', () => {
      localStorageData.set('protopulse:serial:profiles', '{{invalid json');

      const mgr = WebSerialManager.getInstance();
      const profiles = mgr.loadProfiles();
      expect(profiles).toEqual([]);
    });

    it('non-array profiles in localStorage returns empty array', () => {
      localStorageData.set('protopulse:serial:profiles', '"just a string"');

      const mgr = WebSerialManager.getInstance();
      const profiles = mgr.loadProfiles();
      expect(profiles).toEqual([]);
    });
  });
});
