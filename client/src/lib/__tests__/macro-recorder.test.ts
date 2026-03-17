import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MacroRecorder } from '../macro-recorder';
import type { MacroAction, MacroRecording } from '../macro-recorder';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAction(type: string, payload: Record<string, unknown> = {}, timestamp = Date.now()): MacroAction {
  return { type, payload, timestamp };
}

/** Record a complete macro with the given actions and return it. */
function recordMacro(name: string, actions: MacroAction[]): MacroRecording {
  const recorder = MacroRecorder.getInstance();
  recorder.startRecording(name);
  for (const action of actions) {
    recorder.recordAction(action);
  }
  return recorder.stopRecording();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MacroRecorder', () => {
  beforeEach(() => {
    MacroRecorder.resetInstance();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---- Singleton ----------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance on multiple getInstance calls', () => {
      const a = MacroRecorder.getInstance();
      const b = MacroRecorder.getInstance();
      expect(a).toBe(b);
    });

    it('returns a fresh instance after resetInstance', () => {
      const a = MacroRecorder.getInstance();
      MacroRecorder.resetInstance();
      const b = MacroRecorder.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // ---- Initial state ------------------------------------------------------

  describe('initial state', () => {
    it('is not recording initially', () => {
      const recorder = MacroRecorder.getInstance();
      expect(recorder.isRecording()).toBe(false);
    });

    it('is not playing initially', () => {
      const recorder = MacroRecorder.getInstance();
      expect(recorder.isPlaying()).toBe(false);
    });

    it('has no recordings initially', () => {
      const recorder = MacroRecorder.getInstance();
      expect(recorder.getRecordings()).toEqual([]);
    });

    it('has zero current action count initially', () => {
      const recorder = MacroRecorder.getInstance();
      expect(recorder.getCurrentActionCount()).toBe(0);
    });
  });

  // ---- startRecording -----------------------------------------------------

  describe('startRecording', () => {
    it('sets isRecording to true', () => {
      const recorder = MacroRecorder.getInstance();
      recorder.startRecording('Test');
      expect(recorder.isRecording()).toBe(true);
    });

    it('trims the recording name', () => {
      const recorder = MacroRecorder.getInstance();
      recorder.startRecording('  My Macro  ');
      const result = recorder.stopRecording();
      expect(result.name).toBe('My Macro');
    });

    it('throws if name is empty', () => {
      const recorder = MacroRecorder.getInstance();
      expect(() => recorder.startRecording('')).toThrow('Recording name must not be empty');
    });

    it('throws if name is whitespace only', () => {
      const recorder = MacroRecorder.getInstance();
      expect(() => recorder.startRecording('   ')).toThrow('Recording name must not be empty');
    });

    it('throws if already recording', () => {
      const recorder = MacroRecorder.getInstance();
      recorder.startRecording('First');
      expect(() => recorder.startRecording('Second')).toThrow('Already recording');
    });

    it('notifies subscribers', () => {
      const recorder = MacroRecorder.getInstance();
      const callback = vi.fn();
      recorder.subscribe(callback);
      recorder.startRecording('Test');
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  // ---- recordAction -------------------------------------------------------

  describe('recordAction', () => {
    it('adds action and increments current action count', () => {
      const recorder = MacroRecorder.getInstance();
      recorder.startRecording('Test');
      expect(recorder.getCurrentActionCount()).toBe(0);
      recorder.recordAction(makeAction('click'));
      expect(recorder.getCurrentActionCount()).toBe(1);
      recorder.recordAction(makeAction('type'));
      expect(recorder.getCurrentActionCount()).toBe(2);
    });

    it('throws if not recording', () => {
      const recorder = MacroRecorder.getInstance();
      expect(() => recorder.recordAction(makeAction('click'))).toThrow('Not currently recording');
    });

    it('stores a defensive copy of the action', () => {
      const recorder = MacroRecorder.getInstance();
      recorder.startRecording('Test');
      const action = makeAction('click', { x: 10 });
      recorder.recordAction(action);
      action.payload.x = 999; // mutate original
      const result = recorder.stopRecording();
      expect(result.actions[0].payload.x).toBe(10);
    });

    it('notifies subscribers on each action', () => {
      const recorder = MacroRecorder.getInstance();
      const callback = vi.fn();
      recorder.subscribe(callback);
      recorder.startRecording('Test');
      callback.mockClear();
      recorder.recordAction(makeAction('a'));
      recorder.recordAction(makeAction('b'));
      expect(callback).toHaveBeenCalledTimes(2);
    });
  });

  // ---- stopRecording ------------------------------------------------------

  describe('stopRecording', () => {
    it('returns a MacroRecording with correct fields', () => {
      const recorder = MacroRecorder.getInstance();
      recorder.startRecording('Test Macro');
      recorder.recordAction(makeAction('click', { x: 5 }, 1000));
      recorder.recordAction(makeAction('type', { text: 'hi' }, 2000));
      const result = recorder.stopRecording();

      expect(result.id).toBeTruthy();
      expect(result.name).toBe('Test Macro');
      expect(result.actions).toHaveLength(2);
      expect(result.createdAt).toBeGreaterThan(0);
      expect(result.duration).toBe(1000);
    });

    it('sets duration to 0 for zero actions', () => {
      const recorder = MacroRecorder.getInstance();
      recorder.startRecording('Empty');
      const result = recorder.stopRecording();
      expect(result.duration).toBe(0);
      expect(result.actions).toHaveLength(0);
    });

    it('sets duration to 0 for a single action', () => {
      const recorder = MacroRecorder.getInstance();
      recorder.startRecording('Single');
      recorder.recordAction(makeAction('click', {}, 5000));
      const result = recorder.stopRecording();
      expect(result.duration).toBe(0);
    });

    it('computes duration from first to last action timestamp', () => {
      const recorder = MacroRecorder.getInstance();
      recorder.startRecording('Multi');
      recorder.recordAction(makeAction('a', {}, 100));
      recorder.recordAction(makeAction('b', {}, 300));
      recorder.recordAction(makeAction('c', {}, 700));
      const result = recorder.stopRecording();
      expect(result.duration).toBe(600); // 700 - 100
    });

    it('sets isRecording to false after stopping', () => {
      const recorder = MacroRecorder.getInstance();
      recorder.startRecording('Test');
      recorder.stopRecording();
      expect(recorder.isRecording()).toBe(false);
    });

    it('resets current action count after stopping', () => {
      const recorder = MacroRecorder.getInstance();
      recorder.startRecording('Test');
      recorder.recordAction(makeAction('a'));
      recorder.stopRecording();
      expect(recorder.getCurrentActionCount()).toBe(0);
    });

    it('throws if not recording', () => {
      const recorder = MacroRecorder.getInstance();
      expect(() => recorder.stopRecording()).toThrow('Not currently recording');
    });

    it('persists the recording to localStorage', () => {
      const recorder = MacroRecorder.getInstance();
      recorder.startRecording('Persisted');
      recorder.recordAction(makeAction('click', {}, 1000));
      recorder.stopRecording();

      const raw = localStorage.getItem('protopulse:macros');
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!) as MacroRecording[];
      expect(parsed).toHaveLength(1);
      expect(parsed[0].name).toBe('Persisted');
    });

    it('adds recording to the list accessible via getRecordings', () => {
      const recorder = MacroRecorder.getInstance();
      recorder.startRecording('A');
      recorder.stopRecording();
      recorder.startRecording('B');
      recorder.stopRecording();
      expect(recorder.getRecordings()).toHaveLength(2);
    });

    it('notifies subscribers', () => {
      const recorder = MacroRecorder.getInstance();
      recorder.startRecording('Test');
      const callback = vi.fn();
      recorder.subscribe(callback);
      recorder.stopRecording();
      expect(callback).toHaveBeenCalled();
    });

    it('returns a defensive copy of the recording', () => {
      const recorder = MacroRecorder.getInstance();
      recorder.startRecording('Copy Test');
      recorder.recordAction(makeAction('a', { val: 1 }, 100));
      const result = recorder.stopRecording();
      result.actions.push(makeAction('hacked'));
      result.name = 'Mutated';

      const stored = recorder.getRecordings();
      expect(stored[0].name).toBe('Copy Test');
      expect(stored[0].actions).toHaveLength(1);
    });
  });

  // ---- getRecording -------------------------------------------------------

  describe('getRecording', () => {
    it('returns a recording by id', () => {
      const result = recordMacro('Find Me', [makeAction('a')]);
      const recorder = MacroRecorder.getInstance();
      const found = recorder.getRecording(result.id);
      expect(found).toBeDefined();
      expect(found!.name).toBe('Find Me');
    });

    it('returns undefined for unknown id', () => {
      const recorder = MacroRecorder.getInstance();
      expect(recorder.getRecording('nonexistent')).toBeUndefined();
    });

    it('returns a defensive copy', () => {
      const result = recordMacro('Defensible', [makeAction('a', { v: 1 })]);
      const recorder = MacroRecorder.getInstance();
      const found = recorder.getRecording(result.id)!;
      found.actions.push(makeAction('hacked'));
      const again = recorder.getRecording(result.id)!;
      expect(again.actions).toHaveLength(1);
    });
  });

  // ---- deleteRecording ----------------------------------------------------

  describe('deleteRecording', () => {
    it('deletes a recording by id and returns true', () => {
      const result = recordMacro('Delete Me', [makeAction('a')]);
      const recorder = MacroRecorder.getInstance();
      expect(recorder.deleteRecording(result.id)).toBe(true);
      expect(recorder.getRecordings()).toHaveLength(0);
    });

    it('returns false for unknown id', () => {
      const recorder = MacroRecorder.getInstance();
      expect(recorder.deleteRecording('nonexistent')).toBe(false);
    });

    it('persists deletion to localStorage', () => {
      const result = recordMacro('Ephemeral', [makeAction('a')]);
      const recorder = MacroRecorder.getInstance();
      recorder.deleteRecording(result.id);

      const raw = localStorage.getItem('protopulse:macros');
      const parsed = JSON.parse(raw!) as MacroRecording[];
      expect(parsed).toHaveLength(0);
    });

    it('notifies subscribers', () => {
      const result = recordMacro('Notify Me', [makeAction('a')]);
      const recorder = MacroRecorder.getInstance();
      const callback = vi.fn();
      recorder.subscribe(callback);
      recorder.deleteRecording(result.id);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('does not notify subscribers when id not found', () => {
      const recorder = MacroRecorder.getInstance();
      const callback = vi.fn();
      recorder.subscribe(callback);
      recorder.deleteRecording('nonexistent');
      expect(callback).not.toHaveBeenCalled();
    });
  });

  // ---- clearRecordings ----------------------------------------------------

  describe('clearRecordings', () => {
    it('removes all recordings', () => {
      recordMacro('A', [makeAction('a')]);
      recordMacro('B', [makeAction('b')]);
      const recorder = MacroRecorder.getInstance();
      expect(recorder.getRecordings()).toHaveLength(2);
      recorder.clearRecordings();
      expect(recorder.getRecordings()).toHaveLength(0);
    });

    it('persists to localStorage', () => {
      recordMacro('X', [makeAction('x')]);
      const recorder = MacroRecorder.getInstance();
      recorder.clearRecordings();
      const raw = localStorage.getItem('protopulse:macros');
      expect(JSON.parse(raw!)).toEqual([]);
    });

    it('notifies subscribers', () => {
      recordMacro('A', [makeAction('a')]);
      const recorder = MacroRecorder.getInstance();
      const callback = vi.fn();
      recorder.subscribe(callback);
      recorder.clearRecordings();
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('does not notify when already empty', () => {
      const recorder = MacroRecorder.getInstance();
      const callback = vi.fn();
      recorder.subscribe(callback);
      recorder.clearRecordings();
      expect(callback).not.toHaveBeenCalled();
    });
  });

  // ---- playRecording ------------------------------------------------------

  describe('playRecording', () => {
    it('executes each action in order', async () => {
      vi.useFakeTimers();
      const executed: string[] = [];
      const actions = [
        makeAction('first', {}, 1000),
        makeAction('second', {}, 1000), // same timestamp — zero delay
        makeAction('third', {}, 1000),
      ];
      const result = recordMacro('Playback', actions);
      const recorder = MacroRecorder.getInstance();

      const promise = recorder.playRecording(result.id, async (action) => {
        executed.push(action.type);
      });
      // All at same timestamp, so no delays needed
      await vi.runAllTimersAsync();
      await promise;

      expect(executed).toEqual(['first', 'second', 'third']);
    });

    it('preserves original timing between actions', async () => {
      vi.useFakeTimers();
      const timestamps: number[] = [];
      const actions = [
        makeAction('a', {}, 1000),
        makeAction('b', {}, 1100), // 100ms delay
        makeAction('c', {}, 1350), // 250ms delay
      ];
      const result = recordMacro('Timed', actions);
      const recorder = MacroRecorder.getInstance();

      const promise = recorder.playRecording(result.id, async (action) => {
        timestamps.push(Date.now());
        void action; // use parameter
      });

      // First action executes immediately
      await vi.advanceTimersByTimeAsync(0);
      expect(timestamps).toHaveLength(1);

      // After 100ms the second action fires
      await vi.advanceTimersByTimeAsync(100);
      expect(timestamps).toHaveLength(2);
      expect(timestamps[1] - timestamps[0]).toBe(100);

      // After 250ms the third action fires
      await vi.advanceTimersByTimeAsync(250);
      await promise;
      expect(timestamps).toHaveLength(3);
      expect(timestamps[2] - timestamps[1]).toBe(250);
    });

    it('sets isPlaying during playback', async () => {
      vi.useFakeTimers();
      const result = recordMacro('Playing', [makeAction('a', {}, 100), makeAction('b', {}, 200)]);
      const recorder = MacroRecorder.getInstance();

      expect(recorder.isPlaying()).toBe(false);
      const promise = recorder.playRecording(result.id, async () => {});
      expect(recorder.isPlaying()).toBe(true);

      await vi.runAllTimersAsync();
      await promise;
      expect(recorder.isPlaying()).toBe(false);
    });

    it('throws if recording not found', async () => {
      const recorder = MacroRecorder.getInstance();
      await expect(recorder.playRecording('nonexistent', async () => {})).rejects.toThrow(
        'Recording not found: nonexistent',
      );
    });

    it('throws if already playing', async () => {
      vi.useFakeTimers();
      const result = recordMacro('Busy', [makeAction('a', {}, 100), makeAction('b', {}, 500)]);
      const recorder = MacroRecorder.getInstance();

      const promise = recorder.playRecording(result.id, async () => {});
      await expect(recorder.playRecording(result.id, async () => {})).rejects.toThrow(
        'Already playing a recording',
      );

      await vi.runAllTimersAsync();
      await promise;
    });

    it('resets isPlaying to false even if executor throws', async () => {
      const result = recordMacro('Error', [makeAction('a', {}, 100)]);
      const recorder = MacroRecorder.getInstance();

      let caughtError: Error | null = null;
      try {
        await recorder.playRecording(result.id, async () => {
          throw new Error('boom');
        });
      } catch (err) {
        caughtError = err as Error;
      }

      expect(caughtError).toBeTruthy();
      expect(caughtError!.message).toBe('boom');
      expect(recorder.isPlaying()).toBe(false);
    });

    it('does nothing for empty action list', async () => {
      const result = recordMacro('Empty', []);
      const recorder = MacroRecorder.getInstance();
      const executor = vi.fn().mockResolvedValue(undefined);
      await recorder.playRecording(result.id, executor);
      expect(executor).not.toHaveBeenCalled();
      expect(recorder.isPlaying()).toBe(false);
    });

    it('notifies subscribers on play start and end', async () => {
      vi.useFakeTimers();
      const result = recordMacro('Notify', [makeAction('a', {}, 100)]);
      const recorder = MacroRecorder.getInstance();
      const callback = vi.fn();
      recorder.subscribe(callback);
      callback.mockClear();

      const promise = recorder.playRecording(result.id, async () => {});
      expect(callback).toHaveBeenCalledTimes(1); // play start

      await vi.runAllTimersAsync();
      await promise;
      expect(callback).toHaveBeenCalledTimes(2); // play end
    });
  });

  // ---- Subscription -------------------------------------------------------

  describe('subscription', () => {
    it('returns an unsubscribe function that removes the callback', () => {
      const recorder = MacroRecorder.getInstance();
      const callback = vi.fn();
      const unsubscribe = recorder.subscribe(callback);
      recorder.startRecording('Test');
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
      callback.mockClear();
      recorder.stopRecording();
      expect(callback).not.toHaveBeenCalled();
    });

    it('supports multiple subscribers', () => {
      const recorder = MacroRecorder.getInstance();
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      recorder.subscribe(cb1);
      recorder.subscribe(cb2);
      recorder.startRecording('Test');
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });
  });

  // ---- Persistence --------------------------------------------------------

  describe('persistence', () => {
    it('loads recordings from localStorage on construction', () => {
      // Record and save
      recordMacro('Persistent', [makeAction('saved', { val: 42 }, 1000)]);

      // Reset instance to force reload from localStorage
      MacroRecorder.resetInstance();
      const recorder = MacroRecorder.getInstance();
      const recordings = recorder.getRecordings();
      expect(recordings).toHaveLength(1);
      expect(recordings[0].name).toBe('Persistent');
      expect(recordings[0].actions[0].payload.val).toBe(42);
    });

    it('survives invalid JSON in localStorage gracefully', () => {
      localStorage.setItem('protopulse:macros', '{{not valid json}}');
      MacroRecorder.resetInstance();
      const recorder = MacroRecorder.getInstance();
      expect(recorder.getRecordings()).toEqual([]);
    });

    it('ignores non-array data in localStorage', () => {
      localStorage.setItem('protopulse:macros', '{"not": "an array"}');
      MacroRecorder.resetInstance();
      const recorder = MacroRecorder.getInstance();
      expect(recorder.getRecordings()).toEqual([]);
    });

    it('filters out invalid recording objects in localStorage', () => {
      const valid: MacroRecording = {
        id: 'valid-id',
        name: 'Valid',
        actions: [{ type: 'click', payload: { x: 1 }, timestamp: 100 }],
        createdAt: 1000,
        duration: 0,
      };
      const invalid = { id: 123, name: null }; // wrong types
      localStorage.setItem('protopulse:macros', JSON.stringify([valid, invalid]));
      MacroRecorder.resetInstance();
      const recorder = MacroRecorder.getInstance();
      expect(recorder.getRecordings()).toHaveLength(1);
      expect(recorder.getRecordings()[0].name).toBe('Valid');
    });

    it('filters out recordings with invalid actions', () => {
      const badAction = {
        id: 'bad-action-id',
        name: 'BadAction',
        actions: [{ type: 'click', payload: 'not-an-object', timestamp: 100 }],
        createdAt: 1000,
        duration: 0,
      };
      localStorage.setItem('protopulse:macros', JSON.stringify([badAction]));
      MacroRecorder.resetInstance();
      const recorder = MacroRecorder.getInstance();
      expect(recorder.getRecordings()).toEqual([]);
    });

    it('handles localStorage.setItem failure gracefully', () => {
      const recorder = MacroRecorder.getInstance();
      const originalSetItem = localStorage.setItem.bind(localStorage);
      vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceeded');
      });
      // Should not throw
      recorder.startRecording('Quota Test');
      expect(() => recorder.stopRecording()).not.toThrow();
      vi.spyOn(localStorage, 'setItem').mockImplementation(originalSetItem);
    });
  });

  // ---- Complex workflows --------------------------------------------------

  describe('complex workflows', () => {
    it('supports multiple sequential recordings', () => {
      recordMacro('First', [makeAction('a')]);
      recordMacro('Second', [makeAction('b'), makeAction('c')]);
      recordMacro('Third', [makeAction('d')]);

      const recorder = MacroRecorder.getInstance();
      const recordings = recorder.getRecordings();
      expect(recordings).toHaveLength(3);
      expect(recordings[0].name).toBe('First');
      expect(recordings[1].name).toBe('Second');
      expect(recordings[2].name).toBe('Third');
    });

    it('can record after a previous recording was stopped', () => {
      const recorder = MacroRecorder.getInstance();
      recorder.startRecording('A');
      recorder.stopRecording();

      // Should be able to start a new recording
      recorder.startRecording('B');
      recorder.recordAction(makeAction('b'));
      const result = recorder.stopRecording();
      expect(result.name).toBe('B');
      expect(result.actions).toHaveLength(1);
    });

    it('can delete a recording and then record a new one', () => {
      const result = recordMacro('Temporary', [makeAction('a')]);
      const recorder = MacroRecorder.getInstance();
      recorder.deleteRecording(result.id);
      expect(recorder.getRecordings()).toHaveLength(0);

      recordMacro('Replacement', [makeAction('b')]);
      expect(recorder.getRecordings()).toHaveLength(1);
      expect(recorder.getRecordings()[0].name).toBe('Replacement');
    });

    it('each recording gets a unique id', () => {
      const r1 = recordMacro('A', [makeAction('a')]);
      const r2 = recordMacro('B', [makeAction('b')]);
      const r3 = recordMacro('C', [makeAction('c')]);
      expect(r1.id).not.toBe(r2.id);
      expect(r2.id).not.toBe(r3.id);
      expect(r1.id).not.toBe(r3.id);
    });

    it('playback does not modify the stored recording', async () => {
      vi.useFakeTimers();
      const result = recordMacro('Immutable', [makeAction('a', { v: 1 }, 100)]);
      const recorder = MacroRecorder.getInstance();

      const promise = recorder.playRecording(result.id, async (action) => {
        // Try to mutate the action during playback
        action.payload.v = 999;
      });
      await vi.runAllTimersAsync();
      await promise;

      const stored = recorder.getRecording(result.id)!;
      expect(stored.actions[0].payload.v).toBe(1);
    });

    it('can play a recording immediately after stopping one', async () => {
      vi.useFakeTimers();
      const r = recordMacro('Replay', [makeAction('x', {}, 100)]);
      const recorder = MacroRecorder.getInstance();
      const executed: string[] = [];

      const promise = recorder.playRecording(r.id, async (action) => {
        executed.push(action.type);
      });
      await vi.runAllTimersAsync();
      await promise;

      expect(executed).toEqual(['x']);
      expect(recorder.isPlaying()).toBe(false);
    });
  });
});
