/**
 * Tests for client/src/lib/drc-script-worker.ts sandbox.
 *
 * Addresses audit finding #30 (P0): user DRC scripts execute in a Worker via
 * `new Function()`. The worker hardens this with:
 * - Block-list of dangerous globals passed as shadowed params (window,
 *   document, fetch, Function, setTimeout, importScripts, localStorage, etc.)
 * - `eval` and `arguments` shadowed by local preamble
 * - `globalThis.constructor` frozen to undefined (block prototype-chain escape)
 *
 * These tests execute scripts through the worker's `executeScript` entry
 * point and assert that known escape payloads produce either a runtime error
 * (caught into violations as `__runtime_error__`) or a no-op with empty
 * violations — but NEVER successful access to restricted capabilities.
 *
 * NOTE: the worker file has module-side-effects (the
 * `Object.defineProperty(globalThis, 'constructor', ...)` call) which executes
 * on first import. That side effect mutates the test global as well — which
 * is fine here since tests are isolated per-suite via vitest's worker fork,
 * and the freeze is the exact behavior production code relies on.
 */
import { describe, it, expect } from 'vitest';

// Import the worker file's internal state to test `executeScript` directly.
// The file uses `self.onmessage` as entry point for real Worker use, but we
// can exercise `executeScript` by mocking a MessageEvent and posting through
// `self.onmessage` OR by re-importing for direct access.
//
// Since `executeScript` is not exported, we trigger it via the message
// handler. This file sets `self.onmessage` at module top-level.

// Configure happy-dom or jsdom for Worker-like `self` access
// @vitest-environment happy-dom

// Build a stub that drives the worker's onmessage and captures postMessage.
interface WorkerResponse {
  violations: Array<{ ruleId: string; message: string; severity: string }>;
  warnings: Array<{ message: string }>;
  passed: boolean;
  executionTimeMs: number;
  scriptId: string;
}

async function runScript(code: string): Promise<WorkerResponse> {
  // Reset the stub state
  const captured: WorkerResponse[] = [];
  const originalPostMessage = (self as unknown as { postMessage: (m: WorkerResponse) => void }).postMessage;
  (self as unknown as { postMessage: (m: WorkerResponse) => void }).postMessage = (msg: WorkerResponse): void => {
    captured.push(msg);
  };

  // Clean module cache for deterministic reload of the worker module
  // The worker uses self.onmessage = ... on import
  try {
    // Dynamic import ensures the module runs self.onmessage assignment
    // Use a cache-buster query param to force re-execution each run
    await import(/* @vite-ignore */ `../drc-script-worker?t=${Date.now()}`);
  } catch {
    // Module may already be loaded; self.onmessage should still be wired
  }

  // Fire a synthetic message
  const handler = (self as unknown as { onmessage?: (e: MessageEvent) => void }).onmessage;
  if (!handler) throw new Error('drc-script-worker onmessage not wired');

  const event = {
    data: {
      script: {
        id: 'test-1',
        name: 'test',
        description: '',
        code,
        enabled: true,
        createdAt: 0,
        updatedAt: 0,
      },
      data: {
        nodes: [{ id: 'n1', label: 'N1', type: 'resistor', x: 0, y: 0, width: 10, height: 10, properties: { value: '10k' } }],
        edges: [],
        bomItems: [],
      },
    },
  } as MessageEvent;

  handler(event);

  // Restore postMessage
  (self as unknown as { postMessage: (m: WorkerResponse) => void }).postMessage = originalPostMessage;

  if (captured.length === 0) {
    throw new Error('Worker did not postMessage — onmessage may not have completed synchronously');
  }
  return captured[0];
}

describe('drc-script-worker sandbox — happy path', () => {
  it('runs a trivial script that reports one violation', async () => {
    const result = await runScript(`report('R-TEST', 'hello', 'warning', [], 'fix it');`);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].message).toBe('hello');
    expect(result.violations[0].severity).toBe('warning');
  });

  it('exposes nodes array to the script', async () => {
    const result = await runScript(`
      if (nodes.length === 1 && nodes[0].id === 'n1') {
        report('R-OK', 'nodes accessible', 'info', []);
      }
    `);
    expect(result.violations.some(v => v.ruleId === 'R-OK')).toBe(true);
  });

  it('report() beyond MAX_VIOLATIONS is silently dropped', async () => {
    const result = await runScript(`
      for (var i = 0; i < 600; i++) {
        report('R' + i, 'msg' + i, 'info', []);
      }
    `);
    expect(result.violations.length).toBeLessThanOrEqual(500);
  });
});

describe('drc-script-worker sandbox — blocked globals', () => {
  it('window is undefined inside the sandbox', async () => {
    const result = await runScript(`
      if (typeof window === 'undefined') report('R', 'blocked', 'info', []);
    `);
    expect(result.violations[0]?.ruleId).toBe('R');
  });

  it('document is undefined inside the sandbox', async () => {
    const result = await runScript(`
      if (typeof document === 'undefined') report('R', 'blocked', 'info', []);
    `);
    expect(result.violations[0]?.ruleId).toBe('R');
  });

  it('fetch is undefined inside the sandbox', async () => {
    const result = await runScript(`
      if (typeof fetch === 'undefined') report('R', 'blocked', 'info', []);
    `);
    expect(result.violations[0]?.ruleId).toBe('R');
  });

  it('XMLHttpRequest is undefined inside the sandbox', async () => {
    const result = await runScript(`
      if (typeof XMLHttpRequest === 'undefined') report('R', 'blocked', 'info', []);
    `);
    expect(result.violations[0]?.ruleId).toBe('R');
  });

  it('WebSocket is undefined inside the sandbox', async () => {
    const result = await runScript(`
      if (typeof WebSocket === 'undefined') report('R', 'blocked', 'info', []);
    `);
    expect(result.violations[0]?.ruleId).toBe('R');
  });

  it('importScripts is undefined inside the sandbox', async () => {
    const result = await runScript(`
      if (typeof importScripts === 'undefined') report('R', 'blocked', 'info', []);
    `);
    expect(result.violations[0]?.ruleId).toBe('R');
  });

  it('localStorage is undefined inside the sandbox', async () => {
    const result = await runScript(`
      if (typeof localStorage === 'undefined') report('R', 'blocked', 'info', []);
    `);
    expect(result.violations[0]?.ruleId).toBe('R');
  });

  it('indexedDB is undefined inside the sandbox', async () => {
    const result = await runScript(`
      if (typeof indexedDB === 'undefined') report('R', 'blocked', 'info', []);
    `);
    expect(result.violations[0]?.ruleId).toBe('R');
  });

  it('setTimeout is undefined inside the sandbox', async () => {
    const result = await runScript(`
      if (typeof setTimeout === 'undefined') report('R', 'blocked', 'info', []);
    `);
    expect(result.violations[0]?.ruleId).toBe('R');
  });

  it('setInterval is undefined inside the sandbox', async () => {
    const result = await runScript(`
      if (typeof setInterval === 'undefined') report('R', 'blocked', 'info', []);
    `);
    expect(result.violations[0]?.ruleId).toBe('R');
  });

  it('Function constructor is undefined inside the sandbox', async () => {
    const result = await runScript(`
      if (typeof Function === 'undefined') report('R', 'blocked', 'info', []);
    `);
    expect(result.violations[0]?.ruleId).toBe('R');
  });

  it('eval is undefined inside the sandbox', async () => {
    const result = await runScript(`
      if (typeof eval === 'undefined') report('R', 'blocked', 'info', []);
    `);
    expect(result.violations[0]?.ruleId).toBe('R');
  });

  it('navigator is undefined inside the sandbox', async () => {
    const result = await runScript(`
      if (typeof navigator === 'undefined') report('R', 'blocked', 'info', []);
    `);
    expect(result.violations[0]?.ruleId).toBe('R');
  });

  it('location is undefined inside the sandbox', async () => {
    const result = await runScript(`
      if (typeof location === 'undefined') report('R', 'blocked', 'info', []);
    `);
    expect(result.violations[0]?.ruleId).toBe('R');
  });
});

describe('drc-script-worker sandbox — escape attempts', () => {
  it('Function.constructor escape produces no successful global access', async () => {
    // Attempt: (function(){}).constructor('return window')()
    const result = await runScript(`
      try {
        var fn = (function(){}).constructor('return window');
        var w = fn();
        if (w) report('LEAK', 'escape succeeded: ' + typeof w, 'error', []);
        else report('OK', 'blocked', 'info', []);
      } catch (e) {
        report('OK', 'threw: ' + e.message, 'info', []);
      }
    `);
    // Either the attempt threw, or it returned undefined — NEVER a leak
    expect(result.violations.some(v => v.ruleId === 'LEAK')).toBe(false);
  });

  it('arguments.callee.caller escape is blocked', async () => {
    const result = await runScript(`
      try {
        var c = arguments && arguments.callee && arguments.callee.caller;
        if (c) report('LEAK', 'caller chain accessible', 'error', []);
        else report('OK', 'blocked', 'info', []);
      } catch (e) {
        report('OK', 'threw: ' + e.message, 'info', []);
      }
    `);
    expect(result.violations.some(v => v.ruleId === 'LEAK')).toBe(false);
  });

  it('Proxy-trap escape cannot obtain forbidden globals', async () => {
    const result = await runScript(`
      try {
        var p = new Proxy({}, { get: function() { return fetch; } });
        // Access the trap, see if we get a real fetch
        var f = p.anyKey;
        if (typeof f === 'function') report('LEAK', 'proxy returned fetch', 'error', []);
        else report('OK', 'trap returned non-function', 'info', []);
      } catch (e) {
        report('OK', 'threw: ' + e.message, 'info', []);
      }
    `);
    expect(result.violations.some(v => v.ruleId === 'LEAK')).toBe(false);
  });

  it('globalThis.constructor escape is blocked (worker freezes it to undefined)', async () => {
    const result = await runScript(`
      try {
        var c = globalThis && globalThis.constructor;
        if (c) report('LEAK', 'globalThis.constructor accessible', 'error', []);
        else report('OK', 'blocked', 'info', []);
      } catch (e) {
        report('OK', 'threw: ' + e.message, 'info', []);
      }
    `);
    expect(result.violations.some(v => v.ruleId === 'LEAK')).toBe(false);
  });

  it('setTimeout-queue escape is blocked (setTimeout shadowed)', async () => {
    const result = await runScript(`
      try {
        setTimeout(function() { report('LEAK', 'timeout ran', 'error', []); }, 0);
        report('OK', 'no throw — but timeout should never fire since setTimeout is undefined', 'info', []);
      } catch (e) {
        report('OK', 'setTimeout call threw: ' + e.message, 'info', []);
      }
    `);
    expect(result.violations.some(v => v.ruleId === 'LEAK')).toBe(false);
  });

  it('eval() call cannot execute arbitrary code (eval is undefined)', async () => {
    const result = await runScript(`
      try {
        eval('report("LEAK","eval ran","error",[])');
        report('OK', 'no throw — but eval should be undefined', 'info', []);
      } catch (e) {
        report('OK', 'eval threw: ' + e.message, 'info', []);
      }
    `);
    expect(result.violations.some(v => v.ruleId === 'LEAK')).toBe(false);
  });

  it('import() dynamic import is blocked (not bound in sandbox scope)', async () => {
    // The preamble doesn't shadow `import`, but the module doesn't import it
    // either — it should be undefined at the sandbox level. If the JS engine
    // exposes import() at function scope, it would be observable here.
    const result = await runScript(`
      try {
        var r = typeof import === 'undefined' ? 'undef' : 'available';
        report('R', r, 'info', []);
      } catch (e) {
        report('R', 'threw: ' + e.message, 'info', []);
      }
    `);
    // Either undef or a throw is fine; "available" would be a leak.
    const violation = result.violations[0];
    expect(violation).toBeDefined();
    expect(violation.message).not.toBe('available');
  });

  it('prototype pollution via Object.prototype does not leak to report()', async () => {
    // Setting a property on Object.prototype could affect how `report` works
    // if it relied on prototype lookups — verify the sandbox's report still
    // functions correctly.
    const result = await runScript(`
      try {
        Object.prototype.polluted = 'yes';
        report('OK', 'polluted attempt made, report still works', 'info', []);
      } catch (e) {
        report('OK', 'threw: ' + e.message, 'info', []);
      }
    `);
    expect(result.violations[0]?.ruleId).toBe('OK');
  });
});

describe('drc-script-worker sandbox — error handling', () => {
  it('syntax error in user script produces a runtime_error violation', async () => {
    const result = await runScript(`this is not valid js;`);
    expect(result.violations.some(v => v.ruleId === '__runtime_error__')).toBe(true);
  });

  it('throw inside user script is caught as runtime_error', async () => {
    const result = await runScript(`throw new Error('boom');`);
    expect(result.violations.some(v => v.ruleId === '__runtime_error__')).toBe(true);
    expect(result.violations[0]?.message).toContain('boom');
  });

  it('infinite loop would hang but the outer watchdog is the caller responsibility', async () => {
    // We do NOT test an actual infinite loop here — it would hang the test
    // runner. This test documents that the worker does not enforce a CPU
    // timeout internally. The caller (main thread) must terminate the worker
    // if it runs too long. See #P0-30 (audit finding): `drc-scripting`
    // timeout is not enforceable against non-throwing infinite loops.
    //
    // Instead, verify the worker responds to a short-lived counting loop:
    const result = await runScript(`
      var count = 0;
      for (var i = 0; i < 1000; i++) count++;
      report('OK', String(count), 'info', []);
    `);
    expect(result.violations[0]?.message).toBe('1000');
  });
});

describe('drc-script-worker sandbox — no DOM mutation', () => {
  it('cannot create DOM elements (document is undefined)', async () => {
    const result = await runScript(`
      try {
        var el = document.createElement('script');
        report('LEAK', 'DOM element created', 'error', []);
      } catch (e) {
        report('OK', 'blocked: ' + e.message, 'info', []);
      }
    `);
    expect(result.violations.some(v => v.ruleId === 'LEAK')).toBe(false);
  });

  it('cannot mutate location (location is undefined)', async () => {
    const result = await runScript(`
      try {
        location.href = 'https://evil.example';
        report('LEAK', 'navigation attempted', 'error', []);
      } catch (e) {
        report('OK', 'blocked: ' + e.message, 'info', []);
      }
    `);
    expect(result.violations.some(v => v.ruleId === 'LEAK')).toBe(false);
  });
});
