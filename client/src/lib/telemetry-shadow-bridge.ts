/**
 * TelemetryShadowBridge — Connects TelemetryLogger ↔ DeviceShadow
 *
 * BL-0272: The TelemetryLogger (IndexedDB persistence) and DeviceShadow
 * (live state overlay) were both fully functional but operated independently.
 * This bridge subscribes to DeviceShadow state changes and forwards
 * telemetry frames to the TelemetryLogger for persistence, so historical
 * telemetry data is automatically captured whenever a device is connected.
 *
 * Singleton+subscribe pattern for React integration.
 *
 * Responsibilities:
 *   - Subscribes to DeviceShadow for state changes
 *   - Converts shadow reported values into TelemetryFrame format
 *   - Forwards frames to TelemetryLogger.log()
 *   - Tracks connection status and frame forwarding stats
 *   - Provides useTelemetryShadowBridge() React hook
 */

import { useCallback, useEffect, useState } from 'react';
import type { TelemetryFrame } from './digital-twin/telemetry-protocol';
import type { DeviceShadow, ShadowState } from './digital-twin/device-shadow';
import type { TelemetryLogger } from './digital-twin/telemetry-logger';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Match DeviceShadow's staleness threshold (2 seconds) */
const STALENESS_THRESHOLD_MS = 2000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BridgeState {
  /** Whether the bridge is actively forwarding frames */
  active: boolean;
  /** Total number of frames forwarded to the logger */
  framesForwarded: number;
  /** Total number of individual channel data points logged */
  dataPointsLogged: number;
  /** Timestamp of last forwarded frame (0 if none) */
  lastForwardedAt: number;
  /** Whether logger initialization succeeded */
  loggerReady: boolean;
}

// ---------------------------------------------------------------------------
// TelemetryShadowBridge
// ---------------------------------------------------------------------------

export class TelemetryShadowBridge {
  private static instance: TelemetryShadowBridge | null = null;

  private subscribers = new Set<() => void>();
  private shadow: DeviceShadow | null = null;
  private logger: TelemetryLogger | null = null;
  private shadowUnsub: (() => void) | null = null;

  // State
  private _active = false;
  private _framesForwarded = 0;
  private _dataPointsLogged = 0;
  private _lastForwardedAt = 0;
  private _loggerReady = false;

  // Tracking: last snapshot of reported values to detect new telemetry
  private _lastReportedTimestamp = 0;

  private constructor() {}

  static getInstance(): TelemetryShadowBridge {
    if (!TelemetryShadowBridge.instance) {
      TelemetryShadowBridge.instance = new TelemetryShadowBridge();
    }
    return TelemetryShadowBridge.instance;
  }

  static resetInstance(): void {
    if (TelemetryShadowBridge.instance) {
      TelemetryShadowBridge.instance.disconnect();
      TelemetryShadowBridge.instance.subscribers.clear();
    }
    TelemetryShadowBridge.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  subscribe(cb: () => void): () => void {
    this.subscribers.add(cb);
    return () => {
      this.subscribers.delete(cb);
    };
  }

  private notify(): void {
    for (const cb of Array.from(this.subscribers)) {
      cb();
    }
  }

  // -----------------------------------------------------------------------
  // State accessor
  // -----------------------------------------------------------------------

  getState(): BridgeState {
    return {
      active: this._active,
      framesForwarded: this._framesForwarded,
      dataPointsLogged: this._dataPointsLogged,
      lastForwardedAt: this._lastForwardedAt,
      loggerReady: this._loggerReady,
    };
  }

  // -----------------------------------------------------------------------
  // Connection
  // -----------------------------------------------------------------------

  /**
   * Connect the bridge between a DeviceShadow and TelemetryLogger.
   * Initializes the logger (IndexedDB) and subscribes to shadow updates.
   * Returns true if initialization succeeded.
   */
  async connectLogger(shadow: DeviceShadow, logger: TelemetryLogger): Promise<boolean> {
    // Disconnect any existing connection first
    this.disconnect();

    this.shadow = shadow;
    this.logger = logger;

    // Initialize the logger (opens IndexedDB)
    this._loggerReady = await logger.initialize();
    if (!this._loggerReady) {
      this.shadow = null;
      this.logger = null;
      this.notify();
      return false;
    }

    // Subscribe to shadow state changes
    this.shadowUnsub = shadow.subscribe(() => {
      this.onShadowUpdate();
    });

    this._active = true;
    this.notify();
    return true;
  }

  /**
   * Disconnect the bridge — stops forwarding and cleans up subscriptions.
   */
  disconnect(): void {
    if (this.shadowUnsub) {
      this.shadowUnsub();
      this.shadowUnsub = null;
    }
    this.shadow = null;
    this.logger = null;
    this._active = false;
    this._loggerReady = false;
    this._lastReportedTimestamp = 0;
    this.notify();
  }

  /**
   * Reset forwarding stats without disconnecting.
   */
  resetStats(): void {
    this._framesForwarded = 0;
    this._dataPointsLogged = 0;
    this._lastForwardedAt = 0;
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Internal: shadow update handler
  // -----------------------------------------------------------------------

  private onShadowUpdate(): void {
    if (!this.shadow || !this.logger || !this._loggerReady) {
      return;
    }

    const state: ShadowState = this.shadow.getState();

    // Only forward when there's new telemetry data (lastUpdate changed)
    if (state.lastUpdate <= this._lastReportedTimestamp) {
      return;
    }
    this._lastReportedTimestamp = state.lastUpdate;

    // Build a TelemetryFrame from the current reported values
    const frame = this.mapShadowToFrame(state);
    if (frame === null) {
      return;
    }

    this.logger.log(frame);
    this._framesForwarded++;
    this._dataPointsLogged += Object.keys(frame.ch).length;
    this._lastForwardedAt = Date.now();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Internal: mapping
  // -----------------------------------------------------------------------

  /**
   * Convert current shadow reported state into a TelemetryFrame.
   * Returns null if there are no reported channels with fresh data.
   *
   * Uses timestamp-based staleness detection (> 2s since last update)
   * rather than the `.stale` property, which depends on DeviceShadow's
   * internal staleness timer (only active when serial is attached).
   */
  private mapShadowToFrame(state: ShadowState): TelemetryFrame | null {
    const ch: Record<string, number | boolean | string> = {};
    let channelCount = 0;
    const now = Date.now();

    for (const [channelId, channelState] of Array.from(state.reported.entries())) {
      // Only include channels with recent data (within 2s)
      const isFresh = channelState.timestamp > 0 && (now - channelState.timestamp) <= STALENESS_THRESHOLD_MS;
      if (isFresh) {
        ch[channelId] = channelState.value;
        channelCount++;
      }
    }

    if (channelCount === 0) {
      return null;
    }

    return {
      type: 'telemetry',
      ts: state.lastUpdate,
      ch,
    };
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useTelemetryShadowBridge(): BridgeState & {
  connectLogger: (shadow: DeviceShadow, logger: TelemetryLogger) => Promise<boolean>;
  disconnect: () => void;
  resetStats: () => void;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    const bridge = TelemetryShadowBridge.getInstance();
    const unsub = bridge.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsub;
  }, []);

  const bridge = TelemetryShadowBridge.getInstance();
  const state = bridge.getState();

  const connect = useCallback(
    (shadow: DeviceShadow, logger: TelemetryLogger) => {
      return TelemetryShadowBridge.getInstance().connectLogger(shadow, logger);
    },
    [],
  );

  const disconnect = useCallback(() => {
    TelemetryShadowBridge.getInstance().disconnect();
  }, []);

  const resetStats = useCallback(() => {
    TelemetryShadowBridge.getInstance().resetStats();
  }, []);

  return {
    ...state,
    connectLogger: connect,
    disconnect,
    resetStats,
  };
}
