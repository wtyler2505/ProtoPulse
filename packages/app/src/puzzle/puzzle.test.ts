import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { PuzzleSchema } from '@protopulse/content/src/schemas.js';
import { runErc } from '@protopulse/erc';
import { applyOp, decodeBundle, materialize } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { describe, expect, it } from 'vitest';

import { puzzleSolved } from './puzzles.js';

import type { DesignGraph } from '@protopulse/graph';

/**
 * The puzzle PREMISE is physics, so physics verifies it: the broken
 * design's bus genuinely never reads high (real ngspice run), and the
 * canonical fix genuinely repairs it. A failure puzzle whose failure
 * doesn't reproduce is a lie with a UI.
 */

const dir = resolve(import.meta.dirname, '..', '..', '..', '..', 'content', 'puzzles', 'slow-rise-11');
const puzzle = PuzzleSchema.parse(JSON.parse(readFileSync(resolve(dir, 'puzzle.json'), 'utf8')));
const parts = seedPartDb();

function puzzleGraph(): DesignGraph {
  const bundle = decodeBundle(readFileSync(resolve(dir, 'design.ppx.json'), 'utf8'));
  const main = bundle.branches.find((b) => b.name === bundle.head);
  if (!main) throw new Error('no head branch');
  const result = materialize(main.ops);
  const failed = result.warnings.filter((w) => w.kind === 'apply_failed');
  if (failed.length > 0) throw new Error(failed.map((w) => w.message).join('; '));
  expect(result.violations).toEqual([]);
  return result.graph;
}

describe('slow-rise-11 (schema + ERC + checker)', () => {
  it('validates against the puzzle schema and its anchors exist in the design', () => {
    const graph = puzzleGraph();
    for (const anchor of puzzle.rootCause.anchors) {
      expect(graph.components.has(anchor) || graph.nets.has(anchor)).toBe(true);
    }
  });

  it('ERC passes — the bug is legal electricity, just wrong values', () => {
    const findings = runErc(puzzleGraph(), parts);
    expect(findings.filter((f) => f.severity === 'error')).toEqual([]);
  });

  it('annotating a root-cause entity solves it; annotating elsewhere does not', () => {
    const graph = puzzleGraph();
    expect(puzzleSolved(graph, puzzle)).toBe(false);

    const wrong = applyOp(graph, { kind: 'annotate', anchor: 'cbus', text: 'this cap looks sus' });
    expect(wrong.ok).toBe(true);
    expect(puzzleSolved(graph, puzzle)).toBe(false);

    const right = applyOp(graph, { kind: 'annotate', anchor: 'rpull', text: 'pull-up too weak for the bus capacitance' });
    expect(right.ok).toBe(true);
    expect(puzzleSolved(graph, puzzle)).toBe(true);
  });
});

describe('slow-rise-11 (the physics, real engine)', () => {
  it('the broken bus never reads high; the canonical fix repairs it', { timeout: 180_000 }, async () => {
    const { simulate } = await import('@protopulse/sim');
    const tran = { kind: 'tran', stepS: 2e-6, stopS: 5e-3 } as const;

    const busPeakAfterSettle = (result: {
      vectors: { name: string; values: number[] }[];
    }): number => {
      const time = result.vectors.find((v) => v.name.toLowerCase() === 'time');
      const bus = result.vectors.find((v) => v.name.toLowerCase() === 'v(bus)');
      if (!time || !bus) throw new Error('missing time/v(bus) vectors');
      let peak = -Infinity;
      for (let i = 0; i < time.values.length; i++) {
        const t = time.values[i];
        const v = bus.values[i];
        if (t !== undefined && v !== undefined && t > 2e-3 && v > peak) peak = v;
      }
      return peak;
    };

    const broken = await simulate(puzzleGraph(), parts, tran);
    const brokenPeak = busPeakAfterSettle(broken);
    expect(brokenPeak).toBeLessThan(2.5); // never a valid high

    const fixed = puzzleGraph();
    const swap = applyOp(fixed, {
      kind: 'set_component_props',
      id: 'rpull',
      props: { value: '4.7k' },
    });
    expect(swap.ok).toBe(true);
    const repaired = await simulate(fixed, parts, tran);
    expect(busPeakAfterSettle(repaired)).toBeGreaterThan(3.5); // comfortably high
    expect(busPeakAfterSettle(repaired)).toBeGreaterThan(brokenPeak + 2);
  });
});
