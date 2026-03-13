import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SimulationAudioOutput,
  getSimulationAudioOutput,
  resetSimulationAudioOutput,
} from '../audio-output';
import type { AudioOutputState } from '../audio-output';

// ---------------------------------------------------------------------------
// Web Audio API mocks
// ---------------------------------------------------------------------------

class MockGainNode {
  gain = { setValueAtTime: vi.fn() };
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockOscillatorNode {
  type: OscillatorType = 'sine';
  frequency = { setValueAtTime: vi.fn() };
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

interface MockAudioContext {
  state: AudioContextState;
  currentTime: number;
  createOscillator: ReturnType<typeof vi.fn>;
  createGain: ReturnType<typeof vi.fn>;
  destination: object;
  resume: ReturnType<typeof vi.fn>;
  suspend: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

function createMockAudioContext(): MockAudioContext {
  return {
    state: 'running' as AudioContextState,
    currentTime: 0,
    createOscillator: vi.fn(() => new MockOscillatorNode()),
    createGain: vi.fn(() => new MockGainNode()),
    destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
    suspend: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

let mockCtx: MockAudioContext;

beforeEach(() => {
  mockCtx = createMockAudioContext();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  (globalThis as Record<string, unknown>).AudioContext = vi.fn(() => mockCtx) as unknown as typeof AudioContext;
});

afterEach(() => {
  resetSimulationAudioOutput();
  delete (globalThis as Record<string, unknown>).AudioContext;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SimulationAudioOutput', () => {
  // -------------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------------

  describe('initialization', () => {
    it('creates with default state', () => {
      const audio = new SimulationAudioOutput();
      const state = audio.getState();

      expect(state.playing).toBe(false);
      expect(state.muted).toBe(false);
      expect(state.frequency).toBe(440);
      expect(state.volume).toBe(0.5);
      expect(state.available).toBe(true);
    });

    it('detects when AudioContext is unavailable', () => {
      delete (globalThis as Record<string, unknown>).AudioContext;

      const audio = new SimulationAudioOutput();
      const state = audio.getState();

      expect(state.available).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // playTone
  // -------------------------------------------------------------------------

  describe('playTone', () => {
    it('starts oscillator at specified frequency', () => {
      const audio = new SimulationAudioOutput();
      audio.playTone(880);

      expect(audio.isPlaying).toBe(true);
      expect(audio.currentFrequency).toBe(880);
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(1);

      const osc = mockCtx.createOscillator.mock.results[0]?.value as MockOscillatorNode;
      expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(880, 0);
      expect(osc.start).toHaveBeenCalledTimes(1);
    });

    it('uses specified waveform', () => {
      const audio = new SimulationAudioOutput();
      audio.playTone(440, 'square');

      const osc = mockCtx.createOscillator.mock.results[0]?.value as MockOscillatorNode;
      expect(osc.type).toBe('square');
    });

    it('defaults to sine waveform', () => {
      const audio = new SimulationAudioOutput();
      audio.playTone(440);

      const osc = mockCtx.createOscillator.mock.results[0]?.value as MockOscillatorNode;
      expect(osc.type).toBe('sine');
    });

    it('updates frequency in-place when already playing', () => {
      const audio = new SimulationAudioOutput();
      audio.playTone(440);
      audio.playTone(880);

      // Should reuse the same oscillator — only 1 created
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(1);
      expect(audio.currentFrequency).toBe(880);

      const osc = mockCtx.createOscillator.mock.results[0]?.value as MockOscillatorNode;
      // setValueAtTime called once at start, then again for in-place update
      expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(880, 0);
    });

    it('updates waveform in-place when already playing', () => {
      const audio = new SimulationAudioOutput();
      audio.playTone(440, 'sine');
      audio.playTone(440, 'sawtooth');

      const osc = mockCtx.createOscillator.mock.results[0]?.value as MockOscillatorNode;
      expect(osc.type).toBe('sawtooth');
    });

    it('resumes suspended AudioContext', () => {
      mockCtx.state = 'suspended';
      const audio = new SimulationAudioOutput();
      audio.playTone(440);

      expect(mockCtx.resume).toHaveBeenCalled();
    });

    it('connects oscillator → gain → destination', () => {
      const audio = new SimulationAudioOutput();
      audio.playTone(440);

      const gain = mockCtx.createGain.mock.results[0]?.value as MockGainNode;
      const osc = mockCtx.createOscillator.mock.results[0]?.value as MockOscillatorNode;

      expect(gain.connect).toHaveBeenCalledWith(mockCtx.destination);
      expect(osc.connect).toHaveBeenCalledWith(gain);
    });

    it('is a no-op when AudioContext is unavailable', () => {
      delete (globalThis as Record<string, unknown>).AudioContext;

      const audio = new SimulationAudioOutput();
      audio.playTone(440);

      expect(audio.isPlaying).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // stopTone
  // -------------------------------------------------------------------------

  describe('stopTone', () => {
    it('stops the oscillator and updates state', () => {
      const audio = new SimulationAudioOutput();
      audio.playTone(440);
      audio.stopTone();

      expect(audio.isPlaying).toBe(false);

      const osc = mockCtx.createOscillator.mock.results[0]?.value as MockOscillatorNode;
      expect(osc.stop).toHaveBeenCalledTimes(1);
      expect(osc.disconnect).toHaveBeenCalledTimes(1);
    });

    it('suspends AudioContext after stopping (auto-suspend)', () => {
      const audio = new SimulationAudioOutput();
      audio.playTone(440);
      audio.stopTone();

      expect(mockCtx.suspend).toHaveBeenCalled();
    });

    it('is a no-op when not playing', () => {
      const audio = new SimulationAudioOutput();
      audio.stopTone();

      expect(audio.isPlaying).toBe(false);
      // No oscillator was ever created
      expect(mockCtx.createOscillator).not.toHaveBeenCalled();
    });

    it('handles oscillator.stop() throwing gracefully', () => {
      const audio = new SimulationAudioOutput();
      audio.playTone(440);

      const osc = mockCtx.createOscillator.mock.results[0]?.value as MockOscillatorNode;
      osc.stop.mockImplementation(() => {
        throw new DOMException('InvalidStateError');
      });

      // Should not throw
      expect(() => { audio.stopTone(); }).not.toThrow();
      expect(audio.isPlaying).toBe(false);
    });

    it('is a no-op when AudioContext is unavailable', () => {
      delete (globalThis as Record<string, unknown>).AudioContext;

      const audio = new SimulationAudioOutput();
      audio.stopTone();

      expect(audio.isPlaying).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // setFrequency
  // -------------------------------------------------------------------------

  describe('setFrequency', () => {
    it('updates frequency while playing', () => {
      const audio = new SimulationAudioOutput();
      audio.playTone(440);
      audio.setFrequency(1000);

      expect(audio.currentFrequency).toBe(1000);

      const osc = mockCtx.createOscillator.mock.results[0]?.value as MockOscillatorNode;
      expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(1000, 0);
    });

    it('updates stored frequency even when not playing', () => {
      const audio = new SimulationAudioOutput();
      audio.setFrequency(2000);

      expect(audio.currentFrequency).toBe(2000);
      expect(audio.getState().frequency).toBe(2000);
    });

    it('handles multiple rapid frequency changes', () => {
      const audio = new SimulationAudioOutput();
      audio.playTone(440);

      audio.setFrequency(500);
      audio.setFrequency(600);
      audio.setFrequency(700);
      audio.setFrequency(800);

      expect(audio.currentFrequency).toBe(800);
      expect(audio.getState().frequency).toBe(800);
    });
  });

  // -------------------------------------------------------------------------
  // Volume control
  // -------------------------------------------------------------------------

  describe('setVolume', () => {
    it('sets volume level', () => {
      const audio = new SimulationAudioOutput();
      audio.playTone(440);
      audio.setVolume(0.8);

      expect(audio.getState().volume).toBe(0.8);

      const gain = mockCtx.createGain.mock.results[0]?.value as MockGainNode;
      expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(0.8, 0);
    });

    it('clamps volume to 0.0–1.0 range', () => {
      const audio = new SimulationAudioOutput();

      audio.setVolume(-0.5);
      expect(audio.getState().volume).toBe(0);

      audio.setVolume(2.0);
      expect(audio.getState().volume).toBe(1);
    });

    it('applies zero gain when muted regardless of volume', () => {
      const audio = new SimulationAudioOutput();
      audio.playTone(440);
      audio.mute();

      const gain = mockCtx.createGain.mock.results[0]?.value as MockGainNode;
      const callsBeforeSetVolume = gain.gain.setValueAtTime.mock.calls.length;

      audio.setVolume(0.9);

      // The call after setVolume should still be 0 because we're muted
      const lastCall = gain.gain.setValueAtTime.mock.calls[gain.gain.setValueAtTime.mock.calls.length - 1] as [number, number];
      expect(lastCall[0]).toBe(0);
      expect(callsBeforeSetVolume).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // Mute / unmute
  // -------------------------------------------------------------------------

  describe('mute/unmute', () => {
    it('mute sets gain to 0', () => {
      const audio = new SimulationAudioOutput();
      audio.playTone(440);
      audio.mute();

      expect(audio.isMuted).toBe(true);
      expect(audio.getState().muted).toBe(true);

      const gain = mockCtx.createGain.mock.results[0]?.value as MockGainNode;
      const lastCall = gain.gain.setValueAtTime.mock.calls[gain.gain.setValueAtTime.mock.calls.length - 1] as [number, number];
      expect(lastCall[0]).toBe(0);
    });

    it('unmute restores gain to volume level', () => {
      const audio = new SimulationAudioOutput();
      audio.setVolume(0.7);
      audio.playTone(440);
      audio.mute();
      audio.unmute();

      expect(audio.isMuted).toBe(false);

      const gain = mockCtx.createGain.mock.results[0]?.value as MockGainNode;
      const lastCall = gain.gain.setValueAtTime.mock.calls[gain.gain.setValueAtTime.mock.calls.length - 1] as [number, number];
      expect(lastCall[0]).toBe(0.7);
    });

    it('mute is idempotent', () => {
      const audio = new SimulationAudioOutput();
      const listener = vi.fn();
      audio.subscribe(listener);

      audio.playTone(440);
      listener.mockClear();

      audio.mute();
      audio.mute(); // second call — should be a no-op

      // Only one notification for the actual mute change
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('unmute is idempotent', () => {
      const audio = new SimulationAudioOutput();
      const listener = vi.fn();
      audio.subscribe(listener);

      audio.playTone(440);
      listener.mockClear();

      audio.unmute(); // already unmuted — should be a no-op

      expect(listener).toHaveBeenCalledTimes(0);
    });

    it('toggleMute switches between muted and unmuted', () => {
      const audio = new SimulationAudioOutput();
      audio.playTone(440);

      expect(audio.isMuted).toBe(false);

      audio.toggleMute();
      expect(audio.isMuted).toBe(true);

      audio.toggleMute();
      expect(audio.isMuted).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // State transitions
  // -------------------------------------------------------------------------

  describe('state transitions', () => {
    it('stopped → playing → stopped', () => {
      const audio = new SimulationAudioOutput();

      expect(audio.getState().playing).toBe(false);

      audio.playTone(440);
      expect(audio.getState().playing).toBe(true);

      audio.stopTone();
      expect(audio.getState().playing).toBe(false);
    });

    it('can play → stop → play again', () => {
      const audio = new SimulationAudioOutput();

      audio.playTone(440);
      audio.stopTone();
      audio.playTone(880);

      expect(audio.isPlaying).toBe(true);
      expect(audio.currentFrequency).toBe(880);

      // Second play creates a new oscillator
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(2);
    });

    it('preserves mute state across play/stop cycles', () => {
      const audio = new SimulationAudioOutput();

      audio.mute();
      audio.playTone(440);
      audio.stopTone();

      expect(audio.isMuted).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Subscribe / notify
  // -------------------------------------------------------------------------

  describe('subscribe', () => {
    it('notifies listeners on state changes', () => {
      const audio = new SimulationAudioOutput();
      const listener = vi.fn();
      audio.subscribe(listener);

      audio.playTone(440);
      expect(listener).toHaveBeenCalledTimes(1);

      audio.stopTone();
      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('unsubscribe stops notifications', () => {
      const audio = new SimulationAudioOutput();
      const listener = vi.fn();
      const unsub = audio.subscribe(listener);

      audio.playTone(440);
      expect(listener).toHaveBeenCalledTimes(1);

      unsub();
      audio.stopTone();
      expect(listener).toHaveBeenCalledTimes(1); // no additional call
    });

    it('getState returns new snapshot object on each change', () => {
      const audio = new SimulationAudioOutput();
      const snap1 = audio.getState();

      audio.playTone(440);
      const snap2 = audio.getState();

      expect(snap1).not.toBe(snap2);
      expect(snap1.playing).toBe(false);
      expect(snap2.playing).toBe(true);
    });

    it('getState returns same object when no changes', () => {
      const audio = new SimulationAudioOutput();
      const snap1 = audio.getState();
      const snap2 = audio.getState();

      expect(snap1).toBe(snap2);
    });
  });

  // -------------------------------------------------------------------------
  // Singleton
  // -------------------------------------------------------------------------

  describe('singleton', () => {
    it('getSimulationAudioOutput returns same instance', () => {
      const a = getSimulationAudioOutput();
      const b = getSimulationAudioOutput();

      expect(a).toBe(b);
    });

    it('resetSimulationAudioOutput creates new instance', () => {
      const a = getSimulationAudioOutput();
      resetSimulationAudioOutput();
      const b = getSimulationAudioOutput();

      expect(a).not.toBe(b);
    });

    it('resetSimulationAudioOutput disposes old instance', () => {
      const a = getSimulationAudioOutput();
      a.playTone(440);

      resetSimulationAudioOutput();

      // The old oscillator should have been stopped
      const osc = mockCtx.createOscillator.mock.results[0]?.value as MockOscillatorNode;
      expect(osc.stop).toHaveBeenCalled();
      expect(mockCtx.close).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Graceful degradation
  // -------------------------------------------------------------------------

  describe('graceful degradation', () => {
    it('all methods are no-ops when AudioContext is unavailable', () => {
      delete (globalThis as Record<string, unknown>).AudioContext;

      const audio = new SimulationAudioOutput();

      // None of these should throw
      audio.playTone(440);
      audio.stopTone();
      audio.setFrequency(880);
      audio.setVolume(0.5);
      audio.mute();
      audio.unmute();
      audio.toggleMute();
      audio.dispose();

      expect(audio.isPlaying).toBe(false);
      expect(audio.getState().available).toBe(false);
    });

    it('handles AudioContext constructor throwing', () => {
      (globalThis as Record<string, unknown>).AudioContext = vi.fn(() => {
        throw new Error('Not supported');
      });

      const audio = new SimulationAudioOutput();
      audio.playTone(440);

      expect(audio.isPlaying).toBe(false);
      expect(audio.getState().available).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // dispose
  // -------------------------------------------------------------------------

  describe('dispose', () => {
    it('cleans up all audio resources', () => {
      const audio = new SimulationAudioOutput();
      audio.playTone(440);
      audio.dispose();

      expect(audio.isPlaying).toBe(false);

      const gain = mockCtx.createGain.mock.results[0]?.value as MockGainNode;
      expect(gain.disconnect).toHaveBeenCalled();
      expect(mockCtx.close).toHaveBeenCalled();
    });

    it('is safe to call multiple times', () => {
      const audio = new SimulationAudioOutput();
      audio.playTone(440);

      expect(() => {
        audio.dispose();
        audio.dispose();
      }).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Snapshot immutability
  // -------------------------------------------------------------------------

  describe('snapshot immutability', () => {
    it('state snapshots are independent objects', () => {
      const audio = new SimulationAudioOutput();

      const s1 = audio.getState();
      audio.playTone(440);
      const s2 = audio.getState();
      audio.setFrequency(880);
      const s3 = audio.getState();

      // Each snapshot is frozen at the time it was taken
      expect(s1.playing).toBe(false);
      expect(s1.frequency).toBe(440);

      expect(s2.playing).toBe(true);
      expect(s2.frequency).toBe(440);

      expect(s3.playing).toBe(true);
      expect(s3.frequency).toBe(880);
    });
  });
});
