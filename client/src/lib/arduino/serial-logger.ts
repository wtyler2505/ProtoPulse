/**
 * SerialLogger — Records serial monitor output to a downloadable file.
 *
 * Singleton + subscribe pattern for useSyncExternalStore integration.
 * Pure module — no React/DOM dependencies.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Listener = () => void;

export interface SerialLoggerSnapshot {
  recording: boolean;
  /** Accumulated byte count of recorded data. */
  size: number;
  /** Duration in milliseconds since recording started (0 when idle). */
  duration: number;
  /** Whether there is data available for download. */
  hasData: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RECORDING_DURATION_MS = 60 * 60 * 1000; // 1 hour
const MAX_RECORDING_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

// ---------------------------------------------------------------------------
// SerialLogger
// ---------------------------------------------------------------------------

export class SerialLogger {
  private static _instance: SerialLogger | null = null;

  private _listeners = new Set<Listener>();
  private _recording = false;
  private _startTime = 0;
  private _chunks: string[] = [];
  private _size = 0;
  private _filename: string | undefined;
  private _autoStopTimer: ReturnType<typeof setTimeout> | null = null;

  private constructor() {}

  static getInstance(): SerialLogger {
    if (!SerialLogger._instance) {
      SerialLogger._instance = new SerialLogger();
    }
    return SerialLogger._instance;
  }

  /** Factory — creates a fresh instance (testing-friendly, no global singleton). */
  static create(): SerialLogger {
    return new SerialLogger();
  }

  // -----------------------------------------------------------------------
  // Subscription (useSyncExternalStore compatible)
  // -----------------------------------------------------------------------

  subscribe = (listener: Listener): (() => void) => {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  };

  getSnapshot = (): SerialLoggerSnapshot => {
    return {
      recording: this._recording,
      size: this._size,
      duration: this._recording ? Date.now() - this._startTime : 0,
      hasData: this._chunks.length > 0,
    };
  };

  private notify(): void {
    const listeners = Array.from(this._listeners);
    for (let i = 0; i < listeners.length; i++) {
      listeners[i]();
    }
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  startRecording(filename?: string): void {
    if (this._recording) {
      return;
    }
    this._recording = true;
    this._startTime = Date.now();
    this._chunks = [];
    this._size = 0;
    this._filename = filename;

    // Auto-stop after max duration
    this._autoStopTimer = setTimeout(() => {
      this.stopRecording();
    }, MAX_RECORDING_DURATION_MS);

    this.notify();
  }

  stopRecording(): string {
    if (!this._recording) {
      return '';
    }
    this._recording = false;
    if (this._autoStopTimer !== null) {
      clearTimeout(this._autoStopTimer);
      this._autoStopTimer = null;
    }
    const data = this._chunks.join('');
    this.notify();
    return data;
  }

  appendData(data: string): void {
    if (!this._recording) {
      return;
    }
    const byteSize = new TextEncoder().encode(data).byteLength;

    // Check size limit before appending
    if (this._size + byteSize > MAX_RECORDING_SIZE_BYTES) {
      this.stopRecording();
      return;
    }

    this._chunks.push(data);
    this._size += byteSize;
    this.notify();
  }

  isRecording(): boolean {
    return this._recording;
  }

  getRecordingDuration(): number {
    if (!this._recording) {
      return 0;
    }
    return Date.now() - this._startTime;
  }

  getRecordingSize(): number {
    return this._size;
  }

  getRecordedData(): string {
    return this._chunks.join('');
  }

  hasData(): boolean {
    return this._chunks.length > 0;
  }

  downloadAsFile(): void {
    const data = this._chunks.join('');
    if (!data) {
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = this._filename ?? `serial-log-${timestamp}.txt`;

    const blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    // Cleanup
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 100);
  }

  /** Clear all recorded data without stopping (if recording continues, new data accumulates). */
  clear(): void {
    this._chunks = [];
    this._size = 0;
    this.notify();
  }

  /** Reset the logger entirely — stops recording and clears data. */
  reset(): void {
    if (this._recording) {
      this.stopRecording();
    }
    this._chunks = [];
    this._size = 0;
    this._filename = undefined;
    this.notify();
  }
}
