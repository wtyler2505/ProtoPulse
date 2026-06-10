import { SpiceEngine } from '@protopulse/sim';

import type { Analysis, SimResult } from './types.js';
import type { SimWorkerRequest, SimWorkerResponse } from './worker.js';

/**
 * The worker side of the sim worker pair (protocol: worker.ts). Holds
 * exactly ONE SpiceEngine for the worker's lifetime — WASM boot costs
 * seconds and `setNetList` + `runSim` are cheap per deck — and runs the
 * request's deck list sequentially (ngspice is single-threaded; there
 * is nothing to gain from interleaving).
 *
 * The module is import-safe under node tests: the message bridge only
 * attaches inside a real DedicatedWorkerGlobalScope, and constructing a
 * SpiceEngine does not boot the WASM (engine.run() does, lazily).
 */

/** What the handler needs from an engine — injectable for tests. */
export interface EngineLike {
  run(netlistBody: string, analysis: Analysis): Promise<SimResult>;
}

const engine: EngineLike = new SpiceEngine() as EngineLike;

/** Pure request → response mapping; errors become error replies. */
export async function handleSimWorkerRequest(
  req: SimWorkerRequest,
  eng: EngineLike = engine,
): Promise<SimWorkerResponse> {
  try {
    const bodies = req.kind === 'simulate' ? [req.netlistBody] : req.netlistBodies;
    const result: SimResult[] = [];
    for (const body of bodies) {
      result.push(await eng.run(body, req.analysis));
    }
    return { id: req.id, ok: true, result };
  } catch (err) {
    return { id: req.id, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** The worker global surface we touch (typed without lib.webworker). */
interface WorkerScope {
  addEventListener(type: 'message', listener: (event: { data: SimWorkerRequest }) => void): void;
  postMessage(message: SimWorkerResponse): void;
  document?: unknown;
}

const scope = globalThis as unknown as Partial<WorkerScope>;

// Attach only inside a real worker: postMessage exists on worker scopes
// (and window — the `document` check excludes the main thread / jsdom)
// but not on node's globalThis.
if (
  typeof scope.addEventListener === 'function' &&
  typeof scope.postMessage === 'function' &&
  scope.document === undefined
) {
  scope.addEventListener('message', (event) => {
    void handleSimWorkerRequest(event.data).then((response) => {
      scope.postMessage?.(response);
    });
  });
}
