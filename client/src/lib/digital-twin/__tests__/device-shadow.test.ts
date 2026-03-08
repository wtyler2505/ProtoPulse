import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DeviceShadow } from '../device-shadow';
import type { SerialManagerLike } from '../device-shadow';
import type { ProtocolFrame, TelemetryManifest, TelemetryFrame } from '../telemetry-protocol';
import type { WebSerialEvent } from '../../web-serial';

// ---------------------------------------------------------------------------
// Mock serial manager
// ---------------------------------------------------------------------------

function createMockSerial(connected = false): SerialManagerLike & {
  listeners: Set<(event: WebSerialEvent) => void>;
  emit: (event: WebSerialEvent) => void;
} {
  const listeners = new Set<(event: WebSerialEvent) => void>();
  return {
    isConnected: connected,
    on: (cb: (event: WebSerialEvent) => void) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    send: vi.fn().mockResolvedValue(true),
    listeners,
    emit: (event: WebSerialEvent) => {
      for (const cb of Array.from(listeners)) {
        cb(event);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Helper frames
// ---------------------------------------------------------------------------

function makeManifest(channels: Array<{ id: string; name: string }>): TelemetryManifest {
  return {
    type: 'manifest',
    board: 'Arduino Mega 2560',
    firmware: '1.0.0',
    channels: channels.map((ch) => ({ ...ch, dataType: 'analog' as const })),
  };
}

function makeTelemetry(ts: number, ch: Record<string, number | boolean | string>): TelemetryFrame {
  return { type: 'telemetry', ts, ch };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DeviceShadow', () => {
  beforeEach(() => {
    DeviceShadow.resetInstance();
    vi.useFakeTimers();
  });

  afterEach(() => {
    DeviceShadow.resetInstance();
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  it('is a singleton', () => {
    const a = DeviceShadow.getInstance();
    const b = DeviceShadow.getInstance();
    expect(a).toBe(b);
  });

  it('resets singleton', () => {
    const a = DeviceShadow.getInstance();
    DeviceShadow.resetInstance();
    const b = DeviceShadow.getInstance();
    expect(a).not.toBe(b);
  });

  // -----------------------------------------------------------------------
  // Subscribe
  // -----------------------------------------------------------------------

  it('subscribe/unsubscribe works', () => {
    const shadow = DeviceShadow.getInstance();
    const cb = vi.fn();
    const unsub = shadow.subscribe(cb);
    shadow.processFrame(makeTelemetry(100, { A0: 1.0 }));
    expect(cb).toHaveBeenCalled();
    unsub();
    cb.mockClear();
    shadow.processFrame(makeTelemetry(200, { A0: 2.0 }));
    expect(cb).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // processFrame — manifest
  // -----------------------------------------------------------------------

  it('processes manifest frame', () => {
    const shadow = DeviceShadow.getInstance();
    const manifest = makeManifest([{ id: 'A0', name: 'Analog 0' }]);
    shadow.processFrame(manifest);
    const state = shadow.getState();
    expect(state.manifest).not.toBeNull();
    expect(state.manifest!.board).toBe('Arduino Mega 2560');
    expect(state.manifest!.channels).toHaveLength(1);
  });

  it('initializes reported channels from manifest', () => {
    const shadow = DeviceShadow.getInstance();
    shadow.processFrame(makeManifest([
      { id: 'A0', name: 'Analog 0' },
      { id: 'D13', name: 'LED' },
    ]));
    const state = shadow.getState();
    expect(state.reported.size).toBe(2);
    expect(state.reported.get('A0')!.stale).toBe(true); // no telemetry yet
  });

  // -----------------------------------------------------------------------
  // processFrame — telemetry
  // -----------------------------------------------------------------------

  it('updates reported values from telemetry', () => {
    const shadow = DeviceShadow.getInstance();
    shadow.processFrame(makeTelemetry(100, { A0: 3.3, D13: true }));
    const state = shadow.getState();
    expect(state.reported.get('A0')!.value).toBe(3.3);
    expect(state.reported.get('D13')!.value).toBe(true);
  });

  it('updates lastUpdate timestamp', () => {
    const shadow = DeviceShadow.getInstance();
    const now = Date.now();
    shadow.processFrame(makeTelemetry(100, { A0: 1.0 }));
    const state = shadow.getState();
    expect(state.lastUpdate).toBeGreaterThanOrEqual(now);
  });

  it('overwrites previous channel values', () => {
    const shadow = DeviceShadow.getInstance();
    shadow.processFrame(makeTelemetry(100, { A0: 1.0 }));
    shadow.processFrame(makeTelemetry(200, { A0: 2.5 }));
    expect(shadow.getChannelValue('A0')).toBe(2.5);
  });

  it('handles mixed value types', () => {
    const shadow = DeviceShadow.getInstance();
    shadow.processFrame(makeTelemetry(100, { A0: 3.3, D13: false, status: 'running' }));
    expect(shadow.getChannelValue('A0')).toBe(3.3);
    expect(shadow.getChannelValue('D13')).toBe(false);
    expect(shadow.getChannelValue('status')).toBe('running');
  });

  // -----------------------------------------------------------------------
  // processFrame — response
  // -----------------------------------------------------------------------

  it('processes response frame without error', () => {
    const shadow = DeviceShadow.getInstance();
    const frame: ProtocolFrame = { type: 'response', cmd: 'set_D13', ok: true };
    expect(() => shadow.processFrame(frame)).not.toThrow();
  });

  // -----------------------------------------------------------------------
  // Staleness
  // -----------------------------------------------------------------------

  it('marks channels as not stale immediately after telemetry', () => {
    const shadow = DeviceShadow.getInstance();
    shadow.processFrame(makeTelemetry(100, { A0: 3.3 }));
    expect(shadow.isStale('A0')).toBe(false);
  });

  it('marks channels as stale after 2s without update', () => {
    const shadow = DeviceShadow.getInstance();
    shadow.processFrame(makeTelemetry(100, { A0: 3.3 }));
    expect(shadow.isStale('A0')).toBe(false);

    // Advance time by 2.1 seconds
    vi.advanceTimersByTime(2100);
    expect(shadow.isStale('A0')).toBe(true);
  });

  it('returns stale for unknown channel', () => {
    const shadow = DeviceShadow.getInstance();
    expect(shadow.isStale('UNKNOWN')).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Frame rate
  // -----------------------------------------------------------------------

  it('measures frame rate from consecutive telemetry', () => {
    const shadow = DeviceShadow.getInstance();

    // Simulate 10 Hz: frames every 100ms
    for (let i = 0; i < 10; i++) {
      shadow.processFrame(makeTelemetry(i * 100, { A0: i }));
      vi.advanceTimersByTime(100);
    }

    const state = shadow.getState();
    // Should be approximately 10 Hz
    expect(state.frameRate).toBeGreaterThan(8);
    expect(state.frameRate).toBeLessThan(12);
  });

  // -----------------------------------------------------------------------
  // Desired state + delta
  // -----------------------------------------------------------------------

  it('sets desired value', () => {
    const shadow = DeviceShadow.getInstance();
    shadow.setDesired('D13', true);
    const state = shadow.getState();
    expect(state.desired.get('D13')).toBe(true);
  });

  it('computes delta when desired differs from reported', () => {
    const shadow = DeviceShadow.getInstance();
    shadow.processFrame(makeTelemetry(100, { D13: false }));
    shadow.setDesired('D13', true);
    const state = shadow.getState();
    expect(state.delta.size).toBe(1);
    expect(state.delta.get('D13')!.desired).toBe(true);
    expect(state.delta.get('D13')!.reported).toBe(false);
  });

  it('delta is empty when desired matches reported', () => {
    const shadow = DeviceShadow.getInstance();
    shadow.processFrame(makeTelemetry(100, { D13: true }));
    shadow.setDesired('D13', true);
    const state = shadow.getState();
    expect(state.delta.size).toBe(0);
  });

  it('delta includes desired for channels with no reported value', () => {
    const shadow = DeviceShadow.getInstance();
    shadow.setDesired('D13', true);
    const state = shadow.getState();
    expect(state.delta.size).toBe(1);
    expect(state.delta.get('D13')!.reported).toBeUndefined();
  });

  it('sends command when setting desired while connected', () => {
    const shadow = DeviceShadow.getInstance();
    const serial = createMockSerial(true);
    shadow.attachSerial(serial);
    shadow.setDesired('D13', true);
    expect(serial.send).toHaveBeenCalledWith(
      expect.stringContaining('"channel":"D13"'),
    );
  });

  it('does not send command when not connected', () => {
    const shadow = DeviceShadow.getInstance();
    const serial = createMockSerial(false);
    shadow.attachSerial(serial);
    shadow.setDesired('D13', true);
    // send() is called for handshake only when already connected, but not here
    // For setting desired while disconnected, no send should happen for the command
    const sendCalls = (serial.send as ReturnType<typeof vi.fn>).mock.calls;
    const commandCalls = sendCalls.filter((c: string[]) => c[0].includes('"channel"'));
    expect(commandCalls).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Serial integration
  // -----------------------------------------------------------------------

  it('attachSerial subscribes to serial events', () => {
    const shadow = DeviceShadow.getInstance();
    const serial = createMockSerial(false);
    shadow.attachSerial(serial);
    expect(serial.listeners.size).toBe(1);
  });

  it('detachSerial unsubscribes from serial events', () => {
    const shadow = DeviceShadow.getInstance();
    const serial = createMockSerial(false);
    shadow.attachSerial(serial);
    expect(serial.listeners.size).toBe(1);
    shadow.detachSerial();
    expect(serial.listeners.size).toBe(0);
  });

  it('sends handshake when attaching to connected serial', () => {
    const shadow = DeviceShadow.getInstance();
    const serial = createMockSerial(true);
    shadow.attachSerial(serial);
    expect(serial.send).toHaveBeenCalledWith(
      expect.stringContaining('handshake'),
    );
  });

  it('processes serial data events as frames', () => {
    const shadow = DeviceShadow.getInstance();
    const serial = createMockSerial(true);
    shadow.attachSerial(serial);

    // Simulate receiving a telemetry line
    const line = JSON.stringify({ type: 'telemetry', ts: 100, ch: { A0: 3.3 } }) + '\n';
    serial.emit({ type: 'data', data: line });

    expect(shadow.getChannelValue('A0')).toBe(3.3);
  });

  it('handles partial serial data across multiple events', () => {
    const shadow = DeviceShadow.getInstance();
    const serial = createMockSerial(true);
    shadow.attachSerial(serial);

    const fullLine = JSON.stringify({ type: 'telemetry', ts: 100, ch: { A0: 5.0 } });
    // Send in two parts
    serial.emit({ type: 'data', data: fullLine.substring(0, 20) });
    expect(shadow.getChannelValue('A0')).toBeUndefined(); // not yet complete

    serial.emit({ type: 'data', data: fullLine.substring(20) + '\n' });
    expect(shadow.getChannelValue('A0')).toBe(5.0); // now complete
  });

  it('updates connected state on state_change events', () => {
    const shadow = DeviceShadow.getInstance();
    const serial = createMockSerial(false);
    shadow.attachSerial(serial);
    expect(shadow.getState().connected).toBe(false);

    serial.emit({ type: 'state_change', state: 'connected' });
    expect(shadow.getState().connected).toBe(true);

    serial.emit({ type: 'state_change', state: 'disconnected' });
    expect(shadow.getState().connected).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Reset
  // -----------------------------------------------------------------------

  it('reset clears all state', () => {
    const shadow = DeviceShadow.getInstance();
    shadow.processFrame(makeManifest([{ id: 'A0', name: 'Analog 0' }]));
    shadow.processFrame(makeTelemetry(100, { A0: 3.3 }));
    shadow.setDesired('D13', true);

    shadow.reset();
    const state = shadow.getState();
    expect(state.manifest).toBeNull();
    expect(state.reported.size).toBe(0);
    expect(state.desired.size).toBe(0);
    expect(state.lastUpdate).toBe(0);
    expect(state.frameRate).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Channel accessors
  // -----------------------------------------------------------------------

  it('getChannel returns undefined for unknown channel', () => {
    const shadow = DeviceShadow.getInstance();
    expect(shadow.getChannel('UNKNOWN')).toBeUndefined();
  });

  it('getChannelValue returns the raw value', () => {
    const shadow = DeviceShadow.getInstance();
    shadow.processFrame(makeTelemetry(100, { A0: 2.7 }));
    expect(shadow.getChannelValue('A0')).toBe(2.7);
  });

  it('getChannelValue returns undefined for missing channel', () => {
    const shadow = DeviceShadow.getInstance();
    expect(shadow.getChannelValue('A0')).toBeUndefined();
  });
});
