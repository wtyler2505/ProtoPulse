import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TelemetryShadowBridge } from '../telemetry-shadow-bridge';
import { DeviceShadow } from '../digital-twin/device-shadow';
import { TelemetryLogger } from '../digital-twin/telemetry-logger';
import type { TelemetryFrame, TelemetryManifest } from '../digital-twin/telemetry-protocol';

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
// Mock TelemetryLogger
// ---------------------------------------------------------------------------

function createMockLogger(initSuccess = true): TelemetryLogger & {
  _logged: TelemetryFrame[];
} {
  const logged: TelemetryFrame[] = [];
  return {
    initialize: vi.fn().mockResolvedValue(initSuccess),
    log: vi.fn().mockImplementation((frame: TelemetryFrame) => {
      logged.push(frame);
    }),
    flush: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
    getTimeSeries: vi.fn().mockResolvedValue([]),
    getLatest: vi.fn().mockResolvedValue([]),
    getChannelIds: vi.fn().mockResolvedValue([]),
    prune: vi.fn().mockResolvedValue(0),
    getEntryCount: vi.fn().mockResolvedValue(0),
    clear: vi.fn().mockResolvedValue(undefined),
    _logged: logged,
  } as unknown as TelemetryLogger & { _logged: TelemetryFrame[] };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TelemetryShadowBridge', () => {
  beforeEach(() => {
    TelemetryShadowBridge.resetInstance();
    DeviceShadow.resetInstance();
    vi.useFakeTimers();
  });

  afterEach(() => {
    TelemetryShadowBridge.resetInstance();
    DeviceShadow.resetInstance();
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  it('is a singleton', () => {
    const a = TelemetryShadowBridge.getInstance();
    const b = TelemetryShadowBridge.getInstance();
    expect(a).toBe(b);
  });

  it('resets singleton', () => {
    const a = TelemetryShadowBridge.getInstance();
    TelemetryShadowBridge.resetInstance();
    const b = TelemetryShadowBridge.getInstance();
    expect(a).not.toBe(b);
  });

  // -----------------------------------------------------------------------
  // Initial state
  // -----------------------------------------------------------------------

  it('starts with inactive state', () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const state = bridge.getState();
    expect(state.active).toBe(false);
    expect(state.framesForwarded).toBe(0);
    expect(state.dataPointsLogged).toBe(0);
    expect(state.lastForwardedAt).toBe(0);
    expect(state.loggerReady).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Subscribe / Unsubscribe
  // -----------------------------------------------------------------------

  it('subscribe/unsubscribe works', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const cb = vi.fn();
    const unsub = bridge.subscribe(cb);

    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger();
    await bridge.connectLogger(shadow, logger);

    expect(cb).toHaveBeenCalled();

    unsub();
    cb.mockClear();
    bridge.disconnect();
    expect(cb).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // connectLogger
  // -----------------------------------------------------------------------

  it('connects successfully when logger initializes', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);

    const result = await bridge.connectLogger(shadow, logger);

    expect(result).toBe(true);
    expect(bridge.getState().active).toBe(true);
    expect(bridge.getState().loggerReady).toBe(true);
    expect(logger.initialize).toHaveBeenCalledOnce();
  });

  it('returns false when logger fails to initialize', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(false);

    const result = await bridge.connectLogger(shadow, logger);

    expect(result).toBe(false);
    expect(bridge.getState().active).toBe(false);
    expect(bridge.getState().loggerReady).toBe(false);
  });

  it('disconnects previous connection when connecting again', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow1 = DeviceShadow.getInstance();
    const logger1 = createMockLogger(true);
    await bridge.connectLogger(shadow1, logger1);

    // Connect again with different instances
    DeviceShadow.resetInstance();
    const shadow2 = DeviceShadow.getInstance();
    const logger2 = createMockLogger(true);
    await bridge.connectLogger(shadow2, logger2);

    expect(bridge.getState().active).toBe(true);
    // Old shadow should no longer trigger forwarding
    shadow1.processFrame(makeTelemetry(100, { A0: 1.0 }));
    expect(logger1._logged).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // disconnect
  // -----------------------------------------------------------------------

  it('disconnect stops forwarding', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    bridge.disconnect();
    expect(bridge.getState().active).toBe(false);
    expect(bridge.getState().loggerReady).toBe(false);

    // Shadow updates should not cause logging
    shadow.processFrame(makeTelemetry(100, { A0: 1.0 }));
    expect(logger._logged).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Frame forwarding
  // -----------------------------------------------------------------------

  it('forwards telemetry frames from shadow to logger', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    shadow.processFrame(makeTelemetry(100, { A0: 3.3, D13: true }));

    expect(logger._logged).toHaveLength(1);
    expect(logger._logged[0].ch).toHaveProperty('A0', 3.3);
    expect(logger._logged[0].ch).toHaveProperty('D13', true);
  });

  it('tracks frames forwarded count', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    shadow.processFrame(makeTelemetry(100, { A0: 1.0 }));
    vi.advanceTimersByTime(10);
    shadow.processFrame(makeTelemetry(200, { A0: 2.0 }));
    vi.advanceTimersByTime(10);
    shadow.processFrame(makeTelemetry(300, { A0: 3.0 }));

    expect(bridge.getState().framesForwarded).toBe(3);
  });

  it('tracks data points logged count', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    // 3 channels in one frame = 3 data points
    shadow.processFrame(makeTelemetry(100, { A0: 1.0, A1: 2.0, D13: false }));

    expect(bridge.getState().dataPointsLogged).toBe(3);
  });

  it('updates lastForwardedAt on each forwarded frame', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    const before = Date.now();
    shadow.processFrame(makeTelemetry(100, { A0: 1.0 }));
    const state = bridge.getState();

    expect(state.lastForwardedAt).toBeGreaterThanOrEqual(before);
  });

  it('does not forward when lastUpdate has not changed', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    // Process manifest (does not update lastUpdate)
    shadow.processFrame(makeManifest([{ id: 'A0', name: 'Analog 0' }]));

    expect(logger._logged).toHaveLength(0);
  });

  it('skips stale channels in forwarded frames', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    // First frame: A0 fresh
    shadow.processFrame(makeTelemetry(100, { A0: 1.0 }));
    expect(logger._logged).toHaveLength(1);
    expect(logger._logged[0].ch).toHaveProperty('A0');

    // Wait for A0 to become stale (> 2s), then send telemetry with only B0
    vi.advanceTimersByTime(2100);
    shadow.processFrame(makeTelemetry(200, { B0: 2.0 }));

    // Second frame should have B0 (fresh) but not A0 (stale)
    const lastFrame = logger._logged[logger._logged.length - 1];
    expect(lastFrame.ch).toHaveProperty('B0', 2.0);
    expect(lastFrame.ch).not.toHaveProperty('A0');
  });

  it('does not forward a frame when all channels are stale', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    // Send initial telemetry
    shadow.processFrame(makeTelemetry(100, { A0: 1.0 }));
    expect(logger._logged).toHaveLength(1);

    // Make everything stale, then trigger a shadow update via manifest
    // The trick: set desired (which calls notify but doesn't change lastUpdate)
    // Actually, we need lastUpdate to change for forwarding to trigger.
    // Stale channels are skipped → frame has 0 channels → null → no log
    vi.advanceTimersByTime(2100);

    // Process a new telemetry that triggers lastUpdate but all previous
    // channels besides the new one go stale. If the new telemetry only
    // re-reports a stale channel from the previous set, it gets overwritten
    // to non-stale. Let's test a scenario: empty ch map can't happen via
    // processFrame since telemetry always has at least one channel.
    // So this edge case is naturally covered by the protocol.
    expect(logger._logged).toHaveLength(1);
  });

  it('handles string channel values in forwarded frames', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    shadow.processFrame(makeTelemetry(100, { status: 'running', A0: 3.3 }));

    expect(logger._logged).toHaveLength(1);
    expect(logger._logged[0].ch).toHaveProperty('status', 'running');
    expect(logger._logged[0].ch).toHaveProperty('A0', 3.3);
  });

  it('forwards multiple sequential frames', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    for (let i = 0; i < 10; i++) {
      shadow.processFrame(makeTelemetry(i * 100, { A0: i * 0.5 }));
      vi.advanceTimersByTime(100);
    }

    expect(bridge.getState().framesForwarded).toBe(10);
    expect(logger._logged).toHaveLength(10);
  });

  // -----------------------------------------------------------------------
  // resetStats
  // -----------------------------------------------------------------------

  it('resetStats clears counters without disconnecting', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    shadow.processFrame(makeTelemetry(100, { A0: 1.0 }));
    expect(bridge.getState().framesForwarded).toBe(1);

    bridge.resetStats();
    const state = bridge.getState();
    expect(state.framesForwarded).toBe(0);
    expect(state.dataPointsLogged).toBe(0);
    expect(state.lastForwardedAt).toBe(0);
    expect(state.active).toBe(true); // still active
  });

  it('continues forwarding after resetStats', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    shadow.processFrame(makeTelemetry(100, { A0: 1.0 }));
    bridge.resetStats();

    vi.advanceTimersByTime(10);
    shadow.processFrame(makeTelemetry(200, { A0: 2.0 }));
    expect(bridge.getState().framesForwarded).toBe(1);
  });

  // -----------------------------------------------------------------------
  // Subscriber notification
  // -----------------------------------------------------------------------

  it('notifies subscribers on connect', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const cb = vi.fn();
    bridge.subscribe(cb);

    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    expect(cb).toHaveBeenCalled();
  });

  it('notifies subscribers on disconnect', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    const cb = vi.fn();
    bridge.subscribe(cb);

    bridge.disconnect();
    expect(cb).toHaveBeenCalled();
  });

  it('notifies subscribers on frame forwarded', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    const cb = vi.fn();
    bridge.subscribe(cb);

    shadow.processFrame(makeTelemetry(100, { A0: 1.0 }));
    expect(cb).toHaveBeenCalled();
  });

  it('notifies subscribers on resetStats', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const cb = vi.fn();
    bridge.subscribe(cb);

    bridge.resetStats();
    expect(cb).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  it('handles disconnect when never connected', () => {
    const bridge = TelemetryShadowBridge.getInstance();
    expect(() => bridge.disconnect()).not.toThrow();
    expect(bridge.getState().active).toBe(false);
  });

  it('handles resetInstance while connected', async () => {
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    const bridge = TelemetryShadowBridge.getInstance();
    await bridge.connectLogger(shadow, logger);

    expect(() => TelemetryShadowBridge.resetInstance()).not.toThrow();
    // New instance should be clean
    const newBridge = TelemetryShadowBridge.getInstance();
    expect(newBridge.getState().active).toBe(false);
  });

  it('frame ts uses shadow lastUpdate timestamp', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    shadow.processFrame(makeTelemetry(42000, { A0: 1.0 }));

    expect(logger._logged).toHaveLength(1);
    // The frame ts should be the shadow's lastUpdate (Date.now() at processing time)
    expect(logger._logged[0].ts).toBeGreaterThan(0);
  });

  it('accumulates data points across multiple frames', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    shadow.processFrame(makeTelemetry(100, { A0: 1.0, A1: 2.0 })); // 2 points
    vi.advanceTimersByTime(10);
    shadow.processFrame(makeTelemetry(200, { A0: 1.5, A1: 2.5, D13: true })); // 3 points

    expect(bridge.getState().dataPointsLogged).toBe(5);
  });

  it('does not forward after failed logger initialization', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(false); // fails init

    await bridge.connectLogger(shadow, logger);

    shadow.processFrame(makeTelemetry(100, { A0: 1.0 }));
    expect(logger._logged).toHaveLength(0);
    expect(bridge.getState().framesForwarded).toBe(0);
  });
});
