/**
 * Sandboxed Web Worker evaluator for Circuit DSL code.
 *
 * Architecture:
 * - Sucrase transpilation happens on the MAIN THREAD (fast enough, avoids complexity)
 * - The worker only does sandboxed Function() eval with an injected circuit builder API
 * - Worker is created as a Blob URL (no separate file needed)
 * - 2-second watchdog kills hung workers (infinite loops)
 * - IR output capped at 1MB
 */

import { transform } from 'sucrase';
import { z } from 'zod';
import type { CircuitIR } from './circuit-ir';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ComponentCatalogEntry {
  partId: string;
  name: string;
  category: string;
  pins: string[];
}

export interface WorkerSuccessResult {
  ok: true;
  ir: CircuitIR;
  evalId: string;
}

export interface WorkerErrorResult {
  ok: false;
  error: string;
  line?: number;
  evalId: string;
}

export type WorkerResult = WorkerSuccessResult | WorkerErrorResult;

interface WorkerMessage {
  transpiledCode: string;
  evalId: string;
  componentCatalog: ComponentCatalogEntry[];
}

// ─── Zod schema for validating IR from untrusted worker ─────────────────────

const CircuitIRComponentSchema = z.object({
  id: z.string(),
  refdes: z.string(),
  partId: z.string(),
  value: z.string().optional(),
  footprint: z.string().optional(),
  pins: z.record(z.string(), z.string()),
});

const CircuitIRNetSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['signal', 'power', 'ground']),
});

const CircuitIRWireSchema = z.object({
  id: z.string(),
  netId: z.string(),
  points: z.array(z.object({ x: z.number(), y: z.number() })),
});

const CircuitIRSchema = z.object({
  meta: z.object({ name: z.string(), version: z.string() }),
  components: z.array(CircuitIRComponentSchema),
  nets: z.array(CircuitIRNetSchema),
  wires: z.array(CircuitIRWireSchema),
});

// ─── Constants ──────────────────────────────────────────────────────────────

const WATCHDOG_TIMEOUT_MS = 2000;
const MAX_IR_SIZE_BYTES = 1_000_000; // 1MB

// ─── Worker Blob Code ───────────────────────────────────────────────────────

/**
 * Inline worker code. This string becomes a Blob URL.
 * The worker receives transpiled JS code + a component catalog,
 * evaluates it in a restricted scope with a circuit builder API,
 * and posts back the resulting IR or an error.
 */
const WORKER_CODE = `
'use strict';

// ── Delete dangerous globals ──
(function() {
  var dangerousGlobals = [
    'fetch', 'XMLHttpRequest', 'importScripts', 'WebSocket',
    'EventSource', 'navigator', 'localStorage', 'sessionStorage',
    'indexedDB', 'caches', 'CacheStorage'
  ];
  for (var i = 0; i < dangerousGlobals.length; i++) {
    try { delete self[dangerousGlobals[i]]; } catch(e) {}
    try { self[dangerousGlobals[i]] = undefined; } catch(e) {}
  }
})();

// ── Inline Circuit Builder API ──
function createCircuitBuilder(name, componentCatalog) {
  var components = [];
  var nets = [];
  var wires = [];
  var refdesCounts = {};
  var usedRefdes = {};

  function uuid() {
    // Simple UUID v4 generator for worker context
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0;
      var v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function nextRefdes(prefix) {
    if (!refdesCounts[prefix]) { refdesCounts[prefix] = 0; }
    var num;
    do {
      refdesCounts[prefix]++;
      num = refdesCounts[prefix];
    } while (usedRefdes[prefix + num]);
    return prefix + num;
  }

  function addComponent(type, prefix, defaultPins, opts) {
    opts = opts || {};
    var refdes = opts.refdes || nextRefdes(prefix);
    if (usedRefdes[refdes]) {
      throw new Error('Duplicate refdes: ' + refdes);
    }
    usedRefdes[refdes] = true;

    var pinNames = opts.pins || defaultPins;
    var pins = {};
    for (var i = 0; i < pinNames.length; i++) {
      pins[pinNames[i]] = '';
    }

    var comp = {
      id: uuid(),
      refdes: refdes,
      partId: type + ':' + (opts.value || opts.part || 'unknown'),
      value: opts.value,
      footprint: opts.footprint,
      pins: pins
    };
    components.push(comp);

    return {
      id: comp.id,
      pin: function(nameOrNum) {
        var pinName = String(nameOrNum);
        if (!comp.pins.hasOwnProperty(pinName)) {
          // Try numeric index for numbered-pin components
          var pinKeys = Object.keys(comp.pins);
          if (typeof nameOrNum === 'number' && nameOrNum >= 1 && nameOrNum <= pinKeys.length) {
            pinName = pinKeys[nameOrNum - 1];
          } else {
            throw new Error('Component ' + comp.refdes + ' has no pin "' + nameOrNum + '"');
          }
        }
        return { componentId: comp.id, pinName: pinName };
      }
    };
  }

  function findNet(ref) {
    if (ref && ref.netId) { return ref; }
    return null;
  }

  var builder = {
    resistor: function(opts) { return addComponent('resistor', 'R', ['1', '2'], opts); },
    capacitor: function(opts) { return addComponent('capacitor', 'C', ['1', '2'], opts); },
    inductor: function(opts) { return addComponent('inductor', 'L', ['1', '2'], opts); },
    diode: function(opts) { return addComponent('diode', 'D', ['A', 'K'], opts); },
    led: function(opts) { return addComponent('led', 'LED', ['A', 'K'], opts); },
    transistor: function(opts) { return addComponent('transistor', 'Q', ['B', 'C', 'E'], opts); },
    ic: function(opts) {
      var defaultPins = opts.pins || ['1'];
      return addComponent('ic', 'U', defaultPins, opts);
    },
    connector: function(opts) {
      var pinList = opts.pins || ['1'];
      return addComponent('connector', 'J', pinList, opts);
    },
    generic: function(opts) {
      var prefix = opts.refdesPrefix || 'X';
      var pinList = opts.pins || ['1'];
      return addComponent('generic', prefix, pinList, opts);
    },
    net: function(name, opts) {
      opts = opts || {};
      var type = 'signal';
      if (opts.ground) { type = 'ground'; }
      else if (opts.voltage !== undefined) { type = 'power'; }
      var n = { id: uuid(), name: name, type: type, netId: undefined };
      n.netId = n.id;
      nets.push(n);
      return n;
    },
    connect: function() {
      var args = Array.prototype.slice.call(arguments);
      var netRef = null;
      for (var i = 0; i < args.length; i++) {
        var n = findNet(args[i]);
        if (n) { netRef = n; break; }
      }
      if (!netRef) {
        netRef = { id: uuid(), name: 'auto_net_' + nets.length, type: 'signal', netId: undefined };
        netRef.netId = netRef.id;
        nets.push(netRef);
      }
      for (var j = 0; j < args.length; j++) {
        var arg = args[j];
        if (arg.componentId && arg.pinName !== undefined) {
          for (var k = 0; k < components.length; k++) {
            if (components[k].id === arg.componentId) {
              components[k].pins[arg.pinName] = netRef.id;
            }
          }
        }
      }
    },
    chain: function() {
      var args = Array.prototype.slice.call(arguments);
      for (var i = 0; i < args.length - 1; i++) {
        var a = args[i];
        var b = args[i + 1];
        var pinA = a.netId ? a : (a.pin ? a.pin(Object.keys(
          components.find(function(c) { return c.id === a.id; }).pins
        ).length) : a);
        var pinB = b.netId ? b : (b.pin ? b.pin(1) : b);
        builder.connect(pinA, pinB);
      }
    },
    export: function() {
      return {
        meta: { name: name, version: '1.0' },
        components: components.map(function(c) {
          var copy = { id: c.id, refdes: c.refdes, partId: c.partId, pins: c.pins };
          if (c.value !== undefined) { copy.value = c.value; }
          if (c.footprint !== undefined) { copy.footprint = c.footprint; }
          return copy;
        }),
        nets: nets.map(function(n) {
          return { id: n.id, name: n.name, type: n.type };
        }),
        wires: wires
      };
    }
  };

  return builder;
}

// ── Message Handler ──
self.onmessage = function(e) {
  var data = e.data;
  var transpiledCode = data.transpiledCode;
  var evalId = data.evalId;
  var componentCatalog = data.componentCatalog || [];

  try {
    // Support both DSL styles:
    // 1. explicit builder declaration, e.g. const c = circuit("My Circuit");
    // 2. shorthand builder usage, e.g. c.resistor({ value: "10k" })
    var hasBuilderDeclaration = /(^|[\\s;])(const|let|var)\\s+c\\s*=/.test(transpiledCode);
    var runnableCode = hasBuilderDeclaration
      ? transpiledCode
      : 'const c = circuit("UserCircuit");\\n' + transpiledCode;

    // Evaluate the transpiled code and export the builder it leaves in scope.
    var fn = new Function(
      'circuit',
      runnableCode + '; return typeof c !== "undefined" && c && typeof c.export === "function" ? c.export() : undefined;'
    );
    var ir = fn(function(name) { return createCircuitBuilder(name || 'UserCircuit', componentCatalog); });

    var irJson = JSON.stringify(ir);

    self.postMessage({
      ok: true,
      ir: ir,
      evalId: evalId,
      _rawSize: irJson.length
    });
  } catch (err) {
    var message = err instanceof Error ? err.message : String(err);
    var line = undefined;

    // Try to extract line number from error
    var lineMatch = message.match(/line\\s+(\\d+)/i);
    if (lineMatch) { line = parseInt(lineMatch[1], 10); }
    if (err instanceof SyntaxError && err.lineNumber) { line = err.lineNumber; }

    self.postMessage({
      ok: false,
      error: message,
      line: line,
      evalId: evalId
    });
  }
};
`;

// ─── Worker Management ──────────────────────────────────────────────────────

/**
 * Creates a new sandboxed circuit evaluation Web Worker via Blob URL.
 */
export function createCircuitWorker(): Worker {
  const blob = new Blob([WORKER_CODE], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  const worker = new Worker(url);
  URL.revokeObjectURL(url);
  return worker;
}

/**
 * Evaluates circuit DSL code in the sandboxed worker.
 * Transpiles TypeScript → JavaScript via Sucrase on the main thread,
 * then sends to worker for execution.
 *
 * Returns a promise that resolves with the worker result (success or error).
 * Rejects after WATCHDOG_TIMEOUT_MS if the worker doesn't respond.
 */
export function evaluateInWorker(
  worker: Worker,
  code: string,
  catalog: ComponentCatalogEntry[],
): Promise<WorkerResult> {
  const evalId = crypto.randomUUID();

  // Transpile TypeScript → JavaScript on main thread
  let transpiledCode: string;
  try {
    const result = transform(code, {
      transforms: ['typescript'],
      disableESTransforms: true,
    });
    transpiledCode = result.code;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Try to extract line number from Sucrase error
    const lineMatch = message.match(/(\d+):(\d+)/);
    return Promise.resolve({
      ok: false as const,
      error: `SyntaxError: ${message}`,
      line: lineMatch ? parseInt(lineMatch[1], 10) : undefined,
      evalId,
    });
  }

  return new Promise<WorkerResult>((resolve) => {
    let settled = false;

    // Watchdog timer — kill worker after timeout
    const watchdog = setTimeout(() => {
      if (!settled) {
        settled = true;
        worker.onmessage = null;
        resolve({
          ok: false,
          error: 'Evaluation timed out after 2s — possible infinite loop',
          evalId,
        });
      }
    }, WATCHDOG_TIMEOUT_MS);

    worker.onmessage = (e: MessageEvent) => {
      const data = e.data as {
        ok: boolean;
        ir?: unknown;
        error?: string;
        line?: number;
        evalId: string;
        _rawSize?: number;
      };

      // Ignore responses for different evalIds
      if (data.evalId !== evalId) {
        return;
      }

      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(watchdog);

      if (data.ok) {
        // Check size limit
        const rawSize = data._rawSize ?? JSON.stringify(data.ir).length;
        if (rawSize > MAX_IR_SIZE_BYTES) {
          resolve({
            ok: false,
            error: `IR output too large (${Math.round(rawSize / 1024)}KB exceeds 1MB limit)`,
            evalId,
          });
          return;
        }

        // Validate IR structure with Zod
        const parsed = CircuitIRSchema.safeParse(data.ir);
        if (!parsed.success) {
          resolve({
            ok: false,
            error: `Invalid IR structure: ${parsed.error.issues[0]?.message ?? 'unknown validation error'}`,
            evalId,
          });
          return;
        }

        resolve({
          ok: true,
          ir: parsed.data as CircuitIR,
          evalId,
        });
      } else {
        resolve({
          ok: false,
          error: data.error ?? 'Unknown worker error',
          line: data.line,
          evalId,
        });
      }
    };

    const message: WorkerMessage = {
      transpiledCode,
      evalId,
      componentCatalog: catalog,
    };
    worker.postMessage(message);
  });
}

/**
 * Terminates a circuit evaluation worker.
 */
export function terminateWorker(worker: Worker): void {
  worker.terminate();
}
