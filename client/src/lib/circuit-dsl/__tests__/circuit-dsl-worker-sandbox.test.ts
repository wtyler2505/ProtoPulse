/**
 * Tests for circuit-dsl-worker sandbox hardening.
 *
 * Addresses audit finding #59 (P0): the inline WORKER_CODE string evaluates
 * user DSL via `new Function()` with only a block-list of dangerous globals
 * as defense. A sibling sandbox (drc-script-worker) had the same class of
 * vulnerability — Function.constructor escape via function literal prototype
 * — which was fixed there in task #70.
 *
 * The same fix was applied to this worker on 2026-04-17:
 *   - freezeConstructor(self)
 *   - freezeConstructor(Function.prototype)
 *   - freezeConstructor(GeneratorFunction.prototype)
 *   - freezeConstructor(AsyncFunction.prototype)
 *
 * These tests execute the WORKER_CODE string in the test environment to
 * verify the freezes are active and escape attempts produce no LEAK.
 *
 * NOTE: we can't cleanly spin up a real Web Worker from a Blob URL in
 * happy-dom, so we extract the WORKER_CODE and eval it with a stub `self`
 * and a captured postMessage. This mirrors the approach used by
 * drc-script-worker.test.ts.
 */

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Load the worker source file as text and extract the WORKER_CODE template.
// Re-importing the module won't help because WORKER_CODE is a constant string
// we need to execute in a controlled scope.
const workerSourcePath = path.resolve(
  __dirname,
  '..',
  'circuit-dsl-worker.ts',
);
const workerSource = fs.readFileSync(workerSourcePath, 'utf8');

// Pull out everything between `const WORKER_CODE = \`` and the closing backtick.
// The source uses escaped backslashes inside the template which must survive
// into the executable code.
function extractWorkerCode(src: string): string {
  const match = src.match(/const WORKER_CODE = `([\s\S]*?)`;/);
  if (!match) throw new Error('WORKER_CODE template not found');
  // Unescape the backslash-escaped backslashes inserted for template safety
  return match[1].replace(/\\\\/g, '\\').replace(/\\`/g, '`');
}
const WORKER_CODE = extractWorkerCode(workerSource);

interface CapturedMessage {
  ok: boolean;
  ir?: unknown;
  error?: string;
  line?: number;
  evalId: string;
}

/**
 * Spin up a fresh sandboxed scope emulating a Web Worker and dispatch a
 * message. Returns the captured postMessage payload.
 */
function runWorkerWithCode(transpiledCode: string): CapturedMessage {
  const captured: CapturedMessage[] = [];

  // Create an isolated scope by wrapping the WORKER_CODE in a function that
  // shadows `self` with a mock. The freeze applied to globalThis/Function.prototype
  // in our test process is PERMANENT — once set, subsequent tests see it too,
  // which is actually the real-world behavior.
  const mockSelf = {
    onmessage: null as ((e: MessageEvent) => void) | null,
    postMessage: (msg: CapturedMessage): void => {
      captured.push(msg);
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const setup = new Function('self', WORKER_CODE);
  setup(mockSelf);

  if (!mockSelf.onmessage) {
    throw new Error('Worker did not wire self.onmessage');
  }

  const event = {
    data: {
      transpiledCode,
      evalId: 'test-eval-id',
      componentCatalog: [],
    },
  } as MessageEvent;
  mockSelf.onmessage(event);

  if (captured.length === 0) {
    throw new Error('Worker produced no postMessage');
  }
  return captured[0];
}

describe('circuit-dsl-worker — happy path', () => {
  it('evaluates a minimal circuit DSL and returns IR', () => {
    const result = runWorkerWithCode(`
      const c = circuit("Test");
      c.resistor({ value: "10k", refdes: "R1" });
      c.capacitor({ value: "100n", refdes: "C1" });
    `);
    expect(result.ok).toBe(true);
    expect(result.ir).toBeDefined();
  });

  it('auto-declares builder when shorthand form is used', () => {
    const result = runWorkerWithCode(`
      c.resistor({ value: "1k", refdes: "R1" });
    `);
    expect(result.ok).toBe(true);
  });
});

describe('circuit-dsl-worker — blocked globals', () => {
  it('fetch is undefined in the sandbox', () => {
    const result = runWorkerWithCode(`
      if (typeof fetch === 'undefined') {
        const c = circuit("ok");
      } else {
        throw new Error('LEAK: fetch is available');
      }
    `);
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('XMLHttpRequest is undefined', () => {
    const result = runWorkerWithCode(`
      if (typeof XMLHttpRequest === 'undefined') { circuit("ok"); }
      else throw new Error('LEAK: XMLHttpRequest available');
    `);
    expect(result.ok).toBe(true);
  });

  it('localStorage is undefined', () => {
    const result = runWorkerWithCode(`
      if (typeof localStorage === 'undefined') { circuit("ok"); }
      else throw new Error('LEAK: localStorage available');
    `);
    expect(result.ok).toBe(true);
  });

  it('indexedDB is undefined', () => {
    const result = runWorkerWithCode(`
      if (typeof indexedDB === 'undefined') { circuit("ok"); }
      else throw new Error('LEAK: indexedDB available');
    `);
    expect(result.ok).toBe(true);
  });

  it('importScripts is undefined', () => {
    const result = runWorkerWithCode(`
      if (typeof importScripts === 'undefined') { circuit("ok"); }
      else throw new Error('LEAK: importScripts available');
    `);
    expect(result.ok).toBe(true);
  });
});

describe('circuit-dsl-worker — prototype-chain escape blocked', () => {
  it('(function(){}).constructor does not expose real Function constructor', () => {
    // The patched worker freezes Function.prototype.constructor to undefined.
    // A user attempting to reach Function via a literal should get undefined
    // OR a throw — NEVER a working constructor.
    const result = runWorkerWithCode(`
      try {
        var F = (function(){}).constructor;
        if (typeof F === 'function') {
          // Not blocked
          var fn = F('return typeof self');
          if (fn && fn() === 'object') throw new Error('LEAK: Function escape succeeded');
        }
        circuit("ok");
      } catch (e) {
        if (e && e.message && e.message.indexOf('LEAK') === 0) throw e;
        // TypeError from undefined is expected
        circuit("ok");
      }
    `);
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('globalThis.constructor does not expose real Function constructor', () => {
    const result = runWorkerWithCode(`
      try {
        var G = (typeof globalThis !== 'undefined' ? globalThis.constructor : undefined);
        if (typeof G === 'function') {
          var fn = G('return typeof self');
          if (fn && fn() === 'object') throw new Error('LEAK: globalThis.constructor escape');
        }
        circuit("ok");
      } catch (e) {
        if (e && e.message && e.message.indexOf('LEAK') === 0) throw e;
        circuit("ok");
      }
    `);
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('self.constructor does not expose real Function constructor', () => {
    const result = runWorkerWithCode(`
      try {
        var S = (typeof self !== 'undefined' ? self.constructor : undefined);
        if (typeof S === 'function') {
          var fn = S('return 42');
          if (typeof fn === 'function' && fn() === 42) throw new Error('LEAK: self.constructor escape');
        }
        circuit("ok");
      } catch (e) {
        if (e && e.message && e.message.indexOf('LEAK') === 0) throw e;
        circuit("ok");
      }
    `);
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
  });
});

describe('circuit-dsl-worker — error paths', () => {
  it('syntax errors produce an error result with ok=false', () => {
    const result = runWorkerWithCode(`this is not valid js;`);
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('runtime throws produce an error result', () => {
    const result = runWorkerWithCode(`throw new Error('user error');`);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('user error');
  });
});
