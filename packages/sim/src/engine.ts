import { Simulation } from 'eecircuit-engine';

import { analysisCard } from './analyses.js';

import type { Analysis } from './analyses.js';
import type { ResultType } from 'eecircuit-engine';

/**
 * Thin wrapper over eecircuit-engine (ngspice compiled to WASM).
 *
 * One engine instance is reused across runs: boot once (`start`), then
 * `setNetList` + `runSim` per run. The wrapper appends the analysis card
 * and `.end` to a netlist body and normalizes results into SimResult.
 */

export interface SimVector {
  name: string;
  /** Real values; for AC (complex) results this is the real part. */
  values: number[];
  /** Imaginary parts, present only for complex (AC) results. */
  imag?: number[];
}

export interface SimResult {
  analysis: Analysis;
  variables: string[];
  points: number;
  vectors: SimVector[];
}

export interface SpiceEngineOptions {
  /**
   * Suppress eecircuit-engine's direct console chatter. Normal callers keep
   * logs visible; integration tests use this for expected ngspice failures.
   */
  quiet?: boolean;
}

function normalize(raw: ResultType, analysis: Analysis): SimResult {
  const vectors: SimVector[] =
    raw.dataType === 'complex'
      ? raw.data.map((d) => ({
          name: d.name,
          values: d.values.map((v) => v.real),
          imag: d.values.map((v) => v.img),
        }))
      : raw.data.map((d) => ({ name: d.name, values: [...d.values] }));
  return {
    analysis,
    variables: [...raw.variableNames],
    points: raw.numPoints,
    vectors,
  };
}

export class SpiceEngine {
  private sim: Simulation | null = null;
  private booting: Promise<void> | null = null;
  private readonly quiet: boolean;

  constructor(opts: SpiceEngineOptions = {}) {
    this.quiet = opts.quiet ?? false;
  }

  /** Lazily boot the WASM engine; safe to call repeatedly. */
  async start(): Promise<void> {
    if (!this.sim) {
      this.sim = new Simulation();
      this.booting = this.sim.start();
    }
    await this.booting;
  }

  /**
   * Run one analysis over a netlist body (title + elements + models,
   * no analysis card, no `.end` — both are appended here).
   */
  async run(netlistBody: string, analysis: Analysis): Promise<SimResult> {
    await this.start();
    const sim = this.sim;
    if (!sim) throw new Error('engine not started');
    const body = netlistBody.endsWith('\n') ? netlistBody : `${netlistBody}\n`;
    const raw = await this.withQuietConsole(async () => {
      sim.setNetList(`${body}${analysisCard(analysis)}\n.end\n`);
      return sim.runSim();
    });
    if (raw.numPoints === 0 || raw.variableNames.length === 0) {
      const errors = sim.getError().filter((line) => line.trim().length > 0);
      throw new Error(`simulation produced no data${errors.length > 0 ? `: ${errors.join('; ')}` : ''}`);
    }
    return normalize(raw, analysis);
  }

  /** Best-effort teardown; the WASM module has no explicit dispose API. */
  async stop(): Promise<void> {
    this.sim = null;
    this.booting = null;
    await Promise.resolve();
  }

  private async withQuietConsole<T>(run: () => Promise<T>): Promise<T> {
    if (!this.quiet) return run();
    const runtimeConsole = globalThis.console;
    const originalInfo = runtimeConsole.info;
    const originalError = runtimeConsole.error;
    const ignore = (): void => undefined;
    runtimeConsole.info = ignore;
    runtimeConsole.error = ignore;
    try {
      return await run();
    } finally {
      runtimeConsole.info = originalInfo;
      runtimeConsole.error = originalError;
    }
  }
}

/** Convenience accessor: vector by (case-insensitive) name. */
export function vectorByName(result: SimResult, name: string): SimVector | undefined {
  const wanted = name.toLowerCase();
  return result.vectors.find((v) => v.name.toLowerCase() === wanted);
}
