import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { validateV3SampleProject } from '../v3-validate-sample';

const samplePath = 'scripts/fixtures/v3-real-sample-project.json';

describe('v3 real sample project validation', () => {
  it('validates the checked-in sample from migration through execution readiness', async () => {
    const result = await validateV3SampleProject(samplePath);

    expect(result.status).toBe('ready');
    expect(result.migrationStatus).toBe('ready');
    expect(result.compileStatus).toBe('ready');
    expect(result.executionStatus).toBe('ready');
    expect(result.nodeCount).toBe(6);
    expect(result.edgeCount).toBe(4);
    expect(result.acceptedFacts).toEqual(expect.arrayContaining([
      'Arduino Mega 2560 R3: U1 dip-module-mega2560-r3',
      'TXS0108E level shifter: U2 tssop20',
      'ZS-X11H driver harness: J1 pinrow6',
    ]));
    expect(result.missingFacts).toEqual([]);
    expect(result.emittedTsx).toContain('<board width="120mm" height="80mm">');
    expect(result.executionSummary).toMatchObject({
      workers: 3,
      openAIDispatches: 3,
      codexCommands: 3,
      ownedPins: 3,
    });
  });

  it('runs from the package script as a real CLI smoke check', () => {
    const output = execFileSync('npm', ['run', 'v3:validate-sample', '--', samplePath], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    expect(output).toContain('"status": "ready"');
    expect(output).toContain('"executionStatus": "ready"');
    expect(output).toContain('"emittedTsx"');
  }, 20_000);
});
