import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  OscilloscopeEngine,
  TIMEBASE_TO_SECONDS,
  TIMEBASE_VALUES,
  HORIZONTAL_DIVS,
  VOLTS_PER_DIV_VALUES,
} from '../oscilloscope-engine';
import type { TimebaseValue } from '../oscilloscope-engine';

describe('OscilloscopeEngine', () => {
  let engine: OscilloscopeEngine;

  beforeEach(() => {
    engine = new OscilloscopeEngine(1000);
  });

  describe('initialization', () => {
    it('creates 4 channels with only channel 0 enabled', () => {
      const state = engine.getState();
      expect(state.channels).toHaveLength(4);
      expect(state.channels[0]?.enabled).toBe(true);
      expect(state.channels[1]?.enabled).toBe(false);
      expect(state.channels[2]?.enabled).toBe(false);
      expect(state.channels[3]?.enabled).toBe(false);
    });

    it('initializes with default timebase of 1ms', () => {
      expect(engine.getState().timebase).toBe('1ms');
    });

    it('initializes in running state', () => {
      expect(engine.getState().running).toBe(true);
    });

    it('initializes trigger enabled on channel 0 rising edge', () => {
      const trigger = engine.getState().trigger;
      expect(trigger.channelIndex).toBe(0);
      expect(trigger.edge).toBe('rising');
      expect(trigger.level).toBe(0);
      expect(trigger.enabled).toBe(true);
    });

    it('assigns distinct colors to each channel', () => {
      const colors = engine.getState().channels.map((ch) => ch.color);
      const uniqueColors = new Set(colors);
      expect(uniqueColors.size).toBe(4);
    });

    it('initializes with null cursors', () => {
      expect(engine.getState().cursorA).toBeNull();
      expect(engine.getState().cursorB).toBeNull();
    });

    it('uses the provided buffer capacity', () => {
      expect(engine.getBufferCapacity()).toBe(1000);
    });
  });

  describe('channel control', () => {
    it('enables and disables channels', () => {
      engine.setChannelEnabled(1, true);
      expect(engine.getChannel(1)?.enabled).toBe(true);

      engine.setChannelEnabled(1, false);
      expect(engine.getChannel(1)?.enabled).toBe(false);
    });

    it('ignores invalid channel index', () => {
      engine.setChannelEnabled(99, true);
      // Should not throw
    });

    it('sets probe connection and clears buffer', () => {
      // Push some samples first
      engine.setProbeConnection(0, 'node-1');
      engine.pushSamples(0.001, { 0: 3.3 });
      expect(engine.getChannel(0)?.sampleCount).toBe(1);

      // Change probe — buffer should clear
      engine.setProbeConnection(0, 'node-2');
      expect(engine.getChannel(0)?.probeNodeId).toBe('node-2');
      expect(engine.getChannel(0)?.sampleCount).toBe(0);
    });

    it('disconnects probe with null', () => {
      engine.setProbeConnection(0, 'node-1');
      engine.setProbeConnection(0, null);
      expect(engine.getChannel(0)?.probeNodeId).toBeNull();
    });

    it('sets volts per division with minimum clamp', () => {
      engine.setVoltsPerDiv(0, 0.5);
      expect(engine.getChannel(0)?.voltsPerDiv).toBe(0.5);

      engine.setVoltsPerDiv(0, 0.0001);
      expect(engine.getChannel(0)?.voltsPerDiv).toBe(0.001);
    });

    it('sets vertical offset', () => {
      engine.setOffset(0, 2.5);
      expect(engine.getChannel(0)?.offset).toBe(2.5);

      engine.setOffset(0, -1.5);
      expect(engine.getChannel(0)?.offset).toBe(-1.5);
    });
  });

  describe('sample ingestion', () => {
    beforeEach(() => {
      engine.setProbeConnection(0, 'node-1');
    });

    it('pushes samples into the buffer', () => {
      engine.pushSamples(0.001, { 0: 3.3 });
      engine.pushSamples(0.002, { 0: 3.4 });
      expect(engine.getChannel(0)?.sampleCount).toBe(2);
    });

    it('ignores samples when not running', () => {
      engine.setRunning(false);
      engine.pushSamples(0.001, { 0: 3.3 });
      expect(engine.getChannel(0)?.sampleCount).toBe(0);
    });

    it('ignores samples for disabled channels', () => {
      engine.setChannelEnabled(0, false);
      engine.pushSamples(0.001, { 0: 3.3 });
      expect(engine.getChannel(0)?.sampleCount).toBe(0);
    });

    it('ignores samples for disconnected probes', () => {
      engine.setProbeConnection(0, null);
      engine.pushSamples(0.001, { 0: 3.3 });
      expect(engine.getChannel(0)?.sampleCount).toBe(0);
    });

    it('wraps around in the circular buffer', () => {
      const smallEngine = new OscilloscopeEngine(5);
      smallEngine.setProbeConnection(0, 'node-1');

      for (let i = 0; i < 8; i++) {
        smallEngine.pushSamples(i * 0.001, { 0: i });
      }

      const ch = smallEngine.getChannel(0);
      expect(ch?.sampleCount).toBe(5); // Capped at buffer capacity
      expect(ch?.writeIndex).toBe(3); // 8 % 5 = 3
    });

    it('infers sample rate from timestamps', () => {
      engine.pushSamples(0.000, { 0: 0 });
      engine.pushSamples(0.001, { 0: 1 });
      expect(engine.getSampleRate()).toBeCloseTo(1000, 0);
    });

    it('pushes to multiple channels simultaneously', () => {
      engine.setChannelEnabled(1, true);
      engine.setProbeConnection(1, 'node-2');

      engine.pushSamples(0.001, { 0: 3.3, 1: 5.0 });

      expect(engine.getChannel(0)?.sampleCount).toBe(1);
      expect(engine.getChannel(1)?.sampleCount).toBe(1);
    });
  });

  describe('timebase control', () => {
    it('sets timebase directly', () => {
      engine.setTimebase('10us');
      expect(engine.getState().timebase).toBe('10us');
    });

    it('steps timebase faster', () => {
      engine.setTimebase('1ms');
      engine.timebaseFaster();
      expect(engine.getState().timebase).toBe('500us');
    });

    it('steps timebase slower', () => {
      engine.setTimebase('1ms');
      engine.timebaseSlower();
      expect(engine.getState().timebase).toBe('2ms');
    });

    it('does not step faster below minimum', () => {
      engine.setTimebase('1us');
      engine.timebaseFaster();
      expect(engine.getState().timebase).toBe('1us');
    });

    it('does not step slower above maximum', () => {
      engine.setTimebase('1s');
      engine.timebaseSlower();
      expect(engine.getState().timebase).toBe('1s');
    });

    it('has valid TIMEBASE_TO_SECONDS mapping for all values', () => {
      for (const tb of TIMEBASE_VALUES) {
        const seconds = TIMEBASE_TO_SECONDS[tb];
        expect(seconds).toBeGreaterThan(0);
      }
    });
  });

  describe('trigger', () => {
    it('updates trigger configuration', () => {
      engine.setTrigger({ edge: 'falling', level: 2.5 });
      const trigger = engine.getState().trigger;
      expect(trigger.edge).toBe('falling');
      expect(trigger.level).toBe(2.5);
      expect(trigger.channelIndex).toBe(0); // Unchanged
    });

    it('finds rising edge trigger in buffer', () => {
      engine.setProbeConnection(0, 'node-1');
      engine.setTrigger({ edge: 'rising', level: 2.5, enabled: true });

      // Push samples that cross 2.5V upward
      const voltages = [0, 1, 2, 3, 4, 3, 2, 1, 0];
      voltages.forEach((v, i) => {
        engine.pushSamples(i * 0.001, { 0: v });
      });

      const trigIdx = engine.findTriggerIndex(0);
      expect(trigIdx).toBeGreaterThanOrEqual(0);
    });

    it('finds falling edge trigger in buffer', () => {
      engine.setProbeConnection(0, 'node-1');
      engine.setTrigger({ edge: 'falling', level: 2.5, enabled: true });

      const voltages = [0, 1, 2, 3, 4, 3, 2, 1, 0];
      voltages.forEach((v, i) => {
        engine.pushSamples(i * 0.001, { 0: v });
      });

      const trigIdx = engine.findTriggerIndex(0);
      expect(trigIdx).toBeGreaterThanOrEqual(0);
    });

    it('returns -1 when no trigger found', () => {
      engine.setProbeConnection(0, 'node-1');
      engine.setTrigger({ edge: 'rising', level: 100, enabled: true });

      // All samples below trigger level
      for (let i = 0; i < 10; i++) {
        engine.pushSamples(i * 0.001, { 0: 1 });
      }

      expect(engine.findTriggerIndex(0)).toBe(-1);
    });

    it('returns 0 when trigger is disabled', () => {
      engine.setProbeConnection(0, 'node-1');
      engine.setTrigger({ enabled: false });

      engine.pushSamples(0.001, { 0: 1 });
      engine.pushSamples(0.002, { 0: 2 });

      expect(engine.findTriggerIndex(0)).toBe(0);
    });

    it('returns -1 for empty buffer', () => {
      expect(engine.findTriggerIndex(0)).toBe(-1);
    });
  });

  describe('getDisplaySamples', () => {
    it('returns empty array for empty channel', () => {
      expect(engine.getDisplaySamples(0)).toEqual([]);
    });

    it('returns samples with time and voltage', () => {
      engine.setProbeConnection(0, 'node-1');
      engine.setTrigger({ enabled: false });

      for (let i = 0; i < 100; i++) {
        engine.pushSamples(i * 0.001, { 0: Math.sin(i * 0.1) });
      }

      const samples = engine.getDisplaySamples(0);
      expect(samples.length).toBeGreaterThan(0);
      expect(samples[0]).toHaveProperty('time');
      expect(samples[0]).toHaveProperty('voltage');
    });

    it('respects timebase window size', () => {
      engine.setProbeConnection(0, 'node-1');
      engine.setTimebase('10ms');
      engine.setTrigger({ enabled: false });

      // Push 500 samples at 1kHz = 0.5 seconds of data
      for (let i = 0; i < 500; i++) {
        engine.pushSamples(i * 0.001, { 0: i });
      }

      const samples = engine.getDisplaySamples(0);
      // 10ms/div * 10 divs = 100ms window = 100 samples at 1kHz
      expect(samples.length).toBeLessThanOrEqual(500);
      expect(samples.length).toBeGreaterThan(0);
    });
  });

  describe('autoScaleVoltage', () => {
    it('auto-scales to fit waveform', () => {
      engine.setProbeConnection(0, 'node-1');

      // Push a 0-5V signal
      for (let i = 0; i < 100; i++) {
        engine.pushSamples(i * 0.001, { 0: (i / 100) * 5 });
      }

      engine.autoScaleVoltage(0);

      const ch = engine.getChannel(0);
      expect(ch?.voltsPerDiv).toBeGreaterThan(0);
      // Should choose a V/div that fits 5V range in ~6 divs
      // 5 / 6 ≈ 0.83, so closest standard is 1
      expect(ch?.voltsPerDiv).toBe(1);
    });

    it('handles flat signal (zero range)', () => {
      engine.setProbeConnection(0, 'node-1');

      for (let i = 0; i < 50; i++) {
        engine.pushSamples(i * 0.001, { 0: 3.3 });
      }

      engine.autoScaleVoltage(0);
      expect(engine.getChannel(0)?.voltsPerDiv).toBe(1);
    });

    it('does nothing for empty channel', () => {
      const origV = engine.getChannel(0)?.voltsPerDiv;
      engine.autoScaleVoltage(0);
      expect(engine.getChannel(0)?.voltsPerDiv).toBe(origV);
    });

    it('centers the waveform vertically', () => {
      engine.setProbeConnection(0, 'node-1');

      // Signal from 2V to 4V — midpoint = 3V
      for (let i = 0; i < 100; i++) {
        engine.pushSamples(i * 0.001, { 0: 2 + (i / 100) * 2 });
      }

      engine.autoScaleVoltage(0);
      const offset = engine.getChannel(0)?.offset ?? 0;
      expect(offset).toBeCloseTo(-3, 1);
    });
  });

  describe('cursors', () => {
    beforeEach(() => {
      engine.setProbeConnection(0, 'node-1');
      engine.setTrigger({ enabled: false });

      for (let i = 0; i < 100; i++) {
        engine.pushSamples(i * 0.001, { 0: i * 0.1 });
      }
    });

    it('sets cursor A', () => {
      engine.setCursor('A', 0.01);
      expect(engine.getState().cursorA).not.toBeNull();
      expect(engine.getState().cursorA?.time).toBe(0.01);
    });

    it('sets cursor B', () => {
      engine.setCursor('B', 0.05);
      expect(engine.getState().cursorB).not.toBeNull();
      expect(engine.getState().cursorB?.time).toBe(0.05);
    });

    it('clears cursors', () => {
      engine.setCursor('A', 0.01);
      engine.setCursor('B', 0.05);
      engine.clearCursors();
      expect(engine.getState().cursorA).toBeNull();
      expect(engine.getState().cursorB).toBeNull();
    });

    it('measures delta between cursors', () => {
      engine.setCursor('A', 0.01);
      engine.setCursor('B', 0.05);

      const measurement = engine.getCursorMeasurement();
      expect(measurement).not.toBeNull();
      expect(measurement?.deltaTime).toBeCloseTo(0.04, 5);
      expect(measurement?.deltaVoltages[0]).toBeDefined();
    });

    it('returns null measurement without both cursors', () => {
      engine.setCursor('A', 0.01);
      expect(engine.getCursorMeasurement()).toBeNull();
    });
  });

  describe('run control', () => {
    it('stops and resumes capture', () => {
      engine.setProbeConnection(0, 'node-1');

      engine.pushSamples(0.001, { 0: 1 });
      expect(engine.getChannel(0)?.sampleCount).toBe(1);

      engine.setRunning(false);
      engine.pushSamples(0.002, { 0: 2 });
      expect(engine.getChannel(0)?.sampleCount).toBe(1); // No change

      engine.setRunning(true);
      engine.pushSamples(0.003, { 0: 3 });
      expect(engine.getChannel(0)?.sampleCount).toBe(2);
    });

    it('clears all buffers', () => {
      engine.setProbeConnection(0, 'node-1');
      engine.pushSamples(0.001, { 0: 1 });
      engine.setCursor('A', 0.001);

      engine.clearBuffers();

      expect(engine.getChannel(0)?.sampleCount).toBe(0);
      expect(engine.getState().cursorA).toBeNull();
    });
  });

  describe('subscribe', () => {
    it('notifies on sample push', () => {
      engine.setProbeConnection(0, 'node-1');
      const listener = vi.fn();
      engine.subscribe(listener);

      engine.pushSamples(0.001, { 0: 1 });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies on channel enable/disable', () => {
      const listener = vi.fn();
      engine.subscribe(listener);

      engine.setChannelEnabled(1, true);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies on timebase change', () => {
      const listener = vi.fn();
      engine.subscribe(listener);

      engine.setTimebase('10us');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('stops notifying after unsubscribe', () => {
      const listener = vi.fn();
      const unsub = engine.subscribe(listener);

      engine.setTimebase('10us');
      expect(listener).toHaveBeenCalledTimes(1);

      unsub();

      engine.setTimebase('1ms');
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('constants', () => {
    it('TIMEBASE_VALUES are ordered by seconds ascending', () => {
      for (let i = 1; i < TIMEBASE_VALUES.length; i++) {
        const prev = TIMEBASE_TO_SECONDS[TIMEBASE_VALUES[i - 1] as TimebaseValue] ?? 0;
        const cur = TIMEBASE_TO_SECONDS[TIMEBASE_VALUES[i] as TimebaseValue] ?? 0;
        expect(cur).toBeGreaterThan(prev);
      }
    });

    it('VOLTS_PER_DIV_VALUES are ordered ascending', () => {
      for (let i = 1; i < VOLTS_PER_DIV_VALUES.length; i++) {
        expect(VOLTS_PER_DIV_VALUES[i]).toBeGreaterThan(VOLTS_PER_DIV_VALUES[i - 1] ?? 0);
      }
    });

    it('HORIZONTAL_DIVS is 10', () => {
      expect(HORIZONTAL_DIVS).toBe(10);
    });
  });
});
