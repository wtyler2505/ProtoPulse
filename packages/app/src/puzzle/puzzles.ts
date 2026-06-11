// Deep import: the content package's index re-exports node:fs loaders,
// which the browser bundle must never see. schemas.js is pure zod.
import { PuzzleSchema } from '@protopulse/content/src/schemas.js';

import type { Puzzle } from '@protopulse/content/src/schemas.js';
import type { DesignGraph } from '@protopulse/graph';

/**
 * Failure puzzles (Vol III §1.4): a broken design + a symptom + the
 * instruments — solved when the user ANNOTATES the actual root-cause
 * net/component. The check is an op-log property like everything else:
 * an annotate op anchored at a root-cause entity, with any non-empty
 * text. No quiz UI, no multiple choice — you mark the schematic itself.
 */

const puzzleFiles = import.meta.glob('../../../../content/puzzles/*/puzzle.json', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>;

const designFiles = import.meta.glob('../../../../content/puzzles/*/design.ppx.json', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>;

export interface PuzzleEntry {
  puzzle: Puzzle;
  /** Raw design bundle JSON, ready for decodeBundle/localStorage. */
  designJson: string;
}

/** Load every shipped puzzle, sorted by id. */
export async function loadPuzzles(): Promise<PuzzleEntry[]> {
  const out: PuzzleEntry[] = [];
  for (const [path, load] of Object.entries(puzzleFiles)) {
    const dir = path.slice(0, path.lastIndexOf('/'));
    const designLoader = designFiles[`${dir}/design.ppx.json`];
    if (!designLoader) continue; // a puzzle without its design is not a puzzle
    const puzzle = PuzzleSchema.parse(JSON.parse(await load()));
    out.push({ puzzle, designJson: await designLoader() });
  }
  return out.sort((a, b) => (a.puzzle.id < b.puzzle.id ? -1 : 1));
}

/** Solved = any non-empty annotation anchored at a root-cause entity. */
export function puzzleSolved(graph: DesignGraph, puzzle: Puzzle): boolean {
  return graph.annotations.some(
    (a) => puzzle.rootCause.anchors.includes(a.anchor) && a.text.trim().length > 0,
  );
}
