import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseLine, TelemetryStore } from '../telemetry-parser';
import type { ParsedValues, TelemetrySnapshot } from '../telemetry-parser';

// ---------------------------------------------------------------------------
// parseLine — CSV format
// ---------------------------------------------------------------------------

describe('parseLine — CSV', () => {
  it('parses comma-separated integers', () => {
    const result = parseLine('1,2,3');
    expect(result).not.toBeNull();
    expect(result!.format).toBe('csv');
    expect(result!.values.get('ch0')).toBe(1);
    expect(result!.values.get('ch1')).toBe(2);
    expect(result!.values.get('ch2')).toBe(3);
  });

  it('parses comma-separated floats', () => {
    const result = parseLine('1.5,2.75,3.125');
    expect(result).not.toBeNull();
    expect(result!.format).toBe('csv');
    expect(result!.values.get('ch0')).toBe(1.5);
    expect(result!.values.get('ch1')).toBe(2.75);
  });

  it('parses negative numbers', () => {
    const result = parseLine('-1.5,0,2.5');
    expect(result).not.toBeNull();
    expect(result!.values.get('ch0')).toBe(-1.5);
    expect(result!.values.get('ch1')).toBe(0);
    expect(result!.values.get('ch2')).toBe(2.5);
  });

  it('parses a single numeric value', () => {
    const result = parseLine('42');
    expect(result).not.toBeNull();
    expect(result!.format).toBe('csv');
    expect(result!.values.get('ch0')).toBe(42);
  });

  it('trims whitespace around values', () => {
    const result = parseLine('  1.0 , 2.0 , 3.0  ');
    expect(result).not.toBeNull();
    expect(result!.values.size).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// parseLine — key=value format
// ---------------------------------------------------------------------------

describe('parseLine — key=value', () => {
  it('parses space-separated key=value pairs', () => {
    const result = parseLine('temp=22.5 hum=65');
    expect(result).not.toBeNull();
    expect(result!.format).toBe('key_value');
    expect(result!.values.get('temp')).toBe(22.5);
    expect(result!.values.get('hum')).toBe(65);
  });

  it('parses comma-separated key=value pairs', () => {
    const result = parseLine('temp=22.5, hum=65');
    expect(result).not.toBeNull();
    expect(result!.format).toBe('key_value');
    expect(result!.values.get('temp')).toBe(22.5);
    expect(result!.values.get('hum')).toBe(65);
  });

  it('handles negative values in key=value', () => {
    const result = parseLine('x=-10 y=20');
    expect(result).not.toBeNull();
    expect(result!.values.get('x')).toBe(-10);
    expect(result!.values.get('y')).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// parseLine — JSON format
// ---------------------------------------------------------------------------

describe('parseLine — JSON', () => {
  it('parses JSON object with numeric values', () => {
    const result = parseLine('{"temp":22.5,"hum":65}');
    expect(result).not.toBeNull();
    expect(result!.format).toBe('json');
    expect(result!.values.get('temp')).toBe(22.5);
    expect(result!.values.get('hum')).toBe(65);
  });

  it('parses JSON with string-encoded numbers', () => {
    const result = parseLine('{"voltage":"3.3","current":"0.5"}');
    expect(result).not.toBeNull();
    expect(result!.format).toBe('json');
    expect(result!.values.get('voltage')).toBe(3.3);
    expect(result!.values.get('current')).toBe(0.5);
  });

  it('ignores non-numeric JSON values', () => {
    const result = parseLine('{"temp":22.5,"label":"sensor1"}');
    expect(result).not.toBeNull();
    expect(result!.values.size).toBe(1);
    expect(result!.values.get('temp')).toBe(22.5);
  });

  it('returns null for empty JSON object', () => {
    const result = parseLine('{}');
    expect(result).toBeNull();
  });

  it('handles JSON with whitespace', () => {
    const result = parseLine('  { "a": 1, "b": 2 }  ');
    expect(result).not.toBeNull();
    expect(result!.values.get('a')).toBe(1);
    expect(result!.values.get('b')).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// parseLine — tab-separated format
// ---------------------------------------------------------------------------

describe('parseLine — tab-separated', () => {
  it('parses tab-separated numbers', () => {
    const result = parseLine('1.23\t4.56\t7.89');
    expect(result).not.toBeNull();
    expect(result!.format).toBe('tab');
    expect(result!.values.get('ch0')).toBe(1.23);
    expect(result!.values.get('ch1')).toBe(4.56);
    expect(result!.values.get('ch2')).toBe(7.89);
  });

  it('handles trailing tab — falls through to CSV single value', () => {
    const result = parseLine('42.0\t');
    // trailing tab produces empty second part; tab parse fails, but "42.0" is
    // still numeric so CSV parse succeeds with one channel
    expect(result).not.toBeNull();
    expect(result!.values.get('ch0')).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// parseLine — labeled CSV format
// ---------------------------------------------------------------------------

describe('parseLine — labeled CSV', () => {
  it('parses labeled CSV like "temp:22.5,hum:65"', () => {
    const result = parseLine('temp:22.5,hum:65');
    expect(result).not.toBeNull();
    expect(result!.format).toBe('labeled_csv');
    expect(result!.values.get('temp')).toBe(22.5);
    expect(result!.values.get('hum')).toBe(65);
  });

  it('handles whitespace in labeled CSV', () => {
    const result = parseLine(' temp : 22.5 , hum : 65 ');
    expect(result).not.toBeNull();
    expect(result!.values.get('temp')).toBe(22.5);
  });
});

// ---------------------------------------------------------------------------
// parseLine — edge cases
// ---------------------------------------------------------------------------

describe('parseLine — edge cases', () => {
  it('returns null for empty string', () => {
    expect(parseLine('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(parseLine('   ')).toBeNull();
  });

  it('returns null for non-numeric text', () => {
    expect(parseLine('hello world')).toBeNull();
  });

  it('returns null for mixed text and numbers without format', () => {
    expect(parseLine('value is 42')).toBeNull();
  });

  it('handles NaN-producing strings', () => {
    expect(parseLine('abc,def')).toBeNull();
  });

  it('handles Infinity', () => {
    // "Infinity" is not finite, JSON parse won't accept it
    const result = parseLine('{"a": Infinity}');
    // Invalid JSON
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// TelemetryStore — construction
// ---------------------------------------------------------------------------

describe('TelemetryStore — construction', () => {
  it('getInstance returns the same instance', () => {
    const a = TelemetryStore.getInstance();
    const b = TelemetryStore.getInstance();
    expect(a).toBe(b);
  });

  it('create returns distinct instances', () => {
    const a = TelemetryStore.create();
    const b = TelemetryStore.create();
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// TelemetryStore — ingestion
// ---------------------------------------------------------------------------

describe('TelemetryStore — ingestion', () => {
  let store: TelemetryStore;

  beforeEach(() => {
    store = TelemetryStore.create();
  });

  it('ingests CSV lines and creates channels', () => {
    store.ingest('1,2,3');
    const snap = store.getSnapshot();
    expect(snap.channels.length).toBe(3);
    expect(snap.channels[0].name).toBe('ch0');
    expect(snap.channels[0].data.length).toBe(1);
    expect(snap.channels[0].data[0].value).toBe(1);
  });

  it('accumulates data across multiple ingestions', () => {
    store.ingest('10,20');
    store.ingest('11,21');
    store.ingest('12,22');
    const snap = store.getSnapshot();
    expect(snap.channels[0].data.length).toBe(3);
    expect(snap.channels[1].data.length).toBe(3);
    expect(snap.totalSamples).toBe(3);
  });

  it('ingests JSON format', () => {
    store.ingest('{"temp":22.5,"hum":65}');
    const snap = store.getSnapshot();
    expect(snap.channels.length).toBe(2);
    const tempCh = snap.channels.find((c) => c.name === 'temp');
    expect(tempCh).toBeDefined();
    expect(tempCh!.data[0].value).toBe(22.5);
  });

  it('ingests key=value format', () => {
    store.ingest('voltage=3.3 current=0.25');
    const snap = store.getSnapshot();
    expect(snap.channels.length).toBe(2);
    const voltageCh = snap.channels.find((c) => c.name === 'voltage');
    expect(voltageCh!.data[0].value).toBe(3.3);
  });

  it('silently ignores non-parseable lines', () => {
    store.ingest('hello world');
    store.ingest('');
    store.ingest('not a number');
    const snap = store.getSnapshot();
    expect(snap.channels.length).toBe(0);
    expect(snap.totalSamples).toBe(0);
  });

  it('assigns sequential indices per channel', () => {
    store.ingest('1');
    store.ingest('2');
    store.ingest('3');
    const snap = store.getSnapshot();
    expect(snap.channels[0].data[0].index).toBe(0);
    expect(snap.channels[0].data[1].index).toBe(1);
    expect(snap.channels[0].data[2].index).toBe(2);
  });

  it('assigns colors to channels', () => {
    store.ingest('1,2,3');
    const snap = store.getSnapshot();
    expect(snap.channels[0].color).toBe('#00F0FF');
    expect(snap.channels[1].color).toBe('#FF6B6B');
    expect(snap.channels[2].color).toBe('#51CF66');
  });

  it('preserves channel order based on first appearance', () => {
    store.ingest('{"z":1,"a":2}');
    const snap = store.getSnapshot();
    expect(snap.channels[0].name).toBe('z');
    expect(snap.channels[1].name).toBe('a');
  });
});

// ---------------------------------------------------------------------------
// TelemetryStore — MAX_POINTS eviction
// ---------------------------------------------------------------------------

describe('TelemetryStore — eviction', () => {
  it('evicts oldest data when exceeding 1000 points', () => {
    const store = TelemetryStore.create();
    for (let i = 0; i < 1050; i++) {
      store.ingest(String(i));
    }
    const snap = store.getSnapshot();
    expect(snap.channels[0].data.length).toBe(1000);
    // First value should be 50 (evicted 0-49)
    expect(snap.channels[0].data[0].value).toBe(50);
    expect(snap.channels[0].data[999].value).toBe(1049);
  });
});

// ---------------------------------------------------------------------------
// TelemetryStore — stats computation
// ---------------------------------------------------------------------------

describe('TelemetryStore — stats', () => {
  let store: TelemetryStore;

  beforeEach(() => {
    store = TelemetryStore.create();
  });

  it('computes current/min/max/avg correctly', () => {
    store.ingest('10');
    store.ingest('20');
    store.ingest('30');
    store.ingest('40');
    const snap = store.getSnapshot();
    const stats = snap.channels[0].stats;
    expect(stats.current).toBe(40);
    expect(stats.min).toBe(10);
    expect(stats.max).toBe(40);
    expect(stats.avg).toBe(25);
    expect(stats.count).toBe(4);
  });

  it('handles single data point', () => {
    store.ingest('42');
    const stats = store.getSnapshot().channels[0].stats;
    expect(stats.current).toBe(42);
    expect(stats.min).toBe(42);
    expect(stats.max).toBe(42);
    expect(stats.avg).toBe(42);
    expect(stats.count).toBe(1);
  });

  it('handles negative values in stats', () => {
    store.ingest('-10');
    store.ingest('0');
    store.ingest('10');
    const stats = store.getSnapshot().channels[0].stats;
    expect(stats.min).toBe(-10);
    expect(stats.max).toBe(10);
    expect(stats.avg).toBe(0);
  });

  it('returns zero stats for empty channel', () => {
    // Force create then clear
    store.ingest('1');
    store.clear();
    const snap = store.getSnapshot();
    expect(snap.channels.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// TelemetryStore — pause/resume
// ---------------------------------------------------------------------------

describe('TelemetryStore — pause/resume', () => {
  let store: TelemetryStore;

  beforeEach(() => {
    store = TelemetryStore.create();
  });

  it('drops data when paused', () => {
    store.ingest('1');
    store.pause();
    store.ingest('2');
    store.ingest('3');
    const snap = store.getSnapshot();
    expect(snap.channels[0].data.length).toBe(1);
    expect(snap.paused).toBe(true);
    expect(snap.totalSamples).toBe(1);
  });

  it('resumes ingestion after resume', () => {
    store.ingest('1');
    store.pause();
    store.ingest('2');
    store.resume();
    store.ingest('3');
    const snap = store.getSnapshot();
    expect(snap.channels[0].data.length).toBe(2);
    expect(snap.paused).toBe(false);
  });

  it('togglePause toggles state', () => {
    expect(store.isPaused()).toBe(false);
    store.togglePause();
    expect(store.isPaused()).toBe(true);
    store.togglePause();
    expect(store.isPaused()).toBe(false);
  });

  it('pause is idempotent', () => {
    store.pause();
    store.pause();
    expect(store.isPaused()).toBe(true);
  });

  it('resume is idempotent', () => {
    store.resume();
    store.resume();
    expect(store.isPaused()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TelemetryStore — clear
// ---------------------------------------------------------------------------

describe('TelemetryStore — clear', () => {
  it('removes all channel data and resets totalSamples', () => {
    const store = TelemetryStore.create();
    store.ingest('1,2,3');
    store.ingest('4,5,6');
    store.clear();
    const snap = store.getSnapshot();
    expect(snap.channels.length).toBe(0);
    expect(snap.totalSamples).toBe(0);
  });

  it('allows new data after clear', () => {
    const store = TelemetryStore.create();
    store.ingest('1');
    store.clear();
    store.ingest('99');
    const snap = store.getSnapshot();
    expect(snap.channels.length).toBe(1);
    expect(snap.channels[0].data[0].value).toBe(99);
  });
});

// ---------------------------------------------------------------------------
// TelemetryStore — subscribe / getSnapshot
// ---------------------------------------------------------------------------

describe('TelemetryStore — subscribe', () => {
  it('notifies listeners on ingest', () => {
    const store = TelemetryStore.create();
    const listener = vi.fn();
    store.subscribe(listener);
    store.ingest('1');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies listeners on pause/resume', () => {
    const store = TelemetryStore.create();
    const listener = vi.fn();
    store.subscribe(listener);
    store.pause();
    store.resume();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('notifies listeners on clear', () => {
    const store = TelemetryStore.create();
    store.ingest('1');
    const listener = vi.fn();
    store.subscribe(listener);
    store.clear();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe removes the listener', () => {
    const store = TelemetryStore.create();
    const listener = vi.fn();
    const unsub = store.subscribe(listener);
    unsub();
    store.ingest('1');
    expect(listener).not.toHaveBeenCalled();
  });

  it('getSnapshot returns same reference when no changes', () => {
    const store = TelemetryStore.create();
    store.ingest('1');
    const a = store.getSnapshot();
    const b = store.getSnapshot();
    expect(a).toBe(b);
  });

  it('getSnapshot returns new reference after ingest', () => {
    const store = TelemetryStore.create();
    store.ingest('1');
    const a = store.getSnapshot();
    store.ingest('2');
    const b = store.getSnapshot();
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// TelemetryStore — getChannelNames / getChannelCount
// ---------------------------------------------------------------------------

describe('TelemetryStore — channel metadata', () => {
  it('getChannelNames returns ordered names', () => {
    const store = TelemetryStore.create();
    store.ingest('{"alpha":1,"beta":2}');
    expect(store.getChannelNames()).toEqual(['alpha', 'beta']);
  });

  it('getChannelCount returns correct count', () => {
    const store = TelemetryStore.create();
    expect(store.getChannelCount()).toBe(0);
    store.ingest('1,2,3');
    expect(store.getChannelCount()).toBe(3);
  });

  it('getChannelNames returns empty array after clear', () => {
    const store = TelemetryStore.create();
    store.ingest('1,2');
    store.clear();
    expect(store.getChannelNames()).toEqual([]);
    expect(store.getChannelCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// TelemetryStore — mixed format ingestion
// ---------------------------------------------------------------------------

describe('TelemetryStore — mixed formats', () => {
  it('channels persist across format changes', () => {
    const store = TelemetryStore.create();
    // First as key=value
    store.ingest('temp=22.5');
    // Then as JSON with same channel name
    store.ingest('{"temp":23.0}');
    const snap = store.getSnapshot();
    expect(snap.channels.length).toBe(1);
    expect(snap.channels[0].data.length).toBe(2);
    expect(snap.channels[0].data[0].value).toBe(22.5);
    expect(snap.channels[0].data[1].value).toBe(23.0);
  });

  it('new channels from later lines are appended', () => {
    const store = TelemetryStore.create();
    store.ingest('{"temp":22}');
    store.ingest('{"temp":23,"hum":60}');
    const snap = store.getSnapshot();
    expect(snap.channels.length).toBe(2);
    expect(snap.channels[0].name).toBe('temp');
    expect(snap.channels[1].name).toBe('hum');
  });
});

// ---------------------------------------------------------------------------
// TelemetryStore — timestamp
// ---------------------------------------------------------------------------

describe('TelemetryStore — timestamps', () => {
  it('data points have timestamps', () => {
    const store = TelemetryStore.create();
    const before = Date.now();
    store.ingest('42');
    const after = Date.now();
    const ts = store.getSnapshot().channels[0].data[0].timestamp;
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});

// ---------------------------------------------------------------------------
// parseLine — format detection consistency
// ---------------------------------------------------------------------------

describe('parseLine — format detection', () => {
  it('detects CSV format', () => {
    expect(parseLine('1,2,3')!.format).toBe('csv');
  });

  it('detects key_value format', () => {
    expect(parseLine('a=1 b=2')!.format).toBe('key_value');
  });

  it('detects json format', () => {
    expect(parseLine('{"a":1}')!.format).toBe('json');
  });

  it('detects tab format', () => {
    expect(parseLine('1\t2\t3')!.format).toBe('tab');
  });

  it('detects labeled_csv format', () => {
    expect(parseLine('a:1,b:2')!.format).toBe('labeled_csv');
  });
});

// ---------------------------------------------------------------------------
// parseLine — robustness with real-world serial output
// ---------------------------------------------------------------------------

describe('parseLine — real-world serial patterns', () => {
  it('parses Arduino Serial.println style "value\\r\\n"', () => {
    const result = parseLine('1023\r\n');
    expect(result).not.toBeNull();
    // \r\n gets trimmed
    expect(result!.values.get('ch0')).toBe(1023);
  });

  it('parses multiple sensor readings CSV', () => {
    const result = parseLine('512,768,1023,0');
    expect(result).not.toBeNull();
    expect(result!.values.size).toBe(4);
  });

  it('parses ESP32 JSON telemetry', () => {
    const result = parseLine('{"accelX":-0.12,"accelY":9.81,"accelZ":0.05,"gyroX":0.01}');
    expect(result).not.toBeNull();
    expect(result!.format).toBe('json');
    expect(result!.values.size).toBe(4);
    expect(result!.values.get('accelY')).toBe(9.81);
  });

  it('handles zero values', () => {
    const result = parseLine('0,0,0');
    expect(result).not.toBeNull();
    expect(result!.values.get('ch0')).toBe(0);
  });

  it('handles scientific notation', () => {
    const result = parseLine('1.5e3,2.5e-4');
    expect(result).not.toBeNull();
    expect(result!.values.get('ch0')).toBe(1500);
    expect(result!.values.get('ch1')).toBeCloseTo(0.00025);
  });
});
