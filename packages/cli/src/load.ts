import { readFileSync, statSync } from 'node:fs';

import { BranchLog, decodeBundle, materialize  } from '@protopulse/graph';
import { loadDesignDir } from '@protopulse/graph/fs-store';

import type {MaterializeResult} from '@protopulse/graph';

export interface LoadedForCli {
  designId: string;
  branch: string;
  result: MaterializeResult;
}

/** Load a design from a .ppx directory or a single-file .ppx.json bundle. */
export function loadDesign(path: string, branchOverride?: string): LoadedForCli {
  const stats = statSync(path);
  let designId: string;
  let head: string;
  let log: BranchLog;

  if (stats.isDirectory()) {
    const loaded = loadDesignDir(path);
    designId = loaded.designId;
    head = loaded.head;
    log = loaded.log;
  } else {
    const bundle = decodeBundle(readFileSync(path, 'utf8'));
    designId = bundle.designId;
    head = bundle.head;
    const branches = new Map(bundle.branches.map((b) => [b.name, b]));
    log = new BranchLog(branches);
  }

  const branch = branchOverride ?? head;
  if (!log.has(branch)) {
    throw new Error(`branch "${branch}" does not exist (have: ${log.names().join(', ')})`);
  }
  return { designId, branch, result: materialize(log.opsFor(branch)) };
}
