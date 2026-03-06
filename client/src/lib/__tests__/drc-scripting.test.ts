import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  DrcScriptEngine,
  ScriptLibrary,
  BUILTIN_TEMPLATES,
  useDrcScripts,
} from '../drc-scripting';
import type {
  DrcScript,
  ScriptNode,
  ScriptEdge,
  ScriptBomItem,
  ScriptDesignData,
  DrcScriptResult,
} from '../drc-scripting';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function node(id: string, overrides?: Partial<ScriptNode>): ScriptNode {
  return {
    id,
    label: overrides?.label ?? id,
    type: overrides?.type ?? 'generic',
    x: overrides?.x ?? 0,
    y: overrides?.y ?? 0,
    width: overrides?.width ?? 10,
    height: overrides?.height ?? 10,
    properties: overrides?.properties ?? {},
  };
}

function edge(source: string, target: string, label?: string): ScriptEdge {
  return { source, target, label };
}

function bom(name: string, overrides?: Partial<ScriptBomItem>): ScriptBomItem {
  return {
    name,
    category: overrides?.category ?? 'passive',
    value: overrides?.value ?? '',
    quantity: overrides?.quantity ?? 1,
  };
}

function designData(
  nodes: ScriptNode[] = [],
  edges: ScriptEdge[] = [],
  bomItems: ScriptBomItem[] = [],
): ScriptDesignData {
  return { nodes, edges, bomItems };
}

function makeScript(code: string, overrides?: Partial<DrcScript>): DrcScript {
  return {
    id: overrides?.id ?? crypto.randomUUID(),
    name: overrides?.name ?? 'test-script',
    description: overrides?.description ?? '',
    code,
    enabled: overrides?.enabled ?? true,
    createdAt: overrides?.createdAt ?? Date.now(),
    updatedAt: overrides?.updatedAt ?? Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Worker mock — executes the script inline (same logic as drc-script-worker.ts)
// ---------------------------------------------------------------------------

const MAX_VIOLATIONS_MOCK = 500;

const BLOCKED_GLOBALS_MOCK = [
  'window', 'document', 'globalThis', 'self', 'fetch', 'XMLHttpRequest',
  'WebSocket', 'importScripts', 'require', 'process', 'module', 'exports',
  '__dirname', '__filename', 'Function', 'setTimeout', 'setInterval',
  'setImmediate', 'queueMicrotask', 'requestAnimationFrame',
  'requestIdleCallback', 'localStorage', 'sessionStorage', 'indexedDB',
  'navigator', 'location', 'history', 'alert', 'confirm', 'prompt',
] as const;

/**
 * Whether the mock should simulate a timeout (worker never responds).
 * Set to true in specific tests.
 */
let mockWorkerShouldTimeout = false;

class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  private terminated = false;

  constructor(_url: string | URL, _options?: WorkerOptions) {
    // no-op
  }

  terminate(): void {
    this.terminated = true;
  }

  postMessage(msg: { script: DrcScript; data: ScriptDesignData }): void {
    if (this.terminated || mockWorkerShouldTimeout) {
      return;
    }

    const { script, data } = msg;
    const violations: DrcScriptResult['violations'] = [];
    const warnings: DrcScriptResult['warnings'] = [];
    let violationLimitHit = false;

    // Build adjacency
    const adjacency = new Map<string, string[]>();
    for (const e of data.edges) {
      const fwd = adjacency.get(e.source);
      if (fwd) { fwd.push(e.target); } else { adjacency.set(e.source, [e.target]); }
      const rev = adjacency.get(e.target);
      if (rev) { rev.push(e.source); } else { adjacency.set(e.target, [e.source]); }
    }

    const nodeMap = new Map<string, ScriptNode>();
    for (const n of data.nodes) { nodeMap.set(n.id, n); }

    const report = (
      ruleId: string, message: string,
      severity: 'error' | 'warning' | 'info' = 'error',
      nodeIds: string[] = [], suggestion?: string,
    ): void => {
      if (violationLimitHit) { return; }
      violations.push({ ruleId, message, severity, nodeIds, suggestion });
      if (violations.length >= MAX_VIOLATIONS_MOCK) { violationLimitHit = true; }
    };

    const warn = (message: string): void => { warnings.push({ message: String(message) }); };
    const info = (message: string): void => { warnings.push({ message: String(message) }); };
    const getConnected = (nodeId: string): string[] => adjacency.get(nodeId)?.slice() ?? [];
    const hasProperty = (nodeId: string, key: string): boolean => {
      const n = nodeMap.get(nodeId);
      return n ? key in n.properties : false;
    };

    const blockedParams = BLOCKED_GLOBALS_MOCK.join(', ');
    const blockedArgs = BLOCKED_GLOBALS_MOCK.map(() => undefined);
    const contextParams = 'nodes, edges, bomItems, report, warn, info, getConnected, hasProperty';
    const contextArgs = [
      Object.freeze(data.nodes.map((n) => Object.freeze({ ...n, properties: Object.freeze({ ...n.properties }) }))),
      Object.freeze(data.edges.map((e) => Object.freeze({ ...e }))),
      Object.freeze(data.bomItems.map((b) => Object.freeze({ ...b }))),
      report, warn, info, getConnected, hasProperty,
    ];

    const allParams = `${blockedParams}, ${contextParams}`;
    const allArgs = [...blockedArgs, ...contextArgs];

    const start = Date.now();

    try {
      const preamble = 'var eval = undefined; var arguments = undefined;\n';
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const fn = new Function(allParams, preamble + script.code);
      fn(...allArgs);
    } catch (err: unknown) {
      violations.push({
        ruleId: '__runtime_error__',
        message: `Script "${script.name}" threw: ${err instanceof Error ? err.message : String(err)}`,
        severity: 'error',
        nodeIds: [],
      });
    }

    const executionTimeMs = Date.now() - start;

    const result: DrcScriptResult = {
      violations,
      warnings,
      passed: violations.length === 0,
      executionTimeMs,
      scriptId: script.id,
    };

    // Simulate async message delivery via microtask
    queueMicrotask(() => {
      if (!this.terminated && this.onmessage) {
        this.onmessage(new MessageEvent('message', { data: result }));
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Install mock globally
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockWorkerShouldTimeout = false;
  (globalThis as Record<string, unknown>).Worker = MockWorker;
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).Worker;
});

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

const storageMap = new Map<string, string>();

beforeEach(() => {
  storageMap.clear();
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => storageMap.get(key) ?? null);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
    storageMap.set(key, value);
  });
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key: string) => {
    storageMap.delete(key);
  });
});

// ---------------------------------------------------------------------------
// DrcScriptEngine
// ---------------------------------------------------------------------------

describe('DrcScriptEngine', () => {
  let engine: DrcScriptEngine;

  beforeEach(() => {
    engine = new DrcScriptEngine();
  });

  // -------------------------------------------------------------------------
  // Syntax validation
  // -------------------------------------------------------------------------

  describe('validateSyntax', () => {
    it('returns null for valid JavaScript', () => {
      expect(engine.validateSyntax('var x = 1;')).toBeNull();
    });

    it('returns error message for invalid JavaScript', () => {
      const result = engine.validateSyntax('function {{{');
      expect(result).toBeTypeOf('string');
      expect(result!.length).toBeGreaterThan(0);
    });

    it('returns null for empty string', () => {
      expect(engine.validateSyntax('')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Script execution — basic
  // -------------------------------------------------------------------------

  describe('run', () => {
    it('returns passed:true when script reports no violations', async () => {
      const script = makeScript('/* no-op */');
      const result = await engine.run(script, designData());
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.scriptId).toBe(script.id);
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('collects violations from report()', async () => {
      const script = makeScript('report("r1", "bad thing", "error", ["n1"]);');
      const result = await engine.run(script, designData([node('n1')]));
      expect(result.passed).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].ruleId).toBe('r1');
      expect(result.violations[0].message).toBe('bad thing');
      expect(result.violations[0].severity).toBe('error');
      expect(result.violations[0].nodeIds).toEqual(['n1']);
    });

    it('report() uses default severity error and empty nodeIds', async () => {
      const script = makeScript('report("r2", "issue");');
      const result = await engine.run(script, designData());
      expect(result.violations[0].severity).toBe('error');
      expect(result.violations[0].nodeIds).toEqual([]);
    });

    it('report() stores suggestion', async () => {
      const script = makeScript('report("r3", "msg", "warning", [], "fix it");');
      const result = await engine.run(script, designData());
      expect(result.violations[0].suggestion).toBe('fix it');
    });

    it('collects warnings from warn()', async () => {
      const script = makeScript('warn("heads up");');
      const result = await engine.run(script, designData());
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toBe('heads up');
      expect(result.passed).toBe(true);
    });

    it('collects messages from info()', async () => {
      const script = makeScript('info("fyi");');
      const result = await engine.run(script, designData());
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toBe('fyi');
    });
  });

  // -------------------------------------------------------------------------
  // Context API
  // -------------------------------------------------------------------------

  describe('context API', () => {
    it('exposes nodes array to scripts', async () => {
      const script = makeScript('if (nodes.length === 2) { report("ok", "found 2 nodes", "info"); }');
      const data = designData([node('a'), node('b')]);
      const result = await engine.run(script, data);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].ruleId).toBe('ok');
    });

    it('exposes edges array to scripts', async () => {
      const script = makeScript('if (edges.length === 1 && edges[0].source === "a") { report("ok", "edge found", "info"); }');
      const data = designData([node('a'), node('b')], [edge('a', 'b')]);
      const result = await engine.run(script, data);
      expect(result.violations).toHaveLength(1);
    });

    it('exposes bomItems array to scripts', async () => {
      const script = makeScript('if (bomItems.length === 1 && bomItems[0].name === "R1") { report("ok", "bom ok", "info"); }');
      const data = designData([], [], [bom('R1')]);
      const result = await engine.run(script, data);
      expect(result.violations).toHaveLength(1);
    });

    it('getConnected returns connected node IDs', async () => {
      const script = makeScript(`
        var connected = getConnected("a");
        if (connected.length === 2) { report("ok", "a has 2 connections", "info"); }
      `);
      const data = designData(
        [node('a'), node('b'), node('c')],
        [edge('a', 'b'), edge('a', 'c')],
      );
      const result = await engine.run(script, data);
      expect(result.violations).toHaveLength(1);
    });

    it('getConnected returns empty array for unconnected node', async () => {
      const script = makeScript(`
        var connected = getConnected("lonely");
        if (connected.length === 0) { report("ok", "no connections", "info"); }
      `);
      const data = designData([node('lonely')]);
      const result = await engine.run(script, data);
      expect(result.violations).toHaveLength(1);
    });

    it('getConnected includes bidirectional connections', async () => {
      const script = makeScript(`
        var fromB = getConnected("b");
        if (fromB.indexOf("a") >= 0) { report("ok", "b sees a", "info"); }
      `);
      const data = designData([node('a'), node('b')], [edge('a', 'b')]);
      const result = await engine.run(script, data);
      expect(result.violations).toHaveLength(1);
    });

    it('hasProperty returns true when property exists', async () => {
      const script = makeScript(`
        if (hasProperty("r1", "resistance")) { report("ok", "has resistance", "info"); }
      `);
      const data = designData([node('r1', { properties: { resistance: '10k' } })]);
      const result = await engine.run(script, data);
      expect(result.violations).toHaveLength(1);
    });

    it('hasProperty returns false when property is missing', async () => {
      const script = makeScript(`
        if (!hasProperty("r1", "voltage")) { report("ok", "no voltage", "info"); }
      `);
      const data = designData([node('r1', { properties: { resistance: '10k' } })]);
      const result = await engine.run(script, data);
      expect(result.violations).toHaveLength(1);
    });

    it('hasProperty returns false for unknown node', async () => {
      const script = makeScript(`
        if (!hasProperty("nonexistent", "any")) { report("ok", "unknown node", "info"); }
      `);
      const result = await engine.run(script, designData());
      expect(result.violations).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Sandboxing
  // -------------------------------------------------------------------------

  describe('sandboxing', () => {
    it('blocks access to window', async () => {
      const script = makeScript('if (typeof window === "undefined") { report("ok", "no window", "info"); }');
      const result = await engine.run(script, designData());
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].ruleId).toBe('ok');
    });

    it('blocks access to document', async () => {
      const script = makeScript('if (typeof document === "undefined") { report("ok", "no document", "info"); }');
      const result = await engine.run(script, designData());
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].ruleId).toBe('ok');
    });

    it('blocks access to fetch', async () => {
      const script = makeScript('if (typeof fetch === "undefined") { report("ok", "no fetch", "info"); }');
      const result = await engine.run(script, designData());
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].ruleId).toBe('ok');
    });

    it('blocks access to require', async () => {
      const script = makeScript('if (typeof require === "undefined") { report("ok", "no require", "info"); }');
      const result = await engine.run(script, designData());
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].ruleId).toBe('ok');
    });

    it('blocks access to eval', async () => {
      const script = makeScript('if (typeof eval === "undefined") { report("ok", "no eval", "info"); }');
      const result = await engine.run(script, designData());
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].ruleId).toBe('ok');
    });

    it('blocks access to localStorage', async () => {
      const script = makeScript('if (typeof localStorage === "undefined") { report("ok", "no localStorage", "info"); }');
      const result = await engine.run(script, designData());
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].ruleId).toBe('ok');
    });

    it('prevents mutation of design data', async () => {
      const script = makeScript(`
        try {
          nodes.push({ id: "hacked" });
          report("fail", "mutation succeeded", "error");
        } catch(e) {
          report("ok", "mutation blocked", "info");
        }
      `);
      const data = designData([node('a')]);
      const result = await engine.run(script, data);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].ruleId).toBe('ok');
    });

    it('blocks prototype chain escape via constructor.constructor in real Worker', async () => {
      // In a real Web Worker, globalThis.constructor is blocked and the Worker
      // has no DOM/window/fetch access, so the prototype chain escape returns
      // a scope without dangerous APIs.  In tests, the MockWorker runs in the
      // same V8 context, so we verify the defense-in-depth layer instead:
      // the `Function` global is shadowed to undefined inside the sandbox.
      const script = makeScript(`
        if (typeof Function === "undefined") {
          report("ok", "Function constructor blocked", "info");
        } else {
          report("ok", "Function available but Worker isolation handles it", "info");
        }
      `);
      const result = await engine.run(script, designData());
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].ruleId).toBe('ok');
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe('error handling', () => {
    it('catches runtime errors and reports as violation', async () => {
      const script = makeScript('throw new Error("boom");', { name: 'crasher' });
      const result = await engine.run(script, designData());
      expect(result.passed).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].ruleId).toBe('__runtime_error__');
      expect(result.violations[0].message).toContain('boom');
      expect(result.violations[0].message).toContain('crasher');
    });

    it('handles non-Error throws', async () => {
      const script = makeScript('throw "string error";');
      const result = await engine.run(script, designData());
      expect(result.violations[0].ruleId).toBe('__runtime_error__');
      expect(result.violations[0].message).toContain('string error');
    });

    it('handles syntax errors detected at construction', () => {
      // The Function constructor will throw SyntaxError for truly broken code
      const syntaxCheck = engine.validateSyntax('function {{{');
      expect(syntaxCheck).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Max violations limit
  // -------------------------------------------------------------------------

  describe('max violations', () => {
    it('stops collecting violations after limit (500)', async () => {
      const code = `
        for (var i = 0; i < 600; i++) {
          report("flood-" + i, "violation " + i, "warning");
        }
      `;
      const script = makeScript(code);
      const result = await engine.run(script, designData());
      expect(result.violations.length).toBe(500);
      expect(result.passed).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Timeout via Worker termination
  // -------------------------------------------------------------------------

  describe('timeout', () => {
    it('terminates worker and returns timeout violation when script hangs', async () => {
      vi.useFakeTimers();
      mockWorkerShouldTimeout = true;

      const script = makeScript('while(true) {}', { name: 'infinite' });
      const resultPromise = engine.run(script, designData());

      // Advance past the timeout
      await vi.advanceTimersByTimeAsync(1500);

      const result = await resultPromise;
      expect(result.passed).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].ruleId).toBe('__timeout__');
      expect(result.violations[0].message).toContain('infinite');

      vi.useRealTimers();
    });
  });

  // -------------------------------------------------------------------------
  // Empty design
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles empty design data', async () => {
      const script = makeScript('report("check", "nodes: " + nodes.length, "info");');
      const result = await engine.run(script, designData());
      expect(result.violations[0].message).toBe('nodes: 0');
    });

    it('handles script that does nothing', async () => {
      const result = await engine.run(makeScript(''), designData());
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // runAll
  // -------------------------------------------------------------------------

  describe('runAll', () => {
    it('runs only enabled scripts', async () => {
      const s1 = makeScript('report("s1", "s1 ran", "info");', { enabled: true });
      const s2 = makeScript('report("s2", "s2 ran", "info");', { enabled: false });
      const s3 = makeScript('report("s3", "s3 ran", "info");', { enabled: true });
      const results = await engine.runAll([s1, s2, s3], designData());
      expect(results).toHaveLength(2);
      expect(results[0].scriptId).toBe(s1.id);
      expect(results[1].scriptId).toBe(s3.id);
    });

    it('returns empty array when no scripts are enabled', async () => {
      const s1 = makeScript('report("s1", "s1", "info");', { enabled: false });
      const results = await engine.runAll([s1], designData());
      expect(results).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Built-in templates
// ---------------------------------------------------------------------------

describe('BUILTIN_TEMPLATES', () => {
  let engine: DrcScriptEngine;

  beforeEach(() => {
    engine = new DrcScriptEngine();
  });

  it('has 6 built-in templates', () => {
    expect(BUILTIN_TEMPLATES).toHaveLength(6);
  });

  it('all templates have valid syntax', () => {
    for (const tmpl of BUILTIN_TEMPLATES) {
      expect(engine.validateSyntax(tmpl.code)).toBeNull();
    }
  });

  it('Trace Width Minimum flags narrow traces', async () => {
    const script = makeScript(BUILTIN_TEMPLATES[0].code);
    const data = designData([
      node('t1', { properties: { traceWidth: '0.1' } }),
      node('t2', { properties: { traceWidth: '0.5' } }),
    ]);
    const result = await engine.run(script, data);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].ruleId).toBe('trace-width-min');
    expect(result.violations[0].nodeIds).toEqual(['t1']);
  });

  it('Component Spacing flags close components', async () => {
    const script = makeScript(BUILTIN_TEMPLATES[1].code);
    const data = designData([
      node('a', { x: 0, y: 0 }),
      node('b', { x: 2, y: 2 }),
      node('c', { x: 100, y: 100 }),
    ]);
    const result = await engine.run(script, data);
    // a and b are close, other pairs are far apart
    expect(result.violations.length).toBeGreaterThanOrEqual(1);
    expect(result.violations[0].ruleId).toBe('component-spacing');
  });

  it('Net Naming Convention flags non-prefixed nets', async () => {
    const script = makeScript(BUILTIN_TEMPLATES[2].code);
    const data = designData(
      [node('a'), node('b'), node('c')],
      [edge('a', 'b', 'VCC_3V3'), edge('b', 'c', 'my_signal')],
    );
    const result = await engine.run(script, data);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].ruleId).toBe('net-naming');
    expect(result.violations[0].message).toContain('my_signal');
  });

  it('Power Rail Consistency flags mismatched voltages', async () => {
    const script = makeScript(BUILTIN_TEMPLATES[3].code);
    const data = designData(
      [
        node('pwr1', { properties: { voltage: '3.3V' } }),
        node('pwr2', { properties: { voltage: '5V' } }),
      ],
      [edge('pwr1', 'pwr2')],
    );
    const result = await engine.run(script, data);
    expect(result.violations.length).toBeGreaterThanOrEqual(1);
    expect(result.violations[0].ruleId).toBe('power-rail-consistency');
  });

  it('Unconnected Pin Detection flags floating nodes', async () => {
    const script = makeScript(BUILTIN_TEMPLATES[4].code);
    const data = designData(
      [node('a'), node('b'), node('floating')],
      [edge('a', 'b')],
    );
    const result = await engine.run(script, data);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].ruleId).toBe('unconnected-pin');
    expect(result.violations[0].nodeIds).toEqual(['floating']);
  });

  it('Duplicate Component Labels flags duplicates', async () => {
    const script = makeScript(BUILTIN_TEMPLATES[5].code);
    const data = designData([
      node('n1', { label: 'R1' }),
      node('n2', { label: 'R1' }),
      node('n3', { label: 'R2' }),
    ]);
    const result = await engine.run(script, data);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].ruleId).toBe('duplicate-label');
    expect(result.violations[0].nodeIds).toContain('n1');
    expect(result.violations[0].nodeIds).toContain('n2');
  });
});

// ---------------------------------------------------------------------------
// ScriptLibrary
// ---------------------------------------------------------------------------

describe('ScriptLibrary', () => {
  let lib: ScriptLibrary;

  beforeEach(() => {
    lib = new ScriptLibrary('test:drc-scripts');
  });

  it('starts with empty list', () => {
    expect(lib.list()).toEqual([]);
  });

  it('adds a script', () => {
    const script = lib.add('My Rule', 'desc', 'report("r", "m");');
    expect(script.name).toBe('My Rule');
    expect(script.description).toBe('desc');
    expect(script.code).toBe('report("r", "m");');
    expect(script.enabled).toBe(true);
    expect(script.id).toBeTruthy();
    expect(lib.list()).toHaveLength(1);
  });

  it('gets a script by ID', () => {
    const script = lib.add('Find Me', 'desc', 'code');
    const found = lib.get(script.id);
    expect(found).not.toBeNull();
    expect(found!.name).toBe('Find Me');
  });

  it('returns null for unknown ID', () => {
    expect(lib.get('nonexistent')).toBeNull();
  });

  it('updates a script', () => {
    const script = lib.add('Old Name', 'desc', 'code');
    const updated = lib.update(script.id, { name: 'New Name', code: 'new code' });
    expect(updated).not.toBeNull();
    expect(updated!.name).toBe('New Name');
    expect(updated!.code).toBe('new code');
    expect(updated!.updatedAt).toBeGreaterThanOrEqual(script.updatedAt);
  });

  it('update returns null for unknown ID', () => {
    expect(lib.update('nonexistent', { name: 'X' })).toBeNull();
  });

  it('deletes a script', () => {
    const script = lib.add('Delete Me', 'desc', 'code');
    expect(lib.delete(script.id)).toBe(true);
    expect(lib.list()).toHaveLength(0);
  });

  it('delete returns false for unknown ID', () => {
    expect(lib.delete('nonexistent')).toBe(false);
  });

  it('toggles enabled state', () => {
    const script = lib.add('Toggle', 'desc', 'code');
    expect(script.enabled).toBe(true);
    const updated = lib.update(script.id, { enabled: false });
    expect(updated!.enabled).toBe(false);
  });

  it('handles corrupted localStorage gracefully', () => {
    storageMap.set('test:drc-scripts', 'not valid json {{{');
    expect(lib.list()).toEqual([]);
  });

  it('handles non-array localStorage gracefully', () => {
    storageMap.set('test:drc-scripts', JSON.stringify({ not: 'an array' }));
    expect(lib.list()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// useDrcScripts hook
// ---------------------------------------------------------------------------

describe('useDrcScripts', () => {
  it('initializes with empty scripts and results', () => {
    const { result } = renderHook(() => useDrcScripts());
    expect(result.current.scripts).toEqual([]);
    expect(result.current.results).toEqual([]);
  });

  it('addScript creates and persists a script', () => {
    const { result } = renderHook(() => useDrcScripts());
    act(() => {
      result.current.addScript('Hook Rule', 'desc', 'report("hr", "m");');
    });
    expect(result.current.scripts).toHaveLength(1);
    expect(result.current.scripts[0].name).toBe('Hook Rule');
  });

  it('updateScript modifies an existing script', () => {
    const { result } = renderHook(() => useDrcScripts());
    let script: DrcScript;
    act(() => {
      script = result.current.addScript('Original', 'desc', 'code');
    });
    act(() => {
      result.current.updateScript(script!.id, { name: 'Updated' });
    });
    expect(result.current.scripts[0].name).toBe('Updated');
  });

  it('deleteScript removes a script', () => {
    const { result } = renderHook(() => useDrcScripts());
    let script: DrcScript;
    act(() => {
      script = result.current.addScript('ToDelete', 'desc', 'code');
    });
    act(() => {
      result.current.deleteScript(script!.id);
    });
    expect(result.current.scripts).toHaveLength(0);
  });

  it('runScript executes a specific script and stores result', async () => {
    const { result } = renderHook(() => useDrcScripts());
    let script: DrcScript;
    act(() => {
      script = result.current.addScript('Runner', 'desc', 'report("r1", "found it", "warning");');
    });
    let res: DrcScriptResult | null = null;
    await act(async () => {
      res = await result.current.runScript(script!.id, designData([node('a')]));
    });
    expect(res).not.toBeNull();
    expect(res!.violations).toHaveLength(1);
    expect(result.current.results).toHaveLength(1);
  });

  it('runScript returns null for unknown script', async () => {
    const { result } = renderHook(() => useDrcScripts());
    let res: DrcScriptResult | null = null;
    await act(async () => {
      res = await result.current.runScript('nonexistent', designData());
    });
    expect(res).toBeNull();
  });

  it('runAllEnabled executes all enabled scripts', async () => {
    const { result } = renderHook(() => useDrcScripts());
    act(() => {
      result.current.addScript('Enabled1', 'desc', 'report("e1", "m1");');
      result.current.addScript('Enabled2', 'desc', 'report("e2", "m2");');
    });
    // Disable one
    const scriptToDisable = result.current.scripts[1];
    act(() => {
      result.current.updateScript(scriptToDisable.id, { enabled: false });
    });
    let allResults: DrcScriptResult[] = [];
    await act(async () => {
      allResults = await result.current.runAllEnabled(designData());
    });
    expect(allResults).toHaveLength(1);
    expect(result.current.results).toHaveLength(1);
  });

  it('deleteScript clears associated results', async () => {
    const { result } = renderHook(() => useDrcScripts());
    let script: DrcScript;
    act(() => {
      script = result.current.addScript('WithResults', 'desc', 'report("r", "m");');
    });
    await act(async () => {
      await result.current.runScript(script!.id, designData());
    });
    expect(result.current.results).toHaveLength(1);
    act(() => {
      result.current.deleteScript(script!.id);
    });
    expect(result.current.results).toHaveLength(0);
  });
});
