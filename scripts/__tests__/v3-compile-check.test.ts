import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { runV3CompileCheckFromFile } from '../v3-compile-check';

function writeFixture(name: string, payload: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), 'pp-v3-compile-'));
  const file = join(dir, name);
  writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return file;
}

const readyPayload = {
  nodes: [
    {
      id: 'r1',
      type: 'custom',
      position: { x: 0, y: 0 },
      data: { label: 'Pullup', type: 'resistor', verified: true, referenceDesignator: 'R1', value: '10k', footprint: '0603' },
    },
    {
      id: 'c1',
      type: 'custom',
      position: { x: 200, y: 0 },
      data: { label: 'Filter cap', type: 'capacitor', verified: true, referenceDesignator: 'C1', value: '100nF', footprint: '0603' },
    },
  ],
  edges: [
    {
      id: 'rc',
      source: 'r1',
      target: 'c1',
      label: 'RC',
      data: { netName: 'net.RC', sourcePin: 'pin1', targetPin: 'pin1' },
    },
  ],
};

describe('v3 compile check CLI', () => {
  it('returns a ready report from one JSON file', async () => {
    const file = writeFixture('ready.json', readyPayload);

    const result = await runV3CompileCheckFromFile(file);

    expect(result.status).toBe('ready');
    expect(result.nodeCount).toBe(2);
    expect(result.edgeCount).toBe(1);
    expect(result.emittedTsx).toContain('<trace from="R1.pin1" to="C1.pin1" />');
  });

  it('returns a blocked report without emitted TSX when facts are unverified', async () => {
    const file = writeFixture('blocked.json', {
      nodes: [
        { id: 'mystery', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'Mystery board', type: 'hardware' } },
      ],
      edges: [],
    });

    const result = await runV3CompileCheckFromFile(file);

    expect(result.status).toBe('blocked');
    expect(result.emittedTsx).toBeNull();
    expect(result.missingFacts).toEqual(['Mystery board: verified hardware fact']);
  });

  it('exits non-zero for blocked input unless explicitly allowed', () => {
    const file = writeFixture('blocked-cli.json', {
      nodes: [
        { id: 'mystery', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'Mystery board', type: 'hardware' } },
      ],
    });

    const blocked = spawnSync('npx', ['tsx', 'scripts/v3-compile-check.ts', file], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    expect(blocked.status).toBe(2);
    expect(blocked.stdout).toContain('"status": "blocked"');

    const allowed = execFileSync('npx', ['tsx', 'scripts/v3-compile-check.ts', file, '--allow-blocked'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    expect(allowed).toContain('"status": "blocked"');
  }, 20_000);
});
