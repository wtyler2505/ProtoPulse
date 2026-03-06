/**
 * DRC Scripting Engine — sandboxed JavaScript scripting for custom DRC rules.
 *
 * Users write small JS scripts that run against design data (nodes, edges, BOM)
 * and produce violation reports.  Scripts execute inside a Function constructor
 * sandbox with a limited API — no access to DOM, network, or Node globals.
 */

import { useCallback, useMemo, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Node representation exposed to user scripts. */
export interface ScriptNode {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties: Record<string, string>;
}

/** Edge representation exposed to user scripts. */
export interface ScriptEdge {
  source: string;
  target: string;
  label?: string;
}

/** BOM item representation exposed to user scripts. */
export interface ScriptBomItem {
  name: string;
  category: string;
  value: string;
  quantity: number;
}

/** A violation reported by a user script. */
export interface DrcViolation {
  ruleId: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  nodeIds: string[];
  suggestion?: string;
}

/** A warning emitted by a user script (not a rule violation). */
export interface DrcWarning {
  message: string;
}

/** Result of running a single DRC script. */
export interface DrcScriptResult {
  violations: DrcViolation[];
  warnings: DrcWarning[];
  passed: boolean;
  executionTimeMs: number;
  scriptId: string;
}

/** Persisted script definition. */
export interface DrcScript {
  id: string;
  name: string;
  description: string;
  code: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

/** Design snapshot that scripts evaluate against. */
export interface ScriptDesignData {
  nodes: ScriptNode[];
  edges: ScriptEdge[];
  bomItems: ScriptBomItem[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_VIOLATIONS = 500;
const MAX_EXECUTION_MS = 1000;
const STORAGE_KEY = 'protopulse:drc-scripts';

/**
 * Globals that must be blocked inside the sandbox.  The Function constructor
 * body runs in sloppy mode with access to the global scope, so we shadow
 * every dangerous global with `undefined`.
 */
/**
 * Note: `eval` and `arguments` are excluded because they are reserved
 * identifiers that cannot be used as parameter names — even in sloppy mode
 * some engines reject them.  We block `eval` by redefining it as a local
 * variable inside the function body instead.
 */
const BLOCKED_GLOBALS = [
  'window',
  'document',
  'globalThis',
  'self',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'importScripts',
  'require',
  'process',
  'module',
  'exports',
  '__dirname',
  '__filename',
  'Function',
  'setTimeout',
  'setInterval',
  'setImmediate',
  'queueMicrotask',
  'requestAnimationFrame',
  'requestIdleCallback',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'navigator',
  'location',
  'history',
  'alert',
  'confirm',
  'prompt',
] as const;

// ---------------------------------------------------------------------------
// DrcScriptEngine
// ---------------------------------------------------------------------------

export class DrcScriptEngine {
  /**
   * Validate script syntax without executing it.
   * Returns `null` when valid, or an error message string.
   */
  validateSyntax(code: string): string | null {
    try {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      new Function(code);
      return null;
    } catch (err: unknown) {
      if (err instanceof SyntaxError) {
        return err.message;
      }
      return String(err);
    }
  }

  /**
   * Execute a DRC script inside an isolated Web Worker with a hard timeout.
   *
   * The Worker has no DOM/window access and the prototype chain is blocked.
   * If the script exceeds MAX_EXECUTION_MS the worker is terminated.
   */
  async run(script: DrcScript, data: ScriptDesignData): Promise<DrcScriptResult> {
    return new Promise<DrcScriptResult>((resolve) => {
      const worker = new Worker(new URL('./drc-script-worker.ts', import.meta.url), { type: 'module' });

      const timeout = setTimeout(() => {
        worker.terminate();
        resolve({
          violations: [
            {
              ruleId: '__timeout__',
              message: `Script "${script.name}" exceeded the ${MAX_EXECUTION_MS}ms execution limit`,
              severity: 'error',
              nodeIds: [],
            },
          ],
          warnings: [],
          passed: false,
          executionTimeMs: MAX_EXECUTION_MS,
          scriptId: script.id,
        });
      }, MAX_EXECUTION_MS);

      worker.onmessage = (event: MessageEvent<DrcScriptResult>) => {
        clearTimeout(timeout);
        worker.terminate();
        resolve(event.data);
      };

      worker.onerror = (event) => {
        clearTimeout(timeout);
        worker.terminate();
        resolve({
          violations: [
            {
              ruleId: '__runtime_error__',
              message: `Script "${script.name}" threw: ${event.message ?? 'Unknown worker error'}`,
              severity: 'error',
              nodeIds: [],
            },
          ],
          warnings: [],
          passed: false,
          executionTimeMs: 0,
          scriptId: script.id,
        });
      };

      worker.postMessage({ script, data });
    });
  }

  /** Run all enabled scripts and aggregate results. */
  async runAll(scripts: DrcScript[], data: ScriptDesignData): Promise<DrcScriptResult[]> {
    const enabled = scripts.filter((s) => s.enabled);
    return Promise.all(enabled.map((s) => this.run(s, data)));
  }
}

// ---------------------------------------------------------------------------
// ScriptLibrary — localStorage persistence
// ---------------------------------------------------------------------------

export class ScriptLibrary {
  private storageKey: string;

  constructor(storageKey: string = STORAGE_KEY) {
    this.storageKey = storageKey;
  }

  /** List all saved scripts. */
  list(): DrcScript[] {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) {
        return [];
      }
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed as DrcScript[];
    } catch {
      return [];
    }
  }

  /** Persist the full script list. */
  private save(scripts: DrcScript[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(scripts));
  }

  /** Add a new script. Returns the created script. */
  add(name: string, description: string, code: string): DrcScript {
    const scripts = this.list();
    const now = Date.now();
    const script: DrcScript = {
      id: crypto.randomUUID(),
      name,
      description,
      code,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };
    scripts.push(script);
    this.save(scripts);
    return script;
  }

  /** Update an existing script. Returns the updated script or null. */
  update(id: string, patch: Partial<Pick<DrcScript, 'name' | 'description' | 'code' | 'enabled'>>): DrcScript | null {
    const scripts = this.list();
    const idx = scripts.findIndex((s) => s.id === id);
    if (idx === -1) {
      return null;
    }
    const updated: DrcScript = {
      ...scripts[idx],
      ...patch,
      updatedAt: Date.now(),
    };
    scripts[idx] = updated;
    this.save(scripts);
    return updated;
  }

  /** Delete a script by ID. Returns true if found and deleted. */
  delete(id: string): boolean {
    const scripts = this.list();
    const idx = scripts.findIndex((s) => s.id === id);
    if (idx === -1) {
      return false;
    }
    scripts.splice(idx, 1);
    this.save(scripts);
    return true;
  }

  /** Get a single script by ID. */
  get(id: string): DrcScript | null {
    return this.list().find((s) => s.id === id) ?? null;
  }
}

// ---------------------------------------------------------------------------
// Built-in rule templates
// ---------------------------------------------------------------------------

export const BUILTIN_TEMPLATES: ReadonlyArray<{ name: string; description: string; code: string }> = Object.freeze([
  {
    name: 'Trace Width Minimum',
    description: 'Checks that all nodes with a traceWidth property meet a minimum width.',
    code: `
var MIN_TRACE_WIDTH = 0.2;
for (var i = 0; i < nodes.length; i++) {
  var n = nodes[i];
  if (hasProperty(n.id, 'traceWidth')) {
    var tw = parseFloat(n.properties.traceWidth);
    if (!isNaN(tw) && tw < MIN_TRACE_WIDTH) {
      report('trace-width-min', 'Trace width ' + tw + 'mm on "' + n.label + '" is below minimum ' + MIN_TRACE_WIDTH + 'mm', 'error', [n.id], 'Increase trace width to at least ' + MIN_TRACE_WIDTH + 'mm');
    }
  }
}
`.trim(),
  },
  {
    name: 'Component Spacing',
    description: 'Ensures components are not placed too close together.',
    code: `
var MIN_SPACING = 5;
for (var i = 0; i < nodes.length; i++) {
  for (var j = i + 1; j < nodes.length; j++) {
    var a = nodes[i];
    var b = nodes[j];
    var dx = (a.x + a.width / 2) - (b.x + b.width / 2);
    var dy = (a.y + a.height / 2) - (b.y + b.height / 2);
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < MIN_SPACING) {
      report('component-spacing', '"' + a.label + '" and "' + b.label + '" are only ' + dist.toFixed(1) + ' apart (min ' + MIN_SPACING + ')', 'warning', [a.id, b.id], 'Move components further apart');
    }
  }
}
`.trim(),
  },
  {
    name: 'Net Naming Convention',
    description: 'Enforces standard prefixes for net names (VCC_, GND_, SIG_).',
    code: `
var VALID_PREFIXES = ['VCC_', 'GND_', 'SIG_', 'CLK_', 'RST_', 'PWR_'];
for (var i = 0; i < edges.length; i++) {
  var e = edges[i];
  if (e.label && e.label.length > 0) {
    var hasPrefix = false;
    for (var p = 0; p < VALID_PREFIXES.length; p++) {
      if (e.label.indexOf(VALID_PREFIXES[p]) === 0) {
        hasPrefix = true;
        break;
      }
    }
    if (!hasPrefix) {
      report('net-naming', 'Net "' + e.label + '" does not use a standard prefix', 'warning', [], 'Use one of: ' + VALID_PREFIXES.join(', '));
    }
  }
}
`.trim(),
  },
  {
    name: 'Power Rail Consistency',
    description: 'Checks that all nodes connected to a power rail share the same voltage value.',
    code: `
var railVoltages = {};
for (var i = 0; i < nodes.length; i++) {
  var n = nodes[i];
  if (hasProperty(n.id, 'voltage')) {
    var connected = getConnected(n.id);
    for (var c = 0; c < connected.length; c++) {
      var cid = connected[c];
      for (var j = 0; j < nodes.length; j++) {
        if (nodes[j].id === cid && hasProperty(cid, 'voltage')) {
          if (n.properties.voltage !== nodes[j].properties.voltage) {
            report('power-rail-consistency', '"' + n.label + '" (' + n.properties.voltage + ') connected to "' + nodes[j].label + '" (' + nodes[j].properties.voltage + ') — voltage mismatch', 'error', [n.id, cid], 'Ensure connected power nodes share the same voltage');
          }
        }
      }
    }
  }
}
`.trim(),
  },
  {
    name: 'Unconnected Pin Detection',
    description: 'Flags nodes that have no connections (floating pins).',
    code: `
for (var i = 0; i < nodes.length; i++) {
  var n = nodes[i];
  var connected = getConnected(n.id);
  if (connected.length === 0) {
    report('unconnected-pin', '"' + n.label + '" has no connections', 'warning', [n.id], 'Connect this component or remove it if unused');
  }
}
`.trim(),
  },
  {
    name: 'Duplicate Component Labels',
    description: 'Detects components that share the same label.',
    code: `
var seen = {};
for (var i = 0; i < nodes.length; i++) {
  var label = nodes[i].label;
  if (seen[label]) {
    report('duplicate-label', 'Duplicate label "' + label + '" on nodes ' + seen[label] + ' and ' + nodes[i].id, 'error', [seen[label], nodes[i].id], 'Assign unique labels to each component');
  } else {
    seen[label] = nodes[i].id;
  }
}
`.trim(),
  },
]);

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export interface UseDrcScriptsReturn {
  scripts: DrcScript[];
  results: DrcScriptResult[];
  runScript: (scriptId: string, data: ScriptDesignData) => Promise<DrcScriptResult | null>;
  runAllEnabled: (data: ScriptDesignData) => Promise<DrcScriptResult[]>;
  addScript: (name: string, description: string, code: string) => DrcScript;
  updateScript: (id: string, patch: Partial<Pick<DrcScript, 'name' | 'description' | 'code' | 'enabled'>>) => DrcScript | null;
  deleteScript: (id: string) => boolean;
}

export function useDrcScripts(): UseDrcScriptsReturn {
  const engine = useMemo(() => new DrcScriptEngine(), []);
  const library = useMemo(() => new ScriptLibrary(), []);
  const [scripts, setScripts] = useState<DrcScript[]>(() => library.list());
  const [results, setResults] = useState<DrcScriptResult[]>([]);

  const reload = useCallback(() => {
    setScripts(library.list());
  }, [library]);

  const runScript = useCallback(
    async (scriptId: string, data: ScriptDesignData): Promise<DrcScriptResult | null> => {
      const script = library.get(scriptId);
      if (!script) {
        return null;
      }
      const result = await engine.run(script, data);
      setResults((prev) => {
        const filtered = prev.filter((r) => r.scriptId !== scriptId);
        return [...filtered, result];
      });
      return result;
    },
    [engine, library],
  );

  const runAllEnabled = useCallback(
    async (data: ScriptDesignData): Promise<DrcScriptResult[]> => {
      const allResults = await engine.runAll(scripts, data);
      setResults(allResults);
      return allResults;
    },
    [engine, scripts],
  );

  const addScript = useCallback(
    (name: string, description: string, code: string): DrcScript => {
      const script = library.add(name, description, code);
      reload();
      return script;
    },
    [library, reload],
  );

  const updateScript = useCallback(
    (id: string, patch: Partial<Pick<DrcScript, 'name' | 'description' | 'code' | 'enabled'>>): DrcScript | null => {
      const updated = library.update(id, patch);
      if (updated) {
        reload();
      }
      return updated;
    },
    [library, reload],
  );

  const deleteScript = useCallback(
    (id: string): boolean => {
      const deleted = library.delete(id);
      if (deleted) {
        reload();
        setResults((prev) => prev.filter((r) => r.scriptId !== id));
      }
      return deleted;
    },
    [library, reload],
  );

  return { scripts, results, runScript, runAllEnabled, addScript, updateScript, deleteScript };
}
