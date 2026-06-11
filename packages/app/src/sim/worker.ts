import type { Analysis, SimResult } from './types.js';

/**
 * Main-thread side of the sim worker — moves ngspice-WASM execution off
 * the UI thread so a long transient can't freeze the editor.
 *
 * Protocol (deliberately graph-less): the MAIN thread builds every
 * netlist body (and, for Monte Carlo / stepping, the whole pre-jittered
 * deck list via @protopulse/sim's plan* helpers) and ships plain strings
 * plus the analysis config. The worker holds ONE booted engine and runs
 * decks sequentially. Replies are correlated by id:
 *
 *   → { id, kind: 'simulate', netlistBody, analysis }
 *   → { id, kind: 'mc' | 'step', netlistBodies, analysis }
 *   ← { id, ok: true, result: SimResult[] }   (one entry per body)
 *   ← { id, ok: false, error }
 *
 * Deliberately NOT routed through the worker: the co-sim closed loop.
 * Its conservative quantum loop re-enters SPICE every few microseconds
 * of sim time with fresh PWL cards derived from MCU pin state — that
 * chatty back-and-forth would serialize a message round-trip per
 * quantum and lose more than it gains. It stays inline in
 * @protopulse/cosim (see cosim/runner.ts), as does runner.simulate(),
 * the Analyst's raw entry point.
 */

export type SimWorkerRequest =
  | { id: number; kind: 'simulate'; netlistBody: string; analysis: Analysis }
  | { id: number; kind: 'mc'; netlistBodies: string[]; analysis: Analysis }
  | { id: number; kind: 'step'; netlistBodies: string[]; analysis: Analysis };

/** Omit that distributes over the request union (plain Omit collapses it). */
type SimWorkerRequestBody = SimWorkerRequest extends infer T
  ? T extends SimWorkerRequest
    ? Omit<T, 'id'>
    : never
  : never;

export type SimWorkerResponse =
  | { id: number; ok: true; result: SimResult[] }
  | { id: number; ok: false; error: string }
  /** Streamed once per completed deck in a batch — the panel shows
   *  honest progress instead of a frozen spinner. */
  | { id: number; kind: 'progress'; done: number; total: number };

export type SimProgress = (done: number, total: number) => void;

/**
 * The slice of the DOM Worker surface the client uses — narrow enough
 * for node tests to shim without a real worker.
 */
export interface WorkerLike {
  postMessage(message: SimWorkerRequest): void;
  addEventListener(type: 'message', listener: (event: { data: SimWorkerResponse }) => void): void;
  addEventListener(type: 'error', listener: (event: { message?: string }) => void): void;
  terminate(): void;
}

/** True where `new Worker(…)` exists (browsers); false under node tests. */
export function simWorkerSupported(): boolean {
  return typeof Worker !== 'undefined';
}

/**
 * The real Vite module worker. The literal `new Worker(new URL(…))`
 * pattern is what makes Vite emit a separate worker chunk.
 */
function spawnSimWorker(): WorkerLike {
  return new Worker(new URL('./sim.worker.ts', import.meta.url), {
    type: 'module',
  }) as unknown as WorkerLike;
}

interface Pending {
  resolve: (results: SimResult[]) => void;
  reject: (error: Error) => void;
  onProgress?: SimProgress;
}

/**
 * Lazy, self-healing request/response wrapper: the worker is spawned on
 * the first request (engine boot costs seconds — never pay it at app
 * startup), responses are matched to callers by id, and a crashed
 * worker rejects everything in flight and respawns on the next request.
 */
export class SimWorkerClient {
  private worker: WorkerLike | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private readonly spawn: () => WorkerLike;

  constructor(spawn: () => WorkerLike = spawnSimWorker) {
    this.spawn = spawn;
  }

  private ensureWorker(): WorkerLike {
    if (this.worker) return this.worker;
    const worker = this.spawn();
    worker.addEventListener('message', (event) => {
      this.onMessage(event.data);
    });
    worker.addEventListener('error', (event) => {
      this.onCrash(event.message ?? 'sim worker crashed');
    });
    this.worker = worker;
    return worker;
  }

  private onMessage(data: SimWorkerResponse): void {
    const entry = this.pending.get(data.id);
    if (!entry) return; // stale reply from a superseded worker
    if ('kind' in data) {
      entry.onProgress?.(data.done, data.total);
      return; // batch still running
    }
    this.pending.delete(data.id);
    if (data.ok) {
      entry.resolve(data.result);
    } else {
      entry.reject(new Error(data.error));
    }
  }

  private onCrash(message: string): void {
    const inFlight = [...this.pending.values()];
    this.pending.clear();
    this.worker?.terminate();
    this.worker = null; // respawn lazily on the next request
    for (const entry of inFlight) {
      entry.reject(new Error(message));
    }
  }

  private request(req: SimWorkerRequestBody, onProgress?: SimProgress): Promise<SimResult[]> {
    const id = this.nextId;
    this.nextId += 1;
    const worker = this.ensureWorker();
    return new Promise<SimResult[]>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, ...(onProgress ? { onProgress } : {}) });
      worker.postMessage({ ...req, id } as SimWorkerRequest);
    });
  }

  /** One deck, one analysis, one result. */
  async simulate(netlistBody: string, analysis: Analysis): Promise<SimResult> {
    const results = await this.request({ kind: 'simulate', netlistBody, analysis });
    const first = results[0];
    if (first === undefined) {
      throw new Error('sim worker returned no result for a simulate request');
    }
    return first;
  }

  /** Pre-built deck list (Monte Carlo / step), results in deck order.
   *  onProgress fires once per completed deck. */
  runBatch(
    kind: 'mc' | 'step',
    netlistBodies: string[],
    analysis: Analysis,
    onProgress?: SimProgress,
  ): Promise<SimResult[]> {
    return this.request({ kind, netlistBodies, analysis }, onProgress);
  }
}
