import { z } from 'zod';

import { ToolRegistry } from '../registry.js';
import { fidelitySummary } from '../sim-types.js';

import { designDigest, digestSummary } from './digest.js';

import type { AiTool, ToolResult } from '../registry.js';
import type { Analysis, PinnedSimulateFn, SimResultWithManifest, SimVector } from '../sim-types.js';

/**
 * The Analyst's 3 tools — v0.2 Lab milestone. The simulate function is
 * DEPENDENCY-INJECTED: the app wires the real ngspice-WASM engine in,
 * tests pass a fake. Tools never import @protopulse/sim directly.
 *
 * run_simulation is the registry's only async tool; measure works over
 * the LAST run_simulation result held as registry-instance state.
 */

// ── Analysis schema (mirrors the pinned Analysis union) ──────────────

const zAnalysis = z.union([
  z.object({ kind: z.literal('op') }).describe('DC operating point'),
  z
    .object({
      kind: z.literal('tran'),
      stepS: z.number().positive().describe('Time step in seconds'),
      stopS: z.number().positive().describe('Stop time in seconds'),
      startS: z.number().nonnegative().optional().describe('Start time in seconds, default 0'),
    })
    .describe('Transient analysis'),
  z
    .object({
      kind: z.literal('dc'),
      source: z.string().min(1).describe('Ref of the swept source, e.g. "BT1"'),
      start: z.number().describe('Sweep start in volts'),
      stop: z.number().describe('Sweep stop in volts'),
      step: z.number().describe('Sweep step in volts'),
    })
    .describe('DC sweep'),
  z
    .object({
      kind: z.literal('ac'),
      variation: z.enum(['dec', 'oct', 'lin']).describe('Frequency spacing'),
      points: z.number().int().positive().describe('Points per decade/octave, or total for lin'),
      fStart: z.number().positive().describe('Start frequency in Hz'),
      fStop: z.number().positive().describe('Stop frequency in Hz'),
    })
    .describe('Small-signal AC analysis'),
]);

function describeAnalysis(a: Analysis): string {
  switch (a.kind) {
    case 'op':
      return 'operating point';
    case 'tran':
      return `transient ${String(a.stepS)}s step to ${String(a.stopS)}s`;
    case 'dc':
      return `dc sweep of ${a.source} ${String(a.start)}→${String(a.stop)}V step ${String(a.step)}V`;
    case 'ac':
      return `ac ${a.variation} ${String(a.points)}pt ${String(a.fStart)}Hz→${String(a.fStop)}Hz`;
  }
}

/** Name of the sweep (x-axis) vector for a result, or null for op. */
export function sweepVectorName(result: SimResultWithManifest): string | null {
  switch (result.analysis.kind) {
    case 'op':
      return null;
    case 'tran':
      return 'time';
    case 'ac':
      return 'frequency';
    case 'dc':
      return result.variables[0] ?? null;
  }
}

// ── Vector math ──────────────────────────────────────────────────────

function vectorStats(values: number[]): { min: number; max: number; final: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max, final: values[values.length - 1] ?? NaN };
}

const METRICS = ['min', 'max', 'avg', 'rms', 'final', 'peak_to_peak'] as const;
type Metric = (typeof METRICS)[number];

function computeMetric(values: number[], metric: Metric): number {
  const { min, max, final } = vectorStats(values);
  switch (metric) {
    case 'min':
      return min;
    case 'max':
      return max;
    case 'final':
      return final;
    case 'peak_to_peak':
      return max - min;
    case 'avg':
      return values.reduce((s, v) => s + v, 0) / values.length;
    case 'rms':
      return Math.sqrt(values.reduce((s, v) => s + v * v, 0) / values.length);
  }
}

// ── Tool assembly ────────────────────────────────────────────────────

export const ANALYST_TOOL_NAMES = ['run_simulation', 'measure', 'read_design'] as const;

/**
 * Build the Analyst's registry. simulate is injected by the host (the
 * app wires the real engine at the panel level; tests pass a fake).
 * The instance holds the last simulation result for measure.
 */
export function createAnalystRegistry(simulate: PinnedSimulateFn): ToolRegistry {
  let last: SimResultWithManifest | null = null;

  const runSimulationSchema = z.object({
    analysis: zAnalysis,
  });

  const runSimulation: AiTool<typeof runSimulationSchema> = {
    name: 'run_simulation',
    description:
      'Run a SPICE simulation of the current design. analysis.kind selects op (operating point), ' +
      'tran (transient; stepS/stopS in seconds), dc (sweep a source ref), or ac (frequency sweep). ' +
      'Runs to completion — transients with many points take seconds. Returns per-vector min/max/final ' +
      'stats and the FIDELITY MANIFEST: which parts simulated with real spice models, behavioral ' +
      'approximations, or stubs. Always relay the manifest when reporting results.',
    schema: runSimulationSchema,
    destructive: false,
    costClass: 'heavy',
    async execute(input, ctx): Promise<ToolResult> {
      const result = await simulate(ctx.graph, ctx.parts, input.analysis);
      last = result;
      const stats: Record<string, { min: number; max: number; final: number }> = {};
      for (const vec of result.vectors) {
        stats[vec.name] = vectorStats(vec.values);
      }
      const fidelity = fidelitySummary(result.manifest);
      return {
        ops: [],
        data: {
          variables: result.variables,
          points: result.points,
          manifest: result.manifest,
          stats,
        },
        summary: `Ran ${describeAnalysis(input.analysis)}: ${String(result.points)} point(s), vectors [${result.vectors.map((v) => v.name).join(', ')}]. ${fidelity}`,
      };
    },
    explain(input): string {
      return `Simulate the design (${describeAnalysis(input.analysis)})`;
    },
  };

  const measureSchema = z.object({
    vector: z.string().min(1).describe('Vector name from the last simulation, e.g. "v(out)"'),
    metric: z.enum(METRICS).describe('Statistic to compute'),
    t_start: z.number().optional().describe('Window start on the sweep axis (s, Hz, or V)'),
    t_stop: z.number().optional().describe('Window end on the sweep axis (s, Hz, or V)'),
  });

  const measure: AiTool<typeof measureSchema> = {
    name: 'measure',
    description:
      'Compute a statistic (min/max/avg/rms/final/peak_to_peak) over a vector from the LAST ' +
      'run_simulation result, optionally windowed on the sweep axis via t_start/t_stop. ' +
      'Use this for numbers instead of eyeballing plots.',
    schema: measureSchema,
    destructive: false,
    costClass: 'cheap',
    execute(input): ToolResult {
      if (!last) {
        throw new Error('no simulation result yet — call run_simulation first');
      }
      const vec = last.vectors.find((v) => v.name === input.vector);
      if (!vec) {
        const names = last.vectors.map((v) => v.name).join(', ');
        throw new Error(`unknown vector "${input.vector}" — available: ${names}`);
      }
      const sweepName = sweepVectorName(last);
      const sweep: SimVector | undefined = sweepName
        ? last.vectors.find((v) => v.name === sweepName)
        : undefined;

      let values = vec.values;
      if ((input.t_start !== undefined || input.t_stop !== undefined) && sweep) {
        const lo = input.t_start ?? -Infinity;
        const hi = input.t_stop ?? Infinity;
        values = vec.values.filter((_, i) => {
          const x = sweep.values[i];
          return x !== undefined && x >= lo && x <= hi;
        });
      }
      if (values.length === 0) {
        throw new Error(
          `window [${String(input.t_start ?? '-∞')}, ${String(input.t_stop ?? '∞')}] contains no points`,
        );
      }
      const value = computeMetric(values, input.metric);
      const windowNote =
        input.t_start !== undefined || input.t_stop !== undefined
          ? ` over [${String(input.t_start ?? 'start')}, ${String(input.t_stop ?? 'end')}]`
          : '';
      return {
        ops: [],
        data: { vector: vec.name, metric: input.metric, value, points: values.length },
        summary: `${input.metric}(${vec.name})${windowNote} = ${String(Number(value.toPrecision(6)))} (${String(values.length)} point(s))`,
      };
    },
    explain(input): string {
      return `Measure ${input.metric} of ${input.vector}`;
    },
  };

  const readDesignSchema = z.object({});

  const readDesign: AiTool<typeof readDesignSchema> = {
    name: 'read_design',
    description:
      'Cheap digest of the current design: components with values, net connectivity, and ' +
      'constraints. Read this BEFORE your first simulation so you know what you are measuring.',
    schema: readDesignSchema,
    destructive: false,
    costClass: 'cheap',
    execute(_input, ctx): ToolResult {
      const digest = designDigest(ctx);
      return {
        ops: [],
        data: digest,
        summary: digestSummary(digest),
      };
    },
    explain(): string {
      return 'Read the design digest';
    },
  };

  const registry = new ToolRegistry();
  registry.register(runSimulation as AiTool);
  registry.register(measure as AiTool);
  registry.register(readDesign as AiTool);
  return registry;
}
