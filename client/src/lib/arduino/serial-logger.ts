import { logger } from '@/lib/logger';

export type LineDirection = 'tx' | 'rx';

export interface SerialLogEntry {
  timestamp: number;
  direction: LineDirection;
  data: string;
}

export interface SerialLoggerSnapshot {
  recording: boolean;
  size: number;
  filename?: string;
  hasData: boolean;
}

const MAX_RECORDING_DURATION_MS = 60 * 60 * 1000; // 1 hour

export class SerialLogger {
  private static instance: SerialLogger;
  private _recording = false;
  private _entries: SerialLogEntry[] = [];
  private _size = 0;
  private _startTime = 0;
  private _filename?: string;
  private _listeners = new Set<() => void>();
  private _durationTimer?: ReturnType<typeof setTimeout>;
  private _snapshot: SerialLoggerSnapshot = {
    recording: false,
    size: 0,
    filename: undefined,
    hasData: false,
  };

  // Private constructor for singleton pattern; use create() for fresh instances
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  static getInstance(): SerialLogger {
    if (!SerialLogger.instance) {
      SerialLogger.instance = new SerialLogger();
    }
    return SerialLogger.instance;
  }

  /** Create a fresh (non-singleton) instance. Useful for testing. */
  static create(): SerialLogger {
    // Use Object.create to bypass private constructor restriction at runtime
    const inst = Object.create(SerialLogger.prototype) as SerialLogger;
    inst._recording = false;
    inst._entries = [];
    inst._size = 0;
    inst._startTime = 0;
    inst._filename = undefined;
    inst._listeners = new Set();
    inst._durationTimer = undefined;
    inst._snapshot = {
      recording: false,
      size: 0,
      filename: undefined,
      hasData: false,
    };
    // Arrow function class fields are assigned in constructor, so we must
    // manually bind them for instances created via Object.create.
    inst.subscribe = (listener: () => void) => {
      inst._listeners.add(listener);
      return () => inst._listeners.delete(listener);
    };
    inst.getSnapshot = () => inst._snapshot;
    return inst;
  }

  subscribe = (listener: () => void) => {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  };

  getSnapshot = () => this._snapshot;

  private refreshSnapshot(): void {
    this._snapshot = {
      recording: this._recording,
      size: this._size,
      filename: this._filename,
      hasData: this._entries.length > 0,
    };
  }

  private notify() {
    this._listeners.forEach((listener) => {
      listener();
    });
  }

  startRecording(filename?: string) {
    // Idempotent — if already recording, do not reset
    if (this._recording) {
      return;
    }
    this._recording = true;
    this._filename = filename;
    this._startTime = Date.now();
    this._entries = [];
    this._size = 0;
    this.refreshSnapshot();

    // Auto-stop after 1 hour to prevent unbounded memory growth
    this._durationTimer = setTimeout(() => {
      if (this._recording) {
        this.stopRecording();
      }
    }, MAX_RECORDING_DURATION_MS);

    this.notify();
  }

  stopRecording(): string {
    if (!this._recording) {
      return '';
    }
    this._recording = false;
    if (this._durationTimer !== undefined) {
      clearTimeout(this._durationTimer);
      this._durationTimer = undefined;
    }
    this.refreshSnapshot();
    this.notify();
    return this.getRecordedData();
  }

  appendData(data: string, direction: LineDirection = 'rx') {
    if (!this._recording) { return; }

    const byteSize = new Blob([data]).size;

    // Chunk management to prevent infinite memory growth (cap at 50MB for sanity)
    if (this._size + byteSize > 50 * 1024 * 1024) {
      logger.warn('SerialLogger: Recording exceeded 50MB. Auto-stopping.');
      this.stopRecording();
      return;
    }

    this._entries.push({
      timestamp: Date.now() - this._startTime,
      direction,
      data
    });

    this._size += byteSize;
    this.refreshSnapshot();
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
    return this._entries.map(e => e.data).join('');
  }

  getRecordedEntries(): SerialLogEntry[] {
    return this._entries;
  }

  hasData(): boolean {
    return this._entries.length > 0;
  }

  downloadAsFile(): void {
    if (!this.hasData()) { return; }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = this._filename ?? `serial-session-${timestamp}.json`;

    // Export as JSON to preserve timestamps and direction for replay
    const exportData = JSON.stringify({
      version: 1,
      duration: this.getRecordingDuration(),
      entries: this._entries
    }, null, 2);

    const blob = new Blob([exportData], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 100);
  }

  clear(): void {
    this._entries = [];
    this._size = 0;
    this.refreshSnapshot();
    this.notify();
  }

  reset(): void {
    if (this._recording) {
      this.stopRecording();
    }
    this._entries = [];
    this._size = 0;
    this._filename = undefined;
    this.refreshSnapshot();
    this.notify();
  }
}
