import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  MobileCaptureManager,
  useMobileCapture,
} from '../mobile-capture';
import type {
  CaptureResult,
  CaptureType,
  CaptureSession,
  ExtractedPart,
  ParsedBomEntry,
} from '../mobile-capture';

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
// Helpers
// ---------------------------------------------------------------------------

function makeCaptureResult(overrides?: Partial<CaptureResult>): CaptureResult {
  return {
    type: 'photo_to_part',
    data: 'data:image/jpeg;base64,/9j/4AAQ',
    timestamp: Date.now(),
    metadata: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// MobileCaptureManager — Singleton
// ---------------------------------------------------------------------------

describe('MobileCaptureManager', () => {
  let manager: MobileCaptureManager;
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    // Stub crypto.randomUUID for deterministic IDs
    let uuidCounter = 0;
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
      uuidCounter++;
      return `00000000-0000-0000-0000-${String(uuidCounter).padStart(12, '0')}` as ReturnType<typeof crypto.randomUUID>;
    });
    MobileCaptureManager.resetInstance();
    manager = MobileCaptureManager.getInstance();
  });

  afterEach(() => {
    MobileCaptureManager.resetInstance();
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  it('returns the same instance on repeated calls', () => {
    const a = MobileCaptureManager.getInstance();
    const b = MobileCaptureManager.getInstance();
    expect(a).toBe(b);
  });

  it('creates a fresh instance after resetInstance', () => {
    manager.addCapture(makeCaptureResult());
    expect(manager.getCaptureCount()).toBe(1);
    MobileCaptureManager.resetInstance();
    const fresh = MobileCaptureManager.getInstance();
    // Fresh instance re-loads from localStorage, which has the saved capture
    // but after full reset the storage was populated, so it should load
    expect(fresh).not.toBe(manager);
  });

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  it('notifies subscribers when captures change', () => {
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.addCapture(makeCaptureResult());
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe stops notifications', () => {
    const listener = vi.fn();
    const unsub = manager.subscribe(listener);
    unsub();
    manager.addCapture(makeCaptureResult());
    expect(listener).not.toHaveBeenCalled();
  });

  it('supports multiple subscribers', () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    manager.subscribe(listener1);
    manager.subscribe(listener2);
    manager.addCapture(makeCaptureResult());
    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // Capture CRUD
  // -----------------------------------------------------------------------

  it('starts with zero captures', () => {
    expect(manager.getCaptureCount()).toBe(0);
    expect(manager.getCaptures()).toEqual([]);
  });

  it('adds a capture result and returns it newest-first', () => {
    const c1 = makeCaptureResult({ timestamp: 1000 });
    const c2 = makeCaptureResult({ timestamp: 2000, type: 'barcode_scan' });
    manager.addCapture(c1);
    manager.addCapture(c2);
    const captures = manager.getCaptures();
    expect(captures).toHaveLength(2);
    expect(captures[0].timestamp).toBe(2000);
    expect(captures[1].timestamp).toBe(1000);
  });

  it('filters captures by type', () => {
    manager.addCapture(makeCaptureResult({ type: 'photo_to_part', timestamp: 1 }));
    manager.addCapture(makeCaptureResult({ type: 'barcode_scan', timestamp: 2 }));
    manager.addCapture(makeCaptureResult({ type: 'photo_to_part', timestamp: 3 }));
    const photos = manager.getCapturesByType('photo_to_part');
    expect(photos).toHaveLength(2);
    photos.forEach((c) => {
      expect(c.type).toBe('photo_to_part');
    });
  });

  it('enforces MAX_CAPTURES limit (100) by evicting oldest', () => {
    for (let i = 0; i < 105; i++) {
      manager.addCapture(makeCaptureResult({ timestamp: i }));
    }
    expect(manager.getCaptureCount()).toBe(100);
    // Oldest entries (timestamps 0-4) should be evicted
    const captures = manager.getCaptures();
    const timestamps = captures.map((c) => c.timestamp);
    expect(timestamps).not.toContain(0);
    expect(timestamps).not.toContain(4);
    expect(timestamps).toContain(5);
    expect(timestamps).toContain(104);
  });

  it('clears all captures', () => {
    manager.addCapture(makeCaptureResult());
    manager.addCapture(makeCaptureResult());
    expect(manager.getCaptureCount()).toBe(2);
    manager.clearCaptures();
    expect(manager.getCaptureCount()).toBe(0);
  });

  it('clearCaptures is a no-op when already empty', () => {
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.clearCaptures();
    expect(listener).not.toHaveBeenCalled();
  });

  it('returns copies of captures (no external mutation)', () => {
    manager.addCapture(makeCaptureResult());
    const a = manager.getCaptures();
    const b = manager.getCaptures();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  it('persists captures to localStorage on addCapture', () => {
    manager.addCapture(makeCaptureResult());
    expect(mockStorage.setItem).toHaveBeenCalled();
    const stored = (mockStorage.setItem as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    const parsed = JSON.parse(stored) as { captures: CaptureResult[] };
    expect(parsed.captures).toHaveLength(1);
  });

  it('loads captures from localStorage on construction', () => {
    const capture = makeCaptureResult({ timestamp: 42, type: 'voice_note' });
    const data = JSON.stringify({ captures: [capture], sessions: [] });
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(data);

    MobileCaptureManager.resetInstance();
    const loaded = MobileCaptureManager.getInstance();
    expect(loaded.getCaptureCount()).toBe(1);
    expect(loaded.getCaptures()[0].type).toBe('voice_note');
  });

  it('handles corrupt localStorage data gracefully', () => {
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('{{invalid json');
    MobileCaptureManager.resetInstance();
    const loaded = MobileCaptureManager.getInstance();
    expect(loaded.getCaptureCount()).toBe(0);
  });

  it('handles non-array captures in localStorage', () => {
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
      JSON.stringify({ captures: 'not-an-array', sessions: [] }),
    );
    MobileCaptureManager.resetInstance();
    const loaded = MobileCaptureManager.getInstance();
    expect(loaded.getCaptureCount()).toBe(0);
  });

  it('filters out invalid capture entries from localStorage', () => {
    const validCapture = makeCaptureResult();
    const invalidCapture = { type: 123, data: null }; // invalid types
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
      JSON.stringify({ captures: [validCapture, invalidCapture], sessions: [] }),
    );
    MobileCaptureManager.resetInstance();
    const loaded = MobileCaptureManager.getInstance();
    expect(loaded.getCaptureCount()).toBe(1);
  });

  // -----------------------------------------------------------------------
  // capturePhoto
  // -----------------------------------------------------------------------

  it('throws when getUserMedia is not available', async () => {
    // happy-dom should not have full getUserMedia
    // Ensure navigator.mediaDevices is missing or getUserMedia is not a function
    const origMediaDevices = navigator.mediaDevices;
    Object.defineProperty(navigator, 'mediaDevices', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    await expect(manager.capturePhoto()).rejects.toThrow('Camera access is not available');
    Object.defineProperty(navigator, 'mediaDevices', {
      value: origMediaDevices,
      writable: true,
      configurable: true,
    });
  });

  // -----------------------------------------------------------------------
  // photoToPart
  // -----------------------------------------------------------------------

  it('returns null for empty or non-data-URL input', () => {
    expect(manager.photoToPart('')).toBeNull();
    expect(manager.photoToPart('https://example.com/photo.jpg')).toBeNull();
  });

  it('returns a low-confidence result when no hint text is provided', () => {
    const result = manager.photoToPart('data:image/jpeg;base64,abc');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Unknown Component');
    expect(result!.confidence).toBe(0.1);
  });

  it('extracts a resistor from hint text "10K ohm"', () => {
    const result = manager.photoToPart('data:image/jpeg;base64,abc', '10K ohm');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Resistor');
    expect(result!.value).toContain('10');
    expect(result!.confidence).toBeGreaterThan(0.4);
  });

  it('extracts a capacitor from hint text "100nF"', () => {
    const result = manager.photoToPart('data:image/jpeg;base64,abc', '100nF');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Capacitor');
    expect(result!.value).toContain('100');
  });

  it('extracts package type from hint text "10K 0805"', () => {
    const result = manager.photoToPart('data:image/jpeg;base64,abc', '10K ohm 0805');
    expect(result).not.toBeNull();
    expect(result!.packageType).toBe('0805');
  });

  it('handles an inductor hint "47uH"', () => {
    const result = manager.photoToPart('data:image/jpeg;base64,abc', '47uH');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Inductor');
    expect(result!.value).toContain('47');
  });

  it('falls back to low confidence for unrecognizable text', () => {
    const result = manager.photoToPart('data:image/jpeg;base64,abc', 'mystery blob');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('mystery blob');
    expect(result!.confidence).toBe(0.2);
  });

  // -----------------------------------------------------------------------
  // noteToBom
  // -----------------------------------------------------------------------

  it('parses "3x 10K resistor 0805"', () => {
    const entry = manager.noteToBom('3x 10K resistor 0805');
    expect(entry.quantity).toBe(3);
    expect(entry.description).toContain('10K');
    expect(entry.rawText).toBe('3x 10K resistor 0805');
  });

  it('parses "C1 100nF ceramic"', () => {
    const entry = manager.noteToBom('C1 100nF ceramic');
    expect(entry.designator).toBe('C1');
    expect(entry.value).toContain('100');
    expect(entry.description).toContain('ceramic');
  });

  it('defaults quantity to 1 when not specified', () => {
    const entry = manager.noteToBom('ATmega328P DIP-28');
    expect(entry.quantity).toBe(1);
  });

  it('handles empty text', () => {
    const entry = manager.noteToBom('');
    expect(entry.quantity).toBe(1);
    expect(entry.description).toBe('');
    expect(entry.rawText).toBe('');
  });

  it('preserves raw text', () => {
    const entry = manager.noteToBom('5x LED red 5mm');
    expect(entry.rawText).toBe('5x LED red 5mm');
    expect(entry.quantity).toBe(5);
  });

  it('parses a note with only a designator and value', () => {
    const entry = manager.noteToBom('R7 4.7K');
    expect(entry.designator).toBe('R7');
    expect(entry.value).toContain('4.7');
  });

  // -----------------------------------------------------------------------
  // CaptureSession — creation
  // -----------------------------------------------------------------------

  it('creates a session with the given steps', () => {
    const session = manager.createSession([
      { label: 'Snap photo', type: 'photo_to_part' },
      { label: 'Scan barcode', type: 'barcode_scan' },
    ]);
    expect(session.id).toBeTruthy();
    expect(session.steps).toHaveLength(2);
    expect(session.status).toBe('in_progress');
    expect(session.completedAt).toBeNull();
    expect(session.steps[0].label).toBe('Snap photo');
    expect(session.steps[0].completed).toBe(false);
    expect(session.steps[1].type).toBe('barcode_scan');
  });

  it('throws when creating a session with zero steps', () => {
    expect(() => manager.createSession([])).toThrow('at least one step');
  });

  it('persists sessions to localStorage', () => {
    manager.createSession([{ label: 'Step 1', type: 'voice_note' }]);
    const stored = (mockStorage.setItem as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    const parsed = JSON.parse(stored) as { sessions: CaptureSession[] };
    expect(parsed.sessions).toHaveLength(1);
  });

  // -----------------------------------------------------------------------
  // CaptureSession — step completion
  // -----------------------------------------------------------------------

  it('completes a step and marks it done', () => {
    const session = manager.createSession([
      { label: 'A', type: 'photo_to_part' },
      { label: 'B', type: 'note_to_bom' },
    ]);
    const result = makeCaptureResult();
    manager.completeStep(session.id, session.steps[0].id, result);
    const updated = manager.getSession(session.id)!;
    expect(updated.steps[0].completed).toBe(true);
    expect(updated.steps[0].result).toEqual(result);
    expect(updated.status).toBe('in_progress');
  });

  it('marks session complete when all steps are done', () => {
    const session = manager.createSession([
      { label: 'A', type: 'photo_to_part' },
      { label: 'B', type: 'barcode_scan' },
    ]);
    manager.completeStep(session.id, session.steps[0].id, makeCaptureResult());
    manager.completeStep(session.id, session.steps[1].id, makeCaptureResult({ type: 'barcode_scan' }));
    const updated = manager.getSession(session.id)!;
    expect(updated.status).toBe('complete');
    expect(updated.completedAt).toBeGreaterThan(0);
  });

  it('throws when completing a step in a non-existent session', () => {
    expect(() => manager.completeStep('bad-id', 'step-id', makeCaptureResult())).toThrow('Session not found');
  });

  it('throws when completing a step in a cancelled session', () => {
    const session = manager.createSession([{ label: 'A', type: 'photo_to_part' }]);
    manager.cancelSession(session.id);
    expect(() => manager.completeStep(session.id, session.steps[0].id, makeCaptureResult())).toThrow(
      'cancelled session',
    );
  });

  it('throws when completing a step in an already complete session', () => {
    const session = manager.createSession([{ label: 'A', type: 'photo_to_part' }]);
    manager.completeStep(session.id, session.steps[0].id, makeCaptureResult());
    // Session is now complete; try to complete again with same step
    expect(() => manager.completeStep(session.id, session.steps[0].id, makeCaptureResult())).toThrow(
      'already complete',
    );
  });

  it('throws when completing a non-existent step', () => {
    const session = manager.createSession([{ label: 'A', type: 'photo_to_part' }]);
    expect(() => manager.completeStep(session.id, 'no-such-step', makeCaptureResult())).toThrow('Step not found');
  });

  // -----------------------------------------------------------------------
  // CaptureSession — cancellation
  // -----------------------------------------------------------------------

  it('cancels an in-progress session', () => {
    const session = manager.createSession([{ label: 'A', type: 'photo_to_part' }]);
    manager.cancelSession(session.id);
    const updated = manager.getSession(session.id)!;
    expect(updated.status).toBe('cancelled');
  });

  it('is idempotent when cancelling an already cancelled session', () => {
    const session = manager.createSession([{ label: 'A', type: 'photo_to_part' }]);
    manager.cancelSession(session.id);
    // Should not throw
    manager.cancelSession(session.id);
    expect(manager.getSession(session.id)!.status).toBe('cancelled');
  });

  it('throws when cancelling a non-existent session', () => {
    expect(() => manager.cancelSession('nope')).toThrow('Session not found');
  });

  // -----------------------------------------------------------------------
  // CaptureSession — navigation helpers
  // -----------------------------------------------------------------------

  it('getNextStep returns the first incomplete step', () => {
    const session = manager.createSession([
      { label: 'A', type: 'photo_to_part' },
      { label: 'B', type: 'barcode_scan' },
    ]);
    const next = manager.getNextStep(session.id);
    expect(next?.label).toBe('A');
  });

  it('getNextStep advances after completing a step', () => {
    const session = manager.createSession([
      { label: 'A', type: 'photo_to_part' },
      { label: 'B', type: 'barcode_scan' },
    ]);
    manager.completeStep(session.id, session.steps[0].id, makeCaptureResult());
    const next = manager.getNextStep(session.id);
    expect(next?.label).toBe('B');
  });

  it('getNextStep returns null for a complete session', () => {
    const session = manager.createSession([{ label: 'A', type: 'photo_to_part' }]);
    manager.completeStep(session.id, session.steps[0].id, makeCaptureResult());
    expect(manager.getNextStep(session.id)).toBeNull();
  });

  it('getNextStep returns null for a cancelled session', () => {
    const session = manager.createSession([{ label: 'A', type: 'photo_to_part' }]);
    manager.cancelSession(session.id);
    expect(manager.getNextStep(session.id)).toBeNull();
  });

  it('getNextStep returns null for a non-existent session', () => {
    expect(manager.getNextStep('nope')).toBeNull();
  });

  it('getSessionProgress returns 0 for an empty/non-existent session', () => {
    expect(manager.getSessionProgress('nope')).toBe(0);
  });

  it('getSessionProgress returns fraction of completed steps', () => {
    const session = manager.createSession([
      { label: 'A', type: 'photo_to_part' },
      { label: 'B', type: 'barcode_scan' },
      { label: 'C', type: 'voice_note' },
    ]);
    manager.completeStep(session.id, session.steps[0].id, makeCaptureResult());
    expect(manager.getSessionProgress(session.id)).toBeCloseTo(1 / 3);
    manager.completeStep(session.id, session.steps[1].id, makeCaptureResult({ type: 'barcode_scan' }));
    expect(manager.getSessionProgress(session.id)).toBeCloseTo(2 / 3);
    manager.completeStep(session.id, session.steps[2].id, makeCaptureResult({ type: 'voice_note' }));
    expect(manager.getSessionProgress(session.id)).toBe(1);
  });

  // -----------------------------------------------------------------------
  // Session queries
  // -----------------------------------------------------------------------

  it('getSessions returns all sessions', () => {
    manager.createSession([{ label: 'A', type: 'photo_to_part' }]);
    manager.createSession([{ label: 'B', type: 'note_to_bom' }]);
    expect(manager.getSessions()).toHaveLength(2);
  });

  it('getSession returns null for unknown ID', () => {
    expect(manager.getSession('nonexistent')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// useMobileCapture hook
// ---------------------------------------------------------------------------

describe('useMobileCapture', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    let uuidCounter = 100;
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
      uuidCounter++;
      return `00000000-0000-0000-0000-${String(uuidCounter).padStart(12, '0')}` as ReturnType<typeof crypto.randomUUID>;
    });
    MobileCaptureManager.resetInstance();
  });

  afterEach(() => {
    MobileCaptureManager.resetInstance();
    vi.restoreAllMocks();
  });

  it('returns empty captures initially', () => {
    const { result } = renderHook(() => useMobileCapture());
    expect(result.current.captures).toEqual([]);
    expect(result.current.captureCount).toBe(0);
  });

  it('updates when a capture is added via the manager', () => {
    const { result } = renderHook(() => useMobileCapture());
    act(() => {
      MobileCaptureManager.getInstance().addCapture(makeCaptureResult());
    });
    expect(result.current.captures).toHaveLength(1);
    expect(result.current.captureCount).toBe(1);
  });

  it('addCapture wrapper works', () => {
    const { result } = renderHook(() => useMobileCapture());
    act(() => {
      result.current.addCapture(makeCaptureResult({ type: 'voice_note' }));
    });
    expect(result.current.captures).toHaveLength(1);
    expect(result.current.captures[0].type).toBe('voice_note');
  });

  it('clearCaptures wrapper works', () => {
    const { result } = renderHook(() => useMobileCapture());
    act(() => {
      result.current.addCapture(makeCaptureResult());
      result.current.addCapture(makeCaptureResult());
    });
    expect(result.current.captureCount).toBe(2);
    act(() => {
      result.current.clearCaptures();
    });
    expect(result.current.captureCount).toBe(0);
  });

  it('photoToPart wrapper delegates to the manager', () => {
    const { result } = renderHook(() => useMobileCapture());
    const part = result.current.photoToPart('data:image/jpeg;base64,abc', '10K ohm');
    expect(part).not.toBeNull();
    expect(part!.name).toBe('Resistor');
  });

  it('noteToBom wrapper delegates to the manager', () => {
    const { result } = renderHook(() => useMobileCapture());
    const entry = result.current.noteToBom('3x 10K resistor 0805');
    expect(entry.quantity).toBe(3);
  });

  it('createSession wrapper works', () => {
    const { result } = renderHook(() => useMobileCapture());
    let session: CaptureSession | undefined;
    act(() => {
      session = result.current.createSession([
        { label: 'Step 1', type: 'photo_to_part' },
      ]);
    });
    expect(session).toBeDefined();
    expect(result.current.sessions).toHaveLength(1);
  });

  it('getSessionProgress wrapper works', () => {
    const { result } = renderHook(() => useMobileCapture());
    let session: CaptureSession | undefined;
    act(() => {
      session = result.current.createSession([
        { label: 'A', type: 'photo_to_part' },
        { label: 'B', type: 'barcode_scan' },
      ]);
    });
    expect(result.current.getSessionProgress(session!.id)).toBe(0);
    act(() => {
      result.current.completeStep(session!.id, session!.steps[0].id, makeCaptureResult());
    });
    expect(result.current.getSessionProgress(session!.id)).toBe(0.5);
  });

  it('cancelSession wrapper works', () => {
    const { result } = renderHook(() => useMobileCapture());
    let session: CaptureSession | undefined;
    act(() => {
      session = result.current.createSession([{ label: 'A', type: 'photo_to_part' }]);
    });
    act(() => {
      result.current.cancelSession(session!.id);
    });
    expect(result.current.sessions[0].status).toBe('cancelled');
  });

  it('getNextStep wrapper works', () => {
    const { result } = renderHook(() => useMobileCapture());
    let session: CaptureSession | undefined;
    act(() => {
      session = result.current.createSession([
        { label: 'A', type: 'photo_to_part' },
        { label: 'B', type: 'barcode_scan' },
      ]);
    });
    const next = result.current.getNextStep(session!.id);
    expect(next?.label).toBe('A');
  });
});

// ---------------------------------------------------------------------------
// Type exports — compile-time verification
// ---------------------------------------------------------------------------

describe('Type exports', () => {
  it('CaptureType union has exactly 4 members', () => {
    const types: CaptureType[] = ['photo_to_part', 'note_to_bom', 'barcode_scan', 'voice_note'];
    expect(types).toHaveLength(4);
  });

  it('CaptureResult has required fields', () => {
    const result: CaptureResult = {
      type: 'photo_to_part',
      data: 'test',
      timestamp: 1,
      metadata: { key: 'val' },
    };
    expect(result.type).toBe('photo_to_part');
    expect(result.metadata).toEqual({ key: 'val' });
  });

  it('ExtractedPart has required fields', () => {
    const part: ExtractedPart = {
      name: 'Resistor',
      value: '10K',
      packageType: '0805',
      confidence: 0.9,
      rawText: '10K 0805',
    };
    expect(part.name).toBe('Resistor');
  });

  it('ParsedBomEntry has required fields', () => {
    const entry: ParsedBomEntry = {
      quantity: 3,
      designator: 'R1',
      value: '10K',
      description: '10K resistor',
      rawText: '3x R1 10K',
    };
    expect(entry.quantity).toBe(3);
  });
});
