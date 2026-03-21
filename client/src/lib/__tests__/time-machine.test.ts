import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  TimeMachineManager,
  getTimeMachineManager,
} from '../time-machine';
import type {
  TimelineEvent,
  Bookmark,
  EventDomain,
  PlaybackSpeed,
  TimeMachineExport,
  EventFilter,
  TimeMachineConfig,
  StateSnapshot,
} from '../time-machine';

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  TimeMachineManager.resetInstance();
  vi.useFakeTimers();
});

afterEach(() => {
  TimeMachineManager.resetInstance();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

describe('TimeMachineManager singleton', () => {
  it('returns the same instance', () => {
    const a = TimeMachineManager.getInstance();
    const b = TimeMachineManager.getInstance();
    expect(a).toBe(b);
  });

  it('resetInstance creates a fresh instance', () => {
    const a = TimeMachineManager.getInstance();
    TimeMachineManager.resetInstance();
    const b = TimeMachineManager.getInstance();
    expect(a).not.toBe(b);
  });

  it('getTimeMachineManager is a convenience accessor', () => {
    const a = getTimeMachineManager();
    const b = TimeMachineManager.getInstance();
    expect(a).toBe(b);
  });
});

// ---------------------------------------------------------------------------
// Recording
// ---------------------------------------------------------------------------

describe('recording', () => {
  it('starts in idle state', () => {
    const mgr = TimeMachineManager.getInstance();
    expect(mgr.state).toBe('idle');
    expect(mgr.eventCount).toBe(0);
    expect(mgr.duration).toBe(0);
  });

  it('startRecording transitions to recording state', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    expect(mgr.state).toBe('recording');
  });

  it('stopRecording transitions to idle', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    mgr.stopRecording();
    expect(mgr.state).toBe('idle');
  });

  it('stopRecording does nothing when not recording', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.stopRecording();
    expect(mgr.state).toBe('idle');
  });

  it('recordEvent adds events during recording', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    const event = mgr.recordEvent('firmware', 'pin_change', { pin: 13, value: 1 });
    expect(event).not.toBeNull();
    expect(event?.domain).toBe('firmware');
    expect(event?.type).toBe('pin_change');
    expect(event?.data.pin).toBe(13);
    expect(mgr.eventCount).toBe(1);
  });

  it('recordEvent returns null when not recording', () => {
    const mgr = TimeMachineManager.getInstance();
    const event = mgr.recordEvent('firmware', 'test');
    expect(event).toBeNull();
    expect(mgr.eventCount).toBe(0);
  });

  it('recordEvent rejects invalid domains', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    const event = mgr.recordEvent('invalid' as EventDomain, 'test');
    expect(event).toBeNull();
  });

  it('events get monotonic IDs', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    const e1 = mgr.recordEvent('firmware', 'a');
    const e2 = mgr.recordEvent('serial', 'b');
    const e3 = mgr.recordEvent('schematic', 'c');
    expect(e1?.id).toBe(1);
    expect(e2?.id).toBe(2);
    expect(e3?.id).toBe(3);
  });

  it('events get timestamps relative to recording start', () => {
    const mgr = TimeMachineManager.getInstance();
    vi.setSystemTime(new Date(1000));
    mgr.startRecording();
    vi.setSystemTime(new Date(1500));
    const e1 = mgr.recordEvent('firmware', 'a');
    vi.setSystemTime(new Date(2000));
    const e2 = mgr.recordEvent('firmware', 'b');
    expect(e1?.timestamp).toBe(500);
    expect(e2?.timestamp).toBe(1000);
  });

  it('recordEventAt uses explicit timestamps', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    const e1 = mgr.recordEventAt(100, 'firmware', 'a');
    const e2 = mgr.recordEventAt(200, 'serial', 'b');
    expect(e1?.timestamp).toBe(100);
    expect(e2?.timestamp).toBe(200);
    expect(mgr.currentTime).toBe(200);
  });

  it('recordEventAt returns null when not recording', () => {
    const mgr = TimeMachineManager.getInstance();
    const event = mgr.recordEventAt(100, 'firmware', 'test');
    expect(event).toBeNull();
  });

  it('recordEventAt rejects invalid domains', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    const event = mgr.recordEventAt(100, 'bogus' as EventDomain, 'test');
    expect(event).toBeNull();
  });

  it('startRecording clears previous data', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    mgr.recordEvent('firmware', 'a');
    mgr.recordEvent('firmware', 'b');
    expect(mgr.eventCount).toBe(2);
    mgr.startRecording();
    expect(mgr.eventCount).toBe(0);
  });

  it('data payload is copied on record', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    const data = { pin: 13 };
    const event = mgr.recordEvent('firmware', 'test', data);
    data.pin = 99;
    expect(event?.data.pin).toBe(13);
  });

  it('domain stats are tracked', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    mgr.recordEvent('firmware', 'a');
    mgr.recordEvent('firmware', 'b');
    mgr.recordEvent('serial', 'c');
    mgr.recordEvent('telemetry', 'd');
    const stats = mgr.getDomainStats();
    expect(stats.firmware).toBe(2);
    expect(stats.serial).toBe(1);
    expect(stats.telemetry).toBe(1);
    expect(stats.schematic).toBe(0);
    expect(stats.user).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Ring Buffer
// ---------------------------------------------------------------------------

describe('ring buffer', () => {
  it('evicts oldest events when exceeding capacity', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording({ maxEvents: 5 });
    for (let i = 0; i < 8; i++) {
      mgr.recordEventAt(i * 10, 'firmware', `event-${i}`);
    }
    expect(mgr.eventCount).toBe(5);
    const events = mgr.getEvents();
    expect(events[0].type).toBe('event-3');
    expect(events[4].type).toBe('event-7');
  });

  it('domain counts are decremented on eviction', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording({ maxEvents: 3 });
    mgr.recordEventAt(10, 'firmware', 'a');
    mgr.recordEventAt(20, 'firmware', 'b');
    mgr.recordEventAt(30, 'serial', 'c');
    // Now at capacity (3). Adding one more evicts 'a' (firmware)
    mgr.recordEventAt(40, 'telemetry', 'd');
    const stats = mgr.getDomainStats();
    expect(stats.firmware).toBe(1); // was 2, evicted 1
    expect(stats.serial).toBe(1);
    expect(stats.telemetry).toBe(1);
  });

  it('handles default max of 100K', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    // Just verify the config, don't actually fill 100K
    const snap = mgr.getSnapshot();
    expect(snap.eventCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Event Queries
// ---------------------------------------------------------------------------

describe('event queries', () => {
  function seedEvents(mgr: TimeMachineManager): void {
    mgr.startRecording();
    mgr.recordEventAt(100, 'firmware', 'pin_change', { pin: 13 });
    mgr.recordEventAt(200, 'serial', 'data_received', { bytes: 10 });
    mgr.recordEventAt(300, 'schematic', 'node_add', { nodeId: 'n1' });
    mgr.recordEventAt(400, 'firmware', 'pin_change', { pin: 7 });
    mgr.recordEventAt(500, 'telemetry', 'frame', { temp: 25 });
    mgr.recordEventAt(600, 'user', 'click', { target: 'btn' });
    mgr.stopRecording();
  }

  it('getEvents returns all events unfiltered', () => {
    const mgr = TimeMachineManager.getInstance();
    seedEvents(mgr);
    expect(mgr.getEvents().length).toBe(6);
  });

  it('filter by domain', () => {
    const mgr = TimeMachineManager.getInstance();
    seedEvents(mgr);
    const fw = mgr.getEvents({ domains: ['firmware'] });
    expect(fw.length).toBe(2);
    expect(fw.every((e) => e.domain === 'firmware')).toBe(true);
  });

  it('filter by multiple domains', () => {
    const mgr = TimeMachineManager.getInstance();
    seedEvents(mgr);
    const result = mgr.getEvents({ domains: ['firmware', 'serial'] });
    expect(result.length).toBe(3);
  });

  it('filter by type', () => {
    const mgr = TimeMachineManager.getInstance();
    seedEvents(mgr);
    const result = mgr.getEvents({ types: ['pin_change'] });
    expect(result.length).toBe(2);
  });

  it('filter by time range', () => {
    const mgr = TimeMachineManager.getInstance();
    seedEvents(mgr);
    const result = mgr.getEvents({ startTime: 200, endTime: 400 });
    expect(result.length).toBe(3); // events at 200, 300, 400
  });

  it('filter by combined criteria', () => {
    const mgr = TimeMachineManager.getInstance();
    seedEvents(mgr);
    const result = mgr.getEvents({
      domains: ['firmware'],
      startTime: 300,
    });
    expect(result.length).toBe(1); // only event at 400
    expect(result[0].data.pin).toBe(7);
  });

  it('getEventsUpToCurrent respects current time', () => {
    const mgr = TimeMachineManager.getInstance();
    seedEvents(mgr);
    mgr.seek(300);
    const result = mgr.getEventsUpToCurrent();
    expect(result.length).toBe(3); // events at 100, 200, 300
  });

  it('getEventsAtTime with tolerance', () => {
    const mgr = TimeMachineManager.getInstance();
    seedEvents(mgr);
    const exact = mgr.getEventsAtTime(200);
    expect(exact.length).toBe(1);
    const withTolerance = mgr.getEventsAtTime(200, 50);
    // Events at 200 (within 150-250)
    expect(withTolerance.length).toBe(1);
    const wider = mgr.getEventsAtTime(250, 100);
    // Events at 200, 300 (within 150-350)
    expect(wider.length).toBe(2);
  });

  it('empty domain filter returns all', () => {
    const mgr = TimeMachineManager.getInstance();
    seedEvents(mgr);
    const result = mgr.getEvents({ domains: [] });
    expect(result.length).toBe(6);
  });

  it('empty type filter returns all', () => {
    const mgr = TimeMachineManager.getInstance();
    seedEvents(mgr);
    const result = mgr.getEvents({ types: [] });
    expect(result.length).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// Playback
// ---------------------------------------------------------------------------

describe('playback', () => {
  function seedAndStop(mgr: TimeMachineManager): void {
    mgr.startRecording();
    mgr.recordEventAt(0, 'firmware', 'start');
    mgr.recordEventAt(500, 'firmware', 'mid');
    mgr.recordEventAt(1000, 'firmware', 'end');
    mgr.stopRecording();
  }

  it('play transitions to playing', () => {
    const mgr = TimeMachineManager.getInstance();
    seedAndStop(mgr);
    mgr.play();
    expect(mgr.state).toBe('playing');
  });

  it('play does nothing with no events', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.play();
    expect(mgr.state).toBe('idle');
  });

  it('play does nothing during recording', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    mgr.play();
    expect(mgr.state).toBe('recording');
  });

  it('pause transitions playing → paused', () => {
    const mgr = TimeMachineManager.getInstance();
    seedAndStop(mgr);
    mgr.play();
    mgr.pause();
    expect(mgr.state).toBe('paused');
  });

  it('pause does nothing when not playing', () => {
    const mgr = TimeMachineManager.getInstance();
    seedAndStop(mgr);
    mgr.pause();
    expect(mgr.state).not.toBe('paused');
  });

  it('stop resets to beginning', () => {
    const mgr = TimeMachineManager.getInstance();
    seedAndStop(mgr);
    mgr.seek(500);
    mgr.stop();
    expect(mgr.currentTime).toBe(0);
    expect(mgr.state).toBe('paused');
  });

  it('playback advances currentTime over wall-clock time', () => {
    const mgr = TimeMachineManager.getInstance();
    seedAndStop(mgr);
    mgr.play();
    vi.advanceTimersByTime(100);
    expect(mgr.currentTime).toBeGreaterThan(0);
    mgr.pause();
  });

  it('playback stops at end of recording', () => {
    const mgr = TimeMachineManager.getInstance();
    seedAndStop(mgr);
    mgr.play();
    vi.advanceTimersByTime(2000); // well past the 1000ms recording
    expect(mgr.state).toBe('paused');
    expect(mgr.currentTime).toBe(1000);
  });

  it('setSpeed changes playback rate', () => {
    const mgr = TimeMachineManager.getInstance();
    seedAndStop(mgr);
    mgr.setSpeed(2);
    expect(mgr.speed).toBe(2);
  });

  it('setSpeed rejects invalid speeds', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.setSpeed(3 as PlaybackSpeed);
    expect(mgr.speed).toBe(1);
  });

  it('speed affects playback rate', () => {
    const mgr = TimeMachineManager.getInstance();
    seedAndStop(mgr);
    mgr.setSpeed(4);
    vi.setSystemTime(new Date(0));
    mgr.play();
    vi.setSystemTime(new Date(100));
    vi.advanceTimersByTime(100);
    const time4x = mgr.currentTime;
    mgr.pause();

    // Reset and play at 1x
    TimeMachineManager.resetInstance();
    const mgr2 = TimeMachineManager.getInstance();
    seedAndStop(mgr2);
    mgr2.setSpeed(1);
    vi.setSystemTime(new Date(1000));
    mgr2.play();
    vi.setSystemTime(new Date(1100));
    vi.advanceTimersByTime(100);
    const time1x = mgr2.currentTime;
    mgr2.pause();

    // 4x should be roughly 4 times farther than 1x
    expect(time4x).toBeGreaterThan(time1x * 2);
  });

  it('speed can be changed during playback', () => {
    const mgr = TimeMachineManager.getInstance();
    seedAndStop(mgr);
    vi.setSystemTime(new Date(0));
    mgr.play();
    vi.setSystemTime(new Date(50));
    vi.advanceTimersByTime(50);
    const timeBefore = mgr.currentTime;
    mgr.setSpeed(8);
    vi.setSystemTime(new Date(100));
    vi.advanceTimersByTime(50);
    const timeAfter = mgr.currentTime;
    mgr.pause();
    // After speed change at 8x, 50ms wall time = 400ms sim time
    expect(timeAfter - timeBefore).toBeGreaterThan(50);
  });
});

// ---------------------------------------------------------------------------
// Seeking
// ---------------------------------------------------------------------------

describe('seeking', () => {
  function seedAndStop(mgr: TimeMachineManager): void {
    mgr.startRecording();
    mgr.recordEventAt(0, 'firmware', 'start');
    mgr.recordEventAt(500, 'firmware', 'mid');
    mgr.recordEventAt(1000, 'firmware', 'end');
    mgr.stopRecording();
  }

  it('seek sets currentTime', () => {
    const mgr = TimeMachineManager.getInstance();
    seedAndStop(mgr);
    mgr.seek(500);
    expect(mgr.currentTime).toBe(500);
  });

  it('seek clamps to 0', () => {
    const mgr = TimeMachineManager.getInstance();
    seedAndStop(mgr);
    mgr.seek(-100);
    expect(mgr.currentTime).toBe(0);
  });

  it('seek clamps to duration', () => {
    const mgr = TimeMachineManager.getInstance();
    seedAndStop(mgr);
    mgr.seek(9999);
    expect(mgr.currentTime).toBe(1000);
  });

  it('seek during playback restarts from new position', () => {
    const mgr = TimeMachineManager.getInstance();
    seedAndStop(mgr);
    mgr.play();
    mgr.seek(500);
    expect(mgr.state).toBe('playing');
    expect(mgr.currentTime).toBe(500);
    mgr.pause();
  });

  it('seek does nothing during recording', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    mgr.recordEventAt(100, 'firmware', 'a');
    mgr.seek(50);
    // Should stay in recording state with time unchanged
    expect(mgr.state).toBe('recording');
  });

  it('seek does nothing with no events', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.seek(500);
    expect(mgr.currentTime).toBe(0);
  });

  it('seek from idle transitions to paused', () => {
    const mgr = TimeMachineManager.getInstance();
    seedAndStop(mgr);
    mgr.seek(500);
    expect(mgr.state).toBe('paused');
  });
});

// ---------------------------------------------------------------------------
// Bookmarks
// ---------------------------------------------------------------------------

describe('bookmarks', () => {
  it('addBookmark creates a bookmark at current time', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    mgr.recordEventAt(500, 'firmware', 'test');
    mgr.stopRecording();
    mgr.seek(500);
    const bm = mgr.addBookmark('test point');
    expect(bm.timestamp).toBe(500);
    expect(bm.label).toBe('test point');
    expect(bm.id).toBe(1);
  });

  it('addBookmark with explicit timestamp', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    mgr.recordEventAt(1000, 'firmware', 'test');
    mgr.stopRecording();
    const bm = mgr.addBookmark('start', 100);
    expect(bm.timestamp).toBe(100);
  });

  it('addBookmark with domain', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    mgr.recordEventAt(100, 'firmware', 'test');
    mgr.stopRecording();
    const bm = mgr.addBookmark('firmware checkpoint', 100, 'firmware');
    expect(bm.domain).toBe('firmware');
  });

  it('bookmarks are sorted by timestamp', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    mgr.recordEventAt(1000, 'firmware', 'test');
    mgr.stopRecording();
    mgr.addBookmark('third', 900);
    mgr.addBookmark('first', 100);
    mgr.addBookmark('second', 500);
    const bookmarks = mgr.getBookmarks();
    expect(bookmarks[0].label).toBe('first');
    expect(bookmarks[1].label).toBe('second');
    expect(bookmarks[2].label).toBe('third');
  });

  it('removeBookmark removes by ID', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    mgr.recordEventAt(100, 'firmware', 'test');
    mgr.stopRecording();
    const bm = mgr.addBookmark('test', 100);
    expect(mgr.removeBookmark(bm.id)).toBe(true);
    expect(mgr.getBookmarks().length).toBe(0);
  });

  it('removeBookmark returns false for invalid ID', () => {
    const mgr = TimeMachineManager.getInstance();
    expect(mgr.removeBookmark(999)).toBe(false);
  });

  it('seekToBookmark navigates to bookmark time', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    mgr.recordEventAt(500, 'firmware', 'test');
    mgr.stopRecording();
    const bm = mgr.addBookmark('target', 500);
    const result = mgr.seekToBookmark(bm.id);
    expect(result).toBe(true);
    expect(mgr.currentTime).toBe(500);
  });

  it('seekToBookmark returns false for invalid ID', () => {
    const mgr = TimeMachineManager.getInstance();
    expect(mgr.seekToBookmark(999)).toBe(false);
  });

  it('bookmark IDs are monotonic', () => {
    const mgr = TimeMachineManager.getInstance();
    const b1 = mgr.addBookmark('a', 0);
    const b2 = mgr.addBookmark('b', 100);
    expect(b2.id).toBeGreaterThan(b1.id);
  });
});

// ---------------------------------------------------------------------------
// State Reconstruction
// ---------------------------------------------------------------------------

describe('state reconstruction', () => {
  it('reconstructState builds from events', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    mgr.recordEventAt(100, 'firmware', 'pin_change', { pin: 13, value: 1 });
    mgr.recordEventAt(200, 'serial', 'data_received', { bytes: 42 });
    mgr.recordEventAt(300, 'firmware', 'pin_change', { pin: 7, value: 0 });
    mgr.stopRecording();

    const state = mgr.reconstructState(200);
    expect(state.timestamp).toBe(200);
    expect(state.states.firmware.last_pin_change).toEqual({ pin: 13, value: 1 });
    expect(state.states.serial.last_data_received).toEqual({ bytes: 42 });
    // Event at 300 should not be included
    expect(state.states.firmware.pin_change_count).toBe(1);
  });

  it('reconstructState includes all events up to timestamp', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    mgr.recordEventAt(100, 'firmware', 'a');
    mgr.recordEventAt(200, 'firmware', 'a');
    mgr.recordEventAt(300, 'firmware', 'a');
    mgr.stopRecording();

    const state = mgr.reconstructState(300);
    expect(state.states.firmware.a_count).toBe(3);
  });

  it('reconstructState uses snapshots for fast replay', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording({ snapshotIntervalMs: 100 });
    for (let i = 0; i <= 500; i += 50) {
      mgr.recordEventAt(i, 'firmware', 'tick', { t: i });
    }
    mgr.stopRecording();

    // Should have some snapshots
    const state = mgr.reconstructState(500);
    expect(state.timestamp).toBe(500);
  });

  it('captureSnapshot creates a snapshot', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    mgr.recordEventAt(100, 'firmware', 'test');
    mgr.stopRecording();
    const snap = mgr.captureSnapshot(100);
    expect(snap.timestamp).toBe(100);
  });

  it('reconstructState with no events returns empty state', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    mgr.stopRecording();
    const state = mgr.reconstructState(0);
    expect(state.states.firmware).toEqual({});
    expect(state.states.serial).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Import / Export
// ---------------------------------------------------------------------------

describe('import / export', () => {
  it('exportSession captures all data', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    mgr.recordEventAt(100, 'firmware', 'a', { x: 1 });
    mgr.recordEventAt(200, 'serial', 'b', { y: 2 });
    mgr.stopRecording();
    mgr.addBookmark('test', 100);

    const exported = mgr.exportSession();
    expect(exported.version).toBe(1);
    expect(exported.eventCount).toBe(2);
    expect(exported.events.length).toBe(2);
    expect(exported.bookmarks.length).toBe(1);
    expect(exported.duration).toBe(200);
    expect(exported.exportedAt).toBeTruthy();
  });

  it('importSession restores from export', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    mgr.recordEventAt(100, 'firmware', 'a', { x: 1 });
    mgr.recordEventAt(200, 'serial', 'b', { y: 2 });
    mgr.stopRecording();
    mgr.addBookmark('test', 100);

    const exported = mgr.exportSession();

    TimeMachineManager.resetInstance();
    const mgr2 = TimeMachineManager.getInstance();
    const result = mgr2.importSession(exported);
    expect(result).toBe(true);
    expect(mgr2.eventCount).toBe(2);
    expect(mgr2.getBookmarks().length).toBe(1);
    expect(mgr2.duration).toBe(200);
    expect(mgr2.state).toBe('paused');
  });

  it('importSession rejects invalid version', () => {
    const mgr = TimeMachineManager.getInstance();
    const result = mgr.importSession({ version: 99 } as unknown as TimeMachineExport);
    expect(result).toBe(false);
  });

  it('importSession rejects null data', () => {
    const mgr = TimeMachineManager.getInstance();
    const result = mgr.importSession(null as unknown as TimeMachineExport);
    expect(result).toBe(false);
  });

  it('importSession rejects during recording', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    const result = mgr.importSession({
      version: 1,
      exportedAt: '',
      duration: 0,
      eventCount: 0,
      events: [],
      bookmarks: [],
      snapshots: [],
    });
    expect(result).toBe(false);
  });

  it('importSession rejects during playback', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    mgr.recordEventAt(100, 'firmware', 'test');
    mgr.stopRecording();
    mgr.play();
    const result = mgr.importSession({
      version: 1,
      exportedAt: '',
      duration: 0,
      eventCount: 0,
      events: [],
      bookmarks: [],
      snapshots: [],
    });
    expect(result).toBe(false);
    mgr.pause();
  });

  it('importSession rebuilds domain counts', () => {
    const mgr = TimeMachineManager.getInstance();
    const result = mgr.importSession({
      version: 1,
      exportedAt: '',
      duration: 300,
      eventCount: 3,
      events: [
        { id: 1, timestamp: 100, domain: 'firmware', type: 'a', data: {} },
        { id: 2, timestamp: 200, domain: 'firmware', type: 'b', data: {} },
        { id: 3, timestamp: 300, domain: 'serial', type: 'c', data: {} },
      ],
      bookmarks: [],
      snapshots: [],
    });
    expect(result).toBe(true);
    const stats = mgr.getDomainStats();
    expect(stats.firmware).toBe(2);
    expect(stats.serial).toBe(1);
  });

  it('importSession continues IDs past imported max', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.importSession({
      version: 1,
      exportedAt: '',
      duration: 100,
      eventCount: 1,
      events: [{ id: 50, timestamp: 100, domain: 'firmware', type: 'a', data: {} }],
      bookmarks: [{ id: 20, timestamp: 100, label: 'test' }],
      snapshots: [],
    });
    // New bookmark should have ID > 20
    const bm = mgr.addBookmark('new', 0);
    expect(bm.id).toBeGreaterThan(20);
  });

  it('round-trip export/import preserves data integrity', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    mgr.recordEventAt(100, 'firmware', 'pin_change', { pin: 13, value: 1 });
    mgr.recordEventAt(200, 'serial', 'data', { payload: 'hello' });
    mgr.recordEventAt(300, 'telemetry', 'frame', { temp: 25.5 });
    mgr.stopRecording();
    mgr.addBookmark('important', 200);

    const exported = mgr.exportSession();
    const json = JSON.stringify(exported);
    const parsed = JSON.parse(json) as TimeMachineExport;

    TimeMachineManager.resetInstance();
    const mgr2 = TimeMachineManager.getInstance();
    mgr2.importSession(parsed);

    expect(mgr2.eventCount).toBe(3);
    expect(mgr2.duration).toBe(300);
    const events = mgr2.getEvents({ domains: ['firmware'] });
    expect(events[0].data.pin).toBe(13);
    expect(mgr2.getBookmarks()[0].label).toBe('important');
  });

  it('importSession with empty events goes to idle', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.importSession({
      version: 1,
      exportedAt: '',
      duration: 0,
      eventCount: 0,
      events: [],
      bookmarks: [],
      snapshots: [],
    });
    expect(mgr.state).toBe('idle');
  });
});

// ---------------------------------------------------------------------------
// Subscribe / Snapshot
// ---------------------------------------------------------------------------

describe('subscribe / snapshot', () => {
  it('subscriber is called on state changes', () => {
    const mgr = TimeMachineManager.getInstance();
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.startRecording();
    expect(listener).toHaveBeenCalled();
  });

  it('unsubscribe stops notifications', () => {
    const mgr = TimeMachineManager.getInstance();
    const listener = vi.fn();
    const unsub = mgr.subscribe(listener);
    unsub();
    mgr.startRecording();
    expect(listener).not.toHaveBeenCalled();
  });

  it('snapshot contains complete state', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    mgr.recordEventAt(100, 'firmware', 'test');
    mgr.recordEventAt(200, 'serial', 'data');
    mgr.stopRecording();
    mgr.addBookmark('mark', 100);
    mgr.setSpeed(2);
    mgr.seek(150);

    const snap = mgr.getSnapshot();
    expect(snap.state).toBe('paused');
    expect(snap.currentTime).toBe(150);
    expect(snap.duration).toBe(200);
    expect(snap.eventCount).toBe(2);
    expect(snap.speed).toBe(2);
    expect(snap.bookmarks.length).toBe(1);
    expect(snap.isRecording).toBe(false);
    expect(snap.isPlaying).toBe(false);
    expect(snap.domainStats.firmware).toBe(1);
    expect(snap.domainStats.serial).toBe(1);
  });

  it('isRecording is true during recording', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    expect(mgr.getSnapshot().isRecording).toBe(true);
    mgr.stopRecording();
    expect(mgr.getSnapshot().isRecording).toBe(false);
  });

  it('isPlaying is true during playback', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    mgr.recordEventAt(100, 'firmware', 'test');
    mgr.stopRecording();
    mgr.play();
    expect(mgr.getSnapshot().isPlaying).toBe(true);
    mgr.pause();
    expect(mgr.getSnapshot().isPlaying).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Clear / Destroy
// ---------------------------------------------------------------------------

describe('clear / destroy', () => {
  it('clear resets all state', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    mgr.recordEventAt(100, 'firmware', 'test');
    mgr.stopRecording();
    mgr.addBookmark('test', 100);
    mgr.seek(100);

    mgr.clear();
    expect(mgr.state).toBe('idle');
    expect(mgr.eventCount).toBe(0);
    expect(mgr.duration).toBe(0);
    expect(mgr.currentTime).toBe(0);
    expect(mgr.getBookmarks().length).toBe(0);
    expect(mgr.speed).toBe(1);
  });

  it('destroy clears subscribers', () => {
    const mgr = TimeMachineManager.getInstance();
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.destroy();
    // After destroy, shouldn't throw (but can't easily test no notification)
    expect(() => TimeMachineManager.resetInstance()).not.toThrow();
  });

  it('clear during playback stops it', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    mgr.recordEventAt(100, 'firmware', 'test');
    mgr.stopRecording();
    mgr.play();
    mgr.clear();
    expect(mgr.state).toBe('idle');
  });
});

// ---------------------------------------------------------------------------
// Duration
// ---------------------------------------------------------------------------

describe('duration', () => {
  it('duration is 0 with no events', () => {
    const mgr = TimeMachineManager.getInstance();
    expect(mgr.duration).toBe(0);
  });

  it('duration is timestamp of last event', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    mgr.recordEventAt(100, 'firmware', 'a');
    mgr.recordEventAt(500, 'firmware', 'b');
    mgr.recordEventAt(1000, 'firmware', 'c');
    mgr.stopRecording();
    expect(mgr.duration).toBe(1000);
  });
});

// ---------------------------------------------------------------------------
// Edge Cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('multiple startRecording calls reset state', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    mgr.recordEventAt(100, 'firmware', 'a');
    mgr.startRecording(); // Should reset
    expect(mgr.eventCount).toBe(0);
    expect(mgr.state).toBe('recording');
  });

  it('stop when already idle does nothing harmful', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.stop();
    expect(mgr.state).toBe('idle');
  });

  it('stop with events transitions to paused', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    mgr.recordEventAt(100, 'firmware', 'test');
    mgr.stopRecording();
    mgr.seek(50);
    mgr.stop();
    expect(mgr.state).toBe('paused');
    expect(mgr.currentTime).toBe(0);
  });

  it('recordEvent with empty data object works', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    const event = mgr.recordEvent('user', 'click');
    expect(event?.data).toEqual({});
  });

  it('all five domains are supported', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    const domains: EventDomain[] = ['firmware', 'serial', 'schematic', 'telemetry', 'user'];
    domains.forEach((d, i) => {
      mgr.recordEventAt(i * 100, d, 'test');
    });
    expect(mgr.eventCount).toBe(5);
    const stats = mgr.getDomainStats();
    domains.forEach((d) => {
      expect(stats[d]).toBe(1);
    });
  });

  it('all valid playback speeds are accepted', () => {
    const mgr = TimeMachineManager.getInstance();
    const speeds: PlaybackSpeed[] = [0.25, 0.5, 1, 2, 4, 8, 16];
    speeds.forEach((s) => {
      mgr.setSpeed(s);
      expect(mgr.speed).toBe(s);
    });
  });

  it('snapshot bookmarks is a copy', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording();
    mgr.recordEventAt(100, 'firmware', 'test');
    mgr.stopRecording();
    mgr.addBookmark('a', 100);
    const snap1 = mgr.getSnapshot();
    mgr.addBookmark('b', 100);
    const snap2 = mgr.getSnapshot();
    expect(snap1.bookmarks.length).toBe(1);
    expect(snap2.bookmarks.length).toBe(2);
  });

  it('auto-snapshot during recording', () => {
    const mgr = TimeMachineManager.getInstance();
    mgr.startRecording({ snapshotIntervalMs: 100 });
    mgr.recordEventAt(0, 'firmware', 'start');
    mgr.recordEventAt(150, 'firmware', 'tick1');
    mgr.recordEventAt(300, 'firmware', 'tick2');
    mgr.stopRecording();
    // At least a couple of snapshots should exist
    const exported = mgr.exportSession();
    expect(exported.snapshots.length).toBeGreaterThanOrEqual(2);
  });
});
