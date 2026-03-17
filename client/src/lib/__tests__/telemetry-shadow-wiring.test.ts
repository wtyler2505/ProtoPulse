import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { TelemetryShadowBridge, useTelemetryShadowBridge } from '../telemetry-shadow-bridge';
import type { BridgeState } from '../telemetry-shadow-bridge';
import { DeviceShadow } from '../digital-twin/device-shadow';
import { TelemetryLogger } from '../digital-twin/telemetry-logger';
import type { TelemetryFrame, TelemetryManifest } from '../digital-twin/telemetry-protocol';

// ---------------------------------------------------------------------------
// Helpers
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
// Tests — Integration / Wiring
// ---------------------------------------------------------------------------

describe('TelemetryShadowBridge — wiring integration', () => {
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

  // -------------------------------------------------------------------------
  // Rapid reconnection scenarios
  // -------------------------------------------------------------------------

  it('handles rapid connect/disconnect cycles without leaking subscriptions', async () => {
    const bridge = TelemetryShadowBridge.getInstance();

    for (let i = 0; i < 5; i++) {
      DeviceShadow.resetInstance();
      const shadow = DeviceShadow.getInstance();
      const logger = createMockLogger(true);
      await bridge.connectLogger(shadow, logger);
      bridge.disconnect();
    }

    // After all cycles, bridge should be inactive with no leaks
    expect(bridge.getState().active).toBe(false);
    expect(bridge.getState().loggerReady).toBe(false);
  });

  it('only the latest connection receives frames after rapid reconnection', async () => {
    const bridge = TelemetryShadowBridge.getInstance();

    const shadow1 = DeviceShadow.getInstance();
    const logger1 = createMockLogger(true);
    await bridge.connectLogger(shadow1, logger1);

    // Rapidly reconnect
    DeviceShadow.resetInstance();
    const shadow2 = DeviceShadow.getInstance();
    const logger2 = createMockLogger(true);
    await bridge.connectLogger(shadow2, logger2);

    // Send data on old shadow — should NOT reach logger1 (bridge disconnected from it)
    shadow1.processFrame(makeTelemetry(100, { A0: 1.0 }));
    expect(logger1._logged).toHaveLength(0);

    // Send data on new shadow — should reach logger2
    shadow2.processFrame(makeTelemetry(200, { A0: 2.0 }));
    expect(logger2._logged).toHaveLength(1);
  });

  it('connect after failed init does not forward frames', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(false);

    await bridge.connectLogger(shadow, logger);

    shadow.processFrame(makeTelemetry(100, { A0: 1.0 }));
    expect(logger._logged).toHaveLength(0);
    expect(bridge.getState().framesForwarded).toBe(0);
  });

  it('reconnect after failed init succeeds with new logger', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();

    // First attempt: fails
    const badLogger = createMockLogger(false);
    const result1 = await bridge.connectLogger(shadow, badLogger);
    expect(result1).toBe(false);

    // Second attempt: succeeds
    const goodLogger = createMockLogger(true);
    const result2 = await bridge.connectLogger(shadow, goodLogger);
    expect(result2).toBe(true);
    expect(bridge.getState().active).toBe(true);

    shadow.processFrame(makeTelemetry(100, { A0: 1.0 }));
    expect(goodLogger._logged).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // Stats accumulation across reconnections
  // -------------------------------------------------------------------------

  it('stats reset on disconnect but accumulate within a session', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    shadow.processFrame(makeTelemetry(100, { A0: 1.0 }));
    vi.advanceTimersByTime(10);
    shadow.processFrame(makeTelemetry(200, { A0: 2.0, B0: 3.0 }));

    expect(bridge.getState().framesForwarded).toBe(2);
    expect(bridge.getState().dataPointsLogged).toBe(3); // 1 + 2

    // Stats persist across resetStats
    bridge.resetStats();
    expect(bridge.getState().framesForwarded).toBe(0);

    // But forwarding continues
    vi.advanceTimersByTime(10);
    shadow.processFrame(makeTelemetry(300, { A0: 3.0 }));
    expect(bridge.getState().framesForwarded).toBe(1);
  });

  it('stats survive across multiple frames and match logged count', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    const frameCount = 20;
    for (let i = 0; i < frameCount; i++) {
      shadow.processFrame(makeTelemetry(i * 50, { ch1: i, ch2: i * 2 }));
      vi.advanceTimersByTime(50);
    }

    expect(bridge.getState().framesForwarded).toBe(frameCount);
    expect(bridge.getState().dataPointsLogged).toBe(frameCount * 2);
    expect(logger._logged).toHaveLength(frameCount);
  });

  // -------------------------------------------------------------------------
  // Staleness filtering deep tests
  // -------------------------------------------------------------------------

  it('includes all fresh channels in forwarded frame', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    shadow.processFrame(makeTelemetry(100, { A0: 1.0, A1: 2.0, A2: 3.0, D13: true, status: 'ok' }));

    expect(logger._logged).toHaveLength(1);
    const frame = logger._logged[0];
    expect(Object.keys(frame.ch)).toHaveLength(5);
    expect(frame.ch).toEqual({ A0: 1.0, A1: 2.0, A2: 3.0, D13: true, status: 'ok' });
  });

  it('mixed fresh and stale channels: only fresh appear in forwarded frame', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    // Frame with A0 and A1
    shadow.processFrame(makeTelemetry(100, { A0: 1.0, A1: 2.0 }));
    expect(logger._logged).toHaveLength(1);

    // Advance time past staleness threshold
    vi.advanceTimersByTime(2100);

    // New frame only updates A0 — A1 should be stale
    shadow.processFrame(makeTelemetry(200, { A0: 5.0 }));
    expect(logger._logged).toHaveLength(2);

    const lastFrame = logger._logged[1];
    expect(lastFrame.ch).toHaveProperty('A0', 5.0);
    expect(lastFrame.ch).not.toHaveProperty('A1');
  });

  it('frame exactly at staleness boundary (2000ms) is still considered fresh', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    shadow.processFrame(makeTelemetry(100, { A0: 1.0 }));
    expect(logger._logged).toHaveLength(1);

    // Advance exactly 2000ms (not past threshold — <= check)
    vi.advanceTimersByTime(2000);

    shadow.processFrame(makeTelemetry(200, { B0: 2.0 }));
    expect(logger._logged).toHaveLength(2);

    // A0 at exactly the boundary should still be included (now - timestamp <= 2000)
    const lastFrame = logger._logged[1];
    expect(lastFrame.ch).toHaveProperty('A0', 1.0);
    expect(lastFrame.ch).toHaveProperty('B0', 2.0);
  });

  it('frame just past staleness boundary (2001ms) excludes old channel', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    shadow.processFrame(makeTelemetry(100, { A0: 1.0 }));
    vi.advanceTimersByTime(2001);

    shadow.processFrame(makeTelemetry(200, { B0: 2.0 }));
    expect(logger._logged).toHaveLength(2);

    const lastFrame = logger._logged[1];
    expect(lastFrame.ch).not.toHaveProperty('A0');
    expect(lastFrame.ch).toHaveProperty('B0', 2.0);
  });

  // -------------------------------------------------------------------------
  // Channel value type coverage
  // -------------------------------------------------------------------------

  it('forwards boolean channel values correctly', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    shadow.processFrame(makeTelemetry(100, { D2: true, D3: false }));

    expect(logger._logged).toHaveLength(1);
    expect(logger._logged[0].ch).toEqual({ D2: true, D3: false });
  });

  it('forwards string channel values correctly', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    shadow.processFrame(makeTelemetry(100, { mode: 'auto', state: 'idle' }));

    expect(logger._logged).toHaveLength(1);
    expect(logger._logged[0].ch).toEqual({ mode: 'auto', state: 'idle' });
  });

  it('forwards mixed-type channels in a single frame', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    shadow.processFrame(makeTelemetry(100, { A0: 3.3, D13: true, status: 'running' }));

    expect(logger._logged).toHaveLength(1);
    const frame = logger._logged[0];
    expect(frame.ch['A0']).toBe(3.3);
    expect(frame.ch['D13']).toBe(true);
    expect(frame.ch['status']).toBe('running');
  });

  // -------------------------------------------------------------------------
  // Manifest frames do not trigger forwarding
  // -------------------------------------------------------------------------

  it('manifest frame does not cause frame forwarding', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    shadow.processFrame(makeManifest([{ id: 'A0', name: 'Analog 0' }, { id: 'D13', name: 'LED' }]));

    expect(logger._logged).toHaveLength(0);
    expect(bridge.getState().framesForwarded).toBe(0);
  });

  it('manifest followed by telemetry only forwards telemetry', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    shadow.processFrame(makeManifest([{ id: 'A0', name: 'Analog 0' }]));
    shadow.processFrame(makeTelemetry(100, { A0: 1.0 }));

    expect(logger._logged).toHaveLength(1);
    expect(bridge.getState().framesForwarded).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Duplicate / same-timestamp telemetry deduplication
  // -------------------------------------------------------------------------

  it('does not forward when shadow lastUpdate has not changed', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    // Process telemetry — sets lastUpdate
    shadow.processFrame(makeTelemetry(100, { A0: 1.0 }));
    expect(logger._logged).toHaveLength(1);

    // Process manifest — calls notify() but lastUpdate unchanged
    shadow.processFrame(makeManifest([{ id: 'A0', name: 'Analog 0' }]));
    expect(logger._logged).toHaveLength(1);
    expect(bridge.getState().framesForwarded).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Subscriber management
  // -------------------------------------------------------------------------

  it('multiple subscribers all receive notifications', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const cb3 = vi.fn();

    bridge.subscribe(cb1);
    bridge.subscribe(cb2);
    bridge.subscribe(cb3);

    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    expect(cb1).toHaveBeenCalled();
    expect(cb2).toHaveBeenCalled();
    expect(cb3).toHaveBeenCalled();
  });

  it('unsubscribed callback does not fire on subsequent events', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const cb = vi.fn();
    const unsub = bridge.subscribe(cb);

    unsub();
    cb.mockClear();

    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    expect(cb).not.toHaveBeenCalled();
  });

  it('double unsubscribe does not throw or affect other subscribers', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const unsub1 = bridge.subscribe(cb1);
    bridge.subscribe(cb2);

    unsub1();
    unsub1(); // double call

    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalled();
  });

  it('subscriber added during notification is called on next notification', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const lateCb = vi.fn();

    // Subscribe a callback that adds another subscriber on first notification
    const earlyUnsub = bridge.subscribe(() => {
      bridge.subscribe(lateCb);
      earlyUnsub(); // remove self to prevent infinite loop
    });

    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    // lateCb was added during the connect notification cycle; it should be called on next event
    lateCb.mockClear();
    shadow.processFrame(makeTelemetry(100, { A0: 1.0 }));
    expect(lateCb).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // resetInstance while connected
  // -------------------------------------------------------------------------

  it('resetInstance cleans up and new instance starts fresh', async () => {
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    const bridge = TelemetryShadowBridge.getInstance();
    await bridge.connectLogger(shadow, logger);

    shadow.processFrame(makeTelemetry(100, { A0: 1.0 }));
    expect(bridge.getState().framesForwarded).toBe(1);

    TelemetryShadowBridge.resetInstance();

    const newBridge = TelemetryShadowBridge.getInstance();
    expect(newBridge).not.toBe(bridge);
    expect(newBridge.getState().active).toBe(false);
    expect(newBridge.getState().framesForwarded).toBe(0);
    expect(newBridge.getState().loggerReady).toBe(false);
  });

  it('resetInstance clears all subscribers on old instance', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const cb = vi.fn();
    bridge.subscribe(cb);

    TelemetryShadowBridge.resetInstance();

    // Old subscriber should not fire on new instance events
    cb.mockClear();
    const newBridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await newBridge.connectLogger(shadow, logger);

    expect(cb).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Frame timestamp fidelity
  // -------------------------------------------------------------------------

  it('forwarded frame ts matches shadow lastUpdate, not original frame ts', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    // The original frame ts is 42000, but DeviceShadow.handleTelemetry
    // sets lastUpdate = Date.now(), and the bridge's mapShadowToFrame
    // uses state.lastUpdate as ts.
    vi.setSystemTime(new Date(1710000000000));
    shadow.processFrame(makeTelemetry(42000, { A0: 1.0 }));

    expect(logger._logged).toHaveLength(1);
    // ts should be the shadow's Date.now() at processing time, not 42000
    expect(logger._logged[0].ts).toBe(1710000000000);
  });

  it('lastForwardedAt uses Date.now() at forwarding time', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    vi.setSystemTime(new Date(1710000000000));
    shadow.processFrame(makeTelemetry(100, { A0: 1.0 }));
    expect(bridge.getState().lastForwardedAt).toBe(1710000000000);

    vi.setSystemTime(new Date(1710000005000));
    shadow.processFrame(makeTelemetry(200, { A0: 2.0 }));
    expect(bridge.getState().lastForwardedAt).toBe(1710000005000);
  });

  // -------------------------------------------------------------------------
  // Large channel sets
  // -------------------------------------------------------------------------

  it('handles frames with many channels', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    const channels: Record<string, number> = {};
    for (let i = 0; i < 50; i++) {
      channels[`ch${i}`] = i * 0.1;
    }
    shadow.processFrame(makeTelemetry(100, channels));

    expect(logger._logged).toHaveLength(1);
    expect(Object.keys(logger._logged[0].ch)).toHaveLength(50);
    expect(bridge.getState().dataPointsLogged).toBe(50);
  });

  // -------------------------------------------------------------------------
  // Concurrent connect attempts
  // -------------------------------------------------------------------------

  it('concurrent connectLogger calls resolve correctly — last one wins', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();

    const logger1 = createMockLogger(true);
    const logger2 = createMockLogger(true);

    // Start both connections concurrently
    const [result1, result2] = await Promise.all([
      bridge.connectLogger(shadow, logger1),
      bridge.connectLogger(shadow, logger2),
    ]);

    // Both should succeed (second overwrites first)
    expect(result1).toBe(true);
    expect(result2).toBe(true);

    // Only the last logger should receive frames
    shadow.processFrame(makeTelemetry(100, { A0: 1.0 }));

    // logger2 was the last to connect, so it should get the frame
    expect(logger2._logged).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // getState immutability
  // -------------------------------------------------------------------------

  it('getState returns a fresh object each time', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const state1 = bridge.getState();
    const state2 = bridge.getState();
    expect(state1).not.toBe(state2);
    expect(state1).toEqual(state2);
  });

  it('mutating returned state does not affect bridge internals', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    const state = bridge.getState();
    // Attempt to mutate the returned object
    (state as unknown as Record<string, unknown>).framesForwarded = 999;
    (state as unknown as Record<string, unknown>).active = false;

    // Internal state should be unaffected
    const freshState = bridge.getState();
    expect(freshState.framesForwarded).toBe(0);
    expect(freshState.active).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Empty/zero-channel edge cases
  // -------------------------------------------------------------------------

  it('single-channel telemetry is forwarded correctly', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    shadow.processFrame(makeTelemetry(100, { singleCh: 42 }));

    expect(logger._logged).toHaveLength(1);
    expect(logger._logged[0].ch).toEqual({ singleCh: 42 });
    expect(bridge.getState().dataPointsLogged).toBe(1);
  });

  // -------------------------------------------------------------------------
  // disconnect idempotence
  // -------------------------------------------------------------------------

  it('calling disconnect multiple times is safe', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const shadow = DeviceShadow.getInstance();
    const logger = createMockLogger(true);
    await bridge.connectLogger(shadow, logger);

    bridge.disconnect();
    bridge.disconnect();
    bridge.disconnect();

    expect(bridge.getState().active).toBe(false);
    expect(() => bridge.disconnect()).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // resetStats notification
  // -------------------------------------------------------------------------

  it('resetStats notifies subscribers exactly once', async () => {
    const bridge = TelemetryShadowBridge.getInstance();
    const cb = vi.fn();
    bridge.subscribe(cb);

    bridge.resetStats();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // React hook: useTelemetryShadowBridge
  // -------------------------------------------------------------------------

  describe('useTelemetryShadowBridge hook', () => {
    it('returns initial inactive state', () => {
      const { result } = renderHook(() => useTelemetryShadowBridge());

      expect(result.current.active).toBe(false);
      expect(result.current.framesForwarded).toBe(0);
      expect(result.current.dataPointsLogged).toBe(0);
      expect(result.current.lastForwardedAt).toBe(0);
      expect(result.current.loggerReady).toBe(false);
    });

    it('provides connectLogger, disconnect, resetStats functions', () => {
      const { result } = renderHook(() => useTelemetryShadowBridge());

      expect(typeof result.current.connectLogger).toBe('function');
      expect(typeof result.current.disconnect).toBe('function');
      expect(typeof result.current.resetStats).toBe('function');
    });

    it('updates state after connectLogger', async () => {
      const { result } = renderHook(() => useTelemetryShadowBridge());
      const shadow = DeviceShadow.getInstance();
      const logger = createMockLogger(true);

      await act(async () => {
        await result.current.connectLogger(shadow, logger);
      });

      expect(result.current.active).toBe(true);
      expect(result.current.loggerReady).toBe(true);
    });

    it('updates state after disconnect', async () => {
      const { result } = renderHook(() => useTelemetryShadowBridge());
      const shadow = DeviceShadow.getInstance();
      const logger = createMockLogger(true);

      await act(async () => {
        await result.current.connectLogger(shadow, logger);
      });
      expect(result.current.active).toBe(true);

      act(() => {
        result.current.disconnect();
      });
      expect(result.current.active).toBe(false);
    });

    it('reflects framesForwarded after shadow updates', async () => {
      const { result } = renderHook(() => useTelemetryShadowBridge());
      const shadow = DeviceShadow.getInstance();
      const logger = createMockLogger(true);

      await act(async () => {
        await result.current.connectLogger(shadow, logger);
      });

      act(() => {
        shadow.processFrame(makeTelemetry(100, { A0: 1.0 }));
      });

      expect(result.current.framesForwarded).toBe(1);
    });

    it('resetStats zeroes counters via hook', async () => {
      const { result } = renderHook(() => useTelemetryShadowBridge());
      const shadow = DeviceShadow.getInstance();
      const logger = createMockLogger(true);

      await act(async () => {
        await result.current.connectLogger(shadow, logger);
      });

      act(() => {
        shadow.processFrame(makeTelemetry(100, { A0: 1.0 }));
      });
      expect(result.current.framesForwarded).toBe(1);

      act(() => {
        result.current.resetStats();
      });
      expect(result.current.framesForwarded).toBe(0);
      expect(result.current.dataPointsLogged).toBe(0);
      expect(result.current.lastForwardedAt).toBe(0);
      expect(result.current.active).toBe(true); // still connected
    });

    it('hook unsubscribes on unmount', async () => {
      const { result, unmount } = renderHook(() => useTelemetryShadowBridge());
      const shadow = DeviceShadow.getInstance();
      const logger = createMockLogger(true);

      await act(async () => {
        await result.current.connectLogger(shadow, logger);
      });

      unmount();

      // Sending frames after unmount should not cause errors
      expect(() => {
        shadow.processFrame(makeTelemetry(100, { A0: 1.0 }));
      }).not.toThrow();
    });

    it('hook reflects loggerReady false on failed init', async () => {
      const { result } = renderHook(() => useTelemetryShadowBridge());
      const shadow = DeviceShadow.getInstance();
      const logger = createMockLogger(false);

      await act(async () => {
        await result.current.connectLogger(shadow, logger);
      });

      expect(result.current.active).toBe(false);
      expect(result.current.loggerReady).toBe(false);
    });

    it('multiple hook instances share same singleton state', async () => {
      const { result: result1 } = renderHook(() => useTelemetryShadowBridge());
      const { result: result2 } = renderHook(() => useTelemetryShadowBridge());

      const shadow = DeviceShadow.getInstance();
      const logger = createMockLogger(true);

      await act(async () => {
        await result1.current.connectLogger(shadow, logger);
      });

      // Both hooks should see the same state
      expect(result1.current.active).toBe(true);
      expect(result2.current.active).toBe(true);
    });
  });
});
