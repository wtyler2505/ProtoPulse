import { SpiceEngine } from './engine.js';
import { generateSpiceNetlist } from './netlist.js';

import type { Analysis } from './analyses.js';
import type { SimResult } from './engine.js';
import type { FidelityEntry } from './models.js';
import type { SimulateOpts } from './run.js';
import type { DesignGraph, Uuid } from '@protopulse/graph';
import type { PartDb } from '@protopulse/parts';

/**
 * Parameter stepping: re-run one base analysis with a single component's
 * value swapped through a list of candidates ("what does 100Ω vs 330Ω
 * vs 1k do?"). Values are ordinary value strings and parse exactly like
 * a component value; the graph is never mutated.
 */

export interface StepSpec {
  base: Analysis;
  /** Ref of the component whose value is stepped ("R1"). */
  componentRef: string;
  /** Value strings, e.g. ['100', '330', '1k']. */
  values: string[];
}

export interface StepRun extends SimResult {
  value: string;
}

export interface StepResult {
  runs: StepRun[];
  manifest: FidelityEntry[];
}

export async function simulateStep(
  graph: DesignGraph,
  parts: PartDb,
  spec: StepSpec,
  opts: SimulateOpts = {},
): Promise<StepResult> {
  if (spec.values.length === 0) {
    throw new Error('values must contain at least one entry');
  }
  const component = [...graph.components.values()].find((c) => c.ref === spec.componentRef);
  if (!component) {
    throw new Error(`unknown component ref "${spec.componentRef}"`);
  }

  const engine = opts.engine ?? new SpiceEngine();
  const runs: StepRun[] = [];
  let manifest: FidelityEntry[] = [];
  try {
    for (const value of spec.values) {
      const overrides = new Map<Uuid, string>(opts.valueOverrides ?? []);
      overrides.set(component.id, value);
      const { netlist, manifest: runManifest } = generateSpiceNetlist(graph, parts, {
        title: opts.title,
        valueOverrides: overrides,
      });
      if (runs.length === 0) manifest = runManifest;
      const result = await engine.run(netlist, spec.base);
      runs.push({ ...result, value });
    }
  } finally {
    if (opts.engine === undefined) await engine.stop();
  }
  return { runs, manifest };
}
