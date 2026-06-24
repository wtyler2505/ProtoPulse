import { sharedEmuSession } from '../emu/runner.js';
import { fallbackFidelitySummary } from '../sim/runner.js';

import { validateClosedLoopSpec, validateSpec } from './bindings.js';

import type {
  ClosedLoopResult,
  ClosedLoopSpec,
  CosimModule,
  CosimResult,
  CosimWindowSpec,
} from './types.js';
import type { EmuSession } from '../emu/runner.js';
import type { McuCore } from '../emu/types.js';
import type { DesignGraph } from '@protopulse/graph';
import type { PartDb } from '@protopulse/parts';

/**
 * Co-simulation runner: wraps the LAZY '@protopulse/cosim' import (the
 * package is built on a parallel track; never pay for it — or crash on
 * it — at app startup) and surfaces every failure as a value — the
 * panel renders them, it never catches.
 *
 * The MCU side is BORROWED from the Firmware tab's shared emu session
 * (one core, one firmware, two views of it). Borrow protocol, in order:
 *
 *   1. No firmware loaded → error-as-value; the panel sends the user to
 *      the Firmware tab.
 *   2. suspend() the session: the Firmware panel's RAF loop (if alive)
 *      becomes a no-op, so nothing advances the core under the engine.
 *   3. reset() BEFORE the window: a co-sim window always starts from
 *      power-on. Deliberate choice — a deterministic, reproducible
 *      window beats continuing a half-run whose pin history the analog
 *      solver never saw. This also clears the Firmware tab's cycle
 *      counter, pin traces, and serial text.
 *   4. Run the window (the engine steps the core itself).
 *   5. reset() + resume() AFTER (also on error): the engine left the
 *      core mid-window, but the session's own bookkeeping (cycle count,
 *      event ring) never saw those steps — resetting both back to
 *      power-on keeps the Firmware tab consistent instead of resuming
 *      from a state it cannot explain.
 *
 * NO caching: the core is stateful and a window is cheap relative to
 * the determinism questions a cache would raise — every Run re-executes.
 */

export type CosimOutcome =
  | {
      ok: true;
      result: CosimResult;
      /** Human fidelity summary of result.sim.manifest. */
      fidelity: string;
      /** Wall-clock cost of the window, for the slowdown readout. */
      wallMs: number;
    }
  | { ok: false; error: string };

export type CosimClosedOutcome =
  | {
      ok: true;
      result: ClosedLoopResult;
      /** Human fidelity summary of result.sim.manifest. */
      fidelity: string;
      /** Wall-clock cost of the whole quantum loop. */
      wallMs: number;
    }
  | { ok: false; error: string };

type CosimModuleLoader = () => Promise<Partial<CosimModule>>;

const defaultLoader: CosimModuleLoader = async () => {
  // Opaque specifier over the pinned API: the package lands on a
  // parallel track, so the literal string would break BOTH tsc module
  // resolution and vite's build-time analysis today. The indirection
  // keeps them off it; the shape is runtime-checked below. Collapse to
  // the literal import (review/runner.ts style) once the package is in
  // the workspace.
  return (await import('@protopulse/cosim')) as unknown as Partial<CosimModule>;
};

export interface CosimRunnerOpts {
  loader?: CosimModuleLoader;
  /** The emu session whose core is borrowed; the app-wide one by default. */
  session?: EmuSession;
  /** Wall clock in ms — injectable for tests. */
  now?: () => number;
}

export interface CosimRunner {
  run: (graph: DesignGraph, parts: PartDb, spec: CosimWindowSpec) => Promise<CosimOutcome>;
  /** The FEEDBACK direction: MCU↔SPICE on a conservative quantum. */
  runClosedLoop: (
    graph: DesignGraph,
    parts: PartDb,
    spec: ClosedLoopSpec,
  ) => Promise<CosimClosedOutcome>;
}

export function createCosimRunner(opts: CosimRunnerOpts = {}): CosimRunner {
  const loader = opts.loader ?? defaultLoader;
  const session = opts.session ?? sharedEmuSession;
  const now = opts.now ?? (() => performance.now());

  let modulePromise: Promise<Partial<CosimModule>> | null = null;
  const loadModule = (): Promise<Partial<CosimModule>> => (modulePromise ??= loader());

  /**
   * The shared run shape for both directions: validate, gate on
   * firmware, lazy-load the module, then the exclusive borrow — pause
   * the Firmware run loop, start the window from power-on, and hand the
   * core back at power-on afterwards (also on error).
   */
  const borrowAndRun = async <R extends CosimResult>(
    validationError: string | null,
    pickEngine: (
      mod: Partial<CosimModule>,
    ) => { ok: true; exec: (core: McuCore) => Promise<R> } | { ok: false; error: string },
  ): Promise<
    { ok: true; result: R; fidelity: string; wallMs: number } | { ok: false; error: string }
  > => {
    if (validationError !== null) return { ok: false, error: validationError };

    const core = session.getCore();
    if (core === null || !session.loaded) {
      return {
        ok: false,
        error: 'load firmware first — co-simulation drives the Firmware tab’s MCU core',
      };
    }

    let mod: Partial<CosimModule>;
    try {
      mod = await loadModule();
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    const picked = pickEngine(mod);
    if (!picked.ok) return picked;

    session.suspend();
    const t0 = now();
    try {
      session.reset();
      const result = await picked.exec(core);
      return {
        ok: true,
        result,
        fidelity: fallbackFidelitySummary(result.sim.manifest),
        wallMs: now() - t0,
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    } finally {
      session.reset();
      session.resume();
    }
  };

  const run = (
    graph: DesignGraph,
    parts: PartDb,
    spec: CosimWindowSpec,
  ): Promise<CosimOutcome> =>
    borrowAndRun<CosimResult>(validateSpec(spec), (mod) => {
      if (typeof mod.runCosimWindow !== 'function') {
        return {
          ok: false,
          error: 'co-simulation not available yet — @protopulse/cosim is not in this build',
        };
      }
      const fn = mod.runCosimWindow;
      return { ok: true, exec: (core) => fn({ graph, parts, core, spec }) };
    });

  const runClosedLoop = (
    graph: DesignGraph,
    parts: PartDb,
    spec: ClosedLoopSpec,
  ): Promise<CosimClosedOutcome> =>
    borrowAndRun<ClosedLoopResult>(validateClosedLoopSpec(spec), (mod) => {
      if (typeof mod.runCosimClosedLoop !== 'function') {
        return {
          ok: false,
          error:
            'closed-loop co-simulation not in this build — @protopulse/cosim lacks runCosimClosedLoop',
        };
      }
      const fn = mod.runCosimClosedLoop;
      // Auto-install device models for placed I2C/SPI parts when the caller did
      // not list them explicitly (?? short-circuits so an explicit list wins
      // and graph resolution is skipped). The *FromGraph helpers are optional
      // on older cosim builds — probe before calling.
      const i2cDevices = spec.i2cDevices ?? mod.i2cDevicesFromGraph?.(graph);
      const spiDevices = spec.spiDevices ?? mod.spiDevicesFromGraph?.(graph);
      const resolved: ClosedLoopSpec =
        i2cDevices !== undefined || spiDevices !== undefined
          ? {
              ...spec,
              ...(i2cDevices !== undefined ? { i2cDevices } : {}),
              ...(spiDevices !== undefined ? { spiDevices } : {}),
            }
          : spec;
      return { ok: true, exec: (core) => fn({ graph, parts, core, spec: resolved }) };
    });

  return { run, runClosedLoop };
}

/** The app-wide runner instance (borrows the shared emu session). */
export const cosimRunner: CosimRunner = createCosimRunner();

/** Panel entry point — uncached by design; every Run re-executes. */
export function runCosim(
  graph: DesignGraph,
  parts: PartDb,
  spec: CosimWindowSpec,
): Promise<CosimOutcome> {
  return cosimRunner.run(graph, parts, spec);
}

/** Panel entry point for the FEEDBACK direction — equally uncached. */
export function runCosimClosed(
  graph: DesignGraph,
  parts: PartDb,
  spec: ClosedLoopSpec,
): Promise<CosimClosedOutcome> {
  return cosimRunner.runClosedLoop(graph, parts, spec);
}
