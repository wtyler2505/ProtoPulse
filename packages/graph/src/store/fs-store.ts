import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

import { BranchLog  } from '../branch.js';

import { decodeOpl, encodeOpl, PPX_FORMAT_VERSION } from './serialize.js';

import type {BranchState} from '../branch.js';
import type { OpEnvelope } from '../ops.js';

/**
 * The on-disk design directory — Vol II §A.6:
 *
 *   mydesign.ppx/
 *     manifest.json
 *     ops/<branch>/000001.opl     JSON Lines, one op per line, 4MB cap
 *     snapshots/                  (optional acceleration; not written in M1)
 *     assets/
 *
 * Node-only module; browser builds use the single-file bundle instead.
 */
export const SEGMENT_BYTE_CAP = 4 * 1024 * 1024;

const manifestSchema = z.object({
  format: z.literal('ppx'),
  version: z.number().int().positive(),
  designId: z.string().min(1),
  head: z.string().min(1),
  branches: z.record(
    z.string(),
    z.object({
      base: z.object({ branch: z.string().nullable(), opCount: z.number().int().nonnegative() }),
    }),
  ),
});

export type PpxManifest = z.infer<typeof manifestSchema>;

export interface LoadedDesign {
  designId: string;
  head: string;
  log: BranchLog;
}

/** Branch names map to segment dirs; keep them filesystem-safe. */
function branchDirName(branch: string): string {
  return branch.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function loadDesignDir(dir: string): LoadedDesign {
  const manifestPath = join(dir, 'manifest.json');
  if (!existsSync(manifestPath)) {
    throw new Error(`${dir} is not a .ppx design directory (missing manifest.json)`);
  }
  const manifest = manifestSchema.parse(JSON.parse(readFileSync(manifestPath, 'utf8')));

  const branches = new Map<string, BranchState>();
  for (const [name, info] of Object.entries(manifest.branches)) {
    const segDir = join(dir, 'ops', branchDirName(name));
    const ops: OpEnvelope[] = [];
    if (existsSync(segDir)) {
      const segments = readdirSync(segDir)
        .filter((f) => f.endsWith('.opl'))
        .sort();
      for (const seg of segments) {
        ops.push(...decodeOpl(readFileSync(join(segDir, seg), 'utf8')));
      }
    }
    branches.set(name, { name, base: info.base, ops });
  }
  if (!branches.has(manifest.head)) {
    throw new Error(`manifest head "${manifest.head}" is not a branch`);
  }
  return { designId: manifest.designId, head: manifest.head, log: new BranchLog(branches) };
}

export function saveDesignDir(dir: string, design: LoadedDesign): void {
  mkdirSync(dir, { recursive: true });
  const manifest: PpxManifest = {
    format: 'ppx',
    version: PPX_FORMAT_VERSION,
    designId: design.designId,
    head: design.head,
    branches: {},
  };
  for (const branch of design.log.entries()) {
    manifest.branches[branch.name] = { base: branch.base };
    const segDir = join(dir, 'ops', branchDirName(branch.name));
    mkdirSync(segDir, { recursive: true });
    // Segment rotation: pack ops into ≤4MB JSON-Lines files.
    let segIndex = 1;
    let current: OpEnvelope[] = [];
    let currentBytes = 0;
    const flush = (): void => {
      const name = `${String(segIndex).padStart(6, '0')}.opl`;
      writeFileSync(join(segDir, name), encodeOpl(current));
      segIndex += 1;
      current = [];
      currentBytes = 0;
    };
    for (const op of branch.ops) {
      const bytes = JSON.stringify(op).length + 1;
      if (currentBytes + bytes > SEGMENT_BYTE_CAP && current.length > 0) flush();
      current.push(op);
      currentBytes += bytes;
    }
    flush(); // always write at least one segment so the branch dir exists
  }
  mkdirSync(join(dir, 'assets'), { recursive: true });
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
}
