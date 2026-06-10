import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BranchLog, MAIN_BRANCH } from '../branch.js';
import { materialize } from '../materialize.js';
import type { OpEnvelope } from '../ops.js';
import { envelopes, ledCircuitOps } from '../test-helpers.js';
import {
  decodeBundle,
  decodeOpl,
  encodeBundle,
  encodeOpl,
  graphFromJson,
  graphToJson,
  type DesignBundle,
} from './serialize.js';
import { loadDesignDir, saveDesignDir, SEGMENT_BYTE_CAP } from './fs-store.js';

const tmpDirs: string[] = [];
function tmp(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ppx-test-'));
  tmpDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('opl encoding', () => {
  it('round-trips ops as JSON Lines, skipping blank lines', () => {
    const envs = envelopes(ledCircuitOps());
    const text = encodeOpl(envs);
    expect(text.endsWith('\n')).toBe(true);
    expect(decodeOpl(text)).toEqual(envs);
    expect(decodeOpl(`\n${text}\n\n`)).toEqual(envs);
    expect(decodeOpl('')).toEqual([]);
    expect(encodeOpl([])).toBe('');
  });

  it('rejects malformed lines through the envelope schema', () => {
    expect(() => decodeOpl('{"not":"an op"}\n')).toThrow();
  });
});

describe('graph snapshot JSON', () => {
  it('round-trips Maps through entry arrays', () => {
    const graph = materialize(envelopes(ledCircuitOps())).graph;
    const restored = graphFromJson(JSON.parse(JSON.stringify(graphToJson(graph))));
    expect(JSON.stringify(graphToJson(restored))).toBe(JSON.stringify(graphToJson(graph)));
    expect(restored.components).toBeInstanceOf(Map);
    expect(restored.nets.size).toBe(graph.nets.size);
  });
});

describe('design bundle', () => {
  it('round-trips a multi-branch design', () => {
    const log = new BranchLog();
    for (const e of envelopes(ledCircuitOps())) log.append(MAIN_BRANCH, e);
    log.createBranch('try-alt', MAIN_BRANCH);
    log.append('try-alt', { actor: 'b', lamport: 50, ts: 0, op: { kind: 'checkpoint', label: 'alt' } });
    const bundle: DesignBundle = {
      format: 'ppx-bundle',
      version: 1,
      designId: 'd1',
      head: 'try-alt',
      branches: log.entries(),
    };
    const decoded = decodeBundle(encodeBundle(bundle));
    expect(decoded).toEqual(bundle);
  });

  it('rejects bundles with a bad shape', () => {
    expect(() => decodeBundle('{"format":"nope"}')).toThrow();
  });
});

describe('fs-store (.ppx directory)', () => {
  it('saves and loads a multi-branch design with identical materialization', () => {
    const log = new BranchLog();
    for (const e of envelopes(ledCircuitOps())) log.append(MAIN_BRANCH, e);
    log.createBranch('try-buck', MAIN_BRANCH);
    log.append('try-buck', { actor: 'b', lamport: 99, ts: 0, op: { kind: 'set_design_meta', patch: { alt: 'yes' } } });

    const dir = join(tmp(), 'mydesign.ppx');
    saveDesignDir(dir, { designId: 'design-1', head: MAIN_BRANCH, log });
    const loaded = loadDesignDir(dir);

    expect(loaded.designId).toBe('design-1');
    expect(loaded.head).toBe(MAIN_BRANCH);
    expect(loaded.log.names().sort()).toEqual([MAIN_BRANCH, 'try-buck']);
    const a = materialize(log.opsFor('try-buck')).graph;
    const b = materialize(loaded.log.opsFor('try-buck')).graph;
    expect(JSON.stringify(graphToJson(a))).toBe(JSON.stringify(graphToJson(b)));
    // The op files are honest JSON Lines.
    const segDir = join(dir, 'ops', 'main');
    const firstSeg = readFileSync(join(segDir, '000001.opl'), 'utf8');
    expect(firstSeg.split('\n')[0]).toContain('"add_component"');
  });

  it('rotates segments at the byte cap', () => {
    const log = new BranchLog();
    // Build ops big enough to overflow one segment.
    const bigText = 'x'.repeat(1024 * 512);
    for (let i = 0; i < 10; i++) {
      const env: OpEnvelope = {
        actor: 'a',
        lamport: i + 1,
        ts: 0,
        op: { kind: 'annotate', anchor: 'n1', text: bigText },
      };
      log.append(MAIN_BRANCH, env);
    }
    const totalBytes = 10 * (bigText.length + 100);
    expect(totalBytes).toBeGreaterThan(SEGMENT_BYTE_CAP);
    const dir = join(tmp(), 'big.ppx');
    saveDesignDir(dir, { designId: 'big', head: MAIN_BRANCH, log });
    const segments = readdirSync(join(dir, 'ops', 'main')).filter((f) => f.endsWith('.opl'));
    expect(segments.length).toBeGreaterThan(1);
    const loaded = loadDesignDir(dir);
    expect(loaded.log.opsFor(MAIN_BRANCH)).toHaveLength(10);
  });

  it('sanitizes branch names for the filesystem', () => {
    const log = new BranchLog();
    log.createBranch('feat/risky name', MAIN_BRANCH);
    const dir = join(tmp(), 's.ppx');
    saveDesignDir(dir, { designId: 's', head: MAIN_BRANCH, log });
    const loaded = loadDesignDir(dir);
    expect(loaded.log.has('feat/risky name')).toBe(true);
  });

  it('errors on a directory without a manifest and on a bad head', () => {
    expect(() => loadDesignDir(tmp())).toThrow('missing manifest.json');
  });
});

describe('fs-store — corrupt manifests', () => {
  it('rejects a manifest whose head is not a branch', () => {
    const log = new BranchLog();
    const dir = join(tmp(), 'h.ppx');
    saveDesignDir(dir, { designId: 'h', head: MAIN_BRANCH, log });
    const manifestPath = join(dir, 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { head: string };
    manifest.head = 'ghost';
    writeFileSync(manifestPath, JSON.stringify(manifest));
    expect(() => loadDesignDir(dir)).toThrow('not a branch');
  });

  it('tolerates a branch listed in the manifest with no ops directory', () => {
    const log = new BranchLog();
    const dir = join(tmp(), 'n.ppx');
    saveDesignDir(dir, { designId: 'n', head: MAIN_BRANCH, log });
    rmSync(join(dir, 'ops', 'main'), { recursive: true, force: true });
    const loaded = loadDesignDir(dir);
    expect(loaded.log.opsFor(MAIN_BRANCH)).toEqual([]);
  });
});
