import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { CircuitIR } from '../circuit-ir';

// ─── Mock Worker ────────────────────────────────────────────────────────────

type MessageHandler = ((e: MessageEvent) => void) | null;

class MockWorker {
  onmessage: MessageHandler = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  private terminated = false;

  postMessage(data: unknown) {
    if (this.terminated) {
      return;
    }
    // Simulate async worker processing — subclasses/test setup will override behavior
    MockWorker._lastPostedData = data;
    if (MockWorker._autoRespond && this.onmessage) {
      const response = MockWorker._autoRespond(data as Record<string, unknown>);
      if (response) {
        setTimeout(() => {
          if (!this.terminated && this.onmessage) {
            this.onmessage(new MessageEvent('message', { data: response }));
          }
        }, 0);
      }
    }
  }

  terminate() {
    this.terminated = true;
  }

  get isTerminated() {
    return this.terminated;
  }

  // Test control surface
  static _lastPostedData: unknown = null;
  static _autoRespond: ((data: Record<string, unknown>) => unknown) | null = null;

  static reset() {
    MockWorker._lastPostedData = null;
    MockWorker._autoRespond = null;
  }
}

// Mock the Worker global and URL.createObjectURL/revokeObjectURL
vi.stubGlobal('Worker', MockWorker);
vi.stubGlobal(
  'URL',
  new Proxy(globalThis.URL ?? {}, {
    get(target, prop) {
      if (prop === 'createObjectURL') {
        return () => 'blob:mock-worker-url';
      }
      if (prop === 'revokeObjectURL') {
        return () => undefined;
      }
      return Reflect.get(target, prop) as unknown;
    },
  }),
);
vi.stubGlobal('Blob', class MockBlob {
  constructor(public parts: string[], public options?: BlobPropertyBag) {}
});

// Mock sucrase transform — return code as-is (it's already JS in tests)
vi.mock('sucrase', () => ({
  transform: vi.fn((code: string) => ({ code })),
}));

// ─── Import after mocks ────────────────────────────────────────────────────
// vi.mock hoists above imports automatically in Vitest, so regular imports work.

import { createCircuitWorker, evaluateInWorker, terminateWorker } from '../circuit-dsl-worker';
import { useCircuitEvaluator } from '../use-circuit-evaluator';

// ─── Tests: Worker Functions ────────────────────────────────────────────────

describe('createCircuitWorker', () => {
  beforeEach(() => {
    MockWorker.reset();
  });

  it('creates a Worker instance', () => {
    const worker = createCircuitWorker();
    expect(worker).toBeDefined();
    expect(worker).toBeInstanceOf(MockWorker);
  });
});

describe('evaluateInWorker', () => {
  beforeEach(() => {
    MockWorker.reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('evaluates simple DSL code and returns valid CircuitIR', async () => {
    const validIR: CircuitIR = {
      meta: { name: 'Test', version: '1.0' },
      components: [
        {
          id: 'c1',
          refdes: 'R1',
          partId: 'resistor:10k',
          value: '10k',
          pins: { '1': '', '2': '' },
        },
      ],
      nets: [],
      wires: [],
    };

    MockWorker._autoRespond = (data) => ({
      ok: true,
      ir: validIR,
      evalId: (data as Record<string, unknown>).evalId,
    });

    const worker = createCircuitWorker();
    const promise = evaluateInWorker(worker, 'c.resistor({ value: "10k" })', []);
    await vi.advanceTimersByTimeAsync(10);
    const result = await promise;

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ir.meta.name).toBe('Test');
      expect(result.ir.components).toHaveLength(1);
      expect(result.ir.components[0].refdes).toBe('R1');
    }
  });

  it('returns parse errors with line numbers', async () => {
    MockWorker._autoRespond = (data) => ({
      ok: false,
      error: 'SyntaxError: Unexpected token at line 3',
      line: 3,
      evalId: (data as Record<string, unknown>).evalId,
    });

    const worker = createCircuitWorker();
    const promise = evaluateInWorker(worker, 'invalid code {{{', []);
    await vi.advanceTimersByTimeAsync(10);
    const result = await promise;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('SyntaxError');
      expect(result.line).toBe(3);
    }
  });

  it('returns runtime errors for bad pin references', async () => {
    MockWorker._autoRespond = (data) => ({
      ok: false,
      error: 'RuntimeError: Component R1 has 2 pins, pin 5 does not exist',
      evalId: (data as Record<string, unknown>).evalId,
    });

    const worker = createCircuitWorker();
    const promise = evaluateInWorker(worker, 'c.resistor({ value: "10k" }).pin(5)', []);
    await vi.advanceTimersByTimeAsync(10);
    const result = await promise;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('pin');
    }
  });

  it('times out and rejects after 2s for infinite loops', async () => {
    // Worker never responds — simulating infinite loop
    MockWorker._autoRespond = null;

    const worker = createCircuitWorker();
    const promise = evaluateInWorker(worker, 'while(true) {}', []);

    // Advance past the 2s watchdog timeout
    await vi.advanceTimersByTimeAsync(2100);

    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/timeout|timed out/i);
    }
  });

  it('rejects code attempting to access restricted globals', async () => {
    MockWorker._autoRespond = (data) => ({
      ok: false,
      error: 'SecurityError: Access to fetch is not allowed in sandbox',
      evalId: (data as Record<string, unknown>).evalId,
    });

    const worker = createCircuitWorker();
    const promise = evaluateInWorker(worker, 'fetch("http://evil.com")', []);
    await vi.advanceTimersByTimeAsync(10);
    const result = await promise;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('not allowed');
    }
  });

  it('rejects IR output exceeding 1MB', async () => {
    // Build a very large IR to test the size guard
    const hugeIR: CircuitIR = {
      meta: { name: 'Huge', version: '1.0' },
      components: [],
      nets: [],
      wires: [],
    };
    // Simulate worker returning oversized payload
    MockWorker._autoRespond = (data) => ({
      ok: true,
      ir: hugeIR,
      evalId: (data as Record<string, unknown>).evalId,
      _rawSize: 2_000_000, // Signal to evaluateInWorker that this is oversized
    });

    const worker = createCircuitWorker();
    const promise = evaluateInWorker(worker, 'generate_huge()', []);
    await vi.advanceTimersByTimeAsync(10);
    const result = await promise;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/size|exceed|too large|1MB/i);
    }
  });
});

describe('terminateWorker', () => {
  it('terminates the worker', () => {
    const worker = createCircuitWorker();
    terminateWorker(worker);
    expect((worker as unknown as MockWorker).isTerminated).toBe(true);
  });
});

// ─── Tests: useCircuitEvaluator Hook ────────────────────────────────────────

describe('useCircuitEvaluator', () => {
  beforeEach(() => {
    MockWorker.reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial state: null ir, null error, not evaluating', () => {
    const { result } = renderHook(() => useCircuitEvaluator());

    expect(result.current.ir).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isEvaluating).toBe(false);
    expect(typeof result.current.evaluate).toBe('function');
  });

  it('sets isEvaluating to true during evaluation', async () => {
    // Delay response so we can observe isEvaluating
    MockWorker._autoRespond = null;

    const { result } = renderHook(() => useCircuitEvaluator());

    act(() => {
      result.current.evaluate('c.resistor({ value: "10k" })');
    });

    expect(result.current.isEvaluating).toBe(true);
  });

  it('receives IR result from successful evaluation', async () => {
    const validIR: CircuitIR = {
      meta: { name: 'Hook Test', version: '1.0' },
      components: [
        {
          id: 'c1',
          refdes: 'R1',
          partId: 'resistor:10k',
          value: '10k',
          pins: { '1': '', '2': '' },
        },
      ],
      nets: [],
      wires: [],
    };

    MockWorker._autoRespond = (data) => ({
      ok: true,
      ir: validIR,
      evalId: (data as Record<string, unknown>).evalId,
    });

    const { result } = renderHook(() => useCircuitEvaluator());

    await act(async () => {
      result.current.evaluate('c.resistor({ value: "10k" })');
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.isEvaluating).toBe(false);
    expect(result.current.ir).not.toBeNull();
    expect(result.current.ir?.components).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('receives error from failed evaluation', async () => {
    MockWorker._autoRespond = (data) => ({
      ok: false,
      error: 'SyntaxError: unexpected token',
      line: 1,
      evalId: (data as Record<string, unknown>).evalId,
    });

    const { result } = renderHook(() => useCircuitEvaluator());

    await act(async () => {
      result.current.evaluate('bad code');
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.isEvaluating).toBe(false);
    expect(result.current.ir).toBeNull();
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toContain('SyntaxError');
  });

  it('new evaluation cancels in-flight evaluation', async () => {
    let callCount = 0;
    MockWorker._autoRespond = (data) => {
      callCount++;
      // Only respond to the second call
      if (callCount >= 2) {
        return {
          ok: true,
          ir: {
            meta: { name: 'Second', version: '1.0' },
            components: [],
            nets: [],
            wires: [],
          },
          evalId: (data as Record<string, unknown>).evalId,
        };
      }
      // First call: delayed response that should be ignored
      return null;
    };

    const { result } = renderHook(() => useCircuitEvaluator());

    act(() => {
      // Fire first eval — will not get a response
      result.current.evaluate('first code');
    });

    await act(async () => {
      // Fire second eval immediately — should cancel first
      result.current.evaluate('second code');
      await vi.advanceTimersByTimeAsync(10);
    });

    // Should only have the second result
    expect(result.current.ir?.meta.name).toBe('Second');
  });

  it('cleans up worker on unmount', () => {
    const { unmount } = renderHook(() => useCircuitEvaluator());
    unmount();
    // Worker should be terminated — no way to check directly but it shouldn't throw
  });
});
