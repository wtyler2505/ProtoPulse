/**
 * DRC Script Worker — runs user DRC scripts in an isolated Web Worker.
 *
 * The Worker has no DOM/window access by default.  We additionally shadow
 * dangerous globals and block prototype-chain escapes as defense-in-depth.
 */

// ---------------------------------------------------------------------------
// Types (duplicated to keep the worker self-contained — no shared imports)
// ---------------------------------------------------------------------------

interface ScriptNode {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties: Record<string, string>;
}

interface ScriptEdge {
  source: string;
  target: string;
  label?: string;
}

interface ScriptBomItem {
  name: string;
  category: string;
  value: string;
  quantity: number;
}

interface DrcViolation {
  ruleId: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  nodeIds: string[];
  suggestion?: string;
}

interface DrcWarning {
  message: string;
}

interface DrcScript {
  id: string;
  name: string;
  description: string;
  code: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

interface ScriptDesignData {
  nodes: ScriptNode[];
  edges: ScriptEdge[];
  bomItems: ScriptBomItem[];
}

export interface WorkerRequest {
  script: DrcScript;
  data: ScriptDesignData;
}

export interface WorkerResponse {
  violations: DrcViolation[];
  warnings: DrcWarning[];
  passed: boolean;
  executionTimeMs: number;
  scriptId: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_VIOLATIONS = 500;

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
// Block prototype-chain escape
// ---------------------------------------------------------------------------

try {
  Object.defineProperty(globalThis, 'constructor', { value: undefined, writable: false, configurable: false });
} catch {
  // Best-effort — some engines may not allow redefining constructor
}

// ---------------------------------------------------------------------------
// Script execution
// ---------------------------------------------------------------------------

function executeScript(script: DrcScript, data: ScriptDesignData): WorkerResponse {
  const violations: DrcViolation[] = [];
  const warnings: DrcWarning[] = [];
  let violationLimitHit = false;

  // Build adjacency lookup
  const adjacency = new Map<string, string[]>();
  for (const edge of data.edges) {
    const fwd = adjacency.get(edge.source);
    if (fwd) {
      fwd.push(edge.target);
    } else {
      adjacency.set(edge.source, [edge.target]);
    }
    const rev = adjacency.get(edge.target);
    if (rev) {
      rev.push(edge.source);
    } else {
      adjacency.set(edge.target, [edge.source]);
    }
  }

  const nodeMap = new Map<string, ScriptNode>();
  for (const n of data.nodes) {
    nodeMap.set(n.id, n);
  }

  // Context API
  const report = (
    ruleId: string,
    message: string,
    severity: 'error' | 'warning' | 'info' = 'error',
    nodeIds: string[] = [],
    suggestion?: string,
  ): void => {
    if (violationLimitHit) {
      return;
    }
    violations.push({ ruleId, message, severity, nodeIds, suggestion });
    if (violations.length >= MAX_VIOLATIONS) {
      violationLimitHit = true;
    }
  };

  const warn = (message: string): void => {
    warnings.push({ message: String(message) });
  };

  const info = (message: string): void => {
    warnings.push({ message: String(message) });
  };

  const getConnected = (nodeId: string): string[] => {
    return adjacency.get(nodeId)?.slice() ?? [];
  };

  const hasProperty = (nodeId: string, key: string): boolean => {
    const node = nodeMap.get(nodeId);
    if (!node) {
      return false;
    }
    return key in node.properties;
  };

  // Build sandbox parameter lists
  const blockedParams = BLOCKED_GLOBALS.join(', ');
  const blockedArgs = BLOCKED_GLOBALS.map(() => undefined);

  const contextParams = 'nodes, edges, bomItems, report, warn, info, getConnected, hasProperty';
  const contextArgs = [
    Object.freeze(data.nodes.map((n) => Object.freeze({ ...n, properties: Object.freeze({ ...n.properties }) }))),
    Object.freeze(data.edges.map((e) => Object.freeze({ ...e }))),
    Object.freeze(data.bomItems.map((b) => Object.freeze({ ...b }))),
    report,
    warn,
    info,
    getConnected,
    hasProperty,
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

  return {
    violations,
    warnings,
    passed: violations.length === 0,
    executionTimeMs,
    scriptId: script.id,
  };
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { script, data } = event.data;
  const result = executeScript(script, data);
  self.postMessage(result);
};
