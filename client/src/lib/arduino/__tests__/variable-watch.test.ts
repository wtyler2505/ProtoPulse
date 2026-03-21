import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VariableWatchManager, parseWatchLine } from '../variable-watch';
import type { ParsedLine, WatchSnapshot } from '../variable-watch';

// ──────────────────────────────────────────────────────────────────
// parseWatchLine — Format 1: name=value
// ──────────────────────────────────────────────────────────────────

describe('parseWatchLine — name=value format', () => {
  it('parses single name=value pair', () => {
    const result = parseWatchLine('temp=22.5');
    expect(result).not.toBeNull();
    expect(result!.format).toBe('name_value');
    expect(result!.values.get('temp')).toBe(22.5);
  });

  it('parses multiple space-separated pairs', () => {
    const result = parseWatchLine('temp=22.5 hum=65 pres=1013');
    expect(result).not.toBeNull();
    expect(result!.format).toBe('name_value');
    expect(result!.values.size).toBe(3);
    expect(result!.values.get('temp')).toBe(22.5);
    expect(result!.values.get('hum')).toBe(65);
    expect(result!.values.get('pres')).toBe(1013);
  });

  it('parses comma-separated pairs', () => {
    const result = parseWatchLine('x=1.5,y=2.3,z=3.1');
    expect(result).not.toBeNull();
    expect(result!.format).toBe('name_value');
    expect(result!.values.size).toBe(3);
  });

  it('parses negative values', () => {
    const result = parseWatchLine('temp=-5.2');
    expect(result).not.toBeNull();
    expect(result!.values.get('temp')).toBe(-5.2);
  });

  it('parses integer values', () => {
    const result = parseWatchLine('count=42');
    expect(result).not.toBeNull();
    expect(result!.values.get('count')).toBe(42);
  });

  it('parses zero', () => {
    const result = parseWatchLine('val=0');
    expect(result).not.toBeNull();
    expect(result!.values.get('val')).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// parseWatchLine — Format 2: name: value
// ──────────────────────────────────────────────────────────────────

describe('parseWatchLine — name: value format', () => {
  it('parses single name: value pair', () => {
    const result = parseWatchLine('temp: 22.5');
    expect(result).not.toBeNull();
    expect(result!.format).toBe('name_colon');
    expect(result!.values.get('temp')).toBe(22.5);
  });

  it('parses comma-separated name: value pairs', () => {
    const result = parseWatchLine('temp: 22.5, hum: 65');
    expect(result).not.toBeNull();
    expect(result!.format).toBe('name_colon');
    expect(result!.values.size).toBe(2);
    expect(result!.values.get('temp')).toBe(22.5);
    expect(result!.values.get('hum')).toBe(65);
  });

  it('handles no space after colon', () => {
    const result = parseWatchLine('temp:22.5');
    expect(result).not.toBeNull();
    expect(result!.format).toBe('name_colon');
    expect(result!.values.get('temp')).toBe(22.5);
  });

  it('parses negative values with colon format', () => {
    const result = parseWatchLine('temp: -3.5');
    expect(result).not.toBeNull();
    expect(result!.values.get('temp')).toBe(-3.5);
  });

  it('parses scientific notation', () => {
    const result = parseWatchLine('val: 1.5e3');
    expect(result).not.toBeNull();
    expect(result!.values.get('val')).toBe(1500);
  });
});

// ──────────────────────────────────────────────────────────────────
// parseWatchLine — Format 3: CSV numbers
// ──────────────────────────────────────────────────────────────────

describe('parseWatchLine — CSV format', () => {
  it('parses comma-separated numbers', () => {
    const result = parseWatchLine('1.23,4.56,7.89');
    expect(result).not.toBeNull();
    expect(result!.format).toBe('csv');
    expect(result!.values.size).toBe(3);
    expect(result!.values.get('var0')).toBe(1.23);
    expect(result!.values.get('var1')).toBe(4.56);
    expect(result!.values.get('var2')).toBe(7.89);
  });

  it('parses single CSV number', () => {
    const result = parseWatchLine('42');
    expect(result).not.toBeNull();
    expect(result!.format).toBe('csv');
    expect(result!.values.get('var0')).toBe(42);
  });

  it('parses CSV with spaces after commas', () => {
    const result = parseWatchLine('1.0, 2.0, 3.0');
    expect(result).not.toBeNull();
    expect(result!.format).toBe('csv');
    expect(result!.values.size).toBe(3);
  });

  it('returns null for non-numeric CSV', () => {
    expect(parseWatchLine('hello,world')).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────
// parseWatchLine — Format 4: JSON
// ──────────────────────────────────────────────────────────────────

describe('parseWatchLine — JSON format', () => {
  it('parses JSON object with numeric values', () => {
    const result = parseWatchLine('{"temp":22.5,"hum":65}');
    expect(result).not.toBeNull();
    expect(result!.format).toBe('json');
    expect(result!.values.get('temp')).toBe(22.5);
    expect(result!.values.get('hum')).toBe(65);
  });

  it('parses JSON with string numeric values', () => {
    const result = parseWatchLine('{"val":"42.5"}');
    expect(result).not.toBeNull();
    expect(result!.format).toBe('json');
    expect(result!.values.get('val')).toBe(42.5);
  });

  it('ignores non-numeric JSON values', () => {
    const result = parseWatchLine('{"name":"sensor","temp":22.5}');
    expect(result).not.toBeNull();
    expect(result!.format).toBe('json');
    expect(result!.values.size).toBe(1);
    expect(result!.values.get('temp')).toBe(22.5);
  });

  it('returns null for JSON array', () => {
    expect(parseWatchLine('[1,2,3]')).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(parseWatchLine('{invalid}')).toBeNull();
  });

  it('returns null for JSON with no numeric values', () => {
    expect(parseWatchLine('{"name":"sensor"}')).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────
// parseWatchLine — Format 5: Tab-separated
// ──────────────────────────────────────────────────────────────────

describe('parseWatchLine — tab-separated format', () => {
  it('parses tab-separated numbers', () => {
    const result = parseWatchLine('1.23\t4.56\t7.89');
    expect(result).not.toBeNull();
    expect(result!.format).toBe('tab');
    expect(result!.values.size).toBe(3);
    expect(result!.values.get('var0')).toBe(1.23);
    expect(result!.values.get('var1')).toBe(4.56);
    expect(result!.values.get('var2')).toBe(7.89);
  });

  it('parses two tab-separated values', () => {
    const result = parseWatchLine('100\t200');
    expect(result).not.toBeNull();
    expect(result!.format).toBe('tab');
    expect(result!.values.size).toBe(2);
  });

  it('returns null for tab-separated non-numbers', () => {
    expect(parseWatchLine('hello\tworld')).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────
// parseWatchLine — edge cases
// ──────────────────────────────────────────────────────────────────

describe('parseWatchLine — edge cases', () => {
  it('returns null for empty string', () => {
    expect(parseWatchLine('')).toBeNull();
  });

  it('returns null for whitespace only', () => {
    expect(parseWatchLine('   ')).toBeNull();
  });

  it('returns null for plain text', () => {
    expect(parseWatchLine('Hello World')).toBeNull();
  });

  it('returns null for debug messages', () => {
    expect(parseWatchLine('Sensor initialized OK')).toBeNull();
  });

  it('handles leading/trailing whitespace', () => {
    const result = parseWatchLine('  temp=22.5  ');
    expect(result).not.toBeNull();
    expect(result!.values.get('temp')).toBe(22.5);
  });

  it('handles Windows line endings', () => {
    const result = parseWatchLine('temp=22.5\r');
    expect(result).not.toBeNull();
    expect(result!.values.get('temp')).toBe(22.5);
  });
});

// ──────────────────────────────────────────────────────────────────
// VariableWatchManager — singleton & factory
// ──────────────────────────────────────────────────────────────────

describe('VariableWatchManager — creation', () => {
  it('getInstance returns the same instance', () => {
    const a = VariableWatchManager.getInstance();
    const b = VariableWatchManager.getInstance();
    expect(a).toBe(b);
  });

  it('create returns a fresh instance', () => {
    const a = VariableWatchManager.create();
    const b = VariableWatchManager.create();
    expect(a).not.toBe(b);
  });
});

// ──────────────────────────────────────────────────────────────────
// VariableWatchManager — ingestion
// ──────────────────────────────────────────────────────────────────

describe('VariableWatchManager — ingestion', () => {
  let mgr: VariableWatchManager;

  beforeEach(() => {
    mgr = VariableWatchManager.create();
  });

  it('ingests a name=value line', () => {
    mgr.ingest('temp=22.5');
    expect(mgr.getVariableCount()).toBe(1);
    expect(mgr.getVariableNames()).toEqual(['temp']);
    expect(mgr.getCurrentValue('temp')).toBe(22.5);
  });

  it('ingests multiple variables from one line', () => {
    mgr.ingest('temp=22.5 hum=65');
    expect(mgr.getVariableCount()).toBe(2);
    expect(mgr.getCurrentValue('temp')).toBe(22.5);
    expect(mgr.getCurrentValue('hum')).toBe(65);
  });

  it('accumulates data points over multiple ingestions', () => {
    mgr.ingest('val=1');
    mgr.ingest('val=2');
    mgr.ingest('val=3');
    expect(mgr.getVariableData('val')).toHaveLength(3);
    expect(mgr.getCurrentValue('val')).toBe(3);
  });

  it('ignores non-parseable lines', () => {
    mgr.ingest('Hello World');
    mgr.ingest('Sensor OK');
    mgr.ingest('');
    expect(mgr.getVariableCount()).toBe(0);
    expect(mgr.getTotalSamples()).toBe(0);
  });

  it('tracks total sample count', () => {
    mgr.ingest('a=1');
    mgr.ingest('a=2');
    mgr.ingest('a=3');
    expect(mgr.getTotalSamples()).toBe(3);
  });

  it('tracks detected format', () => {
    mgr.ingest('temp=22.5');
    expect(mgr.getDetectedFormat()).toBe('name_value');
  });

  it('updates detected format on new format', () => {
    mgr.ingest('temp=22.5');
    expect(mgr.getDetectedFormat()).toBe('name_value');
    mgr.ingest('{"temp":23.0}');
    expect(mgr.getDetectedFormat()).toBe('json');
  });

  it('handles CSV ingestion', () => {
    mgr.ingest('1.0,2.0,3.0');
    expect(mgr.getVariableCount()).toBe(3);
    expect(mgr.getVariableNames()).toEqual(['var0', 'var1', 'var2']);
  });

  it('handles tab ingestion', () => {
    mgr.ingest('10\t20\t30');
    expect(mgr.getVariableCount()).toBe(3);
    expect(mgr.getCurrentValue('var0')).toBe(10);
  });

  it('handles JSON ingestion', () => {
    mgr.ingest('{"x":1,"y":2}');
    expect(mgr.getVariableCount()).toBe(2);
    expect(mgr.getCurrentValue('x')).toBe(1);
    expect(mgr.getCurrentValue('y')).toBe(2);
  });

  it('handles colon format ingestion', () => {
    mgr.ingest('temp: 22.5, hum: 65');
    expect(mgr.getVariableCount()).toBe(2);
    expect(mgr.getCurrentValue('temp')).toBe(22.5);
  });
});

// ──────────────────────────────────────────────────────────────────
// VariableWatchManager — history limits
// ──────────────────────────────────────────────────────────────────

describe('VariableWatchManager — history limits', () => {
  it('enforces max history points', () => {
    const mgr = VariableWatchManager.create(10);
    for (let i = 0; i < 20; i++) {
      mgr.ingest(`val=${String(i)}`);
    }
    const data = mgr.getVariableData('val');
    expect(data).toHaveLength(10);
    // Should keep the most recent 10 (10-19)
    expect(data[0].value).toBe(10);
    expect(data[9].value).toBe(19);
  });

  it('preserves sequential index even after eviction', () => {
    const mgr = VariableWatchManager.create(5);
    for (let i = 0; i < 10; i++) {
      mgr.ingest(`val=${String(i)}`);
    }
    const data = mgr.getVariableData('val');
    // Indices should be 5,6,7,8,9 (not reset)
    expect(data[0].index).toBe(5);
    expect(data[4].index).toBe(9);
  });

  it('default max is 500', () => {
    const mgr = VariableWatchManager.create();
    for (let i = 0; i < 510; i++) {
      mgr.ingest(`val=${String(i)}`);
    }
    expect(mgr.getVariableData('val')).toHaveLength(500);
  });
});

// ──────────────────────────────────────────────────────────────────
// VariableWatchManager — pause/resume
// ──────────────────────────────────────────────────────────────────

describe('VariableWatchManager — pause/resume', () => {
  let mgr: VariableWatchManager;

  beforeEach(() => {
    mgr = VariableWatchManager.create();
  });

  it('drops ingested lines while paused', () => {
    mgr.ingest('val=1');
    mgr.pause();
    mgr.ingest('val=2');
    mgr.ingest('val=3');
    expect(mgr.getCurrentValue('val')).toBe(1);
    expect(mgr.getTotalSamples()).toBe(1);
  });

  it('resumes ingestion after resume()', () => {
    mgr.pause();
    mgr.ingest('val=1');
    mgr.resume();
    mgr.ingest('val=2');
    expect(mgr.getCurrentValue('val')).toBe(2);
    expect(mgr.getTotalSamples()).toBe(1);
  });

  it('togglePause toggles state', () => {
    expect(mgr.isPaused()).toBe(false);
    mgr.togglePause();
    expect(mgr.isPaused()).toBe(true);
    mgr.togglePause();
    expect(mgr.isPaused()).toBe(false);
  });

  it('pause is idempotent', () => {
    mgr.pause();
    mgr.pause();
    expect(mgr.isPaused()).toBe(true);
  });

  it('resume is idempotent', () => {
    mgr.resume();
    mgr.resume();
    expect(mgr.isPaused()).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────
// VariableWatchManager — clear
// ──────────────────────────────────────────────────────────────────

describe('VariableWatchManager — clear', () => {
  it('clears all variables and resets state', () => {
    const mgr = VariableWatchManager.create();
    mgr.ingest('a=1');
    mgr.ingest('b=2');
    mgr.clear();
    expect(mgr.getVariableCount()).toBe(0);
    expect(mgr.getVariableNames()).toEqual([]);
    expect(mgr.getTotalSamples()).toBe(0);
    expect(mgr.getDetectedFormat()).toBeNull();
  });

  it('allows re-ingestion after clear', () => {
    const mgr = VariableWatchManager.create();
    mgr.ingest('x=1');
    mgr.clear();
    mgr.ingest('y=2');
    expect(mgr.getVariableCount()).toBe(1);
    expect(mgr.getVariableNames()).toEqual(['y']);
  });
});

// ──────────────────────────────────────────────────────────────────
// VariableWatchManager — removeVariable
// ──────────────────────────────────────────────────────────────────

describe('VariableWatchManager — removeVariable', () => {
  it('removes a specific variable', () => {
    const mgr = VariableWatchManager.create();
    mgr.ingest('a=1 b=2 c=3');
    mgr.removeVariable('b');
    expect(mgr.getVariableCount()).toBe(2);
    expect(mgr.getVariableNames()).toEqual(['a', 'c']);
    expect(mgr.getCurrentValue('b')).toBeNull();
  });

  it('does nothing for non-existent variable', () => {
    const mgr = VariableWatchManager.create();
    mgr.ingest('a=1');
    mgr.removeVariable('nonexistent');
    expect(mgr.getVariableCount()).toBe(1);
  });
});

// ──────────────────────────────────────────────────────────────────
// VariableWatchManager — getCurrentValue
// ──────────────────────────────────────────────────────────────────

describe('VariableWatchManager — getCurrentValue', () => {
  it('returns null for unknown variable', () => {
    const mgr = VariableWatchManager.create();
    expect(mgr.getCurrentValue('unknown')).toBeNull();
  });

  it('returns latest value', () => {
    const mgr = VariableWatchManager.create();
    mgr.ingest('val=10');
    mgr.ingest('val=20');
    mgr.ingest('val=30');
    expect(mgr.getCurrentValue('val')).toBe(30);
  });
});

// ──────────────────────────────────────────────────────────────────
// VariableWatchManager — subscription
// ──────────────────────────────────────────────────────────────────

describe('VariableWatchManager — subscription', () => {
  it('notifies listeners on ingest', () => {
    const mgr = VariableWatchManager.create();
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.ingest('val=1');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies on pause/resume', () => {
    const mgr = VariableWatchManager.create();
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.pause();
    mgr.resume();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('notifies on clear', () => {
    const mgr = VariableWatchManager.create();
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.clear();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe removes listener', () => {
    const mgr = VariableWatchManager.create();
    const listener = vi.fn();
    const unsub = mgr.subscribe(listener);
    unsub();
    mgr.ingest('val=1');
    expect(listener).not.toHaveBeenCalled();
  });

  it('does not notify on non-parseable ingest', () => {
    const mgr = VariableWatchManager.create();
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.ingest('Hello World');
    expect(listener).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────
// VariableWatchManager — snapshot
// ──────────────────────────────────────────────────────────────────

describe('VariableWatchManager — snapshot', () => {
  it('returns consistent snapshot', () => {
    const mgr = VariableWatchManager.create();
    mgr.ingest('temp=22.5 hum=65');
    const snap = mgr.getSnapshot();
    expect(snap.variables).toHaveLength(2);
    expect(snap.paused).toBe(false);
    expect(snap.totalSamples).toBe(1);
    expect(snap.detectedFormat).toBe('name_value');
  });

  it('snapshot variables have stats', () => {
    const mgr = VariableWatchManager.create();
    mgr.ingest('val=10');
    mgr.ingest('val=20');
    mgr.ingest('val=30');
    const snap = mgr.getSnapshot();
    const varInfo = snap.variables.find((v) => v.name === 'val');
    expect(varInfo).toBeDefined();
    expect(varInfo!.stats.current).toBe(30);
    expect(varInfo!.stats.min).toBe(10);
    expect(varInfo!.stats.max).toBe(30);
    expect(varInfo!.stats.avg).toBe(20);
    expect(varInfo!.stats.count).toBe(3);
  });

  it('caches snapshot until data changes', () => {
    const mgr = VariableWatchManager.create();
    mgr.ingest('val=1');
    const snap1 = mgr.getSnapshot();
    const snap2 = mgr.getSnapshot();
    expect(snap1).toBe(snap2); // same reference
  });

  it('invalidates cache on new data', () => {
    const mgr = VariableWatchManager.create();
    mgr.ingest('val=1');
    const snap1 = mgr.getSnapshot();
    mgr.ingest('val=2');
    const snap2 = mgr.getSnapshot();
    expect(snap1).not.toBe(snap2);
  });

  it('empty snapshot has no variables', () => {
    const mgr = VariableWatchManager.create();
    const snap = mgr.getSnapshot();
    expect(snap.variables).toHaveLength(0);
    expect(snap.totalSamples).toBe(0);
    expect(snap.detectedFormat).toBeNull();
  });

  it('snapshot reflects paused state', () => {
    const mgr = VariableWatchManager.create();
    mgr.pause();
    expect(mgr.getSnapshot().paused).toBe(true);
    mgr.resume();
    expect(mgr.getSnapshot().paused).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────
// VariableWatchManager — stats computation
// ──────────────────────────────────────────────────────────────────

describe('VariableWatchManager — stats', () => {
  it('computes correct min/max/avg for varied data', () => {
    const mgr = VariableWatchManager.create();
    mgr.ingest('val=5');
    mgr.ingest('val=10');
    mgr.ingest('val=15');
    mgr.ingest('val=20');
    mgr.ingest('val=25');
    const snap = mgr.getSnapshot();
    const stats = snap.variables[0].stats;
    expect(stats.min).toBe(5);
    expect(stats.max).toBe(25);
    expect(stats.avg).toBe(15);
    expect(stats.current).toBe(25);
    expect(stats.count).toBe(5);
  });

  it('handles all-same values', () => {
    const mgr = VariableWatchManager.create();
    mgr.ingest('val=42');
    mgr.ingest('val=42');
    mgr.ingest('val=42');
    const snap = mgr.getSnapshot();
    const stats = snap.variables[0].stats;
    expect(stats.min).toBe(42);
    expect(stats.max).toBe(42);
    expect(stats.avg).toBe(42);
  });

  it('handles negative values in stats', () => {
    const mgr = VariableWatchManager.create();
    mgr.ingest('val=-10');
    mgr.ingest('val=5');
    mgr.ingest('val=-3');
    const snap = mgr.getSnapshot();
    const stats = snap.variables[0].stats;
    expect(stats.min).toBe(-10);
    expect(stats.max).toBe(5);
  });

  it('handles single data point stats', () => {
    const mgr = VariableWatchManager.create();
    mgr.ingest('val=99');
    const snap = mgr.getSnapshot();
    const stats = snap.variables[0].stats;
    expect(stats.current).toBe(99);
    expect(stats.min).toBe(99);
    expect(stats.max).toBe(99);
    expect(stats.avg).toBe(99);
    expect(stats.count).toBe(1);
    expect(stats.rate).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// VariableWatchManager — data point timestamps
// ──────────────────────────────────────────────────────────────────

describe('VariableWatchManager — timestamps', () => {
  it('data points have timestamps', () => {
    const mgr = VariableWatchManager.create();
    const before = Date.now();
    mgr.ingest('val=1');
    const after = Date.now();
    const data = mgr.getVariableData('val');
    expect(data[0].timestamp).toBeGreaterThanOrEqual(before);
    expect(data[0].timestamp).toBeLessThanOrEqual(after);
  });

  it('data points have sequential indices', () => {
    const mgr = VariableWatchManager.create();
    mgr.ingest('val=1');
    mgr.ingest('val=2');
    mgr.ingest('val=3');
    const data = mgr.getVariableData('val');
    expect(data[0].index).toBe(0);
    expect(data[1].index).toBe(1);
    expect(data[2].index).toBe(2);
  });
});

// ──────────────────────────────────────────────────────────────────
// VariableWatchManager — mixed format resilience
// ──────────────────────────────────────────────────────────────────

describe('VariableWatchManager — mixed formats', () => {
  it('handles switching between formats', () => {
    const mgr = VariableWatchManager.create();
    mgr.ingest('temp=22.5');
    mgr.ingest('{"temp":23.0}');
    mgr.ingest('temp: 24.0');
    expect(mgr.getCurrentValue('temp')).toBe(24.0);
    expect(mgr.getVariableData('temp')).toHaveLength(3);
  });

  it('handles interspersed non-parseable lines', () => {
    const mgr = VariableWatchManager.create();
    mgr.ingest('val=1');
    mgr.ingest('--- debug info ---');
    mgr.ingest('val=2');
    mgr.ingest('Sensor OK');
    mgr.ingest('val=3');
    expect(mgr.getVariableData('val')).toHaveLength(3);
    expect(mgr.getTotalSamples()).toBe(3);
  });

  it('preserves variable order across formats', () => {
    const mgr = VariableWatchManager.create();
    mgr.ingest('alpha=1 beta=2');
    mgr.ingest('gamma=3');
    expect(mgr.getVariableNames()).toEqual(['alpha', 'beta', 'gamma']);
  });
});

// ──────────────────────────────────────────────────────────────────
// VariableWatchManager — getVariableData returns copies
// ──────────────────────────────────────────────────────────────────

describe('VariableWatchManager — immutability', () => {
  it('getVariableData returns a copy', () => {
    const mgr = VariableWatchManager.create();
    mgr.ingest('val=1');
    const data1 = mgr.getVariableData('val');
    const data2 = mgr.getVariableData('val');
    expect(data1).not.toBe(data2);
    expect(data1).toEqual(data2);
  });

  it('getVariableNames returns a copy', () => {
    const mgr = VariableWatchManager.create();
    mgr.ingest('a=1 b=2');
    const names1 = mgr.getVariableNames();
    const names2 = mgr.getVariableNames();
    expect(names1).not.toBe(names2);
    expect(names1).toEqual(names2);
  });
});
