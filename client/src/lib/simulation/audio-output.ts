/**
 * SimulationAudioOutput — audio output from buzzer/speaker simulation (BL-0623).
 *
 * Drives the Web Audio API to produce audible tones representing buzzer/speaker
 * components in a live circuit simulation. Uses OscillatorNode → GainNode → destination
 * chain with auto-suspend/resume to respect browser autoplay policies and conserve
 * resources.
 *
 * Singleton + subscribe pattern for UI integration via useSyncExternalStore.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Immutable snapshot of the audio output state. */
export interface AudioOutputState {
  /** Whether a tone is currently playing. */
  playing: boolean;
  /** Whether audio is muted (gain forced to 0). */
  muted: boolean;
  /** Current oscillator frequency in Hz. */
  frequency: number;
  /** Current volume level (0.0–1.0). */
  volume: number;
  /** Whether the Web Audio API is available in this environment. */
  available: boolean;
}

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// SimulationAudioOutput
// ---------------------------------------------------------------------------

export class SimulationAudioOutput {
  private ctx: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;

  private _playing = false;
  private _muted = false;
  private _frequency = 440;
  private _volume = 0.5;
  private _waveform: OscillatorType = 'sine';
  private _available: boolean;

  private listeners = new Set<Listener>();
  private stateSnapshot: AudioOutputState;

  constructor() {
    this._available = typeof AudioContext !== 'undefined';
    this.stateSnapshot = this.buildSnapshot();
  }

  // -------------------------------------------------------------------------
  // Subscribe / snapshot (useSyncExternalStore compatible)
  // -------------------------------------------------------------------------

  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Return the current immutable state snapshot. */
  getState(): Readonly<AudioOutputState> {
    return this.stateSnapshot;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /** Whether a tone is currently playing. */
  get isPlaying(): boolean {
    return this._playing;
  }

  /** Whether audio is muted. */
  get isMuted(): boolean {
    return this._muted;
  }

  /** Current oscillator frequency in Hz. */
  get currentFrequency(): number {
    return this._frequency;
  }

  /**
   * Start playing a tone at the given frequency.
   * If already playing, updates the frequency in-place.
   * Handles browser autoplay policy by resuming the AudioContext.
   */
  playTone(frequency: number, waveform?: OscillatorType): void {
    if (!this._available) {
      return;
    }

    if (waveform !== undefined) {
      this._waveform = waveform;
    }

    this._frequency = frequency;

    if (this._playing) {
      // Update existing oscillator
      this.applyFrequency();
      this.applyWaveform();
      this.notify();
      return;
    }

    // Ensure AudioContext exists and is running
    this.ensureContext();
    if (!this.ctx || !this.gainNode) {
      return;
    }

    // Resume suspended context (browser autoplay policy)
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    // Create a fresh oscillator (OscillatorNode is single-use after stop())
    this.oscillator = this.ctx.createOscillator();
    this.oscillator.type = this._waveform;
    this.oscillator.frequency.setValueAtTime(this._frequency, this.ctx.currentTime);
    this.oscillator.connect(this.gainNode);
    this.oscillator.start();

    this.applyGain();
    this._playing = true;
    this.notify();
  }

  /** Stop the current tone. Suspends the AudioContext to save resources. */
  stopTone(): void {
    if (!this._available || !this._playing) {
      return;
    }

    if (this.oscillator) {
      try {
        this.oscillator.stop();
      } catch {
        // Already stopped — ignore
      }
      this.oscillator.disconnect();
      this.oscillator = null;
    }

    this._playing = false;

    // Auto-suspend to conserve resources
    if (this.ctx && this.ctx.state === 'running') {
      void this.ctx.suspend();
    }

    this.notify();
  }

  /** Update the oscillator frequency while playing. */
  setFrequency(hz: number): void {
    this._frequency = hz;
    this.applyFrequency();
    this.notify();
  }

  /** Set volume level (clamped to 0.0–1.0). */
  setVolume(level: number): void {
    this._volume = Math.max(0, Math.min(1, level));
    this.applyGain();
    this.notify();
  }

  /** Mute audio output (sets gain to 0 without stopping the oscillator). */
  mute(): void {
    if (this._muted) {
      return;
    }
    this._muted = true;
    this.applyGain();
    this.notify();
  }

  /** Unmute audio output (restores gain to the configured volume). */
  unmute(): void {
    if (!this._muted) {
      return;
    }
    this._muted = false;
    this.applyGain();
    this.notify();
  }

  /** Toggle mute state. */
  toggleMute(): void {
    if (this._muted) {
      this.unmute();
    } else {
      this.mute();
    }
  }

  /** Tear down audio resources completely. */
  dispose(): void {
    this.stopTone();
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private ensureContext(): void {
    if (this.ctx) {
      return;
    }
    try {
      this.ctx = new AudioContext();
      this.gainNode = this.ctx.createGain();
      this.gainNode.connect(this.ctx.destination);
      this.applyGain();
    } catch {
      this._available = false;
      this.ctx = null;
      this.gainNode = null;
      this.notify();
    }
  }

  private applyFrequency(): void {
    if (this.oscillator && this.ctx) {
      this.oscillator.frequency.setValueAtTime(this._frequency, this.ctx.currentTime);
    }
  }

  private applyWaveform(): void {
    if (this.oscillator) {
      this.oscillator.type = this._waveform;
    }
  }

  private applyGain(): void {
    if (this.gainNode && this.ctx) {
      const effectiveGain = this._muted ? 0 : this._volume;
      this.gainNode.gain.setValueAtTime(effectiveGain, this.ctx.currentTime);
    }
  }

  private buildSnapshot(): AudioOutputState {
    return {
      playing: this._playing,
      muted: this._muted,
      frequency: this._frequency,
      volume: this._volume,
      available: this._available,
    };
  }

  private notify(): void {
    this.stateSnapshot = this.buildSnapshot();
    for (const listener of Array.from(this.listeners)) {
      listener();
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let instance: SimulationAudioOutput | null = null;

/** Get the singleton SimulationAudioOutput instance. */
export function getSimulationAudioOutput(): SimulationAudioOutput {
  if (!instance) {
    instance = new SimulationAudioOutput();
  }
  return instance;
}

/** Reset the singleton (for testing). */
export function resetSimulationAudioOutput(): void {
  if (instance) {
    instance.dispose();
  }
  instance = null;
}
