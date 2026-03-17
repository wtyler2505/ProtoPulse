/**
 * Macro Recorder
 *
 * Records sequences of user actions and plays them back with original timing.
 * Uses the singleton+subscribe pattern with localStorage persistence under the
 * 'protopulse:macros' key. Each recording captures timestamped actions that can
 * be replayed sequentially through a caller-supplied executor function.
 *
 * Usage:
 *   const recorder = MacroRecorder.getInstance();
 *   recorder.startRecording('My Macro');
 *   recorder.recordAction({ type: 'add_node', payload: { name: 'R1' }, timestamp: Date.now() });
 *   const recording = recorder.stopRecording();
 *
 * Playback:
 *   await recorder.playRecording(recording.id, async (action) => { ... });
 *
 * React hook:
 *   const { isRecording, recordings, startRecording, stopRecording, ... } = useMacroRecorder();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single recorded action within a macro. */
export interface MacroAction {
  /** Identifies the kind of action (e.g. 'add_node', 'delete_edge'). */
  type: string;
  /** Arbitrary data associated with the action. */
  payload: Record<string, unknown>;
  /** Epoch milliseconds when the action was recorded. */
  timestamp: number;
}

/** A completed macro recording containing a sequence of actions. */
export interface MacroRecording {
  /** Unique identifier (crypto.randomUUID). */
  id: string;
  /** Human-readable name chosen by the user. */
  name: string;
  /** Ordered list of recorded actions. */
  actions: MacroAction[];
  /** Epoch milliseconds when the recording was created (stopRecording time). */
  createdAt: number;
  /** Total duration in milliseconds from first to last action (0 if fewer than 2 actions). */
  duration: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse:macros';

// ---------------------------------------------------------------------------
// MacroRecorder
// ---------------------------------------------------------------------------

/**
 * Singleton that records, persists, and plays back macro action sequences.
 * Notifies subscribers on any state change (recording start/stop, recordings
 * added/deleted, playback start/end).
 */
export class MacroRecorder {
  private static instance: MacroRecorder | null = null;

  private recording: boolean;
  private currentName: string;
  private currentActions: MacroAction[];
  private recordings: MacroRecording[];
  private playing: boolean;
  private subscribers: Set<() => void>;

  constructor() {
    this.recording = false;
    this.currentName = '';
    this.currentActions = [];
    this.recordings = [];
    this.playing = false;
    this.subscribers = new Set();
    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): MacroRecorder {
    if (!MacroRecorder.instance) {
      MacroRecorder.instance = new MacroRecorder();
    }
    return MacroRecorder.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetInstance(): void {
    MacroRecorder.instance = null;
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /** Whether a recording session is currently in progress. */
  isRecording(): boolean {
    return this.recording;
  }

  /** Whether a playback is currently in progress. */
  isPlaying(): boolean {
    return this.playing;
  }

  /** Get all saved recordings. Returns a defensive copy. */
  getRecordings(): MacroRecording[] {
    return this.recordings.map((r) => ({ ...r, actions: [...r.actions] }));
  }

  /** Get a single recording by id, or undefined if not found. */
  getRecording(id: string): MacroRecording | undefined {
    const r = this.recordings.find((rec) => rec.id === id);
    if (!r) {
      return undefined;
    }
    return { ...r, actions: [...r.actions] };
  }

  /** Get the number of actions recorded so far in the current session. */
  getCurrentActionCount(): number {
    return this.currentActions.length;
  }

  // -----------------------------------------------------------------------
  // Recording
  // -----------------------------------------------------------------------

  /**
   * Begin a new recording session.
   * Throws if already recording or if name is empty/whitespace-only.
   */
  startRecording(name: string): void {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      throw new Error('Recording name must not be empty');
    }
    if (this.recording) {
      throw new Error('Already recording');
    }
    this.recording = true;
    this.currentName = trimmed;
    this.currentActions = [];
    this.notify();
  }

  /**
   * Record a single action. Must be called while recording is active.
   * Throws if not currently recording.
   */
  recordAction(action: MacroAction): void {
    if (!this.recording) {
      throw new Error('Not currently recording');
    }
    this.currentActions.push({ ...action });
    this.notify();
  }

  /**
   * Stop the current recording session and persist the result.
   * Returns the completed MacroRecording. Throws if not recording.
   */
  stopRecording(): MacroRecording {
    if (!this.recording) {
      throw new Error('Not currently recording');
    }

    const actions = [...this.currentActions];
    let duration = 0;
    if (actions.length >= 2) {
      duration = actions[actions.length - 1].timestamp - actions[0].timestamp;
    }

    const recording: MacroRecording = {
      id: crypto.randomUUID(),
      name: this.currentName,
      actions,
      createdAt: Date.now(),
      duration,
    };

    this.recordings.push(recording);
    this.recording = false;
    this.currentName = '';
    this.currentActions = [];
    this.save();
    this.notify();

    return { ...recording, actions: [...recording.actions] };
  }

  // -----------------------------------------------------------------------
  // Playback
  // -----------------------------------------------------------------------

  /**
   * Play back a recording by id, invoking `executor` for each action in order.
   * Preserves original inter-action timing delays. Throws if recording not found
   * or if already playing. Returns once all actions have been executed.
   */
  async playRecording(id: string, executor: (action: MacroAction) => Promise<void>): Promise<void> {
    const recording = this.recordings.find((r) => r.id === id);
    if (!recording) {
      throw new Error(`Recording not found: ${id}`);
    }
    if (this.playing) {
      throw new Error('Already playing a recording');
    }
    if (recording.actions.length === 0) {
      return;
    }

    this.playing = true;
    this.notify();

    try {
      for (let i = 0; i < recording.actions.length; i++) {
        // Wait for the inter-action delay (skip the first action)
        if (i > 0) {
          const delay = recording.actions[i].timestamp - recording.actions[i - 1].timestamp;
          if (delay > 0) {
            await sleep(delay);
          }
        }
        await executor(recording.actions[i]);
      }
    } finally {
      this.playing = false;
      this.notify();
    }
  }

  // -----------------------------------------------------------------------
  // Management
  // -----------------------------------------------------------------------

  /**
   * Delete a recording by id. Returns true if found and deleted, false otherwise.
   */
  deleteRecording(id: string): boolean {
    const index = this.recordings.findIndex((r) => r.id === id);
    if (index === -1) {
      return false;
    }
    this.recordings.splice(index, 1);
    this.save();
    this.notify();
    return true;
  }

  /** Delete all recordings. */
  clearRecordings(): void {
    if (this.recordings.length === 0) {
      return;
    }
    this.recordings = [];
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   * Callback is invoked whenever recording/playback state or stored recordings change.
   */
  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  /** Persist recordings to localStorage. */
  private save(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.recordings));
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }

  /** Load recordings from localStorage. */
  private load(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return;
      }
      const validated: MacroRecording[] = [];
      for (const item of parsed) {
        if (isValidRecording(item)) {
          validated.push(item);
        }
      }
      this.recordings = validated;
    } catch {
      // Corrupt data — keep empty
    }
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /** Notify all subscribers of a state change. */
  private notify(): void {
    this.subscribers.forEach((cb) => {
      cb();
    });
  }
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/** Type-guard to validate a parsed recording object from localStorage. */
function isValidRecording(value: unknown): value is MacroRecording {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  if (typeof obj.id !== 'string' || typeof obj.name !== 'string') {
    return false;
  }
  if (typeof obj.createdAt !== 'number' || typeof obj.duration !== 'number') {
    return false;
  }
  if (!Array.isArray(obj.actions)) {
    return false;
  }
  for (const action of obj.actions) {
    if (!isValidAction(action)) {
      return false;
    }
  }
  return true;
}

/** Type-guard to validate a parsed action object. */
function isValidAction(value: unknown): value is MacroAction {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.type === 'string' &&
    typeof obj.payload === 'object' &&
    obj.payload !== null &&
    !Array.isArray(obj.payload) &&
    typeof obj.timestamp === 'number'
  );
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/** Promise-based sleep using setTimeout. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook for accessing the macro recorder in React components.
 * Subscribes to the MacroRecorder singleton and triggers re-renders on state changes.
 */
export function useMacroRecorder(): {
  isRecording: boolean;
  isPlaying: boolean;
  recordings: MacroRecording[];
  currentActionCount: number;
  startRecording: (name: string) => void;
  stopRecording: () => MacroRecording;
  recordAction: (action: MacroAction) => void;
  deleteRecording: (id: string) => boolean;
  clearRecordings: () => void;
  playRecording: (id: string, executor: (action: MacroAction) => Promise<void>) => Promise<void>;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const recorder = MacroRecorder.getInstance();
    const unsubscribe = recorder.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const startRecording = useCallback((name: string) => {
    MacroRecorder.getInstance().startRecording(name);
  }, []);

  const stopRecording = useCallback(() => {
    return MacroRecorder.getInstance().stopRecording();
  }, []);

  const recordAction = useCallback((action: MacroAction) => {
    MacroRecorder.getInstance().recordAction(action);
  }, []);

  const deleteRecording = useCallback((id: string) => {
    return MacroRecorder.getInstance().deleteRecording(id);
  }, []);

  const clearRecordings = useCallback(() => {
    MacroRecorder.getInstance().clearRecordings();
  }, []);

  const playRecording = useCallback(
    async (id: string, executor: (action: MacroAction) => Promise<void>) => {
      return MacroRecorder.getInstance().playRecording(id, executor);
    },
    [],
  );

  const recorder = typeof window !== 'undefined' ? MacroRecorder.getInstance() : null;

  return {
    isRecording: recorder ? recorder.isRecording() : false,
    isPlaying: recorder ? recorder.isPlaying() : false,
    recordings: recorder ? recorder.getRecordings() : [],
    currentActionCount: recorder ? recorder.getCurrentActionCount() : 0,
    startRecording,
    stopRecording,
    recordAction,
    deleteRecording,
    clearRecordings,
    playRecording,
  };
}
