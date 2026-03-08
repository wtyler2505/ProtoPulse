/**
 * Device Shadow — Real-time state tracking for connected hardware
 *
 * Implements the AWS IoT Device Shadow pattern adapted for local serial:
 *   - reported: values from firmware telemetry
 *   - desired: values set from UI (to be synced to firmware)
 *   - delta: differences where desired != reported
 *
 * Singleton+subscribe pattern for React integration.
 * Integrates with WebSerialManager via event subscription.
 *
 * Staleness detection: channels not updated for >2 seconds are marked stale.
 * Frame rate measurement: rolling average of telemetry frame interval.
 */

import type { WebSerialEvent } from '../web-serial';
import type {
  ProtocolFrame,
  TelemetryManifest,
  TelemetryFrame,
  CommandResponse,
} from './telemetry-protocol';
import { parseFrame, serializeCommand, createHandshake } from './telemetry-protocol';
import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChannelState {
  value: number | boolean | string;
  timestamp: number;
  stale: boolean;
}

export interface ShadowState {
  connected: boolean;
  manifest: TelemetryManifest | null;
  reported: Map<string, ChannelState>;
  desired: Map<string, number | boolean>;
  delta: Map<string, { reported: number | boolean | string | undefined; desired: number | boolean }>;
  lastUpdate: number;
  frameRate: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STALENESS_THRESHOLD_MS = 2000;
const FRAME_RATE_WINDOW = 10; // number of frames to average over

// ---------------------------------------------------------------------------
// Minimal WebSerialManager interface (avoids circular import)
// ---------------------------------------------------------------------------

export interface SerialManagerLike {
  on: (callback: (event: WebSerialEvent) => void) => () => void;
  send: (data: string) => Promise<boolean>;
  readonly isConnected: boolean;
}

// ---------------------------------------------------------------------------
// DeviceShadow
// ---------------------------------------------------------------------------

export class DeviceShadow {
  private static instance: DeviceShadow | null = null;

  private subscribers = new Set<() => void>();
  private serialManager: SerialManagerLike | null = null;
  private serialUnsub: (() => void) | null = null;
  private stalenessTimer: ReturnType<typeof setInterval> | null = null;

  // State
  private _connected = false;
  private _manifest: TelemetryManifest | null = null;
  private _reported = new Map<string, ChannelState>();
  private _desired = new Map<string, number | boolean>();
  private _lastUpdate = 0;

  // Frame rate tracking
  private frameTimestamps: number[] = [];
  private _frameRate = 0;

  // Line buffer for partial serial data
  private lineBuffer = '';

  private constructor() {}

  static getInstance(): DeviceShadow {
    if (!DeviceShadow.instance) {
      DeviceShadow.instance = new DeviceShadow();
    }
    return DeviceShadow.instance;
  }

  static resetInstance(): void {
    if (DeviceShadow.instance) {
      DeviceShadow.instance.detachSerial();
      DeviceShadow.instance.stopStalenessTimer();
      DeviceShadow.instance.subscribers.clear();
    }
    DeviceShadow.instance = null;
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
  // State accessors
  // -----------------------------------------------------------------------

  getState(): ShadowState {
    return {
      connected: this._connected,
      manifest: this._manifest,
      reported: new Map(this._reported),
      desired: new Map(this._desired),
      delta: this.computeDelta(),
      lastUpdate: this._lastUpdate,
      frameRate: this._frameRate,
    };
  }

  getChannel(id: string): ChannelState | undefined {
    return this._reported.get(id);
  }

  getChannelValue(id: string): number | boolean | string | undefined {
    return this._reported.get(id)?.value;
  }

  isStale(id: string): boolean {
    const ch = this._reported.get(id);
    if (!ch) {
      return true;
    }
    return Date.now() - ch.timestamp > STALENESS_THRESHOLD_MS;
  }

  // -----------------------------------------------------------------------
  // Serial integration
  // -----------------------------------------------------------------------

  attachSerial(manager: SerialManagerLike): void {
    this.detachSerial();
    this.serialManager = manager;
    this._connected = manager.isConnected;

    this.serialUnsub = manager.on((event: WebSerialEvent) => {
      if (event.type === 'data' && typeof event.data === 'string') {
        this.handleSerialData(event.data);
      }
      if (event.type === 'state_change') {
        const wasConnected = this._connected;
        this._connected = event.state === 'connected';

        if (this._connected && !wasConnected) {
          // Send handshake on connect
          void manager.send(createHandshake());
          this.startStalenessTimer();
        }
        if (!this._connected && wasConnected) {
          this.stopStalenessTimer();
          this.markAllStale();
        }

        this.notify();
      }
    });

    if (this._connected) {
      this.startStalenessTimer();
      void manager.send(createHandshake());
    }

    this.notify();
  }

  detachSerial(): void {
    if (this.serialUnsub) {
      this.serialUnsub();
      this.serialUnsub = null;
    }
    this.serialManager = null;
    this._connected = false;
    this.stopStalenessTimer();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Frame processing
  // -----------------------------------------------------------------------

  processFrame(frame: ProtocolFrame): void {
    switch (frame.type) {
      case 'manifest':
        this.handleManifest(frame);
        break;
      case 'telemetry':
        this.handleTelemetry(frame);
        break;
      case 'response':
        this.handleResponse(frame);
        break;
    }
    this.notify();
  }

  private handleManifest(manifest: TelemetryManifest): void {
    this._manifest = manifest;
    // Initialize reported channels from manifest
    for (const ch of manifest.channels) {
      if (!this._reported.has(ch.id)) {
        this._reported.set(ch.id, {
          value: 0,
          timestamp: 0,
          stale: true,
        });
      }
    }
  }

  private handleTelemetry(frame: TelemetryFrame): void {
    const now = Date.now();
    this._lastUpdate = now;

    // Update reported values
    for (const [channelId, value] of Object.entries(frame.ch)) {
      this._reported.set(channelId, {
        value,
        timestamp: now,
        stale: false,
      });
    }

    // Update frame rate
    this.frameTimestamps.push(now);
    if (this.frameTimestamps.length > FRAME_RATE_WINDOW) {
      this.frameTimestamps.shift();
    }
    if (this.frameTimestamps.length >= 2) {
      const span = this.frameTimestamps[this.frameTimestamps.length - 1] - this.frameTimestamps[0];
      if (span > 0) {
        this._frameRate = ((this.frameTimestamps.length - 1) / span) * 1000;
      }
    }
  }

  private handleResponse(_response: CommandResponse): void {
    // Command responses are informational for now.
    // Future: track pending commands and match responses.
  }

  // -----------------------------------------------------------------------
  // Desired state
  // -----------------------------------------------------------------------

  setDesired(channel: string, value: number | boolean): void {
    this._desired.set(channel, value);

    // Send command to firmware if connected
    if (this.serialManager && this._connected) {
      void this.serialManager.send(serializeCommand(channel, value));
    }

    this.notify();
  }

  // -----------------------------------------------------------------------
  // Reset
  // -----------------------------------------------------------------------

  reset(): void {
    this._manifest = null;
    this._reported.clear();
    this._desired.clear();
    this._lastUpdate = 0;
    this._frameRate = 0;
    this.frameTimestamps = [];
    this.lineBuffer = '';
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Private: serial data handling
  // -----------------------------------------------------------------------

  private handleSerialData(data: string): void {
    this.lineBuffer += data;

    // Split on newlines — process complete lines
    const lines = this.lineBuffer.split('\n');
    // Last element is either empty (if data ended with \n) or a partial line
    this.lineBuffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length === 0) {
        continue;
      }
      const frame = parseFrame(trimmed);
      if (frame) {
        this.processFrame(frame);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Private: staleness
  // -----------------------------------------------------------------------

  private startStalenessTimer(): void {
    if (this.stalenessTimer !== null) {
      return;
    }
    this.stalenessTimer = setInterval(() => {
      this.updateStaleness();
    }, 500);
  }

  private stopStalenessTimer(): void {
    if (this.stalenessTimer !== null) {
      clearInterval(this.stalenessTimer);
      this.stalenessTimer = null;
    }
  }

  private updateStaleness(): void {
    const now = Date.now();
    let changed = false;
    for (const [, state] of Array.from(this._reported.entries())) {
      const stale = now - state.timestamp > STALENESS_THRESHOLD_MS;
      if (stale !== state.stale) {
        state.stale = stale;
        changed = true;
      }
    }
    if (changed) {
      this.notify();
    }
  }

  private markAllStale(): void {
    for (const [, state] of Array.from(this._reported.entries())) {
      state.stale = true;
    }
  }

  // -----------------------------------------------------------------------
  // Private: delta computation
  // -----------------------------------------------------------------------

  private computeDelta(): Map<string, { reported: number | boolean | string | undefined; desired: number | boolean }> {
    const delta = new Map<string, { reported: number | boolean | string | undefined; desired: number | boolean }>();
    for (const [channel, desired] of Array.from(this._desired.entries())) {
      const reported = this._reported.get(channel);
      const reportedValue = reported?.value;

      // Delta exists when desired differs from reported
      if (reportedValue === undefined || reportedValue !== desired) {
        delta.set(channel, { reported: reportedValue, desired });
      }
    }
    return delta;
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useDeviceShadow(): ShadowState & {
  setDesired: (channel: string, value: number | boolean) => void;
  attachSerial: (manager: SerialManagerLike) => void;
  detachSerial: () => void;
  reset: () => void;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    const shadow = DeviceShadow.getInstance();
    const unsub = shadow.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsub;
  }, []);

  const shadow = DeviceShadow.getInstance();
  const state = shadow.getState();

  const setDesired = useCallback((channel: string, value: number | boolean) => {
    DeviceShadow.getInstance().setDesired(channel, value);
  }, []);

  const attachSerial = useCallback((manager: SerialManagerLike) => {
    DeviceShadow.getInstance().attachSerial(manager);
  }, []);

  const detachSerial = useCallback(() => {
    DeviceShadow.getInstance().detachSerial();
  }, []);

  const resetShadow = useCallback(() => {
    DeviceShadow.getInstance().reset();
  }, []);

  return {
    ...state,
    setDesired,
    attachSerial,
    detachSerial,
    reset: resetShadow,
  };
}
