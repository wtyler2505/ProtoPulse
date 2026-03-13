import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parseLine,
  SerialPlotterManager,
  DEFAULT_CHANNEL_COLORS,
  MAX_BUFFER_SIZE,
  DEFAULT_TIME_WINDOW_SECONDS,
  DEFAULT_MAX_CHANNELS,
  getSerialPlotterManager,
  resetSerialPlotterManager,
} from '../serial-plotter';

// ---------------------------------------------------------------------------
// parseLine
// ---------------------------------------------------------------------------

describe('parseLine', () => {
  it('parses comma-separated values', () => {
    expect(parseLine('1,2,3')).toEqual([1, 2, 3]);
  });

  it('parses tab-separated values', () => {
    expect(parseLine('10\t20\t30')).toEqual([10, 20, 30]);
  });

  it('parses space-separated values', () => {
    expect(parseLine('1.5 2.5 3.5')).toEqual([1.5, 2.5, 3.5]);
  });

  it('parses mixed separators (comma + space)', () => {
    expect(parseLine('1, 2, 3')).toEqual([1, 2, 3]);
  });

  it('parses negative numbers', () => {
    expect(parseLine('-5,-10.2,3')).toEqual([-5, -10.2, 3]);
  });

  it('parses scientific notation', () => {
    expect(parseLine('1.23e-4,5.6E2,-3.1e+1')).toEqual([1.23e-4, 560, -31]);
  });

  it('parses integer zero', () => {
    expect(parseLine('0,0,0')).toEqual([0, 0, 0]);
  });

  it('returns null for empty string', () => {
    expect(parseLine('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(parseLine('   ')).toBeNull();
  });

  it('returns null for pure text line', () => {
    expect(parseLine('Hello World')).toBeNull();
  });

  it('handles mixed numeric and text tokens', () => {
    const result = parseLine('temp:,25.4,hum:,60');
    expect(result).not.toBeNull();
    // numeric tokens present, text tokens become NaN
    expect(result).toHaveLength(4);
    expect(Number.isNaN(result![0])).toBe(true);
    expect(result![1]).toBe(25.4);
    expect(Number.isNaN(result![2])).toBe(true);
    expect(result![3]).toBe(60);
  });

  it('parses single value', () => {
    expect(parseLine('42')).toEqual([42]);
  });

  it('handles trailing/leading whitespace', () => {
    expect(parseLine('  1, 2, 3  ')).toEqual([1, 2, 3]);
  });

  it('handles large numbers', () => {
    expect(parseLine('999999999,0.000001')).toEqual([999999999, 0.000001]);
  });

  it('parses Infinity as a number', () => {
    const result = parseLine('Infinity,-Infinity');
    expect(result).toEqual([Infinity, -Infinity]);
  });
});

// ---------------------------------------------------------------------------
// SerialPlotterManager — creation and subscription
// ---------------------------------------------------------------------------

describe('SerialPlotterManager', () => {
  let manager: SerialPlotterManager;

  beforeEach(() => {
    manager = SerialPlotterManager.create();
  });

  describe('singleton', () => {
    it('returns the same instance from getSerialPlotterManager', () => {
      resetSerialPlotterManager();
      const a = getSerialPlotterManager();
      const b = getSerialPlotterManager();
      expect(a).toBe(b);
      resetSerialPlotterManager();
    });

    it('returns a new instance after reset', () => {
      resetSerialPlotterManager();
      const a = getSerialPlotterManager();
      resetSerialPlotterManager();
      const b = getSerialPlotterManager();
      expect(a).not.toBe(b);
      resetSerialPlotterManager();
    });
  });

  describe('subscribe', () => {
    it('calls listener on addDataPoint', () => {
      const listener = vi.fn();
      manager.subscribe(listener);
      manager.addDataPoint([1, 2], 1000);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('stops calling listener after unsubscribe', () => {
      const listener = vi.fn();
      const unsub = manager.subscribe(listener);
      unsub();
      manager.addDataPoint([1], 1000);
      expect(listener).not.toHaveBeenCalled();
    });

    it('supports multiple listeners', () => {
      const a = vi.fn();
      const b = vi.fn();
      manager.subscribe(a);
      manager.subscribe(b);
      manager.addDataPoint([1], 1000);
      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // addDataPoint
  // -----------------------------------------------------------------------

  describe('addDataPoint', () => {
    it('adds a single-channel data point', () => {
      manager.addDataPoint([42], 1000);
      const data = manager.getChannelData(0);
      expect(data).toHaveLength(1);
      expect(data[0]).toEqual({ timestamp: 1000, value: 42 });
    });

    it('adds multi-channel data points', () => {
      manager.addDataPoint([10, 20, 30], 1000);
      expect(manager.getChannelData(0)).toHaveLength(1);
      expect(manager.getChannelData(1)).toHaveLength(1);
      expect(manager.getChannelData(2)).toHaveLength(1);
      expect(manager.getChannelData(0)[0].value).toBe(10);
      expect(manager.getChannelData(1)[0].value).toBe(20);
      expect(manager.getChannelData(2)[0].value).toBe(30);
    });

    it('uses Date.now() when no timestamp provided', () => {
      const before = Date.now();
      manager.addDataPoint([1]);
      const after = Date.now();
      const data = manager.getChannelData(0);
      expect(data[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(data[0].timestamp).toBeLessThanOrEqual(after);
    });

    it('auto-creates channels as needed', () => {
      manager.addDataPoint([1, 2, 3], 1000);
      expect(manager.getChannelCount()).toBe(3);
    });

    it('respects maxChannels limit', () => {
      manager.setMaxChannels(2);
      manager.addDataPoint([1, 2, 3, 4], 1000);
      expect(manager.getChannelCount()).toBe(2);
      expect(manager.getChannelData(2)).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Channel management
  // -----------------------------------------------------------------------

  describe('channel management', () => {
    it('assigns default names', () => {
      manager.addDataPoint([1, 2], 1000);
      expect(manager.getChannelName(0)).toBe('Channel 1');
      expect(manager.getChannelName(1)).toBe('Channel 2');
    });

    it('sets custom channel name', () => {
      manager.addDataPoint([1], 1000);
      manager.setChannelName(0, 'Temperature');
      expect(manager.getChannelName(0)).toBe('Temperature');
    });

    it('assigns default colors from palette', () => {
      manager.addDataPoint([1, 2, 3], 1000);
      expect(manager.getChannelColor(0)).toBe(DEFAULT_CHANNEL_COLORS[0]);
      expect(manager.getChannelColor(1)).toBe(DEFAULT_CHANNEL_COLORS[1]);
      expect(manager.getChannelColor(2)).toBe(DEFAULT_CHANNEL_COLORS[2]);
    });

    it('sets custom channel color', () => {
      manager.addDataPoint([1], 1000);
      manager.setChannelColor(0, '#FF0000');
      expect(manager.getChannelColor(0)).toBe('#FF0000');
    });

    it('channels are visible by default', () => {
      manager.addDataPoint([1], 1000);
      expect(manager.isChannelVisible(0)).toBe(true);
    });

    it('can hide and show channels', () => {
      manager.addDataPoint([1], 1000);
      manager.setChannelVisible(0, false);
      expect(manager.isChannelVisible(0)).toBe(false);
      manager.setChannelVisible(0, true);
      expect(manager.isChannelVisible(0)).toBe(true);
    });

    it('getChannelName returns default for uncreated channel', () => {
      expect(manager.getChannelName(99)).toBe('Channel 100');
    });

    it('getChannelColor returns default for uncreated channel', () => {
      expect(manager.getChannelColor(0)).toBe(DEFAULT_CHANNEL_COLORS[0]);
    });
  });

  // -----------------------------------------------------------------------
  // getAllChannels
  // -----------------------------------------------------------------------

  describe('getAllChannels', () => {
    it('returns empty array when no data', () => {
      expect(manager.getAllChannels()).toEqual([]);
    });

    it('returns channel info with data', () => {
      manager.addDataPoint([10, 20], 5000);
      manager.addDataPoint([11, 21], 6000);
      // Set time window large enough and fake last timestamp
      manager.setTimeWindow(60);
      const channels = manager.getAllChannels();
      expect(channels).toHaveLength(2);
      expect(channels[0].index).toBe(0);
      expect(channels[0].name).toBe('Channel 1');
      expect(channels[0].color).toBe(DEFAULT_CHANNEL_COLORS[0]);
      expect(channels[0].visible).toBe(true);
    });

    it('reflects custom names and colors', () => {
      manager.addDataPoint([1], 5000);
      manager.setChannelName(0, 'Temp');
      manager.setChannelColor(0, '#ABC');
      manager.setTimeWindow(60);
      const channels = manager.getAllChannels();
      expect(channels[0].name).toBe('Temp');
      expect(channels[0].color).toBe('#ABC');
    });
  });

  // -----------------------------------------------------------------------
  // Time window
  // -----------------------------------------------------------------------

  describe('time window', () => {
    it('defaults to 10 seconds', () => {
      expect(manager.getTimeWindow()).toBe(DEFAULT_TIME_WINDOW_SECONDS);
    });

    it('sets time window within bounds', () => {
      manager.setTimeWindow(30);
      expect(manager.getTimeWindow()).toBe(30);
    });

    it('clamps time window to minimum', () => {
      manager.setTimeWindow(0);
      expect(manager.getTimeWindow()).toBe(1);
    });

    it('clamps time window to maximum', () => {
      manager.setTimeWindow(120);
      expect(manager.getTimeWindow()).toBe(60);
    });

    it('getVisibleTimeRange returns correct range', () => {
      manager.setTimeWindow(5);
      manager.addDataPoint([1], 10000);
      const range = manager.getVisibleTimeRange();
      expect(range.start).toBe(5000);
      expect(range.end).toBe(10000);
    });
  });

  // -----------------------------------------------------------------------
  // Pause / Resume
  // -----------------------------------------------------------------------

  describe('pause / resume', () => {
    it('is not paused initially', () => {
      expect(manager.isPaused()).toBe(false);
    });

    it('discards data when paused', () => {
      manager.pause();
      manager.addDataPoint([1], 1000);
      expect(manager.getChannelData(0)).toHaveLength(0);
    });

    it('accepts data after resume', () => {
      manager.pause();
      manager.addDataPoint([1], 1000);
      manager.resume();
      manager.addDataPoint([2], 2000);
      expect(manager.getChannelData(0)).toHaveLength(1);
      expect(manager.getChannelData(0)[0].value).toBe(2);
    });

    it('sets paused state correctly', () => {
      manager.pause();
      expect(manager.isPaused()).toBe(true);
      manager.resume();
      expect(manager.isPaused()).toBe(false);
    });

    it('notifies on pause and resume', () => {
      const listener = vi.fn();
      manager.subscribe(listener);
      manager.pause();
      expect(listener).toHaveBeenCalledTimes(1);
      manager.resume();
      expect(listener).toHaveBeenCalledTimes(2);
    });
  });

  // -----------------------------------------------------------------------
  // Ring buffer overflow
  // -----------------------------------------------------------------------

  describe('ring buffer', () => {
    it('stores up to MAX_BUFFER_SIZE points', () => {
      for (let i = 0; i < 100; i++) {
        manager.addDataPoint([i], i * 10);
      }
      expect(manager.getChannelData(0)).toHaveLength(100);
    });

    it('drops oldest when buffer overflows', () => {
      const count = MAX_BUFFER_SIZE + 50;
      for (let i = 0; i < count; i++) {
        manager.addDataPoint([i], i);
      }
      const data = manager.getChannelData(0);
      expect(data).toHaveLength(MAX_BUFFER_SIZE);
      // Oldest should be dropped
      expect(data[0].value).toBe(50);
      expect(data[data.length - 1].value).toBe(count - 1);
    });

    it('maintains order after overflow', () => {
      const count = MAX_BUFFER_SIZE + 100;
      for (let i = 0; i < count; i++) {
        manager.addDataPoint([i], i);
      }
      const data = manager.getChannelData(0);
      for (let i = 1; i < data.length; i++) {
        expect(data[i].timestamp).toBeGreaterThan(data[i - 1].timestamp);
      }
    });

    it('getLatestValue returns the most recent value', () => {
      manager.addDataPoint([1], 1000);
      manager.addDataPoint([2], 2000);
      manager.addDataPoint([3], 3000);
      expect(manager.getLatestValue(0)).toBe(3);
    });

    it('getLatestValue returns null for empty channel', () => {
      expect(manager.getLatestValue(0)).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Export CSV
  // -----------------------------------------------------------------------

  describe('exportCSV', () => {
    it('returns empty string when no data', () => {
      expect(manager.exportCSV()).toBe('');
    });

    it('exports single channel data', () => {
      manager.addDataPoint([10], 1000);
      manager.addDataPoint([20], 2000);
      const csv = manager.exportCSV();
      const lines = csv.split('\n');
      expect(lines[0]).toBe('timestamp,Channel 1');
      expect(lines[1]).toBe('1000,10');
      expect(lines[2]).toBe('2000,20');
    });

    it('exports multi-channel data', () => {
      manager.addDataPoint([10, 20], 1000);
      const csv = manager.exportCSV();
      const lines = csv.split('\n');
      expect(lines[0]).toBe('timestamp,Channel 1,Channel 2');
      expect(lines[1]).toBe('1000,10,20');
    });

    it('uses custom channel names in header', () => {
      manager.addDataPoint([1], 1000);
      manager.setChannelName(0, 'Temperature');
      const csv = manager.exportCSV();
      expect(csv.startsWith('timestamp,Temperature')).toBe(true);
    });

    it('handles NaN values as empty', () => {
      manager.addDataPoint([NaN], 1000);
      const csv = manager.exportCSV();
      const lines = csv.split('\n');
      expect(lines[1]).toBe('1000,');
    });
  });

  // -----------------------------------------------------------------------
  // Y range
  // -----------------------------------------------------------------------

  describe('getYRange', () => {
    it('returns null when no data', () => {
      expect(manager.getYRange()).toBeNull();
    });

    it('computes range with padding', () => {
      manager.setTimeWindow(60);
      manager.addDataPoint([0], 1000);
      manager.addDataPoint([100], 2000);
      const range = manager.getYRange();
      expect(range).not.toBeNull();
      // 10% padding: min = 0 - 10 = -10, max = 100 + 10 = 110
      expect(range!.min).toBe(-10);
      expect(range!.max).toBe(110);
    });

    it('handles single value (creates range around it)', () => {
      manager.setTimeWindow(60);
      manager.addDataPoint([50], 1000);
      const range = manager.getYRange();
      expect(range).not.toBeNull();
      expect(range!.min).toBeLessThan(50);
      expect(range!.max).toBeGreaterThan(50);
    });

    it('handles all same values', () => {
      manager.setTimeWindow(60);
      manager.addDataPoint([5], 1000);
      manager.addDataPoint([5], 2000);
      const range = manager.getYRange();
      expect(range).not.toBeNull();
      expect(range!.min).toBeLessThan(5);
      expect(range!.max).toBeGreaterThan(5);
    });

    it('handles all zeros', () => {
      manager.setTimeWindow(60);
      manager.addDataPoint([0], 1000);
      manager.addDataPoint([0], 2000);
      const range = manager.getYRange();
      expect(range).not.toBeNull();
      expect(range!.min).toBe(-1);
      expect(range!.max).toBe(1);
    });

    it('excludes hidden channels', () => {
      manager.setTimeWindow(60);
      manager.addDataPoint([10, 1000], 1000);
      manager.setChannelVisible(1, false);
      const range = manager.getYRange();
      expect(range).not.toBeNull();
      // Only channel 0 (value=10) should be considered
      expect(range!.max).toBeLessThan(100);
    });

    it('skips NaN values', () => {
      manager.setTimeWindow(60);
      manager.addDataPoint([NaN, 10], 1000);
      manager.addDataPoint([NaN, 20], 2000);
      const range = manager.getYRange();
      expect(range).not.toBeNull();
      expect(range!.min).toBeLessThan(10);
      expect(range!.max).toBeGreaterThan(20);
    });
  });

  // -----------------------------------------------------------------------
  // Clear
  // -----------------------------------------------------------------------

  describe('clear', () => {
    it('removes all channel data', () => {
      manager.addDataPoint([1, 2], 1000);
      manager.clear();
      expect(manager.getChannelCount()).toBe(0);
      expect(manager.getAllChannels()).toEqual([]);
    });

    it('resets channel names and colors', () => {
      manager.addDataPoint([1], 1000);
      manager.setChannelName(0, 'Temp');
      manager.setChannelColor(0, '#FFF');
      manager.clear();
      // After clearing and re-adding, should get defaults
      manager.addDataPoint([1], 2000);
      expect(manager.getChannelName(0)).toBe('Channel 1');
      expect(manager.getChannelColor(0)).toBe(DEFAULT_CHANNEL_COLORS[0]);
    });

    it('notifies listeners', () => {
      const listener = vi.fn();
      manager.subscribe(listener);
      manager.clear();
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles empty values array', () => {
      manager.addDataPoint([], 1000);
      expect(manager.getChannelCount()).toBe(0);
    });

    it('handles NaN values in data points', () => {
      manager.addDataPoint([NaN], 1000);
      expect(manager.getChannelCount()).toBe(1);
      const data = manager.getChannelData(0);
      expect(data).toHaveLength(1);
      expect(Number.isNaN(data[0].value)).toBe(true);
    });

    it('getChannelData returns empty for nonexistent channel', () => {
      expect(manager.getChannelData(99)).toEqual([]);
    });

    it('handles varying column count (fewer columns pad nothing)', () => {
      manager.addDataPoint([1, 2, 3], 1000);
      manager.addDataPoint([4, 5], 2000);
      // Channel 2 should only have 1 point
      expect(manager.getChannelData(2)).toHaveLength(1);
      expect(manager.getChannelData(0)).toHaveLength(2);
    });

    it('handles more than 6 channels (wraps colors)', () => {
      manager.setMaxChannels(6);
      // With max 6, only 6 channels created even if more values
      manager.addDataPoint([1, 2, 3, 4, 5, 6, 7, 8], 1000);
      expect(manager.getChannelCount()).toBe(6);
    });

    it('getTotalPointCount returns sum across all channels', () => {
      manager.addDataPoint([1, 2], 1000);
      manager.addDataPoint([3, 4], 2000);
      expect(manager.getTotalPointCount()).toBe(4);
    });

    it('getChannelDataInWindow returns only windowed data', () => {
      manager.setTimeWindow(5);
      manager.addDataPoint([1], 1000);
      manager.addDataPoint([2], 5000);
      manager.addDataPoint([3], 10000);
      // Window: [10000 - 5000, 10000] = [5000, 10000]
      const windowed = manager.getChannelDataInWindow(0);
      expect(windowed).toHaveLength(2);
      expect(windowed[0].value).toBe(2);
      expect(windowed[1].value).toBe(3);
    });
  });

  // -----------------------------------------------------------------------
  // Max channels
  // -----------------------------------------------------------------------

  describe('maxChannels', () => {
    it('defaults to 6', () => {
      expect(manager.getMaxChannels()).toBe(DEFAULT_MAX_CHANNELS);
    });

    it('can be changed', () => {
      manager.setMaxChannels(3);
      expect(manager.getMaxChannels()).toBe(3);
    });

    it('clamps to minimum of 1', () => {
      manager.setMaxChannels(0);
      expect(manager.getMaxChannels()).toBe(1);
    });

    it('clamps to maximum of palette size', () => {
      manager.setMaxChannels(100);
      expect(manager.getMaxChannels()).toBe(DEFAULT_CHANNEL_COLORS.length);
    });
  });
});
