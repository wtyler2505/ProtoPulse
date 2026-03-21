/**
 * StateReplayEngine — Time-travel state replay for firmware simulation (BL-0703)
 *
 * Frame-based timeline that captures discrete simulation snapshots and provides
 * playback controls (play/pause/seek/step/speed/loop). Supports domain-specific
 * state reconstruction for serial output accumulation, code line highlighting,
 * and pin states. Includes markers for annotating notable frames and
 * import/export for persisting replay sessions.
 *
 * Uses singleton+subscribe pattern for useSyncExternalStore compatibility.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Listener = () => void;

/** Pin state at a given frame. */
export interface PinState {
  /** Pin identifier (e.g. 'D13', 'A0'). */
  pin: string;
  /** Pin mode: input, output, input_pullup, pwm, analog. */
  mode: 'input' | 'output' | 'input_pullup' | 'pwm' | 'analog';
  /** Digital or analog value. */
  value: number;
}

/** A single replay frame capturing simulation state at one point in time. */
export interface ReplayFrame {
  /** Frame index (0-based, monotonically increasing). */
  index: number;
  /** Simulation timestamp in milliseconds. */
  timestampMs: number;
  /** Serial output line emitted at this frame (empty string if none). */
  serialOutput: string;
  /** Active code line number being executed (1-based, 0 if unknown). */
  codeLine: number;
  /** Pin states at this frame. */
  pinStates: PinState[];
  /** Optional domain-specific metadata. */
  metadata?: Record<string, unknown>;
}

/** A named marker on the timeline. */
export interface ReplayMarker {
  /** Unique marker ID. */
  id: string;
  /** Frame index this marker points to. */
  frameIndex: number;
  /** Human-readable label. */
  label: string;
  /** Optional color for UI rendering. */
  color?: string;
}

/** Playback speed multiplier. */
export type PlaybackSpeed = 0.25 | 0.5 | 1 | 2 | 4 | 8;

/** Playback state. */
export type PlaybackState = 'stopped' | 'playing' | 'paused';

/** Domain-specific reconstructed state at the current frame. */
export interface ReconstructedState {
  /** All serial output accumulated up to and including the current frame. */
  serialAccumulated: string;
  /** Array of serial lines accumulated. */
  serialLines: string[];
  /** Current code line being executed. */
  currentCodeLine: number;
  /** Map of pin ID to its current state. */
  pinStates: Map<string, PinState>;
  /** Current frame index. */
  frameIndex: number;
  /** Current simulation timestamp. */
  timestampMs: number;
}

/** Snapshot returned by getSnapshot() for useSyncExternalStore. */
export interface ReplaySnapshot {
  /** Total number of recorded frames. */
  totalFrames: number;
  /** Current frame index (0-based). */
  currentFrame: number;
  /** Current playback state. */
  playbackState: PlaybackState;
  /** Current playback speed. */
  speed: PlaybackSpeed;
  /** Whether looping is enabled. */
  loop: boolean;
  /** All markers. */
  markers: ReplayMarker[];
  /** Reconstructed state at the current frame. */
  reconstructed: ReconstructedState;
  /** Duration of the recording in ms. */
  durationMs: number;
}

/** Serialized format for import/export. */
export interface ReplayExportData {
  version: 1;
  frames: ReplayFrame[];
  markers: ReplayMarker[];
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_SPEEDS: PlaybackSpeed[] = [0.25, 0.5, 1, 2, 4, 8];
const DEFAULT_FRAME_INTERVAL_MS = 16; // ~60fps playback base rate

// ---------------------------------------------------------------------------
// StateReplayEngine
// ---------------------------------------------------------------------------

export class StateReplayEngine {
  private static _instance: StateReplayEngine | null = null;

  private _listeners = new Set<Listener>();
  private _frames: ReplayFrame[] = [];
  private _markers: ReplayMarker[] = [];
  private _currentFrame = 0;
  private _playbackState: PlaybackState = 'stopped';
  private _speed: PlaybackSpeed = 1;
  private _loop = false;
  private _timerId: ReturnType<typeof setTimeout> | null = null;
  private _snapshotCache: ReplaySnapshot | null = null;
  private _nextMarkerId = 1;

  // Cached reconstructed state for performance
  private _reconstructedCache: ReconstructedState | null = null;
  private _reconstructedCacheFrame = -1;

  private constructor() {}

  static getInstance(): StateReplayEngine {
    if (!StateReplayEngine._instance) {
      StateReplayEngine._instance = new StateReplayEngine();
    }
    return StateReplayEngine._instance;
  }

  /** Create a fresh (non-singleton) instance. Useful for testing. */
  static create(): StateReplayEngine {
    return new StateReplayEngine();
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

  getSnapshot = (): ReplaySnapshot => {
    if (this._snapshotCache) {
      return this._snapshotCache;
    }
    this._snapshotCache = this._buildSnapshot();
    return this._snapshotCache;
  };

  private _invalidateCache(): void {
    this._snapshotCache = null;
    // Reconstructed cache is invalidated only when frame changes
  }

  private _notify(): void {
    this._invalidateCache();
    const listeners = Array.from(this._listeners);
    for (let i = 0; i < listeners.length; i++) {
      listeners[i]();
    }
  }

  // -----------------------------------------------------------------------
  // Recording API
  // -----------------------------------------------------------------------

  /**
   * Record a new frame. Frames must be appended in chronological order.
   * If playback is active, it is stopped first.
   */
  recordFrame(frame: Omit<ReplayFrame, 'index'>): void {
    if (this._playbackState === 'playing') {
      this._stopTimer();
      this._playbackState = 'stopped';
    }

    const newFrame: ReplayFrame = {
      ...frame,
      index: this._frames.length,
    };

    this._frames.push(newFrame);
    this._currentFrame = this._frames.length - 1;
    this._invalidateReconstructedCache();
    this._notify();
  }

  /** Get the total number of recorded frames. */
  getTotalFrames(): number {
    return this._frames.length;
  }

  /** Get a specific frame by index. Returns null if out of range. */
  getFrame(index: number): ReplayFrame | null {
    if (index < 0 || index >= this._frames.length) {
      return null;
    }
    return this._frames[index];
  }

  /** Get all frames (copy). */
  getAllFrames(): ReplayFrame[] {
    return [...this._frames];
  }

  /** Clear all frames and reset state. */
  clear(): void {
    this._stopTimer();
    this._frames = [];
    this._markers = [];
    this._currentFrame = 0;
    this._playbackState = 'stopped';
    this._speed = 1;
    this._loop = false;
    this._nextMarkerId = 1;
    this._invalidateReconstructedCache();
    this._notify();
  }

  // -----------------------------------------------------------------------
  // Playback controls
  // -----------------------------------------------------------------------

  /** Start or resume playback from the current frame. */
  play(): void {
    if (this._frames.length === 0) {
      return;
    }

    if (this._playbackState === 'playing') {
      return;
    }

    // If at the end and not looping, restart from beginning
    if (this._currentFrame >= this._frames.length - 1 && !this._loop) {
      this._currentFrame = 0;
      this._invalidateReconstructedCache();
    }

    this._playbackState = 'playing';
    this._scheduleNextFrame();
    this._notify();
  }

  /** Pause playback. */
  pause(): void {
    if (this._playbackState !== 'playing') {
      return;
    }

    this._stopTimer();
    this._playbackState = 'paused';
    this._notify();
  }

  /** Stop playback and reset to frame 0. */
  stop(): void {
    this._stopTimer();
    this._playbackState = 'stopped';
    this._currentFrame = 0;
    this._invalidateReconstructedCache();
    this._notify();
  }

  /** Toggle between play and pause. */
  togglePlayPause(): void {
    if (this._playbackState === 'playing') {
      this.pause();
    } else {
      this.play();
    }
  }

  /** Seek to a specific frame index. Clamps to valid range. */
  seek(frameIndex: number): void {
    if (this._frames.length === 0) {
      return;
    }

    const clamped = Math.max(0, Math.min(frameIndex, this._frames.length - 1));
    if (clamped === this._currentFrame) {
      return;
    }

    this._currentFrame = clamped;
    this._invalidateReconstructedCache();

    // If playing, reschedule from new position
    if (this._playbackState === 'playing') {
      this._stopTimer();
      this._scheduleNextFrame();
    }

    this._notify();
  }

  /** Step forward one frame. Pauses if playing. */
  stepForward(): void {
    if (this._frames.length === 0) {
      return;
    }

    if (this._playbackState === 'playing') {
      this._stopTimer();
      this._playbackState = 'paused';
    }

    if (this._currentFrame < this._frames.length - 1) {
      this._currentFrame++;
      this._invalidateReconstructedCache();
    } else if (this._loop) {
      this._currentFrame = 0;
      this._invalidateReconstructedCache();
    }

    this._notify();
  }

  /** Step backward one frame. Pauses if playing. */
  stepBackward(): void {
    if (this._frames.length === 0) {
      return;
    }

    if (this._playbackState === 'playing') {
      this._stopTimer();
      this._playbackState = 'paused';
    }

    if (this._currentFrame > 0) {
      this._currentFrame--;
      this._invalidateReconstructedCache();
    } else if (this._loop) {
      this._currentFrame = this._frames.length - 1;
      this._invalidateReconstructedCache();
    }

    this._notify();
  }

  /** Set playback speed. Must be one of the valid speeds. */
  setSpeed(speed: PlaybackSpeed): void {
    if (!VALID_SPEEDS.includes(speed)) {
      return;
    }
    if (speed === this._speed) {
      return;
    }

    this._speed = speed;

    // Reschedule if playing
    if (this._playbackState === 'playing') {
      this._stopTimer();
      this._scheduleNextFrame();
    }

    this._notify();
  }

  /** Get the current playback speed. */
  getSpeed(): PlaybackSpeed {
    return this._speed;
  }

  /** Enable or disable loop mode. */
  setLoop(enabled: boolean): void {
    if (this._loop === enabled) {
      return;
    }
    this._loop = enabled;
    this._notify();
  }

  /** Whether loop mode is enabled. */
  isLooping(): boolean {
    return this._loop;
  }

  /** Get the current playback state. */
  getPlaybackState(): PlaybackState {
    return this._playbackState;
  }

  /** Get the current frame index. */
  getCurrentFrameIndex(): number {
    return this._currentFrame;
  }

  // -----------------------------------------------------------------------
  // Markers
  // -----------------------------------------------------------------------

  /** Add a marker at the specified frame. Returns the marker ID. */
  addMarker(frameIndex: number, label: string, color?: string): string {
    if (frameIndex < 0 || frameIndex >= this._frames.length) {
      throw new Error(`Frame index ${String(frameIndex)} out of range [0, ${String(this._frames.length - 1)}]`);
    }

    const id = `marker-${String(this._nextMarkerId++)}`;
    const marker: ReplayMarker = { id, frameIndex, label, color };
    this._markers.push(marker);
    this._notify();
    return id;
  }

  /** Remove a marker by ID. Returns true if found and removed. */
  removeMarker(id: string): boolean {
    const idx = this._markers.findIndex((m) => m.id === id);
    if (idx === -1) {
      return false;
    }
    this._markers.splice(idx, 1);
    this._notify();
    return true;
  }

  /** Get all markers (copy). */
  getMarkers(): ReplayMarker[] {
    return [...this._markers];
  }

  /** Seek to the next marker after the current frame. Wraps if looping. */
  seekToNextMarker(): void {
    if (this._markers.length === 0) {
      return;
    }

    const sorted = [...this._markers].sort((a, b) => a.frameIndex - b.frameIndex);
    const next = sorted.find((m) => m.frameIndex > this._currentFrame);

    if (next) {
      this.seek(next.frameIndex);
    } else if (this._loop && sorted.length > 0) {
      this.seek(sorted[0].frameIndex);
    }
  }

  /** Seek to the previous marker before the current frame. Wraps if looping. */
  seekToPreviousMarker(): void {
    if (this._markers.length === 0) {
      return;
    }

    const sorted = [...this._markers].sort((a, b) => a.frameIndex - b.frameIndex);
    const prev = [...sorted].reverse().find((m) => m.frameIndex < this._currentFrame);

    if (prev) {
      this.seek(prev.frameIndex);
    } else if (this._loop && sorted.length > 0) {
      this.seek(sorted[sorted.length - 1].frameIndex);
    }
  }

  // -----------------------------------------------------------------------
  // State reconstruction
  // -----------------------------------------------------------------------

  /**
   * Reconstruct the full domain-specific state at the current frame.
   * This accumulates serial output, resolves the current code line,
   * and builds the pin state map from frame 0 to currentFrame.
   */
  getReconstructedState(): ReconstructedState {
    if (this._reconstructedCacheFrame === this._currentFrame && this._reconstructedCache) {
      return this._reconstructedCache;
    }

    const state = this._reconstructState(this._currentFrame);
    this._reconstructedCache = state;
    this._reconstructedCacheFrame = this._currentFrame;
    return state;
  }

  private _reconstructState(upToFrame: number): ReconstructedState {
    if (this._frames.length === 0) {
      return {
        serialAccumulated: '',
        serialLines: [],
        currentCodeLine: 0,
        pinStates: new Map<string, PinState>(),
        frameIndex: 0,
        timestampMs: 0,
      };
    }

    const clampedFrame = Math.max(0, Math.min(upToFrame, this._frames.length - 1));
    const serialLines: string[] = [];
    const pinMap = new Map<string, PinState>();
    let currentCodeLine = 0;

    for (let i = 0; i <= clampedFrame; i++) {
      const frame = this._frames[i];

      // Accumulate serial output
      if (frame.serialOutput !== '') {
        serialLines.push(frame.serialOutput);
      }

      // Latest code line
      if (frame.codeLine > 0) {
        currentCodeLine = frame.codeLine;
      }

      // Update pin states (latest wins)
      for (let p = 0; p < frame.pinStates.length; p++) {
        const ps = frame.pinStates[p];
        pinMap.set(ps.pin, { ...ps });
      }
    }

    const currentFrameData = this._frames[clampedFrame];

    return {
      serialAccumulated: serialLines.join('\n'),
      serialLines,
      currentCodeLine,
      pinStates: pinMap,
      frameIndex: clampedFrame,
      timestampMs: currentFrameData.timestampMs,
    };
  }

  // -----------------------------------------------------------------------
  // Import / Export
  // -----------------------------------------------------------------------

  /** Export the current recording and markers as a JSON-serializable object. */
  exportData(): ReplayExportData {
    return {
      version: 1,
      frames: [...this._frames],
      markers: [...this._markers],
    };
  }

  /** Import frames and markers from a previously exported object. Replaces current state. */
  importData(data: ReplayExportData): void {
    if (data.version !== 1) {
      throw new Error(`Unsupported replay data version: ${String(data.version)}`);
    }

    if (!Array.isArray(data.frames)) {
      throw new Error('Invalid replay data: frames must be an array');
    }

    this._stopTimer();
    this._frames = data.frames.map((f, i) => ({ ...f, index: i }));
    this._markers = Array.isArray(data.markers) ? [...data.markers] : [];
    this._currentFrame = 0;
    this._playbackState = 'stopped';
    this._nextMarkerId = this._markers.length + 1;
    this._invalidateReconstructedCache();
    this._notify();
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private _invalidateReconstructedCache(): void {
    this._reconstructedCache = null;
    this._reconstructedCacheFrame = -1;
  }

  private _scheduleNextFrame(): void {
    if (this._frames.length < 2) {
      return;
    }

    // Compute inter-frame interval based on speed
    let intervalMs: number;
    if (this._currentFrame < this._frames.length - 1) {
      const currentTs = this._frames[this._currentFrame].timestampMs;
      const nextTs = this._frames[this._currentFrame + 1].timestampMs;
      const delta = nextTs - currentTs;
      intervalMs = Math.max(1, delta / this._speed);
    } else {
      intervalMs = DEFAULT_FRAME_INTERVAL_MS / this._speed;
    }

    this._timerId = setTimeout(() => {
      this._advanceFrame();
    }, intervalMs);
  }

  private _advanceFrame(): void {
    if (this._currentFrame < this._frames.length - 1) {
      this._currentFrame++;
      this._invalidateReconstructedCache();
      this._notify();
      this._scheduleNextFrame();
    } else if (this._loop) {
      this._currentFrame = 0;
      this._invalidateReconstructedCache();
      this._notify();
      this._scheduleNextFrame();
    } else {
      // Reached end, stop
      this._playbackState = 'stopped';
      this._notify();
    }
  }

  private _stopTimer(): void {
    if (this._timerId !== null) {
      clearTimeout(this._timerId);
      this._timerId = null;
    }
  }

  // -----------------------------------------------------------------------
  // Snapshot builder
  // -----------------------------------------------------------------------

  private _buildSnapshot(): ReplaySnapshot {
    const reconstructed = this.getReconstructedState();
    const durationMs =
      this._frames.length > 0 ? this._frames[this._frames.length - 1].timestampMs - this._frames[0].timestampMs : 0;

    return {
      totalFrames: this._frames.length,
      currentFrame: this._currentFrame,
      playbackState: this._playbackState,
      speed: this._speed,
      loop: this._loop,
      markers: [...this._markers],
      reconstructed,
      durationMs,
    };
  }
}
