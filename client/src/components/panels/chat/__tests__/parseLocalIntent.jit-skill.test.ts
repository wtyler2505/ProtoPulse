import { describe, expect, it } from 'vitest';
import { parseLocalIntent } from '../parseLocalIntent';
import type { IntentContext } from '../parseLocalIntent';

const baseContext: IntentContext = {
  nodes: [],
  edges: [],
  bom: [],
  issues: [],
  projectName: 'ProtoPulse',
  projectDescription: 'Test project',
  activeView: 'architecture',
};

describe('parseLocalIntent JIT skill command routing', () => {
  it('parses explicit slash command text into run_jit_skill action', () => {
    const result = parseLocalIntent('/resolve-net-driver-conflict', baseContext);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]?.type).toBe('run_jit_skill');
    expect(result.actions[0]?.command).toBe('/resolve-net-driver-conflict');
    expect(result.response).toContain('Queued skill command');
  });

  it('extracts slash command embedded in a longer sentence', () => {
    const result = parseLocalIntent(
      'Run this remediation skill command now: /apply-input-bias-network.',
      baseContext,
    );
    expect(result.actions[0]?.type).toBe('run_jit_skill');
    expect(result.actions[0]?.command).toBe('/apply-input-bias-network');
  });
});

