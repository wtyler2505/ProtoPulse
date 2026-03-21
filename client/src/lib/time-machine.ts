/**
 * Time Machine — BL-0464
 *
 * Records and replays multi-domain events across the ProtoPulse workspace.
 * Provides:
 *   - Event recording with 100K ring buffer (auto-evicts oldest)
 *   - Multi-domain timeline: firmware, serial, schematic, telemetry, user
 *   - State reconstruction at any timestamp via snapshot + replay
 *   - Playback controls: play, pause, seek, adjustable speed
 *   - Bookmarks with labels for marking significant moments
 *   - Import/export for session sharing and analysis
 *
 * Singleton+subscribe pattern for React integration.
 * Pure module — no DOM/React dependencies in core logic.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Listener = () => void;

/** Event domains tracked by the time machine. */
export type EventDomain = 'firmware' | 'serial' | 'schematic' | 'telemetry' | 'user';

/** A single recorded event. */
export interface TimelineEvent {
  /** Auto-assigned monotonic ID. */
  readonly id: number;
  /** Timestamp in milliseconds (monotonic, relative to recording start). */
  readonly timestamp: number;
  /** Which domain produced this event. */
  readonly domain: EventDomain;
  /** Event type within the domain (e.g., 'pin_change', 'node_add', 'data_received'). */
  readonly type: string;
  /** Arbitrary payload specific to the event type. */
  readonly data: Record<string, unknown>;
}

/** A named bookmark at a specific time. */
export interface Bookmark {
  /** Auto-assigned monotonic ID. */
  readonly id: number;
  /** Timestamp this bookmark points to. */
  readonly timestamp: number;
  /** Human-readable label. */
  readonly label: string;
  /** Optional domain filter. */
  readonly domain?: EventDomain;
}

/** Playback state. */
export type PlaybackState = 'idle' | 'recording' | 'playing' | 'paused' | 'seeking';

/** Playback speed multiplier options. */
export type PlaybackSpeed = 0.25 | 0.5 | 1 | 2 | 4 | 8 | 16;

/** Snapshot of state at a point in time. */
export interface StateSnapshot {
  /** Timestamp this snapshot represents. */
  readonly timestamp: number;
  /** Domain-keyed state at this point. */
  readonly states: Record<EventDomain, Record<string, unknown>>;
}

/** Configuration for the time machine. */
export interface TimeMachineConfig {
  /** Maximum events in the ring buffer (default 100000). */
  maxEvents?: number;
  /** How often to auto-snapshot during recording, in ms (default 5000). */
  snapshotIntervalMs?: number;
}

/** Domain filter for querying events. */
export interface EventFilter {
  /** Filter by domain(s). */
  domains?: EventDomain[];
  /** Filter by event type(s). */
  types?: string[];
  /** Start timestamp (inclusive). */
  startTime?: number;
  /** End timestamp (inclusive). */
  endTime?: number;
}

/** Export format for time machine sessions. */
export interface TimeMachineExport {
  readonly version: 1;
  readonly exportedAt: string;
  readonly duration: number;
  readonly eventCount: number;
  readonly events: TimelineEvent[];
  readonly bookmarks: Bookmark[];
  readonly snapshots: StateSnapshot[];
}

/** Snapshot of the time machine state for subscribers. */
export interface TimeMachineSnapshot {
  readonly state: PlaybackState;
  readonly currentTime: number;
  readonly duration: number;
  readonly eventCount: number;
  readonly speed: PlaybackSpeed;
  readonly bookmarks: readonly Bookmark[];
  readonly isRecording: boolean;
  readonly isPlaying: boolean;
  readonly domainStats: Record<EventDomain, number>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MAX_EVENTS = 100_000;
const DEFAULT_SNAPSHOT_INTERVAL_MS = 5000;
const ALL_DOMAINS: EventDomain[] = ['firmware', 'serial', 'schematic', 'telemetry', 'user'];
const VALID_SPEEDS: PlaybackSpeed[] = [0.25, 0.5, 1, 2, 4, 8, 16];

// ---------------------------------------------------------------------------
// TimeMachineManager — Singleton
// ---------------------------------------------------------------------------

export class TimeMachineManager {
  private static instance: TimeMachineManager | null = null;

  // Subscriber pattern
  private subscribers = new Set<Listener>();

  // Configuration
  private _maxEvents: number = DEFAULT_MAX_EVENTS;
  private _snapshotIntervalMs: number = DEFAULT_SNAPSHOT_INTERVAL_MS;

  // Ring buffer for events
  private _events: TimelineEvent[] = [];
  private _nextEventId = 1;

  // Bookmarks
  private _bookmarks: Bookmark[] = [];
  private _nextBookmarkId = 1;

  // Snapshots (periodic state captures for fast seek)
  private _snapshots: StateSnapshot[] = [];

  // State
  private _state: PlaybackState = 'idle';
  private _currentTime = 0;
  private _recordingStartTime = 0;
  private _speed: PlaybackSpeed = 1;

  // Domain event counts
  private _domainCounts: Record<EventDomain, number> = {
    firmware: 0,
    serial: 0,
    schematic: 0,
    telemetry: 0,
    user: 0,
  };

  // Playback timer
  private _playbackTimer: ReturnType<typeof setInterval> | null = null;
  private _playbackStartWallTime = 0;
  private _playbackStartSimTime = 0;

  private constructor() {
    // private — use getInstance()
  }

  static getInstance(): TimeMachineManager {
    if (!TimeMachineManager.instance) {
      TimeMachineManager.instance = new TimeMachineManager();
    }
    return TimeMachineManager.instance;
  }

  /** Reset singleton (for testing). */
  static resetInstance(): void {
    if (TimeMachineManager.instance) {
      TimeMachineManager.instance.destroy();
      TimeMachineManager.instance = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Subscribe
  // ---------------------------------------------------------------------------

  subscribe(listener: Listener): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  private notify(): void {
    this.subscribers.forEach((fn) => fn());
  }

  // ---------------------------------------------------------------------------
  // Snapshot (for React)
  // ---------------------------------------------------------------------------

  getSnapshot(): TimeMachineSnapshot {
    return {
      state: this._state,
      currentTime: this._currentTime,
      duration: this.duration,
      eventCount: this._events.length,
      speed: this._speed,
      bookmarks: [...this._bookmarks],
      isRecording: this._state === 'recording',
      isPlaying: this._state === 'playing',
      domainStats: { ...this._domainCounts },
    };
  }

  // ---------------------------------------------------------------------------
  // Recording
  // ---------------------------------------------------------------------------

  /** Start recording events. Clears any previous recording. */
  startRecording(config?: TimeMachineConfig): void {
    this.stopPlayback();

    this._maxEvents = config?.maxEvents ?? DEFAULT_MAX_EVENTS;
    this._snapshotIntervalMs = config?.snapshotIntervalMs ?? DEFAULT_SNAPSHOT_INTERVAL_MS;

    this._events = [];
    this._bookmarks = [];
    this._snapshots = [];
    this._nextEventId = 1;
    this._nextBookmarkId = 1;
    this._currentTime = 0;
    this._recordingStartTime = Date.now();
    this._speed = 1;
    this._domainCounts = {
      firmware: 0,
      serial: 0,
      schematic: 0,
      telemetry: 0,
      user: 0,
    };

    this._state = 'recording';
    this.notify();
  }

  /** Stop recording. Transitions to idle. */
  stopRecording(): void {
    if (this._state !== 'recording') {
      return;
    }
    this._state = 'idle';
    this.notify();
  }

  /** Record an event during an active recording session. */
  recordEvent(domain: EventDomain, type: string, data: Record<string, unknown> = {}): TimelineEvent | null {
    if (this._state !== 'recording') {
      return null;
    }

    if (!ALL_DOMAINS.includes(domain)) {
      return null;
    }

    const timestamp = Date.now() - this._recordingStartTime;

    const event: TimelineEvent = {
      id: this._nextEventId++,
      timestamp,
      domain,
      type,
      data: { ...data },
    };

    // Ring buffer: evict oldest if at capacity
    if (this._events.length >= this._maxEvents) {
      const evicted = this._events.shift();
      if (evicted) {
        this._domainCounts[evicted.domain] = Math.max(0, this._domainCounts[evicted.domain] - 1);
      }
    }

    this._events.push(event);
    this._domainCounts[domain]++;
    this._currentTime = timestamp;

    // Auto-snapshot at intervals
    if (this._snapshots.length === 0 ||
        timestamp - this._snapshots[this._snapshots.length - 1].timestamp >= this._snapshotIntervalMs) {
      this.captureSnapshot(timestamp);
    }

    this.notify();
    return event;
  }

  /** Record an event with an explicit timestamp (for importing or replaying). */
  recordEventAt(timestamp: number, domain: EventDomain, type: string, data: Record<string, unknown> = {}): TimelineEvent | null {
    if (this._state !== 'recording') {
      return null;
    }

    if (!ALL_DOMAINS.includes(domain)) {
      return null;
    }

    const event: TimelineEvent = {
      id: this._nextEventId++,
      timestamp,
      domain,
      type,
      data: { ...data },
    };

    // Ring buffer: evict oldest if at capacity
    if (this._events.length >= this._maxEvents) {
      const evicted = this._events.shift();
      if (evicted) {
        this._domainCounts[evicted.domain] = Math.max(0, this._domainCounts[evicted.domain] - 1);
      }
    }

    this._events.push(event);
    this._domainCounts[domain]++;
    this._currentTime = Math.max(this._currentTime, timestamp);

    this.notify();
    return event;
  }

  // ---------------------------------------------------------------------------
  // Playback Controls
  // ---------------------------------------------------------------------------

  /** Start playback from the current time position. */
  play(): void {
    if (this._events.length === 0) {
      return;
    }
    if (this._state === 'recording') {
      return;
    }

    this._state = 'playing';
    this._playbackStartWallTime = Date.now();
    this._playbackStartSimTime = this._currentTime;

    this.startPlaybackLoop();
    this.notify();
  }

  /** Pause playback. */
  pause(): void {
    if (this._state !== 'playing') {
      return;
    }

    this.stopPlaybackLoop();
    this._state = 'paused';
    this.notify();
  }

  /** Seek to a specific timestamp. */
  seek(timestamp: number): void {
    if (this._state === 'recording') {
      return;
    }
    if (this._events.length === 0) {
      return;
    }

    const prevState = this._state;
    this._state = 'seeking';

    const clamped = Math.max(0, Math.min(timestamp, this.duration));
    this._currentTime = clamped;

    // If we were playing, restart the playback timer from the new position
    if (prevState === 'playing') {
      this.stopPlaybackLoop();
      this._state = 'playing';
      this._playbackStartWallTime = Date.now();
      this._playbackStartSimTime = clamped;
      this.startPlaybackLoop();
    } else {
      this._state = prevState === 'idle' ? 'paused' : prevState;
    }

    this.notify();
  }

  /** Set playback speed. */
  setSpeed(speed: PlaybackSpeed): void {
    if (!VALID_SPEEDS.includes(speed)) {
      return;
    }

    const wasPlaying = this._state === 'playing';

    if (wasPlaying) {
      // Update anchor points so position stays continuous
      this._playbackStartSimTime = this._currentTime;
      this._playbackStartWallTime = Date.now();
    }

    this._speed = speed;
    this.notify();
  }

  /** Stop playback and reset to beginning. */
  stop(): void {
    this.stopPlaybackLoop();
    this._currentTime = 0;
    this._state = this._events.length > 0 ? 'paused' : 'idle';
    this.notify();
  }

  // ---------------------------------------------------------------------------
  // Bookmarks
  // ---------------------------------------------------------------------------

  /** Add a bookmark at the specified timestamp (or current time). */
  addBookmark(label: string, timestamp?: number, domain?: EventDomain): Bookmark {
    const ts = timestamp ?? this._currentTime;
    const bookmark: Bookmark = {
      id: this._nextBookmarkId++,
      timestamp: ts,
      label,
      domain,
    };
    this._bookmarks.push(bookmark);
    this._bookmarks.sort((a, b) => a.timestamp - b.timestamp);
    this.notify();
    return bookmark;
  }

  /** Remove a bookmark by ID. */
  removeBookmark(id: number): boolean {
    const idx = this._bookmarks.findIndex((b) => b.id === id);
    if (idx === -1) {
      return false;
    }
    this._bookmarks.splice(idx, 1);
    this.notify();
    return true;
  }

  /** Get all bookmarks. */
  getBookmarks(): readonly Bookmark[] {
    return [...this._bookmarks];
  }

  /** Seek to a bookmark by ID. */
  seekToBookmark(id: number): boolean {
    const bm = this._bookmarks.find((b) => b.id === id);
    if (!bm) {
      return false;
    }
    this.seek(bm.timestamp);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Event Queries
  // ---------------------------------------------------------------------------

  /** Get all events matching the filter. */
  getEvents(filter?: EventFilter): TimelineEvent[] {
    if (!filter) {
      return [...this._events];
    }

    return this._events.filter((e) => {
      if (filter.domains && filter.domains.length > 0 && !filter.domains.includes(e.domain)) {
        return false;
      }
      if (filter.types && filter.types.length > 0 && !filter.types.includes(e.type)) {
        return false;
      }
      if (filter.startTime !== undefined && e.timestamp < filter.startTime) {
        return false;
      }
      if (filter.endTime !== undefined && e.timestamp > filter.endTime) {
        return false;
      }
      return true;
    });
  }

  /** Get events up to the current playback time. */
  getEventsUpToCurrent(filter?: EventFilter): TimelineEvent[] {
    const baseFilter: EventFilter = {
      ...filter,
      endTime: this._currentTime,
    };
    return this.getEvents(baseFilter);
  }

  /** Get events at the exact current time (within tolerance). */
  getEventsAtTime(timestamp: number, toleranceMs = 0): TimelineEvent[] {
    return this._events.filter(
      (e) => e.timestamp >= timestamp - toleranceMs && e.timestamp <= timestamp + toleranceMs,
    );
  }

  /** Get the event count per domain. */
  getDomainStats(): Record<EventDomain, number> {
    return { ...this._domainCounts };
  }

  // ---------------------------------------------------------------------------
  // State Reconstruction
  // ---------------------------------------------------------------------------

  /** Reconstruct the state at a given timestamp by replaying events. */
  reconstructState(timestamp: number): StateSnapshot {
    // Find the nearest snapshot before the target time
    let baseSnapshot: StateSnapshot | null = null;
    for (let i = this._snapshots.length - 1; i >= 0; i--) {
      if (this._snapshots[i].timestamp <= timestamp) {
        baseSnapshot = this._snapshots[i];
        break;
      }
    }

    // Build initial state from snapshot or empty
    const states: Record<EventDomain, Record<string, unknown>> = {
      firmware: {},
      serial: {},
      schematic: {},
      telemetry: {},
      user: {},
    };

    const startTime = baseSnapshot ? baseSnapshot.timestamp : 0;

    if (baseSnapshot) {
      ALL_DOMAINS.forEach((domain) => {
        states[domain] = { ...baseSnapshot!.states[domain] };
      });
    }

    // Replay events from startTime to timestamp
    const eventsToReplay = this._events.filter(
      (e) => e.timestamp > startTime && e.timestamp <= timestamp,
    );

    eventsToReplay.forEach((event) => {
      // Merge event data into domain state
      const domainState = states[event.domain];
      domainState[`last_${event.type}`] = event.data;
      domainState[`last_${event.type}_time`] = event.timestamp;

      // Track event count per type
      const countKey = `${event.type}_count`;
      const prevCount = (domainState[countKey] as number | undefined) ?? 0;
      domainState[countKey] = prevCount + 1;
    });

    return {
      timestamp,
      states,
    };
  }

  /** Manually capture a state snapshot at the given timestamp. */
  captureSnapshot(timestamp?: number): StateSnapshot {
    const ts = timestamp ?? this._currentTime;
    const snapshot = this.reconstructState(ts);
    this._snapshots.push(snapshot);
    this._snapshots.sort((a, b) => a.timestamp - b.timestamp);
    return snapshot;
  }

  // ---------------------------------------------------------------------------
  // Import / Export
  // ---------------------------------------------------------------------------

  /** Export the current recording session. */
  exportSession(): TimeMachineExport {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      duration: this.duration,
      eventCount: this._events.length,
      events: [...this._events],
      bookmarks: [...this._bookmarks],
      snapshots: [...this._snapshots],
    };
  }

  /** Import a previously exported session. Replaces current state. */
  importSession(data: TimeMachineExport): boolean {
    if (this._state === 'recording' || this._state === 'playing') {
      return false;
    }

    if (!data || data.version !== 1 || !Array.isArray(data.events)) {
      return false;
    }

    this.stopPlaybackLoop();

    this._events = data.events.map((e) => ({
      id: e.id,
      timestamp: e.timestamp,
      domain: e.domain,
      type: e.type,
      data: { ...e.data },
    }));

    this._bookmarks = (data.bookmarks ?? []).map((b) => ({
      id: b.id,
      timestamp: b.timestamp,
      label: b.label,
      domain: b.domain,
    }));

    this._snapshots = (data.snapshots ?? []).map((s) => ({
      timestamp: s.timestamp,
      states: { ...s.states },
    }));

    // Rebuild domain counts
    this._domainCounts = { firmware: 0, serial: 0, schematic: 0, telemetry: 0, user: 0 };
    this._events.forEach((e) => {
      if (ALL_DOMAINS.includes(e.domain)) {
        this._domainCounts[e.domain]++;
      }
    });

    // Set IDs past the max imported ID
    this._nextEventId = this._events.reduce((max, e) => Math.max(max, e.id), 0) + 1;
    this._nextBookmarkId = this._bookmarks.reduce((max, b) => Math.max(max, b.id), 0) + 1;

    this._currentTime = 0;
    this._speed = 1;
    this._state = this._events.length > 0 ? 'paused' : 'idle';

    this.notify();
    return true;
  }

  // ---------------------------------------------------------------------------
  // Accessors
  // ---------------------------------------------------------------------------

  /** Get the total duration of the recording in ms. */
  get duration(): number {
    if (this._events.length === 0) {
      return 0;
    }
    return this._events[this._events.length - 1].timestamp;
  }

  /** Get the current playback time. */
  get currentTime(): number {
    return this._currentTime;
  }

  /** Get the current state. */
  get state(): PlaybackState {
    return this._state;
  }

  /** Get the current playback speed. */
  get speed(): PlaybackSpeed {
    return this._speed;
  }

  /** Get the number of recorded events. */
  get eventCount(): number {
    return this._events.length;
  }

  // ---------------------------------------------------------------------------
  // Private — Playback Loop
  // ---------------------------------------------------------------------------

  private startPlaybackLoop(): void {
    this.stopPlaybackLoop();

    const TICK_INTERVAL = 16; // ~60fps

    this._playbackTimer = setInterval(() => {
      if (this._state !== 'playing') {
        this.stopPlaybackLoop();
        return;
      }

      const wallElapsed = Date.now() - this._playbackStartWallTime;
      const simElapsed = wallElapsed * this._speed;
      const newTime = this._playbackStartSimTime + simElapsed;

      if (newTime >= this.duration) {
        this._currentTime = this.duration;
        this.stopPlaybackLoop();
        this._state = 'paused';
        this.notify();
        return;
      }

      this._currentTime = newTime;
      this.notify();
    }, TICK_INTERVAL);
  }

  private stopPlaybackLoop(): void {
    if (this._playbackTimer !== null) {
      clearInterval(this._playbackTimer);
      this._playbackTimer = null;
    }
  }

  private stopPlayback(): void {
    this.stopPlaybackLoop();
    if (this._state === 'playing') {
      this._state = 'paused';
    }
  }

  /** Clean up resources. */
  destroy(): void {
    this.stopPlaybackLoop();
    this.subscribers.clear();
  }

  /** Full reset to idle with no data. */
  clear(): void {
    this.stopPlaybackLoop();
    this._events = [];
    this._bookmarks = [];
    this._snapshots = [];
    this._nextEventId = 1;
    this._nextBookmarkId = 1;
    this._currentTime = 0;
    this._speed = 1;
    this._domainCounts = { firmware: 0, serial: 0, schematic: 0, telemetry: 0, user: 0 };
    this._state = 'idle';
    this.notify();
  }
}

// ---------------------------------------------------------------------------
// Convenience singleton accessor
// ---------------------------------------------------------------------------

export function getTimeMachineManager(): TimeMachineManager {
  return TimeMachineManager.getInstance();
}
