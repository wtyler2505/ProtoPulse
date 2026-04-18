/**
 * Voice AI Manager — Hands-free Audio Interaction
 *
 * Provides voice input/output capabilities for the AI assistant.
 * Uses Web Audio API for capture and playback, with energy-based
 * Voice Activity Detection (VAD) for hands-free mode.
 *
 * Features:
 * - Audio capture via getUserMedia + AudioContext
 * - PCM encoding (Float32 → 16-bit PCM)
 * - Energy-based Voice Activity Detection (RMS + dBFS threshold)
 * - Push-to-talk and hands-free modes
 * - Audio playback (PCM → AudioBuffer)
 * - Singleton+subscribe pattern with React hook
 *
 * Usage:
 *   const manager = VoiceAIManager.getInstance();
 *   manager.onTranscript = (text) => logger.debug(text);
 *   await manager.startListening();
 *
 * React hook:
 *   const { state, isListening, startListening, stopListening } = useVoiceAI();
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VoiceAIState =
  | 'idle'
  | 'requesting_permission'
  | 'ready'
  | 'listening'
  | 'processing'
  | 'error';

export type VoiceMode = 'push_to_talk' | 'hands_free';

export interface VoiceAIConfig {
  /** Sample rate for audio capture in Hz. Default: 16000 */
  sampleRate: number;
  /** VAD threshold in dBFS. Audio above this triggers voice detection. Default: -40 */
  vadThreshold: number;
  /** Hold time in ms to avoid cutting mid-word. Default: 300 */
  holdTimeMs: number;
  /** Interaction mode. Default: 'push_to_talk' */
  mode: VoiceMode;
}

export interface VoiceAISnapshot {
  state: VoiceAIState;
  mode: VoiceMode;
  error: string | null;
  transcript: string;
  audioLevel: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: VoiceAIConfig = {
  sampleRate: 16000,
  vadThreshold: -40,
  holdTimeMs: 300,
  mode: 'push_to_talk',
};

/** ScriptProcessorNode buffer size — must be a power of 2 */
const BUFFER_SIZE = 2048;

/** Minimum dBFS value (silence floor) */
const MIN_DBFS = -100;

// ---------------------------------------------------------------------------
// Audio Utilities
// ---------------------------------------------------------------------------

/**
 * Compute Root Mean Square (RMS) of a Float32 audio buffer.
 * Returns 0 for empty buffers.
 */
export function computeRMS(samples: Float32Array): number {
  if (samples.length === 0) {
    return 0;
  }
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

/**
 * Convert linear RMS amplitude to dBFS (decibels relative to full scale).
 * Full scale (1.0) = 0 dBFS, silence = -100 dBFS (clamped).
 */
export function rmsToDBFS(rms: number): number {
  if (rms <= 0) {
    return MIN_DBFS;
  }
  const dbfs = 20 * Math.log10(rms);
  return Math.max(dbfs, MIN_DBFS);
}

/**
 * Encode Float32 audio samples to 16-bit PCM (Int16Array).
 * Clamps values to [-1, 1] before scaling to [-32768, 32767].
 */
export function float32ToPCM16(float32: Float32Array): Int16Array {
  const pcm = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const clamped = Math.max(-1, Math.min(1, float32[i]));
    pcm[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return pcm;
}

/**
 * Decode 16-bit PCM (Int16Array) back to Float32 samples.
 */
export function pcm16ToFloat32(pcm: Int16Array): Float32Array {
  const float32 = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    float32[i] = pcm[i] < 0 ? pcm[i] / 0x8000 : pcm[i] / 0x7fff;
  }
  return float32;
}

// ---------------------------------------------------------------------------
// VoiceAIManager
// ---------------------------------------------------------------------------

/**
 * Centralized voice AI manager. Handles audio capture, VAD,
 * PCM encoding, and playback. Singleton per application.
 */
export class VoiceAIManager {
  private static instance: VoiceAIManager | null = null;

  private _state: VoiceAIState = 'idle';
  private _config: VoiceAIConfig;
  private _error: string | null = null;
  private _transcript = '';
  private _audioLevel = 0;

  // Audio resources
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;

  // VAD state
  private vadActive = false;
  private vadHoldTimer: ReturnType<typeof setTimeout> | null = null;
  private audioChunks: Float32Array[] = [];

  // Playback
  private playbackContext: AudioContext | null = null;

  // Subscribers
  private subscribers: Set<() => void> = new Set();

  // Callbacks
  onTranscript: ((text: string) => void) | null = null;
  onAudioData: ((pcm: Int16Array) => void) | null = null;

  constructor(config?: Partial<VoiceAIConfig>) {
    this._config = { ...DEFAULT_CONFIG, ...config };
  }

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  static getInstance(): VoiceAIManager {
    if (!VoiceAIManager.instance) {
      VoiceAIManager.instance = new VoiceAIManager();
    }
    return VoiceAIManager.instance;
  }

  static resetInstance(): void {
    if (VoiceAIManager.instance) {
      VoiceAIManager.instance.cleanup();
    }
    VoiceAIManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // State accessors
  // -----------------------------------------------------------------------

  get state(): VoiceAIState {
    return this._state;
  }

  get mode(): VoiceMode {
    return this._config.mode;
  }

  get error(): string | null {
    return this._error;
  }

  get transcript(): string {
    return this._transcript;
  }

  get audioLevel(): number {
    return this._audioLevel;
  }

  get config(): Readonly<VoiceAIConfig> {
    return { ...this._config };
  }

  get isListening(): boolean {
    return this._state === 'listening';
  }

  // -----------------------------------------------------------------------
  // Snapshot (for React hook)
  // -----------------------------------------------------------------------

  getSnapshot(): VoiceAISnapshot {
    return {
      state: this._state,
      mode: this._config.mode,
      error: this._error,
      transcript: this._transcript,
      audioLevel: this._audioLevel,
    };
  }

  // -----------------------------------------------------------------------
  // Configuration
  // -----------------------------------------------------------------------

  setMode(mode: VoiceMode): void {
    this._config.mode = mode;
    this.notify();
  }

  updateConfig(partial: Partial<VoiceAIConfig>): void {
    Object.assign(this._config, partial);
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Audio capture lifecycle
  // -----------------------------------------------------------------------

  /**
   * Request microphone permission and initialize audio pipeline.
   * Transitions: idle → requesting_permission → ready (or error).
   */
  async initialize(): Promise<void> {
    if (this._state !== 'idle' && this._state !== 'error') {
      return;
    }

    this.setState('requesting_permission');

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Audio capture is not supported in this browser');
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this._config.sampleRate,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.audioContext = new AudioContext({ sampleRate: this._config.sampleRate });
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Create analyser for audio level metering
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = BUFFER_SIZE;
      this.analyserNode.smoothingTimeConstant = 0.3;
      this.sourceNode.connect(this.analyserNode);

      // Create ScriptProcessor for raw audio access
      this.processorNode = this.audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);
      this.processorNode.onaudioprocess = this.handleAudioProcess.bind(this);
      this.analyserNode.connect(this.processorNode);
      // Connect to destination to keep the pipeline active (required by some browsers)
      this.processorNode.connect(this.audioContext.destination);

      this.setState('ready');
    } catch (err) {
      this.handleError(err);
    }
  }

  /**
   * Start listening for audio input.
   * In push-to-talk mode, records until stopListening() is called.
   * In hands-free mode, uses VAD to detect speech start/end.
   * Auto-initializes if not yet done.
   */
  async startListening(): Promise<void> {
    if (this._state === 'idle' || this._state === 'error') {
      await this.initialize();
    }

    if (this._state !== 'ready') {
      return;
    }

    this.audioChunks = [];
    this.vadActive = false;
    this._transcript = '';
    this.setState('listening');
  }

  /**
   * Stop listening for audio input.
   * Gathers captured audio chunks and emits them as PCM data.
   * Transitions: listening → processing → ready.
   */
  stopListening(): void {
    if (this._state !== 'listening') {
      return;
    }

    if (this.vadHoldTimer) {
      clearTimeout(this.vadHoldTimer);
      this.vadHoldTimer = null;
    }

    this.setState('processing');

    // Concatenate audio chunks and emit PCM
    if (this.audioChunks.length > 0) {
      const totalLength = this.audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const concatenated = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of this.audioChunks) {
        concatenated.set(chunk, offset);
        offset += chunk.length;
      }

      const pcm = float32ToPCM16(concatenated);
      this.onAudioData?.(pcm);
    }

    this.audioChunks = [];
    this._audioLevel = 0;
    this.setState('ready');
  }

  /**
   * Set transcript text (received from speech-to-text service).
   */
  setTranscript(text: string): void {
    this._transcript = text;
    this.onTranscript?.(text);
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Audio playback
  // -----------------------------------------------------------------------

  /**
   * Play back audio from PCM Int16Array data.
   * Creates a temporary AudioContext for playback.
   */
  async playAudio(pcmData: Int16Array, sampleRate?: number): Promise<void> {
    const rate = sampleRate ?? this._config.sampleRate;

    if (!this.playbackContext || this.playbackContext.state === 'closed') {
      this.playbackContext = new AudioContext({ sampleRate: rate });
    }

    const float32 = pcm16ToFloat32(pcmData);
    const audioBuffer = this.playbackContext.createBuffer(1, float32.length, rate);
    audioBuffer.getChannelData(0).set(float32);

    const sourceNode = this.playbackContext.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.connect(this.playbackContext.destination);

    return new Promise<void>((resolve) => {
      sourceNode.onended = () => {
        resolve();
      };
      sourceNode.start(0);
    });
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  /**
   * Release all audio resources and reset to idle state.
   */
  cleanup(): void {
    if (this.vadHoldTimer) {
      clearTimeout(this.vadHoldTimer);
      this.vadHoldTimer = null;
    }

    if (this.processorNode) {
      this.processorNode.onaudioprocess = null;
      this.processorNode.disconnect();
      this.processorNode = null;
    }

    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      void this.audioContext.close();
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        track.stop();
      });
      this.mediaStream = null;
    }

    if (this.playbackContext && this.playbackContext.state !== 'closed') {
      void this.playbackContext.close();
      this.playbackContext = null;
    }

    this.audioChunks = [];
    this.vadActive = false;
    this._audioLevel = 0;
    this._error = null;
    this._transcript = '';
    this.setState('idle');
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  // -----------------------------------------------------------------------
  // Private: audio processing
  // -----------------------------------------------------------------------

  private handleAudioProcess(event: AudioProcessingEvent): void {
    if (this._state !== 'listening') {
      return;
    }

    const inputBuffer = event.inputBuffer.getChannelData(0);
    const samples = new Float32Array(inputBuffer);

    // Compute audio level
    const rms = computeRMS(samples);
    this._audioLevel = Math.min(1, rms * 5); // Scale up for visualization

    const dbfs = rmsToDBFS(rms);

    if (this._config.mode === 'hands_free') {
      this.processVAD(dbfs, samples);
    } else {
      // Push-to-talk: always record while listening
      this.audioChunks.push(samples);
    }

    this.notify();
  }

  private processVAD(dbfs: number, samples: Float32Array): void {
    const isAboveThreshold = dbfs > this._config.vadThreshold;

    if (isAboveThreshold) {
      // Clear any pending hold timer
      if (this.vadHoldTimer) {
        clearTimeout(this.vadHoldTimer);
        this.vadHoldTimer = null;
      }

      if (!this.vadActive) {
        this.vadActive = true;
      }

      this.audioChunks.push(samples);
    } else if (this.vadActive) {
      // Still recording during hold period
      this.audioChunks.push(samples);

      if (!this.vadHoldTimer) {
        this.vadHoldTimer = setTimeout(() => {
          this.vadHoldTimer = null;
          this.vadActive = false;

          // Emit captured audio
          if (this.audioChunks.length > 0) {
            this.stopListening();
          }
        }, this._config.holdTimeMs);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Private: state management
  // -----------------------------------------------------------------------

  private setState(newState: VoiceAIState): void {
    if (this._state === newState) {
      return;
    }
    this._state = newState;
    this.notify();
  }

  private handleError(err: unknown): void {
    const message =
      err instanceof DOMException && err.name === 'NotAllowedError'
        ? 'Microphone access was denied. Please allow microphone access in your browser settings.'
        : err instanceof DOMException && err.name === 'NotFoundError'
          ? 'No microphone found. Please connect a microphone and try again.'
          : err instanceof Error
            ? err.message
            : 'An unknown error occurred';

    this._error = message;
    this.setState('error');
  }

  private notify(): void {
    this.subscribers.forEach((cb) => {
      cb();
    });
  }
}
