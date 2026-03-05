import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  VoiceAIManager,
  computeRMS,
  rmsToDBFS,
  float32ToPCM16,
  pcm16ToFloat32,
} from '../voice-ai';

import type { VoiceAIState } from '../voice-ai';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

class MockMediaStreamTrack {
  kind = 'audio';
  enabled = true;
  readyState = 'live';
  stop = vi.fn(() => {
    this.readyState = 'ended';
  });
}

class MockMediaStream {
  private tracks: MockMediaStreamTrack[];

  constructor(trackCount = 1) {
    this.tracks = Array.from({ length: trackCount }, () => new MockMediaStreamTrack());
  }

  getTracks(): MockMediaStreamTrack[] {
    return this.tracks;
  }

  getAudioTracks(): MockMediaStreamTrack[] {
    return this.tracks;
  }
}

const mockGetUserMedia = vi.fn();

function setupMediaDevices(): void {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: mockGetUserMedia },
    writable: true,
    configurable: true,
  });
}

function removeMediaDevices(): void {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: undefined,
    writable: true,
    configurable: true,
  });
}

// Mock AudioContext
let audioProcessCallback: ((event: { inputBuffer: { getChannelData: (ch: number) => Float32Array } }) => void) | null =
  null;

class MockScriptProcessorNode {
  onaudioprocess:
    | ((event: { inputBuffer: { getChannelData: (ch: number) => Float32Array } }) => void)
    | null = null;

  connect = vi.fn();
  disconnect = vi.fn();
}

class MockAnalyserNode {
  fftSize = 2048;
  smoothingTimeConstant = 0.8;
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockMediaStreamAudioSourceNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockAudioBuffer {
  private data: Float32Array;
  numberOfChannels = 1;
  length: number;
  sampleRate: number;

  constructor(options: { numberOfChannels: number; length: number; sampleRate: number }) {
    this.length = options.length;
    this.sampleRate = options.sampleRate;
    this.data = new Float32Array(options.length);
  }

  getChannelData(_channel: number): Float32Array {
    return this.data;
  }
}

class MockBufferSourceNode {
  buffer: MockAudioBuffer | null = null;
  onended: (() => void) | null = null;
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn(() => {
    // Simulate immediate playback completion
    setTimeout(() => {
      this.onended?.();
    }, 0);
  });
}

let mockProcessorNode: MockScriptProcessorNode;
let mockAnalyserNode: MockAnalyserNode;

class MockAudioContext {
  sampleRate = 16000;
  state: AudioContextState = 'running';
  destination = {};

  createAnalyser = vi.fn(() => {
    mockAnalyserNode = new MockAnalyserNode();
    return mockAnalyserNode;
  });

  createMediaStreamSource = vi.fn(() => new MockMediaStreamAudioSourceNode());

  createScriptProcessor = vi.fn((..._args: unknown[]) => {
    mockProcessorNode = new MockScriptProcessorNode();
    return mockProcessorNode;
  });

  createBuffer = vi.fn(
    (_channels: number, length: number, sampleRate: number) =>
      new MockAudioBuffer({ numberOfChannels: 1, length, sampleRate }),
  );

  createBufferSource = vi.fn(() => new MockBufferSourceNode());

  close = vi.fn(async () => {
    this.state = 'closed' as AudioContextState;
  });
}

vi.stubGlobal('AudioContext', MockAudioContext);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createSilentSamples(length = 2048): Float32Array {
  return new Float32Array(length);
}

function createLoudSamples(length = 2048, amplitude = 0.5): Float32Array {
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    samples[i] = amplitude * Math.sin((2 * Math.PI * 440 * i) / 16000);
  }
  return samples;
}

function simulateAudioProcess(samples: Float32Array): void {
  if (mockProcessorNode?.onaudioprocess) {
    mockProcessorNode.onaudioprocess({
      inputBuffer: {
        getChannelData: () => samples,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Audio Utilities', () => {
  describe('computeRMS', () => {
    it('returns 0 for an empty buffer', () => {
      expect(computeRMS(new Float32Array(0))).toBe(0);
    });

    it('returns 0 for silent audio', () => {
      expect(computeRMS(createSilentSamples())).toBe(0);
    });

    it('returns correct RMS for a DC signal', () => {
      const samples = new Float32Array(100).fill(0.5);
      expect(computeRMS(samples)).toBeCloseTo(0.5, 5);
    });

    it('returns correct RMS for a sine wave', () => {
      // RMS of a sine wave with amplitude A is A / sqrt(2)
      const amplitude = 1.0;
      const samples = new Float32Array(16000);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = amplitude * Math.sin((2 * Math.PI * 440 * i) / 16000);
      }
      expect(computeRMS(samples)).toBeCloseTo(amplitude / Math.sqrt(2), 1);
    });

    it('handles single sample', () => {
      const samples = new Float32Array([0.75]);
      expect(computeRMS(samples)).toBeCloseTo(0.75, 5);
    });

    it('handles negative values correctly', () => {
      const samples = new Float32Array([-0.5, -0.5, -0.5, -0.5]);
      expect(computeRMS(samples)).toBeCloseTo(0.5, 5);
    });
  });

  describe('rmsToDBFS', () => {
    it('returns 0 dBFS for full scale (1.0)', () => {
      expect(rmsToDBFS(1.0)).toBeCloseTo(0, 1);
    });

    it('returns -6 dBFS for half amplitude', () => {
      expect(rmsToDBFS(0.5)).toBeCloseTo(-6.02, 1);
    });

    it('returns -20 dBFS for 0.1 amplitude', () => {
      expect(rmsToDBFS(0.1)).toBeCloseTo(-20, 1);
    });

    it('returns -100 dBFS for zero', () => {
      expect(rmsToDBFS(0)).toBe(-100);
    });

    it('returns -100 dBFS for negative values', () => {
      expect(rmsToDBFS(-1)).toBe(-100);
    });

    it('clamps extremely small values to -100', () => {
      expect(rmsToDBFS(1e-20)).toBe(-100);
    });
  });

  describe('float32ToPCM16', () => {
    it('converts silence correctly', () => {
      const float32 = new Float32Array([0, 0, 0]);
      const pcm = float32ToPCM16(float32);
      expect(pcm).toEqual(new Int16Array([0, 0, 0]));
    });

    it('converts positive full scale', () => {
      const float32 = new Float32Array([1.0]);
      const pcm = float32ToPCM16(float32);
      expect(pcm[0]).toBe(32767); // 0x7FFF
    });

    it('converts negative full scale', () => {
      const float32 = new Float32Array([-1.0]);
      const pcm = float32ToPCM16(float32);
      expect(pcm[0]).toBe(-32768); // -0x8000
    });

    it('clamps values above 1.0', () => {
      const float32 = new Float32Array([1.5]);
      const pcm = float32ToPCM16(float32);
      expect(pcm[0]).toBe(32767);
    });

    it('clamps values below -1.0', () => {
      const float32 = new Float32Array([-1.5]);
      const pcm = float32ToPCM16(float32);
      expect(pcm[0]).toBe(-32768);
    });

    it('preserves relative amplitudes', () => {
      const float32 = new Float32Array([0.5, -0.5, 0.25]);
      const pcm = float32ToPCM16(float32);
      expect(pcm[0]).toBeGreaterThan(0);
      expect(pcm[1]).toBeLessThan(0);
      expect(Math.abs(pcm[0])).toBeGreaterThan(Math.abs(pcm[2]));
    });

    it('handles empty input', () => {
      const pcm = float32ToPCM16(new Float32Array(0));
      expect(pcm.length).toBe(0);
    });
  });

  describe('pcm16ToFloat32', () => {
    it('converts silence correctly', () => {
      const pcm = new Int16Array([0, 0, 0]);
      const float32 = pcm16ToFloat32(pcm);
      expect(float32).toEqual(new Float32Array([0, 0, 0]));
    });

    it('converts positive full scale', () => {
      const pcm = new Int16Array([32767]);
      const float32 = pcm16ToFloat32(pcm);
      expect(float32[0]).toBeCloseTo(1.0, 3);
    });

    it('converts negative full scale', () => {
      const pcm = new Int16Array([-32768]);
      const float32 = pcm16ToFloat32(pcm);
      expect(float32[0]).toBeCloseTo(-1.0, 3);
    });

    it('handles empty input', () => {
      const float32 = pcm16ToFloat32(new Int16Array(0));
      expect(float32.length).toBe(0);
    });

    it('roundtrips float32 → pcm16 → float32 with reasonable fidelity', () => {
      const original = new Float32Array([0.0, 0.5, -0.5, 0.25, -0.75]);
      const pcm = float32ToPCM16(original);
      const restored = pcm16ToFloat32(pcm);
      for (let i = 0; i < original.length; i++) {
        expect(restored[i]).toBeCloseTo(original[i], 2);
      }
    });
  });
});

describe('VoiceAIManager', () => {
  let manager: VoiceAIManager;

  beforeEach(() => {
    vi.useFakeTimers();
    VoiceAIManager.resetInstance();
    setupMediaDevices();
    mockGetUserMedia.mockClear();
    mockGetUserMedia.mockResolvedValue(new MockMediaStream());
    audioProcessCallback = null;
    manager = VoiceAIManager.getInstance();
  });

  afterEach(() => {
    VoiceAIManager.resetInstance();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  describe('Singleton', () => {
    it('returns the same instance on repeated calls', () => {
      const a = VoiceAIManager.getInstance();
      const b = VoiceAIManager.getInstance();
      expect(a).toBe(b);
    });

    it('creates a fresh instance after resetInstance', () => {
      const a = VoiceAIManager.getInstance();
      VoiceAIManager.resetInstance();
      const b = VoiceAIManager.getInstance();
      expect(a).not.toBe(b);
    });

    it('resets state when resetInstance is called', () => {
      manager.setTranscript('hello');
      VoiceAIManager.resetInstance();
      const fresh = VoiceAIManager.getInstance();
      expect(fresh.transcript).toBe('');
    });
  });

  // -----------------------------------------------------------------------
  // Initial state
  // -----------------------------------------------------------------------

  describe('Initial state', () => {
    it('starts in idle state', () => {
      expect(manager.state).toBe('idle');
    });

    it('starts in push_to_talk mode', () => {
      expect(manager.mode).toBe('push_to_talk');
    });

    it('has no error', () => {
      expect(manager.error).toBeNull();
    });

    it('has empty transcript', () => {
      expect(manager.transcript).toBe('');
    });

    it('has zero audio level', () => {
      expect(manager.audioLevel).toBe(0);
    });

    it('is not listening', () => {
      expect(manager.isListening).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // State machine transitions
  // -----------------------------------------------------------------------

  describe('State machine', () => {
    it('transitions idle → requesting_permission → ready on initialize', async () => {
      const states: VoiceAIState[] = [];
      manager.subscribe(() => {
        states.push(manager.state);
      });

      await manager.initialize();

      expect(states).toContain('requesting_permission');
      expect(manager.state).toBe('ready');
    });

    it('transitions ready → listening on startListening', async () => {
      await manager.initialize();
      await manager.startListening();
      expect(manager.state).toBe('listening');
    });

    it('transitions listening → processing → ready on stopListening', async () => {
      await manager.initialize();
      await manager.startListening();

      const states: VoiceAIState[] = [];
      manager.subscribe(() => {
        states.push(manager.state);
      });

      manager.stopListening();
      expect(states).toContain('processing');
      expect(manager.state).toBe('ready');
    });

    it('transitions to error on permission denied', async () => {
      mockGetUserMedia.mockRejectedValueOnce(
        Object.assign(new DOMException('Permission denied', 'NotAllowedError')),
      );

      await manager.initialize();
      expect(manager.state).toBe('error');
      expect(manager.error).toContain('denied');
    });

    it('transitions to error when no microphone found', async () => {
      mockGetUserMedia.mockRejectedValueOnce(
        Object.assign(new DOMException('No device', 'NotFoundError')),
      );

      await manager.initialize();
      expect(manager.state).toBe('error');
      expect(manager.error).toContain('microphone');
    });

    it('auto-initializes on startListening when idle', async () => {
      expect(manager.state).toBe('idle');
      await manager.startListening();
      expect(manager.state).toBe('listening');
    });

    it('auto-initializes on startListening when in error state', async () => {
      mockGetUserMedia.mockRejectedValueOnce(new Error('fail'));
      await manager.initialize();
      expect(manager.state).toBe('error');

      // Reset mock to succeed
      mockGetUserMedia.mockResolvedValueOnce(new MockMediaStream());
      await manager.startListening();
      expect(manager.state).toBe('listening');
    });

    it('does nothing if startListening called while already listening', async () => {
      await manager.initialize();
      await manager.startListening();
      expect(manager.state).toBe('listening');

      // Call again — should stay listening
      await manager.startListening();
      expect(manager.state).toBe('listening');
    });

    it('does nothing if stopListening called when not listening', async () => {
      await manager.initialize();
      expect(manager.state).toBe('ready');
      manager.stopListening();
      expect(manager.state).toBe('ready');
    });

    it('returns to idle after cleanup', async () => {
      await manager.initialize();
      await manager.startListening();
      manager.cleanup();
      expect(manager.state).toBe('idle');
    });

    it('does not re-initialize if already ready', async () => {
      await manager.initialize();
      expect(manager.state).toBe('ready');

      await manager.initialize();
      // Should still be ready and not have called getUserMedia again
      expect(mockGetUserMedia).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // Configuration
  // -----------------------------------------------------------------------

  describe('Configuration', () => {
    it('returns default config', () => {
      const config = manager.config;
      expect(config.sampleRate).toBe(16000);
      expect(config.vadThreshold).toBe(-40);
      expect(config.holdTimeMs).toBe(300);
      expect(config.mode).toBe('push_to_talk');
    });

    it('setMode changes mode', () => {
      manager.setMode('hands_free');
      expect(manager.mode).toBe('hands_free');
    });

    it('updateConfig merges partial config', () => {
      manager.updateConfig({ vadThreshold: -30, holdTimeMs: 500 });
      expect(manager.config.vadThreshold).toBe(-30);
      expect(manager.config.holdTimeMs).toBe(500);
      expect(manager.config.sampleRate).toBe(16000); // unchanged
    });

    it('setMode notifies subscribers', () => {
      const cb = vi.fn();
      manager.subscribe(cb);
      manager.setMode('hands_free');
      expect(cb).toHaveBeenCalled();
    });

    it('updateConfig notifies subscribers', () => {
      const cb = vi.fn();
      manager.subscribe(cb);
      manager.updateConfig({ vadThreshold: -50 });
      expect(cb).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  describe('Subscription', () => {
    it('notifies subscribers on state change', async () => {
      const cb = vi.fn();
      manager.subscribe(cb);
      await manager.initialize();
      expect(cb).toHaveBeenCalled();
    });

    it('unsubscribe prevents further notifications', async () => {
      const cb = vi.fn();
      const unsub = manager.subscribe(cb);
      unsub();
      await manager.initialize();
      expect(cb).not.toHaveBeenCalled();
    });

    it('supports multiple subscribers', async () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      manager.subscribe(cb1);
      manager.subscribe(cb2);
      await manager.initialize();
      expect(cb1).toHaveBeenCalled();
      expect(cb2).toHaveBeenCalled();
    });

    it('only removes the specific subscriber on unsubscribe', async () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      const unsub1 = manager.subscribe(cb1);
      manager.subscribe(cb2);
      unsub1();
      await manager.initialize();
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Snapshot
  // -----------------------------------------------------------------------

  describe('Snapshot', () => {
    it('returns current state as snapshot', () => {
      const snap = manager.getSnapshot();
      expect(snap.state).toBe('idle');
      expect(snap.mode).toBe('push_to_talk');
      expect(snap.error).toBeNull();
      expect(snap.transcript).toBe('');
      expect(snap.audioLevel).toBe(0);
    });

    it('snapshot reflects state changes', async () => {
      await manager.initialize();
      const snap = manager.getSnapshot();
      expect(snap.state).toBe('ready');
    });

    it('snapshot reflects mode changes', () => {
      manager.setMode('hands_free');
      const snap = manager.getSnapshot();
      expect(snap.mode).toBe('hands_free');
    });
  });

  // -----------------------------------------------------------------------
  // Transcript
  // -----------------------------------------------------------------------

  describe('Transcript', () => {
    it('setTranscript updates transcript', () => {
      manager.setTranscript('Hello world');
      expect(manager.transcript).toBe('Hello world');
    });

    it('setTranscript calls onTranscript callback', () => {
      const cb = vi.fn();
      manager.onTranscript = cb;
      manager.setTranscript('Hello');
      expect(cb).toHaveBeenCalledWith('Hello');
    });

    it('setTranscript notifies subscribers', () => {
      const cb = vi.fn();
      manager.subscribe(cb);
      manager.setTranscript('test');
      expect(cb).toHaveBeenCalled();
    });

    it('cleanup clears transcript', async () => {
      manager.setTranscript('some text');
      manager.cleanup();
      expect(manager.transcript).toBe('');
    });
  });

  // -----------------------------------------------------------------------
  // Push-to-talk mode
  // -----------------------------------------------------------------------

  describe('Push-to-talk mode', () => {
    it('records audio while listening', async () => {
      const audioDataCb = vi.fn();
      manager.onAudioData = audioDataCb;

      await manager.initialize();
      await manager.startListening();

      // Simulate audio process events
      const samples = createLoudSamples();
      simulateAudioProcess(samples);
      simulateAudioProcess(samples);

      manager.stopListening();
      expect(audioDataCb).toHaveBeenCalledTimes(1);
      expect(audioDataCb.mock.calls[0][0]).toBeInstanceOf(Int16Array);
    });

    it('does not record when not listening', async () => {
      const audioDataCb = vi.fn();
      manager.onAudioData = audioDataCb;

      await manager.initialize();
      simulateAudioProcess(createLoudSamples());

      manager.stopListening(); // Not listening, should not emit
      expect(audioDataCb).not.toHaveBeenCalled();
    });

    it('clears audio chunks after stop', async () => {
      const audioDataCb = vi.fn();
      manager.onAudioData = audioDataCb;

      await manager.initialize();
      await manager.startListening();
      simulateAudioProcess(createLoudSamples());
      manager.stopListening();

      // Start and stop again — should not include previous data
      await manager.startListening();
      manager.stopListening();

      // Second call should have no audio data (0 chunks)
      expect(audioDataCb).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // Hands-free mode (VAD)
  // -----------------------------------------------------------------------

  describe('Hands-free mode', () => {
    beforeEach(async () => {
      manager.setMode('hands_free');
      await manager.initialize();
      await manager.startListening();
    });

    it('does not record silent audio', () => {
      simulateAudioProcess(createSilentSamples());
      // No VAD activation expected — no audio data emitted
      manager.stopListening();
    });

    it('records when audio exceeds VAD threshold', () => {
      const audioDataCb = vi.fn();
      manager.onAudioData = audioDataCb;

      simulateAudioProcess(createLoudSamples(2048, 0.5));
      simulateAudioProcess(createLoudSamples(2048, 0.5));

      // Stop manually to collect
      manager.stopListening();
      expect(audioDataCb).toHaveBeenCalledTimes(1);
    });

    it('VAD hold timer prevents premature cutoff', () => {
      const audioDataCb = vi.fn();
      manager.onAudioData = audioDataCb;

      // Speech starts
      simulateAudioProcess(createLoudSamples(2048, 0.5));

      // Brief silence (within hold time)
      simulateAudioProcess(createSilentSamples());

      // Advance time but NOT past hold time
      vi.advanceTimersByTime(100);

      // Speech resumes
      simulateAudioProcess(createLoudSamples(2048, 0.5));

      // Should still be listening (hold timer was cleared)
      expect(manager.state).toBe('listening');
    });

    it('VAD triggers stop after silence exceeds hold time', () => {
      // Speech
      simulateAudioProcess(createLoudSamples(2048, 0.5));

      // Silence starts
      simulateAudioProcess(createSilentSamples());

      // Advance past hold time
      vi.advanceTimersByTime(400);

      // Should have transitioned through processing → ready
      expect(manager.state).toBe('ready');
    });
  });

  // -----------------------------------------------------------------------
  // Audio level
  // -----------------------------------------------------------------------

  describe('Audio level', () => {
    it('reports audio level during listening', async () => {
      await manager.initialize();
      await manager.startListening();

      simulateAudioProcess(createLoudSamples(2048, 0.5));
      expect(manager.audioLevel).toBeGreaterThan(0);
    });

    it('caps audio level at 1', async () => {
      await manager.initialize();
      await manager.startListening();

      simulateAudioProcess(createLoudSamples(2048, 1.0));
      expect(manager.audioLevel).toBeLessThanOrEqual(1);
    });

    it('audio level is 0 after stop', async () => {
      await manager.initialize();
      await manager.startListening();
      simulateAudioProcess(createLoudSamples(2048, 0.5));
      manager.stopListening();
      expect(manager.audioLevel).toBe(0);
    });

    it('silent audio produces near-zero level', async () => {
      await manager.initialize();
      await manager.startListening();
      simulateAudioProcess(createSilentSamples());
      expect(manager.audioLevel).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Audio playback
  // -----------------------------------------------------------------------

  describe('Audio playback', () => {
    it('plays back PCM audio data', async () => {
      const pcm = new Int16Array([0, 16383, -16384, 32767]);
      const promise = manager.playAudio(pcm);
      await vi.advanceTimersByTimeAsync(10);
      await promise;
      // If no error thrown, playback succeeded
    });

    it('uses default sample rate when none specified', async () => {
      const pcm = new Int16Array([0, 100, -100]);
      const promise = manager.playAudio(pcm);
      await vi.advanceTimersByTimeAsync(10);
      await promise;
      // Should not throw
    });

    it('uses custom sample rate when specified', async () => {
      const pcm = new Int16Array([0, 100, -100]);
      const promise = manager.playAudio(pcm, 44100);
      await vi.advanceTimersByTimeAsync(10);
      await promise;
      // Should not throw
    });
  });

  // -----------------------------------------------------------------------
  // Error handling
  // -----------------------------------------------------------------------

  describe('Error handling', () => {
    it('handles NotAllowedError (permission denied)', async () => {
      mockGetUserMedia.mockRejectedValueOnce(
        new DOMException('User denied', 'NotAllowedError'),
      );
      await manager.initialize();
      expect(manager.state).toBe('error');
      expect(manager.error).toContain('denied');
    });

    it('handles NotFoundError (no microphone)', async () => {
      mockGetUserMedia.mockRejectedValueOnce(
        new DOMException('No mic', 'NotFoundError'),
      );
      await manager.initialize();
      expect(manager.state).toBe('error');
      expect(manager.error).toContain('microphone');
    });

    it('handles generic Error', async () => {
      mockGetUserMedia.mockRejectedValueOnce(new Error('Something broke'));
      await manager.initialize();
      expect(manager.state).toBe('error');
      expect(manager.error).toBe('Something broke');
    });

    it('handles non-Error thrown values', async () => {
      mockGetUserMedia.mockRejectedValueOnce('string error');
      await manager.initialize();
      expect(manager.state).toBe('error');
      expect(manager.error).toBe('An unknown error occurred');
    });

    it('handles browser without getUserMedia', async () => {
      removeMediaDevices();
      await manager.initialize();
      expect(manager.state).toBe('error');
      expect(manager.error).toContain('not supported');
      // Restore for other tests
      setupMediaDevices();
    });

    it('cleanup clears error state', async () => {
      mockGetUserMedia.mockRejectedValueOnce(new Error('fail'));
      await manager.initialize();
      expect(manager.error).not.toBeNull();
      manager.cleanup();
      expect(manager.error).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Cleanup and resource release
  // -----------------------------------------------------------------------

  describe('Cleanup', () => {
    it('stops media stream tracks', async () => {
      const stream = new MockMediaStream();
      mockGetUserMedia.mockResolvedValueOnce(stream);
      await manager.initialize();
      manager.cleanup();

      for (const track of stream.getTracks()) {
        expect(track.stop).toHaveBeenCalled();
      }
    });

    it('disconnects audio nodes', async () => {
      await manager.initialize();
      const processor = mockProcessorNode;
      const analyser = mockAnalyserNode;
      manager.cleanup();
      expect(processor.disconnect).toHaveBeenCalled();
      expect(analyser.disconnect).toHaveBeenCalled();
    });

    it('resets audio level to 0', async () => {
      await manager.initialize();
      await manager.startListening();
      simulateAudioProcess(createLoudSamples());
      manager.cleanup();
      expect(manager.audioLevel).toBe(0);
    });

    it('resets transcript', async () => {
      manager.setTranscript('hello');
      manager.cleanup();
      expect(manager.transcript).toBe('');
    });

    it('can initialize again after cleanup', async () => {
      await manager.initialize();
      manager.cleanup();
      expect(manager.state).toBe('idle');
      await manager.initialize();
      expect(manager.state).toBe('ready');
    });

    it('clears VAD hold timer on cleanup', async () => {
      manager.setMode('hands_free');
      await manager.initialize();
      await manager.startListening();

      // Start VAD
      simulateAudioProcess(createLoudSamples());
      simulateAudioProcess(createSilentSamples());

      // Cleanup before timer fires
      manager.cleanup();
      vi.advanceTimersByTime(1000);
      // Should not throw or change state from idle
      expect(manager.state).toBe('idle');
    });

    it('clears VAD hold timer on stopListening', async () => {
      manager.setMode('hands_free');
      await manager.initialize();
      await manager.startListening();

      simulateAudioProcess(createLoudSamples());
      simulateAudioProcess(createSilentSamples());

      manager.stopListening();
      // Timer should be cleared
      vi.advanceTimersByTime(1000);
      expect(manager.state).toBe('ready');
    });
  });

  // -----------------------------------------------------------------------
  // onAudioData callback
  // -----------------------------------------------------------------------

  describe('onAudioData callback', () => {
    it('emits concatenated PCM data on stopListening', async () => {
      const cb = vi.fn();
      manager.onAudioData = cb;

      await manager.initialize();
      await manager.startListening();
      simulateAudioProcess(createLoudSamples(1024));
      simulateAudioProcess(createLoudSamples(1024));
      manager.stopListening();

      expect(cb).toHaveBeenCalledTimes(1);
      const pcm = cb.mock.calls[0][0] as Int16Array;
      expect(pcm.length).toBe(2048);
    });

    it('does not emit when no audio was captured', async () => {
      const cb = vi.fn();
      manager.onAudioData = cb;

      await manager.initialize();
      await manager.startListening();
      // No audio process events
      manager.stopListening();

      expect(cb).not.toHaveBeenCalled();
    });
  });
});
