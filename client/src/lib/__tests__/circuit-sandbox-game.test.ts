import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  ChallengeManager,
  BUILT_IN_CHALLENGES,
  useCircuitChallenge,
} from '../circuit-sandbox-game';
import type {
  ChallengeCircuit,
  ChallengeResult,
  ChallengeProgress,
  ChallengeDifficulty,
  Challenge,
} from '../circuit-sandbox-game';

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

function createMockLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
    get length() {
      return store.size;
    },
    key: vi.fn((_index: number) => null),
  };
}

// ---------------------------------------------------------------------------
// Circuit fixture builders
// ---------------------------------------------------------------------------

function makeInstance(
  id: string,
  refDes: string,
  props: Record<string, unknown> = {},
): ChallengeCircuit['instances'][number] {
  return { id, referenceDesignator: refDes, properties: props };
}

function makeNet(
  id: string,
  name: string,
  netType = 'signal',
  voltage?: string,
): ChallengeCircuit['nets'][number] {
  return { id, name, netType, voltage };
}

function makeWire(
  id: string,
  netId: string,
  points: Array<{ x: number; y: number }> = [{ x: 0, y: 0 }, { x: 10, y: 10 }],
): ChallengeCircuit['wires'][number] {
  return { id, netId, points };
}

function emptyCircuit(): ChallengeCircuit {
  return { instances: [], nets: [], wires: [] };
}

/** Builds a minimal passing LED-blink circuit. */
function ledBlinkCircuit(): ChallengeCircuit {
  return {
    instances: [
      makeInstance('1', 'D1'),
      makeInstance('2', 'R1'),
      makeInstance('3', 'U1'),
    ],
    nets: [
      makeNet('n1', 'GND'),
      makeNet('n2', 'VCC'),
    ],
    wires: [
      makeWire('w1', 'n1'),
      makeWire('w2', 'n2'),
    ],
  };
}

/** Builds a minimal passing voltage divider circuit. */
function voltageDividerCircuit(): ChallengeCircuit {
  return {
    instances: [
      makeInstance('1', 'R1'),
      makeInstance('2', 'R2'),
    ],
    nets: [
      makeNet('n1', 'VCC'),
      makeNet('n2', 'GND'),
      makeNet('n3', 'VOUT'),
    ],
    wires: [makeWire('w1', 'n1')],
  };
}

// ---------------------------------------------------------------------------
// BUILT_IN_CHALLENGES structure tests
// ---------------------------------------------------------------------------

describe('BUILT_IN_CHALLENGES', () => {
  it('has at least 10 challenges', () => {
    expect(BUILT_IN_CHALLENGES.length).toBeGreaterThanOrEqual(10);
  });

  it('every challenge has required fields', () => {
    for (const c of BUILT_IN_CHALLENGES) {
      expect(c.id).toBeTruthy();
      expect(c.title).toBeTruthy();
      expect(c.description).toBeTruthy();
      expect(['beginner', 'intermediate', 'advanced']).toContain(c.difficulty);
      expect(c.goal).toBeTruthy();
      expect(Array.isArray(c.hints)).toBe(true);
      expect(c.hints.length).toBeGreaterThan(0);
      expect(typeof c.validation).toBe('function');
    }
  });

  it('has unique IDs', () => {
    const ids = BUILT_IN_CHALLENGES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes all three difficulty levels', () => {
    const diffs = new Set(BUILT_IN_CHALLENGES.map((c) => c.difficulty));
    expect(diffs.has('beginner')).toBe(true);
    expect(diffs.has('intermediate')).toBe(true);
    expect(diffs.has('advanced')).toBe(true);
  });

  it('every validation returns a valid ChallengeResult for empty circuit', () => {
    const empty = emptyCircuit();
    for (const c of BUILT_IN_CHALLENGES) {
      const result = c.validation(empty);
      expect(result.passed).toBe(false);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(Array.isArray(result.feedback)).toBe(true);
      expect(result.feedback.length).toBeGreaterThan(0);
      expect(Array.isArray(result.bonus)).toBe(true);
    }
  });

  it('LED blink challenge passes with correct circuit', () => {
    const challenge = BUILT_IN_CHALLENGES.find((c) => c.id === 'led-blink')!;
    const result = challenge.validation(ledBlinkCircuit());
    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it('voltage divider challenge passes with correct circuit', () => {
    const challenge = BUILT_IN_CHALLENGES.find((c) => c.id === 'voltage-divider')!;
    const result = challenge.validation(voltageDividerCircuit());
    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it('LED blink gives bonus for VCC net', () => {
    const challenge = BUILT_IN_CHALLENGES.find((c) => c.id === 'led-blink')!;
    const circuit = ledBlinkCircuit();
    const result = challenge.validation(circuit);
    expect(result.bonus.length).toBeGreaterThan(0);
  });

  it('voltage divider reports feedback for missing components', () => {
    const challenge = BUILT_IN_CHALLENGES.find((c) => c.id === 'voltage-divider')!;
    const circuit: ChallengeCircuit = {
      instances: [makeInstance('1', 'R1')], // only 1 resistor
      nets: [makeNet('n1', 'VCC')],
      wires: [],
    };
    const result = challenge.validation(circuit);
    expect(result.passed).toBe(false);
    expect(result.feedback.some((f) => f.includes('resistor') || f.includes('GND') || f.includes('wire'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Individual challenge validation tests
// ---------------------------------------------------------------------------

describe('Challenge validations', () => {
  it('pull-up-resistor passes with correct circuit', () => {
    const challenge = BUILT_IN_CHALLENGES.find((c) => c.id === 'pull-up-resistor')!;
    const circuit: ChallengeCircuit = {
      instances: [
        makeInstance('1', 'R1'),
        makeInstance('2', 'SW1'),
        makeInstance('3', 'U1'),
      ],
      nets: [
        makeNet('n1', 'VCC'),
        makeNet('n2', 'GND'),
      ],
      wires: [makeWire('w1', 'n1')],
    };
    const result = challenge.validation(circuit);
    expect(result.passed).toBe(true);
  });

  it('rc-filter passes with correct circuit', () => {
    const challenge = BUILT_IN_CHALLENGES.find((c) => c.id === 'rc-filter')!;
    const circuit: ChallengeCircuit = {
      instances: [
        makeInstance('1', 'R1'),
        makeInstance('2', 'C1'),
      ],
      nets: [
        makeNet('n1', 'IN'),
        makeNet('n2', 'OUT'),
        makeNet('n3', 'GND'),
      ],
      wires: [makeWire('w1', 'n1')],
    };
    const result = challenge.validation(circuit);
    expect(result.passed).toBe(true);
  });

  it('h-bridge passes with correct circuit', () => {
    const challenge = BUILT_IN_CHALLENGES.find((c) => c.id === 'h-bridge')!;
    const circuit: ChallengeCircuit = {
      instances: [
        makeInstance('1', 'M1'),
        makeInstance('2', 'U1'),
      ],
      nets: [
        makeNet('n1', 'VCC'),
        makeNet('n2', 'GND'),
        makeNet('n3', 'IN1'),
      ],
      wires: [makeWire('w1', 'n1')],
    };
    const result = challenge.validation(circuit);
    expect(result.passed).toBe(true);
  });

  it('555-timer passes with correct circuit', () => {
    const challenge = BUILT_IN_CHALLENGES.find((c) => c.id === '555-timer')!;
    const circuit: ChallengeCircuit = {
      instances: [
        makeInstance('1', 'U1'),
        makeInstance('2', 'R1'),
        makeInstance('3', 'R2'),
        makeInstance('4', 'C1'),
      ],
      nets: [
        makeNet('n1', 'VCC'),
        makeNet('n2', 'GND'),
        makeNet('n3', 'OUT'),
      ],
      wires: [makeWire('w1', 'n1')],
    };
    const result = challenge.validation(circuit);
    expect(result.passed).toBe(true);
  });

  it('opamp-inverting passes with correct circuit', () => {
    const challenge = BUILT_IN_CHALLENGES.find((c) => c.id === 'opamp-inverting')!;
    const circuit: ChallengeCircuit = {
      instances: [
        makeInstance('1', 'U1'),
        makeInstance('2', 'R1'),
        makeInstance('3', 'R2'),
      ],
      nets: [
        makeNet('n1', 'IN'),
        makeNet('n2', 'OUT'),
        makeNet('n3', 'GND'),
        makeNet('n4', 'VCC'),
      ],
      wires: [makeWire('w1', 'n1')],
    };
    const result = challenge.validation(circuit);
    expect(result.passed).toBe(true);
  });

  it('power-supply passes with correct circuit', () => {
    const challenge = BUILT_IN_CHALLENGES.find((c) => c.id === 'power-supply')!;
    const circuit: ChallengeCircuit = {
      instances: [
        makeInstance('1', 'D1'),
        makeInstance('2', 'D2'),
        makeInstance('3', 'D3'),
        makeInstance('4', 'D4'),
        makeInstance('5', 'U1'),
        makeInstance('6', 'C1'),
      ],
      nets: [
        makeNet('n1', 'AC'),
        makeNet('n2', '5V'),
        makeNet('n3', 'GND'),
      ],
      wires: [makeWire('w1', 'n1')],
    };
    const result = challenge.validation(circuit);
    expect(result.passed).toBe(true);
  });

  it('sensor-reading passes with correct circuit', () => {
    const challenge = BUILT_IN_CHALLENGES.find((c) => c.id === 'sensor-reading')!;
    const circuit: ChallengeCircuit = {
      instances: [
        makeInstance('1', 'RV1'),
        makeInstance('2', 'U1'),
      ],
      nets: [
        makeNet('n1', 'VCC'),
        makeNet('n2', 'GND'),
        makeNet('n3', 'A0'),
      ],
      wires: [makeWire('w1', 'n1')],
    };
    const result = challenge.validation(circuit);
    expect(result.passed).toBe(true);
  });

  it('motor-control passes with correct circuit', () => {
    const challenge = BUILT_IN_CHALLENGES.find((c) => c.id === 'motor-control')!;
    const circuit: ChallengeCircuit = {
      instances: [
        makeInstance('1', 'M1'),
        makeInstance('2', 'Q1'),
        makeInstance('3', 'D1'),
      ],
      nets: [
        makeNet('n1', 'PWM'),
        makeNet('n2', 'VCC'),
        makeNet('n3', 'GND'),
      ],
      wires: [makeWire('w1', 'n1')],
    };
    const result = challenge.validation(circuit);
    expect(result.passed).toBe(true);
  });

  it('i2c-bus passes with correct circuit', () => {
    const challenge = BUILT_IN_CHALLENGES.find((c) => c.id === 'i2c-bus')!;
    const circuit: ChallengeCircuit = {
      instances: [
        makeInstance('1', 'U1'),
        makeInstance('2', 'IC1'),
        makeInstance('3', 'R1'),
        makeInstance('4', 'R2'),
      ],
      nets: [
        makeNet('n1', 'SDA'),
        makeNet('n2', 'SCL'),
        makeNet('n3', 'VCC'),
        makeNet('n4', 'GND'),
      ],
      wires: [makeWire('w1', 'n1')],
    };
    const result = challenge.validation(circuit);
    expect(result.passed).toBe(true);
  });

  it('battery-charger passes with correct circuit', () => {
    const challenge = BUILT_IN_CHALLENGES.find((c) => c.id === 'battery-charger')!;
    const circuit: ChallengeCircuit = {
      instances: [
        makeInstance('1', 'U1'),
        makeInstance('2', 'BT1'),
        makeInstance('3', 'D1'),
        makeInstance('4', 'R1'),
      ],
      nets: [
        makeNet('n1', 'VIN'),
        makeNet('n2', 'VBAT'),
        makeNet('n3', 'GND'),
      ],
      wires: [makeWire('w1', 'n1')],
    };
    const result = challenge.validation(circuit);
    expect(result.passed).toBe(true);
  });

  it('score is always between 0 and 100', () => {
    for (const challenge of BUILT_IN_CHALLENGES) {
      // Test with empty
      const r1 = challenge.validation(emptyCircuit());
      expect(r1.score).toBeGreaterThanOrEqual(0);
      expect(r1.score).toBeLessThanOrEqual(100);
    }
  });
});

// ---------------------------------------------------------------------------
// ChallengeManager
// ---------------------------------------------------------------------------

describe('ChallengeManager', () => {
  let manager: ChallengeManager;
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    ChallengeManager.resetInstance();
    manager = ChallengeManager.getInstance();
  });

  afterEach(() => {
    ChallengeManager.resetInstance();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  it('returns the same instance on repeated calls', () => {
    const a = ChallengeManager.getInstance();
    const b = ChallengeManager.getInstance();
    expect(a).toBe(b);
  });

  it('creates a fresh instance after resetInstance', () => {
    manager.startChallenge('led-blink');
    ChallengeManager.resetInstance();
    const fresh = ChallengeManager.getInstance();
    // fresh loads from localStorage, so active challenge should persist
    expect(fresh.getActiveChallengeId()).toBe('led-blink');
  });

  // -----------------------------------------------------------------------
  // startChallenge
  // -----------------------------------------------------------------------

  it('starts a challenge by id', () => {
    manager.startChallenge('led-blink');
    expect(manager.getActiveChallengeId()).toBe('led-blink');
    expect(manager.getActiveChallenge()?.title).toBe('LED Blink');
  });

  it('initializes progress on first start', () => {
    manager.startChallenge('led-blink');
    const progress = manager.getProgress('led-blink');
    expect(progress).not.toBeNull();
    expect(progress!.bestScore).toBe(0);
    expect(progress!.attempts).toBe(0);
    expect(progress!.completedAt).toBeNull();
    expect(progress!.hintsUsed).toBe(0);
  });

  it('does not reinitialize progress on subsequent starts', () => {
    manager.startChallenge('led-blink');
    manager.submitSolution(ledBlinkCircuit());
    const attempts = manager.getProgress('led-blink')!.attempts;
    manager.startChallenge('voltage-divider');
    manager.startChallenge('led-blink'); // restart
    expect(manager.getProgress('led-blink')!.attempts).toBe(attempts);
  });

  it('ignores unknown challenge IDs', () => {
    manager.startChallenge('nonexistent-challenge');
    expect(manager.getActiveChallengeId()).toBeNull();
  });

  // -----------------------------------------------------------------------
  // submitSolution
  // -----------------------------------------------------------------------

  it('submits solution and returns result', () => {
    manager.startChallenge('led-blink');
    const result = manager.submitSolution(ledBlinkCircuit());
    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it('increments attempts on each submission', () => {
    manager.startChallenge('led-blink');
    manager.submitSolution(emptyCircuit());
    manager.submitSolution(emptyCircuit());
    manager.submitSolution(ledBlinkCircuit());
    expect(manager.getProgress('led-blink')!.attempts).toBe(3);
  });

  it('tracks best score across attempts', () => {
    manager.startChallenge('led-blink');
    manager.submitSolution(emptyCircuit()); // low score
    const lowScore = manager.getProgress('led-blink')!.bestScore;
    manager.submitSolution(ledBlinkCircuit()); // high score
    expect(manager.getProgress('led-blink')!.bestScore).toBeGreaterThan(lowScore);
  });

  it('does not lower best score on worse attempt', () => {
    manager.startChallenge('led-blink');
    manager.submitSolution(ledBlinkCircuit());
    const bestScore = manager.getProgress('led-blink')!.bestScore;
    manager.submitSolution(emptyCircuit());
    expect(manager.getProgress('led-blink')!.bestScore).toBe(bestScore);
  });

  it('sets completedAt on first pass', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    manager.startChallenge('led-blink');
    manager.submitSolution(ledBlinkCircuit());
    expect(manager.getProgress('led-blink')!.completedAt).toBe(now);
    vi.restoreAllMocks();
  });

  it('returns error result when no active challenge', () => {
    const result = manager.submitSolution(emptyCircuit());
    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
    expect(result.feedback).toContain('No active challenge.');
  });

  // -----------------------------------------------------------------------
  // revealHint
  // -----------------------------------------------------------------------

  it('reveals hints sequentially', () => {
    manager.startChallenge('led-blink');
    const challenge = manager.getActiveChallenge()!;

    const hint1 = manager.revealHint();
    expect(hint1).toBe(challenge.hints[0]);

    const hint2 = manager.revealHint();
    expect(hint2).toBe(challenge.hints[1]);

    expect(manager.getHintsUsed()).toBe(2);
  });

  it('returns null when all hints are revealed', () => {
    manager.startChallenge('led-blink');
    const challenge = manager.getActiveChallenge()!;

    for (let i = 0; i < challenge.hints.length; i++) {
      manager.revealHint();
    }

    expect(manager.revealHint()).toBeNull();
  });

  it('returns null when no active challenge', () => {
    expect(manager.revealHint()).toBeNull();
  });

  // -----------------------------------------------------------------------
  // abandonChallenge
  // -----------------------------------------------------------------------

  it('abandons the active challenge', () => {
    manager.startChallenge('led-blink');
    manager.abandonChallenge();
    expect(manager.getActiveChallengeId()).toBeNull();
    // Progress should still be preserved
    expect(manager.getProgress('led-blink')).not.toBeNull();
  });

  it('abandon is safe when no active challenge', () => {
    expect(() => {
      manager.abandonChallenge();
    }).not.toThrow();
  });

  // -----------------------------------------------------------------------
  // resetProgress
  // -----------------------------------------------------------------------

  it('resets progress for a specific challenge', () => {
    manager.startChallenge('led-blink');
    manager.submitSolution(ledBlinkCircuit());
    manager.resetProgress('led-blink');
    expect(manager.getProgress('led-blink')).toBeNull();
    expect(manager.getActiveChallengeId()).toBeNull();
  });

  it('resetProgress is safe for non-existent challenge', () => {
    expect(() => {
      manager.resetProgress('nonexistent');
    }).not.toThrow();
  });

  // -----------------------------------------------------------------------
  // resetAllProgress
  // -----------------------------------------------------------------------

  it('resets all progress', () => {
    manager.startChallenge('led-blink');
    manager.submitSolution(ledBlinkCircuit());
    manager.startChallenge('voltage-divider');
    manager.submitSolution(voltageDividerCircuit());

    manager.resetAllProgress();
    expect(manager.getAllProgress()).toEqual([]);
    expect(manager.getActiveChallengeId()).toBeNull();
    expect(manager.getCompletedCount()).toBe(0);
  });

  it('resetAllProgress is safe when already empty', () => {
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.resetAllProgress();
    expect(callback).not.toHaveBeenCalled(); // no-op, no notify
  });

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  it('getCompletedCount returns number of passed challenges', () => {
    manager.startChallenge('led-blink');
    manager.submitSolution(ledBlinkCircuit());
    expect(manager.getCompletedCount()).toBe(1);
  });

  it('getTotalChallenges returns count of built-in challenges', () => {
    expect(manager.getTotalChallenges()).toBe(BUILT_IN_CHALLENGES.length);
  });

  it('getChallengeById returns null for unknown id', () => {
    expect(manager.getChallengeById('fake')).toBeNull();
  });

  it('getChallenges filters by difficulty', () => {
    const beginners = manager.getChallenges('beginner');
    expect(beginners.length).toBeGreaterThan(0);
    expect(beginners.every((c) => c.difficulty === 'beginner')).toBe(true);
  });

  it('getChallenges returns all when no difficulty filter', () => {
    expect(manager.getChallenges()).toHaveLength(BUILT_IN_CHALLENGES.length);
  });

  it('getActiveChallenge returns null when none active', () => {
    expect(manager.getActiveChallenge()).toBeNull();
  });

  it('getHintsUsed returns 0 when no active challenge', () => {
    expect(manager.getHintsUsed()).toBe(0);
  });

  // -----------------------------------------------------------------------
  // localStorage persistence
  // -----------------------------------------------------------------------

  it('persists state to localStorage on start', () => {
    manager.startChallenge('led-blink');
    expect(mockStorage.setItem).toHaveBeenCalledWith(
      'protopulse-circuit-challenges',
      expect.any(String),
    );
  });

  it('persists state to localStorage on submit', () => {
    manager.startChallenge('led-blink');
    vi.mocked(mockStorage.setItem).mockClear();
    manager.submitSolution(emptyCircuit());
    expect(mockStorage.setItem).toHaveBeenCalled();
  });

  it('loads from localStorage on init', () => {
    const data = {
      activeChallengeId: 'voltage-divider',
      progress: [
        { challengeId: 'voltage-divider', bestScore: 90, completedAt: 123, attempts: 3, hintsUsed: 1 },
      ],
    };
    vi.mocked(mockStorage.getItem).mockReturnValue(JSON.stringify(data));
    ChallengeManager.resetInstance();
    const loaded = ChallengeManager.getInstance();
    expect(loaded.getActiveChallengeId()).toBe('voltage-divider');
    expect(loaded.getProgress('voltage-divider')!.bestScore).toBe(90);
  });

  it('handles corrupt localStorage gracefully', () => {
    vi.mocked(mockStorage.getItem).mockReturnValue('not valid json{{{');
    ChallengeManager.resetInstance();
    const loaded = ChallengeManager.getInstance();
    expect(loaded.getActiveChallengeId()).toBeNull();
    expect(loaded.getAllProgress()).toEqual([]);
  });

  it('handles non-object localStorage data gracefully', () => {
    vi.mocked(mockStorage.getItem).mockReturnValue('"just a string"');
    ChallengeManager.resetInstance();
    const loaded = ChallengeManager.getInstance();
    expect(loaded.getActiveChallengeId()).toBeNull();
  });

  it('filters out invalid progress entries from localStorage', () => {
    const data = {
      activeChallengeId: null,
      progress: [
        { challengeId: 'led-blink', bestScore: 50, completedAt: null, attempts: 1, hintsUsed: 0 },
        { invalid: true },
        { challengeId: 'rc-filter', bestScore: 'not-a-number', completedAt: null, attempts: 1, hintsUsed: 0 },
        { challengeId: 'voltage-divider', bestScore: 80, completedAt: 999, attempts: 2, hintsUsed: 1 },
      ],
    };
    vi.mocked(mockStorage.getItem).mockReturnValue(JSON.stringify(data));
    ChallengeManager.resetInstance();
    const loaded = ChallengeManager.getInstance();
    expect(loaded.getAllProgress()).toHaveLength(2);
    expect(loaded.getProgress('led-blink')).not.toBeNull();
    expect(loaded.getProgress('voltage-divider')).not.toBeNull();
  });

  // -----------------------------------------------------------------------
  // Subscribe / unsubscribe
  // -----------------------------------------------------------------------

  it('calls subscriber on startChallenge', () => {
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.startChallenge('led-blink');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('calls subscriber on submitSolution', () => {
    manager.startChallenge('led-blink');
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.submitSolution(emptyCircuit());
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('calls subscriber on revealHint', () => {
    manager.startChallenge('led-blink');
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.revealHint();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('calls subscriber on abandonChallenge', () => {
    manager.startChallenge('led-blink');
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.abandonChallenge();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('calls subscriber on resetProgress', () => {
    manager.startChallenge('led-blink');
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.resetProgress('led-blink');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('calls subscriber on resetAllProgress', () => {
    manager.startChallenge('led-blink');
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.resetAllProgress();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not call subscriber after unsubscribe', () => {
    const callback = vi.fn();
    const unsub = manager.subscribe(callback);
    unsub();
    manager.startChallenge('led-blink');
    expect(callback).not.toHaveBeenCalled();
  });

  it('does not notify on ignore (unknown challenge start)', () => {
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.startChallenge('nonexistent');
    expect(callback).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

describe('useCircuitChallenge', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    ChallengeManager.resetInstance();
  });

  afterEach(() => {
    ChallengeManager.resetInstance();
  });

  it('returns challenge definition for valid id', () => {
    const { result } = renderHook(() => useCircuitChallenge('led-blink'));
    expect(result.current.challenge).not.toBeNull();
    expect(result.current.challenge!.id).toBe('led-blink');
  });

  it('returns null challenge for invalid id', () => {
    const { result } = renderHook(() => useCircuitChallenge('nonexistent'));
    expect(result.current.challenge).toBeNull();
  });

  it('starts and tracks a challenge', () => {
    const { result } = renderHook(() => useCircuitChallenge('led-blink'));
    act(() => {
      result.current.startChallenge();
    });
    expect(result.current.isActive).toBe(true);
    expect(result.current.progress).not.toBeNull();
  });

  it('submits a solution via hook', () => {
    const { result } = renderHook(() => useCircuitChallenge('led-blink'));
    let submitResult: ChallengeResult | undefined;
    act(() => {
      result.current.startChallenge();
    });
    act(() => {
      submitResult = result.current.submitSolution(ledBlinkCircuit());
    });
    expect(submitResult!.passed).toBe(true);
    expect(result.current.progress!.attempts).toBe(1);
  });

  it('auto-starts challenge on submitSolution if not active', () => {
    const { result } = renderHook(() => useCircuitChallenge('led-blink'));
    let submitResult: ChallengeResult | undefined;
    act(() => {
      submitResult = result.current.submitSolution(ledBlinkCircuit());
    });
    expect(submitResult!.passed).toBe(true);
    expect(result.current.isActive).toBe(true);
  });

  it('reveals hints via hook', () => {
    const { result } = renderHook(() => useCircuitChallenge('led-blink'));
    act(() => {
      result.current.startChallenge();
    });

    let hint: string | null = null;
    act(() => {
      hint = result.current.revealHint();
    });
    expect(hint).toBeTruthy();
    expect(result.current.revealedHints).toHaveLength(1);
  });

  it('abandons challenge via hook', () => {
    const { result } = renderHook(() => useCircuitChallenge('led-blink'));
    act(() => {
      result.current.startChallenge();
    });
    act(() => {
      result.current.abandonChallenge();
    });
    expect(result.current.isActive).toBe(false);
  });

  it('resets progress via hook', () => {
    const { result } = renderHook(() => useCircuitChallenge('led-blink'));
    act(() => {
      result.current.startChallenge();
      result.current.submitSolution(ledBlinkCircuit());
    });
    act(() => {
      result.current.resetProgress();
    });
    expect(result.current.progress).toBeNull();
  });

  it('provides completedCount and totalChallenges', () => {
    const { result } = renderHook(() => useCircuitChallenge('led-blink'));
    expect(result.current.completedCount).toBe(0);
    expect(result.current.totalChallenges).toBe(BUILT_IN_CHALLENGES.length);
  });

  it('cleans up subscription on unmount', () => {
    const { unmount } = renderHook(() => useCircuitChallenge('led-blink'));
    unmount();
    // Should not throw when manager notifies after unmount
    expect(() => {
      ChallengeManager.getInstance().startChallenge('led-blink');
    }).not.toThrow();
  });
});
