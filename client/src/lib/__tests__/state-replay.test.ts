import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { StateReplayEngine } from '../state-replay';
import type {
  ReplayFrame,
  ReplaySnapshot,
  ReconstructedState,
  ReplayExportData,
  PlaybackSpeed,
  PinState,
} from '../state-replay';

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function makeFrame(overrides: Partial<Omit<ReplayFrame, 'index'>> = {}): Omit<ReplayFrame, 'index'> {
  return {
    timestampMs: 0,
    serialOutput: '',
    codeLine: 0,
    pinStates: [],
    ...overrides,
  };
}

function makePin(pin: string, value: number, mode: PinState['mode'] = 'output'): PinState {
  return { pin, mode, value };
}

function recordNFrames(engine: StateReplayEngine, n: number, intervalMs = 100): void {
  for (let i = 0; i < n; i++) {
    engine.recordFrame(makeFrame({ timestampMs: i * intervalMs, serialOutput: `line${String(i)}`, codeLine: i + 1 }));
  }
}

// ──────────────────────────────────────────────────────────────────
// Singleton
// ──────────────────────────────────────────────────────────────────

describe('StateReplayEngine — singleton', () => {
  it('returns the same instance from getInstance()', () => {
    const a = StateReplayEngine.getInstance();
    const b = StateReplayEngine.getInstance();
    expect(a).toBe(b);
  });

  it('create() returns a fresh non-singleton instance', () => {
    const a = StateReplayEngine.create();
    const b = StateReplayEngine.create();
    expect(a).not.toBe(b);
  });
});

// ──────────────────────────────────────────────────────────────────
// Recording
// ──────────────────────────────────────────────────────────────────

describe('StateReplayEngine — recording', () => {
  let engine: StateReplayEngine;

  beforeEach(() => {
    engine = StateReplayEngine.create();
  });

  it('starts with zero frames', () => {
    expect(engine.getTotalFrames()).toBe(0);
  });

  it('records a frame and increments total', () => {
    engine.recordFrame(makeFrame({ timestampMs: 0 }));
    expect(engine.getTotalFrames()).toBe(1);
  });

  it('assigns sequential indices to frames', () => {
    engine.recordFrame(makeFrame({ timestampMs: 0 }));
    engine.recordFrame(makeFrame({ timestampMs: 100 }));
    engine.recordFrame(makeFrame({ timestampMs: 200 }));

    expect(engine.getFrame(0)?.index).toBe(0);
    expect(engine.getFrame(1)?.index).toBe(1);
    expect(engine.getFrame(2)?.index).toBe(2);
  });

  it('getFrame returns null for out-of-range index', () => {
    engine.recordFrame(makeFrame({ timestampMs: 0 }));
    expect(engine.getFrame(-1)).toBeNull();
    expect(engine.getFrame(1)).toBeNull();
  });

  it('getAllFrames returns a copy of all frames', () => {
    recordNFrames(engine, 3);
    const all = engine.getAllFrames();
    expect(all).toHaveLength(3);
    // Verify it is a copy
    all.pop();
    expect(engine.getTotalFrames()).toBe(3);
  });

  it('recording sets current frame to the latest', () => {
    recordNFrames(engine, 5);
    expect(engine.getCurrentFrameIndex()).toBe(4);
  });

  it('clear() removes all frames and resets state', () => {
    recordNFrames(engine, 5);
    engine.addMarker(2, 'test');
    engine.clear();
    expect(engine.getTotalFrames()).toBe(0);
    expect(engine.getCurrentFrameIndex()).toBe(0);
    expect(engine.getMarkers()).toHaveLength(0);
    expect(engine.getPlaybackState()).toBe('stopped');
  });
});

// ──────────────────────────────────────────────────────────────────
// Subscription
// ──────────────────────────────────────────────────────────────────

describe('StateReplayEngine — subscription', () => {
  let engine: StateReplayEngine;

  beforeEach(() => {
    engine = StateReplayEngine.create();
  });

  it('notifies listeners on recordFrame', () => {
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.recordFrame(makeFrame({ timestampMs: 0 }));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe stops notifications', () => {
    const listener = vi.fn();
    const unsub = engine.subscribe(listener);
    unsub();
    engine.recordFrame(makeFrame({ timestampMs: 0 }));
    expect(listener).not.toHaveBeenCalled();
  });

  it('getSnapshot returns cached snapshot on repeated calls', () => {
    recordNFrames(engine, 3);
    const s1 = engine.getSnapshot();
    const s2 = engine.getSnapshot();
    expect(s1).toBe(s2); // Same reference
  });

  it('getSnapshot returns new object after state change', () => {
    recordNFrames(engine, 3);
    const s1 = engine.getSnapshot();
    engine.seek(0);
    const s2 = engine.getSnapshot();
    expect(s1).not.toBe(s2);
  });
});

// ──────────────────────────────────────────────────────────────────
// Playback — play/pause/stop
// ──────────────────────────────────────────────────────────────────

describe('StateReplayEngine — play/pause/stop', () => {
  let engine: StateReplayEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    engine = StateReplayEngine.create();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('play() does nothing on empty recording', () => {
    engine.play();
    expect(engine.getPlaybackState()).toBe('stopped');
  });

  it('play() starts playback', () => {
    recordNFrames(engine, 5);
    engine.seek(0);
    engine.play();
    expect(engine.getPlaybackState()).toBe('playing');
  });

  it('pause() pauses playback', () => {
    recordNFrames(engine, 5);
    engine.seek(0);
    engine.play();
    engine.pause();
    expect(engine.getPlaybackState()).toBe('paused');
  });

  it('stop() resets to frame 0', () => {
    recordNFrames(engine, 5);
    engine.seek(3);
    engine.play();
    engine.stop();
    expect(engine.getPlaybackState()).toBe('stopped');
    expect(engine.getCurrentFrameIndex()).toBe(0);
  });

  it('togglePlayPause() toggles between play and pause', () => {
    recordNFrames(engine, 5);
    engine.seek(0);
    engine.togglePlayPause();
    expect(engine.getPlaybackState()).toBe('playing');
    engine.togglePlayPause();
    expect(engine.getPlaybackState()).toBe('paused');
  });

  it('play() advances frames over time', () => {
    recordNFrames(engine, 5, 100);
    engine.seek(0);
    engine.play();

    // Advance past the first interval (100ms at 1x speed)
    vi.advanceTimersByTime(101);
    expect(engine.getCurrentFrameIndex()).toBe(1);

    vi.advanceTimersByTime(100);
    expect(engine.getCurrentFrameIndex()).toBe(2);
  });

  it('playback stops at end without loop', () => {
    recordNFrames(engine, 3, 100);
    engine.seek(0);
    engine.play();

    vi.advanceTimersByTime(300);
    expect(engine.getCurrentFrameIndex()).toBe(2);
    expect(engine.getPlaybackState()).toBe('stopped');
  });

  it('playback loops when loop is enabled', () => {
    recordNFrames(engine, 3, 100);
    engine.seek(0);
    engine.setLoop(true);
    engine.play();

    // Advance through all 3 frames and wrap
    vi.advanceTimersByTime(100); // frame 1
    vi.advanceTimersByTime(100); // frame 2
    vi.advanceTimersByTime(100); // wraps to frame 0
    expect(engine.getCurrentFrameIndex()).toBe(0);
    expect(engine.getPlaybackState()).toBe('playing');
  });

  it('play() at end without loop restarts from beginning', () => {
    recordNFrames(engine, 3, 100);
    // currentFrame is at 2 (last) after recording
    engine.play();
    expect(engine.getCurrentFrameIndex()).toBe(0);
    expect(engine.getPlaybackState()).toBe('playing');
  });

  it('recording during playback stops playback', () => {
    recordNFrames(engine, 3, 100);
    engine.seek(0);
    engine.play();
    expect(engine.getPlaybackState()).toBe('playing');

    engine.recordFrame(makeFrame({ timestampMs: 300 }));
    expect(engine.getPlaybackState()).toBe('stopped');
  });
});

// ──────────────────────────────────────────────────────────────────
// Seek and step
// ──────────────────────────────────────────────────────────────────

describe('StateReplayEngine — seek/step', () => {
  let engine: StateReplayEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    engine = StateReplayEngine.create();
    recordNFrames(engine, 10, 100);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('seek() clamps to valid range', () => {
    engine.seek(-5);
    expect(engine.getCurrentFrameIndex()).toBe(0);

    engine.seek(999);
    expect(engine.getCurrentFrameIndex()).toBe(9);
  });

  it('seek() does nothing if already at target frame', () => {
    const listener = vi.fn();
    engine.seek(5);
    engine.subscribe(listener);
    engine.seek(5);
    expect(listener).not.toHaveBeenCalled();
  });

  it('seek() does nothing on empty recording', () => {
    const empty = StateReplayEngine.create();
    empty.seek(5);
    expect(empty.getCurrentFrameIndex()).toBe(0);
  });

  it('stepForward() advances by one frame', () => {
    engine.seek(3);
    engine.stepForward();
    expect(engine.getCurrentFrameIndex()).toBe(4);
  });

  it('stepForward() stays at last frame without loop', () => {
    engine.seek(9);
    engine.stepForward();
    expect(engine.getCurrentFrameIndex()).toBe(9);
  });

  it('stepForward() wraps to 0 with loop', () => {
    engine.setLoop(true);
    engine.seek(9);
    engine.stepForward();
    expect(engine.getCurrentFrameIndex()).toBe(0);
  });

  it('stepBackward() goes back one frame', () => {
    engine.seek(5);
    engine.stepBackward();
    expect(engine.getCurrentFrameIndex()).toBe(4);
  });

  it('stepBackward() stays at 0 without loop', () => {
    engine.seek(0);
    engine.stepBackward();
    expect(engine.getCurrentFrameIndex()).toBe(0);
  });

  it('stepBackward() wraps to last frame with loop', () => {
    engine.setLoop(true);
    engine.seek(0);
    engine.stepBackward();
    expect(engine.getCurrentFrameIndex()).toBe(9);
  });

  it('stepForward() pauses active playback', () => {
    engine.seek(0);
    engine.play();
    expect(engine.getPlaybackState()).toBe('playing');
    engine.stepForward();
    expect(engine.getPlaybackState()).toBe('paused');
  });

  it('stepBackward() pauses active playback', () => {
    engine.seek(5);
    engine.play();
    engine.stepBackward();
    expect(engine.getPlaybackState()).toBe('paused');
  });

  it('stepForward() on empty does nothing', () => {
    const empty = StateReplayEngine.create();
    empty.stepForward();
    expect(empty.getCurrentFrameIndex()).toBe(0);
  });

  it('stepBackward() on empty does nothing', () => {
    const empty = StateReplayEngine.create();
    empty.stepBackward();
    expect(empty.getCurrentFrameIndex()).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// Speed
// ──────────────────────────────────────────────────────────────────

describe('StateReplayEngine — speed', () => {
  let engine: StateReplayEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    engine = StateReplayEngine.create();
    recordNFrames(engine, 5, 200);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('default speed is 1', () => {
    expect(engine.getSpeed()).toBe(1);
  });

  it('setSpeed() changes the playback speed', () => {
    engine.setSpeed(2);
    expect(engine.getSpeed()).toBe(2);
  });

  it('ignores invalid speed values', () => {
    engine.setSpeed(3 as PlaybackSpeed);
    expect(engine.getSpeed()).toBe(1);
  });

  it('2x speed advances frames twice as fast', () => {
    engine.seek(0);
    engine.setSpeed(2);
    engine.play();

    // At 2x, 200ms interval becomes 100ms
    vi.advanceTimersByTime(101);
    expect(engine.getCurrentFrameIndex()).toBe(1);
  });

  it('0.5x speed advances frames at half pace', () => {
    engine.seek(0);
    engine.setSpeed(0.5);
    engine.play();

    // At 0.5x, 200ms interval becomes 400ms
    vi.advanceTimersByTime(200);
    expect(engine.getCurrentFrameIndex()).toBe(0);
    vi.advanceTimersByTime(201);
    expect(engine.getCurrentFrameIndex()).toBe(1);
  });

  it('setSpeed does nothing if speed unchanged', () => {
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.setSpeed(1);
    expect(listener).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────
// Loop
// ──────────────────────────────────────────────────────────────────

describe('StateReplayEngine — loop', () => {
  let engine: StateReplayEngine;

  beforeEach(() => {
    engine = StateReplayEngine.create();
  });

  it('defaults to loop disabled', () => {
    expect(engine.isLooping()).toBe(false);
  });

  it('setLoop enables/disables looping', () => {
    engine.setLoop(true);
    expect(engine.isLooping()).toBe(true);
    engine.setLoop(false);
    expect(engine.isLooping()).toBe(false);
  });

  it('setLoop does nothing if already set', () => {
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.setLoop(false);
    expect(listener).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────
// Markers
// ──────────────────────────────────────────────────────────────────

describe('StateReplayEngine — markers', () => {
  let engine: StateReplayEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    engine = StateReplayEngine.create();
    recordNFrames(engine, 10, 100);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('addMarker creates a marker with unique ID', () => {
    const id1 = engine.addMarker(0, 'Start');
    const id2 = engine.addMarker(5, 'Middle');
    expect(id1).not.toBe(id2);
    expect(engine.getMarkers()).toHaveLength(2);
  });

  it('addMarker stores label and color', () => {
    engine.addMarker(3, 'Important', '#ff0000');
    const markers = engine.getMarkers();
    expect(markers[0].label).toBe('Important');
    expect(markers[0].color).toBe('#ff0000');
    expect(markers[0].frameIndex).toBe(3);
  });

  it('addMarker throws for out-of-range frame index', () => {
    expect(() => engine.addMarker(-1, 'bad')).toThrow();
    expect(() => engine.addMarker(10, 'bad')).toThrow();
  });

  it('removeMarker removes by ID', () => {
    const id = engine.addMarker(0, 'test');
    expect(engine.removeMarker(id)).toBe(true);
    expect(engine.getMarkers()).toHaveLength(0);
  });

  it('removeMarker returns false for unknown ID', () => {
    expect(engine.removeMarker('nonexistent')).toBe(false);
  });

  it('getMarkers returns a copy', () => {
    engine.addMarker(0, 'test');
    const markers = engine.getMarkers();
    markers.pop();
    expect(engine.getMarkers()).toHaveLength(1);
  });

  it('seekToNextMarker jumps to the next marker', () => {
    engine.addMarker(2, 'A');
    engine.addMarker(7, 'B');
    engine.seek(0);
    engine.seekToNextMarker();
    expect(engine.getCurrentFrameIndex()).toBe(2);
    engine.seekToNextMarker();
    expect(engine.getCurrentFrameIndex()).toBe(7);
  });

  it('seekToNextMarker does nothing past last marker without loop', () => {
    engine.addMarker(2, 'A');
    engine.seek(5);
    engine.seekToNextMarker();
    expect(engine.getCurrentFrameIndex()).toBe(5);
  });

  it('seekToNextMarker wraps with loop', () => {
    engine.addMarker(2, 'A');
    engine.addMarker(7, 'B');
    engine.setLoop(true);
    engine.seek(8);
    engine.seekToNextMarker();
    expect(engine.getCurrentFrameIndex()).toBe(2);
  });

  it('seekToPreviousMarker jumps backward', () => {
    engine.addMarker(2, 'A');
    engine.addMarker(7, 'B');
    engine.seek(9);
    engine.seekToPreviousMarker();
    expect(engine.getCurrentFrameIndex()).toBe(7);
    engine.seekToPreviousMarker();
    expect(engine.getCurrentFrameIndex()).toBe(2);
  });

  it('seekToPreviousMarker does nothing before first marker without loop', () => {
    engine.addMarker(5, 'A');
    engine.seek(3);
    engine.seekToPreviousMarker();
    expect(engine.getCurrentFrameIndex()).toBe(3);
  });

  it('seekToPreviousMarker wraps with loop', () => {
    engine.addMarker(2, 'A');
    engine.addMarker(7, 'B');
    engine.setLoop(true);
    engine.seek(1);
    engine.seekToPreviousMarker();
    expect(engine.getCurrentFrameIndex()).toBe(7);
  });

  it('seekToNextMarker does nothing with no markers', () => {
    engine.seek(3);
    engine.seekToNextMarker();
    expect(engine.getCurrentFrameIndex()).toBe(3);
  });

  it('seekToPreviousMarker does nothing with no markers', () => {
    engine.seek(3);
    engine.seekToPreviousMarker();
    expect(engine.getCurrentFrameIndex()).toBe(3);
  });
});

// ──────────────────────────────────────────────────────────────────
// State reconstruction — serial output
// ──────────────────────────────────────────────────────────────────

describe('StateReplayEngine — serial output accumulation', () => {
  let engine: StateReplayEngine;

  beforeEach(() => {
    engine = StateReplayEngine.create();
  });

  it('accumulates serial output from frame 0 to current', () => {
    engine.recordFrame(makeFrame({ timestampMs: 0, serialOutput: 'Hello' }));
    engine.recordFrame(makeFrame({ timestampMs: 100, serialOutput: 'World' }));
    engine.recordFrame(makeFrame({ timestampMs: 200, serialOutput: '' }));
    engine.recordFrame(makeFrame({ timestampMs: 300, serialOutput: 'Done' }));

    engine.seek(3);
    const state = engine.getReconstructedState();
    expect(state.serialLines).toEqual(['Hello', 'World', 'Done']);
    expect(state.serialAccumulated).toBe('Hello\nWorld\nDone');
  });

  it('serial at frame 0 shows only first line', () => {
    engine.recordFrame(makeFrame({ timestampMs: 0, serialOutput: 'First' }));
    engine.recordFrame(makeFrame({ timestampMs: 100, serialOutput: 'Second' }));
    engine.seek(0);
    const state = engine.getReconstructedState();
    expect(state.serialLines).toEqual(['First']);
  });

  it('empty serial output is not accumulated', () => {
    engine.recordFrame(makeFrame({ timestampMs: 0, serialOutput: '' }));
    engine.recordFrame(makeFrame({ timestampMs: 100, serialOutput: '' }));
    engine.seek(1);
    const state = engine.getReconstructedState();
    expect(state.serialLines).toHaveLength(0);
    expect(state.serialAccumulated).toBe('');
  });
});

// ──────────────────────────────────────────────────────────────────
// State reconstruction — code line
// ──────────────────────────────────────────────────────────────────

describe('StateReplayEngine — code line highlighting', () => {
  let engine: StateReplayEngine;

  beforeEach(() => {
    engine = StateReplayEngine.create();
  });

  it('tracks the latest code line up to current frame', () => {
    engine.recordFrame(makeFrame({ timestampMs: 0, codeLine: 5 }));
    engine.recordFrame(makeFrame({ timestampMs: 100, codeLine: 10 }));
    engine.recordFrame(makeFrame({ timestampMs: 200, codeLine: 15 }));

    engine.seek(1);
    expect(engine.getReconstructedState().currentCodeLine).toBe(10);
  });

  it('codeLine 0 means unknown — uses last known', () => {
    engine.recordFrame(makeFrame({ timestampMs: 0, codeLine: 5 }));
    engine.recordFrame(makeFrame({ timestampMs: 100, codeLine: 0 }));
    engine.seek(1);
    expect(engine.getReconstructedState().currentCodeLine).toBe(5);
  });

  it('defaults to 0 if no code line ever set', () => {
    engine.recordFrame(makeFrame({ timestampMs: 0, codeLine: 0 }));
    engine.seek(0);
    expect(engine.getReconstructedState().currentCodeLine).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// State reconstruction — pin states
// ──────────────────────────────────────────────────────────────────

describe('StateReplayEngine — pin state reconstruction', () => {
  let engine: StateReplayEngine;

  beforeEach(() => {
    engine = StateReplayEngine.create();
  });

  it('accumulates pin states across frames', () => {
    engine.recordFrame(makeFrame({
      timestampMs: 0,
      pinStates: [makePin('D13', 1), makePin('D12', 0)],
    }));
    engine.recordFrame(makeFrame({
      timestampMs: 100,
      pinStates: [makePin('A0', 512, 'analog')],
    }));

    engine.seek(1);
    const state = engine.getReconstructedState();
    expect(state.pinStates.size).toBe(3);
    expect(state.pinStates.get('D13')?.value).toBe(1);
    expect(state.pinStates.get('D12')?.value).toBe(0);
    expect(state.pinStates.get('A0')?.value).toBe(512);
  });

  it('later frames override earlier pin states', () => {
    engine.recordFrame(makeFrame({
      timestampMs: 0,
      pinStates: [makePin('D13', 1)],
    }));
    engine.recordFrame(makeFrame({
      timestampMs: 100,
      pinStates: [makePin('D13', 0)],
    }));

    engine.seek(1);
    expect(engine.getReconstructedState().pinStates.get('D13')?.value).toBe(0);
  });

  it('seeking backward shows historical pin state', () => {
    engine.recordFrame(makeFrame({
      timestampMs: 0,
      pinStates: [makePin('D13', 1)],
    }));
    engine.recordFrame(makeFrame({
      timestampMs: 100,
      pinStates: [makePin('D13', 0)],
    }));

    engine.seek(0);
    expect(engine.getReconstructedState().pinStates.get('D13')?.value).toBe(1);
  });

  it('empty pin states frame does not clear previous pins', () => {
    engine.recordFrame(makeFrame({
      timestampMs: 0,
      pinStates: [makePin('D13', 1)],
    }));
    engine.recordFrame(makeFrame({
      timestampMs: 100,
      pinStates: [],
    }));

    engine.seek(1);
    expect(engine.getReconstructedState().pinStates.get('D13')?.value).toBe(1);
  });
});

// ──────────────────────────────────────────────────────────────────
// State reconstruction — empty state
// ──────────────────────────────────────────────────────────────────

describe('StateReplayEngine — empty state reconstruction', () => {
  it('returns empty reconstructed state on empty engine', () => {
    const engine = StateReplayEngine.create();
    const state = engine.getReconstructedState();
    expect(state.serialAccumulated).toBe('');
    expect(state.serialLines).toHaveLength(0);
    expect(state.currentCodeLine).toBe(0);
    expect(state.pinStates.size).toBe(0);
    expect(state.frameIndex).toBe(0);
    expect(state.timestampMs).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// State reconstruction — caching
// ──────────────────────────────────────────────────────────────────

describe('StateReplayEngine — reconstruction caching', () => {
  let engine: StateReplayEngine;

  beforeEach(() => {
    engine = StateReplayEngine.create();
    recordNFrames(engine, 5);
  });

  it('returns cached state on repeated calls at same frame', () => {
    engine.seek(2);
    const s1 = engine.getReconstructedState();
    const s2 = engine.getReconstructedState();
    expect(s1).toBe(s2);
  });

  it('invalidates cache on seek', () => {
    engine.seek(2);
    const s1 = engine.getReconstructedState();
    engine.seek(3);
    const s2 = engine.getReconstructedState();
    expect(s1).not.toBe(s2);
  });
});

// ──────────────────────────────────────────────────────────────────
// Import / Export
// ──────────────────────────────────────────────────────────────────

describe('StateReplayEngine — import/export', () => {
  let engine: StateReplayEngine;

  beforeEach(() => {
    engine = StateReplayEngine.create();
  });

  it('export returns version 1 data with frames and markers', () => {
    recordNFrames(engine, 3);
    engine.addMarker(1, 'test', '#00ff00');

    const exported = engine.exportData();
    expect(exported.version).toBe(1);
    expect(exported.frames).toHaveLength(3);
    expect(exported.markers).toHaveLength(1);
    expect(exported.markers[0].label).toBe('test');
  });

  it('import restores frames and markers', () => {
    recordNFrames(engine, 3);
    engine.addMarker(1, 'marker1');
    const exported = engine.exportData();

    const engine2 = StateReplayEngine.create();
    engine2.importData(exported);
    expect(engine2.getTotalFrames()).toBe(3);
    expect(engine2.getMarkers()).toHaveLength(1);
    expect(engine2.getCurrentFrameIndex()).toBe(0);
    expect(engine2.getPlaybackState()).toBe('stopped');
  });

  it('import re-indexes frames', () => {
    const data: ReplayExportData = {
      version: 1,
      frames: [
        { index: 99, timestampMs: 0, serialOutput: 'a', codeLine: 1, pinStates: [] },
        { index: 100, timestampMs: 100, serialOutput: 'b', codeLine: 2, pinStates: [] },
      ],
      markers: [],
    };

    engine.importData(data);
    expect(engine.getFrame(0)?.index).toBe(0);
    expect(engine.getFrame(1)?.index).toBe(1);
  });

  it('import throws on unsupported version', () => {
    const data = { version: 99, frames: [], markers: [] } as unknown as ReplayExportData;
    expect(() => engine.importData(data)).toThrow('Unsupported replay data version');
  });

  it('import throws on invalid frames', () => {
    const data = { version: 1, frames: 'not-array', markers: [] } as unknown as ReplayExportData;
    expect(() => engine.importData(data)).toThrow('frames must be an array');
  });

  it('import handles missing markers array gracefully', () => {
    const data = { version: 1, frames: [], markers: undefined } as unknown as ReplayExportData;
    engine.importData(data);
    expect(engine.getMarkers()).toHaveLength(0);
  });

  it('round-trip preserves full state', () => {
    engine.recordFrame(makeFrame({
      timestampMs: 0,
      serialOutput: 'hello',
      codeLine: 5,
      pinStates: [makePin('D13', 1)],
    }));
    engine.recordFrame(makeFrame({
      timestampMs: 100,
      serialOutput: 'world',
      codeLine: 10,
      pinStates: [makePin('A0', 512, 'analog')],
    }));
    engine.addMarker(0, 'start');

    const exported = engine.exportData();
    const json = JSON.stringify(exported);
    const parsed = JSON.parse(json) as ReplayExportData;

    const engine2 = StateReplayEngine.create();
    engine2.importData(parsed);
    engine2.seek(1);

    const state = engine2.getReconstructedState();
    expect(state.serialLines).toEqual(['hello', 'world']);
    expect(state.currentCodeLine).toBe(10);
    expect(state.pinStates.size).toBe(2);
    expect(engine2.getMarkers()).toHaveLength(1);
  });
});

// ──────────────────────────────────────────────────────────────────
// Snapshot shape
// ──────────────────────────────────────────────────────────────────

describe('StateReplayEngine — snapshot shape', () => {
  let engine: StateReplayEngine;

  beforeEach(() => {
    engine = StateReplayEngine.create();
  });

  it('snapshot includes all expected fields', () => {
    recordNFrames(engine, 5, 100);
    engine.addMarker(2, 'mid');
    engine.seek(3);

    const snap = engine.getSnapshot();
    expect(snap.totalFrames).toBe(5);
    expect(snap.currentFrame).toBe(3);
    expect(snap.playbackState).toBe('stopped');
    expect(snap.speed).toBe(1);
    expect(snap.loop).toBe(false);
    expect(snap.markers).toHaveLength(1);
    expect(snap.durationMs).toBe(400); // 0 to 400ms
    expect(snap.reconstructed).toBeDefined();
    expect(snap.reconstructed.frameIndex).toBe(3);
  });

  it('durationMs is 0 for empty recording', () => {
    const snap = engine.getSnapshot();
    expect(snap.durationMs).toBe(0);
    expect(snap.totalFrames).toBe(0);
  });

  it('durationMs is 0 for single frame', () => {
    engine.recordFrame(makeFrame({ timestampMs: 500 }));
    const snap = engine.getSnapshot();
    expect(snap.durationMs).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// Edge cases
// ──────────────────────────────────────────────────────────────────

describe('StateReplayEngine — edge cases', () => {
  it('multiple listeners all get notified', () => {
    const engine = StateReplayEngine.create();
    const l1 = vi.fn();
    const l2 = vi.fn();
    const l3 = vi.fn();
    engine.subscribe(l1);
    engine.subscribe(l2);
    engine.subscribe(l3);

    engine.recordFrame(makeFrame({ timestampMs: 0 }));
    expect(l1).toHaveBeenCalledTimes(1);
    expect(l2).toHaveBeenCalledTimes(1);
    expect(l3).toHaveBeenCalledTimes(1);
  });

  it('frame metadata is preserved', () => {
    const engine = StateReplayEngine.create();
    engine.recordFrame(makeFrame({
      timestampMs: 0,
      metadata: { stackDepth: 3, registers: { r0: 0xff } },
    }));

    const frame = engine.getFrame(0);
    expect(frame?.metadata).toEqual({ stackDepth: 3, registers: { r0: 0xff } });
  });

  it('reconstructed state timestampMs matches current frame', () => {
    const engine = StateReplayEngine.create();
    engine.recordFrame(makeFrame({ timestampMs: 500 }));
    engine.recordFrame(makeFrame({ timestampMs: 1000 }));
    engine.seek(0);
    expect(engine.getReconstructedState().timestampMs).toBe(500);
    engine.seek(1);
    expect(engine.getReconstructedState().timestampMs).toBe(1000);
  });

  it('seek during playback reschedules timer', () => {
    vi.useFakeTimers();
    const engine = StateReplayEngine.create();
    recordNFrames(engine, 10, 100);
    engine.seek(0);
    engine.play();

    // Seek to frame 7 while playing
    engine.seek(7);
    expect(engine.getCurrentFrameIndex()).toBe(7);
    expect(engine.getPlaybackState()).toBe('playing');

    vi.advanceTimersByTime(101);
    expect(engine.getCurrentFrameIndex()).toBe(8);
    vi.useRealTimers();
  });

  it('clear during playback stops the timer', () => {
    vi.useFakeTimers();
    const engine = StateReplayEngine.create();
    recordNFrames(engine, 5, 100);
    engine.seek(0);
    engine.play();
    engine.clear();

    expect(engine.getPlaybackState()).toBe('stopped');
    expect(engine.getTotalFrames()).toBe(0);

    // Verify no timer fires
    vi.advanceTimersByTime(1000);
    expect(engine.getCurrentFrameIndex()).toBe(0);
    vi.useRealTimers();
  });
});
