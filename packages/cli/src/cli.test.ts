import { execFileSync, execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Exercises the BUILT bundle — the artifact CI and users actually run.
 */
const pkgDir = resolve(import.meta.dirname, '..');
const bin = join(pkgDir, 'dist', 'protopulse.js');
const fixtures = resolve(pkgDir, '..', '..', 'tools', 'golden', 'fixtures');
const cleanBundle = join(fixtures, 'traffic-light-555', 'design.ppx.json');

let tmp: string;

beforeAll(() => {
  execSync('npm run build', { cwd: pkgDir, stdio: 'ignore' });
  tmp = mkdtempSync(join(tmpdir(), 'ppx-cli-'));
});
afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function run(args: string[]): { status: number; stdout: string } {
  try {
    const stdout = execFileSync('node', [bin, ...args], { encoding: 'utf8' });
    return { status: 0, stdout };
  } catch (err) {
    const e = err as { status?: number; stdout?: string };
    return { status: e.status ?? -1, stdout: e.stdout ?? '' };
  }
}

describe('protopulse check', () => {
  it('exits 0 on a clean design (pretty output)', () => {
    const { status, stdout } = run(['check', cleanBundle]);
    expect(status).toBe(0);
    expect(stdout).toContain('0 error(s)');
  });

  it('emits a JSON report with counts and findings', () => {
    const { status, stdout } = run(['check', cleanBundle, '--format', 'json']);
    expect(status).toBe(0);
    const report = JSON.parse(stdout) as { designId: string; counts: { error: number } };
    expect(report.designId).toBe('traffic-light-555');
    expect(report.counts.error).toBe(0);
  });

  it('exits 1 when findings hit the --fail-on threshold', () => {
    // The traffic light is warning-free; build a warn case: single-port net.
    const bundle = JSON.parse(readFileSync(cleanBundle, 'utf8')) as {
      branches: { ops: unknown[] }[];
    };
    bundle.branches[0]?.ops.push({
      actor: 'test',
      lamport: 999,
      ts: 0,
      op: { kind: 'connect', port: 'ct:1', netId: 'net-gnd' },
    });
    // ct:1 is already on net-timing → op fails → materialize warning, not findings.
    // Use a genuinely dangling wire instead:
    bundle.branches[0]?.ops.pop();
    bundle.branches[0]?.ops.push(
      { actor: 'test', lamport: 999, ts: 0, op: { kind: 'add_component', id: 'rx', ref: 'R99', partId: 'core:resistor', partRev: 1 } },
      { actor: 'test', lamport: 1000, ts: 0, op: { kind: 'connect', port: 'rx:1', newNetId: 'net-dangle' } },
    );
    const warnBundle = join(tmp, 'warn.ppx.json');
    writeFileSync(warnBundle, JSON.stringify(bundle));
    expect(run(['check', warnBundle]).status).toBe(0); // warns don't fail by default
    expect(run(['check', warnBundle, '--fail-on', 'warn']).status).toBe(1);
  });

  it('exits 1 on errors (floating input)', () => {
    const bundle = {
      format: 'ppx-bundle',
      version: 1,
      designId: 'broken',
      head: 'main',
      branches: [
        {
          name: 'main',
          base: { branch: null, opCount: 0 },
          ops: [
            { actor: 't', lamport: 1, ts: 0, op: { kind: 'add_component', id: 'u1', ref: 'U1', partId: 'core:ne555', partRev: 1 } },
          ],
        },
      ],
    };
    const path = join(tmp, 'broken.ppx.json');
    writeFileSync(path, JSON.stringify(bundle));
    const { status, stdout } = run(['check', path]);
    expect(status).toBe(1);
    expect(stdout).toContain('ERC-FLOATING-INPUT');
  });

  it('exits 2 on a missing design or unknown branch', () => {
    expect(run(['check', join(tmp, 'nope.ppx.json')]).status).toBe(2);
    expect(run(['check', cleanBundle, '--branch', 'ghost']).status).toBe(2);
  });
});

describe('protopulse export', () => {
  it('writes a netlist matching the golden file when the date is pinned', () => {
    const out = join(tmp, 'out.net');
    const { status } = run(['export', cleanBundle, '--netlist', out, '--date', '2026-01-01T00:00:00.000Z']);
    expect(status).toBe(0);
    const expected = readFileSync(join(fixtures, 'traffic-light-555', 'expected.net'), 'utf8');
    expect(readFileSync(out, 'utf8')).toBe(expected);
  });

  it('writes a BOM and errors with exit 2 when given nothing to do', () => {
    const out = join(tmp, 'out.csv');
    expect(run(['export', cleanBundle, '--bom', out]).status).toBe(0);
    expect(readFileSync(out, 'utf8')).toContain('Refs,Qty,Value');
    expect(run(['export', cleanBundle]).status).toBe(2);
  });
});
